const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed: 3, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate(() => {
    const d = window.__dbg, G = d.G; G.paused = true; let o = {};
    for (let m = 1; m <= 50; m++) {
      d.advance(60);
      const cnt = [0, 1].map(w => G.buildings.filter(b => b.owner === w && !['farm', 'palisade', 'stonewall', 'gate'].includes(b.type)).length);
      const popL = [0, 1].map(w => G.players[w].pop);
      const loser = cnt[0] < cnt[1] ? 0 : 1; o.pop = popL; o.cnt = cnt;
      if (m >= 45) {
        const win = 1 - loser;
        const lb = G.buildings.filter(b => b.owner === loser && !b.dead);
        o.m = m; o.loser = loser;
        let pic = '';
        for (let y = 16; y < 36; y++) { let row = ''; for (let x = 52; x < 80; x++) { const k = y * 80 + x; const e = G.map.occ[k] ? G.byId.get(G.map.occ[k]) : null; row += G.map.terrain[k] ? '~' : e ? (e.kind === 'building' ? (e.owner === 0 ? 'a' : 'B') + '' : e.type === 'tree' ? 't' : 'r') : '.'; } pic += String(y).padStart(2) + ' ' + row + '\n'; }
        o.pic = pic; o.owners = G.buildings.filter(b => b.x >= 52 && b.y >= 16 && b.y < 36).map(b => b.owner + b.type + '@' + b.x + ',' + b.y).join(' ');
        return o;
      }
    }
    return { none: true };
  });
  console.log(r.pic); console.log(r.owners); console.log(r.cnt, r.pop);
  await browser.close();
})();
