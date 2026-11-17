// The server: state, live updates over Server-Sent Events, the journal API and static files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { startServer, parseOptions, DEFAULT_PORT } from '../../server.js';
import { stageTo } from '../helpers/stepper.mjs';

const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples');
const NVDA = path.join(EX, '2026-11-17-nvda-buy');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-server-'));

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Read SSE "state" events until `pred` matches one, or time out. */
function waitForEvent(url, pred, ms = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${url}/api/events`, (res) => {
      let buf = '';
      res.on('data', (c) => {
        buf += c;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = chunk.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('');
          if (!data) continue;
          const state = JSON.parse(data);
          if (pred(state)) {
            req.destroy();
            clearTimeout(t);
            resolve(state);
          }
        }
      });
    });
    const t = setTimeout(() => {
      req.destroy();
      reject(new Error('timed out waiting for an event'));
    }, ms);
  });
}

test('options: port 4731 by default, flags and environment override', () => {
  assert.equal(DEFAULT_PORT, 4731);
  assert.equal(parseOptions([], {}).port, 4731);
  assert.equal(parseOptions(['--port', '5000'], {}).port, 5000);
  assert.equal(parseOptions([], { MOSAIC_ROOM_PORT: '5001' }).port, 5001);
  const o = parseOptions(['--session=/tmp/x', '--home', '/tmp/home'], {});
  assert.equal(o.session, path.resolve('/tmp/x'));
  assert.equal(o.journal, path.resolve('/tmp/home/journal'));
  assert.equal(o.sessions, path.resolve('/tmp/home/sessions'));
});

test('serves the page, the state, and pushes updates as files land', async () => {
  const dir = tmp();
  stageTo(NVDA, dir, 'brief');
  const r = await startServer({ session: dir, port: 0, quiet: true, journal: tmp(), pollMs: 100 });
  try {
    const page = await request(`${r.url}/`);
    assert.equal(page.status, 200);
    assert.match(page.body, /<title>Mosaic Room<\/title>/);
    assert.equal((await request(`${r.url}/styles.css`)).headers['content-type'], 'text/css; charset=utf-8');
    assert.equal((await request(`${r.url}/img/table.jpg`)).status, 200);

    const st = JSON.parse((await request(`${r.url}/api/state`)).body);
    assert.equal(st.ok, true);
    assert.equal(st.model.phase, 0);

    const next = waitForEvent(r.url, (s) => s.model?.live?.length > 2);
    stageTo(NVDA, dir, 'round 1, first cards');
    const s2 = await next;
    assert.equal(s2.model.live.at(-1).speaker, 'munger');

    const done = waitForEvent(r.url, (s) => s.done);
    stageTo(NVDA, dir, 'verdict');
    assert.equal((await done).model.verdict.label, 'Proceed with conditions');
  } finally {
    await r.close();
  }
});

test('waits politely when there is no council yet, then follows the newest one', async () => {
  const sessions = tmp();
  const r = await startServer({ sessions, port: 0, quiet: true, journal: tmp(), pollMs: 100 });
  try {
    const st = JSON.parse((await request(`${r.url}/api/state`)).body);
    assert.equal(st.ok, false);
    assert.equal(st.waiting, true);
    const seen = waitForEvent(r.url, (s) => s.ok);
    stageTo(NVDA, path.join(sessions, '2026-11-17-nvda-buy'), 'data');
    assert.equal((await seen).session, '2026-11-17-nvda-buy');
  } finally {
    await r.close();
  }
});

test('Save to journal writes the file, refuses other origins, and refuses unfinished councils', async () => {
  const journal = tmp();
  const r = await startServer({ session: NVDA, port: 0, quiet: true, journal, pollMs: 100 });
  try {
    const evil = await request(`${r.url}/api/journal`, { method: 'POST', headers: { origin: 'https://evil.example' } });
    assert.equal(evil.status, 403);
    assert.equal(fs.existsSync(path.join(journal, 'NVDA.json')), false);

    const ok = await request(`${r.url}/api/journal`, { method: 'POST', headers: { origin: r.url.replace('localhost', '127.0.0.1') } });
    assert.equal(ok.status, 200, ok.body);
    assert.equal(JSON.parse(ok.body).key, 'NVDA');
    assert.equal(JSON.parse(fs.readFileSync(path.join(journal, 'NVDA.json'), 'utf8')).entries.length, 1);
    const state = JSON.parse((await request(`${r.url}/api/state`)).body);
    assert.equal(state.journal.saved, true);
    const list = JSON.parse((await request(`${r.url}/api/journal`)).body);
    assert.equal(list.rows[0].key, 'NVDA');
  } finally {
    await r.close();
  }

  const half = tmp();
  stageTo(NVDA, half, 'round 2');
  const r2 = await startServer({ session: half, port: 0, quiet: true, journal: tmp() });
  try {
    assert.equal((await request(`${r2.url}/api/journal`, { method: 'POST' })).status, 409);
  } finally {
    await r2.close();
  }
});

test('static files stay inside public/', async () => {
  const r = await startServer({ session: NVDA, port: 0, quiet: true, journal: tmp() });
  try {
    for (const p of ['/../server.js', '/%2e%2e/server.js', '/img/../../package.json', '/nope.html']) assert.equal((await request(`${r.url}${p}`)).status, 404, p);
    assert.equal((await request(`${r.url}/api/state`, { method: 'DELETE' })).status, 200, 'state is read-only and ignores the method');
    assert.equal((await request(`${r.url}/index.html`, { method: 'PUT' })).status, 405);
  } finally {
    await r.close();
  }
});

test('a busy port fails with EADDRINUSE', async () => {
  const r = await startServer({ session: NVDA, port: 0, quiet: true, journal: tmp() });
  try {
    await assert.rejects(startServer({ session: NVDA, port: r.port, quiet: true, journal: tmp() }), { code: 'EADDRINUSE' });
  } finally {
    await r.close();
  }
});
