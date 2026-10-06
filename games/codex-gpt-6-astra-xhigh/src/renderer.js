import {MAP_SIZE,TILE_W,TILE_H,BUILDINGS,UNITS,rng,dist} from './data.js';
const TW=TILE_W/2,TH=TILE_H/2;
const C={blue:['#477d95','#2a536b','#83a9b5'],red:['#a65d4a','#733d35','#d39878']};
export class Renderer {
  constructor(canvas,mini,game) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.mini=mini;this.mctx=mini.getContext('2d');this.game=game;
    const p=this.iso(13,16);this.camera={x:p.x-25,y:p.y+20,zoom:1};this.width=1;this.height=1;this.time=0;this.hover=null;this.placement=null;this.selectionBox=null;this.pointer={x:0,y:0};
    this.makeTerrain();this.resize();
  }
  iso(x,y,z=0){return{x:(x-y)*TW,y:(x+y)*TH-z};}
  toScreen(x,y,z=0){const p=this.iso(x,y,z);return{x:(p.x-this.camera.x)*this.camera.zoom+this.width/2,y:(p.y-this.camera.y)*this.camera.zoom+this.height/2};}
  toWorld(sx,sy){const x=(sx-this.width/2)/this.camera.zoom+this.camera.x,y=(sy-this.height/2)/this.camera.zoom+this.camera.y;return{x:(x/TW+y/TH)/2,y:(y/TH-x/TW)/2};}
  resize(){const rect=this.canvas.getBoundingClientRect();this.width=rect.width;this.height=rect.height;this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);}
  focus(e){if(!e)return;const p=this.iso(e.x,e.y);this.camera.x=p.x;this.camera.y=p.y+10;}
  zoomBy(amount,sx=this.width/2,sy=this.height/2){const before=this.toWorld(sx,sy);this.camera.zoom=Math.max(.5,Math.min(1.65,this.camera.zoom+amount));const after=this.toWorld(sx,sy),a=this.iso(before.x,before.y),b=this.iso(after.x,after.y);this.camera.x+=a.x-b.x;this.camera.y+=a.y-b.y;}
  poly(ctx,pts,fill,stroke=null,lw=1){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
  line(ctx,pts,color,width=1){ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)ctx.lineTo(...pts[i]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  ellipse(ctx,x,y,rx,ry,fill,stroke=null){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  makeTerrain(){
    const rand=rng(this.game.seed+54),size=MAP_SIZE;
    this.terrainCanvas=document.createElement('canvas');this.terrainCanvas.width=size*TILE_W+220;this.terrainCanvas.height=size*TILE_H+220;
    this.terrainOrigin={x:size*TW+110,y:70};const ctx=this.terrainCanvas.getContext('2d');ctx.translate(this.terrainOrigin.x,this.terrainOrigin.y);
    for(const t of this.game.terrain){
      const p=this.iso(t.x,t.y);const points=[[p.x,p.y],[p.x+TW,p.y+TH],[p.x,p.y+TH*2],[p.x-TW,p.y+TH]];
      if(t.kind==='water'||t.kind==='bridge'){
        const v=Math.floor(t.shade*10);this.poly(ctx,points,`rgb(${76+v},${123+v},${127+v})`,'#699393',.5);
        for(let i=0;i<3;i++){const dx=(rand()-.5)*35,dy=10+rand()*18;this.line(ctx,[[p.x+dx-4,p.y+dy],[p.x+dx+5,p.y+dy]],'#a5c0ac38',1);}
      }else{
        const smooth=Math.sin(t.x*.34)*3+Math.cos(t.y*.41)*4+t.shade*5;
        const v=Math.floor(smooth);let r=135+v,g=151+v,b=100+v*.6;
        if(t.shore){r+=20;g+=13;b+=13;}
        this.poly(ctx,points,`rgb(${r},${g},${b})`);
        for(let i=0;i<10;i++){
          const gx=t.x+rand(),gy=t.y+rand(),q=this.iso(gx,gy),color=rand()>.5?'#d0d59b3b':'#596d4240';
          ctx.fillStyle=color;ctx.fillRect(q.x,q.y,rand()*3+.5,rand()*1.1+.5);
          if(i<2&&rand()>.35){this.line(ctx,[[q.x-1,q.y],[q.x-2,q.y-3],[q.x,q.y],[q.x+1,q.y-4]],'#77875166',.7);}
        }
      }
    }
    // Worn paths connect each settlement and the two river crossings.
    const roads=[[[13,16],[11,16],[8.5,14]],[[13,16],[14,18],[18,18.5],[23,15],[27,15],[31,20],[34,29]],[[13,16],[13,20],[15,21.5]],[[13,16],[10,18],[8.5,21],[8,24]],[[13,16],[13,12],[11,9.5]],[[34,29],[35,34],[39,33]],[[34,29],[31,30],[27,32],[24,32],[21,32],[18,29]],[[34,29],[38,24]]];
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const road of roads){const pts=road.map(p=>{const q=this.iso(...p);return[q.x,q.y]});this.line(ctx,pts,'#a7a07455',20);this.line(ctx,pts,'#c5b38a70',13);this.line(ctx,pts,'#c5b58b55',7);}
    for(const road of roads)for(let i=1;i<road.length;i++){
      const a=road[i-1],b=road[i],len=Math.hypot(a[0]-b[0],a[1]-b[1]);
      for(let j=0;j<len*5;j++){const f=rand(),p=this.iso(a[0]+(b[0]-a[0])*f+(rand()-.5)*.33,a[1]+(b[1]-a[1])*f+(rand()-.5)*.33);this.ellipse(ctx,p.x,p.y,1.8+rand()*2,.8+rand(),rand()>.5?'#ddd0a371':'#867e5d45');}
    }
    // Small meadow flowers make the landscape feel hand illustrated.
    for(let i=0;i<580;i++){
      const x=rand()*44,y=rand()*44;if(this.game.terrain[Math.floor(y)*44+Math.floor(x)]?.kind!=='grass')continue;
      const p=this.iso(x,y);this.line(ctx,[[p.x,p.y],[p.x,p.y-3]],'#667b4955',.8);this.ellipse(ctx,p.x,p.y-3,1.3,.8,rand()>.55?'#e4d59b9a':'#ebe6c475');
    }
    ctx.lineCap='butt';
    for(const t of this.game.terrain)if(t.kind==='bridge')this.drawBridgeTile(ctx,t);
  }
  drawBridgeTile(ctx,t){
    const p=this.iso(t.x,t.y);this.poly(ctx,[[p.x,p.y-2],[p.x+TW,p.y+TH-2],[p.x,p.y+TH*2-2],[p.x-TW,p.y+TH-2]],'#b6ab88','#7a765a',1);
    for(let i=0;i<6;i++){const a=this.iso(t.x+i/6,t.y,2),b=this.iso(t.x+i/6,t.y+1,2);this.line(ctx,[[a.x,a.y],[b.x,b.y]],'#786f507a',1);}
    const first=t.y===14||t.y===31,edge=first?t.y:t.y+1;
    const a=this.iso(t.x,edge,12),b=this.iso(t.x+1,edge,12);this.line(ctx,[[a.x,a.y],[b.x,b.y]],'#5d644d',3);
    for(let i=0;i<=2;i++){const c=this.iso(t.x+i/2,edge,0),d=this.iso(t.x+i/2,edge,17);this.line(ctx,[[c.x,c.y],[d.x,d.y]],'#666a51',3);}
  }
  render(time){
    this.time=time;const ctx=this.ctx,z=this.camera.zoom;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle='#3d5447';ctx.fillRect(0,0,this.width,this.height);
    ctx.save();ctx.translate(this.width/2-this.camera.x*z,this.height/2-this.camera.y*z);ctx.scale(z,z);
    ctx.drawImage(this.terrainCanvas,-this.terrainOrigin.x,-this.terrainOrigin.y);
    this.drawWater(ctx);
    const visible=this.game.entities.filter(e=>{
      if(e.hp<=0)return false;const p=this.toScreen(e.x,e.y);
      return p.x>-200&&p.x<this.width+200&&p.y>-30&&p.y<this.height+230&&(e.owner!==1||this.game.isVisible(e));
    }).sort((a,b)=>(a.x+a.y)-(b.x+b.y));
    // Ground decorations and selection rings sit beneath people and buildings.
    for(const e of visible)if(e.kind==='building'&&e.type==='farm')this.drawFarm(ctx,e);
    for(const e of visible){if(this.game.selected.includes(e.id))this.drawRing(ctx,e,true);else if(this.hover===e.id)this.drawRing(ctx,e,false);}
    for(const e of visible){
      const p=this.iso(e.x,e.y);ctx.save();ctx.translate(p.x,p.y);
      if(e.kind==='resource')this.drawResource(ctx,e);
      else if(e.kind==='building'){if(e.type!=='farm')this.drawBuilding(ctx,e);}
      else this.drawUnit(ctx,e);
      ctx.restore();
      if((this.game.selected.includes(e.id)||this.hover===e.id||e.hp<e.maxHp*.95)&&e.kind!=='resource')this.drawHealth(ctx,e);
    }
    this.drawFog(ctx);
    for(const p of this.game.projectiles)this.drawProjectile(ctx,p);
    for(const e of this.game.effects)if(this.game.isExplored(e))this.drawEffect(ctx,e);
    if(this.placement)this.drawPlacement(ctx);
    const selected=this.game.getSelected();
    if(selected.length===1&&selected[0].kind==='building'&&selected[0].rally){const b=selected[0],p=this.iso(b.rally.x,b.rally.y);ctx.save();ctx.translate(p.x,p.y);this.flag(ctx,0,0,0,25,0);ctx.restore();const a=this.iso(b.x,b.y);ctx.setLineDash([4,5]);this.line(ctx,[[a.x,a.y],[p.x,p.y]],'#eddd9566',1);ctx.setLineDash([]);}
    ctx.restore();
    if(this.selectionBox){const b=this.selectionBox;ctx.fillStyle='#abcbbb19';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#d7dfb9c0';ctx.lineWidth=1;ctx.strokeRect(b.x+.5,b.y+.5,b.w,b.h);}
    this.drawMinimap();
  }
  drawWater(ctx){
    for(const t of this.game.terrain)if(t.kind==='water'){
      const p=this.iso(t.x+.5,t.y+.5),phase=(this.time*.24+t.shade*7)%1;
      ctx.globalAlpha=Math.sin(phase*Math.PI)*.2;
      this.line(ctx,[[p.x-11+phase*6,p.y+phase*3],[p.x+4+phase*8,p.y+phase*3]],'#e0ecd5',1);
    }ctx.globalAlpha=1;
  }
  drawFog(ctx){
    if(this.fogVersion!==this.game.visionVersion||this.fogGame!==this.game){
      this.fogVersion=this.game.visionVersion;this.fogGame=this.game;
      const scale=.25,w=Math.ceil(this.terrainCanvas.width*scale),h=Math.ceil(this.terrainCanvas.height*scale);
      if(!this.fogCanvas){this.fogCanvas=document.createElement('canvas');this.fogRaw=document.createElement('canvas');}
      this.fogCanvas.width=w;this.fogCanvas.height=h;this.fogRaw.width=w;this.fogRaw.height=h;
      const raw=this.fogRaw.getContext('2d');raw.scale(scale,scale);raw.translate(this.terrainOrigin.x,this.terrainOrigin.y);
      for(const t of this.game.terrain){
        const i=t.y*44+t.x;if(this.game.visible[i])continue;const p=this.iso(t.x,t.y),color=this.game.explored[i]?'#17343248':'#102d3b96';
        this.poly(raw,[[p.x,p.y],[p.x+TW,p.y+TH],[p.x,p.y+TH*2],[p.x-TW,p.y+TH]],color,color,1.5);
      }
      const fog=this.fogCanvas.getContext('2d');fog.filter='blur(5px)';fog.drawImage(this.fogRaw,0,0);
    }
    ctx.drawImage(this.fogCanvas,-this.terrainOrigin.x,-this.terrainOrigin.y,this.terrainCanvas.width,this.terrainCanvas.height);
  }
  drawRing(ctx,e,selected){const p=this.iso(e.x,e.y);const ally=e.owner===0;const color=ally?(selected?'#f0d7a0':'#eee6bd88'):e.owner===1?'#ed9275':'#e5ddb988';
    ctx.lineWidth=selected?1.7:1;
    if(e.kind==='building'){const s=BUILDINGS[e.type].size/2+.12,pts=[[-s,-s],[s,-s],[s,s],[-s,s]].map(([x,y])=>{const q=this.iso(e.x+x,e.y+y);return[q.x,q.y]});this.poly(ctx,pts,selected?'#eddfa610':null,color,selected?1.4:1);}
    else {const r=e.kind==='resource'?22:e.type==='knight'||e.type==='scout'?22:14;ctx.beginPath();ctx.ellipse(p.x,p.y+1,r,r*.45,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.stroke();if(selected){ctx.fillStyle='#ecdc9d14';ctx.fill();}}
  }
  drawResource(ctx,e){
    if(e.resource==='wood'){
      const s=e.scale,variant=e.variant;ctx.scale(s,s);
      this.ellipse(ctx,9,3,21,10,'#344b3b25');
      this.poly(ctx,[[-3,2],[-2,-26],[3,-31],[4,2]],'#746545','#4c5940',.7);
      this.line(ctx,[[0,-16],[-10,-32]],'#65593c',2);this.line(ctx,[[1,-20],[11,-39]],'#6a5b3b',2);
      if(variant===0||variant===4){
        this.poly(ctx,[[-23,-16],[-10,-35],[-16,-33],[-3,-57],[1,-75],[12,-52],[9,-52],[23,-24],[16,-28],[23,-13],[1,-7]],'#425f43','#415a3e',.7);
        this.poly(ctx,[[-23,-16],[-10,-35],[-16,-33],[-3,-57],[1,-75],[1,-7]],'#6f8550');
        this.poly(ctx,[[-16,-33],[-3,-57],[1,-75],[6,-56],[1,-49]],'#91a363');
        this.line(ctx,[[-17,-20],[-1,-15],[12,-20]],'#8b9c5766',1);
      }else{
        const colors=variant===1?['#566f43','#748751','#8b9d5b','#a3ae6a']:variant===2?['#506b49','#6a8052','#87985f','#a0ac6c']:['#647b48','#869456','#a0ad64','#b0b973'];
        this.poly(ctx,[[-25,-29],[-28,-42],[-22,-51],[-12,-55],[-10,-66],[3,-71],[17,-63],[20,-52],[29,-44],[25,-26],[13,-18],[-8,-20]],colors[0],'#506641',.6);
        this.poly(ctx,[[-25,-29],[-28,-42],[-22,-51],[-12,-55],[-10,-66],[3,-71],[8,-55],[-2,-46],[-1,-32],[-11,-23]],colors[1]);
        this.poly(ctx,[[-10,-66],[3,-71],[17,-63],[20,-52],[7,-43],[-2,-46],[-13,-53]],colors[2]);
        this.poly(ctx,[[-10,-66],[3,-71],[12,-64],[1,-60],[-10,-57]],colors[3]);
        this.poly(ctx,[[-22,-51],[-12,-55],[-9,-43],[-18,-35],[-26,-40]],colors[2]);
        this.poly(ctx,[[7,-43],[20,-52],[29,-44],[25,-36],[16,-33]],colors[1]);
        for(const [x,y]of [[-12,-60],[9,-59],[-20,-43],[15,-38],[-7,-36]])this.line(ctx,[[x-2,y],[x+2,y-1]],'#c5c98055',1.2);
      }
    }else if(e.resource==='food'){
      this.ellipse(ctx,3,2,16,7,'#3b573c25');
      this.poly(ctx,[[-15,0],[-18,-8],[-12,-17],[-4,-19],[3,-22],[11,-16],[16,-8],[12,1]],'#617d44','#597448',.6);
      this.poly(ctx,[[-16,-8],[-12,-17],[-4,-19],[3,-22],[6,-16],[-4,-10]],'#87974f');
      for(const [x,y]of [[-9,-10],[2,-17],[7,-8],[-2,-5],[12,-6],[-5,-14]]){this.ellipse(ctx,x,y,2.1,2,'#a85c50');this.ellipse(ctx,x-.6,y-.8,.6,.5,'#df9a6e');}
    }else{
      const gold=e.resource==='gold',s=e.scale;ctx.scale(s,s);this.ellipse(ctx,3,2,20,9,'#47574622');
      this.poly(ctx,[[-17,1],[-20,-9],[-11,-20],[2,-25],[14,-18],[20,-7],[13,4],[0,8]],gold?'#888571':'#7c8984','#66786a',.65);
      this.poly(ctx,[[-20,-9],[-11,-20],[2,-25],[6,-12],[-4,-6]],gold?'#b4a878':'#b0b7a2');
      this.poly(ctx,[[2,-25],[14,-18],[20,-7],[6,-12]],gold?'#c1b387':'#9ca79a');
      this.poly(ctx,[[-4,-6],[6,-12],[20,-7],[13,4],[0,8]],gold?'#938b6e':'#83938a');
      if(gold)for(const [x,y]of [[-10,-13],[1,-16],[9,-7],[-4,-3],[5,2]])this.poly(ctx,[[x-3,y],[x,y-5],[x+4,y-3],[x+3,y+1]],'#d9bc66','#e5d28d',.5);
      else this.line(ctx,[[-17,1],[-4,-6],[1,-16]],'#c4c9b172',1);
    }
  }
  p3(x,y,z=0){const p=this.iso(x,y,z);return[p.x,p.y];}
  polygon3(ctx,points,fill,stroke='#4b584752',width=.7){this.poly(ctx,points.map(p=>this.p3(...p)),fill,stroke,width);}
  line3(ctx,points,color,width=1){this.line(ctx,points.map(p=>this.p3(...p)),color,width);}
  box(ctx,x,y,w,d,h,z=0,colors=['#d8ccaa','#b4ad91','#ece0b9']){
    const a=x-w/2,b=x+w/2,c=y-d/2,f=y+d/2;
    this.polygon3(ctx,[[a,f,z],[b,f,z],[b,f,z+h],[a,f,z+h]],colors[0]);
    this.polygon3(ctx,[[b,c,z],[b,f,z],[b,f,z+h],[b,c,z+h]],colors[1]);
    this.polygon3(ctx,[[a,c,z+h],[b,c,z+h],[b,f,z+h],[a,f,z+h]],colors[2]);
  }
  roof(ctx,x,y,w,d,h,r,owner,straw=false){
    const [light,dark,trim]=straw?['#bda16c','#9a8057','#d6c18d']:C[owner===1?'red':'blue'];
    const a=x-w/2,b=x+w/2,c=y-d/2,f=y+d/2;
    this.polygon3(ctx,[[a,c,h],[b,c,h],[b,y,h+r],[a,y,h+r]],dark,'#34463b99');
    this.polygon3(ctx,[[b,c,h],[b,f,h],[b,y,h+r]],'#d6c5a0','#655d45');
    this.polygon3(ctx,[[a,y,h+r],[b,y,h+r],[b,f,h],[a,f,h]],light,'#344a4099');
    for(let i=1;i<6;i++){const t=i/6;this.line3(ctx,[[a,y+(d/2)*t,h+r-r*t],[b,y+(d/2)*t,h+r-r*t]],straw?'#ddc38a58':'#b2c3ac28',.8);}
    for(let i=1;i<8;i++){const tx=a+(b-a)*i/8;this.line3(ctx,[[tx,y,h+r],[tx,f,h]],straw?'#7e6d4366':'#1b425238',.65);}
    this.line3(ctx,[[a,y,h+r+1],[b,y,h+r+1]],trim,2);
    this.line3(ctx,[[b,y,h+r],[b,f,h]],'#ceb989',2);
    this.line3(ctx,[[a,f,h],[b,f,h]],'#726c4d',2.5);
  }
  hall(ctx,x,y,w,d,h,r,owner,straw=false,timber=true){
    this.box(ctx,x,y,w,d,h,0,['#d7cbaa','#aca990','#e4d3ad']);
    const a=x-w/2,b=x+w/2,f=y+d/2;
    if(timber){for(let i=0;i<4;i++){const tx=a+(w*i/3);this.line3(ctx,[[tx,f,1],[tx,f,h]],'#766b4a',2.5);}this.line3(ctx,[[a,f,h*.55],[b,f,h*.55]],'#887b52',2);this.line3(ctx,[[b,y-d/2,0],[b,y-d/2,h]],'#756b4f',2);this.line3(ctx,[[b,y,0],[b,y,h]],'#756b4f',2);}
    for(const tx of [x-w*.25,x+w*.25])this.window(ctx,tx,f+.009,h*.64,8,11,'y');
    this.window(ctx,b+.005,y-d*.22,h*.61,7,10,'x');
    this.roof(ctx,x,y,w+.18,d+.18,h,r,owner,straw);
  }
  window(ctx,x,y,z,w,h,face='y'){
    const p=this.iso(x,y,z);ctx.save();ctx.translate(p.x,p.y);ctx.transform(1,face==='y'?.5:-.5,0,1,0,0);
    ctx.fillStyle='#4d5142';ctx.fillRect(-w/2,-h,w,h);ctx.fillStyle='#baa779';ctx.fillRect(-w/2+1,-h+1,w-2,2);ctx.strokeStyle='#7b785b';ctx.lineWidth=1;ctx.strokeRect(-w/2,-h,w,h);ctx.restore();
  }
  door(ctx,x,y,z=0,w=14,h=24,face='y'){
    const p=this.iso(x,y,z);ctx.save();ctx.translate(p.x,p.y);ctx.transform(1,face==='y'?.5:-.5,0,1,0,0);
    ctx.fillStyle='#514b37';ctx.beginPath();ctx.moveTo(-w/2,0);ctx.lineTo(-w/2,-h+w/2);ctx.arc(0,-h+w/2,w/2,Math.PI,0);ctx.lineTo(w/2,0);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#a39470';ctx.lineWidth=2.3;ctx.stroke();this.line(ctx,[[0,-h+3],[0,0]],'#7f7150',1);this.line(ctx,[[-w/2+2,-h*.4],[w/2-2,-h*.4]],'#91815a',1);this.ellipse(ctx,3,-h*.45,.9,.9,'#bba76c');ctx.restore();
  }
  flag(ctx,x,y,z,h=28,owner=0){
    const p=this.iso(x,y,z);this.line(ctx,[[p.x,p.y],[p.x,p.y-h]],'#665d41',1.7);this.ellipse(ctx,p.x,p.y-h,1.9,1.9,'#d5bf75');
    const wave=Math.sin(this.time*3+x*4)*2;const colors=C[owner===1?'red':'blue'];
    this.poly(ctx,[[p.x+1,p.y-h+3],[p.x+18,p.y-h+6+wave],[p.x+15,p.y-h+12+wave],[p.x+1,p.y-h+12]],colors[0],colors[2],.7);
    this.line(ctx,[[p.x+6,p.y-h+5],[p.x+6,p.y-h+11]],'#e3d59c',1);this.line(ctx,[[p.x+3,p.y-h+8],[p.x+9,p.y-h+9]],'#e3d59c',1);
  }
  tower(ctx,x,y,w,d,h,owner,roof=true){
    this.box(ctx,x,y,w+.1,d+.1,5,0,['#c3ba98','#9e9e83','#d7cbaa']);
    this.box(ctx,x,y,w,d,h,4,['#d9cfae','#abb39e','#dce0b9']);
    for(let i=1;i<5;i++){this.line3(ctx,[[x-w/2,y+d/2,4+h*i/5],[x+w/2,y+d/2,4+h*i/5],[x+w/2,y-d/2,4+h*i/5]],'#89957d55',.65);}
    this.window(ctx,x,y+d/2+.01,h*.8,5,12);this.window(ctx,x+w/2+.01,y,h*.55,4,11,'x');
    if(roof){this.roof(ctx,x,y,w+.25,d+.25,h+4,23,owner);this.flag(ctx,x,y,h+27,25,owner);}
    else{
      this.box(ctx,x,y,w+.17,d+.17,5,h+4,['#d5d1b2','#9fac97','#e1dbb7']);
      for(const px of [-1,0,1])for(const py of [-1,1])this.box(ctx,x+px*w/2.5,y+py*d/2.5,.19,.19,9,h+8,['#d9d0ad','#a7b09b','#eee2bd']);
      this.flag(ctx,x-.1,y,h+10,31,owner);
    }
  }
  drawBuilding(ctx,b,portrait=false){
    const owner=b.owner===1?1:0,d=BUILDINGS[b.type],s=d.size;
    this.ellipse(ctx,11,10,s*TW*.67,s*TH*.56,'#2a46352e');
    if(!b.complete&&!portrait){
      ctx.save();ctx.globalAlpha=.34;this.drawBuilding(ctx,{...b,complete:true},true);ctx.restore();
      this.box(ctx,0,0,s*.91,s*.91,4,0,['#999978','#7f896d','#bbb48e']);
      for(const [x,y]of [[-.45,-.45],[.45,-.45],[.45,.45],[-.45,.45]]){
        this.line3(ctx,[[x*s,y*s,0],[x*s,y*s,52]],'#88794d',3);
        this.line3(ctx,[[x*s,y*s,35],[-x*s,y*s,35]],'#a59362',2);
        this.line3(ctx,[[x*s,y*s,5],[-x*s,y*s,46]],'#a18e5e',1.5);
      }
      const p=this.iso(s*.15,s*.3);this.poly(ctx,[[p.x-9,p.y],[p.x,p.y-5],[p.x+16,p.y+3],[p.x+7,p.y+8]],'#b7a077','#8c7853');return;
    }
    this.box(ctx,0,0,s*.92,s*.92,3,-1,['#aaa383','#949879','#b7b18d']);
    switch(b.type){
      case'towncenter':{
        this.tower(ctx,-.91,-.45,.63,.7,51,owner,true);
        this.hall(ctx,.05,-.06,2.02,1.63,48,39,owner,false,true);
        this.box(ctx,.25,.98,1.48,.55,6,0,['#b9b398','#9f9f86','#d1c8a6']);
        this.box(ctx,.25,1.14,1.68,.32,3,0,['#b9b398','#9f9f86','#d1c8a6']);
        this.door(ctx,.17,.765,6,22,34);
        this.box(ctx,.05,.81,1.65,.1,3,42,['#9e8b5c','#7b7654','#c7b67f']);
        this.polygon3(ctx,[[-.83,.77,47],[.89,.77,47],[.89,1.2,34],[-.83,1.2,34]],C[owner?'red':'blue'][0],'#d2bd83',1);
        for(const x of [-.79,.86])this.line3(ctx,[[x,1.15,5],[x,1.15,35]],'#a38a59',3);
        this.tower(ctx,1,-.51,.55,.64,57,owner,true);
        this.flag(ctx,-.25,-.06,88,29,owner);
        // Heraldic banner on the gable.
        this.polygon3(ctx,[[1.09,-.22,61],[1.09,.16,61],[1.09,.16,42],[1.09,-.03,37],[1.09,-.22,42]],C[owner?'red':'blue'][0],'#dcc78e',1);
        this.crates(ctx,-1.2,.74);break;
      }
      case'house':{
        this.hall(ctx,0,0,1.55,1.3,28,25,owner,true,true);this.door(ctx,.12,.66,0,12,21);
        this.box(ctx,-.44,-.2,.19,.24,25,34,['#b5b79a','#8e9a85','#d5d0b0']);this.smoke(ctx,-.44,-.2,61,portrait);
        this.crates(ctx,.94,.3);break;
      }
      case'barracks':{
        this.hall(ctx,-.05,-.18,2.45,1.7,36,29,owner);this.door(ctx,1.18,-.08,0,19,30,'x');
        this.box(ctx,.2,.97,2.25,.18,8,0,['#a59870','#7b8060','#b5a877']);
        this.flag(ctx,-1,.95,5,52,owner);this.flag(ctx,1,.95,5,40,owner);
        const p=this.iso(.22,1.09,14);this.shield(ctx,p.x,p.y,owner,9);
        this.line3(ctx,[[-.5,1.05,5],[-.5,1.05,32]],'#b9b9a0',2);this.line3(ctx,[[-.68,1.05,12],[-.32,1.05,12]],'#897955',2);
        this.crates(ctx,-1.2,.5);break;
      }
      case'lumbercamp':{
        this.hall(ctx,-.24,-.25,1.32,1.05,20,17,owner,true);this.logs(ctx,.48,.52);this.logs(ctx,.73,-.22);break;
      }
      case'miningcamp':{
        this.hall(ctx,-.1,-.2,1.3,1.1,22,19,owner,true);this.crates(ctx,.7,.5);this.line3(ctx,[[-.2,.83,2],[.1,.8,28]],'#756346',3);this.line3(ctx,[[-.1,.8,25],[.3,.8,25]],'#b9ba9d',3);break;
      }
      case'mill':{
        this.box(ctx,0,0,1.02,1.02,39,0,['#d8cda8','#a7a78d','#ddd0a9']);this.roof(ctx,0,0,1.24,1.24,39,25,owner,true);this.door(ctx,0,.52,0,12,20);
        const p=this.iso(0,.67,43);const angle=this.time*.23;
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
        for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);this.poly(ctx,[[-2,0],[-3,-35],[5,-38],[7,-11]],'#d2c9a4','#8d8058',1);for(let j=0;j<4;j++)this.line(ctx,[[-2,-12-j*6],[6,-13-j*6]],'#9e956c',.7);}
        this.ellipse(ctx,0,0,4,4,'#968460','#c3b58b');ctx.restore();this.crates(ctx,.65,.4);break;
      }
      case'range':{
        this.hall(ctx,-.3,-.45,2,1.15,29,25,owner);this.door(ctx,.2,.13,0,13,24);
        for(const x of [-.8,.1,1]){const p=this.iso(x,.95,20);this.line(ctx,[[p.x,p.y],[p.x-3,p.y+23]],'#7e7050',2);this.line(ctx,[[p.x,p.y],[p.x+8,p.y+19]],'#7e7050',2);this.ellipse(ctx,p.x,p.y,11,15,'#d8ccb0','#857d58');this.ellipse(ctx,p.x,p.y,7,10,'#9a6650');this.ellipse(ctx,p.x,p.y,4,6,'#d0c59c');this.ellipse(ctx,p.x,p.y,1.5,2.7,'#586f63');}break;
      }
      case'stable':{
        this.hall(ctx,-.1,-.5,2.2,1.15,33,25,owner,true);this.door(ctx,.6,.08,0,22,27);
        for(const x of [-1.1,1.1])this.line3(ctx,[[x,.25,0],[x,.25,27],[x,1.1,27],[x,1.1,0]],'#85764f',3);
        for(const h of [9,20])this.line3(ctx,[[-1.1,1.1,h],[1.1,1.1,h]],'#ad9c66',2);
        const p=this.iso(-.35,.58);ctx.save();ctx.translate(p.x,p.y);this.drawHorse(ctx,0,owner,false);ctx.restore();this.crates(ctx,1,-.7);break;
      }
      case'blacksmith':{
        this.hall(ctx,-.2,-.15,1.35,1.4,29,21,owner);this.box(ctx,.66,-.35,.44,.45,60,0,['#a8a88c','#879482','#bebea1']);this.smoke(ctx,.66,-.35,63,portrait);
        this.door(ctx,-.15,.56,0,20,24);const p=this.iso(-.15,.59,8);this.ellipse(ctx,p.x,p.y,8,5,'#dd954e');this.ellipse(ctx,p.x,p.y-1,4,4,'#f0c76f');
        this.box(ctx,.6,.8,.4,.32,10,0,['#576764','#384d4e','#77867a']);break;
      }
      case'market':{
        this.hall(ctx,-.1,-.67,2.13,.85,29,22,owner,true);
        for(const [x,y]of [[-.8,.45],[.7,.53]]){
          this.box(ctx,x,y,.75,.54,13,0,['#ac9866','#857951','#c5b47d']);
          for(const px of [-.38,.38])this.line3(ctx,[[x+px,y+.27,0],[x+px,y+.27,32]],'#8b7954',2);
          for(let i=0;i<5;i++)this.polygon3(ctx,[[x-.46+i*.18,y-.36,38],[x-.28+i*.18,y-.36,38],[x-.28+i*.18,y+.44,29],[x-.46+i*.18,y+.44,29]],i%2?'#d8c99b':C[owner?'red':'blue'][0],'#cab68a55');
          for(let i=0;i<3;i++){const p=this.iso(x-.2+i*.19,y,15);this.ellipse(ctx,p.x,p.y,4,3,['#b89959','#b47b56','#a6a35a'][i]);}
        }break;
      }
      case'workshop':{
        this.hall(ctx,-.4,-.4,1.75,1.6,34,25,owner,true);this.door(ctx,.49,-.25,0,21,28,'x');const p=this.iso(.7,.7);ctx.save();ctx.translate(p.x,p.y);this.drawRam(ctx,owner);ctx.restore();this.logs(ctx,-.6,1);break;
      }
      case'tower':{this.tower(ctx,0,0,.85,.85,82,owner,false);this.door(ctx,0,.44,3,11,24);break;}
      case'castle':{
        this.box(ctx,0,0,3.2,2.8,48,0,['#c2c2a7','#929f90','#d3d0ae']);
        this.tower(ctx,-1.35,-1.15,.85,.85,86,owner,false);this.tower(ctx,1.35,-1.15,.85,.85,86,owner,false);
        this.hall(ctx,0,-.25,1.8,1.55,76,38,owner,false,false);
        this.tower(ctx,-1.35,1.15,.85,.85,79,owner,false);this.tower(ctx,1.35,1.15,.85,.85,79,owner,false);
        this.door(ctx,0,1.41,0,28,41);for(let x=-.8;x<1;x+=.35)this.box(ctx,x,1.38,.17,.2,8,48,['#d8d1af','#a5b09a','#e5dab5']);break;
      }
    }
    // Weathered masonry and a few weeds anchor each building to the ground.
    for(let i=0;i<3;i++){const x=-s*.36+i*s*.33,p=this.iso(x,s*.48);this.line(ctx,[[p.x-2,p.y],[p.x-3,p.y-3],[p.x,p.y],[p.x+1,p.y-4]],'#677e4899',1);}
    if(b.hp<b.maxHp*.45&&!portrait){this.smoke(ctx,0,0,55,false,true);}
  }
  logs(ctx,x,y){for(let i=0;i<4;i++){const p=this.iso(x+(i%2)*.16,y+Math.floor(i/2)*.17,Math.floor(i/2)*5+3);this.line(ctx,[[p.x-12,p.y-7],[p.x+9,p.y+4]],'#876b43',7);this.ellipse(ctx,p.x+9,p.y+4,4,3,'#c5ad70','#79643e');this.ellipse(ctx,p.x+9,p.y+4,1.5,1,'#9c804f');}}
  crates(ctx,x,y){this.box(ctx,x,y,.3,.3,12,0,['#b4a171','#8f835b','#c4b383']);this.line3(ctx,[[x-.15,y+.151,1],[x+.15,y+.151,11]],'#85744c',1);this.box(ctx,x+.28,y-.11,.24,.26,9,0,['#c2ac74','#9a885c','#d4bf87']);}
  smoke(ctx,x,y,z,portrait=false,fire=false){if(portrait)return;const p=this.iso(x,y,z);for(let i=0;i<4;i++){const life=(this.time*.25+i*.25)%1;ctx.globalAlpha=(1-life)*.2;this.ellipse(ctx,p.x+life*17+Math.sin(life*8)*3,p.y-life*35,3+life*9,3+life*7,fire?'#594c3c':'#e3e1c6');}ctx.globalAlpha=1;}
  drawFarm(ctx,b){const s=BUILDINGS.farm.size/2,p=this.iso(b.x,b.y);ctx.save();ctx.translate(p.x,p.y);this.polygon3(ctx,[[-s,-s,0],[s,-s,0],[s,s,0],[-s,s,0]],'#a38d60','#92935f');
    for(let i=0;i<9;i++){const x=-.86+i*.21;this.line3(ctx,[[x,-.9,0],[x,.9,0]],'#796f4666',2);for(let j=0;j<9;j++){const y=-.86+j*.2,q=this.iso(x,y),h=4+((i+j)%3);this.line(ctx,[[q.x,q.y],[q.x,q.y-h]],'#d3bd6d',1.2);this.line(ctx,[[q.x,q.y-h+2],[q.x-2,q.y-h],[q.x,q.y-h+3],[q.x+2,q.y-h+1]],'#e1cd82',1);}}
    for(const [x,y]of [[-1,-1],[1,-1],[1,1],[-1,1]])this.line3(ctx,[[x,y,0],[x,y,11]],'#9d8f5b',2);ctx.restore();if(!b.complete){const q=this.iso(b.x,b.y);ctx.save();ctx.translate(q.x,q.y);this.drawBuilding(ctx,b);ctx.restore();}}
  shield(ctx,x,y,owner,size=7){const colors=C[owner?'red':'blue'];this.poly(ctx,[[x-size*.7,y-size],[x+size*.7,y-size],[x+size*.7,y+size*.25],[x,y+size],[x-size*.7,y+size*.25]],colors[0],'#d9cc98',1);this.line(ctx,[[x,y-size*.6],[x,y+size*.55]],'#d7c88b',1.1);this.line(ctx,[[x-size*.45,y-size*.1],[x+size*.45,y-size*.1]],'#d7c88b',1.1);}
  drawUnit(ctx,u,portrait=false){
    const owner=u.owner===1?1:0,colors=C[owner?'red':'blue'],walking=u.path?.length>0,sway=walking?Math.sin(u.anim)*2:Math.sin(this.time*2+u.id)*.3;
    if(u.type==='ram'){this.drawRam(ctx,owner);return;}
    if(u.type==='trebuchet'){this.drawTrebuchet(ctx,owner);return;}
    if(u.type==='scout'||u.type==='knight'){this.drawHorse(ctx,sway,owner,u.type==='knight');ctx.translate(0,-11);}
    else this.ellipse(ctx,2,2,9,4,'#2d483940');
    const action=['gather','build','repair','attack'].includes(u.order?.type)&&!walking?Math.sin(u.anim*2.4)*3:0;
    ctx.save();ctx.scale(u.facing||1,1);
    this.line(ctx,[[-3,-7],[-4+sway,0]],'#4b5040',3);this.line(ctx,[[3,-7],[4-sway,0]],'#4b5040',3);
    this.poly(ctx,[[-5,-19],[4,-19],[6,-7],[-6,-7]],colors[0],'#35504a',.7);
    this.poly(ctx,[[-5,-19],[-1,-19],[-1,-8],[-6,-7]],colors[2]);
    this.line(ctx,[[-5,-16],[-8,-9+action]],'#c8ac7d',3);this.line(ctx,[[5,-16],[8,-10-action]],'#c8ac7d',3);
    this.line(ctx,[[-5,-10],[5,-10]],'#796743',1.6);
    this.ellipse(ctx,0,-22,4,4.8,'#d1b488','#8d805e');
    if(u.type==='villager'){
      this.ellipse(ctx,-.4,-25,5.6,2,'#bfab70','#9e8f59');this.poly(ctx,[[-3,-25],[-3,-28],[2,-28],[3,-25]],'#d0b982');
      if(u.order?.type==='gather'&&u.order.resource==='wood'){this.line(ctx,[[8,-9-action],[10,-23-action]],'#8c7248',2);this.poly(ctx,[[9,-24-action],[15,-22-action],[15,-17-action],[10,-18-action]],'#a9b6a3','#5c7066',.7);}
      else if(u.order?.type==='build'||u.order?.type==='repair'){this.line(ctx,[[8,-9-action],[9,-21-action]],'#8c7248',2);this.line(ctx,[[5,-21-action],[13,-21-action]],'#929a87',4);}
      else if(u.order?.resource==='gold'||u.order?.resource==='stone'){this.line(ctx,[[8,-9-action],[10,-22-action]],'#8c7248',2);this.line(ctx,[[4,-24-action],[10,-25-action],[16,-20-action]],'#a6b09c',2);}
      if(u.cargo>0){this.ellipse(ctx,-7,-10,5,5,u.cargoType==='wood'?'#a58e59':u.cargoType==='gold'?'#d2b667':'#c8b686','#8f8558');}
    }else if(u.type==='archer'){
      this.poly(ctx,[[-5,-23],[-3,-29],[3,-29],[6,-22],[2,-24]],colors[0],'#3b635b',.5);
      ctx.beginPath();ctx.arc(7,-15,9,-Math.PI/2,Math.PI/2);ctx.strokeStyle='#ccb87b';ctx.lineWidth=1.7;ctx.stroke();this.line(ctx,[[7,-24],[7,-6]],'#e8dfb28c',.7);
      this.line(ctx,[[-5,-13],[-8,-25]],'#6d674c',4);
    }else{
      this.poly(ctx,[[-4,-22],[-4,-26],[-2,-29],[2,-29],[5,-25],[5,-22]],'#b3c0b4','#697e75',.7);this.line(ctx,[[0,-28],[0,-22]],'#e3dcc0',1);
      this.shield(ctx,-7,-13,owner,u.type==='knight'?7:6);
      this.line(ctx,[[8,-10-action],[11,-29-action]],'#d2d9be',2);this.line(ctx,[[6,-15-action],[12,-14-action]],'#c2ac6a',1.5);
      if(u.type==='knight')this.poly(ctx,[[-4,-20],[4,-20],[5,-10],[-4,-11]],'#96adb0','#bfd0bd',.8);
    }
    ctx.restore();
  }
  drawHorse(ctx,sway,owner,armored){this.ellipse(ctx,3,2,17,6,'#2b443b35');const coat=armored?'#737775':'#90704b';
    this.line(ctx,[[-8,-7],[-10+sway,0]],'#5c5945',3);this.line(ctx,[[9,-8],[12-sway,0]],'#5c5945',3);this.line(ctx,[[2,-7],[4+sway,1]],'#5c5945',2.5);
    this.ellipse(ctx,0,-12,15,7,coat,'#645c48');this.poly(ctx,[[7,-13],[8,-24],[15,-27],[19,-23],[22,-19],[20,-15],[14,-17],[12,-8]],coat,'#5b5d4b',.8);
    this.poly(ctx,[[10,-24],[10,-31],[14,-27],[16,-29],[16,-25]],'#625f4a');this.ellipse(ctx,17,-23,1,1,'#293e36');
    this.line(ctx,[[-13,-13],[-19,-10],[-18,-4]],'#605540',3);this.poly(ctx,[[-7,-17],[5,-17],[6,-9],[-7,-8]],C[owner?'red':'blue'][0],'#c6b481',.8);
    this.line(ctx,[[11,-23],[17,-15],[2,-17]],'#c2b17e',.8);
    if(armored)this.poly(ctx,[[7,-21],[13,-24],[15,-15],[11,-10],[7,-12]],'#a2b0a4','#6c8380',.7);
  }
  drawRam(ctx,owner){this.ellipse(ctx,4,5,28,12,'#2c49383b');
    for(const x of [-17,15])for(const y of [-5,9]){this.ellipse(ctx,x,y,5,7,'#6f6348','#aaa078');this.ellipse(ctx,x,y,2,3,'#a4976b');}
    this.box(ctx,0,0,.75,.9,17,3,['#a0926a','#7b7c59','#b5a77b']);this.roof(ctx,0,0,1.0,1.05,20,13,owner,true);
    this.line(ctx,[[0,0],[33,15]],'#897046',7);this.ellipse(ctx,33,15,4,5,'#abb19d','#718779');this.shield(ctx,-15,-10,owner,6);
  }
  drawTrebuchet(ctx,owner){
    this.ellipse(ctx,5,4,28,12,'#2c493b35');
    for(const x of [-19,16]){this.ellipse(ctx,x,5,5,7,'#6b644e','#b5a479');this.ellipse(ctx,x,5,2,3,'#a29266');}
    this.box(ctx,0,0,.85,1,7,2,['#b49e70','#867b57','#c4b083']);
    this.line(ctx,[[-21,-1],[-2,-43],[16,5]],'#8b7951',5);
    this.line(ctx,[[-9,8],[7,-37],[27,-4]],'#b29b65',4);
    this.line(ctx,[[-2,-43],[7,-37]],'#d0b882',4);
    this.line(ctx,[[-20,-66],[20,-10]],'#bb9f65',4);
    this.line(ctx,[[-20,-66],[-24,-47]],'#ddd1a5',1);
    this.poly(ctx,[[-30,-48],[-21,-51],[-16,-43],[-25,-39]],'#8a9281','#bcbca0',1);
    this.line(ctx,[[20,-10],[29,-15],[36,-12]],'#b5a780',1.3);
    this.ellipse(ctx,36,-12,4,3,'#858d7b','#b6ba9b');this.shield(ctx,-3,-13,owner,6);
  }
  drawHealth(ctx,e){const p=this.iso(e.x,e.y,e.kind==='building'?(e.type==='castle'?145:e.type==='tower'?131:e.type==='towncenter'?122:95):e.type==='knight'||e.type==='scout'?48:37);const width=e.kind==='building'?48:26;ctx.fillStyle='#112e2b9c';ctx.fillRect(p.x-width/2-1,p.y-1,width+2,5);ctx.fillStyle=e.owner===1?'#c67d65':'#b9cc89';ctx.fillRect(p.x-width/2,p.y,width*Math.max(0,e.hp/e.maxHp),3);if(e.kind==='building'&&!e.complete){ctx.fillStyle='#cfb671';ctx.fillRect(p.x-width/2,p.y+6,width*e.progress,2);}}
  drawProjectile(ctx,p){const t=1-p.life/p.total,a=this.iso(p.from.x,p.from.y,p.high?65:20),b=this.iso(p.to.x,p.to.y,15),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*(p.stone?85:22);if(p.stone){this.ellipse(ctx,x,y,4,3.5,'#69766c','#c4c8a8');return;}const angle=Math.atan2(b.y-a.y,b.x-a.x);this.line(ctx,[[x-Math.cos(angle)*10,y-Math.sin(angle)*10],[x,y]],'#f5e0a8',1.4);}
  drawEffect(ctx,e){const p=this.iso(e.x,e.y),t=1-e.life/e.maxLife;ctx.save();ctx.globalAlpha=1-t;
    if(e.type==='command'){const r=9+t*19;ctx.strokeStyle=e.hostile?'#efa281':'#efe4ad';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.5,0,0,Math.PI*2);ctx.stroke();this.line(ctx,[[p.x-4,p.y],[p.x,p.y-3],[p.x+4,p.y]],ctx.strokeStyle,1.5);}
    else if(e.type==='deposit'){ctx.font='600 12px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f6e4ae';ctx.shadowColor='#294c36';ctx.shadowBlur=3;ctx.fillText(e.text,p.x+20,p.y-70-t*24);}
    else if(e.type==='hit'){for(let i=0;i<4;i++){const a=i*1.57+t;this.line(ctx,[[p.x+Math.cos(a)*t*6,p.y-12+Math.sin(a)*t*6],[p.x+Math.cos(a)*t*12,p.y-12+Math.sin(a)*t*12]],'#e9d5a1',1.5);}}
    else if(e.type==='death'){const r=e.building?45:10;for(let i=0;i<7;i++){const a=i*2.39;this.ellipse(ctx,p.x+Math.cos(a)*t*r,p.y+Math.sin(a)*t*r*.5-t*10,3+t*10,3+t*5,'#ac9e74');}}
    ctx.restore();
  }
  drawPlacement(ctx){const {type,x,y}=this.placement,valid=this.game.canPlace(type,x,y),s=BUILDINGS[type].size/2;
    const pts=[[-s,-s],[s,-s],[s,s],[-s,s]].map(([dx,dy])=>{const p=this.iso(x+dx,y+dy);return[p.x,p.y]});this.poly(ctx,pts,valid?'#daecad55':'#f1847755',valid?'#e7ecc4':'#f5a38d',2);
    const p=this.iso(x,y);ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=.65;this.drawBuilding(ctx,{type,x,y,owner:0,complete:true,hp:BUILDINGS[type].hp,maxHp:BUILDINGS[type].hp},true);ctx.restore();
  }
  drawMinimap(){const ctx=this.mctx,w=this.mini.width,h=this.mini.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#243e36';ctx.fillRect(0,0,w,h);
    const sx=w/88,sy=(h-10)/88,ox=w/2,oy=5;
    for(const t of this.game.terrain){const index=t.y*44+t.x,visible=this.game.visible[index],explored=this.game.explored[index],p={x:(t.x-t.y)*sx+ox,y:(t.x+t.y)*sy+oy};let color=t.kind==='water'?'#567e80':t.kind==='bridge'?'#b7ad7d':visible?'#84965f':explored?'#637d59':'#3f5e47';this.poly(ctx,[[p.x,p.y],[p.x+sx,p.y+sy],[p.x,p.y+sy*2+.5],[p.x-sx,p.y+sy]],color);}
    for(const e of this.game.entities){if(e.kind==='resource'){if(e.resource==='wood'){ctx.fillStyle=this.game.isExplored(e)?'#426344':'#35573f';ctx.fillRect((e.x-e.y)*sx+ox-1,(e.x+e.y)*sy+oy-1,2,2);}continue;}if(e.owner===1&&!this.game.isVisible(e)&&e.type!=='towncenter')continue;const x=(e.x-e.y)*sx+ox,y=(e.x+e.y)*sy+oy;ctx.fillStyle=e.owner===0?'#9ad4e4':'#e9987c';const r=e.type==='towncenter'?3:e.kind==='building'?2:1;ctx.fillRect(x-r,y-r,r*2+1,r*2+1);}
    const corners=[[0,0],[this.width,0],[this.width,this.height],[0,this.height]].map(([x,y])=>{const p=this.toWorld(x,y);return[(p.x-p.y)*sx+ox,(p.x+p.y)*sy+oy]});this.poly(ctx,corners,null,'#f0e1ac99',1);
  }
  minimapPoint(sx,sy){const w=this.mini.width,h=this.mini.height,a=(sx-w/2)/(w/88),b=(sy-5)/((h-10)/88);return{x:Math.max(0,Math.min(44,(a+b)/2)),y:Math.max(0,Math.min(44,(b-a)/2))};}
  hitTest(sx,sy){const world=this.toWorld(sx,sy);let best=null,score=Infinity;
    for(const e of this.game.entities){if(e.hp<=0||!this.game.isVisible(e))continue;const p=this.toScreen(e.x,e.y),z=this.camera.zoom;
      if(e.kind==='unit'){const h=e.type==='knight'||e.type==='scout'?42:30;const d=Math.hypot((p.x-sx)/1.1,(p.y-h/2*z-sy)/1.6);if(d<17*z&&d<score){best=e;score=d;}}
    }
    if(best)return best;
    const entities=[...this.game.entities].sort((a,b)=>(b.x+b.y)-(a.x+a.y));
    for(const e of entities){if(e.hp<=0||!this.game.isVisible(e)||e.kind==='unit')continue;
      if(e.kind==='building'){const s=BUILDINGS[e.type].size/2;if(Math.abs(e.x-world.x)<s&&Math.abs(e.y-world.y)<s)return e;const p=this.toScreen(e.x,e.y),height=e.type==='towncenter'?110:e.type==='castle'?140:65;const dx=Math.abs(p.x-sx),dy=p.y-sy;if(e.type!=='farm'&&dx<s*TW*.85*this.camera.zoom&&dy>0&&dy<height*this.camera.zoom)return e;}
      else {const p=this.toScreen(e.x,e.y);if(e.resource==='wood'){if(Math.abs(p.x-sx)<22*e.scale*this.camera.zoom&&sy<p.y+5&&sy>p.y-65*e.scale*this.camera.zoom)return e;}else if(Math.hypot(p.x-sx,(p.y-9*this.camera.zoom-sy)*1.2)<21*this.camera.zoom)return e;}
    }return null;
  }
  drawPortrait(canvas,entities){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const e=entities[0];if(!e)return;ctx.save();
    if(e.kind==='building'){ctx.translate(56,e.type==='castle'?101:89);const scale=e.type==='towncenter'?.43:e.type==='castle'?.3:e.type==='tower'?.62:.57;ctx.scale(scale,scale);if(e.type==='farm'){ctx.translate(-this.iso(e.x,e.y).x,-this.iso(e.x,e.y).y);this.drawFarm(ctx,e);}else this.drawBuilding(ctx,{...e,complete:true},true);}
    else if(e.kind==='resource'){ctx.translate(56,90);ctx.scale(1.15,1.15);this.drawResource(ctx,e);}
    else {ctx.translate(55,98);const scale=e.type==='trebuchet'?1.18:e.type==='ram'?1.6:e.type==='knight'||e.type==='scout'?2.05:2.6;ctx.scale(scale,scale);this.drawUnit(ctx,{...e,path:[],order:{type:'idle'},facing:1},true);}
    ctx.restore();
  }
}
