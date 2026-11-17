# Intake: classify the job, build the options, write the brief

Every `/mosaic <anything>` starts here. Read the request, classify it into one of four jobs, and build the brief the seats will read. The brief is under 300 words and never contains the lean.

## 1. Classify

| Signal in the request | Job | `job` in council.json | Pack |
|---|---|---|---|
| One ticker and an action: buy, add, hold, trim, sell, "should I", "is X a buy" | **Decision** | `decision` | `pack --ticker` |
| A pasted thesis ("my thesis on X is..."), "stress test", "poke holes", "pre-mortem" | **Thesis stress test** | `stress_test` | `pack --ticker` (or `--macro` when the thesis has no ticker) |
| Several holdings with weights, "review my portfolio", "what could hurt me" | **Portfolio review** | `portfolio` | `pack --portfolio` |
| No ticker; rates, inflation, recession, the Fed, credit, "is the market..." | **Macro question** | `macro` | `pack --macro` |

When two fit, ask once in the intake batch. A recheck (`recheck <TICKER>`) is a decision job with `mode: "quick"` and the last verdict's options.

## 2. Options

Every option gets an `id` (A, B, ...), a short `label` (under 50 characters) and a `kind`:

- `act`: do something now.
- `wait`: act only when a named trigger happens. A wait option **must** carry `trigger` (a price relation from the pack, a filing, a dated event).
- `none`: do not act, or keep things as they are.

Defaults (adapt the wording to the user's facts; keep the kinds):

| Job | Options |
|---|---|
| Decision, not owned | A Full position now (`act`) · B Starter now, add on proof (`act`) · C Wait for a price or trigger (`wait`) · D Pass (`none`) |
| Decision, already owned | A Add (`act`) · B Hold (`none`) · C Trim (`act`) · D Sell (`act`). When the user leans to sell, keep Hold as the `none` option so "do nothing" is always on the table |
| Thesis stress test | A Act on the thesis as written (`act`) · B Act on an amended thesis (`act`) · C Shelve the thesis (`none`). The score of A is reported as the thesis strength |
| Portfolio review | A Keep the current mix (`none`) · B Reduce the named risks (`act`) · C Restructure around the ruin exposure (`act`). Education only: options describe risk posture, never target weights |
| Macro question | Two to four positions the user is weighing (e.g. A Extend duration now, B Stay short, C Wait for the curve to steepen with a trigger) or, for a pure question, A Yes / B No / C Not knowable now (`none`) |

Always include a `none` option. If the user brought one idea, add the smaller version (starter, partial trim) as an option.

## 3. The brief (fields)

1. **Decision** in one line.
2. **Options** as listed above.
3. **Horizon**: the user's, or `(assumed)`.
4. **Position context**: owned or not; cost basis relative to today's price (as a percent, e.g. "up 40%"), never a dollar amount; share of the portfolio as a percent. For portfolio reviews, write `<session>/holdings.json` as `{ "holdings": [{ "ticker": "MSFT", "weight": 20 }] }` (weights in percent or fractions; no dollar values).
5. **Trigger**: what made the user look at this today, in their words.
6. **Data health**: one line from the pack.
7. **Assumptions**: each marked `(assumed)`.

**Lean** (kept out of the brief): which option the user leans toward and why, in their words. Record it in your notes; write `lean.json` only after Round 1 is saved. If the user gave no lean, ask in the intake batch ("Which way are you leaning, and why?"); if they decline, record `{ "option": null }` and the lean pull is not computed.

## 4. Ask once

Use one AskUserQuestion call for everything missing (at most four questions), in this order of priority: the lean, position context, horizon, the board. Do not ask for what the pack already knows (prices, financials, dates). If the user says "just run it", fill gaps with assumptions and say so.

## 5. Behavioral scan

While reading the request, note sentences that suggest:

- **FOMO / recency**: "it's ripping", "everyone is buying", "I missed it last time".
- **Anchoring on cost basis**: "I'll sell when I'm back to even", "I'm down 30% so I can't sell".
- **Sunk cost**: "I've held it for years", "I've put too much in to stop now".
- **Confirmation**: "I just need someone to agree", "tell me why this works".

Quote them verbatim in the Round 1 Chair notes. They are flags for the seats, not judgments of the user.

## 6. Compliance framing

- Grade the decision and the reasoning, never "BUY" a security.
- Never state a price target. Valuation is a range and "what the price implies".
- Sizing is education: survivable loss, never a percentage for this user.
- Portfolio reviews judge concentration, correlated bets and ruin exposure ("what could hurt you"), never prescribe weights.
