const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'franks', difficulty: 'moderate', size: 80, seed: 777 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const out = await page.evaluate(async () => {
    const d = window.__dbg, G = d.G; G.paused = true;
    const res = [];
    for (let s = 0; s < 8; s++) {
      d.advance(30);
      const vs = G.units.filter(u => u.owner === 0 && u.def.id === 'villager');
      const states = {};
      for (const v of vs) { const k = v.state + (v.gs ? ':' + v.gs : '') + (v.state==='gather'? ':'+v.lastResType:''); states[k] = (states[k] || 0) + 1; }
      const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter');
      res.push(`t=${(s+1)*30} ` + JSON.stringify(states) + ' TCq=' + tc.queue.length + ' ' + JSON.stringify(G.players[0].res));
    }
    return res;
  });
  console.log(out.join('\n'));
  await browser.close();
})();
