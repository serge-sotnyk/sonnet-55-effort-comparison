'use strict';
// ---- rendering ----
let cv, ctx, VW = 0, VH = 0;
const cam = { x: 0, y: 0, z: 1 };
const OX = N * 32;
let terrainC, miniC, fogC, fogCtx, SPR = {}, TREES = [];
const proj = (x, y) => [(x - y) * 32, (x + y) * 16];
const unproj = (X, Y) => { const a = X / 32, b = Y / 16; return [(a + b) / 2, (b - a) / 2]; };
const screenToWorld = (sx, sy) => unproj(sx / cam.z + cam.x, sy / cam.z + cam.y);
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function shade(hex, f) {
  let r, g, b;
  if (hex[0] === 'r') { [r, g, b] = hex.match(/\d+/g).map(Number); } else { const n = parseInt(hex.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  if (f < 1) { r *= f; g *= f; b *= f; } else { f -= 1; r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
const poly = (g, pts, fill, stroke) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } };

// ================= terrain =================
function buildTerrain() {
  const S = 5, TS = N * S, tex = mkCanvas(TS, TS), tg = tex.getContext('2d'), img = tg.createImageData(TS, TS), d = img.data;
  const { nE, nF, nG } = G.noises, thr = G.thr;
  for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
    const x = (i + .5) / S, y = (j + .5) / S, w = G.waterF(x, y) - thr;
    const n1 = nE(x / 3, y / 3), n2 = nF(x * .9, y * .9), n3 = nG(x / 9, y / 9), sp = (Math.sin(i * 12.9898 + j * 78.233) * 43758.5453 % 1) * 6;
    let r = 86 + (n3 - .5) * 60 + (n1 - .5) * 22 + (n2 - .5) * 12 + sp, g = 134 + (n3 - .5) * 44 + (n1 - .5) * 24 + (n2 - .5) * 14 + sp, b = 54 + (n3 - .5) * 20 + (n1 - .5) * 10 + sp * .5;
    if (n3 > .62) { r += 14; g += 4; b -= 6; } // dry patches
    if (w > -.06) {
      const sand = Math.min(1, (w + .06) / .05);
      if (w < 0) { r += (206 - r) * sand; g += (190 - g) * sand; b += (130 - b) * sand; }
      else {
        const t = Math.min(1, w / .1), rip = Math.sin((x + y) * 4 + n1 * 9) * 4;
        const wr = 96 + (30 - 96) * t + rip, wg = 178 + (96 - 178) * t + rip, wb = 190 + (150 - 190) * t + rip;
        const k = Math.min(1, w / .012); r = 190 + (wr - 190) * k; g = 182 + (wg - 182) * k; b = 130 + (wb - 130) * k;
      }
    }
    const o = (j * TS + i) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  tg.putImageData(img, 0, 0);
  terrainC = mkCanvas(N * 64, N * 32 + 4);
  const t = terrainC.getContext('2d'); t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high';
  t.setTransform(32, 16, -32, 16, OX, 0); t.drawImage(tex, 0, 0, N, N); t.setTransform(1, 0, 0, 1, 0, 0);
  // decoration
  const rnd = mkRng(G.seed + 99);
  for (let k = 0; k < 9000; k++) {
    const x = rnd() * N, y = rnd() * N; if (G.waterF(x, y) - thr > -.03) continue;
    const [X, Y] = proj(x, y), c = rnd();
    if (c < .72) { t.strokeStyle = rnd() < .5 ? 'rgba(52,96,36,.55)' : 'rgba(150,190,86,.5)'; t.lineWidth = 1; t.beginPath(); for (let q = -1; q <= 1; q++) { t.moveTo(X + OX + q * 2, Y); t.lineTo(X + OX + q * 3 + (rnd() - .5) * 2, Y - 3 - rnd() * 3); } t.stroke(); }
    else if (c < .9) { t.fillStyle = ['#f4f0d6', '#f7d84a', '#e8678a', '#b79bf0'][(rnd() * 4) | 0]; t.fillRect(X + OX, Y, 2, 2); }
    else { t.fillStyle = 'rgba(90,90,80,.5)'; t.beginPath(); t.ellipse(X + OX, Y, 3, 1.6, 0, 0, 7); t.fill(); }
  }
  miniC = mkCanvas(240, 120); const m = miniC.getContext('2d'); m.imageSmoothingEnabled = true;
  m.setTransform(120 / N, 60 / N, -120 / N, 60 / N, 120, 0); m.drawImage(tex, 0, 0, N, N);
  fogC = mkCanvas(N, N); fogCtx = fogC.getContext('2d');
}
function updateFogCanvas() {
  const img = fogCtx.createImageData(N, N), d = img.data;
  for (let i = 0; i < N * N; i++) { d[i * 4 + 3] = G.vis[i] ? 0 : G.explored[i] ? 105 : 245; d[i * 4] = 6; d[i * 4 + 1] = 8; d[i * 4 + 2] = 14; }
  fogCtx.putImageData(img, 0, 0); G.fogDirty = false;
}

// ================= sprites =================
function spr(w, h, ax, ay, fn) { const c = mkCanvas(w, h), g = c.getContext('2d'); fn(g, w, h); return { c, w, h, ax, ay }; }
function buildSprites() {
  // trees
  TREES = [];
  for (let v = 0; v < 5; v++) TREES.push(spr(60, 90, 30, 82, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(30, 82, 17, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3322'; g.fillRect(27, 66, 6, 17);
    if (v < 3) { // pine
      const cols = [['#1f5a2c', '#2f7a3c'], ['#245f33', '#3a8742'], ['#1c4f2a', '#2b7035']][v], hh = 20;
      for (let k = 0; k < 4; k++) { const y = 70 - k * 15, wd = 24 - k * 4; const gr = g.createLinearGradient(30 - wd, 0, 30 + wd, 0); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); g.fillStyle = gr; g.beginPath(); g.moveTo(30, y - hh - 2); g.lineTo(30 + wd, y); g.lineTo(30 - wd, y); g.closePath(); g.fill(); }
    } else { // oak
      const base = v === 3 ? [74, 138, 52] : [96, 150, 48];
      for (const [cx, cy, r] of [[22, 50, 14], [38, 50, 14], [30, 38, 16], [22, 36, 11], [39, 36, 11], [30, 26, 12]]) {
        const gr = g.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, r); gr.addColorStop(0, `rgb(${base[0] + 40},${base[1] + 36},${base[2] + 20})`); gr.addColorStop(1, `rgb(${base[0] - 30},${base[1] - 40},${base[2] - 16})`);
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      }
    }
  }));
  SPR.berry = spr(44, 36, 22, 28, (g) => {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(22, 28, 15, 6, 0, 0, 7); g.fill();
    for (const [x, y, r] of [[14, 20, 9], [28, 20, 9], [21, 14, 10]]) { const gr = g.createRadialGradient(x - 2, y - 3, 1, x, y, r); gr.addColorStop(0, '#6fb04a'); gr.addColorStop(1, '#2f6a2a'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.fillStyle = '#d6263a'; for (const [x, y] of [[12, 18], [18, 12], [25, 16], [30, 21], [20, 22], [24, 9], [15, 24]]) { g.beginPath(); g.arc(x, y, 2.3, 0, 7); g.fill(); }
  });
  const mine = (cols, nug) => spr(60, 50, 30, 38, (g) => {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(30, 38, 24, 9, 0, 0, 7); g.fill();
    for (const [x, y, w, h] of [[10, 34, 20, 18], [30, 36, 22, 20], [22, 28, 22, 22], [38, 30, 16, 14]]) {
      const gr = g.createLinearGradient(x - w / 2, y - h, x + w / 2, y); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 3, y - h); g.lineTo(x + w / 5, y - h * 1.05); g.lineTo(x + w / 2, y - h * .3); g.lineTo(x + w / 2.2, y); g.closePath(); g.fill();
    }
    for (const [x, y, r] of nug) { g.fillStyle = cols[2]; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r * .8); g.lineTo(x - r, y); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 1, y - r + 1, 2, 2); }
  });
  SPR.gold = mine(['#8b7f6a', '#4d463a', '#ffd43b'], [[18, 28, 4.5], [30, 24, 5], [40, 30, 4], [26, 34, 3.5], [34, 17, 3]]);
  SPR.stone = mine(['#b9bcc2', '#6a6e78', '#d9dde4'], [[20, 28, 3], [36, 27, 3.4], [29, 20, 2.6]]);
  SPR.stone.flat = true;
  // buildings
  SPR.b = {};
  for (const k in BLDS) { SPR.b[k] = [0, 1].map(o => bldSprite(k, o)); }
}
const BH = { tc: 130, house: 66, mill: 112, lumber: 60, mining: 56, farm: 6, barracks: 100, archery: 94, stable: 86, smith: 96, siege: 110, tower: 112 };
function bldSprite(kind, owner) {
  const d = BLDS[kind], s = d.size, hmax = BH[kind], C = COL[owner], W = s * 64 + 12, Hh = s * 32 + hmax + 8, ox = W / 2, oy = hmax + 4;
  const P = (u, v, z) => [ox + (u - v) * 32, oy + (u + v) * 16 - z];
  const c = mkCanvas(W, Hh), g = c.getContext('2d'); const out = { c, w: W, h: Hh, ax: ox, ay: oy + s * 16, fx: ox, fy: 20 };
  // ground shadow
  poly(g, [P(-.2, -.1, 0), P(s + .3, -.1, 0), P(s + .5, s + .4, 0), P(-.1, s + .3, 0)], 'rgba(0,0,0,.22)');
  const box = (u0, v0, u1, v1, z0, z1, top, left, right, lines) => {
    poly(g, [P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)], left);
    poly(g, [P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], right);
    poly(g, [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], top);
    if (lines) { g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1; for (let z = z0 + lines; z < z1; z += lines) { g.beginPath(); let p = P(u0, v1, z); g.moveTo(p[0], p[1]); p = P(u1, v1, z); g.lineTo(p[0], p[1]); p = P(u1, v0, z); g.lineTo(p[0], p[1]); g.stroke(); } }
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.beginPath(); let p = P(u0, v1, z0); g.moveTo(p[0], p[1]); p = P(u0, v1, z1); g.lineTo(p[0], p[1]); g.stroke();
    p = P(u1, v1, z0); g.beginPath(); g.moveTo(p[0], p[1]); p = P(u1, v1, z1); g.lineTo(p[0], p[1]); g.stroke();
  };
  const wall = (c0) => [shade(c0, 1.18), shade(c0, .98), shade(c0, .76)];
  const roofG = (u0, v0, u1, v1, z, h, col, ov = .15) => { // gable along u
    const vm = (v0 + v1) / 2; u0 -= ov; u1 += ov; v0 -= ov; v1 += ov;
    poly(g, [P(u0, v0, z), P(u1, v0, z), P(u1, vm, z + h), P(u0, vm, z + h)], shade(col, .7));
    poly(g, [P(u1, v0, z), P(u1, v1, z), P(u1, vm, z + h)], shade(col, .6));
    poly(g, [P(u0, v1, z), P(u1, v1, z), P(u1, vm, z + h), P(u0, vm, z + h)], col, 'rgba(0,0,0,.25)');
    g.strokeStyle = 'rgba(0,0,0,.18)'; for (let k = 1; k < 5; k++) { const t = k / 5; g.beginPath(); let p = P(u0, v1 + (vm - v1) * t, z + h * t); g.moveTo(p[0], p[1]); p = P(u1, v1 + (vm - v1) * t, z + h * t); g.lineTo(p[0], p[1]); g.stroke(); }
  };
  const roofHip = (u0, v0, u1, v1, z, h, col) => {
    const um = (u0 + u1) / 2, vm = (v0 + v1) / 2, t = P(um, vm, z + h);
    poly(g, [P(u0, v1, z), P(u1, v1, z), t], col, 'rgba(0,0,0,.25)');
    poly(g, [P(u1, v0, z), P(u1, v1, z), t], shade(col, .72), 'rgba(0,0,0,.25)');
    poly(g, [P(u0, v0, z), P(u1, v0, z), t], shade(col, .6)); poly(g, [P(u0, v0, z), P(u0, v1, z), t], shade(col, .85));
  };
  const door = (u, v1, w, h, col = '#3b2a1c') => poly(g, [P(u, v1, 0), P(u + w, v1, 0), P(u + w, v1, h), P(u, v1, h)], col, 'rgba(0,0,0,.4)');
  const doorR = (v, u1, w, h, col = '#3b2a1c') => poly(g, [P(u1, v, 0), P(u1, v + w, 0), P(u1, v + w, h), P(u1, v, h)], col, 'rgba(0,0,0,.4)');
  const windowL = (u, v1, z) => poly(g, [P(u, v1, z), P(u + .22, v1, z), P(u + .22, v1, z + 11), P(u, v1, z + 11)], '#27323f', 'rgba(0,0,0,.4)');
  const windowR = (v, u1, z) => poly(g, [P(u1, v, z), P(u1, v + .22, z), P(u1, v + .22, z + 11), P(u1, v, z + 11)], '#27323f', 'rgba(0,0,0,.4)');
  const stone = wall('#a9a496'), wood = wall('#9b7447'), plaster = wall('#d9ccaa'), dark = wall('#5b4630');
  const banner = (u, v, z, hgt) => { const a = P(u, v, z), b = P(u, v, z + hgt); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  switch (kind) {
    case 'house': {
      box(.25, .25, s - .25, s - .25, 0, 24, ...plaster); door(.55, s - .25, .5, 15); windowL(1.2, s - .25, 9); windowR(.55, s - .25, 9);
      roofG(.25, .25, s - .25, s - .25, 24, 28, shade(C.m, .95), .22); out.fx = ox + 0; out.fy = oy + 4 - 52; break;
    }
    case 'tc': {
      box(.15, .15, s - .15, s - .15, 0, 42, ...stone, 7);
      // crenellations
      for (let i = 0; i < 8; i++) { const t = .35 + i * ((s - .7) / 8); box(t, s - .45, t + .24, s - .15, 42, 50, ...stone); box(s - .45, t, s - .15, t + .24, 42, 50, ...stone); }
      box(.9, .9, s - .9, s - .9, 42, 76, ...wall('#b7b1a1'), 8);
      roofHip(.7, .7, s - .7, s - .7, 76, 34, shade(C.m, 1));
      door(1.4, s - .15, 1.2, 28, '#4a3320'); doorR(1.4, s - .15, 1.2, 28, '#4a3320'); windowL(.6, s - .15, 18); windowL(s - 1, s - .15, 18); windowR(.6, s - .15, 18);
      windowL(1.3, s - .9, 52); windowR(1.3, s - .9, 52); windowL(2.0, s - .9, 52);
      out.fx = ox; out.fy = oy - 36 - 76 + 8 + s * 16 - s * 16 + 6; break;
    }
    case 'mill': {
      box(.4, .4, s - .4, s - .4, 0, 54, ...plaster); roofHip(.3, .3, s - .3, s - .3, 54, 26, shade(C.m, .9)); door(.5, s - .4, .5, 16); windowR(.5, s - .4, 22);
      out.fx = ox; out.fy = oy + 8 - 78; out.mill = P(s / 2, s - .4, 40); break;
    }
    case 'lumber': {
      // open shed with log piles
      for (const [u, v] of [[.35, .35], [s - .35, .35], [.35, s - .35], [s - .35, s - .35]]) box(u - .06, v - .06, u + .06, v + .06, 0, 34, ...dark);
      roofG(.2, .2, s - .2, s - .2, 34, 14, '#7a5a34', .1);
      for (let i = 0; i < 4; i++) { box(.5 + i * .3, s - .75, .75 + i * .3, s - .45, 0, 7, '#b08a56', '#8a6a3c', '#6e522c'); }
      for (let i = 0; i < 3; i++) box(.45 + i * .3, s - .6, .7 + i * .3, s - .35, 7, 13, '#b08a56', '#8a6a3c', '#6e522c');
      out.fx = ox; out.fy = oy + 12 - 48; break;
    }
    case 'mining': {
      for (const [u, v] of [[.35, .35], [s - .35, .35], [.35, s - .35], [s - .35, s - .35]]) box(u - .06, v - .06, u + .06, v + .06, 0, 34, ...dark);
      roofG(.2, .2, s - .2, s - .2, 34, 12, '#6f5f4a', .1);
      for (const [u, v, col] of [[1.2, 1.25, '#ffd43b'], [.7, 1.3, '#b9bcc2'], [1.35, .75, '#ffd43b']]) { const p = P(u, v, 5); g.fillStyle = col; g.beginPath(); g.moveTo(p[0], p[1] - 6); g.lineTo(p[0] + 6, p[1]); g.lineTo(p[0], p[1] + 4); g.lineTo(p[0] - 6, p[1]); g.fill(); }
      out.fx = ox; out.fy = oy + 12 - 46; break;
    }
    case 'farm': {
      poly(g, [P(.05, .05, 0), P(s - .05, .05, 0), P(s - .05, s - .05, 0), P(.05, s - .05, 0)], '#6a4a2a', 'rgba(0,0,0,.3)');
      for (let i = 0; i < 6; i++) { const t = .3 + i * ((s - .6) / 5); poly(g, [P(t - .1, .25, 0), P(t + .1, .25, 0), P(t + .1, s - .25, 0), P(t - .1, s - .25, 0)], i % 2 ? '#b5a23a' : '#8fb040'); }
      for (let i = 0; i < 6; i++) { const t = .3 + i * ((s - .6) / 5); g.fillStyle = '#d8c64e'; for (let k = 0; k < 7; k++) { const p = P(t, .35 + k * ((s - .7) / 6), 0); g.fillRect(p[0] - 1, p[1] - 4, 2, 4); } }
      out.fx = -1; break;
    }
    case 'barracks': {
      box(.25, .3, s - .25, s - .3, 0, 38, ...wall('#b7ab93'), 8);
      roofG(.25, .3, s - .25, s - .3, 38, 30, C.m, .2);
      door(s / 2 - .4, s - .3, .8, 24, '#3a2818'); windowL(.6, s - .3, 14); windowL(s - 1, s - .3, 14); windowR(.7, s - .25, 14);
      const p = P(s / 2 + .1, s - .3, 33); g.fillStyle = C.d; g.beginPath(); g.moveTo(p[0] - 7, p[1] - 8); g.lineTo(p[0] + 7, p[1] - 8); g.lineTo(p[0] + 7, p[1] + 2); g.lineTo(p[0], p[1] + 9); g.lineTo(p[0] - 7, p[1] + 2); g.fill(); g.strokeStyle = '#ddd'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p[0] - 5, p[1] - 5); g.lineTo(p[0] + 5, p[1] + 3); g.moveTo(p[0] + 5, p[1] - 5); g.lineTo(p[0] - 5, p[1] + 3); g.stroke();
      out.fx = ox; out.fy = oy + 8 - 74; break;
    }
    case 'archery': {
      box(.25, .3, s - .25, s - .8, 0, 32, ...wood, 8); roofG(.25, .3, s - .25, s - .8, 32, 26, '#8a6a3c', .2); poly(g, [P(.25, .3, 32), P(s - .25, .3, 32), P(s - .25, .3, 36), P(.25, .3, 36)], C.m);
      for (let i = 0; i < 2; i++) { const p = P(.9 + i * 1.1, s - .35, 18); g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(p[0], p[1], 9, 11, 0, 0, 7); g.fill(); for (const [r, c2] of [[8, C.m], [5, '#fff'], [2.5, C.d]]) { g.fillStyle = c2; g.beginPath(); g.ellipse(p[0], p[1], r * .8, r, 0, 0, 7); g.fill(); } g.fillStyle = '#5a4128'; const a = P(.9 + i * 1.1, s - .35, 0); g.fillRect(a[0] - 1.5, p[1] + 8, 3, a[1] - p[1] - 8); }
      door(s - 1.3, s - .8, .7, 20, '#3a2818'); out.fx = ox; out.fy = oy + 8 - 66; break;
    }
    case 'stable': {
      box(.25, .3, s - .25, s - .3, 0, 30, ...wood, 6); roofG(.25, .3, s - .25, s - .3, 30, 24, shade(C.m, .85), .2);
      door(.5, s - .3, 1.3, 20, '#2f2218'); door(1.9, s - .3, .8, 20, '#2f2218');
      for (let i = 0; i < 3; i++) box(s - .85 + i * .0, .45 + i * .5, s - .35, .85 + i * .5, 0, 8, '#d9b64a', '#b8942e', '#9a7a22');
      out.fx = ox; out.fy = oy + 8 - 58; break;
    }
    case 'smith': {
      box(.25, .3, s - .25, s - .3, 0, 32, ...stone, 8); roofG(.25, .3, s - .25, s - .3, 32, 26, '#6e5a46', .2);
      box(s - 1, .35, s - .6, .75, 32, 62, ...wall('#8a8578')); door(.7, s - .3, .9, 20, '#2a1e14');
      const p = P(1.9, s - .1, 6); g.fillStyle = '#222'; g.fillRect(p[0] - 7, p[1] - 5, 14, 5); g.fillRect(p[0] - 4, p[1], 8, 6); g.fillStyle = C.m; const q = P(.35, s - .3, 0); g.fillRect(q[0] - 3, q[1] - 36, 7, 12);
      out.fx = ox; out.fy = oy + 8 - 56; out.smoke = P(s - .8, .55, 62); break;
    }
    case 'siege': {
      box(.25, .3, s - .25, s - .3, 0, 40, ...dark, 8); roofG(.25, .3, s - .25, s - .3, 40, 28, '#6a5030', .2);
      door(.6, s - .3, 1.7, 28, '#241a10');
      const p = P(s - .6, s - .35, 6); g.strokeStyle = '#8a8a8a'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1] - 10, 9, 0, 7); g.stroke(); for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(p[0], p[1] - 10); g.lineTo(p[0] + Math.cos(a) * 11, p[1] - 10 + Math.sin(a) * 11); g.stroke(); }
      g.fillStyle = C.m; const q = P(s / 2, s - .3, 36); g.fillRect(q[0] - 9, q[1] - 6, 18, 10);
      out.fx = ox; out.fy = oy + 8 - 68; break;
    }
    case 'tower': {
      box(.2, .2, .8, .8, 0, 70, ...stone, 8); box(.1, .1, .9, .9, 70, 80, ...wall('#8f8a7c'));
      for (const [u, v] of [[.1, .1], [.7, .1], [.1, .7], [.7, .7]]) box(u, v, u + .2, v + .2, 80, 88, ...stone);
      roofHip(.25, .25, .75, .75, 80, 24, C.m); door(.3, .8, .3, 16, '#2a1e14'); windowL(.55, .8, 44); windowR(.3, .8, 44);
      out.fx = ox; out.fy = oy + 8 - 96; break;
    }
  }
  if (out.fx >= 0) { // pole base = top-most opaque pixel near the centre column
    const dat = g.getImageData(Math.max(0, ox - 14), 0, 28, Hh).data; let ty = Hh;
    for (let y = 0; y < Hh && ty === Hh; y++) for (let x = 6; x < 22; x++) if (dat[(y * 28 + x) * 4 + 3] > 200) { ty = y; break; }
    out.fx = ox; out.fy = ty + 3;
  }
  return out;
}
const hitCache = new Map();
function sprHit(sp, px, py) {
  if (px < 0 || py < 0 || px >= sp.w || py >= sp.h) return false;
  if (!sp.g) sp.g = sp.c.getContext('2d', { willReadFrequently: true });
  return sp.g.getImageData(px | 0, py | 0, 1, 1).data[3] > 40;
}

// ================= units =================
const SKIN = '#e6b98e';
function limb(g, x0, y0, x1, y1, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
function drawUnit(u, selected, hover) {
  const [X, Y] = proj(u.x, u.y), C = COL[u.owner], mv = u.moving, ph = u.anim, sw = mv ? Math.sin(ph) : 0, bob = mv ? Math.abs(Math.sin(ph)) * 1.6 : 0;
  const g = ctx; g.save(); g.translate(X, Y);
  const big = u.cls === 'cav' || u.cls === 'siege';
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 1, big ? 14 : 8, big ? 5.5 : 3.5, 0, 0, 7); g.fill();
  g.scale(u.fx, 1);
  if (u.lunge > 0) g.translate(Math.sin(u.lunge / .2 * Math.PI) * 5, 0);
  if (u.flash > 0) g.globalAlpha = .6 + Math.random() * .2;
  const k = u.kind;
  if (k === 'villager') {
    g.translate(0, -bob);
    limb(g, -1.5, -8, -2 + sw * 3, 0, 2.6, '#4a3a2a'); limb(g, 1.5, -8, 2 - sw * 3, 0, 2.6, '#4a3a2a');
    const car = u.carry > .5 && u.act !== 'work';
    if (car) { g.fillStyle = { w: '#8a5a2a', f: '#c9453c', g: '#ffd43b', s: '#aab0ba' }[u.ct] || '#8a5a2a'; g.fillRect(-7, -17, 5, 7); }
    poly(g, [[-4, -17], [4, -17], [5, -7], [-5, -7]], C.m); g.fillStyle = shade(C.m, .7); g.fillRect(-5, -9, 10, 2);
    g.fillStyle = SKIN; g.beginPath(); g.arc(0, -20.5, 3.4, 0, 7); g.fill();
    g.fillStyle = u.owner ? '#5a2a1a' : '#6a4a2a'; g.beginPath(); g.arc(0, -21.5, 3.6, Math.PI, 0); g.fill();
    // tool
    const act = u.act, tk = u.tgt && u.tgt.kind;
    if (act === 'work' || act === 'build' || act === 'fight') {
      const a = -.9 + Math.sin(ph) * 1.1; const hx = 4, hy = -14, tx = hx + Math.cos(a) * 9, ty = hy + Math.sin(a) * 9 + 1;
      limb(g, 2, -15, hx, hy, 1.8, SKIN); limb(g, hx, hy, tx, ty, 1.6, '#6a4a2a');
      g.fillStyle = '#c9ced6';
      if (act === 'build') g.fillRect(tx - 2.5, ty - 2, 5, 3.5);
      else if (tk === 'tree') poly(g, [[tx - 1, ty - 3], [tx + 3.5, ty - 4], [tx + 3.5, ty + 2], [tx - 1, ty + 1]], '#c9ced6');
      else if (tk === 'gold' || tk === 'stone') limb(g, tx - 4, ty - 1, tx + 4, ty + 1, 1.8, '#9aa0a8');
      else if (tk === 'berry') { g.fillStyle = '#c9453c'; g.fillRect(tx - 1, ty - 1, 3, 3); }
      else limb(g, tx - 3, ty + 2, tx + 3, ty - 2, 1.6, '#c9ced6');
    } else limb(g, 2, -15, 4 + sw * 2, -10, 1.8, SKIN);
  } else if (k === 'militia') {
    g.translate(0, -bob); const t = u.st.tier;
    limb(g, -1.5, -8, -2 + sw * 3, 0, 2.8, '#3a3a40'); limb(g, 1.5, -8, 2 - sw * 3, 0, 2.8, '#3a3a40');
    poly(g, [[-5, -18], [5, -18], [5.5, -7], [-5.5, -7]], t >= 1 ? '#8a909c' : C.m); g.fillStyle = C.m; g.fillRect(-5, -13, 10, 3);
    g.fillStyle = SKIN; g.beginPath(); g.arc(0, -21, 3.3, 0, 7); g.fill();
    g.fillStyle = t >= 2 ? '#b8bec8' : '#8a909c'; g.beginPath(); g.arc(0, -21.5, 4, Math.PI * 1.02, -.02); g.fill(); if (t >= 3) { g.fillStyle = C.l; g.fillRect(-1, -28, 2, 4); }
    const a = u.act === 'fight' ? -1.2 + Math.sin(u.cd * 9) * 1.4 : -.5 + sw * .3;
    limb(g, 3, -14, 7, -12, 1.8, SKIN); limb(g, 7, -12, 7 + Math.cos(a) * 11, -12 + Math.sin(a) * 11 - 3, 1.8, '#d8dde6');
    g.fillStyle = C.d; g.beginPath(); g.ellipse(-5, -12, 3.8, 5, 0, 0, 7); g.fill(); g.fillStyle = '#ddd'; g.beginPath(); g.arc(-5, -12, 1.4, 0, 7); g.fill();
  } else if (k === 'spear') {
    g.translate(0, -bob);
    limb(g, -1.5, -8, -2 + sw * 3, 0, 2.6, '#3a3a40'); limb(g, 1.5, -8, 2 - sw * 3, 0, 2.6, '#3a3a40');
    poly(g, [[-4.5, -18], [4.5, -18], [5, -7], [-5, -7]], '#6d5a3a'); g.fillStyle = C.m; g.fillRect(-4.5, -18, 9, 4);
    g.fillStyle = SKIN; g.beginPath(); g.arc(0, -21, 3.3, 0, 7); g.fill(); g.fillStyle = '#7a7f8a'; g.beginPath(); g.arc(0, -21.5, 3.8, Math.PI, 0); g.fill();
    const th = u.act === 'fight' ? Math.sin(u.cd * 10) * 5 : 0, tl = u.st.tier >= 1 ? 30 : 26;
    limb(g, 3, -14, 7 + th, -13, 1.8, SKIN); limb(g, 2 + th, -4, 10 + th, -tl + 3, 1.6, '#7a5a34'); poly(g, [[10 + th, -tl + 1], [8.5 + th, -tl + 6], [11.5 + th, -tl + 6]], '#dfe3ea');
    g.fillStyle = C.d; g.beginPath(); g.ellipse(-5, -12, 3, 4.5, 0, 0, 7); g.fill();
  } else if (k === 'archer') {
    g.translate(0, -bob);
    limb(g, -1.5, -8, -2 + sw * 3, 0, 2.6, '#4a3a2a'); limb(g, 1.5, -8, 2 - sw * 3, 0, 2.6, '#4a3a2a');
    poly(g, [[-4, -18], [4, -18], [5, -7], [-5, -7]], C.d); g.fillStyle = '#6a8a3a'; g.fillRect(-4, -13, 8, 2);
    g.fillStyle = SKIN; g.beginPath(); g.arc(0, -21, 3.2, 0, 7); g.fill(); g.fillStyle = C.d; g.beginPath(); g.arc(0, -21.5, 3.9, Math.PI * .95, .05); g.fill();
    const pull = u.act === 'fight' ? Math.max(0, 1 - u.cd / u.st.rof) : 0;
    g.strokeStyle = '#7a5a34'; g.lineWidth = 1.6; g.beginPath(); g.arc(7, -14, 9, -1.1, 1.1); g.stroke();
    g.strokeStyle = '#eee'; g.lineWidth = .8; g.beginPath(); g.moveTo(7 + Math.cos(-1.1) * 9, -14 + Math.sin(-1.1) * 9); g.lineTo(7 + 9 * Math.cos(0) - pull * 8, -14); g.lineTo(7 + Math.cos(1.1) * 9, -14 + Math.sin(1.1) * 9); g.stroke();
    limb(g, 2, -15, 7, -14, 1.7, SKIN); if (pull > 0) limb(g, 7, -14, 14 - pull * 8, -14, 1, '#caa');
  } else if (k === 'scout' || k === 'knight') {
    const kn = k === 'knight', lg = sw * 4, hc = kn ? '#4a3626' : '#8a6238';
    g.translate(0, -bob * .6);
    // horse
    for (const [lx, ph2] of [[-9, 1], [-6, -1], [7, -1], [10, 1]]) limb(g, lx, -9, lx + lg * ph2, -.5, 2.4, shade(hc, .7));
    g.fillStyle = hc; g.beginPath(); g.ellipse(0, -11, 12.5, 5.6, 0, 0, 7); g.fill();
    poly(g, [[8, -13], [13, -22], [17, -21], [14, -12]], hc); g.beginPath(); g.ellipse(16.5, -20.5, 4, 2.6, .3, 0, 7); g.fill();
    limb(g, -12, -12, -16, -6 + sw * 2, 2, '#2a1c10');
    if (kn) { g.fillStyle = C.m; g.beginPath(); g.moveTo(-9, -16); g.lineTo(9, -16); g.lineTo(10, -8); g.lineTo(-10, -8); g.fill(); g.fillStyle = '#d8dde6'; g.beginPath(); g.ellipse(15, -22, 2.4, 3, .3, 0, 7); g.fill(); }
    else { g.fillStyle = shade(C.m, .9); g.fillRect(-4, -17, 8, 3); }
    // rider
    poly(g, [[-3.5, -26], [3.5, -26], [4, -15], [-4, -15]], kn ? '#b5bcc8' : C.m);
    g.fillStyle = SKIN; g.beginPath(); g.arc(0, -29.5, 3.2, 0, 7); g.fill(); g.fillStyle = kn ? '#c9d0da' : C.d; g.beginPath(); g.arc(0, -30, 3.9, Math.PI, 0); g.fill(); if (kn) { g.fillStyle = C.l; g.fillRect(-1, -37, 2, 5); }
    const th = u.act === 'fight' ? Math.sin(u.cd * 9) * 5 : 0;
    if (kn) { limb(g, 3, -23, 8 + th, -22, 1.8, SKIN); limb(g, -3 + th, -16, 18 + th, -30, 1.5, '#7a5a34'); poly(g, [[18 + th, -31], [17 + th, -27], [22 + th, -30.5]], '#eee'); g.fillStyle = C.d; g.beginPath(); g.ellipse(-3, -22, 3, 4.5, 0, 0, 7); g.fill(); }
    else { limb(g, 3, -23, 7, -20, 1.7, SKIN); limb(g, 7, -20, 7 + 8 * Math.cos(-.6 + th * .1), -20 - 8 * Math.sin(.6 - th * .1) , 1.5, '#ccd'); }
  } else if (k === 'ram') {
    g.translate(0, 0);
    const sw2 = mv ? Math.sin(ph * .5) : 0, atk = u.act === 'fight' ? Math.sin(u.cd * 7) * 5 : 0;
    g.fillStyle = '#3d2c1a'; for (const wx of [-10, 8]) { g.beginPath(); g.ellipse(wx, -4, 4, 5, 0, 0, 7); g.fill(); }
    poly(g, [[-15, -8], [14, -8], [14, -15], [-15, -15]], '#6e4e2a', '#2a1c10'); poly(g, [[-16, -15], [0, -30], [16, -15]], C.m, 'rgba(0,0,0,.4)'); poly(g, [[0, -30], [16, -15], [16, -12], [0, -26]], shade(C.m, .7));
    limb(g, -14 + atk, -11, 21 + atk + sw2, -11, 4.5, '#5b4128'); g.fillStyle = '#7a7f8a'; poly(g, [[21 + atk, -15], [27 + atk, -11], [21 + atk, -7]], '#8a909c');
  } else if (k === 'mangonel') {
    const fire = u.cd > 0 ? Math.max(0, u.cd / u.st.rof) : 0, ang = -.9 + (1 - fire) * 1.9 * (fire < .8 ? 1 : 0);
    g.fillStyle = '#3d2c1a'; for (const wx of [-10, 9]) { g.beginPath(); g.ellipse(wx, -4, 4, 5.5, 0, 0, 7); g.fill(); }
    poly(g, [[-15, -8], [15, -8], [14, -12], [-14, -12]], '#7a5a34', '#2a1c10'); poly(g, [[-3, -12], [3, -12], [3, -22], [-3, -22]], '#5b4128');
    limb(g, 0, -20, -9 * Math.cos(ang) , -20 + 9 * Math.sin(ang), 3, '#6e4e2a'); limb(g, 0, -20, 14 * Math.cos(ang), -20 - 14 * Math.sin(ang * -1) * -1, 3, '#7a5a34');
    g.fillStyle = C.m; g.fillRect(-4, -10, 8, 3); if (fire < .1 || fire > .8) { g.fillStyle = '#555'; g.beginPath(); g.arc(14 * Math.cos(ang), -20 + 14 * Math.sin(ang), 3, 0, 7); g.fill(); }
  }
  g.restore();
  if (selected || hover || u.hp < u.maxhp) {
    const w = big ? 28 : 22, y = Y - (u.cls === 'cav' ? 44 : u.cls === 'siege' ? 36 : 34), f = Math.max(0, u.hp / u.maxhp);
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(X - w / 2 - 1, y - 1, w + 2, 5);
    g.fillStyle = f > .6 ? '#4cc24c' : f > .3 ? '#e2c130' : '#d93a2e'; g.fillRect(X - w / 2, y, w * f, 3);
  }
}

// ================= main draw =================
let sortList = [];
function selRing(x, y, r, col, w) { const [X, Y] = proj(x, y); ctx.strokeStyle = col; ctx.lineWidth = w || 1.6; ctx.beginPath(); ctx.ellipse(X, Y, r * 22, r * 11, 0, 0, 7); ctx.stroke(); }
function drawBld(b, selected, hover) {
  const sp = SPR.b[b.kind][b.owner], [X, Y] = proj(b.x, b.y), g = ctx, x0 = X - sp.ax, y0 = Y - sp.ay;
  if (b.flash > 0) g.filter = 'brightness(1.5)';
  if (!b.done) {
    const f = Math.max(.1, b.prog), hh = Math.max(4, sp.h * f);
    g.globalAlpha = .96; g.drawImage(sp.c, 0, sp.h - hh, sp.w, hh, x0, y0 + sp.h - hh, sp.w, hh); g.globalAlpha = 1;
    // scaffold
    const s = b.s; g.strokeStyle = 'rgba(120,84,40,.9)'; g.lineWidth = 2;
    const cs = [[b.bx, b.by], [b.bx + s, b.by], [b.bx + s, b.by + s], [b.bx, b.by + s]].map(p => proj(p[0], p[1])), top = 16 + s * 10;
    for (const c of cs.slice(2)) { g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0], c[1] - top); g.stroke(); }
    g.beginPath(); g.moveTo(cs[3][0], cs[3][1] - top); g.lineTo(cs[2][0], cs[2][1] - top); g.lineTo(cs[1][0], cs[1][1] - top); g.stroke();
    g.beginPath(); g.moveTo(cs[3][0], cs[3][1] - top / 2); g.lineTo(cs[2][0], cs[2][1] - top / 2); g.lineTo(cs[1][0], cs[1][1] - top / 2); g.stroke();
  } else {
    g.drawImage(sp.c, x0, y0);
    if (sp.mill) { const mx = x0 + sp.mill[0], my = y0 + sp.mill[1], a = G.t * (b.owner ? .8 : .8) + b.id; g.strokeStyle = '#6a4a2a'; g.lineWidth = 3; for (let i = 0; i < 4; i++) { const an = a + i * Math.PI / 2, ex = mx + Math.cos(an) * 30, ey = my + Math.sin(an) * 30; g.beginPath(); g.moveTo(mx, my); g.lineTo(ex, ey); g.stroke(); poly(g, [[mx + Math.cos(an) * 8, my + Math.sin(an) * 8], [ex, ey], [ex - Math.sin(an) * 7, ey + Math.cos(an) * 7], [mx + Math.cos(an) * 8 - Math.sin(an) * 7, my + Math.sin(an) * 8 + Math.cos(an) * 7]], 'rgba(235,225,200,.92)'); } g.fillStyle = '#3a2a1a'; g.beginPath(); g.arc(mx, my, 3.5, 0, 7); g.fill(); }
    if (sp.smoke && Math.random() < .08) addPart({ x: b.x + .5, y: b.y - .8, z: 70, vx: .05, vy: -.05, vz: 14, life: 1.6, c: '#888', size: 3, g: 0, kind: 'smoke' });
    if (sp.fx >= 0 && b.kind !== 'house') { const fx = X - sp.ax + sp.fx, fy = Y - sp.ay + sp.fy; g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 20); g.stroke(); const w = Math.sin(G.t * 4 + b.id) * 2; g.fillStyle = COL[b.owner].m; g.beginPath(); g.moveTo(fx, fy - 20); g.quadraticCurveTo(fx + 8, fy - 22 + w, fx + 14, fy - 18 + w); g.lineTo(fx + 12, fy - 13 + w); g.quadraticCurveTo(fx + 6, fy - 15 + w, fx, fy - 12); g.fill(); }
  }
  g.filter = 'none';
  if (selected || hover || b.hp < b.maxhp * .999 && b.done) {
    const w = 30 + b.s * 10, y = Y - sp.ay - 2 + (b.kind === 'farm' ? 10 : 0) + (sp.ay - (sp.h - sp.ay)) * 0 + 6, f = Math.max(0, b.hp / b.maxhp);
    const yy = b.kind === 'farm' ? Y - 14 : Y - sp.ay + 6;
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(X - w / 2 - 1, yy - 1, w + 2, 6); g.fillStyle = f > .6 ? '#4cc24c' : f > .3 ? '#e2c130' : '#d93a2e'; g.fillRect(X - w / 2, yy, w * f, 4);
  }
  if (!b.done) { const w = 40, yy = Y - 30 - b.s * 8; ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(X - w / 2 - 1, yy - 1, w + 2, 6); ctx.fillStyle = '#e8c04a'; ctx.fillRect(X - w / 2, yy, w * b.prog, 4); }
}
function drawRes(r) {
  const [X, Y] = proj(r.x + r.ox, r.y + r.oy), g = ctx;
  if (r.kind === 'tree') { const s = TREES[r.v]; g.drawImage(s.c, X - s.ax, Y - s.ay); }
  else { const s = SPR[r.kind]; let k = 1; if (r.kind !== 'berry') k = .6 + .4 * Math.max(0, r.amt / r.max); else k = .7 + .3 * (r.amt / r.max); g.drawImage(s.c, 0, 0, s.w, s.h, X - s.ax * k, Y - s.ay * k, s.w * k, s.h * k); }
}
function drawDecals() {
  for (const d of G.decals) {
    if (d.k === 'rubble') {
      if (!expAt(d.bx + d.s / 2, d.by + d.s / 2)) continue;
      const [X, Y] = proj(d.bx + d.s / 2, d.by + d.s / 2);
      ctx.fillStyle = 'rgba(40,32,24,.55)'; ctx.beginPath(); ctx.ellipse(X, Y, d.s * 26, d.s * 12, 0, 0, 7); ctx.fill();
      let sd = d.bx * 7 + d.by * 3; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < d.s * 7; i++) { const a = rr() * 6.28, rd = rr() * d.s * 18; ctx.fillStyle = ['#6b5a48', '#8a7a62', '#4a3a2c'][i % 3]; ctx.fillRect(X + Math.cos(a) * rd * 1.6, Y + Math.sin(a) * rd * .8 - 3, 4 + rr() * 5, 3 + rr() * 3); }
      if (d.t < 6) { ctx.fillStyle = `rgba(255,140,40,${.25 * (1 - d.t / 6)})`; ctx.beginPath(); ctx.ellipse(X, Y - 4, d.s * 18, d.s * 8, 0, 0, 7); ctx.fill(); }
    } else if (d.k === 'corpse') {
      if (!visAt(d.x, d.y)) continue; const [X, Y] = proj(d.x, d.y), a = d.t > 18 ? 1 - (d.t - 18) / 7 : 1;
      ctx.globalAlpha = Math.max(0, a) * .85; ctx.fillStyle = COL[d.owner].d; ctx.beginPath(); ctx.ellipse(X, Y - 1, 7, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(X + 6 * d.fx, Y - 1, 2.3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}
function drawParts() {
  const g = ctx;
  for (const p of G.parts) {
    if (!expAt(p.x, p.y)) continue; const [X, Y] = proj(p.x, p.y), f = p.t / p.life, py = Y - p.z;
    if (p.kind === 'text') { g.globalAlpha = 1 - f * f; g.font = 'bold 12px Georgia'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(p.text, X + 1, py + 1); g.fillStyle = '#fff'; g.fillText(p.text, X, py); g.globalAlpha = 1; }
    else if (p.kind === 'fire') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - f) * .85; const r = p.size * (1 - f * .6); const gr = g.createRadialGradient(X, py, 0, X, py, r * 2); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(.4, p.c); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(X, py, r * 2, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    else if (p.kind === 'smoke') { g.globalAlpha = (1 - f) * .45; g.fillStyle = p.c; g.beginPath(); g.arc(X, py, p.size * (1 + f * 2), 0, 7); g.fill(); g.globalAlpha = 1; }
    else { g.globalAlpha = 1 - f; g.fillStyle = p.c; g.beginPath(); g.arc(X, py, p.size, 0, 7); g.fill(); g.globalAlpha = 1; }
  }
}
function drawProj() {
  const g = ctx;
  for (const p of G.proj) {
    if (!expAt(p.sx, p.sy) && !expAt(p.tx, p.ty)) continue;
    const t = p.t / p.dur, x = p.sx + (p.tx - p.sx) * t, y = p.sy + (p.ty - p.sy) * t, d = Math.hypot(p.tx - p.sx, p.ty - p.sy);
    const z = 14 + 4 * (p.arc || .3) * t * (1 - t) * d * (p.k === 'rock' ? 22 : 12), [X, Y] = proj(x, y);
    if (p.k === 'arrow') {
      const t2 = Math.max(0, t - .06), x2 = p.sx + (p.tx - p.sx) * t2, y2 = p.sy + (p.ty - p.sy) * t2, z2 = 14 + 4 * (p.arc || .3) * t2 * (1 - t2) * d * 12, [X2, Y2] = proj(x2, y2);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X - 1, Y, 2, 1.5); g.strokeStyle = '#f2ead0'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(X2, Y2 - z2); g.lineTo(X, Y - z); g.stroke();
    } else { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(X, Y, 5, 2.5, 0, 0, 7); g.fill(); g.fillStyle = '#3a3630'; g.beginPath(); g.arc(X, Y - z, 4.5, 0, 7); g.fill(); g.fillStyle = '#6b6558'; g.beginPath(); g.arc(X - 1, Y - z - 1, 2, 0, 7); g.fill(); }
  }
}

function render(ui) {
  const g = ctx; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05070b'; g.fillRect(0, 0, VW, VH);
  const z = cam.z; g.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
  const vw = VW / z, vh = VH / z;
  // terrain
  const sx = Math.max(0, cam.x + OX), sy = Math.max(0, cam.y), ex = Math.min(terrainC.width, cam.x + OX + vw), ey = Math.min(terrainC.height, cam.y + vh);
  if (ex > sx && ey > sy) g.drawImage(terrainC, sx, sy, ex - sx, ey - sy, sx - OX, sy, ex - sx, ey - sy);
  drawDecals();
  const onScreen = (X, Y, m) => X > cam.x - m && X < cam.x + vw + m && Y > cam.y - m && Y < cam.y + vh + m + 60;
  const sel = ui.selSet, hov = ui.hover;
  // ground layer: farms, selection rings
  for (const b of B) { if (b.dead || b.kind !== 'farm') continue; if (b.owner !== 0 && !expAt(b.x, b.y)) continue; const [X, Y] = proj(b.x, b.y); if (onScreen(X, Y, 150)) drawBld(b, sel.has(b.id), hov === b); }
  for (const u of U) if (!u.dead && sel.has(u.id)) selRing(u.x, u.y, u.cls === 'cav' || u.cls === 'siege' ? .62 : .45, u.owner ? '#ff5a4a' : '#6dff7a', 1.8);
  for (const b of B) if (!b.dead && (sel.has(b.id) || hov === b)) {
    const col = b.owner ? '#ff5a4a' : sel.has(b.id) ? '#6dff7a' : 'rgba(255,255,255,.6)', pts = [[b.bx, b.by], [b.bx + b.s, b.by], [b.bx + b.s, b.by + b.s], [b.bx, b.by + b.s]].map(p => proj(p[0], p[1]));
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.stroke();
    if (b.rally && b.owner === 0 && sel.has(b.id)) { const [rx, ry] = proj(b.rally.x, b.rally.y), [bx, by] = proj(b.x, b.y); g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(bx, by); g.lineTo(rx, ry); g.stroke(); g.setLineDash([]); g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx, ry - 22); g.stroke(); g.fillStyle = '#6dff7a'; g.beginPath(); g.moveTo(rx, ry - 22); g.lineTo(rx + 13, ry - 18); g.lineTo(rx, ry - 13); g.fill(); }
  }
  if (hov && hov.type === 'unit' && !sel.has(hov.id)) selRing(hov.x, hov.y, .42, 'rgba(255,255,255,.7)', 1.4);
  for (const m of ui.marks) { const [X, Y] = proj(m.x, m.y), f = m.t / .8; g.strokeStyle = m.c; g.globalAlpha = 1 - f; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Y, 18 * (1 - f * .5), 9 * (1 - f * .5), 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
  // placement footprint under ghost handled later
  // sorted entities
  sortList.length = 0;
  for (const b of B) { if (b.dead || b.kind === 'farm') continue; if (b.owner !== 0 && !expAt(b.x, b.y)) continue; const [X, Y] = proj(b.x, b.y); if (onScreen(X, Y, 200)) sortList.push([b.x + b.y + .001 * b.id, b, 1]); }
  for (const r of R) { if (r.dead || !G.explored[r.ty * N + r.tx]) continue; const [X, Y] = proj(r.x, r.y); if (onScreen(X, Y, 60)) sortList.push([r.x + r.y, r, 2]); }
  for (const u of U) { if (u.dead) continue; if (u.owner !== 0 && !visAt(u.x, u.y)) continue; const [X, Y] = proj(u.x, u.y); if (onScreen(X, Y, 50)) sortList.push([u.x + u.y + .0001 * u.id, u, 3]); }
  sortList.sort((a, b) => a[0] - b[0]);
  for (const [, e, t] of sortList) { if (t === 1) drawBld(e, sel.has(e.id), hov === e); else if (t === 2) drawRes(e); else drawUnit(e, sel.has(e.id), hov === e); }
  drawProj(); drawParts();
  // fog
  if (G.fogDirty) updateFogCanvas();
  g.save(); g.setTransform(32 * z, 16 * z, -32 * z, 16 * z, (OX - cam.x) * z, -cam.y * z); g.imageSmoothingEnabled = true; g.drawImage(fogC, 0, 0, N, N); g.restore();
  // placement ghost
  if (ui.place && ui.mouseIn) {
    const k = ui.place.kind, d = BLDS[k], [mx, my] = screenToWorld(ui.mx, ui.my), bx = Math.round(mx - d.size / 2), by = Math.round(my - d.size / 2);
    ui.place.bx = bx; ui.place.by = by; const ok = canPlace(k, bx, by, 0) && P(0).age >= d.age; ui.place.ok = ok;
    const sp = SPR.b[k][0], [X, Y] = proj(bx + d.size / 2, by + d.size / 2);
    const pts = [[bx, by], [bx + d.size, by], [bx + d.size, by + d.size], [bx, by + d.size]].map(p => proj(p[0], p[1]));
    g.fillStyle = ok ? 'rgba(80,255,110,.35)' : 'rgba(255,70,60,.4)'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fill();
    g.globalAlpha = .65; g.drawImage(sp.c, X - sp.ax, Y - sp.ay); g.globalAlpha = 1;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  // age flash
  if (G.ageFlash) { const f = G.ageFlash.t; if (f < 3.5) { const a = f < .4 ? f / .4 : f > 2.8 ? (3.5 - f) / .7 : 1; g.globalAlpha = a * .9; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, VH * .3, VW, 110); g.globalAlpha = a; g.textAlign = 'center'; g.fillStyle = '#f3d98a'; g.font = 'bold 44px Georgia'; g.fillText(AGES[G.ageFlash.age], VW / 2, VH * .3 + 62); g.font = 'italic 16px Georgia'; g.fillStyle = '#e8dcc0'; g.fillText('A new age dawns upon your kingdom', VW / 2, VH * .3 + 92); g.globalAlpha = 1; } else G.ageFlash = null; }
}

// ================= minimap =================
function drawMinimap(mc, ui) {
  const g = mc.getContext('2d'), sx = 120 / N, sy = 60 / N, M = (x, y) => [120 + (x - y) * sx, (x + y) * sy];
  g.clearRect(0, 0, 240, 120); g.drawImage(miniC, 0, 0);
  for (const r of R) { if (r.dead || r.kind === 'tree' || !G.explored[r.ty * N + r.tx]) continue; const [x, y] = M(r.x, r.y); g.fillStyle = r.kind === 'gold' ? '#ffd43b' : r.kind === 'stone' ? '#ccd' : '#c33'; g.fillRect(x - 1, y - 1, 2, 2); }
  for (const r of R) { if (r.dead || r.kind !== 'tree' || !G.explored[r.ty * N + r.tx]) continue; const [x, y] = M(r.x, r.y); g.fillStyle = 'rgba(20,70,30,.8)'; g.fillRect(x - .5, y - .5, 1.6, 1.6); }
  for (const b of B) { if (b.dead || (b.owner && !G.explored[(b.by | 0) * N + (b.bx | 0)])) continue; const [x, y] = M(b.x, b.y); g.fillStyle = COL[b.owner].m; g.fillRect(x - 2, y - 1.5, 4, 3); g.strokeStyle = '#000'; g.lineWidth = .5; g.strokeRect(x - 2, y - 1.5, 4, 3); }
  for (const u of U) { if (u.dead || (u.owner && !visAt(u.x, u.y))) continue; const [x, y] = M(u.x, u.y); g.fillStyle = COL[u.owner].l; g.fillRect(x - 1, y - 1, 2, 2); }
  g.save(); g.setTransform(sx, sy, -sx, sy, 120, 0); g.imageSmoothingEnabled = true; g.drawImage(fogC, 0, 0, N, N); g.restore();
  for (const a of G.alerts) if (a.ping && G.t - a.t < 4) { const [x, y] = M(a.x, a.y), r = ((G.t - a.t) * 14) % 14; g.strokeStyle = '#ff4030'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 3 + r, 0, 7); g.stroke(); }
  const c = [[0, 0], [VW, 0], [VW, VH], [0, VH]].map(p => { const [wx, wy] = screenToWorld(p[0], p[1]); return M(Math.max(0, Math.min(N, wx)), Math.max(0, Math.min(N, wy))); });
  g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(c[0][0], c[0][1]); for (const p of c.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.stroke();
}
function minimapToWorld(px, py) { const sx = 120 / N, sy = 60 / N, a = (px - 120) / sx, b = py / sy; return [(a + b) / 2, (b - a) / 2]; }
