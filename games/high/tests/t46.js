const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 3, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true; let o = {};
    for (let m = 1; m <= 50; m++) {
      d.advance(60);
      const cnt = [0, 1].map(w => G.buildings.filter(b => b.owner === w && !['farm', 'palisade', 'stonewall', 'gate'].includes(b.type)).length);
      const popL = [0, 1].map(w => G.players[w].pop);
      const loser = cnt[0] < cnt[1] ? 0 : 1; o.pop = popL; o.cnt = cnt;
      if (m >= 50) {
        const win = 1 - loser;
        const lb = G.buildings.filter(b => b.owner === loser && !b.dead);
        o.m = m; o.loser = loser;
        o.left = lb.map(b => `${b.type}@${b.x},${b.y} built=${b.built} hp=${Math.round(b.hp)} age=${b.age}`);
        const army = G.units.filter(u => u.owner === win && u.def.id !== 'villager');
        o.army = army.length; o.states = army.reduce((a, u) => (a[u.state] = (a[u.state] || 0) + 1, a), {});
        const c = army.reduce((a, u) => [a[0] + u.x / army.length, a[1] + u.y / army.length], [0, 0]); o.centroid = c.map(Math.round);
        const ai = G.players[win].ai; o.wave = ai.wave && ai.wave.ids.size; o.waves = ai.waves; o.threat = ai.threat && (G.time - ai.threatT);
        o.reach = lb.filter(b => !['farm', 'palisade', 'stonewall', 'gate'].includes(b.type)).map(b => { const r = G.map.findPath(c[0], c[1], b.x, b.y, b.x + b.size, b.y + b.size, 1.2, win, 30000); return b.type + ':' + (r.partial ? 'UNREACHABLE end=' + r.path[r.path.length - 1].map(v => Math.round(v)) : 'ok'); });
        o.cache = ai.reachCache;
        // sample 3 army units
        o.sample = army.slice(0, 4).map(u => ({ s: u.state, x: +u.x.toFixed(1), y: +u.y.toFixed(1), dest: u.dest, tgt: u.target && u.target.type }));
        return o;
      }
    }
    return { none: true };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
