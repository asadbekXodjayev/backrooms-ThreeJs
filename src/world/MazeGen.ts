import { hash2, rand3 } from '../core/rng';

// ───────────────────────────────────────────────────────────────────────────
// Sealed infinite maze, watertight BY CONSTRUCTION.
//
// The world is an integer grid of cells. Floor + ceiling exist for every cell
// (continuous planes), so there is never a void underfoot or overhead. Walls
// live on cell *edges*. Whether an edge has a wall is a PURE function of the
// seed and the two cells' integer coordinates — so two neighbouring chunks
// computing the same boundary edge always get the same answer. No double walls,
// no missing walls, no seams. Collision queries this same function, so the
// collision surface is identical to the visible geometry: you can never clip a
// wall, and y is pinned to the floor so you can never fall through it.
//
// Connectivity: every cell deterministically "carves" one passage to a chosen
// neighbour (a spanning forest), guaranteeing no fully-sealed cell. "Room"
// blocks (low-frequency hash) open fully into bullpens; the rest reads as
// winding corridors and dead-ends — the liminal office feel.
// ───────────────────────────────────────────────────────────────────────────

export const CELL = 4.2;      // metres per cell
export const WALL_H = 3.0;    // ceiling height
export const WALL_THICK = 0.16;

export interface MazeParams {
  roomDensity: number;   // 0..1 fraction of coarse blocks that are open rooms
  corridorBias: number;  // 0..1 how strongly corridors run straight
  blockSize: number;     // coarse room block size in cells
  extraOpen: number;     // 0..1 extra doorways → loops + one big connected component
}

// direction encoding: 0=+x 1=-x 2=+z 3=-z
const DX = [1, -1, 0, 0];
const DZ = [0, 0, 1, -1];

export class Maze {
  constructor(public seed: number, public params: MazeParams) {}

  /** Is this coarse block an open "room"? Deterministic per block. */
  private isRoomCell(cx: number, cz: number): boolean {
    const bs = this.params.blockSize;
    const bx = Math.floor(cx / bs), bz = Math.floor(cz / bs);
    // origin block is always an open clearing so the player never spawns boxed-in
    if (bx === 0 && bz === 0) return true;
    return rand3(this.seed, bx, bz, 0xa0) < this.params.roomDensity;
  }

  /** The single passage each cell carves, as a direction 0..3. */
  private carveDir(cx: number, cz: number): number {
    const r = rand3(this.seed, cx, cz, 0xC1);
    // corridor bias: in non-room cells, prefer to continue along the block's
    // dominant axis to produce long straight runs instead of a jittery maze.
    const bias = this.params.corridorBias;
    if (bias > 0) {
      const axisHash = hash2(this.seed ^ 0x5151, Math.floor(cx / 3), Math.floor(cz / 3)) & 1;
      if (r < bias) {
        // pick along preferred axis, sign from a sub-hash
        const sign = (hash2(this.seed, cx, cz) >>> 3) & 1;
        return axisHash === 0 ? (sign ? 0 : 1) : (sign ? 2 : 3);
      }
    }
    return Math.floor(r * 4) & 3;
  }

  /** Carve constant kept distinct from room/axis hashes. */

  /** Whether the two adjacent cells are separated by a wall. Pure + symmetric. */
  wallBetween(ax: number, az: number, bx: number, bz: number): boolean {
    // open if either cell carved toward the other
    const da = this.carveDir(ax, az);
    if (ax + DX[da] === bx && az + DZ[da] === bz) return false;
    const db = this.carveDir(bx, bz);
    if (bx + DX[db] === ax && bz + DZ[db] === az) return false;
    // open if both are room cells (bullpens, and rooms merge across blocks)
    if (this.isRoomCell(ax, az) && this.isRoomCell(bx, bz)) return false;
    // extra doorways: keyed by a canonical per-edge id so it stays symmetric.
    // This pushes the open-edge fraction past the percolation threshold, so the
    // origin lives in one big connected component (no trapped pockets).
    let ex: number, ez: number, axis: number;
    if (az === bz) { axis = 0; ez = az; ex = Math.min(ax, bx); }
    else { axis = 1; ex = ax; ez = Math.min(az, bz); }
    if (rand3(this.seed ^ 0x51ed, ex, ez * 2 + axis, 0x5b) < this.params.extraOpen) return false;
    return true;
  }

  /** Wall on the -x face of cell (between cx-1,cz and cx,cz). */
  wallWest(cx: number, cz: number): boolean {
    return this.wallBetween(cx - 1, cz, cx, cz);
  }
  /** Wall on the -z face of cell (between cx,cz-1 and cx,cz). */
  wallNorth(cx: number, cz: number): boolean {
    return this.wallBetween(cx, cz - 1, cx, cz);
  }

  /** Is the world coordinate inside a wall column? (used for spawn/sanity checks) */
  cellOf(wx: number, wz: number): { cx: number; cz: number } {
    return { cx: Math.floor(wx / CELL), cz: Math.floor(wz / CELL) };
  }

  worldCenter(cx: number, cz: number): { x: number; z: number } {
    return { x: (cx + 0.5) * CELL, z: (cz + 0.5) * CELL };
  }
}
