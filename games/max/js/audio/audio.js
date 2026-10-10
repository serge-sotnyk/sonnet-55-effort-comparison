// Age of Crowns - procedural audio. Public API of docs/AUDIO_SPEC.md:
//   audio.init() / resume() / ready / setMasterVolume / setSfxVolume / setMusicVolume / setAmbientVolume / setMuted
//   audio.play(name, { vol, pan, rate, delay })   audio.music.{start,stop,setMood,mood}   audio.ambient.{start,stop}
//   audio.duck(amount, seconds)   audio.stopAll()   SFX_NAMES
// Everything is synthesized with the Web Audio API (no asset files). Before init() every call is a silent no-op
// (volumes / mood / "want music" are remembered and applied when init() runs). play() never throws.
//
// Real-time safety: master compressor + soft clipper, global voice cap (28, lowest priority / quietest / oldest is stolen),
// per-name minimum interval, global spawn-rate limiter, per-voice clean teardown (disconnect after onended), a single
// bounded scheduler interval that only runs while something needs it.

import { createMaster } from './master.js';
import { spawnSfx, SFX_NAMES, sfxMeta, trimDb } from './sfx.js';
import { MusicEngine, MOODS } from './music.js';
import { Ambient } from './ambient.js';
import { stats, liveNodes, clamp, dbg } from './synth.js';

export { SFX_NAMES };

const MAKEUP = 2.8;               // master makeup gain (~ +9 dB): the calibrated recipes are deliberately quiet so dozens can overlap
const MAX_VOICES = 28;
const LOOKAHEAD = 0.4;            // seconds of music / ambience scheduled ahead (visible tab)
const LOOKAHEAD_HIDDEN = 3.0;     // background tabs throttle timers to ~1 Hz, schedule further ahead
const TICK_MS = 100;
const SPAWN_WINDOW_MS = 100, SPAWN_MAX = 14;   // global rate limit: max new voices per 100 ms (priority >= 4 exempt)

const S = {
  ctx: null, M: null, music: null, ambient: null,
  vol: { master: 1, sfx: 1, music: 1, ambient: 1 }, muted: false,
  wantMusic: false, wantAmbient: false, mood: 'peace',
  voices: [], last: new Map(), warned: new Set(), recent: [],
  timer: 0, unlock: null,
  duckTarget: 1, duckEnd: 0,
  dropped: { rate: 0, cap: 0, spawn: 0, quiet: 0 }, played: 0,
};

const num = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const warnOnce = (key, ...a) => { if (S.warned.size < 200 && !S.warned.has(key)) { S.warned.add(key); try { console.warn('[audio]', ...a); } catch (e) { /* ignore */ } } };
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* ------------------------------------------------------------------ context / graph */
function applyVolumes(immediate) {
  const { ctx, M } = S;
  if (!ctx || !M) return;
  const t = ctx.currentTime, tc = immediate ? 0.001 : 0.025;
  M.master.gain.setTargetAtTime(S.vol.master * MAKEUP, t, tc);
  M.sfx.gain.setTargetAtTime(S.vol.sfx, t, tc);
  M.music.gain.setTargetAtTime(S.vol.music, t, tc);
  M.amb.gain.setTargetAtTime(S.vol.ambient, t, tc);
  M.mute.gain.setTargetAtTime(S.muted ? 0 : 1, t, 0.03);
}

function installUnlock() {
  if (S.unlock || typeof window === 'undefined' || !window.addEventListener) return;
  const evs = ['pointerdown', 'keydown', 'touchend', 'click'];
  const h = () => {
    const c = S.ctx;
    if (!c) return;
    if (c.state === 'suspended' || c.state === 'interrupted') { try { c.resume().catch(() => { }); } catch (e) { /* ignore */ } }
    if (c.state === 'running') { for (const e of evs) window.removeEventListener(e, h, true); S.unlock = null; }
  };
  S.unlock = h;
  for (const e of evs) window.addEventListener(e, h, true);
}

function ensureTimer() {
  if (S.timer || !S.ctx) return;
  S.timer = setInterval(tick, TICK_MS);
}
function busy() {
  return !!(S.voices.length || (S.music && (S.music.running || S.music.busy)) || (S.ambient && (S.ambient.running || S.ambient.busy)));
}
let sweepCount = 0;
function tick() {
  const c = S.ctx;
  if (!c) { clearInterval(S.timer); S.timer = 0; return; }
  try {
    if (c.state === 'running') {
      const hidden = typeof document !== 'undefined' && document.hidden;
      const now = c.currentTime, until = now + (hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD);
      if (S.music) S.music.advance(until, now);
      if (S.ambient) S.ambient.advance(until, now);
      if ((++sweepCount % 5) === 0) sweepVoices(now);
    }
  } catch (e) { warnOnce('tick:' + (e && e.message), 'scheduler error', e); }
  if (!busy()) { clearInterval(S.timer); S.timer = 0; }
}
/** force-dispose voices whose sources should have ended long ago (onended never fired, e.g. suspended context) */
function sweepVoices(now) {
  const list = S.voices;
  for (let i = list.length - 1; i >= 0; i--) {
    const v = list[i];
    if (v.done || now > v.end + 1.5) { list.splice(i, 1); if (!v.done) v.dispose(); }
  }
}

function init() {
  if (S.ctx) { resume(); return; }
  try {
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { warnOnce('noac', 'Web Audio is not available - sound disabled'); return; }
    const ctx = new AC({ latencyHint: 'interactive' });
    const M = createMaster(ctx, { analyser: true });
    S.ctx = ctx; S.M = M;
    S.music = new MusicEngine(ctx, M);
    S.ambient = new Ambient(ctx, M);
    applyVolumes(true);
    installUnlock();
    try { ctx.onstatechange = () => { if (ctx.state === 'running') ensureTimer(); }; } catch (e) { /* ignore */ }
    if (ctx.state === 'suspended') { try { ctx.resume().catch(() => { }); } catch (e) { /* ignore */ } }
    // honour calls made before init()
    if (S.wantMusic) { S.music.start(S.mood); }
    if (S.wantAmbient) { S.ambient.start(); }
    if (busy()) ensureTimer();
  } catch (e) {
    S.ctx = null; S.M = null;
    warnOnce('init', 'audio init failed', e);
  }
}
function resume() {
  const c = S.ctx;
  if (!c) return;
  try { if (c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => { }); } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ voices */
function onVoiceDone(v) {
  const list = S.voices, i = list.indexOf(v);
  if (i >= 0) { list[i] = list[list.length - 1]; list.pop(); }
}
/** free a slot for a new voice with priority `prio` / loudness `vol`; false = the new sound loses */
function makeRoom(prio, vol) {
  const list = S.voices;
  if (list.length < MAX_VOICES) return true;
  let vi = -1, victim = null;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (!victim || v.prio < victim.prio || (v.prio === victim.prio && (v.vol < victim.vol * 0.9 || (v.vol <= victim.vol * 1.1 && v.t0 < victim.t0)))) { victim = v; vi = i; }
  }
  if (!victim) return true;
  if (prio < victim.prio || (prio === victim.prio && vol < victim.vol * 0.5)) return false;
  list.splice(vi, 1);
  victim.kill(0.03);
  return true;
}

function playImpl(name, o) {
  const ctx = S.ctx;
  if (!ctx) return;
  if (ctx.state !== 'running') { resume(); return; }
  const d = sfxMeta(name);
  if (!d) { warnOnce('sfx:' + name, 'unknown sound "' + name + '"'); return; }
  if (S.muted || S.vol.master < 0.001 || S.vol.sfx < 0.001) return;
  o = o || {};
  const uvol = clamp(num(o.vol, 1), 0, 3);
  const vol = uvol * dbg(trimDb(name));
  if (vol < 0.004) { S.dropped.quiet++; return; }
  const delay = clamp(num(o.delay, 0), 0, 20);
  const t0 = ctx.currentTime + 0.006 + delay;
  // per-name minimum interval (on the scheduled start time)
  const last = S.last.get(name);
  if (last !== undefined && Math.abs(t0 - last) < d.gap / 1000) { S.dropped.rate++; return; }
  // global spawn limiter
  const ms = nowMs(), rec = S.recent;
  while (rec.length && rec[0] < ms - SPAWN_WINDOW_MS) rec.shift();
  if (d.prio < 4 && rec.length >= SPAWN_MAX) { S.dropped.spawn++; return; }
  if (!makeRoom(d.prio, vol)) { S.dropped.cap++; return; }
  const g = spawnSfx(name, ctx, S.M, { vol: uvol, pan: num(o.pan, 0), rate: num(o.rate, 1), t0, onDispose: onVoiceDone });
  if (!g) return;
  S.last.set(name, t0); rec.push(ms); S.played++;
  if (!g.done) { S.voices.push(g); ensureTimer(); }
  if (d.duck) duck(d.duck[0], d.duck[1], t0);
}

function play(name, opts) {
  try { playImpl(name, opts); } catch (e) { warnOnce('play:' + name, 'play("' + name + '") failed:', e); }
}

/* ------------------------------------------------------------------ ducking */
function duck(amount, seconds, at) {
  const c = S.ctx;
  if (!c || !S.M) return;
  try {
    const target = 1 - clamp(num(amount, 0.5), 0, 0.92), secs = clamp(num(seconds, 1), 0.05, 30);
    const now = c.currentTime, T = Math.max(now, at == null ? now : at);
    if (T < S.duckEnd) { S.duckTarget = Math.min(S.duckTarget, target); S.duckEnd = Math.max(S.duckEnd, T + secs); }
    else { S.duckTarget = target; S.duckEnd = T + secs; }
    const g = S.M.duck.gain;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(S.duckTarget, T, 0.08);
    g.setTargetAtTime(1, S.duckEnd, 0.5);
  } catch (e) { warnOnce('duck', 'duck failed', e); }
}

/* ------------------------------------------------------------------ music / ambient facades */
const music = {
  start() {
    S.wantMusic = true;
    if (!S.ctx) return;
    try { S.music.start(S.mood); ensureTimer(); resume(); } catch (e) { warnOnce('music.start', 'music.start failed', e); }
  },
  stop() {
    S.wantMusic = false;
    if (!S.ctx) return;
    try { S.music.stop(); ensureTimer(); } catch (e) { warnOnce('music.stop', 'music.stop failed', e); }
  },
  setMood(m) {
    if (!MOODS.includes(m)) { warnOnce('mood:' + m, 'unknown music mood "' + m + '" (peace | tense | battle)'); return; }
    S.mood = m;
    if (!S.ctx) return;
    try { S.music.setMood(m); ensureTimer(); } catch (e) { warnOnce('music.mood', 'music.setMood failed', e); }
  },
  get mood() { return S.mood; },
};
const ambient = {
  start() {
    S.wantAmbient = true;
    if (!S.ctx) return;
    try { S.ambient.start(); ensureTimer(); resume(); } catch (e) { warnOnce('amb.start', 'ambient.start failed', e); }
  },
  stop() {
    S.wantAmbient = false;
    if (!S.ctx) return;
    try { S.ambient.stop(); ensureTimer(); } catch (e) { warnOnce('amb.stop', 'ambient.stop failed', e); }
  },
};

function stopAll() {
  S.wantMusic = false; S.wantAmbient = false;
  const c = S.ctx;
  if (!c) return;
  try {
    for (const v of S.voices.splice(0)) v.kill(0.04);
    S.last.clear(); S.recent.length = 0;
    S.music.stop(undefined, 0.5); S.ambient.stop(undefined, 0.6);
    const g = S.M.duck.gain; g.cancelScheduledValues(c.currentTime); g.setTargetAtTime(1, c.currentTime, 0.05); S.duckEnd = 0;
    ensureTimer();
  } catch (e) { warnOnce('stopAll', 'stopAll failed', e); }
}

/* ------------------------------------------------------------------ public object */
const vset = (key) => (v) => { S.vol[key] = clamp(num(v, 1), 0, 1); applyVolumes(false); };

export const audio = {
  init, resume,
  get ready() { return !!S.ctx && S.ctx.state !== 'closed'; },
  setMasterVolume: vset('master'),
  setSfxVolume: vset('sfx'),
  setMusicVolume: vset('music'),
  setAmbientVolume: vset('ambient'),
  setMuted(b) { S.muted = !!b; applyVolumes(false); },
  play, music, ambient, duck: (a, s) => duck(a, s), stopAll,
  /** diagnostics (not part of the contract): voice / node counters and the live graph */
  get debug() {
    return {
      ctx: S.ctx, master: S.M, voices: S.voices.length, played: S.played, dropped: { ...S.dropped },
      liveNodes: liveNodes(), created: stats.created, disposed: stats.disposed,
      musicActive: S.music ? S.music.active : 0, musicParts: S.music ? S.music.parts.length : 0, timer: !!S.timer,
    };
  },
};

/** test helper: schedule a recipe on ANY BaseAudioContext (e.g. OfflineAudioContext) through a fresh or given master graph */
export function renderSfx(name, ctx, opts = {}) {
  const master = opts.master || createMaster(ctx);
  const voice = spawnSfx(name, ctx, master, { ...opts, t0: opts.t0 == null ? 0 : opts.t0 });
  return { voice, master };
}

export default audio;
