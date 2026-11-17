// Read a council session folder into the inputs the scoring and journal code need.
import fs from 'node:fs';
import path from 'node:path';
import { parseRound } from './cards.mjs';

export function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

export function readSession(dir, resolve) {
  const council = readJson(path.join(dir, 'council.json'));
  if (!council) throw new Error(`no council.json in ${dir}`);
  const rounds = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^round-(\d+)\.md$/);
    if (m) rounds[Number(m[1])] = parseRound(fs.readFileSync(path.join(dir, f), 'utf8'), resolve);
  }
  return {
    dir,
    council,
    rounds,
    lean: readJson(path.join(dir, 'lean.json')),
    pack: readJson(path.join(dir, 'data-pack.json')),
    draft: readJson(path.join(dir, 'draft.json')),
    verdict: readJson(path.join(dir, 'verdict.json')),
    scores: readJson(path.join(dir, 'scores.json')),
  };
}
