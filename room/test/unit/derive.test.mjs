// Votes and scores: every number the Room shows is derived from the seats' option scores.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from '../../lib/session.js';
import { seatResolver } from '../../lib/seats.js';
import { agreementOf, normAgreement, councilScores, jury, pickRecommended, runnerUp, seatTop, stateAt, seatPositions, CHAIRS, heatLevel, buildModel, optShort, DEFAULT_CONFIG } from '../../lib/model.js';

const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples');
const examples = fs.readdirSync(EX).filter((d) => fs.existsSync(path.join(EX, d, 'council.json')));
const load = (name) => readSession(path.join(EX, name), { resolve: seatResolver() });
const OPTS = ['A', 'B', 'C', 'D'].map((id) => ({ id, label: id }));

const st = (scores) => ({ scores, abstain: false });

test('agreement: agrees when the seat\'s top option is the recommended one', () => {
  assert.equal(agreementOf(st({ A: 4, B: 8, C: 6, D: 2 }), 'B'), 'agrees');
});

test('agreement: a tie at the top that includes the recommended option agrees', () => {
  assert.equal(agreementOf(st({ A: 8, B: 8, C: 4, D: 2 }), 'B'), 'agrees');
  assert.equal(seatTop({ A: 8, B: 8 }, OPTS, 'B'), 'B');
  assert.equal(seatTop({ A: 8, B: 8 }, OPTS), 'A');
});

test('agreement: disagrees when the recommended option scores at or below the threshold', () => {
  assert.equal(agreementOf(st({ A: 2, B: 4, C: 7, D: 6 }), 'B'), 'disagrees');
  assert.equal(agreementOf(st({ A: 2, B: 0, C: 7, D: 6 }), 'B'), 'disagrees');
});

test('agreement: partly agrees when another option is preferred and the recommended one is above the threshold', () => {
  assert.equal(agreementOf(st({ A: 4, B: 5, C: 7, D: 3 }), 'B'), 'partly agrees');
  assert.equal(agreementOf(st({ A: 4, B: 6, C: 7, D: 3 }), 'B'), 'partly agrees');
});

test('agreement: the threshold comes from the scoring config, not the code', () => {
  assert.equal(DEFAULT_CONFIG.agreement.disagreeAtOrBelow, 4);
  const cfg = { agreement: { disagreeAtOrBelow: 5 } };
  assert.equal(agreementOf(st({ A: 4, B: 5, C: 7, D: 3 }), 'B', cfg), 'disagrees');
  assert.equal(agreementOf(st({ A: 4, B: 6, C: 7, D: 3 }), 'B', cfg), 'partly agrees');
});

test('agreement: the top-choice rule wins even when that score is at or below the threshold', () => {
  assert.equal(agreementOf(st({ A: 2, B: 4, C: 3, D: 1 }), 'B'), 'agrees');
});

test('agreement: "abstains" for TOO HARD, null with no card or no score on the recommended option', () => {
  assert.equal(agreementOf({ scores: {}, abstain: true }, 'B'), 'abstains');
  assert.equal(agreementOf(undefined, 'B'), null);
  assert.equal(agreementOf(st({ A: 3 }), 'B'), null);
  assert.equal(agreementOf(st({ B: 7 }), null), null);
});

test('agreement values written elsewhere are read in core\'s words', () => {
  assert.equal(normAgreement('partly_agrees'), 'partly agrees');
  assert.equal(normAgreement('Partly'), 'partly agrees');
  assert.equal(normAgreement('Agrees'), 'agrees');
  assert.equal(normAgreement('abstains'), 'abstains');
  assert.equal(normAgreement(null), null);
  assert.match(normAgreement('maybe'), /^unknown/);
});

test('council score is the weighted mean, rounded to one decimal like core', () => {
  const state = { a: { scores: { A: 4, B: 7 } }, b: { scores: { A: 7, B: 4 } }, c: { scores: { A: 1, B: 9 }, abstain: false } };
  const s = councilScores(OPTS.slice(0, 2), state, { a: { weight: 3 }, b: { weight: 2 }, c: { weight: 1 } });
  assert.deepEqual(s.map((x) => x.score), [r1((3 * 4 + 2 * 7 + 1 * 1) / 6), r1((3 * 7 + 2 * 4 + 1 * 9) / 6)]);
  assert.deepEqual(s.map((x) => x.spread), [6, 5]);
});
const r1 = (v) => Math.round(v * 10) / 10;

test('every option is scored by the same seats: abstentions and partial score lines are left out (core\'s scoringSet)', () => {
  const state = { a: { scores: {}, abstain: true }, b: { scores: { A: 6, B: 8 } }, c: { scores: { A: 2 } } };
  assert.deepEqual(jury(OPTS.slice(0, 2), state), ['b']);
  const s = councilScores(OPTS.slice(0, 2), state, {});
  assert.deepEqual(s.map((x) => x.score), [6, 8], 'seat c scored only A, so it counts for neither');
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
  assert.deepEqual(m.verdict.counts, { agrees: 3, 'partly agrees': 3, disagrees: 1, abstains: 0, none: 0 });
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

test('core\'s agreement fields in the examples match the Room\'s derivation seat by seat', () => {
  for (const ex of examples) {
    const s = load(ex);
    const m = buildModel(s);
    for (const row of s.scores.scorecard) assert.equal(m.verdict.votes.find((v) => v.key === row.seat).agreement, row.agreement, `${ex} ${row.seat}`);
    assert.deepEqual(m.problems, []);
  }
});

test('a per-seat agreement that disagrees with the seat scores is logged as a problem, and the Room keeps its own', () => {
  const s = load('2026-11-17-nvda-buy');
  s.scores = { ...s.scores, scorecard: s.scores.scorecard.map((r) => (r.seat === 'burry' ? { ...r, agreement: 'agrees' } : r)) };
  const m = buildModel(s);
  assert.equal(m.problems.length, 1);
  assert.match(m.problems[0].message, /burry/);
  assert.equal(m.verdict.votes.find((v) => v.key === 'burry').vote, 'Disagrees');
});

test('a null or abstaining agreement must match too', () => {
  const s = load('2026-11-15-msft-size');
  s.scores = { ...s.scores, scorecard: s.scores.scorecard.map((r) => (r.seat === 'lynch' ? { ...r, agreement: null } : r)) };
  assert.match(buildModel(s).problems[0].message, /lynch.*null.*abstains/);
});

test('the aggregate agreement count is checked against the seats', () => {
  const s = load('2026-11-17-nvda-buy');
  s.scores = { ...s.scores, agreement: { ...s.scores.agreement, disagrees: 2 } };
  const p = buildModel(s).problems;
  assert.equal(p.length, 1);
  assert.match(p[0].message, /"disagrees" is 2 but the seat scores give 1/);
});

test('an interim scores.json from an earlier round is not compared', () => {
  const s = load('2026-11-17-nvda-buy');
  s.scores = { ...s.scores, round: 2, agreement: { agrees: 9 }, scorecard: s.scores.scorecard.map((r) => ({ ...r, agreement: 'agrees' })) };
  assert.deepEqual(buildModel(s).problems, []);
});

test('the free-text VOTE line never becomes the vote', () => {
  const s = load('2026-11-17-nvda-buy');
  for (const c of s.rounds[3]) c.vote = 'Dissent';
  const m = buildModel(s);
  assert.deepEqual(m.verdict.counts, { agrees: 3, 'partly agrees': 3, disagrees: 1, abstains: 0, none: 0 });
});

test('a seat with no score on the recommended option: "Did not score this option", off the dot plot, grey on the share card', () => {
  const s = load('2026-11-17-nvda-buy');
  const burry = s.rounds[3].find((c) => c.seat === 'burry');
  burry.scores = { A: 2, C: 7, D: 6 };
  const m = buildModel(s);
  const v = m.verdict.votes.find((x) => x.key === 'burry');
  assert.equal(v.agreement, null);
  assert.equal(v.cls, 'none');
  assert.equal(v.note, 'Did not score this option');
  assert.equal(m.verdict.stats.united.dots.length, 6);
  assert.match(m.verdict.stats.united.note, /Burry did not score this option\.$/);
  assert.equal(m.verdict.share.tiles.find((t) => t.key === 'burry').cls, 'none');
  assert.match(m.verdict.share.text, /one did not score it\.$/);
  assert.deepEqual(m.verdict.optionScores, { A: 3.8, B: 6.7, C: 5.9, D: 3.5 }, 'the seat leaves the shared set of scoring seats for every option: (50, 87, 77, 45) / 13');
});

test('a verdict that names a different option than the seat scores is flagged', () => {
  const s = load('2026-11-17-nvda-buy');
  s.verdict = { ...s.verdict, recommended: 'C' };
  const m = buildModel(s);
  assert.ok(m.problems.some((p) => /seat scores put B first/.test(p.message)));
});

test('an abstaining seat (TOO HARD) shows as "Too hard to call" and is counted apart', () => {
  const m = buildModel(load('2026-11-15-msft-size'));
  const lynch = m.verdict.votes.find((v) => v.key === 'lynch');
  assert.equal(lynch.agreement, 'abstains');
  assert.equal(lynch.vote, 'Too hard to call');
  assert.equal(lynch.note, 'Did not score the choices');
  assert.deepEqual(m.verdict.counts, { agrees: 5, 'partly agrees': 0, disagrees: 3, abstains: 1, none: 0 });
  assert.match(m.verdict.stats.united.note, /Lynch did not score this option/);
  assert.match(m.verdict.share.text, /Five agree, three disagree, one called it too hard\.$/);
});

test('re-check: the last verdict stays sealed through Round 1 and opens with Round 2', () => {
  const s = load('2026-11-17-nvda-buy');
  s.council = { ...s.council, recheckOf: '2026-08-01-nvda-buy' };
  const m = buildModel(s);
  const r1 = m.live.filter((b) => b.mode === 'card' && b.stepText.startsWith('Round 1'));
  assert.ok(r1.length === 7);
  for (const b of r1) {
    assert.equal(b.lean.state, 'sealed');
    assert.ok(!/Buy all now|Start small|Wait for|Pass/.test(`${b.lean.title} ${b.lean.body}`), b.lean.title);
  }
  const r2 = m.live.find((b) => b.stepText.startsWith('Round 2'));
  assert.equal(r2.lean.state, 'revealed');
  assert.match(r2.lean.title, /^Last time the council backed “Buy all now”/);
  assert.match(m.verdict.stats.bias.note, /^Once the council saw its last verdict/);
});

test('a normal council also keeps the lean sealed until Round 2', () => {
  const m = buildModel(load('2026-11-17-nvda-buy'));
  for (const b of m.live.filter((x) => x.mode !== 'card' || x.stepText.startsWith('Round 1'))) {
    if (b.mode === 'vote') continue;
    assert.equal(b.lean.state, 'sealed');
  }
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
