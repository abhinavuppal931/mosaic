# Data pack: MSFT

As of 2026-11-17 · generated 2026-11-17T12:05:29.225Z · 135 facts (6 missing) · coverage 73% · sha256:8a5155eec95fa85abf9f4de7314aae0dc5ffc678069d33743dd141b41ea57530

Seats cite facts as [F014]. A number that is not in this pack is outside the pack and unverified. MISSING means no configured source had it; it is never filled in.

## Data health

| Capability | Status | Source | As of | Note |
|---|---|---|---|---|
| profile | ok | sec-edgar | 2026-10-28 | sec-edgar ok |
| quote | ok | yahoo | 2026-11-16 | unofficial endpoint, best effort |
| priceHistory | ok | yahoo | 2026-11-16 | unofficial endpoint, best effort; adjC is split and dividend adjusted |
| financials | ok | sec-edgar | 2026-09-30 | sec-edgar ok |
| insiderTrades | ok | sec-edgar | 2026-11-16 | 40 Form 4 filings since 2025-11-17 (capped at 40; older filings in the window were not read) |
| holdings | missing | - | - | sec-edgar: empty (EDGAR lists 13F holdings per manager; holders of one ticker need a keyed provider) |
| news | missing | - | - | finnhub: skipped (no key (FINNHUB_API_KEY)); massive: skipped (no key (MASSIVE_API_KEY)); fmp: skipped (no key (FMP_API_KEY)) |
| estimates | missing | - | - | fmp: skipped (no key (FMP_API_KEY)); finnhub: skipped (no key (FINNHUB_API_KEY)) |
| benchmark | ok | yahoo | 2026-11-16 | unofficial endpoint, best effort; adjC is split and dividend adjusted |
| macro:ust_3m | ok | treasury | 2026-11-16 | fred skipped, treasury ok |
| macro:ust_2y | ok | treasury | 2026-11-16 | fred skipped, treasury ok |
| macro:ust_10y | ok | treasury | 2026-11-16 | fred skipped, treasury ok |
| macro:policy_rate | ok | nyfed | 2026-11-13 | fred skipped, nyfed ok |
| macro:hy_oas | missing | - | - | fred: skipped (no key (FRED_API_KEY)) |

## Warnings

- No news in the pack (needs a keyed provider such as Finnhub or FMP).
- No analyst estimates: valuation rests on reported history only.
- Macro series hy_oas missing (fred: skipped (no key (FRED_API_KEY))).

## Facts

| Id | Fact | Value | Period | Source | As of | Status |
|---|---|---|---|---|---|---|
| F001 | Company name | MICROSOFT CORP |  | sec-edgar | 2026-10-28 | ok |
| F002 | SEC CIK | 0000789019 |  | sec-edgar | 2026-10-28 | ok |
| F003 | Industry (SIC description) | Services-Prepackaged Software |  | sec-edgar | 2026-10-28 | ok |
| F004 | Fiscal year end (MMDD) | 0630 |  | sec-edgar | 2026-10-28 | ok |
| F005 | Share price | 517.99 USD | 2026-11-16T21:00:01.000Z | yahoo | 2026-11-16 | ok |
| F006 | Revenue | 346.44B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F007 | Gross profit | 234.39B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F008 | Operating income | 163.19B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F009 | Net income | 142.63B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F010 | Diluted EPS | 19.15 USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F011 | Interest expense | 3.22B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F012 | Research and development expense | 36.46B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F013 | Operating cash flow | 195.88B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F014 | Capital expenditure | 135.92B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F015 | Depreciation and amortization | 38.30B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F016 | Stock-based compensation | 12.56B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F017 | Dividends paid | 27.03B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F018 | Share repurchases | 21.00B USD | TTM to 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F019 | Cash and equivalents | 20.28B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F020 | Short-term investments | 44.23B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F021 | Total debt (long-term incl. current, plus short-term borrowings) | 35.48B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F022 | Shareholders equity | 470.51B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F023 | Total assets | 779.40B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F024 | Goodwill | 119.65B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F025 | Current assets | 186.14B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F026 | Current liabilities | 151.97B USD | as of 2026-09-30 | sec-edgar | 2026-09-30 | ok |
| F027 | Shares outstanding (cover page) | 7.43B shares | as of 2026-10-22 | sec-edgar | 2026-10-22 | ok |
| F028 | Market capitalization | 3.85T USD |  | mosaic | 2026-11-16 | ok |
| F029 | Enterprise value | 3.82T USD |  | mosaic | 2026-11-16 | ok |
| F030 | Free cash flow | 59.96B USD | TTM to 2026-09-30 | mosaic | 2026-09-30 | ok |
| F031 | Owner earnings (all capex treated as maintenance, conservative) | 45.01B USD | TTM to 2026-09-30 | mosaic | 2026-09-30 | ok |
| F032 | Price / earnings | 27.0x |  | mosaic | 2026-11-16 | ok |
| F033 | Price / book | 8.2x |  | mosaic | 2026-11-16 | ok |
| F034 | Price / sales | 11.1x |  | mosaic | 2026-11-16 | ok |
| F035 | EV / EBIT | 23.4x |  | mosaic | 2026-11-16 | ok |
| F036 | EV / EBITDA | 18.9x |  | mosaic | 2026-11-16 | ok |
| F037 | Free cash flow yield | 1.6% |  | mosaic | 2026-11-16 | ok |
| F038 | FCF yield after stock comp | 1.2% |  | mosaic | 2026-11-16 | ok |
| F039 | EV / free cash flow | 63.7x |  | mosaic | 2026-11-16 | ok |
| F040 | Owner earnings yield | 1.2% |  | mosaic | 2026-11-16 | ok |
| F041 | Dividend yield (cash paid / market cap) | 0.7% |  | mosaic | 2026-11-16 | ok |
| F042 | Buyback yield (repurchases / market cap) | 0.5% |  | mosaic | 2026-11-16 | ok |
| F043 | Return on equity | 30.3% |  | mosaic | 2026-09-30 | ok |
| F044 | Return on invested capital (after-tax operating income / (equity + debt - cash)) | 29.7% |  | mosaic | 2026-09-30 | ok |
| F045 | Gross margin | 67.7% |  | mosaic | 2026-09-30 | ok |
| F046 | Operating margin | 47.1% |  | mosaic | 2026-09-30 | ok |
| F047 | Net margin | 41.2% |  | mosaic | 2026-09-30 | ok |
| F048 | Free cash flow margin | 17.3% |  | mosaic | 2026-09-30 | ok |
| F049 | Debt / equity | 0.1x |  | mosaic | 2026-09-30 | ok |
| F050 | Net debt (negative means net cash) | -29.03B USD |  | mosaic | 2026-09-30 | ok |
| F051 | Net debt / EBITDA | -0.1x |  | mosaic | 2026-09-30 | ok |
| F052 | Interest coverage (EBIT / interest) | 50.6x |  | mosaic | 2026-09-30 | ok |
| F053 | Current ratio | 1.2x |  | mosaic | 2026-09-30 | ok |
| F054 | FCF / net income | 0.4x |  | mosaic | 2026-09-30 | ok |
| F055 | Stock comp / revenue | 3.6% |  | mosaic | 2026-09-30 | ok |
| F056 | Goodwill / total assets | 15.4% |  | mosaic | 2026-09-30 | ok |
| F057 | Accruals ratio ((net income - operating cash flow) / assets) | -6.8% |  | mosaic | 2026-09-30 | ok |
| F058 | Capex / revenue | 39.2% |  | mosaic | 2026-09-30 | ok |
| F059 | R&D / revenue | 10.5% |  | mosaic | 2026-09-30 | ok |
| F060 | Fiscal years of financials in the pack | 10 | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F061 | Return on equity, average over 10 fiscal years | 33.9% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F062 | Return on equity, lowest fiscal year of 10 | 20.0% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F063 | ROIC, average over 10 fiscal years | 60.4% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F064 | Gross margin, standard deviation across fiscal years | 1.8% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F065 | Gross margin change, latest minus oldest fiscal year | 3.4% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F066 | Operating margin, standard deviation across fiscal years | 5.9% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F067 | Operating margin change, latest minus oldest fiscal year | 16.7% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F068 | Operating margin, best fiscal year | 46.8% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F069 | Revenue CAGR, last 5 fiscal years | 14.6% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F070 | Revenue CAGR, last 9 fiscal years | 14.7% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F071 | Diluted EPS CAGR, last 5 fiscal years | 17.4% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F072 | Free cash flow CAGR, last 5 fiscal years | 3.6% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F073 | Book value per share CAGR, last 9 fiscal years | 20.4% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F074 | Diluted share count change, last 5 fiscal years | -2.0% | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F075 | Revenue growth, latest fiscal year | 17.8% | FY2026 vs FY2025 | mosaic | 2026-06-30 | ok |
| F076 | Revenue growth acceleration (latest FY growth minus prior FY growth) | 2.9% | FY2026 vs FY2025 | mosaic | 2026-06-30 | ok |
| F077 | Diluted EPS growth, latest fiscal year | 31.6% | FY2026 vs FY2025 | mosaic | 2026-06-30 | ok |
| F078 | Receivables growth minus revenue growth, latest fiscal year | -2.1% | FY2026 vs FY2025 | mosaic | 2026-06-30 | ok |
| F079 | Inventory growth minus revenue growth, latest fiscal year | 31.1% | FY2026 vs FY2025 | mosaic | 2026-06-30 | ok |
| F080 | FCF / net income, average of last 5 fiscal years | 0.8x | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F081 | Sales to capital, last 5 fiscal years (revenue added / invested capital added) | 0.5x | 2017 to 2026 | mosaic | 2026-06-30 | ok |
| F082 | Daily price points in the pack | 2512 | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F083 | Total return, last 12 months | 2.4% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F084 | Total return, last 6 months | 22.8% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F085 | Total return, last 3 years, annualized | 12.7% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F086 | Total return, last 5 years, annualized | 9.7% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F087 | 52-week high close | 555.80 USD | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F088 | 52-week low close | 352.83 USD | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F089 | Distance below the 52-week high | -6.8% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F090 | Maximum drawdown over the price history | -37.1% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F091 | Current drawdown from the all-history peak | -6.8% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F092 | Volatility, last 12 months (annualized) | 33.6% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F093 | Volatility, last 5 years (annualized) | 28.3% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F094 | Skew of daily returns, last 5 years | 0.381 | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F095 | Excess kurtosis of daily returns, last 5 years (0 = normal tails) | 6.004 | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F096 | Worst one-day return, last 5 years | -10.0% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F097 | Price versus its 200-day average | 17.5% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F098 | Where today's price sits in its own history (0 = lowest, 1 = highest) | 98.2% | 2016-11-17 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F099 | 12-month return minus SPY 12-month return | -8.9% |  | mosaic | 2026-11-16 | ok |
| F100 | Today's P/E against P/E at each past fiscal year end (0 = cheapest, 1 = richest) | 40.0% |  | mosaic | 2026-11-16 | ok |
| F101 | Median P/E at past fiscal year ends | 34.4x |  | mosaic | 2026-06-30 | ok |
| F102 | PEG (P/E divided by 5-year EPS growth in percent) | 1.6x |  | mosaic | 2026-11-16 | ok |
| F103 | Growth category by 5-year EPS growth (heuristic) | stalwart |  | mosaic | 2026-06-30 | ok |
| F104 | DCF value per share, bear case (FCF growth 7.3%) | 182.73 USD |  | mosaic | 2026-10-22 | ok |
| F105 | DCF value per share, base case (FCF growth 14.6%) | 316.90 USD |  | mosaic | 2026-10-22 | ok |
| F106 | DCF value per share, bull case (FCF growth 21.9%) | 545.13 USD |  | mosaic | 2026-10-22 | ok |
| F107 | Price / DCF base-case value | 1.6x |  | mosaic | 2026-11-16 | ok |
| F108 | What the price implies: annual FCF growth for 10 years at a 9% discount rate | 21.1% |  | mosaic | 2026-11-16 | ok |
| F109 | Implied FCF growth at a 8% discount rate | 18.4% |  | mosaic | 2026-11-16 | ok |
| F110 | Implied FCF growth at a 10% discount rate | 23.5% |  | mosaic | 2026-11-16 | ok |
| F111 | Implied FCF growth minus the company's own revenue CAGR | 6.4% |  | mosaic | 2026-11-16 | ok |
| F112 | Insider open-market purchases (count) | 0 | last 365 days | sec-edgar | 2026-11-16 | ok |
| F113 | Insider open-market purchases (value) | 0 USD | last 365 days | sec-edgar | 2026-11-16 | ok |
| F114 | Insider open-market sales (count) | 20 | last 365 days | sec-edgar | 2026-11-16 | ok |
| F115 | Insider open-market sales (value) | 2.7M USD | last 365 days | sec-edgar | 2026-11-16 | ok |
| F116 | Insider net open-market buying (buys minus sells) | -2.7M USD | last 365 days | mosaic | 2026-11-16 | ok |
| F117 | Short interest (% of float) | MISSING (no configured provider supplies short interest) |  | - | - | missing |
| F118 | Top institutional holders | MISSING (sec-edgar: empty (EDGAR lists 13F holdings per manager; holders of one ticker need a keyed provider)) |  | - | - | missing |
| F119 | Consensus EPS, next fiscal year | MISSING (fmp: skipped (no key (FMP_API_KEY)); finnhub: skipped (no key (FINNHUB_API_KEY))) |  | - | - | missing |
| F120 | Consensus revenue, next fiscal year | MISSING (fmp: skipped (no key (FMP_API_KEY)); finnhub: skipped (no key (FINNHUB_API_KEY))) |  | - | - | missing |
| F121 | Price / next fiscal year consensus EPS | MISSING (input missing: F119) |  | mosaic | 2026-11-16 | missing |
| F122 | Last 10-K or 10-Q filed | 2026-10-28 | 10-Q for period 2026-09-30 | sec-edgar | 2026-10-28 | ok |
| F123 | Next quarterly report, expected (from filing cadence) | 2027-01-27 |  | mosaic | 2026-10-28 | ok |
| F124 | 3-month Treasury yield | 4.34% | 2026-11-16 | treasury | 2026-11-16 | ok |
| F125 | 3-month Treasury yield, change over 12 months | +0.39 pts | 2025-11-14 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F126 | 2-year Treasury yield | 4.83% | 2026-11-16 | treasury | 2026-11-16 | ok |
| F127 | 2-year Treasury yield, change over 12 months | +1.21 pts | 2025-11-14 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F128 | 10-year Treasury yield | 5.12% | 2026-11-16 | treasury | 2026-11-16 | ok |
| F129 | 10-year Treasury yield, change over 12 months | +0.98 pts | 2025-11-14 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F130 | Effective federal funds rate | 3.88% | 2026-11-13 | nyfed | 2026-11-13 | ok |
| F131 | Effective federal funds rate, change over 12 months | +0.00 pts | 2025-11-13 to 2026-11-13 | mosaic | 2026-11-13 | ok |
| F132 | Fed funds target range | 3.75 to 4 | 2026-11-13 | nyfed | 2026-11-13 | ok |
| F133 | High-yield credit spread (ICE BofA US HY OAS) | MISSING (fred: skipped (no key (FRED_API_KEY))) |  | - | - | missing |
| F134 | Yield curve: 10-year minus 2-year Treasury | +0.29 pts |  | mosaic | 2026-11-16 | ok |
| F135 | Yield curve: 10-year minus 3-month Treasury | +0.78 pts |  | mosaic | 2026-11-16 | ok |

## Notes

- F031 Owner earnings (all capex treated as maintenance, conservative): Total capex is used because maintenance capex is not disclosed; growth capex makes this understate owner earnings.
- F090 Maximum drawdown over the price history: peak 2021-11-19, trough 2022-11-03
- F104 DCF value per share, bear case (FCF growth 7.3%): A range for debate, not a price target.
- F105 DCF value per share, base case (FCF growth 14.6%): A range for debate, not a price target.
- F106 DCF value per share, bull case (FCF growth 21.9%): A range for debate, not a price target.
- F123 Next quarterly report, expected (from filing cadence): An estimate from past filing dates, not an announced date.

## Formulas

- F028 Market capitalization: `price x shares_outstanding` (inputs F005, F027)
- F029 Enterprise value: `market_cap + total_debt - cash - short_term_investments` (inputs F028, F021, F019, F020)
- F030 Free cash flow: `operating_cash_flow - capex` (inputs F013, F014)
- F031 Owner earnings (all capex treated as maintenance, conservative): `net_income + depreciation_amortization - capex` (inputs F009, F015, F014). Total capex is used because maintenance capex is not disclosed; growth capex makes this understate owner earnings.
- F032 Price / earnings: `price / eps_diluted` (inputs F005, F010)
- F033 Price / book: `market_cap / equity` (inputs F028, F022)
- F034 Price / sales: `market_cap / revenue` (inputs F028, F006)
- F035 EV / EBIT: `enterprise_value / operating_income` (inputs F029, F008)
- F036 EV / EBITDA: `enterprise_value / (operating_income + depreciation_amortization)` (inputs F029, F008, F015)
- F037 Free cash flow yield: `free_cash_flow / market_cap` (inputs F030, F028)
- F038 FCF yield after stock comp: `(free_cash_flow - sbc) / market_cap` (inputs F030, F016, F028)
- F039 EV / free cash flow: `enterprise_value / free_cash_flow` (inputs F029, F030)
- F040 Owner earnings yield: `owner_earnings / market_cap` (inputs F031, F028)
- F041 Dividend yield (cash paid / market cap): `dividends_paid / market_cap` (inputs F017, F028)
- F042 Buyback yield (repurchases / market cap): `buybacks / market_cap` (inputs F018, F028)
- F043 Return on equity: `net_income / equity` (inputs F009, F022)
- F044 Return on invested capital (after-tax operating income / (equity + debt - cash)): `operating_income x (1 - tax_rate) / (equity + total_debt - cash - short_term_investments); tax_rate = income_tax / (net_income + income_tax), clamped 0 to 0.35` (inputs F008, F009, F022, F021, F019)
- F045 Gross margin: `gross_profit / revenue` (inputs F007, F006)
- F046 Operating margin: `operating_income / revenue` (inputs F008, F006)
- F047 Net margin: `net_income / revenue` (inputs F009, F006)
- F048 Free cash flow margin: `free_cash_flow / revenue` (inputs F030, F006)
- F049 Debt / equity: `total_debt / equity` (inputs F021, F022)
- F050 Net debt (negative means net cash): `total_debt - cash - short_term_investments` (inputs F021, F019, F020)
- F051 Net debt / EBITDA: `net_debt / (operating_income + depreciation_amortization)` (inputs F050, F008, F015)
- F052 Interest coverage (EBIT / interest): `operating_income / interest_expense` (inputs F008, F011)
- F053 Current ratio: `current_assets / current_liabilities` (inputs F025, F026)
- F054 FCF / net income: `free_cash_flow / net_income` (inputs F030, F009)
- F055 Stock comp / revenue: `sbc / revenue` (inputs F016, F006)
- F056 Goodwill / total assets: `goodwill / total_assets` (inputs F024, F023)
- F057 Accruals ratio ((net income - operating cash flow) / assets): `(net_income - operating_cash_flow) / total_assets` (inputs F009, F013, F023)
- F058 Capex / revenue: `capex / revenue` (inputs F014, F006)
- F059 R&D / revenue: `rd_expense / revenue` (inputs F012, F006)
- F060 Fiscal years of financials in the pack: `count(annual periods)` (inputs series:annual)
- F061 Return on equity, average over 10 fiscal years: `mean(net_income / equity) per fiscal year` (inputs series:annual)
- F062 Return on equity, lowest fiscal year of 10: `min(net_income / equity) per fiscal year` (inputs series:annual)
- F063 ROIC, average over 10 fiscal years: `mean(roic) per fiscal year` (inputs series:annual)
- F064 Gross margin, standard deviation across fiscal years: `stdev(gross_profit / revenue) per fiscal year` (inputs series:annual)
- F065 Gross margin change, latest minus oldest fiscal year: `gross_margin(latest FY) - gross_margin(oldest FY)` (inputs series:annual)
- F066 Operating margin, standard deviation across fiscal years: `stdev(operating_income / revenue) per fiscal year` (inputs series:annual)
- F067 Operating margin change, latest minus oldest fiscal year: `operating_margin(latest FY) - operating_margin(oldest FY)` (inputs series:annual)
- F068 Operating margin, best fiscal year: `max(operating_income / revenue) per fiscal year` (inputs series:annual)
- F069 Revenue CAGR, last 5 fiscal years: `(revenue_latest / revenue_5y_ago)^(1/5) - 1` (inputs series:annual)
- F070 Revenue CAGR, last 9 fiscal years: `(revenue_latest / revenue_9y_ago)^(1/9) - 1` (inputs series:annual)
- F071 Diluted EPS CAGR, last 5 fiscal years: `(eps_latest / eps_5y_ago)^(1/5) - 1; null if either is not positive` (inputs series:annual)
- F072 Free cash flow CAGR, last 5 fiscal years: `(fcf_latest / fcf_5y_ago)^(1/5) - 1; null if either is not positive` (inputs series:annual)
- F073 Book value per share CAGR, last 9 fiscal years: `CAGR of equity / diluted shares` (inputs series:annual)
- F074 Diluted share count change, last 5 fiscal years: `diluted_shares_latest / diluted_shares_5y_ago - 1 (negative means buybacks shrank the count)` (inputs series:annual)
- F075 Revenue growth, latest fiscal year: `revenue(latest FY) / revenue(prior FY) - 1` (inputs series:annual)
- F076 Revenue growth acceleration (latest FY growth minus prior FY growth): `revenue_growth(latest FY) - revenue_growth(prior FY)` (inputs series:annual)
- F077 Diluted EPS growth, latest fiscal year: `eps(latest FY) / eps(prior FY) - 1; null if prior EPS not positive` (inputs series:annual)
- F078 Receivables growth minus revenue growth, latest fiscal year: `receivables_growth(latest FY) - revenue_growth(latest FY)` (inputs series:annual)
- F079 Inventory growth minus revenue growth, latest fiscal year: `inventory_growth(latest FY) - revenue_growth(latest FY)` (inputs series:annual)
- F080 FCF / net income, average of last 5 fiscal years: `mean(free_cash_flow / net_income), last 5 FY` (inputs series:annual)
- F081 Sales to capital, last 5 fiscal years (revenue added / invested capital added): `delta revenue / delta (equity + debt - cash)` (inputs series:annual)
- F082 Daily price points in the pack: `count(daily closes)` (inputs series:price)
- F083 Total return, last 12 months: `adjusted close now / adjusted close 365 days ago - 1` (inputs series:price)
- F084 Total return, last 6 months: `adjusted close now / adjusted close 182 days ago - 1` (inputs series:price)
- F085 Total return, last 3 years, annualized: `(1 + 3y return)^(1/3) - 1` (inputs series:price)
- F086 Total return, last 5 years, annualized: `(1 + 5y return)^(1/5) - 1` (inputs series:price)
- F087 52-week high close: `max(close), last 365 days` (inputs series:price)
- F088 52-week low close: `min(close), last 365 days` (inputs series:price)
- F089 Distance below the 52-week high: `last close / 52-week high - 1` (inputs series:price)
- F090 Maximum drawdown over the price history: `min(adjusted close / running peak - 1)` (inputs series:price). peak 2021-11-19, trough 2022-11-03
- F091 Current drawdown from the all-history peak: `last adjusted close / max(adjusted close) - 1` (inputs series:price)
- F092 Volatility, last 12 months (annualized): `stdev(daily log returns) x sqrt(252), last 365 days` (inputs series:price)
- F093 Volatility, last 5 years (annualized): `stdev(daily log returns) x sqrt(252), last 5 years` (inputs series:price)
- F094 Skew of daily returns, last 5 years: `sample skewness of daily log returns` (inputs series:price)
- F095 Excess kurtosis of daily returns, last 5 years (0 = normal tails): `sample excess kurtosis of daily log returns` (inputs series:price)
- F096 Worst one-day return, last 5 years: `min(daily return), last 5 years` (inputs series:price)
- F097 Price versus its 200-day average: `adjusted close / mean(last 200 adjusted closes) - 1` (inputs series:price)
- F098 Where today's price sits in its own history (0 = lowest, 1 = highest): `share of daily adjusted closes at or below today` (inputs series:price)
- F099 12-month return minus SPY 12-month return: `return_1y - SPY return_1y` (inputs series:price, series:SPY)
- F100 Today's P/E against P/E at each past fiscal year end (0 = cheapest, 1 = richest): `share of fiscal-year-end P/Es (close on FY end / FY diluted EPS) at or below today's P/E` (inputs F032, series:annual, series:price)
- F101 Median P/E at past fiscal year ends: `median(close on FY end / FY diluted EPS)` (inputs series:annual, series:price)
- F102 PEG (P/E divided by 5-year EPS growth in percent): `pe / (eps_cagr_5y x 100)` (inputs F032, F071)
- F103 Growth category by 5-year EPS growth (heuristic): `eps_cagr_5y >= 0.2 fast; >= 0.1 stalwart; >= 0 slow; below that shrinking` (inputs F071)
- F104 DCF value per share, bear case (FCF growth 7.3%): `FCF DCF: growth = clamp(revenue_cagr_5y x 0.5, 0, 0.25); 10 years of FCF growth then 2.5% forever, discounted at 9%` (inputs F030, F027, F069). A range for debate, not a price target.
- F105 DCF value per share, base case (FCF growth 14.6%): `FCF DCF: growth = clamp(revenue_cagr_5y x 1, 0, 0.25); 10 years of FCF growth then 2.5% forever, discounted at 9%` (inputs F030, F027, F069). A range for debate, not a price target.
- F106 DCF value per share, bull case (FCF growth 21.9%): `FCF DCF: growth = clamp(revenue_cagr_5y x 1.5, 0, 0.25); 10 years of FCF growth then 2.5% forever, discounted at 9%` (inputs F030, F027, F069). A range for debate, not a price target.
- F107 Price / DCF base-case value: `price / dcf_value_base` (inputs F005, F105)
- F108 What the price implies: annual FCF growth for 10 years at a 9% discount rate: `solve g: DCF(free_cash_flow, g, 10y, terminal 0.025, r 0.09) = enterprise_value` (inputs F029, F030)
- F109 Implied FCF growth at a 8% discount rate: `same as implied_fcf_growth with r = 0.08` (inputs F029, F030)
- F110 Implied FCF growth at a 10% discount rate: `same as implied_fcf_growth with r = 0.1` (inputs F029, F030)
- F111 Implied FCF growth minus the company's own revenue CAGR: `implied_fcf_growth - revenue_cagr_10y (or 5y when 10y is missing)` (inputs F108, F070, F069)
- F116 Insider net open-market buying (buys minus sells): `sum(purchase value) - sum(sale value); grants, exercises and tax withholding excluded` (inputs F113, F115)
- F123 Next quarterly report, expected (from filing cadence): `last periodic filing date + median days between the last periodic filings` (inputs F122). An estimate from past filing dates, not an announced date.
- F125 3-month Treasury yield, change over 12 months: `ust_3m(latest) - ust_3m(one year earlier)` (inputs F124)
- F127 2-year Treasury yield, change over 12 months: `ust_2y(latest) - ust_2y(one year earlier)` (inputs F126)
- F129 10-year Treasury yield, change over 12 months: `ust_10y(latest) - ust_10y(one year earlier)` (inputs F128)
- F131 Effective federal funds rate, change over 12 months: `policy_rate(latest) - policy_rate(one year earlier)` (inputs F130)
- F134 Yield curve: 10-year minus 2-year Treasury: `ust_10y - ust_2y` (inputs F128, F126)
- F135 Yield curve: 10-year minus 3-month Treasury: `ust_10y - ust_3m` (inputs F128, F124)

## Seat evidence

### buffett

Facts: F043, F061, F062, F044, F063, F046, F066, F064, F049, F052, F054, F080, F031, F040, F073, F074, F104, F105, F106, F107, F032 · coverage 100% · evidence cap: strong

- [pass] Average ROE of 15% or more across the record (F061 = 0.339, heuristic)
- [pass] No fiscal year with ROE below 10% (F062 = 0.200, heuristic)
- [pass] Debt below half of equity (F049 = 0.075, heuristic)
- [pass] Operating margin of 15% or more (F046 = 0.471, heuristic)
- [fail] Steady operating margins (stdev under 5 points) (F066 = 0.059, heuristic)
- [fail] Earnings turn into cash (FCF at least 80% of net income) (F080 = 0.752, heuristic)
- [fail] Price below the base-case DCF value (F107 = 1.635, heuristic)

### munger

Facts: F044, F063, F061, F065, F067, F049, F056, F055, F074, F057, F116, F078, F032, F108 · coverage 100% · evidence cap: strong

- [pass] Gross margin not eroding over the record (F065 = 0.034, heuristic)
- [pass] Operating margin not eroding over the record (F067 = 0.167, heuristic)
- [pass] Goodwill under 30% of assets (growth not bought) (F056 = 0.154, heuristic)
- [pass] Stock comp under 5% of revenue (F055 = 0.036, heuristic)
- [pass] No meaningful dilution over five years (F074 = -0.020, heuristic)
- [pass] Earnings backed by cash (low accruals) (F057 = -0.068, heuristic)

### damodaran

Facts: F108, F109, F110, F069, F070, F046, F067, F081, F044, F104, F105, F106, F107, F035, F034, F032, F121, F128 · coverage 94% · evidence cap: strong · missing: F121

- [fail] Price implies no more growth than the company has delivered (F111 = 0.064, heuristic)
- [fail] Price at or below the base-case value (F107 = 1.635, heuristic)

### marks

Facts: F098, F100, F101, F032, F091, F083, F108, F133, F134, F135, F130, F090 · coverage 92% · evidence cap: strong · missing: F133

- [pass] P/E in the cheaper half of its own history (F100 = 0.400, heuristic)
- [fail] Price not at the top tenth of its own history (F098 = 0.982, heuristic)

### taleb

Facts: F090, F091, F092, F093, F094, F095, F096, F051, F052, F049, F053, F050 · coverage 100% · evidence cap: strong

- [pass] Net debt under two years of EBITDA (F051 = -0.144, heuristic)
- [pass] EBIT covers interest at least eight times (F052 = 50.633, heuristic)
- [pass] History shows no fall worse than 60% (F090 = -0.371, heuristic)
- [pass] Daily return tails not extreme (excess kurtosis under 10) (F095 = 6.004, heuristic)

### druckenmiller

Facts: F134, F135, F130, F131, F128, F129, F133, F097, F084, F083, F099, F075, F076, F077, F123 · coverage 93% · evidence cap: strong · missing: F133

- [pass] Price above its 200-day average (trend intact) (F097 = 0.175, heuristic)
- [pass] Revenue growth accelerating (F076 = 0.029, heuristic)
- [fail] Beating the market over 12 months (F099 = -0.089, heuristic)

### burry

Facts: F037, F038, F035, F050, F057, F074, F055, F116, F112, F117, F078, F079, F098, F091 · coverage 93% · evidence cap: strong · missing: F117

- [fail] FCF yield of 8% or more (F037 = 0.016, heuristic)
- [fail] EV/EBIT under 7 (F035 = 23.394, heuristic)
- [pass] Low accruals (no earnings quality red flag) (F057 = -0.068, heuristic)
- [pass] Receivables not outrunning revenue by 10 points (F078 = -0.021, heuristic)

### lynch

Facts: F103, F071, F077, F075, F032, F102, F049, F079, F112, F116 · coverage 100% · evidence cap: strong

- [fail] PEG under 1 (F102 = 1.555, heuristic)
- [pass] PEG under 2 (F102 = 1.555, heuristic)
- [fail] Inventory not piling up faster than sales (F079 = 0.311, heuristic)

### ackman

Facts: F037, F039, F044, F046, F068, F051, F042, F041, F116, F098, F091 · coverage 100% · evidence cap: strong

- [fail] FCF yield of 4% or more (F037 = 0.016, heuristic)
- [pass] Net debt under three years of EBITDA (F051 = -0.144, heuristic)

### kantesaria

Facts: F044, F063, F045, F065, F064, F058, F059, F048, F038, F055, F091, F098 · coverage 100% · evidence cap: strong

- [pass] Average ROIC of 20% or more (F063 = 0.604, heuristic)
- [pass] Gross margin holding or rising (pricing power) (F065 = 0.034, heuristic)
- [fail] Capital light (capex under 10% of revenue) (F058 = 0.392, heuristic)
- [pass] No heavy R&D dependence (under 15% of revenue) (F059 = 0.105, heuristic)

### sleep

Facts: F070, F069, F065, F067, F058, F059, F063, F074, F060 · coverage 100% · evidence cap: strong

- [pass] Revenue compounding at 10% or more over the record (F070 = 0.147, heuristic)
- [pass] Owners not diluted (F074 = -0.020, heuristic)

### mauboussin

Facts: F108, F109, F110, F111, F069, F070, F072, F044, F063, F092, F090 · coverage 100% · evidence cap: strong

- [fail] Expectations in the price at or below the company's own record (F111 = 0.064, heuristic)

### tomlee

Facts: F083, F084, F099, F097, F075, F076, F130, F134 · coverage 100% · evidence cap: strong

- [fail] Leading the market over 12 months (F099 = -0.089, heuristic)
- [pass] Growth accelerating (F076 = 0.029, heuristic)

---
Simulated council for education. Not financial advice. Numbers as of the dates shown; verify against the filings.
