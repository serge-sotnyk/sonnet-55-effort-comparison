const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 1, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true; d.advance(60 * 22);
    const p = G.players[0], ai = p.ai, S = ai.scan();
    const o = { age: p.age, res: p.res, pop: p.pop + '/' + p.popCap, blds: Object.fromEntries(Object.entries(S.blds).map(([k, v]) => [k, v.length])), armyPop: S.armyPop, threat: ai.threat, threatT: ai.threatT, now: G.time, wave: !!ai.wave, queues: Object.entries(S.blds).filter(([k, v]) => v.some(b => b.queue.length)).map(([k, v]) => k + ':' + v.map(b => b.queue.length)), pending: ai.agePending };
    // try one training call manually
    const ec = ai.enemyComp(S);
    o.picks = ['barracks', 'archery', 'stable', 'siege', 'monastery', 'castle'].map(t => t + '=' + ai.pickUnit(S, t, ec));
    const bar = S.blds.barracks && S.blds.barracks[0];
    if (bar) { o.barQ = bar.queue.length; o.barAvail = unitAvailableAt(p, bar, 'militia') + '/' + unitAvailableAt(p, bar, 'spearman'); }
    return o;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
