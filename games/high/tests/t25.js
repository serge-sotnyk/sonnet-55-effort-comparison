const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch({ w: 1280, h: 720 });
  await sleep(2500);
  await page.screenshot({ path: '/tmp/small_menu.png' });
  await page.evaluate(() => window.__dbg.start({ civ: 'mongols', difficulty: 'moderate', size: 80, seed: 12 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden') && gameState === 'playing', { timeout: 60000 });
  await page.evaluate(() => { const G = window.__dbg.G, UI = window.__dbg.UI; G.speed = 4; const vs = G.units.filter(u => u.owner === 0 && u.def.id === 'villager'); UI.setSel(vs); });
  await sleep(6000);
  await page.screenshot({ path: '/tmp/small_game.png' });
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
