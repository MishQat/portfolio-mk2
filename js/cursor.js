// cursor.js — a Minecraft netherite sword for a cursor, trailing magenta pixel
// embers as it moves. Pure pixel-craft: crisp integer squares, no blur. Only
// on fine pointers with motion allowed; touch and reduced-motion keep the
// native cursor and skip the whole thing.

// 16x16 pixel grid. Tip is top-right; that corner is the pointer hotspot.
//   l blade highlight · b blade body · d blade shadow
//   g guard (dark netherite) · G guard mid
//   h handle · H handle highlight
const SWORD = [
  '..............l.',
  '.............lb.',
  '............lbd.',
  '...........lbd..',
  '..........lbd...',
  '.........lbd....',
  '........lbd.....',
  '.......lbd......',
  '......lbd.......',
  '....g.lb........',
  '...gGgbd........',
  '....gGg.........',
  '.....hH.........',
  '....hH..........',
  '...hH...........',
  '..hh............',
];

const PAL = {
  l: '#9b968d', b: '#5d5952', d: '#34302b',
  g: '#241f1b', G: '#46403a',
  h: '#4a3526', H: '#6f4f37',
};

const CELL = 2;            // px per sprite pixel → 32px sword
const TIP = { x: 14, y: 0 }; // hotspot cell (top-right of blade)

// magenta ember palette — brand magenta through hot pink to a pale spark
const EMBER_COLORS = ['#c9356f', '#8e2160', '#e85aa0', '#f4b8d4', '#a8276b'];

function buildSwordSVG() {
  const W = 16 * CELL;
  let rects = '';
  for (let r = 0; r < SWORD.length; r++) {
    for (let c = 0; c < SWORD[r].length; c++) {
      const ch = SWORD[r][c];
      if (ch === '.') continue;
      rects += `<rect x="${c * CELL}" y="${r * CELL}" width="${CELL}" height="${CELL}" fill="${PAL[ch]}"/>`;
    }
  }
  return `<svg width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${rects}</svg>`;
}

export function initCursor({ env }) {
  if (env.coarse || env.reducedMotion) return null;

  const sword = document.getElementById('sword-cursor');
  const canvas = document.getElementById('embers');
  if (!sword || !canvas) return null;

  sword.innerHTML = buildSwordSVG();
  sword.hidden = false;
  document.documentElement.classList.add('sword-cursor-on');

  const ctx = canvas.getContext('2d');
  let dpr = 1, vw = 0, vh = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- pointer → sword position (tip on the hotspot) ----
  let px = vw / 2, py = vh / 2, lastX = px, lastY = py;
  let shown = false;

  function place() {
    sword.style.transform =
      `translate(${px - TIP.x * CELL - CELL / 2}px, ${py - TIP.y * CELL - CELL / 2}px)`;
  }

  // ---- embers ----
  const embers = [];
  const MAX_EMBERS = 90;
  let spawnCarry = 0;
  let trailX = 0, trailY = 0; // last motion direction, for the trail bias

  function spawn(n) {
    for (let i = 0; i < n && embers.length < MAX_EMBERS; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 0.2 + Math.random() * 0.8;
      embers.push({
        // emit from just behind the blade tip
        x: px - 4 + (Math.random() - 0.5) * 6,
        y: py + 2 + (Math.random() - 0.5) * 6,
        // scatter, biased opposite to travel (so embers stream out behind)
        vx: Math.cos(ang) * sp - trailX * 0.35,
        vy: Math.sin(ang) * sp - trailY * 0.35 - 0.25 - Math.random() * 0.35,
        size: (Math.random() < 0.5 ? 2 : 3),
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        color: EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
        drift: (Math.random() - 0.5) * 0.05,
      });
    }
  }

  let running = false;
  function ensureLoop() { if (!running) { running = true; requestAnimationFrame(loop); } }

  function loop() {
    ctx.clearRect(0, 0, vw, vh);
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.life -= e.decay;
      if (e.life <= 0) { embers.splice(i, 1); continue; }
      e.vy += 0.022;          // gentle gravity once the spark loses its rise
      e.vx += e.drift;
      e.vx *= 0.96;
      e.x += e.vx;
      e.y += e.vy;
      // pixel-snap + flicker
      const a = Math.min(1, e.life * 1.4) * (0.75 + Math.random() * 0.25);
      ctx.globalAlpha = a;
      ctx.fillStyle = e.color;
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
    }
    ctx.globalAlpha = 1;
    if (embers.length > 0) requestAnimationFrame(loop);
    else running = false;
  }

  // ---- input ----
  window.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    px = ev.clientX; py = ev.clientY;
    if (!shown) { shown = true; sword.classList.add('live'); }
    place();

    const dx = px - lastX, dy = py - lastY;
    const dist = Math.hypot(dx, dy);
    lastX = px; lastY = py;
    if (dist > 0) { trailX = dx / dist; trailY = dy / dist; }

    // spawn embers proportional to travel, with a carry so slow drags still spark
    spawnCarry += dist * 0.22;
    const n = Math.floor(spawnCarry);
    if (n > 0) {
      spawnCarry -= n;
      spawn(Math.min(n, 4));
      ensureLoop();
    }
  }, { passive: true });

  // a faint resting shimmer of embers when the pointer is still over the page
  window.addEventListener('pointerdown', () => { spawn(10); ensureLoop(); });

  document.addEventListener('mouseleave', () => { sword.classList.remove('live'); });
  document.addEventListener('mouseenter', () => { if (shown) sword.classList.add('live'); });

  place();

  return {
    dispose() {
      document.documentElement.classList.remove('sword-cursor-on');
      sword.hidden = true;
      window.removeEventListener('resize', resize);
    },
  };
}
