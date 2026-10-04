const { launch } = require('./harness');
const style = process.argv[2] || 'forest', mins = +process.argv[3] || 18;
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate((style) => window.__dbg.start({ observer: true, civ: 'britons', enemyCiv: 'mongols', difficulty: 'moderate', difficulty2: 'moderate', size: 100, seed: 4711, style }), style);
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const out = await page.evaluate((mins) => {
    const d = window.__dbg, G = d.G; G.paused = true; const res = [];
    for (let m = 1; m <= mins; m++) {
      d.advance(60);
      if (m % 3 === 0) res.push(`${m}m ` + G.players.map(p => `a${p.age} pop${p.pop}/${p.popCap} v${G.units.filter(u=>u.owner===p.id&&u.def.id==='villager').length} idleV${G.units.filter(u=>u.owner===p.id&&u.def.id==='villager'&&u.state==='idle').length} b${G.buildings.filter(b=>b.owner===p.id).length} F${Math.floor(p.res.food)} W${Math.floor(p.res.wood)} G${Math.floor(p.res.gold)}`).join(' | '));
    }
    return res;
  }, mins);
  console.log(style); console.log(out.join('\n'));
  console.log(logs.slice(0, 5).join('\n') || 'no errors');
  await browser.close();
})();
