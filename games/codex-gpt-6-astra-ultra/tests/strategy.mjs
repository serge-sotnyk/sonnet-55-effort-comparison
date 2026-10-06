import assert from 'node:assert/strict';
import { Game } from '../engine.js';

const game = new Game();
const mine = (type) => game.buildings.find(b => b.owner === 'player' && b.type === type && b.built >= 1);
const soldiers = () => game.units.filter(u => u.owner === 'player' && u.type !== 'villager');
const villagers = () => game.units.filter(u => u.owner === 'player' && u.type === 'villager');
const queued = (type) => game.buildings.filter(b => b.owner === 'player').flatMap(b => b.queue).filter(q => q.type === type).length;
const place = (type) => {
  const points = [];
  for (let x=5; x<=23; x+=.5) for (let y=5; y<=23; y+=.5) points.push({x,y,d:Math.hypot(x-11,y-11)});
  points.sort((a,b)=>a.d-b.d);
  const p=points.find(p=>game.validPlacement(type,p.x,p.y));
  return p && game.build(type,p.x,p.y);
};
let attacked = false;
for (let second = 0; second < 1000 && !game.result; second++) {
  const tc=mine('towncenter'), barracks=mine('barracks');
  const unfinished=type=>game.buildings.some(b=>b.owner==='player'&&b.type===type&&b.built<1);
  if (second % 4 === 0) {
    const vs=villagers().filter(v=>v.action!=='build'&&v.action!=='attack');
    for(let i=0;i<vs.length;i++) {
      const resource = i % 10 < 4 ? 'berries' : i%10<7 ? 'tree' : 'gold';
      if(vs[i].resourceType===resource) continue;
      const target=game._nearestResource(vs[i],resource);
      if(target) {game.select([vs[i].id]);game.command(target.x,target.y,target.id);}
    }
    if(game.population + queued('villager') + queued('militia') + queued('archer') + queued('ram') >=game.populationCap-3 && !unfinished('house')) place('house');
    if(villagers().length+queued('villager')<22) game.train(tc?.id,'villager');
    if(game.age===0 && (villagers().length>=10 || second>90)) game.advanceAge();
    if(game.age===1 && soldiers().length>=9) game.advanceAge();
    if(game.age===2 && soldiers().length>=20) game.advanceAge();
    if(second>40&&!game.researched.has('wheelbarrow')) game.research('wheelbarrow');
    if(game.age>=1&&!mine('archery')&&!unfinished('archery')) place('archery');
    if(game.age>=2&&!mine('stable')&&!unfinished('stable')) place('stable');
    const troops=soldiers();
    const rams=troops.filter(u=>u.type==='ram').length;
    if(game.age>=2&&rams+queued('ram')<3) game.train(barracks?.id,'ram');
    else if(troops.filter(u=>u.type==='militia').length+queued('militia')<10) game.train(barracks?.id,'militia');
    if(troops.filter(u=>u.type==='archer').length+queued('archer')<8) game.train(mine('archery')?.id,'archer');
    if(game.age>=2&&troops.filter(u=>u.type==='knight').length+queued('knight')<7) game.train(mine('stable')?.id,'knight');
    if(game.age>=2&&troops.length>9) {game.research('forging');game.research('armor');game.research('fletching');}
    if(rams>=2 && troops.length>=19 && !attacked) {
      const enemy=game.buildings.find(b=>b.owner==='enemy'&&b.type==='towncenter');
      game.select(troops.map(u=>u.id));game.command(enemy.x,enemy.y,enemy.id);attacked=true;
      console.log('Attack ordered',second,troops.length);
    }
    if(attacked&&second%20===0){const enemy=game.buildings.find(b=>b.owner==='enemy'&&b.type==='towncenter');if(enemy){game.select(troops.map(u=>u.id));game.command(enemy.x,enemy.y,enemy.id);}}
  }
  game.update(1);
  if(second%60===59||game.result) console.log(JSON.stringify({time:Math.round(game.time),age:game.age,stock:Object.fromEntries(Object.entries(game.stock).map(([k,v])=>[k,Math.round(v)])),population:game.population,military:game.militaryCount,kills:game.kills,losses:game.losses,result:game.result}));
}
assert.equal(game.result,'victory','A resource-constrained economy and army should be able to defeat the AI');
console.log('PASS: Resource-constrained full match achieved victory.');
