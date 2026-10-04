'use strict';
// ---- game flow ----
let mode = 'menu', diffKey = 'normal', built = false;
function startGame(d, seed) {
  initAudio();
  diffKey = d || diffKey;
  newGame(seed || (Math.random() * 1e6 | 0), diffKey);
  buildTerrain(); if (!built) { buildSprites(); built = true; }
  ui.sel = []; ui.selSet = new Set(); ui.groups = {}; ui.place = null; ui.amode = false; ui.marks = []; ui.sig = ''; lastInfoSig = null; ui.hover = null; ui.slots = null;
  cam.z = 1; $('msgs').innerHTML = ''; $('spd').textContent = '1x';
  const tc = B.find(b => b.owner === 0); centerOn(tc.x, tc.y); setSel([]); 
  updateFogCanvas();
  for (const id of ['start', 'pause', 'end']) $(id).classList.remove('on');
  mode = 'play'; endShown = false;
  toast('Gather resources, build houses, and prepare your army!');
}
function togglePause(on) {
  if (mode === 'menu' || mode === 'over') return;
  mode = on ? 'paused' : 'play'; $('pause').classList.toggle('on', on);
}
let endShown = false;
function showEnd() {
  endShown = true; mode = 'over'; const win = G.over.win, st = P(0).stats, es = P(1).stats;
  sfx(win ? 'win' : 'lose');
  $('endt').textContent = win ? 'Victory!' : 'Defeat'; $('endt').style.color = win ? '#f3d98a' : '#ff8a7a';
  $('endsub').textContent = win ? 'The red kingdom lies in ruins. Your realm endures.' : 'Your settlement has fallen to the enemy.';
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60);
  $('endstat').innerHTML = [['Time', m + ':' + String(s).padStart(2, '0')], ['Age', AGES[P(0).age]], ['Enemy kills', st.kills], ['Units lost', st.lost], ['Units trained', st.trained], ['Resources gathered', Math.floor(st.gathered)]].map(([a, b]) => `<div><div class="isub">${a}</div><b>${b}</b></div>`).join('');
  $('end').classList.add('on');
}
let last = performance.now(), acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (ts - last) / 1000); last = ts;
  if (mode === 'menu' && G) {
    for (let i = 0; i < 3; i++) { step(); G.explored.fill(1); G.vis.fill(1); }
    const t = (Math.sin(ts / 14000) + 1) / 2; centerOn(18 + t * 44, 62 - t * 44); cam.z = .9;
    render(ui); return;
  }
  if (mode === 'play' || mode === 'over' || mode === 'paused') {
    if (mode === 'play') {
      acc += dt * G.speed; let n = 0; while (acc >= DT && n++ < 10) { step(); acc -= DT; }
      if (n >= 10) acc = 0;
      updateCamera(dt);
    }
    render(ui); drawDragBox(); if ((G.frame & 1) === 0 || mode !== 'play') drawMinimap($('mm'), ui);
    updateHUD();
    if (G.over && !endShown && G.t - G.over.t >= 0) setTimeout(showEnd, 1200), endShown = true;
  }
}
window.addEventListener('load', () => {
  initUI();
  newGame(11, 'normal'); G.players[0].ai = { t: 0, army: [], wave: 0, waveOn: false, lastWave: 0, rally: null, last: {}, bad: {} };
  buildTerrain(); buildSprites(); built = true; G.explored.fill(1); G.vis.fill(1);
  for (let i = 0; i < 30 * 60 * 3; i++) step();
  document.querySelectorAll('#diffs button').forEach(b => b.onclick = () => { document.querySelectorAll('#diffs button').forEach(x => x.classList.remove('on')); b.classList.add('on'); diffKey = b.dataset.d; });
  $('play').onclick = () => startGame(diffKey);
  $('resume').onclick = () => togglePause(false);
  $('mute').onclick = () => { setMuted(!muted); $('mute').textContent = 'Sound: ' + (muted ? 'Off' : 'On'); };
  $('restart').onclick = () => { $('pause').classList.remove('on'); mode = 'menu'; startGame(diffKey); };
  $('again').onclick = () => { $('end').classList.remove('on'); startGame(diffKey); };
  const q = new URLSearchParams(location.search);
  if (q.get('auto')) startGame(q.get('auto'), +q.get('seed') || 7);
  requestAnimationFrame(frame);
});
