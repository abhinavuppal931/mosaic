// Router: fallback chain, skips, retries, timeouts, rate limits, cache, stale serving, redaction.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeRouter, NOW } from './helpers/setup.mjs';
import { blockNetwork, fakeFetch } from './helpers/fake-fetch.mjs';
import { createRouter } from '../../data/router.mjs';
import { createHttp } from '../../data/lib/http.mjs';
import { createLimiter } from '../../data/lib/ratelimit.mjs';
import { createCache } from '../../data/lib/cache.mjs';
import { createEnv, parseEnvFile } from '../../data/lib/env.mjs';
import { redactUrl, redactText, registerSecret, clearSecrets } from '../../data/lib/redact.mjs';
import { loadConfig, deepMerge, writeUserConfigValue } from '../../data/lib/config.mjs';
import { loadAdapters } from '../../data/providers/index.mjs';
import { ProviderError, validateAdapter, result } from '../../data/lib/contract.mjs';
import { resolveHome, isPluginCache } from '../../data/lib/paths.mjs';

before(() => {
  blockNetwork();
  clearSecrets();
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-test-'));

/** A tiny in-memory adapter for routing tests. */
function stub(id, behaviour, extra = {}) {
  return {
    id,
    name: id,
    needsKey: false,
    keyEnv: null,
    capabilities: ['quote'],
    cacheable: true,
    calls: 0,
    async getQuote(symbol) {
      this.calls += 1;
      return behaviour(symbol, this.calls);
    },
    ...extra,
  };
}

function routerWith(adapters, { chain, cacheDir, config: over = {}, env = {} } = {}) {
  const config = deepMerge(loadConfig(), { chains: { quote: chain || adapters.map((a) => a.id) }, ...over });
  if (!cacheDir) config.cache.enabled = false;
  let t = 0;
  return createRouter({ config, adapters: new Map(adapters.map((a) => [a.id, a])), env: createEnv({ env }), cacheDir, now: () => NOW, clock: () => t, sleep: async (ms) => { t += ms; } });
}

const QUOTE = (src) => result({ symbol: 'X', price: 1, currency: 'USD', time: '2026-11-16T00:00:00Z' }, { source: src, asOf: '2026-11-16' });

describe('fallback chain', () => {
  test('first provider answering gives status ok', async () => {
    const r = await routerWith([stub('a', () => QUOTE('a')), stub('b', () => QUOTE('b'))]).get('quote', 'X');
    assert.equal(r.meta.status, 'ok');
    assert.equal(r.meta.source, 'a');
    assert.deepEqual(r.attempts.map((x) => x.status), ['ok']);
  });

  test('an error then an answer gives fallback with both attempts recorded', async () => {
    const r = await routerWith([stub('a', () => { throw new ProviderError('a: HTTP 500', { kind: 'http', status: 500 }); }), stub('b', () => QUOTE('b'))]).get('quote', 'X');
    assert.equal(r.meta.status, 'fallback');
    assert.equal(r.meta.source, 'b');
    assert.deepEqual(r.attempts.map((x) => [x.provider, x.status]), [['a', 'error'], ['b', 'ok']]);
    assert.equal(r.attempts[0].httpStatus, 500);
  });

  test('empty then an answer is also a fallback', async () => {
    const r = await routerWith([stub('a', () => result(null, { source: 'a' })), stub('b', () => QUOTE('b'))]).get('quote', 'X');
    assert.equal(r.meta.status, 'fallback');
  });

  test('a provider without its key is skipped, and does not make the next one a fallback', async () => {
    const keyed = stub('k', () => QUOTE('k'), { needsKey: true, keyEnv: 'K_KEY' });
    const r = await routerWith([keyed, stub('b', () => QUOTE('b'))]).get('quote', 'X');
    assert.equal(r.meta.status, 'ok');
    assert.equal(r.attempts[0].status, 'skipped');
    assert.equal(keyed.calls, 0);
  });

  test('every provider empty is missing; every provider failing is error', async () => {
    const m = await routerWith([stub('a', () => result([], { source: 'a' }))]).get('quote', 'X');
    assert.equal(m.meta.status, 'missing');
    assert.equal(m.data, null);
    const e = await routerWith([stub('a', () => { throw new ProviderError('down'); })]).get('quote', 'X');
    assert.equal(e.meta.status, 'error');
    assert.match(e.meta.note, /a: error \(down\)/);
  });

  test('an adapter bug is contained and labelled', async () => {
    const r = await routerWith([stub('a', () => { throw new TypeError('x is undefined'); }), stub('b', () => QUOTE('b'))]).get('quote', 'X');
    assert.equal(r.attempts[0].kind, 'adapter_bug');
    assert.equal(r.meta.source, 'b');
  });

  test('unknown ids in a chain are reported; providers without the capability are passed over', async () => {
    const noQuote = { ...stub('n', () => QUOTE('n')), capabilities: ['news'], getNews() {} };
    const r = await routerWith([noQuote, stub('b', () => QUOTE('b'))], { chain: ['ghost', 'n', 'b'] }).get('quote', 'X');
    assert.deepEqual(r.attempts.map((x) => x.status), ['unknown', 'ok']);
    assert.equal(r.meta.status, 'ok');
  });

  test('no chain configured is missing with a clear note', async () => {
    const r = await routerWith([], { chain: [] }).get('quote', 'X');
    assert.equal(r.meta.status, 'missing');
    assert.match(r.meta.note, /no provider configured/);
  });

  test('identical requests in one run are fetched once', async () => {
    const a = stub('a', () => QUOTE('a'));
    const router = routerWith([a]);
    await Promise.all([router.get('quote', 'X'), router.get('quote', 'X')]);
    assert.equal(a.calls, 1);
  });

  test('macro series route only to providers that map the canonical id', async () => {
    const { router } = await makeRouter();
    const r = await router.get('macroSeries', 'unemployment');
    assert.equal(r.meta.source, 'bls');
    assert.deepEqual(r.attempts.map((x) => x.provider), ['fred', 'bls']);
  });

  test('a falling-over primary source moves to the next (yahoo down, fmp answers)', async () => {
    const { router } = await makeRouter({
      env: { FMP_API_KEY: 'fmp-secret' },
      routes: [{ match: /yahoo/, status: 503, body: 'down' }, { match: /stable\/quote/, file: 'synthetic/fmp-quote.json' }],
    });
    const r = await router.get('quote', 'TEST');
    assert.equal(r.meta.status, 'fallback');
    assert.equal(r.meta.source, 'fmp');
    assert.ok(!JSON.stringify(r).includes('fmp-secret'));
  });
});

describe('http: retries, backoff, timeouts', () => {
  const quick = (fetchImpl, extra = {}) => {
    const slept = [];
    return { http: createHttp({ provider: 'p', fetchImpl, retries: 2, backoffMs: 100, sleep: async (ms) => slept.push(ms), random: () => 0.5, ...extra }), slept };
  };

  test('retries 429 then succeeds, honouring Retry-After', async () => {
    const f = fakeFetch([{ match: /x/, status: 429, body: 'slow down', headers: { 'retry-after': '2' }, times: 1 }, { match: /x/, body: { ok: 1 } }]);
    const { http, slept } = quick(f);
    assert.deepEqual(await http.getJson('https://x.test/x'), { ok: 1 });
    assert.equal(f.calls.length, 2);
    assert.equal(slept[0], 2000);
  });

  test('exponential backoff on 5xx, then a typed error', async () => {
    const f = fakeFetch([{ match: /x/, status: 502, body: 'bad' }]);
    const { http, slept } = quick(f);
    await assert.rejects(http.getJson('https://x.test/x'), (e) => e instanceof ProviderError && e.status === 502 && e.kind === 'http');
    assert.equal(f.calls.length, 3);
    assert.deepEqual(slept, [100, 200]);
  });

  test('401/403 are auth errors and are not retried', async () => {
    const f = fakeFetch([{ match: /x/, status: 403, body: 'no' }]);
    const { http } = quick(f);
    await assert.rejects(http.getJson('https://x.test/x'), (e) => e.kind === 'auth');
    assert.equal(f.calls.length, 1);
  });

  test('404 can mean "no data"', async () => {
    const f = fakeFetch([{ match: /x/, status: 404, body: 'nf' }]);
    assert.equal(await quick(f).http.getJson('https://x.test/x', { allow404: true }), null);
  });

  test('times out a hung request and retries it', async () => {
    let n = 0;
    const hung = (url, init) => {
      n += 1;
      return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    };
    const { http } = quick(hung, { timeoutMs: 20, retries: 1 });
    await assert.rejects(http.getText('https://x.test/slow'), (e) => e.kind === 'timeout' && /timed out after 20 ms/.test(e.message));
    assert.equal(n, 2);
  });

  test('bad JSON is a parse error', async () => {
    const f = fakeFetch([{ match: /x/, body: '<html>' }]);
    await assert.rejects(quick(f).http.getJson('https://x.test/x'), (e) => e.kind === 'parse');
  });

  test('logs carry redacted URLs only', async () => {
    const lines = [];
    const f = fakeFetch([{ match: /x/, body: {} }]);
    const http = createHttp({ provider: 'p', fetchImpl: f, log: (e) => lines.push(JSON.stringify(e)) });
    await http.getJson('https://x.test/x?apikey=SUPERSECRET&symbol=MSFT');
    assert.ok(lines.length === 1 && !lines[0].includes('SUPERSECRET'));
    assert.match(lines[0], /apikey=REDACTED/);
  });
});

describe('rate limiter', () => {
  test('lets a burst through, then spaces requests at the configured rate', async () => {
    let t = 0;
    const waits = [];
    const lim = createLimiter({ rps: 2, burst: 2, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } });
    for (let i = 0; i < 4; i++) await lim.take();
    assert.deepEqual(waits, [500, 500]);
  });

  test('the router applies each provider\'s limit (SEC at 8 per second)', async () => {
    const { router, wall } = await makeRouter();
    await router.get('insiderTrades', 'MSFT', { maxFilings: 20 }, { chain: ['sec-edgar'] });
    // ticker map + submissions + 20 Form 4s = 22 requests; 8 burst, the rest at 125 ms.
    assert.ok(wall.t >= 13 * 125, `virtual time ${wall.t}`);
  });
});

describe('file cache', () => {
  test('serves fresh entries, ignores expired ones, never caches TTL 0', async () => {
    const dir = tmp();
    let t = 0;
    const c = createCache({ dir, now: () => t });
    c.set('k', { v: 1 });
    assert.deepEqual(c.get('k', 10).value, { v: 1 });
    t = 11_000;
    assert.equal(c.get('k', 10), null);
    assert.deepEqual(c.getStale('k', 60).value, { v: 1 });
    assert.equal(c.get('k', 0), null);
  });

  test('router caches successes and reuses them across routers', async () => {
    const dir = tmp();
    const a = stub('a', () => QUOTE('a'));
    const config = { cache: { ttlSeconds: { quote: 60 } } };
    await routerWith([a], { cacheDir: dir, config }).get('quote', 'X');
    const r = await routerWith([a], { cacheDir: dir, config }).get('quote', 'X');
    assert.equal(a.calls, 1);
    assert.equal(r.attempts[0].status, 'cache');
  });

  test('when every live provider fails, a stale cached answer is served and labelled', async () => {
    const dir = tmp();
    const config = { cache: { ttlSeconds: { quote: 0 }, staleMaxSeconds: { quote: 86400 } } };
    await routerWith([stub('a', () => QUOTE('a'))], { cacheDir: dir, config }).get('quote', 'X');
    const r = await routerWith([stub('a', () => { throw new ProviderError('down'); })], { cacheDir: dir, config }).get('quote', 'X');
    assert.equal(r.meta.status, 'stale');
    assert.match(r.meta.note, /served from cache/);
    assert.equal(r.attempts.at(-1).status, 'stale-cache');
  });

  test('non-cacheable providers (FRED) are never written to the cache', async () => {
    const dir = tmp();
    const a = stub('a', () => QUOTE('a'), { cacheable: false });
    await routerWith([a], { cacheDir: dir, config: { cache: { ttlSeconds: { quote: 60 } } } }).get('quote', 'X');
    assert.deepEqual(fs.readdirSync(dir), []);
  });
});

describe('keys and redaction', () => {
  test('redacts secret query params and registered values', () => {
    assert.equal(redactUrl('https://a.test/x?api_key=abc123&id=1'), 'https://a.test/x?api_key=REDACTED&id=1');
    assert.equal(redactUrl('https://a.test/x?token=t0k3n'), 'https://a.test/x?token=REDACTED');
    registerSecret('s3cr3t-value');
    assert.equal(redactText('error near s3cr3t-value here'), 'error near REDACTED here');
    assert.equal(redactText('Authorization: Bearer abc.def'), 'Authorization: Bearer REDACTED');
    clearSecrets();
  });

  test('env reader: process env wins over .env.local; quotes stripped', () => {
    const dir = tmp();
    const f = path.join(dir, '.env.local');
    fs.writeFileSync(f, '# comment\nFMP_API_KEY="from-file"\nexport FINNHUB_API_KEY=fh\n');
    const env = createEnv({ files: [f], env: { FMP_API_KEY: 'from-env' } });
    assert.equal(env.get('FMP_API_KEY'), 'from-env');
    assert.equal(env.get('FINNHUB_API_KEY'), 'fh');
    assert.equal(env.get('NOPE'), '');
    assert.deepEqual(parseEnvFile("A='x y'\nbad line\nB=2"), { A: 'x y', B: '2' });
  });

  test('writeUserConfigValue sets one value, keeps the rest, and keeps the file private', () => {
    const dir = tmp();
    const f = path.join(dir, 'mosaic.config.json');
    fs.writeFileSync(f, JSON.stringify({ chains: { quote: ['fmp'] } }));
    writeUserConfigValue(f, ['providers', 'sec-edgar', 'contact'], 'A a@b.co');
    writeUserConfigValue(f, ['providers', 'sec-edgar', 'contact'], 'C c@d.co');
    const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.deepEqual(cfg, { chains: { quote: ['fmp'] }, providers: { 'sec-edgar': { contact: 'C c@d.co' } } });
    if (process.platform !== 'win32') assert.equal(fs.statSync(f).mode & 0o777, 0o600);
    const merged = loadConfig({ userConfigPath: f });
    assert.equal(merged.providers['sec-edgar'].contact, 'C c@d.co');
    assert.equal(merged.providers['sec-edgar'].rps, 8);
  });

  test('a key never appears in router output, even inside an error message', async () => {
    const leaky = stub('leaky', (s) => { throw new ProviderError(`leaky: HTTP 500 (https://v.test/q?symbol=${s}&apikey=KEY-123)`); }, { needsKey: true, keyEnv: 'LEAKY_KEY' });
    const r = await routerWith([leaky], { env: { LEAKY_KEY: 'KEY-123' } }).get('quote', 'X');
    assert.ok(!JSON.stringify(r).includes('KEY-123'));
  });
});

describe('config, registry and paths', () => {
  test('user config deep-merges; arrays replace', () => {
    const dir = tmp();
    const f = path.join(dir, 'mosaic.config.json');
    fs.writeFileSync(f, JSON.stringify({ chains: { quote: ['fmp', 'yahoo'] }, http: { timeoutMs: 1000 } }));
    const c = loadConfig({ userConfigPath: f });
    assert.deepEqual(c.chains.quote, ['fmp', 'yahoo']);
    assert.equal(c.http.timeoutMs, 1000);
    assert.equal(c.http.retries, 2);
    assert.ok(!('$comment' in c));
  });

  test('custom adapters load from the config folder; broken ones are reported', async () => {
    const dir = tmp();
    const good = path.join(dir, 'good.mjs');
    fs.writeFileSync(good, `export default { id: 'good', name: 'Good', needsKey: false, keyEnv: null, capabilities: ['quote'], async getQuote() { return { data: null, meta: { source: 'good' } }; } };`);
    fs.writeFileSync(path.join(dir, 'bad.mjs'), `export default { id: 'bad', name: 'Bad', needsKey: true, capabilities: ['quote', 'teleport'] };`);
    const config = loadConfig({ overrides: {} });
    config.custom = [{ id: 'good', module: './good.mjs', baseDir: dir }, { id: 'bad', module: './bad.mjs', baseDir: dir }, { id: 'yahoo', module: './good.mjs', baseDir: dir }, { id: 'gone', module: './missing.mjs', baseDir: dir }];
    const { adapters, problems } = await loadAdapters(config);
    assert.ok(adapters.has('good'));
    assert.ok(!adapters.has('bad'));
    assert.equal(problems.length, 3);
    assert.ok(problems.some((p) => /keyEnv is required/.test(p) && /unknown capability "teleport"/.test(p)));
    assert.ok(problems.some((p) => /does not match/.test(p)));
    assert.ok(problems.some((p) => /could not load/.test(p)));
  });

  test('the shipped custom adapter template is a valid adapter', async () => {
    const { default: tpl } = await import('../../data/providers/_template.mjs');
    assert.deepEqual(validateAdapter(tpl), []);
  });

  test('home: --home, then MOSAIC_HOME, then a clone, then plugin data, then ~/.mosaic', () => {
    // Platform-neutral: every expectation goes through path.resolve / path.join.
    const r = (p) => path.resolve(p);
    assert.equal(resolveHome({ home: r('/h'), env: {} }), r('/h'));
    assert.equal(resolveHome({ env: { MOSAIC_HOME: r('/m') } }), r('/m'));
    const clone = r('/code/mosaic');
    assert.equal(resolveHome({ env: {}, pluginRoot: clone }), clone);
    const cached = path.join(r('/u'), '.claude', 'plugins', 'cache', 'mosaic', 'mosaic', '0.1.0');
    const data = path.join(r('/u'), '.claude', 'plugins', 'data', 'mosaic-mosaic');
    assert.ok(isPluginCache(cached));
    assert.ok(!isPluginCache(clone));
    assert.equal(resolveHome({ env: {}, pluginRoot: cached, pluginData: data }), data);
    assert.equal(resolveHome({ env: {}, pluginRoot: cached, pluginData: '${CLAUDE_PLUGIN_DATA}' }), path.join(os.homedir(), '.mosaic'));
  });
});
