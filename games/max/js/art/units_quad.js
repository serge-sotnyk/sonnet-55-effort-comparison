// Generic quadruped rig: horses, camels, deer, boar, sheep, wolves. Body/neck/head are surfaces of revolution, legs are 2-bone IK chains.
import {
  V, vadd, vsub, vmul, vmad, vdot, vlen, vnorm, vlerp, vcross, ik2, clamp, lerp, smooth, TAU, shadeHex, mixHex, ramp,
} from './units_core.js';

const PI = Math.PI;

// ------------------------------------------------------------------ species tables (dimensions in rig units, scale 1)
// legs: hip is [f, r, z] relative to the body centre (r > 0 = right side); ankle target height = fetlock height
export const SPECIES = {
  horse: {
    z0: 17.6, ankleZ: 2.9,
    body: [[-13.8, 2.6, 4.4], [-12, 4.0, 6.0], [-6, 4.2, 6.5], [1, 4.1, 6.6], [8, 4.0, 6.9], [12, 3.4, 6.1], [14.4, 2.1, 4.7]],
    legF: { hip: [8.8, 2.9, -2.6], l1: 6.5, l2: 6.3, r: [2.2, 1.7, 1.25], hoof: 1.7 },
    legH: { hip: [-10.4, 3.1, -1.0], l1: 7.2, l2: 6.7, r: [2.7, 1.75, 1.25], hoof: 1.7 },
    neck: { base: [10.0, 0, 3.6], ang: 50, len: 13.0, rings: [[0, 3.4, 5.4], [6, 2.7, 4.0], [13, 2.2, 2.9]] },
    head: { ang: -56, len: 10.8, rings: [[0, 2.5, 3.2], [3.2, 2.35, 3.0], [7.2, 1.65, 2.0], [10.8, 1.55, 1.5]], ears: 'pointed', earAt: 0.3 },
    tail: { root: [-13.3, 0, 3.8], segs: 3, len: 4.4, r0: 1.0 },
    maneLen: 13.4, gait: 'trot', stride: 15, lift: 4.0, bob: 0.9,
  },
  camel: {
    z0: 23.4, ankleZ: 3.0,
    body: [[-12, 2.6, 5.2], [-10.5, 4.2, 6.6], [-4, 4.6, 7.4], [3, 4.4, 7.6], [8.5, 4.2, 7.7], [11.5, 3.4, 6.4], [13.2, 2.1, 4.8]],
    legF: { hip: [8.0, 3.0, -3.5], l1: 9.0, l2: 9.1, r: [2.1, 1.35, 1.05], hoof: 1.6, knee: 1.8 },
    legH: { hip: [-9.5, 3.2, -3.0], l1: 9.5, l2: 9.4, r: [2.5, 1.4, 1.05], hoof: 1.6, knee: 1.8 },
    neck: { base: [10.6, 0, 3.0], segs: [{ ang: 78, len: 9, rings: [[0, 2.8, 4.0], [4.5, 2.0, 2.8], [9, 1.7, 2.1]] }, { ang: 20, len: 9, rings: [[0, 1.7, 2.1], [4.5, 1.5, 1.8], [9, 1.4, 1.6]] }], rings: [[0, 3.0, 4.4], [7, 2.0, 2.4]] },
    head: { ang: -42, len: 7.6, rings: [[0, 1.65, 1.95], [2.2, 1.6, 1.85], [5.2, 1.2, 1.3], [7.6, 1.3, 1.1]], ears: 'round', earAt: 0.2 },
    tail: { root: [-12.2, 0, 3.4], segs: 2, len: 3.0, r0: 0.8 },
    hump: { at: 1.0, r: [4.8, 3.6, 6.0], z: 7.0 },
    maneLen: 0, gait: 'pace', stride: 17, lift: 4.2, bob: 0.8,
  },
  deer: {
    z0: 11.6, ankleZ: 1.7,
    body: [[-8.2, 1.9, 2.9], [-6.6, 2.6, 3.8], [-2, 2.7, 4.0], [3, 2.6, 4.1], [6.6, 2.4, 3.9], [8.6, 1.7, 3.0]],
    legF: { hip: [5.6, 1.6, -1.8], l1: 4.8, l2: 4.5, r: [1.25, 0.85, 0.65], hoof: 1.1 },
    legH: { hip: [-6.1, 1.7, -1.2], l1: 5.2, l2: 4.8, r: [1.5, 0.9, 0.65], hoof: 1.1 },
    neck: { base: [6.6, 0, 1.8], ang: 56, len: 7.6, rings: [[0, 1.9, 2.5], [4, 1.35, 1.8], [7.6, 1.05, 1.35]] },
    head: { ang: -38, len: 6.0, rings: [[0, 1.45, 1.7], [2.2, 1.3, 1.55], [5, 0.8, 0.95], [6.0, 0.8, 0.8]], ears: 'big', earAt: 0.25 },
    tail: { root: [-8.4, 0, 2.2], segs: 1, len: 2.0, r0: 0.9 },
    maneLen: 0, gait: 'bound', stride: 10, lift: 3.5, bob: 1.0,
  },
  boar: {
    z0: 8.4, ankleZ: 1.3,
    body: [[-7.6, 2.1, 3.3], [-6.2, 3.1, 4.5], [-1, 3.5, 5.0], [4, 3.4, 5.0], [7, 2.9, 4.4], [8.6, 2.0, 3.1]],
    legF: { hip: [5.2, 2.2, -2.2], l1: 3.4, l2: 3.2, r: [1.5, 1.05, 0.85], hoof: 1.0 },
    legH: { hip: [-5.2, 2.3, -1.8], l1: 3.6, l2: 3.3, r: [1.8, 1.1, 0.85], hoof: 1.0 },
    neck: { base: [7.0, 0, 0.8], ang: 12, len: 3.2, rings: [[0, 3.0, 3.8], [1.6, 2.7, 3.3], [3.2, 2.5, 2.9]] },
    head: { ang: -22, len: 8.2, rings: [[0, 2.5, 3.0], [2.5, 2.3, 2.7], [6, 1.25, 1.35], [8.2, 1.35, 1.2]], ears: 'small', earAt: 0.18 },
    tail: { root: [-7.6, 0, 2.2], segs: 2, len: 1.5, r0: 0.5 },
    maneLen: 0, gait: 'trot', stride: 7, lift: 2.2, bob: 0.5,
  },
  sheep: {
    z0: 8.6, ankleZ: 1.2,
    body: [[-5.6, 3.0, 3.6], [-4, 4.0, 4.6], [0, 4.3, 4.9], [4, 4.0, 4.6], [5.8, 3.2, 3.8]],
    legF: { hip: [3.6, 2.0, -2.8], l1: 3.8, l2: 3.6, r: [0.95, 0.7, 0.6], hoof: 1.0 },
    legH: { hip: [-3.8, 2.1, -2.6], l1: 3.9, l2: 3.7, r: [1.0, 0.7, 0.6], hoof: 1.0 },
    neck: { base: [5.2, 0, 1.2], ang: 40, len: 3.8, rings: [[0, 2.2, 2.7], [1.8, 1.7, 2.1], [3.8, 1.4, 1.7]] },
    head: { ang: -40, len: 4.8, rings: [[0, 1.5, 1.8], [1.6, 1.4, 1.7], [3.8, 0.9, 1.05], [4.8, 0.85, 0.85]], ears: 'small', earAt: 0.2 },
    tail: { root: [-5.6, 0, 2.4], segs: 1, len: 1.8, r0: 1.0 },
    maneLen: 0, gait: 'walk4', stride: 5, lift: 1.8, bob: 0.3,
  },
  wolf: {
    z0: 10.6, ankleZ: 1.6,
    body: [[-7.6, 1.8, 3.0], [-6.2, 2.5, 3.9], [-1.5, 2.6, 4.1], [3.5, 2.6, 4.2], [6.4, 2.4, 4.0], [8.2, 1.7, 3.0]],
    legF: { hip: [5.2, 1.6, -1.8], l1: 4.5, l2: 4.4, r: [1.3, 0.9, 0.7], hoof: 1.1 },
    legH: { hip: [-5.8, 1.7, -1.4], l1: 5.0, l2: 4.6, r: [1.6, 0.95, 0.7], hoof: 1.1 },
    neck: { base: [6.4, 0, 1.6], ang: 28, len: 5.2, rings: [[0, 2.5, 3.1], [2.6, 2.1, 2.6], [5.2, 1.9, 2.2]] },
    head: { ang: -24, len: 7.4, rings: [[0, 1.85, 2.2], [2.4, 1.7, 2.0], [5.4, 0.95, 1.1], [7.4, 0.9, 0.85]], ears: 'pointed', earAt: 0.22 },
    tail: { root: [-7.8, 0, 2.6], segs: 3, len: 3.0, r0: 1.4 },
    maneLen: 0, gait: 'trot', stride: 10, lift: 3.0, bob: 0.5,
  },
};

// ------------------------------------------------------------------ gaits
function legCycle(ph, stride, lift, stance) {
  ph = ph - Math.floor(ph);
  if (ph < stance) { const u = ph / stance; return [stride * (0.5 - u), 0]; }
  const u = (ph - stance) / (1 - stance);
  return [stride * (-0.5 + smooth(u)), lift * Math.sin(PI * u)];
}
// leg order: RF, LF, RH, LH
const PHASE = {
  trot: [0, 0.5, 0.5, 0],
  pace: [0, 0.5, 0, 0.5],
  walk4: [0, 0.5, 0.25, 0.75],
  bound: [0, 0.07, 0.42, 0.5],
};

/** pose for a species: returns { bz, bf, pitch, roll, legs:[{f,z}x4], neck, head, tail, mouth, fall } */
export function quadPose(sp, gait, anim, frame, o = {}) {
  const S = SPECIES[sp];
  const P = { bz: S.z0, bf: 0, pitch: 0, roll: 0, legs: [{ f: 0, z: 0 }, { f: 0, z: 0 }, { f: 0, z: 0 }, { f: 0, z: 0 }], neck: 0, head: 0, headYaw: 0, tail: 0, mouth: 0, fall: 0, extra: 0 };
  const stance = o.stance || 0.52;
  if (anim === 'walk') {
    const t = frame / 8, ang = TAU * t;
    const stride = o.stride || S.stride, lift = o.lift || S.lift, bob = o.bob === undefined ? S.bob : o.bob;
    const ph = PHASE[o.gait || S.gait];
    for (let i = 0; i < 4; i++) { const [f, l] = legCycle(t + ph[i], stride, lift, stance); P.legs[i].f = f; P.legs[i].z = l; }
    if ((o.gait || S.gait) === 'bound') {
      P.bz += 2.2 * Math.sin(PI * ((t * 1.0) % 1)) - 1.0; P.pitch = 0.16 * Math.cos(ang - 0.6);
      P.neck = 0.1 * Math.cos(ang - 1.0); P.head = 0.1 * Math.cos(ang - 1.6);
    } else {
      P.bz += bob * Math.cos(2 * ang - 0.5); P.pitch = 0.025 * Math.sin(2 * ang);
      P.roll = (o.gait || S.gait) === 'pace' ? 0.05 * Math.sin(ang) : 0;
      P.neck = 0.05 * Math.cos(2 * ang - 1.0) + (o.gait === 'pace' || S.gait === 'pace' ? 0.08 * Math.sin(ang) : 0);
      P.head = -0.06 * Math.cos(2 * ang - 1.0);
    }
    P.tail = Math.sin(ang - 0.8) * 0.6;
  }
  return P;
}

// ------------------------------------------------------------------ frame helpers
function bodyFrame(P, sc) {
  const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch), cr = Math.cos(P.roll), sr = Math.sin(P.roll);
  const F = [cp, 0, sp];
  let U = [-sp, 0, cp], Rt = [0, 1, 0];
  const U2 = vadd(vmul(U, cr), vmul(Rt, sr)), R2 = vsub(vmul(Rt, cr), vmul(U, sr));
  return { B: [P.bf * sc, 0, P.bz * sc], F, U: U2, Rt: R2 };
}
const lp = (fr, l) => vadd(fr.B, vadd(vmul(fr.F, l[0]), vadd(vmul(fr.Rt, l[1]), vmul(fr.U, l[2]))));

// ------------------------------------------------------------------ draw
/**
 * Draw a quadruped. Q = species name + look: {sp, sc, coat, belly, mane, socks, hoof, eye, ...}.  Returns frame info for riders.
 */
export function drawQuad(S, Q, P, tc) {
  const SP = SPECIES[Q.sp], sc = Q.sc || 1, fr = bodyFrame(P, sc);
  const B = fr.B, F = fr.F, U = fr.U, Rt = fr.Rt;
  const coat = Q.coat, dark = Q.socks || shadeHex(coat, -0.35);
  const L = (l) => lp(fr, [l[0] * sc, l[1] * sc, l[2] * sc]);
  const out = { fr, sc };

  // ---- legs
  const legs = [['RF', SP.legF, 1, 1], ['LF', SP.legF, -1, 1], ['RH', SP.legH, 1, -1], ['LH', SP.legH, -1, -1]];
  for (let i = 0; i < 4; i++) {
    const [nm, lg, side, front] = legs[i];
    const hip = L([lg.hip[0], lg.hip[1] * side, lg.hip[2]]);
    const gx = lg.hip[0] * sc + P.bf * sc + P.legs[i].f * sc, gz = SP.ankleZ * sc + P.legs[i].z * sc;
    const ank = [gx, lg.hip[1] * side * sc, gz];
    const pole = front > 0 ? [1, 0, 0.1] : [-1, 0, 0.1];
    const knee = ik2(hip, ank, lg.l1 * sc, lg.l2 * sc, pole);
    const col = Q.legCol || coat;
    const sockCol = Q.socks || dark;
    S.cap(hip, knee, lg.r[0] * sc, lg.r[1] * sc, col, { b: side * 0.0 });
    S.cap(knee, ank, lg.r[1] * sc * 0.95, lg.r[2] * sc, Q.lowerCol || sockCol, { b: 0.01 });
    if (lg.knee) S.ball(knee, lg.knee * sc, Q.lowerCol || sockCol, { b: 0.01, noEdge: true });
    const hoofTip = [ank[0] + 0.7 * sc * (Q.hoofFwd === undefined ? 1 : Q.hoofFwd), ank[1], Math.max(0.15, ank[2] - lg.hoof * sc)];
    S.cap(ank, hoofTip, lg.r[2] * sc * 1.05, lg.r[2] * sc * 0.95, Q.hoof || '#2a211b', { b: 0.02, lv: [6, 4, 2] });
    out['k' + nm] = knee; out['a' + nm] = ank; out['h' + nm] = hip;
  }

  // ---- barrel
  const rings = SP.body.map(r => [r[0] * sc, r[1] * sc * (Q.wid || 1), r[2] * sc * (Q.hgt || 1)]);
  const barrel = S.revolve(B, F, Rt, U, rings, coat, { n: 14, tex: Q.coatTex || null, lv: Q.coatLv });
  out.barrel = barrel;
  if (Q.belly) {
    S.patch(barrel, rings[1][0], rings[rings.length - 2][0], PI * 1.02, PI * 1.98, Q.belly, { like: barrel.part, lvAuto: [7, 5, 3] });
  }
  if (Q.bodyDecor) Q.bodyDecor(S, out, barrel, fr, sc, P, tc);

  // hump (camel)
  if (SP.hump) {
    const hc = L([SP.hump.at, 0, SP.hump.z]);
    S.ell(hc, vmul(F, SP.hump.r[0] * sc), vmul(Rt, SP.hump.r[1] * sc), vmul(U, SP.hump.r[2] * sc * 0.75), Q.hump || coat, { b: 0.0 });
    out.hump = hc;
  }

  // ---- neck (one or more segments)
  const nk = SP.neck;
  const nSegs = nk.segs || [{ ang: nk.ang, len: nk.len, rings: nk.rings }];
  const nBase = L(nk.base);
  let cur = nBase, nDir0 = null, nU20 = null, lastDir = F;
  for (let si = 0; si < nSegs.length; si++) {
    const sg = nSegs[si];
    const a = (sg.ang + P.neck * 57.3 * (si === 0 ? 1 : 0.7)) * PI / 180;
    const dir = vnorm(vadd(vmul(F, Math.cos(a)), vmul(U, Math.sin(a))));
    const u2 = vnorm(vsub(U, vmul(dir, vdot(U, dir))));
    const rings = sg.rings.map(r => [r[0] * sc, r[1] * sc, r[2] * sc]);
    S.revolve(cur, dir, Rt, u2, rings, Q.neckCol || coat, { n: 12 });
    if (si === 0) { nDir0 = dir; nU20 = u2; }
    cur = vmad(cur, dir, sg.len * sc);
    lastDir = dir;
  }
  const polePt = cur, nDir = nDir0, nU2 = nU20;
  // mane along the neck top
  if (Q.mane && SP.maneLen) {
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const base = vmad(nBase, nDir, t * nSegs[0].len * sc);
      const rad = lerp(nSegs[0].rings[0][2], nSegs[0].rings[nSegs[0].rings.length - 1][2], t) * sc;
      const p = vmad(base, nU2, rad * 0.9);
      const sway = (P.tail || 0) * 0.5;
      const q = vadd(vmad(p, nU2, 1.2 * sc), vmul(F, -1.2 * sc * (1 + sway * 0.3)));
      S.cap(p, q, 1.1 * sc, 0.8 * sc, Q.mane, { b: -0.02, noEdge: i > 0 });
    }
    out.maneTop = vmad(nBase, nU2, nSegs[0].rings[0][2] * sc);
  }
  out.neckBase = nBase; out.neckDir = nDir; out.poll = polePt;

  // ---- head
  const hd = SP.head;
  const hAng = (hd.ang + (P.head * 57.3)) * PI / 180;
  let hDir = vnorm(vadd(vmul(F, Math.cos(hAng)), vmul(U, Math.sin(hAng))));
  if (P.headYaw) hDir = vnorm(vadd(hDir, vmul(Rt, P.headYaw)));
  const hU = vnorm(vsub(U, vmul(hDir, vdot(U, hDir))));
  const hRings = hd.rings.map(r => [r[0] * sc, r[1] * sc * (Q.headW || 1), r[2] * sc * (Q.headH || 1)]);
  const headRev = S.revolve(polePt, hDir, Rt, hU, hRings, Q.headCol || coat, { n: 12 });
  if (!S.headScr) S.headScr = S.P(vmad(polePt, hDir, hd.len * 0.4 * sc));
  out.headRev = headRev; out.hDir = hDir; out.hU = hU;
  const hp = (t, side, up) => vadd(vadd(vmad(polePt, hDir, t * sc), vmul(Rt, side * sc)), vmul(hU, up * sc));
  // muzzle tint
  if (Q.muzzle) S.ball(hp(hd.len - 0.8, 0, -0.1), hd.rings[hd.rings.length - 1][1] * sc * 1.05, Q.muzzle, { b: 0.05, noEdge: true });
  // eyes, ears
  for (const sd of [1, -1]) {
    const e = hp(hd.len * 0.3, sd * hd.rings[1][1] * 0.92, hd.rings[1][2] * 0.35);
    if (S.vis(vadd(vmul(Rt, sd), vmul(hDir, 0.2))) > 0.05) S.ball(e, 0.55 * sc, Q.eye || '#150e0a', { b: 0.06, noEdge: true, lv: [5, 4, 2] });
    const earBase = hp(hd.len * (hd.earAt || 0.2), sd * hd.rings[0][1] * 0.6, hd.rings[0][2] * 0.85);
    if (hd.ears === 'pointed') S.cap(earBase, vadd(vadd(earBase, vmul(U, 2.6 * sc)), vmul(Rt, sd * 0.3 * sc)), 0.85 * sc, 0.2 * sc, Q.earCol || coat, { b: 0.04 });
    else if (hd.ears === 'round') S.cap(earBase, vadd(vadd(earBase, vmul(U, 1.5 * sc)), vmul(Rt, sd * 0.6 * sc)), 0.7 * sc, 0.35 * sc, Q.earCol || coat, { b: 0.04 });
    else if (hd.ears === 'big') S.cap(earBase, vadd(vadd(earBase, vmul(U, 3.2 * sc)), vmad(vmul(Rt, sd * 1.8 * sc), F, -0.6 * sc)), 1.0 * sc, 0.35 * sc, Q.earCol || coat, { b: 0.04 });
    else if (hd.ears === 'small') S.cap(earBase, vadd(vadd(earBase, vmul(U, 1.1 * sc)), vmul(Rt, sd * 0.4 * sc)), 0.65 * sc, 0.3 * sc, Q.earCol || coat, { b: 0.04 });
  }
  if (Q.nostril) {
    for (const sd of [1, -1]) if (S.vis(vmul(Rt, sd)) > 0.1) S.ball(hp(hd.len - 0.4, sd * hd.rings[hd.rings.length - 1][1] * 0.7, 0.2), 0.32 * sc, '#1a1210', { b: 0.07, noEdge: true });
  }
  if (Q.headDecor) Q.headDecor(S, out, { polePt, hDir, hU, hp, Rt, sc, hd }, tc, P);
  out.hp = hp;

  // ---- tail
  const tl = SP.tail;
  if (tl && Q.tail !== false) {
    let p = L(tl.root);
    let dir = vnorm(vadd(vmul(F, -0.55), vmul(U, -0.35)));
    const segs = tl.segs;
    for (let i = 0; i < segs; i++) {
      const sway = (P.tail || 0) * (0.35 + i * 0.25);
      dir = vnorm(vadd(dir, vadd(vmul(Rt, sway * 0.5), vmul(U, -0.45))));
      const q = vmad(p, dir, tl.len * sc);
      S.cap(p, q, tl.r0 * sc * (1 - i * 0.12), tl.r0 * sc * (1 - (i + 1) * 0.12), Q.tailCol || Q.mane || coat, { b: -0.02, noEdge: i > 0 });
      p = q;
    }
  }
  if (Q.extras) Q.extras(S, out, fr, sc, P, tc);
  return out;
}
