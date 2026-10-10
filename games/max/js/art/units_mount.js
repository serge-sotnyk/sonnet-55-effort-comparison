// Mounted units: horse / camel / pony mounts with riders (cavalry, camels, horse archers).
import {
  Scene, V, vadd, vsub, vmul, vmad, vdot, vlen, vnorm, vlerp, vcross, lerp, smooth, TAU, shadeHex, mixHex, xfRoll, renderSprite, finish, clamp,
} from './units_core.js';
import { SPECIES, quadPose, drawQuad } from './units_quad.js';
import { solveHuman, drawHuman, SKINS, HAIRS, METAL, STEEL, GOLD, LEATHER, DLEATHER } from './units_human.js';
import { STYLES, deathPose, iconAdjust, weaponTrail } from './units_anim.js';

const PI = Math.PI;
const MAIL = '#8d98a6', MAILD = '#76808d', PLATE = '#9ba7b5', PLATEB = '#b8c4d1';
const pick = (arr, v) => arr[((v % arr.length) + arr.length) % arr.length];
const who = (v, o = {}) => ({ skin: SKINS[pick(o.skins || [1, 0, 2, 1, 3, 1, 0, 2], v)], hair: HAIRS[pick(o.hairs || [1, 0, 2, 3, 5, 7, 1, 4], v >> 1)] });

// seat / stirrup geometry per mount species (local coords of the body frame)
const SEAT = {
  horse: { seat: [1.0, 8.1], stir: [1.9, 5.8, -10.0] },
  camel: { seat: [-6.4, 9.4], stir: [-5.2, 6.6, -10.2] },
};

// ------------------------------------------------------------------ gear (cloth, saddle, armor)
function flapPoly(S, barrel, fr, sc, side, f0, f1, opt) {
  const th = opt.thTop === undefined ? 0.85 : opt.thTop, thH = opt.thHem === undefined ? -0.8 : opt.thHem;
  const flare = (opt.flare === undefined ? 1.0 : opt.flare) * sc, scal = (opt.scallop === undefined ? 0.9 : opt.scallop) * sc;
  const nF = 6, bb = opt.b === undefined ? -1.2 : opt.b;
  const top = [], hem = [];
  for (let i = 0; i <= nF; i++) {
    const h = lerp(f0, f1, i / nF) * sc;
    top.push(barrel.pt(h, side > 0 ? th : PI - th, 1.045));
    let hp = barrel.pt(h, side > 0 ? thH : PI - thH, 1.0);
    hp = vadd(vadd(hp, vmul(fr.Rt, side * flare)), vmul(fr.U, (i % 2 ? scal : 0)));
    hem.push(hp);
  }
  const mid = (t) => barrel.pt(lerp(f0, f1, t) * sc, side > 0 ? 0.0 : PI, 1.1);
  const pts = top.concat([mid(1.0)], hem.slice().reverse(), [mid(0.0)]);
  const n = vnorm(vadd(vmul(fr.Rt, side), vmul(fr.U, 0.25)));
  const poly = S.poly(pts, opt.col, n, { lv: [7, 5, 3], b: bb });
  if (opt.trim) S.line(hem, 1.2, opt.trim, { b: bb + 0.01 });
  if (opt.trim2) S.line(top, 1.0, opt.trim2, { b: bb + 0.01 });
  if (opt.stripe) {
    const sp = [];
    for (let i = 0; i <= nF; i++) { const h = lerp(f0, f1, i / nF) * sc; sp.push(vadd(barrel.pt(h, side > 0 ? -0.15 : PI + 0.15, 1.07), vmul(fr.Rt, side * 0.4 * sc))); }
    S.line(sp, 1.0, opt.stripe, { b: bb + 0.01 });
  }
  if (opt.emblem) {
    const c = barrel.pt(lerp(f0, f1, 0.5) * sc, side > 0 ? 0.1 : PI - 0.1, 1.12);
    S.ball(vadd(c, vmul(fr.Rt, side * 0.3 * sc)), (opt.emblemR || 1.9) * sc, opt.emblem, { b: bb + 0.02, lv: [7, 6, 4] });
  }
  return poly;
}
function makeGear(cfg) {
  return {
    body(S, out, barrel, fr, sc, P, tc) {
      const L = (f, r, z) => vadd(fr.B, vadd(vmul(fr.F, f * sc), vadd(vmul(fr.Rt, r * sc), vmul(fr.U, z * sc))));
      if (cfg.cloth) {
        const c = cfg.cloth;
        const f0 = c.f0 === undefined ? -10.5 : c.f0, f1 = c.f1 === undefined ? 10.2 : c.f1;
        S.patch(barrel, f0 * sc, f1 * sc, 0.85, PI - 0.85, c.col, { like: barrel.part, k: 1.045, lvAuto: [7, 5, 3] });
        for (const side of [1, -1]) flapPoly(S, barrel, fr, sc, side, f0, f1, c);
        if (c.chest) {
          // chest drape at the front
          const fx = f1 + 0.2;
          S.poly([L(fx, -3.4, 4.0), L(fx + 1.0, 0, 4.8), L(fx, 3.4, 4.0), L(fx + 1.2, 3.8, -4.4), L(fx + 1.8, 0, -5.2), L(fx + 1.2, -3.8, -4.4)], c.col, vnorm(vadd(fr.F, vmul(fr.U, 0.2))), { lv: [7, 5, 3], b: -0.8 });
        }
        if (c.rump) {
          const fx = f0 - 0.2;
          S.poly([L(fx, -3.6, 4.4), L(fx - 1.0, 0, 5.0), L(fx, 3.6, 4.4), L(fx - 0.6, 4.0, -4.4), L(fx - 1.4, 0, -5.2), L(fx - 0.6, -4.0, -4.4)], c.col, vnorm(vsub(vmul(fr.U, 0.2), fr.F)), { lv: [7, 5, 3], b: -0.8 });
        }
      }
      if (cfg.blanket) {
        const c = cfg.blanket;
        S.patch(barrel, -5.0 * sc, 5.2 * sc, 0.8, PI - 0.8, c.col, { like: barrel.part, k: 1.05, lvAuto: [7, 5, 3] });
        for (const side of [1, -1]) flapPoly(S, barrel, fr, sc, side, -5.0, 5.2, { thTop: 0.8, thHem: -0.35, col: c.col, trim: c.trim, flare: 0.45, scallop: 0.0, b: -1.0, emblem: c.emblem, emblemR: 1.3 });
      }
      if (cfg.saddle !== false) {
        const sd = SEAT[cfg.mount || 'horse'];
        S.ell(L(sd.seat[0] - 0.2, 0, sd.seat[1] - 1.5), vmul(fr.F, 3.4 * sc), vmul(fr.Rt, 3.0 * sc), vmul(fr.U, 1.3 * sc), cfg.saddle || '#6a3e22', { b: 0.02 });
        S.ell(L(sd.seat[0] + 2.8, 0, sd.seat[1] - 0.9), vmul(fr.F, 1.0 * sc), vmul(fr.Rt, 2.4 * sc), vmul(fr.U, 1.4 * sc), cfg.saddle || '#6a3e22', { b: 0.02 });
      }
      if (cfg.rumpArmor) {
        S.ell(L(-9.0, 0, 1.4), vmul(fr.F, 4.6 * sc), vmul(fr.Rt, 4.9 * sc), vmul(fr.U, 5.6 * sc), cfg.rumpArmor, { b: 0.03, lv: [8, 5, 1] });
      }
    },
    extras(S, out, fr, sc, P, tc) {
      const L = (f, r, z) => vadd(fr.B, vadd(vmul(fr.F, f * sc), vadd(vmul(fr.Rt, r * sc), vmul(fr.U, z * sc))));
      if (cfg.neckArmor) {
        const nk = SPECIES[out.sp || cfg.mount || 'horse'].neck;
        const rings = nk.rings.map(r => [r[0] * sc, r[1] * sc * 1.18, r[2] * sc * 1.12]);
        const u2 = vnorm(vsub(fr.U, vmul(out.neckDir, vdot(fr.U, out.neckDir))));
        S.revolve(vmad(out.neckBase, out.neckDir, 0.5 * sc), out.neckDir, fr.Rt, u2, rings.slice(0, 3).map(r => [r[0], r[1], r[2]]), cfg.neckArmor, { n: 12, lv: [8, 5, 1] });
      }
      if (cfg.peytral) {
        S.ell(L(11.6, 0, 0.8), vmul(fr.F, 3.2 * sc), vmul(fr.Rt, 4.0 * sc), vmul(fr.U, 6.2 * sc), cfg.peytral, { b: 0.05, lv: [8, 5, 1] });
      }
    },
    head(S, out, H, tc, P) {
      const sc = H.sc;
      if (cfg.chanfron) {
        const rings = H.hd.rings.map(r => [r[0] * sc + 0.9 * sc, r[1] * sc * 1.15, r[2] * sc * 1.14]).filter((r, i) => i < 3);
        S.revolve(vmad(H.polePt, H.hDir, 0.4 * sc), H.hDir, H.Rt, H.hU, rings.map((r, i) => [r[0] - 0.9 * sc, r[1], r[2]]).concat([[H.hd.len * 0.72 * sc, H.hd.rings[2][1] * sc * 1.2, H.hd.rings[2][2] * sc * 1.18]]), cfg.chanfron, { n: 12, lv: [8, 5, 1] });
        const sp0 = H.hp(H.hd.len * 0.3, 0, H.hd.rings[1][2] + 0.4);
        S.cap(sp0, vadd(sp0, vadd(vmul(H.hU, 1.8 * sc), vmul(H.hDir, -0.2 * sc))), 0.5 * sc, 0.1 * sc, cfg.chanfronSpike || GOLD, { b: 0.1, lv: [8, 5, 2] });
      }
      if (cfg.plume) {
        // feathers streaming from the poll
        const b = vadd(H.hp(1.0, 0, H.hd.rings[0][2] + 0.5), vmul(H.hU, 0.5 * sc));
        let prev = b;
        const up = out.fr.U, back = vmul(out.fr.F, -1);
        for (let i = 1; i <= 4; i++) {
          const t = i / 4;
          const p = vadd(vadd(b, vmul(up, (2.8 * Math.sin(t * 1.9)) * sc * (cfg.plumeLen || 1))), vmul(back, (2.4 * t + 0.8 * t * t) * sc * (cfg.plumeLen || 1)));
          S.cap(prev, p, 0.75 * sc * (1 - 0.18 * i), 0.75 * sc * (1 - 0.18 * (i + 1)), cfg.plume, { b: -0.2, lv: [7, 5, 3] });
          prev = p;
        }
      }
      // bridle strap
      S.line([H.hp(H.hd.len * 0.5, H.hd.rings[1][1] * 0.95, H.hd.rings[1][2] * 0.3), H.hp(H.hd.len * 0.95, H.hd.rings[2][1] * 0.8, -0.3)], 0.55, cfg.bridle || '#2a1a10', { b: 0.08 });
      if (cfg.chanfron === undefined) { /* noop */ }
    },
  };
}
function horseQ(o, gear) {
  const g = makeGear(gear || {});
  return Object.assign({
    sp: 'horse', mane: '#241610', nostril: true, hoof: '#2a211b',
    bodyDecor: g.body, extras: g.extras, headDecor: g.head, mount: 'horse',
  }, o);
}

// ------------------------------------------------------------------ looks
// rider looks reuse the human look format
function rider(o) { return Object.assign({ hairStyle: 'short', build: 1 }, o); }

export const MOUNT_LOOKS = {
  scout(tc, v) {
    const w = who(v);
    const coat = pick(['#8a4a26', '#7a4a2e', '#946038', '#6e4028'], v);
    return {
      mount: horseQ({ coat, mane: '#241610', socks: '#2a1a12', belly: shadeHex(coat, 0.16), coatTex: null, wid: 0.95 }, { blanket: { col: tc.main, trim: tc.light }, saddle: '#6a3e22' }),
      rider: rider({
        style: 'spear', sc: 1.0, ...w,
        torso: { kind: 'tunic', col: tc.main, skirt: 4.2, belt: '#4a3220', hemBand: shadeHex(tc.main, -0.2) },
        arms: { up: tc.main, fore: w.skin, col: w.skin }, legs: { col: '#6a5c46', boot: '#3d2a1c', bootH: 0.55 },
        head: { kind: 'felt', col: '#8b7a5a' },
        weapon: { kind: 'spear', len: 36, grip: 0.38, head: 4.0, hw: 1.9, shaft: '#8a6035' },
      }),
    };
  },
  light_cavalry(tc, v) {
    const w = who(v);
    const coat = pick(['#a2602e', '#b0703a', '#94582c', '#a86a34'], v);
    return {
      mount: horseQ({ coat, mane: '#4a3020', socks: '#3a2616', belly: shadeHex(coat, 0.18), wid: 0.93, hgt: 0.97 }, { blanket: { col: tc.main, trim: GOLD }, saddle: '#5a3820' }),
      rider: rider({
        style: 'spear', sc: 1.0, ...w,
        torso: { kind: 'gambeson', col: tc.main, skirt: 4.4, belt: '#3a2a1c', hemBand: shadeHex(tc.main, -0.25) },
        arms: { up: tc.main, fore: '#6a5338', col: tc.main }, legs: { col: '#575a64', boot: '#34261a', bootH: 0.55 },
        head: { kind: 'nasal', col: '#aab4c0', coif: false },
        weapon: { kind: 'spear', len: 40, grip: 0.38, head: 4.4, hw: 2.0, shaft: '#7a5a38' },
      }),
    };
  },
  hussar(tc, v) {
    const w = who(v, { hairs: [0, 1, 7, 2] });
    const coat = pick(['#3a2a22', '#4a3226', '#2e2420', '#54392a'], v);
    return {
      mount: horseQ({ coat, mane: '#17100c', socks: '#1c130e', belly: shadeHex(coat, 0.1), wid: 0.93, hgt: 0.98 }, { blanket: { col: tc.main, trim: GOLD, emblem: GOLD }, saddle: '#4a2c18' }),
      rider: rider({
        style: 'sword1', sc: 1.02, ...w, beard: null,
        torso: { kind: 'tunic', col: tc.main, skirt: 5.2, belt: '#2f2218', hemBand: GOLD, belt2: GOLD, collar: '#e6dfcc' },
        arms: { up: tc.main, fore: tc.main, col: tc.main, glove: '#2f2218' }, legs: { col: '#f0ebe0', boot: '#2a1c14', bootH: 0.6 },
        head: { kind: 'furhat', col: tc.dark, fur: '#4a3a2c', feather: '#f0ede4' },
        back: [{ k: 'cloak', col: tc.main, len: 10, trim: GOLD, sway: 1 }],
        weapon: { kind: 'sword', len: 14.5, wid: 1.7, blade: '#d8e0ea', hilt: '#3a2a1c', pommel: GOLD, guard: GOLD },
      }),
    };
  },
  knight(tc, v) {
    const w = who(v);
    const coat = pick(['#6a4a34', '#5a4030', '#74543a', '#4e382a'], v);
    return {
      mount: horseQ({ coat, mane: '#1c1410', socks: '#2a1c14', belly: shadeHex(coat, 0.12), wid: 1.04, hgt: 1.02 }, { cloth: { col: tc.main, trim: tc.light, trim2: null, f0: -10.5, f1: 10.2, chest: false }, saddle: '#4a2c18' }),
      rider: rider({
        style: 'spear', sc: 1.05, ...w,
        torso: { kind: 'mail', col: MAIL, metal: true, skirt: 5.5, belt: '#2f2218', tabard: tc.main, tabardTrim: tc.light, skirtCol: tc.main, collar: MAIL, metalCollar: true },
        arms: { up: MAIL, fore: MAIL, col: MAIL, metal: true, glove: '#3a2a1c' }, legs: { col: MAIL, metal: true, boot: '#2f2218', bootH: 0.5 },
        head: { kind: 'bascinet', col: '#c8d1db' },
        weapon: { kind: 'spear', len: 50, grip: 0.34, head: 5.4, hw: 2.2, shaft: '#7a5a38', pennon: tc.main },
        shield: { kind: 'kite', face: tc.main, rim: '#4a4f58', pc: tc.light, W: 4.6, H: 12 },
      }),
    };
  },
  cavalier(tc, v) {
    const w = who(v);
    const coat = pick(['#3e3430', '#4a3a34', '#5a4636', '#34302e'], v);
    return {
      mount: horseQ({ coat, mane: '#120c0a', socks: '#1c1410', belly: shadeHex(coat, 0.1), wid: 1.06, hgt: 1.04 }, { cloth: { col: tc.main, trim: GOLD, stripe: tc.light, emblem: tc.light, f0: -10.8, f1: 10.8, chest: true, rump: true }, chanfron: '#c4ced8', saddle: '#3a2414', plume: tc.main, plumeLen: 0.8 }),
      rider: rider({
        style: 'spear', sc: 1.07, ...w, build: 1.04,
        torso: { kind: 'plate', col: PLATE, metal: true, plate: true, skirt: 5.5, belt: '#2f2218', tabard: tc.main, tabardTrim: GOLD, skirtCol: tc.main, collar: PLATEB, metalCollar: true },
        arms: { up: PLATE, fore: PLATE, col: PLATE, metal: true, foreMetal: true, glove: '#4a4f58', pauldron: PLATEB },
        legs: { col: PLATE, metal: true, boot: '#aab4c0', bootH: 0.5, knee: '#cdd6e0' },
        head: { kind: 'bascinet', col: '#d4dce6', plume: tc.main, plumeLen: 1.1 },
        weapon: { kind: 'spear', len: 54, grip: 0.34, head: 5.8, hw: 2.4, shaft: '#6e4e2e', pennon: tc.main },
        shield: { kind: 'kite', face: tc.main, rim: '#8a939e', pc: GOLD, W: 4.8, H: 12.5 },
      }),
    };
  },
  paladin(tc, v) {
    const w = who(v, { hairs: [0, 7, 1] });
    return {
      mount: horseQ({ coat: pick(['#d8d8d2', '#cfcfc8', '#e0ded6', '#c4c4be'], v), mane: '#f2f0ea', socks: '#bdbdb6', tailCol: '#f2f0ea', wid: 1.08, hgt: 1.06, belly: '#ecebe4' },
        { cloth: { col: tc.main, trim: GOLD, trim2: GOLD, stripe: GOLD, emblem: GOLD, emblemR: 2.3, f0: -11.0, f1: 11.0, chest: true, rump: true, scallop: 1.3, thHem: -1.0 }, chanfron: '#e2e8ef', chanfronSpike: GOLD, neckArmor: '#d6dde6', peytral: '#d6dde6', saddle: '#2a1a10', plume: tc.main, plumeLen: 1.3 }),
      rider: rider({
        style: 'spear', sc: 1.09, ...w, build: 1.06,
        torso: { kind: 'plate', col: PLATEB, metal: true, plate: true, skirt: 5.5, belt: GOLD, tabard: tc.main, tabardTrim: GOLD, skirtCol: tc.main, belt2: GOLD, collar: '#e2e8ef', metalCollar: true },
        arms: { up: PLATEB, fore: PLATEB, col: PLATEB, metal: true, foreMetal: true, glove: '#6a6f78', pauldron: '#e6ecf3', elbow: '#e6ecf3' },
        legs: { col: PLATEB, metal: true, boot: '#cdd6e0', bootH: 0.5, knee: '#e6ecf3' },
        head: { kind: 'bascinet', col: '#e4eaf2', plume: tc.main, plumeLen: 1.6 },
        back: [{ k: 'cloak', col: tc.main, len: 14, trim: GOLD, sway: 2 }],
        weapon: { kind: 'spear', len: 58, grip: 0.34, head: 6.2, hw: 2.6, shaft: '#5e4226', pennon: tc.main, tip: '#e6edf5' },
        shield: { kind: 'kite', face: tc.main, rim: GOLD, pc: GOLD, W: 5.0, H: 13, bossCol: GOLD },
      }),
    };
  },
  cavalry_archer(tc, v) {
    const w = who(v, { skins: [1, 2, 1, 3] });
    const coat = pick(['#a2602e', '#8a5430', '#b27a46', '#7a4a2a'], v);
    return {
      mount: horseQ({ coat, mane: '#2a1a10', socks: '#3a2616', belly: shadeHex(coat, 0.15), wid: 0.95 }, { blanket: { col: tc.main, trim: tc.light }, saddle: '#5a3820' }),
      rider: rider({
        style: 'bow', sc: 1.0, ...w,
        torso: { kind: 'tunic', col: tc.main, skirt: 6.4, belt: '#3a2a1c', hemBand: shadeHex(tc.main, -0.2) },
        arms: { up: tc.main, fore: tc.main, col: tc.main, glove: '#3a2a1c' }, legs: { col: '#5a4e3c', boot: '#2f2218', bootH: 0.7 },
        head: { kind: 'furhat', col: '#7a5a38', fur: '#5a4030' },
        back: [{ k: 'quiver', col: '#6a4a2a' }],
        weapon: { kind: 'bow', len: 19, wood: '#7a4a24', bend: 0.18, recurve: 0.5, trim: '#4a3220' },
      }),
    };
  },
  heavy_cav_archer(tc, v) {
    const w = who(v, { skins: [1, 2, 1, 3] });
    const coat = pick(['#5a4636', '#6a5040', '#4a3a30', '#74583e'], v);
    return {
      mount: horseQ({ coat, mane: '#1c120c', socks: '#2a1c14', belly: shadeHex(coat, 0.1), wid: 1.0, hgt: 1.0 },
        { cloth: { col: tc.main, trim: tc.light, f0: -9.5, f1: 9.0, chest: false }, neckArmor: '#9aa6b4', peytral: '#9aa6b4', rumpArmor: null, saddle: '#3a2414' }),
      rider: rider({
        style: 'bow', sc: 1.03, ...w,
        torso: { kind: 'mail', col: MAIL, metal: true, skirt: 6.5, belt: '#2f2218', tabard: tc.main, tabardTrim: tc.light, skirtCol: tc.main },
        arms: { up: MAIL, fore: MAIL, col: MAIL, metal: true, glove: '#2f2218' }, legs: { col: '#4b4d58', boot: '#2a1c14', bootH: 0.7 },
        head: { kind: 'conical', col: '#aab4c0', coifCol: MAILD, coif: true },
        back: [{ k: 'quiver', col: '#4e3622' }],
        weapon: { kind: 'bow', len: 20, wood: '#6a3e1c', bend: 0.18, recurve: 0.55, trim: GOLD, tips: GOLD },
      }),
    };
  },
  mangudai(tc, v) {
    const w = who(v, { skins: [2, 1, 2, 3], hairs: [7, 0, 1, 7] });
    const coat = pick(['#7a5a3a', '#6a4e34', '#86664a', '#5e4630'], v);
    return {
      mount: horseQ({ coat, mane: '#2a1c12', socks: '#3a2a1c', belly: shadeHex(coat, 0.12), sc: 0.9, wid: 1.08, hgt: 0.94, shaggy: true, tailCol: '#2a1c12' }, { blanket: { col: tc.main, trim: tc.light, emblem: tc.light }, saddle: '#5a3a20' }),
      rider: rider({
        style: 'bow', sc: 1.0, ...w, hairStyle: 'long',
        torso: { kind: 'tunic', col: tc.main, skirt: 7.2, belt: '#c9a24a', hemBand: shadeHex(tc.main, -0.25), collar: '#7a5a3a' },
        arms: { up: tc.main, fore: tc.main, col: tc.main, glove: '#3a2a1c' }, legs: { col: '#4e4a3c', boot: '#2f2218', bootH: 0.75 },
        head: { kind: 'furhat', col: tc.dark, fur: '#6d4b32' },
        back: [{ k: 'quiver', col: '#7a5230' }],
        weapon: { kind: 'bow', len: 18, wood: '#8a5a2c', bend: 0.18, recurve: 0.55, trim: '#4a3220' },
      }),
    };
  },
  elite_mangudai(tc, v) {
    const w = who(v, { skins: [2, 1, 2, 3], hairs: [7, 0, 1, 7] });
    const coat = pick(['#5e4630', '#7a5a3a', '#6a4e34', '#4a3828'], v);
    return {
      mount: horseQ({ coat, mane: '#1c120a', socks: '#2a1c12', belly: shadeHex(coat, 0.1), sc: 0.92, wid: 1.1, hgt: 0.96, shaggy: true, tailCol: '#1c120a' }, { blanket: { col: tc.main, trim: GOLD, emblem: GOLD }, saddle: '#3a2414', chanfron: null, plume: tc.light, plumeLen: 0.6 }),
      rider: rider({
        style: 'bow', sc: 1.03, ...w, hairStyle: 'long',
        torso: { kind: 'brigandine', col: '#4a3a2c', skirt: 7.4, belt: GOLD, hemBand: GOLD, tabard: tc.main, tabardTrim: GOLD, skirtCol: tc.main, collar: '#8a6a48' },
        arms: { up: tc.main, fore: '#5a4630', col: tc.main, glove: '#2f2218' }, legs: { col: '#3a362c', boot: '#241810', bootH: 0.75 },
        head: { kind: 'furhat', col: tc.main, fur: '#8a6a48', feather: GOLD },
        back: [{ k: 'quiver', col: '#5a3a20', fletch: tc.light }],
        weapon: { kind: 'bow', len: 19, wood: '#9a6a30', bend: 0.18, recurve: 0.55, trim: GOLD, tips: GOLD },
      }),
    };
  },
  camel(tc, v) {
    const w = who(v, { skins: [3, 2, 3, 4], hairs: [7, 0, 1, 7] });
    const coat = pick(['#b88e56', '#c49a62', '#a98250', '#bf9660'], v);
    return {
      mount: camelQ({ coat, mane: '#7a5a34', socks: coat, wid: 1.0 }, { blanket: { col: tc.main, trim: tc.light, emblem: tc.light }, saddle: '#6a4a2a', mount: 'camel' }),
      rider: rider({
        style: 'spear', sc: 1.0, ...w, hairStyle: 'short',
        torso: { kind: 'tunic', col: '#e0d6b8', skirt: 6.4, belt: tc.main, hemBand: tc.main, belt2: null },
        arms: { up: '#e0d6b8', fore: '#e0d6b8', col: '#e0d6b8', glove: null }, legs: { col: '#c9bc98', boot: '#5a3a22', bootH: 0.5 },
        head: { kind: 'turban', col: '#ece4cc', band: tc.main },
        weapon: { kind: 'spear', len: 42, grip: 0.36, head: 4.4, hw: 2.0, shaft: '#8a6035' },
      }),
    };
  },
  heavy_camel(tc, v) {
    const w = who(v, { skins: [3, 2, 3, 4], hairs: [7, 0, 1, 7] });
    const coat = pick(['#a8814c', '#b58c56', '#9a7444', '#b08650'], v);
    return {
      mount: camelQ({ coat, mane: '#5a3e22', socks: coat, wid: 1.04 }, { cloth: { col: tc.main, trim: GOLD, stripe: tc.light, emblem: GOLD, f0: -9, f1: 8, chest: false }, saddle: '#4a2e18', mount: 'camel' }),
      rider: rider({
        style: 'spear', sc: 1.04, ...w,
        torso: { kind: 'mail', col: MAIL, metal: true, skirt: 6.2, belt: '#2f2218', tabard: tc.main, tabardTrim: GOLD, skirtCol: tc.main, collar: MAIL, metalCollar: true },
        arms: { up: MAIL, fore: MAIL, col: MAIL, metal: true, glove: '#2f2218' }, legs: { col: '#d8cfb2', boot: '#3a2418', bootH: 0.5 },
        head: { kind: 'turban', col: '#e8e0c8', band: tc.main },
        back: [{ k: 'banner', col: tc.main, trim: GOLD }],
        weapon: { kind: 'spear', len: 46, grip: 0.36, head: 5.0, hw: 2.2, shaft: '#6a4a2c', pennon: tc.light },
        shield: { kind: 'round', R: 4.6, face: tc.main, rim: '#8a939e', pc: GOLD, pattern: 'cross', boss: 1.3, bossCol: GOLD },
      }),
    };
  },
};
function camelQ(o, gear) {
  const g = makeGear(gear || {});
  return Object.assign({ sp: 'camel', nostril: true, hoof: '#4a3826', bodyDecor: g.body, extras: g.extras, headDecor: g.head, mount: 'camel', tail: true, tailCol: o.mane, hump: shadeHex(o.coat, -0.04), muzzle: shadeHex(o.coat, -0.12), neckCol: o.coat, legCol: o.coat, lowerCol: shadeHex(o.coat, -0.06), belly: shadeHex(o.coat, 0.16) }, o);
}

// ------------------------------------------------------------------ poses
export const MOUNT_ATTACK_FEET = [[0, 0], [0, 0]];
function mountPose(kind, anim, frame) {
  const SP = SPECIES[kind];
  if (anim === 'walk') return quadPose(kind, null, 'walk', frame);
  const P = quadPose(kind, null, 'none', 0);
  if (anim === 'attack') {
    const i = frame % 6;
    const K = [
      { pitch: 0.05, bf: -0.4, neck: 0.1, head: -0.1, fz: 1.2 },
      { pitch: 0.12, bf: -0.8, neck: 0.18, head: -0.18, fz: 2.8 },
      { pitch: 0.05, bf: -0.2, neck: 0.05, head: -0.05, fz: 1.4 },
      { pitch: -0.07, bf: 1.6, neck: -0.12, head: 0.12, fz: 0 },
      { pitch: -0.02, bf: 0.9, neck: -0.05, head: 0.05, fz: 0 },
      { pitch: 0.0, bf: 0.2, neck: 0.0, head: 0.0, fz: 0 },
    ][i];
    P.pitch = K.pitch; P.bf = K.bf; P.neck = K.neck; P.head = K.head;
    P.legs[0].z = K.fz; P.legs[1].z = K.fz * 0.8; P.legs[0].f = K.fz * 0.5; P.legs[1].f = K.fz * 0.3;
    if (i === 3) { P.legs[0].f = 2.5; P.legs[1].f = 2.0; }
    P.tail = Math.sin(i) * 0.4;
  } else if (anim === 'death' || anim === 'corpse') {
    const i = anim === 'corpse' ? 5 : frame % 6, t = i / 5;
    const FALLS = [0.12, 0.4, 0.82, 1.2, 1.47, PI / 2];
    P.fall = FALLS[i];
    P.neck = -0.6 * t; P.head = 0.35 * t;
    P.legs[0].f = 3.5 * t; P.legs[1].f = 4.2 * t; P.legs[2].f = -3.0 * t; P.legs[3].f = -3.8 * t;
    P.legs[0].z = 2.5 * t; P.legs[1].z = 3.5 * t; P.legs[2].z = 3 * t; P.legs[3].z = 2 * t;
  }
  return P;
}

// ------------------------------------------------------------------ generate
export function genMounted(S, d, look, tc, dir, anim, frame, variant) {
  const M = look.mount, R = look.rider;
  const kind = M.sp, sc = M.sc || 1;
  const P = mountPose(kind, anim, frame);
  S.begin(dir);
  // global fall transform
  let sideSign = 1;
  if (P.fall) {
    const hw = 4.4 * sc, z0 = SPECIES[kind].z0 * sc;
    sideSign = (variant & 1) ? -1 : 1;
    S.xf = xfRoll(P.fall * sideSign, [0, 0, 0], [0, -sideSign * z0 * Math.sin(P.fall) * 0.85, hw * Math.sin(P.fall) * 0.95]);
  }
  const out = drawQuad(S, M, P, tc);
  out.sp = kind;
  // ---- rider
  const fr = out.fr, rs = R.sc;
  const st = STYLES[R.style];
  let po;
  if (anim === 'attack') po = st.attack(frame % 6);
  else if (anim === 'death' || anim === 'corpse') po = deathPose(anim === 'corpse' ? 5 : frame % 6, st.idle());
  else po = st.idle();
  if (S.icon) iconAdjust(po);
  const sd = SEAT[kind];
  const L = (l) => vadd(fr.B, vadd(vmul(fr.F, l[0] * sc), vadd(vmul(fr.Rt, l[1] * sc), vmul(fr.U, l[2] * sc))));
  const seat = L([sd.seat[0], 0, sd.seat[1]]);
  po.px = seat[0] / rs; po.pr = seat[1] / rs; po.pz = seat[2] / rs;
  const sR = L([sd.stir[0], sd.stir[1], sd.seat[1] + sd.stir[2]]), sL = L([sd.stir[0], -sd.stir[1], sd.seat[1] + sd.stir[2]]);
  po.fR = [sR[0] / rs, sR[1] / rs, sR[2] / rs]; po.fL = [sL[0] / rs, sL[1] / rs, sL[2] / rs];
  po.tyR = 0.05; po.tyL = -0.05;
  po.lean = (po.lean || 0) - P.pitch * 0.8 + (anim === 'walk' ? 0.05 : 0);
  if (anim === 'attack') { po.yawP = (po.yawP || 0) * 0.3; }
  else if (!po.fall) { po.yawP = 0; }
  // walk: sway the weapon arm a little with the bob
  if (anim === 'walk') { const b = Math.cos(4 * PI * (frame / 8 - 0.29)) * 0.35; po.hR = [po.hR[0], po.hR[1], po.hR[2] + b]; if (R.style !== 'bow') po.hL = [po.hL[0], po.hL[1], po.hL[2] + b]; }
  po.hdYaw = po.hdYaw || 0;
  if (anim === 'death' || anim === 'corpse') { po.fall = 0; po.fallT = null; }
  const J = solveHuman(po, rs, R.build || 1);
  drawHuman(S, J, po, R, tc);
  if (anim === 'attack' && !S.buildOnly) weaponTrail(S, R, R.style, frame % 6, J, po, true);
  // reins
  if (R.style !== 'bow' && out.hp) {
    const bit = out.hp(SPECIES[kind].head.len - 1.0, 0, -0.5);
    const mid = vadd(vlerp(J.hdL, bit, 0.5), vmul(fr.U, -1.2 * sc));
    S.line([J.hdL, mid, bit], 0.55, '#2a1a10', { b: 0.5 });
  }
  return finish(S);
}
