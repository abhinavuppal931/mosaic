import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripAllowedTools, stripPackage } from '../../scripts/directory-variant.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'directory-variant.mjs');

test('stripAllowedTools removes only the allowed-tools line from the front matter', () => {
  const src = '---\r\nname: mosaic\r\ndescription: x\r\nallowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/a.mjs":*) Read(~/.mosaic/**)\r\nargument-hint: "<q>"\r\n---\r\n\r\nallowed-tools: in the body stays\r\n';
  const out = stripAllowedTools(src);
  assert.ok(!/^allowed-tools:.*Bash/m.test(out));
  assert.match(out, /name: mosaic/);
  assert.match(out, /argument-hint: "<q>"/);
  assert.match(out, /allowed-tools: in the body stays/);
});

test('stripPackage keeps only fields the directory accepts', () => {
  const out = stripPackage({ name: 'mosaic', version: '0.1.0', private: true, type: 'module', engines: { node: '>=20' }, scripts: { start: 'x' }, devDependencies: {} });
  assert.deepEqual(Object.keys(out), ['name', 'version', 'private', 'type', 'engines']);
});

test('the script rewrites a checkout in place', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-dir-'));
  fs.mkdirSync(path.join(dir, 'skills', 'mosaic'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'room'));
  fs.writeFileSync(path.join(dir, 'skills', 'mosaic', 'SKILL.md'), '---\nname: mosaic\nallowed-tools: Read\n---\nBody\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'mosaic', scripts: { start: 'x' } }));
  fs.writeFileSync(path.join(dir, 'room', 'package.json'), JSON.stringify({ name: 'mosaic-room', scripts: { start: 'x' } }));
  fs.writeFileSync(path.join(dir, '.gitleaks.toml'), 'title = "x"\n');
  const log = execFileSync(process.execPath, [script, dir], { encoding: 'utf8' });
  assert.match(log, /\.gitleaks\.toml \(removed\)/);
  assert.equal(fs.existsSync(path.join(dir, '.gitleaks.toml')), false);
  assert.ok(!fs.readFileSync(path.join(dir, 'skills', 'mosaic', 'SKILL.md'), 'utf8').includes('allowed-tools'));
  for (const p of ['package.json', path.join('room', 'package.json')]) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8')).scripts, undefined);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});
