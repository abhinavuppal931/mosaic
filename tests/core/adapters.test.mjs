// Every adapter against recorded fixtures. No network: a fake fetch serves files and throws
// on any URL it does not know.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { makeRouter, FREE_ROUTES, NOW, SEC_UA } from './helpers/setup.mjs';
import { fixture, blockNetwork } from './helpers/fake-fetch.mjs';
import { normalizeCompanyFacts, parseForm4, parse13F } from '../../data/providers/sec-edgar.mjs';
import { parseCurveCsv } from '../../data/providers/treasury.mjs';
import { parseBls } from '../../data/providers/bls.mjs';
import { chartPoints } from '../../data/providers/yahoo.mjs';
import { fmpPeriods } from '../../data/providers/fmp.mjs';
import { checkProvider } from '../../data/lib/contract-test.mjs';
import { SHAPES, ProviderError } from '../../data/lib/contract.mjs';
import { clearSecrets } from '../../data/lib/redact.mjs';

before(() => {
  blockNetwork();
  clearSecrets();
});

const only = (chain) => ({ chain: [chain] });

describe('sec-edgar', () => {
  test('normalizes companyfacts into ten fiscal years, newest first, with tags kept', () => {
    const d = normalizeCompanyFacts(JSON.parse(fixture('sec-companyfacts-msft.json')), { limit: 10 });
    assert.equal(d.periods.length, 10);
    const fy = d.periods[0];
    assert.equal(fy.periodEnd, '2026-06-30');
    assert.equal(fy.income.revenue, 331839000000);
    assert.equal(fy.income.netIncome, 133749000000);
    assert.equal(fy.income.epsDiluted, 17.95);
    assert.equal(fy.balance.equity, 442387000000);
    assert.equal(fy.cashflow.freeCashFlow, fy.cashflow.operatingCF - fy.cashflow.capex);
    assert.equal(fy.tags.revenue, 'RevenueFromContractWithCustomerExcludingAssessedTax');
    assert.ok(d.periods.every((p, i, a) => i === 0 || a[i - 1].periodEnd > p.periodEnd));
  });

  test('builds trailing twelve months from FY + YTD - prior YTD', () => {
    const d = normalizeCompanyFacts(JSON.parse(fixture('sec-companyfacts-msft.json')));
    assert.equal(d.ttm.periodEnd, '2026-09-30');
    // FY2026 133.749B + Q1 FY27 36.629B - Q1 FY26 27.747B
    assert.equal(d.ttm.income.netIncome, 133749000000 + 36629000000 - 27747000000);
    assert.match(d.ttm.basis, /FY ending 2026-06-30/);
    assert.equal(d.sharesOutstanding.value, 7426194552);
  });

  test('returns null for a payload without facts', () => {
    assert.equal(normalizeCompanyFacts({}), null);
  });

  test('parses Form 4 transactions with codes mapped to types', () => {
    const t = parseForm4(fixture('sec-form4-msft.xml'));
    assert.equal(t.length, 1);
    assert.deepEqual({ name: t[0].name, type: t[0].type, direction: t[0].direction, txDate: t[0].txDate }, { name: 'Coleman Amy', type: 'tax', direction: 'disposed', txDate: '2026-11-16' });
    assert.equal(t[0].value, Math.round(89.044 * 523.88));
  });

  test('parses and merges a 13F information table, largest first', () => {
    const h = parse13F(fixture('sec-13f-infotable-brk.xml'));
    assert.ok(h.length >= 1);
    assert.ok(h.every((x, i, a) => i === 0 || a[i - 1].value >= x.value));
    assert.equal(new Set(h.map((x) => `${x.cusip}|${x.titleOfClass}`)).size, h.length);
  });

  test('profile, financials and insider trades through the router', async () => {
    const { router } = await makeRouter();
    const p = await router.get('profile', 'MSFT', {}, only('sec-edgar'));
    assert.equal(p.meta.status, 'ok');
    assert.equal(p.data.cik, '0000789019');
    assert.equal(p.data.fiscalYearEnd, '0630');
    assert.ok(p.data.periodicFilings.length >= 3);
    const f = await router.get('financials', 'MSFT', { limit: 10 }, only('sec-edgar'));
    assert.equal(f.meta.source, 'sec-edgar');
    assert.equal(f.meta.asOf, '2026-09-30');
    const i = await router.get('insiderTrades', 'MSFT', { lookbackDays: 365, maxFilings: 3 }, only('sec-edgar'));
    assert.equal(i.meta.status, 'ok');
    assert.equal(i.data.length, 3);
    assert.match(i.meta.note, /capped at 3/);
  });

  test('13F holdings for a manager, and an honest empty answer for a ticker', async () => {
    const { router } = await makeRouter();
    const m = await router.get('holdings', 'BRK-B', { managerCik: '1067983' }, only('sec-edgar'));
    assert.equal(m.meta.status, 'ok');
    assert.ok(m.data.holdings.length > 0);
    const t = await router.get('holdings', 'MSFT', {}, only('sec-edgar'));
    assert.equal(t.data, null);
    assert.equal(t.meta.status, 'missing');
    assert.match(t.attempts[0].note, /per manager/);
  });

  test('unknown ticker is empty, not an error', async () => {
    const { router } = await makeRouter();
    const r = await router.get('financials', 'ZZZZ', {}, only('sec-edgar'));
    assert.equal(r.meta.status, 'missing');
    assert.equal(r.attempts[0].status, 'empty');
  });

  test('without a User-Agent EDGAR fails with a config error that names the fix', async () => {
    const { router } = await makeRouter({ env: {} });
    const r = await router.get('financials', 'MSFT', {}, only('sec-edgar'));
    assert.equal(r.meta.status, 'error');
    assert.equal(r.attempts[0].kind, 'config');
    assert.match(r.attempts[0].note, /cli\.mjs setup/);
  });

  test('sends the configured User-Agent', async () => {
    const { router, fetchImpl } = await makeRouter();
    await router.get('profile', 'MSFT', {}, only('sec-edgar'));
    assert.ok(fetchImpl.calls.every((c) => c.init.headers['user-agent'] === SEC_UA));
  });
});

describe('yahoo', () => {
  test('quote from the chart meta block', async () => {
    const { router } = await makeRouter();
    const q = await router.get('quote', 'MSFT', {}, only('yahoo'));
    assert.equal(q.meta.source, 'yahoo');
    assert.equal(q.data.currency, 'USD');
    assert.equal(typeof q.data.price, 'number');
    assert.deepEqual(SHAPES.quote(q.data), []);
    assert.match(q.meta.note, /best effort/);
  });

  test('daily history, oldest first, one bar per day', async () => {
    const { router } = await makeRouter();
    const h = await router.get('priceHistory', 'MSFT', { years: 5 }, only('yahoo'));
    const pts = h.data.points;
    assert.ok(pts.length > 1200);
    assert.ok(pts.every((p, i) => i === 0 || pts[i - 1].t < p.t));
    assert.ok(pts.every((p) => typeof p.c === 'number' && typeof p.adjC === 'number'));
  });

  test('chartPoints drops null bars', () => {
    const pts = chartPoints({ meta: { gmtoffset: 0 }, timestamp: [1700000000, 1700086400], indicators: { quote: [{ close: [null, 10], open: [1, 2] }], adjclose: [{ adjclose: [null, 9] }] } });
    assert.equal(pts.length, 1);
    assert.equal(pts[0].adjC, 9);
  });

  test('a chart "Not Found" error is empty data; other chart errors throw', async () => {
    const nf = await makeRouter({ routes: [{ match: /chart/, body: { chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } } } }] });
    const r = await nf.router.get('quote', 'NOPE', {}, only('yahoo'));
    assert.equal(r.attempts[0].status, 'empty');
    const bad = await makeRouter({ routes: [{ match: /chart/, body: { chart: { result: null, error: { code: 'Internal', description: 'boom' } } } }] });
    const e = await bad.router.get('quote', 'MSFT', {}, only('yahoo'));
    assert.equal(e.attempts[0].status, 'error');
  });
});

describe('treasury', () => {
  test('parses the yield curve CSV into dated rows', () => {
    const { columns, rows } = parseCurveCsv(fixture('treasury-2026.csv'));
    assert.ok(columns.includes('10 Yr'));
    assert.match(rows[0].date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(typeof rows[0].values['10 Yr'], 'number');
  });

  test('joins years into one ascending series for a column', async () => {
    const { router } = await makeRouter();
    const r = await router.get('macroSeries', 'ust_10y', { years: 2 }, only('treasury'));
    assert.equal(r.meta.source, 'treasury');
    assert.equal(r.data.id, '10 Yr');
    const obs = r.data.obs;
    assert.ok(obs.length > 400);
    assert.ok(obs.every((o, i) => i === 0 || obs[i - 1].date <= o.date));
    assert.equal(obs[obs.length - 1].date, '2026-11-16');
  });
});

describe('nyfed', () => {
  test('effective fed funds with the target range', async () => {
    const { router } = await makeRouter();
    const r = await router.get('macroSeries', 'policy_rate', { years: 2 }, only('nyfed'));
    assert.equal(r.meta.status, 'ok');
    assert.equal(r.data.obs[r.data.obs.length - 1].date, '2026-11-13');
    assert.deepEqual(r.data.targetRange, [3.75, 4]);
  });
});

describe('bls', () => {
  test('parses monthly observations and skips annual averages', () => {
    const obs = parseBls(JSON.parse(fixture('bls-v1-CUUR0000SA0.json')), 'CUUR0000SA0');
    assert.ok(obs.length >= 24);
    assert.ok(obs.every((o) => /^\d{4}-\d{2}-01$/.test(o.date)));
  });

  test('the real rate-limit response throws a rate_limit error', () => {
    assert.throws(() => parseBls(JSON.parse(fixture('bls-v1-rate-limited.json')), 'CUUR0000SA0'), (e) => e instanceof ProviderError && e.kind === 'rate_limit');
  });

  test('through the router: v1 without a key', async () => {
    const { router } = await makeRouter();
    const r = await router.get('macroSeries', 'unemployment', {}, only('bls'));
    assert.equal(r.meta.status, 'ok');
    assert.match(r.meta.note, /v1/);
  });

  test('with BLS_API_KEY it POSTs to v2 and keeps the key out of the URL', async () => {
    const { router, fetchImpl } = await makeRouter({ env: { BLS_API_KEY: 'bls-secret-123' }, routes: [{ match: /publicAPI\/v2/, file: 'bls-v1-LNS14000000.json' }] });
    const r = await router.get('macroSeries', 'unemployment', {}, only('bls'));
    assert.equal(r.meta.status, 'ok');
    assert.equal(fetchImpl.calls[0].init.method, 'POST');
    assert.ok(!fetchImpl.calls[0].url.includes('bls-secret-123'));
    assert.match(fetchImpl.calls[0].init.body, /registrationkey/);
  });
});

describe('fred', () => {
  test('skipped without a key', async () => {
    const { router } = await makeRouter();
    const r = await router.get('macroSeries', 'hy_oas', {}, only('fred'));
    assert.equal(r.meta.status, 'missing');
    assert.equal(r.attempts[0].status, 'skipped');
    assert.match(r.attempts[0].note, /FRED_API_KEY/);
  });

  test('with a key: drops "." values, never caches, and redacts the key from errors', async () => {
    const ok = await makeRouter({ env: { FRED_API_KEY: 'fred-secret-abc' }, routes: [{ match: /stlouisfed/, file: 'synthetic/fred-dgs10.json' }] });
    const r = await ok.router.get('macroSeries', 'ust_10y', {}, only('fred'));
    assert.equal(r.data.obs.length, 4);
    assert.equal(r.meta.asOf, '2026-11-16');
    const { default: fred } = await import('../../data/providers/fred.mjs');
    assert.equal(fred.cacheable, false);
    const bad = await makeRouter({ env: { FRED_API_KEY: 'fred-secret-abc' }, routes: [{ match: /stlouisfed/, status: 500, body: 'oops' }] });
    const e = await bad.router.get('macroSeries', 'ust_10y', {}, only('fred'));
    assert.equal(e.meta.status, 'error');
    assert.ok(!JSON.stringify(e).includes('fred-secret-abc'));
    assert.match(e.attempts[0].note, /api_key=REDACTED/);
  });
});

const FMP_ROUTES = [
  { match: /stable\/profile/, file: 'synthetic/fmp-profile.json' },
  { match: /stable\/quote/, file: 'synthetic/fmp-quote.json' },
  { match: /stable\/historical-price-eod/, file: 'synthetic/fmp-eod.json' },
  { match: /stable\/income-statement/, file: 'synthetic/fmp-income.json' },
  { match: /stable\/balance-sheet-statement/, file: 'synthetic/fmp-balance.json' },
  { match: /stable\/cash-flow-statement/, file: 'synthetic/fmp-cashflow.json' },
  { match: /stable\/ratios-ttm/, file: 'synthetic/fmp-ratios-ttm.json' },
  { match: /stable\/insider-trading/, file: 'synthetic/fmp-insider.json' },
  { match: /stable\/news\/stock/, file: 'synthetic/fmp-news.json' },
  { match: /stable\/analyst-estimates/, file: 'synthetic/fmp-estimates.json' },
];

describe('fmp', () => {
  test('passes the contract test on every capability', async () => {
    const { router, adapters } = await makeRouter({ env: { FMP_API_KEY: 'fmp-secret' }, routes: FMP_ROUTES });
    const rep = await checkProvider(adapters.get('fmp'), { router, symbol: 'TEST' });
    assert.deepEqual(rep.problems, []);
    assert.equal(rep.results.length, 8);
    for (const r of rep.results) assert.equal(r.result, 'pass', `${r.capability}: ${r.detail}`);
  });

  test('merges statements and turns negative cash outflows positive', () => {
    const p = fmpPeriods(JSON.parse(fixture('synthetic/fmp-income.json')), JSON.parse(fixture('synthetic/fmp-balance.json')), JSON.parse(fixture('synthetic/fmp-cashflow.json')));
    assert.equal(p[0].cashflow.capex, 70);
    assert.equal(p[0].cashflow.freeCashFlow, 250);
    assert.equal(p[0].cashflow.dividends, 50);
    assert.equal(p[0].balance.totalDebt, 300);
  });

  test('estimates pick the next fiscal year and never fetch price targets', async () => {
    const { router, fetchImpl } = await makeRouter({ env: { FMP_API_KEY: 'fmp-secret' }, routes: FMP_ROUTES });
    const e = await router.get('estimates', 'TEST', {}, only('fmp'));
    assert.equal(e.data.fiscalPeriodEnd, '2027-06-30');
    assert.equal(e.data.epsNextFY, 2.6);
    assert.ok(fetchImpl.calls.every((c) => !/price-target/i.test(c.url)));
  });

  test('insider transaction types map from the leading code', async () => {
    const { router } = await makeRouter({ env: { FMP_API_KEY: 'fmp-secret' }, routes: FMP_ROUTES });
    const r = await router.get('insiderTrades', 'TEST', {}, only('fmp'));
    assert.deepEqual(r.data.map((t) => t.type), ['sell', 'buy']);
  });
});

describe('massive', () => {
  const routes = [
    { match: /\/prev/, file: 'synthetic/massive-prev.json' },
    { match: /\/range\/1\/day\//, file: 'synthetic/massive-aggs.json' },
    { match: /reference\/news/, file: 'synthetic/massive-news.json' },
  ];
  test('passes the contract test; key travels in the Authorization header only', async () => {
    const { router, adapters, fetchImpl } = await makeRouter({ env: { MASSIVE_API_KEY: 'massive-secret' }, routes });
    const rep = await checkProvider(adapters.get('massive'), { router, symbol: 'TEST' });
    for (const r of rep.results) assert.equal(r.result, 'pass', `${r.capability}: ${r.detail}`);
    assert.ok(fetchImpl.calls.length >= 3);
    for (const c of fetchImpl.calls) {
      assert.ok(!c.url.includes('massive-secret'));
      assert.equal(c.init.headers.authorization, 'Bearer massive-secret');
    }
  });

  test('POLYGON_API_KEY works as an alias', async () => {
    const { router } = await makeRouter({ env: { POLYGON_API_KEY: 'poly-secret' }, routes });
    const q = await router.get('quote', 'TEST', {}, only('massive'));
    assert.equal(q.meta.status, 'ok');
  });
});

describe('finnhub', () => {
  const routes = [
    { match: /stock\/profile2/, file: 'synthetic/finnhub-profile2.json' },
    { match: /api\/v1\/quote/, file: 'synthetic/finnhub-quote.json' },
    { match: /stock\/metric/, file: 'synthetic/finnhub-metric.json' },
    { match: /insider-transactions/, file: 'synthetic/finnhub-insider.json' },
    { match: /company-news/, file: 'synthetic/finnhub-news.json' },
    { match: /calendar\/earnings/, file: 'synthetic/finnhub-earnings.json' },
  ];
  test('passes the contract test on every capability', async () => {
    const { router, adapters, fetchImpl } = await makeRouter({ env: { FINNHUB_API_KEY: 'fh-secret' }, routes });
    const rep = await checkProvider(adapters.get('finnhub'), { router, symbol: 'TEST' });
    assert.equal(rep.results.length, 6);
    for (const r of rep.results) assert.equal(r.result, 'pass', `${r.capability}: ${r.detail}`);
    assert.ok(fetchImpl.calls.every((c) => !c.url.includes('fh-secret') && c.init.headers['x-finnhub-token'] === 'fh-secret'));
  });

  test('ratios convert percent to fractions; estimates give the next earnings date', async () => {
    const { router } = await makeRouter({ env: { FINNHUB_API_KEY: 'fh-secret' }, routes });
    const r = await router.get('ratios', 'TEST', {}, only('finnhub'));
    assert.equal(r.data.grossMargin, 0.6);
    const e = await router.get('estimates', 'TEST', {}, only('finnhub'));
    assert.equal(e.data.nextEarningsDate, '2027-01-27');
  });

  test('a premium endpoint answering 403 is an auth error, not a crash', async () => {
    const { router } = await makeRouter({ env: { FINNHUB_API_KEY: 'fh-secret' }, routes: [{ match: /stock\/metric/, status: 403, body: { error: 'You don\'t have access to this resource.' } }] });
    const r = await router.get('ratios', 'TEST', {}, only('finnhub'));
    assert.equal(r.meta.status, 'error');
    assert.equal(r.attempts[0].kind, 'auth');
  });
});

test('fixtures were recorded on the date the tests pin', () => {
  assert.equal(new Date(NOW).toISOString().slice(0, 10), '2026-11-17');
  assert.ok(FREE_ROUTES.length > 10);
});
