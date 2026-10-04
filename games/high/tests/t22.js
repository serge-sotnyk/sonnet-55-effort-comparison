const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'easy', size: 80, seed: 5 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const res = await page.evaluate(async () => {
    const G = window.__dbg.G; G.paused = true; const out = [];
    const clear = () => { for (const u of G.units) u.dead = true; for (const b of G.buildings) if (b.owner === 1) { b.dead = true; freeBuilding(b); } cleanup(); for (const r of G.resources) if (Math.hypot(r.x - 40, r.y - 40) < 18) removeResource(r); cleanup(); for (let y = 25; y < 55; y++) for (let x = 25; x < 55; x++) G.map.terrain[y * 80 + x] = 0; };
    for (const [type, n, bt, extra] of [['militia', 30, 'barracks'], ['archer', 20, 'barracks'], ['militia', 30, 'towncenter'], ['archer', 20, 'towncenter'], ['ram', 4, 'towncenter'], ['trebuchet', 3, 'castle'], ['mangonel', 4, 'towncenter'], ['champion', 20, 'castle']]) {
      clear();
      const b = spawnBuilding(bt, 1, 40, 40, true);
      G.players[1].age = 3;
      const us = [];
      for (let i = 0; i < n; i++) us.push(spawnUnit(type, 0, 28 + (i % 6) * 0.8, 38 + Math.floor(i / 6) * 0.8));
      for (const u of us) orderAttack(u, b);
      let t = 0;
      for (; t < 400 && !b.dead; t += 0.05) tick(0.05);
      out.push(`${n} ${type} vs ${bt}: ${b.dead ? 'destroyed in ' + t.toFixed(0) + 's' : 'survived hp ' + b.hp.toFixed(0)} | attackers alive ${us.filter(u => !u.dead).length}/${n}`);
    }
    return out;
  });
  console.log(res.join('\n'));
  console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
})();
