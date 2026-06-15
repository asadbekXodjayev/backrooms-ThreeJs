import * as THREE from 'three';
import { bus } from './events';

export type QualityTier = 0 | 1 | 2 | 3; // 0 = potato, 3 = ultra

/**
 * Owns the renderer, scene, camera, clock and the main loop. Also runs the
 * adaptive-quality FPS monitor that steps the tier down on weak hardware
 * (DPR → shadows → post-fx → fog distance → prop density are read off `tier`).
 */
export class Engine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock = new THREE.Clock();

  tier: QualityTier = 3;
  maxDPR = 2;
  lockTier = false; // when true, the adaptive monitor won't change the tier
  prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  private updaters: ((dt: number, elapsed: number) => void)[] = [];
  private renderFn: (() => void) | null = null;
  private running = false;
  private rafId = 0;

  // fps monitor
  private fpsSamples: number[] = [];
  private monitorCooldown = 0;
  fps = 60;

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // we composite through EffectComposer; FXAA-ish handled in post
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.maxDPR));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a07);
    this.scene.fog = new THREE.FogExp2(0x1a1808, 0.085);

    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 60);
    this.camera.position.set(0, 1.6, 0);

    addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);

    // pick a starting tier from a quick device heuristic
    this.tier = this.guessInitialTier();
    if (this.prefersReducedMotion) this.maxDPR = Math.min(this.maxDPR, 1.5);
  }

  private guessInitialTier(): QualityTier {
    const mem = (navigator as any).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (coarse && (mem <= 4 || cores <= 4)) return 1;
    if (mem <= 4 || cores <= 4) return 2;
    return 3;
  }

  setTier(t: QualityTier) {
    if (t === this.tier) return;
    this.tier = t;
    const dpr = t <= 1 ? Math.min(devicePixelRatio, 1.25) : Math.min(devicePixelRatio, this.maxDPR);
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = t >= 2;
    bus.emit('quality:change', { tier: t });
  }

  onUpdate(fn: (dt: number, elapsed: number) => void) { this.updaters.push(fn); }
  setRenderFn(fn: () => void) { this.renderFn = fn; }

  private onResize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05); // clamp big stalls
      const elapsed = this.clock.elapsedTime;
      for (const u of this.updaters) u(dt, elapsed);
      if (this.renderFn) this.renderFn();
      else this.renderer.render(this.scene, this.camera);
      this.monitor(dt);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.clock.stop();
  }

  private monitor(dt: number) {
    if (dt <= 0) return;
    const fpsNow = 1 / dt;
    this.fpsSamples.push(fpsNow);
    if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    if (this.lockTier) return;
    if (this.monitorCooldown > 0) { this.monitorCooldown -= dt; return; }
    if (this.fpsSamples.length < 60) return;

    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.fps = avg;
    // hysteresis: step down hard if struggling, step up cautiously if comfortable
    if (avg < 40 && this.tier > 0) {
      this.setTier((this.tier - 1) as QualityTier);
      this.monitorCooldown = 4;
      this.fpsSamples.length = 0;
    } else if (avg > 58 && this.tier < 3 && !matchMedia('(pointer: coarse)').matches) {
      this.setTier((this.tier + 1) as QualityTier);
      this.monitorCooldown = 6;
      this.fpsSamples.length = 0;
    }
  }

  dispose() {
    this.stop();
    removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.dispose();
  }
}
