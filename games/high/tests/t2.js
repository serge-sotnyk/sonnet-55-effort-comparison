// AI vs AI observer soak test: run sim fast, log progress
const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'franks', difficulty: 'moderate', size: 80, seed: 777 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const out = await page.evaluate(async () => {
    const d = window.__dbg, G = d.G; d.UI.setSel && 0;
    G.paused = true; // we step manually
    const res = [];
    for (let m = 1; m <= 20; m++) {
      const t0 = performance.now();
      d.advance(60);
      const ms = performance.now() - t0;
      const row = G.players.map((p) => `${p.name.slice(0,8)} age${p.age} pop${p.pop}/${p.popCap} F${Math.floor(p.res.food)} W${Math.floor(p.res.wood)} G${Math.floor(p.res.gold)} S${Math.floor(p.res.stone)} v${G.units.filter(u=>u.owner===p.id&&u.def.id==='villager').length} mil${G.units.filter(u=>u.owner===p.id&&u.def.id!=='villager').length} b${G.buildings.filter(b=>b.owner===p.id).length}`);
      res.push(`t=${m}min (${ms.toFixed(0)}ms) | ` + row.join(' | '));
      if (G.over) { res.push('OVER winner ' + G.winner); break; }
    }
    return res;
  });
  console.log(out.join('\n'));
  await page.evaluate(() => { window.__dbg.G.paused = false; });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/tmp/obs1.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
