import './style.css';
import { Game } from './game/Game';
import { randomSeed } from './core/rng';

// Boot loader — fill quickly to first interaction (assets are procedural, so
// there is nothing heavy to wait on; this is mood, not a real load bar).
const bootFill = document.getElementById('boot-fill') as HTMLElement;
const bootPct = document.getElementById('boot-pct') as HTMLElement;
const boot = document.getElementById('boot') as HTMLElement;
let p = 0;
const bootTimer = setInterval(() => {
  p = Math.min(100, p + 6 + Math.random() * 12);
  bootFill.style.width = p + '%';
  bootPct.textContent = Math.floor(p) + '%';
  if (p >= 100) { clearInterval(bootTimer); }
}, 70);

const app = document.getElementById('app') as HTMLElement;
const game = new Game(app);
// expose for the QA harness / debugging
(window as any).__game = game;

// Lazily wire the full UI shell (menu/hud/journal/pause/touch) — built so the
// first frame can render the world behind the menu.
import('./ui/Shell').then(({ mountShell }) => {
  mountShell(game, () => {
    boot.classList.add('hide');
    setTimeout(() => boot.remove(), 700);
  }, randomSeed);
});
