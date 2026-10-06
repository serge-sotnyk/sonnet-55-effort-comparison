import {Game} from './game.js';
import {Renderer} from './renderer.js';
import {AudioEngine} from './audio.js';
import {BUILDINGS,UNITS,TECHS,AGES,ROMAN,AGE_COSTS,AGE_TIMES,RESOURCE_NAMES,icon,dist} from './data.js';
const $=id=>document.getElementById(id);
const SAVE_KEY='crown-conquest-save-v1';
let game;
try{const save=localStorage.getItem(SAVE_KEY);game=save?Game.load(save):new Game();if(game.ended)game=new Game();}catch{game=new Game();}
const renderer=new Renderer($('world'),$('minimap'),game),audio=new AudioEngine();
const ui={tab:'economy',placement:null,orderMode:null,commandKey:'',portraitKey:'',queueKey:'',modal:null,wasPaused:false,journeyOpen:true,drag:null,keys:new Set(),pointer:{x:0,y:0},lastSelection:'',selectedDifficulty:'standard',lastAttackEntity:null};
for(const el of document.querySelectorAll('[data-icon]'))el.innerHTML=icon(el.dataset.icon);
$('resources').innerHTML=['food','wood','gold','stone','population'].map(r=>`<div class="resource ${r}" id="res-${r}" title="${r==='population'?'Population / housing capacity':RESOURCE_NAMES[r]}">${icon(r)}<div><span class="res-label">${r==='population'?'Population':RESOURCE_NAMES[r]}</span><strong id="value-${r}">0</strong></div></div>`).join('');
const fmt=n=>Math.floor(n).toLocaleString('en-US');
const clock=n=>`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
function bindGame(){game.onEvent=e=>{
  if(e.text&&e.type!=='trained'&&e.type!=='build')toast(e.text,e.type);
  audio.play(e.type);
  if(e.type==='end')setTimeout(()=>showEnd(),650);
  if(e.type==='attack')ui.lastAttackEntity=e.entity?.id;
};}
bindGame();
function toast(text,type='info'){const el=document.createElement('div');el.className=`toast ${['error','success','warning','attack'].includes(type)?(type==='attack'?'warning':type):''}`;el.textContent=text;$('toasts').append(el);setTimeout(()=>el.remove(),type==='age'?7000:4200);while($('toasts').children.length>3)$('toasts').firstChild.remove();}
function refresh(force=false){
  const p=game.players[0];
  for(const r of ['food','wood','gold','stone'])$('value-'+r).textContent=fmt(p.resources[r]);
  const pop=game.population(),cap=game.capacity();$('value-population').innerHTML=`${pop}<span class="cap"> / ${cap}</span>`;$('res-population').classList.toggle('pop-full',pop+game.reservedPop(0)>=cap);
  $('ageNumeral').textContent=ROMAN[p.age];$('ageName').textContent=AGES[p.age];$('difficultyLabel').textContent=game.difficulty.toUpperCase();
  $('idleCount').textContent=game.own(0,'unit').filter(u=>u.type==='villager'&&u.order.type==='idle').length;
  $('armyCount').textContent=game.own(0,'unit').filter(u=>u.type!=='villager').length;
  $('gameTime').textContent=clock(game.time);$('speedButton').textContent=game.speed+'×';$('zoomLabel').textContent=Math.round(renderer.camera.zoom*100)+'%';
  $('pauseButton').innerHTML=icon(game.paused?'play':'pause');$('pauseButton').setAttribute('aria-label',game.paused?'Resume game':'Pause game');$('pauseButton').title=(game.paused?'Resume':'Pause')+' (Space)';
  $('soundButton').innerHTML=icon(audio.muted?'muted':'sound');$('soundButton').title=audio.muted?'Enable sound':'Mute sound';
  $('pauseLabel').classList.toggle('hidden',!game.paused||!!ui.modal||game.ended);
  refreshJourney();refreshSelection(force);
  $('placementHint').classList.toggle('hidden',!ui.placement&&!ui.orderMode);
  if(ui.placement)$('placementHint').innerHTML=`Place <b>${BUILDINGS[ui.placement].name}</b><small>Click to build · Shift for multiple · Esc to cancel</small>`;
  else if(ui.orderMode)$('placementHint').innerHTML=`${ui.orderMode==='rally'?'Set rally point':ui.orderMode==='attackMove'?'Attack move':'Move units'}<small>Click a destination · Esc to cancel</small>`;
}
function refreshJourney(){
  const steps=[['Gather 100 resources',game.stats.gathered>=100],['Construct a new building',game.stats.built>=1],['Reach the Feudal Age',game.players[0].age>=1],['Train 5 military units',(game.stats.militaryTrained||0)>=5]];
  const complete=steps.filter(s=>s[1]).length;const key=steps.map(s=>+s[1]).join('');
  if($('journeySteps').dataset.key!==key){let active=false;$('journeySteps').innerHTML=steps.map(([text,done],i)=>{const first=!done&&!active;if(first)active=true;return`<div class="journey-step ${done?'done':first?'active':''}"><span class="step-check">${done?icon('check'):i+1}</span>${text}</div>`;}).join('');$('journeySteps').dataset.key=key;}
  $('journeyCount').textContent=`${complete} / 4`;
}
function selectionChanged(){const key=game.selected.join(',');if(key!==ui.lastSelection){ui.lastSelection=key;ui.tab='economy';ui.commandKey='';ui.portraitKey='';hideTooltip();}refresh(true);}
function select(ids,focus=false){game.selected=ids.filter(id=>game.get(id));cancelMode();selectionChanged();if(focus&&game.selected.length)renderer.focus(game.get(game.selected[0]));audio.play('select');}
function refreshSelection(force){
  const selected=game.getSelected(),e=selected[0],group=selected.length>1;
  const portraitKey=e?`${e.id}:${e.type}:${game.players[0].age}`:'none';
  if(portraitKey!==ui.portraitKey){renderer.drawPortrait($('portrait'),selected);ui.portraitKey=portraitKey;}
  $('portraitBadge').textContent=group?selected.length:ROMAN[game.players[e?.owner===1?1:0].age];
  if(!e){$('selectionName').textContent='Your kingdom';$('selectionCategory').textContent='SELECT A UNIT OR BUILDING';$('healthFill').style.width='0%';$('healthText').textContent='A new order. A new possibility.';$('selectionStats').innerHTML='';}
  else if(group){const workers=selected.filter(e=>e.type==='villager').length;$('selectionName').textContent=workers===selected.length?`${workers} villagers`:`${selected.length} units selected`;$('selectionCategory').textContent='THE BLUE KINGDOM · GROUP';const hp=selected.reduce((n,e)=>n+e.hp,0),max=selected.reduce((n,e)=>n+e.maxHp,0);$('healthFill').style.width=`${hp/max*100}%`;$('healthText').textContent=`${fmt(hp)} / ${fmt(max)} HP`;$('selectionStats').innerHTML=`<span>${icon('villager')}${workers} workers</span><span>${icon('crossed')}${selected.length-workers} army</span>`;}
  else{
    const def=e.kind==='building'?BUILDINGS[e.type]:e.kind==='unit'?UNITS[e.type]:null;
    $('selectionName').textContent=def?.name||(e.resource==='wood'?'Oak forest':e.resource==='food'?'Berry bush':e.resource==='gold'?'Gold deposit':'Stone deposit');
    $('selectionCategory').textContent=e.kind==='resource'?'NATURAL RESOURCE':`${e.owner===1?'RIVAL · ':''}${def.category.toUpperCase()} · ${e.kind.toUpperCase()}`;
    $('healthFill').style.width=e.kind==='resource'?'100%':`${e.hp/e.maxHp*100}%`;
    $('healthText').textContent=e.kind==='resource'?`${fmt(e.amount)} ${e.resource} remaining`:`${fmt(e.hp)} / ${fmt(e.maxHp)} HP`;
    if(e.kind==='unit'){$('selectionStats').innerHTML=`<span>${icon('sword')}${UNITS[e.type].attack+(game.players[e.owner].techs.attack&&e.type!=='villager'?3:0)+(e.type==='militia'?game.players[e.owner].age*2:0)}</span><span>${icon('shield')}${UNITS[e.type].armor+(game.players[e.owner].techs.armor?2:0)}</span><span>${icon(e.cargo>0?e.cargoType:'move')}${e.cargo>0?fmt(e.cargo):UNITS[e.type].speed}</span>`;}
    else if(e.kind==='building')$('selectionStats').innerHTML=`${BUILDINGS[e.type].pop?`<span>${icon('population')}+${BUILDINGS[e.type].pop}</span>`:''}<span>${icon('focus')}${BUILDINGS[e.type].sight} vision</span>${!e.complete?`<span>${Math.floor(e.progress*100)}%</span>`:''}`;
    else $('selectionStats').innerHTML=`<span>${icon('villager')}Assign a villager to gather</span>`;
  }
  const buildKey=selected.map(e=>e.id).join(',')+'|'+ui.tab+'|'+game.players[0].age+'|'+JSON.stringify(game.players[0].techs)+'|'+(e?.complete??true)+'|'+selected.length;
  if(force||ui.commandKey!==buildKey){ui.commandKey=buildKey;renderCommands(selected);}
  for(const el of $('commandButtons').querySelectorAll('.command-card')){
    const cost=el.dataset.cost?JSON.parse(el.dataset.cost):{};
    const locked=+el.dataset.age>game.players[0].age;const can=game.canAfford(cost);
    el.classList.toggle('unavailable',locked||!can||el.dataset.researched==='true');
    el.setAttribute('aria-disabled',String(locked||!can||el.dataset.researched==='true'));
  }
  refreshQueue(selected);
}
function card({name,ico,action,cost={},age=0,primary=false,key='',description='',time=0,researched=false,order=false}){
  return `<button class="command-card ${primary?'primary':''} ${order?'order':''}" data-action="${action}" data-cost='${JSON.stringify(cost)}' data-age="${age}" data-name="${name}" data-description="${description.replaceAll('"','&quot;')}" data-time="${time}" data-researched="${researched}">${age>0?`<span class="lock-age">${ROMAN[age]}</span>`:''}${key?`<span class="card-key">${key}</span>`:''}<span class="card-icon">${icon(ico)}</span><span class="card-name">${name}</span><span class="card-cost">${researched?'Researched':Object.entries(cost).length?Object.entries(cost).map(([r,n])=>`<span>${icon(r)}${n}</span>`).join(''):time?clock(time):'—'}</span></button>`;
}
function renderCommands(selected){
  const e=selected[0],own=e?.owner===0;let cards=[];$('commandTabs').innerHTML='';$('commandSubtitle').textContent='';
  if(!e){$('commandTabs').innerHTML='<span class="tab-label">YOUR NEXT CHAPTER</span>';$('commandButtons').innerHTML='<div class="selection-empty">Select your town center to train villagers.<br>Select a villager to gather resources and build.</div>';return;}
  if(!own){$('commandTabs').innerHTML=`<span class="tab-label">${e.kind==='resource'?'THE WEALTH OF THE LAND':'RIVAL KINGDOM'}</span>`;$('commandButtons').innerHTML=`<div class="selection-empty">${e.kind==='resource'?`Select a villager, then right-click this ${e.resource==='wood'?'tree':e.resource==='food'?'bush':'deposit'} to gather ${e.resource}.`:`Command your army to attack this ${e.kind}.${e.type==='towncenter'?'<br>Destroy it to claim victory in the Riverlands.':''}`}</div>`;return;}
  const isWorker=selected.some(e=>e.type==='villager');
  if(isWorker){
    $('commandTabs').innerHTML=['economy','military','orders'].map(tab=>`<button data-tab="${tab}" class="${ui.tab===tab?'active':''}">${tab}</button>`).join('');$('commandSubtitle').textContent='LAY THE FOUNDATIONS OF AN EMPIRE';
    if(ui.tab==='orders')cards=orderCards();
    else for(const type of ui.tab==='economy'?['house','farm','lumbercamp','mill','miningcamp','market','towncenter']:['barracks','range','stable','blacksmith','tower','workshop','castle']){const d=BUILDINGS[type];cards.push(card({name:d.name,ico:d.icon,action:'build:'+type,cost:d.cost,age:d.age,description:d.description,time:d.time,primary:type==='house'||type==='barracks'}));}
  }else if(e.kind==='unit'){$('commandTabs').innerHTML='<span class="tab-label">UNIT COMMANDS</span>';$('commandSubtitle').textContent='FOR KINGDOM AND GLORY';cards=orderCards();}
  else if(e.kind==='building'){
    const d=BUILDINGS[e.type];$('commandTabs').innerHTML=`<span class="tab-label">${!e.complete?'CONSTRUCTION':e.type==='market'?'TRADE RESOURCES':e.type==='blacksmith'?'RESEARCH':'PRODUCTION'}</span>`;$('commandSubtitle').textContent=e.type==='towncenter'?'THE HEART OF YOUR KINGDOM':d.category.toUpperCase();
    if(!e.complete){$('commandButtons').innerHTML='<div class="selection-empty">Your villagers are constructing this building.<br>Assign more villagers to finish it sooner.</div>';return;}
    for(const type of d.units||[]){const u=UNITS[type];cards.push(card({name:u.name,ico:u.icon,action:'train:'+type,cost:u.cost,age:u.age,description:u.description,time:u.time,primary:true,key:type==='villager'?'V':''}));}
    if(e.type==='towncenter'){
      if(game.players[0].age<3)cards.push(card({name:'Advance age',ico:'arrow',action:'age',cost:AGE_COSTS[game.players[0].age],primary:true,description:game.players[0].age===2?'Enter the Imperial Age to field long-range trebuchets and strengthen your infantry.':`Advance to the ${AGES[game.players[0].age+1]} to unlock new military units, buildings, and technologies.`,time:AGE_TIMES[game.players[0].age]}));
      const t=TECHS.wheelbarrow;cards.push(card({name:t.name,ico:t.icon,action:'tech:wheelbarrow',cost:t.cost,age:t.age,description:t.description,time:t.time,researched:!!game.players[0].techs.wheelbarrow}));
    }
    if(e.type==='blacksmith')for(const type of ['attack','armor']){const t=TECHS[type];cards.push(card({name:t.name,ico:t.icon,action:'tech:'+type,cost:t.cost,age:t.age,description:t.description,time:t.time,researched:!!game.players[0].techs[type]}));}
    if(e.type==='market')for(const r of ['food','wood','stone']){cards.push(card({name:`Buy ${r}`,ico:r,action:'buy:'+r,cost:{gold:100},description:`Buy 100 ${r} for 100 gold.`,primary:true}));cards.push(card({name:`Sell ${r}`,ico:'trade',action:'sell:'+r,cost:{[r]:100},description:`Sell 100 ${r} for 65 gold.`}));}
    if(d.units)cards.push(card({name:'Rally point',ico:'flag',action:'rally',description:'Choose where newly trained units go. Villagers will gather automatically when rallied to a resource.',order:true}));
    if(!cards.length)cards.push(card({name:'Focus',ico:'focus',action:'focus',description:'Center the camera on this building.',key:'F',order:true}));
  }
  $('commandButtons').innerHTML=cards.join('');
}
function orderCards(){return[card({name:'Move',ico:'move',action:'move',description:'Choose a destination. Units follow a safe route around buildings and across bridges.',order:true}),card({name:'Attack move',ico:'crossed',action:'attackMove',description:'Move toward a destination, attacking enemies encountered along the way.',primary:true,order:true}),card({name:'Stop',ico:'stop',action:'stop',description:'Cancel current orders. Military units continue to defend against nearby enemies.',key:'X',order:true}),card({name:'Focus',ico:'focus',action:'focus',description:'Center the camera on your selected unit.',key:'F',order:true})];}
function refreshQueue(selected){
  const e=selected[0],building=e?.kind==='building'&&e.owner===0;
  if(building){
    $('queueTitle').innerHTML=`${e.complete?'PRODUCTION QUEUE':'CONSTRUCTION'} <span id="queueCount">${e.complete?`${e.queue.length} / 5`:Math.floor(e.progress*100)+'%'}</span>`;
    const key=e.id+':'+e.complete+':'+e.queue.map(q=>q.kind+q.type).join(',');
    if(ui.queueKey!==key){ui.queueKey=key;$('productionQueue').innerHTML=e.complete?Array.from({length:5},(_,i)=>{const q=e.queue[i];return q?`<button class="queue-slot filled" data-queue="${i}" aria-label="Cancel ${q.kind==='unit'?UNITS[q.type].name:q.kind==='age'?'age advancement':TECHS[q.type].name}" title="Click to cancel and refund">${icon(q.kind==='unit'?UNITS[q.type].icon:q.kind==='age'?'arrow':TECHS[q.type].icon)}<span class="queue-progress"></span><span class="queue-timer"></span></button>`:'<span class="queue-slot"></span>';}).join(''):`<div class="selection-empty">${icon('repair')} Building foundations…</div>`;}
    [...$('productionQueue').querySelectorAll('.filled')].forEach((el,i)=>{const q=e.queue[i];if(!q)return;el.querySelector('.queue-progress').style.height=(1-q.time/q.total)*100+'%';el.querySelector('.queue-timer').textContent=i===0?`${Math.ceil(q.time)}s`:'';});
    const blocked=e.queue[0]?.kind==='unit'&&game.population()>=game.capacity();
    $('queueNote').innerHTML=icon(blocked?'house':e.queue.length?'time':'flag')+`<span>${blocked?'Training paused. Build more houses.':!e.complete?'More builders finish construction faster.':e.queue.length?'Click a queued item to cancel and refund.':e.type==='towncenter'?'Train villagers to grow your economy.':e.type==='farm'?'Assign one villager to harvest this farm.':e.type==='house'?'Provides housing for 5 people.':e.type==='mill'?'Villagers deliver food here.':e.type==='lumbercamp'?'Villagers deliver wood here.':e.type==='miningcamp'?'Villagers deliver gold and stone here.':'Your kingdom is ready for your next order.'}</span>`;
  }else{
    ui.queueKey='';$('queueTitle').innerHTML=e?.kind==='unit'?'CURRENT ORDERS':'A KINGDOM BEGINS WITH YOU';
    const label=e?.kind==='unit'?({idle:'Standing by',gather:e.order.phase==='return'?'Delivering '+(e.cargoType||'resources'):'Gathering '+e.order.resource,move:'Moving to destination',attackMove:'Marching to battle',attack:'Attacking the rival',build:'Constructing a building',repair:'Repairing a building'}[e.order.type]||'Standing by'):'Explore. Build. Conquer.';
    $('productionQueue').innerHTML=`<div class="selection-empty">${label}</div>`;
    $('queueNote').innerHTML=icon(e?.type==='villager'?'mouse':'flag')+`<span>${e?.type==='villager'?'Right-click a resource to gather, a foundation to build, or a damaged building to repair.':e?.kind==='unit'?'Right-click to move or attack. Use attack move to fight along the way.':'A strong economy is the foundation of a great army.'}</span>`;
  }
}
function act(action){
  audio.unlock();const [kind,type]=action.split(':'),e=game.getSelected()[0];
  if(game.ended){toast('This battle has ended. Start a new kingdom from the menu.');return;}
  switch(kind){
    case'build':{
      const d=BUILDINGS[type];if(game.players[0].age<d.age){toast(`${d.name} requires the ${AGES[d.age]}.`,'error');break;}
      if(!game.canAfford(d.cost)){game.resourceError(d.cost);break;}
      ui.placement=type;ui.orderMode=null;const p=renderer.toWorld(ui.pointer.x,ui.pointer.y);renderer.placement={type,...snap(type,p)};break;
    }
    case'train':if(e)game.enqueue(e.id,'unit',type);break;
    case'age':if(e)game.enqueue(e.id,'age',null);break;
    case'tech':if(e){if(game.players[0].techs[type])toast('This technology has already been researched.');else if(game.players[0].age<TECHS[type].age)toast(`${TECHS[type].name} requires the ${AGES[TECHS[type].age]}.`,'error');else if(!game.enqueue(e.id,'tech',type)&&game.canAfford(TECHS[type].cost))toast('This technology is already being researched.');}break;
    case'buy':game.trade(type,true);break;
    case'sell':game.trade(type,false);break;
    case'rally':case'move':case'attackMove':ui.orderMode=kind;ui.placement=null;renderer.placement=null;break;
    case'stop':game.stop(game.selected);cancelMode();break;
    case'focus':renderer.focus(e);break;
  }
  refresh(true);hideTooltip();
}
function snap(type,p){const half=BUILDINGS[type].size%2?.5:0;return{x:Math.floor(p.x)+half,y:Math.floor(p.y)+half};}
function cancelMode(){ui.placement=null;ui.orderMode=null;renderer.placement=null;$('placementHint').classList.add('hidden');}
$('commandButtons').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)act(button.dataset.action);});
$('commandTabs').addEventListener('click',e=>{const tab=e.target.closest('[data-tab]');if(tab){ui.tab=tab.dataset.tab;refresh(true);}});
$('productionQueue').addEventListener('click',e=>{const slot=e.target.closest('[data-queue]');if(slot){game.cancelQueue(game.selected[0],Number(slot.dataset.queue));refresh(true);}});
function showTooltip(button){const d=button.dataset;if(!d.name)return;const age=+d.age,locked=age>game.players[0].age,cost=JSON.parse(d.cost||'{}');
  $('tooltip').innerHTML=`<h3>${d.name}</h3><p>${d.description}</p><div class="tooltip-cost">${Object.entries(cost).map(([r,n])=>`<span style="color:${game.players[0].resources[r]<n?'#df9a7b':'inherit'}">${icon(r)}${n}</span>`).join('')}${+d.time?`<span>${icon('time')}${d.time}s</span>`:''}</div>${locked?`<div class="requirement">Requires ${AGES[age]}</div>`:''}${d.researched==='true'?'<div class="requirement">Already researched</div>':''}`;
  $('tooltip').classList.remove('hidden');const r=button.getBoundingClientRect(),t=$('tooltip').getBoundingClientRect();$('tooltip').style.left=Math.max(8,Math.min(window.innerWidth-t.width-8,r.left+r.width/2-t.width/2))+'px';$('tooltip').style.top=Math.max(8,r.top-t.height-12)+'px';
}
function hideTooltip(){$('tooltip').classList.add('hidden');}
$('commandButtons').addEventListener('pointerover',e=>{const b=e.target.closest('.command-card');if(b)showTooltip(b);});$('commandButtons').addEventListener('pointerout',hideTooltip);
$('commandButtons').addEventListener('focusin',e=>{const b=e.target.closest('.command-card');if(b)showTooltip(b);});$('commandButtons').addEventListener('focusout',hideTooltip);
function focusTown(){const town=game.own().find(e=>e.type==='towncenter');if(town)select([town.id],true);}
function idleVillager(){const idle=game.own(0,'unit').filter(u=>u.type==='villager'&&u.order.type==='idle');if(!idle.length){toast('All your villagers are working.');return;}const i=idle.findIndex(u=>u.id===game.selected[0]);select([idle[(i+1)%idle.length].id],true);}
function army(){const units=game.own(0,'unit').filter(u=>u.type!=='villager');if(!units.length)toast('Train troops at your barracks to raise an army.');else select(units.map(u=>u.id));}
function pause(){if(game.ended)return;game.paused=!game.paused;refresh();}
$('focusTown').onclick=focusTown;$('idleButton').onclick=idleVillager;$('armyButton').onclick=army;$('pauseButton').onclick=pause;
$('speedButton').onclick=()=>{const speeds=[1,1.5,2,3];game.speed=speeds[(speeds.indexOf(game.speed)+1)%speeds.length];refresh();};
$('soundButton').onclick=()=>{audio.toggle();refresh();};$('zoomIn').onclick=()=>renderer.zoomBy(.1);$('zoomOut').onclick=()=>renderer.zoomBy(-.1);
$('fullscreenButton').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>toast('Fullscreen is unavailable in this browser.'));};
const compactJourney=window.matchMedia('(max-width: 650px)');
function setJourneyLayout(){ui.journeyOpen=!compactJourney.matches;$('journeySteps').classList.toggle('hidden',!ui.journeyOpen);$('journeySteps').classList.toggle('mobile-open',ui.journeyOpen);$('journeyToggle').setAttribute('aria-expanded',String(ui.journeyOpen));}
setJourneyLayout();compactJourney.addEventListener('change',setJourneyLayout);
$('journeyToggle').onclick=()=>{ui.journeyOpen=!ui.journeyOpen;$('journeySteps').classList.toggle('mobile-open',ui.journeyOpen);$('journeyToggle').setAttribute('aria-expanded',String(ui.journeyOpen));$('journeySteps').classList.toggle('hidden',!ui.journeyOpen);$('journeyChevron').textContent=ui.journeyOpen?'⌄':'⌃';};
$('dismissHint').onclick=()=>$('controlHint').classList.add('hidden');
const canvas=$('world');
function point(event){const r=canvas.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
canvas.addEventListener('pointerdown',event=>{
  if(ui.modal)return;audio.unlock();hideTooltip();canvas.focus({preventScroll:true});const p=point(event);ui.pointer=p;
  ui.drag={start:p,last:p,button:event.button,pointer:event.pointerId,moved:false,shift:event.shiftKey,touch:event.pointerType==='touch'};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  const p=point(event);ui.pointer=p;renderer.pointer=p;
  if(ui.placement){const pos=snap(ui.placement,renderer.toWorld(p.x,p.y));renderer.placement={type:ui.placement,...pos};}
  if(ui.drag){const drag=ui.drag,dx=p.x-drag.last.x,dy=p.y-drag.last.y;if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>5)drag.moved=true;
    if(drag.moved){if(drag.button===1||drag.button===2||drag.touch){renderer.camera.x-=dx/renderer.camera.zoom;renderer.camera.y-=dy/renderer.camera.zoom;}else if(!ui.placement&&!ui.orderMode)renderer.selectionBox={x:drag.start.x,y:drag.start.y,w:p.x-drag.start.x,h:p.y-drag.start.y};}drag.last=p;
  }else{const hit=renderer.hitTest(p.x,p.y);renderer.hover=hit?.id||null;canvas.style.cursor=ui.placement?'crosshair':ui.orderMode?'crosshair':hit?.owner===1?'crosshair':hit?'pointer':'default';}
});
canvas.addEventListener('pointerup',event=>{
  const drag=ui.drag;if(!drag)return;const p=point(event);ui.drag=null;renderer.selectionBox=null;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(drag.moved){
    if(drag.button===0&&!drag.touch&&!ui.placement&&!ui.orderMode){const minX=Math.min(drag.start.x,p.x),maxX=Math.max(drag.start.x,p.x),minY=Math.min(drag.start.y,p.y),maxY=Math.max(drag.start.y,p.y);const units=game.own(0,'unit').filter(e=>{const q=renderer.toScreen(e.x,e.y,12);return q.x>=minX&&q.x<=maxX&&q.y>=minY&&q.y<=maxY;});select([...new Set([...(drag.shift?game.selected:[]),...units.map(u=>u.id)])]);}
    return;
  }
  const world=renderer.toWorld(p.x,p.y),hit=renderer.hitTest(p.x,p.y);
  if(drag.button===2){if(ui.placement){cancelMode();refresh();return;}issueOrder(hit||world);return;}
  if(drag.button!==0)return;
  if(ui.placement){const spot=snap(ui.placement,world);if(game.place(ui.placement,spot.x,spot.y,game.selected)){if(!event.shiftKey)cancelMode();audio.play('build');}refresh(true);return;}
  if(ui.orderMode){issueOrder(hit||world);return;}
  if(drag.touch&&(!hit||hit.owner!==0)&&game.getSelected().some(e=>e.owner===0&&e.kind==='unit')){issueOrder(hit||world);return;}
  if(hit){const ids=event.shiftKey?(game.selected.includes(hit.id)?game.selected.filter(id=>id!==hit.id):[...game.selected,hit.id]):[hit.id];select(ids);}
  else if(!event.shiftKey)select([]);
});
canvas.addEventListener('pointercancel',()=>{ui.drag=null;renderer.selectionBox=null;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('dblclick',event=>{const p=point(event),hit=renderer.hitTest(p.x,p.y);if(hit?.owner===0&&hit.kind==='unit'){const matches=game.own(0,'unit').filter(e=>e.type===hit.type&&dist(e,hit)<16);select(matches.map(e=>e.id));}});
canvas.addEventListener('wheel',event=>{event.preventDefault();const p=point(event);renderer.zoomBy(-Math.sign(event.deltaY)*.085,p.x,p.y);},{passive:false});
function issueOrder(target){
  if(game.ended)return;const e=game.getSelected()[0];
  if(ui.orderMode==='rally'||(e?.kind==='building'&&e.owner===0&&BUILDINGS[e.type].units)){
    if(e?.kind==='building'&&e.owner===0){e.rally={x:target.x,y:target.y,...(target.id?{id:target.id}:{})};game.effects.push({type:'command',x:target.x,y:target.y,life:1.2,maxLife:1.2});toast('Rally point set.');audio.play('order');}
  }else game.command(game.selected,target,ui.orderMode||'normal');
  cancelMode();refresh(true);
}
function moveMinimap(event){const r=$('minimap').getBoundingClientRect(),p=renderer.minimapPoint((event.clientX-r.left)/r.width*$('minimap').width,(event.clientY-r.top)/r.height*$('minimap').height);renderer.focus(p);}
let miniDrag=false;$('minimap').addEventListener('pointerdown',e=>{miniDrag=true;$('minimap').setPointerCapture(e.pointerId);moveMinimap(e);});$('minimap').addEventListener('pointermove',e=>{if(miniDrag)moveMinimap(e);});$('minimap').addEventListener('pointerup',()=>{miniDrag=false;});
window.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.code==='Escape'){if(ui.modal)closeModal();else if(ui.placement||ui.orderMode)cancelMode();else openMenu();return;}
  if(ui.modal)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  ui.keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space')pause();
  if(e.code==='KeyH')focusTown();
  if(e.code==='Period')idleVillager();
  if(e.code==='KeyF')renderer.focus(game.getSelected()[0]);
  if(e.code==='KeyX'){game.stop(game.selected);refresh(true);}
  if(e.code==='KeyV'){const e=game.getSelected()[0];if(e?.type==='towncenter'&&e.owner===0)game.enqueue(e.id,'unit','villager');refresh(true);}
  if(e.code==='KeyB'){if(!game.getSelected().some(e=>e.type==='villager'&&e.owner===0)){const w=game.own(0,'unit').find(e=>e.type==='villager'&&e.order.type==='idle')||game.own(0,'unit').find(e=>e.type==='villager');if(w)select([w.id]);}ui.tab='economy';refresh(true);}
  if(e.code==='F1'){e.preventDefault();showHelp();}
});
window.addEventListener('keyup',e=>ui.keys.delete(e.code));window.addEventListener('blur',()=>{ui.keys.clear();ui.drag=null;renderer.selectionBox=null;});
window.addEventListener('resize',()=>renderer.resize());new ResizeObserver(()=>renderer.resize()).observe($('battlefield'));
function openModal(kind,html,wide=false){hideTooltip();cancelMode();if(!ui.modal)ui.wasPaused=game.paused;ui.modal=kind;game.paused=true;ui.keys.clear();$('modalRoot').classList.remove('hidden');$('modalRoot').innerHTML=`<section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><button class="modal-close" data-modal-action="close" aria-label="Close dialog">×</button>${html}</section>`;$('modalRoot').querySelector('button')?.focus();refresh();}
function closeModal(){ui.modal=null;$('modalRoot').classList.add('hidden');$('modalRoot').innerHTML='';game.paused=ui.wasPaused;refresh();canvas.focus({preventScroll:true});}
const emblem=()=>`<div class="modal-emblem">${icon('crown')}</div>`;
function openMenu(){openModal('menu',`${emblem()}<div class="eyebrow">CROWN & CONQUEST</div><h2>Your kingdom awaits.</h2><p class="lead">The Riverlands · ${AGES[game.players[0].age]} · ${clock(game.time)}</p><div class="modal-actions"><button class="primary-button" data-modal-action="resume">Return to your kingdom</button><div class="modal-action-row"><button class="secondary-button" data-modal-action="save">Save game</button><button class="secondary-button" data-modal-action="load" ${localStorage.getItem(SAVE_KEY)?'':'disabled'}>Load saved game</button></div><button class="secondary-button" data-modal-action="new">Start a new kingdom</button></div><hr class="modal-divider"><div class="settings-row"><span>Sound effects</span><button data-modal-action="sound">${audio.muted?'Off — enable':'On — mute'}</button></div><div class="settings-row"><span>Difficulty</span><strong>${game.difficulty[0].toUpperCase()+game.difficulty.slice(1)}</strong></div><div class="settings-row"><span>New to the Riverlands?</span><button data-modal-action="help">How to play ↗</button></div><div class="keyboard-cue">Your game is paused while this menu is open.</div>`);}
function showHelp(){openModal('help',`${emblem()}<div class="eyebrow">A FIELD GUIDE FOR YOUR REIGN</div><h2>Build. Advance. Conquer.</h2><p class="lead">Lead the Blue Kingdom from a humble settlement to an empire.<br>Destroy the red town center across the river to win.</p><div class="guide-grid">${[
  ['villager','1. Grow your economy','Select your Town Center and train villagers. Select a villager, then right-click trees, berries, gold, or stone. Workers carry resources back automatically.'],
  ['house','2. Build a settlement','Select a villager to open the build menu. Choose a building, then click clear ground. Houses add 5 population. Farms provide food for one worker each.'],
  ['arrow','3. Advance through ages','Research the next age at your Town Center. Feudal Age unlocks archers, scouts, and towers. Castle Age brings knights and castles. Imperial Age unlocks long-range trebuchets.'],
  ['crossed','4. Command your army','Train troops at military buildings. Drag to select a group and right-click to move or attack. Attack move engages enemies along the route. Cross the stone bridges to reach your rival.']
].map(([ico,title,text])=>`<div class="guide-item"><span>${icon(ico)}</span><div><h3>${title}</h3><p>${text}</p></div></div>`).join('')}</div><hr class="modal-divider"><div class="controls-grid">${[['Select / group select','Click / drag'],['Move, gather, build, attack','Right-click'],['Pan the map','W A S D / arrows'],['Pan with mouse','Middle / right drag'],['Zoom','Mouse wheel'],['Focus town center','H'],['Train villager','V'],['Open build menu','B'],['Cycle idle villagers','.'],['Focus selection / stop','F / X'],['Pause / resume','Space'],['Add to selection','Shift + click'],['Cancel / menu','Escape'],['Select matching units','Double-click']].map(([a,b])=>`<div><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div><p class="lead" style="font-size:10px;margin:18px 0">On touch screens, tap a unit, then tap a resource or destination to command. Drag the battlefield to pan. The minimap and army button make navigation easier.</p><button class="primary-button" style="width:100%" data-modal-action="resume">For the kingdom</button>`,true);}
function showNew(){ui.selectedDifficulty=game.difficulty;openModal('new',`${emblem()}<div class="eyebrow">WRITE A NEW CHAPTER</div><h2>The Riverlands</h2><p class="lead">Two kingdoms. A winding river. One crown.<br>Choose the challenge for your next reign.</p><div class="difficulty-options">${[['relaxed','Relaxed','Time to build'],['standard','Standard','A worthy rival'],['hard','Challenging','War comes early']].map(([id,title,text])=>`<button class="difficulty-option ${id===ui.selectedDifficulty?'active':''}" data-difficulty="${id}">${title}<small>${text}</small></button>`).join('')}</div><p class="lead" style="font-size:10px">A complete skirmish usually takes 15–25 minutes.<br>Starting a new game replaces your current kingdom.</p><div class="modal-actions"><button class="primary-button" data-modal-action="start">Begin your reign →</button><button class="secondary-button" data-modal-action="menu">Back to menu</button></div>`);}
function showEnd(){const victory=game.winner===0;openModal('end',`${emblem()}<div class="eyebrow">${victory?'THE RIVERLANDS ARE YOURS':'THE CROWN HAS FALLEN'}</div><h2>${victory?'An empire, forged.':'A kingdom remembered.'}</h2><p class="lead">${victory?'Your rival’s town center lies in ruins.<br>The banners of the Blue Kingdom fly over the Riverlands.':'Your town center has fallen to the rival kingdom.<br>Every great ruler returns wiser from defeat.'}</p><div class="match-stats"><div><strong>${clock(game.time)}</strong><small>TIME OF REIGN</small></div><div><strong>${game.stats.kills}</strong><small>ENEMIES DEFEATED</small></div><div><strong>${fmt(game.stats.gathered)}</strong><small>RESOURCES GATHERED</small></div></div><div class="modal-actions"><button class="primary-button" data-modal-action="new">Begin a new chapter</button><button class="secondary-button" data-modal-action="close">Survey the battlefield</button></div>`);}
function save(manual=false){try{localStorage.setItem(SAVE_KEY,game.serialize());if(manual){toast('Your kingdom has been saved.','success');const load=$('modalRoot').querySelector('[data-modal-action="load"]');if(load)load.disabled=false;const button=$('modalRoot').querySelector('[data-modal-action="save"]');if(button){button.textContent='Kingdom saved ✓';setTimeout(()=>{if(button.isConnected)button.textContent='Save game';},2200);}}}catch{if(manual)toast('Your browser could not save this game.','error');}}
function replaceGame(next){game=next;renderer.game=game;renderer.makeTerrain();bindGame();ui.commandKey='';ui.portraitKey='';ui.queueKey='';ui.lastSelection='';ui.wasPaused=false;closeModal();focusTown();refresh(true);}
$('modalRoot').addEventListener('click',event=>{
  const difficulty=event.target.closest('[data-difficulty]');if(difficulty){ui.selectedDifficulty=difficulty.dataset.difficulty;for(const b of $('modalRoot').querySelectorAll('[data-difficulty]'))b.classList.toggle('active',b===difficulty);return;}
  const b=event.target.closest('[data-modal-action]');if(!b)return;audio.unlock();
  switch(b.dataset.modalAction){
    case'close':case'resume':closeModal();break;
    case'menu':openMenu();break;
    case'help':showHelp();break;
    case'new':showNew();break;
    case'start':replaceGame(new Game({difficulty:ui.selectedDifficulty,seed:27419}));save();toast('A new reign begins. May your kingdom prosper.','success');break;
    case'save':save(true);break;
    case'load':try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error();replaceGame(Game.load(raw));toast('Your saved kingdom has been restored.','success');}catch{toast('No valid saved game is available.','error');}break;
    case'sound':audio.toggle();b.textContent=audio.muted?'Off — enable':'On — mute';refresh();break;
  }
});
// Keep keyboard focus inside the current dialog.
$('modalRoot').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const buttons=[...$('modalRoot').querySelectorAll('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
$('menuButton').onclick=openMenu;$('brand').onclick=openMenu;$('helpButton').onclick=showHelp;$('footerHelp').onclick=showHelp;
let last=performance.now(),accumulator=0,hudTimer=0,saveTimer=0;
function frame(now){const realDt=Math.min((now-last)/1000,.1);last=now;
  if(!ui.modal){const movement=realDt*650/renderer.camera.zoom;let dx=0,dy=0;if(ui.keys.has('KeyA')||ui.keys.has('ArrowLeft'))dx-=movement;if(ui.keys.has('KeyD')||ui.keys.has('ArrowRight'))dx+=movement;if(ui.keys.has('KeyW')||ui.keys.has('ArrowUp'))dy-=movement;if(ui.keys.has('KeyS')||ui.keys.has('ArrowDown'))dy+=movement;renderer.camera.x+=dx;renderer.camera.y+=dy;}
  const c=renderer.toWorld(renderer.width/2,renderer.height/2);if(c.x<0||c.y<0||c.x>44||c.y>44){const p=renderer.iso(Math.max(0,Math.min(44,c.x)),Math.max(0,Math.min(44,c.y)));renderer.camera.x=p.x;renderer.camera.y=p.y;}
  accumulator+=realDt*game.speed;let count=0;while(accumulator>=.05&&count++<8){game.update(.05);accumulator-=.05;}
  renderer.render(now/1000);
  const town=game.own().find(e=>e.type==='towncenter');if(town){const p=renderer.toScreen(town.x,town.y,153);$('settlementLabel').style.left=p.x+'px';$('settlementLabel').style.top=p.y+'px';$('settlementLabel').style.opacity=renderer.camera.zoom<.7?'0':'1';}else $('settlementLabel').style.opacity='0';
  hudTimer+=realDt;if(hudTimer>.15){refresh();hudTimer=0;}saveTimer+=realDt;if(saveTimer>30&&!game.ended&&!ui.modal){save();saveTimer=0;}
  requestAnimationFrame(frame);
}
window.addEventListener('beforeunload',()=>{if(!game.ended)save();});
// A small inspection surface keeps the simulation testable without coupling it to the UI.
window.__CROWN={get game(){return game;},renderer,ui,select,act,refresh,save,replaceGame,step(seconds){for(let t=0;t<seconds;t+=.05)game.update(.05);refresh(true);},showHelp};
refresh(true);requestAnimationFrame(frame);
setTimeout(()=>toast('Your reign begins. Train villagers, grow your settlement, and claim the Riverlands.'),900);
