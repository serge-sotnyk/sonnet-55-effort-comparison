// Age of Crowns - instrument voices shared by the SFX fanfares and the generative score.
// Every function takes a Voice `g` (synth.js) and an options object with RELATIVE start time `t`.

import { envPerc, envASR, rand, rnd, jit, clamp, dbg, getWave, pluckBuffer, crackleCurve, EPS } from './synth.js';

/* ------------------------------------------------------------------ brass / horn */
/** Trumpet / horn-like note: detuned saws -> lowpass with "blat" envelope -> body formant. */
export function brass(g, o) {
  const f = o.f, t = o.t || 0, dur = Math.max(0.08, o.dur || 0.6);
  const vel = o.vel == null ? 1 : o.vel, a = o.a == null ? 0.06 : o.a, r = o.r == null ? 0.16 : o.r;
  const bright = o.bright == null ? 1 : o.bright;
  const dest = o.dest || g.out, T = g.T(t);
  const env = g.gain(0);
  envASR(env.gain, T, vel, a, dur, r, o.sus == null ? 0.84 : o.sus);
  const lp = g.filt('lowpass', 800, 0.9);
  const top = clamp(f * 6.5 * bright, 900, 3000), sus = clamp(f * 3.4 * bright, 650, 2100);
  lp.frequency.setValueAtTime(clamp(f * 1.6, 180, 1200), T);
  lp.frequency.linearRampToValueAtTime(top, T + a * 1.3 + 0.02);
  lp.frequency.exponentialRampToValueAtTime(sus, T + a * 1.3 + 0.32);
  const body = g.filt('peaking', o.body || 850, 0.9, 4.5);
  lp.connect(body); body.connect(env); env.connect(dest);
  const scoop = o.scoop == null ? 0.028 : o.scoop;
  const mix = g.gain(0.5);
  for (let i = 0; i < 2; i++) {
    const osc = g.osc('sawtooth', f, t, dur + r + 0.06);
    osc.detune.value = (i ? 1 : -1) * (o.det == null ? 5 : o.det);
    if (scoop) { osc.frequency.setValueAtTime(f * (1 - scoop), T); osc.frequency.linearRampToValueAtTime(f, T + 0.06 + a * 0.5); }
    if (dur > 0.55 && o.vib !== 0) g.lfo(osc.detune, 5.2 + i * 0.3, 6, t + 0.3, dur + r, { fadeIn: 0.4 });
    osc.connect(mix);
  }
  mix.connect(lp);
  // lip-buzz / breath at the attack
  g.noise({ t, dur: 0.05 + a * 0.4, a: 0.004, vol: 0.06 * vel, filters: [['bandpass', clamp(f * 5, 1200, 3500), 1.1]], dest });
  return env;
}

/** Big round war horn (lower, darker, slower attack, octave sub). */
export function horn(g, o) {
  const f = o.f, t = o.t || 0, dur = o.dur || 0.7, vel = o.vel == null ? 1 : o.vel;
  const dest = o.dest || g.out;
  brass(g, { f, t, dur, vel, a: o.a == null ? 0.09 : o.a, r: o.r == null ? 0.3 : o.r, bright: 0.62, body: 520, scoop: 0.06, dest, vib: o.vib, det: 4 });
  g.tone({ type: 'triangle', f: f / 2, t, dur, a: 0.1, r: 0.25, vol: 0.22 * vel, dest });
}

/* ------------------------------------------------------------------ strings / pads */
/** Ensemble string note: 3 detuned saws, slow attack, lowpass. */
export function strings(g, o) {
  const f = o.f, t = o.t || 0, dur = Math.max(0.2, o.dur || 1);
  const vel = o.vel == null ? 1 : o.vel, a = o.a == null ? 0.3 : o.a, r = o.r == null ? 0.5 : o.r;
  const dest = o.dest || g.out, T = g.T(t);
  const env = g.gain(0);
  envASR(env.gain, T, vel, a, dur, r);
  const lp = g.filt('lowpass', clamp(f * 5, 900, 2500) * (o.bright || 1), 0.5);
  if (o.cutLfo) g.lfo(lp.frequency, o.cutLfo[0], o.cutLfo[1], t, dur + r + 0.1);
  const ens = g.gain(0.36);
  const cents = o.wide ? [-14, 0, 14] : [-9, 0, 9];
  for (let i = 0; i < 3; i++) {
    const osc = g.osc('sawtooth', f, t, dur + r + 0.06);
    osc.detune.value = cents[i] + rand(-2, 2);
    g.lfo(osc.detune, 4.6 + i * 0.8 + rand(0, 0.4), 4, t, dur + r + 0.06);
    osc.connect(ens);
  }
  if (o.trem) { // tremolo strings (suspense)
    const tg = g.gain(1);
    tg.gain.value = 0.6;
    g.lfo(tg.gain, o.trem, 0.38, t, dur + r + 0.1);
    ens.connect(lp); lp.connect(tg); tg.connect(env);
  } else { ens.connect(lp); lp.connect(env); }
  env.connect(dest);
  return env;
}

/** Soft choir-ish pad note (strings through formant peaks). */
export function padChoir(g, o) {
  const f = o.f, t = o.t || 0, dur = Math.max(0.5, o.dur || 2);
  const vel = o.vel == null ? 1 : o.vel, a = o.a == null ? 0.8 : o.a, r = o.r == null ? 1.0 : o.r;
  const dest = o.dest || g.out, T = g.T(t);
  const env = g.gain(0);
  envASR(env.gain, T, vel, a, dur, r);
  const lp = g.filt('lowpass', clamp(f * 4, 700, 2000), 0.5);
  const f1 = g.filt('peaking', 520, 2, 5), f2 = g.filt('peaking', 1050, 2.2, 4);
  const mix = g.gain(0.4);
  for (let i = 0; i < 3; i++) {
    const osc = g.osc('sawtooth', f, t, dur + r + 0.06);
    osc.detune.value = (i - 1) * 8 + rand(-2, 2);
    g.lfo(osc.detune, 4.8 + i * 0.7, 5, t + 0.3, dur + r, { fadeIn: 0.8 });
    osc.connect(mix);
  }
  mix.connect(lp); lp.connect(f1); f1.connect(f2); f2.connect(env); env.connect(dest);
  return env;
}

/* ------------------------------------------------------------------ woodwinds */
/** Flute / recorder: sine + a touch of 2nd/3rd harmonic, delayed vibrato, breath noise, chiff. */
export function flute(g, o) {
  const f = o.f, t = o.t || 0, dur = Math.max(0.1, o.dur || 0.6);
  const vel = o.vel == null ? 1 : o.vel, a = o.a == null ? 0.05 : o.a, r = o.r == null ? 0.14 : o.r;
  const dest = o.dest || g.out, T = g.T(t);
  const env = g.gain(0);
  envASR(env.gain, T, vel, a, dur, r, 0.92);
  const lp = g.filt('lowpass', clamp(f * 4.2, 1800, 4200), 0.5);
  lp.connect(env); env.connect(dest);
  const mix = g.gain(0.55);
  mix.connect(lp);
  const o1 = g.osc(getWave(g.ctx, 'soft'), f, t, dur + r + 0.05);
  o1.frequency.setValueAtTime(f * 1.012, T); o1.frequency.exponentialRampToValueAtTime(f, T + 0.05);
  if (o.glideFrom) { o1.frequency.cancelScheduledValues(T); o1.frequency.setValueAtTime(o.glideFrom, T); o1.frequency.exponentialRampToValueAtTime(f, T + 0.07); }
  if (dur > 0.3) g.lfo(o1.detune, 5.0 + rand(-0.4, 0.5), o.vibDepth == null ? 11 : o.vibDepth, t + 0.18, dur + r, { fadeIn: 0.3 });
  o1.connect(mix);
  const o2 = g.osc('triangle', f * 2, t, dur + r + 0.05);
  const g2 = g.gain(0.09); o2.connect(g2); g2.connect(mix);
  // breath
  const br = g.noise({ kind: 'pink', t, dur: dur + r, r: 0.05, a: 0.02, vol: 0.05 * vel, filters: [['bandpass', clamp(f * 2.6, 1500, 4000), 1.3]], dest: lp });
  g.noise({ kind: 'white', t, dur: 0.06, a: 0.004, vol: 0.12 * vel, filters: [['bandpass', clamp(f * 3, 2000, 4500), 1.5]], dest: lp });
  return env;
}

/** Shawm / crumhorn-like double reed (nasal, reedy). */
export function shawm(g, o) {
  const f = o.f, t = o.t || 0, dur = Math.max(0.08, o.dur || 0.4);
  const vel = o.vel == null ? 1 : o.vel, a = o.a == null ? 0.03 : o.a, r = o.r == null ? 0.1 : o.r;
  const dest = o.dest || g.out, T = g.T(t);
  const env = g.gain(0);
  envASR(env.gain, T, vel, a, dur, r, 0.9);
  const osc = g.osc(getWave(g.ctx, 'reed'), f, t, dur + r + 0.05);
  const osc2 = g.osc(getWave(g.ctx, 'reed'), f, t, dur + r + 0.05); osc2.detune.value = 7;
  osc.frequency.setValueAtTime(f * 0.985, T); osc.frequency.linearRampToValueAtTime(f, T + 0.04);
  if (dur > 0.35) g.lfo(osc.detune, 5.4, 9, t + 0.15, dur + r, { fadeIn: 0.25 });
  const mix = g.gain(0.5); osc.connect(mix); osc2.connect(mix);
  const p1 = g.filt('peaking', clamp(f * 3.1, 900, 1600), 2.2, 7);
  const p2 = g.filt('peaking', 2300, 2, 3);
  const lp = g.filt('lowpass', 3600, 0.6);
  mix.connect(p1); p1.connect(p2); p2.connect(lp); lp.connect(env); env.connect(dest);
  return env;
}

/* ------------------------------------------------------------------ plucked strings */
/** Lute / guitar-ish pluck (Karplus-Strong buffer computed in JS). */
export function lute(g, o) {
  const f = o.f, t = o.t || 0, vel = o.vel == null ? 0.8 : o.vel;
  const t60 = o.t60 || clamp(3.0 - f / 350, 0.7, 2.6);
  const buf = pluckBuffer(g.ctx, f, { dur: clamp(t60 * 0.95 + 0.25, 0.5, 2.8), t60, bright: o.bright == null ? 0.52 : o.bright, pos: rand(0.12, 0.24), soft: o.soft == null ? 0.42 : o.soft });
  return g.buf(buf, { t, vol: vel * 0.55, a: 0.0006, lp: o.lp || (1300 + 3600 * vel), dest: o.dest || g.out });
}
/** Harp: brighter, longer ring. */
export function harp(g, o) {
  const f = o.f, t = o.t || 0, vel = o.vel == null ? 0.8 : o.vel;
  const t60 = o.t60 || clamp(4.0 - f / 500, 0.9, 3.4);
  const buf = pluckBuffer(g.ctx, f, { dur: clamp(t60 * 0.9 + 0.2, 0.6, 3.2), t60, bright: o.bright == null ? 0.62 : o.bright, pos: rand(0.2, 0.4), soft: 0.5 });
  return g.buf(buf, { t, vol: vel * 0.5, a: 0.0006, lp: o.lp || (2200 + 3800 * vel), dest: o.dest || g.out });
}

/* ------------------------------------------------------------------ percussion */
/** Frame drum / tambour hits. kind: doum | tek | slap | heart | boom */
export function frameDrum(g, o) {
  const t = o.t || 0, vel = o.vel == null ? 1 : o.vel, kind = o.kind || 'doum', dest = o.dest || g.out;
  const f = (o.f || 110) * jit(1, 0.03);
  switch (kind) {
    case 'doum':
      g.tone({ f: f * 1.7, f1: f * 0.85, ft: 0.07, t, dur: 0.24, a: 0.002, vol: 0.9 * vel, dest });
      g.modes(f * 2.3, [[1, 0.32, 0.13], [1.55, 0.16, 0.08]], { t, vol: vel, dest });
      g.noise({ kind: 'pink', t, dur: 0.09, a: 0.001, vol: 0.4 * vel, filters: [['bandpass', 320, 1.2], ['lowpass', 1300]], dest });
      break;
    case 'tek':
      g.noise({ kind: 'white', t, dur: 0.05, a: 0.0008, vol: 0.45 * vel, filters: [['bandpass', jit(2000, 0.1), 2.6], ['lowpass', 5000]], dest });
      g.tone({ f: f * 4.5, f1: f * 3.3, ft: 0.04, t, dur: 0.055, a: 0.001, vol: 0.3 * vel, dest });
      break;
    case 'slap':
      g.noise({ kind: 'white', t, dur: 0.09, a: 0.001, vol: 0.5 * vel, filters: [['bandpass', jit(950, 0.1), 1.4], ['lowpass', 4000]], dest });
      g.tone({ f: f * 2.2, f1: f * 1.4, ft: 0.06, t, dur: 0.12, a: 0.001, vol: 0.55 * vel, dest });
      break;
    case 'heart':
      g.tone({ f, f1: f * 0.58, ft: 0.16, t, dur: 0.26, a: 0.004, vol: 0.9 * vel, dest });
      g.tone({ f: f * 2, f1: f * 1.3, ft: 0.08, t, dur: 0.1, a: 0.002, vol: 0.45 * vel, dest });
      g.noise({ kind: 'brown', t, dur: 0.09, a: 0.002, vol: 0.3 * vel, filters: [['lowpass', 420]], dest });
      break;
    case 'boom':
      g.tone({ f: f * 0.9, f1: f * 0.4, ft: 0.25, t, dur: 0.7, a: 0.003, vol: 1.0 * vel, dest });
      g.noise({ kind: 'brown', t, dur: 0.35, a: 0.002, vol: 0.5 * vel, filters: [['lowpass', 300]], dest });
      g.noise({ kind: 'pink', t, dur: 0.07, a: 0.001, vol: 0.25 * vel, filters: [['bandpass', 500, 1]], dest });
      break;
  }
}

/** Timpani hit (pitched). */
export function timpani(g, o) {
  const t = o.t || 0, vel = o.vel == null ? 1 : o.vel, f = o.f || 98, dest = o.dest || g.out;
  g.tone({ f: f * 1.22, f1: f, ft: 0.07, t, dur: 0.9, a: 0.002, vol: 0.95 * vel, dest });
  g.modes(f, [[1.5, 0.35, 0.55], [1.99, 0.25, 0.42], [2.44, 0.14, 0.3]], { t, vol: vel, dest });
  g.noise({ kind: 'pink', t, dur: 0.06, a: 0.001, vol: 0.3 * vel, filters: [['bandpass', 700, 0.9]], dest });
}
/** Timpani roll: accelerating hits with a crescendo. */
export function timpaniRoll(g, o) {
  const t = o.t || 0, dur = o.dur || 1, f = o.f || 98, dest = o.dest || g.out, v0 = o.v0 == null ? 0.25 : o.v0, v1 = o.v1 == null ? 0.9 : o.v1;
  let x = 0, k = 0;
  while (x < dur) {
    const p = x / dur;
    timpani(g, { t: t + x, f: f * jit(1, 0.004), vel: (v0 + (v1 - v0) * p) * jit(1, 0.12), dest });
    x += 0.075 - 0.032 * p + rand(-0.006, 0.006); k++;
    if (k > 60) break;
  }
}

/** Metallic shimmer / cymbal swell. */
export function shimmer(g, o) {
  const t = o.t || 0, dur = o.dur || 1.5, vol = o.vol == null ? 1 : o.vol, dest = o.dest || g.out;
  const env = g.gain(0);
  const T = g.T(t);
  env.gain.setValueAtTime(0, T);
  env.gain.linearRampToValueAtTime(vol, T + dur * (o.peak == null ? 0.55 : o.peak));
  env.gain.exponentialRampToValueAtTime(EPS, T + dur * 1.5);
  env.gain.setValueAtTime(0, T + dur * 1.5 + 0.001);
  for (const [f, q] of [[5200, 5], [7300, 6], [9800, 5]]) {
    const s = g.noiseSrc('white', t, dur * 1.5 + 0.05);
    const b = g.filt('bandpass', f * jit(1, 0.03), q);
    const gg = g.gain(0.5);
    s.connect(b); b.connect(gg); gg.connect(env);
  }
  env.connect(dest);
}

/* ------------------------------------------------------------------ bells / gongs */
const BELL = {
  // church-ish bell: hum, prime, minor tierce, quint, nominal ...
  church: [[0.5, 0.45, 1.0], [1, 1, 1.0], [1.19, 0.55, 0.8], [1.5, 0.4, 0.65], [2, 0.5, 0.55], [2.5, 0.22, 0.4], [3.0, 0.16, 0.3], [4.2, 0.1, 0.2]],
  // small hand bell: bright, quick
  hand: [[1, 1, 0.9], [2.01, 0.42, 0.55], [2.98, 0.2, 0.34], [4.07, 0.12, 0.2], [5.4, 0.06, 0.12]],
  // glockenspiel / chime bar
  chime: [[1, 1, 1.1], [2.76, 0.26, 0.3], [5.4, 0.1, 0.12]],
  // soft tubular
  tube: [[1, 1, 1.4], [2.32, 0.3, 0.7], [4.25, 0.14, 0.35], [6.63, 0.06, 0.18]],
};
/** Struck bell. o: { f, t, dur (scales decays), vol, kind } */
export function bell(g, o) {
  const f = o.f, t = o.t || 0, vol = o.vol == null ? 1 : o.vol, kind = o.kind || 'hand', dest = o.dest || g.out;
  const sc = (o.dur || 1) * (1 + rand(-0.06, 0.06));
  const table = BELL[kind].map(([r, a, d]) => [r, a, d * sc]);
  g.modes(f, table, { t, vol, a: 0.0008, dest, jit: 0.002 });
  // beating partner for the prime
  g.tone({ f: f * 1.003, t, dur: 0.9 * sc, a: 0.001, vol: 0.2 * vol, dest });
  // strike transient
  g.noise({ t, dur: 0.018, a: 0.0005, vol: 0.12 * vol, filters: [['bandpass', Math.min(f * 3, 6000), 1.5]], dest });
}

/** Deep gong / tam-tam: inharmonic partials with bloom + low boom + crash. */
export function gong(g, o) {
  const f = o.f || 78, t = o.t || 0, dur = o.dur || 5, vol = o.vol == null ? 1 : o.vol, dest = o.dest || g.out;
  const parts = [[1, 1, 1], [1.58, 0.7, 0.9], [2.14, 0.62, 0.78], [2.83, 0.5, 0.66], [3.52, 0.36, 0.52], [4.25, 0.3, 0.42], [5.1, 0.2, 0.32], [6.4, 0.12, 0.22]];
  const T = g.T(t);
  for (const [ratio, amp, dk] of parts) {
    for (let k = 0; k < 2; k++) { // pairs beat against each other
      const fr = f * ratio * (k ? 1.0035 : 1) * jit(1, 0.002);
      const osc = g.osc('sine', fr, t, dur * dk + 0.2);
      const e = g.gain(0);
      const pk = amp * vol * (k ? 0.6 : 1);
      const bloom = 0.04 + 0.08 * ratio;
      e.gain.setValueAtTime(0, T);
      e.gain.linearRampToValueAtTime(pk, T + bloom);
      e.gain.exponentialRampToValueAtTime(EPS, T + bloom + dur * dk);
      e.gain.setValueAtTime(0, T + bloom + dur * dk + 0.001);
      osc.connect(e); e.connect(dest);
    }
  }
  g.tone({ f: f * 0.5, t, dur: dur * 0.8, a: 0.05, vol: 0.5 * vol, dest });
  g.noise({ kind: 'pink', t, dur: 0.9, a: 0.004, vol: 0.5 * vol, filters: [['bandpass', 420, 0.8], ['lowpass', 1800]], dest });
  g.noise({ kind: 'white', t, dur: 1.6, a: 0.02, vol: 0.16 * vol, filters: [['bandpass', 3200, 0.7]], dest });
}

/* ------------------------------------------------------------------ harp-like sparkle runs */
export function sparkleRun(g, { notes, t = 0, step = 0.05, vol = 1, dest, kind = 'harp', vel = 0.7 }) {
  notes.forEach((f, i) => {
    const tt = t + i * step + rand(0, step * 0.15);
    if (kind === 'harp') harp(g, { f, t: tt, vel: vel * (0.8 + 0.2 * rnd()), dest });
    else bell(g, { f, t: tt, kind: 'chime', vol: 0.5 * vol, dur: 0.8, dest });
  });
}
