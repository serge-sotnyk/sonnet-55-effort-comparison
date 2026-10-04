const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await new Promise(r => setTimeout(r, 6000));
  await page.screenshot({ path: '/tmp/menu2.png' });
  console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
})();
