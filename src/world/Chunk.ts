import * as THREE from 'three';
import { Maze, CELL, WALL_H, WALL_THICK } from './MazeGen';
import { rand3 } from '../core/rng';

export const CHUNK = 5; // cells per side
export const CHUNK_SIZE = CHUNK * CELL;

export interface WorldAssets {
  wallMat: THREE.Material;
  floorMat: THREE.Material;
  ceilMat: THREE.Material;
  panelMat: THREE.MeshStandardMaterial;
  wallGeo: THREE.BoxGeometry;
  panelGeo: THREE.PlaneGeometry;
  planeGeo: THREE.PlaneGeometry; // chunk-sized, UV pre-scaled to CHUNK
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/**
 * One streamed chunk: a continuous floor + ceiling plane, an InstancedMesh of
 * wall segments, and an InstancedMesh of emissive ceiling light panels. Built
 * from the Maze's pure wall function, so every chunk is watertight and seams
 * with its neighbours align exactly on the integer grid.
 */
export class Chunk {
  group = new THREE.Group();
  private floor: THREE.Mesh;
  private ceil: THREE.Mesh;
  private walls: THREE.InstancedMesh;
  private panels: THREE.InstancedMesh;
  cx0 = 0; cz0 = 0;
  key = '';
  inUse = false;

  constructor(private maze: Maze, a: WorldAssets) {
    const maxWalls = 2 * CHUNK * CHUNK + 2 * CHUNK; // west+north per cell + slack
    const maxPanels = CHUNK * CHUNK;

    this.floor = new THREE.Mesh(a.planeGeo, a.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;

    this.ceil = new THREE.Mesh(a.planeGeo, a.ceilMat);
    this.ceil.rotation.x = Math.PI / 2;
    this.ceil.position.y = WALL_H;

    this.walls = new THREE.InstancedMesh(a.wallGeo, a.wallMat, maxWalls);
    this.walls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.walls.castShadow = true;
    this.walls.receiveShadow = true;
    this.walls.frustumCulled = false;

    this.panels = new THREE.InstancedMesh(a.panelGeo, a.panelMat, maxPanels);
    this.panels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.panels.frustumCulled = false;

    this.group.add(this.floor, this.ceil, this.walls, this.panels);
  }

  build(cx0: number, cz0: number) {
    this.cx0 = cx0; this.cz0 = cz0;
    this.key = `${cx0},${cz0}`;
    this.inUse = true;

    const m = this.maze;
    const halfX = (cx0 + CHUNK / 2) * CELL;
    const halfZ = (cz0 + CHUNK / 2) * CELL;
    this.floor.position.set(halfX, 0, halfZ);
    this.ceil.position.set(halfX, WALL_H, halfZ);

    let wi = 0, pi = 0;
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const cx = cx0 + lx, cz = cz0 + lz;

        // West wall (−x face): owned by this cell
        if (m.wallWest(cx, cz)) {
          _p.set(cx * CELL, WALL_H / 2, (cz + 0.5) * CELL);
          _s.set(WALL_THICK, WALL_H, CELL);
          _m.compose(_p, _q.identity(), _s);
          this.walls.setMatrixAt(wi++, _m);
        }
        // North wall (−z face): owned by this cell
        if (m.wallNorth(cx, cz)) {
          _p.set((cx + 0.5) * CELL, WALL_H / 2, cz * CELL);
          _s.set(CELL, WALL_H, WALL_THICK);
          _m.compose(_p, _q.identity(), _s);
          this.walls.setMatrixAt(wi++, _m);
        }
        // ceiling light panel on ~65% of cells (deterministic)
        if (rand3(m.seed, cx, cz, 0x9e) < 0.65) {
          _p.set((cx + 0.5) * CELL, WALL_H - 0.04, (cz + 0.5) * CELL);
          _s.set(CELL * 0.62, 1, CELL * 0.18);
          // panel quad faces down: rotate -90° about X
          _q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
          _m.compose(_p, _q, _s);
          this.panels.setMatrixAt(pi++, _m);
        }
      }
    }
    _q.identity();
    this.walls.count = wi;
    this.panels.count = pi;
    this.walls.instanceMatrix.needsUpdate = true;
    this.panels.instanceMatrix.needsUpdate = true;
    this.walls.computeBoundingSphere();
    this.group.visible = true;
  }

  release() {
    this.inUse = false;
    this.group.visible = false;
  }

  dispose() {
    this.walls.dispose();
    this.panels.dispose();
    // shared geos/mats disposed by ChunkManager
  }
}
