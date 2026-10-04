const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 3, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true; const out = [];
    for (let m = 1; m <= 55 && !G.over; m++) {
      d.advance(60);
      if (m % 5 === 0) out.push(m + 'm ' + G.players.map((p, w) => { const A = G.units.filter(u => u.owner === w && u.def.id !== 'villager'); const siege = A.filter(u => u.def.tags.includes('siege')).length; const bl = G.buildings.filter(b => b.owner === w && !['farm','palisade','stonewall','gate'].includes(b.type)).length; return `a${p.age} pop${p.pop} army${A.length} siege${siege} bld${bl} wave${p.ai.wave ? p.ai.wave.ids.size : '-'} W${Math.floor(p.res.wood)}`; }).join(' | '));
    }
    const o = { out };
    for (const w of [0, 1]) {
      const A = G.units.filter(u => u.owner === w && u.def.id !== 'villager');
      o['states' + w] = A.reduce((a, u) => (a[u.state] = (a[u.state] || 0) + 1, a), {});
      const c = A.reduce((a, u) => [a[0] + u.x / A.length, a[1] + u.y / A.length], [0, 0]); o['centroid' + w] = c.map(Math.round);
      o['bld' + w] = G.buildings.filter(b => b.owner === w && !['farm','palisade','stonewall','gate'].includes(b.type)).map(b => b.type + '@' + b.x + ',' + b.y);
    }
    return o;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
