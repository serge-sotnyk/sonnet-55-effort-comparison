// A complete skirmish driven only by ordinary game commands and earned resources.
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {BUILDINGS,dist} from '../src/data.js';
const g=new Game();let lastAssault=0;const log=[];g.onEvent=e=>{if(['age','end','attack'].includes(e.type))log.push([Math.round(g.time),e.text]);};
function place(type,at){const d=BUILDINGS[type];if(!g.canAfford(d.cost))return;const workers=g.own(0,'unit').filter(u=>u.type==='villager'&&u.order.type!=='build');const w=workers.sort((a,b)=>dist(a,at)-dist(b,at))[0];if(!w)return;const half=d.size%2?.5:0;for(let rad=0;rad<8;rad++)for(let dx=-rad;dx<=rad;dx++)for(let dy=-rad;dy<=rad;dy++){const x=Math.floor(at.x+dx)+half,y=Math.floor(at.y+dy)+half;if(g.canPlace(type,x,y))return g.place(type,x,y,[w.id]);}}
function bot(){const p=g.players[0],buildings=g.own(0,'building'),units=g.own(0,'unit'),tc=buildings.find(b=>b.type==='towncenter');if(!tc)return;const workers=units.filter(u=>u.type==='villager');
for(const w of workers.filter(u=>u.order.type==='idle')){const desired=workers.filter(u=>u.order.resource==='food').length<8?'food':workers.filter(u=>u.order.resource==='wood').length<5?'wood':workers.filter(u=>u.order.resource==='gold').length<5?'gold':'stone';const ts=g.entities.filter(e=>e.kind==='resource'&&e.resource===desired&&g.isVisible(e)&&e.amount>0).sort((a,b)=>dist(w,a)-dist(w,b));if(ts[0])g.commandGather(w,ts[0]);}
if(g.population()+g.reservedPop(0)>=g.capacity()-3&&!buildings.some(b=>b.type==='house'&&!b.complete))place('house',{x:13,y:25});
if(workers.length<22&&tc.queue.length<1)g.enqueue(tc.id,'unit','villager');
if(p.age<3&&workers.length>=14&&tc.queue.length<2&&p.resources.food>450)g.enqueue(tc.id,'age');
if(p.age>=1&&!buildings.some(b=>b.type==='range'))place('range',{x:18,y:23});
if(p.age>=1&&!buildings.some(b=>b.type==='stable'))place('stable',{x:20,y:20});
if(p.age>=1&&buildings.filter(b=>b.type==='tower').length<2)place('tower',{x:21,y:17});
if(p.age>=1&&!buildings.some(b=>b.type==='miningcamp'))place('miningcamp',{x:17,y:11});
if(p.age>=2&&!buildings.some(b=>b.type==='workshop'))place('workshop',{x:16,y:26});
const army=units.filter(u=>u.type!=='villager');for(const b of buildings.filter(b=>b.complete&&b.queue.length<2)){if(b.type==='barracks'&&(army.length<10||p.resources.food>800))g.enqueue(b.id,'unit','militia');if(b.type==='range')g.enqueue(b.id,'unit','archer');if(b.type==='stable'&&p.age>=2)g.enqueue(b.id,'unit','knight');if(b.type==='workshop'&&army.filter(u=>u.type==='ram').length<3)g.enqueue(b.id,'unit','ram');}
if(army.length>=22&&g.time-lastAssault>90){lastAssault=g.time;const target=g.own(1,'building').find(b=>b.type==='towncenter');g.command(army.map(u=>u.id),{x:target.x,y:target.y},'attackMove');}
}
for(let s=0;s<1500&&!g.ended;s++){if(s%3===0)bot();for(let i=0;i<20;i++)g.update(.05);if(s%120===0)console.log({time:s,age:g.players[0].age,enemyAge:g.players[1].age,pop:g.population(),res:g.players[0].resources,tc:g.own(0,'building').find(b=>b.type==='towncenter')?.hp});}
console.log({ended:g.ended,winner:g.winner,time:g.time,stats:g.stats,log});

assert.equal(g.ended,true,'the match reaches an ending');
assert.equal(g.winner,0,'a normal economy and combined army can defeat the standard rival');
assert.ok(g.players[1].age>=2,'the rival reaches the Castle Age');
assert.ok(g.stats.gathered>5000,'the victory is funded by gathered resources');
assert.ok(Object.values(g.players[0].resources).every(n=>n>=0),'no overspending');
console.log('✓ Full skirmish passed with earned resources, age advances, and a town-center victory.');
