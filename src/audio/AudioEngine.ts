// Every sound is synthesized at runtime with the Web Audio API — no samples,
// no licensing, tiny payload. Layers: fluorescent hum (detuned oscillator bank
// + filtered noise), sub-bass drone, ventilation rumble, plus event sounds
// (footsteps on damp carpet, drips, breathing, flashlight click, entity
// stingers). A master low-pass + the hum's detune are driven by sanity, so the
// whole bed warps as the player unravels.

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambienceGain!: GainNode;
  private sfxGain!: GainNode;
  private masterLP!: BiquadFilterNode;
  private noiseBuf!: AudioBuffer;

  private humOscs: OscillatorNode[] = [];
  private humGain!: GainNode;
  private droneOsc!: OscillatorNode;
  private started = false;

  private vol = { master: 0.85, ambience: 0.9, sfx: 0.9 };
  private sanity = 1;
  private reduced = false;

  // scheduling timers
  private heartT = 0;
  private dripT = 4;
  private breathT = 0;

  constructor(reducedMotion: boolean) {
    this.reduced = reducedMotion;
  }

  private ensure(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.buildGraph();
      return true;
    } catch { return false; }
  }

  private buildGraph() {
    const ctx = this.ctx!;
    this.master = ctx.createGain(); this.master.gain.value = this.vol.master;
    this.masterLP = ctx.createBiquadFilter(); this.masterLP.type = 'lowpass'; this.masterLP.frequency.value = 18000;
    this.master.connect(this.masterLP).connect(ctx.destination);

    this.ambienceGain = ctx.createGain(); this.ambienceGain.gain.value = this.vol.ambience; this.ambienceGain.connect(this.master);
    this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = this.vol.sfx; this.sfxGain.connect(this.master);

    // white-noise buffer (2s) reused everywhere
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Call on a user gesture. Starts the ambient bed. */
  resume() {
    if (!this.ensure()) return;
    this.ctx!.resume?.();
    if (this.started) return;
    this.started = true;
    this.startBed();
  }

  private startBed() {
    const ctx = this.ctx!;
    // ── fluorescent hum: a few detuned oscillators around 60Hz + harmonics ──
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0.0;
    const humLP = ctx.createBiquadFilter(); humLP.type = 'lowpass'; humLP.frequency.value = 900;
    this.humGain.connect(humLP).connect(this.ambienceGain);
    const freqs = [60, 120, 180, 121.5];
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = f > 100 ? 'sawtooth' : 'square';
      o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = f === 60 ? 0.12 : 0.04;
      o.connect(g).connect(this.humGain); o.start();
      this.humOscs.push(o);
    }
    // a touch of filtered noise hiss in the hum
    const hiss = ctx.createBufferSource(); hiss.buffer = this.noiseBuf; hiss.loop = true;
    const hissBP = ctx.createBiquadFilter(); hissBP.type = 'bandpass'; hissBP.frequency.value = 2200; hissBP.Q.value = 0.6;
    const hissG = ctx.createGain(); hissG.gain.value = 0.015;
    hiss.connect(hissBP).connect(hissG).connect(this.ambienceGain); hiss.start();

    // ── sub-bass drone ──
    this.droneOsc = ctx.createOscillator(); this.droneOsc.type = 'sine'; this.droneOsc.frequency.value = 41;
    const droneG = ctx.createGain(); droneG.gain.value = 0.09;
    this.droneOsc.connect(droneG).connect(this.ambienceGain); this.droneOsc.start();

    // ── ventilation rumble (low-passed looping noise) ──
    const vent = ctx.createBufferSource(); vent.buffer = this.noiseBuf; vent.loop = true;
    const ventLP = ctx.createBiquadFilter(); ventLP.type = 'lowpass'; ventLP.frequency.value = 220;
    const ventG = ctx.createGain(); ventG.gain.value = 0.06;
    vent.connect(ventLP).connect(ventG).connect(this.ambienceGain); vent.start();

    // fade the hum in
    this.humGain.gain.setTargetAtTime(0.9, ctx.currentTime, 1.5);
  }

  setVolumes(master: number, ambience: number, sfx: number) {
    this.vol = { master, ambience, sfx };
    if (!this.ctx) return;
    this.master.gain.value = master;
    this.ambienceGain.gain.value = ambience;
    this.sfxGain.gain.value = sfx;
  }

  setReducedMotion(r: boolean) { this.reduced = r; }

  /** sanity 0..1 → detune hum, close the master low-pass, swell the drone. */
  setSanity(s: number) {
    this.sanity = s;
    if (!this.ctx || !this.started) return;
    const ctx = this.ctx;
    const detune = (1 - s) * (this.reduced ? 6 : 28);
    for (const o of this.humOscs) o.detune.setTargetAtTime((Math.random() - 0.5) * detune, ctx.currentTime, 0.4);
    this.masterLP.frequency.setTargetAtTime(18000 - (1 - s) * 14000, ctx.currentTime, 0.5);
    this.droneOsc.frequency.setTargetAtTime(41 - (1 - s) * 8, ctx.currentTime, 0.6);
  }

  // ── event sounds ──────────────────────────────────────────────────────────
  private burst(freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass', pan = 0) {
    if (!this.ctx || !this.started) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(this.sfxGain);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.02);
  }

  footstep(sprint: boolean) {
    // damp carpet: soft, low, muffled
    this.burst(190 + Math.random() * 60, 1.2, sprint ? 0.13 : 0.18, sprint ? 0.16 : 0.1, 'lowpass');
  }

  drip() {
    if (!this.ctx || !this.started) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
    o.connect(g).connect(p).connect(this.sfxGain);
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(900 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.start(t); o.stop(t + 0.2);
  }

  breathe(intense: boolean) {
    this.burst(520, 2.5, intense ? 0.5 : 0.7, intense ? 0.06 : 0.03, 'bandpass');
  }

  click() {
    this.burst(1200, 1, 0.04, 0.12, 'highpass');
  }

  /** Entity reveal stinger — rare, earned. */
  stinger(intensity = 1) {
    if (!this.ctx || !this.started) return;
    const ctx = this.ctx;
    // dissonant swelling cluster + noise rush
    const t = ctx.currentTime;
    [110, 116.5, 220, 233].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g).connect(this.sfxGain);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05 * intensity, t + 0.03 + i * 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 1.1);
      o.start(t); o.stop(t + 1.2);
    });
    this.burst(800, 0.5, 0.6, 0.12 * intensity, 'bandpass');
  }

  private heartbeat(strength: number) {
    if (!this.ctx || !this.started) return;
    const ctx = this.ctx;
    const thump = (delay: number, gain: number) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g).connect(this.ambienceGain);
      const t = ctx.currentTime + delay;
      o.frequency.setValueAtTime(85, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.start(t); o.stop(t + 0.26);
    };
    thump(0, 0.18 * strength);
    thump(0.18, 0.12 * strength);
  }

  /** Per-frame scheduling of heartbeat / drips / breathing based on state. */
  update(dt: number, opts: { moving: boolean; sprint: boolean; nearEntity: number }) {
    if (!this.started) return;
    const s = this.sanity;

    // heartbeat ramps in as sanity falls or entity nears
    const fear = Math.max(1 - s, opts.nearEntity);
    if (fear > 0.4) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartbeat(Math.min(1, fear));
        this.heartT = 1.1 - fear * 0.55; // faster when more afraid
      }
    } else this.heartT = 0;

    // occasional drips
    this.dripT -= dt;
    if (this.dripT <= 0) { if (Math.random() < 0.6) this.drip(); this.dripT = 5 + Math.random() * 9; }

    // breathing when sprinting or terrified
    this.breathT -= dt;
    const wantBreath = opts.sprint || fear > 0.6;
    if (wantBreath && this.breathT <= 0) {
      this.breathe(fear > 0.6 || opts.sprint);
      this.breathT = opts.sprint ? 0.8 : 1.6;
    }
  }

  dispose() {
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null; this.started = false; this.humOscs = [];
  }
}
