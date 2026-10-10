'use strict';
// ===== Command card, selection panel, tooltips, menus =====
const ECO=['house','mill','lumber','mining','farm','dock','market','towncenter'];
const MIL=['barracks','archery','stable','blacksmith','monastery','university','siege','castle','tower','wall','gate'];
function costHTML(c,p){
  let h='';for(const k of RK){if(!c[k])continue;const bad=p&&p.res[k]<c[k];h+='<span class="cost" style="color:'+(bad?'#ff7a6a':'#f0e6c8')+'"><i style="background:'+RCOL[k]+'"></i>'+c[k]+'</span>'}
  return h||'<span class="d">Free</span>';
}
function slotBase(i){return{key:KEYS[i],hk:KEYS[i].toUpperCase()}}
function unitSlotInfo(p,line,b){
  const type=curUnit(p,line),d=U[type];const cost=unitCost(p,type);const req=trainReq(p,b,line);
  const miss=missingText(p,cost);
  return{icon:iconURL('unit',type),name:d.n,cost,reqs:req.concat(),miss,desc:d.d+'\nHP '+d.hp+' · Attack '+d.atk+(d.rng?' · Range '+d.rng:'')+' · Armor '+d.ma+'/'+d.pa+(Object.keys(d.bon).length?' · Bonus: '+Object.entries(d.bon).filter(e=>e[1]).map(e=>'+'+e[1]+' vs '+e[0]).join(', '):''),type};
}
function buildSlots(){
  const sel=selEnts(),slots=new Array(20).fill(null);const p=G.players[0];
  UI.cardTitle='';
  if(!sel.length)return slots;
  const first=sel[0];
  if(first.owner!==0||first.kind==='r'){return slots}
  const put=(i,s)=>{slots[i]=Object.assign(slotBase(i),s)};
  const same=sel.filter(e=>e.type===first.type&&e.kind===first.kind);
  if(first.kind==='b'){
    const b=first,d=b.def;UI.cardTitle=d.n;
    if(!b.built){put(18,{icon:iconURL('cmd','delete'),name:'Cancel construction',desc:'Cancel and get a full refund.',onClick:()=>{for(const x of sel)deleteEntity(x);setSel([])}});return slots}
    let i=0;
    for(const line of d.trains){
      const inf=unitSlotInfo(p,line,b);const cnt=b.queue.filter(q=>q.k==='u'&&q.line===line).length;
      put(i,{icon:inf.icon,name:inf.name,cost:inf.cost,reqs:inf.reqs,desc:inf.desc,off:inf.reqs.length>0,dim:!inf.reqs.length&&inf.miss.length>0,count:cnt,
        onClick:(e)=>{
          const n=e&&e.shiftKey?5:1;let r='';
          for(let k=0;k<n;k++){const tb=same.filter(x=>x.built).sort((a,c)=>a.queue.length-c.queue.length)[0]||b;r=queueTrain(tb,line);if(r)break}
          if(r){toast(r,'warn');if(window.AudioSys)AudioSys.sfx('error')}else if(window.AudioSys)AudioSys.sfx('click',{vol:.4});uiRefresh(true)}});
      i++;
    }
    for(const k of d.techs){
      const t=techDef(p,k);const done=p.techs.has(k);const req=techReq(p,b,k);const cost=techCost(p,k);
      const inq=b.queue.findIndex(q=>q.k==='t'&&q.key===k);
      const hide=done&&false;
      put(i,{icon:iconURL('tech',k.replace(/^uniq2?$/,'uniq').replace(/^euniq$/,'euniq')==='uniq'?(t.uniq&&p.civd?(k==='uniq'?p.civd.ut:p.civd.eut):k):k),name:t.n+(done?' ✓':''),cost:done?null:cost,reqs:done?['Already researched']:req,miss:done?[]:missingText(p,cost),desc:t.d+(t.t?'\nResearch time: '+t.t+'s':''),off:req.length>0&&!done||false,dim:done||(!req.length&&!canAfford(p,cost)),count:inq>=0?1:0,prog:inq===0?b.queue[0].prog/b.queue[0].tot:0,
        onClick:()=>{if(done){return}const r=queueTech(b,k);if(r){toast(r,'warn');if(window.AudioSys)AudioSys.sfx('error')}else if(window.AudioSys)AudioSys.sfx('click',{vol:.4});uiRefresh(true)}});
      i++;
    }
    if(d.market){
      const mk=[['f','Buy 100 Food',true],['w','Buy 100 Wood',true],['s','Buy 100 Stone',true],['f','Sell 100 Food',false],['w','Sell 100 Wood',false],['s','Sell 100 Stone',false]];
      for(const[res,nm,buy]of mk){
        const pr=p.prices[res],fee=marketFee(p);
        const gold=buy?Math.round(100*pr/100*(1+fee)):Math.round(100*(2*100-pr)/100*(1-fee));
        put(i,{icon:iconURL('cmd',res==='f'?'food':res==='w'?'wood':'stone'),name:nm,cost:buy?{g:gold}:null,reqs:[],desc:(buy?'Buy 100 '+RN[res]+' for '+gold+' gold.':'Sell 100 '+RN[res]+' for '+gold+' gold.')+' Market fee: '+Math.round(fee*100)+'% (Saracens: 5%). Prices shift as you trade and recover over time.',dim:buy?p.res.g<gold:p.res[res]<100,
          onClick:()=>{const r=marketTrade(p,res,buy);if(r){toast(r,'warn');if(window.AudioSys)AudioSys.sfx('error')}else{if(window.AudioSys)AudioSys.sfx('coin');}uiRefresh(true)}});
        i++;
      }
    }
    if(d.trains.length)put(15,{icon:iconURL('cmd','rally'),name:'Set Rally Point',desc:'Newly trained units go to this point. Right-click the ground/resource also sets it. Resources make villagers gather automatically.',onClick:()=>{UI.mode='rally';updateModeInfo()}});
    if(d.gar)put(16,{icon:iconURL('cmd','ungarrison'),name:'Ungarrison all',desc:'Release garrisoned units ('+b.gar.length+'/'+garCap(b)+'). They appear at a free tile next to the building.',dim:!b.gar.length,onClick:()=>{for(const x of same)ungarrisonAll(x,false);uiRefresh(true)}});
    if(d.type==='towncenter'||b.type==='towncenter')put(17,{icon:iconURL('cmd','bell'),name:p.bell?'Town Bell: ON (release)':'Ring Town Bell',desc:'Villagers rush to the nearest Town Center, Tower or Castle with free room. Click again (or wait 2.5 min) to send them back to their previous jobs. Garrisoned villagers add arrows.',on:p.bell,onClick:()=>{toggleBell(p);uiRefresh(true)}});
    if(d.relics)put(17,{icon:iconURL('cmd','relic'),name:'Take out a relic',desc:'Place a stored relic on the ground so a monk can carry it elsewhere. Each stored relic yields 0.5 gold/second.',dim:!b.relics,onClick:()=>{if(takeRelicOut(b))toast('Relic placed next to the Monastery');uiRefresh(true)}});
    put(18,{icon:iconURL('cmd','delete'),name:'Delete',desc:'Destroy this building (Delete key).',onClick:()=>{for(const x of sel)deleteEntity(x);setSel([])}});
    return slots;
  }
  // units
  const units=sel.filter(e=>e.kind==='u'&&e.owner===0);
  const hasVil=units.some(u=>u.def.k==='villager');
  const mil=units.filter(u=>isMil(u)||u.type==='cobra');
  UI.cardTitle=units.length>1?units.length+' units selected':first.def.n;
  if(hasVil&&UI.menu!=='root'){
    const list=UI.menu==='eco'?ECO:MIL;UI.cardTitle=UI.menu==='eco'?'Economic buildings':'Military buildings';
    list.forEach((type,i)=>{
      const d=B[type];const req=canBuildType(p,type);const cost=effCost(p,type);
      put(i,{icon:iconURL('bld',type),name:d.n,cost,reqs:req,miss:missingText(p,cost),desc:d.d+'\nHP '+d.hp+' · Build time '+d.t+'s'+(d.pop?' · +'+d.pop+' pop':'')+(d.gar?' · Garrison '+d.gar:''),off:req.length>0,dim:!req.length&&!canAfford(p,cost),
        onClick:()=>{if(req.length){toast(req[0],'warn');if(window.AudioSys)AudioSys.sfx('error');return}UI.placing={type};UI.mode=null;updateGhost()}});
    });
    put(14,{icon:iconURL('cmd','back'),name:'Back',desc:'Return to the villager menu (Esc).',onClick:()=>{UI.menu='root';uiRefresh(true)}});
    return slots;
  }
  let i=0;
  if(hasVil){
    put(0,{icon:iconURL('cmd','eco'),name:'Build Economic Buildings',desc:'House, Mill, Lumber Camp, Mining Camp, Farm, Dock, Market, Town Center.',onClick:()=>{UI.menu='eco';uiRefresh(true)}});
    put(1,{icon:iconURL('cmd','mil'),name:'Build Military Buildings',desc:'Barracks, Archery Range, Stable, Blacksmith, Monastery, University, Siege Workshop, Castle, Tower, Walls & Gates.',onClick:()=>{UI.menu='mil';uiRefresh(true)}});
    i=2;
  }
  put(i,{icon:iconURL('cmd','stop'),name:'Stop',desc:'Cancel the current order.',onClick:()=>{for(const u of units)orderStop(u)}});i++;
  if(mil.length){
    put(i,{icon:iconURL('cmd','stance'),name:'Stance: '+({aggr:'Aggressive',def:'Defensive',stand:'Stand ground',none:'No attack'}[mil[0].stance]),desc:'Click to cycle: Aggressive (chase enemies in sight), Defensive (stay near), Stand Ground (fire only in range), No Attack.',onClick:()=>{const o=['aggr','def','stand','none'];const n=o[(o.indexOf(mil[0].stance)+1)%4];for(const u of mil)u.stance=n;uiRefresh(true)}});i++;
    put(i,{icon:iconURL('cmd','sword'),name:'Attack Move',desc:'Click a destination: units fight everything they meet on the way.',onClick:()=>{UI.mode='amove';updateModeInfo()}});i++;
  }
  if(units.some(u=>!isShip(u)&&!u.def.cls.includes('siege')&&u.type!=='cobra')){
    put(i,{icon:iconURL('cmd','garrison'),name:'Garrison',desc:'Click a Town Center, Tower or Castle to shelter inside. Garrisoned units add arrow fire and heal.',onClick:()=>{UI.mode='garrison';updateModeInfo()}});i++}
  if(units.some(u=>u.cargo)){
    put(i,{icon:iconURL('cmd','unload'),name:'Unload here',desc:'Unload cargo onto the nearest valid shore. Or click "Unload at" / right-click a shore.',onClick:()=>{for(const u of units)if(u.cargo&&u.cargo.length){const n=unloadShip(u);if(!n&&u.cargo.length)toast('No valid shore nearby','warn')}uiRefresh(true)}});i++;
    put(i,{icon:iconURL('cmd','unload'),name:'Unload at…',desc:'Click a shore: the ship sails there and lands the troops.',onClick:()=>{UI.mode='unload';updateModeInfo()}});i++}
  put(18,{icon:iconURL('cmd','delete'),name:'Delete',desc:'Delete selected units (Delete key).',onClick:deleteSelected});
  return slots;
}
let _slotSig='';
function renderCard(){
  const slots=buildSlots();UI.slots=slots;
  const p=G.players[0];
  const card=$('cmdcard');
  if(card.children.length!==20){card.innerHTML='';for(let i=0;i<20;i++){const d=document.createElement('div');d.className='cbtn empty';d.dataset.i=i;
    d.onclick=e=>{const s=UI.slots[i];if(s&&s.onClick){s.onClick(e)}};
    d.onmouseenter=e=>{UI.hoverBtn=i;showSlotTip(i)};d.onmouseleave=()=>{UI.hoverBtn=null;$('tooltip').classList.add('hidden')};card.appendChild(d)}}
  $('cmdtitle').textContent=UI.cardTitle||'';
  for(let i=0;i<20;i++){
    const d=card.children[i],s=slots[i];
    if(!s){if(d.className!=='cbtn empty'){d.className='cbtn empty';d.style.backgroundImage='';d.innerHTML=''}continue}
    d.className='cbtn'+(s.off?' off':'')+(s.dim?' dim':'')+(s.on?' on':'');
    if(d.dataset.icon!==s.icon){d.style.backgroundImage='url('+s.icon+')';d.dataset.icon=s.icon}
    const h='<span class="hk">'+s.hk+'</span>'+(s.count?'<span class="cnt">'+s.count+'</span>':'')+(s.prog?'<span class="bar" style="width:'+Math.round(s.prog*100)+'%"></span>':'');
    if(d.dataset.h!==h){d.innerHTML=h;d.dataset.h=h}
  }
  if(UI.hoverBtn!==null)showSlotTip(UI.hoverBtn);
}
function showSlotTip(i){
  const s=UI.slots&&UI.slots[i];const tt=$('tooltip');if(!s){tt.classList.add('hidden');return}
  const p=G.players[0];
  let h='<div class="tn">'+s.name+' <span class="d">('+s.hk+')</span></div>';
  if(s.cost)h+='<div class="tc">'+costHTML(s.cost,p)+'</div>';
  if(s.reqs&&s.reqs.length)for(const r of s.reqs)h+='<div class="bad">✖ '+r+'</div>';
  else if(s.miss&&s.miss.length)for(const r of s.miss)h+='<div class="bad">✖ '+r+'</div>';
  h+='<div class="d">'+(s.desc||'').replace(/\n/g,'<br>')+'</div>';
  tt.innerHTML=h;tt.classList.remove('hidden');
  const r=$('cmdcard').children[i].getBoundingClientRect();
  tt.style.left=Math.max(4,Math.min(VW-340,r.left-150))+'px';tt.style.top='auto';tt.style.bottom=(window.innerHeight-r.top+8)+'px';
}
// ---------- selection info ----------
let _selSig='';
function stateText(u){
  if(u.inside)return'Garrisoned';
  switch(u.t){case'idle':return'Idle';case'move':return'Moving';case'amove':return'Attack-moving';case'attack':return'Attacking';
    case'gather':{const r=byId(u.tgt);const n=r?(r.kind==='b'?'farm food':r.type==='tree'||r.type==='pine'||r.type==='palm'?'wood':r.type==='berries'||r.type==='shrub'?'berries':r.type==='carcass'?'meat':r.type==='fish'?'fish':r.type):'';return u.gs==='drop'?'Returning '+(u.carry?RN[u.carry.r]:'resources'):'Gathering '+n}
    case'build':return'Building';case'repair':return'Repairing';case'garrison':return'Heading to shelter';case'heal':return'Healing';case'convert':return u.recharging?'Recharging…':u.cast?'Chanting… '+Math.round(u.cast/u.castT*100)+'%':'Converting';
    case'relic':return u.relicCarry?'Carrying a relic':'Fetching a relic';case'trade':return'Trading';case'board':return'Boarding ship';case'unloadat':return'Sailing to shore'}
  return u.t;
}
function statLine(e){
  const d=e.def;let s='';
  const atk=Math.round(sget(e,'atk')*10)/10;
  if(d.atk>0||d.boom)s+='Attack <b>'+atk+'</b>'+(Object.entries(d.bon||{}).filter(x=>x[1]).length?' (+'+Object.entries(d.bon).filter(x=>x[1]).map(x=>x[1]+' '+x[0]).join(', +')+')':'');
  if(d.rng)s+=' · Range <b>'+Math.round(sget(e,'rng')*10)/10+'</b>';
  s+=' · Armor <b>'+Math.round(sget(e,'ma'))+'/'+Math.round(sget(e,'pa'))+'</b> (melee/pierce)';
  s+=' · Speed <b>'+(sget(e,'spd')).toFixed(2)+'</b>';
  return s;
}
function renderSelInfo(){
  const sel=selEnts();const el=$('selinfo');const p=G.players[0];
  let h='';
  if(!sel.length){
    h='<div class="si-name">'+p.name+' – '+p.civd.n+'</div><div class="si-stats">'+p.civd.bon.map(b=>'• '+b).join('<br>')+'<br><span style="color:#a89868">Unique unit: '+U[p.civd.uu].n+' (Castle) · Unique tech: '+(UTECH[p.civd.ut]||{}).n+'</span><br><span style="color:#a89868">Left-click to select · drag to box-select · right-click to command · Enter to chat/cheat · F1 help</span></div>';
  }else if(sel.length===1||sel[0].kind==='b'||sel[0].kind==='r'){
    const e=sel[0];
    if(e.kind==='r'){
      const nm={tree:'Oak tree',pine:'Pine tree',palm:'Palm',shrub:'Forage bush',berries:'Berry bush',gold:'Gold mine',stone:'Stone mine',fish:'School of fish',relic:'Relic',carcass:'Carcass'}[e.type];
      h='<div class="si-head"><img src="'+resIcon(e)+'"><div><div class="si-name">'+nm+'</div><div class="si-stats">'+(e.type==='relic'?'Monks can carry this to a Monastery: +0.5 gold/s while stored.':'Remaining: <b>'+Math.ceil(e.amt)+' '+(e.res?RN[e.res]:'')+'</b>'+(e.type==='fish'?'<br>Needs a Fishing Ship and a Dock.':''))+'</div></div></div>';
    }else if(e.kind==='b'){
      const b=e,own=b.owner===0;const pl=G.players[b.owner];
      h='<div class="si-head"><img src="'+iconURL('bld',b.type)+'"><div><div class="si-name">'+b.def.n+(own?'':' <span style="font-size:12px;color:'+pl.color+'">('+pl.name+')</span>')+'</div>'+
        '<div class="si-bar"><i style="width:'+Math.round(b.hp/b.mh*100)+'%;background:'+hpColor(b.hp/b.mh)+'"></i></div>'+
        '<div class="si-stats">HP '+Math.ceil(b.hp)+' / '+b.mh+(b.built?'':' · <b>Under construction '+Math.round(b.prog*100)+'%</b>')+' · Armor '+Math.round(sget(b,'ma'))+'/'+Math.round(sget(b,'pa'))+'<br>'+
        (b.def.atk?'Arrows: '+(b.def.atk.base+b.gar.filter(id=>{const u=G.byId.get(id);return u&&(u.def.cls.includes('inf')||u.def.cls.includes('arc')||u.def.cls.includes('vil'))}).length)+' · Range '+b.def.atk.rng+'<br>':'')+
        (b.def.pop?'Housing +'+b.def.pop+'<br>':'')+
        (b.farm?'Food remaining: <b>'+Math.ceil(b.farm.amt)+'</b> (auto-reseeds for 60 wood)<br>':'')+
        (b.def.relics?'Relics stored: <b>'+b.relics+'</b> · Income <b>+'+(b.relics*0.5).toFixed(1)+' gold/s</b><br>':'')+
        (b.def.market?'Prices – Food '+Math.round(pl.prices.f)+' · Wood '+Math.round(pl.prices.w)+' · Stone '+Math.round(pl.prices.s)+' (gold per 100, before '+Math.round(marketFee(pl)*100)+'% fee)<br>':'')+
        '</div></div></div>';
      if(own&&b.queue.length){h+='<div class="si-sec">Queue (click to cancel):</div><div class="si-q si-grid">';b.queue.forEach((q,i)=>{const ic=q.k==='u'?iconURL('unit',q.type):iconURL('tech',q.key);h+='<div class="u" data-act="cancel" data-i="'+i+'" data-b="'+b.id+'" style="background-image:url('+ic+')" title="'+(q.k==='u'?U[q.type].n:techDef(pl,q.key).n)+'">'+(i===0?'<i style="width:'+Math.round(q.prog/q.tot*100)+'%;background:#f0d050"></i>':'')+'</div>'});
        if(b.stalled)h+='<span style="color:#ff9a7a;margin-left:6px">Population limit reached – build Houses</span>';h+='</div>'}
      if(b.def.gar){h+='<div class="si-sec">Garrison '+b.gar.length+'/'+garCap(b)+(own?' (click a unit to release it)':'')+':</div><div class="si-grid">';
        for(const id of b.gar){const u=G.byId.get(id);if(u&&!u.dead)h+='<div class="u" data-act="ungar" data-id="'+u.id+'" data-b="'+b.id+'" style="background-image:url('+iconURL('unit',u.type)+')" title="'+u.def.n+'"><i style="width:'+Math.round(u.hp/u.mh*100)+'%"></i></div>'}h+='</div>'}
    }else{
      const u=e,own=u.owner===0;const pl=u.owner>=0?G.players[u.owner]:null;
      h='<div class="si-head"><img src="'+iconURL('unit',u.type)+'"><div><div class="si-name">'+u.def.n+(pl&&!own?' <span style="font-size:12px;color:'+pl.color+'">('+pl.name+')</span>':'')+(u.def.animal&&!pl?' <span style="font-size:12px;color:#aaa">(neutral)</span>':'')+'</div>'+
        '<div class="si-bar"><i style="width:'+Math.round(u.hp/u.mh*100)+'%;background:'+hpColor(u.hp/u.mh)+'"></i></div>'+
        '<div class="si-stats">HP '+Math.ceil(u.hp)+' / '+u.mh+' · '+stateText(u)+'<br>'+
        (u.def.k==='sheep'?'Owner: <b style="color:'+(pl?pl.color:'#ccc')+'">'+(pl?pl.name:'nobody – move a unit within '+CAPT_R+'+ tiles to claim it')+'</b><br>Food: '+u.def.food+' (right-click with a villager to slaughter). Guard radius '+GUARD_R+' tiles; '+(u.lockT>G.time?'recently captured':'')+'<br>':
         u.def.animal?(u.def.food?'Food: '+u.def.food+'<br>':'')+'':statLine(u)+'<br>')+
        (u.carry&&u.carry.n>=1?'Carrying <b>'+Math.floor(u.carry.n)+' '+RN[u.carry.r]+'</b><br>':'')+
        (u.cargo?'Cargo: <b>'+u.cargo.length+'/'+(u.def.tcap+p.f.tcap)+'</b> – right-click a shore to unload<br>':'')+
        (u.def.k==='monk'?(u.relicCarry?'Carrying a relic – right-click your Monastery<br>':'Right-click: heal friends, convert enemies, fetch relics<br>'):'')+
        (u.def.k==='tradecart'||u.def.k==='tradecog'?'Right-click a distant friendly '+(u.def.k==='tradecart'?'Market':'Dock')+' to trade<br>':'')+
        (hAt(u.x,u.y)?'Height level '+hAt(u.x,u.y)+' (high ground = +25% damage)':'')+
        '</div></div></div>';
      if(u.cargo&&u.cargo.length){h+='<div class="si-grid">';for(const id of u.cargo){const c=G.byId.get(id);if(c)h+='<div class="u" style="background-image:url('+iconURL('unit',c.type)+')" title="'+c.def.n+'"></div>'}h+='</div>'}
    }
  }else{
    h='<div class="si-name">'+sel.length+' units selected</div><div class="si-grid">';
    for(const u of sel.slice(0,40))h+='<div class="u" data-act="sel" data-id="'+u.id+'" style="background-image:url('+iconURL('unit',u.type)+')" title="'+u.def.n+' – '+Math.ceil(u.hp)+' HP"><i style="width:'+Math.round(u.hp/u.mh*100)+'%;background:'+hpColor(u.hp/u.mh)+'"></i></div>';
    h+='</div>';
  }
  if(h!==_selSig){_selSig=h;el.innerHTML=h}
}
function resIcon(r){const k=r.type;const cv=mkIcon(48,48),c=cv.getContext('2d');iconBg(c,'unit');c.save();c.translate(24,40);c.scale(1.5,1.5);const fake=Object.assign({},r,{x:0,y:0});
  // draw simple representation
  if(k==='tree'||k==='pine'||k==='palm'){const s=treeSprite(k,0,0);c.restore();c.drawImage(s.cv,-4,-10,56,74);return cv.toDataURL()}
  c.restore();glyph(c,k==='gold'?'gold':k==='stone'?'stone':k==='fish'?'fish':k==='relic'?'relic':'food');return cv.toDataURL()}
function uiRefresh(force){
  if(!G||R.editor)return;
  renderSelInfo();renderCard();
}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-act]');if(!t||!G)return;
  const act=t.dataset.act;
  if(act==='sel'){setSel([+t.dataset.id])}
  else if(act==='ungar'){const b=byId(+t.dataset.b),u=byId(+t.dataset.id);if(b&&u&&b.owner===0){ungarrison(b,u);if(b.rally)applyRally(b,u);speak([u],'move')}}
  else if(act==='cancel'){const b=byId(+t.dataset.b);if(b&&b.owner===0)cancelQueue(b,+t.dataset.i)}
  uiRefresh(true);
});
// ---------- modals ----------
function openModal(html,opts){
  $('modalbox').innerHTML=html;$('modal').classList.remove('hidden');UI.modalPause=!(opts&&opts.noPause);
  if(G&&UI.modalPause&&!R.editor)G.paused=true;if(window.AudioSys&&G&&!R.editor)AudioSys.pauseAll();
}
function closeModal(){
  if($('modal').classList.contains('hidden'))return;
  $('modal').classList.add('hidden');UI.dipOpen=false;
  if(G&&!R.editor&&!G.over)G.paused=false;if(window.AudioSys&&!R.editor&&G)AudioSys.resumeAll();
}
function openPauseMenu(){
  if(!G)return;
  let h='<h2>Game Paused</h2><div style="display:flex;flex-direction:column;gap:8px;min-width:280px">'+
   '<button id="pm-resume" class="big gold">Resume</button><button id="pm-dip" class="big">Diplomacy</button><button id="pm-help" class="big">Help &amp; cheat codes</button><button id="pm-audio" class="big">Audio settings</button>'+
   '<button id="pm-restart" class="big">Restart match</button>'+(G.md&&G.md.custom?'<button id="pm-editor" class="big">Return to Map Editor</button>':'')+'<button id="pm-quit" class="big">Quit to main menu</button></div>';
  openModal(h);
  $('pm-resume').onclick=closeModal;$('pm-dip').onclick=openDiplomacy;$('pm-help').onclick=()=>openHelp(false);$('pm-audio').onclick=()=>openAudio(true);
  $('pm-restart').onclick=()=>{closeModal();restartMatch()};$('pm-quit').onclick=()=>{closeModal();quitToMenu()};
  if($('pm-editor'))$('pm-editor').onclick=()=>{closeModal();returnToEditor()};
}
function openAudio(back){
  const row=(ch,label)=>'<div class="mrow"><label>'+label+'</label><input type="range" min="0" max="100" value="'+Math.round(AudioSys.getVol(ch)*100)+'" data-ch="'+ch+'"><label><input type="checkbox" data-mute="'+ch+'" '+(AudioSys.getMute(ch)?'checked':'')+'> Mute</label></div>';
  const vi=AudioSys.voiceInfo?AudioSys.voiceInfo():{engine:'?',voices:0};
  openModal('<h2>Audio Settings</h2>'+row('music','Music')+row('sfx','Effects')+row('voice','Unit voices')+
   '<p class="hint">Voice engine: <b>'+vi.engine+'</b> ('+vi.voices+' system voices). When no matching system voice exists, a built-in formant speech synthesizer is used.</p><div class="mrow"><button id="au-test">Test voice</button><button id="au-sfx">Test effect</button></div>'+
   '<div class="btnrow"><span></span><button id="au-close" class="gold">'+(back?'Back':'Close')+'</button></div>',{noPause:false});
  $('modalbox').querySelectorAll('input[data-ch]').forEach(i=>i.oninput=()=>{AudioSys.setVol(i.dataset.ch,i.value/100)});
  $('modalbox').querySelectorAll('input[data-mute]').forEach(i=>i.onchange=()=>{AudioSys.setMute(i.dataset.mute,i.checked)});
  $('au-test').onclick=()=>{const civ=G?G.players[0].civ:'franks';const t=AudioSys.voice(civ,'mil','select');if(t)toast(String(t).split('|')[0])};
  $('au-sfx').onclick=()=>AudioSys.sfx('slash');
  $('au-close').onclick=()=>{if(back&&G&&!R.editor){openPauseMenu()}else{$('modal').classList.add('hidden');if(G&&!R.editor&&!G.over)G.paused=false}};
}
function openHelp(fromGame){
  const civs=Object.values(CIVS).map(c=>'<li><b>'+c.n+'</b> ('+c.lang+' speech): '+c.bon.join('; ')+'</li>').join('');
  openModal('<h2>Help</h2><div style="max-height:68vh;overflow:auto;padding-right:10px">'+
  '<h3>Goal & winning</h3><p>Grow your economy, advance Dark → Feudal → Castle → Imperial Age, raise an army and defeat the computer players. <b>Win condition:</b> you win when every remaining player is allied with you (or on your team). Players you only have <i>peace</i> with still count as opponents – declare war on them or the match can\'t end. A player is defeated when they have no buildings and no villagers left. If you fall, you lose.</p>'+
  '<h3>Controls</h3><ul><li>Left-click select · drag box · double-click selects all of that type on screen · Shift adds/toggles</li><li>Right-click: move / attack / gather / build / repair / garrison / heal / convert / trade (context sensitive). With a building selected it sets the rally point.</li><li>Command card hotkeys follow the grid: Q W E R T / A S D F G / Z X C V B / Y U I O P</li><li>Arrow keys or screen edge scroll the map · mouse wheel zooms · middle mouse drags · minimap click jumps, right-click on minimap moves units</li><li>H: Town Center · . idle villager · , idle military · Space: last alert · Ctrl+0-9 set group, 0-9 recall · Delete · Esc cancel/menu · F1 help · Enter chat/cheats</li></ul>'+
  '<h3>Economy</h3><p>Villagers gather wood, food (berries, farms, hunting, sheep, fishing ships), gold and stone and carry it to Town Centers or matching camps. Houses raise the population cap. Farms auto-reseed for 60 wood.</p>'+
  '<h3>Sheep & wildlife</h3><p>Neutral sheep become yours when any of your units comes within 5 tiles. Owned sheep stay yours while any of your (or allied) units or buildings stay within <b>5 tiles</b> (the guard radius). If nobody guards a sheep, an enemy (or peace-partner) unit that comes within <b>3.5 tiles</b> captures it, and after any change ownership is locked for <b>4 seconds</b>, so sheep never flicker. Ownership is shown by a coloured ring and ribbon. Villagers slaughter sheep (right-click). Deer flee; boars fight back; wolves hunt exposed units.</p>'+
  '<h3>Elevation & terrain</h3><p><b>High ground:</b> units attacking from higher ground deal <b>+25% damage</b> and ranged units gain <b>+1 range</b>; attacking from lower ground deals <b>−25%</b>, and targets two or more levels above reduce range by 1. Height steps of 2+ levels are cliffs (impassable); 1-level steps are ramps (slightly slower uphill). Trees, water and buildings block land units; ships need water. Enemy walls can be breached; gates open for you and allies.</p>'+
  '<h3>Naval</h3><p>Build Docks on a shoreline (Feudal Age). Fishing Ships harvest fish; Transport Ships carry 10 land units (right-click a friendly ship with land units, then right-click a shore to unload); Galleys (→ War Galley → Galleon), Fire Ships and Demolition Ships fight at sea and bombard the coast. Trade Cogs trade between distant friendly Docks.</p>'+
  '<h3>Garrison & Town Bell</h3><p>Villagers and soldiers can garrison in Town Centers, Towers and Castles; they add arrows and heal. The Town Bell (🔔) sends villagers to shelter and back to their jobs when released (it also expires after 2.5 minutes).</p>'+
  '<h3>Monks & relics</h3><p>Monks heal friendly living units (not machines – villagers repair buildings, siege and ships). Right-click an enemy unit to convert it: a visible chant (4–8 s) then a cooldown. Monks collect relics and deposit them in a Monastery for +0.5 gold/s each; relics drop if the monk dies or the Monastery falls.</p>'+
  '<h3>Diplomacy & trade</h3><p>Open Diplomacy to propose peace or alliance, declare war, or send tribute (20% fee). AIs weigh recent attacks, relative strength and gifts. Markets train Trade Carts: right-click a distant friendly Market; Docks train Trade Cogs for sea routes. Income grows with distance.</p>'+
  '<h3>Cheat codes (press Enter, type, Enter – only when "Allow cheats" is on)</h3><ul>'+
  '<li><code>cheese steak jimmy\'s</code> +10,000 food</li><li><code>lumberjack</code> +10,000 wood</li><li><code>robin hood</code> +10,000 gold</li><li><code>rock on</code> +10,000 stone</li><li><code>marco</code> reveal the map</li><li><code>polo</code> toggle fog of war off/on</li><li><code>aegis</code> toggle instant construction, training and research</li><li><code>how do you turn this on</code> spawns a controllable Cobra Car near your Town Center (fast, machine guns)</li></ul><p style="color:#a89868">Case-insensitive; resource cheats add 10,000 each time and can be repeated. (BIGDADDY is the Age of Empires I rocket-car code and is not used here.)</p>'+
  '<h3>Civilizations</h3><ul>'+civs+'</ul></div><div class="btnrow"><span></span><button id="help-close" class="gold">Close</button></div>',{noPause:false});
  $('help-close').onclick=()=>{if(UI.helpFromPause)openPauseMenu();else closeModal()};
  UI.helpFromPause=!fromGame&&G&&!R.editor;
}
// ---------- diplomacy ----------
function openDiplomacy(){
  if(!G)return;UI.dipOpen=true;renderDiplomacy();
}
let _dipLog=[];
function renderDiplomacy(msgText){
  if(msgText)_dipLog.unshift(msgText);_dipLog=_dipLog.slice(0,6);
  const me=G.players[0];let rows='';
  for(const p of G.players){if(p===me)continue;
    const rel=G.dip[0][p.id];const att=p.attitude[0]||0;
    rows+='<tr><td><span class="dot" style="background:'+p.color+'"></span>'+p.name+(p.alive?'':' <i>(defeated)</i>')+'</td><td>'+p.civd.n+'</td><td class="rel-'+rel+'">'+(rel==='enemy'?'Enemy (at war)':rel==='ally'?'Ally':'Peace')+'</td><td>'+(p.ai?(att>=12?'Friendly':att>=4?'Warm':att>=0?'Neutral':'Hostile'):'')+'</td><td>';
    if(p.alive){
      if(rel==='enemy')rows+='<button data-d="peace" data-p="'+p.id+'">Propose peace</button>';
      if(rel==='peace')rows+='<button data-d="ally" data-p="'+p.id+'">Propose alliance</button> <button data-d="war" data-p="'+p.id+'">Declare war</button>';
      if(rel==='ally')rows+='<button data-d="war" data-p="'+p.id+'">Break alliance &amp; declare war</button>';
      rows+=' <select data-tr="'+p.id+'"><option value="f">Food</option><option value="w">Wood</option><option value="g">Gold</option><option value="s">Stone</option></select><button data-d="trib" data-p="'+p.id+'" data-amt="100">Tribute 100</button>';
    }
    rows+='</td></tr>';
  }
  openModal('<h2>Diplomacy</h2><table class="dip"><tr><th>Player</th><th>Civilization</th><th>Relationship</th><th>Attitude</th><th>Actions</th></tr>'+rows+'</table>'+
   '<p class="hint" style="margin-top:8px">Tribute: 100 sent → 80 received (20% fee). Gifts improve attitude. AIs refuse peace right after being attacked or when much stronger; alliances need a lasting peace and good relations. Allies never target each other, share vision and may use each other\'s gates and Markets.</p>'+
   '<p class="hint"><b>Victory:</b> you win when everyone still alive is your ally or teammate. Players at <i>peace</i> are still opponents – declare war to finish them.</p>'+
   '<div style="margin-top:6px;min-height:70px">'+_dipLog.map(l=>'<div>• '+l+'</div>').join('')+'</div><div class="btnrow"><span></span><button id="dip-close" class="gold">Close</button></div>',{noPause:true});
  $('dip-close').onclick=closeModal;
  $('modalbox').querySelectorAll('button[data-d]').forEach(b=>b.onclick=()=>{
    const pid=+b.dataset.p,k=b.dataset.d;let res=null;
    if(k==='peace'||k==='ally'){res=proposeDip(0,pid,k);renderDiplomacy((res.ok?'✔ ':'✖ ')+res.text);if(res.ok){msg(res.text,'good')}}
    else if(k==='war'){declareWar(0,pid);renderDiplomacy('You declared war on '+G.players[pid].name+'.')}
    else if(k==='trib'){const sel=$('modalbox').querySelector('select[data-tr="'+pid+'"]').value;res=tribute(0,pid,sel,100);renderDiplomacy((res.ok?'✔ ':'✖ ')+res.text);if(window.AudioSys&&res.ok)AudioSys.sfx('coin')}
  });
}
// ---------- end of game ----------
function showEnd(){
  const o=G.over;if(G.endShown)return;G.endShown=true;
  let rows='';for(const p of G.players)rows+='<tr><td><span class="dot" style="background:'+p.color+'"></span>'+p.name+'</td><td>'+AGES[p.age]+'</td><td>'+p.stats.kills+'</td><td>'+p.stats.losses+'</td><td>'+Math.floor(p.stats.gathered)+'</td><td>'+p.stats.built+'</td><td>'+(p.alive?'Alive':'Defeated')+'</td></tr>';
  openModal('<h2 style="color:'+(o.win?'#9be58a':'#ff8a7a')+'">'+(o.win?'Victory!':'Defeat')+'</h2><p>'+o.text+'</p><table class="dip"><tr><th>Player</th><th>Age</th><th>Kills</th><th>Losses</th><th>Gathered</th><th>Buildings</th><th>Status</th></tr>'+rows+'</table>'+
   '<div class="btnrow"><button id="en-menu">Main menu</button>'+(G.md&&G.md.custom?'<button id="en-editor">Back to Map Editor</button>':'')+'<button id="en-cont">Keep playing</button><button id="en-restart" class="gold">Play again</button></div>',{noPause:true});
  if(window.AudioSys)AudioSys.sfx(o.win?'ageup':'alert');
  $('en-menu').onclick=()=>{closeModal();quitToMenu()};$('en-restart').onclick=()=>{closeModal();restartMatch()};$('en-cont').onclick=()=>{G.over.stop=false;G.over=null;G.endShown=true;G.noEnd=true;closeModal()};
  if($('en-editor'))$('en-editor').onclick=()=>{closeModal();returnToEditor()};
}
