// Humanoid rig: skeleton solve (2-bone IK limbs), dressing (torso/legs/arms/heads/hats), weapons, shields, back items.
import {
  Scene, V, vadd, vsub, vmul, vmad, vdot, vlen, vnorm, vlerp, vcross, vyaw, vpitch, vroll, ik2, clamp, lerp, smooth, TAU,
  ramp, rampOf, mixHex, shadeHex, KS, basisOf,
} from './units_core.js';

// skeleton at scale 1 (units ~ px of height)
export const SK = { hipZ: 13.6, thigh: 6.5, shin: 6.3, ankle: 1.5, hipW: 2.2, shW: 4.0, spine: 8.2, headR: 3.7, upArm: 4.9, foreArm: 4.6 };

export function newPose() {
  return {
    px: 0, pr: 0, pz: 13.6, yawP: 0, yawC: 0, lean: 0, roll: 0, hdYaw: 0, hdPitch: 0,
    fR: [0.8, 2.6, 1.5], fL: [-0.8, -2.6, 1.5], tyR: 0.12, tyL: -0.12,
    hR: [0.5, -0.2, -9.0], hL: [0.5, 0.2, -9.0],          // hand targets relative to shoulders, in the chest frame (a fwd, b right, c up)
    eR: null, eL: null,                                    // optional elbow pole overrides (chest frame)
    W: null, S: null, X: null,                             // weapon dir/state, shield state, extras
    fall: 0,
  };
}

/** Solve all joints for a pose. Returns J (rig-space joint positions + frames). */
export function solveHuman(po, sc = 1, build = 1) {
  const s = sc, J = { s, build };
  const shW = SK.shW * (0.5 + 0.5 * build);
  const P = [po.px * s, po.pr * s, po.pz * s];
  const yp = po.yawP || 0, yc = yp + (po.yawC || 0);
  const Fp = [Math.cos(yp), Math.sin(yp), 0], Rp = [-Math.sin(yp), Math.cos(yp), 0];
  const Uc = vnorm(vyaw(vroll(vpitch([0, 0, 1], po.lean || 0), po.roll || 0), yp));
  let Fc = [Math.cos(yc), Math.sin(yc), 0];
  Fc = vnorm(vsub(Fc, vmul(Uc, vdot(Fc, Uc))));
  const Rc = vcross(Uc, Fc);
  J.P = P; J.Fp = Fp; J.Rp = Rp; J.Uc = Uc; J.Fc = Fc; J.Rc = Rc;
  J.hipR = vmad(P, Rp, SK.hipW * s); J.hipL = vmad(P, Rp, -SK.hipW * s);
  J.s0 = vmad(P, Uc, SK.spine * s);
  J.shR = vmad(vmad(J.s0, Rc, shW * s), Uc, -0.5 * s);
  J.shL = vmad(vmad(J.s0, Rc, -shW * s), Uc, -0.5 * s);
  // head frame
  const hy = po.hdYaw || 0, hp = po.hdPitch || 0;
  const F1 = vadd(vmul(Fc, Math.cos(hy)), vmul(Rc, Math.sin(hy))), R1 = vsub(vmul(Rc, Math.cos(hy)), vmul(Fc, Math.sin(hy)));
  J.hf = vsub(vmul(F1, Math.cos(hp)), vmul(Uc, Math.sin(hp)));
  J.hu = vadd(vmul(Uc, Math.cos(hp)), vmul(F1, Math.sin(hp)));
  J.hr = R1;
  J.hc = vmad(vmad(J.s0, Uc, 1.2 * s), J.hu, SK.headR * 1.0 * s);
  // legs
  J.aR = [po.fR[0] * s, po.fR[1] * s, po.fR[2] * s]; J.aL = [po.fL[0] * s, po.fL[1] * s, po.fL[2] * s];
  J.kR = ik2(J.hipR, J.aR, SK.thigh * s, SK.shin * s, vadd(Fp, vmul(Rp, 0.2)));
  J.kL = ik2(J.hipL, J.aL, SK.thigh * s, SK.shin * s, vsub(Fp, vmul(Rp, 0.2)));
  const tR = vyaw([1, 0, 0], yp + po.tyR), tL = vyaw([1, 0, 0], yp + po.tyL);
  J.tdR = tR; J.tdL = tL;
  J.toeR = [J.aR[0] + tR[0] * 3.3 * s, J.aR[1] + tR[1] * 3.3 * s, 0.95 * s];
  J.toeL = [J.aL[0] + tL[0] * 3.3 * s, J.aL[1] + tL[1] * 3.3 * s, 0.95 * s];
  // arms
  const rel = (sh, h) => vadd(sh, vadd(vmul(Fc, h[0] * s), vadd(vmul(Rc, h[1] * s), vmul(Uc, h[2] * s))));
  J.hdR = rel(J.shR, po.hR); J.hdL = rel(J.shL, po.hL);
  const poleR = po.eR ? vadd(vmul(Fc, po.eR[0]), vadd(vmul(Rc, po.eR[1]), vmul(Uc, po.eR[2]))) : vadd(vmul(Fc, -0.25), vadd(vmul(Rc, 0.9), vmul(Uc, -0.55)));
  const poleL = po.eL ? vadd(vmul(Fc, po.eL[0]), vadd(vmul(Rc, po.eL[1]), vmul(Uc, po.eL[2]))) : vadd(vmul(Fc, -0.25), vadd(vmul(Rc, -0.9), vmul(Uc, -0.55)));
  J.eR = ik2(J.shR, J.hdR, SK.upArm * s, SK.foreArm * s, poleR);
  J.eL = ik2(J.shL, J.hdL, SK.upArm * s, SK.foreArm * s, poleL);
  // clamp hands to what the IK could reach (keeps weapon attached to the visible hand)
  J.hdR = clampReach(J.shR, J.hdR, (SK.upArm + SK.foreArm) * 0.999 * s);
  J.hdL = clampReach(J.shL, J.hdL, (SK.upArm + SK.foreArm) * 0.999 * s);
  return J;
}
function clampReach(S, T, maxd) { const d = vsub(T, S), l = vlen(d); return l > maxd ? vadd(S, vmul(d, maxd / l)) : T; }
/** chest-frame vector -> rig vector */
export function cvec(J, a) { return vadd(vmul(J.Fc, a[0]), vadd(vmul(J.Rc, a[1]), vmul(J.Uc, a[2]))); }

// ------------------------------------------------------------------ colors
export const SKINS = ['#f1cba6', '#e6b98f', '#d4a074', '#bd8458', '#94603c'];
export const HAIRS = ['#3a2618', '#5a3a22', '#7b4f2a', '#b98a4c', '#d0b469', '#8c3b1e', '#6e6e6a', '#1f1a17'];
export const METAL = '#9aa6b3', IRON = '#6f7884', STEEL = '#a3aebb', DARKMETAL = '#555d68', GOLD = '#d8b04a', BRONZE = '#b07a3c';
export const LEATHER = '#7a5230', DLEATHER = '#4d3220', WOOD = '#9a6a3a', DWOOD = '#6a4524', LINEN = '#d9ccaa', CLOTH = '#b8a888';

const LV_METAL = [8, 5, 1];
const LV_SOFT = [6, 5, 3];

// ------------------------------------------------------------------ head context
function headCtx(S, J) {
  const s = J.s;
  return { s, R: SK.headR * s, C: J.hc, F: J.hf, Rt: J.hr, U: J.hu, d0: S.dp(S.tv(J.hc)) };
}
/** revolve around the head's up axis tilted back by `tilt`; heights/radii in head-radius units. */
function hrev(S, H, rings, col, tilt, layer, opt, off) {
  const c = Math.cos(tilt), sn = Math.sin(tilt);
  const ax = vnorm(vsub(vmul(H.U, c), vmul(H.F, sn)));
  const u1 = vnorm(vadd(vmul(H.F, c), vmul(H.U, sn)));
  const R = H.R;
  let o = H.C;
  if (off) o = vadd(vadd(o, vmul(H.U, off[0] * R)), vmul(H.F, (off[1] || 0) * R));
  const rr = rings.map(r => [r[0] * R, r[1] * R, r[2] * R, (r[3] || 0) * R, (r[4] || 0) * R]);
  return S.revolve(o, ax, u1, H.Rt, rr, col, { d: H.d0 + layer * 0.01, ...(opt || {}) });
}
/** dome rings: radius k (head radii) hemisphere from base height h0 */
function dome(k, base = 1, hTop = 1.0) {
  return [[0, k * base, k * base], [0.35 * k * hTop, 0.94 * k, 0.94 * k], [0.65 * k * hTop, 0.77 * k, 0.77 * k], [0.88 * k * hTop, 0.48 * k, 0.48 * k], [k * hTop, 0.06, 0.06]];
}

// ------------------------------------------------------------------ face
function face(S, H, L, tc) {
  const { R, C, F, Rt, U } = H;
  const vF = S.vis(F);
  // nose (profile bump)
  if (vF > -0.25) {
    S.ball(vmad(vmad(C, F, R * 1.0), U, -R * 0.12), R * 0.17, mixHex(L.skin, '#ffffff', 0.08), { noEdge: true, b: 0.3 });
  }
  // eyes
  for (const side of [1, -1]) {
    const n = vadd(vmul(F, 0.9), vmul(Rt, 0.45 * side));
    if (S.vis(n) > 0.12) {
      const p = vmad(vmad(vmad(C, F, R * 0.86), Rt, R * 0.36 * side), U, R * 0.1);
      S.ball(p, R * 0.13, L.eye || '#2b1b13', { noEdge: true, b: 0.35, lv: [5, 4, 2] });
    }
  }
  if (L.beard) {
    // beard: lower-front blob
    S.ell(vmad(vmad(C, F, R * 0.5), U, -R * 0.66), vmul(Rt, R * 0.5), vmul(F, R * 0.36), vmul(U, R * 0.36), L.beard, { noEdge: true, b: 0.25 });
  }
}

// ------------------------------------------------------------------ hair
function hair(S, H, L, tc) {
  const st = L.hairStyle || 'short', col = L.hair;
  if (!col || st === 'none') return;
  if (st === 'short') hrev(S, H, dome(1.07, 1), col, 0.42, 3, { n: 12 }, [0.12, 0]);
  else if (st === 'long' || st === 'bun') {
    hrev(S, H, dome(1.07, 1), col, 0.45, 3, { n: 12 }, [0.1, 0]);
    // hair hanging behind
    const back = vmad(vmad(H.C, H.F, -H.R * 0.55), H.U, -H.R * 0.45);
    S.cap(vmad(H.C, H.U, -0.1 * H.R), vmad(back, H.U, -H.R * 0.55), H.R * 0.72, H.R * 0.6, col, { noEdge: true, b: -0.9 });
    if (st === 'bun') S.ball(vmad(vmad(H.C, H.F, -H.R * 0.85), H.U, H.R * 0.4), H.R * 0.42, col, { b: -0.4 });
  } else if (st === 'tonsure') {
    hrev(S, H, dome(1.07, 1), col, 0.42, 3, { n: 12 }, [0.12, 0]);
    S.ell(vmad(vmad(H.C, H.U, H.R * 0.86), H.F, -H.R * 0.12), vmul(H.F, H.R * 0.62), vmul(H.Rt, H.R * 0.62), vmul(H.U, H.R * 0.22), L.skin, { b: 0.45, noEdge: true });
  } else if (st === 'bowl') {
    hrev(S, H, dome(1.1, 1.0), col, 0.15, 3, { n: 12 }, [0.02, 0]);
  }
}

// ------------------------------------------------------------------ head gear
/** flat brim disc (separate part so that brim + dome do not merge into a cone) */
function brim(S, H, r, h, tilt, col, layer, off, lv) {
  return hrev(S, H, [[0, r, r], [0.1, r, r]], col, tilt, layer, { n: 14, lv: lv || [7, 5, 3] }, off || [h, 0]);
}
const HATS = {
  none() {},
  /** soft leather skull cap with a rolled brim */
  cap(S, H, L, tc, g) {
    const col = g.col || '#9a7442';
    brim(S, H, 1.17, 0.12, 0.35, shadeHex(col, -0.25), 3.5, [0.12, 0]);
    hrev(S, H, dome(1.08, 1, 1.0), col, 0.35, 4, { n: 12 }, [0.2, 0]);
  },
  /** felt cap with a narrow turned-up brim (spearman) */
  felt(S, H, L, tc, g) {
    const col = g.col || '#8b7a5a';
    brim(S, H, 1.34, 0.2, 0.4, shadeHex(col, -0.2), 3.5, [0.2, 0]);
    hrev(S, H, [[0, 1.1, 1.1], [0.3, 1.08, 1.08], [0.75, 0.95, 0.95], [1.05, 0.65, 0.65], [1.18, 0.3, 0.3]], col, 0.45, 4, { n: 12 }, [0.28, 0]);
  },
  hood(S, H, L, tc, g) {
    const col = g.col || tc.main;
    // cowl around the neck / shoulders (below the chin)
    if (g.cowl !== false) {
      const c0 = vmad(H.C, H.U, -H.R * 1.05);
      S.revolve(c0, [0, 0, 1], H.F, H.Rt, [[-0.62 * H.R, 1.3 * H.R, 1.6 * H.R], [-0.25 * H.R, 1.2 * H.R, 1.35 * H.R], [0.0, 1.05 * H.R, 1.12 * H.R]], shadeHex(col, -0.1), { d: H.d0 - 0.06, n: 12 });
    }
    // pointed hood over the head (face opening via tilted base)
    hrev(S, H, [[-0.25, 1.2, 1.2], [0.1, 1.2, 1.2], [0.6, 1.12, 1.12], [1.0, 0.9, 0.9], [1.25, 0.5, 0.5], [1.32, 0.1, 0.1]], col, 0.5, 4, { n: 12 }, [0.12, 0.0]);
    S.cap(vmad(vmad(H.C, H.F, -H.R * 0.9), H.U, H.R * 0.8), vmad(vmad(H.C, H.F, -H.R * 1.7), H.U, H.R * 0.45), H.R * 0.45, H.R * 0.1, shadeHex(col, -0.08), { b: -0.5 });
    if (g.feather) S.cap(vmad(vmad(H.C, H.U, H.R * 1.0), H.Rt, H.R * 0.9), vmad(vmad(vmad(H.C, H.U, H.R * 2.0), H.Rt, H.R * 1.0), H.F, -H.R * 0.8), H.R * 0.16, H.R * 0.04, g.feather, { b: 0.2 });
  },
  /** mail coif (covers head + neck/shoulders; the face window is drawn on top) */
  coif(S, H, L, tc, g) {
    const col = g.coif || '#8a95a2';
    hrev(S, H, [[-1.55, 1.1, 1.32], [-0.9, 1.07, 1.12], [0, 1.06, 1.06], [0.7, 0.97, 0.97], [1.05, 0.68, 0.68], [1.17, 0.2, 0.2]], col, 0.25, 4, { n: 12, lv: LV_METAL }, [0.1, 0]);
    faceWindow(S, H, L, 0.62, 5);
  },
  /** open-face iron helmet dome with a nasal bar (optionally pointed / gold browband) */
  nasal(S, H, L, tc, g) {
    const col = g.col || STEEL;
    if (g.coif !== false) HATS.coif(S, H, L, tc, { coif: g.coifCol || '#8a95a2' });
    const rev = hrev(S, H, dome(1.1, 1, g.pointed ? 1.4 : 1.0), col, 0.32, 6, { n: 12, lv: LV_METAL }, [0.28, 0]);
    S.band(rev, 0.06 * H.R, 1.0, g.brow || shadeHex(col, -0.3), { like: rev.part, k: 1.02 });
    S.cap(vmad(vmad(H.C, H.F, H.R * 1.04), H.U, H.R * 0.42), vmad(vmad(H.C, H.F, H.R * 1.16), H.U, -H.R * 0.32), H.R * 0.13, H.R * 0.12, col, { b: 0.5, lv: LV_METAL, noEdge: true });
  },
  conical(S, H, L, tc, g) {
    const col = g.col || STEEL;
    if (g.coif !== false) HATS.coif(S, H, L, tc, { coif: g.coifCol || '#8a95a2' });
    const rev = hrev(S, H, [[0, 1.12, 1.12], [0.35, 1.06, 1.06], [0.8, 0.9, 0.9], [1.3, 0.62, 0.62], [1.8, 0.3, 0.3], [2.05, 0.05, 0.05]], col, 0.3, 6, { n: 12, lv: LV_METAL }, [0.25, 0]);
    S.band(rev, 0.1 * H.R, 1.3, shadeHex(col, -0.3), { like: rev.part, k: 1.02 });
    S.cap(vmad(vmad(H.C, H.F, H.R * 1.08), H.U, H.R * 0.4), vmad(vmad(H.C, H.F, H.R * 1.18), H.U, -H.R * 0.45), H.R * 0.14, H.R * 0.13, col, { b: 0.5, lv: LV_METAL, noEdge: true });
    if (g.horns) {
      for (const sd of [1, -1]) {
        const b = vmad(vmad(H.C, H.Rt, H.R * 1.05 * sd), H.U, H.R * 0.8);
        const m = vmad(vmad(b, H.Rt, H.R * 0.8 * sd), H.U, H.R * 0.35);
        S.cap(b, m, H.R * 0.24, H.R * 0.15, '#e8e0c8');
        S.cap(m, vmad(vmad(m, H.Rt, H.R * 0.3 * sd), H.U, H.R * 1.2), H.R * 0.15, H.R * 0.04, '#f2ecd8');
      }
    }
  },
  /** wide-brim kettle hat: flat brim + rounded crown */
  kettle(S, H, L, tc, g) {
    const col = g.col || '#8d98a5';
    brim(S, H, 1.46, 0.5, 0.12, shadeHex(col, -0.15), 5, [0.5, 0], [8, 5, 1]);
    hrev(S, H, [[0, 1.02, 1.02], [0.35, 0.99, 0.99], [0.8, 0.82, 0.82], [1.1, 0.52, 0.52], [1.25, 0.12, 0.12]], col, 0.12, 6, { n: 14, lv: LV_METAL }, [0.55, 0]);
  },
  /** sallet: rounded helm with a swept-back tail */
  sallet(S, H, L, tc, g) {
    const col = g.col || STEEL;
    S.cap(vmad(vmad(H.C, H.F, -H.R * 0.8), H.U, H.R * 0.1), vmad(vmad(H.C, H.F, -H.R * 1.15), H.U, -H.R * 0.6), H.R * 0.5, H.R * 0.34, shadeHex(col, -0.22), { b: -0.2, lv: LV_METAL });
    const rev = hrev(S, H, dome(1.1, 1, 1.0), col, 0.3, 6, { n: 12, lv: LV_METAL }, [0.2, 0]);
    S.band(rev, 0.07 * H.R, 1.1, shadeHex(col, -0.32), { like: rev.part, k: 1.02 });
    if (g.visor) faceWindowDark(S, H, 0.4, 8);
  },
  /** great helm: flat rounded top, cross of team colour, eye slit + breaths */
  greathelm(S, H, L, tc, g) {
    const col = g.col || STEEL;
    const rev = hrev(S, H, [[-1.4, 1.08, 1.08], [-0.8, 1.14, 1.14], [0.6, 1.14, 1.14], [1.0, 1.06, 1.06], [1.14, 0.82, 0.82], [1.2, 0.35, 0.35]], col, 0.0, 6, { n: 14, lv: LV_METAL }, [0.1, 0]);
    const R = H.R, bandCol = g.band || tc.main;
    S.patch(rev, -1.4 * R, 1.1 * R, -0.13, 0.13, bandCol, { like: rev.part, k: 1.02, lvAuto: [7, 5, 3] });
    S.patch(rev, 0.18 * R, 0.5 * R, -1.1, 1.1, bandCol, { like: rev.part, k: 1.02, lvAuto: [7, 5, 3] });
    if (S.vis(H.F) > -0.1) {
      const slit = a => vmad(vmad(H.C, H.F, R * 1.17), H.U, R * a);
      S.cap(vmad(slit(0.3), H.Rt, -R * 0.55), vmad(slit(0.3), H.Rt, R * 0.55), R * 0.1, R * 0.1, '#0e0c0a', { noEdge: true, b: 0.5 });
      S.segs([[slit(-0.25), slit(-0.25)], [slit(-0.5), slit(-0.5)], [slit(-0.75), slit(-0.75)]].map(p => [vmad(p[0], H.Rt, -R * 0.0), vmad(p[1], H.Rt, R * 0.0)]), 1.1, '#1c1814', { b: 0.5 });
    }
  },
  /** plate helm: tall dome, darker visor plate decal with T-shaped opening, plume */
  bascinet(S, H, L, tc, g) {
    const col = g.col || '#c6d0dc', R = H.R;
    const rev = hrev(S, H, [[-1.3, 1.08, 1.08], [-0.7, 1.1, 1.1], [0.1, 1.12, 1.12], [0.7, 1.06, 1.06], [1.15, 0.82, 0.82], [1.45, 0.4, 0.4], [1.56, 0.08, 0.08]], col, 0.0, 6, { n: 14, lv: LV_METAL }, [0.1, 0]);
    S.patch(rev, -0.9 * R, 0.62 * R, -0.95, 0.95, g.visorCol || shadeHex(col, -0.28), { like: rev.part, k: 1.03, lvAuto: [8, 5, 1] });
    if (S.vis(H.F) > -0.1) {
      const e = a => vmad(vmad(H.C, H.F, R * 1.15), H.U, R * a);
      S.cap(vmad(e(0.12), H.Rt, -R * 0.5), vmad(e(0.12), H.Rt, R * 0.5), R * 0.09, R * 0.09, '#0e0c0a', { noEdge: true, b: 0.6 });
      S.cap(e(0.12), e(-0.55), R * 0.07, R * 0.07, '#0e0c0a', { noEdge: true, b: 0.6 });
    }
    if (g.plume) plume(S, H, g.plume, g.plumeLen || 1.0);
  },
  /** broad-brimmed hat with a low crown, team band and plume (arbalester) */
  plumedhat(S, H, L, tc, g) {
    const col = g.col || '#5a4630';
    brim(S, H, 1.78, 0.3, 0.22, shadeHex(col, -0.15), 5, [0.3, 0]);
    const rev = hrev(S, H, [[0, 1.08, 1.08], [0.3, 1.04, 1.04], [0.6, 0.9, 0.9], [0.82, 0.62, 0.62], [0.92, 0.2, 0.2]], col, 0.22, 6, { n: 14 }, [0.34, 0]);
    S.band(rev, 0.16 * H.R, 1.5, g.band || tc.main, { like: rev.part, k: 1.04 });
    if (g.plume) plume(S, H, g.plume, g.plumeLen || 0.9, true);
  },
  furhat(S, H, L, tc, g) {
    const fur = g.fur || '#6d4b32', top = g.col || tc.main;
    hrev(S, H, [[0, 1.1, 1.1], [0.35, 1.02, 1.02], [0.9, 0.78, 0.78], [1.35, 0.46, 0.46], [1.62, 0.12, 0.12]], top, 0.35, 6, { n: 12 }, [0.4, 0]);
    hrev(S, H, [[-0.1, 1.3, 1.3], [0.2, 1.34, 1.34], [0.55, 1.18, 1.18]], fur, 0.35, 7, { n: 12 }, [0.3, 0]);
    if (g.feather) S.cap(vmad(vmad(H.C, H.U, H.R * 1.7), H.Rt, H.R * 0.1), vmad(vmad(vmad(H.C, H.U, H.R * 2.5), H.Rt, H.R * 0.3), H.F, -H.R * 0.5), H.R * 0.14, H.R * 0.04, g.feather, { b: -0.3 });
  },
  turban(S, H, L, tc, g) {
    const col = g.col || '#e8e1cc';
    const rev = hrev(S, H, [[0, 1.18, 1.22], [0.35, 1.3, 1.34], [0.8, 1.26, 1.28], [1.15, 1.0, 1.0], [1.4, 0.5, 0.5], [1.5, 0.1, 0.1]], col, 0.25, 6, { n: 14 }, [0.15, 0]);
    S.band(rev, 0.38 * H.R, 2.0, g.band || tc.main, { like: rev.part, k: 1.03 });
    S.band(rev, 0.8 * H.R, 0.9, shadeHex(col, -0.15), { like: rev.part, k: 1.03 });
    S.cap(vmad(vmad(H.C, H.F, -H.R * 1.0), H.U, H.R * 0.1), vmad(vmad(H.C, H.F, -H.R * 1.3), H.U, -H.R * 1.5), H.R * 0.5, H.R * 0.3, col, { b: -0.6 });
  },
  scarf(S, H, L, tc, g) {
    const col = g.col || '#e8dfc8';
    hrev(S, H, [[-0.35, 1.16, 1.18], [0.1, 1.18, 1.18], [0.6, 1.1, 1.1], [1.0, 0.86, 0.86], [1.2, 0.4, 0.4], [1.27, 0.1, 0.1]], col, 0.55, 4, { n: 12 }, [0.12, 0.05]);
    S.ball(vmad(vmad(H.C, H.F, -H.R * 1.15), H.U, -H.R * 0.1), H.R * 0.4, shadeHex(col, -0.05), { b: -0.5 });
    S.cap(vmad(vmad(H.C, H.F, -H.R * 1.2), H.U, -H.R * 0.2), vmad(vmad(H.C, H.F, -H.R * 1.5), H.U, -H.R * 1.2), H.R * 0.28, H.R * 0.14, shadeHex(col, -0.1), { b: -0.6 });
  },
  /** monk's cowl: folded-back hood around the neck */
  cowl(S, H, L, tc, g) {
    const col = g.col || '#8a6a3a';
    const c0 = vmad(H.C, H.U, -H.R * 1.05);
    const rev = S.revolve(c0, [0, 0, 1], H.F, H.Rt, [[-0.95 * H.R, 1.55 * H.R, 2.0 * H.R], [-0.4 * H.R, 1.35 * H.R, 1.7 * H.R], [0.0, 1.1 * H.R, 1.25 * H.R]], col, { d: H.d0 - 0.07, n: 12 });
    S.band(rev, -0.25 * H.R, 1.6, tc.main, { like: rev.part, k: 1.02 });
  },
  headband(S, H, L, tc, g) {
    hrev(S, H, [[0.28, 1.12, 1.12], [0.52, 1.12, 1.12]], g.col || tc.main, 0.4, 6, { n: 12 }, [0.2, 0]);
  },
};
function plume(S, H, col, len = 1, side = false) {
  const base = vmad(vmad(H.C, H.U, H.R * 1.45), H.F, -H.R * 0.1);
  let prev = base;
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = vadd(vadd(base, vmul(H.F, -H.R * 1.7 * len * t)), vmul(H.U, H.R * (0.6 * Math.sin(t * 2.2) - 0.9 * t * t) * len));
    S.cap(prev, p, H.R * (0.42 - 0.28 * (i - 1) / n), H.R * (0.42 - 0.28 * i / n), col, { b: -0.5 - i * 0.05, lv: [7, 5, 3] });
    prev = p;
  }
}
function faceWindow(S, H, L, rad, layer) {
  if (S.vis(H.F) < 0.02) return;
  const c = vmad(vmad(H.C, H.F, H.R * 0.8), H.U, -H.R * 0.07);
  S.disc(c, H.F, H.U, H.R * rad, H.R * 0.1, L.skin, L.skin, L.skin, { n: 14, ra: H.R * rad * 1.05, rb: H.R * rad * 0.95, b: layer * 0.01 });
}
function faceWindowDark(S, H, rad, layer) {
  if (S.vis(H.F) < 0.02) return;
  const c = vmad(vmad(H.C, H.F, H.R * 1.0), H.U, -H.R * 0.1);
  S.disc(c, H.F, H.U, H.R * rad, H.R * 0.05, '#2a2420', '#2a2420', '#2a2420', { n: 12, b: layer * 0.01 });
}

function drawHead(S, J, L, tc) {
  const H = headCtx(S, J), s = J.s;
  const g = L.head || {};
  S.headScr = S.P(H.C); S.headR = H.R;
  // neck
  S.cap(vmad(J.s0, J.Uc, 0.3 * s), vmad(H.C, H.U, -H.R * 0.7), 1.55 * s, 1.4 * s, L.neckCol || L.skin, { noEdge: true, b: 0.01 });
  const skull = S.ball(H.C, H.R, L.skin, { b: 0.0 });
  face(S, H, L, tc);
  const kind = g.kind || 'none';
  const hatCovers = !!HATS_COVER_HAIR[kind];
  if (!hatCovers) hair(S, H, L, tc);
  (HATS[kind] || HATS.none)(S, H, L, tc, g);
  H.skull = skull;
  return H;
}
const HATS_COVER_HAIR = { cap: 1, felt: 1, hood: 1, coif: 1, nasal: 1, conical: 1, kettle: 1, sallet: 1, greathelm: 1, bascinet: 1, plumedhat: 0, furhat: 1, turban: 1, scarf: 1, cowl: 0, headband: 0 };

// ------------------------------------------------------------------ torso
function torsoRings(L, s) {
  const f = L.female, k = L.build || 1;
  const sh = (f ? 0.9 : 1.0) * k, wa = (f ? 0.82 : 0.96) * k, hp = (f ? 1.1 : 1.0) * k;
  return [
    [-1.2 * s, 2.4 * s, 3.1 * hp * s], [0.4 * s, 2.45 * s, 3.2 * hp * s], [2.8 * s, 2.25 * s, 2.95 * wa * s],
    [5.6 * s, 2.6 * s, 3.85 * sh * s], [7.4 * s, 2.45 * s, 4.15 * sh * s], [8.3 * s, 1.9 * s, 3.0 * sh * s],
  ];
}

function drawTorso(S, J, L, tc, po) {
  const T = L.torso, s = J.s;
  const rings = torsoRings(L, s);
  const tex = T.tex || null;
  const lv = T.metal ? LV_METAL : LV_DEF_T;
  const rev = S.revolve(J.P, J.Uc, J.Fc, J.Rc, rings, T.col, { n: 12, tex, lv, d: S.dp(S.tv(vmad(J.P, J.Uc, 4.5 * s))) });
  // skirt / tunic hem
  if (T.skirt > 0 || L.dress) {
    const len = (L.dress ? 12.2 : T.skirt) * s, sw = po.sway || 0;
    const sk = L.dress
      ? [[-len, 3.6 * s, 4.4 * s, sw * 0.6 * s, 0], [-len * 0.55, 3.3 * s, 3.9 * s, sw * 0.25 * s, 0], [-len * 0.2, 3.05 * s, 3.6 * s, 0, 0], [0.6 * s, 2.75 * s, 3.4 * s, 0, 0]]
      : [[-len, 3.5 * s, 4.1 * s, sw * 0.4 * s, 0], [-len * 0.5, 3.15 * s, 3.7 * s, sw * 0.15 * s, 0], [0.6 * s, 2.75 * s, 3.4 * s, 0, 0]];
    const skRev = S.revolve(J.P, [0, 0, 1], J.Fp, J.Rp, sk, T.skirtCol || T.col, { n: 12, tex: T.skirtTex || tex, lv, d: S.dp(S.tv(J.P)) + 0.02 });
    if (T.hemBand) S.band(skRev, -len + 0.8 * s, 1.1 * s, T.hemBand, { like: skRev.part });
    if (T.kind === 'mail') S.zigzag(skRev, -len + 0.6 * s, 0.9 * s, 0.8, shadeHex(T.skirtCol || T.col, -0.35), { like: skRev.part, n: 28 });
    if (L.dress && L.apron) S.patch(skRev, -len * 0.92, -0.2 * s, -0.55, 0.55, L.apron, { like: skRev.part, lvAuto: [7, 5, 4] });
    if (T.tabard) {
      S.patch(skRev, -len * 0.98, 0.0, -0.75, 0.75, T.tabard, { like: skRev.part, lvAuto: [7, 5, 3] });
      S.patch(skRev, -len * 0.98, 0.0, Math.PI - 0.75, Math.PI + 0.75, T.tabard, { like: skRev.part, lvAuto: [7, 5, 3] });
    }
    J.skirt = skRev;
  }
  if (T.tabard) {
    S.patch(rev, 0.3 * s, 8.4 * s, -0.8, 0.8, T.tabard, { like: rev.part, lvAuto: [7, 5, 3], tex: T.tabardTex });
    S.patch(rev, 0.3 * s, 8.4 * s, Math.PI - 0.8, Math.PI + 0.8, T.tabard, { like: rev.part, lvAuto: [7, 5, 3], tex: T.tabardTex });
    if (T.tabardTrim) {
      S.patch(rev, 0.3 * s, 8.4 * s, -0.12, 0.12, T.tabardTrim, { like: rev.part, lvAuto: [7, 5, 3] });
      S.patch(rev, 0.3 * s, 8.4 * s, Math.PI - 0.12, Math.PI + 0.12, T.tabardTrim, { like: rev.part, lvAuto: [7, 5, 3] });
    }
  }
  if (T.kind === 'gambeson' || T.kind === 'jerkin') {
    S.stitches(rev, [-0.7, -0.25, 0.25, 0.7, Math.PI - 0.7, Math.PI - 0.25, Math.PI + 0.25, Math.PI + 0.7], 1.2 * s, 8.0 * s, 0.7, shadeHex(T.col, -0.32), { like: rev.part, n: 6 });
  } else if (T.kind === 'brigandine') {
    S.studs(rev, [1.8 * s, 3.4 * s, 5.0 * s, 6.6 * s], [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75, Math.PI - 0.75, Math.PI - 0.45, Math.PI - 0.15, Math.PI + 0.15, Math.PI + 0.45, Math.PI + 0.75], 1.25, '#d8ceb0', { like: rev.part });
  } else if (T.kind === 'mail' || T.kind === 'plate') {
    if (T.kind === 'mail') S.stitches(rev, [-0.5, 0.5, Math.PI - 0.5, Math.PI + 0.5], 0.8 * s, 7.6 * s, 0.5, shadeHex(T.col, 0.28), { like: rev.part, n: 7 });
  }
  if (T.belt) S.band(rev, 1.2 * s, 1.15 * s, T.belt, { like: rev.part, k: 1.03 });
  if (T.belt2) S.band(rev, 8.3 * s, 0.9 * s, T.belt2, { like: rev.part, k: 1.0 });   // shoulder seam / trim
  if (T.plate) {                       // breastplate ridge highlight
    S.band(rev, 4.8 * s, 0.7 * s, 'rgba(255,255,255,0.35)', { like: rev.part, k: 1.0, t0: -0.5, t1: 0.5 });
  }
  if (T.collar) {
    const c = vmad(J.s0, J.Uc, 0.5 * s);
    S.revolve(c, J.Uc, J.Fc, J.Rc, [[-0.8 * s, 3.0 * s, 4.3 * s], [0.2 * s, 2.6 * s, 3.5 * s], [1.4 * s, 2.0 * s, 2.3 * s]], T.collar, { d: S.dp(S.tv(c)) - 0.02, n: 12, tex: T.collarTex || null, lv: T.metalCollar ? LV_METAL : LV_DEF_T });
  }
  J.torsoRev = rev;
  return rev;
}
const LV_DEF_T = [7, 5, 2];

// ------------------------------------------------------------------ legs & arms
function drawLegs(S, J, L) {
  const s = J.s, G = L.legs;
  for (const side of [1, -1]) {
    const hip = side > 0 ? J.hipR : J.hipL, kn = side > 0 ? J.kR : J.kL, an = side > 0 ? J.aR : J.aL, toe = side > 0 ? J.toeR : J.toeL;
    const lv = G.metal ? LV_METAL : LV_DEF_T;
    S.cap(hip, kn, 2.05 * s, 1.7 * s, G.col, { tex: G.tex, lv, b: 0 });
    S.cap(kn, an, 1.65 * s, 1.2 * s, G.col2 || G.col, { tex: G.tex, lv, b: 0.02 });
    if (G.boot) {
      const bh = G.bootH === undefined ? 0.5 : G.bootH;
      S.cap(vlerp(kn, an, 1 - bh), an, 1.72 * s, 1.35 * s, G.boot, { lv: [6, 4, 2], b: 0.05, tex: G.bootTex });
      S.cap(vadd(an, [0, 0, 0.1]), toe, 1.5 * s, 1.1 * s, G.boot, { lv: [6, 4, 2], b: 0.06 });
    } else {
      S.cap(vadd(an, [0, 0, 0.1]), toe, 1.4 * s, 1.05 * s, G.foot || L.skin, { lv: [6, 4, 2], b: 0.06 });
    }
    if (G.knee) S.ball(kn, 1.85 * s, G.knee, { b: 0.04, lv: LV_METAL });
  }
}

function drawArms(S, J, L, po) {
  const s = J.s, A = L.arms;
  for (const side of [1, -1]) {
    const sh = side > 0 ? J.shR : J.shL, el = side > 0 ? J.eR : J.eL, hd = side > 0 ? J.hdR : J.hdL;
    const lv = A.metal ? LV_METAL : LV_DEF_T;
    const upCol = A.up || A.col, foCol = A.fore || A.col;
    const upB = 0.08;
    S.cap(sh, el, 1.5 * s, 1.3 * s, upCol, { lv, b: upB });
    S.cap(el, hd, 1.2 * s, 1.0 * s, foCol, { lv: A.foreMetal ? LV_METAL : lv, b: upB + 0.02 });
    if (A.shoulder) S.ball(sh, 1.7 * s, A.shoulder, { lv, b: upB + 0.01, noEdge: true });
    if (A.elbow) S.ball(el, 1.45 * s, A.elbow, { lv: LV_METAL, b: upB + 0.03 });
    if (A.cuff) S.cap(vlerp(el, hd, 0.62), hd, 1.32 * s, 1.18 * s, A.cuff, { lv, b: upB + 0.025 });
    // hand
    S.ball(hd, 1.2 * s, A.glove || L.skin, { b: upB + 0.06, noEdge: true });
  }
  if (A.pauldron) {
    for (const side of [1, -1]) {
      const sh = side > 0 ? J.shR : J.shL;
      S.ell(vmad(vmad(sh, J.Uc, 0.8 * s), J.Rc, 0.4 * s * side), vmul(J.Fc, 2.2 * s), vmul(J.Rc, 2.1 * s), vmul(J.Uc, 1.4 * s), A.pauldron, { lv: LV_METAL, b: 0.2 });
    }
  }
}

// ------------------------------------------------------------------ weapons
function bladeW(D, J) {            // blade width direction: chest forward projected perpendicular to D
  let w = vsub(J.Fc, vmul(D, vdot(J.Fc, D)));
  if (vlen(w) < 0.15) w = vsub(J.Rc, vmul(D, vdot(J.Rc, D)));
  return vnorm(w);
}
/** flat blade polygon: base point B, direction D, width vector W, length, base width, tip style */
function blade(S, B, D, W, len, wid, col, o) {
  const tip = vmad(B, D, len), shoulder = o && o.sh !== undefined ? o.sh : 0.82;
  const p0 = vmad(B, W, wid / 2), p1 = vmad(B, W, -wid / 2);
  const q0 = vmad(vmad(B, D, len * shoulder), W, wid / 2 * (o && o.tipw !== undefined ? o.tipw : 0.9)), q1 = vmad(vmad(B, D, len * shoulder), W, -wid / 2 * (o && o.tipw !== undefined ? o.tipw : 0.9));
  const n = vnorm(vcross(D, W));
  const pts = [p0, q0, tip, q1, p1];
  S.poly(pts, col, n, { lv: LV_METAL, b: o && o.b || 0.1 });
  // central fuller / edge highlight
  S.line([vmad(B, D, len * 0.06), vmad(B, D, len * 0.92)], 0.5, 'rgba(255,255,255,0.55)', { b: 0.12 });
}
function swordPoints(S, J, G, D, spec, L) {
  const s = J.s, W = bladeW(D, J);
  const len = (spec.len || 13) * s, wid = (spec.wid || 1.7) * s;
  const col = spec.blade || '#cbd4de';
  const hilt = spec.hilt || DWOOD;
  const guardA = vmad(G, D, 1.2 * s);
  // grip (behind the hand), pommel
  S.cap(vmad(G, D, -2.4 * s), vmad(G, D, 1.2 * s), 0.62 * s, 0.62 * s, hilt, { b: 0.04 });
  S.ball(vmad(G, D, -2.7 * s), 0.85 * s, spec.pommel || GOLD, { b: 0.05 });
  // crossguard
  const gw = vcross(D, W);
  const ga = vnorm(vsub(W, vmul(D, vdot(W, D))));
  S.cap(vmad(guardA, ga, -2.0 * s), vmad(guardA, ga, 2.0 * s), 0.55 * s, 0.55 * s, spec.guard || GOLD, { b: 0.06, lv: LV_METAL });
  blade(S, vmad(G, D, 1.4 * s), D, W, len, wid, col, { b: 0.07 });
}
const WEAPONS = {
  sword(S, J, G, D, sp, L, tc, po) { swordPoints(S, J, G, D, sp, L); },
  /** big two-handed sword (grip long) */
  greatsword(S, J, G, D, sp, L, tc, po) {
    const s = J.s, W = bladeW(D, J);
    const len = (sp.len || 20) * s, wid = (sp.wid || 2.5) * s;
    S.cap(vmad(G, D, -3.0 * s), vmad(G, D, 4.4 * s), 0.7 * s, 0.7 * s, sp.hilt || '#4a3322', { b: 0.04 });
    S.ball(vmad(G, D, -3.4 * s), 1.0 * s, sp.pommel || GOLD, { b: 0.05, lv: LV_METAL });
    const ga = vnorm(vsub(W, vmul(D, vdot(W, D))));
    const gp = vmad(G, D, 5.0 * s);
    S.cap(vmad(gp, ga, -3.2 * s), vmad(gp, ga, 3.2 * s), 0.7 * s, 0.7 * s, sp.guard || GOLD, { b: 0.06, lv: LV_METAL });
    blade(S, vmad(G, D, 5.2 * s), D, W, len, wid, sp.blade || '#dbe3ec', { b: 0.07, sh: 0.9, tipw: 0.7 });
  },
  spear(S, J, G, D, sp, L, tc, po) {
    const s = J.s, len = (sp.len || 40) * s, gf = sp.grip !== undefined ? sp.grip : 0.36;
    const B = vmad(G, D, -len * gf), T = vmad(B, D, len);
    S.cap(B, vmad(B, D, len - (sp.head || 4.5) * s), 0.62 * s, 0.55 * s, sp.shaft || '#8a6035', { b: 0.04, lv: [6, 5, 3] });
    // head: leaf blade
    const W = bladeW(D, J), hl = (sp.head || 4.8) * s, hb = vmad(T, D, -hl);
    blade(S, hb, D, W, hl, (sp.hw || 2.2) * s, sp.tip || '#d2dae3', { sh: 0.45, tipw: 1.0, b: 0.08 });
    S.cap(vmad(hb, D, -0.6 * s), vmad(hb, D, 0.4 * s), 0.8 * s, 0.8 * s, sp.socket || '#8c96a2', { b: 0.07, lv: LV_METAL });
    if (sp.pennon) {
      const pb = vmad(hb, D, -1.8 * s), pw = vnorm(vsub(J.Rc, vmul(D, vdot(J.Rc, D))));
      const dr = vadd(vmul(vnorm(vsub(J.Fc, vmul(D, vdot(J.Fc, D)))), -1), [0, 0, 0]);
      const wave = (po && po.wave) || 0;
      S.poly([pb, vmad(vmad(pb, dr, 4.2 * s), D, -1.2 * s + wave * 0.6 * s), vmad(vmad(pb, dr, 7.0 * s), D, -3.6 * s + wave * s), vmad(vmad(pb, dr, 4.0 * s), D, -4.0 * s), vmad(pb, D, -3.0 * s)], sp.pennon, null, { b: 0.1, lv: [7, 5, 3] });
    }
    // butt
    S.ball(B, 0.7 * s, sp.shaft || '#8a6035', { b: 0.03, noEdge: true });
  },
  halberd(S, J, G, D, sp, L, tc, po) {
    const s = J.s, len = (sp.len || 40) * s, gf = sp.grip !== undefined ? sp.grip : 0.4;
    const B = vmad(G, D, -len * gf), T = vmad(B, D, len);
    S.cap(B, T, 0.62 * s, 0.55 * s, sp.shaft || '#7a5530', { b: 0.04, lv: [6, 5, 3] });
    const W = bladeW(D, J), ax = vnorm(vsub(W, vmul(D, vdot(W, D))));
    // axe blade (one side), spike on top, hook on the back
    const t0 = vmad(T, D, -7.0 * s), t1 = vmad(T, D, -1.0 * s);
    const A = [vmad(t0, ax, 0.5 * s), vmad(vmad(t0, ax, 4.6 * s), D, -1.0 * s), vmad(vmad(t1, ax, 5.2 * s), D, 0.2 * s), vmad(t1, ax, 0.5 * s)];
    S.poly(A, sp.tip || '#cdd5de', vnorm(vcross(D, J.Rc)), { lv: LV_METAL, b: 0.08 });
    S.poly([vmad(t1, ax, -0.4 * s), vmad(vmad(t1, ax, -3.2 * s), D, 0.8 * s), vmad(t0, ax, -0.4 * s)], sp.tip || '#b9c2cc', vnorm(vcross(D, J.Rc)), { lv: LV_METAL, b: 0.08 });
    blade(S, vmad(T, D, -1.2 * s), D, vmul(J.Rc, 1), 5.0 * s, 1.5 * s, sp.tip || '#d9e0e8', { sh: 0.5, b: 0.09 });
    S.cap(vmad(t0, D, -0.8 * s), vmad(t1, D, 0.6 * s), 0.9 * s, 0.9 * s, '#8c96a2', { b: 0.07, lv: LV_METAL });
    S.ball(B, 0.7 * s, sp.shaft || '#7a5530', { b: 0.03, noEdge: true });
  },
  staff(S, J, G, D, sp, L, tc, po) {
    const s = J.s, len = (sp.len || 36) * s, gf = sp.grip !== undefined ? sp.grip : 0.4;
    const B = vmad(G, D, -len * gf), T = vmad(B, D, len);
    S.cap(B, T, 0.7 * s, 0.62 * s, sp.shaft || '#7a5530', { b: 0.04, lv: [6, 5, 3] });
    if (sp.cross) {
      const W = vnorm(vsub(J.Rc, vmul(D, vdot(J.Rc, D))));
      S.cap(vmad(T, D, 0.2 * s), vmad(T, D, 2.8 * s), 0.55 * s, 0.5 * s, GOLD, { b: 0.06, lv: LV_METAL });
      S.cap(vmad(vmad(T, D, 2.0 * s), W, -1.4 * s), vmad(vmad(T, D, 2.0 * s), W, 1.4 * s), 0.5 * s, 0.5 * s, GOLD, { b: 0.06, lv: LV_METAL });
    } else S.ball(T, 0.95 * s, sp.knob || '#6a4524', { b: 0.04 });
  },
  axe(S, J, G, D, sp, L, tc, po) {            // one-hand axe / throwing axe
    const s = J.s, len = (sp.len || 11) * s;
    const B = vmad(G, D, -len * 0.35), T = vmad(B, D, len);
    S.cap(B, T, 0.62 * s, 0.55 * s, sp.shaft || '#7a5530', { b: 0.04, lv: [6, 5, 3] });
    const W = bladeW(D, J), ax = vnorm(vsub(W, vmul(D, vdot(W, D))));
    const a0 = vmad(T, D, -3.4 * s), a1 = vmad(T, D, 0.2 * s);
    const sz = (sp.hw || 3.6) * s;
    S.poly([vmad(a0, ax, 0.3 * s), vmad(vmad(a0, ax, sz * 0.8), D, -1.2 * s), vmad(vmad(a1, ax, sz), D, 0.6 * s), vmad(a1, ax, 0.3 * s)], sp.head || '#c3ccd6', vnorm(vcross(D, J.Rc)), { lv: LV_METAL, b: 0.08 });
    S.cap(vmad(a0, D, -0.2 * s), vmad(a1, D, 0.0 * s), 0.8 * s, 0.8 * s, '#79838f', { b: 0.07, lv: LV_METAL });
  },
  mace(S, J, G, D, sp, L, tc, po) {
    const s = J.s, len = (sp.len || 11) * s;
    const B = vmad(G, D, -len * 0.3), T = vmad(B, D, len);
    S.cap(B, T, 0.65 * s, 0.6 * s, sp.shaft || '#6a4524', { b: 0.04 });
    S.ball(vmad(T, D, 0.8 * s), 1.6 * s, '#8c96a2', { b: 0.06, lv: LV_METAL });
  },
  hammer(S, J, G, D, sp, L, tc, po) {
    const s = J.s, len = (sp.len || 11) * s;
    const B = vmad(G, D, -len * 0.3), T = vmad(B, D, len);
    S.cap(B, T, 0.62 * s, 0.56 * s, '#7a5530', { b: 0.04, lv: [6, 5, 3] });
    const W = vnorm(vsub(J.Rc, vmul(D, vdot(J.Rc, D))));
    S.cap(vmad(vmad(T, D, -0.3 * s), W, -2.0 * s), vmad(vmad(T, D, -0.3 * s), W, 2.0 * s), 1.25 * s, 1.25 * s, '#7c8692', { b: 0.07, lv: LV_METAL });
  },
  knife(S, J, G, D, sp, L, tc, po) {
    const s = J.s, W = bladeW(D, J);
    S.cap(vmad(G, D, -1.8 * s), vmad(G, D, 0.8 * s), 0.6 * s, 0.6 * s, '#5a3a22', { b: 0.04 });
    blade(S, vmad(G, D, 0.8 * s), D, W, 5.5 * s, 1.5 * s, '#d4dce4', { sh: 0.6, b: 0.07 });
  },
  pickaxe(S, J, G, D, sp, L, tc, po) {
    const s = J.s, len = 17 * s;
    const B = vmad(G, D, -len * 0.3), T = vmad(B, D, len);
    S.cap(B, T, 0.7 * s, 0.62 * s, '#7a5530', { b: 0.04, lv: [6, 5, 3] });
    const W = vnorm(vsub(J.Rc, vmul(D, vdot(J.Rc, D))));
    const c = vmad(T, D, -0.8 * s);
    S.cap(vmad(c, W, -4.6 * s), vmad(c, W, 4.6 * s), 0.7 * s, 0.7 * s, '#9aa4b0', { b: 0.07, lv: LV_METAL });
    S.cap(vmad(c, W, -4.6 * s), vmad(vmad(c, W, -5.6 * s), D, -1.0 * s), 0.7 * s, 0.25 * s, '#9aa4b0', { b: 0.07, lv: LV_METAL });
    S.cap(vmad(c, W, 4.6 * s), vmad(vmad(c, W, 5.6 * s), D, -1.0 * s), 0.7 * s, 0.25 * s, '#9aa4b0', { b: 0.07, lv: LV_METAL });
  },
  hoe(S, J, G, D, sp, L, tc, po) {
    const s = J.s, len = 19 * s;
    const B = vmad(G, D, -len * 0.35), T = vmad(B, D, len);
    S.cap(B, T, 0.66 * s, 0.6 * s, '#8a6035', { b: 0.04, lv: [6, 5, 3] });
    const W = bladeW(D, J), ax = vnorm(vsub(W, vmul(D, vdot(W, D))));
    const blade2 = [vmad(T, ax, 0.4 * s), vmad(vmad(T, ax, 4.6 * s), D, -0.8 * s), vmad(vmad(T, ax, 4.8 * s), D, -3.6 * s), vmad(vmad(T, ax, 0.4 * s), D, -1.2 * s)];
    S.poly(blade2, '#8d97a3', vnorm(vcross(D, ax)), { lv: LV_METAL, b: 0.08 });
  },
};

WEAPONS.bow = function (S, J, G, D, sp, L, tc, po) {
  const s = J.s, len = (sp.len || 22) * s, half = len / 2;
  const T = vnorm(cvec(J, po.W.T || [-1, 0, 0]));
  const X = po.X || {}, pull = X.pull || 0;
  const bend = (sp.bend || 0.2) + 0.2 * pull, rc = sp.recurve || 0;
  const col = sp.wood || '#8a5a2c';
  const pt = u => {
    const a = Math.abs(u);
    return vadd(vmad(G, D, u * half), vmul(T, half * (bend * u * u - rc * Math.max(0, a - 0.55) ** 2 * 3.0)));
  };
  const N = 6, pts = [];
  for (let i = 0; i <= N; i++) pts.push(pt(-1 + 2 * i / N));
  for (let i = 0; i < N; i++) {
    const w0 = (0.75 - 0.3 * Math.abs(-1 + 2 * i / N)) * s * (sp.thick || 1), w1 = (0.75 - 0.3 * Math.abs(-1 + 2 * (i + 1) / N)) * s * (sp.thick || 1);
    S.cap(pts[i], pts[i + 1], w0, w1, col, { b: 0.1, lv: [6, 5, 3] });
  }
  if (sp.trim) { S.cap(vmad(G, D, -1.6 * s), vmad(G, D, 1.6 * s), 0.95 * s, 0.95 * s, sp.trim, { b: 0.11, noEdge: true }); }
  if (sp.tips) for (const u of [-1, 1]) S.ball(pt(u), 0.6 * s, sp.tips, { b: 0.11, noEdge: true, lv: LV_METAL });
  // string
  const top = pt(1), bot = pt(-1);
  const rest = vlerp(top, bot, 0.5);
  let nock = rest;
  if (pull > 0.05) nock = vlerp(rest, J.hdR, Math.min(1, pull * 1.25));
  S.line([top, nock, bot], 0.5, '#efe8d4', { b: 0.09 });
  if (X.arrow) {
    const dir = vnorm(vsub(vmad(G, T, -1.0 * s), nock));
    const tip = vmad(nock, dir, 13.5 * s);
    S.cap(nock, tip, 0.34 * s, 0.3 * s, '#cdb98a', { b: 0.12, noEdge: true });
    S.cap(vmad(tip, dir, -1.6 * s), vmad(tip, dir, 0.6 * s), 0.1 * s, 0.7 * s, '#d6dde4', { b: 0.13, noEdge: true, lv: LV_METAL });
    S.cap(nock, vmad(nock, dir, 2.2 * s), 0.5 * s, 0.34 * s, sp.fletch || '#e9e4d6', { b: 0.12, noEdge: true });
  }
};
WEAPONS.crossbow = function (S, J, G, D, sp, L, tc, po) {
  const s = J.s, X = po.X || {};
  const W = vnorm(vsub(J.Rc, vmul(D, vdot(J.Rc, D))));       // prod axis
  const front = vmad(G, D, (sp.stock || 10) * s), back = vmad(G, D, -4.8 * s);
  S.cap(back, front, 0.95 * s, 0.8 * s, sp.wood || '#7a5230', { b: 0.08, lv: [6, 5, 3] });
  S.cap(vmad(G, D, -1.0 * s), vmad(G, D, 2.4 * s), 1.1 * s, 1.1 * s, sp.metal || '#5a626c', { b: 0.09, lv: LV_METAL, noEdge: true });
  const bw = (sp.span || 6.6) * s, cur = (sp.curve || 1.6) * s;
  const pa = u => vadd(vmad(front, W, u * bw), vmul(D, -cur * u * u + (X.loaded ? -0.4 * s : 0.6 * s) * (u * u)));
  const pts = []; for (let i = -3; i <= 3; i++) pts.push(pa(i / 3));
  for (let i = 0; i < 6; i++) S.cap(pts[i], pts[i + 1], 0.8 * s, 0.8 * s, sp.prod || '#5e3f22', { b: 0.1, lv: [6, 5, 3] });
  const latch = vmad(G, D, (X.loaded ? 0.6 : 8.6) * s);
  S.line([pts[0], X.loaded ? latch : vmad(pts[3], D, 0.2 * s), pts[6]], 0.5, '#efe8d4', { b: 0.09 });
  if (X.loaded) {
    S.cap(vmad(G, D, 0.8 * s), vmad(G, D, 12.5 * s), 0.34 * s, 0.3 * s, '#cdb98a', { b: 0.11, noEdge: true });
    S.cap(vmad(G, D, 11.2 * s), vmad(G, D, 13.4 * s), 0.1 * s, 0.7 * s, '#d6dde4', { b: 0.12, noEdge: true, lv: LV_METAL });
  }
  if (X.crank) S.cap(vmad(back, D, 0.6 * s), vmad(vmad(back, D, 0.6 * s), W, 2.8 * s), 0.35 * s, 0.35 * s, '#5a626c', { b: 0.1 });
};
export { WEAPONS };

// ------------------------------------------------------------------ shields
const SHIELDS = {
  round(S, J, C, n, sp, L, tc) {
    const s = J.s, R = (sp.R || 5.0) * s;
    const face = sp.face || tc.main;
    const d = S.disc(C, n, [0, 0, 1], R, 0.9 * s, face, sp.rim || '#6a4a2a', sp.back || '#8a6038', { n: 18, inner: 0.84, innerCol: face, innerLv: [7, 5, 3], lv: [7, 5, 2] });
    if (d.front) {
      const bc = vmad(C, n, 0.8 * s);
      if (sp.pattern === 'cross') {
        // cross pattern drawn on the face plane via thin discs rects
        const [a1, a2] = d.a1 ? [d.a1, d.a2] : basisOf(n);
        for (const ax of [a1, a2]) S.cap(vmad(bc, ax, -R * 0.82), vmad(bc, ax, R * 0.82), 0.55 * s, 0.55 * s, sp.pc || tc.light, { b: 0.1, noEdge: true });
      } else if (sp.pattern === 'split') {
        const [a1, a2] = d.a1 ? [d.a1, d.a2] : basisOf(n);
        S.poly([vmad(vmad(bc, a1, -R * 0.84), a2, 0), vmad(vmad(bc, a1, 0), a2, R * 0.84), vmad(vmad(bc, a1, R * 0.84), a2, 0), vmad(vmad(bc, a1, 0), a2, -R * 0.84)], sp.pc || tc.light, n, { b: 0.05, noEdge: true, lv: [7, 5, 3] });
      }
      S.ball(bc, (sp.boss || 1.5) * s, sp.bossCol || '#b9c0c8', { b: 0.12, lv: LV_METAL });
    } else {
      // back: handle/strap
      S.cap(vmad(C, d.a1, -R * 0.5), vmad(C, d.a1, R * 0.5), 0.5 * s, 0.5 * s, '#3a2a1c', { b: 0.1, noEdge: true });
    }
  },
  kite(S, J, C, n, sp, L, tc) {
    const s = J.s, W = (sp.W || 4.6) * s, H = (sp.H || 12.5) * s;
    const up = (sp.up) || [0, 0, 1];
    const [a1, a2] = basisOf(n, up);               // a1 ~ up, a2 ~ side
    const front = S.vis(n) >= 0;
    const mk = (off) => {
      const o = vmad(C, n, off);
      const pt = (u, v) => vadd(vadd(o, vmul(a1, u * s)), vmul(a2, v * s));
      return [pt(H / s * 0.5, -W / s), pt(H / s * 0.58, -W / s * 0.55), pt(H / s * 0.58, W / s * 0.55), pt(H / s * 0.5, W / s), pt(H / s * 0.12, W / s * 0.92), pt(-H / s * 0.22, W / s * 0.62), pt(-H / s * 0.5, 0), pt(-H / s * 0.22, -W / s * 0.62), pt(H / s * 0.12, -W / s * 0.92)];
    };
    const f = mk(0.5 * s), b = mk(-0.5 * s);
    // edge hull
    const sc = (pts) => pts;
    const faceCol = sp.face || tc.main;
    S.poly(front ? b : f, sp.rim || '#4a3a2a', n, { lv: [4, 3, 1], b: 0 });
    S.poly(front ? f : b, front ? faceCol : (sp.back || '#8a6038'), n, { lv: [7, 5, 3], b: 0.02 });
    if (front) {
      const o = vmad(C, n, 0.9 * s);
      const pt = (u, v) => vadd(vadd(o, vmul(a1, u * s)), vmul(a2, v * s));
      // vertical stripe / cross
      if (sp.pc !== null) {
        S.cap(pt(H / s * 0.46, 0), pt(-H / s * 0.46, 0), 0.7 * s, 0.7 * s, sp.pc || tc.light, { b: 0.06, noEdge: true });
        S.cap(pt(H / s * 0.22, -W / s * 0.75), pt(H / s * 0.22, W / s * 0.75), 0.7 * s, 0.7 * s, sp.pc || tc.light, { b: 0.06, noEdge: true });
      }
      // border
      S.ball(pt(H / s * 0.22, 0), 1.0 * s, sp.bossCol || '#c5ccd4', { b: 0.1, lv: LV_METAL });
    }
  },
  buckler(S, J, C, n, sp, L, tc) {
    const s = J.s, R = (sp.R || 2.9) * s;
    const d = S.disc(C, n, [0, 0, 1], R, 0.8 * s, sp.face || '#a07040', sp.rim || '#5a3a1e', '#6a4a2a', { n: 14, inner: 0.7, innerCol: sp.inner || '#b48050', innerLv: [7, 5, 3] });
    if (d.front) S.ball(vmad(C, n, 0.7 * s), 1.0 * s, sp.bossCol || tc.main, { b: 0.12, lv: LV_DEF_T });
  },
};
export { SHIELDS };

// ------------------------------------------------------------------ back items
const BACK = {
  quiver(S, J, L, tc, it) {
    const s = J.s, base = vmad(vmad(J.s0, J.Uc, -4.2 * s), J.Fc, -3.5 * s);
    const D = vnorm(vadd(vmul(J.Uc, 1), vadd(vmul(J.Fc, -0.18), vmul(J.Rc, 0.28))));
    const c0 = vmad(base, D, 0), c1 = vmad(base, D, 8.6 * s);
    // arrows (feathers) sticking out
    for (let i = 0; i < 4; i++) {
      const o = vadd(vmul(J.Rc, (i - 1.5) * 0.7 * s), vmul(J.Fc, ((i % 2) - 0.5) * 0.8 * s));
      const tip = vmad(vmad(c1, o, 1), D, 3.2 * s);
      S.cap(vmad(c1, o, 1), tip, 0.26 * s, 0.22 * s, '#c9b890', { b: -0.3, noEdge: true });
      S.cap(vmad(tip, D, -0.2 * s), vmad(tip, D, 1.8 * s), 0.55 * s, 0.35 * s, it.fletch || '#e8e4d8', { b: -0.3, noEdge: true });
    }
    S.cap(c0, c1, 1.55 * s, 1.75 * s, it.col || '#7a5230', { b: -0.2, lv: [6, 4, 2] });
    S.cap(vmad(c0, D, 1.5 * s), vmad(c0, D, 2.4 * s), 1.7 * s, 1.7 * s, it.band || '#4d3220', { b: -0.19, noEdge: true });
    S.cap(vmad(c1, D, -1.5 * s), vmad(c1, D, -0.8 * s), 1.85 * s, 1.85 * s, it.band || '#4d3220', { b: -0.19, noEdge: true });
  },
  /** bundle of javelins strapped on the back */
  javelins(S, J, L, tc, it) {
    const s = J.s, base = vmad(vmad(J.s0, J.Uc, -6.5 * s), J.Fc, -3.0 * s);
    const D = vnorm(vadd(vmul(J.Uc, 1), vadd(vmul(J.Fc, -0.15), vmul(J.Rc, 0.55))));
    for (let i = 0; i < 4; i++) {
      const o = vadd(vmul(J.Rc, (i - 1.5) * 0.9 * s), vmul(J.Fc, ((i % 2) - 0.5) * 0.9 * s));
      const a = vmad(base, o, 1), b = vmad(a, D, (15 + (i % 2) * 2) * s);
      S.cap(a, b, 0.4 * s, 0.34 * s, '#8a6035', { b: -0.25, noEdge: true });
      S.cap(vmad(b, D, -0.2 * s), vmad(b, D, 1.8 * s), 0.55 * s, 0.1 * s, '#c9ced4', { b: -0.25, noEdge: true, lv: LV_METAL });
    }
  },
  cloak(S, J, L, tc, it, po) {
    const s = J.s, col = it.col || tc.main;
    const sw = ((it.sway || 0) + (po && po.sway || 0) * 1.6) * s;
    const topL = vmad(vmad(J.s0, J.Rc, -4.1 * s), J.Fc, -1.8 * s), topR = vmad(vmad(J.s0, J.Rc, 4.1 * s), J.Fc, -1.8 * s);
    const len = (it.len || 17) * s;
    const hz = J.P[2] + 4.0 * s - len * 0.55;
    const hemC = [J.P[0] - (4.4 + sw) * s, J.P[1], Math.max(1.5, hz)];
    const hemL = vmad(hemC, J.Rp, -5.8 * s), hemR = vmad(hemC, J.Rp, 5.8 * s);
    const mid = vlerp(hemL, hemR, 0.5), midTop = vlerp(topL, topR, 0.5);
    const nrm = vnorm(vcross(vsub(topR, topL), vsub(hemL, topL)));
    S.poly([topL, topR, hemR, vmad(mid, J.Fp, -1.0 * s), hemL], col, nrm, { lv: [6, 4, 2], b: -0.1 });
    S.poly([topR, vmad(midTop, [0, 0, 1], -1 * s), vmad(mid, J.Fp, -1.0 * s), hemR], shadeHex(col, -0.1), nrm, { lv: [6, 4, 2], b: -0.09 });
    if (it.trim) S.line([hemL, vmad(mid, J.Fp, -1.0 * s), hemR], 1.0, it.trim, { b: -0.08 });
  },
  /** sack / basket / wood bundle on the back (villager carry) */
  load(S, J, L, tc, it) {
    const s = J.s, kind = it.kind;
    const c = vmad(vmad(J.s0, J.Uc, kind === 'wood' ? -3.2 * s : -1.4 * s), J.Fc, -4.6 * s);
    const D = vnorm(vadd(J.Uc, vmul(J.Fc, -0.12)));
    if (kind === 'wood') {
      const up = vnorm(vadd(vmul(J.Uc, 0.7), vmul(J.Rc, 0.62)));
      const side = vnorm(vcross(J.Fc, up));
      for (let i = 0; i < 4; i++) {
        const o = vadd(vmul(J.Fc, -((i & 1) ? 0.4 : 1.3) * s), vmul(side, (i - 1.5) * 1.55 * s));
        const a = vmad(vmad(c, o, 1), up, -7.0 * s), b = vmad(a, up, 17 * s);
        S.cap(a, b, 1.25 * s, 1.25 * s, i & 1 ? '#9a6a3c' : '#835628', { b: -0.3, lv: [7, 5, 3] });
        S.ball(b, 1.1 * s, '#e0be86', { b: -0.28, noEdge: true, lv: [7, 6, 5] });
      }
      const mid = vmad(c, up, 1.5 * s);
      S.cap(vmad(mid, side, -3.4 * s), vmad(mid, side, 3.4 * s), 0.6 * s, 0.6 * s, '#4a3220', { b: -0.25, noEdge: true });
    } else if (kind === 'food') {
      const cc = vmad(c, D, 3.8 * s);
      S.ell(cc, vmul(J.Fc, 3.5 * s), vmul(J.Rc, 4.2 * s), vmul(D, 4.6 * s), '#bb8d48', { b: -0.3, lv: [7, 5, 3] });
      S.ball(vmad(cc, D, 3.9 * s), 1.7 * s, '#d1402e', { b: -0.29 });
      S.ball(vmad(vmad(cc, D, 3.6 * s), J.Rc, 2.0 * s), 1.5 * s, '#86c14e', { b: -0.29 });
      S.ball(vmad(vmad(cc, D, 3.6 * s), J.Rc, -2.0 * s), 1.4 * s, '#f0b23a', { b: -0.29 });
    } else if (kind === 'gold' || kind === 'stone') {
      const cc = vmad(c, D, 3.6 * s);
      S.ell(cc, vmul(J.Fc, 3.7 * s), vmul(J.Rc, 4.1 * s), vmul(D, 4.8 * s), kind === 'gold' ? '#b99c64' : '#a39a88', { b: -0.3, lv: [7, 5, 3] });
      const cols = kind === 'gold' ? ['#ffd530', '#fff07a', '#e8b014'] : ['#8e8e96', '#b9b9c1', '#767680'];
      S.ball(vmad(cc, D, 4.0 * s), 1.9 * s, cols[0], { b: -0.29, lv: LV_METAL });
      S.ball(vmad(vmad(cc, D, 3.4 * s), J.Rc, 2.1 * s), 1.5 * s, cols[1], { b: -0.29, lv: LV_METAL });
      S.ball(vmad(vmad(cc, D, 3.4 * s), J.Rc, -2.1 * s), 1.6 * s, cols[2], { b: -0.29, lv: LV_METAL });
    }
    // straps over the shoulders
    S.line([vmad(J.shR, J.Uc, 0.4 * s), vmad(vmad(J.s0, J.Uc, 3.0 * s), J.Fc, -3.6 * s)], 0.8, '#3a2a1c', { b: -0.2 });
  },
  banner(S, J, L, tc, it, po) {
    const s = J.s, base = vmad(vmad(J.s0, J.Uc, -5.0 * s), J.Fc, -3.8 * s), top = vmad(base, J.Uc, 25 * s);
    S.cap(base, top, 0.55 * s, 0.42 * s, '#6a4a2a', { b: -0.3, lv: [6, 5, 3] });
    S.ball(top, 0.8 * s, GOLD, { b: -0.28, lv: LV_METAL });
    const back = vmul(J.Fc, -1), side = vmul(J.Rc, 1);
    const f0 = vmad(top, J.Uc, -1.2 * s), f1 = vmad(top, J.Uc, -10.0 * s);
    const wv = (it.wave || 0) + (po && po.sway || 0) * 1.5;
    S.poly([f0, vmad(vmad(f0, back, 9.0 * s), J.Uc, wv * s), vmad(vmad(f1, back, 8.0 * s), J.Uc, wv * 0.6 * s), vmad(f1, back, 0.3 * s)], it.col || tc.main, null, { lv: [7, 5, 3], b: -0.27 });
    S.line([f0, vmad(vmad(f0, back, 9.0 * s), J.Uc, wv * s), vmad(vmad(f1, back, 8.0 * s), J.Uc, wv * 0.6 * s), vmad(f1, back, 0.3 * s), f0], 0.9, it.trim || GOLD, { b: -0.26 });
  },
  fur(S, J, L, tc, it) {
    const s = J.s;
    S.revolve(vmad(J.s0, J.Uc, 0.2 * s), J.Uc, J.Fc, J.Rc, [[-1.7 * s, 3.1 * s, 4.9 * s], [-0.6 * s, 3.0 * s, 4.9 * s], [0.8 * s, 2.3 * s, 3.6 * s]], it.col || '#7a5a3a', { n: 12, tex: 'fur', d: S.dp(S.tv(J.s0)) + 0.01 });
  },
};

// ------------------------------------------------------------------ main draw
/** Draw a human in a solved pose. L = resolved look, tc = team colors. */
export function drawHuman(S, J, po, L, tc) {
  const s = J.s;
  if (L.back) for (const it of L.back) BACK[it.k](S, J, L, tc, it, po);
  drawLegs(S, J, L);
  drawTorso(S, J, L, tc, po);
  drawArms(S, J, L, po);
  drawHead(S, J, L, tc);
  // held items
  const W = po.W;
  if (W && W.show !== false) {
    const kind = W.tool || (L.weapon && L.weapon.kind);
    const spec = W.tool ? {} : (L.weapon || {});
    const G = W.hand === 'L' ? J.hdL : J.hdR;
    const D = vnorm(cvec(J, W.D));
    const fn = WEAPONS[kind];
    if (fn) fn(S, J, G, D, spec, L, tc, po);
  }
  drawExtras(S, J, po, L, tc);
  const SH = po.S;
  if (SH && L.shield) {
    const c = cvec(J, SH.c);
    const C = [J.hdL[0] + c[0] * s, J.hdL[1] + c[1] * s, J.hdL[2] + c[2] * s];
    const n = vnorm(cvec(J, SH.n));
    const fn = SHIELDS[L.shield.kind];
    if (fn) fn(S, J, C, n, L.shield, L, tc);
  }
}

function drawExtras(S, J, po, L, tc) {
  const X = po.X, s = J.s;
  if (!X) return;
  if (X.basket) {
    const c = vadd(J.hdL, [0, 0, -1.6 * s]);
    S.revolve(vmad(c, [0, 0, 1], -2.2 * s), [0, 0, 1], J.Fc, J.Rc, [[0, 2.6 * s, 3.4 * s], [2.0 * s, 3.0 * s, 3.9 * s], [3.6 * s, 3.2 * s, 4.1 * s]], '#b48846', { n: 12, tex: 'weave', lv: [7, 5, 3], d: S.dp(S.tv(c)) + 0.12 });
    S.ball(vmad(c, [0, 0, 1], 1.7 * s), 1.2 * s, '#c4372a', { b: 0.14 });
    S.ball(vmad(vmad(c, [0, 0, 1], 1.5 * s), J.Rc, 1.4 * s), 1.1 * s, '#7a2a6a', { b: 0.14 });
    S.ball(vmad(vmad(c, [0, 0, 1], 1.5 * s), J.Rc, -1.4 * s), 1.1 * s, '#9a2a3a', { b: 0.14 });
  }
  if (X.plank) {
    const c = J.hdL, W = J.Rc;
    S.cap(vmad(c, J.Fc, -1.0 * s), vmad(c, J.Fc, 4.5 * s), 0.8 * s, 0.8 * s, '#a87a42', { b: 0.15, lv: [6, 5, 3] });
  }
  if (X.glow) {
    const g = X.glow;
    const hp = vadd(J.hdL, [0, 0, 1.5 * s]);
    const p = S.P(hp);
    S.ext(p[0], p[1], 7 + 8 * g + 1);
    S.fn(S.dp(S.tv(hp)) + 0.5, ctx => {
      const R = 7 + 8 * g;
      const gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], R);
      gr.addColorStop(0, 'rgba(255,240,170,' + (0.75 * g) + ')'); gr.addColorStop(0.45, 'rgba(255,214,100,' + (0.35 * g) + ')'); gr.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p[0], p[1], R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }, true);
  }
}
export { BACK, HATS };
