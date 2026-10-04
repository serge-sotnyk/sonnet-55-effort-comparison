const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'teutons', difficulty: 'easy', size: 80, seed: 77, start: { food: 3000, wood: 3000, gold: 2000, stone: 2000 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const r = await page.evaluate(async () => {
    const G = window.__dbg.G; G.paused = true; const out = [];
    try {
    const p = G.players[0]; p.age = 1; refreshStats(p);
    const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter');
    const vills = G.units.filter(u => u.owner === 0 && u.def.id === 'villager');
    const run = (s) => { for (let t = 0; t < s; t += 0.05) tick(0.05); };
    const x0 = Math.floor(tc.x + 7);
    const tiles = wallTiles(x0, tc.y - 4, x0, tc.y + 6);
    let n = 0; for (const [x, y] of tiles) { const b = placeBuilding(p, 'stonewall', x, y, vills, n++ > 0); if (!b) out.push('fail ' + x + ',' + y + ' ' + JSON.stringify(canPlace(p, 'stonewall', x, y, true))); }
    run(150);
    out.push('walls: ' + G.buildings.filter(b => b.type === 'stonewall' && b.built).length + '/' + tiles.length);
    const gt = placeBuilding(p, 'gate', x0, tc.y + 1, vills, false); run(80);
    out.push('gate ' + (gt && gt.built) + ' mask ' + (gt && gt.mask) + ' walls now ' + G.buildings.filter(b => b.type === 'stonewall' && !b.dead).length);
    // path through gate for player; enemy cannot pass
    const u = spawnUnit('militia', 0, x0 - 2, tc.y + 1.5); orderMove(u, x0 + 4, tc.y + 1.5); const e = spawnUnit('militia', 1, x0 + 4, tc.y + 5.5); orderMove(e, x0 - 3, tc.y + 5.5);
    run(30);
    out.push('own unit at ' + u.x.toFixed(1) + ',' + u.y.toFixed(1) + ' (goal ' + (x0 + 4) + ') enemy at ' + e.x.toFixed(1) + ',' + e.y.toFixed(1) + ' (goal ' + (x0 - 3) + ')');
    const cc = G.map.findPath(x0 + 4, tc.y + 5.5, x0 - 3, tc.y + 5.5, x0 - 3, tc.y + 5.5, 0.75, 1);
    out.push('enemy path partial=' + cc.partial);
    } catch (e) { out.push('EXC ' + e.message + e.stack.split('\n').slice(0, 3).join('|')); }
    return out;
  });
  console.log(r.join('\n'));
  await page.evaluate(() => { const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter'); centerCamOn(tc.x + 7, tc.y + 1); G.paused = false; });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '/tmp/t15.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
