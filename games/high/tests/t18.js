const { launch } = require('./harness');
const d1 = process.argv[2] || 'hard', d0 = process.argv[3] || 'easy', seed = +process.argv[4] || 99, mins = +process.argv[5] || 40;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((d1, d0, seed) => window.__dbg.start({ observer: true, civ: 'franks', enemyCiv: 'mongols', difficulty: d1, difficulty2: d0, size: 80, seed }), d1, d0, seed);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const out = await page.evaluate((mins) => {
    const d = window.__dbg, G = d.G; G.paused = true; const res = [];
    for (let m = 1; m <= mins; m++) {
      d.advance(60);
      if (m % 5 === 0 || G.over) res.push(`${m}m ` + G.players.map(p => `${p.civ.slice(0,3)} a${p.age} pop${p.pop} v${G.units.filter(u=>u.owner===p.id&&u.def.id==='villager').length} mil${G.units.filter(u=>u.owner===p.id&&u.def.id!=='villager').length} b${G.buildings.filter(b=>b.owner===p.id).length} k${p.stat.kills}`).join(' | '));
      if (G.over) { res.push('OVER winner=p' + G.winner + ' at ' + (G.time/60).toFixed(1) + 'm'); break; }
    }
    return res;
  }, mins);
  console.log(`p0=${d0} p1=${d1} seed=${seed}`); console.log(out.join('\n'));
  console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
})();
