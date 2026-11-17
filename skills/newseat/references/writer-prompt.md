# Writer prompt (reduce step)

<!-- Adapted from nateherkai/roast-room (.claude/skills/newroaster/references/writer-prompt.md). MIT License, Copyright (c) 2026 AI Automation Society. See ../LICENSE-roast-room.txt. -->

Three writers per seat, spawned in one message, in parallel: `subagent_type: general-purpose` (default model). Replace the bracketed parts. Writer A gets `frameworks.md, principles.md`; Writer B gets `positions.md, stories.md, selling.md`; Writer C gets `voice.md`. For a quick build one writer may take all six files.

```
MOSAIC SEAT BUILD: WRITE THE BRAIN

You are writing part of the brain for a Mosaic council seat: [Full Name], who holds the [role] seat and owns the question "[question]" (scorecard dimension: [dimension]). The brain teaches a council agent to reason, decide, and talk like this investor when a user brings one investment decision, so it must capture how they decide, not their biography.

Repo root: [absolute path]
Read first:
- skills/newseat/references/brain-spec.md (layout, budgets, and rules). Depth: [quick | default | deep].
- Every notes file in [build]/notes/ (their quotes are already verified verbatim).
- skills/mosaic/brains/[slug]/sources.md (the source id table, with dates).
You may open a corpus file in [build]/corpus/ only to check a quote's context or who is speaking.

Write exactly these files into skills/mosaic/brains/[slug]/ and nothing else: [files].

Rules:
- Copy every quote exactly from the notes, with its source id, like "..." (S014). Quotes stay under 45 words. Quotation marks mean verbatim: paraphrase goes without them.
- Merge duplicates across batches and count sources across all of them. Most-used first.
- Weight what an investor would bring to this seat: decisions in [role]. Keep off-topic material (politics, philanthropy, family) thin unless it shapes how they invest.
- Where views changed over time, show both with dates and mark the newer one.
- Lines that are your reading of several sources say "inferred from S0xx, S0yy".
- Never quote a copyrighted book unless the line is in a corpus file. Book ideas are paraphrase with the book named.
- No price targets and no calls on today's securities. Record their dated public stances only.
- No em dashes or en dashes anywhere, including inside quotes (use a comma). Plain English, no filler.

When done, run: node skills/newseat/scripts/check_quotes.mjs [build] skills/mosaic/brains/[slug] --lint
Fix anything it reports in your files, and run it again until your files pass. (Lint lines in files you do not own are not yours to fix.)

Reply with one line: files written and entry counts.
```
