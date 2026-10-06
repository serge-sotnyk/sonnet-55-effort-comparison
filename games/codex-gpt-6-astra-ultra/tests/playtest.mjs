import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); console.log(`PASS: ${name}`); };
const tick = seconds => page.evaluate(seconds => { const paused=game.paused; game.paused=false; for(let i=0;i<seconds;i++)game.update(1); game.paused=paused; }, seconds);
const screen = (x,y,offset=0) => page.evaluate(({x,y,offset})=>{const p=renderer.worldToScreen(x,y),r=document.getElementById('world').getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top-offset};},{x,y,offset});
try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForFunction(()=>window.game&&window.renderer&&document.querySelector('[data-action="train:villager"]'));
  await page.screenshot({ path: 'artifacts/initial.png', fullPage: true });
  check('Initial game renders with Town Center selected', await page.locator('#selection-name').innerText()==='Town Center');

  await page.locator('#pause-button').click();
  const pausedAt=await page.evaluate(()=>game.time);
  await page.waitForTimeout(250);
  check('Pause stops the simulation', await page.evaluate(()=>game.paused&&game.time)===pausedAt);
  const foodBefore=await page.evaluate(()=>game.stock.food);
  await page.locator('[data-action="train:villager"]').click();
  check('Train Villager click charges food and queues a worker',await page.evaluate(()=>game.buildings.find(b=>b.owner==='player'&&b.type==='towncenter').queue.length)===1 && await page.evaluate(()=>game.stock.food)===foodBefore-50);
  await page.locator('#cancel-queue').click();
  check('Training cancellation refunds the cost',await page.evaluate(()=>game.stock.food)===foodBefore);
  await page.locator('[data-action="train:villager"]').click();
  await tick(12);
  check('Queued villager completes and starts work',await page.evaluate(()=>game.units.filter(u=>u.owner==='player'&&u.type==='villager').length)===8);

  const worker=await page.evaluate(()=>{
    for(const v of game.units.filter(u=>u.owner==='player'&&u.type==='villager')){const p=renderer.worldToScreen(v.x,v.y);if(p.x>350&&p.x<1180&&p.y>100&&p.y<renderer.height-40&&hitTest(p.x,p.y-10*renderer.zoom)?.id===v.id)return{x:v.x,y:v.y,id:v.id};}
  });
  assert.ok(worker,'A worker can be selected on the battlefield');
  const wp=await screen(worker.x,worker.y,9);
  await page.mouse.click(wp.x,wp.y);
  check('Canvas click selects a villager',await page.evaluate(id=>game.selectedIds.has(id),worker.id));
  await page.keyboard.press('x');
  check('Stop command makes selected worker idle',await page.evaluate(id=>game.getEntity(id).action,worker.id)==='idle');
  const gold=await page.evaluate(()=>{
    for(const r of game.resources.filter(r=>r.type==='gold'&&r.x<23&&r.y<23)){const p=renderer.worldToScreen(r.x,r.y);if(p.x>350&&p.x<1180&&p.y<renderer.height-35&&hitTest(p.x,p.y-10*renderer.zoom)?.id===r.id)return{x:r.x,y:r.y,id:r.id};}
  });
  assert.ok(gold,'A gold deposit can be clicked');
  const gp=await screen(gold.x,gold.y,9);
  await page.mouse.click(gp.x,gp.y,{button:'right'});
  check('Right-click resource assigns gathering',await page.evaluate(({id,target})=>game.getEntity(id).action==='gather'&&game.getEntity(id).targetId===target,{id:worker.id,target:gold.id}));
  const gatheredBefore=await page.evaluate(()=>game.totalGathered.gold);
  await tick(30);
  check('Workers physically gather and deliver gold',await page.evaluate(()=>game.totalGathered.gold)>gatheredBefore);

  await page.keyboard.press('b');
  await page.locator('[data-build="house"]').click();
  const place=await page.evaluate(()=>{
    for(let x=14;x<21;x+=.5)for(let y=7;y<18;y+=.5){const p=renderer.worldToScreen(x,y);if(p.x>350&&p.x<1180&&p.y>180&&p.y<renderer.height-70&&game.validPlacement('house',x,y))return{x,y};}
  });
  assert.ok(place,'Valid house location found');
  const pp=await screen(place.x,place.y);
  await page.mouse.move(pp.x,pp.y);
  await page.mouse.click(pp.x,pp.y);
  const house=await page.evaluate(()=>game.buildings.find(b=>b.owner==='player'&&b.type==='house'&&b.built<1)?.id);
  check('House placement creates foundation through canvas',!!house);
  await page.screenshot({path:'artifacts/construction.png',fullPage:true});
  await tick(28);
  check('Villager completes construction and adds population capacity',await page.evaluate(id=>game.getEntity(id)?.built>=1&&game.populationCap===25,house));

  await page.keyboard.press('h');
  await page.locator('[data-action="age"]').click();
  check('Advance Age starts from real control',await page.evaluate(()=>game.ageProgress!==null));
  await tick(42);
  await page.waitForTimeout(250);
  check('Feudal Age completes and updates selected Town Center',await page.evaluate(()=>game.age)===1 && await page.locator('#age-name').innerText()==='Feudal Age' && (await page.locator('#selection-kind').innerText()).includes('FEUDAL AGE'));
  await page.locator('#tab-army').click();
  await page.locator('[data-action="train:militia"]').click();
  await tick(15);
  check('Military tab trains a soldier at the barracks',await page.evaluate(()=>game.units.filter(u=>u.owner==='player'&&u.type==='militia').length)>=3);

  await page.keyboard.press('F2');
  const armyCount=await page.evaluate(()=>game.selectedIds.size);
  check('F2 selects the entire army',armyCount>=4&&await page.evaluate(()=>game.getSelection().every(u=>u.owner==='player'&&u.type!=='villager')));
  await page.keyboard.press('Control+1');
  await page.keyboard.press('h');
  await page.keyboard.press('1');
  check('Control groups save and restore army selection',await page.evaluate(()=>game.selectedIds.size)===armyCount);
  await page.locator('#find-enemy').click();
  check('Locate Rival pans to the enemy',await page.evaluate(()=>renderer.camera.x)>30);
  const target=await page.evaluate(()=>{const b=game.buildings.find(b=>b.owner==='enemy'&&b.type==='towncenter');return{x:b.x,y:b.y,id:b.id};});
  const ep=await screen(target.x,target.y,45);
  await page.mouse.click(ep.x,ep.y,{button:'right'});
  check('Right-click rival Town Center orders an attack',await page.evaluate(id=>game.getSelection().every(u=>u.action==='attack'&&u.targetId===id),target.id));
  await page.locator('#home-button').click();
  const zoom=await page.evaluate(()=>renderer.zoom);
  await page.locator('#zoom-in').click();
  check('Zoom control changes battlefield scale',await page.evaluate(()=>renderer.zoom)>zoom);
  await page.locator('#zoom-out').click();
  const mini=await page.locator('#minimap').boundingBox();
  await page.mouse.click(mini.x+mini.width*.5,mini.y+mini.height*.75);
  check('Minimap click navigates the battlefield',await page.evaluate(()=>renderer.camera.x)>25);
  await page.keyboard.press('h');

  await page.locator('#pause-button').click();
  await page.locator('#help-button').click();
  check('Field guide opens and pauses the match',await page.locator('#modal-title').innerText()==='Your field guide'&&await page.evaluate(()=>game.paused));
  await page.locator('#resume-game').click();
  check('Closing guide restores running state',!await page.evaluate(()=>game.paused));
  await page.locator('#speed-button').click();
  check('Speed control changes simulation rate',await page.evaluate(()=>game.speed)===1.5);
  await page.locator('#sound-button').click();
  check('Sound control enables audio',await page.locator('#sound-button').getAttribute('title')==='Mute sound');

  await page.locator('#menu-button').click();
  await page.locator('#restart-game').click();
  await page.locator('#confirm-restart').click();
  check('New game resets settlement, age, clock, and pause state',await page.evaluate(()=>game.age===0&&game.time<3&&game.population===10&&!game.paused));
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  for(const [width,height] of [[1100,800],[760,900]]){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(300);
    const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:document.getElementById('world').getBoundingClientRect().toJSON(),menu:document.getElementById('menu-button').getBoundingClientRect().toJSON()}));
    check(`Layout fits ${width}px viewport`,layout.scrollWidth<=width&&layout.canvas.width===width&&layout.menu.right<=width);
    await page.screenshot({path:`artifacts/viewport-${width}.png`,fullPage:true});
    await page.locator('[data-action="train:villager"]').click();
    check(`Train control works at ${width}px width`,await page.evaluate(()=>game.buildings.find(b=>b.owner==='player'&&b.type==='towncenter').queue.length)>0);
  }
  check('No browser console or uncaught errors',errors.length===0);
  await writeFile('artifacts/playtest-report.json',JSON.stringify({checks,errors},null,2));
} catch(error){
  await page.screenshot({path:'artifacts/failure.png',fullPage:true});
  await writeFile('artifacts/playtest-report.json',JSON.stringify({checks,errors,failure:error.stack},null,2));
  throw error;
} finally {
  await browser.close();
}
await import('./edge-cases.mjs');
await import('./strategy.mjs');
console.log('All browser and full-match gameplay checks passed.');
