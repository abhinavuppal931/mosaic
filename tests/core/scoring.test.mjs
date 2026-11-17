// Scoring and label math: bands, weighted means, abstentions, overrides, lean pull, evidence.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURES } from './helpers/fake-fetch.mjs';
import { parseCard, parseOptionScores, splitCards, factIds, parseRound } from '../../scripts/lib/cards.mjs';
import { scoreCouncil, band, capLabel, optionScores, pickRecommended, unanimityCheck, leanPull, carryForward, DEFAULT_CONFIG } from '../../scripts/lib/scoring.mjs';
import { loadRoster, seatResolver } from '../../scripts/lib/roster.mjs';
import { readSession } from '../../scripts/lib/session.mjs';

const roster = loadRoster(path.join(FIXTURES, 'roster.json'));
const resolve = seatResolver(roster);
const SESSION = path.join(FIXTURES, 'session-msft');

const OPTIONS = [
  { id: 'A', label: 'Full now', kind: 'act' },
  { id: 'B', label: 'Starter', kind: 'act' },
  { id: 'C', label: 'Wait', kind: 'wait', trigger: 'price below 400' },
  { id: 'D', label: 'Pass', kind: 'none' },
];
const card = (scores, extra = {}) => ({ abstain: false, scores, conviction: 4, evidence: 'adequate', ruin: 'none', door: 'two-way', pillar: 6, why: [], whyCited: 0, ...extra });
const council = (seats, weights = {}) => ({ job: 'decision', options: OPTIONS, seats, weights: Object.fromEntries(seats.map((s) => [s, { weight: weights[s] ?? 1 }])) });

describe('card parser', () => {
  test('option scores in every format seats tend to write', () => {
    assert.deepEqual(parseOptionScores('A 6/10 · B 8/10 · C 7.5/10'), { A: 6, B: 8, C: 7.5 });
    assert.deepEqual(parseOptionScores('[A] 6/10 [B] 3/10'), { A: 6, B: 3 });
    assert.deepEqual(parseOptionScores('A: 6, B: 7'), { A: 6, B: 7 });
    assert.deepEqual(parseOptionScores('A 11/10'), {});
  });

  test('a full Round 1 card', () => {
    const md = fs.readFileSync(path.join(SESSION, 'round-1.md'), 'utf8');
    const cards = splitCards(md, resolve);
    assert.deepEqual(cards.map((c) => c.seat), ['buffett', 'taleb', 'burry']);
    const b = parseCard(cards[0].text);
    assert.equal(b.stance, 'Yes');
    assert.deepEqual(b.scores, { A: 7, B: 8, C: 6, D: 3 });
    assert.equal(b.pillar, 8);
    assert.equal(b.conviction, 4);
    assert.equal(b.evidence, 'strong');
    assert.equal(b.ruin, 'none');
    assert.equal(b.door, 'two-way');
    assert.equal(b.why.length, 2);
    assert.equal(b.whyCited, 2);
    assert.deepEqual(b.factIds.sort(), ['F002', 'F003']);
    assert.match(b.wrongIf, /capex stays above 35%/);
  });

  test('TOO HARD is an abstention with no scores', () => {
    const c = parseCard('SEAT: Lynch\nSTANCE: TOO HARD\nOPTION SCORES: n/a\nWHY TOO HARD: I cannot see this business in ten years.');
    assert.equal(c.abstain, true);
    assert.deepEqual(c.scores, {});
  });

  test('Round 3 votes', () => {
    assert.equal(parseCard('VOTE: Endorse with amendment\nFINAL SCORE: 6/10').vote, 'amend');
    assert.equal(parseCard('VOTE: Dissent').vote, 'dissent');
    assert.equal(parseCard('VOTE: Endorse').vote, 'endorse');
  });

  test('fact ids only count inside brackets', () => {
    assert.deepEqual(factIds('ROIC [F002] and [F003, F010]; F999 bare does not count'), ['F002', 'F003', 'F010']);
  });

  test('Chair sections and unknown headings are not cards', () => {
    const cards = splitCards('## Buffett\nSTANCE: Yes\n\n## Chair notes\nSTANCE: ignore\n\n## Somebody Else\nSTANCE: No', resolve);
    assert.deepEqual(cards.map((c) => c.seat), ['buffett']);
  });
});

describe('bands and caps', () => {
  test('band edges', () => {
    assert.equal(band(10), 'CONVICTION EARNED');
    assert.equal(band(7.5), 'CONVICTION EARNED');
    assert.equal(band(7.4), 'PROCEED WITH CONDITIONS');
    assert.equal(band(6.0), 'PROCEED WITH CONDITIONS');
    assert.equal(band(5.9), 'RESHAPE THE THESIS');
    assert.equal(band(4.5), 'RESHAPE THE THESIS');
    assert.equal(band(4.4), 'PASS');
    assert.equal(band(0), 'PASS');
  });

  test('caps only lower a label', () => {
    assert.equal(capLabel('CONVICTION EARNED', 'RESHAPE THE THESIS'), 'RESHAPE THE THESIS');
    assert.equal(capLabel('PASS', 'RESHAPE THE THESIS'), 'PASS');
    assert.equal(capLabel('WAIT FOR THE PITCH', 'RESHAPE THE THESIS'), 'WAIT FOR THE PITCH');
  });
});

describe('option scores', () => {
  test('weighted mean, one decimal, with the math line', () => {
    const s = optionScores(OPTIONS.slice(0, 2), { a: card({ A: 6, B: 8 }), b: card({ A: 8, B: 4 }) }, { a: { weight: 3 }, b: { weight: 1 } });
    assert.equal(s[0].score, 6.5); // (3x6 + 1x8) / 4
    assert.equal(s[1].score, 7); // (3x8 + 1x4) / 4
    assert.equal(s[0].math, 'A (3x6 + 1x8) / 4 = 6.5');
    assert.equal(s[1].spread, 4);
  });

  test('abstentions are excluded from the math', () => {
    const s = optionScores(OPTIONS.slice(0, 1), { a: card({ A: 8 }), b: { abstain: true, scores: {} } }, { a: { weight: 1 }, b: { weight: 3 } });
    assert.equal(s[0].score, 8);
    assert.equal(s[0].math, 'A (1x8) / 1 = 8.0');
  });

  test('ties go to the smaller spread, then the earlier option', () => {
    const top = pickRecommended([{ id: 'A', score: 6.6, spread: 3 }, { id: 'B', score: 6.6, spread: 1 }, { id: 'C', score: 2 }]);
    assert.equal(top.id, 'B');
    assert.equal(pickRecommended([{ id: 'B', score: 5, spread: 1 }, { id: 'A', score: 5, spread: 1 }]).id, 'A');
  });
});

describe('scoreCouncil', () => {
  test('the fixture session end to end (math checked by hand)', () => {
    const s = readSession(SESSION, resolve);
    const r = scoreCouncil({ council: s.council, rounds: s.rounds, lean: s.lean.option, coverage: s.pack.coverage.score, draft: s.draft, roster });
    assert.equal(r.round, 3);
    assert.deepEqual(r.options.map((o) => o.score), [4.4, 6.6, 6.3, 3.9]);
    assert.equal(r.options[1].math, 'B (3x8 + 2x6 + 2x5) / 7 = 6.6');
    assert.equal(r.recommended, 'B');
    assert.equal(r.label, 'PROCEED WITH CONDITIONS');
    assert.equal(r.spread, 3);
    assert.equal(r.confidence, 7); // mean conviction 3.67 x 2, carried forward from Round 2
    assert.deepEqual(r.votes, { endorse: 1, amend: 1, dissent: 1 });
    assert.equal(r.support, 6.3); // (3x8 + 2x6 + 2x4) / 7
    assert.equal(r.leanPull.option, 'A');
    assert.equal(r.leanPull.value, 0.2);
    assert.equal(r.leanPull.flagged, false);
    assert.equal(r.evidence.citedShare, 0.833);
    assert.equal(r.evidence.grade, 'high');
    assert.equal(r.unanimousRound1.unanimous, false);
    assert.deepEqual(r.overrides, []);
    assert.deepEqual(r.problems, []);
    assert.equal(r.scorecard.find((x) => x.seat === 'buffett').dimension, 'Moat and owner economics');
  });

  test('all seats abstain: INSUFFICIENT EVIDENCE', () => {
    const r = scoreCouncil({ council: council(['a', 'b']), rounds: { 1: { a: { abstain: true, scores: {} }, b: { abstain: true, scores: {} } } } });
    assert.equal(r.label, 'INSUFFICIENT EVIDENCE');
    assert.deepEqual(r.abstentions, ['a', 'b']);
    assert.equal(r.recommended, null);
  });

  test('one abstention is shown and excluded', () => {
    const r = scoreCouncil({ council: council(['a', 'b', 'c']), rounds: { 1: { a: card({ A: 8, B: 5 }), b: card({ A: 8, B: 5 }), c: { abstain: true, scores: {}, stance: 'TOO HARD' } } } });
    assert.deepEqual(r.abstentions, ['c']);
    assert.equal(r.options[0].score, 8);
    assert.equal(r.label, 'CONVICTION EARNED');
    assert.equal(r.scorecard.find((x) => x.seat === 'c').abstain, true);
  });

  test('ruin cap: one seat at RUIN RISK likely caps at RESHAPE THE THESIS', () => {
    const rounds = { 1: { a: card({ A: 9 }), b: card({ A: 9 }), c: card({ A: 8 }, { ruin: 'likely' }) } };
    const r = scoreCouncil({ council: council(['a', 'b', 'c']), rounds });
    assert.equal(r.band, 'CONVICTION EARNED');
    assert.equal(r.label, 'RESHAPE THE THESIS');
    assert.equal(r.overrides[0].type, 'ruin_cap');
    assert.deepEqual(r.overrides[0].seats, ['c']);
  });

  test('ruin cap lifts when that seat endorses a mitigation (and did not dissent)', () => {
    const rounds = { 1: { a: card({ A: 9 }), c: card({ A: 8 }, { ruin: 'likely' }) }, 3: { a: card({ A: 9 }, { vote: 'endorse' }), c: card({ A: 8 }, { ruin: 'likely', vote: 'amend' }) } };
    const draft = { ruin_mitigations: [{ seat: 'c', mitigation: 'cap size at 5%', endorsed: true }] };
    assert.equal(scoreCouncil({ council: council(['a', 'c']), rounds, draft }).label, 'CONVICTION EARNED');
    rounds[3].c.vote = 'dissent';
    assert.equal(scoreCouncil({ council: council(['a', 'c']), rounds, draft }).label, 'RESHAPE THE THESIS');
  });

  test('one-way door cap: majority one-way and spread of 4 or more', () => {
    const rounds = { 1: { a: card({ A: 10 }, { door: 'one-way' }), b: card({ A: 10 }, { door: 'one-way' }), c: card({ A: 6 }) } };
    const r = scoreCouncil({ council: council(['a', 'b', 'c'], { a: 3, b: 3, c: 1 }), rounds });
    assert.equal(r.band, 'CONVICTION EARNED');
    assert.equal(r.label, 'PROCEED WITH CONDITIONS');
    assert.equal(r.overrides[0].type, 'one_way_cap');
    rounds[1].c.scores.A = 7; // spread 3: no cap
    assert.equal(scoreCouncil({ council: council(['a', 'b', 'c'], { a: 3, b: 3, c: 1 }), rounds }).label, 'CONVICTION EARNED');
  });

  test('INSUFFICIENT EVIDENCE: low pack coverage replaces the label but keeps the underlying one', () => {
    const r = scoreCouncil({ council: council(['a']), rounds: { 1: { a: card({ A: 8 }) } }, coverage: 0.4 });
    assert.equal(r.label, 'INSUFFICIENT EVIDENCE');
    assert.equal(r.underlyingLabel, 'CONVICTION EARNED');
    assert.match(r.overrides.at(-1).note, /coverage 40%/);
  });

  test('INSUFFICIENT EVIDENCE: most seats rate their evidence thin', () => {
    const rounds = { 1: { a: card({ A: 8 }, { evidence: 'thin' }), b: card({ A: 8 }, { evidence: 'thin' }), c: card({ A: 8 }) } };
    assert.equal(scoreCouncil({ council: council(['a', 'b', 'c']), rounds, coverage: 0.9 }).label, 'INSUFFICIENT EVIDENCE');
    rounds[1].b.evidence = 'strong';
    assert.equal(scoreCouncil({ council: council(['a', 'b', 'c']), rounds, coverage: 0.9 }).label, 'CONVICTION EARNED');
  });

  test('WAIT FOR THE PITCH when the wait option wins, naming its trigger', () => {
    const r = scoreCouncil({ council: council(['a']), rounds: { 1: { a: card({ A: 3, C: 7 }) } } });
    assert.equal(r.recommended, 'C');
    assert.equal(r.label, 'WAIT FOR THE PITCH');
    assert.equal(r.overrides[0].trigger, 'price below 400');
  });

  test('a weak wait option is a PASS, not a WAIT', () => {
    assert.equal(scoreCouncil({ council: council(['a']), rounds: { 1: { a: card({ A: 2, C: 4 }) } } }).label, 'PASS');
  });

  test('the Chair can call WAIT on an act option only with a trigger', () => {
    const r = scoreCouncil({ council: council(['a']), rounds: { 1: { a: card({ A: 7 }) } }, draft: { wait_for_pitch: { trigger: '10-Q shows capex falling' } } });
    assert.equal(r.label, 'WAIT FOR THE PITCH');
    assert.equal(r.overrides[0].trigger, '10-Q shows capex falling');
  });

  test('top option "don\'t act" is PASS', () => {
    const r = scoreCouncil({ council: council(['a']), rounds: { 1: { a: card({ A: 2, D: 8 }) } } });
    assert.equal(r.label, 'PASS');
    assert.equal(r.overrides[0].type, 'pass');
  });

  test('confidence loses a point at spread 5 or more', () => {
    const rounds = { 1: { a: card({ A: 9 }, { conviction: 5 }), b: card({ A: 4 }, { conviction: 5 }) } };
    const r = scoreCouncil({ council: council(['a', 'b']), rounds });
    assert.equal(r.spread, 5);
    assert.equal(r.confidence, 9);
  });

  test('quick mode: Round 3 needed when scores did not converge or a ruin flag is up', () => {
    const tight = { 1: { a: card({ A: 7 }) , b: card({ A: 6 }) }, 2: { a: card({ A: 7 }), b: card({ A: 6 }) } };
    assert.equal(scoreCouncil({ council: council(['a', 'b']), rounds: tight }).needsRound3, false);
    const wide = { 1: tight[1], 2: { a: card({ A: 9 }), b: card({ A: 4 }) } };
    assert.equal(scoreCouncil({ council: council(['a', 'b']), rounds: wide }).needsRound3, true);
    const ruin = { 1: tight[1], 2: { a: card({ A: 7 }), b: card({ A: 6 }, { ruin: 'likely' }) } };
    assert.equal(scoreCouncil({ council: council(['a', 'b']), rounds: ruin }).needsRound3, true);
  });

  test('a missing card is reported as a problem', () => {
    const r = scoreCouncil({ council: council(['a', 'b']), rounds: { 1: { a: card({ A: 7 }) } } });
    assert.match(r.problems[0], /no card in round 1 for: b/);
  });

  test('stress test reports thesis strength as option A', () => {
    const c = { ...council(['a']), job: 'stress_test' };
    assert.equal(scoreCouncil({ council: c, rounds: { 1: { a: card({ A: 6.5, B: 7 }) } } }).thesisStrength, 6.5);
  });
});

describe('unanimity, carry-forward and lean pull', () => {
  test('unanimous Round 1 is flagged', () => {
    assert.equal(unanimityCheck({ a: card({ A: 8, B: 3 }), b: card({ A: 7.5, B: 2 }) }).unanimous, true);
    assert.equal(unanimityCheck({ a: card({ A: 9, B: 3 }), b: card({ A: 7, B: 2 }) }).unanimous, false);
    assert.equal(unanimityCheck({ a: card({ A: 8 }), b: card({ B: 8 }) }).unanimous, false);
  });

  test('fields a later round omits carry forward from the earlier card', () => {
    const r = carryForward({ 1: { a: card({ A: 5 }, { evidence: 'thin', door: 'one-way' }) }, 3: { a: { abstain: false, scores: { A: 6 }, conviction: null, evidence: null, ruin: null, door: null, pillar: null, vote: 'endorse' } } });
    assert.equal(r[3].a.evidence, 'thin');
    assert.equal(r[3].a.door, 'one-way');
    assert.equal(r[3].a.vote, 'endorse');
  });

  test('lean pull measures movement toward the lean relative to the other options', () => {
    const r1 = { a: card({ A: 4, B: 6 }), b: card({ A: 5, B: 5 }) };
    const fin = { a: card({ A: 6, B: 6 }), b: card({ A: 7, B: 4 }) };
    const lp = leanPull('A', r1, fin, { a: { weight: 1 }, b: { weight: 1 } }, OPTIONS.slice(0, 2), DEFAULT_CONFIG);
    // a: +2 on A, 0 on B -> 2; b: +2 on A, -1 on B -> 3; mean 2.5
    assert.equal(lp.value, 2.5);
    assert.equal(lp.rawShift, 2);
    assert.equal(lp.flagged, true);
    assert.equal(leanPull('A', { a: card({ B: 5 }) }, { a: card({ B: 6 }) }, {}, OPTIONS, DEFAULT_CONFIG).value, null);
  });
});

test('parseRound maps headings to seat keys', () => {
  const r = parseRound('## Warren Buffett\nSTANCE: Yes\nOPTION SCORES: A 5/10', resolve);
  assert.deepEqual(Object.keys(r), ['buffett']);
});
