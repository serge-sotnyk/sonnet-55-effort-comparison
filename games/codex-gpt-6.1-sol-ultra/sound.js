/** A quiet, original medieval soundscape made entirely with Web Audio. */
export class Soundscape {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
    this.running = false;
    this.sources = new Set();
    this.timers = new Set();
    this.wind = null;
    this.lastPlayed = new Map();
  }

  async unlock() {
    if (!this.context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.34 : 0;
        this.master.connect(this.context.destination);
      } catch { return false; }
    }
    try { if (this.context.state === 'suspended') await this.context.resume(); } catch { return false; }
    return this.context.state === 'running';
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.34 : 0, this.context.currentTime, 0.035);
  }

  _later(callback, delay) {
    const id = setTimeout(() => { this.timers.delete(id); callback(); }, delay);
    this.timers.add(id);
    return id;
  }

  _tone(frequency, delay = 0, length = 0.18, volume = 0.16, type = 'triangle', endFrequency = 0) {
    if (!this.context || !this.master || !this.enabled) return;
    const ctx = this.context, t = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, t + length);
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(volume, t + Math.min(0.012, length / 5));
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + length);
    oscillator.connect(envelope); envelope.connect(this.master);
    this.sources.add(oscillator);
    oscillator.onended = () => { this.sources.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(t); oscillator.stop(t + length + 0.02);
  }

  _noise(length = 0.12, volume = 0.06, cutoff = 1200) {
    if (!this.context || !this.enabled) return;
    const ctx = this.context, count = Math.ceil(ctx.sampleRate * length);
    const buffer = ctx.createBuffer(1, count, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    const t = ctx.currentTime;
    envelope.gain.setValueAtTime(volume, t); envelope.gain.exponentialRampToValueAtTime(0.0001, t + length);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(t); source.stop(t + length);
  }

  play(name) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    // Large battles and repeat commands stay gentle and legible.
    const throttle = name === 'attack' ? 0.17 : name === 'gather' ? 0.5 : 0.045;
    if (now - (this.lastPlayed.get(name) ?? -100) < throttle) return;
    this.lastPlayed.set(name, now);
    const notes = (values, step = .065, length = .24, volume = .17, type = 'triangle') => values.forEach((f, i) => this._tone(f, i * step, length, volume, type));
    switch (name) {
      case 'click': this._tone(570, 0, .07, .095); break;
      case 'select': notes([392, 523.25], .038, .12, .105); break;
      case 'command': case 'move': notes([293.66, 392], .055, .15, .11); break;
      case 'build': this._noise(.075, .09, 700); this._tone(174.61, .02, .16, .13); break;
      case 'complete': notes([392, 493.88, 587.33], .095, .36, .16); this._tone(196, 0, .48, .075); break;
      case 'train': notes([293.66, 392, 440], .065, .22, .145); break;
      case 'attack': this._noise(.095, .07, 1900); this._tone(160, 0, .11, .095, 'triangle', 65); break;
      case 'gather': this._tone(260, 0, .065, .045); this._noise(.05, .035, 550); break;
      case 'error': notes([196, 174.61], .1, .17, .12); break;
      case 'age': notes([261.63, 329.63, 392, 523.25, 659.25, 783.99], .14, .65, .18); this._tone(130.81, 0, 1.3, .11); break;
      case 'victory': notes([392, 392, 523.25, 493.88, 523.25, 659.25, 783.99], .22, .65, .2); this._tone(196, 0, 1.8, .09); this._tone(261.63, .9, 1.4, .08); break;
      case 'defeat': notes([392, 349.23, 293.66, 246.94, 196], .24, .7, .145); this._tone(98, .8, 1.4, .085); break;
      default: this._tone(440, 0, .1, .085);
    }
  }

  start() {
    if (this.running || !this.context || this.context.state !== 'running') return;
    this.running = true;
    const ctx = this.context;
    // A barely audible filtered wind bed, with no downloaded audio or looping music.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    wind.buffer = buffer; wind.loop = true;
    filter.type = 'lowpass'; filter.frequency.value = 380;
    gain.gain.value = .017;
    wind.connect(filter); filter.connect(gain); gain.connect(this.master); wind.start();
    this.wind = { source: wind, filter, gain };
    const lute = () => {
      if (!this.running) return;
      if (this.enabled) {
        const phrases = [[196, 293.66, 392, 440, 392], [220, 329.63, 440, 392, 293.66], [174.61, 261.63, 349.23, 392, 349.23]];
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        phrase.forEach((frequency, i) => {
          this._tone(frequency, i * .43, 1.15, .029, 'triangle');
          this._tone(frequency * 2, i * .43, .65, .009, 'sine');
        });
      }
      this._later(lute, 18000 + Math.random() * 12000);
    };
    const bird = () => {
      if (!this.running) return;
      if (this.enabled) {
        this._tone(1500, 0, .11, .013, 'sine', 2300);
        this._tone(2100, .16, .08, .01, 'sine', 1600);
      }
      this._later(bird, 16000 + Math.random() * 18000);
    };
    this._later(lute, 6000);
    this._later(bird, 9000);
  }

  stop() {
    this.running = false;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (this.wind) {
      try { this.wind.source.stop(); } catch { /* Already stopped. */ }
      this.wind.source.disconnect(); this.wind.filter.disconnect(); this.wind.gain.disconnect();
      this.wind = null;
    }
    for (const source of this.sources) { try { source.stop(); } catch { /* Already ended. */ } }
    this.sources.clear();
  }
}
