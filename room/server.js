// The Mosaic Room: a local web server that plays a council's session files as they land and
// then shows the verdict. Zero dependencies; plain HTML, CSS and JS in public/.
//
//   node room/server.js [--session <dir>] [--sessions <dir>] [--home <dir>] [--plugin-data <dir>] [--journal <dir>]
//                       [--roster <file>] [--scoring-config <file>] [--port 4731] [--host 127.0.0.1]
//
// With --session it shows that one folder. Otherwise it follows the newest council under the
// sessions folder (<home>/sessions), so a council started after the Room opens shows up by itself.
// Until the user has a council of their own, it shows the finished example councils in
// room/examples/ (the newest by default; the journal page lists all of them).
// It never writes session files; the only write is "Save to journal" (journal/<KEY>.json).
// --open opens the Room in the default browser. If the port is taken by another Room, it reports
// that Room's address; if something else has the port, it moves to the next free one.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSession, folderSignature, latestSession } from './lib/session.js';
import { seatResolver } from './lib/seats.js';
import { buildModel, DEFAULT_CONFIG } from './lib/model.js';
import { journalStatus, saveSession, listJournal, journalFile, journalKey, buildEntry } from './lib/journal.js';
import { spawn } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');
const PLUGIN_ROOT = path.resolve(HERE, '..');
export const EXAMPLES = path.join(HERE, 'examples');
export const DEFAULT_PORT = 4731;
const PORT_TRIES = 10;

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
    examples: o.examples === 'false' || o.noExamples ? null : path.resolve(String(typeof o.examples === 'string' ? o.examples : EXAMPLES)),
    open: Boolean(o.open),
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

/** Finished example councils (folders with council.json and verdict.json), newest first. */
export function listExamples(dir) {
  if (!dir) return [];
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => /^[\w.-]+$/.test(n) && ['council.json', 'verdict.json'].every((f) => fs.existsSync(path.join(dir, n, f))))
    .sort()
    .reverse()
    .map((n) => path.join(dir, n));
}

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

  const examples = listExamples(o.examples);
  const exampleCache = new Map();
  const own = () => o.session || latestSession(o.sessions);
  // The user's own council, else the newest example. `example` is true while showing an example.
  const current = () => {
    const d = own();
    if (d || o.session) return { d, example: false };
    return { d: examples[0] || null, example: Boolean(examples[0]) };
  };
  const currentDir = () => current().d;
  const exampleList = () => examples.map((d) => path.basename(d));

  /** State for one example council, built once (examples never change while the Room runs). */
  function exampleState(name) {
    const d = examples.find((x) => path.basename(x) === name);
    if (!d) return null;
    if (!exampleCache.has(name)) exampleCache.set(name, sessionState(d, new Map(), true));
    return exampleCache.get(name);
  }

  /** Rows for the journal page: one per example, shaped like journal rows. */
  function exampleRows() {
    const rows = [];
    for (const d of examples) {
      try {
        const s = readSession(d, { resolve, cache: new Map() });
        if (!s.council || !s.verdict) continue;
        let rawPack = null;
        try {
          rawPack = JSON.parse(fs.readFileSync(path.join(d, 'data-pack.json'), 'utf8'));
        } catch {
          rawPack = null;
        }
        const e = buildEntry(s, rawPack, { roster, cfg });
        const date = path.basename(d).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null;
        rows.push({
          example: path.basename(d),
          key: journalKey(s.council) || path.basename(d),
          company: rawPack?.facts?.find((f) => f.key === 'company_name')?.value || null,
          label: e.label,
          recommended: e.recommended,
          lastVerdict: date,
          latest: { decision: e.decision, call: e.call, options: e.options, optionScores: e.optionScores },
        });
      } catch (err) {
        log(`example ${path.basename(d)} could not be read: ${err.message}`);
      }
    }
    return rows;
  }

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
    const { d, example } = current();
    if (d !== dir) cache.clear();
    dir = d;
    if (!dir) {
      state = { ok: false, waiting: true, message: 'No council yet. Start one with /mosaic, and it will appear here.', watching: o.session || o.sessions };
      return;
    }
    state = sessionState(dir, cache, example);
  }

  function sessionState(dir, cache, example) {
    const s = readSession(dir, { resolve, cache });
    if (!s.council) {
      return { ok: false, waiting: true, message: 'The council is being set up. The table assembles as soon as the brief is saved.', watching: dir, problems: s.problems };
    }
    // An example is never saved to the user's journal.
    s.journal = example ? { available: false, saved: false, key: null } : { ...journalStatus(o.journal, s.council) };
    let model;
    try {
      model = buildModel(s, { roster, cfg });
    } catch (e) {
      log(`model error: ${e.stack || e.message}`);
      return { ok: false, waiting: true, message: 'The session files could not be read yet.', watching: dir, problems: [{ file: dir, message: e.message }] };
    }
    for (const p of model.problems) {
      const k = `${dir}|${p.file}|${p.message}`;
      if (!logged.has(k)) {
        logged.add(k);
        log(`problem in ${p.file}: ${p.message}`);
      }
    }
    const out = { ok: true, session: path.basename(dir), model, journal: s.journal, done: Boolean(model.verdict), stale: example ? false : isStale(dir, model) };
    if (example) {
      out.example = true;
      out.examples = exampleList();
      out.sessions = o.sessions;
    }
    return out;
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
    const ex = p.match(/^\/api\/examples\/([\w.-]+)$/);
    if (ex && req.method === 'GET') {
      const st = exampleState(ex[1]);
      return st ? send(res, 200, st) : send(res, 404, { ok: false, error: 'No example by that name.' });
    }
    if (p === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`retry: 1500\nevent: state\ndata: ${body}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p === '/api/journal' && req.method === 'GET') {
      const rows = listJournal(o.journal, today());
      // Offer the examples only to someone with nothing of their own yet.
      const offer = !rows.length && !own();
      return send(res, 200, { dir: o.journal, today: today(), rows, examples: offer ? exampleRows() : [] });
    }
    if (p === '/api/journal' && req.method === 'POST') {
      if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'Saving is only allowed from the Room itself.' });
      if (!dir || !state?.ok) return send(res, 409, { ok: false, error: 'There is no council to save yet.' });
      if (state.example) return send(res, 409, { ok: false, error: 'This is an example council, so it is not saved to your journal.' });
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

  // A busy port moves to the next one, unless the caller asked for strict (tests, --port given).
  // "Busy" also covers another app answering on [::1] at that port: on macOS a 127.0.0.1 bind can
  // succeed next to that app's wildcard listener, and the localhost link would then reach it.
  const tries = o.strictPort ? 1 : PORT_TRIES;
  for (let i = 0; ; i++) {
    try {
      await new Promise((ok, fail) => {
        server.once('error', fail);
        server.listen(o.port === 0 ? 0 : o.port + i, o.host, () => {
          server.off('error', fail);
          ok();
        });
      });
      const bound = server.address().port;
      if (o.host === '127.0.0.1' && (await loopbackV6Taken(bound))) {
        await new Promise((ok) => server.close(() => ok()));
        const e = new Error(`port ${bound} is in use by another app on [::1]`);
        e.code = 'EADDRINUSE';
        throw e;
      }
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE' || i + 1 >= tries) throw e;
      // With port 0 the system picks again; otherwise try the next port.
    }
  }
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

/**
 * Does something other than this process answer on the IPv6 loopback at this port? True only when a
 * connection to [::1]:port is accepted by another socket; refused, unreachable (no IPv6), slow, or a
 * connection the probe made to itself all count as free.
 */
export function loopbackV6Taken(port, timeoutMs = 400) {
  return new Promise((resolve) => {
    let done = false;
    const sock = net.connect({ host: '::1', port });
    const finish = (v) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(timeoutMs, () => finish(false));
    // On macOS, ephemeral ports are handed out in sequence, so the probe socket can be given this very
    // port as its own local port and connect to itself (TCP self-connect). That is not another app.
    sock.once('connect', () => finish(!(sock.localPort === port && sock.localAddress === sock.remoteAddress)));
    sock.once('error', () => finish(false));
  });
}

/** Is a Mosaic Room already answering at this port? Resolves to its URL or null; never hangs on a silent listener. */
export function findRoom(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    let done = false;
    let req = null;
    let timer = null;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (req) req.destroy();
      resolve(v);
    };
    timer = setTimeout(() => finish(null), 1000);
    try {
      req = http.get({ host, port, path: '/api/state', timeout: 800 }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            finish(j && typeof j === 'object' && ('ok' in j || 'waiting' in j) ? `http://localhost:${port}` : null);
          } catch {
            finish(null);
          }
        });
        res.on('error', () => finish(null));
      });
      req.on('timeout', () => finish(null));
      req.on('error', () => finish(null));
    } catch {
      finish(null);
    }
  });
}

/** The command that opens a URL in the default browser on this platform. */
export function browserCommand(url, platform = process.platform) {
  // On Windows, `start` treats a first quoted argument as the window title. We pass an empty title ("")
  // so the URL is not mistaken for it. Node would escape the quotes in `""` unless the arguments go
  // through verbatim, and then start would read the escaped text as the title or the target.
  if (platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '""', url], options: { windowsVerbatimArguments: true } };
  if (platform === 'darwin') return { cmd: 'open', args: [url], options: {} };
  return { cmd: 'xdg-open', args: [url], options: {} };
}

/** Open a URL in the default browser, best effort; never throws. */
export function openBrowser(url) {
  const { cmd, args, options } = browserCommand(url);
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true, ...options });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* no browser here: the URL is printed anyway */
  }
}

// Real paths, compared case-insensitively on Windows, so a symlinked folder (macOS /tmp, a linked
// home) or a drive-letter case difference still starts the server instead of exiting silently.
const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const invoked = Boolean(process.argv[1]) && same(real(path.resolve(process.argv[1])), real(fileURLToPath(import.meta.url)));
if (invoked) {
  const argv = process.argv.slice(2);
  const o = parseOptions(argv);
  // With --port given, only that port; otherwise the default and the next few.
  o.strictPort = argv.some((a) => /^--port(=|$)/.test(a)) || Boolean(process.env.MOSAIC_ROOM_PORT);
  let existing = null;
  for (let i = 0; i < (o.strictPort ? 1 : PORT_TRIES) && !existing; i++) existing = await findRoom(o.port + i);
  if (existing) {
    process.stdout.write(`Mosaic Room is already open at ${existing}\n`);
    if (o.open) openBrowser(existing);
    process.exit(0);
  }
  startServer(o).then(
    (r) => {
      process.stdout.write(`Mosaic Room is open at ${r.url}\n`);
      if (o.session) process.stdout.write(`Showing ${o.session}\n`);
      else if (r.state()?.example) process.stdout.write(`No council of your own yet, so it shows the example councils. Yours will appear here as soon as you run /mosaic.\nWatching ${o.sessions}\n`);
      else process.stdout.write(`Following the newest council in ${o.sessions}\n`);
      process.stdout.write(`Journal folder: ${o.journal}\nStop it with Ctrl+C.\n`);
      if (o.open) openBrowser(r.url);
    },
    (e) => {
      if (e.code === 'EADDRINUSE') process.stderr.write(`Port ${o.port} is busy. Start the Room on another port with --port ${o.port + 1}.\n`);
      else process.stderr.write(`The Room could not start: ${e.message}\n`);
      process.exit(1);
    },
  );
}
