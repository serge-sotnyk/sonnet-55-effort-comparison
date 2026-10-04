'use strict';
// ---------------------------------------------------------------------------
// Boot, menus, game loop
// ---------------------------------------------------------------------------
let gameState = 'menu';
const setup = { civ: 'britons', diff: 'moderate', size: 80, res: 'std', style: 'mixed', startAge: 0, reveal: false };
const START_RES = { low: { food: 100, wood: 100, gold: 0, stone: 0 }, std: { food: 250, wood: 250, gold: 100, stone: 100 }, high: { food: 800, wood: 800, gold: 400, stone: 300 } };
let lastFrame = 0, bootDone = false;

function showOverlay(id, show) {
  $(id).classList.toggle('hidden', !show);
  if (id === 'menu') { document.body.classList.toggle('menu', show); if (R.cv) resizeRender(); }
}
function setLoad(f, text) { $('loadfill').style.width = Math.round(f * 100) + '%'; if (text) $('loadtext').textContent = text; }
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function togglePause(force) {
  if (gameState !== 'playing') return;
  G.paused = force !== undefined ? force : !G.paused;
  showOverlay('pause', G.paused);
  UI.syncSpeed();
}

// ---- menu --------------------------------------------------------------------------------------------------------------------
function buildMenu() {
  const list = $('civ-list');
  list.innerHTML = '';
  for (const id of Object.keys(CIVS)) {
    const c = CIVS[id];
    const el = document.createElement('div');
    el.className = 'civ' + (id === setup.civ ? ' on' : '');
    el.dataset.id = id;
    el.innerHTML = `<img width="64" height="64" style="border-radius:50%;border:2px solid var(--gold-d)" src="${unitIcon(c.uu, 0)}"><div class="cn">${c.name}</div><div class="cb">${c.blurb}</div>`;
    el.onclick = () => { setup.civ = id; document.querySelectorAll('.civ').forEach((x) => x.classList.toggle('on', x.dataset.id === id)); showCivDetail(); SFX.init(); SFX.play('click'); };
    list.appendChild(el);
  }
  showCivDetail();
  const seg = (id, key, conv) => {
    document.querySelectorAll(`#${id} button`).forEach((b) => {
      b.onclick = () => { setup[key] = conv ? conv(b.dataset.v) : b.dataset.v; document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b)); SFX.init(); SFX.play('click'); };
    });
  };
  seg('seg-diff', 'diff'); seg('seg-size', 'size', (v) => +v); seg('seg-res', 'res');
  seg('seg-style', 'style'); seg('seg-age', 'startAge', (v) => +v); seg('seg-vis', 'reveal', (v) => v === '1');
  document.querySelectorAll('#seg-speed button').forEach((b) => { b.onclick = () => { G.speed = +b.dataset.v; UI.syncSpeed(); }; });
  $('btn-start').onclick = () => { SFX.init(); startGame({ civ: setup.civ, difficulty: setup.diff, size: setup.size, start: START_RES[setup.res], style: setup.style, startAge: setup.startAge, reveal: setup.reveal }); };
  $('btn-watch').onclick = () => { SFX.init(); const cs = Object.keys(CIVS); startGame({ observer: true, civ: cs[Math.floor(Math.random() * cs.length)], difficulty: setup.diff, difficulty2: setup.diff, size: setup.size, start: START_RES[setup.res], style: setup.style, startAge: setup.startAge }); };
  $('btn-howto').onclick = () => showOverlay('help', true);
  $('h-close').onclick = () => showOverlay('help', false);
  $('p-help').onclick = () => showOverlay('help', true);
  $('p-resume').onclick = () => togglePause(false);
  $('p-restart').onclick = () => { showOverlay('pause', false); G.paused = false; startGame(G.opts); };
  $('p-resign').onclick = () => { showOverlay('pause', false); G.paused = false; if (!G.over) { G.over = true; G.winner = 1; G.overTime = G.time; } };
  $('p-quit').onclick = () => { showOverlay('pause', false); G.paused = false; gameState = 'menu'; showOverlay('menu', true); startDemo(); };
  $('e-again').onclick = () => { showOverlay('end', false); startGame(G.opts); };
  $('e-menu').onclick = () => { showOverlay('end', false); gameState = 'menu'; showOverlay('menu', true); startDemo(); };
  $('e-view').onclick = () => { showOverlay('end', false); G.observerLocked = false; };
  $('opt-sfx').onchange = (e) => SFX.setEnabled(e.target.checked);
  $('opt-music').onchange = (e) => SFX.setMusic(e.target.checked);
}
function showCivDetail() {
  const c = CIVS[setup.civ], u = UNITS[c.uu];
  $('civ-detail').innerHTML = `<ul>${c.bonuses.map((b) => `<li>${b}</li>`).join('')}</ul>`;
}

// ---- title screen backdrop: a live AI-vs-AI battle -----------------------------------------------------------
let demoBuilding = false, demoClock = 0;
async function startDemo() {
  if (demoBuilding) return;
  demoBuilding = true;
  try {
    const seed = Math.floor(Math.random() * 1e9);
    const map = generateMap(64, seed, 0);
    const tex = await buildTerrainTexture(map);
    if (gameState !== 'menu') return; // the player already started a real game
    R.terrain = tex;
    R.miniBase = buildMinimapBase(map);
    initWorldSprites(); BuildingSprites.cache.clear();
    setupGame({ observer: true, civ: pick(Object.keys(CIVS)), difficulty: 'hard', difficulty2: 'hard', size: 64, start: { food: 600, wood: 600, gold: 300, stone: 200 } }, map);
    G.demo = true; R.cam.zoom = 0.85; demoClock = 0;
    R.fogDirty = true;
    for (let t = 0; t < 120; t += 0.1) tick(0.1);
  } finally { demoBuilding = false; }
}
function demoFrame(dtReal) {
  if (!G.demo || !G.map || !R.terrain) return;
  demoClock += dtReal;
  let sim = dtReal * 3, guard = 0;
  while (sim > 1e-6 && guard++ < 6) { const s = Math.min(sim, 0.05); tick(s); sim -= s; }
  const N = G.map.w;
  // drift between the two bases
  const b0 = G.map.bases[0], b1 = G.map.bases[1];
  const t = (Math.sin(demoClock * 0.05) + 1) / 2;
  centerCamOn(lerp(b0[0], b1[0], t) + Math.sin(demoClock * 0.13) * 3, lerp(b0[1], b1[1], t) + Math.cos(demoClock * 0.11) * 3);
  renderFrame(dtReal);
}

// ---- starting a game ---------------------------------------------------------------------------------------------------------------
async function startGame(o) {
  gameState = 'loading'; endShown = false;
  o = Object.assign({ size: 80, difficulty: 'moderate', civ: 'britons' }, o);
  showOverlay('menu', false); showOverlay('end', false); showOverlay('pause', false); showOverlay('loading', true);
  setLoad(0.02, 'Generating terrain');
  await nextFrame(); await nextFrame();
  const seed = o.seed || Math.floor(Math.random() * 1e9);
  o.seed = seed;
  const map = generateMap(o.size, seed, Math.random() < 0.5 ? 0 : 1, o.style);
  setLoad(0.1, 'Painting the land');
  await nextFrame();
  R.terrain = await buildTerrainTexture(map, (f) => setLoad(0.1 + f * 0.8, 'Painting the land'));
  setLoad(0.92, 'Raising settlements');
  await nextFrame();
  R.miniBase = buildMinimapBase(map);
  initWorldSprites();
  BuildingSprites.cache.clear();
  setupGame(o, map);
  UI.reset();
  if (!G.speedSet) { G.speedSet = true; }
  UI.syncSpeed();
  R.fogDirty = true;
  const home = map.bases[0];
  R.cam.zoom = 1;
  if (o.observer) centerCamOn(map.w / 2, map.h / 2); else centerCamOn(home[0], home[1]);
  resizeRender();
  if (!o.observer) startingOrders();
  setLoad(1, 'Ready');
  await nextFrame();
  showOverlay('loading', false);
  gameState = 'playing';
  G.observerLocked = false;
  if (!o.observer) {
    const tc = G.buildings.find((b) => b.owner === 0 && b.type === 'towncenter');
    UI.setSel([tc]);
    notify(0, 'Train villagers at your Town Center (Q) and gather resources.', null, null, 'info');
    notify(0, 'Build Houses before you hit your population cap.', null, null, 'info');
  }
}

function startingOrders() {
  // give the starting villagers sensible work: berries and wood
  const p = G.players[0];
  const tc = G.buildings.find((b) => b.owner === 0 && b.type === 'towncenter');
  const vills = G.units.filter((u) => u.owner === 0 && u.def.tags.includes('villager'));
  const berries = findNearestRes(vills[0], 'berries', tc.x, tc.y, 20);
  const tree = findNearestRes(vills[0], 'tree', tc.x, tc.y, 25);
  vills.forEach((v, i) => { if (i < 2 && berries) orderGather(v, berries); else if (tree) orderGather(v, tree); });
  if (tree) cmdRally(tc, tree.x, tree.y, tree);
  // explore with the scout
  const sc = G.units.find((u) => u.owner === 0 && u.type === 'scout');
  if (sc) { const f = G.map.findFreeNear(G.map.w / 2, G.map.h / 2, 10, 0); if (f) orderMove(sc, f[0], f[1]); }
}

// ---- end of game ------------------------------------------------------------------------------------------------------------------------------
let endShown = false;
function checkEndScreen() {
  if (!G.over || endShown || G.time - G.overTime < 2.2) return;
  endShown = true;
  const win = G.observer ? true : G.winner === G.me;
  const t = $('end-title');
  if (G.observer) { t.textContent = (G.winner >= 0 ? G.players[G.winner].name + ' WINS' : 'DRAW'); t.className = 'win'; $('end-sub').textContent = 'The battle is decided.'; }
  else {
    t.textContent = win ? 'VICTORY' : 'DEFEAT'; t.className = win ? 'win' : 'lose';
    $('end-sub').textContent = win ? 'Your rival lies in ruins. Long live the crown!' : 'Your kingdom has fallen. Rise again, ruler.';
    SFX.play(win ? 'win' : 'lose');
  }
  const a = G.players[0], b = G.players[1];
  const rows = [
    ['', a.name + ' (' + a.civDef.name + ')', b.name + ' (' + b.civDef.name + ')'],
    ['Final age', AGES[a.age], AGES[b.age]],
    ['Units killed', a.stat.kills, b.stat.kills],
    ['Units lost', a.stat.losses, b.stat.losses],
    ['Units trained', a.stat.unitsMade, b.stat.unitsMade],
    ['Buildings built', a.stat.bldBuilt, b.stat.bldBuilt],
    ['Buildings lost', a.stat.bldLost, b.stat.bldLost],
    ['Technologies', a.stat.techCount, b.stat.techCount],
    ['Resources gathered', Object.values(a.stat.gathered).reduce((x, y) => x + y, 0), Object.values(b.stat.gathered).reduce((x, y) => x + y, 0)],
    ['Game length', fmtTime(G.overTime), fmtTime(G.overTime)],
  ];
  $('end-stats').innerHTML = rows.map((r, i) => i === 0 ? `<div class="h"></div><div class="h">${r[1]}</div><div class="h">${r[2]}</div>` : `<div class="l">${r[0]}</div><div>${r[1]}</div><div>${r[2]}</div>`).join('');
  showOverlay('end', true);
  G.observerLocked = true;
}

// ---- loop --------------------------------------------------------------------------------------------------------------------------------------------
let errCount = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;
  try {
    if (gameState === 'playing') {
      if (!G.paused) {
        let sim = dtReal * G.speed;
        let guard = 0;
        while (sim > 1e-6 && guard++ < 12) { const s = Math.min(sim, 0.05); tick(s); sim -= s; }
      }
      UI.update(dtReal);
      renderFrame(dtReal);
      renderMinimap();
      checkEndScreen();
    } else if (gameState === 'menu') { demoFrame(dtReal); }
  } catch (err) {
    if (errCount++ < 5) console.error('frame error', err);
    // a simulation error must never freeze the game: purge dead entities and carry on
    try { cleanup(); } catch (e2) { /* ignore */ }
  }
}

function boot() {
  initRender($('view'), $('minimap'));
  UI.init();
  buildMenu();
  UI.syncSpeed();
  requestAnimationFrame(frame);
  bootDone = true;
  startDemo();
}
window.addEventListener('DOMContentLoaded', boot);
document.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && !e.target.closest('.overlay')) e.target.blur(); });

// test / debug helpers
window.__dbg = {
  G, R, UI, start: (o) => startGame(o), advance(sec, step = 0.05) { let t = 0; while (t < sec) { tick(step); t += step; } R.fogDirty = true; },
};
