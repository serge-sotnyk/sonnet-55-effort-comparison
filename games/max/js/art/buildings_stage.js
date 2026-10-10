// Generic construction-site dressing (foundation, scaffolding, material piles) and rubble sprites.
import { rng, shade, mix, rgba, teamColor, hash01 } from './common.js';
import * as P from './buildings_paint.js';
import * as PR from './buildings_props.js';
import { Scene, SQ2 } from './buildings_kit.js';

const SITE = { tag: 'site' };

function fpOf(def, n) {
  if (def && def.fp) return def.fp;
  const h = 16 * n - 5; return [-h, -h, h, h];
}

/** dirt foundation, stakes and cord - drawn BEFORE the (partial) structure */
export function constructionBefore(g, def, n) {
  if (def && def.flat) return;                              // flat buildings (farm) draw their own ground
  const [x0, y0, x1, y1] = fpOf(def, n);
  const rnd = g.rr;
  const m = 3 + n * 0.8;
  // ragged dirt patch
  const poly = [];
  const wx = x1 - x0 + m * 2, wy = y1 - y0 + m * 2;
  const pts = [];
  const N = 8 * (n + 1);
  const jag = () => (rnd() - 0.5) * 5;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push([x0 - m + wx * t + jag(), y0 - m + jag()]); }
  for (let i = 1; i <= N; i++) { const t = i / N; pts.push([x1 + m + jag(), y0 - m + wy * t + jag()]); }
  for (let i = 1; i <= N; i++) { const t = i / N; pts.push([x1 + m - wx * t + jag(), y1 + m + jag()]); }
  for (let i = 1; i < N; i++) { const t = i / N; pts.push([x0 - m + jag(), y1 + m - wy * t + jag()]); }
    g.ground(0, 0, wx * 0.72, wy * 0.72, '#3a2a18', 0.22);
  g.polyFlat(pts.map(([x, y]) => [x, y, 0]), '#6a4c2c');
  // texture over the patch (clip to polygon in screen space)
  const c = g.c;
  c.save(); c.beginPath();
  pts.forEach(([x, y], i) => { const [sx, sy] = g.P(x, y, 0); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); });
  c.closePath(); c.clip();
  g.plane([x0 - m - 6, y0 - m - 6, 0], [1, 0, 0], [0, 1, 0], wx + 12, wy + 12, P.dirtP({ base: '#745532' }), { light: 'top', ao: 0, hl: false });
  c.restore();
  // stage-dependent footing marks
  if (g.stage <= 1) {
    // timber footing sills / first stone courses outline (a thin raised rim)
    const sill = (c2, w, h) => { c2.fillStyle = '#8a8272'; c2.fillRect(-1, -1, w + 2, h + 2); c2.fillStyle = 'rgba(255,255,255,0.25)'; c2.fillRect(0, 0, w, 0.9); };
    if (g.stage === 0) {
      g.box(x0, y1 - 1.8, 0, x1, y1, 1.6, { left: sill, right: false, top: sill, tag: 'site', noCut: true, ao: 0 });
      g.box(x1 - 1.8, y0, 0, x1, y1, 1.6, { left: false, right: sill, top: sill, tag: 'site', noCut: true, ao: 0 });
    }
  }
}

function pole(g, x, y, z0, z1, col = '#7a5a34', w = 2.4) {
  const c = g.c, a = g.P(x, y, z0), b = g.P(x, y, z1);
  c.strokeStyle = 'rgba(20,10,4,0.45)'; c.lineWidth = w + 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  c.strokeStyle = shade(col, 0.3); c.lineWidth = w * 0.32; c.beginPath(); c.moveTo(a[0] - w * 0.25, a[1]); c.lineTo(b[0] - w * 0.25, b[1]); c.stroke();
  g.touchS(a[0] - 2, b[1] - 3); g.touchS(a[0] + 2, a[1] + 2);
}
function beam(g, A, B, col = '#7a5a34', w = 2) {
  const c = g.c, a = g.P(A[0], A[1], A[2]), b = g.P(B[0], B[1], B[2]);
  c.strokeStyle = 'rgba(20,10,4,0.45)'; c.lineWidth = w + 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  g.touchS(Math.min(a[0], b[0]) - 2, Math.min(a[1], b[1]) - 2); g.touchS(Math.max(a[0], b[0]) + 2, Math.max(a[1], b[1]) + 2);
}

function planksPile(g, x, y, w, d, h) {
  const f = P.planksHP({ base: '#a07a48', rh: 2.4 });
  const top = (c, ww, hh) => { c.fillStyle = '#b08a52'; c.fillRect(-1, -1, ww + 2, hh + 2); c.strokeStyle = 'rgba(60,30,10,0.4)'; c.lineWidth = 0.6; for (let i = 3; i < ww; i += 3.5) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, hh); c.stroke(); } };
  g.box(x - w / 2, y - d / 2, 0, x + w / 2, y + d / 2, h, { left: f, right: f, top, tag: 'site', noCut: true, ao: 2, hl: false });
}
function stoneBlock(g, x, y, s, h) {
  const f = P.stoneP({ base: '#a6a090', ch: 4, bw: 6, rough: 0.3 });
  const top = (c, ww, hh) => { c.fillStyle = '#b4ae9e'; c.fillRect(-1, -1, ww + 2, hh + 2); };
  g.box(x - s / 2, y - s / 2, 0, x + s / 2, y + s / 2, h, { left: f, right: f, top, tag: 'site', noCut: true, ao: 2, hl: false });
}

/** scaffolding around the front (SW & SE) faces of the main mass */
export function scaffold(g, x0, y0, x1, y1, hTop, o = {}) {
  const off = o.off || 6, step = o.step || 13;
  const deckP = P.planksHP({ base: '#9a7444', rh: 3 });
  const levels = []; for (let z = step; z < hTop; z += step) levels.push(z);
  const px = []; for (let x = x0 + 4; x < x1 - 2; x += Math.max(18, (x1 - x0) / Math.ceil((x1 - x0) / 22))) px.push(x);
  px.push(x1 + off);
  const py = []; for (let y = y0 + 4; y < y1 - 2; y += Math.max(18, (y1 - y0) / Math.ceil((y1 - y0) / 22))) py.push(y);
  // SE face poles + decks (back first)
  for (const y of py) pole(g, x1 + off, y, 0, hTop + 6);
  for (const z of levels) {
    g.plane([x1, y1, z], [0, -1, 0], [1, 0, 0], y1 - y0, off, deckP, { light: 'top', ao: 0, hl: false, under: '#7a5a34' });
    // front edge board
    beam(g, [x1 + off, y1, z], [x1 + off, y0, z], '#8a6a3a', 2.2);
  }
  // diagonal braces on the SE face
  for (let i = 0; i < levels.length; i += 2) {
    const z = levels[i];
    for (let k = 0; k + 1 < py.length; k++) beam(g, [x1 + off, py[k], z], [x1 + off, py[k + 1], z + step], '#6f5230', 1.6);
  }
  pole(g, x1 + off, y1 + off, 0, hTop + 6);
  // SW face
  for (const z of levels) {
    g.plane([x0, y1 + off, z], [1, 0, 0], [0, -1, 0], x1 - x0 + off, off, deckP, { light: 'top', ao: 0, hl: false, under: '#7a5a34' });
    beam(g, [x0, y1 + off, z], [x1 + off, y1 + off, z], '#8a6a3a', 2.2);
  }
  for (const x of px.slice(0, -1)) pole(g, x, y1 + off, 0, hTop + 6);
  for (let i = 0; i < levels.length; i += 2) {
    const z = levels[i], xs = px;
    for (let k = 0; k + 1 < xs.length; k++) beam(g, [xs[k], y1 + off, z + step], [xs[k + 1], y1 + off, z], '#6f5230', 1.6);
  }
  // ladder at the left end
  const lx = x0 + 6, lz = Math.min(hTop, levels.length ? levels[levels.length - 1] : step);
  beam(g, [lx, y1 + off + 3, 0], [lx, y1 + off - 1, lz], '#8a6a3a', 1.6);
  beam(g, [lx + 5, y1 + off + 3, 0], [lx + 5, y1 + off - 1, lz], '#8a6a3a', 1.6);
  for (let z = 4; z < lz; z += 4.5) beam(g, [lx, y1 + off + 3 - 4 * z / lz, z], [lx + 5, y1 + off + 3 - 4 * z / lz, z], '#a88050', 1.2);
}

/** scaffolding, material piles, flag - drawn AFTER the structure */
export function constructionAfter(g, def, n) {
  const [x0, y0, x1, y1] = fpOf(def, n);
  const st = g.stage;
  if (def && def.flat) {                                    // farm: seed sacks and a flag only
    PR.sack(g, x1 + 4, y1 - 6, SITE); PR.sack(g, x1 + 10, y1 - 2, Object.assign({ s: 0.85 }, SITE));
    g.flag(x0 - 2, y1 + 2, 0, 22, { tag: 'always', w: 17, h: 10, shape: 'swallow', amp: 1.5 });
    return;
  }
  if (st >= 1 && !(def && def.noScaffold)) {
    const top = st === 1 ? g.Hc * 0.35 + 14 : st === 2 ? g.Hc + 10 : Math.max(g.Hc + 14, Math.min(g.Hc * 1.4, g.Hc + 30));
    scaffold(g, x0, y0, x1, y1, top, { off: 5 + n * 0.5 });
  }
  const rnd = rng(g.seed ^ 0x5bd1e995);
  const fx = x1 + 5 + n, fy = y1 + 5 + n;
  // materials in front / beside
  if (st === 0) {
    planksPile(g, x1 - 8, y1 + 8, 22 + n * 4, 9, 6);
    PR.logStack(g, x0 + 6, y1 + 12 + n, 22, 2.8, [3, 2], 'x', SITE);
    stoneBlock(g, x1 + 8, y0 + 12, 8, 6); stoneBlock(g, x1 + 10, y0 + 22, 6, 4);
    PR.sack(g, x1 - 2, y1 + 15, SITE);
  } else if (st === 1) {
    planksPile(g, x1 + 8, y0 + 18, 8, 22, 7);
    stoneBlock(g, x0 + 10, y1 + 12 + n, 9, 7); stoneBlock(g, x0 + 22, y1 + 14 + n, 7, 5);
    PR.barrel(g, x1 + 6, y1 + 8, Object.assign({ r: 4.6, h: 10 }, SITE));
  } else if (st === 2) {
    planksPile(g, x1 + 8, y0 + 16, 8, 18, 5);
    PR.sack(g, x0 + 10, y1 + 12 + n, SITE); PR.sack(g, x0 + 18, y1 + 14 + n, Object.assign({ s: 0.85 }, SITE));
  } else {
    PR.logStack(g, x1 + 10, y0 + 6, 20, 2.4, [2, 1], 'y', SITE);
    PR.crate(g, x0 + 8, y1 + 13 + n, 7, SITE);
  }
  // team marker flag on the site
  g.flag(x0 - 2, y1 + 4, 0, 24 + n * 3, { tag: 'always', w: 17, h: 10, shape: 'swallow', amp: 1.5 });
}

// ----------------------------------------------------------------------------- rubble
function beam2D(g, sx, sy, len, ang, th, col, charred) {
  const c = g.c, ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len * 0.62, nx = -Math.sin(ang) * th * 0.5, ny = Math.cos(ang) * th * 0.5;
  const gr = c.createLinearGradient(sx + nx, sy + ny, sx - nx, sy - ny);
  gr.addColorStop(0, shade(col, 0.25)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.4));
  c.beginPath(); c.moveTo(sx + nx, sy + ny); c.lineTo(ex + nx * 0.9, ey + ny * 0.9);
  // splintered end
  c.lineTo(ex + Math.cos(ang) * 2.2 + nx * 0.2, ey + Math.sin(ang) * 1.4 - 0.5); c.lineTo(ex - nx * 0.6, ey - ny * 0.6 + 1.2); c.lineTo(ex - nx * 0.9, ey - ny * 0.9);
  c.lineTo(sx - nx, sy - ny); c.closePath();
  c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(15,8,4,0.6)'; c.lineWidth = 0.7; c.stroke();
  if (charred) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.7; c.beginPath(); for (let k = 1; k < 4; k++) { c.moveTo(sx + (ex - sx) * k / 4 + nx * 0.3, sy + (ey - sy) * k / 4 + ny * 0.3); c.lineTo(sx + (ex - sx) * (k + 0.6) / 4 - nx * 0.3, sy + (ey - sy) * (k + 0.6) / 4 - ny * 0.3); } c.stroke(); }
  g.touchS(Math.min(sx, ex) - th, Math.min(sy, ey) - th); g.touchS(Math.max(sx, ex) + th, Math.max(sy, ey) + th);
}
export function makeRubble(n, variant) {
  const g = new Scene(n, { stage: 4, team: 0, seed: 777 + n * 31 + variant * 101, hmax: 26 + n * 4, side: 30 });
  const rnd = rng(g.seed);
  const c = g.c, R = 14 * n;
  g.ground(0, 0, R * 1.45, R * 1.45, '#1c140c', 0.42);
  g.ground(rnd() * 5 - 2.5, rnd() * 5 - 2.5, R * 1.05, R * 1.05, '#2e2216', 0.5);
  // scorched / ash discs on the ground (flat, iso)
  const ash = Math.max(2, Math.round(n * 1.6));
  for (let i = 0; i < ash; i++) {
    const x = (rnd() - 0.5) * R * 1.4, y = (rnd() - 0.5) * R * 1.4, r = 5 + rnd() * R * 0.35;
    const [sx, sy] = g.P(x, y, 0);
    const gr = c.createRadialGradient(sx, sy, 0, sx, sy, r * 1.4); gr.addColorStop(0, 'rgba(24,20,16,0.55)'); gr.addColorStop(1, 'rgba(24,20,16,0)');
    c.save(); c.translate(sx, sy); c.scale(1, 0.5); c.translate(-sx, -sy); c.fillStyle = gr; c.beginPath(); c.arc(sx, sy, r * 1.4, 0, 7); c.fill(); c.restore();
  }
  // heaps of broken masonry (screen-space pyramids of chunks), back to front
  const nh = n === 1 ? 1 : n === 2 ? 2 : 2 + (variant % 2) + (n > 3 ? 1 : 0);
  const heaps = [];
  for (let h = 0; h < nh; h++) {
    const a = rnd() * Math.PI * 2, d = h === 0 ? rnd() * R * 0.25 : R * (0.35 + rnd() * 0.3);
    heaps.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: R * (h === 0 ? 0.62 : 0.34 + rnd() * 0.12) });
  }
  heaps.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const kinds = ['stone', 'stone', 'stone', 'ore'];
  for (const hp of heaps) {
    const [hx, hy] = g.P(hp.x, hp.y, 0);
    const pieces = [];
    const cnt = Math.round(10 + hp.r * hp.r / 14);
    for (let i = 0; i < cnt; i++) {
      const t = rnd(), ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * hp.r;
      const px = Math.cos(ang) * rr * 1.25, py = Math.sin(ang) * rr * 0.55;
      const height = (1 - (rr / hp.r) ** 1.5) * hp.r * 0.55;
      pieces.push({ x: hx + px, y: hy + py - height, r: 2.2 + rnd() * (2 + hp.r * 0.07), k: kinds[(rnd() * 4) | 0], s: (rnd() * 1000) | 0 });
    }
    pieces.sort((a, b) => a.y - b.y);
    // dark base under the heap
    const gr = c.createRadialGradient(hx, hy, 0, hx, hy, hp.r * 1.3); gr.addColorStop(0, 'rgba(10,6,3,0.5)'); gr.addColorStop(1, 'rgba(10,6,3,0)');
    c.save(); c.translate(hx, hy); c.scale(1, 0.5); c.translate(-hx, -hy); c.fillStyle = gr; c.beginPath(); c.arc(hx, hy, hp.r * 1.3, 0, 7); c.fill(); c.restore();
    for (const pc of pieces) PR.chunk(g, pc.x, pc.y, pc.r, pc.k, pc.s);
    // timber poking out of the heap
    const nb = 1 + Math.round(hp.r / 12);
    for (let b = 0; b < nb; b++) {
      const bx = hx + (rnd() - 0.5) * hp.r * 1.1, by = hy - hp.r * (0.15 + rnd() * 0.3);
      beam2D(g, bx, by, 9 + rnd() * hp.r * 0.7, -0.35 + (rnd() - 0.5) * 2.4, 2.6 + rnd() * 1.4, rnd() < 0.5 ? '#3a2a1c' : '#6a4a2c', rnd() < 0.5);
    }
  }
  // lone walls stubs, posts and scattered stones around
  const stoneP = P.stoneP({ base: '#8d877a', ch: 4, bw: 6, rough: 0.5 });
  const top = (cc, ww, hh) => { cc.fillStyle = '#948e80'; cc.fillRect(-1, -1, ww + 2, hh + 2); };
  if (n >= 2) for (let k = 0; k < Math.min(3, n - 1); k++) {
    const a = rnd() * 6.28, d = R * (0.55 + rnd() * 0.35), x = Math.cos(a) * d, y = Math.sin(a) * d, len = 8 + rnd() * 10, h = 4 + rnd() * 7;
    if (rnd() < 0.5) g.box(x, y, 0, x + len, y + 4.5, h, { left: stoneP, right: stoneP, top, tag: 'site', noCut: true, ao: 2, hl: false });
    else g.box(x, y, 0, x + 4.5, y + len, h, { left: stoneP, right: stoneP, top, tag: 'site', noCut: true, ao: 2, hl: false });
  }
  const loose = Math.round(4 + n * n * 1.8);
  for (let i = 0; i < loose; i++) {
    const a = rnd() * Math.PI * 2, d = R * (0.5 + rnd() * 0.65);
    const [sx, sy] = g.P(Math.cos(a) * d, Math.sin(a) * d, 0);
    PR.chunk(g, sx, sy, 1.8 + rnd() * 2.4, 'stone', i * 17 + 3);
  }
  for (let i = 0; i < Math.round(n * 1.4); i++) {
    const a = rnd() * 6.28, d = R * (0.25 + rnd() * 0.7);
    const [sx, sy] = g.P(Math.cos(a) * d, Math.sin(a) * d, 0), h = 5 + rnd() * 8;
    c.fillStyle = '#2a1e14'; c.beginPath(); c.moveTo(sx - 2.2, sy); c.lineTo(sx - 2, sy - h); c.lineTo(sx - 0.8, sy - h + 2.5); c.lineTo(sx + 0.5, sy - h - 1); c.lineTo(sx + 2, sy - h + 1.5); c.lineTo(sx + 2.2, sy); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = 'rgba(255,120,40,0.35)'; c.fillRect(sx - 1.4, sy - h + 2.5, 0.8, 2.2);
    g.touchS(sx - 3, sy - h - 2); g.touchS(sx + 3, sy + 1);
  }
  const res = g.finish();
  return { canvas: res.surf.canvas, w: res.surf.w, h: res.surf.h, ax: res.ax, ay: res.ay };
}

// ----------------------------------------------------------------------------- generic construction site (no building type)
export function makeSite(n, stage, variant) {
  const h = 16 * n - 6, Hc = 14 + 9 * n;
  const g = new Scene(n, { stage, team: 1, age: 0, seed: 4242 + n * 17 + variant * 53 + stage, hmax: Hc + 50, side: 50 });
  g.setHc(Hc);
  const def = { fp: [-h, -h, h, h] };
  constructionBefore(g, def, n);
  g.cast(-h, -h, h, h, Hc + 10);
  const wood = P.planksP({ base: '#8a6038', bw: 5.5 });
  g.box(-h + 3, -h + 3, 0, h - 3, h - 3, Hc, { left: wood, right: wood, top: false, ao: 4, eave: 2 });
  g.roofGable({ x0: -h + 3, y0: -h + 3, x1: h - 3, y1: h - 3, z: Hc, rise: 8 + 3 * n, ov: 3, ovg: 3, axis: variant & 1 ? 'y' : 'x', paint: P.shinglesP({ base: '#8a6a44' }), trim: '#3a2a1c' });
  constructionAfter(g, Object.assign({ Hc }, def), n);
  const res = g.finish();
  return { canvas: res.surf.canvas, w: res.surf.w, h: res.surf.h, ax: res.ax, ay: res.ay };
}
