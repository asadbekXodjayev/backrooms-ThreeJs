import * as THREE from 'three';
import { Maze, CELL } from '../world/MazeGen';
import { bus } from '../core/events';
import type { Game } from './Game';

// An original stylized stalker — "wire-thin, wrong, like a person drawn from a
// description." It escalates in stages: first you only HEAR it, then you GLIMPSE
// it at the end of halls (and it's gone the moment you look), then it PURSUES in
// the dark / when sanity is low / when you linger. Rare and atmospheric, never a
// constant action threat. Hide: crouch, break line of sight, keep your light up.

type Stage = 0 | 1 | 2 | 3;

const DX = [1, -1, 0, 0];
const DZ = [0, 0, 1, -1];

export class Entity {
  group = new THREE.Group();
  proximity = 0;     // 0..1 fear factor exported to audio/sanity
  private maze: Maze;
  private active = false;
  private pos = new THREE.Vector3();
  private targetCell = { cx: 0, cz: 0 };
  private stage: Stage = 0;
  private aggression = 0;
  private lingerT = 0;
  private spawnCooldown = 6;
  private heardT = 5;
  private caughtCooldown = 0;
  private reduced: boolean;

  constructor(scene: THREE.Scene, maze: Maze, reducedMotion: boolean) {
    this.maze = maze;
    this.reduced = reducedMotion;
    this.buildFigure();
    this.group.visible = false;
    scene.add(this.group);
  }

  setMaze(maze: Maze) { this.maze = maze; }
  setStage(s: Stage) { this.stage = s; if (s === 0) this.despawn(); }
  reset(stage: Stage) {
    this.stage = stage; this.active = false; this.group.visible = false;
    this.aggression = 0; this.proximity = 0; this.spawnCooldown = 6; this.heardT = 5;
  }

  private buildFigure() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x05050a, roughness: 1, metalness: 0, emissive: 0x070710, emissiveIntensity: 0.25 });
    const limb = (h: number, r: number) => new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, h, 5), mat);
    const torso = limb(1.5, 0.05); torso.position.y = 1.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat); head.position.y = 2.32; head.scale.set(0.8, 1.3, 0.8);
    const armL = limb(1.3, 0.035); armL.position.set(-0.12, 1.55, 0); armL.rotation.z = 0.12;
    const armR = limb(1.3, 0.035); armR.position.set(0.12, 1.55, 0); armR.rotation.z = -0.12;
    const legL = limb(1.5, 0.04); legL.position.set(-0.08, 0.75, 0);
    const legR = limb(1.5, 0.04); legR.position.set(0.08, 0.75, 0);
    this.group.add(torso, head, armL, armR, legL, legR);
    this.group.userData = { armL, armR, legL, legR };
  }

  private cellOf(x: number, z: number) { return { cx: Math.floor(x / CELL), cz: Math.floor(z / CELL) }; }

  private spawnNear(px: number, pz: number, dist: number) {
    const a = Math.random() * Math.PI * 2;
    const cx = Math.round((px + Math.cos(a) * dist) / CELL);
    const cz = Math.round((pz + Math.sin(a) * dist) / CELL);
    this.pos.set((cx + 0.5) * CELL, 0, (cz + 0.5) * CELL);
    this.targetCell = { cx, cz };
    this.active = true;
    this.group.visible = true;
  }

  private despawn() {
    this.active = false;
    this.group.visible = false;
  }

  /** Greedy step toward the player through open cells. */
  private stepToward(px: number, pz: number, dt: number, speed: number) {
    const here = this.cellOf(this.pos.x, this.pos.z);
    const tc = this.targetCell;
    const targetX = (tc.cx + 0.5) * CELL, targetZ = (tc.cz + 0.5) * CELL;
    const dx = targetX - this.pos.x, dz = targetZ - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) {
      // choose next cell toward player among open neighbours
      let best = -1, bestScore = Infinity;
      for (let dir = 0; dir < 4; dir++) {
        const nx = here.cx + DX[dir], nz = here.cz + DZ[dir];
        if (this.maze.wallBetween(here.cx, here.cz, nx, nz)) continue;
        const score = Math.hypot((nx + 0.5) * CELL - px, (nz + 0.5) * CELL - pz) + Math.random() * 0.6;
        if (score < bestScore) { bestScore = score; best = dir; }
      }
      if (best >= 0) this.targetCell = { cx: here.cx + DX[best], cz: here.cz + DZ[best] };
    } else {
      this.pos.x += (dx / d) * speed * dt;
      this.pos.z += (dz / d) * speed * dt;
    }
  }

  update(dt: number, game: Game) {
    if (this.caughtCooldown > 0) this.caughtCooldown -= dt;
    if (this.stage === 0) { this.proximity = 0; return; }

    const cam = game.engine.camera;
    const px = game.controller.pos.x, pz = game.controller.pos.z;

    // ── fear/aggression model ────────────────────────────────────────────────
    const dark = game.flashlight.on ? 0 : 0.5;
    const lowSanity = 1 - game.sanity;
    if (!game.controller.moving) this.lingerT += dt; else this.lingerT = Math.max(0, this.lingerT - dt * 2);
    const linger = Math.min(1, this.lingerT / 8);
    const crouchHide = game.controller.crouching && !game.controller.moving ? 0.5 : 0;
    const baseStage = this.stage / 3;
    // difficulty scales the drive to hunt; crouching stays a flat hide bonus
    const drive = (0.25 * baseStage + 0.4 * dark + 0.4 * lowSanity + 0.25 * linger) * game.diff.entityAggroMult;
    this.aggression = THREE.MathUtils.clamp(drive - crouchHide, 0, 1);

    // ── stage 1: heard only ──────────────────────────────────────────────────
    if (this.stage === 1) {
      this.heardT -= dt;
      if (this.heardT <= 0) {
        if (Math.random() < 0.5) { game.audio?.footstep(false); }
        else if (Math.random() < 0.3 && !this.reduced) game.audio?.stinger(0.3);
        this.heardT = 6 + Math.random() * 10;
      }
      this.proximity = 0.2 + this.aggression * 0.2;
      return;
    }

    // ── spawning ─────────────────────────────────────────────────────────────
    if (!this.active) {
      this.spawnCooldown -= dt * (0.5 + this.aggression);
      if (this.spawnCooldown <= 0) {
        const baseDist = this.stage >= 3 && this.aggression > 0.6 ? 7 : 12;
        this.spawnNear(px, pz, baseDist * game.diff.entitySpawnDistanceMult);
        if (!this.reduced) game.audio?.stinger(0.4 + this.aggression * 0.4);
        this.spawnCooldown = 10 + Math.random() * 10;
      }
      this.proximity = 0.15 + this.aggression * 0.2;
      return;
    }

    // ── active behaviour ───────────────────────────────────────────────────────
    const dxp = this.pos.x - px, dzp = this.pos.z - pz;
    const dist = Math.hypot(dxp, dzp);
    this.proximity = THREE.MathUtils.clamp(1 - dist / 14, 0, 1);

    // is the player looking at it (roughly) and lighting it?
    const viewDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const toEnt = new THREE.Vector3(dxp, 0, dzp).normalize();
    const looking = viewDir.dot(toEnt) > 0.8;
    const lit = game.flashlight.on && dist < 9 && looking;

    const pursue = this.stage >= 3 && this.aggression > 0.45;

    if (this.stage === 2 || !pursue) {
      // GLIMPSE mode: lurk at distance; vanish if seen clearly or approached
      if ((looking && dist < 11) || dist < 4) {
        this.despawn();
        if (!this.reduced) game.audio?.drip();
        this.spawnCooldown = 8 + Math.random() * 8;
      }
    } else {
      // PURSUE mode
      if (lit) {
        // freezes / edges back when you light it and look at it
        this.stepToward(px + dxp * 3, pz + dzp * 3, dt, 0.6); // move away
      } else {
        const speed = 1.4 + this.aggression * 2.2; // up to ~3.6 (< sprint 4.7)
        this.stepToward(px, pz, dt, speed);
      }
      if (dist < 1.3 && this.caughtCooldown <= 0) this.catch(game);
    }

    // face & animate
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.lookAt(px, 0, pz);
    const t = performance.now() / 1000;
    const sway = Math.sin(t * 6) * (this.proximity > 0.4 ? 0.4 : 0.1);
    (this.group.userData.legL as THREE.Object3D).rotation.x = sway;
    (this.group.userData.legR as THREE.Object3D).rotation.x = -sway;
    (this.group.userData.armL as THREE.Object3D).rotation.x = -sway * 0.6;
    (this.group.userData.armR as THREE.Object3D).rotation.x = sway * 0.6;
  }

  private catch(game: Game) {
    this.caughtCooldown = 3;
    if (!this.reduced) game.audio?.stinger(1);
    game.addSanity(-0.4);
    bus.emit('toast', { text: 'IT TOUCHED YOU' });
    bus.emit('entity:stinger', {});
    // it recoils away after a strike
    this.spawnNear(game.controller.pos.x, game.controller.pos.z, 16);
    this.despawn();
    this.spawnCooldown = 8;
  }

  dispose(scene: THREE.Scene) {
    this.group.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); });
    scene.remove(this.group);
  }
}
