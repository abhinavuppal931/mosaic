# Contributing to Mosaic

Thanks for helping. Mosaic is a Claude Code plugin with zero npm dependencies. Small, focused changes are the easiest to review.

## Set up

You need Node.js 20 or later and git. There is nothing to install.

Clone it, in the folder you want the code in:

```bash
git clone https://github.com/abhinavuppal931/mosaic.git
```

## Run the tests

Run this inside the `mosaic` folder:

```bash
npm test
```

The Room has browser tests that need Playwright. They skip themselves without it. Run them inside the `mosaic` folder:

```bash
npm run test:e2e --prefix room
```

## Try your working copy

Start Claude Code with your clone as the plugin, in the folder you ran `git clone` in:

```bash
claude --plugin-dir mosaic
```

Your edits apply the next time you start Claude Code with that flag.

## Add a seat

Run `/newseat` in Claude Code, for example `/newseat Howard Marks --role "..."`. The full steps are in `skills/newseat/SKILL.md`. In short, it:

1. Finds the investor's free public sources (letters, memos, papers, speeches, long interviews) and fetches them into a local `build/` folder that git ignores.
2. Extracts frameworks, rules, positions, selling rules, stories and voice with parallel sub-agents.
3. Writes the brain in `skills/mosaic/brains/<slug>/`, checks that every quote is verbatim with a source id, and writes the seat agent in `agents/`.
4. Registers the seat in `skills/mosaic/roster.json`.

The rules that matter:

- A seat is a simulation, not the person. It never reads as that person endorsing a security.
- Quotes are short, verbatim and carry a source id. A line with no source is inference and says so.
- Free, public, lawful sources only. Copyrighted books are never fetched or quoted.
- No price targets and no personal advice.

## Write a data provider

A provider adapter is one file. The steps are in the README under "Writing a custom adapter". In short:

1. Copy `data/providers/_template.mjs` and fill in `id`, `name`, `needsKey`, `keyEnv` and `capabilities`.
2. Use `ctx.http` and `ctx.key`. Never call `fetch` or read `process.env`, so rate limits, retries, timeouts and key redaction apply.
3. Return empty data when you have nothing. Throw on failure.
4. Check it, inside the `mosaic` folder:

   ```bash
   node data/cli.mjs check-provider myvendor --symbol AAPL
   ```

Before adding a provider, check its terms allow caching and use in a tool like this.

## Style for copy

This applies to the README, docs, UI text and anything a seat or the Chair writes.

- Plain English. Short sentences.
- No em dashes. Use commas, colons and periods.
- No emojis. No hype words.
- Room design A v3 is approved. A visual change to the Room needs approval from the maintainer before you build it. Open an issue first.
- Never put a key, token or personal path in a file, a test or a log.

## Pull requests

- One topic per pull request.
- `npm test` passes.
- Say what you tested, with the commands you ran.
- Fill in the [pull request template](.github/pull_request_template.md).

By contributing you agree your work is released under the MIT license. Be kind: see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). To report a security problem, use [SECURITY.md](SECURITY.md), not a public issue.
