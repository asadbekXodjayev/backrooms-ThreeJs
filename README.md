# THE BACKROOMS — noclip

A first-person **liminal-horror** browser game built with **Three.js + Vite + TypeScript**.
You noclipped out of reality into an endless, fully-sealed procedural maze of mono-yellow rooms,
damp carpet, and flickering fluorescent lights. Survive the hum, manage your sanity, descend the
levels, and find a way out — while something wire-thin learns your name.

> Dread from **absence**, not gore. The world is the score.

## Play
```bash
npm install
npm run dev      # http://localhost:5173
```
Build & preview:
```bash
npm run build
npm run preview
```

## Controls
| | |
|---|---|
| Move | `W A S D` / arrows · left joystick (touch) |
| Look | mouse (click to lock) · right-drag (touch) · gamepad right stick |
| Sprint | `Shift` (stamina) |
| Crouch / hide | `C` or `Ctrl` |
| Flashlight | `F` |
| Interact / pick up | `E` |
| Journal (notes) | `Tab` |
| Pause / settings | `Esc` |
| 3rd-person "stickman" | `V` |

## Goal
Find the **anomaly** in Level 0 to noclip down, gather **Almond Water** to hold your sanity,
read the notes left by the wanderers, solve the valve sequence in the pipes, and reach the
**true exit** — or be lost forever.

## What makes it tick
- **Sealed infinite maze** — chunked grid generation that is watertight *by construction*
  (shared seeded edge function welds chunk seams); collision reads the same grid as the visuals,
  so you can never clip a wall or fall through the floor. `FogExp2` hides the generation frontier.
- **Sanity as conductor** — one value drives fog, film grain, hum detune, heartbeat, flicker, and
  the entity's aggression.
- **Everything procedural** — textures generated on canvas, audio synthesized in Web Audio.
  Zero third-party assets → tiny bundle, no licensing risk.
- **Found-footage post-fx** — grain, vignette, chromatic aberration, bloom, VHS scanlines that
  intensify as you lose your mind. Respects `prefers-reduced-motion`.

See [`SPEC.md`](./SPEC.md) for the design, [`RULES.md`](./RULES.md) for the 12 quality gates,
and [`CREDITS.md`](./CREDITS.md) for licensing.

## Quality gates & QA
Two automated harnesses back the [`RULES.md`](./RULES.md) gates:
```bash
node qa/maze-test.mjs   # watertight sweep: 200 seeds × 3 levels, 0 failures, connectivity check
node qa/smoke.mjs       # headless-Chrome live pass: WebGL boot, 0 console errors,
                        # draw-call / triangle / flat-memory metrics, state screenshots
```
The smoke harness drives the full loop (menu → walk → flashlight → 3rd-person → journal → roam)
and writes screenshots to `qa/shots/`. Measured: **70 draw calls, ~3.7K triangles, flat memory**
(geometries 15→15, heap Δ −0.2 MB over heavy roaming), **0 console errors**.

## Tech
Vanilla `three` (WebGL), Vite, TypeScript. No game engine, no physics lib — a hand-tuned capsule
controller with grid/AABB collision keeps the loop tight and the maze provably sealed. All
textures are canvas-generated; all audio is Web-Audio-synthesized; the found-footage grade is a
custom GLSL pass on Three's `EffectComposer`. Dev/QA tooling: Playwright (headless Chrome).
