const { launch } = require('./harness');
const rs = +process.argv[2] || 1;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluateOnNewDocument((rs) => { let a = rs * 7919; Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, rs);
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 3, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true; let res = { over: false };
    for (let m = 1; m <= 58 && !G.over; m++) {
      d.advance(60);
      if (m < 30) continue;
      for (const w of [0, 1]) {
        const A = G.units.filter(u => u.owner === w && u.def.id !== 'villager' && !u.dead);
        const opB = G.buildings.filter(b => b.owner === 1 - w && !b.dead && !['farm', 'palisade', 'stonewall', 'gate'].includes(b.type));
        if (A.length > 60 && opB.length > 0 && opB.length < 15) {
          // sample units
          const sample = A.filter(u => u.state === 'amove' || u.state === 'attack').slice(0, 6).map(u => ({ s: u.state, x: +u.x.toFixed(1), y: +u.y.toFixed(1), path: u.path ? u.path.length : null, partial: u.partial, pf: u.pathFail, stuck: +u.stuckT.toFixed(1), tgt: u.target ? u.target.type + '@' + Math.round(ecx(u.target)) + ',' + Math.round(ecy(u.target)) : null, dest: u.dest, goal: u.goal && [u.goal.x0, u.goal.y0, u.goal.r] }));
          res = { over: false, m, w, n: A.length, opB: opB.map(b => b.type + '@' + b.x + ',' + b.y), sample, states: A.reduce((a, u) => (a[u.state] = (a[u.state] || 0) + 1, a), {}) };
          // passability picture around first enemy building
          const b0 = opB[0]; let pic = '';
          for (let y = Math.max(0, b0.y - 8); y < Math.min(80, b0.y + 8); y++) { let row = ''; for (let x = 0; x < 24; x++) { const i = y * 80 + x; const o = G.map.occ[i] ? G.byId.get(G.map.occ[i]) : null; row += G.map.terrain[i] ? '~' : o ? (o.kind === 'building' ? (o.type === 'house' ? 'H' : 'B') : o.type === 'tree' ? 't' : 'r') : '.'; } pic += String(y).padStart(2) + ' ' + row + '\n'; }
          res.pic = pic;
          return res;
        }
      }
    }
    res.time = (G.time / 60).toFixed(1); res.over = G.over; return res;
  });
  console.log(rs, JSON.stringify(r, null, 1).replace(/\\n/g, '\n'));
  await browser.close();
})();
