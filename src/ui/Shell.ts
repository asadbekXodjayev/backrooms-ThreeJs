import { Game } from '../game/Game';
import { bus } from '../core/events';
import { HUD } from './HUD';
import { Journal } from './Journal';
import { TouchControls } from './Touch';
import { Settings, loadSettings, saveSettings, applySettings } from './settings';
import { DIFFICULTIES, DIFFICULTY_ORDER, Difficulty } from '../game/Difficulty';

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/**
 * Builds and wires the entire DOM UI shell: menu, settings, HUD, journal,
 * pause and touch controls, plus the fade / ending transitions. The world
 * renders behind the menu as a live backdrop.
 */
export function mountShell(game: Game, onReady: () => void, randomSeed: () => number) {
  const settings: Settings = loadSettings();

  // difficulty must be live before the first level builds (it shifts entity stage)
  game.setDifficulty(settings.difficulty);

  // ── overlays ────────────────────────────────────────────────────────────
  const menu = buildMenu(settings);
  const settingsPanel = buildSettings(settings, game);
  const pausePanel = buildPause();
  const fade = el('div'); fade.id = 'fade';
  const endcard = el('div', 'endcard');
  endcard.innerHTML = `<div><h2></h2><p></p><button class="btn" data-act="again">RETURN TO THE LOBBY</button></div>`;

  document.body.append(menu, settingsPanel, pausePanel, fade, endcard);

  const hud = new HUD();
  const journal = new Journal();
  const touch = new TouchControls(game.input);

  // ── backdrop world ───────────────────────────────────────────────────────
  game.loadLevel(0, randomSeed());
  applySettings(settings, game);
  game.engine.start();
  requestAnimationFrame(() => requestAnimationFrame(onReady));

  // ── helpers ───────────────────────────────────────────────────────────────
  const show = (e: HTMLElement) => e.classList.add('show');
  const hide = (e: HTMLElement) => e.classList.remove('show');

  let started = false;
  function startGame() {
    if (!started) {
      started = true;
      // fresh maze for the real run
      game.loadLevel(0, randomSeed());
      applySettings(settings, game);
    }
    hide(menu); hide(settingsPanel); hide(pausePanel);
    game.audio?.resume();
    game.enterPlay();
    game.announceLevel();
    touch.setVisible(game.input.isTouch);
  }

  function openPause() {
    if (game.mode !== 'play') return;
    game.pause();
    show(pausePanel);
    touch.setVisible(false);
  }
  function closePause() {
    hide(pausePanel); hide(settingsPanel);
    game.resume();
    touch.setVisible(game.input.isTouch);
  }
  function quitToMenu() {
    started = false;
    game.pause();
    hide(pausePanel); hide(settingsPanel); hide(endcard); hide(fade);
    touch.setVisible(false);
    hud.reset();
    journal.clear();
    game.loadLevel(0, randomSeed());
    game.mode = 'menu';
    show(menu);
  }

  // ── difficulty selector ─────────────────────────────────────────────────────
  const diffBtns = Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-diff]'));
  const diffBlurb = menu.querySelector('.diff-blurb') as HTMLElement;
  const paintDifficulty = (d: Difficulty) => {
    diffBtns.forEach((b) => {
      const on = b.dataset.diff === d;
      b.classList.toggle('btn', on);
      b.classList.toggle('btn--ghost', !on);
      b.setAttribute('aria-pressed', String(on));
    });
    diffBlurb.textContent = DIFFICULTIES[d].blurb;
  };
  diffBtns.forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.diff as Difficulty;
    settings.difficulty = d;
    saveSettings(settings);
    game.setDifficulty(d);
    game.audio?.click();
    paintDifficulty(d);
  }));
  paintDifficulty(settings.difficulty);

  // ── menu buttons ──────────────────────────────────────────────────────────
  menu.querySelector('[data-act="enter"]')!.addEventListener('click', startGame);
  menu.querySelector('[data-act="settings"]')!.addEventListener('click', () => { show(settingsPanel); });
  settingsPanel.querySelector('[data-act="close"]')!.addEventListener('click', () => {
    hide(settingsPanel);
    if (game.mode === 'paused') show(pausePanel);
  });
  pausePanel.querySelector('[data-act="resume"]')!.addEventListener('click', closePause);
  pausePanel.querySelector('[data-act="settings"]')!.addEventListener('click', () => { hide(pausePanel); show(settingsPanel); });
  pausePanel.querySelector('[data-act="quit"]')!.addEventListener('click', quitToMenu);
  endcard.querySelector('[data-act="again"]')!.addEventListener('click', quitToMenu);

  // ── per-frame UI updates + input edges ─────────────────────────────────────
  game.engine.onUpdate((dt) => {
    const s = game.input.state;
    if (s.pausePressed) {
      if (journal.isOpen()) journal.close();
      else if (game.mode === 'play') openPause();
      else if (game.mode === 'paused') closePause();
    }
    if (s.journalPressed && !pausePanel.classList.contains('show') && !settingsPanel.classList.contains('show')) {
      if (journal.isOpen()) journal.close();
      else if (game.mode === 'play') {
        game.pause();
        journal.toggle(undefined, () => game.resume());
      }
    }
    hud.update(dt, game);
  });

  // ── event bus → UI ─────────────────────────────────────────────────────────
  bus.on('objective:set', ({ tag, text }) => hud.setObjective(tag, text));
  bus.on('toast', ({ text }) => hud.toast(text));
  bus.on('note:pickup', () => {});
  bus.on('item:pickup', ({ label }) => hud.toast(`PICKED UP · ${label}`));
  bus.on('ending', ({ kind, title, body }) => {
    show(fade);
    setTimeout(() => {
      endcard.classList.toggle('bad', kind === 'bad');
      (endcard.querySelector('h2') as HTMLElement).textContent = title;
      (endcard.querySelector('p') as HTMLElement).textContent = body;
      show(endcard);
      game.pause();
    }, 1100);
  });
  bus.on('level:enter', ({ name }) => { hud.setLevelName(name); });

  // expose journal so the game can push notes / open a reader
  game.ui = {
    hud, journal,
    openNote: (n) => {
      const wasPlaying = game.mode === 'play';
      if (wasPlaying) game.pause();
      journal.openNote(n, () => { if (wasPlaying) game.resume(); });
    },
    fadeTransition: (cb) => fadeTransition(fade, cb),
  };
}

function fadeTransition(fade: HTMLElement, mid: () => void) {
  fade.classList.add('show');
  setTimeout(() => { mid(); }, 950);
  setTimeout(() => { fade.classList.remove('show'); }, 1900);
}

function buildMenu(settings: Settings): HTMLElement {
  const o = el('div', 'overlay show'); o.id = 'menu';
  const diffButtons = DIFFICULTY_ORDER.map((d) => {
    const on = settings.difficulty === d;
    return `<button class="${on ? 'btn' : 'btn btn--ghost'}" data-diff="${d}" aria-pressed="${on}">${DIFFICULTIES[d].name}</button>`;
  }).join('');
  o.innerHTML = `
    <div class="panel">
      <div class="panel__kicker">FOUND FOOTAGE · DO NOT DISTRIBUTE</div>
      <div class="panel__title">THE&nbsp;BACKROOMS</div>
      <p class="panel__lede">You <em>noclipped</em> out of reality. Endless mono-yellow rooms,
      damp carpet, the buzz of dead fluorescent light. No doors. No people. Find a way down,
      and a way <em>out</em> — before your mind gives way to the hum.</p>
      <div class="diff-select">
        <div class="panel__kicker" style="margin-bottom:8px">DIFFICULTY</div>
        <div class="btn-row" data-diff-row>${diffButtons}</div>
        <p class="diff-blurb">${DIFFICULTIES[settings.difficulty].blurb}</p>
      </div>
      <div class="btn-row">
        <button class="btn" data-act="enter">ENTER ▸</button>
        <button class="btn btn--ghost" data-act="settings">SETTINGS</button>
      </div>
      <div class="hint-keys">
        <b>WASD</b> move · <b>MOUSE</b> look · <b>SPACE</b> jump · <b>SHIFT</b> sprint · <b>C</b> crouch ·
        <b>F</b> flashlight · <b>E</b> interact · <b>TAB</b> journal · <b>V</b> 3rd-person · <b>ESC</b> pause
      </div>
    </div>`;
  return o;
}

function buildSettings(settings: Settings, game: Game): HTMLElement {
  const o = el('div', 'overlay'); o.id = 'settings';
  o.innerHTML = `
    <div class="panel">
      <div class="panel__kicker">SETTINGS</div>
      <div class="panel__title panel__title--sm">CONFIGURATION</div>
      <div style="margin-top:18px">
        ${rangeRow('master', 'MASTER VOLUME', settings.master)}
        ${rangeRow('ambience', 'AMBIENCE', settings.ambience)}
        ${rangeRow('sfx', 'EFFECTS', settings.sfx)}
        ${rangeRow('sensitivity', 'LOOK SENSITIVITY', settings.sensitivity, 0.2, 2.5)}
        <div class="row"><label>QUALITY</label>
          <select data-set="quality">
            <option value="auto">AUTO</option><option value="3">ULTRA</option>
            <option value="2">HIGH</option><option value="1">LOW</option><option value="0">POTATO</option>
          </select></div>
        <div class="row"><label>INVERT LOOK Y</label><button class="toggle" data-toggle="invertY" aria-pressed="${settings.invertY}">${settings.invertY ? 'ON' : 'OFF'}</button></div>
        <div class="row"><label>REDUCED MOTION</label><button class="toggle" data-toggle="reducedMotion" aria-pressed="${settings.reducedMotion}">${settings.reducedMotion ? 'ON' : 'OFF'}</button></div>
        <div class="row"><label>FOUND-FOOTAGE FILTER</label><button class="toggle" data-toggle="vhs" aria-pressed="${settings.vhs}">${settings.vhs ? 'ON' : 'OFF'}</button></div>
        <div class="row"><label>REDUCE VHS NOISE</label><button class="toggle" data-toggle="lowVhs" aria-pressed="${settings.lowVhs}">${settings.lowVhs ? 'ON' : 'OFF'}</button></div>
      </div>
      <div class="btn-row" style="margin-top:22px"><button class="btn" data-act="close">DONE</button></div>
    </div>`;

  // wire ranges
  o.querySelectorAll('input[type=range]').forEach((inp) => {
    const r = inp as HTMLInputElement;
    const key = r.dataset.set as keyof Settings;
    r.addEventListener('input', () => {
      (settings as any)[key] = parseFloat(r.value);
      (r.parentElement!.querySelector('.val') as HTMLElement).textContent = fmt(key, parseFloat(r.value));
      applySettings(settings, game); saveSettings(settings);
    });
  });
  const qsel = o.querySelector('select[data-set=quality]') as HTMLSelectElement;
  qsel.value = settings.quality;
  qsel.addEventListener('change', () => { settings.quality = qsel.value as any; applySettings(settings, game); saveSettings(settings); });
  o.querySelectorAll('button[data-toggle]').forEach((btn) => {
    const b = btn as HTMLButtonElement;
    const key = b.dataset.toggle as keyof Settings;
    b.addEventListener('click', () => {
      (settings as any)[key] = !(settings as any)[key];
      b.setAttribute('aria-pressed', String((settings as any)[key]));
      b.textContent = (settings as any)[key] ? 'ON' : 'OFF';
      applySettings(settings, game); saveSettings(settings);
    });
  });
  return o;
}

function buildPause(): HTMLElement {
  const o = el('div', 'overlay'); o.id = 'pause';
  o.innerHTML = `
    <div class="panel">
      <div class="panel__kicker">PAUSED · the hum continues</div>
      <div class="panel__title panel__title--sm">STANDBY</div>
      <div class="btn-row" style="margin-top:24px">
        <button class="btn" data-act="resume">RESUME ▸</button>
        <button class="btn btn--ghost" data-act="settings">SETTINGS</button>
        <button class="btn btn--ghost" data-act="quit">QUIT TO MENU</button>
      </div>
    </div>`;
  return o;
}

function rangeRow(key: string, label: string, val: number, min = 0, max = 1): string {
  return `<div class="row"><label>${label}</label>
    <span style="display:flex;align-items:center;gap:10px">
      <input type="range" data-set="${key}" min="${min}" max="${max}" step="0.01" value="${val}">
      <span class="val">${fmt(key, val)}</span></span></div>`;
}
function fmt(key: string, v: number): string {
  if (key === 'sensitivity') return v.toFixed(2) + '×';
  return Math.round(v * 100) + '%';
}
