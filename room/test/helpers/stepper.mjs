// Replays a finished example session into an empty folder, one phase at a time, in the write
// order of core's live-room.md contract (council.json first, verdict.json last). Used by the
// end-to-end tests and the screenshot script to drive the Room through every step.
import fs from 'node:fs';
import path from 'node:path';

/** The first `k` seat cards of a round file (Chair notes dropped until the round is complete). */
export function partialRound(md, k) {
  const parts = md.split(/^(?=## )/m);
  const head = parts.shift();
  const seats = parts.filter((p) => !/^## chair/i.test(p));
  return head + seats.slice(0, k).join('');
}

const copy = (from, to, name) => {
  const src = path.join(from, name);
  if (fs.existsSync(src)) fs.writeFileSync(path.join(to, name), fs.readFileSync(src));
};

/**
 * The phases of a council. Each has a `name`, the `step` (0 to 6) the Room should show after it,
 * and `apply(dir)` that writes the next files into `dir`.
 */
export function phases(example) {
  const has = (n) => fs.existsSync(path.join(example, n));
  const read = (n) => fs.readFileSync(path.join(example, n), 'utf8');
  const out = [
    { name: 'brief', step: 0, apply: (d) => ['council.json', 'brief.md'].forEach((n) => copy(example, d, n)) },
    { name: 'data', step: 1, apply: (d) => ['data-pack.json', 'data-pack.md'].forEach((n) => copy(example, d, n)) },
    { name: 'round 1, first cards', step: 2, apply: (d) => fs.writeFileSync(path.join(d, 'round-1.md'), partialRound(read('round-1.md'), 2)) },
    { name: 'round 1', step: 2, apply: (d) => copy(example, d, 'round-1.md') },
    { name: 'cruxes', step: 2, apply: (d) => copy(example, d, 'cruxes.json') },
    { name: 'lean', step: 2, apply: (d) => copy(example, d, 'lean.json') },
    { name: 'round 2, first cards', step: 3, apply: (d) => fs.writeFileSync(path.join(d, 'round-2.md'), partialRound(read('round-2.md'), 3)) },
    { name: 'round 2', step: 3, apply: (d) => copy(example, d, 'round-2.md') },
  ];
  if (has('round-3.md')) {
    out.push({ name: 'draft', step: 3, apply: (d) => ['draft.json', 'draft-resolution.md'].forEach((n) => copy(example, d, n)) });
    out.push({ name: 'round 3, first cards', step: 4, apply: (d) => fs.writeFileSync(path.join(d, 'round-3.md'), partialRound(read('round-3.md'), 2)) });
    out.push({ name: 'round 3', step: 5, apply: (d) => copy(example, d, 'round-3.md') });
  }
  out.push({ name: 'scores and citations', step: has('round-3.md') ? 5 : 5, apply: (d) => ['scores.json', 'citations.json'].forEach((n) => copy(example, d, n)) });
  out.push({ name: 'verdict', step: 6, apply: (d) => ['verdict.md', 'verdict.json'].forEach((n) => copy(example, d, n)) });
  return out;
}

/** Apply phases up to and including the one named `until`. */
export function stageTo(example, dir, until) {
  fs.mkdirSync(dir, { recursive: true });
  for (const p of phases(example)) {
    p.apply(dir);
    if (p.name === until) return p;
  }
  return null;
}
