#!/usr/bin/env node
// Adapted from nateherkai/roast-room (.claude/skills/newroaster/scripts/add_seat.mjs).
// Copyright (c) 2026 AI Automation Society. MIT License, see ../LICENSE-roast-room.txt.
// Changes for Mosaic: investing fields (role, guard), agents/seat-<key>.md, selling.md in the
// required brain files, and the roster at skills/mosaic/roster.json.
//
// Register a finished seat in the Mosaic roster (skills/mosaic/roster.json).
//
//   node skills/newseat/scripts/add_seat.mjs --key lynch --name "Peter Lynch" --short Lynch \
//     --slug peter-lynch --role "Growth and ground truth" \
//     --question "What kind of stock is this, ...?" --dimension "Growth story and PEG" \
//     [--color "#ef7d32"] [--guard ruin|bear] [--default] [--swap <key>]
//
// Checks the agent file and the brain exist first, so a half-built seat never reaches the table.
// --default puts the seat on the default board; --swap <key> takes that seat off the board in
// the same move (the board holds at most nine). Running it again for the same key updates it.
// A guard seat (ruin or bear) replaces the current holder of that guard role.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SKILL = path.join(ROOT, "skills", "mosaic");
const ROSTER = path.join(SKILL, "roster.json");
const MAX_BOARD = 9;
const BRAIN_FILES = ["_hot.md", "frameworks.md", "principles.md", "positions.md", "voice.md", "stories.md", "selling.md", "sources.md"];
const PALETTE = ["#22b8a0", "#e05d9b", "#c9a227", "#5b7cfa", "#ef7d32", "#2fa4d6", "#a3be3c", "#b06ad9", "#d6543f", "#3fb37f"];

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const fail = (m) => { console.error("add_seat: " + m); process.exit(1); };

const seat = {
  key: (opt("key") || "").toLowerCase(),
  name: opt("name"), short: opt("short"), initials: opt("initials"), slug: opt("slug"),
  agent: "", role: opt("role"), question: opt("question"), dimension: opt("dimension"), color: opt("color"),
  guard: opt("guard") || null,
};
for (const f of ["key", "name", "short", "slug", "role", "question", "dimension"]) if (!seat[f]) fail(`--${f} is required`);
if (!/^[a-z][a-z0-9]{1,15}$/.test(seat.key)) fail("--key must be 2 to 16 lowercase letters or digits, starting with a letter");
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(seat.slug)) fail("--slug must look like first-last");
if (seat.guard && !["ruin", "bear"].includes(seat.guard)) fail("--guard must be ruin or bear");
seat.initials ||= seat.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
seat.agent = `seat-${seat.key}`;

const agent = path.join(ROOT, "agents", `${seat.agent}.md`);
if (!fs.existsSync(agent)) fail(`missing agent file ${path.relative(ROOT, agent)}`);
const brain = path.join(SKILL, "brains", seat.slug);
const missing = BRAIN_FILES.filter((f) => !fs.existsSync(path.join(brain, f)));
if (missing.length) fail(`brain ${path.relative(ROOT, brain)} is missing ${missing.join(", ")}`);

const r = JSON.parse(fs.readFileSync(ROSTER, "utf8"));
r.guards ||= {};
const others = r.seats.filter((s) => s.key !== seat.key);
if (others.some((s) => s.slug === seat.slug)) fail(`slug ${seat.slug} already belongs to another seat`);
if (others.some((s) => s.short.toLowerCase() === seat.short.toLowerCase())) fail(`short name ${seat.short} is taken; pick another`);
if (!/^#[0-9a-f]{6}$/i.test(seat.color || "")) {
  const used = new Set(r.seats.map((s) => s.color.toLowerCase()));
  seat.color = PALETTE.find((c) => !used.has(c)) || PALETTE[r.seats.length % PALETTE.length];
}
if (seat.guard) {
  for (const s of others) if (s.guard === seat.guard) s.guard = null;
  r.guards[seat.guard] = seat.key;
}
const at = r.seats.findIndex((s) => s.key === seat.key);
if (at >= 0) r.seats[at] = seat; else r.seats.push(seat);

const swap = opt("swap");
if (swap) r.default = r.default.filter((k) => k !== swap);
if (args.includes("--default") && !r.default.includes(seat.key)) {
  if (r.default.length >= MAX_BOARD) fail(`the default board already has ${MAX_BOARD} seats; add --swap <key> to take one off`);
  r.default.push(seat.key);
}

// one seat per line keeps the file easy to read and edit by hand
const line = (o) => "{ " + Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + " }";
const out = [
  "{",
  `  "board": ${JSON.stringify(r.board || "ask")},`,
  `  "default": [${r.default.map((k) => JSON.stringify(k)).join(", ")}],`,
  `  "guards": ${JSON.stringify(r.guards).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/^\{/, "{ ").replace(/\}$/, " }")},`,
  `  "seats": [`,
  r.seats.map((s) => "    " + line(s)).join(",\n"),
  "  ]",
  "}",
].join("\n") + "\n";
JSON.parse(out); // never write a file the council cannot read
fs.writeFileSync(ROSTER, out);

console.log(`${at >= 0 ? "Updated" : "Added"} ${seat.name} (${seat.key}) to the roster.`);
console.log(`Default board (${r.default.length}): ${r.default.map((k) => r.seats.find((s) => s.key === k)?.short || k).join(", ")}`);
console.log(`Guards: ${Object.entries(r.guards).map(([g, k]) => `${g}=${k}`).join(", ") || "none"}`);
console.log(`Board setting: ${r.board || "ask"}`);
