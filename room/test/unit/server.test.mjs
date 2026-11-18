// The server: state, live updates over Server-Sent Events, the journal API and static files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
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
  const r = await startServer({ sessions, examples: null, port: 0, quiet: true, journal: tmp(), pollMs: 100 });
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
    await assert.rejects(startServer({ session: NVDA, port: r.port, strictPort: true, quiet: true, journal: tmp() }), { code: 'EADDRINUSE' });
  } finally {
    await r.close();
  }
});

const json = async (url, opts) => JSON.parse((await request(url, opts)).body);
const startEmpty = (extra = {}) => {
  const sessions = tmp();
  const journal = tmp();
  return startServer({ sessions, journal, port: 0, quiet: true, pollMs: 100, ...extra }).then((r) => ({ r, sessions, journal }));
};

test('examples: with nothing of your own, the newest example is shown and cannot be saved', async () => {
  const { r } = await startEmpty();
  try {
    const st = await json(`${r.url}/api/state`);
    assert.equal(st.ok, true);
    assert.equal(st.example, true);
    assert.equal(st.session, '2026-11-17-nvda-buy');
    assert.deepEqual(st.examples, ['2026-11-17-nvda-buy', '2026-11-15-msft-size', '2026-11-12-cost-sell']);
    assert.equal(st.journal.available, false);
    const save = await request(`${r.url}/api/journal`, { method: 'POST', headers: { origin: r.url.replace('localhost', '127.0.0.1') } });
    assert.equal(save.status, 409);
  } finally {
    await r.close();
  }
});

test('examples: /api/examples/<name> serves one example and refuses unknown names and path tricks', async () => {
  const { r } = await startEmpty();
  try {
    const ok = await request(`${r.url}/api/examples/2026-11-15-msft-size`);
    assert.equal(ok.status, 200);
    const st = JSON.parse(ok.body);
    assert.equal(st.ok, true);
    assert.equal(st.example, true);
    assert.equal(st.session, '2026-11-15-msft-size');
    for (const bad of ['nope', '..%2Fexamples', '..%2F..%2Fpackage.json', '%2e%2e', '..']) {
      assert.equal((await request(`${r.url}/api/examples/${bad}`)).status, 404, bad);
    }
  } finally {
    await r.close();
  }
});

test('examples: the journal offers three example rows until you have a council or a journal file', async () => {
  const { r, sessions } = await startEmpty();
  try {
    const j = await json(`${r.url}/api/journal`);
    assert.deepEqual(j.rows, []);
    assert.equal(j.examples.length, 3);
    for (const row of j.examples) {
      assert.ok(row.example && row.key && row.label && row.recommended && row.lastVerdict && row.latest.decision, JSON.stringify(row));
    }
    // A council of your own removes the offer.
    fs.cpSync(NVDA, path.join(sessions, '2026-11-17-nvda-buy'), { recursive: true });
    assert.deepEqual((await json(`${r.url}/api/journal`)).examples, []);
  } finally {
    await r.close();
  }
  // So does a journal file, even with no council: save one through a server that follows NVDA.
  const saved = tmp();
  const saver = await startServer({ session: NVDA, journal: saved, port: 0, quiet: true });
  try {
    assert.equal((await request(`${saver.url}/api/journal`, { method: 'POST', headers: { origin: saver.url.replace('localhost', '127.0.0.1') } })).status, 200);
  } finally {
    await saver.close();
  }
  const r2 = await startServer({ sessions: tmp(), journal: saved, port: 0, quiet: true });
  try {
    const j = await json(`${r2.url}/api/journal`);
    assert.equal(j.rows.length, 1);
    assert.deepEqual(j.examples, []);
  } finally {
    await r2.close();
  }
});

test('examples: a new council of your own takes over from the example', async () => {
  const { r, sessions } = await startEmpty();
  try {
    assert.equal((await json(`${r.url}/api/state`)).example, true);
    fs.cpSync(path.join(EX, '2026-11-15-msft-size'), path.join(sessions, '2026-11-16-mine'), { recursive: true });
    r.refresh();
    const st = await json(`${r.url}/api/state`);
    assert.equal(st.ok, true);
    assert.equal(st.example, undefined);
    assert.equal(st.session, '2026-11-16-mine');
  } finally {
    await r.close();
  }
});

test('examples: null turns the fallback off and keeps the waiting message', async () => {
  const { r } = await startEmpty({ examples: null });
  try {
    const st = await json(`${r.url}/api/state`);
    assert.equal(st.ok, false);
    assert.equal(st.waiting, true);
    assert.match(st.message, /No council yet/);
    assert.equal((await request(`${r.url}/api/examples/2026-11-17-nvda-buy`)).status, 404);
    assert.deepEqual((await json(`${r.url}/api/journal`)).examples, []);
  } finally {
    await r.close();
  }
});

test('a busy port moves to another one unless strictPort is set', async () => {
  const blocker = net.createServer();
  await new Promise((ok) => blocker.listen(0, '127.0.0.1', ok));
  const busy = blocker.address().port;
  let r;
  try {
    r = await startServer({ session: NVDA, port: busy, host: '127.0.0.1', quiet: true, journal: tmp() });
    assert.notEqual(r.port, busy);
    assert.equal((await request(`${r.url}/api/state`)).status, 200);
    await assert.rejects(startServer({ session: NVDA, port: busy, host: '127.0.0.1', strictPort: true, quiet: true, journal: tmp() }), { code: 'EADDRINUSE' });
  } finally {
    if (r) await r.close();
    await new Promise((ok) => blocker.close(ok));
  }
});
