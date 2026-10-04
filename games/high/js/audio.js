'use strict';
// ---------------------------------------------------------------------------
// WebAudio synthesised sound effects and generative music
// ---------------------------------------------------------------------------
const SFX = {
  ctx: null, master: null, sfxGain: null, musicGain: null, noiseBuf: null,
  enabled: true, musicOn: true, last: {}, voices: 0, musicTimer: null, nextNote: 0, step: 0, started: false,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
    this.sfxGain = c.createGain(); this.sfxGain.gain.value = 0.55; this.sfxGain.connect(this.master);
    this.musicGain = c.createGain(); this.musicGain.gain.value = this.musicOn ? 0.22 : 0; this.musicGain.connect(this.master);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  },
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.7 : 0; },
  setMusic(v) { this.musicOn = v; if (this.musicGain) this.musicGain.gain.setTargetAtTime(v ? 0.22 : 0, this.ctx.currentTime, 0.3); },

  // --- primitives
  tone(freq, dur, type = 'sine', vol = 0.3, o = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.filter) { const f = c.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.ff || 1000; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.dest || this._dest || this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  },
  noise(dur, vol = 0.3, filt = 'bandpass', freq = 1000, o = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = filt; f.frequency.setValueAtTime(freq, t0); f.Q.value = o.q || 1;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweep), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this._dest || this.sfxGain);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  },

  // --- named effects
  play(name) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const lim = { click: 0.03, unit: 0.1, error: 0.25, coin: 0.06, alarm: 2 }[name] || 0.05;
    if (this.last[name] && now - this.last[name] < lim) return;
    this.last[name] = now;
    switch (name) {
      case 'click': this.tone(520, 0.05, 'triangle', 0.18); break;
      case 'select': this.tone(380, 0.05, 'triangle', 0.12); this.tone(560, 0.05, 'triangle', 0.1, { delay: 0.03 }); break;
      case 'order': this.tone(300, 0.07, 'square', 0.06, { filter: 'lowpass', ff: 900 }); break;
      case 'error': this.tone(140, 0.18, 'sawtooth', 0.14, { filter: 'lowpass', ff: 500 }); break;
      case 'coin': this.tone(1320, 0.12, 'sine', 0.12); this.tone(1760, 0.18, 'sine', 0.1, { delay: 0.06 }); break;
      case 'unit': this.tone(440, 0.12, 'triangle', 0.2); this.tone(660, 0.16, 'triangle', 0.18, { delay: 0.08 }); break;
      case 'tech': [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.14, { delay: i * 0.09 })); break;
      case 'built': this.tone(392, 0.2, 'triangle', 0.22); this.tone(523, 0.2, 'triangle', 0.22, { delay: 0.12 }); this.tone(659, 0.35, 'triangle', 0.22, { delay: 0.24 }); break;
      case 'age':
        [[261, 329, 392], [293, 349, 440], [329, 392, 523], [392, 494, 587, 784]].forEach((ch, i) => ch.forEach((f) => this.tone(f, 0.9, 'sawtooth', 0.07, { delay: i * 0.28, filter: 'lowpass', ff: 1400, attack: 0.04 })));
        break;
      case 'alarm': this.tone(247, 0.35, 'sawtooth', 0.2, { filter: 'lowpass', ff: 900, attack: 0.03 }); this.tone(196, 0.5, 'sawtooth', 0.2, { delay: 0.35, filter: 'lowpass', ff: 800, attack: 0.03 }); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 1.2, 'triangle', 0.2, { delay: i * 0.18 })); break;
      case 'lose': [330, 294, 262, 196].forEach((f, i) => this.tone(f, 1.0, 'sawtooth', 0.12, { delay: i * 0.3, filter: 'lowpass', ff: 700 })); break;
      case 'chop': this.noise(0.08, 0.35, 'bandpass', 1400, { q: 2 }); this.tone(180, 0.08, 'triangle', 0.18, { slide: 90 }); break;
      case 'mine': this.tone(2200 + Math.random() * 400, 0.1, 'square', 0.06, { filter: 'highpass', ff: 1500 }); this.noise(0.05, 0.25, 'highpass', 3000); break;
      case 'hammer': this.tone(260, 0.07, 'triangle', 0.25, { slide: 120 }); this.noise(0.04, 0.2, 'bandpass', 2000); break;
      case 'sword': this.noise(0.1, 0.25, 'highpass', 2500, { sweep: 6000 }); this.tone(1800 + Math.random() * 600, 0.14, 'triangle', 0.07); break;
      case 'hit': this.noise(0.1, 0.35, 'lowpass', 600); this.tone(120, 0.1, 'sine', 0.3, { slide: 60 }); break;
      case 'bow': this.noise(0.12, 0.18, 'bandpass', 3000, { sweep: 800 }); break;
      case 'death': this.tone(300, 0.25, 'sawtooth', 0.12, { slide: 80, filter: 'lowpass', ff: 800 }); break;
      case 'crash': this.noise(0.5, 0.5, 'lowpass', 900, { sweep: 120 }); break;
      case 'collapse': this.noise(1.3, 0.7, 'lowpass', 700, { sweep: 60, attack: 0.02 }); this.tone(70, 0.9, 'sine', 0.5, { slide: 30 }); break;
      case 'ram': this.tone(90, 0.25, 'sine', 0.55, { slide: 40 }); this.noise(0.15, 0.4, 'lowpass', 500); break;
      case 'boom': this.tone(80, 0.5, 'sine', 0.6, { slide: 30 }); this.noise(0.4, 0.5, 'lowpass', 800, { sweep: 100 }); break;
      case 'catapult': this.tone(200, 0.3, 'sawtooth', 0.14, { slide: 100, filter: 'lowpass', ff: 500 }); this.noise(0.2, 0.3, 'bandpass', 500); break;
      case 'convert': [600, 800, 1000, 1400].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.1, { delay: i * 0.06 })); break;
    }
  },
  at(x, y, name) {
    if (!this.ctx || !this.enabled || G.demo) return;
    const c = screenToWorld(R.vw / 2, R.vh / 2);
    const d = Math.hypot(x - c.x, y - c.y);
    const reach = 22 / R.cam.zoom;
    if (d > reach) return;
    const now = this.ctx.currentTime;
    // throttle: limit number of simultaneous positional sounds
    this._bucket = this._bucket || { t: 0, n: 0 };
    if (now - this._bucket.t > 0.12) { this._bucket.t = now; this._bucket.n = 0; }
    if (this._bucket.n >= 6) return;
    const minI = { chop: 0.3, mine: 0.34, hammer: 0.34, coin: 0.18, sword: 0.1, bow: 0.09, hit: 0.1, death: 0.14, built: 0.5 }[name] || 0.04;
    if (this.last[name] && now - this.last[name] < minI) return;
    this._bucket.n++;
    const v = Math.pow(1 - d / reach, 1.4);
    const tg = this.ctx.createGain(); tg.gain.value = Math.max(0.12, v); tg.connect(this.sfxGain);
    this._dest = tg;
    this.play(name);
    this._dest = null;
  },

  // --- music: slow generative modal lute melody over a drone
  startMusic() {
    if (this.started) return; this.started = true;
    const c = this.ctx;
    // drone
    const droneG = c.createGain(); droneG.gain.value = 0.35; droneG.connect(this.musicGain);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(droneG);
    for (const [f, v] of [[73.42, 0.5], [110, 0.35], [146.83, 0.2]]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = v * 0.18; o.connect(g); g.connect(lp); o.start();
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.1; const lg = c.createGain(); lg.gain.value = v * 0.06; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    }
    this.nextNote = c.currentTime + 1;
    this.scale = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25];
    this.bassScale = [73.42, 87.31, 98, 110, 130.81];
    this.pos = 4;
    this.chordRoots = [0, 0, 1, 3, 0, 4, 2, 0];
    this.musicTimer = setInterval(() => this.musicTick(), 250);
  },
  musicTick() {
    const c = this.ctx; if (!c || !this.musicOn) return;
    const beat = 0.5;
    while (this.nextNote < c.currentTime + 1.2) {
      const t = this.nextNote;
      const bar = Math.floor(this.step / 8) % 8, pos = this.step % 8;
      // bass pluck on beat 0 and 4
      if (pos === 0 || pos === 4) {
        const root = this.bassScale[this.chordRoots[bar] % this.bassScale.length];
        this.pluck(root, t, 1.4, 0.55);
        if (pos === 0) this.pluck(root * 1.5, t + beat * 0.02, 1.2, 0.22);
      }
      // melody random walk
      if (Math.random() < 0.5 || pos === 0) {
        const choices = [-2, -1, -1, 0, 1, 1, 2];
        this.pos = clamp(this.pos + choices[Math.floor(Math.random() * choices.length)], 0, this.scale.length - 1);
        const f = this.scale[this.pos];
        this.pluck(f, t, 0.9 + Math.random() * 0.8, 0.5);
      }
      this.step++;
      this.nextNote += beat;
      if (this.step % 64 === 0) this.nextNote += beat * 4; // breathing pause
    }
  },
  pluck(freq, t, dur, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  },
};
