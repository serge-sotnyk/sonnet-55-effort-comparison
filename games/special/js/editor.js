'use strict';
// ===== Map editor =====
const EDITOR={md:null,tool:'terrain',brush:2,owner:0,pal:{terrain:T_GRASS,elev:'raise',obj:null},undo:[],redo:[],painting:false,selObj:null,drag:null,lastTile:null,name:'My Map',status:'',dirty:false};
const ED_RES=['tree','pine','palm','shrub','berries','gold','stone','fish','relic'];
const ED_ANIMALS=['sheep','deer','boar','wolf'];
const ED_BLD=['towncenter','house','mill','lumber','mining','farm','dock','market','barracks','archery','stable','blacksmith','monastery','university','siege','castle','tower','wall','gate'];
const ED_UNITS=['villager','militia','spearman','archer','skirm','scout','knight','cavarcher','monk','ram','mangonel','trebuchet','cobra'];
const ED_SHIPS=['fishing','transport','galley','fireship','demoraft','tradecog'];
const ED_TOOLS=[['terrain','Terrain'],['elev','Elevation'],['place','Place'],['erase','Erase'],['select','Select / Move'],['start','Start flag']];
const ED_RESNAME={tree:'Oak tree',pine:'Pine tree',palm:'Palm',shrub:'Shrub (forage)',berries:'Berries',gold:'Gold',stone:'Stone',fish:'Fish',relic:'Relic'};
function initEditor(){
  const tl=$('ed-tools');ED_TOOLS.forEach(([k,n])=>{const b=document.createElement('button');b.textContent=n;b.dataset.t=k;b.onclick=()=>{EDITOR.tool=k;edRefreshUI()};tl.appendChild(b)});
  $('ed-bs').oninput=()=>{EDITOR.brush=+$('ed-bs').value;$('ed-bsv').textContent=EDITOR.brush};
  $('ed-new').onclick=edNewDialog;$('ed-save').onclick=edSaveDialog;$('ed-load').onclick=edLoadDialog;
  $('ed-export').onclick=edExport;$('ed-import').onclick=()=>$('ed-file').click();$('ed-file').onchange=edImport;
  $('ed-undo').onclick=edUndo;$('ed-redo').onclick=edRedo;$('ed-validate').onclick=()=>{const e=validateMap(EDITOR.md);edStatus(e.length?e.length+' problem(s) – see list':'Map is valid and playable',!e.length);if(e.length)edShowErrors(e);else toast('Map is valid ✔','good')};
  $('ed-play').onclick=edPlay;$('ed-exit').onclick=()=>{edAutosave();R.editor=false;$('editor').classList.add('hidden');R.extraDraw=null;show('menu')};
  window.EDITOR=EDITOR;
}
function edStatus(t,good){const s=$('ed-status');s.textContent=t;s.style.color=good?'#9be58a':'#ffd890'}
function openEditor(restore){
  $('menu').classList.add('hidden');$('setup').classList.add('hidden');$('hud').classList.add('hidden');
  if(!EDITOR.md){
    let saved=null;try{saved=JSON.parse(localStorage.getItem('aor_editor_autosave')||'null')}catch(e){}
    if(saved&&restore!==false&&saved.w){EDITOR.md=mdFromJSON(saved);EDITOR.md.custom=true;EDITOR.name=saved.name||'My Map'}
    else{edNewDialog(true);return}
  }
  edEnter();
}
function edEnter(){
  R.editor=true;$('editor').classList.remove('hidden');
  edBuildWorld();edRefreshUI();R.extraDraw=edDrawOverlay;
  const s=EDITOR.md.starts.find(Boolean);centerOn(s?s.x:EDITOR.md.w/2,s?s.y:EDITOR.md.h/2);CAM.zoom=0.8;clampCam();
  edStatus('Editing "'+EDITOR.name+'"',true);
}
function edAutosave(){if(!EDITOR.md)return;try{const j=mdToJSON(EDITOR.md);j.name=EDITOR.name;localStorage.setItem('aor_editor_autosave',JSON.stringify(j))}catch(e){}}
// ---------- world mirror ----------
function edBuildWorld(){
  const md=EDITOR.md,N=md.w;
  const prevCam=null;
  G={W:N,H:N,terr:md.terr,hgt:md.hgt,occ:new Int32Array(N*N),ents:[],units:[],blds:[],ress:[],byId:new Map(),nid:0,players:[],dip:[],time:0,speed:1,paused:true,settings:{players:[],visibility:'all'},md,fx:[],proj:[],grid:null,cheats:{allowed:false,aegis:false,polo:true,marco:true},over:null,decals:[],_edit:true,visNow:new Uint8Array(N*N).fill(2),region:null,lastCombat:-99,stats:{}};
  for(let i=0;i<4;i++){const p=newPlayerState(i,'Player '+(i+1),'britons',PCOLORS[i].c,i>0,i);p.exp=new Uint8Array(N*N).fill(1);p.start={x:N/2,y:N/2};G.players.push(p)}
  for(let i=0;i<4;i++){G.dip.push([]);for(let j=0;j<4;j++)G.dip[i][j]=i===j?'self':'enemy'}
  for(const o of md.objs){
    let e=null;
    if(o.k==='res')e=mkRes(o.t,o.x,o.y);
    else if(o.k==='animal'||o.k==='unit'){e=mkUnit(o.t,o.k==='animal'?-1:Math.min(o.o,3),o.x+.5,o.y+.5)}
    else if(o.k==='bld')e=mkBld(o.t,Math.min(Math.max(o.o,0),3),o.x,o.y,true);
    if(e){e.obj=o;if(e.kind==='u'){e.fx=0.7;e.fy=0.7;e.mh=e.hp}}
  }
  buildGrid();renderInit();
  EDITOR.world=G;
}
function edRebuild(){const keep=EDITOR.selObj;edBuildWorld();EDITOR.selObj=keep;R.extraDraw=edDrawOverlay}
function edTerrainChanged(){
  // refresh derived render data
  const W=G.W,H=G.H;R.dland.fill(99);const q=[];for(let i=0;i<W*H;i++)if(G.terr[i]<3){R.dland[i]=0;q.push(i)}
  for(let h=0;h<q.length;h++){const i=q[h],x=i%W,y=(i/W)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const j=Y*W+X;if(R.dland[j]>R.dland[i]+1){R.dland[j]=R.dland[i]+1;q.push(j)}}}
  rebuildTileColors();
}
// ---------- undo/redo ----------
function edSnap(){const md=EDITOR.md;return{terr:new Uint8Array(md.terr),hgt:new Uint8Array(md.hgt),objs:md.objs.map(o=>Object.assign({},o)),starts:md.starts.map(s=>s?{x:s.x,y:s.y}:null),np:md.np}}
function edPush(){EDITOR.undo.push(edSnap());if(EDITOR.undo.length>60)EDITOR.undo.shift();EDITOR.redo=[];EDITOR.dirty=true}
function edRestore(s){const md=EDITOR.md;md.terr.set(s.terr);md.hgt.set(s.hgt);md.objs=s.objs.map(o=>Object.assign({},o));md.starts=s.starts.map(x=>x?{x:x.x,y:x.y}:null);md.np=s.np;EDITOR.selObj=null;edRebuild();edTerrainChanged();edRefreshUI()}
function edUndo(){if(!EDITOR.undo.length){edStatus('Nothing to undo');return}EDITOR.redo.push(edSnap());edRestore(EDITOR.undo.pop());edStatus('Undo ('+EDITOR.undo.length+' left)',true)}
function edRedo(){if(!EDITOR.redo.length){edStatus('Nothing to redo');return}EDITOR.undo.push(edSnap());edRestore(EDITOR.redo.pop());edStatus('Redo',true)}
// ---------- UI ----------
function edRefreshUI(){
  $('ed-tools').querySelectorAll('button').forEach(b=>b.classList.toggle('sel',b.dataset.t===EDITOR.tool));
  const pal=$('ed-palette');pal.innerHTML='';
  const mk=(icon,label,sel,fn,bg)=>{const d=document.createElement('div');d.className='pal'+(sel?' sel':'');if(icon)d.style.backgroundImage='url('+icon+')';if(bg)d.style.background=bg;d.innerHTML='<span>'+label+'</span>';d.title=label;d.onclick=fn;pal.appendChild(d)};
  const head=t=>{const h=document.createElement('div');h.style.cssText='width:100%;font-size:11px;color:#c9a24a;margin:4px 0 0';h.textContent=t;pal.appendChild(h)};
  if(EDITOR.tool==='terrain'){const cols=['#68a042','#a88658','#e4d296','#58b0cc','#2f6aa0'];TERRAIN_NAMES.forEach((n,i)=>mk(null,n,EDITOR.pal.terrain===i,()=>{EDITOR.pal.terrain=i;edRefreshUI()},cols[i]))}
  else if(EDITOR.tool==='elev'){
    for(const[k,n]of[['raise','Raise +1'],['lower','Lower −1'],['0','Level 0'],['1','Level 1'],['2','Level 2'],['3','Level 3'],['smooth','Smooth']])mk(null,n,EDITOR.pal.elev===k,()=>{EDITOR.pal.elev=k;edRefreshUI()},k==='raise'?'#6a8a3c':k==='lower'?'#5a4a3a':'#7a6a50')}
  else if(EDITOR.tool==='place'){
    head('Resources');for(const t of ED_RES)mk(resIcon({type:t}),ED_RESNAME[t],EDITOR.pal.obj&&EDITOR.pal.obj.t===t,()=>{EDITOR.pal.obj={k:'res',t};edRefreshUI()});
    head('Animals');for(const t of ED_ANIMALS)mk(iconURL('unit',t),U[t].n,EDITOR.pal.obj&&EDITOR.pal.obj.t===t,()=>{EDITOR.pal.obj={k:'animal',t};edRefreshUI()});
    head('Buildings (owner)');for(const t of ED_BLD)mk(iconURL('bld',t),B[t].n,EDITOR.pal.obj&&EDITOR.pal.obj.t===t,()=>{EDITOR.pal.obj={k:'bld',t};edRefreshUI()});
    head('Land units (owner)');for(const t of ED_UNITS)mk(iconURL('unit',t),U[t].n,EDITOR.pal.obj&&EDITOR.pal.obj.t===t,()=>{EDITOR.pal.obj={k:'unit',t};edRefreshUI()});
    head('Ships (water only)');for(const t of ED_SHIPS)mk(iconURL('unit',t),U[t].n,EDITOR.pal.obj&&EDITOR.pal.obj.t===t,()=>{EDITOR.pal.obj={k:'unit',t};edRefreshUI()});
  }
  const needsOwner=EDITOR.tool==='start'||(EDITOR.tool==='place'&&EDITOR.pal.obj&&(EDITOR.pal.obj.k==='bld'||EDITOR.pal.obj.k==='unit'));
  $('ed-ownerbox').style.display=needsOwner?'':'none';
  const ob=$('ed-owners');ob.innerHTML='';
  for(let i=0;i<EDITOR.md.np;i++){const d=document.createElement('span');d.className='own'+(EDITOR.owner===i?' sel':'');d.style.borderColor=PCOLORS[i].c;d.textContent=(i===0?'P1 (you)':'P'+(i+1)+' AI');d.onclick=()=>{EDITOR.owner=i;edRefreshUI()};ob.appendChild(d)}
  if(EDITOR.owner>=EDITOR.md.np)EDITOR.owner=0;
  // players panel
  const pp=$('ed-players');pp.innerHTML='';
  for(let i=0;i<EDITOR.md.np;i++){
    const hasTC=EDITOR.md.objs.some(o=>o.k==='bld'&&o.t==='towncenter'&&o.o===i);const s=EDITOR.md.starts[i];
    const d=document.createElement('div');d.className='ped';d.innerHTML='<span class="dot" style="background:'+PCOLORS[i].c+'"></span><b>'+(i===0?'Human':'Computer '+i)+'</b> '+(s?'<span style="color:#9be58a">start ✔</span>':hasTC?'<span style="color:#9be58a">TC ✔</span>':'<span style="color:#ff9a7a">no start</span>');
    pp.appendChild(d);
  }
  const row=document.createElement('div');row.className='ped';
  const add=document.createElement('button');add.textContent='+ Computer';add.disabled=EDITOR.md.np>=4;add.onclick=()=>{edPush();EDITOR.md.np++;edRefreshUI();edStatus('Added computer player '+(EDITOR.md.np-1),true)};
  const rem=document.createElement('button');rem.textContent='− Computer';rem.disabled=EDITOR.md.np<=2;rem.onclick=()=>{edPush();const n=EDITOR.md.np-1;EDITOR.md.np--;EDITOR.md.starts.length=Math.min(EDITOR.md.starts.length,EDITOR.md.np);EDITOR.md.objs=EDITOR.md.objs.filter(o=>!((o.k==='bld'||o.k==='unit')&&o.o>=EDITOR.md.np));edRebuild();edRefreshUI();edStatus('Removed player '+(n+1)+' and their objects',true)};
  const auto=document.createElement('button');auto.textContent='Auto starts';auto.title='Place missing start flags on suitable land';auto.onclick=edAutoStarts;
  row.append(add,rem,auto);pp.appendChild(row);
  const cur=$('ed-cur');let ic='',nm='';
  if(EDITOR.tool==='terrain'){nm='Terrain: '+TERRAIN_NAMES[EDITOR.pal.terrain]}
  else if(EDITOR.tool==='elev'){nm='Elevation: '+EDITOR.pal.elev}
  else if(EDITOR.tool==='place'){const o=EDITOR.pal.obj;if(o){nm='Placing: '+(o.k==='res'?ED_RESNAME[o.t]:o.k==='bld'?B[o.t].n:U[o.t].n)+(o.k==='bld'||o.k==='unit'?' – owner P'+(EDITOR.owner+1):'');ic=o.k==='res'?resIcon({type:o.t}):o.k==='bld'?iconURL('bld',o.t):iconURL('unit',o.t)}else nm='Pick an object from the palette'}
  else if(EDITOR.tool==='erase')nm='Erase objects (brush size applies)';
  else if(EDITOR.tool==='select')nm='Select / move / delete (Delete key)'+(EDITOR.selObj?' – selected: '+edObjName(EDITOR.selObj):'');
  else if(EDITOR.tool==='start')nm='Click to place the start location flag of P'+(EDITOR.owner+1);
  cur.innerHTML=(ic?'<img src="'+ic+'">':'')+'<span>'+nm+'</span>';
  $('ed-hint').textContent='Left-drag: apply tool · Right/middle-drag: pan · Wheel: zoom · Ctrl+Z / Ctrl+Y: undo / redo · [ ]: brush size · Delete: remove selected';
}
function edObjName(o){return o.k==='res'?ED_RESNAME[o.t]||o.t:o.k==='bld'?B[o.t].n:U[o.t].n}
// ---------- tool application ----------
function edTile(e){const w=scrToWorld(e.clientX,e.clientY);return{x:Math.floor(w.x),y:Math.floor(w.y),fx:w.x,fy:w.y}}
function edMouseDown(e){
  if(e.target!==cv)return;
  if(e.button===1||e.button===2){EDITOR.pan={x:e.clientX,y:e.clientY,cx:CAM.x,cy:CAM.y};e.preventDefault();return}
  if(e.button!==0)return;
  const t=edTile(e);const md=EDITOR.md;if(t.x<0||t.y<0||t.x>=md.w||t.y>=md.h)return;
  EDITOR.painting=true;EDITOR.lastTile=null;EDITOR.pushed=false;
  const tool=EDITOR.tool;
  if(tool==='select'){
    const ent=pickEntity(e.clientX,e.clientY);EDITOR.selObj=ent&&ent.obj?ent.obj:null;
    if(EDITOR.selObj){EDITOR.drag={obj:EDITOR.selObj,sx:EDITOR.selObj.x,sy:EDITOR.selObj.y,off:{x:t.x-EDITOR.selObj.x,y:t.y-EDITOR.selObj.y},moved:false}}
    edRefreshUI();return}
  edApply(t,e);
}
function edMouseMove(e){
  if(EDITOR.pan){CAM.x=EDITOR.pan.cx-(e.clientX-EDITOR.pan.x)/CAM.zoom;CAM.y=EDITOR.pan.cy-(e.clientY-EDITOR.pan.y)/CAM.zoom;clampCam();return}
  UI.mouse={x:e.clientX,y:e.clientY};
  if(e.target!==cv&&!EDITOR.painting){EDITOR.hoverTile=null;return}
  const t=edTile(e);EDITOR.hoverTile=t;
  if(EDITOR.painting){
    if(EDITOR.tool==='select'&&EDITOR.drag){
      const d=EDITOR.drag;const nx=t.x-d.off.x,ny=t.y-d.off.y;
      if(nx!==d.obj.x||ny!==d.obj.y){if(!d.moved){edPush();d.moved=true}
        // move start flag together with TC
        d.obj.x=clamp(nx,0,EDITOR.md.w-1);d.obj.y=clamp(ny,0,EDITOR.md.h-1);edRebuild()}
      return}
    edApply(t,e);
  }
}
function edMouseUp(e){
  if(EDITOR.pan&&(e.button===1||e.button===2)){EDITOR.pan=null;return}
  if(EDITOR.painting){EDITOR.painting=false;
    if(EDITOR.drag&&EDITOR.drag.moved){const o=EDITOR.drag.obj;
      // keep start flag with its TC
      if(o.k==='bld'&&o.t==='towncenter'){const s=EDITOR.md.starts[o.o];const old={x:EDITOR.drag.sx+2,y:EDITOR.drag.sy+2};if(s&&Math.abs(s.x-old.x)<=2&&Math.abs(s.y-old.y)<=2){EDITOR.md.starts[o.o]={x:o.x+2,y:o.y+2}}}
      edStatus('Moved '+edObjName(o),true)}
    EDITOR.drag=null;edAutosave()}
}
function brushTiles(cx,cy){
  const r=EDITOR.brush,out=[];const md=EDITOR.md;
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){if(x<0||y<0||x>=md.w||y>=md.h)continue;if(hyp(x-cx,y-cy)<=r-0.4+(r===1?0.5:0))out.push([x,y])}
  return out;
}
function edApply(t,e){
  const md=EDITOR.md,tool=EDITOR.tool;
  const key=t.x+','+t.y;
  if(tool==='terrain'||tool==='elev'){
    if(EDITOR.lastTile===key)return;EDITOR.lastTile=key;
    if(!EDITOR.pushed){edPush();EDITOR.pushed=true}
    const tiles=brushTiles(t.x,t.y);
    if(tool==='terrain'){const ty=EDITOR.pal.terrain;for(const[x,y]of tiles){const i=y*md.w+x;md.terr[i]=ty;if(ty>=3)md.hgt[i]=0}}
    else{
      const m=EDITOR.pal.elev;
      if(m==='smooth'){const avg=[];for(const[x,y]of tiles){let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<md.w&&Y<md.h&&md.terr[Y*md.w+X]<3){s+=md.hgt[Y*md.w+X];n++}}avg.push(n?Math.round(s/n):0)}tiles.forEach(([x,y],k)=>{if(md.terr[y*md.w+x]<3)md.hgt[y*md.w+x]=avg[k]})}
      else for(const[x,y]of tiles){const i=y*md.w+x;if(md.terr[i]>=3)continue;let h=md.hgt[i];if(m==='raise')h=Math.min(3,h+1);else if(m==='lower')h=Math.max(0,h-1);else h=+m;md.hgt[i]=h}
      // limit: one raise per stroke per tile to avoid runaway
    }
    EDITOR.painted=true;edTerrainChanged();edStatus(tool==='terrain'?'Painting '+TERRAIN_NAMES[EDITOR.pal.terrain]:'Elevation: '+EDITOR.pal.elev,true);
    if(tool==='elev'&&(EDITOR.pal.elev==='raise'||EDITOR.pal.elev==='lower')){EDITOR.lastTile=key}
    return;
  }
  if(tool==='erase'){
    if(EDITOR.lastTile===key)return;EDITOR.lastTile=key;
    const set=new Set(brushTiles(t.x,t.y).map(p=>p[0]+','+p[1]));
    const before=md.objs.length;
    const keep=md.objs.filter(o=>{
      const sz=o.k==='bld'?B[o.t].sz:1;
      for(let j=0;j<sz;j++)for(let i=0;i<sz;i++)if(set.has((o.x+i)+','+(o.y+j)))return false;return true});
    if(keep.length!==before){if(!EDITOR.pushed){edPush();EDITOR.pushed=true}md.objs=keep;edRebuild();edStatus('Erased '+(before-keep.length)+' object(s)',true)}
    // erase start flags
    md.starts.forEach((s,i)=>{if(s&&set.has(s.x+','+s.y)){if(!EDITOR.pushed){edPush();EDITOR.pushed=true}md.starts[i]=null;edRefreshUI()}});
    return;
  }
  if(tool==='start'){
    if(!EDITOR.pushed){edPush();EDITOR.pushed=true}
    const i=md.terr[t.y*md.w+t.x];if(i>=3){edStatus('Start locations must be on land');return}
    md.starts[EDITOR.owner]={x:t.x,y:t.y};edRefreshUI();edStatus('P'+(EDITOR.owner+1)+' start set at '+t.x+','+t.y+(EDITOR.owner<md.np?'':' (player not in match)'),true);return}
  if(tool==='place'){
    const o=EDITOR.pal.obj;if(!o){edStatus('Pick an object from the palette first');return}
    if(EDITOR.lastTile===key)return;EDITOR.lastTile=key;
    const multi=(o.k==='res'||o.k==='animal')&&EDITOR.brush>1;
    const tiles=multi?brushTiles(t.x,t.y).filter(()=>Math.random()<0.4):[[t.x,t.y]];
    let placed=0,why='';
    for(const[x,y]of tiles){
      const obj={k:o.k,t:o.t,x:x,y:y,o:o.k==='res'||o.k==='animal'?-1:EDITOR.owner};
      if(o.k==='bld'){const sz=B[o.t].sz;obj.x=x-Math.floor(sz/2);obj.y=y-Math.floor(sz/2)}
      const w=edCheckPlace(obj);
      if(w){why=w;continue}
      if(!EDITOR.pushed){edPush();EDITOR.pushed=true}
      md.objs.push(obj);placed++;
      if(o.k==='bld'&&o.t==='towncenter'&&!md.starts[obj.o])md.starts[obj.o]={x:obj.x+2,y:obj.y+2};
    }
    if(placed){edRebuild();edRefreshUI();edStatus('Placed '+placed+' × '+(o.k==='res'?ED_RESNAME[o.t]:o.k==='bld'?B[o.t].n:U[o.t].n),true)}
    else if(why)edStatus('Cannot place: '+why);
  }
}
function edOccupied(md,ignore){
  const occ=new Map();
  for(const o of md.objs){if(o===ignore)continue;const sz=o.k==='bld'?B[o.t].sz:1;
    for(let j=0;j<sz;j++)for(let i=0;i<sz;i++){const k=(o.y+j)*md.w+o.x+i;if(!occ.has(k))occ.set(k,[]);occ.get(k).push(o)}}
  return occ;
}
function objIsShip(o){return o.k==='unit'&&U[o.t].cls.includes('ship')}
function objIsWaterThing(o){return o.k==='res'&&o.t==='fish'||objIsShip(o)}
function edCheckPlace(obj){
  const md=EDITOR.md;const sz=obj.k==='bld'?B[obj.t].sz:1;
  for(let j=0;j<sz;j++)for(let i=0;i<sz;i++){const x=obj.x+i,y=obj.y+j;if(x<0||y<0||x>=md.w||y>=md.h)return'outside the map'}
  const occ=edOccupied(md);
  for(let j=0;j<sz;j++)for(let i=0;i<sz;i++){
    const x=obj.x+i,y=obj.y+j,k=y*md.w+x,t=md.terr[k];
    const list=occ.get(k)||[];
    if(objIsWaterThing(obj)){if(t<3)return'fish and ships need water'}
    else if(obj.k==='bld'){if(t>=3)return B[obj.t].dock&&false?'':'buildings need land (docks go on the shore)'}
    else{if(t>=3)return'land objects cannot be placed on water'}
    for(const o of list){
      const wa=objIsWaterThing(o);const wb=objIsWaterThing(obj);
      if(wa!==wb)continue;
      // allow unit on same tile as another unit? no
      return'overlaps '+edObjName(o);
    }
  }
  if(obj.k==='bld'&&B[obj.t].dock){let adj=0;for(let j=-1;j<=sz;j++)for(let i=-1;i<=sz;i++){const x=obj.x+i,y=obj.y+j;if(x>=0&&y>=0&&x<md.w&&y<md.h&&md.terr[y*md.w+x]>=3)adj++}if(adj<3)return'docks must touch water at the shoreline'}
  if(obj.k==='bld'){let mn=9,mx=0;for(let j=0;j<sz;j++)for(let i=0;i<sz;i++){const h=md.hgt[(obj.y+j)*md.w+obj.x+i];mn=Math.min(mn,h);mx=Math.max(mx,h)}if(mx-mn>1)return'ground too uneven for a building'}
  return'';
}
// ---------- validation ----------
function validateMap(md){
  const errs=[];const N=md.w;
  if(md.np<2)errs.push('At least one human and one computer player are required.');
  for(let i=0;i<md.np;i++){
    const tc=md.objs.find(o=>o.k==='bld'&&o.t==='towncenter'&&o.o===i);const s=md.starts[i]||(tc?{x:tc.x+2,y:tc.y+2}:null);
    if(!s)errs.push('Player '+(i+1)+' has no start location or Town Center.');
    else{
      if(s.x<0||s.y<0||s.x>=N||s.y>=N||md.terr[s.y*N+s.x]>=3)errs.push('Player '+(i+1)+' start location ('+s.x+','+s.y+') is on water.');
      else if(!tc){ // area for auto TC must be land
        let water=0;for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const X=s.x+x,Y=s.y+y;if(X<0||Y<0||X>=N||Y>=N||md.terr[Y*N+X]>=3)water++}
        if(water>0)errs.push('Player '+(i+1)+' start ('+s.x+','+s.y+') needs a 5×5 area of land for the Town Center.');}
    }
  }
  // overlaps
  const occ=new Map();
  const tileKey=(x,y)=>y*N+x;
  for(const o of md.objs){
    const sz=o.k==='bld'?B[o.t].sz:1;
    if((o.k==='bld'||o.k==='unit')&&o.o>=md.np)errs.push(edObjName(o)+' at ('+o.x+','+o.y+') belongs to player '+(o.o+1)+' who is not in the match.');
    for(let j=0;j<sz;j++)for(let i=0;i<sz;i++){
      const x=o.x+i,y=o.y+j;
      if(x<0||y<0||x>=N||y>=N){errs.push(edObjName(o)+' at ('+o.x+','+o.y+') is outside the map.');continue}
      const t=md.terr[tileKey(x,y)];
      if(objIsWaterThing(o)){if(t<3){errs.push((o.t==='fish'?'Fish':'Ship ('+U[o.t].n+')')+' at ('+x+','+y+') is on land.');}}
      else if(o.k==='bld'){if(t>=3)errs.push(B[o.t].n+' at ('+x+','+y+') is on water.')}
      else if(t>=3)errs.push(edObjName(o)+' at ('+x+','+y+') is on water.');
      const k=tileKey(x,y);const list=occ.get(k);
      if(list){for(const p of list){if(objIsWaterThing(p)===objIsWaterThing(o))errs.push(edObjName(o)+' overlaps '+edObjName(p)+' at ('+x+','+y+').')}list.push(o)}else occ.set(k,[o]);
    }
    if(o.k==='bld'&&B[o.t].dock){let adj=0;for(let j=-1;j<=sz;j++)for(let i=-1;i<=sz;i++){const x=o.x+i,y=o.y+j;if(x>=0&&y>=0&&x<N&&y<N&&md.terr[tileKey(x,y)]>=3)adj++}if(adj<3)errs.push('Dock at ('+o.x+','+o.y+') is not on a shoreline.')}
    if(o.k==='bld'){let mn=9,mx=0;for(let j=0;j<sz;j++)for(let i=0;i<sz;i++){const h=md.hgt[tileKey(Math.min(N-1,o.x+i),Math.min(N-1,o.y+j))];mn=Math.min(mn,h);mx=Math.max(mx,h)}if(mx-mn>1)errs.push(B[o.t].n+' at ('+o.x+','+o.y+') sits on a cliff/uneven ground.')}
  }
  // start areas blocked by objects
  for(let i=0;i<md.np;i++){const s=md.starts[i];if(!s)continue;const tc=md.objs.find(o=>o.k==='bld'&&o.t==='towncenter'&&o.o===i);if(tc)continue;
    for(const o of md.objs){if(o.k!=='bld'&&o.k!=='res')continue;const sz=o.k==='bld'?B[o.t].sz:1;if(o.k==='res'&&(o.t==='fish'))continue;
      if(o.k==='bld'&&o.x<s.x+3&&o.x+sz>s.x-3&&o.y<s.y+3&&o.y+sz>s.y-3)errs.push('A '+B[o.t].n+' overlaps the start area of player '+(i+1)+'.')}}
  return Array.from(new Set(errs)).slice(0,40);
}
function edShowErrors(errs){
  openModal('<h2>Map problems</h2><p>Fix these before launching a match:</p><ul>'+errs.map(e=>'<li>'+e+'</li>').join('')+'</ul><div class="btnrow"><span></span><button id="er-ok" class="gold">OK</button></div>',{noPause:true});$('er-ok').onclick=()=>{$('modal').classList.add('hidden')};
}
function edAutoStarts(){
  const md=EDITOR.md;edPush();const ps=startPositions(md.w,md.np,'arabia');let n=0;
  for(let i=0;i<md.np;i++){if(md.starts[i])continue;
    // find nearest valid land spot
    const p=ps[i];let best=null;
    for(let r=0;r<md.w&&!best;r++){for(let dy=-r;dy<=r&&!best;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=p.x+dx,y=p.y+dy;if(x<3||y<3||x>=md.w-3||y>=md.h-3)continue;
      let ok=true;for(let j=-2;j<=2&&ok;j++)for(let k=-2;k<=2;k++)if(md.terr[(y+j)*md.w+x+k]>=3){ok=false;break}if(ok){best={x,y};break}}}
    if(best){md.starts[i]=best;n++}}
  edRefreshUI();edStatus('Auto-placed '+n+' start location(s)',n>0);
}
// ---------- save / load / export ----------
function edSaveDialog(){
  openModal('<h2>Save map</h2><div class="mrow"><label>Name</label><input id="sv-name" value="'+EDITOR.name.replace(/"/g,'')+'" maxlength="30"></div><div class="btnrow"><button id="sv-cancel">Cancel</button><button id="sv-ok" class="gold">Save</button></div>',{noPause:true});
  $('sv-ok').onclick=()=>{const n=$('sv-name').value.trim()||'My Map';EDITOR.name=n;const maps=loadMaps();const j=mdToJSON(EDITOR.md);j.name=n;maps[n]=j;try{saveMaps(maps);edAutosave();$('modal').classList.add('hidden');edStatus('Saved "'+n+'"',true);toast('Map saved: '+n,'good')}catch(e){toast('Save failed: '+e.message,'warn')}};
  $('sv-cancel').onclick=()=>$('modal').classList.add('hidden');
}
function edLoadDialog(){
  const maps=loadMaps();const names=Object.keys(maps);
  openModal('<h2>Load map</h2>'+(names.length?'<ul style="list-style:none;margin:0">'+names.map(n=>'<li class="mrow"><span style="flex:1">'+n+' <span style="color:#a89868">('+maps[n].w+'×'+maps[n].h+', '+maps[n].np+' players)</span></span><button data-load="'+n+'">Load</button><button data-del="'+n+'">Delete</button></li>').join('')+'</ul>':'<p>No saved maps yet.</p>')+'<div class="btnrow"><span></span><button id="ld-close">Close</button></div>',{noPause:true});
  $('ld-close').onclick=()=>$('modal').classList.add('hidden');
  $('modalbox').querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{const j=loadMaps()[b.dataset.load];EDITOR.md=mdFromJSON(j);EDITOR.name=j.name||b.dataset.load;EDITOR.undo=[];EDITOR.redo=[];EDITOR.selObj=null;$('modal').classList.add('hidden');edEnter();toast('Loaded '+EDITOR.name,'good')});
  $('modalbox').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const m=loadMaps();delete m[b.dataset.del];saveMaps(m);edLoadDialog()});
}
function edExport(){
  const j=mdToJSON(EDITOR.md);j.name=EDITOR.name;const blob=new Blob([JSON.stringify(j)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=EDITOR.name.replace(/[^\w\- ]+/g,'_')+'.aormap.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);edStatus('Exported '+a.download,true);
}
function edImport(e){
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const j=JSON.parse(r.result);if(!j.w||!j.terr||!j.hgt||j.terr.length!==j.w*j.h)throw new Error('not a map file');EDITOR.md=mdFromJSON(j);EDITOR.name=j.name||f.name.replace(/\..*$/,'');EDITOR.undo=[];EDITOR.redo=[];EDITOR.selObj=null;edEnter();toast('Imported '+EDITOR.name,'good')}catch(err){toast('Import failed: '+err.message,'warn')}};
  r.readAsText(f);e.target.value='';
}
function edNewDialog(first){
  openModal('<h2>New map</h2><div class="mrow"><label>Start from</label><select id="nw-kind"><option value="gen">Generated map (editable)</option><option value="blank">Blank grass map</option><option value="water">Blank sea (all water)</option></select></div>'+
   '<div class="mrow"><label>Map type</label><select id="nw-type">'+Object.keys(MAP_TYPES).map(k=>'<option value="'+k+'">'+MAP_TYPES[k].n+'</option>').join('')+'</select></div>'+
   '<div class="mrow"><label>Size</label><select id="nw-size">'+Object.keys(MAP_SIZES).map(k=>'<option value="'+k+'"'+(k==='small'?' selected':'')+'>'+MAP_SIZES[k].n+'</option>').join('')+'</select></div>'+
   '<div class="mrow"><label>Seed</label><input id="nw-seed" value="'+Math.floor(Math.random()*9999)+'"></div><div class="mrow"><label>Players</label><select id="nw-np"><option>2</option><option>3</option><option>4</option></select><span class="hint">1 human + computers</span></div>'+
   '<div class="btnrow"><button id="nw-cancel">'+(first===true?'Back to menu':'Cancel')+'</button><button id="nw-ok" class="gold">Create</button></div>',{noPause:true});
  $('nw-cancel').onclick=()=>{$('modal').classList.add('hidden');if(first===true){R.editor=false;show('menu');$('editor').classList.add('hidden')}};
  $('nw-ok').onclick=()=>{
    const kind=$('nw-kind').value,type=$('nw-type').value,N=MAP_SIZES[$('nw-size').value].s,np=+$('nw-np').value;let seed=parseInt($('nw-seed').value)||1;
    let md;
    if(kind==='gen'){md=genMap({type,size:N,seed,np});for(let i=0;i<np;i++){const s=md.starts[i];md.objs.push({k:'bld',t:'towncenter',x:s.x-2,y:s.y-2,o:i})}}
    else{md=newMapData(N);md.np=np;if(kind==='water'){md.terr.fill(T_DEEP)}else md.terr.fill(T_GRASS)}
    md.custom=true;md.name='My Map';
    EDITOR.md=md;EDITOR.name='My Map';EDITOR.undo=[];EDITOR.redo=[];EDITOR.selObj=null;EDITOR.owner=0;$('modal').classList.add('hidden');edEnter();
    if(kind!=='gen')edStatus('Blank map created – paint terrain, place objects and add start flags',true);
  };
}
function edPlay(){
  const errs=validateMap(EDITOR.md);
  if(errs.length){edShowErrors(errs);edStatus(errs.length+' problem(s) – cannot launch',false);return}
  edAutosave();
  // hand over to setup screen with this map preselected
  R.editor=false;R.extraDraw=null;$('editor').classList.add('hidden');
  $('s-map').value='custom';updateMapDesc();$('s-custom').value='__current';
  const n=Math.min(3,EDITOR.md.np-1);$('s-ai').value=String(Math.max(1,n));updateTeamsOpt();
  show('setup');
}
// ---------- editor draw & frame ----------
function edDrawOverlay(time){
  const md=EDITOR.md;
  // start flags
  md.starts.forEach((s,i)=>{if(!s||i>=md.np)return;const h=hAt(s.x,s.y);const sx=(s.x+.5-s.y-.5)*32,sy=(s.x+s.y+1)*16-h*LVL;
    ctx.save();ctx.translate(sx,sy);ell(ctx,0,0,18,8,'rgba(255,255,255,.18)',PCOLORS[i].c);ln(ctx,0,0,0,-34,2.4,'#ddd');poly(ctx,[[0,-34],[16,-30],[0,-24]],PCOLORS[i].c,'#000');
    ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.strokeText('P'+(i+1),0,-38);ctx.fillText('P'+(i+1),0,-38);ctx.restore()});
  // selection
  const so=EDITOR.selObj;
  if(so){const sz=so.k==='bld'?B[so.t].sz:1;const h=hAt(so.x,so.y);const sx=(so.x-so.y)*32,sy=(so.x+so.y)*16-h*LVL;
    ctx.strokeStyle='#ffee66';ctx.lineWidth=2.4;ctx.beginPath();const pts=[[0,0],[sz*32,sz*16],[0,sz*32],[-sz*32,sz*16]];ctx.moveTo(sx,sy);ctx.lineTo(sx+sz*32,sy+sz*16);ctx.lineTo(sx,sy+sz*32);ctx.lineTo(sx-sz*32,sy+sz*16);ctx.closePath();ctx.stroke()}
  // brush
  const t=EDITOR.hoverTile;if(!t)return;
  const tool=EDITOR.tool;
  if(tool==='terrain'||tool==='elev'||tool==='erase'||(tool==='place'&&EDITOR.brush>1&&EDITOR.pal.obj&&(EDITOR.pal.obj.k==='res'||EDITOR.pal.obj.k==='animal'))){
    ctx.strokeStyle=tool==='erase'?'rgba(255,90,80,.9)':'rgba(255,255,255,.85)';ctx.lineWidth=1.5;
    for(const[x,y]of brushTiles(t.x,t.y)){const hh=md.terr[y*md.w+x]>=3?-0.35:md.hgt[y*md.w+x];const sx=(x-y)*32,sy=(x+y)*16-hh*LVL;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+32,sy+16);ctx.lineTo(sx,sy+32);ctx.lineTo(sx-32,sy+16);ctx.closePath();ctx.stroke()}
  }else if(tool==='place'&&EDITOR.pal.obj){
    const o=EDITOR.pal.obj;const obj={k:o.k,t:o.t,x:t.x,y:t.y,o:o.k==='res'||o.k==='animal'?-1:EDITOR.owner};const sz=o.k==='bld'?B[o.t].sz:1;
    if(o.k==='bld'){obj.x=t.x-Math.floor(sz/2);obj.y=t.y-Math.floor(sz/2)}
    const why=edCheckPlace(obj);
    const hh=md.terr[Math.min(md.h-1,Math.max(0,t.y))*md.w+Math.min(md.w-1,Math.max(0,t.x))]>=3?-0.35:hAt(t.x,t.y);
    const cx=obj.x+sz/2,cy=obj.y+sz/2;const sx=(cx-cy)*32,sy=(cx+cy)*16-hh*LVL;
    ctx.save();ctx.translate(sx,sy);
    poly(ctx,[pj(-sz/2,-sz/2,0),pj(sz/2,-sz/2,0),pj(sz/2,sz/2,0),pj(-sz/2,sz/2,0)],why?'rgba(255,70,60,.35)':'rgba(80,255,100,.3)',why?'#f55':'#6f6',2);
    ctx.globalAlpha=0.65;
    if(o.k==='bld'){const p=G.players[Math.min(EDITOR.owner,3)];const sp=getBuildingSprite(o.t,'britons',2,p.color);if(!B[o.t].farm&&!B[o.t].wall)ctx.drawImage(sp.cv,-sp.ox,-sp.oy)}
    else if(o.k==='res'){const fake={kind:'r',type:o.t,res:RINFO[o.t].r,x:t.x,y:t.y,amt:100,max:100,v:1,shake:0};ctx.restore();ctx.save();ctx.globalAlpha=0.65;drawResource(fake,time)}
    else{const col=o.k==='unit'?G.players[Math.min(EDITOR.owner,3)].color:'#bbb';ctx.translate(0,0);const fake={id:1,kind:'u',type:o.t,def:U[o.t],owner:o.k==='unit'?Math.min(EDITOR.owner,3):-1,x:t.x+.5,y:t.y+.5,z:hh,fx:.7,fy:.7,hp:1,mh:1,t:'idle',moving:false,working:false};ctx.restore();ctx.save();ctx.globalAlpha=0.7;drawUnit(fake,time)}
    ctx.restore();
    if(why){EDITOR.hintWhy=why}
  }
}
function editorFrame(now,dt){
  if(!G){return}
  const sp=900/CAM.zoom*dt;let dx=0,dy=0;
  if(!UI.typing&&$('modal').classList.contains('hidden')&&!(document.activeElement&&['INPUT','SELECT'].includes(document.activeElement.tagName))){
    if(UI.keys['arrowleft'])dx-=1;if(UI.keys['arrowright'])dx+=1;if(UI.keys['arrowup'])dy-=1;if(UI.keys['arrowdown'])dy+=1}
  if(dx||dy){CAM.x+=dx*sp;CAM.y+=dy*sp*.6;clampCam()}
  G.time+=dt;
  drawFrame(now);
}
function edKey(e){
  const k=e.key.toLowerCase();
  if(document.activeElement&&['INPUT','SELECT'].includes(document.activeElement.tagName))return;
  if($('modal').classList.contains('hidden')===false)return;
  UI.keys[k]=true;
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.shiftKey?edRedo():edUndo();e.preventDefault();return}
  if((e.ctrlKey||e.metaKey)&&k==='y'){edRedo();e.preventDefault();return}
  if(k==='delete'||k==='backspace'){if(EDITOR.selObj){edPush();EDITOR.md.objs=EDITOR.md.objs.filter(o=>o!==EDITOR.selObj);EDITOR.selObj=null;edRebuild();edStatus('Deleted',true);edRefreshUI();edAutosave();e.preventDefault()}return}
  if(k==='escape'){EDITOR.selObj=null;return}
  if(k==='['){EDITOR.brush=Math.max(1,EDITOR.brush-1);$('ed-bs').value=EDITOR.brush;$('ed-bsv').textContent=EDITOR.brush}
  if(k===']'){EDITOR.brush=Math.min(9,EDITOR.brush+1);$('ed-bs').value=EDITOR.brush;$('ed-bsv').textContent=EDITOR.brush}
}
window.addEventListener('keyup',e=>{UI.keys[e.key.toLowerCase()]=false});
