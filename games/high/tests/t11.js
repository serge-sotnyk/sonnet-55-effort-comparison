const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'easy', size: 80, seed: 5 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const duels = [
    ['militia', 10, 'militia', 10], ['spearman', 10, 'scout', 10], ['knight', 8, 'spearman', 8], ['knight', 8, 'archer', 8], ['archer', 10, 'militia', 10], ['archer', 10, 'skirm', 10],
    ['skirm', 10, 'archer', 10], ['knight', 8, 'knight', 8], ['longsword', 10, 'archer', 10], ['archer', 12, 'knight', 6], ['cavarcher', 8, 'spearman', 8], ['ram', 3, 'militia', 5], ['mangonel', 4, 'archer', 10], ['monk', 4, 'militia', 6],
    ['longbowman', 10, 'knight', 6], ['teutonicknight', 6, 'knight', 6], ['mangudai', 8, 'archer', 8], ['throwingaxe', 10, 'militia', 10], ['champion', 8, 'knight', 8], ['xbow', 10, 'longsword', 8],
  ];
  const res = await page.evaluate(async (duels) => {
    const G = window.__dbg.G;
    G.paused = true;
    const out = [];
    for (const [a, na, b, nb] of duels) {
      // clear
      for (const u of G.units) { if (u.def.id !== 'x') { u.dead = true; } }
      cleanup();
      const cx = 40, cy = 40;
      for (const r of G.resources) if (Math.hypot(r.x - cx, r.y - cy) < 20) removeResource(r);
      cleanup();
      for (let y = 25; y < 55; y++) for (let x = 25; x < 55; x++) G.map.terrain[y * 80 + x] = 0;
      const ua = [], ub = [];
      for (let i = 0; i < na; i++) ua.push(spawnUnit(a, 0, 33 + (i % 5) * 0.8, 36 + Math.floor(i / 5) * 0.8));
      for (let i = 0; i < nb; i++) ub.push(spawnUnit(b, 1, 47 + (i % 5) * 0.8, 36 + Math.floor(i / 5) * 0.8));
      // both aggressive: attack-move to the other side
      for (const u of ua) orderAMove(u, 47, 38);
      for (const u of ub) orderAMove(u, 33, 38);
      for (let t = 0; t < 120; t += 0.05) { tick(0.05); if (!ua.some(u => !u.dead) || !ub.some(u => !u.dead)) break; }
      const la = ua.filter(u => !u.dead), lb = ub.filter(u => !u.dead);
      out.push(`${na} ${a} vs ${nb} ${b}: -> ${la.length} ${a} (${la.reduce((s,u)=>s+u.hp,0).toFixed(0)}hp) | ${lb.length} ${b} (${lb.reduce((s,u)=>s+u.hp,0).toFixed(0)}hp)  t=${G.time.toFixed(0)}`);
    }
    return out;
  }, duels);
  console.log(res.join('\n'));
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
