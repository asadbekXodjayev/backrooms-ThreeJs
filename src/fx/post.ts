import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QualityTier } from '../core/Engine';

// Found-footage / analog-horror grade in a single fragment pass: chromatic
// aberration, film grain, vignette, scanlines, and a faint VHS tracking wobble.
// Intensities are driven by sanity, so the image degrades as the mind does.
const FoundFootageShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    aberration: { value: 0.0015 },
    grain: { value: 0.06 },
    vignette: { value: 1.0 },
    scanline: { value: 0.06 },
    vhs: { value: 0.0 },     // 0..1 tracking-distortion amount (sanity-driven)
    enabled: { value: 1.0 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float time, aberration, grain, vignette, scanline, vhs, enabled;
    uniform vec2 resolution;

    float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }

    void main() {
      vec2 uv = vUv;

      if (enabled < 0.5) { gl_FragColor = texture2D(tDiffuse, uv); return; }

      // VHS tracking wobble: horizontal jitter that scrolls vertically
      float wob = vhs * (sin(uv.y*180.0 + time*8.0)*0.0015 + (hash(vec2(time*0.7, floor(uv.y*80.0)))-0.5)*0.004);
      uv.x += wob;

      // chromatic aberration grows toward the edges (and with vhs)
      float amt = aberration * (1.0 + vhs*3.0);
      vec2 dir = uv - 0.5;
      vec4 col;
      col.r = texture2D(tDiffuse, uv + dir*amt).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir*amt).b;
      col.a = 1.0;

      // scanlines
      float sl = 1.0 - scanline * (0.5 + 0.5*sin(uv.y*resolution.y*1.6));
      col.rgb *= sl;

      // film grain
      float g = (hash(uv*resolution.xy + time*60.0) - 0.5) * grain;
      col.rgb += g;

      // vignette
      float v = smoothstep(0.95, 0.25, length(dir)*1.35);
      col.rgb *= mix(1.0, v, vignette*0.9);

      // rare horizontal dropout bar when sanity is very low
      float bar = step(0.997, hash(vec2(floor(time*4.0), floor(uv.y*30.0)))) * vhs;
      col.rgb = mix(col.rgb, vec3(0.05,0.05,0.04), bar*0.6);

      gl_FragColor = col;
    }
  `,
};

export class PostFX {
  composer: EffectComposer;
  private ff: ShaderPass;
  private bloom: UnrealBloomPass;
  private renderer: THREE.WebGLRenderer;
  private time = 0;
  private reducedMotion: boolean;
  enabled = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, tier: QualityTier, reducedMotion: boolean) {
    this.renderer = renderer;
    this.reducedMotion = reducedMotion;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.7, 0.82);
    this.bloom.enabled = tier >= 2;
    this.composer.addPass(this.bloom);

    this.ff = new ShaderPass(FoundFootageShader);
    this.composer.addPass(this.ff);

    this.composer.addPass(new OutputPass());

    this.setSize();
    addEventListener('resize', this.setSize);
    this.setTier(tier);
  }

  private setSize = () => {
    const dpr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(innerWidth, innerHeight);
    (this.ff.uniforms.resolution.value as THREE.Vector2).set(innerWidth * dpr, innerHeight * dpr);
  };

  setTier(tier: QualityTier) {
    this.bloom.enabled = tier >= 2;
    // potato: reduce grain/scanline cost-feel; the pass itself stays (cheap)
    this.ff.uniforms.grain.value = tier <= 1 ? 0.04 : 0.06;
    this.setSize();
  }

  setVHSEnabled(on: boolean) {
    // when off, the shader's `enabled` branch returns the raw image
    this.ff.uniforms.enabled.value = on ? 1 : 0;
  }

  setReducedMotion(r: boolean) { this.reducedMotion = r; }

  /** sanity 0..1 → degrade the image as it drops. */
  setSanity(sanity: number) {
    const s = 1 - sanity;
    this.ff.uniforms.aberration.value = 0.0012 + s * 0.004;
    this.ff.uniforms.vignette.value = 0.85 + s * 0.6;
    this.ff.uniforms.vhs.value = this.reducedMotion ? s * 0.15 : s * s * 0.9;
    this.ff.uniforms.scanline.value = this.reducedMotion ? 0.02 : 0.05 + s * 0.05;
    this.bloom.strength = 0.42 + s * 0.25;
  }

  update(dt: number) {
    this.time += dt;
    this.ff.uniforms.time.value = this.reducedMotion ? 0 : this.time;
  }

  render() { this.composer.render(); }

  dispose() {
    removeEventListener('resize', this.setSize);
    this.composer.dispose();
  }
}
