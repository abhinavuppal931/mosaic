# Live smoke packs (2026-11-17)

Built against the real free sources with every API key unset, the cache off, and a generic SEC contact string:

```bash
node data/cli.mjs pack --ticker MSFT --session tests/core/fixtures/live/msft --no-cache
node data/cli.mjs pack --macro --session tests/core/fixtures/live/macro --no-cache
```

`tests/core/live-packs.test.mjs` checks that both packs keep the pack contract (every fact has an id, key, source, as-of date and status; every gap is labelled; no secrets).

## Which sources answered

| Pack | Capability | Result |
|---|---|---|
| MSFT | profile, financials (10 fiscal years plus TTM to 2026-09-30), insider trades | SEC EDGAR ok. The insider read hit the 40-filing cap, and the provider note says so |
| MSFT | quote, price history, SPY benchmark | Yahoo chart endpoint ok (labelled best effort) |
| MSFT | macro context: 3-month, 2-year, 10-year Treasury; policy rate | Treasury ok; New York Fed (EFFR) ok; FRED skipped (no key) |
| MSFT | holdings, news, estimates, short interest, high-yield spread | **missing**, each with the reason in its fact note and in the data-health table |
| Macro | Treasury 3-month, 2-year, 10-year, 30-year; policy rate | Treasury ok; New York Fed ok |
| Macro | CPI, core CPI, unemployment, payrolls | BLS v1 (no key) ok |
| Macro | high-yield spread, VIX | **missing**: FRED skipped, no key |

MSFT: 135 facts, 6 missing, coverage 73%. Macro: 20 facts, 2 missing, coverage 82%.

## How failures were labelled

- **No key**: the router records `skipped (no key (FRED_API_KEY))` for that provider; the fact is `status: "missing"` with `value: null` and the note names the variable to set. Nothing is filled in.
- **EDGAR has no holders-by-ticker**: the adapter answers empty with a note ("EDGAR lists 13F holdings per manager; holders of one ticker need a keyed provider"), so `institutional_holders` is missing with that note.
- **BLS skipped a month**: there is no October 2025 CPI print (the 2025 shutdown), so the October 2026 year-over-year change cannot be computed. The pack compares September 2026 with September 2025 instead, says so in the fact's `period` ("2026-09 vs 2025-09") and `note`, and the as-of date is 2026-09-01.
- **BLS rate limit**: earlier the same day, two direct BLS v1 calls from this session's shared outbound IP were refused because the keyless daily quota was used up. The real response is recorded in `tests/core/fixtures/http/bls-v1-rate-limited.json`; the adapter raises a `rate_limit` error, the series is `status: "error"` with BLS's message in the note, and the pack warns. These two committed packs come from a run where BLS answered.

## Keyed adapters, checked live the same day

With keys present in the environment (values never printed), `node data/cli.mjs check-provider fmp --symbol MSFT` passed all eight FMP capabilities and `check-provider fred` passed. Their responses are not committed (vendor terms); the tests use synthetic fixtures in the same field layout.
