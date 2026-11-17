# Report template (the Chair's verdict)

Adapted from Roast Room's report template (MIT, Copyright (c) 2026 AI Automation Society; see NOTICE).

Plain English. No em dashes. No filler, no tee-ups, no hype. Seat quotes keep their own voice. Every number carries its fact id. After writing `verdict.md`, run `check-citations.mjs` on the session again: it checks the verdict too, and every quote or fact id it fails comes out before `verdict.json` is written.

**Attribute, never instruct.** The call says what the council would do ("The council would start small now and add only when..."), never what the investor should do ("Start small now..."). The same goes for every line in "What to do next". Under about 1,100 words; the round files hold the detail. Copy numbers from `scores.json`; do not recompute.

```markdown
# Mosaic: [decision in a few words]

[date] · [TICKER or Macro or Portfolio] · Job: [decision | thesis stress test | portfolio review | macro question] · Seats: [list] · Rounds: [n] · Mode: [full | quick | named | all]
Data as of [pack asOf] · Coverage [n]% · [one-line data health]

## Verdict: [CONVICTION EARNED | PROCEED WITH CONDITIONS | RESHAPE THE THESIS | PASS | WAIT FOR THE PITCH | INSUFFICIENT EVIDENCE]

**The call:** The council would [one or two sentences naming the option, attributed to the council, never an instruction].

Mosaic grades how a decision was made. It is not investment advice.

Option scores: A x.x · B x.x · C x.x · D x.x · Conviction x.x · Spread n · Confidence n/10 · Evidence [high | medium | low] · Lean pull [x.x toward A | not measured]
[Each override applied, one line with its reason. For WAIT FOR THE PITCH, the trigger. For INSUFFICIENT EVIDENCE, the underlying label.]

## Where they disagree

[Lead with the disagreement. One short block per crux: the question, who was on each side, who moved and why, how it resolved or why it did not.]

## Minority report

[The strongest dissent in the seat's own words (copied from a card), and what would have to be true for it to be right. If every seat agreed, say so and name the least-tested assumption.]

## Scorecard

| Seat | Dimension | Weight | Agreement | In their words | A | B | C | D | Pillar | Moved | Their line |
|---|---|---|---|---|---|---|---|---|---|---|---|

Agreement is `scorecard[].agreement` from `scores.json` (derived from the seat's scores on the recommended option). "In their words" is the seat's own VOTE line, verbatim; when it reads differently from the agreement, show both.

Abstained (TOO HARD): [seats, or "none"]
Math: [the option math lines from scores.json]

## Why the council landed here

[Three to five bullets: the arguments that carried the room, each with the seat, the framework and fact ids.]

## What the price implies

[One or two sentences from the pack's implied-growth and DCF-range facts, with ids. A range, never a target.]

## Pre-mortem

1. [It is twelve months from now and this went badly because...]
2. ...
3. ...

## Kill criteria

[Each checkable against a future pack: the fact, the threshold, the fact id. Evidence, not price.]

## Conditions

[Each checkable. Say which must clear before any irreversible step.]

## Re-check

[Date] · Triggers: [next report, a filing, a kill criterion] · Command: `/mosaic recheck [TICKER]`

**Cheapest test:** [the smallest step that checks the riskiest assumption]

## Sizing, as education

[Survivable-loss framing from the pack: "the record shows a fall of x% [F0xx]; at a position of p% of your portfolio, that would cost p times x". Ask whether the investor could hold through it. Never a recommended percentage.]

## Behavioral flags

[The user's own words the Chair flagged (FOMO, anchoring, sunk cost), and the lean pull with the seats that moved. Omit when there are none.]

## Data health

[Which sources answered, which fell back, what was missing, and the warnings from the pack. Facts the verdict could not rest on because they were missing.]

---
Simulated council for education. Seats are simulations built from each investor's public work; they are not the people, are not affiliated with them, and do not speak for them. Not financial advice. Numbers as of [date]; verify against the filings.
```

## Chat summary (under 200 words)

1. The label and the council's call ("The council would...").
2. Exactly: "Mosaic grades how a decision was made. It is not investment advice."
3. Option scores on one line.
4. The three arguments that carried the room, one line each, with the seat.
5. The sharpest dissent, one line, with the seat.
6. Kill criteria and the re-check date.
7. Evidence quality and lean pull.
8. The path to `verdict.md`, and "Watch it again with `/mosaic room`".
