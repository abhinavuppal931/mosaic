// End to end: the investor spotlight (B6) on the verdict. Drives every control at desktop and
// phone width: each card, Previous and Next, the arrow keys, Esc, Close, a hash per investor
// (loaded directly, and with Back), the sticky controls, the scroll to the panel's top on a
// switch, focus, and no sideways overflow from 320 to 1920. Needs Playwright with Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../server.js';
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
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-spot-'));
const SEATS = ['buffett', 'munger', 'damodaran', 'marks', 'taleb', 'druckenmiller', 'burry'];
const NAMES = ['Warren Buffett', 'Charlie Munger', 'Aswath Damodaran', 'Howard Marks', 'Nassim Taleb', 'Stan Druckenmiller', 'Michael Burry'];

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error' || /fontshare\.com/.test(m.location()?.url || '')) return;
    errors.push(`${m.text()} ${m.location()?.url || ''}`);
  });
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  return errors;
}

const openKey = (page) => page.evaluate(() => document.querySelector('#spotlight')?.dataset.key || null);
const waitKey = (page, key) => page.waitForFunction((k) => (document.querySelector('#spotlight')?.dataset.key || null) === k, key, { timeout: 5000 });
const hash = (page) => page.evaluate(() => location.hash);
const focusId = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.dataset?.key || document.activeElement?.tagName);
/** The panel's top edge, relative to the viewport. */
const panelTop = (page) => page.evaluate(() => document.querySelector('#spotlight').getBoundingClientRect().top);
const settle = (page) => page.waitForFunction(() => new Promise((ok) => {
  let last = scrollY, n = 0;
  const tick = () => (scrollY === last ? (++n > 4 ? ok(true) : requestAnimationFrame(tick)) : ((last = scrollY), (n = 0), requestAnimationFrame(tick)));
  tick();
}), null, { timeout: 5000 });

for (const [label, viewport, extra] of [['desktop', { width: 1440, height: 900 }, {}], ['phone', { width: 390, height: 844 }, { isMobile: true, hasTouch: true }]]) {
  test(`${label}: every spotlight control works`, { skip, timeout: 120_000 }, async () => {
    const r = await startServer({ session: NVDA, port: 0, quiet: true, journal: tmp() });
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport, ...extra, reducedMotion: 'reduce' });
      const errors = watchErrors(page);
      await page.goto(`${r.url}/#/verdict`);
      await page.locator('.v-verdict h1').waitFor();
      assert.equal(await openKey(page), null, 'closed by default');
      assert.equal(await page.locator('.sp-cards .vote').count(), 7);
      assert.equal(await page.locator('.sp-cards .vote[aria-expanded="true"]').count(), 0);

      // Open each of the seven investors from its card.
      for (const [i, key] of SEATS.entries()) {
        await page.locator(`.sp-cards .vote[data-key="${key}"]`).click();
        await waitKey(page, key);
        assert.equal(await hash(page), `#/verdict/${key}`);
        assert.equal(await page.locator('#spotlight .sp-name .full').textContent(), NAMES[i]);
        assert.match(await page.locator('#spotlight .psub').textContent(), new RegExp(`${i + 1} of 7`));
        assert.equal(await page.locator(`.sp-cards .vote[data-key="${key}"]`).getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('.sp-cards .vote[aria-expanded="true"]').count(), 1);
        assert.equal(await page.locator(`.sp-cards .vote[data-key="${key}"] .more`).textContent(), 'Showing below');
        assert.equal(await page.locator('.sp-cards.dim').count(), 1, 'the other cards dim');
        assert.equal(await focusId(page), 'spot-name', 'opening moves focus to the panel heading');
        assert.equal(await page.locator('#spotlight .irow').count(), 4, 'four summary dot rows');
        assert.equal(await page.locator('#spotlight .irow .dtick').count(), 4, 'a council tick on each');
        assert.equal(await page.locator('#spotlight .irow .ddot').count(), 4);
        assert.equal(await page.locator('#spotlight .irow .dring').count(), await page.locator('#spotlight .irow .dlink').count(), 'a ring is joined by a line');
        assert.equal(await page.locator('#spotlight .rstep').count(), 3);
        assert.equal(await page.locator('#spotlight .rstep .mrow').count(), 12, 'mini dot rows at the top of each round');
        assert.equal(await page.locator('#spotlight .rstep.final .mrow .dtick').count(), 4, 'the council on the final round');
        assert.equal(await page.locator('#spotlight .dscale').textContent(), '0  Rules it outStrong yes  10');
        const problems = (await page.evaluate(loadAllImages), await page.evaluate(layoutProblems));
        assert.deepEqual(problems, [], `${key}: ${problems.join('; ')}`);
      }
      // Burry is open. The open card again closes it, and focus stays on the card.
      await page.locator('.sp-cards .vote[data-key="burry"]').click();
      await waitKey(page, null);
      assert.equal(await hash(page), '#/verdict');
      assert.equal(await focusId(page), 'burry');

      // Previous and Next, wrapping at both ends.
      await page.locator('.sp-cards .vote[data-key="buffett"]').click();
      await waitKey(page, 'buffett');
      await page.locator('#spotlight [data-act="seat-prev"]').click();
      await waitKey(page, 'burry');
      await page.locator('#spotlight [data-act="seat-next"]').click();
      await waitKey(page, 'buffett');
      await page.locator('#spotlight [data-act="seat-next"]').click();
      await waitKey(page, 'munger');
      assert.equal(await focusId(page), 'spot-name');

      // The arrow keys.
      await page.keyboard.press('ArrowRight');
      await waitKey(page, 'damodaran');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await waitKey(page, 'buffett');
      assert.equal(await hash(page), '#/verdict/buffett');

      // The sticky controls: scroll to the bottom of the panel and they are still on screen.
      await page.evaluate(() => {
        const p = document.querySelector('#spotlight');
        window.scrollTo(0, scrollY + p.getBoundingClientRect().bottom - innerHeight + 10);
      });
      await settle(page);
      assert.ok((await panelTop(page)) < -300, 'the panel top is well above the screen');
      const ctl = await page.locator('#spotlight [data-act="seat-next"]').evaluate((el) => el.getBoundingClientRect().toJSON());
      assert.ok(ctl.top >= 0 && ctl.bottom <= viewport.height, `Next stays in view (${ctl.top})`);
      assert.ok(await page.locator('#spotlight [data-act="seat-close"]').isVisible());
      await page.waitForFunction(() => document.querySelector('#spotlight').classList.contains('stuck'));
      if (label === 'phone') assert.equal(await page.locator('#spotlight .sp-name .short').textContent(), 'Buffett', 'the sticky header shows the short name');
      if (label === 'phone') assert.equal(await page.locator('#spotlight .sp-name .full').isVisible(), false);

      // Switching from deep in the panel scrolls its top into view.
      await page.locator('#spotlight [data-act="seat-next"]').click();
      await waitKey(page, 'munger');
      await settle(page);
      const top = await panelTop(page);
      assert.ok(top >= 0 && top < 60, `the new panel starts at the top of the screen (${top})`);
      await page.waitForFunction(() => !document.querySelector('#spotlight').classList.contains('stuck'));

      // Esc closes and returns focus to the card.
      await page.keyboard.press('Escape');
      await waitKey(page, null);
      assert.equal(await focusId(page), 'munger', 'closing returns focus to the card');
      assert.equal(await page.locator('.sp-cards.dim').count(), 0);

      // Close.
      await page.locator('.sp-cards .vote[data-key="taleb"]').click();
      await waitKey(page, 'taleb');
      await page.locator('#spotlight [data-act="seat-close"]').click();
      await waitKey(page, null);
      assert.equal(await focusId(page), 'taleb');

      // Back steps through the investors and then closes the panel; Forward reopens.
      await page.locator('.sp-cards .vote[data-key="marks"]').click();
      await waitKey(page, 'marks');
      await page.locator('#spotlight [data-act="seat-next"]').click();
      await waitKey(page, 'taleb');
      await page.goBack();
      await waitKey(page, 'marks');
      await page.goBack();
      await waitKey(page, null);
      await page.goForward();
      await waitKey(page, 'marks');

      // The facts link opens the sources.
      await page.locator('#spotlight .flink').click();
      await page.locator('#drawer.open').waitFor();
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#drawer').classList.contains('open'));
      assert.equal(await openKey(page), 'marks', 'Esc closes the sources first, not the panel');

      // Arrows do not switch investors while the scores table has focus (it scrolls sideways).
      await page.locator('.scroller').focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      assert.equal(await openKey(page), 'marks');
      assert.deepEqual(errors, []);

      // A hash loads the panel on that investor, and Back closes it.
      const deep = await browser.newPage({ viewport, ...extra, reducedMotion: 'reduce' });
      const deepErrors = watchErrors(deep);
      await deep.goto(`${r.url}/#/verdict/burry`);
      await waitKey(deep, 'burry');
      await settle(deep);
      const dt = await panelTop(deep);
      assert.ok(dt >= 0 && dt < 60, `a hash load scrolls to the panel (${dt})`);
      assert.equal(await focusId(deep), 'spot-name');
      assert.equal(await deep.locator('#spotlight .agree').textContent(), 'Against the plan');
      await deep.goBack();
      await waitKey(deep, null);
      assert.equal(await hash(deep), '#/verdict');
      // An unknown investor in the hash leaves the panel closed.
      await deep.goto(`${r.url}/#/verdict/nobody`);
      await deep.locator('.v-verdict h1').waitFor();
      await deep.waitForTimeout(200);
      assert.equal(await openKey(deep), null);
      assert.deepEqual(deepErrors, []);
    } finally {
      await browser.close();
      await r.close();
    }
  });
}

test('the example routes carry the investor too, and the quick and ten-seat councils open cleanly', { skip, timeout: 90_000 }, async () => {
  const r = await startServer({ sessions: tmp(), port: 0, quiet: true, journal: tmp() });
  const browser = await chromium.launch();
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = watchErrors(page);
      for (const [ex, key, steps] of [['2026-11-12-cost-sell', 'taleb', 2], ['2026-11-15-msft-size', 'lynch', 3], ['2026-11-15-msft-size', 'mauboussin', 3]]) {
        await page.goto(`${r.url}/#/example/${ex}/${key}`);
        await waitKey(page, key);
        assert.equal(await page.locator('#spotlight .rstep').count(), steps, `${ex} ${key}`);
        await page.locator('#spotlight [data-act="seat-next"]').click();
        await page.waitForFunction((k) => document.querySelector('#spotlight')?.dataset.key !== k, key);
        assert.match(await hash(page), new RegExp(`^#/example/${ex}/`));
        const problems = (await page.evaluate(loadAllImages), await page.evaluate(layoutProblems));
        assert.deepEqual(problems, [], `${ex} at ${width}: ${problems.join('; ')}`);
      }
      assert.equal(await page.locator('#spotlight .irow').count() >= 0, true);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
    await r.close();
  }
});

test('no sideways overflow from 320 to 1920, open and closed', { skip, timeout: 120_000 }, async () => {
  const r = await startServer({ session: NVDA, port: 0, quiet: true, journal: tmp() });
  const browser = await chromium.launch();
  try {
    for (const width of [320, 360, 390, 600, 759, 760, 1024, 1180, 1280, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      for (const key of [null, 'buffett', 'druckenmiller', 'burry']) {
        await page.goto(`${r.url}/#/verdict${key ? `/${key}` : ''}`);
        await page.locator('.v-verdict h1').waitFor();
        if (key) await waitKey(page, key);
        const problems = (await page.evaluate(loadAllImages), await page.evaluate(layoutProblems));
        assert.deepEqual(problems, [], `${width} ${key || 'closed'}: ${problems.join('; ')}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    await r.close();
  }
});
