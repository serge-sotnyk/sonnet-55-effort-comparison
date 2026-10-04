'use strict';
// ---- synthesized sound effects + gentle generative music ----
let AC = null, master = null, muted = false, noiseBuf = null;
const lastSfx = {};
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = muted ? 0 : .5; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  } catch (e) { AC = null; }
}
function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .5; }
function tone(f, dur, type = 'sine', vol = .2, slide = 0, delay = 0) {
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
function noise(dur, vol, freq, q = 1, type = 'bandpass', delay = 0) {
  const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
function sfx(name, x, y) {
  if (!AC || muted) return;
  if (x !== undefined && typeof visAt === 'function' && G && !visAt(x, y)) return;
  const now = AC.currentTime, gap = { hit: .07, arrow: .08, die: .08, boom: .1, catapult: .2, ram: .15, crash: .3 }[name] || .05;
  if (lastSfx[name] && now - lastSfx[name] < gap) return; lastSfx[name] = now;
  switch (name) {
    case 'click': tone(660, .07, 'triangle', .1); break;
    case 'place': noise(.12, .3, 300, 1); tone(150, .12, 'square', .1, -60); break;
    case 'done': tone(523, .12, 'triangle', .18); tone(659, .12, 'triangle', .18, 0, .1); tone(784, .22, 'triangle', .18, 0, .2); break;
    case 'spawn': tone(440, .08, 'triangle', .12); tone(587, .12, 'triangle', .12, 0, .07); break;
    case 'tech': tone(392, .1, 'sine', .2); tone(523, .1, 'sine', .2, 0, .09); tone(784, .3, 'sine', .2, 0, .18); break;
    case 'age': [262, 330, 392, 523, 659, 784].forEach((f, i) => { tone(f, .9, 'triangle', .16, 0, i * .13); tone(f / 2, .9, 'sine', .12, 0, i * .13); }); noise(1.2, .08, 3000, .5, 'highpass', .5); break;
    case 'hit': noise(.08, .35, 900, 2); tone(120, .08, 'square', .1, -50); break;
    case 'arrow': noise(.1, .12, 3500, 3); break;
    case 'die': tone(220, .25, 'sawtooth', .08, -120); break;
    case 'boom': noise(.35, .5, 160, .8, 'lowpass'); tone(70, .3, 'sine', .3, -40); break;
    case 'catapult': noise(.25, .25, 500, 1); tone(180, .2, 'triangle', .15, 200); break;
    case 'ram': noise(.2, .5, 120, .7, 'lowpass'); tone(60, .22, 'square', .15, -20); break;
    case 'crash': noise(.9, .6, 200, .6, 'lowpass'); noise(.6, .3, 900, 1, 'bandpass', .05); break;
    case 'alert': tone(392, .25, 'square', .12); tone(330, .35, 'square', .12, 0, .22); break;
    case 'win': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, .5, 'triangle', .2, 0, i * .15)); break;
    case 'lose': [330, 294, 262, 196].forEach((f, i) => tone(f, .7, 'sawtooth', .12, 0, i * .25)); break;
  }
}
// slow modal lute-like music
function startMusic() {
  const scale = [293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3], prog = [0, 3, 4, 2];
  let step = 0;
  setInterval(() => {
    if (!AC || muted || AC.state !== 'running') return;
    const bar = (step / 8 | 0) % 4, root = scale[prog[bar]] / 2;
    if (step % 8 === 0) { tone(root, 3.2, 'sine', .05); tone(root * 1.5, 3.2, 'sine', .035); }
    if (Math.random() < .62) { const n = scale[(prog[bar] + [0, 2, 4, 1, 3][(Math.random() * 5) | 0]) % 8]; tone(n, 1.1, 'triangle', .045); }
    step++;
  }, 520);
}
