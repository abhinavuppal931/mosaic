// Parity with core: run core's own scoring (scripts/lib/scoring.mjs) on every example and on the
// 13-seat smoke session, and check the Room shows the same numbers and the same agreement.
// Skipped when the Room runs without core next to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSession } from '../../lib/session.js';
import { seatResolver } from '../../lib/seats.js';
import { buildModel } from '../../lib/model.js';
import { loadScoringConfig } from '../../server.js';

const ROOM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = path.resolve(ROOM, '..');
const lib = (f) => path.join(ROOT, 'scripts', 'lib', f);
const hasCore = ['scoring.mjs', 'session.mjs', 'roster.mjs'].every((f) => fs.existsSync(lib(f)));
const skip = hasCore ? false : 'core (scripts/lib) is not next to the Room';
const SMOKE = path.join(ROOT, 'tests', 'seats', 'smoke', 'session-msft');

const sessions = [
  ...fs.readdirSync(path.join(ROOM, 'examples')).map((d) => path.join(ROOM, 'examples', d)),
  ...(fs.existsSync(path.join(SMOKE, 'council.json')) ? [SMOKE] : []),
];

for (const dir of sessions) {
  test(`${path.basename(path.dirname(dir))}/${path.basename(dir)}: the Room matches core's score.mjs`, { skip }, async () => {
    const core = await import(pathToFileURL(lib('scoring.mjs')).href);
    const coreSession = await import(pathToFileURL(lib('session.mjs')).href);
    const coreRoster = await import(pathToFileURL(lib('roster.mjs')).href);
    const roster = coreRoster.loadRoster(path.join(ROOT, 'skills', 'mosaic', 'roster.json'));
    const cs = coreSession.readSession(dir, coreRoster.seatResolver(roster));
    const expected = core.scoreCouncil({ council: cs.council, rounds: cs.rounds, lean: cs.lean?.option ?? null, coverage: cs.pack?.coverage?.score ?? cs.council.pack?.coverage ?? null, draft: cs.draft, roster });

    const cfg = loadScoringConfig(path.join(ROOT, 'scripts', 'scoring.config.json'));
    const m = buildModel(readSession(dir, { resolve: seatResolver(roster) }), { roster, cfg });
    assert.deepEqual(m.problems, []);

    // The live view's totals after the last card are the council scores core computes.
    const last = m.live.at(-1);
    const totals = Object.fromEntries(last.totals.map((t) => [t.id, t.v === null ? null : Number(t.v)]));
    assert.deepEqual(totals, Object.fromEntries(expected.options.map((o) => [o.id, o.score])));
    assert.equal(last.totals.find((t) => t.best)?.id, expected.recommended);

    // Abstentions show as such on the table.
    for (const seat of expected.abstentions) assert.equal(last.seats.find((x) => x.key === seat).lean, 'Too hard to call');

    if (m.verdict) {
      assert.equal(m.verdict.rec, expected.recommended);
      for (const row of expected.scorecard) assert.equal(m.verdict.votes.find((v) => v.key === row.seat).agreement, row.agreement, row.seat);
      const counts = m.verdict.counts;
      assert.deepEqual({ agrees: counts.agrees, 'partly agrees': counts['partly agrees'], disagrees: counts.disagrees, abstains: counts.abstains }, expected.agreement);
    }
  });
}
