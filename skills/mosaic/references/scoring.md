# Scoring

The Chair never does this math by hand. `node <plugin root>/scripts/score.mjs <session>` parses the round cards and writes `scores.json`; this page explains every rule it applies so the verdict can explain them too. Thresholds live in `scripts/scoring.config.json`. Adapted from Roast Room's scoring (MIT, Copyright (c) 2026 AI Automation Society; see NOTICE).

## Which round counts

The last round that ran (Round 3 if it ran, else Round 2, else Round 1). Fields a seat left out of a later card (Round 3 cards do not repeat EVIDENCE, DOOR or CONVICTION) carry forward from that seat's most recent earlier card.

## Abstentions

A seat that answers `STANCE: TOO HARD` (or `OPTION SCORES: n/a`) abstains. It is listed in `abstentions`, shown in the scorecard, and excluded from every average. If every seat abstains, the label is INSUFFICIENT EVIDENCE.

## Option score (conviction)

For each option, over the seats that scored it:

`option score = sum(weight x score) / sum(weight)`, rounded to one decimal.

`scores.json` carries the math line for each option, e.g. `B (3x8 + 2x6 + 2x5) / 7 = 6.6`. The **recommended option** is the highest score; a tie goes to the option with the smaller spread, then the earlier letter.

## Labels (they grade the decision, never "BUY")

| Recommended option's score | Label |
|---|---|
| 7.5 to 10 | CONVICTION EARNED |
| 6.0 to 7.4 | PROCEED WITH CONDITIONS |
| 4.5 to 5.9 | RESHAPE THE THESIS |
| below 4.5 | PASS |

## Overrides, in the order applied

1. **Top option is "don't act"** (`kind: none`): the label is PASS, with a note that the council's best option is not to act.
2. **WAIT FOR THE PITCH**: the top option is a `wait` option scoring 4.5 or more, or the Chair sets `wait_for_pitch.trigger` in `draft.json` (a good business whose price or trigger is not met). It always names the trigger; a missing trigger is reported as a problem.
3. **Ruin cap**: any scoring seat ending at `RUIN RISK: likely` caps the label at RESHAPE THE THESIS, unless `draft.json` lists that seat in `ruin_mitigations` with `endorsed: true` and the seat did not vote Dissent in Round 3. One seat at ruin outweighs six enthusiastic seats.
4. **One-way door cap**: when more than half of the scoring seats call it a one-way door and the spread on the recommended option is 4 or more, the label is capped at PROCEED WITH CONDITIONS and the cheapest test comes first.
5. **INSUFFICIENT EVIDENCE** replaces the label when the pack's coverage score is below 50%, or when more than half of the scoring seats rate their evidence `thin`. `scores.json` keeps the `underlyingLabel` so the report can say what the council would have said with better data.

Caps only lower a label; they never raise one, and they do not apply to WAIT FOR THE PITCH or PASS.

## Reported alongside the label

- **Conviction**: the recommended option's score.
- **Spread**: highest minus lowest seat score on the recommended option. A 7.0 with spread 1 is a different answer from a 7.0 with spread 6.
- **Council confidence** (1 to 10): average CONVICTION x 2, rounded, minus 1 when the spread is 5 or more.
- **Evidence quality**: `0.5 x pack coverage + 0.5 x share of WHY points (Rounds 1 and 2) that cite at least one fact id`. High at 0.75 or more, medium at 0.5 or more, else low.
- **Lean pull**: how far the seats moved toward the investor's lean after the reveal. Per seat: (final score minus Round 1 score on the leaned option) minus the average of the same change on the other options. Weighted mean over seats that scored the leaned option in both rounds. Flagged at 1.0 or more: the report then names the seats that moved and the arguments they gave. `rawShift` is the plain change on the leaned option.
- **Votes and support** (Round 3): endorse, amend and dissent counts; support is the weighted mean of FINAL SCORE (how well the resolution captured the room, not whether the idea is good).
- **Scorecard**: one row per seat with its weight, dimension (from the roster), stance, vote, option scores, pillar score, conviction, evidence, ruin and door flags, and how far it moved on the recommended option. Any pillar score at 4 or below gets a named fix in the conditions, even when the label is good.
- **Thesis strength** (stress tests): the score of option A, "act on the thesis as written".

## Checks during the council

- **Unanimity (Round 1)**: every scoring seat's top option is the same and their scores on it are within 1 point. `score.mjs` flags it; the Chair names the strongest unargued case as a crux in Round 2.
- **Quick mode**: after Round 2, Round 3 runs when the spread on the top option is more than 3 or any seat is at RUIN RISK likely. `score.mjs` prints which.
