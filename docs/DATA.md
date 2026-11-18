# Data and keys

Mosaic works with no keys. Read this page to add a key or your own data source.

## Zero-key default

Out of the box Mosaic uses free sources only:

| Data | Source | Key |
|---|---|---|
| Fundamentals, 10 years plus trailing twelve months | SEC EDGAR XBRL company facts | None (a contact string, below) |
| Insider trades, 13F holdings by manager | SEC EDGAR Form 4 and 13F | None |
| Quote and daily price history | Yahoo chart endpoint (unofficial, best effort, labelled as such) | None |
| Treasury yield curve | US Treasury | None |
| Policy rate | New York Fed (effective fed funds) | None |
| CPI, unemployment, payrolls | BLS public API v1 (about 25 queries a day per IP) | None |
| Credit spreads, VIX | FRED | Free key |
| News, analyst estimates, short interest | Not available without a key: shown as missing | |

Ratios (P/E, ROIC, FCF yield, margins, leverage, reverse DCF and the rest) are computed locally from the filings, with the formula stored on every fact.

### SEC contact

The SEC asks every client to identify itself with a name and email. Once, in a terminal, inside the clone:

```bash
node data/cli.mjs setup
```

It asks for your name and email and saves them to `mosaic.config.json` in your Mosaic home (git-ignored, readable only by you). They are never taken from the command line, so they stay out of shell history. You can instead set `MOSAIC_SEC_CONTACT="Your Name you@example.com"` in your environment or in `.env.local`. In a plugin install, `/mosaic` asks on first run and saves it for you.

### Try it

Inside the clone:

```bash
node data/cli.mjs pack --ticker MSFT
```

```bash
node data/cli.mjs pack --macro
```

## Adding a key

Keys come only from environment variables or from `.env.local` in your Mosaic home. They are never written to packs, sessions or logs, and every request URL is redacted before it is logged.

| Provider | Variable | Free tier | Adds |
|---|---|---|---|
| FRED | `FRED_API_KEY` | Free key | High-yield spread, VIX, and a first source for every macro series |
| Financial Modeling Prep | `FMP_API_KEY` | About 250 calls a day, US | Estimates, news, a second source for prices and fundamentals |
| Finnhub | `FINNHUB_API_KEY` | 60 calls a minute | News, next earnings date, insider trades |
| Massive (Polygon) | `MASSIVE_API_KEY` or `POLYGON_API_KEY` | 5 calls a minute, end of day | Prices and news |
| BLS v2 | `BLS_API_KEY` | 500 queries a day | Longer, less rate-limited labor and inflation data |

Add a line such as `FRED_API_KEY=your-key` to `.env.local` in your Mosaic home (or export it in your shell), then check it, inside the clone:

```bash
node data/cli.mjs setup --status
```

```bash
node data/cli.mjs check-provider fred
```

`setup --status` prints which variables are set, never their values. `node data/cli.mjs providers` (inside the clone) shows every provider and the order each capability is tried in.

## Changing the order of providers

`data/mosaic.config.json` holds the defaults: a chain per capability (first answer wins), per-provider rate limits, timeouts, retries and cache times. To override any part, put a `mosaic.config.json` in your Mosaic home. It is deep-merged over the defaults (arrays replace). Run `node data/cli.mjs paths` (inside the clone) to see where your home is. For example, to prefer FMP for prices:

```json
{ "chains": { "quote": ["fmp", "yahoo"], "priceHistory": ["fmp", "yahoo"] } }
```

When a provider fails, the router moves to the next one and labels the result `fallback`. If every live provider fails, it serves the last good cached answer labelled `stale`. Otherwise the data is `missing`. FRED responses are never cached (FRED's terms).

## Writing a custom adapter

1. Copy `data/providers/_template.mjs` to a file of your own, for example `myvendor.mjs` next to your `mosaic.config.json`. It needs no imports.
2. Set `id`, `name`, `needsKey`, `keyEnv` and `capabilities`, and implement one method per capability (`getQuote`, `getPriceHistory`, `getFinancials`, `getMacroSeries` and so on; the template lists the return shapes). Use `ctx.http` and `ctx.key`, never `fetch` or `process.env`, so rate limits, retries, timeouts and redaction apply. Return empty data when you have nothing. Throw on failure.
3. Register it and put it in a chain:

   ```json
   {
     "custom": [{ "id": "myvendor", "module": "./myvendor.mjs" }],
     "chains": { "quote": ["myvendor", "yahoo"] }
   }
   ```

4. Run the contract test, inside the clone. It calls each capability once and checks the shapes:

   ```bash
   node data/cli.mjs check-provider myvendor --symbol AAPL
   ```

For macro series, map your series ids to Mosaic's canonical ids in `data/series.json`.

[Back to the README](../README.md)
