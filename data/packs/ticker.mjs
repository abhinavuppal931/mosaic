// Ticker pack: one shared, sourced fact sheet for a single US stock. Every number is a fact
// with an id, a source, an as-of date and a status; derived numbers store their formula.
import * as M from '../lib/metrics.mjs';
import { addMacroFacts } from './macro.mjs';

const DAY = 86_400_000;
const { isNum } = M;

/**
 * Fetch everything a ticker pack needs. Separate from building so tests can feed recorded data.
 * @returns {Promise<object>} raw router results keyed by section
 */
export async function fetchTickerData(router, symbol, config) {
  const p = config.pack || {};
  const years = p.historyYears ?? 10;
  const get = (cap, arg, opts) => router.get(cap, arg, opts);
  const out = {
    profile: await get('profile', symbol),
    quote: await get('quote', symbol),
    history: await get('priceHistory', symbol, { years }),
    benchmark: p.benchmark ? await get('priceHistory', p.benchmark, { years: Math.min(years, 5) }) : null,
    financials: await get('financials', symbol, { limit: years }),
    insiders: await get('insiderTrades', symbol, { lookbackDays: p.insiderLookbackDays ?? 365, maxFilings: p.insiderMaxFilings ?? 40 }),
    holdings: await get('holdings', symbol),
    news: await get('news', symbol, { limit: 10 }),
    estimates: await get('estimates', symbol),
    macro: {},
  };
  for (const id of p.macroForTicker || []) out.macro[id] = await get('macroSeries', id, { years: 2 });
  return out;
}

/**
 * Turn fetched data into facts. Pure: no I/O.
 * @param {import('../lib/facts.mjs').createFactBook} fb
 */
export function tickerFacts(fb, raw, { symbol, config, series }) {
  const v = config.valuation;
  const add = (o) => fb.add(o);
  const der = (o) => fb.derive(o);
  const warnings = [];

  // ---------------------------------------------------------------- identity
  const prof = raw.profile;
  const pm = prof.meta;
  add({ key: 'company_name', label: 'Company name', value: prof.data?.name ?? null, unit: 'text', meta: pm, url: prof.data?.url });
  add({ key: 'cik', label: 'SEC CIK', value: prof.data?.cik ?? null, unit: 'text', meta: pm });
  add({ key: 'industry', label: 'Industry (SIC description)', value: prof.data?.sicDescription || prof.data?.industry || null, unit: 'text', meta: pm });
  add({ key: 'fiscal_year_end', label: 'Fiscal year end (MMDD)', value: prof.data?.fiscalYearEnd ?? null, unit: 'text', meta: pm });

  // ---------------------------------------------------------------- quote
  const q = raw.quote;
  const priceId = add({ key: 'price', label: 'Share price', value: q.data?.price ?? null, unit: `${q.data?.currency || 'USD'}/share`, period: q.data?.time, meta: q.meta });
  if (q.data?.currency && q.data.currency !== 'USD') warnings.push(`Price is quoted in ${q.data.currency}; financials are in USD. Ratios that mix them are unreliable.`);

  // ---------------------------------------------------------------- financials
  const F = raw.financials;
  const fm = F.meta;
  const periods = F.data?.periods || [];
  const ttm = F.data?.ttm || null;
  const L = periods[0] || null;
  const fyLabel = L ? `FY ending ${L.periodEnd}` : undefined;
  const ttmLabel = ttm ? `TTM to ${ttm.periodEnd}` : fyLabel;
  // Flow items: TTM when available, else latest fiscal year. Balance items: latest available.
  const flow = (sec, k) => (ttm && isNum(ttm[sec]?.[k]) ? ttm[sec][k] : L?.[sec]?.[k] ?? null);
  const flowPeriod = (sec, k) => (ttm && isNum(ttm[sec]?.[k]) ? ttmLabel : fyLabel);
  const bal = (k) => (ttm && isNum(ttm.balance?.[k]) ? ttm.balance[k] : L?.balance?.[k] ?? null);
  const balPeriod = (k) => (ttm && isNum(ttm.balance?.[k]) ? `as of ${ttm.periodEnd}` : L ? `as of ${L.periodEnd}` : undefined);
  const fMeta = (period) => ({ ...fm, asOf: period?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || fm.asOf });
  const url = F.data?.url;

  const line = (key, label, sec, k, unit = 'USD') => add({ key, label, value: flow(sec, k), unit, period: flowPeriod(sec, k), meta: fMeta(flowPeriod(sec, k)), url });
  const bline = (key, label, k, unit = 'USD') => add({ key, label, value: bal(k), unit, period: balPeriod(k), meta: fMeta(balPeriod(k)), url });

  const revId = line('revenue', 'Revenue', 'income', 'revenue');
  const gpId = line('gross_profit', 'Gross profit', 'income', 'grossProfit');
  const opId = line('operating_income', 'Operating income', 'income', 'operatingIncome');
  const niId = line('net_income', 'Net income', 'income', 'netIncome');
  const epsId = line('eps_diluted', 'Diluted EPS', 'income', 'epsDiluted', 'USD/share');
  const intId = line('interest_expense', 'Interest expense', 'income', 'interestExpense');
  const rdId = line('rd_expense', 'Research and development expense', 'income', 'researchAndDevelopment');
  const ocfId = line('operating_cash_flow', 'Operating cash flow', 'cashflow', 'operatingCF');
  const capexId = line('capex', 'Capital expenditure', 'cashflow', 'capex');
  const daId = line('depreciation_amortization', 'Depreciation and amortization', 'cashflow', 'da');
  const sbcId = line('sbc', 'Stock-based compensation', 'cashflow', 'sbc');
  const divId = line('dividends_paid', 'Dividends paid', 'cashflow', 'dividends');
  const bbId = line('buybacks', 'Share repurchases', 'cashflow', 'buybacks');
  const cashId = bline('cash', 'Cash and equivalents', 'cash');
  const stiId = bline('short_term_investments', 'Short-term investments', 'shortTermInvestments');
  const debtId = bline('total_debt', 'Total debt (long-term incl. current, plus short-term borrowings)', 'totalDebt');
  const eqId = bline('equity', 'Shareholders equity', 'equity');
  const taId = bline('total_assets', 'Total assets', 'totalAssets');
  const gwId = bline('goodwill', 'Goodwill', 'goodwill');
  const caId = bline('current_assets', 'Current assets', 'currentAssets');
  const clId = bline('current_liabilities', 'Current liabilities', 'currentLiabilities');

  const so = F.data?.sharesOutstanding;
  const sharesId = add({ key: 'shares_outstanding', label: 'Shares outstanding (cover page)', value: so?.value ?? L?.balance?.sharesOutstanding ?? null, unit: 'shares', period: so ? `as of ${so.asOf}` : undefined, meta: { ...fm, asOf: so?.asOf || fm.asOf }, url });

  const price = fb.value('price');
  const shares = fb.value('shares_outstanding');
  const mcapId = der({ key: 'market_cap', label: 'Market capitalization', value: isNum(price) && isNum(shares) ? price * shares : null, unit: 'USD', formula: 'price x shares_outstanding', inputs: [priceId, sharesId] });
  const mcap = fb.value('market_cap');
  const cashLike = (fb.value('cash') ?? 0) + (fb.value('short_term_investments') ?? 0);
  const debt = fb.value('total_debt');
  const evId = der({ key: 'enterprise_value', label: 'Enterprise value', value: isNum(mcap) && isNum(debt) && isNum(fb.value('cash')) ? mcap + debt - cashLike : null, unit: 'USD', formula: 'market_cap + total_debt - cash - short_term_investments', inputs: [mcapId, debtId, cashId, stiId] });
  const ev = fb.value('enterprise_value');

  const val = (k) => fb.value(k);
  const fcf = isNum(val('operating_cash_flow')) && isNum(val('capex')) ? val('operating_cash_flow') - val('capex') : null;
  const fcfId = der({ key: 'free_cash_flow', label: 'Free cash flow', value: fcf, unit: 'USD', period: flowPeriod('cashflow', 'operatingCF'), formula: 'operating_cash_flow - capex', inputs: [ocfId, capexId] });
  const oe = isNum(val('net_income')) && isNum(val('depreciation_amortization')) && isNum(val('capex')) ? val('net_income') + val('depreciation_amortization') - val('capex') : null;
  const oeId = der({ key: 'owner_earnings', label: 'Owner earnings (all capex treated as maintenance, conservative)', value: oe, unit: 'USD', period: flowPeriod('income', 'netIncome'), formula: 'net_income + depreciation_amortization - capex', inputs: [niId, daId, capexId], note: 'Total capex is used because maintenance capex is not disclosed; growth capex makes this understate owner earnings.' });

  // Valuation multiples
  der({ key: 'pe', label: 'Price / earnings', value: M.posRatio(price, val('eps_diluted')), unit: 'x', formula: 'price / eps_diluted', inputs: [priceId, epsId] });
  der({ key: 'pb', label: 'Price / book', value: M.posRatio(mcap, val('equity')), unit: 'x', formula: 'market_cap / equity', inputs: [mcapId, eqId] });
  der({ key: 'ps', label: 'Price / sales', value: M.posRatio(mcap, val('revenue')), unit: 'x', formula: 'market_cap / revenue', inputs: [mcapId, revId] });
  der({ key: 'ev_ebit', label: 'EV / EBIT', value: M.posRatio(ev, val('operating_income')), unit: 'x', formula: 'enterprise_value / operating_income', inputs: [evId, opId] });
  const ebitda = isNum(val('operating_income')) && isNum(val('depreciation_amortization')) ? val('operating_income') + val('depreciation_amortization') : null;
  der({ key: 'ev_ebitda', label: 'EV / EBITDA', value: M.posRatio(ev, ebitda), unit: 'x', formula: 'enterprise_value / (operating_income + depreciation_amortization)', inputs: [evId, opId, daId] });
  der({ key: 'fcf_yield', label: 'Free cash flow yield', value: M.ratio(fcf, mcap), unit: 'ratio', formula: 'free_cash_flow / market_cap', inputs: [fcfId, mcapId] });
  der({ key: 'fcf_yield_after_sbc', label: 'FCF yield after stock comp', value: isNum(fcf) && isNum(val('sbc')) ? M.ratio(fcf - val('sbc'), mcap) : null, unit: 'ratio', formula: '(free_cash_flow - sbc) / market_cap', inputs: [fcfId, sbcId, mcapId] });
  der({ key: 'ev_fcf', label: 'EV / free cash flow', value: M.posRatio(ev, fcf), unit: 'x', formula: 'enterprise_value / free_cash_flow', inputs: [evId, fcfId] });
  der({ key: 'owner_earnings_yield', label: 'Owner earnings yield', value: M.ratio(oe, mcap), unit: 'ratio', formula: 'owner_earnings / market_cap', inputs: [oeId, mcapId] });
  der({ key: 'dividend_yield', label: 'Dividend yield (cash paid / market cap)', value: M.ratio(val('dividends_paid'), mcap), unit: 'ratio', formula: 'dividends_paid / market_cap', inputs: [divId, mcapId] });
  der({ key: 'buyback_yield', label: 'Buyback yield (repurchases / market cap)', value: M.ratio(val('buybacks'), mcap), unit: 'ratio', formula: 'buybacks / market_cap', inputs: [bbId, mcapId] });

  // Quality and balance sheet
  der({ key: 'roe', label: 'Return on equity', value: M.posRatio(val('net_income'), val('equity')), unit: 'ratio', formula: 'net_income / equity', inputs: [niId, eqId] });
  const roicNow = roic(flow('income', 'operatingIncome'), flow('income', 'incomeTax'), flow('income', 'netIncome'), val('equity'), val('total_debt'), cashLike);
  der({ key: 'roic', label: 'Return on invested capital (after-tax operating income / (equity + debt - cash))', value: roicNow, unit: 'ratio', formula: 'operating_income x (1 - tax_rate) / (equity + total_debt - cash - short_term_investments); tax_rate = income_tax / (net_income + income_tax), clamped 0 to 0.35', inputs: [opId, niId, eqId, debtId, cashId] });
  der({ key: 'gross_margin', label: 'Gross margin', value: M.ratio(val('gross_profit'), val('revenue')), unit: 'ratio', formula: 'gross_profit / revenue', inputs: [gpId, revId] });
  der({ key: 'operating_margin', label: 'Operating margin', value: M.ratio(val('operating_income'), val('revenue')), unit: 'ratio', formula: 'operating_income / revenue', inputs: [opId, revId] });
  der({ key: 'net_margin', label: 'Net margin', value: M.ratio(val('net_income'), val('revenue')), unit: 'ratio', formula: 'net_income / revenue', inputs: [niId, revId] });
  der({ key: 'fcf_margin', label: 'Free cash flow margin', value: M.ratio(fcf, val('revenue')), unit: 'ratio', formula: 'free_cash_flow / revenue', inputs: [fcfId, revId] });
  der({ key: 'debt_to_equity', label: 'Debt / equity', value: M.posRatio(val('total_debt'), val('equity')), unit: 'x', formula: 'total_debt / equity', inputs: [debtId, eqId] });
  const netDebt = isNum(val('total_debt')) && isNum(val('cash')) ? val('total_debt') - cashLike : null;
  const ndId = der({ key: 'net_debt', label: 'Net debt (negative means net cash)', value: netDebt, unit: 'USD', formula: 'total_debt - cash - short_term_investments', inputs: [debtId, cashId, stiId] });
  der({ key: 'net_debt_to_ebitda', label: 'Net debt / EBITDA', value: M.posRatio(netDebt, ebitda) ?? (isNum(netDebt) && netDebt <= 0 && isNum(ebitda) && ebitda > 0 ? netDebt / ebitda : null), unit: 'x', formula: 'net_debt / (operating_income + depreciation_amortization)', inputs: [ndId, opId, daId] });
  der({ key: 'interest_coverage', label: 'Interest coverage (EBIT / interest)', value: M.posRatio(val('operating_income'), val('interest_expense')), unit: 'x', formula: 'operating_income / interest_expense', inputs: [opId, intId] });
  der({ key: 'current_ratio', label: 'Current ratio', value: M.posRatio(val('current_assets'), val('current_liabilities')), unit: 'x', formula: 'current_assets / current_liabilities', inputs: [caId, clId] });
  der({ key: 'fcf_conversion', label: 'FCF / net income', value: M.posRatio(fcf, val('net_income')), unit: 'x', formula: 'free_cash_flow / net_income', inputs: [fcfId, niId] });
  der({ key: 'sbc_to_revenue', label: 'Stock comp / revenue', value: M.ratio(val('sbc'), val('revenue')), unit: 'ratio', formula: 'sbc / revenue', inputs: [sbcId, revId] });
  der({ key: 'goodwill_to_assets', label: 'Goodwill / total assets', value: M.ratio(val('goodwill'), val('total_assets')), unit: 'ratio', formula: 'goodwill / total_assets', inputs: [gwId, taId] });
  der({ key: 'accruals_ratio', label: 'Accruals ratio ((net income - operating cash flow) / assets)', value: isNum(val('net_income')) && isNum(val('operating_cash_flow')) ? M.ratio(val('net_income') - val('operating_cash_flow'), val('total_assets')) : null, unit: 'ratio', formula: '(net_income - operating_cash_flow) / total_assets', inputs: [niId, ocfId, taId] });
  der({ key: 'capex_to_revenue', label: 'Capex / revenue', value: M.ratio(val('capex'), val('revenue')), unit: 'ratio', formula: 'capex / revenue', inputs: [capexId, revId] });
  der({ key: 'rd_to_revenue', label: 'R&D / revenue', value: M.ratio(val('rd_expense'), val('revenue')), unit: 'ratio', formula: 'rd_expense / revenue', inputs: [rdId, revId] });

  // ---------------------------------------------------------------- history across fiscal years
  const annualRef = 'series:annual';
  const fy = periods.slice().reverse(); // oldest first
  const col = (sec, k) => fy.map((p) => p[sec]?.[k] ?? null);
  const roeHist = fy.map((p) => M.posRatio(p.income.netIncome, p.balance.equity));
  const gmHist = fy.map((p) => M.ratio(p.income.grossProfit, p.income.revenue));
  const omHist = fy.map((p) => M.ratio(p.income.operatingIncome, p.income.revenue));
  const roicHist = fy.map((p) => roic(p.income.operatingIncome, p.income.incomeTax, p.income.netIncome, p.balance.equity, p.balance.totalDebt, (p.balance.cash ?? 0) + (p.balance.shortTermInvestments ?? 0)));
  const nYears = fy.length;
  const span = nYears ? `${fy[0].fiscalYear} to ${fy[nYears - 1].fiscalYear}` : undefined;
  const hist = (o) => der({ ...o, period: o.period || span, inputs: [annualRef], asOf: L?.periodEnd });
  const enough = (xs, n) => xs.filter(isNum).length >= n;

  hist({ key: 'fiscal_years_available', label: 'Fiscal years of financials in the pack', value: nYears || null, unit: 'count', formula: 'count(annual periods)' });
  hist({ key: 'roe_avg', label: `Return on equity, average over ${nYears} fiscal years`, value: enough(roeHist, 3) ? M.mean(roeHist) : null, unit: 'ratio', formula: 'mean(net_income / equity) per fiscal year' });
  hist({ key: 'roe_min', label: `Return on equity, lowest fiscal year of ${nYears}`, value: enough(roeHist, 3) ? Math.min(...roeHist.filter(isNum)) : null, unit: 'ratio', formula: 'min(net_income / equity) per fiscal year' });
  hist({ key: 'roic_avg', label: `ROIC, average over ${nYears} fiscal years`, value: enough(roicHist, 3) ? M.mean(roicHist) : null, unit: 'ratio', formula: 'mean(roic) per fiscal year' });
  hist({ key: 'gross_margin_stdev', label: 'Gross margin, standard deviation across fiscal years', value: enough(gmHist, 3) ? M.stdev(gmHist) : null, unit: 'ratio', formula: 'stdev(gross_profit / revenue) per fiscal year' });
  hist({ key: 'gross_margin_trend', label: 'Gross margin change, latest minus oldest fiscal year', value: enough(gmHist, 3) ? lastNum(gmHist) - firstNum(gmHist) : null, unit: 'ratio', formula: 'gross_margin(latest FY) - gross_margin(oldest FY)' });
  hist({ key: 'operating_margin_stdev', label: 'Operating margin, standard deviation across fiscal years', value: enough(omHist, 3) ? M.stdev(omHist) : null, unit: 'ratio', formula: 'stdev(operating_income / revenue) per fiscal year' });
  hist({ key: 'operating_margin_trend', label: 'Operating margin change, latest minus oldest fiscal year', value: enough(omHist, 3) ? lastNum(omHist) - firstNum(omHist) : null, unit: 'ratio', formula: 'operating_margin(latest FY) - operating_margin(oldest FY)' });
  hist({ key: 'operating_margin_max', label: 'Operating margin, best fiscal year', value: enough(omHist, 3) ? Math.max(...omHist.filter(isNum)) : null, unit: 'ratio', formula: 'max(operating_income / revenue) per fiscal year' });

  const cagrN = (arr, n) => (arr.length > n && isNum(arr[arr.length - 1 - n]) ? M.cagr(arr[arr.length - 1 - n], arr[arr.length - 1], n) : null);
  const rev = col('income', 'revenue');
  const eps = col('income', 'epsDiluted');
  const bvps = fy.map((p) => M.posRatio(p.balance.equity, p.income.dilutedShares));
  const dil = col('income', 'dilutedShares');
  const fcfHist = fy.map((p) => p.cashflow.freeCashFlow);
  const n5 = Math.min(5, nYears - 1);
  const nAll = nYears - 1;
  hist({ key: 'revenue_cagr_5y', label: `Revenue CAGR, last ${n5} fiscal years`, value: n5 >= 3 ? cagrN(rev, n5) : null, unit: 'ratio', formula: `(revenue_latest / revenue_${n5}y_ago)^(1/${n5}) - 1` });
  hist({ key: 'revenue_cagr_10y', label: `Revenue CAGR, last ${nAll} fiscal years`, value: nAll >= 6 ? cagrN(rev, nAll) : null, unit: 'ratio', formula: `(revenue_latest / revenue_${nAll}y_ago)^(1/${nAll}) - 1` });
  hist({ key: 'eps_cagr_5y', label: `Diluted EPS CAGR, last ${n5} fiscal years`, value: n5 >= 3 ? cagrN(eps, n5) : null, unit: 'ratio', formula: `(eps_latest / eps_${n5}y_ago)^(1/${n5}) - 1; null if either is not positive` });
  hist({ key: 'fcf_cagr_5y', label: `Free cash flow CAGR, last ${n5} fiscal years`, value: n5 >= 3 ? cagrN(fcfHist, n5) : null, unit: 'ratio', formula: `(fcf_latest / fcf_${n5}y_ago)^(1/${n5}) - 1; null if either is not positive` });
  hist({ key: 'bvps_cagr', label: `Book value per share CAGR, last ${nAll} fiscal years`, value: nAll >= 3 ? cagrN(bvps, nAll) : null, unit: 'ratio', formula: 'CAGR of equity / diluted shares' });
  hist({ key: 'diluted_shares_change_5y', label: `Diluted share count change, last ${n5} fiscal years`, value: n5 >= 3 && isNum(dil[dil.length - 1 - n5]) && isNum(dil[dil.length - 1]) ? dil[dil.length - 1] / dil[dil.length - 1 - n5] - 1 : null, unit: 'ratio', formula: `diluted_shares_latest / diluted_shares_${n5}y_ago - 1 (negative means buybacks shrank the count)` });
  const yoy = (arr, back = 0) => {
    const i = arr.length - 1 - back;
    return i >= 1 && isNum(arr[i]) && isNum(arr[i - 1]) && arr[i - 1] > 0 ? arr[i] / arr[i - 1] - 1 : null;
  };
  const yoyPeriod = nYears >= 2 ? `FY${fy[nYears - 1].fiscalYear} vs FY${fy[nYears - 2].fiscalYear}` : undefined;
  const rg = yoy(rev);
  const rgPrev = yoy(rev, 1);
  hist({ period: yoyPeriod, key: 'revenue_growth_yoy', label: 'Revenue growth, latest fiscal year', value: rg, unit: 'ratio', formula: 'revenue(latest FY) / revenue(prior FY) - 1' });
  hist({ period: yoyPeriod, key: 'revenue_growth_acceleration', label: 'Revenue growth acceleration (latest FY growth minus prior FY growth)', value: isNum(rg) && isNum(rgPrev) ? rg - rgPrev : null, unit: 'ratio', formula: 'revenue_growth(latest FY) - revenue_growth(prior FY)' });
  hist({ period: yoyPeriod, key: 'eps_growth_yoy', label: 'Diluted EPS growth, latest fiscal year', value: yoy(eps), unit: 'ratio', formula: 'eps(latest FY) / eps(prior FY) - 1; null if prior EPS not positive' });
  const recv = col('balance', 'receivables');
  const inv = col('balance', 'inventory');
  hist({ period: yoyPeriod, key: 'receivables_vs_revenue_growth', label: 'Receivables growth minus revenue growth, latest fiscal year', value: isNum(yoy(recv)) && isNum(rg) ? yoy(recv) - rg : null, unit: 'ratio', formula: 'receivables_growth(latest FY) - revenue_growth(latest FY)' });
  hist({ period: yoyPeriod, key: 'inventory_vs_revenue_growth', label: 'Inventory growth minus revenue growth, latest fiscal year', value: isNum(yoy(inv)) && isNum(rg) ? yoy(inv) - rg : null, unit: 'ratio', formula: 'inventory_growth(latest FY) - revenue_growth(latest FY)' });
  const fcfConvHist = fy.map((p) => M.posRatio(p.cashflow.freeCashFlow, p.income.netIncome)).slice(-5);
  hist({ key: 'fcf_conversion_avg_5y', label: 'FCF / net income, average of last 5 fiscal years', value: enough(fcfConvHist, 3) ? M.mean(fcfConvHist) : null, unit: 'x', formula: 'mean(free_cash_flow / net_income), last 5 FY' });
  // Sales to capital (Damodaran): revenue added per dollar of invested capital added.
  const ic = fy.map((p) => (isNum(p.balance.equity) && isNum(p.balance.totalDebt) ? p.balance.equity + p.balance.totalDebt - ((p.balance.cash ?? 0) + (p.balance.shortTermInvestments ?? 0)) : null));
  const dRev = n5 >= 3 && isNum(rev[rev.length - 1 - n5]) ? rev[rev.length - 1] - rev[rev.length - 1 - n5] : null;
  const dIc = n5 >= 3 && isNum(ic[ic.length - 1 - n5]) && isNum(ic[ic.length - 1]) ? ic[ic.length - 1] - ic[ic.length - 1 - n5] : null;
  hist({ key: 'sales_to_capital_5y', label: `Sales to capital, last ${n5} fiscal years (revenue added / invested capital added)`, value: M.posRatio(dRev, dIc), unit: 'x', formula: 'delta revenue / delta (equity + debt - cash)' });

  // ---------------------------------------------------------------- price history
  const H = raw.history;
  const pts = H.data?.points || [];
  const hm = H.meta;
  const histRef = 'series:price';
  const ph = (o) => der({ ...o, inputs: [histRef], period: o.period || (pts.length ? `${pts[0].t} to ${pts[pts.length - 1].t}` : undefined), asOf: pts.length ? pts[pts.length - 1].t : undefined });
  const adj = pts.map((p) => p.adjC);
  const last5 = pts.filter((p) => p.t >= isoBack(pts, 5 * 365));
  const last1 = pts.filter((p) => p.t >= isoBack(pts, 365));
  const r5 = M.logReturns(last5.map((p) => p.adjC));
  ph({ key: 'price_history_days', label: 'Daily price points in the pack', value: pts.length || null, unit: 'count', formula: 'count(daily closes)' });
  ph({ key: 'return_1y', label: 'Total return, last 12 months', value: M.returnOver(pts, 365), unit: 'ratio', formula: 'adjusted close now / adjusted close 365 days ago - 1' });
  ph({ key: 'return_6m', label: 'Total return, last 6 months', value: M.returnOver(pts, 182), unit: 'ratio', formula: 'adjusted close now / adjusted close 182 days ago - 1' });
  const r3 = M.returnOver(pts, 3 * 365);
  const r5y = M.returnOver(pts, 5 * 365);
  ph({ key: 'return_3y_annualized', label: 'Total return, last 3 years, annualized', value: isNum(r3) ? (1 + r3) ** (1 / 3) - 1 : null, unit: 'ratio', formula: '(1 + 3y return)^(1/3) - 1' });
  ph({ key: 'return_5y_annualized', label: 'Total return, last 5 years, annualized', value: isNum(r5y) ? (1 + r5y) ** (1 / 5) - 1 : null, unit: 'ratio', formula: '(1 + 5y return)^(1/5) - 1' });
  const closes1y = last1.map((p) => p.c);
  ph({ key: 'high_52w', label: '52-week high close', value: closes1y.length > 200 ? Math.max(...closes1y) : null, unit: 'USD/share', formula: 'max(close), last 365 days' });
  ph({ key: 'low_52w', label: '52-week low close', value: closes1y.length > 200 ? Math.min(...closes1y) : null, unit: 'USD/share', formula: 'min(close), last 365 days' });
  ph({ key: 'pct_below_52w_high', label: 'Distance below the 52-week high', value: closes1y.length > 200 ? pts[pts.length - 1].c / Math.max(...closes1y) - 1 : null, unit: 'ratio', formula: 'last close / 52-week high - 1' });
  const dd = M.maxDrawdown(pts, 'adjC');
  ph({ key: 'max_drawdown', label: 'Maximum drawdown over the price history', value: pts.length > 250 ? dd?.value ?? null : null, unit: 'ratio', formula: 'min(adjusted close / running peak - 1)', note: dd?.from ? `peak ${dd.from}, trough ${dd.to}` : undefined });
  ph({ key: 'current_drawdown', label: 'Current drawdown from the all-history peak', value: pts.length ? pts[pts.length - 1].adjC / Math.max(...adj.filter(isNum)) - 1 : null, unit: 'ratio', formula: 'last adjusted close / max(adjusted close) - 1' });
  ph({ key: 'volatility_1y', label: 'Volatility, last 12 months (annualized)', value: M.annualVol(last1.map((p) => p.adjC)), unit: 'ratio', formula: 'stdev(daily log returns) x sqrt(252), last 365 days' });
  ph({ key: 'volatility_5y', label: 'Volatility, last 5 years (annualized)', value: last5.length > 750 ? M.annualVol(last5.map((p) => p.adjC)) : null, unit: 'ratio', formula: 'stdev(daily log returns) x sqrt(252), last 5 years' });
  ph({ key: 'return_skew_5y', label: 'Skew of daily returns, last 5 years', value: r5.length > 750 ? M.skewness(r5) : null, unit: 'number', formula: 'sample skewness of daily log returns' });
  ph({ key: 'return_excess_kurtosis_5y', label: 'Excess kurtosis of daily returns, last 5 years (0 = normal tails)', value: r5.length > 750 ? M.excessKurtosis(r5) : null, unit: 'number', formula: 'sample excess kurtosis of daily log returns' });
  ph({ key: 'worst_day_5y', label: 'Worst one-day return, last 5 years', value: r5.length > 750 ? Math.exp(Math.min(...r5)) - 1 : null, unit: 'ratio', formula: 'min(daily return), last 5 years' });
  const sma200 = M.sma(adj, 200);
  ph({ key: 'price_vs_200d_average', label: 'Price versus its 200-day average', value: isNum(sma200) ? adj[adj.length - 1] / sma200 - 1 : null, unit: 'ratio', formula: 'adjusted close / mean(last 200 adjusted closes) - 1' });
  ph({ key: 'price_percentile_history', label: 'Where today\'s price sits in its own history (0 = lowest, 1 = highest)', value: pts.length > 500 ? M.percentileRank(adj, adj[adj.length - 1]) : null, unit: 'ratio', formula: 'share of daily adjusted closes at or below today' });
  const B = raw.benchmark;
  const bench = config.pack?.benchmark;
  if (B) {
    const br = M.returnOver(B.data?.points || [], 365);
    const rs = M.returnOver(pts, 365);
    der({ key: 'relative_strength_1y', label: `12-month return minus ${bench} 12-month return`, value: isNum(br) && isNum(rs) ? rs - br : null, unit: 'ratio', formula: `return_1y - ${bench} return_1y`, inputs: [histRef, `series:${bench}`], asOf: pts.length ? pts[pts.length - 1].t : undefined, note: B.meta.status !== 'ok' && B.meta.status !== 'fallback' ? `${bench} history ${B.meta.status}` : undefined });
  }

  // P/E against its own history at each fiscal year end.
  const peHist = fy.map((p) => {
    const close = closeOn(pts, p.periodEnd);
    return M.posRatio(close, p.income.epsDiluted);
  });
  const peNow = fb.value('pe');
  der({ key: 'pe_percentile_own_history', label: 'Today\'s P/E against P/E at each past fiscal year end (0 = cheapest, 1 = richest)', value: peHist.filter(isNum).length >= 5 && isNum(peNow) ? M.percentileRank(peHist, peNow) : null, unit: 'ratio', formula: 'share of fiscal-year-end P/Es (close on FY end / FY diluted EPS) at or below today\'s P/E', inputs: [fb.id('pe'), annualRef, histRef] });
  der({ key: 'pe_median_own_history', label: 'Median P/E at past fiscal year ends', value: peHist.filter(isNum).length >= 5 ? M.median(peHist) : null, unit: 'x', formula: 'median(close on FY end / FY diluted EPS)', inputs: [annualRef, histRef], asOf: L?.periodEnd });

  // ---------------------------------------------------------------- growth style and valuation
  const epsC = fb.value('eps_cagr_5y');
  der({ key: 'peg', label: 'PEG (P/E divided by 5-year EPS growth in percent)', value: isNum(peNow) && isNum(epsC) && epsC > 0 ? peNow / (epsC * 100) : null, unit: 'x', formula: 'pe / (eps_cagr_5y x 100)', inputs: [fb.id('pe'), fb.id('eps_cagr_5y')] });
  const lc = config.thresholds?.lynchCategory || { fast: 0.2, stalwart: 0.1, slow: 0 };
  der({ key: 'lynch_category', label: 'Growth category by 5-year EPS growth (heuristic)', value: isNum(epsC) ? (epsC >= lc.fast ? 'fast grower' : epsC >= lc.stalwart ? 'stalwart' : epsC >= lc.slow ? 'slow grower' : 'shrinking (turnaround or cyclical candidate)') : null, unit: 'text', formula: `eps_cagr_5y >= ${lc.fast} fast; >= ${lc.stalwart} stalwart; >= ${lc.slow} slow; below that shrinking`, inputs: [fb.id('eps_cagr_5y')] });

  const g0 = fb.value('revenue_cagr_5y');
  const scen = v.scenarioMultipliers;
  const dcfIn = [fcfId, sharesId, fb.id('revenue_cagr_5y')];
  const dcfPerShare = (growth, r = v.discountRate) => (isNum(fcf) && fcf > 0 && isNum(shares) ? M.dcfValue({ cash0: fcf, growth, discount: r, terminalGrowth: v.terminalGrowth, years: v.years }) / shares : null);
  const scenGrowth = (mult) => (isNum(g0) ? Math.min(Math.max(g0 * mult, 0), v.growthCap) : null);
  const assumptions = `${v.years} years of FCF growth then ${v.terminalGrowth * 100}% forever, discounted at ${v.discountRate * 100}%`;
  for (const [name, mult] of Object.entries(scen)) {
    const g = scenGrowth(mult);
    der({ key: `dcf_value_${name}`, label: `DCF value per share, ${name} case (FCF growth ${isNum(g) ? (g * 100).toFixed(1) + '%' : 'n/a'})`, value: isNum(g) ? dcfPerShare(g) : null, unit: 'USD/share', formula: `FCF DCF: growth = clamp(revenue_cagr_5y x ${mult}, 0, ${v.growthCap}); ${assumptions}`, inputs: dcfIn, note: 'A range for debate, not a price target.' });
  }
  const base = fb.value('dcf_value_base');
  der({ key: 'price_to_dcf_base', label: 'Price / DCF base-case value', value: M.posRatio(price, base), unit: 'x', formula: 'price / dcf_value_base', inputs: [priceId, fb.id('dcf_value_base')] });
  const igArgs = (r) => ({ price: ev, cash0: fcf, discount: r, terminalGrowth: v.terminalGrowth, years: v.years });
  const ig = M.impliedGrowth(igArgs(v.discountRate));
  der({ key: 'implied_fcf_growth', label: `What the price implies: annual FCF growth for ${v.years} years at a ${v.discountRate * 100}% discount rate`, value: ig, unit: 'ratio', formula: `solve g: DCF(free_cash_flow, g, ${v.years}y, terminal ${v.terminalGrowth}, r ${v.discountRate}) = enterprise_value`, inputs: [evId, fcfId] });
  der({ key: 'implied_fcf_growth_low_discount', label: `Implied FCF growth at a ${v.discountRateLow * 100}% discount rate`, value: M.impliedGrowth(igArgs(v.discountRateLow)), unit: 'ratio', formula: `same as implied_fcf_growth with r = ${v.discountRateLow}`, inputs: [evId, fcfId] });
  der({ key: 'implied_fcf_growth_high_discount', label: `Implied FCF growth at a ${v.discountRateHigh * 100}% discount rate`, value: M.impliedGrowth(igArgs(v.discountRateHigh)), unit: 'ratio', formula: `same as implied_fcf_growth with r = ${v.discountRateHigh}`, inputs: [evId, fcfId] });
  const hist10 = fb.value('revenue_cagr_10y') ?? g0;
  der({ key: 'implied_vs_history_gap', label: 'Implied FCF growth minus the company\'s own revenue CAGR', value: isNum(ig) && isNum(hist10) ? ig - hist10 : null, unit: 'ratio', formula: 'implied_fcf_growth - revenue_cagr_10y (or 5y when 10y is missing)', inputs: [fb.id('implied_fcf_growth'), fb.id('revenue_cagr_10y'), fb.id('revenue_cagr_5y')] });

  // ---------------------------------------------------------------- insiders
  const I = raw.insiders;
  const trades = I.data || [];
  const im = I.meta;
  const buys = trades.filter((t) => t.type === 'buy');
  const sells = trades.filter((t) => t.type === 'sell');
  const sum = (xs) => xs.reduce((s, t) => s + (t.value || 0), 0);
  const insiderMeta = { ...im };
  const iv = (x) => (I.data === null ? null : x);
  const iPeriod = `last ${config.pack?.insiderLookbackDays ?? 365} days`;
  add({ key: 'insider_open_market_buys', label: 'Insider open-market purchases (count)', value: iv(buys.length), unit: 'count', period: iPeriod, meta: insiderMeta });
  add({ key: 'insider_open_market_buy_value', label: 'Insider open-market purchases (value)', value: iv(sum(buys)), unit: 'USD', period: iPeriod, meta: insiderMeta });
  add({ key: 'insider_open_market_sells', label: 'Insider open-market sales (count)', value: iv(sells.length), unit: 'count', period: iPeriod, meta: insiderMeta });
  add({ key: 'insider_open_market_sell_value', label: 'Insider open-market sales (value)', value: iv(sum(sells)), unit: 'USD', period: iPeriod, meta: insiderMeta });
  der({ key: 'insider_net_value', label: 'Insider net open-market buying (buys minus sells)', value: I.data === null ? null : sum(buys) - sum(sells), unit: 'USD', period: iPeriod, formula: 'sum(purchase value) - sum(sale value); grants, exercises and tax withholding excluded', inputs: [fb.id('insider_open_market_buy_value'), fb.id('insider_open_market_sell_value')] });

  // ---------------------------------------------------------------- data a free stack does not have
  add({ key: 'short_interest', label: 'Short interest (% of float)', value: null, unit: 'ratio', meta: { status: 'missing', note: 'no configured provider supplies short interest' } });
  const hd = raw.holdings;
  add({ key: 'institutional_holders', label: 'Top institutional holders', value: hd.data?.holdings?.length ? hd.data.holdings.slice(0, 5).map((h) => h.name).join('; ') : null, unit: 'text', meta: hd.meta });

  // ---------------------------------------------------------------- estimates and next report
  const E = raw.estimates;
  add({ key: 'eps_estimate_next_fy', label: 'Consensus EPS, next fiscal year', value: E.data?.epsNextFY ?? null, unit: 'USD/share', period: E.data?.fiscalPeriodEnd, meta: E.meta });
  add({ key: 'revenue_estimate_next_fy', label: 'Consensus revenue, next fiscal year', value: E.data?.revNextFY ?? null, unit: 'USD', period: E.data?.fiscalPeriodEnd, meta: E.meta });
  der({ key: 'forward_pe', label: 'Price / next fiscal year consensus EPS', value: M.posRatio(price, fb.value('eps_estimate_next_fy')), unit: 'x', formula: 'price / eps_estimate_next_fy', inputs: [priceId, fb.id('eps_estimate_next_fy')] });
  const filings = prof.data?.periodicFilings || [];
  const lastFiled = filings[0]?.filed || null;
  add({ key: 'last_report_filed', label: 'Last 10-K or 10-Q filed', value: lastFiled, unit: 'date', period: filings[0] ? `${filings[0].form} for period ${filings[0].reportDate}` : undefined, meta: pm });
  const next = nextReport(filings, E.data?.nextEarningsDate ? E : null);
  if (next.source === 'estimate') {
    der({ key: 'next_report_expected', label: 'Next quarterly report, expected (from filing cadence)', value: next.date, unit: 'date', formula: 'last periodic filing date + median days between the last periodic filings', inputs: [fb.id('last_report_filed')], note: 'An estimate from past filing dates, not an announced date.' });
  } else {
    add({ key: 'next_report_expected', label: 'Next earnings date (provider calendar)', value: next.date, unit: 'date', meta: E.meta });
  }

  // ---------------------------------------------------------------- macro context
  addMacroFacts(fb, raw.macro, { series, ids: config.pack?.macroForTicker || [], prefixLabel: '' });

  // ---------------------------------------------------------------- warnings
  if (!L) warnings.push('No annual financials: every fundamentals-based seat is limited to price and macro evidence.');
  if (L && !ttm) warnings.push('No trailing-twelve-month figures: flow items use the latest fiscal year.');
  if (!pts.length) warnings.push('No price history: drawdown, volatility and momentum facts are missing.');
  if (raw.news.data === null) warnings.push('No news in the pack (needs a keyed provider such as Finnhub or FMP).');
  if (E.data === null) warnings.push('No analyst estimates: valuation rests on reported history only.');
  if (isNum(fcf) && fcf <= 0) warnings.push('Free cash flow is not positive: the DCF range and the implied-growth reverse DCF cannot be computed.');
  return warnings;
}

function roic(opInc, tax, ni, equity, debt, cashLike) {
  if (!isNum(opInc) || !isNum(equity) || !isNum(debt)) return null;
  const pre = isNum(ni) && isNum(tax) ? ni + tax : null;
  let rate = pre && pre > 0 && isNum(tax) ? tax / pre : 0.21;
  rate = Math.min(Math.max(rate, 0), 0.35);
  const ic = equity + debt - (cashLike || 0);
  return ic > 0 ? (opInc * (1 - rate)) / ic : null;
}

const firstNum = (xs) => xs.find(isNum);
const lastNum = (xs) => [...xs].reverse().find(isNum);

function isoBack(pts, daysBack) {
  if (!pts.length) return '9999';
  return new Date(Date.parse(pts[pts.length - 1].t) - daysBack * DAY).toISOString().slice(0, 10);
}

function closeOn(pts, date) {
  let hit = null;
  for (const p of pts) {
    if (p.t <= date) hit = p;
    else break;
  }
  if (!hit || (Date.parse(date) - Date.parse(hit.t)) / DAY > 7) return null;
  return hit.c;
}

/** Next report date: a provider calendar date if present, else filing cadence. */
export function nextReport(filings, estimates) {
  if (estimates?.data?.nextEarningsDate) return { date: estimates.data.nextEarningsDate, source: 'calendar' };
  const dates = filings.map((f) => f.filed).filter(Boolean).sort().reverse().slice(0, 6);
  if (dates.length < 3) return { date: null, source: 'estimate' };
  const gaps = [];
  for (let i = 0; i < dates.length - 1; i++) gaps.push((Date.parse(dates[i]) - Date.parse(dates[i + 1])) / DAY);
  const gap = Math.round(M.median(gaps));
  return { date: new Date(Date.parse(dates[0]) + gap * DAY).toISOString().slice(0, 10), source: 'estimate' };
}
