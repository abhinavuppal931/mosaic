// Turn a parsed session (lib/session.js) into everything the page shows. Pure functions,
// shared by the server, the journal and the tests. Every number comes from the seats' option
// scores in the round files; nothing here is typed in by hand.
import { seatInfo, SEATS } from './seats.js';
import * as C from './copy.js';

export const STEPS = ['Brief', 'Data', 'Round 1, blind', 'Round 2, debate', 'Round 3, final scores', 'Vote', 'Verdict'];
/** The seven chairs in table.jpg, as [left %, top %] of the stage (from the A3-Live board). */
export const CHAIRS = [[9.6, 34], [23.3, 30], [36.6, 28], [50.1, 26.5], [63.5, 28], [77.1, 30], [90.6, 34]];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r1 = (v) => Math.round(v * 10) / 10;

/** Medallion positions for n seats: the board's chairs for seven, spread along the same arc otherwise. */
export function seatPositions(n) {
  if (n === CHAIRS.length) return CHAIRS.map((p) => [...p]);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = t * (CHAIRS.length - 1);
    const a = Math.floor(x), b = Math.min(a + 1, CHAIRS.length - 1), f = x - a;
    return [r1((CHAIRS[a][0] + (CHAIRS[b][0] - CHAIRS[a][0]) * f) * 10) / 10, r1((CHAIRS[a][1] + (CHAIRS[b][1] - CHAIRS[a][1]) * f) * 10) / 10];
  });
}

/**
 * The short name of an option for chips and the heatmap ("Leans wait · 7"): an explicit `short`
 * if the council gives one, "wait" for a wait option, else the label up to its first comma.
 */
export const optShort = (o) => {
  if (!o) return '';
  if (o.short) return C.lowerFirst(o.short);
  if (o.kind === 'wait') return 'wait';
  return C.lowerFirst(String(o.label).split(',')[0].trim());
};

/**
 * The thresholds the Room needs from core's scripts/scoring.config.json. The server reads that
 * file and passes it in; this copy is only the fallback for running the Room without core.
 */
export const DEFAULT_CONFIG = { agreement: { disagreeAtOrBelow: 4 } };

/**
 * The jury: seats that count toward the option scores. Like core's scoringSet, a seat counts
 * only when it did not abstain and scored every option, so every option is judged by the same seats.
 */
export function jury(options, state) {
  return Object.entries(state)
    .filter(([, st]) => st && !st.abstain && options.every((o) => isNum(st.scores?.[o.id])))
    .map(([seat]) => seat);
}

/**
 * Weighted mean per option over the jury, rounded to one decimal exactly like core's
 * scripts/lib/scoring.mjs. `state` is { seatKey: { scores, abstain } }.
 */
export function councilScores(options, state, weights = {}) {
  const seats = jury(options, state);
  return options.map((o) => {
    let ws = 0, sum = 0;
    const vals = [];
    for (const seat of seats) {
      const st = state[seat];
      const w = weights[seat]?.weight ?? (isNum(weights[seat]) ? weights[seat] : 1);
      ws += w;
      sum += w * st.scores[o.id];
      vals.push(st.scores[o.id]);
    }
    return { id: o.id, score: ws ? r1(sum / ws) : null, spread: vals.length ? Math.max(...vals) - Math.min(...vals) : null };
  });
}

/** Highest score; ties go to the smaller spread, then the earlier option (core's rule). */
export function pickRecommended(scored) {
  const ok = scored.filter((o) => isNum(o.score));
  ok.sort((a, b) => b.score - a.score || (a.spread ?? 99) - (b.spread ?? 99) || a.id.localeCompare(b.id));
  return ok[0]?.id ?? null;
}

/** The best option other than `rec`. */
export function runnerUp(scored, rec) {
  return pickRecommended(scored.filter((o) => o.id !== rec));
}

/** A seat's top option. On a tie that includes the recommended option, the recommended one wins. */
export function seatTop(scores, options, rec = null) {
  const vals = options.map((o) => scores?.[o.id]).filter(isNum);
  if (!vals.length) return null;
  const best = Math.max(...vals);
  const tied = options.filter((o) => scores[o.id] === best).map((o) => o.id);
  return rec && tied.includes(rec) ? rec : tied[0];
}

/**
 * Where a seat stands on the recommended option, in core's words (scores.json
 * scorecard[].agreement): "agrees" when its top-scored option is the recommended one (ties
 * count), "disagrees" when it scores the recommended option at or below the configured
 * threshold, else "partly agrees"; "abstains" for TOO HARD; null with no card or no score on
 * the recommended option. Derived from scores, never from the VOTE words.
 */
export function agreementOf(st, rec, cfg = DEFAULT_CONFIG) {
  if (!st) return null;
  if (st.abstain) return 'abstains';
  const scores = st.scores || {};
  if (!rec || !isNum(scores[rec])) return null;
  const top = Math.max(...Object.values(scores).filter(isNum));
  if (scores[rec] === top) return 'agrees';
  if (scores[rec] <= cfg.agreement.disagreeAtOrBelow) return 'disagrees';
  return 'partly agrees';
}
export const AGREEMENTS = ['agrees', 'partly agrees', 'disagrees', 'abstains'];
export const AGREEMENT_TEXT = { agrees: 'Agrees', 'partly agrees': 'Partly agrees', disagrees: 'Disagrees', abstains: 'Too hard to call' };
/** CSS class for each agreement (null: no score on the recommended option). */
export const agreementClass = (a) => ({ agrees: 'agrees', 'partly agrees': 'partly', disagrees: 'disagrees', abstains: 'abstain' })[a] || 'none';
/** Read an agreement value written elsewhere: exact core words, or close variants. */
export const normAgreement = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase().replace(/[_-]+/g, ' ').trim();
  if (/^partly/.test(s)) return 'partly agrees';
  if (/^disagree/.test(s)) return 'disagrees';
  if (/^abstain/.test(s)) return 'abstains';
  if (/^agree/.test(s)) return 'agrees';
  return `unknown: ${v}`;
};

/** Heat level 0 to 4 for a score: the fill is a function of the score only. */
export const heatLevel = (v) => (!isNum(v) ? null : v >= 8 ? 4 : v >= 7 ? 3 : v >= 6 ? 2 : v >= 4 ? 1 : 0);

const roundNums = (rounds) => Object.keys(rounds || {}).map(Number).filter((n) => rounds[n]?.length).sort((a, b) => a - b);

/** Seat state after the given point: every round before `round`, plus cards 0..index of `round`. */
export function stateAt(rounds, round = Infinity, index = Infinity) {
  const st = {};
  for (const n of roundNums(rounds)) {
    if (n > round) break;
    rounds[n].forEach((c, i) => {
      if (n === round && i > index) return;
      if (c.abstain) st[c.seat] = { scores: {}, abstain: true, round: n };
      else if (Object.keys(c.scores || {}).length) st[c.seat] = { scores: { ...c.scores }, abstain: false, round: n };
    });
  }
  return st;
}

/** Facts in the pack: found ones first (the evidence ticks), then missing ones. */
export function evidence(pack) {
  const facts = pack?.facts || [];
  const isFound = (f) => f.value !== null && f.value !== undefined && f.value !== '' && !['missing', 'error'].includes(f.status);
  const found = facts.filter(isFound);
  const missing = facts.filter((f) => !isFound(f));
  const byCap = pack?.coverage?.byCapability || {};
  const core = pack?.coverage?.core || Object.keys(byCap);
  const notConnected = [...new Set(core.filter((c) => ['missing', 'error'].includes(byCap[c])).map(C.capabilityName))];
  const share = facts.length ? found.length / facts.length : 0;
  const plural = notConnected.length > 1 || (notConnected.length === 1 && /s$/.test(notConnected[0]) && notConnected[0] !== 'news');
  const ncText = notConnected.length ? `${C.capFirst(C.joinNames(notConnected))} ${plural ? 'were' : 'was'} not connected.` : '';
  const nc = ncText ? ` ${ncText}` : '';
  return {
    found: found.length,
    total: facts.length,
    word: !facts.length ? 'None' : share >= 0.85 ? 'Strong' : share >= 0.6 ? 'Adequate' : 'Thin',
    note: facts.length ? `${found.length} of ${facts.length} facts found.${nc}` : 'No data pack yet.',
    notConnectedText: ncText,
    notConnected,
    foundFacts: found.map((f) => factView(f)),
    missingFacts: missing.map((f) => factView(f)),
  };
}

function factView(f) {
  const date = C.fmtDate(f.asOf);
  return { id: f.id, label: C.factLabel(f), value: C.factValue(f), source: f.source ? C.providerName(f.source) : '', date, title: [f.source ? C.providerName(f.source) : '', date ? `as of ${date}` : ''].filter(Boolean).join(', ') };
}

/** The sources strip: one plain line per provider, newest date each. */
export function sourceLines(pack) {
  const live = (pack?.providers || []).filter((p) => p.source && !['missing', 'error'].includes(p.status));
  const lines = [];
  const quote = live.find((p) => p.capability === 'quote');
  if (quote?.asOf) lines.push(`Share price at the ${C.fmtDate(quote.asOf)} close`);
  const bySource = new Map();
  for (const p of live) {
    if (p.capability === 'quote' || p.capability === 'priceHistory' || p.capability === 'benchmark') continue;
    const prev = bySource.get(p.source);
    if (!prev || String(p.asOf || '') > String(prev)) bySource.set(p.source, p.asOf || prev || '');
  }
  for (const [src, asOf] of bySource) lines.push(asOf ? `${C.providerName(src)}, latest ${C.fmtDate(asOf)}` : C.providerName(src));
  return lines;
}

function chipsFor(text, card, factsById, max = 3) {
  const ids = [...new Set([...(text ? (String(text).match(/\bF\d{3,4}\b/g) || []) : []), ...(card?.factIds || [])])];
  const out = [];
  for (const id of ids) {
    const f = factsById.get(id);
    if (!f || f.value === null || f.value === undefined) continue;
    const v = factView(f);
    out.push({ label: v.label.split(',')[0], value: v.value, text: `${v.label} ${v.value}`, title: v.title });
    if (out.length >= max) break;
  }
  return out;
}

/** What a seat says on the speech card, by round. Raw text (fact ids intact) for chips. */
function sayRaw(card, round) {
  if (card.abstain) return card.whyTooHard || 'Too hard to call from this seat.';
  if (round === 1) return card.why[0] || card.call || '';
  if (round === 2) return card.rebuttal || card.concede || card.call || '';
  return card.amendment || card.oneLine || '';
}

/** How a card moved the seat's scores against its previous card. */
function moveOf(prev, card, options) {
  if (card.abstain) return { speech: 'Too hard to call', turn: 'called it too hard' };
  if (!prev || prev.abstain || !Object.keys(card.scores).length) return null;
  let best = null;
  for (const o of options) {
    const a = prev.scores[o.id], b = card.scores[o.id];
    if (!isNum(a) || !isNum(b) || a === b) continue;
    if (!best || Math.abs(b - a) > Math.abs(best.b - best.a)) best = { o, a, b };
  }
  if (!best) {
    const t = seatTop(card.scores, options);
    const o = options.find((x) => x.id === t);
    return { speech: `Kept ${optShort(o)} at ${card.scores[t]}`, turn: `kept ${optShort(o)} at ${card.scores[t]}` };
  }
  const up = best.b > best.a;
  return { speech: `${up ? 'Raised' : 'Lowered'} ${optShort(best.o)} from ${best.a} to ${best.b}`, turn: `${up ? 'raised' : 'lowered'} ${optShort(best.o)} to ${best.b}` };
}

function prevCardState(rounds, seat, round) {
  let st = null;
  for (const n of roundNums(rounds)) {
    if (n >= round) break;
    const c = rounds[n].find((x) => x.seat === seat);
    if (c && (c.abstain || Object.keys(c.scores).length)) st = { scores: c.scores, abstain: c.abstain };
  }
  return st;
}

const roundComplete = (rounds, n, seats) => seats.every((s) => (rounds[n] || []).some((c) => c.seat === s));

/** The ordered beats of the live view: the brief, the data, each card, then the vote. */
export function beatsOf(s) {
  const beats = [{ mode: 'brief', step: 0 }];
  if (s.pack) beats.push({ mode: 'data', step: 1 });
  for (const n of roundNums(s.rounds)) s.rounds[n].forEach((c, i) => beats.push({ mode: 'card', step: Math.min(n + 1, 4), round: n, index: i, seat: c.seat }));
  const last = roundNums(s.rounds).slice(-1)[0];
  if (last && (roundComplete(s.rounds, 3, s.council.seats) || (s.citations && roundComplete(s.rounds, last, s.council.seats)))) beats.push({ mode: 'vote', step: 5 });
  return beats;
}

function context(s, roster, cfg = DEFAULT_CONFIG) {
  const council = s.council;
  const seats = council.seats.map((k) => ({ ...seatInfo(k, roster), weight: council.weights?.[k]?.weight ?? (isNum(council.weights?.[k]) ? council.weights[k] : 1) }));
  const pos = seatPositions(seats.length);
  seats.forEach((x, i) => (x.pos = pos[i]));
  const options = council.options.map((o) => ({ id: o.id, label: o.label, short: optShort(o), kind: o.kind || 'act' }));
  const factsById = new Map((s.pack?.facts || []).map((f) => [f.id, f]));
  const info = (k) => seats.find((x) => x.key === k) || seatInfo(k, roster);
  return { s, council, seats, options, factsById, info, cfg, recheck: Boolean(council.recheckOf), roundsTotal: council.mode === 'quick' ? 2 : 3, ev: evidence(s.pack) };
}

function nextText(ctx, beat, beats, bi) {
  const { s, council } = ctx;
  if (beat.mode === 'brief') return s.pack ? 'Round 1 comes next' : 'The data comes next';
  if (beat.mode === 'data') return 'Round 1 comes next';
  if (beat.mode === 'vote') return 'The verdict comes next';
  const nb = beats[bi + 1];
  if (nb && nb.mode === 'card' && nb.round === beat.round) return `${ctx.info(nb.seat).name} speaks next`;
  const spoken = new Set(s.rounds[beat.round].slice(0, beat.index + 1).map((c) => c.seat));
  // Mid-round the Room cannot know whom the Chair calls next, so it says how many are left.
  const waiting = council.seats.filter((k) => !spoken.has(k));
  if (waiting.length === 1) return `${ctx.info(waiting[0]).name} speaks next`;
  if (waiting.length) return `${C.capFirst(C.word(waiting.length))} still to speak`;
  return beat.round < ctx.roundsTotal ? `Round ${beat.round + 1} comes next` : 'The verdict comes next';
}

function stepText(ctx, beat) {
  if (beat.mode === 'brief') return 'The brief';
  if (beat.mode === 'data') return 'The data';
  if (beat.mode === 'vote') return 'The vote';
  return `Round ${beat.round} of ${ctx.roundsTotal}, ${['blind', 'debate', 'final scores'][beat.round - 1] || 'more scores'}`;
}

function leanCard(ctx, totals, revealed) {
  const { s, options, recheck } = ctx;
  if (!s.lean || !revealed) {
    return recheck
      ? { state: 'sealed', label: 'The last verdict', title: 'The last verdict stays sealed for now', body: 'This is a re-check. The council scores the first round without knowing what it decided last time, to keep it honest.' }
      : { state: 'sealed', label: 'Your lean', title: 'Your lean stays sealed for now', body: 'The council scores the first round without knowing your view, to keep it honest.' };
  }
  if (s.lean.option === null || s.lean.option === undefined) return { state: 'none', label: 'Your lean', title: 'You did not share a lean', body: 'So there was nothing to sway the council.' };
  const o = options.find((x) => x.id === s.lean.option);
  const ranked = totals.filter((t) => isNum(t.score)).sort((a, b) => b.score - a.score);
  const rank = ranked.findIndex((t) => t.id === o.id) + 1;
  const now = totals.find((t) => t.id === o.id)?.score;
  const before = s.rounds[1] ? councilScores(options, stateAt(s.rounds, 1), s.council.weights).find((t) => t.id === o.id)?.score : null;
  const shared = recheck ? 'it was shown' : 'your view was shared';
  let body = recheck ? 'The first round was scored without knowing the last verdict, to keep it honest.' : 'The first round was scored without knowing your view, to keep it honest.';
  if (isNum(before) && isNum(now) && roundNums(s.rounds).some((n) => n >= 2)) {
    const d = r1(now - before);
    body += d === 0 ? ` Since ${shared}, its score has not moved.` : ` Since ${shared}, that choice ${d > 0 ? 'gained' : 'lost'} ${C.f1(Math.abs(d))}.`;
  }
  const rankText = rank && isNum(now) ? ` The council ranks it ${C.ordinal(rank)} of ${C.word(ranked.length)} now, at ${C.f1(now)}.` : '';
  return {
    state: 'revealed',
    label: recheck ? 'The last verdict, revealed this round' : 'Your lean, revealed this round',
    title: recheck ? `Last time the council backed “${o.label}”.${rankText}` : `You leaned toward “${o.label}”.${rankText.replace(' now,', ',')}`,
    body,
  };
}

function cruxCard(ctx) {
  const c = ctx.s.cruxes?.cruxes?.[0];
  if (!c?.question) return null;
  return {
    question: C.sentence(c.question),
    sides: (c.sides || []).filter((x) => x?.position).map((x) => ({ position: C.sentence(x.position).replace(/\.$/, ''), seats: (x.seats || []).map((k) => ctx.info(k)), names: C.joinNames((x.seats || []).map((k) => ctx.info(k).short)) })),
  };
}

/** The full live-view state for one beat. */
export function liveBeat(ctx, beats, bi) {
  const { s, council, seats, options, factsById, info, ev } = ctx;
  const beat = beats[bi];
  const last = bi === beats.length - 1;
  const st = beat.mode === 'card' ? stateAt(s.rounds, beat.round, beat.index) : beat.mode === 'vote' ? stateAt(s.rounds) : {};
  const totals = councilScores(options, st, council.weights);
  const best = pickRecommended(totals);
  const speaker = beat.mode === 'card' ? beat.seat : null;
  const card = beat.mode === 'card' ? s.rounds[beat.round][beat.index] : null;

  let speech;
  if (card) {
    const raw = sayRaw(card, beat.round);
    const mv = beat.round === 1 ? null : moveOf(prevCardState(s.rounds, card.seat, beat.round), card, options);
    speech = {
      chair: false,
      name: info(card.seat).name,
      context: beat.round === 1 ? 'opening, before hearing your view' : beat.round === 2 ? (card.answering ? `answering ${info(card.answering).name}` : 'in the debate') : "on the council's draft",
      move: card.abstain ? 'Too hard to call' : beat.round === 1 ? 'First scores, before your view' : mv?.speech || '',
      say: C.sentence(raw),
      chips: chipsFor(raw, card, factsById),
    };
  } else if (beat.mode === 'brief') {
    speech = { chair: true, name: 'The Chair', context: 'reading the brief', move: `${C.capFirst(C.word(seats.length))} investors at the table`, say: C.sentence(council.decision || council.title || ''), chips: options.map((o) => ({ text: o.label, title: '' })) };
  } else if (beat.mode === 'data') {
    speech = { chair: true, name: 'The Chair', context: 'checking the data', move: `${ev.found} of ${ev.total} facts found`, say: `Found ${ev.found} of ${ev.total} facts for the council to use.${ev.notConnectedText ? ` ${ev.notConnectedText}` : ''}`, chips: [] };
  } else {
    speech = { chair: true, name: 'The Chair', context: 'counting the votes', move: 'Final scores are in', say: 'Every investor has given final scores. The Chair is writing the verdict.', chips: [] };
  }

  const seatStates = seats.map((x) => {
    const ss = st[x.key];
    const top = ss && !ss.abstain ? seatTop(ss.scores, options) : null;
    const o = options.find((y) => y.id === top);
    return { key: x.key, live: x.key === speaker, lean: ss?.abstain ? 'Too hard to call' : o ? C.leanChip(o.short, ss.scores[top]) : 'Waiting' };
  });

  const heat = options.map((o) => ({
    id: o.id,
    label: C.capFirst(o.short),
    cells: seats.map((x) => {
      const ss = st[x.key];
      const v = ss && !ss.abstain ? ss.scores[o.id] : null;
      const top = ss && !ss.abstain ? seatTop(ss.scores, options) : null;
      return { key: x.key, v: isNum(v) ? v : null, level: heatLevel(v), top: top === o.id, title: isNum(v) ? `${x.short} scored ${o.short} ${v} out of 10` : `${x.short} has not scored ${o.short} yet` };
    }),
  }));

  // Earlier this round: the cards before this one in the same round (or the last round, at the vote).
  let pool = [];
  let roundShown = beat.round;
  if (beat.mode === 'card') pool = s.rounds[beat.round].slice(0, beat.index).map((c) => ({ c, n: beat.round }));
  else if (beat.mode === 'vote') {
    roundShown = roundNums(s.rounds).slice(-1)[0];
    pool = s.rounds[roundShown].map((c) => ({ c, n: roundShown }));
  }
  const turns = pool.slice(-2).map(({ c, n }) => {
    const mv = n === 1 ? null : moveOf(prevCardState(s.rounds, c.seat, n), c, options);
    const tag = c.abstain ? null : n === 1 ? ['Risk', c.risk] : n === 2 ? ['Concedes', c.concede] : c.amendment ? ['For you', c.oneLine] : null;
    return { key: c.seat, name: info(c.seat).name, img: info(c.seat).img, initials: info(c.seat).initials, move: n === 1 ? 'opening scores' : mv?.turn || '', text: C.sentence(sayRaw(c, n)), tag: tag && tag[1] ? tag[0] : null, tagText: tag && tag[1] ? C.sentence(tag[1]) : '' };
  });

  // The lean (in a re-check, the last verdict) is revealed with Round 2, never during Round 1.
  const revealed = Boolean(s.lean) && (beat.mode === 'vote' || (beat.round ?? 0) >= 2);
  return {
    mode: beat.mode,
    step: beat.step,
    stepText: stepText(ctx, beat),
    next: nextText(ctx, beat, beats, bi),
    speaker,
    speech,
    seats: seatStates,
    heat,
    totals: totals.map((t) => ({ id: t.id, label: C.capFirst(options.find((o) => o.id === t.id).short), v: isNum(t.score) ? C.f1(t.score) : null, best: t.id === best })),
    earlier: { count: pool.length, turns, empty: beat.mode === 'brief' || beat.mode === 'data' ? 'The council has not spoken yet.' : 'This investor opens the round.' },
    crux: last || (beat.round ?? 0) >= 2 || beat.mode === 'vote' ? cruxCard(ctx) : null,
    lean: leanCard(ctx, totals, revealed),
  };
}

function unitedNote(recO, lo, hi, n, unscored) {
  if (!n) return `No investor scored “${recO.label}”.`;
  const range = lo === hi ? (unscored.length ? `Every investor who scored “${recO.label}” gave it ${lo}.` : `Every investor scored “${recO.label}” ${lo}.`) : `Scores for “${recO.label}” ranged from ${lo} to ${hi}.`;
  if (!unscored.length) return range;
  return `${range} ${C.joinNames(unscored.map((x) => x.short))} did not score this option.`;
}

/* ---------- The investor spotlight (B6) ---------- */

/** "Endorse with amendment" -> "amend". The VOTE words only name the stance; the colour stays the score-derived agreement. */
export function stanceOf(vote) {
  const v = String(vote || '').toLowerCase();
  if (!v.trim()) return null;
  if (/dissent|against|reject|oppose/.test(v)) return 'dissent';
  if (/amend|condition/.test(v)) return 'amend';
  if (/endorse|support|back|yes|for\b/.test(v)) return 'endorse';
  return null;
}
export const STANCE_TEXT = { endorse: 'Backs the plan', amend: 'With a condition', dissent: 'Against the plan' };

const timesText = (r) => (Math.abs(r - 2) < 0.01 ? 'twice' : `${String(Math.round(r * 100) / 100)} times`);
/** "The valuation specialist; the call turns on..." -> "the valuation specialist" (only a noun phrase reads after "as"). */
const asReason = (reason) => {
  const r = C.lowerFirst(C.clean(reason || '').split(/[;.,]/)[0].trim());
  return /^(the|a|an)\s/.test(r) ? `, as ${r}` : '';
};

/** One summary row: the final score (dot), round 1 (ring, joined by a line when it moved) and the council (tick). */
export function dotRow(label, fin, start, council, opts = {}) {
  const moved = isNum(start) && isNum(fin) && start !== fin;
  return {
    label, v: isNum(fin) ? String(fin) : '', fin, start: moved ? start : null, moved, council, councilText: C.f1(council),
    lo: moved ? Math.min(start, fin) : null, hi: moved ? Math.max(start, fin) : null, strong: Boolean(opts.strong),
    aria: `${opts.who} scored ${label} ${fin} out of 10${moved ? `, ${fin > start ? 'up' : 'down'} from ${start} in round 1` : ''}. The council scored ${C.f1(council)}.`,
  };
}

/**
 * Everything the investor spotlight shows for each seat, from the round cards, the cruxes and the
 * verdict: the stance, the summary dot rows against the council, the case, the moves and each round.
 */
export function spotlight(ctx, { final, scored, rec, agreement }) {
  const { s, council, seats, options, factsById, info } = ctx;
  const rounds = roundNums(s.rounds);
  const last = rounds[rounds.length - 1];
  const score = (id) => scored.find((x) => x.id === id)?.score;
  const jurySize = jury(options, final).length;
  const minW = Math.min(...seats.map((y) => y.weight));
  const heavier = seats.filter((x) => x.weight > minW);
  const crux = s.cruxes?.cruxes?.[0]?.question ? C.sentence(s.cruxes.cruxes[0].question) : '';
  const amendments = Array.isArray(s.verdict?.amendments) ? s.verdict.amendments : null;
  const recO = options.find((o) => o.id === rec);
  const hasVotes = seats.some((x) => stanceOf(s.rounds[last]?.find((c) => c.seat === x.key)?.vote));
  const fact = (id) => {
    const f = factsById.get(id);
    return f && f.value !== null && f.value !== undefined ? { label: C.factLabel(f), value: C.factValue(f), title: factView(f).title } : null;
  };
  const factsIn = (raw) => [...new Set(String(raw || '').match(/\bF\d{3,4}\b/g) || [])].map(fact).filter(Boolean);

  const panels = seats.map((x, i) => {
    const p = C.pronouns(Boolean(SEATS[x.key]));
    const P = { He: C.capFirst(p.he), His: C.capFirst(p.his) };
    const tell = (t) => C.capFirst(C.thirdPerson(C.sentence(t), p));
    const cards = rounds.map((n) => ({ n, card: s.rounds[n].find((c) => c.seat === x.key) || null })).filter((r) => r.card);
    const first = cards[0]?.card || null;
    const lastCard = cards[cards.length - 1]?.card || null;
    const st = final[x.key];
    const abstain = Boolean(!st || st.abstain);
    const a = agreement[x.key];
    const kind = abstain ? null : stanceOf(s.rounds[last]?.find((c) => c.seat === x.key)?.vote);
    const stance = abstain ? 'Too hard to call' : kind ? STANCE_TEXT[kind] : a ? AGREEMENT_TEXT[a] : 'No vote';
    const startSt = stateAt(s.rounds, rounds[0])[x.key];
    const start = startSt && !startSt.abstain ? startSt.scores : {};
    const fin = !abstain ? st.scores : {};
    const top = !abstain ? seatTop(fin, options, rec) : null;
    const topStart = Object.keys(start).length ? seatTop(start, options, rec) : null;
    const topO = options.find((o) => o.id === top);

    let bridge = '';
    const condition = kind === 'amend' ? ', with his condition'.replace('his', p.his) : '';
    if (abstain) bridge = `${P.He} called it too hard and did not score the choices.`;
    else if (kind === 'dissent') bridge = `${P.His} top score is ${topO.label}, and ${p.he} voted against the plan in the final round.`;
    else if (kind && top === rec) bridge = `${topO.label} is ${p.his} top score too, and ${p.he} backed the plan in the final round${condition}.`;
    else if (kind) bridge = `${P.His} top score is ${top === topStart ? 'still ' : ''}${topO.label}, but ${p.he} backed ${recO.label} in the final round${condition}.`;
    else if (top === rec) bridge = `${topO.label} is ${p.his} top score, the same as the council’s pick.`;
    else bridge = `${P.His} top score is ${topO.label}. The council picked ${recO.label}.`;

    let cond = null;
    const amendText = lastCard?.amendment ? tell(lastCard.amendment) : '';
    if (kind === 'amend' && amendText) {
      const listed = amendments?.find((m) => m.seat === x.key);
      cond = { kind: 'amend', label: `The condition ${p.he} asked for`, text: amendText, state: amendments ? (listed?.adopted ? 'Adopted by the council' : 'Not adopted') : '', adopted: Boolean(listed?.adopted) };
    } else if (kind === 'dissent' && amendText) cond = { kind: 'dissent', label: `Why ${p.he} voted against`, text: amendText };

    const rows = abstain ? [] : options.map((o) => dotRow(o.label, fin[o.id], start[o.id], score(o.id), { strong: o.id === top, who: x.short }));
    const hasMoves = rows.some((r) => r.moved);

    let councilNote;
    if (heavier.includes(x)) councilNote = `${P.His} score counts ${timesText(x.weight / minW)} in the council average${asReason(council.weights?.[x.key]?.reason)}.`;
    else if (heavier.length === 1) councilNote = `The council score is a weighted average of the ${C.word(jurySize)} final scores. ${heavier[0].short}’s counts ${timesText(heavier[0].weight / minW)}${asReason(council.weights?.[heavier[0].key]?.reason)}.`;
    else if (heavier.length > 1) councilNote = `The council score is a weighted average of the ${C.word(jurySize)} final scores. Scores from ${C.joinNames(heavier.map((y) => y.short))} count more.`;
    else councilNote = `The council score is the average of the ${C.word(jurySize)} final scores.`;

    // Where the seat changed its mind: every option that moved between one round and the next.
    const moves = [];
    for (let k = 1; k < rounds.length; k += 1) {
      const a0 = stateAt(s.rounds, rounds[k - 1])[x.key], b0 = stateAt(s.rounds, rounds[k])[x.key];
      if (!a0 || !b0 || a0.abstain || b0.abstain) continue;
      const card = s.rounds[rounds[k]].find((c) => c.seat === x.key);
      // The reason in MOVED ("yes, B from 8 to 9, because ...") belongs to the option it names first.
      const movedText = String(card?.moved || '');
      const because = movedText.match(/\bbecause\s+(.+)$/i)?.[1];
      const named = movedText.match(/\b([A-H])\s+from\b/)?.[1];
      const roundMoves = [];
      for (const o of options) {
        const u = a0.scores[o.id], w = b0.scores[o.id];
        if (!isNum(u) || !isNum(w) || u === w) continue;
        roundMoves.push({ round: rounds[k], id: o.id, from: u, to: w, head: `${o.label}, ${u} to ${w}, in round ${rounds[k]}`, why: '' });
      }
      if (because && roundMoves.length) (roundMoves.find((m) => m.id === named) || roundMoves[0]).why = tell(because);
      moves.push(...roundMoves);
    }

    // The rounds, as steps: mini dot rows against the round before, the council on the last one.
    const steps = cards.map(({ n, card }, k) => {
      const now = stateAt(s.rounds, n)[x.key];
      const before = k ? stateAt(s.rounds, cards[k - 1].n)[x.key] : null;
      const isLast = k === cards.length - 1;
      const scoresNow = now && !now.abstain ? now.scores : null;
      const prev = before && !before.abstain ? before.scores : null;
      const mini = scoresNow ? options.map((o) => {
        const v = scoresNow[o.id], u = prev?.[o.id];
        const changed = isNum(u) && isNum(v) && u !== v;
        return { label: o.label, v: isNum(v) ? String(v) : '', at: v, from: changed ? u : null, changed, council: isLast && rounds.length > 1 ? score(o.id) : null };
      }) : [];
      const blocks = [];
      if (card.abstain) blocks.push({ text: tell(card.whyTooHard || card.oneLine || 'Too hard to call from this seat.') });
      else if (n === rounds[0]) blocks.push({ text: tell(C.spellOptions(C.clean(card.call || card.why[0] || ''), options)) });
      else if (n === 3 || (isLast && !card.disagree && !card.concede)) {
        // The final vote: what moved since the round before.
        const ms = moves.filter((m) => m.round === n).map((m) => `${P.He} moved ${options.find((o) => o.id === m.id).label} from ${m.from} to ${m.to}.`);
        blocks.push({ text: ms.join(' ') || `No change from round ${cards[k - 1]?.n ?? n - 1}.` });
      } else {
        const vs = card.answering ? info(card.answering) : null;
        if (card.rebuttal || card.disagree) blocks.push({ label: vs ? `${P.His} sharpest disagreement, with ${vs.short}` : `${P.His} sharpest disagreement`, text: tell(card.rebuttal || card.disagree), face: vs ? { key: vs.key, img: vs.img, initials: vs.initials, name: vs.name } : null });
        if (card.concede) blocks.push({ label: `What ${p.he} conceded`, text: tell(card.concede) });
        if (card.onCruxes) blocks.push({ label: crux || 'On the big disagreement', text: tell(card.onCruxes) });
        if (isLast) {
          const ms = moves.filter((m) => m.round === n).map((m) => `${P.He} moved ${options.find((o) => o.id === m.id).label} from ${m.from} to ${m.to}.`);
          if (ms.length) blocks.push({ text: ms.join(' ') });
        }
      }
      const title = n === rounds[0] ? 'Opening' : n === 3 || (n === last && card.vote) ? 'Final vote' : 'Debate';
      const sub = title === 'Opening' ? `Written alone, before ${p.he} read the other investors` : title === 'Debate' ? 'After reading the other investors' : stance;
      return { n: k + 1, round: n, title, sub, mini, council: mini.some((m) => m.council !== null), blocks, final: isLast };
    });

    const used = new Set();
    for (const { card } of cards) for (const id of card.factIds || []) if (fact(id)) used.add(id);
    const wrongRaw = first?.wrongIf || '';
    const nowF = factsIn(wrongRaw)[0] || null;
    const line = lastCard?.oneLine || s.verdict?.share_line?.seat_lines?.[x.key] || first?.call || first?.whyTooHard || '';

    return {
      key: x.key, name: x.name, short: x.short, img: x.img, initials: x.initials, role: x.role,
      pos: i + 1, total: seats.length, abstain,
      stance, stanceKind: kind, agreement: a, agreementText: a ? AGREEMENT_TEXT[a] : 'No vote', cls: agreementClass(a),
      line: C.sentence(line === first?.call ? C.spellOptions(C.clean(line), options) : line).replace(/[^.!?]$/, (m) => `${m}.`),
      bridge, condition: cond,
      rows, hasMoves, keptNote: !abstain && !hasMoves && rounds.length > 1 ? `${P.He} kept every score from round 1 to the final ${hasVotes ? 'vote' : 'round'}.` : '',
      councilNote,
      why: (first?.why || []).map((t) => ({ text: tell(t), chips: factsIn(t) })),
      risk: first?.risk ? tell(first.risk) : '',
      wrong: wrongRaw ? tell(wrongRaw) : '',
      now: nowF ? { label: nowF.label.split(',')[0].length <= 28 ? `${nowF.label.split(',')[0]} now` : 'Today', value: nowF.value, title: nowF.title } : null,
      moves,
      steps,
      question: first?.question ? C.sentence(first.question) : '',
      facts: used.size,
      factsText: `${used.size} ${used.size === 1 ? 'fact' : 'facts'} from the council’s fact sheet`,
      disclaimer: `A simulation built from ${x.name}’s public work. Not ${p.his} views, and not investment advice.`,
      labels: { line: `Simulated, written from ${p.his} public work`, scored: `How ${p.he} scored the choices`, case: `${P.His} case`, risk: `The risk ${p.he} sees`, wrong: `${P.He} would be wrong if`, moves: `Where ${p.he} changed ${p.his} mind`, rounds: `How ${p.he} got there`, his: `${P.His} score`, question: `${P.His} question for you`, uses: `${P.His} reasoning uses` },
    };
  });

  return {
    heading: hasVotes ? 'How each investor voted on the plan' : 'Where each investor landed',
    hint: 'Select an investor to open their reasoning here.',
    sub: `Each investor scored all ${C.word(options.length)} choices from 0 to 10, ${hasVotes ? 'then voted on the council’s plan' : 'then the council picked a plan'}.`,
    panels,
  };
}

/** The verdict view. Null until verdict.json exists. */
export function verdictView(ctx, problems) {
  const { s, council, seats, options, info, ev, cfg, recheck } = ctx;
  const v = s.verdict;
  if (!v) return null;
  const final = stateAt(s.rounds);
  const scored = councilScores(options, final, council.weights);
  const computed = pickRecommended(scored);
  let rec = computed;
  if (v.recommended && options.some((o) => o.id === v.recommended)) {
    if (computed && v.recommended !== computed) problems.push({ file: 'verdict.json', message: `verdict recommends ${v.recommended} but the seat scores put ${computed} first` });
    rec = v.recommended;
  }
  if (!rec) return null;
  const run = runnerUp(scored, rec);
  const recO = options.find((o) => o.id === rec);
  const runO = options.find((o) => o.id === run);
  const score = (id) => scored.find((x) => x.id === id)?.score;
  const b = score(rec), c = score(run);

  // Agreement per seat, derived here and checked against scores.json (core writes the same
  // field with the same rule). Only a scores.json for the final round is compared: after each
  // earlier round it holds interim numbers.
  const agreement = {};
  for (const x of seats) agreement[x.key] = agreementOf(final[x.key], rec, cfg);
  const lastRound = roundNums(s.rounds).slice(-1)[0];
  if (s.scores && (s.scores.round === undefined || s.scores.round === lastRound)) {
    for (const row of s.scores.scorecard || []) {
      if (!row?.seat || !('agreement' in row) || !(row.seat in agreement)) continue;
      const theirs = normAgreement(row.agreement);
      if (theirs !== agreement[row.seat]) problems.push({ file: 'scores.json', message: `agreement for ${row.seat} is ${JSON.stringify(row.agreement)} but the seat scores say ${JSON.stringify(agreement[row.seat])}` });
    }
    const ag = s.scores.agreement;
    if (ag && typeof ag === 'object' && !Array.isArray(ag) && Object.keys(ag).some((k) => AGREEMENTS.includes(k))) {
      for (const k of AGREEMENTS) {
        const mine = Object.values(agreement).filter((a) => a === k).length;
        if (isNum(ag[k]) && ag[k] !== mine) problems.push({ file: 'scores.json', message: `agreement count for "${k}" is ${ag[k]} but the seat scores give ${mine}` });
      }
    }
    if (s.scores.recommended && s.scores.recommended !== computed) problems.push({ file: 'scores.json', message: `scores.json recommends ${s.scores.recommended} but the seat scores put ${computed} first` });
  }
  const counts = { agrees: 0, 'partly agrees': 0, disagrees: 0, abstains: 0, none: 0 };
  for (const x of seats) counts[agreement[x.key] ?? 'none'] += 1;

  const recScores = seats.map((x) => ({ x, v: final[x.key] && !final[x.key].abstain ? final[x.key].scores?.[rec] : null })).filter((p) => isNum(p.v));
  const unscored = seats.filter((x) => !recScores.some((p) => p.x.key === x.key));
  const lo = recScores.length ? Math.min(...recScores.map((p) => p.v)) : null;
  const hi = recScores.length ? Math.max(...recScores.map((p) => p.v)) : null;
  const spread = recScores.length ? hi - lo : 0;
  const seen = {};
  const dots = recScores.map(({ x, v: val }) => {
    const n = (seen[val] = (seen[val] || 0) + 1);
    return { key: x.key, img: x.img, initials: x.initials, alt: `${x.name}, ${val}`, pct: ((val - 1) / 9) * 100, stack: n - 1 };
  });

  // Your bias check: the leaned option's council score in Round 1 against now.
  let bias = { none: true, word: 'None given', note: 'You did not share a lean, so there was nothing to check.' };
  const leanId = s.lean?.option;
  const leanO = options.find((o) => o.id === leanId);
  if (leanO && s.rounds[1]) {
    const before = councilScores(options, stateAt(s.rounds, 1), council.weights).find((t) => t.id === leanO.id)?.score;
    const after = score(leanO.id);
    if (isNum(before) && isNum(after)) {
      const d = r1(after - before);
      const swapped = scored.map((x) => (x.id === leanO.id ? { ...x, score: before } : x));
      const flips = pickRecommended(swapped) !== pickRecommended(scored);
      bias = {
        none: false,
        word: Math.abs(d) < 0.5 ? 'Small' : Math.abs(d) < 1 ? 'Moderate' : 'Large',
        before: C.f1(before), after: C.f1(after), beforePct: before * 10, afterPct: after * 10,
        note: (() => {
          const saw = recheck ? `Once the council saw its last verdict, “${leanO.label}”,` : `Once the council saw you favoured “${leanO.label}”,`;
          return d === 0 ? `${saw} its score did not move.` : `${saw} that choice ${d > 0 ? 'gained' : 'lost'} ${C.f1(Math.abs(d))}. ${flips ? 'Enough to change the verdict.' : 'Not enough to change the verdict.'}`;
        })(),
      };
    }
  }

  const heavier = seats.filter((x) => x.weight > Math.min(...seats.map((y) => y.weight)));
  let weightNote = 'Out of 10. Every investor’s score counts the same.';
  if (heavier.length === 1) {
    const h = heavier[0];
    const reason = council.weights?.[h.key]?.reason;
    weightNote = `Out of 10. ${h.short}’s score counts ${C.timesWord(h.weight / Math.min(...seats.map((y) => y.weight)))} as much${reason ? ` (${C.lowerFirst(C.clean(reason).split(/[;.]/)[0].trim())})` : ''}.`;
  } else if (heavier.length > 1) weightNote = `Out of 10. Scores from ${C.joinNames(heavier.map((x) => x.short))} count more.`;

  const factsByKey = new Map((s.pack?.facts || []).map((f) => [f.key, f]));
  const kills = (Array.isArray(v.kill_criteria) ? v.kill_criteria : []).map((k) => {
    const kk = typeof k === 'string' ? { text: k } : k || {};
    const f = kk.fact ? factsByKey.get(kk.fact) : null;
    const at = kk.op && kk.value !== undefined ? `${C.opWord(kk.op)} ${f ? C.factValue({ ...f, value: kk.value }) : kk.value}` : 'Checked by the Chair';
    return { text: C.sentence(kk.text), at, now: f ? C.factValue(f) : 'Not measured', title: f ? factView(f).title : '' };
  });

  const date = String(council.started || s.pack?.asOf || '').slice(0, 10);
  const nextReport = factsByKey.get('next_report_expected')?.value;
  const days = nextReport ? C.daysBetween(date, nextReport) : null;
  let banner = null;
  if (isNum(days) && days >= 0 && days <= 14) banner = days === 0 ? `Results are due today. That is the first test of the council’s conditions.` : `Results are due in about ${C.word(days)} ${days === 1 ? 'day' : 'days'}, on ${C.fmtDate(nextReport)}. That is the first test of the council’s conditions.`;
  else if (v.recheck?.date) banner = `The council will look at this again on ${C.fmtDate(v.recheck.date)}.`;

  const yrs = C.horizonYears(council.horizon);
  const minority = v.minority?.seat ? info(v.minority.seat) : null;
  const voteRows = seats.map((x) => {
    const st = final[x.key];
    const a = agreement[x.key];
    const top = st && !st.abstain ? seatTop(st.scores, options, rec) : null;
    const topO = options.find((o) => o.id === top);
    const note = a === 'abstains' ? 'Did not score the choices' : !st ? 'No final card' : a === null ? 'Did not score this option' : top === rec ? 'Top choice' : topO ? `Would rather ${topO.short}` : '';
    return {
      key: x.key, img: x.img, initials: x.initials, name: x.name, short: x.short,
      agreement: a, cls: agreementClass(a), vote: a ? AGREEMENT_TEXT[a] : 'No vote',
      note,
      cells: options.map((o) => ({ v: st && !st.abstain && isNum(st.scores[o.id]) ? st.scores[o.id] : null, rec: o.id === rec })),
    };
  });

  const total = seats.length + 2;
  const tiles = voteRows.map((r) => ({ kind: 'seat', key: r.key, img: r.img, initials: r.initials, text: r.short, agreement: r.agreement, cls: r.cls, alt: `${r.name}, ${r.agreement === null ? r.note : r.vote}` }));
  tiles.splice(Math.floor(total / 2), 0, { kind: 'score', text: C.f1(b) });
  tiles.push({ kind: 'runner', text: runO ? `${C.capFirst(runO.short)} ${C.f1(c)}` : '' });

  const close = isNum(b) && isNum(c) && b - c < 0.5;
  return {
    label: C.labelCase(v.label),
    call: C.sentence(v.call),
    closeLine: !runO ? '' : close
      ? `It was close. “${recO.label}” scored ${C.f1(b)} out of 10. “${runO.label}” scored ${C.f1(c)}.`
      : `“${recO.label}” led with ${C.f1(b)} out of 10. The next best, “${runO.label}”, scored ${C.f1(c)}.`,
    disclaimer: C.DISCLAIMER,
    meta: [C.fmtDate(date), `${seats.length} investors`, `${roundNums(s.rounds).length} ${roundNums(s.rounds).length === 1 ? 'round' : 'rounds'}`].filter(Boolean),
    rec, run,
    optionScores: Object.fromEntries(scored.map((x) => [x.id, x.score])),
    stats: {
      council: { value: C.f1(b), bars: options.map((o) => ({ label: C.capFirst(o.short), v: C.f1(score(o.id)), pct: isNum(score(o.id)) ? score(o.id) * 10 : 0, rec: o.id === rec, runner: o.id === run })) },
      evidence: { word: ev.word, found: ev.found, total: ev.total, note: ev.note },
      united: { word: spread <= 1 ? 'United' : spread <= 3 ? 'Mostly united' : 'Split', lo, hi, dots, bandLeft: isNum(lo) ? ((lo - 1) / 9) * 100 : 0, bandWidth: isNum(lo) ? ((hi - lo) / 9) * 100 : 0, note: unitedNote(recO, lo, hi, recScores.length, unscored) },
      bias,
    },
    banner, cmd: council.ticker ? `/mosaic recheck ${council.ticker}` : '/mosaic journal',
    votes: voteRows,
    scorecard: { heads: options.map((o) => ({ label: o.label, rec: o.id === rec })), rows: voteRows, council: options.map((o) => ({ v: C.f1(score(o.id)), rec: o.id === rec })), note: weightNote },
    kills,
    checkin: v.recheck?.date ? { date: C.fmtDate(v.recheck.date), text: C.datesInText(C.sentence(v.recheck.triggers?.[0] || '')) } : null,
    objection: minority ? { ...minority, quote: C.sentence(v.minority.quote).replace(/[.;,]?$/, '.'), ifText: C.datesInText(C.sentence(v.minority.would_have_to_be_true || '')) } : null,
    why: (v.why || []).slice(0, 3).map((w) => ({ ...(w.seat ? info(w.seat) : { name: 'The council', img: null, initials: 'C' }), text: C.datesInText(C.sentence(w.point)) })),
    premortem: {
      intro: yrs ? `Imagine it is ${C.monthYear(date, yrs)} and this lost money. These are the council’s most likely reasons.` : 'Imagine this lost money a few years from now. These are the council’s most likely reasons.',
      items: (v.premortem || []).slice(0, 3).map((p) => C.datesInText(C.sentence(p))),
    },
    share: {
      question: C.clean(council.title || council.decision || ''),
      label: C.labelCase(v.label),
      text: `The council backs “${recO.label}”, at ${C.f1(b)} out of 10${runO ? ` against ${C.f1(c)} for “${runO.label}”` : ''}. ${C.voteCounts(counts)}`,
      seatsLine: `Mosaic, a council of ${C.word(seats.length)} investors`,
      tiles,
    },
    counts,
    spotlight: spotlight(ctx, { final, scored, rec, agreement }),
    sources: { lines: sourceLines(s.pack), notConnected: ev.notConnectedText },
  };
}

/**
 * Everything the page draws, from one parsed session payload.
 * @returns {null | { meta, seats, options, beats, live, verdict, phase, evidence, problems }}
 */
export function buildModel(s, { roster = null, cfg = DEFAULT_CONFIG } = {}) {
  if (!s?.council) return null;
  const problems = [...(s.problems || [])];
  const ctx = context(s, roster, cfg);
  const beats = beatsOf(s);
  const live = beats.map((_, i) => liveBeat(ctx, beats, i));
  const verdict = verdictView(ctx, problems);
  return {
    id: s.council.id || s.id,
    meta: {
      question: C.clean(s.council.title || s.council.decision || ''),
      kind: s.council.job === 'portfolio' ? 'Portfolio decision' : s.council.job === 'macro' ? 'Market question' : s.council.job === 'stress_test' ? 'Thesis stress test' : 'Single-stock decision',
      ticker: s.council.ticker || null,
      date: C.fmtDate(String(s.council.started || '').slice(0, 10)),
    },
    seats: ctx.seats.map(({ key, name, short, role, img, initials, pos, weight }) => ({ key, name, short, role, img, initials, pos, weight })),
    options: ctx.options,
    live,
    verdict,
    phase: verdict ? 6 : live[live.length - 1].step,
    evidence: ctx.ev,
    sources: sourceLines(s.pack),
    journal: s.journal || null,
    problems,
  };
}
