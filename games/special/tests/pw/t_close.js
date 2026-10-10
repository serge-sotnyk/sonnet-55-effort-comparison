const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1300,760);
  await startGame(page,{seed:31,ai:1,vis:'all',age:2});
  await page.evaluate(()=>{
    document.getElementById('bottom').style.display='none';
    const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
    const vs=G.units.filter(u=>u.owner===0&&u.type==='villager');
    const tree=findResNear(tc.cx,tc.cy,e=>e.res==='w',20);orderGather(vs[0],tree);
    const gold=findResNear(tc.cx,tc.cy,e=>e.type==='gold',20);orderGather(vs[1],gold);
    const f=mkBld('farm',0,tc.x-5,tc.y+6,true);orderGather(vs[2],f);
    const sp=freeNear(tc.cx+6,tc.cy+6,0,5);placeBuilding(p,'house',Math.floor(sp.x),Math.floor(sp.y),[vs[3]]);
    const b=findResNear(tc.cx,tc.cy,e=>e.type==='berries',20);orderGather(vs[4]||vs[3],b);
    G.speed=4;window.__v=vs;
  });
  await page.waitForTimeout(6000);
  await page.evaluate(()=>{G.speed=1.5});
  const names=['tree','gold','farm','build'];
  for(let n=0;n<4;n++){
    await page.evaluate((n)=>{const v=__v[n];CAM.zoom=3.4;centerOn(v.x,v.y)},n);
    for(let i=0;i<3;i++){await page.waitForTimeout(280);await page.screenshot({path:'/tmp/s_close_'+names[n]+i+'.png',clip:{x:500,y:230,width:300,height:300}})}
    console.log(names[n],await page.evaluate((n)=>{const v=__v[n];return v.t+' '+v.workType+' '+v.working},n));
  }
  console.log(errs.filter(e=>!/404/.test(e)).join('|'));
  await browser.close();
})();
