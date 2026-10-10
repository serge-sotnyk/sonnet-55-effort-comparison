const {launch,startGame}=require('./lib');
(async()=>{
  for(const map of ['coastal','arabia']){
  const {browser,page,errs}=await launch(1280,720);
  await startGame(page,{seed:71,ai:2,map,size:'small',age:3,res:'high'});
  await page.evaluate(()=>{G.speed=3});
  const keys=['q','w','e','r','t','a','s','d','f','g','z','x','c','v','b','y','u','i','o','p','h','.',',','1','2','3','Escape','Delete'];
  let r=1234;const rnd=()=>{r=(r*1664525+1013904223)>>>0;return r/4294967296};
  const W=1280,H=720;
  for(let i=0;i<900;i++){
    const a=rnd();
    const x=40+rnd()*(W-80),y=60+rnd()*(H-60-210);
    try{
    if(a<0.25)await page.mouse.click(x,y);
    else if(a<0.45)await page.mouse.click(x,y,{button:'right'});
    else if(a<0.55){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+rnd()*200-100,y+rnd()*150-75,{steps:3});await page.mouse.up()}
    else if(a<0.9){const k=keys[Math.floor(rnd()*keys.length)];await page.keyboard.press(k==='Delete'&&rnd()<0.9?'q':k)}
    else if(a<0.93){await page.mouse.click(40+rnd()*200,H-190+rnd()*150)} // minimap/panel clicks
    else if(a<0.96){await page.mouse.click(W-300+rnd()*280,H-190+rnd()*160)}
    else await page.mouse.wheel(0,rnd()<.5?-120:120);
    }catch(e){}
    if(i%15===0){await page.evaluate(()=>{if(!$('modal').classList.contains('hidden')){closeModal()}});await page.waitForTimeout(250);}
    if(i%100===0){await page.evaluate(()=>{if($('modal')&&!$('modal').classList.contains('hidden')){closeModal()}});}
  }
  const st=await page.evaluate(()=>({t:G.time|0,units:G.units.length,blds:G.blds.length,over:G.over&&G.over.text}));
  console.log(map,JSON.stringify(st),'errors:',[...new Set(errs.filter(e=>!/404/.test(e)))].slice(0,8).join(' || '));
  await browser.close();}
})();
