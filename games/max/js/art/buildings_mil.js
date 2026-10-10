// Military production buildings: barracks, archery range, stable, blacksmith, siege workshop.
import { shade, mix, rgba } from './common.js';
import * as P from './buildings_paint.js';
import { pal, stoneWall, mainWall, woodWall, roofMat, decorate } from './buildings_style.js';
import * as PR from './buildings_props.js';
import { SQ2 } from './buildings_kit.js';
import { chimney } from './buildings_eco.js';
const { tones } = P;

const door = (u, dw, dh, o) => (c, w, h) => P.doorD(c, u < 0 ? w + u : u, h - dh, dw, dh, o);
const win = (u, v, ww, wh, o) => (c, w, h) => P.windowD(c, u < 0 ? w + u : u, v < 0 ? h + v : v, ww, wh, o);

/** round corner turret with cone roof, drawn after the main block */
function turret(g, x, y, r, z0, z1, zTop, age, stoneC, roofPal) {
  g.lathe(x, y, z0, z1, () => r, { pal: tones(stoneC, 6, 0.14), ch: 8, bw: 8, hi: 0.2 });
  if (g.want('roof')) {
    g.cone(x, y, r + 2.4, z1, zTop, { pal: roofPal, ch: 4.5, bw: 6, hi: 0.14, tip: 0.8 });
    const [fx, fy] = g.lp(x, y, 0, 0, zTop);
    g.c.fillStyle = '#e8c860'; g.c.beginPath(); g.c.arc(fx, fy - 1, 1.7, 0, 7); g.c.fill();
    g.touchS(fx - 2, fy - 4);
  }
}

// ----------------------------------------------------------------------------- BARRACKS
function barracks(g, age) {
  const p = pal(age), tc = g.tc;
  const X0 = -42, X1 = 38, Y0 = -44, Y1 = -8, zw = [38, 42, 44, 46][age], rise = [18, 18, 19, 20][age], ov = 4;
  const stoneC = age >= 3 ? '#dcd5c2' : '#a29c8c';
  g.ground(0, 4, 78, 70, '#5a4630', 0.36);
  g.cast(X0, Y0, X1, Y1, zw + rise * 0.7);
  const wall = age === 0 ? woodWall(0, { base: '#7a5a38' }) : age === 1 ? mainWall(1, { pw: 24, brace: 'v' }) : age === 2 ? stoneWall(2) : stoneWall(3, { band: [28] });
  const doorW = 22, doorU = (X1 - X0) / 2 - doorW / 2;
  const shieldXs = [8, 19, 61, 72];
  const long = decorate(wall,
    (c, w, h) => P.doorD(c, doorU, h - 30, doorW, 30, { style: 'archdouble', surround: age >= 2 ? '#d0c8b4' : '#5a4630', wood: '#4a3018', frame: age === 3 ? '#e6bd44' : '#2e2016', stepColor: stoneC }),
    (c, w, h) => { for (const sx of shieldXs) P.roundShieldD(c, sx, 18, 6.3, tc); P.swordsD(c, doorU + doorW / 2, 8, 6.5); },
    (c, w, h) => { if (age >= 1) { P.windowD(c, 29, 8, 5, 10, { style: 'slit' }); P.windowD(c, w - 34, 8, 5, 10, { style: 'slit' }); } });
  const end = decorate(wall, (c, w, h) => { P.windowD(c, w / 2 - 4, h - 26, 8, 12, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined }); P.windowD(c, w / 2 - 3, 12, 6, 6, { style: 'round' }); });
  const roofP = age === 0 ? P.thatchP({ base: '#c4a048', bh: 9 }) : age === 1 ? roofMat(1, 'main', { base: '#b04a2e' }) : age === 2 ? roofMat(2, 'slate', { base: '#7b8494' }) : roofMat(3, 'main', { base: '#9a3a34' });
  const trim = age === 0 ? '#a2823a' : age === 3 ? '#e6bd44' : '#3e2a1c';
  g.gableBlock({ x0: X0, y0: Y0, x1: X1, y1: Y1, z0: 0, zw, rise, axis: 'x', long, end, ov, ovg: 4, ovb: 4, roof: roofP, trim, ridge: tc.main, ridgeW: 4, thick: age === 0 ? 5 : 3.2, eave: ov });
  chimney(g, X1 - 8, Y0 - 5.5, X1 - 2, Y0 + 0.5, zw + rise + 6, { paint: P.stoneP({ base: '#9a9484', ch: 5, bw: 8 }), noCut: true, smokeS: 0.9 });
  if (age >= 1) for (const dx of [-26, -4, 18]) g.dormer({ y0: Y0, y1: Y1, z: zw, rise }, { x: dx, w: 13, hw: 9, rr: 5, t: 0.72, wall: wall, roofPaint: roofP, trim,
    win: (c, w, h) => P.windowD(c, w / 2 - 3, h - 11, 6, 7, { style: age >= 2 ? 'arch' : 'plain', fr: 1, surround: age >= 2 ? stoneC : undefined }) });
  if (age >= 2) {
    const rp = age === 2 ? tones('#7b8494', 6, 0.14) : tones('#a8402e', 6, 0.14);
    turret(g, X0 + 1, Y1 + 1, 8, 0, zw + 8, zw + 32, age, stoneC, rp);
    turret(g, X1 - 1, Y1 + 1, 8, 0, zw + 8, zw + 32, age, stoneC, rp);
  }
  // training yard
  if (g.want('prop')) {
    PR.fence(g, X0 + 2, 40, X1 - 4, 40, { h: 10, col: age === 0 ? '#7a5a38' : '#8a6a42' });
    PR.fence(g, X1 + 0, 40, X1 + 0, Y1 + 6, { h: 10, col: age === 0 ? '#7a5a38' : '#8a6a42' });
    PR.weaponRack(g, -30, Y1 + 6, { kind: 'spear', axis: 'x', len: 22 });
    PR.weaponRack(g, 22, Y1 + 6, { kind: 'sword', axis: 'x', len: 22 });
    PR.dummy(g, -18, 10); PR.dummy(g, 8, 22); PR.dummy(g, -2, 4);
    PR.hay(g, 28, 26, { w: 11, d: 8, h: 7 });
    g.flag(X1 - 2, Y1 + 12, 0, 54, { w: 24, h: 14, shape: 'swallow', amp: 2 });
  }
}

// ----------------------------------------------------------------------------- ARCHERY RANGE
function archeryRange(g, age) {
  const p = pal(age), tc = g.tc;
  const X0 = -44, X1 = 32, Y0 = -44, Y1 = -20, zw = [28, 30, 32, 34][age], rise = [13, 14, 14, 15][age], ov = 4;
  const stoneC = age >= 3 ? '#dcd5c2' : '#a29c8c';
  g.ground(0, 4, 76, 70, '#5a4a2a', 0.36);
  g.cast(X0, Y0, X1, Y1, zw + rise);
  const wall = age === 0 ? woodWall(0, { base: '#7a5a38' }) : age === 1 ? mainWall(1, { pw: 22, brace: 'x' }) : age === 2 ? stoneWall(2) : stoneWall(3, { band: [24] });
  const long = decorate(wall,
    (c, w, h) => { P.doorD(c, 18, h - 22, 14, 22, { style: 'plain', arch: age >= 2, surround: age >= 2 ? '#d0c8b4' : undefined, wood: '#4a3018', frame: '#2e2016', stepColor: stoneC }); P.doorD(c, w - 34, h - 22, 14, 22, { style: 'plain', arch: age >= 2, surround: age >= 2 ? '#d0c8b4' : undefined, wood: '#4a3018', frame: '#2e2016', stepColor: stoneC }); },
    (c, w, h) => { P.bannerD(c, w / 2 - 5, 2, 10, 22, tc, { shape: 'chevron' }); },
    win(44, 8, 6, 9, { style: age >= 2 ? 'arch' : 'plain' }));
  const end = decorate(wall, (c, w, h) => { P.windowD(c, w / 2 - 4, h - 20, 8, 10, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined }); });
  const roofP = age === 0 ? P.thatchP({ base: '#c4a048', bh: 8 }) : age === 1 ? roofMat(1, 'main', { base: '#c4703a' }) : age === 2 ? roofMat(2, 'main', { base: '#a85a38' }) : roofMat(3, 'main', { base: '#9a3a34' });
  const trim = age === 0 ? '#a2823a' : age === 3 ? '#e6bd44' : '#3e2a1c';
  const postP = age === 0 ? P.logsP({ base: '#7a5230', d: 4 }) : age >= 2 ? P.stoneP({ base: '#a29c8c', ch: 4, bw: 6, rough: 0.2 }) : P.planksP({ base: '#8a6038', bw: 2.4, battens: false });
  g.gableBlock({ x0: X0, y0: Y0, x1: X1, y1: Y1, z0: 0, zw, rise, axis: 'x', long, end, ov, ovg: 4, ovb: 4, roof: roofP, trim, ridge: tc.main, ridgeW: 3.6, thick: age === 0 ? 4.5 : 3, eave: ov });
  // covered porch (lean-to) along the front
  const py1 = Y1 + 15, zLow = zw - 10, zHi = zw - 2;
  for (let x = X0 + 6; x <= X1 - 2; x += 17) {
    const pst = (c, w, h, r) => { postP(c, w, h, r); };
    g.box(x - 2.2, py1 - 2.2, 0, x + 2.2, py1 + 2.2, zLow - 1, { left: pst, right: pst, top: pst, ao: 3, hl: false });
  }
  g.roofShed({ x0: X0 - 2, y0: Y1, x1: X1 + 2, y1: py1, zHigh: zHi, zLow, ov: 2.5, ovg: 1, paint: age === 0 ? P.plankRoofP({ base: '#8a6a44' }) : age === 1 ? P.shinglesP({ base: '#7a5a3a' }) : age === 2 ? P.shinglesP({ base: '#6a5a4a' }) : P.shinglesP({ base: '#7a5a3a' }), trim: '#3a2a1c', slope: 'y', thick: 3.2 });
  if (g.want('prop')) {
    PR.weaponRack(g, -26, Y1 + 5, { kind: 'bow', axis: 'x', len: 22 });
    PR.barrel(g, 12, Y1 + 6, { r: 4.4, h: 9.5 }); PR.barrel(g, 20, Y1 + 7, { r: 4.2, h: 9 });
    PR.hay(g, 2, Y1 + 8, { w: 10, d: 8, h: 7 });
    PR.target(g, -30, 20); PR.target(g, -4, 30); PR.target(g, 22, 16);
    PR.fence(g, X0 + 2, 42, X1 + 4, 42, { h: 9, col: age === 0 ? '#7a5a38' : '#8a6a42', step: 12 });
    g.flag(X1 + 4, Y1 + 12, 0, 50, { w: 24, h: 14, shape: 'swallow', amp: 2 });
  }
}

// ----------------------------------------------------------------------------- STABLE
function stable(g, age) {
  const p = pal(age), tc = g.tc;
  const X0 = -42, X1 = 34, Y0 = -44, Y1 = -6, zw = [32, 33, 34, 36][age], rise = [20, 21, 21, 22][age], ov = 4;
  const red = age === 0 ? '#7a5a38' : age === 1 ? '#a0502f' : age === 2 ? '#8f4630' : '#9a4a34';
  const stoneC = '#a29c8c';
  g.ground(0, 6, 78, 72, '#5a4630', 0.36);
  g.cast(X0, Y0, X1, Y1, zw + rise * 0.7);
  const planks = age === 0 ? P.logsP({ base: '#7a5a38' }) : P.planksP({ base: red, bw: 6.5, rails: [0.16, 0.5, 0.86] });
  const wall = age >= 1 ? (c, w, h, r) => {
    planks(c, w, h, r);
    c.save(); c.translate(0, h - 6); c.beginPath(); c.rect(-1, 0, w + 2, 7); c.clip(); P.stoneP({ base: stoneC, ch: 5, bw: 9, rough: 0.3 })(c, w, 6, r); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-1, 0, w + 2, 1); c.restore();
  } : planks;
  const doorsU = [14, 50];
  const long = decorate(wall,
    (c, w, h) => { for (const u of doorsU) P.dutchDoorD(c, u, h - 25, 15, 25, { frame: age === 0 ? '#5a4026' : '#ece4d0', wood: age === 0 ? '#6a4a2a' : shade(red, -0.1), horse: u === doorsU[0] ? '#7a4a28' : null }); },
    (c, w, h) => { P.bannerD(c, w / 2 - 5, 3, 10, 24, tc, { shape: 'chevron' }); P.windowD(c, w / 2 - 10, 6, 5, 6, { style: 'plain', trim: '#ece4d0' }); },
    (c, w, h) => { c.fillStyle = '#c8ccd4'; c.font = ''; /* horseshoe sign */ c.strokeStyle = '#c8ccd4'; c.lineWidth = 1.6; c.beginPath(); c.arc(w / 2 + 12, 11, 3.6, Math.PI * 0.15, Math.PI * 0.85, true); c.stroke(); });
  const end = decorate(wall, (c, w, h) => {
    // hay loft door with straw
    c.fillStyle = '#1a100a'; c.fillRect(w / 2 - 6, h - 30, 12, 13);
    c.fillStyle = '#e6c868'; c.beginPath(); c.moveTo(w / 2 - 6, h - 17); c.lineTo(w / 2 - 5, h - 21); c.lineTo(w / 2 - 2, h - 19); c.lineTo(w / 2, h - 22); c.lineTo(w / 2 + 3, h - 19); c.lineTo(w / 2 + 6, h - 21); c.lineTo(w / 2 + 6, h - 17); c.closePath(); c.fill();
    c.strokeStyle = '#ece4d0'; c.lineWidth = 1.4; c.strokeRect(w / 2 - 6.7, h - 30.7, 13.4, 14.4);
    c.beginPath(); c.moveTo(w / 2 - 6.7, h - 30.7); c.lineTo(w / 2 + 6.7, h - 16.3); c.moveTo(w / 2 + 6.7, h - 30.7); c.lineTo(w / 2 - 6.7, h - 16.3); c.stroke();
  });
  const roofP = age === 0 ? P.thatchP({ base: '#c4a048', bh: 9 }) : age === 1 ? P.shinglesP({ base: '#8a6a44' }) : age === 2 ? roofMat(2, 'slate', { base: '#7b8494' }) : roofMat(3, 'main', { base: '#9a3a34' });
  const trim = age === 0 ? '#a2823a' : '#ece4d0';
  g.gableBlock({ x0: X0, y0: Y0, x1: X1, y1: Y1, z0: 0, zw, rise, axis: 'x', long, end, ov, ovg: 4, ovb: 4, roof: roofP, trim, ridge: age === 0 ? '#8a6a2a' : tc.main, ridgeW: 3.6, thick: age === 0 ? 5 : 3.2, eave: ov });
  if (g.want('prop')) {
    // loft pulley beam at the right gable apex
    const [ax, ay] = g.P(X1 + 3, (Y0 + Y1) / 2, zw + rise - 6);
    const c = g.c; c.strokeStyle = '#2a1a0c'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(ax - 6, ay + 1); c.lineTo(ax + 7, ay + 7); c.stroke();
    c.strokeStyle = '#8a6a40'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ax - 6, ay); c.lineTo(ax + 7, ay + 6); c.stroke();
    c.strokeStyle = '#d8c8a0'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(ax + 6, ay + 6.5); c.lineTo(ax + 6, ay + 17); c.stroke();
    c.fillStyle = '#9aa0aa'; c.fillRect(ax + 4.6, ay + 17, 2.8, 2.4);
    g.touchS(ax - 7, ay - 2); g.touchS(ax + 9, ay + 21);
    // paddock
    PR.fence(g, X0 + 2, 42, X1 + 6, 42, { h: 11, col: age === 0 ? '#7a5a38' : '#ece4d0', step: 11 });
    PR.fence(g, X1 + 6, 42, X1 + 6, Y1 + 8, { h: 11, col: age === 0 ? '#7a5a38' : '#ece4d0', step: 11 });
    PR.fence(g, X0 + 2, 42, X0 + 2, Y1 + 8, { h: 11, col: age === 0 ? '#7a5a38' : '#ece4d0', step: 11 });
    PR.trough(g, -14, 20, { len: 16 });
    PR.hay(g, 20, 8, { w: 12, d: 9, h: 8 }); PR.hay(g, 25, 9, { w: 10, d: 8, h: 7, z: 8 });
    PR.strawPile(g, -26, 14, { r: 8 });
    g.flag(X1 + 4, Y1 + 3, 0, 52, { w: 24, h: 14, shape: 'swallow', amp: 2 });
  }
}

// ----------------------------------------------------------------------------- BLACKSMITH
function blacksmith(g, age) {
  const p = pal(age), tc = g.tc;
  const X0 = -42, X1 = 22, Y0 = -44, Y1 = -14, zw = [32, 34, 36, 38][age], rise = [18, 19, 19, 19][age], ov = 3.5;
  const stoneC = age >= 3 ? '#cfc8b4' : '#8a8478';
  g.ground(0, 4, 76, 70, '#3a3026', 0.45);
  g.cast(X0, Y0, X1 + 9, Y1, zw + rise);
  const wall = age === 0 ? stoneWall(0, { base: '#7a746a' }) : age === 1 ? stoneWall(1, { base: '#857f74' }) : age === 2 ? stoneWall(2, { base: '#7f7a70' }) : stoneWall(3, { base: '#cfc8b4', band: [24] });
  const long = decorate(wall, win(50, 8, 7, 9, { style: age >= 2 ? 'arch' : 'plain', surround: age >= 2 ? stoneC : undefined, lit: true }), (c, w, h) => { P.bannerD(c, 6, 3, 9, 22, tc, { shape: 'cross' }); P.cogD(c, w - 12, 12, 5, { col: '#2e2c30' }); });
  const end = decorate(wall, (c, w, h) => { P.windowD(c, w / 2 - 3.5, h - 18, 7, 9, { style: 'slit' }); });
  const roofP = age === 0 ? P.plankRoofP({ base: '#6a5036' }) : age === 1 ? P.slateP({ base: '#5a6070' }) : age === 2 ? P.slateP({ base: '#50586a' }) : roofMat(3, 'main', { base: '#7a3a34' });
  g.gableBlock({ x0: X0, y0: Y0, x1: X1, y1: Y1, z0: 0, zw, rise, axis: 'x', long, end, ov, ovg: 3.5, ovb: 3.5, roof: roofP, trim: '#2e2420', ridge: '#3a3028', ridgeW: 3, thick: 3, eave: ov });
  // big forge chimney at the right end
  chimney(g, X1 + 0.5, -34, X1 + 9.5, -22, zw + rise + 22, { paint: P.stoneP({ base: '#7a746a', ch: 6, bw: 9, rough: 0.35 }), capCol: '#4a463e', smokeS: 1.5 });
  PR.glow(g, X1 + 5, -28, zw + rise + 8, 20, '255,120,40', 0.28);
  // open forge shed (lean-to) at the front
  const sx0 = -38, sx1 = 8, sy1 = 14, zHi = zw - 6, zLow = 22;
  const postP = P.planksP({ base: '#6a4a2a', bw: 2.4, battens: false });
  const stoneP = P.stoneP({ base: '#8a8478', ch: 4, bw: 6, rough: 0.3 });
  for (const x of [sx0 + 2, sx1 - 2]) g.box(x - 2.4, Y1 + 2 - 2.4, 0, x + 2.4, Y1 + 2 + 2.4, zHi - 1, { left: postP, right: postP, top: postP, ao: 3, hl: false });
  if (g.want('prop')) {
    PR.hearth(g, -22, 0);
    PR.anvil(g, -4, 4);
    PR.barrel(g, -34, 6, { r: 4.4, h: 9.5, col: '#5a4a38' });
    PR.weaponRack(g, -14, Y1 + 3, { kind: 'sword', axis: 'x', len: 20 });
  }
  for (const x of [sx0 + 2, sx1 - 2]) g.box(x - 2.4, sy1 - 2.4, 0, x + 2.4, sy1 + 2.4, zLow - 1, { left: postP, right: postP, top: postP, ao: 3, hl: false });
  g.roofShed({ x0: sx0, y0: Y1, x1: sx1, y1: sy1, zHigh: zHi, zLow, ov: 3, ovg: 2, paint: roofP, trim: '#2e2420', slope: 'y', thick: 2.8 });
  if (g.want('prop')) {
    PR.stumpAxe(g, 18, 14); PR.sack(g, 24, 22, { s: 0.8, col: '#4a4038' });
    PR.crate(g, 14, 26, 8, { col: '#6a5238' });
    g.flag(X1 + 8, 4, 0, 46, { w: 22, h: 13, shape: 'swallow', amp: 2 });
  }
}

// ----------------------------------------------------------------------------- SIEGE WORKSHOP
function siegeWorkshop(g, age) {
  const p = pal(age), tc = g.tc;
  const X0 = -44, X1 = 36, Y0 = -46, Y1 = -6, zw = [36, 38, 40, 42][age], rise = [20, 21, 22, 22][age], ov = 4;
  const stoneC = age >= 3 ? '#dcd5c2' : '#a29c8c';
  g.ground(0, 6, 80, 74, '#4a3c28', 0.42);
  g.cast(X0, Y0, X1, Y1, zw + rise * 0.7);
  const base = age === 0 ? woodWall(0, { base: '#7a5a38' }) : age === 1 ? P.planksP({ base: '#8a6038', bw: 6.5, rails: [0.14, 0.5, 0.88] }) : age === 2 ? stoneWall(2) : stoneWall(3, { band: [26] });
  const wall = age === 1 ? (c, w, h, r) => { base(c, w, h, r); c.save(); c.translate(0, h - 6); c.beginPath(); c.rect(-1, 0, w + 2, 7); c.clip(); P.stoneP({ base: stoneC, ch: 5, bw: 9, rough: 0.3 })(c, w, 6, r); c.restore(); } : base;
  const bayW = 34, bayU = (X1 - X0) / 2 - bayW / 2 - 4;
  const long = decorate(wall, (c, w, h) => {
    // big open bay with swung-open doors and a ram frame inside
    const bh = 29, bx = bayU, by = h - bh;
    c.fillStyle = age >= 2 ? '#c4bca8' : '#4a3220'; c.fillRect(bx - 3, by - 3, bayW + 6, bh + 3);
    const gr = c.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, '#0a0604'); gr.addColorStop(1, '#2e2016'); c.fillStyle = gr; c.fillRect(bx, by, bayW, bh);
    // beams of the unfinished siege machine inside
    c.fillStyle = '#7a5a34'; c.fillRect(bx + 3, by + 14, bayW - 6, 3.2); c.fillRect(bx + 5, by + 10, 3, 14); c.fillRect(bx + bayW - 8, by + 10, 3, 14);
    c.fillStyle = '#3a2a1a'; c.fillRect(bx + 8, by + 18, bayW - 16, 4);
    c.fillStyle = '#9aa0aa'; c.fillRect(bx + bayW / 2 - 6, by + 15, 12, 3.4);
    // door leaves swung open at the sides (seen edge-on, slightly angled)
    for (const sgn of [-1, 1]) {
      const lx = sgn < 0 ? bx - 6 : bx + bayW + 1;
      c.fillStyle = '#5a3c22'; c.fillRect(lx, by - 1, 5, bh + 1); c.fillStyle = 'rgba(255,230,170,0.2)'; c.fillRect(lx, by - 1, 0.9, bh + 1);
      c.fillStyle = '#2a2a30'; c.fillRect(lx, by + 6, 5, 1.6); c.fillRect(lx, by + 19, 5, 1.6);
    }
    c.strokeStyle = age >= 2 ? '#8d877a' : '#2e2016'; c.lineWidth = 1; c.strokeRect(bx - 3, by - 3, bayW + 6, bh + 3);
  }, (c, w, h) => { P.bannerD(c, 8, 3, 9, 22, tc, { shape: 'cross' }); P.bannerD(c, w - 17, 3, 9, 22, tc, { shape: 'cross' }); P.cogD(c, 20, 40 - 16, 5.2); });
  const end = decorate(wall, (c, w, h) => { P.cogD(c, w / 2, h - 30, 10.5); P.windowD(c, w / 2 - 12, h - 14, 5, 7, { style: 'slit' }); P.windowD(c, w / 2 + 7, h - 14, 5, 7, { style: 'slit' }); });
  const roofP = age === 0 ? P.plankRoofP({ base: '#7a5a38' }) : age === 1 ? P.shinglesP({ base: '#8a6a44' }) : age === 2 ? roofMat(2, 'slate', { base: '#7b8494' }) : roofMat(3, 'main', { base: '#9a3a34' });
  const trim = age === 0 ? '#4a3220' : age === 3 ? '#e6bd44' : '#3e2a1c';
  g.gableBlock({ x0: X0, y0: Y0, x1: X1, y1: Y1, z0: 0, zw, rise, axis: 'x', long, end, ov, ovg: 4, ovb: 4, roof: roofP, trim, ridge: tc.main, ridgeW: 3.6, thick: 3.2, eave: ov });
  chimney(g, X0 + 6, Y0 - 5.5, X0 + 12.5, Y0 + 0.5, zw + rise + 6, { paint: P.stoneP({ base: '#8a8478', ch: 5, bw: 8 }), noCut: true, smokeS: 0.9 });
  if (g.want('prop')) {
    // half-built mangonel frame on the right
    const c = g.c;
    const bx = 18, by = 10;
    PR.log(g, bx - 12, by - 6, 3, 26, 2.2, 'x', { col: '#8a6038' });
    PR.log(g, bx - 12, by + 6, 3, 26, 2.2, 'x', { col: '#8a6038' });
    PR.wheel(g, bx - 8, by + 8.5, 4, 5.5, 'x'); PR.wheel(g, bx + 10, by + 8.5, 4, 5.5, 'x');
    const A = g.P(bx - 4, by, 6), B = g.P(bx + 6, by, 34);
    c.strokeStyle = '#2a1a0c'; c.lineWidth = 3.6; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
    c.strokeStyle = '#8a6038'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(A[0] - 0.4, A[1]); c.lineTo(B[0] - 0.4, B[1]); c.stroke();
    c.fillStyle = '#5a4026'; c.beginPath(); c.moveTo(B[0] - 4, B[1] - 1); c.lineTo(B[0] + 5, B[1] - 3); c.lineTo(B[0] + 4, B[1] + 5); c.lineTo(B[0] - 3, B[1] + 5); c.closePath(); c.fill(); c.strokeStyle = '#1a0e06'; c.lineWidth = 0.8; c.stroke();
    g.touchS(B[0] - 6, B[1] - 6);
    // tall A-frame crane on the left with a hoisted log
    const cx = -38, cy = 14;
    const base = g.P(cx, cy, 0), top = g.P(cx, cy, 66), jib = g.P(cx + 18, cy + 8, 62), jibBack = g.P(cx - 8, cy - 4, 62);
    c.lineCap = 'round';
    const beam = (a, b, w) => { c.strokeStyle = '#2a1a0c'; c.lineWidth = w + 1.4; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.strokeStyle = '#7a5a34'; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.strokeStyle = 'rgba(255,230,170,0.35)'; c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(a[0] - 0.5, a[1]); c.lineTo(b[0] - 0.5, b[1]); c.stroke(); };
    beam([base[0] - 9, base[1] + 3], top, 3); beam([base[0] + 9, base[1] + 3], top, 3); beam([base[0], base[1] - 4], top, 2.6);
    beam(top, jib, 3); beam(top, jibBack, 2.6);
    beam([base[0] - 6, base[1] + 1 - 20], [base[0] + 6, base[1] + 1 - 20], 1.8);
    c.strokeStyle = '#d8c8a0'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(jib[0], jib[1]); c.lineTo(jib[0] - 3.5, jib[1] + 24); c.moveTo(jib[0], jib[1]); c.lineTo(jib[0] + 3.5, jib[1] + 24); c.stroke();
    c.fillStyle = '#3a2a1c'; c.beginPath(); c.arc(jib[0], jib[1], 2.2, 0, 7); c.fill();
    { const lg = c.createLinearGradient(0, jib[1] + 23, 0, jib[1] + 30); lg.addColorStop(0, '#a07a4a'); lg.addColorStop(1, '#4a3018'); c.fillStyle = lg; c.beginPath(); c.ellipse(jib[0], jib[1] + 26, 8, 2.8, 0.18, 0, 7); c.fill(); c.strokeStyle = '#1a0e06'; c.lineWidth = 0.8; c.stroke(); c.fillStyle = '#d9b878'; c.beginPath(); c.ellipse(jib[0] + 7.2, jib[1] + 26.6, 1.4, 2.4, 0.18, 0, 7); c.fill(); }
    g.touchS(base[0] - 12, top[1] - 6); g.touchS(jib[0] + 10, jib[1] + 32);
    PR.logStack(g, -22, 20, 22, 2.8, [3, 2], 'x', { col: '#7a5230' });
    PR.crate(g, 0, 30, 8); PR.barrel(g, 30, 30, { r: 4.4, h: 9.5 });
    g.flag(X1 + 2, Y1 + 4, 0, 52, { w: 24, h: 14, shape: 'swallow', amp: 2 });
  }
}

export const DEFS = {
  barracks: { hmax: 140, Hc: 40, fp: [-42, -44, 38, -8], draw: barracks },
  archery_range: { hmax: 120, Hc: 28, fp: [-44, -44, 32, -20], draw: archeryRange },
  stable: { hmax: 120, Hc: 32, fp: [-42, -44, 34, -6], draw: stable },
  blacksmith: { hmax: 150, Hc: 33, fp: [-42, -44, 22, -14], draw: blacksmith },
  siege_workshop: { hmax: 130, Hc: 36, fp: [-44, -46, 36, -6], draw: siegeWorkshop },
};
