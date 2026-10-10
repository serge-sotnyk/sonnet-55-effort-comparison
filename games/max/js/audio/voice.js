// Age of Crowns - formant "voice-like" synthesis (acknowledgements, grunts, chant, animal calls).
// A glottal-ish periodic source (+ vibrato, unison detune, breath noise) feeds a bank of parallel band-pass
// formant filters whose centre frequencies glide between vowels. Everything is built into a Voice (synth.js).

import { getWave, envASR, rand, gauss, dbg, clamp } from './synth.js';

// vowel table (tenor male): [F1..F4 Hz], [relative dB], [bandwidth Hz]
const VOW = {
  a:  [[650, 1080, 2650, 2900], [0, -6, -7, -8],    [80, 90, 120, 130]],
  e:  [[400, 1700, 2600, 3200], [0, -14, -12, -14], [70, 80, 100, 120]],
  i:  [[290, 1870, 2800, 3250], [0, -15, -18, -20], [40, 90, 100, 120]],
  o:  [[400, 800, 2600, 2800],  [0, -10, -12, -12], [40, 80, 100, 120]],
  u:  [[350, 600, 2700, 2900],  [0, -20, -17, -14], [40, 80, 100, 120]],
  ae: [[660, 1720, 2410, 3300], [0, -8, -12, -14],  [80, 90, 110, 130]],
  uh: [[600, 1170, 2400, 3000], [0, -8, -10, -12],  [80, 90, 110, 130]],
  aw: [[570, 840, 2410, 3000],  [0, -8, -12, -14],  [70, 80, 100, 120]],
  er: [[490, 1350, 1690, 3000], [0, -8, -8, -12],    [70, 90, 110, 130]],
  m:  [[270, 1000, 2200, 3000], [0, -26, -28, -32], [50, 150, 150, 150]],
  n:  [[250, 1500, 2300, 3000], [0, -22, -24, -28], [50, 150, 150, 150]],
  l:  [[360, 1300, 2500, 3300], [0, -10, -14, -16], [60, 100, 120, 130]],
};
// vocal tract scale per voice type (formants scale with tract length)
export const VTYPE = { bass: 0.9, tenor: 1, alto: 1.1, soprano: 1.2, child: 1.32, beast: 0.82 };

function vowel(name) { return VOW[name] || VOW.a; }

/**
 * Sing / speak one sound.
 * o: {
 *   t, dur, vol, a (attack), r (release),
 *   f (Hz) + f1 (glide to) + ft (glide time)   OR   notes: [[t, hz, glide?], ...]   OR   parts: [{notes|f, det}, ...] (choir)
 *   v (vowel name) OR vowels: [[t, name, glide?], ...],
 *   type: 'bass'|'tenor'|'alto'|'soprano'|'child', fs (extra formant scale), bw (bandwidth scale),
 *   vib: [rateHz, depthCents, delaySec], unison (n), spread (cents), jitter (cents of random drift),
 *   breath (steady noise level), asp (aspiration peak at onset), aspT (aspiration time),
 *   src ('glottal'|'sawtooth'|'reed'), lp (final lowpass), dest
 * }
 */
export function sing(g, o) {
  const ctx = g.ctx;
  const t = o.t || 0;
  const dur = Math.max(0.03, o.dur || 0.2);
  const a = o.a == null ? 0.015 : o.a, r = o.r == null ? 0.05 : o.r;
  const T = g.T(t);
  const dest = o.dest || g.out;
  const total = dur + r + 0.05;

  const env = g.gain(0);
  envASR(env.gain, T, o.vol == null ? 1 : o.vol, a, dur, r);
  const lpf = g.filt('lowpass', o.lp || 5200, 0.6);
  lpf.connect(env); env.connect(dest);

  // ---- formant bank
  const vows = o.vowels || [[0, o.v || 'a', 0]];
  const fscale = (VTYPE[o.type || 'tenor'] || 1) * (o.fs || 1);
  const bwScale = o.bw || 1.6;
  const bank = g.gain(1);
  const nF = o.formants || 4;
  for (let j = 0; j < nF; j++) {
    const bp = g.filt('bandpass', 500, 8);
    const gj = g.gain(1);
    bank.connect(bp); bp.connect(gj); gj.connect(lpf);
    let pf = 0, pq = 0, pg = 0;
    for (let idx = 0; idx < vows.length; idx++) {
      const [vt, name, gl = 0.05] = vows[idx];
      const vw = vowel(name);
      const F = Math.min(vw[0][j] * fscale, 7000), Q = clamp(F / (vw[2][j] * bwScale), 1.2, 30), Gn = dbg(vw[1][j] * 0.6);
      const tt = T + vt;
      if (idx === 0) {
        bp.frequency.setValueAtTime(F, tt); bp.Q.setValueAtTime(Q, tt); gj.gain.setValueAtTime(Gn, tt);
      } else {
        bp.frequency.setValueAtTime(pf, tt); bp.frequency.linearRampToValueAtTime(F, tt + Math.max(gl, 0.002));
        bp.Q.setValueAtTime(pq, tt); bp.Q.linearRampToValueAtTime(Q, tt + Math.max(gl, 0.002));
        gj.gain.setValueAtTime(pg, tt); gj.gain.linearRampToValueAtTime(Gn, tt + Math.max(gl, 0.002));
      }
      pf = F; pq = Q; pg = Gn;
    }
  }

  // ---- sources
  const parts = o.parts || [{ notes: o.notes, f: o.f, f1: o.f1, ft: o.ft, det: 0 }];
  const unison = o.unison || 1, spread = o.spread == null ? 14 : o.spread;
  const wave = o.src === 'sawtooth' ? 'sawtooth' : getWave(ctx, o.src || 'glottal');
  const nsrc = parts.length * unison;
  const srcGain = g.gain(1 / Math.sqrt(nsrc));
  srcGain.connect(bank);
  const vib = o.vib || [0, 0, 0];
  for (const part of parts) {
    for (let k = 0; k < unison; k++) {
      let notes = part.notes;
      if (!notes) {
        const f = part.f || 150;
        notes = [[0, f, 0]];
        if (part.f1) notes.push([0, part.f1, part.ft == null ? dur : part.ft]);
      }
      const osc = g.osc(wave, notes[0][1], t, total);
      for (let i = 0; i < notes.length; i++) {
        const [nt, hz, gl = 0.03] = notes[i];
        const tt = T + nt;
        if (i === 0) osc.frequency.setValueAtTime(hz, tt);
        else {
          osc.frequency.setValueAtTime(notes[i - 1][1], tt);
          osc.frequency.exponentialRampToValueAtTime(hz, tt + Math.max(gl, 0.002));
        }
      }
      osc.detune.value = (part.det || 0) + (k - (unison - 1) / 2) * spread;
      if (vib[1] > 0) g.lfo(osc.detune, vib[0] * rand(0.93, 1.07), vib[1] * rand(0.85, 1.15), t + (vib[2] || 0), total, { fadeIn: 0.25 });
      if (o.jitter) g.lfo(osc.detune, rand(17, 29), o.jitter, t, total);
      osc.connect(srcGain);
    }
  }

  // ---- breath / aspiration noise through the same formants
  const breath = o.breath == null ? 0.03 : o.breath, asp = o.asp || 0;
  if (breath > 0 || asp > 0) {
    const ns = g.noiseSrc('white', t, total);
    const ng = g.gain(0);
    const aspT = o.aspT || 0.04;
    ng.gain.setValueAtTime(Math.max(asp, breath), T);
    if (asp > breath) ng.gain.exponentialRampToValueAtTime(Math.max(breath, 1e-4), T + aspT);
    ng.gain.setValueAtTime(breath, T + aspT + 0.001);
    ng.gain.setValueAtTime(breath, T + dur);
    ng.gain.linearRampToValueAtTime(0, T + dur + r);
    ns.connect(ng); ng.connect(bank);
  }
  return env;
}

/** Short consonant burst (plosive / fricative): bandpassed noise. */
export function burst(g, { t = 0, f = 2500, q = 1.5, dur = 0.03, vol = 0.5, dest } = {}) {
  return g.noise({ kind: 'white', t, dur, a: 0.001, vol, filters: [['bandpass', f, q]], dest: dest || g.out });
}

export { gauss };
