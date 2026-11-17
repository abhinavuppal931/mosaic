# Session files: the contract the Room reads

Every council writes one folder, `<sessions>/YYYY-MM-DD-<slug>/` (find `<sessions>` with `node <plugin root>/data/cli.mjs paths`). The Room watches that folder and plays the council as files appear; it makes no AI calls. Write each file at the moment listed, as plain UTF-8: JSON without comments or trailing commas, Markdown with the headings shown. A complete finished example lives in `tests/core/fixtures/session-msft/`.

Seat names in JSON use roster keys (`buffett`); Markdown headings use the roster's `short` name (`## Buffett`). Dates are `YYYY-MM-DD`; times are ISO 8601 UTC. Money is never shown in dollars for the user's own position: use percents.

Adapted from Roast Room's live-room contract (MIT, Copyright (c) 2026 AI Automation Society; see NOTICE).

## Write order

| Step | File | Written by | The Room shows |
|---|---|---|---|
| Intake | `council.json`, `brief.md` | Chair | The table assembles: seats, weights, options |
| Intake (portfolio) | `holdings.json` | Chair | Holdings and weights |
| Data | `data-pack.json`, `data-pack.md` | `data/cli.mjs pack` | Data-health strip |
| Recheck only | `changes.json`, `changes.md` | `scripts/journal.mjs diff` | "What changed" panel |
| Round 1 | `round-1.md` | Chair (cards verbatim) | Blind opening cards, one seat speaking at a time |
| After Round 1 | `scores.json` (interim) | `scripts/score.mjs` | Interim option scores |
| After Round 1 notes | `cruxes.json` | Chair | Fault lines between seats |
| Lean reveal | `lean.json` | Chair | The lean reveal moment |
| Round 2 | `round-2.md`, then `scores.json` | Chair, `score.mjs` | Debate cards, rebuttal arrows, moves |
| Draft | `draft-resolution.md`, `draft.json` | Chair | The proposal |
| Round 3 | `round-3.md`, then `scores.json` | Chair, `score.mjs` | Votes land |
| Verify | `citations.json` | `scripts/check-citations.mjs` | Verified quote and fact counts |
| Verdict | `verdict.md`, then `verdict.json` **last** | Chair | The verdict; `verdict.json` means the council is over |
| Journal | `<journal>/<KEY>.json` | `scripts/journal.mjs add` | Journal screen |

A folder with `council.json` but no `verdict.json`, untouched for three hours, is an abandoned council.

## council.json (`mosaic.council/1`)

```json
{
  "schema": "mosaic.council/1",
  "id": "2026-11-17-msft-buy",
  "title": "Buy Microsoft at 518",
  "job": "decision",
  "ticker": "MSFT",
  "decision": "Whether to open a position in Microsoft now, and how.",
  "mode": "full",
  "horizon": "5 years",
  "trigger": "The stock is 7% off its high after a capex-heavy quarter.",
  "position": { "owned": false, "portfolioShare": null, "costBasisVsPrice": null },
  "options": [
    { "id": "A", "label": "Full position now", "kind": "act" },
    { "id": "B", "label": "Starter now, add on proof", "kind": "act" },
    { "id": "C", "label": "Wait for a lower price", "kind": "wait", "trigger": "Price / DCF base below 1.2" },
    { "id": "D", "label": "Pass", "kind": "none" }
  ],
  "seats": ["buffett", "taleb", "burry"],
  "weights": { "buffett": { "weight": 3, "reason": "Owner economics is the heart of this call" } },
  "pack": { "path": "data-pack.json", "hash": "sha256:...", "coverage": 0.73 },
  "brief": "Two or three sentences.",
  "assumptions": ["Horizon five years (assumed)"],
  "thesis": null,
  "lean": { "sealed": true },
  "recheckOf": null,
  "started": "2026-11-17T12:00:00Z"
}
```

- `job`: `decision` | `stress_test` | `portfolio` | `macro`. `ticker` is null for macro and portfolio jobs.
- `mode`: `full` | `quick` | `named` | `all`. A recheck is `quick` with `recheckOf` set to the earlier session id.
- `options[].kind`: `act` | `wait` | `none`; a `wait` option carries `trigger`. Labels under 50 characters.
- `weights`: every seat at the table, 1 to 3. `position.portfolioShare` is a fraction or null; no dollar amounts anywhere.
- `lean` stays `{ "sealed": true }`: the lean itself goes in `lean.json` after Round 1.

## brief.md

Markdown, under 300 words: `# Brief: <title>`, then the decision, options with their kinds and triggers, horizon, position context, the trigger in the user's words, a one-line data-health summary, and assumptions marked `(assumed)`. Never the lean.

## holdings.json (portfolio jobs)

`{ "holdings": [{ "ticker": "MSFT", "weight": 20 }, ...] }`. Weights as percents or fractions; the pack normalizes them. No share counts or dollar values.

## data-pack.json (`mosaic.datapack/1`)

Written by `data/cli.mjs pack`. Top level:

| Field | Meaning |
|---|---|
| `kind` | `ticker` \| `macro` \| `portfolio` |
| `symbol`, `holdings` | The ticker, or the normalized holdings |
| `asOf`, `generatedAt`, `hash` | Pack date, build time, `sha256:` of the facts (ids, values, sources, dates, statuses) |
| `coverage` | `byCapability` (status per capability: ok, fallback, stale, partial, missing, error, computed), `core` (the capabilities scored), `score` (0 to 1), `facts`, `missingFacts` |
| `providers[]` | Per capability: `capability`, `source`, `status`, `asOf`, `note`, and `attempts[]` (`provider`, `status` ok/empty/error/skipped/cache/stale-cache/unknown, `kind`, `httpStatus`, `note`, `ms`). URLs inside notes are redacted |
| `warnings[]` | Plain sentences for the data-health strip |
| `facts[]` | See below |
| `packs` | Per seat key: `facts` (ids), `missing` (ids), `coverage`, `evidenceCap` (strong/adequate/thin), `checks[]` (`label`, `metric`, `op`, `threshold`, `fact`, `value`, `result` pass/fail/missing, `heuristic: true`) |
| `series` | `price` (weekly `[date, close, adjClose]`), `annual` (normalized fiscal years and TTM), `macro` (monthly `[date, value]` per series), `prices` per ticker for portfolios |
| `news[]` | Headlines when a keyed provider supplied them: `time`, `title`, `source`, `url` |
| `disclaimer` | The footer line |

Each fact:

```json
{ "id": "F044", "key": "roic", "label": "Return on invested capital", "value": 0.297, "unit": "ratio",
  "period": "TTM to 2026-09-30", "source": "mosaic", "asOf": "2026-09-30", "status": "ok",
  "derived": true, "formula": "operating_income x (1 - tax_rate) / (equity + total_debt - cash)", "inputs": ["F008", "F022"] }
```

- `id` is positional within a pack (`F001`...). `key` is stable across packs (the journal diffs by key).
- `unit`: `ratio` (fractions: 0.297 = 29.7%), `percent` (already in percent: yields, CPI), `percentage points`, `x` (multiples), `USD`, `USD/share`, `shares`, `count`, `date`, `text`, `number`.
- `status`: `ok` | `fallback` (a later provider in the chain answered) | `stale` (served from cache after live failures) | `missing` | `error`. A null `value` always has status `missing` or `error` and a `note` saying why.
- Derived facts have `source: "mosaic"`, a `formula`, and `inputs` (fact ids, or `series:<name>` for history-based facts).

`data-pack.md` is the human view of the same pack: data health, warnings, every fact, formulas, seat evidence.

## round-N.md

```markdown
# Round 1: blind opening

## Buffett

SEAT: Buffett (Moat and owner economics)
STANCE: Yes
OPTION SCORES: A 7/10 · B 8/10 · C 6/10 · D 3/10
...the card verbatim, fields exactly as in round-prompts.md...

## Taleb

...

## Chair notes

Cruxes, unanimity check, bias flags quoted from the user, format problems.
```

One `## <Short>` heading per seat card, cards verbatim, Chair section last (`## Chair notes`, or `## Chair` in Round 3). The parser reads uppercase `FIELD:` lines; anything else is prose.

## cruxes.json

```json
{
  "cruxes": [
    { "question": "Is the capex an investment or a toll?",
      "sides": [ { "position": "Investment with returns to come", "seats": ["buffett"] },
                 { "position": "A toll to stay in the race", "seats": ["burry"] } ],
      "facts": ["F003", "F004"] }
  ],
  "unanimous": false,
  "unargued": null,
  "biasFlags": [ { "type": "anchoring", "quote": "capex is the whole story this year" } ],
  "note": "One plain sentence on what the room is fighting about."
}
```

One to three cruxes; questions under 90 characters, positions under 50. `unargued` names the strongest unargued case when Round 1 was unanimous. `biasFlags[].type`: `fomo` | `anchoring` | `sunk_cost` | `recency` | `confirmation`.

## lean.json

```json
{ "option": "A", "reason": "the user's words, verbatim", "revealedAt": "2026-11-17T12:30:00Z" }
```

Written after `round-1.md` is saved, never before. `option` is null when the user gave no lean.

## scores.json (`mosaic.scores/1`)

Written by `scripts/score.mjs`; rewritten after each round. Fields: `round`, `roundsRun`, `options[]` (`id`, `label`, `kind`, `score`, `spread`, `math`), `recommended`, `band`, `label`, `underlyingLabel`, `overrides[]` (`type` pass/wait/ruin_cap/one_way_cap/insufficient, `note`, plus `seats`, `trigger`, `applied` where relevant), `spread`, `confidence`, `abstentions[]`, `votes` (`endorse`, `amend`, `dissent`; null before Round 3), `support`, `unanimousRound1`, `needsRound3`, `leanPull` (`option`, `value`, `rawShift`, `perSeat[]`, `flagged`), `evidence` (`coverage`, `citedShare`, `whyPoints`, `score`, `grade`), `thesisStrength` (stress tests), `scorecard[]` (`seat`, `short`, `dimension`, `weight`, `present`, `abstain`, `stance`, `vote`, `scores`, `pillar`, `conviction`, `evidence`, `ruin`, `door`, `movedOnTop`), `problems[]`. The Room shows these numbers as written; it does not recompute them.

## draft.json

```json
{
  "option": "B",
  "label": "PROCEED WITH CONDITIONS",
  "recommendation": "One or two sentences.",
  "conditions": ["Gross margin holds above 65% [F045]"],
  "next_steps": ["Set the starter size by the survivable-loss rule this week"],
  "premortem": ["Three ways this fails within twelve months"],
  "kill_criteria": [{ "text": "Gross margin below 65%", "fact": "gross_margin", "op": "<", "value": 0.65 }],
  "recheck": { "date": "2027-01-29", "triggers": ["Next 10-Q, expected around 2027-01-27 [F123]"] },
  "cheapest_test": "One line.",
  "sizing_note": "Survivable-loss framing, never a percentage for this user.",
  "ruin_mitigations": [{ "seat": "taleb", "mitigation": "One line.", "endorsed": false }],
  "wait_for_pitch": null
}
```

Skip in quick mode when Round 3 is skipped. `wait_for_pitch` is `{ "trigger": "..." }` when the Chair calls WAIT on an act option. After Round 3 set `ruin_mitigations[].endorsed` from the seat's vote.

## citations.json (`mosaic.citations/1`)

Written by `scripts/check-citations.mjs`: `ok`, `stats` (`factCitations`, `factIdsUnknown`, `factIdsMissingData`, `quotesVerified`, `quotesInternal`, `quotesUnverified`, `uncitedNumbers`), `errors[]` and `warnings[]` (`type`, `file`, `seat`, `id`, `quote`, `detail`), `files[]`.

## verdict.json (`mosaic.verdict/1`), written last

```json
{
  "schema": "mosaic.verdict/1",
  "label": "PROCEED WITH CONDITIONS",
  "call": "One or two sentences naming the option.",
  "recommended": "B",
  "why": [{ "point": "One line with fact ids.", "seat": "buffett", "framework": "Economic castle" }],
  "minority": { "seat": "burry", "quote": "Copied from a card.", "would_have_to_be_true": "One line." },
  "fights": [{ "crux": "The question", "story": "Who was on each side, who moved, how it resolved." }],
  "premortem": ["...", "...", "..."],
  "kill_criteria": [{ "id": "K1", "text": "Gross margin below 65%", "fact": "gross_margin", "op": "<", "value": 0.65 }],
  "conditions": ["Checkable condition [F045]"],
  "next_steps": [{ "when": "This week", "action": "One line." }],
  "recheck": { "date": "2027-01-29", "triggers": ["Next 10-Q [F123]"] },
  "cheapest_test": "One line.",
  "price_implies": "One or two sentences with fact ids; a range, never a target.",
  "sizing_note": "Survivable-loss education.",
  "behavioral_flags": [{ "type": "anchoring", "quote": "the user's words" }],
  "lean_pull_note": "One line.",
  "data_health": "One line.",
  "amendments": [{ "seat": "taleb", "amendment": "One line.", "adopted": true, "reason": "One line." }],
  "removed_by_citation_check": [],
  "override_note": "",
  "share_line": { "seat_lines": { "buffett": "Their one line for the investor." }, "sharpest_dissent": "burry" }
}
```

`label` matches `scores.json`. Put the three strongest arguments first in `why` and at most three `next_steps`. Kill criteria with `fact`, `op` and `value` are checked automatically by `/mosaic recheck`; others are checked by the Chair. `share_line` feeds the share card (one line per seat, the sharpest dissent).

## verdict.md

From `report-template.md`. Ends with the disclaimer footer.

## changes.json (`mosaic.changes/1`) and changes.md (rechecks)

Written by `scripts/journal.mjs diff`: `from` (last verdict date, pack as-of, hash, label, recommended), `to` (new pack as-of, hash), `samePack`, `newFiling`, `changes[]` (`key`, `label`, `unit`, `before`, `after`, `delta`, `relative`, `material`, `id` in the new pack), `material[]`, `newlyMissing[]`, `newlyAvailable[]`, `killCriteria[]` (each kill criterion with `result`: tripped | holding | unknown | manual, and `current`). `changes.md` is the readable version the recheck brief leads with.

## journal/<KEY>.json (`mosaic.journal/1`)

One file per ticker (`MSFT.json`), or `MACRO.json` / `PORTFOLIO.json`, in the Mosaic home's `journal/` folder. Written by `scripts/journal.mjs add`.

```json
{
  "schema": "mosaic.journal/1",
  "key": "MSFT",
  "ticker": "MSFT",
  "company": "MICROSOFT CORP",
  "thesis": null,
  "status": "active",
  "created": "2026-11-17",
  "updated": "2026-11-17",
  "next_recheck": "2027-01-29",
  "latest": { "label": "PROCEED WITH CONDITIONS", "recommended": "B", "date": "2026-11-17" },
  "entries": [
    {
      "id": "2026-11-17-msft-buy", "date": "2026-11-17", "session": "/abs/path/to/session",
      "job": "decision", "mode": "full", "decision": "...", "options": [{ "id": "A", "label": "...", "kind": "act" }],
      "trigger": "...", "horizon": "5 years", "lean": { "option": "A", "reason": "..." }, "seats": ["buffett"],
      "recommended": "B", "label": "PROCEED WITH CONDITIONS", "underlyingLabel": null,
      "optionScores": { "A": 4.4, "B": 6.6 }, "confidence": 7, "spread": 3, "evidence": "high", "leanPull": 0.2,
      "call": "...", "dissent": { "seat": "burry", "quote": "..." }, "premortem": ["..."],
      "kill_criteria": [{ "id": "K1", "text": "...", "fact": "gross_margin", "op": "<", "value": 0.65 }],
      "conditions": ["..."], "recheck": { "date": "2027-01-29", "triggers": ["..."] },
      "pack": { "hash": "sha256:...", "asOf": "2026-11-17", "coverage": 0.73,
                "snapshot": { "gross_margin": { "id": "F045", "label": "Gross margin", "value": 0.677, "unit": "ratio", "asOf": "2026-09-30", "status": "ok" } } }
    }
  ]
}
```

Entries are sorted by date; re-journaling the same session replaces its entry. `next_recheck` comes from the latest entry: the verdict's re-check date, else two days after the pack's expected next report, else 90 days out. The snapshot holds every fact by key so a recheck can diff against it even if the session folder is gone.
