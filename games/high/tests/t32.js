const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch({ w: 1400, h: 800 });
  for (const style of ['forest', 'lakes', 'open']) {
    await page.evaluate((style) => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'easy', size: 100, seed: 4711, style, startAge: 1 }), style);
    await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
    await page.evaluate(() => { centerCamOn(50, 50); R.cam.zoom = 0.5; R.fogDirty = true; });
    await sleep(500);
    await page.screenshot({ path: `/tmp/style_${style}.png` });
    console.log(style, await page.evaluate(() => ({ trees: G.resources.filter(r => r.type === 'tree').length, water: G.map.terrain.reduce((a, b) => a + b, 0), age: G.players[0].age, tcAge: G.buildings[0].age })));
  }
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
