# HTTP fixtures

Recorded responses the adapter tests replay through a fake `fetch`. Tests never touch the network.

| File | Origin |
|---|---|
| `sec-*.json`, `sec-*.xml` | Recorded from SEC EDGAR on 2026-11-17 (public domain), trimmed: ticker map to three rows, submissions to the forms the adapter reads, companyfacts to the tags in `data/providers/sec-edgar.tags.json` from 2015 on (one entry per period, latest filing), the 13F information table to eight rows. |
| `yahoo-chart-*.json` | Recorded from Yahoo's v8 chart endpoint on 2026-11-17. |
| `treasury-*.csv` | Recorded from home.treasury.gov (public domain). |
| `nyfed-effr.json` | Recorded from markets.newyorkfed.org, trimmed to 300 days. |
| `bls-v1-rate-limited.json` | A real BLS v1 response from 2026-11-17, when the shared IP had hit the daily keyless limit. |
| `bls-v1-<series>.json` | Rebuilt in BLS's response format from the values a live BLS v1 call returned on 2026-11-17 (BLS data is public domain). |
| `synthetic/*` | Made-up values in the exact field layout the live FRED, FMP, Massive and Finnhub APIs returned on 2026-11-17. No vendor data is stored, so nothing here is redistributed. |
