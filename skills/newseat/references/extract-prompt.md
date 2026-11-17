# Extraction prompt (map step)

<!-- Adapted from nateherkai/roast-room (.claude/skills/newroaster/references/extract-prompt.md). MIT License, Copyright (c) 2026 AI Automation Society. See ../LICENSE-roast-room.txt. -->

One agent per batch of about 50,000 to 70,000 words. Spawn them in one message, in parallel: `subagent_type: general-purpose`, `model: sonnet`. Replace the bracketed parts.

```
MOSAIC SEAT BUILD: EXTRACT NOTES

You are building the brain for a Mosaic council seat: [Full Name], who holds the [role] seat (the investing lens) and owns the question "[question]". The brain teaches an agent to reason, decide, and talk like this investor when a user brings one investment decision (buy, add, hold, trim, sell). Your job is one batch of their public sources.

Repo root: [absolute path]
Read these source files in full (each opens with its title and "Source: S0xx | url | date | kind"):
[one line per source: S0xx | build/<slug>/corpus/S0xx-....md | words]

Write your notes to: [build]/notes/batch-[NN].md
Write nothing else. Do not edit the source files.

For each source, add a section "## S0xx | [title] | [date]" with these parts. Skip a part when the source has nothing for it. Only extract what [Full Name] says or writes; ignore the host, the interviewer, co-authors' separate sections, other guests, and quoted third parties (a line [Full Name] quotes from someone else is not their quote; note it as "quoting X" if it matters).

### Frameworks
- **[Name as they call it, or a short name + (unnamed)]**: what it is, its parts or steps, when they use it, and any threshold or number they attach (a hurdle rate, a multiple, a position-size cap, a holding period). Quote: "[verbatim]" (S0xx)

### Rules
- [A decision rule in one plain sentence.] Quote: "[verbatim]" (S0xx)

### Positions
- [Topic]: [their stance in one line, with the date of the source]. Quote: "[verbatim]" (S0xx)
  Topics that matter most: what price to pay, valuation method, concentration, position sizing, leverage, market timing, macro and the Fed, rates, inflation, cash, cycles and bubbles, crashes, growth versus value, technology and AI, index funds, credit, gold and crypto, shorting, hedging and options, buybacks and dividends, management and incentives, stock-based compensation, accounting, activism, IPOs, China and emerging markets, holding period, taxes, mistakes. Anything they feel strongly about counts too.

### Selling and re-checking
- When and why they sell, trim, add, or re-check a position; what breaks a thesis; what they say about selling too early or too late; how they react to a falling price. Quote: "[verbatim]" (S0xx)

### Stories
- [The investment, trade, or episode in one line]: [the lesson they draw]. (S0xx)

### Voice
- Signature phrases, verbatim. Analogies they reach for. How they open, argue, disagree, and close. Words or moves they avoid.
- Two or three voice anchors: short verbatim lines (under 45 words) that sound most like them. "[verbatim]" (S0xx)

### Limits
- Anything they say about where their approach does not apply, mistakes they admit, or views they changed (with the date). (S0xx)

Quote rules, which a script checks against the source files:
- Copy quotes character for character from the source file, including their grammar and filler words. Never fix, merge, or paraphrase inside quotation marks.
- Every quote is under 45 words and is followed by its source id in parentheses.
- A quote may skip words with "..." only inside one passage.
- Replace any em or en dash inside a quote with a comma (the checker ignores punctuation). Never write an em or en dash yourself.
- If you cannot find the exact words, write the point as paraphrase with no quotation marks.
- PDF text can break words across lines or carry page headers; quote only clean runs of text.

At the end, add "## Batch summary": the five frameworks and five rules that came up most in this batch, with source ids.

When done, run: node skills/newseat/scripts/check_quotes.mjs [build] [build]/notes/batch-[NN].md
Fix anything it reports (correct the id, or cut the quote to paraphrase) and run it again until it passes.

Reply with one line: the notes path, and how many frameworks, rules, positions, and quotes you wrote, and the checker result.
```
