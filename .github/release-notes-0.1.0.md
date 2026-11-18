# Mosaic v0.1.0

Mosaic is a free plugin for Claude Code. Investing legends, simulated from their public work, debate your decision from one sourced fact sheet and return a scored verdict that shows where they disagree.

> Mosaic grades how a decision was made. It is not investment advice.

## Install

```bash
claude plugin install mosaic --marketplace abhinavuppal931/mosaic
```

Then run `/mosaic` in Claude Code.

## Highlights

- A council of simulated investors, seven by default from a roster of thirteen, argues over three rounds. Round 1 is blind to your lean.
- One sourced data pack. Every number has a fact id, a source and an as-of date. Missing data stays missing.
- A Chair returns a scored verdict that shows where the seats disagree, with a pre-mortem, kill criteria and a re-check date.
- A thesis journal and `recheck` for what changed since the last verdict.
- The Room: a local web app that plays the council live, with a verdict page, journal, share card and PDF.
- Free data sources by default. No keys, no accounts, no npm install. Keys are optional.
- Add your own seat with `/newseat`, and your own data provider with an adapter template.

## Known limits

- Data covers US equities and US macro series.
- The Yahoo chart endpoint is unofficial and best effort. It is labelled that way in the pack.
- News, analyst estimates and short interest are missing without a key.
- Seats are simulations built from public work. They are not the people.

Full list of changes: [CHANGELOG.md](../CHANGELOG.md).
