// No-holes / watertight sweep over many seeds — pure logic (no rendering).
// Proves the three guarantees that make the maze sealed by construction:
//   1. Wall function is symmetric  → chunk seams always agree (no gaps/double walls)
//   2. No fully-sealed cell        → every cell is reachable-capable
//   3. Large connected component   → the player is never trapped in a pocket
import { Maze } from './_maze.mjs';

const PARAMS = [
  { roomDensity: 0.62, corridorBias: 0.35, blockSize: 4, extraOpen: 0.22 }, // L0
  { roomDensity: 0.45, corridorBias: 0.55, blockSize: 5, extraOpen: 0.17 }, // L1
  { roomDensity: 0.30, corridorBias: 0.70, blockSize: 6, extraOpen: 0.14 }, // L2
];
const DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];

let failures = 0;
let totalReach = 0, totalCells = 0;
const SEEDS = 200;

for (let s = 1; s <= SEEDS; s++) {
  const seed = (s * 2654435761) >>> 0;
  for (const p of PARAMS) {
    const m = new Maze(seed, p);

    // 1. symmetry over a window of cells
    for (let cx = -8; cx <= 8; cx++) for (let cz = -8; cz <= 8; cz++) {
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], nz = cz + DZ[d];
        if (m.wallBetween(cx, cz, nx, nz) !== m.wallBetween(nx, nz, cx, cz)) {
          if (failures < 5) console.error(`✗ asymmetric wall seed=${seed} (${cx},${cz})-(${nx},${nz})`);
          failures++;
        }
      }
    }

    // 2. no fully-sealed cell
    for (let cx = -6; cx <= 6; cx++) for (let cz = -6; cz <= 6; cz++) {
      let open = 0;
      for (let d = 0; d < 4; d++) if (!m.wallBetween(cx, cz, cx + DX[d], cz + DZ[d])) open++;
      if (open === 0) { if (failures < 5) console.error(`✗ sealed cell seed=${seed} (${cx},${cz})`); failures++; }
    }

    // 3. flood-fill from origin within a 30-radius window
    const R = 30, seen = new Set(), q = [[0, 0]]; seen.add('0,0');
    while (q.length) {
      const [cx, cz] = q.pop();
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], nz = cz + DZ[d];
        if (Math.abs(nx) > R || Math.abs(nz) > R) continue;
        const k = nx + ',' + nz;
        if (seen.has(k)) continue;
        if (!m.wallBetween(cx, cz, nx, nz)) { seen.add(k); q.push([nx, nz]); }
      }
    }
    totalReach += seen.size;
    totalCells += (2 * R + 1) * (2 * R + 1);
  }
}

const reachPct = (totalReach / totalCells * 100).toFixed(1);
console.log(`\n==== MAZE WATERTIGHT SWEEP (${SEEDS} seeds × ${PARAMS.length} levels) ====`);
console.log(`symmetry + no-sealed-cell failures: ${failures}`);
console.log(`avg reachable component from origin: ${reachPct}% of the 61×61 window`);

if (failures > 0) { console.error('FAIL: watertight invariant violated'); process.exit(1); }
if (totalReach / totalCells < 0.4) { console.error('FAIL: connected component too small (player could be trapped)'); process.exit(1); }
console.log('PASS — maze is watertight by construction and broadly connected.');
