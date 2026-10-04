const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'britons', difficulty: 'easy', size: 80, seed: 5 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  const cam = () => page.evaluate(() => ({ x: Math.round(R.cam.x), y: Math.round(R.cam.y), z: +R.cam.zoom.toFixed(2) }));
  console.log('start', await cam());
  await page.keyboard.down('ArrowLeft'); await sleep(500); await page.keyboard.up('ArrowLeft');
  console.log('after left key', await cam());
  await page.mouse.move(400, 300); await page.mouse.move(2, 300, { steps: 4 }); await sleep(600);
  console.log('after edge scroll left', await cam());
  await page.mouse.move(800, 400);
  await page.mouse.wheel({ deltaY: -300 }); await sleep(100);
  console.log('after wheel in', await cam());
  await page.mouse.wheel({ deltaY: 1500 }); await sleep(100);
  console.log('after wheel out', await cam());
  // minimap click
  const mm = await page.evaluate(() => { const r = document.getElementById('minimap').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; });
  await page.mouse.click(mm.x, mm.y); await sleep(100);
  console.log('after minimap click center', await cam(), 'center tile', await page.evaluate(() => { const w = screenToWorld(R.vw / 2, R.vh / 2); return w.x.toFixed(0) + ',' + w.y.toFixed(0); }));
  // middle drag
  await page.mouse.move(800, 400); await page.mouse.down({ button: 'middle' }); await page.mouse.move(700, 350, { steps: 3 }); await page.mouse.up({ button: 'middle' });
  console.log('after mid drag', await cam());
  // hotkeys: H select TC
  await page.keyboard.press('h'); await sleep(100);
  console.log('H ->', await page.evaluate(() => G.sel.map(e => e.type).join()));
  await page.keyboard.press('.'); await sleep(100);
  console.log('. ->', await page.evaluate(() => G.sel.map(e => e.type + ':' + e.state).join()));
  // ctrl+1 group
  await page.keyboard.down('Control'); await page.keyboard.press('1'); await page.keyboard.up('Control');
  await page.keyboard.press('h'); await page.keyboard.press('1'); await sleep(100);
  console.log('group1 ->', await page.evaluate(() => G.sel.map(e => e.type).join()));
  // speed cycle
  await page.keyboard.press('+'); console.log('speed', await page.evaluate(() => G.speed));
  await page.keyboard.press('p'); console.log('paused', await page.evaluate(() => G.paused)); await page.keyboard.press('p');
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
