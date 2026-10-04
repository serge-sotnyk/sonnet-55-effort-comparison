const { launch } = require('./harness');
const mins = +process.argv[2] || 14, seed = +process.argv[3] || 4242;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((seed) => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'hard', size: 80, seed }), seed);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  await page.evaluate((mins) => { const d = window.__dbg; d.G.paused = true; d.advance(mins * 60); }, mins);
  for (const [i, who] of [[0, 0], [1, 1]]) {
    await page.evaluate((who) => { const d = window.__dbg, G = d.G; const tc = G.buildings.find(b => b.owner === who && b.type === 'towncenter'); centerCamOn(tc.x + 2, tc.y + 6); d.R.cam.zoom = 1; d.R.fogDirty = true; }, who);
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `/tmp/base${i}.png` });
  }
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
