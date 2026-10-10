const {launch,startGame}=require('./lib');
const ok=(n,c,d)=>console.log((c?'PASS':'FAIL')+' | '+n+(d?' | '+d:''));
(async()=>{
  const {browser,page,errs}=await launch(1280,720);
  await startGame(page,{seed:31,ai:2});
  const scr=(fn)=>page.evaluate(fn);
  // select a villager by clicking on it
  const vpos=await scr(()=>{const v=G.units.find(u=>u.owner===0&&u.type==='villager');const[sx,sy]=toScr(v.x,v.y,v.z);return{sx,sy:sy-12,id:v.id}});
  await page.mouse.click(vpos.sx,vpos.sy);
  let sel=await scr(()=>UI.sel.slice());
  ok('click selects villager',sel.length===1&&sel[0]===vpos.id,JSON.stringify(sel));
  await page.waitForTimeout(300);
  ok('caption/voice shown',(await page.locator('#captions .cap').count())>0,await page.locator('#captions').innerText());
  // right-click tree
  const tpos=await scr(()=>{const v=G.byId.get(UI.sel[0]);const t=findResNear(v.x,v.y,e=>e.res==='w',15);const[sx,sy]=toScr(t.x+.5,t.y+.5,hAt(t.x,t.y));return{sx,sy:sy-20,id:t.id}});
  await page.mouse.click(tpos.sx,tpos.sy,{button:'right'});
  await page.waitForTimeout(200);
  const st=await scr(()=>{const v=G.byId.get(UI.sel[0]);return{t:v.t,tgt:v.tgt}});
  ok('right-click tree -> gather',st.t==='gather'&&st.tgt===tpos.id,JSON.stringify(st));
  // build house via card: Q (eco menu) then Q (house)
  await page.keyboard.press('q');await page.waitForTimeout(150);
  const title=await page.locator('#cmdtitle').innerText();
  ok('eco build menu opens',/Economic/.test(title),title);
  await page.keyboard.press('q');await page.waitForTimeout(100);
  const placing=await scr(()=>UI.placing&&UI.placing.type);
  ok('house placement mode',placing==='house',placing);
  // move mouse near TC and click
  const gpos=await scr(()=>{const p=G.players[0];const sp=freeNear(p.start.x+5,p.start.y+3,1,5);const[sx,sy]=toScr(sp.x,sp.y,hAt(sp.x,sp.y));return{sx,sy}});
  await page.mouse.move(gpos.sx,gpos.sy);await page.waitForTimeout(100);
  const gh=await scr(()=>({ok:R.ghost&&R.ghost.ok,why:UI.ghostWhy}));
  await page.mouse.click(gpos.sx,gpos.sy);await page.waitForTimeout(200);
  const nh=await scr(()=>G.blds.filter(b=>b.owner===0&&b.type==='house').length);
  ok('house placed',nh===1,JSON.stringify(gh));
  // cheat typing: letters must not trigger hotkeys
  await page.keyboard.press('Enter');await page.waitForTimeout(100);
  ok('chat opens',await scr(()=>UI.typing));
  const before=await scr(()=>({w:G.players[0].res.w,menu:UI.menu,placing:!!UI.placing}));
  await page.keyboard.type('LumberJack',{delay:20});
  const mid=await scr(()=>({menu:UI.menu,placing:!!UI.placing,sel:UI.sel.length,val:document.getElementById('chatinput').value}));
  ok('typing letters does not trigger shortcuts',mid.val==='LumberJack'&&!mid.placing&&mid.menu===before.menu,JSON.stringify(mid));
  await page.keyboard.press('Enter');await page.waitForTimeout(200);
  const after=await scr(()=>G.players[0].res.w);
  ok('cheat lumberjack adds 10000 wood',after>=before.w+9900,before.w+' -> '+after);
  await page.keyboard.press('Enter');await page.keyboard.type('lumberjack');await page.keyboard.press('Enter');await page.waitForTimeout(100);
  ok('cheat repeatable',(await scr(()=>G.players[0].res.w))>=after+9900);
  await page.keyboard.press('Enter');await page.keyboard.type('hello there');await page.keyboard.press('Enter');await page.waitForTimeout(100);
  ok('plain chat shown',/hello there/.test(await page.locator('#chatlog').innerText()));
  await page.keyboard.press('Enter');await page.keyboard.type('how do you turn this on');await page.keyboard.press('Enter');await page.waitForTimeout(200);
  ok('cobra spawned',await scr(()=>G.units.some(u=>u.owner===0&&u.type==='cobra')));
  await page.keyboard.press('Enter');await page.keyboard.type('aegis');await page.keyboard.press('Enter');await page.waitForTimeout(100);
  ok('aegis toggled',await scr(()=>G.cheats.aegis));
  // diplomacy
  await page.click('#tb-dip');await page.waitForTimeout(200);
  ok('diplomacy panel lists 2 AIs',(await page.locator('table.dip tr').count())===3);
  await page.screenshot({path:'/tmp/s_dip.png'});
  await page.click('button[data-d=peace] >> nth=0');await page.waitForTimeout(200);
  const dtxt=await page.locator('#modalbox').innerText();
  ok('peace proposal gets a response',/refuses|accepts/.test(dtxt),dtxt.split('\n').filter(l=>/refuses|accepts/.test(l)).join('|'));
  await page.click('#dip-close');
  // help
  await page.click('#tb-help');await page.waitForTimeout(150);
  const help=await page.locator('#modalbox').innerText();
  ok('help lists cheats',/cheese steak jimmy/.test(help)&&/how do you turn this on/.test(help)&&/BIGDADDY/.test(help));
  await page.click('#help-close');
  // bell
  await page.click('#tb-bell');await page.waitForTimeout(100);
  ok('bell toggles on',await scr(()=>G.players[0].bell));
  await page.click('#tb-bell');
  // pause menu + audio
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForTimeout(150);
  ok('esc opens pause menu',(await page.locator('#pm-resume').count())===1);
  await page.click('#pm-audio');await page.waitForTimeout(150);
  ok('audio panel has 3 sliders & mutes',(await page.locator('input[type=range]').count())===3&&(await page.locator('input[data-mute]').count())===3);
  await page.screenshot({path:'/tmp/s_audio.png'});
  await page.click('#au-close');await page.click('#pm-resume');
  await page.screenshot({path:'/tmp/s_ui1.png'});
  console.log('ERRORS',errs.filter(e=>!/404/.test(e)).slice(0,10).join('\n'));
  await browser.close();
})();
