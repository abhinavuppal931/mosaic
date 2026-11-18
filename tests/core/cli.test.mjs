// The command-line entry points, run in-process with fixtures and a fake fetch.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIXTURES, blockNetwork, fakeFetch } from './helpers/fake-fetch.mjs';
import { FREE_ROUTES, NOW, SEC_CONTACT } from './helpers/setup.mjs';
import { main as dataCli, firstRunCheck } from '../../data/cli.mjs';
import { loadConfig } from '../../data/lib/config.mjs';
import { createEnv } from '../../data/lib/env.mjs';
import { paths as resolvePaths } from '../../data/lib/paths.mjs';
import { main as scoreCli } from '../../scripts/score.mjs';
import { main as citeCli } from '../../scripts/check-citations.mjs';
import { main as journalCli } from '../../scripts/journal.mjs';

const ROSTER = path.join(FIXTURES, 'roster.json');
const BRAINS = path.join(FIXTURES, 'brains');
const SESSION = path.join(FIXTURES, 'session-msft');
const KEY_VARS = ['FMP_API_KEY', 'FRED_API_KEY', 'FINNHUB_API_KEY', 'MASSIVE_API_KEY', 'POLYGON_API_KEY', 'BLS_API_KEY', 'MOSAIC_SEC_CONTACT', 'MOSAIC_HOME'];
const saved = {};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-cli-'));
/** Injected seams: recorded responses, the fixture date, and a virtual clock so rate limits cost no time. */
function seams(routes = FREE_ROUTES) {
  let t = 0;
  return { fetchImpl: fakeFetch(routes), now: () => NOW, clock: () => t, sleep: async (ms) => { t += ms; } };
}

before(() => {
  blockNetwork();
  for (const k of KEY_VARS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
after(() => {
  for (const k of KEY_VARS) if (saved[k] !== undefined) process.env[k] = saved[k];
});

/** Run fn with console output captured. */
async function capture(fn) {
  const out = [];
  const err = [];
  const log = console.log;
  const w = process.stdout.write;
  const e = process.stderr.write;
  console.log = (...a) => out.push(a.join(' '));
  process.stdout.write = (s) => (out.push(String(s)), true);
  process.stderr.write = (s) => (err.push(String(s)), true);
  try {
    const code = await fn();
    return { code, out: out.join('\n'), err: err.join('\n') };
  } finally {
    console.log = log;
    process.stdout.write = w;
    process.stderr.write = e;
  }
}

function copySession() {
  const dir = tmp();
  for (const f of fs.readdirSync(SESSION)) fs.copyFileSync(path.join(SESSION, f), path.join(dir, f));
  return dir;
}

describe('data/cli.mjs', () => {
  test('pack --ticker writes data-pack.json and data-pack.md', async () => {
    const home = tmp();
    const session = path.join(tmp(), 's');
    fs.writeFileSync(path.join(home, '.env.local'), `MOSAIC_SEC_CONTACT="${SEC_CONTACT}"\n`);
    const r = await capture(() => dataCli(['pack', '--ticker', 'msft', '--session', session, '--home', home, '--no-cache'], seams()));
    assert.equal(r.code, 0, r.err);
    const pack = JSON.parse(fs.readFileSync(path.join(session, 'data-pack.json'), 'utf8'));
    assert.equal(pack.symbol, 'MSFT');
    assert.ok(fs.readFileSync(path.join(session, 'data-pack.md'), 'utf8').includes('# Data pack: MSFT'));
    assert.match(r.out, /ticker pack for MSFT: \d+ facts/);
    assert.ok(!r.out.includes('tests@example.com'), 'the SEC contact is never printed');
  });

  test('pack without a SEC contact says how to fix it', async () => {
    const r = await capture(() => dataCli(['pack', '--ticker', 'MSFT', '--home', tmp(), '--no-cache'], seams()));
    assert.equal(r.code, 0);
    assert.match(r.err, /no SEC contact set/);
    assert.match(r.out, /financials\s+error/);
  });

  test('pack --macro and --portfolio', async () => {
    const m = await capture(() => dataCli(['pack', '--macro', '--home', tmp(), '--no-cache'], seams()));
    assert.equal(m.code, 0);
    assert.match(m.out, /macro pack: \d+ facts/);
    const holdings = path.join(tmp(), 'h.json');
    fs.writeFileSync(holdings, JSON.stringify({ holdings: [{ ticker: 'MSFT', weight: 60 }, { ticker: 'SPY', weight: 40 }] }));
    const p = await capture(() => dataCli(['pack', '--portfolio', holdings, '--home', tmp(), '--no-cache'], seams()));
    assert.equal(p.code, 0, p.err);
    assert.match(p.out, /portfolio pack: \d+ facts/);
  });

  test('usage errors exit 64', async () => {
    assert.equal((await capture(() => dataCli(['pack', '--home', tmp()]))).code, 64);
    assert.equal((await capture(() => dataCli(['pack', '--ticker', '$$$', '--home', tmp()]))).code, 64);
    assert.equal((await capture(() => dataCli(['frobnicate']))).code, 64);
    assert.equal((await capture(() => dataCli([]))).code, 1);
  });

  test('check-provider runs the contract test for one adapter', async () => {
    const r = await capture(() => dataCli(['check-provider', 'yahoo', '--symbol', 'MSFT', '--home', tmp()], seams()));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /PASS\s+quote/);
    assert.match(r.out, /PASS\s+priceHistory/);
    const missing = await capture(() => dataCli(['check-provider', 'fmp', '--home', tmp()], seams([])));
    assert.match(missing.out, /SKIPPED\s+quote\s+no key \(FMP_API_KEY\)/);
    const unknown = await capture(() => dataCli(['check-provider', 'nope', '--home', tmp()]));
    assert.equal(unknown.code, 64);
  });

  test('setup asks for the SEC contact, stores it in the user config, and never echoes it', async () => {
    const home = tmp();
    const asked = [];
    const r = await capture(() => dataCli(['setup', '--home', home], { prompt: async (q) => (asked.push(q), 'Jane Doe jane@example.com') }));
    assert.equal(r.code, 0);
    assert.match(asked[0], /name and email/);
    assert.ok(!r.out.includes('jane@example.com'));
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'mosaic.config.json'), 'utf8'));
    assert.equal(cfg.providers['sec-edgar'].contact, 'Jane Doe jane@example.com');
    const bad = await capture(() => dataCli(['setup', '--home', home], { prompt: async () => 'no email here' }));
    assert.equal(bad.code, 64);
    const st = await capture(() => dataCli(['setup', '--status', '--home', home]));
    assert.match(st.out, /SEC contact\s+set \(user config\)/);
    assert.match(st.out, /FMP_API_KEY\s+not set/);
    assert.ok(!st.out.includes('jane@example.com'));
  });

  test('setup --status first-run check: ready with a contact, exit 0', async () => {
    const home = tmp();
    await capture(() => dataCli(['setup', '--home', home], { prompt: async () => 'Jane Doe jane@example.com' }));
    const r = await capture(() => dataCli(['setup', '--status', '--home', home]));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^First-run check/m);
    assert.match(r.out, /Node\.js\s+ok/);
    assert.match(r.out, /Mosaic home\s+ok/);
    assert.match(r.out, /SEC contact\s+ok/);
    assert.match(r.out, /^Ready\.$/m);
    assert.ok(!/next step:/.test(r.out));
  });

  test('setup --status first-run check: a missing contact exits 3 with a next step that names setup', async () => {
    const home = tmp();
    const r = await capture(() => dataCli(['setup', '--status', '--home', home]));
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /SEC contact\s+FIX/);
    assert.match(r.out, /next step: .*setup/);
    assert.match(r.out, /One item to fix before a council\./);
    assert.ok(!r.out.includes('jane@example.com'));
  });

  test('first-run check: Node older than 20 fails with a Node.js 20 next step', () => {
    const home = tmp();
    const p = resolvePaths({ home });
    const config = loadConfig({ userConfigPath: p.userConfig });
    const env = createEnv({ files: [p.envFile] });
    const check = firstRunCheck(p, config, env, { nodeVersion: '18.19.0' });
    const node = check.items.find((i) => i.name === 'Node.js');
    assert.equal(node.ok, false);
    assert.match(node.next, /Node\.js 20/);
    assert.equal(check.ready, false);
    assert.equal(firstRunCheck(p, config, env, { nodeVersion: '20.0.0' }).items.find((i) => i.name === 'Node.js').ok, true);
  });

  test('first-run check: an unwritable home fails with a next step', async () => {
    // A path under a regular file cannot be created (ENOTDIR), even as root.
    const file = path.join(tmp(), 'a-file');
    fs.writeFileSync(file, 'x');
    const home = path.join(file, 'home');
    const r = await capture(() => dataCli(['setup', '--status', '--home', home]));
    assert.equal(r.code, 3, r.out);
    assert.match(r.out, /Mosaic home\s+FIX/);
    assert.match(r.out, /next step: .*MOSAIC_HOME/);
  });

  test('setup refuses a contact on the command line and explains the alternatives without a terminal', async () => {
    const home = tmp();
    const argv = await capture(() => dataCli(['setup', '--user-agent', 'Jane jane@example.com', '--home', home]));
    assert.equal(argv.code, 64);
    assert.ok(!fs.existsSync(path.join(home, 'mosaic.config.json')));
    // node --test runs files with piped stdio, so there is no terminal to ask on here.
    const noTty = await capture(() => dataCli(['setup', '--home', home], { prompt: null }));
    assert.equal(noTty.code, 1);
    assert.match(noTty.out, /Set MOSAIC_SEC_CONTACT=/);
    assert.ok(!fs.existsSync(path.join(home, 'mosaic.config.json')));
  });

  test('providers lists key status by name only; paths prints JSON', async () => {
    process.env.FMP_API_KEY = 'top-secret-fmp';
    try {
      const r = await capture(() => dataCli(['providers', '--home', tmp()]));
      assert.match(r.out, /fmp\s+key set/);
      assert.ok(!r.out.includes('top-secret-fmp'));
    } finally {
      delete process.env.FMP_API_KEY;
    }
    const home = tmp();
    const p = await capture(() => dataCli(['paths', '--home', home]));
    assert.equal(JSON.parse(p.out).journal, path.join(home, 'journal'));
  });
});

describe('scripts', () => {
  test('score.mjs writes scores.json for a session', async () => {
    const dir = copySession();
    const r = await capture(() => scoreCli([dir, '--roster', ROSTER]));
    assert.equal(r.code, 0);
    assert.match(r.out, /Round 3: PROCEED WITH CONDITIONS on option B/);
    assert.match(r.out, /B \(3x9 \+ 2x6 \+ 2x4\) \/ 7 = 6\.7/);
    assert.match(r.out, /on option B: 1 agree, 1 partly agree, 1 disagree \(from scores\)/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'scores.json'), 'utf8')).label, 'PROCEED WITH CONDITIONS');
    assert.equal((await capture(() => scoreCli([]))).code, 64);
    const noRoster = await capture(() => scoreCli([dir, '--roster', path.join(tmp(), 'nope.json')]));
    assert.equal(noRoster.code, 1);
    assert.match(noRoster.err, /roster not found/);
  });

  test('check-citations.mjs exits 0 when clean, 1 when not, and writes citations.json', async () => {
    const dir = copySession();
    const ok = await capture(() => citeCli([dir, '--roster', ROSTER, '--brains', BRAINS]));
    assert.equal(ok.code, 0, ok.out);
    assert.match(ok.out, /quotes verified: 3/);
    assert.ok(fs.existsSync(path.join(dir, 'citations.json')));
    fs.appendFileSync(path.join(dir, 'verdict.md'), '\nSee [F900].\n');
    const bad = await capture(() => citeCli([dir, '--roster', ROSTER, '--brains', BRAINS]));
    assert.equal(bad.code, 1);
    assert.match(bad.out, /FAIL unknown_fact \[verdict\.md\] F900/);
  });

  test('journal.mjs add, list, show and diff', async () => {
    const dir = copySession();
    const jdir = tmp();
    await capture(() => scoreCli([dir, '--roster', ROSTER]));
    const add = await capture(() => journalCli(['add', dir, '--journal', jdir], { now: () => NOW }));
    assert.equal(add.code, 0, add.err);
    assert.match(add.out, /Journaled MSFT: PROCEED WITH CONDITIONS on option B; next re-check 2027-01-29/);
    const list = await capture(() => journalCli(['list', '--journal', jdir], { now: () => NOW }));
    assert.match(list.out, /MSFT\s+PROCEED WITH CONDITIONS/);
    const show = await capture(() => journalCli(['show', 'msft', '--journal', jdir]));
    assert.equal(JSON.parse(show.out).entries.length, 1);
    const pack = JSON.parse(fs.readFileSync(path.join(dir, 'data-pack.json'), 'utf8'));
    pack.facts.find((f) => f.key === 'gross_margin').value = 0.6;
    const newPack = path.join(tmp(), 'data-pack.json');
    fs.writeFileSync(newPack, JSON.stringify(pack));
    const out = tmp();
    const diff = await capture(() => journalCli(['diff', 'MSFT', '--pack', newPack, '--journal', jdir, '--out', out]));
    assert.equal(diff.code, 0, diff.err);
    assert.match(diff.out, /TRIPPED: Gross margin below 65%/);
    assert.ok(fs.existsSync(path.join(out, 'changes.json')) && fs.existsSync(path.join(out, 'changes.md')));
    const none = await capture(() => journalCli(['diff', 'NVDA', '--pack', newPack, '--journal', jdir]));
    assert.equal(none.code, 1);
    assert.match(none.err, /no journal entries for NVDA/);
  });
});
