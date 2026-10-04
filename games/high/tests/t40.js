const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  for (let trial = 0; trial < 3; trial++) {
    await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 3, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
    await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
    const r = await page.evaluate(() => {
      const d = window.__dbg, G = d.G; G.paused = true;
      let stall = null;
      for (let m = 1; m <= 55 && !G.over; m++) {
        d.advance(60);
        if (m >= 38) {
          for (const w of [0, 1]) {
            const me = G.players[w], op = G.players[1 - w];
            const myArmy = G.units.filter(u => u.owner === w && u.def.id !== 'villager' && !u.dead);
            const opB = G.buildings.filter(b => b.owner === 1 - w && !b.dead && !['farm', 'palisade', 'stonewall', 'gate'].includes(b.type));
            if (myArmy.length > 60 && opB.length > 0 && opB.length < 15 && op.pop < 40) { stall = { m, w, n: myArmy.length, opB: opB.map(b => b.type + '@' + b.x + ',' + b.y + (b.built ? '' : '*')), wave: me.ai.wave ? me.ai.wave.ids.size : null, states: myArmy.reduce((a, u) => (a[u.state] = (a[u.state] || 0) + 1, a), {}), waves: me.ai.waves, sinceEnd: me.ai.t - me.ai.lastWaveEnd, threat: me.ai.threat && (G.time - me.ai.threatT), centroid: myArmy.reduce((a, u) => [a[0] + u.x / myArmy.length, a[1] + u.y / myArmy.length], [0, 0]), t: me.ai.t }; break; }
          }
        }
        if (stall) break;
      }
      return { over: G.over, winner: G.winner, time: (G.time / 60).toFixed(1), stall };
    });
    console.log(trial, JSON.stringify(r));
    if (r.stall) break;
  }
  await browser.close();
})();
