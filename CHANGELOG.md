# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - Unreleased

### Added

- The council protocol: thirteen simulated investing legends (seven by default, six on call) debate a decision over three rounds. Round 1 is blind to your lean, Round 2 reveals it and opens the debate, Round 3 rescores. A Chair returns a scored verdict that shows where the seats disagree, with a pre-mortem, kill criteria and a date to re-check.
- Modes: full council, `--quick`, `--seats`, `--all`, `ask <seat>`, `board`, `recheck`, `journal` and `room`.
- A sourced data pack that every seat argues from. Every fact has an id, a source, an as-of date and a status. Missing data stays visibly missing.
- Free data by default: SEC EDGAR, Yahoo chart endpoint (unofficial, best effort), US Treasury, New York Fed and BLS.
- Optional keyed providers: FRED, Financial Modeling Prep, Finnhub, Massive (Polygon) and BLS v2. A provider router with fallback, stale-cache and missing labels. A template and a contract test (`check-provider`) for custom adapters.
- Scoring and citation checks: `score.mjs` computes the verdict label and numbers. `check-citations.mjs` fails any quote or fact id that is not real.
- The thesis journal and rechecks: each decision is saved with kill criteria and a re-check date, and `recheck` reruns a quick council on what changed.
- The Room: a local web app that plays a council live, then shows the verdict, the journal, a share card and a PDF. Three finished example councils (NVIDIA buy, Costco sell, Microsoft sizing).
- `/newseat`: builds a new seat from free public sources.
- First-run setup: a first-run check, the example councils, the `~/.mosaic` home for sessions, journal and keys, and a one-line install.
- Onboarding: the first `/mosaic` asks four quick, skippable questions (experience, what you want help with, usual horizon, council size) and saves them to `~/.mosaic/profile.json`. Every later council uses them, so it asks less and explains at the right level. `/mosaic profile` changes them.
