# Security

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Report a vulnerability

Report it privately. Do not open a public issue.

1. Open the repository on GitHub and go to the Security tab.
2. Choose "Report a vulnerability" (GitHub private vulnerability reporting), or go straight to https://github.com/abhinavuppal931/mosaic/security/advisories/new.
3. Say what you found, how to reproduce it and what it affects.

You will get a reply from the maintainer. Please give time to fix it before you share details.

## What Mosaic runs locally

- It runs only Node scripts that ship in the plugin. There are no npm packages, no postinstall step, no hooks and no MCP servers.
- The Room is a local web server bound to 127.0.0.1. It makes no AI calls.
- Network requests go only to the data sources listed in [What Mosaic runs and sends](docs/HOW-IT-WORKS.md#what-mosaic-runs-and-sends), and only when building a data pack.
- There is no telemetry.

## Keys and your SEC contact

- Keys come only from environment variables or from `.env.local` in your Mosaic home (`~/.mosaic`).
- Keys are never written to packs, sessions or logs. Every request URL is redacted before it is logged.
- Your SEC contact (name and email) goes only to sec.gov, in the User-Agent, as the SEC requires. It is not written to packs, sessions or logs.
- `node data/cli.mjs setup --status` prints which variables are set, never their values.

If you find a key or contact in a pack, a session file or a log, treat it as a vulnerability and report it.

## What the skill pre-approves

`/mosaic` declares `allowed-tools` so a council runs without approval prompts. It pre-approves only:

- Its five scripts, each run as `node "<plugin folder>/<script>"`: `data/cli.mjs`, `scripts/score.mjs`, `scripts/check-citations.mjs`, `scripts/journal.mjs` and `room/server.js`.
- File reads and writes inside `~/.mosaic`.

Everything else still asks, including other `node` commands and writes anywhere else. How this was chosen and tested is in `docs/marketplace-listing.md`, under "Security notes".
