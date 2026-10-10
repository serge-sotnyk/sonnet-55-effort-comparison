// Age of Crowns - ambience bed: filtered-noise wind with slow gusts, occasional birdsong (FM / swept sines),
// distant crows and a light leaf rustle. Constant, small node count for the wind; birds / crows are short-lived
// Voices scheduled by advance() (same look-ahead model as the score). Very quiet by design.

import { Rng, Voice, noiseBuf, clamp, EPS, smoothCurve, qdb } from './synth.js';

export const AMB_LEVEL = 1.0;   // overall scale of the bed (tuned with tools/audio-check.mjs --ambient)

class Bed {
  constructor(amb, T) {
    const ctx = amb.ctx; this.ctx = ctx; this.amb = amb;
    this.nodes = []; this.srcs = []; this.deadline = Infinity; this.dead = false;
    const mk = (n) => { this.nodes.push(n); return n; };
    this.bus = mk(ctx.createGain()); this.bus.gain.value = 0; this.bus.connect(amb.M.amb);
    const r = amb.rng, noise = (kind) => {
      const s = mk(ctx.createBufferSource()); const b = noiseBuf(ctx, kind);
      s.buffer = b; s.loop = true; s.start(T, r.range(0, b.duration * 0.9)); this.srcs.push(s); return s;
    };
    // layer 1: low rumble of moving air
    const n1 = noise('brown'), lp1 = mk(ctx.createBiquadFilter()); lp1.type = 'lowpass'; lp1.frequency.value = 280; lp1.Q.value = qdb(0.7);
    this.g1 = mk(ctx.createGain()); this.g1.gain.value = 0.5;
    n1.connect(lp1); lp1.connect(this.g1); this.g1.connect(this.bus);
    // layer 2: mid "whoosh" - band-passed pink noise, the main gust voice
    const n2 = noise('pink'); this.bp2 = mk(ctx.createBiquadFilter()); this.bp2.type = 'bandpass'; this.bp2.frequency.value = 700; this.bp2.Q.value = 0.7;
    this.g2 = mk(ctx.createGain()); this.g2.gain.value = 0.25;
    n2.connect(this.bp2); this.bp2.connect(this.g2); this.g2.connect(this.bus);
    // layer 3: faint high leaf hiss with slow tremolo
    const n3 = noise('white'), hp3 = mk(ctx.createBiquadFilter()); hp3.type = 'bandpass'; hp3.frequency.value = 3600; hp3.Q.value = 0.6;
    this.g3 = mk(ctx.createGain()); this.g3.gain.value = 0.03;
    n3.connect(hp3); hp3.connect(this.g3); this.g3.connect(this.bus);
    // slow independent wobble on layer gains
    for (const [g, rate, depth] of [[this.g1, 0.071, 0.12], [this.g2, 0.113, 0.07], [this.g3, 0.19, 0.012]]) {
      const l = mk(ctx.createOscillator()), lg = mk(ctx.createGain());
      l.frequency.value = rate; lg.gain.value = depth; l.connect(lg); lg.connect(g.gain); l.start(T); this.srcs.push(l);
    }
    this.gust(T);
  }
  /** retarget the wind layers (called every few seconds) */
  gust(T) {
    const r = this.amb.rng, tc = r.range(1.6, 3.2);
    const strength = r.range(0.25, 1);
    this.g1.gain.setTargetAtTime(0.25 + 0.55 * strength, T, tc);
    this.g2.gain.setTargetAtTime(0.10 + 0.42 * strength * strength, T, tc);
    this.bp2.frequency.setTargetAtTime(420 + 900 * strength * r.range(0.7, 1.2), T, tc);
    this.g3.gain.setTargetAtTime(0.012 + 0.05 * strength * strength, T, tc);
  }
  fadeIn(T, dur) { this.bus.gain.cancelScheduledValues(T); this.bus.gain.setValueAtTime(0, T); this.bus.gain.setTargetAtTime(1, T, dur / 4); }
  fadeOut(T, dur) { this.bus.gain.cancelScheduledValues(T); this.bus.gain.setTargetAtTime(0, T, dur / 4); this.deadline = T + dur + 1.5; }
  dispose() {
    if (this.dead) return; this.dead = true;
    for (const s of this.srcs) { try { s.stop(); } catch (e) { /* ignore */ } }
    for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    this.nodes = []; this.srcs = [];
  }
}

export class Ambient {
  constructor(ctx, M, o = {}) {
    this.ctx = ctx; this.M = M; this.rng = new Rng(o.seed);
    this.beds = []; this.running = false; this.active = 0;
    this._onDone = () => { this.active--; };
    this.next = { bird: 0, crow: 0, gust: 0, rustle: 0 };
    this.maxActive = o.maxActive == null ? 10 : o.maxActive;
    this.log = o.log ? [] : null;
  }
  get busy() { return this.beds.length > 0; }

  start(at, fadeIn = 3) {
    if (this.running) return;
    const T = (at == null ? this.ctx.currentTime : at) + 0.05, r = this.rng;
    this.running = true;
    const bed = new Bed(this, T); bed.fadeIn(T, fadeIn);
    this.bed = bed; this.beds.push(bed);
    this.next.bird = T + r.range(1.5, 5); this.next.crow = T + r.range(20, 50);
    this.next.gust = T + r.range(3, 7); this.next.rustle = T + r.range(8, 20);
  }
  stop(at, fade = 2) {
    if (!this.running) return;
    this.running = false;
    const T = at == null ? this.ctx.currentTime : at;
    if (this.bed) this.bed.fadeOut(T, fade);
    this.bed = null;
  }
  advance(until, now = this.ctx.currentTime) {
    if (this.beds.some(b => now > b.deadline)) this.beds = this.beds.filter(b => { if (now > b.deadline) { b.dispose(); return false; } return true; });
    if (!this.running || !this.bed) return;
    const r = this.rng, n = this.next;
    for (const k of Object.keys(n)) if (n[k] < now - 1) n[k] = now + r.range(0.5, 3);   // fell behind: don't replay the past
    while (n.gust < until) { this.bed.gust(n.gust); n.gust += r.range(3.5, 9); }
    while (n.bird < until) { this.bird(n.bird); n.bird += r.range(2.2, 9); }
    while (n.crow < until) { this.crow(n.crow); n.crow += r.range(28, 85); }
    while (n.rustle < until) { this.rustle(n.rustle); n.rustle += r.range(10, 30); }
  }
  dispose() { for (const b of this.beds) b.dispose(); this.beds = []; this.running = false; }

  voice(T, pan, vol = 1) {
    this.active++;
    return new Voice(this.ctx, this.bed.bus, Math.max(T, this.ctx.currentTime), { vol: vol * AMB_LEVEL, pan, onDispose: this._onDone });
  }
  _log(kind, T) { if (this.log) this.log.push({ kind, t: +T.toFixed(2) }); }

  /** one chirp: sine sweep with a touch of 2nd harmonic */
  chirp(g, t, f0, f1, dur, vol) {
    const T = g.T(t);
    for (const [mult, v] of [[1, 1], [2, 0.12]]) {
      const o = g.osc('sine', f0 * mult, t, dur + 0.02);
      o.frequency.setValueAtTime(f0 * mult, T); o.frequency.exponentialRampToValueAtTime(Math.max(f1 * mult, 20), T + dur);
      const e = g.gain(0);
      e.gain.setValueAtTime(0, T);
      e.gain.linearRampToValueAtTime(vol * v, T + Math.min(0.012, dur * 0.3));
      e.gain.exponentialRampToValueAtTime(EPS, T + dur);
      e.gain.setValueAtTime(0, T + dur + 0.001);
      o.connect(e); e.connect(g.out);
    }
  }
  bird(T) {
    if (this.active > this.maxActive) return;
    const r = this.rng, kind = r.weighted(['tweet', 'trill', 'warble', 'whistle'], [4, 2.5, 3, 1]);
    this._log('bird:' + kind, T);
    const g = this.voice(T, r.range(-0.8, 0.8), r.range(0.55, 1));
    const base = r.range(0.85, 1.25);
    if (kind === 'tweet') {
      const n = r.int(2, 4), f = r.range(3000, 4300) * base;
      for (let i = 0; i < n; i++) this.chirp(g, i * r.range(0.1, 0.14), f * (1 - i * 0.04), f * 0.78 * (1 - i * 0.04), r.range(0.055, 0.085), 0.2);
    } else if (kind === 'trill') {
      const n = r.int(8, 16), f = r.range(2400, 3200) * base;
      for (let i = 0; i < n; i++) this.chirp(g, i * 0.046, f, f * 1.35, 0.032, 0.14 * Math.sin(Math.PI * (i + 0.5) / n) + 0.03);
    } else if (kind === 'warble') {
      const n = r.int(6, 10); let t = 0, f = r.range(2400, 3600) * base;
      for (let i = 0; i < n; i++) {
        const f1 = clamp(f * r.range(0.75, 1.35), 2000, 4800), d = r.range(0.05, 0.09);
        this.chirp(g, t, f, f1, d, 0.16); t += d + r.range(0.03, 0.06); f = f1;
      }
    } else { // distant soft whistle (dove / cuckoo-like)
      const f = r.range(560, 760) * base;
      this.chirp(g, 0, f * 1.1, f, 0.3, 0.2); this.chirp(g, 0.42, f * 0.9, f * 0.85, 0.38, 0.17);
      if (r.chance(0.5)) this.chirp(g, 0.95, f * 0.9, f * 0.85, 0.38, 0.14);
    }
  }
  crow(T) {
    if (this.active > this.maxActive) return;
    const r = this.rng;
    this._log('crow', T);
    const g = this.voice(T, r.range(-0.9, 0.9), 0.55);
    const n = r.int(2, 4), f0 = r.range(330, 430);
    for (let i = 0; i < n; i++) {
      const t = i * r.range(0.36, 0.5), d = r.range(0.2, 0.28), TT = g.T(t);
      const o = g.osc('sawtooth', f0, t, d + 0.05);
      o.frequency.setValueAtTime(f0 * 1.1, TT); o.frequency.exponentialRampToValueAtTime(f0 * 0.72, TT + d);
      const bp = g.filt('bandpass', 950, 2.2), lp = g.filt('lowpass', 2200, 0.7), e = g.gain(0);
      e.gain.setValueAtTime(0, TT); e.gain.linearRampToValueAtTime(0.35, TT + 0.025); e.gain.exponentialRampToValueAtTime(EPS, TT + d); e.gain.setValueAtTime(0, TT + d + 0.001);
      o.connect(bp); bp.connect(lp); lp.connect(e); e.connect(g.out);
      const nz = g.noise({ kind: 'pink', t, dur: d, a: 0.02, vol: 0.12, filters: [['bandpass', 1300, 1.5]] });
    }
  }
  rustle(T) {
    if (this.active > this.maxActive) return;
    const r = this.rng, dur = r.range(0.7, 1.4);
    this._log('rustle', T);
    const g = this.voice(T, r.range(-0.7, 0.7), 0.6);
    g.texture({ kind: 'white', t: 0, dur, curve: smoothCurve(dur, { rate: 40, smooth: 0.55, lo: 0, hi: 1, fadeIn: 0.3, fadeOut: 0.4, rng: r }), vol: 0.35, filters: [['bandpass', r.range(2200, 3200), 0.6], ['lowpass', 5000]] });
  }
}
