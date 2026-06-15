# Claude Code Prompt — "The Backrooms" (liminal-horror Three.js game)

> **Repo:** `https://github.com/asadbekXodjayev/backrooms-ThreeJs` *(create if it doesn't exist)*
> **Inherits:** the five master gates from the suite — `isFast`, `isAdaptive`, `isAwardwinning`,
> `isVisualized`, `isImagesUsed` — *plus* the new game-specific rules in §2. All twelve apply.
> **Before anything:** inspect the repo (`git log`, file tree, `package.json`). Extend what's
> there; don't wipe it. Report state, then produce the Phase 0 plan and wait for my go.

---

## 0. What we're building & the source material

A first-person liminal-horror walking game set in **The Backrooms** — the internet creepypasta
(born on 4chan in 2019) about "**noclipping out of reality**" into an impossibly large maze of
empty rooms. The signature Level 0 is **mono-yellow wallpaper, damp/moist carpet, and flickering
fluorescent lights with a constant electrical hum** — no doors, no windows, no people, no
furniture, stretching endlessly. The dread doesn't come from a monster jumping out; it comes from
**absence** — being somewhere familiar but wrong, vast but claustrophobic, where you feel watched
and you shouldn't be there. (Popularized into a full mythos by Kane Pixels' 2022 found-footage
series, now an A24 film, with a community wiki of hundreds of "levels" and "entities".)

We're making a playable, browser-based, atmospheric horror experience: an **endless, fully-sealed
procedural maze** the player explores in first person, with a **sanity system, found lore notes,
mission objectives, multiple Backrooms "levels," a stalking entity that escalates after the first
levels, and endings.** It must nail the liminal mood and be genuinely unsettling.

> **Research note for Claude Code:** before building, web-fetch the Backrooms Wiki (Level 0/1/2),
> the liminal-space aesthetic, and the found-footage sound design to ground the art/audio
> direction in the real source material. Use it for *reference only* — build original assets (see
> §7 on IP/licensing).

---

## 1. Idea development (design pillars & systems)

### Mood & pillars
- **Dread from emptiness, not gore.** The fear is the silence, the hum, the endless sameness, the
  sense of being watched. Restraint first; scares are rare, earned, and atmospheric.
- **Liminal & uncanny.** Familiar-but-wrong office space, depopulated, slightly decayed, lit by
  sickly fluorescents. Vast yet claustrophobic.
- **Always lost.** Procedurally generated, never the same maze twice; the player should feel
  genuinely disoriented (no minimap by default — that's the point).
- **Watertight world.** The maze is **fully rendered and fully enclosed** — no holes, no
  fall-through, no visible ungenerated voids, ever (see `isSealed`). Fog limits sightlines for
  mood *and* so the edge of generation is never seen.

### The map — sealed procedural maze (critical)
- **Grid-based procedural maze** generated in chunks around the player and recycled behind, so it
  feels infinite. Because it's grid-based, every reachable cell is **watertight by construction**:
  floor + ceiling + walls fully enclose it, chunk seams are welded/aligned (no gaps, no z-fighting
  cracks), and the **collision mesh matches the visual mesh** so the player can never clip through
  a wall or fall through the floor (except a *scripted* noclip transition between levels).
- **Always generate ahead of the fog wall** — the player can never see or walk into an unbuilt
  area. The ceiling is always present; there are no black voids anywhere in view.
- Layouts vary: open office bullpens, tight hallway warrens, pillar halls, dead-ends, the
  occasional larger room — but always enclosed.

### The character / camera
- **Default: first-person POV** — the authentic, scariest Backrooms experience, with optional
  **found-footage framing** (subtle handheld sway, VHS grain/scanlines, timestamp, a held
  flashlight/camcorder). Pointer-lock on desktop; twin touch joysticks + look-drag on mobile.
- **Optional "stickman" 3rd-person mode** (a toggle): a minimalist stick-figure avatar with a
  trailing chase camera — a stylistic, slightly-less-terrifying alternative for those who want it.
- Head-bob and movement are smooth and comfortable; sprint has stamina; crouch to hide.

### Atmosphere & lighting
- **Mono-yellow palette**, damp-carpet texture, water-stained wallpaper, drop-ceiling tiles, and
  **flickering fluorescent panels** (emissive + occasional flicker/buzz spikes). The held
  **flashlight is the one strong dynamic light** (a `SpotLight`); keep real-time shadows cheap and
  local to the player. Heavy **`FogExp2`** for dread and view-distance culling.
- **Post-processing (found-footage look):** film grain, vignette, slight chromatic aberration,
  faint bloom on the fluorescents, optional VHS scanlines/tracking glitches that intensify as
  sanity drops. All toggleable; respect `prefers-reduced-motion` (soften flicker/glitch).

### Audio & music (do this seriously — it carries the horror)
The Backrooms sound is **diegetic dread**: the world *is* the score. Build layered ambience:
- **Base:** the constant **fluorescent hum/buzz** + low **sub-bass drone**, looping seamlessly.
- **Texture:** distant pipe creaks, water drips, ventilation rumble, and **sudden patches of
  silence** that make the next sound land harder.
- **Player:** footsteps on damp carpet (slower, muffled), breathing that quickens when running or
  near the entity, the flashlight click.
- **Score style:** analog-synth, tape-warped pads, hauntology (think the "fluorescent hum given a
  melody"), minimalist and looping — fading in only at key moments. **Stingers** for entity
  reveals, kept rare.
- **Sanity-reactive mix:** as sanity drops, the hum detunes, a heartbeat creeps in, audio
  low-passes and warps. A clear **mute/volume + per-channel** control exists; audio starts on
  first user gesture (browser autoplay policy).

### Story, logic & missions
A light but real narrative spine — enough purpose to drive exploration without breaking the mystery:

- **Premise:** you *noclipped* out of reality. You don't know how. You have a flashlight, a
  camcorder, and a slipping grip on sanity. The goal is to **survive and find a way out** by
  descending through the Backrooms' levels toward a rumored exit.
- **Sanity meter:** drains slowly over time, faster in the dark and near the entity; restored by
  **Almond Water** (the canonical consumable) found in drawers/cabinets/supply crates. At zero
  sanity: hallucinations intensify and you risk a game-over/respawn (chill on punishment is *not*
  the goal here — tension is).
- **Items:** Almond Water (sanity), flashlight + batteries, energy bars (stamina), and **lore
  notes** left by previous wanderers / a "M.E.G."-style explorer group — these deliver the story
  in fragments and hint at exits.
- **Missions per level:** each level has a clear objective and an exit. Examples:
  - *Level 0 — The Lobby:* learn movement/looting; find the **anomaly in the wallpaper** (a
    structural "weak point") that lets you noclip down. Empty and tense — no active entity yet,
    maybe one distant glimpse.
  - *Level 1 — Habitable Zone:* warehouse/concrete; collect supplies; a **lights-out hazard** —
    move only when the fluorescents are on. The **stalking entity now actively hunts in the dark.**
  - *Level 2 — Pipe Dreams:* damp tunnels; a small **puzzle** (e.g. color-coded valves / a breaker
    sequence / an elevator code found in notes) gates the exit.
  - *Deeper levels:* a clean "office with windows to the void" reprieve hub for lore, then more
    distorted spaces. Keep it extensible — a level is just {generator params, palette, audio bed,
    objective, entity behavior}.
- **The thing that follows you (escalation):** after the first level(s), an **original stylized
  entity** (wire-thin, wrong, inspired by the lore's stalkers — not a copied design) begins to
  haunt you. It **escalates in stages**: first you only *hear* it; then catch *glimpses* at the
  end of halls; then it actively **pursues in darkness / when you linger too long / when sanity is
  low**. Hide (crouch, break line of sight), manage light, keep moving. It is rare and
  atmospheric, never a constant action threat.
- **Endings:** at least two — e.g. a "true exit" (escape to the Frontrooms) reached by completing
  the level chain, and a darker "lost forever" ending if sanity collapses or a wrong door is
  taken. Branching is a bonus.

### UI / HUD (minimal, in-world where possible)
- Near-zero HUD: a subtle sanity indicator (or purely audiovisual — vignette/heartbeat instead of
  a bar), held-flashlight battery, current objective text that fades in on level entry, and an
  inventory for notes/items. A clean pause/settings panel (sound channels, quality, POV toggle,
  reduced-motion, sensitivity). The world is the interface.

---

## 2. Additional rules (game-specific gates)

Measurable, like the master five. A build isn't done until each is provably `true`. Restate all
twelve with measured values in `RULES.md`.

| Flag | Means | Hard criteria |
|---|---|---|
| `isLiminal` | Nails the aesthetic | Mono-yellow wallpaper, damp carpet, drop ceiling, flickering fluorescents + hum, empty & uncanny, heavy fog. Reads instantly as "the Backrooms" in a screenshot. |
| `isSealed` | Fully rendered, no holes | Watertight maze: every reachable cell fully enclosed (floor/ceiling/walls), welded chunk seams, no gaps/cracks/z-fight, no visible ungenerated void, no fall-through or wall-clip (collision matches visuals). 10-min walk finds zero holes. |
| `isInfinite` | Endless, never repeats | Grid-procedural, chunked + recycled; two sessions are visibly different; memory flat over a long session (pooling proven). |
| `isScary` | Genuinely unsettling | Dread-from-absence atmosphere, sanity-reactive audio/visuals, rare earned stingers, and an entity that escalates in stages. Tension sustained, not constant jump-scares. |
| `isMissioned` | Real story & objectives | ≥3 levels, each with a clear objective + exit; sanity + Almond Water loop; ≥1 puzzle; lore notes that tell a story; ≥2 endings. |
| `isPlayable` | Good controller | Smooth first-person controller (pointer-lock desktop, touch joysticks mobile), stamina/crouch, comfortable head-bob, no jitter; optional stickman 3rd-person toggle works. |
| `isAtmosphericAudio` | Sound carries it | Seamless fluorescent-hum/drone bed + textures + footsteps/breathing + sanity-reactive mix + rare stingers; per-channel volume; starts on first gesture; reduced-motion-safe. |

Plus the inherited master gates: `isFast`, `isAdaptive`, `isAwardwinning`, `isVisualized`,
`isImagesUsed`.

**How the inherited gates map to this game:**
- `isFast` — ≥55 FPS desktop / ≥30 FPS on a 4x-CPU-throttled mobile profile, sustained over a long
  session. Fog + chunk recycling + instancing + cheap/local shadows + baked light where possible
  carry this. Lighthouse ≥90 on the menu/loader.
- `isAdaptive` — playable 320px → 4K; mouse+keyboard, touch, and gamepad; DPR clamped; quality
  auto-steps-down (shadows/post-fx/fog/draw distance) on weak GPUs.
- `isVisualized` — the explorable 3D maze *is* the game.
- `isImagesUsed` — real imagery used meaningfully: wallpaper/carpet/ceiling/wall textures (KTX2),
  lore-note scans, the VHS grain overlay, and an iconic Level-0-style photo on the loading screen.
- `isAwardwinning` — the lighting, fog, found-footage post-fx, the audio-visual sanity system, and
  the entity reveal make it feel like a crafted experience, not a tech demo.

---

## 3. Tech stack (recommended)

- **Engine:** **vanilla `three`** + **Vite + TypeScript** — a tight loop with full control over
  the first-person controller, chunk streaming, and frame budget. **Alternative:** R3F + drei
  (`PointerLockControls`, `Sky`, instancing, `@react-three/postprocessing`); if you go R3F, keep
  the loop disciplined and say why in Phase 0.
- **Controller/collision:** first-person capsule. Prefer **simple grid/AABB collision** against
  the maze (cheap, deterministic, guarantees no clip-through) over a full physics engine; reach
  for **Rapier** only if a feature needs it.
- **World:** seeded PRNG; **chunked grid maze** generated ahead of a fog wall, recycled behind;
  `InstancedMesh` for repeated geometry (ceiling tiles, lights, props); merged static geometry per
  chunk. **`FogExp2`** for mood + culling.
- **Lighting:** emissive fluorescent panels + a baked/cheap ambient term for the static maze; the
  **flashlight `SpotLight`** as the main dynamic light; limit shadow-casters to near the player.
- **Post-processing:** `postprocessing` (grain, vignette, chromatic aberration, bloom, optional
  VHS/glitch tied to sanity).
- **Audio:** Web Audio API — layered looping buffers (hum/drone/texture), positional sounds for
  drips/entity, gain/filter ramps for the sanity-reactive mix.
- **Assets:** glTF/GLB (Draco + KTX2 + Meshopt) for props/entity; KTX2 textures; AVIF/WebP for DOM
  imagery, notes, loading art.
- **Perf tooling:** `stats.js` / `r3f-perf`, Spector.js, Lighthouse.

SSR isn't a concern (single immersive page); ship a fast, atmospheric loader.

---

## 4. Skills to use (in this order)

1. **`threejs`** — primary. Read `references/tool-directory.md`, then `setup-r3f-vs-vanilla.md`,
   `loaders-and-assets.md`, `animation-and-controls.md`, `performance.md`, `shaders-and-tsl.md`
   (for fog/flicker/VHS shaders), and `interactivity-and-events.md`. Follow its build + dispose
   discipline.
2. **`frontend-design`** — two-pass design for the loader, title screen, minimal HUD, note/journal
   UI, and the one signature moment. Lean into the analog-horror / liminal vibe; avoid templated
   defaults.
3. **`ui-ux-pro-max`** — settings/pause panel and control affordances (incl. mobile touch).
4. **`logo-creator` / `ckmdesign`** — a wordmark/title treatment + favicon + loader art in the
   analog-horror style.
5. **`qa-tester`** — mandatory before ship: static analysis + live harness, console/network/runtime
   capture, screenshots of every state (title, each level, entity encounter, low-sanity, an
   ending). **Plus a dedicated "no-holes" sweep** (see Phase 8). No open P0/P1.

For version-sensitive APIs (three/drei/postprocessing in 2026), web-fetch the official docs and
verify signatures rather than trusting memory.

---

## 5. Phased plan (commit per phase, then pause)

**Phase 0 — Orient & research.** Inspect/create repo, lock stack (vanilla vs R3F + why), set the
performance budget, web-fetch Backrooms reference (Level 0/1/2 aesthetic + sound design), output
the plan + the level/objective list and the maze data model. Wait for go.

**Phase 1 — Sealed maze.** Grid-procedural maze, chunked generation ahead of a fog wall + recycle
behind. **Prove `isSealed` immediately:** watertight cells, welded seams, collision == visuals, no
fall-through, no voids. Walk it for 10 minutes hunting holes; fix any.

**Phase 2 — First-person controller.** Capsule movement, look, sprint/stamina, crouch, head-bob,
flashlight `SpotLight`. Pointer-lock (desktop) + touch joysticks (mobile) + gamepad. Tune until
`isPlayable` feels smooth. Add the optional stickman 3rd-person toggle.

**Phase 3 — Liminal dressing & lighting.** Mono-yellow wallpaper/carpet/ceiling textures,
fluorescent panels with flicker/buzz, fog, palette. Found-footage post-fx (grain/vignette/CA/
bloom). Prove `isLiminal` — it should read as the Backrooms in a still.

**Phase 4 — Audio system.** Layered hum/drone/texture beds, footsteps/breathing, positional
drips, stingers, and the **sanity-reactive mix** (detune/heartbeat/low-pass). Per-channel volume,
first-gesture start. Prove `isAtmosphericAudio`.

**Phase 5 — Story, sanity, items, missions.** Sanity meter + Almond Water loop; flashlight
batteries; lore notes; per-level objectives + exits (anomaly/vent/puzzle); the level chain; ≥2
endings. Prove `isMissioned`.

**Phase 6 — The entity & scares.** Original stylized stalker with **staged escalation** (heard →
glimpsed → pursues in dark / on lingering / at low sanity); hide/line-of-sight mechanics; rare
earned stingers. Prove `isScary`.

**Phase 7 — Performance pass (`isFast`).** Profile a long session. Fix draw calls, overdraw,
shadow cost, texture sizes, GC churn. Confirm chunk recycling holds (flat memory), DPR clamped,
quality auto-steps-down. Hit every number; write them into `RULES.md`.

**Phase 8 — Test (`qa-tester`).** Static + live harness; cross-device matrix (desktop browsers,
iOS Safari, Android Chrome, ≤375px phone, 4K); reduced-motion + audio-off paths; keyboard/touch/
gamepad. **Dedicated no-holes sweep:** automated + manual traversal probing for gaps, clip-through,
fall-through, and visible voids across many seeds. 10-minute soak for leaks. Fix all P0/P1.

**Phase 9 — Ship.** `README.md`, `CREDITS.md` (every model/texture/audio license), `RULES.md`
(all 12 gates with measured values). Deploy to **Vercel**, verify production Lighthouse + on-phone
FPS, OG card. Final commit + push.

---

## 6. Performance & adaptivity playbook

- **Sealed-maze streaming:** generate chunks ahead of the fog wall, recycle behind; pool chunk
  meshes; weld seams so there are never cracks. The fog wall guarantees the player never sees the
  generation edge.
- **Instancing & merging:** `InstancedMesh` for ceiling tiles, light fixtures, repeated props;
  merge each chunk's static geometry to crush draw calls.
- **Cheap lighting:** bake/approximate the static ambient term; keep the flashlight as the main
  dynamic light; limit real-time shadow-casters to the player's vicinity; emissive panels need no
  shadows.
- **Fog as a tool:** `FogExp2` sells the dread *and* lets you cull aggressively at short range.
- **Post-fx budget:** grain/vignette are cheap; gate bloom/CA/VHS-glitch behind the quality tier
  and drop them first on weak GPUs.
- **DPR clamp** `min(devicePixelRatio, 2)`; runtime FPS monitor steps quality down (DPR → shadows
  → post-fx → fog distance → prop density).
- **Audio** lazy-loaded/decoded off the critical path; never block first frame; loops seamless.
- **Dispose** geometries/materials/textures/render targets on chunk teardown; verify flat memory
  over a 10-minute walk. Pause rendering when tab hidden.
- **Reduced motion:** soften fluorescent flicker, VHS glitches, head-bob, and chromatic
  aberration; keep the experience intact.

---

## 7. Assets & licensing (read carefully — IP matters)

- The Backrooms *concept* is community/CC content, but **specific copyrighted works are not
  yours to reuse.** Do **not** rip the Kane Pixels videos, the A24 film score, named community
  tracks (e.g. TileKid's), or other games' (Escape the Backrooms, Apeirophobia) models/textures.
- **Audio:** use **CC0 / royalty-free** liminal-ambient and SFX that match the *style* — e.g.
  Freesound (CC0 fluorescent-hum/room-tone packs), and other royalty-free loopable Backrooms
  ambience collections. Build the sanity-reactive layering yourself. Log every track's license.
- **Textures/models:** make **original** wallpaper/carpet/ceiling textures and an **original
  stylized entity** (inspired by the archetype, not a copied design). Use CC0 textures (e.g.
  Poly Haven) and your own work. Prefer a cohesive stylized look — it's faster *and* reads as
  deliberate art direction (helps `isFast` and `isAwardwinning`).
- Record everything in `CREDITS.md` with sources + licenses.

---

## Definition of done

- [ ] All 12 gates provably pass; values written in `RULES.md`.
- [ ] **No-holes sweep clean across many seeds:** no gaps, cracks, voids, clip-through, or
      fall-through anywhere reachable.
- [ ] 10-minute soak: flat memory, no stalls, maze endless & watertight, audio seamless.
- [ ] Full loop verified: explore → loot Almond Water → read notes → solve a puzzle → descend a
      level → entity escalation → reach an ending.
- [ ] qa-tester clean (no P0/P1); screenshots of title, each level, an entity encounter,
      low-sanity state, and an ending.
- [ ] Lighthouse ≥90 on the menu/loader; on-phone FPS verified.
- [ ] `README.md` + `CREDITS.md` + `RULES.md` present; deployed to Vercel; pushed to the repo.

**Start with Phase 0: inspect/create the repo, confirm vanilla-vs-R3F (with reasoning) and the
performance budget, web-fetch the Backrooms reference, and output the plan + maze data model +
level/objective list. Then wait for my go.**
