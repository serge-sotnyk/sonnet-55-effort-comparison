const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1500,900);
  await startGame(page,{seed:5,vis:'all',age:3,civ:'franks',size:'large'});
  await page.evaluate(()=>{
    document.getElementById('bottom').style.display='none';
    const p=G.players[0];const sx=20,sy=20;p.start.x=sx;p.start.y=sy;
    // clear area & place buildings in grid east of start
    const types=['house','mill','lumber','mining','farm','dock','market','barracks','archery','stable','blacksmith','monastery','university','siege','castle','tower','wall','gate'];
    clearArea(sx-8,sy+6,60,40);
    for(let y=sy+6;y<sy+46;y++)for(let x=sx-8;x<sx+52;x++){G.terr[y*G.W+x]=0;G.hgt[y*G.W+x]=0}rebuildTileColors();for(const a of G.units.slice())if(a.def.animal&&a.x>sx-8&&a.y>sy+6&&a.x<sx+52&&a.y<sy+46)a.dead=true;
    let x=sx-4,y=sy+8,row=0;
    for(const t of types){const d=B[t];if(x+d.sz>sx+30){x=sx-4;y+=6}const b=mkBld(t,0,x,y,true);x+=d.sz+2}
    // units
    const ut=Object.keys(U).filter(k=>!['sheep','deer','boar','wolf'].includes(k)&&!U[k].cls.includes('ship'));
    let ux=sx-4,uy=sy+30;
    for(const k of ut){const u=mkUnit(k,0,ux+.5,uy+.5);u.fx=.7;u.fy=.7;ux+=1.6;if(ux>sx+30){ux=sx-4;uy+=2.2}}
    CAM.zoom=1.0;centerOn(sx+14,sy+20);
  });
  await page.waitForTimeout(800);
  await page.screenshot({path:'/tmp/s_gal1.png'});
  await page.evaluate(()=>{CAM.zoom=1.6;const p=G.players[0];centerOn(p.start.x+4,p.start.y+11)});
  await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/s_gal2.png'});
  await page.evaluate(()=>{CAM.zoom=1.7;const p=G.players[0];centerOn(p.start.x+8,p.start.y+31)});
  await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/s_gal3.png'});
  console.log(errs.slice(0,10).join('\n'));
  await browser.close();
})();
