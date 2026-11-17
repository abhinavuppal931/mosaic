// How the Room shows each seat: display name, short name, a plain-English role and a portrait.
// The plugin roster (skills/mosaic/roster.json, owned by the brains build) is the source of seat
// keys; this table only adds what the Room needs to draw them. Unknown seats fall back to the
// roster's own fields and an initials avatar, so a new seat never breaks the page.

export const SEATS = {
  buffett: { name: 'Warren Buffett', short: 'Buffett', role: 'Owner economics', img: 'buffett.jpg' },
  munger: { name: 'Charlie Munger', short: 'Munger', role: 'Folly check', img: 'munger.jpg' },
  damodaran: { name: 'Aswath Damodaran', short: 'Damodaran', role: 'Value vs price', img: 'damodaran.jpg' },
  marks: { name: 'Howard Marks', short: 'Marks', role: 'Risk and cycle', img: 'marks.jpg' },
  taleb: { name: 'Nassim Taleb', short: 'Taleb', role: 'Ruin guard', img: 'taleb.jpg' },
  druckenmiller: { name: 'Stan Druckenmiller', short: 'Druckenmiller', role: 'Macro and timing', img: 'druckenmiller.jpg' },
  burry: { name: 'Michael Burry', short: 'Burry', role: 'Bear guard', img: 'burry.jpg' },
  lynch: { name: 'Peter Lynch', short: 'Lynch', role: 'Growth story', img: 'lynch.jpg' },
  ackman: { name: 'Bill Ackman', short: 'Ackman', role: 'Catalysts and governance', img: 'ackman.jpg' },
  kantesaria: { name: 'Dev Kantesaria', short: 'Kantesaria', role: 'Pricing power', img: 'kantesaria.jpg' },
  sleep: { name: 'Nick Sleep', short: 'Sleep', role: 'Long runway', img: 'sleep.jpg' },
  mauboussin: { name: 'Michael Mauboussin', short: 'Mauboussin', role: 'Base rates and sizing', img: 'mauboussin.jpg' },
  tomlee: { name: 'Tom Lee', short: 'Tom Lee', role: 'Big trends', img: 'tomlee.jpg' },
};

const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

/** Display info for a seat key. `roster` is the optional plugin roster ({ seats: [...] }). */
export function seatInfo(key, roster = null) {
  const own = SEATS[key];
  const r = roster?.seats?.find?.((s) => s.key === key) || null;
  const name = own?.name || r?.name || String(key);
  return {
    key,
    name,
    short: own?.short || r?.short || name.split(' ').slice(-1)[0],
    role: own?.role || r?.dimension || r?.role || '',
    img: own?.img ? `/img/${own.img}` : null,
    initials: initialsOf(name),
  };
}

const norm = (s) => String(s || '').toLowerCase().replace(/\(.*$/, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * A resolver from any seat label in a heading or card ("Buffett", "Warren Buffett",
 * "BUFFETT (Moat...)", "buffett") to a seat key. Mirrors the core resolver in scripts/lib/roster.mjs.
 */
export function seatResolver(roster = null, extraKeys = []) {
  const index = new Map();
  const add = (label, key) => {
    const n = norm(label);
    if (n && !index.has(n)) index.set(n, key);
  };
  for (const [key, s] of Object.entries(SEATS)) for (const l of [key, s.short, s.name, s.name.split(' ').slice(-1)[0]]) add(l, key);
  for (const s of roster?.seats || []) for (const l of [s.key, s.short, s.name, s.name?.split(' ').slice(-1)[0]]) add(l, s.key);
  for (const k of extraKeys) add(k, k);
  return (label) => {
    const n = norm(label);
    if (!n) return null;
    if (index.has(n)) return index.get(n);
    for (const [k, v] of index) if (n.startsWith(k + ' ') || n.endsWith(' ' + k)) return v;
    return null;
  };
}
