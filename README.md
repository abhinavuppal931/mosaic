<div align="center">

<!-- HERO: replaced in ABH-339 phase 2 -->
<!-- <img src="docs/hero.png" alt="The Mosaic Room playing a council live: thirteen investor seats, a debate in progress and the verdict panel" width="860"> -->

# Mosaic

**Bring an investment decision. Thirteen simulated investing legends debate it from one sourced fact sheet and return a graded verdict that keeps the dissent.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![dependencies: zero](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)](package.json)
[![Claude Code: plugin](https://img.shields.io/badge/Claude%20Code-plugin-orange.svg)](#quick-start)
[![CI](https://github.com/abhinavuppal931/mosaic/actions/workflows/test.yml/badge.svg)](https://github.com/abhinavuppal931/mosaic/actions/workflows/test.yml)

</div>

A council of investing legends for Claude Code. Thirteen simulated investors (Buffett, Munger, Damodaran, Marks, Taleb, Druckenmiller and Burry by default; Lynch, Ackman, Kantesaria, Sleep, Mauboussin and Tom Lee on call) argue your decision over three rounds. A Chair returns a graded verdict that keeps the dissent, with a pre-mortem, kill criteria and a date to re-check, and remembers it for next time.

> **Mosaic grades how a decision was made. It is not investment advice.** Every seat is a simulation built from that investor's public work. It is not the person, is not affiliated with or endorsed by them, and does not speak for them. Verbatim quotes appear only with a source id. Mosaic grades your reasoning and decision process, never a security: no price targets (valuation is a range and "what the price implies"), and position sizing appears only as education about survivable loss. Numbers carry their as-of dates; verify them against the filings before acting.

## What you need

- Claude Code 2.1.292 or later. Check with `claude --version`. Update with `claude update`.
- Node.js 20 or later. Check with `node --version`. Get it from nodejs.org.

Nothing else. No npm install, no API keys, no accounts. For company filings the SEC asks for your name and email once. `/mosaic` asks for it the first time.

## Quick start

1. In a terminal, from any folder:

   ```bash
   claude plugin install mosaic --marketplace abhinavuppal931/mosaic
   ```

2. Start Claude Code (any folder):

   ```bash
   claude
   ```

3. In Claude Code:

   ```
   /mosaic
   ```

   It checks Node, your Mosaic home and the SEC contact. It opens the Room in your browser on a finished example council, and asks for your decision. Then ask for a council, for example:

   ```
   /mosaic should I buy MSFT here? I'm leaning toward a full position because the selloff looks overdone
   ```

**Already in Claude Code?** Paste this one line into Claude Code. It installs Mosaic and opens the Room:

```
Install the Mosaic plugin with claude plugin install mosaic --marketplace abhinavuppal931/mosaic, then start its Room (room/server.js in the installed plugin folder) in the background with node and --open, and give me the link.
```

When it is done, type `/reload-plugins`, then `/mosaic`.

If `/mosaic` is taken by another plugin, use `/mosaic:mosaic`.

**Older Claude Code (before 2.1.292).** Use two commands, from any folder:

```bash
claude plugin marketplace add abhinavuppal931/mosaic
```

```bash
claude plugin install mosaic@mosaic
```

## Quick start from a git clone

For people who want the code.

1. Clone it, in the folder you want the code in:

   ```bash
   git clone https://github.com/abhinavuppal931/mosaic.git
   ```

2. Start Claude Code with the clone as the plugin, in the same folder you ran `git clone` in:

   ```bash
   claude --plugin-dir mosaic
   ```

   This loads the clone as the `mosaic` plugin for that session, so `/mosaic` and the seat agents work as in the marketplace install.

3. In Claude Code:

   ```
   /mosaic
   ```

To open the Room without Claude Code, run this inside the `mosaic` folder:

```bash
npm start
```

Or run this from the folder you cloned into:

```bash
node mosaic/room/server.js --open
```

The Room shows the three example councils until you run one of your own.

`--plugin-dir` loads the clone as it is on disk, so your edits and a `git pull` apply the next time you start Claude Code with it. To use Mosaic without the flag, install it from the marketplace as in the Quick start above. (Adding the clone as a local marketplace copies it into Claude Code's plugin cache, so later edits would not show up.)

## See it in action

<!-- The tour lands in phase 2 (ABH-339). -->
Take the tour: [docs/TOUR.md](docs/TOUR.md).

## Use

```
/mosaic should I buy MSFT here? I'm leaning toward a full position because the selloff looks overdone
```

| Command | What it does |
|---|---|
| `/mosaic` | First-run check, opens the Room, asks for your decision |
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

## Why it is different

1. **One sourced fact sheet.** Every seat argues from the same `data-pack.json`. Every number has a fact id (`F014`), a source, an as-of date and a status. Missing data stays visibly missing, never filled in. A check script fails any cited fact id or quote that is not real.
2. **Real debate, dissent kept.** Seats answer each other's strongest argument. The verdict leads with where they disagree and keeps the minority report. No averaging into "hold".
3. **It remembers.** Each decision becomes a thesis journal entry with kill criteria and a re-check date. `/mosaic recheck NVDA` reruns a quick council on what changed since the last pack.
4. **Anti-sycophancy.** Round 1 seats do not know which way you lean. The lean is revealed in Round 2, and the verdict reports the **lean pull**: how far scores moved toward your lean after the reveal.

## The Room

The Room is a local web page that plays a council live, then shows the verdict. It reads the session files the council writes and makes no AI calls. It needs Node 20 or later and nothing else.

In Claude Code, `/mosaic room` starts it. Without Claude Code, run this inside the `mosaic` folder:

```bash
node room/server.js --open
```

`--open` opens your browser. The address is http://localhost:4731.

- Until you have a council of your own, the Room shows the newest example council. The Journal page lists all three examples to open.
- If port 4731 is taken by something else, the Room moves to the next free port and prints the address. If a Room is already open, it says so.
- To pick a port, use `--port 4800` or set `MOSAIC_ROOM_PORT`.
- To open one finished example, run this inside the `mosaic` folder:

```bash
node room/server.js --session room/examples/2026-11-17-nvda-buy
```

- To watch your own councils, run this inside the `mosaic` folder. Use the `home` that `node data/cli.mjs paths` prints:

```bash
node room/server.js --home <home>
```

Without `--session`, the Room follows the newest council in that home's `sessions/` folder, so a council started after the Room opens shows up by itself. Other options are `--plugin-data`, `--sessions`, `--journal` and `--roster`.

Three finished councils in `room/examples/` run with no live council: a buy (NVIDIA), a sell (Costco) and a sizing decision (Microsoft). The Room's tests run with the rest under `npm test`. Its browser tests need Playwright and skip themselves without it.

## Where your data lives

Sessions, the journal, the cache, `.env.local` and `mosaic.config.json` live in `~/.mosaic`. On Windows that is `C:\Users\<you>\.mosaic`. This is the same for marketplace and clone installs. These files survive plugin updates and uninstalls.

- Set `MOSAIC_HOME` to use another folder.
- An older clone or plugin data folder that already holds sessions keeps being used.
- `/mosaic` pre-approves only its own five scripts (run as `node "<plugin folder>/<script>"`) and file reads and writes inside `~/.mosaic`, so a council runs without approval prompts. Anything else still asks, including other `node` commands. Details are in `docs/marketplace-listing.md`, under Security notes.
- To print the folders, run this inside the clone:

```bash
node data/cli.mjs paths
```

## FAQ

**Is this investment advice?**
No. In the words of the disclaimer above: "Mosaic grades how a decision was made. It is not investment advice."

**Does it cost money?**
Mosaic is free and MIT licensed. It runs on your Claude Code plan, so it uses your plan's usage. A full council is three sub-agent runs per seat. `--quick` runs four seats and skips Round 3 when the scores already converged, so it costs less.

**Do I need API keys?**
No. It uses free sources by default. Keys are optional and add more data (see Adding a key).

**What data leaves my machine?**
Only requests to the listed data sources, made when building a data pack. There is no telemetry. See [What Mosaic runs and sends](#what-mosaic-runs-and-sends).

**Are the seats the real people?**
No. Each seat is a simulation built from that investor's public work. It is not the person and does not speak for them.

**Can I add my own investor?**
Yes. Run `/newseat` in Claude Code. It builds the brain from free public sources, writes the seat agent and registers it in the roster.

**Does it work on Windows?**
Yes. It is tested on Windows 11 with Node 24.

**Where are my sessions?**
In `~/.mosaic` (on Windows, `C:\Users\<you>\.mosaic`). See Where your data lives.

## Troubleshooting

- `npm ERR! enoent ... package.json`: npm ran outside the clone. Run `npm start` inside the `mosaic` folder, or use `/mosaic room` in Claude Code.
- `error: unknown option '--marketplace'`, or the install fails: Claude Code is older than 2.1.292. Run `claude update`, or use the two-command install.
- Repository not found while installing: the repository must be public, or your git must be signed in to GitHub with access to it.
- Port 4731 busy: the Room picks the next free port and prints the address. To choose one, add `--port 4800`.
- Node too old: install Node.js 20 or later.
- Paths with spaces (common on Windows): Mosaic quotes every path. If you type commands yourself, put paths in double quotes.
- Check everything at once: run `node data/cli.mjs setup --status` inside the clone, or `npm run check` inside the clone. In a plugin install, `/mosaic` runs the same check.

## What Mosaic runs and sends

- It runs only Node scripts that ship in the plugin. There are no npm packages, no postinstall step, no hooks and no MCP servers.
- The Room is a local web server bound to 127.0.0.1. It makes no AI calls.
- Network requests go only to the data sources below, and only when building a data pack:
  - `data.sec.gov` and `www.sec.gov`, with your SEC contact in the User-Agent, as the SEC requires
  - `query1.finance.yahoo.com`
  - `home.treasury.gov`
  - `markets.newyorkfed.org`
  - `api.bls.gov`
  - With a key you add: `api.stlouisfed.org` (FRED), `financialmodelingprep.com`, `finnhub.io` and `api.massive.com`
- Keys and the SEC contact are never written to packs, sessions or logs.
- Nothing is sent anywhere else. There is no telemetry.

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

The SEC asks every client to identify itself with a name and email. Once, in a terminal, inside the clone:

```bash
node data/cli.mjs setup
```

It asks for your name and email and saves them to `mosaic.config.json` in your Mosaic home (git-ignored, readable only by you). They are never taken from the command line, so they stay out of shell history. You can instead set `MOSAIC_SEC_CONTACT="Your Name you@example.com"` in your environment or in `.env.local`. In a plugin install, `/mosaic` asks on first run and saves it for you.

Try it, inside the clone:

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

Add a line such as `FRED_API_KEY=your-key` to `.env.local` in your Mosaic home (or export it in your shell), then check it, inside the clone:

```bash
node data/cli.mjs setup --status
```

```bash
node data/cli.mjs check-provider fred
```

`setup --status` prints which variables are set, never their values. `node data/cli.mjs providers` (inside the clone) shows every provider and the order each capability is tried in.

### Changing the order of providers

`data/mosaic.config.json` holds the defaults: a chain per capability (first answer wins), per-provider rate limits, timeouts, retries and cache times. To override any part, put a `mosaic.config.json` in your Mosaic home; it is deep-merged over the defaults (arrays replace). Run `node data/cli.mjs paths` (inside the clone) to see where your home is. For example, to prefer FMP for prices:

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

4. Run the contract test, inside the clone. It calls each capability once and checks the shapes:

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
room/                    the Room: server.js, public/, lib/, examples/, test/
docs/                    LAUNCH.md, marketplace-listing.md, design/, research/
.github/                 test.yml (CI), issue forms, pull request template, release notes
CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md, CHANGELOG.md
```

## Tests

Run this inside the clone:

```bash
npm test
```

The core suite runs every adapter against recorded responses (no network), the router's fallbacks, retries, rate limits and cache, pack building, the scoring and label math, the citation checker and the journal. Live smoke packs built against the free sources are in `tests/core/fixtures/live/` with a note on what answered.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security problem, read [SECURITY.md](SECURITY.md) first.

## Credits

Adapted from [Roast Room](https://github.com/nateherkai/roast-room) (MIT, AI Automation Society); see `NOTICE`. Ideas from [ai-hedge-fund](https://github.com/virattt/ai-hedge-fund) (MIT). Mosaic is MIT licensed.

---

Simulated council for education. Not financial advice. Seats are simulations built from public work; they are not the people and do not speak for them.
