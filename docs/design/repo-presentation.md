# How Mosaic presents itself on GitHub (ABH-339)

Research done on 2026-11-18 from each repo's raw README and its GitHub page. Image sizes were measured from the files. The GitHub API was not available to this session, so topics come from the repo pages and may be incomplete, and social preview images could not be checked for any repo.

## What the references do

| Repo | Top of README | Hero | Badges | Screens in README | About and topics |
|---|---|---|---|---|---|
| [nateherkai/roast-room](https://github.com/nateherkai/roast-room) | Text title, no logo | One JPG, [`docs/room.jpg`](https://raw.githubusercontent.com/nateherkai/roast-room/main/docs/room.jpg), 1477 by 778, 140 KB, in the repo | 0 | 1 | One sentence; no topics found |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | `<picture>` light and dark cover, no h1 | Cover 1280 by 336, 89 KB, external CDN | 6 | About 23 images, mostly badges and sponsors | About 55 characters, 7 topics |
| [calcom/cal.com](https://github.com/calcom/cal.com) | Centred logo, h3 title | One screenshot at full width, user attachment | 6 | About 16 | One line, 11 topics |
| [supabase/supabase](https://github.com/supabase/supabase) | Centred logo, light and dark | Dashboard screenshot | 0 | 7 | About 130 characters, 19 topics |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | Text title, no logo | One PNG, 2400 by 1260, 84 KB, in the repo | 0 | 1 | About 60 characters, 17 topics |
| [raycast/extensions](https://github.com/raycast/extensions) | Centred logo, 128 px high, h1 | One WebP, about 2048 by 1440, 104 KB, in the repo | 2 | 4 | One line |
| [tldraw/tldraw](https://github.com/tldraw/tldraw) | `<picture>` light and dark hero | Repo-hosted PNG pair | 4 | About 6 at the top | Tagline, 12 topics |
| [mksglu/context-mode](https://github.com/mksglu/context-mode) (a top Claude Code plugin) | Text title, no logo | One PNG, 2560 by 1280 (2:1), 80 KB, in the repo, long alt text | 4 | Few | About 230 characters, 20 topics |

## The pattern

- **One static hero, about 2:1.** Every reference uses a single still image: 1280 to 2560 px wide, 80 to 140 KB, PNG or WebP, hosted in the repo. None uses a GIF or video at the top.
- **Icon above the title only when there is a real mark.** Raycast and Cal centre a logo about 96 to 128 px high. Plugin and CLI repos use a text title.
- **No long tour in the README.** The references keep 1 to 4 images in the README and put the rest on a website or a docs page.
- **Few badges.** Design-led repos use 0 to 2. Repos with 6 badges read busier.
- **About.** 35 to 130 characters, plain, plus 7 to 20 topics.
- **Social preview.** GitHub recommends 1280 by 640. It could not be checked here, so check it after uploading.

## Decision for Mosaic

1. **Top of the README:** the chosen icon at about 96 px, centred, above a text title and a one-line value statement. A real mark exists, so the icon earns its place.
2. **Hero:** one still image, 2400 by 1200 (2:1), WebP at about 150 KB, built from the real Room, with descriptive alt text. Both options sit in `options/` as `hero-a.webp` and `hero-b.webp`. The Room is dark-only, so there is no light and dark pair.
3. **Badges:** four, as the brief asks: license, zero dependencies, Claude Code plugin, CI. That is at the high end for design-led repos, so they go on one line under the tagline.
4. **Screenshots:** a separate `docs/TOUR.md`, linked from the README with "See it in action". The README keeps the hero only.
5. **Social preview:** `docs/social-preview.png` at 1280 by 640, cut from the chosen hero, uploaded by Abs in Settings.
6. **About:** under 120 characters, plus 15 topics. The exact text is in `docs/LAUNCH.md`.

## Options for review

`repo-options.png` shows all five on one sheet. The files are in `options/`:

- **Icon A, Tessera** (`icon-a.svg`, `icon-a.png`): the Room's four-square mark, refined, on a warm black field.
- **Icon B, Ceramic** (`icon-b.png`, rendered in three.js from `icon-b.scene.html`; `icon-b.svg` is a vector version for small sizes): glazed tiles, the amber one raised and casting a shadow. Its dark tile fades at 16 px.
- **Icon C, Dissent** (`icon-c.svg`, `icon-c.png`): a paper field, with the amber tile a step out of the grid.
- **Hero A, Window** (`hero-a.webp`): copy on the left, and the live Room in a browser frame that bleeds off the right edge.
- **Hero B, Debate to verdict** (`hero-b.webp`): a centred headline over the live debate and the verdict, side by side.

The live frame is a real Room state: the NVIDIA example paused in Round 2, while Munger answers Druckenmiller. The verdict frame is the same example finished.
- **Social A, Split** (`social-a.png`, 1280 by 640): the headline on the left, and the live Room with Munger speaking on the right. Strongest at 1.91:1 on X and LinkedIn. A centred square crop loses most of the headline.
- **Social B, Centred** (now `docs/social-preview.png`): a centred mark and headline over the seats, faded behind. It shows less of the product, but it survives square and small crops.
- `social-cards.png` shows both inside X, LinkedIn and Slack link cards, and as a 120 px square, at real display sizes. On X, the "github.com" chip sits in the bottom-left corner, so Social A keeps its attribution line above that corner.

## Picks and fixes (after the blind review)

The picks were Icon C, Hero A and Social B. Icon B, Hero B and Social A were dropped, and so was Icon A. The panel's fixes:

- **Copy.** Every asset says "Simulated from their public work" and "Not investment advice." at a legible size, and none says a bare "Thirteen": a council seats seven, not thirteen. The marketing lines use plain words, with no "seats", "Chair" or "keeps the dissent". No frame shows a price level.
- **Icon C.** It sits on the warm-black field, with flat tiles. The amber tile is turned 8 degrees, and the group is centred on its true bounds. Every tile is at least 3:1 against the field. `icon-c-small.svg` is the favicon and small-size cut, with the glyph at 80%. `mark.svg` is the bare mark used in every lockup.
- **Hero A.** The frame shows Michael Burry, who is living, speaking in Round 2. The window has equal top and bottom margins. A verdict card is drawn in the Room's own style. The command chip frames the decision, and the install line sits under it.
- **Social B.** Only the seat row sits behind the type, brightened. The centred block is 600 px wide. A verdict chip is added, and the attribution is legible, with no URL on the image.

## Agent-led setup and the step-3 trap (ABH-339, round 3)

Abs typed `/mosaic` in Windows Command Prompt and got "'/mosaic' is not recognized". A newcomer cannot tell the terminal and Claude Code apart, so the fix removes the step and adds an agent path.

What the conventions say:

- [Cline's MCP marketplace](https://github.com/cline/mcp-marketplace) reads a repo's README and an optional `llms-install.md` at the root, with extra setup guidance for agents. Submitters test by giving Cline only those files. It is the only named install-for-agents convention found.
- [AGENTS.md](https://agents.md) is "a README for agents" that work on a repo's code: build, test and conventions. [Claude Code reads it](https://code.claude.com/docs/en/memory.md) as project instructions. It is for contributors, not for installing a tool, so Mosaic does not add one.
- Plugin repos with a paste-to-agent line: [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) says "Read INSTALL.md, install caveman for me", next to the plain install commands. Most top repos give only the shell command.
- Claude Code documents `claude "query"` as "Start interactive session with initial prompt" ([CLI reference](https://code.claude.com/docs/en/cli-reference)). It does not say that a slash command works as that prompt, so this was tested.
- [Deep links](https://code.claude.com/docs/en/deep-links.md) (`claude-cli://open?q=...`) only pre-fill a prompt, work only after Claude Code has run once on that machine, and are stripped from GitHub READMEs. They are not a first-run path.

What Mosaic does:

1. **Two terminal commands.** `claude plugin install mosaic --marketplace abhinavuppal931/mosaic`, then `claude "/mosaic"`. Tested in a pseudo-terminal from a clean home on Claude Code 2.1.327: the second command starts Claude Code, runs the skill, opens the Room on the examples and asks for the decision, with no permission prompts. Nothing has to be typed inside Claude Code on the first run.
2. **Every block is labelled**, either "In your terminal" or "Inside Claude Code". Troubleshooting covers "'/mosaic' is not recognized" and "'claude' is not recognized".
3. **One agent line, backed by `llms-install.md` at the root.** It names Cline's convention, and the file has one path for Claude Code and one for other agents. The Claude Code path was tested end to end from a clean home, using a local copy that points at this branch. The agent checked Node and Claude Code, installed the plugin, opened the Room on the examples and told the user how to run `/mosaic`. The raw GitHub URL in the line works once the repo is public.
