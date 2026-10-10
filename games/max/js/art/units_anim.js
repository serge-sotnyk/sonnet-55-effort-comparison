// Pose / animation definitions for the humanoid rig. Hand targets are in the CHEST frame relative to each shoulder:
// [a forward, b right, c up] (arm length ~9.4).  Weapon directions are chest-frame vectors too.
import { newPose, solveHuman, cvec } from './units_human.js';
import { vnorm, vmad, vlen, vsub } from './units_core.js';
import { smooth, lerp, TAU } from './units_core.js';

const PI = Math.PI;
export const WALK_STRIDE = 9.5;                 // rig units between extreme foot positions
export const WALK_CYCLE_UNITS = WALK_STRIDE / 0.58;   // ground distance covered per 8-frame cycle (rig units, 40 = 1 tile)

function mk(o) { const p = newPose(); for (const k in o) p[k] = o[k]; return p; }
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = t => t * t * (3 - 2 * t);

// ---------------------------------------------------------------- walk base
function footAt(ph, stride, lift) {
  const ST = 0.58;
  if (ph < ST) { const u = ph / ST; return [stride * (0.5 - u), 0]; }
  const u = (ph - ST) / (1 - ST);
  return [stride * (-0.5 + smooth(u)), lift * Math.sin(PI * u)];
}
/** legs / pelvis / torso swing of a walk cycle; arms hanging with swing amplitude `sw` */
export function walkBase(t, o = {}) {
  const stride = o.stride || WALK_STRIDE, lift = o.lift === undefined ? 2.5 : o.lift, bob = o.bob === undefined ? 0.6 : o.bob;
  const sw = o.swing === undefined ? 3.2 : o.swing, twist = o.twist === undefined ? 0.12 : o.twist;
  const ang = TAU * t;
  const [fr, lr] = footAt(t, stride, lift), [fl, ll] = footAt((t + 0.5) % 1, stride, lift);
  const po = newPose();
  po.fR = [fr, 2.6, 1.5 + lr]; po.fL = [fl, -2.6, 1.5 + ll];
  po.tyR = 0.1; po.tyL = -0.1;
  po.pz = (o.pz || 13.0) + bob * Math.cos(4 * PI * (t - 0.29));
  po.pr = 0.4 * Math.cos(ang - TAU * 0.29);
  po.px = 0;
  po.yawP = -twist * Math.cos(ang) * 0.8;
  po.yawC = twist * 1.8 * Math.cos(ang);
  po.hdYaw = -(po.yawP + po.yawC) * 0.85;
  po.lean = (o.lean === undefined ? 0.05 : o.lean);
  po.roll = 0.03 * Math.cos(ang - TAU * 0.29);
  po.hR = [-sw * Math.cos(ang), -0.2, -8.4];
  po.hL = [sw * Math.cos(ang), 0.2, -8.4];
  po.sway = Math.sin(ang) * 0.8;
  return po;
}
export function standBase(o = {}) {
  const po = newPose();
  po.pz = o.pz || 13.7;
  po.fR = [1.0, 2.7, 1.5]; po.fL = [-0.8, -2.7, 1.5];
  po.tyR = 0.15; po.tyL = -0.15;
  po.lean = 0.03;
  return po;
}
/** set the left hand so it grips the weapon `gap` units along D from the right hand (two-handed weapons) */
function twoHand(po, gap) {
  const D = po.W.D, n = Math.hypot(D[0], D[1], D[2]) || 1;
  po.hL = [po.hR[0] + D[0] / n * gap, po.hR[1] + 8.8 + D[1] / n * gap, po.hR[2] + D[2] / n * gap];
}
function twoHandStyle(po) { po.eL = [-0.3, -0.7, -0.8]; po.eR = [-0.3, 0.7, -0.8]; }

const ATT_STANCE = { fR: [3.2, 3.0, 1.5], fL: [-3.2, -2.9, 1.5], tyR: 0.25, tyL: -0.2 };
function attackBase(o) {
  const po = mk({ pz: 12.2, fR: ATT_STANCE.fR.slice(), fL: ATT_STANCE.fL.slice(), tyR: ATT_STANCE.tyR, tyL: ATT_STANCE.tyL });
  for (const k in o) po[k] = o[k];
  return po;
}

// ---------------------------------------------------------------- styles
export const STYLES = {};

// ---- unarmed / villager
STYLES.unarmed = {
  idle() { const p = standBase(); p.hR = [0.5, -0.2, -8.4]; p.hL = [0.5, 0.2, -8.4]; return p; },
  walk(t) { return walkBase(t, { swing: 3.4 }); },
  attack(i) {
    // punch with the right fist
    const P = [
      { hR: [1.5, 1.5, -4.5], hL: [3.0, -1.0, -5.5], lean: -0.05, yawC: 0.35, pf: -0.4 },
      { hR: [-0.5, 2.0, -3.0], hL: [3.5, -1.0, -4.5], lean: -0.1, yawC: 0.55, pf: -0.8 },
      { hR: [3.5, 1.5, -3.0], hL: [3.0, -1.2, -4.5], lean: 0.05, yawC: 0.1, pf: 0.4 },
      { hR: [9.0, 0.6, -2.0], hL: [2.5, -1.5, -5.0], lean: 0.2, yawC: -0.35, pf: 1.6 },
      { hR: [7.0, 0.6, -3.0], hL: [2.5, -1.5, -5.0], lean: 0.15, yawC: -0.25, pf: 1.0 },
      { hR: [3.0, 1.2, -5.5], hL: [3.0, -1.0, -6.0], lean: 0.06, yawC: 0.05, pf: 0.2 },
    ][i];
    const p = attackBase({ hR: P.hR, hL: P.hL, lean: P.lean, yawC: P.yawC, px: P.pf * 0.7, yawP: -0.2 });
    p.hdYaw = -(p.yawP + p.yawC) * 0.8; p.eR = [-0.5, 0.7, -0.5];
    return p;
  },
};

// ---- sword + shield (also axe + shield)
function swordIdleArms(p) {
  p.hR = [4.0, 1.4, -6.0]; p.W = { hand: 'R', D: [0.4, 0.15, 0.9] };
  p.hL = [3.6, -1.0, -5.2]; p.S = { c: [1.4, -1.6, 0.4], n: [0.85, -0.5, 0.1] };
  p.eR = [-0.2, 0.9, -0.5]; p.eL = [-0.2, -0.9, -0.6];
}
STYLES.sword1 = {
  idle() { const p = standBase(); swordIdleArms(p); return p; },
  walk(t) {
    const p = walkBase(t, { swing: 0 });
    swordIdleArms(p);
    const b = 0.35 * Math.cos(4 * PI * (t - 0.29));
    p.hR[2] += b; p.hL[2] += b;
    p.W.D = [0.4 + 0.08 * Math.sin(TAU * t), 0.15, 0.9];
    return p;
  },
  attack(i) {
    const K = [
      { hR: [1.0, 2.2, 4.5], D: [-0.15, 0.2, 1.0], lean: -0.06, yawC: 0.3, px: -0.4, hL: [4.0, -1.0, -3.5], sn: [0.9, -0.4, 0.1] },
      { hR: [-1.8, 2.6, 7.5], D: [-0.7, 0.2, 0.7], lean: -0.12, yawC: 0.55, px: -0.8, hL: [4.3, -1.0, -3.0], sn: [0.9, -0.4, 0.1] },
      { hR: [3.0, 1.6, 6.5], D: [0.5, 0.1, 0.85], lean: 0.04, yawC: 0.15, px: 0.2, hL: [4.5, -1.2, -3.2], sn: [0.9, -0.4, 0.1] },
      { hR: [8.2, 0.4, -1.5], D: [0.95, -0.05, -0.3], lean: 0.2, yawC: -0.35, px: 1.5, hL: [5.0, -1.5, -3.5], sn: [0.95, -0.3, 0.05] },
      { hR: [5.8, -2.0, -5.5], D: [0.5, -0.7, -0.5], lean: 0.26, yawC: -0.5, px: 1.2, hL: [4.8, -1.4, -3.8], sn: [0.95, -0.3, 0.05] },
      { hR: [4.2, 1.0, -5.5], D: [0.4, 0.15, 0.9], lean: 0.08, yawC: -0.1, px: 0.4, hL: [4.0, -1.0, -4.8], sn: [0.9, -0.4, 0.1] },
    ][i];
    const p = attackBase({ hR: K.hR, hL: K.hL, lean: K.lean, yawC: K.yawC, px: K.px * 0.6, yawP: -0.18 });
    p.W = { hand: 'R', D: K.D }; p.S = { c: [1.4, -1.6, 0.4], n: K.sn };
    p.hdYaw = -(p.yawP + p.yawC) * 0.8; p.eR = [-0.4, 0.8, -0.2];
    return p;
  },
};

// ---- two-handed sword
STYLES.sword2 = {
  idle() { const p = standBase(); p.hR = [3.4, 1.0, -5.0]; p.W = { hand: 'R', D: [0.5, 0.2, 0.84] }; twoHand(p, -3.2); twoHandStyle(p); return p; },
  walk(t) {
    const p = walkBase(t, { swing: 0, twist: 0.08 });
    p.hR = [3.4, 1.0, -5.0 + 0.3 * Math.cos(4 * PI * (t - 0.29))]; p.W = { hand: 'R', D: [0.5, 0.2, 0.84] }; twoHand(p, -3.2); twoHandStyle(p);
    return p;
  },
  attack(i) {
    const K = [
      { hR: [1.0, 1.6, 5.0], D: [-0.35, 0.1, 0.93], lean: -0.06, yawC: 0.25, px: -0.4 },
      { hR: [-1.2, 1.4, 8.0], D: [-0.8, 0.1, 0.6], lean: -0.14, yawC: 0.4, px: -0.8 },
      { hR: [2.8, 1.0, 6.8], D: [0.35, 0.05, 0.93], lean: 0.02, yawC: 0.1, px: 0.2 },
      { hR: [7.6, 0.3, -2.0], D: [0.8, 0.0, -0.6], lean: 0.22, yawC: -0.2, px: 1.6 },
      { hR: [6.0, 0.2, -5.5], D: [0.45, 0.1, -0.88], lean: 0.3, yawC: -0.25, px: 1.4 },
      { hR: [3.6, 1.0, -4.6], D: [0.5, 0.2, 0.84], lean: 0.1, yawC: -0.1, px: 0.5 },
    ][i];
    const p = attackBase({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.px * 0.6, yawP: -0.15 });
    p.W = { hand: 'R', D: K.D }; twoHand(p, -3.2); twoHandStyle(p);
    p.hdYaw = -(p.yawP + p.yawC) * 0.8;
    return p;
  },
};

// ---- one-hand spear (+ shield)
function spearIdle(p, sh) {
  p.hR = [3.8, 1.6, -6.0]; p.W = { hand: 'R', D: [0.1, 0.04, 1.0] };
  p.hL = [3.4, -1.0, -5.5]; p.S = sh ? { c: [1.4, -1.6, 0.4], n: [0.85, -0.5, 0.1] } : null;
  p.eR = [-0.2, 0.9, -0.5];
}
STYLES.spear = {
  idle() { const p = standBase(); spearIdle(p, true); return p; },
  walk(t) { const p = walkBase(t, { swing: 0 }); spearIdle(p, true); const b = 0.3 * Math.cos(4 * PI * (t - 0.29)); p.hR[2] += b; p.hL[2] += b; return p; },
  attack(i) {
    const K = [
      { hR: [1.5, 1.5, -3.0], D: [0.8, 0.08, 0.55], lean: -0.04, yawC: 0.35, px: -0.2 },
      { hR: [-1.5, 1.4, -4.0], D: [0.92, 0.08, 0.38], lean: -0.1, yawC: 0.5, px: -0.8 },
      { hR: [-3.0, 1.2, -4.4], D: [0.94, 0.08, 0.3], lean: -0.12, yawC: 0.6, px: -1.0 },
      { hR: [8.0, 0.6, -3.4], D: [0.96, 0.05, 0.22], lean: 0.2, yawC: -0.3, px: 1.8 },
      { hR: [8.6, 0.6, -3.5], D: [0.96, 0.05, 0.2], lean: 0.22, yawC: -0.3, px: 1.8 },
      { hR: [4.5, 1.4, -5.5], D: [0.35, 0.06, 0.93], lean: 0.08, yawC: 0.0, px: 0.6 },
    ][i];
    const p = attackBase({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.px * 0.6, yawP: -0.15 });
    p.W = { hand: 'R', D: K.D };
    p.hL = [3.8, -1.2, -4.0]; p.S = { c: [1.4, -1.6, 0.4], n: [0.9, -0.4, 0.1] };
    p.hdYaw = -(p.yawP + p.yawC) * 0.8; p.eR = [-0.4, 0.8, -0.2];
    return p;
  },
};
// ---- pike / halberd (two-handed polearms, no shield)
function poleIdle(p, gap, up) {
  p.hR = [3.4, 1.6, -6.4]; p.W = { hand: 'R', D: [0.08, 0.04, 1.0] }; twoHand(p, gap); twoHandStyle(p);
}
STYLES.pike = {
  idle() { const p = standBase(); poleIdle(p, 4.5); return p; },
  walk(t) { const p = walkBase(t, { swing: 0 }); poleIdle(p, 4.5); const b = 0.3 * Math.cos(4 * PI * (t - 0.29)); p.hR[2] += b; p.hL[2] += b; return p; },
  attack(i) {
    const K = [
      { hR: [1.5, 1.5, -3.6], D: [0.7, 0.05, 0.7], lean: -0.04, yawC: 0.3, px: -0.2 },
      { hR: [-0.5, 1.4, -4.2], D: [0.9, 0.05, 0.42], lean: -0.08, yawC: 0.4, px: -0.6 },
      { hR: [-2.0, 1.3, -4.6], D: [0.94, 0.05, 0.32], lean: -0.1, yawC: 0.45, px: -0.9 },
      { hR: [6.0, 0.8, -4.0], D: [0.96, 0.03, 0.26], lean: 0.18, yawC: -0.2, px: 1.8 },
      { hR: [6.8, 0.8, -4.0], D: [0.96, 0.03, 0.24], lean: 0.2, yawC: -0.2, px: 1.8 },
      { hR: [4.0, 1.5, -5.6], D: [0.3, 0.05, 0.95], lean: 0.08, yawC: 0.0, px: 0.6 },
    ][i];
    const p = attackBase({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.px * 0.6, yawP: -0.15 });
    p.W = { hand: 'R', D: K.D }; twoHand(p, 6.0); twoHandStyle(p);
    p.hdYaw = -(p.yawP + p.yawC) * 0.8;
    return p;
  },
};
STYLES.halberd = {
  idle() { const p = standBase(); poleIdle(p, 4.5); return p; },
  walk(t) { const p = walkBase(t, { swing: 0 }); poleIdle(p, 4.5); const b = 0.3 * Math.cos(4 * PI * (t - 0.29)); p.hR[2] += b; p.hL[2] += b; return p; },
  attack(i) {
    const K = [
      { hR: [1.5, 1.6, 2.0], D: [-0.2, 0.05, 1.0], lean: -0.06, yawC: 0.3, px: -0.4, gap: 5.5 },
      { hR: [-0.5, 1.4, 6.0], D: [-0.7, 0.05, 0.7], lean: -0.14, yawC: 0.45, px: -0.8, gap: 5.5 },
      { hR: [2.8, 1.0, 5.4], D: [0.3, 0.05, 0.95], lean: 0.0, yawC: 0.1, px: 0.2, gap: 5.5 },
      { hR: [7.0, 0.5, -3.0], D: [0.7, 0.0, -0.7], lean: 0.24, yawC: -0.2, px: 1.6, gap: 5.5 },
      { hR: [5.4, 0.4, -5.8], D: [0.35, 0.05, -0.9], lean: 0.3, yawC: -0.25, px: 1.4, gap: 5.5 },
      { hR: [3.8, 1.4, -5.0], D: [0.3, 0.05, 0.95], lean: 0.1, yawC: -0.1, px: 0.5, gap: 5.5 },
    ][i];
    const p = attackBase({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.px * 0.6, yawP: -0.15 });
    p.W = { hand: 'R', D: K.D }; twoHand(p, K.gap); twoHandStyle(p);
    p.hdYaw = -(p.yawP + p.yawC) * 0.8;
    return p;
  },
};

// ---- bows
function bowIdle(p) {
  p.hL = [3.2, -1.2, -6.4]; p.W = { hand: 'L', D: [0.2, 0.0, 1.0], T: [-1, 0, 0] };
  p.hR = [0.8, 0.8, -9.0]; p.X = { pull: 0, arrow: false };
  p.eL = [-0.2, -0.9, -0.6];
}
STYLES.bow = {
  idle() { const p = standBase(); bowIdle(p); return p; },
  walk(t) { const p = walkBase(t, { swing: 2.2 }); bowIdle(p); p.hR = [-2.2 * Math.cos(TAU * t), 0.8, -9.0]; p.hL[2] += 0.3 * Math.cos(4 * PI * (t - 0.29)); return p; },
  attack(i) {
    // body turned ~55deg so the bow arm points at the target; target direction in chest frame ~ (0.55, -0.83, 0)
    const yc = 1.0, tg = [Math.cos(yc), -Math.sin(yc), 0];
    const K = [
      { pull: 0.15, arrow: true, hRp: [2.6, -1.5, -1.5], bz: -1.5, tilt: 0.1 },
      { pull: 0.55, arrow: true, hRp: [1.8, -3.0, 0.8], bz: -0.5, tilt: 0.05 },
      { pull: 1.0, arrow: true, hRp: [1.4, -3.6, 2.0], bz: 0.3, tilt: 0.0 },
      { pull: 0.08, arrow: false, hRp: [0.2, -3.0, 2.0], bz: 0.3, tilt: -0.02 },
      { pull: 0.0, arrow: false, hRp: [1.2, -1.5, -1.0], bz: -0.8, tilt: 0.04 },
      { pull: 0.0, arrow: false, hRp: [2.4, -1.0, -3.0], bz: -2.0, tilt: 0.08 },
    ][i];
    const reach = 8.4;
    const p = mk({ pz: 12.4, fR: [-0.5, 4.4, 1.5], fL: [3.6, -3.8, 1.5], tyR: 1.2, tyL: -0.25, yawP: 0.55, yawC: yc - 0.55, lean: 0.0, px: 0 });
    p.hL = [tg[0] * reach, tg[1] * reach, K.bz + 1.0]; p.hR = K.hRp;
    p.eL = [0.3, -0.2, -1.0]; p.eR = [-0.6, 0.5, -0.4];
    p.hdYaw = -yc * 0.98; p.hdPitch = 0.0;
    p.W = { hand: 'L', D: [0.0, 0.0, 1.0], T: [-tg[0], -tg[1], 0] };
    p.X = { pull: K.pull, arrow: K.arrow };
    return p;
  },
};
STYLES.longbow = {
  idle() { const p = standBase(); bowIdle(p); p.hL = [3.0, -1.6, -6.0]; return p; },
  walk(t) { return STYLES.bow.walk(t); },
  attack(i) { return STYLES.bow.attack(i); },
};
STYLES.crossbow = {
  idle() { const p = standBase(); p.hR = [3.4, 1.2, -6.2]; p.W = { hand: 'R', D: [0.9, 0.0, 0.35] }; p.hL = [6.5, -0.8, -4.2]; p.X = { pull: 0, arrow: false, loaded: true }; p.eL = [-0.2, -0.8, -0.8]; p.eR = [-0.3, 0.9, -0.6]; return p; },
  walk(t) { const p = walkBase(t, { swing: 0, twist: 0.07 }); p.hR = [3.4, 1.2, -6.2 + 0.3 * Math.cos(4 * PI * (t - 0.29))]; p.W = { hand: 'R', D: [0.9, 0.0, 0.35] }; p.hL = [6.5, -0.8, -4.2]; p.X = { pull: 0, loaded: true }; p.eL = [-0.2, -0.8, -0.8]; p.eR = [-0.3, 0.9, -0.6]; return p; },
  attack(i) {
    const K = [
      { hR: [3.4, 1.2, -4.8], hL: [6.8, -0.8, -3.6], D: [0.93, 0, 0.3], loaded: true, lean: 0.0 },
      { hR: [3.6, 1.2, -2.6], hL: [7.4, -0.8, -1.8], D: [0.98, 0, 0.12], loaded: true, lean: 0.02 },
      { hR: [3.6, 1.0, -0.8], hL: [7.8, -0.6, -0.6], D: [1, 0, 0.03], loaded: true, lean: 0.04 },
      { hR: [2.8, 1.0, -0.9], hL: [7.2, -0.6, -0.7], D: [0.99, 0, 0.08], loaded: false, lean: 0.0, rec: 1 },
      { hR: [3.4, 1.2, -4.5], hL: [5.6, -0.8, -5.2], D: [0.55, 0, -0.7], loaded: false, lean: 0.06 },
      { hR: [3.4, 1.2, -5.5], hL: [5.4, -0.8, -5.8], D: [0.45, 0, -0.85], loaded: false, lean: 0.06 },
    ][i];
    const p = mk({ pz: 12.5, fR: [2.4, 3.2, 1.5], fL: [-2.8, -3.0, 1.5], tyR: 0.2, tyL: -0.2, yawP: -0.1, yawC: 0.0, lean: K.lean });
    p.hR = K.hR; p.hL = K.hL; p.W = { hand: 'R', D: K.D };
    p.X = { pull: 0, arrow: false, loaded: K.loaded, rec: K.rec || 0, crank: i >= 4 };
    p.eL = [-0.2, -0.8, -0.6]; p.eR = [-0.3, 0.9, -0.5];
    p.hdYaw = 0.1;
    return p;
  },
};

// ---- javelin / throwing axe
function throwIdle(p) { p.hR = [3.8, 1.6, -6.2]; p.W = { hand: 'R', D: [0.12, 0.05, 1.0] }; p.hL = [0.8, -0.8, -9.0]; p.eR = [-0.2, 0.9, -0.5]; }
function throwStyle(throwKind) {
  return {
    idle() { const p = standBase(); throwIdle(p); return p; },
    walk(t) { const p = walkBase(t, { swing: 2.6 }); throwIdle(p); p.hL = [2.6 * Math.cos(TAU * t), -0.8, -9.0]; p.hR[2] += 0.3 * Math.cos(4 * PI * (t - 0.29)); return p; },
    attack(i) {
      const jav = throwKind === 'javelin';
      const K = [
        { hR: [1.5, 2.0, 1.5], D: jav ? [0.9, 0.08, 0.42] : [0.2, 0.1, 1.0], lean: -0.08, yawC: 0.35, px: -0.4, show: true },
        { hR: [-2.0, 2.6, 3.0], D: jav ? [0.95, 0.05, 0.3] : [-0.5, 0.1, 0.86], lean: -0.14, yawC: 0.55, px: -0.8, show: true },
        { hR: [-1.5, 2.2, 6.5], D: jav ? [0.9, 0.05, 0.43] : [-0.6, 0.1, 0.8], lean: -0.1, yawC: 0.45, px: -0.4, show: true },
        { hR: [7.8, 0.6, 5.0], D: jav ? [0.93, 0.05, 0.36] : [0.8, 0.0, 0.6], lean: 0.2, yawC: -0.3, px: 1.6, show: true },
        { hR: [6.5, -0.8, -1.0], D: [0.6, -0.5, -0.6], lean: 0.26, yawC: -0.4, px: 1.4, show: false },
        { hR: [3.8, 1.4, -5.8], D: [0.15, 0.05, 1.0], lean: 0.08, yawC: -0.05, px: 0.4, show: true },
      ][i];
      const p = attackBase({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.px * 0.6, yawP: -0.2 });
      p.W = { hand: 'R', D: K.D, show: K.show };
      p.hL = [i === 3 || i === 4 ? 2.0 : 4.0, -3.0, i === 3 ? 0.0 : -3.5]; p.eL = [-0.2, -0.9, -0.6];
      p.hdYaw = -(p.yawP + p.yawC) * 0.8; p.eR = [-0.5, 0.8, -0.3];
      return p;
    },
  };
}
STYLES.javelin = throwStyle('javelin');
STYLES.throwaxe = throwStyle('axe');

// ---- monk
STYLES.staff = {
  idle() { const p = standBase(); p.hR = [3.0, 1.6, -6.0]; p.W = { hand: 'R', D: [0.06, 0.03, 1.0] }; p.hL = [4.2, -0.4, -5.0]; p.eL = [-0.2, -0.8, -0.8]; return p; },
  walk(t) { const p = walkBase(t, { swing: 0, stride: 8, lift: 1.8, twist: 0.06 }); p.hR = [3.0, 1.6, -6.0 + 0.25 * Math.cos(4 * PI * (t - 0.29))]; p.W = { hand: 'R', D: [0.06, 0.03, 1.0] }; p.hL = [4.2, -0.4, -5.0]; p.eL = [-0.2, -0.8, -0.8]; return p; },
  attack(i) {
    const K = [
      { hR: [3.0, 1.6, -5.0], hL: [4.2, -1.0, -3.6], D: [0.06, 0.03, 1.0], glow: 0.0, lean: -0.02 },
      { hR: [3.4, 1.6, -2.5], hL: [4.0, -2.2, 0.5], D: [0.1, 0.05, 1.0], glow: 0.45, lean: -0.06 },
      { hR: [3.6, 1.6, 0.5], hL: [3.6, -2.6, 4.5], D: [0.12, 0.05, 1.0], glow: 0.85, lean: -0.1 },
      { hR: [3.8, 1.6, 2.5], hL: [3.4, -2.8, 6.5], D: [0.15, 0.05, 1.0], glow: 1.0, lean: -0.12 },
      { hR: [3.5, 1.6, 0.0], hL: [3.8, -2.4, 3.0], D: [0.1, 0.05, 1.0], glow: 0.7, lean: -0.06 },
      { hR: [3.0, 1.6, -4.0], hL: [4.2, -1.0, -3.0], D: [0.06, 0.03, 1.0], glow: 0.25, lean: 0.0 },
    ][i];
    const p = mk({ pz: 12.8, fR: [1.2, 2.7, 1.5], fL: [-1.0, -2.7, 1.5], lean: K.lean, hR: K.hR, hL: K.hL });
    p.W = { hand: 'R', D: K.D }; p.X = { glow: K.glow }; p.eL = [-0.3, -0.5, -0.4];
    p.hdPitch = -K.glow * 0.15;
    return p;
  },
};

// ---------------------------------------------------------------- villager work
function workStance(o) {
  return mk(Object.assign({ pz: 12.0, fR: [3.0, 3.0, 1.5], fL: [-3.0, -3.0, 1.5], tyR: 0.2, tyL: -0.2, yawP: -0.15 }, o));
}
export const WORK = {
  chop(i) {
    const K = [
      { hR: [0.5, 1.5, 6.0], D: [-0.55, 0.1, 0.83], lean: -0.04, yawC: 0.25 },
      { hR: [-0.5, 1.5, 7.5], D: [-0.3, 0.1, 0.95], lean: -0.1, yawC: 0.3 },
      { hR: [3.5, 1.2, 4.5], D: [0.45, 0.1, 0.88], lean: 0.05, yawC: 0.1 },
      { hR: [7.0, 0.6, -3.0], D: [0.8, 0.1, -0.55], lean: 0.3, yawC: -0.2 },
      { hR: [6.5, 0.6, -4.0], D: [0.75, 0.1, -0.6], lean: 0.32, yawC: -0.2 },
      { hR: [3.0, 1.2, 0.5], D: [0.35, 0.1, 0.92], lean: 0.12, yawC: 0.0 },
    ][i];
    const p = workStance({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.lean * 2 });
    p.W = { hand: 'R', D: K.D, tool: 'axe' }; twoHand(p, -3.0); twoHandStyle(p); p.hdYaw = -(p.yawP + p.yawC) * 0.8;
    return p;
  },
  mine(i) {
    const K = [
      { hR: [0.5, 1.4, 5.5], D: [-0.6, 0.1, 0.8], lean: -0.06, yawC: 0.25 },
      { hR: [-1.0, 1.4, 8.0], D: [-0.4, 0.1, 0.9], lean: -0.14, yawC: 0.3 },
      { hR: [3.0, 1.2, 5.5], D: [0.4, 0.1, 0.9], lean: 0.04, yawC: 0.1 },
      { hR: [6.8, 0.6, -4.0], D: [0.85, 0.1, -0.5], lean: 0.32, yawC: -0.2 },
      { hR: [6.0, 0.6, -4.6], D: [0.8, 0.1, -0.55], lean: 0.3, yawC: -0.2 },
      { hR: [2.5, 1.2, 1.0], D: [0.2, 0.1, 0.95], lean: 0.1, yawC: 0.0 },
    ][i];
    const p = workStance({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.lean * 2 });
    p.W = { hand: 'R', D: K.D, tool: 'pickaxe' }; twoHand(p, -3.0); twoHandStyle(p); p.hdYaw = -(p.yawP + p.yawC) * 0.8;
    return p;
  },
  farm(i) {
    const K = [
      { hR: [1.5, 1.4, 3.5], D: [-0.25, 0.05, 0.97], lean: 0.05, yawC: 0.1 },
      { hR: [0.5, 1.4, 6.0], D: [-0.2, 0.05, 0.98], lean: 0.0, yawC: 0.15 },
      { hR: [3.5, 1.2, 4.5], D: [0.35, 0.05, 0.93], lean: 0.12, yawC: 0.0 },
      { hR: [6.5, 0.8, -4.0], D: [0.6, 0.05, -0.8], lean: 0.38, yawC: -0.1 },
      { hR: [4.5, 0.8, -5.0], D: [0.4, 0.05, -0.9], lean: 0.4, yawC: -0.1 },
      { hR: [3.0, 1.2, -1.0], D: [0.0, 0.05, 1.0], lean: 0.2, yawC: 0.0 },
    ][i];
    const p = workStance({ hR: K.hR, lean: K.lean, yawC: K.yawC, px: K.lean * 2 });
    p.W = { hand: 'R', D: K.D, tool: 'hoe' }; twoHand(p, -4.2); twoHandStyle(p); p.hdYaw = -(p.yawP + p.yawC) * 0.8;
    return p;
  },
  forage(i) {
    const bush = [7.6, 1.2, -6.8], basket = [4.0, -1.4, -8.6];
    const K = [
      { h: bush, up: 0.0 }, { h: [7.8, 1.0, -7.4], up: 0.0 }, { h: [6.2, 0.8, -6.2], up: 0.5 }, { h: basket, up: 0.8 }, { h: [5.6, 0.6, -7.0], up: 0.3 }, { h: [7.4, 1.0, -6.6], up: 0.0 },
    ][i];
    const p = workStance({ lean: 0.5, px: 1.4, pz: 11.6, hR: K.h, yawC: 0.05 });
    p.hL = [3.8, -1.2, -8.0]; p.eL = [-0.2, -0.9, -0.6];
    p.W = null; p.X = { basket: true, bite: i === 3 };
    p.hdPitch = 0.35;
    return p;
  },
  butcher(i) {
    const K = [
      { hR: [5.5, 1.0, -4.0], D: [0.6, 0.0, -0.3], lean: 0.4 },
      { hR: [6.2, 1.0, -2.0], D: [0.5, 0.0, 0.5], lean: 0.38 },
      { hR: [6.6, 0.8, -4.4], D: [0.6, 0.0, -0.6], lean: 0.42 },
      { hR: [7.4, 0.6, -8.4], D: [0.7, 0.0, -0.7], lean: 0.5 },
      { hR: [6.0, 0.6, -7.0], D: [0.55, 0.0, -0.45], lean: 0.46 },
      { hR: [5.4, 1.0, -5.0], D: [0.6, 0.0, -0.2], lean: 0.42 },
    ][i];
    const p = workStance({ hR: K.hR, lean: K.lean, px: K.lean * 2.0, pz: 11.8 });
    p.hL = [7.0, -1.2, -8.0]; p.eL = [-0.3, -0.7, -0.6];
    p.W = { hand: 'R', D: K.D, tool: 'knife' };
    p.hdPitch = 0.3;
    return p;
  },
  build(i) {
    const K = [
      { hR: [3.5, 1.2, 3.0], D: [0.5, 0.0, 0.85], lean: 0.1 },
      { hR: [2.5, 1.2, 6.5], D: [-0.1, 0.0, 1.0], lean: 0.02 },
      { hR: [4.5, 1.0, 3.0], D: [0.5, 0.0, 0.85], lean: 0.12 },
      { hR: [7.4, 0.8, -6.4], D: [0.85, 0.0, -0.5], lean: 0.32 },
      { hR: [6.0, 0.8, -4.0], D: [0.75, 0.0, -0.1], lean: 0.26 },
      { hR: [4.0, 1.2, -0.5], D: [0.55, 0.0, 0.8], lean: 0.18 },
    ][i];
    const p = workStance({ hR: K.hR, lean: K.lean, px: K.lean * 1.8, pz: 11.9 });
    p.hL = [7.0, -1.0, -6.0]; p.eL = [-0.3, -0.8, -0.5];
    p.W = { hand: 'R', D: K.D, tool: 'hammer' };
    p.X = { plank: true };
    p.hdPitch = 0.2;
    return p;
  },
};

// ---------------------------------------------------------------- death
const FALL = [0.10, 0.40, 0.82, 1.2, 1.48, Math.PI / 2];
export function deathPose(i, idle) {
  const p = idle;
  const t = i / 5, phi = FALL[i];
  // arms flail outward then rest spread
  const spread = Math.min(1, t * 1.6), flail = Math.sin(Math.min(1, t * 1.4) * PI) * 2.0;
  p.hR = [lerp(p.hR[0], -1.5, spread), lerp(p.hR[1], 8.2, spread), lerp(p.hR[2], -4.0 + flail * 2.5, spread)];
  p.hL = [lerp(p.hL[0], -1.5, spread), lerp(p.hL[1], -8.2, spread), lerp(p.hL[2], -4.0 + flail * 2.0, spread)];
  p.eR = [-0.3, 0.9, -0.1]; p.eL = [-0.3, -0.9, -0.1];
  if (p.W) { p.W = Object.assign({}, p.W, { D: [lerp(p.W.D[0], 0.0, spread), lerp(p.W.D[1], 0.2, spread), lerp(p.W.D[2], -1.0, spread)], show: p.W.show }); }
  if (p.S) { p.S = { c: [1.4, -1.6, 0.4], n: [lerp(p.S.n[0], 0.1, spread), lerp(p.S.n[1], -0.9, spread), lerp(p.S.n[2], 0.2, spread)] }; }
  p.lean = lerp(p.lean || 0, -0.1, t);
  p.hdPitch = lerp(0, -0.45, t);
  p.hdYaw = 0;
  p.fR = [lerp(p.fR[0], 0.4, t), lerp(p.fR[1], 3.1, t), p.fR[2]]; p.fL = [lerp(p.fL[0], -0.8, t), lerp(p.fL[1], -3.1, t), p.fL[2]];
  p.pz = lerp(p.pz, 12.4, t);
  p.fall = phi;
  p.fallT = [-1.8 * Math.sin(phi), 0, 3.0 * Math.sin(phi)];
  p.noSway = true;
  p.X = Object.assign({}, p.X || {}, { dead: true });
  return p;
}

// ---------------------------------------------------------------- dispatcher
export function humanPose(style, anim, frame) {
  const st = STYLES[style] || STYLES.unarmed;
  switch (anim) {
    case 'walk': return st.walk(frame / 8);
    case 'attack': return st.attack(frame % 6);
    case 'death': return deathPose(frame % 6, st.idle());
    case 'corpse': return deathPose(5, st.idle());
    case 'chop': case 'mine': case 'farm': case 'forage': case 'butcher': case 'build': return WORK[anim](frame % 6);
    default: return st.idle();
  }
}

/** icon/portrait renders: tilt long weapons outward so they do not cut across the face */
export function iconAdjust(po) {
  const W = po.W;
  if (!W || W.show === false) return po;
  const D = W.D;
  if (D[2] > 0.7 && !W.tool) {
    W.D = [D[0] * 0.55, D[1] + (W.hand === 'L' ? -0.5 : 0.5), D[2]];
    if (W.hand === 'L' && W.T) W.T = [W.T[0], W.T[1], W.T[2]];
  }
  return po;
}

/** translucent swing / thrust streak between the previous and the current weapon position (attack frames 2-4); drawn after the outline */
export function weaponTrail(S, L, style, frame, J, po, rider) {
  const spec = L.weapon, W = po.W;
  if (!spec || !W || W.show === false || frame < 2 || frame > 4) return;
  const k = spec.kind;
  if (k !== 'sword' && k !== 'greatsword' && k !== 'spear' && k !== 'halberd') return;
  const st = STYLES[style];
  if (!st || !st.attack) return;
  const pp = st.attack(frame - 1);
  if (!pp.W) return;
  if (rider) { pp.px = po.px; pp.pr = po.pr; pp.pz = po.pz; pp.fR = po.fR; pp.fL = po.fL; pp.lean = (po.lean || 0) + (pp.lean - st.attack(frame).lean); }
  const Jp = solveHuman(pp, L.sc, L.build || 1);
  const s = J.s;
  let a0, a1;
  if (k === 'sword') { const len = (spec.len || 13); a0 = (1.4 + len * 0.4) * s; a1 = (1.4 + len) * s; }
  else if (k === 'greatsword') { const len = (spec.len || 20); a0 = (5.2 + len * 0.35) * s; a1 = (5.2 + len) * s; }
  else if (k === 'spear') { const len = (spec.len || 40) * s, gf = spec.grip !== undefined ? spec.grip : 0.36; a1 = len * (1 - gf); a0 = a1 - len * 0.2; }
  else { const len = (spec.len || 40) * s; a1 = len * (1 - (spec.grip !== undefined ? spec.grip : 0.4)); a0 = a1 - 9 * s; }
  const G = W.hand === 'L' ? J.hdL : J.hdR, Gp = pp.W.hand === 'L' ? Jp.hdL : Jp.hdR;
  const D = vnorm(cvec(J, W.D)), Dp = vnorm(cvec(Jp, pp.W.D));
  const tipN = vmad(G, D, a1), baseN = vmad(G, D, a0), tipP = vmad(Gp, Dp, a1), baseP = vmad(Gp, Dp, a0);
  if (vlen(vsub(tipN, tipP)) < 1.5) return;
  const q = [S.P(tipP), S.P(tipN), S.P(baseN), S.P(baseP)];
  for (const p of q) S.ext(p[0], p[1], 1);
  const alpha = frame === 3 ? 0.42 : 0.26;
  S.fn(S.dp(S.tv(tipN)) + 1, ctx => {
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.closePath();
    const g = ctx.createLinearGradient(q[0][0], q[0][1], q[1][0], q[1][1]);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,' + alpha + ')');
    ctx.fillStyle = g; ctx.fill();
  }, true);
}
