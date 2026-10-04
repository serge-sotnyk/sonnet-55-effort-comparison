const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch();
  await sleep(3000);
  // choose Teutons + hard + small via real clicks
  await page.click('.civ[data-id="teutons"]');
  await page.click('#seg-diff button[data-v="hard"]');
  await page.click('#seg-size button[data-v="64"]');
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden') && !document.body.classList.contains('menu'), { timeout: 60000 });
  console.log('started:', await page.evaluate(() => ({ civ: G.players[0].civ, enemy: G.players[1].civ, size: G.map.w, state: gameState, menuClass: document.body.className })));
  await sleep(2000);
  await page.keyboard.press('Escape'); await sleep(200); // deselect
  await page.keyboard.press('Escape'); await sleep(200); // pause
  console.log('paused after esc:', await page.evaluate(() => G.paused), 'overlay visible', await page.evaluate(() => !document.getElementById('pause').classList.contains('hidden')));
  await page.click('#p-resume'); await sleep(300);
  console.log('resumed:', await page.evaluate(() => !G.paused));
  const t0 = await page.evaluate(() => G.time);
  await page.click('#btn-menu'); await sleep(200); await page.click('#p-restart');
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden') && gameState === 'playing', { timeout: 60000 });
  await sleep(500);
  console.log('after restart time', await page.evaluate(() => G.time.toFixed(1)), '(was', t0.toFixed(1) + ')', 'civ', await page.evaluate(() => G.players[0].civ + ' size ' + G.map.w));
  await page.click('#btn-menu'); await sleep(200); await page.click('#p-resign'); await sleep(3500);
  console.log('end overlay visible:', await page.evaluate(() => !document.getElementById('end').classList.contains('hidden')), await page.evaluate(() => document.getElementById('end-title').textContent));
  await page.screenshot({ path: '/tmp/defeat.png' });
  await page.click('#e-menu'); await sleep(3500);
  console.log('menu state:', await page.evaluate(() => gameState + ' demo=' + G.demo));
  await page.click('#btn-watch');
  await page.waitForFunction(() => gameState === 'playing', { timeout: 60000 });
  await sleep(1500);
  console.log('observer:', await page.evaluate(() => G.observer + ' players ' + G.players.map(p => !!p.ai)));
  await page.keyboard.press('Tab'); await sleep(200);
  console.log('tab me=', await page.evaluate(() => G.me));
  console.log(logs.slice(0, 10).join('\n') || 'no console errors');
  await browser.close();
})();
