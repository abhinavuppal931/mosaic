// The investor spotlight (B6): every number and line in the panel is derived from the round
// cards, the cruxes and the verdict, never typed in. Checked against the three example councils.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from '../../lib/session.js';
import { seatResolver } from '../../lib/seats.js';
import { buildModel, stanceOf, dotRow, STANCE_TEXT } from '../../lib/model.js';
import * as C from '../../lib/copy.js';

const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples');
const load = (name) => readSession(path.join(EX, name), { resolve: seatResolver() });
const spot = (name, s = load(name)) => buildModel(s).verdict.spotlight;
const panel = (sp, key) => sp.panels.find((p) => p.key === key);

test('stance: the VOTE words name it, and anything unclear is no stance', () => {
  assert.equal(stanceOf('Endorse'), 'endorse');
  assert.equal(stanceOf('Endorse with amendment'), 'amend');
  assert.equal(stanceOf('Dissent'), 'dissent');
  assert.equal(stanceOf(''), null);
  assert.equal(stanceOf(null), null);
  assert.equal(stanceOf('maybe'), null);
  assert.deepEqual(STANCE_TEXT, { endorse: 'Backs the plan', amend: 'With a condition', dissent: 'Against the plan' });
});

test('dot row: a ring and a link only when the score moved since round 1', () => {
  const moved = dotRow('Start small', 6, 5, 6.3, { who: 'Buffett', strong: true });
  assert.equal(moved.moved, true);
  assert.equal(moved.start, 5);
  assert.deepEqual([moved.lo, moved.hi], [5, 6]);
  assert.equal(moved.councilText, '6.3');
  assert.equal(moved.aria, 'Buffett scored Start small 6 out of 10, up from 5 in round 1. The council scored 6.3.');
  const kept = dotRow('Pass', 3, 3, 3.8, { who: 'Buffett' });
  assert.equal(kept.moved, false);
  assert.equal(kept.start, null);
  assert.equal(kept.aria, 'Buffett scored Pass 3 out of 10. The council scored 3.8.');
});

test('NVIDIA: the cards row and the stance chips follow the final round, coloured by the scores', () => {
  const sp = spot('2026-11-17-nvda-buy');
  assert.equal(sp.heading, 'How each investor voted on the plan');
  assert.equal(sp.sub, 'Each investor scored all four choices from 0 to 10, then voted on the council’s plan.');
  assert.deepEqual(sp.panels.map((p) => p.key), ['buffett', 'munger', 'damodaran', 'marks', 'taleb', 'druckenmiller', 'burry']);
  assert.deepEqual(sp.panels.map((p) => p.stance), ['With a condition', 'With a condition', 'Backs the plan', 'With a condition', 'Backs the plan', 'Backs the plan', 'Against the plan']);
  assert.deepEqual(sp.panels.map((p) => p.cls), ['partly', 'partly', 'agrees', 'partly', 'agrees', 'agrees', 'disagrees']);
  assert.deepEqual(sp.panels.map((p) => `${p.pos} of ${p.total}`), ['1 of 7', '2 of 7', '3 of 7', '4 of 7', '5 of 7', '6 of 7', '7 of 7']);
});

test('NVIDIA, Buffett: summary rows against the weighted council, his moves and his condition', () => {
  const b = panel(spot('2026-11-17-nvda-buy'), 'buffett');
  assert.deepEqual(b.rows.map((r) => [r.label, r.fin, r.start, r.councilText, r.strong]), [
    ['Buy all now', 4, 3, '3.6', false],
    ['Start small', 6, 5, '6.3', false],
    ['Wait for $150', 7, null, '6.1', true],
    ['Pass', 3, null, '3.8', false],
  ]);
  assert.equal(b.hasMoves, true);
  assert.equal(b.keptNote, '');
  assert.equal(b.line, 'Buy the business, not the excitement.');
  assert.equal(b.bridge, 'His top score is still Wait for $150, but he backed Start small in the final round, with his condition.');
  assert.deepEqual(b.condition, { kind: 'amend', label: 'The condition he asked for', text: 'Add more only after two quarters of proof, not one.', state: 'Adopted by the council', adopted: true });
  assert.deepEqual(b.moves.map((m) => [m.head, m.why]), [['Buy all now, 3 to 4, in round 2', 'Earnings are growing faster than he assumed.'], ['Start small, 5 to 6, in round 3', '']]);
  assert.equal(b.councilNote, 'The council score is a weighted average of the seven final scores. Damodaran’s counts 1.5 times, as the valuation specialist.');
  assert.equal(b.why.length, 3);
  assert.deepEqual(b.why[0].chips.map((c) => [c.label, c.value]), [['Return on invested capital', '74%']]);
  assert.match(b.why[2].text, /a dependence he wants to understand better\.$/);
  assert.deepEqual(b.now, { label: 'Gross margin now', value: '72.4%', title: b.now.title });
  assert.equal(b.question, 'Would you be happy owning this if the market closed for five years?');
  assert.equal(b.facts, 6);
  assert.equal(b.factsText, '6 facts from the council’s fact sheet');
  assert.equal(b.disclaimer, 'A simulation built from Warren Buffett’s public work. Not his views, and not investment advice.');
});

test('NVIDIA, Buffett: the three rounds, with mini dot rows and the council on the final one', () => {
  const steps = panel(spot('2026-11-17-nvda-buy'), 'buffett').steps;
  assert.deepEqual(steps.map((s) => [s.title, s.sub, s.council, s.final]), [
    ['Opening', 'Written alone, before he read the other investors', false, false],
    ['Debate', 'After reading the other investors', false, false],
    ['Final vote', 'With a condition', true, true],
  ]);
  assert.deepEqual(steps[0].mini.map((x) => x.v), ['3', '5', '7', '3']);
  assert.deepEqual(steps[1].mini.map((x) => x.changed), [true, false, false, false]);
  assert.deepEqual(steps[2].mini.map((x) => x.council), [3.6, 6.3, 6.1, 3.8]);
  assert.equal(steps[0].blocks[0].text, 'Wait for $150. A wonderful business, but he would wait for a price that leaves room for error.');
  assert.deepEqual(steps[1].blocks.map((x) => x.label), ['His sharpest disagreement, with Druckenmiller', 'What he conceded', 'Is AI chip demand here to stay, or a boom that will cool?']);
  assert.equal(steps[1].blocks[0].face.key, 'druckenmiller');
  assert.equal(steps[2].blocks[0].text, 'He moved Start small from 5 to 6.');
});

test('NVIDIA: the weighted seat says it counts 1.5 times, a seat that never moved says so, and a dissent explains itself', () => {
  const sp = spot('2026-11-17-nvda-buy');
  const d = panel(sp, 'damodaran');
  assert.equal(d.councilNote, 'His score counts 1.5 times in the council average, as the valuation specialist.');
  assert.equal(d.keptNote, 'He kept every score from round 1 to the final vote.');
  assert.equal(d.hasMoves, false);
  assert.equal(d.bridge, 'Start small is his top score too, and he backed the plan in the final round.');
  const burry = panel(sp, 'burry');
  assert.equal(burry.condition.kind, 'dissent');
  assert.equal(burry.condition.label, 'Why he voted against');
  assert.equal(burry.now.label, 'Today', 'a long fact label falls back to a short one');
  assert.equal(burry.now.value, '46%');
  assert.equal(burry.bridge, 'His top score is Wait for $150, and he voted against the plan in the final round.');
  assert.equal(panel(sp, 'munger').condition.state, 'Not adopted', 'an amendment the verdict does not list was not adopted');
  assert.equal(panel(sp, 'druckenmiller').steps[0].blocks[0].text, 'Buy all now or start small. He would rather own it early than late.');
});

test('every number follows the session files: change a final score and the panel follows', () => {
  const s = load('2026-11-17-nvda-buy');
  s.rounds[3].find((c) => c.seat === 'buffett').scores.D = 9;
  const b = panel(spot(null, s), 'buffett');
  const pass = b.rows.find((r) => r.label === 'Pass');
  assert.equal(pass.fin, 9);
  assert.equal(pass.start, 3);
  assert.equal(pass.strong, true, 'Pass is now his top score');
  assert.equal(pass.councilText, '4.6', 'the council tick is recomputed with the weights: (2x9 + 2x4 + 3x3 + 2x4 + 2x5 + 2x2 + 2x6) / 15');
  assert.ok(b.moves.some((m) => m.head === 'Pass, 3 to 9, in round 3'));
});

test('quick council (two rounds, no vote): the final round carries the council and stances come from the scores', () => {
  const sp = spot('2026-11-12-cost-sell');
  assert.equal(sp.heading, 'Where each investor landed');
  assert.equal(sp.sub, 'Each investor scored all three choices from 0 to 10, then the council picked a plan.');
  const b = panel(sp, 'buffett');
  assert.equal(b.stance, 'Partly agrees');
  assert.equal(b.bridge, 'His top score is Keep it all. The council picked Sell a third.');
  assert.equal(b.keptNote, 'He kept every score from round 1 to the final round.');
  assert.deepEqual(b.steps.map((s) => [s.title, s.council]), [['Opening', false], ['Debate', true]]);
  const taleb = panel(sp, 'taleb');
  assert.equal(taleb.moves.find((m) => m.why).head, 'Sell a third, 8 to 9, in round 2', 'the MOVED reason belongs to the option it names');
});

test('nine seats with an abstainer: "Too hard to call", no score rows, and the jury count leaves the abstainer out', () => {
  const sp = spot('2026-11-15-msft-size');
  assert.equal(sp.panels.length, 9);
  const lynch = panel(sp, 'lynch');
  assert.equal(lynch.stance, 'Too hard to call');
  assert.equal(lynch.abstain, true);
  assert.deepEqual(lynch.rows, []);
  assert.ok(lynch.steps.every((s) => s.mini.length === 0));
  assert.match(panel(sp, 'buffett').councilNote, /of the eight final scores\. Mauboussin’s counts 1\.5 times, as the sizing specialist\.$/);
  assert.equal(panel(sp, 'damodaran').line, 'A fair price is not a reason to double.', 'a line starting with "A" is not an option letter');
});

test('third person: the seat\'s first-person lines are retold the way the board reads', () => {
  const t = (x) => C.thirdPerson(x);
  assert.equal(t('I value it at $150 to $205 a share.'), 'He values it at $150 to $205 a share.');
  assert.equal(t('If I am wrong, the fall could be 40%.'), 'If he is wrong, the fall could be 40%.');
  assert.equal(t('faster than I assumed'), 'faster than he assumed');
  assert.equal(t('as good as any I have seen'), 'as good as any he has seen');
  assert.equal(t('I pick stocks; I would not guess.'), 'He picks stocks; he would not guess.');
  assert.equal(t('Margins will fall; my story has them falling.'), 'Margins will fall; his story has them falling.');
  assert.equal(t('I still think so. I do not know.'), 'He still thinks so. He does not know.');
  assert.equal(t('What would make you sell?'), 'What would make you sell?');
  assert.equal(C.thirdPerson('I value it.', C.pronouns(false)), 'They value it.');
});

test('option letters in a call are spelled out, and a plain "A" is left alone', () => {
  const opts = [{ id: 'A', label: 'Buy all now' }, { id: 'B', label: 'Start small' }, { id: 'C', label: 'Wait for $150' }, { id: 'D', label: 'Pass' }];
  assert.equal(C.spellOptions('C. A wonderful business', opts), 'Wait for $150. A wonderful business');
  assert.equal(C.spellOptions('C or D. The crowd', opts), 'Wait for $150 or pass. The crowd');
  assert.equal(C.spellOptions('B, sized so the worst case is survivable.', opts), 'Start small, sized so the worst case is survivable.');
  assert.equal(C.spellOptions('A fair price is not a reason.', opts), 'A fair price is not a reason.');
});
