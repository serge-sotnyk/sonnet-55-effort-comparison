const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', difficulty: 'hard', size: 100, seed: 8 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  await page.evaluate(() => { const d = window.__dbg, G = d.G; G.paused = true; d.advance(60 * 26); const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter'); centerCamOn(tc.x, tc.y + 4); d.R.cam.zoom = 1; G.paused = false; });
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 > 4000) res(n / 4); else requestAnimationFrame(f); } requestAnimationFrame(f); }));
  console.log('fps @1.7x, 1600x950:', fps.toFixed(1));
  await page.evaluate(() => { window.__dbg.R.cam.zoom = 0.5; });
  const fps2 = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 > 4000) res(n / 4); else requestAnimationFrame(f); } requestAnimationFrame(f); }));
  console.log('fps zoomed out 0.5:', fps2.toFixed(1));
  await page.screenshot({ path: '/tmp/t16.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
