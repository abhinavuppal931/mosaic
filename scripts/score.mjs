#!/usr/bin/env node
// Compute the verdict math for a session from its round cards and write scores.json.
//
//   node scripts/score.mjs <session dir> [--roster <file>] [--json] [--no-write]
//
// The Chair runs this after each round (interim numbers) and before writing the verdict.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../data/lib/args.mjs';
import { paths } from '../data/lib/paths.mjs';
import { loadRoster, seatResolver } from './lib/roster.mjs';
import { readSession } from './lib/session.mjs';
import { scoreCouncil } from './lib/scoring.mjs';

export function main(argv) {
  const args = parseArgs(argv, { booleans: ['json', 'noWrite'] });
  const dir = args._[0];
  if (!dir || !fs.existsSync(dir)) {
    process.stderr.write('usage: node scripts/score.mjs <session dir> [--roster file] [--json]\n');
    return 64;
  }
  const rosterFile = typeof args.roster === 'string' ? args.roster : paths({ home: args.home }).roster;
  if (!fs.existsSync(rosterFile)) {
    process.stderr.write(`error: roster not found at ${rosterFile} (built by /newseat; pass --roster <file> to use another)\n`);
    return 1;
  }
  const roster = loadRoster(rosterFile);
  const s = readSession(path.resolve(dir), seatResolver(roster));
  const result = scoreCouncil({
    council: s.council,
    rounds: s.rounds,
    lean: s.lean?.option ?? null,
    coverage: s.pack?.coverage?.score ?? s.council.pack?.coverage ?? null,
    draft: s.draft,
    roster,
  });
  if (!args.noWrite) fs.writeFileSync(path.join(dir, 'scores.json'), JSON.stringify(result, null, 2) + '\n');
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Round ${result.round}: ${result.label}${result.underlyingLabel ? ` (underlying ${result.underlyingLabel})` : ''} on option ${result.recommended ?? '-'}`);
    for (const o of result.options) console.log(`  ${o.math}`);
    console.log(`  spread ${result.spread ?? '-'} · confidence ${result.confidence ?? '-'}/10 · evidence ${result.evidence.grade} (coverage ${Math.round(result.evidence.coverage * 100)}%, cited ${Math.round(result.evidence.citedShare * 100)}%)${result.leanPull ? ` · lean pull ${result.leanPull.value ?? '-'} toward ${result.leanPull.option}${result.leanPull.flagged ? ' (FLAGGED)' : ''}` : ''}`);
    if (result.abstentions.length) console.log(`  abstained (TOO HARD): ${result.abstentions.join(', ')}`);
    for (const o of result.overrides) console.log(`  override ${o.type}: ${o.note}`);
    if (result.unanimousRound1?.unanimous) console.log(`  Round 1 was unanimous on ${result.unanimousRound1.option}: make the strongest unargued case a crux in Round 2`);
    if (result.round === 2) console.log(`  quick mode: Round 3 ${result.needsRound3 ? 'needed' : 'can be skipped'}`);
    for (const p of result.problems) console.log(`  problem: ${p}`);
  }
  return 0;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invoked) process.exit(main(process.argv.slice(2)));
