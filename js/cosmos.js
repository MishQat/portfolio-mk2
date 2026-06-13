// cosmos.js — the living sky behind everything.
// One Three.js scene shared by the whole site: starfield, JWST-style hero stars
// with diffraction spikes, drifting nebula dust, and a huge soft glow whose
// colour follows scroll. Designed to be GPU-light: additive sprites, no
// post-processing, adaptive quality tiers, static single-frame mode for
// prefers-reduced-motion.

import * as THREE from 'three';

// Deterministic sky — the same stars every visit.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIERS = [
  // `hero` = the only stars that carry diffraction spikes — kept to a small
  // fraction of the field so spikes read as rare bright point sources (JWST),
  // not as a decorative sparkle on every star.
  { name: 'low',  dpr: 1.0,  stars: 700,  hero: 4,  dust: 5 },
  { name: 'med',  dpr: 1.35, stars: 1400, hero: 7,  dust: 9 },
  { name: 'high', dpr: 2.0,  stars: 2400, hero: 11, dust: 14 },
];

const STAR_COLORS = [
  { c: [0.87, 0.89, 1.00], w: 0.40 }, // cool white
  { c: [0.96, 0.93, 1.00], w: 0.22 }, // starlight
  { c: [1.00, 0.85, 0.64], w: 0.18 }, // gold
  { c: [0.67, 0.72, 1.00], w: 0.12 }, // blue
  { c: [0.75, 0.92, 0.89], w: 0.05 }, // teal
  { c: [0.94, 0.71, 0.83], w: 0.03 }, // pale magenta
];

function pickStarColor(rng) {
  let r = rng(), acc = 0;
  for (const s of STAR_COLORS) {
    acc += s.w;
    if (r <= acc) return s.c;
  }
  return STAR_COLORS[0].c;
}

/* ---------------------------------------------------------------- textures */
/* exported for the .claude-screens/textest.html harness */

export function makeSoftCircleTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// JWST signature: the real geometry is SIX primary diffraction spikes from the
// hexagonal mirror (a vertical pair + four diagonals, 60° apart) plus TWO
// fainter, shorter horizontal spikes from the secondary-mirror struts. Kept
// deliberately modest in length + brightness so a spiked star reads as a rare
// bright point source, never as decoration competing with the nebulae.
function makeDiffractionTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;

  function spike(angle, length, width, alpha) {
    g.save();
    g.translate(mid, mid);
    g.rotate(angle);
    const grad = g.createLinearGradient(-length / 2, 0, length / 2, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(-length / 2, -width / 2, length, width);
    g.restore();
  }

  // six primary spikes (hexagonal mirror): vertical pair + four diagonals.
  // a crisp thin line with a fainter soft halo around it.
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + i * (Math.PI / 3);
    spike(a, size * 0.80, size * 0.010, 0.60);
    spike(a, size * 0.80, size * 0.042, 0.09);
  }
  // two fainter, shorter horizontal strut spikes
  spike(0, size * 0.38, size * 0.008, 0.30);
  spike(0, size * 0.38, size * 0.030, 0.07);

  // core
  let grad = g.createRadialGradient(mid, mid, 0, mid, mid, size * 0.15);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(mid, mid, size * 0.15, 0, Math.PI * 2); g.fill();

  grad = g.createRadialGradient(mid, mid, 0, mid, mid, size * 0.045);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(mid, mid, size * 0.045, 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cloudy luminance blob — tinted per-mesh. A pile of soft circles inside a
// radial falloff mask reads as nebula wisps once additive-blended and scaled.
export function makeDustTexture(size, rng, blobs) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;

  for (let i = 0; i < blobs; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = Math.pow(rng(), 0.6) * size * 0.34;
    const x = mid + Math.cos(ang) * dist * (0.6 + rng() * 0.7);
    const y = mid + Math.sin(ang) * dist * (0.5 + rng() * 0.6);
    const r = size * (0.05 + rng() * 0.16);
    const a = 0.03 + rng() * 0.055;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(mid, mid, size * 0.1, mid, mid, mid);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Denser cousin of the dust texture — for emission nebulae that need to read
// as actual structures rather than ambient haze.
export function makeNebulaTexture(size, rng, blobs) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;

  for (let i = 0; i < blobs; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = Math.pow(rng(), 0.7) * size * 0.32;
    const x = mid + Math.cos(ang) * dist * (0.7 + rng() * 0.6);
    const y = mid + Math.sin(ang) * dist * (0.55 + rng() * 0.55);
    const r = size * (0.04 + rng() * 0.13);
    const a = 0.06 + rng() * 0.09;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.6, `rgba(255,255,255,${a * 0.5})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(mid, mid, size * 0.08, mid, mid, mid * 0.98);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.65, 'rgba(255,255,255,0.7)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural spiral galaxy: log-spiral arms of soft dots, warm bulge, faint
// halo. Squash + tilt give inclination. Drawn once, lives as a far sprite.
export function makeGalaxyTexture(size, rng, { arms = 2, squash = 0.55, tilt = 0.6 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;
  g.translate(mid, mid);
  g.rotate(tilt);
  g.scale(1, squash);

  // halo
  let grad = g.createRadialGradient(0, 0, 0, 0, 0, size * 0.48);
  grad.addColorStop(0, 'rgba(255,244,228,0.10)');
  grad.addColorStop(0.5, 'rgba(216,205,255,0.05)');
  grad.addColorStop(1, 'rgba(216,205,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, size * 0.48, 0, Math.PI * 2); g.fill();

  // arms — warm core dots cooling to blue-white at the rim
  const a0 = size * 0.02, b = 0.265;
  for (let arm = 0; arm < arms; arm++) {
    const off = (Math.PI * 2 / arms) * arm;
    for (let i = 0; i < 950; i++) {
      const t = i / 950;
      const th = t * 3.4 * Math.PI;
      const r = a0 * Math.exp(b * th);
      if (r > size * 0.46) break;
      const jr = (rng() + rng() - 1) * (size * 0.016 + t * size * 0.045);
      const ja = (rng() + rng() - 1) * 0.2 / (0.4 + t);
      const x = Math.cos(th + off + ja) * (r + jr);
      const y = Math.sin(th + off + ja) * (r + jr);
      const dotR = (1 - t) * size * 0.005 + size * 0.0015 + rng() * size * 0.003;
      const al = (1 - t) * 0.32 + 0.08;
      const col = t < 0.3 ? '255,238,214' : t < 0.65 ? '232,228,255' : '186,200,255';
      g.fillStyle = `rgba(${col},${al})`;
      g.beginPath(); g.arc(x, y, dotR, 0, Math.PI * 2); g.fill();
    }
  }

  // bulge
  grad = g.createRadialGradient(0, 0, 0, 0, 0, size * 0.13);
  grad.addColorStop(0, 'rgba(255,250,240,0.9)');
  grad.addColorStop(0.3, 'rgba(255,233,200,0.5)');
  grad.addColorStop(1, 'rgba(255,224,180,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, size * 0.13, 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Elliptical / lenticular galaxy: a smooth squashed glow, bright old-star core
// fading to a faint halo — no arms. Cheap (one gradient) and reads as a distant
// galaxy when shrunk far back. `warm` cores are old/red ellipticals.
export function makeEllipticalGalaxyTexture(size, { squash = 0.7, tilt = 0.3, warm = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const mid = size / 2;
  g.translate(mid, mid);
  g.rotate(tilt);
  g.scale(1, squash);
  const core = warm ? '255,238,210' : '224,228,255';
  const halo = warm ? '255,226,196' : '210,214,255';
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, size * 0.46);
  grad.addColorStop(0, `rgba(${core},0.95)`);
  grad.addColorStop(0.16, `rgba(${core},0.5)`);
  grad.addColorStop(0.45, `rgba(${halo},0.12)`);
  grad.addColorStop(1, `rgba(${halo},0)`);
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, size * 0.46, 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ----------------------------------------------------------------- shaders */

const starVertex = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeCap;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = aSize * uPixelRatio * (300.0 / -mv.z);
    gl_PointSize = max(min(size, uSizeCap * uPixelRatio), 1.3);
    vColor = aColor;
    vTwinkle = 0.78 + 0.22 * sin(uTime * aSpeed + aPhase);
    gl_Position = projectionMatrix * mv;
  }
`;

const starFragment = /* glsl */`
  uniform float uFade;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.1, d);
    a = a * a * 1.45;
    gl_FragColor = vec4(vColor, min(a, 1.0) * vTwinkle * uFade);
  }
`;

const heroVertex = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = aSize * uPixelRatio * (300.0 / -mv.z);
    gl_PointSize = min(size, 130.0 * uPixelRatio);
    vColor = aColor;
    vTwinkle = 0.82 + 0.18 * sin(uTime * aSpeed + aPhase);
    gl_Position = projectionMatrix * mv;
  }
`;

const heroFragment = /* glsl */`
  uniform sampler2D uMap;
  uniform float uFade;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor, t.a * vTwinkle * uFade);
  }
`;

/* ------------------------------------------------------------------ cosmos */

export function createCosmos({ canvas, env }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'default',
    });
  } catch (err) {
    return null;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  camera.position.set(0, 0, 60);

  const rng = mulberry32(612);
  const maxTier = TIERS[TIERS.length - 1];

  let tierIndex = env.coarse ? 1 : 2;
  const startTierIndex = tierIndex;
  let fade = env.reducedMotion ? 1 : 0;
  let elapsed = env.reducedMotion ? 3.2 : 0;

  /* ----- starfield ----- */
  const starGeo = new THREE.BufferGeometry();
  {
    const n = maxTier.stars;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 0] = (rng() * 2 - 1) * 240;
      pos[i * 3 + 1] = (rng() * 2 - 1) * 140;
      pos[i * 3 + 2] = 30 - rng() * 450;
      const c = pickStarColor(rng);
      const lum = 0.7 + rng() * 0.3;
      col[i * 3 + 0] = c[0] * lum;
      col[i * 3 + 1] = c[1] * lum;
      col[i * 3 + 2] = c[2] * lum;
      // many faint, few bright
      size[i] = 0.65 + Math.pow(rng(), 2.4) * 2.3;
      phase[i] = rng() * Math.PI * 2;
      speed[i] = 0.3 + rng() * 1.3;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    starGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  }
  const starUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uSizeCap: { value: 6.5 },
    uFade: { value: fade },
  };
  const starMat = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = 1;
  stars.frustumCulled = false;
  scene.add(stars);

  /* ----- hero stars (diffraction spikes) ----- */
  const heroTexture = makeDiffractionTexture(256);
  const heroGeo = new THREE.BufferGeometry();
  {
    const n = maxTier.hero;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 0] = (rng() * 2 - 1) * 220;
      pos[i * 3 + 1] = (rng() * 2 - 1) * 130;
      pos[i * 3 + 2] = -70 - rng() * 280;
      const warm = rng();
      const c = warm < 0.45 ? [1.0, 0.87, 0.66] : warm < 0.8 ? [0.93, 0.93, 1.0] : [0.92, 0.7, 0.84];
      const lum = 0.86; // slightly dimmer so spikes don't dominate the nebulae
      col[i * 3 + 0] = c[0] * lum;
      col[i * 3 + 1] = c[1] * lum;
      col[i * 3 + 2] = c[2] * lum;
      size[i] = 22 + rng() * 40;
      phase[i] = rng() * Math.PI * 2;
      speed[i] = 0.2 + rng() * 0.5;
    }
    heroGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    heroGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    heroGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    heroGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    heroGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  }
  const heroUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uMap: { value: heroTexture },
    uFade: { value: fade },
  };
  const heroMat = new THREE.ShaderMaterial({
    uniforms: heroUniforms,
    vertexShader: heroVertex,
    fragmentShader: heroFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const heroStars = new THREE.Points(heroGeo, heroMat);
  heroStars.renderOrder = 2;
  heroStars.frustumCulled = false;
  scene.add(heroStars);

  /* ----- nebula dust ----- */
  const dustTextures = [
    makeDustTexture(256, rng, 42),
    makeDustTexture(256, rng, 30),
    makeDustTexture(256, rng, 52),
  ];
  const DUST_TINTS = [
    { color: 0x3a2c8a, w: 0.22 }, // indigo
    { color: 0x274d9a, w: 0.16 }, // deep blue
    { color: 0x1f8a7e, w: 0.16 }, // teal
    { color: 0x9c2f6e, w: 0.18 }, // brand magenta
    { color: 0x7d5fc6, w: 0.12 }, // violet
    { color: 0xb0823f, w: 0.10 }, // JWST amber/gold
    { color: 0x2f9fb0, w: 0.06 }, // cyan
  ];
  function pickTint() {
    let r = rng(), acc = 0;
    for (const t of DUST_TINTS) { acc += t.w; if (r <= acc) return t.color; }
    return DUST_TINTS[0].color;
  }

  const dustGeo = new THREE.PlaneGeometry(1, 1);
  const dustMeshes = [];
  {
    const n = maxTier.dust;
    for (let i = 0; i < n; i++) {
      const dark = i % 5 === 4; // every fifth cloud is a dark silhouette lane
      const mat = new THREE.MeshBasicMaterial({
        map: dustTextures[i % dustTextures.length],
        color: dark ? 0x0a0618 : pickTint(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(dustGeo, mat);

      // loose diagonal band, lower-left to upper-right, with scatter
      const t = rng();
      const bx = -180 + t * 360;
      const by = -80 + t * 150;
      mesh.position.set(
        bx + (rng() * 2 - 1) * 90,
        by + (rng() * 2 - 1) * 65,
        -60 - rng() * 180
      );
      const s = 90 + rng() * 190;
      mesh.scale.set(s, s * (0.5 + rng() * 0.5), 1);
      mesh.rotation.z = rng() * Math.PI * 2;
      mesh.renderOrder = dark ? 4 : 3;
      mesh.frustumCulled = false;

      mesh.userData.baseOpacity = dark ? 0.26 + rng() * 0.14 : 0.10 + rng() * 0.10;
      mesh.userData.vx = (rng() * 2 - 1) * 0.9;
      mesh.userData.vy = (rng() * 2 - 1) * 0.5;
      mesh.userData.vr = (rng() * 2 - 1) * 0.0045;
      dustMeshes.push(mesh);
      scene.add(mesh);
    }
  }

  /* ----- scroll glow ----- */
  const glowTexture = makeSoftCircleTexture(256);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x3b2a86,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(760, 540, 1);
  glow.position.set(40, -10, -340);
  glow.renderOrder = 0;
  scene.add(glow);

  const GLOW_STOPS = [
    new THREE.Color(0x3b2a86), // indigo — arrival
    new THREE.Color(0x8e2160), // brand magenta — the descent
    new THREE.Color(0x1f6a63), // teal — the deep
  ];
  const glowColor = new THREE.Color(0x3b2a86);

  /* ----- deep sky features: galaxies, pillars, emission nebula ----- */
  // features: sprites with baseOpacity (fade-managed), optional slow spin,
  // and a minimum quality tier below which they hide.
  const features = [];
  const featureTextures = [];

  function addFeature(tex, { pos, scale, opacity, color = 0xffffff, additive = true, spin = 0, minTier = 0, order = 3, rot = 0 }) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      rotation: rot,
    });
    const s = new THREE.Sprite(mat);
    s.position.set(...pos);
    s.scale.set(scale[0], scale[1], 1);
    s.renderOrder = order;
    s.userData = { baseOpacity: opacity, spin, minTier };
    features.push(s);
    scene.add(s);
    return s;
  }

  {
    // GALAXIES — far field, varied orientation + depth so they feel discovered.
    // The three base galaxies show on every tier; the extras (a face-on
    // three-arm spiral, an edge-on disk, two ellipticals) are gated higher so
    // only stronger GPUs pay for the extra sprites.
    const gal1 = makeGalaxyTexture(512, rng, { arms: 2, squash: 0.8, tilt: 0.4 });   // face-on
    const gal2 = makeGalaxyTexture(512, rng, { arms: 2, squash: 0.42, tilt: 2.3 });  // inclined
    const gal3 = makeGalaxyTexture(256, rng, { arms: 2, squash: 0.13, tilt: 5.8 });  // edge-on
    const gal4 = makeGalaxyTexture(512, rng, { arms: 3, squash: 0.86, tilt: 1.1 });  // face-on 3-arm
    const gal5 = makeGalaxyTexture(384, rng, { arms: 2, squash: 0.12, tilt: 4.35 }); // edge-on disk
    const gal6 = makeEllipticalGalaxyTexture(256, { squash: 0.66, tilt: 0.8, warm: true });
    const gal7 = makeEllipticalGalaxyTexture(220, { squash: 0.82, tilt: 2.1, warm: false });
    featureTextures.push(gal1, gal2, gal3, gal4, gal5, gal6, gal7);
    addFeature(gal1, { pos: [250, 110, -430], scale: [150, 150], opacity: 1.0, spin: 0.004 });
    addFeature(gal2, { pos: [-285, -120, -440], scale: [105, 105], opacity: 0.9, spin: -0.006, minTier: 1 });
    addFeature(gal3, { pos: [-300, -15, -455], scale: [52, 52], opacity: 0.6, minTier: 2 });
    addFeature(gal4, { pos: [305, -158, -520], scale: [128, 128], opacity: 0.72, spin: 0.005, minTier: 1 });
    addFeature(gal5, { pos: [128, 178, -505], scale: [150, 150], opacity: 0.6, spin: 0.0015, minTier: 2 });
    addFeature(gal6, { pos: [-340, 158, -545], scale: [86, 86], opacity: 0.6, minTier: 1 });
    addFeature(gal7, { pos: [338, -28, -560], scale: [62, 62], opacity: 0.5, minTier: 2 });

    // soft emission clouds — purely additive wisps in a richer JWST palette, no
    // dark silhouettes or hard structures. Layered in complementary colours so
    // they bleed and blend (Carina / Cosmic-Cliffs richness), scattered for
    // depth, kept off the central column, and gated so weak GPUs draw fewer.
    const neb = [
      makeNebulaTexture(256, rng, 88),
      makeNebulaTexture(256, rng, 70),
      makeNebulaTexture(256, rng, 100),
      makeDustTexture(256, rng, 60),
      makeNebulaTexture(256, rng, 80),
    ];
    featureTextures.push(...neb);

    // richer, more ethereal palette — luminous teals, cyan, gold, deep magenta,
    // rose, soft violet (saturated but not neon; additive blending blooms them).
    const CYAN = 0x33b4c6, TEAL = 0x2a9d8f, DEEPTEAL = 0x1f7a70,
          GOLD = 0xd9a44e, AMBER = 0xc0824a, MAGENTA = 0xb83080,
          ROSE = 0xcf6f93, VIOLET = 0x7d5fc6, INDIGO = 0x4a3a9a, BLUE = 0x2b54a4;

    const wisps = [
      // — upper-left bloom (Carina-flavoured: teal core, gold + magenta + cyan) —
      { t: 0, pos: [-238, 96, -314], scale: [278, 208], opacity: 0.5,  color: TEAL },
      { t: 1, pos: [-205, 78, -300], scale: [188, 148], opacity: 0.42, color: GOLD,  minTier: 1 },
      { t: 2, pos: [-278, 120, -296], scale: [208, 160], opacity: 0.36, color: MAGENTA },
      { t: 4, pos: [-250, 70, -288], scale: [165, 132], opacity: 0.26, color: CYAN,   minTier: 2 },
      { t: 3, pos: [-180, 132, -322], scale: [150, 122], opacity: 0.2,  color: VIOLET, minTier: 2 },
      // — lower-right bloom (indigo body, teal + amber highlights) —
      { t: 2, pos: [188, -104, -300], scale: [272, 208], opacity: 0.44, color: INDIGO },
      { t: 0, pos: [214, -80, -286], scale: [188, 152], opacity: 0.34, color: TEAL,  minTier: 1 },
      { t: 1, pos: [152, -124, -276], scale: [162, 130], opacity: 0.3,  color: AMBER },
      { t: 4, pos: [205, -120, -292], scale: [150, 122], opacity: 0.22, color: ROSE,  minTier: 2 },
      // — right-mid rose + gold bloom (Cosmic-Cliffs warmth) —
      { t: 0, pos: [252, 8, -312],  scale: [202, 160], opacity: 0.3,  color: ROSE, minTier: 1 },
      { t: 1, pos: [276, 30, -300], scale: [152, 122], opacity: 0.24, color: GOLD, minTier: 2 },
      // — scattered depth across the rest of the sky —
      { t: 3, pos: [46, 150, -344],  scale: [252, 168], opacity: 0.28, color: BLUE, minTier: 1 },
      { t: 2, pos: [-64, -156, -332], scale: [212, 160], opacity: 0.26, color: ROSE },
      { t: 0, pos: [312, 36, -352],  scale: [172, 152], opacity: 0.28, color: INDIGO, minTier: 1 },
      { t: 1, pos: [-326, -48, -346], scale: [162, 140], opacity: 0.26, color: DEEPTEAL, minTier: 2 },
      { t: 3, pos: [96, 64, -360],   scale: [202, 152], opacity: 0.2,  color: BLUE, minTier: 2 },
      { t: 4, pos: [-20, 168, -366], scale: [262, 152], opacity: 0.17, color: CYAN, minTier: 2 },
      // — diffuse warm dust lanes (elongated + rotated additive streaks) —
      { t: 3, pos: [-150, -150, -284], scale: [300, 96], opacity: 0.2,  color: AMBER, minTier: 1, rot: 0.5 },
      { t: 2, pos: [-120, -120, -296], scale: [222, 90], opacity: 0.16, color: ROSE,  minTier: 2, rot: 0.5 },
      // — far violet + blue veils for sheer distance —
      { t: 0, pos: [40, -40, -388],  scale: [322, 222], opacity: 0.16, color: VIOLET, minTier: 2 },
      { t: 1, pos: [-40, 30, -392],  scale: [282, 202], opacity: 0.14, color: BLUE,   minTier: 2 },
    ];
    for (const w of wisps) {
      addFeature(neb[w.t], {
        pos: w.pos, scale: w.scale, opacity: w.opacity, color: w.color,
        order: 2, minTier: w.minTier || 0, rot: w.rot || 0,
      });
    }

    // a couple of bright stars seated in the brightest clouds, as their cores
    addFeature(heroTexture, { pos: [-220, 92, -284], scale: [22, 22], opacity: 0.8, color: 0xfff2dc });
    addFeature(heroTexture, { pos: [178, -96, -268], scale: [18, 18], opacity: 0.7, color: 0xffe2b8, minTier: 1 });
  }

  /* ----- state ----- */
  let scroll = 0;
  const pointer = { x: 0, y: 0 };
  const camTarget = new THREE.Vector3(0, 0, 60);
  let running = false;
  let disposed = false;
  let rafId = 0;
  const clock = new THREE.Clock(false);

  // adaptive quality
  let frameCount = 0;
  let frameAccum = 0;
  let framesSinceTierChange = 0;
  let promotionsUsed = 0;
  let fpsEstimate = 60;

  function applyTier() {
    const tier = TIERS[tierIndex];
    const dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    starUniforms.uPixelRatio.value = dpr;
    heroUniforms.uPixelRatio.value = dpr;
    starGeo.setDrawRange(0, tier.stars);
    heroGeo.setDrawRange(0, tier.hero);
    dustMeshes.forEach((m, i) => { m.visible = i < tier.dust; });
    features.forEach((f) => { f.visible = tierIndex >= f.userData.minTier; });
    framesSinceTierChange = 0;
    frameCount = 0;
    frameAccum = 0;
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function updateGlow() {
    const p = Math.min(Math.max(scroll, 0), 1);
    if (p < 0.5) glowColor.lerpColors(GLOW_STOPS[0], GLOW_STOPS[1], p * 2);
    else glowColor.lerpColors(GLOW_STOPS[1], GLOW_STOPS[2], (p - 0.5) * 2);
    glowMat.color.copy(glowColor);
    glow.position.y = -10 + p * -36;
  }

  function tick(dt) {
    elapsed += dt;

    if (fade < 1) {
      fade = Math.min(1, fade + dt / 2.4);
      starUniforms.uFade.value = fade;
      heroUniforms.uFade.value = fade;
    }

    starUniforms.uTime.value = elapsed;
    heroUniforms.uTime.value = elapsed;

    // gentle ambient drift + pointer parallax + scroll descent
    const driftX = Math.sin(elapsed * 0.05) * 2.2;
    const driftY = Math.cos(elapsed * 0.04) * 1.4;
    camTarget.set(
      pointer.x * 5 + driftX,
      pointer.y * 2.6 + driftY - scroll * 11,
      60
    );
    camera.position.lerp(camTarget, Math.min(1, dt * 2.2));

    for (const m of dustMeshes) {
      if (!m.visible) continue;
      m.position.x += m.userData.vx * dt;
      m.position.y += m.userData.vy * dt;
      m.rotation.z += m.userData.vr * dt;
      if (m.position.x > 320) m.position.x = -320;
      if (m.position.x < -320) m.position.x = 320;
      if (m.position.y > 190) m.position.y = -190;
      if (m.position.y < -190) m.position.y = 190;
      const target = m.userData.baseOpacity * fade;
      if (m.material.opacity !== target) m.material.opacity = target;
    }

    for (const f of features) {
      if (!f.visible) continue;
      if (f.userData.spin) f.material.rotation += f.userData.spin * dt;
      const target = f.userData.baseOpacity * fade;
      if (f.material.opacity !== target) f.material.opacity = target;
    }

    updateGlow();
  }

  function governor(dt) {
    frameCount++;
    frameAccum += dt;
    framesSinceTierChange++;
    if (frameCount < 80) return;
    const avg = frameAccum / frameCount;
    fpsEstimate = 1 / Math.max(avg, 0.0001);
    frameCount = 0;
    frameAccum = 0;
    if (avg > 0.026 && tierIndex > 0) {
      tierIndex--;
      applyTier();
    } else if (
      avg < 0.013 &&
      tierIndex < startTierIndex &&
      promotionsUsed < 1 &&
      framesSinceTierChange > 400
    ) {
      tierIndex++;
      promotionsUsed++;
      applyTier();
    }
  }

  function loop() {
    if (!running || disposed) return;
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    tick(dt);
    renderer.render(scene, camera);
    governor(dt);
  }

  function start() {
    if (running || disposed || env.reducedMotion) return;
    running = true;
    clock.start();
    loop();
  }

  function stop() {
    running = false;
    clock.stop();
    cancelAnimationFrame(rafId);
  }

  let renderQueued = false;
  function renderOnce() {
    if (disposed || renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      starUniforms.uFade.value = 1;
      heroUniforms.uFade.value = 1;
      starUniforms.uTime.value = elapsed;
      heroUniforms.uTime.value = elapsed;
      for (const m of dustMeshes) m.material.opacity = m.userData.baseOpacity;
      for (const f of features) f.material.opacity = f.userData.baseOpacity;
      camera.position.set(0, -scroll * 11, 60);
      updateGlow();
      renderer.render(scene, camera);
    });
  }

  /* ----- wiring ----- */
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop();
    document.documentElement.classList.add('no-webgl');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    document.documentElement.classList.remove('no-webgl');
    if (env.reducedMotion) renderOnce();
    else start();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (env.reducedMotion) renderOnce();
    }, 150);
  });

  resize();
  applyTier();
  if (env.reducedMotion) renderOnce();

  return {
    setScroll(p) {
      scroll = p;
      if (env.reducedMotion) renderOnce();
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    start,
    stop,
    renderOnce,
    stats() {
      const tier = TIERS[tierIndex];
      return {
        fps: Math.round(fpsEstimate),
        tier: tier.name,
        dpr: Math.min(window.devicePixelRatio || 1, tier.dpr).toFixed(2),
        stars: tier.stars,
        dust: tier.dust,
      };
    },
    dispose() {
      disposed = true;
      stop();
      starGeo.dispose();
      heroGeo.dispose();
      dustGeo.dispose();
      [starMat, heroMat, glowMat].forEach((m) => m.dispose());
      dustMeshes.forEach((m) => m.material.dispose());
      features.forEach((f) => f.material.dispose());
      [heroTexture, glowTexture, ...dustTextures, ...featureTextures].forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
