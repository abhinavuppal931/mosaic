// Pack building from recorded fixtures: facts, formulas, coverage, seat evidence, missing data.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { makeRouter, NOW } from './helpers/setup.mjs';
import { blockNetwork } from './helpers/fake-fetch.mjs';
import { buildPack, assemblePack, matchKeys, evalCheck, SCHEMA } from '../../data/packs/build.mjs';
import { renderPackMarkdown, formatValue } from '../../data/packs/render.mjs';
import { normalizeHoldings } from '../../data/packs/portfolio.mjs';
import { nextReport } from '../../data/packs/ticker.mjs';
import { createFactBook, hashFacts } from '../../data/lib/facts.mjs';
import { clearSecrets } from '../../data/lib/redact.mjs';

before(() => {
  blockNetwork();
  clearSecrets();
});

const fact = (pack, key) => pack.facts.find((f) => f.key === key);

async function msftPack(opts = {}) {
  const { router, config, series } = await makeRouter(opts);
  return buildPack({ kind: 'ticker', router, config, series, symbol: 'MSFT', now: () => NOW });
}

describe('ticker pack (zero-key stack, MSFT fixtures)', () => {
  let pack;
  before(async () => {
    pack = await msftPack();
  });

  test('has the schema, as-of date, hash and disclaimer', () => {
    assert.equal(pack.schema, SCHEMA);
    assert.equal(pack.kind, 'ticker');
    assert.equal(pack.symbol, 'MSFT');
    assert.equal(pack.asOf, '2026-11-17');
    assert.match(pack.hash, /^sha256:[0-9a-f]{64}$/);
    assert.match(pack.disclaimer, /Not financial advice/);
  });

  test('every fact carries id, key, source, asOf and status; ids are sequential and unique', () => {
    pack.facts.forEach((f, i) => {
      assert.equal(f.id, `F${String(i + 1).padStart(3, '0')}`);
      for (const k of ['key', 'label', 'status']) assert.ok(f[k] !== undefined, `${f.id} lacks ${k}`);
      assert.ok('source' in f && 'asOf' in f, `${f.id} lacks source/asOf`);
      assert.ok(['ok', 'stale', 'fallback', 'missing', 'error'].includes(f.status));
      if (f.value === null) assert.ok(['missing', 'error'].includes(f.status), `${f.id} null but ${f.status}`);
      if (f.derived) assert.ok(f.formula && Array.isArray(f.inputs), `${f.id} derived without formula`);
    });
    assert.equal(new Set(pack.facts.map((f) => f.key)).size, pack.facts.length);
  });

  test('reported numbers come straight from EDGAR (TTM) with their period', () => {
    const rev = fact(pack, 'revenue');
    assert.equal(rev.source, 'sec-edgar');
    assert.equal(rev.period, 'TTM to 2026-09-30');
    assert.equal(fact(pack, 'net_income').value, 133749000000 + 36629000000 - 27747000000);
    assert.equal(fact(pack, 'price').source, 'yahoo');
  });

  test('derived facts match their formulas', () => {
    const v = (k) => fact(pack, k).value;
    const near = (a, b) => assert.ok(Math.abs(a - b) <= Math.abs(b) * 1e-6, `${a} vs ${b}`);
    near(v('market_cap'), v('price') * v('shares_outstanding'));
    near(v('pe'), v('price') / v('eps_diluted'));
    near(v('free_cash_flow'), v('operating_cash_flow') - v('capex'));
    near(v('enterprise_value'), v('market_cap') + v('total_debt') - v('cash') - v('short_term_investments'));
    near(v('fcf_yield'), v('free_cash_flow') / v('market_cap'));
    assert.deepEqual(fact(pack, 'pe').inputs, [fact(pack, 'price').id, fact(pack, 'eps_diluted').id]);
  });

  test('price history facts exist and are sane', () => {
    assert.ok(fact(pack, 'max_drawdown').value < 0);
    assert.ok(fact(pack, 'volatility_1y').value > 0);
    assert.ok(fact(pack, 'price_percentile_history').value >= 0 && fact(pack, 'price_percentile_history').value <= 1);
    assert.equal(typeof fact(pack, 'relative_strength_1y').value, 'number');
  });

  test('reverse DCF answers "what the price implies"', () => {
    const g = fact(pack, 'implied_fcf_growth');
    assert.equal(typeof g.value, 'number');
    assert.ok(g.value > fact(pack, 'implied_fcf_growth_low_discount').value);
    assert.ok(fact(pack, 'implied_fcf_growth_high_discount').value > g.value);
    assert.ok(fact(pack, 'dcf_value_bear').value < fact(pack, 'dcf_value_base').value);
    assert.match(fact(pack, 'dcf_value_base').note, /not a price target/);
  });

  test('missing data is visible: news, estimates, short interest, credit spreads', () => {
    for (const k of ['eps_estimate_next_fy', 'short_interest', 'macro_hy_oas', 'institutional_holders']) {
      const f = fact(pack, k);
      assert.equal(f.value, null, k);
      assert.equal(f.status, 'missing', k);
      assert.ok(f.note, `${k} should say why`);
    }
    assert.equal(fact(pack, 'forward_pe').status, 'missing');
    assert.equal(pack.coverage.byCapability.news, 'missing');
    assert.ok(pack.warnings.some((w) => /No news/.test(w)));
    assert.ok(pack.warnings.some((w) => /hy_oas/.test(w)));
  });

  test('coverage score weights the core capabilities', () => {
    // profile, quote, history, financials, insiders ok; macro 4 of 5; news and estimates missing.
    assert.equal(pack.coverage.score, Math.round(((5 + 0.8) / 8) * 1000) / 1000);
    assert.equal(pack.coverage.byCapability.ratios, 'computed');
    assert.equal(pack.coverage.byCapability.macro, 'partial');
  });

  test('macro context and the next report estimate', () => {
    assert.equal(fact(pack, 'macro_ust_10y').source, 'treasury');
    assert.equal(fact(pack, 'macro_policy_rate').source, 'nyfed');
    const curve = fact(pack, 'macro_curve_10y_2y');
    assert.ok(Math.abs(curve.value - (fact(pack, 'macro_ust_10y').value - fact(pack, 'macro_ust_2y').value)) < 1e-9);
    assert.match(fact(pack, 'next_report_expected').value, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(fact(pack, 'next_report_expected').derived, true);
  });

  test('per-seat evidence packs: facts, checks and an evidence cap', () => {
    const b = pack.packs.buffett;
    assert.ok(b.facts.length > 10);
    assert.ok(['strong', 'adequate', 'thin'].includes(b.evidenceCap));
    assert.ok(b.checks.every((c) => ['pass', 'fail', 'missing'].includes(c.result) && c.heuristic));
    assert.ok(pack.packs.burry.missing.includes(fact(pack, 'short_interest').id));
    assert.equal(Object.keys(pack.packs).length, 13);
  });

  test('the same inputs give the same hash', async () => {
    const again = await msftPack();
    assert.equal(again.hash, pack.hash);
  });

  test('provider trail is recorded per capability', () => {
    const fin = pack.providers.find((p) => p.capability === 'financials');
    assert.equal(fin.source, 'sec-edgar');
    assert.equal(fin.attempts[0].status, 'ok');
    const est = pack.providers.find((p) => p.capability === 'estimates');
    assert.ok(est.attempts.every((a) => a.status === 'skipped'));
  });

  test('renders a human view with MISSING shown, never filled', () => {
    const md = renderPackMarkdown(pack);
    assert.match(md, /# Data pack: MSFT/);
    assert.match(md, /## Data health/);
    assert.match(md, /MISSING/);
    assert.match(md, /## Seat evidence/);
    assert.ok(!/—/.test(md), 'no em dashes in user-facing copy');
  });
});

describe('degraded packs', () => {
  test('no SEC User-Agent: fundamentals missing, warning says so, nothing invented', async () => {
    const pack = await msftPack({ env: {} });
    assert.equal(pack.coverage.byCapability.financials, 'error');
    assert.equal(fact(pack, 'revenue').value, null);
    assert.equal(fact(pack, 'pe').value, null);
    assert.ok(pack.warnings.some((w) => /No annual financials/.test(w)));
    assert.ok(pack.coverage.score < 0.7);
  });

  test('everything down: coverage zero and a threshold warning', async () => {
    const { router, config, series } = await makeRouter({ routes: [{ match: /./, status: 503, body: 'down' }] });
    const pack = await buildPack({ kind: 'ticker', router, config, series, symbol: 'MSFT', now: () => NOW });
    assert.equal(pack.coverage.score, 0);
    assert.match(pack.warnings[0], /below the 50% threshold/);
    assert.ok(pack.facts.filter((f) => !f.derived && f.source !== null).every((f) => f.value === null || f.source === 'mosaic'));
  });

  test('a fallback is labelled on the facts it fed', async () => {
    const { router, config, series } = await makeRouter({
      env: { MOSAIC_SEC_USER_AGENT: 'Mosaic/0.1 t t@example.com', FMP_API_KEY: 'k' },
      routes: [{ match: /chart\/MSFT\?range=5d/, status: 500, body: 'x' }, { match: /stable\/quote/, file: 'synthetic/fmp-quote.json' }, ...(await import('./helpers/setup.mjs')).FREE_ROUTES, { match: /financialmodelingprep/, body: [] }],
    });
    const pack = await buildPack({ kind: 'ticker', router, config, series, symbol: 'MSFT', now: () => NOW });
    assert.equal(fact(pack, 'price').status, 'fallback');
    assert.equal(fact(pack, 'price').source, 'fmp');
    assert.equal(fact(pack, 'market_cap').status, 'fallback');
    assert.ok(pack.warnings.some((w) => /quote: first-choice provider failed; fmp answered/.test(w)));
    assert.ok(!JSON.stringify(pack).includes('"k"'));
  });
});

describe('macro pack', () => {
  test('rates, curve, policy, inflation and labor from the zero-key stack', async () => {
    const { router, config, series } = await makeRouter();
    const pack = await buildPack({ kind: 'macro', router, config, series, now: () => NOW });
    assert.equal(pack.kind, 'macro');
    assert.equal(fact(pack, 'macro_cpi_yoy').source, 'bls');
    assert.equal(fact(pack, 'macro_cpi_yoy').unit, 'percent');
    assert.equal(fact(pack, 'macro_unemployment').source, 'bls');
    assert.equal(typeof fact(pack, 'macro_real_policy_rate').value, 'number');
    assert.equal(fact(pack, 'macro_vix').value, null);
    assert.ok(pack.series.macro.ust_10y.points.length > 10);
    assert.ok(pack.packs.druckenmiller.facts.length >= 10);
  });

  test('BLS rate limited: those series are missing and labelled with the reason', async () => {
    const { FREE_ROUTES } = await import('./helpers/setup.mjs');
    const { router, config, series } = await makeRouter({ routes: [{ match: /api\.bls\.gov/, file: 'bls-v1-rate-limited.json' }, ...FREE_ROUTES] });
    const pack = await buildPack({ kind: 'macro', router, config, series, now: () => NOW });
    const cpi = fact(pack, 'macro_cpi_yoy');
    assert.equal(cpi.value, null);
    assert.equal(cpi.status, 'error');
    assert.match(cpi.note, /daily threshold/);
  });
});

describe('portfolio pack', () => {
  test('normalizes weights and refuses bad input', () => {
    assert.deepEqual(normalizeHoldings([{ ticker: 'msft', weight: 30 }, { ticker: 'SPY', weight: 70 }]).map((h) => [h.ticker, h.weight]), [['SPY', 0.7], ['MSFT', 0.3]]);
    assert.throws(() => normalizeHoldings([]), /non-empty/);
    assert.throws(() => normalizeHoldings([{ ticker: 'A', weight: -1 }]), /non-negative/);
  });

  test('concentration, correlation, drawdown and survivable-loss facts', async () => {
    const { router, config, series } = await makeRouter();
    const holdings = normalizeHoldings([{ ticker: 'MSFT', weight: 0.6 }, { ticker: 'SPY', weight: 0.4 }]);
    const pack = await buildPack({ kind: 'portfolio', router, config, series, holdings, now: () => NOW });
    assert.equal(fact(pack, 'largest_weight').value, 0.6);
    assert.ok(Math.abs(fact(pack, 'hhi').value - 0.52) < 1e-9);
    assert.equal(fact(pack, 'loss_if_largest_halves').value, 0.3);
    assert.ok(fact(pack, 'avg_pairwise_correlation').value > 0.3);
    assert.ok(fact(pack, 'portfolio_max_drawdown_3y').value < 0);
    assert.equal(fact(pack, 'name_SPY').value, null, 'SPY is not an SEC filer in the fixture: missing, not invented');
    assert.ok(pack.packs.taleb.facts.includes(fact(pack, 'loss_if_largest_zero').id));
    assert.ok(!('weight' in (pack.holdings[0].dollars || {})));
  });
});

describe('building blocks', () => {
  test('fact book: derived status inherits the worst input; null is missing', () => {
    const fb = createFactBook();
    const a = fb.add({ key: 'a', label: 'A', value: 2, unit: 'x', meta: { source: 's', asOf: '2026-01-01', status: 'fallback' } });
    const b = fb.add({ key: 'b', label: 'B', value: null, unit: 'x', meta: { source: 's', status: 'missing', note: 'gone' } });
    fb.derive({ key: 'c', label: 'C', value: 4, unit: 'x', formula: 'a*2', inputs: [a] });
    fb.derive({ key: 'd', label: 'D', value: null, unit: 'x', formula: 'b*2', inputs: [b] });
    assert.equal(fb.get('c').status, 'fallback');
    assert.equal(fb.get('c').asOf, '2026-01-01');
    assert.equal(fb.get('d').status, 'missing');
    assert.match(fb.get('d').note, /input missing: F002/);
    assert.throws(() => fb.add({ key: 'a', label: 'dup', value: 1 }), /duplicate/);
    assert.notEqual(hashFacts(fb.facts), hashFacts(fb.facts.slice(1)));
  });

  test('seat checks and key patterns', () => {
    assert.deepEqual(matchKeys(['macro_*', 'pe', 'nope'], ['macro_a', 'macro_b', 'pe', 'pb']), ['macro_a', 'macro_b', 'pe']);
    assert.equal(evalCheck({ metric: 'pe', op: '<', value: 20, label: 'x' }, { id: 'F1', value: 15 }).result, 'pass');
    assert.equal(evalCheck({ metric: 'pe', op: '<', value: 20, label: 'x' }, { id: 'F1', value: 25 }).result, 'fail');
    assert.equal(evalCheck({ metric: 'pe', op: '<', value: 20, label: 'x' }, { id: 'F1', value: null }).result, 'missing');
  });

  test('next report: calendar date wins, else the filing cadence', () => {
    assert.deepEqual(nextReport([], { data: { nextEarningsDate: '2027-01-27' } }), { date: '2027-01-27', source: 'calendar' });
    const filings = [{ filed: '2026-10-28' }, { filed: '2026-07-29' }, { filed: '2026-04-29' }, { filed: '2026-01-28' }];
    assert.equal(nextReport(filings, null).date, '2027-01-27');
    assert.equal(nextReport(filings.slice(0, 2), null).date, null);
  });

  test('value formatting for the human view', () => {
    assert.equal(formatValue({ value: 0.1234, unit: 'ratio' }), '12.3%');
    assert.equal(formatValue({ value: 3.85e12, unit: 'USD' }), '3.85T USD');
    assert.equal(formatValue({ value: null, unit: 'x', note: 'no key' }), 'MISSING (no key)');
    assert.equal(formatValue({ value: 0.29, unit: 'percentage points' }), '+0.29 pts');
  });

  test('assemblePack is pure given raw results', () => {
    const miss = { data: null, meta: { source: null, asOf: null, status: 'missing', note: 'none' }, attempts: [] };
    const raw = { profile: miss, quote: miss, history: miss, benchmark: null, financials: miss, insiders: miss, holdings: miss, news: miss, estimates: miss, macro: {} };
    const { loadConfig, loadSeries } = { loadConfig: null, loadSeries: null };
    void loadConfig;
    void loadSeries;
    return import('../../data/lib/config.mjs').then(({ loadConfig: lc, loadSeries: ls }) => {
      const config = lc();
      config.pack.macroForTicker = [];
      const pack = assemblePack({ kind: 'ticker', raw, config, series: ls(), symbol: 'X', now: () => NOW });
      assert.equal(pack.coverage.score, 0);
      assert.ok(pack.facts.every((f) => f.value === null || f.derived));
    });
  });
});
