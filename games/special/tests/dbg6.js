const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('islands',2,12,{age:1});for(const p of G.players)p.res={f:1500,w:1500,g:1500,s:600};
G.players[0].ai=true;G.players[0].diff=2;G.players[1].diff=2;aiInit();
run(500);
const p=G.players[0];const S=aiSnap(p);const cnt={};
for(const v of S.vils){const r=byId(v.tgt);const k=v.t+':'+(v.t==='gather'?(r?(r.kind==='b'?'farm':r.type):'none')+':'+v.gs:'');cnt[k]=(cnt[k]||0)+1}
const tc=S.tc;const reg=regionAt(tc.cx,tc.cy);
const trees=G.ress.filter(r=>!r.dead&&r.res==='w'&&regionAt(r.x,r.y)===reg).length;
const iv=S.idleVils[0];const dbg={pos:[iv.x,iv.y],reg:regionAt(iv.x,iv.y),tcreg:reg,pf:G.pfBudget,t:iv.t,pathFail:iv.pathFail,time:G.time};for(const k of ['w','f','g','s']){dbg[k]=aiAssign(p,S,iv,k);dbg[k+'t']=iv.t}
JSON.stringify({dbg,cnt,trees,bc:S.bc,res:p.res,queue:G.blds.filter(b=>b.owner===0&&b.queue.length).map(b=>b.type+':'+b.queue.map(q=>q.line||q.key).join('+')),pop:p.pop+'/'+p.popCap})
`;
console.log(vm.runInContext(code,c));
