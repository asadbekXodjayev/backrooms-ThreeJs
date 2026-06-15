import * as THREE from 'three';
import { Maze, CELL, WALL_H, WALL_THICK } from './MazeGen';
import { Chunk, CHUNK, WorldAssets } from './Chunk';
import { Palette, makeWallpaperTexture, makeCarpetTexture, makeCeilingTexture } from './materials';

/**
 * Streams chunks around the player: generates ahead of the fog wall, recycles
 * behind, and pools chunk objects so memory stays flat over a long session.
 * Also owns the shared world assets (procedural textures, geometries, materials)
 * and answers collision queries straight from the maze grid.
 */
export class ChunkManager {
  group = new THREE.Group();
  maze: Maze;
  private assets: WorldAssets;
  private textures: THREE.Texture[] = [];
  private active = new Map<string, Chunk>();
  private pool: Chunk[] = [];
  radius = 3;

  constructor(scene: THREE.Scene, maze: Maze, pal: Palette, aniso: number) {
    this.maze = maze;
    scene.add(this.group);

    const wallTex = makeWallpaperTexture(pal, aniso);
    const floorTex = makeCarpetTexture(pal, aniso);
    const ceilTex = makeCeilingTexture(pal, aniso);
    this.textures.push(wallTex, floorTex, ceilTex);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92, metalness: 0.0 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0, metalness: 0.0 });
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95, metalness: 0.0 });
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x111108,
      emissive: new THREE.Color(pal.light),
      emissiveIntensity: 1.4,
      roughness: 0.6,
      toneMapped: true,
    });

    // chunk-sized plane with UVs pre-scaled so each cell gets one texture tile
    const planeGeo = new THREE.PlaneGeometry(CHUNK * CELL, CHUNK * CELL, 1, 1);
    const uv = planeGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * CHUNK, uv.getY(i) * CHUNK);
    uv.needsUpdate = true;

    const wallGeo = new THREE.BoxGeometry(1, 1, 1);
    const panelGeo = new THREE.PlaneGeometry(1, 1, 1, 1);

    this.assets = { wallMat, floorMat, ceilMat, panelMat, wallGeo, panelGeo, planeGeo };
  }

  get panelMaterial() { return this.assets.panelMat; }

  /** Stream chunks so the built area always extends past the fog wall. */
  update(px: number, pz: number) {
    const pcx = Math.floor(px / (CHUNK * CELL));
    const pcz = Math.floor(pz / (CHUNK * CELL));

    // mark wanted set
    const wanted = new Set<string>();
    for (let dz = -this.radius; dz <= this.radius; dz++) {
      for (let dx = -this.radius; dx <= this.radius; dx++) {
        const cx0 = (pcx + dx) * CHUNK;
        const cz0 = (pcz + dz) * CHUNK;
        wanted.add(`${cx0},${cz0}`);
      }
    }

    // recycle chunks no longer wanted
    for (const [key, ch] of this.active) {
      if (!wanted.has(key)) {
        ch.release();
        this.active.delete(key);
        this.pool.push(ch);
      }
    }

    // build missing
    for (const key of wanted) {
      if (this.active.has(key)) continue;
      const [cx0, cz0] = key.split(',').map(Number);
      const ch = this.pool.pop() ?? this.makeChunk();
      ch.build(cx0, cz0);
      this.active.set(key, ch);
    }
  }

  private makeChunk(): Chunk {
    const ch = new Chunk(this.maze, this.assets);
    this.group.add(ch.group);
    return ch;
  }

  setFlicker(intensity: number) {
    this.assets.panelMat.emissiveIntensity = intensity;
  }

  // ── collision ───────────────────────────────────────────────────────────
  // 2D circle vs axis-aligned wall AABBs, read live from the maze grid (so the
  // collision surface always matches the rendered walls). y is pinned to the
  // floor by the controller, which makes fall-through impossible by design.
  resolveCollision(x: number, z: number, radius: number): { x: number; z: number } {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const t = WALL_THICK / 2 + 0.001;

    for (let iter = 0; iter < 2; iter++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ccx = cx + dx, ccz = cz + dz;
          // west wall of (ccx,ccz): AABB centred on x=ccx*CELL
          if (this.maze.wallWest(ccx, ccz)) {
            const r = this.pushOut(x, z, radius, ccx * CELL - t, ccz * CELL, ccx * CELL + t, (ccz + 1) * CELL);
            x = r.x; z = r.z;
          }
          // north wall of (ccx,ccz): AABB centred on z=ccz*CELL
          if (this.maze.wallNorth(ccx, ccz)) {
            const r = this.pushOut(x, z, radius, ccx * CELL, ccz * CELL - t, (ccx + 1) * CELL, ccz * CELL + t);
            x = r.x; z = r.z;
          }
        }
      }
    }
    return { x, z };
  }

  private pushOut(x: number, z: number, radius: number, minX: number, minZ: number, maxX: number, maxZ: number) {
    // closest point on AABB to circle centre
    const qx = Math.max(minX, Math.min(x, maxX));
    const qz = Math.max(minZ, Math.min(z, maxZ));
    let nx = x - qx, nz = z - qz;
    const d2 = nx * nx + nz * nz;
    if (d2 >= radius * radius) return { x, z };
    let d = Math.sqrt(d2);
    if (d < 1e-5) {
      // centre inside the AABB: push along the shallowest axis
      const toMinX = x - minX, toMaxX = maxX - x;
      const toMinZ = z - minZ, toMaxZ = maxZ - z;
      const mx = Math.min(toMinX, toMaxX), mz = Math.min(toMinZ, toMaxZ);
      if (mx < mz) { nx = (toMinX < toMaxX ? -1 : 1); nz = 0; }
      else { nx = 0; nz = (toMinZ < toMaxZ ? -1 : 1); }
      d = 0.0001;
    } else { nx /= d; nz /= d; }
    const push = radius - d;
    return { x: x + nx * push, z: z + nz * push };
  }

  /** A guaranteed-open spawn point: centre of origin cell (origin block is a room). */
  spawnPoint(): { x: number; z: number } {
    return { x: 0.5 * CELL, z: 0.5 * CELL };
  }

  ceilingY() { return WALL_H; }

  setRadius(r: number) { this.radius = r; }

  dispose(scene: THREE.Scene) {
    for (const ch of this.active.values()) ch.dispose();
    for (const ch of this.pool) ch.dispose();
    this.active.clear(); this.pool.length = 0;
    scene.remove(this.group);
    this.assets.wallGeo.dispose();
    this.assets.panelGeo.dispose();
    this.assets.planeGeo.dispose();
    (this.assets.wallMat as THREE.Material).dispose();
    (this.assets.floorMat as THREE.Material).dispose();
    (this.assets.ceilMat as THREE.Material).dispose();
    this.assets.panelMat.dispose();
    for (const t of this.textures) t.dispose();
    this.textures.length = 0;
  }
}
