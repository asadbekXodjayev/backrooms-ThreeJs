import { MazeParams } from '../world/MazeGen';
import { Palette, PALETTES } from '../world/materials';

export type ExitKind = 'anomaly' | 'vent' | 'puzzle';

export interface LevelDef {
  name: string;
  subtitle: string;
  palette: Palette;
  maze: MazeParams;
  fogDensity: number;
  ambient: number;        // hemisphere light intensity (baked static term)
  lightIntensity: number; // multiplier on emissive panel flicker
  objective: string;
  objectiveTag: string;
  exit: ExitKind;
  entityStageStart: number; // 0 none, 1 heard, 2 glimpsed, 3 hunts
  almondWater: number;      // target count of almond water spawned per chunk-ish density
  batteries: number;
  notes: number;            // how many lore notes to scatter
  intro: string;            // fades in on entry
}

// Levels are data: {generator params, palette, audio bed, objective, entity}.
// Extensible — add an entry and it slots into the descent chain.
export const LEVELS: LevelDef[] = [
  {
    name: 'LEVEL 0',
    subtitle: 'The Lobby',
    palette: PALETTES.lobby,
    maze: { roomDensity: 0.62, corridorBias: 0.35, blockSize: 4, extraOpen: 0.22 },
    fogDensity: 0.072,
    ambient: 1.45,
    lightIntensity: 1.0,
    objective: 'Find the anomaly in the wallpaper — a weak point where reality thins.',
    objectiveTag: 'OBJECTIVE · LEVEL 0',
    exit: 'anomaly',
    entityStageStart: 0,
    almondWater: 5,
    batteries: 3,
    notes: 3,
    intro: 'You noclipped out of reality. ~600 million sq mi of empty rooms. The hum never stops.',
  },
  {
    name: 'LEVEL 1',
    subtitle: 'Habitable Zone',
    palette: PALETTES.habitable,
    maze: { roomDensity: 0.45, corridorBias: 0.55, blockSize: 5, extraOpen: 0.17 },
    fogDensity: 0.092,
    ambient: 0.6,
    lightIntensity: 0.85,
    objective: 'Reach the loading dock. Something hunts in the dark now — keep to the light.',
    objectiveTag: 'OBJECTIVE · LEVEL 1',
    exit: 'vent',
    entityStageStart: 1,
    almondWater: 6,
    batteries: 4,
    notes: 3,
    intro: 'Concrete and rust. The warehouse hums lower here. You are not alone anymore.',
  },
  {
    name: 'LEVEL 2',
    subtitle: 'Pipe Dreams',
    palette: PALETTES.pipes,
    maze: { roomDensity: 0.3, corridorBias: 0.7, blockSize: 6, extraOpen: 0.14 },
    fogDensity: 0.11,
    ambient: 0.42,
    lightIntensity: 0.7,
    objective: 'Open the exit valves. Three codes hide in the notes left by the lost.',
    objectiveTag: 'OBJECTIVE · LEVEL 2',
    exit: 'puzzle',
    entityStageStart: 2,
    almondWater: 7,
    batteries: 5,
    notes: 4,
    intro: 'Damp tunnels, dripping dark. The way out is sealed behind valves and old codes.',
  },
];
