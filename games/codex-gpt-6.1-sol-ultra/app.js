import {Game} from './engine.js';
import {Renderer} from './renderer.js';
import {BUILDINGS,UNITS,TECHS,AGES,AGE_COSTS,RESOURCE_NAMES,MAP_SIZE,costText} from './catalog.js';
import {icon,crest} from './icons.js';
import {Soundscape} from './sound.js';

const $=id=>document.getElementById(id);
const canvas=$('world');
const sound=new Soundscape();
let difficulty='normal',game=new Game({difficulty}),renderer=new Renderer(canvas,game);
let paused=false,speed=1,actionMode='',placement=null,attackMode=false,lastFrame=0,hudTimer=0,minimapTimer=0,lastActionSignature='',eventCursor=game.events.length,lastEvent=game.events.at(-1),finishedShown=false,modalWasPaused=false;
let pointer={x:0,y:0,inside:false},drag=null,panDrag=null,keys=new Set(),controlGroups=new Map(),lastClick={time:0,id:null};
const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected=()=>[...game.selected].map(id=>game.getEntity(id)).filter(Boolean);
const friendly=()=>selected().filter(e=>e.owner==='player');
const costShort=cost=>Object.entries(cost||{}).map(([r,n])=>`${n} ${r==='wood'?'W':r==='food'?'F':r==='gold'?'G':'S'}`).join(' · ');
const affordable=cost=>Object.entries(cost||{}).every(([r,n])=>(game.resources[r]||0)>=n);
const nameOf=e=>(BUILDINGS[e?.type]||UNITS[e?.type])?.name||({tree:'Forest',berry:'Berry Bush',gold:'Gold Mine',stone:'Stone Quarry'}[e?.type])||'Settlement';

$('brand-crest').innerHTML=crest(44);
$('age-symbol').innerHTML=icon('age',30);
$('pause-button').innerHTML=icon('pause',17);
$('sound-button').innerHTML=icon('sound',17);
$('menu-button').innerHTML=icon('menu',18);
$('home-button').innerHTML=icon('towncenter',21);
$('explore-button').innerHTML=icon('compass',15);
$('help-button').innerHTML=icon('help',16);
$('idle-icon').innerHTML=icon('villager',21);
$('tutorial-icon').innerHTML=icon('flag',25);
$('resources').innerHTML=['wood','food','gold','stone','population'].map(key=>`<div class="resource" data-key="${key}" title="${key==='population'?'Population / housing capacity':RESOURCE_NAMES[key]}">${icon(key,29)}<div><div class="resource-value" id="res-${key}">0</div><div class="resource-label">${key==='population'?'Population':RESOURCE_NAMES[key]}</div></div></div>`).join('');

function unlockAudio(){sound.unlock().then(()=>sound.start()).catch(()=>{});document.removeEventListener('pointerdown',unlockAudio);}
document.addEventListener('pointerdown',unlockAudio,{once:true});
function notify(text,type='info'){
  const el=document.createElement('div');el.className=`notification ${type}`;
  const glyph=type==='error'?'shield':type==='attack'?'sword':type==='age'?'age':type==='success'?'flag':'compass';
  el.innerHTML=`${icon(glyph,22)}<span>${esc(text)}</span>`;$('notification-stack').append(el);
  while($('notification-stack').children.length>4)$('notification-stack').firstChild.remove();
  setTimeout(()=>{el.classList.add('fade');setTimeout(()=>el.remove(),450)},type==='attack'?6500:4600);
}
function actionResult(result,successSound='click'){
  if(result?.ok){sound.play(successSound);lastActionSignature='';updateHUD(true);return true;}
  if(result?.reason){notify(result.reason,'error');sound.play('error');}return false;
}
function select(ids,append=false){
  if(!append)game.selected.clear();for(const id of ids){if(game.getEntity(id))game.selected.add(id)}
  actionMode='';lastActionSignature='';updateHUD(true);sound.play('select');
}
function centerHome(){const tc=game.entities.find(e=>e.type==='towncenter'&&e.owner==='player');if(tc){renderer.centerOn(tc.x,tc.y);select([tc.id]);cancelPlacement()}}
function centerScout(){const e=game.entities.find(e=>e.owner==='player'&&['scout','knight'].includes(e.type));if(e){select([e.id]);renderer.centerOn(e.x,e.y)}else notify('Train a scout at your Stable in the Feudal Age.');}
function selectIdle(){const list=game.entities.filter(e=>e.owner==='player'&&e.type==='villager'&&(!e.task||e.task.type==='idle'));if(!list.length){notify('All of your villagers are working.');return;}const current=[...game.selected][0],idx=list.findIndex(e=>e.id===current);const e=list[(idx+1)%list.length];select([e.id]);renderer.centerOn(e.x,e.y);}
function setPaused(value){paused=value;$('pause-badge').hidden=!paused||!$('modal-backdrop').hidden;$('pause-button').innerHTML=icon(paused?'play':'pause',17);$('pause-button').setAttribute('aria-label',paused?'Resume game':'Pause game');}
function cancelPlacement(){placement=null;renderer.placement=null;attackMode=false;$('placement-bar').hidden=true;canvas.style.cursor='default';}
function startPlacement(type){
  const def=BUILDINGS[type];if(game.age<def.age){notify(`${def.name} requires the ${AGES[def.age-1]}.`,'error');return;}
  if(!affordable(def.cost)){notify(`You need ${costText(def.cost)} to build a ${def.name}.`,'error');return;}
  placement=type;attackMode=false;canvas.style.cursor='crosshair';$('placement-bar').hidden=false;$('placement-icon').innerHTML=icon(type,23);$('placement-name').textContent=`Build ${def.name}`;sound.play('click');
  if(pointer.inside)updatePlacement();
}
function updatePlacement(){if(!placement)return;const w=renderer.screenToWorld(pointer.x,pointer.y);const x=Math.round(w.x*2)/2,y=Math.round(w.y*2)/2;const result=game.canBuild(placement,x,y);renderer.placement={type:placement,x,y,ok:result.ok};}
function beginAttack(){if(!friendly().some(e=>e.kind==='unit'))return;cancelPlacement();attackMode=true;canvas.style.cursor='crosshair';$('placement-bar').hidden=false;$('placement-icon').innerHTML=icon('attack',22);$('placement-name').textContent='Attack move';sound.play('click');}
function commandAt(clientX,clientY,forceAttack=false){
  const units=friendly().filter(e=>e.kind==='unit');
  if(!units.length){const buildings=friendly().filter(e=>e.kind==='building'&&BUILDINGS[e.type]?.trains);if(buildings.length){const w=renderer.screenToWorld(clientX,clientY);if(actionResult(game.command(buildings.map(e=>e.id),{type:'move',x:w.x,y:w.y}),'command'))notify('Rally point set. Newly trained units will move here.');}return;}
  const w=renderer.screenToWorld(clientX,clientY),target=renderer.hitTest(clientX,clientY);let command={type:forceAttack?'attackmove':'move',x:w.x,y:w.y};
  const hasWorkers=units.some(e=>e.type==='villager');
  if(target){if(target.owner==='enemy')command={type:'attack',targetId:target.id};else if(hasWorkers&&(target.kind==='resource'||target.type==='farm'))command={type:'gather',targetId:target.id};else if(hasWorkers&&target.owner==='player'&&target.kind==='building'&&target.progress<1)command={type:'build',targetId:target.id};else if(hasWorkers&&target.owner==='player'&&target.kind==='building'&&target.hp<target.maxHp)command={type:'repair',targetId:target.id};}
  if(actionResult(game.command(units.map(e=>e.id),command),'command')){
    renderer.commandMarker={x:w.x,y:w.y,time:performance.now()/1000,attack:command.type==='attack'||forceAttack};
    hideTutorial();
  }
}
function gatherResource(resource){
  const workers=friendly().filter(e=>e.type==='villager');if(!workers.length)return;
  const target=game.nearestResource(workers[0].x,workers[0].y,resource);
  if(!target){notify(`No ${resource} source is nearby. Explore with your scout.`,'error');return;}
  actionResult(game.command(workers.map(e=>e.id),{type:'gather',targetId:target.id}),'command');
}
function train(type){const b=friendly().find(e=>(BUILDINGS[e.type]?.trains||[]).includes(type));if(b)actionResult(game.train(b.id,type),'train');}
function advance(){const b=friendly().find(e=>e.type==='towncenter');if(b)actionResult(game.advanceAge(b.id),'train');}
function research(type){const b=friendly().find(e=>e.kind==='building');if(b)actionResult(game.research(b.id,type),'train');}
function stopSelected(){actionResult(game.command(friendly().filter(e=>e.kind==='unit').map(e=>e.id),{type:'stop'}),'command');}
function hideTutorial(){$('tutorial-toast').hidden=true;}

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if($('modal-backdrop').hidden===false)return;canvas.focus({preventScroll:true});hideTooltip();pointer={x:e.clientX,y:e.clientY,inside:true};
  if(e.button===1||(e.button===0&&e.altKey)){panDrag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
  if(e.button===2){e.preventDefault();if(placement||attackMode){cancelPlacement();return;}commandAt(e.clientX,e.clientY);return;}
  if(e.button!==0)return;
  if(placement){updatePlacement();const p=renderer.placement;const result=game.placeBuilding(placement,p.x,p.y,friendly().filter(e=>e.type==='villager').map(e=>e.id));if(actionResult(result,'build')){if(!e.shiftKey)cancelPlacement();hideTutorial();}return;}
  if(attackMode){commandAt(e.clientX,e.clientY,true);cancelPlacement();return;}
  const rect=canvas.getBoundingClientRect();drag={startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,shift:e.shiftKey,localX:e.clientX-rect.left,localY:e.clientY-rect.top};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  pointer={x:e.clientX,y:e.clientY,inside:true};
  if(panDrag){renderer.pan(e.clientX-panDrag.x,e.clientY-panDrag.y);panDrag={x:e.clientX,y:e.clientY};return;}
  if(placement){updatePlacement();return;}
  if(drag){drag.x=e.clientX;drag.y=e.clientY;if(Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>5){const r=canvas.getBoundingClientRect();renderer.dragRect={x1:drag.localX,y1:drag.localY,x2:e.clientX-r.left,y2:e.clientY-r.top};}return;}
  renderer.hoverEntity=renderer.hitTest(e.clientX,e.clientY);
  if(renderer.hoverEntity)canvas.style.cursor=renderer.hoverEntity.owner==='enemy'?'crosshair':'pointer';else canvas.style.cursor=attackMode?'crosshair':'default';
});
canvas.addEventListener('pointerup',e=>{
  if(panDrag){panDrag=null;return;}if(!drag)return;
  if(Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>6){
    const r=canvas.getBoundingClientRect(),x1=Math.min(drag.startX,drag.x)-r.left,x2=Math.max(drag.startX,drag.x)-r.left,y1=Math.min(drag.startY,drag.y)-r.top,y2=Math.max(drag.startY,drag.y)-r.top;
    let list=game.entities.filter(en=>{if(en.owner!=='player'||en.kind!=='unit')return false;const p=renderer.worldToScreen(en.x,en.y);return p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2;});
    if(list.some(en=>en.type!=='villager'))list=list.filter(en=>en.type!=='villager');select(list.map(en=>en.id),drag.shift);
  }else{
    const hit=renderer.hitTest(e.clientX,e.clientY);if(hit){const now=performance.now();if(now-lastClick.time<300&&lastClick.id===hit.id&&hit.kind==='unit'){const rect=canvas.getBoundingClientRect();select(game.entities.filter(en=>en.type===hit.type&&en.owner===hit.owner&&(()=>{const p=renderer.worldToScreen(en.x,en.y);return p.x>=0&&p.y>=0&&p.x<=rect.width&&p.y<=rect.height})()).map(en=>en.id));}else select([hit.id],drag.shift);lastClick={time:now,id:hit.id};}else if(!drag.shift)select([]);
  }
  drag=null;renderer.dragRect=null;
});
canvas.addEventListener('pointercancel',()=>{drag=null;panDrag=null;renderer.dragRect=null;});
canvas.addEventListener('pointerleave',()=>{pointer.inside=false;renderer.hoverEntity=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(renderer.zoom*(e.deltaY>0?.92:1.08));},{passive:false});
function setZoom(z){renderer.zoom=Math.max(.55,Math.min(1.5,z));$('zoom-level').textContent=`${Math.round(renderer.zoom*100)}%`;if(placement)updatePlacement();}

const minimap=$('minimap');let minimapDown=false;
function minimapNavigate(e){const r=minimap.getBoundingClientRect();const nx=(e.clientX-r.left)/r.width,ny=(e.clientY-r.top)/r.height;
  // Renderer exposes the same inverse projection used to draw its diamond map.
  const world=renderer.minimapToWorld&&renderer.minimapTransform?renderer.minimapToWorld(e.clientX,e.clientY,minimap):{x:(ny+(nx-.5))*MAP_SIZE,y:(ny-(nx-.5))*MAP_SIZE};
  if(e.button===2){const ids=friendly().filter(en=>en.kind==='unit').map(en=>en.id);actionResult(game.command(ids,{type:attackMode?'attackmove':'move',x:Math.max(1,Math.min(54,world.x)),y:Math.max(1,Math.min(54,world.y))}),'command');cancelPlacement();}
  else renderer.centerOn(Math.max(0,Math.min(55,world.x)),Math.max(0,Math.min(55,world.y)));
}
minimap.addEventListener('contextmenu',e=>e.preventDefault());minimap.addEventListener('pointerdown',e=>{minimapDown=true;minimap.setPointerCapture(e.pointerId);minimapNavigate(e);});minimap.addEventListener('pointermove',e=>{if(minimapDown)minimapNavigate(e);});minimap.addEventListener('pointerup',()=>minimapDown=false);

document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if(k==='escape'){if(!$('modal-backdrop').hidden)closeModal();else if(placement||attackMode)cancelPlacement();else if(actionMode){actionMode='';lastActionSignature='';updateHUD(true);}else showMenu();return;}
  if(!$('modal-backdrop').hidden)return;
  keys.add(k);if(e.repeat)return;
  if(k===' '){setPaused(!paused);return;}if(k==='h'){centerHome();return;}if(k==='.'||k===','){selectIdle();return;}if(k==='?'){showHelp();return;}
  if(k==='f3'){e.preventDefault();const army=game.entities.filter(en=>en.owner==='player'&&en.kind==='unit'&&en.type!=='villager');select(army.map(en=>en.id));return;}
  if(k==='a'&&friendly().some(en=>en.kind==='unit')){beginAttack();return;}
  if(k==='b'&&friendly().some(en=>en.type==='villager')){actionMode='buildEconomy';lastActionSignature='';updateHUD(true);return;}
  if(k==='q'&&friendly().some(en=>en.type==='towncenter')){train('villager');return;}
  if(k==='x'){stopSelected();return;}
  if(k==='='||k==='+'){setZoom(renderer.zoom+.1);return;}if(k==='-'){setZoom(renderer.zoom-.1);return;}
  if(/^[1-9]$/.test(k)){if(e.ctrlKey||e.metaKey){e.preventDefault();controlGroups.set(k,[...game.selected]);notify(`Control group ${k} assigned.`);}else if(controlGroups.has(k)){select(controlGroups.get(k));if(e.shiftKey&&selected()[0])renderer.centerOn(selected()[0].x,selected()[0].y);}return;}
  if(actionMode.startsWith('build')){const hotkeys={e:'house',l:'lumbercamp',m:'mill',f:'farm',r:'barracks',t:'tower'};if(hotkeys[k])startPlacement(hotkeys[k]);}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();drag=null;renderer.dragRect=null;});

function makeAction(id,name,glyph,cost,{locked=false,reason='',primary=false,hotkey='',description='',handler,completed=false}={}){
  const disabled=locked||completed;
  return `<button class="action-card${primary?' primary':''}${locked?' action-locked':''}" data-action="${esc(id)}" data-name="${esc(name)}" data-description="${esc(description)}" data-cost="${esc(JSON.stringify(cost||{}))}" data-reason="${esc(reason)}" ${disabled?'disabled':''}><span class="action-hotkey">${esc(hotkey)}</span>${icon(glyph,35)}<span class="action-name">${esc(name)}</span><span class="action-cost">${completed?'RESEARCHED':locked?esc(reason):esc(costShort(cost))||'COMMAND'}</span></button>`;
}
function renderActions(){
  const list=selected(),player=list.filter(e=>e.owner==='player'),e=player[0];let actions=[],heading='YOUR KINGDOM',help='Select a unit or building',production='';
  $('actions').className='';
  if(e?.kind==='building'){
    const def=BUILDINGS[e.type];heading=def.name.toUpperCase();help=def.description;
    if(e.progress<1){help='Your villagers are constructing this building.';actions.push(makeAction('findBuilders','Find builders','villager',{}, {description:'Select villagers working on this construction.'}));}
    else{
      for(const type of def.trains||[]){const u=UNITS[type];actions.push(makeAction(`train:${type}`,u.name,type,u.cost,{locked:game.age<u.age,reason:game.age<u.age?AGES[u.age-1]:'',description:u.description,hotkey:type==='villager'?'Q':'',primary:type==='villager'}));}
      if(e.type==='towncenter'&&game.age<4){const next=AGES[game.age];actions.push(makeAction('advance',next,'age',AGE_COSTS[game.age-1],{primary:true,description:`Advance your civilization to the ${next}. Unlock new buildings, units, and stronger soldiers.`,locked:e.queue?.some(q=>q.kind==='age'),reason:e.queue?.some(q=>q.kind==='age')?'ADVANCING':''}));}
      const upgrades=e.type==='blacksmith'?['forging','armor']:e.type==='towncenter'&&game.age>=2?['wheelbarrow']:[];
      for(const t of upgrades){const d=TECHS[t],complete=game.techs.has(t),queued=e.queue?.some(q=>q.type===t);actions.push(makeAction(`research:${t}`,d.name,t,d.cost,{description:d.description,completed:complete,locked:queued,reason:queued?'RESEARCHING':''}));}
      if(e.type==='farm')actions.push(makeAction('assignFarm','Assign villager','villager',{}, {description:'Send your nearest villager to gather food from this farm.'}));
      if(!actions.length)actions.push(makeAction('selectVillagers','Find villagers','villager',{}, {description:'Select your nearby villagers to develop your settlement.'}));
    }
  }else if(e?.kind==='unit'){
    const workers=player.filter(en=>en.type==='villager');
    if(workers.length){
      heading=workers.length>1?`${workers.length} VILLAGERS`:'VILLAGER';help='Right-click a resource to gather, or a site to build.';
      if(actionMode.startsWith('build')){
        $('actions').className='build-actions';heading=`BUILD ${actionMode==='buildMilitary'?'MILITARY':'ECONOMY'}`;
        const types=actionMode==='buildMilitary'?['barracks','archery','stable','blacksmith','tower','castle']:['house','lumbercamp','miningcamp','mill','farm','towncenter'];
        for(const t of types){const d=BUILDINGS[t];actions.push(makeAction(`build:${t}`,d.name,t,d.cost,{locked:game.age<d.age,reason:game.age<d.age?AGES[d.age-1]:'',description:d.description,hotkey:({house:'E',lumbercamp:'L',mill:'M',farm:'F',barracks:'R',tower:'T'})[t]||''}));}
        help=`<button class="build-back" data-action="buildTab:${actionMode==='buildMilitary'?'buildEconomy':'buildMilitary'}">${actionMode==='buildMilitary'?'Economy':'Military'} →</button><button class="build-back" data-action="back">← Back</button>`;
      }else{
        actions.push(makeAction('buildMenu','Build','build',{}, {primary:true,hotkey:'B',description:'Build houses, resource camps, military buildings, and defenses.'}));
        for(const r of ['food','wood','gold','stone'])actions.push(makeAction(`gather:${r}`,`Gather ${r}`,r,{}, {description:`Send the selected villagers to the nearest ${r} source.`}));
        actions.push(makeAction('stop','Stop','stop',{}, {hotkey:'X',description:'Stop the current task and become idle.'}));
      }
    }else{
      heading=player.length>1?`${player.length} SOLDIERS`:UNITS[e.type]?.name.toUpperCase();help='Right-click to move or attack. A to attack move.';
      actions.push(makeAction('attackMove','Attack move','attack',{}, {primary:true,hotkey:'A',description:'Move toward a location, attacking enemies encountered along the way.'}));
      actions.push(makeAction('stop','Stop','stop',{}, {hotkey:'X',description:'Stop moving. Units will defend themselves from nearby enemies.'}));
      actions.push(makeAction('selectArmy','All military','sword',{}, {hotkey:'F3',description:'Select all of your military units.'}));
      actions.push(makeAction('homeArmy','Return home','towncenter',{}, {description:'Send the selected units back to defend your Town Center.'}));
    }
  }else{
    if(list[0]?.owner==='enemy'){heading='RIVAL KINGDOM';help='Build an army and destroy their Town Center.';}else if(list[0]?.kind==='resource'){heading='NATURAL RESOURCES';help='Select a villager and right-click this resource to gather.';}
    actions.push(makeAction('home','Town Center','towncenter',{}, {primary:true,hotkey:'H',description:'Select your Town Center and return to your settlement.'}));
    actions.push(makeAction('idle','Idle villager','villager',{}, {hotkey:'.',description:'Find a villager who needs a task.'}));
    actions.push(makeAction('selectArmy','Your army','sword',{}, {hotkey:'F3',description:'Select every military unit in your kingdom.'}));
    actions.push(makeAction('help','How to play','help',{}, {hotkey:'?',description:'Learn the controls, economy, and path to victory.'}));
  }
  $('actions-heading').textContent=heading;$('action-help').innerHTML=help;$('actions').innerHTML=actions.join('');
  document.querySelectorAll('[data-action]').forEach(button=>{button.addEventListener('click',()=>handleAction(button.dataset.action));if(button.classList.contains('action-card')){button.addEventListener('pointerenter',()=>showTooltip(button));button.addEventListener('pointerleave',hideTooltip);}});
}
function handleAction(id){
  hideTooltip();const [action,value]=id.split(':');sound.play('click');
  if(action==='train')train(value);else if(action==='advance')advance();else if(action==='research')research(value);else if(action==='build')startPlacement(value);else if(action==='gather')gatherResource(value);
  else if(action==='buildMenu'||action==='buildTab'){actionMode=value||'buildEconomy';lastActionSignature='';updateHUD(true);}
  else if(action==='back'){actionMode='';lastActionSignature='';updateHUD(true);}else if(action==='stop')stopSelected();else if(action==='attackMove')beginAttack();else if(action==='home')centerHome();else if(action==='idle')selectIdle();else if(action==='help')showHelp();
  else if(action==='selectArmy')select(game.entities.filter(e=>e.owner==='player'&&e.kind==='unit'&&e.type!=='villager').map(e=>e.id));
  else if(action==='homeArmy'){const tc=game.entities.find(e=>e.owner==='player'&&e.type==='towncenter');if(tc)actionResult(game.command(friendly().filter(e=>e.kind==='unit').map(e=>e.id),{type:'move',x:tc.x+3,y:tc.y+3}),'command');}
  else if(action==='findBuilders'){const id=friendly()[0]?.id;select(game.entities.filter(e=>e.owner==='player'&&e.type==='villager'&&e.task?.targetId===id).map(e=>e.id));}
  else if(action==='assignFarm'){const farm=friendly()[0],v=game.entities.filter(e=>e.type==='villager'&&e.owner==='player').sort((a,b)=>Math.hypot(a.x-farm.x,a.y-farm.y)-Math.hypot(b.x-farm.x,b.y-farm.y))[0];if(v)actionResult(game.command([v.id],{type:'gather',targetId:farm.id}),'command');}
  else if(action==='selectVillagers')select(game.entities.filter(e=>e.owner==='player'&&e.type==='villager').map(e=>e.id));
}
function updateSelection(){
  const list=selected(),e=list[0];let html='';
  if(!e){html=`<div class="selection-empty">${crest(40)}<h3>Command your kingdom.</h3><p>Select a villager, soldier, or building<br>to view its details and commands.</p></div>`;}
  else if(list.length>1){const hp=list.reduce((n,a)=>n+a.hp,0),max=list.reduce((n,a)=>n+a.maxHp,0);html=`<div class="selection-topline"><i class="player-dot"></i> KINGDOM OF ASHFORD</div><div class="selection-body"><div class="portrait-frame">${icon(list.some(e=>e.type!=='villager')?'sword':'villager',62)}</div><div class="selection-info"><h2 class="selection-name">${list.length} units selected</h2><div class="selection-subtitle">${list.filter(a=>a.type==='villager').length} villagers · ${list.filter(a=>a.type!=='villager').length} military</div><div class="health-bar"><i style="width:${hp/max*100}%"></i></div><div class="health-numbers"><span>Combined health</span><span>${Math.ceil(hp)}</span></div></div></div><div class="army-grid">${list.slice(0,12).map(a=>`<span class="army-tile">${icon(a.type,22)}</span>`).join('')}</div>`;}
  else{
    const def=BUILDINGS[e.type]||UNITS[e.type],owner=e.owner==='enemy'?'HOUSE OF BLACKTHORN':e.owner==='neutral'?'THE BORDERLANDS':'KINGDOM OF ASHFORD';
    const work={idle:'Awaiting your orders',move:'Moving to destination',gather:`Gathering ${e.carrying?.resource||game.getEntity(e.task?.targetId)?.resource||'resources'}`,build:'Constructing a building',attack:'Engaged in combat',attackmove:'Advancing into battle',repair:'Repairing a building',return:'Delivering resources'};
    const subtitle=e.kind==='building'?(e.progress<1?`Under construction · ${Math.round(e.progress*100)}%`:`${e.owner==='enemy'?'Rival':'Your'} ${e.type==='towncenter'?'civilization':'building'}`):e.kind==='resource'?`${RESOURCE_NAMES[e.resource]||'Resources'} source`:(work[e.task?.type]||'Ready for orders');
    html=`<div class="selection-topline"><i class="${e.owner==='enemy'?'enemy':'player'}-dot"></i> ${owner}</div><div class="selection-body"><div class="portrait-frame">${icon(e.kind==='resource'?e.resource:e.type,62)}</div><div class="selection-info"><h2 class="selection-name">${nameOf(e)}</h2><div class="selection-subtitle">${esc(subtitle)}</div>${e.kind!=='resource'?`<div class="health-bar"><i style="width:${Math.max(0,e.hp/e.maxHp*100)}%"></i></div><div class="health-numbers"><span>HEALTH</span><span>${Math.ceil(e.hp)} / ${e.maxHp}</span></div>`:`<div class="resource-picked">${Math.ceil(e.amount)} remaining</div>`}</div></div>`;
    if(e.kind==='unit'&&e.type!=='villager')html+=`<div class="stat-row"><span>${icon('sword',15)} ${e.attack||def.attack} attack</span><span>${icon('eye',15)} ${def.range} range</span><span>${icon('shield',15)} ${game.techs.has('armor')?2:0}</span></div>`;
    html+=`<div class="selection-desc">${esc(def?.description||'Send a villager here to gather resources for your kingdom.')}</div>`;
  }
  $('selection-panel').innerHTML=html;
}
function updateProduction(){
  const e=friendly()[0];if(e?.kind==='building'&&e.progress<1){$('production-line').innerHTML=`<span class="production-label">CONSTRUCTION</span><div class="progress-track"><i style="width:${e.progress*100}%"></i></div><span>${Math.round(e.progress*100)}%</span>`;return;}
  const queue=e?.queue||[];
  if(queue.length){const q=queue[0],progress=Math.max(0,Math.min(1,q.progress??(1-(q.remaining||0)/(q.total||q.duration||1))));const label=q.kind==='age'?`Advancing to ${AGES[game.age]}`:(UNITS[q.type]||TECHS[q.type])?.name||'Training';
    $('production-line').innerHTML=`<span class="production-label">${q.kind==='age'?'AGE ADVANCEMENT':'PRODUCTION'}</span><div class="queue-items">${queue.slice(0,5).map((item,i)=>`<span class="queue-item" title="${(UNITS[item.type]||TECHS[item.type])?.name||'Next Age'}">${icon(item.kind==='age'?'age':item.type,19)}<i class="queue-fill" style="height:${i===0?progress*100:0}%"></i></span>`).join('')}</div><div class="progress-track"><i style="width:${progress*100}%"></i></div><span class="select-queue">${Math.round(progress*100)}%</span>`;
  }else $('production-line').innerHTML=e?.kind==='building'?`<span class="production-empty">${e.progress<1?'Under construction':'No production queued. Your next chapter is yours to write.'}</span>`:`<span class="deck-tip">${icon('compass',14)} ${actionMode.startsWith('build')?'Place buildings near resources to keep your economy efficient.':'Shift + click to select more units · Ctrl + 1–9 to create a control group'}</span>`;
}
function updateObjectives(){
  const p=game.population,m=game.entities.filter(e=>e.owner==='player'&&e.kind==='unit'&&e.type!=='villager').length,b=game.entities.filter(e=>e.owner==='player'&&e.kind==='building'&&e.progress>=1).length;
  const goals=[{text:'Grow your settlement',count:`${Math.min(p,15)} / 15`,done:p>=15},{text:'Reach the Castle Age',count:AGES[game.age-1],done:game.age>=3},{text:'Raise an army',count:`${Math.min(m,12)} / 12`,done:m>=12},{text:'Destroy the rival Town Center',done:game.state==='won'}];let found=false;
  $('objective-list').innerHTML=goals.map(g=>{const current=!g.done&&!found;if(current)found=true;return `<div class="objective${g.done?' done':''}${current?' objective-current':''}"><span class="objective-check">${g.done?'✓':''}</span><span>${g.text}</span>${g.count?`<span class="count">${g.count}</span>`:''}</div>`;}).join('');
  $('enemy-age').textContent=AGES[(game.enemyAge||1)-1];
}
function updateHUD(force=false){
  for(const r of ['wood','food','gold','stone'])$('res-'+r).textContent=Math.floor(game.resources[r]).toLocaleString();
  $('res-population').textContent=`${game.population}/${game.populationCap}`;document.querySelector('[data-key="population"]').classList.toggle('capped',game.population>=game.populationCap);
  $('game-clock').textContent=fmt(game.time);$('age-name').textContent=AGES[game.age-1];$('age-pips').innerHTML=[1,2,3,4].map(n=>`<i class="${n<=game.age?'active':''}"></i>`).join('');
  const idle=Array.isArray(game.idleVillagers)?game.idleVillagers.length:game.idleVillagers||0;$('idle-count').textContent=idle;
  for(const id of game.selected)if(!game.getEntity(id))game.selected.delete(id);
  updateSelection();updateProduction();updateObjectives();
  const signature=[...game.selected].join(',')+'|'+game.age+'|'+actionMode+'|'+[...game.techs].join(',')+'|'+selected().map(e=>e.progress>=1?'complete':'building').join(',')+'|'+selected().map(e=>(e.queue||[]).map(q=>q.kind+q.type).join(',')).join(';');
  if(force||signature!==lastActionSignature){lastActionSignature=signature;renderActions();}
}
function showTooltip(button){
  if(placement)return;const d=button.dataset,cost=JSON.parse(d.cost||'{}');const tooltip=$('tooltip');tooltip.innerHTML=`<div class="tooltip-name">${esc(d.name)}</div><div class="tooltip-desc">${esc(d.description)}</div>${Object.keys(cost).length?`<div class="tooltip-cost">${Object.entries(cost).map(([r,n])=>`<span style="${game.resources[r]<n?'color:#d9947b':''}">${icon(r,16)} ${n}</span>`).join('')}</div>`:''}${d.reason?`<div class="tooltip-required">Requires ${esc(d.reason)}</div>`:''}`;
  tooltip.hidden=false;const rect=button.getBoundingClientRect(),tw=tooltip.offsetWidth,th=tooltip.offsetHeight;tooltip.style.left=Math.min(window.innerWidth-tw-12,Math.max(12,rect.left))+'px';tooltip.style.top=Math.max(10,rect.top-th-11)+'px';
}
function hideTooltip(){$('tooltip').hidden=true;}

function openModal(html){hideTooltip();cancelPlacement();modalWasPaused=paused;setPaused(true);$('modal').innerHTML=`<button class="modal-close" data-modal-close aria-label="Close dialog">×</button>${html}`;$('modal-backdrop').hidden=false;$('pause-badge').hidden=true;$('modal').querySelector('[data-modal-close]').addEventListener('click',closeModal);$('modal').querySelector('button:not(.modal-close)')?.focus();}
function closeModal(){$('modal-backdrop').hidden=true;setPaused(modalWasPaused);canvas.focus({preventScroll:true});}
function showHelp(){
  openModal(`<div class="modal-emblem">${icon('compass',46)}</div><div class="eyebrow">THE COMMANDER'S HANDBOOK</div><h2>Your path to a kingdom</h2><p class="modal-lead">Every great empire begins with a handful of villagers.<br>Grow your economy, advance your age, and conquer Blackthorn.</p><div class="help-grid"><div class="help-item"><strong>${icon('villager',21)} 1. Grow your economy</strong>Train villagers at your Town Center. Right-click trees, berries, gold, or stone to gather. Workers carry resources to nearby camps.</div><div class="help-item"><strong>${icon('house',21)} 2. Build your settlement</strong>Select a villager and choose Build. Houses add population capacity. Mills, mines, and lumber camps shorten gathering trips.</div><div class="help-item"><strong>${icon('age',21)} 3. Advance through ages</strong>Save food and gold, then advance at your Town Center. New ages unlock archers, knights, castles, and trebuchets.</div><div class="help-item"><strong>${icon('sword',21)} 4. Command an army</strong>Train soldiers in military buildings. Scout east across the map for the rival kingdom. Destroy their Town Center to claim victory.</div></div><div class="modal-divider"></div><div class="controls-grid"><span><b class="key">LMB</b> Select / drag-select</span><span><b class="key">RMB</b> Move / gather / attack</span><span><b class="key">WASD</b> Pan the map</span><span><b class="key">SCROLL</b> Zoom in / out</span><span><b class="key">H</b> Return to Town Center</span><span><b class="key">.</b> Find idle villager</span><span><b class="key">A</b> Attack move</span><span><b class="key">SPACE</b> Pause / resume</span><span><b class="key">B</b> Villager build menu</span><span><b class="key">CTRL 1–9</b> Create control group</span></div><p class="small-note">Spearmen counter cavalry. Archers excel behind infantry. Trebuchets crush fortified buildings. Keep your army together and protect your villagers.</p><button class="modal-button" id="help-continue">TO THE BATTLEFIELD</button>`);
  $('help-continue').onclick=closeModal;
}
function showMenu(){
  openModal(`<div class="modal-emblem">${crest(58)}</div><div class="eyebrow">CROWN & CONQUEST</div><h2>A moment of counsel.</h2><p class="modal-lead">Your kingdom will wait. The next move is yours.</p><button class="modal-button" id="resume-game">CONTINUE YOUR REIGN</button><div class="modal-option"><span>Game speed</span><select id="speed-select" aria-label="Game speed"><option value="1">Normal · 1×</option><option value="1.5">Quick · 1.5×</option><option value="2">Fast · 2×</option><option value="3">Very fast · 3×</option></select></div><div class="modal-option"><span>Sound & ambience</span><select id="audio-select" aria-label="Sound setting"><option value="on">On</option><option value="off">Off</option></select></div><div class="modal-divider"></div><button class="modal-button secondary" id="save-game">SAVE YOUR KINGDOM</button><button class="modal-button secondary" id="load-game" ${localStorage.getItem('crown-save')?'':'disabled'}>LOAD SAVED KINGDOM</button><button class="modal-button secondary" id="new-game">START A NEW KINGDOM</button><button class="modal-button secondary" id="menu-help">COMMANDER'S HANDBOOK</button><div id="save-status" class="save-status"></div>`);
  $('speed-select').value=String(speed);$('speed-select').onchange=e=>{speed=Number(e.target.value)};$('audio-select').value=sound.enabled?'on':'off';$('audio-select').onchange=e=>toggleSound(e.target.value==='on');
  $('resume-game').onclick=closeModal;$('save-game').onclick=saveGame;$('load-game').onclick=loadGame;$('new-game').onclick=showNewGame;$('menu-help').onclick=()=>{closeModal();showHelp();};
}
function showNewGame(){
  if(!$('modal-backdrop').hidden)closeModal();
  openModal(`<div class="modal-emblem">${crest(64)}</div><div class="eyebrow">A NEW CHAPTER</div><h2>The Borderlands</h2><p class="modal-lead">The frontier is rich, but you are not alone.<br>Establish Ashford. Defeat the House of Blackthorn.</p><div class="modal-option"><span>Your rival's strength</span><select id="difficulty-select" aria-label="Difficulty"><option value="relaxed">Peaceful · a gentler rival</option><option value="normal">Standard · a worthy rival</option><option value="hard">Challenging · a relentless rival</option></select></div><p class="small-note">Begin with six villagers, a scout, and the foundations of your settlement. The land holds everything you need.</p><div class="modal-divider"></div><button class="modal-button" id="begin-game">BEGIN YOUR REIGN</button><button class="modal-button secondary" id="cancel-new">RETURN TO YOUR KINGDOM</button>`);
  $('difficulty-select').value=difficulty;$('cancel-new').onclick=closeModal;$('begin-game').onclick=()=>{difficulty=$('difficulty-select').value;resetGame();closeModal();setPaused(false);sound.play('age');};
}
function resetGame(){game=new Game({difficulty});if(renderer.setGame)renderer.setGame(game);else renderer.game=game;finishedShown=false;eventCursor=game.events.length;lastEvent=game.events.at(-1);lastActionSignature='';actionMode='';placement=null;controlGroups.clear();$('tutorial-toast').hidden=false;cancelPlacement();centerHome();exposeGame();updateHUD(true);notify('Welcome to Ashford. Your reign begins.','success');}
function saveGame(){
  try{const data=JSON.stringify({game,difficulty,speed,camera:renderer.camera,zoom:renderer.zoom},(k,v)=>v instanceof Set?{__type:'Set',value:[...v]}:v instanceof Uint8Array?{__type:'Uint8Array',value:[...v]}:v instanceof Map?{__type:'Map',value:[...v]}:v);localStorage.setItem('crown-save',data);$('save-status').textContent='Your kingdom has been saved in this browser.';$('load-game').disabled=false;sound.play('complete');}catch(e){notify('This browser could not save the game.','error');}
}
function loadGame(){
  try{const d=JSON.parse(localStorage.getItem('crown-save'),(k,v)=>v?.__type==='Set'?new Set(v.value):v?.__type==='Uint8Array'?new Uint8Array(v.value):v?.__type==='Map'?new Map(v.value):v);if(!d)throw new Error('No save');game=Object.assign(new Game({difficulty:d.difficulty}),d.game);difficulty=d.difficulty;speed=d.speed;if(renderer.setGame)renderer.setGame(game);else renderer.game=game;renderer.camera=d.camera;renderer.zoom=d.zoom;game.selected||=new Set();eventCursor=game.events.length;lastEvent=game.events.at(-1);finishedShown=false;lastActionSignature='';exposeGame();closeModal();setPaused(false);updateHUD(true);notify('Your kingdom has been restored.','success');}catch(e){notify('The saved kingdom could not be restored.','error');}
}
function showResult(){
  finishedShown=true;const won=game.state==='won';sound.play(won?'victory':'defeat');
  openModal(`<div class="modal-emblem">${won?crest(80):icon('shield',65)}</div><div class="eyebrow">${won?'THE BORDERLANDS ARE YOURS':'THE CHRONICLE OF ASHFORD'}</div><h2>${won?'A crown well earned.':'A kingdom remembered.'}</h2><p class="modal-lead">${won?'Blackthorn has fallen. From a humble settlement, you built a kingdom that will stand the test of time.':'Your Town Center has fallen to Blackthorn. Raise your banners again, strengthen your economy, and return to the frontier.'}</p><div class="result-stats"><div><strong>${fmt(game.time)}</strong><small>TIME PLAYED</small></div><div><strong>${game.population}</strong><small>YOUR PEOPLE</small></div><div><strong>${game.stats?.kills||0}</strong><small>ENEMIES DEFEATED</small></div><div><strong>${['I','II','III','IV'][game.age-1]}</strong><small>AGE REACHED</small></div></div><button class="modal-button" id="play-again">WRITE ANOTHER CHAPTER</button><button class="modal-button secondary" id="view-kingdom">VIEW THE BATTLEFIELD</button>`);
  $('play-again').onclick=()=>{closeModal();showNewGame();};$('view-kingdom').onclick=()=>{closeModal();setPaused(true);};
}
function toggleSound(enabled){sound.setEnabled(enabled??!sound.enabled);$('sound-button').innerHTML=icon(sound.enabled?'sound':'muted',17);}
$('pause-button').onclick=()=>setPaused(!paused);$('sound-button').onclick=()=>toggleSound();$('menu-button').onclick=showMenu;$('help-button').onclick=showHelp;$('home-button').onclick=centerHome;$('age-display').onclick=centerHome;$('explore-button').onclick=centerScout;$('idle-button').onclick=selectIdle;$('zoom-in').onclick=()=>setZoom(renderer.zoom+.1);$('zoom-out').onclick=()=>setZoom(renderer.zoom-.1);$('dismiss-tutorial').onclick=hideTutorial;$('objective-toggle').onclick=()=>{const content=$('objective-content');content.hidden=!content.hidden;$('objective-toggle').textContent=content.hidden?'+':'−';};document.querySelector('.brand').onclick=e=>{e.preventDefault();showMenu();};
window.addEventListener('resize',()=>renderer.resize());
function exposeGame(){window.__game=game;window.__renderer=renderer;window.__select=ids=>select(ids);window.__app={setPaused,resetGame,showHelp,centerHome,get speed(){return speed;},set speed(v){speed=v;},get paused(){return paused}};}
function frame(now){
  const dt=Math.min(.08,(now-lastFrame)/1000||0);lastFrame=now;
  if(!paused&&game.state==='playing')game.update(dt*speed);
  if($('modal-backdrop').hidden){const amt=dt*650;let dx=0,dy=0;if(keys.has('w')||keys.has('arrowup'))dy+=amt;if(keys.has('s')||keys.has('arrowdown'))dy-=amt;if(keys.has('a')||keys.has('arrowleft'))dx+=amt;if(keys.has('d')||keys.has('arrowright'))dx-=amt;
    if(pointer.inside&&!drag&&!panDrag&&!placement){const r=canvas.getBoundingClientRect();if(pointer.x-r.left<7)dx+=amt;if(r.right-pointer.x<7)dx-=amt;if(pointer.y-r.top<7)dy+=amt;if(r.bottom-pointer.y<7)dy-=amt;}
    if(attackMode&&keys.has('a')&&!keys.has('arrowleft'))dx=0;if(dx||dy){renderer.pan(dx,dy);if(placement)updatePlacement();}}
  renderer.render(now/1000);
  if(renderer.commandMarker){const m=renderer.commandMarker,t=now/1000-m.time;if(t<1){const p=renderer.worldToScreen(m.x,m.y),ctx=canvas.getContext('2d'),dpr=renderer.dpr||1;ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1-t;ctx.strokeStyle=m.attack?'#df7d57':'#f1dfa0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,14+t*25,7+t*12,0,0,Math.PI*2);ctx.stroke();ctx.restore();}else renderer.commandMarker=null;}
  hudTimer+=dt;minimapTimer+=dt;if(hudTimer>.3){updateHUD();hudTimer=0;}if(minimapTimer>.2){renderer.drawMinimap(minimap);minimapTimer=0;}
  const unread=lastEvent?game.events.slice(game.events.indexOf(lastEvent)+1):game.events;for(const ev of unread){if(ev.text){const type=ev.type==='danger'?'attack':['train','build','research'].includes(ev.type)?'success':ev.type;notify(ev.text,type);if(type==='age')sound.play('age');else if(type==='attack')sound.play('attack');else if(type==='success')sound.play('complete');}}lastEvent=game.events.at(-1);
  if(game.state!=='playing'&&!finishedShown)showResult();requestAnimationFrame(frame);
}
renderer.resize();centerHome();setZoom(.95);exposeGame();updateHUD(true);requestAnimationFrame(frame);
