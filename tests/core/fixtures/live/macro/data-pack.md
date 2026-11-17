# Data pack: Macro

As of 2026-11-17 · generated 2026-11-17T12:05:33.769Z · 20 facts (2 missing) · coverage 82% · sha256:dacdf08677ac8764f6d945d7bd689086b8fdd0626ec4ff84bbde8e30444efba9

Seats cite facts as [F014]. A number that is not in this pack is outside the pack and unverified. MISSING means no configured source had it; it is never filled in.

## Data health

| Capability | Status | Source | As of | Note |
|---|---|---|---|---|
| macro:ust_3m | ok | treasury | 2026-11-16 | fred skipped, treasury ok |
| macro:ust_2y | ok | treasury | 2026-11-16 | fred skipped, treasury ok |
| macro:ust_10y | ok | treasury | 2026-11-16 | fred skipped, treasury ok |
| macro:ust_30y | ok | treasury | 2026-11-16 | fred skipped, treasury ok |
| macro:policy_rate | ok | nyfed | 2026-11-13 | fred skipped, nyfed ok |
| macro:cpi | ok | bls | 2026-10-01 | BLS API v1 (no key) |
| macro:core_cpi | ok | bls | 2026-10-01 | BLS API v1 (no key) |
| macro:unemployment | ok | bls | 2026-10-01 | BLS API v1 (no key) |
| macro:payrolls | ok | bls | 2026-10-01 | BLS API v1 (no key) |
| macro:hy_oas | missing | - | - | fred: skipped (no key (FRED_API_KEY)) |
| macro:vix | missing | - | - | fred: skipped (no key (FRED_API_KEY)) |

## Warnings

- Macro series hy_oas missing (fred: skipped (no key (FRED_API_KEY))).
- Macro series vix missing (fred: skipped (no key (FRED_API_KEY))).

## Facts

| Id | Fact | Value | Period | Source | As of | Status |
|---|---|---|---|---|---|---|
| F001 | 3-month Treasury yield | 4.34% | 2026-11-16 | treasury | 2026-11-16 | ok |
| F002 | 3-month Treasury yield, change over 12 months | +0.39 pts | 2025-11-14 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F003 | 2-year Treasury yield | 4.83% | 2026-11-16 | treasury | 2026-11-16 | ok |
| F004 | 2-year Treasury yield, change over 12 months | +1.21 pts | 2025-11-14 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F005 | 10-year Treasury yield | 5.12% | 2026-11-16 | treasury | 2026-11-16 | ok |
| F006 | 10-year Treasury yield, change over 12 months | +0.98 pts | 2025-11-14 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F007 | 30-year Treasury yield | 5.46% | 2026-11-16 | treasury | 2026-11-16 | ok |
| F008 | 30-year Treasury yield, change over 12 months | +0.72 pts | 2025-11-14 to 2026-11-16 | mosaic | 2026-11-16 | ok |
| F009 | Effective federal funds rate | 3.88% | 2026-11-13 | nyfed | 2026-11-13 | ok |
| F010 | Effective federal funds rate, change over 12 months | +0.00 pts | 2025-11-13 to 2026-11-13 | mosaic | 2026-11-13 | ok |
| F011 | Fed funds target range | 3.75 to 4 | 2026-11-13 | nyfed | 2026-11-13 | ok |
| F012 | CPI, all items, year-over-year change | 3.74% | 2026-09 vs 2025-09 | bls | 2026-09-01 | ok |
| F013 | Core CPI, less food and energy, year-over-year change | 2.56% | 2026-09 vs 2025-09 | bls | 2026-09-01 | ok |
| F014 | Unemployment rate | 4.10% | 2026-10-01 | bls | 2026-10-01 | ok |
| F015 | Nonfarm payrolls (thousands) | 159293 | 2026-10-01 | bls | 2026-10-01 | ok |
| F016 | High-yield credit spread (ICE BofA US HY OAS) | MISSING (fred: skipped (no key (FRED_API_KEY))) |  | - | - | missing |
| F017 | CBOE volatility index (VIX) | MISSING (fred: skipped (no key (FRED_API_KEY))) |  | - | - | missing |
| F018 | Yield curve: 10-year minus 2-year Treasury | +0.29 pts |  | mosaic | 2026-11-16 | ok |
| F019 | Yield curve: 10-year minus 3-month Treasury | +0.78 pts |  | mosaic | 2026-11-16 | ok |
| F020 | Real policy rate (policy rate minus CPI inflation) | +0.14 pts |  | mosaic | 2026-11-13 | ok |

## Notes

- F012 CPI, all items, year-over-year change: the latest 1 month(s) have no print a year earlier in the source, so the comparison uses 2026-09
- F013 Core CPI, less food and energy, year-over-year change: the latest 1 month(s) have no print a year earlier in the source, so the comparison uses 2026-09

## Formulas

- F002 3-month Treasury yield, change over 12 months: `ust_3m(latest) - ust_3m(one year earlier)` (inputs F001)
- F004 2-year Treasury yield, change over 12 months: `ust_2y(latest) - ust_2y(one year earlier)` (inputs F003)
- F006 10-year Treasury yield, change over 12 months: `ust_10y(latest) - ust_10y(one year earlier)` (inputs F005)
- F008 30-year Treasury yield, change over 12 months: `ust_30y(latest) - ust_30y(one year earlier)` (inputs F007)
- F010 Effective federal funds rate, change over 12 months: `policy_rate(latest) - policy_rate(one year earlier)` (inputs F009)
- F018 Yield curve: 10-year minus 2-year Treasury: `ust_10y - ust_2y` (inputs F005, F003)
- F019 Yield curve: 10-year minus 3-month Treasury: `ust_10y - ust_3m` (inputs F005, F001)
- F020 Real policy rate (policy rate minus CPI inflation): `policy_rate - cpi_yoy` (inputs F009, F012)

## Seat evidence

### buffett

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### munger

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### damodaran

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### marks

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### taleb

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### druckenmiller

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### burry

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### lynch

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### ackman

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### kantesaria

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### sleep

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### mauboussin

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

### tomlee

Facts: F001, F002, F003, F004, F005, F006, F007, F008, F009, F010, F011, F012, F013, F014, F015, F016, F017, F018, F019, F020 · coverage 90% · evidence cap: strong · missing: F016, F017

---
Simulated council for education. Not financial advice. Numbers as of the dates shown; verify against the filings.
