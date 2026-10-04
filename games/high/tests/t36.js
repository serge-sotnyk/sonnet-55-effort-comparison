const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch({ w: 1920, h: 1080 });
  await page.evaluate(() => window.__dbg.start({ civ: 'franks', enemyCiv: 'teutons', difficulty: 'moderate', size: 80, seed: 8080, start: { food: 400, wood: 400, gold: 200, stone: 200 }, startAge: 1 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  await page.evaluate(() => {
    const d = window.__dbg, G = d.G, p = G.players[0];
    // human gets the AI macro for a while so the base looks lived-in
    p.ai = new AIPlayer(p, DIFFICULTY.hard);
    G.paused = true; d.advance(60 * 13);
    p.ai = null;
    const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter');
    centerCamOn(tc.x + 2, tc.y + 6); R.cam.zoom = 1; G.paused = false;
    const army = G.units.filter(u => u.owner === 0 && u.def.id !== 'villager' && u.def.id !== 'scout');
    UI.setSel(army.slice(0, 12));
  });
  await sleep(800);
  await page.screenshot({ path: '/tmp/hero.png' });
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
