const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 3, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true; const out = [];
    for (let m = 1; m <= 50 && !G.over; m++) {
      let maxQ = 0, pend = 0, samples = 0;
      for (let s = 0; s < 60; s += 0.05) { tick(0.05); maxQ = Math.max(maxQ, G.pathQ.length); }
      pend = G.units.filter(u => u.pathPending).length;
      if (m % 4 === 0 || maxQ > 30) out.push(`${m}m maxQ=${maxQ} pendingNow=${pend} pathCalls=${G.map.pathStats.calls} nodes=${G.map.pathStats.nodes}`);
    }
    return out;
  });
  console.log(r.join('\n'));
  await browser.close();
})();
