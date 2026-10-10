// Economic buildings: house, mill, lumber camp, mining camp, farm, town center.
import { shade, mix, rgba, rng } from './common.js';
import * as P from './buildings_paint.js';
import { pal, stoneWall, mainWall, woodWall, roofMat, decorate, withFooting } from './buildings_style.js';
import * as PR from './buildings_props.js';
import { SQ2 } from './buildings_kit.js';
const { tones } = P;

const door = (u, dw, dh, o) => (c, w, h) => P.doorD(c, u < 0 ? w + u : u, h - dh - (o && o.lift || 0), dw, dh, o);
const win = (u, v, ww, wh, o) => (c, w, h) => P.windowD(c, u < 0 ? w + u : u, v < 0 ? h + v : v, ww, wh, o);
const banner = (u, v, bw, bh, tc, o) => (c, w, h) => P.bannerD(c, u < 0 ? w + u : u, v, bw, bh, tc, o);

/** brick chimney stack standing against a wall: (x0,y0)-(x1,y1) ground rect up to zTop */
export function chimney(g, x0, y0, x1, y1, zTop, o = {}) {
  const brick = o.paint || P.brickP({ base: o.base || '#9a5a40' });
  g.box(x0, y0, 0, x1, y1, zTop, { left: brick, right: brick, top: false, ao: 5, tag: 'wall', noCut: o.noCut });
  if (g.want('trim')) {
    const cap = (c, w, h) => { c.fillStyle = o.capCol || '#6a625a'; c.fillRect(-1, -1, w + 2, h + 2); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, 0, w, 1); };
    g.box(x0 - 1.2, y0 - 1.2, zTop, x1 + 1.2, y1 + 1.2, zTop + 2.6, { left: cap, right: cap, top: (c, w, h) => { c.fillStyle = '#6a625a'; c.fillRect(-1, -1, w + 2, h + 2); c.fillStyle = '#17110c'; c.fillRect(w * 0.25, h * 0.25, w * 0.5, h * 0.5); }, tag: 'trim', ao: 0 });
    if (o.smoke !== false) PR.smoke(g, (x0 + x1) / 2, (y0 + y1) / 2, zTop + 2.6, { s: o.smokeS || 1 });
  }
}

// ----------------------------------------------------------------------------- HOUSE
function house(g, age) {
  const p = pal(age), tc = g.tc;
  if (age === 0) {
    const x0 = -20, x1 = 20, y0 = -16, y1 = 16, zw = 27, rise = 22;
    g.ground(0, 0, 36, 34, '#4a3a22', 0.4);
    g.cast(x0, y0, x1, y1, 38);
    const wall = mainWall(0);
    const long = decorate(wall, door(11, 10, 17, { wood: '#5a3a1e', frame: '#33220f', step: false, iron: false }), win(-14, 6, 6, 7, { style: 'slit' }), banner(-12, 3, 8, 16, tc, { shape: 'cross' }));
    const end = decorate(wall, win(9, 10, 6, 8, { style: 'slit' }));
    g.gableBlock({ x0, y0, x1, y1, z0: 0, zw, rise, axis: 'x', long, end, ov: 3.5, ovg: 3, roof: P.thatchP({ base: p.roof, bh: 8 }), trim: '#a2823a', ridge: '#8a6a2a', ridgeW: 4.5, thick: 4.5, eave: 4 });
    // smoke hole chimney pot at the ridge
    if (g.want('prop')) {
      PR.logStack(g, x1 + 4.5, -9, 15, 2.5, [3, 2, 1], 'y', { col: '#7a5230' });
      PR.barrel(g, -2, y1 + 9, { r: 4.6, h: 10 });
      g.flag(x1 - 3, 0, zw + rise - 8, 12, { shape: 'pennant', w: 17, h: 8, amp: 1.4, emblem: false });
      PR.smoke(g, x0 + 9, 0, zw + rise + 1, { s: 0.9 });
    }
    return;
  }
  if (age === 1) {
    const x0 = -22, x1 = 22, y0 = -17, y1 = 17, zw = 31, rise = 20;
    g.ground(0, 0, 38, 36, '#4a3a22', 0.35);
    g.cast(x0, y0, x1, y1, 46);
    const wall = mainWall(1);
    const long = decorate(wall, door(9, 11, 19, { wood: '#5a3a22', frame: '#3a2616', stepColor: '#8d877a' }), win(-18, 7, 8, 9, { style: 'shutter', shutter: tc.main, flowers: true }), banner(25, 4, 8, 17, tc, { shape: 'chevron' }));
    const end = decorate(wall, win(-5, 4, 8, 9, { style: 'shutter', shutter: '#6a4a2a' }));
    // chimney first (behind roof on the far side is not needed: it stands at the right gable end)
    g.gableBlock({ x0, y0, x1, y1, z0: 0, zw, rise, axis: 'x', long, end, ov: 3.5, ovg: 3, roof: roofMat(1, 'main', { base: p.roof }), trim: '#4a2e1e', ridge: tc.main, ridgeW: 3.2 });
    chimney(g, x1 + 0.5, -3.5, x1 + 6.5, 3.5, zw + rise + 6, { base: '#a0604a' });
    if (g.want('prop')) {
      PR.barrel(g, -6, y1 + 8, { r: 4.8, h: 10.5 });
      PR.sack(g, x0 + 12, y1 + 7, { s: 0.9 });
      g.flag(x0 + 3, 0, zw + rise - 2, 12, { shape: 'pennant', w: 16, h: 8, amp: 1.4, emblem: false });
    }
    return;
  }
  if (age === 2) {
    const x0 = -21, x1 = 21, y0 = -18, y1 = 18, z1 = 22, zw = 46, rise = 19;
    g.ground(0, 0, 40, 38, '#4a3a22', 0.3);
    g.cast(x0 - 2, y0 - 2, x1 + 2, y1 + 2, 56);
    // ridge along y: SE side is the long wall, the gable end faces SW
    chimney(g, -3, y0 - 8.5, 3.5, y0 - 2.4, zw + rise + 2, { base: '#8a8478', paint: P.stoneP({ base: '#9a9484', ch: 5, bw: 8 }), noCut: true });
    const lower = stoneWall(2, { base: '#a8a294' });
    const upper = mainWall(2, { footing: 0, brace: 'x', pw: 16, rails: undefined });
    g.box(x0, y0, 0, x1, y1, z1, { left: decorate(lower, door(10, 12, 18, { arch: true, surround: '#b8b2a2', wood: '#4a3018', frame: '#2a1c10' }), win(-14, 7, 6, 10, { style: 'arch', surround: '#b8b2a2' })), right: decorate(lower, win(8, 6, 6, 10, { style: 'arch', surround: '#b8b2a2' }), win(-14, 6, 6, 10, { style: 'arch', surround: '#b8b2a2' })), top: false, eave: 0 });
    // upper (jetty +2)
    const ux0 = x0 - 2, ux1 = x1 + 2, uy0 = y0 - 2, uy1 = y1 + 2;
    g.gableBlock({
      x0: ux0, y0: uy0, x1: ux1, y1: uy1, z0: z1, zw, rise, axis: 'y',
      long: decorate(upper, win(6, 6, 8, 10, { style: 'shutter', shutter: tc.main, lit: false }), win(-17, 6, 8, 10, { style: 'shutter', shutter: '#6a4a2a' }), banner(-4, -4, 9, 18, tc, { shape: 'cross' })),
      end: decorate(upper, win(0, 3, 8, 10, { style: 'shutter', shutter: tc.main })), ov: 3.5, ovg: 3, roof: roofMat(2, 'main', { base: '#b0583a' }), trim: '#3a2c20', ridge: '#7a3a24',
    });
    if (g.want('prop')) {
      PR.barrel(g, x1 + 5, 12, { r: 4.6, h: 10 });
      g.flag(0, y0 + 3, zw + rise - 1, 13, { shape: 'pennant', w: 16, h: 8, amp: 1.4, emblem: false });
    }
    return;
  }
  // age 3
  {
    const x0 = -22, x1 = 22, y0 = -18, y1 = 18, z1 = 24, zw = 46, rise = 21;
    g.ground(0, 0, 42, 38, '#5a4a30', 0.28);
    g.cast(x0, y0, x1, y1, 56);
    const st = stoneWall(3, { band: [22] });
    const long = decorate(st,
      door(8, 12, 19, { arch: true, surround: '#efe8d4', wood: '#4a3018', frame: '#c8a040' }),
      win(-14, 6, 7, 11, { style: 'arch', surround: '#efe8d4', glassA: '#a8c8d8' }),
      win(-14, 28, 7, 11, { style: 'arch', surround: '#efe8d4', glassA: '#a8c8d8' }),
      win(8, 28, 7, 11, { style: 'arch', surround: '#efe8d4', glassA: '#a8c8d8' }),
      banner(24, 29, 9, 20, tc, { shape: 'chevron' }));
    const end = decorate(st, win(8, 6, 7, 11, { style: 'arch', surround: '#efe8d4' }), win(-15, 6, 7, 11, { style: 'arch', surround: '#efe8d4' }), win(8, 28, 7, 11, { style: 'arch', surround: '#efe8d4' }), win(-15, 28, 7, 11, { style: 'arch', surround: '#efe8d4' }));
    g.gableBlock({ x0, y0, x1, y1, z0: 0, zw, rise, axis: 'x', long, end, ov: 3, ovg: 3, roof: roofMat(3, 'main', { base: '#9a3a34' }), trim: '#e6bd44', ridge: '#e6bd44', ridgeW: 3.4, thick: 3 });
    g.dormer({ y0, y1, z: zw, rise }, { x: -6, w: 13, hw: 10, rr: 5.5, t: 0.7, wall: st, roofPaint: roofMat(3, 'main', { base: '#9a3a34' }), trim: '#e6bd44',
      win: (c, w, h) => P.windowD(c, w / 2 - 3, h - 12, 6, 8, { style: 'arch', surround: '#efe8d4', fr: 1, glassA: '#a8c8d8' }) });
    chimney(g, x1 - 0.5, -4, x1 + 5.5, 2.5, zw + rise + 5, { paint: P.ashlarP({ base: '#d8d0bc', ch: 5, bw: 8 }), capCol: '#e0d8c4' });
    if (g.want('prop')) {
      PR.barrel(g, x0 + 6, y1 + 8, { r: 4.6, h: 10, col: '#7a5a38' });
      g.flag(x0 + 4, 0, zw + rise - 2, 14, { shape: 'swallow', w: 17, h: 9, amp: 1.5, emblem: false });
    }
  }
}


// ----------------------------------------------------------------------------- shared helpers
function ring(g, cx, cy, r, z, col = '#4a3220', w = 1.6) {
  const c = g.c, [sx, sy] = g.lp(cx, cy, 0, 0, z);
  c.strokeStyle = 'rgba(15,8,4,0.5)'; c.lineWidth = w + 1; c.beginPath(); c.ellipse(sx, sy + 0.4, r * SQ2, r * SQ2 * 0.5, 0, 0.04, Math.PI - 0.04); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.ellipse(sx, sy, r * SQ2, r * SQ2 * 0.5, 0, 0.04, Math.PI - 0.04); c.stroke();
}
function post(g, x, y, z0, z1, s = 4.2, paint, o = {}) {
  const f = paint || P.planksP({ base: '#7a5530', bw: 2.2, battens: false });
  g.box(x - s / 2, y - s / 2, z0, x + s / 2, y + s / 2, z1, Object.assign({ left: f, right: f, top: f, ao: 3, hl: false }, o));
}
const shedPaint = (age) => age === 0 ? P.thatchP({ base: '#c4a048', bh: 8 }) : age === 1 ? P.shinglesP({ base: '#8a6a44' }) : age === 2 ? roofMat(2, 'main', { base: '#a85a38' }) : roofMat(3, 'main', { base: '#9a3a34' });

// ----------------------------------------------------------------------------- MILL
function drawSails(g, hx, hy, L, phi, tc, age) {
  const c = g.c;
  const wood = age === 0 ? '#6a4a2a' : '#5a3e24';
  c.save(); c.translate(hx, hy); c.scale(1, 0.9);
  for (let k = 0; k < 4; k++) {
    c.save(); c.rotate(phi + k * Math.PI / 2);
    // stock
    c.fillStyle = 'rgba(15,8,4,0.5)'; c.fillRect(1, -1.9, L + 1, 3.8);
    c.fillStyle = wood; c.fillRect(2, -1.4, L - 1, 2.8);
    c.fillStyle = 'rgba(255,230,170,0.35)'; c.fillRect(2, -1.4, L - 1, 0.8);
    // lattice frame + cloth
    const x0 = 8, x1 = L - 2, y0 = 1.6, y1 = 12.2;
    c.fillStyle = 'rgba(15,8,4,0.55)'; c.fillRect(x0 - 1, y0 - 0.8, x1 - x0 + 2, y1 - y0 + 1.6);
    const cloth = c.createLinearGradient(0, y0, 0, y1); cloth.addColorStop(0, '#f2e8cc'); cloth.addColorStop(1, '#d8c9a2');
    c.fillStyle = cloth; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    // team coloured outer panel
    const px0 = x0 + (x1 - x0) * 0.62;
    c.fillStyle = tc.main; c.fillRect(px0, y0, x1 - px0, y1 - y0);
    c.fillStyle = tc.light; c.fillRect(px0, y0, x1 - px0, 1.6);
    c.fillStyle = tc.dark; c.fillRect(px0, y1 - 1.6, x1 - px0, 1.6);
    // lattice bars on the cloth part
    c.strokeStyle = wood; c.lineWidth = 1.1; c.beginPath();
    for (let x = x0; x <= px0 + 0.1; x += (px0 - x0) / 4) { c.moveTo(x, y0); c.lineTo(x, y1); }
    c.moveTo(x0, (y0 + y1) / 2); c.lineTo(px0, (y0 + y1) / 2);
    c.stroke();
    c.beginPath(); c.moveTo(px0, y0); c.lineTo(px0, y1); c.stroke();
    c.strokeStyle = wood; c.lineWidth = 1.6; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.restore();
  }
  c.restore();
  g.touchS(hx - L - 3, hy - L * 0.9 - 3); g.touchS(hx + L + 3, hy + L * 0.9 + 3);
}
function mill(g, age, st) {
  const p = pal(age), tc = g.tc, frame = st && st.frame | 0;
  const R0 = 21, R1 = 14.5, zT = 50;
  const rf = z => R0 + (R1 - R0) * (z / zT);
  g.ground(0, 0, 34, 34, '#4a3a22', 0.3);
  g.cast(-15, -15, 15, 15, 60, { k: 0.45 });
  const zt = Math.min(zT, g.zcut);
  if (zt > 0.1) {
    if (age === 0) g.lathe(0, 0, 0, zt, rf, { pal: tones('#8a6038', 6, 0.14), ch: 17, bw: 3.7, stag: false, hi: 0.08, mortar: '#2a1a0c' });
    else if (age === 1) {
      g.lathe(0, 0, 0, Math.min(zt, 15), rf, { pal: tones(p.stone, 6, 0.14), ch: 7.5, bw: 11, hi: 0.2 });
      if (zt > 15) g.lathe(0, 0, 15, zt, rf, { pal: tones('#e8dcc0', 6, 0.05), ch: 12, bw: 20, hi: 0.06, mortar: '#b8a888', ao: 0 });
    } else if (age === 2) g.lathe(0, 0, 0, zt, rf, { pal: tones('#a9a395', 6, 0.14), ch: 8, bw: 11, hi: 0.2 });
    else g.lathe(0, 0, 0, zt, rf, { pal: tones('#dcd5c2', 6, 0.08), ch: 9.5, bw: 13, hi: 0.3, mortar: '#a89f8a' });
    if (age <= 1 && zt > 15) { ring(g, 0, 0, rf(15) + 0.3, 15, age === 0 ? '#4a3018' : '#47301f'); }
    if (age === 0) { ring(g, 0, 0, rf(30) + 0.3, 30, '#3a2a18', 1.4); }
    if (age === 3 && zt > 30) ring(g, 0, 0, rf(30) + 0.3, 30, '#e6bd44', 1.6);
    if (g.want('detail')) {
      g.latheDecal(0, 0, rf(16), 2.3, 17, 8, 16, (c, w, h) => P.doorD(c, 0, 0, 8, 16, { wood: '#5a3a1e', frame: age >= 2 ? '#c8b890' : '#33220f', arch: age >= 2, fr: 1.4, step: false }));
      g.latheDecal(0, 0, rf(32), 0.95, 31, 5, 8, (c) => P.windowD(c, 0, 0, 5, 8, { style: age >= 2 ? 'arch' : 'plain', fr: 1.3 }));
      g.latheDecal(0, 0, rf(40), 2.2, 40, 4, 6, (c) => P.windowD(c, 0, 0, 4, 6, { style: 'slit', fr: 1 }));
    }
    // top ring
    if (zt >= zT) g.latheTop(0, 0, R1 + 0.2, zT, '#4a3a2a');
  }
  if (g.want('roof')) {
    const capR = R1 + 3.4, cz = 26;
    const capPal = age === 0 ? tones('#c4a048', 6, 0.16) : age === 1 ? tones('#c85a30', 6, 0.15) : age === 2 ? tones('#7b8494', 6, 0.14) : tones('#a8402e', 6, 0.14);
    g.cone(0, 0, capR, zT, zT + cz, { pal: capPal, ch: 4.6, bw: 6.5, hi: 0.14, tip: 0.9 });
    // eave ring
    ring(g, 0, 0, capR, zT + 0.4, age === 3 ? '#e6bd44' : '#3a2a1c', 1.4);
    // finial
    const [fx, fy] = g.lp(0, 0, 0, 0, zT + cz);
    g.c.fillStyle = '#e8c860'; g.c.beginPath(); g.c.arc(fx, fy - 1.5, 2.2, 0, 7); g.c.fill(); g.c.strokeStyle = '#6a4a10'; g.c.lineWidth = 0.7; g.c.stroke();
    g.touchS(fx - 3, fy - 5);
    // axle + sails
    if (g.want('prop')) {
      const zH = zT + 9, rc = capR * (1 - 9 / cz);
      const [hx0, hy0] = g.lp(0, 0, rc, Math.PI / 2, zH);
      const hx = hx0, hy = hy0 + 4;
      const c = g.c;
      c.fillStyle = '#3a2a1c'; c.beginPath(); c.ellipse(hx, hy, 4.2, 3.8, 0, 0, 7); c.fill();
      drawSails(g, hx, hy, 40, Math.PI / 4 + frame * (Math.PI / 2) / 8, tc, age);
      c.fillStyle = tc.main; c.beginPath(); c.ellipse(hx, hy, 3.1, 2.8, 0, 0, 7); c.fill();
      c.fillStyle = tc.light; c.beginPath(); c.ellipse(hx - 0.8, hy - 0.8, 1.1, 1, 0, 0, 7); c.fill();
      c.strokeStyle = '#2a1c10'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(hx, hy, 3.1, 2.8, 0, 0, 7); c.stroke();
    }
  }
  if (g.want('prop')) {
    PR.sack(g, 11, 20, { s: 0.85 }); PR.sack(g, 18, 16, { s: 0.8, col: '#d8c488' });
    PR.barrel(g, -22, 14, { r: 4.2, h: 9 });
  }
}

// ----------------------------------------------------------------------------- LUMBER CAMP
function lumberCamp(g, age) {
  const p = pal(age), tc = g.tc;
  const bx0 = -30, bx1 = 6, by0 = -30, by1 = -3, zh = 40, zl = 32;
  g.ground(0, 0, 36, 36, '#4a3a22', 0.38);
  g.cast(bx0, by0, bx1, by1, 38);
  const wood = P.planksP({ base: age === 0 ? '#7a5a38' : '#8a6038', bw: 3, battens: false });
  const postP = age === 0 ? P.logsP({ base: '#7a5230', d: 4 }) : age >= 2 ? P.stoneP({ base: p.stone, ch: 4, bw: 6, rough: 0.25 }) : wood;
  // back wall
  if (age >= 1) g.box(bx0, by0, 0, bx1, by0 + 2.5, zh - 2, { left: age >= 2 ? P.stoneP({ base: p.stone, ch: 6, bw: 9 }) : woodWall(1), right: woodWall(age), top: false, ao: 3, eave: 0 });
  post(g, bx0 + 2, by0 + 2, 0, zh - 1, 4.4, postP);
  post(g, bx1 - 2, by0 + 2, 0, zh - 1, 4.4, postP);
  // stuff under the roof (visible below the front edge)
  if (g.want('prop')) {
    PR.logStack(g, bx0 + 8, -18, 24, 2.7, [4, 3, 2], 'x', { col: '#6e4a2a' });
    PR.log(g, bx0 + 10, -9, 0, 18, 2.4, 'x', { col: '#8a6038' });
  }
  post(g, bx0 + 2, by1 - 2, 0, zl - 1, 4.4, postP);
  post(g, bx1 - 2, by1 - 2, 0, zl - 1, 4.4, postP);
  g.roofShed({ x0: bx0, y0: by0, x1: bx1, y1: by1, zHigh: zh, zLow: zl, ov: 4, ovg: 3, paint: shedPaint(age), trim: age === 0 ? '#a2823a' : '#4a3220', slope: 'y', thick: age === 0 ? 4 : 2.6 });
  if (g.want('prop')) {
    // big log pile on the right and loose logs
    PR.logStack(g, 14, -14, 26, 3.1, [5, 4, 3, 2], 'y', { col: '#7a5230' });
    PR.stumpAxe(g, -12, 13);
    PR.log(g, -22, 20, 0, 14, 2.4, 'x', { col: '#8a6038' });
    // team bunting along the roof front edge
    g.flag(bx1 - 2, by0 + 2, zh - 2, 18, { w: 18, h: 11, shape: 'swallow', amp: 1.6 });
  }
}

// ----------------------------------------------------------------------------- MINING CAMP
function miningCamp(g, age) {
  const p = pal(age), tc = g.tc;
  const x0 = -29, x1 = 3, y0 = -29, y1 = -1, zw = 24, rise = 14;
  g.ground(0, 0, 36, 36, '#3a3024', 0.4);
  g.cast(x0, y0, x1, y1 + 6, 34);
  const wall = age === 0 ? P.planksP({ base: '#8f7048', bw: 4.5 }) : age === 1 ? P.planksP({ base: '#a07850', bw: 5 }) : stoneWall(Math.min(age, 3));
  const long = decorate(wall, door(8, 11, 16, { wood: '#4a3018', frame: '#2a1c10', arch: age >= 2, surround: age >= 2 ? '#bab4a2' : undefined, step: false }), win(-9, 6, 6, 6, { style: age >= 2 ? 'arch' : 'plain' }));
  const end = decorate(wall, win(7, 8, 6, 7, {}));
  g.gableBlock({ x0, y0, x1, y1, z0: 0, zw, rise, axis: 'y', long, end, ov: 3.5, ovg: 3, roof: age === 0 ? P.plankRoofP({ base: '#8a6c44' }) : age === 1 ? P.shinglesP({ base: '#9a7a52' }) : roofMat(age, 'slate', { base: age === 2 ? '#7b8494' : '#7b8494' }), trim: '#3a2a1c', ridge: age >= 3 ? '#e6bd44' : '#3a2a1c', eave: 3 });
  if (g.want('prop')) {
    // ore piles and cart
    PR.rockPile(g, 14, -12, 'gold', 9, 9, { seed: 3, r: 4.2 });
    PR.rockPile(g, 15, 8, 'stone', 9, 9, { seed: 11, r: 4.4 });
    PR.cart(g, -10, 15, { axis: 'x', len: 19, w: 11, col: '#9a7448' });
    PR.rockPile(g, -10, 15, 'gold', 5, 4, { seed: 5, r: 3.2, z: 9 });
    PR.barrel(g, -24, 12, { r: 4.2, h: 9 });
    // pickaxes leaning on the wall + A-frame hoist
    const c = g.c, [px, py] = g.P(x1 - 2, y1 + 0.5, 0);
    c.strokeStyle = '#5a3e22'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px - 16, py + 1); c.lineTo(px - 10, py - 17); c.stroke();
    c.strokeStyle = '#9aa0aa'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px - 14.5, py - 15); c.lineTo(px - 7, py - 17.5); c.stroke();
    g.touchS(px - 18, py - 20); g.touchS(px, py + 2);
    g.flag(x1 - 3, y0 + 3, zw + rise - 3, 16, { w: 17, h: 10, shape: 'swallow', amp: 1.5 });
  }
}

// ----------------------------------------------------------------------------- FARM
function farm(g, age, st, stage) {
  const building = g.stage < 4;
  const fill = building ? 0 : (st && st.fill !== undefined ? st.fill : 1);
  const lv = Math.max(0, Math.min(3, Math.round(fill * 3))) / 3;
  const H = 45, rnd = g.rr;
  const soil = P.dirtP({ base: '#6a4a2a' });
  const rows = 9, rowStep = (2 * H) / rows;
  // tilled soil with furrows (plane space: u = x, v = y)
  g.plane([-H, -H, 0], [1, 0, 0], [0, 1, 0], 2 * H, 2 * H, (c, w, h, r) => {
    soil(c, w, h, r);
    const done = building ? [0, 0.3, 0.62, 0.9][g.stage] : 1;
    for (let i = 0; i < rows; i++) {
      if (i / rows >= done) break;
      const y = i * rowStep;
      c.fillStyle = 'rgba(30,16,6,0.42)'; c.fillRect(-1, y, w + 2, rowStep * 0.46);                // furrow
      c.fillStyle = 'rgba(255,225,170,0.16)'; c.fillRect(-1, y + rowStep * 0.5, w + 2, 0.9);        // ridge highlight
      c.fillStyle = 'rgba(120,80,40,0.35)'; c.fillRect(-1, y + rowStep * 0.52, w + 2, rowStep * 0.4);
    }
  }, { light: 'top', ao: 0, hl: false, under: '#5a3c22' });
  // raised border
  const bank = age >= 2 ? P.stoneP({ base: '#8f897a', ch: 2.5, bw: 5, rough: 0.2 }) : age === 1 ? P.planksHP({ base: '#7a5a38', rh: 2.2 }) : P.dirtP({ base: '#5a4026' });
  const bt = 3, bh = 3.4;
  const top = (c, w, h) => { c.fillStyle = age >= 2 ? '#a8a292' : age === 1 ? '#8a6a44' : '#6a4c2c'; c.fillRect(-1, -1, w + 2, h + 2); };
  g.box(-H - bt, -H - bt, 0, H + bt, -H, bh, { left: bank, right: bank, top, tag: 'wall', noCut: true, ao: 0, hl: false });
  g.box(-H - bt, -H, 0, -H, H + bt, bh, { left: bank, right: bank, top, tag: 'wall', noCut: true, ao: 0, hl: false });
  // plants (screen space), painter order: increasing x + y
  const lvl = lv;
  const c = g.c;
  const stem = ['#c9b040', '#b4a838', '#a8a030'];
  const plants = [];
  const cols = Math.floor((2 * H) / 4.6);
  for (let i = 0; i < rows; i++) for (let k = 0; k < cols; k++) {
    const x = -H + 3 + k * 4.6 + (((i * 7 + k * 13) % 5) - 2) * 0.35, y = -H + (i + 0.74) * rowStep;
    const hh = ((i * 928 + k * 677 + 31) * 2654435761 >>> 0) / 4294967296;
    plants.push([x, y, hh]);
  }
  plants.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  const lush = lv >= 0.99;
  for (const [x, y, hh] of plants) {
    const [sx, sy] = g.P(x, y, 3.2);
    if (hh < lv) {
      const h = 3.2 + hh * 1.6;
      // wheat clump
      c.lineWidth = 0.9; c.lineCap = 'round';
      for (let b = 0; b < 4; b++) {
        const ox = (b - 1.5) * 0.95, lean = (b - 1.5) * 0.3;
        c.strokeStyle = stem[b % 3]; c.beginPath(); c.moveTo(sx + ox, sy); c.lineTo(sx + ox + lean, sy - h + (b % 2) * 0.8); c.stroke();
        c.fillStyle = (b & 1) ? '#f0cc58' : '#e0b840'; c.beginPath(); c.ellipse(sx + ox + lean, sy - h + (b % 2) * 0.8 - 0.6, 0.85, 1.7, lean * 0.3, 0, 7); c.fill();
      }
      c.strokeStyle = '#6f9a2e'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(sx - 2.2, sy + 0.2); c.lineTo(sx - 0.6, sy - 1.6); c.moveTo(sx + 2.2, sy + 0.2); c.lineTo(sx + 0.8, sy - 1.8); c.stroke();
    } else if (!building && (hh < lv + 0.22 || (lv === 0 && hh < 0.35))) {
      // stubble
      c.strokeStyle = '#8a7a3a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx - 1, sy); c.lineTo(sx - 1.2, sy - 1.6); c.moveTo(sx + 0.8, sy); c.lineTo(sx + 1, sy - 1.9); c.stroke();
    }
  }
  g.touchS(g.sx(-H, H) - 3, g.sy(-H, -H) - 12); g.touchS(g.sx(H, -H) + 3, g.sy(H, H) + 4);
  if (building) {                                          // survey stakes and rope while the field is being prepared
    const pts = [[-H - 2, -H - 2], [H + 2, -H - 2], [H + 2, H + 2], [-H - 2, H + 2]], sp = pts.map(([x, y]) => g.P(x, y, 0));
    c.strokeStyle = 'rgba(235,225,190,0.85)'; c.lineWidth = 0.8; c.beginPath(); sp.forEach((p, i) => { i ? c.lineTo(p[0], p[1] - 4) : c.moveTo(p[0], p[1] - 4); }); c.closePath(); c.stroke();
    for (const p of sp) { c.strokeStyle = '#3a2614'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0], p[1] - 6); c.stroke(); c.strokeStyle = '#a07a48'; c.lineWidth = 1; c.beginPath(); c.moveTo(p[0] - 0.3, p[1]); c.lineTo(p[0] - 0.3, p[1] - 6); c.stroke(); g.touchS(p[0] - 2, p[1] - 8); g.touchS(p[0] + 2, p[1] + 1); }
  }
  if (age >= 1 && g.want('prop')) {                       // corner posts (low)
    for (const [x, y] of [[-H - 1.5, -H - 1.5], [H + 1.5 - 3, -H - 1.5], [-H - 1.5, H + 1.5 - 3]]) post(g, x, y, 0, 5.4, 2.6, undefined, { tag: 'prop' });
  }
}


// ----------------------------------------------------------------------------- TOWN CENTER
function townCenter(g, age) {
  const p = pal(age), tc = g.tc;
  const X0 = -52, X1 = 52, Y0 = -46, Y1 = 8, zw = 46, rise = 27, ov = 4;     // main hall
  const WY1 = 50, WIN = 26, WZ = 28, WR = 14;                               // wings (front, flanking the courtyard)
  const hy = (Y0 + Y1) / 2, HALF = (Y1 - Y0) / 2, slope = rise / HALF;
  const zr = y => zw + rise - slope * Math.abs(y - hy);
  g.ground(0, 0, 92, 92, '#4a3a22', 0.32);
  g.cast(X0, Y0, X1, Y1, 70);
  g.cast(X0, Y1, -WIN, WY1, 38, { contact: false }); g.cast(WIN, Y1, X1, WY1, 38, { contact: false });
  // materials
  const wallBase = age === 0 ? woodWall(0) : age === 1 ? mainWall(1, { pw: 24, brace: 'v' }) : age === 2 ? stoneWall(2) : stoneWall(3, { band: [30] });
  const wallAlt = age === 1 ? mainWall(1, { pw: 20, brace: 'x', footing: 8 }) : wallBase;
  const roofP = age === 0 ? P.thatchP({ base: '#c4a048', bh: 9 }) : age === 1 ? roofMat(1, 'main', { base: '#cf6030', tw: 7 }) : age === 2 ? roofMat(2, 'slate', { base: '#7b8494' }) : roofMat(3, 'main', { base: '#9a3a34' });
  const trim = age === 0 ? '#a2823a' : age === 3 ? '#e6bd44' : '#3e2a1c';
  const ridgeC = age === 3 ? '#e6bd44' : tc.main;
  const stoneC = age >= 2 ? '#c4bca8' : '#8d877a';
  // courtyard floor
  g.plane([-WIN, Y1, 0], [1, 0, 0], [0, 1, 0], 2 * WIN, WY1 - Y1, P.flagstoneP({ base: age >= 2 ? '#9a9486' : '#8a7e68', sz: 8 }), { light: 'top', ao: 0, hl: false });
  // chimney stacks (behind / beside the hall)
  chimney(g, X1 - 1, hy - 4, X1 + 6, hy + 3.5, zw + rise + 9, { paint: age >= 3 ? P.ashlarP({ base: '#d8d0bc', ch: 5, bw: 8 }) : P.stoneP({ base: '#9a9484', ch: 5, bw: 8 }), smokeS: 1.3 });
  // ---------------------------------------------------------- hall
  const doorW = 20, doorU = (-X0) - doorW / 2;
  const hallLong = decorate(wallBase,
    (c, w, h) => P.doorD(c, doorU, h - 30, doorW, 30, { style: 'archdouble', surround: age >= 2 ? '#d0c8b4' : '#6a5a46', wood: '#4a3018', frame: age === 3 ? '#e6bd44' : '#2e2016', stepColor: stoneC }),
    win(30, 8, 7, 11, { style: age >= 2 ? 'arch' : 'shutter', shutter: '#6a4a2a', surround: age >= 2 ? stoneC : undefined }),
    win(67, 8, 7, 11, { style: age >= 2 ? 'arch' : 'shutter', shutter: '#6a4a2a', surround: age >= 2 ? stoneC : undefined }),
    (c, w, h) => { P.crestD(c, w / 2 - 5.5, 2, 11, 13, tc); });
  const hallEnd = decorate(wallAlt, win(10, 30, 8, 11, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined }), win(30, 30, 8, 11, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined }), (c, w, h) => { P.windowD(c, w / 2 - 4, 12, 8, 8, { style: 'round' }); });
  g.gableBlock({ x0: X0, y0: Y0, x1: X1, y1: Y1, z0: 0, zw, rise, axis: 'x', long: hallLong, end: hallEnd, ov, ovg: 4, ovb: 4, roof: roofP, trim, ridge: ridgeC, ridgeW: 4.2, thick: age === 0 ? 5 : 3.4, eave: ov });
  // dormers on the hall roof (either side of the tower)
  for (const dx of [-40, -22, 22, 40]) g.dormer({ y0: Y0, y1: Y1, z: zw, rise }, { x: dx, w: 14, hw: 11, rr: 6, t: 0.74, wall: wallBase, roofPaint: roofP, trim,
    win: (c, w, h) => P.windowD(c, w / 2 - 3.5, h - 13, 7, 9, { style: age >= 2 ? 'arch' : 'shutter', shutter: tc.main, surround: age >= 2 ? stoneC : undefined, fr: 1.2 }) });
  // entrance steps
  g.box(-14, Y1, 0, 14, Y1 + 4.5, 3, { left: P.stoneP({ base: stoneC, ch: 3, bw: 6 }), right: P.stoneP({ base: stoneC, ch: 3, bw: 6 }), top: P.flagstoneP({ base: stoneC, sz: 5 }), tag: 'prop', ao: 0 });
  g.box(-16, Y1 + 4.5, 0, 16, Y1 + 8, 1.6, { left: P.stoneP({ base: stoneC, ch: 3, bw: 6 }), right: P.stoneP({ base: stoneC, ch: 3, bw: 6 }), top: P.flagstoneP({ base: stoneC, sz: 5 }), tag: 'prop', ao: 0 });
  // ---------------------------------------------------------- central tower rising through the roof
  const tx0 = -14, tx1 = 14, ty0 = hy - 14, ty1 = hy + 14, zTop = 116;
  const tw = age === 0 ? P.logsP({ base: '#7a5230', d: 6 }) : age === 1 ? mainWall(1, { footing: 0, pw: 13, brace: 'v' }) : stoneWall(age);
  const towerL = decorate(tw, (c, w, h) => {
    P.doorD(c, w / 2 - 6, 5, 12, 18, { style: 'open', arch: true, surround: age >= 2 ? stoneC : '#5a4026', fr: 1.8 });
    P.clockD(c, w / 2, h - 12, 6.5, { rim: age === 3 ? '#e6bd44' : '#7a5a2a' });
  }, (c, w, h) => { P.bannerD(c, 2, h - 50, 7, 22, tc, { shape: 'chevron' }); P.bannerD(c, w - 9, h - 50, 7, 22, tc, { shape: 'chevron' }); });
  const towerR = decorate(tw, (c, w, h) => { P.doorD(c, w / 2 - 6, 5, 12, 18, { style: 'open', arch: true, surround: age >= 2 ? stoneC : '#5a4026', fr: 1.8 }); });
  const wl = zr(ty1), wr = zr(ty1);
  if (g.stage >= 3) {
  g.planeY(ty1, [[tx0, wl], [tx1, wl], [tx1, zTop], [tx0, zTop]], towerL, { eave: 0, ao: 0 });
  g.planeX(tx1, [[ty1, wr], [hy, zr(hy)], [ty0, zr(ty0)], [ty0, zTop], [ty1, zTop]], towerR, { eave: 0, ao: 0 });
  }
  if (g.want('roof')) {
    // gallery band + pyramid roof
    g.box(tx0 - 2, ty0 - 2, zTop - 2, tx1 + 2, ty1 + 2, zTop + 2, { left: P.planksHP({ base: '#6a4a2a', rh: 2 }), right: P.planksHP({ base: '#6a4a2a', rh: 2 }), top: false, tag: 'trim', ao: 0 });
    g.roofHip({ x0: tx0 - 2, y0: ty0 - 2, x1: tx1 + 2, y1: ty1 + 2, z: zTop + 2, rise: 34, ov: 2, paint: age === 0 ? P.thatchP({ base: '#c4a048' }) : age === 1 ? P.panTilesP({ base: '#cf6030' }) : age === 2 ? P.slateP({ base: '#7b8494' }) : P.copperP({ base: '#4f9a86' }), trim: '#2e2016', ridge: age === 3 ? '#e6bd44' : null });
    const [fx, fy] = g.P(0, hy, zTop + 36);
    g.c.fillStyle = '#e8c860'; g.c.beginPath(); g.c.arc(fx, fy - 1, 2.4, 0, 7); g.c.fill(); g.c.strokeStyle = '#6a4a10'; g.c.lineWidth = 0.7; g.c.stroke();
    g.touchS(fx - 3, fy - 5);
  }
  // ---------------------------------------------------------- wings
  const wingWall = age === 0 ? woodWall(0) : age === 1 ? mainWall(1, { pw: 20, brace: 'x' }) : age === 2 ? stoneWall(2) : stoneWall(3, { band: [12] });
  const wingEnd = decorate(wingWall, win(0, 6, 8, 9, { style: age >= 2 ? 'arch' : 'shutter', surround: age >= 2 ? stoneC : undefined, shutter: tc.main }), (c, w, h) => { P.windowD(c, w / 2 - 4, h - 20, 8, 10, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined }); });
  const wingEndP = (c, w, h, r) => { wingEnd(c, w, h, r); };
  const wingSide = decorate(wingWall, win(6, 6, 7, 9, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined }), win(-14, 6, 7, 9, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined }));
  const wingRoof = age === 0 ? P.thatchP({ base: '#c4a048', bh: 8 }) : age === 1 ? roofMat(1, 'main', { base: '#cf6030' }) : age === 2 ? roofMat(2, 'slate', { base: '#7b8494' }) : roofMat(3, 'main', { base: '#9a3a34' });
  for (const [wx0, wx1] of [[X0, -WIN], [WIN, X1]]) {
    g.gableBlock({ x0: wx0, y0: Y1, x1: wx1, y1: WY1, z0: 0, zw: WZ, rise: WR, axis: 'y', long: wingSide, end: wingEndP, ov: 3, ovg: 3, ovb: 0, roof: wingRoof, trim, ridge: ridgeC, ridgeW: 3.2, thick: age === 0 ? 4.5 : 3, eave: 3 });
  }
  if (g.want('prop')) {
    PR.well(g, 0, 30);
    PR.barrel(g, -19, 15, { r: 4.6, h: 10 }); PR.barrel(g, 20, 15.5, { r: 4.6, h: 10 });
    PR.sack(g, 12, 33, { s: 0.9 });
    g.flag(0, hy, zTop + 38, 28, { w: 32, h: 18, shape: 'swallow', amp: 2.4 });
    g.flag(X0 + 4, Y1 + 4, WZ + WR - 2, 18, { shape: 'pennant', w: 17, h: 8, amp: 1.4, emblem: false });
    g.flag(X1 - 3, Y1 + 4, WZ + WR - 2, 18, { shape: 'pennant', w: 17, h: 8, amp: 1.4, emblem: false });
  }
}

export const DEFS = {
  town_center: { hmax: 215, Hc: 46, fp: [-52, -46, 52, 50], draw: townCenter, side: 40 },
  house: { hmax: 100, Hc: 30, fp: [-22, -17, 22, 17], draw: house },
  mill: { hmax: 125, Hc: 50, fp: [-17, -17, 17, 17], draw: mill, side: 60 },
  lumber_camp: { hmax: 90, Hc: 30, fp: [-28, -28, 4, -2], draw: lumberCamp },
  mining_camp: { hmax: 90, Hc: 24, fp: [-27, -27, 1, -1], draw: miningCamp },
  farm: { hmax: 20, Hc: 6, fp: [-45, -45, 45, 45], draw: farm, flat: true },
};
