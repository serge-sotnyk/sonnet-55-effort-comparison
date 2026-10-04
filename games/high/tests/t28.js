const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 777 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true; d.advance(20 * 60);
    return G.players.map((p) => {
      const ai = p.ai; const S = ai.scan();
      return { id: p.id, age: p.age, res: p.res, blds: Object.fromEntries(Object.entries(S.blds).map(([k, v]) => [k, v.length])), unbuilt: Object.fromEntries(Object.entries(S.unbuilt).map(([k, v]) => [k, v.length])), pending: ai.agePending, vills: S.vills.length, avail: techAvailable(p, ['', 'feudal', 'castle', 'imperial'][p.age + 1]), researching: [...p.researching], tcq: S.tcs.map(t => t.queue.map(q => q.id + ':' + Math.round(q.left))) };
    });
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
