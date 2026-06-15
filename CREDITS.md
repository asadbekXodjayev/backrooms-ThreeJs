# CREDITS

## Concept
The Backrooms is a community/CC creepypasta (originated 2019). This is an **original** interactive
work *inspired by* that shared mythos. It does **not** reuse any copyrighted work — no Kane Pixels
footage, no A24 score, no named community tracks, no models/textures from other Backrooms games.

## Art & textures
- **All textures are procedurally generated at runtime** on HTML `<canvas>` (mono-yellow wallpaper,
  damp carpet, drop-ceiling tiles, lore-note paper, VHS grain). Authored originally for this project.
  License: original work, MIT (this repo).

## Audio
- **All audio is synthesized at runtime** via the Web Audio API (oscillators + filtered noise):
  fluorescent hum, sub-bass drone, footsteps, water drips, breathing, flashlight click, entity
  stingers. No third-party samples. License: original work, MIT (this repo).

## Code & libraries
- [three.js](https://threejs.org) — MIT.
- [Vite](https://vitejs.dev), [TypeScript](https://www.typescriptlang.org) — MIT / Apache-2.0.
- Post-processing uses three.js' built-in `EffectComposer` + a custom GLSL found-footage pass
  (original).

## Fonts
- System UI font stack + a CSS-styled monospace for the analog-horror HUD. No bundled font files.
