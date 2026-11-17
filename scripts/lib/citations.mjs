// Citation checks for a council session. Adapted from Roast Room's check_quotes.py
// (MIT, Copyright (c) 2026 AI Automation Society; see NOTICE): quotes attributed to a
// source id must appear verbatim in the seat's brain. Mosaic adds fact-id checks against
// the data pack and a soft warning for numbers that carry no fact id.
import fs from 'node:fs';
import path from 'node:path';
import { splitCards, parseCard } from './cards.mjs';

export function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/'\s+(t|s|re|ll|ve|d|m)\b/g, "'$1")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const QUOTE = /["“]([^"“”\n]{20,400})["”][^\n"]{0,40}?[([](S\d{3,4})/g;
const FACT_IN_BRACKETS = /\[([^\]\n]*\bF\d{3,4}\b[^\]\n]*)\]/g;
const NUMBERISH = /(\$\s?\d|\d+(?:\.\d+)?\s?(?:%|x\b|bn\b|billion|million|trillion|B\b|M\b|T\b|bps\b|pts?\b))/i;

function readDirMd(dir) {
  if (!fs.existsSync(dir)) return null;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
}

/**
 * @param {{
 *   session: string, brainsDir: string, roster: { seats: {key:string, slug:string}[] },
 *   resolve: (label:string)=>string|null,
 * }} o
 */
export function checkSession({ session, brainsDir, roster, resolve }) {
  const read = (f) => (fs.existsSync(path.join(session, f)) ? fs.readFileSync(path.join(session, f), 'utf8') : null);
  const packText = read('data-pack.json');
  const pack = packText ? JSON.parse(packText) : null;
  const facts = new Map((pack?.facts || []).map((f) => [f.id, f]));
  const errors = [];
  const warnings = [];
  const stats = { factCitations: 0, factIdsUnknown: 0, factIdsMissingData: 0, quotesVerified: 0, quotesInternal: 0, quotesUnverified: 0, uncitedNumbers: 0 };

  if (!pack) errors.push({ type: 'no_pack', file: 'data-pack.json', detail: 'data-pack.json not found: fact ids cannot be checked' });

  const brainCache = new Map();
  const brainOf = (seat) => {
    if (!brainCache.has(seat)) {
      const slug = roster.seats.find((s) => s.key === seat)?.slug;
      const text = slug ? readDirMd(path.join(brainsDir, slug)) : null;
      brainCache.set(seat, text === null ? null : { all: norm(text), sources: new Set(text.match(/\bS\d{3,4}\b/g) || []) });
    }
    return brainCache.get(seat);
  };
  const allBrains = () => {
    const texts = roster.seats.map((s) => brainOf(s.key)).filter(Boolean);
    return texts.length ? texts.map((b) => b.all).join(' ') : null;
  };

  const files = fs
    .readdirSync(session)
    .filter((f) => /^round-\d+\.md$/.test(f))
    .sort()
    .concat(['draft-resolution.md', 'verdict.md'].filter((f) => fs.existsSync(path.join(session, f))));
  const brief = norm(read('brief.md') || '');
  let seen = '';

  for (const file of files) {
    const text = read(file);
    // Fact ids
    for (const m of text.matchAll(FACT_IN_BRACKETS)) {
      for (const id of m[1].match(/\bF\d{3,4}\b/g) || []) {
        stats.factCitations += 1;
        if (!pack) continue;
        const f = facts.get(id);
        if (!f) {
          stats.factIdsUnknown += 1;
          errors.push({ type: 'unknown_fact', file, id, detail: `${id} is not in data-pack.json` });
        } else if (f.value === null) {
          stats.factIdsMissingData += 1;
          warnings.push({ type: 'missing_fact_cited', file, id, detail: `${id} (${f.label}) is MISSING in the pack; a claim cannot rest on it` });
        }
      }
    }
    // Quotes: per seat inside round files, any brain elsewhere.
    const sections = /^round-/.test(file) ? splitCards(text, resolve).map((c) => ({ seat: c.seat, text: c.text })) : [{ seat: null, text }];
    if (/^round-/.test(file)) {
      const chair = text.split(/^#{2,3}[ \t]+.*chair.*$/im).slice(1).join('\n');
      if (chair) sections.push({ seat: null, text: chair });
    }
    for (const sec of sections) {
      for (const m of sec.text.matchAll(QUOTE)) {
        const q = norm(m[1]);
        if (q.split(' ').length < 6) continue;
        const sid = m[2];
        const brain = sec.seat ? brainOf(sec.seat) : null;
        const hay = sec.seat ? brain?.all : allBrains();
        if (hay && (hay.includes(q) || hay.replace(/ /g, '').includes(q.replace(/ /g, '')))) {
          stats.quotesVerified += 1;
          if (sec.seat && brain && !brain.sources.has(sid)) warnings.push({ type: 'source_id_unknown', file, seat: sec.seat, id: sid, detail: `quote verified but ${sid} is not listed in the seat's brain` });
        } else if (seen.includes(q) || brief.includes(q)) {
          stats.quotesInternal += 1;
        } else {
          stats.quotesUnverified += 1;
          errors.push({ type: 'unverified_quote', file, seat: sec.seat, id: sid, quote: m[1].slice(0, 200), detail: hay ? 'not found verbatim in the brain' : 'brain not available to check' });
        }
      }
      // Numbers in WHY points without a fact id (soft).
      if (sec.seat) {
        const card = parseCard(sec.text);
        for (const p of card.why) {
          if (NUMBERISH.test(p) && !/\bF\d{3,4}\b/.test(p) && !/outside the pack/i.test(p)) {
            stats.uncitedNumbers += 1;
            warnings.push({ type: 'uncited_number', file, seat: sec.seat, detail: p.slice(0, 160) });
          }
        }
      }
    }
    seen += ' ' + norm(text);
  }

  return { schema: 'mosaic.citations/1', ok: errors.length === 0, stats, errors, warnings, files };
}
