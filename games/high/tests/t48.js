const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'easy', size: 80, seed: 5 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__dbg.G; G.paused = true; const o = [];
    for (const u of G.units) u.dead = true; cleanup();
    for (const r of G.resources) if (Math.hypot(r.x - 40, r.y - 40) < 18) removeResource(r); cleanup();
    for (let y = 25; y < 55; y++) for (let x = 25; x < 55; x++) G.map.terrain[y * 80 + x] = 0;
    G.players[0].ai = null; G.players[1].ai = null;
    // 4-thick tree wall at x=40..43
    const trees = [];
    for (let y = 0; y < 80; y++) for (let x = 40; x < 44; x++) if (!G.map.occ[y * 80 + x] && !G.map.terrain[y * 80 + x]) trees.push(spawnResource('tree', x, y));
    const u = spawnUnit('militia', 0, 36, 40);
    orderMove(u, 48, 40); for (let t = 0; t < 10; t += 0.05) tick(0.05);
    o.push('blocked by forest: unit at ' + u.x.toFixed(1) + ' (goal 48)');
    const pf = G.map.findPath(36, 40, 48, 40, 48, 40, 0.75, 0, 40000, true);
    o.push('tree path len ' + pf.path.length + ' partial=' + pf.partial);
    const ts = []; for (const p of pf.path) { const i = Math.floor(p[1]) * 80 + Math.floor(p[0]); if (G.map.tree[i]) ts.push(G.byId.get(G.map.occ[i])); }
    o.push('trees on corridor: ' + ts.length);
    const us = [u, spawnUnit('militia', 0, 36, 41), spawnUnit('militia', 0, 36, 39)];
    ts.forEach((tr, i) => orderChop(us[i % 3], tr, ts.slice(i + 1)));
    for (let t = 0; t < 6; t += 0.5) { for (let k = 0; k < 10; k++) tick(0.05); o.push('t=' + t + ' ' + us.map(x => x.state + ':' + (x.target ? x.target.type + '@' + x.target.x : '-') + ':pend' + x.pathPending + ':path' + (x.path ? x.path.length : 'n') + ':' + x.x.toFixed(1)).join(' | ')); }
    for (let t = 0; t < 80; t += 0.05) tick(0.05);
    const left = ts.filter(t => !t.dead).length;
    o.push('after chopping: trees left of corridor ' + left);
    orderMove(us[0], 48, 40); for (let t = 0; t < 25; t += 0.05) tick(0.05);
    o.push('unit now at ' + us[0].x.toFixed(1) + ',' + us[0].y.toFixed(1));
    return o;
  });
  console.log(r.join('\n'));
  console.log(logs.slice(0, 5).join('\n') || 'no errors');
  await browser.close();
})();
