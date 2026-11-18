// Adapted from nateherkai/roast-room (.claude/skills/newroaster/scripts/fetch.mjs).
// Copyright (c) 2026 AI Automation Society. MIT License, see ../LICENSE-roast-room.txt.
// Changes for Mosaic: per-line title/date/kind in url lists, PDF titles from metadata,
// retries on rate limits, and --rebuild to re-create a corpus from a committed sources.md.
//
// Fetch public sources for a Mosaic seat into its build folder, one markdown file per source,
// and keep the source id table (S001, S002, ...) the brain cites.
//
//   node skills/newseat/scripts/fetch.mjs <build dir> <url> [<url> ...]
//   node skills/newseat/scripts/fetch.mjs <build dir> --list urls.txt
//   node skills/newseat/scripts/fetch.mjs <build dir> --add <file.md|.txt|.pdf> --title "..." [--url ...] [--date YYYY-MM-DD] [--kind ...]
//   node skills/newseat/scripts/fetch.mjs <build dir> --manifest
//   node skills/newseat/scripts/fetch.mjs <build dir> --sources-md <brain>/sources.md --name "Full Name"
//   node skills/newseat/scripts/fetch.mjs <build dir> --rebuild <brain>/sources.md
//
// A url list has one source per line: `url` or `url | title | YYYY-MM-DD | kind`. Lines
// starting with # are headings. Title, date and kind override what the page says (PDF
// letters and memos rarely carry a usable title). Kind is free text: letter, memo, paper,
// transcript, speech, interview, blog, testimony.
//
// Web pages become plain text. YouTube links become transcripts with [mm:ss] markers (yt-dlp
// when it is installed, otherwise YouTube's own caption tracks; YouTube often blocks cloud
// machines, so prefer a text transcript page). PDFs need pdftotext; without it the file is
// saved and flagged so Claude can read it and write the text in. --add takes a local file.
// Re-runs skip URLs that are already in sources.json. --rebuild re-fetches every source in a
// committed sources.md under its original id, so anyone can re-run the quote check. Node 20+,
// no installs.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const [, , buildArg, ...rest] = process.argv;
if (!buildArg || buildArg.startsWith("--")) {
  console.error("usage: fetch.mjs <build dir> <url ...> | --list <file> | --add <file> --title <t> | --manifest | --sources-md <file> --name <n>");
  process.exit(2);
}
const BUILD = path.resolve(buildArg);
const CORPUS = path.join(BUILD, "corpus");
const TABLE = path.join(BUILD, "sources.json");
fs.mkdirSync(CORPUS, { recursive: true });
const sources = fs.existsSync(TABLE) ? JSON.parse(fs.readFileSync(TABLE, "utf8")) : [];
const save = () => fs.writeFileSync(TABLE, JSON.stringify(sources, null, 2) + "\n");
const nextId = () => "S" + String(sources.reduce((m, s) => Math.max(m, Number(s.id.slice(1))), 0) + 1).padStart(3, "0");
const words = (t) => (t.match(/\S+/g) || []).length;
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "source";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const has = (bin) => !spawnSync(bin, ["-v"], { stdio: "ignore" }).error; // installed at all, whatever the exit code
const DASH = /\s*[\u2014\u2013]\s*/g; // em and en dashes never reach a brain, not even in titles

function opt(name) {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

// ------------------------------------------------------------------ html to text
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: " - ", ndash: "-", hellip: "...", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', copy: "(c)" };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

function htmlToText(html) {
  let h = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of ["script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form", "iframe", "button"]) {
    h = h.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"), " ");
  }
  // the article body when the page marks one, else the whole body
  const art = h.match(/<article\b[\s\S]*<\/article>/i) || h.match(/<main\b[\s\S]*<\/main>/i);
  if (art && words(art[0].replace(/<[^>]+>/g, " ")) > 250) h = art[0];
  else h = (h.match(/<body\b[\s\S]*<\/body>/i) || [h])[0];
  h = h
    .replace(/<h([1-6])\b[^>]*>/gi, (_, n) => "\n\n" + "#".repeat(Number(n)) + " ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|blockquote|tr|ul|ol|table|pre)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
  return decode(h)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageMeta(html, url) {
  const meta = (re) => { const m = html.match(re); return m ? decode(m[1]).trim() : ""; };
  const title = meta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || meta(/<title[^>]*>([^<]+)<\/title>/i) || url;
  const date =
    meta(/<meta[^>]+(?:property|name)=["'](?:article:published_time|date|pubdate|publish-date|dc\.date)["'][^>]+content=["']([^"']+)/i) ||
    meta(/"datePublished"\s*:\s*"([^"]+)"/) ||
    meta(/<time[^>]+datetime=["']([^"']+)/i) ||
    (url.match(/\/(20\d\d|19\d\d)\/(\d\d)\//) || []).slice(1, 3).join("-");
  return { title: title.replace(/\s+/g, " ").slice(0, 160), date: (date.match(/\d{4}(-\d\d){0,2}/) || [""])[0] };
}

async function get(url, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60000), ...init, headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", ...(init.headers || {}) } });
    if (r.ok) return r;
    // rate limits and flaky gateways get two polite retries; everything else fails fast
    if ([429, 502, 503, 504].includes(r.status) && attempt < 2) { await new Promise((ok) => setTimeout(ok, 4000 * (attempt + 1))); continue; }
    throw new Error(`HTTP ${r.status}`);
  }
}

// ------------------------------------------------------------------ youtube
const ytId = (u) => (u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/) || [])[1];
const stamp = (ms) => { const s = Math.floor(ms / 1000); return `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}]`; };

/** json3 caption events -> paragraphs of about 60 words, each opening with its timestamp */
function json3ToText(j) {
  const out = []; let buf = []; let start = null;
  for (const ev of j.events || []) {
    if (!ev.segs) continue;
    const t = ev.segs.map((s) => s.utf8 || "").join("").replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (start === null) start = ev.tStartMs || 0;
    buf.push(t);
    if (words(buf.join(" ")) >= 60) { out.push(`${stamp(start)} ${buf.join(" ")}`); buf = []; start = null; }
  }
  if (buf.length) out.push(`${stamp(start || 0)} ${buf.join(" ")}`);
  return decode(out.join("\n\n")).replace(/\[(Music|Applause|Laughter)\]/gi, "").trim();
}

function viaYtDlp(id) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roaster-"));
  try {
    const info = JSON.parse(execFileSync("yt-dlp", ["-J", "--no-warnings", `https://www.youtube.com/watch?v=${id}`], { encoding: "utf8", maxBuffer: 64 << 20 }));
    execFileSync("yt-dlp", ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*,en", "--sub-format", "json3", "--no-warnings", "-o", path.join(dir, "v"), `https://www.youtube.com/watch?v=${id}`], { stdio: "ignore" });
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json3"));
    // a human-made track beats auto captions when both exist
    const pick = files.find((f) => !/-orig|auto/i.test(f) && /\.en\.json3$/.test(f)) || files[0];
    if (!pick) throw new Error("no English captions");
    const text = json3ToText(JSON.parse(fs.readFileSync(path.join(dir, pick), "utf8")));
    const d = info.upload_date || "";
    return { title: info.title, date: d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : "", text, channel: info.channel || "", seconds: info.duration || 0 };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function viaInnertube(id) {
  const body = { context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "en", gl: "US" } }, videoId: id };
  const r = await get("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", "user-agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip" },
  });
  const j = await r.json();
  const tracks = j.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const en = tracks.filter((t) => /^en/.test(t.languageCode));
  const track = en.find((t) => t.kind !== "asr") || en[0];
  if (!track) throw new Error(j.playabilityStatus?.reason || "no English captions");
  const cap = await (await get(track.baseUrl.replace(/&fmt=[^&]*/, "") + "&fmt=json3")).text();
  if (!cap.trim()) throw new Error("caption track came back empty");
  let date = "";
  try {
    const page = await (await get(`https://www.youtube.com/watch?v=${id}`)).text();
    date = ((page.match(/"(?:publishDate|uploadDate)":"([^"]+)"/) || [])[1] || "").slice(0, 10);
  } catch {}
  return { title: j.videoDetails?.title || id, date, text: json3ToText(JSON.parse(cap)), channel: j.videoDetails?.author || "", seconds: Number(j.videoDetails?.lengthSeconds) || 0 };
}

async function youtube(id) {
  const errors = [];
  if (has("yt-dlp") && !process.env.NO_YTDLP) { try { return viaYtDlp(id); } catch (e) { errors.push(`yt-dlp: ${e.message.split("\n")[0]}`); } }
  try { return await viaInnertube(id); } catch (e) { errors.push(`captions: ${e.message}`); }
  throw new Error(errors.join("; "));
}

// ------------------------------------------------------------------ pdf
function pdfText(file) {
  if (!has("pdftotext")) return null;
  // no -layout: column layout splits sentences across lines and breaks quote matching less, but
  // reading order matters more for letters and memos
  return execFileSync("pdftotext", ["-enc", "UTF-8", file, "-"], { encoding: "utf8", maxBuffer: 256 << 20 });
}

function pdfTitle(file) {
  if (!has("pdfinfo")) return "";
  try {
    const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
    const t = (info.match(/^Title:\s+(.+)$/m) || [])[1] || "";
    return /^(untitled|microsoft word|document\d*)/i.test(t.trim()) ? "" : t.trim();
  } catch { return ""; }
}

// ------------------------------------------------------------------ one source
function write(src, text) {
  const file = `${src.id}-${slugify(src.title)}.md`;
  const head = `# ${src.title}\n\nSource: ${src.id} | ${src.url || "local file"} | ${src.date || "undated"} | ${src.kind}${src.channel ? ` | ${src.channel}` : ""}\n\n`;
  fs.writeFileSync(path.join(CORPUS, file), head + text.trim() + "\n");
  Object.assign(src, { file: `corpus/${file}`, words: words(text) });
  sources.push(src);
  save();
  return src;
}

/** `url | title | date | kind` -> parts; only url is required */
function parseLine(line) {
  const [url, title, date, kind] = line.split(" | ").map((x) => (x || "").trim());
  return { url, title, date, kind };
}

async function fetchOne(line, forceId) {
  const o = parseLine(line.trim());
  const url = o.url;
  if (!url || url.startsWith("#")) return;
  if (sources.some((s) => s.url === url)) return console.log(`skip   ${url} (already fetched)`);
  if (forceId && sources.some((s) => s.id === forceId)) return console.log(`skip   ${forceId} (id already used)`);
  const id = forceId || nextId();
  const over = (src) => Object.assign(src, o.title ? { title: o.title } : {}, o.date ? { date: o.date } : {}, o.kind ? { kind: o.kind } : {});
  try {
    const yt = ytId(url);
    if (yt) {
      const v = await youtube(yt);
      const s = write(over({ id, title: v.title, url: `https://www.youtube.com/watch?v=${yt}`, date: v.date, kind: "video", channel: v.channel, minutes: Math.round(v.seconds / 60) }), v.text);
      return console.log(`ok     ${s.id} ${s.words.toLocaleString()} words  ${s.title}`);
    }
    const r = await get(url);
    const type = r.headers.get("content-type") || "";
    if (type.includes("pdf") || /\.pdf($|\?)/i.test(url)) {
      const raw = path.join(CORPUS, `pending-${slugify(path.basename(new URL(url).pathname, ".pdf"))}.pdf`);
      fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
      const text = pdfText(raw);
      if (!text) return console.log(`pdf    ${raw} saved, but pdftotext is not installed. Read it and save its text with --add.`);
      const title = pdfTitle(raw) || path.basename(raw, ".pdf").replace(/^pending-/, "").replace(/-/g, " ");
      fs.rmSync(raw);
      if (words(text) < 250) return console.log(`thin   ${url} (${words(text)} words: a scanned PDF with no text layer; skipped)`);
      const s = write(over({ id, title, url, date: (url.match(/(19|20)\d\d/) || [""])[0], kind: "pdf" }), text);
      return console.log(`ok     ${s.id} ${s.words.toLocaleString()} words  ${s.title}`);
    }
    const html = await r.text();
    const text = htmlToText(html);
    const meta = pageMeta(html, url);
    // essays often print their date as a line near the top ("July 2013") instead of in the markup
    if (!meta.date) {
      const m = text.slice(0, 600).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December) (?:\d{1,2}, )?((?:19|20)\d\d)\b/);
      if (m) meta.date = `${m[2]}-${String("JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[1].slice(0, 3)) / 3 + 1).padStart(2, "0")}`;
    }
    if (words(text) < 250 && !rest.includes("--keep-short")) {
      return console.log(`thin   ${url} (${words(text)} words: paywall, login, or a page built by JavaScript; skipped)`);
    }
    const s = write(over({ id, title: meta.title, url, date: meta.date, kind: "web" }), text);
    console.log(`ok     ${s.id} ${s.words.toLocaleString()} words  ${s.title}`);
  } catch (e) {
    console.log(`fail   ${url} (${e.message})`);
  }
}

function addLocal(file) {
  const title = opt("--title") || path.basename(file).replace(/\.[^.]+$/, "");
  let text;
  if (/\.pdf$/i.test(file)) {
    text = pdfText(file);
    if (!text) throw new Error("pdftotext is not installed; read the PDF and save its text as a .md or .txt file, then --add that");
  } else text = fs.readFileSync(file, "utf8");
  const s = write({ id: nextId(), title, url: opt("--url") || "", date: opt("--date") || "", kind: opt("--kind") || "local" }, text);
  console.log(`ok     ${s.id} ${s.words.toLocaleString()} words  ${s.title}`);
}

function manifest() {
  const total = sources.reduce((n, s) => n + (s.words || 0), 0);
  const byKind = {};
  for (const s of sources) { byKind[s.kind] = byKind[s.kind] || { n: 0, w: 0 }; byKind[s.kind].n++; byKind[s.kind].w += s.words || 0; }
  const dates = sources.map((s) => s.date).filter(Boolean).sort();
  console.log(`${sources.length} sources, ${total.toLocaleString()} words${dates.length ? `, ${dates[0].slice(0, 4)} to ${dates.at(-1).slice(0, 4)}` : ""}`);
  for (const [k, v] of Object.entries(byKind)) console.log(`  ${k}: ${v.n} sources, ${v.w.toLocaleString()} words`);
  const thin = sources.filter((s) => s.words < 800);
  if (thin.length) console.log(`  short (<800 words): ${thin.map((s) => s.id).join(", ")}`);
}

/** The brain's sources.md: a header with counts, then one line per source id. */
function sourcesMd(out, name) {
  const total = sources.reduce((n, s) => n + (s.words || 0), 0);
  const kinds = [...new Set(sources.map((s) => s.kind))].map((k) => `${sources.filter((s) => s.kind === k).length} ${k}`).join(", ");
  const lines = [
    `# Sources: ${name}`,
    "",
    `${sources.length} sources (${kinds}), ${total.toLocaleString()} words.${sources.some((s) => s.kind === "video") ? " Video dates are upload dates." : ""} Every quote in this brain carries one of these ids.`,
    "",
    "Format: id | title | url | date | kind | words",
    "",
    ...sources.map((s) => `- ${s.id} | ${s.title.replace(/\|/g, "/").replace(DASH, ": ")} | ${s.url || "local file"} | ${s.date || "undated"} | ${s.kind} | ${s.words}`),
  ];
  fs.writeFileSync(out, lines.join("\n") + "\n");
  console.log(`wrote ${out}`);
}

/** Re-create a corpus from a committed sources.md, keeping every original id. */
async function rebuild(file) {
  const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /^- S\d{3} \| /.test(l));
  for (const row of rows) {
    const parts = row.slice(2).split(" | ");
    const [id, title, url, date] = [parts[0], parts.slice(1, -3).join(" | "), parts.at(-3), parts.at(-2)];
    if (!/^https?:/.test(url)) { console.log(`local  ${id} ${title} (a local file: add it again with --add)`); continue; }
    await fetchOne(`${url} | ${title} | ${date === "undated" ? "" : date}`, id);
    await new Promise((r) => setTimeout(r, 400));
  }
  manifest();
}

// ------------------------------------------------------------------ main
if (opt("--rebuild")) await rebuild(opt("--rebuild"));
else if (opt("--sources-md")) sourcesMd(opt("--sources-md"), opt("--name") || path.basename(BUILD));
else if (rest.includes("--manifest")) manifest();
else if (opt("--add")) addLocal(opt("--add"));
else {
  const list = opt("--list");
  const urls = list ? fs.readFileSync(list, "utf8").split(/\r?\n/) : rest.filter((a) => !a.startsWith("--"));
  for (const u of urls) {
    await fetchOne(u);
    await new Promise((r) => setTimeout(r, 400)); // be polite to the sites
  }
  manifest();
}
