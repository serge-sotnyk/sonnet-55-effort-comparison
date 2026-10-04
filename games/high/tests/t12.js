const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'britons', difficulty: 'easy', size: 64, seed: 21, start: { food: 9999, wood: 9999, gold: 9999, stone: 9999 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const r1 = await page.evaluate(async () => {
    const G = window.__dbg.G; G.paused = true; const out = [];
    // monk conversion test
    const m = [spawnUnit('monk', 0, 30, 30), spawnUnit('monk', 0, 31, 30), spawnUnit('monk', 0, 32, 30)];
    const t = []; for (let i = 0; i < 4; i++) t.push(spawnUnit('militia', 1, 38 + i, 30));
    for (const mk of m) orderConvert(mk, t[0]);
    for (let s = 0; s < 40; s += 0.05) tick(0.05);
    out.push('converted? militia0 owner=' + t[0].owner + ' dead=' + t[0].dead + ' monk states ' + m.map(x=>x.state).join(','));
    // heal test
    const w = spawnUnit('militia', 0, 33, 33); w.hp = 5; orderHeal(m[0], w); for (let s = 0; s < 10; s += 0.05) tick(0.05);
    out.push('healed hp=' + w.hp.toFixed(1));
    return out;
  });
  console.log(r1.join('\n'));
  // total conquest
  const r2 = await page.evaluate(async () => {
    const G = window.__dbg.G; G.paused = true; const out = [];
    const p = G.players[0];
    p.age = 3; refreshStats(p);
    const eb = G.map.bases[1];
    const army = [];
    for (let i = 0; i < 30; i++) army.push(spawnUnit('champion', 0, eb[0] - 12 + (i % 6), eb[1] + Math.floor(i / 6)));
    for (let i = 0; i < 8; i++) army.push(spawnUnit('siegeram', 0, eb[0] - 14, eb[1] - 3 + i));
    // reveal
    for (const u of army) orderAMove(u, eb[0], eb[1]);
    for (let s = 0; s < 600 && !G.over; s += 0.05) {
      tick(0.05);
      if (Math.floor(s) % 20 === 0 && Math.abs(s - Math.round(s)) < 0.026) {
        // keep army engaged: send idle units to nearest enemy building
        for (const u of army) if (!u.dead && u.state === 'idle') { const tb = G.buildings.filter(b => b.owner === 1 && !b.dead).sort((a, b) => Math.hypot(ecx(a) - u.x, ecy(a) - u.y) - Math.hypot(ecx(b) - u.x, ecy(b) - u.y))[0]; if (tb) { if (u.def.tags.includes('ram')) orderAttack(u, tb); else orderAMove(u, ecx(tb), ecy(tb)); } }
      }
    }
    out.push('over=' + G.over + ' winner=' + G.winner + ' time=' + G.time.toFixed(0) + ' enemy buildings=' + G.buildings.filter(b => b.owner === 1).length + ' enemy units=' + G.units.filter(u => u.owner === 1 && !u.dead).length);
    return out;
  });
  console.log(r2.join('\n'));
  await page.evaluate(() => { G.paused = false; });
  await new Promise(r => setTimeout(r, 4500));
  await page.screenshot({ path: '/tmp/end.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
