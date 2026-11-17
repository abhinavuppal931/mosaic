# Room design: approved direction (A v3)

Approved by Abs on 17 November 2026. Build the Room from these two boards:

- `boards/A3-Live.dc.html`: the live council.
- `boards/A3-Verdict.dc.html`: the verdict.

The other boards are earlier rounds. They are reference only. Do not build them.

The boards are Claude Design canvas files. The markup is inside `<x-dc>`, and a `renderVals()` script supplies the data. Treat them as the visual spec, and rebuild them as the Room's own zero-dependency HTML, CSS and JS. Asset URLs of the form `/_blob/<id>` map to files in `assets/`:

| Blob id | File |
|---|---|
| e7be29f0682f4a8ffed35e6bb70a254a | table.jpg |
| c1d510d50623727a52cf24e266cb2f7d | buffett.jpg |
| 343d8fbfd84bc2af4cc2b71933b4e6cf | munger.jpg |
| dcd65421fd24e1e498a0b77279f7fa2f | damodaran.jpg |
| 74b184f2496753cd8977f835545d9927 | marks.jpg |
| 71978e7b22b129dcdf5140592dd3210a | taleb.jpg |
| 76a13c67ce697cc255b603777754ac63 | druckenmiller.jpg |
| 124646476f6ad834f8da7e4c7c4b7c38 | burry.jpg |

The fonts are self-hosted:
- Switzer 400, 500 and 600, from Fontshare. Check the ITF Free Font License before committing the font files to a public repo. If redistribution isn't clearly allowed, load Switzer from Fontshare's CSS API, and fall back to a system sans when offline.
- JetBrains Mono and Brygada 1918 (wordmark only), from Google Fonts or bundled.

## Non-negotiables

- **Actions:** white primary buttons (`#F3F1EC` fill, dark text) and quiet ghost secondaries. Never an orange button. Orange (`#FF7A38`) is a data accent only: the speaking seat, heat cells and the logo mark.
- **Typography:** Switzer for everything, including the verdict headline (600, tight tracking) and the subheader. Brygada appears only in the "Mosaic" wordmark. No display serif and no italics.
- **One source of truth:** every number on screen is computed from the seat array in the session files. Votes are derived as follows:
  - Agrees: the seat's top option is the recommended option.
  - Partly agrees: the seat prefers another option.
  - Disagrees: the seat scores the recommended option 4 or below.
  - Never hard-code a score, total or vote.
- **The four verdict stats are visual:**
  - Council score: bars for every option.
  - Evidence: one tick per fact, filled when the fact was found.
  - How united: each seat's avatar on a 1 to 10 line, at its score for the recommended option.
  - Your bias check: the score before and after the user's lean was revealed.
- **The 3D chamber:** seat medallions are positioned over the seven chairs in `table.jpg`. Seat positions as percentages are in A3-Live's seat array. The speaker gets the amber ring and the spotlight.
- **Phone, under 760px:**
  - The question comes first, then the speaker, then a horizontal seat strip.
  - The scorecard scrolls sideways with its first column pinned.
  - The share card stacks.

## Copy rules

The readers range from first-time investors to professionals. Every string must pass all of these:

1. **Plain English.** Write the action out: "start small", "wait for $150". No option letters on their own, no fact ids (F021), no abbreviations (TTM, YoY, DCF, capex, n/a) and no jargon ("liquidity", "multiple", "moat") unless it is explained in the same line.
2. **Attribute, never instruct.** Write "The council would start small…", not "Start small". Keep the disclaimer next to the verdict: "Mosaic grades how a decision was made. It is not investment advice."
3. **One date format:** "17 November 2026".
4. **State each fact once.**
5. **No colon labels**, such as "Consensus: Buy".
6. **No em dashes.**
7. **Plain names for the stats:** "Council score", "Evidence", "How united", "Your bias check".
8. **Plain names for the sections:**
   - "What would change the call", with the columns "If this happens", "Warning level" and "Today".
   - "The strongest objection".
   - "Why the council landed here".
   - "How this could go wrong".
9. **Seat chips** read "Leans wait · 7", in the form `Leans <option> · <score>`.

The design review that produced this version is in `round1-synthesis.md`.
