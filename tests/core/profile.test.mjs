// The first-run preferences in <home>/profile.json: read tolerantly, never block a council, and
// show in the first-run check as one plain line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeProfile, readProfile, profileSummary, PROFILE_FIELDS } from '../../data/lib/profile.mjs';
import { main as dataCli, firstRunCheck } from '../../data/cli.mjs';
import { loadConfig } from '../../data/lib/config.mjs';
import { createEnv } from '../../data/lib/env.mjs';
import { paths as resolvePaths } from '../../data/lib/paths.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-profile-'));

async function capture(fn) {
  const out = [];
  const log = console.log;
  console.log = (...a) => out.push(a.join(' '));
  try {
    const code = await fn();
    return { code, out: out.join('\n') };
  } finally {
    console.log = log;
  }
}

test('normalize: keeps allowed values, fills defaults, drops unknown keys and values', () => {
  assert.deepEqual(normalizeProfile({}), { schema: 'mosaic.profile/1', experience: 'some', focus: [], horizon: 'ask', mode: 'full', board: null });
  const p = normalizeProfile({ experience: 'pro', focus: ['portfolio', 'portfolio', 'crypto', 'macro'], horizon: '3-5y', mode: 'quick', board: 'auto', created: '2026-11-20T10:00:00Z', email: 'x@y.z' });
  assert.deepEqual(p, { schema: 'mosaic.profile/1', experience: 'pro', focus: ['portfolio', 'macro'], horizon: '3-5y', mode: 'quick', board: 'auto', created: '2026-11-20' });
  assert.equal(normalizeProfile({ experience: 'guru', mode: 7 }).experience, 'some');
  assert.equal(normalizeProfile(null).mode, 'full');
  assert.equal(normalizeProfile(['x']).horizon, 'ask');
  assert.ok(!('email' in p), 'nothing personal is kept');
});

test('read: missing, ok and broken files', () => {
  const home = tmp();
  assert.equal(readProfile(home).state, 'missing');
  fs.writeFileSync(path.join(home, 'profile.json'), '﻿{"experience":"new","horizon":"5y-plus"}');
  const ok = readProfile(home);
  assert.equal(ok.state, 'ok');
  assert.equal(ok.profile.experience, 'new');
  fs.writeFileSync(path.join(home, 'profile.json'), '{"experience": "new",');
  assert.equal(readProfile(home).state, 'broken');
  fs.writeFileSync(path.join(home, 'profile.json'), '[]');
  assert.equal(readProfile(home).state, 'broken');
});

test('summary reads as plain words', () => {
  assert.equal(profileSummary(normalizeProfile({ experience: 'new', horizon: '3-5y', mode: 'quick' })), 'new to investing, horizon three to five years, quick councils');
  assert.equal(profileSummary(normalizeProfile({})), 'some experience, horizon asked each time, full councils');
});

test('every field has a default that is one of its own values', () => {
  for (const [k, f] of Object.entries(PROFILE_FIELDS)) {
    if (f.list) assert.ok(Array.isArray(f.default), k);
    else if (f.default !== null) assert.ok(f.values.includes(f.default), k);
  }
});

test('first-run check: preferences are information only and never stop a council', () => {
  const home = tmp();
  const p = resolvePaths({ home });
  const config = loadConfig({ userConfigPath: p.userConfig, overrides: { providers: { 'sec-edgar': { contact: 'Jane Doe jane@example.com' } } } });
  const env = createEnv({ files: [p.envFile], env: {} });
  const fresh = firstRunCheck(p, config, env);
  const item = fresh.items.find((i) => i.name === 'Your preferences');
  assert.equal(item.ok, true);
  assert.equal(item.label, 'NEW');
  assert.equal(fresh.profile, 'missing');
  assert.equal(fresh.ready, true, 'a new user with a contact is ready');
  fs.writeFileSync(path.join(home, 'profile.json'), JSON.stringify({ experience: 'pro', horizon: '1-3y', mode: 'full' }));
  const set = firstRunCheck(p, config, env);
  assert.equal(set.profile, 'ok');
  assert.match(set.items.find((i) => i.name === 'Your preferences').detail, /^experienced, horizon one to three years, full councils$/);
  fs.writeFileSync(path.join(home, 'profile.json'), 'not json');
  const broken = firstRunCheck(p, config, env);
  assert.equal(broken.profile, 'broken');
  assert.equal(broken.ready, true);
});

test('setup --status prints the preferences line and keeps its exit code', async () => {
  const home = tmp();
  const r = await capture(() => dataCli(['setup', '--status', '--home', home]));
  assert.equal(r.code, 3, 'only the missing SEC contact counts against ready');
  assert.match(r.out, /Your preferences\s+NEW\s+not set yet; \/mosaic asks a few quick questions the first time/);
  assert.match(r.out, /One item to fix before a council\./);
  fs.writeFileSync(path.join(home, 'profile.json'), JSON.stringify({ experience: 'new', horizon: '5y-plus', mode: 'quick' }));
  const r2 = await capture(() => dataCli(['setup', '--status', '--home', home]));
  assert.match(r2.out, /Your preferences\s+ok\s+new to investing, horizon five years or more, quick councils/);
});
