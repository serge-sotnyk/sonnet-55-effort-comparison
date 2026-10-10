'use strict';
// ===== Boot, setup screen, match start, main loop =====
let LAST=null,lastT=0,mmT=0,moodT=0;
const RESSETS={none:{f:0,w:0,g:0,s:0},std:{f:200,w:200,g:100,s:200},med:{f:800,w:800,g:800,s:800},high:{f:2000,w:2000,g:2000,s:2000}};
function loadMaps(){try{return JSON.parse(localStorage.getItem('aor_maps')||'{}')}catch(e){return{}}}
function saveMaps(m){localStorage.setItem('aor_maps',JSON.stringify(m))}
function boot(){
  cv=$('game');ctx=cv.getContext('2d');resizeCanvas();window.addEventListener('resize',()=>{resizeCanvas()});
  uiInit();initSetup();initEditor();
  for(const[id,k]of[['r-f','food'],['r-w','wood'],['r-g','gold'],['r-s','stone'],['r-pop','house']])$(id).querySelector('img').src=iconURL('cmd',k);
  $('mm-play').onclick=()=>{unlockAudio();show('setup')};
  $('mm-editor').onclick=()=>{unlockAudio();openEditor()};
  $('mm-help').onclick=()=>{unlockAudio();openHelp(false);UI.helpFromPause=false};
  $('mm-audio').onclick=()=>{unlockAudio();openAudio(false)};
  document.body.addEventListener('pointerdown',unlockAudio);
  document.addEventListener('mousemove',e=>{UI.edge=true});
  document.addEventListener('mouseleave',()=>{UI.edge=false});
  requestAnimationFrame(loop);
}
function unlockAudio(){if(window.AudioSys&&!AudioSys.unlocked){try{AudioSys.init()}catch(e){console.warn(e)}}}
function show(id){for(const s of['menu','setup'])$(s).classList.toggle('hidden',s!==id);if(id!=='hud')$('hud').classList.add('hidden')}
// ---------- setup screen ----------
function initSetup(){
  const colors=$('s-colors');PCOLORS.forEach((c,i)=>{const d=document.createElement('div');d.className='sw'+(i===0?' sel':'');d.style.background=c.c;d.title=c.n;d.dataset.i=i;d.onclick=()=>{colors.querySelectorAll('.sw').forEach(x=>x.classList.remove('sel'));d.classList.add('sel');updateCivInfo()};colors.appendChild(d)});
  for(const k in CIVS){const o=document.createElement('option');o.value=k;o.textContent=CIVS[k].n;$('s-civ').appendChild(o)}
  $('s-civ').onchange=updateCivInfo;
  for(const k in MAP_TYPES){const o=document.createElement('option');o.value=k;o.textContent=MAP_TYPES[k].n;$('s-map').appendChild(o)}
  const oc=document.createElement('option');oc.value='custom';oc.textContent='Custom map (from the Map Editor)';$('s-map').appendChild(oc);
  for(const k in MAP_SIZES){const o=document.createElement('option');o.value=k;o.textContent=MAP_SIZES[k].n;if(k==='small')o.selected=true;$('s-size').appendChild(o)}
  $('s-map').onchange=updateMapDesc;$('s-ai').onchange=updateTeamsOpt;
  $('s-dice').onclick=()=>{$('s-seed').value=Math.floor(Math.random()*99999)};$('s-dice').onclick();
  $('s-back').onclick=()=>show('menu');
  $('s-start').onclick=()=>startFromSetup();
  const civs=Object.keys(CIVS);$('s-civ').value=civs[Math.floor(Math.random()*civs.length)];
  updateCivInfo();updateMapDesc();updateTeamsOpt();
}
function updateCivInfo(){
  const k=$('s-civ').value,c=CIVS[k];const uu=U[c.uu];
  $('s-civinfo').innerHTML='<b>'+c.n+'</b> <span style="color:#a89868">– speaks '+c.lang+'</span><ul>'+c.bon.map(b=>'<li>'+b+'</li>').join('')+'</ul>'+
   '<div class="uu"><img src="'+iconURL('unit',c.uu)+'"><div><b>Unique unit: '+uu.n+'</b><br>'+uu.d+'</div></div><div style="margin-top:6px"><b>Unique tech:</b> '+(UTECH[c.ut]||{}).n+' (Castle) / '+(UTECH[c.eut]||{}).n+' (Imperial)<br><span style="color:#a89868">'+c.tech+'</span></div>';
}
function updateMapDesc(){
  const k=$('s-map').value;$('s-mapdesc').textContent=k==='custom'?'Play a map you made (or saved) in the Map Editor. Players, terrain, elevation and objects come from the design.':MAP_TYPES[k].d;
  $('s-customrow').classList.toggle('hidden',k!=='custom');
  $('s-size').disabled=k==='custom';$('s-seed').disabled=k==='custom';
  if(k==='custom'){const sel=$('s-custom');sel.innerHTML='';const maps=loadMaps();if(window.EDITOR&&EDITOR.md){const o=document.createElement('option');o.value='__current';o.textContent='(current editor design)';sel.appendChild(o)}for(const n in maps){const o=document.createElement('option');o.value=n;o.textContent=n;sel.appendChild(o)}if(!sel.children.length){const o=document.createElement('option');o.value='';o.textContent='(no saved maps yet)';sel.appendChild(o)}}
}
function updateTeamsOpt(){
  const n=+$('s-ai').value;const t=$('s-teams');
  for(const o of t.options)o.disabled=(o.value!=='ffa'&&n<2);
  if(n<2&&t.value!=='ffa')t.value='ffa';
  $('s-warn').textContent=n<2?'Team modes need at least 2 computer opponents.':'';
}
function readSetup(){
  const colorIdx=+($('s-colors').querySelector('.sel')||{dataset:{i:0}}).dataset.i;
  const seedRaw=$('s-seed').value.trim();let seed=parseInt(seedRaw);if(isNaN(seed)){seed=0;for(const ch of seedRaw)seed=(seed*31+ch.charCodeAt(0))>>>0}
  return{name:$('s-name').value.trim()||'Player',colorIdx,civ:$('s-civ').value,map:$('s-map').value,size:$('s-size').value,seed,nAI:+$('s-ai').value,diff:+$('s-diff').value,teams:$('s-teams').value,startAge:+$('s-age').value,res:$('s-res').value,vis:$('s-vis').value,speed:+$('s-speed').value,cheats:$('s-cheats').checked,tips:$('s-tips').checked,customName:$('s-custom').value};
}
function makeSettings(S,np){
  const rng=mkRng(S.seed*13+7);const civKeys=Object.keys(CIVS).filter(k=>k!==S.civ);
  for(let i=civKeys.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[civKeys[i],civKeys[j]]=[civKeys[j],civKeys[i]]}
  const used=[S.colorIdx];const players=[{name:S.name,civ:S.civ,color:PCOLORS[S.colorIdx].c,ai:false,team:0,diff:1}];
  for(let i=1;i<np;i++){let ci=0;while(used.includes(ci))ci++;used.push(ci);const civ=civKeys[(i-1)%civKeys.length];
    let team=i;if(S.teams==='team1')team=i===1?0:1;else if(S.teams==='allai')team=1;else team=i;
    players.push({name:AI_NAMES[civ],civ,color:PCOLORS[ci].c,ai:true,team,diff:S.diff})}
  if(S.teams==='ffa')players.forEach((p,i)=>p.team=i);
  return{players,res:RESSETS[S.res],speed:S.speed,startAge:S.startAge,visibility:S.vis,cheats:S.cheats,tips:S.tips,mapType:S.map,seed:S.seed,size:S.size,diff:S.diff};
}
function startFromSetup(){
  const S=readSetup();let md,np=S.nAI+1;
  if(S.map==='custom'){
    const maps=loadMaps();let json=null;
    if(S.customName==='__current'&&EDITOR.md)json=mdToJSON(EDITOR.md);else if(maps[S.customName])json=maps[S.customName];
    if(!json){$('s-warn').textContent='Choose or create a custom map first (Map Editor).';return}
    md=mdFromJSON(json);np=Math.min(np,md.np);
    const errs=validateMap(md);if(errs.length){$('s-warn').textContent='Map not playable: '+errs[0];return}
    if(S.nAI+1>md.np)$('s-warn').textContent='';
    S.nAI=np-1;LAST={S,mdJson:json,custom:true};
  }else{
    md=genMap({type:S.map,size:MAP_SIZES[S.size].s,seed:S.seed,np});LAST={S,custom:false};
  }
  const set=makeSettings(S,np);
  startMatch(set,md);
}
function restartMatch(){
  if(!LAST)return;const S=LAST.S;let md,np=S.nAI+1;
  if(LAST.custom){md=mdFromJSON(LAST.mdJson);np=Math.min(np,md.np)}else md=genMap({type:S.map,size:MAP_SIZES[S.size].s,seed:S.seed,np});
  startMatch(makeSettings(S,np),md);
}
function startMatch(set,md){
  $('menu').classList.add('hidden');$('setup').classList.add('hidden');$('editor').classList.add('hidden');R.editor=false;
  newGame(set,md);aiInit();renderInit();updateMinimapBase();
  G.onMsg=(t,k,x,y)=>{toast(t,k);if(k==='warn'&&x!==undefined){UI.lastAlert={x,y};UI.alertT=G.time;R.marks.push({x,y,t:0,col:'#ff5a4a'})}};
  G.onFloat=(t,res,x,y)=>{R.floats.push({text:t,col:RCOL[res]||'#fff',x,y,t:0});if(R.floats.length>20)R.floats.shift()};
  G.onSfx=gameSfx;
  $('hud').classList.remove('hidden');
  UI.sel=[];R.selIds=new Set();UI.menu='root';UI.mode=null;UI.placing=null;R.ghost=null;UI.tipIdx=0;UI.tipT=0;UI.groups={};R.marks=[];R.floats=[];_selSig='';
  $('toasts').innerHTML='';$('chatlog').innerHTML='';$('captions').innerHTML='';
  const p=G.players[0];centerOn(p.start.x,p.start.y);CAM.zoom=1;clampCam();
  const tc=G.blds.find(b=>b.owner===0&&b.type==='towncenter');if(tc)setSel([tc.id]);
  uiRefresh(true);
  unlockAudio();if(window.AudioSys){AudioSys.setMusicMood('peace');AudioSys.setAmbient({water:G.terr.some(t=>t>=3)})}
  toast('Welcome to '+(md.custom?md.name:MAP_TYPES[set.mapType].n)+' – good luck, '+p.name+'!','good');
  toast('Win by defeating every player who is not allied with you (see Diplomacy).');
  if(set.cheats)chatLine('Cheats enabled – press Enter to type a code (see Help).','ok');
  window.__G=G;
}
function gameSfx(name,x,y,opts){
  if(!window.AudioSys||!AudioSys.unlocked||R.editor)return;
  const[sx,sy]=toScr(x,y,hAt(x,y));
  const margin=(opts&&opts.always)?1e9:260;
  if(sx<-margin||sx>VW+margin||sy<-margin||sy>VH+margin)return;
  const tx=clamp(Math.floor(x),0,G.W-1),ty=clamp(Math.floor(y),0,G.H-1);
  if(!(opts&&opts.always)&&!seenTile(tx,ty))return;
  const pan=clamp((sx/VW-0.5)*1.6,-1,1);
  let vol=(opts&&opts.vol)||1;if(sx<0||sx>VW||sy<0||sy>VH)vol*=0.4;vol*=clamp(CAM.zoom+0.3,0.6,1.3);
  AudioSys.sfx(name,{vol,pan});
}
function quitToMenu(){
  if(G)G.paused=true;$('hud').classList.add('hidden');R.editor=false;$('editor').classList.add('hidden');show('menu');
  if(window.AudioSys){AudioSys.setMusicMood('peace');AudioSys.setAmbient({water:false})}
}
function returnToEditor(){if(G)G.paused=true;$('hud').classList.add('hidden');openEditor(true)}
// ---------- main loop ----------
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(0.1,(now-lastT)/1000||0.016);lastT=now;
  if(R.editor){editorFrame(now,dt);return}
  if(!G||$('hud').classList.contains('hidden')){ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,VW,VH);return}
  if(!G.paused)stepGame(dt);
  uiUpdate(dt);
  drawFrame(now);
  mmT-=dt;if(mmT<=0){mmT=0.25;updateMinimapBase()}
  drawMinimap($('minimap'),$('minimap').getContext('2d'));
  moodT-=dt;if(moodT<=0&&window.AudioSys&&AudioSys.unlocked){moodT=2;AudioSys.setMusicMood(G.time-G.lastCombat<12?'battle':'peace')}
  if(G.over&&!G.endShown)showEnd();
  if(G.over&&G.over.win===false&&false){}
}
window.addEventListener('load',boot);
