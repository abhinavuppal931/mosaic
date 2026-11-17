// Financial Modeling Prep, "stable" API. Needs FMP_API_KEY (free tier: about 250 calls a day,
// US only). Mosaic never requests price targets: verdicts carry no price targets.
import { result } from '../lib/contract.mjs';

const BASE = 'https://financialmodelingprep.com/stable';

async function get(path, params, ctx) {
  const qs = new URLSearchParams({ ...params, apikey: ctx.key });
  const body = await ctx.http.getJson(`${BASE}/${path}?${qs}`, { allow404: true });
  if (body && !Array.isArray(body) && body['Error Message']) return null;
  return body;
}

const neg = (v) => (typeof v === 'number' ? Math.abs(v) : null);
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Merge FMP's three statements (newest first) into Mosaic periods. */
export function fmpPeriods(income = [], balance = [], cash = []) {
  const byDate = (rows) => new Map(rows.map((r) => [r.date, r]));
  const b = byDate(balance);
  const c = byDate(cash);
  return income.map((i) => {
    const bs = b.get(i.date) || {};
    const cf = c.get(i.date) || {};
    const ocf = n(cf.operatingCashFlow);
    const capex = neg(cf.capitalExpenditure);
    return {
      periodEnd: i.date,
      fiscalYear: Number(i.fiscalYear || String(i.date).slice(0, 4)),
      form: '10-K',
      filed: i.filingDate || null,
      income: {
        revenue: n(i.revenue),
        costOfRevenue: n(i.costOfRevenue),
        grossProfit: n(i.grossProfit),
        researchAndDevelopment: n(i.researchAndDevelopmentExpenses),
        operatingIncome: n(i.operatingIncome),
        interestExpense: n(i.interestExpense),
        incomeTax: n(i.incomeTaxExpense),
        netIncome: n(i.netIncome),
        epsDiluted: n(i.epsDiluted ?? i.epsdiluted),
        dilutedShares: n(i.weightedAverageShsOutDil),
      },
      balance: {
        cash: n(bs.cashAndCashEquivalents),
        shortTermInvestments: n(bs.shortTermInvestments),
        receivables: n(bs.netReceivables),
        inventory: n(bs.inventory),
        currentAssets: n(bs.totalCurrentAssets),
        totalAssets: n(bs.totalAssets),
        goodwill: n(bs.goodwill),
        currentLiabilities: n(bs.totalCurrentLiabilities),
        totalLiabilities: n(bs.totalLiabilities),
        longTermDebt: n(bs.longTermDebt),
        shortTermDebt: n(bs.shortTermDebt),
        totalDebt: n(bs.totalDebt),
        equity: n(bs.totalStockholdersEquity),
        sharesOutstanding: null,
      },
      cashflow: {
        operatingCF: ocf,
        capex,
        da: n(cf.depreciationAndAmortization),
        sbc: n(cf.stockBasedCompensation),
        dividends: neg(cf.commonDividendsPaid ?? cf.dividendsPaid),
        buybacks: neg(cf.commonStockRepurchased),
        freeCashFlow: ocf !== null && capex !== null ? ocf - capex : null,
      },
      tags: {},
    };
  });
}

const TX = { P: 'buy', S: 'sell', A: 'grant', M: 'exercise', F: 'tax', G: 'gift' };

export default {
  id: 'fmp',
  name: 'Financial Modeling Prep',
  needsKey: true,
  keyEnv: 'FMP_API_KEY',
  capabilities: ['profile', 'quote', 'priceHistory', 'financials', 'ratios', 'insiderTrades', 'news', 'estimates'],
  cacheable: true,

  async getProfile(symbol, _o, ctx) {
    const p = (await get('profile', { symbol }, ctx))?.[0];
    if (!p) return result(null, { source: 'fmp' });
    return result(
      { symbol: p.symbol, name: p.companyName, cik: p.cik || null, sector: p.sector || null, industry: p.industry || null, exchange: p.exchange || null, currency: p.currency || null, url: p.website || null },
      { source: 'fmp', asOf: new Date(ctx.now()).toISOString().slice(0, 10) },
    );
  },

  async getQuote(symbol, _o, ctx) {
    const q = (await get('quote', { symbol }, ctx))?.[0];
    if (!q || typeof q.price !== 'number') return result(null, { source: 'fmp' });
    const time = new Date((q.timestamp || ctx.now() / 1000) * 1000).toISOString();
    return result(
      { symbol: q.symbol, price: q.price, currency: 'USD', previousClose: n(q.previousClose), change: n(q.change), changePct: typeof q.changePercentage === 'number' ? q.changePercentage / 100 : null, marketCap: n(q.marketCap), time, fiftyTwoWeekHigh: n(q.yearHigh), fiftyTwoWeekLow: n(q.yearLow) },
      { source: 'fmp', asOf: time.slice(0, 10) },
    );
  },

  async getPriceHistory(symbol, { years = 10 } = {}, ctx) {
    const from = new Date(ctx.now() - years * 365.25 * 86_400_000).toISOString().slice(0, 10);
    const rows = await get('historical-price-eod/full', { symbol, from }, ctx);
    const list = Array.isArray(rows) ? rows : rows?.historical || [];
    const points = list
      .filter((r) => typeof r.close === 'number')
      .map((r) => ({ t: r.date, o: n(r.open), h: n(r.high), l: n(r.low), c: r.close, v: n(r.volume), adjC: n(r.adjClose) ?? r.close }))
      .sort((a, b) => a.t.localeCompare(b.t));
    if (!points.length) return result(null, { source: 'fmp' });
    return result({ symbol, currency: 'USD', interval: '1d', points }, { source: 'fmp', asOf: points[points.length - 1].t });
  },

  async getFinancials(symbol, { limit = 10 } = {}, ctx) {
    const p = { symbol, period: 'annual', limit: String(limit) };
    const [inc, bal, cf] = [await get('income-statement', p, ctx), await get('balance-sheet-statement', p, ctx), await get('cash-flow-statement', p, ctx)];
    if (!Array.isArray(inc) || !inc.length) return result(null, { source: 'fmp' });
    const periods = fmpPeriods(inc, bal || [], cf || []);
    return result({ currency: inc[0].reportedCurrency || 'USD', periods, ttm: null, sharesOutstanding: null }, { source: 'fmp', asOf: periods[0].periodEnd });
  },

  async getRatios(symbol, _o, ctx) {
    const r = (await get('ratios-ttm', { symbol }, ctx))?.[0];
    if (!r) return result(null, { source: 'fmp' });
    return result(
      { peRatio: n(r.priceToEarningsRatioTTM), pbRatio: n(r.priceToBookRatioTTM), grossMargin: n(r.grossProfitMarginTTM), opMargin: n(r.operatingProfitMarginTTM), netMargin: n(r.netProfitMarginTTM), debtToEquity: n(r.debtToEquityRatioTTM), currentRatio: n(r.currentRatioTTM) },
      { source: 'fmp', asOf: new Date(ctx.now()).toISOString().slice(0, 10), note: 'vendor ratio definitions' },
    );
  },

  async getInsiderTrades(symbol, { limit = 100 } = {}, ctx) {
    const rows = await get('insider-trading/search', { symbol, page: '0', limit: String(limit) }, ctx);
    if (!Array.isArray(rows) || !rows.length) return result(null, { source: 'fmp' });
    const trades = rows.map((r) => {
      const code = String(r.transactionType || '').slice(0, 1);
      return { name: r.reportingName, title: r.typeOfOwner || '', txDate: r.transactionDate, filed: r.filingDate, code, type: TX[code] || 'other', shares: n(r.securitiesTransacted), price: n(r.price) || null, value: n(r.securitiesTransacted) && n(r.price) ? Math.round(r.securitiesTransacted * r.price) : null, sharesAfter: n(r.securitiesOwned) };
    });
    return result(trades, { source: 'fmp', asOf: trades[0].filed || trades[0].txDate });
  },

  async getNews(symbol, { limit = 10 } = {}, ctx) {
    const rows = await get('news/stock', { symbols: symbol, limit: String(limit) }, ctx);
    if (!Array.isArray(rows) || !rows.length) return result(null, { source: 'fmp' });
    const items = rows.map((r) => ({ time: r.publishedDate, title: r.title, source: r.publisher || r.site || 'fmp', url: r.url, summary: r.text ? String(r.text).slice(0, 280) : undefined }));
    return result(items, { source: 'fmp', asOf: String(items[0].time).slice(0, 10) });
  },

  async getEstimates(symbol, _o, ctx) {
    const rows = await get('analyst-estimates', { symbol, period: 'annual', limit: '10' }, ctx);
    if (!Array.isArray(rows) || !rows.length) return result(null, { source: 'fmp' });
    const today = new Date(ctx.now()).toISOString().slice(0, 10);
    const next = rows.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!next) return result(null, { source: 'fmp', note: 'no forward estimates' });
    return result(
      { fiscalPeriodEnd: next.date, epsNextFY: n(next.epsAvg), revNextFY: n(next.revenueAvg), analystsEps: n(next.numAnalystsEps), analystsRevenue: n(next.numAnalystsRevenue) },
      { source: 'fmp', asOf: today, note: 'consensus averages; price targets are deliberately not fetched' },
    );
  },
};
