#!/usr/bin/env node
// Adapted from nateherkai/roast-room (.claude/skills/newroaster/scripts/check_quotes.mjs).
// Copyright (c) 2026 AI Automation Society. MIT License, see ../LICENSE-roast-room.txt.
// Changes for Mosaic: --lint (em and en dashes, quotes over 45 words, long quoted lines with no
// source id), a per-file summary, and --json output for the PR report.
//
// Check that every quote in a seat's notes or brain is verbatim in the source it cites.
//
//   node skills/newseat/scripts/check_quotes.mjs <build dir> <file or folder> [...] [--lint] [--json]
//
// A quote is text in double quotes followed within a few characters by a source id, like
// "..." (S014) or "..." (S014, S020). Each quote must appear in the corpus file of one of
// its ids. A quote found under a different id is reported with the right one; a quote found
// nowhere is reported as not found and must be cut or replaced. Quotes with "..." are checked
// piece by piece. Matching ignores case, punctuation and timestamps, so a dash inside a quote
// may be written as a comma. Exit code 1 when anything needs fixing.
//
// --lint (use it on a finished brain) also fails on: any em or en dash; a cited quote over 45
// words; a quoted passage of 8 or more words with no source id on the same line (quotation
// marks mean verbatim, so an unsourced quote is either a missing id or an invented line).
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const LINT = argv.includes("--lint");
const JSON_OUT = argv.includes("--json");
const [buildArg, ...targets] = argv.filter((a) => !a.startsWith("--"));
if (!buildArg || !targets.length) {
  console.error("usage: check_quotes.mjs <build dir> <file or folder> [...] [--lint] [--json]");
  process.exit(2);
}
const BUILD = path.resolve(buildArg);
const sources = JSON.parse(fs.readFileSync(path.join(BUILD, "sources.json"), "utf8"));

const norm = (s) => s.toLowerCase()
  .replace(/[‘’`]/g, "'").replace(/[“”]/g, '"')
  .replace(/'\s+(t|s|re|ll|ve|d|m)\b/g, "'$1")
  .replace(/\[\d\d:\d\d(:\d\d)?\]/g, " ")
  .replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const corpus = new Map(sources.map((s) => [s.id, norm(fs.readFileSync(path.join(BUILD, s.file), "utf8"))]));

const files = [];
const walk = (p) => {
  if (fs.statSync(p).isDirectory()) for (const n of fs.readdirSync(p).sort()) walk(path.join(p, n));
  else if (/\.md$/.test(p)) files.push(p);
};
for (const t of targets) walk(path.resolve(t));

const found = (q, id) => {
  const hay = corpus.get(id);
  if (!hay) return false;
  // "..." splits a quote into pieces that must each be in the source
  return q.split(/\.\.\.|…/).map(norm).filter((p) => p.split(" ").length >= 3).every((p) => hay.includes(p));
};

let ok = 0;
const wrong = [], missing = [], lint = [];
const perFile = {};
const re = /["“]([^"“”\n]{12,600})["”][^\n"“]{0,40}?[(\[]((?:S\d{3})(?:\s*[,;]\s*S\d{3})*)/g;
const anyQuote = /["“]([^"“”\n]{12,600})["”]/g;
for (const f of files) {
  const rel = path.relative(process.cwd(), f);
  const stat = (perFile[rel] = { verified: 0, failed: 0 });
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    const cited = new Set();
    for (const m of line.matchAll(re)) {
      const q = m[1];
      cited.add(m.index);
      if (norm(q).split(" ").length < 4) continue;
      const ids = m[2].split(/\s*[,;]\s*/);
      if (LINT && norm(q).split(" ").length > 45) lint.push(`${where}  quote over 45 words: "${q.slice(0, 80)}"`);
      if (ids.some((id) => found(q, id))) { ok++; stat.verified++; continue; }
      stat.failed++;
      const other = sources.find((s) => found(q, s.id));
      if (other) wrong.push(`${where}  cites ${ids.join(", ")}, but the quote is in ${other.id}: "${q.slice(0, 90)}"`);
      else missing.push(`${where}  not found in any source: "${q.slice(0, 110)}"`);
    }
    if (!LINT) return;
    if (/[\u2014\u2013]/.test(line)) lint.push(`${where}  em or en dash`);
    for (const m of line.matchAll(anyQuote)) {
      if (cited.has(m.index)) continue;
      if (norm(m[1]).split(" ").length >= 8 && !/S\d{3}/.test(line)) lint.push(`${where}  quoted passage with no source id: "${m[1].slice(0, 80)}"`);
    }
  });
}

if (JSON_OUT) {
  console.log(JSON.stringify({ verified: ok, wrongId: wrong.length, notFound: missing.length, lint: lint.length, files: perFile }, null, 2));
} else {
  console.log(`quotes verified: ${ok}; wrong source id: ${wrong.length}; not found: ${missing.length}${LINT ? `; lint: ${lint.length}` : ""}`);
  for (const w of wrong) console.log("  WRONG ID  " + w);
  for (const m of missing) console.log("  NOT FOUND " + m);
  for (const l of lint) console.log("  LINT      " + l);
}
process.exit(wrong.length || missing.length || lint.length ? 1 : 0);
