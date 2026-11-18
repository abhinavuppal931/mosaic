# Single-seat smoke test

Every seat answers the same question alone, so a reviewer can judge voice and distinctness side by side: "Should I buy Microsoft at today's price for a 5-year hold?"

The session folder `session-msft/` is a normal council session in the core format:

- `brief.md` and `council.json`: the decision, four options, all 13 seats and their weights. A real council seats at most nine; this test seats all 13 so every seat is exercised.
- `data-pack.json` and `data-pack.md`: the live MSFT pack from the core session's fixtures (as of 2026-11-17, 135 facts, coverage 73%).
- `round-1.md`: the 13 Round 1 cards, saved verbatim under `## <short name>` headings.

## How the cards were made

Each seat got the Round 1 prompt from `skills/mosaic/references/round-prompts.md` exactly as the Chair sends it (blind, lean withheld), with the general-purpose fallback lines first:

```
Read <plugin root>/agents/seat-<key>.md and follow it as your instructions for this whole task. Your brain is <plugin root>/skills/mosaic/brains/<slug>/. Only read files.
```

Each card was then checked against that seat's fetched corpus with `node skills/newseat/scripts/check_quotes.mjs build/<slug> <card> --lint`, and every fact id against `data-pack.md`.

## How to check them

- `node --test tests/seats/` parses the 13 cards with the core parser, runs the council math and runs the core citation checker against the real brains (these three tests skip when the core scripts are not present).
- `node scripts/score.mjs tests/seats/smoke/session-msft --no-write` prints the Round 1 math.
- `node scripts/check-citations.mjs tests/seats/smoke/session-msft --no-write` checks every quote and fact id.
- `node skills/newseat/scripts/check_all.mjs --markdown` checks each card's quotes against the seat's corpus (needs `build/`).
