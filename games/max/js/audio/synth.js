// Age of Crowns - synthesis toolkit.
// Everything here works on ANY BaseAudioContext (real-time or Offline) so recipes can be rendered by tests.
// Contents: seedable RNG, cached noise buffers, the Voice graph builder (lifetime tracked, leak free),
// envelope helpers, Karplus-Strong pluck buffers, algorithmic reverb / echo, shaping curves.

export const EPS = 1e-4;
export const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ stats (leak diagnostics) */
export const stats = { created: 0, disposed: 0, voices: 0, voicesDisposed: 0 };
export const liveNodes = () => stats.created - stats.disposed;

/* ------------------------------------------------------------------ random */
export class Rng {
  constructor(seed) { this.s = ((seed == null ? Math.random() * 4294967296 : seed) >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  gauss() { const u = Math.max(1e-9, this.next()), v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  weighted(items, weights) {
    let sum = 0; for (const w of weights) sum += w;
    let r = this.next() * sum;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
}
let G = new Rng();
/** Seed the global (SFX) generator - used by tests for reproducible renders. null = random again. */
export function seedRandom(seed) { G = new Rng(seed == null ? undefined : seed); }
export const rnd = () => G.next();
export const rand = (a = 0, b = 1) => a + (b - a) * G.next();
export const randi = (a, b) => a + Math.floor(G.next() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(G.next() * arr.length)];
export const chance = (p) => G.next() < p;
export const gauss = () => G.gauss();
/** value * (1 +- amt) */
export const jit = (x, amt = 0.05) => x * (1 + (G.next() * 2 - 1) * amt);

/* ------------------------------------------------------------------ math */
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const semi = (n) => Math.pow(2, n / 12);
export const dbg = (d) => Math.pow(10, d / 20);
export const gdb = (g) => 20 * Math.log10(Math.max(g, 1e-9));
/** Web Audio lowpass/highpass 'Q' is expressed in dB: convert a linear Q (0.7071 = Butterworth, no peaking) */
export const qdb = (q) => 20 * Math.log10(Math.max(q, 0.01));

/* ------------------------------------------------------------------ envelopes */
/** Percussive: 0 -> peak in `a`, then exponential decay to silence over `dur`. */
export function envPerc(param, T, peak, a, dur) {
  peak = Math.max(peak, EPS * 2);
  param.setValueAtTime(0, T);
  param.linearRampToValueAtTime(peak, T + a);
  param.exponentialRampToValueAtTime(EPS, T + a + dur);
  param.setValueAtTime(0, T + a + dur + 0.001);
}
/** Sustained: attack `a`, hold until `dur` (optionally decaying to peak*sus), exponential release `r`. */
export function envASR(param, T, peak, a, dur, r, sus = 1) {
  peak = Math.max(peak, EPS * 2);
  param.setValueAtTime(0, T);
  param.linearRampToValueAtTime(peak, T + a);
  const end = Math.max(T + a, T + dur);
  if (sus !== 1) param.linearRampToValueAtTime(Math.max(peak * sus, EPS * 2), end);
  else param.setValueAtTime(peak, end);
  param.exponentialRampToValueAtTime(EPS, end + r);
  param.setValueAtTime(0, end + r + 0.001);
}
/** Swell: convex rise over `a`, then exponential fall over `r` (whoosh / bloom shape). */
export function envSwell(param, T, peak, a, r) {
  peak = Math.max(peak, EPS * 2);
  param.setValueAtTime(0, T);
  param.linearRampToValueAtTime(peak * 0.3, T + a * 0.55);
  param.linearRampToValueAtTime(peak, T + a);
  param.exponentialRampToValueAtTime(EPS, T + a + r);
  param.setValueAtTime(0, T + a + r + 0.001);
}

/* ------------------------------------------------------------------ cached noise */
const NOISE_SECS = 2.6;
const noiseCache = new Map();   // sampleRate -> { kind: AudioBuffer } (AudioBuffers may be shared between contexts)

function genNoise(kind, sr) {
  const L = Math.floor(sr * NOISE_SECS), X = Math.floor(sr * 0.25);
  const total = L + X;
  const r = new Rng(kind === 'white' ? 1111 : kind === 'pink' ? 2222 : 3333);
  const n = new Float32Array(total);
  if (kind === 'white') {
    for (let i = 0; i < total; i++) n[i] = r.next() * 2 - 1;
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < total; i++) {
      const w = r.next() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      n[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else { // brown
    let last = 0, hx = 0, hy = 0;
    for (let i = 0; i < total; i++) {
      const w = r.next() * 2 - 1;
      last = (last + 0.04 * w) / 1.04;
      const y = last - hx + 0.997 * hy; hx = last; hy = y; // gentle DC blocker
      n[i] = y;
    }
  }
  // remove mean, normalise RMS to 0.3, hard limit the rare outliers
  let mean = 0; for (let i = 0; i < total; i++) mean += n[i]; mean /= total;
  let ss = 0; for (let i = 0; i < total; i++) { n[i] -= mean; ss += n[i] * n[i]; }
  const k = 0.3 / Math.sqrt(ss / total || 1);
  for (let i = 0; i < total; i++) n[i] = clamp(n[i] * k, -1, 1);
  // make it seamlessly loopable with an equal-power crossfade of the tail into the head
  const out = new Float32Array(L);
  for (let i = 0; i < L; i++) out[i] = n[i];
  for (let i = 0; i < X; i++) {
    const w = (i + 0.5) / X;
    out[i] = n[i] * Math.sin(w * Math.PI / 2) + n[L + i] * Math.cos(w * Math.PI / 2);
  }
  return out;
}

/** Cached mono noise AudioBuffer of kind 'white' | 'pink' | 'brown' (seamlessly loopable). */
export function noiseBuf(ctx, kind = 'white') {
  const sr = ctx.sampleRate;
  let m = noiseCache.get(sr);
  if (!m) { m = {}; noiseCache.set(sr, m); }
  if (m[kind]) return m[kind];
  const data = genNoise(kind, sr);
  const buf = ctx.createBuffer(1, data.length, sr);
  buf.copyToChannel(data, 0);
  m[kind] = buf;
  return buf;
}

/* ------------------------------------------------------------------ cached periodic waves */
const waveCache = new WeakMap();
/** Custom oscillator spectra: 'glottal' (voice source), 'reed' (shawm), 'soft' (flute-ish), 'brassy'. */
export function getWave(ctx, name) {
  let m = waveCache.get(ctx);
  if (!m) { m = {}; waveCache.set(ctx, m); }
  if (m[name]) return m[name];
  const N = 48;
  const re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) {
    let a;
    switch (name) {
      case 'glottal': a = 1 / Math.pow(n, 1.35); if (n === 2) a *= 0.8; break;
      case 'reed': a = (n % 2 ? 1 : 0.55) / Math.pow(n, 1.05); break;
      case 'soft': a = n === 1 ? 1 : n === 2 ? 0.28 : n === 3 ? 0.1 : n === 4 ? 0.04 : 0.012 / n; break;
      case 'brassy': a = 1 / Math.pow(n, 0.8); break;
      default: a = 1 / n;
    }
    im[n] = a;
  }
  m[name] = ctx.createPeriodicWave(re, im);
  return m[name];
}

/* ------------------------------------------------------------------ Voice: one sounding object's graph */
export class Voice {
  /**
   * @param ctx  BaseAudioContext
   * @param dest AudioNode the voice output is connected to
   * @param t0   absolute start time (ctx time)
   * @param o    { vol, pan, send (AudioNode), sendAmt, onDispose }
   */
  constructor(ctx, dest, t0, o = {}) {
    this.ctx = ctx; this.t0 = t0; this.dest = dest;
    this.live = 0; this.end = t0; this.done = false; this.killed = false;
    this.nodes = []; this.srcs = [];
    this.onDispose = o.onDispose || null;
    this.meta = o.meta || null;
    this._ended = () => { if (--this.live <= 0) this.dispose(); };
    const out = this.n(ctx.createGain());
    out.gain.value = o.vol == null ? 1 : o.vol;
    this.out = out;
    let tail = out;
    if (o.pan && Math.abs(o.pan) > 0.02) {
      const p = this.n(ctx.createStereoPanner());
      p.pan.value = clamp(o.pan, -1, 1);
      out.connect(p); tail = p;
    }
    tail.connect(dest);
    if (o.send && o.sendAmt > 0.004) {
      const s = this.n(ctx.createGain());
      s.gain.value = o.sendAmt;
      tail.connect(s); s.connect(o.send);
    }
    stats.voices++;
  }

  n(node) { this.nodes.push(node); stats.created++; return node; }

  /** absolute time of relative t */
  T(t = 0) { return this.t0 + t; }

  _run(src, t, dur, offset) {
    const T = this.t0 + t;
    dur = Math.max(dur, 0.004);
    if (offset != null) src.start(T, offset); else src.start(T);
    src.stop(T + dur);
    this.live++; src.onended = this._ended;
    this.srcs.push(src);
    if (T + dur > this.end) this.end = T + dur;
    return src;
  }

  /** extend the nominal end time (for bookkeeping of non-source tails) */
  extend(t) { if (this.t0 + t > this.end) this.end = this.t0 + t; }

  osc(type, f, t, dur) {
    const o = this.n(this.ctx.createOscillator());
    if (typeof type === 'object') o.setPeriodicWave(type); else o.type = type;
    o.frequency.value = f;
    return this._run(o, t, dur);
  }
  noiseSrc(kind, t, dur, rate = 1) {
    const s = this.n(this.ctx.createBufferSource());
    const b = noiseBuf(this.ctx, kind);
    s.buffer = b; s.loop = true;
    if (rate !== 1) s.playbackRate.value = rate;
    return this._run(s, t, dur, rand(0, b.duration * 0.9));
  }
  bufSrc(buffer, t, rate = 1, dur) {
    const s = this.n(this.ctx.createBufferSource());
    s.buffer = buffer;
    if (rate !== 1) s.playbackRate.value = rate;
    return this._run(s, t, dur == null ? buffer.duration / rate : dur);
  }
  gain(v = 1) { const g = this.n(this.ctx.createGain()); g.gain.value = v; return g; }
  /** biquad; q is the LINEAR Q for every type (the Web Audio lowpass/highpass Q is in dB, converted here) */
  filt(type, f, q = 1, gdb = 0) {
    const b = this.n(this.ctx.createBiquadFilter());
    b.type = type; b.frequency.value = f;
    b.Q.value = (type === 'lowpass' || type === 'highpass') ? qdb(q) : q;
    if (gdb) b.gain.value = gdb;
    return b;
  }
  panner(p) { const x = this.n(this.ctx.createStereoPanner()); x.pan.value = clamp(p, -1, 1); return x; }
  delay(maxT, t) { const d = this.n(this.ctx.createDelay(maxT)); d.delayTime.value = t; return d; }
  shaper(curve, os = '2x') { const s = this.n(this.ctx.createWaveShaper()); s.curve = curve; s.oversample = os; return s; }
  /** connect a chain of nodes (a -> b -> c ...), returns the last one */
  chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

  /** exponential frequency/param glide f0 -> f1 between relative times */
  glide(param, f0, f1, t, dur) {
    const T = this.t0 + t;
    param.setValueAtTime(f0, T);
    param.exponentialRampToValueAtTime(Math.max(f1, 0.01), T + Math.max(dur, 0.002));
  }

  /** LFO attached to a param (e.g. osc.detune in cents / frequency in Hz). Returns the lfo oscillator. */
  lfo(param, rate, depth, t, dur, { type = 'sine', fadeIn = 0 } = {}) {
    const l = this.osc(type, rate, t, dur);
    const g = this.gain(depth);
    if (fadeIn > 0) { g.gain.setValueAtTime(0, this.t0 + t); g.gain.linearRampToValueAtTime(depth, this.t0 + t + fadeIn); }
    l.connect(g); g.connect(param);
    return l;
  }

  /**
   * Oscillator through an amplitude envelope.
   * { type, f, f1 (glide target), ft (glide time), t, dur, a, r (release -> sustained envelope), sus, vol, det (cents),
   *   lp, hp, q, dest, wave }
   */
  tone(o) {
    const { type = 'sine', f = 440, f1, ft, t = 0, dur = 0.2, a = 0.003, r, sus, vol = 1, det = 0, dest = this.out } = o;
    const tail = r != null ? r : 0;
    const osc = this.osc(o.wave || type, f, t, a + dur + tail + 0.03);
    if (det) osc.detune.value = det;
    if (f1 && f1 !== f) this.glide(osc.frequency, f, f1, t, ft == null ? dur : ft);
    const env = this.gain(0);
    const T = this.t0 + t;
    if (r != null) envASR(env.gain, T, vol, a, dur, r, sus == null ? 1 : sus); else envPerc(env.gain, T, vol, a, dur);
    let node = osc;
    if (o.hp) { const h = this.filt('highpass', o.hp, 0.7); node.connect(h); node = h; }
    if (o.lp) { const l = this.filt('lowpass', o.lp, o.q || 0.7); node.connect(l); node = l; }
    node.connect(env); env.connect(dest);
    return env;
  }

  /**
   * Filtered noise burst.
   * { kind, t, dur, a, r, vol, rate (buffer rate), filters: [[type, f, q, f1?, ft?], ...], dest }
   */
  noise(o) {
    const { kind = 'white', t = 0, dur = 0.1, a = 0.002, r, vol = 1, rate = 1, dest = this.out } = o;
    const src = this.noiseSrc(kind, t, a + dur + (r || 0) + 0.03, rate);
    const T = this.t0 + t;
    let node = src;
    for (const fs of (o.filters || [])) {
      const [type, f, q = 1, f1, ft] = fs;
      const b = this.filt(type, f, q);
      if (f1 && f1 !== f) this.glide(b.frequency, f, f1, t, ft == null ? dur : ft);
      node.connect(b); node = b;
    }
    const env = this.gain(0);
    if (r != null) envASR(env.gain, T, vol, a, dur, r, o.sus == null ? 1 : o.sus);
    else if (o.swell) envSwell(env.gain, T, vol, a, dur);
    else envPerc(env.gain, T, vol, a, dur);
    node.connect(env); env.connect(dest);
    return env;
  }

  /**
   * Modal (struck object) synthesis: a set of decaying sine partials.
   * table: [[ratio, amp, decaySec], ...]
   * o: { t, vol, jit (random detune of partials), a, dest, bend (start pitch multiplier decaying to 1 over 40ms) }
   */
  modes(f0, table, o = {}) {
    const { t = 0, vol = 1, a = 0.0007, dest = this.out, bend = 1, jit: jt = 0.004 } = o;
    const T = this.t0 + t;
    for (const [ratio, amp, dec] of table) {
      const f = f0 * ratio * (1 + (G.next() * 2 - 1) * jt);
      if (f > this.ctx.sampleRate * 0.45) continue;
      const osc = this.osc('sine', f, t, a + dec + 0.03);
      if (bend !== 1) { osc.frequency.setValueAtTime(f * bend, T); osc.frequency.exponentialRampToValueAtTime(f, T + 0.04); }
      const env = this.gain(0);
      envPerc(env.gain, T, amp * vol, a, dec);
      osc.connect(env); env.connect(dest);
    }
  }

  /**
   * FM tone. { fc, ratio, index, index1 (end index), t, dur, a, vol, dest, type }
   */
  fm(o) {
    const { fc, ratio = 1.4, index = 2, index1 = 0.05, t = 0, dur = 0.5, a = 0.002, vol = 1, dest = this.out } = o;
    const T = this.t0 + t;
    const car = this.osc('sine', fc, t, a + dur + 0.03);
    const mod = this.osc('sine', fc * ratio, t, a + dur + 0.03);
    const mg = this.gain(0);
    const d0 = index * fc * ratio, d1 = Math.max(index1 * fc * ratio, EPS);
    mg.gain.setValueAtTime(Math.max(d0, EPS), T);
    mg.gain.exponentialRampToValueAtTime(d1, T + dur);
    mod.connect(mg); mg.connect(car.frequency);
    const env = this.gain(0);
    envPerc(env.gain, T, vol, a, dur);
    car.connect(env); env.connect(dest);
    return env;
  }

  /**
   * Random-envelope noise (crackle / rustle / crumble / coins). The amplitude follows `curve`
   * (Float32Array, evenly spaced over `dur`).
   * { kind, t, dur, curve, filters, vol, dest }
   */
  texture(o) {
    const { kind = 'white', t = 0, dur = 0.5, vol = 1, dest = this.out } = o;
    const src = this.noiseSrc(kind, t, dur + 0.03);
    let node = src;
    for (const [type, f, q = 1, f1, ft] of (o.filters || [])) {
      const b = this.filt(type, f, q);
      if (f1 && f1 !== f) this.glide(b.frequency, f, f1, t, ft == null ? dur : ft);
      node.connect(b); node = b;
    }
    const env = this.gain(0);
    env.gain.setValueCurveAtTime(o.curve, this.t0 + t, dur);
    env.gain.setValueAtTime(0, this.t0 + t + dur + 0.001);
    const post = this.gain(vol);
    node.connect(env); env.connect(post); post.connect(dest);
    return post;
  }

  /** play a pre-computed AudioBuffer through an envelope gain */
  buf(buffer, o = {}) {
    const { t = 0, vol = 1, rate = 1, a = 0.001, dest = this.out, lp, hp } = o;
    const dur = buffer.duration / rate;
    const s = this.bufSrc(buffer, t, rate, dur + 0.02);
    const env = this.gain(0);
    const T = this.t0 + t;
    env.gain.setValueAtTime(0, T);
    env.gain.linearRampToValueAtTime(vol, T + a);
    env.gain.setValueAtTime(vol, T + Math.max(a, dur - 0.05));
    env.gain.linearRampToValueAtTime(0, T + dur);
    let node = s;
    if (hp) { const h = this.filt('highpass', hp, 0.7); node.connect(h); node = h; }
    if (lp) { const l = this.filt('lowpass', lp, 0.7); node.connect(l); node = l; }
    node.connect(env); env.connect(dest);
    return env;
  }

  /** fast fade + stop (voice stealing / stopAll) */
  kill(fade = 0.03) {
    if (this.done || this.killed) return;
    this.killed = true;
    const now = this.ctx.currentTime;
    try {
      const g = this.out.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fade);
    } catch (e) { /* ignore */ }
    for (const s of this.srcs) { try { s.stop(now + fade + 0.005); } catch (e) { /* ignore */ } }
    if (this.live <= 0) this.dispose();
  }

  dispose() {
    if (this.done) return;
    this.done = true;
    const ns = this.nodes;
    for (let i = 0; i < ns.length; i++) { try { ns[i].disconnect(); } catch (e) { /* ignore */ } }
    stats.disposed += ns.length;
    stats.voicesDisposed++;
    for (const s of this.srcs) s.onended = null;
    this.nodes = []; this.srcs = [];
    const cb = this.onDispose; this.onDispose = null;
    if (cb) cb(this);
  }
}

/* ------------------------------------------------------------------ Karplus-Strong plucked string buffers */
/**
 * Compute a plucked-string AudioBuffer in JS (fractional-delay tuned).
 * o: { dur, t60 (decay seconds of fundamental), bright (0.5 = dark/averaging .. 1 = bright), pos (pick position 0..0.5),
 *      soft (0..1 excitation smoothing), rng, gain }
 */
export function pluckBuffer(ctx, freq, o = {}) {
  const sr = ctx.sampleRate;
  const rng = o.rng || G;
  const dur = o.dur || 1.5;
  const len = Math.max(128, Math.floor(sr * dur));
  const D = sr / freq - 0.5;
  const N = Math.max(3, Math.floor(D - 0.3));
  const frac = D - N;                              // 0.3 .. 1.3
  const eta = (1 - frac) / (1 + frac);
  const t60 = o.t60 || 2.0;
  const rho = Math.min(0.99995, Math.pow(0.001, 1 / (t60 * freq)));
  const a = o.bright == null ? 0.5 : o.bright;     // weight on the undelayed tap
  const pos = o.pos == null ? 0.18 : o.pos;
  const soft = o.soft == null ? 0.35 : o.soft;
  const out = new Float32Array(len);
  // excitation
  const M = N + 1;
  const w = new Float32Array(M);
  let sm = 0;
  for (let i = 0; i < M; i++) { const x = rng.next() * 2 - 1; sm = sm * soft + x * (1 - soft); w[i] = sm; }
  const k = Math.max(1, Math.round(pos * N));
  let mean = 0;
  for (let i = 0; i < M; i++) { out[i] = w[i] - (i >= k ? w[i - k] : 0); mean += out[i]; }
  mean /= M; for (let i = 0; i < M; i++) out[i] -= mean;
  let fprev = 0, yprev = 0;
  for (let n = M; n < len; n++) {
    const f = rho * (a * out[n - N] + (1 - a) * out[n - N - 1]);
    const y = eta * f + fprev - eta * yprev;
    fprev = f; yprev = y; out[n] = y;
  }
  // normalise to peak, soften the very beginning + the end (no clicks)
  let pk = 0; for (let i = 0; i < len; i++) { const v = Math.abs(out[i]); if (v > pk) pk = v; }
  const sc = (o.gain == null ? 0.9 : o.gain) / (pk || 1);
  const fade = Math.floor(sr * 0.04);
  for (let i = 0; i < len; i++) {
    let v = out[i] * sc;
    if (i < 12) v *= i / 12;
    if (i > len - fade) v *= (len - i) / fade;
    out[i] = v;
  }
  const buf = ctx.createBuffer(1, len, sr);
  buf.copyToChannel(out, 0);
  return buf;
}

/* ------------------------------------------------------------------ random curves */
/** spiky crackle envelope (fire, crumble). rate = curve samples / s */
export function crackleCurve(seconds, { rate = 700, density = 0.18, decay = 0, shape = 2.2, rng = G } = {}) {
  const n = Math.max(8, Math.floor(seconds * rate));
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = decay ? Math.exp(-decay * i / n) : 1;
    c[i] = (rng.next() < density * (decay ? env + 0.15 : 1) ? Math.pow(rng.next(), shape) : 0) * env;
  }
  c[0] = 0; c[n - 1] = 0; c[n - 2] *= 0.3;   // never start / end on a spike (clicks)
  return c;
}
/** smooth random envelope between lo..hi (rustle, tremolo-ish). */
export function smoothCurve(seconds, { rate = 60, smooth = 0.7, lo = 0.2, hi = 1, rng = G, shape = 1, fadeIn = 0.1, fadeOut = 0.3 } = {}) {
  const n = Math.max(8, Math.floor(seconds * rate));
  const c = new Float32Array(n);
  let s = 0.5;
  for (let i = 0; i < n; i++) {
    s = s * smooth + rng.next() * (1 - smooth);
    let v = lo + (hi - lo) * Math.pow(clamp(s * 1.7 - 0.2, 0, 1), shape);
    const x = i / (n - 1);
    if (x < fadeIn) v *= x / fadeIn;
    if (x > 1 - fadeOut) v *= (1 - x) / fadeOut;
    c[i] = v;
  }
  return c;
}
/** soft clip transfer curve: transparent below `knee`, saturating to ~0.957 at +-1 */
export function softClipCurve(n = 4096, knee = 0.82) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + (1 - knee) * Math.tanh((ax - knee) / (1 - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/* ------------------------------------------------------------------ reverb (algorithmic, no impulse response) */
const COMB_L = [0.02531, 0.02694, 0.02896, 0.03075, 0.03224, 0.03381];
/**
 * Stereo Freeverb-style reverb from DelayNodes (Schroeder combs with damped feedback + 2 allpass).
 * Returns { input, output, dispose }.
 * o: { decay (RT60 s), damp (Hz), size, predelay, combs (4-6), wet (output gain) }
 */
export function makeReverb(ctx, o = {}) {
  const decay = o.decay || 1.5, damp = o.damp || 4200, size = o.size || 1, pre = o.predelay == null ? 0.012 : o.predelay;
  const nC = o.combs || 4;
  const nodes = [];
  const mk = (n) => { nodes.push(n); return n; };
  const input = mk(ctx.createGain());
  const output = mk(ctx.createGain());
  output.gain.value = o.wet == null ? 1 : o.wet;
  const pd = mk(ctx.createDelay(0.25)); pd.delayTime.value = pre;
  input.connect(pd);
  const merger = mk(ctx.createChannelMerger(2));
  for (let ch = 0; ch < 2; ch++) {
    const sum = mk(ctx.createGain());
    sum.gain.value = 1 / Math.sqrt(nC) * 0.55;
    for (let i = 0; i < nC; i++) {
      const D = (COMB_L[i] + ch * 0.00053 + i * 0.0003 * ch) * size;
      const cs = mk(ctx.createGain());
      const dl = mk(ctx.createDelay(0.2)); dl.delayTime.value = D;
      const lp = mk(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = damp; lp.Q.value = qdb(0.5);
      const fb = mk(ctx.createGain()); fb.gain.value = Math.min(0.93, Math.pow(10, -3 * D / decay));
      pd.connect(cs); cs.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(cs);
      lp.connect(sum);
    }
    // two series allpass diffusers
    let node = sum;
    for (const [t, g] of [[0.0050 + ch * 0.0004, 0.5], [0.0017 + ch * 0.0002, 0.5]]) {
      const s = mk(ctx.createGain()), d = mk(ctx.createDelay(0.05)), fb = mk(ctx.createGain()), ff = mk(ctx.createGain()), y = mk(ctx.createGain());
      d.delayTime.value = t; fb.gain.value = g; ff.gain.value = -g;
      node.connect(s); s.connect(d); d.connect(fb); fb.connect(s); d.connect(y); s.connect(ff); ff.connect(y);
      node = y;
    }
    node.connect(merger, 0, ch);
  }
  merger.connect(output);
  return {
    input, output,
    dispose() { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } nodes.length = 0; },
  };
}

/** Stereo ping-pong echo with damped feedback. Returns { input, output, dispose }. */
export function makeEcho(ctx, { time = 0.33, feedback = 0.35, damp = 2800, wet = 0.4 } = {}) {
  const nodes = [];
  const mk = (n) => { nodes.push(n); return n; };
  const input = mk(ctx.createGain()), output = mk(ctx.createGain());
  output.gain.value = wet;
  const dL = mk(ctx.createDelay(2)), dR = mk(ctx.createDelay(2));
  dL.delayTime.value = time; dR.delayTime.value = time * 1.02;
  const lp = mk(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = damp; lp.Q.value = qdb(0.5);
  const fb = mk(ctx.createGain()); fb.gain.value = feedback;
  const merger = mk(ctx.createChannelMerger(2));
  input.connect(dL); dL.connect(merger, 0, 0);
  dL.connect(lp); lp.connect(dR); dR.connect(merger, 0, 1);
  dR.connect(fb); fb.connect(dL);
  merger.connect(output);
  return { input, output, dispose() { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } nodes.length = 0; } };
}
