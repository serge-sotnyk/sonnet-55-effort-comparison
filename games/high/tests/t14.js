const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'teutons', difficulty: 'easy', size: 80, seed: 77, start: { food: 3000, wood: 3000, gold: 2000, stone: 2000 } }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const r = await page.evaluate(async () => {
    const G = window.__dbg.G, UI = window.__dbg.UI; G.paused = true; const out = [];
    try {
    const p = G.players[0];
    const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter');
    const vills = G.units.filter(u => u.owner === 0 && u.def.id === 'villager');
    const run = (s) => { for (let t = 0; t < s; t += 0.05) tick(0.05); };
    // build houses/mill/barracks near TC with villagers
    const helper = new AIPlayer(p, DIFFICULTY.easy); let first = true; const place = (type, dx, dy) => { const sp = helper.findSpot(type, tc.x, tc.y, 4, 9) || [tc.x + dx, tc.y + dy]; const b = placeBuilding(p, type, sp[0], sp[1], vills, !first); first = false; out.push(type + ' placed=' + !!b); return b; };
    place('house', 6, 0); place('mill', -7, 0); place('barracks', 0, 7); place('lumber', 7, 7);
    run(140);
    first = true;
    out.push('built: ' + G.buildings.filter(b => b.owner === 0).map(b => b.type + (b.built ? '' : '*')).join(','));
    // age up
    out.push('feudal avail ' + JSON.stringify(techAvailable(p, 'feudal')));
    out.push('research feudal ' + cmdResearch(tc, 'feudal'));
    run(140);
    out.push('age after: ' + p.age);
    // build feudal buildings
    first = true; place('archery', 8, 8); place('blacksmith', -8, 8); place('market', 12, -3); place('stable', -8, -8);
    run(150);
    out.push('built2: ' + G.buildings.filter(b => b.owner === 0).map(b => b.type + (b.built ? '' : '*')).join(','));
    out.push('castle req ' + JSON.stringify(techAvailable(p, 'castle')));
    out.push('research castle ' + cmdResearch(tc, 'castle'));
    run(170);
    out.push('age: ' + p.age);
    // techs
    const bs = G.buildings.find(b => b.owner === 0 && b.type === 'blacksmith');
    out.push('forging ' + cmdResearch(bs, 'forging') + ' fletching ' + cmdResearch(bs, 'fletching'));
    run(100);
    out.push('techs: ' + [...p.techs].join(','));
    // market
    const before = p.res.wood; marketBuy(p, 'wood', 100); out.push('market buy wood: ' + before + '->' + p.res.wood + ' gold ' + p.res.gold + ' price ' + p.market.wood.toFixed(0));
    // train units + rally
    const br = G.buildings.find(b => b.owner === 0 && b.type === 'barracks');
    cmdRally(br, tc.x + 10, tc.y + 12);
    out.push('train militia: ' + cmdTrain(br, 'militia', 3) + ' spear ' + cmdTrain(br, 'spearman', 2));
    run(90);
    const mil = G.units.filter(u => u.owner === 0 && u.def.id !== 'villager' && u.def.id !== 'scout');
    out.push('army: ' + mil.map(u => u.type + '@' + u.x.toFixed(0) + ',' + u.y.toFixed(0)).join(' ') + ' rally ' + (tc.x + 10) + ',' + (tc.y + 12));
    // tower + garrison + arrows
    const tw = placeBuilding(p, 'tower', tc.x - 3, tc.y + 9, vills, false); run(100);
    out.push('tower built ' + tw.built);
    for (const m of mil.slice(0, 3)) orderGarrison(m, tw);
    run(15);
    out.push('tower garrison ' + tw.garrison.length);
    // enemy raider near tower
    const raider = spawnUnit('militia', 1, tw.x + 5, tw.y + 1);
    const hp0 = raider.hp; run(8);
    out.push('raider hp ' + hp0 + '->' + raider.hp.toFixed(0) + ' dead=' + raider.dead);
    // walls
    const tiles = wallTiles(tc.x - 14, tc.y - 6, tc.x - 14, tc.y + 4);
    let n = 0; for (const [x, y] of tiles) { if (placeBuilding(p, 'palisade', x, y, vills, n++ > 0)) { } }
    run(60);
    out.push('walls: ' + G.buildings.filter(b => b.type === 'palisade' && b.built).length + '/' + tiles.length);
    // gate
    const gt = placeBuilding(p, 'gate', tc.x - 14, tc.y - 1, vills, false); run(60);
    out.push('gate built ' + (gt && gt.built) + ' mask ' + (gt && gt.mask));
    // repair
    tc.hp = 1000; for (const v of vills) orderRepair(v, tc); run(30);
    out.push('repair TC hp ' + tc.hp.toFixed(0));
    } catch (e) { out.push('EXC ' + e.message + ' ' + e.stack.split('\n').slice(0,3).join('|')); }
    return out;
  });
  console.log(r.join('\n'));
  await page.evaluate(() => { const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter'); centerCamOn(tc.x - 4, tc.y + 5); G.paused = false; });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: '/tmp/t14.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
