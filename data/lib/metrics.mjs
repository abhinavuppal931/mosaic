// Pure math used by the packs. No I/O. Every function returns null when it cannot compute
// an honest answer (too little data, a zero or negative denominator where that makes the
// ratio meaningless), so a missing input shows up as a missing fact, never a made-up one.

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function mean(xs) {
  const v = xs.filter(isNum);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export function stdev(xs) {
  const v = xs.filter(isNum);
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

export function median(xs) {
  const v = xs.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
}

/** a / b, or null when either is missing or b is zero. */
export function ratio(a, b) {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  return a / b;
}

/** a / b only when b is positive (multiples on negative earnings are meaningless). */
export function posRatio(a, b) {
  if (!isNum(a) || !isNum(b) || b <= 0) return null;
  return a / b;
}

/** Compound annual growth from first to last over `years`. Null unless both are positive. */
export function cagr(first, last, years) {
  if (!isNum(first) || !isNum(last) || first <= 0 || last <= 0 || !(years > 0)) return null;
  return (last / first) ** (1 / years) - 1;
}

/** Share of values at or below x (0 to 1). */
export function percentileRank(values, x) {
  const v = values.filter(isNum);
  if (!v.length || !isNum(x)) return null;
  return v.filter((y) => y <= x).length / v.length;
}

/** Daily log returns from a list of prices. */
export function logReturns(prices) {
  const out = [];
  for (let i = 1; i < prices.length; i++) {
    if (isNum(prices[i]) && isNum(prices[i - 1]) && prices[i] > 0 && prices[i - 1] > 0) out.push(Math.log(prices[i] / prices[i - 1]));
  }
  return out;
}

/** Simple daily returns. */
export function simpleReturns(prices) {
  const out = [];
  for (let i = 1; i < prices.length; i++) {
    if (isNum(prices[i]) && isNum(prices[i - 1]) && prices[i - 1] > 0) out.push(prices[i] / prices[i - 1] - 1);
  }
  return out;
}

/** Annualized volatility of daily log returns (252 trading days). */
export function annualVol(prices) {
  const r = logReturns(prices);
  if (r.length < 20) return null;
  return stdev(r) * Math.sqrt(252);
}

/** Sample skewness. */
export function skewness(xs) {
  const v = xs.filter(isNum);
  const n = v.length;
  if (n < 3) return null;
  const m = mean(v);
  const s = stdev(v);
  if (!s) return null;
  return (n / ((n - 1) * (n - 2))) * v.reduce((acc, x) => acc + ((x - m) / s) ** 3, 0);
}

/** Sample excess kurtosis (0 for a normal distribution). */
export function excessKurtosis(xs) {
  const v = xs.filter(isNum);
  const n = v.length;
  if (n < 4) return null;
  const m = mean(v);
  const s = stdev(v);
  if (!s) return null;
  const k = v.reduce((acc, x) => acc + ((x - m) / s) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * k - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

/** Largest peak-to-trough fall, with dates when points carry {t}. */
export function maxDrawdown(points, key = 'c') {
  let peak = null;
  let peakT = null;
  let worst = 0;
  let from = null;
  let to = null;
  for (const p of points) {
    const v = p[key];
    if (!isNum(v)) continue;
    if (peak === null || v > peak) {
      peak = v;
      peakT = p.t;
    }
    const dd = v / peak - 1;
    if (dd < worst) {
      worst = dd;
      from = peakT;
      to = p.t;
    }
  }
  return peak === null ? null : { value: worst, from, to };
}

/** Simple moving average of the last n values. */
export function sma(values, n) {
  const v = values.filter(isNum);
  if (v.length < n) return null;
  return mean(v.slice(-n));
}

/** Total return from the close on or before `daysBack` calendar days ago to the last close. */
export function returnOver(points, daysBack, key = 'adjC') {
  if (!points.length) return null;
  const last = points[points.length - 1];
  const target = Date.parse(last.t) - daysBack * 86_400_000;
  let base = null;
  for (const p of points) {
    if (Date.parse(p.t) <= target) base = p;
    else break;
  }
  if (!base || Date.parse(base.t) < target - 10 * 86_400_000) return null;
  return ratio(last[key], base[key]) === null ? null : last[key] / base[key] - 1;
}

/** Value of N years of cash flows growing at g1, then a terminal value growing at gT, at discount r. */
export function dcfValue({ cash0, growth, discount, terminalGrowth, years }) {
  if (!isNum(cash0) || !isNum(growth) || !isNum(discount) || !isNum(terminalGrowth) || discount <= terminalGrowth || !(years > 0)) return null;
  let pv = 0;
  let c = cash0;
  for (let t = 1; t <= years; t++) {
    c *= 1 + growth;
    pv += c / (1 + discount) ** t;
  }
  const tv = (c * (1 + terminalGrowth)) / (discount - terminalGrowth);
  return pv + tv / (1 + discount) ** years;
}

/**
 * Reverse DCF: the constant growth in cash flow over `years` that makes the DCF value equal
 * `price` (enterprise value or market cap). Solved by bisection between -50% and +100%.
 * Null when cash0 is not positive or the price is outside the solvable range.
 */
export function impliedGrowth({ price, cash0, discount, terminalGrowth, years }) {
  if (!isNum(price) || price <= 0 || !isNum(cash0) || cash0 <= 0) return null;
  const f = (g) => dcfValue({ cash0, growth: g, discount, terminalGrowth, years }) - price;
  let lo = -0.5;
  let hi = 1.0;
  if (f(lo) > 0 || f(hi) < 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Year-over-year percent change of a monthly index series, from the latest month that has a
 * print exactly twelve months earlier (BLS skipped some months, e.g. October 2025). Looks back
 * at most `maxBack` months; the returned dates say which months were compared.
 */
export function yoyLast(obs, maxBack = 3) {
  if (!obs?.length) return null;
  const byMonth = new Map(obs.map((o) => [o.date.slice(0, 7), o]));
  for (let i = obs.length - 1; i >= Math.max(0, obs.length - 1 - maxBack); i--) {
    const cur = obs[i];
    const prev = byMonth.get(`${Number(cur.date.slice(0, 4)) - 1}${cur.date.slice(4, 7)}`);
    if (prev && prev.value) return { value: (cur.value / prev.value - 1) * 100, date: cur.date, priorDate: prev.date, skipped: obs.length - 1 - i };
  }
  return null;
}

/** Value of a series on or before a date. */
export function valueOnOrBefore(obs, date) {
  let hit = null;
  for (const o of obs) {
    if (o.date <= date) hit = o;
    else break;
  }
  return hit;
}

/** Pearson correlation of two equal-length arrays. */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 20) return null;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

export const round = (v, dp = 4) => (isNum(v) ? Math.round(v * 10 ** dp) / 10 ** dp : v);
