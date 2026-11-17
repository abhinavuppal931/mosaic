// The packs built live against the free sources (tests/core/fixtures/live/NOTE.md) must keep
// the pack contract. Reads committed files only; no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES } from './helpers/fake-fetch.mjs';
import { hashFacts } from '../../data/lib/facts.mjs';

const LIVE = path.join(FIXTURES, 'live');
const STATUSES = ['ok', 'fallback', 'stale', 'missing', 'error'];

for (const name of ['msft', 'macro']) {
  const raw = fs.readFileSync(path.join(LIVE, name, 'data-pack.json'), 'utf8');
  const pack = JSON.parse(raw);

  test(`live ${name} pack: every fact has id, key, source, asOf and status`, () => {
    assert.equal(pack.schema, 'mosaic.datapack/1');
    assert.equal(pack.hash, hashFacts(pack.facts), 'hash matches the facts');
    for (const f of pack.facts) {
      assert.match(f.id, /^F\d{3}$/);
      assert.ok(f.key && f.label, f.id);
      assert.ok('source' in f && 'asOf' in f, f.id);
      assert.ok(STATUSES.includes(f.status), `${f.id} ${f.status}`);
      if (f.value === null) {
        assert.ok(['missing', 'error'].includes(f.status), `${f.id} null but ${f.status}`);
        assert.ok(f.note, `${f.id} is missing without a reason`);
      } else {
        assert.ok(f.source, `${f.id} has a value but no source`);
        if (f.unit !== 'text') assert.ok(f.asOf, `${f.id} has a value but no as-of date`);
      }
      if (f.derived) assert.ok(f.formula, `${f.id} derived without a formula`);
    }
  });

  test(`live ${name} pack: gaps are visible and nothing secret is stored`, () => {
    assert.ok(pack.coverage.missingFacts > 0);
    assert.ok(pack.warnings.length > 0);
    assert.ok(!/api_?key=(?!REDACTED)|apikey=(?!REDACTED)|token=(?!REDACTED)|@example\.com|user-agent/i.test(raw));
    assert.ok(fs.readFileSync(path.join(LIVE, name, 'data-pack.md'), 'utf8').includes('## Data health'));
  });
}

test('live MSFT pack: fundamentals from EDGAR, prices from Yahoo, labelled', () => {
  const pack = JSON.parse(fs.readFileSync(path.join(LIVE, 'msft', 'data-pack.json'), 'utf8'));
  const f = (k) => pack.facts.find((x) => x.key === k);
  assert.equal(f('revenue').source, 'sec-edgar');
  assert.equal(f('price').source, 'yahoo');
  assert.equal(f('macro_hy_oas').status, 'missing');
  assert.match(f('macro_hy_oas').note, /FRED_API_KEY/);
  assert.equal(pack.coverage.byCapability.financials, 'ok');
});
