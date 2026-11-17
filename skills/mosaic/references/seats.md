# Seats, weights and guards

Adapted from Roast Room's seats reference (MIT, Copyright (c) 2026 AI Automation Society; see NOTICE).

`skills/mosaic/roster.json` is the source of truth for who exists, the default board and the board setting. It is built by `/newseat` (the brains build). The Chair reads these fields: `key`, `name`, `short`, `slug`, `role`, `question`, `dimension`, and `guard` (`ruin` or `bear`). Agent type: `mosaic:seat-<key>` (file `agents/seat-<key>.md`). Brain: `skills/mosaic/brains/<slug>/`.

## The roster

Default board (7):

| Key | Seat | Owns the question | Dimension (scorecard) |
|---|---|---|---|
| buffett | Warren Buffett | Is this a wonderful business I understand, bought at a sensible price, worth much more in 10 years? | Moat and owner economics |
| munger | Charlie Munger | How does this fail, whose incentives drive it, and what are we fooling ourselves about? | Folly check |
| damodaran | Aswath Damodaran | What is it worth under a story the numbers can carry, and what does today's price assume? | Value vs price |
| marks | Howard Marks | Where are we in the cycle, what is priced in, and are we paid for the risk? | Risk and cycle |
| taleb | Nassim Nicholas Taleb (ruin guard) | Can this blow us up, and do we gain or lose from disorder? | Ruin and convexity |
| druckenmiller | Stanley Druckenmiller | What will liquidity, the Fed and price action do to this over 18 to 24 months? | Macro and timing |
| burry | Michael Burry (bear guard) | What is the crowd missing, and what does the downside look like if they are wrong? | Bear case |

On call (6), seated when the question is in their lane:

| Key | Seat | Seat them when | Dimension |
|---|---|---|---|
| lynch | Peter Lynch | A growth story, a consumer business the user knows first-hand, a PEG question | Growth story and PEG |
| ackman | Bill Ackman | A catalyst, a turnaround, governance or activism, a hedge on the tail | Catalyst and governance |
| kantesaria | Dev Kantesaria | A possible toll-booth monopoly bought on a scare; pricing power is the crux | Predictability and pricing power |
| sleep | Nick Sleep | A long reinvestment runway, scale economics shared with customers, a 20-year hold | Runway and reinvestment |
| mauboussin | Michael Mauboussin | "What does the price imply", base rates, sizing an edge | Base rates and sizing |
| tomlee | Tom Lee | A secular theme (AI, crypto, demographics), "is the market early or late" | Thematic tailwind |

## Guards

- **Taleb (ruin)** and **Burry (bear)** sit on every council, including `--quick` (at least one of them) and `--all`.
- With `--seats` that leaves both out, warn once: "No ruin or bear guard at the table: the verdict has no one whose job is the downside." Then proceed.
- A guard at `RUIN RISK: likely` caps the verdict (see `scoring.md`).

Corrections every seat must respect (from the research): Taleb is fat tails, ruin, convexity and skin in the game, not "probabilities"; Ackman is activism and hedges on top of quality; Kantesaria is predictable pricing-power monopolies bought on scares, 8 to 12 names.

Source depth: Kantesaria and Lynch have thin free sources (their books are copyrighted), and Burry's public record is thin. Their brains run at quick depth and lean on verbatim interview and letter lines. When one of them is seated, say so in one line of the brief, and expect `EVIDENCE: thin` from them more often.

## Relevance weights (1 to 3)

Set before Round 1, one line of reason each, in `council.json`. Exactly one or two seats at 3; every seat at least 1.

| Weight | Meaning |
|---|---|
| 3 | The decision lives in this seat's question |
| 2 | Materially affected |
| 1 | Touched at the edges, or a guard seated for the downside |

Starting points by job (adjust to the facts):

| Job | Weight 3 | Weight 2 | Weight 1 |
|---|---|---|---|
| Decision, quality compounder | buffett, damodaran | munger, marks, taleb | druckenmiller, burry |
| Decision, after a big drop | marks, burry | taleb, damodaran, buffett | munger, druckenmiller |
| Decision, growth or theme | damodaran, lynch or tomlee | burry, taleb, mauboussin | buffett, marks |
| Sell or trim | munger, taleb | burry, marks, buffett | damodaran, druckenmiller |
| Thesis stress test | munger, burry | taleb, damodaran | the rest |
| Portfolio review | taleb, marks | munger, mauboussin, druckenmiller | the rest |
| Macro question | druckenmiller, marks | taleb, tomlee | buffett, damodaran, burry |

Macro questions weight Druckenmiller, Marks, Taleb and Tom Lee up: seat Tom Lee for macro questions even though he is on call.

## Recommend a board

1. Every seat whose question the decision lives in (the seats that would get 2 or 3).
2. Both guards.
3. The seat most likely to disagree with the rest, so the council argues.
4. Leave out seats whose question barely touches the decision; two seats with close lenses (Buffett and Kantesaria, Damodaran and Mauboussin) sit together only when they would disagree.
5. Five to seven seats for a full council; four for `--quick` (the two highest weights, a guard, and the likeliest dissenter); never more than nine.

## Natural tensions

- Buffett and Kantesaria (own the moat, wait for the fat pitch) against Druckenmiller and Tom Lee (liquidity and momentum now).
- Damodaran and Mauboussin (what the price implies) against Lynch and Sleep (the story and the runway the numbers cannot see yet).
- Burry (the crowd is wrong) against Tom Lee (the trend is your friend).
- Taleb (ruin first, size for the tail) against everyone who sizes for the average.
- Munger (invert, incentives) against Ackman (a catalyst can change the incentives).
- Marks (where are we in the cycle) against Buffett (time in a great business beats timing).
