const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const map=process.argv[2]||'coastal';
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('${map}',3,21,{age:1,size:80});for(const p of G.players){p.res={f:800,w:800,g:500,s:300};p.ai=true;p.diff=2}
aiInit();
// make p0 and p1 allied so trade is possible
setRel(0,1,'ally');
const log=[];
for(let t=0;t<1800;t+=300){run(300);log.push(G.time|0);}
const rep=G.players.map(p=>{const bs=G.blds.filter(b=>!b.dead&&b.owner===p.id);const cnt=t=>bs.filter(b=>b.type===t).length;return {n:p.name,age:p.age,pop:p.pop,vils:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.type==='villager').length,army:G.units.filter(u=>!u.dead&&u.owner===p.id&&isMil(u)&&!isShip(u)).length,monk:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.type==='monk').length,relics:bs.reduce((a,b)=>a+b.relics,0),relicGold:Math.round(p.stats.relicGold),conv:p.stats.conv,kills:p.stats.kills,docks:cnt('dock'),fish:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.type==='fishing').length,war:G.units.filter(u=>!u.dead&&u.owner===p.id&&isShip(u)&&u.def.atk>0).length,markets:cnt('market'),carts:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.def.k==='tradecart').length,traded:Math.round(p.stats.traded),castles:cnt('castle'),mon:cnt('monastery'),alive:p.alive}});
JSON.stringify({t:G.time|0,rep},null,0).replace(/\\},\\{/g,'},\\n{')
`;
console.log(vm.runInContext(code,c));
