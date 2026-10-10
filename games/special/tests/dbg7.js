const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('islands',2,12,{age:1});for(const p of G.players)p.res={f:1500,w:1500,g:1500,s:550};
G.players[0].ai=true;G.players[0].diff=2;G.players[1].diff=2;aiInit();
let out=[];
for(let i=0;i<9000;i++){stepGame(0.1);const p=G.players[0];if(p.A.inv&&!out.length){out.push('inv start at '+G.time.toFixed(0));for(let k=0;k<400;k++)stepGame(0.1);break}}
const p=G.players[0],inv=p.A.inv;
const S=aiSnap(p);let res={inv:inv&&inv.phase,out,army:S.army.length,trans:S.trans.length,A:{wave:p.A.wave,last:p.A.lastWave,attacking:p.A.attacking,first:p.A.d.first},bell:p.bell,res:p.res,landTargets:G.blds.filter(b=>!b.dead&&b.owner===1).length};
if(inv){const ships=inv.ships.map(byId).filter(Boolean);res.ships=ships.map(s=>[s.x|0,s.y|0,s.t,s.cargo.length]);res.troops=inv.troops.map(id=>{const u=G.byId.get(id);return u?[u.t,u.dead,u.inside,Math.round(u.x),Math.round(u.y),u.pathFail>G.time?'pf':'']:null});
const dk=byId(inv.dock);res.dock=[dk.cx,dk.cy];res.land=inv.land;res.age=G.time-inv.t0}
JSON.stringify(res)
`;
console.log(vm.runInContext(code,c));
