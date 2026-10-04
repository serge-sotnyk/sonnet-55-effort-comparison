const { launch } = require('./harness');
const diff = process.argv[2] || 'hard';
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((diff) => window.__dbg.start({ observer: true, civ: 'britons', difficulty: diff, size: 80, seed: 4242 }), diff);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true;
    const tally = {}; let samples = 0;
    const out = [];
    for (let t = 0; t < 600; t += 1) {
      d.advance(1, 0.05);
      for (const u of G.units) if (u.owner === 0 && u.def.id === 'villager' && !u.dead) {
        let k = u.state === 'gather' ? 'g:' + u.gs + ':' + (u.lastResType === 'tree' ? 'wood' : u.lastResType) : u.state;
        tally[k] = (tally[k] || 0) + 1; samples++;
      }
      if (t % 120 === 119) { out.push(`t=${t+1}: ` + JSON.stringify(G.players[0].res) + ' vills=' + G.units.filter(u => u.owner === 0 && u.def.id === 'villager').length); }
    }
    const rows = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${(v / samples * 100).toFixed(1)}%`);
    return { rows, out, gathered: G.players[0].stat.gathered };
  });
  console.log(r.rows.join('\n')); console.log(r.out.join('\n')); console.log(JSON.stringify(r.gathered));
  await browser.close();
})();
