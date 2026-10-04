const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch({ w: 1900, h: 1100 });
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'easy', size: 100, seed: 99 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const info = await page.evaluate((ageSel) => {
    const d = window.__dbg, G = d.G; G.paused = true;
    // clear area: remove trees/res around center
    const cx = 50, cy = 50;
    for (const r of G.resources) if (Math.abs(r.x - cx) < 30 && Math.abs(r.y - cy) < 30) removeResource(r);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) if (Math.abs(x - cx) < 32 && Math.abs(y - cy) < 32) G.map.terrain[y * 100 + x] = 0;
    cleanup();
    const types = ['house','towncenter','mill','lumber','mining','barracks','archery','stable','siege','blacksmith','market','monastery','university','castle','tower','farm'];
    let x = 24, y = 24, rowH = 0;
    const p = G.players[0];
    const placed = [];
    for (const age of [0, 1, 2, 3]) {
      x = 24;
      types.forEach((t, i) => {
        const def = BUILDINGS[t];
        const b = spawnBuilding(t, 0, x, y, true);
        b.age = age;
        x += def.size + 1.2; if (i === 7) { x = 24; y += 6; }
      });
      y += 7;
    }
    d.R.fogDirty = true;
    return placed;
  });
  await page.evaluate(() => { centerCamOn(40, 40); window.__dbg.R.cam.zoom = 0.9; });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/tmp/gallery.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
