#!/usr/bin/env node
// Run the quote checker (with --lint) on every seat in the roster and print one table row per
// seat: sources, words, years, brain quotes verified, problems, and the smoke answer's result.
// Needs each seat's fetched corpus in build/<slug>/ (re-create one with fetch.mjs --rebuild).
//
//   node skills/newseat/scripts/check_all.mjs [--markdown]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, "skills", "mosaic", "roster.json"), "utf8"));
const CHECK = path.join(ROOT, "skills", "newseat", "scripts", "check_quotes.mjs");
const md = process.argv.includes("--markdown");

const run = (build, targets) => {
  const r = spawnSync(process.execPath, [CHECK, build, ...targets, "--lint", "--json"], { cwd: ROOT, encoding: "utf8" });
  try { return JSON.parse(r.stdout); } catch { return null; }
};

const rows = [];
let failed = false;
for (const s of roster.seats) {
  const build = path.join(ROOT, "build", s.slug);
  const brain = path.join(ROOT, "skills", "mosaic", "brains", s.slug);
  if (!fs.existsSync(path.join(build, "sources.json"))) { rows.push([s.short, "no build folder", "", "", "", "", ""]); failed = true; continue; }
  const src = JSON.parse(fs.readFileSync(path.join(build, "sources.json"), "utf8"));
  const words = src.reduce((n, x) => n + (x.words || 0), 0);
  const years = src.map((x) => (x.date || "").slice(0, 4)).filter(Boolean).sort();
  const b = run(build, [brain, path.join(ROOT, "agents", `${s.agent}.md`)]);
  const smokeFile = path.join(ROOT, "tests", "seats", "smoke", `${s.key}.md`);
  const k = fs.existsSync(smokeFile) ? run(build, [smokeFile]) : null;
  const bad = (x) => (x ? x.wrongId + x.notFound + x.lint : "?");
  if (!b || bad(b) !== 0 || (k && bad(k) !== 0)) failed = true;
  rows.push([s.short, src.length, words.toLocaleString("en-US"), years.length ? `${years[0]} to ${years.at(-1)}` : "", b ? b.verified : "?", bad(b), k ? `${k.verified} verified, ${bad(k)} issues` : "no answer"]);
}

const head = ["Seat", "Sources", "Words", "Years", "Brain quotes verified", "Wrong id + not found + lint", "Smoke answer"];
if (md) {
  console.log(`| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|`);
  for (const r of rows) console.log(`| ${r.join(" | ")} |`);
} else {
  for (const r of [head, ...rows]) console.log(r.map(String).join("  |  "));
}
process.exit(failed ? 1 : 0);
