const { launch } = require('./harness');
const mins = +process.argv[2] || 8, diff = process.argv[3] || 'moderate';
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((diff) => window.__dbg.start({ observer: true, civ: 'franks', difficulty: diff, size: 80, seed: 777 }), diff);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const out = await page.evaluate(async (mins) => {
    const d = window.__dbg, G = d.G; G.paused = true;
    const ev = [];
    const orig = window.placeBuilding;
    const res = [];
    const seen = new Set();
    for (let s = 0; s < mins * 2; s++) {
      d.advance(30);
      for (const b of G.buildings) if (b.owner === 0 && !seen.has(b.id)) { seen.add(b.id); ev.push(`${Math.round(b.bornAt)}s ${b.type}`); }
      const ps = G.players.map((p) => `age${p.age} pop${p.pop}/${p.popCap} v${G.units.filter(u=>u.owner===p.id&&u.def.id==='villager').length} mil${G.units.filter(u=>u.owner===p.id&&u.def.id!=='villager').length} F${Math.floor(p.res.food)} W${Math.floor(p.res.wood)} G${Math.floor(p.res.gold)}`);
      if ((s + 1) % 2 === 0) res.push(`t=${(s+1)/2}m ` + ps.join(' | '));
      if (G.over) { res.push('OVER ' + G.winner); break; }
    }
    return { res, ev };
  }, mins);
  console.log(out.res.join('\n')); console.log(out.ev.join(', '));
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
