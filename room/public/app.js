// The Mosaic Room page. It renders what the server sends (a model built from the session files)
// and never computes a score itself: every number on screen arrives already derived from the
// seats' option scores. Views: live (#/live), verdict (#/verdict), journal (#/journal).
// #/example/<name> shows one of the finished example councils; until the user has a council of
// their own, the server sends the newest example on its own.

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => window.matchMedia('(max-width: 759.98px)').matches;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];

// Lucide icons (ISC licence), inline.
const ICONS = {
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  square: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
};
const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const MARK = '<span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const brand = () => `<a class="brand" href="#/" aria-label="Mosaic, home">${MARK}<span class="word">Mosaic</span></a>`;

/** A seat's portrait, or its initials when the Room has no portrait for it. */
function face(seat, cls, alt = '') {
  if (seat?.img) return `<img class="${cls}" src="${h(seat.img)}" alt="${h(alt)}" loading="lazy" decoding="async">`;
  return `<span class="${cls} ini" role="img" aria-label="${h(alt || seat?.name || '')}">${h(seat?.initials || '?')}</span>`;
}

const S = {
  data: null, // what the page shows: the server's state, or an example picked from the journal
  live: null, // the server's latest state
  example: null, // name of the example picked from the journal, if any
  connected: false,
  view: null,
  userChose: false,
  replay: null,
  replayTimer: null,
  lastBeatKey: '',
  lastCells: new Map(),
  journal: null,
  drawer: false,
  saving: false,
  seat: null, // the investor open in the spotlight (verdict view), from the hash
  seatFx: null, // what to do after the next render: scroll to the panel, focus the heading or a card
  animSeat: null,
  swap: 0,
};

/* ---------------- Data ---------------- */

function connect() {
  let es;
  const open = () => {
    es = new EventSource('/api/events');
    es.addEventListener('state', (e) => {
      S.connected = true;
      S.live = JSON.parse(e.data);
      if (S.example && S.live.example) return; // keep showing the example the user picked
      if (S.example) {
        // The user's own council has started: it takes over from the example.
        S.example = null;
        S.userChose = false;
        history.replaceState(null, '', location.pathname);
        toast('Your council has started.');
      }
      const prev = S.data;
      S.data = S.live;
      onState(prev);
    });
    es.onopen = () => {
      S.connected = true;
    };
    es.onerror = () => {
      S.connected = false;
      if (S.data) render();
    };
  };
  open();
}

function onState(prev) {
  const m = S.data?.model;
  const hadVerdict = Boolean(prev?.model?.verdict);
  if (!S.userChose) S.view = m?.verdict ? 'verdict' : 'live';
  if (m?.verdict && !hadVerdict && prev?.model && S.view === 'verdict') toast('The council has reached a verdict.');
  if (S.view === 'journal') loadJournal();
  render();
}

async function loadJournal() {
  try {
    const r = await fetch('/api/journal');
    S.journal = await r.json();
  } catch {
    S.journal = { rows: [], error: true };
  }
  if (S.view === 'journal') render();
}

/* ---------------- Routing ---------------- */

async function loadExample(name, seat = null) {
  try {
    const r = await fetch(`/api/examples/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error('not found');
    const st = await r.json();
    S.example = name;
    S.data = st;
    S.view = st.model?.verdict ? 'verdict' : 'live';
    S.userChose = true;
    S.seat = seat;
    if (seat) S.seatFx = { scroll: true, focus: 'panel', force: true };
    stopReplay();
    window.scrollTo(0, 0);
    render();
  } catch {
    location.hash = '#/journal';
  }
}

/** The hash of the verdict with an investor open (or closed, with no key): #/verdict/buffett, #/example/<name>/buffett. */
function seatHash(key) {
  const base = S.example ? `#/example/${S.example}` : '#/verdict';
  return key ? `${base}/${key}` : base;
}

/** Open, switch or close the spotlight from the hash, without reloading the view. */
function setSeat(key, fx) {
  const prev = S.seat;
  S.seat = key || null;
  S.navKey = undefined;
  S.userChose = true;
  if (S.seat === prev) return (S.pendingFx = null);
  S.seatFx = fx || (S.seat ? { scroll: true, focus: 'panel' } : { focus: 'card', key: prev });
  render();
}

/** A page opened on an investor's hash gets a closed entry under it, so Back closes the panel. */
function deepLink(base) {
  if (S.booted) return;
  const full = location.hash;
  history.replaceState(null, '', base);
  history.pushState(null, '', full);
}

function route() {
  const v = location.hash.replace(/^#\/?/, '');
  S.navKey = undefined;
  const first = !S.booted;
  S.booted = true;
  if (first) {
    const m = v.match(/^(example\/[\w.-]+|verdict)\/[\w-]+$/);
    if (m) {
      S.booted = false;
      deepLink(`#/${m[1]}`);
      S.booted = true;
    }
  }
  const ex = v.match(/^example\/([\w.-]+)(?:\/([\w-]+))?$/);
  if (ex) {
    if (S.example === ex[1] && S.data?.model) return setSeat(ex[2] || null, S.pendingFx);
    return loadExample(ex[1], ex[2] || null);
  }
  if (!v && S.example) {
    S.example = null;
    S.data = S.live;
  }
  const vs = v.match(/^verdict(?:\/([\w-]+))?$/);
  if (vs && S.view === 'verdict' && S.data?.ok && S.data.model?.verdict) return setSeat(vs[1] || null, S.pendingFx);
  if (vs) {
    S.view = 'verdict';
    S.userChose = true;
    S.seat = vs[1] || null;
    if (S.seat) S.seatFx = { scroll: true, focus: 'panel', force: true };
  } else if (v === 'live' || v === 'journal') {
    S.view = v;
    S.userChose = true;
    S.seat = null;
  } else {
    S.userChose = false;
    S.view = S.data?.model?.verdict ? 'verdict' : 'live';
    S.seat = null;
  }
  if (S.view === 'journal') loadJournal();
  if (S.view !== 'live') stopReplay();
  window.scrollTo(0, 0);
  render();
}
window.addEventListener('hashchange', route);

/* ---------------- Render ---------------- */

function render() {
  const d = S.data;
  if (!d) return;
  document.body.dataset.view = S.view || '';
  if (S.view === 'journal') {
    app.innerHTML = journalView();
    return afterRender();
  }
  if (!d.ok) {
    app.innerHTML = waitingView(d);
    return afterRender();
  }
  const m = d.model;
  document.title = `${m.meta.question} · Mosaic Room`;
  app.innerHTML = S.view === 'verdict' && m.verdict ? verdictView(m, d) : liveView(m, d);
  afterRender();
}

function afterRender() {
  if (S.view === 'live') layoutStage();
  if (S.view === 'verdict') {
    afterSeat();
    markStuck();
  }
  renderDrawer();
}

function statusChip(d) {
  if (S.replay !== null) return `<span class="status warn"><i></i>Replay</span>`;
  if (d.example) return `<span class="status off"><i></i>Example</span>`;
  if (!S.connected) return `<span class="status warn"><i></i>Reconnecting</span>`;
  if (d.done) return `<span class="status off"><i></i>Finished</span>`;
  if (d.stale) return `<span class="status warn"><i></i>Paused</span>`;
  return `<span class="status"><i></i>Live</span>`;
}

function waitingView(d) {
  return `<div class="waiting"><header class="hdr">${brand()}<div class="hdr-right">${statusChip({})}<a class="btn btn-ghost" href="#/journal">${icon('book')}Journal</a></div></header>
  <main id="main" class="msg"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><h1>The table is set</h1><p>${h(d.message)}</p>${d.watching ? `<code>${h(d.watching)}</code>` : ''}</main></div>`;
}

/* ---------- Live ---------- */

function steps(step) {
  const labels = ['Brief', 'Data', 'Round 1, blind', 'Round 2, debate', 'Round 3, final scores', 'Vote', 'Verdict'];
  return `<span class="steps" role="img" aria-label="Step ${step + 1} of 7, ${h(labels[step])}">${labels.map((l, i) => `<i class="${i < step ? 'done' : i === step ? 'now' : ''}" title="${h(l)}"></i>`).join('')}</span>`;
}

/** "Leans wait · 7" with only the option name allowed to shorten, so the score always shows. */
function chip(text) {
  const m = String(text).match(/^Leans (.+) · (\d+(?:\.\d+)?)$/);
  if (!m) return `<span class="chip" title="${h(text)}">${h(text)}</span>`;
  return `<span class="chip lean" title="${h(text)}">Leans <span class="o">${h(m[1])}</span> · ${h(m[2])}</span>`;
}

function liveView(m, d) {
  const idx = S.replay ?? m.live.length - 1;
  const L = m.live[idx];
  const step = S.replay === null && m.verdict ? 6 : L.step;
  const talking = !d.done && S.replay === null && L.speaker ? ' talking' : '';
  const beatKey = `${idx}:${L.speaker}:${L.speech.say}`;
  const enter = beatKey !== S.lastBeatKey && !reduced() ? ' enter' : '';
  S.lastBeatKey = beatKey;
  const seatsByKey = Object.fromEntries(m.seats.map((x) => [x.key, x]));
  const next = d.done && S.replay === null ? 'The verdict is in' : L.next;
  const rightBtn = m.verdict
    ? `${d.done ? `<button type="button" class="btn btn-ghost hide-sm" data-act="replay">${icon(S.replay === null ? 'play' : 'square')}${S.replay === null ? 'Replay the debate' : 'Stop replay'}</button>` : ''}<a class="btn btn-primary" href="#/verdict">See the verdict${icon('arrowRight')}</a>`
    : `<button type="button" class="btn btn-soft" data-act="sources" aria-haspopup="dialog">${icon('database')}<span class="lbl">Sources, ${m.evidence.found} of ${m.evidence.total} facts</span></button>`;

  const seats = m.seats.map((x, i) => {
    const st = L.seats[i];
    const cls = ['seat', st.live ? 'live' : '', st.lean === 'Waiting' ? 'waiting' : '', st.lean === 'Too hard to call' ? 'abstain' : ''].join(' ').trim();
    return `<div class="${cls}" role="listitem" data-seat="${h(x.key)}" data-x="${x.pos[0]}" data-y="${x.pos[1]}" style="left:${x.pos[0]}%;top:${x.pos[1]}%">
      <div class="ring">${face(x, '', `${x.name}, simulated seat`)}</div>
      <div class="meta"><span class="nm">${h(x.short)}</span><span class="role">${h(x.role)}</span>${chip(st.lean)}</div>
    </div>`;
  }).join('');

  const sp = L.speech;
  const chips = sp.chips.map((c) => (c.label ? `<span class="fact" tabindex="0" title="${h(c.title)}">${h(c.label)} <b>${h(c.value)}</b></span>` : `<span class="fact plain">${h(c.text)}</span>`)).join('');
  const speech = `<article class="speech${enter}" aria-live="polite" aria-label="Who is speaking">
    <div class="top"><span class="who"><span class="wave${sp.chair ? ' chair' : ''}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="name">${h(sp.name)}</span><span class="ctx">${h(sp.context)}</span></span><span class="move">${h(sp.move)}</span></div>
    <p class="say">${h(sp.say)}</p>${chips ? `<div class="facts">${chips}</div>` : ''}
  </article>`;

  const dense = m.seats.length >= 10 ? ' dense' : '';
  return `<div class="v-live${talking}${dense}">
  <header class="hdr">
    <div class="hdr-left">${brand()}<span class="vbar"></span><span class="hq" title="${h(m.meta.question)}">${h(m.meta.question)}</span></div>
    <div class="hdr-right">
      <div class="prog"><span class="prog-text">${h(d.done && S.replay === null ? 'The council has finished' : L.stepText)}${d.done && S.replay === null ? '' : `<span class="nx">  ·  ${h(next)}</span>`}</span>${steps(step)}</div>
      ${statusChip(d)}${rightBtn}
    </div>
  </header>
  <main id="main">
  <section class="stage" aria-label="The council table">
    <div class="bg" aria-hidden="true"><img src="/img/table.jpg" alt=""><div class="vignette"></div><div class="beam" ${L.speaker ? '' : 'hidden'}></div></div>
    <div class="qmob"><span class="kind">${h(m.meta.kind)}</span><h1>${h(m.meta.question)}</h1>${steps(step)}<div class="prog-text" style="margin-top:8px">${h(L.stepText)}</div></div>
    <div class="seatrow" role="list" aria-label="Seats at the table">${seats}</div>
    ${speech}
  </section>
  <section class="panels" aria-label="The council so far">
    ${heatPanel(m, L, seatsByKey)}
    ${earlierPanel(L)}
    <div class="col">${cruxPanel(L)}${leanPanel(L)}</div>
  </section>
  </main>
  <footer class="foot"><span>The investors are simulations built from their public work. Not affiliated with or endorsed by them.</span><span>Grades a decision process. Not investment advice.</span></footer>
  </div>`;
}

function heatPanel(m, L) {
  const n = m.seats.length;
  const prev = S.lastCells;
  const nextCells = new Map();
  const head = `<span></span>${m.seats.map((x) => face(x, 'head', x.name)).join('')}`;
  const rows = L.heat.map((row) => `<span class="opt">${h(row.label)}</span>${row.cells.map((c) => {
    const k = `${row.id}:${c.key}`;
    nextCells.set(k, c.v);
    const flash = prev.has(k) && prev.get(k) !== c.v && c.v !== null && !reduced() ? ' flash' : '';
    return c.v === null ? `<span class="cell empty" title="${h(c.title)}">·</span>` : `<span class="cell l${c.level}${c.top ? ' top' : ''}${flash}" title="${h(c.title)}">${c.v}</span>`;
  }).join('')}`).join('');
  S.lastCells = nextCells;
  const totals = L.totals.map((t) => `<span><span class="lb" title="${h(t.label)}">${h(t.label)}</span><span class="v${t.best ? ' best' : ''}${t.v === null ? ' none' : ''}">${t.v ?? 'Not yet'}</span></span>`).join('');
  const lv = (c) => `<i class="cell ${c}" style="aspect-ratio:auto"></i>`;
  return `<div class="panel" aria-label="The mosaic so far">
    <div class="panel-h"><b>The mosaic so far</b><span>Each investor's score, out of 10</span></div>
    <div class="heat" style="grid-template-columns:auto repeat(${n}, minmax(0, 1fr))">${head}${rows}</div>
    <div class="totals" style="grid-template-columns:repeat(${L.totals.length}, minmax(0, 1fr))">${totals}</div>
    <div class="legend"><span>Low${lv('l0')}${lv('l1')}${lv('l2')}${lv('l3')}${lv('l4')}High</span><span><i class="pick"></i>Their top choice</span></div>
  </div>`;
}

function earlierPanel(L) {
  const e = L.earlier;
  const body = e.turns.length
    ? e.turns.map((t) => `<div class="turn">${face(t, 'av', '')}<div class="tx"><span class="nm">${h(t.name)}<span>  ${h(t.move)}</span></span><span class="say">${h(t.text)}</span>${t.tag ? `<span class="tag"><b>${h(t.tag)}</b>  ${h(t.tagText)}</span>` : ''}</div></div>`).join('')
    : `<p class="empty-note">${h(e.empty)}</p>`;
  return `<div class="panel" style="gap:12px"><div class="panel-h"><b>Earlier this round</b><span>${e.count === 1 ? '1 turn' : `${e.count} turns`}</span></div>${body}</div>`;
}

function cruxPanel(L) {
  const c = L.crux;
  if (!c) return `<div class="panel crux"><span class="kicker">The big disagreement</span><span class="q">Not named yet</span><span class="b" style="font-size:13px;color:var(--ink-4);line-height:1.5">The Chair names the fault line between the investors after the first round.</span></div>`;
  const sides = c.sides.map((s) => `<div class="side"><span class="faces" aria-hidden="true">${s.seats.map((x) => face(x, '', '')).join('')}</span><span class="sd"><span class="p">${h(s.position)}</span><span class="w">${h(s.names)}</span></span></div>`).join('');
  return `<div class="panel crux"><span class="kicker">The big disagreement</span><span class="q">${h(c.question)}</span><div class="sides">${sides}</div></div>`;
}

function leanPanel(L) {
  const l = L.lean;
  const sealed = l.state !== 'revealed';
  return `<div class="lean-card${sealed ? ' sealed' : ''}"><span class="kicker">${sealed ? `<span class="lock">${icon('lock')}${h(l.label)}</span>` : h(l.label)}</span><span class="t">${h(l.title)}</span><span class="b">${h(l.body)}</span></div>`;
}

/** Place the medallions over the chairs. The board's seat percentages are for a 1440 by 640 stage;
 * map them through the photo's cover crop so they stay on the chairs at any width. */
const IMG = { w: 1672, h: 941, px: 0.5, py: 0.62 };
const BOARD = { w: 1440, h: 640 };
function cover(W, H) {
  const s = Math.max(W / IMG.w, H / IMG.h);
  const rw = IMG.w * s, rh = IMG.h * s;
  return { rw, rh, ox: (W - rw) * IMG.px, oy: (H - rh) * IMG.py };
}
function layoutStage() {
  const stage = $('.stage');
  if (!stage) return;
  if (phone()) {
    stage.style.removeProperty('--stage-h');
    stage.style.removeProperty('--chip-max');
    for (const el of stage.querySelectorAll('.seat')) el.removeAttribute('style');
    return;
  }
  const W = stage.clientWidth;
  const H = Math.round(Math.min(820, Math.max(640, (W * BOARD.h) / BOARD.w)));
  stage.style.setProperty('--stage-h', `${H}px`);
  const b = cover(BOARD.w, BOARD.h);
  const c = cover(W, H);
  let live = null;
  for (const el of stage.querySelectorAll('.seat')) {
    const u = ((Number(el.dataset.x) / 100) * BOARD.w - b.ox) / b.rw;
    const v = ((Number(el.dataset.y) / 100) * BOARD.h - b.oy) / b.rh;
    const x = c.ox + u * c.rw, y = c.oy + v * c.rh;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (el.classList.contains('live')) live = { x, y };
  }
  // Keep neighbouring chips apart: cap each chip at the gap between seats.
  const xs = [...stage.querySelectorAll('.seat')].map((el) => parseFloat(el.style.left)).sort((a, b) => a - b);
  const gap = Math.min(...xs.slice(1).map((x, k) => x - xs[k]));
  stage.style.setProperty('--chip-max', Number.isFinite(gap) ? `${Math.max(72, gap - 8)}px` : 'none');
  const beam = $('.beam', stage);
  if (beam && live) {
    beam.style.left = `${live.x}px`;
    beam.style.height = `${live.y + 0.28 * H}px`;
  }
}
/** Mark the spotlight while its header is stuck to the top, so the header gets an edge. */
let stickRaf;
function markStuck() {
  const p = $('#spotlight');
  if (p) p.classList.toggle('stuck', p.getBoundingClientRect().top < 0);
}
window.addEventListener('scroll', () => {
  cancelAnimationFrame(stickRaf);
  stickRaf = requestAnimationFrame(markStuck);
}, { passive: true });

let rz;
window.addEventListener('resize', () => {
  cancelAnimationFrame(rz);
  rz = requestAnimationFrame(() => S.view === 'live' && layoutStage());
});

function startReplay() {
  const m = S.data?.model;
  if (!m) return;
  S.replay = 0;
  render();
  S.replayTimer = setInterval(() => {
    if (S.replay >= m.live.length - 1) return stopReplay();
    S.replay += 1;
    render();
  }, reduced() ? 4000 : 2600);
}
function stopReplay() {
  clearInterval(S.replayTimer);
  S.replayTimer = null;
  if (S.replay !== null) {
    S.replay = null;
    if (S.view === 'live') render();
  }
}

/* ---------- Verdict ---------- */

function verdictView(m, d) {
  const v = m.verdict;
  const st = v.stats;
  const j = d.journal || {};
  const saveBtn = !j.available ? '' : j.saved
    ? `<button type="button" class="btn btn-ghost hide-sm" data-act="save" aria-pressed="true">${icon('check')}Saved to journal</button>`
    : `<button type="button" class="btn btn-ghost hide-sm" data-act="save"${S.saving ? ' disabled' : ''}>${icon('bookmark')}Save to journal</button>`;
  const bars = (list) => list.map((b) => `<div class="bar${b.rec ? ' rec' : ''}${b.runner ? ' runner' : ''}${b.cls ? ` ${b.cls}` : ''}"><span class="lb" title="${h(b.label)}">${h(b.label)}</span><span class="tr"><span class="fl" style="width:${Math.max(0, Math.min(100, b.pct))}%"></span></span><span class="v">${h(b.v)}</span></div>`).join('');
  const ticksCols = Math.min(21, Math.max(8, Math.ceil(st.evidence.total / 2)));
  const ticks = Array.from({ length: st.evidence.total }, (_, i) => `<i class="${i < st.evidence.found ? 'on' : ''}" style="${i < st.evidence.found ? `opacity:${(0.55 + 0.45 * (i / Math.max(1, st.evidence.found - 1))).toFixed(2)}` : ''}"></i>`).join('');
  const dots = st.united.dots.map((x) => `<span title="${h(x.alt)}">${face(x, 'dot', x.alt).replace(/^<(img|span) class="dot/, `<$1 style="left:calc(${x.pct}% - 10px);top:${27 - x.stack * 12}px;z-index:${10 - x.stack}" class="dot`)}</span>`).join('');
  const bias = st.bias.none
    ? `<span class="big">None</span><span class="note">${h(st.bias.note)}</span>`
    : `<span class="big">${h(st.bias.word)}</span><div class="bars">${bars([{ label: 'Before', v: st.bias.before, pct: st.bias.beforePct, cls: 'before' }, { label: 'After', v: st.bias.after, pct: st.bias.afterPct, cls: 'after' }])}</div><span class="note">${h(st.bias.note)}</span>`;

  const sc = v.scorecard;
  const cls = (c) => ['n', c.rec ? 'rec' : '', c.v === null ? '' : c.v >= 7 ? 'hi' : c.v <= 3 ? 'lo' : c.v >= 5 ? 'mid' : ''].join(' ').trim();
  const rows = sc.rows.map((r) => `<tr><th scope="row"><span class="who">${face(r, '', '')}<span class="fn">${h(r.name)}</span><span class="sn">${h(r.short)}</span></span></th>${r.cells.map((c) => `<td class="${cls(c)}">${c.v ?? '<span class="sr">No score</span>'}</td>`).join('')}<td class="st"><span class="agree ${h(r.cls)}" title="${h(r.note)}">${h(r.vote)}</span></td></tr>`).join('');
  const kills = v.kills.length
    ? `<div class="kills" role="table" aria-label="What would change the call"><span class="h" role="columnheader">If this happens</span><span class="h" role="columnheader">Warning level</span><span class="h r" role="columnheader">Today</span>${v.kills.map((k) => `<span class="m" role="cell" title="${h(k.title)}">${h(k.text)}</span><span class="at" role="cell">${h(k.at)}</span><span class="now" role="cell">${h(k.now)}</span>`).join('')}</div>`
    : '<p class="intro">The council did not set a warning sign for this decision.</p>';
  const checkRight = !j.available ? '' : j.saved
    ? `<span class="saved">${icon('check')}Saved to your journal</span>`
    : `<button type="button" class="btn btn-ghost" data-act="save"${S.saving ? ' disabled' : ''}>${icon('bookmark')}Save to journal</button>`;
  const checkin = v.checkin ? `<div class="checkin"><span class="l"><span>Next check-in</span><span>${h(v.checkin.date)}</span>${v.checkin.text ? `<span class="why">${h(v.checkin.text)}</span>` : ''}</span>${checkRight}</div>` : j.available ? `<div class="checkin"><span class="l"><span>Keep track</span><span>Save it to see it again on a re-check</span></span>${checkRight}</div>` : '';
  const ob = v.objection;
  const tiles = v.share.tiles.map((t) => t.kind === 'score'
    ? `<div class="tile t-score">${h(t.text)}</div>`
    : t.kind === 'runner' ? `<div class="tile t-runner">${h(t.text)}</div>`
      : `<div class="tile">${face(t, '', t.alt)}<span class="lb">${h(t.text)}</span><span class="vb c-${h(t.cls)}"></span></div>`).join('');
  const n = v.votes.length;
  return `<div class="v-verdict">
  <header class="hdr">
    <div class="hdr-left">${brand()}<span class="crumb"><a href="#/journal">${d.example ? 'Examples' : 'Councils'}</a>  /  ${h(m.meta.question)}</span></div>
    <div class="actions">${saveBtn}<button type="button" class="btn btn-ghost" data-act="share">${icon('share')}Share</button><button type="button" class="btn btn-primary" data-act="pdf">${icon('download')}Download PDF</button></div>
  </header>
  <main id="main" class="wrap">
    <section class="hero">
      <span class="meta"><span class="pill"><i></i>Council verdict</span>${v.meta.map(h).join('  ·  ')}<span class="no-print">  ·  <a href="#/live">See the debate</a></span></span>
      <p class="print-only" style="margin:0;font-size:13px;color:var(--mute)">${h(m.meta.question)}</p>
      <h1>${h(v.label)}</h1>
      <p class="lede">${h(v.call)}</p>
      <p class="close">${h(v.closeLine)}  <span>${h(v.disclaimer)}</span></p>
    </section>
    <section class="stats" aria-label="Verdict at a glance">
      <div class="card stat"><span class="k">Council score</span><span class="big">${h(st.council.value)}<small>out of 10</small></span><div class="bars">${bars(st.council.bars.map((b) => ({ ...b, pct: Number(b.v) * 10 })))}</div></div>
      <div class="card stat"><span class="k">Evidence</span><span class="big">${h(st.evidence.word)}</span><span class="ticks" role="img" aria-label="${st.evidence.found} of ${st.evidence.total} facts found" style="grid-template-columns:repeat(${ticksCols}, minmax(0, 1fr))">${ticks}</span><span class="note">${h(st.evidence.note)}</span></div>
      <div class="card stat"><span class="k">How united</span><span class="big">${h(st.united.word)}</span><div class="dotplot" role="img" aria-label="${h(st.united.note)}"><span class="axis"></span><span class="band" style="left:${st.united.bandLeft}%;width:${st.united.bandWidth}%"></span>${dots}<span class="end" style="left:-9px">1</span><span class="end" style="right:-9px">10</span></div><span class="note">${h(st.united.note)}</span></div>
      <div class="card stat"><span class="k">Your bias check</span>${bias}</div>
    </section>
    ${v.banner ? `<div class="banner"><span><i></i>${h(v.banner)}</span><button type="button" class="cmd" data-act="cmd" title="Copy the command">${h(v.cmd)}</button></div>` : ''}
    ${spotlightSection(v, n)}
    <section class="card sec" aria-label="How each investor scored the choices">
      <div class="sec-h"><h2>How each investor scored the choices</h2><span class="sub">${h(sc.note)}</span></div>
      <div class="scroller" tabindex="0" aria-label="Scores table, scrolls sideways"><table class="score">
        <thead><tr><th scope="col">Investor</th>${sc.heads.map((x) => `<th scope="col" class="${x.rec ? 'rec' : ''}">${h(x.label)}</th>`).join('')}<th scope="col" style="text-align:left;padding-left:14px">Stance</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td>Council</td>${sc.council.map((c) => `<td class="n${c.rec ? ' rec' : ''}">${h(c.v)}</td>`).join('')}<td></td></tr></tfoot>
      </table></div>
      <span class="scroll-hint">Swipe the table sideways to see every choice.</span>
    </section>
    <section class="two">
      <div class="card sec"><h2>What would change the call</h2>${kills}${checkin}</div>
      <div class="stack">
        ${ob ? `<div class="card objection">${face(ob, 'av', `${ob.name}, simulated seat`)}<div class="tx"><span class="k">The strongest objection</span><blockquote>“${h(ob.quote)}”</blockquote><span class="if">${h(ob.ifText)}</span></div></div>` : ''}
        <div class="card sec"><h2>Why the council landed here</h2>${v.why.map((w) => `<div class="reason">${face(w, 'av', w.name)}<span>${h(w.text)}<span class="by">${h(w.name)}</span></span></div>`).join('')}</div>
      </div>
    </section>
    <section class="two">
      <div class="card sec"><h2>How this could go wrong</h2><span class="intro">${h(v.premortem.intro)}</span>${v.premortem.items.map((p, i) => `<div class="pm"><span class="n">${i + 1}</span><span>${h(p)}</span></div>`).join('')}</div>
      <div class="card sec share-sec">
        <div class="sec-h" style="align-items:center"><h2>Share card</h2><button type="button" class="btn btn-primary" data-act="copy-image" style="padding:7px 12px">${icon('image')}Copy image</button></div>
        <div class="share" id="share-card">
          <div class="l"><span class="by">${MARK.replace('class="mark"', 'class="mark"')}${h(v.share.seatsLine)}</span><span class="q">${h(v.share.question)}</span><span class="lab">${h(v.share.label)}</span><span class="txt">${h(v.share.text)}</span>
            <span class="key"><span><i class="c-agrees"></i>Agrees</span><span><i class="c-partly"></i>Partly agrees</span><span><i class="c-disagrees"></i>Disagrees</span></span>
            <span class="url">github.com/abhinavuppal931/mosaic  ·  Simulated investors. Not investment advice.</span></div>
          <div class="tiles">${tiles}</div>
        </div>
      </div>
    </section>
    <section class="sources" aria-label="Sources"><button type="button" class="lnk" data-act="sources" aria-haspopup="dialog">Sources</button>${v.sources.lines.map((l) => `<span>${h(l)}</span>`).join('')}${v.sources.notConnected ? `<span class="nc">${h(v.sources.notConnected)}</span>` : ''}</section>
  </main>
  <footer class="foot"><span>The investors are simulations built from their public work. Not affiliated with or endorsed by them.</span><span>Grades a decision process. Not investment advice.</span></footer>
  </div>`;
}

/* ---------- Investor spotlight (B6) ---------- */

/** The cards row, with the open investor's reasoning in place under it. */
function spotlightSection(v, n) {
  const sp = v.spotlight;
  const open = sp.panels.find((p) => p.key === S.seat) || null;
  if (!open) S.seat = null;
  const cards = sp.panels.map((p) => {
    const on = open?.key === p.key;
    const aria = `${p.name}: ${p.stance.toLowerCase()}${p.agreementText && p.agreementText !== p.stance ? `, ${p.agreementText.toLowerCase()} by the scores` : ''}. ${on ? 'Hide' : 'Show'} reasoning.`;
    return `<button type="button" class="card vote" data-act="seat" data-key="${h(p.key)}" aria-expanded="${on}" aria-controls="spotlight" aria-label="${h(aria)}" title="${h(`${p.agreementText}. ${v.votes.find((r) => r.key === p.key)?.note || ''}`)}">
      ${face(p, 'av', '')}<span class="nm">${h(p.short)}</span><span class="agree ${h(p.cls)}">${h(p.stance)}</span><span class="more">${on ? 'Showing below' : 'Reasoning'}</span><span class="notch" aria-hidden="true"></span>
    </button>`;
  }).join('');
  let anim = '';
  if (open && open.key !== S.animSeat) anim = ` sw${(S.swap ^= 1)}`;
  S.animSeat = open?.key || null;
  return `<section class="sp-sec" aria-labelledby="seats-h">
    <div class="sp-h"><h2 id="seats-h">${h(sp.heading)}</h2><span class="hint">${h(sp.hint)}</span></div>
    <span class="sp-sub">${h(sp.sub)}</span>
    <div class="votes sp-cards${open ? ' dim' : ''}" style="--n:${n}">${cards}</div>
    ${open ? spotPanel(open, anim) : ''}
  </section>`;
}

const pct = (x) => `${Math.max(0, Math.min(10, Number(x))) * 10}%`;

/** A summary dot row: dot for the final score, ring for round 1 joined by a line, grey council tick. */
function dotRow(r) {
  return `<div class="irow${r.strong ? ' strong' : ''}" role="img" aria-label="${h(r.aria)}">
    <span class="l"><span class="o">${h(r.label)}</span><span class="m">Council ${h(r.councilText)}</span></span>
    <span class="t"><span class="dtrack"></span>${r.moved ? `<span class="dlink" style="left:${pct(r.lo)};width:${(r.hi - r.lo) * 10}%"></span><span class="dring" style="left:${pct(r.start)}"></span>` : ''}${r.fin !== null && r.fin !== undefined ? `<span class="ddot" style="left:${pct(r.fin)}"></span>` : ''}<span class="dtick" style="left:${pct(r.council)}"></span></span>
    <span class="v">${h(r.v)}</span>
  </div>`;
}

function miniRows(step) {
  if (!step.mini.length) return '';
  const rows = step.mini.map((x) => `<div class="mrow${x.changed ? ' ch' : ''}"><span class="o">${h(x.label)}</span><span class="tr"><span class="dtrack"></span>${x.changed ? `<span class="dlink" style="left:${pct(Math.min(x.from, x.at))};width:${Math.abs(x.at - x.from) * 10}%"></span><span class="dring" style="left:${pct(x.from)}"></span>` : ''}${x.v !== '' ? `<span class="ddot" style="left:${pct(x.at)}"></span>` : ''}${x.council !== null ? `<span class="dtick" style="left:${pct(x.council)}"></span>` : ''}</span><span class="v">${h(x.v)}</span></div>`).join('');
  return `<div class="rmini" aria-hidden="true">${rows}<div class="mscale"><span class="t"><span>0</span><span>10</span></span></div></div>`;
}

function spotPanel(p, anim) {
  const L = p.labels;
  const cond = p.condition
    ? `<div class="sp-box">${p.condition.kind === 'amend' ? `<span class="row"><span class="sp-lbl">${h(p.condition.label)}</span>${p.condition.state ? `<span class="state${p.condition.adopted ? ' on' : ''}">${h(p.condition.state)}</span>` : ''}</span>` : `<span class="sp-lbl">${h(p.condition.label)}</span>`}<span class="t15">${h(p.condition.text)}</span></div>`
    : '';
  const scored = p.rows.length
    ? `<div class="sp-grp sc">
        <div class="sp-grp" style="gap:8px"><span style="display:flex;flex-direction:column;gap:2px"><h4 class="sp-h3">${h(L.scored)}</h4><span class="sp-lbl">0 rules a choice out, 10 is a strong yes.</span></span>
        <span class="sp-key"><span><i class="fin"></i>Final score</span>${p.hasMoves ? '<span><i class="ring"></i>Round 1</span>' : ''}<span><i class="tick"></i>Council</span></span></div>
        ${p.rows.map(dotRow).join('')}
        <div class="dscale" aria-hidden="true"><span class="t"><span>0  Rules it out</span><span>Strong yes  10</span></span></div>
        ${p.keptNote ? `<span class="sp-note">${h(p.keptNote)}</span>` : ''}
        <span class="sp-note">${h(p.councilNote)}</span>
      </div>`
    : `<p class="sp-note">${h(p.councilNote)}</p>`;
  const why = p.why.map((w, i) => `<div class="sp-why"><span class="n">${i + 1}</span><span class="tx"><span>${h(w.text)}</span>${w.chips.length ? `<span class="sp-chips">${w.chips.map((c) => `<span class="fchip" title="${h(c.title)}">${h(c.label)}<b>${h(c.value)}</b></span>`).join('')}</span>` : ''}</span></div>`).join('');
  const duo = p.risk || p.wrong
    ? `<div class="sp-duo">${p.risk ? `<div class="sp-box"><span class="sp-lbl">${h(L.risk)}</span><span class="t14">${h(p.risk)}</span></div>` : ''}${p.wrong ? `<div class="sp-box"><span class="sp-lbl">${h(L.wrong)}</span><span class="t14">${h(p.wrong)}</span>${p.now ? `<span class="fchip" title="${h(p.now.title)}">${h(p.now.label)}<b>${h(p.now.value)}</b></span>` : ''}</div>` : ''}</div>`
    : '';
  const moves = p.moves.length
    ? `<div class="sp-box mv"><span class="sp-lbl">${h(L.moves)}</span>${p.moves.map((m) => `<span class="mvi"><b>${h(m.head)}</b>${m.why ? `<span>${h(m.why)}</span>` : ''}</span>`).join('')}</div>`
    : '';
  const steps = p.steps.map((st) => `<li class="rstep${st.final ? ' final' : ''}">
      <span class="head"><span class="node">${st.n}</span><span class="ttl"><b>${h(st.title)}</b><span class="sp-lbl">${h(st.sub)}</span></span></span>
      ${miniRows(st)}
      ${st.blocks.map((b) => (b.face
        ? `<span class="blk face">${face(b.face, 'av', '')}<span class="in"><span class="sp-lbl">${h(b.label)}</span><span class="say">${h(b.text)}</span></span></span>`
        : `<span class="blk">${b.label ? `<span class="sp-lbl">${h(b.label)}</span>` : ''}<span class="say">${h(b.text)}</span></span>`)).join('')}
    </li>`).join('');
  const hasCouncil = p.steps.some((st) => st.council);
  return `<div id="spotlight" class="spot${anim}" role="region" aria-label="${h(p.name)}, reasoning" data-key="${h(p.key)}">
    <div class="sp-top">
      <div class="sp-id">${face(p, 'av', '')}<div class="tx">
        <span class="nmrow"><h3 class="sp-name" id="spot-name" tabindex="-1"><span class="full">${h(p.name)}</span><span class="short">${h(p.short)}</span></h3><span class="agree ${h(p.cls)}">${h(p.stance)}</span></span>
        <span class="psub">Simulated<span class="lens"> investor</span>  ·  ${p.pos} of ${p.total}${p.role ? `<span class="lens">  ·  ${h(p.role)}</span>` : ''}</span>
      </div></div>
      <span class="sp-ctl"><button type="button" class="ibtn" data-act="seat-prev" aria-label="Previous investor">${icon('chevronLeft')}</button><button type="button" class="ibtn" data-act="seat-next" aria-label="Next investor">${icon('chevronRight')}</button><button type="button" class="ibtn" data-act="seat-close" aria-label="Close">${icon('x')}</button></span>
    </div>
    <div class="sp-cols">
      <div class="sp-col">
        ${p.line ? `<div class="sp-grp q"><p class="sp-quote">“${h(p.line.replace(/[.]$/, '.'))}”</p><span class="sp-lbl">${h(L.line)}</span></div>` : ''}
        <div class="sp-grp"><p class="sp-p">${h(p.bridge)}</p>${cond}</div>
        ${scored}
      </div>
      <div class="sp-col r">
        ${why ? `<h4 class="sp-h3">${h(L.case)}</h4>${why}` : ''}
        ${duo}
        ${moves}
      </div>
    </div>
    ${steps ? `<div class="sp-rounds"><span class="hd"><h4 class="sp-h3">${h(L.rounds)}</h4><span class="sp-key sm"><span><i class="fin"></i>${h(L.his)}</span><span><i class="ring"></i>Round before</span>${hasCouncil ? '<span><i class="tick"></i>Council, final round</span>' : ''}</span></span><ol class="rsteps" style="--k:${p.steps.length}">${steps}</ol></div>` : ''}
    <div class="sp-foot">
      ${p.question ? `<span class="qq"><span class="sp-lbl">${h(L.question)}</span><b>${h(p.question)}</b></span>` : ''}
      <span class="src"><span>${h(L.uses)} <button type="button" class="flink" data-act="sources" aria-haspopup="dialog">${h(p.factsText)}</button>.</span><span class="dis">${h(p.disclaimer)}</span></span>
    </div>
  </div>`;
}

/** Move to another investor (by offset), or open or close one, through the hash so Back works. */
function goSeat(key, fx) {
  S.pendingFx = fx || null;
  S.navKey = key || null; // where the hash is heading, so a quick second key press steps from there
  const target = seatHash(key);
  if (location.hash === target) return;
  location.hash = target;
}
function stepSeat(d) {
  const panels = S.data?.model?.verdict?.spotlight?.panels || [];
  const i = panels.findIndex((p) => p.key === (S.navKey !== undefined ? S.navKey : S.seat));
  if (i < 0 || !panels.length) return;
  goSeat(panels[(i + d + panels.length) % panels.length].key, { scroll: true, focus: 'panel' });
}

/** After a render: scroll the panel's top into view, keep the selected card in the strip, and move focus. */
function afterSeat() {
  const fx = S.seatFx;
  S.seatFx = null;
  S.pendingFx = null;
  if (!fx) return;
  const panel = $('#spotlight');
  const strip = $('.sp-cards');
  const card = strip && $(`.vote[data-key="${CSS.escape(S.seat || fx.key || '')}"]`, strip);
  if (card && strip.scrollWidth > strip.clientWidth) {
    const left = card.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: reduced() ? 'auto' : 'smooth' });
  }
  if (panel && fx.scroll) {
    const top = panel.getBoundingClientRect().top;
    if (fx.force || top < 0 || top > window.innerHeight - 200) window.scrollTo({ top: window.scrollY + top - 12, behavior: reduced() || fx.force ? 'auto' : 'smooth' });
  }
  if (fx.focus === 'panel') $('#spot-name')?.focus({ preventScroll: true });
  else if (fx.focus === 'card' && card) {
    const r = card.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top - 80, behavior: 'auto' });
    card.focus({ preventScroll: true });
  }
}

/* ---------- Journal ---------- */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};
const labelCase = (s) => (s ? s[0] + s.slice(1).toLowerCase() : '');

function journalView() {
  const j = S.journal;
  const backTo = S.example ? `example/${S.example}` : S.data?.model?.verdict ? 'verdict' : 'live';
  const back = S.data?.ok ? `<a class="btn btn-ghost" href="#/${backTo}">${icon('arrowLeft')}Back to the council</a>` : '';
  let body;
  if (!j) body = '<div class="jempty">Opening the journal.</div>';
  else if (!j.rows?.length && j.examples?.length) body = `<div class="jempty">Nothing saved yet. Until you run a council of your own with /mosaic, here are three finished ones to open.</div>${j.examples.map((r) => {
    const opt = r.latest?.options?.find((o) => o.id === r.recommended);
    return `<a class="jrow" href="#/example/${h(r.example)}"><div><div class="t">${h(r.company ? `${r.key}, ${labelCase(r.company)}` : r.key)}</div><div class="s">${h(r.latest?.decision || '')}</div></div>
    <div><div>${h(labelCase(r.label || ''))}</div><div class="s">${h(opt ? `“${opt.label}”` : '')}</div></div>
    <div class="hide-sm"><div>${h(fmtDate(r.lastVerdict))}</div><div class="s">Example council</div></div>
    <div><div>Open it</div><div class="s">${S.example === r.example || (!S.example && S.data?.session === r.example) ? 'Showing now' : 'Finished'}</div></div></a>`;
  }).join('')}`;
  else if (!j.rows?.length) body = `<div class="jempty">Nothing saved yet. When a council reaches a verdict, use Save to journal and it will be listed here with its next check-in date.</div>`;
  else body = j.rows.map((r) => {
    const opt = r.latest?.options?.find((o) => o.id === r.recommended);
    return `<div class="jrow"><div><div class="t">${h(r.company ? `${r.key}, ${labelCase(r.company)}` : r.key)}</div><div class="s">${h(r.latest?.decision || '')}</div></div>
    <div><div>${h(labelCase(r.label || ''))}</div><div class="s">${h(opt ? `“${opt.label}”` : '')}</div></div>
    <div class="hide-sm"><div>${h(fmtDate(r.lastVerdict))}</div><div class="s">${r.entries === 1 ? 'One verdict' : `${WORDS[r.entries] || r.entries} verdicts`}</div></div>
    <div><div class="${r.due ? 'due' : ''}">${h(fmtDate(r.nextRecheck) || 'No date')}</div><div class="s">${r.due ? 'Check-in due now' : 'Next check-in'}</div></div></div>`;
  }).join('');
  return `<div class="v-journal"><header class="hdr"><div class="hdr-left">${brand()}<span class="crumb">Journal</span></div><div class="actions">${back}</div></header>
  <main id="main" class="wrap"><div><h1>Your journal</h1><p class="lede">Every council you saved, soonest check-in first.</p></div><section class="card jlist" aria-label="Saved councils">${body}</section></main>
  <footer class="foot"><span>The investors are simulations built from their public work. Not affiliated with or endorsed by them.</span><span>Grades a decision process. Not investment advice.</span></footer></div>`;
}

/* ---------- Sources drawer ---------- */

let lastFocus = null;
function renderDrawer() {
  let scrim = $('#scrim');
  let dr = $('#drawer');
  if (!dr) {
    document.body.insertAdjacentHTML('beforeend', '<div class="scrim" id="scrim"></div><aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" aria-hidden="true" tabindex="-1"></aside>');
    scrim = $('#scrim');
    dr = $('#drawer');
    scrim.addEventListener('click', closeDrawer);
  }
  const m = S.data?.model;
  if (!m) return;
  const e = m.evidence;
  const row = (f, miss) => `<div class="frow${miss ? ' miss' : ''}"><span class="fl">${h(f.label)}</span><span class="fv">${h(miss ? 'Not found' : f.value)}</span><span class="fs">${h(f.title || 'No source connected')}</span></div>`;
  const problems = m.problems || [];
  dr.innerHTML = `<div class="dh"><div><h2 id="drawer-title">Sources</h2><p>${h(e.note)}</p></div><button type="button" class="icon-btn" data-act="close-drawer" aria-label="Close the sources">${icon('x')}</button></div>
  <div class="db">
    <div><h3>Where the numbers came from</h3>${(m.sources.length ? m.sources : ['No data pack yet.']).map((s) => `<div class="srcline">${h(s)}</div>`).join('')}${e.notConnectedText ? `<div class="srcline" style="color:var(--rose-2)">${h(e.notConnectedText)}</div>` : ''}</div>
    ${e.missingFacts.length ? `<div><h3>Not found</h3>${e.missingFacts.map((f) => row(f, true)).join('')}</div>` : ''}
    <div><h3>Facts the council used</h3>${e.foundFacts.map((f) => row(f, false)).join('') || '<div class="srcline">None yet.</div>'}</div>
    ${problems.length ? `<div><h3>Checks on the session files</h3>${problems.map((p) => `<div class="problem">${h(p.file)}. ${h(p.message)}</div>`).join('')}</div>` : ''}
  </div>`;
  dr.classList.toggle('open', S.drawer);
  scrim.classList.toggle('open', S.drawer);
  dr.setAttribute('aria-hidden', String(!S.drawer));
  dr.inert = !S.drawer;
}
function openDrawer() {
  lastFocus = document.activeElement;
  S.drawer = true;
  renderDrawer();
  setTimeout(() => $('#drawer [data-act="close-drawer"]')?.focus(), 30);
}
function closeDrawer() {
  S.drawer = false;
  renderDrawer();
  lastFocus?.focus?.();
}

/* ---------- Actions ---------- */

let toastTimer;
function toast(msg, ok = true) {
  const t = $('#toast');
  t.innerHTML = `${ok ? icon('check') : ''}<span>${h(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
}

async function save() {
  if (S.saving) return;
  S.saving = true;
  render();
  try {
    const r = await fetch('/api/journal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Could not save.');
    if (S.data?.journal) S.data.journal.saved = true;
    toast(`Saved to your journal. Next check-in ${fmtDate(j.nextRecheck) || 'set'}.`);
  } catch (e) {
    toast(e.message || 'Could not save to the journal.', false);
  } finally {
    S.saving = false;
    render();
  }
}

function loadImage(src) {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = src;
  });
}

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Draw the share card at 1200 by 630 (doubled for sharpness) and return a PNG blob. */
async function shareCanvas() {
  const v = S.data.model.verdict;
  await document.fonts.ready;
  const W = 1200, H = 630, K = 2;
  const cv = document.createElement('canvas');
  cv.width = W * K;
  cv.height = H * K;
  const c = cv.getContext('2d');
  c.scale(K, K);
  const F = (w, px) => `${w} ${px}px Switzer, system-ui, -apple-system, 'Segoe UI', sans-serif`;
  c.fillStyle = '#0B0A09';
  c.fillRect(0, 0, W, H);
  const LW = Math.round((W * 1.15) / 2.15);
  const P = 48;
  // Mark and byline.
  // The Mosaic mark (docs/mark.svg): the amber tile is turned 8 degrees and nudged out of line.
  const sq = [['#9A9187', 0, 0, 0], ['#FF7A38', 1, 0, 8], ['#6F6860', 0, 1, 0], ['#A3C4AA', 1, 1, 0]];
  for (const [col, x, y, turn] of sq) {
    c.save();
    c.fillStyle = col;
    c.translate(P + x * 14 + 6 + (turn ? 1 : 0), P + y * 14 + 6 - (turn ? 1 : 0));
    c.rotate((turn * Math.PI) / 180);
    c.beginPath();
    c.roundRect(-6, -6, 12, 12, 3);
    c.fill();
    c.restore();
  }
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#9A938A';
  c.font = F(500, 20);
  c.fillText(v.share.seatsLine, P + 40, P + 21);
  let y = P + 82;
  c.fillStyle = '#D4CDC3';
  c.font = F(400, 26);
  for (const l of wrap(c, v.share.question, LW - 2 * P).slice(0, 2)) {
    c.fillText(l, P, y);
    y += 34;
  }
  y += 22;
  c.fillStyle = '#F5F2EC';
  c.font = F(600, 58);
  if ('letterSpacing' in c) c.letterSpacing = '-2px';
  for (const l of wrap(c, v.share.label, LW - 2 * P).slice(0, 2)) {
    c.fillText(l, P, y + 30);
    y += 60;
  }
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  y += 34;
  c.fillStyle = '#B5AEA4';
  c.font = F(400, 22);
  for (const l of wrap(c, v.share.text, LW - 2 * P).slice(0, 4)) {
    c.fillText(l, P, y);
    y += 32;
  }
  // Key and footer.
  let kx = P;
  c.font = F(500, 17);
  for (const [col, t] of [['#A3C4AA', 'Agrees'], ['#E8C88F', 'Partly agrees'], ['#B97A6C', 'Disagrees']]) {
    c.fillStyle = col;
    c.fillRect(kx, H - 128, 16, 5);
    c.fillStyle = '#9A938A';
    c.fillText(t, kx + 22, H - 120);
    kx += 22 + c.measureText(t).width + 24;
  }
  c.fillStyle = '#6F6A63';
  c.font = F(400, 17);
  c.fillText('Simulated investors. Not investment advice.', P, H - 70);
  c.fillText('github.com/abhinavuppal931/mosaic', P, H - 44);
  // Tiles.
  const tiles = v.share.tiles;
  const cols = 3, gap = 6, pad = 6;
  const rows = Math.ceil(tiles.length / cols);
  const avail = W - LW - 2 * pad;
  const size = Math.min((avail - (cols - 1) * gap) / cols, (H - 2 * pad - (rows - 1) * gap) / rows);
  const tx0 = LW + pad + (avail - (cols * size + (cols - 1) * gap)) / 2;
  const ty0 = (H - (rows * size + (rows - 1) * gap)) / 2;
  const colOf = { agrees: '#A3C4AA', partly: '#E8C88F', disagrees: '#B97A6C', abstain: '#3A3733', none: '#3A3733' };
  const imgs = await Promise.all(tiles.map((t) => (t.kind === 'seat' && t.img ? loadImage(t.img) : null)));
  tiles.forEach((t, i) => {
    const x = tx0 + (i % cols) * (size + gap);
    const yy = ty0 + Math.floor(i / cols) * (size + gap);
    c.save();
    c.beginPath();
    c.roundRect(x, yy, size, size, 8);
    c.clip();
    if (t.kind === 'score') {
      c.fillStyle = '#F3F1EC';
      c.fillRect(x, yy, size, size);
      c.fillStyle = '#141210';
      c.font = F(600, 58);
      c.textAlign = 'center';
      c.fillText(t.text, x + size / 2, yy + size / 2 + 20);
    } else if (t.kind === 'runner') {
      c.fillStyle = '#1C1A17';
      c.fillRect(x, yy, size, size);
      c.fillStyle = '#9F988E';
      c.font = F(500, 24);
      c.textAlign = 'center';
      const ls = wrap(c, t.text, size - 24).slice(0, 3);
      ls.forEach((l, k) => c.fillText(l, x + size / 2, yy + size / 2 + 8 - ((ls.length - 1) * 30) / 2 + k * 30));
    } else {
      c.fillStyle = '#141210';
      c.fillRect(x, yy, size, size);
      const im = imgs[i];
      if (im) {
        const s = Math.max(size / im.width, size / im.height);
        const w = im.width * s, hh = im.height * s;
        c.drawImage(im, x + (size - w) / 2, yy + (size - hh) * 0.22, w, hh);
      } else {
        c.fillStyle = '#F5F2EC';
        c.font = F(600, 40);
        c.textAlign = 'center';
        c.fillText(t.initials || '', x + size / 2, yy + size / 2 + 14);
      }
      const g = c.createLinearGradient(0, yy + size * 0.55, 0, yy + size);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.65)');
      c.fillStyle = g;
      c.fillRect(x, yy, size, size);
      c.textAlign = 'left';
      c.fillStyle = '#F5F2EC';
      c.font = F(600, 18);
      c.fillText(t.text, x + 10, yy + size - 18);
      c.fillStyle = colOf[t.cls] || '#3A3733';
      c.fillRect(x, yy + size - 7, size, 7);
    }
    c.restore();
    c.textAlign = 'left';
  });
  return new Promise((ok) => cv.toBlob((b) => ok(b), 'image/png'));
}

function shareText() {
  const m = S.data.model;
  const v = m.verdict;
  return [`Mosaic council on “${m.meta.question}”`, `${v.label}. ${v.call}`, v.share.text, 'Simulated investors. Not investment advice. github.com/abhinavuppal931/mosaic'].join('\n');
}

/** Copy text: the clipboard API, or a selection copy when the API refuses (for example when the
 * page has lost focus to a download). Resolves to true when the text was copied. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

async function share() {
  const blob = await shareCanvas();
  const name = `mosaic-${S.data.model.id}.png`;
  downloadBlob(blob, name);
  const copied = await copyText(shareText());
  window.__mosaicLastShare = { size: blob.size, name, text: shareText(), copied };
  toast(copied ? 'Share card saved as an image. A short summary is on your clipboard.' : 'Share card saved as an image.');
}

async function copyImage() {
  const blob = await shareCanvas();
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Share card copied as an image.');
  } catch {
    downloadBlob(blob, `mosaic-${S.data.model.id}.png`);
    toast('Your browser would not copy images, so the card was saved instead.');
  }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'seat') goSeat(el.dataset.key === S.seat ? null : el.dataset.key, el.dataset.key === S.seat ? { focus: 'card', key: S.seat } : { scroll: true, focus: 'panel' });
  else if (act === 'seat-prev') stepSeat(-1);
  else if (act === 'seat-next') stepSeat(1);
  else if (act === 'seat-close') goSeat(null, { focus: 'card', key: S.seat });
  else if (act === 'sources') openDrawer();
  else if (act === 'close-drawer') closeDrawer();
  else if (act === 'save') save();
  else if (act === 'share') share().catch(() => toast('The share card could not be made.', false));
  else if (act === 'copy-image') copyImage().catch(() => toast('The share card could not be made.', false));
  else if (act === 'pdf') window.print();
  else if (act === 'replay') (S.replay === null ? startReplay() : stopReplay());
  else if (act === 'cmd') copyText(el.textContent).then((ok) => toast(ok ? 'Command copied.' : 'Could not copy. Select the command and copy it by hand.', ok));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.drawer) return closeDrawer();
  if (S.view === 'verdict' && S.seat && !S.drawer && !e.altKey && !e.ctrlKey && !e.metaKey && !e.target.closest('input, textarea, select, .scroller')) {
    if (e.key === 'Escape') return goSeat(null, { focus: 'card', key: S.seat });
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      return stepSeat(e.key === 'ArrowRight' ? 1 : -1);
    }
  }
  if (S.drawer && e.key === 'Tab') {
    const f = [...$('#drawer').querySelectorAll('button, [tabindex="0"]')];
    if (f.length) {
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  if (S.view === 'live' && S.data?.done && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('input, textarea')) {
    const n = S.data.model.live.length;
    clearInterval(S.replayTimer);
    const cur = S.replay ?? n - 1;
    S.replay = Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? 1 : -1)));
    if (S.replay === n - 1) S.replay = null;
    render();
  }
});

window.addEventListener('beforeprint', () => {
  if (S.drawer) closeDrawer();
});

route();
connect();
