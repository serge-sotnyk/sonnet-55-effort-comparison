const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1500,900);
  await startGame(page,{seed:21,vis:'all',map:'coastal',size:'medium',age:2});
  await page.evaluate(()=>{
    document.getElementById('bottom').style.display='none';
    const p=G.players[0];
    // find water near start
    let best=null,bd=1e9;for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++){if(G.terr[y*G.W+x]>=3&&R.dland[y*G.W+x]>=4){const d=Math.hypot(x-p.start.x,y-p.start.y);if(d<bd){bd=d;best=[x,y]}}}
    window.__w=best;
    const types=['fishing','transport','galley','fireship','demoraft','tradecog'];
    types.forEach((t,i)=>{const u=mkUnit(t,0,best[0]+.5+i*2.2,best[1]+.5+(i%2));u.fx=.8;u.fy=.6});
    const e=mkUnit('galley',1,best[0]+.5+4,best[1]+5.5);
    CAM.zoom=1.5;centerOn(best[0]+5,best[1]+2);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({path:'/tmp/s_ships.png'});
  await page.evaluate(()=>{CAM.zoom=0.9;centerOn(__w[0],__w[1])});
  await page.waitForTimeout(600);
  await page.screenshot({path:'/tmp/s_coast.png'});
  console.log(errs.slice(0,10).join('\n'));
  await browser.close();
})();
