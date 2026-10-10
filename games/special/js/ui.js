'use strict';
// ===== In-game UI: input, selection, command card, tooltips =====
const $=id=>document.getElementById(id);
const KEYS=['q','w','e','r','t','a','s','d','f','g','z','x','c','v','b','y','u','i','o','p'];
const UI={sel:[],groups:{},mode:null,menu:'root',placing:null,drag:null,mouse:{x:0,y:0},keys:{},typing:false,lastClick:0,lastClickId:0,tipIdx:0,tipT:0,hoverBtn:null,idleIdx:0,cardTimer:0,hudTimer:0,lastAlert:null,alertT:-99,captionT:0,wallStart:null,cursor:'default'};
const TIPS=[
 'Select villagers (left-click or drag a box) and right-click a tree, berry bush or mine to start gathering. They return resources to the nearest drop-off.',
 'Build Houses before you hit the population cap. Build a Lumber Camp next to forests and a Mining Camp next to gold and stone to shorten walking.',
 'Your sheep are selectable! Right-click one with a villager to slaughter it for food. Move your units near neutral sheep to claim them – enemies can capture unguarded sheep.',
 'Keep training villagers from the Town Center (hotkey Q on the Town Center card). Idle villagers can be found with the Idle button or the . key.',
 'Advance to the Feudal Age from the Town Center. You need two different Dark Age buildings and 500 food.',
 'Higher ground gives your units +25% damage (+1 range for archers). Fight uphill at your peril!',
 'Ring the Town Bell (🔔) when raiders approach: villagers shelter in Town Centers, Towers and Castles. Ring it again to send them back to work.',
 'Docks must be built on a shoreline. Fishing Ships gather from fish schools; Transport Ships carry land units – right-click a shore to unload.',
 'Villagers repair damaged buildings and siege/ships by right-clicking them. Monks heal living units; right-click enemies with a monk to convert them.',
 'Use Spearmen against cavalry, Skirmishers against Archers, Cavalry against Skirmishers and Monks, Rams against buildings.',
 'Press Enter to chat or type a cheat code (if cheats are enabled). See Help for the full list.',
 'Check Diplomacy to propose peace or alliance, or send tribute. To win you must defeat every player who is not allied with you.',
];
// ---------- helpers ----------
function selEnts(){const out=[];for(const id of UI.sel){const e=G.byId.get(id);if(e&&!e.dead)out.push(e)}UI.sel=out.map(e=>e.id);return out}
function setSel(ids){UI.sel=ids.slice();R.selIds=new Set(UI.sel);UI.menu='root';UI.mode=null;UI.cancelPlace();uiRefresh(true)}
UI.cancelPlace=function(){UI.placing=null;R.ghost=null;UI.wallStart=null;updateModeInfo()};
function toast(text,kind){
  const box=$('toasts');const d=document.createElement('div');d.className='toast '+(kind||'');d.textContent=text;box.appendChild(d);
  while(box.children.length>6)box.removeChild(box.firstChild);
  setTimeout(()=>{d.style.transition='opacity .6s';d.style.opacity='0';setTimeout(()=>d.remove(),650)},4200);
}
function caption(text){
  const box=$('captions');const d=document.createElement('span');d.className='cap';d.textContent=text;box.appendChild(d);
  while(box.children.length>2)box.removeChild(box.firstChild);
  setTimeout(()=>d.remove(),2200);
}
function chatLine(text,cls){const box=$('chatlog');const d=document.createElement('div');if(cls)d.className=cls;d.textContent=text;box.appendChild(d);while(box.children.length>6)box.removeChild(box.firstChild);setTimeout(()=>d.remove(),9000)}
function updateModeInfo(){
  const m=$('modeinfo');let t='';
  if(UI.placing)t='Placing '+B[UI.placing.type].n+' – left-click to build ('+(B[UI.placing.type].wall?'drag for a line, ':'')+'Shift = place several), right-click / Esc to cancel';
  else if(UI.mode==='amove')t='Attack-move: left-click a destination (Esc to cancel)';
  else if(UI.mode==='garrison')t='Garrison: left-click a building to enter (Esc to cancel)';
  else if(UI.mode==='rally')t='Rally point: left-click the ground or a resource (Esc to cancel)';
  else if(UI.mode==='unload')t='Unload: left-click a shore to land troops (Esc to cancel)';
  m.textContent=t;m.classList.toggle('hidden',!t);
}
function unitKind(u){const d=u.def;if(d.k==='villager')return'vil';if(d.k==='monk')return'monk';if(d.cls.includes('ship'))return'ship';if(d.cls.includes('siege'))return'siege';if(d.cls.includes('cav'))return'cav';return'mil'}
function speak(ents,action){
  if(!window.AudioSys||!ents.length)return;
  const u=ents.find(e=>e.kind==='u'&&e.owner===0&&!e.def.animal)||ents.find(e=>e.kind==='u'&&e.def.k==='sheep');if(!u)return;
  if(u.def.k==='sheep'){AudioSys.sfx('sheep',{vol:.6});return}
  if(u.type==='cobra'){AudioSys.sfx('engine',{vol:.6});return}
  const t=AudioSys.voice(G.players[0].civ,unitKind(u),action);
  if(t)caption(String(t).split('|')[0]);
}
function mark(x,y,col){R.marks.push({x,y,t:0,col:col||'#7dff7d'})}
// ---------- picking ----------
function pickEntity(sx,sy,onlyOwn){
  const z=CAM.zoom;let best=null,bd=1e9;
  // units
  for(const u of G.units){
    if(u.dead||u.inside)continue;if(!entVisible(u))continue;
    const[gx,gy]=toScr(u.x,u.y,u.z!==undefined?u.z:hAt(u.x,u.y));
    const big=u.def.cls.includes('ship')?26:u.def.cls.includes('siege')?20:u.def.cls.includes('cav')?19:13;
    const dx=(sx-gx)/(big*z),dy=(sy-(gy-big*0.9*z))/(big*1.15*z);const d=dx*dx+dy*dy;
    if(d<1&&d<bd){bd=d;best=u}
  }
  if(best&&!onlyOwn)return best;
  if(best&&onlyOwn)return best;
  // buildings: alpha hit
  const w=scrToWorld(sx,sy);
  let bb=null,bdepth=-1;
  for(const b of G.blds){
    if(b.dead||!entVisible(b))continue;
    const[bx,by]=toScr(b.cx,b.cy,hAt(b.cx,b.cy));
    let hit=false;
    if(b.def.wall||b.def.farm){hit=w.x>=b.x&&w.x<b.x+b.sz&&w.y>=b.y&&w.y<b.y+b.sz}
    else{
      const p=G.players[b.owner];const sp=getBuildingSprite(b.type,p.civ,Math.min(3,p.age),p.color);
      const lx=Math.round((sx-bx)/z+sp.ox),ly=Math.round((sy-by)/z+sp.oy);
      if(lx>=0&&ly>=0&&lx<sp.cv.width&&ly<sp.cv.height){try{hit=sp.cv.getContext('2d').getImageData(lx,ly,1,1).data[3]>40}catch(e){hit=true}}
      if(!hit&&w.x>=b.x&&w.x<b.x+b.sz&&w.y>=b.y&&w.y<b.y+b.sz)hit=true;
    }
    if(hit){const dp=b.cx+b.cy;if(dp>bdepth){bdepth=dp;bb=b}}
  }
  if(bb)return bb;
  if(onlyOwn)return null;
  // resources
  let br=null,rd=1e9;
  for(const r of G.ress){
    if(r.dead||!entVisible(r))continue;if(Math.abs(r.x+.5-w.x)>2||Math.abs(r.y+.5-w.y)>2.5)continue;
    const[rx,ry]=toScr(r.x+.5,r.y+.5,r.type==='fish'?-0.35:hAt(r.x,r.y));
    const isTree=r.res==='w';const hh=isTree?30:12;
    const dx=(sx-rx)/(14*z),dy=(sy-(ry-hh*z*0.6))/(hh*z);const d=dx*dx+dy*dy;
    if(d<1&&d<rd){rd=d;br=r}
  }
  return br;
}
// ---------- input ----------
function uiInit(){
  const c=cv;
  c.addEventListener('mousedown',onMouseDown);
  window.addEventListener('mousemove',onMouseMove);
  window.addEventListener('mouseup',onMouseUp);
  c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('wheel',onWheel,{passive:false});
  window.addEventListener('keydown',onKeyDown);
  window.addEventListener('keyup',e=>{UI.keys[e.key.toLowerCase()]=false});
  $('minimap').addEventListener('mousedown',onMinimapDown);
  $('minimap').addEventListener('contextmenu',e=>e.preventDefault());
  $('tb-bell').onclick=()=>{toggleBell(G.players[0]);uiRefresh(true)};
  $('tb-idle').onclick=()=>selectIdle(false);
  $('tb-dip').onclick=openDiplomacy;$('tb-help').onclick=()=>openHelp(true);$('tb-menu').onclick=openPauseMenu;
  $('tipclose').onclick=()=>$('tipbox').classList.add('hidden');
  $('chatinput').addEventListener('keydown',onChatKey);
  document.addEventListener('mousedown',()=>{if(window.AudioSys&&!AudioSys.unlocked)AudioSys.init()},{once:false});
  window.addEventListener('blur',()=>{UI.keys={}});
}
function inGame(){return!$('hud').classList.contains('hidden')&&!R.editor}
function onWheel(e){e.preventDefault();const f=e.deltaY<0?1.1:1/1.1;zoomAt(f,e.clientX,e.clientY)}
function zoomAt(f,sx,sy){const before=scrToWorld(sx,sy);CAM.zoom=clamp(CAM.zoom*f,0.45,1.9);const after=scrToWorld(sx,sy);const[ax,ay]=iso(after.x,after.y,0),[bx,by]=iso(before.x,before.y,0);CAM.x+=bx-ax;CAM.y+=by-ay;clampCam()}
function clampCam(){
  if(!G)return;const N=G.W;const minx=-N*32,maxx=N*32,miny=-40,maxy=N*32+60;
  CAM.x=clamp(CAM.x,minx,maxx);CAM.y=clamp(CAM.y,miny,maxy);
}
function onMouseDown(e){
  if(R.editor){return edMouseDown(e)}
  if(!inGame())return;
  if(window.AudioSys&&!AudioSys.unlocked)AudioSys.init();
  UI.mouse={x:e.clientX,y:e.clientY};
  if(e.button===1){UI.pan={x:e.clientX,y:e.clientY,cx:CAM.x,cy:CAM.y};e.preventDefault();return}
  if(e.button===2){return rightClick(e)}
  if(e.button!==0)return;
  if(UI.placing){
    const d=B[UI.placing.type];
    if(d.wall){UI.wallStart=ghostTile();return}
    placeAtGhost(e.shiftKey);return}
  if(UI.mode){doModeClick(e);return}
  UI.drag={x:e.clientX,y:e.clientY,x2:e.clientX,y2:e.clientY,shift:e.shiftKey};
}
function onMouseMove(e){
  UI.mouse={x:e.clientX,y:e.clientY};
  if(R.editor){return edMouseMove(e)}
  if(!inGame())return;
  if(UI.pan){CAM.x=UI.pan.cx-(e.clientX-UI.pan.x)/CAM.zoom;CAM.y=UI.pan.cy-(e.clientY-UI.pan.y)/CAM.zoom;clampCam();return}
  if(UI.drag){UI.drag.x2=e.clientX;UI.drag.y2=e.clientY}
  if(UI.placing){updateGhost()}
  if(e.target===cv&&!UI.drag){const h=pickEntity(e.clientX,e.clientY);R.hover=h?h.id:null;updateCursor(h)}
  else if(e.target!==cv){R.hover=null}
}
function onMouseUp(e){
  if(R.editor){return edMouseUp(e)}
  if(UI.pan&&e.button===1){UI.pan=null;return}
  if(!inGame())return;
  if(UI.wallStart&&e.button===0){placeWallLine(e.shiftKey);return}
  if(UI.drag&&e.button===0){
    const d=UI.drag;UI.drag=null;
    const w=Math.abs(d.x2-d.x),h=Math.abs(d.y2-d.y);
    if(w<5&&h<5)clickSelect(e);else boxSelect(d);
  }
}
function updateCursor(h){
  let cur='default';const sel=selEnts();
  if(h&&sel.length&&sel[0].kind==='u'&&sel[0].owner===0){
    if(h.kind!=='r'&&isEnemy(0,h.owner))cur='crosshair';else if(h.kind==='r')cur='pointer';else if(h.owner===0)cur='pointer'}
  else if(h&&h.owner===0)cur='pointer';
  if(UI.mode||UI.placing)cur='crosshair';
  if(cur!==UI.cursor){UI.cursor=cur;cv.style.cursor=cur}
}
function clickSelect(e){
  const sx=e.clientX,sy=e.clientY;
  const h=pickEntity(sx,sy);
  const now=performance.now();
  if(!h){if(!e.shiftKey)setSel([]);return}
  // double click: select all same type on screen
  if(h.kind==='u'&&h.owner===0&&UI.lastClickId===h.id&&now-UI.lastClick<400){
    const ids=G.units.filter(u=>!u.dead&&!u.inside&&u.owner===0&&u.type===h.type&&entVisible(u)).filter(u=>{const[ux,uy]=toScr(u.x,u.y,u.z);return ux>0&&uy>0&&ux<VW&&uy<VH}).map(u=>u.id);
    setSel(ids);speak(selEnts(),'select');UI.lastClick=0;return}
  UI.lastClick=now;UI.lastClickId=h.id;
  if(e.shiftKey&&h.owner===0&&h.kind==='u'){const cur=selEnts().filter(x=>x.kind==='u');if(cur.length&&cur[0].owner===0){const i=UI.sel.indexOf(h.id);if(i>=0)UI.sel.splice(i,1);else UI.sel.push(h.id);setSel(UI.sel);return}}
  setSel([h.id]);
  if(h.owner===0&&h.kind==='u'||h.def&&h.def.k==='sheep'&&h.owner===0)speak([h],'select');
  else if(h.kind==='b'&&h.owner===0){if(window.AudioSys)AudioSys.sfx('click',{vol:.5})}
}
function boxSelect(d){
  const x0=Math.min(d.x,d.x2),x1=Math.max(d.x,d.x2),y0=Math.min(d.y,d.y2),y1=Math.max(d.y,d.y2);
  const ids=[];
  for(const u of G.units){if(u.dead||u.inside||u.owner!==0)continue;const[ux,uy]=toScr(u.x,u.y,u.z);const cy=uy-10*CAM.zoom;if(ux>=x0&&ux<=x1&&cy>=y0&&cy<=y1)ids.push(u.id)}
  let list=ids;
  if(d.shift){const cur=selEnts().filter(e=>e.kind==='u'&&e.owner===0).map(e=>e.id);list=Array.from(new Set(cur.concat(ids)))}
  // prefer non-sheep/ non-cobra? keep all; if mixed with military, drop villagers? keep AoE behaviour: all
  if(list.length>60)list=list.slice(0,60);
  if(list.length){setSel(list);speak(selEnts(),'select')}else if(!d.shift)setSel([]);
}
function selectIdle(mil){
  const list=G.units.filter(u=>!u.dead&&!u.inside&&u.owner===0&&u.t==='idle'&&(mil?(isMil(u)&&!u.def.cls.includes('ship')):u.def.k==='villager'));
  if(!list.length){toast(mil?'No idle military units':'No idle villagers');return}
  UI.idleIdx=(UI.idleIdx+1)%list.length;const u=list[UI.idleIdx];setSel([u.id]);centerOn(u.x,u.y);speak([u],'select');
}
function onMinimapDown(e){
  if(!G)return;const mc=$('minimap');const r=mc.getBoundingClientRect();
  const p=mmToWorld(mc,(e.clientX-r.left)*mc.width/r.width,(e.clientY-r.top)*mc.height/r.height);
  const x=clamp(p.x,0,G.W-1),y=clamp(p.y,0,G.H-1);
  if(e.button===2){const sel=selEnts().filter(u=>u.kind==='u'&&u.owner===0);if(sel.length){issueMove(sel,x,y);speak(sel,'move')}return}
  centerOn(x,y);clampCam();
  UI.mmDrag=true;const mv=ev=>{const q=mmToWorld(mc,(ev.clientX-r.left)*mc.width/r.width,(ev.clientY-r.top)*mc.height/r.height);centerOn(clamp(q.x,0,G.W-1),clamp(q.y,0,G.H-1));clampCam()};
  const up=()=>{window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up)};window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up);
}
// ---------- commands ----------
function formation(units,x,y){
  const n=units.length;if(n===1)return[[x,y]];
  const ship=units[0].def.cls.includes('ship');const sp=ship?2.2:0.95;const cols=Math.ceil(Math.sqrt(n));
  const out=[];for(let i=0;i<n;i++){const cx=i%cols,cy=Math.floor(i/cols);out.push([x+(cx-(cols-1)/2)*sp,y+(cy-(Math.ceil(n/cols)-1)/2)*sp])}
  return out;
}
function validDest(u,x,y){
  const ship=isShip(u);const tx=Math.floor(x),ty=Math.floor(y);
  if(tx<0||ty<0||tx>=G.W||ty>=G.H)return null;
  const k=ty*G.W+tx;
  if(ship){return G.terr[k]>=3?[x,y]:null}
  if(G.terr[k]<3&&!G.occ[k])return[x,y];
  return null;
}
function issueMove(units,x,y){
  const tx0=Math.floor(x),ty0=Math.floor(y);
  if(tx0>=0&&ty0>=0&&tx0<G.W&&ty0<G.H&&G.terr[ty0*G.W+tx0]<3){ // land click: loaded transports go and unload
    for(const u of units)if(isShip(u)&&u.cargo&&u.cargo.length)orderMove(u,x,y);
    units=units.filter(u=>!(isShip(u)&&u.cargo&&u.cargo.length));if(!units.length)return}
  const land=units.filter(u=>!isShip(u)),ships=units.filter(u=>isShip(u));
  for(const grp of[land,ships]){
    if(!grp.length)continue;
    const spots=formation(grp,x,y);
    grp.forEach((u,i)=>{
      let[px,py]=spots[i];
      if(!validDest(u,px,py)){const v=validDest(u,x,y);if(v){px=v[0];py=v[1]}else if(!isShip(u)){const f=freeNear(x,y,0,4);if(f){px=f.x;py=f.y}}else{const f=freeNear(x,y,0,6,true);if(f){px=f.x;py=f.y}}}
      orderMove(u,px,py);
    });
  }
}
function rightClick(e){
  if(UI.placing){UI.cancelPlace();return}
  if(UI.mode){UI.mode=null;updateModeInfo();return}
  const sel=selEnts();if(!sel.length)return;
  const w=scrToWorld(e.clientX,e.clientY);
  const tgt=pickEntity(e.clientX,e.clientY);
  // building rally point
  if(sel[0].kind==='b'&&sel[0].owner===0){
    for(const b of sel){if(b.owner===0&&(b.def.trains.length)){b.rally={x:w.x,y:w.y,tgt:tgt&&tgt.kind==='r'?tgt.id:(tgt&&tgt.kind==='u'&&tgt.def.animal?tgt.id:0)}}}
    mark(w.x,w.y,'#ffe070');if(window.AudioSys)AudioSys.sfx('click',{vol:.4});return}
  const units=sel.filter(u=>u.kind==='u'&&u.owner===0);if(!units.length)return;
  const x=clamp(w.x,0.2,G.W-0.2),y=clamp(w.y,0.2,G.H-0.2);
  let action='move',col='#7dff7d';
  if(tgt){
    if(tgt.kind==='b'||tgt.kind==='r'||tgt.kind==='u'){
      if(tgt.kind==='u'&&units.includes(tgt)){return}
      // cargo ship with land target handled in orderMove; otherwise smartOrder per unit
      const acts=new Set();
      for(const u of units){
        if(isShip(u)&&u.cargo&&u.cargo.length&&tgt.kind==='r'){orderMove(u,x,y);acts.add('move');continue}
        const a=smartOrder(u,tgt,x,y);acts.add(a)}
      action=acts.has('attack')?'attack':acts.has('build')?'build':acts.has('repair')?'repair':acts.has('gather')?'gather':acts.has('heal')?'heal':acts.has('garrison')?'garrison':acts.has('trade')?'trade':'move';
      if(action==='attack')col='#ff5a4a';
      const tx=tgt.kind==='b'?tgt.cx:tgt.kind==='r'?tgt.x+.5:tgt.x,ty=tgt.kind==='b'?tgt.cy:tgt.kind==='r'?tgt.y+.5:tgt.y;
      mark(tx,ty,col);
    }
  }else{
    issueMove(units,x,y);mark(x,y,col);
  }
  speak(units,action);
}
function doModeClick(e){
  const m=UI.mode;const sel=selEnts();const w=scrToWorld(e.clientX,e.clientY);const tgt=pickEntity(e.clientX,e.clientY);
  UI.mode=null;updateModeInfo();
  const units=sel.filter(u=>u.kind==='u'&&u.owner===0);
  if(m==='amove'){const sp=formation(units,w.x,w.y);units.forEach((u,i)=>{if(isMil(u)||u.type==='cobra')orderAttackMove(u,sp[i][0],sp[i][1]);else orderMove(u,sp[i][0],sp[i][1])});mark(w.x,w.y,'#ff9a4a');speak(units,'attack')}
  else if(m==='garrison'){if(tgt&&tgt.kind==='b'){let n=0;for(const u of units)if(canGarrison(u,tgt)){orderGarrison(u,tgt);n++}if(n){speak(units,'garrison');mark(tgt.cx,tgt.cy)}else toast('Cannot garrison there (full or not allowed)','warn')}else toast('Click a building','warn')}
  else if(m==='rally'){for(const b of sel)if(b.kind==='b'&&b.owner===0)b.rally={x:w.x,y:w.y,tgt:tgt&&(tgt.kind==='r')?tgt.id:0};mark(w.x,w.y,'#ffe070')}
  else if(m==='unload'){for(const u of units)if(u.cargo&&u.cargo.length)setCmd(u,'unloadat',0,w.x,w.y);mark(w.x,w.y)}
}
// ---------- placement ----------
function ghostTile(){
  const w=scrToWorld(UI.mouse.x,UI.mouse.y);const d=B[UI.placing.type];
  return[Math.floor(w.x)-Math.floor(d.sz/2),Math.floor(w.y)-Math.floor(d.sz/2)];
}
function updateGhost(){
  if(!UI.placing)return;
  const[x,y]=ghostTile();const p=G.players[0];const d=B[UI.placing.type];
  let why=canPlace(p,UI.placing.type,x,y);
  if(!why){let seen=false;for(let j=0;j<d.sz;j++)for(let i=0;i<d.sz;i++)if(exploredTile(clamp(x+i,0,G.W-1),clamp(y+j,0,G.H-1)))seen=true;if(!seen)why='You must explore this area first'}
  const tiles=[];
  if(why){for(let j=0;j<d.sz;j++)for(let i=0;i<d.sz;i++){const tx=x+i,ty=y+j;if(tx>=0&&ty>=0&&tx<G.W&&ty<G.H){const k=ty*G.W+tx;if(G.terr[k]>=3&&!d.dock||G.occ[k])tiles.push([tx,ty])}}}
  R.ghost={type:UI.placing.type,x,y,ok:!why,tiles,owner:0};UI.ghostWhy=why;
  const mi=$('modeinfo');if(why){mi.textContent='Cannot build here: '+why;mi.classList.remove('hidden')}else updateModeInfo();
}
function placeAtGhost(keep){
  updateGhost();const g=R.ghost;if(!g||!g.ok){if(window.AudioSys)AudioSys.sfx('error');return}
  const p=G.players[0];const builders=selEnts().filter(u=>u.kind==='u'&&u.owner===0&&u.def.k==='villager');
  const r=placeBuilding(p,g.type,g.x,g.y,builders);
  if(r.err){toast(r.err,'warn');return}
  if(builders.length)speak(builders,'build');
  if(!keep)UI.cancelPlace();else updateGhost();
}
function placeWallLine(keep){
  const a=UI.wallStart,b=ghostTile();UI.wallStart=null;if(!a)return;
  const type=UI.placing.type;const p=G.players[0];
  const dx=Math.abs(b[0]-a[0]),dy=Math.abs(b[1]-a[1]);const tiles=[];
  if(dx>=dy){const s=Math.sign(b[0]-a[0])||1;for(let x=a[0];x!==b[0]+s;x+=s)tiles.push([x,a[1]])}else{const s=Math.sign(b[1]-a[1])||1;for(let y=a[1];y!==b[1]+s;y+=s)tiles.push([a[0],y])}
  const builders=selEnts().filter(u=>u.kind==='u'&&u.owner===0&&u.def.k==='villager');
  let n=0,fail='';
  for(const[x,y]of tiles){const r=placeBuilding(p,type,x,y,builders);if(r.err){fail=r.err;if(/Not enough/.test(r.err))break}else n++}
  if(n&&builders.length)speak(builders,'build');
  if(!n&&fail)toast(fail,'warn');
  if(!keep)UI.cancelPlace();else{R.ghost=null;updateGhost()}
}
// ---------- keyboard ----------
function onKeyDown(e){
  const k=e.key.toLowerCase();
  if(R.editor){return edKey(e)}
  if(UI.typing)return;
  if(!inGame()){if(k==='escape')closeModal();return}
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'))return;
  if($('modal').classList.contains('hidden')===false){if(k==='escape')closeModal();return}
  UI.keys[k]=true;
  if(k==='enter'){openChat();e.preventDefault();return}
  if(k==='escape'){
    if(UI.placing||UI.mode){UI.cancelPlace();UI.mode=null;updateModeInfo();return}
    if(UI.menu!=='root'){UI.menu='root';uiRefresh(true);return}
    if(UI.sel.length){setSel([]);return}
    openPauseMenu();return}
  if(k==='f1'){openHelp(true);e.preventDefault();return}
  if(k==='delete'){deleteSelected();return}
  if(k==='h'){const tc=G.blds.find(b=>!b.dead&&b.owner===0&&b.type==='towncenter');if(tc){setSel([tc.id]);centerOn(tc.cx,tc.cy)}return}
  if(k==='.'){selectIdle(false);return}
  if(k===','){selectIdle(true);return}
  if(k===' '){e.preventDefault();if(UI.lastAlert)centerOn(UI.lastAlert.x,UI.lastAlert.y);else{const tc=G.blds.find(b=>!b.dead&&b.owner===0);if(tc)centerOn(tc.cx,tc.cy)}return}
  if(/^[0-9]$/.test(k)){
    if(e.ctrlKey||e.metaKey){UI.groups[k]=UI.sel.slice();toast('Group '+k+' set ('+UI.sel.length+')');e.preventDefault()}
    else if(UI.groups[k]){const ids=UI.groups[k].filter(id=>{const x=G.byId.get(id);return x&&!x.dead});if(ids.length){const same=UI.sel.join()===ids.join();setSel(ids);if(same||UI.lastGroup===k&&performance.now()-UI.lastGroupT<500){const u=G.byId.get(ids[0]);centerOn(u.x!==undefined&&u.kind==='u'?u.x:u.cx,u.kind==='u'?u.y:u.cy)}UI.lastGroup=k;UI.lastGroupT=performance.now();speak(selEnts(),'select')}}
    return}
  if(k==='+'||k==='='){zoomAt(1.12,VW/2,VH/2);return}if(k==='-'){zoomAt(1/1.12,VW/2,VH/2);return}
  const idx=KEYS.indexOf(k);
  if(idx>=0&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const slot=UI.slots&&UI.slots[idx];if(slot&&slot.onClick){slot.onClick(e);e.preventDefault()}}
}
function deleteSelected(){
  const sel=selEnts().filter(e=>e.owner===0&&!(e.kind==='u'&&e.def.animal&&false));
  if(!sel.length)return;
  for(const e of sel)deleteEntity(e);setSel([]);
}
// ---------- chat / cheats ----------
function openChat(){UI.typing=true;$('chatwrap').classList.remove('hidden');const i=$('chatinput');i.value='';i.focus();UI.keys={}}
function closeChat(){UI.typing=false;$('chatwrap').classList.add('hidden');$('chatinput').blur()}
function onChatKey(e){
  e.stopPropagation();
  if(e.key==='Escape'){closeChat();e.preventDefault();return}
  if(e.key==='Enter'){
    const t=$('chatinput').value.trim();closeChat();e.preventDefault();
    if(!t)return;
    const r=runCheat(t);
    if(r.kind==='chat'){chatLine(G.players[0].name+': '+t)}
    else{chatLine((r.ok?'✔ ':'✖ ')+r.text,r.ok?'ok':'no');if(r.ok){if(window.AudioSys)AudioSys.sfx('cheat');toast(r.text,'good')}else{toast(r.text,'warn');if(window.AudioSys)AudioSys.sfx('error')}}
    uiRefresh(true);
  }
}
// ---------- per-frame ----------
function uiUpdate(dt){
  // camera pan
  const sp=900/CAM.zoom*dt;let dx=0,dy=0;
  if(!UI.typing&&$('modal').classList.contains('hidden')){
    if(UI.keys['arrowleft'])dx-=1;if(UI.keys['arrowright'])dx+=1;if(UI.keys['arrowup'])dy-=1;if(UI.keys['arrowdown'])dy+=1;
    const m=UI.mouse;if(m.x<=2&&UI.edge)dx-=1;if(m.x>=VW-3&&UI.edge)dx+=1;if(m.y<=2&&UI.edge)dy-=1;
  }
  if(dx||dy){CAM.x+=dx*sp;CAM.y+=dy*sp*0.6;clampCam()}
  for(const m of R.marks)m.t+=dt;R.marks=R.marks.filter(m=>m.t<0.9);
  for(const f of R.floats)f.t+=dt;R.floats=R.floats.filter(f=>f.t<1.4);
  UI.hudTimer-=dt;UI.cardTimer-=dt;
  if(UI.hudTimer<=0){UI.hudTimer=0.15;updateTopbar()}
  if(UI.cardTimer<=0){UI.cardTimer=0.2;uiRefresh(false)}
  // tips
  if(G.settings.tips){UI.tipT+=dt;if(UI.tipT>(UI.tipIdx===0?6:45)&&UI.tipIdx<TIPS.length){UI.tipT=0;$('tiptext').textContent='Tip: '+TIPS[UI.tipIdx++];$('tipbox').classList.remove('hidden');setTimeout(()=>$('tipbox').classList.add('hidden'),14000)}}
}
function updateTopbar(){
  const p=G.players[0];
  for(const k of RK){const el=$('r-'+k);el.querySelector('span').textContent=Math.floor(p.res[k]);}
  const pe=$('r-pop');pe.querySelector('span').textContent=p.pop+'/'+p.popCap;pe.classList.toggle('low',p.pop>=p.popCap);
  $('agelabel').textContent=AGES[p.age]+' · '+p.civd.n;
  const t=Math.floor(G.time);$('clock').textContent=Math.floor(t/60)+':'+String(t%60).padStart(2,'0')+'  ×'+G.speed;
  const bell=$('tb-bell');bell.textContent=p.bell?'🔔 Bell ON (click to release)':'🔔 Town Bell';bell.id='tb-bell';bell.style.background=p.bell?'#a04a2a':'';
  // idle villagers count
  let idle=0;for(const u of G.units)if(!u.dead&&!u.inside&&u.owner===0&&u.def.k==='villager'&&u.t==='idle'&&!u.bell)idle++;
  $('tb-idle').textContent='Idle: '+idle;
}
