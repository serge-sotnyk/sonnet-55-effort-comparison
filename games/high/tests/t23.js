const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'franks', difficulty: 'easy', size: 80, seed: 77, start: { food: 3000, wood: 3000, gold: 2000, stone: 2000 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  await page.evaluate(async () => {
    const G = window.__dbg.G, UI = window.__dbg.UI; G.paused = true;
    const p = G.players[0]; p.age = 2; refreshStats(p);
    const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter');
    const helper = new AIPlayer(p, DIFFICULTY.easy);
    const mk = (t) => { const sp = helper.findSpot(t, tc.x, tc.y, 4, 9); return sp ? spawnBuilding(t, 0, sp[0], sp[1], true) : null; };
    const br = mk('barracks'), st = mk('stable'), ar = mk('archery'); mk('blacksmith'); mk('house'); mk('house'); mk('mill'); mk('market');
    p.age = 2; for (const b of G.buildings) if (b.owner === 0) b.age = 2;
    for (let i = 0; i < 6; i++) { cmdTrain(br, i % 2 ? 'militia' : 'spearman', 1); }
    cmdTrain(st, 'knight', 4); cmdTrain(ar, 'archer', 3);
    G.players[0].researching.clear();
    cmdResearch(G.buildings.find(b => b.type === 'blacksmith' && b.owner === 0), 'forging');
    for (let t = 0; t < 40; t += 0.05) tick(0.05);
    UI.setSel([br]); UI.refreshHUD();
    centerCamOn(tc.x + 1, tc.y + 4);
    G.paused = false;
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/t23a.png' });
  await page.evaluate(() => { const G = window.__dbg.G, UI = window.__dbg.UI; G.paused = true; UI.setSel(G.units.filter(u => u.owner === 0)); UI.refreshHUD(); });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: '/tmp/t23b.png', clip: { x: 0, y: 760, width: 1600, height: 190 } });
  console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
})();
