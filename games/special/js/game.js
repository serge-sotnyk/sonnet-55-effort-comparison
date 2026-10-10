'use strict';
// ===== Core simulation =====
let G=null;
const RINFO={tree:{r:'w',amt:100},pine:{r:'w',amt:100},palm:{r:'w',amt:80},shrub:{r:'f',amt:60},berries:{r:'f',amt:200},gold:{r:'g',amt:800},stone:{r:'s',amt:500},fish:{r:'f',amt:250},relic:{r:'',amt:1},carcass:{r:'f',amt:100}};
const RATE={w:0.8,farm:0.6,berries:1.0,shrub:0.9,hunt:1.4,gold:0.85,stone:0.85,fish:1.1,carcass:1.4};
const UAGE={spearman:1,skirm:1,scout:1,knight:2,cavarcher:2,fireship:1,demoraft:2,tradecog:2,tradecart:1,mangonel:2,scorpion:2,ram:2,trebuchet:2,monk:2,galley:1,fishing:1,transport:1};
const LINE_AGE={uu:2,treb:2,mang:2,scorp:2,ram:2,monk:2,cavarcher:2,knight:2,demo:2,tradecog:2,spear:1,skirm:1,scout:1,tradecart:1,fire:1,galley:1,fishing:1,transport:1};
const GUARD_R=5,CAPT_R=3.5;
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const hyp=Math.hypot;

function newPlayerState(i,name,civ,color,ai,team){
  return{id:i,name,civ,civd:CIVS[civ],color,ai:!!ai,team,res:{f:0,w:0,g:0,s:0},age:0,pop:0,popCap:0,techs:new Set(),lv:{},mods:{},gm:{wood:1,farm:1,berries:1,hunt:1,gold:1,stone:1,fish:1,sheep:1},
    f:{carry:0,buildSpd:0,tradeSpd:0,fee:0,heal:1,convRng:0,convCd:1,redeem:0,atone:0,tcap:0,train:{},minr0:0},bell:false,bellT:0,prices:{f:100,w:100,s:100},
    stats:{kills:0,losses:0,gathered:0,built:0,conv:0,traded:0,relicGold:0},alive:true,vis:null,exp:null,attitude:{},lastHit:{},relics:0};
}
function modAdd(p,cls,stat,v){(p.mods[cls]=p.mods[cls]||{});p.mods[cls][stat]=(p.mods[cls][stat]||0)+v}
function applyCivBonus(p){
  const c=p.civ;
  if(c==='britons'){p.gm.sheep+=.25}
  if(c==='franks'){modAdd(p,'cav','hpMul',.2);p.gm.farm+=.15}
  if(c==='goths'){p.gm.hunt+=.25;p.costMul={inf:.75}}
  if(c==='byzantines'){modAdd(p,'bld','hpMul',.15);modAdd(p,'fire','atk',1);p.f.heal=1.3}
  if(c==='japanese'){p.gm.fish+=.2;modAdd(p,'inf','rof',-.2);p.costMul={fishing:.85}}
  if(c==='mongols'){p.gm.hunt+=.4;modAdd(p,'cavarc','rof',-.2);modAdd(p,'scout','los',2);modAdd(p,'scout','hpMul',.2)}
  if(c==='vikings'){modAdd(p,'inf','hpMul',.2);p.costMul={warship:.85};p.shipTrain=.85}
  if(c==='saracens'){p.f.fee=-.25;p.f.tradeMul=1.2;modAdd(p,'arc','atkBld',2)}
  if(c==='teutons'){p.f.garBonus=5;p.f.convRes=.5}
  if(c==='chinese'){p.techMul=.9;p.gm.farm+=.1}
}
function curUnit(p,line){if(line==='uu')return p.civd.uu;return LINES[line][p.lv[line]||0]}
function lineAge(line){return LINE_AGE[line]||0}
function unitCost(p,type){
  const d=U[type],c={f:0,w:0,g:0,s:0};let m=1;
  if(p.costMul){if(d.cls.includes('inf')&&p.costMul.inf)m=p.costMul.inf;if(p.costMul[type])m=p.costMul[type];if(d.cls.includes('warship')&&p.costMul.warship)m=p.costMul.warship}
  for(const k of RK)c[k]=Math.round((d.cost[k]||0)*m);return c;
}
function techCost(p,k){const t=techDef(p,k),c={f:0,w:0,g:0,s:0};for(const r of RK)c[r]=Math.round((t.cost[r]||0)*(p.techMul||1));return c}
function techDef(p,k){
  const t=T[k];if(!t)return null;
  if(k==='uniq'||k==='uniq2'){const u=UTECH[k==='uniq'?p.civd.ut:p.civd.eut];return Object.assign({},t,{n:u.n,d:(k==='uniq'?'Castle Age ':'Imperial Age ')+'unique tech: '+(p.civd.tech||''),m:u.m||[],uniq:u,k})}
  if(k==='euniq'){return Object.assign({},t,{n:'Elite '+U[p.civd.uu].n,d:'Elite upgrade of your '+U[p.civd.uu].n+': +15 HP, +2 attack, +1/+1 armor.'})}
  return t;
}
function hAt(x,y){const tx=clamp(Math.floor(x),0,G.W-1),ty=clamp(Math.floor(y),0,G.H-1);return G.hgt[ty*G.W+tx]}
function tIdx(x,y){return clamp(Math.floor(y),0,G.H-1)*G.W+clamp(Math.floor(x),0,G.W-1)}
function relOf(a,b){if(a===b)return'self';if(a<0||b<0)return'gaia';return G.dip[a][b]}
function isEnemy(a,b){return a>=0&&b>=0&&a!==b&&G.dip[a][b]==='enemy'}
function isFriend(a,b){return a===b||(a>=0&&b>=0&&G.dip[a][b]==='ally')}
function human(){return G.players[0]}
function msg(text,kind,x,y){if(G.onMsg)G.onMsg(text,kind||'info',x,y)}
function notify(p,text,kind,x,y){if(p&&p.id===0)msg(text,kind,x,y)}
function fx(type,x,y,o){if(G.noFx)return;const z=hAt(x,y);G.fx.push(Object.assign({type,x,y,z,t:0,life:1},o||{}))}
function sfxAt(name,x,y,opts){if(G.onSfx)G.onSfx(name,x,y,opts)}

// ---------- world creation ----------
function newGame(settings,md){
  const W=md.w,H=md.h;
  G={W,H,terr:new Uint8Array(md.terr),hgt:new Uint8Array(md.hgt),occ:new Int32Array(W*H),ents:[],units:[],blds:[],ress:[],byId:new Map(),nid:0,players:[],dip:[],time:0,speed:settings.speed||1.5,paused:false,
    settings,md,fx:[],proj:[],grid:null,cheats:{allowed:!!settings.cheats,aegis:false,polo:false,marco:false},over:null,selectedTip:0,tickN:0,pfBudget:0,
    treeStump:[],stats:{},lastCombat:-99,region:null,ghost:null,decals:[]};
  // players
  const np=settings.players.length;
  for(let i=0;i<np;i++){const s=settings.players[i];const p=newPlayerState(i,s.name,s.civ,s.color,s.ai,s.team);p.diff=s.diff||1;G.players.push(p);p.res={f:settings.res.f,w:settings.res.w,g:settings.res.g,s:settings.res.s};
    p.age=settings.startAge||0;applyCivBonus(p)}
  for(let i=0;i<np;i++){G.dip.push([]);for(let j=0;j<np;j++)G.dip[i][j]=i===j?'self':(G.players[i].team===G.players[j].team?'ally':'enemy')}
  // objects
  const starts=md.starts.slice();
  const tcOf=new Map();
  for(const o of md.objs){
    if(o.k==='res')mkRes(o.t,Math.round(o.x),Math.round(o.y));
    else if(o.k==='animal'){mkUnit(o.t,-1,o.x+.5,o.y+.5)}
    else if(o.k==='bld'){if(o.o<np){const b=mkBld(o.t,o.o,o.x,o.y,true);if(b&&o.t==='towncenter')tcOf.set(o.o,b)}}
    else if(o.k==='unit'){if(o.o<np||o.o<0)mkUnit(o.t,o.o,o.x+.5,o.y+.5)}
  }
  // starts
  for(let i=0;i<np;i++){
    let s=starts[i];
    let tc=tcOf.get(i);
    if(!tc){if(!s)s={x:Math.floor(W/2),y:Math.floor(H/2)};
      clearArea(s.x-3,s.y-3,7,7);tc=mkBld('towncenter',i,s.x-2,s.y-2,true);}
    const p=G.players[i];p.start={x:tc.x+2,y:tc.y+2};
    const hasUnits=G.units.some(u=>u.owner===i&&!u.dead);
    if(!hasUnits){
      const nv=4+(p.civ==='chinese'?2:0);
      for(let k=0;k<nv;k++){const q=freeNear(tc.x+2,tc.y+2,3,6);if(q)mkUnit('villager',i,q.x,q.y)}
      const q=freeNear(tc.x+2,tc.y+2,3,7);if(q)mkUnit(settings.startAge>=1?'scout':'scout',i,q.x,q.y);
    }
    // starting age buildings/tech flavour
    if(p.age>=1)for(const k of ['loom'])applyTech(p,k,true);
  }
  recomputeAll();
  initVision();
  computeRegions();
  G.fx=[];
  if(settings.visibility==='explored'||settings.visibility==='all'){G.players[0].exp.fill(1)}
  G.cheats.polo=settings.visibility==='all';
  updateVision(true);
  return G;
}
function clearArea(x0,y0,w,h){for(const r of G.ress.slice())if(!r.dead&&r.type!=='fish'&&r.x>=x0&&r.y>=y0&&r.x<x0+w&&r.y<y0+h)killRes(r)}
function recomputeAll(){for(const p of G.players)recalcPlayer(p)}
function recalcPlayer(p){
  let cap=0,pop=0;
  for(const b of G.blds)if(!b.dead&&b.owner===p.id&&b.built)cap+=b.def.pop||0;
  for(const u of G.units)if(!u.dead&&u.owner===p.id&&!u.def.animal)pop++;
  p.popCap=Math.min(200,cap);p.pop=pop;
}
function freeNear(cx,cy,r0,r1,ship){
  for(let r=r0;r<=r1+4;r++){
    const n=r*8;for(let k=0;k<n;k++){const a=k/n*6.283+Math.random()*.2,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;const tx=Math.floor(x),ty=Math.floor(y);
      if(tx<0||ty<0||tx>=G.W||ty>=G.H)continue;const ok=ship?G.terr[ty*G.W+tx]>=3:(G.terr[ty*G.W+tx]<3&&!G.occ[ty*G.W+tx]);if(ok&&(ship||Math.abs(G.hgt[ty*G.W+tx]-G.hgt[clamp(Math.floor(cy),0,G.H-1)*G.W+clamp(Math.floor(cx),0,G.W-1)])<2))return{x:tx+.5,y:ty+.5}}
  }
  return null;
}
function mkRes(type,x,y){
  const inf=RINFO[type];if(!inf)return null;
  const e={id:++G.nid,kind:'r',type,res:inf.r,x,y,amt:inf.amt,max:inf.amt,owner:-1,dead:false,sz:1,v:(x*7+y*13)%4,gatherers:0,shake:0};
  if(type==='tree'||type==='pine'||type==='palm')e.amt=e.max=type==='palm'?80:100;
  G.ents.push(e);G.ress.push(e);G.byId.set(e.id,e);
  if(type!=='fish'&&type!=='relic'&&type!=='carcass'&&type!=='fish')G.occ[y*G.W+x]=e.id;
  return e;
}
function killRes(r){if(r.dead)return;r.dead=true;if(G.occ[r.y*G.W+r.x]===r.id)G.occ[r.y*G.W+r.x]=0;if(r.type==='tree'||r.type==='pine'||r.type==='palm')G.decals.push({type:'stump',x:r.x,y:r.y,v:r.v})}
function mkUnit(type,owner,x,y){
  const d=U[type];if(!d)return null;
  const e={id:++G.nid,kind:'u',type,def:d,owner,x,y,z:hAt(x,y),hp:d.hp,mh:d.hp,t:'idle',tgt:0,tx:0,ty:0,path:null,pi:0,cd:0,at:0,fx:1,fy:1,carry:null,ca:0,anim:Math.random()*10,inside:0,dead:false,rp:0,gs:'',lock:0,wt:0,wander:0,home:{x,y},sel:false,cargo:null,hateT:0,flee:0,acq:Math.random()*0.5,stance:'aggr',bornT:G.time};
  if(d.cap)e.carryCap=d.cap;
  if(owner>=0){const p=G.players[owner];e.mh=maxHp(e);e.hp=e.mh;if(!d.animal)p.pop++}
  if(d.tcap)e.cargo=[];
  G.ents.push(e);G.units.push(e);G.byId.set(e.id,e);
  return e;
}
function maxHp(e){
  const d=e.def,p=e.owner>=0?G.players[e.owner]:null;let v=d.hp,mul=0;
  if(p){const cl=e.kind==='b'?['bld',e.type].concat(d.wall?['wall']:[]):d.cls;for(const c of cl){const m=p.mods[c];if(m){v+=m.hp||0;mul+=m.hpMul||0}}}
  return Math.round(v*(1+mul));
}
function refreshHp(p){for(const e of G.ents){if(e.dead||e.owner!==p.id||(e.kind!=='u'&&e.kind!=='b'))continue;const m=maxHp(e);if(m!==e.mh){e.hp=clamp(e.hp+(m-e.mh),1,m);e.mh=m}}}
function sget(e,stat){
  const d=e.def,p=e.owner>=0?G.players[e.owner]:null;let v=d[stat]||0;if(!p)return v;
  const cl=e.kind==='b'?['bld',e.type].concat(d.wall?['wall']:[]):d.cls;
  for(const c of cl){const m=p.mods[c];if(m&&m[stat])v+=m[stat]}
  if(stat==='spd'||stat==='rof'){let a=0;for(const c of cl){const m=p.mods[c];if(m&&m[stat])a+=m[stat]}v=(d[stat]||0)*(1+a)}
  if(stat==='los'&&e.kind==='b'){}
  return v;
}
function bcls(e){return e.kind==='b'?['bld',e.type].concat(e.def.wall?['wall']:[]):e.def?e.def.cls:[]}
// ---------- buildings ----------
function mkBld(type,owner,x,y,built){
  const d=B[type];if(!d)return null;
  const e={id:++G.nid,kind:'b',type,def:d,owner,x,y,sz:d.sz,cx:x+d.sz/2,cy:y+d.sz/2,hp:0,mh:0,built:!!built,prog:built?1:0.0,queue:[],gar:[],rally:null,dead:false,bn:0,bnPrev:0,cd:0,relics:0,farm:d.farm?{amt:300,max:300,gatherer:0}:null,ageSeen:0,flash:0,fireCd:0,rubble:0,hit:0,tradeProg:0};
  e.mh=maxHp(e);e.hp=built?e.mh:Math.max(1,Math.round(e.mh*0.1));
  G.ents.push(e);G.blds.push(e);G.byId.set(e.id,e);
  for(let j=0;j<d.sz;j++)for(let i=0;i<d.sz;i++){const tx=x+i,ty=y+j;if(tx>=0&&ty>=0&&tx<G.W&&ty<G.H)G.occ[ty*G.W+tx]=e.id}
  // push own/other land units out of the footprint so nobody is entombed
  if(!G._edit&&!d.dock)for(const u of G.units){if(u.dead||u.inside||u.def.cls.includes('ship'))continue;if(u.x>=x&&u.x<x+d.sz&&u.y>=y&&u.y<y+d.sz){const q=exitPoint(e,false)||freeNear(e.cx,e.cy,d.sz/2,d.sz/2+4);if(q){u.x=q.x;u.y=q.y;u.path=null;if(u.t==='move'||u.t==='idle'){}}}}
  // clear resources/ units overlap
  if(!G._edit)for(const r of G.ress)if(!r.dead&&r.type!=='fish'&&r.type!=='relic'&&r.type!=='carcass'&&r.x>=x&&r.x<x+d.sz&&r.y>=y&&r.y<y+d.sz&&r.id!==G.occ[r.y*G.W+r.x]){r.dead=true}
  if(built&&owner>=0){recalcPlayer(G.players[owner])}
  return e;
}
function footprintOK(type,x,y,owner,ignoreFog){
  const d=B[type];let anyWaterAdj=false;
  const h0=G.hgt[clamp(y+(d.sz>>1),0,G.H-1)*G.W+clamp(x+(d.sz>>1),0,G.W-1)];
  for(let j=-(d.dock?2:0);j<d.sz+(d.dock?2:0);j++)for(let i=-(d.dock?2:0);i<d.sz+(d.dock?2:0);i++){
    const tx=x+i,ty=y+j,inside=i>=0&&j>=0&&i<d.sz&&j<d.sz;
    if(tx<0||ty<0||tx>=G.W||ty>=G.H){if(inside)return'Out of map';continue}
    const k=ty*G.W+tx,t=G.terr[k];
    if(inside){
      if(t>=3)return d.dock?'Dock must be on the shoreline':'Cannot build on water';
      if(G.occ[k]){const o=G.byId.get(G.occ[k]);if(o&&!o.dead)return'Something is in the way'}
      if(Math.abs(G.hgt[k]-h0)>1)return'Ground is too steep / uneven';
      if(d.dock&&t!==T_SAND&&t!==T_GRASS&&t!==T_DIRT)return'Invalid';
      for(const r of G.ress)if(!r.dead&&r.x===tx&&r.y===ty&&(r.type==='relic'))return'Relic in the way';
    }else if(d.dock&&t>=3)anyWaterAdj=true;
  }
  if(d.dock){
    // dock needs water adjacent on at least one full side and a ship exit tile
    let adj=0;for(let i=-1;i<=d.sz;i++)for(let j=-1;j<=d.sz;j++){if(i>=0&&j>=0&&i<d.sz&&j<d.sz)continue;const tx=x+i,ty=y+j;if(tx>=0&&ty>=0&&tx<G.W&&ty<G.H&&G.terr[ty*G.W+tx]>=3)adj++}
    if(adj<3)return'Docks must touch deep enough water (build at the shoreline)';
  }
  // units in the way
  if(!G._ignoreUnits)for(const u of G.units)if(!u.dead&&!u.inside&&!u.def.cls.includes('ship')&&u.x>=x&&u.x<x+d.sz&&u.y>=y&&u.y<y+d.sz&&(u.def.animal||u.owner!==owner))return'Units in the way';
  return'';
}
// ---------- grid ----------
function buildGrid(){
  const cs=2,gw=Math.ceil(G.W/cs)+1;
  if(!G.grid||G.grid.gw!==gw){G.grid={cs,gw,cells:new Array(gw*gw)}}
  const cells=G.grid.cells;for(let i=0;i<cells.length;i++)cells[i]=null;
  const put=(e,x,y)=>{const i=Math.floor(y/cs)*gw+Math.floor(x/cs);(cells[i]||(cells[i]=[])).push(e)};
  for(const u of G.units)if(!u.dead&&!u.inside)put(u,clamp(u.x,0,G.W-.01),clamp(u.y,0,G.H-.01));
  for(const b of G.blds)if(!b.dead)put(b,b.cx,b.cy);
}
function near(x,y,r,fn,bigPad){
  const g=G.grid,cs=g.cs,pad=bigPad||0,rr=r+pad;
  const x0=Math.max(0,Math.floor((x-rr)/cs)),x1=Math.min(g.gw-1,Math.floor((x+rr)/cs)),y0=Math.max(0,Math.floor((y-rr)/cs)),y1=Math.min(g.gw-1,Math.floor((y+rr)/cs));
  for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){const c=g.cells[cy*g.gw+cx];if(c)for(let i=0;i<c.length;i++){const e=c[i];if(e.dead||e.inside)continue;if(fn(e)===true)return}}
}
function rectDist(px,py,e){
  if(e.kind==='u'||e.kind==='p')return hyp(px-e.x,py-e.y);
  const sz=e.sz||1;const dx=Math.max(e.x-px,0,px-(e.x+sz)),dy=Math.max(e.y-py,0,py-(e.y+sz));return hyp(dx,dy);
}
function dist2e(a,b){ // distance between entity a (unit) and b
  return rectDist(a.x,a.y,b);
}
// ---------- pathfinding ----------
const PF={n:0,g:null,st:null,from:null,cl:null,stamp:0,heap:[],hf:null};
function pfInit(){const n=G.W*G.H;if(PF.n!==n){PF.n=n;PF.g=new Float32Array(n);PF.st=new Int32Array(n);PF.from=new Int32Array(n);PF.cl=new Int32Array(n);PF.hf=new Float32Array(n);PF.stamp=0}}
function tilePass(tx,ty,pl,ship,breach){
  if(tx<0||ty<0||tx>=G.W||ty>=G.H)return 0;
  const i=ty*G.W+tx,t=G.terr[i];
  if(ship)return t>=3?1:0;
  if(t>=3)return 0;
  const id=G.occ[i];if(!id)return 1;
  const e=G.byId.get(id);if(!e||e.dead)return 1;
  if(e.kind==='b'){if(e.def.farm)return 1;if(e.def.gate&&e.built&&isFriend(pl,e.owner))return 1;if(e.def.wall&&breach&&isEnemy(pl,e.owner))return 2}
  return 0;
}
function heapPush(h,f,i){h.push(f,i);let k=h.length/2-1;while(k>0){const p=(k-1)>>1;if(h[p*2]<=h[k*2])break;const tf=h[p*2],ti=h[p*2+1];h[p*2]=h[k*2];h[p*2+1]=h[k*2+1];h[k*2]=tf;h[k*2+1]=ti;k=p}}
function heapPop(h){const f=h[0],i=h[1],li=h.pop(),lf=h.pop();if(h.length){h[0]=lf;h[1]=li;let k=0;const n=h.length/2;for(;;){let c=k*2+1;if(c>=n)break;if(c+1<n&&h[(c+1)*2]<h[c*2])c++;if(h[c*2]>=h[k*2])break;const tf=h[c*2],ti=h[c*2+1];h[c*2]=h[k*2];h[c*2+1]=h[k*2+1];h[k*2]=tf;h[k*2+1]=ti;k=c}}return i}
// returns {path:[[x,y]..], ok}
function findPath(sx,sy,goalFn,hx,hy,pl,ship,breach,maxN){
  pfInit();const W=G.W,Hh=G.H;PF.stamp++;const st=PF.stamp,g=PF.g,S=PF.st,from=PF.from,cl=PF.cl,heap=PF.heap;heap.length=0;
  const s0x=clamp(Math.floor(sx),0,W-1),s0y=clamp(Math.floor(sy),0,Hh-1),si=s0y*W+s0x;
  S[si]=st;g[si]=0;from[si]=-1;heapPush(heap,0,si);
  let best=si,bestH=1e9,n=0,found=-1;maxN=maxN||6000;
  const hgt=G.hgt;
  while(heap.length&&n<maxN){
    const cur=heapPop(heap);if(cl[cur]===st)continue;cl[cur]=st;n++;
    const cx=cur%W,cy=(cur/W)|0;
    if(goalFn(cx,cy)){found=cur;break}
    const hh=Math.abs(cx+.5-hx)+Math.abs(cy+.5-hy);if(hh<bestH){bestH=hh;best=cur}
    for(let d=0;d<8;d++){
      const dx=DX8[d],dy=DY8[d],nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=W||ny>=Hh)continue;
      const ni=ny*W+nx;if(cl[ni]===st)continue;
      const pass=tilePass(nx,ny,pl,ship,breach);if(!pass)continue;
      if(!ship&&Math.abs(hgt[ni]-hgt[cur])>=2)continue;
      if(dx&&dy){const p1=tilePass(cx+dx,cy,pl,ship,breach),p2=tilePass(cx,cy+dy,pl,ship,breach);if(!p1||!p2)continue;if(!ship&&(Math.abs(hgt[cy*W+cx+dx]-hgt[cur])>=2||Math.abs(hgt[(cy+dy)*W+cx]-hgt[cur])>=2))continue}
      let c=g[cur]+(dx&&dy?1.414:1)+(pass===2?30:0);
      if(!ship&&hgt[ni]>hgt[cur])c+=0.3;
      if(S[ni]!==st||c<g[ni]){S[ni]=st;g[ni]=c;from[ni]=cur;heapPush(heap,c+(Math.abs(nx+.5-hx)+Math.abs(ny+.5-hy))*1.0,ni)}
    }
  }
  const ok=found>=0;let end=ok?found:best;const path=[];
  for(let c=end;c!==-1&&c!==si;c=from[c])path.push([c%W+.5,((c/W)|0)+.5]);
  path.reverse();
  return{path,ok,partial:!ok};
}
const DX8=[1,-1,0,0,1,1,-1,-1],DY8=[0,0,1,-1,1,-1,1,-1];
// give a path toward a point or entity
function sameRegion(u,hx,hy){
  const ship=u.def.cls.includes('ship');const tx=clamp(Math.floor(hx),0,G.W-1),ty=clamp(Math.floor(hy),0,G.H-1);
  if(ship){return true}
  const a=G.region[tIdx(u.x,u.y)],b=G.region[ty*G.W+tx];
  if(!a||!b)return true; // unknown / water target: let A* decide
  return a===b;
}
function pathTo(u,goalFn,hx,hy,maxN){
  const ship=u.def.cls.includes('ship');
  if(!maxN){const d=Math.abs(hx-u.x)+Math.abs(hy-u.y);maxN=Math.min(6000,900+d*45)}
  const breach=!ship&&u.def.atk>0&&!u.def.animal&&u.owner>=0;
  G.pfBudget--;
  const r=findPath(u.x,u.y,goalFn,hx,hy,u.owner,ship,breach,maxN);
  u.path=r.path;u.pi=0;u.pathOk=r.ok;u.rp=0.7+Math.random()*0.5;u.pgx=hx;u.pgy=hy;
  return r;
}
function moveToPoint(u,x,y){
  const tx=Math.floor(x),ty=Math.floor(y);
  u.mx=x;u.my=y;
  const r=pathTo(u,(cx,cy)=>cx===tx&&cy===ty,x,y);
  return r;
}
// advance along path; returns true when finished
function stepPath(u,dt,speedMul){
  if(!u.path||u.pi>=u.path.length)return true;
  let spd=sget(u,'spd')*(speedMul||1);
  if(u.relicCarry)spd*=0.75;
  const tz=hAt(u.x,u.y);
  let rem=spd*dt;
  while(rem>0&&u.pi<u.path.length){
    const w=u.path[u.pi];
    // block check (new building/ tree appeared)
    const wx=Math.floor(w[0]),wy=Math.floor(w[1]);
    const pass=tilePass(wx,wy,u.owner,u.def.cls.includes('ship'),!u.def.cls.includes('ship')&&u.def.atk>0&&u.owner>=0);
    if(!pass){u.path=null;u.needRepath=true;return false}
    if(pass===2){const o=G.byId.get(G.occ[wy*G.W+wx]);if(o&&o.kind==='b'){u.breach=o.id;u.path=null;return false}}
    const dx=w[0]-u.x,dy=w[1]-u.y,d=hyp(dx,dy);
    if(d>0.001){u.fx=dx/d;u.fy=dy/d}
    const slow=hAt(w[0],w[1])>tz?0.9:1;
    if(d<=rem*slow+0.001){u.x=w[0];u.y=w[1];rem-=d/slow;u.pi++}
    else{u.x+=dx/d*rem*slow;u.y+=dy/d*rem*slow;rem=0}
  }
  u.moving=true;
  return u.pi>=u.path.length;
}

// ---------- orders ----------
function setCmd(u,t,tgt,x,y){u.t=t;u.tgt=tgt?(tgt.id||tgt):0;u.tx=x||0;u.ty=y||0;u.path=null;u.gs='';u.cmdT=G.time;u.breach=0;u.moving=false;u.cast=0;u.fleeing=false;u.reseed=0;if(u.bell&&t!=='garrison'){}}
function byId(id){const e=G.byId.get(id);return e&&!e.dead?e:null}
function isShip(u){return u.def.cls.includes('ship')}
function orderMove(u,x,y,keepBell){
  if(!keepBell)u.bell=false;
  if(isShip(u)&&u.cargo&&u.cargo.length){const tx=Math.floor(x),ty=Math.floor(y);if(tx>=0&&ty>=0&&tx<G.W&&ty<G.H&&G.terr[ty*G.W+tx]<3){setCmd(u,'unloadat',0,x,y);return}}
  setCmd(u,'move',0,x,y);u.mx=x;u.my=y;
}
function orderAttack(u,e){if(!canAttack(u,e,true))return false;u.bell=false;setCmd(u,'attack',e);return true}
function orderAttackMove(u,x,y){setCmd(u,'amove',0,x,y)}
function orderGather(u,r){u.bell=false;setCmd(u,'gather',r);u.gs='go';u.gt=r.type;u.gres=r.res||(r.farm?'f':'');u.lastRes={x:r.x,y:r.y,type:r.type}}
function orderBuild(u,b){u.bell=false;setCmd(u,'build',b)}
function orderRepair(u,e){u.bell=false;setCmd(u,'repair',e)}
function orderGarrison(u,b,bell){setCmd(u,'garrison',b);u.bell=!!bell}
function orderStop(u){u.bell=false;setCmd(u,'idle')}
function isMil(u){return u.def.atk>0&&u.def.k!=='villager'}
function canAttack(u,e,explicit){
  if(!u||!e||e.dead||e.inside||u.def.atk<=0&&!u.def.boom&&u.type!=='cobra')return false;
  if(e.kind==='r')return false;
  if(u.def.animal)return e.kind==='u'&&!e.def.animal&&e.owner>=0&&!e.def.cls.includes('ship');
  if(e.kind==='u'&&e.def.animal){if(explicit)return true;return e.owner<0&&(e.def.cls.includes('dangerous')||e.def.cls.includes('predator'))}
  if(e.owner===u.owner||!isEnemy(u.owner,e.owner))return false;
  if(e.kind==='u'&&e.def.cls.includes('ship')&&!(u.def.rng>0)&&!u.def.boom)return false;
  if(u.def.k==='ram'&&e.kind==='u'&&!e.def.cls.includes('siege')&&false)return false;
  if(u.def.cls.includes('ship')&&!u.def.rng&&!u.def.boom)return false;
  if(u.def.boom&&!(e.kind==='b'||e.def.cls.includes('ship')))return false;
  if(u.def.k==='villager'&&e.kind==='b'&&!explicit)return false;
  return true;
}
function rangeOf(u,e){
  let r=sget(u,'rng');if(!r)return 0.9;
  const ah=u.kind==='b'?hAt(u.cx,u.cy):hAt(u.x,u.y),th=e.kind==='b'?hAt(e.cx,e.cy):hAt(e.x,e.y);
  if(ah>th&&!isShip(u))r+=1;else if(th-ah>=2&&!isShip(u))r-=1;
  return r;
}
function elevMul(a,t){const ah=a.kind==='b'?hAt(a.cx,a.cy):hAt(a.x,a.y),th=t.kind==='b'?hAt(t.cx,t.cy):hAt(t.x,t.y);if(isShip(a)||isShip(t))return 1;return ah>th?1.25:ah<th?0.75:1}
function calcDamage(a,t,baseAtk){
  const ad=a.def;let atk=baseAtk!==undefined?baseAtk:sget(a,'atk');
  const tc=bcls(t);
  for(const c of tc){if(ad.bon&&ad.bon[c])atk+=ad.bon[c]}
  if(a.owner>=0){const pm=G.players[a.owner].mods;if(pm.bld&&a.kind==='b'&&t.def.cls&&t.def.cls.includes('ship')&&pm.bld.atkShip)atk+=pm.bld.atkShip;
    if(t.kind==='b'&&pm.arc&&pm.arc.atkBld&&ad.cls&&ad.cls.includes('arc'))atk+=pm.arc.atkBld;
    if(a.owner>=0&&G.players[a.owner].chief&&ad.cls&&ad.cls.includes('inf')&&tc.includes('cav'))atk+=3}
  atk*=elevMul(a,t);
  const ranged=ad.rng>0||a.kind==='b';
  let arm=ad.ign?0:(ranged?sget(t,'pa'):sget(t,'ma'));
  if(t.kind==='b'&&ranged&&ad.cls&&ad.cls.includes('ship'))arm=Math.max(0,arm-6);
  return Math.max(1,atk-arm)*(a.kind==='u'&&a.dmgMul?a.dmgMul:1);
}
function applyDamage(a,t,dmg,fromProj){
  if(t.dead)return;
  t.hp-=dmg;t.hit=0.25;
  if(t.owner===0&&a&&a.owner!==0&&a.owner>=0&&G.time-(G._atkMsg||-99)>12){G._atkMsg=G.time;msg('You are under attack!','warn',t.kind==='b'?t.cx:t.x,t.kind==='b'?t.cy:t.y);sfxAt('alert',t.kind==='b'?t.cx:t.x,t.kind==='b'?t.cy:t.y,{vol:.8,always:true})}
  if(t.kind==='b'){t.flash=0.2}
  G.lastCombat=G.time;
  if(a&&a.owner>=0&&t.owner>=0){const pl=G.players[t.owner];pl.lastHit[a.owner]=G.time;if(pl.ai){pl.attitude[a.owner]=Math.max(-30,(pl.attitude[a.owner]||0)-0.05*Math.min(dmg,10))}}
  if(t.kind==='u'){
    // retaliation
    if(a&&!a.dead&&(t.t==='idle'||t.t==='amove'&&!t.tgt)&&t.def.atk>0&&t.def.k!=='villager'&&t.stance!=='none'&&canAttack(t,a))setCmd(t,'attack',a);
    if(t.def.cls.includes('prey')){t.flee=4;if(a){t.fdx=t.x-a.x;t.fdy=t.y-a.y}}
    if(t.def.cls.includes('dangerous')&&a)t.hateT=8,t.hate=a.id,setCmd(t,'attack',a);
    if(t.def.cls.includes('predator')&&a)t.hate=a.id;
    if(t.def.k==='villager'&&a&&!a.def?.animal&&t.t==='idle'&&false){}
    if(t.def.k==='villager'&&a&&a.kind==='u'&&a.def.animal&&t.t==='gather'&&t.gs!=='kill'){/* gatherer attacked by wolf: fight back */ if(a.def.cls.includes('predator')||a.def.cls.includes('dangerous')){t.prevCmd={t:t.t,tgt:t.tgt,gs:t.gs};setCmd(t,'attack',a);t.hunting=true}}
  }
  if(t.hp<=0)killEnt(t,a);
}
function killEnt(e,by){
  if(e.dead)return;e.dead=true;e.hp=0;
  if(by&&by.owner>=0&&e.owner>=0&&by.owner!==e.owner)G.players[by.owner].stats.kills++;
  if(e.owner>=0)G.players[e.owner].stats.losses++;
  if(e.kind==='u'){
    e.deadT=0;
    if(e.relicCarry){const r=mkRes('relic',Math.floor(e.x),Math.floor(e.y));e.relicCarry=false}
    if(e.cargo&&e.cargo.length){for(const id of e.cargo){const c=G.byId.get(id);if(c){c.dead=true;c.inside=0}}e.cargo=[]}
    if(e.owner>=0&&!e.def.animal)G.players[e.owner].pop=Math.max(0,G.players[e.owner].pop-1);
    if(e.def.animal&&e.def.food&&e.owner!==-2){const tx=clamp(Math.floor(e.x),0,G.W-1),ty=clamp(Math.floor(e.y),0,G.H-1);if(G.terr[ty*G.W+tx]<3){const r=mkRes('carcass',tx,ty);if(r){r.amt=r.max=e.def.food;r.rot=0;r.fromType=e.type;r.fx=e.x;r.fy=e.y}}}
    if(e.def.cls.includes('ship')){fx('sinkbubbles',e.x,e.y,{life:2});sfxAt('sink',e.x,e.y);fx('splash',e.x,e.y)}
    else sfxAt('death',e.x,e.y);
    if(e.def.cls.includes('ship')||e.def.cls.includes('siege')){sfxAt('explode',e.x,e.y,{vol:.5});fx('boom',e.x,e.y,{r:1,life:.8})}
    if(e.owner===0&&!e.def.animal)msg(e.def.n+' lost','warn',e.x,e.y);
    if(e.owner>=0&&G.players[e.owner].civ==='saracens'&&e.type==='monk'&&by&&by.owner>=0&&G.players[by.owner].civ==='saracens'){}
    if(e.owner>=0&&e.def.cls.includes('mon')&&by&&by.owner>=0&&G.players[by.owner].f.madr){G.players[by.owner].res.g+=33}
  }else if(e.kind==='b'){
    for(let j=0;j<e.sz;j++)for(let i=0;i<e.sz;i++){const k=(e.y+j)*G.W+e.x+i;if(G.occ[k]===e.id)G.occ[k]=0}
    e.rubble=1;G.decals.push({type:'rubble',x:e.x,y:e.y,sz:e.sz,t:G.time,owner:e.owner,btype:e.type});
    fx('collapse',e.cx,e.cy,{sz:e.sz,life:2});sfxAt('crumble',e.cx,e.cy);sfxAt('explode',e.cx,e.cy,{vol:.4});
    ungarrisonAll(e,true);
    for(let n=0;n<e.relics;n++){const q=freeNear(e.cx,e.cy,e.sz/2+1,e.sz/2+3);if(q)mkRes('relic',Math.floor(q.x),Math.floor(q.y))}e.relics=0;
    if(e.owner===0)msg(e.def.n+' destroyed!','warn',e.cx,e.cy);
    // builders stop
    recalcPlayer(G.players[e.owner]);
    // stop trade units targeting it handled in trade tick
  }
  if(e.kind==='u'&&e.owner>=0)G.players[e.owner].stats.lost=(G.players[e.owner].stats.lost||0)+1;
}
function pushFlee(u,from,d){}

// ---------- resource helpers ----------
function gatherKey(r){
  if(r.kind==='b')return'farm';
  if(r.res==='w')return'w';if(r.type==='berries'||r.type==='shrub')return'berries';if(r.type==='carcass')return r.fromType==='sheep'?'sheep':'carcass';
  if(r.type==='gold')return'gold';if(r.type==='stone')return'stone';if(r.type==='fish')return'fish';return'w';
}
function gatherRate(u,r){
  const p=G.players[u.owner],k=gatherKey(r);
  let rate,mul=1;
  switch(k){case'w':rate=RATE.w;mul=p.gm.wood;break;case'farm':rate=RATE.farm;mul=p.gm.farm;break;case'berries':rate=RATE.berries;mul=p.gm.farm;break;case'carcass':rate=RATE.carcass;mul=p.gm.hunt;break;case'sheep':rate=RATE.carcass;mul=p.gm.hunt*p.gm.sheep;break;case'gold':rate=RATE.gold;mul=p.gm.gold;break;case'stone':rate=RATE.stone;mul=p.gm.stone;break;case'fish':rate=RATE.fish;mul=p.gm.fish;break}
  if(p.ai)mul*=aiEcoMul(p);
  return rate*mul;
}
function aiEcoMul(p){return [0.85,1.15,1.35,1.6][p.diff||1]}
function carryCap(u){const p=G.players[u.owner];return(u.carryCap||10)+(u.def.k==='villager'?p.f.carry:0)}
function findDrop(u,res){
  let best=null,bd=1e9;
  const ship=isShip(u);
  for(const b of G.blds){
    if(b.dead||!b.built||b.owner!==u.owner||!b.def.drop.includes(res))continue;
    if(ship&&!b.def.dock)continue;
    if(!ship&&b.def.dock)continue;
    const d=hyp(b.cx-u.x,b.cy-u.y);if(d<bd){bd=d;best=b}
  }
  return best;
}
function findResNear(x,y,pred,r){
  let best=null,bd=r*r;const un=G.unreach;
  for(const e of G.ress){if(e.dead||!pred(e))continue;if(un&&un.get(e.id)>G.time)continue;const d=(e.x+.5-x)**2+(e.y+.5-y)**2;if(d<bd){bd=d;best=e}}
  return best;
}
function resGatherable(u,r){
  if(r.dead)return false;
  if(r.kind==='b')return r.farm&&r.built&&r.owner===u.owner&&(!r.farm.gatherer||r.farm.gatherer===u.id||!byId(r.farm.gatherer)||byId(r.farm.gatherer).tgt!==r.id);
  if(r.type==='relic')return false;
  if(r.type==='fish')return isShip(u)&&u.def.k==='fishing';
  if(isShip(u))return false;
  return u.def.k==='villager'&&r.amt>0;
}
// find similar resource nearby after depletion
function autoNextRes(u,from,t){
  if(from.kind==='b'&&from.farm){ // occupied/depleted farm -> any free farm nearby
    let best=null,bd=(t||10)**2;for(const b of G.blds){if(b.dead||!b.farm||!b.built||b.owner!==u.owner||b===from)continue;const g=b.farm.gatherer&&byId(b.farm.gatherer);if(g&&g!==u&&g.t==='gather'&&g.tgt===b.id)continue;const d=(b.cx-from.cx)**2+(b.cy-from.cy)**2;if(d<bd){bd=d;best=b}}
    return best}
  const type=from.type,rt=from.res;
  let cand=findResNear(from.x+.5,from.y+.5,e=>{if(e.dead||!resGatherable(u,e))return false;if(e.kind==='b')return false;
    if(rt==='w')return e.res==='w';if(type==='carcass'||type==='berries'||type==='shrub')return e.res==='f'&&e.type!=='fish'&&e.type!=='relic';return e.type===type},t||10);
  return cand;
}
function goalNear(e,reach){
  return(cx,cy)=>rectDist(cx+.5,cy+.5,e)<=reach;
}
// approach entity; returns 'near' if within stopDist, 'moving', or 'stuck'
function approach(u,e,reach,stopDist,dt){
  const d=rectDist(u.x,u.y,e);
  if(d<=stopDist){u.path=null;return'near'}
  const ex=e.kind==='b'?e.cx:e.x,ey=e.kind==='b'?e.cy:e.y;
  const moved=u.path&&u.pgx!==undefined&&hyp(ex-u.pgx,ey-u.pgy)>(e.kind==='u'?2:0.5);
  u.rp-=dt;
  if(!u.path||u.needRepath||(moved&&u.rp<=0)||(u.pi>=u.path.length&&d>stopDist)){
    if(G.pfBudget<=0){u.rp=0.1;return'moving'}
    if(u.pathFail&&u.pathFail>G.time){return'stuck'}
    u.needRepath=false;
    if(!sameRegion(u,ex,ey)&&!isShip(u)&&e.kind!=='b'||(e.kind==='b'&&!isShip(u)&&!sameRegion(u,e.x-1,e.y-1)&&!sameRegion(u,e.x+e.sz,e.y+e.sz)&&!sameRegion(u,e.x+e.sz,e.y-1)&&!sameRegion(u,e.x-1,e.y+e.sz))){u.pathFail=G.time+3;return'stuck'}
    const r=pathTo(u,goalNear(e,reach),ex,ey);
    if(!r.ok||!r.path.length){const dd=rectDist(u.x,u.y,e);if(!r.path.length||(!r.ok&&r.path.length<2&&dd>reach+0.5)){u.pathFail=G.time+3;return'stuck'}}
  }
  const fin=stepPath(u,dt);
  if(fin&&rectDist(u.x,u.y,e)>stopDist+0.15){u.path=null;if(e.kind==='u'&&e.t!==undefined&&u.pathOk!==false)return'moving';u.pathFail=G.time+1;return'stuck'}
  return'moving';
}
function dropOff(u,b){
  if(u.carry&&u.carry.n>0){const p=G.players[u.owner];const n=Math.floor(u.carry.n);p.res[u.carry.r]+=n;p.stats.gathered+=n;
    if(u.owner===0&&G.onFloat)G.onFloat('+'+n,u.carry.r,b.cx,b.cy);
    sfxAt('coin',u.x,u.y,{vol:.3});u.carry.n-=n;if(u.carry.n<0.01)u.carry=null}
}
// ---------- unit update ----------
function updateUnits(dt){
  for(let i=0;i<G.units.length;i++){const u=G.units[i];if(u.dead||u.inside)continue;updateUnit(u,dt)}
}
function updateUnit(u,dt){
  u.moving=false;u.working=false;
  if(u.cd>0)u.cd-=dt;if(u.at>0)u.at-=dt;if(u.hit>0)u.hit-=dt;
  u.z+= (hAt(u.x,u.y)-u.z)*Math.min(1,dt*6);
  if(u.def.regen&&u.hp<u.mh&&G.time-(u.lastFight||-99)<4)u.hp=Math.min(u.mh,u.hp+u.def.regen*dt);
  if(u.def.animal&&u.owner<0||u.def.animal){animalAI(u,dt);return}
  if(u.def.k==='villager'&&G.players[u.owner].regenV){}
  switch(u.t){
    case'idle':idleAI(u,dt);break;
    case'move':{ if(u.needRepath||(!u.path&&G.pfBudget>0)){u.needRepath=false;moveToPoint(u,u.mx,u.my)}
      if(u.path){const fin=stepPath(u,dt);if(fin){u.path=null;if(u.breach){breachWall(u)}else {u.t='idle';u.formDone=true}}else if(u.breach)breachWall(u)}
      else if(!u.path&&u.needRepath===false&&G.pfBudget<=0){} break}
    case'amove':amoveAI(u,dt);break;
    case'attack':attackAI(u,dt);break;
    case'gather':gatherAI(u,dt);break;
    case'build':buildAI(u,dt);break;
    case'repair':repairAI(u,dt);break;
    case'garrison':garrisonAI(u,dt);break;
    case'heal':healAI(u,dt);break;
    case'convert':convertAI(u,dt);break;
    case'relic':relicAI(u,dt);break;
    case'trade':tradeAI(u,dt);break;
    case'board':boardAI(u,dt);break;
    case'unloadat':unloadAtAI(u,dt);break;
  }
  if(u.def.k==='cobra'){if(u.moving&&Math.random()<dt*2)sfxAt('engine',u.x,u.y,{vol:.4})}
}
function breachWall(u){
  const w=byId(u.breach);u.breach=0;if(!w)return;
  u.after={t:u.t,tx:u.mx||u.tx,ty:u.my||u.ty};
  const keep=u.after;setCmd(u,'attack',w);u.after=keep;
}
function idleAI(u,dt){
  u.acq-=dt;
  const d=u.def;
  if(d.k==='monk'){
    if(u.acq<=0){u.acq=0.6;const tgt=findHealTarget(u);if(tgt){setCmd(u,'heal',tgt);return}
      if(G.players[u.owner].ai){const c=findConvertTarget(u);if(c)setCmd(u,'convert',c)}}
    return;
  }
  if(!isMil(u)&&u.type!=='cobra'||u.stance==='none')return;
  if(u.acq<=0){u.acq=0.35+Math.random()*0.2;const e=acquire(u);if(e){if(u.stance==='stand'){if(rectDist(u.x,u.y,e)<=rangeOf(u,e)){setCmd(u,'attack',e)}}else setCmd(u,'attack',e)}}
  else if(u.after&&u.t==='idle'){}
}
function acquire(u,rOverride){
  const rg=sget(u,'rng');let r=rOverride||Math.max(rg+3,isShip(u)?8:6);if(u.type==='cobra')r=9;
  if(u.stance==='def')r=Math.max(rg+1,4);
  let best=null,bs=1e9;const siege=u.def.cls.includes('siege')&&!u.def.cls.includes('ranged');
  near(u.x,u.y,r,e=>{
    if(e===u||!canAttack(u,e,false))return false;
    if(G.dip[u.owner]&&e.owner>=0&&G.players[u.owner].ai===false&&G.cheats.polo===false&&u.owner===0&&e.kind==='u'&&G.visNow&&!G.visNow[tIdx(e.x,e.y)])return false;
    let d=rectDist(u.x,u.y,e);if(d>r)return false;
    let s=d;
    if(e.kind==='b'){s+=(siege?-3:6);if(e.def.wall)s+=8}
    else{if(e.def.atk>0)s-=1.5;if(e.def.animal)s+=2;if(siege&&!e.def.cls.includes('siege'))s+=8}
    if(u.def.cls.includes('arc')&&e.def.cls&&e.def.cls.includes('skirm'))s-=1;
    if(s<bs){bs=s;best=e}
  },2);
  return best;
}
function amoveAI(u,dt){
  let e=byId(u.tgt);
  if(!e||!canAttack(u,e)){u.tgt=0;u.acq-=dt;if(u.acq<=0){u.acq=0.4;const n=acquire(u,Math.max(sget(u,'rng')+4,7));if(n){u.tgt=n.id;u.path=null}}}
  e=byId(u.tgt);
  if(e){ doAttack(u,e,dt,true);return}
  if(!u.path){if(G.pfBudget>0||u.needRepath){moveToPoint(u,u.tx,u.ty)}else return}
  if(u.path){const fin=stepPath(u,dt);if(u.breach){breachWall(u);return}if(fin){u.t='idle';u.path=null}}
}
function attackAI(u,dt){
  const e=byId(u.tgt);
  if(!e||!canAttack(u,e,true)||(e.kind==='u'&&e.inside)){
    const prev=u.prevCmd;
    if(u.hunting&&prev){u.hunting=false;u.t=prev.t;u.tgt=prev.tgt;u.gs=prev.gs;u.prevCmd=null;return}
    if(u.after){const a=u.after;u.after=null;if(a.t==='amove'||a.t==='move'){setCmd(u,a.t==='amove'?'amove':'move',0,a.tx,a.ty);u.mx=a.tx;u.my=a.ty;return}}
    setCmd(u,'idle');return;
  }
  doAttack(u,e,dt,false);
}
function doAttack(u,e,dt,amove){
  const reach=rangeOf(u,e);const melee=!(u.def.rng>0);
  const stop=melee?(u.def.boom?1.3:0.95):reach;
  const d=rectDist(u.x,u.y,e);
  if(u.stance==='stand'&&d>stop+0.2){if(!amove)setCmd(u,'idle');u.tgt=0;return}
  if(u.def.minr&&d<u.def.minr&&false){}
  let losBlocked=false;
  if(d<=stop+0.05&&!melee&&u.kind==='u'&&!isShip(u)&&e.kind==='u'&&d>1.5)losBlocked=elevBlocked(u,e);
  if(losBlocked){const r=approach(u,e,0.75,Math.max(0.95,d-2.5),dt);if(r==='stuck'){u.tgt=0;if(!amove)setCmd(u,'idle')}return}
  if(d<=stop+0.05){
    u.path=null;
    const fdx=(e.kind==='b'?e.cx:e.x)-u.x,fdy=(e.kind==='b'?e.cy:e.y)-u.y,fd=hyp(fdx,fdy)||1;u.fx=fdx/fd;u.fy=fdy/fd;
    u.working=true;u.lastFight=G.time;
    if(u.def.boom){explode(u);return}
    if(u.cd<=0){
      const rof=sget(u,'rof')||2;
      u.cd=rof;u.at=Math.min(0.6,rof*0.7);u.atMax=u.at;u.hitE=e.id;
      if(u.type==='cobra')u.cd=0.07;
      if(melee){applyDamage(u,e,calcDamage(u,e));sfxAt(e.kind==='b'?(u.def.k.includes('ram')?'bash':'hit'):'slash',u.x,u.y,{vol:.5})}
      else fireAt(u,e);
    }
  }else{
    const r=approach(u,e,Math.max(0.75,stop-0.5),stop,dt);
    if(r==='stuck'){
      // couldn't reach: for ranged target maybe water; give up
      u.tgt=0;if(!amove)setCmd(u,'idle');else u.t='amove';
    }
  }
}
function elevBlocked(a,b){ // a ridge/cliff higher than both ends blocks ranged fire
  const ha=hAt(a.x,a.y),hb=hAt(b.x,b.y),top=Math.max(ha,hb);const dx=b.x-a.x,dy=b.y-a.y,n=Math.ceil(hyp(dx,dy)*1.5);
  for(let i=1;i<n;i++){const t=i/n;if(hAt(a.x+dx*t,a.y+dy*t)>top)return true}return false;
}
function fireAt(u,e){
  const d=u.def,ptype=d.proj||(isShip(u)?'arrow':'arrow');
  if(ptype==='flame'||ptype==='bullet'){
    applyDamage(u,e,calcDamage(u,e));
    fx(ptype==='flame'?'flame':'tracer',u.x,u.y,{tx:e.kind==='b'?e.cx:e.x,ty:e.kind==='b'?e.cy:e.y,life:ptype==='flame'?.35:.15,fz:u.z});
    sfxAt(ptype==='flame'?'fire':'gun',u.x,u.y,{vol:.35});return;
  }
  const tx=e.kind==='b'?e.cx:e.x,ty=e.kind==='b'?e.cy:e.y,dd=hyp(tx-u.x,ty-u.y);
  const spd=ptype==='rock'?7:ptype==='bolt'?16:12;
  G.proj.push({type:ptype,x0:u.x,y0:u.y,z0:u.z+0.6,x1:tx,y1:ty,tgt:e.id,att:u.id,owner:u.owner,t:0,dur:Math.max(0.15,dd/spd),dmg:calcDamage(u,e),splash:d.splash||0,aid:u.id,eh:hAt(tx,ty)});
  sfxAt(ptype==='rock'?'catapult':'arrow',u.x,u.y,{vol:.4});
}
function explode(u){
  if(u.dead)return;const b=u.def.boom;
  fx('boom',u.x,u.y,{r:b.r,life:1});sfxAt('explode',u.x,u.y);
  const hits=[];near(u.x,u.y,b.r,e=>{if(e!==u&&isEnemy(u.owner,e.owner)&&rectDist(u.x,u.y,e)<=b.r)hits.push(e)},4);
  for(const e of hits){applyDamage(u,e,e.kind==='b'?b.bld:b.dmg)}
  u.dead=true;u.hp=0;u.exploded=true;if(u.owner>=0)G.players[u.owner].pop--;
}
function updateProj(dt){
  for(const p of G.proj){
    p.t+=dt;
    if(p.t>=p.dur&&!p.done){
      p.done=true;
      const e=byId(p.tgt);
      if(p.splash){
        fx('boom',p.x1,p.y1,{r:p.splash,life:.7,small:true});sfxAt('hit',p.x1,p.y1,{vol:.5});
        const hits=[];near(p.x1,p.y1,p.splash,t=>{if(isEnemy(p.owner,t.owner)||(t===e)){if(rectDist(p.x1,p.y1,t)<=p.splash)hits.push(t)}},4);
        const att=byId(p.aid);
        for(const t of hits){applyDamage(att,t,p.dmg*(t===e?1:0.6))}
      }else if(e&&hyp((e.kind==='b'?e.cx:e.x)-p.x1,(e.kind==='b'?e.cy:e.y)-p.y1)<(e.kind==='b'?4:1.6)){
        applyDamage(byId(p.aid),e,p.dmg);if(e.kind==='u')sfxAt('hit',e.x,e.y,{vol:.25});
      }
    }
  }
  G.proj=G.proj.filter(p=>p.t<p.dur+0.05);
}
// ----- gathering -----
function gatherAI(u,dt){
  const p=G.players[u.owner];let r=byId(u.tgt);
  const ship=isShip(u);
  if(u.gs==='drop'){return dropAI(u,dt)}
  // target invalid -> find another
  if(!r||(r.kind==='r'&&r.amt<=0)||(r.kind==='b'&&r.farm&&r.farm.amt<=0&&!tryReseed(u,r))){
    const last=u.lastRes;let from=r||{x:last.x,y:last.y,type:last.type,res:u.gres,kind:'r'};
    const n=autoNextRes(u,from,ship?16:11);
    if(n){u.tgt=n.id;u.gs='go';u.path=null;r=n}
    else{ if(u.carry&&u.carry.n>=1){u.gs='drop';return}
      setCmd(u,'idle');return}
  }
  if(u.gs==='kill'){ // hunting a live animal
    const a=byId(u.tgt);
    if(!a||!a.def||!a.def.animal){u.gs='go';return}
  }
  if(r.kind==='u'){ // animal target: attack to kill
    if(r.dead){return}
    u.working=false;
    if(r.owner>=0&&r.owner!==u.owner&&isFriend(u.owner,r.owner)){setCmd(u,'idle');return}
    doAttackAnimal(u,r,dt);return;
  }
  if(!resGatherable(u,r)){const n=autoNextRes(u,r,10);if(n){u.tgt=n.id;u.gs='go'}else setCmd(u,'idle');return}
  // carry other type? drop old
  const key=r.kind==='b'?'f':r.res;
  if(u.carry&&u.carry.r!==key){u.carry=null}
  const workReach=ship?1.6:0.95;
  const d=rectDist(u.x,u.y,r);
  if(d>workReach){
    const res=approach(u,r,ship?1.4:0.75,workReach,dt);
    if(res==='stuck'){ // try another resource
      (G.unreach||(G.unreach=new Map())).set(r.id,G.time+45);u.pathFail=0;const n=findResNear(u.x,u.y,e=>e!==r&&!e.dead&&resGatherable(u,e)&&e.res===r.res&&e.type===r.type,8);
      if(n){u.tgt=n.id}else setCmd(u,'idle')}
    return;
  }
  // working
  u.path=null;u.working=true;u.workType=r.kind==='b'?'farm':r.type;
  const fdx=(r.kind==='b'?r.cx:r.x+.5)-u.x,fdy=(r.kind==='b'?r.cy:r.y+.5)-u.y,fd=hyp(fdx,fdy)||1;u.fx=fdx/fd;u.fy=fdy/fd;
  if(r.kind==='b')r.farm.gatherer=u.id;
  const rate=gatherRate(u,r);
  const take=Math.min(rate*dt,(r.kind==='b'?r.farm.amt:r.amt),carryCap(u)-((u.carry&&u.carry.n)||0));
  if(!u.carry)u.carry={r:key,n:0};
  u.carry.n+=take;
  if(r.kind==='b')r.farm.amt-=take;else r.amt-=take;
  u.workT=(u.workT||0)+dt;
  if(r.kind==='r'){r.shake=0.25;if(r.res==='w'&&Math.random()<dt*3)fx('chip',r.x+.5,r.y+.5,{});if(r.type==='gold'||r.type==='stone')if(Math.random()<dt*3)fx('spark',r.x+.5,r.y+.5,{c:r.type})}
  const sfxN=r.type==='tree'||r.type==='pine'||r.type==='palm'?'chop':r.type==='gold'||r.type==='stone'?'mine':r.kind==='b'?'farm':r.type==='fish'?'splash':null;
  if(sfxN&&(u.workT%1.1)<dt)sfxAt(sfxN,u.x,u.y,{vol:.35});
  if(r.kind==='r'&&r.amt<=0.01){killRes(r);if(r.type==='fish'){}}
  if(r.kind==='b'&&r.farm.amt<=0.01){tryReseed(u,r)}
  if(u.carry&&u.carry.n>=carryCap(u)-0.01){u.gs='drop';u.path=null;u.lastRes={x:r.x,y:r.y,type:r.type};u.gres=key;u.workT=0;}
}
function tryReseed(u,farm){
  const p=G.players[u.owner];
  if(p.res.w>=60){p.res.w-=60;farm.farm.amt=farm.farm.max;fx('dust',farm.cx,farm.cy,{});return true}
  if(u.owner===0&&G.time-(G._reseedMsg||-99)>20){G._reseedMsg=G.time;msg('Farm exhausted – need 60 wood to reseed','warn')}
  return false;
}
function doAttackAnimal(u,a,dt){
  // villager hunting: kill animal then gather carcass
  const d=rectDist(u.x,u.y,a);
  if(a.owner>=0&&a.owner!==u.owner&&!isFriend(u.owner,a.owner)){}
  if(d<=0.95){
    u.path=null;u.working=true;u.workType='hunt';
    const fdx=a.x-u.x,fdy=a.y-u.y,fd=hyp(fdx,fdy)||1;u.fx=fdx/fd;u.fy=fdy/fd;
    if(u.cd<=0){u.cd=sget(u,'rof')||2;u.at=.45;u.atMax=.45;applyDamage(u,a,calcDamage(u,a,u.def.k==='villager'?4:undefined));sfxAt('stab',u.x,u.y,{vol:.4});
      if(a.dead){const c=findResNear(a.x,a.y,e=>e.type==='carcass'&&e.fx===a.x,2)||findResNear(a.x,a.y,e=>e.type==='carcass',2);if(c){u.tgt=c.id;u.gs='go';u.gt='carcass';u.gres='f';u.lastRes={x:c.x,y:c.y,type:'carcass'}}else setCmd(u,'idle')}}
  }else{
    const r=approach(u,a,0.75,0.95,dt);if(r==='stuck'){u.huntFail=(u.huntFail||0)+1;if(u.huntFail>10){u.huntFail=0;u.tgt=0;setCmd(u,'idle')}else{u.pathFail=0;u.path=null;u.rp=0}}else u.huntFail=0
  }
}
function dropAI(u,dt){
  if(!u.carry||u.carry.n<1){u.carry=null;const last=u.lastRes;const r=autoNextRes(u,{x:last.x,y:last.y,type:last.type,res:u.gres,kind:'r'},12)||null;const orig=byId(u.tgt);
    u.gs='go';if(!orig||(orig.kind==='r'&&orig.amt<=0)){if(r)u.tgt=r.id;else{setCmd(u,'idle')}}return}
  const res=u.carry.r;let b=u.dropB&&!u.dropB.dead&&u.dropB.built&&u.dropB.def.drop.includes(res)?u.dropB:null;
  if(!b){b=findDrop(u,res);u.dropB=b}
  if(!b){u.working=false;if(u.owner===0&&G.time-(u.nodropMsg||-99)>30){u.nodropMsg=G.time;msg('No drop-off building for '+RN[res],'warn')}return}
  const reach=isShip(u)?1.6:1.0;
  if(rectDist(u.x,u.y,b)<=reach){dropOff(u,b);u.dropB=null;u.gs='go';u.path=null;
    const r=byId(u.tgt);if(!r||(r.kind==='r'&&r.amt<=0)){const last=u.lastRes;const n=autoNextRes(u,{x:last.x,y:last.y,type:last.type,res:u.gres,kind:'r'},12);if(n)u.tgt=n.id;else setCmd(u,'idle')}
    return}
  const r=approach(u,b,isShip(u)?1.3:0.75,reach,dt);
  if(r==='stuck'){u.dropB=null;u.pathFail=G.time+2}
}
// ----- building / repair -----
function buildAI(u,dt){
  const b=byId(u.tgt);
  if(!b||b.built||b.owner!==u.owner&&!isFriend(u.owner,b.owner)){
    // finished: auto-follow-up
    if(b&&b.built&&b.owner===u.owner){afterBuild(u,b)}else setCmd(u,'idle');return}
  if(rectDist(u.x,u.y,b)>1.1){const r=approach(u,b,0.9,1.0,dt);if(r==='stuck'){setCmd(u,'idle')}return}
  u.path=null;u.working=true;u.workType='build';
  const fdx=b.cx-u.x,fdy=b.cy-u.y,fd=hyp(fdx,fdy)||1;u.fx=fdx/fd;u.fy=fdy/fd;
  b.bn++;
  u.workT=(u.workT||0)+dt;if((u.workT%0.55)<dt)sfxAt('hammer',u.x,u.y,{vol:.35});
  if(Math.random()<dt*2)fx('chip',u.x+u.fx*.5,u.y+u.fy*.5,{});
}
function constructTick(b,dt){
  const p=G.players[b.owner];
  const n=Math.max(b.bnPrev,1);
  if(G.cheats.aegis&&b.owner===0){b.prog=1}
  else if(b.bnPrev>0){
    let rate=b.bnPrev**0.7/(b.def.t||30);rate*=1+p.f.buildSpd;b.prog=Math.min(1,b.prog+rate*dt)}
  const target=Math.max(1,Math.round(b.mh*(0.1+0.9*b.prog)));
  if(b.hp<target)b.hp=Math.min(b.mh,b.hp+(target-b.hp));
  if(b.prog>=1){completeBuilding(b)}
}
function completeBuilding(b){
  b.built=true;b.prog=1;b.hp=Math.max(b.hp,b.mh*0.999);const p=G.players[b.owner];p.stats.built++;recalcPlayer(p);
  if(b.owner===0){msg(b.def.n+' completed','good',b.cx,b.cy);sfxAt('build_done',b.cx,b.cy)}
  fx('dust',b.cx,b.cy,{sz:b.sz});
}
function afterBuild(u,b){
  const d=b.def;let r=null;
  if(d.farm){orderGather(u,b);return}
  if(d.drop.includes('w'))r=findResNear(b.cx,b.cy,e=>e.res==='w',8);
  else if(d.drop.includes('g')||d.drop.includes('s'))r=findResNear(b.cx,b.cy,e=>e.type==='gold'||e.type==='stone',8);
  else if(d.drop==='f'&&!d.dock)r=findResNear(b.cx,b.cy,e=>e.type==='berries',8);
  if(r&&u.def.k==='villager')orderGather(u,r);else setCmd(u,'idle');
}
function repairAI(u,dt){
  const e=byId(u.tgt),p=G.players[u.owner];
  if(!e||e.hp>=e.mh||!isFriend(u.owner,e.owner)){setCmd(u,'idle');return}
  const reach=e.kind==='b'?1.1:(isShip(e)?1.9:1.1);
  if(rectDist(u.x,u.y,e)>reach){const r=approach(u,e,reach-0.15,reach,dt);if(r==='stuck')setCmd(u,'idle');return}
  u.path=null;u.working=true;u.workType='repair';
  const fdx=(e.kind==='b'?e.cx:e.x)-u.x,fdy=(e.kind==='b'?e.cy:e.y)-u.y,fd=hyp(fdx,fdy)||1;u.fx=fdx/fd;u.fy=fdy/fd;
  // cost: 50% of cost spread over hp
  const bt=e.kind==='b'?e.def.t:(e.def.t*1.5);
  const hps=e.mh/(bt*3);let add=Math.min(hps*dt,e.mh-e.hp);
  const owner=G.players[e.owner];
  const cost=e.kind==='b'?e.def.cost:unitCost(owner,e.type);
  let ok=true;
  e.repAcc=e.repAcc||{f:0,w:0,g:0,s:0};
  for(const k of RK){const c=(cost[k]||0)*0.5/e.mh*add;if(c>0){if(p.res[k]<c+0.0001&&(p.res[k]+e.repAcc[k])<c){ok=false}}}
  if(!ok){if(u.owner===0&&G.time-(u._repMsg||-99)>8){u._repMsg=G.time;msg('Not enough resources to repair','warn')}setCmd(u,'idle');return}
  for(const k of RK){const c=(cost[k]||0)*0.5/e.mh*add;e.repAcc[k]+=c;const w=Math.floor(e.repAcc[k]);if(w>0){p.res[k]-=w;e.repAcc[k]-=w}}
  e.hp+=add;u.workT=(u.workT||0)+dt;if((u.workT%0.6)<dt){sfxAt('hammer',u.x,u.y,{vol:.3})}
  if(Math.random()<dt*4)fx('repair',(e.kind==='b'?e.cx+(Math.random()-.5)*e.sz*.7:e.x),(e.kind==='b'?e.cy+(Math.random()-.5)*e.sz*.7:e.y),{});
  e.repairing=0.3;
  if(e.hp>=e.mh){e.hp=e.mh;setCmd(u,'idle');if(u.owner===0)msg((e.def.n)+' repaired','good')}
}
// ----- garrison -----
function garCap(b){return(b.def.gar||0)+((b.def.gar&&G.players[b.owner].f.garBonus)||0)}
function canGarrison(u,b){
  if(!b||b.dead||!b.built||!b.def.gar||!isFriend(u.owner,b.owner)||u.def.cls.includes('siege')||isShip(u)||u.def.animal||u.type==='cobra')return false;
  if(b.type==='tower'&&!(u.def.cls.includes('inf')||u.def.cls.includes('arc')||u.def.cls.includes('vil')||u.def.cls.includes('skirm')||u.def.cls.includes('mon')))return false;
  return b.gar.length<garCap(b);
}
function garrisonAI(u,dt){
  const b=byId(u.tgt);
  if(!b||!canGarrison(u,b)){
    // try another shelter if bell
    if(u.bell){const s=findShelter(u);if(s){u.tgt=s.id;u.path=null;return}u.bell=false;u.bellIdle=true}
    setCmd(u,'idle');return}
  if(rectDist(u.x,u.y,b)<=1.2){enterGarrison(u,b);return}
  const r=approach(u,b,0.9,1.1,dt);if(r==='stuck'){if(u.bell){const s=findShelter(u,b);if(s){u.tgt=s.id;u.pathFail=0}else{u.bellIdle=true;setCmd(u,'idle')}}else setCmd(u,'idle')}
}
function enterGarrison(u,b){
  u.inside=b.id;b.gar.push(u.id);u.x=b.cx;u.y=b.cy;u.path=null;
  const keep=u.bell;setCmd(u,'idle');u.bell=keep;u.t='idle';
  if(b.owner===0)sfxAt('click',b.cx,b.cy,{vol:.2});
}
function exitPoint(b,ship,pref){
  const cands=[];
  for(let j=-2;j<=b.sz+1;j++)for(let i=-2;i<=b.sz+1;i++){
    if(i>=0&&j>=0&&i<b.sz&&j<b.sz)continue;
    const tx=b.x+i,ty=b.y+j;if(tx<0||ty<0||tx>=G.W||ty>=G.H)continue;
    const k=ty*G.W+tx;
    if(ship){if(G.terr[k]<3)continue}else{if(G.terr[k]>=3||G.occ[k])continue}
    const ring=Math.max(Math.max(-i,i-b.sz+1),Math.max(-j,j-b.sz+1));
    let sc=ring+Math.random()*.4;if(pref)sc+=hyp(tx-pref.x,ty-pref.y)*.05;
    cands.push([sc,tx+.5,ty+.5]);
  }
  cands.sort((a,b)=>a[0]-b[0]);
  return cands.length?{x:cands[0][1],y:cands[0][2]}:null;
}
function ungarrison(b,u,silent){
  const i=b.gar.indexOf(u.id);if(i<0)return;b.gar.splice(i,1);
  const q=exitPoint(b,false);u.inside=0;
  if(q){u.x=q.x;u.y=q.y}else{u.x=b.cx;u.y=b.cy+b.sz/2+1}
  u.z=hAt(u.x,u.y);u.path=null;
}
function ungarrisonAll(b,destroyed){
  const ids=b.gar.slice();
  for(const id of ids){const u=G.byId.get(id);if(!u||u.dead)continue;
    if(destroyed){const q=exitPoint(b,false)||{x:b.cx,y:b.cy+b.sz/2+1};b.gar.splice(b.gar.indexOf(id),1);u.inside=0;u.x=q.x;u.y=q.y;u.z=hAt(u.x,u.y);u.path=null;u.t='idle'}
    else{ungarrison(b,u);if(u.bell){/* returned by user */u.bell=false}if(b.rally)applyRally(b,u)}
  }
}
function findShelter(u,except){
  let best=null,bd=32;
  for(const b of G.blds){if(b.dead||b===except||!canGarrison(u,b)||b.owner!==u.owner)continue;if(b.type==='castle'||b.type==='towncenter'||b.type==='tower'){
    const d=hyp(b.cx-u.x,b.cy-u.y);if(d<bd){bd=d;best=b}}}
  return best;
}
// ----- town bell -----
function toggleBell(p){
  p.bell=!p.bell;
  if(p.bell){
    p.bellT=G.time;let n=0,none=0;
    for(const u of G.units){if(u.dead||u.owner!==p.id||u.def.k!=='villager'||u.inside)continue;
      const s=findShelter(u);
      u.prev={t:u.t,tgt:u.tgt,gs:u.gs,tx:u.tx,ty:u.ty,res:u.gres,lastRes:u.lastRes,gt:u.gt};
      if(s){orderGarrison(u,s,true);u.bell=true;n++}else{none++;u.bell=true;u.bellIdle=true;setCmd(u,'idle');u.bell=true}
    }
    if(p.id===0){msg('Town Bell rung: villagers seek shelter ('+n+' sheltering'+(none?', '+none+' with no shelter free':'')+')','warn');}
    sfxAt('bell',p.start.x,p.start.y,{vol:1})
  }else{
    let n=0;
    for(const b of G.blds)if(!b.dead&&b.owner===p.id)for(const id of b.gar.slice()){const u=G.byId.get(id);if(u&&u.def.k==='villager'&&u.bell){ungarrison(b,u);n++}}
    for(const u of G.units){if(u.dead||u.owner!==p.id||!u.bell)continue;u.bell=false;restorePrev(u)}
    if(p.id===0)msg('Town Bell off: villagers return to work','good');
    sfxAt('bell',p.start.x,p.start.y,{vol:.6});
  }
}
function restorePrev(u){
  const pv=u.prev;u.prev=null;u.bellIdle=false;
  if(pv&&(pv.t==='gather'||pv.t==='build'||pv.t==='repair')){
    const e=byId(pv.tgt);
    if(e){if(pv.t==='gather')orderGather(u,e);else if(pv.t==='build')orderBuild(u,e);else orderRepair(u,e);return}
    if(pv.lastRes){const n=findResNear(pv.lastRes.x,pv.lastRes.y,r=>!r.dead&&resGatherable(u,r)&&r.type===pv.lastRes.type,12);if(n){orderGather(u,n);return}}
  }
  if(pv&&pv.t==='move'){orderMove(u,pv.tx,pv.ty);return}
  setCmd(u,'idle');
}

// ----- monks -----
function findHealTarget(m){
  let best=null,bs=1e9;
  near(m.x,m.y,7,e=>{if(e===m||e.kind!=='u'||e.def.animal||e.hp>=e.mh||!isFriend(m.owner,e.owner)||e.def.cls.includes('siege')||isShip(e)||e.type==='cobra'||e.def.cls.includes('trade'))return false;
    const d=hyp(e.x-m.x,e.y-m.y)+e.hp/e.mh*3;if(d<bs){bs=d;best=e}});
  return best;
}
function canConvert(m,e){
  if(!e||e.dead||e.inside||e.kind!=='u'||e.def.animal||!isEnemy(m.owner,e.owner))return false;
  const p=G.players[m.owner];
  if(e.def.cls.includes('siege')&&!p.f.redeem)return false;
  if(e.def.cls.includes('mon')&&!p.f.atone)return false;
  if(isShip(e)||e.type==='cobra')return false;
  return true;
}
function findConvertTarget(m){
  let best=null,bs=1e9;
  near(m.x,m.y,9,e=>{if(!canConvert(m,e))return false;let s=hyp(e.x-m.x,e.y-m.y);if(e.def.atk>0)s-=3;s-=U[e.type].cost.g?2:0;if(s<bs){bs=s;best=e}});
  return best;
}
function healAI(u,dt){
  const e=byId(u.tgt);
  if(!e||e.hp>=e.mh||!isFriend(u.owner,e.owner)||e.inside){setCmd(u,'idle');return}
  const d=hyp(e.x-u.x,e.y-u.y);
  if(d>3.8){const r=approach(u,e,3.2,3.5,dt);if(r==='stuck')setCmd(u,'idle');return}
  u.path=null;u.working=true;u.workType='heal';u.fx=(e.x-u.x)/(d||1);u.fy=(e.y-u.y)/(d||1);
  const p=G.players[u.owner];
  e.hp=Math.min(e.mh,e.hp+3*p.f.heal*dt);e.healed=0.4;
  if(Math.random()<dt*6)fx('heal',e.x,e.y,{});
  u.workT=(u.workT||0)+dt;if((u.workT%1.5)<dt)sfxAt('heal',u.x,u.y,{vol:.3});
}
function convertAI(u,dt){
  const p=G.players[u.owner];const e=byId(u.tgt);
  if(!e||!canConvert(u,e)){setCmd(u,'idle');return}
  const rng=9+p.f.convRng,d=hyp(e.x-u.x,e.y-u.y);
  if(d>rng){u.cast=0;const r=approach(u,e,rng-2,rng-1,dt);if(r==='stuck')setCmd(u,'idle');return}
  u.path=null;u.fx=(e.x-u.x)/(d||1);u.fy=(e.y-u.y)/(d||1);
  if((u.convCd||0)>G.time){u.working=false;u.recharging=true;return}
  u.recharging=false;
  if(!u.cast){u.cast=0.001;u.castT=rnd(4,8);sfxAt('convert',u.x,u.y,{vol:.5})}
  u.cast+=dt;u.working=true;u.workType='convert';
  e.convProg=u.cast/u.castT;e.convT=0.3;
  if(Math.random()<dt*8)fx('convert',e.x,e.y,{});
  if(u.cast>=u.castT){
    u.cast=0;
    const tp=G.players[e.owner];let chance=1;if(e.def.cls.includes('mon')&&tp.f.convRes)chance=1-tp.f.convRes;
    // very close to a friendly Town Center / Monastery resists? (monastery shelters)
    let ok=Math.random()<chance;
    u.convCd=G.time+(ok?30:12)*p.f.convCd;
    if(ok){
      const old=e.owner;G.players[old].pop--;e.owner=u.owner;p.pop++;p.stats.conv++;
      if(e.relicCarry){}
      setCmd(e,'idle');fx('convert',e.x,e.y,{big:true});sfxAt('convert',e.x,e.y,{vol:.8});
      if(u.owner===0)msg(e.def.n+' converted!','good',e.x,e.y);else if(old===0)msg('Your '+e.def.n+' was converted!','warn',e.x,e.y);
      e.convProg=0;setCmd(u,'idle');
    }else{if(u.owner===0)msg('Conversion resisted','info')}
  }
}
function relicAI(u,dt){
  const p=G.players[u.owner];
  if(u.gs==='deposit'||u.relicCarry){
    let b=byId(u.tgt);if(!b||b.type!=='monastery'||b.owner!==u.owner||!b.built){b=null;let bd=1e9;for(const m of G.blds)if(!m.dead&&m.built&&m.type==='monastery'&&m.owner===u.owner){const d=hyp(m.cx-u.x,m.cy-u.y);if(d<bd){bd=d;b=m}}}
    if(!b){if(u.owner===0&&G.time-(u.nm||-99)>15){u.nm=G.time;msg('You need a Monastery to deposit the relic','warn')}setCmd(u,'idle');return}
    u.tgt=b.id;
    if(rectDist(u.x,u.y,b)<=1.2){b.relics++;u.relicCarry=false;sfxAt('bell',b.cx,b.cy,{vol:.5});fx('convert',b.cx,b.cy,{big:true});if(u.owner===0)msg('Relic stored: '+b.relics+' relic(s), +'+(b.relics*0.5).toFixed(1)+' gold/s','good',b.cx,b.cy);setCmd(u,'idle');return}
    const r=approach(u,b,1.0,1.1,dt);if(r==='stuck')setCmd(u,'idle');return}
  const r=byId(u.tgt);
  if(!r||r.type!=='relic'){setCmd(u,'idle');return}
  if(rectDist(u.x,u.y,r)<=1.1){killRes(r);u.relicCarry=true;u.gs='deposit';u.tgt=0;sfxAt('click',u.x,u.y);return}
  const a=approach(u,r,0.9,1.0,dt);if(a==='stuck')setCmd(u,'idle');
}
function takeRelicOut(b){
  if(b.relics<=0)return false;const q=exitPoint(b,false);if(!q)return false;
  b.relics--;mkRes('relic',Math.floor(q.x),Math.floor(q.y));return true;
}
// ----- trade -----
function tradeIncome(home,dest,u){
  const d=hyp(home.cx-dest.cx,home.cy-dest.cy);const p=G.players[u.owner];
  return Math.round(d*0.6*(1+d/100)*(p.f.tradeMul||1));
}
function tradeAI(u,dt){
  const p=G.players[u.owner];
  const dest=byId(u.tgt),home=byId(u.home);
  const ok=dest&&dest.built&&isFriend(u.owner,dest.owner)&&(dest.type==='market'||dest.type==='dock')&&dest.type===(isShip(u)?'dock':'market');
  if(!ok){if(u.owner===0)msg('Trade route closed (destination lost or no longer friendly)','warn');
    if(home&&home.built){setCmd(u,'move',0,0,0);const q=exitPoint(home,isShip(u));if(q)orderMove(u,q.x,q.y);else setCmd(u,'idle')}else setCmd(u,'idle');return}
  if(!home||home.dead){ if(u.gs==='back'){setCmd(u,'idle');return} }
  const target=u.gs==='back'?(home&&!home.dead?home:dest):dest;
  const ship=isShip(u);
  const reach=ship?1.8:1.1;
  if(rectDist(u.x,u.y,target)<=reach){
    u.path=null;
    if(target===dest&&u.gs!=='back'){const g=tradeIncome(home||dest,dest,u);p.res.g+=g;p.stats.traded+=g;if(u.owner===0&&G.onFloat)G.onFloat('+'+g,'g',u.x,u.y);sfxAt('trade',u.x,u.y);u.gs='back'}
    else{ if(home&&!home.dead){const g=tradeIncome(home,dest,u);p.res.g+=g;p.stats.traded+=g;if(u.owner===0&&G.onFloat)G.onFloat('+'+g,'g',u.x,u.y);sfxAt('trade',u.x,u.y)}u.gs='out'}
    return}
  const spdMul=1+(p.f.tradeSpd||0);
  u.moveMul=spdMul;
  if(u.needRepath||(!u.path&&G.pfBudget>0)){u.needRepath=false;
    const r=pathTo(u,goalNear(target,reach-0.3),target.cx,target.cy,9000);
    if(!r.ok){if(u.owner===0)msg('No valid trade route to that destination','warn');setCmd(u,'idle');return}}
  if(u.path){const fin=stepPath(u,dt,spdMul);if(fin)u.path=null}
}
// ----- boarding / unloading -----
function boardAI(u,dt){
  const s=byId(u.tgt);const p=G.players[u.owner];
  if(!s||!s.cargo||!isFriend(u.owner,s.owner)){setCmd(u,'idle');return}
  const cap=s.def.tcap+p.f.tcap;
  // a friendly Dock next to the ship works as a boarding pier
  let dock=null;for(const b of G.blds)if(!b.dead&&b.built&&b.def.dock&&isFriend(u.owner,b.owner)&&rectDist(s.x,s.y,b)<=3.2){dock=b;break}
  const doBoard=()=>{if(s.cargo.length>=cap){if(u.owner===0)msg('Transport is full','warn');setCmd(u,'idle');return}
    s.cargo.push(u.id);u.inside=s.id;u.path=null;setCmd(u,'idle');u.t='idle';sfxAt('click',s.x,s.y,{vol:.2})};
  if(hyp(s.x-u.x,s.y-u.y)<=3.3){doBoard();return}
  if(dock){
    if(rectDist(u.x,u.y,dock)<=1.5){doBoard();return}
    const r=approach(u,dock,0.8,1.4,dt);if(r==='stuck'){if(u.owner===0)msg('Cannot reach the dock/ship','warn');setCmd(u,'idle')}return}
  const r=approach(u,s,3.0,3.2,dt);if(r==='stuck'){if(u.owner===0)msg('Cannot reach the ship – move it closer to a shore','warn');setCmd(u,'idle')}
}
function landTilesNear(x,y,r,pref,used){
  const out=[];
  for(let ty=Math.floor(y-r);ty<=Math.ceil(y+r);ty++)for(let tx=Math.floor(x-r);tx<=Math.ceil(x+r);tx++){
    if(tx<0||ty<0||tx>=G.W||ty>=G.H)continue;const k=ty*G.W+tx;if(G.terr[k]>=3||G.occ[k]||(used&&used.has(k)))continue;
    const d=hyp(tx+.5-x,ty+.5-y);if(d>r)continue;
    out.push([d*0.5+(pref?hyp(tx+.5-pref.x,ty+.5-pref.y):0),tx+.5,ty+.5,k]);
  }
  out.sort((a,b)=>a[0]-b[0]);return out;
}
function unloadShip(s,pref){
  if(!s.cargo||!s.cargo.length)return 0;
  const used=new Set();let n=0;
  const tiles=landTilesNear(s.x,s.y,6.5,pref,used);
  if(!tiles.length){if(s.owner===0)msg('No valid shore to unload here – sail next to land','warn');return 0}
  let ti=0;
  for(const id of s.cargo.slice()){const u=G.byId.get(id);if(!u||u.dead){s.cargo.splice(s.cargo.indexOf(id),1);continue}
    while(ti<tiles.length&&used.has(tiles[ti][3]))ti++;if(ti>=tiles.length)break;
    const t=tiles[ti];used.add(t[3]);u.inside=0;u.x=t[1];u.y=t[2];u.z=hAt(u.x,u.y);u.path=null;setCmd(u,'idle');s.cargo.splice(s.cargo.indexOf(id),1);n++}
  if(n){sfxAt('splash',s.x,s.y,{vol:.5});fx('splash',s.x,s.y)}
  return n;
}
function unloadAtAI(u,dt){
  if(!u.dock){ // choose water tile adjacent to the target land
    let best=null,bs=1e9;const tx=u.tx,ty=u.ty;
    for(let y=Math.floor(ty)-4;y<=Math.floor(ty)+4;y++)for(let x=Math.floor(tx)-4;x<=Math.floor(tx)+4;x++){
      if(x<0||y<0||x>=G.W||y>=G.H||G.terr[y*G.W+x]<3)continue;
      let hasLand=false;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const X=x+i,Y=y+j;if(X>=0&&Y>=0&&X<G.W&&Y<G.H&&G.terr[Y*G.W+X]<3&&!G.occ[Y*G.W+X])hasLand=true}
      if(!hasLand)continue;const s=hyp(x+.5-tx,y+.5-ty)+hyp(x+.5-u.x,y+.5-u.y)*0.02;if(s<bs){bs=s;best=[x+.5,y+.5]}}
    if(!best){if(u.owner===0)msg('No valid unloading shore there','warn');setCmd(u,'idle');return}
    u.dock=best;u.gs='go';u.mx=best[0];u.my=best[1];moveToPoint(u,best[0],best[1]);
  }
  if(!u.path&&(u.needRepath||u.gs==='go')){if(hyp(u.x-u.dock[0],u.y-u.dock[1])>0.6){u.needRepath=false;if(G.pfBudget>0)moveToPoint(u,u.dock[0],u.dock[1])}}
  if(u.path){const fin=stepPath(u,dt);if(!fin)return}
  if(hyp(u.x-u.dock[0],u.y-u.dock[1])<1.2||!u.path){unloadShip(u,{x:u.tx,y:u.ty});u.dock=null;setCmd(u,'idle')}
}
// ----- animals -----
function stepDirect(u,tx,ty,dt,mul){
  const dx=tx-u.x,dy=ty-u.y,d=hyp(dx,dy);if(d<0.05)return true;
  const s=Math.min(d,sget(u,'spd')*(mul||1)*dt),nx=u.x+dx/d*s,ny=u.y+dy/d*s;
  const px=Math.floor(nx),py=Math.floor(ny);
  if(tilePass(px,py,-1,false,false)!==1||Math.abs(G.hgt[py*G.W+px]-G.hgt[tIdx(u.x,u.y)])>=2)return null;
  u.x=nx;u.y=ny;u.fx=dx/d;u.fy=dy/d;u.moving=true;return false;
}
function animalAI(u,dt){
  const d=u.def;
  if(u.t==='move'){
    if(u.needRepath||(!u.path&&G.pfBudget>0)){u.needRepath=false;moveToPoint(u,u.mx,u.my)}
    if(u.path&&stepPath(u,dt)){u.path=null;u.t='idle'}return}
  if(u.t==='attack'){
    const pred=d.cls.includes('predator');
    if(pred&&hyp(u.x-u.home.x,u.y-u.home.y)>20){setCmd(u,'idle');return}
    if(u.hateT>0)u.hateT-=dt;
    attackAI(u,dt);u.lastFight=G.time;
    if(u.t!=='attack'){u.wander=1}return}
  u.acq-=dt;
  if(d.cls.includes('predator')&&u.acq<=0){
    u.acq=0.6;let best=null,bs=1e9;
    near(u.x,u.y,5.5,e=>{if(e.kind!=='u'||e.def.animal||e.owner<0||isShip(e)||e.inside)return false;const s=hyp(e.x-u.x,e.y-u.y)-(e.def.k==='villager'?1.5:0);if(s<bs){bs=s;best=e}});
    if(best&&hyp(u.x-u.home.x,u.y-u.home.y)<18){setCmd(u,'attack',best);sfxAt('wolf',u.x,u.y,{vol:.4});return}
  }
  if(d.cls.includes('prey')){
    if(u.calm>0)u.calm-=dt;
    if(u.acq<=0){u.acq=0.4;let thr=null;if(!(u.calm>0)||u.hit>0)near(u.x,u.y,3.6,e=>{if(e.kind==='u'&&!e.def.animal&&e.owner>=0&&!isShip(e)&&e.hp>0){thr=e;return true}});
      if(thr&&!(u.flee>0)){u.flee=1.6;u.fdx=u.x-thr.x;u.fdy=u.y-thr.y}}
    if(u.flee>0){u.flee-=dt;if(u.flee<=0)u.calm=2.2;const fl=hyp(u.fdx||1,u.fdy||0)||1;let r=stepDirect(u,u.x+(u.fdx||1)/fl*2,u.y+(u.fdy||0)/fl*2,dt,u.hit>0?0.28:0.42);
      if(r===null){u.fdx=(Math.random()-.5)*2;u.fdy=(Math.random()-.5)*2}return}
  }
  // wander
  if(u.owner>=0&&!d.cls.includes('prey')&&u.wander===undefined){}
  u.wait=(u.wait||0)-dt;
  if(u.wtx!==undefined){const r=stepDirect(u,u.wtx,u.wty,dt,0.35);if(r!==false){u.wtx=undefined;u.wait=rnd(1,5)}}
  else if(u.wait<=0){const a=Math.random()*6.28,r=rnd(1.5,4);let tx=u.x+Math.cos(a)*r,ty=u.y+Math.sin(a)*r;
    if(hyp(tx-u.home.x,ty-u.home.y)<8){const px=Math.floor(tx),py=Math.floor(ty);if(tilePass(px,py,-1,false)===1&&Math.abs(G.hgt[py*G.W+px]-hAt(u.x,u.y))<2){u.wtx=tx;u.wty=ty}}u.wait=rnd(0.5,2)}
  if(u.owner<0&&d.k==='sheep'){}
}
function updateSheep(){
  for(const u of G.units){
    if(u.dead||u.def.k!=='sheep'||u.inside)continue;
    if((u.lockT||0)>G.time)continue;
    const dm={};
    near(u.x,u.y,GUARD_R,e=>{if(e.owner<0||e.def.animal||(e.kind==='u'&&isShip(e)))return false;const d=rectDist(u.x,u.y,e);if(d<=GUARD_R&&(dm[e.owner]===undefined||d<dm[e.owner]))dm[e.owner]=d},3);
    let capt=-1,bd=1e9;
    if(u.owner<0){for(const o in dm){if(dm[o]<bd){bd=dm[o];capt=+o}}}
    else{
      let guarded=false;for(const o in dm){if(isFriend(u.owner,+o)){guarded=true;break}}
      if(!guarded)for(const o in dm){if(dm[o]<=CAPT_R&&dm[o]<bd&&!isFriend(u.owner,+o)){bd=dm[o];capt=+o}}
    }
    if(capt>=0&&capt!==u.owner)captureSheep(u,capt);
  }
}
function captureSheep(u,o){
  const old=u.owner;
  u.owner=o;u.lockT=G.time+4;u.t='idle';u.path=null;u.capFlash=1.2;
  fx('capture',u.x,u.y,{c:G.players[o].color});sfxAt('sheep',u.x,u.y,{vol:.5});
  if(o===0)msg(old<0?'You found a sheep!':'You captured a sheep from '+G.players[old].name+'!','good',u.x,u.y);
  else if(old===0)msg(G.players[o].name+' captured your sheep!','warn',u.x,u.y);
}

// ---------- smart orders (right-click / AI) ----------
function smartOrder(u,tgt,x,y){
  const d=u.def,p=G.players[u.owner];
  if(u.inside)return'';
  if(!tgt){
    orderMove(u,x,y);return'move';
  }
  if(tgt.kind==='r'){
    if(tgt.type==='relic'){if(d.k==='monk'&&!u.relicCarry){setCmd(u,'relic',tgt);return'gather'}orderMove(u,tgt.x+.5,tgt.y+.5);return'move'}
    if(resGatherable(u,tgt)){orderGather(u,tgt);return tgt.type==='fish'?'gather':'gather'}
    orderMove(u,tgt.x+.5,tgt.y+.5);return'move';
  }
  if(tgt.kind==='u'){
    if(tgt.def.animal){
      if(d.k==='villager'||(isMil(u)&&!isShip(u))){
        if(d.k==='villager'){setCmd(u,'gather',tgt);u.gs='kill';u.gres='f';u.lastRes={x:Math.floor(tgt.x),y:Math.floor(tgt.y),type:'carcass'};return'gather'}
        orderAttack(u,tgt);return'attack'}
      orderMove(u,tgt.x,tgt.y);return'move'}
    if(isEnemy(u.owner,tgt.owner)){
      if(d.k==='monk'){if(canConvert(u,tgt)){setCmd(u,'convert',tgt);return'attack'}orderMove(u,tgt.x,tgt.y);return'move'}
      if(orderAttack(u,tgt))return'attack';orderMove(u,tgt.x,tgt.y);return'move'}
    if(isFriend(u.owner,tgt.owner)){
      if(tgt.cargo&&!isShip(u)&&!u.def.animal&&tgt.owner===u.owner){setCmd(u,'board',tgt);return'move'}
      if(d.k==='monk'&&tgt.hp<tgt.mh&&!tgt.def.cls.includes('siege')&&!isShip(tgt)){setCmd(u,'heal',tgt);return'heal'}
      if(d.k==='villager'&&tgt.hp<tgt.mh&&(tgt.def.cls.includes('siege')||isShip(tgt))){orderRepair(u,tgt);return'repair'}
    }
    orderMove(u,tgt.x,tgt.y);return'move';
  }
  if(tgt.kind==='b'){
    if(isEnemy(u.owner,tgt.owner)){if(orderAttack(u,tgt))return'attack';orderMove(u,tgt.cx,tgt.cy);return'move'}
    if(isFriend(u.owner,tgt.owner)){
      if(d.k==='villager'){
        if(!tgt.built&&tgt.owner===u.owner){orderBuild(u,tgt);return'build'}
        if(tgt.farm&&tgt.owner===u.owner){orderGather(u,tgt);return'gather'}
        if(tgt.hp<tgt.mh&&tgt.built){orderRepair(u,tgt);return'repair'}
      }
      if(d.k==='monk'&&tgt.type==='monastery'&&u.relicCarry&&tgt.owner===u.owner){setCmd(u,'relic',tgt);u.gs='deposit';return'gather'}
      if(d.k==='monk'&&tgt.hp<tgt.mh&&false){}
      if(d.k==='tradecart'&&tgt.type==='market'&&tgt.built&&startTrade(u,tgt))return'trade';
      if(d.k==='tradecog'&&tgt.type==='dock'&&tgt.built&&startTrade(u,tgt))return'trade';
      if(canGarrison(u,tgt)){orderGarrison(u,tgt);return'garrison'}
      if(isMil(u)&&tgt.hp<tgt.mh&&false){}
    }
    orderMove(u,tgt.cx,tgt.cy+tgt.sz/2+0.8);return'move';
  }
  orderMove(u,x,y);return'move';
}
function startTrade(u,dest){
  const home=byId(u.home);if(!home){if(u.owner===0)msg('This unit has no home '+(isShip(u)?'Dock':'Market'),'warn');return false}
  if(home===dest){if(u.owner===0)msg('Choose a different '+(isShip(u)?'Dock':'Market')+' as destination','warn');return false}
  if(hyp(home.cx-dest.cx,home.cy-dest.cy)<10){if(u.owner===0)msg('Destination is too close for profitable trade','warn');return false}
  setCmd(u,'trade',dest);u.gs='out';u.needRepath=true;return true;
}
function applyRally(b,u){
  const r=b.rally;if(!r)return;
  const e=r.tgt?byId(r.tgt):null;
  if(e)smartOrder(u,e,r.x,r.y);else if(u.def.k!=='cobra')orderMove(u,r.x,r.y);
}
// ---------- production & techs ----------
function bcount(p,type){let n=0;for(const b of G.blds)if(!b.dead&&b.built&&b.owner===p.id&&b.type===type)n++;return n}
function hasB(p,type){for(const b of G.blds)if(!b.dead&&b.built&&b.owner===p.id&&b.type===type)return true;return false}
function canAfford(p,c){for(const k of RK)if((c[k]||0)>p.res[k])return false;return true}
function pay(p,c){for(const k of RK)p.res[k]-=c[k]||0}
function refund(p,c){for(const k of RK)p.res[k]+=c[k]||0}
function missingText(p,c){const m=[];for(const k of RK)if((c[k]||0)>p.res[k])m.push('Not enough '+RN[k]+' (need '+(c[k]-Math.floor(p.res[k]))+' more)');return m}
function trainReq(p,b,line){
  const out=[];const t=curUnit(p,line);const need=lineAge(line);
  if(p.age<need)out.push('Requires '+AGES[need]);
  return out;
}
function trainTime(p,b,type){
  let t=U[type].t;
  const f=p.f.train[b.type];if(f)t*=f;
  if(p.civ==='goths'&&b.type==='barracks')t*=.75;
  if(p.shipTrain&&b.type==='dock')t*=p.shipTrain;
  if(G.cheats.aegis&&p.id===0)t=0.2;
  return t;
}
function queueTrain(b,line,free){
  const p=G.players[b.owner];
  if(!b.built||b.dead)return'Building not complete';
  if(b.queue.length>=8)return'Queue is full';
  const req=trainReq(p,b,line);if(req.length)return req[0];
  const type=curUnit(p,line),cost=unitCost(p,type);
  if(!free&&!canAfford(p,cost))return missingText(p,cost)[0];
  if(!free)pay(p,cost);
  b.queue.push({k:'u',line,type,prog:0,tot:trainTime(p,b,type),cost:free?C():cost});
  return'';
}
function techReq(p,b,k){
  const t=techDef(p,k),out=[];
  if(p.techs.has(k)){out.push('Already researched');return out}
  for(const bb of G.blds)if(!bb.dead&&bb.owner===p.id&&bb.queue.some(q=>q.k==='t'&&q.key===k)){out.push('Already being researched');return out}
  if(t.age_up){
    if(p.age!==t.age)out.push(p.age>t.age?'Already reached':'Requires '+AGES[t.age]);
    for(const bb of G.blds)if(!bb.dead&&bb.owner===p.id&&bb.queue.some(q=>q.k==='t'&&T[q.key]&&T[q.key].age_up))out.push('Already advancing to the next age');
    let n=0;const seen=new Set();for(const bk of t.need){if(hasB(p,bk)&&!seen.has(bk)){seen.add(bk);n++}}
    if(n<t.needN)out.push('Requires '+t.needN+' different '+AGES[t.age]+' buildings ('+t.need.map(x=>B[x].n).join(', ')+') – you have '+n);
    return out;
  }
  if(p.age<t.age)out.push('Requires '+AGES[t.age]);
  if(t.req&&!p.techs.has(t.req))out.push('Requires '+T[t.req].n);
  return out;
}
function queueTech(b,k,free){
  const p=G.players[b.owner];if(!b.built||b.dead)return'Building not complete';
  if(b.queue.length>=8)return'Queue is full';
  const req=techReq(p,b,k);if(req.length)return req[0];
  const cost=techCost(p,k);if(!free&&!canAfford(p,cost))return missingText(p,cost)[0];
  if(!free)pay(p,cost);
  let tt=T[k].t;if(G.cheats.aegis&&p.id===0)tt=0.2;
  b.queue.push({k:'t',key:k,prog:0,tot:tt,cost:free?C():cost});return'';
}
function cancelQueue(b,i){
  const q=b.queue[i];if(!q)return;const p=G.players[b.owner];refund(p,q.cost);b.queue.splice(i,1);
}
function applyTech(p,k,silent){
  const t=techDef(p,k);if(!t)return;p.techs.add(k);
  if(t.age_up){p.age=t.age_up;if(!silent){if(p.id===0){msg('You have advanced to the '+AGES[p.age]+'!','good');sfxAt('ageup',p.start.x,p.start.y,{vol:1})}else msg(p.name+' advanced to the '+AGES[p.age],'info')}
    for(const b of G.blds)if(b.owner===p.id&&!b.dead)b.flash=1}
  if(t.m)for(const[c,s,v]of t.m)modAdd(p,c,s,v);
  if(t.eco)for(const e in t.eco)p.gm[e]+=t.eco[e];
  if(t.carry)p.f.carry+=t.carry;if(t.buildSpd)p.f.buildSpd+=t.buildSpd;if(t.tradeSpd)p.f.tradeSpd=t.tradeSpd-1;
  if(t.fee)p.f.fee+=t.fee;if(t.heal)p.f.heal*=t.heal;if(t.convRng)p.f.convRng+=t.convRng;if(t.convCd)p.f.convCd*=t.convCd;
  if(t.redeem)p.f.redeem=1;if(t.atone)p.f.atone=1;if(t.tcap)p.f.tcap+=t.tcap;if(t.minr0)p.f.minr0=1;
  if(t.train)for(const b in t.train)p.f.train[b]=(p.f.train[b]||1)*t.train[b];
  if(t.uniq){const u=t.uniq;if(u.m)for(const[c,s,v]of u.m)modAdd(p,c,s,v);if(u.train)for(const b in u.train)p.f.train[b]=(p.f.train[b]||1)*u.train[b];if(u.bonInf)p.chief=1;if(u.regen)p.regenU=1}
  if(t.up){const[line,lv]=t.up;p.lv[line]=Math.max(p.lv[line]||0,lv);
    for(const u of G.units)if(!u.dead&&u.owner===p.id&&u.def.line===line&&u.def.lv<lv){const nt=LINES[line][lv];if(nt)morphUnit(u,nt)}}
  if(k==='madrasah'||p.civd.ut==='madrasah'&&k==='uniq')p.f.madr=1;
  refreshHp(p);
}
function morphUnit(u,type){const old=u.mh;u.type=type;u.def=U[type];const m=maxHp(u);u.hp=clamp(u.hp+(m-old),1,m);u.mh=m;fx('heal',u.x,u.y,{})}
function updateBuildings(dt){
  for(const b of G.blds){
    if(b.dead)continue;
    b.bnPrev=b.bn;b.bn=0;
    if(b.hit>0)b.hit-=dt;if(b.flash>0)b.flash-=dt;if(b.repairing>0)b.repairing-=dt;
    const p=G.players[b.owner];
    if(!b.built){constructTick(b,dt);continue}
    // production
    if(b.queue.length){
      const q=b.queue[0];
      if(q.prog<q.tot)q.prog+=dt;
      if(q.prog>=q.tot){
        if(q.k==='t'){applyTech(p,q.key);b.queue.shift();if(p.id===0&&!T[q.key].age_up)msg(techDef(p,q.key).n+' researched','good');}
        else{
          if(p.pop>=p.popCap){b.stalled=true;if(p.id===0&&G.time-(G._popMsg||-99)>15){G._popMsg=G.time;msg('Population limit reached – build more Houses','warn')}}
          else{b.stalled=false;const ship=U[q.type].cls.includes('ship');const nt=curUnit(p,q.line);const ex=exitPoint(b,ship,b.rally);
            if(ex){const u=mkUnit(nt,b.owner,ex.x,ex.y);if(u){u.home=(u.def.k==='tradecart'||u.def.k==='tradecog')?b.id:0;b.queue.shift();recalcPlayer(p);
              if(b.rally)applyRally(b,u);
              if(b.owner===0&&G.onTrained)G.onTrained(u)}}}
        }
      }
    }
    // relic income
    if(b.relics>0){const g=b.relics*0.5*dt;p.res.g+=g;p.stats.relicGold+=g}
    // garrison healing & defence
    if(b.gar.length){for(const id of b.gar){const u=G.byId.get(id);if(u&&!u.dead&&u.hp<u.mh)u.hp=Math.min(u.mh,u.hp+1.5*dt)}}
    if(b.def.atk)fireBuilding(b,dt);
    if(b.farm&&b.farm.gatherer){const g=byId(b.farm.gatherer);if(!g||g.t!=='gather'||g.tgt!==b.id)b.farm.gatherer=0}
  }
}
function fireBuilding(b,dt){
  b.fireCd-=dt;if(b.fireCd>0)return;
  const a=b.def.atk,p=G.players[b.owner];
  let n=a.base;
  for(const id of b.gar){const u=G.byId.get(id);if(u&&!u.dead&&(u.def.cls.includes('inf')||u.def.cls.includes('arc')||u.def.cls.includes('vil')||u.def.cls.includes('skirm')))n++}
  if(p.civ==='teutons'&&b.type==='towncenter')n+=2;if(p.f.minr0&&b.type==='tower')n++;
  if(p.civd.ut==='yasama'&&p.techs.has('uniq')&&b.type==='tower')n++;
  n=Math.min(n,22);
  const rng=a.rng+(sget(b,'rng')-0)+0+(hAt(b.cx,b.cy)>1?1:0);
  const targets=[];
  near(b.cx,b.cy,rng,e=>{if(e.kind!=='u'||e.def.animal&&!(e.owner>=0)||!isEnemy(b.owner,e.owner)&&!(e.def.cls.includes('predator')&&false))return false;
    if(e.def.k==='ram'&&false)return false;const d=rectDist(b.cx,b.cy,e)-b.sz/2;if(d<=rng)targets.push(e)},3);
  if(!targets.length){b.fireCd=0.5;return}
  b.fireCd=a.rof;
  targets.sort((x,y)=>hyp(x.x-b.cx,x.y-b.cy)-hyp(y.x-b.cx,y.y-b.cy));
  const base=a.d+sget(b,'atk')-(B[b.type].atk?0:0)+0;
  for(let i=0;i<n;i++){
    const t=targets[i%Math.min(targets.length,4)];
    const dmg=calcDamage(b,t,a.d+(p.mods.bld?(p.mods.bld.atk||0):0)+(p.mods[b.type]?(p.mods[b.type].atk||0):0));
    G.proj.push({type:'arrow',x0:b.cx+(Math.random()-.5)*b.sz*.4,y0:b.cy+(Math.random()-.5)*b.sz*.4,z0:b.sz*0.9+hAt(b.cx,b.cy),x1:t.x,y1:t.y,tgt:t.id,att:b.id,aid:b.id,owner:b.owner,t:-i*0.08,dur:Math.max(.2,hyp(t.x-b.cx,t.y-b.cy)/11),dmg,splash:0});
  }
  sfxAt('arrow',b.cx,b.cy,{vol:.4});
}
// ---------- placement ----------
function canBuildType(p,type){
  const d=B[type],out=[];
  if(p.age<d.age)out.push('Requires '+AGES[d.age]);
  for(const r of d.req)if(!hasB(p,r))out.push('Requires '+B[r].n);
  return out;
}
function canPlace(p,type,x,y){
  const why=canBuildType(p,type);if(why.length)return why[0];
  const d=B[type];
  const cost=d.cost;if(!canAfford(p,effCost(p,type)))return missingText(p,effCost(p,type))[0];
  return footprintOK(type,x,y,p.id);
}
function effCost(p,type){
  const d=B[type],c=Object.assign({},d.cost);
  if(p.civ==='britons'&&type==='towncenter'&&p.age>=2)c.w=Math.round(c.w*.5);
  if(p.civ==='franks'&&type==='castle')c.s=Math.round(c.s*.75);
  if(p.civ==='japanese'&&(type==='mill'||type==='lumber'||type==='mining'))c.w=Math.round(c.w*.5);
  return c;
}
function placeBuilding(p,type,x,y,builders){
  const why=canPlace(p,type,x,y);if(why)return{err:why};
  pay(p,effCost(p,type));
  const b=mkBld(type,p.id,x,y,false);
  if(G.cheats.aegis&&p.id===0){b.prog=1;completeBuilding(b)}
  if(builders)for(const u of builders)if(u.def.k==='villager')orderBuild(u,b);
  if(p.id===0)sfxAt('hammer',b.cx,b.cy,{vol:.4});
  return{b};
}
function deleteEntity(e){
  if(e.dead)return;
  if(e.kind==='b'){const p=G.players[e.owner];if(!e.built){refund(p,B[e.type].cost)}for(const q of e.queue)refund(p,q.cost)}
  killEnt(e,null);
}
// ---------- vision ----------
function initVision(){const n=G.W*G.H;G.visNow=new Uint8Array(n);for(const p of G.players)p.exp=new Uint8Array(n)}
function updateVision(force){
  const W=G.W,Hh=G.H,v=G.visNow;v.fill(0);const me=G.players[0],exp=me.exp;
  const mark=(cx,cy,r,h)=>{
    r=Math.ceil(r);const rr=r*r;
    for(let y=Math.max(0,Math.floor(cy)-r);y<=Math.min(Hh-1,Math.floor(cy)+r);y++)for(let x=Math.max(0,Math.floor(cx)-r);x<=Math.min(W-1,Math.floor(cx)+r);x++){
      if((x+.5-cx)**2+(y+.5-cy)**2<=rr){const i=y*W+x;v[i]=2;exp[i]=1}}
  };
  for(const e of G.units){if(e.dead||e.owner<0||!isFriend(0,e.owner))continue;if(e.inside)continue;mark(e.x,e.y,sget(e,'los')+(hAt(e.x,e.y)>=2?1:0))}
  for(const b of G.blds){if(b.dead||!isFriend(0,b.owner))continue;mark(b.cx,b.cy,b.def.los+(b.built?0:-2)+(G.players[b.owner].mods.bld?(G.players[b.owner].mods.bld.los||0):0))}
  if(G.cheats.polo||G.settings.visibility==='all'){v.fill(2);exp.fill(1)}
}
function seenTile(tx,ty){return G.cheats.polo||G.visNow[ty*G.W+tx]===2}
function exploredTile(tx,ty){return G.players[0].exp[ty*G.W+tx]>0}
// ---------- regions ----------
function computeRegions(){
  const W=G.W,Hh=G.H;const reg=new Int16Array(W*Hh);let n=0;
  for(let i=0;i<W*Hh;i++){if(reg[i]||G.terr[i]>=3)continue;n++;const q=[i];reg[i]=n;
    for(let h=0;h<q.length;h++){const c=q[h],x=c%W,y=(c/W)|0;
      for(let d=0;d<4;d++){const X=x+DX8[d],Y=y+DY8[d];if(X<0||Y<0||X>=W||Y>=Hh)continue;const j=Y*W+X;if(reg[j]||G.terr[j]>=3||Math.abs(G.hgt[j]-G.hgt[c])>=2)continue;reg[j]=n;q.push(j)}}}
  G.region=reg;G.nRegions=n;
}
function regionAt(x,y){return G.region[tIdx(x,y)]}
// ---------- diplomacy ----------
function setRel(a,b,r){G.dip[a][b]=r;G.dip[b][a]=r}
function relName(a,b){const r=G.dip[a][b];return r==='enemy'?'Enemy':r==='ally'?'Ally':'Peace'}
function declareWar(a,b){
  if(G.dip[a][b]==='enemy')return;
  // allies' relations: leaving alliance
  setRel(a,b,'enemy');G.players[b].attitude[a]=-10;G.players[a].attitude[b]=-5;G.players[b].lastHit[a]=G.time;
  msg(G.players[a].name+' declared war on '+G.players[b].name+'!','warn');
  // units of each side stop co-existing: stop garrisons of foreign units not needed
  for(const e of G.units)if(!e.dead&&(e.t==='trade'||e.t==='heal'))e.needRepath=true;
}
function proposeDip(from,to,kind){
  const T2=G.players[to],F=G.players[from];
  if(!T2.ai)return{ok:false,text:'Only computer players answer proposals'};
  const cur=G.dip[from][to];const att=T2.attitude[from]||0;
  const recent=G.time-(T2.lastHit[from]||-999);
  const myPow=milPower(T2),yrPow=milPower(F);
  if(kind==='peace'){
    if(cur!=='enemy')return{ok:false,text:'Already at peace or allied'};
    if(recent<90)return{ok:false,text:T2.name+' refuses: "You attacked us only moments ago!"'};
    if(att<(T2.diff>=2?3:0))return{ok:false,text:T2.name+' refuses: "We do not trust you." (attitude '+att.toFixed(0)+'; a gift of resources would help)'};
    if(myPow>yrPow*1.8&&att<8)return{ok:false,text:T2.name+' refuses: "We are stronger – prepare to fight!"'};
    setRel(from,to,'peace');T2.attitude[from]=att;T2.peaceSince=G.time;
    return{ok:true,text:T2.name+' accepts your peace offer.'};
  }
  if(kind==='ally'){
    if(cur==='ally')return{ok:false,text:'Already allied'};
    if(cur==='enemy')return{ok:false,text:'Make peace first'};
    if(G.time-(T2.peaceSince||0)<40)return{ok:false,text:T2.name+' wants the peace to last longer first.'};
    if(att<12)return{ok:false,text:T2.name+' declines the alliance. Send tribute to improve relations (attitude '+att.toFixed(0)+'/12).'};
    // refuse if ally is at war with someone T2 allied
    setRel(from,to,'ally');
    return{ok:true,text:T2.name+' accepts the alliance!'};
  }
  return{ok:false,text:'?'};
}
function milPower(p){let s=0;for(const u of G.units)if(!u.dead&&u.owner===p.id&&isMil(u))s+=u.def.cost.f+u.def.cost.w+u.def.cost.g;return s/60}
function tribute(from,to,res,amt){
  const F=G.players[from],T2=G.players[to];if(F.res[res]<amt)return{ok:false,text:'Not enough '+RN[res]};
  const fee=0.2;F.res[res]-=amt;const got=Math.floor(amt*(1-fee));T2.res[res]+=got;T2.attitude[from]=(T2.attitude[from]||0)+got/40;
  return{ok:true,text:'Sent '+amt+' '+RN[res]+' to '+T2.name+' ('+got+' received after '+Math.round(fee*100)+'% fee)'};
}
function marketFee(p){return clamp(0.3+(p.f.fee||0),0.03,0.6)}
function marketTrade(p,res,buy){
  const pr=p.prices[res],fee=marketFee(p);
  if(buy){const cost=Math.round(100*pr/100*(1+fee));if(p.res.g<cost)return'Not enough Gold';p.res.g-=cost;p.res[res]+=100;p.prices[res]=Math.min(200,pr+3);return''}
  if(p.res[res]<100)return'Not enough '+RN[res];p.res[res]-=100;p.res.g+=Math.round(100*(2*100-pr)/100*(1-fee)/1);p.prices[res]=Math.max(20,pr-3);return'';
}
// ---------- cheats ----------
function runCheat(raw){
  const code=raw.toLowerCase().replace(/[’`]/g,"'").replace(/\s+/g,' ').trim();
  const p=G.players[0];
  const cheats={
    "cheese steak jimmy's":()=>{p.res.f+=10000;return'+10,000 food'},
    'lumberjack':()=>{p.res.w+=10000;return'+10,000 wood'},
    'robin hood':()=>{p.res.g+=10000;return'+10,000 gold'},
    'rock on':()=>{p.res.s+=10000;return'+10,000 stone'},
    'marco':()=>{G.players[0].exp.fill(1);G.cheats.marco=true;return'Map revealed'},
    'polo':()=>{G.cheats.polo=!G.cheats.polo;if(!G.cheats.polo&&G.settings.visibility==='all')G.cheats.polo=false;return G.cheats.polo?'Fog of war removed':'Fog of war restored'},
    'aegis':()=>{G.cheats.aegis=!G.cheats.aegis;return G.cheats.aegis?'Instant construction, training and research ON':'Instant construction, training and research OFF'},
    'how do you turn this on':()=>{const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter'&&!b.dead)||G.blds.find(b=>b.owner===0&&!b.dead);
      const cx=tc?tc.cx:p.start.x,cy=tc?tc.cy:p.start.y;const q=freeNear(cx,cy,(tc?tc.sz/2:2)+1.5,9);if(!q)return null;
      const c=mkUnit('cobra',0,q.x,q.y);fx('boom',q.x,q.y,{r:1.2,life:.6,small:true});G.lastCobra=c;return'A Cobra Car has appeared!'}
  };
  if(!cheats[code])return{kind:'chat',text:raw};
  if(!G.cheats.allowed)return{kind:'cheat',ok:false,text:'Cheats are disabled for this game (enable "Allow cheats" in setup)'};
  const r=cheats[code]();if(r===null)return{kind:'cheat',ok:false,text:'No room to spawn'};
  updateVision(true);
  return{kind:'cheat',ok:true,text:'Cheat activated: '+r,code};
}
// ---------- main step ----------
function stepGame(dtReal){
  if(G.paused||G.over&&G.over.stop)return;
  let dt=dtReal*G.speed;
  while(dt>0){const h=Math.min(dt,0.1);dt-=h;tick(h)}
}
function tick(dt){
  G.time+=dt;G.tickN++;G.pfBudget=30;
  buildGrid();
  updateUnits(dt);
  updateBuildings(dt);
  updateProj(dt);
  G.t05=(G.t05||0)+dt;if(G.t05>=0.5){G.t05=0;updateSheep();for(const p of G.players){if(p.bell&&G.time-p.bellT>150){toggleBell(p);if(p.id===0)msg('Town Bell expired automatically','info')}
    for(const k of['f','w','s']){p.prices[k]+=(100-p.prices[k])*0.02}}}
  G.t025=(G.t025||0)+dt;if(G.t025>=0.25){G.t025=0;updateVision();recalcPlayerAll()}
  // carcass rot / fx
  for(const r of G.ress){if(r.dead)continue;if(r.type==='carcass'){r.amt-=0.25*dt;r.rot=(r.rot||0)+dt;if(r.amt<=0)killRes(r)}if(r.shake>0)r.shake-=dt}
  for(const f of G.fx){f.t+=dt}
  G.fx=G.fx.filter(f=>f.t<(f.life||1));
  for(const u of G.units){if(u.dead&&!u.corpse&&!u.exploded){u.corpse=1;G.decals.push({type:'corpse',x:u.x,y:u.y,z:u.z,t:G.time,ut:u.type,owner:u.owner,fx:u.fx,fy:u.fy,ship:isShip(u)})}}
  if(G.tickN%10===0){
    G.units=G.units.filter(u=>!u.dead);G.blds=G.blds.filter(b=>!b.dead);G.ress=G.ress.filter(r=>!r.dead);
    for(const[id,e]of G.byId)if(e.dead)G.byId.delete(id);
    G.ents=G.ents.filter(e=>!e.dead);
    G.decals=G.decals.filter(d=>d.type==='stump'||(d.type==='rubble'&&G.time-d.t<45)||(d.type==='corpse'&&G.time-d.t<14));
  }
  if(G.onAI)G.onAI(dt);
  G.t1=(G.t1||0)+dt;if(G.t1>=1){G.t1=0;checkEnd();diploAI()}
}
function recalcPlayerAll(){for(const p of G.players)recalcPlayer(p)}
function diploAI(){
  for(const a of G.players){if(!a.ai)continue;for(const b of G.players){if(a===b)continue;
    if(G.dip[a.id][b.id]==='peace'){a.attitude[b.id]=(a.attitude[b.id]||0)+0.05;if((a.attitude[b.id]||0)<-8){declareWar(a.id,b.id)}}
    if(G.dip[a.id][b.id]==='ally'){a.attitude[b.id]=Math.max(a.attitude[b.id]||0,12)}}}
}
function checkEnd(){
  if(G.over||G.noEnd)return;
  for(const p of G.players){
    if(!p.alive)continue;
    let has=false;for(const b of G.blds)if(!b.dead&&b.owner===p.id&&!b.def.wall&&b.built){has=true;break}
    if(!has)for(const u of G.units)if(!u.dead&&u.owner===p.id&&u.def.k==='villager'){has=true;break}
    if(!has){p.alive=false;msg(p.name+' has been defeated!','warn');
      for(const u of G.units)if(!u.dead&&u.owner===p.id){if(u.inside){u.inside=0}killEnt(u,null)}
      for(const b of G.blds)if(!b.dead&&b.owner===p.id)killEnt(b,null);}
  }
  const alive=G.players.filter(p=>p.alive);
  if(!G.players[0].alive){G.over={win:false,text:'Defeat – your civilization has fallen.',stop:false};return}
  let allAllied=true;for(const a of alive)for(const b of alive)if(a!==b&&!isFriend(a.id,b.id))allAllied=false;
  if(allAllied)G.over={win:true,text:alive.length>1?'Victory! You and your allies are the last ones standing.':'Victory! All rivals have been defeated.'};
}
// water regions (for dock placement / naval pathing checks)
function computeWaterRegions(){
  const W=G.W,Hh=G.H;const reg=new Int16Array(W*Hh);const sizes=[0];let n=0;
  for(let i=0;i<W*Hh;i++){if(reg[i]||G.terr[i]<3)continue;n++;let sz=0;const q=[i];reg[i]=n;
    for(let h=0;h<q.length;h++){const c=q[h],x=c%W,y=(c/W)|0;sz++;for(let d=0;d<4;d++){const X=x+DX8[d],Y=y+DY8[d];if(X<0||Y<0||X>=W||Y>=Hh)continue;const j=Y*W+X;if(reg[j]||G.terr[j]<3)continue;reg[j]=n;q.push(j)}}
    sizes.push(sz)}
  G.wreg=reg;G.wsize=sizes;
}
const _cr=computeRegions;computeRegions=function(){_cr();computeWaterRegions()};
