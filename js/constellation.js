// constellation.js — the Pisces nav spine.
// Two cords of stars descend the home page: the Circlet (the western fish)
// rings the portrait, the northern fish hangs above the verse, and both cords
// tie at Alrescha — the knot — which is the gate into the projects.
// Plain SVG in CSS pixels, rebuilt on resize; the cords draw themselves in
// as you scroll. Decorative (aria-hidden) — real navigation lives in the DOM.

const NS = 'http://www.w3.org/2000/svg';

// Free stars: x = % of flow width, y = % of flow height.
// Anchored stars: centre of `anchor` element + dx (% of flow width) + dy (vh).
const STARS = [
  // — cord A · the northern fish down to the knot —
  { id: 'rho',     x: 81,   y: 9.5,  r: 2.2 },
  { id: 'pi',      x: 69,   y: 15.5, r: 2.0 },
  { id: 'alpherg', anchor: '#verse-card', dx: 4, dy: -22, r: 3.6, gold: true,
    label: 'Alpherg · η Piscium', labelDx: 14, labelDy: -12 },
  { id: 'omicron', x: 61,   y: 47,   r: 2.4 },
  { id: 'psc27',   x: 55.5, y: 60,   r: 1.8 },

  // — cord B · the Circlet down to the knot —
  { id: 'omega',   x: 42.5, y: 19,   r: 2.4 },
  { id: 'delta',   x: 35,   y: 26.5, r: 2.2 },
  { id: 'epsilon', x: 43,   y: 34.5, r: 2.4 },
  { id: 'zeta',    x: 37,   y: 45,   r: 2.0 },
  { id: 'mu',      x: 45.5, y: 53.5, r: 2.2 },
  { id: 'nu',      x: 44.5, y: 61.5, r: 2.0 },
  { id: 'xi',      x: 47.5, y: 71,   r: 2.2 },

  // — the knot —
  { id: 'alrescha', anchor: '#alrescha', dx: 0, dy: 0, r: 0 }, // drawn in DOM
];

// the Circlet — seven stars ringing the portrait mirror
const CIRCLET = [
  { id: 'gamma', a: -95,  k: 1.00, r: 2.6 },
  { id: 'kappa', a: -40,  k: 0.94, r: 2.2 },
  { id: 'lambda', a: 8,   k: 1.06, r: 2.4 },
  { id: 'iota',  a: 55,   k: 0.97, r: 2.2 },
  { id: 'theta', a: 110,  k: 1.05, r: 2.6 },
  { id: 'psc7',  a: 160,  k: 0.95, r: 1.9 },
  { id: 'tx',    a: 215,  k: 1.02, r: 2.0 },
];

// the northern fish — six stars in a loose ring, top right of the flow
const NORTH_FISH = [
  { id: 'tau',  a: -80, k: 1.00, r: 2.5 },
  { id: 'ups',  a: -20, k: 0.92, r: 2.2 },
  { id: 'phi',  a: 35,  k: 1.08, r: 2.4 },
  { id: 'chi',  a: 95,  k: 0.96, r: 2.3 },
  { id: 'psi1', a: 150, k: 1.04, r: 2.1 },
  { id: 'psi2', a: 205, k: 0.95, r: 1.9 },
];

// cords by star id; ring exit stars join the chains
const CORD_A = ['nf:chi', 'rho', 'pi', 'alpherg', 'omicron', 'psc27', 'alrescha'];
const CORD_B = ['cl:lambda', 'omega', 'delta', 'epsilon', 'zeta', 'mu', 'nu', 'xi', 'alrescha'];

function el(name, attrs) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function initConstellation({ env }) {
  const flow = document.getElementById('home-flow');
  const svg = document.getElementById('spine');
  if (!flow || !svg) return null;

  let flowTop = 0;
  let paths = [];   // { el, len, y0, y1 }
  let dots = [];    // { el, y }
  let built = false;

  function anchorPoint(sel, dx, dy, flowRect, W) {
    const a = document.querySelector(sel);
    if (!a) return null;
    const r = a.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - flowRect.left + (dx / 100) * W,
      y: r.top + r.height / 2 - flowRect.top + (dy / 100) * window.innerHeight,
    };
  }

  function ringPoints(defs, cx, cy, rx, ry) {
    return defs.map((s) => ({
      ...s,
      px: cx + Math.cos((s.a * Math.PI) / 180) * rx * s.k,
      py: cy + Math.sin((s.a * Math.PI) / 180) * ry * s.k,
    }));
  }

  function build() {
    const flowRect = flow.getBoundingClientRect();
    const W = flowRect.width;
    const H = flow.scrollHeight;
    if (!W || !H) return; // hidden (projects view) — rebuild when shown
    flowTop = flowRect.top + window.scrollY;

    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.textContent = '';
    paths = [];
    dots = [];

    const pos = new Map(); // id -> {x, y}

    for (const s of STARS) {
      const p = s.anchor
        ? anchorPoint(s.anchor, s.dx, s.dy, flowRect, W)
        : { x: (s.x / 100) * W, y: (s.y / 100) * H };
      if (p) pos.set(s.id, { ...p, def: s });
    }

    // the Circlet rings the portrait mirror
    const mirror = document.getElementById('portrait-mirror');
    let circlet = [];
    if (mirror) {
      const m = mirror.getBoundingClientRect();
      const cx = m.left + m.width / 2 - flowRect.left;
      const cy = m.top + m.height / 2 - flowRect.top;
      circlet = ringPoints(CIRCLET, cx, cy, m.width * 0.68, m.height * 0.60);
      circlet.forEach((s) => pos.set('cl:' + s.id, { x: s.px, y: s.py, def: s }));
      addLabel(cx, cy + m.height * 0.60 + 26, 'the circlet · the western fish', '#likeness');
    }

    // the northern fish, top right
    const nfCx = W * 0.74;
    const nfCy = Math.min(H * 0.02, 60) + window.innerHeight * 0.06;
    const nfRx = Math.min(Math.max(W * 0.06, 40), 96);
    const nfRy = Math.min(Math.max(window.innerHeight * 0.085, 44), 88);
    const fish = ringPoints(NORTH_FISH, nfCx, nfCy, nfRx, nfRy);
    fish.forEach((s) => pos.set('nf:' + s.id, { x: s.px, y: s.py, def: s }));
    addLabel(nfCx, nfCy - nfRy - 16, 'the northern fish', null);

    // — defs: soft halo for the bright stars —
    const defs = el('defs', {});
    const grad = el('radialGradient', { id: 'spine-halo' });
    grad.appendChild(el('stop', { offset: '0%', 'stop-color': 'rgba(232,194,138,0.5)' }));
    grad.appendChild(el('stop', { offset: '100%', 'stop-color': 'rgba(232,194,138,0)' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    // — rings + cords —
    addPath(closedPath(circlet.map((s) => pos.get('cl:' + s.id))), 'spine-ring');
    addPath(closedPath(fish.map((s) => pos.get('nf:' + s.id))), 'spine-ring');
    addPath(openPath(CORD_A.map((id) => pos.get(id))), 'spine-cord');
    addPath(openPath(CORD_B.map((id) => pos.get(id))), 'spine-cord');

    // — stars —
    for (const [, p] of pos) {
      if (!p || !p.def.r) continue;
      if (p.def.gold) {
        const halo = el('circle', { cx: p.x, cy: p.y, r: p.def.r * 4.5, fill: 'url(#spine-halo)', class: 'spine-star spine-halo' });
        svg.appendChild(halo);
        dots.push({ el: halo, y: p.y });
      }
      const c = el('circle', {
        cx: p.x, cy: p.y, r: p.def.r,
        class: 'spine-star' + (p.def.gold ? ' spine-star-gold' : ''),
      });
      svg.appendChild(c);
      dots.push({ el: c, y: p.y });
      if (p.def.label) {
        addLabel(p.x + (p.def.labelDx || 0), p.y + (p.def.labelDy || 0), p.def.label, '#verse', 'start');
      }
    }

    built = true;
    if (env.reducedMotion) {
      for (const p of paths) p.el.style.strokeDashoffset = 0;
      for (const d of dots) d.el.classList.add('lit');
      for (const t of svg.querySelectorAll('.spine-label')) t.classList.add('lit');
    } else {
      update();
    }

    function addPath(d, cls) {
      if (!d) return;
      const p = el('path', { d, class: cls });
      svg.appendChild(p);
      const len = p.getTotalLength();
      const box = p.getBBox();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      paths.push({ el: p, len, y0: box.y, y1: box.y + box.height });
    }

    function addLabel(x, y, text, target, anchorMode) {
      const t = el('text', {
        x, y, class: 'spine-label', 'text-anchor': anchorMode || 'middle',
      });
      t.textContent = text;
      if (target) {
        t.style.cursor = 'pointer';
        t.addEventListener('click', () => {
          const dest = document.querySelector(target);
          if (dest) dest.scrollIntoView({ behavior: env.reducedMotion ? 'instant' : 'smooth' });
        });
      }
      svg.appendChild(t);
      dots.push({ el: t, y });
    }
  }

  function closedPath(pts) {
    const valid = pts.filter(Boolean);
    if (valid.length < 3) return '';
    return 'M' + valid.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L') + 'Z';
  }

  function openPath(pts) {
    const valid = pts.filter(Boolean);
    if (valid.length < 2) return '';
    return 'M' + valid.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L');
  }

  // reveal point sweeps down the flow ~72% ahead of the scroll position
  function update() {
    if (!built || env.reducedMotion) return;
    const R = window.scrollY + window.innerHeight * 0.72 - flowTop;
    for (const p of paths) {
      const prog = Math.min(Math.max((R - p.y0) / (p.y1 - p.y0 + 1), 0), 1);
      p.el.style.strokeDashoffset = p.len * (1 - prog);
    }
    for (const d of dots) {
      if (R >= d.y - 40) d.el.classList.add('lit');
    }
  }

  let rebuildTimer = 0;
  function rebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(build, 120);
  }

  window.addEventListener('resize', rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  // build after first layout settles (portrait sets its own height via JS)
  requestAnimationFrame(() => requestAnimationFrame(build));

  return { update, rebuild };
}
