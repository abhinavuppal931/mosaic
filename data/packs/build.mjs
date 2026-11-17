// Assemble a data pack: fetch, turn into facts, attach per-seat evidence, coverage and hash.
import fs from 'node:fs';
import { createFactBook, hashFacts } from '../lib/facts.mjs';
import { isNum, round } from '../lib/metrics.mjs';
import { isoDate } from '../lib/contract.mjs';
import { fetchTickerData, tickerFacts } from './ticker.mjs';
import { fetchMacroData, addMacroFacts, macroSeriesBlock } from './macro.mjs';
import { fetchPortfolioData, portfolioFacts } from './portfolio.mjs';

export const SCHEMA = 'mosaic.datapack/1';
export const DISCLAIMER = 'Simulated council for education. Not financial advice. Numbers as of the dates shown; verify against the filings.';
const SEAT_PACKS = JSON.parse(fs.readFileSync(new URL('./seat-packs.json', import.meta.url), 'utf8'));

const CORE = {
  ticker: ['profile', 'quote', 'priceHistory', 'financials', 'insiderTrades', 'macro', 'news', 'estimates'],
  macro: ['macro'],
  portfolio: ['priceHistory', 'macro'],
};
const WEIGHT = { ok: 1, fallback: 1, stale: 0.5, missing: 0, error: 0 };

/** Fetch and build. `kind` is ticker | macro | portfolio. */
export async function buildPack({ kind, router, config, series, symbol, holdings, now = () => Date.now(), seatPacks = SEAT_PACKS }) {
  let raw;
  if (kind === 'ticker') raw = await fetchTickerData(router, symbol, config);
  else if (kind === 'macro') raw = { macro: await fetchMacroData(router, config.pack?.macroForMacro || [], { years: 2 }) };
  else if (kind === 'portfolio') {
    raw = await fetchPortfolioData(router, holdings, config);
    raw.macro = await fetchMacroData(router, config.pack?.macroForTicker || [], { years: 2 });
  } else throw new Error(`unknown pack kind ${kind}`);
  return assemblePack({ kind, raw, config, series, symbol, holdings, now, seatPacks });
}

/** Pure: raw router results to a pack. */
export function assemblePack({ kind, raw, config, series, symbol, holdings, now = () => Date.now(), seatPacks = SEAT_PACKS }) {
  const fb = createFactBook();
  let warnings = [];
  let extra = {};
  if (kind === 'ticker') warnings = tickerFacts(fb, raw, { symbol, config, series });
  else if (kind === 'macro') addMacroFacts(fb, raw.macro, { series, ids: config.pack?.macroForMacro || [] });
  else {
    const r = portfolioFacts(fb, raw, { config });
    warnings = r.warnings;
    extra = { correlations: r.correlations };
    addMacroFacts(fb, raw.macro, { series, ids: config.pack?.macroForTicker || [] });
  }

  const { coverage, providers } = coverageOf(kind, raw);
  if (coverage.score < (config.pack?.coverageThreshold ?? 0.5)) warnings.unshift(`Data coverage is ${Math.round(coverage.score * 100)}%, below the ${Math.round((config.pack?.coverageThreshold ?? 0.5) * 100)}% threshold: expect an INSUFFICIENT EVIDENCE verdict.`);
  for (const p of providers) {
    if (p.status === 'stale') warnings.push(`${p.capability}: live providers failed; served cached data from ${p.source} (${p.note || 'stale'}).`);
    if (p.status === 'fallback') warnings.push(`${p.capability}: first-choice provider failed; ${p.source} answered.`);
  }
  for (const [id, r] of Object.entries(raw.macro || {})) {
    if (r && (r.meta.status === 'missing' || r.meta.status === 'error')) warnings.push(`Macro series ${id} missing (${r.meta.note || r.meta.status}).`);
  }

  const missingFacts = fb.facts.filter((f) => f.value === null).length;
  const pack = {
    schema: SCHEMA,
    kind,
    symbol: kind === 'ticker' ? String(symbol).toUpperCase() : null,
    holdings: kind === 'portfolio' ? holdings.map((h) => ({ ticker: h.ticker, weight: round(h.weight, 6) })) : undefined,
    asOf: isoDate(now()),
    generatedAt: new Date(now()).toISOString(),
    hash: hashFacts(fb.facts),
    coverage: { ...coverage, facts: fb.facts.length, missingFacts },
    providers,
    warnings: [...new Set(warnings)],
    facts: fb.facts,
    packs: seatEvidence(kind, fb.facts, seatPacks),
    series: seriesBlock(kind, raw),
    news: kind === 'ticker' ? (raw.news.data || []).map((n) => ({ time: n.time, title: n.title, source: n.source, url: n.url })) : undefined,
    ...extra,
    disclaimer: DISCLAIMER,
  };
  for (const k of Object.keys(pack)) if (pack[k] === undefined) delete pack[k];
  return pack;
}

function coverageOf(kind, raw) {
  const byCapability = {};
  const providers = [];
  const note = (cap, r) => {
    if (!r) return;
    byCapability[cap] = r.meta.status;
    providers.push({ capability: cap, source: r.meta.source, status: r.meta.status, asOf: r.meta.asOf, ...(r.meta.note ? { note: r.meta.note } : {}), attempts: r.attempts });
  };
  if (kind === 'ticker') {
    note('profile', raw.profile);
    note('quote', raw.quote);
    note('priceHistory', raw.history);
    note('financials', raw.financials);
    note('insiderTrades', raw.insiders);
    note('holdings', raw.holdings);
    note('news', raw.news);
    note('estimates', raw.estimates);
    if (raw.benchmark) note('benchmark', raw.benchmark);
  }
  if (kind === 'portfolio') {
    const worst = (rs) => rs.map((r) => r.meta.status).reduce((w, s) => (WEIGHT[s] < WEIGHT[w] ? s : w), 'ok');
    byCapability.profile = worst(raw.holdings.map((h) => h.profile));
    byCapability.priceHistory = worst(raw.holdings.map((h) => h.history));
    for (const h of raw.holdings) {
      note(`profile:${h.ticker}`, h.profile);
      note(`priceHistory:${h.ticker}`, h.history);
    }
  }
  const macro = Object.entries(raw.macro || {});
  for (const [id, r] of macro) note(`macro:${id}`, r);
  if (macro.length) {
    const share = macro.reduce((s, [, r]) => s + (WEIGHT[r.meta.status] ?? 0), 0) / macro.length;
    byCapability.macro = share >= 0.999 ? 'ok' : share > 0 ? 'partial' : 'missing';
  }
  for (const k of Object.keys(byCapability)) if (k.includes(':')) delete byCapability[k];
  const score = (() => {
    const core = CORE[kind];
    const vals = core.map((c) => {
      if (c === 'macro') return macro.length ? macro.reduce((s, [, r]) => s + (WEIGHT[r.meta.status] ?? 0), 0) / macro.length : 0;
      return WEIGHT[byCapability[c]] ?? 0;
    });
    return round(vals.reduce((s, x) => s + x, 0) / vals.length, 3);
  })();
  byCapability.ratios = kind === 'ticker' ? 'computed' : undefined;
  if (!byCapability.ratios) delete byCapability.ratios;
  return { coverage: { byCapability, core: CORE[kind], score }, providers };
}

/** Match a key against patterns (exact, or prefix when the pattern ends in *). */
export function matchKeys(patterns, keys) {
  const out = [];
  for (const p of patterns) {
    if (p.endsWith('*')) out.push(...keys.filter((k) => k.startsWith(p.slice(0, -1))));
    else if (keys.includes(p)) out.push(p);
  }
  return [...new Set(out)];
}

function seatEvidence(kind, facts, cfg) {
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const keys = facts.map((f) => f.key);
  const out = {};
  for (const [seat, def] of Object.entries(cfg.seats)) {
    const spec = def[kind] || { metrics: cfg.defaults[kind] || [] };
    const wanted = spec.metrics;
    const matched = matchKeys(wanted, keys);
    const explicit = wanted.filter((m) => !m.endsWith('*'));
    const absent = explicit.filter((m) => !byKey.has(m));
    const present = matched.filter((k) => byKey.get(k).value !== null);
    const denom = matched.length + absent.length;
    const share = denom ? present.length / denom : 0;
    const checks = (spec.checks || []).map((c) => evalCheck(c, byKey.get(c.metric)));
    out[seat] = {
      facts: matched.map((k) => byKey.get(k).id),
      missing: [...matched.filter((k) => byKey.get(k).value === null).map((k) => byKey.get(k).id), ...absent.map((k) => `(${k} not in this pack)`)],
      coverage: round(share, 3),
      evidenceCap: share >= cfg.evidenceGrade.strong ? 'strong' : share >= cfg.evidenceGrade.adequate ? 'adequate' : 'thin',
      checks,
    };
  }
  return out;
}

export function evalCheck(c, fact) {
  const base = { label: c.label, metric: c.metric, op: c.op, threshold: c.value, heuristic: true };
  if (!fact || fact.value === null || !isNum(fact.value)) return { ...base, fact: fact?.id || null, value: null, result: 'missing' };
  const v = fact.value;
  const ok = c.op === '>' ? v > c.value : c.op === '>=' ? v >= c.value : c.op === '<' ? v < c.value : c.op === '<=' ? v <= c.value : null;
  return { ...base, fact: fact.id, value: v, result: ok === null ? 'missing' : ok ? 'pass' : 'fail' };
}

function seriesBlock(kind, raw) {
  const out = {};
  if (kind === 'ticker') {
    const pts = raw.history.data?.points || [];
    // Weekly closes keep the pack small; the full daily history stays in the cache.
    const weekly = [];
    let lastWeek = null;
    for (const p of pts) {
      const wk = weekKey(p.t);
      if (wk !== lastWeek) weekly.push([p.t, p.c, p.adjC]);
      else weekly[weekly.length - 1] = [p.t, p.c, p.adjC];
      lastWeek = wk;
    }
    out.price = { source: raw.history.meta.source, asOf: raw.history.meta.asOf, status: raw.history.meta.status, columns: ['date', 'close', 'adjClose'], points: weekly };
    const periods = raw.financials.data?.periods || [];
    out.annual = {
      source: raw.financials.meta.source,
      status: raw.financials.meta.status,
      url: raw.financials.data?.url,
      periods: periods.map((p) => ({ periodEnd: p.periodEnd, fiscalYear: p.fiscalYear, form: p.form, filed: p.filed, accession: p.accession, income: p.income, balance: p.balance, cashflow: p.cashflow })),
      ttm: raw.financials.data?.ttm || null,
    };
  }
  if (kind === 'portfolio') {
    out.prices = {};
    for (const h of raw.holdings) out.prices[h.ticker] = { source: h.history.meta.source, status: h.history.meta.status, points: (h.history.data?.points || []).filter((_, i, a) => i % 5 === 0 || i === a.length - 1).map((p) => [p.t, p.adjC]) };
  }
  out.macro = macroSeriesBlock(raw.macro || {});
  return out;
}

function weekKey(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
