// projects.js — the projects "depth-fly galaxy" and the calm detail reader.
// Projects are luminous nodes at varying depths; scroll / arrows / swipe drift
// the focus forward and back through them like adjusting a telescope. The
// focused node is large, sharp and titled; the rest recede into soft focus.
// Clicking the focused node blooms it open into a still, fully-readable detail
// view (no rectangular modal). Motion for delight, stillness for reading.

import { PROJECTS } from './projects-data.js';

const N = PROJECTS.length;
const SPACING = 470;     // z-distance between consecutive nodes (px) — deep travel
const PERSP = 1000;      // MUST match the CSS `perspective` on .galaxy
const EASE = 0.11;       // focus glide

// a wandering path in normalised space [-1, 1]; scaled to the viewport at
// render time so the field uses the whole frame on any screen.
const NX = [], NY = [];
for (let i = 0; i < N; i++) {
  NX[i] = Math.sin(i * 0.85 + 0.5);
  NY[i] = Math.cos(i * 1.25 + 0.4);
}
const lerp = (a, b, t) => a + (b - a) * t;
function interpBase(arr, f) {
  const i = Math.max(0, Math.min(N - 1, Math.floor(f)));
  const j = Math.min(N - 1, i + 1);
  return lerp(arr[i], arr[j], f - i);
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* -------------------------------------------------------- inline formatting */
// preserve the source's **bold** / *italic*, nothing else.
function inline(s) {
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
}
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* ------------------------------------------------------------------- detail */
// Build the reading view for a project. Heavy media is created here — i.e. only
// once a project is actually opened — so nothing loads until asked for.
function buildDetail(p) {
  const root = el('div', 'detail-inner');
  root.style.setProperty('--accent', p.accent);

  const head = el('header', 'detail-head');
  head.appendChild(el('p', 'detail-num', p.num));
  head.appendChild(el('h2', 'detail-title', inline(p.title)));
  head.appendChild(el('p', 'detail-sub', inline(p.subtitle)));
  if (p.team) head.appendChild(el('p', 'detail-team', inline(p.team)));
  const tags = el('div', 'detail-tags');
  if (p.result) tags.appendChild(el('span', 'detail-result', inline(p.result)));
  if (tags.childNodes.length) head.appendChild(tags);
  head.appendChild(el('p', 'detail-tagline', inline(p.tagline)));
  root.appendChild(head);

  // media — images + optional video
  if ((p.images && p.images.length) || p.video) {
    const media = el('div', 'detail-media');
    for (const im of (p.images || [])) {
      const fig = el('figure', 'detail-shot');
      const img = el('img');
      img.src = im.src; img.alt = im.alt || ''; img.loading = 'lazy'; img.decoding = 'async';
      fig.appendChild(img);
      media.appendChild(fig);
    }
    if (p.video) {
      const fig = el('figure', 'detail-shot detail-shot--video');
      const v = document.createElement('video');
      v.src = p.video.src; v.controls = true; v.preload = 'none'; v.playsInline = true;
      v.setAttribute('aria-label', p.video.alt || p.title);
      fig.appendChild(v);
      media.appendChild(fig);
    }
    root.appendChild(media);
  }

  const body = el('div', 'detail-body');
  for (const sec of p.sections) {
    const s = el('section', 'detail-section');
    if (sec.h) s.appendChild(el('h3', null, inline(sec.h)));
    for (const para of (sec.p || [])) s.appendChild(el('p', null, inline(para)));
    if (sec.blocks) {
      for (const b of sec.blocks) {
        const blk = el('div', 'detail-block');
        if (b.h) blk.appendChild(el('h4', null, inline(b.h)));
        for (const para of (b.p || [])) blk.appendChild(el('p', null, inline(para)));
        s.appendChild(blk);
      }
    }
    if (sec.list) {
      const ul = el('ul', 'detail-list');
      for (const it of sec.list) ul.appendChild(el('li', null, inline(it)));
      s.appendChild(ul);
    }
    body.appendChild(s);
  }
  root.appendChild(body);

  // links + documents
  if ((p.links && p.links.length) || (p.documents && p.documents.length)) {
    const foot = el('div', 'detail-foot');
    if (p.documents && p.documents.length) {
      const g = el('div', 'detail-docs');
      g.appendChild(el('h3', 'detail-foot-h', 'Documents'));
      for (const d of p.documents) {
        const a = el('a', 'detail-doc');
        a.href = d.href; a.target = '_blank'; a.rel = 'noopener';
        a.innerHTML = `<span class="detail-doc-label">${inline(d.label)}</span>` +
          (d.note ? `<span class="detail-doc-note">${inline(d.note)}</span>` : '');
        g.appendChild(a);
      }
      foot.appendChild(g);
    }
    if (p.links && p.links.length) {
      const g = el('div', 'detail-extlinks');
      g.appendChild(el('h3', 'detail-foot-h', 'Links'));
      const row = el('div', 'detail-link-row');
      for (const l of p.links) {
        const a = el('a', 'detail-link');
        a.href = l.href; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = l.label;
        row.appendChild(a);
      }
      g.appendChild(row);
      foot.appendChild(g);
    }
    root.appendChild(foot);
  }

  return root;
}

/* -------------------------------------------------------------- controller */
const SVG_NS = 'http://www.w3.org/2000/svg';

export function initProjects({ env, onFocus }) {
  const stage = document.getElementById('view-projects');
  const field = document.getElementById('galaxy-field');
  const pager = document.getElementById('galaxy-pager');
  const hint = document.getElementById('galaxy-hint');
  const eyebrow = stage.querySelector('.galaxy-eyebrow');
  const ghost = document.getElementById('galaxy-ghost');
  const thread = document.getElementById('galaxy-thread');
  const detail = document.getElementById('detail');
  if (!stage || !field || !detail) return null;

  let nodes = [];
  let threadLines = [];
  let built = false;
  let active = false;
  let focus = 0, target = 0;
  let running = false, rafId = 0;
  let detailOpen = false;
  let interacted = false;

  // viewport + amplitude, recomputed on resize — the field spans the frame
  let vw = window.innerWidth, vh = window.innerHeight, AMPX = 0, AMPY = 0;
  function measure() {
    vw = window.innerWidth; vh = window.innerHeight;
    AMPX = Math.min(vw * 0.46, 700);
    AMPY = Math.min(vh * 0.42, 430);
    if (thread) { thread.setAttribute('width', vw); thread.setAttribute('height', vh); }
  }

  /* ----- build the node field once ----- */
  function build() {
    field.textContent = '';
    pager.textContent = '';
    if (thread) thread.textContent = '';
    threadLines = [];

    // the faint constellation thread, drawn behind the nodes (one segment per gap)
    for (let i = 0; i < N - 1; i++) {
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('class', 'thread-line');
      if (thread) thread.appendChild(ln);
      threadLines.push(ln);
    }

    nodes = PROJECTS.map((p, i) => {
      const btn = el('button', 'node');
      btn.type = 'button';
      btn.style.setProperty('--accent', p.accent);
      btn.setAttribute('aria-label', `${p.title} — ${p.subtitle}`);
      const core = el('span', 'node-core');
      const thumb = el('img', 'node-thumb');
      if (p.images && p.images[0]) {
        thumb.src = p.images[0].src; thumb.alt = ''; thumb.loading = 'lazy'; thumb.decoding = 'async';
      }
      core.appendChild(thumb);
      btn.appendChild(core);
      const meta = el('span', 'node-meta');
      meta.appendChild(el('span', 'node-title', inline(p.title)));
      meta.appendChild(el('span', 'node-sub', inline(p.subtitle)));
      if (p.result) meta.appendChild(el('span', 'node-result', inline(p.result)));
      btn.appendChild(meta);
      btn.addEventListener('click', () => onNodeClick(i));
      field.appendChild(btn);

      // pager dot
      const dot = el('button', 'pager-dot');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Project ${p.num}: ${p.title}`);
      dot.addEventListener('click', () => { stepTo(i); });
      pager.appendChild(dot);
      return { btn, dot, p, sx: 0, sy: 0, sv: 0 };
    });
    built = true;
  }

  /* ----- layout: write every node's depth transform from `focus` ----- */
  function render() {
    const cur = Math.round(focus);
    const bxF = interpBase(NX, focus) * AMPX;   // focused node's base — recentred
    const byF = interpBase(NY, focus) * AMPY;
    const maxBlur = env.coarse ? 6 : 15;        // camera bokeh; lighter on touch

    for (let i = 0; i < N; i++) {
      const nd = nodes[i];
      const d = i - focus;
      const ad = Math.abs(d);

      let z, op;
      if (d >= -0.04) {                 // focus or behind it — recede deep
        z = -d * SPACING;
        // steeper falloff so the most distant peripheral nodes dim well back
        // and never compete with the focused hero for the eye
        op = Math.max(0.06, clamp01(1.14 - d / 4.2));
      } else {                          // in front of focus — soft foreground bokeh
        z = Math.min(-d * SPACING, 150);
        op = clamp01(1 + d * 0.85);
      }
      // the further from focus, the wider into the periphery (fights the
      // vanishing-point clustering so the field fills the frame)
      const spread = 1 + Math.min(ad, 4.5) * 0.17;
      const ox = (NX[i] * AMPX - bxF) * spread;
      const oy = (NY[i] * AMPY - byF) * spread;
      // depth of field: sharp at focus, blur grows with distance to either side
      const blur = Math.min(maxBlur, Math.max(0, (ad - 0.3) * 7.5));

      const st = nd.btn.style;
      st.setProperty('--tx', ox.toFixed(1) + 'px');
      st.setProperty('--ty', oy.toFixed(1) + 'px');
      st.setProperty('--tz', z.toFixed(1) + 'px');
      st.opacity = op.toFixed(3);
      st.setProperty('--blur', blur.toFixed(2) + 'px');
      st.zIndex = String(1000 - Math.round(ad * 10));
      nd.btn.style.pointerEvents = op > 0.14 ? 'auto' : 'none';
      nd.btn.classList.toggle('is-focused', i === cur);
      nd.dot.classList.toggle('is-on', i === cur);

      // project to screen for the constellation thread
      const scale = PERSP / (PERSP - z);
      nd.sx = vw * 0.5 + ox * scale;
      nd.sy = vh * 0.44 + oy * scale;
      nd.sv = op;
    }

    updateThread();
    updateGhost(cur);
    if (onFocus) onFocus(N > 1 ? focus / (N - 1) : 0);
  }

  // a subtle thread linking the projects in sequence — their own little
  // constellation, echoing the Pisces spine on home.
  function updateThread() {
    for (let i = 0; i < threadLines.length; i++) {
      const a = nodes[i], b = nodes[i + 1], ln = threadLines[i];
      ln.setAttribute('x1', a.sx.toFixed(1));
      ln.setAttribute('y1', a.sy.toFixed(1));
      ln.setAttribute('x2', b.sx.toFixed(1));
      ln.setAttribute('y2', b.sy.toFixed(1));
      ln.style.opacity = (Math.min(a.sv, b.sv) * 0.4).toFixed(3);
    }
  }

  // big, faint, editorial project number behind the focused node; it fades out
  // as you drift between projects and the next one fades in.
  function updateGhost(cur) {
    if (!ghost) return;
    if (ghost.textContent !== PROJECTS[cur].num) ghost.textContent = PROJECTS[cur].num;
    const settle = Math.max(0, 1 - Math.abs(focus - cur) * 2);
    ghost.style.opacity = (0.22 * settle).toFixed(3);
  }

  function loop() {
    if (!active) { running = false; return; }
    const diff = target - focus;
    if (Math.abs(diff) < 0.0009) {
      focus = target; render(); running = false; return;
    }
    focus += diff * EASE;
    render();
    rafId = requestAnimationFrame(loop);
  }
  function kick() {
    if (env.reducedMotion) { focus = target; render(); return; }
    if (!running && active) { running = true; rafId = requestAnimationFrame(loop); }
  }

  /* ----- navigation ----- */
  function stepTo(i) {
    target = Math.max(0, Math.min(N - 1, i));
    markInteracted();
    kick();
  }
  function step(delta) { stepTo(Math.round(target) + delta); }

  function markInteracted() {
    if (!interacted) {
      interacted = true;
      if (hint) hint.classList.add('gone');
      if (eyebrow) eyebrow.classList.add('gone');
    }
  }

  function onNodeClick(i) {
    if (detailOpen) return;
    if (Math.round(focus) === i && Math.abs(target - focus) < 0.5) open(i);
    else stepTo(i);
  }

  // wheel / trackpad — accumulate to one project per gesture
  let wheelAcc = 0, wheelTimer = 0;
  function onWheel(e) {
    if (detailOpen) return;          // let the detail scroll natively
    e.preventDefault();
    wheelAcc += e.deltaY;
    const TH = 42;
    if (Math.abs(wheelAcc) >= TH) {
      step(wheelAcc > 0 ? 1 : -1);
      wheelAcc = 0;
    }
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelAcc = 0; }, 160);
  }

  function onKey(e) {
    if (detailOpen) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': case 'PageDown':
        e.preventDefault(); step(1); break;
      case 'ArrowUp': case 'ArrowLeft': case 'PageUp':
        e.preventDefault(); step(-1); break;
      case 'Home': e.preventDefault(); stepTo(0); break;
      case 'End': e.preventDefault(); stepTo(N - 1); break;
      case 'Enter': case ' ':
        e.preventDefault(); open(Math.round(focus)); break;
    }
  }

  // touch — vertical swipe steps focus
  let touchY = 0, touchActive = false;
  function onTouchStart(e) { if (detailOpen) return; touchActive = true; touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (!touchActive || detailOpen) return;
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) > 48) { step(dy > 0 ? 1 : -1); touchY = e.touches[0].clientY; }
  }
  function onTouchEnd() { touchActive = false; }

  /* ----- detail open / close ----- */
  function open(i) {
    if (detailOpen) return;
    const p = PROJECTS[i];
    detail.textContent = '';
    detail.appendChild(buildDetail(p));
    const closeBtn = el('button', 'detail-close', '<span aria-hidden="true">←</span> back to the field');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => closeDetail());
    detail.appendChild(closeBtn);
    detail.style.setProperty('--accent', p.accent);

    // bloom from the node's on-screen centre
    const r = nodes[i].btn.querySelector('.node-core').getBoundingClientRect();
    detail.style.setProperty('--ox', ((r.left + r.width / 2) / window.innerWidth * 100).toFixed(2) + '%');
    detail.style.setProperty('--oy', ((r.top + r.height / 2) / window.innerHeight * 100).toFixed(2) + '%');

    detail.hidden = false;
    detail.setAttribute('aria-hidden', 'false');
    detail.scrollTop = 0;
    // force reflow so the transition runs from the collapsed state
    void detail.offsetWidth;
    detail.classList.add('open');
    detailOpen = true;
    stage.classList.add('has-detail');
    // focus the scrollable article (not the close button) so Space/arrows read
    // rather than accidentally activating a control
    detail.tabIndex = -1;
    detail.focus({ preventScroll: true });
  }
  function closeDetail() {
    if (!detailOpen) return;
    detail.classList.remove('open');
    detailOpen = false;
    stage.classList.remove('has-detail');
    const finish = () => {
      if (detailOpen) return; // re-opened meanwhile
      detail.hidden = true;
      detail.setAttribute('aria-hidden', 'true');
      detail.textContent = '';
    };
    if (env.reducedMotion) finish();
    else setTimeout(finish, 420);
    const f = nodes[Math.round(focus)];
    if (f) f.btn.focus({ preventScroll: true });
  }
  const close = closeDetail; // alias used in onKey

  /* ----- lifecycle ----- */
  function onResize() { measure(); render(); }

  function activate() {
    if (!built) build();
    active = true;
    measure();
    stage.classList.add('is-live');
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    field.addEventListener('touchstart', onTouchStart, { passive: true });
    field.addEventListener('touchmove', onTouchMove, { passive: true });
    field.addEventListener('touchend', onTouchEnd, { passive: true });
    render();
    if (!env.reducedMotion) kick();
  }
  function deactivate() {
    active = false; running = false;
    cancelAnimationFrame(rafId);
    stage.classList.remove('is-live');
    window.removeEventListener('wheel', onWheel, { passive: false });
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    field.removeEventListener('touchstart', onTouchStart);
    field.removeEventListener('touchmove', onTouchMove);
    field.removeEventListener('touchend', onTouchEnd);
    if (detailOpen) { // leave cleanly so we don't return into an open reader
      detail.classList.remove('open');
      detail.hidden = true; detail.setAttribute('aria-hidden', 'true');
      detail.textContent = '';
      detailOpen = false; stage.classList.remove('has-detail');
    }
  }

  return {
    activate, deactivate,
    isDetailOpen: () => detailOpen,
    closeDetail,
    // debug helpers (used by ?project= / ?open=)
    _focusTo: (i) => { focus = target = Math.max(0, Math.min(N - 1, i)); render(); },
    _open: (i) => open(Math.max(0, Math.min(N - 1, i))),
  };
}
