import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
async function cap(w, h, tag) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `qa/shots/ui-menu-${tag}.png` });
  await p.click('[data-act="enter"]');
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  await p.screenshot({ path: `qa/shots/ui-pause-${tag}.png` });
  // open settings from pause
  await p.click('#pause [data-act="settings"]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `qa/shots/ui-settings-${tag}.png` });
  await p.close();
}
await cap(1280, 720, 'desktop');
await cap(390, 780, 'mobile');
await b.close();
console.log('ui shots done');
