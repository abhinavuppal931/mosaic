// Seat checks for ABH-329 (brains and seat agents). Zero dependencies, node:test.
//
// Offline checks run anywhere: the roster, the 13 agent files, the 13 brains, plain-text rules,
// and that every quoted source id exists in that brain's sources.md. The verbatim quote check
// against the fetched corpus needs build/<slug>/ and lives in skills/newseat/scripts/check_all.mjs.
//
// The smoke-session checks use the core session's parser, scorer and citation checker
// (scripts/lib/*.mjs). They are skipped when those files are not present.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROSTER = path.join(ROOT, 'skills', 'mosaic', 'roster.json');
const BRAINS = path.join(ROOT, 'skills', 'mosaic', 'brains');
const SESSION = path.join(ROOT, 'tests', 'seats', 'smoke', 'session-msft');
const BRAIN_FILES = ['_hot.md', 'frameworks.md', 'principles.md', 'positions.md', 'voice.md', 'stories.md', 'selling.md', 'sources.md'];
const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
const read = (p) => fs.readFileSync(p, 'utf8');
const mdFiles = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));

test('roster has the 13 seats, the default board and the guards', () => {
  assert.equal(roster.seats.length, 13);
  assert.ok(['ask', 'auto', 'default'].includes(roster.board));
  assert.deepEqual(roster.default, ['buffett', 'munger', 'damodaran', 'marks', 'taleb', 'druckenmiller', 'burry']);
  const keys = roster.seats.map((s) => s.key);
  for (const field of ['key', 'slug', 'short']) assert.equal(new Set(roster.seats.map((s) => s[field])).size, 13, `${field} is unique`);
  for (const k of roster.default) assert.ok(keys.includes(k), `default seat ${k} exists`);
  for (const s of roster.seats) {
    for (const f of ['key', 'name', 'short', 'slug', 'agent', 'role', 'question', 'dimension', 'color']) assert.ok(s[f], `${s.key}.${f}`);
    assert.match(s.color, /^#[0-9a-f]{6}$/i);
    assert.equal(s.agent, `seat-${s.key}`);
    assert.ok(s.guard === null || s.guard === 'ruin' || s.guard === 'bear');
  }
  assert.deepEqual(roster.guards, { ruin: 'taleb', bear: 'burry' });
  assert.equal(roster.seats.find((s) => s.key === 'taleb').guard, 'ruin');
  assert.equal(roster.seats.find((s) => s.key === 'burry').guard, 'bear');
  assert.equal(roster.seats.filter((s) => s.guard).length, 2);
});

test('every seat has an agent file in the plugin shape', () => {
  for (const s of roster.seats) {
    const file = path.join(ROOT, 'agents', `${s.agent}.md`);
    assert.ok(fs.existsSync(file), file);
    const text = read(file);
    const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    assert.ok(front, `${s.agent} has frontmatter`);
    assert.match(front[1], new RegExp(`^name: ${s.agent}$`, 'm'));
    assert.match(front[1], /^tools: Read, Grep, Glob$/m);
    const desc = front[1].match(/^description: (.*)$/m)[1];
    assert.ok(!/: /.test(desc), `${s.agent} description has no colon-space`);
    assert.ok(text.includes(`\${CLAUDE_PLUGIN_ROOT}/skills/mosaic/brains/${s.slug}/`), `${s.agent} plugin brain path`);
    assert.ok(text.includes(`skills/mosaic/brains/${s.slug}/`), `${s.agent} clone brain path`);
    for (const h of ['## Your brain', '## Your lens', '## How you talk', '## How you debate', '## Where your lens misfires', '## Never']) assert.ok(text.includes(h), `${s.agent} ${h}`);
    assert.match(text, /never claim to be/i);
    assert.match(text, /price target/i);
  }
});

test('every seat has a complete brain', () => {
  for (const s of roster.seats) {
    for (const f of BRAIN_FILES) assert.ok(fs.existsSync(path.join(BRAINS, s.slug, f)), `${s.slug}/${f}`);
    const hot = read(path.join(BRAINS, s.slug, '_hot.md'));
    assert.match(hot, /misfire/i, `${s.slug} _hot.md names where the lens misfires`);
    assert.match(read(path.join(BRAINS, s.slug, 'sources.md')), /Depth/, `${s.slug} sources.md states its depth`);
  }
});

test('no em or en dashes in brains, agents, roster or the newseat skill', () => {
  const files = [ROSTER, ...mdFiles(path.join(ROOT, 'agents'))];
  for (const s of roster.seats) files.push(...mdFiles(path.join(BRAINS, s.slug)));
  for (const dir of ['skills/newseat', 'skills/newseat/references']) files.push(...mdFiles(path.join(ROOT, dir)));
  for (const f of files) assert.ok(!/[\u2013\u2014]/.test(read(f)), `${path.relative(ROOT, f)} has an em or en dash`);
});

test('every quoted source id exists in that brain', () => {
  const quote = /["“][^"“”\n]{12,600}["”][^\n"“]{0,40}?[(\[]((?:S\d{3})(?:\s*[,;]\s*S\d{3})*)/g;
  for (const s of roster.seats) {
    const ids = new Set([...read(path.join(BRAINS, s.slug, 'sources.md')).matchAll(/^- (S\d{3}) \|/gm)].map((m) => m[1]));
    assert.ok(ids.size > 0, `${s.slug} sources.md lists ids`);
    let n = 0;
    for (const f of mdFiles(path.join(BRAINS, s.slug))) {
      for (const m of read(f).matchAll(quote)) {
        for (const id of m[1].split(/\s*[,;]\s*/)) { assert.ok(ids.has(id), `${s.slug}/${path.basename(f)} cites ${id}`); n++; }
      }
    }
    assert.ok(n >= 150, `${s.slug} has ${n} sourced quotes`);
  }
});

// ------------------------------------------------------------- smoke session (needs core scripts)
const lib = (name) => path.join(ROOT, 'scripts', 'lib', `${name}.mjs`);
const haveCore = ['cards', 'roster', 'scoring', 'citations', 'session'].every((n) => fs.existsSync(lib(n)));
const load = (name) => import(pathToFileURL(lib(name)).href);

test('smoke session: all 13 Round 1 cards parse with the core parser', { skip: !haveCore && 'core scripts not present' }, async () => {
  const { seatResolver } = await load('roster');
  const { parseRound } = await load('cards');
  const cards = parseRound(read(path.join(SESSION, 'round-1.md')), seatResolver(roster));
  assert.deepEqual(Object.keys(cards).sort(), roster.seats.map((s) => s.key).sort());
  for (const [key, c] of Object.entries(cards)) {
    assert.ok(c.stance, `${key} STANCE`);
    if (c.abstain) continue;
    assert.deepEqual(Object.keys(c.scores).sort(), ['A', 'B', 'C', 'D'], `${key} scores every option`);
    assert.ok(c.pillar !== null, `${key} PILLAR SCORE`);
    assert.ok(c.conviction !== null, `${key} CONVICTION`);
    assert.ok(c.evidence, `${key} EVIDENCE`);
    assert.ok(c.ruin, `${key} RUIN RISK`);
    assert.ok(c.door, `${key} DOOR`);
    assert.ok(c.factIds.length > 0, `${key} cites pack facts`);
  }
});

test('smoke session: citations are clean against the real brains', { skip: !haveCore && 'core scripts not present' }, async () => {
  const { seatResolver } = await load('roster');
  const { checkSession } = await load('citations');
  const report = checkSession({ session: SESSION, brainsDir: BRAINS, roster, resolve: seatResolver(roster) });
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors.slice(0, 5)));
  assert.ok(report.ok);
  assert.ok(report.stats.quotesVerified >= 13, `quotes verified: ${report.stats.quotesVerified}`);
  assert.equal(report.stats.factIdsUnknown, 0);
});

test('smoke session: the council math runs on the 13 cards', { skip: !haveCore && 'core scripts not present' }, async () => {
  const { seatResolver } = await load('roster');
  const { readSession } = await load('session');
  const { scoreCouncil } = await load('scoring');
  const s = readSession(SESSION, seatResolver(roster));
  const r = scoreCouncil({ council: s.council, rounds: s.rounds, lean: null, coverage: s.pack?.coverage?.score ?? null, draft: null, roster });
  assert.equal(r.round, 1);
  assert.deepEqual(r.options.map((o) => o.id ?? o.option).filter(Boolean).sort(), ['A', 'B', 'C', 'D']);
  assert.ok(r.recommended);
  assert.deepEqual(r.problems, []);
});
