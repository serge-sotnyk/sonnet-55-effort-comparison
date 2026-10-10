// Age of Crowns - generative medieval / folk score.
//
// Three moods share one key / mode state (so crossfades are harmonically coherent) and each mood is an independent
// "Part": a bar-by-bar generator that queues note events and instantiates their nodes just-in-time (look-ahead
// scheduling driven by the AudioContext clock - see advance()). Moods crossfade (equal-ish power, 2-4 s) on a beat
// boundary of the outgoing part. Everything is seeded (Rng) so tests are reproducible, and nothing loops: sections
// pick new progressions, patterns, tunes and occasionally modulate (every few minutes).
//
//   peace : sparse lute arpeggios + soft strings pad + occasional recorder/flute tune + bell sparkle
//   tense : low drone, heartbeat frame drum, tremolo strings, sparse dark plucks, rare falling flute line
//   battle: driving frame drums (3+3+2 feel), low lute ostinato, brass stabs, shawm leads, timpani

import { Rng, Voice, mtof, clamp, EPS, envASR } from './synth.js';
import { lute, harp, flute, strings, brass, shawm, frameDrum, timpani, bell, shimmer } from './instruments.js';
import { MIX, LEVEL } from './mix.js';

export const MOODS = ['peace', 'tense', 'battle'];
const MODES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
};
// chord-root progressions per mode (0-based scale degrees; each chord lasts 2 bars => 8-bar section)
const PROGS = {
  dorian: [[0, 6, 0, 3], [0, 3, 6, 0], [0, 2, 6, 0], [0, 6, 3, 0], [0, 3, 0, 6], [0, 6, 0, 4]],
  aeolian: [[0, 5, 6, 0], [0, 6, 5, 4], [0, 3, 4, 0], [0, 5, 2, 6], [0, 2, 6, 0], [0, 6, 5, 6]],
  mixolydian: [[0, 6, 3, 0], [0, 3, 6, 0], [0, 6, 0, 3], [0, 4, 6, 0], [0, 3, 0, 6]],
  phrygian: [[0, 1, 0, 6], [0, 1, 2, 1], [0, 6, 5, 0], [0, 1, 0, 2], [0, 5, 1, 0]],
  ionian: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [0, 4, 5, 3], [0, 3, 1, 4]],
};
const BASE_MODES = ['dorian', 'dorian', 'mixolydian', 'mixolydian', 'aeolian', 'aeolian', 'ionian', 'phrygian'];
const TONICS = [2, 4, 9, 7, 0, 5, 11];           // D E A G C F B
export const BPM = { peace: 66, tense: 72, battle: 94 };
export { LEVEL };   // per-mood output scale (generated, see mix.js)
const FADE = { peace: 3.4, tense: 3.0, battle: 2.2 };   // seconds to fade IN to each mood
const FADE_OUT = { peace: 3.2, tense: 3.0, battle: 3.4 };

function modeFor(base, mood) {
  if (mood === 'peace') return base;
  if (mood === 'tense') return base === 'phrygian' ? 'phrygian' : 'aeolian';
  return (base === 'ionian' || base === 'mixolydian') ? 'dorian' : base;   // battle
}
/** lowest MIDI note >= A4 (69) with pitch class pc - anchor for melody registers */
const melBase = (pc) => 69 + ((pc - 9 + 12) % 12);

/** scale degree (any integer, 0 = tonic) -> MIDI note */
function deg2m(scale, tonic, deg) {
  const n = scale.length, oct = Math.floor(deg / n), i = ((deg % n) + n) % n;
  return tonic + 12 * oct + scale[i];
}

/* ------------------------------------------------------------------ small instruments local to the score */
/** dark drone: detuned saws through a slowly breathing lowpass + sub sine. */
function drone(g, { f, dur, vel = 1, dest }) {
  const T = g.T(0), len = dur + 7;
  const env = g.gain(0); envASR(env.gain, T, vel, 2.6, dur, 3.5);
  const lp = g.filt('lowpass', 520, 1.0);
  g.lfo(lp.frequency, 0.06, 140, 0, len);
  const mix = g.gain(0.35);
  for (const [type, fr, v] of [['sawtooth', f, 1], ['sawtooth', f * 1.0045, 0.8], ['sine', f, 0.9]]) {
    const o = g.osc(type, fr, 0, len); const gg = g.gain(v); o.connect(gg); gg.connect(mix);
  }
  mix.connect(lp); lp.connect(env); env.connect(dest || g.out);
}
/** soft sine pluck-ish tone for "ghost" bell pings */
function ghost(g, { f, vel = 1, dest }) {
  bell(g, { f, kind: 'tube', dur: 1.6, vol: 0.5 * vel, dest });
}

/* ------------------------------------------------------------------ Part base */
class Part {
  constructor(eng, mood, T) {
    this.eng = eng; this.ctx = eng.ctx; this.mood = mood; this.rng = eng.rng;
    this.beat = 60 / BPM[mood];
    this.t0 = T; this.nextBar = T; this.barNo = 0;
    this.q = []; this.fading = false; this.dead = false; this.deadline = Infinity;
    this.voices = new Set();
    const ctx = this.ctx;
    this.level = LEVEL[mood];
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(eng.M.musicDry);
    this.sendBus = ctx.createGain(); this.sendBus.gain.value = 0; this.sendBus.connect(eng.M.musicRevIn);
    this.sec = null;
  }
  nextBeat(x) { return this.t0 + Math.max(0, Math.ceil((x - this.t0) / this.beat - 1e-6)) * this.beat; }

  fadeIn(T, dur) {
    for (const g of [this.bus.gain, this.sendBus.gain]) {
      g.cancelScheduledValues(T);
      g.setValueAtTime(0, T);
      g.setTargetAtTime(this.level, T, dur / 4);
    }
  }
  retire(T, dur) {
    this.fading = true; this.q.length = 0;
    for (const g of [this.bus.gain, this.sendBus.gain]) {
      g.cancelScheduledValues(T);
      g.setTargetAtTime(0, T, dur / 4);
    }
    this.deadline = T + dur + 5.5;   // let reverb / long notes ring out invisibly
  }
  dispose() {
    this.dead = true; this.q.length = 0;
    for (const v of [...this.voices]) v.kill(0.03);      // silent by now (bus faded) - free the nodes immediately
    this.voices.clear();
    try { this.bus.disconnect(); this.sendBus.disconnect(); } catch (e) { /* ignore */ }
  }

  add(t, fn) { this.q.push({ t, fn }); }
  run(until, now) {
    if (this.fading || this.dead) return;
    // the scheduler fell far behind (background tab / long stall): skip whole bars instead of playing a burst of old notes
    const barDur = 4 * this.beat;
    if (now != null && now - this.nextBar > barDur * 1.5) {
      const k = Math.floor((now - this.nextBar) / barDur);
      this.nextBar += k * barDur; this.barNo += k; this.q.length = 0;
    }
    while (this.nextBar < until + 0.02) this.generateBar();
    const q = this.q;
    if (q.length > 1) q.sort((a, b) => a.t - b.t);
    let n = 0;
    while (n < q.length && q[n].t < until) {
      if (now == null || q[n].t > now - 0.3) { try { q[n].fn(q[n].t); } catch (e) { console.warn('[music]', e); } }
      n++;
    }
    if (n) q.splice(0, n);
  }
  generateBar() {
    const bar = this.barNo, t = this.nextBar;
    if (bar % 8 === 0) { this.eng.maybeModulate(t); this.planSection(bar); }
    this.writeBar(t, bar % 8);
    this.nextBar += 4 * this.beat; this.barNo++;
  }

  /** key snapshot + progression for the next 8 bars */
  plan(mood = this.mood) {
    const r = this.rng, key = this.eng.key;
    const mode = modeFor(key.mode, mood), scale = MODES[mode];
    const progs = PROGS[mode], prog = progs[r.int(0, progs.length - 1)];
    return { mode, scale, tonic: 36 + key.pc, prog, chords: prog.map(d => this.chord(scale, 36 + key.pc, d)) };
  }
  /** chord from root degree d: { root degree, notes (MIDI) triad + octave extension, degs } */
  chord(scale, tonic, d) {
    const degs = [d, d + 2, d + 4, d + 7, d + 9, d + 11];
    return { d, degs, notes: degs.map(x => deg2m(scale, tonic, x)) };
  }
  chordAt(barInSec) { return this.sec.chords[Math.min(3, barInSec >> 1)]; }

  /**
   * Weighted random-walk tune with antecedent / consequent structure (call and response).
   * chords: [chordForFirstHalf, chordForSecondHalf] (each covers 2 bars; one entry for a 2-bar fast tune)
   * returns [{t (beats from the tune start), deg (scale degree, 0 = tonic), dur (beats)}]
   */
  genTune(chords, o = {}) {
    const r = this.rng, fast = !!o.fast;
    const RH = fast
      ? [[.5, .5, .5, .5, 1, 1], [.5, .5, 1, .5, .5, 1], [1, .5, .5, .5, .5, 1], [.5, .5, .5, .5, .5, .5, .5, .5], [.5, .25, .25, .5, .5, 1, 1], [.25, .25, .5, .5, .5, 1, 1]]
      : [[1, .5, .5, 1, 1, 1, 2, 1], [1.5, .5, 1, 1, 1.5, .5, 2], [.5, .5, 1, 2, .5, .5, 1, 2], [2, 1, 1, 2, 1, 1], [1, 1, 1, 1, .5, .5, 1, 2], [1, .5, .5, 2, 1, .5, .5, 2]];
    const H = fast ? 2 : 4;                                   // beats per half-template
    const split = (tm) => { const a1 = [], a2 = []; let c = 0; for (const d of tm) { (c < H - 1e-6 ? a1 : a2).push(d); c += d; } return [a1, a2]; };
    const [a1, a2] = split(r.pick(RH)), [, b2] = split(r.pick(RH));
    const phrases = [a1.concat(a2), a1.concat(b2)];
    const lo = o.lo == null ? -2 : o.lo, hi = o.hi == null ? 7 : o.hi, center = o.center == null ? 2 : o.center;
    const chordOf = (bar) => chords[Math.min(chords.length - 1, bar >> 1)];
    const tones = (bar) => { const c = chordOf(bar); return [c.d, c.d + 2, c.d + 4].map(x => ((x % 7) + 7) % 7); };
    const nearestPC = (deg, pcs) => { let best = deg, bd = 99; for (let x = deg - 4; x <= deg + 4; x++) { if (pcs.includes(((x % 7) + 7) % 7) && Math.abs(x - deg) < bd) { bd = Math.abs(x - deg); best = x; } } return best; };
    const steps = [-3, -2, -1, 0, 1, 2, 3], W = [0.04, 0.14, 0.30, 0.07, 0.30, 0.12, 0.03];
    const phraseLen = H * 2;
    let deg = nearestPC(center + 2, tones(0));
    const out = [];
    phrases.forEach((phrase, pi) => {
      let t = pi * phraseLen;
      phrase.forEach((d, i) => {
        const bar = Math.floor(t / 4), last = i === phrase.length - 1, first = (pi === 0 && i === 0);
        if (!first) {
          const drift = clamp((center - deg) / 4, -1, 1);
          const w = steps.map((st, k) => W[k] * ((st * drift > 0) ? 1 + 0.9 * Math.abs(drift) : (st * drift < 0 ? 1 - 0.5 * Math.abs(drift) : 1)));
          deg = clamp(deg + r.weighted(steps, w), lo, hi);
        }
        const onBeat = (t % 4 === 0) || (t % 4 === 2);
        if (!first && onBeat && r.chance(0.6)) deg = nearestPC(deg, tones(bar));
        if (last) {
          if (pi === 0) { const c = chordOf(bar); deg = nearestPC(deg, [(c.d + 2) % 7, (c.d + 4) % 7]); }   // half cadence: third / fifth
          else deg = nearestPC(deg, [0]);                                                                // full cadence: tonic
        }
        deg = clamp(deg, lo, hi);
        out.push({ t, deg, dur: d });
        t += d;
      });
    });
    return out;
  }
}

/* ------------------------------------------------------------------ PEACE */
const LUTE_PATTERNS = [
  [0, 2, 3, 2, 1, 2, 3, 2], [0, 2, 1, 2, 3, 2, 1, 2], [0, -1, 2, 3, -1, 2, 1, -1], [0, 2, 4, 2, 3, 2, 1, 2],
  [0, 2, 1, 2, 0, 2, 1, 2], [0, -1, 3, -1, 2, -1, 3, 2], [0, 1, 2, 3, 2, 1, 2, 4], [0, 2, 3, 4, 3, 2, 3, 1],
];
class PeacePart extends Part {
  planSection() {
    const r = this.rng, s = this.plan('peace');
    s.pats = []; s.rest = r.chance(0.4) ? r.int(1, 7) : -1;
    let p = r.pick(LUTE_PATTERNS);
    for (let i = 0; i < 8; i++) { if (i % 2 === 0 && r.chance(0.55)) p = r.pick(LUTE_PATTERNS); s.pats.push(p); }
    // recorder tune in the first or second half (most sections)
    s.tune = null; s.tuneBar = r.chance(0.5) ? 0 : 4;
    if (this.eng.force.has('flute') || r.chance(0.62)) s.tune = this.genTune([s.chords[s.tuneBar >> 1], s.chords[(s.tuneBar >> 1) + 1]], { lo: -2, hi: 7, center: 2 });
    s.drone = this.eng.force.has('drone') || r.chance(0.35);
    s.sparkle = this.eng.force.has('ghost') ? 0.7 : r.chance(0.5) ? 0.14 : 0.05;
    s.mel = melBase(this.eng.key.pc);
    this.sec = s;
  }
  writeBar(t, b) {
    const eng = this.eng, r = this.rng, s = this.sec, beat = this.beat, ch = this.chordAt(b), sc = s.scale;
    const notes = ch.notes.map(m => m + 12);                    // lute register (D3..A4 for D)
    const pat = (b === s.rest) ? [0, -1, -1, -1, 2, -1, -1, -1] : s.pats[b];
    const step = beat / 2;
    for (let i = 0; i < 8; i++) {
      const idx = pat[i];
      if (idx < 0) continue;
      if (b !== s.rest && r.chance(0.07)) continue;              // a few dropped notes
      const m = notes[idx];
      const accent = (i === 0 || i === 4) ? 0.74 : 0.5;
      const T = t + i * step + r.range(-0.006, 0.01);
      this.add(T, (tt) => eng.lute(this, tt, m, accent * r.range(0.86, 1.1), { send: 0.3 }));
      if (b !== s.rest && r.chance(0.04)) {                      // neighbour tone
        const m2 = deg2m(sc, s.tonic + 12, ch.degs[idx % 3] + r.pick([-1, 1]));
        this.add(T + step * 0.5, (tt) => eng.lute(this, tt, m2, 0.38, { send: 0.3 }));
      }
    }
    // bass note on 1 (and sometimes 3)
    this.add(t, (tt) => eng.lute(this, tt, ch.notes[0], 0.66, { send: 0.22, lp: 1500, t60: 2.1 }));
    if (r.chance(0.5)) this.add(t + 2 * beat, (tt) => eng.lute(this, tt, ch.notes[2], 0.5, { send: 0.22, lp: 1400, t60: 1.8 }));
    // pad: a chord every two bars, slow attack
    if (b % 2 === 0) {
      const dur = 8 * beat + 0.8;
      const open = r.chance(0.3);                                // open fifth (no third) - medieval colour
      const pn = (open ? [ch.notes[0], ch.notes[2], ch.notes[3]] : [ch.notes[0], ch.notes[1], ch.notes[2], ch.notes[3]]).map(m => m + 12);
      pn.forEach((m, k) => this.add(t + 0.01 * k, (tt) => eng.pad(this, tt, m, dur, 0.17, { send: 0.45 })));
    }
    // recorder tune
    if (s.tune) {
      const rel = b - s.tuneBar;
      if (rel >= 0 && rel < 4) {
        for (const n of s.tune) {
          if (Math.floor(n.t / 4) !== rel) continue;
          const T = t + (n.t - rel * 4) * beat + r.range(-0.01, 0.015);
          const m = deg2m(sc, s.mel, n.deg);
          this.add(T, (tt) => eng.flute(this, tt, m, n.dur * beat * 0.93, 0.5 * r.range(0.9, 1.1), { send: 0.5 }));
        }
      }
    }
    if (b === 0 && s.drone) this.add(t, (tt) => eng.drone(this, tt, ch.notes[0] + 12, 8 * 4 * beat - 2, 0.25));
    if (r.chance(s.sparkle)) {                                   // bell sparkle
      const T = t + r.int(0, 7) * step;
      const m = deg2m(sc, s.mel + (r.chance(0.4) ? 12 : 0), ch.degs[r.int(0, 2)]);
      this.add(T, (tt) => eng.ghost(this, tt, m, 0.5));
    }
  }
}

/* ------------------------------------------------------------------ TENSE */
class TensePart extends Part {
  planSection() {
    const r = this.rng, s = this.plan('tense');
    s.flute = (this.eng.force.has('flute') || r.chance(0.3)) ? r.int(2, 5) : -1;
    s.intense = r.chance(0.5);
    s.pluckProb = r.range(0.2, 0.42);
    s.mel = melBase(this.eng.key.pc);
    this.sec = s;
  }
  writeBar(t, b) {
    const eng = this.eng, r = this.rng, s = this.sec, beat = this.beat, ch = this.chordAt(b), sc = s.scale;
    if (b === 0) {
      this.add(t, (tt) => eng.drone(this, tt, ch.notes[0] + 12, 8 * 4 * beat - 1, 0.55));
      this.add(t + 0.2, (tt) => eng.drone(this, tt, ch.notes[2] + 12, 8 * 4 * beat - 1, 0.32));
      if (r.chance(0.6)) this.add(t + 0.5, (tt) => eng.ghost(this, tt, deg2m(sc, s.mel, r.pick([0, 1, 4])), 0.4));
    }
    // heartbeat: lub-dub every bar (louder / doubled toward the end of intense sections)
    const hv = 0.8 + (s.intense && b >= 5 ? 0.15 : 0);
    this.add(t, (tt) => eng.drum(this, tt, 'heart', hv * r.range(0.92, 1.05), 140));
    this.add(t + beat * 0.5 + r.range(-0.005, 0.008), (tt) => eng.drum(this, tt, 'heart', hv * 0.62, 128));
    if (s.intense && b >= 5) {
      this.add(t + beat * 2, (tt) => eng.drum(this, tt, 'heart', hv * 0.8, 140));
      this.add(t + beat * 2.5, (tt) => eng.drum(this, tt, 'heart', hv * 0.5, 128));
    }
    // tremolo strings: a chord every 2 bars
    if (b % 2 === 0) {
      const dur = 8 * beat + 0.6;
      const tones = [ch.notes[0] + 12, ch.notes[2] + 12, ch.notes[3] + 12, deg2m(sc, s.tonic, ch.d + (s.mode === 'phrygian' ? 1 : 3)) + 24];
      tones.forEach((m, k) => this.add(t + 0.02 * k, (tt) => eng.str(this, tt, m, dur, 0.17, { trem: 6.5 + k * 0.4, send: 0.5 })));
    }
    // sparse dark plucks
    for (let i = 0; i < 8; i++) {
      if (!r.chance(s.pluckProb * (i % 2 === 0 ? 1 : 0.5))) continue;
      const m = ch.notes[r.pick([0, 0, 1, 2, 2])] + (r.chance(0.25) ? 12 : 0) + 12;
      this.add(t + i * beat / 2 + r.range(0, 0.012), (tt) => eng.lute(this, tt, m, 0.5 * r.range(0.8, 1.1), { lp: 1100, t60: 1.2, send: 0.4 }));
    }
    // rare falling flute line
    if (s.flute === b) {
      let deg = r.pick([4, 5, 7]);
      for (let k = 0; k < 3; k++) {
        const m = deg2m(sc, s.mel, deg);
        this.add(t + k * 2 * beat, (tt) => eng.flute(this, tt, m, 1.85 * beat, 0.34, { send: 0.6, vib: 16 }));
        deg -= r.pick([1, 1, 2]);
      }
    }
  }
}

/* ------------------------------------------------------------------ BATTLE */
const DRUM_PATTERNS = [
  'D..tD.t.D..tD.tD', 'D.t.s.t.D.t.s.tt', 'D..DD.t.D..DD.tt', 'D.tsD.tsD.tsD.ts', 'D.t.D.s.D.tsD.t.', 'Dt.tD.stD.t.D.st',
];
const OSTINATOS = [
  [0, -1, 0, 4, -1, 0, 6, 4], [0, 0, 4, 0, 0, 0, 6, 5], [0, -1, 4, -1, 0, -1, 6, -1], [0, 0, -1, 4, 0, -1, 6, 4], [0, -1, 0, 4, 0, -1, 3, 4],
];
class BattlePart extends Part {
  planSection() {
    const r = this.rng, s = this.plan('battle');
    s.drums = []; let p = r.pick(DRUM_PATTERNS);
    for (let i = 0; i < 8; i++) { if (i % 2 === 0 && r.chance(0.5)) p = r.pick(DRUM_PATTERNS); s.drums.push(p); }
    s.ost = r.pick(OSTINATOS);
    s.leadBars = r.chance(0.8) ? [2, 6] : [4];
    s.tune = this.genTune([s.chords[1]], { fast: true, lo: 0, hi: 7, center: 3 });
    s.tune2 = this.genTune([s.chords[3]], { fast: true, lo: 0, hi: 7, center: 3 });
    s.mel = melBase(this.eng.key.pc) - 12;
    this.sec = s;
  }
  writeBar(t, b) {
    const eng = this.eng, r = this.rng, s = this.sec, beat = this.beat, ch = this.chordAt(b), sc = s.scale;
    const six = beat / 4, eighth = beat / 2;
    // ---- drums (16th grid) with a roll in the last bar of the section
    const fill = (b === 7), pat = s.drums[b];
    for (let i = 0; i < 16; i++) {
      let c = pat[i];
      if (fill && i >= 12) c = i === 12 ? 's' : (i % 2 ? 't' : 's');
      if (c === '.') { if (r.chance(0.06) && i % 2) c = 't'; else continue; }
      const T = t + i * six + r.range(-0.004, 0.006);
      const kind = c === 'D' ? 'doum' : c === 's' ? 'slap' : 'tek';
      const vel = (c === 'D' ? 1.0 : c === 's' ? 0.65 : 0.45) * r.range(0.85, 1.1) * (fill && i >= 12 ? 0.7 + 0.05 * (i - 12) : 1);
      this.add(T, (tt) => eng.drum(this, tt, kind, vel, kind === 'doum' ? 150 : 180));
    }
    if (b === 0) this.add(t, (tt) => eng.timp(this, tt, ch.notes[0] + 12, 0.85));
    else if (b % 2 === 0) this.add(t, (tt) => eng.timp(this, tt, ch.notes[0] + 12, 0.6));
    // ---- low ostinato (3+3+2 feel)
    for (let i = 0; i < 8; i++) {
      const o = s.ost[i];
      if (o < 0) continue;
      const m = deg2m(sc, s.tonic + 12, ch.d + o);
      const acc = (i === 0 || i === 3 || i === 6) ? 0.75 : 0.5;
      this.add(t + i * eighth + r.range(-0.004, 0.006), (tt) => eng.lute(this, tt, m, acc * r.range(0.85, 1.08), { lp: 2000, t60: 0.55, send: 0.15 }));
    }
    // ---- brass stabs on the 3+3+2 accents (open fifths)
    for (const [i, p] of [[0, 0.8], [3, 0.5], [6, 0.5]]) {
      if (!r.chance(p) && !(b === 0 && i === 0)) continue;
      const m = ch.notes[0] + 12 + (r.chance(0.4) ? 12 : 0), T = t + i * eighth;
      this.add(T, (tt) => { eng.stab(this, tt, m, 0.9 * r.range(0.85, 1.1)); eng.stab(this, tt, m + 7, 0.65); });
    }
    // ---- string power chord pad (2 bars)
    if (b % 2 === 0) {
      const dur = 8 * beat + 0.3;
      [ch.notes[0], ch.notes[2], ch.notes[3]].map(m => m + 12).forEach((m, k) => this.add(t + 0.01 * k, (tt) => eng.str(this, tt, m, dur, 0.17, { trem: 7.2, send: 0.2 })));
    }
    // ---- shawm lead: answering 2-bar phrases
    s.leadBars.forEach((lb, li) => {
      const tune = li === 0 ? s.tune : s.tune2, rel = b - lb;
      if (rel < 0 || rel >= 2) return;
      for (const n of tune) {
        if (Math.floor(n.t / 4) !== rel) continue;
        const T = t + (n.t - rel * 4) * beat + r.range(-0.006, 0.01);
        const m = deg2m(sc, s.mel, n.deg);
        this.add(T, (tt) => eng.lead(this, tt, m, n.dur * beat * 0.9, 0.5 * r.range(0.9, 1.1)));
      }
    });
    if (b === 0 && r.chance(0.7)) this.add(t, (tt) => eng.cymbal(this, tt, 0.35));
  }
}

/* ------------------------------------------------------------------ engine */
export class MusicEngine {
  constructor(ctx, M, o = {}) {
    this.ctx = ctx; this.M = M; this.rng = new Rng(o.seed);
    this.parts = []; this.mood = 'peace'; this.running = false;
    this.key = { pc: 2, mode: 'dorian' }; this.keyChangeAt = Infinity;
    this.active = 0;
    this.log = o.log ? [] : null;
    this.solo = o.solo ? new Set(o.solo) : null;   // test hook: only these instrument names sound
    this.force = new Set(o.force || []);            // test hook: always include these optional instruments
    this.sections = 0; this.keyLog = [];
    this.maxActive = o.maxActive == null ? 56 : o.maxActive;   // real-time safety valve (offline renders pass Infinity)
  }

  pickKey(prev) {
    const r = this.rng;
    let pc;
    if (!prev) pc = r.pick(TONICS);
    else { // related keys: up a 4th/5th, a tone up/down
      const moves = [5, 7, 2, -2, 5, 7];
      pc = (((prev.pc + r.pick(moves)) % 12) + 12) % 12;
    }
    const mode = r.pick(BASE_MODES);
    return { pc, mode };
  }
  maybeModulate(T) {
    if (T >= this.keyChangeAt) { this.key = this.pickKey(this.key); this.keyChangeAt = T + this.rng.range(140, 260); this.sections = 0; this.keyLog.push({ t: +T.toFixed(1), pc: this.key.pc, mode: this.key.mode }); }
  }

  start(mood = 'peace', at) {
    if (this.running) { this.setMood(mood, at); return; }
    const T = (at == null ? this.ctx.currentTime : at) + 0.08;
    this.running = true; this.mood = MOODS.includes(mood) ? mood : 'peace';
    this.key = this.pickKey(null);
    this.keyChangeAt = T + this.rng.range(140, 260);
    this.keyLog.push({ t: +T.toFixed(1), pc: this.key.pc, mode: this.key.mode });
    this._spawn(this.mood, T, FADE[this.mood] * 0.8, false);
  }
  stop(at, fade = 1.6) {
    const T = at == null ? this.ctx.currentTime : at;
    this.running = false;
    for (const p of this.parts) if (!p.fading && !p.dead) p.retire(T, fade);
  }
  setMood(mood, at) {
    if (!MOODS.includes(mood)) return;
    this.mood = mood;
    if (!this.running) return;
    const cur = this.parts.find(p => !p.fading && !p.dead);
    if (cur && cur.mood === mood) return;
    let T = (at == null ? this.ctx.currentTime : at) + 0.1;
    if (cur) { T = cur.nextBeat(T); cur.retire(T, FADE_OUT[cur.mood] * (mood === 'battle' ? 0.8 : 1)); }
    this._spawn(mood, T, FADE[mood], true);
  }
  _spawn(mood, T, fade, flourish) {
    const P = mood === 'battle' ? BattlePart : mood === 'tense' ? TensePart : PeacePart;
    const part = new P(this, mood, T);
    part.fadeIn(T, fade);
    if (flourish && mood === 'battle') { part.add(T, (tt) => { this.drum(part, tt, 'boom', 0.9, 80); this.cymbal(part, tt, 0.3); }); }
    this.parts.push(part);
  }
  /** schedule everything due before `until` (absolute ctx time); `now` is used to retire finished parts */
  advance(until, now = this.ctx.currentTime, lagGuard = true) {
    for (const p of this.parts) p.run(until, lagGuard ? now : null);
    if (this.parts.some(p => now > p.deadline)) {
      this.parts = this.parts.filter(p => { if (now > p.deadline) { p.dispose(); return false; } return true; });
    }
  }
  get busy() { return this.parts.length > 0; }
  dispose() { for (const p of this.parts) p.dispose(); this.parts = []; this.running = false; }

  /* ---- note factories (all create a short-lived Voice) ---- */
  on(name) { return !this.solo || this.solo.has(name); }
  voice(part, T, send = 0.2, inst = '') {
    this.active++;
    const vol = MIX[part.mood + '.' + inst] == null ? 1 : MIX[part.mood + '.' + inst];
    const v = new Voice(this.ctx, part.bus, Math.max(T, this.ctx.currentTime), { vol, send: part.sendBus, sendAmt: send, onDispose: (x) => { this.active--; part.voices.delete(x); } });
    part.voices.add(v);
    return v;
  }
  _log(part, inst, T, midi, vel, dur) { if (this.log) this.log.push({ part: part.mood, inst, t: +T.toFixed(3), midi, vel: +vel.toFixed(2), dur: dur == null ? null : +dur.toFixed(3) }); }
  lute(part, T, midi, vel, o = {}) {
    if (!this.on('lute')) return;
    if (this.active > this.maxActive) return;
    this._log(part, 'lute', T, midi, vel);
    const v = this.voice(part, T, o.send == null ? 0.25 : o.send, 'lute');
    lute(v, { f: mtof(midi), t: 0, vel: clamp(vel, 0.05, 1), lp: o.lp, t60: o.t60 });
  }
  pad(part, T, midi, dur, vel, o = {}) {
    if (!this.on('pad')) return;
    this._log(part, 'pad', T, midi, vel, dur);
    const v = this.voice(part, T, o.send == null ? 0.4 : o.send, 'pad');
    strings(v, { f: mtof(midi), t: 0, dur, vel, a: 1.5, r: 1.8, bright: 0.8 });
  }
  str(part, T, midi, dur, vel, o = {}) {
    if (!this.on('str')) return;
    this._log(part, 'str', T, midi, vel, dur);
    const v = this.voice(part, T, o.send == null ? 0.4 : o.send, 'str');
    strings(v, { f: mtof(midi), t: 0, dur, vel, a: 1.1, r: 1.6, bright: 0.75, trem: o.trem });
  }
  flute(part, T, midi, dur, vel, o = {}) {
    if (!this.on('flute')) return;
    if (this.active > this.maxActive) return;
    this._log(part, 'flute', T, midi, vel, dur);
    const v = this.voice(part, T, o.send == null ? 0.5 : o.send, 'flute');
    flute(v, { f: mtof(midi), t: 0, dur: Math.max(0.12, dur), vel, vibDepth: o.vib });
  }
  lead(part, T, midi, dur, vel) {
    if (!this.on('shawm')) return;
    if (this.active > this.maxActive) return;
    this._log(part, 'shawm', T, midi, vel, dur);
    const v = this.voice(part, T, 0.25, 'shawm');
    shawm(v, { f: mtof(midi), t: 0, dur: Math.max(0.1, dur), vel, a: 0.02, r: 0.08 });
  }
  stab(part, T, midi, vel) {
    if (!this.on('brass')) return;
    this._log(part, 'brass', T, midi, vel, 0.16);
    const v = this.voice(part, T, 0.2, 'brass');
    brass(v, { f: mtof(midi), t: 0, dur: 0.14, vel: vel * 0.5, a: 0.012, r: 0.1, bright: 0.85, vib: 0, scoop: 0.01 });
  }
  drum(part, T, kind, vel, f) {
    if (!this.on('drum')) return;
    this._log(part, 'drum:' + kind, T, null, vel);
    const v = this.voice(part, T, kind === 'heart' ? 0.1 : 0.2, 'drum');
    frameDrum(v, { kind, vel: vel * 0.8, f, t: 0 });
  }
  timp(part, T, midi, vel) {
    if (!this.on('timp')) return;
    this._log(part, 'timp', T, midi, vel);
    const v = this.voice(part, T, 0.25, 'timp');
    timpani(v, { f: mtof(midi), vel: vel * 0.75, t: 0 });
  }
  cymbal(part, T, vel) { if (!this.on('cymbal')) return; const v = this.voice(part, T, 0.3, 'cymbal'); shimmer(v, { t: 0, dur: 1.2, vol: vel * 0.5 }); }
  drone(part, T, midi, dur, vel) {
    if (!this.on('drone')) return;
    this._log(part, 'drone', T, midi, vel, dur);
    const v = this.voice(part, T, 0.3, 'drone');
    drone(v, { f: mtof(midi), dur, vel });
  }
  ghost(part, T, midi, vel) {
    if (!this.on('ghost')) return;
    this._log(part, 'ghost', T, midi, vel);
    const v = this.voice(part, T, 0.6, 'ghost');
    ghost(v, { f: mtof(midi), vel });
  }
}
