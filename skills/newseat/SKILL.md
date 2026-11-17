---
name: newseat
description: Use when someone wants to add or rebuild an investor seat on the Mosaic council, says "/newseat", "add a seat", "add [name] to the council", "build a seat for [investor]", or "refresh the [name] brain". Builds the seat the same way the 13 original seats were built. It finds and fetches the investor's free primary sources (letters, memos, papers, speeches, testimony, long interviews), extracts their frameworks, rules, positions, selling rules, stories and voice with parallel sub-agents, writes the brain, checks every quote is verbatim, writes the seat agent, and registers the seat in the roster. Not for running a council (that is /mosaic). Portraits are made separately.
argument-hint: "[full name] [--quick | --deep] [--role \"...\"] [--default] [--guard ruin|bear]"
---

<!-- Adapted from nateherkai/roast-room (.claude/skills/newroaster/SKILL.md). MIT License, Copyright (c) 2026 AI Automation Society. See LICENSE-roast-room.txt in this folder. -->

## What this does

Adds one seat to Mosaic. A seat is three things, and this skill makes all three:

1. **A brain**: `skills/mosaic/brains/<slug>/`, eight files compiled from the investor's free public work, every quote verbatim with a source id.
2. **An agent**: `agents/seat-<key>.md`, the sub-agent that reasons and talks like them from that brain. As a plugin it is spawned as `mosaic:seat-<key>`.
3. **A roster entry**: one line in `skills/mosaic/roster.json`, so `/mosaic` knows the seat exists.

The raw sources stay in a local build folder that git ignores. Only the brain ships. Portraits are generated separately and are not part of this skill.

All paths below are relative to the Mosaic root: the repo root in a clone, or `${CLAUDE_PLUGIN_ROOT}` when installed as a plugin. Run the scripts from that root. Build folder: `build/<slug>/`.

Read before the first run: `references/brain-spec.md` (the brain layout and its rules), `references/extract-prompt.md` (what each extraction agent gets), `references/writer-prompt.md` (what each brain writer gets), `references/agent-template.md` (the seat agent).

## Who can be a seat

- **Investors with a real body of free public work**: shareholder letters, memos, papers, blog posts, speeches, testimony, long interviews where they are the main speaker. Living or historical.
- **Not**: fictional characters, private people, or anyone whose free public work is too thin. Under about 12 usable sources or 60,000 words, say so and offer `--quick` with the limit written into `sources.md`, or a different person.
- **Not from books.** Copyrighted books are never fetched or quoted. Their frameworks may go in as paraphrase with the book named, and a line may be quoted only when it also appears in a fetched free source.

The seat is a simulation, not the person, and never reads as that person endorsing a security. The agent says so if asked, and only quotes what is in its brain.

## Depth

| Flag | Sources | Words | Extraction agents | Use it for |
|---|---|---|---|---|
| `--quick` | 12 to 20 | 80k+ | 2 to 3 | Thin public records (no letters, books copyrighted) |
| default | 30 to 50 | 250k+ | 4 to 6 | A seat you will actually use |
| `--deep` | 80+ | 500k+ | 8 to 12, in waves | Investors with decades of letters or memos |

Quality beats count: one annual letter is worth ten news clips. A quick build says in `sources.md` why it is quick and what that limits.

## Step 1: Who and what seat

From the user's message, get the investor's full name. If anything below is missing, ask in one AskUserQuestion batch (at most four questions), offering your best guess as the first option:

1. **The investing lens (role) and the question the seat owns.** Propose one from what the investor is known for, worded like the existing seats in `roster.json` (role: a few words; question: one plain question an investor faces on one decision). If an existing seat already owns that lens, propose a sharper angle so the two seats argue instead of repeating each other (see the overlap table in `docs/research/legends.md`).
2. **Default board?** At the table for every council, or on call (`--seats` and `ask`). If the default board already has nine seats, ask who they replace.
3. **Guard?** Only if they should become the ruin guard or the bear guard (replacing the current one).
4. **Depth**: quick, default, or deep.

Then fix the names: `key` (short lowercase, letters only, unique in the roster, usually the surname), `slug` (`first-last`), `short` (how the council names them), and the scorecard `dimension` (a few words for what this seat scores, like "Ruin and convexity").

Check the roster first: if the investor already has a seat, stop and offer to refresh it instead (step 3 onward on the same slug; fetch skips sources already in `sources.json`).

## Step 2: Find sources

Use WebSearch to build a source list, best first. Look for:

- Their own letters, memos, papers, blog or newsletter archive (the richest text, with dates). Fund letters are usually PDFs on the firm's site.
- Speeches, lectures and congressional testimony with a text transcript.
- Long interviews and podcasts where they are the main guest, as a **text transcript page** (podcast sites, conference sites, transcript archives). YouTube often blocks cloud machines; a video link is the last resort.
- Recent material (last two years) so `positions.md` reflects current views, and a spread of years so changes of mind show up.

Skip clips under about 10 minutes, news articles that only quote them in passing, fan summaries, and pieces where someone else does most of the talking. Never fetch pirated or paywalled book text.

Write the list to `build/<slug>/urls.txt`, one source per line as `url | title | YYYY-MM-DD | kind`, with a `# heading` line per group. Title and date matter: PDF letters rarely carry a usable title. Aim for the source count of the chosen depth plus about 20 percent, since some will fail.

## Step 3: Fetch

```bash
node skills/newseat/scripts/fetch.mjs build/<slug> --list build/<slug>/urls.txt
```

Each source becomes `build/<slug>/corpus/S001-<title>.md`, logged in `build/<slug>/sources.json`. It prints `ok`, `skip`, `thin` (paywall, scanned PDF, or a JavaScript page), or `fail` per URL, then a manifest. For a text you had to get another way (a page the script cannot reach, read with a fetch tool and saved verbatim):

```bash
node skills/newseat/scripts/fetch.mjs build/<slug> --add path/to/file.md --title "..." --url <original url> --date 2024-05-01 --kind transcript
```

If a source came back thin or failed, find a different copy or replace it. Re-run until the manifest meets the depth target, then open two or three corpus files to confirm they are clean text by the right person. Keep the manifest numbers for the final report.

## Step 4: Extract (map)

Split the sources into batches of about 50,000 to 70,000 words each (`node skills/newseat/scripts/plan_batches.mjs build/<slug> --words 60000` writes `build/<slug>/batches.json` and prints the batches). Spawn one extraction agent per batch, in **one message**, in parallel: `subagent_type: general-purpose`, `model: sonnet`, with the prompt from `references/extract-prompt.md` (fill in the name, role, question, the batch's source ids and file paths, and the notes file to write). Run at most six at a time; for `--deep`, run them in waves.

Each agent writes `build/<slug>/notes/batch-NN.md` and checks its own quotes. When all are back, check every note quote:

```bash
node skills/newseat/scripts/check_quotes.mjs build/<slug> build/<slug>/notes
```

Fix what it reports: correct a wrong source id, delete a quote it cannot find. Notes with no verifiable quote can stay as paraphrase, marked "inferred from S0xx".

## Step 5: Write the brain (reduce)

Create `skills/mosaic/brains/<slug>/`. Write `sources.md` with the script, then add the depth and thin-source paragraph under its header:

```bash
node skills/newseat/scripts/fetch.mjs build/<slug> --sources-md skills/mosaic/brains/<slug>/sources.md --name "Full Name"
```

Then spawn three writer agents in one message, in parallel (`general-purpose`, default model), with the prompt from `references/writer-prompt.md`. For a deep build whose notes run past about 80,000 words, first split the notes by section with `node skills/newseat/scripts/split_notes.mjs build/<slug>` (it writes `build/<slug>/sections/frameworks.md`, `rules.md`, `positions.md`, `selling.md`, `stories.md`, `voice.md`, `limits.md`) and point each writer at only the sections it needs:

- Writer A: `frameworks.md` and `principles.md`.
- Writer B: `positions.md`, `stories.md` and `selling.md`.
- Writer C: `voice.md`.

When they are back, write `_hot.md` yourself from the finished files (the spec lists what goes in it, including the scoring guidance, natural opponents and "where this lens misfires"). Then check the whole brain:

```bash
node skills/newseat/scripts/check_quotes.mjs build/<slug> skills/mosaic/brains/<slug> --lint
```

Fix until it passes: every quote verbatim, every id right, no dashes, no unsourced quotes. Read `_hot.md` once more as the agent will: it should tell you how this investor decides, in their words, in under 950 words.

## Step 6: Write the agent

Write `agents/seat-<key>.md` from `references/agent-template.md`. Fill every bracket from the brain: the lens (five or six questions this investor asks of any position), how they talk (from `voice.md`), how they debate (name their natural opponents among the seats in `roster.json` and what they concede), where the lens misfires, and the never-list. The description names the role, the source count and what the brain is built from, and the trigger phrases ("what would [name] say").

## Step 7: Register the seat

```bash
node skills/newseat/scripts/add_seat.mjs --key <key> --name "<Full Name>" --short "<Short>" --slug <slug> --role "<role>" --question "<question>" --dimension "<dimension>" [--guard ruin|bear] [--default] [--swap <key>]
```

It refuses if the agent file or a brain file is missing. Then add one or two natural-tension lines for the new seat to `skills/mosaic/references/seats.md` if that file exists (who they clash with, and over what).

## Step 8: Test the seat

New agent files load when Claude Code starts, so test with the fallback the council itself uses: spawn `general-purpose` with `Read agents/seat-<key>.md and follow it as your instructions for this whole task. Only read files; do not write anything.` followed by a single-seat question in the seat's lane (the shared smoke question is "Should I buy Microsoft at today's price for a 5-year hold?"). Save the answer to `build/<slug>/test-consult.md` and check it:

- It sounds like the investor (compare with `voice.md`), speaks in the first person, and never claims to be them.
- It names frameworks with source ids, and every quote passes `check_quotes.mjs`.
- It owns its question instead of giving generic advice, and gives no price target or personal advice.

If it fails, fix the agent or `_hot.md` and test again, once.

To check every seat at once (brain, agent and smoke answer, with `--lint`), run `node skills/newseat/scripts/check_all.mjs --markdown`.

## Step 9: Report

Tell the user, in under 150 words: who was added, their role and question, whether they are on the default board or a guard; the brain (sources, words, years covered, files written, quote-check count); how to use them (`/mosaic ask <key> ...`, `/mosaic --seats <key>,buffett,... ...`, `/mosaic board`); and one line to restart Claude Code (or reload the plugin) so the seat loads as its own agent type.

## Without sub-agents (Codex or a runtime that cannot spawn agents)

Run steps 4 and 5 yourself, one batch at a time: extract a batch into its notes file, then move to the next. Write the brain files one at a time from the notes. Everything else is the same.

## Rules

- Public, free and lawful sources only. The corpus stays in the build folder and is never committed or shared; the brain holds short quotes (under 45 words) and paraphrase, never book text.
- Every quote in the brain is verbatim and passes `check_quotes.mjs --lint`. A line with no source is inference and says so.
- No price targets, no personal advice, and nothing that reads as the real person endorsing a security.
- Do not touch the other seats' brains or agents. Only `roster.json`'s `"seats"`, `"default"` and `"guards"` change, through `add_seat.mjs`.
- Plain English in everything you write yourself: short sentences, no em dashes, no filler.
- Cost: a default seat is about 8 to 10 sub-agent runs; a deep seat about 15. Say which depth you used.
