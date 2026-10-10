// Faceted rock / ore drawing used by the gold & stone mines, decor rocks and pebbles.
// A rock is an irregular prism: a ring of base points on the ground (iso-squashed ellipse) and a smaller, raised ring on top.
// Side faces are shaded by their facing direction (light from the upper-left), the top is fan-triangulated into facets.
import { TAU, clamp, lerp, ramp, polyPath, addDab } from './resources_util.js';

export const ROCK_STONE = { h0: 218, h1: 205, s0: 16, s1: 8, l0: 10, l1: 82 };
export const ROCK_STONE_WARM = { h0: 40, h1: 38, s0: 10, s1: 12, l0: 11, l1: 80 };
export const ROCK_GOLDMINE = { h0: 26, h1: 34, s0: 16, s1: 18, l0: 8, l1: 66 };
export const ROCK_DARK = { h0: 22, h1: 32, s0: 12, s1: 10, l0: 7, l1: 56 };
export const GOLD = { h0: 32, h1: 56, s0: 92, s1: 100, l0: 17, l1: 88 };

/**
 * Draw one faceted rock whose ground contact centre is (x, y).  rw = base half-width, rh = height.
 * o: sides, taper (top ring size relative to base), ox/oy (top offset), sq (ground ellipse squash), ao (contact shadow alpha),
 *    cracks (count), speckle (count), gold (nugget style: bright edges), glint (draw a specular star)
 * Returns { clip(ctx) } so callers can clip decorations (veins) to the rock.
 */
export function drawRock(ctx, rand, x, y, rw, rh, spec, o = {}) {
  const K = o.sides || 5 + ((rand() * 3) | 0);
  const sq = o.sq || 0.52;
  const taper = o.taper === undefined ? 0.5 : o.taper;
  const ox = (o.ox || 0) + (rand() - 0.5) * rw * 0.5, oy = o.oy || 0;
  const a0 = rand() * TAU;
  const B = [], M = [], T = [], A = [];
  for (let k = 0; k < K; k++) {
    const a = a0 + ((k + (rand() - 0.5) * 0.55) / K) * TAU;
    const rb = rw * (0.8 + rand() * 0.34);
    const rt = rb * taper * (0.6 + rand() * 0.8);
    const hk = rh * (0.72 + rand() * 0.42);
    const tm = 0.5 + rand() * 0.14;                      // where the chamfer ring sits (fraction of the height)
    const rm = lerp(rb, rt, tm) * (0.94 + rand() * 0.2);
    A.push(a);
    B.push([x + Math.cos(a) * rb, y + Math.sin(a) * rb * sq]);
    M.push([x + ox * tm + Math.cos(a) * rm, y + oy * tm + Math.sin(a) * rm * sq - hk * tm * (0.92 + rand() * 0.16)]);
    T.push([x + ox + Math.cos(a) * rt, y + oy + Math.sin(a) * rt * sq - hk]);
  }
  if (o.ao !== 0) {                                   // contact shadow / AO on the ground
    ctx.save();
    ctx.translate(x + rw * 0.18, y + 0.8);
    ctx.scale(1, 0.46);
    const g = ctx.createRadialGradient(0, 0, rw * 0.25, 0, 0, rw * 1.3);
    g.addColorStop(0, 'rgba(8,10,6,' + (o.ao || 0.42) + ')'); g.addColorStop(1, 'rgba(8,10,6,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rw * 1.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // faces (lower band B-M and upper band M-T), sorted back to front
  const faces = [];
  for (let k = 0; k < K; k++) {
    const j = (k + 1) % K;
    let aj = A[j]; if (j === 0) aj += TAU;
    const m = (A[k] + aj) / 2;
    faces.push({ pts: [B[k], B[j], M[j], M[k]], m, d: Math.sin(m), up: 0, k, j });
    faces.push({ pts: [M[k], M[j], T[j], T[k]], m, d: Math.sin(m) + 0.001, up: 1, k, j });
  }
  faces.sort((p, q) => p.d - q.d);
  const lit = (m, up) => {
    const c = up ? 0.72 : 0.9, s = up ? 0.69 : 0.44;     // the upper band leans more toward the sky
    const lam = 0.7 * s + c * (-0.58 * Math.cos(m) - 0.42 * Math.sin(m));
    return clamp(0.2 + 0.7 * lam, 0.04, 0.92);
  };
  const edge = o.edge || 'rgba(14,10,8,0.5)';
  for (const f of faces) {
    const tl = lit(f.m, f.up) + (rand() - 0.5) * 0.05;
    const p = f.pts;
    polyPath(ctx, p);
    ctx.fillStyle = ramp(spec, tl);                       // flat facet colour (an AO gradient over the whole rock follows)
    ctx.fill();
    if (rw >= 5.5 && rand() < 0.55) {                               // a chip / crease inside the face
      const u = 0.2 + rand() * 0.45, v = 0.25 + rand() * 0.4;
      const a_ = [lerp(p[3][0], p[2][0], u), lerp(p[3][1], p[2][1], u)];
      const b_ = [lerp(p[0][0], p[1][0], u + 0.2), lerp(p[0][1], p[1][1], u + 0.2)];
      const c_ = [lerp(p[3][0], p[2][0], u + 0.32), lerp(p[3][1], p[2][1], u + 0.32)];
      polyPath(ctx, [a_, [lerp(a_[0], b_[0], v + 0.3), lerp(a_[1], b_[1], v + 0.3)], c_]);
      ctx.fillStyle = ramp(spec, tl + (rand() < 0.5 ? 0.12 : -0.1), 0.5); ctx.fill();
    }
    ctx.lineWidth = 0.7; ctx.strokeStyle = edge;
    polyPath(ctx, p); ctx.stroke();
  }
  // top: fan triangles from a centroid, each lit by its direction
  let cx = 0, cy = 0;
  for (const p of T) { cx += p[0]; cy += p[1]; }
  cx = cx / K + (rand() - 0.5) * rw * 0.16; cy = cy / K - rh * 0.06;
  for (let k = 0; k < K; k++) {
    const j = (k + 1) % K;
    const mx = (T[k][0] + T[j][0]) / 2 - cx, my = (T[k][1] + T[j][1]) / 2 - cy;
    const l = Math.hypot(mx, my) || 1;
    const dot = (-0.7 * mx - 0.7 * my) / l;               // facing the upper-left light
    const tl = clamp(0.8 + 0.16 * dot + (rand() - 0.5) * 0.07, 0.5, 0.97);
    polyPath(ctx, [[cx, cy], T[k], T[j]]);
    ctx.fillStyle = ramp(spec, tl); ctx.fill();
    ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(20,14,10,0.18)'; ctx.stroke();
  }
  // lit rim on the upper-left edges of the top ring
  ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  for (let k = 0; k < K; k++) {
    const j = (k + 1) % K;
    const mx = (T[k][0] + T[j][0]) / 2 - cx, my = (T[k][1] + T[j][1]) / 2 - cy;
    const l = Math.hypot(mx, my) || 1, dot = (-0.7 * mx - 0.7 * my) / l;
    if (dot > 0.1) {
      ctx.strokeStyle = ramp(spec, 0.97, 0.45 + 0.4 * dot);
      ctx.beginPath(); ctx.moveTo(T[k][0], T[k][1]); ctx.lineTo(T[j][0], T[j][1]); ctx.stroke();
    }
  }
  const clip = (c) => {
    c.beginPath();
    for (const f of faces) {
      const p = f.pts;
      c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.lineTo(p[2][0], p[2][1]); c.lineTo(p[3][0], p[3][1]); c.closePath();
    }
    c.moveTo(T[0][0], T[0][1]);
    for (let k = 1; k < K; k++) c.lineTo(T[k][0], T[k][1]);
    c.closePath();
  };
  // cracks, speckles and a vertical AO gradient over the whole rock (dark toward the ground, light toward the top)
  ctx.save();
  clip(ctx); ctx.clip();
  {
    let yTop = 1e9, yBot = -1e9;
    for (let k = 0; k < K; k++) { if (T[k][1] < yTop) yTop = T[k][1]; if (B[k][1] > yBot) yBot = B[k][1]; }
    const ag = ctx.createLinearGradient(0, yTop, 0, yBot);
    ag.addColorStop(0, 'rgba(255,246,225,0.1)'); ag.addColorStop(0.45, 'rgba(0,0,0,0)'); ag.addColorStop(1, 'rgba(6,6,14,0.32)');
    ctx.fillStyle = ag; ctx.fillRect(x - rw * 1.6, yTop - 1, rw * 3.2, yBot - yTop + 2);
  }
  const nC = o.cracks === undefined ? 1 : o.cracks;
  for (let c = 0; c < nC; c++) {
    const k0 = faces[faces.length - 1 - ((rand() * Math.min(4, K)) | 0)];
    const p2 = T[k0.j], p3 = T[k0.k];
    let px = lerp(p3[0], p2[0], 0.25 + rand() * 0.5), py = lerp(p3[1], p2[1], 0.25 + rand() * 0.5);
    const pts = [[px, py]];
    const len = rh * (0.4 + rand() * 0.4), n = 3;
    for (let s = 0; s < n; s++) { px += (rand() - 0.5) * rw * 0.35; py += len / n; pts.push([px, py]); }
    ctx.strokeStyle = 'rgba(10,8,6,0.6)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    ctx.strokeStyle = ramp(spec, 0.8, 0.35); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(pts[0][0] - 0.8, pts[0][1] + 0.3); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] - 0.8, pts[i][1] + 0.3); ctx.stroke();
  }
  const nS = o.speckle === undefined ? Math.round(rw * 0.6) : o.speckle;
  ctx.fillStyle = ramp(spec, 0.2, 0.4);
  ctx.beginPath();
  for (let i = 0; i < nS; i++) addDab(ctx, x + (rand() - 0.5) * rw * 1.6, y - rh * rand() * 0.9, 0.5 + rand() * 0.5, 0.4 + rand() * 0.3, rand() * 3);
  ctx.fill();
  ctx.fillStyle = ramp(spec, 0.92, 0.4);
  ctx.beginPath();
  for (let i = 0; i < nS; i++) addDab(ctx, x - rw * 0.3 + (rand() - 0.5) * rw * 1.1, y - rh * (0.3 + rand() * 0.7), 0.5 + rand() * 0.5, 0.4 + rand() * 0.3, rand() * 3);
  ctx.fill();
  ctx.restore();
  if (o.glint) sparkle(ctx, T[0][0] * 0.5 + cx * 0.5 - rw * 0.15, cy - rh * 0.05, o.glint);
  return { clip, B, T, cx, cy };
}

/** 4-point specular star (gold glints). */
export function sparkle(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,235,0.95)';
  ctx.beginPath();
  ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.22, y - s * 0.22); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.22, y + s * 0.22);
  ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.22, y + s * 0.22); ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.22, y - s * 0.22);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
