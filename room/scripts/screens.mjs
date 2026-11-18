#!/usr/bin/env node
// Screenshot the Room next to the approved boards, at desktop (1440) and phone (390) widths,
// and check each page for sideways scrolling, spilling text and broken images.
//
//   node room/scripts/screens.mjs [--out room/test/screens]
//
// Needs Playwright with Chromium (not a dependency of the Room; the screenshots are for review).
// Writes room-*.png (the Room), compare-*.png (the A3 board and the Room side by side) and
// print-*.png (the Download PDF layout), and exits non-zero if a check fails.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.js';
import { startBoardServer } from './boards.mjs';
import { stageTo } from '../test/helpers/stepper.mjs';
import { layoutProblems, loadAllImages } from '../test/helpers/checks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOM = path.resolve(HERE, '..');
const NVDA = path.join(ROOM, 'examples', '2026-11-17-nvda-buy');
const i = process.argv.indexOf('--out');
const OUT = path.resolve(i > 0 ? process.argv[i + 1] : path.join(ROOM, 'test', 'screens'));
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = createRequire(import.meta.url)('playwright');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-screens-'));
const liveDir = path.join(tmp, 'live');
stageTo(NVDA, liveDir, 'round 2, first cards'); // the board's moment: Burry answering Druckenmiller

const boards = await startBoardServer(0);
const boardUrl = `http://127.0.0.1:${boards.address().port}`;
const live = await startServer({ session: liveDir, port: 0, quiet: true, journal: path.join(tmp, 'journal') });
const done = await startServer({ session: NVDA, port: 0, quiet: true, journal: path.join(tmp, 'journal') });
// The 13-seat smoke session from the seats build (Round 1 only), when it is in the repo.
const SMOKE = path.resolve(ROOM, '..', 'tests', 'seats', 'smoke', 'session-msft');
const smoke = fs.existsSync(path.join(SMOKE, 'council.json')) ? await startServer({ session: SMOKE, port: 0, quiet: true, journal: path.join(tmp, 'journal') }) : null;
const browser = await chromium.launch();
let failed = 0;

async function shoot(url, file, width, ready, { check = true } = {}) {
  const page = await browser.newPage({ viewport: { width, height: width < 760 ? 844 : 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !/_blob\/[0-9a-f]{32}|%7B%7B/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector(ready);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(loadAllImages);
  await page.waitForTimeout(600);
  const problems = check ? await page.evaluate(layoutProblems) : [];
  await page.screenshot({ path: path.join(OUT, file), fullPage: true, animations: 'disabled' });
  await page.close();
  const all = check ? [...problems, ...errors.map((e) => `console error: ${e}`)] : [];
  console.log(`${file}  ${all.length ? `PROBLEMS\n  ${all.join('\n  ')}` : 'clean'}`);
  if (all.length) failed += 1;
}

async function compare(a, b, file, width) {
  const page = await browser.newPage({ viewport: { width: width * 2 + 48, height: 600 }, deviceScaleFactor: 1 });
  const src = (f) => `data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString('base64')}`;
  await page.setContent(`<body style="margin:0;background:#1b1a18;font:500 14px system-ui;color:#ccc;display:flex;gap:16px;padding:16px;align-items:flex-start">
    <figure style="margin:0"><figcaption style="padding:0 0 8px">Approved board</figcaption><img src="${src(a)}" style="width:${width}px;display:block"></figure>
    <figure style="margin:0"><figcaption style="padding:0 0 8px">The Room</figcaption><img src="${src(b)}" style="width:${width}px;display:block"></figure></body>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  await page.close();
}

for (const w of [1440, 390]) {
  await shoot(`${boardUrl}/A3-Live.dc.html`, `board-live-${w}.png`, w, 'html[data-dc-ready]', { check: false });
  await shoot(`${boardUrl}/A3-Verdict.dc.html`, `board-verdict-${w}.png`, w, 'html[data-dc-ready]', { check: false });
  await shoot(`${live.url}/#/live`, `room-live-${w}.png`, w, '.v-live .speech');
  await shoot(`${done.url}/#/verdict`, `room-verdict-${w}.png`, w, '.v-verdict .hero');
  await compare(`board-live-${w}.png`, `room-live-${w}.png`, `compare-live-${w}.png`, w);
  if (smoke) await shoot(`${smoke.url}/#/live`, `room-smoke-13-seats-live-${w}.png`, w, '.v-live .speech');
  await compare(`board-verdict-${w}.png`, `room-verdict-${w}.png`, `compare-verdict-${w}.png`, w);
}

// Download PDF: the print stylesheet at A4 and Letter widths (96 dpi, inside the page margins).
for (const [name, width] of [['a4', 794], ['letter', 816]]) {
  const page = await browser.newPage({ viewport: { width, height: 1100 } });
  await page.goto(`${done.url}/#/verdict`);
  await page.waitForSelector('.v-verdict .hero');
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `print-${name}.png`), fullPage: true, animations: 'disabled' });
  await page.pdf({ path: path.join(tmp, `verdict-${name}.pdf`), format: name === 'a4' ? 'A4' : 'Letter', printBackground: true });
  console.log(`print-${name}.png  ${fs.statSync(path.join(tmp, `verdict-${name}.pdf`)).size} byte PDF`);
  await page.close();
}

await browser.close();
await live.close();
await done.close();
if (smoke) await smoke.close();
boards.close();
fs.rmSync(tmp, { recursive: true, force: true });
// The boards appear in the compare images; keep only those, the Room's own shots and the print shots.
for (const f of fs.readdirSync(OUT)) if (/^board-.*\.png$/.test(f)) fs.rmSync(path.join(OUT, f));
console.log(failed ? `${failed} page(s) with problems` : 'All pages clean.');
process.exit(failed ? 1 : 0);
