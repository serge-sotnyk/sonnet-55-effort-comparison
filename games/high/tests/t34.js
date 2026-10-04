const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'easy', size: 80, seed: 5 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const G = window.__dbg.G; G.paused = true; const o = [];
    for (const u of G.units) u.dead = true; cleanup();
    for (const r of G.resources) if (Math.hypot(r.x - 40, r.y - 40) < 16) removeResource(r); cleanup();
    for (let y = 25; y < 55; y++) for (let x = 25; x < 55; x++) G.map.terrain[y * 80 + x] = 0;
    G.players[0].ai = null; G.players[1].ai = null; G.players[0].age = 2;
    const tw = spawnBuilding('tower', 0, 40, 40, true);
    const ms = []; for (let i = 0; i < 4; i++) ms.push(spawnUnit(i < 3 ? 'militia' : 'villager', 0, 36 + i, 44));
    for (const m of ms) orderGarrison(m, tw);
    for (let t = 0; t < 12; t += 0.05) tick(0.05);
    o.push('tower garrison ' + tw.garrison.map(u => u.type).join(',') + ' (villager refused in tower expected)');
    const e1 = spawnUnit('militia', 1, 46, 40);
    const e2 = spawnUnit('archer', 1, 47, 41);
    const hp0 = e1.hp + e2.hp;
    for (let t = 0; t < 10; t += 0.05) tick(0.05);
    o.push('enemies hp ' + hp0 + ' -> ' + ((e1.dead ? 0 : e1.hp) + (e2.dead ? 0 : e2.hp)).toFixed(0) + ' dead:' + e1.dead + ',' + e2.dead);
    ungarrisonAll(tw); o.push('after unload garrison ' + tw.garrison.length);
    return o;
  });
  console.log(r.join('\n'));
  await browser.close();
})();
