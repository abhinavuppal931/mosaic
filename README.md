# Mosaic

A council of investing legends for Claude Code. Bring an investment decision; thirteen simulated investors (Buffett, Munger, Damodaran, Marks, Taleb, Druckenmiller and Burry by default; Lynch, Ackman, Kantesaria, Sleep, Mauboussin and Tom Lee on call) argue it over three rounds from one shared, sourced fact sheet. A Chair returns a graded verdict that keeps the dissent, with a pre-mortem, kill criteria and a date to re-check, and remembers it for next time.

> **Mosaic grades how a decision was made. It is not investment advice.** Every seat is a simulation built from that investor's public work. It is not the person, is not affiliated with or endorsed by them, and does not speak for them. Verbatim quotes appear only with a source id. Mosaic grades your reasoning and decision process, never a security: no price targets (valuation is a range and "what the price implies"), and position sizing appears only as education about survivable loss. Numbers carry their as-of dates; verify them against the filings before acting.

## Why it is different

1. **One sourced fact sheet.** Every seat argues from the same `data-pack.json`. Every number has a fact id (`F014`), a source, an as-of date and a status. Missing data stays visibly missing, never filled in. A check script fails any cited fact id or quote that is not real.
2. **Real debate, dissent kept.** Seats answer each other's strongest argument. The verdict leads with where they disagree and keeps the minority report. No averaging into "hold".
3. **It remembers.** Each decision becomes a thesis journal entry with kill criteria and a re-check date. `/mosaic recheck NVDA` reruns a quick council on what changed since the last pack.
4. **Anti-sycophancy.** Round 1 seats do not know which way you lean. The lean is revealed in Round 2, and the verdict reports the **lean pull**: how far scores moved toward your lean after the reveal.

## Install

### As a Claude Code plugin (recommended)

In Claude Code:

```
/plugin marketplace add abhinavuppal931/mosaic
```

```
/plugin install mosaic@mosaic
```

On Claude Code 2.1.275 or later this also works in one step:

```
/plugin install mosaic --marketplace abhinavuppal931/mosaic
```

Then run `/mosaic` (or `/mosaic:mosaic` if another command already uses the name). Your sessions, journal and settings live in Claude Code's plugin data folder, which survives plugin updates.

### From a git clone

```bash
git clone https://github.com/abhinavuppal931/mosaic.git
```

```bash
cd mosaic && claude --plugin-dir .
```

`--plugin-dir .` loads the clone as the `mosaic` plugin for that session, so `/mosaic` and the seat agents work exactly as in the marketplace install. Sessions, the journal and `.env.local` stay inside the clone (all git-ignored). To keep it loaded without the flag, add the clone as a local marketplace once from inside Claude Code with `/plugin marketplace add ./` and then `/plugin install mosaic@mosaic`; a local marketplace loads the plugin in place, so `git pull` updates it.

Requirements: Claude Code and Node.js 20 or later. No npm install: Mosaic has zero dependencies.

## Use

```
/mosaic should I buy MSFT here? I'm leaning toward a full position because the selloff looks overdone
```

| Command | What it does |
|---|---|
| `/mosaic <decision, thesis, holdings or question>` | Full council: intake, data pack, three rounds, verdict, journal entry |
| `--quick` | Four seats including a guard; Round 3 only if the scores did not converge |
| `--seats buffett,taleb,marks` | Exactly those seats |
| `--all` | Everyone, capped at nine |
| `ask taleb <question>` | One seat, one answer |
| `board` | Change the default board, and whether the Chair asks, picks or uses the default |
| `recheck NVDA` | Quick council on what changed since the last verdict on NVDA |
| `journal` | Tracked theses, their verdicts and next re-check dates |
| `room` | Start the Room, the local app that plays the council live |

Mosaic handles four jobs: a **decision** on one ticker (buy, add, hold, trim, sell), a **thesis stress test** (pre-mortem and "I'm wrong if" conditions), a **portfolio review** (concentration, correlated bets and ruin exposure, as education) and a **macro question** (curve, policy rate, inflation, labor, credit).

Verdict labels grade the decision: **CONVICTION EARNED**, **PROCEED WITH CONDITIONS**, **RESHAPE THE THESIS**, **PASS**, plus **WAIT FOR THE PITCH** and **INSUFFICIENT EVIDENCE**. The math is in `skills/mosaic/references/scoring.md`.

## Data setup

### Zero-key default

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

The SEC asks every client to identify itself with a name and email. Once, in a terminal:

```bash
node data/cli.mjs setup
```

It asks for your name and email and saves them to `mosaic.config.json` in your Mosaic home (git-ignored, readable only by you). They are never taken from the command line, so they stay out of shell history. You can instead set `MOSAIC_SEC_CONTACT="Your Name you@example.com"` in your environment or in `.env.local`. In a plugin install, `/mosaic` asks on first run and saves it for you.

Try it:

```bash
node data/cli.mjs pack --ticker MSFT
```

```bash
node data/cli.mjs pack --macro
```

### Adding a key

Keys come only from environment variables or from `.env.local` in your Mosaic home. They are never written to packs, sessions or logs, and every request URL is redacted before it is logged.

| Provider | Variable | Free tier | Adds |
|---|---|---|---|
| FRED | `FRED_API_KEY` | Free key | High-yield spread, VIX, and a first source for every macro series |
| Financial Modeling Prep | `FMP_API_KEY` | About 250 calls a day, US | Estimates, news, a second source for prices and fundamentals |
| Finnhub | `FINNHUB_API_KEY` | 60 calls a minute | News, next earnings date, insider trades |
| Massive (Polygon) | `MASSIVE_API_KEY` or `POLYGON_API_KEY` | 5 calls a minute, end of day | Prices and news |
| BLS v2 | `BLS_API_KEY` | 500 queries a day | Longer, less rate-limited labor and inflation data |

Add a line such as `FRED_API_KEY=your-key` to `.env.local` (or export it in your shell), then check it:

```bash
node data/cli.mjs setup --status
```

```bash
node data/cli.mjs check-provider fred
```

`setup --status` prints which variables are set, never their values. `node data/cli.mjs providers` shows every provider and the order each capability is tried in.

### Changing the order of providers

`data/mosaic.config.json` holds the defaults: a chain per capability (first answer wins), per-provider rate limits, timeouts, retries and cache times. To override any part, put a `mosaic.config.json` in your Mosaic home; it is deep-merged over the defaults (arrays replace). Run `node data/cli.mjs paths` to see where your home is. For example, to prefer FMP for prices:

```json
{ "chains": { "quote": ["fmp", "yahoo"], "priceHistory": ["fmp", "yahoo"] } }
```

When a provider fails, the router moves to the next one and labels the result `fallback`; if every live provider fails, it serves the last good cached answer labelled `stale`; otherwise the data is `missing`. FRED responses are never cached (FRED's terms).

### Writing a custom adapter

1. Copy `data/providers/_template.mjs` to a file of your own, for example `myvendor.mjs` next to your `mosaic.config.json`. It needs no imports.
2. Set `id`, `name`, `needsKey`, `keyEnv` and `capabilities`, and implement one method per capability (`getQuote`, `getPriceHistory`, `getFinancials`, `getMacroSeries` and so on; the template lists the return shapes). Use `ctx.http` and `ctx.key`, never `fetch` or `process.env`, so rate limits, retries, timeouts and redaction apply. Return empty data when you have nothing; throw on failure.
3. Register it and put it in a chain:

   ```json
   {
     "custom": [{ "id": "myvendor", "module": "./myvendor.mjs" }],
     "chains": { "quote": ["myvendor", "yahoo"] }
   }
   ```

4. Run the contract test, which calls each capability once and checks the shapes:

   ```bash
   node data/cli.mjs check-provider myvendor --symbol AAPL
   ```

For macro series, map your series ids to Mosaic's canonical ids in `data/series.json`.

## How a council runs

1. **Intake**: the Chair classifies the job, builds the options (always including "don't act"), and asks once for anything missing. Your lean is recorded and withheld.
2. **Data pack**: `node data/cli.mjs pack` writes `data-pack.json` and a readable `data-pack.md` with a data-health table and per-seat evidence.
3. **Round 1, blind**: every seat answers in parallel on the evidence alone. A seat may say TOO HARD and abstain.
4. **Round 2, debate**: the lean is revealed; seats rebut each other, concede, and rescore.
5. **Draft and Round 3**: conditions, pre-mortem, kill criteria, re-check date; seats rescore the options and endorse, amend or dissent in their own words. Whether each seat agrees is derived from its scores.
6. **Verify**: `scripts/check-citations.mjs` checks every quote against the seat's brain and every fact id against the pack.
7. **Verdict**: `scripts/score.mjs` computes the label and the numbers; the Chair writes `verdict.md`, checks it with `check-citations.mjs` again, writes `verdict.json`, and journals it.

Session file formats (the contract the Room reads) are in `skills/mosaic/references/live-room.md`.

## Repository layout

```
.claude-plugin/          plugin.json and marketplace.json
skills/mosaic/           SKILL.md (the Chair's protocol) and references/
skills/mosaic/roster.json, skills/mosaic/brains/, agents/   seats, built by /newseat
data/                    providers/, router.mjs, packs/, lib/, cli.mjs, mosaic.config.json, series.json
scripts/                 score.mjs, check-citations.mjs, journal.mjs and their configs
tests/core/              node:test suite with recorded fixtures (no network)
```

## Tests

```bash
npm test
```

The core suite runs every adapter against recorded responses (no network), the router's fallbacks, retries, rate limits and cache, pack building, the scoring and label math, the citation checker and the journal. Live smoke packs built against the free sources are in `tests/core/fixtures/live/` with a note on what answered.

## Credits

Adapted from [Roast Room](https://github.com/nateherkai/roast-room) (MIT, AI Automation Society); see `NOTICE`. Ideas from [ai-hedge-fund](https://github.com/virattt/ai-hedge-fund) (MIT). Mosaic is MIT licensed.

---

Simulated council for education. Not financial advice. Seats are simulations built from public work; they are not the people and do not speak for them.
