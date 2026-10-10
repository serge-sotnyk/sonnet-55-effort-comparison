'use strict';
// ===== Renderer: terrain, entities, effects, minimap =====
const CAM={x:0,y:0,zoom:1};
let cv,ctx,VW=800,VH=600;
const R={tileCol:null,dland:null,mmImg:null,mmCv:null,ghost:null,hover:null,selIds:new Set(),marks:[],floats:[],editor:false,lastFrame:0};
function iso(x,y,z){return[(x-y)*32,(x+y)*16-(z||0)*LVL]}
function toScr(x,y,z){const ix=(x-y)*32,iy=(x+y)*16-(z||0)*LVL;return[(ix-CAM.x)*CAM.zoom+VW/2,(iy-CAM.y)*CAM.zoom+VH/2]}
function scrToWorld(sx,sy){
  const ix=(sx-VW/2)/CAM.zoom+CAM.x,iy=(sy-VH/2)/CAM.zoom+CAM.y;
  let z=0,x=0,y=0;
  for(let k=0;k<3;k++){const a=ix/32,b=(iy+z*LVL)/16;x=(a+b)/2;y=(b-a)/2;z=(x>=0&&y>=0&&x<G.W&&y<G.H)?G.hgt[Math.floor(y)*G.W+Math.floor(x)]:0}
  return{x,y};
}
function centerOn(x,y){const[ix,iy]=iso(x,y,hAt(x,y));CAM.x=ix;CAM.y=iy}
function hash2(x,y){let h=x*374761393+y*668265263;h=(h^(h>>13))*1274126177;return((h^(h>>16))>>>0)/4294967296}
function renderInit(){
  const W=G.W,H=G.H;
  R.tileCol=new Array(W*H);R.dland=new Uint8Array(W*H).fill(99);
  const q=[];for(let i=0;i<W*H;i++)if(G.terr[i]<3){R.dland[i]=0;q.push(i)}
  for(let h=0;h<q.length;h++){const i=q[h],x=i%W,y=(i/W)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(R.dland[j]>R.dland[i]+1){R.dland[j]=R.dland[i]+1;q.push(j)}}}
  rebuildTileColors();
  R.mmCv=document.createElement('canvas');R.mmCv.width=W;R.mmCv.height=H;
  R.fogCv=document.createElement('canvas');R.fogCv.width=W;R.fogCv.height=H;
  R.fogT=0;R.treeSprites={};
}
function rebuildTileColors(){
  const W=G.W,H=G.H;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,t=G.terr[i],h=G.hgt[i],v=hash2(x,y);
    let r,g,b;
    if(t===T_GRASS){r=104;g=156;b=66;const hh=h*0.11;r+=(255-r)*hh*.5;g+=(255-g)*hh;b+=(255-b)*hh*.45;const n=(v-.5)*14;r+=n;g+=n*1.3;b+=n*.6;
      // big-scale patches
      const p=Math.sin(x*0.21)*Math.cos(y*0.17)*6;g+=p;r-=p*.3}
    else if(t===T_DIRT){r=168;g=134;b=88;const hh=h*0.09;r+=(255-r)*hh;g+=(255-g)*hh;b+=(255-b)*hh;const n=(v-.5)*14;r+=n;g+=n;b+=n*.7}
    else if(t===T_SAND){r=228;g=210;b=150;const n=(v-.5)*10;r+=n;g+=n;b+=n}
    else{r=0;g=0;b=0}
    R.tileCol[i]=t<3?[r|0,g|0,b|0]:null;
  }
}
// ---------- tree sprites ----------
function treeSprite(type,v,stage){
  const key=type+v+stage;if(R.treeSprites[key])return R.treeSprites[key];
  const cv=document.createElement('canvas');cv.width=64;cv.height=84;const c=cv.getContext('2d');c.translate(32,74);
  const sc=stage===0?1:stage===1?0.78:0.5;
  ell(c,0,0,13*sc,5*sc,'rgba(30,50,20,.3)');
  if(type==='palm'){
    ln(c,0,0,3*(v%2?1:-1),-30*sc,4,'#8a6a3a');for(let i=0;i<6;i++)ln(c,0,-24,0,-24,1,'#000');
    const tx=3*(v%2?1:-1),ty=-30*sc;
    for(let i=0;i<7;i++){const a=i/7*TAU+v;const ex=tx+Math.cos(a)*18*sc,ey=ty+Math.sin(a)*7*sc+8*sc;c.beginPath();c.moveTo(tx,ty);c.quadraticCurveTo(tx+Math.cos(a)*10*sc,ty-8*sc,ex,ey);c.lineWidth=3.5;c.strokeStyle=i%2?'#3a8a3a':'#4a9a44';c.stroke()}
    ell(c,tx,ty+1,2.6,2.6,'#6a4a1a')
  }else if(type==='pine'){
    ln(c,0,0,0,-12*sc,4,'#5a3a1e');
    const layers=stage===2?2:4;
    for(let i=0;i<layers;i++){const w=(15-i*3)*sc,y0=-8*sc-i*11*sc;poly(c,[[-w,y0],[w,y0],[0,y0-18*sc]],i%2?'#2f6a3e':'#3a7a46','#1e4a2a');poly(c,[[0,y0-18*sc],[w,y0],[w*.2,y0]],'rgba(0,0,0,.2)')}
  }else{
    const ft=['#4a8a3a','#5a9a44','#3f7a34'];
    ln(c,0,0,0,-20*sc,5,'#6a4426');ln(c,0,-14*sc,-8*sc,-22*sc,2.4,'#6a4426');
    if(stage===2){ell(c,0,-24*sc,8,6,ft[0]);ell(c,0,-4*sc,5,2.5,'#6a4426')}
    else{
    ell(c,-6*sc,-26*sc,11*sc,9*sc,ft[2],'#2a5a22');ell(c,7*sc,-28*sc,11*sc,9*sc,ft[1],'#2a5a22');ell(c,0,-34*sc,12*sc,10*sc,ft[0],'#2a5a22');
    ell(c,-3*sc,-37*sc,6*sc,4*sc,'rgba(190,230,120,.5)');
    if(v%3===0){for(let i=0;i<3;i++)ell(c,-6+i*6,-30*sc+i%2*5,1.5,1.5,'#d33')}}
  }
  R.treeSprites[key]={cv,ox:32,oy:74};return R.treeSprites[key];
}
// ---------- main draw ----------
function resizeCanvas(){R.dpr=Math.min(1.5,window.devicePixelRatio||1);VW=window.innerWidth;VH=window.innerHeight;cv.width=Math.round(VW*R.dpr);cv.height=Math.round(VH*R.dpr)}
function tileRange(){
  // visible tile range from corners (with margin for height)
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const[sx,sy]of[[0,0],[VW,0],[0,VH],[VW,VH]]){const ix=(sx-VW/2)/CAM.zoom+CAM.x,iy=(sy-VH/2)/CAM.zoom+CAM.y;
    for(const z of[0,3]){const a=ix/32,b=(iy+z*LVL)/16,x=(a+b)/2,y=(b-a)/2;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
  return[Math.max(0,Math.floor(x0)-2),Math.min(G.W-1,Math.ceil(x1)+2),Math.max(0,Math.floor(y0)-2),Math.min(G.H-1,Math.ceil(y1)+4)];
}
function drawFrame(now){
  const T=G.time,time=now/1000;
  const dpr=R.dpr||1;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,VW,VH);
  const z=CAM.zoom;
  ctx.setTransform(z*dpr,0,0,z*dpr,(VW/2-CAM.x*z)*dpr,(VH/2-CAM.y*z)*dpr);
  const[x0,x1,y0,y1]=tileRange();
  drawTerrain(x0,x1,y0,y1,time);
  drawFogLayer(x0,x1,y0,y1);
  drawEntities(x0,x1,y0,y1,time);
  drawFx(time);
  drawOverlays(time);
  if(R.extraDraw)R.extraDraw(time);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // vignette
  const g=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*0.45,VW/2,VH/2,Math.max(VW,VH)*0.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(10,8,20,0.35)');ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);
}
function tileVisState(i){ // 0 unexplored,1 explored,2 visible
  if(R.editor||G.cheats.polo)return 2;
  if(G.visNow[i]===2)return 2;
  return G.players[0].exp[i]?1:0;
}
function drawTerrain(x0,x1,y0,y1,time){
  const W=G.W,terr=G.terr,hgt=G.hgt;
  const detail=CAM.zoom>=0.75;
  for(let y=y0;y<=y1;y++){
    for(let x=x0;x<=x1;x++){
      const i=y*W+x,t=terr[i];
      const sx=(x-y)*32,sy=(x+y)*16;
      let fill;
      const wat=t>=3;
      let h=wat?-0.35:hgt[i];
      const zz=h*LVL;
      if(wat){
        const dl=R.dland[i];const w=Math.sin(time*1.3+x*0.55+y*0.7)*0.5+0.5,w2=Math.sin(time*0.9-x*0.3+y*0.45);
        let r,g,b;
        if(t===T_SHALLOW||dl<=2){r=70+w*12+(dl<=1?24:0);g=168+w*14;b=196+w*10}else{const dd=Math.min(1,(dl-2)/6);r=50-dd*22+w*8;g=130-dd*34+w*10;b=186-dd*26+w*8}
        fill='rgb('+(r|0)+','+(g|0)+','+(b|0)+')';
      }else{const c=R.tileCol[i];fill='rgb('+c[0]+','+c[1]+','+c[2]+')'}
      const top=sy-zz;
      ctx.beginPath();ctx.moveTo(sx,top-16);ctx.lineTo(sx+32,top);ctx.lineTo(sx,top+16);ctx.lineTo(sx-32,top);ctx.closePath();
      ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=fill;ctx.lineWidth=1;ctx.stroke();
      if(wat){
        // wave glints + shoreline foam
        if(detail){const w2=Math.sin(time*1.1+x*0.8-y*0.6);if(w2>0.78){ln(ctx,sx-8,top+2,sx-2,top+2,1,'rgba(255,255,255,.35)');ln(ctx,sx+3,top-3,sx+9,top-3,1,'rgba(255,255,255,.25)')}}
        if(R.dland[i]===1){const f=0.35+0.25*Math.sin(time*2+x+y);ctx.globalAlpha=f;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();
          if(x>0&&terr[i-1]<3){ctx.moveTo(sx,top-16);ctx.lineTo(sx-32,top)}
          if(y>0&&terr[i-W]<3){ctx.moveTo(sx,top-16);ctx.lineTo(sx+32,top)}
          if(x<G.W-1&&terr[i+1]<3){ctx.moveTo(sx+32,top);ctx.lineTo(sx,top+16)}
          if(y<G.H-1&&terr[i+W]<3){ctx.moveTo(sx-32,top);ctx.lineTo(sx,top+16)}
          ctx.stroke();ctx.globalAlpha=1}
      }else{
        // side faces
        const hr=x<G.W-1?(terr[i+1]>=3?-0.35:hgt[i+1]):h,hl=y<G.H-1?(terr[i+W]>=3?-0.35:hgt[i+W]):h;
        if(hr<h){const d=(h-hr)*LVL;const rock=(h-hr)>=2;const col=terr[i+1]>=3?'#bfa972':rock?'#7a6a5c':shade(hexOf(R.tileCol[i]),-0.5);poly(ctx,[[sx+32,top],[sx,top+16],[sx,top+16+d],[sx+32,top+d]],col,rock?'rgba(40,30,20,.5)':null);if(rock){for(let k=1;k<(h-hr)*3;k++)ln(ctx,sx+32,top+d*k/((h-hr)*3),sx,top+16+d*k/((h-hr)*3),.7,'rgba(0,0,0,.2)')}}
        if(hl<h){const d=(h-hl)*LVL;const rock=(h-hl)>=2;const col=terr[i+W]>=3?'#cdb77c':rock?'#9a8a78':shade(hexOf(R.tileCol[i]),-0.3);poly(ctx,[[sx-32,top],[sx,top+16],[sx,top+16+d],[sx-32,top+d]],col,rock?'rgba(40,30,20,.5)':null);if(rock){for(let k=1;k<(h-hl)*3;k++)ln(ctx,sx-32,top+d*k/((h-hl)*3),sx,top+16+d*k/((h-hl)*3),.7,'rgba(0,0,0,.2)')}}
        if(hr<h&&terr[i+1]<3){ln(ctx,sx,top+16,sx+32,top,1.4,'rgba(255,255,230,.35)')}
        if(hl<h&&terr[i+W]<3){ln(ctx,sx-32,top,sx,top+16,1.4,'rgba(255,255,230,.5)')}
        // decoration
        if(detail){
          const v=hash2(x*3,y*7);
          if(t===T_GRASS){
            if(v<0.35){const ox=(hash2(x,y+9)-.5)*34,oy=(hash2(y,x+5)-.5)*14;const px=sx+ox,py=top+oy;ln(ctx,px,py,px-1.5,py-4,1,'rgba(60,110,40,.8)');ln(ctx,px+2,py,px+3,py-3.5,1,'rgba(80,130,50,.8)');ln(ctx,px-2,py+1,px-4,py-2.5,1,'rgba(50,100,36,.8)')}
            if(v>0.94){const px=sx+(hash2(x+3,y)-.5)*30,py=top+(hash2(x,y+3)-.5)*12;ell(ctx,px,py,1.6,1.2,['#f4f0a0','#fff','#f0a0c0','#c0a0f0'][(x+y)%4])}
          }else if(t===T_SAND){if(v<0.3){ln(ctx,sx-10,top+3,sx-3,top+4,1,'rgba(180,150,90,.4)');ln(ctx,sx+2,top-3,sx+10,top-2,1,'rgba(180,150,90,.35)')}}
          else if(t===T_DIRT){if(v<0.25){ell(ctx,sx+(v*40-5),top+2,1.8,1.2,'rgba(100,80,50,.5)')}}
        }
      }
    }
  }
}
function hexOf(c){return'rgb('+c[0]+','+c[1]+','+c[2]+')'}
// fog: update small canvas (1 px per tile) then draw tiles overlay
function drawFogLayer(x0,x1,y0,y1){
  if(R.editor)return;
  const W=G.W;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=y*W+x,st=tileVisState(i);if(st===2)continue;
    const h=G.terr[i]>=3?-0.35:G.hgt[i];const sx=(x-y)*32,top=(x+y)*16-h*LVL;
    ctx.fillStyle=st===0?'rgba(6,8,14,1)':'rgba(8,10,20,0.5)';
    ctx.beginPath();ctx.moveTo(sx,top-17);ctx.lineTo(sx+33,top);ctx.lineTo(sx,top+17);ctx.lineTo(sx-33,top);ctx.closePath();ctx.fill();
    const hr=x<G.W-1?(G.terr[i+1]>=3?-0.35:G.hgt[i+1]):h,hl=y<G.H-1?(G.terr[i+W]>=3?-0.35:G.hgt[i+W]):h;
    if(hr<h){const d=(h-hr)*LVL+1;ctx.beginPath();ctx.moveTo(sx+33,top);ctx.lineTo(sx,top+17);ctx.lineTo(sx,top+17+d);ctx.lineTo(sx+33,top+d);ctx.closePath();ctx.fill()}
    if(hl<h){const d=(h-hl)*LVL+1;ctx.beginPath();ctx.moveTo(sx-33,top);ctx.lineTo(sx,top+17);ctx.lineTo(sx,top+17+d);ctx.lineTo(sx-33,top+d);ctx.closePath();ctx.fill()}
  }
}
// ---------- entity pass ----------
function entVisible(e){
  if(R.editor)return true;
  if(e.kind==='u'){if(e.owner>=0&&isFriend(0,e.owner))return true;return seenTile(clamp(Math.floor(e.x),0,G.W-1),clamp(Math.floor(e.y),0,G.H-1))}
  if(e.kind==='b'){if(isFriend(0,e.owner))return true;for(let j=0;j<e.sz;j++)for(let i=0;i<e.sz;i++)if(exploredTile(e.x+i,e.y+j))return true;return false}
  return exploredTile(e.x,e.y)||G.cheats.polo;
}
function onScreen(sx,sy,m){return sx>-m&&sx<VW+m&&sy>-m*1.5&&sy<VH+m}
let _items=[];
function drawEntities(x0,x1,y0,y1,time){
  _items.length=0;
  const mx0=x0-3,mx1=x1+3,my0=y0-3,my1=y1+3;
  for(const r of G.ress){if(r.dead)continue;if(r.x<mx0||r.x>mx1||r.y<my0||r.y>my1)continue;if(!entVisible(r))continue;_items.push([r.x+r.y+1,r,0])}
  for(const b of G.blds){if(b.dead)continue;if(b.x+b.sz<mx0||b.x>mx1||b.y+b.sz<my0||b.y>my1)continue;if(!entVisible(b))continue;_items.push([b.x+b.y+b.sz*(b.def.wall?1:1)-0.01,b,1])}
  for(const u of G.units){if(u.dead||u.inside)continue;if(u.x<mx0||u.x>mx1||u.y<my0||u.y>my1)continue;if(!entVisible(u))continue;_items.push([u.x+u.y,u,2])}
  for(const d of G.decals){if(d.x<mx0||d.x>mx1||d.y<my0||d.y>my1)continue;
    if(d.type==='stump'){if(!exploredTile(clamp(d.x,0,G.W-1),clamp(d.y,0,G.H-1))&&!R.editor)continue;_items.push([d.x+d.y+1-0.5,d,3])}
    else if(d.type==='rubble'){_items.push([d.x+d.y+d.sz-0.5,d,3])}
    else if(d.type==='corpse'){if(!R.editor&&!seenTile(clamp(Math.floor(d.x),0,G.W-1),clamp(Math.floor(d.y),0,G.H-1)))continue;_items.push([d.x+d.y-0.2,d,3])}}
  for(const f of G.fx){if(f.type==='collapse'&&f.bt){_items.push([f.x+f.y+(f.sz||1)*0.5,f,4])}}
  _items.sort((a,b)=>a[0]-b[0]);
  for(const it of _items){
    const e=it[1],k=it[2];
    if(k===0)drawResource(e,time);else if(k===1)drawBuilding(e,time);else if(k===2)drawUnit(e,time);else if(k===3)drawDecal(e,time);else drawCollapse(e,time);
  }
  // health bars & selection UI on top
  for(const it of _items){const e=it[1];if(it[2]===1||it[2]===2)drawBars(e,time)}
  // projectiles
  drawProjectiles(time);
}
function groundPos(e){return[(e.x-e.y)*32,(e.x+e.y)*16-(e.z!==undefined?e.z:hAt(e.x,e.y))*LVL]}
function drawResource(r,time){
  const x=r.x+.5,y=r.y+.5,h=G.hgt[r.y*G.W+r.x];
  let sx=(x-y)*32,sy=(x+y)*16-(r.type==='fish'?-0.35:h)*LVL;
  const t=r.type;
  if(t==='tree'||t==='pine'||t==='palm'){
    const ratio=r.amt/r.max;const stage=ratio>0.66?0:ratio>0.33?1:2;
    const sp=treeSprite(t,r.v,stage);
    ctx.save();ctx.translate(sx,sy);
    if(r.shake>0){ctx.rotate(Math.sin(time*40)*0.05*Math.min(1,r.shake*4))}
    if(!R.editor&&!seenTile(r.x,r.y)&&false){}
    ctx.drawImage(sp.cv,-sp.ox,-sp.oy);ctx.restore();
  }else if(t==='berries'||t==='shrub'){
    const ratio=r.amt/r.max;const n=Math.max(1,Math.ceil(ratio*(t==='berries'?7:5)));
    ctx.save();ctx.translate(sx,sy);
    ell(ctx,0,0,12,5,'rgba(30,50,20,.3)');
    ell(ctx,-5,-6,8,6,'#3f7a34','#2a5a22');ell(ctx,5,-6,8,6,'#4a8a3a','#2a5a22');ell(ctx,0,-10,8,6,'#58a044','#2a5a22');
    for(let i=0;i<n;i++){const a=i*2.4+r.v;const px=Math.cos(a)*8,py=-8+Math.sin(a*1.3)*4;ell(ctx,px,py,t==='berries'?2.2:1.8,t==='berries'?2.2:1.8,t==='berries'?'#d02a40':'#e8d040','rgba(0,0,0,.4)');ell(ctx,px-.6,py-.6,.6,.6,'#fff')}
    ctx.restore();
  }else if(t==='gold'||t==='stone'){
    const ratio=r.amt/r.max,sc=0.55+ratio*0.5;
    ctx.save();ctx.translate(sx,sy);ctx.scale(sc,sc);
    ell(ctx,0,0,16,6,'rgba(0,0,0,.3)');
    const base=t==='gold'?['#8a7a50','#a89868','#7a6a40']:['#8a8e96','#a8acb4','#6a6e76'];
    poly(ctx,[[-14,0],[-10,-12],[-2,-15],[2,-6],[0,0]],base[0],'#2a2a2a');poly(ctx,[[-2,0],[0,-8],[4,-18],[12,-10],[14,0]],base[1],'#2a2a2a');poly(ctx,[[-8,-12],[-2,-15],[0,-8],[-6,-6]],shade(base[1],.2));
    if(t==='gold'){for(const[a,b,s]of[[-6,-6,3],[5,-9,3.4],[8,-3,2.4],[-1,-12,2.6]]){poly(ctx,[[a-s,b],[a,b-s],[a+s,b],[a,b+s*.8]],'#f6d640','#8a6a10');ell(ctx,a-.8,b-.8,.9,.7,'#fffbd0')}
      if(Math.sin(time*3+r.x*7+r.y)>0.93)ell(ctx,0,-10,2.4,2.4,'rgba(255,255,200,.9)')}
    else{for(const[a,b,s]of[[-6,-5,4],[6,-4,3]])poly(ctx,[[a-s,b+2],[a-s*.5,b-s],[a+s*.6,b-s*.8],[a+s,b+2]],'#b4b8c0','#3a3a3a')}
    ctx.restore();
  }else if(t==='fish'){
    ctx.save();ctx.translate(sx,sy);
    const w=Math.sin(time*2+r.x*3);
    ell(ctx,0,2,12,5,'rgba(255,255,255,.12)');
    ell(ctx,0,0,10+w,3.8,null,'rgba(255,255,255,.28)');
    const jump=Math.sin(time*0.7+r.x*5+r.y*3);
    const n=1+(r.amt/r.max>0.5?2:1);
    for(let i=0;i<n;i++){const fx0=(i-1)*7+Math.sin(time*0.8+i)*3,fy0=(i%2?2:-2)+Math.cos(time*0.6+i*2)*1.5;
      ctx.save();ctx.translate(fx0,fy0);ctx.rotate(Math.sin(time*1.5+i)*0.2);
      poly(ctx,[[-6,0],[-2,-3],[3,-2],[6,0],[3,2],[-2,3]],'rgba(60,90,120,.75)');poly(ctx,[[-6,0],[-9,-3],[-9,3]],'rgba(60,90,120,.75)');ell(ctx,3,-.5,.8,.8,'#fff');ctx.restore()}
    if(jump>0.96){const k=(jump-0.96)/0.04;ctx.save();ctx.translate(0,-k*10);poly(ctx,[[-6,0],[-2,-3],[3,-2],[6,0],[3,2],[-2,3]],'#8ab0d0');poly(ctx,[[-6,0],[-9,-3],[-9,3]],'#8ab0d0');ctx.restore()}
    ctx.restore();
  }else if(t==='relic'){
    ctx.save();ctx.translate(sx,sy);
    const gl=0.6+0.4*Math.sin(time*3);
    ell(ctx,0,0,10,4,'rgba(0,0,0,.3)');
    const g=ctx.createRadialGradient(0,-10,2,0,-10,22);g.addColorStop(0,'rgba(255,240,150,'+(0.55*gl)+')');g.addColorStop(1,'rgba(255,240,150,0)');ctx.fillStyle=g;ctx.fillRect(-24,-34,48,48);
    poly(ctx,[[-7,-2],[7,-2],[6,-14],[-6,-14]],'#c9a03a','#5a3a0a');poly(ctx,[[-8,-14],[8,-14],[0,-21]],'#e8c858','#5a3a0a');
    rect(ctx,-1,-12,2,-7,'#fff0a0');rect(ctx,-3,-17,6,1.6,'#fff0a0');
    ell(ctx,0,-8,2,2,'#c33');
    ctx.restore();
  }else if(t==='carcass'){
    ctx.save();ctx.translate(sx,sy);
    const ratio=Math.max(0.3,r.amt/r.max);const ft=r.fromType;
    ell(ctx,0,0,11,4,'rgba(0,0,0,.25)');
    ctx.rotate(0.12);
    if(ft==='sheep'){ell(ctx,0,-4,8*ratio+2,4*ratio+1.5,'#e8e4d8','#9a9588');ell(ctx,7,-3,2.6,2,'#3a3030');for(const lx of[-4,-1,2,5])ln(ctx,lx,-3,lx+1,-8,1.3,'#3a3028')}
    else if(ft==='deer'){ell(ctx,0,-4,9*ratio+2,3.6*ratio+1.5,'#b08050','#7a5a30');ell(ctx,9,-3,3,2,'#b08050');for(const lx of[-5,-2,3,6])ln(ctx,lx,-3,lx+1,-9,1.2,'#6a4a2a')}
    else{ell(ctx,0,-4,9*ratio+2,4*ratio+1.5,'#5a4a42','#2a2018');ell(ctx,9,-3,3.4,2.6,'#4a3a32');for(const lx of[-5,-2,3,6])ln(ctx,lx,-3,lx+1,-9,1.4,'#3a3028')}
    // meat glow
    if(r.amt>5)ell(ctx,0,-6,3,1.6,'rgba(200,50,40,.5)');
    ctx.restore();
  }
}
function drawDecal(d,time){
  if(d.type==='stump'){const sx=(d.x+.5-d.y-.5)*32,sy=(d.x+d.y+1)*16-G.hgt[d.y*G.W+d.x]*LVL;ell(ctx,sx,sy,6,2.6,'rgba(30,20,10,.3)');ell(ctx,sx,sy-2,4.6,2.4,'#7a5a34','#3a2a14');ell(ctx,sx,sy-3,3.4,1.6,'#c8a06a');ln(ctx,sx-2,sy-3,sx+2,sy-3,.6,'#8a6a3a')}
  else if(d.type==='rubble'){
    const a=Math.min(1,(45-(G.time-d.t))/10);ctx.globalAlpha=Math.max(0,a);
    const cx=d.x+d.sz/2,cy=d.y+d.sz/2;const sx=(cx-cy)*32,sy=(cx+cy)*16-hAt(cx,cy)*LVL;
    const n=d.sz*5;for(let i=0;i<n;i++){const hx=hash2(d.x*5+i,d.y*3),hy=hash2(d.y*7+i,d.x);const px=sx+(hx-.5)*d.sz*46,py=sy+(hy-.5)*d.sz*22;ell(ctx,px,py,4+hx*5,2+hy*2.5,['#7a6a58','#5a4a3c','#8a7a68','#4a3a2c'][i%4],'rgba(0,0,0,.4)');if(i%3===0)ln(ctx,px-5,py-1,px+5,py-4-hy*4,1.6,'#6a4a2a')}
    ctx.globalAlpha=1;
  }else if(d.type==='corpse'){
    const age=G.time-d.t;const a=age<9?1:Math.max(0,1-(age-9)/5);
    const gx=(d.x-d.y)*32,gy=(d.x+d.y)*16-d.z*LVL;
    if(d.ship){ // sinking wreck
      const k=Math.min(1,age/3);ctx.globalAlpha=a*(1-k*0.6);ctx.save();ctx.translate(gx,gy+k*14);ctx.rotate(k*0.6);
      const col=d.owner>=0?G.players[d.owner].color:'#888';ell(ctx,0,0,14,5,'#5a3a1a');ln(ctx,-10,-2,10,-8,2,'#3a2a1a');ln(ctx,0,-2,2,-16,2,'#3a2a1a');ctx.restore();ctx.globalAlpha=1;
      ctx.globalAlpha=a*0.6;ell(ctx,gx,gy+2,18+age*3,7+age,null,'rgba(255,255,255,.4)');ctx.globalAlpha=1;return}
    ctx.globalAlpha=a;ctx.save();ctx.translate(gx,gy);
    const df=U[d.ut];const col=d.owner>=0?G.players[d.owner].color:'#aaa';
    const fall=Math.min(1,age/0.5);
    if(df&&df.animal){ctx.rotate(Math.PI/2*fall*0.9);ctx.translate(0,-3*fall);drawAnimal(ctx,{kind:df.k,ph:0,pose:'idle'})}
    else if(df&&(df.cls.includes('cav')||df.cls.includes('siege')||df.k==='tradecart')){ctx.rotate(Math.PI/2*fall*0.4);ctx.translate(0,fall*2);if(df.cls.includes('siege')){ctx.globalAlpha=a*.9;ell(ctx,0,-4,14,5,'#4a3a2a');ln(ctx,-12,-6,10,-3,3,'#5a3a1a')}else drawHorse(ctx,{ph:0,pose:'idle',horse:'#7a5a3a'})}
    else{ctx.rotate(-Math.PI/2*fall);ctx.translate(fall*-4,fall*2);drawHuman(ctx,{col,hat:'none',pose:'idle',ph:0,scale:df?df.size:1})}
    ctx.restore();ctx.globalAlpha=1;
  }
}
function drawCollapse(f,time){
  const k=f.t/f.life;const sp=getBuildingSprite(f.bt,CIVS[G.players[f.bo].civ]?G.players[f.bo].civ:'britons',f.ba,G.players[f.bo].color);
  const cx=f.x,cy=f.y;const sx=(cx-cy)*32,sy=(cx+cy)*16-hAt(cx,cy)*LVL;
  ctx.save();ctx.translate(sx,sy);ctx.globalAlpha=Math.max(0,1-k*1.2);ctx.scale(1+k*0.08,Math.max(0.05,1-k));
  ctx.drawImage(sp.cv,-sp.ox,-sp.oy);ctx.restore();ctx.globalAlpha=1;
}
// ---------- buildings ----------
function drawBuilding(b,time){
  const p=G.players[b.owner],col=p.color;
  const cx=b.cx,cy=b.cy,h=hAt(cx,cy);
  const sx=(cx-cy)*32,sy=(cx+cy)*16-h*LVL;
  const d=b.def;
  if(d.wall){return drawWall(b,time)}
  if(d.farm){return drawFarm(b,time)}
  const age=Math.min(p.age,3);
  const sp=getBuildingSprite(b.type,p.civ,age,col);
  ctx.save();ctx.translate(sx,sy);
  // foundation dirt
  if(!b.built){
    const sz=b.sz;poly(ctx,[pj(-sz/2,-sz/2,0),pj(sz/2,-sz/2,0),pj(sz/2,sz/2,0),pj(-sz/2,sz/2,0)],'rgba(110,80,50,.8)','#4a3018');
    for(let i=0;i<sz*3;i++){const a=pj(-sz/2+i/3,-sz/2,0),c2=pj(-sz/2+i/3,sz/2,0);ln(ctx,a[0],a[1],c2[0],c2[1],.8,'rgba(60,40,20,.5)')}
    const f=b.prog;
    if(f>0.05){
      ctx.save();const hh=sp.cv.height;const vis=Math.max(2,f*hh*0.92);
      ctx.beginPath();ctx.rect(-sp.ox,sp.cv.height-sp.oy-vis-14,sp.cv.width,vis+14);ctx.clip();ctx.globalAlpha=0.96;ctx.drawImage(sp.cv,-sp.ox,-sp.oy);ctx.restore();
      // scaffolding poles
      const sz2=b.sz;for(const[x,y]of[[-sz2/2,sz2/2],[sz2/2,sz2/2],[sz2/2,-sz2/2],[0,sz2/2],[sz2/2,0]]){const a=pj(x,y,0),c2=pj(x,y,10+f*34);ln(ctx,a[0],a[1],c2[0],c2[1],1.6,'#8a6a3a')}
      const t0=pj(-sz2/2,sz2/2,10+f*34),t1=pj(sz2/2,sz2/2,10+f*34),t2=pj(sz2/2,-sz2/2,10+f*34);ln(ctx,t0[0],t0[1],t1[0],t1[1],1.6,'#8a6a3a');ln(ctx,t1[0],t1[1],t2[0],t2[1],1.6,'#8a6a3a');
      const m0=pj(-sz2/2,sz2/2,(10+f*34)/2),m1=pj(sz2/2,sz2/2,(10+f*34)/2);ln(ctx,m0[0],m0[1],m1[0],m1[1],1.2,'#a8844a');
    }else{ // stakes and a few planks
      for(let i=0;i<4;i++){const a=pj(-b.sz/2+i*b.sz/3,b.sz/2,0);ln(ctx,a[0],a[1],a[0],a[1]-9,2,'#8a6a3a')}
      for(let i=0;i<3;i++){const a=pj(0.2+i*.2,0.1,0);ln(ctx,a[0]-5,a[1]-2*i,a[0]+5,a[1]-2*i-1,2.4,'#a8844a')}
    }
    ctx.restore();return;
  }
  // built
  let alpha=1;
  if(b.flash>0){ctx.filter='brightness('+(1+b.flash*0.5)+')'}
  ctx.drawImage(sp.cv,-sp.ox,-sp.oy);
  ctx.filter='none';
  const info=sp.info||{};
  // live parts
  if(info.blades){drawBlades(info.blades,info.bladeR,time,col,b.id)}
  if(info.flag){drawFlag(info.flag[0],info.flag[1],col,time,b.id)}
  if(info.smoke&&(b.type!=='smith'||true)){drawSmoke(info.smoke[0],info.smoke[1],time,b.id,b.queue.length>0||b.type==='house'||b.type==='towncenter')}
  if(info.fire){const f=info.fire;const fl=Math.sin(time*9+b.id);ell(ctx,f[0]+4,f[1]-4,3.4+fl*.6,3.4,'rgba(255,150,40,.85)');ell(ctx,f[0]+4,f[1]-5,1.8,2,'rgba(255,240,150,.9)')}
  if(b.queue.length&&['barracks','archery','stable','siege','castle','towncenter','monastery','university','blacksmith','market','dock'].includes(b.type)){const k=b.queue[0];const f=k.prog/k.tot;const w=b.sz*16;const yy=-(sp.oy*0.0)-b.sz*16-4;rect(ctx,-w/2,b.sz*16+6,w,4,'rgba(0,0,0,.6)');rect(ctx,-w/2+1,b.sz*16+7,(w-2)*f,2,k.k==='t'?'#8ac0ff':'#f0d050')}
  if(b.type==='monastery'&&b.relics>0){for(let i=0;i<Math.min(b.relics,5);i++){const a=pj(-.9+i*.45,1.15,0);poly(ctx,[[a[0]-3,a[1]],[a[0]+3,a[1]],[a[0]+2,a[1]-7],[a[0]-2,a[1]-7]],'#e8c858','#5a3a0a');ell(ctx,a[0],a[1]-10,2.4+Math.sin(time*3+i)*.4,2.4,'rgba(255,240,150,.6)')}}
  // damage
  const hp=b.hp/b.mh;
  if(hp<0.7){const n=hp<0.35?5:3;for(let i=0;i<n;i++){const hx=hash2(b.id+i,3),hy=hash2(b.id,i+9);const px=(hx-.5)*b.sz*34,py=-8-hy*(14+b.sz*8);
      ln(ctx,px,py,px+5,py+7,1.2,'rgba(30,20,10,.7)');ln(ctx,px+5,py+7,px+2,py+11,1.2,'rgba(30,20,10,.7)');}
    if(hp<0.5){const fx0=(hash2(b.id,1)-.5)*b.sz*20,fy0=-14-b.sz*6;drawFlame(fx0,fy0,time,b.id,hp<0.3?1.5:1);drawSmoke(fx0,fy0-4,time,b.id+3,true,1.6)}
    if(hp<0.3){drawFlame(b.sz*8,-10-b.sz*4,time,b.id+9,1.2);drawFlame(-b.sz*9,-8-b.sz*3,time,b.id+11,1)}}
  ctx.restore();
}
function drawBlades(h,R0,time,col,id){
  const spin=time*0.8+id;const hx=h[0],hy=h[1];
  ln(ctx,hx,hy,hx,hy+6,3,'#3a2a1a');
  for(let i=0;i<4;i++){const a=spin+i*Math.PI/2;const ex=hx+Math.cos(a)*R0,ey=hy+Math.sin(a)*R0*0.85;
    ln(ctx,hx,hy,ex,ey,2.2,'#5a3a1a');const px=Math.cos(a+Math.PI/2),py=Math.sin(a+Math.PI/2);
    poly(ctx,[[hx+Math.cos(a)*R0*0.25,hy+Math.sin(a)*R0*0.2],[ex,ey],[ex+px*7,ey+py*6],[hx+Math.cos(a)*R0*0.25+px*7,hy+Math.sin(a)*R0*0.2+py*5]],i%2?'#efe6cf':col,'#555')}
  ell(ctx,hx,hy,3,3,'#3a2a1a');
}
function drawFlag(x,y,col,time,id){
  const w=Math.sin(time*3+id)*2.2,w2=Math.sin(time*3+id+1.2)*2.2;
  ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+7,y+1+w,x+16,y+2+w2);ctx.lineTo(x+14,y+8+w2);ctx.quadraticCurveTo(x+7,y+7+w,x,y+9);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.arc(x+6,y+4.5,2,0,TAU);ctx.fillStyle='rgba(255,255,255,.5)';ctx.fill();
}
function drawSmoke(x,y,time,id,on,sc){
  if(!on)return;sc=sc||1;
  for(let i=0;i<5;i++){const t=((time*0.35+i/5+id*.13)%1);const a=(1-t)*0.45;ctx.globalAlpha=a;ell(ctx,x+Math.sin(t*5+id)*4*sc+t*9,y-t*34*sc,(3+t*6)*sc,(2.4+t*4)*sc,'#cfd2d6')}
  ctx.globalAlpha=1;
}
function drawFlame(x,y,time,id,sc){
  sc=sc||1;for(let i=0;i<3;i++){const f=Math.sin(time*11+id+i*2)*2;const w=(5-i)*sc;poly(ctx,[[x-w+i*2,y],[x+f*.4+i,y-(11+i*2)*sc-f],[x+w-i*2,y]],['rgba(255,80,20,.9)','rgba(255,170,40,.9)','rgba(255,240,120,.9)'][i])}
}
function drawWall(b,time){
  const p=G.players[b.owner];const x=b.x,y=b.y,age=Math.min(3,p.age);const st=bstyle(p.civ,Math.max(2,age));
  const hh=18;const h=hAt(b.cx,b.cy);
  const sx=(b.cx-b.cy)*32,sy=(b.cx+b.cy)*16-h*LVL;
  ctx.save();ctx.translate(sx,sy);
  const isW=(tx,ty)=>{if(tx<0||ty<0||tx>=G.W||ty>=G.H)return false;const id=G.occ[ty*G.W+tx];const o=id?G.byId.get(id):null;return o&&!o.dead&&o.def.wall&&isFriend(o.owner,b.owner)};
  const nE=isW(x+1,y),nS=isW(x,y+1),nW=isW(x-1,y),nN=isW(x,y-1);
  const f=b.built?1:b.prog;const H0=hh*Math.max(0.15,f);
  const wc=shade(st.wall,-.05);
  // arms toward neighbours (+x right-down, +y left-down)
  if(nN)blk(ctx,-.22,.22,-.5,0,0,H0,{wall:wc,kind:'stone',trim:st.trim,age:st.age},{});
  if(nW)blk(ctx,-.5,0,-.22,.22,0,H0,{wall:wc,kind:'stone',trim:st.trim,age:st.age},{});
  if(b.def.gate){
    // gate: two posts and arch, opens when friendly unit near
    let open=false;near(b.cx,b.cy,1.6,e=>{if(e.kind==='u'&&isFriend(b.owner,e.owner)){open=true;return true}});
    blk(ctx,-.5,-.25,-.5,.5,0,H0+4,{wall:wc,kind:'stone',trim:st.trim,age:st.age},{});blk(ctx,.25,.5,-.5,.5,0,H0+4,{wall:wc,kind:'stone',trim:st.trim,age:st.age},{});
    if(!open||!b.built){poly(ctx,[pj(-.25,.5,0),pj(.25,.5,0),pj(.25,.5,H0),pj(-.25,.5,H0)],'#4a3018','#1a0e06');for(let i=0;i<4;i++){const a=pj(-.2+i*.13,.5,0),c2=pj(-.2+i*.13,.5,H0);ln(ctx,a[0],a[1],c2[0],c2[1],1,'#222')}}
    else poly(ctx,[pj(-.25,.5,0),pj(.25,.5,0),pj(.25,.5,H0),pj(-.25,.5,H0)],'rgba(10,8,6,.85)');
    blk(ctx,-.5,.5,-.5,.5,H0+4,4,{wall:shade(wc,.1),kind:'stone',trim:st.trim,age:st.age},{});
    ln(ctx,...pj(0,0,H0+8),...pj(0,0,H0+20),1.4,'#3a2a1a');poly(ctx,[[...pj(0,0,H0+20)],[pj(0,0,H0+20)[0]+9,pj(0,0,H0+20)[1]+2],[pj(0,0,H0+20)[0]+7,pj(0,0,H0+20)[1]+6],[pj(0,0,H0+20)[0],pj(0,0,H0+20)[1]+6]],p.color,'#222');
  }else{
    blk(ctx,-.28,.28,-.28,.28,0,H0+4,{wall:wc,kind:'stone',trim:st.trim,age:st.age},{});
    if(nE)blk(ctx,0,.5+0.0,-.22,.22,0,H0,{wall:wc,kind:'stone',trim:st.trim,age:st.age},{});
    if(nS)blk(ctx,-.22,.22,0,.5,0,H0,{wall:wc,kind:'stone',trim:st.trim,age:st.age},{});
    // crenellation tops
    if(b.built){for(const[a,c2]of[[-.28,-.28]]){}}
  }
  ctx.restore();
  // hp tint
  if(b.built&&b.hp/b.mh<0.5){ctx.save();ctx.translate(sx,sy);drawSmoke(0,-18,time,b.id,true)}
  if(b.built&&b.hp/b.mh<0.5)ctx.restore();
}
function drawFarm(b,time){
  const h=hAt(b.cx,b.cy);const sx=(b.cx-b.cy)*32,sy=(b.cx+b.cy)*16-h*LVL;const sz=b.sz;
  ctx.save();ctx.translate(sx,sy);
  const ratio=b.farm?b.farm.amt/b.farm.max:1;
  poly(ctx,[pj(-sz/2,-sz/2,0),pj(sz/2,-sz/2,0),pj(sz/2,sz/2,0),pj(-sz/2,sz/2,0)],'#6a4a2a','#3a2a14');
  const f=b.built?1:b.prog;
  const n=6;
  for(let i=0;i<n;i++){const t=(i+.5)/n;const a=pj(-sz/2+0.1,-sz/2+sz*t,0),c2=pj(sz/2-.1,-sz/2+sz*t,0);ln(ctx,a[0],a[1],c2[0],c2[1],3.4,i%2?'#5a3a20':'#7a5230');
    if(f>0.3){const cnt=Math.floor(11*Math.min(1,f)*(0.25+0.75*ratio));for(let k=0;k<cnt;k++){const u=(k+.5)/11;const p=pj(-sz/2+.2+(sz-.4)*u,-sz/2+sz*t,0);const sway=Math.sin(time*2+k+i)*0.8;const gold=ratio<.99?ratio:1;
      ln(ctx,p[0],p[1],p[0]+sway,p[1]-5-(1-ratio)*0,1.2,ratio>0.5?'#c8b840':'#8aa040');ell(ctx,p[0]+sway,p[1]-6,1.2,2,ratio>0.5?'#e8d050':'#a8b848')}}}
  // fence corners
  for(const[x,y]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const p=pj(x*sz/2,y*sz/2,0);ln(ctx,p[0],p[1],p[0],p[1]-6,1.8,'#5a3a1a')}
  if(b.farm&&b.farm.amt<=0.5&&b.built){ctx.globalAlpha=.6;ell(ctx,0,0,26,12,'rgba(60,40,20,.6)');ctx.globalAlpha=1}
  ctx.restore();
}

// ---------- units ----------
const HUM={
 villager:{hat:'straw'},militia:{hat:'cap',tool:'sword',shield:1},manatarms:{hat:'kettle',tool:'sword',shield:1,armor:'#8a8e96'},
 longsword:{hat:'nasal',tool:'sword',shield:1,armor:'#9aa0a8'},twohand:{hat:'great',tool:'sword2',armor:'#a8aeb6'},champion:{hat:'plume',tool:'sword2',armor:'#c4c9d0',cape:1,scale:1.08},
 spearman:{hat:'cap',tool:'spear',shield:1},pikeman:{hat:'kettle',tool:'pike',armor:'#8a8e96'},halberdier:{hat:'nasal',tool:'halberd',armor:'#9aa0a8'},
 archer:{hat:'hood',tool:'bow',quiver:1},crossbow:{hat:'kettle',tool:'xbow'},arbalest:{hat:'nasal',tool:'xbow',armor:'#9aa0a8'},
 skirm:{hat:'cap',tool:'jav',quiver:1},eliteskirm:{hat:'kettle',tool:'jav',quiver:1,armor:'#7a6a50'},
 monk:{hat:'monk',robe:'#d8c8a8',tool:'staff'},
 longbowman:{hat:'hood',hoodCol:'#2a5a2a',tool:'bow',quiver:1,bowCol:'#3a2210',scale:1.12},throwaxe:{hat:'horned',tool:'axe2',armor:'#8a6a4a',scale:1.05},
 huskarl:{hat:'horned',tool:'sword',shield:1,shieldCol:'#3a3a40',armor:'#7a7e86',scale:1.08},samurai:{hat:'kabuto',tool:'katana',armor:'#a02020',scale:1.05},
 berserk:{hat:'wild',tool:'axe2',bare:1,scale:1.1},tknight:{hat:'tknight',tool:'sword',shield:1,shieldCol:'#f0f0f0',armor:'#d4d8de',cape:'#f2f2f2',scale:1.12},chukonu:{hat:'conical',tool:'xbow',quiver:1},
};
const CAV={scout:{horse:'#b08a5a',hat:'cap',tool:'lance',scale:.95},lightcav:{horse:'#a07a4a',hat:'kettle',tool:'lance',scale:.97},hussar:{horse:'#7a5a3a',hat:'plume',tool:'sword',scale:1,cape:1},
 knight:{horse:'#6a4a2e',hat:'great',tool:'lance',barding:1,scale:1.1},cavalier:{horse:'#5a3a22',hat:'plume',tool:'lance',barding:1,scale:1.14},paladin:{horse:'#e8e8e8',hat:'plume',tool:'lance',barding:1,scale:1.18},
 cavarcher:{horse:'#8a6a44',hat:'mongol',tool:'bow',scale:1},hcavarcher:{horse:'#7a5a38',hat:'mongol',tool:'bow',scale:1.05,blanket:1},mangudai:{horse:'#6a5a4a',hat:'mongol',tool:'bow',scale:1.02,blanket:1},
 cataphract:{horse:'#4a3a30',hat:'great',tool:'lance',barding:1,scale:1.15,gold:1},mameluke:{horse:'#c8a870',hat:'turban',tool:'sword',scale:1.05,camel:1,blanket:1}};
function toolFor(u){
  const w=u.workType;
  if(w==='tree'||w==='pine'||w==='palm')return['axe','chop',1.1];
  if(w==='gold'||w==='stone')return['pick','mine',1.3];
  if(w==='build'||w==='repair')return['hammer',w,1.7];
  if(w==='farm')return['hoe','farm',0.8];
  if(w==='berries'||w==='shrub'||w==='carcass')return[null,w==='carcass'?'hunt':'berries',1.2];
  if(w==='hunt')return['spear','hunt',1];
  if(w==='fish')return[null,'fish',1];
  return[null,'',1];
}
function drawUnit(u,time){
  const d=u.def,p=u.owner>=0?G.players[u.owner]:null;
  const col=p?p.color:'#c8c4b8';
  const[gx,gy]=groundPos(u);
  const sdx=u.fx-u.fy;if(Math.abs(sdx)>0.12)u.flip=sdx<0?-1:1;
  const flip=u.flip||1,front=(u.fx+u.fy)>0;
  const sel=R.selIds.has(u.id),hov=R.hover===u.id;
  ctx.save();ctx.translate(gx,gy);
  const isS=d.cls.includes('ship');
  // ring / shadow
  const rr=isS?22:d.cls.includes('siege')?17:d.cls.includes('cav')?15:11;
  if(!isS)ell(ctx,0,0,rr*0.8,rr*0.34,'rgba(20,30,10,.3)');
  if(d.animal&&u.owner>=0){ // sheep ownership ring
    ell(ctx,0,0,rr*0.95,rr*0.42,'rgba('+hexRGB(col)+',.28)',col);
    if(u.capFlash>0){u.capFlash-=0.016;const k=1-u.capFlash/1.2;ctx.globalAlpha=Math.max(0,1-k);ell(ctx,0,0,rr*(1+k*2.5),rr*(.45+k),null,col);ctx.globalAlpha=1}
  }
  if(sel||hov){ctx.lineWidth=sel?2:1.4;ctx.strokeStyle=sel?'#fff':'rgba(255,255,255,.6)';ctx.beginPath();ctx.ellipse(0,0,rr,rr*0.45,0,0,TAU);ctx.stroke();if(sel){ctx.strokeStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,rr-2,rr*0.45-1,0,0,TAU);ctx.stroke()}}
  if(u.recharging&&p){ctx.strokeStyle='rgba(120,160,255,.7)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,rr+4,rr*0.45+2,0,0,TAU*Math.max(0.05,1-(u.convCd-G.time)/30));ctx.stroke()}
  // pose
  let pose='idle',ph=time*7*Math.max(.7,Math.min(2,sget(u,'spd')/1.25))+u.id*1.7,workPh=0,workKind='',tool=null;
  if(u.moving)pose='walk';
  if(u.working){
    if(u.t==='attack'||u.t==='amove'||u.workType===undefined&&u.hitE){pose='attack';workKind='attack';workPh=u.at>0?1-u.at/(u.atMax||.6):0.62}
    else if(u.workType==='hunt'&&u.t==='attack'){}
    else{const[tl,wk,rate]=toolFor(u);tool=tl;workKind=wk;pose='work';workPh=time*rate+u.id*0.37;if(u.workType==='hunt'&&u.at>0){workPh=1-u.at/(u.atMax||.45)}
      if(u.workType==='heal'||u.workType==='convert'){pose='work';workKind=u.workType}}
  }
  if(u.t==='attack'&&u.at>0&&!u.working){pose='attack';workPh=1-u.at/(u.atMax||.6)}
  const sc=d.size||1;
  const wv=u.wolfAng;
  // draw
  if(isS){
    const fxv=u.fx,fyv=u.fy,k=1.05;
    const proj=(a,b,h)=>{const wx=(a*fxv-b*fyv)*k,wy=(a*fyv+b*fxv)*k;return[(wx-wy)*0.72,(wx+wy)*0.36-h]};
    const kind=d.k==='fishing'?'fishing':d.k==='transport'?'transport':d.k==='galley'?'galley':d.k==='fire'?'fire':d.k==='demo'?'demo':'tradecog';
    ctx.translate(0,-2);ctx.scale(1.55,1.55);
    drawShip(ctx,{col,kind,ph:time*3+u.id,pose:u.moving?'walk':'idle',work:u.working,at:u.at,cargo:u.cargo?u.cargo.length:0},proj);
  }else{
    ctx.scale(flip,1);
    const k=d.k;
    if(d.animal){drawAnimal(ctx,{kind:k,ph:time*8+u.id,pose:u.moving?'walk':'idle',tag:u.owner>=0?col:null,angry:u.t==='attack',eat:k==='sheep'&&!u.moving&&Math.sin(time*.8+u.id)>0.3})}
    else if(k==='ram')drawRam(ctx,{col,ph:time*4+u.id,pose,at:u.at,workPh:u.at>0?(1-u.at/(u.atMax||.6)):0,scale:1})
    else if(k==='mangonel'||k==='onager')drawMangonel(ctx,{col,ph:time*4+u.id,pose,at:u.at,atMax:u.atMax})
    else if(k==='scorpion'||k==='heavyscorp')drawScorpion(ctx,{col,ph:time*4+u.id,pose,at:u.at})
    else if(k==='trebuchet')drawTrebuchet(ctx,{col,ph:time*4+u.id,pose,at:u.at,atMax:u.atMax});
    else if(k==='tradecart')drawCart(ctx,{col,ph:time*5+u.id,pose});
    else if(k==='cobra')drawCar(ctx,{ph:time*6,pose:u.t==='attack'&&u.working?'attack':u.moving?'walk':'idle'});
    else if(CAV[k]){
      const cv=CAV[k];
      const rider=(c)=>{
        const ro={col,hat:cv.hat,tool:cv.tool==='lance'?(pose==='attack'?'sword':'lance'):cv.tool,pose:pose==='walk'?'idle':pose,ph:0,front,sit:1,workPh,workKind,at:undefined,scale:0.9,cape:cv.cape?col:undefined,armor:cv.barding?'#aab0b8':undefined,shield:0};
        if(cv.tool==='lance'){ro.tool='lance';ro.pose='idle'; if(pose==='attack'){ro.tool='lance'}}
        if(cv.tool==='bow'){ro.tool='bow';ro.pose=pose==='attack'?'attack':'idle'}
        drawHuman(c,ro);
        if(cv.tool==='lance'&&pose==='attack'){const th=Math.sin(workPh*TAU)*5;drawTool(c,'lance',6+th,-19,0.05,col)}
      };
      drawHorse(ctx,{ph:time*9+u.id,pose:u.moving?'walk':'idle',horse:cv.horse,barding:cv.barding?col:null,blanket:cv.blanket?col:null,camel:cv.camel,scale:cv.scale,rider});
    }else{
      const h=HUM[k]||HUM.militia;
      const o={col,hat:h.hat,tool:h.tool,shield:h.shield,shieldCol:h.shieldCol,armor:h.armor,cape:h.cape===1?col:h.cape,quiver:h.quiver,hoodCol:h.hoodCol,bowCol:h.bowCol,robe:h.robe,scale:h.scale||sc,pose,ph,front,workPh,workKind,work:workKind,carry:u.carry,legc:h.bare?'#6a5a4a':undefined};
      if(k==='villager'){o.tool=tool;o.hat='straw';o.skin=SKIN[u.id%4];
        if(pose==='attack'){o.tool='knife'}
        if(u.workType==='hunt'&&pose==='work'){o.tool='spear'}}
      else o.skin=SKIN[(u.id>>1)%4];
      if(h.bare){o.col=SKIN[1];o.armor=null}
      if(k==='monk'){o.col='#8a6a48';o.robe='#d8c8a8';o.tool='staff';if(workKind==='heal'||workKind==='convert'){o.pose='work'}}
      if(u.relicCarry){o.tool=null}
      // spear/jav animation keyed by at progress
      drawHuman(ctx,o);
      if(k==='monk'&&workKind==='heal'){ctx.globalAlpha=.55;const g=ctx.createRadialGradient(0,-20,2,0,-20,18);g.addColorStop(0,'rgba(120,255,140,.9)');g.addColorStop(1,'rgba(120,255,140,0)');ctx.fillStyle=g;ctx.fillRect(-20,-40,40,40);ctx.globalAlpha=1}
      if(k==='monk'&&workKind==='convert'){ctx.globalAlpha=.7;const g=ctx.createRadialGradient(0,-20,2,0,-20,20);g.addColorStop(0,'rgba(160,190,255,.95)');g.addColorStop(1,'rgba(160,190,255,0)');ctx.fillStyle=g;ctx.fillRect(-22,-42,44,44);ctx.globalAlpha=1}
      if(u.relicCarry){ctx.save();ctx.translate(0,-34+Math.sin(time*3)*1);poly(ctx,[[-4,0],[4,0],[3,-7],[-3,-7]],'#e8c858','#5a3a0a');poly(ctx,[[-5,-7],[5,-7],[0,-12]],'#f4d868','#5a3a0a');ell(ctx,0,-6,9,8,'rgba(255,240,150,.25)');ctx.restore()}
    }
  }
  ctx.restore();
}
function hexRGB(c){let h=c.replace('#','');return parseInt(h.substr(0,2),16)+','+parseInt(h.substr(2,2),16)+','+parseInt(h.substr(4,2),16)}
function hpColor(f){return f>0.6?'#4cd04c':f>0.3?'#e8c030':'#e03a30'}
function drawBars(e,time){
  const sel=R.selIds.has(e.id),hov=R.hover===e.id;
  if(e.kind==='u'){
    const dmg=e.hp<e.mh;if(!sel&&!hov&&!dmg&&!(e.convProg>0))return;
    const[gx,gy]=groundPos(e);const h=e.def.cls.includes('ship')?36:e.def.cls.includes('cav')?44:e.def.cls.includes('siege')?36:38;
    const w=e.def.cls.includes('ship')?30:20;
    if(e.hp<e.mh||sel||hov){rect(ctx,gx-w/2-1,gy-h-1,w+2,5,'rgba(0,0,0,.75)');rect(ctx,gx-w/2,gy-h,w*Math.max(0,e.hp/e.mh),3,hpColor(e.hp/e.mh))}
    if(e.convProg>0&&e.convT>0){e.convT-=0.016;ctx.strokeStyle='rgba(150,180,255,.9)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(gx,gy-h-10,6,-Math.PI/2,-Math.PI/2+TAU*e.convProg);ctx.stroke();ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(gx,gy-h-10,7.5,0,TAU);ctx.stroke()}
    if(sel&&e.cargo&&e.cargo.length){ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(e.cargo.length+'/'+(e.def.tcap+G.players[e.owner].f.tcap),gx,gy-h-14)}
    if(e.carry&&e.carry.n>=1&&(sel)){ctx.fillStyle=RCOL[e.carry.r];ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText(Math.floor(e.carry.n),gx+14,gy-26)}
  }else{
    const b=e;const dmg=b.hp<b.mh&&b.built||(!b.built);
    const h=hAt(b.cx,b.cy);const sx=(b.cx-b.cy)*32,sy=(b.cx+b.cy)*16-h*LVL;
    if(sel||hov){ // footprint outline
      const sz=b.sz;ctx.strokeStyle=sel?'#fff':'rgba(255,255,255,.55)';ctx.lineWidth=sel?2.2:1.4;
      const pts=[pj(-sz/2,-sz/2,0),pj(sz/2,-sz/2,0),pj(sz/2,sz/2,0),pj(-sz/2,sz/2,0)];ctx.beginPath();ctx.moveTo(sx+pts[0][0],sy+pts[0][1]);for(let i=1;i<4;i++)ctx.lineTo(sx+pts[i][0],sy+pts[i][1]);ctx.closePath();ctx.stroke();
      if(sel){ctx.strokeStyle=G.players[b.owner].color;ctx.lineWidth=1;ctx.stroke()}}
    if(sel||hov||(b.hp<b.mh&&b.built)||!b.built){
      const w=Math.max(30,b.sz*20),yy=sy-(b.def.wall?30:b.sz*16+(b.type==='castle'?70:b.type==='towncenter'?58:b.type==='tower'?58:40));
      rect(ctx,sx-w/2-1,yy-1,w+2,6,'rgba(0,0,0,.75)');
      if(b.built)rect(ctx,sx-w/2,yy,w*Math.max(0,b.hp/b.mh),4,hpColor(b.hp/b.mh));else{rect(ctx,sx-w/2,yy,w*b.prog,4,'#5ab0ff')}
      if(b.gar.length&&(sel||hov)){ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('⛨ '+b.gar.length+'/'+garCap(b),sx,yy-4)}
    }
    if(sel&&b.rally){const rp=b.rally;const[rx,ry]=iso(rp.x,rp.y,hAt(rp.x,rp.y));ctx.strokeStyle='rgba(255,255,100,.8)';ctx.setLineDash([5,4]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(rx,ry);ctx.stroke();ctx.setLineDash([]);
      ln(ctx,rx,ry,rx,ry-16,1.6,'#ddd');poly(ctx,[[rx,ry-16],[rx+10,ry-13],[rx,ry-10]],G.players[b.owner].color,'#222')}
    if(b.repairing>0){}
  }
}
// ---------- projectiles & fx ----------
function drawProjectiles(time){
  for(const p of G.proj){
    if(p.t<0)continue;const k=Math.min(1,p.t/p.dur);
    const x=p.x0+(p.x1-p.x0)*k,y=p.y0+(p.y1-p.y0)*k;
    const dist=hyp(p.x1-p.x0,p.y1-p.y0);const arc=p.type==='bolt'?dist*0.05:p.type==='rock'?dist*0.55:dist*0.28;
    const z0=(p.z0||0.6),z1=(p.eh||0)+0.5;
    const zz=(z0+(z1-z0)*k)+Math.sin(k*Math.PI)*arc*(p.type==='rock'?1:0.8);
    const sx=(x-y)*32,sy=(x+y)*16-zz*LVL*(p.type==='arrow'?1:1);
    const k2=Math.min(1,Math.max(0,k-0.06));const xb=p.x0+(p.x1-p.x0)*k2,yb=p.y0+(p.y1-p.y0)*k2;const zb=(z0+(z1-z0)*k2)+Math.sin(k2*Math.PI)*arc*(p.type==='rock'?1:0.8);
    const bx=(xb-yb)*32,by=(xb+yb)*16-zb*LVL;
    if(p.type==='rock'){ell(ctx,(x-y)*32,(x+y)*16-(z1)*LVL,4,2,'rgba(0,0,0,.3)');ell(ctx,sx,sy,3.6,3.6,'#6a6a70','#222');ell(ctx,sx-1,sy-1,1.2,1.2,'#aaa')}
    else if(p.type==='axe'){ctx.save();ctx.translate(sx,sy);ctx.rotate(time*20);ln(ctx,-4,0,4,0,1.4,'#7a5230');poly(ctx,[[2,-1],[6,-4],[6,3]],'#bbb');ctx.restore()}
    else{ln(ctx,bx,by,sx,sy,p.type==='bolt'?2:1.3,p.type==='bolt'?'#6a4a2a':'#e8dcc0');ln(ctx,sx,sy,sx+(sx-bx)*.2,sy+(sy-by)*.2,1.6,'#c0c4cc')}
  }
}
function drawFx(time){
  for(const f of G.fx){
    const k=f.t/f.life;const s=f.s||(f.s=Math.random());
    const sx=(f.x-f.y)*32,sy=(f.x+f.y)*16-(f.z||0)*LVL;
    switch(f.type){
      case'chip':{for(let i=0;i<4;i++){const a=i*1.7+s*6;const px=sx+Math.cos(a)*k*14,py=sy-8-Math.sin(k*3.1)*14+Math.sin(a)*3+k*8;ctx.globalAlpha=1-k;rect(ctx,px,py,2.4,1.6,i%2?'#c8a06a':'#8a5a30')}ctx.globalAlpha=1;break}
      case'spark':{ctx.globalAlpha=1-k;for(let i=0;i<4;i++){const a=i*1.57+s*6;const px=sx+Math.cos(a)*k*12,py=sy-10-Math.sin(k*3)*10+k*6;ell(ctx,px,py,1.5,1.5,f.c==='gold'?'#ffe060':'#e0e4ea')}ctx.globalAlpha=1;break}
      case'dust':{const n=(f.sz||1)*4;ctx.globalAlpha=0.5*(1-k);for(let i=0;i<n;i++){const a=i/n*TAU+s;const r=(f.sz||1)*20*k;ell(ctx,sx+Math.cos(a)*r,sy-4+Math.sin(a)*r*.45-k*8,6+k*8,4+k*5,'#d8ccb0')}ctx.globalAlpha=1;break}
      case'repair':{ctx.globalAlpha=1-k;ell(ctx,sx,sy-16-k*14,1.6,1.6,'#ffb040');ln(ctx,sx-3,sy-24-k*14,sx+3,sy-24-k*14,1.6,'#ffb040');ln(ctx,sx,sy-27-k*14,sx,sy-21-k*14,1.6,'#ffb040');ctx.globalAlpha=1;break}
      case'heal':{ctx.globalAlpha=1-k;const py=sy-26-k*22;ln(ctx,sx-4,py,sx+4,py,2.6,'#5aff7a');ln(ctx,sx,py-4,sx,py+4,2.6,'#5aff7a');ctx.globalAlpha=1;break}
      case'convert':{ctx.globalAlpha=1-k;const r=f.big?30:12;for(let i=0;i<6;i++){const a=i/6*TAU+k*9;ell(ctx,sx+Math.cos(a)*r*(.4+k*.6),sy-16+Math.sin(a)*r*.4-k*20,2,2,'#bcd0ff')}if(f.big){ell(ctx,sx,sy-14,r*k*1.2,r*k*.5,null,'#cfe0ff')}ctx.globalAlpha=1;break}
      case'capture':{ctx.globalAlpha=1-k;ell(ctx,sx,sy,14+k*40,6+k*17,null,f.c||'#fff');ell(ctx,sx,sy,8+k*25,3+k*10,null,'#fff');ctx.globalAlpha=1;break}
      case'boom':{const r=(f.r||1)*28;const a=1-k;
        const g=ctx.createRadialGradient(sx,sy-10,2,sx,sy-10,r*(0.4+k));g.addColorStop(0,'rgba(255,250,200,'+a+')');g.addColorStop(.35,'rgba(255,160,40,'+a*.9+')');g.addColorStop(.8,'rgba(120,40,10,'+a*.5+')');g.addColorStop(1,'rgba(40,30,30,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(sx,sy-10,r*(0.4+k),r*(0.4+k)*.85,0,0,TAU);ctx.fill();
        ctx.globalAlpha=a*.7;ell(ctx,sx,sy,r*k*1.8,r*k*.8,null,'#ffe0a0');
        for(let i=0;i<6;i++){const an=i/6*TAU+s*6;ell(ctx,sx+Math.cos(an)*r*k*1.1,sy-10-k*30+Math.sin(an)*r*k*.4,5+k*7,5+k*6,'rgba(70,60,60,'+(a*.6)+')')}ctx.globalAlpha=1;break}
      case'flame':{const tx=(f.tx-f.ty)*32,ty=(f.tx+f.ty)*16-(f.z||0)*LVL;ctx.globalAlpha=(1-k)*.9;for(let i=0;i<7;i++){const t=i/7;ell(ctx,sx+(tx-sx)*t+(Math.random()-.5)*4,sy-8+(ty-sy)*t+(Math.random()-.5)*4,2+t*5,2+t*4,i%2?'#ffb030':'#ff5010')}ctx.globalAlpha=1;break}
      case'tracer':{const tx=(f.tx-f.ty)*32,ty=(f.tx+f.ty)*16-(f.z||0)*LVL;ctx.globalAlpha=1-k;ln(ctx,sx+(tx-sx)*0.1,sy-12+(ty-sy)*0.1,sx+(tx-sx)*(0.3+k*.7),sy-12+(ty-sy)*(0.3+k*.7),1.6,'#ffe070');ell(ctx,sx+8*Math.sign(tx-sx||1),sy-14,3,2,'#fff2a0');ctx.globalAlpha=1;break}
      case'splash':{ctx.globalAlpha=1-k;ell(ctx,sx,sy,10+k*30,4+k*12,null,'#fff');ell(ctx,sx,sy,5+k*16,2+k*7,null,'#cfeaff');for(let i=0;i<7;i++){const a=i/7*TAU+s;ell(ctx,sx+Math.cos(a)*k*22,sy-Math.sin(k*3.1)*16+Math.sin(a)*k*8,1.6,1.6,'#e0f4ff')}ctx.globalAlpha=1;break}
      case'sinkbubbles':{ctx.globalAlpha=1-k;for(let i=0;i<9;i++){const a=i*2.3+s*6;ell(ctx,sx+Math.cos(a)*12+Math.sin(time*3+i)*2,sy-k*30-i*2,1.5+i%3*.6,1.5+i%3*.6,null,'#e0f0ff')}ctx.globalAlpha=1;break}
      case'collapse':{ctx.globalAlpha=0.65*(1-k);for(let i=0;i<10;i++){const a=i/10*TAU+s*3;const r=(f.sz||2)*18*(0.3+k);ell(ctx,sx+Math.cos(a)*r,sy-8+Math.sin(a)*r*.45-k*14,9+k*12,7+k*8,i%3?'#a89a84':'#6a5a4a')}
        for(let i=0;i<8;i++){const a=i*1.9+s*5;const ht=Math.sin(Math.min(1,k*1.6)*Math.PI)*30;rect(ctx,sx+Math.cos(a)*k*(f.sz||2)*22,sy-ht+Math.sin(a)*k*8,3,3,'#6a4a2a')}ctx.globalAlpha=1;break}
    }
  }
  // floating texts
  for(const t of R.floats){const k=t.t/1.4;const[sx,sy]=iso(t.x,t.y,hAt(t.x,t.y)+1);ctx.globalAlpha=1-k;ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.strokeText(t.text,sx,sy-24-k*28);ctx.fillStyle=t.col;ctx.fillText(t.text,sx,sy-24-k*28);ctx.globalAlpha=1}
}
function drawOverlays(time){
  // beams for healing / converting monks
  for(const u of G.units){
    if(u.dead||u.inside||!u.working||(u.workType!=='heal'&&u.workType!=='convert'))continue;
    const t=byId(u.tgt);if(!t||!entVisible(u))continue;
    const a=groundPos(u),b=groundPos(t);const conv=u.workType==='convert';
    ctx.globalAlpha=.8;ctx.strokeStyle=conv?'rgba(170,200,255,.9)':'rgba(120,255,150,.85)';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.lineDashOffset=-time*30;ctx.beginPath();ctx.moveTo(a[0],a[1]-24);ctx.quadraticCurveTo((a[0]+b[0])/2,(a[1]+b[1])/2-40,b[0],b[1]-20);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
  }
  // command marks
  for(const m of R.marks){const k=m.t/0.9;const[sx,sy]=iso(m.x,m.y,hAt(m.x,m.y));ctx.globalAlpha=1-k;ctx.strokeStyle=m.col;ctx.lineWidth=2;ell(ctx,sx,sy,18-k*10,8-k*4,null,m.col);ln(ctx,sx,sy-12+k*10,sx,sy,2,m.col);ctx.globalAlpha=1}
  // ghost
  const g=R.ghost;
  if(g){
    const d=B[g.type];const sz=d.sz;const cx=g.x+sz/2,cy=g.y+sz/2;const h=hAt(cx,cy);const sx=(cx-cy)*32,sy=(cx+cy)*16-h*LVL;
    ctx.save();ctx.translate(sx,sy);
    const col=g.ok?'rgba(80,255,100,':'rgba(255,70,60,';
    poly(ctx,[pj(-sz/2,-sz/2,0),pj(sz/2,-sz/2,0),pj(sz/2,sz/2,0),pj(-sz/2,sz/2,0)],col+'.35)',col+'.9)',2);
    if(!d.wall&&!d.farm){const p=G.players[g.owner||0];const sp=getBuildingSprite(g.type,p.civ,Math.min(3,p.age),p.color);ctx.globalAlpha=0.6;ctx.drawImage(sp.cv,-sp.ox,-sp.oy);ctx.globalAlpha=1}
    ctx.restore();
    // per-tile marks for blocked tiles
    if(!g.ok&&g.tiles)for(const t of g.tiles){const[tx,ty]=iso(t[0]+.5,t[1]+.5,hAt(t[0],t[1]));poly(ctx,[[tx,ty-16],[tx+32,ty],[tx,ty+16],[tx-32,ty]],'rgba(255,0,0,.25)')}
  }
}
// ---------- minimap ----------
function updateMinimapBase(){
  const W=G.W,H=G.H,c=R.mmCv.getContext('2d');const img=c.createImageData(W,H);
  for(let i=0;i<W*H;i++){
    const t=G.terr[i];let r,g,b;
    if(t>=3){const dl=R.dland[i];if(t===T_SHALLOW||dl<=2){r=70;g=160;b=190}else{r=36;g=96;b=160}}
    else{const c2=R.tileCol[i];r=c2[0];g=c2[1];b=c2[2];if(G.hgt[i]>=2){r*=1.1;g*=1.1;b*=1.1}}
    let a=255;
    if(!R.editor){const st=tileVisState(i);if(st===0){r=g=b=0}else if(st===1){r*=.55;g*=.55;b*=.55}}
    img.data[i*4]=r;img.data[i*4+1]=g;img.data[i*4+2]=b;img.data[i*4+3]=a;
  }
  c.putImageData(img,0,0);
}
function drawMinimap(mc,mctx){
  const w=mc.width,h=mc.height;mctx.setTransform(1,0,0,1,0,0);mctx.fillStyle='#05070b';mctx.fillRect(0,0,w,h);
  const N=G.W,k=(w/2)/N*0.98;
  mctx.setTransform(k,k/2,-k,k/2,w/2,h/2-N*k/4);
  // our transform: world (x,y) -> ((x-y)*k + w/2, (x+y)*k/2 + h/2 - N*k/4)
  mctx.imageSmoothingEnabled=false;mctx.drawImage(R.mmCv,0,0);
  const dot=(x,y,col,s)=>{mctx.fillStyle=col;mctx.fillRect(x-s/2,y-s/2,s,s)};
  for(const b of G.blds){if(b.dead)continue;if(!R.editor&&!isFriend(0,b.owner)&&!exploredTile(b.x,b.y))continue;dot(b.cx,b.cy,G.players[b.owner].color,Math.max(1.8,b.sz*.8));if(!R.editor&&false){}}
  for(const u of G.units){if(u.dead||u.inside)continue;if(!R.editor&&!(u.owner>=0&&isFriend(0,u.owner))&&!seenTile(clamp(Math.floor(u.x),0,G.W-1),clamp(Math.floor(u.y),0,G.H-1)))continue;if(u.owner<0){if(u.def.cls.includes('predator'))dot(u.x,u.y,'#e04030',1.2);else if(u.def.k==='boar')dot(u.x,u.y,'#a06030',1.2);continue}dot(u.x,u.y,G.players[u.owner].color,u.def.k==='sheep'?1:1.6)}
  for(const r of G.ress){if(r.dead||!(r.type==='gold'||r.type==='stone'||r.type==='relic'))continue;if(!R.editor&&!exploredTile(r.x,r.y))continue;dot(r.x+.5,r.y+.5,r.type==='gold'?'#ffe040':r.type==='stone'?'#cfd4dc':'#ffffff',1.2)}
  // camera view
  const pts=[[0,0],[VW,0],[VW,VH],[0,VH]].map(([sx,sy])=>scrToWorld(sx,sy));
  mctx.strokeStyle='#fff';mctx.lineWidth=1.2/k;mctx.beginPath();pts.forEach((p,i)=>{i?mctx.lineTo(p.x,p.y):mctx.moveTo(p.x,p.y)});mctx.closePath();mctx.stroke();
  mctx.setTransform(1,0,0,1,0,0);
}
function mmToWorld(mc,px,py){const w=mc.width,h=mc.height,N=G.W,k=(w/2)/N*0.98;const a=(px-w/2)/k,b=(py-(h/2-N*k/4))/(k/2);return{x:(a+b)/2,y:(b-a)/2}}
