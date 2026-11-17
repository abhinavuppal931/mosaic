// Votes and scores: every number the Room shows is derived from the seats' option scores.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from '../../lib/session.js';
import { seatResolver } from '../../lib/seats.js';
import { agreementOf, councilScores, pickRecommended, runnerUp, seatTop, stateAt, seatPositions, CHAIRS, heatLevel, buildModel, optShort } from '../../lib/model.js';

const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples');
const examples = fs.readdirSync(EX).filter((d) => fs.existsSync(path.join(EX, d, 'council.json')));
const load = (name) => readSession(path.join(EX, name), { resolve: seatResolver() });
const OPTS = ['A', 'B', 'C', 'D'].map((id) => ({ id, label: id }));

test('agreement: agrees when the seat\'s top option is the recommended one', () => {
  assert.equal(agreementOf({ A: 4, B: 8, C: 6, D: 2 }, OPTS, 'B'), 'agrees');
});

test('agreement: a tie at the top that includes the recommended option agrees', () => {
  assert.equal(agreementOf({ A: 8, B: 8, C: 4, D: 2 }, OPTS, 'B'), 'agrees');
  assert.equal(seatTop({ A: 8, B: 8 }, OPTS, 'B'), 'B');
  assert.equal(seatTop({ A: 8, B: 8 }, OPTS), 'A');
});

test('agreement: disagrees when the recommended option scores 4 or below', () => {
  assert.equal(agreementOf({ A: 2, B: 4, C: 7, D: 6 }, OPTS, 'B'), 'disagrees');
  assert.equal(agreementOf({ A: 2, B: 0, C: 7, D: 6 }, OPTS, 'B'), 'disagrees');
});

test('agreement: partly agrees when another option is preferred and the recommended one scores 5 or more', () => {
  assert.equal(agreementOf({ A: 4, B: 5, C: 7, D: 3 }, OPTS, 'B'), 'partly');
  assert.equal(agreementOf({ A: 4, B: 6, C: 7, D: 3 }, OPTS, 'B'), 'partly');
});

test('agreement: the top-choice rule wins even when that score is 4 or below', () => {
  assert.equal(agreementOf({ A: 2, B: 4, C: 3, D: 1 }, OPTS, 'B'), 'agrees');
});

test('agreement: no scores or no recommendation gives no vote', () => {
  assert.equal(agreementOf({}, OPTS, 'B'), null);
  assert.equal(agreementOf({ A: 3 }, OPTS, 'B'), null);
  assert.equal(agreementOf({ B: 7 }, OPTS, null), null);
});

test('council score is the weighted mean, rounded to one decimal like core', () => {
  const state = { a: { scores: { A: 4, B: 7 } }, b: { scores: { A: 7, B: 4 } }, c: { scores: { A: 1, B: 9 }, abstain: false } };
  const s = councilScores(OPTS.slice(0, 2), state, { a: { weight: 3 }, b: { weight: 2 }, c: { weight: 1 } });
  assert.deepEqual(s.map((x) => x.score), [r1((3 * 4 + 2 * 7 + 1 * 1) / 6), r1((3 * 7 + 2 * 4 + 1 * 9) / 6)]);
  assert.deepEqual(s.map((x) => x.spread), [6, 5]);
});
const r1 = (v) => Math.round(v * 10) / 10;

test('council score skips abstentions and missing scores; no scores gives null', () => {
  const s = councilScores(OPTS.slice(0, 2), { a: { scores: {}, abstain: true }, b: { scores: { A: 6 } } }, {});
  assert.equal(s[0].score, 6);
  assert.equal(s[1].score, null);
  assert.equal(pickRecommended(councilScores(OPTS, {}, {})), null);
});

test('recommended option: highest score, then smaller spread, then earlier option', () => {
  assert.equal(pickRecommended([{ id: 'A', score: 6, spread: 4 }, { id: 'B', score: 6, spread: 2 }]), 'B');
  assert.equal(pickRecommended([{ id: 'A', score: 6, spread: 2 }, { id: 'B', score: 6, spread: 2 }]), 'A');
  assert.equal(runnerUp([{ id: 'A', score: 6.3 }, { id: 'B', score: 6.1 }, { id: 'C', score: 3 }], 'A'), 'B');
});

test('NVIDIA example reproduces the approved board: 3.6, 6.3, 6.1, 3.8 and three agree, three partly, one disagrees', () => {
  const m = buildModel(load('2026-11-17-nvda-buy'));
  assert.deepEqual(m.verdict.optionScores, { A: 3.6, B: 6.3, C: 6.1, D: 3.8 });
  assert.equal(m.verdict.rec, 'B');
  assert.equal(m.verdict.run, 'C');
  assert.deepEqual(m.verdict.counts, { agrees: 3, partly: 3, disagrees: 1 });
  const votes = Object.fromEntries(m.verdict.votes.map((v) => [v.key, v.vote]));
  assert.deepEqual(votes, { buffett: 'Partly agrees', munger: 'Partly agrees', damodaran: 'Agrees', marks: 'Partly agrees', taleb: 'Agrees', druckenmiller: 'Agrees', burry: 'Disagrees' });
  assert.equal(m.verdict.stats.united.word, 'Split');
  assert.equal(m.verdict.stats.united.lo, 4);
  assert.equal(m.verdict.stats.united.hi, 8);
  assert.equal(m.verdict.stats.bias.before, '3.3');
  assert.equal(m.verdict.stats.bias.after, '3.6');
  assert.equal(m.verdict.stats.evidence.found, 39);
  assert.equal(m.verdict.stats.evidence.total, 41);
  assert.deepEqual(m.problems, []);
});

for (const ex of examples) {
  test(`${ex}: the Room's option scores and recommendation match core's scores.json`, () => {
    const s = load(ex);
    const m = buildModel(s);
    assert.ok(s.scores, 'example has a scores.json written by core');
    for (const o of s.scores.options) assert.equal(m.verdict.optionScores[o.id], o.score, `option ${o.id}`);
    assert.equal(m.verdict.rec, s.scores.recommended);
    assert.deepEqual(m.problems, []);
  });

  test(`${ex}: the live beats only ever move forward through the steps`, () => {
    const m = buildModel(load(ex));
    const steps = m.live.map((b) => b.step);
    assert.deepEqual(steps, [...steps].sort((a, b) => a - b));
    assert.equal(m.live[0].mode, 'brief');
    assert.equal(m.phase, 6);
  });
}

test('a matching agreement field in scores.json is accepted silently', () => {
  const s = load('2026-11-17-nvda-buy');
  s.scores = { ...s.scores, agreement: { buffett: 'partly agrees', munger: 'Partly agrees', damodaran: 'agrees', marks: 'partly', taleb: 'Agrees', druckenmiller: 'agrees', burry: 'disagrees' } };
  assert.deepEqual(buildModel(s).problems, []);
});

test('an agreement field that disagrees with the seat scores is logged as a problem, and the Room keeps its own', () => {
  const s = load('2026-11-17-nvda-buy');
  s.scores = { ...s.scores, scorecard: s.scores.scorecard.map((r) => (r.seat === 'burry' ? { ...r, agreement: 'agrees' } : r)) };
  const m = buildModel(s);
  assert.equal(m.problems.length, 1);
  assert.match(m.problems[0].message, /burry/);
  assert.equal(m.verdict.votes.find((v) => v.key === 'burry').vote, 'Disagrees');
});

test('agreement may also arrive as a list of rows', () => {
  const s = load('2026-11-17-nvda-buy');
  s.scores = { ...s.scores, agreement: [{ seat: 'taleb', agreement: 'disagrees' }] };
  assert.match(buildModel(s).problems[0].message, /taleb/);
});

test('the free-text VOTE line never becomes the vote', () => {
  const s = load('2026-11-17-nvda-buy');
  for (const c of s.rounds[3]) c.vote = 'Dissent';
  const m = buildModel(s);
  assert.deepEqual(m.verdict.counts, { agrees: 3, partly: 3, disagrees: 1 });
});

test('a verdict that names a different option than the seat scores is flagged', () => {
  const s = load('2026-11-17-nvda-buy');
  s.verdict = { ...s.verdict, recommended: 'C' };
  const m = buildModel(s);
  assert.ok(m.problems.some((p) => /seat scores put B first/.test(p.message)));
});

test('an abstaining seat (TOO HARD) has no vote and does not count', () => {
  const m = buildModel(load('2026-11-15-msft-size'));
  const lynch = m.verdict.votes.find((v) => v.key === 'lynch');
  assert.equal(lynch.agreement, 'abstain');
  assert.equal(lynch.vote, 'Too hard to call');
  assert.equal(m.verdict.counts.agrees + m.verdict.counts.partly + m.verdict.counts.disagrees, 8);
});

test('state carries forward: a seat that has not spoken this round keeps its last scores', () => {
  const s = load('2026-11-17-nvda-buy');
  const st = stateAt(s.rounds, 2, 0); // only Druckenmiller has spoken in round 2
  assert.equal(st.druckenmiller.round, 2);
  assert.equal(st.buffett.round, 1);
  assert.deepEqual(st.buffett.scores, { A: 3, B: 5, C: 7, D: 3 });
});

test('heat fill depends on the score only', () => {
  assert.deepEqual([1, 3, 4, 5, 6, 7, 8, 10].map(heatLevel), [0, 0, 1, 1, 2, 3, 4, 4]);
  assert.equal(heatLevel(null), null);
});

test('seat positions: the board\'s chairs for seven, and a smooth arc for other counts', () => {
  assert.deepEqual(seatPositions(7), CHAIRS);
  const nine = seatPositions(9);
  assert.equal(nine.length, 9);
  assert.deepEqual(nine[0], CHAIRS[0]);
  assert.deepEqual(nine[8], CHAIRS[6]);
  for (let i = 1; i < nine.length; i++) assert.ok(nine[i][0] > nine[i - 1][0]);
  assert.equal(seatPositions(1).length, 1);
});

test('short option names: explicit short, "wait" for a wait option, else the label before a comma', () => {
  assert.equal(optShort({ label: 'Wait for $150', kind: 'wait' }), 'wait');
  assert.equal(optShort({ label: 'Starter now, add on proof', kind: 'act' }), 'starter now');
  assert.equal(optShort({ label: 'Pass', kind: 'none', short: 'Skip it' }), 'skip it');
});
