import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const result=(name,data)=>console.log('PASS',name,JSON.stringify(data??''));
try{
 await page.goto('http://localhost:4173');await page.click('#begin');
 let before=await page.evaluate(()=>({...__game.state.resources[0]}));
 await page.evaluate(()=>__game.step(30));
 let after=await page.evaluate(()=>({...__game.state.resources[0]}));
 assert(after.food>before.food+20);assert(after.wood>before.wood+20);assert(after.gold>before.gold+10);result('automatic gathering',after);
 await page.getByRole('button',{name:'Villager',exact:true}).click();await page.evaluate(()=>__game.step(13));
 assert.equal(await page.evaluate(()=>__game.entities.filter(e=>e.owner===0&&e.type==='villager').length),8);result('villager training through UI');
 let worker=await page.evaluate(()=>{let v=__game.entities.find(e=>e.type==='villager'&&!e.owner);return{id:v.id,...__game.project(v.x,v.y)}});
 await page.mouse.click(worker.x,worker.y-16);assert.match(await page.locator('#selectionName').innerText(),/Villager/);
 await page.getByRole('button',{name:'Construct',exact:true}).click();await page.getByRole('button',{name:'Barracks',exact:true}).click();
 let site=await page.evaluate(()=>{for(let y=27;y<40;y++)for(let x=16;x<27;x++)if(__game.validSite('barracks',x,y)&&__game.state.visible[y*60+x]){let p=__game.project(x,y);if(p.x>340&&p.x<1100&&p.y>200&&p.y<730)return{x,y,sx:p.x,sy:p.y}}});assert(site);await page.mouse.click(site.sx,site.sy);await page.evaluate(()=>__game.step(60));
 let barracks=await page.evaluate(()=>__game.entities.find(e=>e.type==='barracks'&&!e.owner));assert(barracks);assert.equal(barracks.progress,1,JSON.stringify(barracks));result('building placement and construction',site);
 await page.evaluate(id=>__game.select([id]),barracks.id);await page.getByRole('button',{name:'Man-at-arms',exact:true}).click();await page.evaluate(()=>__game.step(15));assert.equal(await page.evaluate(()=>__game.entities.filter(e=>e.type==='militia'&&!e.owner).length),2);result('military training');
 await page.evaluate(()=>{Object.assign(__game.state.resources[0],{food:1000,gold:1000});});await page.click('#advance');await page.evaluate(()=>__game.step(41));assert.equal(await page.evaluate(()=>__game.state.age[0]),1);result('Feudal advancement');
 await page.evaluate(()=>{Object.assign(__game.state.resources[0],{food:1000,gold:1000});});await page.click('#advance');await page.evaluate(()=>__game.step(56));assert.equal(await page.evaluate(()=>__game.state.age[0]),2);result('Castle advancement');
 const move=await page.evaluate(()=>{let e=__game.entities.find(e=>e.type==='militia'&&!e.owner);__game.select([e.id]);const from={x:e.x,y:e.y};__game.command({x:27,y:30},null);__game.step(15);return{from,to:{x:e.x,y:e.y},task:e.task,path:e.path.length}});assert(Math.hypot(move.from.x-move.to.x,move.from.y-move.to.y)>3);result('unit pathfinding',move);
 await page.evaluate(()=>__game.save(false));let saved=await page.evaluate(()=>({time:__game.state.time,age:__game.state.age[0]}));await page.reload();assert.match(await page.locator('#begin').innerText(),/Continue/);await page.click('#begin');assert.equal(await page.evaluate(()=>__game.state.age[0]),saved.age);result('save and reload');
 await page.evaluate(()=>__game.step(100));let ai=await page.evaluate(()=>({raid:__game.state.raid,age:__game.state.age[1],buildings:__game.entities.filter(e=>e.owner===1&&e.building).length,time:__game.state.time}));assert(ai.raid>=1);assert(ai.buildings>5);result('AI economy, building and raids',ai);
 await page.screenshot({path:'tests/progress.png'});
 assert.equal(errors.length,0,errors.join('\n'));result('no JavaScript errors');
 await page.keyboard.press('Space');let pauseTime=await page.evaluate(()=>__game.state.time);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__game.state.time),pauseTime);await page.click('#resume');result('pause / resume');
 await page.setViewportSize({width:1024,height:768});await page.screenshot({path:'tests/compact.png'});assert(await page.locator('#commandDock').isVisible());result('compact viewport');
 // Isolated combat fixture to verify actual damage, death, and victory transitions.
 await page.evaluate(()=>{for(let e of __game.entities){if(e.owner===1&&e.building&&e.type!=='town')e.hp=0;if(e.owner===1&&!e.building)e.hp=0;}let town=__game.entities.find(e=>e.owner===1&&e.type==='town');town.hp=15;let soldier=__game.entities.find(e=>!e.owner&&e.type==='militia');soldier.hp=soldier.maxHp;soldier.x=town.x+2;soldier.y=town.y;__game.select([soldier.id]);__game.command(town,town);__game.step(5);});assert(await page.locator('#endModal').isVisible());assert.match(await page.locator('#endTitle').innerText(),/empire rises/);result('combat and victory');
 await page.screenshot({path:'tests/victory.png'});
 console.log('ALL TESTS PASSED');
}finally{await browser.close()}
