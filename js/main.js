// main.js — boot, environment flags, view state machine (home/projects),
// and the wiring between the DOM and the cosmos. The stargate transition
// arrives in stage 3; for now view changes are instant swaps.

import { createCosmos } from './cosmos.js';

window.__BOOT_OK__ = true; // cancels the no-webgl watchdog in index.html

const html = document.documentElement;

const env = {
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  coarse: matchMedia('(pointer: coarse)').matches,
};

/* ------------------------------------------------------------- debug HUD */

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
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

/* ------------------------------------------------------------ scroll/input */

let scrollScheduled = false;
function publishScroll() {
  scrollScheduled = false;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? window.scrollY / max : 0;
  if (cosmos) cosmos.setScroll(p);
}

window.addEventListener('scroll', () => {
  if (!scrollScheduled) {
    scrollScheduled = true;
    requestAnimationFrame(publishScroll);
  }
}, { passive: true });

if (!env.coarse && !env.reducedMotion) {
  window.addEventListener('pointermove', (e) => {
    if (cosmos) {
      cosmos.setPointer(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1)
      );
    }
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
  currentView = name;
  document.body.dataset.view = name;
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
  navProjects.hidden = name === 'projects';
  navHome.hidden = name === 'home';
  window.scrollTo({ top: 0, behavior: 'instant' });
  publishScroll();
}

window.addEventListener('hashchange', () => setView(parseRoute()));
setView(parseRoute());

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
}
