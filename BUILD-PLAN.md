# BUILD-PLAN.md — Portfolio v2 Roadmap

This is the master roadmap for the cosmic portfolio rebuild. If a session crashes or the
chat is lost, read this file plus CLAUDE.md and project-descriptions.md to fully re-orient.
Read the current state of all repo files to see which stages are already built, then
continue from the first unfinished stage. Commit after each stage with a clear message so
there are always restore points.

---

## Vision (the soul of the project)
Personal portfolio for Ahmed Mishqat. Aesthetic fusion: **JWST cosmic sublime + Minecraft
pixel-craft + literary melancholy.** Dark theme only — it's set in space. Must feel like a
person, not a CV. Static site for GitHub Pages, vanilla HTML/CSS/JS + WebGL (Three.js via
CDN ok). All paths relative. Performance is a hard requirement — GPU-light, degrade
gracefully on weak hardware and mobile, respect prefers-reduced-motion. The "pages" (home,
projects) are STATES in one single-page app — transitions are continuous animations, never
real page reloads. Browser back must work via history state.

---

## The three quotes (verbatim — core to his identity, three spatial registers)
1. **Hero / self-portrait line:** "Engineer by training. Curious by nature. I want to
   understand how things work, make them better, and maybe learn something about people
   along the way."
2. **Donna Tartt line:** "A morbid longing for the picturesque at all costs."
   attribution: *— Donna Tartt, The Secret History*
3. **The silence line (philosophical core, tie to Alrescha / the constellation):**
   "It's the silence that responds when we ask a question that makes us do things."
   (no attribution)

---

## STAGE 1 — Cosmic background  [COMPLETE]
Living JWST-inspired cosmos. Layered for performance: CSS base nebula gradient + WebGL
particles/shaders for drifting dust and parallax depth. Stars with diffraction spikes on
brighter ones. Galaxies and soft nebula clouds (Carina/Pillars depth) scattered tastefully.
Restrained star field, richness from the nebulae. No broken/malformed nebula structures.

## STAGE 2 — Home page  [COMPLETE]
- Pisces constellation nav spine (js/constellation.js) — draws itself in on scroll, two
  cords meeting at Alrescha (the knot), which is the gate into Projects. Prominent, clearly
  visible, accurate Pisces shape.
- Portrait (assets/images/me.webp) in a JWST primary-mirror hexagon — gold-rimmed hex,
  segment seams, slow specular sheen, slight tilt toward pointer.
- Three quotes in three spatial registers (near/verse/far). Use the verbatim text above.
- Netherite sword cursor + magenta pixel ember trail (js/cursor.js). MUST look exactly like
  the Minecraft netherite sword sprite — pixel-perfect, sharp, no anti-aliasing. If a
  reference PNG exists in assets/images/, use it directly for accuracy.

---

## STAGE 3 — The stargate transition  [NEXT]
Home <-> Projects navigation IS the transition. Inspired by 2001: A Space Odyssey "Jupiter
and Beyond the Infinite" — the feeling of accelerating through a corridor of stars toward
something. NOT seizure-inducing or overly trippy — sublime flight, not assault.

- Triggered by clicking the **"Projects"** button on home (and a **"Home"** button on the
  projects page for the return flight).
- Star field stretches into streaks, a moment of "beyond the infinite," then deceleration
  into the destination.
- Duration: **2-3 seconds.**
- Palette: purple, blue, white, pink, red, with hits of dark magenta.
- prefers-reduced-motion: replace the flight with a quick clean fade instead.
- Browser back button navigates correctly via history state.
- It's one SPA — this is a continuous WebGL animation between states, not a page reload.

## STAGE 4 — Projects page (depth-fly galaxy)
Projects as luminous nodes at varying depths in space. User gently flies THROUGH them.
**Principle: motion for delight, stillness for reading.**

- Not cluttered — keep it understandable. Nearest/focused project is larger, glowing, title
  legible; others recede into soft-focus depth. ~7-8 nodes max in view.
- Scroll or arrow keys move forward/back through projects like adjusting telescope focus.
- **No rectangular modals.** Clicking the focused project smoothly expands it into a clean,
  calm, fully readable detail view — still and legible, no distracting motion. A recruiter
  must be able to read it in under 30 seconds.
- Content VERBATIM from project-descriptions.md. Include all projects, their images, videos,
  PDFs. Preserve the honest/reflective tone — don't make it marketing-y.
- Note: "Group 28 Design 2 Project Report.pdf" belongs to the 3-Axis CNC Positioning project.
- Lazy-load any heavy media on click.
- A persistent subtle "home" affordance so users are never trapped.
- DEFER the STL/glTF 3D model viewers — that's a separate later task. Ignore the stl/ folder
  for now.

## STAGE 5 — Liquid glass polish + performance/mobile pass
- Proper iOS 26-style **liquid glass** buttons (Projects/Home nav + any controls) — real
  backdrop refraction, dynamic specular highlights responding to cursor position, soft inner
  glow, edge light, content subtly distorting through the glass. Not a flat blur fake.
- Full performance pass: check GPU load, dial down particle counts if needed, pre-bake
  nebulae as textures rather than live shaders if performance dips.
- Full mobile pass: simplify/disable heavy effects on touch, ensure nothing breaks, tap
  targets >= 44px, readable type.
- Verify prefers-reduced-motion across the whole site.

---

## Working rules
- Build one stage at a time. Check in after each with a short summary + anything needing input.
- Commit after each working stage (lowercase, concise messages).
- Do NOT push to GitHub until told — pushing publishes the half-built site.
- Prioritise a working, performant foundation over premature polish.
