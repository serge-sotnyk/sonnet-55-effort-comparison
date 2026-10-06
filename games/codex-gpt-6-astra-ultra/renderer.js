const TILE_W = 72, TILE_H = 36;
const PAL = { grass:'#7f9462', blue:'#397bbb', blueLight:'#78b6e1', red:'#b95748', stone:'#bebaa0', stoneDark:'#858876', cream:'#e3d4ab', creamDark:'#b2a27c', roof:'#98583e', roofLight:'#bd7951', ink:'#3a4130' };
const sizeOf = b => b.size || ({towncenter:3,house:1.6,barracks:2.4,archery:2.4,stable:2.4,farm:2.4,tower:1.2,castle:3.4}[b.type] || 2);
const hash = (x,y=0) => { let n = Math.imul((x|0)^0x45d9f3b,0x45d9f3b)^Math.imul((y|0)+31,0x27d4eb2d); n ^= n>>>16; return (n>>>0)/4294967295; };
const iso = (x,y,z=0) => [(x-y)*36,(x+y)*18-z];

export class Renderer {
  constructor(canvas,game) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.game=game;
    this.camera={x:11,y:12}; this.zoom=.96; this.hover=null; this.placement=null; this.moveMarkers=[]; this.effects=[]; this.time=0;
    this.resize(); this.makeTerrain();
  }
  resize() { const rect=this.canvas.getBoundingClientRect(); this.width=rect.width||innerWidth; this.height=rect.height||innerHeight; this.dpr=Math.min(window.devicePixelRatio||1,2); this.canvas.width=Math.round(this.width*this.dpr); this.canvas.height=Math.round(this.height*this.dpr); }
  worldToScreen(x,y) { return {x:this.width/2+(x-y-this.camera.x+this.camera.y)*36*this.zoom,y:this.height/2+(x+y-this.camera.x-this.camera.y)*18*this.zoom}; }
  screenToWorld(x,y) { const sx=(x-this.width/2)/this.zoom/36,sy=(y-this.height/2)/this.zoom/18; return {x:this.camera.x+(sx+sy)/2,y:this.camera.y+(sy-sx)/2}; }
  centerOn(x,y) {this.camera.x=x;this.camera.y=y;}
  zoomBy(amount) {this.zoom=Math.max(.45,Math.min(1.7,this.zoom*amount));}
  pan(dx,dy) {this.camera.x+=(dx/36+dy/18)/this.zoom/2;this.camera.y+=(dy/18-dx/36)/this.zoom/2;const n=this.game.mapSize||44;this.camera.x=Math.max(1,Math.min(n-1,this.camera.x));this.camera.y=Math.max(1,Math.min(n-1,this.camera.y));}
  poly(points,fill,stroke=null,width=1) {const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  line(points,color,width=1) {const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  ellipse(x,y,rx,ry,fill,stroke=null,width=1) {const c=this.ctx;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  circle(x,y,r,color) {this.ellipse(x,y,r,r,color);}
  makeTerrain() {
    const n=this.game.mapSize||44,pad=130,halo=12,w=(n+halo*2)*72+pad*2,h=(n+halo*2)*36+pad*2;
    this.terrain=document.createElement('canvas');this.terrain.width=w;this.terrain.height=h;this.terrainOrigin={x:w/2,y:pad+halo*36};
    const old=this.ctx;this.ctx=this.terrain.getContext('2d');const c=this.ctx;c.translate(w/2,pad+halo*36);
    const ground=['#879963','#869862','#889a64','#859762','#879963','#899a65','#859862','#889963'];
    for(let x=-halo;x<n+halo;x++)for(let y=-halo;y<n+halo;y++){
      const p=iso(x,y),r=hash(x,y);this.poly([iso(x,y),iso(x+1,y),iso(x+1,y+1),iso(x,y+1)],ground[Math.floor(r*ground.length)]);
      for(let k=0;k<7;k++){let a=hash(x*29+k,y*7),b=hash(y*31+k,x*13);const q=iso(x+a,y+b);this.line([[q[0]-2,q[1]],[q[0],q[1]-2],[q[0]+1,q[1]]],k%2?'#99aa753a':'#5f78434a',.8);}
      if(r>.89){const q=iso(x+.3,y+.6);this.ellipse(q[0],q[1],3,1.4,'#728151');}
      if(r<.07){const q=iso(x+.6,y+.25);for(let j=0;j<3;j++)this.circle(q[0]+j*3-3,q[1]+(j%2)*2,.9,j%2?'#b9be86':'#e0d4a0');}
    }
    for(let i=0;i<480;i++){const p=iso(hash(i,754)*(n+halo*2)-halo,hash(i,721)*(n+halo*2)-halo);this.ellipse(p[0],p[1],20+hash(i,343)*50,8+hash(i,456)*22,i%2?'#bcc08c0b':'#506a3709');}
    // Sun-warmed tracks connect the center of the first settlement.
    const road=(points,width)=>{const path=points.map(p=>iso(...p));this.line(path,'#6f795232',width+9);this.line(path,'#acaa77',width+3);this.line(path,'#b7ad7c',width);this.line(path.map((p,i)=>[p[0]+Math.sin(i)*2,p[1]+2]),'#c2b78a50',width*.52);};
    road([[3,12],[6,12.3],[9,12.7],[12,13],[15,13.2],[18,14.2],[22,15.3],[27,18],[32,22],[35,29],[35,34]],13);
    road([[11,4],[11,7],[11.5,9],[12,13],[12.2,16],[13,19],[14,22]],12);
    road([[29,34],[32,34],[35,34],[39,34],[42,34]],11);road([[35,29],[35,34],[35,39]],10);
    // A narrow stream at the edge of the valley, with a softened pebble bank.
    const river=[[25,43],[27,40],[28,38],[29,36],[29,34],[28,31],[29,28],[31,26],[33,24],[37,23],[40,22],[44,20]].map(p=>iso(...p));
    this.line(river,'#77856a',47);this.line(river,'#b4b49a',37);this.line(river,'#587f7b',27);this.line(river,'#699b93',19);this.line(river.map((p,i)=>[p[0]+Math.sin(i)*3,p[1]-2]),'#97b6a36e',8);
    for(let i=0;i<80;i++){const j=i%(river.length-1),r=hash(i,77),a=river[j],b=river[j+1],x=a[0]+(b[0]-a[0])*r,y=a[1]+(b[1]-a[1])*r;this.line([[x-5,y],[x+3,y]],'#bfd1b256',1);}
    // Scattered pebbles add depth without obscuring playable ground.
    for(let i=0;i<260;i++){const x=hash(i,853)*n,y=hash(i,157)*n,p=iso(x,y);if(hash(i,88)>.65){this.ellipse(p[0]+1,p[1]+1,3,1.5,'#53694233');this.poly([[p[0]-2,p[1]],[p[0]-1,p[1]-2],[p[0]+2,p[1]-2],[p[0]+3,p[1]]],'#afb092');}}
    // Distant woodland continues beyond the playable valley.
    for(let i=0;i<100;i++){const x=i%2?-2-hash(i,55)*7:hash(i,42)*(n+12)-6,y=i%2?hash(i,42)*(n+12)-6:-2-hash(i,55)*7,p=iso(x,y);c.save();c.translate(p[0],p[1]);this.drawResource({type:'tree',x,y});c.restore();}
    this.ctx=old;
  }
  render(dt=1/60) {
    this.time+=Math.min(dt||1/60,.1);const c=this.ctx;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);c.fillStyle='#6e8455';c.fillRect(0,0,this.width,this.height);
    c.save();c.translate(this.width/2,this.height/2);c.scale(this.zoom,this.zoom);const cam=iso(this.camera.x,this.camera.y);c.translate(-cam[0],-cam[1]);
    c.drawImage(this.terrain,-this.terrainOrigin.x,-this.terrainOrigin.y);
    const selected=this.game.selectedIds||new Set();
    this.drawRemains();
    for(const b of this.game.buildings||[])if(selected.has(b.id)&&b.owner==='player'&&b.rally&&['towncenter','barracks','archery','stable','castle'].includes(b.type)){const p=iso(b.x,b.y),q=iso(b.rally.x,b.rally.y);c.save();c.setLineDash([3,5]);this.line([p,q],'#8ac2d04d',1);c.setLineDash([]);c.translate(q[0],q[1]);this.ellipse(0,0,7,3,null,'#b3d5c1',1);this.flag(0,0,26,PAL.blue,.65);c.restore();}
    const entities=[...(this.game.resources||[]).filter(r=>r.amount===undefined||r.amount>0),...(this.game.buildings||[]).filter(b=>b.hp>0||b.hp===undefined),...(this.game.units||[]).filter(u=>u.hp>0||u.hp===undefined)];
    entities.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
    for(const e of entities){const p=this.worldToScreen(e.x,e.y);if(p.x < -210||p.x>this.width+210||p.y < -120||p.y>this.height+260)continue;
      const q=iso(e.x,e.y);c.save();c.translate(q[0],q[1]);
      if(['tree','gold','stone','berries','berry','deer'].includes(e.type)){if(selected.has(e.id))this.ellipse(0,1,27,12,'#b5d49e15','#d1ddb699',1.2);this.drawResource(e);}
      else if(['towncenter','house','barracks','archery','stable','farm','tower','castle','lumbercamp','miningcamp','mill'].includes(e.type))this.drawBuilding(e,selected.has(e.id));
      else this.drawUnit(e,selected.has(e.id));
      c.restore();
    }
    this.drawPlacement();this.drawMarkers(dt);this.drawProjectiles();
    c.restore();
    const v=c.createRadialGradient(this.width*.5,this.height*.45,this.height*.24,this.width*.5,this.height*.5,this.width*.72);v.addColorStop(0,'#15271b00');v.addColorStop(1,'#182f182b');c.fillStyle=v;c.fillRect(0,0,this.width,this.height);
  }
  drawResource(e) {
    const c=this.ctx,r=hash(Math.floor(e.x*37),Math.floor(e.y*37));
    if(e.type==='tree'){
      const h=34+r*25;this.ellipse(12,4,22,8,'#263d3025');
      this.poly([[-3,3],[3,4],[3,-h*.65],[-2,-h*.68]],'#726244');this.line([[0,-7],[8,-21]],'#685b3d',2);
      if(r>.48){
        this.poly([[-23,-h*.22],[23,-h*.22],[0,-h-6]],'#304f39');
        this.poly([[-19,-h*.49],[19,-h*.49],[0,-h-12]],'#3d6042');
        this.poly([[-14,-h*.7],[14,-h*.7],[0,-h-18]],'#486c48');
        this.poly([[-14,-h*.7],[0,-h-18],[1,-h*.7]],'#587b4f');
        this.line([[-17,-h*.27],[-3,-h*.4]],'#63815158',2);
      }else{
        this.ellipse(0,-h*.69,24,19,'#38553a');this.ellipse(-13,-h*.65,17,15,'#47683f');this.ellipse(11,-h*.68,16,16,'#365c3d');
        this.ellipse(-3,-h*.94,19,16,'#547744');this.ellipse(-12,-h*.9,13,12,'#68894b');this.ellipse(10,-h*.96,13,13,'#537946');
        this.ellipse(-9,-h-4,9,7,'#79934c');this.ellipse(9,-h*.59,12,9,'#446943');
        for(let i=0;i<8;i++)this.ellipse(-15+hash(i,e.x*100)*30,-h*.68-hash(i,e.y*100)*h*.4,3.5,2,'#8e9e5444');
      }
    } else if(e.type==='gold'||e.type==='stone'){
      this.ellipse(4,4,25,9,'#49523c26');const gold=e.type==='gold';
      for(let i=0;i<5;i++){const x=-19+i*8,y=(i%2)*5,z=12+hash(i,e.x*10)*13;this.poly([[x-7,y],[x-8,y-z*.6],[x-2,y-z],[x+8,y-z*.7],[x+10,y-1],[x+2,y+3]],gold?'#928e70':'#92988d','#777e69',.6);this.poly([[x-8,y-z*.6],[x-2,y-z],[x+8,y-z*.7],[x,y-z*.35]],gold?'#b1a67e':'#c1c2af');if(gold){this.poly([[x-4,y-z*.66],[x+1,y-z*.82],[x+5,y-z*.61],[x+1,y-z*.35]],'#e1bc52');this.line([[x-1,y-z*.3],[x+2,y-3]],'#cda843',2);}}
    } else if(e.type==='deer'){
      this.ellipse(0,2,12,4,'#3d4d332c');this.ellipse(0,-10,10,5,'#9a7750');this.line([[-6,-8],[-7,1]],'#705037',2);this.line([[6,-8],[8,1]],'#705037',2);this.line([[7,-10],[11,-18]],'#9a7750',4);this.ellipse(13,-18,5,3,'#b49361');this.line([[12,-20],[11,-26],[8,-28]],'#67573d',1);
    } else {
      this.ellipse(0,2,22,7,'#40533225');for(let i=0;i<5;i++){let x=(i-2)*7,y=-7-(i%2)*7;this.ellipse(x,y,10,8,i%2?'#557544':'#64814b');for(let k=0;k<4;k++)this.circle(x-5+hash(k,i)*10,y-4+hash(k,i+7)*8,1.7,k%2?'#a6524c':'#bd6a53');}
    }
  }
  footprint(w,d,z=0) {return [iso(-w/2,-d/2,z),iso(w/2,-d/2,z),iso(w/2,d/2,z),iso(-w/2,d/2,z)];}
  prism(w,d,h,colors={},z=0) {
    const q=this.footprint(w,d,z),p=this.footprint(w,d,z+h);this.poly([q[1],q[2],p[2],p[1]],colors.right||PAL.creamDark,'#635c432f',.7);this.poly([q[2],q[3],p[3],p[2]],colors.left||PAL.cream,'#635c432f',.7);this.poly(p,colors.top||'#d4c7a1');return {q,p};
  }
  gable(w,d,wall,peak,palette={}) {
    const a=iso(-w/2,-d/2,wall),b=iso(w/2,-d/2,wall),cc=iso(w/2,d/2,wall),dd=iso(-w/2,d/2,wall),r1=iso(0,-d/2,peak),r2=iso(0,d/2,peak);
    this.poly([dd,cc,r2],palette.gable||'#ddcba0');this.poly([a,dd,r2,r1],palette.light||'#c18158','#684c352b',1);this.poly([r1,r2,cc,b],palette.dark||'#92513c','#694330',1);
    const levels=Math.ceil((peak-wall)/6);for(let i=1;i<levels;i++){let t=i/levels;this.line([[r1[0]+(b[0]-r1[0])*t,r1[1]+(b[1]-r1[1])*t],[r2[0]+(cc[0]-r2[0])*t,r2[1]+(cc[1]-r2[1])*t]],'#5d3e352f',1);this.line([[r1[0]+(a[0]-r1[0])*t,r1[1]+(a[1]-r1[1])*t],[r2[0]+(dd[0]-r2[0])*t,r2[1]+(dd[1]-r2[1])*t]],'#e0a57437',1);}
    this.line([r1,r2],palette.ridge||'#d39367',2.4);this.line([dd,r2,cc],'#69573f',2);this.line([iso(0,d/2,wall),r2],'#786548',2);
  }
  hipRoof(w,d,base,peak,colors={}) {const p=this.footprint(w,d,base),top=[0,-peak];this.poly([p[0],p[1],top],colors.back||'#4e6262');this.poly([p[1],p[2],top],colors.right||'#49545a');this.poly([p[2],p[3],top],colors.left||'#718080');this.poly([p[3],p[0],top],colors.back||'#607776');this.line([p[3],top,p[1]],'#c2c3a14a',1.2);}
  at(x,y,fn) {const p=iso(x,y),c=this.ctx;c.save();c.translate(p[0],p[1]);fn();c.restore();}
  flag(x,y,height,team,scale=1) {const c=this.ctx,p=iso(x,y),wave=Math.sin(this.time*3+x*2)*2;this.line([[p[0],p[1]],[p[0],p[1]-height]],'#665c45',1.5);this.circle(p[0],p[1]-height,2,'#d8c494');this.poly([[p[0]+1,p[1]-height+3],[p[0]+17*scale,p[1]-height+5+wave],[p[0]+13*scale,p[1]-height+10+wave],[p[0]+17*scale,p[1]-height+15+wave],[p[0]+1,p[1]-height+13]],team);this.line([[p[0]+5,p[1]-height+5],[p[0]+5,p[1]-height+12]],'#eee3b778',1);}
  window(u,v,z,w=5,h=8,side='left') {const p=iso(u,v,z),dx=side==='right'?-w:w,dy=w*.5;this.poly([[p[0],p[1]],[p[0]+dx,p[1]+dy],[p[0]+dx,p[1]+dy-h],[p[0],p[1]-h]],'#4b4d3c','#b8a782',1);this.line([[p[0]+dx*.5,p[1]+dy*.5],[p[0]+dx*.5,p[1]+dy*.5-h]],'#d1bd8c',1);}
  door(u,v,z=0,side='left',width=11,height=21) {const p=iso(u,v,z),dx=side==='right'?-width:width,dy=width*.5;this.poly([[p[0],p[1]],[p[0]+dx,p[1]+dy],[p[0]+dx,p[1]+dy-height],[p[0]+dx*.5,p[1]+dy*.5-height-3],[p[0],p[1]-height]],'#61563e','#9e8b65',2);for(let i=1;i<3;i++)this.line([[p[0]+dx*i/3,p[1]+dy*i/3-1],[p[0]+dx*i/3,p[1]+dy*i/3-height]],'#383e323d',1);this.circle(p[0]+dx*.7,p[1]+dy*.7-height*.45,1,'#cbbb84');}
  timber(w,d,h) {for(const v of [-d/2,d/2])this.line([iso(-w/2,v,4),iso(-w/2,v,h)],'#796b4d',2.8);for(const u of [-w/2,0,w/2])this.line([iso(u,d/2,3),iso(u,d/2,h)],'#746247',2.7);this.line([iso(-w/2,d/2,9),iso(w/2,d/2,9)],'#837050',2);this.line([iso(-w/2,d/2,h-4),iso(w/2,d/2,h-4)],'#867354',2);this.line([iso(w/2,-d/2,9),iso(w/2,d/2,9)],'#786548',2);}
  crates(x,y) {this.at(x,y,()=>{this.prism(.24,.24,9,{left:'#aa8352',right:'#846743',top:'#c29c63'});this.line([[-6,-9],[3,-5]],'#725c3d',1);this.line([[-5,-2],[-5,-9]],'#d2ac72',1);});}
  barrel(x,y) {this.at(x,y,()=>{const c=this.ctx;c.fillStyle='#926a41';c.beginPath();c.roundRect(-4,-10,8,11,3);c.fill();this.ellipse(0,-10,4,2,'#b3925f');this.line([[-4,-7],[4,-7]],'#625f49',1);this.line([[-4,-2],[4,-2]],'#625f49',1);});}
  drawBuilding(b,selected=false,ghost=false) {
    const c=this.ctx,team=b.owner==='enemy'?PAL.red:PAL.blue,s=sizeOf(b),built=b.built===undefined?1:b.built;
    this.ellipse(14,9,s*31,s*13,'#33452d24');
    if(selected&&!ghost){this.poly(this.footprint(s+.25,s+.25), '#66bde81a','#80c9eb',1.7);this.poly(this.footprint(s+.42,s+.42),null,'#d5e7bc55',.8);}
    c.save();if(built<1&&!ghost)c.globalAlpha=.35+built*.55;
    if(b.type==='farm')this.farm(b,team);
    else if(b.type==='towncenter')this.towncenter(b,team);
    else if(b.type==='castle')this.castle(b,team);
    else if(b.type==='tower')this.tower(b,team);
    else if(b.type==='house')this.house(b,team);
    else if(b.type==='stable')this.stable(b,team);
    else if(b.type==='archery')this.archery(b,team);
    else this.barracks(b,team);
    c.restore();
    if(built<1&&!ghost)this.scaffold(s,built);
    if(!ghost&&(selected||(b.hp!==undefined&&b.hp<b.maxHp))){const heights={towncenter:143,castle:151,tower:105,house:65,farm:25};this.healthbar(0,-(heights[b.type]||90),Math.max(44,s*18),b.hp/b.maxHp,team);if(built<1)this.healthbar(0,-(heights[b.type]||90)+7,Math.max(44,s*18),built,'#d1b570',3);}
    if(b.hp&&b.hp/b.maxHp<.4&&!ghost){for(let i=0;i<3;i++){const t=(this.time*.4+i*.33)%1;this.ellipse(8+Math.sin(this.time+i)*5,-45-t*45,4+t*9,7+t*6,`rgba(66,66,50,${.26*(1-t)})`);}this.poly([[-5,-25],[0,-43],[3,-31],[7,-40],[11,-23]],'#df994290');}
  }
  towncenter(b,team) {
    const c=this.ctx;this.prism(3.15,2.85,5,{left:'#afaa8d',right:'#8e957e',top:'#b9b49b'});
    this.at(-.65,-.05,()=>{this.prism(1.25,2.1,38);this.timber(1.25,2.1,38);this.gable(1.4,2.27,38,64);this.window(-.52,1.06,26,7,10);});
    this.at(.5,-.25,()=>{this.prism(1.62,1.93,54);this.timber(1.62,1.93,54);this.gable(1.84,2.16,54,84);this.window(.82,-.5,37,7,11,'right');this.window(.82,.34,37,7,11,'right');this.window(-.55,.97,38,7,11);this.window(.23,.97,38,7,11);this.door(-.12,.98,0,'left',15,26);});
    this.at(-.57,-.65,()=>{this.prism(.65,.65,86,{left:'#e4d8b7',right:'#b6ac89',top:'#d6c9a6'});this.prism(.74,.74,6,{left:'#b9ac85',right:'#94896b',top:'#d0c097'},83);this.window(.33,-.1,78,6,15,'right');this.window(-.2,.33,78,6,15);this.hipRoof(.95,.95,89,119,{left:'#6b7c7a',right:'#405c62'});this.flag(0,0,136,team,.9);});
    // A covered market porch and stepped entrance.
    this.at(.42,1.2,()=>{this.prism(1.72,.55,4,{left:'#b7af90',right:'#8f957d',top:'#c5b99a'});for(const u of [-.7,.7])this.line([iso(u,.14,0),iso(u,.14,29)],'#817055',3);this.poly([iso(-.9,-.3,37),iso(.9,-.3,37),iso(.9,.43,25),iso(-.9,.43,25)],'#9a6545','#805537',1);for(let u=-.8;u<.8;u+=.25)this.line([iso(u,-.3,37),iso(u,.43,25)],'#c48a5655',1);});
    this.at(1.15,.5,()=>{this.flag(0,0,61,team,.85);});this.crates(-1.36,.65);this.crates(-1.52,.35);this.barrel(1.38,-.25);
    this.at(-.4,1.58,()=>{this.ellipse(0,-2,7,3,'#8d7650');this.ellipse(0,-5,5,5,'#789051');this.circle(-2,-8,2,'#bfa664');});
  }
  house(b,team) {
    this.prism(1.42,1.36,3,{left:'#a5a186',right:'#858e77',top:'#bab29a'});this.prism(1.25,1.18,29);this.timber(1.25,1.18,29);this.gable(1.5,1.44,29,53,{dark:'#796348',light:'#ac8b5c',ridge:'#c1a473'});
    this.door(-.13,.6,0,'left',9,18);this.window(-.51,.6,22,5,7);this.window(.63,-.33,21,5,8,'right');
    this.at(.27,-.3,()=>{this.prism(.19,.2,20,{left:'#aa9a77',right:'#817759',top:'#c1b18d'},35);this.prism(.24,.24,3,{left:'#b3a47c',right:'#8f825e',top:'#766c54'},54);});
    this.at(-.67,.28,()=>{this.prism(.09,.3,10,{left:team,right:team,top:'#76a8c8'},19);});this.barrel(.75,.21);
    const t=(this.time*.22+hash(b.x,b.y))%1;this.ellipse(22+t*8,-64-t*20,3+t*5,5+t*6,`rgba(223,217,185,${.17*(1-t)})`);
  }
  barracks(b,team) {
    this.prism(2.55,2.15,4,{left:'#a8a58c',right:'#8f947e',top:'#bab59a'});this.prism(2.15,1.7,36);this.timber(2.15,1.7,36);this.gable(2.38,1.94,36,66,{dark:'#8f5840',light:'#b98151'});
    this.door(-.25,.86,0,'left',19,27);this.window(-.86,.86,27,6,9);this.window(1.08,-.43,25,7,10,'right');this.window(1.08,.4,25,7,10,'right');
    this.flag(-.75,-.65,83,team);this.at(.63,.87,()=>{this.poly([[-6,-31],[6,-25],[6,-12],[0,-9],[-6,-16]],team,'#d4c393',1);this.line([[-2,-26],[3,-15]],'#eee6c0',1.5);this.line([[3,-23],[-2,-18]],'#eee6c0',1.5);});
    this.at(-1.13,1.07,()=>{this.line([[0,0],[0,-20]],'#77583b',3);this.line([[-9,-13],[9,-13]],'#77583b',2);this.circle(0,-23,4,'#bda37b');this.ellipse(0,-12,5,8,'#9e8157');});this.crates(1.25,-.2);this.barrel(1.23,.2);
  }
  archery(b,team) {
    this.prism(2.45,2.05,3,{left:'#a4a58b',right:'#89927b',top:'#ada98d'});this.at(-.3,-.23,()=>{this.prism(1.7,1.2,32);this.timber(1.7,1.2,32);this.gable(1.93,1.47,32,59,{dark:'#646d53',light:'#8d9567',ridge:'#b2ad74'});this.door(-.23,.6,0,'left',12,22);this.window(.85,0,23,6,10,'right');});
    for(let i=0;i<2;i++)this.at(.4-i*.75,.91,()=>{this.line([[-5,2],[0,-20],[7,4]],'#856e48',2);this.ellipse(0,-15,10,13,'#c8b688','#786c4d',1);this.ellipse(0,-15,6.7,8.5,'#9e6552');this.ellipse(0,-15,3.5,4.5,'#ddd0a3');this.ellipse(0,-15,1.8,2.5,team);this.line([[-2,-14],[11,-20]],'#635e41',1);});this.flag(-.9,-.68,72,team);this.crates(1,.15);
  }
  stable(b,team) {
    this.prism(2.5,2.2,4,{left:'#a9a187',right:'#878d75',top:'#bab097'});this.at(-.25,-.3,()=>{this.prism(1.95,1.55,35,{left:'#c5b78f',right:'#978866',top:'#dbc99e'});this.timber(1.95,1.55,35);this.gable(2.18,1.8,35,64);this.door(-.4,.79,0,'left',26,25);this.window(.98,-.35,24,7,10,'right');});
    for(let i=0;i<5;i++)this.at(-1.05+i*.48,1.03,()=>this.line([[0,3],[0,-13]],'#a18a58',3));this.line([iso(-1.05,1.03,7),iso(.9,1.03,7)],'#b09a63',2);this.line([iso(-1.05,1.03,0),iso(.9,1.03,0)],'#8a744b',2);this.at(.6,.66,()=>this.horse('#a58052',team,false));this.flag(-.9,-.75,79,team);this.barrel(1.14,-.4);
  }
  tower(b,team) {this.prism(1.1,1.1,6,{left:'#939982',right:'#747e6e',top:'#b2b49a'});this.prism(.83,.83,66,{left:'#bfbea3',right:'#959c86',top:'#ced0b4'});this.stonework(.83,.83,65);this.prism(1.04,1.04,7,{left:'#d1c9aa',right:'#a4aa91',top:'#767f6d'},64);this.battlements(1.04,1.04,71);this.window(.42,0,52,4,12,'right');this.window(-.25,.42,36,4,13);this.door(-.15,.42,0,'left',9,20);this.flag(-.18,-.15,100,team);this.at(.05,.43,()=>this.poly([[-3,-54],[6,-50],[6,-34],[1,-30],[-3,-34]],team));}
  stonework(w,d,h) {for(let z=10;z<h;z+=10){this.line([iso(-w/2,d/2,z),iso(w/2,d/2,z),iso(w/2,-d/2,z)],'#6f796b38',.8);for(let u=-w/2+(z%20?0:.2);u<w/2;u+=.4)this.line([iso(u,d/2,z),iso(u,d/2,z+9)],'#7c826e26',.8);}}
  battlements(w,d,z) {for(let u=-w/2;u<=w/2+.01;u+=.35){this.at(u,-d/2,()=>this.prism(.17,.2,8,{left:'#c9c8ad',right:'#a2a990',top:'#e0dabe'},z));this.at(u,d/2,()=>this.prism(.17,.2,8,{left:'#c9c8ad',right:'#a2a990',top:'#e0dabe'},z));}for(let v=-d/2+.3;v<d/2;v+=.35){this.at(-w/2,v,()=>this.prism(.2,.17,8,{left:'#c9c8ad',right:'#a2a990',top:'#e0dabe'},z));this.at(w/2,v,()=>this.prism(.2,.17,8,{left:'#c9c8ad',right:'#a2a990',top:'#e0dabe'},z));}}
  castle(b,team) {
    this.prism(3.4,3.2,7,{left:'#969e89',right:'#788373',top:'#aeb298'});
    this.at(-.85,-.85,()=>{this.prism(.78,.78,85,{left:'#c4c3a8',right:'#9ba28b',top:'#787f6c'});this.stonework(.78,.78,84);this.battlements(.85,.85,85);this.flag(0,0,116,team);});
    this.at(.22,-.24,()=>{this.prism(1.55,1.62,76,{left:'#c9c5a8',right:'#999d83',top:'#d4ceb0'});this.stonework(1.55,1.62,75);this.gable(1.82,1.89,76,112,{light:'#688080',dark:'#425e68',ridge:'#91a3a0'});this.window(-.55,.82,65,7,16);this.window(.33,.82,65,7,16);this.window(.78,.05,62,7,18,'right');});
    this.prism(2.76,2.65,37,{left:'#c0bfa1',right:'#9ca388',top:'#c6c5a7'});this.stonework(2.76,2.65,36);this.battlements(2.76,2.65,37);
    this.door(-.2,1.34,0,'left',24,29);this.line([iso(-.1,1.35,0),iso(-.1,1.35,24)],'#aaa58a',1);this.line([iso(.05,1.35,0),iso(.05,1.35,25)],'#aaa58a',1);this.line([iso(.19,1.35,0),iso(.19,1.35,26)],'#aaa58a',1);
    for(const p of [[1.25,-1.15],[-1.2,1.14],[1.25,1.14]])this.at(...p,()=>{this.prism(.7,.7,69,{left:'#c8c6aa',right:'#9aa28a',top:'#7e8974'});this.stonework(.7,.7,68);this.prism(.85,.85,6,{left:'#d0cbae',right:'#aab095',top:'#929c82'},67);this.battlements(.85,.85,73);this.window(.35,0,55,4,12,'right');this.window(-.18,.35,51,4,12);});
    this.flag(1.25,1.14,103,team);this.flag(.3,-.25,137,team,1.2);
    this.at(-.8,1.33,()=>this.poly([[-4,-29],[7,-23],[7,-5],[1,-1],[-4,-8]],team));
  }
  farm(b,team) {
    const w=sizeOf(b)*.93;this.poly(this.footprint(w,w),'#8b8155','#a49a69',2);
    for(let x=-w/2+.15;x<w/2;x+=.25){this.line([iso(x,-w/2+.1),iso(x,w/2-.1)],'#6b6745',4);for(let y=-w/2+.12;y<w/2-.1;y+=.2){const p=iso(x,y),r=hash(Math.round(x*100)+b.x,Math.round(y*100)+b.y),z=4+r*6;this.line([[p[0],p[1]],[p[0]-2,p[1]-z]],'#b7b274',1.3);this.line([[p[0]-2,p[1]-z+1],[p[0]-4,p[1]-z-2]],'#d6c287',2);this.line([[p[0],p[1]-3],[p[0]+2,p[1]-6]],'#a7af64',1);}}
    for(const x of [-w/2,w/2])for(const y of [-w/2,w/2]){const p=iso(x,y);this.line([[p[0],p[1]],[p[0],p[1]-9]],'#968659',2.5);}this.line([iso(-w/2,w/2,5),iso(w/2,w/2,5)],'#baa174',1.4);
    this.at(w/2-.2,-w/2+.1,()=>{this.ellipse(0,-4,7,5,'#b69e61');this.ellipse(0,-7,6,3,'#d2bb78');this.line([[-4,-9],[4,-5]],'#a89460',1);});
  }
  scaffold(size,built) {const c=this.ctx,s=size*.55;for(const p of [[-s,s],[s,s],[s,-s]]){const q=iso(...p);this.line([[q[0],q[1]],[q[0],q[1]-65]],'#8a7049',2.2);}this.line([iso(-s,s,25),iso(s,s,25),iso(s,-s,25)],'#b7a075',3);this.line([iso(-s,s,49),iso(s,s,49),iso(s,-s,49)],'#b7a075',2.5);this.line([iso(-s,s,0),iso(s,s,49)],'#927c54',1.5);this.line([iso(s,s,0),iso(s,-s,49)],'#927c54',1.5);this.crates(-s-.1,s-.2);}
  healthbar(x,y,w,value,color,height=4) {if(!Number.isFinite(value))return;const c=this.ctx;c.fillStyle='#233128b8';c.beginPath();c.roundRect(x-w/2-1,y-1,w+2,height+2,2);c.fill();c.fillStyle=color;c.fillRect(x-w/2,y,Math.max(0,Math.min(1,value))*w,height);c.fillStyle='#ffffff22';c.fillRect(x-w/2,y,Math.max(0,Math.min(1,value))*w,1);}
  horse(color,team,rider=true) {const c=this.ctx;this.ellipse(2,2,17,6,'#35452f2b');const step=Math.sin(this.time*9)*2;this.line([[-8,-9],[-10,3+step]],'#5c4d38',2.2);this.line([[4,-8],[8,3-step]],'#5c4d38',2.2);this.line([[-4,-9],[-3,3-step]],'#786049',2);this.line([[9,-9],[12,2+step]],'#786049',2);this.ellipse(0,-11,13,7,color);this.line([[9,-12],[12,-23]],color,7);this.ellipse(14,-24,6,4,color);this.line([[12,-27],[11,-31]],'#6c543d',2);this.line([[17,-25],[18,-21]],'#d0b78a',1);this.line([[-11,-14],[-18,-9],[-18,-3]],'#534a38',2);this.line([[8,-15],[8,-23],[11,-26]],'#574c38',2);this.ellipse(-2,-14,8,4,team);if(rider){this.line([[-2,-17],[-3,-6]],'#4b5648',3);this.line([[-1,-17],[3,-26]],team,8);this.circle(3,-32,4.5,'#dbc29c');this.ellipse(3,-35,5,3,'#b5c6bc');this.line([[7,-26],[18,-19]],'#d3bb93',2);this.line([[17,-12],[19,-47]],'#89774d',2);this.poly([[19,-52],[16,-44],[22,-44]],'#d1d5bb');this.ellipse(-2,-21,5,7,team,'#d7c99e',1);}}
  drawUnit(u,selected=false) {
    const c=this.ctx,team=u.owner==='enemy'?PAL.red:PAL.blue,working=u.action&&u.action!=='idle',phase=(u.variation||0)*6;
    if(selected){this.ellipse(0,1,u.type==='knight'?20:12,u.type==='knight'?9:5,'#6bbed21c','#a5d5d3',1.3);this.ellipse(0,1,u.type==='knight'?23:15,u.type==='knight'?10:6,null,'#d9e6b652',.65);}
    if(u.type==='knight'){this.horse('#8b7255',team,true);if(selected||u.hp<u.maxHp)this.healthbar(0,-58,26,u.hp/u.maxHp,team,3);return;}
    if(u.type==='ram'){this.ellipse(5,5,30,12,'#3f49322e');this.prism(1.2,.65,20,{left:'#a08a59',right:'#796943',top:'#a89a6c'});this.gable(1.45,.85,20,34,{dark:team,light:'#74959a',ridge:'#b4b299'});for(const x of [-19,10]){this.ellipse(x,3,5,8,'#554e38','#ba9d62',1.5);this.circle(x,3,1.5,'#c4b485');}this.line([[3,-4],[36,-12]],'#75573a',7);this.ellipse(36,-12,4,5,'#a6aa96');if(selected||u.hp<u.maxHp)this.healthbar(0,-50,35,u.hp/u.maxHp,team,3);return;}
    this.ellipse(2,2,8,3.5,'#3c4b332e');const bob=working?Math.sin(this.time*9+phase)*.6:Math.sin(this.time*2+phase)*.2;c.save();c.translate(0,bob);const leg=working?Math.sin(this.time*9+phase)*2:0;
    this.line([[-3,-7],[-3-leg,0]],'#514f3a',2.7);this.line([[2,-7],[3+leg,0]],'#59533c',2.7);
    this.poly([[-4,-17],[3,-18],[5,-6],[-5,-6]],u.type==='villager'?'#c8bc91':team,'#4f584333',.7);
    if(u.type==='villager'){this.poly([[-4,-16],[0,-14],[1,-7],[-4,-7]],team);this.line([[3,-16],[7,-10]],'#d5be91',2.4);this.line([[-4,-15],[-7,-8]],'#c5ab7e',2.3);this.line([[6,-5],[12,-22]],'#7f6845',1.5);this.line([[8,-22],[15,-19]],'#adb69d',2.6);if(working&&['gather','gathering','wood','chop','mining'].some(s=>u.action.includes(s)))this.poly([[-8,-9],[-13,-12],[-11,-18],[-5,-15]],'#ad8a56');}
    else if(u.type==='archer'){this.line([[-3,-16],[-9,-12]],'#d2b78e',2.5);c.beginPath();c.arc(5,-16,11,-1.35,1.3);c.strokeStyle='#bda876';c.lineWidth=1.7;c.stroke();this.line([[7,-27],[8,-5]],'#d3c79b',.6);this.line([[1,-16],[17,-16]],'#655c3d',1);this.poly([[17,-16],[13,-18],[13,-14]],'#bfc6ac');this.line([[-6,-9],[-10,-26]],'#8c754d',3);}
    else {this.line([[4,-16],[9,-13]],'#c8b692',2.3);const swing=u.action==='attack'||u.action==='attacking'?Math.sin(this.time*12)*5:0;this.line([[9,-13],[14+swing,-29]],'#c6cdc0',2.5);this.line([[9,-17],[15,-15]],'#b7aa79',1.5);this.poly([[-8,-16],[-2,-17],[-1,-9],[-5,-5],[-9,-10]],team,'#cfbd8e',1);this.line([[-6,-15],[-4,-8]],'#d5c698',.8);}
    this.circle(0,-22,4,'#d2b68b');this.ellipse(-1,-24,4.5,2.5,u.type==='villager'?'#9c8057':u.type==='archer'?team:'#aebfb7');if(u.type==='militia'){this.poly([[-4,-24],[3,-25],[4,-19],[1,-19],[1,-23],[-4,-22]],'#98aaa4');this.line([[-3,-26],[2,-27]],team,2);}else if(u.type==='archer'){this.poly([[-5,-23],[-2,-29],[3,-26],[5,-23]],team);}
    c.restore();if(selected||u.hp<u.maxHp)this.healthbar(0,-34,21,u.hp/u.maxHp,team,3);
  }
  drawPlacement() {const p=this.placement;if(!p)return;const c=this.ctx,xy=iso(p.x,p.y),s=p.size||sizeOf(p),col=p.valid?'#b5e1a7':'#e88d72';c.save();c.translate(xy[0],xy[1]);this.poly(this.footprint(s,s),p.valid?'#b0da7850':'#cf725248',col,1.7);c.globalAlpha=.6;this.drawBuilding({...p,owner:'player',built:1},false,true);c.restore();}
  drawMarkers(dt) {this.moveMarkers=this.moveMarkers.filter(m=>{if(m.life===undefined)m.life=1;m.life-=Math.min(dt||1/60,.1);if(m.life<=0)return false;const p=iso(m.x,m.y),r=12+(1-m.life)*12;this.ellipse(p[0],p[1],r,r*.5,null,`rgba(237,227,168,${m.life})`,1.7);this.line([[p[0]-5,p[1]],[p[0],p[1]+3],[p[0]+5,p[1]]],`rgba(237,227,168,${m.life})`,1.4);return true;});}
  drawRemains() {
    for(const e of this.game.effects||[]){if(!['ruin','death'].includes(e.type))continue;const c=this.ctx,p=iso(e.x,e.y);c.save();c.translate(p[0],p[1]);c.globalAlpha=Math.min(1,e.life/3);if(e.type==='ruin'){const s=e.size||2;this.ellipse(0,0,s*26,s*12,'#666b4a55');for(let i=0;i<14;i++){const x=(hash(i,e.x)-.5)*s*42,y=(hash(i,e.y+17)-.5)*s*18;this.poly([[x-5,y],[x-3,y-7],[x+6,y-6],[x+8,y+2]],i%2?'#a6a188':'#858a70');}this.line([[-22,-4],[15,5]],'#73603e',4);}else{this.ellipse(0,1,9,4,'#53604450');this.line([[-6,-1],[4,1]],e.owner==='enemy'?PAL.red:PAL.blue,4);this.circle(6,0,2.5,'#bda77f');}c.restore();}
  }
  drawProjectiles() {
    for(const p of this.game.projectiles||[]){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const t=p.progress||0,q=iso(p.x,p.y,15+Math.sin(t*Math.PI)*32),a=iso(p.toX||p.x,p.toY||p.y),b=iso(p.fromX||p.x,p.fromY||p.y),angle=Math.atan2(a[1]-b[1],a[0]-b[0]),dx=Math.cos(angle)*8,dy=Math.sin(angle)*8;this.line([[q[0]-dx,q[1]-dy],[q[0]+dx*.25,q[1]+dy*.25]],'#e4d4a6',1.2);}
    for(const e of this.game.effects||[]){const p=iso(e.x,e.y,12),t=1-e.life/e.maxLife;if(e.type==='hit'){for(let i=0;i<4;i++){const a=i*Math.PI*.5+.4;this.line([[p[0]+Math.cos(a)*(3+t*5),p[1]+Math.sin(a)*(3+t*5)],[p[0]+Math.cos(a)*(7+t*8),p[1]+Math.sin(a)*(7+t*8)]],`rgba(239,217,157,${1-t})`,1.6);}}else if(e.type==='complete'){this.ellipse(p[0],p[1]+12,30+t*35,15+t*17,null,`rgba(210,226,169,${(1-t)*.6})`,2);}}
  }
}
