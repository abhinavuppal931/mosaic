// End to end: start the Room on a session folder, write the session files phase by phase, and
// check the page follows; then click every control on the verdict. Needs Playwright with
// Chromium; skipped when it is not installed (it is not a dependency of the Room).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../server.js';
import { phases, stageTo } from '../helpers/stepper.mjs';
import { layoutProblems, loadAllImages } from '../helpers/checks.mjs';

const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples');
const NVDA = path.join(EX, '2026-11-17-nvda-buy');
let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  chromium = null;
}
const skip = chromium ? false : 'Playwright is not installed';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-e2e-'));

/** Console errors from the Room itself (a font CDN that is unreachable offline is not the Room's error). */
function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location()?.url || '';
    if (/fontshare\.com/.test(url)) return;
    errors.push(`${m.text()} ${url}`);
  });
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  return errors;
}

// What each phase changes on the page, so the test waits for that change.
const READY = {
  brief: () => document.querySelectorAll('.seat').length === 7,
  data: () => /Found 39 of 41/.test(document.querySelector('.speech .say')?.textContent || ''),
  'round 1, first cards': () => document.querySelector('.seat.live')?.dataset.seat === 'munger',
  'round 1': () => document.querySelector('.seat.live')?.dataset.seat === 'burry',
  cruxes: () => Boolean(document.querySelector('.crux .sides')),
  lean: null, // lean.json lands during Round 1, but the lean stays sealed until Round 2
  'round 2, first cards': () => /answering Stan Druckenmiller/.test(document.querySelector('.speech .ctx')?.textContent || '') && document.querySelector('.seat.live')?.dataset.seat === 'burry',
  'round 2': () => document.querySelector('.seat.live')?.dataset.seat === 'taleb',
  'round 3, first cards': () => document.querySelector('.seat.live')?.dataset.seat === 'munger',
  'round 3': () => /counting the votes/.test(document.querySelector('.speech .ctx')?.textContent || ''),
};

const pngSize = (buf) => ({ sig: buf.subarray(0, 8).toString('hex'), width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

test('the live view follows the session files from the brief to the verdict', { skip, timeout: 90_000 }, async () => {
  const dir = tmp();
  const r = await startServer({ session: dir, port: 0, quiet: true, journal: tmp(), pollMs: 80 });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchErrors(page);
    await page.goto(r.url);
    await page.locator('.waiting h1').waitFor();
    assert.equal(await page.locator('.waiting h1').textContent(), 'The table is set');

    const nowStep = () => page.locator('.hdr .steps i').evaluateAll((els) => els.findIndex((e) => e.classList.contains('now')));
    for (const ph of phases(NVDA)) {
      ph.apply(dir);
      if (ph.step === 6) {
        await page.locator('.v-verdict h1').waitFor({ timeout: 5000 });
        assert.equal(await page.locator('.v-verdict h1').textContent(), 'Proceed with conditions', 'the verdict view opens by itself');
        break;
      }
      const ready = READY[ph.name];
      if (ready) await page.waitForFunction(ready, null, { timeout: 5000 });
      await page.waitForFunction((s) => {
        const i = [...document.querySelectorAll('.hdr .steps i')].findIndex((e) => e.classList.contains('now'));
        return i === s;
      }, ph.step, { timeout: 5000 });
      assert.equal(await nowStep(), ph.step, ph.name);

      if (ph.name === 'brief') {
        assert.equal(await page.locator('.speech .name').textContent(), 'The Chair');
        assert.equal(await page.locator('.seat').count(), 7, 'the table assembles with every seat');
        assert.equal(await page.locator('.heat .cell.empty').count(), 28, 'no scores yet');
      }
      if (ph.name === 'data') assert.match(await page.locator('.speech .say').textContent(), /Found 39 of 41 facts/);
      if (ph.name === 'round 1, first cards') {
        assert.equal(await page.locator('.seat.live').getAttribute('data-seat'), 'munger');
        assert.equal(await page.locator('.v-live.talking').count(), 1, 'the speaker gets the talking frame');
        assert.equal(await page.locator('.lean-card.sealed').count(), 1, 'the lean stays sealed in round 1');
        assert.equal(await page.locator('.heat .cell:not(.empty)').count(), 8);
      }
      if (ph.name === 'lean') {
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.lean-card.sealed').count(), 1, 'still sealed while Round 1 is on screen');
      }
      if (ph.name === 'round 2, first cards') assert.equal(await page.locator('.lean-card:not(.sealed) .kicker').textContent(), 'Your lean, revealed this round');
      if (ph.name === 'cruxes') assert.match(await page.locator('.crux .q').textContent(), /here to stay/);
      if (ph.name === 'round 2, first cards') {
        assert.equal(await page.locator('.seat.live').getAttribute('data-seat'), 'burry');
        assert.equal(await page.locator('.speech .ctx').textContent(), 'answering Stan Druckenmiller');
        assert.equal(await page.locator('.speech .move').textContent(), 'Raised start small from 3 to 4');
        assert.equal(await page.locator('.speech .fact').count(), 2);
        assert.match(await page.locator('.prog-text .nx').textContent(), /Four still to speak/);
        assert.equal(await page.locator('.turn').count(), 2);
      }
      if (ph.name === 'scores and citations') assert.equal(await page.locator('.speech .name').textContent(), 'The Chair');
      const problems = (await page.evaluate(loadAllImages), await page.evaluate(layoutProblems));
      assert.deepEqual(problems, [], `${ph.name}: ${problems.join('; ')}`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await r.close();
  }
});

test('every control on the verdict works', { skip, timeout: 90_000 }, async () => {
  const journal = tmp();
  const r = await startServer({ session: NVDA, port: 0, quiet: true, journal, pollMs: 100 });
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: r.url });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      window.__printed = 0;
      window.print = () => {
        window.__printed += 1;
      };
    });
    await page.goto(r.url);
    await page.locator('.v-verdict h1').waitFor();

    // Every number on screen comes from the seat arrays.
    assert.deepEqual(await page.locator('.score tfoot td.n').allTextContents(), ['3.6', '6.3', '6.1', '3.8']);
    // The cards name each final-round stance, coloured by the score-derived agreement, which the scorecard spells out.
    assert.deepEqual(await page.locator('.votes .agree').allTextContents(), ['With a condition', 'With a condition', 'Backs the plan', 'With a condition', 'Backs the plan', 'Backs the plan', 'Against the plan']);
    assert.deepEqual(await page.locator('.votes .agree').evaluateAll((els) => els.map((e) => e.classList[1])), ['partly', 'partly', 'agrees', 'partly', 'agrees', 'agrees', 'disagrees']);
    assert.deepEqual(await page.locator('.score .st .agree').allTextContents(), ['Partly agrees', 'Partly agrees', 'Agrees', 'Partly agrees', 'Agrees', 'Agrees', 'Disagrees']);
    assert.equal(await page.locator('.ticks i.on').count(), 39);
    assert.equal(await page.locator('.ticks i').count(), 41);
    assert.equal(await page.locator('.dotplot .dot').count(), 7);

    // Sources.
    await page.locator('.sources [data-act="sources"]').click();
    await page.locator('#drawer.open').waitFor();
    assert.match(await page.locator('#drawer').textContent(), /Facts the council used/);
    assert.equal(await page.locator('#drawer .frow.miss').count(), 2);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#drawer').classList.contains('open'));

    // Save to journal.
    await page.locator('.actions [data-act="save"]').click();
    await page.locator('.actions [data-act="save"][aria-pressed="true"]').waitFor();
    const doc = JSON.parse(fs.readFileSync(path.join(journal, 'NVDA.json'), 'utf8'));
    assert.equal(doc.schema, 'mosaic.journal/1');
    assert.equal(doc.entries[0].recommended, 'B');
    assert.match(await page.locator('#toast').textContent(), /Saved to your journal/);
    assert.equal(await page.locator('.checkin .saved').count(), 1);

    // Share: a PNG of the share card and a short summary on the clipboard.
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.actions [data-act="share"]').click()]);
    assert.equal(dl.suggestedFilename(), 'mosaic-2026-11-17-nvda-buy.png');
    const png = fs.readFileSync(await dl.path());
    assert.deepEqual(pngSize(png), { sig: '89504e470d0a1a0a', width: 2400, height: 1260 });
    assert.ok(png.length > 50_000, 'the card has the portraits drawn in');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(clip, /^Mosaic council on “Buy NVIDIA at \$182 for a three-year hold\?”/);
    assert.match(clip, /Not investment advice/);
    assert.ok(!/[—–]/.test(clip));

    // Copy image (copies, or saves the card when the browser will not copy images).
    // Clear the toast first, so the wait sees this action's message and not Share's.
    const clearToast = () => page.evaluate(() => (document.querySelector('#toast').textContent = ''));
    await clearToast();
    await page.locator('[data-act="copy-image"]').click();
    await page.waitForFunction(() => /Share card copied as an image|card was saved instead/.test(document.querySelector('#toast').textContent));

    // The recheck command copies.
    await clearToast();
    await page.locator('[data-act="cmd"]').click();
    await page.waitForFunction(() => /Command copied/.test(document.querySelector('#toast').textContent));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '/mosaic recheck NVDA');

    // Download PDF: the print stylesheet, then window.print().
    await page.locator('[data-act="pdf"]').click();
    assert.equal(await page.evaluate(() => window.__printed), 1);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await page.locator('.actions').isVisible(), false, 'buttons are left out of the PDF');
    assert.equal(await page.locator('.share-sec').isVisible(), false);
    for (const format of ['A4', 'Letter']) {
      const pdf = await page.pdf({ format, printBackground: true });
      const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      assert.ok(pages >= 1 && pages <= 4, `${format}: ${pages} pages`);
    }
    const widthOk = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    assert.ok(widthOk, 'nothing is cut off on the printed page');
    await page.emulateMedia({ media: 'screen' });

    // The live view, the replay and the journal list.
    await page.locator('.hero a[href="#/live"]').click();
    await page.locator('.v-live').waitFor();
    assert.equal(await page.locator('.status').textContent(), 'Finished');
    await page.locator('[data-act="replay"]').click();
    assert.equal(await page.locator('.status').textContent(), 'Replay');
    assert.equal(await page.locator('.speech .name').textContent(), 'The Chair');
    await page.locator('[data-act="replay"]').click();
    assert.equal(await page.locator('.status').textContent(), 'Finished');
    await page.goto(`${r.url}/#/journal`);
    await page.locator('.jrow').first().waitFor();
    assert.match(await page.locator('.jrow').first().textContent(), /NVDA, Nvidia corp/);
    assert.match(await page.locator('.jrow').first().textContent(), /21 November 2026/);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await r.close();
  }
});

test('phone: the scorecard scrolls sideways with its first column pinned, and nothing else scrolls', { skip, timeout: 60_000 }, async () => {
  const r = await startServer({ session: NVDA, port: 0, quiet: true, journal: tmp() });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = watchErrors(page);
    await page.goto(`${r.url}/#/verdict`);
    await page.locator('.v-verdict h1').waitFor();
    const scroller = page.locator('.scroller');
    await scroller.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => {
      const s = document.querySelector('.scroller');
      return { pin: s.querySelector('tbody th').getBoundingClientRect().left, cell: s.querySelector('tbody td').getBoundingClientRect().left, max: s.scrollWidth - s.clientWidth };
    });
    assert.ok(before.max > 50, 'the table is wider than the phone');
    await scroller.evaluate((s) => (s.scrollLeft = 200));
    const after = await page.evaluate(() => {
      const s = document.querySelector('.scroller');
      return { pin: s.querySelector('tbody th').getBoundingClientRect().left, cell: s.querySelector('tbody td').getBoundingClientRect().left };
    });
    assert.equal(Math.round(after.pin), Math.round(before.pin), 'the investor column stays put');
    assert.ok(after.cell < before.cell - 100, 'the scores move under it');
    assert.deepEqual((await page.evaluate(loadAllImages), await page.evaluate(layoutProblems)), []);

    await page.goto(`${r.url}/#/live`);
    await page.locator('.v-live .speech').waitFor();
    const order = await page.evaluate(() => ['.qmob', '.speech', '.seatrow'].map((s) => document.querySelector(s).getBoundingClientRect().top));
    assert.ok(order[0] < order[1] && order[1] < order[2], 'question, then the speaker, then the seat strip');
    assert.equal(await page.locator('.seatrow').evaluate((el) => getComputedStyle(el).overflowX), 'auto');
    assert.deepEqual((await page.evaluate(loadAllImages), await page.evaluate(layoutProblems)), []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await r.close();
  }
});

test('reduced motion turns the animations off', { skip, timeout: 30_000 }, async () => {
  const dir = tmp();
  stageTo(NVDA, dir, 'round 2, first cards');
  const r = await startServer({ session: dir, port: 0, quiet: true, journal: tmp() });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(r.url);
    await page.locator('.seat.live').waitFor();
    const d = await page.locator('.seat.live .ring').evaluate((el) => getComputedStyle(el).animationDuration);
    assert.ok(parseFloat(d) < 0.01, d);
    assert.equal(await page.locator('.speech.enter').count(), 0);
  } finally {
    await browser.close();
    await r.close();
  }
});

for (const ex of ['2026-11-12-cost-sell', '2026-11-15-msft-size']) {
  test(`${ex} runs with no live council, at desktop and phone width`, { skip, timeout: 60_000 }, async () => {
    const r = await startServer({ session: path.join(EX, ex), port: 0, quiet: true, journal: tmp() });
    const browser = await chromium.launch();
    try {
      for (const width of [1440, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = watchErrors(page);
        for (const view of ['verdict', 'live']) {
          await page.goto(`${r.url}/#/${view}`);
          await page.locator(`.v-${view}`).waitFor();
          assert.deepEqual((await page.evaluate(loadAllImages), await page.evaluate(layoutProblems)), [], `${view} at ${width}`);
        }
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
      await r.close();
    }
  });
}

test('an empty home shows the example verdict, lists three examples, and opens one', { skip, timeout: 60_000 }, async () => {
  const r = await startServer({ sessions: tmp(), port: 0, quiet: true, journal: tmp() });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchErrors(page);
    await page.goto(r.url);
    await page.locator('.v-verdict h1').waitFor({ timeout: 8000 });
    assert.match(await page.locator('.crumb').textContent(), /^\s*Examples/);
    assert.equal(await page.locator('[data-act=save]').count(), 0, 'an example cannot be saved');
    await page.goto(`${r.url}/#/journal`);
    await page.locator('a.jrow').first().waitFor({ timeout: 5000 });
    assert.equal(await page.locator('a.jrow').count(), 3);
    await page.locator('a.jrow').first().click();
    await page.waitForFunction(() => /^#\/example\//.test(location.hash), null, { timeout: 5000 });
    await page.locator('.v-verdict h1').waitFor({ timeout: 5000 });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await r.close();
  }
});
