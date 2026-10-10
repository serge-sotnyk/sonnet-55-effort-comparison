// Browser-side test harness: renders recipes / music into OfflineAudioContexts and analyses them.
// Loaded by tools/preview/audio-test.html and driven from tools/audio-check.mjs through page.evaluate.

import { createMaster } from '../js/audio/master.js';
import { spawnSfx, SFX_NAMES, sfxMeta } from '../js/audio/sfx.js';
import { TRIM_DB } from '../js/audio/levels.js';
import { seedRandom, stats, mtof } from '../js/audio/synth.js';
import { MusicEngine, MOODS, BPM } from '../js/audio/music.js';
import { MIX, LEVEL } from '../js/audio/mix.js';
import { audio } from '../js/audio/audio.js';
import { Ambient } from '../js/audio/ambient.js';
import { analyze, levelStats, drawSpectrogram } from './audio-analysis.mjs';

export { SFX_NAMES, TRIM_DB, MIX, sfxMeta, analyze, levelStats, drawSpectrogram, stats };

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/** Render one SFX through the full master chain into an AudioBuffer. o.dry = no reverb send (for envelope checks). */
export async function renderSfx(name, o = {}) {
  const sr = o.sr || 44100, seed = o.seed == null ? 1 : o.seed, t0 = 0.02;
  const meta = sfxMeta(name);
  const tail = o.tail != null ? o.tail : 0.3 + (!o.dry && meta && meta.rev > 0 ? (meta.hall ? 2.8 : 1.1) : 0);
  const opts = { t0, vol: o.vol, rate: o.rate, pan: o.pan, noTrim: o.noTrim, noSend: !!o.dry };
  const mk = (c) => createMaster(c, { bare: !!o.bare });
  seedRandom(seed);
  const probe = new OfflineAudioContext(2, sr, sr);
  const vp = spawnSfx(name, probe, mk(probe), opts);
  if (!vp) throw new Error('unknown sfx ' + name);
  const end = vp.end;
  seedRandom(seed);
  const ctx = new OfflineAudioContext(2, Math.ceil((end + tail) * sr), sr);
  spawnSfx(name, ctx, mk(ctx), opts);
  const buf = await ctx.startRendering();
  return { buf, end: end - t0, t0, tail };
}

export function bufChannels(buf) { const c = []; for (let i = 0; i < buf.numberOfChannels; i++) c.push(buf.getChannelData(i)); return c; }

export async function analyzeSfx(name, o = {}) {
  const wet = await renderSfx(name, o);
  const m = analyze(bufChannels(wet.buf), wet.buf.sampleRate);
  if (o.peakOnly) return m;
  // envelope / duration checks on a dry render (reverb tails would hide abrupt endings)
  const dry = await renderSfx(name, { ...o, dry: true });
  const d = analyze(bufChannels(dry.buf), dry.buf.sampleRate);
  const sr = dry.buf.sampleRate, ch = bufChannels(dry.buf);
  const e1 = Math.floor((dry.end + dry.t0) * sr), e0 = Math.max(0, e1 - Math.floor(0.025 * sr));
  let pk = 0; for (const c of ch) for (let i = e0; i < Math.min(e1, c.length); i++) pk = Math.max(pk, Math.abs(c[i]));
  m.cutDb = 20 * Math.log10(Math.max(pk, 1e-9) / Math.max(d.peakLin, 1e-9));   // level at the instant the voice ends, re its peak
  m.act = d.dur - d.lead - d.trail;
  m.lead = Math.max(0, d.lead - dry.t0);
  m.voiceEnd = dry.end;
  return m;
}

/** analyse all (or selected) sfx; several seeds -> median metrics */
export async function analyzeAll(o = {}) {
  const names = o.names && o.names.length ? o.names : SFX_NAMES;
  const seeds = o.seeds || [1, 2, 3];
  const out = [];
  for (const name of names) {
    const rows = [];
    let err = null;
    for (const seed of seeds) {
      try { rows.push(await analyzeSfx(name, { ...o, seed })); } catch (e) { err = String(e && e.stack || e); break; }
    }
    if (err) { out.push({ name, error: err }); continue; }
    const m = {};
    for (const k of Object.keys(rows[0])) m[k] = typeof rows[0][k] === 'number' ? median(rows.map(r => r[k])) : rows[0][k];
    // worst-case flags across seeds
    m.clip = Math.max(...rows.map(r => r.clip)); m.nan = Math.max(...rows.map(r => r.nan));
    m.peakMax = Math.max(...rows.map(r => r.peak));
    m.dcMax = Math.max(...rows.map(r => Math.abs(r.dc)));
    m.name = name;
    const meta = sfxMeta(name);
    m.target = meta.lvl; m.targetLoud = meta.loud; m.prio = meta.prio; m.trim = TRIM_DB[name] || 0;
    out.push(m);
  }
  return out;
}

/**
 * iterative level calibration: adjust TRIM_DB so every sound's median peak <= `lvl` (ceiling) and its median short-term
 * A-weighted loudness (loudA) reaches `loud` (target). The more restrictive of the two wins.
 */
export async function calibrate(o = {}) {
  const names = o.names && o.names.length ? o.names : SFX_NAMES;
  const iters = o.iters || 5, seeds = o.seeds || [1, 2, 3, 4, 5];
  for (let it = 0; it < iters; it++) {
    let maxErr = 0;
    for (const name of names) {
      const peaks = [], louds = [];
      for (const seed of seeds) { const m = await analyzeSfx(name, { seed, peakOnly: true }); peaks.push(m.peak); louds.push(m.loudA); }
      const pk = median(peaks), ld = median(louds), meta = sfxMeta(name);
      if (!Number.isFinite(pk) || pk < -90) continue;
      const dPeak = meta.lvl - pk, dLoud = meta.loud == null ? Infinity : meta.loud - ld;
      const err = Math.min(dPeak, dLoud);
      maxErr = Math.max(maxErr, Math.abs(err));
      TRIM_DB[name] = Math.max(-45, Math.min(45, (TRIM_DB[name] || 0) + err * (it === 0 ? 1 : 0.9)));
    }
    if (maxErr < 0.25) break;
  }
  const out = {};
  for (const n of names) out[n] = Math.round((TRIM_DB[n] || 0) * 100) / 100;
  return out;
}


/* ------------------------------------------------------------------ music */
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (m) => NOTE[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

/** Render the generative score offline. o: { mood, seconds, seed, switchTo, switchAt, solo[], log, sr } */
export async function renderMusic(o = {}) {
  const sr = o.sr || 44100, secs = o.seconds || 30, seed = o.seed == null ? 1 : o.seed;
  const ctx = new OfflineAudioContext(2, Math.ceil((secs + 4) * sr), sr);
  const M = createMaster(ctx, { bare: !!o.bare });
  const eng = new MusicEngine(ctx, M, { seed, log: o.log !== false, solo: o.solo, force: o.force, maxActive: Infinity });
  eng.start(o.mood || 'peace', 0);
  const t = 0;
  if (o.switchTo) { eng.advance(o.switchAt, 0, false); eng.setMood(o.switchTo, o.switchAt); }
  eng.advance(secs, 0, false);
  const buf = await ctx.startRendering();
  return { buf, log: eng.log, key: eng.key, keyLog: eng.keyLog };
}

/** per-instrument statistics from the symbolic log */
export function summarizeLog(log, seconds) {
  const by = {};
  for (const e of log) {
    const b = (by[e.inst] = by[e.inst] || { n: 0, min: 999, max: -1, vel: 0 });
    b.n++; b.vel += e.vel;
    if (e.midi != null) { b.min = Math.min(b.min, e.midi); b.max = Math.max(b.max, e.midi); }
  }
  const out = {};
  for (const k of Object.keys(by)) {
    const b = by[k];
    out[k] = { notes: b.n, perMin: +(b.n * 60 / seconds).toFixed(1), range: b.max >= 0 ? noteName(b.min) + '..' + noteName(b.max) : '-', avgVel: +(b.vel / b.n).toFixed(2) };
  }
  return out;
}

export async function analyzeMusic(o = {}) {
  const moods = o.mood ? [o.mood] : MOODS;
  const seeds = o.seeds || [1];
  const res = {};
  for (const mood of moods) {
    const rows = [];
    for (const seed of seeds) {
      const r = await renderMusic({ mood, seconds: o.seconds || 60, seed, sr: o.sr || 44100, bare: o.bare });
      const chs = bufChannels(r.buf), sr = r.buf.sampleRate;
      const skip = Math.floor(sr * 4), end = Math.floor(sr * (o.seconds || 60));
      const body = chs.map(c => c.subarray(skip, end));
      const m = analyze(body, sr), ls = levelStats(body, sr);
      rows.push({ seed, key: r.key, peak: +m.peak.toFixed(1), rms: +m.rms.toFixed(1), loudA: +m.loudA.toFixed(1), centroid: Math.round(m.centroid), hf: +(m.hf * 100).toFixed(1), clip: m.clip, nan: m.nan, dc: +m.dc.toExponential(1), p10: +ls.p10.toFixed(1), p50: +ls.p50.toFixed(1), p90: +ls.p90.toFixed(1), instruments: summarizeLog(r.log, o.seconds || 60) });
    }
    res[mood] = rows;
  }
  return { bpm: BPM, level: LEVEL, res };
}

/** print the symbolic content of a mood (notes by instrument) for composition sanity checks */
export async function dumpMusic(o = {}) {
  const r = await renderMusic({ mood: o.mood || 'peace', seconds: o.seconds || 40, seed: o.seed || 1, sr: 22050 });
  const bpm = BPM[o.mood || 'peace'], beat = 60 / bpm;
  const lines = [`key pc=${r.key.pc} mode=${r.key.mode} bpm=${bpm}`];
  const want = o.inst ? [o.inst] : null;
  const byBar = new Map();
  for (const e of r.log) {
    if (want && !want.includes(e.inst)) continue;
    const bar = Math.floor((e.t - 0.08) / (4 * beat));
    if (!byBar.has(bar)) byBar.set(bar, []);
    byBar.get(bar).push(e);
  }
  for (const [bar, evs] of [...byBar].sort((a, b) => a[0] - b[0])) {
    lines.push(`bar ${String(bar).padStart(2)}: ` + evs.map(e => `${e.inst}${e.midi != null ? ':' + noteName(e.midi) : ''}@${((e.t - 0.08 - bar * 4 * beat) / beat).toFixed(2)}`).join(' '));
  }
  return lines.join('\n');
}


/**
 * Fit MIX (per mood.instrument gain) so each instrument's A-weighted mean level (over seconds, averaged over seeds) hits a target.
 * targets: { 'peace.lute': dB, ... }
 */
export async function calibrateMusic(o = {}) {
  const targets = o.targets, seconds = o.seconds || 50, seeds = o.seeds || [1, 2];
  const byMood = {};
  for (const k of Object.keys(targets)) { const [m, i] = k.split('.'); (byMood[m] = byMood[m] || []).push(i); }
  const out = {};
  for (const iter of [0, 1]) {
    for (const mood of Object.keys(byMood)) {
      for (const inst of byMood[mood]) {
        let sumA = 0, sumU = 0;
        for (const seed of seeds) {
          const r = await renderMusic({ mood, seconds, seed, solo: [inst], force: [inst], bare: true, log: false });
          const chs = bufChannels(r.buf), sr = r.buf.sampleRate;
          const m = analyze(chs.map(c => c.subarray(Math.floor(sr * 4), Math.floor(sr * seconds))), sr);
          sumA += Math.pow(10, m.meanA / 10); sumU += Math.pow(10, m.rms / 10);
        }
        const meanA = 10 * Math.log10(sumA / seeds.length), rms = 10 * Math.log10(sumU / seeds.length);
        const key = mood + '.' + inst, [tgtA, capU] = targets[key];
        if (meanA < -100) { out[key] = { skipped: 'silent in the test window' }; if (MIX[key] == null) MIX[key] = 1; continue; }
        const cur = MIX[key] == null ? 1 : MIX[key];
        const err = Math.min(tgtA - meanA, capU - rms);
        MIX[key] = cur * Math.pow(10, err / 20);
        out[key] = { meanA: +meanA.toFixed(1), rms: +rms.toFixed(1), tgtA, capU, mix: +MIX[key].toFixed(3), iter };
      }
    }
  }
  const mix = {};
  for (const k of Object.keys(targets)) mix[k] = +MIX[k].toFixed(4);
  return { mix, last: out };
}


/** fit LEVEL[mood] so the full mix (through the master chain) hits a target unweighted RMS (dBFS) */
export async function calibrateMoodLevels(o = {}) {
  const targets = o.targets, seconds = o.seconds || 60, seeds = o.seeds || [1, 2];
  const out = {};
  for (const iter of [0, 1, 2]) {
    for (const mood of Object.keys(targets)) {
      let sum = 0, pk = -100;
      for (const seed of seeds) {
        const r = await renderMusic({ mood, seconds, seed, log: false });
        const chs = bufChannels(r.buf), sr = r.buf.sampleRate;
        const m = analyze(chs.map(c => c.subarray(Math.floor(sr * 4), Math.floor(sr * seconds))), sr);
        sum += Math.pow(10, m.rms / 10); pk = Math.max(pk, m.peak);
      }
      const rms = 10 * Math.log10(sum / seeds.length);
      LEVEL[mood] *= Math.pow(10, (targets[mood] - rms) / 20);
      out[mood] = { rms: +rms.toFixed(1), peak: +pk.toFixed(1), level: +LEVEL[mood].toFixed(4), iter };
    }
  }
  const level = {}; for (const m of Object.keys(targets)) level[m] = +LEVEL[m].toFixed(4);
  return { level, last: out };
}


/** offline render of the ambience bed */
export async function renderAmbient(o = {}) {
  const sr = o.sr || 44100, secs = o.seconds || 40, seed = o.seed == null ? 1 : o.seed;
  const ctx = new OfflineAudioContext(2, Math.ceil((secs + 2) * sr), sr);
  const M = createMaster(ctx, { bare: !!o.bare });
  const amb = new Ambient(ctx, M, { seed, log: true, maxActive: Infinity });
  amb.start(0, 2);
  amb.advance(secs, 0);
  const buf = await ctx.startRendering();
  return { buf, log: amb.log };
}
export async function analyzeAmbient(o = {}) {
  const secs = o.seconds || 60;
  const r = await renderAmbient({ seconds: secs, seed: o.seed || 1 });
  const chs = bufChannels(r.buf), sr = r.buf.sampleRate;
  const m = analyze(chs.map(c => c.subarray(Math.floor(sr * 3), Math.floor(sr * secs))), sr);
  const kinds = {}; for (const e of r.log) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  return { rms: +m.rms.toFixed(1), peak: +m.peak.toFixed(1), loudA: +m.loudA.toFixed(1), meanA: +m.meanA.toFixed(1), centroid: Math.round(m.centroid), dc: m.dc, nan: m.nan, clip: m.clip, events: kinds };
}

/* ------------------------------------------------------------------ real-time stress / leak test */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const heap = () => (performance.memory ? performance.memory.usedJSHeapSize : 0);
const collect = async () => { if (typeof gc === 'function') { gc(); await sleep(50); gc(); } };

export async function stressTest(o = {}) {
  const rep = { errors: [], notes: [] };
  const names = SFX_NAMES;
  const origWarn = console.warn; let warnCount = 0, warnSample = [];
  console.warn = (...a) => { warnCount++; if (warnSample.length < 5) warnSample.push(a.map(String).join(' ').slice(0, 160)); };
  try {
    // A. everything before init() must be a harmless no-op
    try {
      audio.play('chop'); audio.play('nonexistent_sound'); audio.play(undefined); audio.play(null, null); audio.play('chop', { vol: NaN, pan: 'x', rate: -3, delay: 'a' });
      audio.music.start(); audio.music.setMood('battle'); audio.music.setMood('bogus'); audio.music.stop(); audio.ambient.start(); audio.ambient.stop();
      audio.duck(0.5, 1); audio.duck(); audio.setMusicVolume(0.4); audio.setMasterVolume(0.9); audio.setSfxVolume(1); audio.setAmbientVolume(0.5); audio.setMuted(true); audio.setMuted(false);
      audio.resume(); audio.stopAll();
    } catch (e) { rep.errors.push('pre-init threw: ' + e); }
    rep.preInit = { ready: audio.ready, mood: audio.music.mood };
    audio.music.setMood('peace');

    // B. init
    audio.init(); audio.init();
    let tries = 0; while ((!audio.debug.ctx || audio.debug.ctx.state !== 'running') && tries++ < 60) await sleep(50);
    rep.ctxState = audio.debug.ctx && audio.debug.ctx.state; rep.sampleRate = audio.debug.ctx && audio.debug.ctx.sampleRate; rep.ready = audio.ready;
    const loads = [];
    try { const rc = audio.debug.ctx.renderCapacity; if (rc) { rc.addEventListener('update', (e) => loads.push({ avg: +e.averageLoad.toFixed(3), peak: +e.peakLoad.toFixed(3), under: +e.underrunRatio.toFixed(3) })); rc.start({ updateInterval: 1 }); } } catch (e) { rep.notes.push('renderCapacity unavailable: ' + e); }
    const an = audio.debug.master.analyser, buf = new Float32Array(an.fftSize);
    let peak = 0; const probe = () => { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i])); };
    const probeTimer = setInterval(probe, 15);
    await collect(); rep.heapStart = heap();

    // C. every sound once, spaced
    for (const n of names) { audio.play(n, { vol: 1 }); await sleep(22); }
    await sleep(400);
    rep.allOncePeak = +(20 * Math.log10(Math.max(peak, 1e-9))).toFixed(1);
    rep.loadAfterAllOnce = loads.slice(-3);
    rep.afterAllOnce = audio.debug;
    delete rep.afterAllOnce.ctx; delete rep.afterAllOnce.master;

    // D. spam: 1000 calls in a tight loop (worst case), then 1000 calls spread over one second
    let maxVoices = 0, maxLive = 0, callMs = [];
    for (let burst = 0; burst < 4; burst++) {
      const t0 = performance.now();
      for (let i = 0; i < 1000; i++) {
        audio.play(names[(Math.random() * names.length) | 0], { vol: Math.random(), pan: Math.random() * 2 - 1, rate: 0.8 + Math.random() * 0.4, delay: Math.random() * 0.3 });
      }
      callMs.push(+(performance.now() - t0).toFixed(1));
      const d = audio.debug; maxVoices = Math.max(maxVoices, d.voices); maxLive = Math.max(maxLive, d.liveNodes);
      await sleep(350);
    }
    for (let i = 0; i < 100; i++) {
      for (let k = 0; k < 10; k++) audio.play(names[(Math.random() * names.length) | 0], { vol: Math.random() });
      const d = audio.debug; maxVoices = Math.max(maxVoices, d.voices); maxLive = Math.max(maxLive, d.liveNodes);
      await sleep(10);
    }
    rep.loadDuringSpam = loads.slice(-5);
    rep.spam = { tightLoopMsPer1000: callMs, maxVoices, maxLiveNodes: maxLive, dropped: audio.debug.dropped, played: audio.debug.played };
    await sleep(3500);
    rep.afterSpamLive = { voices: audio.debug.voices, liveNodes: audio.debug.liveNodes };

    // E. music + ambience with mood changes (+ light sfx traffic)
    audio.music.start(); audio.ambient.start();
    const moods = ['peace', 'tense', 'battle', 'peace'], seconds = o.musicSeconds || 20;
    let maxParts = 0, maxActive = 0, mi = 0;
    for (let s = 0; s < seconds; s++) {
      if (s % 5 === 0 && s) audio.music.setMood(moods[(++mi) % moods.length]);
      audio.play(names[(Math.random() * names.length) | 0], { vol: 0.8 });
      const d = audio.debug; maxParts = Math.max(maxParts, d.musicParts); maxActive = Math.max(maxActive, d.musicActive);
      await sleep(1000);
    }
    const musicLoads = loads.slice(-Math.max(3, seconds - 2));
    rep.music = { renderLoadAvg: musicLoads.length ? +(musicLoads.reduce((a, b) => a + b.avg, 0) / musicLoads.length).toFixed(3) : null, renderLoadPeak: musicLoads.length ? Math.max(...musicLoads.map(x => x.peak)) : null, underruns: loads.reduce((a, b) => a + b.under, 0), maxParts, maxActiveMusicVoices: maxActive, timer: audio.debug.timer, peakDb: +(20 * Math.log10(Math.max(peak, 1e-9))).toFixed(1) };

    // F. stopAll, then everything must drain
    audio.stopAll();
    await sleep(9500);
    const d = audio.debug;
    rep.afterStopAll = { voices: d.voices, liveNodes: d.liveNodes, musicParts: d.musicParts, musicActive: d.musicActive, timerRunning: d.timer };
    clearInterval(probeTimer);
    await collect(); rep.heapEnd = heap(); rep.heapDeltaKB = Math.round((rep.heapEnd - rep.heapStart) / 1024);
    rep.nodeCounters = { created: stats.created, disposed: stats.disposed };
  } catch (e) {
    rep.errors.push('stress test threw: ' + (e && e.stack || e));
  } finally { console.warn = origWarn; }
  rep.warnings = { count: warnCount, sample: warnSample };
  return rep;
}

/** long soak: continuous music + ambience + steady sfx traffic; samples heap (after gc), node counts and timers */
export async function soakTest(o = {}) {
  const seconds = o.seconds || 120, names = SFX_NAMES;
  audio.init();
  let tries = 0; while (audio.debug.ctx.state !== 'running' && tries++ < 60) await sleep(50);
  audio.music.start(); audio.ambient.start();
  const rows = []; const moods = ['peace', 'tense', 'battle'];
  let mi = 0, played = 0;
  await collect(); const h0 = heap();
  for (let s = 0; s < seconds; s++) {
    if (s % 12 === 0 && s) audio.music.setMood(moods[(++mi) % 3]);
    // ~25 sfx per second, bursts of battle-like traffic
    for (let k = 0; k < 25; k++) { audio.play(names[(Math.random() * names.length) | 0], { vol: Math.random() }); played++; }
    if (s % 5 === 4) { await collect(); const d = audio.debug; rows.push({ t: s + 1, heapKB: Math.round((heap() - h0) / 1024), voices: d.voices, liveNodes: d.liveNodes, parts: d.musicParts, active: d.musicActive }); }
    await sleep(1000);
  }
  audio.stopAll(); await sleep(9000); await collect();
  const d = audio.debug;
  return { rows, end: { voices: d.voices, liveNodes: d.liveNodes, parts: d.musicParts, timer: d.timer, heapDeltaKB: Math.round((heap() - h0) / 1024) }, played, dropped: d.dropped };
}


/** schedule 12 minutes of peace on a throw-away context (no rendering) to check key changes / section variety */
export async function keyTest(o = {}) {
  const sr = 8000, ctx = new OfflineAudioContext(1, sr, sr);
  const M = createMaster(ctx);
  const res = {};
  for (const mood of (o.moods || ['peace', 'tense', 'battle'])) {
    const eng = new MusicEngine(ctx, M, { seed: o.seed || 7, log: true, maxActive: Infinity });
    eng.start(mood, 0);
    const secs = o.seconds || 600;
    for (let t = 20; t <= secs; t += 20) eng.advance(t, 0, false);
    const sections = new Set(eng.log.filter(e => e.inst === 'pad' || e.inst === 'str').map(e => Math.round(e.t / 5)));
    res[mood] = { keys: eng.keyLog, events: eng.log.length, voicesCreated: eng.log.length };
    eng.dispose();
  }
  return res;
}
