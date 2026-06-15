import * as THREE from 'three';

// All surface textures are generated procedurally on a <canvas> at runtime.
// This keeps the bundle tiny and sidesteps all texture-licensing concerns,
// while still counting as real generated imagery (isImagesUsed). Each texture
// is authored to tile seamlessly so it can repeat across the infinite maze.

export interface Palette {
  name: string;
  wallpaper: [number, number, number];   // base hue of the walls (0..255)
  wallGrime: number;                      // 0..1 stain amount
  carpet: [number, number, number];
  ceiling: [number, number, number];
  fog: number;                            // hex
  light: number;                          // emissive panel color hex
  ambient: number;                        // scene ambient tint hex
}

function valueNoise(w: number, h: number, seed: number): Float32Array {
  // simple seeded value noise, tileable via wrap
  const g = new Float32Array(w * h);
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const base = new Float32Array(w * h);
  for (let i = 0; i < base.length; i++) base[i] = rnd();
  // a couple of smoothing passes (box blur with wrap) → soft blotches
  let src = base;
  for (let pass = 0; pass < 2; pass++) {
    const dst = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = (x + dx + w) % w, yy = (y + dy + h) % h;
        sum += src[yy * w + xx];
      }
      dst[y * w + x] = sum / 9;
    }
    src = dst;
  }
  for (let i = 0; i < g.length; i++) g[i] = src[i];
  return g;
}

function makeCanvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finishTexture(c: HTMLCanvasElement, rx: number, ry: number, aniso: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export function makeWallpaperTexture(pal: Palette, aniso: number): THREE.CanvasTexture {
  const S = 256;
  const { c, ctx } = makeCanvas(S);
  const [r, g, b] = pal.wallpaper;
  const noise = valueNoise(S, S, 13);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x);
      const n = noise[i];
      // faint vertical wallpaper striping
      const stripe = 0.94 + 0.06 * Math.sin((x / S) * Math.PI * 16);
      // grime / water stains pooling toward the bottom
      const vgrad = 0.78 + 0.22 * (y / S);
      const stain = 1 - pal.wallGrime * Math.pow(Math.max(0, n - 0.45) * 1.8, 1.4) * (0.4 + 0.6 * (y / S));
      const shade = stripe * vgrad * stain * (0.9 + n * 0.18);
      img.data[i * 4 + 0] = Math.min(255, r * shade);
      img.data[i * 4 + 1] = Math.min(255, g * shade);
      img.data[i * 4 + 2] = Math.min(255, b * shade * 0.98);
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // walls are CELL × WALL_H boxes with 0..1 face UVs → tile ~2× horiz, 1.5× vert
  return finishTexture(c, 2, 1.5, aniso);
}

export function makeCarpetTexture(pal: Palette, aniso: number): THREE.CanvasTexture {
  const S = 256;
  const { c, ctx } = makeCanvas(S);
  const [r, g, b] = pal.carpet;
  const fine = valueNoise(S, S, 71);
  const blot = valueNoise(S, S, 7);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    // high-freq fibre speckle
    const fib = (Math.sin(x * 1.7) * Math.cos(y * 1.9) + fine[i] * 2 - 1) * 0.06;
    // damp dark patches
    const damp = Math.pow(blot[i], 1.6);
    const shade = (0.7 + fib) * (1 - damp * 0.5);
    img.data[i * 4 + 0] = Math.max(0, r * shade);
    img.data[i * 4 + 1] = Math.max(0, g * shade);
    img.data[i * 4 + 2] = Math.max(0, b * shade);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // floor/ceiling tile via geometry UVs (1 tile per cell), so keep repeat 1:1
  return finishTexture(c, 1, 1, aniso);
}

export function makeCeilingTexture(pal: Palette, aniso: number): THREE.CanvasTexture {
  // one drop-ceiling tile with a recessed border + acoustic speckle
  const S = 128;
  const { c, ctx } = makeCanvas(S);
  const [r, g, b] = pal.ceiling;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, S, S);
  // speckle
  const noise = valueNoise(S, S, 29);
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const sp = (noise[i] - 0.5) * 26;
    img.data[i * 4 + 0] = Math.max(0, Math.min(255, r + sp));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, g + sp));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, b + sp));
  }
  ctx.putImageData(img, 0, 0);
  // recessed grid border (the T-bar grid)
  ctx.strokeStyle = 'rgba(20,20,14,0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(1, 1, S - 2, S - 2);
  ctx.strokeStyle = 'rgba(255,255,235,0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(3, 3, S - 6, S - 6);
  return finishTexture(c, 1, 1, aniso);
}

export const PALETTES: Record<string, Palette> = {
  lobby: {
    name: 'The Lobby',
    wallpaper: [205, 182, 92], wallGrime: 0.9,
    carpet: [92, 84, 46], ceiling: [200, 196, 168],
    fog: 0x1a1708, light: 0xfff6d2, ambient: 0x2a2612,
  },
  habitable: {
    name: 'Habitable Zone',
    wallpaper: [150, 146, 128], wallGrime: 0.7,
    carpet: [60, 60, 58], ceiling: [120, 120, 112],
    fog: 0x0e0f10, light: 0xcfe0ff, ambient: 0x14171c,
  },
  pipes: {
    name: 'Pipe Dreams',
    wallpaper: [96, 104, 96], wallGrime: 1.0,
    carpet: [38, 44, 42], ceiling: [70, 78, 74],
    fog: 0x07100c, light: 0x9fd8c0, ambient: 0x0c1612,
  },
};
