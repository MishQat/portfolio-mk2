// constellation.js — the Pisces nav spine.
// Two cords of stars descend the home page: the Circlet (the western fish)
// rings the portrait, the northern fish hangs above the verse, and both cords
// tie at Alrescha — the knot — which is the gate into the projects.
// Plain SVG in CSS pixels, rebuilt on resize; the cords draw themselves in
// as you scroll. Decorative (aria-hidden) — real navigation lives in the DOM.

const NS = 'http://www.w3.org/2000/svg';

// Free stars: x = % of flow width, y = % of flow height.
// Anchored stars: centre of `anchor` element + dx (% of flow width) + dy (vh).
// `name` is the star's label; `major` flags the brighter/named stars that get
// the larger, more vibrant label tier. Bayer glyphs stay lowercase (α, η, γ…).
const STARS = [
  // — cord A · the northern fish down to the knot —
  { id: 'rho',     x: 81,   y: 9.5,  r: 2.2, name: 'ρ' },
  { id: 'pi',      x: 69,   y: 15.5, r: 2.0, name: 'π' },
  { id: 'alpherg', anchor: '#verse-card', dx: 4, dy: -22, r: 3.6, gold: true,
    name: 'Alpherg · η Piscium', major: true, labelDx: 14, labelDy: -12 },
  { id: 'omicron', x: 61,   y: 47,   r: 2.4, name: 'Torcular · ο Piscium', major: true },
  { id: 'psc27',   x: 55.5, y: 60,   r: 1.8, name: '27 Psc' },

  // — cord B · the Circlet down to the knot —
  { id: 'omega',   x: 42.5, y: 19,   r: 2.4, name: 'ω Psc', major: true },
  { id: 'delta',   x: 35,   y: 26.5, r: 2.2, name: 'δ Psc', major: true },
  { id: 'epsilon', x: 43,   y: 34.5, r: 2.4, name: 'ε Psc', major: true },
  { id: 'zeta',    x: 37,   y: 45,   r: 2.0, name: 'Revati · ζ Piscium', major: true },
  { id: 'mu',      x: 45.5, y: 53.5, r: 2.2, name: 'μ' },
  { id: 'nu',      x: 44.5, y: 61.5, r: 2.0, name: 'ν' },
  { id: 'xi',      x: 47.5, y: 71,   r: 2.2, name: 'ξ' },

  // — the knot — both cords terminate here. Anchored to the visible knot star
  // (`.alrescha-star`), NOT the tall gate block, so the V meets cleanly at it.
  // Labelled in the DOM gate as "Alrescha · α Piscium".
  { id: 'alrescha', anchor: '.alrescha-star', dx: 0, dy: 0, r: 0 },
];

// the Circlet — seven stars ringing the portrait mirror (the western fish)
const CIRCLET = [
  { id: 'gamma', a: -95,  k: 1.00, r: 2.6, name: 'γ Psc', major: true },
  { id: 'kappa', a: -40,  k: 0.94, r: 2.2, name: 'κ' },
  { id: 'lambda', a: 8,   k: 1.06, r: 2.4, name: 'λ' },
  { id: 'iota',  a: 55,   k: 0.97, r: 2.2, name: 'ι' },
  { id: 'theta', a: 110,  k: 1.05, r: 2.6, name: 'θ' },
  { id: 'psc7',  a: 160,  k: 0.95, r: 1.9, name: '7 Psc' },
  { id: 'tx',    a: 215,  k: 1.02, r: 2.0, name: 'TX Psc' },
];

// the northern fish — six stars in a loose ring, top right of the flow
const NORTH_FISH = [
  { id: 'tau',  a: -80, k: 1.00, r: 2.5, name: 'τ' },
  { id: 'ups',  a: -20, k: 0.92, r: 2.2, name: 'υ' },
  { id: 'phi',  a: 35,  k: 1.08, r: 2.4, name: 'φ' },
  { id: 'chi',  a: 95,  k: 0.96, r: 2.3, name: 'χ' },
  { id: 'psi1', a: 150, k: 1.04, r: 2.1, name: 'ψ¹' },
  { id: 'psi2', a: 205, k: 0.95, r: 1.9, name: 'ψ²' },
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
    const labelSpecs = [];
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

      // every star gets a label; this is its preferred ("primary") placement,
      // reading outward from the star — the placement pass below keeps it here
      // unless it would collide with a neighbour, then nudges it clear.
      if (p.def.name) {
        let lx, ly, mode;
        if (p.def.labelDx != null || p.def.labelDy != null) {
          const left = p.x < W * 0.5;
          lx = p.x + (p.def.labelDx ?? (left ? 9 : -9));
          ly = p.y + (p.def.labelDy ?? 4);
          mode = p.def.labelAnchor || (left ? 'start' : 'end');
        } else if (p.def.a != null) {
          // ring star — push the label radially outward from the ring centre
          const rad = (p.def.a * Math.PI) / 180;
          const cx = Math.cos(rad), sy = Math.sin(rad);
          lx = p.x + cx * 15;
          ly = p.y + sy * 15 + 4;
          mode = cx < -0.25 ? 'end' : cx > 0.25 ? 'start' : 'middle';
        } else {
          const left = p.x < W * 0.5;
          lx = p.x + (left ? 9 : -9);
          ly = p.y - 7;
          mode = left ? 'start' : 'end';
        }
        labelSpecs.push({
          sx: p.x, sy: p.y, text: p.def.name, major: !!p.def.major,
          target: p.def.id === 'alpherg' ? '#verse' : null,
          cls: 'spine-label--star ' + (p.def.major ? 'spine-label--major' : 'spine-label--minor'),
          primary: { x: lx, y: ly, mode },
        });
      }
    }
    placeLabels(labelSpecs);

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

    // Place every star label, avoiding overlap with already-placed labels (and
    // the asterism labels, which stay put). Each label keeps its primary spot
    // if it's clear; otherwise it tries alternates around its star and takes
    // the first free one (or the least-overlapping fallback). Major/named
    // labels are placed first so they claim the best spots.
    function placeLabels(specs) {
      const placed = [];
      for (const t of svg.querySelectorAll('.spine-label')) {
        try { placed.push(t.getBBox()); } catch (e) { /* not yet laid out */ }
      }
      specs.sort((a, b) => (b.major - a.major) || (a.sy - b.sy));

      for (const s of specs) {
        const t = addLabel(s.primary.x, s.primary.y, s.text, s.target, s.primary.mode, s.cls);
        const cands = [s.primary, ...altCandidates(s.sx, s.sy)];
        let chosen = null, fallback = null, fallbackArea = Infinity;
        for (const c of cands) {
          t.setAttribute('x', c.x); t.setAttribute('y', c.y);
          t.setAttribute('text-anchor', c.mode);
          let box;
          try { box = t.getBBox(); } catch (e) { box = { x: c.x, y: c.y, width: 0, height: 0 }; }
          if (!placed.some((q) => rectsOverlap(box, q, 2))) { chosen = { c, box }; break; }
          const area = placed.reduce((sum, q) => sum + overlapArea(box, q), 0);
          if (area < fallbackArea) { fallbackArea = area; fallback = { c, box }; }
        }
        const pick = chosen || fallback;
        t.setAttribute('x', pick.c.x);
        t.setAttribute('y', pick.c.y);
        t.setAttribute('text-anchor', pick.c.mode);
        placed.push(pick.box);
        // keep this label's scroll-lit threshold in sync with its final y
        const last = dots[dots.length - 1];
        if (last && last.el === t) last.y = pick.c.y;
      }
    }

    // candidate offsets around a star, tried in order after its primary spot
    function altCandidates(sx, sy) {
      return [
        { x: sx + 10, y: sy - 9,  mode: 'start' },  // up-right
        { x: sx - 10, y: sy - 9,  mode: 'end' },    // up-left
        { x: sx + 10, y: sy + 15, mode: 'start' },  // down-right
        { x: sx - 10, y: sy + 15, mode: 'end' },    // down-left
        { x: sx + 15, y: sy + 3,  mode: 'start' },  // right
        { x: sx - 15, y: sy + 3,  mode: 'end' },    // left
        { x: sx + 17, y: sy - 18, mode: 'start' },  // far up-right
        { x: sx - 17, y: sy + 23, mode: 'end' },    // far down-left
        { x: sx,      y: sy - 16, mode: 'middle' }, // above
        { x: sx,      y: sy + 23, mode: 'middle' }, // below
      ];
    }

    function rectsOverlap(a, b, pad) {
      return a.x - pad < b.x + b.width && a.x + a.width + pad > b.x &&
             a.y - pad < b.y + b.height && a.y + a.height + pad > b.y;
    }
    function overlapArea(a, b) {
      const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      return ix * iy;
    }

    function addLabel(x, y, text, target, anchorMode, extraCls) {
      const t = el('text', {
        x, y, class: 'spine-label' + (extraCls ? ' ' + extraCls : ''),
        'text-anchor': anchorMode || 'middle',
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
      return t;
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
