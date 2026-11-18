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
- **Social B, Centred** (`social-b.png`): a centred mark and headline over the seats, faded behind. It shows less of the product, but it survives square and small crops.
- `social-cards.png` shows both inside X, LinkedIn and Slack link cards, and as a 120 px square, at real display sizes. On X, the "github.com" chip sits in the bottom-left corner, so Social A keeps its attribution line above that corner.
