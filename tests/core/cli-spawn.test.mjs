// Every CLI run as a real child process from a folder whose path contains spaces, the way
// a user runs it. Catches entry-point checks that silently skip main() (Windows drive
// letters, percent-encoded paths). No network: these commands do not fetch.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FIXTURES } from './helpers/fake-fetch.mjs';
import { isMain } from '../../data/lib/entry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let copy;

before(() => {
  copy = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic spawn test '));
  for (const dir of ['data', 'scripts']) fs.cpSync(path.join(ROOT, dir), path.join(copy, dir), { recursive: true });
});

function run(script, args) {
  const env = { ...process.env };
  for (const k of ['MOSAIC_HOME', 'MOSAIC_SEC_CONTACT', 'FMP_API_KEY', 'FRED_API_KEY', 'FINNHUB_API_KEY', 'MASSIVE_API_KEY', 'POLYGON_API_KEY', 'BLS_API_KEY']) delete env[k];
  return spawnSync(process.execPath, [path.join(copy, script), ...args], { encoding: 'utf8', env, timeout: 30_000 });
}

test('the copy really sits under a path with spaces', () => {
  assert.match(copy, / /);
});

test('data/cli.mjs paths prints JSON', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic home '));
  const r = run('data/cli.mjs', ['paths', '--home', home]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).home, path.resolve(home));
});

test('data/cli.mjs with no command prints help and exits 1', () => {
  const r = run('data/cli.mjs', []);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Mosaic data CLI/);
});

test('scripts/score.mjs prints the verdict math', () => {
  const r = run('scripts/score.mjs', [path.join(FIXTURES, 'session-msft'), '--roster', path.join(FIXTURES, 'roster.json'), '--no-write']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Round 3: PROCEED WITH CONDITIONS on option B/);
});

test('scripts/check-citations.mjs prints its counts', () => {
  const r = run('scripts/check-citations.mjs', [path.join(FIXTURES, 'session-msft'), '--roster', path.join(FIXTURES, 'roster.json'), '--brains', path.join(FIXTURES, 'brains'), '--no-write']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /quotes verified: 3/);
});

test('scripts/journal.mjs list prints something', () => {
  const r = run('scripts/journal.mjs', ['list', '--journal', fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic journal '))]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /No theses tracked yet/);
});

test('isMain handles Windows-style and percent-encoded file URLs', () => {
  const file = path.join(copy, 'data', 'cli.mjs');
  const url = new URL(`file://${process.platform === 'win32' ? '/' : ''}${file.split(path.sep).join('/').replace(/ /g, '%20')}`).href;
  assert.ok(url.includes('%20'));
  assert.equal(isMain(url, file), true);
  assert.equal(isMain(url, path.join(copy, 'data', 'other.mjs')), false);
  assert.equal(isMain(url, undefined), false);
});
