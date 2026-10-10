const vm=require('vm'),fs=require('fs');const c=require('./load.js');
const code=fs.readFileSync(__dirname+'/simtests.js','utf8').split("TT('")[0]+`
world('arabia',2,8,{age:0,size:64});for(const p of G.players)p.res={f:200,w:200,g:100,s:200};
G.players[0].ai=true;G.players[1].diff=1;aiInit();
const out=[];
for(let t=0;t<600;t+=100){run(100);const p=G.players[1];const S=aiSnap(p);const cnt={};
for(const v of S.vils){const r=byId(v.tgt);const k=v.t==='gather'?(r?(r.kind==='b'?'farm':r.res+(r.type==='carcass'?'(meat)':'')):'none')+(v.gs==='drop'?'>':''):v.t;cnt[k]=(cnt[k]||0)+1}
out.push(G.time|0,'age',p.age,'pop',p.pop+'/'+p.popCap,'vils',S.vils.length,'army',S.army.length,Object.values(p.res).map(Math.floor).join('/'),JSON.stringify(cnt),Object.entries(S.bc).map(e=>e[0].slice(0,3)+e[1]).join(','))}
const p1=G.players[1];const S1=aiSnap(p1);const idl=S1.vils.filter(v=>v.t==='idle');const dbg=idl.slice(0,3).map(v=>{const tr=findResNear(v.x,v.y,e=>e.res==='w',60);const r=tr?findPath(v.x,v.y,(x,y)=>Math.hypot(x+.5-tr.x-.5,y+.5-tr.y-.5)<1.2,tr.x,tr.y,1,false,false,6000):null;return {pos:[v.x|0,v.y|0],tree:tr&&[tr.x,tr.y],ok:r&&r.ok,plen:r&&r.path.length,pf:v.pathFail>G.time,t:v.t,bell:v.bell,inside:v.inside,unreach:tr&&G.unreach&&G.unreach.get(tr.id)>G.time,cmdT:G.time-v.cmdT}});out.push('DBG '+JSON.stringify(dbg)+' unreachSize '+(G.unreach?G.unreach.size:0));
let asc='';const v0=idl[0];if(v0){for(let y=Math.max(0,(v0.y|0)-10);y<Math.min(G.H,(v0.y|0)+10);y++){let row='';for(let x=Math.max(0,(v0.x|0)-14);x<Math.min(G.W,(v0.x|0)+14);x++){const id=G.occ[y*G.W+x];const e=id?G.byId.get(id):null;let ch=G.terr[y*G.W+x]>=3?'~':'.';if(e&&!e.dead)ch=e.kind==='b'?e.type[0].toUpperCase():e.res==='w'?'t':e.type==='gold'?'g':e.type==='stone'?'s':'b';for(const u of S1.vils)if((u.x|0)===x&&(u.y|0)===y)ch='@';row+=ch}asc+=row+'\\n'}}
out.push('\\n'+asc);out.join(' ').replace(/ (\\d+) age/g,'\\n$1 age')
`;
console.log(vm.runInContext(code,c));
