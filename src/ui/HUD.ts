import { Game } from '../game/Game';

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function pad(n: number) { return n < 10 ? '0' + n : '' + n; }

/** Near-zero, in-world HUD: sanity vignette, found-footage framing, minimal meters. */
export class HUD {
  root = el('div'); // #hud
  private vignette = el('div', 'hud-vignette');
  private objective = el('div', 'hud-objective');
  private toastEl = el('div', 'hud-toast');
  private promptEl = el('div', 'hud-prompt');
  private sanityFill: HTMLElement;
  private staminaFill: HTMLElement;
  private levelLabel = el('span');
  private ffTime = el('div', 'ff-time');
  private ffBat = el('div', 'ff-bat');
  private clock = 0;
  private toastTimer = 0;
  private objTimer = 0;

  constructor() {
    this.root.id = 'hud';
    const ff = el('div'); ff.id = 'ff-frame';
    ff.innerHTML = `<div class="ff-rec"><span class="dot"></span>REC</div>`;
    this.ffBat.innerHTML = 'BAT <b style="color:#e8d87a">100%</b>';
    this.ffTime.textContent = '▶ 00:00:00';
    ff.append(this.ffBat, this.ffTime);

    const bottom = el('div', 'hud-bottom');
    const sanity = el('div', 'meter');
    sanity.innerHTML = `<div class="meter__label">SANITY</div><div class="meter__track"><div class="meter__fill"></div></div>`;
    const stamina = el('div', 'meter');
    stamina.innerHTML = `<div class="meter__label">STAMINA</div><div class="meter__track"><div class="meter__fill"></div></div>`;
    this.sanityFill = sanity.querySelector('.meter__fill') as HTMLElement;
    this.staminaFill = stamina.querySelector('.meter__fill') as HTMLElement;
    this.levelLabel.style.cssText = 'align-self:center;letter-spacing:0.3em;color:#8a7a3a';
    bottom.append(sanity, this.levelLabel, stamina);

    const crosshair = el('div', 'crosshair');

    this.objective.innerHTML = `<span class="tag"></span><span class="txt"></span>`;
    this.root.append(this.vignette, ff, this.objective, bottom, crosshair, this.promptEl, this.toastEl);
    document.body.appendChild(this.root);
  }

  setObjective(tag: string, text: string) {
    (this.objective.querySelector('.tag') as HTMLElement).textContent = tag;
    (this.objective.querySelector('.txt') as HTMLElement).textContent = text;
    this.objective.classList.add('show');
    this.objTimer = 6;
  }
  setLevelName(name: string) { this.levelLabel.textContent = name; }

  toast(text: string) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = 2.6;
  }

  showPrompt(text: string | null) {
    if (text) { this.promptEl.textContent = text; this.promptEl.classList.add('show'); }
    else this.promptEl.classList.remove('show');
  }

  reset() {
    this.clock = 0; this.objTimer = 0; this.toastTimer = 0;
    this.objective.classList.remove('show');
    this.toastEl.classList.remove('show');
    this.promptEl.classList.remove('show');
  }

  update(dt: number, game: Game) {
    this.clock += dt;
    const t = Math.floor(this.clock);
    this.ffTime.textContent = `▶ ${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;

    // sanity → vignette + meter
    const san = game.sanity;
    this.sanityFill.style.width = (san * 100).toFixed(0) + '%';
    this.sanityFill.classList.toggle('low', san < 0.3);
    const dark = 0.45 + (1 - san) * 0.4;
    this.vignette.style.boxShadow = `inset 0 0 ${120 + (1 - san) * 160}px ${30 + (1 - san) * 50}px rgba(0,0,0,${dark.toFixed(2)})`;

    // stamina
    this.staminaFill.style.width = (game.controller.stamina * 100).toFixed(0) + '%';

    // battery
    const bat = Math.max(0, Math.round(game.battery * 100));
    this.ffBat.innerHTML = `BAT <b style="color:${bat < 20 ? '#b5462f' : '#e8d87a'}">${bat}%</b>`;

    if (this.objTimer > 0) { this.objTimer -= dt; if (this.objTimer <= 0) this.objective.classList.remove('show'); }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.toastEl.classList.remove('show'); }
  }
}
