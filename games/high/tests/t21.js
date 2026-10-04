const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch({ w: 1440, h: 860, dsf: 2 });
  await page.evaluate(() => window.__dbg.start({ civ: 'britons', difficulty: 'hard', size: 80, seed: 31337, observer: true }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  await page.evaluate(() => { const d = window.__dbg, G = d.G; G.paused = true; d.advance(60 * 9); const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter'); centerCamOn(tc.x + 1, tc.y + 5); d.R.cam.zoom = 1.3; G.paused = false; });
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: '/tmp/retina.png', clip: { x: 300, y: 150, width: 700, height: 400 } });
  console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
})();
