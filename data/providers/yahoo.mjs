// Yahoo Finance v8 chart endpoint: quote and daily price history. Unofficial and
// best effort: no key, no published limits, may rate-limit or change without notice.
// Every result is labelled with source "yahoo" so the pack shows where prices came from.
import { ProviderError, result, isoDate } from '../lib/contract.mjs';

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const HEADERS = { 'user-agent': 'Mozilla/5.0 (compatible; Mosaic/0.1; +https://github.com/abhinavuppal931/mosaic)', accept: 'application/json' };

async function chart(symbol, params, ctx) {
  const qs = new URLSearchParams(params).toString();
  const body = await ctx.http.getJson(`${BASE}${encodeURIComponent(symbol)}?${qs}`, { headers: HEADERS, allow404: true });
  if (!body) return null;
  if (body.chart?.error) {
    if (/not found|no data/i.test(body.chart.error.description || body.chart.error.code || '')) return null;
    throw new ProviderError(`yahoo: ${body.chart.error.code || 'error'}`, { kind: 'http', provider: 'yahoo' });
  }
  const r = body.chart?.result?.[0];
  if (!r?.meta) throw new ProviderError('yahoo: unexpected chart payload', { kind: 'parse', provider: 'yahoo' });
  return r;
}

/** Convert a chart result into daily points (oldest first), dropping empty bars. */
export function chartPoints(r) {
  const ts = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const adj = r.indicators?.adjclose?.[0]?.adjclose || [];
  const offset = (r.meta?.gmtoffset || 0) * 1000;
  const pts = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (c === null || c === undefined) continue;
    pts.push({
      t: isoDate(ts[i] * 1000 + offset),
      o: q.open?.[i] ?? null,
      h: q.high?.[i] ?? null,
      l: q.low?.[i] ?? null,
      c,
      v: q.volume?.[i] ?? null,
      adjC: adj[i] ?? c,
    });
  }
  // One bar per day: the last one wins (Yahoo sometimes repeats today's bar).
  const byDay = new Map(pts.map((p) => [p.t, p]));
  return [...byDay.values()];
}

export default {
  id: 'yahoo',
  name: 'Yahoo Finance chart (best effort)',
  needsKey: false,
  keyEnv: null,
  capabilities: ['quote', 'priceHistory'],
  cacheable: true,

  async getQuote(symbol, _opts, ctx) {
    const r = await chart(symbol, { range: '5d', interval: '1d' }, ctx);
    if (!r || typeof r.meta.regularMarketPrice !== 'number') return result(null, { source: 'yahoo' });
    const m = r.meta;
    const prev = m.chartPreviousClose ?? m.previousClose ?? null;
    const time = new Date(m.regularMarketTime * 1000).toISOString();
    return result(
      {
        symbol: m.symbol,
        price: m.regularMarketPrice,
        currency: m.currency,
        previousClose: prev,
        change: prev ? m.regularMarketPrice - prev : null,
        changePct: prev ? m.regularMarketPrice / prev - 1 : null,
        exchange: m.fullExchangeName || m.exchangeName || null,
        time,
        fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? null,
      },
      { source: 'yahoo', asOf: time.slice(0, 10), note: 'unofficial endpoint, best effort' },
    );
  },

  async getPriceHistory(symbol, { years = 10 } = {}, ctx) {
    const r = await chart(symbol, { range: `${years}y`, interval: '1d', events: 'div,split' }, ctx);
    if (!r) return result(null, { source: 'yahoo' });
    const points = chartPoints(r);
    if (!points.length) return result(null, { source: 'yahoo' });
    return result(
      { symbol: r.meta.symbol, currency: r.meta.currency, interval: '1d', points },
      { source: 'yahoo', asOf: points[points.length - 1].t, note: 'unofficial endpoint, best effort; adjC is split and dividend adjusted' },
    );
  },
};
