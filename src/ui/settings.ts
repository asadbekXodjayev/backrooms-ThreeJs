import { Game } from '../game/Game';
import { QualityTier } from '../core/Engine';

export interface Settings {
  master: number;
  ambience: number;
  sfx: number;
  sensitivity: number;
  quality: 'auto' | '3' | '2' | '1' | '0';
  invertY: boolean;
  reducedMotion: boolean;
  vhs: boolean;
}

const KEY = 'backrooms.settings.v1';

const DEFAULTS: Settings = {
  master: 0.85,
  ambience: 0.9,
  sfx: 0.9,
  sensitivity: 1,
  quality: 'auto',
  invertY: false,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  vhs: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function applySettings(s: Settings, game: Game) {
  game.input.sensitivity = s.sensitivity;
  game.input.invertY = s.invertY;
  game.engine.prefersReducedMotion =
    s.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // quality
  if (s.quality === 'auto') {
    game.engine.lockTier = false;
  } else {
    game.engine.lockTier = true;
    game.engine.setTier(parseInt(s.quality, 10) as QualityTier);
  }

  // audio (present after Phase 4)
  game.audio?.setVolumes(s.master, s.ambience, s.sfx);
  // post (present after Phase 3)
  game.post?.setVHSEnabled(s.vhs);
}
