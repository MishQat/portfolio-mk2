// portrait.js — the likeness, held in a JWST primary-mirror hexagon.
// The image is clipped to a flat-top hexagon (CSS), seamed into segments like
// the telescope's 18 gold tiles, and tilts a few degrees toward the pointer so
// it reads as a polished surface catching the room. Reduced-motion / touch get
// the hexagon, no tilt.

export function initPortrait({ env, onLayout }) {
  const fig = document.getElementById('portrait-fig');
  const mirror = document.getElementById('portrait-mirror');
  const img = document.getElementById('portrait-img');
  if (!fig || !mirror || !img) return null;

  // A re-layout signal once the portrait has real dimensions — the spine
  // measures this element, so it must rebuild after the image paints.
  function settled() { if (onLayout) onLayout(); }
  if (img.complete) requestAnimationFrame(settled);
  else img.addEventListener('load', settled, { once: true });

  // gentle tilt toward the pointer (desktop, motion allowed)
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const MAX = 7; // degrees

  function frame() {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    mirror.style.transform = `perspective(900px) rotateX(${cy.toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg)`;
    if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) raf = requestAnimationFrame(frame);
    else raf = 0;
  }

  function setPointer(nx, ny) {
    if (env.coarse || env.reducedMotion) return;
    // only react when the pointer is reasonably near the figure
    const r = fig.getBoundingClientRect();
    const fxNorm = (nx + 1) / 2 * window.innerWidth;
    const fyNorm = (1 - ny) / 2 * window.innerHeight;
    const inside = fxNorm > r.left - 220 && fxNorm < r.right + 220 &&
                   fyNorm > r.top - 220 && fyNorm < r.bottom + 220;
    tx = inside ? nx * MAX : 0;
    ty = inside ? ny * MAX * 0.7 : 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  return { setPointer };
}
