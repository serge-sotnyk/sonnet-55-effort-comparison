// Animals: deer, boar, sheep, wolf (built on the generic quadruped rig).
import {
  vadd, vsub, vmul, vmad, vnorm, vdot, lerp, smooth, TAU, shadeHex, mixHex, xfRoll, rampOf, renderSprite, finish,
} from './units_core.js';
import { SPECIES, quadPose, drawQuad } from './units_quad.js';

const PI = Math.PI;
const FALLS = [0.12, 0.42, 0.85, 1.22, 1.48, PI / 2];
const HALFW = { deer: 2.8, boar: 3.6, sheep: 4.3, wolf: 2.6, horse: 4.3, camel: 4.5 };

export const BEAST_IDLE_FRAMES = { deer: 4, sheep: 4, boar: 3, wolf: 3 };

export function beastPose(kind, anim, frame) {
  const SP = SPECIES[kind];
  const P = quadPose(kind, null, anim === 'walk' ? 'walk' : 'none', frame);
  const sh = kind === 'sheep' ? 0.8 : 1;
  if (anim === 'idle') {
    if (kind === 'deer' || kind === 'sheep') {
      const g = [0.0, 0.5, 1.0, 0.55][frame % 4];                  // graze: head down to the grass
      P.neck = -g * (kind === 'deer' ? 1.15 : 0.9); P.head = g * 0.55;
      P.bz -= g * 0.35;
      P.tail = kind === 'deer' ? Math.sin(frame * 1.5) * 0.3 : 0;
      P.legs[0].f = 0; P.legs[1].f = 0;
    } else if (kind === 'boar') {
      P.bz += [0, 0.12, 0][frame % 3] - 0.05; P.head = [0.0, 0.08, 0.14][frame % 3]; P.tail = (frame - 1) * 0.3;
    } else if (kind === 'wolf') {
      P.neck = [0, 0.06, 0.02][frame % 3]; P.head = [0.0, 0.05, -0.04][frame % 3]; P.tail = [0.0, 0.4, -0.3][frame % 3]; P.bz += [0, 0.1, 0.05][frame % 3] - 0.05;
    }
  } else if (anim === 'attack') {
    const i = frame % 6;
    if (kind === 'boar') {
      const K = [{ bf: -0.6, head: 0.35, neck: -0.2, pitch: -0.05 }, { bf: -1.4, head: 0.55, neck: -0.35, pitch: -0.08 }, { bf: -0.6, head: 0.5, neck: -0.3, pitch: -0.02 }, { bf: 2.4, head: -0.4, neck: 0.25, pitch: 0.09 }, { bf: 1.4, head: -0.2, neck: 0.1, pitch: 0.04 }, { bf: 0.3, head: 0.1, neck: 0.0, pitch: 0.0 }][i];
      P.bf = K.bf; P.head = K.head; P.neck = K.neck; P.pitch = K.pitch;
      P.legs[0].f = i === 3 ? 2.0 : 0; P.legs[1].f = i === 3 ? 1.2 : 0; P.legs[0].z = i === 2 ? 1.2 : 0;
    } else if (kind === 'wolf') {
      const K = [{ bf: -0.4, bz: -0.8, pitch: -0.05, head: 0.15, neck: -0.12, mouth: 0.0 }, { bf: -1.4, bz: -1.4, pitch: -0.1, head: 0.2, neck: -0.2, mouth: 0.15 }, { bf: 0.8, bz: -0.2, pitch: 0.02, head: 0.0, neck: 0.1, mouth: 0.8 }, { bf: 2.8, bz: -0.6, pitch: 0.06, head: 0.3, neck: 0.05, mouth: 0.25 }, { bf: 1.8, bz: -0.5, pitch: 0.02, head: 0.15, neck: 0.0, mouth: 0.05, yaw: 0.35 }, { bf: 0.4, bz: -0.1, pitch: 0.0, head: 0.05, neck: 0.0, mouth: 0.0 }][i];
      P.bf = K.bf; P.bz += K.bz; P.pitch = K.pitch; P.head = K.head; P.neck = K.neck; P.mouth = K.mouth; P.headYaw = K.yaw || 0;
      P.legs[0].f = i >= 2 ? 2.5 : 0; P.legs[1].f = i >= 2 ? 1.5 : 0; P.legs[2].f = i >= 2 ? -1.5 : 0;
    } else {
      // deer / sheep: head butt
      const K = [{ head: -0.1, neck: 0.1 }, { head: -0.3, neck: 0.3 }, { head: 0.2, neck: -0.1 }, { head: 0.5, neck: -0.3, bf: 1.5 }, { head: 0.2, neck: -0.1, bf: 0.8 }, { head: 0, neck: 0 }][i];
      P.head = K.head; P.neck = K.neck; P.bf = K.bf || 0;
    }
  } else if (anim === 'death' || anim === 'corpse') {
    const i = anim === 'corpse' ? 5 : frame % 6, t = i / 5;
    P.fall = FALLS[i];
    P.neck = lerp(0, -0.5, t); P.head = lerp(0, 0.3, t);
    P.legs[0].f = 2.5 * t; P.legs[1].f = 3.2 * t; P.legs[2].f = -2.0 * t; P.legs[3].f = -2.8 * t;
    P.legs[0].z = 2.0 * t; P.legs[1].z = 3.0 * t; P.legs[2].z = 2.4 * t; P.legs[3].z = 1.4 * t;
    P.tail = 0; P.mouth = kind === 'wolf' ? 0.3 * t : 0;
  }
  return P;
}
export function fallXf(kind, P, side = 1, sc = 1) {
  const phi = P.fall;
  const z0 = SPECIES[kind].z0 * sc, hw = (HALFW[kind] || 4) * sc;
  return xfRoll(phi * side, [0, 0, 0], [0, -side * z0 * Math.sin(phi) * 0.9, hw * Math.sin(phi) * 0.95]);
}

// ------------------------------------------------------------------ decorations
function antlers(S, out, H) {
  const sc = H.sc, col = '#dccba0';
  for (const sd of [1, -1]) {
    const b0 = H.hp(1.8, sd * 0.8, 1.5);
    const up = vnorm(vadd(vmul(H.hU, 1.0), vmul(H.hDir, -0.45)));
    const side = vmul(H.Rt, sd);
    const b1 = vadd(vadd(b0, vmul(up, 2.6 * sc)), vmul(side, 0.5 * sc));
    const b2 = vadd(vadd(b1, vmul(up, 2.4 * sc)), vadd(vmul(side, 0.9 * sc), vmul(H.hDir, -0.7 * sc)));
    const b3 = vadd(vadd(b2, vmul(up, 1.8 * sc)), vadd(vmul(side, 0.8 * sc), vmul(H.hDir, -0.2 * sc)));
    S.cap(b0, b1, 0.5 * sc, 0.42 * sc, col, { b: 0.1, lv: [6, 5, 3] });
    S.cap(b1, b2, 0.42 * sc, 0.34 * sc, col, { b: 0.1, lv: [6, 5, 3] });
    S.cap(b2, b3, 0.34 * sc, 0.2 * sc, col, { b: 0.1, lv: [6, 5, 3] });
    // tines
    S.cap(b1, vadd(vadd(b1, vmul(H.hDir, 1.9 * sc)), vmul(up, 1.1 * sc)), 0.34 * sc, 0.12 * sc, col, { b: 0.1, lv: [6, 5, 3] });
    S.cap(b2, vadd(vadd(b2, vmul(H.hDir, 1.4 * sc)), vmul(up, 1.5 * sc)), 0.3 * sc, 0.1 * sc, col, { b: 0.1, lv: [6, 5, 3] });
    S.cap(b2, vadd(vadd(b2, vmul(side, 1.6 * sc)), vmul(up, 1.1 * sc)), 0.28 * sc, 0.1 * sc, col, { b: 0.1, lv: [6, 5, 3] });
  }
}
function tusks(S, out, H) {
  const sc = H.sc;
  for (const sd of [1, -1]) {
    const b = H.hp(H.hd.len - 1.2, sd * 1.0, -0.9);
    const m = vadd(vadd(b, vmul(H.hDir, 0.9 * sc)), vadd(vmul(H.Rt, sd * 0.5 * sc), vmul(H.hU, -0.6 * sc)));
    const t = vadd(vadd(m, vmul(H.hDir, 0.5 * sc)), vadd(vmul(H.Rt, sd * 0.2 * sc), vmul(H.hU, 1.2 * sc)));
    S.cap(b, m, 0.42 * sc, 0.34 * sc, '#ece3c8', { b: 0.09, lv: [7, 6, 4] });
    S.cap(m, t, 0.34 * sc, 0.1 * sc, '#f5eed8', { b: 0.09, lv: [7, 6, 4] });
  }
  // snout disc
  S.ball(H.hp(H.hd.len - 0.3, 0, -0.1), 1.35 * sc, '#7a5a4c', { b: 0.06, noEdge: true });
}
function wolfJaw(S, out, H, tc, P) {
  if (!P.mouth) return;
  const sc = H.sc, m = P.mouth;
  const a = H.hp(H.hd.len * 0.45, 0, -0.9), b = vadd(vadd(vadd(a, vmul(H.hDir, H.hd.len * 0.55 * sc)), vmul(H.hU, -m * 3.4 * sc)), vmul(H.hDir, -m * 0.6 * sc));
  S.cap(a, b, 0.7 * sc, 0.5 * sc, '#6a5a5a', { b: -0.03 });
  const inside = H.hp(H.hd.len - 1.0, 0, -0.5 - m * 1.2);
  S.ball(inside, (0.5 + m * 0.5) * sc, '#8a2a2a', { b: 0.04, noEdge: true });
  S.cap(H.hp(H.hd.len - 0.4, 0.4, -0.3), H.hp(H.hd.len - 0.4, 0.4, -0.3 - m * 1.4), 0.12 * sc, 0.06 * sc, '#f4f0e4', { b: 0.08, noEdge: true });
}
function boarBristles(S, out, barrel, fr, sc, P, tc) {
  const L = (f, r, z) => vadd(fr.B, vadd(vmul(fr.F, f * sc), vadd(vmul(fr.Rt, r * sc), vmul(fr.U, z * sc))));
  for (let i = 0; i < 9; i++) {
    const f = -6.2 + i * 1.55;
    const top = barrel.rad(f * sc);
    const base = L(f, 0, top[1] / sc * 0.98), tip = vadd(vadd(base, vmul(fr.U, 1.7 * sc)), vmul(fr.F, (-0.9 + 0.12 * i) * sc));
    S.cap(base, tip, 0.65 * sc, 0.1 * sc, '#2c211b', { b: 0.02, noEdge: true });
  }
}
function sheepWool(S, out, barrel, fr, sc, P, tc, Q) {
  const L = (f, r, z) => vadd(fr.B, vadd(vmul(fr.F, f * sc), vadd(vmul(fr.Rt, r * sc), vmul(fr.U, z * sc))));
  const wool = Q.coat;
  const pts = [[-4.6, 0, 3.6, 2.7], [-1.8, 0, 4.8, 3.0], [1.4, 0, 4.9, 2.9], [4.0, 0, 3.9, 2.5], [-3.4, 3.0, 1.4, 2.5], [-3.4, -3.0, 1.4, 2.5], [0.2, 3.4, 1.0, 2.7], [0.2, -3.4, 1.0, 2.7], [3.6, 2.6, 1.4, 2.3], [3.6, -2.6, 1.4, 2.3], [-5.4, 1.2, 0.6, 2.2], [-5.4, -1.2, 0.6, 2.2], [5.2, 0, 1.0, 2.3], [-2.0, 2.2, 4.0, 2.4], [-2.0, -2.2, 4.0, 2.4], [2.2, 2.0, 4.1, 2.3], [2.2, -2.0, 4.1, 2.3]];
  for (const p of pts) S.ball(L(p[0], p[1], p[2]), p[3] * sc, wool, { b: 0.02, noEdge: false, lv: [7, 5, 3] });
  // chest wool at the neck base
  S.ball(L(5.6, 0, 1.6), 2.4 * sc, wool, { b: 0.05, lv: [7, 5, 3] });
}
function deerDecor(S, out, barrel, fr, sc, P, tc) {
  const L = (f, r, z) => vadd(fr.B, vadd(vmul(fr.F, f * sc), vadd(vmul(fr.Rt, r * sc), vmul(fr.U, z * sc))));
  S.ell(L(-7.6, 0, 1.0), vmul(fr.F, 1.6 * sc), vmul(fr.Rt, 1.8 * sc), vmul(fr.U, 2.0 * sc), '#efe3c8', { b: 0.03 });   // rump patch
}

// ------------------------------------------------------------------ looks
export const BEAST_LOOKS = {
  deer(tc, v) {
    const k = v & 3, coat = ['#a2733f', '#96683a', '#aa7c48', '#8f6538'][k];
    return { sp: 'deer', coat, belly: '#eadcbc', socks: '#6e4c2c', legCol: coat, lowerCol: '#7a5532', tailCol: '#f0e6d0', nostril: true, headDecor: antlers, bodyDecor: deerDecor, earCol: shadeHex(coat, 0.05), muzzle: '#4a3426', mane: null, hoof: '#2a211b' };
  },
  boar(tc, v) {
    const k = v & 3, coat = ['#4d3b30', '#45352c', '#54403a', '#3e3029'][k];
    return { sp: 'boar', coat, socks: '#2c211b', legCol: coat, lowerCol: '#33271f', tailCol: '#2c211b', nostril: true, headDecor: tusks, bodyDecor: boarBristles, earCol: '#3a2c24', hoof: '#1c1512', wid: 1.0 };
  },
  sheep(tc, v, team) {
    const k = v & 3;
    return {
      sp: 'sheep', coat: ['#f1ece0', '#ebe5d6', '#f4f0e6', '#e6dfce'][k], socks: '#2e2a28', legCol: '#38322e', lowerCol: '#2a2523', headCol: '#33302d', neckCol: '#f1ece0', hoof: '#171311', earCol: '#33302d', tailCol: '#f1ece0', tail: false,
      extras: (S, out, fr, sc, P, tc2) => { sheepWool(S, out, out.barrel, fr, sc, P, tc2, { coat: ['#f1ece0', '#ebe5d6', '#f4f0e6', '#e6dfce'][k] }); if (team) earTag(S, out, tc2); },
      eye: '#f0e8d8',
    };
  },
  wolf(tc, v) {
    const k = v & 3, coat = ['#73737a', '#6a6a70', '#7d7b78', '#605f66'][k];
    return { sp: 'wolf', coat, belly: '#b9b8b0', socks: '#4a4a50', legCol: coat, lowerCol: '#5e5c5a', tailCol: '#66666c', nostril: true, headDecor: wolfJaw, earCol: '#58585e', muzzle: '#9a9892', hoof: '#26221f', eye: '#d9a830' };
  },
};
function earTag(S, out, tc) {
  const hp = out.hp, hd = out.headRev;
  const p = hp(1.2, 1.3, 1.9);
  S.ball(p, 0.7, tc.main, { b: 0.1, noEdge: true });
}

// ------------------------------------------------------------------ generator
export function genBeast(S, kind, tc, dir, anim, frame, variant, team) {
  const mk = BEAST_LOOKS[kind];
  const Q = mk(tc, variant, team);
  const P = beastPose(kind, anim, frame);
  S.begin(dir);
  if (P.fall) S.xf = fallXf(kind, P, (variant & 1) ? -1 : 1);
  drawQuad(S, Q, P, tc);
  return finish(S);
}
