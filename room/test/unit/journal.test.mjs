// Save to journal writes core's mosaic.journal/1 format (scripts/lib/journal.mjs in core).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSession } from '../../lib/session.js';
import { seatResolver } from '../../lib/seats.js';
import { saveSession, listJournal, journalStatus, journalKey, SCHEMA } from '../../lib/journal.js';

const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples');
const NVDA = path.join(EX, '2026-11-17-nvda-buy');
const load = (d) => readSession(d, { resolve: seatResolver() });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-journal-'));
const NOW = () => Date.parse('2026-11-17T15:00:00Z');

// The entry fields core's buildEntry writes, in core's order.
const CORE_ENTRY_KEYS = ['id', 'date', 'session', 'job', 'mode', 'decision', 'options', 'trigger', 'horizon', 'lean', 'seats', 'recommended', 'label', 'underlyingLabel', 'optionScores', 'confidence', 'spread', 'evidence', 'leanPull', 'call', 'dissent', 'premortem', 'kill_criteria', 'conditions', 'recheck', 'pack'];
const CORE_DOC_KEYS = ['schema', 'key', 'ticker', 'company', 'thesis', 'status', 'created', 'entries', 'updated', 'next_recheck', 'latest'];

test('journal key: the ticker, else MACRO or PORTFOLIO', () => {
  assert.equal(journalKey({ ticker: 'nvda' }), 'NVDA');
  assert.equal(journalKey({ job: 'macro' }), 'MACRO');
  assert.equal(journalKey({ job: 'portfolio' }), 'PORTFOLIO');
  assert.equal(journalKey({ job: 'decision' }), null);
});

test('saving writes journal/<KEY>.json in the core format', () => {
  const dir = tmp();
  const s = load(NVDA);
  assert.equal(journalStatus(dir, s.council).saved, false);
  const { key } = saveSession(dir, s, { now: NOW });
  assert.equal(key, 'NVDA');
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'NVDA.json'), 'utf8'));
  assert.equal(doc.schema, SCHEMA);
  assert.deepEqual(Object.keys(doc).sort(), [...CORE_DOC_KEYS].sort());
  assert.equal(doc.company, 'NVIDIA CORP');
  assert.equal(doc.next_recheck, '2026-11-21');
  assert.deepEqual(doc.latest, { label: 'PROCEED WITH CONDITIONS', recommended: 'B', date: '2026-11-17' });
  const e = doc.entries[0];
  assert.deepEqual(Object.keys(e), CORE_ENTRY_KEYS);
  assert.deepEqual(e.optionScores, { A: 3.6, B: 6.3, C: 6.1, D: 3.8 });
  assert.equal(e.evidence, 'high');
  assert.deepEqual(e.lean, { option: 'A', reason: 'everyone is buying it and I do not want to miss out' });
  assert.equal(e.kill_criteria.length, 3);
  assert.equal(e.kill_criteria[0].id, 'K1');
  assert.equal(e.pack.snapshot.gross_margin.value, 0.724);
  assert.equal(journalStatus(dir, s.council).saved, true);
});

test('saving the same council again replaces its entry; another council appends', () => {
  const dir = tmp();
  const s = load(NVDA);
  saveSession(dir, s, { now: NOW });
  saveSession(dir, s, { now: NOW });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'NVDA.json'), 'utf8')).entries.length, 1);
  const other = { ...s, council: { ...s.council, id: '2026-12-01-nvda-recheck' } };
  saveSession(dir, other, { now: () => Date.parse('2026-12-01T10:00:00Z') });
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'NVDA.json'), 'utf8'));
  assert.deepEqual(doc.entries.map((e) => e.date), ['2026-11-17', '2026-12-01']);
  assert.equal(doc.updated, '2026-12-01');
});

test('an unfinished council cannot be journaled', () => {
  const d = tmp();
  for (const n of ['council.json', 'round-1.md']) fs.copyFileSync(path.join(NVDA, n), path.join(d, n));
  assert.throws(() => saveSession(tmp(), load(d)), /no verdict/);
});

test('a journal file with another schema is left alone', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'NVDA.json'), JSON.stringify({ schema: 'something/else', entries: [] }));
  assert.throws(() => saveSession(dir, load(NVDA)), /expected mosaic\.journal\/1/);
});

test('the journal list: one row per thesis, soonest re-check first, due flags', () => {
  const dir = tmp();
  for (const ex of ['2026-11-17-nvda-buy', '2026-11-12-cost-sell', '2026-11-15-msft-size']) saveSession(dir, load(path.join(EX, ex)), { now: NOW });
  fs.writeFileSync(path.join(dir, 'broken.json'), '{');
  const rows = listJournal(dir, '2026-12-20');
  assert.deepEqual(rows.map((r) => r.key), ['NVDA', 'COST', 'MSFT']);
  assert.deepEqual(rows.map((r) => r.due), [true, true, false]);
  assert.equal(rows[0].latest.optionScores.B, 6.3);
  assert.deepEqual(listJournal('/no/such/dir', '2026-12-20'), []);
});
