// The router walks the configured provider chain for one capability and returns the first
// answer, with the full trail of attempts so the pack can show where every number came from.
//
//   status ok        the first provider that was tried answered
//   status fallback  an earlier provider failed or had nothing, a later one answered
//   status stale     every provider failed; a cached answer past its TTL was served
//   status missing   nobody had data (or no provider is configured with a key)
//   status error     every provider that was tried failed
import { CAPABILITIES, METHOD, ProviderError, isEmpty } from './lib/contract.mjs';
import { createHttp } from './lib/http.mjs';
import { createLimiter } from './lib/ratelimit.mjs';
import { createCache } from './lib/cache.mjs';
import { redactText, registerSecret } from './lib/redact.mjs';

/**
 * @param {{
 *   config: object,
 *   adapters: Map<string, object>,
 *   env: { get(name:string): string },
 *   series?: Record<string, {providers: Record<string,string>}>,
 *   fetchImpl?: typeof fetch,
 *   cacheDir?: string,
 *   now?: () => number,          // the data clock (as-of dates, cache ages)
 *   clock?: () => number,        // the wall clock for rate limiting (defaults to Date.now)
 *   sleep?: (ms:number)=>Promise<void>,
 *   log?: (entry: object) => void,
 * }} o
 */
export function createRouter(o) {
  const { config, adapters, env, series = {}, fetchImpl = globalThis.fetch, now = () => Date.now(), clock = () => Date.now(), sleep, log = () => {} } = o;
  const cacheOn = config.cache?.enabled !== false && Boolean(o.cacheDir);
  const cache = createCache({ dir: o.cacheDir, now, enabled: cacheOn });
  const limiters = new Map();
  const https = new Map();
  const memo = new Map();
  const inMemory = new Map();

  const pcfg = (id) => config.providers?.[id] || {};

  function keyFor(adapter) {
    const names = [pcfg(adapter.id).keyEnv || adapter.keyEnv, ...(adapter.keyEnvAliases || [])].filter(Boolean);
    for (const n of names) {
      const v = env.get(n);
      if (v) return v;
    }
    return '';
  }

  function httpFor(id) {
    if (!https.has(id)) {
      const c = pcfg(id);
      if (!limiters.has(id)) limiters.set(id, createLimiter({ rps: c.rps ?? 5, burst: c.burst, now: clock, ...(sleep ? { sleep } : {}) }));
      https.set(
        id,
        createHttp({
          provider: id,
          fetchImpl,
          timeoutMs: c.timeoutMs ?? config.http?.timeoutMs ?? 8000,
          retries: c.retries ?? config.http?.retries ?? 2,
          backoffMs: c.backoffMs ?? config.http?.backoffMs ?? 500,
          limiter: limiters.get(id),
          ...(sleep ? { sleep } : {}),
          log,
        }),
      );
    }
    return https.get(id);
  }

  function ctxFor(adapter, key) {
    const c = pcfg(adapter.id);
    const config = { ...c };
    // A contact string (the SEC asks for a name and email) comes from an env var or the
    // user's config file, never from the command line.
    const contact = (c.contactEnv && env.get(c.contactEnv)) || c.contact || '';
    if (contact) {
      config.contact = String(contact).replace(/[\r\n]/g, ' ').trim();
      // Mask it in every log line and error, whether it came from the env or the config file.
      registerSecret(config.contact);
    }
    return {
      http: httpFor(adapter.id),
      key,
      config,
      now,
      log,
      /** Memoize an internal lookup (e.g. a ticker map) in the file cache. */
      async remember(k, ttlSeconds, fn) {
        if (inMemory.has(k)) return inMemory.get(k);
        const hit = adapter.cacheable !== false ? cache.get(`remember:${k}`, ttlSeconds) : null;
        if (hit) {
          inMemory.set(k, hit.value);
          return hit.value;
        }
        const v = await fn();
        inMemory.set(k, v);
        if (adapter.cacheable !== false && v !== null && v !== undefined) cache.set(`remember:${k}`, v);
        return v;
      },
    };
  }

  /** Providers to try for a capability, in order. */
  function chainFor(capability, override) {
    return override || config.chains?.[capability] || [];
  }

  /**
   * Fetch one capability.
   * @param {string} capability
   * @param {string} arg   symbol, or canonical macro series id for macroSeries
   * @param {object} [opts] passed to the adapter method
   * @param {{ chain?: string[] }} [route]
   * @returns {Promise<{ data: any, meta: { source: string|null, asOf: string|null, status: string, note?: string }, attempts: object[] }>}
   */
  async function get(capability, arg, opts = {}, route = {}) {
    if (!CAPABILITIES.includes(capability)) throw new Error(`unknown capability ${capability}`);
    const memoKey = JSON.stringify([capability, arg, opts, route.chain || null]);
    if (!memo.has(memoKey)) memo.set(memoKey, run(capability, arg, opts, route));
    return memo.get(memoKey);
  }

  async function run(capability, arg, opts, route) {
    const attempts = [];
    const ttl = config.cache?.ttlSeconds?.[capability] ?? 0;
    const staleMax = config.cache?.staleMaxSeconds?.[capability] ?? 0;
    const tried = [];
    let failedBefore = false;

    for (const id of chainFor(capability, route.chain)) {
      const adapter = adapters.get(id);
      if (!adapter) {
        attempts.push({ provider: id, status: 'unknown', note: 'no adapter with this id' });
        continue;
      }
      if (!adapter.capabilities.includes(capability)) continue;
      let providerArg = arg;
      if (capability === 'macroSeries') {
        providerArg = series[arg]?.providers?.[id];
        if (!providerArg) continue;
      }
      const key = keyFor(adapter);
      if (adapter.needsKey && !key) {
        attempts.push({ provider: id, status: 'skipped', note: `no key (${pcfg(id).keyEnv || adapter.keyEnv})` });
        continue;
      }
      const cacheKey = JSON.stringify([id, capability, providerArg, opts]);
      tried.push({ id, cacheKey, cacheable: adapter.cacheable !== false });
      const cached = adapter.cacheable !== false ? cache.get(cacheKey, ttl) : null;
      if (cached) {
        attempts.push({ provider: id, status: 'cache' });
        return finish(cached.value, failedBefore ? 'fallback' : cached.value.meta.status || 'ok', attempts);
      }
      const started = now();
      try {
        const out = await adapter[METHOD[capability]](providerArg, opts, ctxFor(adapter, key));
        if (!out || isEmpty(out.data)) {
          attempts.push({ provider: id, status: 'empty', ms: now() - started, ...(out?.meta?.note ? { note: redactText(out.meta.note) } : {}) });
          failedBefore = true;
          continue;
        }
        attempts.push({ provider: id, status: 'ok', ms: now() - started });
        if (adapter.cacheable !== false && ttl > 0) cache.set(cacheKey, out);
        if (adapter.cacheable !== false && ttl === 0 && staleMax > 0) cache.set(cacheKey, out);
        return finish(out, failedBefore ? 'fallback' : 'ok', attempts);
      } catch (err) {
        const pe = err instanceof ProviderError;
        attempts.push({
          provider: id,
          status: 'error',
          kind: pe ? err.kind : 'adapter_bug',
          ...(pe && err.status ? { httpStatus: err.status } : {}),
          note: redactText(err?.message || String(err)).slice(0, 300),
          ms: now() - started,
        });
        failedBefore = true;
      }
    }

    // Every live provider failed: serve the newest cached answer within its stale window.
    if (staleMax > 0) {
      for (const t of tried) {
        if (!t.cacheable) continue;
        const e = cache.getStale(t.cacheKey, staleMax);
        if (e) {
          attempts.push({ provider: t.id, status: 'stale-cache', note: `cached ${new Date(e.storedAt).toISOString()}` });
          return finish(e.value, 'stale', attempts, `served from cache stored ${new Date(e.storedAt).toISOString().slice(0, 10)}; live providers failed`);
        }
      }
    }

    const anyError = attempts.some((a) => a.status === 'error');
    const anyAnswer = attempts.some((a) => a.status === 'empty');
    const status = anyError && !anyAnswer ? 'error' : 'missing';
    const note = attempts.length ? summarize(attempts) : 'no provider configured for this capability';
    return { data: null, meta: { source: null, asOf: null, status, note }, attempts };
  }

  function finish(out, status, attempts, extraNote) {
    const note = [out.meta?.note, extraNote].filter(Boolean).join('; ');
    return { data: out.data, meta: { source: out.meta.source, asOf: out.meta.asOf || null, status, ...(note ? { note: redactText(note) } : {}) }, attempts };
  }

  return { get, chainFor, keyFor: (id) => (adapters.get(id) ? Boolean(keyFor(adapters.get(id))) : false), adapters };
}

function summarize(attempts) {
  return attempts.map((a) => `${a.provider}: ${a.status}${a.note ? ` (${a.note})` : ''}`).join('; ');
}
