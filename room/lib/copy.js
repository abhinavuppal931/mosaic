// Every string the Room builds from data goes through here, so the copy rules in
// docs/design/ROOM-DESIGN.md live in one place: plain English, one date format
// ("17 November 2026"), no fact ids, no abbreviations, no em dashes.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth'];

export const DISCLAIMER = 'Mosaic grades how a decision was made. It is not investment advice.';
export const FOOT_SIM = 'The investors are simulations built from their public work. Not affiliated with or endorsed by them.';
export const FOOT_GRADE = 'Grades a decision process. Not investment advice.';

const ymd = (v) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

/** "2026-11-17" or an ISO time -> "17 November 2026". Unparseable input returns ''. */
export function fmtDate(v) {
  const p = ymd(v);
  return p && p.m >= 1 && p.m <= 12 ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : '';
}

/** "November 2029" for a date plus whole years. */
export function monthYear(v, plusYears = 0) {
  const p = ymd(v);
  return p ? `${MONTHS[p.m - 1]} ${p.y + plusYears}` : '';
}

/** Whole days from date a to date b (both YYYY-MM-DD). */
export function daysBetween(a, b) {
  const pa = ymd(a), pb = ymd(b);
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** Replace every YYYY-MM-DD inside free text with the house date format. */
export const datesInText = (s) => String(s || '').replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (m) => fmtDate(m) || m);

export const word = (n) => (Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
export const ordinal = (n) => (Number.isInteger(n) && n >= 1 && n <= ORDINALS.length ? ORDINALS[n - 1] : `number ${n}`);
export const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const lowerFirst = (s) => (s && !/^[A-Z]{2}/.test(s) ? s[0].toLowerCase() + s.slice(1) : s || '');

/** "A", "A and B", "A, B and C". */
export function joinNames(list) {
  const a = list.filter(Boolean);
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

/** "PROCEED WITH CONDITIONS" -> "Proceed with conditions". */
export const labelCase = (s) => capFirst(String(s || '').trim().toLowerCase());

/** One decimal, the way every score in the Room is shown. */
export const f1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : '');

/**
 * Clean seat or Chair text for display: drop fact ids ([F002], [F002, F003]), brain source tags
 * ((Economic castle, S001) or (S001)), em and en dashes, and tidy the spacing they leave.
 */
export function clean(text) {
  return String(text || '')
    .replace(/\s*\[[^\]\n]*\bF\d{3,4}\b[^\]\n]*\]/g, '')
    .replace(/\s*\((?:[^()\n]*,\s*)?S\d{3,4}\)/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** A clean sentence: cleaned, first letter capitalised, ending punctuation kept. */
export const sentence = (text) => capFirst(clean(text));

// Plain names for fact labels that carry abbreviations in the data pack.
const FACT_LABELS = {
  eps_diluted: 'Earnings per share',
  sbc: 'Stock-based pay',
  rd_expense: 'Research and development spending',
  capex: 'Capital spending',
  pe: 'Price to earnings',
  pb: 'Price to book value',
  ps: 'Price to sales',
  ev_ebit: 'Company value to operating profit',
  ev_ebitda: 'Company value to cash earnings',
  fcf_yield: 'Free cash flow yield',
  fcf_yield_after_sbc: 'Free cash flow yield after stock-based pay',
  ev_fcf: 'Company value to free cash flow',
  roic: 'Return on invested capital',
  roic_avg: 'Return on invested capital, 10-year average',
  capex_to_revenue: 'Capital spending as a share of sales',
  rd_to_revenue: 'Research spending as a share of sales',
  sbc_to_revenue: 'Stock-based pay as a share of sales',
  fcf_conversion: 'Share of profit that turns into free cash',
  revenue_cagr_5y: 'Sales growth a year, last 5 years',
  revenue_cagr_10y: 'Sales growth a year, last 9 years',
  eps_cagr_5y: 'Earnings per share growth a year, last 5 years',
  fcf_cagr_5y: 'Free cash flow growth a year, last 5 years',
  revenue_growth_yoy: 'Sales growth, latest year',
  peg: 'Price to earnings, divided by growth',
  dcf_value_bear: 'Cash flow value per share, cautious case',
  dcf_value_base: 'Cash flow value per share, middle case',
  dcf_value_bull: 'Cash flow value per share, hopeful case',
  price_to_dcf_base: 'Price against the middle-case value',
  implied_fcf_growth: 'Growth the price assumes',
  high_52w: 'Highest close in the last year',
  low_52w: 'Lowest close in the last year',
  macro_hy_oas: 'Extra yield on risky company bonds',
};

/** A short, plain label for a fact (no parenthetical explanations). */
export function factLabel(f) {
  if (!f) return '';
  if (FACT_LABELS[f.key]) return FACT_LABELS[f.key];
  return clean(String(f.label || f.key || '').replace(/\s*\([^)]*\)\s*$/, ''));
}

const trim0 = (s) => s.replace(/\.0$/, '');
function money(v) {
  const a = Math.abs(v);
  const sign = v < 0 ? 'minus ' : '';
  if (a >= 1e12) return `${sign}$${trim0((a / 1e12).toFixed(1))} trillion`;
  if (a >= 1e9) return `${sign}$${trim0((a / 1e9).toFixed(1))} billion`;
  if (a >= 1e6) return `${sign}$${trim0((a / 1e6).toFixed(1))} million`;
  return `${sign}$${Math.round(a).toLocaleString('en-US')}`;
}
const pct = (p) => `${trim0((Math.round(p * 10) / 10).toFixed(1))}%`;

/** A fact's value in plain words: 0.724 ratio -> "72.4%", 3.4e11 USD -> "$340 billion". */
export function factValue(f) {
  if (!f || f.value === null || f.value === undefined || f.value === '') return 'Not found';
  const v = f.value;
  if (typeof v !== 'number') return f.unit === 'date' ? fmtDate(v) || String(v) : clean(String(v));
  switch (f.unit) {
    case 'ratio': return pct(v * 100);
    case 'percent': return pct(v);
    case 'percentage points': return `${trim0(v.toFixed(2).replace(/0$/, ''))} points`;
    case 'x': return `${trim0(v.toFixed(1))} times`;
    case 'USD': return money(v);
    case 'USD/share': return `$${v.toFixed(2)}`;
    case 'shares': return v >= 1e9 ? `${trim0((v / 1e9).toFixed(2))} billion` : v >= 1e6 ? `${trim0((v / 1e6).toFixed(1))} million` : v.toLocaleString('en-US');
    default: return Number.isInteger(v) ? v.toLocaleString('en-US') : trim0(v.toFixed(2));
  }
}

const PROVIDERS = {
  'sec-edgar': 'Company filings from the SEC',
  yahoo: 'Share prices from Yahoo Finance',
  treasury: 'Interest rates from the US Treasury',
  nyfed: 'The policy rate from the New York Fed',
  bls: 'Inflation and jobs from the Bureau of Labor Statistics',
  fred: 'Economic data from the St. Louis Fed',
  finnhub: 'Market data from Finnhub',
  fmp: 'Market data from Financial Modeling Prep',
  massive: 'Market data from Massive',
  mosaic: 'Figures Mosaic worked out from the data',
};
export const providerName = (id) => PROVIDERS[id] || capFirst(String(id || 'Another source'));

const CAPABILITIES = {
  profile: 'company profile', quote: 'share price', priceHistory: 'price history', financials: 'company financials',
  insiderTrades: 'insider trades', holdings: 'big holders', news: 'news', estimates: 'analyst estimates',
  benchmark: 'market benchmark', macro: 'economic data', ratios: 'ratios',
};
export const capabilityName = (c) => CAPABILITIES[String(c).split(':')[0]] || String(c).split(':')[0];

/** "Leans wait · 7" */
export const leanChip = (short, score) => `Leans ${short} · ${score}`;

/** "Three agree, three partly agree, one disagrees." from agreement counts (core's words as keys). */
export function voteCounts(c) {
  const agrees = c.agrees || 0, partly = c['partly agrees'] || 0, disagrees = c.disagrees || 0, abstains = c.abstains || 0, none = c.none || 0;
  const total = agrees + partly + disagrees;
  const parts = [];
  if (total && agrees === total) parts.push(`all ${word(total)} who scored it agree`);
  else {
    if (agrees) parts.push(`${word(agrees)} ${agrees === 1 ? 'agrees' : 'agree'}`);
    if (partly) parts.push(`${word(partly)} partly ${partly === 1 ? 'agrees' : 'agree'}`);
    if (disagrees) parts.push(`${word(disagrees)} ${disagrees === 1 ? 'disagrees' : 'disagree'}`);
  }
  if (abstains) parts.push(`${word(abstains)} called it too hard`);
  if (none) parts.push(`${word(none)} did not score it`);
  if (total && agrees === total && !abstains && !none) return `All ${word(total)} agree.`;
  return parts.length ? `${capFirst(parts.join(', '))}.` : '';
}

/** "one and a half times", "twice". */
export function timesWord(r) {
  if (Math.abs(r - 1.5) < 0.01) return 'one and a half times';
  if (Math.abs(r - 2) < 0.01) return 'twice';
  if (Math.abs(r - 3) < 0.01) return 'three times';
  return `${trim0(r.toFixed(1))} times`;
}

/** Years in a horizon string: "3 years", "three-year hold", "5y". */
export function horizonYears(h) {
  const s = String(h || '').toLowerCase();
  const d = s.match(/(\d+)\s*-?\s*(years?|y\b)/);
  if (d) return Number(d[1]);
  const w = s.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)[\s-]+years?\b/);
  return w ? WORDS.indexOf(w[1]) : null;
}

const OPS = { '<': 'Under', '<=': 'At or under', '>': 'Over', '>=': 'At or over' };
export const opWord = (op) => OPS[op] || '';

/* ---------- The investor spotlight: a seat's own words, retold ---------- */

/** Pronouns for a seat. The Room's own seat table is all men; any other seat reads "they". */
export const pronouns = (known) => (known
  ? { he: 'he', his: 'his', him: 'him', is: 'is', has: 'has', was: 'was', does: 'does', s: true }
  : { he: 'they', his: 'their', him: 'them', is: 'are', has: 'have', was: 'were', does: 'do', s: false });

const MODALS = new Set(['would', 'will', 'can', 'cannot', 'could', 'should', 'must', 'might', 'may', 'did', 'had', 'shall']);
const ADVERBS = new Set(['still', 'also', 'only', 'never', 'always', 'just', 'really', 'now', 'often', 'rarely', 'usually', 'simply', 'even', 'already', 'certainly', 'probably']);
const PAST = new Set(['thought', 'said', 'saw', 'held', 'kept', 'made', 'took', 'got', 'bought', 'sold', 'found', 'felt', 'knew', 'ran', 'put', 'set', 'cut', 'let', 'meant', 'left', 'lost', 'met', 'paid', 'spent', 'told', 'won', 'wrote', 'came', 'went', 'gave', 'began', 'chose', 'fell', 'grew', 'heard', 'led', 'rose', 'stood', 'understood', 'read', 'drew', 'built', 'brought', 'caught', 'taught', 'sought']);

/** "value" -> "values", "watch" -> "watches", "buy" -> "buys", "carry" -> "carries". */
function third(verb) {
  if (/(s|sh|ch|x|z|o)$/.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

/**
 * Retell a seat's first-person line in the third person, as the board does: "I value it" ->
 * "he values it", "my story" -> "his story", "If I am wrong" -> "If he is wrong". Modal and past
 * verbs keep their form; "you" (the investor) is left alone.
 */
export function thirdPerson(text, p = pronouns(true)) {
  const cap = (w, like) => (/^[A-Z]/.test(like) ? capFirst(w) : w);
  let s = String(text || '');
  s = s.replace(/\bI'm\b/g, `${p.he} ${p.is}`).replace(/\bI've\b/g, `${p.he} ${p.has}`).replace(/\bI'd\b/g, `${p.he} would`).replace(/\bI'll\b/g, `${p.he} will`);
  s = s.replace(/\bI don't\b/g, `${p.he} ${p.s ? "doesn't" : "don't"}`);
  s = s.replace(/\bI((?:\s+(?:[a-z]+))+)/g, (all, rest) => {
    const words = rest.trim().split(/\s+/);
    let i = 0;
    while (i < words.length - 1 && ADVERBS.has(words[i])) i += 1;
    const w = words[i];
    let v = w;
    if (w === 'am') v = p.is;
    else if (w === 'was') v = p.was;
    else if (w === 'have') v = p.has;
    else if (w === 'do') v = p.does;
    else if (p.s && !MODALS.has(w) && !PAST.has(w) && !/ed$/.test(w) && /^[a-z]+$/.test(w)) v = third(w);
    words[i] = v;
    return ` ${p.he} ${words.join(' ')}`.replace(/^ /, '');
  });
  s = s.replace(/\bmyself\b/gi, (m) => cap(p.s ? 'himself' : 'themselves', m)).replace(/\bmy\b/gi, (m) => cap(p.his, m)).replace(/\bmine\b/gi, (m) => cap(p.s ? 'his' : 'theirs', m)).replace(/\bme\b/g, p.him);
  // A sentence that now opens with the pronoun gets its capital back.
  s = s.replace(/(^|[.!?]\s+)(he|they|his|their)\b/g, (m, a, b) => a + capFirst(b));
  return s;
}

/**
 * Spell out the option letters a call opens with: "C. A wonderful business" -> "Wait for $150.
 * A wonderful business"; "A or B. ..." -> "Buy all now or start small. ...".
 */
export function spellOptions(text, options) {
  const label = (id) => options.find((o) => o.id === id)?.label;
  return String(text || '').replace(/^\s*([A-H])((?:\s*(?:,|or|and)\s*[A-H]\b)*)(?=[.,;:])/, (all, first, rest) => {
    if (!label(first)) return all;
    const more = rest.replace(/\b([A-H])\b/g, (m, id) => (label(id) ? lowerFirst(label(id)) : m));
    return capFirst(label(first)) + more;
  });
}
