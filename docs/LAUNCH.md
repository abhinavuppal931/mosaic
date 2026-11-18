# Launch checklist

Steps in order. Each says who does it and how to check it.

| # | Step | Who | How to verify |
|---|---|---|---|
| 1 | Merge PR #3 (the Room), then PR #4, into `main` | Abs | `main` on GitHub holds `room/` and the first-run setup. Run this inside the clone after `git pull`: `npm test`. |
| 2 | Set the repo About description and topics, using the exact text below | The orchestrator | The repo page shows the description and the topics. |
| 3 | Upload `docs/social-preview.png` in Settings, General, Social preview (available after phase 2) | Abs | Paste the repo link in a chat or social post and the card shows. |
| 4 | Make the repo public | Abs | Open the repo link in a private browser window. |
| 4b | Turn on private vulnerability reporting: Settings, Code security, Private vulnerability reporting, Enable. `SECURITY.md` points reporters there | Abs | The Security tab shows "Report a vulnerability". |
| 5 | Watch the first CI run on `main` in the Actions tab across the 6 jobs (3 systems by 2 Node versions) | Abs | All 6 jobs of `test` are green. The CI badge in the README turns green. |
| 6 | Run the README's Get started once from a clean machine, and try the "Let your agent set it up" line | Abs | In a terminal, `claude plugin install mosaic --marketplace abhinavuppal931/mosaic`, then `claude "/mosaic"`, opens the Room on an example council. The agent line, which fetches `llms-install.md` from `main`, works only once the repo is public. |
| 7 | Tag `v0.1.0` and create the release with `.github/release-notes-0.1.0.md` | Abs | The Releases page shows v0.1.0 with those notes. Update `CHANGELOG.md` from "Unreleased" to the release date first. |
| 8 | Submit to the plugin directory following `docs/marketplace-listing.md`. The icon is locked at the first save, so choose it first | Abs | The portal shows the submission as in review. |

## About and topics

Description (under 120 characters):

```
Simulated investing legends debate your decision in Claude Code and return a scored verdict. Not investment advice.
```

That is 115 characters.

Homepage: `https://abhinav-uppal-website.vercel.app`

The site URL lives in exactly two places, each a link reference at the bottom of the file: `[site]` in `README.md` and `[site]` in `docs/TOUR.md`. For a custom domain later, change those two lines and the homepage field above.

Topics (lowercase, hyphens, 50 characters or fewer each, 20 at most):

```
claude-code
claude-code-plugin
claude
investing
stock-analysis
value-investing
sec-edgar
ai-agents
multi-agent
decision-making
thesis
portfolio
education
nodejs
zero-dependency
```
