// main.js — boot, environment flags, view state machine (home/projects),
// and the wiring between the DOM and the cosmos. Home<->projects navigation is
// the stargate flight (warp.js); reduced-motion gets a clean fade instead.

import { createCosmos } from './cosmos.js';
import { initConstellation } from './constellation.js';
import { initPortrait } from './portrait.js';
import { initCursor } from './cursor.js';
import { initWarp } from './warp.js';
import { initProjects } from './projects.js';

window.__BOOT_OK__ = true; // cancels the no-webgl watchdog in index.html

const html = document.documentElement;

const env = {
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  coarse: matchMedia('(pointer: coarse)').matches,
};

/* ------------------------------------------------------------- debug HUD */

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
// ?shot — screenshot helper: un-fix the sky so scripted scroll doesn't blank
// the compositor in headless captures. Purely a test aid.
if (params.has('shot')) html.classList.add('shot');
// ?shift=N — slide the home flow up N px (instead of scrolling) so a register
// enters a normal-height viewport; avoids the headless scroll-blank entirely.
const SHIFT = parseInt(params.get('shift') || '0', 10);
const hud = document.getElementById('debug-hud');
const hudLog = [];

window.__DEBUG_LOG__ = (msg) => {
  hudLog.push(msg);
  if (hudLog.length > 6) hudLog.shift();
  console.warn('[debug]', msg);
};

/* ----------------------------------------------------------------- cosmos */

let cosmos = null;
try {
  cosmos = createCosmos({ canvas: document.getElementById('cosmos'), env });
} catch (err) {
  window.__DEBUG_LOG__('cosmos failed: ' + err.message);
}

if (!cosmos) {
  html.classList.add('no-webgl');
} else if (!env.reducedMotion) {
  cosmos.start();
}

/* ------------------------------------------ home: spine, portrait, cursor */

// the portrait re-lays-out once its image paints; the spine measures it.
const constellation = initConstellation({ env });
const portrait = initPortrait({
  env,
  onLayout: () => { if (constellation) constellation.rebuild(); },
});
const cursor = initCursor({ env });
const warp = initWarp({ env });

// the projects galaxy drives the cosmos glow as you drift through its depth
const projects = initProjects({
  env,
  onFocus: (frac) => { if (cosmos) cosmos.setScroll(frac); },
});

if (SHIFT) {
  const hf = document.getElementById('home-flow');
  if (hf) hf.style.transform = `translateY(${-SHIFT}px)`;
}

/* ------------------------------------------------------------ scroll/input */

let scrollScheduled = false;
function publishScroll() {
  scrollScheduled = false;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  if (cosmos) cosmos.setScroll(p);
  if (constellation) constellation.update();
}

window.addEventListener('scroll', () => {
  if (!scrollScheduled) {
    scrollScheduled = true;
    requestAnimationFrame(publishScroll);
  }
}, { passive: true });

if (!env.coarse && !env.reducedMotion) {
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -((e.clientY / window.innerHeight) * 2 - 1);
    if (cosmos) cosmos.setPointer(nx, ny);
    if (portrait) portrait.setPointer(nx, ny);
  }, { passive: true });
}

/* ------------------------------------------------------------------ router */

const views = {
  home: document.getElementById('view-home'),
  projects: document.getElementById('view-projects'),
};
const navProjects = document.getElementById('nav-projects');
const navHome = document.getElementById('nav-home');

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('projects')) return 'projects';
  return 'home';
}

let currentView = null;

function setView(name) {
  if (name === currentView) return;
  const prev = currentView;
  currentView = name;
  document.body.dataset.view = name;
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
  navProjects.hidden = name === 'projects';
  navHome.hidden = name === 'home';
  window.scrollTo({ top: 0, behavior: 'instant' });
  publishScroll();
  // the spine lives in the home view; it can only measure once it's visible
  if (name === 'home' && constellation) constellation.rebuild();
  // the galaxy attaches its own input only while it's the live view
  if (prev === 'projects' && name !== 'projects' && projects) projects.deactivate();
  if (name === 'projects' && projects) projects.activate();
}

// All navigation — chip clicks, the Alrescha gate, the wordmark, and the
// browser back/forward buttons — funnels through the hash, then through here.
let navBusy = false;
let pendingRoute = null;

function navigate() {
  const to = parseRoute();
  if (to === currentView) return;
  if (navBusy) { pendingRoute = to; return; } // ignore re-triggers mid-flight

  navBusy = true;

  if (env.reducedMotion) {
    quickFade(to);
    return;
  }

  html.classList.add('warping');
  if (cosmos) cosmos.stop(); // the flight masks the sky; save the GPU meanwhile
  warp.play({
    direction: to === 'projects' ? 'in' : 'out',
    onPeak: () => setView(to), // swap the DOM under cover of the bloom
  }).then(finishNav, finishNav);
}

function finishNav() {
  html.classList.remove('warping');
  if (cosmos) cosmos.start(); // start()'s own guards no-op under reduced-motion
  navBusy = false;
  if (pendingRoute && pendingRoute !== currentView) {
    const tgt = pendingRoute;
    pendingRoute = null;
    setView(tgt); // reconcile an interrupted flight, instantly
  } else {
    pendingRoute = null;
  }
}

// reduced-motion path: a short, direct opacity fade (driven here, not via CSS,
// so the global reduced-motion transition override can't flatten it to nothing).
function quickFade(to) {
  const main = document.getElementById('main');
  if (!main) { setView(to); finishNav(); return; }
  const OUT = 150, IN = 200;
  let t0 = 0;
  function fadeOut(now) {
    if (!t0) t0 = now;
    const k = Math.min(1, (now - t0) / OUT);
    main.style.opacity = String(1 - k);
    if (k < 1) { requestAnimationFrame(fadeOut); return; }
    setView(to);
    t0 = 0;
    requestAnimationFrame(fadeIn);
  }
  function fadeIn(now) {
    if (!t0) t0 = now;
    const k = Math.min(1, (now - t0) / IN);
    main.style.opacity = String(k);
    if (k < 1) { requestAnimationFrame(fadeIn); return; }
    main.style.opacity = '';
    finishNav();
  }
  requestAnimationFrame(fadeOut);
}

window.addEventListener('hashchange', navigate);
setView(parseRoute()); // initial view — no flight on first paint

/* -------------------------------------------------------------- debug loop */

if (DEBUG) {
  hud.hidden = false;
  setInterval(() => {
    const s = cosmos ? cosmos.stats() : { fps: '-', tier: 'no-webgl' };
    hud.textContent =
      `fps ${s.fps} | tier ${s.tier} | dpr ${s.dpr ?? '-'}\n` +
      `stars ${s.stars ?? 0} dust ${s.dust ?? 0} | view ${currentView}\n` +
      (hudLog.length ? hudLog.join('\n') : '');
  }, 500);

  // ?debug&scroll=0.6 — jump to a scroll position (for screenshots)
  if (params.has('scroll')) {
    setTimeout(() => {
      const p = parseFloat(params.get('scroll')) || 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * p, behavior: 'instant' });
    }, 600);
  }

  // ?debug&cosmosScroll=0.7 — drive the glow directly, page stays put
  // (headless screenshots of fixed layers break after scripted page scroll)
  if (params.has('cosmosScroll') && cosmos) {
    setTimeout(() => cosmos.setScroll(parseFloat(params.get('cosmosScroll')) || 0), 400);
  }

  // ?debug&warp=0.5[&warpDir=out] — freeze one stargate frame at that progress
  if (params.has('warp')) {
    setTimeout(() => {
      warp.renderAt(parseFloat(params.get('warp')) || 0, params.get('warpDir') || 'in');
    }, 400);
  }

  // ?debug&fly=projects|home — trigger a real flight via the hash (integration)
  if (params.has('fly')) {
    setTimeout(() => {
      location.hash = params.get('fly') === 'projects' ? '#/projects' : '#/';
    }, 500);
  }

  // ?debug&project=N (focus a node) / ?debug&open=N (open its detail) — needs the
  // projects view; pair with #/projects, e.g. ?debug&open=5#/projects
  if (params.has('project') && projects) {
    setTimeout(() => projects._focusTo(parseInt(params.get('project'), 10) || 0), 500);
  }
  if (params.has('open') && projects) {
    setTimeout(() => projects._open(parseInt(params.get('open'), 10) || 0), 700);
  }
}
