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
  { name: 'low',  dpr: 1.0,  stars: 700,  hero: 10, dust: 5 },
  { name: 'med',  dpr: 1.35, stars: 1400, hero: 16, dust: 9 },
  { name: 'high', dpr: 2.0,  stars: 2400, hero: 24, dust: 14 },
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

function makeSoftCircleTexture(size) {
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

// JWST signature: six diffraction spikes plus the short horizontal strut pair.
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

  // six primary spikes (hexagonal mirror), one pair vertical
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + i * (Math.PI / 3);
    spike(a, size * 0.94, size * 0.012, 0.85);
    spike(a, size * 0.94, size * 0.05, 0.18);
  }
  // short horizontal strut spikes
  spike(0, size * 0.46, size * 0.01, 0.6);
  spike(0, size * 0.46, size * 0.04, 0.14);

  // core
  let grad = g.createRadialGradient(mid, mid, 0, mid, mid, size * 0.16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(mid, mid, size * 0.16, 0, Math.PI * 2); g.fill();

  grad = g.createRadialGradient(mid, mid, 0, mid, mid, size * 0.05);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(mid, mid, size * 0.05, 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cloudy luminance blob — tinted per-mesh. A pile of soft circles inside a
// radial falloff mask reads as nebula wisps once additive-blended and scaled.
function makeDustTexture(size, rng, blobs) {
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
      col[i * 3 + 0] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
      size[i] = 26 + rng() * 48;
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
    { color: 0x382a7a, w: 0.30 }, // indigo
    { color: 0x27418f, w: 0.22 }, // deep blue
    { color: 0x1f6a63, w: 0.16 }, // teal
    { color: 0x7c1d59, w: 0.22 }, // brand magenta
    { color: 0x8a6a3a, w: 0.10 }, // JWST amber
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
      [heroTexture, glowTexture, ...dustTextures].forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
