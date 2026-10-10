// Age of Crowns - sound effect recipes (all synthesized). A recipe is (g: Voice, p: {rate, pan, v}) => void
// and schedules nodes relative to g.t0. `lvl` is the peak ceiling and `loud` the target loudness (see tools/audio-check.mjs
// --calibrate, which writes js/audio/levels.js with per-sound trims so every sound lands on its target).

import { rand, randi, pick, chance, jit, clamp, mtof, rnd, crackleCurve, smoothCurve, dbg, Voice, EPS, pluckBuffer } from './synth.js';
import { sing, burst } from './voice.js';
import { brass, horn, strings, padChoir, flute, shawm, lute, harp, frameDrum, timpani, timpaniRoll, shimmer, bell, gong, sparkleRun } from './instruments.js';
import { TRIM_DB } from './levels.js';

const REG = Object.create(null);
/**
 * meta: prio 1..5 (voice stealing), gap ms (min interval between plays of this name), rev (reverb send 0..1),
 *       hall (use the big hall reverb), lvl (peak CEILING dBFS at vol=1), loud (target short-term A-weighted loudness, dB),
 *       duck [amount, seconds] (auto music ducking)
 */
function def(name, meta, fn) { REG[name] = { name, prio: 2, gap: 45, rev: 0, hall: false, lvl: -10, duck: null, ...meta, fn }; }

/* ------------------------------------------------------------------ shared building blocks */
/** wooden knock: three decaying modes + a tiny noise transient. f = fundamental Hz */
function wood(g, f, o = {}) {
  const { t = 0, vol = 1, hard = 1, dest, size = 1 } = o;
  const k = Math.sqrt(1000 / f) * size;
  g.modes(f, [[1, 1, 0.05 * k], [2.35, 0.5, 0.03 * k], [3.9, 0.28, 0.02 * k]], { t, vol, dest, jit: 0.012 });
  g.noise({ t, dur: 0.012, a: 0.0004, vol: 0.3 * vol * hard, filters: [['bandpass', Math.min(f * 2.6, 6500), 1.4]], dest });
}
/** low body thump: falling sine + lowpassed brown noise */
function thud(g, f, o = {}) {
  const { t = 0, vol = 1, dur = 0.18, drop = 0.55, dest, noise = 0.5 } = o;
  g.tone({ f, f1: f * drop, ft: dur * 0.7, t, dur, a: 0.002, vol, dest });
  if (noise) g.noise({ kind: 'brown', t, dur: dur * 0.7, a: 0.002, vol: noise * vol, filters: [['lowpass', Math.max(f * 3, 200)]], dest });
}
/** airy whoosh: pink noise through a gliding band-pass with a swell envelope. total length = dur */
function whoosh(g, o) {
  const { t = 0, dur = 0.2, a = dur * 0.45, f0 = 2000, f1 = 800, q = 1.2, vol = 0.5, kind = 'pink', dest } = o;
  g.noise({ kind, t, dur: Math.max(dur - a, 0.02), a, swell: true, vol, filters: [['bandpass', f0, q, f1, dur]], dest });
}
/** coin clink */
function coin(g, f, t, vol, dest) {
  g.modes(f, [[1, 1, 0.16], [1.52, 0.65, 0.11], [2.38, 0.45, 0.08], [3.7, 0.2, 0.05]], { t, vol, dest, jit: 0.012 });
  g.noise({ t, dur: 0.008, a: 0.0003, vol: 0.2 * vol, filters: [['bandpass', 4500, 1]], dest });
}
/** wooden creak: saw through gliding resonant band-pass with stick-slip amplitude modulation */
function creak(g, o = {}) {
  const { t = 0, dur = 0.4, f = 160, vol = 0.5, dest = g.out } = o;
  const T = g.T(t);
  const osc = g.osc('sawtooth', f, t, dur + 0.05);
  osc.frequency.setValueAtTime(f, T);
  osc.frequency.linearRampToValueAtTime(f * rand(1.15, 1.5), T + dur * 0.55);
  osc.frequency.linearRampToValueAtTime(f * rand(0.8, 1.05), T + dur);
  const bp = g.filt('bandpass', f * rand(4, 6), 6);
  bp.frequency.setValueAtTime(f * 4.5, T);
  bp.frequency.linearRampToValueAtTime(f * rand(6, 9), T + dur);
  const am = g.gain(0);
  am.gain.setValueCurveAtTime(smoothCurve(dur, { rate: 48, smooth: 0.25, lo: 0.04, hi: 1, shape: 1.5, fadeIn: 0.12, fadeOut: 0.25 }), T, dur);
  am.gain.setValueAtTime(0, T + dur + 0.001);
  const out = g.gain(vol);
  osc.connect(bp); bp.connect(am); am.connect(out);
  // friction hiss
  g.texture({ kind: 'white', t, dur, curve: smoothCurve(dur, { rate: 48, smooth: 0.3, lo: 0, hi: 1, fadeIn: 0.1, fadeOut: 0.3 }), vol: 0.08, filters: [['bandpass', f * 9, 3]], dest: out });
  out.connect(dest);
}
/** crumbling rubble / crackle texture */
function rubble(g, o = {}) {
  const { t = 0, dur = 0.6, vol = 0.5, f = 900, q = 0.8, density = 0.2, decay = 3, dest } = o;
  g.texture({ kind: 'white', t, dur, curve: crackleCurve(dur, { rate: 520, density, decay }), vol, filters: [['bandpass', f, q], ['lowpass', Math.min(f * 4, 7500)]], dest });
}
function hoof(g, o = {}) {
  const { t = 0, vol = 1, f = 430, dest } = o;
  wood(g, f * jit(1, 0.06), { t, vol: 0.8 * vol, size: 0.55, hard: 1.3, dest });
  thud(g, 105, { t, vol: 0.5 * vol, dur: 0.05, noise: 0.25, dest });
}
/** soft footstep thump */
function step(g, o = {}) {
  const { t = 0, vol = 1, f = 95, dest } = o;
  thud(g, f * jit(1, 0.1), { t, vol: 0.8 * vol, dur: 0.07, noise: 0.45, dest });
  g.noise({ kind: 'pink', t, dur: 0.05, a: 0.002, vol: 0.12 * vol, filters: [['bandpass', 700, 0.8]], dest });
}

/* ================================================================== UI */
def('ui_click', { prio: 1, gap: 30, lvl: -8, loud: -30, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  wood(g, jit(1350, 0.05) * r, { vol: 0.9, size: 0.7 });
  g.tone({ f: jit(420, 0.05) * r, f1: 300 * r, ft: 0.03, dur: 0.035, a: 0.001, vol: 0.35 });
});
def('ui_hover', { prio: 1, gap: 70, lvl: -14, loud: -42 }, (g, p) => {
  wood(g, jit(2100, 0.06) * p.rate, { vol: 0.6, size: 0.8, hard: 0.5 });
});
def('ui_error', { prio: 2, gap: 220, lvl: -8, loud: -24, rev: 0.06 }, (g, p) => {
  const r = p.rate;
  thud(g, 165 * r, { vol: 0.9, dur: 0.14, drop: 0.62, noise: 0.35 });
  thud(g, 128 * r, { t: 0.115, vol: 0.85, dur: 0.18, drop: 0.6, noise: 0.35 });
  g.noise({ kind: 'brown', dur: 0.28, a: 0.004, vol: 0.12, filters: [['lowpass', 380]] });
});
def('ui_notify', { prio: 3, gap: 250, lvl: -9, loud: -22, rev: 0.28 }, (g, p) => {
  const r = p.rate;
  bell(g, { f: 784 * r, kind: 'tube', dur: 0.8, vol: 0.8 });
  bell(g, { f: 1175 * r, t: 0.13, kind: 'tube', dur: 1.0, vol: 0.85 });
});
def('ui_select', { prio: 1, gap: 40, lvl: -10, loud: -32 }, (g, p) => {
  const r = p.rate;
  g.noise({ kind: 'pink', dur: 0.03, a: 0.001, vol: 0.5, filters: [['bandpass', jit(760, 0.08) * r, 1.3]] });
  g.tone({ f: jit(500, 0.04) * r, f1: 590 * r, ft: 0.03, dur: 0.045, a: 0.001, vol: 0.45 });
});
def('ui_select_building', { prio: 1, gap: 60, lvl: -9, loud: -28, rev: 0.06 }, (g, p) => {
  const r = p.rate;
  wood(g, jit(235, 0.04) * r, { vol: 1, size: 1 });
  thud(g, 115 * r, { vol: 0.5, dur: 0.09, noise: 0.2 });
});
def('ui_menu_open', { prio: 2, gap: 120, lvl: -9, loud: -28, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  whoosh(g, { dur: 0.2, a: 0.1, f0: 700 * r, f1: 2300 * r, q: 0.9, vol: 0.28 });
  wood(g, 1050 * r, { t: 0.15, vol: 0.55, size: 0.8 });
});
def('ui_menu_close', { prio: 2, gap: 120, lvl: -10, loud: -29, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  whoosh(g, { dur: 0.17, a: 0.06, f0: 2100 * r, f1: 650 * r, q: 0.9, vol: 0.26 });
  wood(g, 760 * r, { t: 0.12, vol: 0.5, size: 0.8 });
});
// extras
def('ui_cancel', { prio: 2, gap: 80, lvl: -9, loud: -28, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  wood(g, 700 * r, { vol: 0.8, size: 0.8 });
  wood(g, 520 * r, { t: 0.07, vol: 0.7, size: 0.8 });
});
def('ui_queue', { prio: 1, gap: 40, lvl: -10, loud: -31, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  wood(g, jit(1000, 0.04) * r, { vol: 0.8, size: 0.6 });
  g.tone({ f: 620 * r, f1: 780 * r, ft: 0.04, dur: 0.05, a: 0.001, vol: 0.3 });
});
def('ui_ping', { prio: 3, gap: 300, lvl: -6, loud: -18, rev: 0.3 }, (g, p) => {   // minimap signal / flare
  const r = p.rate;
  brass(g, { f: 392 * r, dur: 0.16, a: 0.03, r: 0.14, vel: 0.5, bright: 0.7, vib: 0 });
  bell(g, { f: 1175 * r, t: 0.02, kind: 'tube', dur: 0.8, vol: 0.5 });
});
def('ui_message', { prio: 2, gap: 200, lvl: -10, loud: -26, rev: 0.2 }, (g, p) => {
  const r = p.rate;
  harp(g, { f: 659 * r, vel: 0.7, t60: 0.6 }); harp(g, { f: 880 * r, t: 0.09, vel: 0.6, t60: 0.7 });
});

/* ================================================================== unit acknowledgements */
def('ack_villager', { prio: 2, gap: 120, lvl: -6, loud: -24, rev: 0.05 }, (g, p) => {
  const r = p.rate, female = chance(0.4), type = female ? 'alto' : 'tenor';
  const f0 = (female ? 205 : 128) * r * jit(1, 0.06);
  const v = randi(0, 2);
  if (v === 0) {         // "ya?"
    sing(g, { type, notes: [[0, f0 * 0.96], [0.07, f0 * 1.06, 0.06]], vowels: [[0, 'i', 0], [0.05, 'ae', 0.05]], dur: 0.13, a: 0.012, r: 0.05, breath: 0.03 });
  } else if (v === 1) {  // "hup"
    sing(g, { type, f: f0 * 1.04, f1: f0 * 0.9, ft: 0.12, v: 'uh', dur: 0.1, a: 0.008, r: 0.04, asp: 0.5, aspT: 0.035, breath: 0.02 });
    burst(g, { t: 0.11, f: 1300, q: 1.2, dur: 0.018, vol: 0.12 });
  } else {               // "hm-hm"
    sing(g, { type, f: f0, f1: f0 * 0.92, ft: 0.16, vowels: [[0, 'm', 0], [0.08, 'uh', 0.04]], dur: 0.15, a: 0.02, r: 0.06 });
  }
});
def('ack_infantry', { prio: 2, gap: 120, lvl: -6, loud: -24, rev: 0.05 }, (g, p) => {
  const r = p.rate, f0 = 104 * r * jit(1, 0.07);
  if (chance(0.5)) { // "hup!"
    sing(g, { type: 'bass', f: f0 * 1.1, f1: f0 * 0.85, ft: 0.11, v: 'uh', dur: 0.1, a: 0.006, r: 0.04, asp: 0.8, aspT: 0.04, breath: 0.02, vol: 1 });
    burst(g, { t: 0.1, f: 1100, q: 1, dur: 0.02, vol: 0.1 });
  } else {           // "hrah"
    sing(g, { type: 'tenor', notes: [[0, f0 * 1.2], [0.09, f0 * 1.05, 0.08]], vowels: [[0, 'o', 0], [0.05, 'a', 0.06]], dur: 0.16, a: 0.008, r: 0.05, asp: 0.7, aspT: 0.05, breath: 0.02 });
  }
  // armour clink
  g.modes(jit(2300, 0.1), [[1, 1, 0.07], [2.76, 0.4, 0.04]], { t: 0.03, vol: 0.1 });
});
def('ack_archer', { prio: 2, gap: 120, lvl: -6, loud: -24, rev: 0.05 }, (g, p) => {
  const r = p.rate, f0 = 150 * r * jit(1, 0.07);
  if (chance(0.6)) { // "yah"
    sing(g, { type: 'tenor', notes: [[0, f0 * 1.03], [0.09, f0 * 0.9, 0.1]], vowels: [[0, 'i', 0], [0.05, 'a', 0.05]], dur: 0.17, a: 0.01, r: 0.05, breath: 0.03 });
  } else {           // "hey!"
    sing(g, { type: 'tenor', f: f0 * 1.1, f1: f0, ft: 0.12, vowels: [[0, 'e', 0], [0.08, 'i', 0.08]], dur: 0.15, a: 0.008, r: 0.05, asp: 0.45, aspT: 0.04, breath: 0.03 });
  }
});
def('ack_cavalry', { prio: 2, gap: 140, lvl: -6, loud: -24, rev: 0.05 }, (g, p) => {
  const r = p.rate, f0 = 118 * r * jit(1, 0.06);
  hoof(g, { t: 0, vol: 0.7 }); hoof(g, { t: 0.085, vol: 0.5, f: 380 });
  sing(g, { t: 0.04, type: 'tenor', notes: [[0, f0 * 1.05], [0.05, f0 * 1.3, 0.12]], vowels: [[0, 'uh', 0], [0.08, 'a', 0.06]], dur: 0.2, asp: 0.7, aspT: 0.05, breath: 0.03, vol: 0.9 });
  // tiny whinny flavour
  sing(g, { t: 0.2, type: 'beast', notes: [[0, 640 * r], [0.07, 880 * r, 0.06], [0.14, 520 * r, 0.08]], vowels: [[0, 'e', 0], [0.08, 'ae', 0.06]], dur: 0.17, vol: 0.28, a: 0.02, r: 0.05, jitter: 25, breath: 0.08 });
});
def('ack_monk', { prio: 2, gap: 140, lvl: -6, loud: -26, rev: 0.15 }, (g, p) => {
  const r = p.rate, f0 = 150 * r * jit(1, 0.05);
  sing(g, { type: 'tenor', f: f0 * 0.9, v: 'm', dur: 0.1, a: 0.02, r: 0.04, unison: 2, spread: 10, breath: 0.01, vol: 0.9 });
  sing(g, { t: 0.15, type: 'tenor', f: f0 * 1.12, f1: f0 * 1.0, ft: 0.2, vowels: [[0, 'm', 0], [0.06, 'uh', 0.05]], dur: 0.17, a: 0.02, r: 0.08, unison: 2, spread: 10, asp: 0.25, vib: [5.2, 10, 0.1], vol: 1 });
});
def('ack_siege', { prio: 2, gap: 140, lvl: -6, loud: -23, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  creak(g, { t: 0, dur: 0.22, f: 95 * r, vol: 0.5 });
  sing(g, { t: 0.1, type: 'bass', f: 82 * r * jit(1, 0.05), f1: 68 * r, ft: 0.16, v: 'o', dur: 0.17, asp: 0.45, a: 0.02, r: 0.07, breath: 0.04 });
});

/* ================================================================== economy */
def('place_building', { prio: 3, gap: 100, lvl: -6, loud: -22, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  thud(g, 100 * r, { vol: 1, dur: 0.24, drop: 0.5, noise: 0.5 });
  wood(g, 330 * r, { t: 0.025, vol: 0.9, size: 1.3 });
  wood(g, 520 * r * jit(1, 0.05), { t: 0.085, vol: 0.7, size: 1 });
  g.noise({ kind: 'pink', t: 0.03, dur: 0.12, a: 0.003, vol: 0.18, filters: [['bandpass', 1800, 0.8]] });
});
def('building_complete', { prio: 4, gap: 600, lvl: -5, loud: -17, rev: 0.25, hall: true, duck: [0.35, 1.2] }, (g, p) => {
  const r = p.rate;
  const notes = [60, 64, 67, 72], times = [0, 0.14, 0.28, 0.44], durs = [0.12, 0.12, 0.14, 0.6];
  notes.forEach((m, i) => {
    shawm(g, { f: mtof(m) * r, t: times[i], dur: durs[i], vel: 0.7, a: 0.02 });
    brass(g, { f: mtof(m - 12) * r, t: times[i], dur: durs[i], vel: 0.3, a: 0.04, bright: 0.7, vib: 0 });
  });
  wood(g, 260 * r, { vol: 0.7, size: 1.1 });
  timpani(g, { t: 0.44, f: 130 * r, vel: 0.5 });
});
def('hammer', { prio: 1, gap: 70, lvl: -10, loud: -32, rev: 0.05 }, (g, p) => {
  const r = p.rate, v = randi(0, 2);
  wood(g, [820, 690, 980][v] * r * jit(1, 0.05), { vol: 0.9, size: 0.8, hard: 1.2 });
  g.modes(jit(3100, 0.04) * r, [[1, 1, 0.025], [2.4, 0.4, 0.012]], { vol: 0.12 });
  thud(g, 150 * r, { vol: 0.35, dur: 0.05, noise: 0 });
});
def('chop', { prio: 1, gap: 70, lvl: -10, loud: -31, rev: 0.05 }, (g, p) => {
  const r = p.rate, v = randi(0, 2);
  g.noise({ kind: 'pink', dur: 0.06, a: 0.001, vol: 0.9, filters: [['bandpass', [680, 560, 800][v] * r, 1.1]] });
  g.tone({ f: [190, 165, 215][v] * r, f1: 115 * r, ft: 0.08, dur: 0.1, a: 0.001, vol: 0.9 });
  wood(g, [470, 400, 540][v] * r, { vol: 0.5, size: 0.9 });
  g.noise({ t: 0.002, dur: 0.012, a: 0.0004, vol: 0.25, filters: [['bandpass', 2600, 0.9]] });
});
def('tree_fall', { prio: 2, gap: 250, lvl: -6, loud: -26, rev: 0.15 }, (g, p) => {
  const r = p.rate;
  creak(g, { t: 0, dur: 0.6, f: 120 * r, vol: 0.6 });
  rubble(g, { t: 0.05, dur: 0.5, vol: 0.35, f: 2200, density: 0.22, decay: 1.2 });
  g.noise({ kind: 'pink', t: 0.25, dur: 0.4, a: 0.25, swell: true, vol: 0.28, filters: [['bandpass', 3000, 0.7], ['highpass', 1200]] });
  thud(g, 72 * r, { t: 0.78, vol: 0.9, dur: 0.4, drop: 0.55, noise: 0.5 });
  rubble(g, { t: 0.78, dur: 0.35, vol: 0.25, f: 1500, density: 0.25, decay: 3 });
});
def('mine', { prio: 1, gap: 70, lvl: -10, loud: -32, rev: 0.06 }, (g, p) => {
  const r = p.rate;
  g.modes(jit(2600, 0.1) * r, [[1, 1, 0.07], [2.71, 0.45, 0.04], [5.2, 0.2, 0.025]], { vol: 0.5 });
  g.noise({ kind: 'white', dur: 0.07, a: 0.001, vol: 0.7, filters: [['bandpass', jit(950, 0.12) * r, 0.9], ['lowpass', 3500]] });
  thud(g, 200 * r, { vol: 0.5, dur: 0.06, noise: 0 });
});
def('farm', { prio: 1, gap: 90, lvl: -16, loud: -38, rev: 0.04 }, (g, p) => {
  const r = p.rate;
  g.noise({ kind: 'pink', dur: 0.12, a: 0.08, swell: true, vol: 0.6, filters: [['bandpass', 1700 * r, 0.6, 2800 * r, 0.2], ['highpass', 700], ['lowpass', 4500]] });
  g.texture({ kind: 'pink', t: 0.03, dur: 0.2, curve: smoothCurve(0.2, { rate: 80, smooth: 0.4, lo: 0, hi: 1 }), vol: 0.3, filters: [['bandpass', 2400, 0.7], ['lowpass', 4200]] });
});
def('forage', { prio: 1, gap: 90, lvl: -16, loud: -38, rev: 0.04 }, (g, p) => {
  rubble(g, { dur: 0.32, vol: 0.5, f: 2300 * p.rate, q: 0.6, density: 0.32, decay: 1.5 });
  g.noise({ kind: 'pink', dur: 0.15, a: 0.06, swell: true, vol: 0.3, filters: [['bandpass', 1900, 0.6], ['highpass', 700], ['lowpass', 4500]] });
});
def('butcher', { prio: 1, gap: 90, lvl: -10, loud: -32, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  thud(g, 190 * r, { vol: 0.9, dur: 0.09, drop: 0.7, noise: 0.35 });
  g.noise({ kind: 'white', dur: 0.045, a: 0.001, vol: 0.4, filters: [['highpass', 2800], ['bandpass', 4200, 0.8]] });
  wood(g, 520 * r, { t: 0.004, vol: 0.3, size: 0.5 });
});
def('drop_resource', { prio: 2, gap: 90, lvl: -8, loud: -28, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  thud(g, 130 * r, { vol: 0.8, dur: 0.1, noise: 0.4 });
  coin(g, jit(2800, 0.06) * r, 0.02, 0.5); coin(g, jit(3300, 0.06) * r, 0.075, 0.4);
});
def('drop_wood', { prio: 2, gap: 90, lvl: -8, loud: -27, rev: 0.08 }, (g, p) => {
  const r = p.rate;
  wood(g, jit(250, 0.05) * r, { vol: 1, size: 1.2 });
  wood(g, jit(330, 0.07) * r, { t: 0.055, vol: 0.7, size: 1 });
  thud(g, 100 * r, { vol: 0.45, dur: 0.1, noise: 0.3 });
});
def('drop_gold', { prio: 2, gap: 90, lvl: -8, loud: -27, rev: 0.12 }, (g, p) => {
  const r = p.rate, lp = g.filt('lowpass', 7500, 0.5); lp.connect(g.out);
  const n = randi(4, 6);
  for (let i = 0; i < n; i++) coin(g, jit(3000, 0.18) * r, i * rand(0.035, 0.06), rand(0.4, 0.8), lp);
});
def('drop_food', { prio: 2, gap: 90, lvl: -9, loud: -29, rev: 0.06 }, (g, p) => {
  const r = p.rate;
  thud(g, 135 * r, { vol: 1, dur: 0.12, drop: 0.7, noise: 0.5 });
  rubble(g, { t: 0.02, dur: 0.18, vol: 0.2, f: 2400, density: 0.3, decay: 2 });
  thud(g, 110 * r, { t: 0.1, vol: 0.4, dur: 0.07, noise: 0.2 });
});
def('drop_stone', { prio: 2, gap: 90, lvl: -8, loud: -27, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  rubble(g, { dur: 0.3, vol: 0.6, f: 1100 * r, q: 0.7, density: 0.28, decay: 2.5 });
  g.modes(jit(1500, 0.15) * r, [[1, 1, 0.05], [2.9, 0.5, 0.03]], { t: 0.01, vol: 0.5 });
  g.modes(jit(1900, 0.15) * r, [[1, 1, 0.05], [2.9, 0.5, 0.03]], { t: 0.07, vol: 0.4 });
  thud(g, 120 * r, { vol: 0.6, dur: 0.08, noise: 0.3 });
});
def('unit_trained', { prio: 3, gap: 150, lvl: -8, loud: -21, rev: 0.22 }, (g, p) => {
  bell(g, { f: 880 * p.rate * jit(1, 0.01), kind: 'hand', dur: 1.0, vol: 0.9 });
});
def('research_done', { prio: 3, gap: 300, lvl: -6, loud: -18, rev: 0.3 }, (g, p) => {
  const r = p.rate;
  [880, 1109, 1319].forEach((f, i) => bell(g, { f: f * r, t: i * 0.115, kind: i < 2 ? 'chime' : 'tube', dur: i === 2 ? 1.3 : 0.7, vol: 0.85 }));
  harp(g, { f: 1760 * r, t: 0.3, vel: 0.4 });
});
def('market_buy', { prio: 2, gap: 120, lvl: -8, loud: -23, rev: 0.12 }, (g, p) => {
  const r = p.rate, lp = g.filt('lowpass', 7500, 0.5); lp.connect(g.out);
  [3300, 2900, 2500, 2800].forEach((f, i) => coin(g, jit(f, 0.04) * r, i * 0.07, 0.8 - i * 0.1, lp));
  thud(g, 150 * r, { t: 0.3, vol: 0.4, dur: 0.08, noise: 0.2 });
});
def('market_sell', { prio: 2, gap: 120, lvl: -8, loud: -22, rev: 0.15 }, (g, p) => {
  const r = p.rate, lp = g.filt('lowpass', 7500, 0.5); lp.connect(g.out);
  [2400, 2700, 3000, 3400].forEach((f, i) => coin(g, jit(f, 0.04) * r, i * 0.06, 0.6 + i * 0.1, lp));
  bell(g, { f: 1568 * r, t: 0.27, kind: 'chime', dur: 0.8, vol: 0.55 });
});
def('garrison', { prio: 2, gap: 150, lvl: -9, loud: -28, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  g.modes(1900 * r, [[1, 1, 0.025], [2.5, 0.4, 0.015]], { vol: 0.4 });
  g.modes(1500 * r, [[1, 1, 0.03], [2.5, 0.4, 0.015]], { t: 0.05, vol: 0.4 });
  creak(g, { t: 0.06, dur: 0.18, f: 130 * r, vol: 0.35 });
  step(g, { t: 0.25, vol: 0.8 }); step(g, { t: 0.37, vol: 0.7 }); step(g, { t: 0.49, vol: 0.55 });
});
def('ungarrison', { prio: 2, gap: 150, lvl: -9, loud: -28, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  step(g, { t: 0, vol: 0.55 }); step(g, { t: 0.12, vol: 0.7 });
  creak(g, { t: 0.2, dur: 0.18, f: 125 * r, vol: 0.35 });
  g.modes(1500 * r, [[1, 1, 0.03], [2.5, 0.4, 0.015]], { t: 0.24, vol: 0.4 });
  g.modes(1950 * r, [[1, 1, 0.025], [2.5, 0.4, 0.015]], { t: 0.3, vol: 0.4 });
  step(g, { t: 0.42, vol: 0.6 });
});

/* ================================================================== combat */
def('sword_hit', { prio: 1, gap: 40, lvl: -10, loud: -34, rev: 0.06 }, (g, p) => {
  const r = p.rate;
  g.noise({ kind: 'pink', dur: 0.1, a: 0.002, vol: 0.8, filters: [['bandpass', jit(2600, 0.2) * r, 0.9, 700 * r, 0.1], ['lowpass', 5000]] });
  thud(g, jit(150, 0.15) * r, { vol: 0.85, dur: 0.09, drop: 0.5, noise: 0.35 });
  g.noise({ kind: 'white', dur: 0.015, a: 0.0005, vol: 0.2, filters: [['bandpass', 1500 * r, 1]] });
});
def('sword_clang', { prio: 1, gap: 45, lvl: -9, loud: -30, rev: 0.18 }, (g, p) => {
  const r = p.rate, f0 = jit(1250, 0.25) * r;
  g.modes(f0, [[1, 1, 0.5], [2.76, 0.7, 0.32], [5.4, 0.5, 0.2], [8.93, 0.2, 0.1]], { vol: 0.8, jit: 0.006 });
  g.modes(f0 * 1.007, [[1, 0.6, 0.45], [2.76, 0.3, 0.2]], { vol: 0.5 });
  g.noise({ kind: 'white', dur: 0.03, a: 0.0005, vol: 0.5, filters: [['highpass', 2200], ['lowpass', 8000]] });
  thud(g, 260 * r, { vol: 0.4, dur: 0.05, noise: 0.2 });
});
def('blunt_hit', { prio: 1, gap: 45, lvl: -9, loud: -33, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  thud(g, jit(130, 0.15) * r, { vol: 1, dur: 0.12, drop: 0.5, noise: 0.5 });
  g.noise({ kind: 'pink', dur: 0.05, a: 0.001, vol: 0.4, filters: [['bandpass', 600 * r, 0.9], ['lowpass', 1800]] });
  wood(g, 300 * r, { vol: 0.3, size: 0.8 });
});
def('arrow_shoot', { prio: 1, gap: 45, lvl: -12, loud: -35, rev: 0.08 }, (g, p) => {
  const r = p.rate;
  g.buf(pluckBuffer(g.ctx, jit(240, 0.15) * r, { dur: 0.25, t60: 0.14, bright: 0.58, pos: 0.3, soft: 0.1 }), { vol: 0.9, a: 0.0006, lp: 3000 });
  whoosh(g, { t: 0.02, dur: 0.2, a: 0.05, f0: 3200 * r, f1: 1100 * r, q: 1.0, vol: 0.28 });
  thud(g, 150 * r, { vol: 0.3, dur: 0.04, noise: 0 });
});
def('arrow_hit', { prio: 1, gap: 40, lvl: -12, loud: -36, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  g.noise({ kind: 'white', dur: 0.025, a: 0.001, vol: 0.5, filters: [['bandpass', 3200 * r, 1.2, 1500 * r, 0.025]] });
  thud(g, jit(190, 0.15) * r, { vol: 0.8, dur: 0.06, drop: 0.55, noise: 0.3 });
});
def('arrow_hit_wood', { prio: 1, gap: 40, lvl: -11, loud: -34, rev: 0.06 }, (g, p) => {
  const r = p.rate;
  wood(g, jit(520, 0.12) * r, { vol: 1, size: 0.8, hard: 1.4 });
  g.modes(jit(1100, 0.05) * r, [[1, 1, 0.14], [2.0, 0.3, 0.08]], { t: 0.005, vol: 0.12 });
});
def('javelin', { prio: 1, gap: 50, lvl: -10, loud: -32, rev: 0.08 }, (g, p) => {
  const r = p.rate;
  whoosh(g, { dur: 0.2, a: 0.1, f0: 1900 * r, f1: 650 * r, q: 1.0, vol: 0.4 });
  thud(g, 170 * r, { t: 0.17, vol: 0.9, dur: 0.07, noise: 0.3 });
  g.noise({ t: 0.17, dur: 0.02, a: 0.0005, vol: 0.2, filters: [['bandpass', 2400, 1]] });
});
def('axe_throw', { prio: 1, gap: 80, lvl: -10, loud: -32, rev: 0.08 }, (g, p) => {
  const r = p.rate, am = g.gain(0.55);
  g.lfo(am.gain, 13 * r, 0.45, 0, 0.5);
  g.noise({ kind: 'pink', dur: 0.3, a: 0.12, swell: true, vol: 0.9, filters: [['bandpass', 900 * r, 2, 1600 * r, 0.2], ['lowpass', 4500]], dest: am });
  am.connect(g.out);
});
def('bolt_shoot', { prio: 2, gap: 100, lvl: -6, loud: -26, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  g.buf(pluckBuffer(g.ctx, 95 * r, { dur: 0.6, t60: 0.45, bright: 0.55, pos: 0.25, soft: 0.2 }), { vol: 1, lp: 2500 });
  thud(g, 110 * r, { vol: 0.9, dur: 0.2, drop: 0.45, noise: 0.5 });
  whoosh(g, { t: 0.02, dur: 0.28, a: 0.06, f0: 2400 * r, f1: 800 * r, q: 1, vol: 0.3 });
  wood(g, 200 * r, { vol: 0.5, size: 1.2 });
});
def('catapult_fire', { prio: 3, gap: 300, lvl: -5, loud: -22, rev: 0.15 }, (g, p) => {
  const r = p.rate;
  creak(g, { t: 0, dur: 0.3, f: 90 * r, vol: 0.5 });
  g.modes(150 * r, [[1, 1, 0.25], [2.1, 0.6, 0.15], [3.4, 0.3, 0.1]], { t: 0.3, vol: 0.9 });
  thud(g, 90 * r, { t: 0.3, vol: 1, dur: 0.3, drop: 0.5, noise: 0.5 });
  whoosh(g, { t: 0.32, dur: 0.5, a: 0.12, f0: 1500 * r, f1: 500 * r, q: 0.9, vol: 0.35 });
});
def('trebuchet_fire', { prio: 3, gap: 400, lvl: -4, loud: -21, rev: 0.2 }, (g, p) => {
  const r = p.rate;
  creak(g, { t: 0, dur: 0.7, f: 70 * r, vol: 0.55 });
  thud(g, 68 * r, { t: 0.7, vol: 1, dur: 0.55, drop: 0.45, noise: 0.6 });
  g.modes(110 * r, [[1, 1, 0.45], [1.9, 0.6, 0.3], [3.1, 0.3, 0.2]], { t: 0.7, vol: 0.7 });
  whoosh(g, { t: 0.74, dur: 0.9, a: 0.25, f0: 1100 * r, f1: 300 * r, q: 0.8, vol: 0.4 });
});
def('stone_impact', { prio: 3, gap: 120, lvl: -5, loud: -22, rev: 0.15 }, (g, p) => {
  const r = p.rate;
  thud(g, 90 * r, { vol: 1, dur: 0.5, drop: 0.4, noise: 0.5 });
  g.noise({ kind: 'pink', dur: 0.25, a: 0.002, vol: 0.5, filters: [['bandpass', 700 * r, 0.8], ['lowpass', 2500]] });
  rubble(g, { t: 0.05, dur: 0.7, f: 1000 * r, vol: 0.5, density: 0.3, decay: 3 });
  g.modes(1100 * r, [[1, 1, 0.06], [2.7, 0.5, 0.04]], { t: 0.02, vol: 0.4 });
});
def('ram_hit', { prio: 3, gap: 200, lvl: -5, loud: -24, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  thud(g, 72 * r, { vol: 1, dur: 0.6, drop: 0.5, noise: 0.5 });
  g.modes(95 * r, [[1, 1, 0.4], [1.9, 0.6, 0.28], [3.1, 0.35, 0.2], [4.4, 0.2, 0.12]], { vol: 0.8 });
  g.noise({ kind: 'brown', dur: 0.5, a: 0.003, vol: 0.5, filters: [['lowpass', 200]] });
  creak(g, { t: 0.15, dur: 0.3, f: 80 * r, vol: 0.2 });
});
def('building_collapse', { prio: 4, gap: 800, lvl: -3, loud: -20, rev: 0.2 }, (g, p) => {
  const r = p.rate;
  g.noise({ kind: 'brown', a: 0.3, dur: 2.6, swell: true, vol: 0.9, filters: [['lowpass', 420, 0.7, 90, 2.9]] });
  [[0, 130, 1], [0.35, 100, 0.8], [0.8, 150, 0.7], [1.35, 90, 0.6], [1.9, 120, 0.45]].forEach(([t, f, v], i) => {
    thud(g, f * r, { t, vol: v, dur: 0.35, drop: 0.5, noise: 0.5 });
    if (i % 2 === 0) g.modes(f * 1.4 * r, [[1, 1, 0.35], [1.9, 0.6, 0.25], [3.1, 0.35, 0.16]], { t, vol: 0.7 * v });
    else g.noise({ kind: 'pink', t, dur: 0.25, a: 0.003, vol: 0.5 * v, filters: [['bandpass', jit(800, 0.3), 0.8], ['lowpass', 3000]] });
  });
  rubble(g, { dur: 2.4, f: 800, density: 0.25, decay: 1.5, vol: 0.5 });
  rubble(g, { t: 0.1, dur: 2.2, f: 2200, density: 0.2, decay: 2.5, vol: 0.3 });
  thud(g, 60 * r, { t: 2.5, vol: 0.7, dur: 0.5, noise: 0.5 });
});
def('building_fire', { prio: 1, gap: 150, lvl: -14, loud: -38, rev: 0.08 }, (g, p) => {
  const r = p.rate;
  rubble(g, { dur: 0.55, f: 2600 * r, q: 0.6, density: 0.35, decay: 1.2, vol: 0.7 });
  g.noise({ kind: 'pink', a: 0.12, dur: 0.45, swell: true, vol: 0.18, filters: [['lowpass', 500]] });
});

/* ------------------------------------------------------------------ deaths & animals */
def('unit_die', { prio: 2, gap: 70, lvl: -8, loud: -26, rev: 0.08 }, (g, p) => {
  const r = p.rate, v = randi(0, 2), f0 = jit(150, 0.15) * r;
  if (v === 0) {         // falling grunt
    sing(g, { type: 'tenor', notes: [[0, f0 * 1.1], [0.05, f0 * 0.62, 0.25]], vowels: [[0, 'uh', 0], [0.12, 'o', 0.12]], dur: 0.3, a: 0.01, r: 0.1, asp: 0.4, aspT: 0.05, breath: 0.05, jitter: 14, vol: 0.9 });
    thud(g, 85 * r, { t: 0.3, vol: 0.9, dur: 0.16, drop: 0.5, noise: 0.5 });
  } else if (v === 1) {  // gasp, short "aah", thud
    g.noise({ kind: 'pink', dur: 0.12, a: 0.05, swell: true, vol: 0.2, filters: [['bandpass', 1400, 0.8]] });
    sing(g, { t: 0.1, type: 'tenor', notes: [[0, f0 * 1.25], [0.05, f0 * 0.8, 0.2]], vowels: [[0, 'a', 0], [0.15, 'o', 0.1]], dur: 0.24, a: 0.01, r: 0.08, breath: 0.06, vol: 0.85 });
    thud(g, 80 * r, { t: 0.38, vol: 0.9, dur: 0.18, noise: 0.5 });
  } else {               // short "hnf"
    sing(g, { type: 'bass', f: f0 * 0.9, f1: f0 * 0.6, ft: 0.16, v: 'aw', dur: 0.16, a: 0.006, r: 0.06, asp: 0.8, aspT: 0.05, breath: 0.03, vol: 1 });
    thud(g, 90 * r, { t: 0.17, vol: 0.9, dur: 0.14, noise: 0.5 });
  }
});
def('villager_die', { prio: 2, gap: 80, lvl: -8, loud: -26, rev: 0.1 }, (g, p) => {
  const r = p.rate, female = chance(0.5), f0 = (female ? 300 : 210) * r * jit(1, 0.1), type = female ? 'soprano' : 'alto';
  if (chance(0.5)) {
    sing(g, { type, notes: [[0, f0 * 1.05], [0.06, f0 * 0.68, 0.28]], vowels: [[0, 'a', 0], [0.15, 'o', 0.12]], dur: 0.34, a: 0.01, r: 0.1, breath: 0.05, jitter: 16, vib: [7, 14, 0.05], vol: 0.9 });
  } else {
    g.noise({ kind: 'pink', dur: 0.09, a: 0.04, swell: true, vol: 0.15, filters: [['bandpass', 1800, 0.8]] });
    sing(g, { t: 0.08, type, notes: [[0, f0 * 1.2], [0.05, f0 * 0.75, 0.2]], vowels: [[0, 'ae', 0], [0.12, 'o', 0.1]], dur: 0.26, a: 0.01, r: 0.08, breath: 0.06, vol: 0.9 });
  }
  thud(g, 95 * r, { t: 0.36, vol: 0.55, dur: 0.12, noise: 0.5 });
});
function neigh(g, o = {}) {
  const { t = 0, r = 1, vol = 1, long = 1 } = o, f = 560 * r * jit(1, 0.06);
  sing(g, {
    t, type: 'beast', notes: [[0, f], [0.1 * long, f * 1.6, 0.1], [0.3 * long, f * 1.35, 0.18], [0.55 * long, f * 0.66, 0.3]],
    vowels: [[0, 'e', 0], [0.12, 'ae', 0.1], [0.4 * long, 'a', 0.2]], dur: 0.75 * long, a: 0.03, r: 0.16, vol, jitter: 28, vib: [13, 38, 0.3], unison: 2, spread: 26, breath: 0.1, asp: 0.3,
  });
}
def('horse_die', { prio: 2, gap: 150, lvl: -7, loud: -22, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  neigh(g, { r, vol: 0.9, long: 1 });
  thud(g, 62 * r, { t: 0.78, vol: 1, dur: 0.4, drop: 0.5, noise: 0.5 });
  rubble(g, { t: 0.78, dur: 0.2, f: 600, density: 0.4, decay: 2, vol: 0.2 });
});
def('animal_die', { prio: 2, gap: 100, lvl: -9, loud: -27, rev: 0.08 }, (g, p) => {
  const r = p.rate, f = jit(430, 0.15) * r;
  sing(g, { type: 'beast', notes: [[0, f * 1.1], [0.05, f * 0.45, 0.28]], vowels: [[0, 'ae', 0], [0.12, 'o', 0.12]], dur: 0.3, a: 0.01, r: 0.1, breath: 0.1, jitter: 30, vol: 0.9 });
  thud(g, 90 * r, { t: 0.3, vol: 0.7, dur: 0.14, noise: 0.5 });
});
def('boar_squeal', { prio: 2, gap: 150, lvl: -8, loud: -24, rev: 0.1 }, (g, p) => {
  const r = p.rate, f = jit(380, 0.1) * r;
  sing(g, { type: 'beast', f: 105 * r, f1: 90 * r, ft: 0.1, v: 'uh', dur: 0.1, a: 0.01, r: 0.04, breath: 0.3, asp: 0.5, vol: 0.7 });
  sing(g, { t: 0.08, type: 'beast', notes: [[0, f], [0.1, f * 1.95, 0.1], [0.28, f * 1.5, 0.15]], vowels: [[0, 'ae', 0], [0.15, 'e', 0.1]], dur: 0.42, a: 0.02, r: 0.1, jitter: 34, vib: [22, 45, 0], unison: 2, spread: 40, breath: 0.1, lp: 4200, vol: 0.9 });
});
def('wolf_howl', { prio: 2, gap: 1500, lvl: -8, loud: -24, rev: 0.4, hall: true }, (g, p) => {
  const r = p.rate, f = 330 * r * jit(1, 0.06);
  sing(g, {
    type: 'tenor', notes: [[0, f], [0.1, f * 1.1, 0.4], [0.9, f * 1.72, 0.45], [1.7, f * 1.55, 0.5], [2.3, f * 1.08, 0.5]],
    vowels: [[0, 'u', 0], [0.5, 'o', 0.4], [1.6, 'u', 0.5]], dur: 2.5, a: 0.25, r: 0.5, vib: [5.2, 22, 0.7], unison: 2, spread: 14, breath: 0.07, jitter: 8, lp: 3600, vol: 0.9,
  });
});
def('deer_flee', { prio: 1, gap: 200, lvl: -11, loud: -34, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  g.noise({ kind: 'pink', dur: 0.1, a: 0.01, vol: 0.5, filters: [['bandpass', 900 * r, 1.5, 600 * r, 0.1], ['lowpass', 2500]] });
  let t = 0.12;
  for (let i = 0; i < 6; i++) { hoof(g, { t, vol: rand(0.4, 0.8), f: 520 * jit(1, 0.12) * r }); t += 0.09 - i * 0.008; }
});
def('sheep_baa', { prio: 1, gap: 400, lvl: -9, loud: -28, rev: 0.08 }, (g, p) => {
  const r = p.rate, f = jit(310, 0.1) * r;
  thud(g, 120 * r, { vol: 0.2, dur: 0.04, noise: 0.5 });
  sing(g, { type: 'alto', fs: 0.95, bw: 1.1, notes: [[0, f * 0.95], [0.12, f * 1.18, 0.15], [0.45, f * 0.9, 0.3]], vowels: [[0, 'ae', 0], [0.3, 'a', 0.3]], dur: 0.65, a: 0.04, r: 0.12, vib: [25, 55, 0], jitter: 20, breath: 0.12, unison: 2, spread: 20, vol: 0.85 });
});
def('horse_gallop', { prio: 1, gap: 300, lvl: -11, loud: -33, rev: 0.06 }, (g, p) => {
  const r = p.rate;
  [0, 0.075, 0.15, 0.285, 0.36, 0.435].forEach((tt, i) => hoof(g, { t: tt + rand(-0.006, 0.006), vol: [0.7, 0.5, 0.9][i % 3] * rand(0.8, 1.1), f: 400 * jit(1, 0.1) * r }));
});

/* ================================================================== monks */
def('monk_heal', { prio: 2, gap: 250, lvl: -9, loud: -28, rev: 0.4, hall: true }, (g, p) => {
  const r = p.rate;
  sparkleRun(g, { notes: [587, 659, 740, 880, 988, 1175].map(f => f * r), step: 0.055, vel: 0.6 });
  bell(g, { f: 1175 * r, t: 0.33, kind: 'chime', dur: 1.0, vol: 0.45 });
});
def('monk_convert', { prio: 3, gap: 600, lvl: -6, loud: -20, rev: 0.45, hall: true }, (g, p) => {
  const r = p.rate, k = jit(1, 0.01) * r;
  const line = (a, b, c) => ({ notes: [[0, a * k], [0.5, b * k, 0.07], [1.0, c * k, 0.07]] });
  sing(g, {
    parts: [line(293.7, 349.2, 329.6), line(146.8, 146.8, 110), line(440, 440, 392)],
    vowels: [[0, 'u', 0], [0.1, 'o', 0.1], [0.5, 'l', 0.06], [0.6, 'o', 0.09], [1.0, 'l', 0.06], [1.1, 'o', 0.1], [1.35, 'aw', 0.2]],
    type: 'tenor', dur: 1.45, a: 0.14, r: 0.4, vib: [5.3, 15, 0.15], unison: 2, spread: 12, breath: 0.03, lp: 4200, vol: 0.9,
  });
});
def('monk_convert_done', { prio: 3, gap: 600, lvl: -5, loud: -19, rev: 0.4, hall: true }, (g, p) => {
  const r = p.rate;
  sparkleRun(g, { notes: [293.7, 440, 587.3, 740, 880].map(f => f * r), step: 0.065, vel: 0.7 });
  sing(g, { t: 0.2, parts: [{ f: 293.7 * r }, { f: 370 * r }, { f: 440 * r }, { f: 587.3 * r }], v: 'a', type: 'alto', dur: 0.8, a: 0.25, r: 0.5, vib: [5.2, 14, 0.2], unison: 2, spread: 12, breath: 0.03, vol: 0.8 });
  bell(g, { f: 1175 * r, t: 0.35, kind: 'tube', dur: 1.2, vol: 0.5 });
});

/* ================================================================== alerts, fanfares, game flow */
/** brass line: notes [t, midi, dur, vel?] */
function brassLine(g, notes, o = {}) {
  const r = o.rate || 1;
  for (const [t, m, d, v = 1] of notes) {
    brass(g, { f: mtof(m) * r, t, dur: d, vel: (o.vel == null ? 1 : o.vel) * v, a: o.a == null ? 0.05 : o.a, r: o.r == null ? 0.14 : o.r, bright: o.bright == null ? 1 : o.bright });
    if (o.double) brass(g, { f: mtof(m + o.double) * r, t, dur: d, vel: 0.36 * (o.vel == null ? 1 : o.vel) * v, a: 0.07, r: 0.2, bright: 0.7, vib: 0 });
  }
}
/** string pad chords [t, [midi...], dur] */
function padChords(g, chords, o = {}) {
  const r = o.rate || 1;
  for (const [t, ms, d] of chords) for (const m of ms) strings(g, { f: mtof(m) * r, t, dur: d, vel: o.vel == null ? 0.28 : o.vel, a: o.a == null ? 0.35 : o.a, r: o.r == null ? 0.6 : o.r, bright: o.bright });
}
/** soft sine-ish "ahh" choir chord using the formant voice */
function choirChord(g, ms, o = {}) {
  const { t = 0, dur = 1.5, vol = 0.7, v = 'a', type = 'alto', rate = 1, a = 0.4, r = 0.6 } = o;
  sing(g, { t, parts: ms.map(m => ({ f: mtof(m) * rate })), v, type, dur, a, r, vib: [5.2, 14, 0.3], unison: 2, spread: 12, breath: 0.03, lp: 4200, vol });
}
function harpArp(g, ms, o = {}) {
  const { t = 0, step = 0.06, vel = 0.7, rate = 1 } = o;
  ms.forEach((m, i) => harp(g, { f: mtof(m) * rate, t: t + i * step, vel: vel * (0.85 + 0.15 * rnd()) }));
}

def('alarm_attack', { prio: 5, gap: 1500, lvl: -3, loud: -17, rev: 0.25, hall: true, duck: [0.55, 2.2] }, (g, p) => {
  const r = p.rate;
  horn(g, { f: 146.8 * r, t: 0, dur: 0.4, vel: 1, a: 0.07 });
  brass(g, { f: 293.7 * r, t: 0, dur: 0.4, vel: 0.3, a: 0.08, bright: 0.8, vib: 0 });
  horn(g, { f: 220 * r, t: 0.46, dur: 0.66, vel: 1, a: 0.06, r: 0.35 });
  brass(g, { f: 440 * r, t: 0.46, dur: 0.66, vel: 0.3, a: 0.08, bright: 0.8, vib: 0 });
  timpani(g, { f: 73.4 * r, vel: 0.5 });
});
def('alarm_building', { prio: 5, gap: 1500, lvl: -4, loud: -19, rev: 0.25, hall: true, duck: [0.45, 2] }, (g, p) => {
  const r = p.rate;
  horn(g, { f: 164.8 * r, t: 0, dur: 0.45, vel: 1, a: 0.08 });
  brass(g, { f: 329.6 * r, t: 0, dur: 0.45, vel: 0.25, a: 0.08, bright: 0.7, vib: 0 });
  horn(g, { f: 123.5 * r, t: 0.52, dur: 0.6, vel: 1, a: 0.07, r: 0.4 });
  brass(g, { f: 247 * r, t: 0.52, dur: 0.6, vel: 0.25, a: 0.08, bright: 0.7, vib: 0 });
  frameDrum(g, { kind: 'boom', f: 90 * r, t: 0.52, vel: 0.5 });
});
def('idle_alert', { prio: 3, gap: 600, lvl: -7, loud: -22, rev: 0.25 }, (g, p) => {
  bell(g, { f: 523 * p.rate, kind: 'church', dur: 1.3, vol: 0.9 });
});
def('countdown_tick', { prio: 2, gap: 120, lvl: -9, loud: -29, rev: 0.05 }, (g, p) => {
  const r = p.rate;
  wood(g, 1500 * r, { vol: 0.7, size: 0.6 });
  g.tone({ f: 880 * r, dur: 0.05, a: 0.001, vol: 0.3 });
});
def('game_start', { prio: 5, gap: 3000, lvl: -3, loud: -17, rev: 0.3, hall: true, duck: [0.5, 2.5] }, (g, p) => {
  const r = p.rate;
  brassLine(g, [[0, 50, 0.3], [0.36, 57, 0.3], [0.72, 62, 1.2]], { rate: r, double: -12 });
  padChords(g, [[0, [50, 57, 66], 2.0]], { rate: r, vel: 0.4 });
  timpani(g, { t: 0.72, f: 73.4 * r, vel: 0.9 });
  shimmer(g, { t: 0.72, dur: 1.2, vol: 0.2 });
});

/* ---- age up: D major, I - IV - V - I (three rising "ta-ta-TAAH" calls, then the full chord) ---- */
def('age_up', { prio: 5, gap: 4000, lvl: -2, loud: -16, rev: 0.32, hall: true, duck: [0.6, 7.5] }, (g, p) => {
  const r = p.rate;
  timpaniRoll(g, { t: 0, dur: 0.62, f: 73.4 * r, v0: 0.1, v1: 0.55 });
  // three rising calls, each a little louder, over I - IV - V
  brassLine(g, [[0.0, 62, 0.28], [0.32, 69, 0.28], [0.64, 74, 0.8]], { rate: r, double: -12, vel: 0.6 });
  brassLine(g, [[1.5, 71, 0.28], [1.82, 74, 0.28], [2.14, 79, 0.8]], { rate: r, double: -12, vel: 0.72 });
  brassLine(g, [[3.0, 73, 0.28], [3.32, 76, 0.28], [3.64, 81, 0.95]], { rate: r, double: -12, vel: 0.86 });
  padChords(g, [[0, [50, 57, 62, 66], 1.55], [1.45, [43, 50, 59, 62], 1.6]], { rate: r, vel: 0.14 });
  padChords(g, [[2.95, [45, 52, 57, 61], 1.8]], { rate: r, vel: 0.18 });
  timpani(g, { t: 0.64, f: 73.4 * r, vel: 0.6 }); timpani(g, { t: 2.14, f: 98 * r, vel: 0.65 }); timpani(g, { t: 3.64, f: 110 * r, vel: 0.75 });
  timpaniRoll(g, { t: 4.1, dur: 0.6, f: 73.4 * r, v0: 0.25, v1: 0.9 });
  // final tutti chord (D major, everything)
  brassLine(g, [[4.7, 62, 2.2, 0.8], [4.7, 66, 2.2, 0.7], [4.7, 69, 2.2, 0.75], [4.7, 74, 2.2, 0.85], [4.7, 81, 2.2, 0.8]], { rate: r, a: 0.06, r: 0.8 });
  horn(g, { f: mtof(38) * r, t: 4.7, dur: 2.2, vel: 0.7, a: 0.08, r: 0.9 });
  padChords(g, [[4.7, [38, 50, 57, 62, 66, 69], 2.6]], { rate: r, vel: 0.32 });
  timpani(g, { t: 4.7, f: 73.4 * r, vel: 1 });
  shimmer(g, { t: 4.7, dur: 2.2, vol: 0.28 });
  harpArp(g, [74, 78, 81, 86, 90], { t: 4.75, rate: r, step: 0.07, vel: 0.5 });
  bell(g, { f: mtof(86) * r, t: 4.85, kind: 'tube', dur: 2.2, vol: 0.4 });
});

/* ---- victory: C major, rising call + lively phrase + choir on the final chord ---- */
def('victory', { prio: 5, gap: 5000, lvl: -2, loud: -16, rev: 0.32, hall: true, duck: [0.6, 8] }, (g, p) => {
  const r = p.rate;
  timpaniRoll(g, { t: 0, dur: 0.5, f: 65.4 * r, v0: 0.15, v1: 0.6 });
  brassLine(g, [[0.0, 60, 0.22], [0.29, 67, 0.22], [0.58, 72, 0.6]], { rate: r, double: -12, vel: 0.62 });
  brassLine(g, [[1.2, 76, 0.2], [1.5, 74, 0.2], [1.8, 72, 0.2], [2.1, 76, 0.2], [2.4, 79, 0.85]], { rate: r, double: -12, vel: 0.72 });
  brassLine(g, [[3.4, 81, 0.24], [3.7, 79, 0.24], [4.0, 76, 0.24]], { rate: r, double: -12, vel: 0.8 });
  padChords(g, [[0, [48, 55, 60, 64], 1.25], [1.2, [41, 48, 57, 60], 1.25]], { rate: r, vel: 0.14 });
  padChords(g, [[2.4, [43, 50, 59, 62], 1.1], [3.4, [45, 52, 57, 60], 1.0]], { rate: r, vel: 0.18 });
  timpani(g, { t: 0.58, f: 65.4 * r, vel: 0.6 }); timpani(g, { t: 2.4, f: 98 * r, vel: 0.65 }); timpaniRoll(g, { t: 3.9, dur: 0.5, f: 65.4 * r, v0: 0.25, v1: 0.9 });
  brassLine(g, [[4.4, 60, 2.3, 0.8], [4.4, 64, 2.3, 0.7], [4.4, 67, 2.3, 0.75], [4.4, 72, 2.3, 0.85], [4.4, 79, 2.3, 0.8]], { rate: r, a: 0.06, r: 0.9 });
  horn(g, { f: mtof(36) * r, t: 4.4, dur: 2.3, vel: 0.7, a: 0.08, r: 0.9 });
  padChords(g, [[4.4, [36, 48, 55, 60, 64, 67], 2.6]], { rate: r, vel: 0.32 });
  timpani(g, { t: 4.4, f: 65.4 * r, vel: 1 });
  choirChord(g, [60, 67, 72, 76], { t: 3.7, dur: 3.0, vol: 0.6, rate: r, a: 0.9, r: 1.0, type: 'soprano' });
  shimmer(g, { t: 4.4, dur: 2.4, vol: 0.28 });
  harpArp(g, [72, 76, 79, 84, 88, 91], { t: 4.45, rate: r, step: 0.07, vel: 0.5 });
  bell(g, { f: mtof(91) * r, t: 4.6, kind: 'tube', dur: 2.2, vol: 0.4 });
});

/* ---- defeat: D minor, slow falling line, low strings, tolling bell ---- */
def('defeat', { prio: 5, gap: 5000, lvl: -3, loud: -18, rev: 0.4, hall: true, duck: [0.6, 8] }, (g, p) => {
  const r = p.rate;
  padChords(g, [[0, [38, 45, 50, 53], 2.8], [2.6, [34, 41, 50, 53], 1.6], [4.1, [38, 45, 50, 53], 2.3]], { rate: r, vel: 0.55, a: 0.6, r: 1.0, bright: 0.7 });
  brassLine(g, [[0.0, 62, 0.42], [0.5, 65, 0.42], [1.0, 69, 1.3]], { rate: r, bright: 0.55, a: 0.07, r: 0.3, vel: 0.9 });
  brassLine(g, [[2.5, 67, 0.55], [3.1, 65, 0.55], [3.7, 64, 0.55], [4.3, 62, 1.6]], { rate: r, bright: 0.5, a: 0.08, r: 0.7, vel: 0.85 });
  [0, 1.0, 2.0, 3.0, 4.3].forEach((t, i) => timpani(g, { t, f: 73.4 * r, vel: 0.75 - i * 0.07 }));
  bell(g, { f: 146.8 * r, t: 4.3, kind: 'church', dur: 3.0, vol: 0.8 });
  bell(g, { f: 146.8 * r, t: 1.0, kind: 'church', dur: 2.4, vol: 0.45 });
  horn(g, { f: 73.4 * r, t: 4.3, dur: 1.8, vel: 0.6, a: 0.15, r: 1.0 });
});
def('wonder_start', { prio: 5, gap: 5000, lvl: -3, loud: -18, rev: 0.4, hall: true, duck: [0.55, 7] }, (g, p) => {
  const r = p.rate;
  gong(g, { f: 62 * r, dur: 6, vol: 1 });
  timpani(g, { f: 55 * r, vel: 1 }); timpani(g, { t: 1.9, f: 55 * r, vel: 0.8 });
  brassLine(g, [[0.7, 38, 3.4, 0.9], [0.7, 45, 3.4, 0.8], [0.7, 50, 3.4, 0.8]], { rate: r, a: 0.9, r: 1.6, bright: 0.65, vel: 0.9 });
  padChords(g, [[0.5, [38, 45, 50, 57], 3.6]], { rate: r, vel: 0.5, a: 1.0, r: 1.5, bright: 0.8 });
  shimmer(g, { t: 0.1, dur: 3.0, vol: 0.18 });
});
def('wonder_complete', { prio: 5, gap: 5000, lvl: -2, loud: -16, rev: 0.4, hall: true, duck: [0.6, 8] }, (g, p) => {
  const r = p.rate;
  gong(g, { f: 65.4 * r, dur: 6, vol: 0.9 });
  timpaniRoll(g, { t: 0.2, dur: 0.9, f: 65.4 * r, v0: 0.15, v1: 0.7 });
  brassLine(g, [[1.2, 55, 0.3], [1.55, 62, 0.3], [1.9, 67, 0.9]], { rate: r, double: -12, vel: 0.65 });
  brassLine(g, [[3.0, 67, 0.3], [3.35, 71, 0.3], [3.7, 74, 0.35]], { rate: r, double: -12, vel: 0.8 });
  brassLine(g, [[4.1, 79, 1.6, 1.0], [4.1, 71, 1.6, 0.8], [4.1, 67, 1.6, 0.8]], { rate: r, double: -12, vel: 1.0 });
  padChords(g, [[1.1, [43, 50, 55, 59], 1.9], [3.0, [43, 50, 55, 59, 62], 1.2]], { rate: r, vel: 0.16 });
  padChords(g, [[4.1, [43, 50, 55, 59, 62, 67], 3.0]], { rate: r, vel: 0.3 });
  choirChord(g, [55, 62, 67, 71, 74], { t: 3.0, dur: 3.6, vol: 0.6, rate: r, a: 1.0, r: 1.2, v: 'o', type: 'alto' });
  timpani(g, { t: 4.1, f: 65.4 * r, vel: 1 });
  shimmer(g, { t: 4.1, dur: 2.6, vol: 0.28 });
  harpArp(g, [67, 71, 74, 79, 83, 86], { t: 4.15, rate: r, step: 0.07, vel: 0.5 });
});
def('relic', { prio: 4, gap: 1500, lvl: -5, loud: -20, rev: 0.45, hall: true, duck: [0.35, 3] }, (g, p) => {
  const r = p.rate;
  [69, 76, 81, 85].forEach((m, i) => bell(g, { f: mtof(m) * r, t: i * 0.16, kind: 'tube', dur: 1.8, vol: 0.7 }));
  harpArp(g, [81, 85, 88, 93, 97], { t: 0.45, rate: r, step: 0.06, vel: 0.45 });
  choirChord(g, [57, 64, 69, 73], { t: 0.3, dur: 1.5, vol: 0.6, rate: r, a: 0.7, r: 0.9, v: 'o', type: 'soprano' });
  shimmer(g, { t: 0.2, dur: 1.4, vol: 0.12 });
});


/* ================================================================== extras (not in the spec list, handy for the game) */
def('ui_toggle', { prio: 1, gap: 40, lvl: -10, loud: -31, rev: 0.04 }, (g, p) => {
  const r = p.rate;
  wood(g, 900 * r, { vol: 0.7, size: 0.7 }); wood(g, 1250 * r, { t: 0.055, vol: 0.8, size: 0.6 });
});
def('ui_slider', { prio: 1, gap: 50, lvl: -14, loud: -38 }, (g, p) => {
  wood(g, jit(1700, 0.05) * p.rate, { vol: 0.6, size: 0.55, hard: 0.6 });
});
def('rally_set', { prio: 2, gap: 150, lvl: -9, loud: -26, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  thud(g, 120 * r, { vol: 0.9, dur: 0.14, drop: 0.55, noise: 0.4 });
  wood(g, 340 * r, { t: 0.02, vol: 0.8, size: 1.1 });
  const am = g.gain(0.6); g.lfo(am.gain, 17, 0.4, 0.06, 0.3);
  g.noise({ kind: 'pink', t: 0.07, dur: 0.22, a: 0.05, swell: true, vol: 0.5, filters: [['bandpass', 1500 * r, 0.8, 2600 * r, 0.25], ['lowpass', 4500]], dest: am });
  am.connect(g.out);
});
def('gate_open', { prio: 2, gap: 250, lvl: -8, loud: -26, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  creak(g, { t: 0, dur: 0.6, f: 78 * r, vol: 0.6 });
  wood(g, 150 * r, { t: 0.62, vol: 0.7, size: 1.5 });
  thud(g, 90 * r, { t: 0.62, vol: 0.5, dur: 0.12, noise: 0.3 });
});
def('gate_close', { prio: 2, gap: 250, lvl: -8, loud: -26, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  creak(g, { t: 0, dur: 0.45, f: 85 * r, vol: 0.5 });
  thud(g, 80 * r, { t: 0.46, vol: 1, dur: 0.22, drop: 0.5, noise: 0.5 });
  wood(g, 190 * r, { t: 0.46, vol: 0.8, size: 1.4 });
  g.modes(1700 * r, [[1, 1, 0.03], [2.5, 0.4, 0.015]], { t: 0.56, vol: 0.3 });
});
def('wall_place', { prio: 2, gap: 100, lvl: -8, loud: -25, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  thud(g, 85 * r, { vol: 1, dur: 0.2, drop: 0.5, noise: 0.5 });
  g.modes(jit(900, 0.1) * r, [[1, 1, 0.07], [2.7, 0.5, 0.04]], { t: 0.01, vol: 0.5 });
  g.modes(jit(1300, 0.1) * r, [[1, 1, 0.06], [2.7, 0.5, 0.04]], { t: 0.07, vol: 0.4 });
  rubble(g, { t: 0.04, dur: 0.18, f: 1200, vol: 0.25, density: 0.3, decay: 2.5 });
});
def('trade_cart', { prio: 2, gap: 300, lvl: -10, loud: -26, rev: 0.12 }, (g, p) => {
  const r = p.rate, lp = g.filt('lowpass', 7500, 0.5); lp.connect(g.out);
  creak(g, { t: 0, dur: 0.4, f: 150 * r, vol: 0.35 });
  const am = g.gain(0.7); g.lfo(am.gain, 8, 0.5, 0, 0.5);
  g.noise({ kind: 'brown', dur: 0.45, a: 0.05, swell: true, vol: 0.6, filters: [['lowpass', 500]], dest: am }); am.connect(g.out);
  [2600, 3100, 2800].forEach((f, i) => coin(g, jit(f, 0.05) * r, 0.5 + i * 0.06, 0.6, lp));
});
def('convert_lost', { prio: 4, gap: 800, lvl: -6, loud: -20, rev: 0.4, hall: true, duck: [0.3, 1.5] }, (g, p) => {
  const r = p.rate;
  [72, 69, 64].forEach((m, i) => harp(g, { f: mtof(m) * r, t: i * 0.16, vel: 0.7 }));
  sing(g, { t: 0.1, parts: [{ f: 220 * r }, { f: 174.6 * r }], v: 'o', type: 'tenor', dur: 0.8, a: 0.25, r: 0.5, unison: 2, spread: 14, vib: [5, 12, 0.2], vol: 0.7 });
  bell(g, { f: mtof(52) * r, t: 0.3, kind: 'church', dur: 1.6, vol: 0.5 });
});
def('town_bell', { prio: 4, gap: 3500, lvl: -4, loud: -15, rev: 0.3, hall: true, duck: [0.45, 3.5] }, (g, p) => {
  const r = p.rate;
  for (let i = 0; i < 3; i++) bell(g, { f: 392 * r * jit(1, 0.002), t: i * 0.72, kind: 'church', dur: 1.8, vol: 0.9 });
});
def('cavalry_charge', { prio: 3, gap: 600, lvl: -8, loud: -24, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  let t = 0;
  for (let k = 0; k < 4; k++) { [0, 0.075, 0.15].forEach((o, i) => hoof(g, { t: t + o + rand(-0.005, 0.005), vol: [0.7, 0.55, 0.95][i] * rand(0.85, 1.1), f: 400 * jit(1, 0.1) * r })); t += 0.285; }
  brass(g, { f: 220 * r, t: 0.05, dur: 0.5, vel: 0.35, a: 0.06, r: 0.2, bright: 0.6, vib: 0 });
});
def('horn_signal', { prio: 4, gap: 1200, lvl: -5, loud: -19, rev: 0.25, hall: true, duck: [0.3, 1.2] }, (g, p) => {
  const r = p.rate;
  horn(g, { f: 196 * r, t: 0, dur: 0.55, vel: 1, a: 0.07, r: 0.3 });
  brass(g, { f: 392 * r, t: 0, dur: 0.55, vel: 0.25, a: 0.08, bright: 0.7, vib: 0 });
});
def('arrow_volley', { prio: 2, gap: 300, lvl: -9, loud: -27, rev: 0.12 }, (g, p) => {
  const r = p.rate;
  for (let i = 0; i < 5; i++) {
    const t = i * rand(0.04, 0.075);
    g.buf(pluckBuffer(g.ctx, jit(240, 0.2) * r, { dur: 0.2, t60: 0.12, bright: 0.58, pos: 0.3, soft: 0.1 }), { t, vol: rand(0.35, 0.6), a: 0.0006, lp: 3000 });
    whoosh(g, { t: t + 0.02, dur: 0.22, a: 0.05, f0: jit(3000, 0.2) * r, f1: 1000 * r, q: 1.0, vol: 0.18 });
  }
  for (let i = 0; i < 7; i++) {
    const t = 0.5 + i * rand(0.03, 0.07);
    g.noise({ kind: 'white', t, dur: 0.025, a: 0.001, vol: rand(0.25, 0.4), filters: [['bandpass', 3200 * r, 1.2, 1500 * r, 0.025]] });
    thud(g, jit(190, 0.2) * r, { t, vol: rand(0.4, 0.6), dur: 0.06, drop: 0.55, noise: 0.3 });
  }
});
def('tower_fire', { prio: 2, gap: 120, lvl: -10, loud: -28, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  g.buf(pluckBuffer(g.ctx, jit(150, 0.1) * r, { dur: 0.4, t60: 0.25, bright: 0.55, pos: 0.28, soft: 0.2 }), { vol: 0.9, lp: 2600 });
  whoosh(g, { t: 0.02, dur: 0.26, a: 0.06, f0: 2600 * r, f1: 900 * r, q: 1.0, vol: 0.25 });
  thud(g, 120 * r, { vol: 0.5, dur: 0.08, noise: 0.2 });
});
def('resource_depleted', { prio: 2, gap: 400, lvl: -10, loud: -28, rev: 0.1 }, (g, p) => {
  const r = p.rate;
  g.tone({ f: 330 * r, f1: 210 * r, ft: 0.3, dur: 0.32, a: 0.02, vol: 0.5 });
  wood(g, 420 * r, { vol: 0.6, size: 0.8 }); wood(g, 310 * r, { t: 0.11, vol: 0.5, size: 0.9 });
});

/* ================================================================== registry API */
export const SFX_NAMES = Object.keys(REG);
export function sfxMeta(name) { return REG[name] || null; }
export function trimDb(name) { return TRIM_DB[name] || 0; }

/**
 * Instantiate a sound on any context.
 * ctx: BaseAudioContext; M: master graph (master.js createMaster) or a bare { sfx, sfxRevIn, hallIn }.
 * o: { vol, pan, rate, t0 (absolute start time), noTrim, onDispose }. Returns the Voice (or null if unknown).
 */
export function spawnSfx(name, ctx, M, o = {}) {
  const d = REG[name];
  if (!d) return null;
  const rate = clamp(o.rate == null ? 1 : o.rate, 0.25, 4);
  const trim = o.noTrim ? 0 : (TRIM_DB[name] || 0);
  const vol = clamp(o.vol == null ? 1 : o.vol, 0, 4) * dbg(trim);
  const dest = o.dest || M.sfx;
  const g = new Voice(ctx, dest, o.t0 == null ? ctx.currentTime : o.t0, {
    vol, pan: o.pan || 0, send: d.hall ? M.hallIn : M.sfxRevIn, sendAmt: o.noSend ? 0 : d.rev, onDispose: o.onDispose, meta: d,
  });
  g.name = name; g.prio = d.prio; g.vol = vol;
  try {
    d.fn(g, { rate, pan: o.pan || 0, v: rnd() });
  } catch (e) {
    g.dispose();
    throw e;
  }
  if (g.live <= 0) g.dispose();
  return g;
}
