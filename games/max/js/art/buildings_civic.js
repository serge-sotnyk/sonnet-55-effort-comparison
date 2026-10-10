// Civic and grand buildings: market, monastery, university, castle, wonder.
import { shade, mix, rgba } from './common.js';
import * as P from './buildings_paint.js';
import { pal, stoneWall, mainWall, woodWall, roofMat, decorate } from './buildings_style.js';
import * as PR from './buildings_props.js';
import { SQ2 } from './buildings_kit.js';
import { chimney } from './buildings_eco.js';
const { tones } = P;

const door = (u, dw, dh, o) => (c, w, h) => P.doorD(c, u < 0 ? w + u : u, h - dh, dw, dh, o);
const win = (u, v, ww, wh, o) => (c, w, h) => P.windowD(c, u < 0 ? w + u : u, v < 0 ? h + v : v, ww, wh, o);

/** bunting: sagging line between two screen points with team coloured flags */
function bunting(g, A, B, n = 6, sag = 4) {
  if (!g.want('prop')) return;
  const c = g.c, tc = g.tc, a = g.P(A[0], A[1], A[2]), b = g.P(B[0], B[1], B[2]);
  const pt = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * sag];
  c.strokeStyle = '#2a1c10'; c.lineWidth = 0.9; c.beginPath();
  for (let i = 0; i <= 20; i++) { const p = pt(i / 20); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = pt(t), q = pt(t + 0.5 / n);
    c.fillStyle = i & 1 ? '#f0e8d0' : tc.main;
    c.beginPath(); c.moveTo(p[0] - 2.4, p[1]); c.lineTo(p[0] + 2.4, p[1]); c.lineTo(p[0], p[1] + 5); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,10,4,0.55)'; c.lineWidth = 0.6; c.stroke();
  }
  g.touchS(Math.min(a[0], b[0]) - 3, Math.min(a[1], b[1]) - 2); g.touchS(Math.max(a[0], b[0]) + 3, Math.max(a[1], b[1]) + sag + 8);
}

// ----------------------------------------------------------------------------- MARKET
function stall(g, cx, cy, axis, tc, age, kind) {
  // table + posts + striped lean-to awning; axis 'y': customer side faces +y (SW); axis 'x': faces +x (SE)
  const W = 20, D = 9;
  const wood = P.planksP({ base: age === 0 ? '#7a5a38' : '#8a6038', bw: 3, battens: false });
  const [x0, x1, y0, y1] = axis === 'y' ? [cx - W / 2, cx + W / 2, cy - D / 2, cy + D / 2] : [cx - D / 2, cx + D / 2, cy - W / 2, cy + W / 2];
  const clothP = P.clothP({ base: '#f0e6cc', stripe: tc.main, sw: 4.6 });
  // back posts
  const pst = (x, y, z) => g.box(x - 1.2, y - 1.2, 0, x + 1.2, y + 1.2, z, { left: wood, right: wood, top: wood, ao: 2, hl: false });
  if (axis === 'y') { pst(x0 + 1.5, y0 + 1.5, 26); pst(x1 - 1.5, y0 + 1.5, 26); } else { pst(x0 + 1.5, y0 + 1.5, 26); pst(x0 + 1.5, y1 - 1.5, 26); }
  // table
  const tp = (c, w, h, r) => { c.fillStyle = '#9a7448'; c.fillRect(-1, -1, w + 2, h + 2); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 3; i < w; i += 4) c.fillRect(i, 0, 0.8, h); };
  g.box(x0 + 1, y0 + 2, 0, x1 - 1, y1 - 0.5, 9, { left: wood, right: wood, top: tp, ao: 3, hl: false });
  // goods on the table
  const items = kind === 'fruit' ? ['#d83a2a', '#e8b82a', '#4a9a3a', '#d83a2a', '#e86a2a'] : kind === 'cloth' ? [tc.main, '#e8d8a8', '#3a8a5a', '#c84a9a', tc.light] : ['#b8683a', '#8a5a34', '#c8a060', '#6a8a9a', '#b8683a'];
  const c = g.c;
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5, gx = axis === 'y' ? x0 + 1 + (W - 2) * t : (x0 + x1) / 2, gy = axis === 'y' ? (y0 + y1) / 2 + 0.5 : y0 + 1 + (W - 2) * t;
    const [sx, sy] = g.P(gx, gy, 9);
    if (kind === 'fruit') { c.fillStyle = items[i]; c.beginPath(); c.arc(sx, sy - 1.8, 2.1, 0, 7); c.fill(); c.beginPath(); c.arc(sx + 2.2, sy - 0.6, 1.8, 0, 7); c.fill(); c.strokeStyle = 'rgba(20,10,4,0.5)'; c.lineWidth = 0.5; c.stroke(); }
    else if (kind === 'cloth') { c.fillStyle = items[i]; c.fillRect(sx - 2.2, sy - 4.2, 4.4, 4.6); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(sx - 2.2, sy - 4.2, 4.4, 1); c.strokeStyle = 'rgba(20,10,4,0.5)'; c.lineWidth = 0.5; c.strokeRect(sx - 2.2, sy - 4.2, 4.4, 4.6); }
    else { c.fillStyle = items[i]; c.beginPath(); c.moveTo(sx - 2.2, sy); c.quadraticCurveTo(sx - 3, sy - 4, sx - 1, sy - 5.5); c.lineTo(sx + 1, sy - 5.5); c.quadraticCurveTo(sx + 3, sy - 4, sx + 2.2, sy); c.closePath(); c.fill(); c.strokeStyle = 'rgba(20,10,4,0.5)'; c.lineWidth = 0.5; c.stroke(); }
    g.touchS(sx - 4, sy - 7); g.touchS(sx + 4, sy + 2);
  }
  // awning
  if (axis === 'y') g.roofShed({ x0: x0 - 1, y0: y0, x1: x1 + 1, y1: y1 + 2, zHigh: 27, zLow: 19, ov: 2, ovg: 0, paint: clothP, trim: tc.dark, slope: 'y', thick: 2 });
  else g.roofShed({ x0: x0, y0: y0 - 1, x1: x1 + 2, y1: y1 + 1, zHigh: 27, zLow: 19, ov: 2, ovg: 0, paint: clothP, trim: tc.dark, slope: 'x', thick: 2 });
}
function market(g, age) {
  const tc = g.tc;
  const stoneC = age >= 3 ? '#dcd5c2' : '#a29c8c';
  g.ground(0, 0, 90, 90, '#5a4a32', 0.3);
  g.cast(-22, -22, 22, 22, 44, { contact: false });
  // platform
  const pf = age <= 0 ? P.dirtP({ base: '#6a5034' }) : P.flagstoneP({ base: age >= 2 ? '#9a9486' : '#8a7e68', sz: 8 });
  const side = age <= 0 ? P.dirtP({ base: '#5a4026' }) : P.stoneP({ base: stoneC, ch: 3, bw: 7, rough: 0.2 });
  g.box(-45, -45, 0, 45, 45, age <= 0 ? 1.5 : 2.6, { left: side, right: side, top: pf, ao: 0, hl: false });
  const zp = age <= 0 ? 1.5 : 2.6;
  // back stalls
  const sg = (cx, cy, ax, kind) => g.stage >= 3 ? stall(g, cx, cy, ax, tc, age, kind) : null;
  sg(-30, -32, 'y', 'cloth'); sg(30, -32, 'y', 'fruit');
  sg(-37, 6, 'x', 'pots');
  // pavilion posts (back), table, roof
  const wood = age >= 2 ? P.stoneP({ base: stoneC, ch: 5, bw: 6, rough: 0.2 }) : P.planksP({ base: '#7a5530', bw: 2.6, battens: false });
  const ph = 34;
  const post = (x, y) => g.box(x - 2.2, y - 2.2, zp, x + 2.2, y + 2.2, zp + ph, { left: wood, right: wood, top: wood, ao: 3, hl: false, noCut: false });
  post(-21, -21); post(21, -21);
  if (g.want('prop')) {
    PR.crate(g, -6, -8, 8, { z: zp }); PR.crate(g, 4, -10, 7, { z: zp, col: '#9a7a44' }); PR.crate(g, 10, 0, 8, { z: zp });
    PR.sack(g, -12, 4, { s: 0.9 }); PR.sack(g, -17, 0, { s: 0.8, col: '#d8c488' });
  }
  post(-21, 21); post(21, 21);
  const clothP = P.clothP({ base: '#f0e6cc', stripe: tc.main, sw: 6 });
  const roofP = age >= 2 ? (age === 2 ? P.tilesP({ base: '#b85a34' }) : P.copperP({ base: '#4f9a86' })) : clothP;
  g.roofHip({ x0: -27, y0: -27, x1: 27, y1: 27, z: zp + ph, rise: age >= 2 ? 24 : 21, ov: 3, paint: roofP, trim: age >= 3 ? '#e6bd44' : tc.dark, thick: 2.4 });
  if (g.want('prop')) {
    PR.barrel(g, 14, 30, { r: 4.6, h: 10 }); PR.barrel(g, 22, 31, { r: 4.4, h: 9.5 });
    PR.crate(g, -26, 32, 8, { z: zp }); PR.crate(g, -17, 33, 7, { z: zp });
    PR.sack(g, 34, 20, { s: 0.9 }); PR.sack(g, 38, 12, { s: 0.85, col: '#d8c488' });
    bunting(g, [-21, 21, zp + ph - 3], [21, 21, zp + ph - 3], 7, 5);
    bunting(g, [21, 21, zp + ph - 3], [21, -21, zp + ph - 3], 7, 5);
    const apex = [0, 0, zp + ph + (age >= 2 ? 24 : 21)];
    g.flag(apex[0], apex[1], apex[2], 20, { w: 24, h: 14, shape: 'swallow', amp: 2 });
  }
}

// ----------------------------------------------------------------------------- MONASTERY
function monastery(g, age) {
  const tc = g.tc;
  const NX0 = -22, NX1 = 20, NY0 = -46, NY1 = 26, zw = [38, 42, 46, 48][age], rise = [20, 20, 22, 24][age], ov = 3;
  const stoneC = age >= 3 ? '#dcd5c2' : '#b0aa9a';
  g.ground(0, 0, 82, 82, '#4a4a30', 0.3);
  g.cast(NX0, NY0, NX1, NY1, zw + rise * 0.7);
  g.cast(20, -26, 44, -2, 90, { contact: false });
  const wall = age === 0 ? woodWall(0, { base: '#7a5a38' }) : age === 1 ? mainWall(1, { pw: 22, brace: 'x' }) : age === 2 ? stoneWall(2, { base: '#aaa496' }) : stoneWall(3, { band: [28, 54] });
  const nave = decorate(wall,
    (c, w, h) => { for (const u of [6, w - 14]) P.lancetD(c, u, 8, 7, 22, { frame: age >= 2 ? stoneC : '#6a5a46' }); },
    (c, w, h) => { for (const u of [20, 45]) P.lancetD(c, u, 8, 7, 22, { frame: age >= 2 ? stoneC : '#6a5a46' }); });
  const front = decorate(wall,
    (c, w, h) => { P.doorD(c, w / 2 - 8, h - 30, 16, 30, { style: 'archdouble', surround: age >= 2 ? '#d8d0bc' : '#6a5a46', wood: '#4a3018', frame: age === 3 ? '#e6bd44' : '#2e2016', stepColor: stoneC }); },
    (c, w, h) => { P.roseD(c, w / 2, 14 + 8, 9, { frame: age >= 2 ? '#d8d0bc' : '#6a5a46' }); },
    (c, w, h) => { P.lancetD(c, 4, h - 28, 6, 18, { frame: age >= 2 ? stoneC : '#6a5a46' }); P.lancetD(c, w - 10, h - 28, 6, 18, { frame: age >= 2 ? stoneC : '#6a5a46' }); },
    (c, w, h) => { P.bannerD(c, 1, h - 34, 6, 20, tc, { shape: 'cross' }); P.bannerD(c, w - 7, h - 34, 6, 20, tc, { shape: 'cross' }); });
  const roofP = age === 0 ? P.thatchP({ base: '#c4a048', bh: 8 }) : age === 1 ? roofMat(1, 'main', { base: '#c85a30' }) : age === 2 ? roofMat(2, 'slate', { base: '#7b8494' }) : roofMat(3, 'main', { base: '#8a4a58' });
  const trim = age === 0 ? '#a2823a' : age === 3 ? '#e6bd44' : '#3a2c20';
  g.gableBlock({ x0: NX0, y0: NY0, x1: NX1, y1: NY1, z0: 0, zw, rise, axis: 'y', long: nave, end: front, ov, ovg: 3, ovb: 3, roof: roofP, trim, ridge: age === 3 ? '#e6bd44' : tc.main, ridgeW: 3.4, thick: 3, eave: ov });
  // buttresses along the nave's right wall 
  if (age >= 1) for (let y = 6; y <= 20; y += 14) {
    const bp = age >= 2 ? P.stoneP({ base: stoneC, ch: 5, bw: 6, rough: 0.2 }) : P.planksP({ base: '#6a4a2a', bw: 3, battens: false });
    g.box(NX1, y - 2.5, 0, NX1 + 5, y + 2.5, zw - 12, { left: bp, right: bp, top: bp, ao: 3, hl: false });
    g.box(NX1, y - 2.5, zw - 12, NX1 + 2.5, y + 2.5, zw - 4, { left: bp, right: bp, top: bp, ao: 0, hl: false });
  }
  // gable cross
  if (g.want('prop')) { const [cx, cy] = g.P(0, NY1 + 3, zw + rise + 2); g.c.fillStyle = '#e6bd44'; g.c.strokeStyle = '#6a4a10'; g.c.lineWidth = 0.7; g.c.fillRect(cx - 0.9, cy - 11, 1.8, 11); g.c.fillRect(cx - 3.6, cy - 8.2, 7.2, 1.8); g.c.strokeRect(cx - 0.9, cy - 11, 1.8, 11); g.touchS(cx - 5, cy - 12); }
  // bell tower (front right)
  const TX0 = 20, TX1 = 44, TY0 = -26, TY1 = -2, TH = [66, 72, 78, 82][age];
  const tw = decorate(wall,
    (c, w, h) => { P.lancetD(c, w / 2 - 3.5, h - 46, 7, 20, { frame: age >= 2 ? stoneC : '#6a5a46' }); },
    (c, w, h) => { for (const u of [w * 0.5 - 8, w * 0.5 + 2]) P.doorD(c, u, 6, 6.5, 14, { style: 'open', arch: true, surround: age >= 2 ? stoneC : '#5a4026', fr: 1.4 }); },
    (c, w, h) => { P.bannerD(c, 2, h - 40, 6, 20, tc, { shape: 'chevron' }); });
  const twR = decorate(wall,
    (c, w, h) => { P.lancetD(c, w / 2 - 3.5, h - 46, 7, 20, { frame: age >= 2 ? stoneC : '#6a5a46' }); },
    (c, w, h) => { for (const u of [w * 0.5 - 8, w * 0.5 + 2]) P.doorD(c, u, 6, 6.5, 14, { style: 'open', arch: true, surround: age >= 2 ? stoneC : '#5a4026', fr: 1.4 }); });
  g.box(TX0, TY0, 0, TX1, TY1, TH, { left: tw, right: twR, top: false, eave: 0 });
  if (g.want('roof')) {
    const spireP = age === 0 ? P.thatchP({ base: '#c4a048' }) : age === 1 ? P.panTilesP({ base: '#cf6030' }) : age === 2 ? P.slateP({ base: '#7b8494' }) : P.copperP({ base: '#4f9a86' });
    g.box(TX0 - 1.5, TY0 - 1.5, TH - 2, TX1 + 1.5, TY1 + 1.5, TH + 2, { left: P.stoneP({ base: stoneC, ch: 2, bw: 5 }), right: P.stoneP({ base: stoneC, ch: 2, bw: 5 }), top: false, tag: 'trim', ao: 0 });
    g.roofHip({ x0: TX0 - 1.5, y0: TY0 - 1.5, x1: TX1 + 1.5, y1: TY1 + 1.5, z: TH + 2, rise: 38, ov: 1.5, paint: spireP, trim: '#2e2016', ridge: null });
    const [fx, fy] = g.P((TX0 + TX1) / 2, (TY0 + TY1) / 2, TH + 2 + 38);
    g.c.fillStyle = '#e6bd44'; g.c.strokeStyle = '#6a4a10'; g.c.lineWidth = 0.7; g.c.fillRect(fx - 1, fy - 14, 2, 14); g.c.fillRect(fx - 4, fy - 10.5, 8, 2); g.c.strokeRect(fx - 1, fy - 14, 2, 14); g.touchS(fx - 5, fy - 15);
  }
  if (g.want('prop')) {
    g.flag(TX1 - 2, TY1 - 2, TH + 2, 12, { shape: 'pennant', w: 16, h: 8, amp: 1.3, emblem: false });
    PR.barrel(g, -30, 30, { r: 4.2, h: 9 }); PR.sack(g, 4, 32, { s: 0.8 });
  }
}

// ----------------------------------------------------------------------------- UNIVERSITY
function parapet(g, x0, y0, x1, y1, z, h, paint) {
  const t = 2.4;
  const items = [];
  const add = (a, b, c2, d) => items.push({ x0: a, y0: b, x1: c2, y1: d, fn: () => g.box(a, b, z, c2, d, z + h, { left: paint, right: paint, top: paint, tag: 'wall', noCut: true, ao: 0, hl: false }) });
  add(x0, y0, x1, y0 + t); add(x0, y0, x0 + t, y1); add(x0, y1 - t, x1, y1); add(x1 - t, y0, x1, y1);
  g.sorted(items);
}
function university(g, age) {
  const tc = g.tc;
  const X0 = -42, X1 = 42, Y0 = -34, Y1 = 22, zw = [34, 38, 42, 44][age];
  const stoneC = age >= 3 ? '#e4dcc8' : '#b0aa9a';
  g.ground(0, 0, 86, 86, '#4a4a30', 0.3);
  g.cast(X0, Y0, X1, Y1, zw + 16);
  const wall = age === 0 ? woodWall(0, { base: '#7a5a38' }) : age === 1 ? mainWall(1, { pw: 24, brace: 'v' }) : age === 2 ? stoneWall(2, { base: '#aaa496' }) : stoneWall(3, { band: [zw - 6] });
  const winO = { style: 'arch', surround: stoneC, glassA: '#9ac0d8' };
  const fac = decorate(wall,
    (c, w, h) => { for (const u of [8, 20, 62, 74]) { P.windowD(c, u, 8, 7, 12, age === 0 ? { style: 'plain' } : winO); P.windowD(c, u, h - 20, 7, 12, age === 0 ? { style: 'plain' } : winO); } },
    (c, w, h) => { P.doorD(c, w / 2 - 8, h - 24, 16, 24, { style: 'archdouble', surround: age >= 2 ? '#e0d8c4' : '#6a5a46', wood: '#4a3018', frame: age === 3 ? '#e6bd44' : '#2e2016', stepColor: stoneC }); });
  const endw = decorate(wall, (c, w, h) => { for (const u of [10, 30, 50]) { P.windowD(c, u, 8, 7, 12, age === 0 ? { style: 'plain' } : winO); P.windowD(c, u, h - 20, 7, 12, age === 0 ? { style: 'plain' } : winO); } });
  g.box(X0, Y0, 0, X1, Y1, zw, { left: fac, right: endw, top: P.flagstoneP({ base: '#8a8478', sz: 7 }), eave: 3 });
  if (g.want('trim')) parapet(g, X0, Y0, X1, Y1, zw, 5, P.stoneP({ base: stoneC, ch: 2.5, bw: 5, rough: 0.1 }));
  // central drum + dome
  const cx = 0, cy = (Y0 + Y1) / 2 - 2, dz0 = zw + 2, dz1 = dz0 + 18, R = 21;
  g.cast(-R, cy - R, R, cy + R, dz1 + 14, { contact: false });
  const drumPal = tones(age === 0 ? '#9a7a50' : stoneC, 6, 0.1);
  if (dz0 - 2 <= g.zcut || g.stage >= 3) {
    g.lathe(cx, cy, zw - 0.5, dz1, () => R, { pal: drumPal, ch: 9, bw: 12, hi: 0.2 });
    for (let i = 0; i < 5; i++) { const th = 0.45 + i * 0.55; g.latheDecal(cx, cy, R, th, zw + 4, 6, 11, (c) => P.windowD(c, 0, 0, 6, 11, { style: age === 0 ? 'plain' : 'arch', fr: 1.2, glassA: '#9ac0d8' })); }
  }
  if (g.want('roof')) {
    const domePal = age === 0 ? tones('#c4a048', 6, 0.16) : age === 1 ? tones('#c85a30', 6, 0.15) : age === 2 ? tones('#4f9a86', 6, 0.14) : tones('#3a9a8a', 6, 0.12);
    g.dome(cx, cy, R + 1.5, dz1, dz1 + 28, (t) => Math.sqrt(Math.max(0, 1 - t * t)) * 0.98 + 0.02, { pal: domePal, ch: 4.4, bw: 6.5, hi: 0.24, ao: 0 });
    g.lathe(cx, cy, dz1 + 27, dz1 + 36, () => 4.5, { pal: tones(stoneC, 5, 0.1), ch: 4, bw: 5, hi: 0.2, ao: 0 });
    g.cone(cx, cy, 6, dz1 + 36, dz1 + 46, { pal: domePal, ch: 3, bw: 4, tip: 0.5 });
    const [fx, fy] = g.lp(cx, cy, 0, 0, dz1 + 46);
    g.c.fillStyle = '#e6bd44'; g.c.beginPath(); g.c.arc(fx, fy - 2, 2.4, 0, 7); g.c.fill(); g.c.strokeStyle = '#6a4a10'; g.c.lineWidth = 0.7; g.c.stroke();
    g.touchS(fx - 3, fy - 6);
  }
  // portico
  const pz = 28 + (age >= 2 ? 2 : 0), py = Y1 + 10;
  if (age >= 1) {
    const colC = age >= 2 ? '#e4dcc8' : '#b8a880';
    for (const x of [-20, -7, 7, 20]) g.column(x, py, 0, pz, 3.4, colC);
    const ent = P.stoneP({ base: stoneC, ch: 3, bw: 6, rough: 0.1 });
    g.box(-25, Y1, pz, 25, py + 4, pz + 5, { left: ent, right: ent, top: false, tag: 'trim', ao: 0 });
    if (g.want('roof')) {
      g.roofGable({ x0: -25, y0: Y1, x1: 25, y1: py + 4, z: pz + 5, rise: 12, ov: 1, ovg: 1.5, ovb: 0, axis: 'y', paint: age === 3 ? P.copperP({ base: '#4f9a86' }) : roofMat(2, 'slate', { base: '#7b8494' }), trim: '#d8d0bc', ridge: age === 3 ? '#e6bd44' : null });
      g.planeY(py + 4, [[-25, pz + 5], [25, pz + 5], [0, pz + 17]], decorate(P.ashlarP({ base: stoneC }), (c, w, h) => { P.crestD(c, w / 2 - 5, 3, 10, 12, tc); }), { eave: 0 });
    }
  }
  if (g.want('prop')) {
    g.box(-22, Y1 + 1, 0, 22, py + 8, 1.8, { left: P.stoneP({ base: stoneC, ch: 2, bw: 6 }), right: P.stoneP({ base: stoneC, ch: 2, bw: 6 }), top: P.flagstoneP({ base: stoneC, sz: 5 }), tag: 'prop', ao: 0 });
    g.flag(X1 - 4, Y0 + 4, zw + 5, 22, { w: 22, h: 13, shape: 'swallow', amp: 1.8 });
    g.flag(X0 + 4, Y0 + 4, zw + 5, 22, { w: 22, h: 13, shape: 'swallow', amp: 1.8 });
    PR.barrel(g, 34, 36, { r: 4.4, h: 9.5 });
  }
}


// ----------------------------------------------------------------------------- CASTLE
function roundTower(g, x, y, r, h, age, o = {}) {
  const stoneC = o.stoneC, tc = g.tc;
  const zt = Math.min(h, g.zcut);
  if (zt <= 0.1) return;
  g.lathe(x, y, 0, zt, () => r, { pal: tones(stoneC, 7, 0.13), ch: 8, bw: 9.5, hi: 0.22 });
  if (zt < h - 0.1) return;
  if (g.want('detail')) {
    g.latheDecal(x, y, r, 2.35, h - 30, 4, 11, (c) => P.slitD(c, 0, 0, 3.4, 11));
    g.latheDecal(x, y, r, 1.0, h - 36, 4, 11, (c) => P.slitD(c, 0, 0, 3.4, 11));
    g.latheDecal(x, y, r, 1.65, h - 18, 5, 8, (c) => P.windowD(c, 0, 0, 5, 8, { style: 'arch', fr: 1.1 }));
  }
  if (!g.want('roof')) return;
  // corbel ring + cone roof or crenellations
  if (o.crenel) {
    g.lathe(x, y, h - 4, h, (z) => r + 1.2 + (z - (h - 4)) * 0.25, { pal: tones(stoneC, 5, 0.1), ch: 4, bw: 7, hi: 0.2, ao: 0 });
    g.roundBattlement(x, y, r + 1.4, h, { ph: 7, pal: tones(stoneC, 5, 0.1) });
  } else {
    g.lathe(x, y, h - 3.5, h, (z) => r + 0.8 + (z - (h - 3.5)) * 0.5, { pal: tones(stoneC, 5, 0.1), ch: 3.5, bw: 7, hi: 0.2, ao: 0 });
    g.cone(x, y, r + 3.6, h, h + (o.roofH || 28), { pal: o.roofPal, ch: 4.6, bw: 6.2, hi: 0.14, tip: 0.8 });
    const [fx, fy] = g.lp(x, y, 0, 0, h + (o.roofH || 28));
    g.c.fillStyle = '#e8c860'; g.c.beginPath(); g.c.arc(fx, fy - 1, 1.9, 0, 7); g.c.fill(); g.c.strokeStyle = '#6a4a10'; g.c.lineWidth = 0.6; g.c.stroke();
    g.touchS(fx - 3, fy - 5);
    if (g.want('prop') && o.pennant) g.flag(x, y, h + (o.roofH || 28), 12, { shape: 'pennant', w: 16, h: 8, amp: 1.3, emblem: false });
  }
}
function castle(g, age) {
  const tc = g.tc;
  const stoneC = age <= 1 ? '#8d877a' : age === 2 ? '#a29c8e' : '#d6cfbc';
  const roofPal = age === 0 ? tones('#c4a048', 6, 0.16) : age === 1 ? tones('#c85a30', 6, 0.15) : age === 2 ? tones('#7b8494', 6, 0.14) : tones('#a8402e', 6, 0.14);
  const W = 54, T = 11, WH = 42;
  g.ground(0, 0, 130, 130, '#4a4630', 0.32);
  g.cast(-W - 14, -W - 14, W + 14, W + 14, 60, { k: 0.4, contact: false });
  g.cast(-21, -21, 21, 21, 98, { contact: false, alpha: 0.2 });
  const stoneP = age <= 1 ? P.stoneP({ base: stoneC, ch: 8, bw: 13, rough: 0.35 }) : age === 2 ? P.stoneP({ base: stoneC, ch: 8.5, bw: 14, rough: 0.2, moss: 0.25 }) : P.ashlarP({ base: stoneC, ch: 10, bw: 18, band: [WH - 6] });
  const innerP = stoneP;
  // courtyard floor
  g.plane([-W + T, -W + T, 0], [1, 0, 0], [0, 1, 0], 2 * (W - T), 2 * (W - T), P.flagstoneP({ base: age >= 2 ? '#8a8478' : '#7a6e58', sz: 8 }), { light: 'top', ao: 0, hl: false });
  // wall slits
  const slits = (n, start, gap) => (c, w, h) => { for (let i = 0; i < n; i++) P.slitD(c, start + i * gap, h - 22, 3.4, 11); };
  const wallSE = decorate(stoneP, slits(7, 12, 14), (c, w, h) => { P.bannerD(c, 52, 2, 8, 17, tc, { shape: 'chevron' }); });
  const wallSW = decorate(stoneP, slits(7, 12, 14), (c, w, h) => { P.bannerD(c, 8, 2, 8, 17, tc, { shape: 'chevron' }); P.bannerD(c, w - 16, 2, 8, 17, tc, { shape: 'chevron' }); });
  const merlon = P.stoneP({ base: stoneC, ch: 3, bw: 5, rough: 0.1 });
  const bat = (x0, y0, x1, y1, o) => g.battlement(x0, y0, x1, y1, WH, Object.assign({ base: stoneC, paint: merlon, ph: 7, t: 3.4, m: 7, gap: 5, floor: P.flagstoneP({ base: '#8a8478', sz: 6 }) }, o || {}));
  // back walls (inner faces visible)
  g.box(-W, -W, 0, -W + T, W, WH, { left: innerP, right: innerP, top: false, ao: 4 });
  g.box(-W, -W, 0, W, -W + T, WH, { left: innerP, right: innerP, top: false, ao: 4 });
  if (g.want('trim')) { bat(-W, -W, -W + T, W); bat(-W, -W, W, -W + T); }
  roundTower(g, -W, -W, 15, 74, age, { stoneC, roofPal, roofH: 28, pennant: true });
  // keep
  const K = 21, KH = 92;
  const keepL = decorate(stoneP, (c, w, h) => { for (const u of [8, 19, 30]) P.windowD(c, u, 10, 5, 10, { style: 'arch', surround: stoneC, fr: 1 }); for (const u of [10, 28]) P.slitD(c, u, h - 24, 3.4, 11); P.bannerD(c, w / 2 - 5, 2, 10, 26, tc, { shape: 'cross' }); });
  const keepR = decorate(stoneP, (c, w, h) => { for (const u of [8, 19, 30]) P.windowD(c, u, 10, 5, 10, { style: 'arch', surround: stoneC, fr: 1 }); for (const u of [10, 28]) P.slitD(c, u, h - 24, 3.4, 11); });
  g.box(-K, -K, 0, K, K, KH, { left: keepL, right: keepR, top: false, eave: 0 });
  if (g.want('trim')) {
    g.box(-K - 2.5, -K - 2.5, KH - 4, K + 2.5, K + 2.5, KH + 2, { left: merlon, right: merlon, top: false, tag: 'trim', ao: 0 });
    g.battlement(-K - 2.5, -K - 2.5, K + 2.5, K + 2.5, KH + 2, { base: stoneC, paint: merlon, ph: 7, t: 3.6, floor: P.flagstoneP({ base: '#8a8478', sz: 6 }) });
  }
  if (g.want('roof')) {
    for (const [tx, ty] of [[-K - 2, -K - 2], [K + 2, -K - 2], [-K - 2, K + 2], [K + 2, K + 2]]) {
      g.lathe(tx, ty, KH + 2, KH + 16, () => 5.2, { pal: tones(stoneC, 6, 0.13), ch: 7, bw: 7, hi: 0.2, ao: 0 });
      g.cone(tx, ty, 7.4, KH + 16, KH + 30, { pal: roofPal, ch: 4, bw: 5, tip: 0.5, hi: 0.14 });
    }
  }
  // front walls
  g.box(W - T, -W, 0, W, W, WH, { left: wallSE, right: wallSE, top: false, ao: 4 });
  g.box(-W, W - T, 0, W, W, WH, { left: wallSW, right: wallSW, top: false, ao: 4 });
  if (g.want('trim')) { bat(W - T, -W, W, W); bat(-W, W - T, W, W); }
  roundTower(g, W, -W, 15, 74, age, { stoneC, roofPal, roofH: 28 });
  roundTower(g, -W, W, 15, 74, age, { stoneC, roofPal, roofH: 28 });
  // gatehouse on the SW wall
  const GX = 17, GY0 = W - T - 2, GY1 = W + 8, GH = 58;
  const gateF = decorate(stoneP, (c, w, h) => { P.portcullisD(c, w / 2 - 9, h - 32, 18, 32, { frame: stoneC }); P.slitD(c, 4, h - 40, 3.4, 11); P.slitD(c, w - 7.4, h - 40, 3.4, 11); P.bannerD(c, w / 2 - 5, 2, 10, 14, tc, { shape: 'cross' }); P.crestD(c, w / 2 - 5, 4, 10, 12, tc); });
  const gateR = decorate(stoneP, (c, w, h) => { P.slitD(c, w / 2 - 1.7, h - 30, 3.4, 12); });
  g.box(-GX, GY0, 0, GX, GY1, GH, { left: gateF, right: gateR, top: false, eave: 0 });
  if (g.want('trim')) {
    g.box(-GX - 2.5, GY0 - 2.5, GH - 4, GX + 2.5, GY1 + 2.5, GH + 2, { left: merlon, right: merlon, top: false, tag: 'trim', ao: 0 });
    g.battlement(-GX - 2.5, GY0 - 2.5, GX + 2.5, GY1 + 2.5, GH + 2, { base: stoneC, paint: merlon, ph: 7, t: 3.4, floor: P.flagstoneP({ base: '#8a8478', sz: 6 }) });
  }
  roundTower(g, W, W, 15, 78, age, { stoneC, roofPal, roofH: 30, pennant: true });
  if (g.want('prop')) {
    g.flag(0, 0, KH + 2, 38, { w: 32, h: 19, shape: 'swallow', amp: 2.4 });
    g.flag(-W, -W, 74 + 28, 18, { shape: 'pennant', w: 18, h: 8, amp: 1.4, emblem: false });
    g.box(-13, W + 8, 0, 13, W + 13, 2.4, { left: P.stoneP({ base: stoneC, ch: 3, bw: 6 }), right: P.stoneP({ base: stoneC, ch: 3, bw: 6 }), top: P.flagstoneP({ base: stoneC, sz: 5 }), tag: 'prop', ao: 0 });
  }
}

// ----------------------------------------------------------------------------- WONDER
function wonder(g, age) {
  const tc = g.tc;
  const marble = '#e8e2d2', gold = '#e6bd44';
  const goldPal = ramp(['#7a5a10', '#c8962a', '#f0cc50', '#fff0a0'], 8);
  g.ground(0, 0, 170, 170, '#4a4a30', 0.3);
  g.cast(-74, -74, 74, 74, 40, { k: 0.5, contact: false });
  g.cast(-40, -40, 40, 40, 100, { contact: false, alpha: 0.26 });
  const tierP = P.ashlarP({ base: marble, ch: 6, bw: 14 });
  const tierTop = (c, w, h) => { c.fillStyle = '#d8d2c0'; c.fillRect(-1, -1, w + 2, h + 2); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(0, 0, w, 1.2); c.fillStyle = gold; c.fillRect(2, 2, w - 4, 1.2); c.fillRect(2, h - 3.2, w - 4, 1.2); c.fillRect(2, 2, 1.2, h - 4); c.fillRect(w - 3.2, 2, 1.2, h - 4);
    c.fillStyle = 'rgba(120,100,60,0.12)'; for (let i = 6; i < w; i += 8) c.fillRect(i, 3, 0.8, h - 6); };
  const tiers = [[74, 0, 7], [64, 7, 13], [54, 13, 19]];
  for (const [h, z0, z1] of tiers) g.box(-h, -h, z0, h, h, z1, { left: tierP, right: tierP, top: tierTop, ao: 3, eave: 0 });
  // grand stairs on the SW and SE faces
  if (g.want('prop')) {
    const stp = P.ashlarP({ base: '#efe9d8', ch: 3, bw: 12 });
    for (let i = 0; i < 3; i++) {
      g.box(-16, 74 - 0.5 + i * 2, 0, 16, 74 + 2.4 + i * 2, 7 - i * 2.2, { left: stp, right: stp, top: tierTop, tag: 'prop', ao: 0, hl: false, noCut: true });
      g.box(74 - 0.5 + i * 2, -16, 0, 74 + 2.4 + i * 2, 16, 7 - i * 2.2, { left: stp, right: stp, top: tierTop, tag: 'prop', ao: 0, hl: false, noCut: true });
    }
  }
  const Z0 = 19, HH = 54, S = 36;
  const cornerTower = (tx, ty) => {
    const tz = Z0 + 66;
    const t0 = Math.min(tz, g.zcut);
    if (t0 > Z0) g.lathe(tx, ty, Z0, t0, () => 9.5, { pal: tones('#ece6d4', 6, 0.09), ch: 9, bw: 9, hi: 0.2, mortar: '#b8b09a' });
    if (t0 >= tz && g.want('detail')) g.latheDecal(tx, ty, 9.5, 1.57, Z0 + 18, 5, 12, (c) => P.windowD(c, 0, 0, 5, 12, { style: 'arch', fr: 1, glassA: '#9ac0d8' }));
    if (g.want('roof')) {
      g.lathe(tx, ty, tz - 3, tz + 1, () => 11.5, { pal: tones('#f0e8d6', 5, 0.06), ch: 4, bw: 8, hi: 0.2, ao: 0 });
      g.dome(tx, ty, 10.5, tz + 1, tz + 26, (t) => Math.max(0.02, Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 - 0.35 * t) + (t < 0.2 ? 0.3 * (1 - t / 0.2) : 0)), { pal: goldPal, ch: 4, bw: 6, hi: 0.3, ao: 0, lum: 1.1 });
      g.cone(tx, ty, 3, tz + 25, tz + 36, { pal: goldPal, ch: 3, bw: 4, tip: 0.3 });
      if (g.want('prop')) g.flag(tx, ty, tz + 36, 6, { shape: 'pennant', w: 16, h: 8, amp: 1.3, emblem: false });
    }
    };
  cornerTower(-S, -S);
  const hallPaint = stoneWall(3, { base: marble, band: [14, 30, HH - 6] });
  const winD = { style: 'arch', surround: '#f0e8d6', glassA: '#9ac0d8' };
  const wl = decorate(hallPaint,
    (c, w, h) => { for (const u of [6, 14, 58, 66]) { P.windowD(c, u, 8, 6, 13, winD); P.windowD(c, u, 30, 6, 13, winD); }
      P.doorD(c, w / 2 - 9, h - 30, 18, 30, { style: 'archdouble', surround: '#f0e8d6', wood: '#c89a30', frame: gold, stepColor: '#d8d2c0', iron: false });
      P.bannerD(c, 24, 4, 7, 20, tc, { shape: 'cross' }); P.bannerD(c, w - 31, 4, 7, 20, tc, { shape: 'cross' }); });
  const wr = decorate(hallPaint, (c, w, h) => { for (const u of [6, 14, 58, 66]) { P.windowD(c, u, 8, 6, 13, winD); P.windowD(c, u, 30, 6, 13, winD); } P.roseD(c, w / 2, 20, 7, { frame: '#f0e8d6' }); });
  g.box(-S, -S, Z0, S, S, Z0 + HH, { left: wl, right: wr, top: P.flagstoneP({ base: '#d8d2c0', sz: 8 }), eave: 3 });
  const topZ = Z0 + HH + 3;
  // cornice
  if (g.want('trim')) g.box(-S - 3, -S - 3, Z0 + HH - 2, S + 3, S + 3, topZ, { left: P.ashlarP({ base: '#f0e8d6', ch: 5, bw: 10 }), right: P.ashlarP({ base: '#f0e8d6', ch: 5, bw: 10 }), top: P.flagstoneP({ base: '#d8d2c0', sz: 8 }), tag: 'trim', ao: 0 });
  // porticos (SW and SE faces): columns, entablature and pediment
  const colC = '#f2ecda', ent = P.ashlarP({ base: '#f0e8d6', ch: 4, bw: 10 });
  const PCz = Z0 + 36, PHz = PCz + 5, PR = 12;
  if (g.stage >= 3) {
    const py = S + 12, px = S + 12;
    for (const x of [-21, -14, -7, 0, 7, 14, 21]) g.column(x, py, Z0, PCz, 2.7, colC, { tag: 'prop' });
    g.box(-25, S, PCz, 25, py + 3, PHz, { left: ent, right: ent, top: false, tag: 'trim', ao: 0 });
    for (const y of [-21, -14, -7, 0, 7, 14, 21]) g.column(px, y, Z0, PCz, 2.7, colC, { tag: 'prop' });
    g.box(S, -25, PCz, px + 3, 25, PHz, { left: ent, right: ent, top: false, tag: 'trim', ao: 0 });
    if (g.want('roof')) {
      g.roofGable({ x0: -25, y0: S, x1: 25, y1: py + 3, z: PHz, rise: PR, ov: 0.8, ovg: 1.2, ovb: 0, axis: 'y', paint: P.copperP({ base: '#d8b848' }), trim: '#f0e8d6', ridge: gold });
      g.planeY(py + 3, [[-25, PHz], [25, PHz], [0, PHz + PR]], decorate(P.ashlarP({ base: '#f0e8d6' }), (c, w, h) => { P.crestD(c, w / 2 - 5, 3, 10, 12, tc); }), { eave: 0 });
      g.roofGable({ x0: S, y0: -25, x1: px + 3, y1: 25, z: PHz, rise: PR, ov: 0.8, ovg: 1.2, ovb: 0, axis: 'x', paint: P.copperP({ base: '#d8b848' }), trim: '#f0e8d6', ridge: gold });
      g.planeX(px + 3, [[-25, PHz], [25, PHz], [0, PHz + PR]], decorate(P.ashlarP({ base: '#f0e8d6' }), (c, w, h) => { P.crestD(c, w / 2 - 5, 3, 10, 12, tc); }), { eave: 0 });
    }
  }
  // central drum and great gilded dome
  const dz1 = topZ + 32, R = 25;
  if (g.stage >= 3 || g.zcut > topZ) {
    g.lathe(0, 0, topZ - 1, dz1, () => R, { pal: tones('#ece6d4', 6, 0.08), ch: 10, bw: 12, hi: 0.2, mortar: '#b8b09a' });
    for (let i = 0; i < 7; i++) g.latheDecal(0, 0, R, 0.3 + i * 0.4, topZ + 6, 6, 16, (c) => P.windowD(c, 0, 0, 6, 16, { style: 'arch', fr: 1.2, glassA: '#9ac0d8', surround: '#f0e8d6' }));
    if (g.want('roof')) {
      g.lathe(0, 0, dz1 - 1, dz1 + 3, () => R + 2.5, { pal: tones('#f0e8d6', 5, 0.06), ch: 4, bw: 10, hi: 0.2, ao: 0 });
      g.dome(0, 0, R + 1, dz1 + 2, dz1 + 54, (t) => Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.8))) * 0.985 + 0.015, { pal: goldPal, ch: 5, bw: 7, hi: 0.32, ao: 0, lum: 1.12 });
      g.lathe(0, 0, dz1 + 54, dz1 + 64, () => 4.8, { pal: tones('#ece6d4', 5, 0.08), ch: 5, bw: 6, hi: 0.2, ao: 0 });
      g.cone(0, 0, 6.5, dz1 + 64, dz1 + 84, { pal: goldPal, ch: 4, bw: 4, tip: 0.4, hi: 0.3 });
      const [fx, fy] = g.lp(0, 0, 0, 0, dz1 + 84);
      g.c.fillStyle = gold; g.c.beginPath(); g.c.arc(fx, fy - 2, 3, 0, 7); g.c.fill(); g.c.strokeStyle = '#6a4a10'; g.c.lineWidth = 0.8; g.c.stroke(); g.touchS(fx - 4, fy - 8);
    }
  }
  for (const [tx, ty] of [[S, -S], [-S, S]]) cornerTower(tx, ty);
  if (g.want('prop')) g.flag(0, 0, dz1 + 84, 24, { w: 34, h: 20, shape: 'swallow', amp: 2.4 });
}
const { ramp } = P;

export const DEFS = {
  market: { hmax: 120, Hc: 34, fp: [-45, -45, 45, 45], draw: market },
  monastery: { hmax: 150, Hc: 44, fp: [-22, -46, 44, 26], draw: monastery },
  university: { hmax: 170, Hc: 42, fp: [-42, -34, 42, 22], draw: university },
  castle: { hmax: 215, Hc: 42, fp: [-54, -54, 54, 54], draw: castle, side: 40 },
  wonder: { hmax: 360, Hc: 60, fp: [-60, -60, 60, 60], draw: wonder, side: 40 },
};
