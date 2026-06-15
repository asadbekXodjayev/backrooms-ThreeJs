// Unified input: keyboard + pointer-lock mouse, touch (twin sticks + look drag),
// and gamepad. Exposes a per-frame normalized state the controller reads.

export interface InputState {
  // analog move, range [-1,1]; +z forward
  moveX: number;
  moveZ: number;
  // accumulated look delta since last consume (radians-ish, scaled by sensitivity)
  lookX: number;
  lookY: number;
  // held
  sprint: boolean;
  crouch: boolean;
  jump: boolean; // held — enables auto bunny-hop on landing
  // edge-triggered (true for exactly one frame)
  jumpPressed: boolean;
  interactPressed: boolean;
  flashlightPressed: boolean;
  journalPressed: boolean;
  pausePressed: boolean;
  povPressed: boolean;
  anyPressed: boolean;
}

export class Input {
  state: InputState = {
    moveX: 0, moveZ: 0, lookX: 0, lookY: 0,
    sprint: false, crouch: false, jump: false,
    jumpPressed: false,
    interactPressed: false, flashlightPressed: false, journalPressed: false,
    pausePressed: false, povPressed: false, anyPressed: false,
  };

  sensitivity = 1;
  invertY = false;
  locked = false;
  isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  private keys = new Set<string>();
  private edge = new Set<string>(); // actions queued this frame
  private lookAccumX = 0;
  private lookAccumY = 0;
  private el: HTMLElement;
  private enabled = false;

  // touch joystick state
  private touchMove = { active: false, id: -1, baseX: 0, baseY: 0, dx: 0, dy: 0 };
  private touchLook = { active: false, id: -1, lastX: 0, lastY: 0 };

  // listeners we register on the touch overlay buttons
  touchButtons = { sprint: false, crouch: false, jump: false };

  constructor(el: HTMLElement) {
    this.el = el;
    this.bindKeyboard();
    this.bindMouse();
  }

  /** Enable gameplay input (called when entering play). */
  enable() { this.enabled = true; }
  disable() { this.enabled = false; this.keys.clear(); }

  requestPointerLock() {
    if (this.isTouch) return;
    this.el.requestPointerLock?.();
  }

  /**
   * Layout-independent key token. Uses `e.code` (the physical key position,
   * which is identical on QWERTY/AZERTY/ЙЦУКЕН/etc. hardware) so WASD lands on
   * the same physical keys regardless of the OS keyboard language. Falls back to
   * `e.key` only when `code` is missing (some IMEs / virtual keyboards).
   */
  private keyToken(e: KeyboardEvent): string {
    const c = e.code;
    if (c) {
      if (c.startsWith('Key')) return c.slice(3).toLowerCase();   // KeyW -> w
      if (c.startsWith('Digit')) return c.slice(5);               // Digit1 -> 1
      if (c === 'ShiftLeft' || c === 'ShiftRight') return 'shift';
      if (c === 'ControlLeft' || c === 'ControlRight') return 'control';
      if (c === 'Space') return ' ';
      return c.toLowerCase();                                     // ArrowUp -> arrowup, Tab, Escape…
    }
    return e.key.toLowerCase();
  }

  private bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = this.keyToken(e);
      this.keys.add(k);
      // edge actions — always listen (menu uses Esc etc.)
      if (k === 'e') this.edge.add('interact');
      if (k === 'f') this.edge.add('flashlight');
      if (k === 'tab') { this.edge.add('journal'); e.preventDefault(); }
      if (k === 'escape') this.edge.add('pause');
      if (k === 'v') this.edge.add('pov');
      if (k === ' ') { this.edge.add('jump'); e.preventDefault(); } // Space = jump
    });
    window.addEventListener('keyup', (e) => this.keys.delete(this.keyToken(e)));
    window.addEventListener('blur', () => { this.keys.clear(); });
  }

  private bindMouse() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.lookAccumX += e.movementX;
      this.lookAccumY += e.movementY;
    });
  }

  // ---- touch wiring (called by Touch UI) -------------------------------
  bindTouchMoveStick(stickEl: HTMLElement) {
    const maxR = 56;
    const onStart = (e: PointerEvent) => {
      this.touchMove.active = true; this.touchMove.id = e.pointerId;
      const r = stickEl.getBoundingClientRect();
      this.touchMove.baseX = r.left + r.width / 2;
      this.touchMove.baseY = r.top + r.height / 2;
      stickEl.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!this.touchMove.active || e.pointerId !== this.touchMove.id) return;
      let dx = e.clientX - this.touchMove.baseX;
      let dy = e.clientY - this.touchMove.baseY;
      const len = Math.hypot(dx, dy) || 1;
      if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; }
      this.touchMove.dx = dx / maxR; this.touchMove.dy = dy / maxR;
      const nub = stickEl.querySelector('.stick__nub') as HTMLElement | null;
      if (nub) nub.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.touchMove.id) return;
      this.touchMove.active = false; this.touchMove.dx = 0; this.touchMove.dy = 0;
      const nub = stickEl.querySelector('.stick__nub') as HTMLElement | null;
      if (nub) nub.style.transform = 'translate(0,0)';
    };
    stickEl.addEventListener('pointerdown', onStart);
    stickEl.addEventListener('pointermove', onMove);
    stickEl.addEventListener('pointerup', onEnd);
    stickEl.addEventListener('pointercancel', onEnd);
  }

  bindTouchLook(surface: HTMLElement) {
    surface.addEventListener('pointerdown', (e) => {
      // ignore touches that start on UI controls
      if ((e.target as HTMLElement).closest('.stick, .tbtn, .overlay, .panel')) return;
      if (this.touchLook.active) return;
      this.touchLook.active = true; this.touchLook.id = e.pointerId;
      this.touchLook.lastX = e.clientX; this.touchLook.lastY = e.clientY;
    });
    surface.addEventListener('pointermove', (e) => {
      if (!this.touchLook.active || e.pointerId !== this.touchLook.id) return;
      this.lookAccumX += (e.clientX - this.touchLook.lastX) * 2.0;
      this.lookAccumY += (e.clientY - this.touchLook.lastY) * 2.0;
      this.touchLook.lastX = e.clientX; this.touchLook.lastY = e.clientY;
    });
    const end = (e: PointerEvent) => { if (e.pointerId === this.touchLook.id) this.touchLook.active = false; };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
  }

  queueEdge(action: string) { this.edge.add(action); }

  // ---- per-frame update ------------------------------------------------
  update() {
    const s = this.state;

    // reset edges
    s.jumpPressed = this.edge.has('jump');
    s.interactPressed = this.edge.has('interact');
    s.flashlightPressed = this.edge.has('flashlight');
    s.journalPressed = this.edge.has('journal');
    s.pausePressed = this.edge.has('pause');
    s.povPressed = this.edge.has('pov');
    s.anyPressed = this.edge.size > 0;
    this.edge.clear();

    // movement from keys
    let mx = 0, mz = 0;
    if (this.enabled) {
      if (this.keys.has('w') || this.keys.has('arrowup')) mz += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) mz -= 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    }
    // touch stick (dy up = forward)
    if (this.touchMove.active) { mx += this.touchMove.dx; mz += -this.touchMove.dy; }

    // gamepad
    const gp = this.pollGamepad();
    mx += gp.moveX; mz += gp.moveZ;
    this.lookAccumX += gp.lookX; this.lookAccumY += gp.lookY;

    // normalize move
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    s.moveX = mx; s.moveZ = mz;

    s.sprint = this.keys.has('shift') || this.touchButtons.sprint || gp.sprint;
    s.crouch = this.keys.has('c') || this.keys.has('control') || this.touchButtons.crouch || gp.crouch;
    s.jump = this.keys.has(' ') || this.touchButtons.jump;

    // consume look
    const k = 0.0022 * this.sensitivity;
    s.lookX = this.lookAccumX * k;
    s.lookY = this.lookAccumY * k * (this.invertY ? -1 : 1);
    this.lookAccumX = 0; this.lookAccumY = 0;

    if (gp.interact) this.queuedGamepadEdge('interact', s);
  }

  private gpPrev = { interact: false, flashlight: false, pause: false, pov: false };
  private queuedGamepadEdge(_a: string, _s: InputState) { /* handled in pollGamepad */ }

  private pollGamepad() {
    const out = { moveX: 0, moveZ: 0, lookX: 0, lookY: 0, sprint: false, crouch: false, interact: false };
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads[0];
    if (!gp || !this.enabled) return out;
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    out.moveX = dz(gp.axes[0] ?? 0);
    out.moveZ = -dz(gp.axes[1] ?? 0);
    out.lookX = dz(gp.axes[2] ?? 0) * 28;
    out.lookY = dz(gp.axes[3] ?? 0) * 28;
    out.sprint = !!gp.buttons[10]?.pressed || !!gp.buttons[5]?.pressed; // L3 / RB
    out.crouch = !!gp.buttons[1]?.pressed; // B
    const aNow = !!gp.buttons[0]?.pressed;
    if (aNow && !this.gpPrev.interact) this.state.interactPressed = true;
    const fNow = !!gp.buttons[2]?.pressed; // X
    if (fNow && !this.gpPrev.flashlight) this.state.flashlightPressed = true;
    const sNow = !!gp.buttons[9]?.pressed; // start
    if (sNow && !this.gpPrev.pause) this.state.pausePressed = true;
    const yNow = !!gp.buttons[3]?.pressed; // Y
    if (yNow && !this.gpPrev.pov) this.state.povPressed = true;
    this.gpPrev = { interact: aNow, flashlight: fNow, pause: sNow, pov: yNow };
    return out;
  }
}
