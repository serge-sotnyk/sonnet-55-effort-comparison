const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'franks', difficulty: 'moderate', size: 80, seed: 777 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const out = await page.evaluate(async () => {
    const d = window.__dbg, G = d.G; G.paused = true;
    d.advance(450);
    const res = [];
    for (const b of G.buildings) if (b.owner === 0 && !b.built) res.push(`${b.type} at ${b.x},${b.y} prog ${b.progress.toFixed(2)} born ${b.bornAt.toFixed(0)} workers ${b.buildRate}`);
    const vs = G.units.filter(u => u.owner === 0 && u.def.id === 'villager');
    for (const v of vs) res.push(`v${v.id} ${v.state} ${v.gs||''} tgt=${v.target? v.target.type+'#'+v.target.id:'-'} at ${v.x.toFixed(1)},${v.y.toFixed(1)} path=${v.path?v.path.length:'null'} pend=${v.pathPending} pf=${v.pathFail} carry=${Math.floor(v.carry.amount)}`);
    return res;
  });
  console.log(out.join('\n'));
  await browser.close();
})();
