// Finnhub. Needs FINNHUB_API_KEY (free tier: 60 calls a minute; some endpoints are premium
// and answer 403, which the router records and moves past). The key goes in a header.
import { result } from '../lib/contract.mjs';

const BASE = 'https://finnhub.io/api/v1';

const get = (path, params, ctx) => ctx.http.getJson(`${BASE}${path}?${new URLSearchParams(params)}`, { headers: { 'x-finnhub-token': ctx.key }, allow404: true });
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const TX = { P: 'buy', S: 'sell', A: 'grant', M: 'exercise', F: 'tax', G: 'gift' };

export default {
  id: 'finnhub',
  name: 'Finnhub',
  needsKey: true,
  keyEnv: 'FINNHUB_API_KEY',
  capabilities: ['profile', 'quote', 'ratios', 'insiderTrades', 'news', 'estimates'],
  cacheable: true,

  async getProfile(symbol, _o, ctx) {
    const p = await get('/stock/profile2', { symbol }, ctx);
    if (!p?.name) return result(null, { source: 'finnhub' });
    return result({ symbol: p.ticker || symbol, name: p.name, industry: p.finnhubIndustry || null, exchange: p.exchange || null, currency: p.currency || null, url: p.weburl || null }, { source: 'finnhub', asOf: day(ctx.now()) });
  },

  async getQuote(symbol, _o, ctx) {
    const q = await get('/quote', { symbol }, ctx);
    if (!q || !q.t || typeof q.c !== 'number' || q.c === 0) return result(null, { source: 'finnhub' });
    const time = new Date(q.t * 1000).toISOString();
    return result({ symbol, price: q.c, currency: 'USD', previousClose: n(q.pc), change: n(q.d), changePct: typeof q.dp === 'number' ? q.dp / 100 : null, time }, { source: 'finnhub', asOf: time.slice(0, 10) });
  },

  async getRatios(symbol, _o, ctx) {
    const m = (await get('/stock/metric', { symbol, metric: 'all' }, ctx))?.metric;
    if (!m || !Object.keys(m).length) return result(null, { source: 'finnhub' });
    const pct = (v) => (typeof v === 'number' ? v / 100 : null);
    return result(
      { peRatio: n(m.peTTM), pbRatio: n(m.pbAnnual), grossMargin: pct(m.grossMarginTTM), opMargin: pct(m.operatingMarginTTM), netMargin: pct(m.netProfitMarginTTM), roe: pct(m.roeTTM), currentRatio: n(m.currentRatioAnnual), debtToEquity: n(m['totalDebt/totalEquityAnnual']), beta: n(m.beta) },
      { source: 'finnhub', asOf: day(ctx.now()), note: 'vendor ratio definitions' },
    );
  },

  async getInsiderTrades(symbol, { lookbackDays = 365 } = {}, ctx) {
    const from = day(ctx.now() - lookbackDays * 86_400_000);
    const rows = (await get('/stock/insider-transactions', { symbol, from }, ctx))?.data || [];
    if (!rows.length) return result(null, { source: 'finnhub' });
    const trades = rows.map((r) => ({ name: r.name, title: '', txDate: r.transactionDate, filed: r.filingDate, code: r.transactionCode, type: TX[r.transactionCode] || 'other', shares: n(Math.abs(r.change)), price: n(r.transactionPrice) || null, value: r.change && r.transactionPrice ? Math.round(Math.abs(r.change) * r.transactionPrice) : null, sharesAfter: n(r.share) }));
    return result(trades, { source: 'finnhub', asOf: trades[0].filed || trades[0].txDate });
  },

  async getNews(symbol, { limit = 10, lookbackDays = 14 } = {}, ctx) {
    const rows = await get('/company-news', { symbol, from: day(ctx.now() - lookbackDays * 86_400_000), to: day(ctx.now()) }, ctx);
    const items = (Array.isArray(rows) ? rows : []).slice(0, limit).map((r) => ({ time: new Date(r.datetime * 1000).toISOString(), title: r.headline, source: r.source || 'finnhub', url: r.url, summary: r.summary ? String(r.summary).slice(0, 280) : undefined }));
    if (!items.length) return result(null, { source: 'finnhub' });
    return result(items, { source: 'finnhub', asOf: items[0].time.slice(0, 10) });
  },

  async getEstimates(symbol, _o, ctx) {
    const body = await get('/calendar/earnings', { symbol, from: day(ctx.now()), to: day(ctx.now() + 120 * 86_400_000) }, ctx);
    const next = (body?.earningsCalendar || []).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    if (!next) return result(null, { source: 'finnhub' });
    return result(
      { nextEarningsDate: next.date, epsNextQ: n(next.epsEstimate), revNextQ: n(next.revenueEstimate), quarter: next.quarter ?? null, year: next.year ?? null },
      { source: 'finnhub', asOf: day(ctx.now()), note: 'earnings calendar consensus; price targets are deliberately not fetched' },
    );
  },
};
