const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'britons', difficulty: 'moderate', size: 80, seed: 31337 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  await new Promise(r => setTimeout(r, 800));
  const q = (fn, ...a) => page.evaluate(fn, ...a);
  // 1: train villager via key
  await page.keyboard.press('q'); await page.keyboard.press('q'); await page.keyboard.press('q');
  console.log('queue after Q x3:', await q(() => G.buildings.find(b => b.owner === 0 && b.type === 'towncenter').queue.length), 'food', await q(() => G.players[0].res.food));
  // 2: box select villagers
  await q(() => { for (const u of G.units) if (u.owner===0) { u.dest=null; } });
  const box = await q(() => {
    const vs = G.units.filter(u => u.owner === 0 && u.def.id === 'villager');
    const xs = vs.map(u => w2sx(u.x, u.y)), ys = vs.map(u => w2sy(u.x, u.y));
    return { x0: Math.min(...xs) - 30, y0: Math.min(...ys) - 60, x1: Math.max(...xs) + 30, y1: Math.max(...ys) + 20 };
  });
  const rect = await q(() => { const r = document.getElementById('view').getBoundingClientRect(); return { l: r.left, t: r.top }; });
  await page.mouse.move(rect.l + box.x0, rect.t + box.y0);
  await page.mouse.down(); await page.mouse.move(rect.l + box.x1, rect.t + box.y1, { steps: 5 }); await page.mouse.up();
  await q(() => UI.setSel(G.units.filter(u => u.owner === 0 && u.def.id === 'villager')));
  console.log('selected', await q(() => G.sel.map(e => e.type).join(',')));
  await page.screenshot({ path: '/tmp/h1.png' });
  // 3: build menu: Q (eco) then Q (house)
  await page.keyboard.press('q'); await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: '/tmp/h2.png' });
  await page.keyboard.press('q'); await new Promise(r => setTimeout(r, 200));
  console.log('mode', await q(() => JSON.stringify(UI.mode)));
  // move mouse to a spot near TC
  const spot = await q(() => { const tc = G.buildings.find(b => b.owner === 0 && b.type === 'towncenter'); return { x: w2sx(tc.x + 7, tc.y + 3), y: w2sy(tc.x + 7, tc.y + 3) }; });
  await page.mouse.move(rect.l + spot.x, rect.t + spot.y, { steps: 3 });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: '/tmp/h3.png' });
  await page.mouse.click(rect.l + spot.x, rect.t + spot.y);
  await new Promise(r => setTimeout(r, 300));
  console.log('buildings', await q(() => G.buildings.filter(b => b.owner === 0).map(b => b.type + (b.built ? '' : '*')).join(',')), 'wood', await q(() => G.players[0].res.wood));
  // 4: let time pass at turbo
  await q(() => { G.speed = 4; });
  await new Promise(r => setTimeout(r, 12000));
  console.log('after 12s@4x: buildings', await q(() => G.buildings.filter(b => b.owner === 0).map(b => b.type + (b.built ? '' : '*')).join(',')), 'pop', await q(() => G.players[0].pop + '/' + G.players[0].popCap), 'res', await q(() => JSON.stringify(G.players[0].res)));
  await page.screenshot({ path: '/tmp/h4.png' });
  console.log(logs.slice(0, 20).join('\n'));
  await browser.close();
})();
