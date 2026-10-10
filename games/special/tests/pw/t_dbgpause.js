const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1280,720);
  await startGame(page,{seed:71,ai:2,map:'arabia',size:'small',age:3,res:'high'});
  await page.waitForTimeout(1500);
  console.log(await page.evaluate(()=>({t:G.time,paused:G.paused,speed:G.speed})));
  await page.evaluate(()=>{G.speed=3});
  await page.waitForTimeout(1500);
  console.log(await page.evaluate(()=>({t:G.time,paused:G.paused,speed:G.speed})));
  for(let i=0;i<30;i++){await page.mouse.click(300+i*10,300);await page.keyboard.press('q');}
  console.log(await page.evaluate(()=>({t:G.time,paused:G.paused,speed:G.speed,modal:!$('modal').classList.contains('hidden')})));
  await browser.close();
})();
