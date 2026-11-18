# Marketplace listing plan

Nothing has been submitted. This file records what the research found and what is left to do. The research is from official docs read on 2026-11-18.

## Summary

Mosaic can be listed in the claude.ai plugin directory through the developer portal. It passes `claude plugin validate . --strict` with nothing to report (Claude Code 2.1.327). A few items will be held for a human reviewer. The list is below, with the steps for Abs.

## Where plugins get listed

- The claude.ai plugin directory, through the developer portal at https://claude.ai/directory/manage. Directory plugins reach Claude Code users as `<name>@synced`.
- The official `claude-plugins-official` marketplace does not take portal submissions. It takes plugins only through an Anthropic partner contact.
- The `anthropics/claude-plugins-official` README says pull requests are not monitored.
- The community marketplace `claude-community` is a read-only mirror.
- https://claude.com/marketplace/plugins marks some plugins as Anthropic verified. The criteria are not documented.

## Prerequisites

- The GitHub repo can stay private while you validate and submit. It must be public before the listing goes live.
- GitHub must be connected on claude.ai, with push access to the repo.
- A paid claude.ai plan: Pro, Max, Ultra, Team or Enterprise. Team and Enterprise need the Owner or Directory permission.

## Exact submission steps

In the portal, choose Submit new, then Plugin bundle.

1. Source. Repo `abhinavuppal931/mosaic`. Plugin path blank (the plugin is at the root). Branch `main`. Run Validate.
2. Listing details. These are read from `plugin.json` and the README.
3. Data handling questions.
4. Compliance. Four acknowledgements.
5. Review and submit. Choose Submit for review.

Other rules:

- Each folder is one submission.
- Up to 10 submissions per 24 hours per organization.
- Updates are picked up from the tracked branch or tag, by a scheduled check or a GitHub push webhook.
- Auto-publish can be set per plugin.

## Requirements and where Mosaic stands

Blocking checks:

| Requirement | Status | Note |
|---|---|---|
| `.claude-plugin/plugin.json` present | Yes | |
| README at least 40 words outside code blocks | Yes | |
| LICENSE | Yes | MIT |
| Unique lowercase name, no reserved words | Name is `mosaic` | Only the portal can confirm it is unique |
| `npx` and `uvx` versions pinned | Not applicable | Neither is used |
| No real credentials in files | Yes | Keys come from the environment or `~/.mosaic/.env.local` |
| Remote MCP servers use https | Not applicable | There are no MCP servers |
| No symlinks, submodules or Git LFS | Yes | See the checks below |
| Valid skill front matter | Yes | `claude plugin validate` passes |
| Paths stay inside the plugin folder | Yes | |

Warnings:

| Requirement | Status | Note |
|---|---|---|
| Description, author and version set | Yes | |
| Icon | Yes, `.claude-plugin/icon.png`, 1024 px, drawn from the Room's brand mark | Needs Abs's approval before the first portal save |

Held for a reviewer:

- Look-alike or brand names. Real investors' names are used as simulated seats, with disclaimers. Expect a human review.
- Non-text binaries: seat portraits in `room/public/img/*.jpg`, fonts in `room/public/fonts/*.woff2`, `docs/design/assets`, and `room/test/screens/*.png`.
- Files over 256 KiB: twelve PNGs in `room/test/screens` and `tests/core/fixtures/http/sec-companyfacts-msft.json` (about 279 KB).
- Total file count: 395 of the 512 limit.

The security scan looks for undisclosed behavior. The README section "What Mosaic runs and sends" covers it. The source is readable. There is no minified code.

### Checks run on 2026-11-18

Run each from the repo root.

```bash
git ls-files | wc -l
```

Result: 395.

```bash
git ls-files -s | awk '$1==120000'
```

Result: no output, so no symlinks.

```bash
ls .gitmodules
```

Result: file not found, so no submodules. `.gitattributes` only sets line endings (no LFS).

## Security notes: what the skill pre-approves

`skills/mosaic/SKILL.md` declares `allowed-tools` so a council runs without approval prompts. While the skill is active it pre-approves only:

- `Bash(node "${CLAUDE_PLUGIN_ROOT}/<script>":*)` for exactly five scripts: `data/cli.mjs`, `scripts/score.mjs`, `scripts/check-citations.mjs`, `scripts/journal.mjs` and `room/server.js`.
- `Read`, `Write` and `Edit` under `~/.mosaic/**`, the Mosaic home.

Everything else still asks, including `node -e`, any other script, compound commands (`&&`, `;`, pipes) and writes anywhere else.

How this was chosen (tested on 2026-11-18 with Claude Code 2.1.327, headless runs in a fresh home, plugin folder path containing spaces):

| Rule | `node "<root>/data/cli.mjs" status` | `node -e "..."` |
|---|---|---|
| `Bash(node:*)` (the first version) | allowed | allowed |
| `Bash(node "${CLAUDE_PLUGIN_ROOT}/:*)` | denied | denied |
| `Bash(node ${CLAUDE_PLUGIN_ROOT}/:*)` | denied | denied |
| `Bash(node "${CLAUDE_PLUGIN_ROOT}/data/cli.mjs":*)` | allowed | denied |

So `${CLAUDE_PLUGIN_ROOT}` is substituted in front matter. A prefix rule matches only when it ends at a whole word, here the closing quote, so a folder-wide rule does not work and the rule names each script. The Chair is told to write every command as `node "${CLAUDE_PLUGIN_ROOT}/<script>" ...`, one per call. If it ever falls back to another path form, the user gets an ordinary prompt; nothing is approved more widely.

Writes under `~/.claude` (where Claude Code keeps plugin data) are treated as sensitive and ask even with a rule, which is why the home is `~/.mosaic`.

Not yet confirmed on Windows: that the substituted root with backslashes matches the command the Chair writes.

## Validation

Run from the repo root (Claude Code 2.1.327 here):

```bash
claude plugin validate . --strict
```

Result: "Validation passed" and "These checks found nothing to report". Before this branch it reported one plugin directory warning, `ICON_MISSING`; `.claude-plugin/icon.png` (1024 by 1024 px, the Room's four-square brand mark on the Room background) and `"icon"`, `supportUrl` and `documentationUrl` in `plugin.json` fixed it. The validator also notes that the folder holds a marketplace manifest, so the checks cover only the plugin in this folder.

Icon rules:

- The icon is taken only the first time the plugin is saved or submitted in the portal. It cannot be changed later.
- It must be a square PNG or JPEG, 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted.

Optional directory fields `plugin.json` can carry: `icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`, `keywords`.

## Needs Abs

- Make the repo public, and merge the Room to `main`, before the listing goes live.
- Submit from his claude.ai account, on a paid plan, with GitHub connected.
- Approve the icon before the first save in the portal. It is locked after that.
- Answer the data handling questions. Suggested answers:
  - No personal data leaves the machine, except the SEC contact in the User-Agent sent to sec.gov.
  - There is no telemetry.
  - Keys stay local.
- Decide whether to drop `room/test/screens/*.png` from the repo, to avoid the large-binary review hold.
- Decide on a `supportUrl` (GitHub issues) and a `privacyPolicyUrl` (his website) if the portal asks.

## Sources

- https://code.claude.com/docs/en/plugins/publish.md
- https://claude.com/docs/plugins/submit
- https://claude.com/docs/directory/publish
- https://claude.com/docs/plugins/pre-submission-checklist
- https://code.claude.com/docs/en/plugins/anthropic-marketplaces.md
- https://code.claude.com/docs/en/plugins/cli-reference.md
- https://code.claude.com/docs/en/plugins/manifest-reference.md
- https://github.com/anthropics/claude-plugins-official
