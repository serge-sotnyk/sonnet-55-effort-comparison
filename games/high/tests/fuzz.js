const { launch } = require('./harness');
const seed = +process.argv[2] || 1, iters = +process.argv[3] || 600;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((seed) => window.__dbg.start({ civ: ['britons','franks','teutons','mongols'][seed % 4], difficulty: 'hard', size: 80, seed, start: { food: 1500, wood: 1500, gold: 1000, stone: 800 } }), seed);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const res = await page.evaluate((iters) => {
    const G = window.__dbg.G, UI = window.__dbg.UI; G.paused = true;
    const errs = []; const rnd = Math.random;
    const guard = (name, fn) => { try { fn(); } catch (e) { errs.push(name + ': ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]); } };
    const me = 0;
    const p = G.players[0];
    let invalid = 0;
    for (let i = 0; i < iters; i++) {
      const own = G.units.filter(u => u.owner === me && !u.dead && !u.garrisoned);
      const ownB = G.buildings.filter(b => b.owner === me && !b.dead);
      const act = rnd();
      if (act < 0.18 && own.length) { // select random group
        const n = 1 + Math.floor(rnd() * Math.min(25, own.length)); const s = own.slice().sort(() => rnd() - 0.5).slice(0, n);
        guard('select', () => UI.setSel(s));
      } else if (act < 0.24 && ownB.length) { guard('selectB', () => UI.setSel([ownB[Math.floor(rnd() * ownB.length)]])); }
      else if (act < 0.55) { // right click random target
        const tgts = [null, ...G.units.filter(u => !u.dead).slice(0, 80), ...G.buildings.filter(b => !b.dead), ...G.resources.filter(r => !r.dead).sort(() => rnd() - 0.5).slice(0, 25)];
        const t = tgts[Math.floor(rnd() * tgts.length)];
        const wx = rnd() * G.map.w, wy = rnd() * G.map.h;
        guard('command', () => UI.commandAt(t ? (t.kind === 'building' ? ecx(t) : t.x) : wx, t ? (t.kind === 'building' ? ecy(t) : t.y) : wy, t, rnd() < 0.2, rnd() < 0.1));
      } else if (act < 0.8) { // press a card slot
        guard('card', () => { UI.refreshHUD(); const s = Math.floor(rnd() * 15); if (UI.card[s]) { UI.pressSlot(s, rnd() < 0.2); if (UI.mode && UI.mode.t === 'place') { const bx = ownB.length ? ownB[0] : null; const m = UI.mode; if (bx) { const tx = Math.floor(bx.x + (rnd() - 0.5) * 20), ty = Math.floor(bx.y + (rnd() - 0.5) * 20); const def = BUILDINGS[m.type]; const chk = canPlace(p, m.type, tx, ty, true); if (chk.ok) { const sel = G.sel.filter(e => e.kind === 'unit' && e.owner === me && e.def.tags.includes('villager')); placeBuilding(p, m.type, tx, ty, sel, false); } } UI.cancelMode(); } if (UI.mode && UI.mode.t === 'rally') { UI.cancelMode(); } if (UI.mode && UI.mode.t === 'amove') { UI.commandAt(rnd() * G.map.w, rnd() * G.map.h, null, false, true); UI.cancelMode(); } } });
      } else if (act < 0.86) { guard('delete', () => { if (rnd() < 0.15 && own.length) { const u = own[Math.floor(rnd() * own.length)]; die(u, null); } }); }
      else if (act < 0.9) { guard('box', () => { UI.boxSelect({ x0: 0, y0: 0, x1: R.vw, y1: R.vh, shift: false }); }); }
      // advance
      guard('tick', () => { const dt = 0.05; const n = Math.floor(rnd() * 40) + 5; for (let k = 0; k < n; k++) tick(dt); });
      guard('render', () => { if (i % 10 === 0) { UI.refreshHUD(); renderFrame(0.016); renderMinimap(); } });
      // invariants
      for (const u of G.units) { if (u.dead) continue; if (!isFinite(u.x) || !isFinite(u.y) || u.x < -1 || u.y < -1 || u.x > G.map.w + 1 || u.y > G.map.h + 1) { invalid++; if (invalid < 4) errs.push('bad unit pos ' + u.type + ' ' + u.x + ',' + u.y + ' state ' + u.state); u.x = clamp(isFinite(u.x) ? u.x : 40, 1, 78); u.y = clamp(isFinite(u.y) ? u.y : 40, 1, 78); } if (!isFinite(u.hp)) errs.push('NaN hp ' + u.type); }
    }
    // pop consistency
    for (const pl of G.players) { const real = G.units.filter(u => !u.dead && u.owner === pl.id).reduce((a, u) => a + u.def.pop, 0); if (real !== pl.pop) errs.push(`pop mismatch p${pl.id}: counted ${real} vs ${pl.pop}`); }
    return { errs: errs.slice(0, 15), time: G.time.toFixed(0), units: G.units.length, over: G.over };
  }, iters);
  console.log(`seed ${seed}: sim ${res.time}s units ${res.units} over=${res.over}`); console.log(res.errs.length ? res.errs.join('\n') : 'no errors');
  console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
})();
