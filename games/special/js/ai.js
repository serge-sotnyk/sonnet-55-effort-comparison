'use strict';
// ===== Computer player =====
const AI_NAMES={britons:'Arthur',franks:'Charlemagne',goths:'Alaric',byzantines:'Belisarius',japanese:'Yoritomo',mongols:'Temujin',vikings:'Ragnar',saracens:'Saladin',teutons:'Barbarossa',chinese:'Wu Zetian'};
const AI_DIFF={ // villager targets by age, first wave time, wave size, wave interval, think interval
  0:{vil:[18,26,32,36],first:660,size:8,interval:240,think:1.4},
  1:{vil:[26,38,48,55],first:480,size:12,interval:180,think:1.0},
  2:{vil:[34,48,60,70],first:380,size:16,interval:140,think:0.8},
  3:{vil:[42,60,75,85],first:300,size:20,interval:110,think:0.6},
};
function aiInit(){
  G.onAI=aiTick;
  for(const p of G.players)if(p.ai){p.A={t:Math.random(),d:AI_DIFF[p.diff]||AI_DIFF[1],wave:0,launched:0,attacking:false,lastWave:0,building:0,bellOff:0,inv:null,nextTrade:0,scoutId:0,needNavy:false,waveAge:0};
    // naval need: any enemy in another land region?
    p.A.needNavy=false;
    for(const q of G.players)if(q!==p&&q.id!==p.id&&isEnemy(p.id,q.id)&&regionAt(p.start.x,p.start.y)!==regionAt(q.start.x,q.start.y))p.A.needNavy=true;
  }
}
function aiTick(dt){
  for(const p of G.players){
    if(!p.ai||!p.alive||!p.A)continue;
    p.A.t-=dt;if(p.A.t>0)continue;p.A.t=p.A.d.think*(0.8+Math.random()*0.4);
    try{aiThink(p)}catch(e){console.error('AI error',e);}
  }
}
function aiSnap(p){
  const S={vils:[],idleVils:[],army:[],idleArmy:[],ships:[],fish:[],trans:[],war:[],monks:[],carts:[],bc:{},bb:{},tc:null,sheep:[],scouts:[]};
  for(const u of G.units){
    if(u.dead||u.owner!==p.id||u.inside&&u.def.k!=='villager')continue;
    const d=u.def;
    if(d.k==='villager'){S.vils.push(u);if(u.t==='idle'&&!u.inside&&!u.bell)S.idleVils.push(u)}
    else if(d.k==='sheep'){S.sheep.push(u)}
    else if(d.k==='monk')S.monks.push(u);
    else if(d.k==='tradecart'||d.k==='tradecog')S.carts.push(u);
    else if(d.k==='fishing')S.fish.push(u);
    else if(d.k==='transport')S.trans.push(u);
    else if(isShip(u)){S.war.push(u)}
    else if(isMil(u)||d.k==='ram'){ if(d.cls.includes('scout')||d.line==='scout')S.scouts.push(u);S.army.push(u);if(u.t==='idle')S.idleArmy.push(u)}
  }
  for(const b of G.blds){if(b.dead||b.owner!==p.id)continue;S.bc[b.type]=(S.bc[b.type]||0)+1;if(b.built)S.bb[b.type]=(S.bb[b.type]||0)+1;else S.building=(S.building||0)+1}
  S.tc=G.blds.find(b=>!b.dead&&b.owner===p.id&&b.type==='towncenter'&&b.built)||G.blds.find(b=>!b.dead&&b.owner===p.id&&b.built)||null;
  return S;
}
function aiThink(p){
  const A=p.A,S=aiSnap(p);if(!S.tc&&!S.vils.length)return;
  const tc=S.tc;if(!tc){return}
  const age=p.age;
  const vilTarget=A.d.vil[age];
  A.vilTarget=vilTarget;
  aiThreat(p,S);
  aiEconomy(p,S);
  aiBuild(p,S);
  aiTrain(p,S);
  aiResearch(p,S);
  aiSheep(p,S);
  aiMonks(p,S);
  aiTrade(p,S);
  aiNavy(p,S);
  aiArmy(p,S);
  // idle ships fish
  for(const f of S.fish)if(f.t==='idle'){const fish=findResNear(f.x,f.y,e=>e.type==='fish'&&!e.dead,30);if(fish)orderGather(f,fish)}
}
// ---- threat / defence ----
function aiThreat(p,S){
  const A=p.A,tc=S.tc;let threat=[];
  for(const e of G.units){
    if(e.dead||e.inside||e.def.animal||!isEnemy(p.id,e.owner)||!isMil(e)&&!e.def.cls.includes('siege')&&!e.def.boom)continue;
    for(const b of G.blds){if(b.dead||b.owner!==p.id||b.def.wall)continue;if(hyp(e.x-b.cx,e.y-b.cy)<13){threat.push(e);break}}
  }
  A.threat=threat;
  if(threat.length){
    A.lastThreat=G.time;
    const cx=threat[0].x,cy=threat[0].y;
    for(const u of S.army)if(u.t==='idle'||(u.t==='amove'&&!u.tgt&&!A.attacking)||(u.t==='move'&&!A.attacking)){orderAttackMove(u,cx,cy)}
    for(const u of S.war)if(u.t==='idle'&&isShip(threat[0])===true)orderAttackMove(u,cx,cy);
    // bell: only for meaningful threats
    const mine=S.army.filter(u=>hyp(u.x-tc.cx,u.y-tc.cy)<16).length;
    if(!p.bell&&threat.length>=3&&threat.length>mine+1&&G.time>(A.bellOff||0)){toggleBell(p);A.bellOn=G.time}
  }
  if(p.bell&&(!A.lastThreat||G.time-A.lastThreat>14||G.time-A.bellOn>60)){toggleBell(p);A.bellOff=G.time+40}
  // military buildings and towers: garrison nothing; repair handled in economy
}
// ---- economy ----
function aiTarget(p,age){
  const t=[[.5,.38,.08,.04],[.45,.3,.17,.08],[.42,.25,.25,.08],[.38,.25,.28,.09]][age];return t;
}
function aiCounts(p,S){
  const c={f:0,w:0,g:0,s:0,build:0,repair:0};
  for(const u of S.vils){
    if(u.t==='gather'){const r=byId(u.tgt);const k=r?(r.kind==='b'?'f':r.res||'f'):(u.gres||'f');c[k]=(c[k]||0)+1}
    else if(u.t==='build'||u.t==='repair')c.build++;
  }
  return c;
}
function aiEconomy(p,S){
  const A=p.A,tc=S.tc;
  const cnt=aiCounts(p,S),n=S.vils.length;
  const share=aiTarget(p,p.age);
  // resource desire: stone need only when castle/ towers planned
  const need={};for(let i=0;i<4;i++){const k=RK[i];need[k]=share[i]*n-cnt[k]}
  if(A.needNavy)need.w+=n*0.1;
  if(p.age<1&&!S.bb.barracks)need.g=Math.min(need.g,0);
  for(const k of RK){const st=p.res[k];if(st>700)need[k]-=(st-700)/250;else if(st<80)need[k]+=2}
  if(p.res.w<150)need.w+=4;
  // rebalance: move a worker from the most over-supplied to the most starved resource
  {let hi='f',lo='f';for(const k of RK){if(need[k]>need[hi])hi=k;if(need[k]<need[lo])lo=k}
   if(need[hi]>2&&need[lo]<-2&&Math.random()<.6){const v=S.vils.find(u=>u.t==='gather'&&!u.inside&&!u.bell&&(()=>{const r=byId(u.tgt);return r&&(r.kind==='b'?'f':r.res)===lo&&!(u.carry&&u.carry.n>3)})());
     if(v&&aiAssign(p,S,v,hi)){need[hi]--;need[lo]++}}}
  // dock/water map without enough wood: nothing special
  for(const v of S.idleVils){
    // repair first
    let rep=null;for(const b of G.blds)if(!b.dead&&b.owner===p.id&&b.built&&b.hp<b.mh*0.75&&hyp(b.cx-v.x,b.cy-v.y)<22&&!b.def.wall){rep=b;break}
    if(rep&&Math.random()<0.5){orderRepair(v,rep);continue}
    // build unfinished building
    let unf=null;for(const b of G.blds)if(!b.dead&&b.owner===p.id&&!b.built&&hyp(b.cx-v.x,b.cy-v.y)<25&&regionAt(b.cx,b.cy)===regionAt(v.x,v.y)){unf=b;break}
    if(unf){orderBuild(v,unf);continue}
    let kind='w',bestNeed=-99;for(const k of RK){if(need[k]>bestNeed){bestNeed=need[k];kind=k}}
    if(!aiAssign(p,S,v,kind)){ if(!aiAssign(p,S,v,'w'))aiAssign(p,S,v,'f') }
    need[kind]-=1;
  }
  // too-few farmers while food starved: rebalance not needed
}
function nearestDropFor(p,res,x,y){
  let best=null,bd=1e9;for(const b of G.blds)if(!b.dead&&b.owner===p.id&&b.built&&b.def.drop.includes(res)&&!b.def.dock){const d=hyp(b.cx-x,b.cy-y);if(d<bd){bd=d;best=b}}
  return{b:best,d:bd};
}
function aiAssign(p,S,v,kind){
  const tc=S.tc,reg=regionAt(v.x,v.y);
  const resNear=(pred,x,y,r)=>{let best=null,bd=r*r;for(const e of G.ress){if(e.dead||!pred(e))continue;if(G.unreach&&G.unreach.get(e.id)>G.time)continue;if(regionAt(e.x,e.y)!==reg)continue;const d=(e.x-x)**2+(e.y-y)**2;if(d<bd){bd=d;best=e}}return best};
  if(kind==='f'){
    // own sheep near TC
    let sh=null,bd=14;for(const s of S.sheep){const d=hyp(s.x-tc.cx,s.y-tc.cy);if(d<bd&&!s.dead){bd=d;sh=s}}
    const slaughterers=S.vils.filter(u=>u.t==='gather'&&u.gs==='kill').length;
    if(sh&&slaughterers<2){smartOrder(v,sh);return true}
    const carc=resNear(e=>e.type==='carcass'&&e.amt>20,tc.cx,tc.cy,18);if(carc){orderGather(v,carc);return true}
    const berr=resNear(e=>e.type==='berries'||e.type==='shrub',tc.cx,tc.cy,18);
    if(berr){
      const dr=nearestDropFor(p,'f',berr.x,berr.y);
      if(dr.d>7&&!S.bc.mill&&p.res.w>=100){if(aiPlaceNear(p,S,'mill',berr.x,berr.y,1,4,v))return true}
      orderGather(v,berr);return true}
    // hunting
    const hunters=S.vils.filter(u=>u.t==='gather'&&u.gs==='kill').length;
    const deer=resNear(e=>false,0,0,0);
    let a=null;let ad=20;for(const e of G.units){if(e.dead||!e.def.animal||e.def.k==='wolf'||e.def.k==='sheep'||e.owner>=0)continue;const d=hyp(e.x-tc.cx,e.y-tc.cy);if(d<ad&&regionAt(e.x,e.y)===reg){ad=d;a=e}}
    if(a&&hunters<3){smartOrder(v,a);return true}
    // farms
    for(const b of S.fb||[]){}
    for(const b of G.blds)if(!b.dead&&b.owner===p.id&&b.farm&&b.built&&(!b.farm.gatherer||!byId(b.farm.gatherer))){orderGather(v,b);return true}
    if(S.bb.mill||S.bb.towncenter){
      if(p.res.w>=60&&(S.bb.mill||false)){const mill=G.blds.find(b=>!b.dead&&b.owner===p.id&&b.type==='mill'&&b.built);if(mill&&aiPlaceNear(p,S,'farm',mill.cx,mill.cy,3,9,v))return true}
      if(!S.bc.mill&&p.res.w>=100){if(aiPlaceNear(p,S,'mill',tc.cx,tc.cy,4,9,v))return true}
    }
    return false;
  }
  if(kind==='w'){
    const tree=resNear(e=>e.res==='w',tc.cx,tc.cy,40);if(!tree)return false;
    const dr=nearestDropFor(p,'w',tree.x,tree.y);
    if(dr.d>7&&p.res.w>=100&&S.building<2&&G.time>(p.A.lastCamp||0)){p.A.lastCamp=G.time+25;if(aiPlaceNear(p,S,'lumber',tree.x,tree.y,1,4,v))return true}
    orderGather(v,tree);return true;
  }
  if(kind==='g'||kind==='s'){
    const t=kind==='g'?'gold':'stone';
    const m=resNear(e=>e.type===t,tc.cx,tc.cy,50);if(!m)return false;
    const dr=nearestDropFor(p,kind,m.x,m.y);
    if(dr.d>7&&p.res.w>=100&&S.building<2&&G.time>(p.A.lastCamp||0)){p.A.lastCamp=G.time+25;if(aiPlaceNear(p,S,'mining',m.x,m.y,1,4,v))return true}
    orderGather(v,m);return true;
  }
  return false;
}
function aiPlaceNear(p,S,type,cx,cy,rmin,rmax,builder,extraBuilders){
  if(!canAfford(p,effCost(p,type))||canBuildType(p,type).length)return false;
  const d=B[type];let best=null;
  const reg=builder?regionAt(builder.x,builder.y):regionAt(S.tc.cx,S.tc.cy);
  const gap=(type==='farm'||type==='house'||type==='mill')?0:1;
  const ex=exitPoint(S.tc,false);const sx0=ex?Math.floor(ex.x):0,sy0=ex?Math.floor(ex.y):0;
  const base=ex?aiReachCount(sx0,sy0,0,0,0):0;let checks=0;const baseSeen=ex?_bfs.seen.slice():null,baseSt=_bfs.stamp;
  for(let r=rmin;r<=rmax;r++){
    for(let k=0;k<r*8+4;k++){
      const a=(k/(r*8+4))*6.283+r;const x=Math.round(cx+Math.cos(a)*r-d.sz/2),y=Math.round(cy+Math.sin(a)*r-d.sz/2);
      if(x<1||y<1||x+d.sz>=G.W-1||y+d.sz>=G.H-1)continue;
      if(regionAt(x+1,y+1)!==reg&&!d.dock)continue;
      if(footprintOK(type,x,y,p.id))continue;
      // keep walkway: not adjacent to TC footprint corners etc.
      if(aiBlocksPath(x,y,d.sz,type))continue;
      if(ex&&!d.dock&&checks++<80){let fp=0;for(let j=0;j<d.sz;j++)for(let i=0;i<d.sz;i++)if(baseSeen[(y+j)*G.W+x+i]===baseSt)fp++;const after=aiReachCount(sx0,sy0,x,y,d.sz);if(after<base-fp)continue}
      best=[x,y];break}
    if(best)break}
  if(!best)return false;
  const res=placeBuilding(p,type,best[0],best[1],builder?[builder].concat(extraBuilders||[]):[]);
  if(res.err)return false;
  return true;
}
const _bfs={stamp:0,seen:null,q:null};
function aiReachCount(sx,sy,bx,by,bsz){
  const W=G.W,H=G.H;if(!_bfs.seen||_bfs.seen.length!==W*H){_bfs.seen=new Int32Array(W*H);_bfs.q=new Int32Array(W*H);_bfs.stamp=0}
  const seen=_bfs.seen,q=_bfs.q,st=++_bfs.stamp;let qh=0,qt=0;
  const blocked=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return true;const i=y*W+x;if(G.terr[i]>=3)return true;if(bsz&&x>=bx&&x<bx+bsz&&y>=by&&y<by+bsz)return true;const id=G.occ[i];if(id){const e=G.byId.get(id);if(e&&!e.dead&&!(e.def&&(e.def.gate||e.def.farm)))return true}return false};
  const s0=sy*W+sx;if(blocked(sx,sy))return 0;seen[s0]=st;q[qt++]=s0;
  while(qh<qt){const i=q[qh++],x=i%W,y=(i/W)|0;
    for(let d=0;d<4;d++){const X=x+DX8[d],Y=y+DY8[d];if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(seen[j]===st||blocked(X,Y)||Math.abs(G.hgt[j]-G.hgt[i])>=2)continue;seen[j]=st;q[qt++]=j}}
  return qt;
}
function aiBlocksPath(x,y,sz,type){
  // avoid sealing: require at least 3 of 4 side-strips mostly free
  let free=0;
  for(let i=0;i<sz;i++){for(const[dx,dy]of[[i,-1],[i,sz],[-1,i],[sz,i]]){const tx=x+dx,ty=y+dy;if(tx<0||ty<0||tx>=G.W||ty>=G.H)continue;const k=ty*G.W+tx;if(G.terr[k]<3&&!G.occ[k])free++}}
  return free<sz*2;
}
// ---- building plan ----
function aiBuild(p,S){
  const A=p.A,tc=S.tc,n=S.vils.length;
  const bc=S.bc;
  const pickH=()=>{let best=null,bd=1e9;for(const v of S.vils){if(v.inside||v.t==='build')continue;const d=hyp(v.x-tc.cx,v.y-tc.cy)+(v.t==='idle'?-5:0);if(d<bd){bd=d;best=v}}return best};
  if(p.popCap<200&&p.pop>=p.popCap-(p.age>=2?6:3)&&!G.blds.some(b=>!b.dead&&b.owner===p.id&&b.type==='house'&&!b.built)&&p.res.w>=30){const v=pickH();if(v&&aiPlaceNear(p,S,'house',tc.cx,tc.cy,5,16,v))return}
  if(S.building>=2)return;
  const pick=()=>{ // choose a builder villager (prefers wood cutters / idle)
    let best=null,bd=1e9;for(const v of S.vils){if(v.inside||v.t==='build')continue;const d=hyp(v.x-tc.cx,v.y-tc.cy);const pen=v.t==='idle'?-5:0;if(d+pen<bd){bd=d+pen;best=v}}return best};
  const place=(type,cx,cy,r0,r1)=>{const v=pick();if(!v)return false;return aiPlaceNear(p,S,type,cx,cy,r0,r1,v)};
  // houses
  const pending=S.vils.length+(S.army.length)*0;
  if(p.popCap<200&&p.pop>=p.popCap-(p.age>=2?6:3)&&!(S.building&&G.blds.some(b=>!b.dead&&b.owner===p.id&&b.type==='house'&&!b.built))){
    if(place('house',tc.cx,tc.cy,5,16))return}
  if(!bc.house&&n>=3){place('house',tc.cx,tc.cy,5,12);return}
  if(!bc.mill&&n>=7&&p.res.w>=100){const bs=findResNear(tc.cx,tc.cy,e=>e.type==='berries',16);if(place('mill',bs?bs.x:tc.cx,bs?bs.y:tc.cy,2,6))return}
  if(!bc.lumber&&n>=9&&p.res.w>=100){const t=findResNear(tc.cx,tc.cy,e=>e.res==='w',30);if(t&&nearestDropFor(p,'w',t.x,t.y).d>5&&place('lumber',t.x,t.y,1,4))return}
  if(!bc.mining&&n>=12&&p.res.w>=100){const t=findResNear(tc.cx,tc.cy,e=>e.type==='gold',30);if(t&&nearestDropFor(p,'g',t.x,t.y).d>5&&place('mining',t.x,t.y,1,4))return}
  if(!bc.barracks&&n>=13&&p.res.w>=175){if(place('barracks',tc.cx,tc.cy,6,14))return}
  const wantFarms=Math.min(16,Math.max(0,Math.floor((n-6)*0.5)));
  if(bc.mill&&(bc.farm||0)<wantFarms&&p.res.w>=60&&p.age>=0){const mill=G.blds.find(b=>!b.dead&&b.owner===p.id&&b.type==='mill');if(mill&&place('farm',mill.cx,mill.cy,3,10))return}
  if(p.age>=1){
    if(!bc.blacksmith&&place('blacksmith',tc.cx,tc.cy,6,15))return;
    if(!bc.archery&&bc.barracks&&place('archery',tc.cx,tc.cy,6,15))return;
    if(!bc.stable&&bc.barracks&&n>=20&&place('stable',tc.cx,tc.cy,6,15))return;
    if(!bc.market&&bc.mill&&n>=22&&place('market',tc.cx,tc.cy,7,16))return;
    // dock
    if(!bc.dock&&(A.needNavy||G.ress.some(r=>!r.dead&&r.type==='fish'&&hyp(r.x-tc.cx,r.y-tc.cy)<26))&&p.res.w>=150){if(aiPlaceDock(p,S))return}
    if(p.diff>=2&&(bc.tower||0)<2&&p.res.s>=100&&p.res.w>=400&&p.age>=1&&place('tower',tc.cx,tc.cy,7,12))return;
  }
  if(p.age>=2){
    if(!bc.monastery&&place('monastery',tc.cx,tc.cy,7,17))return;
    if(!bc.siege&&bc.blacksmith&&place('siege',tc.cx,tc.cy,7,17))return;
    if(!bc.university&&bc.market&&p.diff>=1&&place('university',tc.cx,tc.cy,7,17))return;
    if(!bc.castle&&p.res.s>=650&&place('castle',tc.cx,tc.cy,8,18))return;
    if((bc.barracks||0)<2&&p.diff>=2&&place('barracks',tc.cx,tc.cy,7,17))return;
    if((bc.stable||0)<2&&p.diff>=2&&place('stable',tc.cx,tc.cy,7,17))return;
  }
  if(p.age>=3&&(bc.archery||0)<2&&p.diff>=2&&place('archery',tc.cx,tc.cy,7,17))return;
  // town center expansion not modelled
}
function aiPlaceDock(p,S){
  const tc=S.tc;const d=B.dock;let best=null,bs=1e9;
  const v=S.vils.filter(u=>u.t!=='build'&&!u.inside)[0];if(!v)return false;
  const reg=regionAt(v.x,v.y);
  for(let y=2;y<G.H-5;y++)for(let x=2;x<G.W-5;x++){
    const dd=hyp(x+1.5-tc.cx,y+1.5-tc.cy);if(dd>26||dd>=bs)continue;
    if(regionAt(x+1,y+1)!==reg)continue;
    if(footprintOK('dock',x,y,p.id))continue;
    // adjacent water body must be big
    let ok=false;for(let j=-1;j<=3&&!ok;j++)for(let i=-1;i<=3;i++){const tx=x+i,ty=y+j;if(tx>=0&&ty>=0&&tx<G.W&&ty<G.H&&G.terr[ty*G.W+tx]>=3&&G.wsize[G.wreg[ty*G.W+tx]]>=60){ok=true;break}}
    if(!ok)continue;
    bs=dd;best=[x,y]}
  if(!best)return false;
  if(!canAfford(p,effCost(p,'dock')))return false;
  const r=placeBuilding(p,'dock',best[0],best[1],[v]);return!r.err;
}
// ---- training ----
function aiTrain(p,S){
  const A=p.A,tc=S.tc,n=S.vils.length;
  // villagers
  const tcs=G.blds.filter(b=>!b.dead&&b.owner===p.id&&b.type==='towncenter'&&b.built);
  const vq=tcs.reduce((a,b)=>a+b.queue.filter(q=>q.k==='u').length,0);
  const saving=aiSaving(p,S);
  if(n+vq<A.vilTarget&&p.pop<p.popCap)for(const t of tcs){if(t.queue.length<2&&p.res.f>=50)queueTrain(t,'villager')}
  // age up
  const ageT=['feudal','castle','imperial'][p.age];
  if(ageT){
    const req=techReq(p,tc,ageT);
    const nv=S.vils.length;
    const ok=req.length===0&&(p.age>0||nv>=Math.min(A.vilTarget-2,16))&&(p.age!==2||S.army.length>=6||p.diff>=2);
    if(ok&&canAfford(p,techCost(p,ageT))&&tc.queue.length===0){queueTech(tc,ageT)}
  }
  if(saving)return;
  // military
  const armyCap=Math.min(120,10+Math.floor(G.time/60)*(2+p.diff));
  if(S.army.length+S.war.length>armyCap)return;
  const q=(b)=>b.queue.length<2;
  const enemy=aiEnemyMix(p);
  const bl=(t)=>G.blds.filter(b=>!b.dead&&b.owner===p.id&&b.built&&b.type===t&&q(b));
  const tryT=(btype,line)=>{for(const b of bl(btype)){if(p.pop>=p.popCap)return false;if(queueTrain(b,line)==='')return true}return false};
  const r=Math.random();
  const age=p.age;
  if(age===0){tryT('barracks','inf')}
  else{
    // counters
    const cavHeavy=enemy.cav>0.35,arcHeavy=enemy.arc>0.35;
    if(r<.3)tryT('barracks',cavHeavy?'spear':'inf');
    else if(r<.55)tryT('archery',arcHeavy?'skirm':'archer');
    else if(r<.7&&age>=2)tryT('archery','cavarcher');
    else if(r<.85)tryT('stable',age>=2&&!cavHeavy?'knight':'scout');
    else if(age>=2&&r<.93)tryT('siege',enemy.bld>0.4||S.army.length>12?'ram':'mang');
    else tryT('barracks','spear');
    if(age>=2&&Math.random()<.2)tryT('castle','uu');
  }
  // monks
  if(S.bb.monastery&&S.monks.length<(p.diff>=2?4:2)&&p.res.g>=150){tryT('monastery','monk')}
  // trade carts later
}
function aiSaving(p,S){
  const ageT=['feudal','castle','imperial'][p.age];if(!ageT)return false;
  const need=techCost(p,ageT);
  const req=techReq(p,S.tc,ageT);if(req.length)return false;
  // save only when close to affordable and the villager target is met
  let miss=0;for(const k of RK)miss+=Math.max(0,need[k]-p.res[k]);
  return S.vils.length>=Math.min(p.A.vilTarget-4,18)&&S.army.length>=(p.age?5:2);
}
function aiEnemyMix(p){
  const mix={cav:0,arc:0,inf:0,bld:0};let n=0;
  for(const u of G.units){if(u.dead||u.def.animal||!isEnemy(p.id,u.owner)||!isMil(u))continue;n++;if(u.def.cls.includes('cav'))mix.cav++;if(u.def.cls.includes('arc')||u.def.cls.includes('ranged'))mix.arc++;if(u.def.cls.includes('inf'))mix.inf++}
  if(n){mix.cav/=n;mix.arc/=n;mix.inf/=n}
  return mix;
}
// ---- research ----
const AI_TECH_PRI=['loom','wheelbarrow','horsecollar','doublebit','goldmine','forging','fletching','scale','padded','sbarding','handcart','heavyplow','bowsaw','goldshaft','ironcast','bodkin','chain','leather','masonry','ballistics','bloodlines','thumbring','pikeman','manatarms','longsword','crossbow','cavalier','capram','stonemine','fervor','sanctity','herbal','redemption','blockprint','bracer','blastfurn','plate','ringarcher','pbarding','arbalest','twohand','halberdier','paladin','siegeram','onager','heavyscorp','twoman','cropr','conscription','hussar','lightcav','eliteskirm','wargalley','galleon','gillnets','careening','uniq','uniq2','euniq','hoardings','treadmill','illumination','atonement','caravan','guilds','siegeeng','heatedshot','guardtower','champion'];
function aiResearch(p,S){
  if(aiSaving(p,S))return;
  for(const b of G.blds){
    if(b.dead||b.owner!==p.id||!b.built||b.queue.length||!b.def.techs.length||b.type==='towncenter')continue;
    if(Math.random()<0.5)continue;
    const cand=b.def.techs.filter(k=>!T[k].age_up&&techReq(p,b,k).length===0).sort((a,c)=>AI_TECH_PRI.indexOf(a)-AI_TECH_PRI.indexOf(c));
    for(const k of cand){const c=techCost(p,k);
      let tot=0;for(const r of RK)tot+=c[r];
      const buf=tot>400?150:50;
      let ok=true;for(const r of RK)if(p.res[r]<c[r]+(c[r]?buf:0))ok=false;
      if(ok&&['wargalley','galleon','gillnets','careening'].includes(k)&&!S.fish.length&&!S.war.length)continue;
      if(['pikeman','crossbow','cavalier','capram','manatarms'].includes(k)&&S.army.length<4)continue;
      if(ok){queueTech(b,k);break}}
  }
}
// ---- sheep ----
function aiSheep(p,S){
  const A=p.A,tc=S.tc;
  // bring owned sheep home
  for(const s of S.sheep){if(s.t==='idle'&&hyp(s.x-tc.cx,s.y-tc.cy)>7&&hyp(s.x-tc.cx,s.y-tc.cy)<40&&!G.units.some(e=>!e.dead&&isEnemy(p.id,e.owner)&&hyp(e.x-s.x,e.y-s.y)<4)){const q=freeNear(tc.cx,tc.cy,tc.sz/2+1,tc.sz/2+4);if(q)orderMove(s,q.x,q.y)}}
  // scout captures
  let sc=S.scouts.find(u=>u.id===A.scoutId)||S.scouts[0];
  if(!sc)return;A.scoutId=sc.id;
  if(sc.t==='idle'||(sc.t==='move'&&G.time-sc.cmdT>25)){
    let best=null,bd=1e9;
    for(const s of G.units){if(s.dead||s.def.k!=='sheep'||s.owner===p.id||isFriend(p.id,s.owner))continue;
      const d=hyp(s.x-tc.cx,s.y-tc.cy);if(d>45||regionAt(s.x,s.y)!==regionAt(sc.x,sc.y))continue;
      if(s.owner>=0&&G.units.some(e=>!e.dead&&isFriend(s.owner,e.owner)&&!e.def.animal&&hyp(e.x-s.x,e.y-s.y)<GUARD_R))continue;
      if(G.units.some(e=>!e.dead&&e.def.cls.includes('predator')&&hyp(e.x-s.x,e.y-s.y)<8))continue;
      const dd=hyp(s.x-sc.x,s.y-sc.y)+(s.owner<0?0:-3);if(dd<bd){bd=dd;best=s}}
    if(best)orderMove(sc,best.x+0.5,best.y+0.5);
    else if(sc.t==='idle'&&Math.random()<.5){const a=Math.random()*6.28,r=rnd(10,35);const x=clamp(tc.cx+Math.cos(a)*r,2,G.W-3),y=clamp(tc.cy+Math.sin(a)*r,2,G.H-3);if(G.terr[Math.floor(y)*G.W+Math.floor(x)]<3)orderMove(sc,x,y)}
  }
}
// ---- monks & relics ----
function aiMonks(p,S){
  for(const m of S.monks){
    if(m.t!=='idle')continue;
    if(m.relicCarry){setCmd(m,'relic',0);m.gs='deposit';continue}
    if(S.bb.monastery){
      const r=findResNear(m.x,m.y,e=>e.type==='relic'&&!e.dead&&regionAt(e.x,e.y)===regionAt(m.x,m.y),80);
      const enemyNear=r&&G.units.some(e=>!e.dead&&isEnemy(p.id,e.owner)&&isMil(e)&&hyp(e.x-r.x,e.y-r.y)<7);
      if(r&&!enemyNear){setCmd(m,'relic',r);continue}
    }
    // follow army
    const a=S.army.find(u=>u.t!=='idle');if(a&&hyp(a.x-m.x,a.y-m.y)>5)orderMove(m,a.x,a.y);
  }
}
// ---- trade ----
function aiTrade(p,S){
  const A=p.A;if(G.time<A.nextTrade)return;A.nextTrade=G.time+12;
  const mk=G.blds.filter(b=>!b.dead&&b.owner===p.id&&b.built&&b.type==='market');if(!mk.length)return;
  let dest=null,bd=0;
  for(const b of G.blds){if(b.dead||!b.built||b.type!=='market'||b.owner===p.id||!isFriend(p.id,b.owner))continue;const d=hyp(b.cx-mk[0].cx,b.cy-mk[0].cy);if(d>bd){bd=d;dest=b}}
  if(!dest&&mk.length>1){dest=mk[1];bd=hyp(dest.cx-mk[0].cx,dest.cy-mk[0].cy)}
  if(!dest||bd<12)return;
  const carts=S.carts.filter(c=>c.def.k==='tradecart');
  if(carts.length<3&&mk[0].queue.length<1)queueTrain(mk[0],'tradecart');
  for(const c of carts)if(c.t==='idle'&&c.home){startTrade(c,dest)}
}
// ---- naval ----
function aiNavy(p,S){
  const A=p.A;
  const docks=G.blds.filter(b=>!b.dead&&b.owner===p.id&&b.built&&b.type==='dock');
  if(!docks.length)return;
  const d=docks[0];
  const fishNear=G.ress.filter(r=>!r.dead&&r.type==='fish'&&hyp(r.x-d.cx,r.y-d.cy)<28).length;
  const fishers=S.fish.length+d.queue.filter(q=>q.line==='fishing').length;
  const wantFish=fishNear>=4?[0,3,4,6][p.diff]+(p.age>=2?2:0):0;
  if(fishers<wantFish&&d.queue.length<2&&p.pop<p.popCap&&p.res.w>=75+(p.pop>=p.popCap-4?60:0))queueTrain(d,'fishing');
  // warships
  const wantWar=A.needNavy?[3,5,7,10][p.diff]+Math.floor(G.time/200):[0,1,2,4][p.diff];
  if(p.age>=1&&S.war.length+d.queue.filter(q=>['galley','fire','demo'].includes(q.line)).length<wantWar&&d.queue.length<2&&!aiSaving(p,S)&&p.res.w>=100+(p.pop>=p.popCap-4?80:0)){
    const r=Math.random();if(r<.7)queueTrain(d,'galley');else if(r<.85)queueTrain(d,'fire');else if(p.age>=2)queueTrain(d,'demo')}
  // idle warships: attack enemy ships/docks nearby or hold
  for(const w of S.war)if(w.t==='idle'){
    let tgt=null,bd=1e9;
    for(const e of G.units){if(e.dead||!isEnemy(p.id,e.owner)||!isShip(e))continue;const dd=hyp(e.x-w.x,e.y-w.y);if(dd<bd&&dd<45){bd=dd;tgt=e}}
    if(tgt&&S.war.length>=Math.min(wantWar,3))orderAttack(w,tgt)
  }
  // transports for invasion
  if(A.needNavy)aiInvasion(p,S,docks);
}
function aiInvasion(p,S,docks){
  const A=p.A;const dock=docks[0];
  // ensure transports
  const wantT=Math.min(3,1+Math.floor(S.army.length/10));
  const have=S.trans.length+dock.queue.filter(q=>q.line==='transport').length;
  if(have<wantT&&dock.queue.length<2&&p.res.w>=125&&G.time>(A.nextTransport||0)){A.nextTransport=G.time+10;queueTrain(dock,'transport')}
}
// ---- army / attacks ----
function aiPickTarget(p,S,onlyLand){
  const tc=S.tc;let best=null,bd=1e9;
  const myReg=regionAt(tc.cx,tc.cy);
  for(const b of G.blds){
    if(b.dead||!isEnemy(p.id,b.owner)||b.def.wall)continue;
    const reachable=regionAt(b.cx,b.cy)===myReg||regionAt(b.x-1,b.y)===myReg;
    if(onlyLand&&!reachable)continue;
    let d=hyp(b.cx-tc.cx,b.cy-tc.cy);if(b.owner===0)d-=12;if(b.type==='towncenter')d-=6;
    if(d<bd){bd=d;best=b}}
  return best;
}
function aiArmy(p,S){
  const A=p.A,tc=S.tc;
  const land=S.army.filter(u=>!isShip(u));
  const inv=A.inv;
  const t=G.time;
  // rally idle army near TC
  const target=aiPickTarget(p,S,true);
  // waves
  const need=A.d.size+A.wave*4;
  if(!A.attacking&&!inv&&t>A.d.first&&t-A.lastWave>A.d.interval*(A.wave?1:0.1)&&land.length>=need&&!p.bell){
    if(target){
      A.attacking=true;A.target=target.id;A.lastWave=t;A.wave++;A.launched=land.length;
      for(const u of land){if(u.t==='idle'||u.t==='amove'||u.t==='move')orderAttackMove(u,target.cx,target.cy)}
      for(const m of S.monks)if(m.t==='idle')orderMove(m,target.cx-4,target.cy-4);
      notifyAttackWave(p,target);
    }else if(A.needNavy&&S.trans.length){
      aiStartInvasion(p,S)
    }
  }
  if(A.attacking){
    const tg=byId(A.target);
    const left=land.length;
    if(left<Math.max(3,A.launched*0.25)||p.bell){A.attacking=false;for(const u of land)if(u.t==='amove'||u.t==='attack')orderMove(u,tc.cx+3,tc.cy+3)}
    else{
      let nt=tg;if(!nt){nt=aiPickTarget(p,S,true);if(nt)A.target=nt.id}
      if(!nt){A.attacking=false}
      else for(const u of land)if(u.t==='idle'){orderAttackMove(u,nt.cx,nt.cy)}
    }
  }else if(!inv){
    // idle army gather at rally point
    const rx=tc.cx+(G.W/2-tc.cx)*0.12,ry=tc.cy+(G.H/2-tc.cy)*0.12;
    for(const u of S.idleArmy)if(!isShip(u)&&hyp(u.x-rx,u.y-ry)>7&&regionAt(u.x,u.y)===regionAt(tc.cx,tc.cy))orderMove(u,rx+rnd(-3,3),ry+rnd(-3,3));
  }
  if(inv)aiRunInvasion(p,S);
  else if(A.needNavy&&!A.attacking&&S.trans.length&&land.length>=Math.min(need,10)&&G.time>A.d.first*0.6&&t-A.lastWave>A.d.interval*0.6)aiStartInvasion(p,S);
}
function notifyAttackWave(p,target){
  if(isEnemy(p.id,0)&&target.owner===0)msg(p.name+' is attacking!','warn',target.cx,target.cy);
}
function aiStartInvasion(p,S){
  const A=p.A,tc=S.tc;
  const docks=G.blds.filter(b=>!b.dead&&b.owner===p.id&&b.built&&b.type==='dock');if(!docks.length||!S.trans.length)return;
  const dock=docks[0];
  // pick target building in other region
  const myReg=regionAt(tc.cx,tc.cy);let tgt=null,bd=1e9;
  for(const b of G.blds){if(b.dead||!isEnemy(p.id,b.owner)||b.def.wall)continue;if(regionAt(b.cx,b.cy)===myReg)continue;let d=hyp(b.cx-tc.cx,b.cy-tc.cy);if(b.owner===0)d-=10;if(d<bd){bd=d;tgt=b}}
  if(!tgt)return;
  // landing tile: land tile in target's region within 6-14 tiles of target with adjacent water reachable by ship
  const reg=regionAt(tgt.cx,tgt.cy);let land=null,ls=1e9;
  const ship=S.trans[0];
  for(let y=1;y<G.H-1;y++)for(let x=1;x<G.W-1;x++){
    if(G.region[y*G.W+x]!==reg||G.occ[y*G.W+x])continue;
    const d=hyp(x-tgt.cx,y-tgt.cy);if(d<7||d>18)continue;
    // shore tile
    let w=false;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(G.terr[(y+dy)*G.W+x+dx]>=3&&G.wreg[(y+dy)*G.W+x+dx]===G.wreg[tIdx(ship.x,ship.y)])w=true;
    if(!w)continue;
    // avoid enemy defences
    let danger=false;for(const b of G.blds)if(!b.dead&&isEnemy(p.id,b.owner)&&b.def.atk&&hyp(b.cx-x,b.cy-y)<9)danger=true;
    const s=d+(danger?30:0);if(s<ls){ls=s;land={x:x+.5,y:y+.5}}
  }
  if(!land)return;
  A.inv={phase:'load',ships:S.trans.slice(0,3).map(s=>s.id),target:tgt.id,land,t0:G.time,dock:dock.id,troops:[]};
  A.lastWave=G.time;A.wave++;
  // gather troops: nearest military land units
  const troops=S.army.filter(u=>!isShip(u)&&regionAt(u.x,u.y)===myReg).slice(0,A.inv.ships.length*10);
  A.inv.troops=troops.map(u=>u.id);
  for(const u of troops)orderMove(u,dock.cx+rnd(-3,3),dock.cy+rnd(-3,3));
  // ships to dock
  const ex=exitPoint(dock,true);
  for(const id of A.inv.ships){const s=byId(id);if(s&&ex)orderMove(s,ex.x+rnd(-1,1),ex.y+rnd(-1,1))}
  if(isEnemy(p.id,0))msg(p.name+' is preparing a naval invasion!','warn');
}
function aiRunInvasion(p,S){
  const A=p.A,inv=A.inv;const ships=inv.ships.map(byId).filter(Boolean);
  const tgt=byId(inv.target);
  if(!ships.length||G.time-inv.t0>260){A.inv=null;return}
  const dock=byId(inv.dock);
  if(inv.phase==='load'){
    // order troops to board
    let boarded=0;
    for(const id of inv.troops){const u=G.byId.get(id);if(!u||u.dead)continue;
      if(u.inside){boarded++;continue}
      if(u.t==='idle'||u.t==='move'&&!u.path){const s=ships.find(s=>s.cargo.length<s.def.tcap+p.f.tcap&&hyp(s.x-u.x,s.y-u.y)<14);if(s&&hyp(s.x-u.x,s.y-u.y)<14)setCmd(u,'board',s)}}
    const alive=inv.troops.filter(id=>{const u=G.byId.get(id);return u&&!u.dead}).length;
    if((boarded>=alive*0.9&&alive>0)||G.time-inv.t0>90){
      if(boarded===0){A.inv=null;return}
      inv.phase='sail';
      for(const s of ships)orderMove(s,inv.land.x,inv.land.y);
    }
  }else if(inv.phase==='sail'){
    let done=true;for(const s of ships)if(s.cargo&&s.cargo.length){done=false;if(s.t==='idle')orderMove(s,inv.land.x,inv.land.y)}
    if(done){
      inv.phase='landed';
      const t=tgt||aiPickTarget(p,S,false);
      for(const id of inv.troops){const u=G.byId.get(id);if(u&&!u.dead&&!u.inside&&t)orderAttackMove(u,t.cx,t.cy)}
      for(const s of ships)if(dock){const ex=exitPoint(dock,true);if(ex)orderMove(s,ex.x,ex.y)}
      A.attacking=false;A.invLanded=G.time;
    }
  }else if(inv.phase==='landed'){
    if(G.time-A.invLanded>10){
      let any=false;
      for(const id of inv.troops){const u=G.byId.get(id);if(u&&!u.dead){any=true;if(u.t==='idle'){const t=tgt&&!tgt.dead?tgt:aiPickTarget(p,S,false);if(t)orderAttackMove(u,t.cx,t.cy)}}}
      if(!any||G.time-A.invLanded>200)A.inv=null;
    }
  }
}
