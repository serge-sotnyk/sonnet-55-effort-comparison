import {Game,UNIT_TYPES,BUILDING_TYPES,AGE_NAMES,AGE_COSTS,RESEARCH_TYPES} from './engine.js';
import {Renderer} from './renderer.js';
import {icon,art} from './icons.js';

const $=id=>document.getElementById(id);
const game=new Game();
const renderer=new Renderer($('world'),game);
window.game=game;window.renderer=renderer;
const canvas=$('world');
let tab='context',placement=null,rallyMode=false,lastHUD=0,lastSelection='',actionSignature='',shownResult=null;
let previousTime=performance.now(),mouse={x:0,y:0,inside:false},drag=null,edgePan=false;
const keys=new Set(),controlGroups={},seenEvents=new WeakSet();
let soundEnabled=false,audioCtx=null,lastSound=0;
const titleCase=s=>s.replace(/\b\w/g,c=>c.toUpperCase());
const defs=e=>e?.kind==='unit'?UNIT_TYPES[e.type]:BUILDING_TYPES[e?.type];
const prettyTime=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const costs=c=>Object.entries(c||{}).map(([r,n])=>`<span class="cost-item cost-${r}">${icon(r)}${n}</span>`).join('');
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
hydrateIcons();
function chime(kind='select'){
 if(!soundEnabled)return;
 try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();if(audioCtx.currentTime-lastSound<.045)return;lastSound=audioCtx.currentTime;const notes=kind==='success'?[392,494,587]:kind==='command'?[196,247]:kind==='build'?[147,220]:[330];notes.forEach((freq,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime+i*.08;o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.045,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.23);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+.25);});}catch{}
}
function select(ids,append=false){game.select(append?[...game.selectedIds,...ids]:ids);tab='context';actionSignature='';updateHUD();chime();}
select([game.buildings.find(b=>b.owner==='player'&&b.type==='towncenter').id]);
function findBuilding(type){return game.buildings.find(b=>b.owner==='player'&&b.type===type&&b.built>=1);}
function setTab(value){tab=value;actionSignature='';updateHUD();}
function notify(text,tone='info'){game.notify(text,tone);updateHUD();}
function startBuild(type){
 const d=BUILDING_TYPES[type];if(game.age<d.age){notify(`Requires the ${AGE_NAMES[d.age]}.`,'warning');return;}
 if(!game.canAfford(d.cost)){notify(`Not enough resources to build ${d.name.toLowerCase()}.`,'warning');return;}
 if(!game.units.some(u=>u.owner==='player'&&u.type==='villager')){notify('You need a villager to construct buildings.','warning');return;}
 placement=type;rallyMode=false;canvas.classList.add('placing');$('placement-banner').classList.remove('hidden');$('placement-text').textContent=`Place ${titleCase(d.name)} · ${Object.entries(d.cost).map(([r,n])=>`${n} ${r}`).join(', ')}`;
 const p=renderer.screenToWorld(mouse.inside?mouse.x:renderer.width/2,mouse.inside?mouse.y:renderer.height/2);updatePlacement(p);hideTooltip();chime('build');
}
function updatePlacement(p){if(!placement)return;const x=Math.round(p.x*2)/2,y=Math.round(p.y*2)/2;renderer.placement={type:placement,x,y,size:BUILDING_TYPES[placement].size,valid:game.validPlacement(placement,x,y)};}
function cancelPlacement(){placement=null;renderer.placement=null;rallyMode=false;canvas.classList.remove('placing');$('placement-banner').classList.add('hidden');}
function actionCard({label,type,cost={},action,disabled=false,lock='',description='',shortcut='',gold=false,progress=null}){
 return `<button class="action-card${disabled?' disabled':''}${gold?' gold-action':''}" data-action="${action}" ${action.startsWith('build:')?`data-build="${action.split(':')[1]}"`:''} data-tip="${label}" data-description="${description.replaceAll('"','&quot;')}" data-cost="${Object.entries(cost).map(([k,v])=>`${v} ${k}`).join(' · ')}" data-lock="${lock}" title="${label}${lock?` · ${lock}`:''}">${shortcut?`<span class="shortcut">${shortcut}</span>`:''}<span class="action-art">${art(type)}</span><span class="action-name">${label}</span><span class="action-cost">${progress!==null?`${Math.floor(progress*100)}% complete`:costs(cost)}</span></button>`;
}
function renderActions(selection){
 const primary=selection[0];const owner=primary?.owner==='player';
 const sig=JSON.stringify([tab,selection.map(e=>e.id),game.age,game.ageProgress!==null,[...game.researched],game.researchQueue.map(r=>r.key),Object.entries(game.stock).map(([k,v])=>[k,Math.floor(v/10)]),primary?.built>=1,game.population>=game.populationCap]);
 if(sig===actionSignature)return;actionSignature=sig;
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 $('tab-context').textContent=primary?.kind==='building'?titleCase(defs(primary).name).toUpperCase():primary?.kind==='unit'?(selection.length>1?'UNIT COMMANDS':primary.type.toUpperCase()):'COMMANDS';
 let cards=[];
 const buildCard=t=>{const d=BUILDING_TYPES[t];return actionCard({label:titleCase(d.name),type:t,cost:d.cost,action:`build:${t}`,description:d.description,disabled:game.age<d.age||!game.canAfford(d.cost),lock:game.age<d.age?`Requires ${AGE_NAMES[d.age]}`:''});};
 const trainCard=t=>{const d=UNIT_TYPES[t];return actionCard({label:d.name,type:t,cost:d.cost,action:`train:${t}`,description:d.description+` Training time: ${d.trainTime}s.`,disabled:game.age<d.age||!game.canAfford(d.cost),lock:game.age<d.age?`Requires ${AGE_NAMES[d.age]}`:'',shortcut:t==='villager'?'Q':t==='militia'?'Q':''});};
 const researchCard=key=>{const d=RESEARCH_TYPES[key],done=game.researched.has(key),queued=game.researchQueue.some(r=>r.key===key);return actionCard({label:d.name,type:key==='wheelbarrow'?'ram':'upgrade',cost:done||queued?{}:d.cost,action:`research:${key}`,description:d.description,disabled:done||queued||game.age<d.age||!game.canAfford(d.cost),lock:done?'Already researched':queued?'Research in progress':game.age<d.age?`Requires ${AGE_NAMES[d.age]}`:''});};
 if(tab==='build'||(tab==='context'&&primary?.type==='villager'&&owner)){
 cards=['house','farm','barracks','archery','stable','tower','castle'].map(buildCard);$('queue-label').textContent='GROW YOUR SETTLEMENT';
 }else if(tab==='army'){
 cards=['militia','archer','knight','ram'].map(trainCard);cards.push(researchCard('forging'),researchCard('armor'),researchCard('fletching'));$('queue-label').textContent='TRAIN & UPGRADE';
 }else if(primary?.kind==='building'&&owner){
 const d=defs(primary);cards=(d.trains||[]).map(trainCard);
 if(primary.type==='towncenter'){
 if(game.age<3)cards.push(actionCard({label:game.ageProgress!==null?'Advancing…':AGE_NAMES[game.age+1],type:'age',cost:AGE_COSTS[game.age],action:'age',description:`Advance to the ${AGE_NAMES[game.age+1]} to unlock new buildings, soldiers, and technologies.`,disabled:game.ageProgress!==null||!game.canAfford(AGE_COSTS[game.age]),shortcut:'U',gold:true,progress:game.ageProgress}));
 cards.push(researchCard('wheelbarrow'));
 }
 if((d.trains||[]).length)cards.push(actionCard({label:'Rally point',type:'rally',action:'rally',description:'Click a location to send newly trained soldiers there. You can also right-click the map with a building selected.',shortcut:'R'}));
 if(primary.type==='farm')cards.push(actionCard({label:'Assign worker',type:'villager',action:'farm-worker',description:'Send the nearest available villager to gather food from this farm.'}));
 cards.push(buildCard('house'),buildCard('farm'));
 $('queue-label').textContent=primary.built<1?'UNDER CONSTRUCTION':'TRAIN & DEVELOP';
 }else if(primary?.kind==='unit'&&owner){
 cards.push(actionCard({label:'Hold position',type:'militia',action:'stop',description:'Stop current orders and defend this position.',shortcut:'X'}),actionCard({label:'Select army',type:'knight',action:'army',description:'Select all of your military units. Right-click the enemy Town Center to attack.',shortcut:'F2'}),actionCard({label:'Find rival',type:'rally',action:'enemy',description:'Move the camera to the Crimson Kingdom.'}));
 cards.push(researchCard('forging'),researchCard('armor'));$('queue-label').textContent='COMMAND YOUR FORCES';
 }else{
 cards.push(actionCard({label:'Town Center',type:'towncenter',action:'home',description:'Return to your Town Center.',shortcut:'H'}),actionCard({label:'Idle villagers',type:'villager',action:'idle',description:'Find villagers waiting for a task.',shortcut:'.'}),actionCard({label:'Select army',type:'knight',action:'army',description:'Select all military units.',shortcut:'F2'}),...['house','farm','barracks'].map(buildCard));$('queue-label').textContent='YOUR KINGDOM AWAITS';
 }
 $('actions').innerHTML=cards.join('');
}
function runAction(action){
 const [cmd,arg]=action.split(':');const selected=game.getSelection();let b=selected.find(e=>e.kind==='building'&&e.owner==='player');
 if(cmd==='build')startBuild(arg);
 else if(cmd==='train'){
 const d=UNIT_TYPES[arg];if(!b||!BUILDING_TYPES[b.type].trains.includes(arg))b=findBuilding(d.building)||game.buildings.find(e=>e.owner==='player'&&e.built>=1&&BUILDING_TYPES[e.type].trains.includes(arg));
 if(!b){notify(`Build a ${BUILDING_TYPES[d.building].name.toLowerCase()} to train ${d.name.toLowerCase()}.`,'warning');return;}
 if(game.train(b.id,arg)){chime('build');if(!game.selectedIds.has(b.id))select([b.id]);}
 }else if(cmd==='age'){if(game.advanceAge())chime('success');}
 else if(cmd==='research'){if(game.research(arg))chime('build');}
 else if(cmd==='rally'){rallyMode=true;$('placement-banner').classList.remove('hidden');$('placement-text').textContent='Choose a rally point for new soldiers';canvas.classList.add('placing');}
 else if(cmd==='stop'){game.stopSelected();chime('command');}
 else if(cmd==='army'){const army=game.units.filter(u=>u.owner==='player'&&u.type!=='villager');select(army.map(u=>u.id));if(army.length)renderer.centerOn(army[0].x,army[0].y);else notify('Train soldiers at your barracks first.');}
 else if(cmd==='enemy')centerEnemy();
 else if(cmd==='home')goHome();
 else if(cmd==='idle'){const v=game.idleVillagers[0];if(v){select([v.id]);renderer.centerOn(v.x,v.y);}else notify('All of your villagers are working.');}
 else if(cmd==='farm-worker'&&b){const v=game.units.filter(u=>u.type==='villager'&&u.owner==='player'&&u.action!=='build').sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];if(v){game.select([v.id]);game.command(b.x,b.y,b.id);select([v.id]);}}
 actionSignature='';updateHUD();
}
$('actions').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)runAction(b.dataset.action);});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));

function updateHUD(){
 for(const key of ['food','wood','gold','stone']){$(`res-${key}`).textContent=Math.floor(game.stock[key]);const workers=game.units.filter(u=>u.owner==='player'&&u.type==='villager'&&u.action==='gather'&&u.carryType===key).length;$(`workers-${key}`).textContent=workers?`+${workers}`:'';}
 $('res-population').innerHTML=`${game.population} <b>/ ${game.populationCap}</b>`;$('res-population').style.color=game.population>=game.populationCap?'#dfaa82':'';
 $('age-number').textContent=['I','II','III','IV'][game.age];$('age-name').textContent=AGE_NAMES[game.age];$('age-status').textContent=game.ageProgress!==null?`ADVANCING · ${Math.floor(game.ageProgress*100)}%`:['THE DAWN OF AN EMPIRE','AN AGE OF POSSIBILITY','THE RISE OF YOUR KINGDOM','AN EMPIRE FOR THE AGES'][game.age];
 $('match-time').textContent=prettyTime(game.time);$('speed-button').textContent=`${game.speed}×`;$('pause-button').innerHTML=icon(game.paused?'play':'pause');$('pause-button').setAttribute('aria-label',game.paused?'Resume':'Pause');$('pause-overlay').classList.toggle('hidden',!game.paused||!$('modal').classList.contains('hidden'));$('zoom-label').textContent=`${Math.round(renderer.zoom*100)}%`;
 const vill=game.units.filter(u=>u.owner==='player'&&u.type==='villager').length,army=game.militaryCount;
 $('goal-economy-value').textContent=`${vill}/10`;$('goal-army-value').textContent=`${army}/12`;$('goal-economy').classList.toggle('complete',vill>=10);$('goal-army').classList.toggle('complete',army>=12);$('goal-age').classList.toggle('complete',game.age>=1);
 const s=game.getSelection(),primary=s[0];const sig=game.age+':'+s.map(e=>e.id).join(',');
 if(sig!==lastSelection){lastSelection=sig;const d=defs(primary);$('selection-portrait').innerHTML=primary?art(primary.type):art('crown');$('selection-name').textContent=s.length>1?`${s.length} units selected`:d?titleCase(d.name):primary?.kind==='resource'?titleCase(primary.type):'Your Kingdom';$('selection-description').textContent=s.length>1?'Right-click to move or attack. Your soldiers will engage enemies along the way.':d?.description||(primary?.kind==='resource'?({tree:'A source of wood. Select villagers and right-click this forest to send them to work.',gold:'A rich gold deposit. Send villagers to mine gold for soldiers, upgrades, and new ages.',stone:'Mine stone to construct watchtowers and castles that protect your kingdom.',berries:'A natural food source. Send villagers to gather berries for your growing settlement.'}[primary.type]):'Select a unit or building to see its commands.');$('selection-kind').textContent=primary?.owner==='enemy'?'THE CRIMSON KINGDOM':primary?.kind==='unit'?(primary.type==='villager'?'WORKER · ECONOMY':'SOLDIER · MILITARY'):primary?.kind==='resource'?'NATURAL RESOURCE':`ECONOMY · ${AGE_NAMES[game.age].toUpperCase()}`;$('selection-count').textContent=s.length>1?`${s.length} SELECTED`:'';}
 const hp=s.reduce((n,e)=>n+(e.hp||e.amount||0),0),max=s.reduce((n,e)=>n+(e.maxHp||e.maxAmount||0),0);$('selection-health').style.width=`${max?Math.max(0,hp/max*100):100}%`;$('selection-hp').textContent=max?`${Math.ceil(hp)} / ${Math.ceil(max)}`:'READY TO COMMAND';
 if(primary?.queue?.length){$('selection-orders').innerHTML=`<span class="queue-pill">Training ${UNIT_TYPES[primary.queue[0].type].name} · ${Math.floor(primary.queue[0].progress*100)}%</span><button id="cancel-queue" title="Cancel last queued unit and refund cost">${primary.queue.length} queued ×</button>`;$('cancel-queue').onclick=()=>game.cancelTraining(primary.id);}
 else if(primary?.built<1){$('selection-orders').innerHTML=`<span class="queue-pill">Construction · ${Math.floor(primary.built*100)}%</span>`;}
 else if(primary?.kind==='unit'){$('selection-orders').innerHTML=`<span>${{idle:'Awaiting your command',move:'Moving to destination',gather:`Gathering ${primary.carryType||'resources'}`,build:'Constructing your settlement',attack:'Engaging the enemy'}[primary.action]||'Ready'}</span>`;}
 else $('selection-orders').innerHTML=game.idleVillagers.length?`<button data-idle> ${game.idleVillagers.length} idle villagers · Select</button>`:'<span>◆ &nbsp; For the glory of the Azure Kingdom</span>';
 renderActions(s);
 for(const event of [...game.events].reverse()){if(seenEvents.has(event))continue;seenEvents.add(event);if(game.time-event.time>5)continue;toast(event.text,event.tone);if(event.tone==='good')chime('success');}
 if(game.result&&shownResult!==game.result){shownResult=game.result;showResult();}
}
$('selection-orders').addEventListener('click',e=>{if(e.target.closest('[data-idle]'))runAction('idle');});
function toast(text,tone){const el=document.createElement('div');el.className=`toast ${tone==='good'?'success':tone}`;el.textContent=text;$('notifications').append(el);while($('notifications').children.length>3)$('notifications').firstChild.remove();setTimeout(()=>el.classList.add('fade'),4300);setTimeout(()=>el.remove(),4800);}

function hitTest(x,y){
 const p=renderer.screenToWorld(x,y);let found=null,best=Infinity;
 for(const u of game.units){const q=renderer.worldToScreen(u.x,u.y);const d=Math.hypot((q.x-x),((q.y-10*renderer.zoom)-y)*1.1);if(d<20*renderer.zoom+6&&d<best){best=d;found=u;}}
 if(found)return found;
 const buildings=[...game.buildings].sort((a,b)=>(b.x+b.y)-(a.x+a.y));
 for(const b of buildings){const q=renderer.worldToScreen(b.x,b.y),w=b.size*34*renderer.zoom,h=(b.type==='towncenter'||b.type==='castle'?105:b.type==='tower'?100:b.type==='farm'?20:65)*renderer.zoom;if(Math.abs(p.x-b.x)<b.size*.52&&Math.abs(p.y-b.y)<b.size*.52)return b;if(Math.abs(x-q.x)<w*.62&&y<q.y&&y>q.y-h)return b;}
 for(const r of game.resources){if(r.amount<=0)continue;const q=renderer.worldToScreen(r.x,r.y),yoff=r.type==='tree'?25:10;const d=Math.hypot(q.x-x,q.y-yoff*renderer.zoom-y);if(d<(r.type==='tree'?25:22)*renderer.zoom&&d<best){best=d;found=r;}}
 return found;
}
window.hitTest=hitTest;
function localPos(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{
 if(e.button===2)return;
 const p=localPos(e);mouse={...p,inside:true};
 if(e.button===1||e.altKey){drag={mode:'pan',start:p,last:p};canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
 if(e.button!==0)return;
 if(placement){const ghost=renderer.placement;if(ghost){const b=game.build(placement,ghost.x,ghost.y);if(b){chime('build');if(!e.shiftKey){cancelPlacement();select([b.id]);}else updatePlacement(renderer.screenToWorld(p.x,p.y));}}return;}
 if(rallyMode){const w=renderer.screenToWorld(p.x,p.y);for(const b of game.getSelection().filter(e=>e.kind==='building'))game.setRally(b.id,w.x,w.y);renderer.moveMarkers.push({...w,life:1});cancelPlacement();notify('Rally point set.');return;}
 drag={mode:'select',start:p,last:p,shift:e.shiftKey};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 const p=localPos(e);mouse={...p,inside:true};const w=renderer.screenToWorld(p.x,p.y);renderer.hover=w;
 if(placement)updatePlacement(w);
 if(drag?.mode==='pan'){renderer.pan(drag.last.x-p.x,drag.last.y-p.y);drag.last=p;}
 else if(drag?.mode==='select'){drag.last=p;if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>6){const box=$('selection-box');box.classList.remove('hidden');Object.assign(box.style,{left:`${Math.min(p.x,drag.start.x)}px`,top:`${Math.min(p.y,drag.start.y)}px`,width:`${Math.abs(p.x-drag.start.x)}px`,height:`${Math.abs(p.y-drag.start.y)}px`});}}
 else if(!placement&&!rallyMode){const target=hitTest(p.x,p.y);canvas.style.cursor=target?.owner==='enemy'&&game.getSelection().some(u=>u.kind==='unit')?'crosshair':target?'pointer':'default';}
});
canvas.addEventListener('pointerup',e=>{
 if(!drag)return;const p=localPos(e),d=drag;drag=null;$('selection-box').classList.add('hidden');
 if(d.mode==='pan')return;
 if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>6){const ids=game.units.filter(u=>{if(u.owner!=='player')return false;const q=renderer.worldToScreen(u.x,u.y);return q.x>=Math.min(d.start.x,p.x)&&q.x<=Math.max(d.start.x,p.x)&&q.y>=Math.min(d.start.y,p.y)&&q.y<=Math.max(d.start.y,p.y);}).map(u=>u.id);select(ids,d.shift);}
 else{const target=hitTest(p.x,p.y);select(target?[target.id]:[],d.shift);}
});
canvas.addEventListener('dblclick',e=>{const p=localPos(e),t=hitTest(p.x,p.y);if(t?.kind==='unit'&&t.owner==='player')select(game.units.filter(u=>u.type===t.type&&u.owner==='player').map(u=>u.id));});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(placement||rallyMode){cancelPlacement();return;}const p=localPos(e),w=renderer.screenToWorld(p.x,p.y),target=hitTest(p.x,p.y);if(game.command(w.x,w.y,target?.id)){renderer.moveMarkers.push({...w,life:1});chime('command');}else notify('Select your villagers or soldiers to give an order.');updateHUD();});
canvas.addEventListener('wheel',e=>{e.preventDefault();renderer.zoomBy(e.deltaY>0?.91:1.1);updateHUD();},{passive:false});
canvas.addEventListener('pointerleave',()=>{mouse.inside=false;});
canvas.addEventListener('pointercancel',()=>{drag=null;$('selection-box').classList.add('hidden');});
window.addEventListener('blur',()=>{keys.clear();drag=null;$('selection-box').classList.add('hidden');});
window.addEventListener('resize',()=>renderer.resize());
new ResizeObserver(()=>renderer.resize()).observe(canvas);
function goHome(){const b=findBuilding('towncenter');if(b){renderer.centerOn(b.x,b.y+1);select([b.id]);}cancelPlacement();}
function centerEnemy(){const b=game.buildings.find(b=>b.type==='towncenter'&&b.owner==='enemy');if(b)renderer.centerOn(b.x,b.y+1);chime();}
$('home-button').onclick=goHome;$('find-enemy').onclick=centerEnemy;
$('zoom-in').onclick=()=>{renderer.zoomBy(1.12);updateHUD();};$('zoom-out').onclick=()=>{renderer.zoomBy(.89);updateHUD();};
function pause(){game.paused=!game.paused;updateHUD();}
$('pause-button').onclick=pause;$('speed-button').onclick=()=>{game.speed=game.speed===1?1.5:game.speed===1.5?2:1;updateHUD();};
$('age-button').onclick=()=>runAction('age');
$('sound-button').onclick=()=>{soundEnabled=!soundEnabled;$('sound-button').innerHTML=icon(soundEnabled?'volume':'volume-off');$('sound-button').title=soundEnabled?'Mute sound':'Enable sound';chime('success');};
$('objectives-toggle').onclick=()=>{$('objectives-content').classList.toggle('hidden');$('objectives-toggle').textContent=$('objectives-content').classList.contains('hidden')?'+':'−';};
window.addEventListener('keydown',e=>{
 if(e.target.matches('input,textarea'))return;
 if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F2','Tab'].includes(e.key))e.preventDefault();
 if(!$('modal').classList.contains('hidden')){if(e.key==='Escape')closeModal();return;}
 if(e.repeat&& !['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
 keys.add(e.key.toLowerCase());
 if(e.key==='Escape'){cancelPlacement();hideTooltip();}
 else if(e.key===' ')pause();
 else if(e.key.toLowerCase()==='h')goHome();
 else if(e.key.toLowerCase()==='b')setTab('build');
 else if(e.key.toLowerCase()==='u')runAction('age');
 else if(e.key.toLowerCase()==='q'){const b=game.getSelection().find(e=>e.kind==='building'&&e.owner==='player');const t=b&&BUILDING_TYPES[b.type].trains[0];if(t)runAction(`train:${t}`);}
 else if(e.key.toLowerCase()==='r')runAction('rally');
 else if(e.key.toLowerCase()==='x')runAction('stop');
 else if(e.key==='F2')runAction('army');
 else if(e.key==='.')runAction('idle');
 else if(e.key==='?'||e.key==='F1'){e.preventDefault();showGuide();}
 else if(e.key==='+'||e.key==='=')renderer.zoomBy(1.1);
 else if(e.key==='-')renderer.zoomBy(.9);
 else if(/^[1-9]$/.test(e.key)){if(e.ctrlKey||e.metaKey){e.preventDefault();controlGroups[e.key]=[...game.selectedIds];notify(`Control group ${e.key} assigned.`);}else if(controlGroups[e.key])select(controlGroups[e.key]);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

const mini=$('minimap'),mc=mini.getContext('2d');
function miniPoint(x,y){return {x:mini.width/2+(x-y)*mini.width/88,y:5+(x+y)*(mini.height-10)/88};}
function drawMinimap(){
 const w=mini.width,h=mini.height;mc.clearRect(0,0,w,h);mc.fillStyle='#253e2c';mc.fillRect(0,0,w,h);
 mc.beginPath();mc.moveTo(w/2,5);mc.lineTo(w,h/2);mc.lineTo(w/2,h-5);mc.lineTo(0,h/2);mc.closePath();mc.fillStyle='#7e9561';mc.fill();mc.strokeStyle='#a4b48366';mc.stroke();
 for(const r of game.resources){if(r.amount<=0)continue;const p=miniPoint(r.x,r.y);mc.fillStyle=r.type==='tree'?'#36583a':r.type==='gold'?'#d6bf6d':r.type==='stone'?'#c3c2a5':'#a7b174';mc.fillRect(p.x-1,p.y-1,2.5,2);}
 for(const b of game.buildings){const p=miniPoint(b.x,b.y);mc.fillStyle=b.owner==='player'?'#89bedb':'#d37563';const z=b.type==='towncenter'?5:3;mc.fillRect(p.x-z/2,p.y-z/2,z,z);}
 for(const u of game.units){const p=miniPoint(u.x,u.y);mc.fillStyle=u.owner==='player'?'#b9d9df':'#e39b7b';mc.fillRect(p.x-.75,p.y-.75,1.5,1.5);}
 const corners=[[0,0],[renderer.width,0],[renderer.width,renderer.height],[0,renderer.height]].map(([x,y])=>{const p=renderer.screenToWorld(x,y);return miniPoint(p.x,p.y);});mc.beginPath();corners.forEach((p,i)=>i?mc.lineTo(p.x,p.y):mc.moveTo(p.x,p.y));mc.closePath();mc.fillStyle='#e4e6ba10';mc.fill();mc.strokeStyle='#efe7babb';mc.lineWidth=1;mc.stroke();
}
function navigateMini(e){const r=mini.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*mini.width,py=(e.clientY-r.top)/r.height*mini.height,sx=(px-mini.width/2)/(mini.width/88),sy=(py-5)/((mini.height-10)/88);const x=Math.max(1,Math.min(43,(sx+sy)/2)),y=Math.max(1,Math.min(43,(sy-sx)/2));if(e.button===2){game.command(x,y);chime('command');}else renderer.centerOn(x,y);}
mini.addEventListener('pointerdown',e=>{e.preventDefault();navigateMini(e);});mini.addEventListener('pointermove',e=>{if(e.buttons===1)navigateMini(e);});mini.addEventListener('contextmenu',e=>e.preventDefault());

const tips=[['Your kingdom starts with you','Select a villager, then <b>right-click</b> trees, berries, or gold to gather. Build an economy worthy of an empire.'],['Many hands make a kingdom','Select your Town Center and train villagers with <b>Q</b>. New workers will start gathering automatically.'],['Make room for greatness','Open the <b>Build</b> tab to place houses, farms, and military buildings. Nearby villagers handle construction.'],['A new age is calling','Save <b>400 food</b> and advance to the Feudal Age. Archers, watchtowers, and new upgrades await.'],['For the Azure Kingdom','Press <b>F2</b> to select your army. Locate the rival on the minimap, then right-click their Town Center to attack.'],['The art of command','Drag to select a group. Hold <b>Shift</b> to add units. Use <b>Ctrl + 1–9</b> to save a control group.']];let tipIndex=0;
$('next-tip').onclick=()=>{tipIndex=(tipIndex+1)%tips.length;const card=$('tutorial-card');card.querySelector('strong').textContent=tips[tipIndex][0];card.querySelector('p').innerHTML=tips[tipIndex][1];};$('dismiss-tutorial').onclick=()=>{$('tutorial-card').classList.add('hidden');};
let wasPaused=false;
function openModal(title,body){wasPaused=game.paused;game.paused=true;keys.clear();$('modal-title').textContent=title;$('modal-body').innerHTML=body;$('modal').classList.remove('hidden');updateHUD();}
function closeModal(){if(shownResult&&game.result){$('modal').classList.add('hidden');return;}game.paused=wasPaused;$('modal').classList.add('hidden');updateHUD();}
$('modal-close').onclick=closeModal;$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
function showGuide(){openModal('Your field guide',`<p>Grow a medieval settlement into an empire.<br>Destroy the Crimson Kingdom’s Town Center to win.</p><div class="guide-row"><span><kbd>LEFT CLICK</kbd> / drag</span><span>Select a building, one unit, or an entire group.</span></div><div class="guide-row"><span><kbd>RIGHT CLICK</kbd></span><span>Move, gather resources, construct, or attack a target.</span></div><div class="guide-row"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows</span><span>Explore the map. Alt-drag or middle-drag also pans.</span></div><div class="guide-row"><span><kbd>H</kbd> <kbd>B</kbd> <kbd>Q</kbd> <kbd>U</kbd></span><span>Home · Build · Train a unit · Advance age</span></div><div class="guide-row"><span><kbd>F2</kbd> <kbd>.</kbd> <kbd>X</kbd></span><span>Select army · Idle villager · Stop orders</span></div><div class="guide-row"><span><kbd>SPACE</kbd> / scroll</span><span>Pause the game / zoom the battlefield.</span></div><p class="guide-note">Villagers gather automatically when trained. Houses add population space. Farms provide lasting food. Develop your economy before the first enemy raid, then combine infantry, archers, knights, and siege to break their defenses.</p><button class="primary-button" id="resume-game">RETURN TO YOUR KINGDOM</button>`);$('resume-game').onclick=closeModal;}
$('help-button').onclick=showGuide;
$('menu-button').onclick=()=>{openModal('A moment of peace',`<p>The Azure Kingdom is in your hands.<br>Your game is paused while this menu is open.</p><button class="primary-button" id="resume-game">RESUME GAME</button><button class="secondary-button" id="show-guide">HOW TO PLAY</button><div style="margin-top:20px"><button class="secondary-button" id="restart-game">START A NEW KINGDOM</button></div><p style="font-size:9px;margin-top:24px">An original browser tribute to classic medieval real-time strategy.</p>`);$('resume-game').onclick=closeModal;$('show-guide').onclick=()=>{game.paused=wasPaused;showGuide();};$('restart-game').onclick=confirmRestart;};
function confirmRestart(){$('modal-title').textContent='Begin a new reign?';$('modal-body').innerHTML='<p>Your current settlement will be replaced with a fresh kingdom.</p><button class="primary-button" id="confirm-restart">START NEW GAME</button><button class="secondary-button" id="keep-game">KEEP PLAYING</button>';$('confirm-restart').onclick=restartGame;$('keep-game').onclick=closeModal;}
function restartGame(){game.restart();shownResult=null;placement=null;renderer.placement=null;cancelPlacement();renderer.centerOn(11,12);renderer.zoom=.96;lastSelection='';actionSignature='';$('modal').classList.add('hidden');$('notifications').innerHTML='';$('tutorial-card').classList.remove('hidden');goHome();updateHUD();}
function showResult(){const win=game.result==='victory';chime('success');openModal(win?'A crown well earned':'Your kingdom has fallen',`<p>${win?'The Crimson Keep is yours. Your people will remember this day.':'The Crimson Kingdom has taken your Town Center. A new reign awaits.'}</p><div class="stats-row"><div><strong>${prettyTime(game.time)}</strong><small>TIME PLAYED</small></div><div><strong>${game.kills}</strong><small>FOES DEFEATED</small></div><div><strong>${AGE_NAMES[game.age].split(' ')[0]}</strong><small>AGE REACHED</small></div></div><button class="primary-button" id="play-again">BEGIN A NEW REIGN</button><button class="secondary-button" id="view-map">VIEW BATTLEFIELD</button>`);$('play-again').onclick=restartGame;$('view-map').onclick=closeModal;}

function hideTooltip(){$('tooltip').classList.add('hidden');}
$('actions').addEventListener('pointerover',e=>{const b=e.target.closest('[data-tip]');if(!b)return;const t=$('tooltip');t.innerHTML=`<strong>${b.dataset.tip}</strong>${b.dataset.description}<div class="tip-costs">${b.dataset.cost}</div>${b.dataset.lock?`<div class="tip-lock">${b.dataset.lock}</div>`:''}`;t.classList.remove('hidden');const r=b.getBoundingClientRect();t.style.left=`${Math.min(innerWidth-270,Math.max(10,r.left))}px`;t.style.top=`${r.top-t.offsetHeight-12}px`;});$('actions').addEventListener('pointerout',hideTooltip);
function frame(now){
 const dt=Math.min((now-previousTime)/1000,.08);previousTime=now;
 game.update(dt);
 if($('modal').classList.contains('hidden')){const pace=420*dt;let dx=0,dy=0;if(keys.has('a')||keys.has('arrowleft'))dx-=pace;if(keys.has('d')||keys.has('arrowright'))dx+=pace;if(keys.has('w')||keys.has('arrowup'))dy-=pace;if(keys.has('s')||keys.has('arrowdown'))dy+=pace;if(edgePan&&mouse.inside&&!drag){if(mouse.x<8)dx-=pace;if(mouse.x>renderer.width-8)dx+=pace;if(mouse.y<8)dy-=pace;if(mouse.y>renderer.height-8)dy+=pace;}if(dx||dy){renderer.pan(dx,dy);if(placement)updatePlacement(renderer.screenToWorld(mouse.x,mouse.y));}}
 renderer.render(dt);
 if(now-lastHUD>180){updateHUD();drawMinimap();lastHUD=now;}
 requestAnimationFrame(frame);
}
updateHUD();drawMinimap();requestAnimationFrame(frame);
