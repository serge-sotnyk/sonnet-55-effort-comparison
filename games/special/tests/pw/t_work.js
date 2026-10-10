const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1300,760);
  await startGame(page,{seed:31,ai:1,vis:'all'});
  await page.evaluate(()=>{
    G.cheats.aegis=false;document.getElementById('bottom').style.display='none';
    const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
    const vs=G.units.filter(u=>u.owner===0&&u.type==='villager');
    const tree=findResNear(tc.cx,tc.cy,e=>e.res==='w',20);orderGather(vs[0],tree);
    const gold=findResNear(tc.cx,tc.cy,e=>e.type==='gold',20);orderGather(vs[1],gold);
    const stone=findResNear(tc.cx,tc.cy,e=>e.type==='stone',20);orderGather(vs[2],stone);
    const berry=findResNear(tc.cx,tc.cy,e=>e.type==='berries',20);orderGather(vs[3],berry);
    const sp=freeNear(tc.cx+6,tc.cy,0,5);placeBuilding(p,'house',Math.floor(sp.x),Math.floor(sp.y),[mkUnit('villager',0,tc.cx+3,tc.cy+4)]);
    const f=mkBld('farm',0,tc.x-4,tc.y+5,true);const fv=mkUnit('villager',0,f.cx+3,f.cy);orderGather(fv,f);
    // fight: 3 militia vs 3 archers + knight
    const fx=tc.cx-8,fy=tc.cy+10;
    for(let i=0;i<3;i++){const a=mkUnit('militia',0,fx+i*1.1,fy);const b=mkUnit('archer',1,fx+i*1.1+5,fy-1);}
    mkUnit('knight',0,fx+1,fy+2);mkUnit('monk',0,fx-1,fy+1);
    for(const u of G.units)if(u.owner===0&&isMil(u))orderAttackMove(u,fx+6,fy-1);
    CAM.zoom=1.25;centerOn(tc.cx-3,tc.cy+5);
  });
  for(let i=0;i<4;i++){await page.waitForTimeout(2500);await page.screenshot({path:'/tmp/s_work'+i+'.png'})}
  console.log(errs.filter(e=>!/404/.test(e)).join('\n'));
  await browser.close();
})();
