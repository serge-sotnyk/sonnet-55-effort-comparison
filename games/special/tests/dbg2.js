const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('arabia',2,5);const p=G.players[0];
for(const u of G.units)if(!u.dead&&u.def.animal)u.dead=true;
const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
const q=landNear(tc.cx+7,tc.cy,1);const deer=mkUnit('deer',-1,q.x,q.y);
const v=mine('villager')[0];
smartOrder(v,deer);let out=[];for(let i=0;i<40;i++){stepGame(1);out.push([v.t,v.gs,Math.round(Math.hypot(v.x-deer.x,v.y-deer.y)*10)/10,deer.hp,deer.dead,v.path?v.path.length:-1].join(','))}
out.join(' | ')
`;
console.log(vm.runInContext(code,c));
