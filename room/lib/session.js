// The one place the Room reads session files. Every format detail of the contract in
// skills/mosaic/references/live-room.md (core PR #2) is handled here, so a format change
// touches this file only. The page never reads files; it gets the object readSession returns.
//
// Card parsing mirrors core's scripts/lib/cards.mjs (same field names, same score syntax).
import fs from 'node:fs';
import path from 'node:path';

const FIELD = /^[ \t]*\**[ \t]*([A-Z][A-Z' ]{1,40}?)[ \t]*\**[ \t]*:[ \t]*(.*)$/;
const KNOWN = new Set([
  'SEAT', 'STANCE', 'OPTION SCORES', 'PILLAR SCORE', 'CONVICTION', 'EVIDENCE', 'RUIN RISK', 'DOOR', 'THE CALL', 'WHY', 'WHY TOO HARD',
  'THE RISK I SEE', "I'M WRONG IF", 'IM WRONG IF', 'QUESTION FOR THE INVESTOR', 'I DISAGREE MOST WITH', 'I CONCEDE', 'ON THE CRUXES',
  'MOVED', 'CONDITIONS FOR YES', 'VOTE', 'FINAL SCORE', 'FINAL PILLAR SCORE', 'AMENDMENT OR DISSENT', 'ONE LINE FOR THE INVESTOR', 'CONFIDENCE',
]);

/** Fields of one card as { NAME: "value plus continuation lines" }. */
export function cardFields(text) {
  const out = {};
  let cur = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(FIELD);
    if (m && KNOWN.has(m[1].trim().toUpperCase())) {
      cur = m[1].trim().toUpperCase();
      if (!(cur in out)) out[cur] = m[2].replace(/^\*+\s*/, '').trim();
      else cur = null;
    } else if (cur && line.trim()) out[cur] = `${out[cur]}\n${line.trim()}`.trim();
  }
  return out;
}

/** "A 6/10 · B 8/10", "[A] 6/10", "A: 6, B: 7" -> { A: 6, B: 8 }. Out-of-range values are dropped. */
export function parseOptionScores(s) {
  const out = {};
  for (const m of String(s || '').matchAll(/\[?\b([A-H])\b\]?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/g)) {
    const v = Number(m[2]);
    if (v >= 0 && v <= 10 && !(m[1] in out)) out[m[1]] = v;
  }
  return out;
}

const FACT_ID = /\bF\d{3,4}\b/g;
/** Fact ids cited in square brackets, in order of first appearance. */
export function factIds(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/\[([^\]\n]*\bF\d{3,4}\b[^\]\n]*)\]/g)) for (const id of m[1].match(FACT_ID) || []) if (!out.includes(id)) out.push(id);
  return out;
}

/** WHY points: "1. x\n2. y" -> ["x", "y"]. */
function points(v) {
  const pts = [];
  for (const l of String(v || '').split('\n').map((x) => x.trim()).filter(Boolean)) {
    if (/^(\d+[.)]|[-*])\s+/.test(l) || !pts.length) pts.push(l.replace(/^(\d+[.)]|[-*])\s+/, ''));
    else pts[pts.length - 1] += ` ${l}`;
  }
  return pts;
}

/** Parse one seat card. Absent fields are null; scores is {} when the seat abstained or gave none. */
export function parseCard(text) {
  const f = cardFields(text);
  const stance = f.STANCE ?? null;
  const optLine = f['OPTION SCORES'] ?? null;
  const abstain = /too hard/i.test(stance || '') || /^\s*(n\/?a|abstain|too hard)/i.test(optLine || '');
  return {
    stance,
    abstain,
    scores: abstain ? {} : parseOptionScores(optLine),
    call: f['THE CALL'] ?? null,
    why: points(f.WHY),
    risk: f['THE RISK I SEE'] ?? null,
    wrongIf: f["I'M WRONG IF"] ?? f['IM WRONG IF'] ?? null,
    question: f['QUESTION FOR THE INVESTOR'] ?? null,
    disagree: f['I DISAGREE MOST WITH'] ?? null,
    concede: f['I CONCEDE'] ?? null,
    moved: f.MOVED ?? null,
    conditions: f['CONDITIONS FOR YES'] ?? null,
    vote: f.VOTE ?? null,
    amendment: f['AMENDMENT OR DISSENT'] || null,
    oneLine: f['ONE LINE FOR THE INVESTOR'] ?? null,
    whyTooHard: f['WHY TOO HARD'] ?? null,
    factIds: factIds(text),
  };
}

/** Split a round file into seat cards, in file order. Chair sections and unknown headings are skipped. */
export function parseRound(md, resolve) {
  const text = String(md || '');
  const heads = [...text.matchAll(/^#{2,3}[ \t]+(.+?)[ \t]*$/gm)];
  const cards = [];
  const seen = new Set();
  heads.forEach((h, i) => {
    if (/chair/i.test(h[1])) return;
    const seat = resolve(h[1]);
    if (!seat || seen.has(seat)) return;
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    const body = text.slice(h.index + h[0].length, end).replace(/(\n\s*(-{3,}|\*{3,}))+\s*$/g, '').trim();
    if (!body) return;
    seen.add(seat);
    const card = parseCard(body);
    // "I DISAGREE MOST WITH: Burry. He reads..." -> answering burry, rebuttal "He reads..."
    const lead = card.disagree ? card.disagree.split(/[.;:,(]/)[0] : '';
    const answering = lead ? resolve(lead) : null;
    const rebuttal = answering && card.disagree ? card.disagree.slice(lead.length).replace(/^[.;:,]\s*/, '').trim() || null : card.disagree;
    cards.push({ seat, ...card, answering: answering && answering !== seat ? answering : null, rebuttal });
  });
  return cards;
}

/** JSON text -> { ok, value } or { ok: false, error }. Never throws. */
export function parseJson(text) {
  try {
    const value = JSON.parse(String(text).replace(/^﻿/, ''));
    return value && typeof value === 'object' ? { ok: true, value } : { ok: false, error: 'not a JSON object' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Check council.json has what the Room needs. Returns a list of problems (empty when usable). */
export function validateCouncil(c) {
  const p = [];
  if (!Array.isArray(c?.options) || !c.options.length) p.push('council.json has no options');
  else if (c.options.some((o) => !o || typeof o.id !== 'string' || !o.label)) p.push('council.json has an option without an id or label');
  if (!Array.isArray(c?.seats) || !c.seats.length) p.push('council.json has no seats');
  return p;
}

/** Keep only what the page uses from a data pack (series and news can be large). */
export function slimPack(pack) {
  if (!pack) return null;
  return {
    kind: pack.kind ?? null,
    symbol: pack.symbol ?? null,
    asOf: pack.asOf ?? null,
    coverage: pack.coverage ?? null,
    providers: Array.isArray(pack.providers) ? pack.providers.map(({ capability, source, status, asOf }) => ({ capability, source, status, asOf })) : [],
    facts: Array.isArray(pack.facts) ? pack.facts.filter((f) => f && f.id).map(({ id, key, label, value, unit, period, source, asOf, status }) => ({ id, key, label, value: value ?? null, unit, period, source, asOf, status })) : [],
  };
}

const JSON_FILES = { council: 'council.json', pack: 'data-pack.json', cruxes: 'cruxes.json', lean: 'lean.json', scores: 'scores.json', draft: 'draft.json', citations: 'citations.json', verdict: 'verdict.json' };

/**
 * Read a session folder. `cache` (a Map, optional) keeps the last good parse of each JSON
 * file, so a file caught half-written keeps its previous value instead of vanishing.
 * Returns the payload the page renders from.
 */
export function readSession(dir, { resolve, cache = new Map() } = {}) {
  const problems = [];
  const out = { dir, id: path.basename(dir), files: [], rounds: {}, problems };
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    problems.push({ file: dir, message: 'session folder not found' });
    return { ...out, council: null };
  }
  out.files = names.filter((n) => /\.(json|md)$/.test(n)).sort();
  for (const [k, file] of Object.entries(JSON_FILES)) {
    if (!names.includes(file)) {
      out[k] = null;
      cache.delete(file);
      continue;
    }
    let text = '';
    try {
      text = fs.readFileSync(path.join(dir, file), 'utf8');
    } catch (e) {
      problems.push({ file, message: `could not read: ${e.code || e.message}` });
    }
    const r = text.trim() ? parseJson(text) : { ok: false, error: 'empty file' };
    if (r.ok) {
      cache.set(file, r.value);
      out[k] = r.value;
    } else {
      problems.push({ file, message: `unreadable JSON (${r.error}); ${cache.has(file) ? 'showing the last good copy' : 'ignored until it is complete'}` });
      out[k] = cache.get(file) ?? null;
    }
  }
  if (out.council) {
    const bad = validateCouncil(out.council);
    if (bad.length) {
      for (const m of bad) problems.push({ file: 'council.json', message: m });
      out.council = null;
    }
  }
  out.pack = slimPack(out.pack);
  for (const n of names) {
    const m = n.match(/^round-(\d+)\.md$/);
    if (!m) continue;
    try {
      out.rounds[Number(m[1])] = parseRound(fs.readFileSync(path.join(dir, n), 'utf8'), resolve);
    } catch (e) {
      problems.push({ file: n, message: `could not read: ${e.code || e.message}` });
    }
  }
  if (out.lean && out.lean.option !== null && out.lean.option !== undefined && out.council && !out.council.options.some((o) => o.id === out.lean.option)) {
    problems.push({ file: 'lean.json', message: `lean option ${out.lean.option} is not one of the council's options` });
    out.lean = { ...out.lean, option: null };
  }
  if (out.scores && !Array.isArray(out.scores.scorecard)) out.scores = { ...out.scores, scorecard: [] };
  for (const cards of Object.values(out.rounds)) for (const c of cards) for (const [k, v] of Object.entries(c.scores)) if (!isNum(v)) delete c.scores[k];
  return out;
}

/** A cheap signature of a folder's files (name, size, mtime), to notice changes by polling. */
export function folderSignature(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => /\.(json|md)$/.test(n))
      .sort()
      .map((n) => {
        const s = fs.statSync(path.join(dir, n));
        return `${n}:${s.size}:${s.mtimeMs}`;
      })
      .join('|');
  } catch {
    return 'missing';
  }
}

/** The newest session folder (by council.json time) under a sessions directory, or null. */
export function latestSession(sessionsDir) {
  let best = null;
  try {
    for (const n of fs.readdirSync(sessionsDir)) {
      const f = path.join(sessionsDir, n, 'council.json');
      try {
        const t = fs.statSync(f).mtimeMs;
        if (!best || t > best.t) best = { dir: path.join(sessionsDir, n), t };
      } catch {
        /* not a session */
      }
    }
  } catch {
    return null;
  }
  return best?.dir ?? null;
}
