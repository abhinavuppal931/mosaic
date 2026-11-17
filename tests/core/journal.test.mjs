// Thesis journal: entries, listing, and the recheck diff.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIXTURES } from './helpers/fake-fetch.mjs';
import { NOW } from './helpers/setup.mjs';
import { buildEntry, appendEntry, readJournal, listJournal, diffPacks, renderChanges, journalKey, nextRecheck, evalKill, snapshotFacts, SCHEMA } from '../../scripts/lib/journal.mjs';

const SESSION = path.join(FIXTURES, 'session-msft');
const j = (f) => JSON.parse(fs.readFileSync(path.join(SESSION, f), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-journal-'));
const entry = () => buildEntry({ council: j('council.json'), verdict: j('verdict.json'), scores: { recommended: 'B', label: 'PROCEED WITH CONDITIONS', options: [{ id: 'B', score: 6.6 }], confidence: 7, spread: 3, evidence: { grade: 'high' }, leanPull: { value: 0.2 } }, pack: j('data-pack.json'), lean: j('lean.json'), sessionPath: SESSION, now: () => NOW });

describe('entries', () => {
  test('an entry carries the verdict, kill criteria, re-check and a fact snapshot', () => {
    const e = entry();
    assert.equal(e.id, '2026-11-17-msft-buy');
    assert.equal(e.label, 'PROCEED WITH CONDITIONS');
    assert.deepEqual(e.optionScores, { B: 6.6 });
    assert.equal(e.lean.option, 'A');
    assert.equal(e.recheck.date, '2027-01-29');
    assert.equal(e.kill_criteria.length, 2);
    assert.equal(e.pack.snapshot.gross_margin.value, 0.677);
    assert.equal(e.pack.hash, 'sha256:fixture');
  });

  test('journal key: ticker, else MACRO or PORTFOLIO', () => {
    assert.equal(journalKey({ ticker: 'brk.b' }), 'BRK.B');
    assert.equal(journalKey({ job: 'macro' }), 'MACRO');
    assert.equal(journalKey({ job: 'portfolio' }), 'PORTFOLIO');
    assert.throws(() => journalKey({ job: 'decision' }));
  });

  test('re-check date: verdict date, else just after the next report, else 90 days', () => {
    assert.equal(nextRecheck({ verdict: { recheck: { date: '2027-02-01' } }, now: () => NOW }), '2027-02-01');
    assert.equal(nextRecheck({ verdict: {}, pack: j('data-pack.json'), now: () => NOW }), '2027-01-29');
    assert.equal(nextRecheck({ verdict: {}, pack: { facts: [] }, now: () => NOW }), '2027-02-15');
  });

  test('append creates the file, replaces a re-journaled session, and lists by next re-check', () => {
    const dir = tmp();
    const doc = appendEntry(dir, 'MSFT', entry(), { company: 'MICROSOFT CORP' });
    assert.equal(doc.schema, SCHEMA);
    assert.equal(doc.next_recheck, '2027-01-29');
    appendEntry(dir, 'MSFT', entry());
    assert.equal(readJournal(dir, 'MSFT').entries.length, 1);
    const later = { ...entry(), id: 'later', date: '2027-01-30', label: 'PASS', recheck: { date: '2027-05-01', triggers: [] } };
    appendEntry(dir, 'MSFT', later);
    assert.equal(readJournal(dir, 'MSFT').latest.label, 'PASS');
    appendEntry(dir, 'NVDA', { ...entry(), id: 'n', recheck: { date: '2026-12-01', triggers: [] } });
    const rows = listJournal(dir, '2026-12-02');
    assert.deepEqual(rows.map((r) => r.key), ['NVDA', 'MSFT']);
    assert.equal(rows[0].due, true);
    assert.equal(rows[1].due, false);
    assert.equal(rows[1].entries, 2);
  });

  test('refuses a file with another schema', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'MSFT.json'), JSON.stringify({ schema: 'other/1', entries: [] }));
    assert.throws(() => appendEntry(dir, 'MSFT', entry()), /schema/);
  });
});

describe('recheck diff', () => {
  const newPack = () => {
    const p = j('data-pack.json');
    p.asOf = '2027-01-29';
    p.hash = 'sha256:new';
    const set = (key, value) => (p.facts.find((f) => f.key === key).value = value);
    set('gross_margin', 0.63); // kill criterion K1 trips
    set('price', 520); // +0.4%: not material
    set('fcf_yield', 0.031); // doubled: material
    set('roic', null); // newly missing
    set('short_interest', 0.012); // newly available
    set('last_report_filed', '2027-01-27'); // new filing
    return p;
  };

  test('finds material changes, gaps, new data, new filings and tripped kill criteria', () => {
    const d = diffPacks(entry(), newPack());
    assert.equal(d.samePack, false);
    assert.equal(d.newFiling, true);
    assert.deepEqual(d.material.map((c) => c.key).sort(), ['fcf_yield', 'gross_margin', 'last_report_filed']);
    assert.ok(d.changes.some((c) => c.key === 'price' && !c.material));
    assert.deepEqual(d.newlyMissing.map((c) => c.key), ['roic']);
    assert.deepEqual(d.newlyAvailable.map((c) => c.key), ['short_interest']);
    const k1 = d.killCriteria.find((k) => k.id === 'K1');
    assert.equal(k1.result, 'tripped');
    assert.equal(k1.current, 0.63);
    assert.equal(d.killCriteria.find((k) => k.id === 'K2').result, 'manual');
  });

  test('an unchanged pack says so', () => {
    const d = diffPacks(entry(), j('data-pack.json'));
    assert.equal(d.samePack, true);
    assert.equal(d.changes.length, 0);
    assert.equal(d.killCriteria[0].result, 'holding');
    assert.match(renderChanges(d, 'MSFT'), /identical to the last one/);
  });

  test('renders "what changed" with fact ids from the new pack', () => {
    const md = renderChanges(diffPacks(entry(), newPack()), 'MSFT');
    assert.match(md, /# What changed since the last pack: MSFT/);
    assert.match(md, /TRIPPED: Gross margin below 65% \(now 0\.63 \[F007\]\)/);
    assert.match(md, /Free cash flow yield: 1\.6% to 3\.1% \[F004\]/);
    assert.match(md, /A new 10-K or 10-Q has been filed/);
    assert.ok(!/\u2014/.test(md));
  });

  test('the diff never names the last verdict\'s label or option (it is the recheck lean)', () => {
    const d = diffPacks(entry(), newPack());
    assert.deepEqual(Object.keys(d.from).sort(), ['date', 'hash', 'packAsOf']);
    const md = renderChanges(d, 'MSFT');
    assert.ok(!/PROCEED WITH CONDITIONS|option B|on option/.test(md), md);
    assert.match(md, /Last council 2026-11-17 \(pack as of 2026-11-17\)/);
  });

  test('kill criteria with a missing fact are unknown, never assumed fine', () => {
    assert.equal(evalKill({ text: 't', fact: 'gross_margin', op: '<', value: 0.65 }, snapshotFacts({ facts: [] })).result, 'unknown');
  });
});
