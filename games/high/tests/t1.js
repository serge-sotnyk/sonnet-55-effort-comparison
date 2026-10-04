const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.screenshot({ path: '/tmp/menu.png' });
  const t0 = Date.now();
  await page.evaluate(() => window.__dbg.start({ civ: 'britons', difficulty: 'moderate', size: 80, seed: 12345 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && !document.getElementById('loading').classList.contains('hidden') === false, { timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  console.log('load ms', Date.now() - t0);
  await page.screenshot({ path: '/tmp/game1.png' });
  console.log(logs.join('\n'));
  await browser.close();
})();
