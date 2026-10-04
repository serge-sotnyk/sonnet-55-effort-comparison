const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', enemyCiv: 'franks', difficulty: 'easy', size: 64, seed: 5 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const out = await page.evaluate(() => {
    const G = window.__dbg.G; G.paused = true; const o = [];
    const p = G.players[0], q = G.players[1];
    p.ai = null; q.ai = null;
    const s0 = unitStats(p, 'militia'); o.push(`militia atk ${s0.atkM} armM ${s0.armM}`);
    applyTech(p, 'forging'); applyTech(p, 'scalemail');
    const s1 = unitStats(p, 'militia'); o.push(`after forging+scale: atk ${s1.atkM} armM ${s1.armM} armP ${s1.armP}`);
    const a0 = unitStats(p, 'archer'); o.push(`archer range ${a0.range} atk ${a0.atkP}`);
    applyTech(p, 'fletching'); const a1 = unitStats(p, 'archer'); o.push(`after fletching: range ${a1.range} atk ${a1.atkP}`);
    p.age = 2; refreshStats(p); const a2 = unitStats(p, 'archer'); o.push(`britons castle age: range ${a2.range}`);
    const lb = unitStats(p, 'longbowman'); o.push(`longbowman range ${lb.range}`);
    o.push('towncenter cost wood britons ' + bldCost(p, 'towncenter').wood + ' vs franks ' + bldCost(q, 'towncenter').wood);
    o.push('castle cost stone britons ' + bldCost(p, 'castle').stone + ' vs franks ' + bldCost(q, 'castle').stone);
    o.push('knight hp britons ' + unitStats(p, 'knight').hp + ' vs franks ' + unitStats(q, 'knight').hp);
    // unit upgrade
    const m = spawnUnit('militia', 0, 20, 20); applyTech(p, 'manatarms'); o.push('militia -> ' + m.type + ' hp ' + m.maxHp);
    o.push('resolve militia: ' + resolveUnit(p, 'militia'));
    // loom
    const v = spawnUnit('villager', 0, 21, 21); const hp0 = v.maxHp; applyTech(p, 'loom'); o.push('villager hp ' + hp0 + ' -> ' + v.maxHp);
    // gather rate
    o.push('wood rate ' + gatherRate(p, 'wood').toFixed(3)); applyTech(p, 'doublebit'); o.push('after doublebit ' + gatherRate(p, 'wood').toFixed(3));
    // monk
    return o;
  });
  console.log(out.join('\n'));
  await browser.close();
})();
