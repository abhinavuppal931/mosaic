// The provider contract every adapter follows. See docs/research/hedge-fund-and-data.md.
//
// Every method takes its arguments plus a final `ctx` = { http, key, config, now, log }
// (see router.mjs), so adapters never read env vars or call fetch directly.
// A method returns { data, meta } where meta = { source, asOf, status, note? }.
// Empty data (null, [] or {}) means "this provider has no data for this request".
// An infrastructure failure (network, HTTP error, bad payload, missing config) throws a
// ProviderError; the router records it and moves on to the next provider.

export const CAPABILITIES = Object.freeze([
  'profile', 'quote', 'priceHistory', 'financials', 'ratios', 'insiderTrades',
  'holdings', 'macroSeries', 'news', 'estimates',
]);

/** Adapter method name for each capability. */
export const METHOD = Object.freeze({
  profile: 'getProfile',
  quote: 'getQuote',
  priceHistory: 'getPriceHistory',
  financials: 'getFinancials',
  ratios: 'getRatios',
  insiderTrades: 'getInsiderTrades',
  holdings: 'getHoldings',
  macroSeries: 'getMacroSeries',
  news: 'getNews',
  estimates: 'getEstimates',
});

export const STATUSES = Object.freeze(['ok', 'stale', 'fallback', 'missing', 'error']);

export class ProviderError extends Error {
  /**
   * @param {string} message
   * @param {{kind?: 'http'|'timeout'|'network'|'parse'|'auth'|'rate_limit'|'config'|'unsupported', status?: number, provider?: string, retryAfterMs?: number}} [info]
   */
  constructor(message, info = {}) {
    super(message);
    this.name = 'ProviderError';
    this.kind = info.kind || 'http';
    this.status = info.status;
    this.provider = info.provider;
    this.retryAfterMs = info.retryAfterMs;
  }
}

/** True when a provider answered but had nothing for this request. */
export function isEmpty(data) {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') {
    if (Array.isArray(data.periods)) return data.periods.length === 0;
    if (Array.isArray(data.obs)) return data.obs.length === 0;
    if (Array.isArray(data.points)) return data.points.length === 0;
    if (Array.isArray(data.holdings)) return data.holdings.length === 0;
    return Object.keys(data).length === 0;
  }
  return false;
}

/** Build a result in the contract shape. */
export function result(data, { source, asOf, status = 'ok', note } = {}) {
  const meta = { source, asOf: asOf || null, status };
  if (note) meta.note = note;
  return { data, meta };
}

/** Today's date (UTC) as YYYY-MM-DD. `now` is injectable for tests. */
export function isoDate(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Validate an adapter object's shape. Returns a list of problems (empty when valid).
 * Used by the registry when loading custom adapters and by `check-provider`.
 */
export function validateAdapter(a) {
  const problems = [];
  if (!a || typeof a !== 'object') return ['adapter must export a default object'];
  if (typeof a.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(a.id)) problems.push('id must be a lowercase slug');
  if (typeof a.name !== 'string' || !a.name) problems.push('name is required');
  if (typeof a.needsKey !== 'boolean') problems.push('needsKey must be true or false');
  if (a.needsKey && (typeof a.keyEnv !== 'string' || !a.keyEnv)) problems.push('keyEnv is required when needsKey is true');
  if (!Array.isArray(a.capabilities) || !a.capabilities.length) problems.push('capabilities must be a non-empty array');
  for (const c of a.capabilities || []) {
    if (!CAPABILITIES.includes(c)) problems.push(`unknown capability "${c}"`);
    else if (typeof a[METHOD[c]] !== 'function') problems.push(`capability "${c}" needs a ${METHOD[c]}() method`);
  }
  return problems;
}

/** Shape checks for each capability's data, used by the contract test. Returns problems. */
export const SHAPES = {
  profile: (d) => need(d, ['symbol', 'name']),
  quote: (d) => need(d, ['symbol', 'price', 'currency', 'time']).concat(num(d, 'price')),
  priceHistory: (d) => (Array.isArray(d?.points) && d.points.length && ['t', 'c'].every((k) => k in d.points[0]) ? [] : ['points[] with {t, c} expected']),
  financials: (d) => (Array.isArray(d?.periods) && d.periods.length && d.periods[0].periodEnd && d.periods[0].income ? [] : ['periods[] with {periodEnd, income, balance, cashflow} expected']),
  ratios: (d) => (d && typeof d === 'object' ? [] : ['ratio object expected']),
  insiderTrades: (d) => (Array.isArray(d) && d.every((t) => t.name && t.txDate && t.type) ? [] : ['array of {name, txDate, type} expected']),
  holdings: (d) => (Array.isArray(d?.holdings) && d.holdings.every((h) => h.name && 'value' in h) ? [] : ['{holdings: [{name, value}]} expected']),
  macroSeries: (d) => (d?.id && Array.isArray(d.obs) && d.obs.every((o) => o.date && typeof o.value === 'number') ? [] : ['{id, obs:[{date, value}]} expected']),
  news: (d) => (Array.isArray(d) && d.every((n) => n.title && n.time) ? [] : ['array of {time, title} expected']),
  estimates: (d) => (d && typeof d === 'object' ? [] : ['estimates object expected']),
};

function need(d, keys) {
  if (!d || typeof d !== 'object') return ['object expected'];
  return keys.filter((k) => d[k] === undefined || d[k] === null).map((k) => `missing ${k}`);
}
function num(d, k) {
  return d && typeof d[k] === 'number' && Number.isFinite(d[k]) ? [] : [`${k} must be a finite number`];
}
