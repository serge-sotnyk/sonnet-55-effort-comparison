const { launch } = require('./harness');
const diff = process.argv[2] || 'hard', mins = +process.argv[3] || 9;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((diff) => window.__dbg.start({ observer: true, civ: 'britons', enemyCiv: 'teutons', difficulty: diff, difficulty2: diff, size: 100, seed: 2024 }), diff);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate((mins) => {
    const d = window.__dbg, G = d.G; G.paused = true; d.advance(mins * 60);
    const p = G.players[0];
    const cnt = {}; for (const b of G.buildings) if (b.owner === 0) cnt[b.type] = (cnt[b.type] || 0) + (b.built ? 1 : 0.001);
    const vs = G.units.filter(u => u.owner === 0 && u.def.id === 'villager');
    return { cnt, pop: p.pop + '/' + p.popCap, vills: vs.length, res: p.res, queue: G.buildings.filter(b => b.owner === 0 && b.queue.length).map(b => b.type + ':' + b.queue.length + (b.housed ? 'H' : '')) };
  }, mins);
  console.log(JSON.stringify(r));
  await browser.close();
})();
