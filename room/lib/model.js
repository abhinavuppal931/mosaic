// Turn a parsed session (lib/session.js) into everything the page shows. Pure functions,
// shared by the server, the page and the tests. Every number comes from the seats' option
// scores in the round files; nothing here is typed in by hand.
import { seatInfo } from './seats.js';
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

export const optShort = (o) => (o ? o.short || C.lowerFirst(o.label) : '');

/**
 * Weighted mean per option over the seats that scored it (abstentions skipped), rounded to one
 * decimal exactly like core's scripts/lib/scoring.mjs. `state` is { seatKey: { scores, abstain } }.
 */
export function councilScores(options, state, weights = {}) {
  return options.map((o) => {
    let ws = 0, sum = 0;
    const vals = [];
    for (const [seat, st] of Object.entries(state)) {
      if (!st || st.abstain || !isNum(st.scores?.[o.id])) continue;
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
 * Where a seat stands on the recommended option (ROOM-DESIGN.md):
 * agrees when its top option is the recommended one, disagrees when it scores the
 * recommended option 4 or below, partly agrees otherwise.
 */
export function agreementOf(scores, options, rec) {
  if (!rec || !isNum(scores?.[rec])) return null;
  if (seatTop(scores, options, rec) === rec) return 'agrees';
  return scores[rec] <= 4 ? 'disagrees' : 'partly';
}
export const AGREEMENT_TEXT = { agrees: 'Agrees', partly: 'Partly agrees', disagrees: 'Disagrees' };
const normAgreement = (v) => {
  const s = String(v || '').toLowerCase();
  return s.startsWith('agree') ? 'agrees' : s.startsWith('partly') ? 'partly' : s.startsWith('disagree') ? 'disagrees' : null;
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
  const nc = notConnected.length ? ` ${C.capFirst(C.joinNames(notConnected))} ${notConnected.length === 1 ? 'was' : 'were'} not connected.` : '';
  return {
    found: found.length,
    total: facts.length,
    word: !facts.length ? 'None' : share >= 0.85 ? 'Strong' : share >= 0.6 ? 'Adequate' : 'Thin',
    note: facts.length ? `${found.length} of ${facts.length} facts found.${nc}` : 'No data pack yet.',
    notConnectedText: notConnected.length ? `${C.capFirst(C.joinNames(notConnected))} ${notConnected.length === 1 ? 'was' : 'were'} not connected.` : '',
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
    out.push({ text: `${v.label} ${v.value}`, title: v.title });
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

function context(s, roster) {
  const council = s.council;
  const seats = council.seats.map((k) => ({ ...seatInfo(k, roster), weight: council.weights?.[k]?.weight ?? (isNum(council.weights?.[k]) ? council.weights[k] : 1) }));
  const pos = seatPositions(seats.length);
  seats.forEach((x, i) => (x.pos = pos[i]));
  const options = council.options.map((o) => ({ id: o.id, label: o.label, short: optShort(o), kind: o.kind || 'act' }));
  const factsById = new Map((s.pack?.facts || []).map((f) => [f.id, f]));
  const info = (k) => seats.find((x) => x.key === k) || seatInfo(k, roster);
  return { s, council, seats, options, factsById, info, roundsTotal: council.mode === 'quick' ? 2 : 3, ev: evidence(s.pack) };
}

function nextText(ctx, beat, beats, bi) {
  const { s, council } = ctx;
  if (beat.mode === 'brief') return s.pack ? 'Round 1 comes next' : 'The data comes next';
  if (beat.mode === 'data') return 'Round 1 comes next';
  if (beat.mode === 'vote') return 'The verdict comes next';
  const nb = beats[bi + 1];
  if (nb && nb.mode === 'card' && nb.round === beat.round) return `${ctx.info(nb.seat).name} speaks next`;
  const spoken = new Set(s.rounds[beat.round].slice(0, beat.index + 1).map((c) => c.seat));
  const waiting = council.seats.find((k) => !spoken.has(k));
  if (waiting) return `${ctx.info(waiting).name} speaks next`;
  return beat.round < ctx.roundsTotal ? `Round ${beat.round + 1} comes next` : 'The verdict comes next';
}

function stepText(ctx, beat) {
  if (beat.mode === 'brief') return 'The brief';
  if (beat.mode === 'data') return 'The data';
  if (beat.mode === 'vote') return 'The vote';
  return `Round ${beat.round} of ${ctx.roundsTotal}, ${['blind', 'debate', 'final scores'][beat.round - 1] || 'more scores'}`;
}

function leanCard(ctx, totals, revealed) {
  const { s, options } = ctx;
  if (!s.lean || !revealed) return { state: 'sealed', label: 'Your lean', title: 'Your lean stays sealed for now', body: 'The council scores the first round without knowing your view, to keep it honest.' };
  if (s.lean.option === null || s.lean.option === undefined) return { state: 'none', label: 'Your lean', title: 'You did not share a lean', body: 'So there was nothing to sway the council.' };
  const o = options.find((x) => x.id === s.lean.option);
  const ranked = totals.filter((t) => isNum(t.score)).sort((a, b) => b.score - a.score);
  const rank = ranked.findIndex((t) => t.id === o.id) + 1;
  const now = totals.find((t) => t.id === o.id)?.score;
  const before = s.rounds[1] ? councilScores([o], stateAt(s.rounds, 1), s.council.weights).find((t) => t.id === o.id)?.score : null;
  let body = 'The first round was scored without knowing your view, to keep it honest.';
  if (isNum(before) && isNum(now) && roundNums(s.rounds).some((n) => n >= 2)) {
    const d = r1(now - before);
    body += d === 0 ? ' Since your view was shared, its score has not moved.' : ` Since your view was shared, that choice ${d > 0 ? 'gained' : 'lost'} ${C.f1(Math.abs(d))}.`;
  }
  return {
    state: 'revealed',
    label: 'Your lean, revealed this round',
    title: rank && isNum(now) ? `You leaned toward “${o.label}”. The council ranks it ${C.ordinal(rank)} of ${ranked.length}, at ${C.f1(now)}.` : `You leaned toward “${o.label}”.`,
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
    const tag = c.abstain ? null : n === 1 ? ['Risk', c.risk] : n === 2 ? ['Concedes', c.concede] : c.amendment ? ['Asks for', c.amendment] : ['For you', c.oneLine];
    return { key: c.seat, name: info(c.seat).name, img: info(c.seat).img, initials: info(c.seat).initials, move: n === 1 ? 'opening scores' : mv?.turn || '', text: C.sentence(sayRaw(c, n)), tag: tag && tag[1] ? tag[0] : null, tagText: tag && tag[1] ? C.sentence(tag[1]) : '' };
  });

  const revealed = Boolean(s.lean) && (last || beat.mode === 'vote' || (beat.round ?? 0) >= 2);
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

/** The verdict view. Null until verdict.json exists. */
export function verdictView(ctx, problems) {
  const { s, council, seats, options, info, ev } = ctx;
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

  // Agreement per seat, checked against scores.json when core supplies it.
  const agreement = {};
  for (const x of seats) {
    const st = final[x.key];
    agreement[x.key] = !st ? null : st.abstain ? 'abstain' : agreementOf(st.scores, options, rec);
  }
  const given = {};
  for (const row of s.scores?.scorecard || []) if (row?.seat && row.agreement !== undefined) given[row.seat] = row.agreement;
  if (s.scores?.agreement && typeof s.scores.agreement === 'object') Object.assign(given, s.scores.agreement);
  for (const [seat, val] of Object.entries(given)) {
    const mine = agreement[seat];
    if (mine && mine !== 'abstain' && normAgreement(val) !== mine) problems.push({ file: 'scores.json', message: `agreement for ${seat} is "${val}" but the seat scores say ${AGREEMENT_TEXT[mine]}` });
  }
  const counts = { agrees: 0, partly: 0, disagrees: 0 };
  for (const a of Object.values(agreement)) if (a in counts) counts[a] += 1;

  const recScores = seats.map((x) => ({ x, v: final[x.key]?.scores?.[rec] })).filter((p) => isNum(p.v));
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
    const before = councilScores([leanO], stateAt(s.rounds, 1), council.weights)[0].score;
    const after = score(leanO.id);
    if (isNum(before) && isNum(after)) {
      const d = r1(after - before);
      const swapped = scored.map((x) => (x.id === leanO.id ? { ...x, score: before } : x));
      const flips = pickRecommended(swapped) !== pickRecommended(scored);
      bias = {
        none: false,
        word: Math.abs(d) < 0.5 ? 'Small' : Math.abs(d) < 1 ? 'Moderate' : 'Large',
        before: C.f1(before), after: C.f1(after), beforePct: before * 10, afterPct: after * 10,
        note: d === 0
          ? `Once the council saw you favoured ${leanO.short}, its score did not move.`
          : `Once the council saw you favoured ${leanO.short}, that choice ${d > 0 ? 'gained' : 'lost'} ${C.f1(Math.abs(d))}. ${flips ? 'Enough to change the verdict.' : 'Not enough to change the verdict.'}`,
      };
    }
  }

  const heavier = seats.filter((x) => x.weight > Math.min(...seats.map((y) => y.weight)));
  let weightNote = 'Out of 10. Every investor’s score counts the same.';
  if (heavier.length === 1) {
    const h = heavier[0];
    const reason = council.weights?.[h.key]?.reason;
    weightNote = `Out of 10. ${h.short}’s score counts ${C.timesWord(h.weight / Math.min(...seats.map((y) => y.weight)))} as much${reason ? ` (${C.lowerFirst(C.clean(reason)).replace(/\.$/, '')})` : ''}.`;
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
    return {
      key: x.key, img: x.img, initials: x.initials, name: x.name, short: x.short,
      agreement: a, vote: a === 'abstain' ? 'Too hard to call' : a ? AGREEMENT_TEXT[a] : 'No card',
      note: a === 'abstain' ? 'Did not score' : top === rec ? 'Top choice' : topO ? `Would rather ${topO.short}` : 'No scores',
      cells: options.map((o) => ({ v: st && !st.abstain && isNum(st.scores[o.id]) ? st.scores[o.id] : null, rec: o.id === rec })),
    };
  });

  const total = seats.length + 2;
  const tiles = voteRows.map((r) => ({ kind: 'seat', key: r.key, img: r.img, initials: r.initials, text: r.short, agreement: r.agreement, alt: `${r.name}, ${r.vote}` }));
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
      united: { word: spread <= 1 ? 'United' : spread <= 3 ? 'Mostly united' : 'Split', lo, hi, dots, bandLeft: isNum(lo) ? ((lo - 1) / 9) * 100 : 0, bandWidth: isNum(lo) ? ((hi - lo) / 9) * 100 : 0, note: lo === hi ? `Every investor scored ${recO.short} ${lo}.` : `Scores for ${recO.short} ranged from ${lo} to ${hi}.` },
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
      text: `${C.capFirst(recO.short)}, says the council. Scored ${C.f1(b)}${runO ? `, with ${runO.short} next at ${C.f1(c)}` : ''}. ${C.voteCounts(counts)}`,
      seatsLine: `Mosaic, a council of ${C.word(seats.length)} investors`,
      tiles,
    },
    counts,
    sources: { lines: sourceLines(s.pack), notConnected: ev.notConnectedText },
  };
}

/**
 * Everything the page draws, from one parsed session payload.
 * @returns {null | { meta, seats, options, beats, live, verdict, phase, evidence, problems }}
 */
export function buildModel(s, { roster = null } = {}) {
  if (!s?.council) return null;
  const problems = [...(s.problems || [])];
  const ctx = context(s, roster);
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
