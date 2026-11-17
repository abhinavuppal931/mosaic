// Thesis journal: one JSON file per ticker (journal/<TICKER>.json) holding every verdict on it,
// with a snapshot of the pack's facts so a recheck can say exactly what changed.
import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA = 'mosaic.journal/1';
export const DEFAULT_CONFIG = JSON.parse(fs.readFileSync(new URL('../journal.config.json', import.meta.url), 'utf8'));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const DAY = 86_400_000;

/** Journal file key for a council: the ticker, or MACRO / PORTFOLIO. */
export function journalKey(council) {
  if (council.ticker) return String(council.ticker).toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  if (council.job === 'macro') return 'MACRO';
  if (council.job === 'portfolio') return 'PORTFOLIO';
  throw new Error('council has no ticker and is not a macro or portfolio job');
}

export function journalPath(dir, key) {
  return path.join(dir, `${key}.json`);
}

/** Every fact by its stable key, so ids can change between packs without breaking diffs. */
export function snapshotFacts(pack) {
  const out = {};
  for (const f of pack?.facts || []) out[f.key] = { id: f.id, label: f.label, value: f.value, unit: f.unit, asOf: f.asOf, status: f.status };
  return out;
}

/** Decide the next re-check date: the verdict's date, else just after the next expected report, else a default. */
export function nextRecheck({ verdict, pack, now, cfg = DEFAULT_CONFIG }) {
  if (verdict?.recheck?.date) return verdict.recheck.date;
  const next = pack?.facts?.find((f) => f.key === 'next_report_expected')?.value;
  if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) return new Date(Date.parse(next) + cfg.recheckFallbackDaysAfterReport * DAY).toISOString().slice(0, 10);
  return new Date(now() + cfg.recheckDefaultDays * DAY).toISOString().slice(0, 10);
}

/** Build one journal entry from a finished session. */
export function buildEntry({ council, verdict, scores, pack, lean, sessionPath, now = () => Date.now() }) {
  if (!verdict) throw new Error('verdict.json is required to journal a session');
  return {
    id: council.id || path.basename(sessionPath || ''),
    date: new Date(now()).toISOString().slice(0, 10),
    session: sessionPath || null,
    job: council.job || 'decision',
    mode: council.mode || 'full',
    decision: council.decision || null,
    options: (council.options || []).map(({ id, label, kind, trigger }) => ({ id, label, kind: kind || 'act', ...(trigger ? { trigger } : {}) })),
    trigger: council.trigger || null,
    horizon: council.horizon || null,
    lean: lean ? { option: lean.option ?? null, reason: lean.reason ?? null } : null,
    seats: council.seats || [],
    recommended: scores?.recommended ?? verdict.recommended ?? null,
    label: scores?.label ?? verdict.label,
    underlyingLabel: scores?.underlyingLabel ?? null,
    optionScores: Object.fromEntries((scores?.options || []).map((o) => [o.id, o.score])),
    confidence: scores?.confidence ?? null,
    spread: scores?.spread ?? null,
    evidence: scores?.evidence?.grade ?? null,
    leanPull: scores?.leanPull?.value ?? null,
    call: verdict.call || null,
    dissent: verdict.minority || null,
    premortem: verdict.premortem || [],
    kill_criteria: normalizeKill(verdict.kill_criteria),
    conditions: verdict.conditions || [],
    recheck: { date: nextRecheck({ verdict, pack, now }), triggers: verdict.recheck?.triggers || [] },
    pack: pack ? { hash: pack.hash, asOf: pack.asOf, coverage: pack.coverage?.score ?? null, snapshot: snapshotFacts(pack) } : null,
  };
}

function normalizeKill(k) {
  const list = Array.isArray(k) ? k : k ? [k] : [];
  return list.map((x, i) => (typeof x === 'string' ? { id: `K${i + 1}`, text: x } : { id: x.id || `K${i + 1}`, ...x }));
}

/** Append an entry to journal/<KEY>.json, creating it if needed. Returns the document. */
export function appendEntry(dir, key, entry, { company, thesis } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const file = journalPath(dir, key);
  const doc = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : { schema: SCHEMA, key, ticker: /^(MACRO|PORTFOLIO)$/.test(key) ? null : key, company: company || null, thesis: thesis || null, status: 'active', created: entry.date, entries: [] };
  if (doc.schema !== SCHEMA) throw new Error(`${file} has schema ${doc.schema}, expected ${SCHEMA}`);
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

export function readJournal(dir, key) {
  const file = journalPath(dir, key);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** One row per tracked thesis, soonest re-check first. */
export function listJournal(dir, today) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((d) => d.schema === SCHEMA)
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
    }))
    .sort((a, b) => String(a.nextRecheck || '9999').localeCompare(String(b.nextRecheck || '9999')));
}

function isMaterial(unit, before, after, cfg) {
  const m = cfg.material;
  const abs = Math.abs(after - before);
  const rel = before !== 0 ? Math.abs(after / before - 1) : Infinity;
  const absT = m.absolute[unit];
  if (absT === undefined) return rel >= m.relative;
  return abs >= absT || (rel >= m.relative && abs >= absT * (m.relativeFloorShare ?? 0));
}

/** Evaluate one machine-checkable kill criterion against a pack snapshot. */
export function evalKill(k, snap) {
  if (!k.fact || !k.op || k.value === undefined) return { ...k, result: 'manual', detail: 'no machine check; the Chair checks it against the new pack' };
  const f = snap[k.fact];
  if (!f || f.value === null || !isNum(f.value)) return { ...k, result: 'unknown', current: null, detail: `${k.fact} is missing in the new pack` };
  const v = f.value;
  const hit = k.op === '<' ? v < k.value : k.op === '<=' ? v <= k.value : k.op === '>' ? v > k.value : k.op === '>=' ? v >= k.value : null;
  if (hit === null) return { ...k, result: 'unknown', current: v, detail: `unsupported op ${k.op}` };
  return { ...k, result: hit ? 'tripped' : 'holding', current: v, factId: f.id };
}

/**
 * What changed between the last journal entry's pack and a new pack.
 * @returns {{ from: object, to: object, newFiling: boolean, changes: object[], material: object[], newlyMissing: object[], newlyAvailable: object[], killCriteria: object[] }}
 */
export function diffPacks(entry, newPack, cfg = DEFAULT_CONFIG) {
  const before = entry?.pack?.snapshot || {};
  const after = snapshotFacts(newPack);
  const changes = [];
  const newlyMissing = [];
  const newlyAvailable = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (!a || !b) continue;
    if (a.value !== null && b.value === null) {
      newlyMissing.push({ key, label: b.label, before: a.value, id: b.id });
      continue;
    }
    if (a.value === null && b.value !== null) {
      newlyAvailable.push({ key, label: b.label, after: b.value, unit: b.unit, id: b.id });
      continue;
    }
    if (a.value === b.value) continue;
    if (isNum(a.value) && isNum(b.value)) {
      const material = isMaterial(b.unit, a.value, b.value, cfg);
      changes.push({ key, label: b.label, unit: b.unit, before: a.value, after: b.value, delta: b.value - a.value, relative: a.value !== 0 ? b.value / a.value - 1 : null, material, id: b.id, asOfBefore: a.asOf, asOfAfter: b.asOf });
    } else {
      changes.push({ key, label: b.label, unit: b.unit, before: a.value, after: b.value, material: true, id: b.id });
    }
  }
  changes.sort((x, y) => Number(y.material) - Number(x.material) || Math.abs(y.relative ?? 0) - Math.abs(x.relative ?? 0));
  return {
    schema: 'mosaic.changes/1',
    from: { date: entry?.date ?? null, packAsOf: entry?.pack?.asOf ?? null, hash: entry?.pack?.hash ?? null, label: entry?.label ?? null, recommended: entry?.recommended ?? null },
    to: { packAsOf: newPack.asOf, hash: newPack.hash },
    samePack: entry?.pack?.hash === newPack.hash,
    newFiling: Boolean(before.last_report_filed && after.last_report_filed && before.last_report_filed.value !== after.last_report_filed.value),
    changes,
    material: changes.filter((c) => c.material),
    newlyMissing,
    newlyAvailable,
    killCriteria: (entry?.kill_criteria || []).map((k) => evalKill(k, after)),
  };
}

const fmt = (v, unit) => {
  if (!isNum(v)) return String(v);
  if (unit === 'ratio') return `${(v * 100).toFixed(1)}%`;
  if (unit === 'percent') return `${v.toFixed(2)}%`;
  if (unit === 'x') return `${v.toFixed(1)}x`;
  if (unit === 'USD' && Math.abs(v) >= 1e6) return `${(v / 1e9).toFixed(2)}B USD`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

/** "What changed since the last pack", for the recheck council's brief. */
export function renderChanges(d, key) {
  const out = [`# What changed since the last pack: ${key}`, ''];
  out.push(`Last verdict ${d.from.date ?? '-'}: ${d.from.label ?? '-'} on option ${d.from.recommended ?? '-'} (pack as of ${d.from.packAsOf ?? '-'}). New pack as of ${d.to.packAsOf}.`, '');
  if (d.samePack) out.push('The new pack is identical to the last one: nothing has changed in the data.', '');
  if (d.newFiling) out.push('A new 10-K or 10-Q has been filed since the last pack.', '');
  out.push('## Kill criteria', '');
  if (!d.killCriteria.length) out.push('- None recorded.');
  for (const k of d.killCriteria) out.push(`- ${k.result.toUpperCase()}: ${k.text}${k.current !== undefined && k.current !== null ? ` (now ${k.current}${k.factId ? ` [${k.factId}]` : ''})` : ''}${k.detail ? `. ${k.detail}` : ''}`);
  out.push('', '## Material changes', '');
  if (!d.material.length) out.push('- None above the thresholds.');
  for (const c of d.material) out.push(`- ${c.label}: ${fmt(c.before, c.unit)} to ${fmt(c.after, c.unit)} [${c.id}]`);
  if (d.newlyMissing.length) {
    out.push('', '## Now missing', '');
    for (const c of d.newlyMissing) out.push(`- ${c.label} (was ${fmt(c.before)}) [${c.id}]`);
  }
  if (d.newlyAvailable.length) {
    out.push('', '## Newly available', '');
    for (const c of d.newlyAvailable) out.push(`- ${c.label}: ${fmt(c.after, c.unit)} [${c.id}]`);
  }
  const minor = d.changes.filter((c) => !c.material).length;
  if (minor) out.push('', `${minor} smaller changes are listed in changes.json.`);
  return out.join('\n') + '\n';
}
