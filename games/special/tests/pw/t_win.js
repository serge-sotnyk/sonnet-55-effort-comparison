const {launch,startGame}=require('./lib');
const ok=(n,c,d)=>console.log((c?'PASS':'FAIL')+' | '+n+(d?' | '+d:''));
(async()=>{
  const {browser,page,errs}=await launch(1280,720);
  await startGame(page,{seed:44,ai:1,map:'arabia',size:'small',vis:'all',age:3,res:'high'});
  await page.evaluate(()=>{
    const p=G.players[0],e=G.players[1];
    for(let i=0;i<40;i++){const q=freeNear(p.start.x,p.start.y,4,10);const u=mkUnit(i%2?'champion':'paladin',0,q.x,q.y);}
    for(let i=0;i<6;i++){const q=freeNear(p.start.x,p.start.y,4,10);mkUnit('siegeram',0,q.x,q.y)}
    for(const u of G.units)if(u.owner===0&&(isMil(u)||u.def.k==='ram'))orderAttackMove(u,e.start.x,e.start.y);
    G.speed=3;
  });
  let over=null;
  for(let i=0;i<150&&!over;i++){await page.waitForTimeout(1000);over=await page.evaluate(()=>G.over&&G.over.text);if(i%15===0)console.log(await page.evaluate(()=>JSON.stringify({t:G.time|0,mine:G.units.filter(u=>!u.dead&&u.owner===0&&isMil(u)).length,eB:G.blds.filter(b=>!b.dead&&b.owner===1).map(b=>b.type+':'+(b.hp|0)).join(','),eU:G.units.filter(u=>!u.dead&&u.owner===1).map(u=>u.type[0]+u.t[0]).join('')})))}
  console.log(JSON.stringify(await page.evaluate(()=>({t:G.time|0,mine:G.units.filter(u=>!u.dead&&u.owner===0&&isMil(u)).length,rams:G.units.filter(u=>!u.dead&&u.owner===0&&u.def.k==='ram').length,enemyBld:G.blds.filter(b=>!b.dead&&b.owner===1).length,enemyUnits:G.units.filter(u=>!u.dead&&u.owner===1).length,states:G.units.filter(u=>!u.dead&&u.owner===0&&isMil(u)).slice(0,6).map(u=>u.t+'@'+(u.x|0)+','+(u.y|0)),e:G.players[1].start}))));await page.screenshot({path:'/tmp/s_war.png'});
  ok('victory declared',/Victory/.test(over||''),over);
  await page.waitForTimeout(600);
  ok('end modal shown',(await page.locator('#en-restart').count())===1);
  await page.screenshot({path:'/tmp/s_victory.png'});
  // restart
  await page.click('#en-restart');await page.waitForTimeout(800);
  ok('restart gives fresh game',await page.evaluate(()=>G.time<3&&!G.over&&G.players.every(p=>p.alive)),await page.evaluate(()=>G.time));
  // defeat: kill human's buildings
  await page.evaluate(()=>{for(const b of G.blds)if(b.owner===0)killEnt(b,null);for(const u of G.units)if(u.owner===0&&u.def.k==='villager')killEnt(u,null);G.speed=3});
  await page.waitForTimeout(2500);
  ok('defeat declared',await page.evaluate(()=>G.over&&!G.over.win),await page.evaluate(()=>G.over&&G.over.text));
  await page.screenshot({path:'/tmp/s_defeat.png'});
  console.log('ERR',errs.filter(e=>!/404/.test(e)).join('|'));
  await browser.close();
})();
