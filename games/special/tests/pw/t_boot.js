const {launch}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch();
  await page.goto('http://localhost:8765/index.html');await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/s_menu.png'});
  await page.click('#mm-play');await page.waitForTimeout(300);
  await page.screenshot({path:'/tmp/s_setup.png'});
  await page.check('#s-cheats');
  await page.click('#s-start');await page.waitForTimeout(2500);
  await page.screenshot({path:'/tmp/s_game.png'});
  console.log(errs.slice(0,10).join('\n'));
  await browser.close();
})();
