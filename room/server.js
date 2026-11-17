#!/usr/bin/env node
// The Mosaic Room: a local web server that plays a council's session files as they land and
// then shows the verdict. Zero dependencies; plain HTML, CSS and JS in public/.
//
//   node room/server.js [--session <dir>] [--sessions <dir>] [--home <dir>] [--plugin-data <dir>] [--journal <dir>]
//                       [--roster <file>] [--scoring-config <file>] [--port 4731] [--host 127.0.0.1]
//
// With --session it shows that one folder. Otherwise it follows the newest council under the
// sessions folder (<home>/sessions), so a council started after the Room opens shows up by itself.
// It never writes session files; the only write is "Save to journal" (journal/<KEY>.json).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSession, folderSignature, latestSession } from './lib/session.js';
import { seatResolver } from './lib/seats.js';
import { buildModel, DEFAULT_CONFIG } from './lib/model.js';
import { journalStatus, saveSession, listJournal, journalFile, journalKey } from './lib/journal.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');
const PLUGIN_ROOT = path.resolve(HERE, '..');
export const DEFAULT_PORT = 4731;

// Core's own home resolution (data/lib/paths.mjs), so the Room finds the same sessions and journal
// as every other Mosaic command: --home, MOSAIC_HOME, the git clone, then --plugin-data.
const CORE_PATHS = path.join(PLUGIN_ROOT, 'data', 'lib', 'paths.mjs');
const core = fs.existsSync(CORE_PATHS) ? await import(pathToFileURL(CORE_PATHS).href) : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

/** Parse argv into options; flags win over environment variables. */
export function parseOptions(argv = [], env = process.env) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--([a-z-]+)(?:=(.*))?$/);
    if (!m) continue;
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[key] = m[2] ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  const pluginData = typeof o.pluginData === 'string' ? o.pluginData : undefined;
  const home = core
    ? core.resolveHome({ home: typeof o.home === 'string' ? o.home : undefined, pluginData, env, pluginRoot: PLUGIN_ROOT })
    : path.resolve(String(o.home || env.MOSAIC_HOME || PLUGIN_ROOT));
  const rosterDefault = path.join(PLUGIN_ROOT, 'skills', 'mosaic', 'roster.json');
  return {
    home,
    session: o.session ? path.resolve(String(o.session)) : null,
    sessions: path.resolve(String(o.sessions || path.join(home, 'sessions'))),
    journal: path.resolve(String(o.journal || env.MOSAIC_JOURNAL || path.join(home, 'journal'))),
    roster: o.roster ? path.resolve(String(o.roster)) : fs.existsSync(rosterDefault) ? rosterDefault : null,
    scoringConfig: path.resolve(String(o.scoringConfig || path.join(PLUGIN_ROOT, 'scripts', 'scoring.config.json'))),
    port: Number(o.port ?? env.MOSAIC_ROOM_PORT ?? DEFAULT_PORT),
    host: String(o.host || env.MOSAIC_ROOM_HOST || '127.0.0.1'),
    pollMs: Number(o.poll || 400),
    quiet: Boolean(o.quiet),
  };
}

/**
 * Core's scoring thresholds (scripts/scoring.config.json); the Room uses agreement.disagreeAtOrBelow.
 * Falls back to the model's defaults when core is not installed next to the Room.
 */
export function loadScoringConfig(file, log = () => {}) {
  if (!file || !fs.existsSync(file)) return DEFAULT_CONFIG;
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    const t = c?.agreement?.disagreeAtOrBelow;
    if (typeof t !== 'number') throw new Error('agreement.disagreeAtOrBelow is missing');
    return { ...DEFAULT_CONFIG, agreement: { ...DEFAULT_CONFIG.agreement, ...c.agreement } };
  } catch (e) {
    log(`scoring config at ${file} could not be read (${e.message}); using the defaults`);
    return DEFAULT_CONFIG;
  }
}

function loadRoster(file, log) {
  if (!file) return null;
  try {
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(r.seats) ? r : null;
  } catch (e) {
    log(`roster at ${file} could not be read (${e.message}); using the Room's own seat table`);
    return null;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Start the Room. Resolves to { server, url, port, close, state }.
 * Every change in the session folder (or the journal file for it) rebuilds the model and is
 * pushed to open pages over Server-Sent Events.
 */
export async function startServer(opts = {}) {
  const o = { ...parseOptions([], {}), ...opts };
  const log = o.quiet ? () => {} : (m) => process.stderr.write(`[room] ${m}\n`);
  const roster = loadRoster(o.roster, log);
  const cfg = loadScoringConfig(o.scoringConfig, log);
  const resolve = seatResolver(roster);
  const cache = new Map();
  const clients = new Set();
  const logged = new Set();
  let dir = null;
  let sig = null;
  let state = null;
  let body = '';

  const currentDir = () => o.session || latestSession(o.sessions);

  function journalSig(council) {
    const key = journalKey(council);
    if (!key) return '';
    try {
      return String(fs.statSync(journalFile(o.journal, key)).mtimeMs);
    } catch {
      return 'none';
    }
  }

  function rebuild() {
    const d = currentDir();
    if (d !== dir) cache.clear();
    dir = d;
    if (!dir) {
      state = { ok: false, waiting: true, message: 'No council yet. Start one with /mosaic, and it will appear here.', watching: o.session || o.sessions };
      return;
    }
    const s = readSession(dir, { resolve, cache });
    if (!s.council) {
      state = { ok: false, waiting: true, message: 'The council is being set up. The table assembles as soon as the brief is saved.', watching: dir, problems: s.problems };
      return;
    }
    s.journal = { ...journalStatus(o.journal, s.council) };
    let model;
    try {
      model = buildModel(s, { roster, cfg });
    } catch (e) {
      state = { ok: false, waiting: true, message: 'The session files could not be read yet.', watching: dir, problems: [{ file: dir, message: e.message }] };
      log(`model error: ${e.stack || e.message}`);
      return;
    }
    for (const p of model.problems) {
      const k = `${dir}|${p.file}|${p.message}`;
      if (!logged.has(k)) {
        logged.add(k);
        log(`problem in ${p.file}: ${p.message}`);
      }
    }
    state = { ok: true, session: path.basename(dir), model, journal: s.journal, done: Boolean(model.verdict), stale: isStale(dir, model) };
  }

  function isStale(d, model) {
    if (model.verdict) return false;
    try {
      const newest = Math.max(...fs.readdirSync(d).map((n) => fs.statSync(path.join(d, n)).mtimeMs));
      return Date.now() - newest > 3 * 3600_000;
    } catch {
      return false;
    }
  }

  function tick(force = false) {
    const d = currentDir();
    let council = null;
    if (d) {
      try {
        council = JSON.parse(fs.readFileSync(path.join(d, 'council.json'), 'utf8'));
      } catch {
        council = null;
      }
    }
    const next = `${d}::${d ? folderSignature(d) : ''}::${journalSig(council)}`;
    if (!force && next === sig) return false;
    sig = next;
    rebuild();
    body = JSON.stringify(state);
    for (const res of clients) res.write(`event: state\ndata: ${body}\n\n`);
    return true;
  }

  tick(true);

  const sameOrigin = (req) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      const u = new URL(origin);
      if (u.host === req.headers.host) return true;
      // The same Room reached by another loopback name (localhost and 127.0.0.1).
      const loop = ['localhost', '127.0.0.1', '[::1]'];
      return loop.includes(u.hostname) && loop.includes(String(req.headers.host).replace(/:\d+$/, '')) && Number(u.port) === server.address().port;
    } catch {
      return false;
    }
  };

  const send = (res, code, obj) => {
    res.writeHead(code, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
    res.end(JSON.stringify(obj));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (p === '/api/state') return send(res, 200, state);
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`retry: 1500\nevent: state\ndata: ${body}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p === '/api/journal' && req.method === 'GET') return send(res, 200, { dir: o.journal, today: today(), rows: listJournal(o.journal, today()) });
    if (p === '/api/journal' && req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'Saving is only allowed from the Room itself.' });
      if (!dir || !state?.ok) return send(res, 409, { ok: false, error: 'There is no council to save yet.' });
      const s = readSession(dir, { resolve, cache });
      if (!s.verdict) return send(res, 409, { ok: false, error: 'The council has not reached a verdict yet.' });
      try {
        const { key, doc } = saveSession(o.journal, s, { roster, cfg });
        log(`journaled ${key} to ${journalFile(o.journal, key)}`);
        tick(true);
        return send(res, 200, { ok: true, key, file: journalFile(o.journal, key), entries: doc.entries.length, nextRecheck: doc.next_recheck });
      } catch (e) {
        log(`journal error: ${e.message}`);
        return send(res, 500, { ok: false, error: e.message });
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'method not allowed' });
    const rel = p === '/' || p === '/index.html' ? 'index.html' : decodeURIComponent(p).replace(/^\/+/, '');
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': rel.startsWith('img/') || rel.startsWith('fonts/') ? 'max-age=86400' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(o.port, o.host, ok);
  });
  const timer = setInterval(() => {
    try {
      tick();
    } catch (e) {
      log(`watch error: ${e.message}`);
    }
  }, o.pollMs);
  const beat = setInterval(() => {
    for (const res of clients) res.write(': keep-alive\n\n');
  }, 15_000);
  const port = server.address().port;
  const shown = o.host === '127.0.0.1' || o.host === '0.0.0.0' ? 'localhost' : o.host;
  return {
    server,
    port,
    url: `http://${shown}:${port}`,
    state: () => state,
    refresh: () => tick(true),
    close: () =>
      new Promise((ok) => {
        clearInterval(timer);
        clearInterval(beat);
        for (const res of clients) res.end();
        server.close(() => ok());
        server.closeAllConnections?.();
      }),
    options: o,
  };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const o = parseOptions(process.argv.slice(2));
  startServer(o).then(
    (r) => {
      process.stdout.write(`Mosaic Room is open at ${r.url}\n`);
      process.stdout.write(o.session ? `Showing ${o.session}\n` : `Following the newest council in ${o.sessions}\n`);
      process.stdout.write(`Journal folder: ${o.journal}\n`);
    },
    (e) => {
      if (e.code === 'EADDRINUSE') process.stderr.write(`Port ${o.port} is busy. Is the Room already open? Try --port ${o.port + 1}.\n`);
      else process.stderr.write(`The Room could not start: ${e.message}\n`);
      process.exit(1);
    },
  );
}
