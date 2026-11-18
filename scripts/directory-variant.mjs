// Turns a checkout of main into the variant the claude.ai plugin directory accepts
// from an unverified publisher. CI runs it on every push to main and publishes the
// result as the `directory` branch (see .github/workflows/directory-branch.yml).
//
// The directory refuses three things that main keeps on purpose:
// - allowed-tools beyond Read, Grep, Glob and LS. Main pre-approves the plugin's own
//   scripts so a council runs without prompts; directory installs ask instead.
// - files that are not Markdown, text, JSON, YAML or images (here, .gitleaks.toml).
// - package.json fields outside its list, such as scripts.
//
// Usage: node scripts/directory-variant.mjs [root]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const rel = (p) => path.join(root, p);

const PACKAGE_FIELDS = new Set(['name', 'displayName', 'version', 'description', 'keywords', 'homepage', 'bugs', 'license', 'author', 'contributors', 'maintainers', 'funding', 'repository', 'private', 'type', 'files', 'engines', '$schema']);
const REMOVE = ['.gitleaks.toml'];

export function stripAllowedTools(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return text;
  const kept = m[1].split(/\r?\n/).filter((line) => !/^allowed-tools\s*:/.test(line));
  return text.replace(m[1], kept.join('\n'));
}

export function stripPackage(json) {
  const out = {};
  for (const [k, v] of Object.entries(json)) if (PACKAGE_FIELDS.has(k)) out[k] = v;
  return out;
}

function walk(dir, hits = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, hits);
    else hits.push(p);
  }
  return hits;
}

export function run() {
  const changed = [];
  for (const file of walk(root)) {
    const name = path.basename(file);
    if (name === 'SKILL.md') {
      const before = fs.readFileSync(file, 'utf8');
      const after = stripAllowedTools(before);
      if (after !== before) { fs.writeFileSync(file, after); changed.push(path.relative(root, file)); }
    } else if (name === 'package.json') {
      const before = JSON.parse(fs.readFileSync(file, 'utf8'));
      const after = stripPackage(before);
      if (Object.keys(after).length !== Object.keys(before).length) {
        fs.writeFileSync(file, JSON.stringify(after, null, 2) + '\n');
        changed.push(path.relative(root, file));
      }
    }
  }
  for (const p of REMOVE) if (fs.existsSync(rel(p))) { fs.rmSync(rel(p)); changed.push(`${p} (removed)`); }
  return changed;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('directory-variant.mjs')) {
  for (const line of run()) console.log(line);
}
