const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch();
  await startGame(page,{seed:11,vis:'all'});
  await page.evaluate(()=>{CAM.zoom=1.5;const p=G.players[0];centerOn(p.start.x+1,p.start.y+1);
    const v=G.units.filter(u=>u.owner===0&&u.type==='villager');
    const tree=findResNear(v[0].x,v[0].y,e=>e.res==='w',20);orderGather(v[0],tree);
    const gold=findResNear(v[1].x,v[1].y,e=>e.type==='gold',20);orderGather(v[1],gold);
    const sp=freeNear(p.start.x+4,p.start.y+3,0,3);placeBuilding(p,'house',Math.floor(sp.x),Math.floor(sp.y),[v[2]]);
    const b=findResNear(v[3].x,v[3].y,e=>e.type==='berries',20);orderGather(v[3],b);
  });
  await page.waitForTimeout(9000);
  await page.screenshot({path:'/tmp/s_v1.png'});
  console.log(errs.slice(0,10).join('\n'));
  await browser.close();
})();
