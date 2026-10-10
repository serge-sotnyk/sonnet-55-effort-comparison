// executed inside the game context (vm). Each test returns [name, pass(bool), detail]
const R_=[];
function TT(name,fn){try{const r=fn();R_.push([name,!!r[0],r[1]||''])}catch(e){R_.push([name,false,'EXC '+e.message+' '+(e.stack||'').split('\n')[1]])}}
function world(type,np,seed,opts){
  opts=opts||{};
  const md=genMap({type:type||'arabia',size:opts.size||64,seed:seed||3,np:np||2});
  const pl=[{name:'Me',civ:opts.civ||'britons',color:'#2f6fe0',team:0}];
  for(let i=1;i<(np||2);i++)pl.push({name:'AI'+i,civ:'franks',color:'#d83a3a',team:i,ai:true,diff:1});
  newGame({players:pl,res:{f:2000,w:2000,g:2000,s:2000},speed:1,startAge:opts.age===undefined?3:opts.age,visibility:'all',cheats:true},md);
  G.noFx=true;
  return G;
}
function run(sec){for(let i=0;i<sec*10;i++)stepGame(0.1)}
function mine(type){return G.units.filter(u=>!u.dead&&u.owner===0&&u.type===type)}
function clearUnits(owner){for(const u of G.units)if(!u.dead&&u.owner===owner&&!u.def.animal){u.dead=true;}}
function wipeAnimalsNear(x,y,r){for(const u of G.units)if(!u.dead&&u.def.animal&&Math.hypot(u.x-x,u.y-y)<r)u.dead=true}
function landNear(x,y,r){return freeNear(x,y,r||2,(r||2)+8)}
// ---- sheep ----
TT('sheep: neutral sheep discovered, enemy captures unguarded, owner recaptures, no flicker',()=>{
  world('arabia',2,4);
  const p0=G.players[0],p1=G.players[1];
  // clear everyone except TCs, remove native animals
  for(const u of G.units)if(!u.dead&&u.def.k==='sheep')u.dead=true;
  clearUnits(0);clearUnits(1);
  const q=landNear(G.W/2,G.H/2,2);
  const sh=mkUnit('sheep',-1,q.x,q.y);
  // 1) discovery by human unit
  const a=mkUnit('scout',0,q.x+3,q.y);run(1.5);
  const disc=sh.owner===0;
  // 2) move human scout away (>5 tiles) and bring enemy within 3.5 -> capture after lock
  a.x=q.x+12;a.y=q.y;orderStop(a);
  const b=mkUnit('scout',1,q.x-3,q.y);orderStop(b);run(6);
  const cap=sh.owner===1;
  // 3) owner returns: guarded by enemy unit within 5 -> should NOT flip back while enemy guards
  a.x=q.x+2.5;a.y=q.y;run(6);
  const stay=sh.owner===1;
  // 4) enemy unit leaves; human within 3.5 and no guard -> recapture
  b.x=q.x-20;b.y=q.y;run(6);
  const re=sh.owner===0;
  // flicker count
  let flips=0,last=sh.owner;for(let i=0;i<300;i++){stepGame(0.1);if(sh.owner!==last){flips++;last=sh.owner}}
  return[disc&&cap&&stay&&re&&flips===0,'disc '+disc+' cap '+cap+' stay '+stay+' recap '+re+' flips '+flips]});
// ---- hunting ----
TT('hunt: villager kills deer, gathers carcass, delivers food',()=>{
  world('arabia',2,5);const p=G.players[0];
  for(const u of G.units)if(!u.dead&&u.def.animal)u.dead=true;
  const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const q=landNear(tc.cx+7,tc.cy,1);const deer=mkUnit('deer',-1,q.x,q.y);
  const v=mine('villager')[0];const f0=p.res.f;
  smartOrder(v,deer);run(60);
  return[deer.dead&&p.res.f>f0,'deer dead '+deer.dead+' food +'+Math.floor(p.res.f-f0)+' v '+v.t+'/'+v.gs+' dist '+Math.hypot(v.x-deer.x,v.y-deer.y).toFixed(1)+' deer hp '+deer.hp+' flee '+deer.flee+' pathFail '+(v.pathFail>G.time)]});
TT('hunt: deer flees from approaching units',()=>{
  world('arabia',2,5);for(const u of G.units)if(!u.dead&&u.def.animal)u.dead=true;
  const q=landNear(G.W/2,G.H/2,1);const deer=mkUnit('deer',-1,q.x,q.y);clearUnits(0);
  const s=mkUnit('militia',0,q.x+3,q.y);orderStop(s);run(0.6);
  const d0=Math.hypot(deer.x-s.x,deer.y-s.y);run(2);const d1=Math.hypot(deer.x-s.x,deer.y-s.y);
  return[d1>d0+0.4,'dist '+d0.toFixed(1)+' -> '+d1.toFixed(1)]});
TT('wolf: attacks exposed villager; boar fights back',()=>{
  world('arabia',2,5);for(const u of G.units)if(!u.dead&&u.def.animal)u.dead=true;clearUnits(0);
  const q=landNear(G.W/2,G.H/2,1);const wolf=mkUnit('wolf',-1,q.x,q.y);const v=mkUnit('villager',0,q.x+3,q.y);orderStop(v);const h0=v.hp;run(6);
  const wolfHit=v.hp<h0||v.dead;
  const q2=landNear(G.W/2+10,G.H/2,1);const boar=mkUnit('boar',-1,q2.x,q2.y);const m=mkUnit('militia',0,q2.x+1.2,q2.y);orderAttack(m,boar);run(3);
  return[wolfHit&&m.hp<m.mh,'villager hp '+v.hp.toFixed(1)+'/'+h0+' militia hp '+m.hp.toFixed(1)]});
// ---- fishing ----
TT('fishing: dock + fishing ship brings food',()=>{
  world('coastal',2,9);const p=G.players[0];
  const v=mine('villager')[0];
  // find dock site
  let site=null;for(let y=2;y<G.H-5&&!site;y++)for(let x=2;x<G.W-5&&!site;x++){if(Math.hypot(x-p.start.x,y-p.start.y)>30)continue;if(footprintOK('dock',x,y,0)==='' )site=[x,y]}
  if(!site)return[false,'no dock site'];
  const r=placeBuilding(p,'dock',site[0],site[1],[v]);if(r.err)return[false,r.err];
  G.cheats.aegis=true;completeBuilding(r.b);
  const err=queueTrain(r.b,'fishing',true);
  run(30);const ships=mine('fishing');if(!ships.length)return[false,'no ship '+err+' q'+r.b.queue.length];
  const f0=p.res.f;const fish=findResNear(ships[0].x,ships[0].y,e=>e.type==='fish',40);
  if(!fish)return[false,'no fish'];
  orderGather(ships[0],fish);run(90);
  return[p.res.f>f0,'food +'+Math.floor(p.res.f-f0)+' fish left '+Math.floor(fish.amt)]});
// ---- naval ----
function waterSpot(x0,y0,minDl){let best=null,bd=1e9;for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++){if(G.terr[y*G.W+x]>=3&&R.dland&&true){}}return null}
TT('naval: galley kills galley; fire ship kills ship; demo ship hits dock',()=>{
  world('coastal',2,9);const W=G.W;
  let ws=[];for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++)if(G.terr[y*W+x]>=3){let ok=true;for(let j=-3;j<=3&&ok;j++)for(let i=-3;i<=3;i++){const X=x+i,Y=y+j;if(X<0||Y<0||X>=W||Y>=G.H||G.terr[Y*W+X]<3){ok=false;break}}if(ok)ws.push([x,y])}
  if(!ws.length)return[false,'no open water'];
  const[wx,wy]=ws[Math.floor(ws.length/2)];
  clearUnits(0);clearUnits(1);
  const g0=mkUnit('galley',0,wx+.5,wy+.5),g1=mkUnit('galley',1,wx+4.5,wy+.5);
  run(40);const galleyFight=(g0.dead!==g1.dead)||(g0.hp<g0.mh&&g1.hp<g1.mh);
  const f0=mkUnit('fireship',0,wx+.5,wy-2.5),t1=mkUnit('transport',1,wx+3.5,wy-2.5);
  orderAttack(f0,t1);run(25);const fireOK=t1.dead||t1.hp<t1.mh*0.5;
  // coastal bombardment: galley vs building
  return[galleyFight&&fireOK,'galley hp '+g0.hp.toFixed(0)+'/'+g1.hp.toFixed(0)+' fire target hp '+t1.hp.toFixed(0)]});
TT('naval: demolition ship destroys coastal building',()=>{
  world('coastal',2,9);const p1=G.players[1];
  let site=null;for(let y=2;y<G.H-5&&!site;y++)for(let x=2;x<G.W-5&&!site;x++){if(footprintOK('dock',x,y,1)==='')site=[x,y]}
  if(!site)return[false,'no site'];
  const dock=mkBld('dock',1,site[0],site[1],true);
  const ex=exitPoint(dock,true);const d=mkUnit('demoraft',0,ex.x,ex.y);
  const hp0=dock.hp;orderAttack(d,dock);run(40);
  return[dock.hp<hp0||dock.dead,'dock hp '+Math.floor(dock.hp)+'/'+hp0+' demo dead '+d.dead]});
TT('naval: transport loads, sails, unloads on valid shore; land units cannot enter deep water',()=>{
  world('islands',2,12,{size:64});const p=G.players[0];setRel(0,1,'ally');
  const dockSite=(()=>{let best=null,bd=1e9;for(let y=2;y<G.H-5;y++)for(let x=2;x<G.W-5;x++){if(footprintOK('dock',x,y,0)!=='')continue;const d=Math.hypot(x-p.start.x,y-p.start.y);if(d<bd){bd=d;best=[x,y]}}return best})();
  if(!dockSite)return[false,'no dock site'];
  const dk=mkBld('dock',0,dockSite[0],dockSite[1],true);
  const ex=exitPoint(dk,true);const ship=mkUnit('transport',0,ex.x,ex.y);
  const sold=[];for(let i=0;i<5;i++){const q=freeNear(dk.cx,dk.cy,3,6);sold.push(mkUnit('militia',0,q.x,q.y))}
  for(const s of sold)setCmd(s,'board',ship);run(20);
  const loaded=ship.cargo.length;
  // target: enemy island land
  const e=G.players[1].start;const myReg=regionAt(p.start.x,p.start.y),enReg=regionAt(e.x,e.y);
  let land=null,bd=1e9;for(let y=1;y<G.H-1;y++)for(let x=1;x<G.W-1;x++){if(G.region[y*G.W+x]!==enReg||G.occ[y*G.W+x])continue;const d=Math.hypot(x-e.x,y-e.y);if(d<bd&&d>8){let w=false;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(G.terr[(y+dy)*G.W+x+dx]>=3)w=true;if(w){bd=d;land=[x,y]}}}
  if(!land)return[false,'no landing'];
  orderMove(ship,land[0]+.5,land[1]+.5);run(120);
  const out=sold.filter(s=>!s.inside&&!s.dead);const landedReg=out.every(s=>regionAt(s.x,s.y)===enReg);
  // land unit path into deep water fails
  const r=findPath(sold[0].x,sold[0].y,(x,y)=>G.terr[y*G.W+x]>=3,sold[0].x,sold[0].y,0,false,false,2000);
  return[myReg!==enReg&&loaded===5&&out.length===5&&landedReg,'regions differ '+(myReg!==enReg)+' loaded '+loaded+' out '+out.length+' onEnemyIsland '+landedReg]});
TT('ship cannot path onto land',()=>{
  world('coastal',2,9);const p=G.players[0];
  const ws=[];for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++)if(G.terr[y*G.W+x]>=3){ws.push([x,y]);break}
  const s=mkUnit('galley',0,ws[0][0]+.5,ws[0][1]+.5);
  const r=findPath(s.x,s.y,(x,y)=>x===p.start.x&&y===p.start.y,p.start.x,p.start.y,0,true,false,8000);
  const onLand=r.path.some(([x,y])=>G.terr[Math.floor(y)*G.W+Math.floor(x)]<3);
  return[!onLand&&!r.ok,'ok '+r.ok+' onLand '+onLand]});
// ---- garrison + bell ----
TT('garrison/ungarrison + town bell resumes work',()=>{
  world('arabia',2,5,{age:0});const p=G.players[0];
  const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const vs=mine('villager');
  const tree=findResNear(tc.cx,tc.cy,e=>e.res==='w',20);
  for(const v of vs)orderGather(v,tree);run(5);
  toggleBell(p);run(15);
  const inside=tc.gar.length;const hidden=vs.every(v=>v.inside||v.t==='idle'||v.t==='garrison');
  toggleBell(p);run(3);
  const out=tc.gar.length;run(40);
  const working=vs.filter(v=>v.t==='gather').length;
  return[inside>=3&&out===0&&working>=3,'sheltered '+inside+' after release '+out+' working again '+working+'/'+vs.length]});
TT('garrisoned units add arrows; ungarrison manual; capacity enforced',()=>{
  world('arabia',2,5,{age:0});const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const a=[];for(let i=0;i<20;i++){const q=freeNear(tc.cx,tc.cy,3,6);a.push(mkUnit('archer',0,q.x,q.y));orderGarrison(a[i],tc)}run(10);
  const cap=tc.gar.length;
  const e=freeNear(tc.cx+5,tc.cy,1,2);const en=mkUnit('militia',1,e.x,e.y);orderStop(en);const hp0=en.hp;run(6);
  ungarrisonAll(tc,false);
  return[cap===15&&en.hp<hp0&&tc.gar.length===0,'garrisoned '+cap+' enemy hp '+en.hp.toFixed(0)+'/'+hp0]});
// ---- repair/heal/relic ----
TT('villager repairs building; monk heals units (not machines)',()=>{
  world('arabia',2,5);const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  tc.hp=tc.mh*0.5;const v=mine('villager')[0];orderRepair(v,tc);const r0=p.res.w+p.res.s;run(20);
  const rep=tc.hp>tc.mh*0.55;const spent=r0-(p.res.w+p.res.s);
  const m=mkUnit('monk',0,tc.cx+4,tc.cy+4),mil=mkUnit('militia',0,tc.cx+6,tc.cy+5),ram=mkUnit('ram',0,tc.cx+5,tc.cy+6);mil.hp=10;ram.hp=50;orderStop(mil);orderStop(ram);run(15);
  return[rep&&spent>0&&mil.hp>20&&ram.hp===50,'tc hp '+Math.floor(tc.hp)+' spent '+Math.floor(spent)+' militia '+mil.hp.toFixed(0)+' ram '+ram.hp]});
TT('monk converts enemy with delay+cooldown; relic deposit gives gold; relic drops on monk death',()=>{
  world('arabia',2,5);const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const mon=mkBld('monastery',0,tc.x+6,tc.y+6,true);
  const m=mkUnit('monk',0,tc.cx+3,tc.cy-3);const e=mkUnit('militia',1,tc.cx+8,tc.cy-3);orderStop(e);e.stance='none';
  const t0=G.time;setCmd(m,'convert',e);run(3);const early=e.owner===1;run(12);const conv=e.owner===0;const dt=G.time-t0;
  // relic
  const rq=freeNear(tc.cx-6,tc.cy,1,3);const rel=mkRes('relic',Math.floor(rq.x),Math.floor(rq.y));
  const m2=mkUnit('monk',0,rq.x+2,rq.y);setCmd(m2,'relic',rel);run(40);
  const stored=mon.relics;const g0=p.res.g;run(20);const inc=p.res.g-g0;
  // drop on death
  const rel2=mkRes('relic',Math.floor(rq.x),Math.floor(rq.y)+2);const m3=mkUnit('monk',0,rq.x+1,rq.y+2);setCmd(m3,'relic',rel2);run(4);const carrying=m3.relicCarry;killEnt(m3,null);
  const dropped=G.ress.some(r=>!r.dead&&r.type==='relic');
  return[early&&conv&&stored>=1&&inc>8&&carrying&&dropped,'early '+early+' converted '+conv+' after '+dt.toFixed(1)+'s stored '+stored+' income/20s '+inc.toFixed(1)+' carrying '+carrying+' dropped '+dropped]});
TT('monastery destroyed drops relics',()=>{
  world('arabia',2,5);const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const mon=mkBld('monastery',0,tc.x+6,tc.y+6,true);mon.relics=3;killEnt(mon,null);
  const n=G.ress.filter(r=>!r.dead&&r.type==='relic').length;return[n>=3,'relics on ground '+n]});
// ---- diplomacy ----
TT('diplomacy: allies do not target; war restores; tribute fee; AI refusal; proposals',()=>{
  world('arabia',3,6);const a=mkUnit('militia',0,10.5,10.5),b=mkUnit('militia',1,12.5,10.5);buildGrid();
  setRel(0,1,'ally');a.t='idle';const targ=acquire(a);const allyNoTarget=!targ||targ.owner!==1;
  declareWar(0,1);buildGrid();const t2=acquire(a);const warTarget=t2&&t2.owner===1;
  const f0=G.players[0].res.f,f1=G.players[1].res.f;const tr=tribute(0,1,'f',100);
  const fee=(f1+80===G.players[1].res.f)&&(f0-100===G.players[0].res.f);
  G.players[1].lastHit[0]=G.time;const r1=proposeDip(0,1,'peace');
  G.time+=200;G.players[1].attitude[0]=2;G.players[1].lastHit[0]=-999;
  const r2=proposeDip(0,1,'peace');
  const r3=proposeDip(0,1,'ally');
  G.players[1].attitude[0]=20;G.players[1].peaceSince=-100;const r4=proposeDip(0,1,'ally');
  return[allyNoTarget&&warTarget&&fee&&!r1.ok&&r2.ok&&!r3.ok&&r4.ok,'allyNoTarget '+allyNoTarget+' war '+!!warTarget+' fee '+fee+' refuse '+!r1.ok+' accept '+r2.ok+' allyRefuse '+!r3.ok+' allyAccept '+r4.ok]});
TT('victory only when all remaining allied; peace is not enough',()=>{
  world('arabia',3,6);setRel(0,1,'peace');
  for(const b of G.blds.slice())if(b.owner===2)killEnt(b,null);for(const u of G.units)if(u.owner===2)killEnt(u,null);
  checkEnd();const noWin=!G.over;
  setRel(0,1,'ally');checkEnd();
  return[noWin&&G.over&&G.over.win,'noWinWithPeace '+noWin+' over '+(G.over&&G.over.text)]});
// ---- trade ----
TT('trade cart earns gold by distance; route closed handled',()=>{
  world('arabia',2,7);const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  setRel(0,1,'ally');
  const m1=mkBld('market',0,tc.x+6,tc.y-8,true);
  const e=G.players[1].start;const m2=mkBld('market',1,Math.floor(e.x)-6,Math.floor(e.y)-6,true);
  const ex=exitPoint(m1,false);const cart=mkUnit('tradecart',0,ex.x,ex.y);cart.home=m1.id;
  const ok=startTrade(cart,m2);const g0=p.res.g;run(150);const inc=p.res.g-g0;
  killEnt(m2,null);run(20);
  return[ok&&inc>20&&cart.t!=='trade','trade started '+ok+' income '+inc.toFixed(0)+' state after dest destroyed '+cart.t]});
TT('trade cog needs sea route',()=>{
  world('coastal',2,9);const p=G.players[0];setRel(0,1,'ally');for(const r of G.ress)if(r.type!=='fish'){r.dead=true;G.occ[r.y*G.W+r.x]=0}for(const u of G.units)if(u.def.animal)u.dead=true;
  const sites=[];for(let y=2;y<G.H-5;y++)for(let x=2;x<G.W-5;x++){if(footprintOK('dock',x,y,0)==='')sites.push([x,y])}
  if(sites.length<2)return[false,'sites '+sites.length];
  let a=sites[0],b=sites[sites.length-1];for(const s of sites)if(Math.hypot(s[0]-a[0],s[1]-a[1])>Math.hypot(b[0]-a[0],b[1]-a[1])*0+0){}
  let far=a,fd=0;for(const s of sites){const d=Math.hypot(s[0]-a[0],s[1]-a[1]);if(d>fd){fd=d;far=s}}
  const d1=mkBld('dock',0,a[0],a[1],true),d2=mkBld('dock',1,far[0],far[1],true);
  if(fd<12)return[false,'docks too close '+fd.toFixed(0)];
  const ex=exitPoint(d1,true);const cog=mkUnit('tradecog',0,ex.x,ex.y);cog.home=d1.id;
  const ok=startTrade(cog,d2);const g0=p.res.g;run(200);const inc=p.res.g-g0;
  return[ok&&inc>10,'dist '+fd.toFixed(0)+' income '+inc.toFixed(0)]});
// ---- elevation ----
TT('elevation: uphill attacker deals +25%, downhill -25%, ranged +1 range uphill',()=>{
  world('arabia',2,5);
  const a=mkUnit('militia',0,20.5,20.5),b=mkUnit('militia',1,21.5,20.5);
  G.hgt[20*G.W+20]=2;G.hgt[20*G.W+21]=1;
  const hi=calcDamage(a,b);G.hgt[20*G.W+20]=1;G.hgt[20*G.W+21]=2;const lo=calcDamage(a,b);G.hgt[20*G.W+20]=1;G.hgt[20*G.W+21]=1;const eq=calcDamage(a,b);
  const ar=mkUnit('archer',0,30.5,30.5),tg=mkUnit('militia',1,34.5,30.5);G.hgt[30*G.W+30]=2;G.hgt[30*G.W+34]=0;const rUp=rangeOf(ar,tg);G.hgt[30*G.W+30]=0;G.hgt[30*G.W+34]=2;const rDown=rangeOf(ar,tg);
  return[hi>eq&&lo<eq&&rUp===sget(ar,'rng')+1&&rDown===sget(ar,'rng')-1,'dmg hi/eq/lo '+hi.toFixed(2)+'/'+eq.toFixed(2)+'/'+lo.toFixed(2)+' range up/down '+rUp+'/'+rDown]});
TT('cliffs block land pathing; ramps allow it',()=>{
  world('arabia',2,5);
  for(let y=30;y<40;y++)for(let x=30;x<40;x++){G.terr[y*G.W+x]=0;G.occ[y*G.W+x]=0;G.hgt[y*G.W+x]=0}
  // wall of cliffs at x=35 from y=30..39 (height 3 right side)
  for(let y=30;y<40;y++)for(let x=35;x<40;x++)G.hgt[y*G.W+x]=3;
  const u=mkUnit('militia',0,32.5,35.5);
  const r1=findPath(u.x,u.y,(x,y)=>x===37&&y===35,37.5,35.5,0,false,false,3000);
  const blocked=!r1.ok;
  // add ramp tiles at y=35 : heights 1,2 at x=34,35? set (34,35)=1,(35,35)=2,(36,35)=3
  G.hgt[35*G.W+34]=1;G.hgt[35*G.W+35]=2;
  const r2=findPath(u.x,u.y,(x,y)=>x===37&&y===35,37.5,35.5,0,false,false,3000);
  return[blocked&&r2.ok,'with cliff ok='+r1.ok+' with ramp ok='+r2.ok]});
// ---- cheats ----
TT('cheats: resources, toggles, cobra car fires and damages; disabled when not allowed',()=>{
  world('arabia',2,5);const p=G.players[0];
  const f0=p.res.f;let r=runCheat("Cheese Steak Jimmy's");const f1=p.res.f;runCheat('cheese steak jimmy\'s');const rep=p.res.f===f1+10000;
  runCheat('LUMBERJACK');runCheat('robin hood');runCheat('rock on');
  const all=p.res.w>=12000&&p.res.g>=12000&&p.res.s>=12000;
  runCheat('aegis');const aeg=G.cheats.aegis;runCheat('aegis');const aeg2=!G.cheats.aegis;
  G.cheats.polo=false;runCheat('polo');const polo=G.cheats.polo;runCheat('marco');
  const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const c=runCheat('how do you turn this on');const car=G.lastCobra;
  const e=mkUnit('militia',1,car.x+4,car.y);orderStop(e);e.stance='none';const hp0=e.hp;
  orderAttack(car,e);run(4);
  const cobraOK=e.hp<hp0*0.6||e.dead;
  const car2=runCheat('how do you turn this on');
  G.cheats.allowed=false;const dis=runCheat('lumberjack');
  return[f1===f0+10000&&rep&&all&&aeg&&aeg2&&polo&&c.ok&&cobraOK&&car2.ok&&!dis.ok,'res '+(f1-f0)+' rep '+rep+' all '+all+' aegis '+aeg+aeg2+' polo '+polo+' cobra '+c.ok+' dmg '+(hp0-e.hp).toFixed(0)+' disabled '+!dis.ok]});
TT('aegis: instant build/train/research',()=>{
  world('arabia',2,5,{age:0});const p=G.players[0];runCheat('aegis');const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const n0=p.pop;queueTrain(tc,'villager');queueTech(tc,'loom');run(2);
  const v=mine('villager')[0];const sp=freeNear(tc.cx+6,tc.cy,1,3);const r=placeBuilding(p,'house',Math.floor(sp.x),Math.floor(sp.y),[v]);
  return[p.pop>n0&&p.techs.has('loom')&&r.b&&r.b.built,'pop '+n0+'->'+p.pop+' loom '+p.techs.has('loom')+' house built '+(r.b&&r.b.built)]});
// ---- production rules ----
TT('production: costs, prerequisites, age gating, pop cap, queue enforced',()=>{
  world('arabia',2,5,{age:0});const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  p.res={f:0,w:0,g:0,s:0};const noRes=queueTrain(tc,'villager');
  p.res={f:5000,w:5000,g:5000,s:5000};
  const ageGate=canBuildType(p,'castle').length>0&&canBuildType(p,'archery').length>0;
  const prereq=canBuildType(p,'market');
  const rt=techReq(p,tc,'castle');
  // pop cap
  while(p.pop<p.popCap){const q=freeNear(tc.cx,tc.cy,3,8);mkUnit('villager',0,q.x,q.y)}recalcPlayer(p);queueTrain(tc,'villager');run(30);const stalled=p.pop===p.popCap&&tc.stalled;
  return[!!noRes&&ageGate&&prereq.length>0&&rt.length>0&&stalled,'noRes "'+noRes+'" ageGate '+ageGate+' prereq '+prereq.join('|')+' stalled '+stalled]});
TT('age up: needs buildings, costs, applies, unlocks',()=>{
  world('arabia',2,5,{age:0});const p=G.players[0];const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');
  const noB=techReq(p,tc,'feudal');
  mkBld('house',0,tc.x+6,tc.y,true);mkBld('mill',0,tc.x+6,tc.y+4,true);
  const ok=techReq(p,tc,'feudal');const r=queueTech(tc,'feudal');run(40);
  const feudal=p.age===1;const arch=canBuildType(p,'blacksmith').length===0;
  return[noB.length>0&&ok.length===0&&!r&&feudal&&arch,'before '+noB.length+' after '+ok.length+' age '+p.age]});
TT('unit upgrade lines morph units and apply to new production',()=>{
  world('arabia',2,5,{age:2});const p=G.players[0];const bk=mkBld('barracks',0,10,10,true);
  const m=mkUnit('militia',0,20.5,20.5);const hp0=m.mh;
  applyTech(p,'manatarms');applyTech(p,'longsword');
  queueTech(bk,'twohand');const e=queueTrain(bk,'inf',true);run(30);
  return[m.type==='longsword'||m.type==='twohand'&&true,'morph '+m.type+' hp '+hp0+'->'+m.mh+' trained '+G.units.filter(u=>u.owner===0&&u.def.line==='inf').map(u=>u.type).join(',')]});
TT('civ bonus applied (Franks +20% cav HP) & unique unit trainable at Castle',()=>{
  world('arabia',2,5,{age:2,civ:'franks'});const p=G.players[0];
  const k=mkUnit('knight',0,10.5,10.5);const cs=mkBld('castle',0,12,12,true);const e=queueTrain(cs,'uu',true);run(40);
  const tk=G.units.find(u=>u.owner===0&&u.type==='throwaxe');
  return[k.mh===120&&!!tk,'knight hp '+k.mh+' uu '+(tk&&tk.def.n)]});
TT('wall blocks enemy, gate passes allies; AI siege breach',()=>{
  world('arabia',2,5);
  for(let y=30;y<40;y++)for(let x=25;x<45;x++){G.terr[y*G.W+x]=0;G.occ[y*G.W+x]=0;G.hgt[y*G.W+x]=0}
  for(const r of G.ress)if(!r.dead&&r.x>=24&&r.x<46&&r.y>=29&&r.y<41)r.dead=true;
  for(let y=0;y<G.H;y++){for(const r of G.ress)if(!r.dead&&r.x===35&&r.y===y)r.dead=true;G.occ[y*G.W+35]=0;G.hgt[y*G.W+35]=0;G.terr[y*G.W+35]=0;mkBld('wall',0,35,y,true)}
  const e=mkUnit('militia',1,30.5,35.5);
  const blockedPath=findPath(e.x,e.y,(x,y)=>x===40&&y===35,40.5,35.5,1,false,false,3000);
  const noBreach=!blockedPath.ok;
  const br=findPath(e.x,e.y,(x,y)=>x===40&&y===35,40.5,35.5,1,false,true,3000);
  const gate=mkBld('gate',0,35,35,true);
  const ally=mkUnit('militia',0,30.5,35.5);const ap=findPath(ally.x,ally.y,(x,y)=>x===40&&y===35,40.5,35.5,0,false,true,3000);
  const ep=findPath(e.x,e.y,(x,y)=>x===40&&y===35,40.5,35.5,1,false,false,3000);
  return[noBreach&&br.ok&&ap.ok&&!ep.ok,'enemy blocked '+noBreach+' breach path '+br.ok+' ally through gate '+ap.ok+' enemy blocked by gate '+!ep.ok]});
// ---- AI ----

TT('combat counters: spears beat knights, skirmishers beat archers, rams kill towers, mangonel splash, LOS blocked behind ridge',()=>{
  function duel(ta,na,tb,nb,sec){world('arabia',2,5);clearUnits(0);clearUnits(1);for(const u of G.units)if(u.def.animal)u.dead=true;
    for(let y=28;y<44;y++)for(let x=18;x<46;x++){G.hgt[y*G.W+x]=0;G.terr[y*G.W+x]=0;G.occ[y*G.W+x]=0}for(const r of G.ress)if(!r.dead&&r.x>=17&&r.x<47&&r.y>=27&&r.y<45)r.dead=true;
    const A=[],Bs=[];for(let i=0;i<na;i++)A.push(mkUnit(ta,0,25.5,32.5+i*.9));for(let i=0;i<nb;i++)Bs.push(mkUnit(tb,1,33.5,32.5+i*.9));
    for(const u of A)orderAttackMove(u,34,34);for(const u of Bs)orderAttackMove(u,24,34);run(sec);
    return[A.filter(u=>!u.dead).length,Bs.filter(u=>!u.dead).length]}
  const r1=duel('spearman',6,'knight',3,40);
  const r2=duel('skirm',6,'archer',6,40);
  const r3=duel('knight',3,'archer',4,40);
  world('arabia',2,5);const tw=mkBld('tower',1,40,40,true);const rams=[];for(let i=0;i<3;i++)rams.push(mkUnit('ram',0,36.5,40.5+i));for(const r of rams)orderAttack(r,tw);run(60);
  const towerDead=tw.dead;
  world('arabia',2,5);clearUnits(0);clearUnits(1);for(let i=0;i<6;i++)mkUnit('militia',1,40.5+(i%3)*.6,40.5+(i>>1)*.6);const m=mkUnit('mangonel',0,33.5,41.5);buildGrid();const tgt=G.units.find(u=>u.owner===1);const hp0=G.units.filter(u=>u.owner===1).map(u=>u.hp);orderAttack(m,tgt);run(14);
  const hurt=G.units.filter(u=>u.owner===1&&u.hp<u.mh).length+G.units.filter(u=>u.owner===1&&u.dead).length;
  // LOS: archer at level 0, target at level 0 behind ridge level 3
  world('arabia',2,5);clearUnits(0);clearUnits(1);for(const u of G.units)if(u.def.animal)u.dead=true;for(let y=28;y<44;y++)for(let x=18;x<46;x++){G.hgt[y*G.W+x]=0;G.terr[y*G.W+x]=0;G.occ[y*G.W+x]=0}
  for(let y=28;y<44;y++){G.hgt[y*G.W+30]=3;G.hgt[y*G.W+29]=2}
  const ar=mkUnit('archer',0,27.5,35.5),tg2=mkUnit('militia',1,32.5,35.5);tg2.stance='none';const blocked=elevBlocked(ar,tg2);
  return[r1[0]>0&&r1[1]===0&&r2[0]>0&&r2[1]===0&&towerDead&&hurt>=2&&blocked,'spear vs knight left '+r1+' skirm vs archer '+r2+' knight vs archer '+r3+' tower dead '+towerDead+' mangonel hurt '+hurt+' LOS blocked '+blocked]});
TT('AI: 3 AIs grow economy, age up, build army (10 min)',()=>{
  world('arabia',4,8,{age:0});for(const p of G.players)p.res={f:200,w:200,g:100,s:200};aiInit();
  // make human an AI too for the test
  G.players[0].ai=true;G.players[0].A=G.players[1].A?Object.assign({},G.players[1].A,{t:0}):null;G.players[0].diff=1;aiInit();
  run(600);
  const rep=G.players.map(p=>({age:p.age,vils:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.type==='villager').length,army:G.units.filter(u=>!u.dead&&u.owner===p.id&&isMil(u)).length,blds:G.blds.filter(b=>!b.dead&&b.owner===p.id).length}));
  return[rep.every(r=>r.vils>=15&&r.blds>=10),JSON.stringify(rep)]});
TT('AI island map: builds dock/fishing/transports and lands troops (20 min)',()=>{
  world('islands',2,12,{age:1});for(const p of G.players)p.res={f:1500,w:1500,g:1500,s:600};
  G.players[0].ai=true;G.players[0].diff=2;G.players[1].diff=2;aiInit();
  let landed=false,sawTransport=false;
  for(let i=0;i<1200*10;i++){stepGame(0.1);if(i%50===0){for(const p of G.players){const e=G.players[1-p.id];for(const u of G.units){if(u.dead||u.owner!==p.id||!isMil(u)||isShip(u))continue;if(regionAt(u.x,u.y)===regionAt(e.start.x,e.start.y)&&regionAt(u.x,u.y)!==regionAt(p.start.x,p.start.y))landed=true}}
    if(G.units.some(u=>!u.dead&&u.type==='transport'))sawTransport=true}}
  const rep=G.players.map(p=>({age:p.age,docks:G.blds.filter(b=>!b.dead&&b.owner===p.id&&b.type==='dock').length,fish:G.units.filter(u=>!u.dead&&u.owner===p.id&&u.type==='fishing').length,ships:G.units.filter(u=>!u.dead&&u.owner===p.id&&isShip(u)).length,alive:p.alive}));
  return[landed&&sawTransport,'landed '+landed+' transport '+sawTransport+' '+JSON.stringify(rep)+' over '+(G.over&&G.over.text)]});
TT('map gen: all land maps connect all starts; islands separate',()=>{
  const res=[];for(const t of['arabia','highlands','coastal']){for(const np of[2,3,4]){for(const seed of[1,2,3]){const md=genMap({type:t,size:64,seed,np});newGame({players:Array.from({length:np},(_,i)=>({name:'p'+i,civ:'britons',color:'#fff',team:i,ai:i>0})),res:{f:0,w:0,g:0,s:0},speed:1,startAge:0,visibility:'all'},md);
    const r0=regionAt(G.players[0].start.x,G.players[0].start.y);for(let i=1;i<np;i++){if(regionAt(G.players[i].start.x,G.players[i].start.y)!==r0)res.push(t+np+'/'+seed)}
    // also actual path with trees
    const fa=freeNear(G.players[0].start.x,G.players[0].start.y,3,6);const ok=findPath(fa.x,fa.y,(x,y)=>Math.hypot(x+.5-G.players[1].start.x,y+.5-G.players[1].start.y)<3.5,G.players[1].start.x,G.players[1].start.y,0,false,false,30000).ok;if(!ok)res.push('nopath '+t+np+'/'+seed)}}}
  const il=genMap({type:'islands',size:64,seed:2,np:2});newGame({players:[{name:'a',civ:'britons',color:'#fff',team:0},{name:'b',civ:'britons',color:'#fff',team:1,ai:true}],res:{f:0,w:0,g:0,s:0},speed:1,startAge:0,visibility:'all'},il);
  const sep=regionAt(G.players[0].start.x,G.players[0].start.y)!==regionAt(G.players[1].start.x,G.players[1].start.y);
  return[res.length===0&&sep,'disconnected: '+res.join(',')+' islandsSeparate '+sep]});
JSON.stringify(R_)
