'use strict';
// ===== Procedural image icons for command buttons =====
const ICACHE={};
function mkIcon(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv}
function iconBg(c,kind){
  const g=c.createLinearGradient(0,0,0,48);
  const pal={unit:['#3b4a66','#1d2638'],bld:['#6a5238','#35281a'],tech:['#7a6a4a','#3e3424'],cmd:['#44444e','#22222a'],age:['#8a6a20','#3a2a08'],locked:['#333','#1a1a1a']}[kind]||['#444','#222'];
  g.addColorStop(0,pal[0]);g.addColorStop(1,pal[1]);c.fillStyle=g;c.fillRect(0,0,48,48);
  c.strokeStyle='rgba(255,230,160,.55)';c.lineWidth=2;c.strokeRect(1,1,46,46);
}
function glyph(c,n,col){
  col=col||'#f2e4b8';
  c.save();c.translate(24,24);c.lineCap='round';c.lineJoin='round';
  const st=(w,s)=>{c.lineWidth=w;c.strokeStyle=s||col};
  switch(n){
    case'stop':rect(c,-10,-10,20,20,'#d84a4a','#511');break;
    case'garrison':poly(c,[[-14,2],[0,-12],[14,2],[10,2],[10,12],[-10,12],[-10,2]],'#c8b890','#443');rect(c,-3,2,6,10,'#4a3018');break;
    case'ungarrison':poly(c,[[-14,2],[0,-12],[14,2],[10,2],[10,12],[-10,12],[-10,2]],'#c8b890','#443');rect(c,-3,2,6,10,'#4a3018');st(3,'#6f6');c.beginPath();c.moveTo(0,16);c.lineTo(0,4);c.moveTo(-5,9);c.lineTo(0,3);c.lineTo(5,9);c.stroke();break;
    case'bell':ell(c,0,-6,0,0);c.beginPath();c.moveTo(-11,8);c.quadraticCurveTo(-11,-12,0,-13);c.quadraticCurveTo(11,-12,11,8);c.closePath();c.fillStyle='#e0b030';c.fill();st(1.5,'#6a4a08');c.stroke();ell(c,0,11,3,3,'#a07010');ln(c,0,-13,0,-17,2,'#6a4a08');break;
    case'repair':ln(c,-10,10,8,-8,4,'#a0a6b0');ell(c,10,-10,6,6,null,'#a0a6b0');c.lineWidth=4;c.strokeStyle='#a0a6b0';c.stroke();ln(c,-12,12,-6,6,5,'#7a5230');break;
    case'rally':ln(c,-8,14,-8,-14,3,'#ddd');poly(c,[[-8,-14],[12,-8],[-8,-2]],'#e44','#511');break;
    case'delete':st(5,'#e44');c.beginPath();c.moveTo(-10,-10);c.lineTo(10,10);c.moveTo(10,-10);c.lineTo(-10,10);c.stroke();break;
    case'eco':ln(c,-10,12,6,-6,3,'#7a5230');poly(c,[[2,-12],[12,-8],[8,-2],[-2,-6]],'#a0a6b0','#333');poly(c,[[-14,14],[-2,14],[-8,6]],'#4a8a3a','#222');break;
    case'mil':ln(c,-12,12,10,-10,3,'#d8dce4');ln(c,12,12,-10,-10,3,'#d8dce4');ln(c,-6,6,-12,12,4,'#8a6a2a');ln(c,6,6,12,12,4,'#8a6a2a');break;
    case'back':st(5,'#fff');c.beginPath();c.moveTo(10,0);c.lineTo(-10,0);c.moveTo(-3,-8);c.lineTo(-11,0);c.lineTo(-3,8);c.stroke();break;
    case'hammer':ln(c,-9,11,5,-3,4,'#7a5230');rect(c,0,-12,14,9,'#8a8e96','#333');break;
    case'coin':ell(c,0,0,12,12,'#f2c030','#7a5a08');ell(c,0,0,8,8,null,'#a07a10');ln(c,0,-5,0,5,2,'#a07a10');break;
    case'age':poly(c,[[0,-14],[12,-4],[8,12],[-8,12],[-12,-4]],'#e8c050','#6a4a08');ell(c,0,0,5,5,'#7a3a8a');ln(c,0,-14,0,-18,2,'#e8c050');break;
    case'star':{c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?6:13;c.lineTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fillStyle='#f4d050';c.fill();st(1.5,'#7a5a08');c.stroke();break}
    case'book':rect(c,-11,-12,22,24,'#8a3a2a','#2a0e08');rect(c,-8,-9,16,18,'#e8dcb8');ln(c,-5,-4,5,-4,1.4,'#6a4a2a');ln(c,-5,0,5,0,1.4,'#6a4a2a');ln(c,-5,4,2,4,1.4,'#6a4a2a');break;
    case'wheat':for(let i=-1;i<=1;i++){ln(c,i*6,14,i*6,-6,2,'#c8a830');for(let j=0;j<4;j++){ell(c,i*6-2,-4+j*-3+4,2.6,1.4,'#e8d050');ell(c,i*6+2,-4+j*-3+2,2.6,1.4,'#e8d050')}}break;
    case'axe':ln(c,-8,13,6,-8,3.4,'#7a5230');poly(c,[[3,-12],[14,-9],[12,0],[4,-3]],'#b8bcc4','#333');break;
    case'pick':ln(c,-8,13,6,-8,3.4,'#7a5230');c.beginPath();c.moveTo(-6,-10);c.quadraticCurveTo(6,-18,14,-4);st(4,'#a0a6b0');c.stroke();break;
    case'gold':poly(c,[[-12,10],[-6,-6],[6,-6],[12,10]],'#e8b820','#6a4a08');poly(c,[[-6,-6],[0,-13],[6,-6]],'#f6d640','#6a4a08');ell(c,-2,0,3,2,'#fff0a0');break;
    case'stone':poly(c,[[-13,10],[-9,-4],[0,-12],[10,-6],[13,10]],'#a0a4ac','#333');poly(c,[[-9,-4],[0,-12],[2,0],[-5,4]],'#c8ccd4');break;
    case'sword':ln(c,-10,12,10,-10,4,'#e0e4ea');ln(c,-9,3,3,11,3,'#c0a040');ln(c,-12,13,-8,9,5,'#6a4a2a');break;
    case'sword2':ln(c,-12,13,12,-12,5,'#e0e4ea');ln(c,-9,2,2,13,3.4,'#c0a040');break;
    case'arrow':ln(c,-12,12,12,-12,2.4,'#d8d0b8');poly(c,[[12,-12],[4,-10],[10,-4]],'#c0c4cc');poly(c,[[-12,12],[-14,6],[-8,10]],'#c33');poly(c,[[-12,12],[-6,14],[-10,8]],'#c33');break;
    case'armor':poly(c,[[-12,-10],[-5,-13],[5,-13],[12,-10],[10,2],[0,13],[-10,2]],'#a8aeb6','#333');ln(c,0,-12,0,10,1.4,'#6a6e76');break;
    case'horse':poly(c,[[-6,12],[-4,-2],[2,-12],[8,-10],[12,-2],[6,0],[6,12]],'#8a5a34','#2a1a0a');ell(c,4,-8,1.4,1.4,'#fff');break;
    case'cloth':poly(c,[[-12,-10],[12,-10],[10,12],[-10,12]],'#c8dce8','#334');for(let i=0;i<3;i++)ln(c,-8,-4+i*6,8,-4+i*6,1.2,'#8aa0b0');break;
    case'boat':poly(c,[[-14,0],[14,0],[9,10],[-9,10]],'#8a5a2e','#2a1a0a');ln(c,0,0,0,-14,2,'#5a3a1a');poly(c,[[0,-14],[10,-4],[0,-2]],'#f0e8d0','#555');break;
    case'cart':rect(c,-11,-5,22,10,'#8a5a30','#2a1a0a');ell(c,-6,8,4,4,'#4a3018');ell(c,6,8,4,4,'#4a3018');ell(c,0,-6,5,3,'#f2c030');break;
    case'heal':st(5,'#5f6');c.beginPath();c.moveTo(0,-10);c.lineTo(0,10);c.moveTo(-10,0);c.lineTo(10,0);c.stroke();break;
    case'speed':st(3,'#8cf');c.beginPath();c.moveTo(-12,-4);c.lineTo(8,-4);c.moveTo(-8,2);c.lineTo(12,2);c.moveTo(-12,8);c.lineTo(4,8);c.stroke();break;
    case'tower':rect(c,-7,-10,14,22,'#9a9ea6','#333');for(let i=-1;i<=1;i++)rect(c,i*5-2,-14,4,5,'#9a9ea6','#333');rect(c,-2,2,4,10,'#2a180c');break;
    case'wall':rect(c,-14,-2,28,14,'#9a9ea6','#333');for(let i=0;i<4;i++)rect(c,-14+i*8,-7,5,5,'#9a9ea6','#333');ln(c,-14,5,14,5,1,'#555');break;
    case'gate':rect(c,-14,-8,10,20,'#9a9ea6','#333');rect(c,4,-8,10,20,'#9a9ea6','#333');rect(c,-4,-4,8,16,'#4a3018','#111');break;
    case'house':poly(c,[[-12,-2],[0,-13],[12,-2]],'#b04a2a','#333');rect(c,-9,-2,18,13,'#d8c8a0','#333');rect(c,-2,3,5,8,'#4a3018');break;
    case'fish':poly(c,[[-10,0],[-4,-6],[6,-5],[12,0],[6,5],[-4,6]],'#7aaad0','#234');poly(c,[[-10,0],[-15,-5],[-15,5]],'#7aaad0','#234');ell(c,6,-1,1.4,1.4,'#fff');break;
    case'food':ell(c,-2,2,10,7,'#c0603a','#4a2010');ln(c,6,-4,12,-10,4,'#e8dcc0');ell(c,13,-11,3,3,'#e8dcc0');break;
    case'wood':for(let i=0;i<3;i++){ell(c,-6+i*6,6-i*0,5,5,'#a0703a','#3a2210');ell(c,-6+i*6,6,2,2,'#d8b078')}ell(c,0,-3,5,5,'#a0703a','#3a2210');break;
    case'tribute':ell(c,0,0,12,12,'#f2c030','#7a5a08');st(3,'#7a5a08');c.beginPath();c.moveTo(-5,0);c.lineTo(5,0);c.moveTo(1,-4);c.lineTo(5,0);c.lineTo(1,4);c.stroke();break;
    case'relic':poly(c,[[-8,12],[8,12],[7,-4],[-7,-4]],'#e8c858','#5a3a0a');poly(c,[[-9,-4],[9,-4],[0,-14]],'#f4d868','#5a3a0a');ell(c,0,4,3,3,'#c33');break;
    case'unload':poly(c,[[-14,4],[14,4],[9,12],[-9,12]],'#8a5a2e','#2a1a0a');st(3,'#6f6');c.beginPath();c.moveTo(0,-12);c.lineTo(0,2);c.moveTo(-5,-3);c.lineTo(0,3);c.lineTo(5,-3);c.stroke();break;
    case'stance':poly(c,[[-10,-10],[10,-10],[10,2],[0,13],[-10,2]],'#6a8ac8','#223');break;
    default:rect(c,-10,-10,20,20,'#888','#333');
  }
  c.restore();
}
const TECH_GLYPH=[[/forging|ironcast|blastfurn|conscription|chieftains/,'sword'],[/fletching|bodkin|bracer|thumbring|ballistics|yeomen/,'arrow'],[/scale|chain|plate|padded|leather|ringarcher|masonry|ironclad/,'armor'],[/barding|bloodlines|cavalier|paladin|lightcav|hussar|zealotry|chivalry/,'horse'],
 [/horsecollar|heavyplow|cropr/,'wheat'],[/doublebit|bowsaw|twoman/,'axe'],[/goldmine|goldshaft|caravan|guilds/,'gold'],[/stonemine|stoneshaft|hoardings|guardtower|murder|heatedshot|greatwall|crenellations/,'tower'],
 [/loom/,'cloth'],[/wheelbarrow|handcart|treadmill/,'cart'],[/fervor|redemption|atonement|sanctity|illumination|blockprint|herbal|madrasah/,'heal'],[/gillnets|galley|galleon|fastfire|heavydemo|careening|greekfire/,'boat'],[/feudal|castle|imperial/,'age'],[/townwatch/,'tower'],
 [/manatarms|longsword|twohand|champion|pikeman|halberdier|crossbow|arbalest|eliteskirm|hcavarcher|capram|siegeram|onager|heavyscorp|siegeeng/,'sword2'],[/uniq|euniq|warwolf|bearded|anarchy|perfusion|logistica|yasama|kataparuto|nomads|drill|berserkergang|rocketry/,'star']];
function techGlyph(k){for(const[re,g]of TECH_GLYPH)if(re.test(k))return g;return'book'}
function drawUnitPreview(c,type,col){
  const d=U[type];col=col||'#3a78e0';
  const k=d.k;
  c.save();
  if(d.cls.includes('ship')){
    c.translate(24,28);const fxv=0.8,fyv=0.6,kk=0.75;
    const proj=(a,b,h)=>{const wx=(a*fxv-b*fyv)*kk,wy=(a*fyv+b*fxv)*kk;return[(wx-wy)*0.72,(wx+wy)*0.36-h]};
    const kind=k==='fishing'?'fishing':k==='transport'?'transport':k==='galley'?'galley':k==='fire'?'fire':k==='demo'?'demo':'tradecog';
    drawShip(c,{col,kind,ph:1,pose:'idle'},proj);
  }else{
    c.translate(24,44);const s=d.cls.includes('siege')||k==='tradecart'||k==='cobra'?1.1:CAV[k]?1.15:1.9;c.scale(s,s);
    if(d.animal)drawAnimal(c,{kind:k,ph:0,pose:'idle',tag:null});
    else if(k==='ram')drawRam(c,{col,ph:0,pose:'idle'});
    else if(k==='mangonel'||k==='onager')drawMangonel(c,{col,ph:0,pose:'idle'});
    else if(k==='scorpion'||k==='heavyscorp')drawScorpion(c,{col,ph:0,pose:'idle'});
    else if(k==='trebuchet')drawTrebuchet(c,{col,ph:0,pose:'idle'});
    else if(k==='tradecart')drawCart(c,{col,ph:0,pose:'idle'});
    else if(k==='cobra')drawCar(c,{ph:0,pose:'idle'});
    else if(CAV[k]){const cv=CAV[k];drawHorse(c,{ph:0,pose:'idle',horse:cv.horse,barding:cv.barding?col:null,blanket:cv.blanket?col:null,camel:cv.camel,scale:cv.scale,rider:(cc)=>drawHuman(cc,{col,hat:cv.hat,tool:cv.tool==='bow'?'bow':'lance',pose:'idle',ph:0,front:true,sit:1,scale:.9,armor:cv.barding?'#aab0b8':undefined})})}
    else{const h=HUM[k]||HUM.militia;drawHuman(c,{col,hat:h.hat,tool:k==='villager'?null:h.tool,shield:h.shield,shieldCol:h.shieldCol,armor:h.armor,cape:h.cape===1?col:h.cape,quiver:h.quiver,hoodCol:h.hoodCol,bowCol:h.bowCol,robe:h.robe,pose:'idle',ph:0,front:true,scale:h.scale||1,skin:SKIN[0]})}
  }
  c.restore();
}
function getIcon(kind,key,opt){
  const ck=kind+'|'+key+'|'+(opt||'');if(ICACHE[ck])return ICACHE[ck];
  const cv=mkIcon(48,48),c=cv.getContext('2d');
  if(kind==='unit'){iconBg(c,'unit');drawUnitPreview(c,key)}
  else if(kind==='bld'){iconBg(c,'bld');const sp=getBuildingSprite(key,'britons',2,'#3a78e0');const sc=Math.min(44/sp.cv.width*1.25,44/sp.cv.height*1.15);c.save();c.beginPath();c.rect(2,2,44,44);c.clip();c.translate(24,26);c.scale(sc,sc);c.drawImage(sp.cv,-sp.cv.width/2,-sp.cv.height*0.62);c.restore()}
  else if(kind==='tech'){iconBg(c,key==='feudal'||key==='castle'||key==='imperial'?'age':'tech');glyph(c,techGlyph(key))}
  else{iconBg(c,'cmd');glyph(c,key)}
  ICACHE[ck]=cv.toDataURL();return ICACHE[ck];
}
function iconURL(kind,key){return getIcon(kind,key)}
