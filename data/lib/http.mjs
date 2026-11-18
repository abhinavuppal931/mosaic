// HTTP for adapters: timeout, retry with exponential backoff on 429/5xx/network errors,
// Retry-After support, a per-provider rate limiter, and redacted URLs in every error and log.
import { ProviderError } from './contract.mjs';
import { redactUrl, redactText } from './redact.mjs';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * @param {{
 *   provider: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   retries?: number,
 *   backoffMs?: number,
 *   limiter?: { take(): Promise<void> },
 *   headers?: Record<string,string>,
 *   sleep?: (ms:number)=>Promise<void>,
 *   log?: (entry: object)=>void,
 *   random?: ()=>number,
 * }} o
 */
export function createHttp(o) {
  const {
    provider,
    fetchImpl = globalThis.fetch,
    timeoutMs = 8000,
    retries = 2,
    backoffMs = 500,
    limiter,
    headers: baseHeaders = {},
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    log = () => {},
    random = Math.random,
  } = o;

  async function once(url, init) {
    if (limiter) await limiter.take();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const started = Date.now();
    try {
      const res = await fetchImpl(url, { ...init, headers: { ...baseHeaders, ...(init.headers || {}) }, signal: ac.signal });
      log({ provider, url: redactUrl(url), status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      const timedOut = ac.signal.aborted;
      log({ provider, url: redactUrl(url), error: timedOut ? 'timeout' : 'network', ms: Date.now() - started });
      throw new ProviderError(
        timedOut ? `${provider}: timed out after ${timeoutMs} ms (${redactUrl(url)})` : `${provider}: network error (${redactUrl(url)}): ${redactText(err?.message || String(err))}`,
        { kind: timedOut ? 'timeout' : 'network', provider },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(url, init = {}, { allow404 = false } = {}) {
    let attempt = 0;
    for (;;) {
      let res;
      try {
        res = await once(url, init);
      } catch (err) {
        if (attempt < retries) {
          await sleep(backoff(attempt++));
          continue;
        }
        throw err;
      }
      if (res.ok) return res;
      if (res.status === 404 && allow404) return null;
      const retryAfterMs = parseRetryAfter(res.headers?.get?.('retry-after'));
      if (RETRYABLE.has(res.status) && attempt < retries) {
        await sleep(Math.max(retryAfterMs ?? 0, backoff(attempt++)));
        continue;
      }
      const kind = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate_limit' : 'http';
      throw new ProviderError(`${provider}: HTTP ${res.status} (${redactUrl(url)})`, { kind, status: res.status, provider, retryAfterMs });
    }
  }

  function backoff(n) {
    return Math.round(backoffMs * 2 ** n * (0.75 + random() * 0.5));
  }

  return {
    async getJson(url, opts = {}) {
      const res = await request(url, { method: 'GET', headers: opts.headers }, opts);
      if (!res) return null;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new ProviderError(`${provider}: response was not JSON (${redactUrl(url)})`, { kind: 'parse', provider });
      }
    },
    async getText(url, opts = {}) {
      const res = await request(url, { method: 'GET', headers: opts.headers }, opts);
      return res ? res.text() : null;
    },
    async postJson(url, body, opts = {}) {
      const res = await request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, body: JSON.stringify(body) }, opts);
      if (!res) return null;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new ProviderError(`${provider}: response was not JSON (${redactUrl(url)})`, { kind: 'parse', provider });
      }
    },
  };
}

function parseRetryAfter(v) {
  if (!v) return undefined;
  const s = Number(v);
  if (Number.isFinite(s)) return Math.min(s * 1000, 60_000);
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.min(Math.max(0, t - Date.now()), 60_000) : undefined;
}
