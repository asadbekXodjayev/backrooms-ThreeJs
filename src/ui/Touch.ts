import { Input } from '../core/input';

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/** On-screen twin-stick + buttons for touch devices. */
export class TouchControls {
  root = el('div'); // #touch

  constructor(private input: Input) {
    this.root.id = 'touch';
    const stick = el('div', 'stick left');
    stick.innerHTML = `<div class="stick__nub"></div>`;

    const btns = el('div', 'tbtns');
    const bSprint = el('div', 'tbtn', 'RUN');
    const bCrouch = el('div', 'tbtn', 'CROUCH');
    const bJump = el('div', 'tbtn', 'JUMP');
    const bFlash = el('div', 'tbtn', 'LIGHT');
    const bUse = el('div', 'tbtn', 'USE');
    btns.append(bFlash, bUse, bJump, bCrouch, bSprint);

    this.root.append(stick, btns);
    document.body.appendChild(this.root);

    this.input.bindTouchMoveStick(stick);
    this.input.bindTouchLook(document.body);

    const hold = (e: HTMLElement, on: () => void, off: () => void) => {
      e.addEventListener('pointerdown', (ev) => { ev.preventDefault(); on(); });
      e.addEventListener('pointerup', off);
      e.addEventListener('pointercancel', off);
      e.addEventListener('pointerleave', off);
    };
    hold(bSprint, () => (this.input.touchButtons.sprint = true), () => (this.input.touchButtons.sprint = false));
    hold(bCrouch, () => (this.input.touchButtons.crouch = true), () => (this.input.touchButtons.crouch = false));
    // hold to auto bunny-hop; the edge fires the first jump immediately
    hold(bJump, () => { this.input.queueEdge('jump'); this.input.touchButtons.jump = true; }, () => (this.input.touchButtons.jump = false));
    bFlash.addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.queueEdge('flashlight'); });
    bUse.addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.queueEdge('interact'); });
  }

  setVisible(on: boolean) { this.root.classList.toggle('on', on && this.input.isTouch); }
}
