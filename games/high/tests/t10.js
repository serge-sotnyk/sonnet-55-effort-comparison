const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'britons', difficulty: 'easy', size: 80, seed: 5, start: { food: 9999, wood: 9999, gold: 9999, stone: 9999 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const res = await page.evaluate(async () => {
    const out = [];
    const G = window.__dbg.G, UI = window.__dbg.UI;
    G.paused = true;
    const p = G.players[0];
    for (const id of ['feudal', 'castle', 'imperial']) { p.age++; }
    refreshStats(p);
    // spawn every building type for player 0 and select it
    let x = 8, y = 8;
    const errs = [];
    for (const t of Object.keys(BUILDINGS)) {
      try {
        const b = spawnBuilding(t, 0, x, y, true); x += 6; if (x > 60) { x = 8; y += 6; }
        UI.setSel([b]); UI.refreshHUD();
        const cnt = UI.card.filter(Boolean).length;
        out.push(t + ':' + cnt);
        // press every slot (should not throw)
        for (let s = 0; s < 15; s++) { if (UI.card[s] && UI.card[s].action && !['delete'].includes(UI.card[s].tip.title)) { try { UI.pressSlot(s, false); } catch (e) { errs.push(t + ' slot ' + s + ': ' + e.message); } } }
        UI.cancelMode();
        UI.setSel([b]); UI.refreshHUD();
      } catch (e) { errs.push(t + ': ' + e.message + '\n' + e.stack.split('\n').slice(0,3).join('|')); }
    }
    // units
    const us = [];
    for (const t of Object.keys(UNITS)) {
      try { const u = spawnUnit(t, 0, 30 + Math.random() * 5, 30 + Math.random() * 5); us.push(u); UI.setSel([u]); UI.refreshHUD(); } catch (e) { errs.push('unit ' + t + ': ' + e.message); }
    }
    try { UI.setSel(us); UI.refreshHUD(); } catch (e) { errs.push('multi: ' + e.message); }
    // villagers pages
    const v = spawnUnit('villager', 0, 40, 40); UI.setSel([v]); UI.refreshHUD(); UI.page = 'eco'; UI.refreshHUD(); UI.page = 'mil'; UI.refreshHUD();
    // render some frames
    for (let i = 0; i < 3; i++) renderFrame(0.016);
    return { out, errs };
  });
  console.log(res.out.join(' '));
  console.log('ERRORS:', res.errs.length ? res.errs.join('\n') : 'none');
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
