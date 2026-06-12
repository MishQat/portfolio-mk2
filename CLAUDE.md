# CLAUDE.md — Mishqat's Portfolio (v2, cosmic rebuild)

## What this is
Personal portfolio for Ahmed Mishqat — mechanical engineering undergraduate at the
University of Manchester, but explicitly NOT just an engineer. Reads Cioran and Donna
Tartt, writes prose-poetry, listens to shoegaze, loves Minecraft, thinks in analogies.
The site must feel like a person, not a CV.

This is a from-scratch rebuild (v2). The previous version is gone — there is no existing
HTML/CSS/JS to match or preserve. Build the new vision fresh from the creative brief.

Static site for GitHub Pages. No build step, no compiled frameworks. Vanilla HTML/CSS/JS
plus WebGL (Three.js via CDN is acceptable).

---

## Aesthetic
JWST cosmic sublime + Minecraft pixel-craft + literary melancholy. Dark theme only —
the site is set in space. Rich but never garish.

---

## Repo structure
```
portfolio-mk2/
├── index.html              ← single-page app (pages are states, not reloads)
├── css/                    ← stylesheets
├── js/                     ← scripts
├── assets/
│   ├── images/             ← me.webp (hero portrait), project1.jpg ... project7_2.jpeg
│   ├── cv/                 ← AhmedMishqat_CV_General.pdf
│   ├── code/               ← Python scripts, project report PDFs
│   ├── files/              ← project6_calc.pdf, project6/7 presentation PDFs
│   └── vids/               ← GearPrixVid.mp4
├── CLAUDE.md
├── project-descriptions.md ← EXACT project content — use verbatim, do not invent
└── projects-content.md     ← additional project content reference
```

Image naming: `project1.jpg` through `project7_2.jpeg` map to projects 1-7. Some projects
have multiple images (e.g. project5.jpg + project5_2.jpg, project6_1.jpeg + project6_2.webp).
The hero portrait is `assets/images/me.webp`.

Ignore `unsortedthings/`, `stl/`, and `tempCodeRunnerFile.python` — not used on the site.
The STL/glTF 3D viewers are deliberately deferred to a later task; do not implement them now.

---

## Hard technical rules
- ALL asset and internal paths must be RELATIVE (e.g. `assets/images/me.webp`, never
  `/assets/...`). The site is hosted in a GitHub Pages subdirectory and absolute paths break.
- Performance is a hard requirement. WebGL/shader work must be GPU-light and degrade
  gracefully on weak hardware. Respect `prefers-reduced-motion`.
- Mobile must not break — simplify heavy effects on touch devices rather than shipping
  something broken. The desktop experience is primary.
- "Pages" (home, projects) are states within one single-page app — transitions between
  them are continuous WebGL animations, never real page reloads. Browser back must still
  work via history state.

---

## Content rules
- Project write-ups come VERBATIM from `project-descriptions.md`. Do not invent, embellish,
  or rewrite project details to sound more polished. The honest, reflective tone — including
  acknowledgement of failures and limitations — is intentional and must be preserved.
- The three personal quotes (hero statement, Donna Tartt line, the silence line) are core
  to Mishqat's identity and must appear, presented per the creative brief.

---

## Working approach
- Build in stages (background -> home -> transition -> projects -> polish). Check in after
  each stage with a short summary and anything you want input on, rather than doing
  everything silently.
- Commit after each working stage so there are restore points.
- Prioritise a working, performant foundation over premature polish.

## Commit message style
Lowercase, concise, imperative. e.g. `add cosmic background shader`, `build pisces nav spine`