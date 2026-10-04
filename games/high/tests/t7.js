const { launch } = require('./harness');
const mins = +process.argv[2] || 30, diff = process.argv[3] || 'hard', seed = +process.argv[4] || 4242;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((diff, seed) => window.__dbg.start({ observer: true, civ: 'britons', difficulty: diff, size: 80, seed }), diff, seed);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const out = await page.evaluate(async (mins) => {
    const d = window.__dbg, G = d.G; G.paused = true;
    const res = [];
    for (let s = 0; s < mins; s++) {
      const t0 = performance.now();
      d.advance(60);
      const ms = performance.now() - t0;
      const ps = G.players.map((p) => `${p.civ.slice(0,3)} a${p.age} pop${p.pop}/${p.popCap} v${G.units.filter(u=>u.owner===p.id&&u.def.id==='villager').length} m${G.units.filter(u=>u.owner===p.id&&u.def.id!=='villager').length} b${G.buildings.filter(b=>b.owner===p.id).length} k${p.stat.kills} F${Math.floor(p.res.food)} W${Math.floor(p.res.wood)} G${Math.floor(p.res.gold)} S${Math.floor(p.res.stone)}`);
      res.push(`${s+1}m ${ms.toFixed(0)}ms ` + ps.join(' | '));
      if (G.over) { res.push('OVER winner=' + G.winner + ' at ' + G.time.toFixed(0)); break; }
    }
    return res;
  }, mins);
  console.log(out.join('\n'));
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
