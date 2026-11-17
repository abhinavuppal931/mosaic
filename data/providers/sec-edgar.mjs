// SEC EDGAR (data.sec.gov): company profile, XBRL fundamentals (companyfacts), insider
// trades (Form 4) and 13F-HR holdings for a manager. Free, no key. The SEC requires a
// descriptive User-Agent with contact details; `node data/cli.mjs setup` stores it in the
// git-ignored .env.local as MOSAIC_SEC_USER_AGENT.
import fs from 'node:fs';
import { ProviderError, result, isoDate } from '../lib/contract.mjs';

const TAGS = JSON.parse(fs.readFileSync(new URL('./sec-edgar.tags.json', import.meta.url), 'utf8'));
const SEC = 'https://www.sec.gov';
const DATA = 'https://data.sec.gov';
const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A', '10-KT']);
const DAY = 86_400_000;

const pad = (cik) => String(cik).replace(/\D/g, '').padStart(10, '0');
const days = (a, b) => (Date.parse(b) - Date.parse(a)) / DAY;

function headers(ctx) {
  const ua = ctx.config?.userAgent || '';
  if (!/\S+@\S+\.\S+/.test(ua)) {
    throw new ProviderError('sec-edgar: the SEC needs a User-Agent with your contact email. Run: node data/cli.mjs setup', { kind: 'config', provider: 'sec-edgar' });
  }
  return { 'user-agent': ua, accept: 'application/json, text/xml, */*' };
}

async function tickerMap(ctx) {
  return ctx.remember('sec-edgar:company_tickers', 86_400, async () => {
    const raw = await ctx.http.getJson(`${SEC}/files/company_tickers.json`, { headers: headers(ctx) });
    if (!raw || typeof raw !== 'object') throw new ProviderError('sec-edgar: ticker map was empty', { kind: 'parse', provider: 'sec-edgar' });
    const map = {};
    for (const row of Object.values(raw)) if (row?.ticker) map[String(row.ticker).toUpperCase()] = { cik: row.cik_str, title: row.title };
    return map;
  });
}

/** Ticker (or a CIK) to a zero-padded CIK, or null when EDGAR does not know it. */
export async function resolveCik(symbol, ctx) {
  if (/^\d{1,10}$/.test(String(symbol))) return pad(symbol);
  const map = await tickerMap(ctx);
  const hit = map[String(symbol).toUpperCase().replace('.', '-')] || map[String(symbol).toUpperCase()];
  return hit ? pad(hit.cik) : null;
}

async function submissions(cik, ctx) {
  return ctx.remember(`sec-edgar:submissions:${cik}`, 3600, () => ctx.http.getJson(`${DATA}/submissions/CIK${cik}.json`, { headers: headers(ctx), allow404: true }));
}

function recentFilings(sub) {
  const r = sub?.filings?.recent;
  if (!r?.form) return [];
  return r.form.map((form, i) => ({
    form,
    accession: r.accessionNumber[i],
    filed: r.filingDate[i],
    reportDate: r.reportDate[i],
    primaryDocument: r.primaryDocument[i],
  }));
}

// ------------------------------------------------------------------ XBRL normalization

function unitEntries(facts, tag, unit) {
  const f = facts?.['us-gaap']?.[tag] || facts?.['ifrs-full']?.[tag];
  if (!f?.units) return [];
  return f.units[unit] || [];
}

/** Latest-filed value per key among entries, so restatements win. */
function latestBy(entries, keyFn) {
  const out = new Map();
  for (const e of entries) {
    const k = keyFn(e);
    const prev = out.get(k);
    if (!prev || String(e.filed) > String(prev.filed)) out.set(k, e);
  }
  return out;
}

function annualFlowMap(facts, tag, unit) {
  const es = unitEntries(facts, tag, unit).filter((e) => ANNUAL_FORMS.has(e.form) && e.start && days(e.start, e.end) > 300 && days(e.start, e.end) < 400);
  return latestBy(es, (e) => e.end);
}

function instantMap(facts, tag, unit) {
  const es = unitEntries(facts, tag, unit).filter((e) => !e.start);
  return latestBy(es, (e) => e.end);
}

/** Resolve a field spec (ordered tags, maybe {sum}) for one period end. */
function pick(spec, kind, facts, unit, end, cache) {
  for (const t of spec) {
    if (typeof t === 'string') {
      const m = cacheMap(cache, kind, facts, t, unit);
      const e = m.get(end);
      if (e) return { value: e.val, tag: t, filed: e.filed, form: e.form, accession: e.accn };
    } else if (t?.sum) {
      const parts = t.sum.map((x) => cacheMap(cache, kind, facts, x, unit).get(end));
      if (parts.every(Boolean)) return { value: parts.reduce((s, e) => s + e.val, 0), tag: t.sum.join('+'), filed: parts[0].filed, form: parts[0].form, accession: parts[0].accn };
    }
  }
  return null;
}

function cacheMap(cache, kind, facts, tag, unit) {
  const k = `${kind}|${tag}|${unit}`;
  if (!cache.has(k)) cache.set(k, kind === 'flow' ? annualFlowMap(facts, tag, unit) : instantMap(facts, tag, unit));
  return cache.get(k);
}

function allFlowTags(spec) {
  return spec.flatMap((t) => (typeof t === 'string' ? [t] : t.sum));
}

/**
 * Normalize a companyfacts payload into annual periods (newest first) plus a TTM block.
 * Every value keeps the XBRL tag it came from, so a fact can be traced back to the filing.
 */
export function normalizeCompanyFacts(cf, { limit = 10, tags = TAGS } = {}) {
  const facts = cf?.facts;
  if (!facts) return null;
  const cache = new Map();
  // Fiscal year ends: annual durations of revenue or net income.
  const anchors = [...tags.income.revenue.tags, ...tags.income.netIncome.tags].filter((t) => typeof t === 'string');
  const ends = new Set();
  for (const t of anchors) for (const end of cacheMap(cache, 'flow', facts, t, 'USD').keys()) ends.add(end);
  const fyEnds = [...ends].sort().reverse().slice(0, limit);
  if (!fyEnds.length) return null;

  const periods = fyEnds.map((end) => {
    const p = { periodEnd: end, fiscalYear: Number(end.slice(0, 4)), form: null, filed: null, accession: null, income: {}, balance: {}, cashflow: {}, tags: {} };
    for (const section of ['income', 'balance', 'cashflow']) {
      for (const [field, def] of Object.entries(tags[section])) {
        const unit = def.unit || 'USD';
        const hit = pick(def.tags, def.kind, facts, unit, end, cache);
        p[section][field] = hit ? hit.value : null;
        if (hit) {
          p.tags[field] = hit.tag;
          if (!p.filed || hit.filed > p.filed) {
            p.filed = hit.filed;
            p.form = hit.form;
            p.accession = hit.accession;
          }
        }
      }
    }
    if (p.income.grossProfit === null && p.income.revenue !== null && p.income.costOfRevenue !== null) {
      p.income.grossProfit = p.income.revenue - p.income.costOfRevenue;
      p.tags.grossProfit = 'revenue-costOfRevenue';
    }
    const ltd = p.balance.longTermDebt;
    const std = p.balance.shortTermDebt;
    p.balance.totalDebt = ltd === null && std === null ? null : (ltd ?? 0) + (std ?? 0);
    const ocf = p.cashflow.operatingCF;
    const capex = p.cashflow.capex;
    p.cashflow.freeCashFlow = ocf !== null && capex !== null ? ocf - capex : null;
    return p;
  });

  return {
    currency: 'USD',
    periods,
    ttm: ttmBlock(facts, tags, fyEnds[0]),
    sharesOutstanding: latestDei(facts, tags.dei.sharesOutstanding),
  };
}

function ttmBlock(facts, tags, lastFyEnd) {
  const out = { periodEnd: null, basis: null, income: {}, cashflow: {}, balance: {}, filed: null };
  let any = false;
  for (const section of ['income', 'cashflow']) {
    for (const [field, def] of Object.entries(tags[section])) {
      const unit = def.unit || 'USD';
      out[section][field] = null;
      if (field === 'dilutedShares') continue;
      for (const tag of allFlowTags(def.tags)) {
        const all = unitEntries(facts, tag, unit).filter((e) => e.start);
        const fy = all.find((e) => e.end === lastFyEnd && days(e.start, e.end) > 300 && days(e.start, e.end) < 400);
        if (!fy) continue;
        const ytds = all.filter((e) => e.end > lastFyEnd && Math.abs(days(lastFyEnd, e.start) - 1) <= 4 && days(e.start, e.end) < 300);
        if (!ytds.length) break;
        const ytd = ytds.reduce((a, b) => (b.end > a.end || (b.end === a.end && b.filed > a.filed) ? b : a));
        const prior = all.find((e) => Math.abs(days(e.start, ytd.start) - 365) <= 7 && Math.abs(days(e.end, ytd.end) - 365) <= 7 && days(e.start, e.end) < 300);
        if (!prior) break;
        out[section][field] = fy.val + ytd.val - prior.val;
        out.periodEnd = ytd.end;
        out.filed = ytd.filed > (out.filed || '') ? ytd.filed : out.filed;
        out.basis = `FY ending ${lastFyEnd} + YTD to ${ytd.end} - prior YTD to ${prior.end}`;
        any = true;
        break;
      }
    }
  }
  if (!any) return null;
  // Latest balance sheet (instant) at or after the TTM end.
  const cache = new Map();
  for (const [field, def] of Object.entries(tags.balance)) {
    out.balance[field] = pick(def.tags, 'instant', facts, def.unit || 'USD', out.periodEnd, cache)?.value ?? null;
  }
  const ltd = out.balance.longTermDebt;
  const std = out.balance.shortTermDebt;
  out.balance.totalDebt = ltd === null && std === null ? null : (ltd ?? 0) + (std ?? 0);
  const { operatingCF, capex } = out.cashflow;
  out.cashflow.freeCashFlow = operatingCF !== null && capex !== null ? operatingCF - capex : null;
  return out;
}

function latestDei(facts, tag) {
  const es = facts?.dei?.[tag]?.units?.shares || [];
  if (!es.length) return null;
  const e = es.reduce((a, b) => (b.end > a.end || (b.end === a.end && b.filed > a.filed) ? b : a));
  return { value: e.val, asOf: e.end, filed: e.filed };
}

// ------------------------------------------------------------------ Form 4 and 13F

const xmlValue = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>\\s*(?:<value>)?\\s*([^<]*?)\\s*(?:</value>)?\\s*</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
};

const TX_TYPE = { P: 'buy', S: 'sell', A: 'grant', M: 'exercise', F: 'tax', G: 'gift' };

/** Parse one Form 4 XML document into transactions. */
export function parseForm4(xml) {
  const owner = xmlValue(xml, 'rptOwnerName') || 'Unknown';
  const title = xmlValue(xml, 'officerTitle') || (xmlValue(xml, 'isDirector') === '1' || xmlValue(xml, 'isDirector') === 'true' ? 'Director' : xmlValue(xml, 'isTenPercentOwner') === '1' ? '10% owner' : '');
  const blocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) || [];
  return blocks.map((b) => {
    const code = xmlValue(b, 'transactionCode');
    const shares = Number(xmlValue(b, 'transactionShares'));
    const price = Number(xmlValue(b, 'transactionPricePerShare'));
    const ad = xmlValue(b, 'transactionAcquiredDisposedCode');
    return {
      name: owner,
      title,
      txDate: xmlValue(b, 'transactionDate'),
      code,
      type: TX_TYPE[code] || 'other',
      direction: ad === 'A' ? 'acquired' : ad === 'D' ? 'disposed' : null,
      shares: Number.isFinite(shares) ? shares : null,
      price: Number.isFinite(price) && price > 0 ? price : null,
      value: Number.isFinite(shares) && Number.isFinite(price) && price > 0 ? Math.round(shares * price) : null,
      sharesAfter: Number(xmlValue(b, 'sharesOwnedFollowingTransaction')) || null,
    };
  });
}

/** Parse a 13F information table XML into holdings. */
export function parse13F(xml) {
  const rows = xml.match(/<(?:\w+:)?infoTable>[\s\S]*?<\/(?:\w+:)?infoTable>/g) || [];
  const strip = (s) => s.replace(/<(\/?)\w+:/g, '<$1');
  const merged = new Map();
  for (const raw of rows) {
    const r = strip(raw);
    const cusip = xmlValue(r, 'cusip');
    const cls = xmlValue(r, 'titleOfClass');
    const key = `${cusip}|${cls}`;
    const prev = merged.get(key) || { name: xmlValue(r, 'nameOfIssuer'), cusip, titleOfClass: cls, value: 0, shares: 0 };
    prev.value += Number(xmlValue(r, 'value')) || 0;
    prev.shares += Number(xmlValue(r, 'sshPrnamt')) || 0;
    merged.set(key, prev);
  }
  return [...merged.values()].sort((a, b) => b.value - a.value);
}

// ------------------------------------------------------------------ adapter

export default {
  id: 'sec-edgar',
  name: 'SEC EDGAR',
  needsKey: false,
  keyEnv: null,
  capabilities: ['profile', 'financials', 'insiderTrades', 'holdings'],
  cacheable: true,

  async getProfile(symbol, _opts, ctx) {
    const cik = await resolveCik(symbol, ctx);
    if (!cik) return result(null, { source: 'sec-edgar', note: `EDGAR has no company for ${symbol}` });
    const sub = await submissions(cik, ctx);
    if (!sub) return result(null, { source: 'sec-edgar' });
    const filings = recentFilings(sub).filter((f) => ['10-K', '10-Q', '20-F', '40-F'].includes(f.form)).slice(0, 12);
    return result(
      {
        symbol: String(symbol).toUpperCase(),
        name: sub.name,
        cik,
        sic: sub.sic || null,
        sicDescription: sub.sicDescription || null,
        exchange: sub.exchanges?.[0] || null,
        fiscalYearEnd: sub.fiscalYearEnd || null,
        periodicFilings: filings.map(({ form, filed, reportDate, accession }) => ({ form, filed, reportDate, accession })),
        url: `${SEC}/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`,
      },
      { source: 'sec-edgar', asOf: filings[0]?.filed || isoDate(ctx.now()) },
    );
  },

  async getFinancials(symbol, { limit = 10 } = {}, ctx) {
    const cik = await resolveCik(symbol, ctx);
    if (!cik) return result(null, { source: 'sec-edgar', note: `EDGAR has no company for ${symbol}` });
    const cf = await ctx.http.getJson(`${DATA}/api/xbrl/companyfacts/CIK${cik}.json`, { headers: headers(ctx), allow404: true });
    const data = cf ? normalizeCompanyFacts(cf, { limit }) : null;
    if (!data) return result(null, { source: 'sec-edgar', note: 'no XBRL annual financials' });
    data.url = `${DATA}/api/xbrl/companyfacts/CIK${cik}.json`;
    data.cik = cik;
    return result(data, { source: 'sec-edgar', asOf: data.ttm?.periodEnd || data.periods[0].periodEnd });
  },

  async getInsiderTrades(symbol, { lookbackDays = 365, maxFilings = 40 } = {}, ctx) {
    const cik = await resolveCik(symbol, ctx);
    if (!cik) return result(null, { source: 'sec-edgar' });
    const sub = await submissions(cik, ctx);
    const since = isoDate(ctx.now() - lookbackDays * DAY);
    const forms = recentFilings(sub).filter((f) => f.form === '4' && f.filed >= since).slice(0, maxFilings);
    const trades = [];
    for (const f of forms) {
      const doc = String(f.primaryDocument || '').split('/').pop();
      const url = `${SEC}/Archives/edgar/data/${Number(cik)}/${f.accession.replace(/-/g, '')}/${doc}`;
      const xml = await ctx.http.getText(url, { headers: headers(ctx), allow404: true });
      if (!xml) continue;
      for (const t of parseForm4(xml)) trades.push({ ...t, filed: f.filed, url });
    }
    return result(trades, {
      source: 'sec-edgar',
      asOf: forms[0]?.filed || isoDate(ctx.now()),
      note: `${forms.length} Form 4 filings since ${since}${forms.length === maxFilings ? ` (capped at ${maxFilings}; older filings in the window were not read)` : ''}`,
    });
  },

  async getHoldings(symbol, { managerCik } = {}, ctx) {
    if (!managerCik) {
      return result(null, { source: 'sec-edgar', note: 'EDGAR lists 13F holdings per manager; holders of one ticker need a keyed provider' });
    }
    const cik = pad(managerCik);
    const sub = await submissions(cik, ctx);
    const f = recentFilings(sub).find((x) => x.form === '13F-HR');
    if (!f) return result(null, { source: 'sec-edgar', note: 'no 13F-HR filing' });
    const base = `${SEC}/Archives/edgar/data/${Number(cik)}/${f.accession.replace(/-/g, '')}`;
    const index = await ctx.http.getJson(`${base}/index.json`, { headers: headers(ctx) });
    const table = index?.directory?.item?.find((i) => /\.xml$/i.test(i.name) && !/primary_doc/i.test(i.name));
    if (!table) return result(null, { source: 'sec-edgar', note: 'no information table in the 13F filing' });
    const xml = await ctx.http.getText(`${base}/${table.name}`, { headers: headers(ctx) });
    return result(
      { manager: sub?.name || cik, cik, reportDate: f.reportDate, filed: f.filed, holdings: parse13F(xml || ''), url: `${base}/${table.name}` },
      { source: 'sec-edgar', asOf: f.reportDate },
    );
  },
};
