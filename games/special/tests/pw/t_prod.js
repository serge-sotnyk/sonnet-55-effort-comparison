const {launch,startGame}=require('./lib');
const ok=(n,c,d)=>console.log((c?'PASS':'FAIL')+' | '+n+(d?' | '+d:''));
(async()=>{
  const {browser,page,errs}=await launch(1366,768);
  await startGame(page,{seed:12,ai:1,res:'med'});
  const scr=f=>page.evaluate(f);
  const v0=await scr(()=>G.units.filter(u=>u.owner===0&&u.type==='villager').length);
  await page.keyboard.press('q');await page.keyboard.press('q');await page.keyboard.down('Shift');await page.keyboard.press('q');await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
  const q=await scr(()=>G.blds.find(b=>b.owner===0&&b.type==='towncenter').queue.length);
  ok('queued villagers incl. shift x5',q===7,q);
  ok('queue shown in panel',(await page.locator('.si-q .u').count())===7);
  await page.screenshot({path:'/tmp/s_queue.png'});
  await scr(()=>{G.speed=3});await page.waitForTimeout(9000);
  const v1=await scr(()=>G.units.filter(u=>u.owner===0&&u.type==='villager').length);
  ok('villagers produced',v1>v0+2,v0+' -> '+v1);
  // locked age-up tooltip
  await page.hover('#cmdcard .cbtn:nth-child(6)');await page.waitForTimeout(200);
  const tip=await page.locator('#tooltip').innerText();
  console.log('age tooltip:',tip.replace(/\n/g,' | '));
  ok('locked tech explains missing',/Requires/.test(tip));
  // build barracks etc via villagers & train military
  await scr(()=>{const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');G.cheats.aegis=true;
    for(const t of ['house','mill','barracks']){const sp=freeNear(tc.cx+8,tc.cy+(t==='mill'?-6:t==='house'?0:6),1,8);const v=G.units.find(u=>u.owner===0&&u.type==='villager');placeBuilding(p,t,Math.floor(sp.x)-1,Math.floor(sp.y)-1,[v])}});
  await page.waitForTimeout(1500);
  ok('instant build with aegis',await scr(()=>G.blds.filter(b=>b.owner===0&&b.built).map(b=>b.type).join(',')));
  await scr(()=>{const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');setSel([tc.id])});
  await page.keyboard.press('t'); // age up feudal ... uses slot index 4? TC trains villager(0) + techs from slot 1
  await page.waitForTimeout(300);
  await scr(()=>{const b=G.blds.find(b=>b.owner===0&&b.type==='barracks');setSel([b.id])});
  await page.keyboard.press('q');await page.keyboard.press('q');await page.waitForTimeout(2500);
  ok('barracks trains militia',await scr(()=>G.units.filter(u=>u.owner===0&&u.type==='militia').length)>=1);
  console.log('ERR',errs.filter(e=>!/404/.test(e)).join('|'));
  await browser.close();
})();
