// Difficulty is data, exactly like Levels. One config table of multipliers that
// the sanity loop (Game), the item spawner (Items) and the entity (Entity) all
// read from. NORMAL is the baseline (every multiplier = 1) so it reproduces the
// original tuning bit-for-bit; the other modes only scale away from it.

export type Difficulty = 'easy' | 'normal' | 'hard' | 'inferno';

export interface DifficultyConfig {
  id: Difficulty;
  name: string;
  blurb: string;
  /** Scales ALL sanity loss — passive drain, dark/dead-battery penalty,
   *  entity proximity, and negative addSanity events (e.g. being touched). */
  sanityDrainMult: number;
  /** Scales every positive sanity gain (Almond Water, etc.). */
  sanityGainMult: number;
  /** Scales flashlight battery consumption. */
  batteryDrainMult: number;
  /** Scales how many pickups (almond water / batteries) spawn per level. */
  itemCountMult: number;
  /** Scales how far pickups + the exit spawn from spawn/player. <1 = closer. */
  spawnDistanceMult: number;
  /** Scales the entity's aggression model. */
  entityAggroMult: number;
  /** Scales how far the entity spawns from the player. >1 = farther / safer. */
  entitySpawnDistanceMult: number;
  /** Shifts the entity's starting stage per level (clamped 0..3). */
  entityStageOffset: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'EASY',
    blurb: 'The hum is gentle. Sanity drains 10× slower, plenty of Almond Water close at hand, and the thing in the dark keeps its distance.',
    sanityDrainMult: 0.1,        // 10× easier on sanity than normal
    sanityGainMult: 1.6,         // Almond Water restores more
    batteryDrainMult: 0.6,
    itemCountMult: 1.6,          // more things that boost sanity
    spawnDistanceMult: 0.6,      // what you need spawns a little closer
    entityAggroMult: 0.55,
    entitySpawnDistanceMult: 1.5,
    entityStageOffset: -1,       // the hunt is held back a stage
  },
  normal: {
    id: 'normal',
    name: 'NORMAL',
    blurb: 'The intended descent. Ration your light, find the water, do not linger.',
    sanityDrainMult: 1,
    sanityGainMult: 1,
    batteryDrainMult: 1,
    itemCountMult: 1,
    spawnDistanceMult: 1,
    entityAggroMult: 1,
    entitySpawnDistanceMult: 1,
    entityStageOffset: 0,
  },
  hard: {
    id: 'hard',
    name: 'HARD',
    blurb: 'Reality thins faster. Less water, farther to find, and it grows bolder.',
    sanityDrainMult: 1.6,
    sanityGainMult: 0.85,
    batteryDrainMult: 1.3,
    itemCountMult: 0.8,
    spawnDistanceMult: 1.2,
    entityAggroMult: 1.3,
    entitySpawnDistanceMult: 0.85,
    entityStageOffset: 0,
  },
  inferno: {
    id: 'inferno',
    name: 'INFERNO',
    blurb: 'The Backrooms want you. Sanity bleeds out, supplies are scarce and distant, and it hunts from the first step.',
    sanityDrainMult: 2.4,
    sanityGainMult: 0.6,
    batteryDrainMult: 1.7,
    itemCountMult: 0.6,
    spawnDistanceMult: 1.4,
    entityAggroMult: 1.7,
    entitySpawnDistanceMult: 0.7,
    entityStageOffset: 1,        // it hunts a stage earlier on every level
  },
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'inferno'];
