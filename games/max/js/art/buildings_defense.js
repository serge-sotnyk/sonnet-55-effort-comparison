// Defensive structures: outpost, watch tower, guard tower, keep, palisade, stone wall, gate.
import { shade, mix, rgba, hash01 } from './common.js';
import * as P from './buildings_paint.js';
import { pal, stoneWall, mainWall, woodWall, roofMat, decorate } from './buildings_style.js';
import * as PR from './buildings_props.js';
import { SQ2 } from './buildings_kit.js';
const { tones } = P;

const merlonP = (base) => P.stoneP({ base, ch: 3, bw: 5, rough: 0.1 });

function line3(g, A, B, col, w, hl) {
  const c = g.c, a = g.P(A[0], A[1], A[2]), b = g.P(B[0], B[1], B[2]);
  c.lineCap = 'round';
  c.strokeStyle = 'rgba(15,8,4,0.5)'; c.lineWidth = w + 0.9; c.beginPath(); c.moveTo(a[0], a[1] + 0.3); c.lineTo(b[0], b[1] + 0.3); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  if (hl) { c.strokeStyle = hl; c.lineWidth = Math.max(0.5, w * 0.3); c.beginPath(); c.moveTo(a[0] - w * 0.2, a[1] - w * 0.2); c.lineTo(b[0] - w * 0.2, b[1] - w * 0.2); c.stroke(); }
  g.touchS(Math.min(a[0], b[0]) - w, Math.min(a[1], b[1]) - w); g.touchS(Math.max(a[0], b[0]) + w, Math.max(a[1], b[1]) + w);
}

// ----------------------------------------------------------------------------- OUTPOST
function outpost(g, age) {
  const tc = g.tc;
  const woodBase = age === 0 ? '#7a5230' : age === 1 ? '#8a6038' : age === 2 ? '#7e5a38' : '#8a6a44';
  const wood = age === 0 ? P.logsP({ base: woodBase, d: 4 }) : P.planksP({ base: woodBase, bw: 2.4, battens: false });
  const stone = P.stoneP({ base: '#8d877a', ch: 3.5, bw: 5, rough: 0.3 });
  const PZ = 38;
  g.ground(0, 0, 30, 30, '#4a3a22', 0.4);
  g.cast(-10, -10, 10, 10, 60, { k: 0.45 });
  const leg = (x, y) => {
    const sx = x * 0.78;                          // legs lean inward slightly toward the top (drawn as tapered by two boxes)
    g.box(x - 2.1, y - 2.1, 5, x + 2.1, y + 2.1, PZ, { left: wood, right: wood, top: wood, ao: 3, hl: false });
    if (age >= 1) g.box(x - 3.4, y - 3.4, 0, x + 3.4, y + 3.4, 5.5, { left: stone, right: stone, top: stone, ao: 2, hl: false });
    else g.box(x - 2.6, y - 2.6, 0, x + 2.6, y + 2.6, 5, { left: wood, right: wood, top: wood, ao: 2, hl: false });
  };
  leg(-9, -9);
  if (g.zcut > 6) {
    leg(9, -9); leg(-9, 9);
    if (g.want('prop') || g.stage >= 2) {
      // cross braces
      const bc = '#6a4a2a';
      line3(g, [-9, -9, 6], [9, -9, PZ - 4], bc, 1.8); line3(g, [9, -9, 6], [-9, -9, PZ - 4], bc, 1.8);
      line3(g, [-9, -9, 6], [-9, 9, PZ - 4], bc, 1.8); line3(g, [-9, 9, 6], [-9, -9, PZ - 4], bc, 1.8);
    }
    leg(9, 9);
    line3(g, [-9, 9, 6], [9, 9, PZ - 4], '#7a5a34', 2); line3(g, [9, 9, 6], [-9, 9, PZ - 4], '#7a5a34', 2);
    line3(g, [9, -9, 6], [9, 9, PZ - 4], '#7a5a34', 2); line3(g, [9, 9, 6], [9, -9, PZ - 4], '#7a5a34', 2);
  }
  if (g.stage >= 2) {
    const dk = P.planksP({ base: age >= 3 ? '#9a7a4c' : '#8a6a42', bw: 3, battens: false });
    g.box(-13, -13, PZ, 13, 13, PZ + 3.2, { left: dk, right: dk, top: (c, w, h) => { P.floorBoardsP({ base: '#8a6a42' })(c, w, h, () => 0.5); }, tag: 'wall', noCut: true, ao: 2 });
  }
  if (g.want('roof')) {
    // back posts + roof posts
    const rp = (x, y) => g.box(x - 1.5, y - 1.5, PZ + 3.2, x + 1.5, y + 1.5, PZ + 22, { left: wood, right: wood, top: wood, tag: 'roof', ao: 2, hl: false });
    rp(-10, -10); rp(10, -10); rp(-10, 10);
    // railing (back sides)
    line3(g, [-11, -11, PZ + 11], [11, -11, PZ + 11], '#6a4a2a', 1.4); line3(g, [-11, -11, PZ + 11], [-11, 11, PZ + 11], '#6a4a2a', 1.4);
    line3(g, [-11, -11, PZ + 6], [11, -11, PZ + 6], '#6a4a2a', 1.2); line3(g, [-11, -11, PZ + 6], [-11, 11, PZ + 6], '#6a4a2a', 1.2);
    const roofP = age === 0 ? P.thatchP({ base: '#c4a048', bh: 7 }) : age === 1 ? P.shinglesP({ base: '#8a6a44' }) : age === 2 ? P.tilesP({ base: '#b85a34' }) : P.tilesP({ base: '#9a3a34' });
    g.roofHip({ x0: -14, y0: -14, x1: 14, y1: 14, z: PZ + 22, rise: 15, ov: 2.5, paint: roofP, trim: age === 0 ? '#a2823a' : age === 3 ? '#e6bd44' : '#3a2a1c', ridge: null, thick: age === 0 ? 4 : 2.6 });
    rp(10, 10);
    line3(g, [-11, 11, PZ + 11], [11, 11, PZ + 11], '#7a5a34', 1.6); line3(g, [11, -11, PZ + 11], [11, 11, PZ + 11], '#7a5a34', 1.6);
    line3(g, [-11, 11, PZ + 6], [11, 11, PZ + 6], '#7a5a34', 1.4); line3(g, [11, -11, PZ + 6], [11, 11, PZ + 6], '#7a5a34', 1.4);
    // ladder on the SW face
    line3(g, [-5, 16, 0], [-5, 11, PZ + 1], '#8a6a40', 1.5); line3(g, [1, 16, 0], [1, 11, PZ + 1], '#8a6a40', 1.5);
    for (let z = 5; z < PZ; z += 5) { const t = z / (PZ + 1); line3(g, [-5, 16 - 5 * t, z], [1, 16 - 5 * t, z], '#a88050', 1.1); }
    g.flag(0, 0, PZ + 22 + 15, 12, { shape: 'swallow', w: 20, h: 12, amp: 1.7 });
  }
}

// ----------------------------------------------------------------------------- WATCH TOWER
function watchTower(g, age) {
  const tc = g.tc;
  const stoneC = age >= 3 ? '#d8d0bc' : '#8d877a';
  g.ground(0, 0, 30, 30, '#4a3a22', 0.4);
  g.cast(-14, -14, 14, 14, 80, { k: 0.45 });
  const wood = age === 0 ? woodWall(0, { base: '#7a5a38' }) : P.planksP({ base: age === 1 ? '#8a6038' : '#7a5a3a', bw: 3.6, rails: [0.1, 0.5, 0.9] });
  const stoneP = age <= 1 ? P.stoneP({ base: stoneC, ch: 5, bw: 8, rough: 0.35 }) : age === 2 ? P.stoneP({ base: '#a29c8e', ch: 6, bw: 9, rough: 0.2, moss: 0.3 }) : P.ashlarP({ base: stoneC, ch: 7, bw: 10 });
  const B = 12;
  if (age <= 1) {
    g.box(-14, -14, 0, 14, 14, 9, { left: stoneP, right: stoneP, top: false, ao: 3 });
    const body = (c, w, h, r) => { wood(c, w, h, r); P.timberFrame(c, w, h, r, { col: '#4a3220', pw: 22, brace: 'x', t: 2.2, sill: 2, top: 2 }); };
    const bodyL = decorate(body, (c, w, h) => { P.doorD(c, w / 2 - 4, h - 14, 8, 14, { wood: '#4a3018', frame: '#2a1c10', step: false, fr: 1.2 }); });
    g.box(-B, -B, 9, B, B, 52, { left: bodyL, right: body, top: false, eave: 0 });
  } else {
    const lf = decorate(stoneP, (c, w, h) => { P.doorD(c, w / 2 - 4.5, h - 16, 9, 16, { arch: true, wood: '#4a3018', frame: '#c4bca8', fr: 1.4, step: false }); P.slitD(c, 3.4, h - 38, 3, 11); P.slitD(c, w - 6.4, h - 38, 3, 11); });
    const rf = decorate(stoneP, (c, w, h) => { P.slitD(c, w / 2 - 1.5, h - 36, 3, 12); P.slitD(c, 4, h - 24, 3, 9); });
    g.box(-B, -B, 0, B, B, 52, { left: lf, right: rf, top: false, eave: 0 });
  }
  if (g.want('roof')) {
    const hp = age === 0 ? P.logsP({ base: '#6a4a2a', d: 4 }) : P.planksP({ base: '#6a4a2a', bw: 3.2, rails: [0.2, 0.8] });
    const hf = decorate(hp, (c, w, h) => { for (const u of [6, w - 11]) P.slitD(c, u, 3.5, 4.6, 6.5); P.bannerD(c, w / 2 - 3.5, h - 12, 7, 17, tc, { shape: 'cross' }); });
    const hr = decorate(hp, (c, w, h) => { for (const u of [6, w - 11]) P.slitD(c, u, 3.5, 4.6, 6.5); });
    g.box(-16, -16, 48, 16, 16, 64, { left: hf, right: hr, top: false, tag: 'roof', ao: 0, eave: 0 });
    g.box(-17.5, -17.5, 47, 17.5, 17.5, 50, { left: P.planksHP({ base: '#5a3e24', rh: 2 }), right: P.planksHP({ base: '#5a3e24', rh: 2 }), top: false, tag: 'roof', ao: 0 });
    const roofP = age === 0 ? P.thatchP({ base: '#c4a048', bh: 7 }) : age === 1 ? P.shinglesP({ base: '#8a6a44' }) : age === 2 ? P.slateP({ base: '#7b8494' }) : P.tilesP({ base: '#9a3a34' });
    g.roofHip({ x0: -18, y0: -18, x1: 18, y1: 18, z: 64, rise: 24, ov: 2.5, paint: roofP, trim: age === 3 ? '#e6bd44' : '#2e2016', thick: age === 0 ? 4 : 2.6 });
    g.flag(0, 0, 88, 14, { shape: 'swallow', w: 22, h: 13, amp: 1.8 });
  }
}

// ----------------------------------------------------------------------------- GUARD TOWER
function guardTower(g, age) {
  const tc = g.tc;
  const stoneC = age <= 1 ? '#8d877a' : age === 2 ? '#a29c8e' : '#d6cfbc';
  const R0 = 14.5, R1 = 12.6, H = 66;
  const rf = z => R0 + (R1 - R0) * z / H;
  g.ground(0, 0, 30, 30, '#4a3a22', 0.4);
  g.cast(-13, -13, 13, 13, 80, { k: 0.45 });
  const zt = Math.min(H, g.zcut);
  const pl = tones(stoneC, 7, 0.13);
  if (zt > 0.1) {
    g.lathe(0, 0, 0, zt, rf, { pal: pl, ch: age === 3 ? 9 : 8, bw: 9.5, hi: 0.22, mortar: age === 3 ? '#a89f8a' : undefined });
    if (zt >= H) {
      g.latheDecal(0, 0, rf(14), 2.3, 18, 9, 18, (c) => P.doorD(c, 0, 0, 9, 18, { arch: true, wood: '#4a3018', frame: age >= 2 ? '#d0c8b4' : '#3a2c20', fr: 1.5, step: false }));
      g.latheDecal(0, 0, rf(30), 1.1, 38, 4, 12, (c) => P.slitD(c, 0, 0, 3.4, 12));
      g.latheDecal(0, 0, rf(40), 2.5, 40, 4, 12, (c) => P.slitD(c, 0, 0, 3.4, 12));
      g.latheDecal(0, 0, rf(30), 1.7, 34, 7, 14, (c) => P.bannerD(c, 0, 0, 7, 14, tc, { shape: 'chevron' }));
      if (age === 3) { const [sx, sy] = g.lp(0, 0, 0, 0, 30); g.c.strokeStyle = '#e6bd44'; g.c.lineWidth = 1.6; g.c.beginPath(); g.c.ellipse(sx, sy, (rf(30) + 0.3) * SQ2, (rf(30) + 0.3) * SQ2 * 0.5, 0, 0.04, Math.PI - 0.04); g.c.stroke(); }
    }
  }
  if (g.want('roof')) {
    g.lathe(0, 0, H - 4, H, (z) => R1 + 0.6 + (z - (H - 4)) * 0.45, { pal: pl, ch: 4, bw: 8, hi: 0.2, ao: 0 });
    g.roundBattlement(0, 0, R1 + 2.4, H, { ph: 7, pal: pl });
    g.flag(0, 0, H + 1, 30, { shape: 'swallow', w: 22, h: 13, amp: 1.8 });
  }
}

// ----------------------------------------------------------------------------- KEEP (large fortified tower)
function keepTower(g, age) {
  const tc = g.tc;
  const stoneC = age <= 1 ? '#8d877a' : age === 2 ? '#a29c8e' : '#d6cfbc';
  const B = 14.5, H = 74;
  g.ground(0, 0, 32, 32, '#4a3a22', 0.4);
  g.cast(-17, -17, 17, 17, 90, { k: 0.4 });
  const stoneP = age <= 1 ? P.stoneP({ base: stoneC, ch: 7, bw: 11, rough: 0.3 }) : age === 2 ? P.stoneP({ base: stoneC, ch: 8, bw: 12, rough: 0.2, moss: 0.25 }) : P.ashlarP({ base: stoneC, ch: 9, bw: 14, band: [H - 12] });
  const lf = decorate(stoneP, (c, w, h) => { P.portcullisD(c, w / 2 - 6, h - 24, 12, 24, { frame: stoneC }); P.slitD(c, 4, h - 48, 3.2, 12); P.slitD(c, w - 7.2, h - 48, 3.2, 12); P.slitD(c, w / 2 - 1.6, h - 54, 3.2, 12); P.crestD(c, w / 2 - 5, h - 40, 10, 13, tc); });
  const rf = decorate(stoneP, (c, w, h) => { P.slitD(c, 6, h - 44, 3.2, 12); P.slitD(c, w - 9.2, h - 44, 3.2, 12); P.slitD(c, w / 2 - 1.6, h - 30, 3.2, 12); P.bannerD(c, w / 2 - 4, h - 60, 8, 20, tc, { shape: 'cross' }); });
  g.box(-B, -B, 0, B, B, H, { left: lf, right: rf, top: false, eave: 0 });
  if (g.want('roof')) {
    const mp = merlonP(stoneC);
    g.box(-B - 3, -B - 3, H - 4, B + 3, B + 3, H + 3, { left: P.stoneP({ base: stoneC, ch: 2.6, bw: 5, rough: 0.1 }), right: P.stoneP({ base: stoneC, ch: 2.6, bw: 5, rough: 0.1 }), top: false, tag: 'roof', ao: 0 });
    g.battlement(-B - 3, -B - 3, B + 3, B + 3, H + 3, { base: stoneC, paint: mp, ph: 7, t: 3.4, m: 6, gap: 4.4, floor: P.flagstoneP({ base: '#8a8478', sz: 5 }) });
    const rpal = age <= 1 ? tones('#c85a30', 6, 0.15) : age === 2 ? tones('#7b8494', 6, 0.14) : tones('#a8402e', 6, 0.14);
    for (const [tx, ty] of [[-B - 3, -B - 3], [B + 3, -B - 3], [-B - 3, B + 3], [B + 3, B + 3]]) {
      g.lathe(tx, ty, H + 3, H + 18, () => 4.6, { pal: tones(stoneC, 6, 0.13), ch: 6, bw: 6, hi: 0.2, ao: 0 });
      g.cone(tx, ty, 6.6, H + 18, H + 32, { pal: rpal, ch: 3.8, bw: 4.6, tip: 0.5, hi: 0.14 });
    }
    g.flag(0, 0, H + 3, 36, { shape: 'swallow', w: 26, h: 15, amp: 2 });
  }
}

// ----------------------------------------------------------------------------- PALISADE
function palisadeLog(g, x, y, h, r, tipH, col) {
  const c = g.c, [sx, sy] = g.P(x, y, 0), rx = r * SQ2, ry = rx * 0.5;
  const gr = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
  gr.addColorStop(0, shade(col, 0.28)); gr.addColorStop(0.35, col); gr.addColorStop(0.75, shade(col, -0.25)); gr.addColorStop(1, shade(col, -0.5));
  c.beginPath(); c.moveTo(sx - rx, sy); c.lineTo(sx - rx, sy - h + tipH); c.lineTo(sx - 0.4, sy - h); c.lineTo(sx + 0.4, sy - h); c.lineTo(sx + rx, sy - h + tipH); c.lineTo(sx + rx, sy);
  c.ellipse(sx, sy, rx, ry, 0, 0, Math.PI, false); c.closePath();
  c.fillStyle = gr; c.fill();
  c.strokeStyle = 'rgba(20,10,4,0.55)'; c.lineWidth = 0.7; c.stroke();
  // bark and cut surface
  c.strokeStyle = 'rgba(25,12,4,0.32)'; c.lineWidth = 0.6; c.beginPath();
  for (let k = 0; k < 3; k++) { const bx = sx - rx + (k + 0.7) * rx * 0.6; c.moveTo(bx, sy - 1 - (k * 5) % 7); c.lineTo(bx + 0.3, sy - h + tipH + 2 + (k * 7) % 9); }
  c.stroke();
  c.fillStyle = '#d9b878'; c.beginPath(); c.moveTo(sx - rx * 0.45, sy - h + tipH * 0.72); c.lineTo(sx - 0.4, sy - h); c.lineTo(sx + 0.4, sy - h); c.lineTo(sx + rx * 0.5, sy - h + tipH * 0.8); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(30,14,4,0.45)'; c.lineWidth = 0.5; c.stroke();
  g.touchS(sx - rx - 1, sy - h - 1); g.touchS(sx + rx + 1, sy + ry + 1);
}
function palisade(g, age, st) {
  const mask = st.mask | 0;
  const cols = tones('#8a6038', 5, 0.14);
  if (mask & 5) g.cast(mask & 4 ? -19 : -5, -3.5, mask & 1 ? 19 : 5, 3.5, 24, { k: 0.3, alpha: 0.28, blur: 4, contact: false });
  if (mask & 10) g.cast(-3.5, mask & 8 ? -19 : -5, 3.5, mask & 2 ? 19 : 5, 24, { k: 0.3, alpha: 0.28, blur: 4, contact: false });
  if (!(mask & 15) || mask === 0) g.cast(-5, -5, 5, 5, 30, { k: 0.3, alpha: 0.28, blur: 4, contact: false });
  const logs = [];
  const add = (x, y, h) => logs.push({ x, y, h });
  const jit = (s) => hash01(Math.round(Math.abs(s) * 10) + 17, 3, 9);
  // slot position s = distance from the tile edge (symmetric between neighbours)
  if (mask & 1) for (let a = 4; a <= 24; a += 4) add(a, ((jit(a - 16) - 0.5) * 1.6), 28 + (jit(a - 16 + 40) - 0.5) * 6);
  if (mask & 2) for (let a = 4; a <= 24; a += 4) add(((jit(a - 16 + 7) - 0.5) * 1.6), a, 28 + (jit(a - 16 + 47) - 0.5) * 6);
  if (mask & 4) for (let a = 4; a <= 16; a += 4) add(-a, ((jit(a - 16) - 0.5) * 1.6), 28 + (jit(a - 16 + 40) - 0.5) * 6);
  if (mask & 8) for (let a = 4; a <= 16; a += 4) add(((jit(a - 16 + 7) - 0.5) * 1.6), -a, 28 + (jit(a - 16 + 47) - 0.5) * 6);
  // central post cluster (taller)
  add(0, 0, 36); add(-3.4, 2.8, 33); add(3.2, -2.8, 33);
  logs.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const colFor = (l) => cols[Math.floor(hash01(Math.round(l.x * 3) + 5, Math.round(l.y * 3) + 9, 21) * 5) % 5];
  const zk = g.stage >= 4 ? 1 : g.stage === 3 ? 0.9 : g.stage === 2 ? 0.7 : g.stage === 1 ? 0.35 : 0;
  if (g.stage < 1) return;
  // rails first for far arms, then logs, then rails on the near arms
  const rail = (a, b, z, w) => line3(g, a, b, '#6a4a28', w, 'rgba(255,230,170,0.4)');
  if (mask & 4) { rail([-17, 2.4, 8 * zk], [0, 2.4, 8 * zk], 1.5); rail([-17, 2.4, 19 * zk], [0, 2.4, 19 * zk], 1.5); }
  if (mask & 8) { rail([2.4, -17, 8 * zk], [2.4, 0, 8 * zk], 1.5); rail([2.4, -17, 19 * zk], [2.4, 0, 19 * zk], 1.5); }
  for (const l of logs) palisadeLog(g, l.x, l.y, l.h * zk, 2.6, Math.min(8, 7 * zk + 1), colFor(l));
  if (mask & 1) { rail([0, 2.6, 8 * zk], [25, 2.6, 8 * zk], 1.6); rail([0, 2.6, 19 * zk], [25, 2.6, 19 * zk], 1.6); }
  if (mask & 2) { rail([2.6, 0, 8 * zk], [2.6, 25, 8 * zk], 1.6); rail([2.6, 0, 19 * zk], [2.6, 25, 19 * zk], 1.6); }
}

// ----------------------------------------------------------------------------- STONE WALL
const T2 = 5, WHT = 29, PIL = 8.2, PH = 37;
function wallFaces(age, tc) {
  const stoneC = age <= 1 ? '#8f897b' : age === 2 ? '#a29c8e' : '#d6cfbc';
  const sp = age <= 0 ? P.stoneP({ base: '#8a8474', ch: 7, bw: 11, rough: 0.5 }) : age === 1 ? P.stoneP({ base: stoneC, ch: 7, bw: 11, rough: 0.28 }) : age === 2 ? P.stoneP({ base: stoneC, ch: 7.5, bw: 12, rough: 0.2, moss: 0.3 }) : P.ashlarP({ base: stoneC, ch: 8, bw: 14, band: [WHT - 5] });
  return { stoneC, sp };
}
function armTop(stoneC) { return (c, w, h, r) => { c.fillStyle = shade(stoneC, 0.1); c.fillRect(-1, -1, w + 2, h + 2); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(-1, h * 0.5 - 0.4, w + 2, 0.8); }; }
const MER = [[-14.5, -9.5], [-6.5, -1.5], [1.5, 6.5], [9.5, 14.5], [17.5, 22.5]];   // merlon slots (symmetric about tile centre and tile edges)
function stoneArms(g, age, mask, cuts, pillar) {
  const { stoneC, sp } = wallFaces(age, g.tc);
  const top = armTop(stoneC), mp = merlonP(stoneC);
  const L = 24.5;
  const arm = (dir, fwd) => {
    // dir: 'x' or 'y';  fwd: true for +x/+y
    const a0 = fwd ? (pillar ? PIL - 1 : -0.6) : -16, a1 = fwd ? L : (pillar ? -(PIL - 1) : 0.6);
    const bx = dir === 'x' ? [a0, -T2, a1, T2] : [-T2, a0, T2, a1];
    g.box(bx[0], bx[1], 0, bx[2], bx[3], WHT, { left: sp, right: sp, top, ao: 4, eave: 0, tag: 'wall' });
    if (g.want('trim')) {
      const mer = MER.filter(([m0, m1]) => (fwd ? m0 >= a0 - 0.01 && m1 <= L + 0.01 && (pillar ? m0 >= PIL : true) : m1 <= a1 + 0.01 && m0 >= -16 && (pillar ? m1 <= -PIL : true)) && (fwd ? m0 > 0 : m1 < 0));
      const its = mer.map(([m0, m1]) => ({
        x0: dir === 'x' ? m0 : -T2, x1: dir === 'x' ? m1 : T2, y0: dir === 'x' ? -T2 : m0, y1: dir === 'x' ? T2 : m1,
        fn: () => g.box(dir === 'x' ? m0 : -T2, dir === 'x' ? -T2 : m0, WHT, dir === 'x' ? m1 : T2, dir === 'x' ? T2 : m1, WHT + 5, { left: mp, right: mp, top: top, tag: 'trim', ao: 0, hl: false }),
      }));
      g.sorted(its);
    }
    if (!fwd && cuts) {                          // no outline where the arm continues into the neighbouring tile
      if (dir === 'x') g.cut(-19.5, -T2 - 2, -2, -15.5, T2 + 2, WHT + 7); else g.cut(-T2 - 2, -19.5, -2, T2 + 2, -15.5, WHT + 7);
    }
  };
  return arm;
}
function stoneWallSprite(g, age, st) {
  const mask = st.mask | 0;
  const { stoneC, sp } = wallFaces(age, g.tc);
  const straight = mask === 5 || mask === 10;
  { const px = straight ? 0 : PIL, ax0 = mask & 4 ? -19 : -px - 1, ax1 = mask & 1 ? 19 : px + 1, ay0 = mask & 8 ? -19 : -px - 1, ay1 = mask & 2 ? 19 : px + 1;
    if (mask & 5) g.cast(ax0, -(straight ? T2 : PIL), ax1, straight ? T2 : PIL, 36, { k: 0.4, alpha: 0.3, blur: 4, contact: false });
    if (mask & 10) g.cast(-(straight ? T2 : PIL), ay0, straight ? T2 : PIL, ay1, 36, { k: 0.4, alpha: 0.3, blur: 4, contact: false });
    if (!straight) g.cast(-PIL, -PIL, PIL, PIL, 42, { k: 0.4, alpha: 0.3, blur: 4, contact: false }); }
  const arm = stoneArms(g, age, mask, true, !straight);
  if (mask & 4) arm('x', false);
  if (mask & 8) arm('y', false);
  if (!straight) {
    // corner / end / junction pillar
    const pf = decorate(sp, (c, w, h) => { P.slitD(c, w / 2 - 1.4, h - 22, 2.8, 10); P.bannerD(c, w / 2 - 3, 3, 6, 10, g.tc, { shape: 'cross' }); });
    const pr = decorate(sp, (c, w, h) => { P.slitD(c, w / 2 - 1.4, h - 22, 2.8, 10); });
    g.box(-PIL, -PIL, 0, PIL, PIL, PH, { left: pf, right: pr, top: false, eave: 0 });
    if (g.want('trim')) {
      const mp = merlonP(stoneC);
      g.box(-PIL - 1.2, -PIL - 1.2, PH - 3, PIL + 1.2, PIL + 1.2, PH + 1, { left: mp, right: mp, top: false, tag: 'trim', ao: 0 });
      g.battlement(-PIL - 1.2, -PIL - 1.2, PIL + 1.2, PIL + 1.2, PH + 1, { base: stoneC, paint: mp, ph: 5.5, t: 2.8, m: 5, gap: 3.4, floor: armTop(stoneC) });
    }
  }
  const afwd = stoneArms(g, age, mask, false, !straight);
  if (mask & 1) afwd('x', true);
  if (mask & 2) afwd('y', true);
}

// ----------------------------------------------------------------------------- GATE
function gateSprite(g, age, st) {
  const tc = g.tc, open = !!st.open, axis = st.axis === 'y' ? 'y' : 'x';
  const wooden = age === 0;
  const { stoneC, sp } = wallFaces(Math.max(1, age), tc);
  const logP = P.logsP({ base: '#7a5230', d: 5 });
  const bodyP = wooden ? logP : sp;
  const mp = merlonP(stoneC);
  const GH = 46, TW0 = 8, TW1 = 16, TB = 8.5;
  if (axis === 'x') g.cast(-16, -9, 22, 9, 44, { k: 0.4, alpha: 0.3, blur: 4, contact: false }); else g.cast(-9, -16, 9, 22, 44, { k: 0.4, alpha: 0.3, blur: 4, contact: false });
  // helpers mapping (a along the wall, b across) to world x,y
  const bx = (a0, b0, z0, a1, b1, z1, along, end, o2) => {
    const x = axis === 'x' ? [a0, b0, a1, b1] : [b0, a0, b1, a1];
    g.box(x[0], x[1], z0, x[2], x[3], z1, Object.assign(axis === 'x' ? { left: along, right: end } : { right: along, left: end }, o2));
  };
  const planeAcross = (b, a0, a1, z0, z1, painter, o2) => axis === 'x' ? g.planeY(b, [[a0, z0], [a1, z0], [a1, z1], [a0, z1]], painter, o2) : g.planeX(b, [[a0, z0], [a1, z0], [a1, z1], [a0, z1]], painter, o2);
  const planeAlong = (a, b0, b1, z0, z1, painter, o2) => axis === 'x' ? g.planeX(a, [[b0, z0], [b1, z0], [b1, z1], [b0, z1]], painter, o2) : g.planeY(a, [[b0, z0], [b1, z0], [b1, z1], [b0, z1]], painter, o2);
  const along = decorate(bodyP, (c, w, h) => { P.slitD(c, w / 2 - 1.5, 6, 3, 11); if (!wooden) P.bannerD(c, w / 2 - 3.5, 20, 7, 14, tc, { shape: 'chevron' }); });
  const endf = decorate(bodyP, (c, w, h) => { P.slitD(c, w / 2 - 1.5, 6, 3, 11); });
  // forward connector (+a): wall stub reaching into the next tile
  const forward = () => {
    const a0 = TW1 - 1, a1 = 24.5, top = armTop(stoneC);
    const aP = wooden ? P.logsP({ base: '#7a5230', d: 5 }) : sp;
    bx(a0, -T2, 0, a1, T2, WHT, aP, aP, { top, ao: 4, eave: 0 });
    if (!wooden && g.want('trim')) {
      const items = [[17.5, 22]].map(([m0, m1]) => ({ x0: axis === 'x' ? m0 : -T2, x1: axis === 'x' ? m1 : T2, y0: axis === 'x' ? -T2 : m0, y1: axis === 'x' ? T2 : m1, fn: () => bx(m0, -T2, WHT, m1, T2, WHT + 5, mp, mp, { top, tag: 'trim', ao: 0, hl: false }) }));
      g.sorted(items);
    }
  };
  // back tower (-a)
  bx(-TW1, -TB, 0, -TW0, TB, GH, along, endf, { top: false, eave: 0 });
  if (g.want('trim')) { const ax0 = -TW1 - 1, ax1 = -TW0 + 1; const r = axis === 'x' ? [ax0, -TB - 1, ax1, TB + 1] : [-TB - 1, ax0, TB + 1, ax1]; g.battlement(r[0], r[1], r[2], r[3], GH, { base: stoneC, paint: mp, ph: 6, t: 3, m: 4, gap: 3, floor: armTop(stoneC) }); }
  // lintel
  const lin = decorate(bodyP, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, h - 3, w, 3); if (!wooden) P.crestD(c, w / 2 - 4, 1.5, 8, 10, tc); });
  bx(-TW0, -TB + 2, 31, TW0, TB - 2, GH - 2, lin, lin, { top: armTop(stoneC), eave: 0, ao: 0 });
  if (g.want('trim')) { const r = axis === 'x' ? [-TW0, -TB + 2, TW0, TB - 2] : [-TB + 2, -TW0, TB - 2, TW0]; g.battlement(r[0], r[1], r[2], r[3], GH - 2, { base: stoneC, paint: mp, ph: 5, t: 2.6, m: 4, gap: 3, floor: armTop(stoneC), sides: axis === 'x' ? 'ns' : 'we' }); }
  // doors
  const doorP = (c, w, h) => { P.planksP({ base: wooden ? '#6a4a2a' : '#4e3622', bw: 3.2, rails: [0.14, 0.52, 0.86] })(c, w, h, () => 0.5); c.fillStyle = '#2a2a30'; c.fillRect(0, h * 0.14 - 1.2, w, 2.4); c.fillRect(0, h * 0.52 - 1.2, w, 2.4); c.fillRect(0, h * 0.86 - 1.2, w, 2.4); c.fillStyle = '#c8a050'; c.beginPath(); c.arc(w / 2 - 2.4, h * 0.5, 1.2, 0, 7); c.arc(w / 2 + 2.4, h * 0.5, 1.2, 0, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(w / 2 - 0.4, 0, 0.8, h); };
  if (g.stage >= 3) {
    if (!open) planeAcross(1.5, -TW0, TW0, 0, 31, doorP, { light: axis === 'x' ? 'left' : 'right', eave: 6, ao: 3 });
    else {
      planeAlong(-TW0 + 0.8, 0, 12, 0, 30, doorP, { light: axis === 'x' ? 'right' : 'left' });
      planeAlong(TW0 - 0.8, 0, 12, 0, 30, doorP, { light: axis === 'x' ? 'right' : 'left' });
    }
  }
  // front tower (+a)
  bx(TW0, -TB, 0, TW1, TB, GH, along, endf, { top: false, eave: 0 });
  if (g.want('trim')) { const ax0 = TW0 - 1, ax1 = TW1 + 1; const r = axis === 'x' ? [ax0, -TB - 1, ax1, TB + 1] : [-TB - 1, ax0, TB + 1, ax1]; g.battlement(r[0], r[1], r[2], r[3], GH, { base: stoneC, paint: mp, ph: 6, t: 3, m: 4, gap: 3, floor: armTop(stoneC) }); }
  forward();
  if (g.want('prop')) {
    const [fx, fy] = axis === 'x' ? [0, 0] : [0, 0];
    g.flag(0, 0, GH - 2 + 6, 20, { shape: 'pennant', w: 17, h: 8, amp: 1.3, emblem: false });
  }
}

export const DEFS = {
  outpost: { hmax: 100, Hc: 40, fp: [-13, -13, 13, 13], draw: outpost, side: 40 },
  watch_tower: { hmax: 125, Hc: 52, fp: [-14, -14, 14, 14], draw: watchTower, side: 40 },
  guard_tower: { hmax: 125, Hc: 66, fp: [-14, -14, 14, 14], draw: guardTower, side: 40 },
  keep: { hmax: 150, Hc: 74, fp: [-15, -15, 15, 15], draw: keepTower, side: 40 },
  palisade: { hmax: 60, Hc: 30, fp: [-6, -6, 6, 6], draw: palisade, side: 24, noScaffold: true },
  stone_wall: { hmax: 70, Hc: 30, fp: [-8, -8, 8, 8], draw: stoneWallSprite, side: 24, noScaffold: true },
  gate: { hmax: 80, Hc: 46, fp: [-10, -10, 10, 10], draw: gateSprite, side: 24, noScaffold: true },
};
