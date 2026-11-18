// Save a finished council to the thesis journal and list what is tracked. The file format,
// the path (journal/<KEY>.json) and the entry shape follow core's scripts/lib/journal.mjs
// (mosaic.journal/1), so the core CLI and the Room read and write the same files.
import fs from 'node:fs';
import path from 'node:path';
import { buildModel } from './model.js';

export const SCHEMA = 'mosaic.journal/1';
const DAY = 86_400_000;
const RECHECK_AFTER_REPORT_DAYS = 2; // core scripts/journal.config.json
const RECHECK_DEFAULT_DAYS = 90;

/** Journal file key: the ticker, or MACRO / PORTFOLIO. */
export function journalKey(council) {
  if (council?.ticker) return String(council.ticker).toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  if (council?.job === 'macro') return 'MACRO';
  if (council?.job === 'portfolio') return 'PORTFOLIO';
  return null;
}

export const journalFile = (dir, key) => path.join(dir, `${key}.json`);

function readDoc(file) {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    return d?.schema === SCHEMA ? d : null;
  } catch {
    return null;
  }
}

/** Is this session already in the journal? */
export function journalStatus(dir, council) {
  const key = journalKey(council);
  if (!dir || !key) return { available: Boolean(dir && key), saved: false, key };
  const doc = readDoc(journalFile(dir, key));
  return { available: true, saved: Boolean(doc?.entries?.some((e) => e.id === council.id)), key };
}

function nextRecheck(verdict, rawPack, now) {
  if (verdict?.recheck?.date) return verdict.recheck.date;
  const next = rawPack?.facts?.find((f) => f.key === 'next_report_expected')?.value;
  if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) return new Date(Date.parse(next) + RECHECK_AFTER_REPORT_DAYS * DAY).toISOString().slice(0, 10);
  return new Date(now() + RECHECK_DEFAULT_DAYS * DAY).toISOString().slice(0, 10);
}

/**
 * One journal entry, shaped like core's buildEntry. Option scores and the recommended option
 * come from the Room's own computation over the seat scores, so they match what the page shows.
 */
export function buildEntry(session, rawPack, opts = {}) {
  const now = opts.now || (() => Date.now());
  const { council, verdict, scores, lean } = session;
  if (!verdict) throw new Error('the council has no verdict yet');
  const model = buildModel(session, { roster: opts.roster || null, ...(opts.cfg ? { cfg: opts.cfg } : {}) });
  const optionScores = model.verdict.optionScores;
  const kill = (Array.isArray(verdict.kill_criteria) ? verdict.kill_criteria : verdict.kill_criteria ? [verdict.kill_criteria] : []).map((x, i) => (typeof x === 'string' ? { id: `K${i + 1}`, text: x } : { id: x.id || `K${i + 1}`, ...x }));
  const snapshot = {};
  for (const f of rawPack?.facts || []) snapshot[f.key] = { id: f.id, label: f.label, value: f.value, unit: f.unit, asOf: f.asOf, status: f.status };
  return {
    id: council.id || path.basename(session.dir || ''),
    date: new Date(now()).toISOString().slice(0, 10),
    session: session.dir || null,
    job: council.job || 'decision',
    mode: council.mode || 'full',
    decision: council.decision || null,
    options: council.options.map(({ id, label, kind, trigger }) => ({ id, label, kind: kind || 'act', ...(trigger ? { trigger } : {}) })),
    trigger: council.trigger || null,
    horizon: council.horizon || null,
    lean: lean ? { option: lean.option ?? null, reason: lean.reason ?? null } : null,
    seats: council.seats || [],
    recommended: model.verdict.rec,
    label: scores?.label ?? verdict.label,
    underlyingLabel: scores?.underlyingLabel ?? null,
    optionScores,
    confidence: scores?.confidence ?? null,
    spread: scores?.spread ?? null,
    evidence: scores?.evidence?.grade ?? null,
    leanPull: scores?.leanPull?.value ?? null,
    call: verdict.call || null,
    dissent: verdict.minority || null,
    premortem: verdict.premortem || [],
    kill_criteria: kill,
    conditions: verdict.conditions || [],
    recheck: { date: nextRecheck(verdict, rawPack, now), triggers: verdict.recheck?.triggers || [] },
    pack: rawPack ? { hash: rawPack.hash ?? null, asOf: rawPack.asOf ?? null, coverage: rawPack.coverage?.score ?? null, snapshot } : null,
  };
}

/** Append (or replace) the entry in journal/<KEY>.json, written atomically. Returns the document. */
export function appendEntry(dir, key, entry, { company = null, thesis = null } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = journalFile(dir, key);
  let doc = null;
  if (fs.existsSync(file)) {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (doc.schema !== SCHEMA) throw new Error(`${path.basename(file)} has schema ${doc.schema}, expected ${SCHEMA}`);
  } else doc = { schema: SCHEMA, key, ticker: /^(MACRO|PORTFOLIO)$/.test(key) ? null : key, company, thesis, status: 'active', created: entry.date, entries: [] };
  doc.entries = doc.entries.filter((e) => e.id !== entry.id);
  doc.entries.push(entry);
  doc.entries.sort((a, b) => a.date.localeCompare(b.date));
  doc.updated = entry.date;
  doc.company = company || doc.company;
  doc.thesis = thesis || doc.thesis;
  doc.next_recheck = doc.entries[doc.entries.length - 1].recheck?.date || null;
  doc.latest = { label: entry.label, recommended: entry.recommended, date: entry.date };
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return doc;
}

/** Save a session; reads the raw pack from disk for the snapshot. */
export function saveSession(dir, session, opts = {}) {
  const key = journalKey(session.council);
  if (!key) throw new Error('this council has no ticker, so it has no journal file');
  let rawPack = null;
  try {
    rawPack = JSON.parse(fs.readFileSync(path.join(session.dir, 'data-pack.json'), 'utf8'));
  } catch {
    rawPack = null;
  }
  const entry = buildEntry(session, rawPack, opts);
  const company = rawPack?.facts?.find((f) => f.key === 'company_name')?.value || null;
  return { key, doc: appendEntry(dir, key, entry, { company, thesis: session.council.thesis || null }) };
}

/** One row per tracked thesis, soonest re-check first (core's listJournal). */
export function listJournal(dir, today) {
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return names
    .map((f) => readDoc(path.join(dir, f)))
    .filter(Boolean)
    .map((d) => ({
      key: d.key,
      company: d.company,
      status: d.status,
      label: d.latest?.label ?? null,
      recommended: d.latest?.recommended ?? null,
      lastVerdict: d.latest?.date ?? null,
      nextRecheck: d.next_recheck ?? null,
      due: Boolean(d.next_recheck && today && d.next_recheck <= today && d.status === 'active'),
      entries: d.entries.length,
      latest: d.entries[d.entries.length - 1] ? { decision: d.entries[d.entries.length - 1].decision, call: d.entries[d.entries.length - 1].call, options: d.entries[d.entries.length - 1].options, optionScores: d.entries[d.entries.length - 1].optionScores } : null,
    }))
    .sort((a, b) => String(a.nextRecheck || '9999').localeCompare(String(b.nextRecheck || '9999')));
}
