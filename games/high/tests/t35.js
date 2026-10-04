const { launch } = require('./harness');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, logs } = await launch();
  await sleep(4000);
  await page.click('#btn-start');
  await page.waitForFunction(() => gameState === 'playing', { timeout: 60000 });
  console.log('speed at start:', await page.evaluate(() => G.speed));
  await browser.close();
})();
