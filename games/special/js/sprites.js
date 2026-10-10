'use strict';
// ===== Procedural sprite drawing: units, animals, ships, siege =====
const _shadeCache={};
function shade(hex,amt){
  const key=hex+amt;if(_shadeCache[key])return _shadeCache[key];
  let r,g,b;
  if(hex[0]==='r'){const m=hex.match(/[\d.]+/g);r=+m[0];g=+m[1];b=+m[2]}
  else{let h=hex.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  r=parseInt(h.substr(0,2),16);g=parseInt(h.substr(2,2),16);b=parseInt(h.substr(4,2),16)}
  if(amt>=0){r+=(255-r)*amt;g+=(255-g)*amt;b+=(255-b)*amt}else{r*=1+amt;g*=1+amt;b*=1+amt}
  return _shadeCache[key]='rgb('+(r|0)+','+(g|0)+','+(b|0)+')';
}
function ell(c,x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,rx,ry,0,0,6.2832);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke()}}
function ln(c,x1,y1,x2,y2,w,col,cap){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineWidth=w;c.strokeStyle=col;c.lineCap=cap||'round';c.stroke()}
function poly(c,pts,fill,stroke,lw){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.lineWidth=lw||1;c.strokeStyle=stroke;c.stroke()}}
function rect(c,x,y,w,h,fill,stroke){if(fill){c.fillStyle=fill;c.fillRect(x,y,w,h)}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x,y,w,h)}}
const SKIN=['#e8b890','#d9a578','#c68e62','#f0c8a0'];
const TAU=Math.PI*2;
// ---------- tools ----------
function drawTool(c,type,x,y,a,col){
  // a = angle in radians of the handle direction (0 = +x)
  c.save();c.translate(x,y);c.rotate(a);
  switch(type){
    case'axe':ln(c,0,0,11,0,1.8,'#7a5230');poly(c,[[8,-1],[13,-5],[14,2],[9,1]],'#b8bcc4','#555');break;
    case'pick':ln(c,0,0,11,0,1.8,'#7a5230');c.beginPath();c.moveTo(7,-4);c.quadraticCurveTo(11,-6,15,-1);c.lineWidth=2;c.strokeStyle='#a0a6b0';c.stroke();c.beginPath();c.moveTo(7,4);c.quadraticCurveTo(11,5,14,1);c.stroke();break;
    case'hammer':ln(c,0,0,8,0,1.8,'#7a5230');rect(c,6,-3.5,5,7,'#8a8e96','#444');break;
    case'hoe':ln(c,0,0,13,0,1.6,'#7a5230');poly(c,[[11,-1],[16,-1],[17,5],[12,4]],'#8a8e96','#444');break;
    case'sword':ln(c,0,0,3,0,2,'#6a4a2a');ln(c,3,-3,3,3,1.6,'#c0a040');ln(c,3,0,15,0,2,'#dfe3ea');ln(c,3,0,15,0,0.7,'#fff');break;
    case'sword2':ln(c,0,0,4,0,2,'#6a4a2a');ln(c,4,-3.5,4,3.5,1.8,'#c0a040');ln(c,4,0,20,0,2.6,'#e4e8ee');ln(c,4,0,20,0,0.8,'#fff');break;
    case'katana':ln(c,0,0,4,0,2,'#222');ln(c,4,-2.5,4,2.5,1.6,'#c8a040');c.beginPath();c.moveTo(4,0);c.quadraticCurveTo(14,-1,20,-4);c.lineWidth=1.8;c.strokeStyle='#e8ecf2';c.stroke();break;
    case'spear':ln(c,-6,0,18,0,1.6,'#8a6a40');poly(c,[[18,0],[14,-2.5],[14,2.5]],'#d0d4da','#555');break;
    case'pike':ln(c,-10,0,26,0,1.6,'#8a6a40');poly(c,[[26,0],[22,-2.2],[22,2.2]],'#d0d4da','#555');break;
    case'halberd':ln(c,-6,0,20,0,1.6,'#8a6a40');poly(c,[[20,0],[16,-2],[16,2]],'#d0d4da','#555');poly(c,[[14,0],[18,-6],[19,-2]],'#c0c4cc','#555');break;
    case'jav':ln(c,-4,0,15,0,1.2,'#8a6a40');poly(c,[[15,0],[12,-1.5],[12,1.5]],'#c0c4cc');break;
    case'axe2':ln(c,0,0,9,0,1.6,'#6a4a2a');poly(c,[[6,-1],[11,-6],[13,1],[8,1]],'#b0b4bc','#444');break;
    case'staff':ln(c,-4,0,20,0,1.8,'#8a6a40');ell(c,21,0,2.2,2.2,'#e8d080','#a08030');break;
    case'knife':ln(c,0,0,3,0,1.8,'#6a4a2a');ln(c,3,0,8,0,1.6,'#d0d4da');break;
    case'lance':ln(c,-8,0,24,0,1.7,'#8a6a40');poly(c,[[24,0],[19,-2],[19,2]],'#d0d4da','#555');poly(c,[[16,-1],[10,-2],[10,3],[16,2]],col||'#c33');break;
    case'rod':ln(c,-2,0,16,-4,1.2,'#8a6a40');break;
  }
  c.restore();
}
function drawBowArc(c,x,y,r,draw,col){ // bow facing +x
  c.save();c.translate(x,y);
  c.beginPath();c.arc(-r*0.3,0,r,-1.0,1.0);c.lineWidth=2;c.strokeStyle=col||'#7a5230';c.stroke();
  const tx=-r*0.3+Math.cos(1.0)*r,by=Math.sin(1.0)*r;
  c.beginPath();c.moveTo(tx,-by);c.lineTo(tx-draw*7,0);c.lineTo(tx,by);c.lineWidth=0.8;c.strokeStyle='#ddd';c.stroke();
  c.restore();
}
// ---------- human ----------
// o: col, skin, hat, tool, pose('idle','walk','work','attack'), ph, at(0..1 swing), shield, kind, carry, scale
function drawHuman(c,o){
  const s=o.scale||1,ph=o.ph||0;
  c.save();c.scale(s,s);
  const moving=o.pose==='walk';
  const bob=moving?Math.abs(Math.sin(ph))*1.6:0;
  const lean=(o.work==='farm'||o.work==='berries'||o.work==='hunt'?0.35:0)+(o.work==='mine'?0.12:0)+(o.work==='chop'?0.08:0);
  const lg=moving?Math.sin(ph)*4.5:0;
  const col=o.col,dark=shade(col,-0.3);
  // legs
  const legc=o.legc||'#5a4a3a';
  if(!o.sit){ln(c,-1.5,-9-0,-1.5+lg,0,3,legc);ln(c,1.5,-9,1.5-lg,0,3,legc);
  ell(c,-1.5+lg,0,2.2,1.2,'#3a2a1a');ell(c,1.5-lg,0,2.2,1.2,'#3a2a1a')}else{ln(c,-1,-9,5,-6,3,legc);ln(c,1,-9,7,-5,3,legc)}
  c.save();c.translate(0,-bob);
  c.translate(0,-9);c.rotate(lean);c.translate(0,9);
  // back items: carry, quiver
  if(o.carry&&o.carry.n>0.5)drawCarry(c,o.carry);
  if(o.quiver){ln(c,-4,-22,-6,-14,3,'#6a4a2a');for(let i=0;i<3;i++)ln(c,-4.5+i*.6,-22,-4+i,-25,0.8,'#ccc')}
  if(o.cape)poly(c,[[-3,-23],[3,-23],[5,-8],[-5,-8]],o.cape,shade(o.cape,-.3));
  // torso
  const tw=o.fat?5.5:4.2;
  c.beginPath();c.moveTo(-tw,-10);c.lineTo(-tw+0.6,-23);c.quadraticCurveTo(0,-25,tw-0.6,-23);c.lineTo(tw,-10);c.closePath();c.fillStyle=col;c.fill();c.strokeStyle=dark;c.lineWidth=0.8;c.stroke();
  if(o.armor){c.fillStyle=o.armor;c.fillRect(-tw+0.5,-21,tw*2-1,6);ln(c,-tw,-14,tw,-14,1,'#444')}
  if(o.robe){c.beginPath();c.moveTo(-tw,-10);c.lineTo(-tw-1.5,-1);c.lineTo(tw+1.5,-1);c.lineTo(tw,-10);c.fillStyle=o.robe;c.fill();ln(c,0,-23,0,-1,0.7,shade(o.robe,-.3))}
  ln(c,-tw,-12,tw,-12,1.3,'#4a3420'); // belt
  // head
  const hy=-27.5;
  ell(c,0,hy,3.8,4,o.skin||SKIN[0],'#8a5a3a');
  if(o.front){c.fillStyle='#222';c.fillRect(-1.8,hy-0.5,1,1);c.fillRect(1,hy-0.5,1,1)}
  drawHat(c,o.hat,hy,col,o);
  // arms & tool
  const sh=[0,-21];
  const t=(o.at!==undefined)?o.at:0;
  let a=0.3,a2=0.5; // arm angle (rad, 0 = forward/right, negative up)
  let toolA=null;
  const W=o.pose==='work'||o.pose==='attack';
  const ph2=ph*(o.pose==='attack'?1:1);
  const sw=(k)=>{ // swing curve 0..1 -> raise slowly, strike fast
    const x=((k%1)+1)%1;return x<0.62?-(x/0.62):-1+(x-0.62)/0.38*1.0*1.0>0?0:(-1+(x-0.62)/0.38*(1+0.0))};
  if(o.pose==='walk'){a=0.9+Math.sin(ph)*0.5;a2=0.9-Math.sin(ph)*0.5;if(o.tool){a=0.2;toolA=a}}
  else if(W){
    const tool=o.tool;
    const k=(o.workPh||0);
    const x=((k%1)+1)%1;
    if(tool==='axe'||tool==='pick'||tool==='sword'||tool==='sword2'||tool==='katana'||tool==='axe2'){
      // overhead swing: raise -2.0 → strike +0.5
      const raise=tool==='pick'?-1.9:-2.1;a=x<0.6?raise*(x/0.6)+0.4*(1-x/0.6):raise+(0.5-raise)*((x-0.6)/0.4);a2=a-0.1;toolA=a;
      if(o.workKind==='attack'){a=x<0.5?-0.2-1.6*(x/0.5):-1.8+(2.3)*((x-0.5)/0.5);toolA=a;a2=a}
    }else if(tool==='hammer'){a=-0.9+Math.sin(x*TAU*1)*0.9;a2=a;toolA=a}
    else if(tool==='hoe'){a=-0.6+(x<0.5?x*1.6:(1-x)*1.6)*1.6;a2=a;toolA=a+0.4}
    else if(tool==='spear'||tool==='pike'||tool==='halberd'||tool==='knife'){const th=x<0.4?-3*x/0.4:(x-0.4)/0.6*3-3;a=0.05;a2=0.1;toolA=0.0;o._thrust=th>-3?(x<0.35?-x*10:(x<0.55?-3.5+(x-0.35)*30:0)):0;o._thrust=x<0.5?-x*6:(x-0.5)*6-3}
    else if(tool==='jav'){a=x<0.5?-2.0:(-2.0+(x-0.5)*7);toolA=a}
    else if(tool==='staff'){a=-1.2+Math.sin(x*TAU)*0.3;a2=-1.2;toolA=a}
    else if(tool==='bow'||tool==='xbow'){a=0;a2=0;toolA=0}
    else {a=-0.8+Math.sin(x*TAU)*0.6;a2=a;toolA=a}
  }else{a=0.9;a2=0.9;if(o.tool&&o.tool!=='bow'&&o.tool!=='xbow'){toolA=0.5}}
  // back arm (left)
  const ax1=sh[0]+Math.cos(a2)*6*1,ay1=sh[1]+Math.sin(a2)*6+ (a2>0.7?3:0);
  ln(c,sh[0]-2,sh[1],ax1-2,ay1,2.6,col==='#fff'?'#ccc':dark);
  ell(c,ax1-2,ay1,1.6,1.6,o.skin||SKIN[0]);
  if(o.shield){const sx=ax1-2,sy=ay1;ell(c,sx+1,sy,5.2,6,o.shieldCol||col,'#222');ell(c,sx+1,sy,1.6,1.6,'#d8d8d8');ln(c,sx+1,sy-5,sx+1,sy+5,0.8,shade(o.shieldCol||col,.4))}
  // front arm
  let thrust=o._thrust||0;
  const ax=sh[0]+Math.cos(a)*6+(o.tool==='spear'||o.tool==='pike'||o.tool==='halberd'?thrust:0),ay=sh[1]+Math.sin(a)*6+(a>0.7?3:0);
  if(o.tool==='bow'||o.tool==='xbow'){
    const draw=o.pose==='attack'?Math.min(1,((o.workPh||0)%1)*1.8):0;
    ln(c,2,sh[1],8,sh[1]+1,2.6,col);ell(c,8,sh[1]+1,1.6,1.6,SKIN[0]);
    if(o.tool==='bow')drawBowArc(c,9,sh[1]+1,9,draw,o.bowCol);
    else{poly(c,[[2,-20],[14,-21],[14,-19],[2,-18]],'#7a5230','#3a2a1a');ln(c,14,-20.5,14,-24,1,'#aaa');ln(c,14,-20.5,14,-17,1,'#aaa')}
    if(o.pose==='attack'&&draw>0.2&&draw<1)ln(c,8-draw*7,sh[1]+1,18,sh[1]+1,0.9,'#d8d0b8');
    else if(o.pose==='attack'&&draw>=1)ln(c,8,sh[1]+1,18,sh[1]+1,0.9,'#d8d0b8');
  }else{
    ln(c,sh[0]+2,sh[1],ax+2,ay,2.6,col);
    ell(c,ax+2,ay,1.7,1.7,o.skin||SKIN[0]);
    if(o.tool&&toolA!==null)drawTool(c,o.tool,ax+2,ay,toolA,col);
  }
  c.restore();
  c.restore();
}
function drawHat(c,hat,hy,col,o){
  switch(hat){
    case'straw':poly(c,[[-6,hy-1.5],[6,hy-1.5],[3,hy-6],[-3,hy-6]],'#d8b860','#8a6a30');ell(c,0,hy-1.5,6.5,1.6,'#e0c470','#8a6a30');break;
    case'cap':c.beginPath();c.arc(0,hy-1.5,4,Math.PI,TAU);c.fillStyle='#6a4a2a';c.fill();break;
    case'hood':c.beginPath();c.arc(0,hy-0.5,4.6,Math.PI*0.95,TAU*1.02);c.lineTo(3,hy+3);c.lineTo(-3,hy+3);c.fillStyle=o.hoodCol||'#3a5a3a';c.fill();break;
    case'kettle':ell(c,0,hy-2.5,5.6,1.6,'#9aa0a8','#444');c.beginPath();c.arc(0,hy-2.5,3.6,Math.PI,TAU);c.fillStyle='#b0b6be';c.fill();c.strokeStyle='#444';c.lineWidth=.7;c.stroke();break;
    case'nasal':c.beginPath();c.arc(0,hy-1,4.3,Math.PI,TAU);c.fillStyle='#a8aeb6';c.fill();c.strokeStyle='#444';c.lineWidth=.7;c.stroke();ln(c,0,hy-3,0,hy+1.5,1.2,'#8a9098');break;
    case'great':c.beginPath();c.moveTo(-4.6,hy+3);c.lineTo(-4.6,hy-1);c.arc(0,hy-1,4.6,Math.PI,TAU);c.lineTo(4.6,hy+3);c.fillStyle='#aab0b8';c.fill();c.strokeStyle='#444';c.lineWidth=.8;c.stroke();ln(c,-3,hy,3,hy,1,'#222');break;
    case'plume':c.beginPath();c.moveTo(-4.6,hy+3);c.lineTo(-4.6,hy-1);c.arc(0,hy-1,4.6,Math.PI,TAU);c.lineTo(4.6,hy+3);c.fillStyle='#c4c9d0';c.fill();c.strokeStyle='#444';c.lineWidth=.8;c.stroke();ln(c,-3,hy,3,hy,1,'#222');
      c.beginPath();c.moveTo(0,hy-5);c.quadraticCurveTo(-5,hy-10,-7,hy-4);c.lineWidth=2.6;c.strokeStyle=col;c.stroke();break;
    case'horned':c.beginPath();c.arc(0,hy-1,4.4,Math.PI,TAU);c.fillStyle='#9a9fa6';c.fill();ln(c,-4,hy-2,-7,hy-7,1.8,'#eee');ln(c,4,hy-2,7,hy-7,1.8,'#eee');break;
    case'kabuto':poly(c,[[-6,hy+3],[-4.5,hy-5],[4.5,hy-5],[6,hy+3]],'#2a2a32','#111');poly(c,[[-7,hy-7],[0,hy-4],[7,hy-7],[0,hy-9]],'#c8a030');ln(c,-5,hy-3,-8,hy+1,1.4,col);ln(c,5,hy-3,8,hy+1,1.4,col);break;
    case'conical':poly(c,[[-6,hy-1],[6,hy-1],[0,hy-9]],'#c8a050','#7a5a20');break;
    case'turban':ell(c,0,hy-2.5,5,3.2,'#f0e8d0','#a09070');break;
    case'wild':c.beginPath();c.arc(0,hy-1,4.6,Math.PI*0.9,TAU*1.05);c.fillStyle='#7a3a1a';c.fill();for(let i=0;i<4;i++)ln(c,-4+i*2.6,hy-3,-5+i*3.4,hy-7,1.6,'#7a3a1a');break;
    case'tknight':c.beginPath();c.moveTo(-4.8,hy+4);c.lineTo(-4.8,hy-1);c.arc(0,hy-1,4.8,Math.PI,TAU);c.lineTo(4.8,hy+4);c.fillStyle='#d4d8de';c.fill();c.strokeStyle='#333';c.lineWidth=.8;c.stroke();ln(c,-3.5,hy,3.5,hy,1.2,'#111');break;
    case'monk':c.beginPath();c.arc(0,hy-.5,4.3,Math.PI*1.05,TAU*0.98);c.fillStyle='#e8e0d0';c.fill();break;
    case'mongol':ell(c,0,hy-2,5,2.4,'#6a3a1a');poly(c,[[-3,hy-3],[3,hy-3],[0,hy-8]],'#7a4a2a');break;
    case'bald':break;
    default:c.beginPath();c.arc(0,hy-1.5,4,Math.PI,TAU);c.fillStyle='#5a3a1a';c.fill();
  }
}
function drawCarry(c,cr){
  const r=cr.r;
  if(r==='w'){for(let i=0;i<3;i++){ln(c,-8,-20+i*3,2,-24+i*3,2.4,'#8a5a30');ell(c,-8,-20+i*3,1.2,1.2,'#d0a070')}}
  else if(r==='g'){ell(c,-6,-16,4.2,4.6,'#d9ab20','#8a6a10');ell(c,-6.5,-17,1.5,1.2,'#fff4a0')}
  else if(r==='s'){ell(c,-6,-16,4.4,4.2,'#9a9ea6','#555');ell(c,-7,-17,1.5,1.2,'#d0d4da')}
  else{ell(c,-6,-17,4.5,4,'#c8a060','#6a4a20');for(let i=0;i<3;i++)ln(c,-8+i*2,-20,-8+i*2,-23,1,'#e8c860')}
}
// ---------- horses ----------
function drawHorse(c,o){
  const ph=o.ph||0,mv=o.pose==='walk'?1:0;
  const hc=o.horse||'#8a5a34',hd=shade(hc,-.3);
  const gal=mv?Math.sin(ph*1.1):0,bob=mv?Math.abs(gal)*1.8:0;
  c.save();c.scale(o.scale||1,o.scale||1);
  const camel=o.camel;
  // legs
  const legs=[[-9,0],[-6,1],[7,0],[10,1]];
  for(let i=0;i<4;i++){const p=gal*(i%2?-1:1)*5,lx=legs[i][0];ln(c,lx,-11-bob,lx+p,-1,2.6,i<2?hd:hc);ln(c,lx+p,-1,lx+p+(i%2?1:-1),0,1.6,'#2a1a10')}
  // tail
  const tw=Math.sin(ph*.8)*2;c.beginPath();c.moveTo(-13,-17-bob);c.quadraticCurveTo(-19,-14+tw,-17,-6+tw);c.lineWidth=2.8;c.strokeStyle='#2a1a10';c.stroke();
  // body
  c.save();c.translate(0,-bob);
  ell(c,0,-16,14,6.5,hc,hd);
  if(camel){c.beginPath();c.arc(-2,-22,4.5,Math.PI,TAU);c.fillStyle=hc;c.fill()}
  // barding / blanket
  if(o.barding){c.beginPath();c.moveTo(-8,-21);c.quadraticCurveTo(0,-23,8,-21);c.lineTo(9,-11);c.lineTo(-9,-11);c.closePath();c.fillStyle=o.barding;c.fill();c.strokeStyle=shade(o.barding,-.4);c.stroke();ln(c,-9,-11,9,-11,1.5,'#e8d080')}
  else if(o.blanket){ell(c,0,-21.5,5.5,2.4,o.blanket)}
  // neck+head
  const nx=camel?15:13;
  c.beginPath();c.moveTo(10,-20);c.lineTo(nx+2,-30-(camel?3:0));c.lineTo(nx+6,-28-(camel?3:0));c.lineTo(13,-14);c.closePath();c.fillStyle=hc;c.fill();c.strokeStyle=hd;c.stroke();
  ell(c,nx+7,-28-(camel?3:0),4.4,2.6,hc,hd);ell(c,nx+9,-27.5-(camel?3:0),1.2,1,'#2a1a10');
  poly(c,[[nx+1,-30-(camel?3:0)],[nx+2,-34-(camel?3:0)],[nx+4,-30-(camel?3:0)]],hc);
  if(o.barding){poly(c,[[10,-20],[nx+3,-30-(camel?3:0)],[nx+4,-26-(camel?3:0)],[12,-17]],o.barding,shade(o.barding,-.4))}
  c.beginPath();c.moveTo(9,-22);c.quadraticCurveTo(7,-27+gal,2,-23);c.lineWidth=2.2;c.strokeStyle='#2a1a10';c.stroke(); // mane
  c.restore();
  // rider
  if(o.rider){c.save();c.translate(0,-bob-13);o.rider(c);c.restore()}
  c.restore();
}
// ---------- carts / siege ----------
function drawWheel(c,x,y,r,ph){
  ell(c,x,y,r,r,'#6a4a2a','#2a1a0a');
  for(let i=0;i<4;i++){const a=ph+i*Math.PI/4;ln(c,x-Math.cos(a)*r,y-Math.sin(a)*r,x+Math.cos(a)*r,y+Math.sin(a)*r,1,'#2a1a0a')}
}
function drawRam(c,o){
  const ph=o.ph||0,atk=o.at||0,col=o.col;
  c.save();c.scale(o.scale||1,o.scale||1);
  const roll=o.pose==='walk'?ph:0;
  // frame
  poly(c,[[-18,-4],[16,-4],[18,-10],[-16,-10]],'#6a4a2a','#2a1a0a');
  // log swinging
  const sw=o.pose==='attack'?Math.sin(((o.workPh||0)%1)*TAU)*7:0;
  ln(c,-16+sw,-7,20+sw,-7,5,'#4a3020');ell(c,21+sw,-7,3.6,3.2,'#2a2a30','#111');ln(c,-6,-10,-6,-7,1,'#222');ln(c,8,-10,8,-7,1,'#222');
  // roof
  poly(c,[[-19,-10],[19,-10],[14,-24],[-14,-24]],shade(col,-0.05),shade(col,-.4));
  for(let i=-2;i<=2;i++)ln(c,i*7,-10,i*5,-24,0.8,shade(col,-.35));
  poly(c,[[-19,-10],[19,-10],[19,-8],[-19,-8]],'#3a2a18');
  drawWheel(c,-12,-2.5,3.8,roll);drawWheel(c,10,-2.5,3.8,roll);
  c.restore();
}
function drawMangonel(c,o,kind){
  const ph=o.ph||0,col=o.col;const t=o.at>0?1-o.at/(o.atMax||.6):1;
  c.save();c.scale(o.scale||1,o.scale||1);
  const roll=o.pose==='walk'?ph:0;
  poly(c,[[-14,-4],[14,-4],[12,-9],[-12,-9]],'#6a4a2a','#2a1a0a');
  ln(c,-8,-9,0,-22,2.6,'#5a3a20');ln(c,8,-9,0,-22,2.6,'#5a3a20');
  // arm
  const ang=o.at>0?-1.2+t*2.4:-0.3;
  c.save();c.translate(0,-20);c.rotate(ang);ln(c,-12,0,12,0,2.8,'#8a5a30');ell(c,12,0,3.5,2.5,'#7a7a7a','#333');c.restore();
  rect(c,-3,-26,6,4,col);
  drawWheel(c,-9,-2.5,3.6,roll);drawWheel(c,9,-2.5,3.6,roll);
  c.restore();
}
function drawScorpion(c,o){
  const col=o.col;c.save();c.scale(o.scale||1,o.scale||1);
  const roll=o.pose==='walk'?(o.ph||0):0;
  poly(c,[[-10,-4],[10,-4],[8,-8],[-8,-8]],'#6a4a2a','#2a1a0a');
  ln(c,-6,-8,-4,-18,2.4,'#5a3a20');
  poly(c,[[-2,-17],[16,-18],[16,-15],[-2,-14]],'#7a5230','#2a1a0a');
  const rel=o.at>0?0:1;
  ln(c,10,-22,10,-10,1.4,'#8a6a40');c.beginPath();c.moveTo(10,-22);c.lineTo(rel?3:9,-16);c.lineTo(10,-10);c.lineWidth=1;c.strokeStyle='#ddd';c.stroke();
  if(rel)ln(c,3,-16,17,-16.5,1.2,'#444');
  rect(c,-4,-14,5,3,col);
  drawWheel(c,-6,-2.5,3.2,roll);drawWheel(c,6,-2.5,3.2,roll);c.restore();
}
function drawTrebuchet(c,o){
  const col=o.col,t=o.at>0?1-o.at/(o.atMax||.8):1;c.save();c.scale(o.scale||1,o.scale||1);
  const roll=o.pose==='walk'?(o.ph||0):0;
  poly(c,[[-16,-3],[16,-3],[12,-8],[-12,-8]],'#6a4a2a','#2a1a0a');
  poly(c,[[-10,-8],[-2,-34],[2,-34],[-4,-8]],'#5a3a20');poly(c,[[10,-8],[2,-34],[-2,-34],[4,-8]],'#5a3a20');
  const ang=o.at>0?-0.6+t*2.8:2.4;
  c.save();c.translate(0,-33);c.rotate(ang);ln(c,-18,0,-4,0,3,'#7a5230');ln(c,-4,0,16,0,2,'#8a5a30');
  rect(c,-22,-4,8,9,'#6a6a70','#222');ell(c,17,0,2.5,2.5,'#aaa');c.restore();
  rect(c,-2,-38,4,4,col);
  drawWheel(c,-11,-2.5,4,roll);drawWheel(c,11,-2.5,4,roll);c.restore();
}
function drawCart(c,o){
  const col=o.col,roll=o.pose==='walk'?(o.ph||0):0;c.save();c.scale(o.scale||1,o.scale||1);
  poly(c,[[-12,-6],[12,-6],[10,-14],[-10,-14]],'#8a5a30','#3a2a10');
  for(let i=0;i<3;i++)ell(c,-6+i*6,-16,3.4,2.6,['#d9ab20','#c0392b','#4a8a3a'][i]);
  poly(c,[[-12,-6],[-14,-10],[-14,-14],[-10,-14]],'#8a5a30');rect(c,-2,-22,5,5,col);
  drawWheel(c,-7,-3,4,roll);drawWheel(c,8,-3,4,roll);
  // horse-pull: small donkey
  ell(c,17,-9,5,3.2,'#7a6a5a');ln(c,14,-7,14,-1,1.6,'#4a3a2a');ln(c,20,-7,20,-1,1.6,'#4a3a2a');ell(c,22,-12,2.2,1.8,'#7a6a5a');
  c.restore();
}
function drawCar(c,o){
  c.save();c.scale(1.2,1.2);
  const ph=o.ph||0,mv=o.pose==='walk';
  ell(c,0,-1,17,5.5,'rgba(0,0,0,0.3)');
  // body (side view) Shelby Cobra: blue w/ white stripes
  poly(c,[[-17,-5],[-16,-11],[-8,-12],[-4,-16],[3,-16],[6,-12],[16,-11],[18,-7],[17,-5]],'#1a5fb4','#0a2a5a',1);
  ln(c,-16,-10,16,-10,2,'#f4f4f4');ln(c,-15,-8,16,-8,1,'#f4f4f4');
  poly(c,[[-3,-12.5],[-1,-15],[3,-15],[5,-12.5]],'#bcd8f0','#234');
  ell(c,-9,-3.5,4.2,4.2,'#111');ell(c,-9,-3.5,2.4,2.4,'#aaa');ell(c,10,-3.5,4.2,4.2,'#111');ell(c,10,-3.5,2.4,2.4,'#aaa');
  if(mv){ln(c,-9,-3.5,-9+Math.cos(ph*3)*2,-3.5+Math.sin(ph*3)*2,1,'#555');ln(c,10,-3.5,10+Math.cos(ph*3)*2,-3.5+Math.sin(ph*3)*2,1,'#555')}
  ell(c,17,-8,1.8,1.4,'#ffee88');rect(c,-18,-9,2,3,'#ff3030');
  // mounted gun
  ln(c,0,-15,4,-19,2,'#333');ln(c,4,-19,13,-19,2.2,'#222');
  if(o.pose==='attack'&&Math.sin(ph*40)>0)poly(c,[[13,-19],[19,-22],[19,-16]],'#ffd040');
  c.restore();
}
// ---------- animals ----------
function drawAnimal(c,o){
  const ph=o.ph||0,mv=o.pose==='walk';
  const t=o.kind;c.save();
  if(t==='sheep'){
    const g=mv?Math.sin(ph*1.2):0,bob=mv?Math.abs(g)*1:0;
    for(const lx of[-5,-2,2,5])ln(c,lx,-6,lx+(lx>0?g:-g)*2,0,1.6,'#3a3028');
    ell(c,0,-9-bob,8,5.5,'#f2efe6','#c8c4b8');ell(c,-4,-11-bob,4,3.4,'#fbf8f0');ell(c,3,-12-bob,4,3.2,'#fbf8f0');ell(c,0,-6-bob,6,3,'#e4e0d4');
    ell(c,8,-10-bob,3,2.8,'#3a3030');ell(c,6.5,-12.3-bob,1.4,.9,'#3a3030');
    if(o.tag)poly(c,[[5,-8-bob],[7,-7-bob],[6,-4-bob],[4,-6-bob]],o.tag,'#222');
    if(o.eat)ell(c,8.5,-7,2.5,2,'#3a3030');
  }else if(t==='deer'){
    const g=mv?Math.sin(ph*1.5):0;
    for(const lx of[-7,-5,5,7])ln(c,lx,-11,lx+(lx>0?g:-g)*4,0,1.5,'#6a4a2a');
    ell(c,0,-14,9,4.6,'#b08050','#7a5a30');ell(c,-4,-13,3,3,'#f0e0c8');
    c.beginPath();c.moveTo(7,-16);c.lineTo(11,-24);c.lineTo(14,-23);c.lineTo(10,-13);c.fillStyle='#b08050';c.fill();ell(c,13,-23,3.2,2,'#b08050');ell(c,15,-22.5,.8,.8,'#222');
    ln(c,12,-25,10,-31,1,'#d8c8a8');ln(c,10,-31,8,-33,1,'#d8c8a8');ln(c,10,-29,13,-32,1,'#d8c8a8');ln(c,11,-25,14,-30,1,'#d8c8a8');
  }else if(t==='boar'){
    const g=mv?Math.sin(ph*1.5):0;
    for(const lx of[-6,-3,3,6])ln(c,lx,-6,lx+(lx>0?g:-g)*2.5,0,1.8,'#3a3028');
    ell(c,0,-9,9.5,6,'#5a4a42','#2a2018');
    for(let i=0;i<4;i++)ln(c,-4+i*3,-14,-5+i*3,-17,1.3,'#3a2a22');
    ell(c,9,-8,4.4,3.8,'#4a3a32','#2a2018');ell(c,13,-7,2,1.6,'#2a2018');
    ln(c,11,-6,13,-10,1.4,'#f4f0e0');ell(c,8,-11.5,1,1,'#fff');poly(c,[[6,-12],[7,-15],[9,-12]],'#4a3a32');
    ln(c,-9,-10,-12,-12,1.2,'#3a2a22');
  }else if(t==='wolf'){
    const g=mv?Math.sin(ph*1.6):0;
    for(const lx of[-7,-5,5,7])ln(c,lx,-8,lx+(lx>0?g:-g)*4,0,1.5,'#5a5e66');
    ell(c,0,-11,9,4,'#8a8e96','#555');ell(c,-4,-12.5,4,2.4,'#6a6e76');
    c.beginPath();c.moveTo(-9,-12);c.quadraticCurveTo(-15,-12+g*2,-16,-6);c.lineWidth=3;c.strokeStyle='#6a6e76';c.stroke();
    c.beginPath();c.moveTo(7,-13);c.lineTo(11,-17);c.lineTo(15,-13);c.lineTo(11,-10);c.fillStyle='#8a8e96';c.fill();ell(c,15,-12.5,1.3,1,'#222');
    poly(c,[[9,-17],[10,-21],[12,-17]],'#6a6e76');
    if(o.angry){ln(c,13,-11,13,-9,.8,'#fff');ln(c,14,-11,14,-9,.8,'#fff')}
  }
  c.restore();
}
// ---------- ships (drawn in ground plane then projected) ----------
function drawShip(c,o,proj){
  // proj(a,b,h) -> [x,y] relative screen offset for local (a=forward, b=side) ground coords & height
  const col=o.col,k=o.kind,ph=o.ph||0,moving=o.pose==='walk';
  const P=(a,b,h)=>proj(a,b,h||0);
  const wob=Math.sin(ph*0.6)*1.2;
  // water shadow
  const hull=(len,wid,deck,hc,hd)=>{
    const pts=[],N=14;
    for(let i=0;i<=N;i++){const a=-len+(2*len)*i/N,w=wid*(1-Math.pow((a)/len,4)*0.95)*(a>0?(1-a/len*0.2):1);pts.push([a,w])}
    const top=[];for(const[a,w]of pts)top.push(P(a,w,deck));for(let i=pts.length-1;i>=0;i--)top.push(P(pts[i][0],-pts[i][1],deck));
    // hull side (visible lower side)
    // draw sides both
    const bot1=[],bot2=[];
    const lower=(sg)=>{const q=[];for(const[a,w]of pts)q.push(P(a,sg*w,deck));for(let i=pts.length-1;i>=0;i--)q.push(P(pts[i][0],sg*pts[i][1]*0.8,-3));return q};
    poly(c,lower(1),hd,'#2a1a0a');poly(c,lower(-1),shade(hd,-.1),'#2a1a0a');
    poly(c,top,hc,'#3a2a14');
    // planks
    for(let a=-len*0.8;a<len*0.9;a+=len*0.28){const w=wid*(1-Math.pow(a/len,4)*0.95);const p1=P(a,w,deck),p2=P(a,-w,deck);ln(c,p1[0],p1[1],p2[0],p2[1],0.7,'rgba(60,40,20,0.5)')}
    return top;
  };
  c.save();c.translate(0,wob*0.6);
  // wake
  if(moving){const w1=P(-o.len*0.9,0,0);c.globalAlpha=0.5;for(let i=0;i<3;i++){const p=P(-o.len-i*4,0,0);ell(c,p[0],p[1],6+i*4,2.4+i*1.3,null,'rgba(255,255,255,'+(0.55-i*0.15)+')')}c.globalAlpha=1}
  const mast=(a,h,sail,sw)=>{
    const b=P(a,0,3),t=P(a,0,h);ln(c,b[0],b[1],t[0],t[1],2,'#5a3a1a');
    if(sail){const s=sw||o.len*0.7;const p1=P(a,-s,h-2),p2=P(a,s,h-2),p3=P(a,s*0.8,h*0.45),p4=P(a,-s*0.8,h*0.45);
      const billow=Math.sin(ph*0.7)*1.5;
      c.beginPath();c.moveTo(p1[0],p1[1]);c.lineTo(p2[0],p2[1]);c.quadraticCurveTo((p2[0]+p3[0])/2+billow,(p2[1]+p3[1])/2,p3[0],p3[1]);c.lineTo(p4[0],p4[1]);c.quadraticCurveTo((p1[0]+p4[0])/2-billow,(p1[1]+p4[1])/2,p1[0],p1[1]);c.fillStyle=sail;c.fill();c.strokeStyle='#aaa';c.lineWidth=.8;c.stroke();
      ln(c,p1[0],p1[1],p2[0],p2[1],1.6,'#5a3a1a');
      return [p1,p2,p3,p4]}
  };
  const flag=(a,h,colr)=>{const t=P(a,0,h);const w=Math.sin(ph*1.3)*2;poly(c,[[t[0],t[1]],[t[0]+9,t[1]+2+w],[t[0]+8,t[1]+5],[t[0],t[1]+6]],colr,'#222')};
  const oars=(n,len,spread)=>{for(let i=0;i<n;i++){const a=-len*0.7+i*(len*1.4/(n-1));const sw=moving?Math.sin(ph*1.2+i*0.5)*3:0;for(const sg of[-1,1]){const p1=P(a,sg*spread,3),p2=P(a+sw*0.5,sg*(spread+5),-1);ln(c,p1[0],p1[1],p2[0],p2[1],1.2,'#5a3a1a')}}};
  switch(k){
    case'fishing':{o.len=9;oars(0+3,9,5);hull(9,4,4,'#9a6a3a','#6a4a24');mast(0,18,'#efe6cf',5);flag(0,18,col);
      // net/ crate
      const n=P(-4,0,5);ell(c,n[0],n[1],4,2,'#c8b890','#6a5a3a');
      const m=P(3,1,5);ell(c,m[0],m[1],2.6,1.6,'#5a6a7a');
      if(o.work){const rp=P(-3,4,5),rp2=P(-3,9,2+Math.sin(ph)*2);ln(c,rp[0],rp[1],rp2[0],rp2[1],0.8,'#ddd');ell(c,rp2[0],rp2[1],3.2,1.4,'rgba(180,200,220,.6)')}
      break}
    case'transport':{o.len=12;hull(12,6,5,'#8a5a2e','#5a3a1a');mast(2,24,'#efe6cf',7);flag(2,24,col);
      for(let i=0;i<3;i++){const p=P(-6+i*3,i%2?2:-2,7);rect(c,p[0]-3,p[1]-3,6,5,'#a8783a','#4a2a10')}
      const nc=o.cargo||0;for(let i=0;i<Math.min(nc,6);i++){const p=P(-4+i*2,(i%2?1:-1)*1.5,7);ell(c,p[0],p[1]-5,1.8,1.8,SKIN[0]);rect(c,p[0]-1.6,p[1]-4,3.2,4,col)}
      break}
    case'galley':{o.len=15;oars(8,15,4.8);hull(15,4.6,4,'#7a4a24','#4a2a12');
      // prow ram, shield row, mast
      const pr=P(16,0,3),pr2=P(20,0,2);ln(c,pr[0],pr[1],pr2[0],pr2[1],2,'#3a2a1a');
      for(let i=0;i<6;i++){const p=P(-10+i*3.6,4.4,6),q=P(-10+i*3.6,-4.4,6);ell(c,p[0],p[1],2.4,2.4,i%2?col:'#e8e0c8','#222');ell(c,q[0],q[1],2.4,2.4,i%2?col:'#e8e0c8','#222')}
      mast(1,26,shade(col,.1),8);flag(1,26,col);
      const bow=P(10,0,6);ell(c,bow[0],bow[1]-3,2,2,SKIN[0]);rect(c,bow[0]-1.5,bow[1]-2,3,4,col);
      if(o.at>0){const f=P(14,0,8);ell(c,f[0],f[1],2+Math.random()*2,2,'rgba(255,200,80,.9)')}
      break}
    case'fire':{o.len=13;oars(6,13,4);hull(13,4,4,'#6a2a1a','#3a1a10');
      mast(0,18,'#6a2a1a',5);flag(0,19,'#e8601a');
      // brazier flames
      const b=P(10,0,7);for(let i=0;i<4;i++){const fl=Math.sin(ph*3+i*1.7)*2;poly(c,[[b[0]-3+i*2,b[1]],[b[0]-2+i*2+fl*0.3,b[1]-7-fl],[b[0]-1+i*2,b[1]]],['#ff6a10','#ffb020','#ffe060','#ff4010'][i])}
      if(o.at>0){const f0=P(14,0,6),f1=P(28,0,4);c.globalAlpha=.8;poly(c,[[f0[0],f0[1]-2],[f1[0],f1[1]-6],[f1[0],f1[1]+6],[f0[0],f0[1]+2]],'rgba(255,120,20,.7)');c.globalAlpha=1}
      break}
    case'demo':{o.len=9;hull(9,3.6,3,'#5a4a3a','#3a2a1a');
      for(let i=0;i<3;i++){const p=P(-4+i*3.5,0,6);ell(c,p[0],p[1],3.4,3.8,'#6a4a28','#222');ln(c,p[0]-3,p[1]-1,p[0]+3,p[1]-1,0.8,'#222')}
      const f=P(2,0,10);ln(c,f[0],f[1],f[0],f[1]-4,1,'#222');const sp=Math.sin(ph*9);ell(c,f[0],f[1]-5,2+sp,2+sp,'#ffd040');ell(c,f[0],f[1]-5,1,1,'#fff');
      flag(-5,14,col);break}
    case'tradecog':{o.len=11;hull(11,5.6,4,'#8a5a2e','#5a3a1a');mast(1,24,'#f0e8d8',7);flag(1,24,col);
      for(let i=0;i<3;i++){const p=P(-6+i*3,i%2?1.6:-1.6,7);ell(c,p[0],p[1],3,2.6,['#d9ab20','#a04a2a','#4a8a3a'][i],'#222')}
      const p=P(-9,0,5);ell(c,p[0],p[1],2,2,'#d9ab20');break}
  }
  c.restore();
}
