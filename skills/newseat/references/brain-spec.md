# Brain spec: one seat on the Mosaic council

<!-- Adapted from nateherkai/roast-room (.claude/skills/newroaster/references/brain-spec.md). MIT License, Copyright (c) 2026 AI Automation Society. See ../LICENSE-roast-room.txt. -->

Every seat has the same brain layout, so the seat agents differ only in content. All 13 seats follow this spec; new seats must too.

Folder: `skills/mosaic/brains/<slug>/`

A brain teaches an agent how one investor decides: what they look at first, what they refuse, what makes them buy, size, hold, sell, and how they talk while doing it. It is not a biography and not a fan page. It includes where they were wrong.

## Files

| File | Budget (default depth; `--quick` may run about half, `--deep` toward the top) | Contents |
|---|---|---|
| `_hot.md` | 650 to 950 words | Read on every council call. Who the seat is: the **investing lens** (role), the question it owns, the scorecard dimension, the corpus in one line. Worldview in three sentences. The 8 rules they decide by, each with one short verbatim quote and source id. The 5 frameworks they reach for first. Their decision loop for one stock decision (5 or 6 steps). Signature questions they ask an investor. **How this seat scores its dimension** (what a 0, 5 and 10 look like, from their own thresholds, labeled as guidance). A voice cheat sheet (5 lines). **Natural opponents** among the 13 seats. **Where this lens misfires.** |
| `frameworks.md` | 12 to 25 entries | Name (as they name it, or a short name marked *(unnamed)*), what it is, parts or steps, when to use it on a stock decision, how to score a decision with it (scoring guidance from their own thresholds and numbers, labeled as guidance), one verbatim quote with source id, and how many sources use it (with ids). Frameworks taught mainly in copyrighted books go in as paraphrase, marked "taught in <book>; paraphrase", with a quote only if the line also appears in a fetched free source. Most-used first. |
| `principles.md` | 15 to 30 entries | Decision rules in one plain sentence, one or two verbatim quotes with source ids, number of supporting sources, confidence (high = 3+ sources, medium = 2, low = 1). |
| `positions.md` | 20 to 40 topics | Their stance on the questions investors bring: what price to pay and multiples, valuation method, concentration versus diversification, position sizing, leverage and margin, market timing, macro and the Fed, interest rates, inflation, cash, cycles and bubbles, bear markets and crashes, growth versus value, technology and AI, index funds, bonds and credit, gold and crypto, shorting, hedging and derivatives, buybacks and dividends, management and incentives, stock-based compensation, accounting quality, activism, IPOs, emerging markets and China, holding period and turnover, taxes, learning from mistakes. Verbatim quote, source id, and date. When they changed their mind, record both views side by side with dates and mark the newer one. Topics with no evidence say "no recorded position"; never guess. |
| `voice.md` | 400 to 700 words | How they talk: sentence length, cadence, signature phrases (verbatim, with how many sources use them), go-to analogies, how they open and close an argument, how they disagree, words and moves they never use. Then 8 to 12 short verbatim voice anchors (under 45 words each, with source ids). |
| `stories.md` | 10 to 20 entries | The investments, mistakes and case studies they reuse, one or two lines each with the lesson and source ids. Losers and mistakes count as much as winners. |
| `selling.md` | 8 to 15 rules, then two short lists | **New in Mosaic.** Their rules for selling, trimming, adding and re-checking a position: what breaks a thesis, valuation exits, better-opportunity swaps, position-size limits, how they treat a falling price, what they say about selling too early or too late. Each rule with a verbatim quote and source id where one exists. Then **Kill criteria this seat would write** (checkable facts that would end the thesis, in their style) and **Re-check triggers** (events and cadences they watch). Mistakes they admit about selling go here with dates. |
| `sources.md` | all | Written by `fetch.mjs --sources-md`: a header with counts and total words, then `id | title | url | date | kind | words` per source. Add one paragraph under the header on the build depth and any **thin-source limits** (for example: "books are copyrighted and not quoted; frameworks from them are paraphrase"). |

Each file opens with a `# <File>: <Full Name>` heading and one line on what it was built from.

## Rules

- Every quote is verbatim from the corpus and carries a source id from `sources.md`, like "..." (S014). Quotes stay under 45 words. `check_quotes.mjs --lint` must pass on the whole folder.
- Quotation marks mean verbatim. Signature questions, paraphrases, and your own summaries go without them, so no agent later passes them off as the person's words.
- Never attribute a view without a source id. A line that is your reading of several sources says "inferred from S0xx, S0yy".
- Never quote a copyrighted book unless the same line is in a free source that was fetched into the corpus. Book ideas go in as paraphrase with the book named.
- Plain English. No em dashes or en dashes anywhere, not even inside quotes (a dash inside a quote becomes a comma or "..."; the checker ignores punctuation). No filler.
- **Where this lens misfires** is mandatory in `_hot.md`: the situations where this investor's approach is known to fit badly (a cycle reader on a 20-year compounder, a Berkshire-scale rule applied to a small account, a short seller's lens on an honest reinvestor). Use what they say about their own limits first, then the shape of their record.
- Every seat must be able to say **TOO HARD** (outside its circle) and abstain. `_hot.md` names what puts a decision outside this seat's circle.
- No price targets, no personal advice. A brain records the person's public stances with dates; it does not turn them into a call on today's stocks.
- Prefer newer sources when views changed, and say so with dates.
