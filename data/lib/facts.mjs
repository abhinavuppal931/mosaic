// The fact book: every number in a pack gets an id (F001...), a stable key, a source, an
// as-of date and a status. Derived facts also store their formula and the inputs they used.
// Missing facts are recorded too, with value null, so a gap is visible instead of silent.
import crypto from 'node:crypto';
import { isNum, round } from './metrics.mjs';

const RANK = { ok: 0, fallback: 1, stale: 2, missing: 3, error: 3 };

export function createFactBook({ prefix = 'F' } = {}) {
  const facts = [];
  const byKey = new Map();

  function nextId() {
    return `${prefix}${String(facts.length + 1).padStart(3, '0')}`;
  }

  function push(f) {
    if (byKey.has(f.key)) throw new Error(`duplicate fact key ${f.key}`);
    const fact = { id: nextId(), ...f };
    for (const k of Object.keys(fact)) if (fact[k] === undefined) delete fact[k];
    facts.push(fact);
    byKey.set(f.key, fact);
    return fact.id;
  }

  return {
    facts,
    /**
     * A sourced fact. `meta` is a router meta ({source, asOf, status, note}).
     * A null value is stored with status "missing".
     */
    add({ key, label, value, unit, period, meta = {}, url, note, dp }) {
      const missing = value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value));
      return push({
        key,
        label,
        value: missing ? null : typeof value === 'number' && dp !== undefined ? round(value, dp) : value,
        unit,
        period,
        source: meta.source || null,
        asOf: meta.asOf || null,
        status: missing ? (meta.status === 'error' ? 'error' : 'missing') : meta.status || 'ok',
        url,
        note: note || (missing ? meta.note : undefined),
      });
    },
    /**
     * A derived fact computed by Mosaic. `inputs` are fact ids (or "series:<name>" refs).
     * Status is the worst status among input facts; null value means missing.
     */
    derive({ key, label, value, unit, period, formula, inputs = [], note, dp, asOf: asOfOverride }) {
      const ins = inputs.map((id) => facts.find((f) => f.id === id)).filter(Boolean);
      const worst = ins.reduce((w, f) => (RANK[f.status] > RANK[w] ? f.status : w), 'ok');
      const asOf = asOfOverride || ins.map((f) => f.asOf).filter(Boolean).sort().pop() || null;
      const missing = !isNum(value) && (value === null || value === undefined || typeof value === 'number');
      return push({
        key,
        label,
        value: missing ? null : typeof value === 'number' ? (dp !== undefined ? round(value, dp) : sig(value)) : value,
        unit,
        period,
        source: 'mosaic',
        asOf,
        status: missing ? 'missing' : worst === 'missing' || worst === 'error' ? 'ok' : worst,
        derived: true,
        formula,
        inputs,
        note: note || (missing ? missingWhy(ins) : undefined),
      });
    },
    get: (key) => byKey.get(key) || null,
    id: (key) => byKey.get(key)?.id || null,
    value: (key) => byKey.get(key)?.value ?? null,
  };
}

/** Ten significant digits: enough for any ratio, and stable across platforms. */
const sig = (v) => Number(v.toPrecision(10));

function missingWhy(inputs) {
  const gone = inputs.filter((f) => f.value === null).map((f) => f.id);
  return gone.length ? `input missing: ${gone.join(', ')}` : 'not computable from the inputs (too little history or a non-positive base)';
}

/** sha256 of the canonical JSON of the facts (ids, values, sources, as-of dates). */
export function hashFacts(facts) {
  const canon = facts.map((f) => [f.id, f.key, f.value, f.unit, f.source, f.asOf, f.status]);
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(canon)).digest('hex');
}
