// The citation checker: fact ids against the pack, quotes against each seat's brain.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIXTURES } from './helpers/fake-fetch.mjs';
import { checkSession, norm } from '../../scripts/lib/citations.mjs';
import { loadRoster, seatResolver } from '../../scripts/lib/roster.mjs';

const roster = loadRoster(path.join(FIXTURES, 'roster.json'));
const resolve = seatResolver(roster);
const BRAINS = path.join(FIXTURES, 'brains');
const SESSION = path.join(FIXTURES, 'session-msft');

function copySession() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-cite-'));
  for (const f of fs.readdirSync(SESSION)) fs.copyFileSync(path.join(SESSION, f), path.join(dir, f));
  return dir;
}
const run = (session, brainsDir = BRAINS) => checkSession({ session, brainsDir, roster, resolve });

describe('clean session', () => {
  test('passes: quotes verified per seat, fact ids exist', () => {
    const r = run(SESSION);
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.stats.quotesVerified, 3);
    assert.equal(r.stats.factIdsUnknown, 0);
    assert.ok(r.stats.factCitations >= 15);
  });

  test('citing a fact the pack marks MISSING is a warning, not a pass for the claim', () => {
    const r = run(SESSION);
    assert.ok(r.warnings.some((w) => w.type === 'missing_fact_cited' && w.id === 'F006'));
  });
});

describe('failures', () => {
  test('the verdict is checked too: verdict.md and every string in verdict.json', () => {
    const r = run(SESSION);
    assert.equal(r.verdictChecked, true);
    assert.ok(r.files.includes('verdict.md') && r.files.includes('verdict.json'));
    const dir = copySession();
    const v = JSON.parse(fs.readFileSync(path.join(dir, 'verdict.json'), 'utf8'));
    v.why.push({ point: 'Debt is tiny [F777].', seat: 'buffett' });
    fs.writeFileSync(path.join(dir, 'verdict.json'), JSON.stringify(v));
    const bad = run(dir);
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.file === 'verdict.json' && e.id === 'F777'));
  });

  test('before the verdict exists the report says it was not checked', () => {
    const dir = copySession();
    fs.rmSync(path.join(dir, 'verdict.md'));
    fs.rmSync(path.join(dir, 'verdict.json'));
    assert.equal(run(dir).verdictChecked, false);
  });

  test('an unknown fact id fails', () => {
    const dir = copySession();
    fs.appendFileSync(path.join(dir, 'round-2.md'), '\n## Taleb\n\nSEAT: Taleb\nWHY:\n1. Leverage is 9x [F404].\n');
    const r = run(dir);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.type === 'unknown_fact' && e.id === 'F404'));
  });

  test('an invented quote fails, even when it is in another seat\'s brain', () => {
    const dir = copySession();
    const r1 = fs.readFileSync(path.join(dir, 'round-1.md'), 'utf8')
      // Burry now quotes Taleb's brain line: not his own brain, so unverified.
      .replace('"Fixture line three: the crowd is paying for growth the cash flows have not shown." (S003)', '"Fixture line two: never cross a river that is on average four feet deep." (S007)');
    fs.writeFileSync(path.join(dir, 'round-1.md'), r1);
    fs.appendFileSync(path.join(dir, 'verdict.md'), '\nAs he said, "an entirely invented line that no brain contains anywhere" (S099).\n');
    const r = run(dir);
    assert.equal(r.ok, false);
    const bad = r.errors.filter((e) => e.type === 'unverified_quote');
    assert.equal(bad.length, 2);
    assert.ok(bad.some((e) => e.seat === 'burry'));
    assert.ok(bad.some((e) => e.file === 'verdict.md'));
  });

  test('quoting the brief or an earlier round is allowed', () => {
    const dir = copySession();
    fs.appendFileSync(path.join(dir, 'round-3.md'), '\n## Burry\n\nSEAT: Burry\nAMENDMENT OR DISSENT: as I said, "Fixture line three: the crowd is paying for growth the cash flows have not shown." (S003)\n');
    const r = run(dir);
    assert.equal(r.ok, true);
  });

  test('without brains (not built yet) attributed quotes are unverified, and say why', () => {
    const r = run(SESSION, path.join(FIXTURES, 'no-brains-here'));
    assert.equal(r.ok, false);
    assert.ok(r.errors.every((e) => e.type !== 'unverified_quote' || /brain not available/.test(e.detail)));
  });

  test('no data pack: every fact id is unverifiable', () => {
    const dir = copySession();
    fs.rmSync(path.join(dir, 'data-pack.json'));
    const r = run(dir);
    assert.equal(r.ok, false);
    assert.equal(r.errors[0].type, 'no_pack');
  });

  test('a verified quote whose source id the brain does not list is flagged', () => {
    const dir = copySession();
    const r1 = fs.readFileSync(path.join(dir, 'round-1.md'), 'utf8').replace('price." (S001)', 'price." (S777)');
    fs.writeFileSync(path.join(dir, 'round-1.md'), r1);
    const r = run(dir);
    assert.ok(r.warnings.some((w) => w.type === 'source_id_unknown' && w.id === 'S777'));
  });

  test('numbers in a WHY point without a fact id are flagged softly', () => {
    const dir = copySession();
    fs.appendFileSync(path.join(dir, 'round-1.md'), '\n## Marks\n\nSEAT: Marks\nSTANCE: Yes\nOPTION SCORES: A 5/10\nWHY:\n1. Spreads are 3.2% and tight.\n2. Rates near 5% [F001] matter.\n');
    const r = run(dir);
    assert.equal(r.ok, true);
    assert.equal(r.warnings.filter((w) => w.type === 'uncited_number').length, 1);
  });
});

test('normalization ignores case, curly quotes and punctuation', () => {
  assert.equal(norm('“It’s  Fine,” he said!'), "it's fine he said");
});
