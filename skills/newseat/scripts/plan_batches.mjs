// Split a seat's corpus into extraction batches of about N words each (default 60,000), so each
// extraction agent reads a similar load. Sources stay whole; a source longer than the budget
// gets a batch of its own. Writes <build>/batches.json and prints one line per batch.
//
//   node skills/newseat/scripts/plan_batches.mjs <build dir> [--words 60000]
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const build = argv.find((a) => !a.startsWith("--"));
if (!build) { console.error("usage: plan_batches.mjs <build dir> [--words 60000]"); process.exit(2); }
const i = argv.indexOf("--words");
const budget = i >= 0 ? Number(argv[i + 1]) : 60000;
const sources = JSON.parse(fs.readFileSync(path.join(build, "sources.json"), "utf8"));

// keep id order (roughly chronological per group) so a batch reads like a stretch of their career
const batches = [];
let cur = { sources: [], words: 0 };
for (const s of sources) {
  if (cur.words && cur.words + s.words > budget) { batches.push(cur); cur = { sources: [], words: 0 }; }
  cur.sources.push({ id: s.id, file: path.join(build, s.file), words: s.words });
  cur.words += s.words;
}
if (cur.sources.length) batches.push(cur);
batches.forEach((b, n) => (b.batch = String(n + 1).padStart(2, "0")));
fs.writeFileSync(path.join(build, "batches.json"), JSON.stringify(batches, null, 2) + "\n");
const total = sources.reduce((n, s) => n + s.words, 0);
console.log(`${sources.length} sources, ${total.toLocaleString()} words, ${batches.length} batches of about ${budget.toLocaleString()} words`);
for (const b of batches) console.log(`batch-${b.batch}: ${b.sources.length} sources, ${b.words.toLocaleString()} words (${b.sources[0].id} to ${b.sources.at(-1).id})`);
