# Mosaic: spec v1

Mosaic is an open-source Claude Code plugin. A user brings an investment decision, and a council of simulated investing legends debates it over three rounds on one shared, sourced data pack, then a Chair returns a graded verdict that keeps the dissent, a pre-mortem, kill criteria, and a date to re-check. A small local web app (the Room) plays the debate live, shows the verdict, and exports a PDF and a share card.

It is a free lead magnet for Abs (abhinav-uppal-website, Workshop section). It must be the best tool of its kind, not one more persona prompt pack.

Research behind every decision here: `docs/research/legends.md` (roster, frameworks, sources), `docs/research/pain-points.md` (what investors complain about, competitors), `docs/research/hedge-fund-and-data.md` (ai-hedge-fund review, data vendors, adapter design). Read them before building your part.

## 1. Why it wins (the three differentiators)

Similar skills exist (Market Sages, roundtable, ai-berkshire, TinyIC). Mosaic wins on how it decides:

1. **One sourced fact sheet.** Every seat argues from the same `data-pack.json`. Every number carries a source and an as-of date and a fact id (`F014`). Missing data stays visibly missing. A check script fails any cited fact id or quote that is not real.
2. **Real debate, dissent kept.** Seats answer each other's strongest argument; the verdict leads with where they disagree and keeps the minority report. No averaging into "hold".
3. **It remembers.** Each decision becomes a thesis journal entry with kill criteria and re-check triggers (next earnings date). `/mosaic recheck NVDA` reruns a quick council on what changed.

Plus anti-sycophancy: Round 1 seats do not see which way the user leans. The lean is revealed in Round 2 and the verdict reports the **lean pull** (how far scores moved toward the user's lean after the reveal).

## 2. Roster (13 seats)

Default board (7): every run starts here unless the Chair recommends otherwise.

| Key | Seat | Role | Question owned | Dimension |
|---|---|---|---|---|
| buffett | Warren Buffett | Business quality and owner economics | Is this a wonderful business I understand, bought at a sensible price, worth much more in 10 years? | Moat and owner economics |
| munger | Charlie Munger | Inversion, incentives, misjudgment | How does this fail, whose incentives drive it, and what are we fooling ourselves about? | Folly check |
| damodaran | Aswath Damodaran | Valuation | What is it worth under a story the numbers can carry, and what does today's price assume? | Value vs price |
| marks | Howard Marks | Cycle and pricing of risk | Where are we in the cycle, what is priced in, and are we paid for the risk? | Risk and cycle |
| taleb | Nassim Nicholas Taleb | Fragility and ruin (the ruin guard) | Can this blow us up, and do we gain or lose from disorder? | Ruin and convexity |
| druckenmiller | Stanley Druckenmiller | Macro, liquidity, timing, flows | What will liquidity, the Fed and price action do to this over 18 to 24 months? | Macro and timing |
| burry | Michael Burry | Contrarian bear case (the bear guard) | What is the crowd missing, and what does the downside look like if they are wrong? | Bear case |

On call (6): the Chair seats them when the question is in their lane.

| Key | Seat | Role | Question owned | Dimension |
|---|---|---|---|---|
| lynch | Peter Lynch | Growth and ground truth | What kind of stock is this, what is the two-minute story, and does growth pay for the multiple? | Growth story and PEG |
| ackman | Bill Ackman | Catalysts, governance, asymmetric hedges | What has to change, who makes it change, and how do we hedge the tail? | Catalyst and governance |
| kantesaria | Dev Kantesaria | Toll-booth quality gate | Is this a predictable pricing-power monopoly, and is this the dislocation to buy it? | Predictability and pricing power |
| sleep | Nick Sleep | Long runway, scale shared | Where does this end up in 20 years if it keeps reinvesting and sharing scale with customers? | Runway and reinvestment |
| mauboussin | Michael Mauboussin | Expectations, base rates, sizing | What does the price imply, how often does anyone deliver that, and how big a bet does the edge justify? | Base rates and sizing |
| tomlee | Tom Lee | Thematic and secular trends | Which secular theme carries this, and is the market early or late to it? | Thematic tailwind |

Guards: Taleb (ruin) and Burry (bear) sit on every council unless the user names seats with `--seats` and leaves them out; then the Chair warns once. Corrections from research that brains must respect: Taleb is fat tails, ruin, convexity and skin in the game, not "probabilities"; Ackman is activism and hedges on top of quality; Kantesaria is predictable pricing-power monopolies bought on scares, 8 to 12 names.

Source risk (from research): Kantesaria and Lynch have thin free sources (books are copyrighted), Burry's record is thinner than Chanos's would have been. Their brains run at quick depth, say so in `sources.md`, and lean on verbatim lines from interviews and letters only.

## 3. Jobs and modes

`/mosaic <anything>` runs intake, which classifies the request into one of four jobs:

1. **Decision** on one ticker: buy, add, hold, trim or sell. Options default to A full position now, B starter now and add on proof, C wait for a price or trigger, D pass (or hold/trim/sell variants for an existing position).
2. **Thesis stress test:** the user pastes a thesis; the council runs a pre-mortem and returns "I'm wrong if" conditions and a thesis strength grade.
3. **Portfolio review:** holdings and weights; the council judges concentration, correlated bets, ruin exposure. Education framing only (what could hurt you), never prescribed weights.
4. **Macro question:** no ticker; macro data pack (curve, policy rate, inflation, unemployment, credit spreads); Druckenmiller, Marks, Taleb, Tom Lee weighted up.

Flags and commands (keep Roast Room's ergonomics):

- `--quick`: four seats (always including one guard), Rounds 1 and 2, Round 3 only if scores did not converge.
- `--seats a,b,c`, `--all` (cap nine at the table), `ask <seat> ...` (single-seat consult), `board` (change the default board and the ask/auto/default setting in `roster.json`).
- `recheck <TICKER>`: quick council against the journal entry, leading with what changed since the last data pack.
- `journal`: list tracked theses, their verdicts, and the next re-check date.
- `room`: start the Room app.

## 4. The protocol (Chair runs it; adapted from Roast Room's SKILL.md)

1. **Intake and brief** (under 300 words): decision, options, horizon, position context (owned? cost basis? share of portfolio), what triggered the decision today, and the lean with the reason. Ask for missing items in one AskUserQuestion batch. Record the trigger and lean separately; the lean is withheld from Round 1.
2. **Data pack:** run `node data/cli.mjs pack --ticker NVDA --session <dir>` (or `--macro`, or `--portfolio holdings.json`). It writes `data-pack.json` and `data-pack.md` (human view). Never let a seat compute a number the pack could compute.
3. **Seat the board** with weights 1 to 3 per seat (see `references/seats.md`).
4. **Round 1, blind opening:** all seats in parallel, lean withheld. Card fields: STANCE, OPTION SCORES (0 to 10 each), PILLAR SCORE, CONVICTION (1 to 5), EVIDENCE (strong / adequate / thin), RUIN RISK, DOOR, THE CALL, WHY (each point cites a framework source id and fact ids), THE RISK I SEE, I'M WRONG IF (a checkable fact), QUESTION FOR THE INVESTOR. A seat may answer **TOO HARD** (outside its circle) and abstain; abstentions are shown and excluded from the math.
5. **Chair notes:** cruxes, unanimity check (unanimous Round 1 forces the strongest unargued case into Round 2), bias flags quoted from the user's own words (FOMO trigger, anchoring on cost basis, sunk cost).
6. **Round 2, debate with the lean revealed:** I DISAGREE MOST WITH, I CONCEDE, ON THE CRUXES, rescored card, MOVED, CONDITIONS FOR YES.
7. **Draft resolution:** recommended option, conditions, pre-mortem (three ways this fails in 12 months), kill criteria, re-check triggers with dates, cheapest test, and an educational sizing note from the sizing logic (survivable loss framing, never a specific percentage for this user).
8. **Round 3, ratification:** Endorse / Endorse with amendment / Dissent, final scores.
9. **Verify:** `python scripts/check_citations.py <session>` (or the Node twin `node scripts/check-citations.mjs`) checks every quote against brains and every fact id against the pack. Unverified items are removed and noted.
10. **Verdict:** `verdict.md` + `verdict.json`, short chat summary under 200 words, and a journal entry.

### Scoring and labels

Option score = weighted mean of the last round's option scores (abstentions excluded). Labels grade the decision, never "BUY":

| Score | Label |
|---|---|
| 7.5 to 10 | CONVICTION EARNED |
| 6.0 to 7.4 | PROCEED WITH CONDITIONS |
| 4.5 to 5.9 | RESHAPE THE THESIS |
| below 4.5 | PASS |

Overrides: **WAIT FOR THE PITCH** (good business, price or trigger not met; names the trigger), **INSUFFICIENT EVIDENCE** (pack coverage below threshold or the top option rests on thin evidence from most seats), **Ruin cap** (any seat at RUIN RISK likely caps at RESHAPE until a mitigation that seat endorses), **One-way door cap**.

Report separately: conviction (option score), evidence quality (pack coverage plus the share of claims backed by fact ids), spread, council confidence, lean pull, and a per-seat scorecard on each seat's dimension.

## 5. Data layer (zero dependencies, Node 20 built-in fetch)

Follow `docs/research/hedge-fund-and-data.md`. Summary:

- **Provider adapter:** each provider exports `{ id, needsKey, keyEnv, capabilities, getQuote, getPriceHistory, getFinancials(period), getRatios, getInsiderTrades, getHoldings, getMacroSeries, getNews, getEstimates }`; each method returns `{ data, meta: { source, asOf, status } }` with status `ok | stale | fallback | missing | error`. Empty means no data; infrastructure failure throws.
- **Router:** walks the configured chain per capability with timeout, backoff, per-provider rate limit and a file cache (history long, same-day 10 minutes, quotes never). Configured in `mosaic.config.json`; keys from env vars or a git-ignored `.env.local`.
- **Zero-key default (US):** SEC EDGAR companyfacts (fundamentals, with a User-Agent the user sets on first run), EDGAR Form 4 and 13F, ratios computed locally, prices from Yahoo's chart endpoint as best-effort with clear fallback labels, macro from Treasury yield curve and BLS v1, FRED when a free key is present. News and estimates are shown as missing without a key.
- **Shipped keyed adapters:** FMP, Massive (Polygon), Finnhub. Plus `custom` (one adapter file, contract-tested by `node data/cli.mjs check-provider <id>`).
- **Evidence packs:** per-seat metric sets computed in code (Buffett ROE/owner earnings, Damodaran reverse DCF, Lynch PEG, Taleb drawdown/tails/leverage, Marks price percentile vs history and credit spreads, Mauboussin implied growth vs base rates, Druckenmiller curve/policy/trend, Burry short interest if available plus accruals and dilution). See the research file for thresholds. Every derived fact stores its formula.
- Degrade visibly: `coverage` and `warnings` in the pack; the Room shows a data-health strip; missing data caps that seat's evidence grade.

## 6. Brains (one per seat)

Same structure as Roast Room: `brains/<slug>/` with `_hot.md`, `frameworks.md`, `principles.md`, `positions.md`, `voice.md`, `stories.md`, `sources.md`, plus a new `selling.md` (each legend's rules for selling and re-checking). Built by the `/newseat` skill (port of `/newroaster`): find free primary sources, fetch into git-ignored `build/`, extract with parallel sub-agents, verbatim quotes only with source ids, quote check must pass. Depth: deep for Buffett, Munger, Marks, Damodaran, Mauboussin, Druckenmiller, Ackman; default for Taleb, Sleep, Tom Lee, Burry; quick for Lynch and Kantesaria (thin free sources, flagged).

Seat agents: `agents/<key>.md`, modelled on Roast Room's `council-buffett.md`, with investing-specific "Your lens", "How you debate" (natural opponents from research), "Where your lens misfires", and "Never" (no price targets, no personal advice, no invented quotes, no em dashes).

## 7. Packaging and install

- **Claude Code plugin** is the primary path: `/plugin marketplace add abhinavuppal931/mosaic` then `/plugin install mosaic@mosaic`. The plugin ships the skill, the 13 seat agents, brains, data layer and the Room. Verify the current plugin manifest format against Claude Code docs before building it.
- `git clone` + `claude` in the folder is the secondary path (works like Roast Room).
- The Room: `/mosaic room` (or `npm start`) serves on http://localhost:4731, zero dependencies. It only plays files the Chair writes in `sessions/`; it makes no AI calls.
- Ships with three finished example sessions (a buy decision on a real large-cap, a sell decision, a macro question) so the Room demos before any run, and so the website can replay one.
- Website: a Workshop entry on abhinav-uppal-website (beside Parallax and Stockpile) with a replayed council, the two install lines with copy buttons, and the repo link. Separate issue.

## 8. The Room (front end)

Screens: Lobby (the council assembled, how to start, past sessions), Live council (round progress, the speaking seat, cards, cruxes, data-health strip, lean reveal moment), Verdict (label, option scores with math, seat votes and scorecard, dissent, pre-mortem, kill criteria, re-check date, evidence quality), Journal (tracked theses and next re-checks), Share card (one image: each seat's vote and one line, the sharpest dissent, kill criteria, as-of dates, footer disclaimer).

Visual direction: chosen from three /design canvas options (Abs's pick). Abs's brand system (`context/brand-design-system.md` in the Abs OS repo) adapted to a premium dark app: Fey meets Claude, no AI-default patterns.

Faces: illustrated premium 3D-style likenesses, one style bible, generated locally with Codex image generation, four frames per seat (base, mid, open, blink) for talking, plus one hero image of the council around a table.

## 9. Compliance and honesty

- Every seat is labelled a simulation built from public work, not affiliated with or endorsed by the person. Verbatim quotes only with a source id.
- Not investment advice: the verdict grades the user's reasoning and decision process. No price targets. Valuation as ranges and "what the price implies". Sizing as education.
- README and Room footer carry the disclaimer. Living-person seats never read as that person endorsing a security.

## 10. Quality bar and tests

- Unit tests (node:test, zero deps) for every adapter (recorded fixtures, no network in CI), the router fallbacks, pack building, scoring and label math, citation checker, journal.
- Contract test for custom adapters.
- Smoke: run a full council on one example ticker end to end in Claude Code, check-citations passes, the Room plays it, PDF and share card export.
- Visual: Playwright screenshots of every Room screen at 1440 and 390 widths in both states (live and finished), compared with the approved mockup.

## 11. Repo layout and ownership (parallel builders must not collide)

```
.claude-plugin/plugin.json, marketplace.json   core session (ABH-328)
skills/mosaic/SKILL.md, references/            core session
skills/mosaic/roster.json                      brains session (ABH-329) owns; core reads it, tests use a fixture
skills/mosaic/brains/<slug>/                   brains session
skills/newseat/                                brains session
agents/seat-<key>.md                           brains session
data/ (providers/, router.mjs, packs/, cli.mjs) core session
scripts/check-citations.mjs                    core session
tests/                                         each session its own subfolder
room/                                          Room session (ABH-331), after the design is approved
sessions/example-*/                            core session writes the formats; Room session finishes the examples
```

Session file formats (`council.json`, `round-N.md`, `cruxes.json`, `draft.json`, `verdict.json`, `data-pack.json`, `journal/<TICKER>.json`) are defined by the core session in `skills/mosaic/references/live-room.md` and are the contract the Room reads. Verify the plugin manifest and agent naming against the current Claude Code plugin docs; if plugin agents are namespaced, the protocol must spawn them by their namespaced names.

## 12. Attribution

Adapted from nateherkai/roast-room (MIT, AI Automation Society): keep its license notice for adapted files. Ideas from virattt/ai-hedge-fund (MIT). Mosaic is MIT.
