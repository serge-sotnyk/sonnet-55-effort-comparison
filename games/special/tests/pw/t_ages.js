const {launch}=require('./lib');
(async()=>{
  const {browser,page,errs}=await launch(1500,900);
  await page.goto('http://localhost:8765/index.html');await page.waitForTimeout(400);
  await page.evaluate(()=>{
    document.querySelectorAll('.screen,#hud').forEach(e=>e.style.display='none');
    const c=document.createElement('canvas');c.width=1500;c.height=900;c.style.cssText='position:fixed;left:0;top:0;z-index:999;background:#5a8a40';document.body.appendChild(c);
    const x=c.getContext('2d');
    const types=['towncenter','house','barracks','blacksmith','monastery','castle'];
    types.forEach((t,r)=>{for(let a=0;a<4;a++){const sp=getBuildingSprite(t,r%2?'japanese':'britons',a,'#3a78e0');const sc=t==='castle'||t==='towncenter'?0.75:1;x.save();x.translate(180+a*330,100+r*140);x.scale(sc,sc);x.drawImage(sp.cv,-sp.ox,-sp.oy);x.restore()}});
  });
  await page.waitForTimeout(500);
  await page.screenshot({path:'/tmp/s_ages.png'});
  console.log(errs.filter(e=>!/404/.test(e)).join('|'));
  await browser.close();
})();
