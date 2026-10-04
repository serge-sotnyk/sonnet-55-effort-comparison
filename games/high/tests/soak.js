const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'britons', enemyCiv: 'teutons', difficulty: 'hard', difficulty2: 'hard', size: 100, seed: 2024 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && gameState === 'playing', { timeout: 60000 });
  await page.evaluate(() => { G.speed = 4; });
  for (let i = 0; i < 12; i++) {
    await sleep(15000);
    const s = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 > 1500) res(n / 1.5); else requestAnimationFrame(f); } requestAnimationFrame(f); }).then((fps) => ({ fps: fps.toFixed(0), heapMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(0), t: (G.time / 60).toFixed(1), units: G.units.length, fx: G.fx.length, bld: G.buildings.length, res: G.resources.length, pops: G.players.map(p => p.pop).join('/'), over: G.over })));
    console.log(JSON.stringify(s));
    if (s.over) break;
  }
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
