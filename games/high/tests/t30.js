const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch({ w: 1400, h: 800 });
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', difficulty: 'easy', size: 80, seed: 5 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  await page.evaluate(() => {
    const G = window.__dbg.G; G.paused = true;
    for (const r of G.resources) if (Math.hypot(r.x - 40, r.y - 40) < 16) removeResource(r);
    cleanup();
    for (let y = 25; y < 55; y++) for (let x = 25; x < 55; x++) G.map.terrain[y * 80 + x] = 0;
    const p0 = G.players[0], p1 = G.players[1]; p0.age = 2; p1.age = 2; refreshStats(p0); refreshStats(p1);
    const mk = (t, x, y, o, prog, hpFrac) => { const b = spawnBuilding(t, o, x, y, prog >= 1); if (prog < 1) { b.progress = prog; b.hp = b.maxHp * prog; } if (hpFrac) b.hp = b.maxHp * hpFrac; b.age = 2; return b; };
    mk('barracks', 30, 34, 0, 0.45); mk('house', 35, 30, 0, 0.7); mk('castle', 40, 36, 0, 1, 0.3); mk('stable', 46, 30, 0, 1, 0.45); mk('towncenter', 30, 42, 0, 0.15);
    const tw = mk('tower', 52, 38, 1, 1);
    const vs = []; for (let i = 0; i < 4; i++) { const v = spawnUnit('villager', 0, 29 + i, 38); orderBuild(v, G.buildings.find(b => b.type === 'barracks')); }
    for (let i = 0; i < 3; i++) { const v = spawnUnit('villager', 0, 36 + i, 32); orderBuild(v, G.buildings.find(b => b.type === 'house')); }
    for (let i = 0; i < 8; i++) { const a = spawnUnit(i % 2 ? 'xbow' : 'mangonel', 1, 56 + (i % 4), 36 + Math.floor(i / 4)); orderAttack(a, G.buildings.find(b => b.type === 'castle')); }
    for (let i = 0; i < 6; i++) { const a = spawnUnit(i % 2 ? 'longbowman' : 'knight', 0, 44 + (i % 3), 41 + Math.floor(i / 3)); orderAMove(a, 54, 38); }
    centerCamOn(40, 37); R.cam.zoom = 1.25; R.fogDirty = true;
    for (let t = 0; t < 7; t += 0.05) tick(0.05);
    G.paused = false;
  });
  await sleep(300);
  await page.screenshot({ path: '/tmp/t30.png' });
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
