// Live WebGL smoke harness (the qa-tester live pass): boots the built game in
// headless Chrome with software GL, captures console/page errors, drives the
// menu → gameplay flow, walks to exercise chunk streaming, and screenshots
// each state. Exits non-zero on any console error / page exception.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const TARGET = process.env.QA_URL || 'http://localhost:4173/';
const OUT = new URL('./shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(OUT, { recursive: true });

const errors = [];
const warnings = [];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('console', (m) => {
  const t = m.type();
  if (t === 'error') errors.push(m.text());
  else if (t === 'warning') warnings.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

async function shot(name) { await page.screenshot({ path: OUT + name + '.png' }); }

console.log('→ loading', TARGET);
await page.goto(TARGET, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot('01-menu');

// confirm WebGL actually came up
const gl = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return 'no-canvas';
  const ctx = c.getContext('webgl2') || c.getContext('webgl');
  return ctx ? 'webgl-ok' : 'no-webgl';
});
console.log('  WebGL:', gl);

// ENTER the game
await page.click('[data-act="enter"]');
await page.waitForTimeout(2500);
await shot('02-gameplay');

// walk forward + strafe to exercise the controller + chunk streaming + collision
async function holdKey(key, ms) {
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
}
await holdKey('w', 4000);
await shot('03-walked-forward');
await holdKey('d', 2500);
await holdKey('w', 4000);
await shot('04-walked-more');

// toggle flashlight + crouch + 3rd person, open journal
await page.keyboard.press('f'); await page.waitForTimeout(400);
await page.keyboard.press('f'); await page.waitForTimeout(400);
await page.keyboard.press('v'); await page.waitForTimeout(1200); await shot('05-thirdperson');
await page.keyboard.press('v'); await page.waitForTimeout(400);
await page.keyboard.press('Tab'); await page.waitForTimeout(800); await shot('06-journal');
await page.keyboard.press('Escape'); await page.waitForTimeout(600);

// long-ish walk to stress streaming + memory
for (let i = 0; i < 6; i++) { await holdKey('w', 1500); await holdKey('a', 800); }
await shot('07-after-roam');

// renderer stats (GPU-independent) + flat-memory check over more roaming
const metrics = await page.evaluate(() => {
  const g = window.__game;
  const info = g.engine.renderer.info;
  // render the scene directly (not through the composer) to read true scene stats
  g.engine.renderer.render(g.engine.scene, g.engine.camera);
  return {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    tier: g.engine.tier,
    heap: performance.memory ? performance.memory.usedJSHeapSize : 0,
  };
});
const heapBefore = metrics.heap;
for (let i = 0; i < 10; i++) { await holdKey('w', 1200); await holdKey('a', 600); await holdKey('w', 1200); await holdKey('d', 600); }
const heapAfter = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0));
const geos2 = await page.evaluate(() => window.__game.engine.renderer.info.memory.geometries);

await browser.close();

console.log('Draw calls:', metrics.drawCalls, '| triangles:', metrics.triangles,
  '| geometries:', metrics.geometries, '→', geos2, '| textures:', metrics.textures, '| tier:', metrics.tier);
console.log('Heap before roam:', (heapBefore / 1e6).toFixed(1) + 'MB', '→ after:', (heapAfter / 1e6).toFixed(1) + 'MB',
  '(Δ', ((heapAfter - heapBefore) / 1e6).toFixed(1) + 'MB)');
const heap = heapAfter;

console.log('\n==== QA SMOKE REPORT ====');
console.log('WebGL:', gl);
console.log('JS heap (bytes):', heap);
console.log('Console errors:', errors.length);
errors.slice(0, 30).forEach((e) => console.log('  ✗', e));
console.log('Console warnings:', warnings.length);
warnings.slice(0, 10).forEach((w) => console.log('  ⚠', w));
console.log('Screenshots in:', OUT);

if (gl !== 'webgl-ok') { console.error('FAIL: WebGL did not initialize'); process.exit(2); }
if (errors.length) { console.error('FAIL: console/page errors present'); process.exit(1); }
console.log('PASS');
