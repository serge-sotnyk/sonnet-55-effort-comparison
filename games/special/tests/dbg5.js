const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('islands',2,12,{age:1});for(const p of G.players)p.res={f:1500,w:1500,g:1500,s:600};
G.players[0].ai=true;G.players[0].diff=2;G.players[1].diff=2;aiInit();
const log=[];
for(let t=0;t<1200;t+=100){run(100);const p=G.players[0];const S=aiSnap(p);log.push({t:G.time|0,age:p.age,army:S.army.length,trans:S.trans.length,war:S.war.length,inv:p.A.inv?p.A.inv.phase:null,wave:p.A.wave,docks:S.bc.dock||0,res:Object.values(p.res).map(Math.floor).join('/'),p1:G.units.filter(u=>!u.dead&&u.owner===1&&isMil(u)).length})}
JSON.stringify(log)
`;
console.log(vm.runInContext(code,c).replace(/\},\{/g,'},\n{'));
