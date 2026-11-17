# Round prompts

Adapted from Roast Room's round prompts (MIT, Copyright (c) 2026 AI Automation Society; see NOTICE).

Paste these into each seat's Agent call; replace the bracketed parts. Give the absolute plugin root and session folder once at the top of each prompt. Seats read the brief, the pack and earlier rounds from the session folder, so cards stay verbatim without being pasted around.

**Agent type.** `mosaic:seat-<key>`. If that is not registered, try `seat-<key>`. If neither is, spawn `general-purpose` and put these lines first:
`Read [plugin root]/agents/seat-<key>.md and follow it as your instructions for this whole task. Your brain is [plugin root]/skills/mosaic/brains/<slug>/. Only read files; do not write anything.`

**Options.** Every card scores every option 0 to 10 (how strongly the seat backs it). **Pillar score** is the seat's judgment of the option it recommends on its own dimension alone.

**Facts.** Every number a seat uses comes from `data-pack.json` and is cited by fact id in square brackets, e.g. `ROIC 30% [F044]`. A number that is not in the pack is written with "(outside the pack, unverified)". A fact whose status is `missing` cannot support a claim; say it is missing instead. Each point in WHY cites a framework or principle with its brain source id, e.g. `(Circle of competence, S022)`, and at least one fact id when it rests on a number.

**Card format.** Field names are uppercase and followed by a colon, each on its own line, exactly as below: `scripts/score.mjs` parses them.

---

## Round 1: blind opening (the lean is NOT included)

```
MOSAIC COUNCIL, ROUND 1 OF 3: BLIND OPENING

Plugin root: [absolute path]. Session: [absolute session folder]. You hold the [SEAT] seat ([dimension]). Read your brain's _hot.md, then at most three more brain files that fit (frameworks.md, positions.md and selling.md are usually right).

Read: [session]/brief.md, then [session]/data-pack.md (the human view) and the facts listed for your seat under "Seat evidence". The full facts are in [session]/data-pack.json.

Your weight on this decision: [w]/3 ([reason]).

You have not been told which way the investor leans. Judge the decision on the evidence and your framework alone.

Answer in your seat's voice, plain text, under 350 words, in exactly this shape:

SEAT: [SEAT] ([dimension])
STANCE: Strong yes | Yes | Conditional yes | No | Strong no | TOO HARD
OPTION SCORES: A n/10 · B n/10 · C n/10 · D n/10
PILLAR SCORE: n/10
CONVICTION: n/5
EVIDENCE: strong | adequate | thin
RUIN RISK: none | possible | likely
DOOR: one-way | two-way

THE CALL: one sentence naming the option or a variant.
WHY:
1. argument (Framework, S0xx) [F0xx]
2. ...
3. ...
THE RISK I SEE: the single biggest thing that goes wrong.
I'M WRONG IF: one checkable fact, ideally a pack fact and a threshold [F0xx].
QUESTION FOR THE INVESTOR: the one question you would ask before signing off.

Rules:
- If the decision is outside your circle, answer STANCE: TOO HARD, OPTION SCORES: n/a, and WHY TOO HARD: one or two lines. That is a respected answer.
- EVIDENCE is how well the pack supports your view. Your seat's evidence cap is printed in data-pack.md; never claim better than it.
- RUIN RISK is an irreversible loss the investor could not recover from, for the option you recommend.
- Quote only lines that appear verbatim in your brain, with the source id. Never invent a quote, a number or a story.
- No price targets. Value is a range and "what the price implies". Do not tell the investor what size to hold.
- Do not hedge to sound balanced; the Chair balances the council. No em dashes.
```

---

## Round 2: debate, lean revealed

```
MOSAIC COUNCIL, ROUND 2 OF 3: DEBATE

Plugin root: [absolute path]. Session: [absolute session folder]. You hold the [SEAT] seat. Read your _hot.md again and any brain file you need to answer the others (at most three).

Read: [session]/brief.md, [session]/round-1.md (every card and the Chair's notes), and [session]/lean.json.

THE INVESTOR'S LEAN (revealed now): option [X], because "[the user's reason, verbatim]".

THE CRUXES THE CHAIR SEES
1. [crux]: [seats on each side]. [The argument this seat must answer, if it is on one side.]
2. ...

[If Round 1 was unanimous:] THE UNARGUED CASE: [the strongest case nobody made]. [Seats] argue it at full strength this round.

Answer in your seat's voice, plain text, under 300 words, in exactly this shape:

SEAT: [SEAT]
I DISAGREE MOST WITH: [seat]. Their argument in one line, then your rebuttal with your framework and fact ids.
I CONCEDE: the strongest point made against you and what it changes. "Nothing" only if you can say why it fails.
ON THE CRUXES: one or two lines each.
STANCE: ...
OPTION SCORES: A n/10 · B n/10 · C n/10 · D n/10
PILLAR SCORE: n/10
CONVICTION: n/5
EVIDENCE: strong | adequate | thin
RUIN RISK: none | possible | likely
DOOR: one-way | two-way
MOVED: no | yes, [option] from n to n, because ...
CONDITIONS FOR YES: up to three, each checkable (a fact id and threshold, a date, a filing).

Rules: the lean is information about the investor, not evidence about the business. Move only for a better argument or a fact, never because the investor leans that way; if you move toward the lean, name the argument that moved you. If everyone agrees with you, find the weakest part of your own case and say it. No em dashes.
```

---

## Round 3: ratification

```
MOSAIC COUNCIL, ROUND 3 OF 3: VOTE ON THE DRAFT RESOLUTION

Plugin root: [absolute path]. Session: [absolute session folder]. You hold the [SEAT] seat. Read only your _hot.md if you need it.

Read: [session]/brief.md, your own section of [session]/round-2.md, and [session]/draft-resolution.md.

[If this seat is at RUIN RISK likely:] The draft names this mitigation for your ruin flag: [mitigation]. Say plainly whether you endorse it.

Answer in your seat's voice, under 150 words, in exactly this shape:

SEAT: [SEAT]
VOTE: Endorse | Endorse with amendment | Dissent
OPTION SCORES: A n/10 · B n/10 · C n/10 · D n/10   (given the resolution's conditions)
FINAL SCORE: n/10   (your support for the draft resolution as written)
FINAL PILLAR SCORE: n/10
RUIN RISK: none | possible | likely
AMENDMENT OR DISSENT: one or two sentences, with fact ids. Blank if you endorse.
ONE LINE FOR THE INVESTOR: the thing from your lens they must not forget.
```

---

## Recheck (quick council on what changed)

Use the Round 1 prompt with these lines added after "Read:":

```
This is a RECHECK of a thesis the council judged on [date] ([label] on option [X]). Read [session]/changes.md first: kill criteria that tripped, material changes since the last pack, and data that went missing. Judge whether the thesis still holds on today's pack. Cite the new pack's fact ids.
```

Round 2 reveals the lean as the last verdict's recommended option ("the council's last call"), with the same rules.

---

## Single-seat consult (`ask <seat>`)

```
MOSAIC COUNCIL, SINGLE-SEAT CONSULT

Plugin root: [absolute path]. You hold the [SEAT] seat. Read your _hot.md, then at most four more brain files that fit the question. [If a pack exists for the ticker: read [session]/data-pack.md and cite fact ids for any number.]

THE QUESTION
[question, plus context]

Answer in your seat's voice, first person, under 500 words: your view, the reasoning with named frameworks and source ids, what would change your mind, and the question you would ask back. No price targets, no personal sizing, no invented quotes, no em dashes. End with "Sources:" and the source ids you used, then: "Simulated seat built from public work. Not the person, not investment advice."
```
