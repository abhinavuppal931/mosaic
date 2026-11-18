VERDICT: SAFE AFTER FIXES

# Mosaic security audit before going public (2026-11-18)

No secret was found anywhere in the repository, its history, its fixtures or its pull requests. No history rewrite is required for secrets. The fixes before the switch are GitHub settings plus one decision for Abs: whether to keep a personal email address in eight commits. Two small hardening edits to the code are optional.

This audit is read-only. It pushed nothing except this report, rewrote nothing and changed no setting. No secret value, or any part of one, appears in this report: findings name a file, commit, line and type only.

## Scope

| Item | Covered |
|---|---|
| Refs | A `git clone --mirror` of every ref: `main`, `abhinavuppal931/abh-328-mosaic-council-skill-data-layer-and`, `abhinavuppal931/abh-331-mosaic-build-the-room-app-from-the`, `abhinavuppal931/abh-338-mosaic-first-run-setup-that-is` (tip a51b450), `claude/sweet-goldberg-ontdaz`, and `refs/pull/1/head` to `refs/pull/4/head` with the two merge refs |
| Commits | 98 unique commits, 426 paths ever committed |
| Scanner 1 | gitleaks 8.21.2, `--redact`, every commit on every ref |
| Scanner 2 | trufflehog 3.88.0, `--no-verification`, every ref; values masked in all output |
| Targeted greps | Every tree of every commit: `apikey=`, `api_key=`, `token=`, `Authorization`, `Bearer`; the ten env var names followed by a value; 32-character hex strings; private key headers; email addresses; local user paths; phone numbers; internal hosts and links |
| Files ever committed | Checked for `.env`, `.env.local`, `.pem`, `.key`, `id_rsa`, `.npmrc`, `.netrc`, credentials, logs, HAR files, databases |
| Binary files | All 41 images ever committed, checked for EXIF, GPS, XMP, PNG text chunks, emails and paths |
| Pull requests | PRs #1 to #4: bodies, 15 comments, review threads (none) |
| Code paths | HTTP, redaction, env, cache, CLI error output, Room server; workflows on every branch |
| Settings | Branch list and protection through the GitHub connector. Other settings could not be read from this session (see section 5) |

Not covered: commits that are no longer reachable from any ref (for example from a deleted or force-pushed branch). GitHub keeps those and serves them by SHA once a repo is public. No sign of a force push was found, and the one deleted branch named in the PRs (`claude/abh-331-room-local-wip`) has its only commit, 9ab99b5, inside the Room branch, so it was scanned.

## Findings

| # | Severity | Where | Type | Fix | Kind of fix |
|---|---|---|---|---|---|
| 1 | Medium | Author and committer email of 8 commits. On `main`: eb3931f, 6a55aa9, 60a2e79, 203cc1e, e425e0a, c1f0d83. Only on the Room and setup branches: 9ab99b5, 70eea42 | Personal data: a personal gmail address | Either accept it (it is the owner's own address), or rewrite history with `git filter-repo --mailmap` to the GitHub noreply address before the switch. Going forward: set `user.email` to the noreply address on Abs's machine, and turn on "Keep my email addresses private" and "Block command line pushes that expose my email" in GitHub email settings | History rewrite, Abs decides |
| 2 | Medium | Repo settings: `main` is not protected; Actions settings unknown | No guard against force pushes to `main` or fork PR workflows once public | Apply the settings in section 5 at the moment of the switch | Settings, no file change |
| 3 | Low | `data/lib/http.mjs:49` (all branches) | The network error appends the raw `err.message` from `fetch` without `redactText`. Today `router.mjs:169` redacts it later, and keys read through `env.get` are registered with the redactor, so no leak path was found | Wrap it: `redactText(err?.message \|\| String(err))` | Simple file edit on a branch |
| 4 | Low | `data/cli.mjs:204` on `main`, `data/cli.mjs:247` on `abh-338` | The top-level `error:` line prints `err.message` without `redactText` | Print `redactText(err.message)` | Simple file edit on a branch |
| 5 | Low | `data/router.mjs:75-76` (all branches) | The SEC contact (name and email) is registered with the redactor only when it comes from the env path. A contact from the user config file is not. Headers are never logged today, so this is defense in depth | Call `registerSecret(contact)` after line 76 | Simple file edit on a branch |
| 6 | Low | Branches `abhinavuppal931/abh-328-mosaic-council-skill-data-layer-and` and `claude/sweet-goldberg-ontdaz` | Merged branches still present. Their content is already on `main` and is clean; they only add surface and noise | Delete both branches, and turn on "Automatically delete head branches" | Settings, no file change |
| 7 | Info | 28 gitleaks hits, rule `generic-api-key`: `data/packs/ticker.mjs:224,225,236,239,246`, `data/packs/macro.mjs:41,44`, `tests/core/fixtures/live/msft/data-pack.json` (8 lines), `tests/core/fixtures/live/macro/data-pack.json` (4 lines), `tests/seats/smoke/session-msft/data-pack.json` (8 lines), `room/examples/2026-11-17-nvda-buy/data-pack.json:575` | False positives. Every hit is a pack fact `key:` field whose value is a lowercase snake_case identifier (checked by shape, without printing values) | Add a `.gitleaksignore` with these fingerprints, or a `gitleaks.toml` allowlist for `key` fields in `data/packs/` and `data-pack.json`, so future scans and GitHub's own scanning start clean | Simple file edit on a branch (optional) |
| 8 | Info | 87 commit messages (the `Claude-Session` trailer) and the bodies of PRs #1 to #4 | Links to claude.ai/code sessions. They open only for the owner's account, so they expose session ids, not content | Accept. Removing them from commit messages needs a history rewrite, which is not worth it | History rewrite, Abs decides (recommend: accept) |
| 9 | Info | Linear bot comments on PRs #1 to #4; the Linear issue text quoted in the first comment on PR #4 | Links to the private Linear workspace and issue titles. The workspace slug is Abs's name, which the GitHub login already shows. The quoted issue text holds only product notes | Accept, or delete the four `linear-code[bot]` comments before the switch. Consider whether the Linear GitHub integration should keep posting on a public repo | PR comment edit, no history rewrite |
| 10 | Info | `docs/design/assets/*.jpg`, `room/public/img/*.jpg` | Not a security issue. Portraits of real people with no provenance note in `room/NOTICE.md` | Add one line on where the images come from and their licence | Simple file edit on a branch (optional) |

## 1. Secrets across all history

- **gitleaks** (redacted, 91 commits on all refs): 28 findings, all false positives (finding 7).
- **trufflehog** (unverified mode, every ref, 1,135 chunks, 3.9 MB): 0 findings.
- **`apikey=`, `api_key=`, `token=`, `Authorization`, `Bearer`:** every hit is code that builds a header from `ctx.key`, a redaction test with a dummy value (`tests/core/router.test.mjs`, `tests/core/adapters.test.mjs`), or the README example `FRED_API_KEY=your-key`.
- **The ten env var names followed by a value:** 27 hits, in `README.md` and in `tests/core/adapters.test.mjs`, `tests/core/cli.test.mjs` and `tests/core/router.test.mjs`. Every value is a short, low-entropy, lowercase hyphenated dummy (entropy 1.0 to 3.4 bits per character; real keys for these vendors are 32 or more random characters). `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `KIE_AI_API_KEY` and `OPENAI_API_KEY` never appear with a value.
- **`.env` and `.env.local`:** never committed. Both are in `.gitignore`, with `.cache/`, `sessions/*`, `journal/*` and `/mosaic.config.json` (the user config that holds the SEC contact).
- **Private keys:** none. No `.pem`, `.key`, `id_rsa`, `.npmrc` or `.netrc` file was ever committed.
- **32-character hex strings:** content hashes of design assets in `docs/design/boards/*.dc.html` and `docs/design/ROOM-DESIGN.md`, and public gist ids in `skills/mosaic/brains/michael-burry/sources.md` and `skills/mosaic/brains/stanley-druckenmiller/sources.md`. None is a key.
- **Recorded fixtures** (`tests/core/fixtures/`, `tests/seats/smoke/`, `room/examples/`, `sessions/example-*`): request URLs are public SEC, Treasury and New York Fed URLs with no query keys. The live packs were recorded with no vendor keys set; they say "no key (FRED_API_KEY)" and so on. No request headers and no User-Agent strings are stored. `tests/core/live-packs.test.mjs:39` already fails if a fixture ever holds a key parameter, an email or a User-Agent.

## 2. Personal data across all history

- **Emails in file contents:** only `example.com` and the test domains `b.co` and `d.co`. No personal address in any file, fixture, SEC User-Agent or pack.
- **Commit identities** (98 commits):

| Identity | Commits |
|---|---|
| Claude (`noreply@anthropic.com`), author and committer | 86 |
| A personal gmail address, author and committer | 8 (finding 1) |
| GitHub noreply address as author, GitHub web as committer (merge commits) | 4 |

  Author names are "Claude", "GitHub" and Abs's real name. The real name is already public on the GitHub profile.
- **Local paths:** `README.md:102` on `abh-338` uses a placeholder (`C:\Users\<...>`). `tests/core/cli.test.mjs:262,266` use a placeholder user. `room/test/unit/server.test.mjs:65-68` use `/tmp/home/journal` and `/tmp/home/sessions`. No real username.
- **Phone numbers:** none.
- **Personal files:** none. All 41 images are free of EXIF, GPS, XMP and PNG text chunks; one byte match in `room/test/screens/print-a4.png` sits inside compressed image data, and the file has only IHDR, IDAT and IEND chunks.

## 3. PR bodies and comments

| PR | State | Body | Comments | Secrets | Personal data | Internal links |
|---|---|---|---|---|---|---|
| #1 | merged | clean | 3 (1 Linear bot) | none | none | claude.ai session link; Linear issue and review links |
| #2 | merged | clean | 2 (1 Linear bot) | none | none | same |
| #3 | open | clean | 7 (1 Linear bot) | none | none | same; names the deleted branch `claude/abh-331-room-local-wip` |
| #4 | open | clean | 3 (1 Linear bot) | none | none | same; the bot comment quotes the ABH-338 issue and its agent notes |

No PR has review threads. PR #2's body records that the data layer was scanned for the key values present at the time and the owner's email, which matches this audit.

## 4. Risky code paths

- **Redaction is in place and tested.** `data/lib/redact.mjs` masks secret query parameters (`api_key`, `apikey`, `key`, `token`, `access_token`, `secret`, `registrationkey`, `client_secret`, `password`, `auth`), URL credentials, `Authorization: Bearer` values and every value registered through `env.get`. `data/lib/http.mjs` logs and throws with `redactUrl` only (lines 43, 47, 49, 78, 94, 108). `data/router.mjs` redacts every note and error that reaches a pack (lines 154, 169, 197). The `--verbose` log in `data/cli.mjs:48` prints only provider, redacted URL, status and timing. Findings 3 to 5 are the remaining small gaps.
- **Cache:** `data/lib/cache.mjs` names files by SHA-256 of the cache key and writes them under the git-ignored `.cache/` or the Mosaic home, never into the repo.
- **SEC contact:** read from `MOSAIC_SEC_CONTACT` or the git-ignored user config, never from argv. `setup` writes the config at mode 0600. It is sent only in the User-Agent to sec.gov and is not written to packs.
- **Room server** (`room/server.js` on `abh-331` and `abh-338`): binds `127.0.0.1` by default (line 65), checks static paths against the public folder (lines 330-331), and limits example names to `[\w.-]+` (line 113). Journal saves accept only the Room's own origin.
- **Workflows:** no `.github/` folder exists on any branch, PR ref or commit in history, including `abh-338` at a51b450. Nothing runs on fork PRs today. If a test workflow is added later (the setup branch may add one), it should use `on: pull_request` (never `pull_request_target` with a checkout of the PR head), set `permissions: contents: read` at the top, and use no secrets; the tests need none, since they run offline on recorded fixtures.

## 5. GitHub settings to set at the switch

This session can reach GitHub only through its connector and could not read the Actions, security or feature settings. What could be read: `main` is not protected, and two merged branches were not deleted. Recommended, all under the repo's Settings:

| Setting | Where | Recommendation |
|---|---|---|
| Secret scanning | Code security | On (free for public repos). Expect it to stay quiet; see finding 7 |
| Push protection | Code security | On |
| Private vulnerability reporting | Code security | On. Optionally add a short `SECURITY.md` pointing to it |
| Dependabot alerts | Code security | On. The project has no npm dependencies today, so this is cheap insurance |
| Fork PR workflow approval | Actions, General, "Approval for running fork pull request workflows from contributors" | "Require approval for all external contributors" |
| Default `GITHUB_TOKEN` permissions | Actions, General, "Workflow permissions" | "Read repository contents and packages permissions". Leave "Allow GitHub Actions to create and approve pull requests" off |
| Actions secrets | Secrets and variables, Actions | Keep empty. No workflow needs a key |
| Branch protection on `main` | Branches or Rulesets | Require a pull request before merging, block force pushes and deletions. Abs can keep admin bypass since he merges alone |
| Delete branch on merge | General, Pull Requests | On. Also delete the two merged branches in finding 6 |
| Wikis | General, Features | Off. The README and `docs/` are the documentation. If kept on, tick "Restrict editing to collaborators only" |
| Discussions | General, Features | Off until there is a community to answer. Issues stay on |
| Email privacy (account level) | GitHub account, Emails | "Keep my email addresses private" and "Block command line pushes that expose my email" |

## Order of operations for Abs

1. Decide on finding 1 (keep the gmail address in 8 commits, or rewrite). If rewriting, do it before the switch and while PRs #3 and #4 are the only open work, because every SHA from eb3931f onward changes and both PR branches must be rebased.
2. Optional: land the small edits in findings 3, 4, 5, 7 and 10 on a branch.
3. Delete the two merged branches.
4. Switch to public, then immediately apply the section 5 settings.
5. Check the Security tab a day later for any secret scanning alert.
