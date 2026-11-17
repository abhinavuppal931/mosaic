// Council math: option scores, label, overrides, spread, confidence, lean pull, evidence
// quality and the per-seat scorecard. Pure functions; skills/mosaic/references/scoring.md
// documents every rule here in plain words. Thresholds live in scripts/scoring.config.json.
import fs from 'node:fs';

export const DEFAULT_CONFIG = JSON.parse(fs.readFileSync(new URL('../scoring.config.json', import.meta.url), 'utf8'));

const r1 = (v) => Math.round(v * 10) / 10;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** The band label for a score. */
export function band(score, cfg = DEFAULT_CONFIG) {
  return cfg.bands.find((b) => score >= b.min)?.label ?? cfg.bands[cfg.bands.length - 1].label;
}

/** Rank of a band label (0 = best); labels outside the bands return -1. */
export function bandRank(label, cfg = DEFAULT_CONFIG) {
  return cfg.bands.findIndex((b) => b.label === label);
}

/** Lower a band label to `cap` if it is above it. */
export function capLabel(label, cap, cfg = DEFAULT_CONFIG) {
  const r = bandRank(label, cfg);
  const c = bandRank(cap, cfg);
  return r >= 0 && c >= 0 && r < c ? cap : label;
}

/**
 * Fill fields a seat left out of a later round from its most recent earlier card
 * (Round 3 cards do not repeat EVIDENCE or DOOR, for example).
 */
export function carryForward(rounds) {
  const order = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const out = {};
  const last = {};
  for (const n of order) {
    out[n] = {};
    for (const [seat, card] of Object.entries(rounds[n] || {})) {
      const prev = last[seat] || {};
      const merged = { ...card };
      for (const k of ['conviction', 'evidence', 'ruin', 'door', 'pillar']) if (merged[k] === null || merged[k] === undefined) merged[k] = prev[k] ?? null;
      if (!card.abstain && !Object.keys(card.scores || {}).length && prev.scores && Object.keys(prev.scores).length) merged.scores = prev.scores;
      out[n][seat] = merged;
      last[seat] = merged;
    }
  }
  return out;
}

/** Weighted mean per option over scoring seats. */
export function optionScores(options, cards, weights) {
  return options.map((o) => {
    const parts = [];
    for (const [seat, c] of Object.entries(cards)) {
      if (c.abstain || !isNum(c.scores?.[o.id])) continue;
      const w = weights[seat]?.weight ?? weights[seat] ?? 1;
      parts.push({ seat, w, s: c.scores[o.id] });
    }
    const wsum = parts.reduce((s, p) => s + p.w, 0);
    const score = wsum ? r1(parts.reduce((s, p) => s + p.w * p.s, 0) / wsum) : null;
    const math = parts.length ? `${o.id} (${parts.map((p) => `${p.w}x${p.s}`).join(' + ')}) / ${wsum} = ${score?.toFixed(1)}` : `${o.id} no scores`;
    const vals = parts.map((p) => p.s);
    return { ...o, score, math, spread: vals.length ? Math.max(...vals) - Math.min(...vals) : null, seats: Object.fromEntries(parts.map((p) => [p.seat, p.s])) };
  });
}

/** Highest score; ties go to the smaller spread, then the earlier option. */
export function pickRecommended(scored) {
  return scored
    .filter((o) => isNum(o.score))
    .slice()
    .sort((a, b) => b.score - a.score || (a.spread ?? 99) - (b.spread ?? 99) || a.id.localeCompare(b.id))[0] || null;
}

/** Round 1 unanimity: every scoring seat's top option is the same and its scores sit within maxSpread. */
export function unanimityCheck(cards, cfg = DEFAULT_CONFIG) {
  const tops = [];
  for (const c of Object.values(cards)) {
    if (c.abstain) continue;
    const entries = Object.entries(c.scores || {});
    if (!entries.length) continue;
    const best = Math.max(...entries.map(([, v]) => v));
    const ids = entries.filter(([, v]) => v === best).map(([k]) => k);
    tops.push({ ids, best });
  }
  if (tops.length < 2) return { unanimous: false };
  const common = tops.reduce((acc, t) => acc.filter((x) => t.ids.includes(x)), tops[0].ids);
  if (!common.length) return { unanimous: false };
  const opt = common[0];
  const vals = Object.values(cards).filter((c) => !c.abstain && isNum(c.scores?.[opt])).map((c) => c.scores[opt]);
  const spread = Math.max(...vals) - Math.min(...vals);
  return { unanimous: spread <= cfg.unanimity.maxSpread, option: opt, spread };
}

/**
 * Lean pull: how far seats moved toward the user's leaned option after the reveal,
 * relative to how they moved on the other options. Positive = toward the lean.
 * Per seat: (final - R1 on the lean option) - mean(final - R1 on the other options).
 */
export function leanPull(lean, r1Cards, finalCards, weights, options, cfg = DEFAULT_CONFIG) {
  if (!lean) return null;
  const per = [];
  for (const [seat, f] of Object.entries(finalCards)) {
    const a = r1Cards[seat];
    if (!a || a.abstain || f.abstain || !isNum(a.scores?.[lean]) || !isNum(f.scores?.[lean])) continue;
    const others = options.map((o) => o.id).filter((id) => id !== lean && isNum(a.scores?.[id]) && isNum(f.scores?.[id]));
    const dOther = others.length ? others.reduce((s, id) => s + (f.scores[id] - a.scores[id]), 0) / others.length : 0;
    per.push({ seat, w: weights[seat]?.weight ?? 1, toward: f.scores[lean] - a.scores[lean], pull: f.scores[lean] - a.scores[lean] - dOther });
  }
  if (!per.length) return { option: lean, value: null, perSeat: [], flagged: false, note: 'no seat scored the leaned option in both rounds' };
  const wsum = per.reduce((s, p) => s + p.w, 0);
  const value = r1(per.reduce((s, p) => s + p.w * p.pull, 0) / wsum);
  const rawShift = r1(per.reduce((s, p) => s + p.w * p.toward, 0) / wsum);
  return { option: lean, value, rawShift, perSeat: per.map(({ seat, pull, toward }) => ({ seat, pull: r1(pull), toward: r1(toward) })), flagged: value >= cfg.leanPull.flagAt };
}

/** Evidence quality from pack coverage and the share of WHY points that cite fact ids. */
export function evidenceQuality(coverage, roundsForCitations, cfg = DEFAULT_CONFIG) {
  let points = 0;
  let cited = 0;
  for (const cards of roundsForCitations) {
    for (const c of Object.values(cards || {})) {
      if (c.abstain) continue;
      points += c.why?.length || 0;
      cited += c.whyCited || 0;
    }
  }
  const citedShare = points ? cited / points : 0;
  const cov = isNum(coverage) ? coverage : 0;
  const score = cfg.evidence.coverageWeight * cov + cfg.evidence.citedWeight * citedShare;
  return {
    coverage: Math.round(cov * 1000) / 1000,
    citedShare: Math.round(citedShare * 1000) / 1000,
    whyPoints: points,
    score: Math.round(score * 1000) / 1000,
    grade: score >= cfg.evidence.high ? 'high' : score >= cfg.evidence.medium ? 'medium' : 'low',
  };
}

/**
 * The whole verdict math.
 * @param {{
 *   council: { job?: string, mode?: string, options: {id:string,label:string,kind?:'act'|'wait'|'none',trigger?:string}[], seats: string[], weights: Record<string,{weight:number}> },
 *   rounds: Record<number, Record<string, object>>,   // parsed cards per round
 *   lean?: string|null,                                // the leaned option id (lean.json)
 *   coverage?: number|null,                            // data pack coverage score
 *   draft?: { ruin_mitigations?: {seat:string, endorsed:boolean}[], wait_for_pitch?: {trigger:string} } | null,
 *   roster?: { seats: {key:string, dimension?:string, short?:string}[] } | null,
 * }} input
 */
export function scoreCouncil(input, cfg = DEFAULT_CONFIG) {
  const { council, lean = null, coverage = null, draft = null, roster = null } = input;
  const rounds = carryForward(input.rounds);
  const ran = Object.keys(rounds).map(Number).filter((n) => Object.keys(rounds[n]).length).sort((a, b) => a - b);
  if (!ran.length) throw new Error('no round cards to score');
  const lastN = ran[ran.length - 1];
  const final = rounds[lastN];
  const weights = council.weights || {};
  const scoringSeats = Object.entries(final).filter(([, c]) => !c.abstain && Object.keys(c.scores || {}).length);
  const abstentions = Object.entries(final).filter(([, c]) => c.abstain).map(([s]) => s);

  const scored = optionScores(council.options, final, weights);
  const top = pickRecommended(scored);
  const overrides = [];
  const problems = [];
  let label;
  let underlying = null;

  if (!top) {
    label = cfg.labels.insufficient;
    overrides.push({ type: 'insufficient', note: 'no seat scored any option (all abstained or cards unreadable)' });
  } else {
    label = band(top.score, cfg);
    if (top.kind === 'none') {
      label = cfg.labels.pass;
      overrides.push({ type: 'pass', note: `the top option (${top.id}) is not to act` });
    } else if ((top.kind === 'wait' || draft?.wait_for_pitch?.trigger) && top.score >= cfg.waitMinScore) {
      label = cfg.labels.wait;
      const trigger = top.kind === 'wait' ? top.trigger : draft.wait_for_pitch.trigger;
      if (!trigger) problems.push('WAIT FOR THE PITCH needs a named trigger (option.trigger or draft.wait_for_pitch.trigger)');
      overrides.push({ type: 'wait', note: `wait for the trigger: ${trigger || 'MISSING'}`, trigger: trigger || null });
    }

    // Ruin cap: any scoring seat at RUIN RISK likely, unless it endorsed a mitigation.
    const mitigated = new Set((draft?.ruin_mitigations || []).filter((m) => m.endorsed).map((m) => m.seat));
    const ruinSeats = scoringSeats.filter(([s, c]) => c.ruin === 'likely' && !(mitigated.has(s) && (lastN < 3 || c.vote !== 'dissent'))).map(([s]) => s);
    if (ruinSeats.length && bandRank(label, cfg) >= 0) {
      const before = label;
      label = capLabel(label, cfg.labels.ruinCap, cfg);
      overrides.push({ type: 'ruin_cap', seats: ruinSeats, applied: before !== label, note: `RUIN RISK likely from ${ruinSeats.join(', ')}: capped at ${cfg.labels.ruinCap} until a mitigation that seat endorses` });
    }
    // One-way door cap.
    const doors = scoringSeats.map(([, c]) => c.door).filter(Boolean);
    const oneWay = doors.filter((d) => d === 'one-way').length;
    if (doors.length && oneWay / scoringSeats.length > cfg.oneWayDoor.majorityAbove && (top.spread ?? 0) >= cfg.oneWayDoor.minSpread && bandRank(label, cfg) >= 0) {
      const before = label;
      label = capLabel(label, cfg.labels.oneWayCap, cfg);
      overrides.push({ type: 'one_way_cap', applied: before !== label, note: `${oneWay} of ${scoringSeats.length} seats call it a one-way door and the spread is ${top.spread}: capped at ${cfg.labels.oneWayCap}; the cheapest test comes first` });
    }
    // Insufficient evidence replaces everything.
    const thin = scoringSeats.filter(([, c]) => c.evidence === 'thin').length;
    const lowCoverage = isNum(coverage) && coverage < cfg.insufficient.coverageBelow;
    const thinMajority = scoringSeats.length && thin / scoringSeats.length > cfg.insufficient.thinShareAbove;
    if (lowCoverage || thinMajority) {
      underlying = label;
      label = cfg.labels.insufficient;
      overrides.push({ type: 'insufficient', note: [lowCoverage ? `pack coverage ${Math.round(coverage * 100)}% is below ${cfg.insufficient.coverageBelow * 100}%` : null, thinMajority ? `${thin} of ${scoringSeats.length} seats rate their evidence thin` : null].filter(Boolean).join('; ') });
    }
  }

  const topVals = top ? scoringSeats.map(([, c]) => c.scores[top.id]).filter(isNum) : [];
  const spread = topVals.length ? Math.max(...topVals) - Math.min(...topVals) : null;
  const convs = scoringSeats.map(([, c]) => c.conviction).filter(isNum);
  let confidence = convs.length ? Math.round((convs.reduce((s, x) => s + x, 0) / convs.length) * 2) : null;
  if (confidence !== null && spread !== null && spread >= cfg.confidence.spreadPenaltyAt) confidence -= 1;
  if (confidence !== null) confidence = Math.min(10, Math.max(1, confidence));

  const votes = lastN >= 3 ? { endorse: 0, amend: 0, dissent: 0 } : null;
  if (votes) for (const c of Object.values(final)) if (c.vote && c.vote in votes) votes[c.vote] += 1;
  const supportParts = lastN >= 3 ? scoringSeats.filter(([, c]) => isNum(c.finalScore)).map(([s, c]) => ({ w: weights[s]?.weight ?? 1, v: c.finalScore })) : [];
  const support = supportParts.length ? r1(supportParts.reduce((s, p) => s + p.w * p.v, 0) / supportParts.reduce((s, p) => s + p.w, 0)) : null;

  const firstRound = rounds[ran[0]];
  const dims = new Map((roster?.seats || []).map((s) => [s.key, s]));
  const scorecard = council.seats.map((seat) => {
    const c = final[seat];
    const a = firstRound[seat];
    return {
      seat,
      short: dims.get(seat)?.short || seat,
      dimension: dims.get(seat)?.dimension || null,
      weight: weights[seat]?.weight ?? 1,
      present: Boolean(c),
      abstain: Boolean(c?.abstain),
      stance: c?.stance ?? null,
      vote: c?.vote ?? null,
      scores: c?.scores ?? {},
      pillar: c?.pillar ?? null,
      conviction: c?.conviction ?? null,
      evidence: c?.evidence ?? null,
      ruin: c?.ruin ?? null,
      door: c?.door ?? null,
      movedOnTop: top && a && c && isNum(a.scores?.[top.id]) && isNum(c.scores?.[top.id]) ? c.scores[top.id] - a.scores[top.id] : null,
    };
  });
  const missingSeats = council.seats.filter((s) => !final[s]);
  if (missingSeats.length) problems.push(`no card in round ${lastN} for: ${missingSeats.join(', ')}`);

  const out = {
    schema: 'mosaic.scores/1',
    round: lastN,
    roundsRun: ran,
    options: scored.map(({ id, label: l, kind, score, math, spread: sp }) => ({ id, label: l, kind: kind || 'act', score, spread: sp, math })),
    recommended: top?.id ?? null,
    band: top ? band(top.score, cfg) : null,
    label,
    underlyingLabel: underlying,
    overrides,
    spread,
    confidence,
    abstentions,
    votes,
    support,
    unanimousRound1: rounds[ran[0]] && ran[0] === 1 ? unanimityCheck(rounds[1], cfg) : null,
    needsRound3: Boolean(top) && lastN === 2 && ((spread ?? 0) > cfg.quick.round3IfSpreadAbove || scoringSeats.some(([, c]) => c.ruin === 'likely')),
    leanPull: lean && rounds[1] ? leanPull(lean, rounds[1], final, weights, council.options, cfg) : null,
    evidence: evidenceQuality(coverage, [rounds[1], rounds[2]].filter(Boolean), cfg),
    thesisStrength: council.job === 'stress_test' ? scored.find((o) => o.id === 'A')?.score ?? null : undefined,
    scorecard,
    problems,
  };
  if (out.thesisStrength === undefined) delete out.thesisStrength;
  return out;
}
