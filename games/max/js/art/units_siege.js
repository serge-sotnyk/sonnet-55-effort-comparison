// Siege machines built from beams, discs and capsules: rams, mangonel line, scorpions, trebuchet.
import {
  V, vadd, vsub, vmul, vmad, vdot, vlen, vnorm, vlerp, vcross, lerp, smooth, TAU, shadeHex, mixHex, makeXf, xfRoll, xfPitch, renderSprite, finish, clamp,
} from './units_core.js';

const PI = Math.PI;
const WOOD = '#a97a44', WOOD_D = '#6c4727', WOOD_L = '#c08e56', IRON = '#6d7681', STEEL = '#adb7c3', ROPE = '#c9b47c', STONE = '#8f8f8a', DARK = '#2a1b10';
const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// ------------------------------------------------------------------ transform helpers
function xfMul(A, B) {            // A applied after B
  if (!A) return B; if (!B) return A;
  const a = A.m, b = B.m;
  const m = [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
  const bt = B.t;
  const t = [a[0] * bt[0] + a[1] * bt[1] + a[2] * bt[2] + A.t[0], a[3] * bt[0] + a[4] * bt[1] + a[5] * bt[2] + A.t[1], a[6] * bt[0] + a[7] * bt[1] + a[8] * bt[2] + A.t[2]];
  return { m, t };
}
const xfT = (f, r, z) => ({ m: ID, t: [f, r, z] });

/** polygon with back-face culling for opaque panels */
function face(S, pts, col, n, o) {
  if (S.vis(n) <= 0.001) return null;
  return S.poly(pts, col, n, o);
}
function ropeLine(S, a, b, w, col, sag) {
  if (sag) { const m = vlerp(a, b, 0.5); m[2] -= sag; return S.line([a, m, b], w, col || '#4a3a22', { b: 0.05 }); }
  return S.line([a, b], w, col || '#4a3a22', { b: 0.05 });
}
function band(S, a, b, r, col, o) {          // short cylinder (iron band) around a log/beam
  return S.cap(a, b, r, r, col, Object.assign({ lv: [8, 5, 1] }, o || {}));
}
function flag(S, base, h, col, trim, wave, back, up) {
  const top = vmad(base, up, h);
  S.cap(base, top, 0.5, 0.4, '#5a3c20', { b: 0.02, lv: [6, 5, 3] });
  S.ball(top, 0.8, '#d8b04a', { b: 0.03, lv: [8, 5, 2] });
  const f0 = vmad(top, up, -1.0), f1 = vmad(top, up, -7.6);
  const t1 = vadd(vmad(f0, back, 8.5), vmul(up, wave)), t2 = vadd(vmad(f1, back, 7.0), vmul(up, wave * 0.5));
  S.poly([f0, t1, t2, f1], col, null, { lv: [7, 5, 3], b: 0.04 });
  if (trim) S.line([f0, t1, t2, f1, f0], 0.8, trim, { b: 0.05 });
}

// ------------------------------------------------------------------ RAM
function drawRam(S, tc, tier, st) {
  const woodD = WOOD_D;
  const iron = tier === 0 ? '#5d646e' : tier === 1 ? IRON : STEEL;
  const roofCol = tier === 2 ? '#7d6d5c' : '#8a5a30';
  const base = st.base || null;
  const zE = 17.0, zR = 28.5, hw = 9.6, f0 = -19.5, f1 = 19.5, lz = 9.4;
  // ---------------- chassis (beams, wheels, crew)
  S.xf = xfMul(base, st.xfC || null);
  for (const r of [-6.4, 6.4]) S.beam([-17.5, r, 6.4], [17.5, r, 6.4], 2.4, 2.4, WOOD_D, { b: 0.0 });
  for (const f of [-14, 0, 14]) S.beam([f, -6.4, 6.4], [f, 6.4, 6.4], 2.0, 2.2, WOOD_D, { b: 0.0 });
  for (const f of [-11.5, 11.5]) {
    S.cap([f, -9.0, 4.8], [f, 9.0, 4.8], 0.9, 0.9, '#3a2a1c', { b: 0.0, noEdge: true });
    for (const sd of [-1, 1]) S.wheel([f, sd * 8.6, 4.8], [0, sd, 0], 4.8, 1.7, st.rot, '#6a4a2a', '#8a6035', { spokes: 6, hub: iron, face: '#7a5630', inner: '#8a6a40', b: 0.0 });
  }
  // crew feet (alternating strides under the roof)
  for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {
    const ph = (st.walk + k * 0.5 + (sd > 0 ? 0.5 : 0)) % 1;
    const sw = st.moving ? Math.sin(ph * TAU) * 2.6 : 0, lift = st.moving ? Math.max(0, Math.cos(ph * TAU)) * 1.2 : 0;
    const f = -10.5 + k * 7.0;
    S.cap([f, sd * 3.2, 6.0], [f + sw, sd * 3.2, 1.5 + lift], 1.35, 1.15, '#4a4338', { b: -0.1 });
    S.cap([f + sw, sd * 3.2, 1.9 + lift], [f + sw + 2.0, sd * 3.2, 0.9 + lift], 1.3, 1.0, '#2e2218', { b: -0.1 });
  }
  // ---------------- log group (drawn before the roof: hangs below it)
  S.xf = xfMul(base, st.xfL || null);
  const lf = st.logF || 0;
  const a0 = [-17 + lf, 0, lz], a1 = [24 + lf, 0, lz];
  for (const c of [-6, 6]) for (const sd of [-1, 1]) S.line([[c, sd * 1.5, zR - 1.6], [c + lf, sd * 1.1, lz + 2.0]], 0.7, '#3a3f46', { b: 0.5 });
  S.cap(a0, a1, 2.5, 2.5, WOOD, { lv: [7, 5, 2], b: 0.2 });
  for (const f of [-9, 4]) band(S, [f + lf, 0, lz], [f + lf + 1.4, 0, lz], 2.75, iron, { b: 0.21 });
  const hf = 24 + lf;
  if (tier === 0) {
    S.revolve([hf - 3, 0, lz], [1, 0, 0], [0, 1, 0], [0, 0, 1], [[0, 2.7, 2.7], [2.5, 2.9, 2.9], [4.2, 2.3, 2.3], [5.2, 1.2, 1.2]], '#5d646e', { n: 12, lv: [8, 5, 1], d: S.dp(S.tv([hf, 0, lz])) + 0.25 });
  } else if (tier === 1) {
    S.revolve([hf - 5, 0, lz], [1, 0, 0], [0, 1, 0], [0, 0, 1], [[0, 2.8, 2.8], [4, 3.1, 3.1], [6.2, 2.8, 2.8], [7.4, 1.4, 1.4]], iron, { n: 12, lv: [8, 5, 1], d: S.dp(S.tv([hf, 0, lz])) + 0.25 });
    band(S, [hf - 3.2, 0, lz], [hf - 2.2, 0, lz], 3.3, '#8d97a3', { b: 0.28 });
  } else {
    S.revolve([hf - 6, 0, lz], [1, 0, 0], [0, 1, 0], [0, 0, 1], [[0, 3.0, 3.0], [4.5, 3.5, 3.5], [7.2, 3.2, 3.2], [8.8, 2.0, 2.0], [9.6, 0.8, 0.8]], STEEL, { n: 14, lv: [8, 5, 1], d: S.dp(S.tv([hf, 0, lz])) + 0.25 });
    for (const sd of [-1, 1]) S.cap([hf - 4, sd * 2.6, lz + 1.2], [hf + 0.5, sd * 4.4, lz + 4.4], 0.9, 0.3, '#c8d0da', { b: 0.3, lv: [8, 5, 2] });
    for (const f of [-12, -6, 0]) band(S, [f + lf, 0, lz], [f + lf + 1.6, 0, lz], 2.9, STEEL, { b: 0.22 });
  }
  // ---------------- roof group
  S.xf = xfMul(base, st.xfR || null);
  for (const f of [-14.5, 14.5]) for (const r of [-6.6, 6.6]) S.beam([f, r, 7.5], [f, r, zE + 0.6], 1.9, 1.9, WOOD_D, { b: 0.0 });
  const slope = (side) => {
    const pts = [[f0, side * hw, zE], [f1, side * hw, zE], [f1, 0, zR], [f0, 0, zR]];
    const n = vnorm([0, side * 0.78, 0.62]);
    if (S.vis(n) > 0.001) {
      S.poly(pts, roofCol, n, { lv: [7, 5, 3], b: 0.0 });
      const pl = [];
      for (let i = 1; i < 6; i++) { const t = i / 6; pl.push([[f0, side * lerp(hw, 0, t), lerp(zE, zR, t)], [f1, side * lerp(hw, 0, t), lerp(zE, zR, t)]]); }
      S.segs(pl, 0.7, 'rgba(40,22,10,0.55)', { b: 0.02 });
      if (tier >= 1) {
        const bands = [];
        for (const f of [-14, -5, 5, 14]) bands.push([[f, side * (hw + 0.2), zE + 0.1], [f, side * 0.4, zR + 0.1]]);
        S.segs(bands, 1.5, tier === 2 ? '#d0d8e2' : '#5f6874', { b: 0.03 });
      }
    }
    S.line([[f0, side * hw, zE], [f1, side * hw, zE]], 1.4, '#4a2f18', { b: 0.02 });
  };
  slope(-1); slope(1);
  S.beam([f0 - 1, 0, zR], [f1 + 1, 0, zR], 1.8, 1.8, woodD, { b: 0.03 });
  for (const e of [f1, f0]) {
    const n = [e > 0 ? 1 : -1, 0, 0];
    if (S.vis(n) > 0.0) S.poly([[e, -hw, zE], [e, hw, zE], [e, 0, zR]], '#1d130b', n, { solid: 'rgba(26,16,8,0.82)', noEdge: true, b: 0.0 });
    S.beam([e, -hw, zE], [e, 0, zR], 1.5, 1.5, WOOD_D, { b: 0.01 });
    S.beam([e, hw, zE], [e, 0, zR], 1.5, 1.5, WOOD_D, { b: 0.01 });
    S.beam([e, -hw, zE], [e, hw, zE], 1.6, 1.6, WOOD_D, { b: 0.01 });
  }
  // team cloth valance along the eaves + shields on the posts
  for (const sd of [-1, 1]) {
    const hem = [];
    const nn = 8;
    for (let i = 0; i <= nn; i++) hem.push([lerp(-18, 18, i / nn), sd * (hw + 0.7), zE - 4.2 - (i % 2 ? 1.0 : 0)]);
    const top = [[18, sd * (hw + 0.4), zE + 0.1], [-18, sd * (hw + 0.4), zE + 0.1]];
    S.poly(top.concat(hem.slice().reverse()), tc.main, vnorm([0, sd, 0.15]), { lv: [7, 5, 3], b: 0.3 });
    S.line(hem, 1.1, tc.light, { b: 0.32 });
    for (const f of [-9, 0, 9]) {
      S.disc([f, sd * (hw + 1.2), zE - 2.4], [0, sd, 0], [0, 0, 1], 2.7, 0.8, tc.main, '#5a4030', '#8a6038', { n: 12, inner: 0.78, innerCol: tc.light, innerLv: [6, 5, 3], b: 0.4 });
    }
  }
  if (tier === 2) flag(S, [f0 + 5, 0, zR], 13, tc.main, '#d8b04a', st.wave, [-1, 0, 0], [0, 0, 1]);
  S.xf = null;
}

// ------------------------------------------------------------------ MANGONEL / ONAGER
function drawMangonel(S, tc, tier, st) {
  const k = [1.12, 1.26, 1.4][tier];
  const q = (f, r, z) => [f * k, r * k, z * k];
  const base = st.base || null;
  S.xf = xfMul(base, st.xfC || null);
  const bw = 2.6 * k;
  const iron = tier === 0 ? null : IRON;
  // base beams
  for (const r of [-6.0, 6.0]) S.beam(q(-16.5, r, 5.6), q(16.5, r, 5.6), bw, bw, WOOD_D, { b: 0.0 });
  for (const f of [-14, -3, 12.5]) S.beam(q(f, -6.0, 5.6), q(f, 6.0, 5.6), 2.2 * k, 2.4 * k, WOOD_D, { b: 0.0 });
  for (const f of [-10.5, 10.5]) {
    S.cap(q(f, -8.6, 4.8), q(f, 8.6, 4.8), 0.9 * k, 0.9 * k, '#3a2a1c', { noEdge: true });
    for (const sd of [-1, 1]) S.wheel(q(f, sd * 8.9, 4.8), [0, sd, 0], 4.8 * k, 1.7 * k, st.rot, '#6a4a2a', '#8a6035', { spokes: 6, hub: '#4a4f58', face: '#7a5630', inner: '#8a6a40' });
  }
  // A-frame uprights
  const pivot = q(2.5, 0, 17.5);
  for (const sd of [-1, 1]) {
    S.beam(q(-3, sd * 6.0, 6.4), q(2.5, sd * 5.2, 17.5), 2.2 * k, 2.2 * k, WOOD, { b: 0.01 });
    S.beam(q(10, sd * 6.0, 6.4), q(2.5, sd * 5.2, 17.5), 2.2 * k, 2.2 * k, WOOD, { b: 0.01 });
    if (tier > 0) { S.cap(q(2.5, sd * 5.6, 17.0), q(2.5, sd * 5.6, 18.4), 2.0 * k, 2.0 * k, STEEL, { b: 0.04, lv: [8, 5, 1] }); }
  }
  S.beam(q(2.5, -5.4, 17.5), q(2.5, 5.4, 17.5), 2.2 * k, 2.2 * k, WOOD_D, { b: 0.02 });
  // skein (twisted rope bundle) around the axle
  S.cap(q(2.5, -4.2, 17.5), q(2.5, 4.2, 17.5), 2.3 * k, 2.3 * k, ROPE, { tex: 'weave', b: 0.03, lv: [7, 5, 3] });
  // front stop bar
  S.beam(q(9.5, -5.4, 12.0), q(9.5, 5.4, 12.0), 1.8 * k, 1.8 * k, WOOD_D, { b: 0.01 });
  // team apron hanging from the stop bar
  {
    const pts = [q(10.2, -5.6, 12.4), q(10.2, 5.6, 12.4), q(10.2, 5.0, 6.6), q(10.2, 2.5, 7.8), q(10.2, 0, 6.6), q(10.2, -2.5, 7.8), q(10.2, -5.0, 6.6)];
    if (S.vis([1, 0, 0]) > 0) S.poly(pts, tc.main, [1, 0, 0], { lv: [7, 5, 3], b: 0.2 });
    else S.poly(pts.map(p => [p[0] - 1.2 * k, p[1], p[2]]), tc.dark, [-1, 0, 0], { lv: [6, 4, 2], b: -0.2 });
  }
  // winch drum (rear)
  const dc = q(-11.5, 0, 9.0);
  S.cap([dc[0], -3.4 * k, dc[2]], [dc[0], 3.4 * k, dc[2]], 1.6 * k, 1.6 * k, WOOD_L, { b: 0.0, lv: [7, 5, 3] });
  for (const sd of [-1, 1]) {
    S.disc([dc[0], sd * 3.6 * k, dc[2]], [0, sd, 0], [0, 0, 1], 2.4 * k, 0.8 * k, '#5a5f68', '#4a4f58', '#4a4f58', { n: 10, b: 0.05 });
    S.cap([dc[0], sd * 4.3 * k, dc[2]], [dc[0] - 3.0 * k * Math.cos(st.rot), sd * 4.3 * k, dc[2] + 3.0 * k * Math.sin(st.rot)], 0.5 * k, 0.5 * k, '#3a2a1c', { b: 0.06, noEdge: true });
  }
  // ---------------- arm
  S.xf = xfMul(base, st.xfA || null);
  const al = st.alpha;
  const d = [Math.cos(al), 0, Math.sin(al)];
  const L1 = 22 * k, L2 = 5.5 * k;
  const tip = vmad(pivot, d, L1), tail = vmad(pivot, d, -L2);
  S.beam(tail, tip, 2.0 * k, 2.4 * k, WOOD, { up: [0, 1, 0], b: 0.1, lv: [7, 5, 2] });
  // shorter reinforcing plate
  S.beam(vmad(pivot, d, -L2), vmad(pivot, d, 6 * k), 2.3 * k, 2.8 * k, WOOD_D, { up: [0, 1, 0], b: 0.11 });
  if (tier > 0) { for (const t of [0.35, 0.62]) { const c = vmad(pivot, d, L1 * t); band(S, vmad(c, d, -0.5), vmad(c, d, 0.5), 1.6 * k, STEEL, { b: 0.14 }); } }
  // bucket
  const dn = [-Math.sin(al), 0, Math.cos(al)];
  const bc = vmad(tip, d, 0.6 * k);
  S.ell(vmad(bc, dn, 0.4), vmul(d, 2.6 * k), [0, 3.4 * k, 0], vmul(dn, 1.8 * k), '#5a3a1e', { b: 0.16, lv: [6, 4, 2] });
  S.ell(vmad(bc, dn, 1.0 * k), vmul(d, 2.3 * k), [0, 3.0 * k, 0], vmul(dn, 1.0 * k), '#3a2512', { b: 0.17, lv: [5, 3, 1] });
  if (st.stone) S.ball(vmad(vmad(bc, dn, 2.3 * k), d, 0), 2.7 * k, STONE, { b: 0.2, lv: [7, 5, 2] });
  // rope from the drum to the arm when cocked
  if (st.rope) S.line([vmad(tip, d, -1), [dc[0], 0, dc[2] + 1.0 * k]], 0.8, '#4a3822', { b: 0.15 });
  // flag at the rear
  S.xf = base;
  const fb = q(-14.5, -5.4, 6.0);
  flag(S, fb, (tier === 2 ? 22 : 18) * k, tc.main, tier > 0 ? '#d8b04a' : null, st.wave, [-1, 0, 0], [0, 0, 1]);
  S.xf = null;
}

// ------------------------------------------------------------------ SCORPION
function drawScorpion(S, tc, tier, st) {
  const k = tier === 0 ? 1.2 : 1.35;
  const q = (f, r, z) => [f * k, r * k, z * k];
  const base = st.base || null;
  S.xf = xfMul(base, st.xfC || null);
  // skids and wheels
  for (const r of [-4.6, 4.6]) S.beam(q(-13, r, 3.4), q(12, r, 3.4), 2.3 * k, 2.3 * k, WOOD_D, { b: 0.0 });
  for (const f of [-9, 6]) S.beam(q(f, -4.6, 3.4), q(f, 4.6, 3.4), 2.0 * k, 2.0 * k, WOOD_D, { b: 0.0 });
  S.cap(q(-8, -8.0, 4.2), q(-8, 8.0, 4.2), 0.9 * k, 0.9 * k, '#3a2a1c', { noEdge: true });
  for (const sd of [-1, 1]) S.wheel(q(-8, sd * 8.2, 4.2), [0, sd, 0], 4.2 * k, 1.6 * k, st.rot, '#6a4a2a', '#8a6035', { spokes: 6, hub: '#4a4f58', face: '#7a5630', inner: '#8a6a40' });
  // front legs
  for (const sd of [-1, 1]) S.beam(q(7, sd * 4.4, 3.8), q(5.5, sd * 1.6, 10.0), 1.9 * k, 1.9 * k, WOOD, { b: 0.01 });
  // rail
  const rz = 10.4;
  S.xf = xfMul(base, xfMul(st.xfC || null, st.xfS || null));
  S.beam(q(-14 + st.slide, 0, rz), q(14 + st.slide, 0, rz), 2.6 * k, 2.2 * k, WOOD, { b: 0.05, lv: [7, 5, 3] });
  S.beam(q(-14 + st.slide, 0, rz + 1.4), q(13 + st.slide, 0, rz + 1.4), 1.0 * k, 0.6 * k, WOOD_L, { b: 0.06 });
  // torsion housings (team colored cloth wrap) + limbs
  const bf = 9.5;
  for (const sd of [-1, 1]) {
    S.box(q(bf + st.slide, sd * 3.8, rz + 0.4), 1.7 * k, 1.5 * k, 2.2 * k, WOOD_D, { b: 0.08 });
    S.box(q(bf + 0.3 + st.slide, sd * 3.9, rz + 0.5), 1.8 * k, 1.6 * k, 1.1 * k, tc.main, { b: 0.09 });
    if (tier > 0) S.box(q(bf - 1.3 + st.slide, sd * 3.9, rz + 0.5), 0.5 * k, 1.7 * k, 2.4 * k, STEEL, { b: 0.1, lv: [8, 5, 1] });
  }
  const pull = st.pull;            // 1 = string drawn back, 0 = released
  const tipF = lerp(10.2, 5.6, pull), tipR = lerp(15.4, 15.8, pull);
  const limbPts = (sd) => {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const u = i / 5;
      pts.push(q(bf + 0.6 + st.slide - (bf + 0.6 - tipF) * u * u * 1.0 + 0.0, sd * (4.4 + (tipR - 4.4) * u), rz + 0.6 + u * 0.4));
    }
    return pts;
  };
  for (const sd of [-1, 1]) {
    const pts = limbPts(sd);
    for (let i = 0; i < 5; i++) S.cap(pts[i], pts[i + 1], (1.3 - i * 0.14) * k, (1.3 - (i + 1) * 0.14) * k, '#6a4426', { b: 0.12, lv: [6, 5, 2] });
    if (tier > 0) { band(S, vlerp(pts[0], pts[1], 0.3), vlerp(pts[0], pts[1], 0.7), 1.5 * k, STEEL, { b: 0.14 }); S.ball(pts[5], 0.8 * k, STEEL, { b: 0.14, lv: [8, 5, 1] }); }
  }
  // string and slider
  const sl = lerp(10.0, -8.5, pull) + st.slide;
  const tl = limbPts(-1)[5], tr = limbPts(1)[5];
  const sp = q(sl, 0, rz + 1.4);
  S.line([tl, sp, tr], 0.55, '#efe6cc', { b: 0.15 });
  S.box(q(sl, 0, rz + 1.2), 1.0 * k, 1.1 * k, 0.8 * k, '#4a4f58', { b: 0.14, lv: [7, 5, 2] });
  // bolt
  if (st.loaded) {
    const b0 = q(sl + 0.5, 0, rz + 2.4), b1 = q(sl + 18.0, 0, rz + 2.4);
    S.cap(b0, b1, 0.55 * k, 0.5 * k, '#cdb98a', { b: 0.17, noEdge: true });
    S.cap(vlerp(b1, b0, 0.06), vmad(b1, [1, 0, 0], 3.2 * k), 0.1, 0.9 * k, '#d4dce6', { b: 0.18, lv: [8, 5, 1], noEdge: true });
    S.cap(b0, vmad(b0, [1, 0, 0], 3.0 * k), 0.8 * k, 0.5 * k, '#e6e0d0', { b: 0.17, noEdge: true });
  }
  // windlass (rear crank)
  S.xf = base;
  const wc = q(-14.4, 0, rz + 0.2);
  S.cap([wc[0], -2.6 * k, wc[2]], [wc[0], 2.6 * k, wc[2]], 1.5 * k, 1.5 * k, WOOD_L, { b: 0.0, lv: [7, 5, 3] });
  S.cap([wc[0], 3.0 * k, wc[2]], [wc[0] - 2.4 * k * Math.cos(st.crank), 3.0 * k, wc[2] + 2.4 * k * Math.sin(st.crank)], 0.5 * k, 0.5 * k, '#3a2a1c', { b: 0.1, noEdge: true });
  // pennant
  flag(S, q(-12.5, -4.4, 4.8), (tier === 0 ? 14 : 17) * k, tc.main, tier > 0 ? '#d8b04a' : null, st.wave, [-1, 0, 0], [0, 0, 1]);
  S.xf = null;
}

// ------------------------------------------------------------------ TREBUCHET
function drawTrebuchetPacked(S, tc, st) {
  const base = st.base || null;
  S.xf = xfMul(base, st.xfC || null);
  // cart
  for (const r of [-6.5, 6.5]) S.beam([-24, r, 6.6], [22, r, 6.6], 2.6, 2.6, WOOD_D, { b: 0.0 });
  for (const f of [-21, -8, 6, 19]) S.beam([f, -6.5, 6.6], [f, 6.5, 6.6], 2.2, 2.4, WOOD_D, { b: 0.0 });
  for (const f of [-14, 13]) {
    S.cap([f, -9.4, 5.0], [f, 9.4, 5.0], 1.0, 1.0, '#3a2a1c', { noEdge: true });
    for (const sd of [-1, 1]) S.wheel([f, sd * 9.2, 5.0], [0, sd, 0], 5.0, 1.8, st.rot, '#6a4a2a', '#8a6035', { spokes: 8, hub: '#4a4f58', face: '#7a5630', inner: '#8a6a40' });
  }
  // lowered A-frame legs lying along the cart
  for (const sd of [-1, 1]) {
    S.beam([-6, sd * 5.4, 9.2], [22, sd * 4.8, 10.8], 2.5, 2.5, WOOD, { b: 0.02 });
    S.beam([-12, sd * 5.4, 9.2], [10, sd * 3.2, 15.2], 2.3, 2.3, WOOD, { b: 0.03 });
  }
  // stand for the axle
  S.beam([2, -5, 8], [2, -5, 16.5], 2.2, 2.2, WOOD_D, { b: 0.04 });
  S.beam([2, 5, 8], [2, 5, 16.5], 2.2, 2.2, WOOD_D, { b: 0.04 });
  S.beam([2, -5.6, 16.5], [2, 5.6, 16.5], 2.4, 2.4, WOOD_D, { b: 0.05 });
  // arm lying back, counterweight box on the front
  S.beam([-30, 0, 12.5], [11, 0, 17.0], 2.3, 2.7, WOOD, { up: [0, 1, 0], b: 0.1, lv: [7, 5, 2] });
  S.box([13, 0, 13.4], 5.2, 4.8, 4.4, STONE, { b: 0.12, lv: [7, 5, 2] });
  S.box([13, 0, 18.2], 5.6, 5.2, 0.9, tc.main, { b: 0.13 });
  S.box([13, 0, 11.2], 5.6, 5.2, 0.7, IRON, { b: 0.13 });
  // sling bundle at the tail
  S.ball([-30, 0, 12.0], 1.8, ROPE, { b: 0.12, tex: 'weave' });
  S.ball([-27, 0, 13.0], 2.4, STONE, { b: 0.12 });
  flag(S, [-20, 6.5, 8.2], 16, tc.main, '#d8b04a', st.wave, [-1, 0, 0], [0, 0, 1]);
  S.xf = null;
}
function drawTrebuchet(S, tc, st) {
  const base = st.base || null;
  S.xf = xfMul(base, st.xfC || null);
  // base frame
  for (const r of [-8.4, 8.4]) S.beam([-24, r, 3.2], [24, r, 3.2], 3.0, 3.0, WOOD_D, { b: 0.0 });
  for (const f of [-22, -9, 9, 22]) S.beam([f, -8.4, 3.2], [f, 8.4, 3.2], 2.6, 2.8, WOOD_D, { b: 0.0 });
  S.beam([-26, 0, 2.4], [26, 0, 2.4], 2.4, 2.4, WOOD_D, { b: -0.05 });
  // towers
  const pz = 50, piv = [0, 0, pz];
  for (const sd of [-1, 1]) {
    S.beam([-11, sd * 8.0, 4.4], [0, sd * 5.4, pz - 0.5], 2.9, 2.9, WOOD, { b: 0.02 });
    S.beam([11, sd * 8.0, 4.4], [0, sd * 5.4, pz - 0.5], 2.9, 2.9, WOOD, { b: 0.02 });
    S.beam([-8.5, sd * 7.5, 16], [8.5, sd * 7.5, 16], 2.0, 2.0, WOOD_D, { b: 0.03 });
    S.beam([-5.2, sd * 6.7, 30], [5.2, sd * 6.7, 30], 2.0, 2.0, WOOD_D, { b: 0.03 });
    S.cap([0, sd * 5.8, pz - 1.2], [0, sd * 5.8, pz + 1.4], 2.6, 2.6, STEEL, { b: 0.06, lv: [8, 5, 1] });
  }
  S.beam([0, -5.6, pz], [0, 5.6, pz], 2.8, 2.8, WOOD_D, { b: 0.05 });
  // team cloth hanging between the towers
  {
    const hem = [];
    for (let i = 0; i <= 6; i++) hem.push([9.2, lerp(-7.4, 7.4, i / 6), 9.0 + (i % 2 ? 1.4 : 0)]);
    S.poly([[9.2, -7.6, 17], [9.2, 7.6, 17]].concat(hem.slice().reverse()), tc.main, [1, 0, 0], { lv: [7, 5, 3], b: 0.3 });
    S.line(hem, 1.1, tc.light, { b: 0.32 });
  }
  // ---------------- arm
  S.xf = xfMul(base, st.xfA || null);
  const al = st.alpha;
  const d = [Math.cos(al), 0, Math.sin(al)];
  const L1 = 36, L2 = 11;
  const tip = vmad(piv, d, L1), tail = vmad(piv, d, -L2);
  S.beam(tail, tip, 2.1, 2.9, WOOD, { up: [0, 1, 0], b: 0.15, lv: [7, 5, 2] });
  for (const t of [0.3, 0.55, 0.8]) { const c = vmad(piv, d, L1 * t); band(S, vmad(c, d, -0.5), vmad(c, d, 0.5), 1.8, IRON, { b: 0.17 }); }
  band(S, vmad(tip, d, -1.0), vmad(tip, d, 0.2), 1.9, STEEL, { b: 0.17 });
  // counterweight (hanging, swings slightly)
  const cwp = vadd(tail, [st.cwSwing || 0, 0, -8.0]);
  S.line([tail, vadd(cwp, [-4.2, 0, 4.5]), cwp], 0.7, '#3a3f46', { b: 0.16 });
  S.line([tail, vadd(cwp, [4.2, 0, 4.5])], 0.7, '#3a3f46', { b: 0.16 });
  S.box(cwp, 5.4, 6.0, 4.8, STONE, { b: 0.18, lv: [7, 5, 2] });
  S.box(vadd(cwp, [0, 0, 5.1]), 5.8, 6.4, 0.7, tc.main, { b: 0.19 });
  S.box(vadd(cwp, [0, 0, -5.1]), 5.8, 6.4, 0.7, IRON, { b: 0.19 });
  // sling
  const pouch = st.pouch;
  if (pouch) {
    S.line([tip, pouch], 0.7, '#4a3822', { b: 0.14 });
    S.line([vadd(tip, [0, 1.2, 0]), vadd(pouch, [0, 1.0, 0])], 0.6, '#4a3822', { b: 0.14 });
    S.ell(pouch, [2.4, 0, 0], [0, 2.2, 0], [0, 0, 1.5], '#6a4a2a', { b: 0.15 });
    if (st.stone) S.ball(vadd(pouch, [0, 0, 2.2]), 3.0, STONE, { b: 0.2, lv: [7, 5, 2] });
  }
  S.xf = base;
  flag(S, [0, -5.4, pz + 1.5], 14, tc.main, '#d8b04a', st.wave, [-1, 0, 0], [0, 0, 1]);
  S.xf = null;
}

// ------------------------------------------------------------------ state + dispatch
const WHEEL_CYCLE = TAU;       // one wheel revolution per 8-frame walk cycle
export const SIEGE_INFO = {
  ram: { height: 32, cycle: 0.72 }, capped_ram: { height: 32, cycle: 0.72 }, siege_ram: { height: 40, cycle: 0.72 },
  mangonel: { height: 36, cycle: 0.72 }, onager: { height: 40, cycle: 0.8 }, siege_onager: { height: 46, cycle: 0.9 },
  scorpion: { height: 30, cycle: 0.7 }, heavy_scorpion: { height: 34, cycle: 0.8 }, trebuchet: { height: 52, cycle: 0.78 },
};
const KIND = { ram: ['ram', 0], capped_ram: ['ram', 1], siege_ram: ['ram', 2], mangonel: ['mangonel', 0], onager: ['mangonel', 1], siege_onager: ['mangonel', 2], scorpion: ['scorpion', 0], heavy_scorpion: ['scorpion', 1], trebuchet: ['trebuchet', 0] };
export const SIEGE_IDS = Object.keys(KIND);

export function genSiege(S, d, tc, dir, anim, frame, variant) {
  const [kind, tier] = KIND[d.id] || KIND.ram;
  S.begin(dir);
  const st = { rot: 0, walk: 0, moving: false, wave: 0.6, base: null, logF: 0, alpha: 2.0, stone: true, rope: false, pull: 1, loaded: true, slide: 0, crank: 0, pouch: null, cwSwing: 0 };
  const f8 = frame % 8;
  if (anim === 'walk') { st.rot = -f8 / 8 * WHEEL_CYCLE; st.walk = f8 / 8; st.moving = true; st.wave = 0.9 * Math.sin(f8 / 8 * TAU); st.crank = f8 / 8 * TAU; }
  const i = frame % 6;
  const dead = anim === 'death' || anim === 'corpse';
  const di = anim === 'corpse' ? 5 : i, t = di / 5;
  if (kind === 'ram') {
    if (anim === 'attack') { st.logF = [-4, -8, -10.5, 9, 4, 0][i]; st.base = xfT([0, 0, 0, 1.2, 0.5, 0][i], 0, 0); }
    if (anim === 'walk') { st.base = xfT(0, 0, 0.35 * Math.sin(f8 / 8 * TAU * 2)); st.logF = Math.sin(f8 / 8 * TAU) * 1.5; }
    if (dead) {
      st.xfC = makeXf([1, 0, 0, 0, Math.cos(0.18 * t), Math.sin(0.18 * t), 0, -Math.sin(0.18 * t), Math.cos(0.18 * t)], [0, 0, 0], [0, 0, -1.6 * t]);
      st.xfR = xfMul(xfT(-2.5 * t, 5 * t, -9.5 * t), xfRoll(0.95 * t, [0, 9, 14], [0, 0, 0]));
      st.xfL = xfMul(xfT(2 * t, -2 * t, -8.6 * t), xfPitch(-0.12 * t, [0, 0, 10], [0, 0, 0]));
      st.logF = 3 * t; st.moving = false;
    }
    drawRam(S, tc, tier, st);
  } else if (kind === 'mangonel') {
    if (anim === 'attack') { st.alpha = [2.0, 2.6, 3.3, 1.35, 0.35, 1.1][i]; st.stone = i < 3; st.rope = i === 2; st.base = xfT([0, 0, 0, 0, -0.6, -0.3][i], 0, 0); }
    if (anim === 'walk') { st.base = xfT(0, 0, 0.3 * Math.sin(f8 / 8 * TAU * 2)); }
    if (dead) {
      st.xfC = xfRoll(0.14 * t, [0, 0, 0], [0, 0, -1.5 * t]);
      st.xfA = xfMul(xfT(-3 * t, 3 * t, -11 * t), xfRoll(0.5 * t, [0, 0, 17], [0, 0, 0]));
      st.alpha = 2.0 - 1.4 * t; st.stone = false; st.rope = false;
    }
    drawMangonel(S, tc, tier, st);
  } else if (kind === 'scorpion') {
    st.pull = 1; st.loaded = true;
    if (anim === 'attack') { st.pull = [1, 1, 1, 0, 0, 0.45][i]; st.loaded = i < 3; st.slide = [0, 0, 0, 0, -1.3, -0.6][i]; st.crank = i >= 4 ? (i - 3) * 2 : 0; }
    if (anim === 'walk') { st.base = xfT(0, 0, 0.25 * Math.sin(f8 / 8 * TAU * 2)); }
    if (dead) {
      st.xfC = xfRoll(0.22 * t, [0, 0, 0], [0, 0, -1.2 * t]);
      st.xfS = xfMul(xfT(-2 * t, 2.5 * t, -4.5 * t), xfRoll(0.4 * t, [0, 0, 10], [0, 0, 0]));
      st.pull = 0.5 * (1 - t); st.loaded = false;
    }
    drawScorpion(S, tc, tier, st);
  } else if (kind === 'trebuchet') {
    if (anim === 'attack' || dead) {
      st.alpha = anim === 'attack' ? [4.0, 3.5, 2.4, 1.25, 0.1, -0.6][i] : 4.0 - 1.4 * t;
      if (anim === 'attack') {
        st.stone = i < 3; st.cwSwing = [0, 0.8, 1.2, 0.4, -0.8, -0.4][i];
        const tipdir = [Math.cos(st.alpha), 0, Math.sin(st.alpha)];
        const tip = [tipdir[0] * 36, 0, 50 + tipdir[2] * 36];
        const pp = [[-18, 0, 1.5], [-17, 0, 1.5], [-12, 0, 8], [10, 0, 78], [14, 0, 40], [6, 0, 18]][i];
        // sling pouch trails the tip
        st.pouch = [tip[0] + (i === 0 ? -22 : i === 1 ? -20 : i === 2 ? -11 : i === 3 ? 14 : i === 4 ? 8 : 0), 0, Math.max(1.5, tip[2] + (i === 0 ? 0 : i === 1 ? -4 : i === 2 ? -17 : i === 3 ? 14 : i === 4 ? -14 : -18))];
        if (i === 0) st.pouch = [tip[0] - 16, 0, Math.max(1.6, tip[2] - 1)];
        st.stone = i < 3;
      } else {
        st.xfC = xfRoll(0.25 * t, [0, 0, 0], [0, 0, -2 * t]);
        st.xfA = xfMul(xfT(-4 * t, 4 * t, -30 * t), xfRoll(0.55 * t, [0, 0, 50], [0, 0, 0]));
        st.pouch = null;
      }
      drawTrebuchet(S, tc, st);
    } else {
      if (anim === 'walk') st.base = xfT(0, 0, 0.3 * Math.sin(f8 / 8 * TAU * 2));
      drawTrebuchetPacked(S, tc, st);
    }
  }
  return finish(S);
}
