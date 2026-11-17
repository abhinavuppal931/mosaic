#!/usr/bin/env node
// Serve the approved design boards (docs/design/boards) so they can be screenshotted next to
// the Room. /support.js is the minimal canvas runtime in dc-support.js, and /_blob/<id> maps to
// docs/design/assets by the table in docs/design/ROOM-DESIGN.md.
//
//   node room/scripts/boards.mjs [--port 4732]        serve the boards
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BOARDS = path.join(REPO, 'docs', 'design', 'boards');
const ASSETS = path.join(REPO, 'docs', 'design', 'assets');

/** Blob id to asset file, read from the table in ROOM-DESIGN.md so there is one copy of the map. */
export function blobMap() {
  const md = fs.readFileSync(path.join(REPO, 'docs', 'design', 'ROOM-DESIGN.md'), 'utf8');
  const map = {};
  for (const m of md.matchAll(/^\|\s*([0-9a-f]{32})\s*\|\s*([\w.-]+\.jpg)\s*\|/gm)) map[m[1]] = m[2];
  return map;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.json': 'application/json' };

export function startBoardServer(port = 4732) {
  const blobs = blobMap();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = null;
    if (url.pathname === '/support.js') file = path.join(HERE, 'dc-support.js');
    else if (url.pathname.startsWith('/_blob/')) {
      const name = blobs[url.pathname.slice(7)];
      if (name) file = path.join(ASSETS, name);
    } else {
      const p = path.normalize(path.join(BOARDS, decodeURIComponent(url.pathname)));
      if (p.startsWith(BOARDS + path.sep)) file = p;
    }
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : 4732;
  startBoardServer(port).then(() => console.log(`Boards at http://127.0.0.1:${port}/A3-Live.dc.html and /A3-Verdict.dc.html`));
}
