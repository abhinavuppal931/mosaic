// Capture the screenshots for the feature tour page, the README verdict image and the hero loop.
//
//   node room/scripts/tour.mjs [--out docs/tour]
//
// Starts the Room in-process against temporary homes (nothing of yours is touched), drives it with
// Playwright, and writes numbered .webp files to docs/tour plus docs/verdict.webp, docs/hero-loop.gif
// and docs/hero-loop.mp4.
//
// Marketing rules, enforced here: no price level (a "$" followed by a digit) in any captured frame
// (the user's own question in the page header is the one allowed place), and nobody who is deceased
// or retired (Munger, Buffett) is ever the one shown speaking.
// Needs Playwright with Chromium, ffmpeg, and python3 with PIL (WebP support). None are dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOM = path.resolve(HERE, '..');
const NVDA = path.join(ROOM, 'examples', '2026-11-17-nvda-buy');
const COST = path.join(ROOM, 'examples', '2026-11-12-cost-sell');
const i = process.argv.indexOf('--out');
const OUT = path.resolve(i > 0 ? process.argv[i + 1] : path.join(ROOM, '..', 'docs', 'tour'));
const DOCS = path.resolve(OUT, '..'); // verdict.webp and the hero loop sit next to the tour folder
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = createRequire(import.meta.url)('playwright');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-tour-'));
const raw = path.join(tmp, 'raw');
fs.mkdirSync(raw);

// ---------- helpers ----------

const PRICE = /\$\s?\d/;
const report = []; // { file, hits, speaker }

/** Copy chosen files of an example into <home>/sessions/<name>. cut = { 'round-2.md': ['Burry', withChair] } trims a round file. */
function makeHome(name, src, files, cut = {}) {
  const home = path.join(tmp, name);
  const sess = path.join(home, 'sessions', path.basename(src));
  fs.mkdirSync(sess, { recursive: true });
  fs.mkdirSync(path.join(home, 'journal'), { recursive: true });
  for (const f of files || fs.readdirSync(src)) {
    if (cut[f]) fs.writeFileSync(path.join(sess, f), cutCards(fs.readFileSync(path.join(src, f), 'utf8'), ...cut[f]));
    else fs.copyFileSync(path.join(src, f), path.join(sess, f));
  }
  return home;
}

/** Keep the round file's cards through `upto` (and the Chair notes if asked). */
function cutCards(md, upto, withChair = false) {
  const keep = [];
  let chair = '';
  let done = false;
  for (const p of md.split(/^(?=## )/m)) {
    if (/^## chair/i.test(p)) { chair = p; continue; }
    if (done) continue;
    keep.push(p);
    if (new RegExp(`^## ${upto}\\b`).test(p)) done = true;
  }
  return keep.join('') + (withChair ? chair : '');
}

const room = (home, extra = {}) =>
  startServer({ home, sessions: path.join(home, 'sessions'), journal: path.join(home, 'journal'), port: 0, quiet: true, ...extra });

/** PNG -> WebP. Steps the quality down while the file is over maxKb. */
function toWebp(png, name, width, { cropTop = null, quality = 82, dir = OUT, maxKb = 0 } = {}) {
  const dest = path.join(dir, name);
  let q = quality;
  let kb;
  for (;;) {
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
`, png, dest, String(width), String(cropTop || 0), String(q)]);
    kb = Math.round(fs.statSync(dest).size / 1024);
    if (!maxKb || kb <= maxKb || q <= 50) break;
    q -= 4;
  }
  console.log(`${name}  ${kb} KB${q !== quality ? ` (quality ${q})` : ''}`);
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

/**
 * The marketing rules, as a check on what a frame shows: the visible text (of `sel`) has no "$" followed by a
 * digit, and the speaker is not Munger or Buffett. The user's own question in the header is the one allowed
 * place for a price. Returns { text, hits, speaker }; a forbidden speaker throws, prices are reported.
 */
async function audit(page, file, { sel = 'body', speaker = false } = {}) {
  const { text, q, sp } = await page.evaluate((s) => ({
    text: document.querySelector(s).innerText,
    // The header question is allowed; the Sources drawer is parked off screen while closed, so it is not in the frame.
    q: [...document.querySelectorAll('.hq, .qmob h1, #drawer[aria-hidden="true"]')].map((e) => e.innerText),
    sp: document.querySelector('.speech .name')?.innerText ?? null,
  }), sel);
  let t = text;
  for (const x of q) if (x) t = t.split(x).join('');
  const hits = t.match(/\$\s?\d[\d.,]*/g) || [];
  if (speaker && sp && /munger|buffett/i.test(sp)) throw new Error(`${file}: ${sp} is speaking`);
  if (file) report.push({ file, hits, speaker: speaker ? sp : undefined });
  const ctxs = hits.map((h) => { const i = t.indexOf(h); return JSON.stringify(t.slice(Math.max(0, i - 50), i + 30)); });
  if (hits.length && process.env.TOUR_DEBUG) console.log(file || '(step)', ctxs.join('\n  '));
  return { text, hits, speaker: sp };
}

// ---------- 01, 02: empty home (kept as they are in the repo; the script still makes them) ----------
const empty = makeHome('empty', NVDA, []);
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

// ---------- 03, 12: live state, round 2 cut after Burry (Burry speaking) ----------
// Costco, not NVIDIA: Burry's NVIDIA card quotes price levels ("$150 to $205 ... At $182"), which the marketing
// rule forbids in a frame. His Costco card has none.
const liveFiles = ['brief.md', 'council.json', 'data-pack.json', 'citations.json', 'cruxes.json', 'lean.json', 'round-1.md', 'round-2.md'];
const live2 = makeHome('live2', COST, liveFiles, { 'round-2.md': ['Burry'] });
srv = await room(live2);
{
  let { page, ctx } = await open(`${srv.url}/#/live`, { ready: '.v-live .speech', reduce: true });
  await page.waitForTimeout(3000);
  await audit(page, '03-live-debate.webp', { speaker: true });
  toWebp(await snap(page, '03-live-debate.webp'), '03-live-debate.webp', 1440);
  await ctx.close();
  ({ page, ctx } = await open(`${srv.url}/#/live`, { w: 390, h: 844, scale: 3, ready: '.v-live .speech', reduce: true }));
  await page.waitForTimeout(3000);
  await audit(page, '12-phone.webp', { speaker: true });
  toWebp(await snap(page, '12-phone.webp'), '12-phone.webp', 1170);
  await ctx.close();
}
await srv.close();

// ---------- 04: Round 1 on the Costco example (no price levels in it), Taleb speaking ----------
const live1 = makeHome('live1', COST, ['brief.md', 'council.json', 'data-pack.json', 'citations.json', 'round-1.md'], { 'round-1.md': ['Taleb'] });
srv = await room(live1);
{
  const { page, ctx } = await open(`${srv.url}/#/live`, { ready: '.v-live .speech', reduce: true });
  await page.waitForTimeout(3000);
  await audit(page, '04-round-1.webp', { speaker: true });
  toWebp(await snap(page, '04-round-1.webp'), '04-round-1.webp', 1440);
  await ctx.close();
}
await srv.close();

// ---------- verdict.webp, 05, 06, 07, 09, 10, 11, 12b: the finished Costco example, --session mode ----------
const finHome = path.join(tmp, 'fin');
fs.mkdirSync(path.join(finHome, 'journal'), { recursive: true });
srv = await startServer({ session: COST, sessions: path.join(finHome, 'sessions'), journal: path.join(finHome, 'journal'), port: 0, quiet: true });
{
  let { page, ctx } = await open(`${srv.url}/#/verdict`, { ready: '.v-verdict .hero', reduce: true });
  await page.waitForTimeout(1200);
  await audit(page, 'verdict.webp'); // the README image: 1440 wide, under 200 KB
  toWebp(await snap(page, 'verdict.webp'), 'verdict.webp', 1440, { dir: DOCS, maxKb: 200 });
  await audit(page, '05-verdict.webp');
  toWebp(await snap(page, '05-verdict.webp'), '05-verdict.webp', 1440);

  await audit(page, '06-verdict-full.webp');
  const full = await snap(page, '06-verdict-full.webp', { fullPage: true });
  if (toWebp(full, '06-verdict-full.webp', 1200) > 400) toWebp(full, '06-verdict-full.webp', 1200, { cropTop: 2400 });

  await page.locator('section[aria-label="How each investor scored the choices"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await audit(page, '07-scorecard.webp', { sel: 'section[aria-label="How each investor scored the choices"]' });
  await page.locator('section[aria-label="How each investor scored the choices"]').screenshot({ path: path.join(raw, '07-scorecard.png'), animations: 'disabled' });
  toWebp(path.join(raw, '07-scorecard.png'), '07-scorecard.webp', 1440);

  await page.locator('.banner').scrollIntoViewIfNeeded();
  const rc = await audit(page, '09-recheck.webp', { sel: '.banner' });
  if (!rc.text.includes('/mosaic recheck COST')) console.log('WARNING: the recheck banner does not show /mosaic recheck COST');
  await page.locator('.banner').screenshot({ path: path.join(raw, '09-recheck.png'), animations: 'disabled' });
  toWebp(path.join(raw, '09-recheck.png'), '09-recheck.webp', 1440);

  // Share: the Room builds the card as a PNG and downloads it. (The card is drawn from the verdict text just audited.)
  await page.evaluate(() => window.scrollTo(0, 0));
  await audit(page, '10-share-card.webp');
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
  await audit(page, '11-pdf.webp');
  toWebp(await snap(page, '11-pdf.webp'), '11-pdf.webp', 794);
  await ctx.close();

  ({ page, ctx } = await open(`${srv.url}/#/verdict`, { w: 390, h: 844, scale: 3, ready: '.v-verdict .hero', reduce: true }));
  await page.waitForTimeout(1000);
  await audit(page, '12b-phone-verdict.webp');
  toWebp(await snap(page, '12b-phone-verdict.webp'), '12b-phone-verdict.webp', 1170);
  await ctx.close();
}
await srv.close();

// ---------- 08: journal with one saved council (kept as it is in the repo) ----------
const jHome = makeHome('journal', NVDA, null);
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

// ---------- hero loop: a REAL live council, the Costco example written file by file ----------
// The Room polls every 400 ms, so each step is one write burst and then a dwell. A first pass checks every
// step (no price levels, nobody barred speaking) without recording; the second pass records the page.
async function hero(record) {
  const home = path.join(tmp, record ? 'hero-rec' : 'hero-dry');
  fs.mkdirSync(path.join(home, 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(home, 'journal'), { recursive: true });
  const sess = path.join(home, 'sessions', path.basename(COST));
  const rd = (f) => fs.readFileSync(path.join(COST, f), 'utf8');
  const wr = (f, c) => fs.writeFileSync(path.join(sess, f), c);
  const r1 = rd('round-1.md');
  const r2 = rd('round-2.md');
  const rest = ['round-3.md', 'draft.json', 'draft-resolution.md'].filter((f) => fs.existsSync(path.join(COST, f)));
  const steps = [
    ['table', 1.2, () => {
      fs.mkdirSync(sess, { recursive: true });
      for (const f of ['brief.md', 'council.json', 'data-pack.json', 'data-pack.md', 'citations.json']) if (fs.existsSync(path.join(COST, f))) wr(f, rd(f));
    }],
    ['round 1: Buffett, Munger, Marks', 1.4, () => wr('round-1.md', cutCards(r1, 'Marks'))],
    ['round 1: through Taleb', 1.4, () => wr('round-1.md', cutCards(r1, 'Taleb'))],
    ['round 1: through Burry + Chair notes, cruxes, lean', 1.4, () => { wr('round-1.md', r1); wr('cruxes.json', rd('cruxes.json')); wr('lean.json', rd('lean.json')); }],
    ['round 2: Marks', 1.6, () => wr('round-2.md', cutCards(r2, 'Marks'))],
    ['round 2: Buffett + Burry together', 1.6, () => wr('round-2.md', cutCards(r2, 'Burry'))],
    ['round 2: through Taleb', 1.6, () => wr('round-2.md', cutCards(r2, 'Taleb'))],
    ['everything else, then the verdict', 3, () => {
      wr('round-2.md', r2);
      for (const f of rest) wr(f, rd(f));
      wr('scores.json', rd('scores.json'));
      wr('verdict.md', rd('verdict.md'));
      wr('verdict.json', rd('verdict.json'));
    }],
  ];
  const s = await room(home, { examples: null }); // no example behind the empty table: the page waits for the files
  const vdir = path.join(tmp, 'video');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...(record ? { recordVideo: { dir: vdir, size: { width: 1280, height: 800 } } } : {}) });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(`${s.url}/#/`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  let tStart = 0;
  const seq = [];
  for (const [name, dwell, write] of steps) {
    const t = Date.now();
    write();
    if (!tStart) tStart = t;
    await page.waitForTimeout(dwell * 1000 - 800); // let the poll and the transitions land, then look
    const a = await audit(page, null, { speaker: true });
    if (a.hits.length) throw new Error(`hero step "${name}" shows a price: ${a.hits.join(' ')}`);
    await page.screenshot({ path: path.join(raw, `hero-${record ? 'rec' : 'dry'}-${seq.length + 1}.png`) });
    seq.push(a.speaker ?? '(none)');
    console.log(`hero step ${seq.length}  ${name}  speaker: ${a.speaker ?? '(none)'}`);
    await page.waitForTimeout(Math.max(0, dwell * 1000 - (Date.now() - t)));
  }
  const verdictShown = await page.evaluate(() => !!document.querySelector('.v-verdict .hero'));
  console.log(`hero ends on the verdict: ${verdictShown}`);
  if (!verdictShown) throw new Error('the Room did not switch to the verdict by itself');
  await ctx.close();
  await s.close();
  return { startAt: (tStart - t0) / 1000, vdir };
}
await hero(false);
{
  const { startAt, vdir } = await hero(true);
  const webm = path.join(vdir, fs.readdirSync(vdir).find((f) => f.endsWith('.webm')));
  const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
  // Trim the empty "table is set" screen: the first big change in the video is the table appearing; start 0.6 s
  // after that so the first frame is the assembled table (the first speaker follows about 1.2 s after it).
  const scenes = spawnSync('ffmpeg', ['-i', webm, '-vf', "select='gt(scene,0.05)',showinfo", '-an', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const tTable = Number((scenes.match(/pts_time:([0-9.]+)/) || [])[1] ?? startAt);
  const ss = (tTable + 0.6).toFixed(2);
  console.log(`hero: the table appears at ${tTable.toFixed(2)} s, trimming from ${ss} s`);
  // 15 s at most.
  const trim = ['-ss', ss, '-i', webm, '-t', '15'];
  const mp4 = path.join(DOCS, 'hero-loop.mp4');
  ff(...trim, '-an', '-c:v', 'libx264', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
  const gifPath = path.join(DOCS, 'hero-loop.gif');
  // The page is static between beats, so drop duplicate frames (mpdecimate) and let the GIF hold them with longer
  // frame delays (-fps_mode vfr). Two-pass palette. Widest and smoothest first; step down until the GIF is 2.5 MB or under.
  // mpdecimate drops the trailing hold on the verdict, so the last frame's delay (-final_delay) is topped up afterwards.
  const probeDur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
  const target = Math.min(15, probeDur(mp4));
  const pal = path.join(tmp, 'pal.png');
  const encode = (w, fps, colors, dither, dec, finalCs) => {
    const pre = `fps=${fps},${dec},scale=${w}:-1:flags=lanczos`;
    ff(...trim, '-vf', `${pre},palettegen=max_colors=${colors}:stats_mode=diff`, pal);
    ff(...trim, '-i', pal, '-fps_mode', 'vfr', '-final_delay', String(finalCs), '-lavfi', `${pre},setpts=PTS[x];[x][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`, gifPath);
  };
  const mild = 'mpdecimate=hi=64*12:lo=64*5:frac=0.33', firm = 'mpdecimate=hi=64*40:lo=64*20:frac=0.5', firmer = 'mpdecimate=hi=64*60:lo=64*30:frac=0.8';
  for (const [w, fps, colors, dither, dec] of [[900, 12, 96, 'bayer:bayer_scale=5', firm], [900, 12, 64, 'none', firm], [900, 12, 64, 'bayer:bayer_scale=5', firmer], [840, 12, 64, 'none', firmer], [840, 12, 64, 'none', mild]]) {
    encode(w, fps, colors, dither, dec, 0);
    const short = target - probeDur(gifPath);
    if (short > 0.05) encode(w, fps, colors, dither, dec, Math.round(short * 100));
    const gif = fs.statSync(gifPath).size;
    console.log(`hero-loop.gif at ${w}px, ${fps} fps, ${colors} colours, dither ${dither}, ${dec}: ${(gif / 1048576).toFixed(2)} MB, ${probeDur(gifPath).toFixed(2)} s`);
    if (gif <= 2.5 * 1048576) break;
  }
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
  console.log(`hero-loop.mp4  ${(fs.statSync(mp4).size / 1048576).toFixed(2)} MB, ${Number(dur).toFixed(1)} s`);
  if (process.env.TOUR_KEEP_VIDEO) fs.copyFileSync(webm, process.env.TOUR_KEEP_VIDEO);
}

await browser.close();

console.log('\nPrice check (a "$" followed by a digit anywhere in the frame text, header question excluded):');
for (const r of report) console.log(`  ${r.file.padEnd(24)} ${r.hits.length ? `PRICE: ${r.hits.join(' ')}` : 'none'}${r.speaker !== undefined ? `   speaker: ${r.speaker}` : ''}`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote the tour to ${OUT}`);
