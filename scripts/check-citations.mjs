#!/usr/bin/env node
// Verify a council session: every cited fact id exists in data-pack.json, every quote
// attributed to a source id is verbatim in that seat's brain. Writes citations.json.
//
//   node scripts/check-citations.mjs <session dir> [--roster <file>] [--brains <dir>] [--json] [--no-write]
//
// Exit 0 when clean, 1 when any fact id or quote fails (the Chair removes those items and
// notes it), 64 on usage errors.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../data/lib/args.mjs';
import { paths } from '../data/lib/paths.mjs';
import { loadRoster, seatResolver } from './lib/roster.mjs';
import { checkSession } from './lib/citations.mjs';

export function main(argv) {
  const args = parseArgs(argv, { booleans: ['json', 'noWrite'] });
  const session = args._[0];
  if (!session || !fs.existsSync(session)) {
    process.stderr.write('usage: node scripts/check-citations.mjs <session dir> [--roster file] [--brains dir] [--json]\n');
    return 64;
  }
  const p = paths({ home: args.home, pluginData: args.pluginData });
  const rosterFile = typeof args.roster === 'string' ? args.roster : p.roster;
  const brainsDir = typeof args.brains === 'string' ? args.brains : p.brains;
  if (!fs.existsSync(rosterFile)) {
    process.stderr.write(`error: roster not found at ${rosterFile}\n`);
    return 1;
  }
  const roster = loadRoster(rosterFile);
  const report = checkSession({ session: path.resolve(session), brainsDir, roster, resolve: seatResolver(roster) });
  if (!args.noWrite) fs.writeFileSync(path.join(session, 'citations.json'), JSON.stringify(report, null, 2) + '\n');
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    const s = report.stats;
    console.log(`fact ids cited: ${s.factCitations} (unknown ${s.factIdsUnknown}, pointing at missing data ${s.factIdsMissingData}); quotes verified: ${s.quotesVerified}; quotes of earlier rounds or the brief: ${s.quotesInternal}; unverified: ${s.quotesUnverified}; numbers without a fact id: ${s.uncitedNumbers}`);
    for (const e of report.errors) console.log(`  FAIL ${e.type} [${e.file}${e.seat ? ` ${e.seat}` : ''}] ${e.id || ''} ${e.quote ? `"${e.quote}" ` : ''}${e.detail}`);
    for (const w of report.warnings) console.log(`  warn ${w.type} [${w.file}${w.seat ? ` ${w.seat}` : ''}] ${w.id || ''} ${w.detail}`);
  }
  return report.ok ? 0 : 1;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invoked) process.exit(main(process.argv.slice(2)));
