#!/usr/bin/env node
// Capture the screenshots and the short council video for the feature tour page.
//
//   node room/scripts/tour.mjs [--out docs/tour]
//
// Starts the Room in-process against temporary homes (nothing of yours is touched), drives it with
// Playwright, and writes numbered .webp files, council.gif and council.mp4 to docs/tour.
// Needs Playwright with Chromium, ffmpeg, and python3 with PIL (WebP support). None are dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOM = path.resolve(HERE, '..');
const NVDA = path.join(ROOM, 'examples', '2026-11-17-nvda-buy');
const i = process.argv.indexOf('--out');
const OUT = path.resolve(i > 0 ? process.argv[i + 1] : path.join(ROOM, '..', 'docs', 'tour'));
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = createRequire(import.meta.url)('playwright');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-tour-'));
const raw = path.join(tmp, 'raw');
fs.mkdirSync(raw);

// ---------- helpers ----------

/** Copy chosen files of the NVDA example into <home>/sessions/<name>. */
function makeHome(name, files, { cutRound2 = false } = {}) {
  const home = path.join(tmp, name);
  const sess = path.join(home, 'sessions', path.basename(NVDA));
  fs.mkdirSync(sess, { recursive: true });
  fs.mkdirSync(path.join(home, 'journal'), { recursive: true });
  const list = files || fs.readdirSync(NVDA);
  for (const f of list) {
    if (cutRound2 && f === 'round-2.md') {
      const md = fs.readFileSync(path.join(NVDA, f), 'utf8');
      // Keep the cards through Munger; drop the later cards and the Chair notes.
      const parts = md.split(/^(?=## )/m);
      const keep = [];
      for (const p of parts) {
        if (/^## chair/i.test(p)) break;
        keep.push(p);
        if (/^## Munger/.test(p)) break;
      }
      fs.writeFileSync(path.join(sess, f), keep.join(''));
    } else fs.copyFileSync(path.join(NVDA, f), path.join(sess, f));
  }
  return home;
}
const room = (home, extra = {}) =>
  startServer({ home, sessions: path.join(home, 'sessions'), journal: path.join(home, 'journal'), port: 0, quiet: true, ...extra });

function toWebp(png, name, width, { cropTop = null, quality = 82 } = {}) {
  const dest = path.join(OUT, name);
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
src, dest, w, crop, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], int(sys.argv[5])
im = Image.open(src).convert('RGB')
if im.width != w:
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
if crop != '0' and im.height > int(crop):
    im = im.crop((0, 0, w, int(crop)))
im.save(dest, 'WEBP', quality=q, method=6)
`, png, dest, String(width), String(cropTop || 0), String(quality)]);
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`${name}  ${kb} KB`);
  return kb;
}

const browser = await chromium.launch();

/** Open a page, wait for the view to settle, return it. */
async function open(url, { w = 1440, h = 900, scale = 2, ready, reduce = false, media } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, acceptDownloads: true });
  const page = await ctx.newPage();
  if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  if (ready) await page.waitForSelector(ready);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const loads = [...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 4000))]);
  });
  if (media) await page.emulateMedia({ media });
  return { page, ctx };
}

async function snap(page, file, opts = {}) {
  const png = path.join(raw, file.replace(/\.webp$/, '.png'));
  await page.screenshot({ path: png, animations: 'disabled', ...opts });
  return png;
}

// ---------- 01, 02: empty home ----------
const empty = makeHome('empty', []);
fs.rmSync(path.join(empty, 'sessions', path.basename(NVDA)), { recursive: true });
let srv = await room(empty);
{
  let { page, ctx } = await open(srv.url, { ready: '.v-verdict .hero' });
  await page.waitForTimeout(800);
  toWebp(await snap(page, '01-first-run.webp'), '01-first-run.webp', 1440);
  await ctx.close();
  ({ page, ctx } = await open(`${srv.url}/#/journal`, { h: 680, ready: '.v-journal, .jempty' }));
  await page.waitForTimeout(800);
  toWebp(await snap(page, '02-examples.webp'), '02-examples.webp', 1440);
  await ctx.close();
}
await srv.close();

// ---------- 03, 04, 12: live states ----------
const liveFiles = ['brief.md', 'council.json', 'data-pack.json', 'data-pack.md', 'citations.json', 'cruxes.json', 'lean.json', 'round-1.md', 'round-2.md'];
const live2 = makeHome('live2', liveFiles, { cutRound2: true });
srv = await room(live2);
{
  let { page, ctx } = await open(`${srv.url}/#/live`, { ready: '.v-live .speech', reduce: true });
  await page.waitForTimeout(3000);
  toWebp(await snap(page, '03-live-debate.webp'), '03-live-debate.webp', 1440);
  await ctx.close();
  ({ page, ctx } = await open(`${srv.url}/#/live`, { w: 390, h: 844, scale: 3, ready: '.v-live .speech', reduce: true }));
  await page.waitForTimeout(3000);
  toWebp(await snap(page, '12-phone.webp'), '12-phone.webp', 1170);
  await ctx.close();
}
await srv.close();

const live1 = makeHome('live1', ['brief.md', 'council.json', 'data-pack.json', 'data-pack.md', 'round-1.md']);
srv = await room(live1);
{
  const { page, ctx } = await open(`${srv.url}/#/live`, { ready: '.v-live .speech', reduce: true });
  await page.waitForTimeout(3000);
  toWebp(await snap(page, '04-round-1.webp'), '04-round-1.webp', 1440);
  await ctx.close();
}
await srv.close();

// ---------- 05, 06, 07, 09, 10, 11, 12b: the finished example, --session mode ----------
const finHome = path.join(tmp, 'fin');
fs.mkdirSync(path.join(finHome, 'journal'), { recursive: true });
srv = await startServer({ session: NVDA, sessions: path.join(finHome, 'sessions'), journal: path.join(finHome, 'journal'), port: 0, quiet: true });
{
  let { page, ctx } = await open(`${srv.url}/#/verdict`, { ready: '.v-verdict .hero', reduce: true });
  await page.waitForTimeout(1200);
  toWebp(await snap(page, '05-verdict.webp'), '05-verdict.webp', 1440);

  const full = await snap(page, '06-verdict-full.webp', { fullPage: true });
  if (toWebp(full, '06-verdict-full.webp', 1200) > 400) toWebp(full, '06-verdict-full.webp', 1200, { cropTop: 2400 });

  await page.locator('section[aria-label="How each investor scored the choices"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.locator('section[aria-label="How each investor scored the choices"]').screenshot({ path: path.join(raw, '07-scorecard.png'), animations: 'disabled' });
  toWebp(path.join(raw, '07-scorecard.png'), '07-scorecard.webp', 1440);

  await page.locator('.banner').scrollIntoViewIfNeeded();
  await page.locator('.banner').screenshot({ path: path.join(raw, '09-recheck.png'), animations: 'disabled' });
  toWebp(path.join(raw, '09-recheck.png'), '09-recheck.webp', 1440);

  // Share: the Room builds the card as a PNG and downloads it.
  await page.evaluate(() => window.scrollTo(0, 0));
  const dl = page.waitForEvent('download');
  await page.click('[data-act=share]');
  const d = await dl;
  const sharePng = path.join(raw, '10-share-card.png');
  await d.saveAs(sharePng);
  toWebp(sharePng, '10-share-card.webp', 1200);
  await ctx.close();

  // Download PDF is window.print(): show the print stylesheet at A4 width.
  ({ page, ctx } = await open(`${srv.url}/#/verdict`, { w: 794, h: 1123, scale: 2, ready: '.v-verdict .hero', reduce: true, media: 'print' }));
  await page.waitForTimeout(800);
  toWebp(await snap(page, '11-pdf.webp'), '11-pdf.webp', 794);
  await ctx.close();

  ({ page, ctx } = await open(`${srv.url}/#/verdict`, { w: 390, h: 844, scale: 3, ready: '.v-verdict .hero', reduce: true }));
  await page.waitForTimeout(1000);
  toWebp(await snap(page, '12b-phone-verdict.webp'), '12b-phone-verdict.webp', 1170);
  await ctx.close();
}
await srv.close();

// ---------- 08: journal with one saved council ----------
const jHome = makeHome('journal', null);
srv = await room(jHome);
{
  const { page, ctx } = await open(`${srv.url}/#/verdict`, { h: 680, ready: '.v-verdict .hero' });
  const res = await page.evaluate(async () => (await fetch('/api/journal', { method: 'POST' })).json());
  if (!res.ok) console.log(`journal save failed: ${res.error}`);
  await page.goto(`${srv.url}/#/journal`);
  await page.reload();
  await page.waitForSelector('.v-journal');
  await page.waitForTimeout(1000);
  toWebp(await snap(page, '08-journal.webp'), '08-journal.webp', 1440);
  await ctx.close();
}
await srv.close();

// ---------- video: replay the finished council ----------
srv = await startServer({ session: NVDA, sessions: path.join(finHome, 'sessions'), journal: path.join(finHome, 'journal'), port: 0, quiet: true });
{
  const vdir = path.join(tmp, 'video');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: vdir, size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  await page.goto(`${srv.url}/#/live`);
  await page.waitForSelector('.v-live .speech');
  await page.waitForTimeout(1200);
  for (let k = 0; k < 80; k++) await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1200);
  for (let k = 0; k < 15; k++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(600);
  await ctx.close();
  const webm = path.join(vdir, fs.readdirSync(vdir).find((f) => f.endsWith('.webm')));
  const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
  ff('-i', webm, '-an', '-c:v', 'libx264', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'council.mp4'));
  let gif;
  // Widest and smoothest first; step down until the GIF is under 5 MB.
  for (const [w, fps, colors, dither] of [[960, 10, 256, 'bayer:bayer_scale=5'], [800, 8, 128, 'none'], [720, 8, 96, 'none'], [640, 8, 64, 'none']]) {
    const pal = path.join(tmp, 'pal.png');
    ff('-i', webm, '-vf', `fps=${fps},scale=${w}:-1:flags=lanczos,palettegen=max_colors=${colors}:stats_mode=diff`, pal);
    ff('-i', webm, '-i', pal, '-lavfi', `fps=${fps},scale=${w}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`, path.join(OUT, 'council.gif'));
    gif = fs.statSync(path.join(OUT, 'council.gif')).size;
    console.log(`council.gif at ${w}px, ${fps} fps: ${(gif / 1048576).toFixed(2)} MB`);
    if (gif < 5 * 1048576) break;
  }
  console.log(`council.mp4  ${(fs.statSync(path.join(OUT, 'council.mp4')).size / 1048576).toFixed(2)} MB`);
}
await srv.close();

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote the tour to ${OUT}`);
