const {launch,startGame}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1920,1080);
  await startGame(page,{seed:31,ai:1,vis:'all',age:2,civ:'japanese',res:'high'});
  await page.evaluate(()=>{
    const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
    const b=mkBld('blacksmith',0,tc.x+7,tc.y-6,true);const bk=mkBld('barracks',0,tc.x+7,tc.y+6,true);
    p.techs.add('forging');
    setSel([b.id]);window.__bk=bk;CAM.zoom=1.2;centerOn(tc.cx+3,tc.cy);
  });
  await page.waitForTimeout(600);
  await page.hover('#cmdcard .cbtn:nth-child(5)');await page.waitForTimeout(300);
  await page.screenshot({path:'/tmp/s_card1.png'});
  await page.evaluate(()=>{setSel([__bk.id])});await page.waitForTimeout(300);
  await page.hover('#cmdcard .cbtn:nth-child(4)');await page.waitForTimeout(300);
  await page.screenshot({path:'/tmp/s_card2.png'});
  console.log(errs.filter(e=>!/404/.test(e)).join('\n'));
  await browser.close();
})();
