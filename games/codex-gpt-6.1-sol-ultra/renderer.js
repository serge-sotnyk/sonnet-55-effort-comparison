import { BUILDINGS, UNITS, MAP_SIZE, TILE_W, TILE_H } from './catalog.js';

// All artwork is drawn locally. The map and static illustrations are cached;
// animation, orders, selection, and the fog of war remain live.
const TAU = Math.PI * 2;
const halfW = TILE_W / 2, halfH = TILE_H / 2;
const hash = (x,y=0) => { const n=Math.sin(x*127.1+y*311.7)*43758.5453123; return n-Math.floor(n); };
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
function poly(c,pts,fill,stroke,line=1){ c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();} }
function line(c,pts,color,width=1){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=color;c.fill();}
function diamond(c,x,y,r,color,stroke){poly(c,[[x,y-r/2],[x+r,y],[x,y+r/2],[x-r,y]],color,stroke);}
function colorShade(hex,amount){const v=parseInt(hex.slice(1),16);return `rgb(${Math.max(0,Math.min(255,(v>>16)+amount))},${Math.max(0,Math.min(255,((v>>8)&255)+amount))},${Math.max(0,Math.min(255,(v&255)+amount))})`;}
function canvas(w,h){const v=document.createElement('canvas');v.width=w;v.height=h;return v;}
const PALETTE={wood:'#6a4930',edge:'#3e3529',cream:'#ddc8a0',roof:'#9b513b',stone:'#a4aaa3',blue:'#388fae',red:'#b84938'};

function face(c,p,fill,wood=true,windows=true){
  poly(c,p,fill,PALETTE.edge,1.4);
  const [a,b,d,e]=p;
  if(wood){
    line(c,[mix(a,e,.12),mix(b,d,.12)],'#7b5c40',2);
    line(c,[mix(a,e,.86),mix(b,d,.86)],'#6c5036',3);
    for(let s=.22;s<1;s+=.28){const t=mix(a,b,s),v=mix(e,d,s);line(c,[t,v],'#6c5036',2.7);}
    line(c,[mix(a,e,.25),mix(b,d,.84)],'#8a6b49',1.7);
  } else {
    for(let t=.18;t<1;t+=.2){line(c,[mix(a,e,t),mix(b,d,t)],'rgba(49,63,62,.22)',.7);}
    for(let t=.2;t<1;t+=.23){line(c,[mix(a,b,t),mix(e,d,t)],'rgba(48,58,58,.18)',.7);}
  }
  if(windows){
    for(const t of [.24,.69]){
      const top=mix(mix(a,e,.28),mix(b,d,.28),t),bottom=mix(mix(a,e,.60),mix(b,d,.60),t);
      const dir=[(b[0]-a[0])*.07,(b[1]-a[1])*.07];
      poly(c,[[top[0]-dir[0],top[1]-dir[1]],[top[0]+dir[0],top[1]+dir[1]],[bottom[0]+dir[0],bottom[1]+dir[1]],[bottom[0]-dir[0],bottom[1]-dir[1]]],'#313a38','#a88659',1.5);
      line(c,[top,bottom],'#d3b77e',1);
    }
  }
}
function box(c,x,y,w,d,h,opt={}){
 const project=(gx,gy)=>[x+(gx-gy)*halfW,y+(gx+gy)*halfH];
 const ground=[project(-w/2,-d/2),project(w/2,-d/2),project(w/2,d/2),project(-w/2,d/2)];
 const top=ground.map(p=>[p[0],p[1]-h]);
 face(c,[top[3],top[2],ground[2],ground[3]],opt.wall||PALETTE.cream,opt.wood!==false,opt.windows!==false);
 face(c,[top[2],top[1],ground[1],ground[2]],colorShade(opt.wall||PALETTE.cream,-24),opt.wood!==false,opt.windows!==false);
 poly(c,top,colorShade(opt.wall||PALETTE.cream,12),PALETTE.edge,1);
 return {ground,top,project};
}
function roof(c,x,y,w,d,h,r=20,col=PALETTE.roof){
 const p=(gx,gy,z)=>[x+(gx-gy)*halfW,y+(gx+gy)*halfH-z];
 const a=p(-w/2,-d/2,h),b=p(w/2,-d/2,h),d1=p(-w/2,d/2,h),cc=p(w/2,d/2,h);
 const e=p(-w/2,0,h+r),f=p(w/2,0,h+r);
 poly(c,[a,b,f,e],colorShade(col,15),'#51372e',1.3);
 poly(c,[e,f,cc,d1],col,'#51372e',1.3);
 for(let k=1;k<6;k++){
  const t=k/6;line(c,[mix(e,d1,t),mix(f,cc,t)],'#b67451',.8);
  for(let s=(k%2)*.04;s<1;s+=.10){const p1=mix(mix(e,d1,t),mix(f,cc,t),s),p2=mix(mix(e,d1,t+1/6),mix(f,cc,t+1/6),s);line(c,[p1,p2],'rgba(56,33,27,.28)',.7);}
 }
 line(c,[e,f],'#e1a170',2.3);
 poly(c,[a,e,d1],'#c7b48c','#593e2c',1.3);
 line(c,[mix(a,d1,.5),e],'#715338',2);
}
function cottage(c,x,y,w,d,h=35,opt={}){box(c,x,y,w,d,h,opt);roof(c,x,y,w+.14,d+.14,h,opt.roofHeight||21,opt.roof||PALETTE.roof);}
function flag(c,x,y,col,size=15){line(c,[[x,y+28],[x,y-11]],'#574735',2);poly(c,[[x,y-10],[x+size,y-6],[x+size*.85,y+2],[x,y]],col,'#3b4a43',.6);line(c,[[x+2,y-8],[x+size*.70,y-6]],'rgba(255,255,255,.32)',1);}
function door(c,x,y,w=12,h=20){poly(c,[[x-w/2,y],[x-w/2,y-h],[x,y-h-3],[x+w/2,y-h+2],[x+w/2,y]],'#4f3927','#2b2d26',1);line(c,[[x,y],[x,y-h]],'#92704c',1);ellipse(c,x+3,y-h*.4,1.3,1,'#d4ae59');}
function fence(c,x,y,w,d,col='#a08854'){
 const p=(gx,gy)=>[x+(gx-gy)*halfW,y+(gx+gy)*halfH];
 const points=[p(-w/2,-d/2),p(w/2,-d/2),p(w/2,d/2),p(-w/2,d/2)];
 for(let i=0;i<4;i++){let a=points[i],b=points[(i+1)%4];for(let t=0;t<=1;t+=.2){let q=mix(a,b,t);line(c,[[q[0],q[1]],[q[0],q[1]-10]],col,2);}line(c,[[a[0],a[1]-6],[b[0],b[1]-6]],col,1.8);}
}
function barrel(c,x,y){ellipse(c,x,y,5,2.6,'#493729');c.fillStyle='#9b7544';c.fillRect(x-5,y-10,10,10);ellipse(c,x,y-10,5,2.6,'#b79155');line(c,[[x-5,y-8],[x+5,y-8]],'#57513d',1.5);line(c,[[x-5,y-2],[x+5,y-2]],'#57513d',1.5);}
function crate(c,x,y){box(c,x,y,.22,.22,9,{wall:'#ae864f',windows:false});}
function battlements(c,x,y,w,d,h){
 const {top}=box(c,x,y,w,d,h,{wall:'#a5aaa0',wood:false});
 for(let i=0;i<4;i++){const a=top[i],b=top[(i+1)%4];line(c,[a,b],'#626e68',4);for(let t=.04;t<1;t+=.17){const q=mix(a,b,t);poly(c,[[q[0]-3,q[1]],[q[0]-3,q[1]-7],[q[0]+3,q[1]-7],[q[0]+3,q[1]]],'#bfc0ab','#68736b',.7);}}
 return top;
}
function shield(c,x,y,col,s=1){poly(c,[[x-5*s,y-6*s],[x+5*s,y-4*s],[x+4*s,y+3*s],[x,y+7*s],[x-5*s,y+2*s]],col,'#ccb88b',1);line(c,[[x,y-3*s],[x,y+4*s]],'#e8d6a0',1);line(c,[[x-3*s,y],[x+3*s,y+1*s]],'#e8d6a0',1);}

export class Renderer {
 constructor(element,game){
  this.canvas=element;this.ctx=element.getContext('2d');this.game=game;this.zoom=.95;this.camera={x:0,y:0};this.placement=null;this.dragRect=null;this.hoverEntity=null;this.sprites=new Map();this.treeSprites=new Map();this.rememberedBuildings=new Map();this.time=0;this.width=0;this.height=0;this.dpr=1;
  this.resize();this.centerOn(16,30);this.makeTerrain();this.cachedGame=game;
 }
 setGame(game){this.game=game;this.cachedGame=game;this.fogCanvas=null;this.fogRaw=null;this.lastFogTime=0;this.hoverEntity=null;this.placement=null;this.dragRect=null;this.rememberedBuildings.clear();this.makeTerrain();this.centerOn(16,30);}
 resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);}
 project(x,y){return {x:(x-y)*halfW,y:(x+y)*halfH};}
 worldToScreen(x,y){const p=this.project(x,y);return{x:this.width/2+(p.x-this.camera.x)*this.zoom,y:this.height/2+(p.y-this.camera.y)*this.zoom};}
 screenToWorld(clientX,clientY){const r=this.canvas.getBoundingClientRect();const px=(clientX-r.left-this.width/2)/this.zoom+this.camera.x,py=(clientY-r.top-this.height/2)/this.zoom+this.camera.y;return{x:(px/halfW+py/halfH)/2,y:(py/halfH-px/halfW)/2};}
 centerOn(x,y){const p=this.project(x,y);this.camera.x=p.x;this.camera.y=p.y;}
 pan(dx,dy){this.camera.x-=dx/this.zoom;this.camera.y-=dy/this.zoom;const world={x:(this.camera.x/halfW+this.camera.y/halfH)/2,y:(this.camera.y/halfH-this.camera.x/halfW)/2};const x=Math.max(0,Math.min(MAP_SIZE,world.x)),y=Math.max(0,Math.min(MAP_SIZE,world.y));const p=this.project(x,y);this.camera.x=p.x;this.camera.y=p.y;}
 tileIndex(e){return Math.max(0,Math.min(MAP_SIZE-1,Math.floor(e.y)))*MAP_SIZE+Math.max(0,Math.min(MAP_SIZE-1,Math.floor(e.x)));}
 isVisible(e){if(e.owner==='player')return true;const index=this.tileIndex(e);if(e.owner==='enemy')return !this.game.visible||!!this.game.visible[index];return !this.game.explored||!!this.game.explored[index];}
 hitTest(clientX,clientY){
  const r=this.canvas.getBoundingClientRect(),mx=clientX-r.left,my=clientY-r.top;
  const es=this.game.entities.filter(e=>!e.dead&&e.hp!==0&&(e.amount==null||e.amount>0)&&this.isVisible(e));es.sort((a,b)=>(b.x+b.y)-(a.x+a.y));
  for(const e of es){const p=this.worldToScreen(e.x,e.y);let w=13,h=28,cy=-11;
   if(e.kind==='building'){const def=BUILDINGS[e.type];w=(def?.size||2)*34;h=e.type==='castle'?133:e.type==='tower'?105:e.type==='towncenter'?115:e.type==='mill'?95:e.type==='farm'?28:70;cy=-h*.35;}
   if(e.kind==='resource'){w=e.type==='tree'?24:23;h=e.type==='tree'?62:25;cy=-h*.35;}
   if(e.type==='knight'||e.type==='scout'){w=22;h=34;cy=-14;}
   if(Math.abs(mx-p.x)<w*this.zoom&&my>p.y-(h-cy)*this.zoom&&my<p.y+Math.max(10,h*.20)*this.zoom){return e;}
  }
 }
 makeTerrain(){
  this.terrainCanvas=canvas(MAP_SIZE*TILE_W+220,MAP_SIZE*TILE_H+220);const c=this.terrainCanvas.getContext('2d');this.mapOrigin={x:MAP_SIZE*halfW+110,y:80};
  c.clearRect(0,0,this.terrainCanvas.width,this.terrainCanvas.height);
  for(let y=0;y<MAP_SIZE;y++)for(let x=0;x<MAP_SIZE;x++){
   const p=this.project(x+.5,y+.5),sx=p.x+this.mapOrigin.x,sy=p.y+this.mapOrigin.y;const n=hash(x,y),terrain=this.game.terrain?.[y*MAP_SIZE+x]||0;
   let base=terrain===1?`rgb(${59+Math.floor(n*9)},${112+Math.floor(n*10)},${119+Math.floor(n*13)})`:`rgb(${104+Math.floor(n*12)},${133+Math.floor(n*11)},${70+Math.floor(n*8)})`;
   diamond(c,sx,sy,halfW+.8,base);
   if(terrain===1){
    for(let j=0;j<3;j++){let vx=sx+(hash(x*5+j,y)-.5)*40,vy=sy+(hash(y*7+j,x)-.5)*15;line(c,[[vx-5,vy],[vx+5,vy]],'rgba(192,218,176,.30)',.8);}
    for(const [dx,dy,edge] of [[-1,0,[[sx-halfW,sy],[sx,sy-halfH]]],[0,-1,[[sx,sy-halfH],[sx+halfW,sy]]],[1,0,[[sx+halfW,sy],[sx,sy+halfH]]],[0,1,[[sx,sy+halfH],[sx-halfW,sy]]]]){if(this.game.terrain?.[(y+dy)*MAP_SIZE+x+dx]!==1){line(c,edge,'#b7b18a',4);line(c,edge,'#c9c299',1.1);}}
   }else{
    if(terrain===2){c.save();c.translate(sx,sy);c.scale(1.8,1);const dirt=c.createRadialGradient(0,0,2,0,0,15);dirt.addColorStop(0,'rgba(165,145,100,.40)');dirt.addColorStop(.55,'rgba(163,143,97,.24)');dirt.addColorStop(1,'rgba(151,134,89,0)');ellipse(c,0,0,15,15,dirt);c.restore();}
    for(let j=0;j<6;j++){const gx=hash(x*17+j,y),gy=hash(y*19+j,x);const tx=x+gx,ty=y+gy,q=this.project(tx,ty),vx=q.x+this.mapOrigin.x,vy=q.y+this.mapOrigin.y;if(terrain===0){line(c,[[vx-1,vy],[vx,vy-2],[vx+2,vy]],j%2?'rgba(192,181,103,.25)':'rgba(49,78,41,.21)',1);}else{ellipse(c,vx,vy,1.2,.7,'rgba(70,77,48,.22)');}}
    if(n>.86&&terrain===0){for(let j=0;j<4;j++){const vx=sx+(hash(x+j,y)-.5)*32,vy=sy+(hash(x,y+j)-.5)*13;ellipse(c,vx,vy,1.2,1,n>.95?'#d2c08a':'#a0b65e');}}
   }
  }
  // A network of soft earth tracks ties the starting village together.
  c.save();c.globalAlpha=.42;c.lineCap='round';
  const paths=[[[12,28],[16,30],[21,30],[25,33]],[[16,30],[18,25],[22,22]],[[16,30],[13,34],[9,36]],[[39,17],[41,16],[45,20]],[[41,16],[38,13],[36,12]]];
  for(const points of paths){const pp=points.map(([x,y])=>{const p=this.project(x,y);return[p.x+this.mapOrigin.x,p.y+this.mapOrigin.y];});line(c,pp,'#8e895f',15);line(c,pp,'#c0aa7b',8);line(c,pp,'#b4a477',5);}
  c.restore();
  // Rounded granite outcrops, scattered flowers and rushes at the water's edge.
  for(let y=1;y<MAP_SIZE-1;y++)for(let x=1;x<MAP_SIZE-1;x++){
   const idx=y*MAP_SIZE+x;if(this.game.terrain?.[idx]===1)continue;const p=this.project(x+.3,y+.5),sx=p.x+this.mapOrigin.x,sy=p.y+this.mapOrigin.y;
   const nearWater=[idx-1,idx+1,idx-MAP_SIZE,idx+MAP_SIZE].some(i=>this.game.terrain?.[i]===1);
   if(nearWater&&hash(x,y)>.4){for(let j=0;j<5;j++){const vx=sx+j*3-7,vy=sy+j%2*2;line(c,[[vx,vy],[vx-2,vy-9-j%3]],'#56674d',1.3);line(c,[[vx,vy],[vx+3,vy-5]],'#829363',1);}}
   else if(hash(x+65,y)>.986){ellipse(c,sx,sy,7,3,'rgba(33,56,37,.2)');poly(c,[[sx-6,sy],[sx-5,sy-5],[sx,sy-8],[sx+5,sy-5],[sx+7,sy]],'#a0a592','#626f5b',.6);line(c,[[sx-5,sy-5],[sx,sy-8],[sx+1,sy-2]],'#c0bfa4',1);}
  }
 }
 makeFog(){
  const scale=.25,w=Math.ceil(this.terrainCanvas.width*scale),h=Math.ceil(this.terrainCanvas.height*scale);
  if(!this.fogCanvas){this.fogCanvas=canvas(w,h);this.fogRaw=canvas(w,h);}
  const c=this.fogRaw.getContext('2d');c.clearRect(0,0,w,h);c.save();c.scale(scale,scale);c.translate(this.mapOrigin.x,this.mapOrigin.y);
  for(let y=0;y<MAP_SIZE;y++)for(let x=0;x<MAP_SIZE;x++){
   const i=y*MAP_SIZE+x;if(this.game.visible?.[i])continue;const p=this.project(x+.5,y+.5);
   diamond(c,p.x,p.y,halfW,this.game.explored?.[i]?'rgba(20,38,31,.49)':'rgba(23,39,33,.965)');
  }
  c.restore();const out=this.fogCanvas.getContext('2d');out.clearRect(0,0,w,h);out.filter='blur(2.5px)';out.drawImage(this.fogRaw,0,0);out.filter='none';this.lastFogTime=this.time;
 }
 buildingSprite(type,owner='player',progress=1){
  const key=`${type}-${owner}-${progress<1?'foundation':'done'}`;if(this.sprites.has(key))return this.sprites.get(key);
  const v=canvas(320,300),c=v.getContext('2d');c.translate(160,226);const def=BUILDINGS[type]||{size:2},s=def.size,col=owner==='enemy'?PALETTE.red:PALETTE.blue;
  ellipse(c,4,8,s*32,s*12,'rgba(31,43,29,.24)');
  const ground=()=>diamond(c,0,0,s*32,'#aa9970','#8b805a');
  if(progress<1){ground();for(let j=-2;j<=2;j++){line(c,[[-s*20+j*6,-s*8],[s*20+j*6,s*8]],'#92816a',2);}box(c,0,0,s*.8,s*.8,11,{wall:'#b0a889',wood:false,windows:false});for(const [x,y] of [[-s*25,0],[s*25,0],[0,s*13]]){line(c,[[x,y],[x,y-38]],'#79634a',2);line(c,[[x-12,y-20],[x+12,y-8]],'#79634a',2);}crate(c,-22,22);barrel(c,20,23);}
  else if(type==='towncenter'){
   ground();cottage(c,-48,-11,1.35,1.18,34,{roof:'#a05a42'});cottage(c,50,15,1.4,1.25,37,{roof:'#a35d43'});
   box(c,0,-6,1.55,1.45,61,{wall:'#ddd0ab'});roof(c,0,-6,1.72,1.63,61,31,'#94523d');
   box(c,0,-11,.57,.55,102,{wall:'#d6c9a8'});roof(c,0,-11,.72,.71,102,19,'#715849');
   ellipse(c,-7,-102,5,6,'#d8c48d');ellipse(c,-7,-102,3.9,4.7,'#434d46');line(c,[[-7,-102],[-7,-106]],'#d4caad',.8);line(c,[[-7,-102],[-4,-101]],'#d4caad',.8);
   door(c,-9,16,17,29);poly(c,[[-28,5],[9,24],[9,16],[-28,-3]],'#95754c','#65533b');line(c,[[-20,19],[-20,5]],'#69533a',2);line(c,[[8,32],[8,19]],'#69533a',2);
   flag(c,-42,-69,col,15);flag(c,25,-117,col,14);barrel(c,45,36);crate(c,59,31);barrel(c,-60,6);c.fillStyle='#dbc28b';c.font='bold 7px Georgia';c.fillText('✦',16,-45);
   // Draped civic banner and small courtyard well.
   poly(c,[[26,-54],[38,-48],[38,-20],[31,-17],[26,-23]],col,'#30657a',.6);line(c,[[31,-44],[31,-29]],'#e6d5ab',1);line(c,[[28,-36],[35,-33]],'#e6d5ab',1);
   box(c,-30,41,.33,.33,9,{wall:'#a7a58b',wood:false,windows:false});line(c,[[-36,39],[-36,22],[-20,30],[-20,45]],'#715738',2);roof(c,-29,35,.50,.45,13,9,'#a05d3e');
  }else if(type==='house'){
   cottage(c,0,0,1.05,1.03,30,{roof:'#a76144'});door(c,-7,16,11,18);box(c,13,-5,.18,.18,68,{wall:'#ac9b83',wood:false,windows:false});line(c,[[8,-74],[19,-69]],'#674c37',3);barrel(c,31,10);flag(c,-21,-29,col,10);
  }else if(type==='mill'){
   ground();cottage(c,-6,2,1.15,1.16,33,{roof:'#987651'});box(c,4,-6,.70,.69,72,{wall:'#d7d1ac'});roof(c,4,-6,.8,.8,72,21,'#a05a3b');door(c,-15,17);barrel(c,39,14);barrel(c,49,19);crate(c,-42,10);flag(c,-33,-26,col,11);
   ellipse(c,-8,-59,5,5,'#776044');
  }else if(type==='farm'){
   diamond(c,0,0,68,'#896744','#a99868');
   for(let row=-4;row<=4;row++){
    const p1=[-36+row*7,-18-row*3.5],p2=[36+row*7,18-row*3.5];line(c,[p1,p2],'#624e32',3.5);
    for(let j=0;j<14;j++){const q=mix(p1,p2,j/14),h=7+hash(row,j)*6;line(c,[[q[0],q[1]],[q[0]+1,q[1]-h]],'#b7a352',1.2);line(c,[[q[0]+1,q[1]-h+3],[q[0]-1,q[1]-h]],'#d9c574',1.6);line(c,[[q[0]+1,q[1]-h+1],[q[0]+3,q[1]-h-2]],'#e0c97a',1.5);}
   }
   fence(c,0,0,1.93,1.93,'#9a8760');ellipse(c,43,13,6,4,'#d2bd7a');
  }else if(type==='barracks'){
   ground();cottage(c,0,-4,1.85,1.50,44,{roof:'#8c503c'});cottage(c,-39,12,.6,.9,27,{roof:'#a86743'});door(c,-13,26,21,28);flag(c,15,-76,col,21);shield(c,27,-17,col,1.4);shield(c,47,-7,col,1.1);line(c,[[46,27],[45,-15]],'#796443',2);line(c,[[45,-15],[49,-20]],'#c6c8b1',2);barrel(c,-53,18);crate(c,-35,35);
  }else if(type==='archery'){
   ground();cottage(c,-14,-8,1.55,1.16,38,{roof:'#86634b'});door(c,-24,8,15,23);flag(c,-28,-69,col,16);fence(c,25,22,.9,.9);
   for(const [x,y] of [[38,11],[9,27]]){line(c,[[x-6,y+8],[x,y-20],[x+6,y+8]],'#755a3b',2);ellipse(c,x,y-12,9,11,'#d6c399');ellipse(c,x,y-12,6,8,'#9c4935');ellipse(c,x,y-12,3,4,'#e2d2a4');ellipse(c,x,y-12,1.3,1.6,'#343b32');line(c,[[x+2,y-12],[x+12,y-16]],'#5f5034',1.2);}
  }else if(type==='stable'){
   ground();cottage(c,-12,-11,1.6,1.25,41,{roof:'#a45f41'});door(c,-22,9,26,29);fence(c,32,22,1.07,1.10);flag(c,-25,-73,col,17);barrel(c,-51,21);ellipse(c,42,17,10,7,'#b9a467');line(c,[[33,16],[48,19]],'#e0c785',1.5);
   ellipse(c,23,16,14,6,'#776047');line(c,[[14,17],[12,27]],'#503f30',2);line(c,[[30,17],[32,29]],'#503f30',2);poly(c,[[32,15],[35,2],[42,5],[44,13],[35,15]],'#856b4f','#554938');poly(c,[[35,3],[33,-1],[36,0],[39,-2],[40,5]],'#61503c');
  }else if(type==='blacksmith'){
   ground();cottage(c,-8,-5,1.5,1.3,36,{roof:'#6f6250'});box(c,26,-10,.35,.35,74,{wall:'#858b7c',wood:false,windows:false});line(c,[[15,-82],[32,-73]],'#5b6257',3);
   door(c,-16,17,19,26);ellipse(c,-13,1,6,7,'#f4983c');ellipse(c,-13,1,3,5,'#f5d57c');poly(c,[[17,24],[32,32],[39,28],[25,20]],'#555d56','#333f3c',1.5);box(c,28,29,.24,.22,12,{wall:'#767b6d',wood:false,windows:false});line(c,[[31,9],[38,21]],'#674f36',2);flag(c,-29,-39,col,12);barrel(c,-47,19);crate(c,42,17);
  }else if(type==='lumbercamp'||type==='miningcamp'){
   ground();cottage(c,-10,-4,1.1,.85,26,{roof:type==='lumbercamp'?'#8d7950':'#85735a'});door(c,-13,12,12,18);flag(c,-17,-45,col,12);
   if(type==='lumbercamp'){for(let j=0;j<5;j++){const x=15+j*4,y=20-j*3;line(c,[[x-6,y-14],[x+26,y+2]],'#705438',7);ellipse(c,x+26,y+2,4,4,'#b69b64');ellipse(c,x+26,y+2,2,2,'#77633f');}line(c,[[2,19],[13,-3]],'#684f35',2);poly(c,[[11,0],[10,-7],[17,-3],[17,2]],'#969e8b','#454c42');}
   else{for(let j=0;j<6;j++){const x=18+j%3*10,y=8+Math.floor(j/3)*9;poly(c,[[x-6,y],[x-5,y-8],[x+1,y-10],[x+6,y-4],[x+5,y+3]],j%2?'#98998b':'#b4ad85','#706f58');}crate(c,-35,16);barrel(c,41,22);}
  }else if(type==='tower'){
   ground();battlements(c,0,0,1.10,1.08,88);door(c,-7,14,13,26);box(c,0,-1,1.28,1.26,72,{wall:'#9aa292',wood:false,windows:false});battlements(c,0,-1,1.3,1.3,87);flag(c,6,-114,col,16);poly(c,[[9,-66],[21,-60],[21,-25],[15,-21],[9,-27]],col,'#3d707d',.6);line(c,[[15,-52],[15,-32]],'#e5d4a4',1);
  }else if(type==='castle'){
   ground();box(c,0,-10,2.45,1.9,58,{wall:'#aaa99a',wood:false});battlements(c,0,-10,2.46,1.91,58);box(c,0,-21,1.1,1.03,104,{wall:'#b6b7a8',wood:false});battlements(c,0,-21,1.18,1.12,104);roof(c,0,-21,1.13,1.09,110,29,'#717d74');
   for(const [x,y] of [[-69,-6],[12,33],[68,2]]){battlements(c,x,y,.66,.68,83);poly(c,[[x-3,y-63],[x+6,y-58],[x+6,y-25],[x+1,y-22],[x-3,y-28]],col,'#315b65',.7);}
   door(c,-26,25,23,33);poly(c,[[-45,20],[-13,37],[-13,50],[-45,34]],'#948d79','#646e63',1);line(c,[[-43,25],[-15,41]],'#b0aa92',1.3);flag(c,-6,-153,col,22);flag(c,68,-95,col,14);barrel(c,-56,33);
  }
  this.sprites.set(key,v);return v;
 }
 resourceSprite(type,seed){
  const key=type+'-'+(seed%12);if(this.treeSprites.has(key))return this.treeSprites.get(key);
  const v=canvas(112,120),c=v.getContext('2d');c.translate(56,102);const n=hash(seed,7);
  if(type==='tree'){
   const pine=n>.58;ellipse(c,8,2,18,7,'rgba(24,49,27,.23)');
   line(c,[[0,0],[-1,-44]],'#5d4d31',5);line(c,[[-1,-23],[-12,-40]],'#5d4d31',2.7);line(c,[[0,-28],[12,-44]],'#5d4d31',2);line(c,[[-1,-3],[-5,2]],'#705d38',2);
   if(pine){
    for(let j=0;j<4;j++){const y=-23-j*12,r=25-j*4;poly(c,[[-r,y],[-r*.45,y-9],[-r*.6,y-9],[0,y-29],[r*.5,y-11],[r*.45,y-8],[r,y]],j%2?'#345f42':'#436e47','#2c553d',.7);poly(c,[[0,y-29],[-r*.4,y-11],[-r*.7,y-6],[-r*.3,y-7],[0,y-10]],'#5a8050');}
   }else{
    const clusters=[[-15,-42,17], [12,-46,18],[-4,-60,21],[-22,-53,12],[20,-62,13],[-3,-75,15],[10,-66,18]];
    for(let i=0;i<clusters.length;i++){const [x,y,r]=clusters[i],hh=hash(seed,i);ellipse(c,x+hh*4,y,r,r*.76,['#406543','#527648','#658649','#789652','#8aa557'][i%5]);for(let j=0;j<6;j++){const angle=hash(i,j)*TAU;ellipse(c,x+Math.cos(angle)*r*.7,y+Math.sin(angle)*r*.5,5+hash(j,seed)*3,4,['#527849','#668a50','#8da758'][j%3]);}}
    line(c,[[-14,-67],[-8,-72],[-3,-71]],'#a6b871',1);line(c,[[9,-78],[14,-76]],'#a6b871',1);
   }
   for(let j=0;j<3;j++){line(c,[[j*5-9,3],[j*5-7,-2]],'#95a360',1);}
  }else if(type==='berry'){
   ellipse(c,1,1,21,7,'rgba(27,46,26,.22)');for(let j=0;j<5;j++){let x=(j-2)*8,y=-5-Math.sin(j)*4;ellipse(c,x,y,11,9,j%2?'#486642':'#68814b');for(let i=0;i<4;i++){ellipse(c,x+(hash(j,i)-.5)*13,y+(hash(i,j)-.5)*10,1.6,1.7,i%2?'#994e56':'#c07b68');}}line(c,[[-9,-14],[-6,-16]],'#9aad71',1.5);
  }else{
   const gold=type==='gold';ellipse(c,2,3,26,9,'rgba(27,45,29,.20)');
   for(let j=0;j<7;j++){const x=(j%3-1)*14+(j>3?3:0),y=Math.floor(j/3)*5-4,r=9+hash(seed,j)*6;poly(c,[[x-r,y],[x-r*.7,y-r*.7],[x,y-r],[x+r*.9,y-r*.45],[x+r,y+3],[x,y+6]],gold?'#aca574':'#929c90','#646f5c',.6);poly(c,[[x-r*.7,y-r*.7],[x,y-r],[x+2,y-1],[x-r*.5,y]],gold?'#c3b58a':'#b7bdab');poly(c,[[x+2,y-1],[x+r*.9,y-r*.45],[x+r,y+3],[x,y+6]],gold?'#827c5d':'#7b857b');if(gold){line(c,[[x-5,y-5],[x+1,y-3],[x+3,y+2]],'#e7c461',2.4);ellipse(c,x-2,y-7,2,1.5,'#eed782');}}
  }
  this.treeSprites.set(key,v);return v;
 }
 drawUnit(c,e){
  const col=e.owner==='enemy'?PALETTE.red:PALETTE.blue,dark=e.owner==='enemy'?'#73382d':'#2e5c68',t=this.time,seed=typeof e.id==='number'?e.id:hash(e.x,e.y)*100;
  const moving=e.task?.type==='move'||e.task?.type==='attackMove'||!!e.path?.length;const working=['gather','build','repair','attack'].includes(e.task?.type);const phase=t*9+seed;const step=moving?Math.sin(phase)*3:Math.sin(t*2+seed)*.3;
  ellipse(c,2,1,e.type==='knight'||e.type==='scout'?16:7,e.type==='trebuchet'?6:3,'rgba(29,45,29,.26)');
  if(e.type==='trebuchet'){
   line(c,[[-15,0],[14,1]],'#725435',5);for(const x of [-11,10]){ellipse(c,x,3,5,5,'#4c4232');ellipse(c,x,3,2,2,'#a78959');}
   line(c,[[-9,-2],[0,-28],[10,-1]],'#a88755',4);line(c,[[-5,-3],[7,-25]],'#725232',2);line(c,[[-13,-13],[18,-44]],'#b29661',4);box(c,-11,-13,.23,.22,9,{wall:'#61554b',windows:false});line(c,[[18,-44],[24,-33]],'#3d4031',1);ellipse(c,24,-32,3,3,'#706d56');flag(c,2,-18,col,8);return;
  }
  const cavalry=e.type==='knight'||e.type==='scout';let bodyY=-13;
  if(cavalry){
   ellipse(c,0,-12,14,7,e.type==='knight'?'#7c786c':'#8b6b49');line(c,[[-10,-10],[-12+step,0]],'#4e4636',3);line(c,[[-5,-9],[-2-step,0]],'#4e4636',3);line(c,[[8,-9],[11-step,0]],'#4e4636',3);line(c,[[12,-12],[14+step,-1]],'#4e4636',2.7);
   poly(c,[[10,-12],[11,-25],[18,-28],[23,-23],[21,-17],[15,-18]],e.type==='knight'?'#999b89':'#a48258','#514b3a',1);line(c,[[12,-23],[12,-32],[16,-25]],'#4e4636',2);line(c,[[-13,-16],[-20,-12],[-21,-5]],'#4e4636',2);poly(c,[[-8,-18],[7,-18],[8,-7],[-5,-8]],col,'#bfa980',.7);bodyY=-27;
  }else{
   line(c,[[-3,-8],[-4+step,0]],'#403b31',3);line(c,[[2,-8],[4-step,0]],'#403b31',3);line(c,[[-5+step,0],[-2+step,0]],'#332f28',2);line(c,[[3-step,0],[6-step,0]],'#332f28',2);
  }
  const yy=bodyY;
  poly(c,[[-5,yy-9],[3,yy-9],[6,yy+2],[-5,yy+4]],e.type==='villager'?'#c5b38e':col,'#3e4b3c',.7);
  poly(c,[[-4,yy-7],[0,yy-7],[0,yy+3],[-4,yy+3]],col);
  line(c,[[-4,yy-6],[-8,yy+1+Math.sin(phase)* (working?4:1)]],'#bb9471',2.5);line(c,[[3,yy-6],[7,yy-1]],'#ba9370',2.5);
  ellipse(c,0,yy-13,4,4.8,'#cfaa7e');
  if(e.type==='villager'){
   ellipse(c,-.5,yy-16.5,5,2.2,'#b7a06b');poly(c,[[-3,yy-20],[2,yy-20],[3,yy-16],[-4,yy-16]],'#c6b078','#8a7751',.4);
   if(working){let a=Math.sin(t*8+seed)*.8;line(c,[[6,yy-1],[12+a*7,yy-18]],'#775b3a',1.8);poly(c,[[10+a*7,yy-18],[15+a*7,yy-21],[17+a*7,yy-16],[12+a*7,yy-14]],'#92998a','#566451',.6);}
   else line(c,[[6,yy-2],[11,yy-11]],'#715634',1.5);
   if(e.carry>0||e.carried>0||e.carriedAmount>0||e.carrying?.amount>0){ellipse(c,-9,yy,4,5,'#ac8c57');}
  }else{
   poly(c,[[-4,yy-17],[-3,yy-20],[2,yy-20],[5,yy-15],[3,yy-12],[-4,yy-12]],e.type==='knight'?'#aeb5ae':'#878e84','#4c5850',.6);line(c,[[-4,yy-15],[4,yy-15]],'#ced1bd',1);
   if(e.type==='spearman'){line(c,[[8,yy+4],[9,yy-35]],'#80684a',1.7);poly(c,[[9,yy-39],[6,yy-31],[11,yy-32]],'#bbc3b3','#506055',.5);shield(c,-7,yy,col,.67);}
   else if(e.type==='archer'){c.beginPath();c.arc(9,yy-5,10,-1.25,1.25);c.strokeStyle='#a88958';c.lineWidth=1.7;c.stroke();line(c,[[12,yy-14],[12,yy+4]],'#d2bf83',.8);line(c,[[5,yy-4],[20,yy-7]],'#bba779',.9);}
   else {const swing=working?Math.sin(t*9+seed)*7:0;line(c,[[7,yy-1],[12+swing,yy-17]],'#bac3bc',2.5);line(c,[[6,yy-7],[13,yy-4]],'#a88b55',1.5);shield(c,-7,yy,col,e.type==='knight'?.95:.75);}
   if(cavalry){line(c,[[4,yy+1],[17,-21]],'#d5b98b',.7);}
  }
 }
 drawMillSails(c){
  c.save();c.translate(-8,-59);c.rotate(this.time*.36);for(let k=0;k<4;k++){c.rotate(Math.PI/2);line(c,[[0,0],[0,-44]],'#ad9366',2.5);poly(c,[[-1,-13],[-1,-42],[8,-40],[8,-16]],'#d8ccab','#7f6c4b',1);for(let i=0;i<5;i++){line(c,[[-1,-16-i*5],[8,-18-i*5]],'#aa9870',.7);}}ellipse(c,0,0,4,4,'#70563a');ellipse(c,0,0,2,2,'#c1a679');c.restore();
 }
 drawEntity(c,e){
  const p=this.project(e.x,e.y);c.save();c.translate(p.x,p.y);
  const selected=this.game.selected?.has(e.id)||this.game.selected?.has(e),hover=this.hoverEntity===e;
  if(selected||hover){const size=e.kind==='building'?(BUILDINGS[e.type]?.size||2)*34:e.kind==='resource'?22:13;const col=selected?'#8ed5e0':'rgba(213,212,160,.8)';diamond(c,0,0,size,'rgba(89,184,194,.08)',col);if(selected){diamond(c,0,0,size+3,null,'rgba(69,127,125,.7)');}}
  if(e.kind==='building'){
   c.drawImage(this.buildingSprite(e.type,e.owner,e.progress??1),-160,-226);if(e.type==='mill'&&(e.progress??1)>=1)this.drawMillSails(c);
   if(['house','towncenter','blacksmith'].includes(e.type)&&(e.progress??1)>=1){const pos=e.type==='house'?[14,-76]:e.type==='blacksmith'?[26,-89]:[-48,-61];for(let k=0;k<5;k++){const t=(this.time*.22+k*.21+(e.id||0)*.15)%1;ellipse(c,pos[0]+Math.sin(t*6+k)*4+t*11,pos[1]-t*36,2+t*5,2+t*5,`rgba(203,211,193,${(1-t)*.12})`);}}
   if(e.type==='towncenter'&&(e.progress??1)>=1){const age=e.memory?e.rememberedAge:(e.owner==='enemy'?this.game.enemyAge:this.game.age),col=e.owner==='enemy'?PALETTE.red:PALETTE.blue;
    if(age>=2){poly(c,[[-27,-27],[-19,-23],[-19,-2],[-23,0],[-27,-5]],col,'#b9a777',.8);line(c,[[-23,-23],[-23,-7]],'#dbc795',1);}
    if(age>=3){flag(c,-52,-50,col,13);flag(c,47,-39,col,13);shield(c,15,-4,'#b79951',.75);}
    if(age>=4){poly(c,[[-8,-141],[-8,-148],[-4,-144],[0,-150],[4,-144],[8,-146],[8,-140]],'#cfb16a','#725e38',.7);line(c,[[-8,-140],[8,-140]],'#ecd68f',1);}
   }
   if((e.progress??1)<1){const size=(BUILDINGS[e.type]?.size||2)*28;this.bar(c,-size,17,size*2,4,e.progress,'#caab6b');}
  }else if(e.kind==='resource'){
   c.drawImage(this.resourceSprite(e.type,Math.floor(e.x*7+e.y*11)), -56,-102);
   if(e.type==='gold'){const seed=hash(e.x,e.y),a=Math.max(0,Math.sin(this.time*2+seed*30)-.95)*18;if(a>0){line(c,[[-3,-10],[-3,-17]],`rgba(255,233,147,${a})`,1);line(c,[[-6,-13],[-0,-13]],`rgba(255,233,147,${a})`,1);}}
  }else {c.save();c.scale(e.facing===-1?-1:1,1);this.drawUnit(c,e);c.restore();}
  if(!e.memory&&(selected||hover||e.hp<e.maxHp*.75)&&e.maxHp){const size=e.kind==='building'?42:24,top=e.kind==='building'?(e.type==='castle'?-173:e.type==='towncenter'?-147:e.type==='tower'?-136:e.type==='mill'?-122:-90):e.kind==='resource'?-92:e.type==='knight'?-59:-38;this.bar(c,-size/2,top,size,3,e.hp/e.maxHp,e.owner==='enemy'?'#cc765d':'#8ab567');
   if(selected&&e.kind==='building'){c.fillStyle='#e9dfc0';c.font='600 10px Inter, sans-serif';c.textAlign='center';c.shadowColor='#182f22';c.shadowBlur=4;c.fillText(BUILDINGS[e.type]?.name||e.type,0,top-5);c.shadowBlur=0;}
  }
  c.restore();
 }
 bar(c,x,y,w,h,t,col){c.fillStyle='rgba(22,34,28,.8)';c.fillRect(x-1,y-1,w+2,h+2);c.fillStyle=col;c.fillRect(x,y,w*Math.max(0,Math.min(1,t)),h);c.fillStyle='rgba(225,239,201,.27)';c.fillRect(x,y,w*Math.max(0,Math.min(1,t)),1);}
 render(time){
  if(this.cachedGame!==this.game)this.setGame(this.game);
  this.time=time;const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);c.fillStyle='#1a2a22';c.fillRect(0,0,this.width,this.height);
  c.save();c.translate(this.width/2,this.height/2);c.scale(this.zoom,this.zoom);c.translate(-this.camera.x,-this.camera.y);c.drawImage(this.terrainCanvas,-this.mapOrigin.x,-this.mapOrigin.y);
  // Fog is painted into the ground before the sorted foreground artwork.
  const explored=this.game.explored,visible=this.game.visible;
  if(explored){if(!this.fogCanvas||this.time-(this.lastFogTime||0)>.3)this.makeFog();c.drawImage(this.fogCanvas,-this.mapOrigin.x,-this.mapOrigin.y,this.terrainCanvas.width,this.terrainCanvas.height);}
  for(const e of this.game.entities){if(e.kind==='building'&&e.owner==='enemy'&&this.isVisible(e)&&!e.dead&&e.hp>0)this.rememberedBuildings.set(e.id,{...e,memory:true,rememberedAge:this.game.enemyAge});}
  const entities=this.game.entities.filter(e=>!e.dead&&e.hp!==0&&(e.amount==null||e.amount>0)&&this.isVisible(e));
  for(const [id,e] of this.rememberedBuildings){if(visible?.[this.tileIndex(e)]){if(!this.game.entities.some(b=>b.id===id&&b.hp>0&&!b.dead))this.rememberedBuildings.delete(id);}else entities.push(e);}
  entities.sort((a,b)=>(a.x+a.y)-(b.x+b.y)||(a.kind==='unit'?1:-1));
  for(const e of entities){const p=this.project(e.x,e.y);if(Math.abs((p.x-this.camera.x)*this.zoom)>this.width/2+160||((p.y-this.camera.y)*this.zoom)>this.height/2+130||((p.y-this.camera.y)*this.zoom)<-this.height/2-120)continue;c.save();if(e.owner!=='player'&&!visible?.[this.tileIndex(e)])c.globalAlpha=e.memory?.32:.44;this.drawEntity(c,e);c.restore();}
  for(const projectile of this.game.projectiles||[]){
   const p=this.project(projectile.x,projectile.y),a=this.project(projectile.startX,projectile.startY),b=this.project(projectile.targetX,projectile.targetY);
   if(projectile.owner!=='player'&&!visible?.[this.tileIndex(projectile)])continue;
   const arc=Math.sin((projectile.progress||0)*Math.PI)*(projectile.type==='stone'?72:18),height=18+arc;
   if(projectile.type==='stone'){ellipse(c,p.x,p.y,6,3,'rgba(35,38,29,.18)');ellipse(c,p.x,p.y-height,5,4,'#aaa991');ellipse(c,p.x-1,p.y-height-1,2,1.5,'#d1cab0');}
   else{const angle=Math.atan2(b.y-a.y,b.x-a.x),dx=Math.cos(angle),dy=Math.sin(angle);line(c,[[p.x-dx*8,p.y-height-dy*8],[p.x+dx*3,p.y-height+dy*3]],'#dcc59b',1.5);poly(c,[[p.x+dx*5,p.y-height+dy*5],[p.x+dx*1-dy*2,p.y-height+dy*1+dx*2],[p.x+dx*1+dy*2,p.y-height+dy*1-dx*2]],'#cbd3bf');}
  }
  for(const effect of this.game.effects||[]){if(effect.type==='arrow'||effect.type==='projectile'){const from=effect.from||{x:effect.x,y:effect.y},to=effect.to||{x:effect.tx,y:effect.ty};if(Number.isFinite(from.x)&&Number.isFinite(to.x)){const a=this.project(from.x,from.y),b=this.project(to.x,to.y);line(c,[[a.x,a.y-18],[b.x,b.y-15]],'#e2cc9f',1);}}else if(Number.isFinite(effect.x)){const p=this.project(effect.x,effect.y),ratio=Math.max(0,Math.min(1,(effect.life??.8)/(effect.maxLife||1))),age=1-ratio;c.save();
    if(effect.type==='collapse'||effect.type==='death'){for(let j=0;j<(effect.type==='collapse'?12:5);j++){const n=hash(j,effect.x);ellipse(c,p.x+Math.cos(n*TAU)*age*45,p.y+Math.sin(n*TAU)*age*18-age*13,4+age*8,3+age*5,`rgba(186,167,119,${ratio*.38})`);}}
    else if(effect.type==='hit'){c.globalAlpha=ratio;const yy=p.y-14;line(c,[[p.x-7,yy-5],[p.x+7,yy+5]],'#ffe0a6',1.7);line(c,[[p.x-5,yy+7],[p.x+5,yy-7]],'#ffd59e',1.7);}
    else{c.globalAlpha=Math.min(.7,ratio);diamond(c,p.x,p.y,10+age*20,null,effect.type==='attack'?'#e7b37b':'#b2d9b6');}c.restore();}}
  if(this.placement){const p=this.project(this.placement.x,this.placement.y),s=BUILDINGS[this.placement.type]?.size||2;c.save();c.translate(p.x,p.y);const col=this.placement.ok?'#aed59a':'#da8069';diamond(c,0,0,s*36,this.placement.ok?'rgba(103,180,106,.29)':'rgba(188,80,59,.30)',col);c.globalAlpha=.55;c.drawImage(this.buildingSprite(this.placement.type),-160,-226);c.globalAlpha=1;diamond(c,0,0,s*36,null,col);c.restore();}
  // Tiny swifts glide above the settlement without obscuring the playable field.
  for(let j=0;j<3;j++){const x=this.camera.x+Math.sin(time*.07+j*1.2)*550,y=this.camera.y-210+Math.sin(time*.11+j)*100;const flap=Math.sin(time*6+j)*2;line(c,[[x-5,y+flap],[x,y],[x+5,y+flap]],'rgba(40,50,37,.45)',1);}
  c.restore();
  // A soft optical vignette makes the map feel painted, while preserving readability.
  const grad=c.createRadialGradient(this.width*.5,this.height*.45,this.height*.22,this.width*.5,this.height*.45,Math.max(this.width,this.height)*.7);grad.addColorStop(0,'rgba(9,22,17,0)');grad.addColorStop(1,'rgba(9,22,17,.32)');c.fillStyle=grad;c.fillRect(0,0,this.width,this.height);
  if(this.dragRect){const {x1,y1,x2,y2}=this.dragRect;c.fillStyle='rgba(94,183,207,.12)';c.strokeStyle='#b5d9d9';c.lineWidth=1;c.fillRect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));c.strokeRect(Math.min(x1,x2)+.5,Math.min(y1,y2)+.5,Math.abs(x2-x1),Math.abs(y2-y1));}
 }
 drawMinimap(element){
  const c=element.getContext('2d'),r=element.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(element.width!==Math.round(r.width*dpr)||element.height!==Math.round(r.height*dpr)){element.width=Math.round(r.width*dpr);element.height=Math.round(r.height*dpr);}const w=r.width,h=r.height;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#172b27';c.fillRect(0,0,w,h);
  const scale=Math.min(w/(MAP_SIZE*2+4),h/(MAP_SIZE+4)),ox=w/2,oy=(h-MAP_SIZE*scale)/2;const p=(x,y)=>[ox+(x-y)*scale,oy+(x+y)*scale/2];
  for(let y=0;y<MAP_SIZE;y++)for(let x=0;x<MAP_SIZE;x++){const idx=y*MAP_SIZE+x,pos=p(x+.5,y+.5),ter=this.game.terrain?.[idx];let col=this.game.explored?.[idx]?(ter===1?'#568f90':ter===2?'#b09d74':'#79935a'):'#263c30';if(this.game.explored?.[idx]&&!this.game.visible?.[idx])col=ter===1?'#355959':'#536849';diamond(c,...pos,scale+.15,col);}
  for(const e of this.game.entities){if(e.dead||e.hp===0||e.amount===0||!this.isVisible(e))continue;const q=p(e.x,e.y);if(e.kind==='resource'){c.fillStyle=e.type==='tree'?'#36583b':e.type==='gold'?'#d4b762':e.type==='stone'?'#a3aa96':'#aa6f62';c.fillRect(q[0]-1,q[1]-1,2,2);}else{c.fillStyle=e.owner==='enemy'?'#e78966':'#7ed7e2';const rr=e.kind==='building'?3:1.5;c.fillRect(q[0]-rr,q[1]-rr,rr*2,rr*2);}}
  for(const e of this.rememberedBuildings.values()){if(this.game.visible?.[this.tileIndex(e)])continue;const q=p(e.x,e.y);c.fillStyle='#965f4b';c.fillRect(q[0]-2,q[1]-2,4,4);}
  const rect=this.canvas.getBoundingClientRect(),corners=[[rect.left,rect.top],[rect.right,rect.top],[rect.right,rect.bottom],[rect.left,rect.bottom]].map(([x,y])=>{const wp=this.screenToWorld(x,y);return p(wp.x,wp.y);});poly(c,corners,'rgba(233,216,156,.035)','#e4d5a5',1);
  this.minimapTransform={scale,ox,oy,width:w,height:h};
 }
 minimapToWorld(clientX,clientY,element){const r=element.getBoundingClientRect(),{scale,ox,oy}=this.minimapTransform;const x=(clientX-r.left-ox)/scale,y=(clientY-r.top-oy)/(scale/2);return{x:(x+y)/2,y:(y-x)/2};}
}
