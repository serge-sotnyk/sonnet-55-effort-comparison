// Drawing primitives for the title-screen scene (trees, houses, castle, windmill, cloud sprites, grass). Build-time only.
// Light always comes from the LEFT (low golden sun): left faces are lit and warm, right faces are shaded and cool.
import { rng } from './common.js';
import { vnoise, fbm2 } from './menu_terrain.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mixf = (a, b, t) => a + (b - a) * t;
export function hexRgb(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mixc(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(mixf(A[0], B[0], t))},${Math.round(mixf(A[1], B[1], t))},${Math.round(mixf(A[2], B[2], t))})`;
}
export function rgbaOf(c, a) { const [r, g, b] = hexRgb(c); return `rgba(${r},${g},${b},${a})`; }

/** horizontal "lit left -> shaded right" gradient over [x0,x1] */
export function hgrad(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}
export function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}

// ------------------------------------------------------------------ trees
const TONES = [
  ['#c6dc78', '#6fa14c', '#2b5a3c'],   // lush
  ['#d4d884', '#8aa84a', '#40693a'],   // olive
  ['#8fb878', '#3f7a52', '#1c4338'],   // dark / conifer
  ['#f4c46a', '#d98a3a', '#7a4430'],   // autumn
];
export function oak(ctx, x, y, r, seed = 1, tone = 0, shadow = true) {
  const R = rng(seed * 7919 + 13), T = TONES[tone % TONES.length];
  if (shadow) { ctx.fillStyle = 'rgba(40,24,70,0.20)'; ctx.beginPath(); ctx.ellipse(x + r * 1.0, y + r * 0.06, r * 1.25, r * 0.22, 0, 0, 7); ctx.fill(); }
  const th = r * 1.1, tw = r * 0.2;
  ctx.fillStyle = hgrad(ctx, x - tw, x + tw, [[0, '#8a6a52'], [1, '#3a2a30']]);
  ctx.beginPath(); ctx.moveTo(x - tw, y); ctx.lineTo(x - tw * 0.6, y - th); ctx.lineTo(x + tw * 0.6, y - th); ctx.lineTo(x + tw, y); ctx.closePath(); ctx.fill();
  const cx = x, cy = y - th - r * 0.35;
  if (r < 7) {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx, cy, r * 1.1);
    g.addColorStop(0, T[0]); g.addColorStop(0.55, T[1]); g.addColorStop(1, T[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.95, r * 0.85, 0, 0, 7); ctx.fill();
    return;
  }
  const n = 8;
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6, d = r * (0.35 + R() * 0.35);
    blobs.push([cx + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.8, r * (0.42 + R() * 0.2)]);
  }
  blobs.push([cx, cy - r * 0.15, r * 0.62]);
  // dark underlayer first
  ctx.fillStyle = T[2];
  for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx + r * 0.05, by + r * 0.08, br, 0, 7); ctx.fill(); }
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [bx, by, br] of blobs) {
    const g = ctx.createRadialGradient(bx - br * 0.4, by - br * 0.45, 0, bx, by, br * 1.05);
    g.addColorStop(0, T[0]); g.addColorStop(0.5, T[1]); g.addColorStop(1, T[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
  }
  // sparkle of leaves
  ctx.fillStyle = 'rgba(255,240,170,0.35)';
  for (let i = 0; i < n; i++) { const a = R() * 6.28, d = R() * r * 0.8; ctx.beginPath(); ctx.arc(cx - r * 0.25 + Math.cos(a) * d, cy - r * 0.25 + Math.sin(a) * d * 0.7, Math.max(0.6, r * 0.07), 0, 7); ctx.fill(); }
}
export function pine(ctx, x, y, h, tone = 2, shadow = true) {
  const T = TONES[tone % TONES.length], w = h * 0.36;
  if (shadow) { ctx.fillStyle = 'rgba(40,24,70,0.20)'; ctx.beginPath(); ctx.ellipse(x + w * 1.0, y + 1, w * 1.1, h * 0.04, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#3a2a30'; ctx.fillRect(x - w * 0.08, y - h * 0.12, w * 0.16, h * 0.12);
  const tiers = h > 40 ? 5 : 3;
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers, yb = y - h * 0.1 - h * 0.88 * t0 * 0.92, ht = h * 0.88 / tiers * 1.55, ww = w * (1 - t0 * 0.7);
    const g = hgrad(ctx, x - ww, x + ww, [[0, T[0]], [0.45, T[1]], [1, T[2]]]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, yb - ht); ctx.lineTo(x + ww, yb); ctx.lineTo(x - ww, yb); ctx.closePath(); ctx.fill();
  }
}
export function poplar(ctx, x, y, h, tone = 1) {
  const T = TONES[tone % TONES.length], w = h * 0.16;
  ctx.fillStyle = 'rgba(40,24,70,0.2)'; ctx.beginPath(); ctx.ellipse(x + w * 1.4, y, w * 1.4, h * 0.03, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a2a30'; ctx.fillRect(x - w * 0.12, y - h * 0.15, w * 0.24, h * 0.15);
  ctx.fillStyle = hgrad(ctx, x - w, x + w, [[0, T[0]], [0.5, T[1]], [1, T[2]]]);
  ctx.beginPath(); ctx.ellipse(x, y - h * 0.58, w, h * 0.44, 0, 0, 7); ctx.fill();
}

/** large leafy tree silhouette (foreground): ragged canopy, warm rim light on the sun side */
export function oakSil(ctx, x, y, r, seed = 1, cols = ['#7a9a52', '#2f5a42', '#142e2c']) {
  const R = rng(seed * 313 + 17);
  const th = r * 0.95, tw = r * 0.17;
  // trunk with a root flare and two limbs
  ctx.fillStyle = hgrad(ctx, x - tw * 1.6, x + tw * 1.6, [[0, '#3c3238'], [0.5, '#1c1519'], [1, '#0a070c']]);
  ctx.beginPath(); ctx.moveTo(x - tw * 2.0, y + 2); ctx.quadraticCurveTo(x - tw * 0.8, y - th * 0.15, x - tw * 0.75, y - th * 0.5); ctx.quadraticCurveTo(x - tw * 0.7, y - th * 0.9, x - tw * 0.6, y - th);
  ctx.lineTo(x + tw * 0.6, y - th); ctx.quadraticCurveTo(x + tw * 0.7, y - th * 0.9, x + tw * 0.75, y - th * 0.5); ctx.quadraticCurveTo(x + tw * 0.8, y - th * 0.15, x + tw * 2.0, y + 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#1c1419'; ctx.lineCap = 'round';
  for (const k of [-1, 1]) { ctx.lineWidth = tw * 0.8; ctx.beginPath(); ctx.moveTo(x, y - th * 0.9); ctx.quadraticCurveTo(x + k * r * 0.25, y - th * 1.2, x + k * r * 0.62, y - th * 1.55); ctx.stroke(); }
  const cx = x, cy = y - th - r * 0.5;
  // dark mass
  const dark = ctx.createRadialGradient(cx - r * 0.5, cy - r * 0.7, r * 0.1, cx, cy, r * 1.7);
  dark.addColorStop(0, cols[1]); dark.addColorStop(1, cols[2]);
  ctx.fillStyle = dark;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + R() * 0.5, d = r * (0.25 + R() * 0.45);
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.8, r * (0.5 + R() * 0.3), r * (0.4 + R() * 0.25), R() * 3, 0, 7); ctx.fill();
  }
  // ragged edge: many small leaf clusters on the perimeter
  const edge = [];
  for (let i = 0; i < 130; i++) {
    const a = R() * Math.PI * 2, rad = 0.82 + R() * 0.32;
    const px = cx + Math.cos(a) * r * 1.3 * rad, py = cy + Math.sin(a) * r * 0.92 * rad - (Math.sin(a) < 0 ? r * 0.05 : 0);
    const br = r * (0.07 + R() * 0.12);
    edge.push([px, py, br, R() * 3]);
    ctx.beginPath(); ctx.ellipse(px, py, br * 1.3, br * 0.9, R() * 3, 0, 7); ctx.fill();
  }
  // warm sunlit leaves on the upper-left side
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 90; i++) {
    const a = Math.PI * (0.9 + R() * 0.75), rad = 0.45 + R() * 0.6;
    const px = cx + Math.cos(a) * r * 1.2 * rad, py = cy + Math.sin(a) * r * 0.85 * rad;
    const br = r * (0.04 + R() * 0.06), lit = 0.16 + R() * 0.26;
    const g = ctx.createRadialGradient(px - br * 0.3, py - br * 0.3, 0, px, py, br * 1.4);
    g.addColorStop(0, `rgba(255,214,120,${lit})`); g.addColorStop(0.6, `rgba(172,200,92,${lit * 0.45})`); g.addColorStop(1, 'rgba(120,160,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px, py, br * 1.4, br * 1.0, R() * 3, 0, 7); ctx.fill();
  }
  ctx.restore();
}
/** tall conifer silhouette with scalloped tiers (foreground) */
export function pineSil(ctx, x, y, h, w, seed = 1) {
  const R = rng(seed * 211 + 3), T = 7;
  ctx.fillStyle = '#1a1416'; ctx.fillRect(x - w * 0.06, y - h * 0.15, w * 0.12, h * 0.15);
  for (let i = 0; i < T; i++) {
    const t0 = i / T, yb = y - h * (0.1 + 0.8 * t0), tw = w * (1 - t0 * 0.78), th = h / T * 1.7;
    const pts = [[x, yb - th]];
    const n = 6;
    for (let k = 1; k <= n; k++) { const t = k / n; pts.push([x + tw * t * (0.85 + R() * 0.2), yb - th * (1 - t) + (k % 2 ? 2 : -1)]); }
    const m = 5; for (let k = 0; k <= m; k++) { const t = 1 - k / m; pts.push([x + tw * (2 * t - 1) * (0.95 + R() * 0.1) * (1 - 0 * k), yb + (k % 2 ? 0 : -th * 0.12)]); }
    for (let k = n; k >= 1; k--) { const t = k / n; pts.push([x - tw * t * (0.85 + R() * 0.2), yb - th * (1 - t) + (k % 2 ? 2 : -1)]); }
    ctx.beginPath(); pts.forEach(([px, py], j) => j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
    ctx.fillStyle = hgrad(ctx, x - tw, x + tw, [[0, '#4f7a58'], [0.3, '#244a40'], [1, '#0e2422']]); ctx.fill();
  }
}

/** lumpy rock outcrop (lit on the left), base centre (x,y); w,h in px; flip mirrors the lighting side */
export function crag(ctx, x, y, w, h, seed = 1) {
  const R = rng(seed * 733 + 11);
  const pts = [];
  const n = 11;
  pts.push([x - w * 0.5, y + h * 0.25]);
  for (let i = 1; i < n; i++) { const t = i / n, px = x - w * 0.5 + w * t, prof = Math.sin(Math.PI * t) ** 0.7; pts.push([px, y - h * prof * (0.55 + R() * 0.45)]); }
  pts.push([x + w * 0.5, y + h * 0.25]);
  ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.lineTo(x + w * 0.5, y + h * 0.5); ctx.lineTo(x - w * 0.5, y + h * 0.5); ctx.closePath();
  ctx.fillStyle = hgrad(ctx, x - w * 0.5, x + w * 0.5, [[0, '#e8c8a0'], [0.35, '#b09484'], [0.7, '#766a82'], [1, '#4a4262']]); ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 14; i++) {
    const fx = x - w * 0.5 + R() * w, fy = y - h * 0.9 + R() * h * 1.2, fw = w * (0.08 + R() * 0.16), fh = h * (0.14 + R() * 0.3);
    const litF = fx < x + (R() - 0.5) * w * 0.4;
    ctx.fillStyle = litF ? `rgba(255,226,176,${0.12 + R() * 0.16})` : `rgba(30,20,60,${0.12 + R() * 0.2})`;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + fw, fy + fh * 0.2); ctx.lineTo(fx + fw * 0.6, fy + fh); ctx.lineTo(fx - fw * 0.3, fy + fh * 0.7); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = vgrad(ctx, y - h, y + h * 0.5, [[0, 'rgba(255,230,180,0.12)'], [1, 'rgba(40,24,70,0.38)']]); ctx.fillRect(x - w * 0.5, y - h, w, h * 1.5);
  ctx.restore();
  // grass tufts hiding the base
  for (let i = 0; i < 9; i++) {
    const px = x - w * 0.5 + R() * w, py = y + h * (0.22 + R() * 0.16), tr = w * (0.025 + R() * 0.05);
    ctx.fillStyle = R() < 0.5 ? '#6f9a4e' : '#4b7a48'; ctx.beginPath(); ctx.ellipse(px, py, tr * 1.6, tr, 0, 0, 7); ctx.fill();
  }
}

// ------------------------------------------------------------------ houses
const ROOFS = [['#e8905a', '#a8483a'], ['#d9a070', '#8a5a48'], ['#8a9ac4', '#4a5278'], ['#e0b070', '#8a6a4a']];
/** small cottage seen from the front, (x,y) = ground centre; returns chimney anchor */
export function house(ctx, x, y, w, seed = 1, lit = true, glow = true) {
  const R = rng(seed * 131 + 7), roof = ROOFS[Math.floor(R() * ROOFS.length)];
  const hw = w * 0.5, wh = w * (0.42 + R() * 0.12), rh = w * (0.34 + R() * 0.14);
  ctx.fillStyle = 'rgba(40,24,70,0.22)'; ctx.beginPath(); ctx.ellipse(x + hw * 1.25, y + 0.5, hw * 1.15, w * 0.07, 0, 0, 7); ctx.fill();
  // walls: lit left half, shaded right half
  ctx.fillStyle = hgrad(ctx, x - hw, x + hw, [[0, '#fbe6c4'], [0.5, '#e8cba4'], [1, '#8f86a4']]);
  ctx.fillRect(x - hw, y - wh, w, wh);
  ctx.fillStyle = 'rgba(70,40,40,0.5)'; ctx.fillRect(x - hw, y - wh, w, Math.max(0.8, w * 0.03));     // timber beam
  // roof
  const ov = w * 0.07;
  ctx.fillStyle = roof[0];
  ctx.beginPath(); ctx.moveTo(x - hw - ov, y - wh); ctx.lineTo(x, y - wh - rh); ctx.lineTo(x, y - wh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = roof[1];
  ctx.beginPath(); ctx.moveTo(x + hw + ov, y - wh); ctx.lineTo(x, y - wh - rh); ctx.lineTo(x, y - wh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.35)'; ctx.beginPath(); ctx.moveTo(x - hw - ov, y - wh); ctx.lineTo(x, y - wh - rh); ctx.lineTo(x - hw * 0.15, y - wh - rh * 0.15); ctx.lineTo(x - hw - ov + 1.2, y - wh); ctx.closePath(); ctx.fill();
  // chimney
  const chx = x + hw * 0.45, chy = y - wh - rh * 0.55;
  ctx.fillStyle = '#7a6460'; ctx.fillRect(chx, chy - w * 0.16, w * 0.1, w * 0.2);
  // window + door
  if (w > 14) {
    ctx.fillStyle = 'rgba(255,200,90,0.95)'; ctx.fillRect(x - hw * 0.62, y - wh * 0.75, w * 0.14, w * 0.14);
    ctx.fillRect(x + hw * 0.32, y - wh * 0.75, w * 0.14, w * 0.14);
    ctx.fillStyle = '#4a2e2a'; ctx.fillRect(x - w * 0.07, y - wh * 0.62, w * 0.14, wh * 0.62);
    if (glow) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const gx of [x - hw * 0.62 + w * 0.07, x + hw * 0.32 + w * 0.07]) {
        const gy = y - wh * 0.75 + w * 0.07, gr = w * 0.5, g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = g; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
      }
      ctx.restore();
    }
  }
  return [chx + w * 0.05, chy - w * 0.16];
}
export function church(ctx, x, y, w) {
  const hw = w * 0.5;
  ctx.fillStyle = 'rgba(40,24,70,0.22)'; ctx.beginPath(); ctx.ellipse(x + hw * 1.3, y + 0.5, hw * 1.4, w * 0.07, 0, 0, 7); ctx.fill();
  ctx.fillStyle = hgrad(ctx, x - hw, x + hw, [[0, '#fdecd0'], [0.5, '#e8cfae'], [1, '#8f86a4']]);
  ctx.fillRect(x - hw, y - w * 0.7, w, w * 0.7);                                  // nave
  ctx.fillStyle = '#b05a48'; ctx.beginPath(); ctx.moveTo(x - hw - 2, y - w * 0.7); ctx.lineTo(x - hw * 0.1, y - w * 1.0); ctx.lineTo(x + hw + 2, y - w * 0.7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a3a3e'; ctx.beginPath(); ctx.moveTo(x + hw + 2, y - w * 0.7); ctx.lineTo(x - hw * 0.1, y - w * 1.0); ctx.lineTo(x + hw * 0.2, y - w * 0.7); ctx.closePath(); ctx.fill();
  // tower with spire
  const tx = x - hw * 0.55, tw = w * 0.22;
  ctx.fillStyle = hgrad(ctx, tx - tw, tx + tw, [[0, '#fdecd0'], [0.5, '#e0c8a8'], [1, '#8a82a0']]);
  ctx.fillRect(tx - tw, y - w * 1.25, tw * 2, w * 1.25);
  ctx.fillStyle = '#c2634a'; ctx.beginPath(); ctx.moveTo(tx - tw * 1.15, y - w * 1.25); ctx.lineTo(tx, y - w * 1.95); ctx.lineTo(tx + tw * 1.15, y - w * 1.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a3a3e'; ctx.beginPath(); ctx.moveTo(tx + tw * 1.15, y - w * 1.25); ctx.lineTo(tx, y - w * 1.95); ctx.lineTo(tx + tw * 0.1, y - w * 1.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,90,0.95)'; ctx.fillRect(tx - tw * 0.25, y - w * 0.95, tw * 0.5, tw * 0.9);
  ctx.fillRect(x + hw * 0.25, y - w * 0.5, w * 0.1, w * 0.22);
  ctx.fillStyle = '#ffd89a'; ctx.fillRect(tx - 0.5, y - w * 2.15, 1, w * 0.22);
}

// ------------------------------------------------------------------ windmill (static body; sails are drawn per frame by the scene)
export function windmillBody(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(40,24,70,0.22)'; ctx.beginPath(); ctx.ellipse(x + 20 * s, y + 1, 28 * s, 4 * s, 0, 0, 7); ctx.fill();
  const bw = 15 * s, tw = 9.5 * s, bh = 48 * s;
  ctx.fillStyle = hgrad(ctx, x - bw, x + bw, [[0, '#fff0d4'], [0.5, '#e8d0b0'], [1, '#8a82a2']]);
  ctx.beginPath(); ctx.moveTo(x - bw, y); ctx.lineTo(x - tw, y - bh); ctx.lineTo(x + tw, y - bh); ctx.lineTo(x + bw, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a3a38'; ctx.beginPath(); ctx.moveTo(x - tw - 2 * s, y - bh); ctx.lineTo(x, y - bh - 16 * s); ctx.lineTo(x + tw + 2 * s, y - bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a4a40'; ctx.beginPath(); ctx.moveTo(x - tw - 2 * s, y - bh); ctx.lineTo(x, y - bh - 16 * s); ctx.lineTo(x - tw * 0.1, y - bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a2e2a'; ctx.fillRect(x - 3 * s, y - 13 * s, 6 * s, 13 * s);
  ctx.fillStyle = 'rgba(255,200,90,0.9)'; ctx.fillRect(x - 2 * s, y - 32 * s, 4 * s, 5 * s);
  return [x, y - bh + 2 * s];   // hub anchor
}
export function drawSails(ctx, hx, hy, s, ang) {
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 2);
    ctx.fillStyle = '#5a3e36'; ctx.fillRect(-0.9 * s, -3 * s, 1.8 * s, -40 * s);
    ctx.fillStyle = 'rgba(244,226,190,0.88)'; ctx.fillRect(1.2 * s, -9 * s, 8 * s, -31 * s);
    ctx.fillStyle = 'rgba(80,50,40,0.5)';
    for (let k = 0; k < 5; k++) ctx.fillRect(1.2 * s, -9 * s - k * 6.2 * s, 8 * s, 0.7 * s);
    ctx.restore();
  }
  ctx.fillStyle = '#3a2a30'; ctx.beginPath(); ctx.arc(0, 0, 2.6 * s, 0, 7); ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ castle
function ashlar(ctx, x0, y0, x1, y1, bw, bh, seed, strength = 1) {
  const R = rng(seed * 71 + 5);
  let row = 0;
  for (let y = y0; y < y1; y += bh, row++) {
    for (let x = x0 - (row % 2) * bw / 2; x < x1; x += bw) {
      const xa = Math.max(x, x0), xb = Math.min(x + bw, x1);
      if (xb <= xa) continue;
      const v = R();
      ctx.fillStyle = v < 0.5 ? `rgba(60,40,80,${0.05 * strength * v * 2})` : `rgba(255,248,225,${0.07 * strength * (v - 0.5) * 2})`;
      ctx.fillRect(xa, y, xb - xa, Math.min(bh, y1 - y));
    }
    ctx.fillStyle = `rgba(70,50,90,${0.16 * strength})`; ctx.fillRect(x0, y, x1 - x0, Math.max(0.5, bh * 0.1));
  }
}
/**
 * Hilltop castle centred on (cx, by) (by = plateau ground level). Returns { flags: [[x,y,len,hue]...], torches: [[x,y]] }.
 * Width ~ 430*s, height ~ 280*s.
 */
export function castle(ctx, cx, by, s) {
  const X = x => cx + x * s, Y = y => by + y * s;
  const out = { flags: [], torches: [] };
  const cyl = (x0, x1) => hgrad(ctx, X(x0), X(x1), [[0, '#fff2d8'], [0.22, '#f2dab6'], [0.58, '#c4b0b6'], [1, '#7a7096']]);
  const flatS = (x0, x1) => hgrad(ctx, X(x0), X(x1), [[0, '#f8e4c4'], [0.5, '#e2caac'], [1, '#a698b2']]);
  const R = rng(99);
  // long cast shadow on the hill to the right
  ctx.fillStyle = 'rgba(50,30,90,0.20)';
  ctx.beginPath(); ctx.moveTo(X(150), Y(-4)); ctx.lineTo(X(360), Y(14)); ctx.lineTo(X(330), Y(46)); ctx.lineTo(X(120), Y(40)); ctx.closePath(); ctx.fill();
  // ---- foundation: a band of rough stone under the wall (ragged lower edge), crags at both ends
  const top = -22;
  {
    const pts = [];
    for (let x = -196; x <= 196; x += 12) pts.push([x, top + 14 + (vnoise(x * 0.09, 5) - 0.3) * 14]);
    ctx.beginPath(); ctx.moveTo(X(-196), Y(top - 6));
    pts.forEach(([x, y]) => ctx.lineTo(X(x), Y(y)));
    ctx.lineTo(X(196), Y(top - 6)); ctx.closePath();
    ctx.fillStyle = hgrad(ctx, X(-196), X(196), [[0, '#e6c8a0'], [0.35, '#b49a88'], [0.75, '#7a6e88'], [1, '#564e70']]); ctx.fill();
    ctx.save(); ctx.clip();
    ashlar(ctx, X(-196), Y(top - 6), X(196), Y(top + 30), 22 * s, 9 * s, 21, 1.4);
    ctx.fillStyle = vgrad(ctx, Y(top - 6), Y(top + 24), [[0, 'rgba(255,226,176,0.12)'], [1, 'rgba(40,24,70,0.30)']]); ctx.fillRect(X(-196), Y(top - 6), 392 * s, 40 * s);
    ctx.restore();
  }
  crag(ctx, X(-196), Y(8), 70 * s, 54 * s, 1);
  crag(ctx, X(198), Y(10), 64 * s, 46 * s, 2);
  crag(ctx, X(-110), Y(14), 60 * s, 22 * s, 3);
  crag(ctx, X(110), Y(14), 70 * s, 24 * s, 4);
  // ---- curtain wall
  const wallTop = -76, wallBot = -18;
  ctx.fillStyle = flatS(-176, 176); ctx.fillRect(X(-176), Y(wallTop), 352 * s, (wallBot - wallTop) * s);
  ashlar(ctx, X(-176), Y(wallTop), X(176), Y(wallBot), 15 * s, 7.5 * s, 1);
  ctx.fillStyle = 'rgba(255,246,224,0.6)'; ctx.fillRect(X(-176), Y(wallTop), 352 * s, 1.8 * s);
  ctx.fillStyle = vgrad(ctx, Y(wallBot - 14), Y(wallBot), [[0, 'rgba(40,24,70,0)'], [1, 'rgba(40,24,70,0.28)']]); ctx.fillRect(X(-176), Y(wallBot - 14), 352 * s, 14 * s);
  for (let x = -176; x < 170; x += 16) { ctx.fillStyle = flatS(-176, 176); ctx.fillRect(X(x), Y(wallTop - 10), 10 * s, 11 * s); ctx.fillStyle = 'rgba(255,246,224,0.5)'; ctx.fillRect(X(x), Y(wallTop - 10), 10 * s, 1.4 * s); ctx.fillStyle = 'rgba(60,40,90,0.18)'; ctx.fillRect(X(x + 7), Y(wallTop - 10), 3 * s, 11 * s); }
  ctx.fillStyle = 'rgba(20,10,30,0.6)'; for (let x = -158; x < 170; x += 40) ctx.fillRect(X(x), Y(-56), 2.4 * s, 10 * s);
  // ---- towers
  const REDR = ['#ef7a58', '#c8484a', '#7c2c3e'], BLUER = ['#9db4e0', '#6078b0', '#363f72'];
  const tower = (x, w, topY, roofH, rc, flag, seed) => {
    const x0 = x - w / 2, x1 = x + w / 2;
    ctx.fillStyle = cyl(x0, x1); ctx.fillRect(X(x0), Y(topY), w * s, (wallBot + 4 - topY) * s);
    ashlar(ctx, X(x0), Y(topY), X(x1), Y(wallBot), 9 * s, 7 * s, seed, 0.9);
    ctx.fillStyle = 'rgba(255,246,224,0.5)'; ctx.fillRect(X(x0), Y(topY), 1.6 * s, (wallBot - topY) * s);
    ctx.fillStyle = 'rgba(20,10,40,0.22)'; ctx.fillRect(X(x1 - w * 0.2), Y(topY), w * 0.2 * s, (wallBot - topY) * s);
    ctx.fillStyle = 'rgba(28,12,22,0.9)'; ctx.fillRect(X(x - 1.3), Y(topY + 16), 2.6 * s, 11 * s);
    ctx.fillStyle = 'rgba(255,190,80,0.95)'; ctx.fillRect(X(x - 1.3), Y(topY + 16), 2.6 * s, 4.5 * s);
    ctx.fillStyle = '#6a4a46'; ctx.fillRect(X(x0 - 3), Y(topY - 1), (w + 6) * s, 3 * s);
    if (roofH) {
      ctx.fillStyle = hgrad(ctx, X(x0 - 4), X(x1 + 4), [[0, rc[0]], [0.45, rc[1]], [1, rc[2]]]);
      ctx.beginPath(); ctx.moveTo(X(x0 - 4), Y(topY)); ctx.lineTo(X(x), Y(topY - roofH)); ctx.lineTo(X(x1 + 4), Y(topY)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,196,0.32)'; ctx.beginPath(); ctx.moveTo(X(x0 - 4), Y(topY)); ctx.lineTo(X(x), Y(topY - roofH)); ctx.lineTo(X(x - w * 0.12), Y(topY)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(60,20,30,0.25)'; ctx.lineWidth = Math.max(0.6, 0.7 * s);
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(X(x0 - 4 + k * 2), Y(topY - k * roofH / 4)); ctx.lineTo(X(x1 + 4 - k * 2), Y(topY - k * roofH / 4)); ctx.stroke(); }
      if (flag !== undefined) { ctx.fillStyle = '#4a3638'; ctx.fillRect(X(x - 0.6), Y(topY - roofH - 24), 1.3 * s, 26 * s); out.flags.push([X(x + 0.7), Y(topY - roofH - 23), 24 * s, flag]); }
    } else {
      for (let m = 0; m < Math.round(w / 10); m++) { ctx.fillStyle = cyl(x0, x1); ctx.fillRect(X(x0 + m * 10 + 0.4), Y(topY - 9), 6 * s, 10 * s); ctx.fillStyle = 'rgba(255,246,224,0.5)'; ctx.fillRect(X(x0 + m * 10 + 0.4), Y(topY - 9), 6 * s, 1.2 * s); }
    }
  };
  tower(-166, 38, -126, 44, REDR, 0, 1);
  tower(-108, 30, -108, 0, BLUER, undefined, 2);
  tower(-70, 26, -102, 32, BLUER, undefined, 3);
  tower(-28, 26, -106, 32, BLUER, undefined, 4);
  tower(104, 32, -118, 38, REDR, undefined, 5);
  tower(166, 40, -108, 40, BLUER, 1, 6);
  // gate between the gate towers
  ctx.fillStyle = flatS(-60, -38); ctx.fillRect(X(-58), Y(-66), 28 * s, 48 * s);
  ashlar(ctx, X(-58), Y(-66), X(-30), Y(-18), 9 * s, 7 * s, 8, 0.9);
  ctx.fillStyle = '#2a1a24'; ctx.beginPath(); ctx.moveTo(X(-53), Y(-18)); ctx.lineTo(X(-53), Y(-42)); ctx.quadraticCurveTo(X(-44), Y(-58), X(-35), Y(-42)); ctx.lineTo(X(-35), Y(-18)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(200,160,110,0.65)'; ctx.lineWidth = Math.max(0.7, 0.8 * s);
  for (let i = -50; i <= -38; i += 4) { ctx.beginPath(); ctx.moveTo(X(i), Y(-22)); ctx.lineTo(X(i), Y(-48)); ctx.stroke(); }
  out.torches.push([X(-56.5), Y(-38)], [X(-31.5), Y(-38)]);
  // ---- great keep behind (taller)
  const kx0 = -8, kx1 = 80, ktop = -208;
  ctx.fillStyle = flatS(kx0, kx1); ctx.fillRect(X(kx0), Y(ktop), (kx1 - kx0) * s, (wallTop + 6 - ktop) * s);
  ashlar(ctx, X(kx0), Y(ktop), X(kx1), Y(wallTop), 14 * s, 7.5 * s, 11, 1);
  ctx.fillStyle = 'rgba(255,246,224,0.55)'; ctx.fillRect(X(kx0), Y(ktop), 2 * s, (wallTop - ktop) * s);
  ctx.fillStyle = 'rgba(30,16,56,0.32)'; ctx.fillRect(X(kx1 - 18), Y(ktop), 18 * s, (wallTop - ktop) * s);
  for (let m = 0; m < 9; m++) { ctx.fillStyle = flatS(kx0, kx1); ctx.fillRect(X(kx0 + m * 10), Y(ktop - 11), 6.4 * s, 12 * s); ctx.fillStyle = 'rgba(255,246,224,0.5)'; ctx.fillRect(X(kx0 + m * 10), Y(ktop - 11), 6.4 * s, 1.3 * s); }
  const wins = [[10, -186, 1], [38, -186, 0], [66, -186, 1], [24, -156, 0], [52, -156, 1], [10, -126, 1], [38, -126, 1], [66, -126, 0], [24, -98, 1]];
  for (const [wx, wy, lit] of wins) {
    ctx.fillStyle = 'rgba(30,14,22,0.92)'; ctx.beginPath(); ctx.moveTo(X(wx - 3.4), Y(wy + 12)); ctx.lineTo(X(wx - 3.4), Y(wy + 3)); ctx.quadraticCurveTo(X(wx), Y(wy - 4), X(wx + 3.4), Y(wy + 3)); ctx.lineTo(X(wx + 3.4), Y(wy + 12)); ctx.closePath(); ctx.fill();
    if (lit) {
      ctx.fillStyle = 'rgba(255,192,84,0.96)'; ctx.beginPath(); ctx.moveTo(X(wx - 2.5), Y(wy + 11)); ctx.lineTo(X(wx - 2.5), Y(wy + 3.4)); ctx.quadraticCurveTo(X(wx), Y(wy - 2), X(wx + 2.5), Y(wy + 3.4)); ctx.lineTo(X(wx + 2.5), Y(wy + 11)); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(X(wx), Y(wy + 7), 0, X(wx), Y(wy + 7), 14 * s); gg.addColorStop(0, 'rgba(255,170,60,0.45)'); gg.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = gg; ctx.fillRect(X(wx - 14), Y(wy - 7), 28 * s, 28 * s); ctx.restore();
    }
  }
  // turrets on the keep
  tower(70, 24, -226, 42, REDR, 1, 12);
  tower(2, 20, -214, 0, BLUER, undefined, 13);
  ctx.fillStyle = '#4a3638'; ctx.fillRect(X(34), Y(-290), 1.5 * s, 82 * s);
  out.flags.push([X(35.5), Y(-289), 38 * s, 1]);
  ctx.fillStyle = '#4a3638'; ctx.fillRect(X(2), Y(-246), 1.3 * s, 36 * s);
  out.flags.push([X(3.3), Y(-245), 26 * s, 0]);
  // hall roof between gate and keep
  ctx.fillStyle = hgrad(ctx, X(-26), X(-6), [[0, '#e48a60'], [0.5, '#c0504c'], [1, '#7a3a44']]);
  ctx.beginPath(); ctx.moveTo(X(-30), Y(-104)); ctx.lineTo(X(-16), Y(-130)); ctx.lineTo(X(-2), Y(-104)); ctx.closePath(); ctx.fill();
  // base shade
  ctx.fillStyle = vgrad(ctx, Y(-24), Y(10), [[0, 'rgba(40,24,60,0)'], [1, 'rgba(40,24,60,0.30)']]); ctx.fillRect(X(-216), Y(-24), 432 * s, 34 * s);
  return out;
}

// ------------------------------------------------------------------ clouds
/** soft cloud sprite (device-pixel canvas of wc x hc CSS px at scale rs). style: 0 cumulus bank, 1 stratus streak */
export function cloudSprite(wc, hc, rs, seed, style = 0) {
  const R = rng(seed * 4099 + 5);
  const c = document.createElement('canvas'); c.width = Math.ceil(wc * rs); c.height = Math.ceil(hc * rs);
  const x = c.getContext('2d'); x.scale(rs, rs);
  if (style === 0) {
    const n = Math.ceil(wc / (hc * 0.16));
    for (let i = 0; i < n; i++) {
      const t = R(), bx = wc * (0.14 + 0.72 * t), prof = Math.pow(Math.sin(Math.PI * t), 0.9);
      const rad = hc * (0.12 + 0.2 * prof * (0.65 + 0.55 * R()));
      const by = clamp(hc * 0.70 - rad * 0.9 * prof * (0.3 + R() * 0.9), rad + hc * 0.04, hc * 0.86 - rad * 0.6);
      const g = x.createRadialGradient(bx, by, 0, bx, by, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(bx, by, rad * 1.35, rad, 0, 0, 7); x.fill();
    }
    // flatten the base
    x.globalCompositeOperation = 'destination-out';
    const fg = x.createLinearGradient(0, hc * 0.66, 0, hc * 0.9);
    fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = fg; x.fillRect(0, hc * 0.66, wc, hc * 0.34);
  } else {
    const n = Math.ceil(wc / (hc * 0.5));
    for (let i = 0; i < n; i++) {
      const t = (i + R() * 0.8) / n, bx = wc * (0.06 + 0.88 * t);
      const edge = Math.sin(Math.PI * t), rx = hc * (1.2 + 1.4 * R()) * (0.6 + 0.5 * edge), ry = hc * (0.16 + 0.12 * R()) * (0.5 + 0.7 * edge);
      const by = hc * (0.5 + (R() - 0.5) * 0.18);
      const g = x.createRadialGradient(bx, by, 0, bx, by, rx);
      g.addColorStop(0, `rgba(255,255,255,${0.55 * (0.4 + 0.6 * edge)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.save(); x.translate(bx, by); x.scale(1, ry / rx); x.translate(-bx, -by);
      x.fillStyle = g; x.beginPath(); x.arc(bx, by, rx, 0, 7); x.fill(); x.restore();
    }
  }
  // colourise: sun-lit gold on the left/top, coral middle, violet underside on the right/bottom
  x.globalCompositeOperation = 'source-atop';
  let g = x.createLinearGradient(0, 0, wc, hc);
  g.addColorStop(0, 'rgba(255,240,206,1)'); g.addColorStop(0.35, 'rgba(255,200,166,1)'); g.addColorStop(0.7, 'rgba(238,156,156,1)'); g.addColorStop(1, 'rgba(158,116,176,1)');
  x.fillStyle = g; x.fillRect(0, 0, wc, hc);
  g = x.createLinearGradient(0, 0, 0, hc);
  g.addColorStop(0, 'rgba(255,236,200,0)'); g.addColorStop(0.5, 'rgba(120,70,130,0)'); g.addColorStop(1, 'rgba(96,64,128,0.6)');
  x.fillStyle = g; x.fillRect(0, 0, wc, hc);
  return c;
}

/** tileable painterly blotch texture used as a source-atop overlay on hills (returns a canvas, device px = size*rs) */
export function blotchTexture(size, rs, seed, lightCol = '255,244,180', darkCol = '20,40,50') {
  const R = rng(seed * 61 + 1);
  const c = document.createElement('canvas'); c.width = c.height = Math.ceil(size * rs);
  const x = c.getContext('2d'); x.scale(rs, rs);
  for (let i = 0; i < size * size / 260; i++) {
    const bx = R() * size, by = R() * size, r = 5 + R() * 24, dark = R() < 0.5, a = 0.06 + R() * 0.14;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const px = bx + ox, py = by + oy; if (px < -r || px > size + r || py < -r || py > size + r) continue;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${dark ? darkCol : lightCol},${a})`); g.addColorStop(1, `rgba(${dark ? darkCol : lightCol},0)`);
      x.fillStyle = g; x.beginPath(); x.ellipse(px, py, r * 1.5, r * 0.8, 0.4, 0, 7); x.fill();
    }
  }
  return c;
}

/** a few thousand grass blades / flowers over a region (used for meadows and the foreground) */
export function grassStrokes(ctx, x0, y0, x1, y1, count, seed, bladeH, cols, ridge) {
  const R = rng(seed * 997 + 3);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = x0 + R() * (x1 - x0), yTop = ridge ? ridge(x) : y0, y = yTop + R() * (y1 - yTop);
    if (y < y0 || y > y1) continue;
    const h = bladeH * (0.5 + R()), lean = (R() - 0.35) * bladeH * 0.6;
    ctx.strokeStyle = cols[Math.floor(R() * cols.length)];
    ctx.lineWidth = Math.max(0.7, bladeH * 0.14 * (0.6 + R() * 0.8));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); ctx.stroke();
  }
}
