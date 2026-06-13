// warp.js — the stargate transition between home and projects.
// A 2001 "Beyond the Infinite" flight: the star field stretches into streaks,
// accelerates through a corridor toward a bloom of light, then decelerates into
// the destination. Self-contained 2D-canvas overlay — GPU-light, no second
// WebGL context. The DOM view swaps at the bright peak, hidden by the flash.
// prefers-reduced-motion never reaches here; main.js does a clean fade instead.

const DURATION = 2400; // ms — within the 2–3s brief
const PEAK = 0.52;     // progress at which the destination swaps in (the bloom)

// weighted toward white/blue, with purple, pink, and rare red / dark magenta —
// the brief palette: purple, blue, white, pink, red, hits of dark magenta.
const PALETTE = [
  { c: [244, 240, 255], w: 0.28 }, // starlight white
  { c: [188, 202, 255], w: 0.20 }, // blue
  { c: [150, 130, 246], w: 0.17 }, // purple
  { c: [231, 122, 190], w: 0.14 }, // pink
  { c: [120, 150, 255], w: 0.09 }, // cool blue
  { c: [221, 64, 92],   w: 0.07 }, // red
  { c: [142, 33, 96],   w: 0.05 }, // dark magenta
];

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function initWarp({ env }) {
  const canvas = document.getElementById('warp');
  if (!canvas) return { play: instant, renderAt() {}, active: () => false };
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, CX = 0, CY = 0, dpr = 1, far = 1, focal = 1;
  let stars = [];
  let active = false;

  // a brief, transient effect — afford a fuller field on desktop
  const N = env.coarse ? 260 : 560;

  // stable per-flight PRNG (keeps the streak colours from reshuffling mid-build)
  let seed = 1337;
  function rng() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pick() {
    let r = rng(), acc = 0;
    for (const p of PALETTE) { acc += p.w; if (r <= acc) return p.c; }
    return PALETTE[0].c;
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    CX = W / 2; CY = H / 2;
    far = Math.max(W, H);
    focal = far * 0.35; // far-plane stars cluster near centre, then streak out
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resetStar(s, anyDepth) {
    s.x = (rng() * 2 - 1) * W * 0.62;
    s.y = (rng() * 2 - 1) * H * 0.62;
    s.z = anyDepth ? 1 + rng() * (far - 1) : far;
    const c = pick();
    s.r = c[0]; s.g = c[1]; s.b = c[2];
    return s;
  }

  function build() {
    seed = 1337;
    stars = [];
    for (let i = 0; i < N; i++) stars.push(resetStar({}, true));
  }

  // one painted frame. `mutate` advances the corridor (animation); false gives a
  // static representative frame for the ?warp= debug hook.
  function drawScene(p, speed, warm, mutate) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    const up = smoothstep(0.05, 0.34, p);
    const down = smoothstep(0.64, 0.99, p);
    const bgAlpha = Math.max(0, Math.min(0.97, up - down));
    if (bgAlpha > 0.001) {
      ctx.fillStyle = `rgba(6,3,16,${bgAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of stars) {
      const pz = s.z + speed;       // where the streak trails from (further back)
      const k1 = focal / s.z;
      const k0 = focal / pz;
      const sx = CX + s.x * k1, sy = CY + s.y * k1;
      const px = CX + s.x * k0, py = CY + s.y * k0;
      const prox = Math.min(1, (far - s.z) / far);
      const a = Math.min(1, 0.16 + prox * 0.92);
      ctx.strokeStyle = `rgba(${s.r},${s.g},${s.b},${a})`;
      ctx.lineWidth = Math.max(0.6, prox * 2.6);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      if (mutate) {
        s.z -= speed;
        if (s.z < 1) resetStar(s, false);
      }
    }

    // the bloom — "beyond the infinite". Bright but not a white-out assault.
    const bloom = smoothstep(0.30, PEAK, p) * (1 - smoothstep(0.56, 0.86, p));
    if (bloom > 0.001) {
      const rad = far * (0.12 + bloom * 0.52);
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, rad);
      const core = warm ? '255,236,246' : '236,244,255';
      const mid = warm ? '201,53,111' : '96,124,255';
      g.addColorStop(0, `rgba(${core},${0.88 * bloom})`);
      g.addColorStop(0.35, `rgba(${core},${0.48 * bloom})`);
      g.addColorStop(0.70, `rgba(${mid},${0.22 * bloom})`);
      g.addColorStop(1, `rgba(${mid},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(CX, CY, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  function speedAt(p, dt) {
    const bell = smoothstep(0, 0.5, p) * (1 - smoothstep(0.5, 1, p)); // 0→1→0
    const s = far * 0.006 + far * 0.32 * Math.pow(bell, 0.8);
    return s * dt * 60; // normalise to 60fps so the flight feels equal everywhere
  }

  function play({ direction = 'in', onPeak } = {}) {
    return new Promise((resolve) => {
      if (env.reducedMotion) { if (onPeak) onPeak(); resolve(); return; }
      size();
      build();
      active = true;
      canvas.classList.add('on');
      const warm = direction === 'in';
      const t0 = performance.now();
      let last = t0;
      let peaked = false;

      function frame(now) {
        const p = Math.min(1, (now - t0) / DURATION);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;

        if (!peaked && p >= PEAK) { peaked = true; if (onPeak) onPeak(); }

        drawScene(p, speedAt(p, dt), warm, true);

        if (p < 1) {
          requestAnimationFrame(frame);
        } else {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, W, H);
          canvas.classList.remove('on');
          active = false;
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // ?warp=0.5[&warpDir=out] — paint a single static frame for tuning/screenshots
  function renderAt(p, direction = 'in') {
    size();
    build();
    canvas.classList.add('on');
    drawScene(p, speedAt(p, 1 / 60), direction === 'in', false);
  }

  function instant({ onPeak } = {}) { if (onPeak) onPeak(); return Promise.resolve(); }

  window.addEventListener('resize', () => { if (active) size(); });

  return { play, renderAt, active: () => active };
}
