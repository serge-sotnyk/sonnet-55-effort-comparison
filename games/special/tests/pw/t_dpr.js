const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:810},deviceScaleFactor:2});
  const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://localhost:8765/index.html');await page.click('#mm-play');await page.click('#s-start');await page.waitForTimeout(2500);
  await page.screenshot({path:'/tmp/s_dpr.png'});
  console.log(await page.evaluate(()=>[cv.width,cv.height,VW,VH,R.dpr]),errs.join('|'));
  await browser.close();
})();
