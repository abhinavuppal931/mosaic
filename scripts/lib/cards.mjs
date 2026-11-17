// Parse the seat cards the Chair saves in round-N.md. The card format is defined in
// skills/mosaic/references/round-prompts.md; this is its single parser.

const FIELD = /^[ \t]*\**[ \t]*([A-Z][A-Z' ]{1,40}?)[ \t]*\**[ \t]*:[ \t]*(.*)$/;
const FACT_ID = /\bF\d{3,4}\b/g;

/** Split a round file into cards under "## <Seat>" headings; Chair sections are skipped. */
export function splitCards(md, resolve) {
  const heads = [...md.matchAll(/^#{2,3}[ \t]+(.+?)[ \t]*$/gm)];
  const cards = [];
  heads.forEach((h, i) => {
    if (/chair/i.test(h[1])) return;
    const seat = resolve(h[1]);
    if (!seat) return;
    const end = i + 1 < heads.length ? heads[i + 1].index : md.length;
    const text = md.slice(h.index + h[0].length, end).replace(/(\n\s*(-{3,}|\*{3,}))+\s*$/g, '').trim();
    if (text) cards.push({ seat, heading: h[1], text });
  });
  return cards;
}

/** Fields as an ordered list of { name, value, lines } (multi-line values keep their lines). */
export function fields(text) {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(FIELD);
    if (m && isKnown(m[1])) {
      cur = { name: m[1].trim().toUpperCase(), value: m[2].trim(), lines: [] };
      out.push(cur);
    } else if (cur && line.trim()) cur.lines.push(line.trim());
  }
  return out;
}

const KNOWN = [
  'SEAT', 'STANCE', 'OPTION SCORES', 'PILLAR SCORE', 'CONVICTION', 'EVIDENCE', 'RUIN RISK', 'DOOR', 'THE CALL', 'WHY', 'WHY TOO HARD',
  'THE RISK I SEE', "I'M WRONG IF", 'IM WRONG IF', 'QUESTION FOR THE INVESTOR', 'I DISAGREE MOST WITH', 'I CONCEDE', 'ON THE CRUXES',
  'MOVED', 'CONDITIONS FOR YES', 'VOTE', 'FINAL SCORE', 'FINAL PILLAR SCORE', 'AMENDMENT OR DISSENT', 'ONE LINE FOR THE INVESTOR', 'CONFIDENCE',
];
const isKnown = (n) => KNOWN.includes(n.trim().toUpperCase());

/**
 * Option scores, read tolerantly. Accepts "A 6/10 · B 8/10", "[A] 6/10", "A: 6, B: 7",
 * "A (full position): 7", "Option A - 7", "A=7", "A 7 out of 10". Scores outside 0 to 10 are ignored.
 */
export function parseOptionScores(s) {
  const out = {};
  const re = /(?:\boption\s+)?\[?\b([A-H])\b\]?(?:\s*\([^)]*\))?\s*[:=\-\u2013]?\s*(\d+(?:\.\d+)?)(?:\s*(?:\/\s*10|out of 10))?/gi;
  for (const m of String(s || '').matchAll(re)) {
    const id = m[1].toUpperCase();
    const v = Number(m[2]);
    if (v >= 0 && v <= 10 && !(id in out)) out[id] = v;
  }
  return out;
}

const num = (s, max) => {
  const m = String(s || '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = Number(m[1]);
  return v >= 0 && v <= max ? v : null;
};

/**
 * The first allowed word that appears as a whole word and is not negated ("not likely").
 * `aliases` maps other whole words to an allowed value (e.g. "unlikely" -> "possible").
 * Returns null when nothing matches, so the caller can flag the card.
 */
export function pickWord(s, words, aliases = {}) {
  const t = String(s || '').toLowerCase().replace(/[\u2010-\u2015]/g, '-');
  let best = null;
  const consider = (word, value) => {
    const re = new RegExp(`(^|[^a-z-])(not\\s+|no\\s+)?${word.replace(/[-]/g, '[- ]')}(?![a-z])`, 'g');
    for (const m of t.matchAll(re)) {
      if (m[2]) continue;
      const at = m.index + m[1].length;
      if (!best || at < best.at) best = { at, value };
    }
  };
  for (const w of words) consider(w, w);
  for (const [w, v] of Object.entries(aliases)) consider(w, v);
  return best ? best.value : null;
}

const RUIN_ALIASES = { unlikely: 'possible', 'not likely': 'possible', remote: 'possible', low: 'possible', no: 'none', zero: 'none' };

/** Parse one card into structured fields. Unknown or absent fields are null. */
export function parseCard(text) {
  const fs = fields(text);
  const get = (n) => fs.find((f) => f.name === n);
  const val = (n) => get(n)?.value ?? null;
  const stance = val('STANCE');
  const optLine = val('OPTION SCORES');
  const abstain = /too hard/i.test(stance || '') || /^\s*(n\/?a|abstain|too hard)/i.test(optLine || '');
  const why = get('WHY');
  const whyPoints = why ? splitPoints([why.value, ...why.lines].filter(Boolean)) : [];
  const vote = pickWord(val('VOTE'), ['endorse with amendment', 'endorse', 'dissent']);
  const parsedScores = abstain ? {} : parseOptionScores(optLine);
  return {
    stance,
    abstain,
    scores: parsedScores,
    scoresRaw: optLine,
    pillar: num(val('FINAL PILLAR SCORE') ?? val('PILLAR SCORE'), 10),
    conviction: num(val('CONVICTION') ?? val('CONFIDENCE'), 5),
    evidence: pickWord(val('EVIDENCE'), ['strong', 'adequate', 'thin'], { weak: 'thin', moderate: 'adequate' }),
    ruin: pickWord(val('RUIN RISK'), ['none', 'possible', 'likely'], RUIN_ALIASES),
    door: pickWord(val('DOOR'), ['one-way', 'two-way']),
    vote: vote === 'endorse with amendment' ? 'amend' : vote,
    voteText: val('VOTE'),
    ownLine: val('ONE LINE FOR THE INVESTOR'),
    amendment: val('AMENDMENT OR DISSENT') || null,
    finalScore: num(val('FINAL SCORE'), 10),
    moved: val('MOVED'),
    call: val('THE CALL'),
    wrongIf: val("I'M WRONG IF") ?? val('IM WRONG IF'),
    why: whyPoints,
    whyCited: whyPoints.filter((p) => factIds(p).length > 0).length,
    factIds: factIds(text),
  };
}

function splitPoints(lines) {
  const pts = [];
  for (const l of lines) {
    if (/^(\d+[.)]|[-*])\s+/.test(l) || !pts.length) pts.push(l.replace(/^(\d+[.)]|[-*])\s+/, ''));
    else pts[pts.length - 1] += ' ' + l;
  }
  return pts.filter((p) => p.trim());
}

/** Every fact id cited inside square brackets, e.g. [F014] or [F014, F021]. */
export function factIds(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\[([^\]\n]*\bF\d{3,4}\b[^\]\n]*)\]/g)) for (const id of m[1].match(FACT_ID) || []) out.add(id);
  return [...out];
}

/** Parse every card in a round file: { seatKey: card }. */
export function parseRound(md, resolve) {
  const out = {};
  for (const c of splitCards(md, resolve)) out[c.seat] = { ...parseCard(c.text), text: c.text };
  return out;
}
