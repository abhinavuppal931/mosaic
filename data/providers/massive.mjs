// Massive (formerly Polygon.io). Needs MASSIVE_API_KEY (POLYGON_API_KEY also works).
// Free tier: 5 calls a minute, end-of-day data. The key goes in the Authorization header,
// never in the URL.
import { result } from '../lib/contract.mjs';

const BASE = 'https://api.massive.com';

const get = (path, params, ctx) => ctx.http.getJson(`${BASE}${path}?${new URLSearchParams(params)}`, { headers: { authorization: `Bearer ${ctx.key}` }, allow404: true });
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

export default {
  id: 'massive',
  name: 'Massive (Polygon)',
  needsKey: true,
  keyEnv: 'MASSIVE_API_KEY',
  keyEnvAliases: ['POLYGON_API_KEY'],
  capabilities: ['quote', 'priceHistory', 'news'],
  cacheable: true,

  async getQuote(symbol, _o, ctx) {
    const body = await get(`/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`, { adjusted: 'true' }, ctx);
    const r = body?.results?.[0];
    if (!r || typeof r.c !== 'number') return result(null, { source: 'massive' });
    const time = new Date(r.t).toISOString();
    return result(
      { symbol: body.ticker || symbol, price: r.c, currency: 'USD', previousClose: null, change: null, changePct: null, time },
      { source: 'massive', asOf: day(r.t), note: 'previous session close (end of day)' },
    );
  },

  async getPriceHistory(symbol, { years = 2 } = {}, ctx) {
    const to = day(ctx.now());
    const from = day(ctx.now() - years * 365.25 * 86_400_000);
    const body = await get(`/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}`, { adjusted: 'true', sort: 'asc', limit: '50000' }, ctx);
    const points = (body?.results || []).map((r) => ({ t: day(r.t), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, adjC: r.c }));
    if (!points.length) return result(null, { source: 'massive' });
    return result({ symbol, currency: 'USD', interval: '1d', points }, { source: 'massive', asOf: points[points.length - 1].t, note: 'split adjusted' });
  },

  async getNews(symbol, { limit = 10 } = {}, ctx) {
    const body = await get('/v2/reference/news', { ticker: symbol, limit: String(limit), order: 'desc' }, ctx);
    const items = (body?.results || []).map((r) => ({ time: r.published_utc, title: r.title, source: r.publisher?.name || 'massive', url: r.article_url, summary: r.description ? String(r.description).slice(0, 280) : undefined }));
    if (!items.length) return result(null, { source: 'massive' });
    return result(items, { source: 'massive', asOf: String(items[0].time).slice(0, 10) });
  },
};
