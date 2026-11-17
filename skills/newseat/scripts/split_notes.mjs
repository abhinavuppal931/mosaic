#!/usr/bin/env node
// Split a seat's batch notes into one file per section kind, keeping each source heading.
// usage: node skills/newseat/scripts/split_notes.mjs build/<slug>   -> <build>/sections/{frameworks,rules,positions,selling,stories,voice,limits,books,summary}.md
import fs from "node:fs";
import path from "node:path";
const build = process.argv[2];
const dir = path.join(build, "notes");
const out = path.join(build, "sections");
fs.mkdirSync(out, { recursive: true });
const kinds = { frameworks: /^###\s*Frameworks/i, rules: /^###\s*Rules/i, positions: /^###\s*Positions/i, selling: /^###\s*Selling/i, stories: /^###\s*Stories/i, voice: /^###\s*Voice/i, limits: /^###\s*Limits/i, books: /^###\s*Books/i };
const buf = Object.fromEntries([...Object.keys(kinds), "summary"].map((k) => [k, []]));
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
  let src = "", kind = null, wroteHead = {};
  for (const line of fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/)) {
    if (/^##\s+S\d{3}/.test(line)) { src = line; kind = null; wroteHead = {}; continue; }
    if (/^##\s+Batch summary/i.test(line)) { src = `## ${f} batch summary`; kind = "summary"; wroteHead = {}; buf.summary.push("", src); continue; }
    const k = Object.entries(kinds).find(([, re]) => re.test(line));
    if (k) { kind = k[0]; continue; }
    if (!kind || !line.trim()) continue;
    if (kind !== "summary" && !wroteHead[kind]) { buf[kind].push("", src); wroteHead[kind] = true; }
    buf[kind].push(line);
  }
}
for (const [k, lines] of Object.entries(buf)) {
  fs.writeFileSync(path.join(out, `${k}.md`), `# ${k} (from all batch notes)\n` + lines.join("\n") + "\n");
  console.log(`${k}: ${lines.join(" ").split(/\s+/).length} words`);
}
