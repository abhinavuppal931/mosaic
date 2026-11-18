# Research: virattt/ai-hedge-fund + market-data layer for the Council skill

Date: 2026-11-17. Read-only analysis of the clone; nothing executed.

## PART 1. ai-hedge-fund

### Important caveat on the clone
The clone is the REWRITTEN v2 (package `hedge_fund/`, CLI `aihf`), not the original v1 (`src/agents/*.py` with hard-coded quant checks). v1 is not in the clone. v2 personas contain NO quantitative checks in code. So the per-legend metric lists below are split: (a) what v2 actually does (verified in files), (b) v1 thresholds recalled from memory (UNVERIFIED, re-check against v1 git history before quoting), (c) my proposed evidence packs.

### License
MIT, Copyright (c) 2024 Virat Singh (LICENSE file). Ideas and code reusable with copyright + license notice preserved. Ship a NOTICE/attribution line if any code is copied; ideas need no attribution. README disclaimer: educational only, not advice. VISION.md says personas are "stylized approximations", not the real people, not endorsements (worth copying that disclaimer).

### Roster (v2 `signals/__init__.py` registry)
LLM personas: buffett, munger, graham, lynch, druckenmiller (the last is long_short, others long_only). Quant: pead (post-earnings drift). Each declares `investment_approach` and `horizon_days` (buffett/munger/graham/lynch 252, druckenmiller 126, pead 60). v1 additionally had ackman, burry, cathie wood, damodaran, fisher, jhunjhunwala, pabrai, taleb-ish risk bits, plus technical/fundamental/sentiment/valuation analysts (memory, unverified).

### v2 persona design (verified)
Persona = ONLY a system prompt (30 lines). Shared machinery in `LLMAgent`: builds a point-in-time `FundamentalsSnapshot`, renders it as a compact table, calls LLM, parses `{"signal": bullish|bearish|neutral, "confidence": 0-100, "reasoning": 2-4 sentences}`, converts to value in [-1,1]. Each prompt has a numbered checklist, signal rules, a confidence scale, and hard rules ("reason only from data provided, do not invent numbers, say insufficient and go neutral").

What each persona is told to check (qualitative, numbers read from snapshot):
- Buffett: circle of competence; moat (durable high ROE, stable margins, pricing power); capital allocation (BVPS compounding, FCF); low debt, current ratio; price vs quality; 10-year hold test.
- Munger: invert (falling margins, rising leverage, eroding ROE); consistency over whole history; incentives/capital allocation; price sanity vs growth; "too-hard pile" to neutral.
- Graham: margin of safety; P/E above 15-20 needs extraordinary justification; P/B from mcap/BVPS; current ratio >1.5; modest D/E; positive earnings across record; distrust growth premiums.
- Lynch: categorize (fast grower 20%+, stalwart 10-12%, slow, turnaround); PEG (P/E vs visible growth); revenue to EPS translation; balance sheet.
- Druckenmiller: acceleration/deceleration of revenue growth and margins in recent quarters vs older; EPS momentum; what is priced in; asymmetry; leverage plus deterioration is a short/pass.
- PEAD (pure math): BEAT/MISS on 8-K within 4 days of filing; 8-K only (10-Q date is not announcement date).

Snapshot (computed in Python so LLM does not do arithmetic): ROE avg, net margin avg, gross margin trend (latest minus oldest), BVPS CAGR, D/E latest, mcap, EPS growth YoY (t-0 vs t-4, None if prior <=0). 20 TTM periods, columns: P/E, ROE, gross/op/net margin, D/E, current ratio, rev growth, EPS, BVPS, FCF/share. `MIN_PERIODS=4` else abstain "insufficient data". Blind mode withholds ticker/dates/dollars for backtests (reduce memorized-outcome leakage).

### v1 quant checks (from memory, UNVERIFIED; useful as evidence-pack seeds)
- Buffett: ROE > 15%, D/E < 0.5, operating margin > 15%, current ratio > 1.5, earnings consistency (growing most periods), moat score (ROE/margin stability), owner earnings = NI + D&A - maintenance capex (approx), 3-stage DCF intrinsic value, margin of safety = (intrinsic - mcap)/mcap, bullish if MoS > ~30% and score high.
- Graham: Graham Number = sqrt(22.5 x EPS x BVPS), net-net (current assets - total liabilities vs mcap), current ratio >= 2, D/E < 0.5, positive EPS every year, dividend record.
- Lynch: PEG < 1 good, >2 bad; revenue/EPS growth; D/E; insider activity; sentiment.
- Damodaran: FCFF DCF with growth/risk narrative, cost of equity (CAPM), relative P/E sanity.
- Burry: FCF yield > ~8%, EV/EBIT < 6-7, net debt, insider buying, contrarian news.
- Taleb: tail risk, skew, kurtosis, drawdown from price history, convexity/fragility.
- Druckenmiller: growth momentum, price momentum, risk/reward, sentiment, insider.

### Data layer (v2, verified)
- Single vendor: Financial Datasets API (api.financialdatasets.ai), key `FINANCIAL_DATASETS_API_KEY` or x402 pay-per-call with a Base wallet (USDC, last 365 days only). Paid; no free tier besides x402 per call.
- Endpoints: /prices/, /prices/snapshot/, /financial-metrics/ (point-in-time filter filing_date_lte), /news/ (10 per page), /insider-trades/, /company/facts/, /earnings/ (+history, source_type 8-K/10-Q/10-K, BEAT/MISS), screener.
- Models (pydantic, extra=ignore): Price(OHLCV,time), PriceSnapshot, FinancialMetrics (~45 ratios: valuation, profitability, efficiency, liquidity, leverage, growth, per-share; filing_date), InsiderTrade, CompanyNews, CompanyFacts (sector, industry, cik, sic), Earnings/EarningsData (revenue/EPS actual vs estimate, surprise, statement lines), Filing.
- Swappability: genuinely good. `DataClient` is a `typing.Protocol` (structural typing, "no inheritance required"); docstring example shows a YFinanceClient. Contract: empty list/None = data does not exist; infrastructure failure MUST raise (fail loud, never silently empty). `CachedDataClient` decorator wraps any client with disk JSON cache: historical forever, same-day 10 min TTL, quotes never cached; only successes cached. `CallMeter` counts billable calls.
- Weakness: only one real implementation; `requests` and pydantic dependencies; no fallback chain.

### Risk manager / portfolio / aggregation (v2, verified)
- Portfolio: `blend_signals` = weighted mean of signed conviction values across analysts; abstentions excluded, neutral votes count; long-only analysts' bearishness reduces ownership but cannot create short evidence; scores normalized to gross target; dollar-neutral mode splits half/half. Explicit note: does not calibrate conviction to expected return.
- Risk: "conviction requests, risk disposes". Deterministic clamps the LLM cannot override: max position, net band, sector cap, beta cap, volatility cap, drawdown halving, gross cap, drawdown stop-out, ADV volume cap. Every clamp emits a ClampEvent (limit, before, after) for audit. Clamped exposure goes to cash, never redistributed.
- Scorecard: grades every analyst at its own horizon (hit rate vs benchmark, slugging, Spearman IC with t-stat); pending views are counted not graded.
- No debate. Analysts never see each other. Aggregation = arithmetic mean. Hash-chained ledger of sessions, PromptCache stores exact prompt+response, content-hash cache key.

### Weaknesses to avoid
1. Persona depth: ~30-line prompts, 3 sentences of output; no pre-mortem, no steelman, no dissent.
2. Signal-only: bullish/neutral/bearish plus confidence; no price target, no "what would change my mind", no sizing reasoning.
3. Averaging independent votes: no debate, no cross-examination, correlated LLM errors are not corrected.
4. Setup friction and cost: pipx install, Financial Datasets key (paid), separate LLM API key, TUI. We want zero keys.
5. Only fundamentals snapshot; Druckenmiller admits no macro/price data. Hard to give a macro or Taleb seat real evidence.
6. Single vendor, one data model tied to that vendor's ratio definitions.
7. Fake precision: confidence 0-100 from an LLM is uncalibrated.

### Elements worth adapting (7)
1. Pre-computed evidence pack: Python computes derived metrics (CAGR, averages, trends, YoY) so seats cite numbers instead of doing arithmetic; stable render format.
2. Persona = system prompt + checklist + signal rules + confidence scale + hard rules ("only data given, say insufficient, go neutral"). Add per-seat "too-hard pile / abstain" as first-class output.
3. `DataClient` protocol with "empty means no data, failure raises" contract, plus a caching decorator (history forever, same-day short TTL, quotes never).
4. Risk-after-conviction: deterministic post-verdict guardrails (position size cap, concentration, drawdown, liquidity) with an audit trail of each clamp; verdict says "council proposes, rules dispose".
5. Per-seat `horizon_days` and `investment_approach` metadata (Taleb/Marks may refuse to be long-only bullish; Buffett holds 10 years) so the Chair weighs time horizons.
6. Abstention excluded from averages and counted visibly; neutral still votes.
7. Content-hash of the data pack plus stored exact prompts/responses = reproducible, auditable session; optional later scorecard (hit rate at each seat's horizon) for tracking which legend is actually useful.
Bonus: "blind" mode (ticker withheld) as an optional bias test; disclaimer text from VISION.md.

### Proposed evidence packs per seat (quant checks, mapped from v1 memory + standard practice; mark thresholds as heuristics)
- Buffett: ROE 10y avg and min (>15%), ROIC, gross/op margin stability (stdev), D/E (<0.5), interest coverage, FCF/NI conversion, owner earnings, BVPS CAGR, share count trend, simple DCF (owner earnings, 10y, ~9-10% discount, 3% terminal) and margin of safety.
- Munger: same quality set + inversion list (falling margins, rising leverage, goodwill/assets, SBC/revenue, share dilution, insider selling), ROIC vs WACC spread, Beneish/accrual flag.
- Lynch: category by growth, PEG (<1 good, >2 bad), EPS growth consistency, inventory vs sales, D/E, insider buys.
- Graham: Graham Number sqrt(22.5 x EPS x BVPS), P/E <15, P/B <1.5 (P/E x P/B <22.5), current ratio >=2, net current asset value, positive EPS every year.
- Marks: price vs history percentiles (P/E, EV/EBITDA own 10y range), credit spread (FRED BAMLH0A0HYM2), yield curve, cycle position, "what is priced in" reverse DCF, downside case.
- Taleb: max drawdown, 1y/5y vol, return skew/kurtosis (from price history), leverage/fragility (net debt/EBITDA, interest coverage), concentration of revenue, position-size-vs-ruin check.
- Ackman: FCF yield, simple, predictable, dominant business flags, activism catalysts, leverage, EV/FCF.
- Kantesaria: ROIC, pricing power (gross margin trend), recurring revenue share, FCF yield, reinvestment runway, capital-light (capex/revenue).
- Macro seat: FRED/Treasury series (10y-2y, fed funds, CPI YoY, unemployment, HY OAS, VIX).
- Valuation seat: DCF with sensitivity grid, reverse DCF, multiples vs own history, analyst target/estimates when available.

---

## PART 2. Market data sources (as of 2026-11-17; web search snippets, mostly third-party; flag "verify" items)

| Source | Provides | Free tier | Key | Reliability / terms | Coverage |
|---|---|---|---|---|---|
| SEC EDGAR (data.sec.gov) | submissions, companyfacts XBRL (all us-gaap tags, history), frames (cross-company by tag/period), Form 4 (insider, XML), 13F-HR (holdings XML), full-text search, filings | Unlimited, fair-access ~10 req/s per IP | No key; REQUIRED descriptive User-Agent with contact | Very high; public domain; 403/429 and temporary IP block if UA missing or >10 rps. Companyfacts lags filings slightly; no prices | US filers (plus foreign 20-F/40-F, limited) |
| FRED | ~800k macro series (rates, CPI, unemployment, spreads, VIX, etc.) | Free key; rate limits at FRED's discretion (~120/min per third-party docs, unverified) | Free key (also keyless fredgraph.csv?id=SERIES widely used, unverified for 2026) | High. Terms prohibit storing/caching/archiving content with the API and giving cache to third parties; some series carry third-party copyright. Implication: cache only per-session in the user's own folder, do not bundle data | Mostly US plus some intl |
| Stooq | EOD OHLCV for US, UK, PL, JP, indices, FX | Free | As of March 2026 q/d/l CSV needs apikey obtained via captcha form (pandas-datareader issue #1012); daily hit limit message exists. Not zero-key any more | Medium; no SLA; personal use | Global-ish |
| Yahoo (yfinance, or direct v8 chart endpoint) | quotes, daily/intraday history, dividends/splits, ratios, statements, news, options | Free, unofficial, unpublished limits | No key (cookie/crumb for some endpoints) | Low-medium: frequent 429/YFRateLimitError, crumb failures, empty payloads in 2025-26. Unofficial scraping; ToS = personal use. Use only as best-effort fallback, with backoff | Global tickers (best global free coverage) |
| FMP | prices, statements (annual/quarterly), ratios, key metrics, estimates, insider, 13F, news, DCF, transcripts | Basic free: 250 calls/day, US only, limited history (verify) | Key | Good; paid roughly $20-140/mo per third-party (verify); redistribution restricted | Free US; paid adds global |
| Alpha Vantage | prices, fundamentals, news sentiment, macro, indicators | 25 req/day (5/min) | Key | Medium; free tier too small for a 10-seat council; premium from ~$50/mo | Global |
| Finnhub | quotes, basic financials/metrics, news, insider, estimates, filings | 60 calls/min | Key | Good; candles/some fundamentals premium (verify per endpoint, 403 = gated) | US free; global paid |
| Polygon -> Massive (api.massive.com) | prices, aggregates, tickers, news, some financials | Basic free: 5 calls/min, EOD, ~2y history | Key (old polygon keys work; api.polygon.io and api.massive.com in parallel; rebrand Oct 30 2025) | High quality; paid from ~$29/mo | US (stocks, options, FX, crypto) |
| Tiingo | EOD prices, IEX real-time, fundamentals, news | Free: 50 req/hr, 1000/day, 1 GB/mo; fundamentals free coverage limited (verify) | Key | Good, clean | US + some global |
| EODHD | EOD, fundamentals, intraday, bulk, news | 20 calls/day; fundamentals cost 10 calls each; 1y history | Key | Good; Fundamentals plan ~$60/mo | Very broad global |
| Nasdaq Data Link | Sharadar (SF1 fundamentals, SEP prices) paid; many free legacy sets; free WIKI prices frozen 2018 | Free key; conflicting limits 50/day anon vs 50k/day registered (verify) | Key | High for Sharadar (~$39/mo personal, verify). Legacy docs site retiring Aug 31 2026 | US |
| US Treasury | Daily par yield curve (home.treasury.gov XML/CSV), FiscalData (debt, rates, FX) | Free | No key (FiscalData optional key; ~1000/day/IP unconfirmed) | High, public domain | US |
| BLS | CPI, unemployment, payrolls, wages | v1 25 queries/day unregistered; v2 500/day registered | Free key for v2, renew yearly | High, public domain | US |

### Recommended zero-key default stack (US stocks)
| Need | Primary | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Fundamentals (income, balance, cash flow, shares) | SEC EDGAR companyfacts XBRL, normalized in adapter (revenue, NI, OCF, capex, debt, equity, shares) | Yahoo quoteSummary statements (best effort) | keyed vendor if configured |
| Quote and price history | Yahoo v8 chart endpoint (direct fetch, no crumb needed for chart in most cases, verify) | Stooq CSV (needs one-time user key; mark optional) | keyed vendor |
| Ratios | Computed locally from EDGAR statements + latest price (P/E, P/B, EV/EBITDA, FCF yield, ROE, ROIC, margins, D/E) so no vendor ratio definitions | Vendor ratios if keyed | |
| Insider trades | EDGAR Form 4 (parse XML via submissions index) | none | |
| Holdings | EDGAR 13F-HR (holders-of-ticker needs full-text/other; per-manager easy) | none | |
| Macro | FRED if key set; else keyless fredgraph.csv; else Treasury yield-curve CSV + BLS v1 | cached last-good | |
| News | none in zero-key mode (Yahoo RSS/Google News RSS optional, flag low trust) | keyed vendor | |
| Estimates | none zero-key (flag missing; valuation seat uses history-based DCF only) | keyed vendor | |

Degrade visibly: every datum in the pack carries `source`, `as_of`, `status` (ok | stale | fallback_used | missing | error) and `note`. The pack has a top-level `coverage` summary and `warnings[]`. Seats must cite pack ids, and the Chair's verdict page shows a "Data health" strip (e.g. prices: yahoo ok; fundamentals: EDGAR ok; macro: FRED missing, Treasury fallback). Missing data caps that seat's confidence and forces "insufficient evidence" language; never silently substitute training-data numbers. Follow ai-hedge-fund contract: empty = no data, infra failure = throw typed error that the router catches, records, and moves to the next provider.

### Adapter interface (plain ESM JS, Node 20, zero deps, JSDoc types)
```js
// providers/_contract.js
/** @typedef {{ok:boolean, source:string, asOf:string, fetchedAt:string, status:'ok'|'stale'|'fallback'|'missing'|'error', note?:string}} Meta */
export const CAPABILITIES = ['quote','priceHistory','financials','ratios','insiderTrades','holdings','macroSeries','news','estimates'];

export default {
  id: 'sec-edgar',
  name: 'SEC EDGAR',
  needsKey: false,            // env var name goes in keyEnv if true
  keyEnv: null,
  capabilities: ['financials','insiderTrades','holdings'],
  async getQuote(symbol) {},                      // -> {data:{symbol,price,currency,change,changePct,marketCap?,time}, meta}
  async getPriceHistory(symbol, {from,to,interval='1d'}) {}, // -> {data:[{t,o,h,l,c,v,adjC?}], meta}
  async getFinancials(symbol, {period='annual',limit=10}) {},
     // -> {data:{currency, periods:[{periodEnd,fiscalYear,form,filed,
     //      income:{revenue,grossProfit,operatingIncome,netIncome,eps,dilutedShares},
     //      balance:{cash,totalAssets,totalLiabilities,totalDebt,equity,currentAssets,currentLiabilities},
     //      cashflow:{operatingCF,capex,freeCashFlow,dividends,buybacks,sbc,da}}]}, meta}
  async getRatios(symbol, {period='ttm'}) {},     // -> {data:{peRatio,pbRatio,evEbitda,fcfYield,roe,roic,grossMargin,opMargin,netMargin,debtToEquity,currentRatio,interestCoverage,revenueGrowth,epsGrowth}, meta}  (adapter-supplied OR computed by shared lib/ratios.js)
  async getInsiderTrades(symbol, {from,to,limit}) {}, // -> {data:[{name,title,filed,txDate,type:'buy'|'sell'|'grant'|'other',shares,price,value,sharesAfter}], meta}
  async getHoldings(symbol|managerCik, {limit}) {},   // -> {data:[{holder,shares,value,pctChange,reportDate}], meta}
  async getMacroSeries(seriesId, {from,to}) {},       // -> {data:{id,title,units,frequency,obs:[{date,value}]}, meta}
  async getNews(symbol, {limit}) {},                  // -> {data:[{time,title,source,url,summary?}], meta}
  async getEstimates(symbol) {}                       // -> {data:{epsNextFY,revNextFY,targetMean,...}, meta}
};
```
Rules: methods a provider lacks are simply not listed in `capabilities`; the router (`lib/router.js`) walks the configured chain per capability, applies timeout (8s), retry with backoff on 429, token-bucket rate limiting per provider (SEC 8 rps with UA), and returns the first `ok`, else a `missing` record containing every attempt's error. `lib/cache.js` writes JSON to the session folder (and optionally a user-level cache dir for non-FRED data) with TTL: history/financials until next filing, quotes never.

### Data pack JSON (Chair writes to `sessions/<id>/data-pack.json`)
```json
{
  "schema": "council.datapack/1",
  "symbol": "AAPL", "asOf": "2026-11-17", "generatedAt": "...", "hash": "sha256:...",
  "coverage": {"quote":"ok","priceHistory":"ok","financials":"ok","ratios":"computed","insiderTrades":"ok","macro":"fallback","news":"missing","estimates":"missing"},
  "providers": [{"id":"sec-edgar","used":["financials","insiderTrades"],"status":"ok"},{"id":"yahoo","used":["quote","priceHistory"],"status":"ok"}],
  "warnings": ["No analyst estimates: valuation seat limited to history-based DCF"],
  "facts": [
    {"id":"F001","label":"Revenue FY2025","value":391035000000,"unit":"USD","period":"FY2025","source":"sec-edgar","asOf":"2025-11-01","url":"https://data.sec.gov/..."},
    {"id":"F014","label":"ROE 10y avg","value":0.31,"derived":true,"formula":"mean(netIncome/equity)","inputs":["F002","F003"]}
  ],
  "series": {"price":{"source":"yahoo","points":[...]}, "fcf":[...], "macro":{"DGS10":[...],"T10Y2Y":[...]}},
  "packs": {"buffett":["F001","F014"], "taleb":["F090","F091"], "macro":["F120"]},
  "userSuppliedContext": "thesis, position size, horizon, cost basis"
}
```
Seat instructions: cite facts as [F014]; any number not in the pack must be marked "outside the pack, unverified". The Chair validates citations after the debate (a simple regex check that every cited id exists and every number in the verdict is traceable) and flags uncited figures.

### User plug-in path (config + env + one adapter)
1. `council.config.json`:
```json
{ "providers": { "fundamentals": ["fmp","sec-edgar"], "prices": ["tiingo","yahoo"], "macro": ["fred","treasury"] },
  "custom": [{ "id": "myvendor", "module": "./providers/myvendor.js", "keyEnv": "MYVENDOR_API_KEY" }] }
```
2. Key via env var named in the adapter (`process.env[keyEnv]`), also read from a git-ignored `.env.local` by a 15-line loader; never written to session files; redact in logs.
3. One adapter file exporting the default object above, implementing only the methods it supports; `node scripts/check-provider.js myvendor AAPL` runs a contract test (shape validation with sample symbol) and prints pass/fail per capability.
Ship 1-2 templates (`providers/_template.js`).

### Paid adapters worth shipping (2 to 3)
1. Financial Modeling Prep: broadest single key (statements, ratios, estimates, insider, 13F, news); free tier exists for trying; good fit for fundamentals + estimates. Verify current endpoints (stable vs legacy) before coding.
2. Massive/Polygon or Tiingo: clean prices and news; Massive for US depth, Tiingo cheaper with fundamentals option.
3. EODHD: only if global coverage is a goal (broadest exchange list); otherwise skip. Finnhub as the free-key bonus adapter (60/min) for news, estimates and insider.

### Open items to verify before coding
- Stooq key requirement and quota (3rd-party reports only).
- Yahoo v8 chart endpoint keyless behaviour in late 2026 and ToS stance (not found).
- FRED keyless fredgraph.csv and caching rule applicability (official terms prohibit caching via the API).
- FMP free-tier endpoint list and current pricing (official page not retrieved).
- Tiingo free fundamentals ticker coverage; Finnhub endpoint gating; Nasdaq Data Link free limits.
- v1 per-agent thresholds listed from memory.

### Sources
- https://github.com/virattt/ai-hedge-fund (local clone, MIT)
- https://github.com/pydata/pandas-datareader/issues/1012 (Stooq key)
- https://fred.stlouisfed.org/docs/api/terms_of_use.html
- https://massive.com/knowledge-base/article/what-is-the-request-limit-for-massives-restful-apis
- https://api.tiingo.com/products/fundamental-data-api
- https://www.bls.gov/developers/api_FAQs.htm
- https://github.com/ranaroussi/yfinance/issues/2441
- https://site.financialmodelingprep.com/education/other/do-you-need-a-credit-card-to-use-financial-modeling-prep
- https://multiples.vc/compare/alpha-vantage-api-alternatives
- SEC fair access (10 rps, UA): reported by secondary guides only; confirm at sec.gov/os/accessing-edgar-data
