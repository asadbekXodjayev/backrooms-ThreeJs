import * as THREE from 'three';
import { Engine } from '../core/Engine';
import { Input } from '../core/input';
import { Maze } from '../world/MazeGen';
import { ChunkManager } from '../world/ChunkManager';
import { Controller } from '../player/Controller';
import { Flashlight } from '../player/Flashlight';
import { LEVELS, LevelDef } from './Levels';
import { bus } from '../core/events';
import { AudioEngine } from '../audio/AudioEngine';
import { PostFX } from '../fx/post';
import { ItemManager } from './Items';
import { Entity } from './Entity';
import { ENDINGS } from './Story';
import { randomSeed } from '../core/rng';
import type { HUD } from '../ui/HUD';
import type { Journal, NoteData } from '../ui/Journal';

export type GameMode = 'menu' | 'play' | 'paused';

export interface GameUI {
  hud: HUD;
  journal: Journal;
  openNote: (n: NoteData) => void;
  fadeTransition: (cb: () => void) => void;
}

/**
 * Top-level orchestrator. Owns the engine, the streamed world, the player,
 * audio, post-fx, sanity, items/missions and the entity. Sanity is the master
 * conductor: one value drives fog, grain/VHS, hum detune, heartbeat, flicker,
 * and entity aggression.
 */
export class Game {
  engine: Engine;
  input: Input;
  controller: Controller;
  flashlight!: Flashlight;
  cm!: ChunkManager;
  maze!: Maze;
  hemi: THREE.HemisphereLight;
  items: ItemManager;
  entity: Entity | null = null;

  mode: GameMode = 'menu';
  seed = 1;
  levelIndex = 0;
  level!: LevelDef;

  battery = 1;
  sanity = 1;
  codesFound = new Set<string>();

  private flickerVal = 1;
  private buzzT = 0;
  private introTimer = 0;
  private transitioning = false;
  private endingTriggered = false;

  onUpdate: ((dt: number, elapsed: number) => void) | null = null;
  renderFn: (() => void) | null = null;
  audio: AudioEngine | null = null;
  post: PostFX | null = null;
  ui: GameUI | null = null;

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.input = new Input(this.engine.renderer.domElement);
    this.controller = new Controller(this.engine.scene, this.engine.prefersReducedMotion);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x0a0a06, 0.4);
    this.engine.scene.add(this.hemi);

    this.audio = new AudioEngine(this.engine.prefersReducedMotion);
    this.post = new PostFX(this.engine.renderer, this.engine.scene, this.engine.camera, this.engine.tier, this.engine.prefersReducedMotion);
    this.items = new ItemManager(this.engine.scene);

    this.renderFn = () => this.post!.render();

    this.controller.onFootstep = (sprint) => { if (this.mode === 'play') this.audio?.footstep(sprint); };

    this.engine.onUpdate((dt, elapsed) => this.tick(dt, elapsed));
    this.engine.setRenderFn(() => {
      if (this.renderFn) this.renderFn();
      else this.engine.renderer.render(this.engine.scene, this.engine.camera);
    });

    this.engine.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'play' && !this.input.locked) this.input.requestPointerLock();
    });

    bus.on('quality:change', ({ tier }) => {
      this.post?.setTier(tier as 0 | 1 | 2 | 3);
      this.cm?.setRadius(tier >= 3 ? 3 : 2);
      this.flashlight?.setShadow(tier >= 2);
    });
  }

  loadLevel(index: number, seed: number) {
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.seed = seed;
    this.endingTriggered = false;

    if (index === 0) { this.sanity = 1; this.battery = 1; this.codesFound.clear(); }

    if (this.cm) this.cm.dispose(this.engine.scene);
    this.maze = new Maze(seed ^ (index * 0x9e3779b1), this.level.maze);
    const aniso = this.engine.renderer.capabilities.getMaxAnisotropy();
    this.cm = new ChunkManager(this.engine.scene, this.maze, this.level.palette, Math.min(aniso, 8));
    this.cm.setRadius(this.engine.tier >= 3 ? 3 : 2);

    const fog = this.engine.scene.fog as THREE.FogExp2;
    fog.color.setHex(this.level.palette.fog);
    fog.density = this.level.fogDensity;
    this.engine.scene.background = new THREE.Color(this.level.palette.fog);
    // sky term = the warm fluorescent colour so the static maze reads as "lit by
    // the panels" without paying for real lights; ground term = the fog colour.
    this.hemi.color.setHex(this.level.palette.light);
    this.hemi.groundColor.setHex(this.level.palette.ambient);
    this.hemi.intensity = this.level.ambient;
    this.cm.panelMaterial.emissive.setHex(this.level.palette.light);

    if (!this.flashlight) this.flashlight = new Flashlight(this.engine.scene, this.engine.tier >= 2);
    else { this.flashlight.setShadow(this.engine.tier >= 2); this.flashlight.on = true; }

    const spawn = this.cm.spawnPoint();
    this.controller.teleport(spawn.x, spawn.z, 0);

    // items + entity
    this.items.buildForLevel(this);
    const stage = this.level.entityStageStart as 0 | 1 | 2 | 3;
    if (!this.entity) this.entity = new Entity(this.engine.scene, this.maze, this.engine.prefersReducedMotion);
    else this.entity.setMaze(this.maze);
    this.entity.reset(stage);

    bus.emit('level:enter', { index, name: this.level.name });
  }

  enterPlay() {
    this.mode = 'play';
    this.input.enable();
    this.engine.start();
    if (!this.input.isTouch) this.input.requestPointerLock();
  }

  announceLevel() {
    this.ui?.hud.setObjective('— TRANSMISSION —', this.level.intro);
    this.introTimer = 5.2;
  }
  intro(_text: string) { this.announceLevel(); }

  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'paused';
    this.input.disable();
    document.exitPointerLock?.();
  }
  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'play';
    this.input.enable();
    if (!this.input.isTouch) this.input.requestPointerLock();
  }

  // ── progression API (called by items/entity) ───────────────────────────────
  addSanity(delta: number) {
    this.sanity = THREE.MathUtils.clamp(this.sanity + delta, 0, 1);
    bus.emit('sanity:change', { value: this.sanity });
  }

  descend() {
    if (this.transitioning) return;
    this.transitioning = true;
    const next = this.levelIndex + 1;
    bus.emit('toast', { text: 'REALITY THINS… YOU FALL THROUGH' });
    this.ui?.fadeTransition(() => {
      if (next < LEVELS.length) {
        this.loadLevel(next, randomSeed());
        this.announceLevel();
      } else {
        this.reachEnding('good');
      }
      this.transitioning = false;
    });
  }

  openExitDoor() { this.items.spawnExitDoor(this); }

  reachEnding(kind: 'good' | 'bad_sanity') {
    if (this.endingTriggered) return;
    this.endingTriggered = true;
    const e = kind === 'good' ? ENDINGS.good : ENDINGS.bad_sanity;
    bus.emit('ending', { kind: kind === 'good' ? 'good' : 'bad', title: e.title, body: e.body });
  }

  private tick(dt: number, elapsed: number) {
    this.input.update();

    if (this.input.state.povPressed) this.controller.toggleThirdPerson();
    if (this.input.state.flashlightPressed) {
      const on = this.flashlight.toggle();
      this.audio?.click();
      bus.emit('flashlight:toggle', { on });
    }

    const playing = this.mode === 'play';
    this.controller.update(dt, this.input, this.cm, this.engine.camera, playing);
    this.cm.update(this.controller.pos.x, this.controller.pos.z);

    // ── sanity: the master conductor ──────────────────────────────────────────
    const nearEntity = this.entity?.proximity ?? 0;
    if (playing) {
      // battery
      if (this.flashlight.on && this.battery > 0) this.battery = Math.max(0, this.battery - dt * 0.011);
      // sanity drain
      let drain = 0.0035;
      if (!this.flashlight.on || this.battery <= 0) drain += 0.013;
      drain += nearEntity * 0.045;
      this.sanity = Math.max(0, this.sanity - drain * dt);
      if (this.sanity <= 0) this.reachEnding('bad_sanity');
    }

    // flicker — sanity intensifies dropouts
    this.buzzT += dt;
    const reduce = this.engine.prefersReducedMotion;
    const dropChance = 0.005 + (1 - this.sanity) * 0.02;
    const base = reduce ? 1 : (0.86 + 0.14 * Math.sin(this.buzzT * 9.3) + (Math.random() < dropChance ? -0.6 : 0));
    this.flickerVal += (base - this.flickerVal) * 0.5;
    this.cm.setFlicker(THREE.MathUtils.clamp(this.flickerVal * this.level.lightIntensity, 0, 3));

    this.flashlight.update(this.engine.camera, this.battery, reduce ? 1 : (0.92 + 0.08 * Math.sin(this.buzzT * 30)));

    // fog breathes denser as sanity falls
    const fog = this.engine.scene.fog as THREE.FogExp2;
    fog.density = this.level.fogDensity * (1 + (1 - this.sanity) * 0.25);

    // items + entity
    if (playing) {
      this.items.update(dt, this);
      this.entity?.update(dt, this);
    }

    // audio + post react to sanity
    this.audio?.setSanity(this.sanity);
    this.audio?.update(dt, { moving: this.controller.moving, sprint: this.input.state.sprint && this.controller.speed > 3, nearEntity });
    this.post?.setSanity(this.sanity);
    this.post?.update(dt);

    // transmission → objective handoff
    if (this.introTimer > 0) {
      this.introTimer -= dt;
      if (this.introTimer <= 0 && this.mode === 'play') {
        this.ui?.hud.setObjective(this.level.objectiveTag, this.level.objective);
      }
    }

    this.onUpdate?.(dt, elapsed);
  }
}
