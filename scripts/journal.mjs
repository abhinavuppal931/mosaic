// Thesis journal CLI.
//
//   node scripts/journal.mjs list [--json]                              tracked theses, next re-check first
//   node scripts/journal.mjs show <TICKER>                              the full journal for one ticker
//   node scripts/journal.mjs add <session dir>                          record a finished council
//   node scripts/journal.mjs diff <TICKER> --pack <data-pack.json> [--out <dir>]
//                                                                       what changed since the last pack (recheck)
// Options: --home <dir> --plugin-data <dir> (where journal/ lives), --journal <dir> to override.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from '../data/lib/args.mjs';
import { paths } from '../data/lib/paths.mjs';
import { readJson } from './lib/session.mjs';
import { journalKey, buildEntry, appendEntry, readJournal, listJournal, diffPacks, renderChanges } from './lib/journal.mjs';
import { isMain } from '../data/lib/entry.mjs';

export function main(argv, { now = () => Date.now() } = {}) {
  const args = parseArgs(argv, { booleans: ['json'] });
  const [cmd, target] = args._;
  const dir = typeof args.journal === 'string' ? path.resolve(args.journal) : paths({ home: args.home, pluginData: args.pluginData }).journal;
  const today = new Date(now()).toISOString().slice(0, 10);
  try {
    if (cmd === 'list') {
      const rows = listJournal(dir, today);
      if (args.json) console.log(JSON.stringify(rows, null, 2));
      else if (!rows.length) console.log(`No theses tracked yet (${dir}).`);
      else for (const r of rows) console.log(`${r.key.padEnd(10)} ${String(r.label).padEnd(26)} option ${r.recommended ?? '-'}  last ${r.lastVerdict}  re-check ${r.nextRecheck ?? '-'}${r.due ? '  DUE' : ''}  (${r.entries} verdict${r.entries === 1 ? '' : 's'})`);
      return 0;
    }
    if (cmd === 'show') {
      const doc = target && readJournal(dir, target.toUpperCase());
      if (!doc) throw new Error(`no journal for ${target}`);
      console.log(JSON.stringify(doc, null, 2));
      return 0;
    }
    if (cmd === 'add') {
      if (!target) throw new Error('add needs a session folder');
      const s = path.resolve(target);
      const council = readJson(path.join(s, 'council.json'));
      if (!council) throw new Error(`no council.json in ${s}`);
      const pack = readJson(path.join(s, 'data-pack.json'));
      const entry = buildEntry({ council, verdict: readJson(path.join(s, 'verdict.json')), scores: readJson(path.join(s, 'scores.json')), pack, lean: readJson(path.join(s, 'lean.json')), sessionPath: s, now });
      const key = journalKey(council);
      const company = pack?.facts?.find((f) => f.key === 'company_name')?.value || null;
      const doc = appendEntry(dir, key, entry, { company, thesis: council.thesis || null });
      console.log(`Journaled ${key}: ${entry.label} on option ${entry.recommended ?? '-'}; next re-check ${doc.next_recheck}. File: ${path.join(dir, key + '.json')}`);
      return 0;
    }
    if (cmd === 'diff') {
      if (!target || typeof args.pack !== 'string') throw new Error('diff needs <TICKER> --pack <data-pack.json>');
      const key = target.toUpperCase();
      const doc = readJournal(dir, key);
      if (!doc?.entries?.length) throw new Error(`no journal entries for ${key}: run a full council first`);
      const pack = JSON.parse(fs.readFileSync(args.pack, 'utf8'));
      const d = diffPacks(doc.entries[doc.entries.length - 1], pack);
      const md = renderChanges(d, key);
      if (typeof args.out === 'string') {
        fs.mkdirSync(args.out, { recursive: true });
        fs.writeFileSync(path.join(args.out, 'changes.json'), JSON.stringify(d, null, 2) + '\n');
        fs.writeFileSync(path.join(args.out, 'changes.md'), md);
      }
      if (args.json) console.log(JSON.stringify(d, null, 2));
      else process.stdout.write(md);
      return 0;
    }
    process.stderr.write('usage: node scripts/journal.mjs list | show <TICKER> | add <session> | diff <TICKER> --pack <file> [--out <dir>]\n');
    return 64;
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return 1;
  }
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
