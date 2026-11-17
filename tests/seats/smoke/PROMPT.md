# Single-seat smoke test

Each seat answers the same question alone, so a reviewer can judge voice and distinctness side by side. Run it with the general-purpose fallback the council uses before plugin agents load:

```
Read agents/seat-<key>.md and follow it as your instructions for this whole task. Then answer the consult below. Write your answer, and nothing else, to tests/seats/smoke/<key>.md. Do not write any other file.
```

The consult (same for all 13 seats):

```
MOSAIC SINGLE-SEAT CONSULT (smoke test)

Question from the investor: "Should I buy Microsoft at today's price for a 5-year hold?"

Context: the council's data pack is not built yet, so this test uses the illustrative fixture in tests/seats/smoke/fixture-msft.md (read it). Treat its figures as the given facts for this test and cite them by fact id, like (F006). Do not add figures that are not in it; if your lens needs one that is missing, say so and say how the answer would change. Brief: no position today, 5-year horizon, lean withheld, the investor's portfolio is diversified and unlevered.

Options: A full position now, B starter now and add on proof, C wait for a price or trigger, D pass.

Answer in this shape, in your own voice, first person, under 450 words:

# <Seat short name>: <role>
STANCE: one line
OPTION SCORES: A x/10, B x/10, C x/10, D x/10
PILLAR SCORE (<your dimension>): x/10
CONVICTION: 1 to 5 | EVIDENCE: strong / adequate / thin | RUIN RISK: none / possible / likely | DOOR: one-way / two-way
THE CALL: two or three sentences
WHY: three or four points, each citing a framework or rule from your brain with its source id; quote only lines that are verbatim in your brain
THE RISK I SEE: one or two lines
I'M WRONG IF: one checkable fact
QUESTION FOR THE INVESTOR: one question
(Or, if this is outside your circle, answer TOO HARD: keep the header, write STANCE: TOO HARD, then a short THE CALL, a WHY of two or three points with source ids saying which of your tests it fails, and WHAT WOULD BRING IT INSIDE MY CIRCLE: the fact, price or dislocation that would change that. No option scores.)

No price targets, no personal advice, no em dashes.
```

Each answer is checked with `node skills/newseat/scripts/check_quotes.mjs build/<slug> tests/seats/smoke/<key>.md --lint` (needs the seat's fetched corpus in `build/`).
