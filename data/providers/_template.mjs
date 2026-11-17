// Template for a custom data provider. Copy this file, rename it, fill in the methods you
// support, list them in `capabilities`, and register it in your mosaic.config.json:
//
//   "custom": [{ "id": "myvendor", "module": "./providers/myvendor.mjs" }],
//   "chains": { "quote": ["myvendor", "yahoo"] }
//
// The module path is resolved from the folder that holds the mosaic.config.json naming it.
// Then run the contract test:   node data/cli.mjs check-provider myvendor --symbol AAPL
//
// Rules:
// - Return { data, meta } via result(). Empty data (null, []) means "no data for this request".
// - Throw on infrastructure failure (the http helper already throws ProviderError for you).
// - Never read process.env or call fetch yourself: use ctx.key and ctx.http so keys stay
//   redacted and rate limits, timeouts and retries apply.
// - Never put the key in a log line or in returned data.
//
// ctx = { http: {getJson, getText, postJson}, key, config, now(), remember(key, ttlSeconds, fn) }
// Import path below assumes the file lives in data/providers/; adjust it if you keep
// your adapter elsewhere.
import { result } from '../lib/contract.mjs';

const BASE = 'https://api.example.com/v1';

export default {
  id: 'myvendor',
  name: 'My vendor',
  needsKey: true,
  keyEnv: 'MYVENDOR_API_KEY',
  capabilities: ['quote'],
  cacheable: true,

  async getQuote(symbol, _opts, ctx) {
    const q = await ctx.http.getJson(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}`, {
      headers: { authorization: `Bearer ${ctx.key}` },
      allow404: true,
    });
    if (!q || typeof q.price !== 'number') return result(null, { source: 'myvendor' });
    const time = new Date(q.timestamp * 1000).toISOString();
    return result({ symbol, price: q.price, currency: q.currency || 'USD', time }, { source: 'myvendor', asOf: time.slice(0, 10) });
  },

  // Other methods you may add, each with a matching entry in `capabilities`:
  // async getProfile(symbol, opts, ctx)          -> { symbol, name, ... }
  // async getPriceHistory(symbol, {years}, ctx)  -> { symbol, currency, interval, points: [{t, o, h, l, c, v, adjC}] }
  // async getFinancials(symbol, {limit}, ctx)    -> { currency, periods: [{periodEnd, income, balance, cashflow}], ttm }
  // async getRatios(symbol, opts, ctx)           -> { peRatio, pbRatio, ... }
  // async getInsiderTrades(symbol, opts, ctx)    -> [{ name, title, txDate, type, shares, price, value }]
  // async getHoldings(symbol, opts, ctx)         -> { holdings: [{ name, value, shares }] }
  // async getMacroSeries(seriesId, opts, ctx)    -> { id, title, units, obs: [{date, value}] }
  // async getNews(symbol, {limit}, ctx)          -> [{ time, title, source, url }]
  // async getEstimates(symbol, opts, ctx)        -> { epsNextFY, revNextFY, ... }
};
