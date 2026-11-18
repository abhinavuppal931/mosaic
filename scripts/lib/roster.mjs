// Read the seat roster (skills/mosaic/roster.json, owned by the brains build) and resolve
// seat names in cards and headings to seat keys.
import fs from 'node:fs';

/**
 * Expected shape (extra fields are ignored):
 * { "board": "ask"|"auto"|"default", "default": ["buffett", ...],
 *   "seats": [{ "key", "name", "short", "slug", "dimension", "guard"?: "ruin"|"bear" }] }
 */
export function loadRoster(file) {
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(r.seats)) throw new Error(`roster at ${file} has no seats[]`);
  return r;
}

const norm = (s) => String(s || '').toLowerCase().replace(/\(.*$/, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/** A resolver from any seat label ("Buffett", "warren buffett", "BUFFETT (Moat...)", "buffett") to a key. */
export function seatResolver(roster) {
  const index = new Map();
  for (const s of roster.seats) {
    for (const label of [s.key, s.short, s.name, s.name?.split(' ').slice(-1)[0]]) {
      const n = norm(label);
      if (n && !index.has(n)) index.set(n, s.key);
    }
  }
  return (label) => {
    const n = norm(label);
    if (!n) return null;
    if (index.has(n)) return index.get(n);
    for (const [k, v] of index) if (n.startsWith(k + ' ') || n.endsWith(' ' + k)) return v;
    return null;
  };
}

export function seatByKey(roster, key) {
  return roster.seats.find((s) => s.key === key) || null;
}
