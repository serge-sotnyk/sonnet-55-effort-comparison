const {launch}=require('./lib');
const fs=require('fs');
const ok=(n,c,d)=>console.log((c?'PASS':'FAIL')+' | '+n+(d?' | '+d:''));
(async()=>{
  const {browser,page,errs}=await launch(1366,768);
  await page.goto('http://localhost:8765/index.html');await page.waitForTimeout(400);
  await page.evaluate(()=>localStorage.clear());
  await page.click('#mm-editor');await page.waitForTimeout(300);
  ok('new-map dialog appears',await page.locator('#nw-ok').count()===1);
  await page.selectOption('#nw-kind','blank');await page.selectOption('#nw-size','tiny');await page.click('#nw-ok');await page.waitForTimeout(500);
  ok('editor opens with blank map',await page.evaluate(()=>R.editor&&EDITOR.md.w===48&&EDITOR.md.terr.every(t=>t===0)));
  const tile=async(x,y)=>await page.evaluate(([x,y])=>{const[sx,sy]=toScr(x+.5,y+.5,hAt(x,y));return{sx,sy}},[x,y]);
  const click=async(x,y,o)=>{const p=await tile(x,y);await page.mouse.click(p.sx,p.sy,o||{})};
  const drag=async(x0,y0,x1,y1)=>{const a=await tile(x0,y0),b=await tile(x1,y1);await page.mouse.move(a.sx,a.sy);await page.mouse.down();await page.mouse.move((a.sx+b.sx)/2,(a.sy+b.sy)/2,{steps:4});await page.mouse.move(b.sx,b.sy,{steps:4});await page.mouse.up()};
  await page.evaluate(()=>{CAM.zoom=0.7;centerOn(24,24)});await page.waitForTimeout(200);
  // validation fails (no starts)
  await page.click('#ed-validate');await page.waitForTimeout(200);
  ok('validate reports missing starts',/no start/.test(await page.locator('#modalbox').innerText()));
  await page.click('#er-ok');
  // paint water lake
  await page.click('#ed-tools button[data-t=terrain]');
  await page.locator('#ed-palette .pal').nth(4).click();
  await page.evaluate(()=>{EDITOR.brush=3});
  await drag(30,20,30,28);
  ok('terrain painting makes water',await page.evaluate(()=>EDITOR.md.terr.filter(t=>t===4).length>10),await page.evaluate(()=>EDITOR.md.terr.filter(t=>t===4).length));
  // elevation
  await page.click('#ed-tools button[data-t=elev]');await page.locator('#ed-palette .pal').nth(0).click();
  await drag(20,32,25,32);
  ok('elevation painting raises land',await page.evaluate(()=>EDITOR.md.hgt.filter(h=>h>0).length>5));
  // start flags
  await page.click('#ed-tools button[data-t=start]');
  await click(8,8);await page.evaluate(()=>{EDITOR.owner=1});await click(38,38);
  ok('start flags set',await page.evaluate(()=>!!EDITOR.md.starts[0]&&!!EDITOR.md.starts[1]),await page.evaluate(()=>JSON.stringify(EDITOR.md.starts)));
  // place gold, TC, fish on land (invalid) and fish in water
  await page.click('#ed-tools button[data-t=place]');
  await page.evaluate(()=>{EDITOR.pal.obj={k:'res',t:'gold'};EDITOR.brush=1;edRefreshUI()});await click(12,10);
  await page.evaluate(()=>{EDITOR.pal.obj={k:'res',t:'fish'};edRefreshUI()});await click(14,10);
  ok('fish on land refused',await page.evaluate(()=>!EDITOR.md.objs.some(o=>o.t==='fish')),await page.locator('#ed-status').innerText());
  await click(30,24);
  ok('fish on water accepted',await page.evaluate(()=>EDITOR.md.objs.some(o=>o.t==='fish')));
  await page.evaluate(()=>{EDITOR.pal.obj={k:'bld',t:'towncenter'};EDITOR.owner=0;edRefreshUI()});await click(8,8);
  ok('TC placed with owner',await page.evaluate(()=>EDITOR.md.objs.some(o=>o.t==='towncenter'&&o.o===0)));
  await click(8,8);
  ok('overlap refused',await page.evaluate(()=>EDITOR.md.objs.filter(o=>o.t==='towncenter').length===1),await page.locator('#ed-status').innerText());
  await page.evaluate(()=>{EDITOR.owner=1;edRefreshUI()});await click(38,38);
  // computer owner unit
  await page.evaluate(()=>{EDITOR.pal.obj={k:'unit',t:'archer'};EDITOR.owner=1;edRefreshUI()});await click(33,36);
  await page.evaluate(()=>{EDITOR.pal.obj={k:'unit',t:'galley'};EDITOR.owner=1;edRefreshUI()});await click(30,26);
  ok('units placed w/ owners',await page.evaluate(()=>EDITOR.md.objs.some(o=>o.t==='archer'&&o.o===1)&&EDITOR.md.objs.some(o=>o.t==='galley')));
  // erase + undo/redo
  const n0=await page.evaluate(()=>EDITOR.md.objs.length);
  await page.click('#ed-tools button[data-t=erase]');await page.evaluate(()=>{EDITOR.brush=2});await click(12,10);
  const n1=await page.evaluate(()=>EDITOR.md.objs.length);
  await page.click('#ed-undo');const n2=await page.evaluate(()=>EDITOR.md.objs.length);await page.click('#ed-redo');const n3=await page.evaluate(()=>EDITOR.md.objs.length);
  ok('erase/undo/redo',n1<n0&&n2===n0&&n3===n1,[n0,n1,n2,n3].join(','));
  // select & move
  await page.evaluate(()=>centerOn(12,12));
  await page.click('#ed-tools button[data-t=select]');
  await page.evaluate(()=>{EDITOR.pal.obj=null});
  const tcp=await page.evaluate(()=>{const o=EDITOR.md.objs.find(o=>o.t==='towncenter'&&o.o===0);const[sx,sy]=toScr(o.x+2,o.y+2,0);return{sx,sy:sy-10}});
  const dest=await tile(14,14);
  await page.mouse.move(tcp.sx,tcp.sy);await page.mouse.down();await page.mouse.move(dest.sx,dest.sy,{steps:6});await page.mouse.up();
  console.log('selObj',await page.evaluate(()=>JSON.stringify(EDITOR.selObj)),JSON.stringify(tcp),JSON.stringify(dest));
  ok('select+move TC',await page.evaluate(()=>{const o=EDITOR.md.objs.find(o=>o.t==='towncenter'&&o.o===0);return o.x!==6}),await page.evaluate(()=>JSON.stringify(EDITOR.md.objs.find(o=>o.t==='towncenter'&&o.o===0))));
  // add computer player
  const np0=await page.evaluate(()=>EDITOR.md.np);
  await page.getByText('+ Computer').click();
  ok('add computer player',await page.evaluate(()=>EDITOR.md.np)===np0+1);
  await page.getByText('− Computer').click();
  await page.screenshot({path:'/tmp/s_editor.png'});
  // validate
  await page.click('#ed-validate');await page.waitForTimeout(200);
  const vtxt=await page.evaluate(()=>validateMap(EDITOR.md).join(' | '));
  console.log('validation:',vtxt);
  // fix: remove galley on?? check ship placed on water ok. Save
  await page.evaluate(()=>$('modal').classList.add('hidden'));
  await page.click('#ed-save');await page.fill('#sv-name','Test Map A');await page.click('#sv-ok');await page.waitForTimeout(200);
  ok('saved to localStorage',await page.evaluate(()=>!!JSON.parse(localStorage.getItem('aor_maps'))['Test Map A']));
  // export file
  const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#ed-export')]);
  const path='/tmp/export_test.json';await dl.saveAs(path);
  const exp=JSON.parse(fs.readFileSync(path,'utf8'));ok('export file valid',exp.w===48&&exp.objs.length>3,dl.suggestedFilename());
  // wipe editor, reload from save
  await page.evaluate(()=>{EDITOR.md.terr.fill(0);EDITOR.md.objs=[];edRebuild()});
  await page.click('#ed-load');await page.locator('[data-load="Test Map A"]').click();await page.waitForTimeout(300);
  ok('load restores objects',await page.evaluate(()=>EDITOR.md.objs.length>=4&&EDITOR.md.terr.some(t=>t===4)));
  // import
  await page.evaluate(()=>{EDITOR.md.objs=[];edRebuild()});
  await page.setInputFiles('#ed-file',path);await page.waitForTimeout(400);
  ok('import restores',await page.evaluate(()=>EDITOR.md.objs.length>=4));
  // play
  const errsNow=await page.evaluate(()=>validateMap(EDITOR.md));
  if(errsNow.length){console.log('fixing validation errs',errsNow);}
  await page.click('#ed-play');await page.waitForTimeout(300);
  const modal=await page.locator('#modalbox').innerText().catch(()=>'');
  console.log('play result: setup visible?',await page.locator('#setup').isVisible(),modal.slice(0,200));
  if(await page.locator('#setup').isVisible()){
    await page.check('#s-cheats');await page.click('#s-start');await page.waitForTimeout(1500);
    ok('custom map match started',await page.evaluate(()=>!!G&&G.md.custom&&G.players.length===2&&G.W===48),await page.evaluate(()=>G&&G.players.map(p=>p.name+':'+Math.round(p.start.x)+','+Math.round(p.start.y)).join(' ')));
    ok('custom objects present in match',await page.evaluate(()=>G.units.some(u=>u.type==='galley')&&G.blds.filter(b=>b.type==='towncenter').length===2));
    await page.evaluate(()=>{for(let i=0;i<200;i++)stepGame(0.1)});
    await page.screenshot({path:'/tmp/s_custom.png'});
    // return to editor
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForTimeout(100);
    await page.click('#pm-editor');await page.waitForTimeout(400);
    ok('return to editor keeps design',await page.evaluate(()=>R.editor&&EDITOR.md.objs.length>=4&&EDITOR.md.terr.some(t=>t===4)));
  }
  console.log('ERRORS',errs.filter(e=>!/404/.test(e)).slice(0,10).join('\n'));
  await browser.close();
})();
