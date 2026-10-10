// Application entry: boot, menus, loading, the fixed-timestep game loop and end-of-game flow.
import * as art from './art/index.js';
import { audio } from './audio/audio.js';
import { Game, DIFFICULTY } from './sim/game.js';
import { MAP_SIZES } from './sim/map.js';
import { TICK, PLAYER_COLORS, AGE_NAMES } from './data/constants.js';
import { CIVS, CIV_ORDER } from './data/civs.js';
import { Camera } from './render/iso.js';
import { TerrainRenderer } from './render/terrain.js';
import { Renderer } from './render/renderer.js';
import { FX } from './render/fx.js';
import { Minimap } from './render/minimap.js';
import { Input } from './ui/input.js';
import { HUD } from './ui/hud.js';
import { Feedback } from './ui/feedback.js';
import { Menus } from './ui/menu.js';

const $ = (id) => document.getElementById(id);
const SPEEDS = [1, 1.3, 1.7, 2.2, 3, 4.5];
const LEADERS = {
  britons: ['King Alfred', 'Queen Eleanor', 'Lord Hawkwood'], franks: ['Charlemagne', 'Duke Roland', 'Queen Clotilde'],
  goths: ['Alaric', 'Theodoric', 'Queen Amalasuntha'], mongols: ['Subutai', 'Khan Jebe', 'Khan Temur'],
};
const TIPS = [
  'Keep your Town Center producing villagers non-stop — a strong economy wins wars.',
  'Build houses before you hit the population cap.',
  'Spearmen and pikemen shred cavalry. Archers shred infantry. Cavalry shreds archers.',
  'Garrisoned villagers in the Town Center are safe — and soldiers add extra arrows.',
  'A Mill beside the berries and a Lumber Camp beside the forest save enormous walking time.',
  'Use the Market to sell surplus wood or food for the gold you need in the Imperial Age.',
  'Monks can convert enemy units to your side. Keep your cavalry away from them!',
  'Right-click with a building selected to set its rally point; click a tree to send villagers to chop.',
  'Walls and gates can funnel attackers into your arrows. Rams break them quickly, though.',
  'Press H to jump to your Town Center, and period / comma to find idle villagers and soldiers.',
];

const DEFAULT_SETTINGS = { master: 0.85, sfx: 0.9, music: 0.5, muted: false, scrollSpeed: 1, uiScale: 0, edgeScroll: true, showBars: false, hints: true };

const S = window.AOC = {
  game: null, cam: new Camera(), renderer: null, fx: null, minimap: null, input: null, hud: null, feedback: null, audio,
  terrain: null, root: $('game'), settings: Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem('aoc.settings') || '{}')),
  speedIdx: 2, speed: SPEEDS[2], paused: false, inGame: false, acc: 0, dtReal: 0.016, menus: null, dpr: 1,
  menuOpen: false,
};

// ================================================================ settings / audio
S.saveSettings = () => localStorage.setItem('aoc.settings', JSON.stringify(S.settings));
S.applyAudio = () => {
  const s = S.settings;
  audio.setMasterVolume(s.master); audio.setSfxVolume(s.sfx); audio.setMusicVolume(s.music); audio.setAmbientVolume(s.sfx * 0.6); audio.setMuted(!!s.muted);
  S.saveSettings();
};
S.applySettings = () => {
  const s = S.settings;
  if (!s.uiScale) s.uiScale = Math.max(0.85, Math.min(1.35, Math.min(window.innerWidth / 1500, window.innerHeight / 850)));
  document.documentElement.style.setProperty('--ui', s.uiScale);
  if (S.input) { S.input.edgeScroll = !!s.edgeScroll; S.input.scrollSpeed = s.scrollSpeed; }
  if (S.hud) S.hud.updateInset();
  const hp = $('btn-hpbars'); if (hp) hp.classList.toggle('on', !!s.showBars);
  S.saveSettings();
};
S.audioClick = () => { audio.init(); audio.play('ui_click'); };

// ================================================================ boot
const dpr0 = Math.min(2, window.devicePixelRatio || 1);
art.setSpriteScale(dpr0 >= 1.5 ? 2 : 1);
S.dpr = dpr0;
S.applySettings();
S.menus = new Menus(S);
S.menus.show('main');
let menuT = 0;

const menuCanvas = $('menu-bg');
function sizeMenuCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  menuCanvas.width = Math.round(window.innerWidth * dpr); menuCanvas.height = Math.round(window.innerHeight * dpr);
}
sizeMenuCanvas();

document.addEventListener('mouseup', () => { const a = document.activeElement; if (a && a.tagName === 'BUTTON' && !a.closest('.screen')) a.blur(); });
window.addEventListener('resize', () => {
  sizeMenuCanvas();
  if (S.inGame) resizeGame();
});
function resizeGame() {
  const dpr = Math.min(S.renderDpr || 2, Math.min(2, window.devicePixelRatio || 1));
  S.dpr = dpr;
  S.renderer.resize(window.innerWidth, window.innerHeight, dpr);
  S.hud.updateInset();
  S.minimap.resolve();
}

// ================================================================ game control
S.togglePause = () => {
  if (!S.inGame) return;
  S.paused = !S.paused;
  $('pause-veil').classList.toggle('hidden', !S.paused || S.menuOpen);
  if (S.paused) audio.duck && audio.duck(0.3, 0.5);
};
S.toggleMenu = () => {
  if (!S.inGame) return;
  if (S.menuOpen) { closeMenu(); return; }
  S.menuOpen = true; S.paused = true;
  S.menus.show('pause'); $('screen-pause').classList.remove('hidden');
  $('pause-veil').classList.add('hidden');
};
function closeMenu() {
  S.menuOpen = false; S.paused = false;
  S.menus.hideAll();
  $('pause-veil').classList.add('hidden');
}
S.onEscape = () => {
  const inp = S.input;
  if (S.menuOpen) { closeMenu(); return; }
  if (inp.mode.type !== 'normal') { inp.cancelMode(); return; }
  if (S.hud.cardPage !== 'main') { S.hud.setPage('main'); return; }
  S.toggleMenu();
};
S.changeSpeed = (d) => {
  S.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, S.speedIdx + d));
  S.speed = SPEEDS[S.speedIdx];
  S.hud.toast(`Game speed ${S.speed}x`);
};

$('pm-resume').onclick = () => closeMenu();
$('pm-options').onclick = () => { S.menus.prevScreen = 'pause'; S.menus.show('options'); $('screen-options').classList.add('overlay'); };
$('pm-how').onclick = () => { S.menus.prevScreen = 'pause'; S.menus.show('how'); $('screen-how').classList.add('overlay'); };
$('pm-resign').onclick = () => { closeMenu(); S.game.resign(S.game.humanIndex); };
$('pm-quit').onclick = () => { quitToMenu(); };
$('end-menu').onclick = () => quitToMenu();
$('end-again').onclick = () => { const cfg = JSON.parse(localStorage.getItem('aoc.config') || '{}'); quitToMenu(); S.menus.show('setup'); };
$('end-keep').onclick = () => { S.menus.hideAll(); S.paused = false; S.menuOpen = false; S.game.keepSimulating = true; };

function quitToMenu() {
  S.inGame = false; S.paused = false; S.menuOpen = false;
  if (S.input) { S.input.detach(); S.input.cancelMode(); }
  audio.music && audio.music.stop(); audio.ambient && audio.ambient.stop();
  $('game').classList.add('hidden');
  S.game = null;
  S.menus.show('main');
}

// ================================================================ starting a game
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
function setLoad(f, text) { $('loadfill').style.width = Math.round(f * 100) + '%'; if (text) $('loadtext').textContent = text; }

S.startGame = async function (cfg) {
  audio.init(); audio.play('ui_click');
  S.menus.hideAll(); $('screen-loading').classList.remove('hidden');
  $('loadtip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  setLoad(0.02, 'Surveying the land…'); await nextFrame();

  const rng = (n) => Math.floor(Math.random() * n);
  const others = CIV_ORDER.filter(c => c !== cfg.civ);
  const players = [{ civ: cfg.civ, isAI: false, name: 'You', color: 1 }];
  for (let i = 0; i < cfg.opponents; i++) {
    const civ = i === 0 && Math.random() < 0.25 ? cfg.civ : others[(rng(3) + i) % others.length];
    players.push({ civ, isAI: true, name: LEADERS[civ][rng(3)], color: 2 + i, difficulty: cfg.difficulty });
  }
  const seed = Math.floor(Math.random() * 1e9);
  const game = new Game({ mapType: cfg.map, mapSize: MAP_SIZES[cfg.size], seed, players, startRes: cfg.res, revealMap: cfg.reveal, wonderVictory: cfg.wonder, humanIndex: 1 });
  S.game = game;
  setLoad(0.12, 'Painting the land…'); await nextFrame();

  // renderer stack
  const cam = S.cam = new Camera(); cam.setMap(game.w, game.h);
  const canvas = $('world');
  const terrain = S.terrain = new TerrainRenderer(game.map);
  S.fx = new FX();
  S.feedback = new Feedback(S);
  S.renderer = new Renderer(canvas, game, cam, terrain, S.fx, S.feedback);
  S.root.classList.remove('hidden');
  S.minimap = new Minimap($('minimap'), game, terrain);
  if (S.input) S.input.detach();
  S.input = new Input(S);
  S.input.attach(canvas, $('selbox'), $('minimap'));
  S.hud = new HUD(S);
  S.applySettings();
  const start = game.players[1].startPos;
  resizeGame();
  cam.lookAt(start.x, start.y);

  // generate the ground near the start first, with a progress bar
  const total = terrain.cw * terrain.ch;
  const t0 = performance.now();
  while (terrain.pending > total * 0.45 && performance.now() - t0 < 20000) {
    terrain.ensure(cam, 24);
    setLoad(0.12 + 0.55 * (1 - terrain.pending / total), 'Painting the land…');
    await nextFrame();
  }
  setLoad(0.7, 'Gathering the armies…'); await nextFrame();
  // pre-generate the first sprites so the first frames are smooth
  try {
    const colors = game.players.filter(p => p.index > 0).map(p => p.color);
    await Promise.race([art.warmUnitSprites(['villager', 'scout', 'militia', 'deer', 'sheep'], colors, (f) => setLoad(0.7 + f * 0.15)), new Promise(r => setTimeout(r, 4000))]);
    await Promise.race([art.warmBuildingSprites(colors, (f) => setLoad(0.85 + f * 0.1)), new Promise(r => setTimeout(r, 4000))]);
  } catch (e) { console.warn('warmup', e); }
  setLoad(0.97, 'Sounding the horns…'); await nextFrame();
  S.speedIdx = 2; S.speed = SPEEDS[2]; S.acc = 0; S.paused = false; S.menuOpen = false;
  S.hud.msgIdx = 0; S.hud.dirty = true;
  game.messages.length = 0;
  S.input.setSelection([game.units.find(u => u.owner === 1 && u.type === 'villager').id], true);
  audio.ambient && audio.ambient.start(); audio.music && audio.music.start();
  S.applyAudio();
  $('screen-loading').classList.add('hidden');
  S.inGame = true; S.last = performance.now();
  S.forceFog = true; S.renderer.forceFogRefresh();
  S.hud.banner('Age of Crowns', `${CIVS[cfg.civ].name} — Dark Age`);
  // (sprites beyond the initial set are generated lazily on first use: ~0.2 ms each, no hitches, far less memory)
};

// ================================================================ end of game
S.onGameOver = (e) => {
  S.paused = true;
  setTimeout(() => showEnd(e), 1400);
  audio.play(e.won ? 'victory' : 'defeat');
};
function score(p) {
  const st = p.stats, g = S.game;
  const gathered = st.gathered.food + st.gathered.wood + st.gathered.gold + st.gathered.stone;
  const military = Math.round(st.kills * 10 + st.razings * 25 + (st.converted || 0) * 10);
  const economy = Math.round(gathered / 10 + (st.tradedIn + st.tradedOut) / 20);
  const society = Math.round(p.pop * 3 + g.buildings.filter(b => b.owner === p.index && !b.dead && !b.def.wall).length * 5);
  const technology = Math.round(st.techsResearched * 20 + p.age * 100);
  return { military, economy, society, technology, total: military + economy + society + technology, gathered: Math.round(gathered) };
}
function showEnd(e) {
  if (!S.game) return;
  const g = S.game;
  const title = $('end-title');
  title.textContent = e.won ? 'Victory!' : 'Defeat'; title.className = e.won ? '' : 'lose';
  const mins = Math.floor(g.time / 60), secs = Math.floor(g.time % 60);
  $('end-sub').textContent = (e.won ? (e.how === 'wonder' ? 'Your Wonder stood the test of time.' : 'Your enemies lie vanquished.') : 'Your kingdom has fallen.') + `  —  Game time ${mins}:${String(secs).padStart(2, '0')}`;
  const ps = g.players.filter(p => p.index > 0);
  const sc = ps.map(p => ({ p, s: score(p) }));
  const row = (label, f) => `<tr><td>${label}</td>${sc.map(x => `<td>${f(x)}</td>`).join('')}</tr>`;
  $('end-stats').innerHTML = `<table><tr><th>Score</th>${sc.map(x => `<th style="color:${PLAYER_COLORS[x.p.color].light}">${x.p.name}${x.p.alive ? '' : ' ✝'}</th>`).join('')}</tr>
    ${row('Military', x => x.s.military)}${row('Economy', x => x.s.economy)}${row('Society', x => x.s.society)}${row('Technology', x => x.s.technology)}
    <tr class="total"><td>Total</td>${sc.map(x => `<td>${x.s.total}</td>`).join('')}</tr>
    ${row('Age reached', x => AGE_NAMES[x.p.age])}${row('Resources gathered', x => x.s.gathered)}${row('Units killed', x => x.p.stats.kills)}${row('Units lost', x => x.p.stats.losses)}
    ${row('Buildings destroyed', x => x.p.stats.razings)}${row('Buildings lost', x => x.p.stats.buildingsLost)}${row('Units trained', x => x.p.stats.unitsTrained)}${row('Technologies', x => x.p.stats.techsResearched)}</table>`;
  S.menus.show('end'); $('screen-end').classList.remove('hidden');
  drawChart($('chart-eco'), ps, h => h.eco);
  drawChart($('chart-mil'), ps, h => h.mil);
}
/** tiny line chart of per-player history samples */
function drawChart(cv, players, pick) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 320, H = cv.clientHeight || 120;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  let tMax = 1, vMax = 1;
  for (const p of players) for (const h of p.stats.history) { tMax = Math.max(tMax, h.t); vMax = Math.max(vMax, pick(h)); }
  const padL = 34, padB = 16, padT = 6, padR = 6;
  c.strokeStyle = 'rgba(226,187,98,0.18)'; c.fillStyle = 'rgba(226,187,98,0.65)'; c.font = '10px Georgia, serif'; c.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padT + (H - padT - padB) * (1 - i / 3);
    c.beginPath(); c.moveTo(padL, y); c.lineTo(W - padR, y); c.stroke();
    const v = vMax * i / 3; c.textAlign = 'right'; c.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v), padL - 4, y + 3);
  }
  c.textAlign = 'center';
  for (let i = 0; i <= 4; i++) { const x = padL + (W - padL - padR) * i / 4; c.fillText(Math.round(tMax * i / 4 / 60) + 'm', x, H - 3); }
  for (const p of players) {
    const hist = p.stats.history; if (hist.length < 2) continue;
    c.strokeStyle = PLAYER_COLORS[p.color].light; c.lineWidth = 2; c.beginPath();
    hist.forEach((h, i) => { const x = padL + (W - padL - padR) * h.t / tMax, y = padT + (H - padT - padB) * (1 - pick(h) / vMax); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
  }
}

// ================================================================ main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  S.dtReal = dt;
  if (!S.inGame) {
    menuT += dt;
    if ($('screen-loading').classList.contains('hidden') || true) {
      const ctx = menuCanvas.getContext('2d');
      ctx.setTransform(menuCanvas.width / window.innerWidth, 0, 0, menuCanvas.height / window.innerHeight, 0, 0);
      art.drawMenuBackdrop(ctx, window.innerWidth, window.innerHeight, menuT);
    }
    return;
  }
  const g = S.game;
  // adaptive resolution: if the GPU cannot keep up, quietly lower the render scale (never below 1x)
  if (!S.paused && !S.menuOpen) {
    S.fpsT = (S.fpsT || 0) + dt; S.fpsN = (S.fpsN || 0) + 1;
    if (S.fpsT > 3) {
      const avg = S.fpsT / S.fpsN; S.fpsT = 0; S.fpsN = 0;
      if (avg > 0.026 && S.dpr > 1.01) { S.renderDpr = Math.max(1, S.dpr - 0.5); resizeGame(); console.info('render scale lowered to', S.renderDpr); }
    }
  }
  try {
    const tSim = performance.now();
    // simulation
    if (!S.paused) {
      S.acc += dt * S.speed;
      let steps = 0;
      while (S.acc >= TICK && steps < 14) { g.update(); S.acc -= TICK; steps++; }
      if (steps >= 14) S.acc = 0;
    }
    const P = S.prof || (S.prof = { sim: 0, fb: 0, input: 0, hud: 0, fx: 0, ter: 0, render: 0, mini: 0, n: 0 });
    let t1 = performance.now();
    const lap = (k) => { const t2 = performance.now(); P[k] += t2 - t1; t1 = t2; };
    P.sim += performance.now() - tSim; t1 = performance.now();
    S.feedback.process(g.events);
    S.feedback.updateMood(dt); lap('fb');
    S.input.update(dt); lap('input');
    S.hud.update(dt); lap('hud');
    if (!S.paused) S.fx.update(dt);
    lap('fx');
    S.terrain.ensure(S.cam, 5); lap('ter');
    S.renderer.render(S.paused ? 1 : S.acc / TICK, S.input.view(), dt); lap('render');
    S.minimap.draw(S.cam, S.renderer.fog, dt, S.input.sel.length ? new Set(S.input.sel) : null); lap('mini');
    P.n++;
  } catch (err) {
    // never let a single bad frame freeze the whole game
    S.errors = (S.errors || 0) + 1;
    console.error('frame error', err);
    if (S.errors === 1 || S.errors === 50) { try { S.hud.toast('A game error occurred (see the console). The game keeps running.', 'alert'); } catch (e) { /* ignore */ } }
    if (g.events) g.events.length = 0;
  }
}
requestAnimationFrame(frame);
