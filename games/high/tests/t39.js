const { launch } = require('./harness');
const seed = +process.argv[2] || 3, at = +process.argv[3] || 44;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((seed) => window.__dbg.start({ observer: true, civ: 'mongols', enemyCiv: 'franks', difficulty: 'hard', difficulty2: 'hard', size: 80, seed, startAge: 2, start: { food: 1500, wood: 1500, gold: 1500, stone: 800 } }), seed);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const r = await page.evaluate((at) => {
    const d = window.__dbg, G = d.G; G.paused = true; d.advance(60 * at);
    const p0 = G.players[0], ai = p0.ai;
    const o = {};
    o.enemyBlds = G.buildings.filter(b => b.owner === 1).map(b => `${b.type}@${b.x},${b.y}${b.built ? '' : '*'} hp${Math.round(b.hp)}`);
    o.enemyUnits = G.units.filter(u => u.owner === 1).map(u => u.type + '@' + u.x.toFixed(0) + ',' + u.y.toFixed(0) + ':' + u.state);
    const army = G.units.filter(u => u.owner === 0 && u.def.id !== 'villager');
    const st = {}; for (const u of army) st[u.state] = (st[u.state] || 0) + 1;
    o.armyStates = st; o.wave = ai.wave ? { n: ai.wave.ids.size } : null; o.waves = ai.waves; o.lastWaveEnd = ai.lastWaveEnd; o.t = ai.t;
    const c = army.reduce((a, u) => [a[0] + u.x, a[1] + u.y], [0, 0]); o.armyCentroid = [c[0] / army.length, c[1] / army.length];
    o.rally = ai.rallyPt; o.armyPop = army.reduce((s, u) => s + u.def.pop, 0);
    return o;
  }, at);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
