// Age of Crowns - master audio graph (buses, reverbs, compressor, soft limiter). Works on any BaseAudioContext.
//
//   sfx voices --> sfx ----------------------------------------------+
//                  ^ sfxRev / hall (sends) ---------------------------+--> master --> hp --> comp --> clip --> mute --> out
//   music parts --> musicDry --> duck --> music ----------------------+
//                  ^ musicRev (sends) -> duck                          |
//   ambient ---------------------------> amb --------------------------+
//
// No sound can clip: DynamicsCompressor (glue / limiter) followed by a soft-clip WaveShaper (max ~0.957).

import { makeReverb, softClipCurve, qdb } from './synth.js';

export function createMaster(ctx, opts = {}) {
  const m = { ctx, nodes: [] };
  const mk = (n) => { m.nodes.push(n); return n; };

  m.master = mk(ctx.createGain());
  const hp = mk(ctx.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 24; hp.Q.value = qdb(0.7071);
  const comp = mk(ctx.createDynamicsCompressor());
  comp.threshold.value = opts.threshold == null ? -9 : opts.threshold;
  comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.003; comp.release.value = 0.16;
  const clip = mk(ctx.createWaveShaper()); clip.curve = softClipCurve(); clip.oversample = '2x';
  m.mute = mk(ctx.createGain());
  if (opts.bare) { m.master.connect(m.mute); } // diagnostics: no compressor / clipper / highpass
  else { m.master.connect(hp); hp.connect(comp); comp.connect(clip); clip.connect(m.mute); }
  m.mute.connect(ctx.destination);
  m.comp = comp; m.clip = clip;

  // ---- sfx bus
  m.sfx = mk(ctx.createGain());
  m.sfx.connect(m.master);
  const sfxRev = makeReverb(ctx, { decay: 0.95, damp: 3800, combs: 4, wet: 0.7, predelay: 0.008 });
  sfxRev.output.connect(m.sfx);
  const hall = makeReverb(ctx, { decay: 2.6, damp: 3400, combs: 6, wet: 0.75, predelay: 0.02, size: 1.35 });
  hall.output.connect(m.sfx);
  m.sfxRevIn = sfxRev.input; m.hallIn = hall.input;
  m.reverbs = [sfxRev, hall];

  // ---- music bus (separate reverb so the tail follows ducking / volume)
  m.music = mk(ctx.createGain());
  m.duck = mk(ctx.createGain());
  m.musicDry = mk(ctx.createGain());
  // gentle bus compressor tames drum / pluck transients so the score sits under the effects without peaking
  const mcomp = mk(ctx.createDynamicsCompressor());
  mcomp.threshold.value = -36; mcomp.knee.value = 12; mcomp.ratio.value = 3.5; mcomp.attack.value = 0.006; mcomp.release.value = 0.14;
  m.musicDry.connect(mcomp); mcomp.connect(m.duck); m.duck.connect(m.music); m.music.connect(m.master);
  const musicRev = makeReverb(ctx, { decay: 2.9, damp: 3000, combs: 6, wet: 0.8, predelay: 0.025, size: 1.3 });
  musicRev.output.connect(m.duck);
  m.musicRevIn = musicRev.input;
  m.reverbs.push(musicRev);

  // ---- ambient bus
  m.amb = mk(ctx.createGain());
  m.amb.connect(m.master);

  if (opts.analyser) {
    m.analyser = mk(ctx.createAnalyser());
    m.analyser.fftSize = 2048; m.analyser.smoothingTimeConstant = 0.6;
    clip.connect(m.analyser);
  }

  m.dispose = () => {
    for (const r of m.reverbs) r.dispose();
    for (const n of m.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    m.nodes.length = 0;
  };
  return m;
}
