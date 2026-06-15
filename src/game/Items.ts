import * as THREE from 'three';
import { CELL } from '../world/MazeGen';
import { rand3 } from '../core/rng';
import { NOTES_BY_LEVEL } from './Story';
import { bus } from '../core/events';
import type { Game } from './Game';

export interface Interactable {
  obj: THREE.Object3D;
  x: number; z: number;
  range: number;
  done: boolean;
  hidden?: boolean;
  isExit?: boolean; // re-anchors near the player if they wander too far
  baseY?: number;
  prompt(game: Game): string | null;
  interact(game: Game): void;
  tick?(dt: number, t: number): void;
}

const VALVE_COLORS = ['red', 'blue', 'green'] as const;
const VALVE_HEX = { red: 0xb5462f, blue: 0x3f6fb5, green: 0x3fb56a };

/**
 * Spawns and manages every interactable in the current level: Almond Water,
 * batteries, lore notes, and the level's exit (anomaly / vent / valve puzzle).
 * Handles the proximity prompt and the E-to-interact flow.
 */
export class ItemManager {
  group = new THREE.Group();
  private items: Interactable[] = [];
  private t = 0;
  private reanchorCD = 0;
  private reanchorN = 0;
  valvesTurned = 0;

  constructor(private scene: THREE.Scene) { scene.add(this.group); }

  buildForLevel(game: Game) {
    this.clear();
    this.valvesTurned = 0;
    const lvl = game.level;
    const seed = game.maze.seed;
    const used = new Set<string>();

    // Flood-fill the connected component from spawn so EVERY item — especially
    // the exit — is provably reachable. Bucket reachable cells by ring distance.
    const reachable = this.reachableCells(game, 34);
    const byRing: { cx: number; cz: number; r: number }[] = [];
    for (const k of reachable) {
      const [cx, cz] = k.split(',').map(Number);
      byRing.push({ cx, cz, r: Math.hypot(cx, cz) });
    }

    const placeCell = (k: number, minR: number, maxR: number): { x: number; z: number } => {
      const candidates = byRing.filter(c => c.r >= minR && c.r <= maxR && !used.has(`${c.cx},${c.cz}`) && !(c.cx === 0 && c.cz === 0));
      if (candidates.length === 0) {
        // widen if the ring is empty
        const wide = byRing.filter(c => !used.has(`${c.cx},${c.cz}`) && !(c.cx === 0 && c.cz === 0));
        if (wide.length === 0) return { x: 1.5 * CELL, z: 0.5 * CELL };
        const c = wide[Math.floor(rand3(seed, k, 1, 0x33) * wide.length)];
        used.add(`${c.cx},${c.cz}`);
        return { x: (c.cx + 0.5) * CELL, z: (c.cz + 0.5) * CELL };
      }
      const c = candidates[Math.floor(rand3(seed, k, 2, 0x44) * candidates.length)];
      used.add(`${c.cx},${c.cz}`);
      return { x: (c.cx + 0.5) * CELL, z: (c.cz + 0.5) * CELL };
    };

    // Almond Water
    for (let i = 0; i < lvl.almondWater; i++) {
      const p = placeCell(100 + i, 2, 22);
      this.items.push(this.makeAlmond(p.x, p.z));
    }
    // Batteries
    for (let i = 0; i < lvl.batteries; i++) {
      const p = placeCell(200 + i, 3, 24);
      this.items.push(this.makeBattery(p.x, p.z));
    }
    // Notes
    const notes = NOTES_BY_LEVEL[game.levelIndex] ?? [];
    for (let i = 0; i < notes.length; i++) {
      const p = placeCell(300 + i, 2, 20);
      this.items.push(this.makeNote(p.x, p.z, notes[i].id, game.levelIndex));
    }

    // Exit — placed a short search away; re-anchors near the player if they roam
    if (lvl.exit === 'anomaly') {
      const p = placeCell(900, 8, 12);
      this.items.push(this.makeAnomaly(p.x, p.z));
    } else if (lvl.exit === 'vent') {
      const p = placeCell(900, 8, 12);
      this.items.push(this.makeVent(p.x, p.z));
    } else {
      // three valves spread out + the exit door
      for (let i = 0; i < 3; i++) {
        const p = placeCell(910 + i, 7, 14);
        this.items.push(this.makeValve(p.x, p.z, VALVE_COLORS[i]));
      }
    }
  }

  /** Pick a reachable cell a few steps from a centre cell (graph distance). */
  private pickReachableNear(game: Game, ccx: number, ccz: number, minSteps: number, maxSteps: number) {
    const DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];
    const m = game.maze;
    const start = `${ccx},${ccz}`;
    const depth = new Map<string, number>([[start, 0]]);
    const q: [number, number][] = [[ccx, ccz]];
    const hits: { cx: number; cz: number }[] = [];
    while (q.length) {
      const [cx, cz] = q.shift()!;
      const d = depth.get(`${cx},${cz}`)!;
      if (d >= minSteps && d <= maxSteps) hits.push({ cx, cz });
      if (d >= maxSteps) continue;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k], nz = cz + DZ[k];
        const key = `${nx},${nz}`;
        if (depth.has(key)) continue;
        if (!m.wallBetween(cx, cz, nx, nz)) { depth.set(key, d + 1); q.push([nx, nz]); }
      }
    }
    if (hits.length === 0) return { cx: ccx, cz: ccz };
    this.reanchorN = (this.reanchorN + 1) % hits.length;
    return hits[this.reanchorN];
  }

  /** BFS over open edges from the spawn cell, bounded to a radius window. */
  private reachableCells(game: Game, radius: number): Set<string> {
    const DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];
    const m = game.maze;
    const seen = new Set<string>(['0,0']);
    const stack: [number, number][] = [[0, 0]];
    while (stack.length) {
      const [cx, cz] = stack.pop()!;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], nz = cz + DZ[d];
        if (Math.abs(nx) > radius || Math.abs(nz) > radius) continue;
        const k = `${nx},${nz}`;
        if (seen.has(k)) continue;
        if (!m.wallBetween(cx, cz, nx, nz)) { seen.add(k); stack.push([nx, nz]); }
      }
    }
    return seen;
  }

  // ── factories ──────────────────────────────────────────────────────────────
  private floatObj(obj: THREE.Object3D, baseY: number) {
    obj.userData.baseY = baseY;
  }

  private makeAlmond(x: number, z: number): Interactable {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xdfe8ea, roughness: 0.3, transparent: true, opacity: 0.85, emissive: 0x223a44, emissiveIntensity: 0.6 }),
    );
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x8aa6b0 }));
    cap.position.y = 0.135; g.add(body, cap);
    g.position.set(x, 0.55, z);
    this.floatObj(g, 0.55); g.traverse(o => (o as THREE.Mesh).castShadow = true);
    this.group.add(g);
    return {
      obj: g, x, z, range: 1.9, done: false,
      prompt: () => 'E · DRINK ALMOND WATER',
      interact: (game) => { game.addSanity(0.35); bus.emit('item:pickup', { kind: 'almond', label: 'ALMOND WATER (+SANITY)' }); this.remove(g); },
      tick: (_dt, t) => { g.position.y = 0.55 + Math.sin(t * 2 + x) * 0.05; g.rotation.y = t * 0.8; },
    };
  }

  private makeBattery(x: number, z: number): Interactable {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a2a1a, roughness: 0.5 }));
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0xcfe0a0, emissive: 0x3a4a10, emissiveIntensity: 0.8 }));
    tip.position.y = 0.105; g.add(body, tip);
    g.position.set(x, 0.5, z); this.floatObj(g, 0.5);
    g.traverse(o => (o as THREE.Mesh).castShadow = true);
    this.group.add(g);
    return {
      obj: g, x, z, range: 1.9, done: false,
      prompt: () => 'E · TAKE BATTERY',
      interact: (game) => { game.battery = Math.min(1, game.battery + 0.6); bus.emit('item:pickup', { kind: 'battery', label: 'BATTERY (+LIGHT)' }); this.remove(g); },
      tick: (_dt, t) => { g.rotation.y = t * 1.2; },
    };
  }

  private makeNote(x: number, z: number, noteId: string, levelIndex: number): Interactable {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x3a3320, emissiveIntensity: 0.4 }),
    );
    g.position.set(x, 1.0, z); g.rotation.y = Math.random() * Math.PI;
    this.group.add(g);
    return {
      obj: g, x, z, range: 2.0, done: false,
      prompt: () => 'E · READ NOTE',
      interact: (game) => {
        const note = (NOTES_BY_LEVEL[levelIndex] ?? []).find(n => n.id === noteId);
        if (!note) return;
        // record valve codes as they're read
        if (noteId === 'l2-1') game.codesFound.add('red');
        if (noteId === 'l2-2') game.codesFound.add('blue');
        if (noteId === 'l2-3') game.codesFound.add('green');
        bus.emit('note:pickup', { id: noteId });
        game.ui?.openNote(note);
        this.remove(g);
      },
      tick: (_dt, t) => { g.position.y = 1.0 + Math.sin(t * 1.5 + x) * 0.04; },
    };
  }

  private makeAnomaly(x: number, z: number): Interactable {
    const mat = new THREE.MeshStandardMaterial({ color: 0xc9b454, emissive: 0xfff0b0, emissiveIntensity: 1.4, roughness: 1, transparent: true, opacity: 0.85 });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), mat);
    g.position.set(x, 1.4, z);
    this.group.add(g);
    return {
      obj: g, x, z, range: 2.4, done: false, isExit: true, baseY: 1.4,
      prompt: () => 'E · PUSH THROUGH THE ANOMALY',
      interact: (game) => game.descend(),
      tick: (_dt, t) => { mat.emissiveIntensity = 1.0 + Math.sin(t * 6) * 0.6; g.rotation.y = Math.sin(t * 0.6) * 0.3; g.scale.x = 1 + Math.sin(t * 3) * 0.08; },
    };
  }

  private makeVent(x: number, z: number): Interactable {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.12), new THREE.MeshStandardMaterial({ color: 0x14140d, metalness: 0.3, roughness: 0.7 }));
    for (let i = 0; i < 5; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0x2a2a20, metalness: 0.4 }));
      bar.position.y = -0.4 + i * 0.2; frame.add(bar);
    }
    g.add(frame); g.position.set(x, 0.9, z);
    this.group.add(g);
    return {
      obj: g, x, z, range: 2.2, done: false, isExit: true, baseY: 0.9,
      prompt: () => 'E · CRAWL INTO THE VENT',
      interact: (game) => game.descend(),
    };
  }

  private makeValve(x: number, z: number, color: typeof VALVE_COLORS[number]): Interactable {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a14, roughness: 0.8 }));
    ped.position.y = 0.45;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), new THREE.MeshStandardMaterial({ color: VALVE_HEX[color], emissive: VALVE_HEX[color], emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.5 }));
    wheel.position.y = 0.95; wheel.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: VALVE_HEX[color] }));
      spoke.rotation.y = (i / 4) * Math.PI; spoke.position.y = 0.95; g.add(spoke);
    }
    g.add(ped, wheel); g.position.set(x, 0, z);
    g.traverse(o => (o as THREE.Mesh).castShadow = true);
    this.group.add(g);
    let turned = false;
    return {
      obj: g, x, z, range: 2.0, done: false,
      prompt: (game) => {
        if (turned) return null;
        return game.codesFound.has(color)
          ? `E · TURN ${color.toUpperCase()} VALVE`
          : `LOCKED · find the ${color.toUpperCase()} valve code`;
      },
      interact: (game) => {
        if (turned || !game.codesFound.has(color)) {
          if (!game.codesFound.has(color)) bus.emit('toast', { text: `THE ${color.toUpperCase()} CODE IS IN A NOTE SOMEWHERE` });
          return;
        }
        turned = true; this.valvesTurned++;
        wheel.rotation.z += Math.PI / 2;
        (wheel.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2;
        game.audio?.click();
        bus.emit('toast', { text: `${color.toUpperCase()} VALVE OPEN · ${this.valvesTurned}/3` });
        if (this.valvesTurned >= 3) game.openExitDoor();
      },
      tick: (_dt, t) => { if (!turned) (wheel.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.sin(t * 4) * 0.2; },
    };
  }

  /** Called when all valves are turned — drops a glowing exit door to interact. */
  spawnExitDoor(game: Game) {
    const x = game.controller.pos.x, z = game.controller.pos.z - CELL * 2;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x0a0a07 }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), new THREE.MeshBasicMaterial({ color: 0xdfe0c0 }));
    glow.position.z = 0.12; frame.add(glow);
    g.add(frame); g.position.set(x, 1.3, z);
    this.group.add(g);
    this.items.push({
      obj: g, x, z, range: 2.6, done: false, isExit: true, baseY: 1.3,
      prompt: () => 'E · STEP INTO THE LIGHT',
      interact: (gm) => gm.reachEnding('good'),
      tick: (_dt, t) => { (glow.material as THREE.MeshBasicMaterial).color.setScalar(0.8 + Math.sin(t * 3) * 0.2); },
    });
    bus.emit('objective:set', { tag: 'OBJECTIVE · LEVEL 2', text: 'The door is open. Step into the light.' });
  }

  private remove(obj: THREE.Object3D) {
    const it = this.items.find(i => i.obj === obj);
    if (it) it.done = true;
    obj.visible = false;
  }

  update(dt: number, game: Game) {
    this.t += dt;
    const px = game.controller.pos.x, pz = game.controller.pos.z;

    // Re-anchor the level exit if the player has wandered too far from it, so
    // the way down/out is always findable from wherever they are.
    this.reanchorCD -= dt;
    if (this.reanchorCD <= 0) {
      this.reanchorCD = 1.2;
      const FAR = CELL * 13;   // ~"a few chunks" away
      const ccx = Math.floor(px / CELL), ccz = Math.floor(pz / CELL);
      for (const it of this.items) {
        if (!it.isExit || it.done) continue;
        if (Math.hypot(it.x - px, it.z - pz) > FAR) {
          const cell = this.pickReachableNear(game, ccx, ccz, 6, 9);
          it.x = (cell.cx + 0.5) * CELL;
          it.z = (cell.cz + 0.5) * CELL;
          it.obj.position.x = it.x;
          it.obj.position.z = it.z;
          if (it.baseY != null) it.obj.position.y = it.baseY;
          bus.emit('toast', { text: 'THE WAY OUT SHIFTS… IT IS NEAR AGAIN' });
        }
      }
    }

    let best: Interactable | null = null; let bestD = Infinity;
    for (const it of this.items) {
      it.tick?.(dt, this.t);
      if (it.done) continue;
      const d = Math.hypot(it.x - px, it.z - pz);
      if (d < it.range && d < bestD) { const pr = it.prompt(game); if (pr !== null) { best = it; bestD = d; } }
    }
    if (best) {
      game.ui?.hud.showPrompt(best.prompt(game));
      if (game.input.state.interactPressed) best.interact(game);
    } else {
      game.ui?.hud.showPrompt(null);
    }
  }

  clear() {
    for (const it of this.items) {
      it.obj.traverse(o => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose?.();
      });
      this.group.remove(it.obj);
    }
    this.items = [];
  }

  dispose() { this.clear(); this.scene.remove(this.group); }
}
