import { Game, SIZE, AGES, AGE_ROMAN, AGE_COSTS, AGE_TIMES, BUILDINGS, UNITS, TECHS, center, distance } from './game.js';
import { Renderer, iso } from './render.js';
import { icon, fillIcons } from './icons.js';
fillIcons();
const $ = id => document.getElementById(id);
let game = new Game(), renderer = new Renderer($('world'), $('minimap'), game);
let selection = [], buildMenu = false, placementType = null, placementBuilders = [], attackMode = false, touchCommand = false, modalOpen = false, pausedBeforeModal = false, actionSignature = '', portraitSignature = '', tooltipSpec = null;
const groups = new Map(); let lastGroup = '', lastGroupTime = 0, difficultyChoice = 'standard', introDismissed = window.innerWidth < 560;
$('objective-content').classList.toggle('hidden', introDismissed); $('objective-toggle').textContent = introDismissed ? '+' : '−';
const fmt = n => Math.floor(n).toLocaleString('en-US');
const clock = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const unitName = u => u.type === 'militia' ? ['Militia', 'Man-at-Arms', 'Long Swordsman', 'Champion'][game.players[u.owner].age] : u.type === 'archer' && game.players[u.owner].age >= 2 ? 'Crossbowman' : UNITS[u.type].name;
const costHTML = cost => Object.entries(cost || {}).map(([r, n]) => `<span>${icon(r)}${n}</span>`).join('');
class Sound {
  constructor() { this.enabled = false; this.ctx = null; this.lastMusic = 0; }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) { this.ctx ||= new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume(); this.note(293.66, .2, .055); this.lastMusic = -100; }
    $('audio-button').innerHTML = icon(this.enabled ? 'sound' : 'mute'); $('audio-button').title = this.enabled ? 'Mute sound' : 'Enable sound'; $('audio-button').setAttribute('aria-label', $('audio-button').title);
  }
  note(f, duration = .2, volume = .025, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime + delay;
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + duration);
  }
  play(type) { if (type === 'danger') { this.note(146.83, .3, .07); this.note(110, .5, .05, .3); } else if (type === 'age' || type === 'success') [293.66, 349.23, 440, 587.33].forEach((f, i) => this.note(f, .7, .04, i * .12)); else this.note(440, .08, .024); }
  music(time) {
    if (!this.enabled || game.paused || time - this.lastMusic < 12) return; this.lastMusic = time;
    [146.83, 220, 293.66, 261.63, 220, 174.61, 196, 220].forEach((f, i) => { this.note(f, 1.4, .011, i * .65); this.note(f * 2, .5, .009, i * .65 + .06); });
  }
}
const sound = new Sound();
function notify(text, tone = 'info') {
  $('status-text').textContent = text;
  if (tone === 'quiet') return;
  const toast = document.createElement('div'); toast.className = `toast ${tone}`; toast.textContent = text; $('announcements').append(toast);
  if ($('announcements').children.length > 3) $('announcements').firstElementChild.remove();
  setTimeout(() => toast.remove(), tone === 'age' ? 6500 : 4200); sound.play(tone);
}
function wireGame() {
  game.onEvent = event => {
    if (event.text) notify(event.text, event.tone);
    if (event.type === 'age') { actionSignature = ''; updateHUD(); }
    if (event.type === 'end') { selection = selection.filter(e => e.alive); showResult(); }
  };
}
wireGame();
function setSelection(entities) {
  selection = [...new Map(entities.filter(e => e?.alive && !e.garrison).map(e => [e.id, e])).values()];
  renderer.selected = selection; buildMenu = false; actionSignature = ''; portraitSignature = ''; updateHUD();
  if (selection.length) sound.note(330, .055, .02);
}
function ownTC() { return game.own(0, 'building').find(e => e.type === 'towncenter'); }
function home() { cancelMode(); const tc = ownTC(); if (tc) { renderer.focus(tc); setSelection([tc]); } }
function cancelMode() { placementType = null; renderer.placement = null; attackMode = false; $('mode-hint').classList.add('hidden'); $('world').style.cursor = 'default'; actionSignature = ''; }
function choosePlacement(type) {
  const d = BUILDINGS[type], builders = selection.filter(e => e.type === 'villager' && e.owner === 0);
  if (!builders.length) return notify('Select a Villager before placing a building.', 'warning');
  if (game.players[0].age < d.age) return notify(`Requires the ${AGES[d.age]}.`, 'warning');
  if (!game.canAfford(0, d.cost)) return notify('Not enough resources for this building.', 'warning');
  placementType = type; placementBuilders = builders; attackMode = false;
  const world = renderer.world(renderer.mouse.x, renderer.mouse.y); renderer.placement = { type, x: Math.floor(world.x), y: Math.floor(world.y) };
  $('mode-hint').innerHTML = `Place ${d.name} · Left click on clear ground <kbd>Esc</kbd> to cancel`; $('mode-hint').classList.remove('hidden'); $('world').style.cursor = 'crosshair';
  $('tooltip').classList.add('hidden');
}
function startAttackMove() {
  if (!selection.some(e => e.kind === 'unit' && e.owner === 0)) return;
  cancelMode(); attackMode = true; $('mode-hint').innerHTML = `Attack move · Left click a destination <kbd>Esc</kbd> to cancel`; $('mode-hint').classList.remove('hidden'); $('world').style.cursor = 'crosshair';
}
function command(x, y) {
  if (modalOpen || game.result) return;
  const target = renderer.pick(x, y), point = renderer.world(x, y), units = selection.filter(u => u.owner === 0 && u.kind === 'unit');
  let acted = false; const movers = [];
  for (const u of units) {
    u.autoExplore = false;
    if (target?.owner === 1) { game.order(u, { type: 'attack', target: target.id }); acted = true; }
    else if (u.type === 'villager' && (target?.kind === 'resource' || target?.type === 'farm' && target.owner === 0 && target.progress >= 1)) { game.assignGather(u, target.resource || 'food', target); acted = true; }
    else if (u.type === 'villager' && target?.kind === 'building' && target.owner === 0 && target.progress < 1) { game.order(u, { type: 'build', target: target.id }); acted = true; }
    else if (u.type === 'villager' && target?.kind === 'building' && target.owner === 0 && target.hp < target.maxHp) { game.order(u, { type: 'repair', target: target.id }); acted = true; }
    else if (target?.owner === 0 && ['towncenter', 'castle', 'tower'].includes(target.type)) { game.order(u, { type: 'garrison', target: target.id }); acted = true; }
    else movers.push(u);
  }
  if (movers.length) game.moveGroup(movers, point.x, point.y);
  if (acted) game.effects.push({ type: 'marker', x: target.x, y: target.y, life: .8, maxLife: .8, attack: target.owner === 1 });
  for (const b of selection.filter(b => b.kind === 'building' && b.owner === 0 && BUILDINGS[b.type].trains)) { b.rally = { x: point.x, y: point.y, target: target?.id }; notify('Rally point set. New units will follow this order.', 'quiet'); }
  if (units.length) sound.note(261.63, .1, .03); actionSignature = '';
}
const canvas = $('world');
const mousePoint = event => { const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
canvas.addEventListener('pointerdown', event => {
  if (modalOpen || game.result) return;
  const point = mousePoint(event); renderer.mouse = point; canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
  if (event.button === 1 || (event.button === 0 && event.altKey)) { renderer.drag = { pan: true, start: point, camera: { ...renderer.camera } }; event.preventDefault(); return; }
  if (event.button !== 0) return;
  if (placementType) {
    const world = renderer.world(point.x, point.y), b = game.construct(placementType, Math.floor(world.x), Math.floor(world.y), placementBuilders);
    if (b && !event.shiftKey) { cancelMode(); setSelection([b]); } actionSignature = ''; return;
  }
  if (attackMode) { const world = renderer.world(point.x, point.y); game.moveGroup(selection.filter(e => e.kind === 'unit' && e.owner === 0), world.x, world.y, true); cancelMode(); return; }
  if (event.pointerType === 'touch' && touchCommand) { command(point.x, point.y); return; }
  renderer.drag = { start: point, box: false, shift: event.shiftKey };
});
canvas.addEventListener('pointermove', event => {
  const point = mousePoint(event); renderer.mouse = point;
  if (renderer.drag?.pan) { renderer.camera.x = renderer.drag.camera.x - (point.x - renderer.drag.start.x) / renderer.zoom; renderer.camera.y = renderer.drag.camera.y - (point.y - renderer.drag.start.y) / renderer.zoom; }
  else if (renderer.drag && Math.hypot(point.x - renderer.drag.start.x, point.y - renderer.drag.start.y) > 6) renderer.drag.box = true;
  if (placementType) { const world = renderer.world(point.x, point.y); renderer.placement = { type: placementType, x: Math.floor(world.x), y: Math.floor(world.y) }; }
  else { renderer.hovered = renderer.pick(point.x, point.y); if (!attackMode) canvas.style.cursor = renderer.hovered?.owner === 1 && selection.some(e => e.kind === 'unit') ? 'crosshair' : renderer.hovered ? 'pointer' : 'default'; }
});
canvas.addEventListener('pointerup', event => {
  const drag = renderer.drag; renderer.drag = null; if (!drag || drag.pan || event.button !== 0) return;
  const point = mousePoint(event);
  if (drag.box) {
    const x1 = Math.min(drag.start.x, point.x), x2 = Math.max(drag.start.x, point.x), y1 = Math.min(drag.start.y, point.y), y2 = Math.max(drag.start.y, point.y);
    const found = game.own(0, 'unit').filter(e => { const a = renderer.screen(e.x, e.y, 10); return !e.garrison && a.x >= x1 && a.x <= x2 && a.y >= y1 && a.y <= y2; });
    setSelection(drag.shift ? [...selection, ...found] : found);
  } else {
    const e = renderer.pick(point.x, point.y);
    if (drag.shift && e?.owner === 0 && e.kind === 'unit') setSelection(selection.some(u => u.id === e.id) ? selection.filter(u => u.id !== e.id) : [...selection.filter(u => u.kind === 'unit'), e]);
    else setSelection(e ? [e] : []);
  }
});
canvas.addEventListener('pointercancel', () => renderer.drag = null);
canvas.addEventListener('dblclick', event => { const p = mousePoint(event), e = renderer.pick(p.x, p.y); if (e?.kind === 'unit' && e.owner === 0) setSelection(game.own(0, 'unit').filter(u => u.type === e.type && !u.garrison && Math.abs(renderer.screen(u.x, u.y).x - renderer.width / 2) < renderer.width / 2 && Math.abs(renderer.screen(u.x, u.y).y - renderer.height / 2) < renderer.height / 2)); });
canvas.addEventListener('contextmenu', event => { event.preventDefault(); if (placementType || attackMode) cancelMode(); else { const point = mousePoint(event); command(point.x, point.y); } });
canvas.addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, mousePoint(event)); }, { passive: false });
function zoom(factor, point = { x: renderer.width / 2, y: renderer.height / 2 }) {
  const before = renderer.world(point.x, point.y); renderer.zoom = Math.min(1.9, Math.max(.6, renderer.zoom * factor)); const after = renderer.world(point.x, point.y);
  const a = iso(before.x, before.y), b = iso(after.x, after.y); renderer.camera.x += a.x - b.x; renderer.camera.y += a.y - b.y; $('zoom-level').textContent = `${Math.round(renderer.zoom / 1.18 * 100)}%`;
}
$('zoom-in').onclick = () => zoom(1.12); $('zoom-out').onclick = () => zoom(1 / 1.12);
function minimapClick(event) { const r = $('minimap').getBoundingClientRect(); renderer.minimapFocus((event.clientX - r.left) * $('minimap').width / r.width, (event.clientY - r.top) * $('minimap').height / r.height); }
$('minimap').addEventListener('pointerdown', event => { minimapClick(event); $('minimap').setPointerCapture(event.pointerId); });
$('minimap').addEventListener('pointermove', event => { if (event.buttons === 1) minimapClick(event); });
$('map-center').onclick = home; $('home-button').onclick = home; $('age-button').onclick = home;
function idleVillagers() { cancelMode(); const units = game.own(0, 'unit').filter(u => u.type === 'villager' && !u.garrison && u.order.type === 'idle'); if (units.length) { setSelection(units); renderer.focus(units[0]); } else notify('Every Villager has a task. Your economy is working.', 'quiet'); }
function allArmy() { cancelMode(); const army = game.own(0, 'unit').filter(u => u.type !== 'villager' && !u.garrison); setSelection(army); if (army.length) renderer.focus(army[0]); }
$('idle-button').onclick = idleVillagers; $('army-button').onclick = allArmy;
$('touch-command').onclick = () => { touchCommand = !touchCommand; $('touch-command-label').textContent = touchCommand ? 'Select' : 'Command'; $('touch-command').style.color = touchCommand ? '#e7c88b' : ''; notify(touchCommand ? 'Tap the map to command selected units. Tap Select to switch back.' : 'Tap a unit or building to select it.', 'quiet'); };
function pause() { if (modalOpen || game.result) return; game.paused = !game.paused; updateHUD(); }
$('pause-button').onclick = pause;
$('speed-button').onclick = () => { game.speed = game.speed === 1 ? 1.5 : game.speed === 1.5 ? 2 : 1; updateHUD(); };
$('audio-button').onclick = () => sound.toggle();
$('objective-toggle').onclick = () => { introDismissed = !introDismissed; $('objective-content').classList.toggle('hidden', introDismissed); $('objective-toggle').textContent = introDismissed ? '+' : '−'; };
document.addEventListener('keydown', event => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (key === 'escape') { if (modalOpen && !game.result) closeModal(); else if (modalOpen && game.result) showResult(); else if (placementType || attackMode || buildMenu) { cancelMode(); buildMenu = false; actionSignature = ''; } else setSelection([]); return; }
  if (modalOpen) return;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (key === ' ') { if (!event.repeat) pause(); return; }
  if (key === '?' || key === '/') { showHelp(); return; }
  if (event.repeat) { if (['w', 'a', 's', 'd'].includes(key) || key.startsWith('arrow')) renderer.keys.add(event.key.startsWith('Arrow') ? event.key : key); return; }
  if (key === 'h') home();
  else if (key === '.') idleVillagers();
  else if (key === 'm') allArmy();
  else if (key === 'b' && selection.some(e => e.type === 'villager' && e.owner === 0)) { buildMenu = !buildMenu; actionSignature = ''; updateHUD(); }
  else if (key === 'f') startAttackMove();
  else if (key === 'x') selection.filter(e => e.kind === 'unit' && e.owner === 0).forEach(u => { u.autoExplore = false; game.order(u, { type: 'idle' }); });
  else if (key === 'q' && selection[0]?.kind === 'building' && selection[0]?.owner === 0) { const types = BUILDINGS[selection[0].type].trains; if (types?.length) game.enqueue(selection[0], types[0]); }
  else if (key === 'g') garrison();
  else if (/^[1-9]$/.test(key)) {
    if (event.ctrlKey || event.metaKey) { event.preventDefault(); groups.set(key, selection.map(e => e.id)); notify(`Control group ${key} assigned (${selection.length} selected).`, 'quiet'); }
    else if (groups.has(key)) { setSelection(groups.get(key).map(id => game.get(id)).filter(Boolean)); if (key === lastGroup && performance.now() - lastGroupTime < 450 && selection.length) renderer.focus(selection[0]); lastGroup = key; lastGroupTime = performance.now(); }
  } else if (['w', 'a', 's', 'd'].includes(key) || event.key.startsWith('Arrow')) renderer.keys.add(event.key.startsWith('Arrow') ? event.key : key);
});
document.addEventListener('keyup', event => { renderer.keys.delete(event.key); renderer.keys.delete(event.key.toLowerCase()); });
window.addEventListener('blur', () => { renderer.keys.clear(); renderer.drag = null; });
function garrison() {
  const b = selection[0];
  if (b?.kind === 'building') {
    game.own(0, 'unit').filter(u => u.garrison === b.id).forEach(u => { u.garrison = null; const pos = game.spawnPoint(b); u.x = pos.x; u.y = pos.y; if (u.type === 'villager') game.assignGather(u, game.lowestResource(0)); }); notify('Garrisoned units released.', 'quiet');
  } else {
    const tc = ownTC(); if (tc) selection.filter(u => u.kind === 'unit' && u.owner === 0).forEach(u => game.order(u, { type: 'garrison', target: tc.id })); notify('Units are returning to shelter in your Town Center.', 'quiet');
  }
  actionSignature = '';
}
let currentActions = [];
function actionsForSelection() {
  const e = selection[0], p = game.players[0];
  if (!e) return [{ id: 'home', name: 'Town Center', icon: 'towncenter', hotkey: 'H', sub: 'Select the heart of your kingdom.' }, { id: 'idle', name: 'Idle Villagers', icon: 'villager', hotkey: '.', sub: 'Find settlers who need a task.' }, { id: 'army', name: 'Select Army', icon: 'sword', hotkey: 'M', sub: 'Select all of your military units.' }, { id: 'help', name: 'How to Play', icon: 'help', hotkey: '?', sub: 'Learn the commands and plan your conquest.' }];
  if (e.owner === 1) return [{ id: 'attack', name: 'Find Army', icon: 'sword', sub: 'Select your army to attack this enemy.' }];
  if (e.kind === 'resource') return [{ id: 'workers', name: 'Find Villager', icon: 'villager', sub: 'Select the closest Villager, then right click this resource to gather.' }];
  if (e.kind === 'unit') {
    if (e.type === 'villager') {
      if (buildMenu) return [{ id: 'back', name: 'Back', icon: 'arrow', sub: 'Return to Villager commands.', small: true }, ...Object.entries(BUILDINGS).map(([type, d]) => ({ id: `build:${type}`, ...d, name: d.name.replace(' Camp', '').replace(' Workshop', '').replace(' Range', ''), locked: p.age < d.age, small: true }))];
      return [{ id: 'build', name: 'Build', icon: 'build', hotkey: 'B', sub: 'Place buildings, farms, and defenses.' }, ...['food', 'wood', 'gold', 'stone'].map(r => ({ id: `gather:${r}`, name: `Gather ${r[0].toUpperCase() + r.slice(1)}`, icon: r, sub: `Send selected Villagers to nearby ${r === 'food' ? 'farms and berry bushes' : r === 'wood' ? 'trees' : r + ' deposits'}.` })), { id: 'garrison', name: 'Take Shelter', icon: 'shield', hotkey: 'G', sub: 'Garrison in your Town Center. Units recover health and improve its defense.' }, { id: 'stop', name: 'Stop', icon: 'stop', hotkey: 'X', sub: 'Stop the current task.' }];
    }
    return [{ id: 'attackmove', name: 'Attack Move', icon: 'sword', hotkey: 'F', sub: 'Click a destination. Your army attacks enemies it meets along the way.' }, { id: 'stand', name: e.stance === 'stand' ? 'Aggressive' : 'Stand Ground', icon: 'shield', sub: e.stance === 'stand' ? 'Automatically engage enemies nearby.' : 'Stay in place. Right click an enemy to attack it.' }, { id: 'stop', name: 'Stop', icon: 'stop', hotkey: 'X', sub: 'Halt and engage nearby enemies.' }, { id: 'garrison', name: 'Take Shelter', icon: 'towncenter', hotkey: 'G', sub: 'Return to the Town Center and recover health.' }, ...(e.type === 'scout' ? [{ id: 'explore', name: e.autoExplore ? 'Stop Exploring' : 'Explore', icon: 'compass', sub: 'Automatically explore the frontier and reveal the enemy settlement.' }] : [])];
  }
  if (e.progress < 1) return [{ id: 'assist', name: 'Add Builder', icon: 'build', sub: 'Assign another Villager to speed up this construction.' }, { id: 'cancelbuild', name: 'Cancel', icon: 'close', sub: 'Cancel construction and recover 75% of its cost.' }];
  const def = BUILDINGS[e.type];
  const actions = (def.trains || []).map((type, i) => ({ id: `train:${type}`, ...UNITS[type], name: type === 'militia' ? ['Militia', 'Man-at-Arms', 'Long Swordsman', 'Champion'][p.age] : UNITS[type].name, hotkey: i === 0 ? 'Q' : '', locked: p.age < UNITS[type].age }));
  if (e.type === 'towncenter') {
    actions.push({ id: 'tech:loom', ...TECHS.loom, researched: p.techs.includes('loom') || e.queue.some(q => q.type === 'loom') });
    if (p.age < 3) actions.push({ id: 'advance', name: `Advance to ${AGES[p.age + 1]}`, cost: AGE_COSTS[p.age], time: AGE_TIMES[p.age], advance: true, roman: AGE_ROMAN[p.age + 1], sub: `Unlock ${p.age === 0 ? 'archers, cavalry, markets and blacksmith upgrades' : p.age === 1 ? 'knights, castles, longbowmen and siege rams' : 'the strongest infantry and the final age'}.`, locked: !!game.ageRequirements(0) || game.own(0, 'building').some(b => b.queue.some(q => q.kind === 'age')), requirement: game.ageRequirements(0) });
  }
  for (const type of def.tech || []) actions.push({ id: `tech:${type}`, ...TECHS[type], locked: p.age < TECHS[type].age, researched: p.techs.includes(type) || game.own(0, 'building').some(b => b.queue.some(q => q.type === type)) });
  if (['towncenter', 'tower', 'castle'].includes(e.type) && game.own(0, 'unit').some(u => u.garrison === e.id)) actions.push({ id: 'garrison', name: 'Ungarrison', icon: 'people', hotkey: 'G', sub: 'Release sheltered units.' });
  if (e.type === 'market') for (const r of ['food', 'wood', 'stone']) { actions.push({ id: `sell:${r}`, name: `Sell ${r}`, icon: r, sub: `Sell 100 ${r} for 70 gold.`, cost: { [r]: 100 } }); actions.push({ id: `buy:${r}`, name: `Buy ${r}`, icon: r, sub: `Buy 100 ${r} for 130 gold.`, cost: { gold: 130 } }); }
  if (e.type === 'farm') actions.push({ id: 'farmworker', name: 'Assign Farmer', icon: 'villager', sub: 'Send the closest free Villager to work this Farm.' });
  return actions.length ? actions : [{ id: 'workers', name: 'Find Villager', icon: 'villager', sub: 'Select a nearby Villager.' }];
}
function renderActions() {
  currentActions = actionsForSelection();
  const signature = `${selection.map(e => e.id)}|${buildMenu}|${currentActions.map(a => `${a.id}:${!!a.locked}:${!!a.researched}:${a.name}`).join(',')}`;
  if (signature === actionSignature) return;
  actionSignature = signature;
  $('actions').innerHTML = currentActions.map((a, i) => `<button class="action-button ${a.advance ? 'advance' : ''} ${a.small ? 'build-option' : ''} ${a.locked ? 'locked' : ''} ${a.researched ? 'researched' : ''}" data-action-index="${i}" aria-label="${a.name}" ${a.researched ? 'disabled' : ''}>${a.hotkey ? `<span class="hotkey">${a.hotkey}</span>` : ''}${a.advance ? `<div class="roman">${a.roman}</div>` : icon(a.icon)}<span>${a.advance ? `${AGES[game.players[0].age + 1]}` : a.name}</span>${a.advance ? `<small>${costHTML(a.cost)}</small>` : a.researched ? '<small>RESEARCHED</small>' : ''}</button>`).join('');
  const e = selection[0];
  $('actions-title').textContent = buildMenu ? 'BUILD YOUR SETTLEMENT' : !e ? 'YOUR KINGDOM AWAITS' : e.kind === 'unit' ? selection.length > 1 ? `${selection.length} UNITS SELECTED` : 'UNIT COMMANDS' : e.kind === 'resource' ? 'RESOURCE DEPOSIT' : e.progress < 1 ? 'UNDER CONSTRUCTION' : `${BUILDINGS[e.type]?.name || 'ENEMY'} COMMANDS`.toUpperCase();
  $('action-description').textContent = buildMenu ? 'Choose a building, then click clear ground. Shift + click to place more. Esc cancels.' : e?.kind === 'building' && BUILDINGS[e.type].trains ? 'Right click the map to set a rally point. Click queued items to cancel and refund.' : e?.type === 'villager' ? 'Right click a resource to gather, a foundation to build, or a damaged building to repair.' : e?.kind === 'unit' ? 'Right click to move or attack. Use Attack Move to fight along the way.' : 'Select your people, grow your settlement, and write your own history.';
}
$('actions').addEventListener('click', event => {
  const b = event.target.closest('[data-action-index]'); if (!b) return;
  const a = currentActions[+b.dataset.actionIndex], e = selection[0]; if (!a) return;
  if (a.locked) { notify(a.requirement || (a.id === 'advance' ? 'Your kingdom is already advancing.' : `Requires the ${AGES[a.age]}.`), 'warning'); return; }
  const [action, type] = a.id.split(':');
  if (action === 'train') game.enqueue(e, type);
  else if (action === 'tech') game.enqueue(e, type, 'tech');
  else if (action === 'advance') game.enqueue(e, 'age', 'age');
  else if (action === 'build' && type) choosePlacement(type);
  else if (action === 'build' || action === 'back') { buildMenu = !buildMenu; actionSignature = ''; }
  else if (action === 'gather') selection.filter(u => u.type === 'villager' && u.owner === 0).forEach(u => game.assignGather(u, type));
  else if (action === 'stop') selection.filter(u => u.kind === 'unit' && u.owner === 0).forEach(u => { u.autoExplore = false; game.order(u, { type: 'idle' }); });
  else if (action === 'stand') { const stance = e.stance === 'stand' ? 'aggressive' : 'stand'; selection.filter(u => u.kind === 'unit' && u.owner === 0).forEach(u => { u.stance = stance; if (stance === 'stand') game.order(u, { type: 'idle' }); }); actionSignature = ''; }
  else if (action === 'attackmove') startAttackMove();
  else if (action === 'garrison') garrison();
  else if (action === 'explore') { e.autoExplore = !e.autoExplore; if (!e.autoExplore) game.order(e, { type: 'idle' }); actionSignature = ''; }
  else if (action === 'home') home();
  else if (action === 'idle') idleVillagers();
  else if (action === 'army' || action === 'attack') allArmy();
  else if (action === 'help') showHelp();
  else if (['workers', 'assist', 'farmworker'].includes(action)) {
    const villagers = game.own(0, 'unit').filter(u => u.type === 'villager' && !u.garrison && u.order.target !== e.id).sort((a, b) => distance(a, center(e)) - distance(b, center(e)));
    if (villagers.length) { if (action === 'assist') game.order(villagers[0], { type: 'build', target: e.id }); else if (action === 'farmworker') game.assignGather(villagers[0], 'food', e); else { setSelection([villagers[0]]); renderer.focus(villagers[0]); } }
  } else if (action === 'cancelbuild') { game.refund(0, BUILDINGS[e.type].cost, .75); e.alive = false; notify('Construction cancelled. 75% of resources returned.', 'quiet'); setSelection([]); }
  else if (action === 'sell' || action === 'buy') game.trade(type, action === 'buy');
  sound.note(392, .065, .02); actionSignature = ''; updateHUD();
});
$('actions').addEventListener('pointerover', event => {
  const b = event.target.closest('[data-action-index]'); if (!b) return;
  const a = currentActions[+b.dataset.actionIndex]; if (!a) return;
  tooltipSpec = a; $('tooltip').innerHTML = `<strong>${a.name}</strong><p>${a.sub || ''}</p><div class="costs">${costHTML(a.cost)}${a.time ? `<span>${icon('clock')}${a.time}s</span>` : ''}</div>${a.locked ? `<small>${a.requirement || (a.age !== undefined ? 'Requires ' + AGES[a.age] : 'Age advancement is underway.')}</small>` : a.researched ? '<small>Already researched or in progress</small>' : a.cost && !game.canAfford(0, a.cost) ? '<small>Not enough resources</small>' : ''}`;
  $('tooltip').classList.remove('hidden'); const r = b.getBoundingClientRect(), tr = $('tooltip').getBoundingClientRect(); $('tooltip').style.left = `${Math.min(window.innerWidth - tr.width - 12, Math.max(12, r.left))}px`; $('tooltip').style.top = `${r.top - tr.height - 12}px`;
});
$('actions').addEventListener('pointerout', event => { if (!event.target.closest('[data-action-index]')?.contains(event.relatedTarget)) { $('tooltip').classList.add('hidden'); tooltipSpec = null; } });
function renderSelection() {
  const e = selection[0], multi = selection.length > 1;
  if (!e) {
    $('selection-kind').textContent = 'A NEW CHAPTER'; $('selection-name').textContent = 'Your Kingdom'; $('selection-description').textContent = 'Select a unit or building to give it a command.'; $('selection-hp').textContent = 'BRITONS · BLUE STANDARD'; $('selection-health-bar').style.width = '0%'; $('selection-stats').innerHTML = ''; $('portrait-age').textContent = AGES[game.players[0].age].toUpperCase();
    if (portraitSignature !== 'none') { renderer.portrait($('portrait'), ownTC()); portraitSignature = 'none'; } return;
  }
  const def = e.kind === 'building' ? BUILDINGS[e.type] : e.kind === 'unit' ? UNITS[e.type] : null;
  $('selection-kind').textContent = e.owner === 1 ? 'ENEMY · THE IRON CROWN' : multi ? 'YOUR PEOPLE' : e.kind === 'building' ? e.progress < 1 ? `CONSTRUCTION · ${Math.floor(e.progress * 100)}%` : ['barracks', 'stable', 'archery', 'siege', 'castle', 'tower'].includes(e.type) ? 'MILITARY BUILDING' : 'ECONOMIC BUILDING' : e.kind === 'unit' ? e.type === 'villager' ? 'ECONOMIC UNIT' : 'MILITARY UNIT' : 'NATURAL RESOURCE';
  $('selection-name').textContent = multi ? `${selection.length} ${selection.every(u => u.type === 'villager') ? 'Villagers' : 'Units'}` : e.kind === 'unit' ? unitName(e) : def?.name || (e.type === 'tree' ? 'Forest' : e.type === 'berries' ? 'Berry Bush' : `${e.type[0].toUpperCase() + e.type.slice(1)} Deposit`);
  $('selection-description').textContent = multi ? `${selection.filter(u => u.type === 'villager').length} villagers · ${selection.filter(u => u.type !== 'villager').length} military` : def?.sub || `Right click with a Villager to gather ${e.resource}.`;
  const hp = multi ? selection.reduce((s, e) => s + (e.hp || 0), 0) : e.hp, maxHp = multi ? selection.reduce((s, e) => s + (e.maxHp || 0), 0) : e.maxHp;
  $('selection-hp').textContent = hp ? `${fmt(hp)} / ${fmt(maxHp)}` : `${fmt(e.amount)} ${e.resource} remaining`; $('selection-health-bar').style.width = hp ? `${Math.max(0, hp / maxHp * 100)}%` : '100%';
  $('portrait-age').textContent = e.owner === -1 ? 'THE FRONTIER' : AGES[game.players[e.owner].age].toUpperCase();
  $('selection-stats').innerHTML = e.kind === 'unit' ? `<span>${icon('sword')}${game.unitStats(e.owner, e.type).attack}</span><span>${icon('bow')}${game.unitStats(e.owner, e.type).range}</span>${e.type === 'villager' && e.carry > 0 ? `<span>${icon(e.carryType)}${fmt(e.carry)}</span>` : ''}` : e.kind === 'building' ? `${def.pop ? `<span>${icon('people')}+${def.pop}</span>` : ''}${def.attack ? `<span>${icon('sword')}${def.attack}</span>` : ''}<span>${icon('shield')}${e.owner === 0 ? 'Britons' : 'Franks'}</span>` : `<span>${icon(e.resource)}${e.resource.toUpperCase()}</span>`;
  const sig = `${e.id}:${multi}:${game.players[e.owner]?.age}`;
  if (sig !== portraitSignature) { renderer.portrait($('portrait'), e); portraitSignature = sig; }
}
function renderQueue() {
  const e = selection[0], queue = e?.kind === 'building' ? e.queue : [], q = queue[0];
  $('queue-total').textContent = `${queue.length} / 8`;
  if (!q) { const allQueues = game.own(0, 'building').filter(b => b.queue.length); $('queue-content').innerHTML = `<div class="queue-empty">${icon('hourglass')}<p>${allQueues.length ? 'Work is underway.' : 'A quiet moment.'}</p><small>${allQueues.length ? allQueues.length + ' building' + (allQueues.length > 1 ? 's' : '') + ' producing elsewhere.' : 'Your next chapter awaits.'}</small></div>`; return; }
  const def = q.kind === 'unit' ? UNITS[q.type] : q.kind === 'tech' ? TECHS[q.type] : { name: AGES[game.players[e.owner].age + 1], icon: 'castle' }, percentage = Math.min(100, q.elapsed / q.duration * 100);
  $('queue-content').innerHTML = `<div class="queue-current">${icon(def.icon)}<div><strong>${def.name}</strong><small>${q.kind === 'unit' ? 'TRAINING' : q.kind === 'age' ? 'ADVANCING' : 'RESEARCHING'} · ${Math.ceil(Math.max(0, q.duration - q.elapsed))}s</small></div></div><div class="queue-track"><i style="width:${percentage}%"></i></div><div class="queue-items">${queue.map((q, i) => `<button class="queue-item" data-queue="${i}" title="Cancel ${q.kind === 'age' ? 'advancement' : (UNITS[q.type] || TECHS[q.type]).name} and refund resources" aria-label="Cancel queue item ${i + 1}">${icon(q.kind === 'age' ? 'castle' : (UNITS[q.type] || TECHS[q.type]).icon)}</button>`).join('')}<small>CLICK AN ITEM TO CANCEL & REFUND</small></div>`;
}
$('queue-content').onclick = event => { const b = event.target.closest('[data-queue]'); if (b && selection[0]?.owner === 0) { game.cancelQueue(selection[0], +b.dataset.queue); updateHUD(); } };
function renderObjectives() {
  const p = game.players[0], buildings = game.own(0, 'building').filter(b => b.progress >= 1), army = game.own(0, 'unit').filter(u => u.type !== 'villager');
  const objectives = p.age === 0 ? [
    { text: 'Grow your settlement', sub: `Train 3 Villagers · ${Math.min(3, p.stats.villagersTrained || 0)} / 3`, done: p.stats.villagersTrained >= 3 },
    { text: 'Build a Barracks', sub: 'Your first step toward an army', done: buildings.some(b => b.type === 'barracks') },
    { text: 'Reach the Feudal Age', sub: 'New possibilities await', done: p.age >= 1 },
  ] : [
    { text: 'Raise an army', sub: `Train 10 military units · ${Math.min(10, army.length)} / 10`, done: army.length >= 10 },
    { text: 'Reach the Castle Age', sub: p.age >= 2 ? 'Castles and siege unlocked' : 'Build a Blacksmith to advance', done: p.age >= 2 },
    { text: 'Defeat the Iron Crown', sub: 'Destroy the rival Town Center', done: game.result === 'victory' },
  ];
  $('objective-list').innerHTML = objectives.map(o => `<div class="objective-item ${o.done ? 'complete' : ''}"><span class="objective-check">${icon('check')}</span><div>${o.text}<small>${o.sub}</small></div></div>`).join('');
  $('difficulty-label').textContent = game.difficulty.toUpperCase();
  if (p.age >= 1) { $('objectives').querySelector('h1').innerHTML = 'Your legacy<br>takes shape.'; $('objectives').querySelector('p').innerHTML = 'A stronger kingdom.<br>A greater ambition.'; }
  else { $('objectives').querySelector('h1').innerHTML = 'A kingdom begins<br>with you.'; $('objectives').querySelector('p').innerHTML = 'Build your legacy.<br>Conquer the rival kingdom.'; }
}
function updateHUD() {
  if (selection.some(e => !e.alive || e.garrison)) { selection = selection.filter(e => e.alive && !e.garrison); renderer.selected = selection; actionSignature = ''; }
  const p = game.players[0], pop = game.pop(0);
  for (const r of ['food', 'wood', 'gold', 'stone']) { const n = p.resources[r]; $(`${r}-count`).textContent = window.innerWidth <= 560 && n >= 1000 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k` : fmt(n); $(`${r}-workers`).textContent = game.own(0, 'unit').filter(u => u.type === 'villager' && u.order.resource === r).length; }
  $('pop-count').innerHTML = `${pop.units} <i>/ ${pop.cap}</i>`; $('pop-count').style.color = pop.units + pop.queued >= pop.cap ? '#ddad7c' : '';
  $('age-roman').textContent = AGE_ROMAN[p.age]; $('age-name').textContent = AGES[p.age]; document.querySelectorAll('.age-dots i').forEach((e, i) => e.classList.toggle('active', i <= p.age));
  $('your-age').textContent = AGES[p.age].toUpperCase(); $('enemy-age').textContent = AGES[game.players[1].age].toUpperCase();
  $('game-time').textContent = clock(game.time); $('speed-button').textContent = `${game.speed}×`; $('pause-button').innerHTML = icon(game.paused ? 'play' : 'pause'); $('pause-button').setAttribute('aria-label', game.paused ? 'Resume' : 'Pause');
  $('paused-indicator').classList.toggle('hidden', !game.paused || modalOpen || !!game.result);
  const idle = game.own(0, 'unit').filter(u => u.type === 'villager' && !u.garrison && u.order.type === 'idle').length; $('idle-count').textContent = `${idle} idle`; $('idle-button').style.color = idle ? '#e0c794' : '';
  $('army-count').textContent = `${game.own(0, 'unit').filter(u => u.type !== 'villager' && !u.garrison).length} army`;
  renderSelection(); renderActions(); renderQueue(); renderObjectives();
}
function openModal(html) {
  if (!modalOpen) pausedBeforeModal = game.paused;
  modalOpen = true; game.paused = true; renderer.keys.clear(); renderer.drag = null; $('tooltip').classList.add('hidden');
  $('modal-root').innerHTML = `<div class="modal-backdrop">${html}</div>`; updateHUD(); $('modal-root').querySelector('button')?.focus();
}
function closeModal() { if (game.result) return; modalOpen = false; $('modal-root').innerHTML = ''; game.paused = pausedBeforeModal; updateHUD(); canvas.focus({ preventScroll: true }); }
function showMenu() {
  if (game.result) return showResult();
  const saved = localStorage.getItem('kingdoms-save') || localStorage.getItem('kingdoms-auto');
  openModal(`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="menu-title"><button class="modal-close" data-modal="close" aria-label="Close menu">${icon('close')}</button><div class="modal-crest">${icon('crest')}</div><div class="eyebrow">AGE OF EMPIRES II · KINGDOMS</div><h2 id="menu-title">Your story continues.</h2><p>The frontier will wait.<br>Return when your next move is clear.</p><button class="modal-button" data-modal="close">${icon('play')}RESUME CAMPAIGN</button><button class="modal-button secondary" data-modal="new">${icon('flag')}A NEW KINGDOM</button><div class="modal-rule"></div><div class="modal-row"><button class="modal-button secondary" data-modal="save">${icon('save')}SAVE GAME</button><button class="modal-button secondary" data-modal="load" ${!saved ? 'disabled style="opacity:.4"' : ''}>${icon('hourglass')}LOAD GAME</button></div><button class="modal-button secondary" data-modal="help">${icon('help')}HOW TO PLAY</button><p class="save-message" id="save-message">Your campaign autosaves every 30 seconds.</p></section>`);
}
function showNew() {
  difficultyChoice = game.difficulty;
  openModal(`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="new-title"><button class="modal-close" data-modal="${game.result ? 'result' : 'menu'}" aria-label="Back">${icon('close')}</button><div class="modal-crest">${icon('flag')}</div><div class="eyebrow">A FRESH CHAPTER</div><h2 id="new-title">Found your kingdom.</h2><p>You are the Britons. Beyond the Greenwood,<br>the Iron Crown is building an empire of its own.</p><div class="panel-eyebrow" style="justify-content:center">CHOOSE YOUR CHALLENGE</div><div class="modal-options">${[['peaceful', 'Explorer', 'Gentle raids · time to build'], ['standard', 'Standard', 'A worthy rival'], ['hard', 'Conqueror', 'Relentless enemy armies']].map(([value, name, description]) => `<button class="difficulty-option ${difficultyChoice === value ? 'active' : ''}" data-difficulty="${value}"><strong>${name}</strong><small>${description}</small></button>`).join('')}</div><div class="modal-rule"></div><button class="modal-button" data-modal="start">${icon('arrow')}BEGIN YOUR CAMPAIGN</button><p class="save-message">A new campaign replaces the current autosave.</p></section>`);
}
function showHelp() {
  openModal(`<section class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="modal-close" data-modal="close" aria-label="Close help">${icon('close')}</button><div class="modal-crest">${icon('compass')}</div><div class="eyebrow">THE ART OF BUILDING AN EMPIRE</div><h2 id="help-title">A small village. A grand ambition.</h2><p>Grow your economy, advance through four ages,<br>and destroy the Iron Crown’s Town Center to win.</p><div class="help-grid"><div class="help-section"><h3>${icon('villager')}Your people</h3><p><b>Left click</b> selects a unit or building. <b>Drag</b> to select a group. <b>Shift + click</b> adds or removes units. Double click selects nearby units of the same type.<br><b>Right click</b> tells your selected units to move, gather resources, attack an enemy, or build a foundation.</p></div><div class="help-section"><h3>${icon('food')}Your economy</h3><p>Villagers gather <b>food, wood, gold, and stone</b> and carry them to nearby drop-off buildings. Train more at your <b>Town Center</b>. New Villagers start working automatically. Houses increase your population limit. Farms reseed for 30 wood.</p></div><div class="help-section"><h3>${icon('castle')}Your civilization</h3><p>Select a Villager and open <b>Build</b> to place a building. Select your Town Center to <b>advance ages</b>. The Castle Age requires a Blacksmith and a military building; the Imperial Age requires a Castle or Siege Workshop. Research improves your army and economy.</p></div><div class="help-section"><h3>${icon('sword')}Your conquest</h3><p>Explore toward the <b>upper-right of the minimap</b> to find the rival. Train troops at Barracks, Archery Ranges, and Stables. <b>Spearmen counter cavalry</b>; rams destroy buildings. Use <b>Attack Move</b> to fight along the way. Right click your Town Center to shelter and heal units.</p></div></div><div class="modal-rule"></div><div class="help-grid" style="margin:16px 0"><div><div class="hotkey-list"><span>Town Center</span><kbd>H</kbd></div><div class="hotkey-list"><span>Build menu / Train first unit</span><span><kbd>B</kbd> / <kbd>Q</kbd></span></div><div class="hotkey-list"><span>All army / Idle Villagers</span><span><kbd>M</kbd> / <kbd>.</kbd></span></div><div class="hotkey-list"><span>Attack Move / Stop</span><span><kbd>F</kbd> / <kbd>X</kbd></span></div></div><div><div class="hotkey-list"><span>Move camera</span><span><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd></span></div><div class="hotkey-list"><span>Pan / Zoom</span><span><kbd>Middle drag</kbd> / <kbd>Scroll</kbd></span></div><div class="hotkey-list"><span>Pause / Cancel</span><span><kbd>Space</kbd> / <kbd>Esc</kbd></span></div><div class="hotkey-list"><span>Assign / Select group</span><span><kbd>Ctrl + 1–9</kbd> / <kbd>1–9</kbd></span></div></div></div><button class="modal-button" data-modal="close">${icon('arrow')}RETURN TO YOUR KINGDOM</button></section>`);
}
function showResult() {
  const victory = game.result === 'victory', stats = game.players[0].stats;
  openModal(`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="modal-crest">${icon(victory ? 'castle' : 'crest')}</div><div class="eyebrow">${victory ? 'THE IRON CROWN HAS FALLEN' : 'YOUR TOWN CENTER HAS FALLEN'}</div><h2 id="result-title">${victory ? 'An empire is born.' : 'Every legacy has a lesson.'}</h2><p>${victory ? 'From a humble settlement to a victorious kingdom.<br>The Greenwood frontier is yours.' : 'Your people fought bravely.<br>A new kingdom, and a new chance, await.'}</p><div class="result-stats"><div><strong>${clock(game.time)}</strong><small>CAMPAIGN TIME</small></div><div><strong>${stats.kills}</strong><small>ENEMIES DEFEATED</small></div><div><strong>${fmt(stats.gathered)}</strong><small>RESOURCES GATHERED</small></div><div><strong>${stats.trained}</strong><small>UNITS TRAINED</small></div><div><strong>${stats.built}</strong><small>BUILDINGS RAISED</small></div><div><strong>${AGE_ROMAN[game.players[0].age]}</strong><small>AGE REACHED</small></div></div><button class="modal-button" data-modal="new">${icon('flag')}FOUND ANOTHER KINGDOM</button></section>`);
}
function resetGame(newGame) {
  game = newGame; renderer.game = game; renderer.fogTick = -1; wireGame(); groups.clear(); cancelMode(); buildMenu = false;
  modalOpen = false; pausedBeforeModal = false; $('modal-root').innerHTML = ''; actionSignature = ''; portraitSignature = ''; $('announcements').innerHTML = '';
  lastSave = game.time; lastExplore = game.time; accumulator = 0;
  home(); renderer.zoom = 1.18; $('zoom-level').textContent = '100%'; updateHUD(); if (game.result) showResult();
}
$('modal-root').addEventListener('click', event => {
  const difficulty = event.target.closest('[data-difficulty]');
  if (difficulty) { difficultyChoice = difficulty.dataset.difficulty; document.querySelectorAll('[data-difficulty]').forEach(e => e.classList.toggle('active', e.dataset.difficulty === difficultyChoice)); return; }
  const b = event.target.closest('[data-modal]'); if (!b) return;
  const action = b.dataset.modal;
  if (action === 'close') closeModal();
  else if (action === 'menu') showMenu();
  else if (action === 'new') showNew();
  else if (action === 'help') showHelp();
  else if (action === 'result') showResult();
  else if (action === 'start') { localStorage.removeItem('kingdoms-auto'); resetGame(new Game(difficultyChoice)); notify('Your new kingdom awaits. Build wisely and explore the frontier.', 'success'); }
  else if (action === 'save') { try { localStorage.setItem('kingdoms-save', game.serialize()); $('save-message').textContent = `Campaign saved at ${clock(game.time)}. Your kingdom is safe.`; const load = $('modal-root').querySelector('[data-modal="load"]'); if (load) { load.disabled = false; load.style.opacity = ''; } } catch { $('save-message').textContent = 'Your browser could not store this save.'; } }
  else if (action === 'load') { try { const save = localStorage.getItem('kingdoms-save') || localStorage.getItem('kingdoms-auto'); if (save) { resetGame(Game.restore(save)); notify('Your saved campaign has been restored.', 'success'); } } catch { if ($('save-message')) $('save-message').textContent = 'This save could not be restored. Start a new kingdom.'; } }
});
$('menu-button').onclick = showMenu; $('help-button').onclick = showHelp;
// Keep keyboard focus within the active dialog.
document.addEventListener('keydown', event => {
  if (!modalOpen || event.key !== 'Tab') return;
  const buttons = [...$('modal-root').querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
let last = performance.now(), accumulator = 0, lastHUD = 0, lastSave = 0, lastExplore = 0;
function tick(now) {
  const dt = Math.min(.12, (now - last) / 1000); last = now;
  if (!modalOpen) renderer.cameraUpdate(dt);
  accumulator += dt * game.speed;
  while (accumulator >= .05) { game.update(.05); accumulator -= .05; }
  if (!game.paused && game.time - lastExplore >= 1) {
    lastExplore = game.time;
    for (const u of game.own(0, 'unit').filter(u => u.autoExplore && u.order.type === 'idle')) {
      const options = []; for (let y = 3; y < SIZE - 3; y += 4) for (let x = 3; x < SIZE - 3; x += 4) if (!game.explored[y * SIZE + x] && distance(u, { x, y }) > 5) options.push({ x, y });
      options.sort((a, b) => distance(u, a) - distance(u, b)); if (options.length) game.order(u, { type: 'move', ...options[0] }); else { u.autoExplore = false; notify('Your Scout has charted the entire frontier.', 'success'); }
    }
  }
  renderer.draw(game.time);
  if (now - lastHUD > 240) { lastHUD = now; updateHUD(); }
  if (game.time - lastSave > 30 && !game.result) { lastSave = game.time; try { localStorage.setItem('kingdoms-auto', game.serialize()); } catch {} }
  sound.music(game.time);
  requestAnimationFrame(tick);
}
setSelection([ownTC()]);
requestAnimationFrame(tick);
// A small public interface makes the deterministic simulation inspectable.
window.kingdom = { get game() { return game; }, renderer, get selection() { return selection; }, select: setSelection, reset: resetGame, home, updateHUD };
