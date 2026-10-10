const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1400,800);
  await startGame(page,{seed:8,map:'highlands',size:'medium',vis:'all',ai:1});
  await page.evaluate(()=>{document.getElementById('bottom').style.display='none';CAM.zoom=0.55;const p=G.players[0];
    // find a mesa edge
    let best=null;for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++){if(G.hgt[y*G.W+x]===3){const d=Math.hypot(x-p.start.x,y-p.start.y);if(!best||d<best[2])best=[x,y,d]}}
    centerOn(G.W/2,G.H/2)});
  await page.waitForTimeout(800);
  await page.screenshot({path:'/tmp/s_hills.png'});
  await browser.close();
})();
