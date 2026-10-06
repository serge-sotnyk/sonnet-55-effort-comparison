import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1512,height:982}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto('http://localhost:5173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.game&&window.hitTest);
  await page.locator('#pause-button').click();
  await page.locator('#help-button').click();
  await page.locator('#resume-game').click();
  assert.equal(await page.evaluate(()=>game.paused),true,'Closing guide must preserve an already paused game');
  console.log('PASS: Field guide preserves an already paused match');

  const resource=await page.evaluate(()=>{
    for(const r of game.resources.filter(r=>r.type==='gold'&&r.x<23&&r.y<23)){
      const p=renderer.worldToScreen(r.x,r.y),rect=document.getElementById('world').getBoundingClientRect();
      if(p.x>350&&p.x<1180&&p.y<renderer.height-35&&hitTest(p.x,p.y-10*renderer.zoom)?.id===r.id)return{id:r.id,x:p.x+rect.left,y:p.y+rect.top-10*renderer.zoom};
    }
  });
  await page.mouse.click(resource.x,resource.y);
  assert.equal(await page.locator('#selection-name').innerText(),'Gold');
  assert.equal(await page.locator('#selection-kind').innerText(),'NATURAL RESOURCE');
  assert.ok((await page.locator('#selection-description').innerText()).toLowerCase().includes('gold'));
  console.log('PASS: Resource selection displays resource information');
  await page.locator('#find-enemy').click();
  const enemy=await page.evaluate(()=>{
    const b=game.buildings.find(b=>b.owner==='enemy'&&b.type==='towncenter'),p=renderer.worldToScreen(b.x,b.y),r=document.getElementById('world').getBoundingClientRect();
    return{id:b.id,x:p.x+r.left,y:p.y+r.top-45};
  });
  await page.mouse.click(enemy.x,enemy.y);
  assert.equal(await page.locator('#selection-name').innerText(),'Town Center');
  assert.equal(await page.locator('#selection-kind').innerText(),'THE CRIMSON KINGDOM');
  assert.equal(await page.locator('[data-action="train:villager"]').count(),0);
  console.log('PASS: Enemy building selection shows rival information');
  await page.keyboard.press('h');
  const box=await page.evaluate(()=>{
    const r=document.getElementById('world').getBoundingClientRect(),p=game.units.filter(u=>u.owner==='player'&&u.type!=='villager').map(u=>renderer.worldToScreen(u.x,u.y));
    return{left:Math.min(...p.map(p=>p.x))+r.left-15,right:Math.max(...p.map(p=>p.x))+r.left+15,top:Math.min(...p.map(p=>p.y))+r.top-20,bottom:Math.max(...p.map(p=>p.y))+r.top+10};
  });
  await page.mouse.move(box.left,box.top);
  await page.mouse.down();
  await page.mouse.move(box.right,box.bottom,{steps:8});
  await page.mouse.up();
  assert.ok(await page.evaluate(()=>game.getSelection().filter(u=>u.type!=='villager').length)>=3);
  console.log('PASS: Drag selection selects the military group');
  const before=await page.evaluate(()=>({...renderer.camera}));
  await page.keyboard.down('d');
  await page.waitForTimeout(250);
  await page.keyboard.up('d');
  assert.ok(await page.evaluate(old=>Math.abs(renderer.camera.x-old.x)>.1,before));
  console.log('PASS: Keyboard camera movement works');
  await page.locator('#pause-button').click();
  await page.keyboard.press('h');
  await page.waitForTimeout(5200);
  await page.screenshot({path:'artifacts/initial-clean.png',fullPage:true});

  await page.evaluate(()=>{for(let i=0;i<600&&!game.result;i++)game.update(1);});
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>game.result),'defeat');
  assert.equal(await page.locator('#modal-title').innerText(),'Your kingdom has fallen');
  await page.screenshot({path:'artifacts/defeat.png',fullPage:true});
  await page.locator('#play-again').click();
  assert.ok(await page.evaluate(()=>!game.result&&!game.paused&&game.population===10));
  console.log('PASS: AI defeats an undefended player, result dialog works, and replay resets the match');
  assert.deepEqual(errors,[]);
  console.log('PASS: No browser errors during extra scenarios');
} finally {await browser.close();}
