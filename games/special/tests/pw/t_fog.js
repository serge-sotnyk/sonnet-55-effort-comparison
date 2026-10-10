const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1280,720);
  await startGame(page,{seed:31,ai:2});
  await page.evaluate(()=>{CAM.zoom=2;const p=G.players[0];centerOn(p.start.x-9,p.start.y-9)});
  await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/s_fog.png',clip:{x:300,y:60,width:700,height:420}});
  await browser.close();
})();
