'use strict';
// ===== Map generation & map data helpers =====
function mkRng(seed){let a=(seed>>>0)||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function mkNoise(rng,N,cell,oct){
  oct=oct||2;const layers=[];
  for(let o=0;o<oct;o++){const c=Math.max(2,cell/(1<<o)),g=Math.ceil(N/c)+3,arr=new Float32Array(g*g);for(let i=0;i<arr.length;i++)arr[i]=rng();layers.push({c,g,arr})}
  return(x,y)=>{let s=0,w=0,a=1;for(const L of layers){const fx=x/L.c,fy=y/L.c,ix=Math.floor(fx),iy=Math.floor(fy);let tx=fx-ix,ty=fy-iy;tx=tx*tx*(3-2*tx);ty=ty*ty*(3-2*ty);
    const v=(L.arr[iy*L.g+ix]*(1-tx)+L.arr[iy*L.g+ix+1]*tx)*(1-ty)+(L.arr[(iy+1)*L.g+ix]*(1-tx)+L.arr[(iy+1)*L.g+ix+1]*tx)*ty;s+=v*a;w+=a;a*=.5}return s/w}
}
const MAP_TYPES={
  arabia:{n:'Meadowlands (Land)',d:'Open grassland with gentle hills, forests, ponds and wildlife. All players share one continent.',water:false},
  highlands:{n:'Highlands (Land, cliffs)',d:'Mesas and cliffs with narrow ramps. High ground matters.',water:false},
  coastal:{n:'Inland Sea (Land + Water)',d:'A large sea in the middle: connected coastlines, fish, docks and naval fights, but land routes exist.',water:true},
  islands:{n:'Islands (Naval)',d:'Every player starts on their own island. You need transport ships and a navy to win.',water:true},
};
const MAP_SIZES={tiny:{n:'Tiny (48)',s:48},small:{n:'Small (64)',s:64},medium:{n:'Medium (80)',s:80},large:{n:'Large (100)',s:100}};

function newMapData(N){return{w:N,h:N,terr:new Uint8Array(N*N),hgt:new Uint8Array(N*N),objs:[],starts:[],np:2,name:'Untitled'}}
function startPositions(N,np,type){
  const c=N/2,R=N*(type==='islands'?0.31:0.34),a0=Math.PI*0.25,out=[];
  for(let i=0;i<np;i++){const a=a0+i*Math.PI*2/np+(np===4?Math.PI/4*0:0);out.push({x:Math.round(c+R*Math.cos(a)),y:Math.round(c+R*Math.sin(a))})}
  return out;
}
function genMap(o){
  const N=o.size,type=o.type,np=o.np||2,rng=mkRng(o.seed*7919+13);
  const md=newMapData(N);md.np=np;md.mtype=type;md.mtype=type;md.name=(MAP_TYPES[type]||{}).n||'Map';
  const T=md.terr,H=md.hgt,idx=(x,y)=>y*N+x,inb=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
  const starts=md.starts=startPositions(N,np,type);
  const dStart=(x,y)=>{let m=1e9;for(const s of starts)m=Math.min(m,Math.hypot(x-s.x,y-s.y));return m};
  const nH=mkNoise(rng,N,16,3),nM=mkNoise(rng,N,20,2),nF=mkNoise(rng,N,9,2),nD=mkNoise(rng,N,7,2),nW=mkNoise(rng,N,12,3);
  // ---- water ----
  const water=new Uint8Array(N*N);
  if(type==='coastal'){
    const c=N/2,rx=N*0.25,ry=N*0.25;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const d=Math.hypot((x-c)/rx,(y-c)/ry);const v=d+ (nW(x,y)-.5)*0.6;if(v<1)water[idx(x,y)]=1}
  }else if(type==='islands'){
    const isl=starts.map(s=>({x:s.x,y:s.y,r:N*(np>3?0.14:0.17)}));
    // neutral islets
    const nIs=3+Math.floor(N/30);
    for(let i=0;i<nIs;i++){const a=rng()*7,rr=N*(0.08+rng()*0.38);const x=N/2+Math.cos(a)*rr,y=N/2+Math.sin(a)*rr;if(dStart(x,y)>N*0.2)isl.push({x,y,r:N*(0.04+rng()*0.04),neutral:1})}
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){let land=false;for(const I of isl){if(Math.hypot(x-I.x,y-I.y)<I.r*(0.78+0.55*nW(x,y)))land=true}if(!land)water[idx(x,y)]=1}
    md.islets=isl.filter(i=>i.neutral);
  }else{
    // small ponds
    const np2=2+Math.floor(N/40);
    for(let i=0;i<np2;i++){const x=rng()*N,y=rng()*N;if(dStart(x,y)<N*0.2)continue;const r=3+rng()*3;for(let yy=-8;yy<=8;yy++)for(let xx=-8;xx<=8;xx++){const X=Math.round(x+xx),Y=Math.round(y+yy);if(inb(X,Y)&&Math.hypot(xx,yy)<r*(0.8+0.5*nW(X,Y)))water[idx(X,Y)]=1}}
  }
  // keep a border of water around islands/edges? edges: land map edges stay land
  // distance to water / to land
  const dw=new Int16Array(N*N).fill(99);
  { const q=[];for(let i=0;i<N*N;i++)if(water[i]){dw[i]=0;q.push(i)}
    for(let h=0;h<q.length;h++){const i=q[h],x=i%N,y=(i/N)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(inb(X,Y)&&dw[idx(X,Y)]>dw[i]+1){dw[idx(X,Y)]=dw[i]+1;q.push(idx(X,Y))}}}}
  const dl=new Int16Array(N*N).fill(99);
  { const q=[];for(let i=0;i<N*N;i++)if(!water[i]){dl[i]=0;q.push(i)}
    for(let h=0;h<q.length;h++){const i=q[h],x=i%N,y=(i/N)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(inb(X,Y)&&dl[idx(X,Y)]>dl[i]+1){dl[idx(X,Y)]=dl[i]+1;q.push(idx(X,Y))}}}}
  // ---- height ----
  const hillT=type==='highlands'?[.42,.56,.7]:[.57,.69,.8];
  const flat=[];for(const s of starts)flat.push(s);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const n=nH(x,y);let h=n>hillT[2]?3:n>hillT[1]?2:n>hillT[0]?1:0;
    if(type==='highlands'&&h>2)h=2;
    const ds=dStart(x,y);if(ds<9)h=0;else if(ds<13)h=Math.min(h,1);
    if(water[idx(x,y)])h=0;
    H[idx(x,y)]=h;
  }
  // smooth: enforce |dh|<=1 between land neighbours
  for(let pass=0;pass<6;pass++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=idx(x,y);if(water[i])continue;for(const[dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]){const X=x+dx,Y=y+dy;if(!inb(X,Y)||water[idx(X,Y)])continue;const j=idx(X,Y);if(H[i]>H[j]+1)H[i]=H[j]+1}}
  // shoreline low
  for(let i=0;i<N*N;i++)if(!water[i]&&dl[i]===0&&dw[i]<=2)H[i]=0;
  // mesas for highlands
  if(type==='highlands'){
    const mesa=new Uint8Array(N*N);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(water[idx(x,y)]||dStart(x,y)<14)continue;if(nM(x,y)>0.6){mesa[idx(x,y)]=1;H[idx(x,y)]=3}}
    // ramps: find boundary tiles and carve stepped ramps
    const seen=new Set();let ramps=0;
    for(let y=2;y<N-2;y++)for(let x=2;x<N-2;x++){
      if(!mesa[idx(x,y)])continue;
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
        if(mesa[idx(x+dx,y+dy)])continue;
        if(((x*7+y*13+(dx+2)*3)%23)!==0)continue;   // sparse deterministic pick
        // ramp width 3 perpendicular
        for(let w=-1;w<=1;w++){const px=x+(dy?w:0),py=y+(dx?w:0);
          let ok=true;for(let d=0;d<4;d++){const X=px+dx*d,Y=py+dy*d;if(!inb(X,Y)||water[idx(X,Y)]){ok=false}}
          if(!ok)continue;
          for(let d=0;d<4;d++){const X=px+dx*d,Y=py+dy*d;H[idx(X,Y)]=[3,2,1,Math.min(H[idx(X,Y)],1)][d]===3?3:Math.max(0,3-d); if(d===3)H[idx(X,Y)]=Math.min(H[idx(X,Y)],1)}
        }
        ramps++;
      }
    }
    // re-smooth ramp exits outward
    for(let pass=0;pass<3;pass++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=idx(x,y);if(water[i]||mesa[i])continue;for(const[dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]){const X=x+dx,Y=y+dy;if(!inb(X,Y)||water[idx(X,Y)])continue;const j=idx(X,Y);if(mesa[j])continue;if(H[i]>H[j]+1)H[i]=H[j]+1}}
  }
  // ---- terrain types ----
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const i=idx(x,y);
    if(water[i]){T[i]=dl[i]>=3?T_DEEP:T_SHALLOW;if(dl[i]>=3&&dl[i]<4&&nW(x*1.3,y*1.3)>.62)T[i]=T_SHALLOW}
    else if(dw[i]===1||(dw[i]===2&&nD(x,y)>.5))T[i]=T_SAND;
    else T[i]=nD(x+40,y+40)>0.68?T_DIRT:T_GRASS;
  }
  const used=new Uint8Array(N*N);
  const land=(x,y)=>inb(x,y)&&!water[idx(x,y)];
  const add=(k,t,x,y,o)=>{md.objs.push({k,t,x,y,o:o===undefined?-1:o})};
  const putRes=(t,x,y,k)=>{x=Math.round(x);y=Math.round(y);if(!land(x,y)||used[idx(x,y)])return false;used[idx(x,y)]=1;add(k||'res',t,x,y);return true};
  const putAnimal=(t,x,y)=>{x=Math.round(x);y=Math.round(y);if(!land(x,y)||used[idx(x,y)]||T[idx(x,y)]===T_SAND&&false)return false;used[idx(x,y)]=1;add('animal',t,x,y);return true};
  // reserve start footprints
  for(const s of starts)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(inb(s.x+x,s.y+y))used[idx(s.x+x,s.y+y)]=1;
  function cluster(t,cx,cy,n,r,k,minr){let placed=0,tries=0;while(placed<n&&tries<n*30){tries++;const a=rng()*6.283,d=(minr||0)+rng()*r;if(putRes(t,cx+Math.cos(a)*d,cy+Math.sin(a)*d,k))placed++}return placed}
  function clusterA(t,cx,cy,n,r,minr){let placed=0,tries=0;while(placed<n&&tries<n*30){tries++;const a=rng()*6.283,d=(minr||0)+rng()*r;if(putAnimal(t,cx+Math.cos(a)*d,cy+Math.sin(a)*d))placed++}return placed}
  // ---- per-player resources ----
  starts.forEach((s,pi)=>{
    const a0=rng()*6.283;const P=(a,d)=>[s.x+Math.cos(a0+a)*d,s.y+Math.sin(a0+a)*d];
    // sheep: 2 close (auto-discovered), 2 further
    for(let i=0;i<4;i++){const [x,y]=P(0.4+i*1.25,i<2?4.2:8.5);if(!putAnimal('sheep',x,y))clusterA('sheep',x,y,1,3)}
    let [bx,by]=P(2.2,7);cluster('berries',bx,by,6,2.2,'res');
    [bx,by]=P(3.4,10);clusterA('deer',bx,by,3,3);
    [bx,by]=P(4.6,13);clusterA('boar',bx,by,1,2);
    [bx,by]=P(5.3,16);clusterA('boar',bx,by,1,2);
    [bx,by]=P(1.5,7.5);cluster('gold',bx,by,7,2.2,'res');
    [bx,by]=P(2.9,8.5);cluster('stone',bx,by,5,2,'res');
    [bx,by]=P(4.2,9);const pine=nH(bx,by)>.55;
    cluster(pine?'pine':'tree',bx,by,26,4.2,'res');
    [bx,by]=P(5.6,11);cluster('tree',bx,by,14,3.2,'res');
    for(let i=0;i<5;i++){const [x,y]=P(rng()*6.28,5+rng()*6);putRes('tree',x,y)}
    // shrubs
    for(let i=0;i<4;i++){const [x,y]=P(rng()*6.28,5+rng()*8);putRes('shrub',x,y)}
  });
  // ---- global resources ----
  const area=N*N;
  // forests
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(!land(x,y)||used[idx(x,y)])continue;const f=nF(x,y);
    if(f>0.6&&dStart(x,y)>9&&T[idx(x,y)]!==T_SAND&&rng()<0.8){const t=T[idx(x,y)]===T_SAND?'palm':(H[idx(x,y)]>=2||nH(x,y)>.7?'pine':'tree');putRes(t,x,y)}
    else if(T[idx(x,y)]===T_SAND&&dStart(x,y)>9&&rng()<0.025)putRes('palm',x,y);
    else if(dStart(x,y)>8&&rng()<0.008)putRes('tree',x,y);
  }
  // shrubs & scattered
  for(let i=0;i<area/120;i++)putRes('shrub',rng()*N,rng()*N);
  const nGold=Math.round(area/500),nStone=Math.round(area/700);
  const rf=(n)=>{let a=0;while(a<n){const x=rng()*N,y=rng()*N;if(land(x|0,y|0)&&dStart(x,y)>N*0.14&&dl[idx(x|0,y|0)]>0)return[x,y];a++}return null};
  for(let i=0;i<nGold;i++){const p=rf(50);if(p)cluster('gold',p[0],p[1],4+Math.floor(rng()*3),1.8,'res')}
  for(let i=0;i<nStone;i++){const p=rf(50);if(p)cluster('stone',p[0],p[1],3+Math.floor(rng()*3),1.6,'res')}
  for(let i=0;i<area/450;i++){const p=rf(50);if(p)cluster('berries',p[0],p[1],5,1.8,'res')}
  // wildlife
  for(let i=0;i<area/260;i++){const p=rf(50);if(p)clusterA('deer',p[0],p[1],2+Math.floor(rng()*3),2.5)}
  for(let i=0;i<area/600;i++){const p=rf(50);if(p)clusterA('boar',p[0],p[1],1+Math.floor(rng()*2),2)}
  for(let i=0;i<area/500+2;i++){const p=rf(60);if(p&&dStart(p[0],p[1])>N*0.16)clusterA('wolf',p[0],p[1],2+Math.floor(rng()*2),2)}
  for(let i=0;i<area/900;i++){const p=rf(50);if(p)clusterA('sheep',p[0],p[1],2,2)}
  // relics
  let rel=0;for(let tries=0;tries<400&&rel<(N>=80?6:4);tries++){const p=rf(60);if(p&&putRes('relic',p[0],p[1]))rel++}
  // fish
  if(water.some(v=>v)){
    const wp=[];for(let i=0;i<N*N;i++)if(water[i]&&dl[i]>=2&&dl[i]<=6)wp.push(i);
    const target=Math.round(wp.length/24)+4;
    const fishAt=(x,y)=>{if(!inb(x,y)||!water[idx(x,y)]||used[idx(x,y)])return false;used[idx(x,y)]=1;add('res','fish',x,y);return true};
    for(let n=0;n<target&&wp.length;n++){const i=wp[Math.floor(rng()*wp.length)];const cx=i%N,cy=(i/N)|0;const k=3+Math.floor(rng()*4);for(let j=0,t=0;j<k&&t<40;t++){if(fishAt(cx+Math.round((rng()-.5)*5),cy+Math.round((rng()-.5)*5)))j++}}
    // guaranteed fish near each start coast
    starts.forEach(s=>{let best=null,bd=1e9;for(let i of wp){const x=i%N,y=(i/N)|0,d=Math.hypot(x-s.x,y-s.y);if(d<bd){bd=d;best=[x,y]}}
      if(best&&bd<24){for(let g=0;g<2;g++){let a=0;const ang=rng()*6.28;const cx=best[0]+Math.cos(ang)*3,cy=best[1]+Math.sin(ang)*3;for(let j=0,t=0;j<5&&t<60;t++)if(fishAt(Math.round(cx+(rng()-.5)*5),Math.round(cy+(rng()-.5)*5)))j++}}});
  }
  // gold/stone/relic on islets for naval value
  if(md.islets)for(const I of md.islets){cluster('gold',I.x,I.y,4,I.r*0.6,'res');cluster('stone',I.x,I.y,3,I.r*0.6,'res');if(rng()<.7)putRes('relic',I.x+1,I.y+1);cluster('tree',I.x,I.y,8,I.r*.8,'res');clusterA('sheep',I.x,I.y,2,I.r*.6)}
  // islands: extra groves so island economies have wood
  if(type==='islands'){
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(!land(x,y)||used[idx(x,y)]||dStart(x,y)<7||dl[idx(x,y)]!==0||dw[idx(x,y)]<2)continue;if(nF(x*1.7,y*1.7)>0.46&&rng()<0.75)putRes(T[idx(x,y)]===T_SAND?'palm':'tree',x,y)}
    starts.forEach(s=>{for(let k=0;k<5;k++){const a=rng()*6.28,d=9+rng()*6;cluster('tree',s.x+Math.cos(a)*d,s.y+Math.sin(a)*d,14,3.2,'res')}});
  }
  // ---- connectivity (land maps) ----
  if(type!=='islands')ensureConnected(md,starts);
  md.objs.forEach(o=>{o.x=Math.round(o.x);o.y=Math.round(o.y)});
  return md;
}
// Carve land route between all starts (removes trees, smooths cliffs)
function ensureConnected(md,starts){
  const N=md.w,T=md.terr,H=md.hgt;
  const tree=new Map();md.objs.forEach(o=>{if(o.k==='res'&&o.t!=='fish'&&o.t!=='relic')tree.set(o.y*N+o.x,o)});
  function reach(s){
    const seen=new Uint8Array(N*N),q=[s.y*N+s.x];seen[q[0]]=1;
    for(let h=0;h<q.length;h++){const i=q[h],x=i%N,y=(i/N)|0;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=N||Y>=N)continue;const j=Y*N+X;if(seen[j]||T[j]>=3||tree.has(j)||Math.abs(H[j]-H[i])>1)continue;
        if(dx&&dy&&(tree.has(y*N+X)||tree.has(Y*N+x)||T[y*N+X]>=3||T[Y*N+x]>=3))continue;seen[j]=1;q.push(j)}}
    return seen;
  }
  for(let k=1;k<starts.length;k++){
    for(let attempt=0;attempt<3;attempt++){
      const seen=reach(starts[0]);if(seen[starts[k].y*N+starts[k].x])break;
      // A* ignoring trees/cliffs with cost
      const path=carveAStar(md,starts[0],starts[k],tree,md.mtype==='coastal');if(!path)break;
      let prev=null;
      for(const [x,y] of path){const i=y*N+x;if(T[i]>=3){T[i]=T_SAND;H[i]=0;for(const[dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<N&&Y<N&&T[Y*N+X]>=3&&Math.random()<0.0){}}}
        if(tree.has(i)){const o=tree.get(i);md.objs.splice(md.objs.indexOf(o),1);tree.delete(i)}
        if(prev!==null){const ph=H[prev];if(Math.abs(H[i]-ph)>1)H[i]=H[i]>ph?ph+1:ph-1}prev=i;
        // widen
        for(const[dx,dy]of[[1,0],[0,1]]){const X=x+dx,Y=y+dy;if(X<N&&Y<N){const j=Y*N+X;if(tree.has(j)&&T[j]<3){md.objs.splice(md.objs.indexOf(tree.get(j)),1);tree.delete(j)}}}}
      // final smoothing along path neighbours
      for(const [x,y] of path)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=N||Y>=N||T[Y*N+X]>=3)continue;const a=Y*N+X,b=y*N+x;if(H[a]>H[b]+1)H[a]=H[b]+1;else if(H[a]<H[b]-1)H[a]=H[b]-1}
    }
  }
}
function carveAStar(md,a,b,tree,ww){
  const N=md.w,T=md.terr,H=md.hgt,g=new Float32Array(N*N).fill(1e9),from=new Int32Array(N*N).fill(-1),open=[[0,a.y*N+a.x]];g[a.y*N+a.x]=0;
  const hf=i=>Math.hypot((i%N)-b.x,((i/N)|0)-b.y);
  while(open.length){let bi=0;for(let i=1;i<open.length;i++)if(open[i][0]<open[bi][0])bi=i;const [,cur]=open.splice(bi,1)[0];
    if(cur===b.y*N+b.x){const p=[];for(let c=cur;c!==-1;c=from[c])p.push([c%N,(c/N)|0]);return p.reverse()}
    const x=cur%N,y=(cur/N)|0;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=N||Y>=N)continue;const j=Y*N+X;if(T[j]>=3&&!ww)continue;
      let c=g[cur]+(dx&&dy?1.41:1)+(T[j]>=3?4:0)+(tree.has(j)?3:0)+Math.abs(H[j]-H[cur])*2;if(c<g[j]){g[j]=c;from[j]=cur;open.push([c+hf(j),j])}}}
  return null;
}
// serialization
function mdToJSON(md){return{v:1,w:md.w,h:md.h,np:md.np,name:md.name,terr:Array.from(md.terr),hgt:Array.from(md.hgt),objs:md.objs.map(o=>({k:o.k,t:o.t,x:o.x,y:o.y,o:o.o})),starts:md.starts.map(s=>s?{x:s.x,y:s.y}:null),islets:md.islets||undefined}}
function mdFromJSON(j){const md=newMapData(j.w);md.np=j.np||2;md.name=j.name||'Custom';md.terr.set(j.terr);md.hgt.set(j.hgt);md.objs=(j.objs||[]).map(o=>({k:o.k,t:o.t,x:o.x,y:o.y,o:o.o}));md.starts=(j.starts||[]).map(s=>s?{x:s.x,y:s.y}:null);md.custom=true;return md}
