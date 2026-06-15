# Technical Specification — "The Backrooms" (Three.js liminal-horror game)

> Status: APPROVED for autonomous build (idea-loop, effort ultra). This file is the build
> contract; `RULES.md` tracks the 12 measurable gates with their measured values.

## 1. Problem & experience
A playable, browser-based, atmospheric first-person horror walking-sim set in **The Backrooms**.
The dread comes from **absence** — silence, the fluorescent hum, endless sameness, being watched.
Restraint first; scares are rare, earned, atmospheric.

## 2. Players & platforms
- Desktop (mouse + keyboard, pointer-lock; gamepad).
- Mobile (twin touch joysticks + look-drag), 320px → 4K, iOS Safari / Android Chrome.
- One immersive page. No SSR. Fast atmospheric loader.

## 3. Core mechanic / loop
explore → loot (Almond Water / batteries / notes) → manage sanity + flashlight → read lore →
solve a puzzle / find the anomaly → **noclip down a level** → entity escalation → reach an ending.

## 4. Architecture (vanilla three + Vite + TS, WebGL)
```
src/
  core/      Engine (renderer/scene/camera/loop), rng (seeded PRNG), input, perf monitor, events
  world/     MazeGen (seeded grid), Chunk, ChunkManager (stream ahead of fog + recycle/pool), materials (procedural canvas textures)
  player/    Controller (FP capsule + grid/AABB collision, headbob, stamina, crouch), Flashlight
  fx/        post (EffectComposer: bloom + custom found-footage ShaderPass)
  audio/     AudioEngine (Web Audio synthesized ambience + sanity-reactive mix)
  game/      Sanity (master conductor), Items, Levels, Missions, Entity, Story (notes + endings)
  ui/        Loader, Menu, HUD, Journal, Pause, Touch controls
```

### Sealed-maze keystone (the hardest requirement)
- **Grid maze, watertight by construction.** Each cell is a unit volume on an integer grid.
  Walls live on cell *edges*; neighbouring chunks read a **shared seeded edge function** so they
  always agree on every boundary wall (no double/missing walls at seams). Floor + ceiling are
  continuous. Because geometry derives purely from the seeded grid, **a hole cannot be produced.**
- **Collision reads the same grid** → visual == collision by construction; no clip/fall-through
  except a *scripted* noclip transition between levels.
- **`FogExp2`** hides the generation frontier; chunks generate ahead of the fog wall, recycle
  behind, meshes pooled → flat memory, endless feel.
- Generation biased toward long corridors + occasional open bullpens + dead-ends (liminal feel,
  not a tight perfect maze).

### Sanity = master conductor
One 0..1 value drives fog density, grain/VHS intensity, hum detune, heartbeat gain, flicker rate,
and entity aggression. Drains over time, faster in dark / near entity; restored by Almond Water.

### Assets — zero licensing risk (§7)
- **Textures:** procedurally generated on `<canvas>` → `CanvasTexture` (mono-yellow wallpaper,
  damp carpet, drop-ceiling). Counts as `isImagesUsed` (real generated imagery).
- **Audio:** fully **synthesized** via Web Audio (oscillators + filtered noise) — hum, drone,
  footsteps, drips, breathing, stingers. No third-party tracks.
- **Entity:** original stylized geometry (wire-thin silhouette), not a copied design.

## 5. Levels (extensible: {generator params, palette, audio bed, objective, entity behavior})
- **L0 The Lobby** — classic mono-yellow. Tutorial: move/loot. Objective: find the wallpaper
  **anomaly** (weak point) → noclip down. No active entity (one distant glimpse possible).
- **L1 Habitable Zone** — warehouse/concrete palette. Collect supplies. Entity **actively hunts**.
- **L2 Pipe Dreams** — damp tunnels. **Puzzle**: 3 valve codes found in notes open the exit.
- **Endings:** TRUE EXIT (complete the chain) and LOST FOREVER (sanity collapse / wrong path).

## 6. Controls
WASD/arrows move, mouse look (pointer-lock), Shift sprint (stamina), C/Ctrl crouch, F flashlight,
E interact, Tab journal, Esc pause, V toggle stickman 3rd-person. Touch: left joystick move,
right drag look, on-screen sprint/crouch/interact/flashlight buttons. Gamepad sticks + buttons.

## 7. Acceptance criteria
All 12 gates in `RULES.md` provably pass; no-holes sweep clean across many seeds; 10-min soak
flat memory; full loop verified; QA clean (no P0/P1); Lighthouse ≥90 on loader; deployable.

## 8. Non-goals (v-next)
Save/load, multiplayer, more than 3 levels, full inventory crafting, narrative branching beyond
the two endings, controller remapping UI.
