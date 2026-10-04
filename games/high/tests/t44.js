const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 3, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true;
    d.advance(60 * 44);
    const calls = {}; const orig = window.requestPath;
    window.requestPath = function (u, rect, r2, exact) { const k = u.owner + ':' + u.state + ':' + u.type + (u.partial ? ':partial' : ''); calls[k] = (calls[k] || 0) + 1; return orig.apply(this, arguments); };
    d.advance(20);
    window.requestPath = orig;
    const top = Object.entries(calls).sort((a, b) => b[1] - a[1]).slice(0, 10);
    // sample a heavy unit
    const army = G.units.filter(u => u.def.id !== 'villager' && !u.dead);
    const st = {}; for (const u of army) { const k = u.owner + ':' + u.state; st[k] = (st[k] || 0) + 1; }
    const bld = [0, 1].map(w => G.buildings.filter(b => b.owner === w && !['farm', 'palisade', 'stonewall', 'gate'].includes(b.type)).length);
    const walls = G.buildings.filter(b => ['palisade', 'stonewall', 'gate'].includes(b.type)).length;
    return { top, st, bld, walls, over: G.over, pops: G.players.map(p => p.pop) };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
