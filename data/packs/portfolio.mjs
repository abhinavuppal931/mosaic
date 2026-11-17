// Portfolio pack: concentration, correlation and drawdown exposure of the user's holdings.
// Education framing only: the pack describes what could hurt the portfolio, never weights to hold.
import fs from 'node:fs';
import * as M from '../lib/metrics.mjs';

const { isNum } = M;

/**
 * Read holdings from JSON: [{ "ticker": "MSFT", "weight": 0.2 }] or { "holdings": [...] }.
 * Weights may be fractions or percents; they are normalized to sum to 1. Dollar amounts are
 * never needed and never stored.
 */
export function readHoldings(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return normalizeHoldings(Array.isArray(raw) ? raw : raw.holdings);
}

export function normalizeHoldings(list) {
  if (!Array.isArray(list) || !list.length) throw new Error('holdings must be a non-empty array of { ticker, weight }');
  const rows = list.map((h) => ({ ticker: String(h.ticker || h.symbol || '').toUpperCase().trim(), weight: Number(h.weight ?? h.pct ?? h.percent) }));
  const bad = rows.filter((r) => !r.ticker || !isNum(r.weight) || r.weight < 0);
  if (bad.length) throw new Error(`every holding needs a ticker and a non-negative weight (${bad.length} invalid)`);
  const total = rows.reduce((s, r) => s + r.weight, 0);
  if (!(total > 0)) throw new Error('weights sum to zero');
  const merged = new Map();
  for (const r of rows) merged.set(r.ticker, (merged.get(r.ticker) || 0) + r.weight / total);
  return [...merged.entries()].map(([ticker, weight]) => ({ ticker, weight })).sort((a, b) => b.weight - a.weight);
}

export async function fetchPortfolioData(router, holdings, config) {
  const years = Math.min(config.pack?.historyYears ?? 10, 5);
  const out = { holdings: [], macro: {} };
  for (const h of holdings) {
    out.holdings.push({
      ...h,
      profile: await router.get('profile', h.ticker),
      history: await router.get('priceHistory', h.ticker, { years }),
    });
  }
  return out;
}

export function portfolioFacts(fb, raw, { config }) {
  const warnings = [];
  const hs = raw.holdings;
  const weights = hs.map((h) => h.weight);
  const add = (o) => fb.add(o);
  const der = (o) => fb.derive(o);
  const userMeta = { source: 'user', status: 'ok', asOf: null };

  hs.forEach((h, i) => {
    h.weightId = add({ key: `weight_${h.ticker}`, label: `Weight of ${h.ticker} (as given by the user, normalized)`, value: h.weight, unit: 'ratio', meta: userMeta });
    h.nameId = add({ key: `name_${h.ticker}`, label: `${h.ticker} company name`, value: h.profile.data?.name ?? null, unit: 'text', meta: h.profile.meta });
    add({ key: `industry_${h.ticker}`, label: `${h.ticker} industry (SIC description)`, value: h.profile.data?.sicDescription || h.profile.data?.industry || null, unit: 'text', meta: h.profile.meta });
    const pts = h.history.data?.points || [];
    const ref = `series:price:${h.ticker}`;
    const dd = M.maxDrawdown(pts, 'adjC');
    der({ key: `max_drawdown_${h.ticker}`, label: `${h.ticker} maximum drawdown over the history`, value: pts.length > 250 ? dd?.value ?? null : null, unit: 'ratio', formula: 'min(adjusted close / running peak - 1)', inputs: [ref], note: dd?.from ? `peak ${dd.from}, trough ${dd.to}` : undefined });
    der({ key: `volatility_${h.ticker}`, label: `${h.ticker} volatility, last 12 months (annualized)`, value: M.annualVol(pts.slice(-252).map((p) => p.adjC)), unit: 'ratio', formula: 'stdev(daily log returns) x sqrt(252)', inputs: [ref] });
    if (!pts.length) warnings.push(`No price history for ${h.ticker}: its risk numbers are missing.`);
    if (i === 0) h.first = true;
  });

  const ref = hs.map((h) => h.weightId);
  der({ key: 'holdings_count', label: 'Number of holdings', value: hs.length, unit: 'count', formula: 'count(holdings)', inputs: ref });
  der({ key: 'largest_weight', label: `Largest position (${hs[0].ticker})`, value: weights[0], unit: 'ratio', formula: 'max(weight)', inputs: ref });
  der({ key: 'top5_weight', label: 'Top five positions, combined weight', value: weights.slice(0, 5).reduce((s, w) => s + w, 0), unit: 'ratio', formula: 'sum of the five largest weights', inputs: ref });
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  der({ key: 'hhi', label: 'Concentration index (Herfindahl, sum of squared weights)', value: hhi, unit: 'number', formula: 'sum(weight^2)', inputs: ref });
  der({ key: 'effective_holdings', label: 'Effective number of independent-sized positions', value: 1 / hhi, unit: 'count', formula: '1 / hhi', inputs: [fb.id('hhi')] });

  // Industry concentration.
  const byInd = new Map();
  for (const h of hs) {
    const ind = h.profile.data?.sicDescription || h.profile.data?.industry || 'Unknown';
    byInd.set(ind, (byInd.get(ind) || 0) + h.weight);
  }
  const topInd = [...byInd.entries()].sort((a, b) => b[1] - a[1])[0];
  der({ key: 'largest_industry_weight', label: `Largest industry exposure (${topInd[0]})`, value: topInd[1], unit: 'ratio', formula: 'max over industries of sum(weight)', inputs: ref });

  // Correlation and portfolio-level history from aligned daily returns.
  const aligned = alignReturns(hs.map((h) => h.history.data?.points || []), 3 * 252);
  const covered = hs.filter((_, i) => aligned.returns[i]);
  const coveredW = covered.reduce((s, h) => s + h.weight, 0);
  der({ key: 'risk_coverage', label: 'Share of the portfolio with enough price history for the risk math', value: coveredW, unit: 'ratio', formula: 'sum(weight of holdings with 3 years of aligned prices)', inputs: ref });
  if (coveredW < 1) warnings.push(`Only ${(coveredW * 100).toFixed(0)}% of the portfolio has enough price history; portfolio risk numbers cover that share only.`);

  const idx = hs.map((_, i) => i).filter((i) => aligned.returns[i]);
  const pairs = [];
  for (let a = 0; a < idx.length; a++) {
    for (let b = a + 1; b < idx.length; b++) {
      const c = M.correlation(aligned.returns[idx[a]], aligned.returns[idx[b]]);
      if (isNum(c)) pairs.push({ a: hs[idx[a]].ticker, b: hs[idx[b]].ticker, c, w: hs[idx[a]].weight * hs[idx[b]].weight });
    }
  }
  const wsum = pairs.reduce((s, p) => s + p.w, 0);
  der({ key: 'avg_pairwise_correlation', label: 'Weighted average correlation between holdings (daily returns, 3 years)', value: pairs.length && wsum ? pairs.reduce((s, p) => s + p.c * p.w, 0) / wsum : null, unit: 'number', formula: 'sum(w_i x w_j x corr_ij) / sum(w_i x w_j) over pairs', inputs: ['series:prices'] });
  const tight = pairs.filter((p) => p.c >= (config.thresholds?.portfolio?.highCorrelation ?? 0.7)).sort((x, y) => y.c - x.c);
  der({ key: 'highly_correlated_pairs', label: 'Pairs that move together (correlation 0.7 or more)', value: pairs.length ? (tight.length ? tight.slice(0, 5).map((p) => `${p.a}/${p.b} ${p.c.toFixed(2)}`).join('; ') : 'none') : null, unit: 'text', formula: 'pairs with corr >= 0.7, top five', inputs: ['series:prices'] });

  if (idx.length) {
    const wNorm = idx.map((i) => hs[i].weight / coveredW);
    const port = aligned.returns[idx[0]].map((_, t) => idx.reduce((s, i, k) => s + wNorm[k] * aligned.returns[i][t], 0));
    const level = [1];
    for (const r of port) level.push(level[level.length - 1] * (1 + r));
    const pdd = M.maxDrawdown(level.map((c, i) => ({ c, t: aligned.dates[i - 1] || aligned.dates[0] })));
    der({ key: 'portfolio_max_drawdown_3y', label: 'Worst peak-to-trough fall of these weights over 3 years (rebalanced daily)', value: pdd?.value ?? null, unit: 'ratio', formula: 'max drawdown of sum(weight x daily return), covered holdings', inputs: ['series:prices'], note: pdd?.from ? `peak ${pdd.from}, trough ${pdd.to}` : undefined });
    der({ key: 'portfolio_volatility_3y', label: 'Volatility of these weights, last 3 years (annualized)', value: port.length > 200 ? M.stdev(port) * Math.sqrt(252) : null, unit: 'ratio', formula: 'stdev(sum(weight x daily return)) x sqrt(252)', inputs: ['series:prices'] });
  }
  der({ key: 'loss_if_largest_halves', label: `Portfolio loss if the largest position (${hs[0].ticker}) falls 50%`, value: weights[0] * 0.5, unit: 'ratio', formula: 'largest_weight x 0.5', inputs: [fb.id('largest_weight')] });
  der({ key: 'loss_if_largest_zero', label: `Portfolio loss if the largest position (${hs[0].ticker}) goes to zero`, value: weights[0], unit: 'ratio', formula: 'largest_weight x 1.0', inputs: [fb.id('largest_weight')] });
  return { warnings, correlations: pairs.map((p) => ({ a: p.a, b: p.b, c: M.round(p.c, 4) })) };
}

/** Align holdings on common dates (last n), returning simple daily returns per holding. */
function alignReturns(pointLists, n) {
  const maps = pointLists.map((pts) => new Map(pts.map((p) => [p.t, p.adjC])));
  const usable = pointLists.map((pts) => pts.length > 250);
  const base = pointLists.find((p, i) => usable[i]) || [];
  const dates = base.map((p) => p.t).filter((d) => maps.every((m, i) => !usable[i] || m.has(d))).slice(-(n + 1));
  const returns = maps.map((m, i) => (usable[i] && dates.length > 250 ? M.simpleReturns(dates.map((d) => m.get(d))) : null));
  return { dates: dates.slice(1), returns };
}
