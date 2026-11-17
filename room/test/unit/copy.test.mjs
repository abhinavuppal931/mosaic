// The copy rules in docs/design/ROOM-DESIGN.md, checked against every string the Room builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from '../../lib/session.js';
import { seatResolver } from '../../lib/seats.js';
import { buildModel } from '../../lib/model.js';
import * as C from '../../lib/copy.js';

const ROOM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EX = path.join(ROOM, 'examples');
const examples = fs.readdirSync(EX).filter((d) => fs.existsSync(path.join(EX, d, 'council.json')));

/** Every string in the model the page draws (paths, ids and keys excluded). */
function strings(obj, out = [], key = '') {
  if (typeof obj === 'string') {
    if (!/^(img|key|id|rec|run|cmd|agreement|kind|mode|state|initials|file|speaker|dir)$/.test(key) && !obj.startsWith('/')) out.push(obj);
  } else if (Array.isArray(obj)) obj.forEach((v) => strings(v, out, key));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) if (k !== 'problems') strings(v, out, k);
  return out;
}

for (const ex of examples) {
  const m = buildModel(readSession(path.join(EX, ex), { resolve: seatResolver() }));
  const all = strings(m);

  test(`${ex}: no em dashes or en dashes`, () => {
    for (const s of all) assert.ok(!/[—–]/.test(s), s);
  });
  test(`${ex}: no fact ids or brain source ids`, () => {
    for (const s of all) assert.ok(!/\bF\d{3,4}\b|\bS\d{3}\b/.test(s), s);
  });
  test(`${ex}: one date format, never YYYY-MM-DD`, () => {
    for (const s of all) assert.ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(s), s);
  });
  test(`${ex}: no colon labels`, () => {
    for (const s of all) assert.ok(!/^[A-Z][A-Za-z ]{0,24}: \S/.test(s), s);
  });
  test(`${ex}: no abbreviations from the banned list in the Room's own words`, () => {
    // Seat quotes are shown as written; the Room's own strings must avoid these.
    const own = [...m.live.flatMap((b) => [b.stepText, b.next, b.lean.title, b.lean.body, b.speech.move, ...b.seats.map((x) => x.lean)]), m.verdict.closeLine, m.verdict.stats.evidence.note, m.verdict.stats.united.note, m.verdict.stats.bias.note, m.verdict.scorecard.note, m.verdict.banner, ...m.verdict.kills.map((k) => k.at)];
    for (const s of own.filter(Boolean)) assert.ok(!/\b(TTM|YoY|DCF|capex|n\/a|ROIC|FCF|EPS)\b/.test(s), s);
  });
  test(`${ex}: seat chips read "Leans <option> · <score>"`, () => {
    for (const b of m.live) for (const x of b.seats) assert.match(x.lean, /^(Leans [a-z$0-9][^·]* · \d+(\.\d)?|Waiting|Too hard to call)$/);
  });
  test(`${ex}: the disclaimer sits with the verdict`, () => {
    assert.equal(m.verdict.disclaimer, 'Mosaic grades how a decision was made. It is not investment advice.');
  });
}

test('the static page copy follows the same rules', () => {
  for (const f of ['public/app.js', 'public/index.html']) {
    const src = fs.readFileSync(path.join(ROOM, f), 'utf8');
    assert.ok(!/[—–]/.test(src), `${f} has an em or en dash`);
  }
  const app = fs.readFileSync(path.join(ROOM, 'public/app.js'), 'utf8');
  for (const label of ['The mosaic so far', 'Earlier this round', 'The big disagreement', 'Council score', 'Evidence', 'How united', 'Your bias check', 'What would change the call', 'If this happens', 'Warning level', 'Today', 'The strongest objection', 'Why the council landed here', 'How this could go wrong', 'Save to journal', 'Share', 'Download PDF']) {
    assert.ok(app.includes(label), `missing "${label}"`);
  }
});

test('the house date format', () => {
  assert.equal(C.fmtDate('2026-11-17'), '17 November 2026');
  assert.equal(C.fmtDate('2026-11-17T12:00:00Z'), '17 November 2026');
  assert.equal(C.fmtDate('17/11/2026'), '');
  assert.equal(C.datesInText('due 2027-01-27 [F008]'), 'due 27 January 2027 [F008]');
  assert.equal(C.monthYear('2026-11-17', 3), 'November 2029');
});

test('cleaning seat text removes ids and dashes, and tidies spaces', () => {
  assert.equal(C.clean('Returns near 30% [F002] (Economic castle, S001) — real.'), 'Returns near 30%, real.');
  assert.equal(C.clean('Yield [F004, F005].'), 'Yield.');
});

test('fact values in plain words', () => {
  assert.equal(C.factValue({ value: 0.724, unit: 'ratio' }), '72.4%');
  assert.equal(C.factValue({ value: 0.56, unit: 'ratio' }), '56%');
  assert.equal(C.factValue({ value: 3.4e11, unit: 'USD' }), '$340 billion');
  assert.equal(C.factValue({ value: 182, unit: 'USD/share' }), '$182.00');
  assert.equal(C.factValue({ value: 45.2, unit: 'x' }), '45.2 times');
  assert.equal(C.factValue({ value: '2026-11-19', unit: 'date' }), '19 November 2026');
  assert.equal(C.factValue({ value: null }), 'Not found');
});

test('vote counts read as a sentence', () => {
  assert.equal(C.voteCounts({ agrees: 3, partly: 3, disagrees: 1 }), 'Three agree, three partly agree, one disagrees.');
  assert.equal(C.voteCounts({ agrees: 5, partly: 0, disagrees: 0 }), 'All five agree.');
});

test('horizons in words or digits', () => {
  assert.equal(C.horizonYears('3 years'), 3);
  assert.equal(C.horizonYears('three-year hold'), 3);
  assert.equal(C.horizonYears('a while'), null);
});
