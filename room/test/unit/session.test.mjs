// Session parsing: the one module that reads the core live-room.md files, including files that
// are malformed, half-written or missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession, parseRound, parseCard, parseOptionScores, cardFields, factIds, parseJson, folderSignature, latestSession, validateCouncil } from '../../lib/session.js';
import { seatResolver } from '../../lib/seats.js';
import { buildModel } from '../../lib/model.js';

const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples');
const NVDA = path.join(EX, '2026-11-17-nvda-buy');
const resolve = seatResolver();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-room-'));
const copyAll = (from, to, names) => names.forEach((n) => fs.copyFileSync(path.join(from, n), path.join(to, n)));

test('option scores: every syntax core accepts', () => {
  assert.deepEqual(parseOptionScores('A 7/10 · B 8/10 · C 6/10 · D 3/10'), { A: 7, B: 8, C: 6, D: 3 });
  assert.deepEqual(parseOptionScores('[A] 6/10, [B] 7.5/10'), { A: 6, B: 7.5 });
  assert.deepEqual(parseOptionScores('A: 6, B: 7'), { A: 6, B: 7 });
  assert.deepEqual(parseOptionScores('A 11/10 · B 5/10'), { B: 5 }, 'out of range is dropped');
  assert.deepEqual(parseOptionScores('n/a'), {});
  assert.deepEqual(parseOptionScores(null), {});
});

test('card fields: uppercase FIELD lines, multi-line values, bold markers, unknown fields ignored', () => {
  const f = cardFields('**SEAT:** Buffett\nWHY:\n1. one [F002]\n2. two\nNOT A FIELD: x\nTHE CALL: B, a starter.');
  assert.equal(f.SEAT, 'Buffett');
  assert.equal(f.WHY, '1. one [F002]\n2. two\nNOT A FIELD: x');
  assert.equal(f['THE CALL'], 'B, a starter.');
});

test('a TOO HARD card abstains with no scores', () => {
  const c = parseCard('SEAT: Lynch\nSTANCE: TOO HARD\nOPTION SCORES: n/a\nWHY TOO HARD: not my game');
  assert.equal(c.abstain, true);
  assert.deepEqual(c.scores, {});
  assert.equal(c.whyTooHard, 'not my game');
});

test('fact ids are read only from square brackets, in order', () => {
  assert.deepEqual(factIds('ROIC 30% [F044] and [F002, F003] but not F009'), ['F044', 'F002', 'F003']);
});

test('round files: seat cards in order, Chair notes and unknown headings skipped, duplicates ignored', () => {
  const md = '# Round 2\n\n## Burry\n\nSEAT: Burry\nI DISAGREE MOST WITH: Druckenmiller. Cheap money explains it.\nOPTION SCORES: A 2/10 · B 4/10\n\n## Someone Else\n\nSEAT: x\n\n## Burry\n\nSEAT: Burry again\n\n## Chair notes\n\nInterim.';
  const cards = parseRound(md, resolve);
  assert.deepEqual(cards.map((c) => c.seat), ['burry']);
  assert.equal(cards[0].answering, 'druckenmiller');
  assert.equal(cards[0].rebuttal, 'Cheap money explains it.');
});

test('a round file cut off mid-card keeps the cards that are there', () => {
  const full = fs.readFileSync(path.join(NVDA, 'round-1.md'), 'utf8');
  const cut = full.slice(0, full.indexOf('## Damodaran') + 60);
  const cards = parseRound(cut, resolve);
  assert.deepEqual(cards.map((c) => c.seat), ['buffett', 'munger', 'damodaran']);
  assert.deepEqual(cards[2].scores, {}, 'the half-written card has no scores yet');
});

test('the full example parses with no problems', () => {
  const s = readSession(NVDA, { resolve });
  assert.deepEqual(s.problems, []);
  assert.equal(s.council.seats.length, 7);
  assert.deepEqual(Object.keys(s.rounds), ['1', '2', '3']);
  assert.equal(s.rounds[2].length, 7);
  assert.equal(s.pack.facts.length, 41);
  assert.ok(!('series' in s.pack), 'the pack is slimmed for the page');
});

test('parseJson never throws', () => {
  assert.equal(parseJson('{"a":1}').ok, true);
  assert.equal(parseJson('{"a":').ok, false);
  assert.equal(parseJson('42').ok, false);
  assert.equal(parseJson('﻿{"a":1}').ok, true);
});

test('a missing folder reports a problem instead of throwing', () => {
  const s = readSession('/no/such/mosaic/session', { resolve });
  assert.equal(s.council, null);
  assert.match(s.problems[0].message, /not found/);
});

test('a folder with only a brief has a council and no rounds', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json', 'brief.md']);
  const s = readSession(d, { resolve });
  assert.ok(s.council);
  assert.deepEqual(s.rounds, {});
  const m = buildModel(s);
  assert.equal(m.phase, 0);
  assert.equal(m.verdict, null);
  assert.equal(m.live.at(-1).speech.name, 'The Chair');
});

test('half-written JSON keeps the last good copy, and says so', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json', 'lean.json']);
  const cache = new Map();
  assert.equal(readSession(d, { resolve, cache }).lean.option, 'A');
  fs.writeFileSync(path.join(d, 'lean.json'), '{ "option": "B", "rea');
  const s = readSession(d, { resolve, cache });
  assert.equal(s.lean.option, 'A');
  assert.match(s.problems[0].message, /last good copy/);
});

test('half-written JSON with no earlier copy is ignored until complete', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json']);
  fs.writeFileSync(path.join(d, 'verdict.json'), '{"schema":"mosaic.verdict/1","label":');
  const s = readSession(d, { resolve });
  assert.equal(s.verdict, null);
  assert.match(s.problems[0].message, /ignored until it is complete/);
  assert.equal(buildModel(s).verdict, null);
});

test('an empty file is treated as not written yet', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json']);
  fs.writeFileSync(path.join(d, 'scores.json'), '');
  const s = readSession(d, { resolve });
  assert.equal(s.scores, null);
  assert.match(s.problems[0].message, /empty file/);
});

test('a council without options or seats is rejected with a problem', () => {
  assert.deepEqual(validateCouncil({ options: [{ id: 'A', label: 'x' }], seats: ['buffett'] }), []);
  assert.equal(validateCouncil({ options: [], seats: [] }).length, 2);
  const d = tmp();
  fs.writeFileSync(path.join(d, 'council.json'), JSON.stringify({ title: 'x', options: [{ label: 'no id' }], seats: ['buffett'] }));
  const s = readSession(d, { resolve });
  assert.equal(s.council, null);
  assert.equal(buildModel(s), null);
});

test('a lean on an option that does not exist is dropped with a problem', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json']);
  fs.writeFileSync(path.join(d, 'lean.json'), JSON.stringify({ option: 'Z', reason: 'x' }));
  const s = readSession(d, { resolve });
  assert.equal(s.lean.option, null);
  assert.match(s.problems[0].message, /not one of the council's options/);
});

test('a lean of null means the investor gave none', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json', 'round-1.md', 'round-2.md', 'round-3.md', 'verdict.json']);
  fs.writeFileSync(path.join(d, 'lean.json'), JSON.stringify({ option: null, reason: null }));
  const m = buildModel(readSession(d, { resolve }));
  assert.equal(m.verdict.stats.bias.none, true);
  assert.equal(m.live.at(-1).lean.state, 'none');
});

test('scores.json without a scorecard does not break the cross-check', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json', 'round-1.md', 'round-2.md', 'round-3.md', 'verdict.json']);
  fs.writeFileSync(path.join(d, 'scores.json'), JSON.stringify({ round: 3 }));
  const s = readSession(d, { resolve });
  assert.deepEqual(s.scores.scorecard, []);
  assert.deepEqual(buildModel(s).problems, []);
});

test('a session with no data pack still builds, with no evidence', () => {
  const d = tmp();
  copyAll(NVDA, d, ['council.json', 'round-1.md']);
  const m = buildModel(readSession(d, { resolve }));
  assert.equal(m.evidence.total, 0);
  assert.equal(m.evidence.note, 'No data pack yet.');
});

test('unknown seats resolve by key and get initials instead of a portrait', () => {
  const d = tmp();
  const council = JSON.parse(fs.readFileSync(path.join(NVDA, 'council.json'), 'utf8'));
  council.seats = ['buffett', 'newseat'];
  fs.writeFileSync(path.join(d, 'council.json'), JSON.stringify(council));
  fs.writeFileSync(path.join(d, 'round-1.md'), '# Round 1\n\n## newseat\n\nSEAT: newseat\nOPTION SCORES: A 5/10 · B 6/10 · C 4/10 · D 2/10\n');
  const roster = { seats: [{ key: 'newseat', name: 'Grace Hopper', short: 'Hopper', dimension: 'Engineering' }] };
  const m = buildModel(readSession(d, { resolve: seatResolver(roster) }), { roster });
  const seat = m.seats.find((x) => x.key === 'newseat');
  assert.equal(seat.short, 'Hopper');
  assert.equal(seat.img, null);
  assert.equal(seat.initials, 'GH');
  assert.equal(m.live.at(-1).speaker, 'newseat');
});

test('the folder signature changes when a file lands or changes', () => {
  const d = tmp();
  const a = folderSignature(d);
  fs.writeFileSync(path.join(d, 'council.json'), '{}');
  const b = folderSignature(d);
  assert.notEqual(a, b);
  fs.writeFileSync(path.join(d, 'notes.txt'), 'ignored');
  assert.equal(folderSignature(d), b, 'only .json and .md files count');
  assert.equal(folderSignature('/no/such/dir'), 'missing');
});

test('latestSession follows the newest council', () => {
  const root = tmp();
  for (const [n, t] of [['old', 1000], ['new', 2000]]) {
    fs.mkdirSync(path.join(root, n));
    fs.writeFileSync(path.join(root, n, 'council.json'), '{}');
    fs.utimesSync(path.join(root, n, 'council.json'), t, t);
  }
  fs.mkdirSync(path.join(root, 'not-a-session'));
  assert.equal(latestSession(root), path.join(root, 'new'));
  assert.equal(latestSession('/no/such/dir'), null);
});
