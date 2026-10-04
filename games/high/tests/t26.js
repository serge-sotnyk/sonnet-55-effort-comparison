const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'franks', difficulty: 'easy', size: 80, seed: 77, start: { food: 3000, wood: 3000, gold: 2000, stone: 2000 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden') && gameState === 'playing', { timeout: 60000 });
  await page.mouse.click(900, 400);
  await page.evaluate(() => {
    const G = window.__dbg.G, p = G.players[0];
    const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter');
    const helper = new AIPlayer(p, DIFFICULTY.easy);
    for (const t of ['house', 'mill']) { const sp = helper.findSpot(t, tc.x, tc.y, 4, 9); spawnBuilding(t, 0, sp[0], sp[1], true); }
    G.speed = 4;
    cmdResearch(tc, 'feudal');
  });
  await page.waitForFunction(() => G.players[0].age === 1, { timeout: 60000 });
  await sleep(1500);
  await page.screenshot({ path: '/tmp/banner.png' });
  await sleep(6000);
  await page.screenshot({ path: '/tmp/tips.png', clip: { x: 0, y: 40, width: 700, height: 260 } });
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
