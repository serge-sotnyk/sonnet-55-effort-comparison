/* AudioSys - procedural audio engine (SFX, voices, music, ambient). Plain browser JS, no deps. */
(function () {
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;
  var AS = { unlocked: false, lastVoice: null };
  W.AudioSys = AS;

  var ctx = null, master = null, comp = null, chan = {}, ambBus = null, inited = false;
  var noiseBuf = null, activeV = 0, lastSfx = {}, timers = [];
  var CH = ['music', 'sfx', 'voice'];
  var vols = { music: 0.5, sfx: 0.7, voice: 0.9 }, mutes = { music: false, sfx: false, voice: false };
  try {
    var sv = JSON.parse(W.localStorage.getItem('aoe_audio') || 'null');
    if (sv) CH.forEach(function (c) {
      if (sv.vol && typeof sv.vol[c] === 'number') vols[c] = Math.max(0, Math.min(1, sv.vol[c]));
      if (sv.mute && typeof sv.mute[c] === 'boolean') mutes[c] = sv.mute[c];
    });
  } catch (e) {}
  function save() { try { W.localStorage.setItem('aoe_audio', JSON.stringify({ vol: vols, mute: mutes })); } catch (e) {} }
  function applyVol(c) {
    if (!chan[c]) return;
    try { chan[c].gain.setTargetAtTime(mutes[c] ? 0 : vols[c], ctx.currentTime, 0.03); } catch (e) {}
  }
  AS.setVol = function (c, v) { if (CH.indexOf(c) < 0) return; v = +v; if (!(v >= 0)) v = 0; vols[c] = Math.min(1, v); save(); applyVol(c); };
  AS.getVol = function (c) { return vols[c] == null ? 0 : vols[c]; };
  AS.setMute = function (c, b) { if (CH.indexOf(c) < 0) return; mutes[c] = !!b; save(); applyVol(c);
    if (c === 'voice' && b) { try { W.speechSynthesis && W.speechSynthesis.cancel(); } catch (e) {} stopFormant(); } };
  AS.getMute = function (c) { return !!mutes[c]; };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function every(fn, ms) { var id = setInterval(function () { try { fn(); } catch (e) {} }, ms); timers.push(id); return id; }
  function later(fn, ms) { var id = setTimeout(function () { try { fn(); } catch (e) {} }, ms); return id; }

  /* ---------- primitives ---------- */
  function env(t, dur, vol, att) {
    att = att == null ? 0.005 : att;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(vol, 0.0002), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, att + 0.01));
    return g;
  }
  function envS(t, dur, vol, att, rel) { // sustained
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }
  function T(out, type, f1, f2, t, dur, vol, att, lp) {
    var o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f1, t);
    if (f2 && f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = env(t, dur, vol, att), n = o;
    if (lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); n = f; }
    n.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function N(out, t, dur, vol, ft, f1, f2, q, att) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = ft; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f1, t);
    if (f2 && f2 !== f1) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = env(t, dur, vol, att);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s;
  }
  function P(out, t, f, ratios, dec, vol, type) { // inharmonic partials
    ratios.forEach(function (r, i) { T(out, type || 'sine', f * r, f * r, t, dec / (1 + i * 0.35), vol / (1 + i * 0.5), 0.003); });
  }
  function FB(out, t, dur, f0, f0b, forms, vol, att, rel, vib) { // formant buzz
    var o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0b || f0, t + dur);
    var g = envS(t, dur, vol, att, rel);
    forms.forEach(function (fm) {
      var b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fm[0]; b.Q.value = fm[1] || 6;
      var gg = ctx.createGain(); gg.gain.value = fm[2] == null ? 1 : fm[2];
      o.connect(b); b.connect(gg); gg.connect(g);
    });
    if (vib) { var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib[0]; lg.gain.value = vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
    g.connect(out); o.start(t); o.stop(t + dur + 0.1); return o;
  }
  function mkNoise() {
    var n = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /* ---------- SFX ---------- */
  var S = {};
  S.click = function (o, t) { T(o, 'sine', 1300, 800, t, 0.05, 0.4); N(o, t, 0.02, 0.15, 'highpass', 4000); return 0.1; };
  S.error = function (o, t) { T(o, 'square', 190, 180, t, 0.13, 0.25, 0.005, 900); T(o, 'square', 140, 130, t + 0.14, 0.2, 0.25, 0.005, 800); return 0.4; };
  S.chop = function (o, t) { N(o, t, 0.05, 0.6, 'bandpass', 1100, 700, 1.2); T(o, 'sine', 170, 65, t, 0.14, 0.8); N(o, t + 0.02, 0.1, 0.25, 'lowpass', 500); return 0.3; };
  S.mine = function (o, t) { N(o, t, 0.03, 0.5, 'highpass', 3500); P(o, t, 1850, [1, 1.52, 2.43], 0.3, 0.35, 'triangle'); T(o, 'sine', 120, 70, t, 0.08, 0.4); return 0.4; };
  S.hammer = function (o, t) { [0, 0.2].forEach(function (d) { T(o, 'sine', 240, 110, t + d, 0.09, 0.7); N(o, t + d, 0.04, 0.4, 'bandpass', 1600, 900, 2); }); return 0.4; };
  S.farm = function (o, t) { N(o, t, 0.4, 0.25, 'bandpass', 3200, 2400, 0.7, 0.12); N(o, t + 0.12, 0.25, 0.15, 'highpass', 5000, 3000, 1, 0.08); return 0.5; };
  S.stab = function (o, t) { N(o, t, 0.1, 0.35, 'highpass', 2500, 5000); T(o, 'sine', 130, 60, t + 0.08, 0.1, 0.6); N(o, t + 0.08, 0.1, 0.3, 'lowpass', 700); return 0.3; };
  S.slash = function (o, t) { N(o, t, 0.15, 0.4, 'bandpass', 3000, 6000, 1.5); P(o, t + 0.1, 1700, [1, 1.62, 2.4, 3.3], 0.4, 0.3, 'triangle'); N(o, t + 0.1, 0.03, 0.4, 'highpass', 4000); return 0.5; };
  S.arrow = function (o, t) { N(o, t, 0.25, 0.3, 'bandpass', 3500, 900, 2, 0.1); T(o, 'sine', 120, 60, t + 0.25, 0.1, 0.6); N(o, t + 0.25, 0.06, 0.3, 'lowpass', 900); return 0.4; };
  S.hit = function (o, t) { T(o, 'sine', 150, 50, t, 0.13, 0.9); N(o, t, 0.08, 0.5, 'lowpass', 700, 300); return 0.2; };
  S.bash = function (o, t) { T(o, 'sine', 95, 32, t, 0.4, 1); N(o, t, 0.3, 0.6, 'lowpass', 500, 120); N(o, t, 0.06, 0.5, 'bandpass', 1300, 800, 1); return 0.5; };
  S.explode = function (o, t) { N(o, t, 1.7, 1, 'lowpass', 1800, 90, 0.8, 0.01); T(o, 'sine', 80, 22, t, 1.3, 1); N(o, t + 0.1, 1.0, 0.3, 'bandpass', 600, 200, 0.5); for (var i = 0; i < 6; i++) N(o, t + 0.2 + i * 0.1, 0.05, 0.2, 'highpass', 3000); return 1.8; };
  S.crumble = function (o, t) { N(o, t, 1.9, 0.7, 'lowpass', 350, 70, 0.7, 0.2); T(o, 'sine', 55, 30, t, 1.8, 0.5, 0.2); for (var i = 0; i < 12; i++) { var d = rnd(0.1, 1.6); N(o, t + d, 0.05, 0.3, 'bandpass', rnd(500, 1800), null, 2); } return 2; };
  S.splash = function (o, t) { N(o, t, 0.45, 0.5, 'bandpass', 1200, 3200, 0.8, 0.03); for (var i = 0; i < 4; i++) T(o, 'sine', rnd(350, 600), rnd(800, 1400), t + 0.05 + i * 0.07, 0.07, 0.15); return 0.6; };
  S.sink = function (o, t) { T(o, 'sine', 320, 55, t, 1.6, 0.5, 0.05); N(o, t, 1.3, 0.4, 'lowpass', 600, 150, 0.7, 0.05); for (var i = 0; i < 7; i++) T(o, 'sine', rnd(300, 500), rnd(700, 1000), t + 0.2 + i * 0.16, 0.08, 0.15); return 1.7; };
  S.bell = function (o, t) { var f = 330, r = [0.5, 1, 1.19, 1.56, 2.0, 2.51, 3.0, 4.07]; r.forEach(function (x, i) { T(o, 'sine', f * x, f * x, t, 4.2 / (1 + i * 0.3), 0.5 / (1 + i * 0.45), 0.002); }); N(o, t, 0.03, 0.3, 'highpass', 3000); return 4.3; };
  function brass(o, t, f, d, v) { T(o, 'sawtooth', f, f, t, d, v, 0.03, 1800); T(o, 'square', f * 1.005, f * 1.005, t, d, v * 0.5, 0.03, 1200); }
  S.ageup = function (o, t) { [[262, 0], [392, 0.2], [523, 0.4], [659, 0.6], [784, 0.85]].forEach(function (n, i) { brass(o, t + n[1], n[0], i === 4 ? 0.9 : 0.25, 0.25); }); T(o, 'triangle', 131, 131, t + 0.85, 0.9, 0.3); return 1.8; };
  S.build_done = function (o, t) { N(o, t, 0.04, 0.4, 'bandpass', 1500, 900, 2); T(o, 'sine', 220, 110, t, 0.09, 0.5); [392, 494, 659].forEach(function (f, i) { T(o, 'triangle', f, f, t + 0.15 + i * 0.12, 0.35, 0.3, 0.01); }); return 0.8; };
  S.convert = function (o, t) { [220, 277, 330, 440].forEach(function (f, i) { FB(o, t + i * 0.05, 2, f, f, [[800, 8, 1], [1200, 8, 0.5], [2600, 10, 0.2]], 0.12, 0.5, 0.8, [5.5, f * 0.012]); }); [1760, 2217, 2637].forEach(function (f, i) { T(o, 'sine', f, f, t + 0.3 + i * 0.2, 1.2, 0.06, 0.4); }); return 2.2; };
  S.heal = function (o, t) { [1320, 1760, 2093].forEach(function (f, i) { T(o, 'sine', f, f, t + i * 0.1, 0.6, 0.25, 0.005); T(o, 'sine', f * 2.01, f * 2.01, t + i * 0.1, 0.3, 0.05); }); return 0.8; };
  S.sheep = function (o, t) { FB(o, t, 0.7, 340, 300, [[850, 7, 1], [1500, 8, 0.6], [2700, 8, 0.2]], 0.5, 0.05, 0.2, [28, 40]); T(o, 'sine', 600, 500, t, 0.5, 0.03); return 0.8; };
  S.wolf = function (o, t) { var g = ctx.createGain(); g.gain.value = 1; g.connect(o); var f = ctx.createOscillator(); f.type = 'sawtooth';
    f.frequency.setValueAtTime(280, t); f.frequency.linearRampToValueAtTime(620, t + 0.7); f.frequency.linearRampToValueAtTime(560, t + 1.4); f.frequency.linearRampToValueAtTime(330, t + 2.1);
    var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = 10; l.connect(lg); lg.connect(f.frequency);
    var e = envS(t, 2.2, 0.4, 0.3, 0.7), b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 900; b.Q.value = 1.5;
    f.connect(b); b.connect(e); e.connect(g); f.start(t); l.start(t); f.stop(t + 2.3); l.stop(t + 2.3); return 2.3; };
  S.deer = function (o, t) { FB(o, t, 0.28, 520, 360, [[1000, 6, 1], [2100, 8, 0.4]], 0.4, 0.02, 0.1); N(o, t, 0.2, 0.1, 'bandpass', 1800, null, 3); return 0.4; };
  S.boar = function (o, t) { [0, 0.28].forEach(function (d) { FB(o, t + d, 0.22, 95, 70, [[300, 5, 1], [900, 5, 0.5]], 0.7, 0.02, 0.1, [40, 15]); N(o, t + d, 0.2, 0.3, 'bandpass', 400, 250, 1.5); }); return 0.6; };
  S.horn = function (o, t) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(o);
    [220, 221.5, 110].forEach(function (fr, i) { var s = ctx.createOscillator(); s.type = i === 2 ? 'square' : 'sawtooth'; s.frequency.setValueAtTime(fr * 0.95, t); s.frequency.linearRampToValueAtTime(fr, t + 0.25);
      var e = envS(t, 1.6, i === 2 ? 0.15 : 0.3, 0.15, 0.4); s.connect(e); e.connect(f); s.start(t); s.stop(t + 1.7); }); return 1.7; };
  S.alert = function (o, t) { for (var i = 0; i < 3; i++) { brass(o, t + i * 0.28, i % 2 ? 392 : 523, 0.24, 0.3); } return 1; };
  S.coin = function (o, t) { [1976, 2637].forEach(function (f, i) { P(o, t + i * 0.07, f, [1, 2.76], 0.35, 0.25, 'triangle'); }); N(o, t, 0.02, 0.2, 'highpass', 6000); return 0.5; };
  S.catapult = function (o, t) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(70, t); s.frequency.linearRampToValueAtTime(150, t + 0.6);
    var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 24; lg.gain.value = 25; l.connect(lg); lg.connect(s.frequency);
    var e = env(t, 0.65, 0.35, 0.1), b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 500; b.Q.value = 3; s.connect(b); b.connect(e); e.connect(o);
    s.start(t); l.start(t); s.stop(t + 0.7); l.stop(t + 0.7); N(o, t + 0.6, 0.4, 0.4, 'bandpass', 1800, 400, 1); T(o, 'sine', 100, 40, t + 0.62, 0.15, 0.6); return 1.1; };
  S.fire = function (o, t) { N(o, t, 1.3, 0.25, 'lowpass', 400, 250, 0.7, 0.1); for (var i = 0; i < 22; i++) N(o, t + rnd(0, 1.2), rnd(0.01, 0.03), rnd(0.2, 0.5), 'highpass', rnd(1500, 4500)); return 1.4; };
  S.cheat = function (o, t) { [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { T(o, 'triangle', f, f, t + i * 0.07, 0.3, 0.25, 0.005); T(o, 'sine', f * 2, f * 2, t + i * 0.07, 0.15, 0.06); }); return 0.8; };
  S.gun = function (o, t) { for (var i = 0; i < 8; i++) { var d = i * 0.06; N(o, t + d, 0.05, 0.5 - (i % 2) * 0.12, 'bandpass', 1800, 900, 0.9, 0.002); T(o, 'square', 130, 55, t + d, 0.05, 0.3, 0.002, 900); } return 0.6; };
  S.engine = function (o, t) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(48, t); s.frequency.exponentialRampToValueAtTime(130, t + 0.7); s.frequency.exponentialRampToValueAtTime(70, t + 1);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450; var m = ctx.createGain(); m.gain.value = 0.6;
    var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 26; lg.gain.value = 0.35; l.connect(lg); lg.connect(m.gain);
    var e = envS(t, 1.05, 0.5, 0.08, 0.3); s.connect(lp); lp.connect(m); m.connect(e); e.connect(o); s.start(t); l.start(t); s.stop(t + 1.1); l.stop(t + 1.1);
    N(o, t, 1, 0.12, 'lowpass', 300, 600, 0.5, 0.1); return 1.1; };
  S.trade = function (o, t) { T(o, 'sine', 160, 90, t, 0.1, 0.5); N(o, t, 0.08, 0.2, 'bandpass', 800, null, 2); [2093, 2794, 2349].forEach(function (f, i) { P(o, t + 0.12 + i * 0.09, f, [1, 2.76], 0.3, 0.2, 'triangle'); }); return 0.7; };
  S.horse = function (o, t) { [0, 0.11, 0.2, 0.36, 0.47, 0.56].forEach(function (d, i) { N(o, t + d, 0.06, 0.45, 'bandpass', 700 + (i % 3) * 120, 400, 2); T(o, 'sine', 210, 100, t + d, 0.06, 0.4); }); return 0.8; };
  S.death = function (o, t) { FB(o, t, 0.45, 170, 70, [[500, 5, 1], [1000, 6, 0.5]], 0.6, 0.02, 0.2); N(o, t, 0.3, 0.2, 'bandpass', 500, null, 1); T(o, 'sine', 110, 50, t + 0.35, 0.15, 0.4); return 0.6; };
  AS.sfxNames = Object.keys(S);

  AS.sfx = function (name, opts) {
    try {
      if (!inited || !ctx || !S[name]) return null;
      var now = Date.now();
      if (lastSfx[name] && now - lastSfx[name] < 80) return null;
      if (activeV >= 14) return null;
      lastSfx[name] = now; opts = opts || {};
      var g = ctx.createGain(); g.gain.value = opts.vol == null ? 1 : Math.max(0, Math.min(1, opts.vol));
      var out = g;
      if (ctx.createStereoPanner && opts.pan) { var p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); g.connect(p); out = p; }
      out.connect(chan.sfx);
      var d = S[name](g, ctx.currentTime + 0.005) || 1;
      activeV++; later(function () { activeV = Math.max(0, activeV - 1); }, d * 1000 + 100);
      return name;
    } catch (e) { return null; }
  };

  /* ---------- Voice lines ---------- */
  // 'text|romanization' (rom optional for latin scripts)
  var L = {
    britons: { lang: ['cy-GB', 'cy'],
      vil: { select: ['Ie, arglwydd?', 'Beth sydd?', 'Dwi yma.'], move: ['I ffwrdd â mi.', 'Ar fy ffordd.', 'Mi af.'], attack: ['Amddiffyn!', "I'r gad!", 'Cymer hynny!'], gather: ['Gwaith da.', 'Cynhaeaf.'], build: ['Adeiladu.', "Codi'r mur."], garrison: ["I'r gaer!", 'Cysgod!'], repair: ['Trwsio.', 'Mi drwsiaf.'], trade: ['Masnach dda.', "I'r farchnad."] },
      mil: { select: ['Parod!', 'Dros Gymru!', 'Gorchmynnwch.'], move: ['Ymlaen!', 'Martsio.', "I'r maes."], attack: ['Ymosod!', 'Am Brydain!', 'Heb drugaredd!'], garrison: ["I'r castell!", 'Daliwch y mur!'] },
      pre: { cav: 'Marchogion!', siege: 'Tân a maen!', ship: "I'r môr!" } },
    franks: { lang: ['fr-FR', 'fr'],
      vil: { select: ['Oui, messire?', 'Je vous écoute.', 'À votre service.'], move: ["J'y vais.", 'Bien, messire.', 'En chemin.'], attack: ["À l'aide!", 'Au secours!', 'Sus!'], gather: ['À la besogne.', 'Le pain du jour.'], build: ['Je bâtis.', 'Pierre sur pierre.'], garrison: ["À l'abri!", 'Au château!'], repair: ['Je répare.', 'Rien de cassé.'], trade: ['Bon marché.', 'Beau négoce.'] },
      mil: { select: ['Sire?', 'Montjoie!', 'À vos ordres.'], move: ['En avant!', 'Marchons.', 'Par ici.'], attack: ["À l'attaque!", 'Pour la France!', 'Chargez!'], garrison: ['Gardez les murs!', 'Au donjon!'] },
      pre: { cav: 'Chevaliers!', siege: 'Feu et pierre!', ship: 'À la mer!' } },
    goths: { lang: ['de-DE', 'de'],
      vil: { select: ['Frauja?', 'Hails!', 'Ik hausja.'], move: ['Ik gagga.', 'Gaggam.', 'Jai, frauja.'], attack: ['Hjalp!', 'Gaarmjan!', 'Ni! Ni!'], gather: ['Arbaiþs.', 'Akrs.'], build: ['Timrja.', 'Razn timrjan.'], garrison: ['Du razna!', 'Ga-hlaiba!'], repair: ['Hailja.', 'Aftra timrja.'], trade: ['Kaupon.', 'Skatts.'] },
      mil: { select: ['Frauja!', 'Hausja!', 'Du waihtai.'], move: ['Gaggam!', 'Framis!', 'Iddja!'], attack: ['Du drauhtinon!', 'Waurþi!', 'Sleipa!'], garrison: ['Du baurgs!', 'Haldaiþ waggs!'] },
      pre: { cav: 'Reiks!', siege: 'Funin!', ship: 'Marei!' } },
    byzantines: { lang: ['el-GR', 'el'],
      vil: { select: ['Ναι;|nai', 'Τι θέλεις;|ti thelis', 'Κύριε;|kirie'], move: ['Πηγαίνω.|pigheno', 'Έρχομαι.|erchome', 'Αμέσως.|amesos'], attack: ['Βοήθεια!|voithia', 'Σώστε με!|soste me', 'Φύγετε!|figete'], gather: ['Δουλειά.|dhoulia', 'Καρπός.|karpos'], build: ['Χτίζω.|chtizo', 'Πέτρα πέτρα.|petra petra'], garrison: ['Στο φρούριο!|sto frourio', 'Μέσα!|mesa'], repair: ['Επισκευή.|episkevi', 'Το φτιάχνω.|to ftiachno'], trade: ['Εμπόριο.|emporio', 'Καλή τιμή.|kali timi'] },
      mil: { select: ['Βασιλεύ;|vasilev', 'Προσταγή;|prostaghi', 'Έτοιμος.|etimos'], move: ['Εμπρός!|embros', 'Βαδίζομεν.|vadhizomen', 'Πορεία!|poreia'], attack: ['Επίθεση!|epithesi', 'Νίκη!|niki', 'Για την Ρωμανία!|gia tin romania'], garrison: ['Στα τείχη!|sta tichi', 'Κρατάτε!|kratate'] },
      pre: { cav: 'Καταφράκτοι!|kataphraktoi', siege: 'Πυρ!|pir', ship: 'Στη θάλασσα!|sti thalassa' } },
    japanese: { lang: ['ja-JP', 'ja'],
      vil: { select: ['はい？|hai', '何でしょう？|nan deshou', 'お呼びで？|oyobi de'], move: ['参ります。|mairimasu', 'ただちに。|tadachi ni', '行きます。|ikimasu'], attack: ['助けて！|tasukete', '敵だ！|teki da', '逃げろ！|nigero'], gather: ['働きます。|hatarakimasu', '精が出る。|sei ga deru'], build: ['建てます。|tatemasu', '普請じゃ。|fushin ja'], garrison: ['城へ！|shiro e', '隠れよ！|kakure yo'], repair: ['直します。|naoshimasu', '修理。|shuuri'], trade: ['商いじゃ。|akinai ja', '良い値。|yoi ne'] },
      mil: { select: ['御意。|gyoi', '殿？|tono', 'お任せを。|omakase wo'], move: ['進軍！|shingun', '参る！|mairu', 'いざ！|iza'], attack: ['突撃！|totsugeki', '天誅！|tenchuu', '覚悟！|kakugo'], garrison: ['城を守れ！|shiro wo mamore', '籠城！|rojou'] },
      pre: { cav: '騎馬武者！|kiba musha', siege: '大筒！|oozutsu', ship: '出航！|shukkou' } },
    mongols: { lang: ['mn-MN', 'mn', 'ru-RU', 'ru'],
      vil: { select: ['Тийм?|tiim', 'Сонсож байна.|sonsoj baina', 'Захиалга?|zakhialga'], move: ['Явлаа.|yavlaa', 'Одоо.|odoo', 'За за.|za za'], attack: ['Туслаарай!|tuslaarai', 'Дайсан!|daisan', 'Зугт!|zugt'], gather: ['Ажил.|ajil', 'Бэлтгэнэ.|beltgene'], build: ['Барина.|barina', 'Гэр барих.|ger barikh'], garrison: ['Хоргод!|khorgod', 'Дотогш!|dotogsh'], repair: ['Засна.|zasna', 'Янзална.|yanzalna'], trade: ['Наймаа.|naimaa', 'Сайн үнэ.|sain une'] },
      mil: { select: ['Тушаал?|tushaal', 'Хаан минь!|khaan min', 'Бэлэн.|belen'], move: ['Урагшаа!|uragshaa', 'Явъя!|yavya', 'Давхи!|davkhi'], attack: ['Дайл!|dail', 'Алагтун!|alagtun', 'Хурай!|khurai'], garrison: ['Цайзыг хамгаал!|tsaizig khamgaal', 'Хана!|khana'] },
      pre: { cav: 'Морьтон!|morton', siege: 'Галд!|gald', ship: 'Далайд!|dalaid' } },
    vikings: { lang: ['nb-NO', 'no-NO', 'nn-NO', 'no', 'nb', 'sv-SE', 'da-DK'],
      vil: { select: ['Já, herra?', 'Hvat er?', 'Ek heyri.'], move: ['Ek fer.', 'Á leið.', 'Skjótt.'], attack: ['Hjálp!', 'Óvinr!', 'Flýið!'], gather: ['Verk er gótt.', 'Ek vinn.'], build: ['Ek smíða.', 'Reisa hús.'], garrison: ['Í borg!', 'Skjól!'], repair: ['Ek bæti.', 'Gera við.'], trade: ['Kaup.', 'Góðr prís.'] },
      mil: { select: ['Jarl?', 'Skál!', 'Til reiðu.'], move: ['Fram!', 'Vér förum.', 'Á skip!'], attack: ['Til orrustu!', 'Fyrir Óðin!', 'Drepa!'], garrison: ['Halda borg!', 'Skjaldborg!'] },
      pre: { cav: 'Riddarar!', siege: 'Eldr!', ship: 'Á haf!' } },
    saracens: { lang: ['ar-SA', 'ar'],
      vil: { select: ['نعم؟|naam', 'ماذا تريد؟|madha turid', 'يا سيدي؟|ya sayyidi'], move: ['حاضر.|hadir', 'أذهب.|adhhab', 'على الفور.|ala alfawr'], attack: ['النجدة!|annajda', 'العدو!|al aduww', 'اهربوا!|ihrabu'], gather: ['عمل.|amal', 'حصاد.|hasad'], build: ['أبني.|abni', 'بناء.|bina'], garrison: ['إلى الحصن!|ila alhisn', 'اختبئوا!|ikhtabiu'], repair: ['أصلح.|uslih', 'إصلاح.|islah'], trade: ['تجارة.|tijara', 'سعر جيد.|sir jayyid'] },
      mil: { select: ['أمرك.|amruk', 'يا أمير!|ya amir', 'جاهز.|jahiz'], move: ['إلى الأمام!|ila alamam', 'نسير.|nasir', 'هيا!|hayya'], attack: ['هجوم!|hujum', 'الله أكبر!|allahu akbar', 'للنصر!|linnasr'], garrison: ['احموا القلعة!|ihmu alqala', 'الأسوار!|alaswar'] },
      pre: { cav: 'الفرسان!|alfursan', siege: 'المنجنيق!|almanjaniq', ship: 'إلى البحر!|ila albahr' } },
    teutons: { lang: ['de-DE', 'de'],
      vil: { select: ['Ja, Herr?', "Was gibt's?", 'Zu Diensten.'], move: ['Ich gehe.', 'Sofort.', 'Auf dem Weg.'], attack: ['Hilfe!', 'Der Feind!', 'Lauft!'], gather: ['Fleißige Arbeit.', 'Ernte.'], build: ['Ich baue.', 'Stein auf Stein.'], garrison: ['In die Burg!', 'Schnell hinein!'], repair: ['Ich flicke.', 'Wird repariert.'], trade: ['Guter Handel.', 'Gutes Geschäft.'] },
      mil: { select: ['Jawohl!', 'Herr Ritter?', 'Bereit.'], move: ['Vorwärts!', 'Marsch!', 'Wir ziehen.'], attack: ['Angriff!', 'Für Gott und Reich!', 'Zum Sturm!'], garrison: ['Haltet die Mauer!', 'In die Festung!'] },
      pre: { cav: 'Ritter!', siege: 'Feuer frei!', ship: 'Segel setzen!' } },
    chinese: { lang: ['zh-CN', 'zh'],
      vil: { select: ['什么事？|shen me shi', '请吩咐。|qing fen fu', '我在。|wo zai'], move: ['这就去。|zhe jiu qu', '遵命。|zun ming', '好的。|hao de'], attack: ['救命！|jiu ming', '敌人！|di ren', '快逃！|kuai tao'], gather: ['干活了。|gan huo le', '收成。|shou cheng'], build: ['我来建。|wo lai jian', '盖房子。|gai fang zi'], garrison: ['进城！|jin cheng', '躲起来！|duo qi lai'], repair: ['修理。|xiu li', '补好了。|bu hao le'], trade: ['做买卖。|zuo mai mai', '好价钱。|hao jia qian'] },
      mil: { select: ['将军？|jiang jun', '听令！|ting ling', '准备好了。|zhun bei hao le'], move: ['前进！|qian jin', '出发！|chu fa', '行军！|xing jun'], attack: ['杀！|sha', '冲锋！|chong feng', '为了大明！|wei le da ming'], garrison: ['守城！|shou cheng', '守住城墙！|shou zhu cheng qiang'] },
      pre: { cav: '骑兵！|qi bing', siege: '放炮！|fang pao', ship: '起航！|qi hang' } }
  };
  var MONK = { lang: ['it-IT', 'it'], select: ['Dominus vobiscum.', 'Pax tecum.', 'Quid vis, fili?'], move: ['Eamus.', 'In nomine Patris.', 'Vado.'], attack: ['Deus vult!', 'Converte te!', 'Ora pro nobis!'], heal: ['Sana te, Domine.', 'Sanabo te.', 'Benedictio.'], garrison: ['In ecclesiam.', 'Refugium.'] };
  AS.civs = Object.keys(L);
  var KINDS = { vil: { p: 1.18, r: 1.0, f0: 165 }, mil: { p: 0.85, r: 1.05, f0: 108 }, cav: { p: 0.8, r: 1.1, f0: 100 }, monk: { p: 0.95, r: 0.88, f0: 125 }, siege: { p: 0.75, r: 1.0, f0: 92 }, ship: { p: 0.8, r: 1.0, f0: 100 } };

  function parse(s) { var a = s.split('|'); return { text: a[0], rom: a[1] || a[0] }; }
  var poolCache = {};
  function getPool(civ, kind, action) {
    var key = civ + '|' + kind + '|' + action;
    if (poolCache[key]) return poolCache[key];
    var data = L[civ], arr = null, lang;
    if (!KINDS[kind] || !data) return null;
    if (kind === 'monk') {
      lang = MONK.lang; var a = action;
      if (!MONK[a] || a === 'lang') a = (a === 'build' || a === 'gather' || a === 'repair' || a === 'trade') ? 'move' : 'select';
      arr = MONK[a].map(parse);
      // monk speaks Latin lines for any civ; pools differ by civ key only in the no-repeat memory
    } else if (kind === 'vil') {
      lang = data.lang; var va = action === 'heal' ? 'select' : action;
      arr = (data.vil[va] || data.vil.select).map(parse);
    } else {
      lang = data.lang; var m = action;
      if (m === 'heal') m = 'select';
      else if (!data.mil[m]) m = 'move';
      arr = data.mil[m].map(parse);
      if (kind !== 'mil') { var pr = parse(data.pre[kind]); arr = arr.map(function (l) { return { text: pr.text + ' ' + l.text, rom: pr.rom + ' ' + l.rom }; }); }
    }
    return (poolCache[key] = { lines: arr, lang: lang });
  }

  /* ---------- Speech engine ---------- */
  var synth = null, svoices = [], lastStart = 0, lastIdx = {}, lastEngine = null, curUtt = null;
  try {
    synth = W.speechSynthesis || null;
    if (synth) {
      var refresh = function () { try { svoices = synth.getVoices() || []; } catch (e) { svoices = []; } };
      refresh();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', refresh); else synth.onvoiceschanged = refresh;
    }
  } catch (e) { synth = null; }
  function findVoice(langs) {
    if (!synth) return null;
    if (!svoices.length) { try { svoices = synth.getVoices() || []; } catch (e) {} }
    var n = function (s) { return String(s || '').toLowerCase().replace('_', '-'); };
    for (var i = 0; i < langs.length; i++) {
      var l = n(langs[i]), pre = l.split('-')[0], j;
      for (j = 0; j < svoices.length; j++) if (n(svoices[j].lang) === l) return svoices[j];
      for (j = 0; j < svoices.length; j++) if (n(svoices[j].lang).split('-')[0] === pre) return svoices[j];
    }
    return null;
  }
  AS.voiceInfo = function () {
    var cnt = svoices.length;
    if (synth && !cnt) { try { cnt = (synth.getVoices() || []).length; } catch (e) {} }
    return { engine: lastEngine || ((synth && cnt) ? 'speechSynthesis' : 'formant'), voices: cnt };
  };

  /* ---------- Formant fallback ---------- */
  var VOW = { a: [800, 1200, 2500], e: [500, 1800, 2500], i: [300, 2250, 3000], o: [500, 900, 2500], u: [320, 800, 2400], y: [300, 2000, 2800] };
  var SON = { m: [250, 1100, 2200, 0.5], n: [260, 1500, 2500, 0.55], N: [260, 1500, 2500, 0.55], l: [380, 1100, 2600, 0.75], r: [420, 1350, 1700, 0.7], w: [300, 750, 2200, 0.7] };
  // noise consonants: [centerFreq, q, dur, level, voiced]
  var CON = { p: [900, 1, 0.04, 0.5, 0], t: [4500, 1.5, 0.04, 0.5, 0], k: [2000, 1.5, 0.055, 0.5, 0], b: [700, 1, 0.04, 0.3, 1], d: [3500, 1.5, 0.04, 0.3, 1], g: [1800, 1.5, 0.045, 0.3, 1],
    s: [6500, 1.5, 0.11, 0.55, 0], z: [6000, 1.5, 0.09, 0.35, 1], f: [4500, 0.6, 0.09, 0.3, 0], v: [4000, 0.6, 0.08, 0.2, 1], h: [1800, 0.5, 0.07, 0.3, 0], x: [2200, 0.7, 0.09, 0.4, 0],
    S: [3300, 1.5, 0.11, 0.55, 0], C: [3600, 1.5, 0.1, 0.55, 0], K: [2200, 0.8, 0.09, 0.4, 0], J: [2800, 1.5, 0.09, 0.35, 1], T: [5200, 0.6, 0.08, 0.25, 0] };
  function romanize(s) {
    s = String(s).toLowerCase().replace(/ß/g, 'ss').replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/œ/g, 'oe').replace(/ł/g, 'l');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
    return s.replace(/['’`]/g, '').replace(/sh/g, 'S').replace(/ch/g, 'C').replace(/kh/g, 'K').replace(/zh/g, 'J').replace(/th/g, 'T').replace(/ph/g, 'f').replace(/ng/g, 'N').replace(/c([ei])/g, 's$1').replace(/[cq]/g, 'k').replace(/j/g, 'J');
  }
  var fcur = null;
  function stopFormant() {
    if (!fcur || !ctx) { fcur = null; return; }
    try { var t = ctx.currentTime; fcur.out.gain.cancelScheduledValues(t); fcur.out.gain.setTargetAtTime(0, t, 0.015); fcur.nodes.forEach(function (n) { try { n.stop(t + 0.1); } catch (e) {} }); } catch (e) {}
    fcur = null;
  }
  function formantSpeak(rom, kind) {
    if (!ctx || !chan.voice) return 0;
    stopFormant();
    var prof = KINDS[kind] || KINDS.mil, t0 = ctx.currentTime + 0.03, t = t0;
    var base = prof.f0 * rnd(0.96, 1.05), rate = 1 / prof.r;
    var words = romanize(rom).split(/\s+/).filter(Boolean);
    var out = ctx.createGain(); out.gain.value = 0.9; out.connect(chan.voice);
    var osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = base;
    var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.value = 2; vib.connect(vg); vg.connect(osc.frequency);
    var amp = ctx.createGain(); amp.gain.value = 0;
    var fl = [], fg = [0.9, 0.5, 0.25], qs = [7, 9, 11];
    for (var i = 0; i < 3; i++) { var b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = qs[i]; b.frequency.value = 500 + i * 900; var g = ctx.createGain(); g.gain.value = fg[i]; osc.connect(b); b.connect(g); g.connect(amp); fl.push(b); }
    amp.connect(out);
    var ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 3000; nf.Q.value = 1;
    var ng = ctx.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(out);
    function setF(fm, at, tc) { for (var k = 0; k < 3; k++) fl[k].frequency.setTargetAtTime(fm[k], at, tc || 0.015); }
    var pitch = function (f, at) { osc.frequency.setTargetAtTime(f, at, 0.04); };
    var dropAll = 1;
    for (var w = 0; w < words.length; w++) {
      var wd = words[w], punct = /[?]/.test(rom) && w === words.length - 1;
      var contour = base * Math.pow(0.95, w) * (w === words.length - 1 ? 0.93 : 1);
      var vIdx = 0, nv = (wd.match(/[aeiouy]/g) || []).length || 1;
      for (var c = 0; c < wd.length; c++) {
        var ch = wd[c];
        if (VOW[ch]) {
          var last = vIdx === nv - 1, dur = (vIdx === 0 ? 0.14 : 0.1) * rate * (last ? 1.25 : 1);
          var f = contour * (vIdx === 0 ? 1.1 : 1) * (last ? (punct ? 1.18 : 0.9) : 1);
          setF(VOW[ch], t, 0.02); pitch(f, t);
          amp.gain.setTargetAtTime(0.95, t, 0.012); amp.gain.setTargetAtTime(0.7, t + dur * 0.6, 0.03);
          ng.gain.setTargetAtTime(0, t, 0.01); t += dur; vIdx++;
        } else if (SON[ch]) {
          var sd = 0.07 * rate; setF(SON[ch], t, 0.012); pitch(contour * 0.97, t);
          amp.gain.setTargetAtTime(SON[ch][3], t, 0.012); ng.gain.setTargetAtTime(0, t, 0.01); t += sd;
        } else if (CON[ch]) {
          var cp = CON[ch], cd = cp[2] * rate;
          nf.frequency.setValueAtTime(cp[0], t); nf.Q.setValueAtTime(cp[1], t);
          amp.gain.setTargetAtTime(cp[4] ? 0.25 : 0.01, t, 0.006);
          ng.gain.setTargetAtTime(cp[3] * 0.9, t, 0.004); ng.gain.setTargetAtTime(0, t + cd * 0.7, 0.01);
          if (cp[4]) setF([300, 1100, 2400], t, 0.01);
          t += cd + (CON[ch][2] <= 0.06 ? 0.015 : 0);
        }
      }
      amp.gain.setTargetAtTime(0.0, t, 0.015); ng.gain.setTargetAtTime(0, t, 0.01);
      t += 0.08 * rate;
    }
    var end = t + 0.15;
    osc.start(t0); vib.start(t0); ns.start(t0, Math.random());
    osc.stop(end); vib.stop(end); ns.stop(end);
    fcur = { out: out, nodes: [osc, vib, ns] };
    return end - t0;
  }

  function speak(line, kind, langs) {
    var prof = KINDS[kind] || KINDS.mil, v = null;
    try { if (synth && typeof W.SpeechSynthesisUtterance === 'function') v = findVoice(langs); } catch (e) { v = null; }
    stopFormant();
    if (v) {
      try {
        synth.cancel();
        var u = new W.SpeechSynthesisUtterance(line.text);
        u.voice = v; u.lang = v.lang;
        u.pitch = Math.max(0.1, Math.min(2, prof.p + rnd(-0.06, 0.06)));
        u.rate = Math.max(0.1, Math.min(2, prof.r + rnd(-0.05, 0.05)));
        u.volume = mutes.voice ? 0 : vols.voice;
        var fell = false;
        u.onerror = function (ev) { if (fell || (ev && (ev.error === 'canceled' || ev.error === 'interrupted'))) return; fell = true; lastEngine = 'formant'; try { formantSpeak(line.rom, kind); } catch (e) {} };
        curUtt = u; lastEngine = 'speechSynthesis';
        synth.speak(u);
        return;
      } catch (e) { /* fall through to formant */ }
    }
    lastEngine = 'formant';
    try { formantSpeak(line.rom, kind); } catch (e) {}
  }
  AS.voice = function (civ, kind, action) {
    try {
      if (!inited) return null;
      var now = Date.now();
      if (now - lastStart < 250) return null;
      var pool = getPool(civ, kind, action || 'select');
      if (!pool) return null;
      var key = civ + '|' + kind + '|' + action, n = pool.lines.length, i = Math.floor(Math.random() * n);
      if (n > 1 && i === lastIdx[key]) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
      lastIdx[key] = i; lastStart = now;
      var line = pool.lines[i];
      AS.lastVoice = line.text;
      speak(line, kind, pool.lang);
      return line.text;
    } catch (e) { return null; }
  };

  /* ---------- Music ---------- */
  var SC = { dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], minor: [0, 2, 3, 5, 7, 8, 10], hmin: [0, 2, 3, 5, 7, 8, 11] };
  var mfreq = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var MS = { want: 'peace', mood: 'peace', next: 0, step: 0, bar: 0, root: 50, scale: SC.dorian, bpm: 78, deg: 4, phrase: null, prev: null, flute: false, drum: false, started: false };
  var buses = {};
  function degNote(d) { var o = Math.floor(d / 7), n = ((d % 7) + 7) % 7; return MS.root + 12 * o + MS.scale[n]; }
  function lute(dest, t, m, dur, vol) {
    var f = mfreq(m), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
    lp.frequency.setValueAtTime(Math.min(5000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + dur);
    var g = env(t, dur, vol, 0.004); lp.connect(g); g.connect(dest);
    var a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.value = f; a.connect(lp); a.start(t); a.stop(t + dur + 0.05);
    var b = ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.value = f * 1.003; var bg = ctx.createGain(); bg.gain.value = 0.35; b.connect(bg); bg.connect(lp); b.start(t); b.stop(t + dur + 0.05);
  }
  function flute(dest, t, m, dur, vol) {
    var f = mfreq(m), o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; var g2 = ctx.createGain(); g2.gain.value = 0.12;
    var vb = ctx.createOscillator(), vg = ctx.createGain(); vb.frequency.value = rnd(4.6, 5.6); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + dur * 0.6); vb.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    var g = envS(t, dur, vol, 0.07, Math.min(0.2, dur * 0.4));
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    o.start(t); o2.start(t); vb.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); vb.stop(t + dur + 0.05);
    N(dest, t, Math.min(dur, 0.25), vol * 0.12, 'bandpass', f * 2, null, 4, 0.04);
  }
  function drone(dest, t, dur, vol) {
    [MS.root - 12, MS.root - 5].forEach(function (m, i) {
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mfreq(m);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 350;
      var g = envS(t, dur + 0.3, vol * (i ? 0.7 : 1), 0.5, 0.6); o.connect(lp); lp.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.4);
    });
  }
  function tabor(dest, t, vol, tom) {
    T(dest, 'sine', tom ? 150 : 120, tom ? 80 : 55, t, tom ? 0.22 : 0.18, vol, 0.002);
    N(dest, t, 0.06, vol * 0.5, 'bandpass', 900, 500, 1.2, 0.002);
  }
  function newPhrase() {
    var battle = MS.mood === 'battle', ev = [], s = 0, d = MS.deg;
    while (s < 16) {
      var len = pick(battle ? [1, 1, 1, 2, 2, 3] : [1, 2, 2, 2, 3, 4, 4]);
      if (s + len > 16) len = 16 - s;
      if (Math.random() < (battle ? 0.08 : 0.2)) { s += len; continue; }
      var r = Math.random(), step = r < 0.35 ? 1 : r < 0.6 ? -1 : r < 0.72 ? 2 : r < 0.84 ? -2 : r < 0.92 ? 3 : -3;
      d += step; if (d > 11) d -= 3; if (d < 0) d += 3;
      if (s + len >= 16) d = pick([0, 0, 4, 2, 7]);
      ev.push({ s: s, d: d, len: len }); s += len;
    }
    MS.deg = d; return ev;
  }
  function newSection() {
    var battle = MS.mood === 'battle';
    var modes = battle ? ['phryg', 'minor', 'hmin', 'phryg'] : ['dorian', 'mixo', 'dorian', 'mixo', 'phryg'];
    MS.scale = SC[pick(modes)];
    MS.root = pick(battle ? [45, 47, 50, 52] : [48, 50, 52, 55, 57]);
    MS.bpm = battle ? rnd(122, 138) : rnd(70, 86);
    MS.deg = pick([0, 2, 4, 7]); MS.prev = null;
  }
  function musicStep(t) {
    var s = MS.step % 8, bus = buses[MS.mood], battle = MS.mood === 'battle', sd = 30 / MS.bpm;
    if (s === 0) {
      if (MS.want !== MS.mood) { MS.mood = MS.want; bus = buses[MS.mood]; battle = MS.mood === 'battle'; newSection(); MS.phrase = null; MS.bar = 0; sd = 30 / MS.bpm; }
      else if (MS.bar > 0 && MS.bar % 12 === 0) newSection();
      if (MS.bar % 2 === 0) {
        if (MS.prev && Math.random() < 0.4) { var sh = pick([0, 0, 1, -1, 2]); MS.phrase = MS.prev.map(function (e) { return { s: e.s, d: e.d + sh, len: e.len }; }); }
        else MS.phrase = newPhrase();
        MS.prev = MS.phrase; MS.flute = Math.random() < (battle ? 0.3 : 0.55); MS.luteOn = Math.random() < 0.85;
        MS.drum = battle ? true : Math.random() < 0.4;
      }
      drone(bus, t, sd * 8, battle ? 0.07 : 0.05);
      lute(bus, t, MS.root - 12, sd * 4, 0.3); lute(bus, t + sd * 4, MS.root - 5, sd * 4, 0.22);
      MS.bar++;
    }
    var ps = (MS.bar - 1) % 2 * 8 + s;
    if (MS.phrase) MS.phrase.forEach(function (e) {
      if (e.s !== ps) return; var m = degNote(e.d) + 12, dur = e.len * sd;
      if (MS.luteOn !== false) lute(bus, t, m, Math.max(0.35, dur * 1.3), battle ? 0.3 : 0.24);
      if (MS.flute && e.len >= 2) flute(bus, t, m + 12, dur * 0.95, battle ? 0.08 : 0.1);
    });
    if (battle) {
      if (s % 2 === 0) tabor(bus, t, s === 0 ? 0.8 : s === 4 ? 0.65 : 0.45, s === 4);
      else if (Math.random() < 0.4) tabor(bus, t, 0.2, false);
      if (s === 6 && Math.random() < 0.5) tabor(bus, t + sd * 0.5, 0.3, true);
    } else if (MS.drum) {
      if (s === 0) tabor(bus, t, 0.35, false); else if (s === 4) tabor(bus, t, 0.22, true); else if (s === 6 && Math.random() < 0.3) tabor(bus, t, 0.15, false);
    }
    return 30 / MS.bpm;
  }
  function musicTick() {
    if (!ctx || ctx.state === 'suspended') return;
    if (MS.next < ctx.currentTime) MS.next = ctx.currentTime + 0.05;
    while (MS.next < ctx.currentTime + 0.5) { var d = musicStep(MS.next); MS.next += d; MS.step++; }
  }
  function fadeBuses() {
    if (!ctx || !buses.peace) return;
    var t = ctx.currentTime;
    ['peace', 'battle'].forEach(function (k) { var g = buses[k].gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(k === MS.want ? 1 : 0, t + 2); });
  }
  AS.setMusicMood = function (m) {
    if (m !== 'peace' && m !== 'battle') return;
    MS.want = m; try { fadeBuses(); } catch (e) {}
  };

  /* ---------- Ambient ---------- */
  var amb = { water: false, wantWater: false, nodes: [], waveG: null, running: false };
  function ambStart() {
    if (amb.running || !ctx) return; amb.running = true;
    var t = ctx.currentTime;
    var ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 0.7;
    var wg = ctx.createGain(); wg.gain.value = 0.22;
    var l1 = ctx.createOscillator(), l1g = ctx.createGain(); l1.frequency.value = 0.07; l1g.gain.value = 220; l1.connect(l1g); l1g.connect(bp.frequency);
    var l2 = ctx.createOscillator(), l2g = ctx.createGain(); l2.frequency.value = 0.11; l2g.gain.value = 0.1; l2.connect(l2g); l2g.connect(wg.gain);
    ws.connect(bp); bp.connect(wg); wg.connect(ambBus); [ws, l1, l2].forEach(function (n) { n.start(t); amb.nodes.push(n); });
    var vs = ctx.createBufferSource(); vs.buffer = noiseBuf; vs.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    var vg = ctx.createGain(); vg.gain.value = 0; amb.waveG = vg;
    var l3 = ctx.createOscillator(), l3g = ctx.createGain(); l3.frequency.value = 0.12; l3g.gain.value = 0.12; l3.connect(l3g);
    var wv = ctx.createGain(); wv.gain.value = 0.3; l3g.connect(wv.gain);
    vs.connect(lp); lp.connect(wv); wv.connect(vg); vg.connect(ambBus); [vs, l3].forEach(function (n) { n.start(t); amb.nodes.push(n); });
    amb.water = false; ambWater();
    every(function () { // birds & insects
      if (!amb.running || ctx.state !== 'running') return;
      var tt = ctx.currentTime + 0.02;
      if (Math.random() < 0.6) {
        var base = rnd(2400, 4200), n = 1 + Math.floor(Math.random() * 4);
        for (var i = 0; i < n; i++) { var f = base * rnd(0.9, 1.15); T(ambBus, 'sine', f, f * rnd(1.2, 1.6), tt + i * 0.11, 0.08, 0.05, 0.01); }
      } else if (Math.random() < 0.5) {
        for (var k = 0; k < 14; k++) T(ambBus, 'sine', 4700, 4700, tt + k * 0.035, 0.02, 0.012, 0.004);
      }
    }, 2200);
  }
  function ambWater() {
    if (!amb.waveG) return; amb.water = amb.wantWater;
    try { amb.waveG.gain.setTargetAtTime(amb.wantWater ? 0.6 : 0, ctx.currentTime, 0.8); } catch (e) {}
  }
  function ambStop() { amb.nodes.forEach(function (n) { try { n.stop(); } catch (e) {} }); amb.nodes = []; amb.running = false; amb.waveG = null; }
  AS.setAmbient = function (o) { try { if (o && typeof o.water === 'boolean') { amb.wantWater = o.water; if (inited) ambWater(); } } catch (e) {} };

  /* ---------- Lifecycle ---------- */
  AS.init = function () {
    try {
      if (inited) { if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume(); startAll(); return; }
      var AC = W.AudioContext || W.webkitAudioContext;
      if (!AC) { inited = true; AS.unlocked = true; return; }
      ctx = new AC();
      if (ctx.resume) { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ctx.createGain(); master.gain.value = 0.85; comp.connect(master); master.connect(ctx.destination);
      CH.forEach(function (c) { chan[c] = ctx.createGain(); chan[c].gain.value = mutes[c] ? 0 : vols[c]; chan[c].connect(comp); });
      ambBus = ctx.createGain(); ambBus.gain.value = 0.6; ambBus.connect(chan.sfx);
      buses.peace = ctx.createGain(); buses.battle = ctx.createGain();
      buses.peace.connect(chan.music); buses.battle.connect(chan.music);
      buses.peace.gain.value = MS.want === 'peace' ? 1 : 0; buses.battle.gain.value = MS.want === 'battle' ? 1 : 0;
      noiseBuf = mkNoise();
      inited = true; AS.unlocked = true;
      startAll();
    } catch (e) { inited = true; AS.unlocked = true; ctx = null; }
  };
  function startAll() {
    if (!ctx) return;
    ambStart();
    if (!MS.started) {
      MS.started = true; MS.mood = MS.want; newSection(); MS.next = ctx.currentTime + 0.3; MS.step = 0; MS.bar = 0; MS.phrase = null;
      every(musicTick, 100);
    }
  }
  AS.pauseAll = function () { try { if (ctx && ctx.suspend) ctx.suspend(); if (synth) synth.pause ? synth.pause() : 0; } catch (e) {} };
  AS.resumeAll = function () { try { if (ctx && ctx.resume) ctx.resume(); if (synth && synth.resume) synth.resume(); } catch (e) {} };
  AS.stopAll = function () {
    try {
      timers.forEach(clearInterval); timers = []; MS.started = false;
      ambStop(); stopFormant();
      if (synth) synth.cancel();
      if (ctx && buses.peace) { var t = ctx.currentTime; ['peace', 'battle'].forEach(function (k) { buses[k].gain.cancelScheduledValues(t); buses[k].gain.setTargetAtTime(0, t, 0.1); }); }
      later(function () { if (ctx && !MS.started) { ['peace', 'battle'].forEach(function (k) { buses[k].gain.value = k === MS.want ? 1 : 0; }); } }, 600);
    } catch (e) {}
  };
})();
