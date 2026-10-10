// Non-blocking ground clutter (6-28 px): grass tufts, wildflowers, small rocks, mushrooms, ferns, reeds, shrubs, fallen logs, pebbles.
// Sprites are tiny, so outlines are soft/light (or absent) and shadows are subtle.  Anchor = ground contact point, bottom centre.
import { makeCanvas, toSprite, rng } from './common.js';
import {
  TAU, clamp, lerp, hsl, ramp, addDab, makeClump, paintClump, taper, featherPath, lightPass, finish,
} from './resources_util.js';
import { drawRock, ROCK_STONE, ROCK_STONE_WARM, ROCK_DARK } from './resources_rocks.js';

export const DECOR_KINDS = ['tuft', 'flowers', 'rocks', 'mushrooms', 'fern', 'reeds', 'shrub', 'log', 'pebbles'];
export const DECOR_COUNTS = [6, 6, 5, 5, 5, 4, 8, 4, 6];

const GRASS = { h0: 134, h1: 78, s0: 44, s1: 66, l0: 12, l1: 58 };
const GRASS_DRY = { h0: 52, h1: 50, s0: 44, s1: 70, l0: 16, l1: 66 };
const GRASS_DARK = { h0: 150, h1: 100, s0: 42, s1: 52, l0: 9, l1: 44 };

const OL_SOFT = 'rgba(24,36,12,0.55)';
const OL_ROCK = 'rgba(22,18,12,0.7)';

/** curved tapered blade from base (x0,y0) to tip (x1,y1) with base width w */
function blade(ctx, x0, y0, x1, y1, w, spec, tBase, tTip, lean = 0.2) {
  const qx = x0 + (x1 - x0) * lean, qy = y0 + (y1 - y0) * 0.62;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, ramp(spec, tBase)); g.addColorStop(1, ramp(spec, tTip));
  ctx.beginPath();
  ctx.moveTo(x0 - w / 2, y0);
  ctx.quadraticCurveTo(qx - w * 0.38, qy, x1, y1);
  ctx.quadraticCurveTo(qx + w * 0.42, qy, x0 + w / 2, y0);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
}
function bladeTuft(ctx, rand, cx, cy, n, hMin, hMax, spread, spec, wMax = 2.2, light = 0) {
  const blades = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    blades.push({
      u, h: lerp(hMin, hMax, 0.35 + 0.65 * (1 - Math.abs(u)) * (0.6 + rand() * 0.4)) * (0.8 + rand() * 0.3),
      x: cx + u * spread * 0.5 + (rand() - 0.5) * 1.2, bend: u * spread * 0.55 + (rand() - 0.5) * 3, w: wMax * (0.7 + rand() * 0.5),
    });
  }
  blades.sort((a, b) => Math.abs(b.u) - Math.abs(a.u));
  for (const b of blades) {
    const lit = clamp(0.5 - b.u * 0.22 + (rand() - 0.5) * 0.12 + light, 0.2, 0.9);
    blade(ctx, b.x, cy, b.x + b.bend, cy - b.h, b.w, spec, lit * 0.62, lit + 0.12);
  }
}
function groundBlob(ctx, cx, cy, rx, ry, a = 0.3) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
  g.addColorStop(0, 'rgba(8,16,6,' + a + ')'); g.addColorStop(1, 'rgba(8,16,6,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
}

// ------------------------------------------------------------------ tufts
function buildTuft(v) {
  const S = makeCanvas(40, 28), ctx = S.ctx, rand = rng(11000 + v * 37);
  const ax = 20, ay = 22;
  groundBlob(ctx, ax + 2, ay + 0.5, 9, 3, 0.28);
  if (v === 0) { bladeTuft(ctx, rand, ax, ay, 7, 7, 11, 9, GRASS); }
  else if (v === 1) { bladeTuft(ctx, rand, ax, ay, 10, 11, 16, 12, GRASS, 2.2, 0.04); }
  else if (v === 2) { bladeTuft(ctx, rand, ax, ay, 8, 8, 13, 11, GRASS_DRY, 2.0, 0.02); }
  else if (v === 3) {
    bladeTuft(ctx, rand, ax - 3, ay, 5, 6, 9, 7, GRASS); bladeTuft(ctx, rand, ax + 4, ay + 0.5, 6, 7, 11, 8, GRASS, 2, 0.05);
    // seed heads
    for (let i = 0; i < 3; i++) {
      const hx = ax - 5 + i * 5 + rand() * 2, hy = ay - 12 - rand() * 3;
      ctx.strokeStyle = ramp(GRASS, 0.5); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(hx - 1, ay); ctx.quadraticCurveTo(hx - 1, ay - 7, hx, hy); ctx.stroke();
      ctx.fillStyle = hsl(50, 55, 62); ctx.beginPath(); ctx.ellipse(hx, hy - 1.5, 0.9, 2.4, 0.1, 0, TAU); ctx.fill();
    }
  } else if (v === 4) { bladeTuft(ctx, rand, ax, ay, 9, 6, 10, 14, GRASS_DARK, 2.1); }
  else { bladeTuft(ctx, rand, ax - 2, ay, 6, 7, 12, 8, GRASS); bladeTuft(ctx, rand, ax + 5, ay + 0.5, 5, 5, 8, 7, GRASS_DRY, 1.9); }
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ flowers
function stem(ctx, x0, y0, x1, y1, w = 0.9) {
  ctx.strokeStyle = ramp(GRASS, 0.42); ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + (x1 - x0) * 0.3, (y0 + y1) / 2 + 2, x1, y1); ctx.stroke();
}
function leafAt(ctx, x, y, len, ang, spec = GRASS, t = 0.5) {
  featherPath(ctx, x, y, x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 - 0.8, x + Math.cos(ang) * len, y + Math.sin(ang) * len, len * 0.22);
  ctx.fillStyle = ramp(spec, t); ctx.fill();
}
function daisy(ctx, x, y, r, petal, center, nP = 8) {
  const sq = 0.72;
  ctx.fillStyle = 'rgba(10,20,6,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.8, r * 1.05, r * sq * 1.05, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * TAU + 0.2;
    const px = x + Math.cos(a) * r * 0.62, py = y + Math.sin(a) * r * 0.62 * sq;
    const lit = -(Math.cos(a) * 0.6 + Math.sin(a) * 0.8) > 0;
    ctx.fillStyle = lit ? petal[0] : petal[1];
    ctx.beginPath(); ctx.ellipse(px, py, r * 0.52, r * 0.24 * (0.9 + sq * 0.3), a, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = center[1]; ctx.beginPath(); ctx.ellipse(x + 0.2, y + 0.2, r * 0.36, r * 0.3, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = center[0]; ctx.beginPath(); ctx.ellipse(x - 0.15, y - 0.15, r * 0.26, r * 0.2, 0, 0, TAU); ctx.fill();
}
function poppy(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(10,20,6,0.25)'; ctx.beginPath(); ctx.ellipse(x + 0.5, y + 0.9, r, r * 0.7, 0, 0, TAU); ctx.fill();
  const cols = [hsl(2, 78, 36), hsl(4, 82, 46), hsl(6, 88, 58)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.6;
    ctx.fillStyle = cols[i % 2 ? 0 : 1];
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.34, r * 0.6, r * 0.5, a, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.ellipse(x - r * 0.15, y - r * 0.15, r * 0.4, r * 0.28, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1410'; ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, TAU); ctx.fill();
}
function buildFlowers(v) {
  const S = makeCanvas(34, 32), ctx = S.ctx, rand = rng(12000 + v * 41);
  const ax = 17, ay = 26;
  groundBlob(ctx, ax + 2, ay + 0.5, 11, 3.4, 0.22);
  const base = bladeTuft(ctx, rand, ax, ay, 6, 5, 8, 10, GRASS, 1.8);
  const spots = [[-7, 0, 11], [-2, -2, 15], [5, 0, 12], [9, 1.5, 9], [0, 1.5, 8], [-9, 2, 8]];
  const n = v === 5 ? 6 : 5;
  for (let i = 0; i < n; i++) {
    const s = spots[i];
    const hx = ax + s[0] + (rand() - 0.5) * 2, hy = ay - s[2] - (rand() - 0.5) * 2;
    stem(ctx, ax + s[0] * 0.5, ay, hx, hy + 1);
    leafAt(ctx, ax + s[0] * 0.55, ay - 3, 5 + rand() * 2, s[0] < 0 ? -2.6 : -0.5);
    const kind = v === 5 ? i % 3 : v;
    if (kind === 0) daisy(ctx, hx, hy, 3.3, [hsl(50, 30, 98), hsl(220, 14, 78)], [hsl(48, 100, 62), hsl(40, 90, 44)], 9);
    else if (kind === 1) poppy(ctx, hx, hy, 3.5);
    else if (kind === 2) daisy(ctx, hx, hy, 3.1, [hsl(222, 80, 68), hsl(232, 70, 44)], [hsl(260, 60, 50), hsl(260, 60, 30)], 8);
    else if (kind === 3) daisy(ctx, hx, hy, 2.9, [hsl(48, 100, 62), hsl(40, 92, 44)], [hsl(34, 100, 52), hsl(28, 90, 36)], 6);
    else if (kind === 4) {
      // pink clover / heather pom-pom
      ctx.fillStyle = 'rgba(10,20,6,0.25)'; ctx.beginPath(); ctx.ellipse(hx + 0.5, hy + 1, 3.2, 2.3, 0, 0, TAU); ctx.fill();
      for (let k = 0; k < 9; k++) {
        const a = rand() * TAU, d = rand() * 2.1;
        ctx.fillStyle = k % 3 === 0 ? hsl(326, 70, 78) : hsl(322, 62, 58);
        ctx.beginPath(); ctx.arc(hx + Math.cos(a) * d, hy + Math.sin(a) * d * 0.8, 1.15, 0, TAU); ctx.fill();
      }
    }
  }
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ rocks
function buildRocks(v) {
  const S = makeCanvas(48, 38), ctx = S.ctx, rand = rng(13000 + v * 43);
  const ax = 24, ay = 26;
  const spec = v === 3 ? ROCK_STONE_WARM : v === 4 ? ROCK_DARK : ROCK_STONE;
  const items = [
    [[0, 0, 7, 6.5]],
    [[-5, 1, 5.5, 5], [5, 2, 6.5, 6]],
    [[-8, 1, 4.5, 4], [1, -1.5, 7, 7], [8, 3, 4, 3.5]],
    [[-3, 0, 8.5, 5], [7, 3, 3.5, 3]],
    [[0, 0, 9, 8], [-9, 3, 3.5, 3.2]],
  ][v % 5];
  items.sort((a, b) => a[1] - b[1]);
  for (const r of items) {
    drawRock(ctx, rand, ax + r[0], ay + r[1], r[2], r[3], spec, { sides: 6, taper: 0.55, cracks: 1, ao: 0.4, speckle: 4, edge: 'rgba(14,10,8,0.45)' });
    if (v === 0 || v === 2) {                          // moss on top
      ctx.fillStyle = hsl(92, 38, 36, 0.8);
      ctx.beginPath();
      for (let k = 0; k < 3; k++) addDab(ctx, ax + r[0] + (rand() - 0.5) * r[2] * 0.8, ay + r[1] - r[3] * (0.55 + rand() * 0.35), 1.4 + rand(), 0.8 + rand() * 0.4, rand());
      ctx.fill();
    }
  }
  finish(S, OL_ROCK, [[ax + 6, ay + 2, 14, 4.5, 0.2]]);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ mushrooms
function shroom(ctx, x, y, h, capR, capSpec, stemCol, spots) {
  // stem
  const sg = ctx.createLinearGradient(x - capR * 0.4, 0, x + capR * 0.4, 0);
  sg.addColorStop(0, ramp(stemCol, 0.96)); sg.addColorStop(1, ramp(stemCol, 0.5));
  ctx.beginPath();
  ctx.moveTo(x - capR * 0.34, y - h);
  ctx.quadraticCurveTo(x - capR * 0.3, y - h * 0.4, x - capR * 0.42, y);
  ctx.lineTo(x + capR * 0.42, y);
  ctx.quadraticCurveTo(x + capR * 0.3, y - h * 0.4, x + capR * 0.34, y - h);
  ctx.closePath(); ctx.fillStyle = sg; ctx.fill();
  // ground contact
  ctx.fillStyle = 'rgba(8,14,4,0.3)'; ctx.beginPath(); ctx.ellipse(x + 0.6, y + 0.4, capR * 0.7, capR * 0.25, 0, 0, TAU); ctx.fill();
  // cap dome
  const cy = y - h;
  const g = ctx.createRadialGradient(x - capR * 0.35, cy - capR * 0.55, 0.2, x, cy - capR * 0.1, capR * 1.15);
  g.addColorStop(0, ramp(capSpec, 0.85)); g.addColorStop(0.5, ramp(capSpec, 0.55)); g.addColorStop(1, ramp(capSpec, 0.2));
  ctx.beginPath();
  ctx.moveTo(x - capR, cy);
  ctx.bezierCurveTo(x - capR, cy - capR * 1.15, x + capR, cy - capR * 1.15, x + capR, cy);
  ctx.quadraticCurveTo(x, cy + capR * 0.38, x - capR, cy);
  ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  // gill shadow under the cap rim
  ctx.fillStyle = 'rgba(30,14,10,0.35)';
  ctx.beginPath(); ctx.ellipse(x + 0.3, cy + capR * 0.12, capR * 0.9, capR * 0.18, 0, 0, Math.PI); ctx.fill();
  if (spots) {
    ctx.fillStyle = 'rgba(255,252,240,0.95)';
    ctx.beginPath();
    const sp = [[-0.4, -0.62, 0.2], [0.2, -0.78, 0.16], [0.55, -0.4, 0.17], [-0.7, -0.28, 0.14], [0.05, -0.32, 0.15]];
    for (const q of sp) ctx.ellipse(x + q[0] * capR, cy + q[1] * capR, capR * q[2], capR * q[2] * 0.7, 0, 0, TAU), ctx.moveTo(x + q[0] * capR + capR * q[2], cy + q[1] * capR);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.ellipse(x - capR * 0.38, cy - capR * 0.52, capR * 0.22, capR * 0.12, -0.5, 0, TAU); ctx.fill();
}
function buildMushrooms(v) {
  const S = makeCanvas(40, 30), ctx = S.ctx, rand = rng(14000 + v * 47);
  const ax = 20, ay = 24;
  const RED = { h0: 352, h1: 368, s0: 70, s1: 90, l0: 18, l1: 62 };
  const BROWN = { h0: 22, h1: 32, s0: 48, s1: 60, l0: 14, l1: 58 };
  const PALE = { h0: 36, h1: 44, s0: 24, s1: 30, l0: 40, l1: 86 };
  const ORANGE = { h0: 22, h1: 38, s0: 80, s1: 94, l0: 26, l1: 64 };
  const STEM = { h0: 36, h1: 46, s0: 16, s1: 20, l0: 40, l1: 96 };
  groundBlob(ctx, ax + 1, ay + 0.5, 10, 3, 0.25);
  bladeTuft(ctx, rand, ax, ay, 5, 4, 7, 14, GRASS, 1.6);
  if (v === 0) shroom(ctx, ax, ay, 7, 5.2, RED, STEM, true);
  else if (v === 1) { shroom(ctx, ax + 4, ay, 5, 3.6, RED, STEM, true); shroom(ctx, ax - 3, ay + 1, 8, 5.4, RED, STEM, true); }
  else if (v === 2) { shroom(ctx, ax, ay, 6, 5.8, BROWN, STEM, false); shroom(ctx, ax + 6, ay + 1, 4, 3.4, BROWN, STEM, false); }
  else if (v === 3) { for (let i = 0; i < 5; i++) shroom(ctx, ax - 7 + i * 3.6 + (rand() - 0.5), ay + (i % 2) * 1.5, 3 + rand() * 3, 2.1 + rand() * 1.1, PALE, STEM, false); }
  else { shroom(ctx, ax - 2, ay, 7, 4.2, ORANGE, STEM, false); shroom(ctx, ax + 4, ay + 1, 5, 3.2, ORANGE, STEM, false); shroom(ctx, ax - 8, ay + 1, 3.5, 2.6, ORANGE, STEM, false); }
  finish(S, 'rgba(36,20,12,0.5)', [[ax + 4, ay + 1, 10, 3, 0.18]]);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ ferns
function frond(ctx, rand, x0, y0, len, ang, droop, spec, tBase, pairs, wMax) {
  const pts = [];
  const N = 16;
  let x = x0, y = y0;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = ang + droop * t * t;
    pts.push([x, y, a]);
    x += Math.cos(a) * len / N; y += Math.sin(a) * len / N;
  }
  // midrib
  ctx.strokeStyle = ramp(spec, tBase * 0.7); ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
  for (let k = 1; k <= pairs; k++) {
    const t = k / (pairs + 1), p = pts[Math.round(t * N)];
    const L = wMax * Math.sin(Math.PI * Math.pow(t, 0.75)) + 0.9;
    for (const side of [-1, 1]) {
      const a = p[2] + side * (1.15 - 0.25 * t);
      const lit = side * Math.cos(p[2] + Math.PI / 2) < 0 ? 1 : 0;
      const tc = clamp(tBase + 0.14 * t + (lit ? 0.1 : -0.06) + (rand() - 0.5) * 0.06, 0.15, 0.9);
      featherPath(ctx, p[0], p[1], p[0] + Math.cos(a) * L * 0.5, p[1] + Math.sin(a) * L * 0.5 + 0.3, p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L + 0.7, L * 0.15, 4);
      ctx.fillStyle = ramp(spec, tc); ctx.fill();
    }
  }
}
function buildFern(v) {
  const S = makeCanvas(48, 42), ctx = S.ctx, rand = rng(15000 + v * 53);
  const ax = 24, ay = 32;
  const spec = v === 3 ? { h0: 40, h1: 46, s0: 40, s1: 62, l0: 14, l1: 58 } : v === 4 ? { h0: 150, h1: 104, s0: 44, s1: 50, l0: 10, l1: 46 } : { h0: 138, h1: 82, s0: 46, s1: 66, l0: 12, l1: 58 };
  groundBlob(ctx, ax + 2, ay + 0.5, 14, 4, 0.25);
  const nF = [7, 5, 8, 6, 6][v];
  const L = [20, 15, 23, 18, 19][v];
  const fronds = [];
  for (let i = 0; i < nF; i++) {
    const u = nF === 1 ? 0 : i / (nF - 1) * 2 - 1;
    fronds.push({ u, ang: -Math.PI / 2 + u * (v === 2 ? 1.2 : 1.0) + (rand() - 0.5) * 0.2, len: L * (0.7 + 0.3 * (1 - Math.abs(u)) + (rand() - 0.5) * 0.12) });
  }
  fronds.sort((a, b) => Math.abs(b.u) - Math.abs(a.u));
  for (const f of fronds) {
    const lit = 0.44 - f.u * 0.16;
    frond(ctx, rand, ax + f.u * 1.2, ay, f.len, f.ang, f.u * 0.7, spec, lit, v === 1 ? 7 : 9, v === 2 ? 4.6 : 3.8);
  }
  finish(S, 'rgba(20,40,12,0.32)', null);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ reeds / cattails
function buildReeds(v) {
  const S = makeCanvas(44, 52), ctx = S.ctx, rand = rng(16000 + v * 59);
  const ax = 22, ay = 44;
  const REED = { h0: 112, h1: 66, s0: 34, s1: 58, l0: 14, l1: 62 };
  const HEAD = { h0: 22, h1: 30, s0: 52, s1: 60, l0: 10, l1: 46 };
  groundBlob(ctx, ax + 2, ay + 1, 14, 4, 0.28);
  const nL = [7, 9, 6, 11][v];
  const nHeads = [4, 0, 2, 5][v];
  const H = [30, 27, 18, 30][v];
  // leaf blades
  const blades = [];
  for (let i = 0; i < nL; i++) {
    const u = (i / (nL - 1)) * 2 - 1;
    blades.push({ u, h: H * (0.55 + rand() * 0.45) * (1 - Math.abs(u) * 0.25), x: ax + u * (v === 3 ? 10 : 6) });
  }
  blades.sort((a, b) => Math.abs(b.u) - Math.abs(a.u));
  for (const b of blades) {
    const lit = 0.48 - b.u * 0.2 + (rand() - 0.5) * 0.1;
    blade(ctx, b.x, ay, b.x + b.u * 7 + (rand() - 0.5) * 3, ay - b.h, 2.3, REED, lit * 0.6, lit + 0.1, 0.1);
  }
  // cattail stems with brown heads
  for (let i = 0; i < nHeads; i++) {
    const u = nHeads === 1 ? 0 : (i / (nHeads - 1)) * 2 - 1;
    const x1 = ax + u * (v === 3 ? 9 : 5.5) + (rand() - 0.5) * 2, h = H * (0.78 + rand() * 0.22);
    ctx.strokeStyle = ramp(REED, 0.42); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax + u * 2.5, ay); ctx.quadraticCurveTo(x1 - u * 0.5, ay - h * 0.55, x1 + u * 1.2, ay - h); ctx.stroke();
    // head
    const hx = x1 + u * 1.0, hy = ay - h - 1;
    const g = ctx.createLinearGradient(hx - 1.8, 0, hx + 1.8, 0);
    g.addColorStop(0, ramp(HEAD, 0.8)); g.addColorStop(0.5, ramp(HEAD, 0.5)); g.addColorStop(1, ramp(HEAD, 0.14));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(hx, hy, 1.75, 4.6, u * 0.12, 0, TAU); ctx.fill();
    ctx.strokeStyle = ramp(REED, 0.7); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(hx, hy - 4.4); ctx.lineTo(hx + u * 0.5, hy - 8); ctx.stroke();
  }
  if (v === 1) {                                   // feathery plumes on the tall reeds
    for (let i = 0; i < 4; i++) {
      const x = ax - 7 + i * 4.5 + rand() * 2, y = ay - H * (0.85 + rand() * 0.15);
      ctx.fillStyle = hsl(44, 34, 66, 0.85);
      ctx.beginPath(); ctx.ellipse(x, y, 1.6, 4.2, (rand() - 0.5) * 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = hsl(40, 40, 82, 0.8);
      ctx.beginPath(); ctx.ellipse(x - 0.5, y - 0.6, 0.7, 2.6, 0, 0, TAU); ctx.fill();
    }
  }
  finish(S, 'rgba(24,36,10,0.4)', null);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ shrubs
function buildShrub(v) {
  const S = makeCanvas(48, 42), ctx = S.ctx, rand = rng(17000 + v * 61);
  const ax = 24, ay = 31;
  // 0 round green, 1 white/pink blossoms, 2 dry olive, 3 russet (muted autumn), 4 dark blue-green with berries,
  // 5 wide low green, 6 pink blossoms, 7 tall dark conifer-like shrub
  const specs = [
    { h0: 146, h1: 84, s0: 46, s1: 62, l0: 11, l1: 56 },
    { h0: 140, h1: 80, s0: 44, s1: 60, l0: 12, l1: 56 },
    { h0: 76, h1: 62, s0: 30, s1: 50, l0: 14, l1: 52 },
    { h0: 14, h1: 40, s0: 46, s1: 66, l0: 12, l1: 50 },
    { h0: 170, h1: 118, s0: 40, s1: 44, l0: 9, l1: 44 },
    { h0: 128, h1: 76, s0: 44, s1: 60, l0: 12, l1: 54 },
    { h0: 144, h1: 86, s0: 46, s1: 60, l0: 11, l1: 54 },
    { h0: 160, h1: 108, s0: 40, s1: 42, l0: 8, l1: 40 },
  ];
  const spec = specs[v % 8];
  const rx = [13, 14, 12, 12, 11, 16, 13, 9][v % 8], ry = [8.5, 8, 7.5, 8, 8.5, 7, 8, 11][v % 8], cy = ay - 6.5 - (v % 8 === 7 ? 2 : 0);
  const R = [6.2, 5.8, 5.6, 6, 5.4, 6, 5.8, 5.2][v % 8];
  const raw = [];
  for (let i = 0; i < 6; i++) { const a = ((i + rand() * 0.6) / 6) * TAU, rr = R * (0.85 + rand() * 0.4); raw.push({ x: ax + Math.cos(a) * (rx - rr * 0.6), y: cy + Math.sin(a) * (ry * 0.9 - rr * 0.5), r: rr }); }
  for (let i = 0; i < 3; i++) { const a = rand() * TAU, d = 0.15 + rand() * 0.45; raw.push({ x: ax + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: R * (0.9 + rand() * 0.3) }); }
  raw.push({ x: ax - 3 + rand() * 2, y: cy - ry * 0.45, r: R * 0.7 });
  const clumps = raw.map((c) => {
    const nx = (c.x - ax) / rx, ny = (c.y - cy) / ry;
    const f = 0.5 + 0.5 * clamp(-0.55 * nx - 0.83 * ny, -1, 1);
    return makeClump(rand, c.x, c.y, c.r, clamp(0.22 + 0.5 * f + (rand() - 0.5) * 0.08, 0.1, 0.85), 0.9);
  }).sort((a, b) => a.y - b.y);
  ctx.fillStyle = ramp(spec, 0.07); ctx.beginPath(); ctx.ellipse(ax, cy + 1, rx * 0.85, ry * 0.8, 0, 0, TAU); ctx.fill();
  for (const c of clumps) paintClump(ctx, rand, c, spec, { density: 0.8 });
  const blossoms = (n, cols) => {
    for (let i = 0; i < n; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()), x = ax + Math.cos(a) * rx * 0.85 * d, y = cy + Math.sin(a) * ry * 0.8 * d - 0.5;
      ctx.fillStyle = 'rgba(10,20,6,0.3)'; ctx.beginPath(); ctx.arc(x + 0.4, y + 0.6, 1.4, 0, TAU); ctx.fill();
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.arc(x, y, 1.35, 0, TAU); ctx.fill();
      ctx.fillStyle = hsl(46, 95, 58); ctx.beginPath(); ctx.arc(x, y, 0.5, 0, TAU); ctx.fill();
    }
  };
  if (v % 8 === 1) blossoms(12, [hsl(48, 30, 98), hsl(48, 30, 98), hsl(334, 70, 82)]);
  else if (v % 8 === 6) blossoms(12, [hsl(334, 64, 76), hsl(330, 70, 66), hsl(340, 70, 86)]);
  else if (v % 8 === 4) {                           // bluish berries
    for (let i = 0; i < 9; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()), x = ax + Math.cos(a) * rx * 0.8 * d, y = cy + Math.sin(a) * ry * 0.8 * d;
      ctx.fillStyle = hsl(236, 42, 30); ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
      ctx.fillStyle = hsl(224, 50, 66, 0.9); ctx.beginPath(); ctx.arc(x - 0.3, y - 0.3, 0.4, 0, TAU); ctx.fill();
    }
  }
  lightPass(ctx, ax - rx, cy - ry, rx * 2, ry * 2.2, 0.1, 0.2);
  finish(S, { rgb: '24,36,12', lit: 0.25, dark: 0.7 }, [[ax + 7, ay + 1, 17, 5, 0.26], [ax + 1, ay, 10, 3.2, 0.26]]);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ fallen logs
function buildLog(v) {
  const S = makeCanvas(56, 34), ctx = S.ctx, rand = rng(18000 + v * 67);
  const ax = 28, ay = 22;
  const BARK = { h0: 20, h1: 34, s0: 30, s1: 42, l0: 7, l1: 56 };
  const WOOD = { h0: 24, h1: 36, s0: 38, s1: 60, l0: 14, l1: 74 };
  const dir = v % 2 === 0 ? 1 : -1;                  // 1: axis along +x (down-right), -1: along +y (down-left)
  const L = [26, 26, 17, 24][v], r = [4.6, 4.2, 4.8, 3.6][v];
  const th = dir * 0.4636;                           // atan(0.5): iso axis
  ctx.save();
  ctx.translate(ax, ay - r * 0.6);
  ctx.rotate(th);
  // log body (horizontal cylinder in the rotated frame): light from above
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-L / 2, -r);
    ctx.lineTo(L / 2, -r);
    ctx.ellipse(L / 2, 0, r * 0.52, r, 0, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(-L / 2, r);
    ctx.ellipse(-L / 2, 0, r * 0.52, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, ramp(BARK, 0.74)); g.addColorStop(0.45, ramp(BARK, 0.46)); g.addColorStop(1, ramp(BARK, 0.12));
  body(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < 24; i++) {
    const x0 = (rand() - 0.5) * L, y0 = (rand() - 0.5) * 2 * r, len = 2 + rand() * 5;
    ctx.strokeStyle = y0 < -r * 0.2 ? ramp(BARK, 0.86, 0.4) : ramp(BARK, 0.06 + rand() * 0.14, 0.55);
    ctx.lineWidth = 0.7 + rand() * 0.6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + len, y0 + (rand() - 0.5) * 0.8); ctx.stroke();
  }
  // moss on the upper side
  ctx.fillStyle = hsl(92, 40, 32, 0.9);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) addDab(ctx, (rand() - 0.5) * L * 0.9, -r * (0.55 + rand() * 0.35), 1.8 + rand() * 2.4, 0.9 + rand() * 0.7, rand() * 0.4);
  ctx.fill();
  ctx.fillStyle = hsl(86, 46, 46, 0.9);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) addDab(ctx, (rand() - 0.55) * L * 0.9, -r * (0.6 + rand() * 0.3), 1.0 + rand() * 1.6, 0.6 + rand() * 0.5, rand() * 0.4);
  ctx.fill();
  ctx.restore();
  // cut end near the viewer (the +x end), growth rings
  const ex = L / 2;
  ctx.beginPath(); ctx.ellipse(ex, 0, r * 0.52, r, 0, 0, TAU);
  const eg = ctx.createRadialGradient(ex - 0.6, -1, 0.3, ex, 0, r);
  eg.addColorStop(0, ramp(WOOD, 0.9)); eg.addColorStop(1, ramp(WOOD, 0.56));
  ctx.fillStyle = eg; ctx.fill();
  for (let i = 1; i <= 3; i++) {
    ctx.strokeStyle = ramp(WOOD, 0.3, 0.6); ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.ellipse(ex, 0, r * 0.52 * i / 3.6, r * i / 3.6, 0, 0, TAU); ctx.stroke();
  }
  ctx.strokeStyle = ramp(BARK, 0.14, 0.9); ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(ex, 0, r * 0.52, r, 0, 0, TAU); ctx.stroke();
  // branch stub
  if (v === 2 || v === 1) {
    taper(ctx, [[-L * 0.12, -r * 0.7], [-L * 0.14, -r * 1.7], [-L * 0.16, -r * 2.3]], 2.6, 1.6, ramp(BARK, 0.34));
    ctx.fillStyle = ramp(WOOD, 0.7); ctx.beginPath(); ctx.ellipse(-L * 0.16, -r * 2.3, 1.2, 0.7, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // little mushrooms / bracket fungi on one variant
  if (v === 3) {
    const bx = ax - dir * 5, by = ay - 2;
    ctx.fillStyle = hsl(30, 60, 50); ctx.beginPath(); ctx.ellipse(bx, by, 2.4, 1.2, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(36, 70, 68); ctx.beginPath(); ctx.ellipse(bx - 0.4, by - 0.4, 1.4, 0.6, 0.3, 0, TAU); ctx.fill();
  }
  finish(S, 'rgba(30,18,8,0.7)', [[ax + 3, ay + 2.5, L * 0.62, r * 1.7, 0.3, th]]);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ pebbles
function buildPebbles(v) {
  const S = makeCanvas(36, 22), ctx = S.ctx, rand = rng(19000 + v * 71);
  const ax = 18, ay = 11;
  const LIGHT_GREY = { h0: 215, h1: 205, s0: 10, s1: 6, l0: 24, l1: 90 };
  const SAND = { h0: 38, h1: 42, s0: 20, s1: 24, l0: 28, l1: 86 };
  const WHITE = { h0: 40, h1: 44, s0: 8, s1: 10, l0: 30, l1: 98 };
  const BROWN = { h0: 24, h1: 30, s0: 16, s1: 20, l0: 20, l1: 72 };
  const specs = [LIGHT_GREY, SAND, WHITE, BROWN, ROCK_STONE, ROCK_STONE_WARM];
  const n = [6, 5, 5, 6, 7, 6][v];
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([(rand() - 0.5) * 22, (rand() - 0.5) * 6.5, 1.4 + rand() * 1.9]);
  pts.sort((a, b) => a[1] - b[1]);
  for (const p of pts) {
    const sp = v >= 4 ? (rand() < 0.5 ? LIGHT_GREY : SAND) : specs[v];
    drawRock(ctx, rand, ax + p[0], ay + p[1], p[2], p[2] * 0.8, sp, { sides: 5, taper: 0.6, cracks: 0, speckle: 0, ao: 0.28, edge: 'rgba(30,24,16,0.35)' });
  }
  finish(S, 'rgba(34,28,18,0.5)', null);
  return toSprite(S, ax, ay);
}

export function buildDecor(kindIdx, variant) {
  switch (kindIdx) {
    case 0: return buildTuft(variant);
    case 1: return buildFlowers(variant);
    case 2: return buildRocks(variant);
    case 3: return buildMushrooms(variant);
    case 4: return buildFern(variant);
    case 5: return buildReeds(variant);
    case 6: return buildShrub(variant);
    case 7: return buildLog(variant);
    default: return buildPebbles(variant);
  }
}
