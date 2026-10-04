const { launch } = require('./harness');
const seed = +process.argv[2] || 1, mins = +process.argv[3] || 60;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((seed) => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }), seed);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const out = await page.evaluate((mins) => {
    const d = window.__dbg, G = d.G; G.paused = true; const res = []; let maxMs = 0;
    for (let m = 1; m <= mins; m++) {
      const t0 = performance.now(); d.advance(60); maxMs = Math.max(maxMs, performance.now() - t0);
      if (m % 5 === 0 || G.over) res.push(`${m}m ` + G.players.map(p => `a${p.age} pop${p.pop} v${G.units.filter(u=>u.owner===p.id&&u.def.id==='villager').length} mil${G.units.filter(u=>u.owner===p.id&&u.def.id!=='villager').length} b${G.buildings.filter(b=>b.owner===p.id).length} k${p.stat.kills}`).join(' | '));
      if (G.over) { res.push('OVER winner=p' + G.winner + ' at ' + (G.time / 60).toFixed(1) + 'm'); break; }
    }
    res.push('max 60s sim ms ' + maxMs.toFixed(0));
    return res;
  }, mins);
  console.log(`seed ${seed}`); console.log(out.join('\n'));
  console.log(logs.slice(0, 5).join('\n') || 'no errors');
  await browser.close();
})();
