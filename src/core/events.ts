// Minimal typed event bus shared across systems (game state, ui, audio).

export type GameEvents = {
  'sanity:change': { value: number };
  'objective:set': { tag: string; text: string };
  'toast': { text: string };
  'note:pickup': { id: string };
  'item:pickup': { kind: string; label: string };
  'battery:change': { value: number };
  'level:enter': { index: number; name: string };
  'level:descend': { toIndex: number };
  'entity:stage': { stage: number };
  'entity:stinger': {};
  'ending': { kind: 'good' | 'bad'; title: string; body: string };
  'puzzle:solved': {};
  'flashlight:toggle': { on: boolean };
  'quality:change': { tier: number };
};

type Handler<T> = (payload: T) => void;

class Emitter {
  private map = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(key: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.map.get(key);
    if (!set) { set = new Set(); this.map.set(key, set); }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof GameEvents>(key: K, payload: GameEvents[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of set) fn(payload);
  }
}

export const bus = new Emitter();
