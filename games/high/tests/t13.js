const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', difficulty: 'hard', size: 100, seed: 8 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const info = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true;
    d.advance(60 * 24);
    // find biggest cluster of enemy-vs-enemy engaged units
    let best = null, bn = 0;
    for (const u of G.units) { if (u.dead || u.state !== 'attack') continue; let n = 0; for (const o of G.units) if (!o.dead && Math.hypot(o.x - u.x, o.y - u.y) < 6) n++; if (n > bn) { bn = n; best = u; } }
    const t0 = performance.now(); for (let i = 0; i < 30; i++) renderFrame(0.016); const rms = (performance.now() - t0) / 30;
    const t1 = performance.now(); for (let i = 0; i < 30; i++) tick(0.05); const tms = (performance.now() - t1) / 30;
    if (best) { centerCamOn(best.x, best.y); d.R.cam.zoom = 1.35; }
    d.R.fogDirty = true;
    return { units: G.units.length, blds: G.buildings.length, res: G.resources.length, renderMs: rms.toFixed(1), tickMs: tms.toFixed(2), cluster: bn, fx: G.fx.length, proj: G.projectiles.length };
  });
  console.log(JSON.stringify(info));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: '/tmp/battle.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
