// Painter toolkit for the icon art (owned by the icons workstream).
// Everything is drawn in a 64x64 "design space" and scaled to the requested pixel size, so every glyph is resolution independent.
// A Pen wraps a 2D context and paints "objects": dark outline + gradient body + inner top-left highlight + inner bottom-right shade.
// Light always comes from the upper-left, also for rotated parts (the pen tracks its rotation).
import { makeCanvas, getSpriteScale, mix, shade, rgba, rng } from './common.js';

export const INK = '#1d1209';
export const DEG = Math.PI / 180;
export const n2 = v => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ shapes (Path2D + bbox)
const shapeCache = new Map();
const NARGS = { M: 2, L: 2, T: 2, C: 6, S: 4, Q: 4, H: 1, V: 1, A: 7 };
function bboxOf(d) {
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+/g);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i = 0, cmd = 'M', cx = 0, cy = 0;
  const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; cx = x; cy = y; };
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) { cmd = t[i++]; if (cmd === 'Z' || cmd === 'z') continue; }
    const n = NARGS[cmd];
    if (!n) throw new Error('icons_kit: unsupported path command ' + cmd + ' in ' + d);
    const a = t.slice(i, i + n).map(Number); i += n;
    if (cmd === 'H') add(a[0], cy);
    else if (cmd === 'V') add(cx, a[0]);
    else if (cmd === 'A') add(a[5], a[6]);
    else for (let k = 0; k < n; k += 2) add(a[k], a[k + 1]);
    if (cmd === 'M') cmd = 'L';
  }
  return [x0, y0, x1, y1];
}
/** Build (and cache) a shape from absolute SVG path data. Arcs need an explicit bbox. */
export function S(d, bb) {
  let s = shapeCache.get(d);
  if (!s) { s = { p: new Path2D(d), bb: bb || bboxOf(d) }; shapeCache.set(d, s); }
  return s;
}
export function circ(cx, cy, r) {
  return S(`M${n2(cx - r)} ${n2(cy)}A${n2(r)} ${n2(r)} 0 1 0 ${n2(cx + r)} ${n2(cy)}A${n2(r)} ${n2(r)} 0 1 0 ${n2(cx - r)} ${n2(cy)}Z`, [cx - r, cy - r, cx + r, cy + r]);
}
export function ell(cx, cy, rx, ry, rotDeg = 0) {
  const a = rotDeg * DEG, c = Math.cos(a), s = Math.sin(a);
  const ex = rx * c, ey = rx * s;
  const hw = Math.hypot(rx * c, ry * s), hh = Math.hypot(rx * s, ry * c);
  return S(`M${n2(cx - ex)} ${n2(cy - ey)}A${n2(rx)} ${n2(ry)} ${n2(rotDeg)} 1 0 ${n2(cx + ex)} ${n2(cy + ey)}A${n2(rx)} ${n2(ry)} ${n2(rotDeg)} 1 0 ${n2(cx - ex)} ${n2(cy - ey)}Z`, [cx - hw, cy - hh, cx + hw, cy + hh]);
}
export function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return S(`M${n2(x + r)} ${n2(y)}H${n2(x + w - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + w)} ${n2(y + r)}V${n2(y + h - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + w - r)} ${n2(y + h)}H${n2(x + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x)} ${n2(y + h - r)}V${n2(y + r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(x + r)} ${n2(y)}Z`, [x, y, x + w, y + h]);
}
export function poly(pts, close = true) {
  return S('M' + pts.map(p => n2(p[0]) + ' ' + n2(p[1])).join('L') + (close ? 'Z' : ''));
}
/** Catmull-Rom spline through points -> smooth closed (or open) blob. */
export function smooth(pts, closed = true, k = 1) {
  const n = pts.length;
  const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${n2(pts[0][0])} ${n2(pts[0][1])}`;
  const cnt = closed ? n : n - 1;
  for (let i = 0; i < cnt; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += `C${n2(p1[0] + (p2[0] - p0[0]) / 6 * k)} ${n2(p1[1] + (p2[1] - p0[1]) / 6 * k)} ${n2(p2[0] - (p3[0] - p1[0]) / 6 * k)} ${n2(p2[1] - (p3[1] - p1[1]) / 6 * k)} ${n2(p2[0])} ${n2(p2[1])}`;
  }
  if (closed) d += 'Z';
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return S(d, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
}
/** Combine several shapes into one compound path (use with { rule: 'evenodd' } to cut holes). */
export function combo(...shapes) {
  const p = new Path2D();
  let bb = null;
  for (const sh of shapes) {
    p.addPath(sh.p);
    bb = bb ? [Math.min(bb[0], sh.bb[0]), Math.min(bb[1], sh.bb[1]), Math.max(bb[2], sh.bb[2]), Math.max(bb[3], sh.bb[3])] : sh.bb.slice();
  }
  return { p, bb };
}
/** Gear outline: n teeth, outer radius ro, root radius ri. */
export function gearShape(cx, cy, ro, ri, n, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, w = Math.PI * 2 / n;
    const q = [-0.5, -0.30, 0.30, 0.5];
    pts.push([cx + Math.cos(a + q[0] * w) * ri, cy + Math.sin(a + q[0] * w) * ri]);
    pts.push([cx + Math.cos(a + q[1] * w) * ro, cy + Math.sin(a + q[1] * w) * ro]);
    pts.push([cx + Math.cos(a + q[2] * w) * ro, cy + Math.sin(a + q[2] * w) * ro]);
    pts.push([cx + Math.cos(a + q[3] * w) * ri, cy + Math.sin(a + q[3] * w) * ri]);
  }
  return poly(pts);
}
/** Regular star / sparkle path (concave 4-point). */
export function sparkShape(x, y, r, pinch = 0.18) {
  const q = r * pinch;
  return S(`M${n2(x)} ${n2(y - r)}Q${n2(x + q)} ${n2(y - q)} ${n2(x + r)} ${n2(y)}Q${n2(x + q)} ${n2(y + q)} ${n2(x)} ${n2(y + r)}Q${n2(x - q)} ${n2(y + q)} ${n2(x - r)} ${n2(y)}Q${n2(x - q)} ${n2(y - q)} ${n2(x)} ${n2(y - r)}Z`);
}

// ------------------------------------------------------------------ palettes: [light, base, dark]
export const C = {
  steel:   ['#fbfdff', '#b6c3d6', '#5b6a84'],
  steelBr: ['#ffffff', '#d4e2f5', '#7b8fb0'],
  steelDk: ['#c9d4e4', '#7d8ba3', '#384359'],
  iron:    ['#a9b0be', '#646d7e', '#2d3441'],
  gold:    ['#fff4b8', '#f3c63a', '#a56d14'],
  goldDk:  ['#f2cf62', '#c18b24', '#6a410c'],
  brass:   ['#ffe9a6', '#d9a43a', '#8a5a14'],
  copper:  ['#ffcf9a', '#d9803c', '#8a3f14'],
  wood:    ['#e3b073', '#aa713a', '#613a1a'],
  woodDk:  ['#bd8650', '#80502a', '#432512'],
  woodLt:  ['#f2cf94', '#cf9a5a', '#8b5a2c'],
  leather: ['#d9a06a', '#9a6232', '#53301a'],
  leatherR:['#d8604a', '#a02e22', '#5e1410'],
  stone:   ['#e9e5dc', '#aaa498', '#625d54'],
  stoneDk: ['#bdb8ad', '#7b766c', '#3f3b34'],
  slate:   ['#a8b2c4', '#6b778e', '#363f52'],
  red:     ['#ff8a72', '#d9382c', '#7a1410'],
  blue:    ['#8fc0ff', '#3977d6', '#173d86'],
  green:   ['#a8e87a', '#4aa83c', '#1f5a22'],
  parch:   ['#fff6dc', '#ecd9a6', '#b89658'],
  white:   ['#ffffff', '#f1ece0', '#b9b2a2'],
  purple:  ['#d3a6ff', '#8a4fd0', '#4a2184'],
  teal:    ['#9be6e0', '#2fa6a4', '#14605f'],
  orange:  ['#ffd08a', '#f08a26', '#9a4a0c'],
  skin:    ['#ffe0c0', '#efb98c', '#b87a52'],
  coal:    ['#6a6f7c', '#3a3f4b', '#161921'],
  gem:     ['#d6ffe8', '#3fd48a', '#10724a'],
  ruby:    ['#ffc1c1', '#e2323c', '#7a0e1e'],
  sapph:   ['#c8e2ff', '#3f84ec', '#14409a'],
};

// ------------------------------------------------------------------ Pen
export class Pen {
  /** ctx: already carries the design-space transform. k: device pixels per design unit. minLw: minimum outline (design units). */
  constructor(ctx, k, minLw = 0) { this.c = ctx; this.k = k; this.rot = 0; this.sc = 1; this.minLw = minLw; }
  /** minimum outline width in the current local units */
  mlw(lw) { return Math.max(lw, this.minLw / this.sc); }

  /** global light-space offset -> current local offset */
  lo(dx, dy) {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [dx * c + dy * s, -dx * s + dy * c];
  }
  grad(bb, cols, ang = 45) {
    const c = this.c, a = ang * DEG - this.rot, dx = Math.cos(a), dy = Math.sin(a);
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    const ext = (Math.abs(dx) * (bb[2] - bb[0]) + Math.abs(dy) * (bb[3] - bb[1])) / 2 || 1;
    const g = c.createLinearGradient(cx - dx * ext, cy - dy * ext, cx + dx * ext, cy + dy * ext);
    const n = cols.length;
    for (let i = 0; i < n; i++) g.addColorStop(n === 1 ? 0 : i / (n - 1), cols[i]);
    return g;
  }
  fillStyle(fill, bb, ang) { return typeof fill === 'string' ? fill : Array.isArray(fill) ? this.grad(bb, fill, ang) : fill; }

  /** Main painting primitive: ink outline, gradient body, inner highlight (top-left) and inner shade (bottom-right). */
  obj(shape, fill, o = {}) {
    const c = this.c, p = shape.p;
    const lw = o.lw === 0 ? 0 : this.mlw(o.lw === undefined ? 1.5 : o.lw);
    c.save();
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    if (lw > 0) { c.lineJoin = 'round'; c.lineWidth = lw * 2; c.strokeStyle = o.ink || INK; c.stroke(p); }
    c.fillStyle = this.fillStyle(fill, shape.bb, o.ang === undefined ? 45 : o.ang);
    c.fill(p, o.rule || 'nonzero');
    const hi = o.hi === undefined ? 0.5 : o.hi, sh = o.sh === undefined ? 0.28 : o.sh;
    if (hi > 0 || sh > 0) {
      c.save(); c.clip(p, o.rule || 'nonzero');
      const e = o.bev || 0.9;
      const [ox, oy] = this.lo(e, e);
      c.lineJoin = 'round';
      if (hi > 0) { c.save(); c.translate(ox, oy); c.lineWidth = e * 1.8; c.strokeStyle = `rgba(255,255,255,${hi})`; c.stroke(p); c.restore(); }
      if (sh > 0) { c.save(); c.translate(-ox, -oy); c.lineWidth = e * 1.8; c.strokeStyle = `rgba(0,0,0,${sh})`; c.stroke(p); c.restore(); }
      c.restore();
    }
    c.restore();
    return this;
  }
  /**
   * Like obj() but for compound shapes made of many overlapping sub-paths (unions): the inner highlight / shade rims are computed
   * from the filled silhouette (offscreen mask), so inner sub-path boundaries never show.
   */
  objU(shape, fill, o = {}) {
    const c = this.c, p = shape.p;
    const lw = o.lw === 0 ? 0 : this.mlw(o.lw === undefined ? 1.5 : o.lw);
    c.save();
    if (lw > 0) { c.lineJoin = 'round'; c.lineWidth = lw * 2; c.strokeStyle = o.ink || INK; c.stroke(p); }
    c.fillStyle = this.fillStyle(fill, shape.bb, o.ang === undefined ? 45 : o.ang);
    c.fill(p);
    c.restore();
    this.bevelMask(shape, o);
    return this;
  }
  bevelMask(shape, o = {}) {
    const hi = o.hi === undefined ? 0.5 : o.hi, sh = o.sh === undefined ? 0.3 : o.sh, e = o.bev || 1.1;
    if (hi <= 0 && sh <= 0) return this;
    const c = this.c, cv = c.canvas, m = c.getTransform();
    const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
    const x = t.getContext('2d');
    const [ox, oy] = this.lo(e, e);
    const rim = (dx, dy, color) => {
      x.globalCompositeOperation = 'source-over'; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, t.width, t.height);
      x.setTransform(m); x.fillStyle = '#000'; x.fill(shape.p);
      x.globalCompositeOperation = 'destination-out'; x.translate(dx, dy); x.fill(shape.p);
      x.globalCompositeOperation = 'source-in'; x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = color; x.fillRect(0, 0, t.width, t.height);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(t, 0, 0); c.restore();
    };
    if (hi > 0) rim(ox, oy, `rgba(255,255,255,${hi})`);
    if (sh > 0) rim(-ox, -oy, `rgba(0,0,0,${sh})`);
    return this;
  }
  /** plain fill, no outline */
  flat(shape, fill, alpha, ang) {
    const c = this.c;
    if (alpha !== undefined) { c.save(); c.globalAlpha = alpha; }
    c.fillStyle = this.fillStyle(fill, shape.bb, ang === undefined ? 45 : ang);
    c.fill(shape.p);
    if (alpha !== undefined) c.restore();
    return this;
  }
  /** stroke a shape (open or closed) with optional ink outline */
  stroke(shape, color, w, o = {}) {
    const c = this.c;
    c.save();
    c.lineCap = o.cap || 'round'; c.lineJoin = 'round';
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    if (o.dash) c.setLineDash(o.dash);
    const lw = o.lw === undefined || o.lw === 0 ? 0 : this.mlw(o.lw);
    if (lw > 0) { c.lineWidth = w + lw * 2; c.strokeStyle = o.ink || INK; c.stroke(shape.p); }
    c.lineWidth = w;
    c.strokeStyle = typeof color === 'string' ? color : Array.isArray(color) ? this.grad(shape.bb, color, o.ang === undefined ? 45 : o.ang) : color;
    c.stroke(shape.p);
    c.restore();
    return this;
  }
  line(x0, y0, x1, y1, color, w, o = {}) { return this.stroke(poly([[x0, y0], [x1, y1]], false), color, w, o); }
  /** capsule/handle shaded across its width (cylinder look) */
  tube(x0, y0, x1, y1, w, pal, o = {}) {
    const c = this.c;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, tx = dx / len, ty = dy / len;
    const [lx, ly] = this.lo(0.7071, 0.7071);
    let nx = lx - (lx * tx + ly * ty) * tx, ny = ly - (lx * tx + ly * ty) * ty;
    const nl = Math.hypot(nx, ny);
    if (nl < 1e-3) { nx = -ty; ny = tx; } else { nx /= nl; ny /= nl; }
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, h = w / 2;
    const lw = o.lw === 0 ? 0 : this.mlw(o.lw === undefined ? 1.4 : o.lw);
    c.save();
    c.lineCap = o.cap || 'round'; c.lineJoin = 'round';
    if (lw > 0) { c.lineWidth = w + lw * 2; c.strokeStyle = o.ink || INK; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
    const g = c.createLinearGradient(mx - nx * h, my - ny * h, mx + nx * h, my + ny * h);
    g.addColorStop(0, pal[0]); g.addColorStop(0.4, pal[1]); g.addColorStop(1, pal[2]);
    c.lineWidth = w; c.strokeStyle = g; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    if (o.shine !== 0 && w >= 2.2) {
      c.lineWidth = Math.max(0.6, w * 0.2); c.strokeStyle = 'rgba(255,255,255,0.38)'; c.lineCap = 'round';
      const sx = -nx * h * 0.45, sy = -ny * h * 0.45, sh = w * 0.35;
      c.beginPath(); c.moveTo(x0 + sx + tx * sh, y0 + sy + ty * sh); c.lineTo(x1 + sx - tx * sh, y1 + sy - ty * sh); c.stroke();
    }
    c.restore();
    return this;
  }
  /** sphere / round gem */
  orb(cx, cy, r, pal, o = {}) {
    const c = this.c;
    const lw = o.lw === 0 ? 0 : this.mlw(o.lw === undefined ? 1.3 : o.lw);
    const [ox, oy] = this.lo(-0.32 * r, -0.36 * r);
    c.save();
    if (lw > 0) { c.beginPath(); c.arc(cx, cy, r, 0, 7); c.lineWidth = lw * 2; c.strokeStyle = o.ink || INK; c.stroke(); }
    const g = c.createRadialGradient(cx + ox, cy + oy, 0, cx + ox * 0.4, cy + oy * 0.4, r * 1.35);
    g.addColorStop(0, pal[0]); g.addColorStop(0.5, pal[1]); g.addColorStop(1, pal[2]);
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    if (o.spec !== 0 && r >= 1.6) {
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(cx + ox * 0.95, cy + oy * 0.95, r * 0.24, r * 0.17, Math.atan2(oy, ox) + Math.PI / 2 * 0, 0, 7); c.fill();
    }
    c.restore();
    return this;
  }
  /** draw fn with a rotation of `deg` degrees about (cx, cy) (lighting stays global) */
  rotated(cx, cy, deg, fn) {
    const c = this.c, a = deg * DEG;
    c.save(); c.translate(cx, cy); c.rotate(a); c.translate(-cx, -cy);
    this.rot += a; fn(this); this.rot -= a;
    c.restore();
    return this;
  }
  /** draw fn in a local frame: canonical (32,32) maps to (cx,cy), scaled by sc and rotated by deg */
  placed(cx, cy, sc, deg, fn) {
    const c = this.c, a = deg * DEG;
    c.save(); c.translate(cx, cy); c.rotate(a); c.scale(sc, sc); c.translate(-32, -32);
    this.rot += a; this.sc *= sc; fn(this); this.rot -= a; this.sc /= sc;
    c.restore();
    return this;
  }
  /** translate then uniform scale */
  at(x, y, sc, fn) {
    const c = this.c;
    c.save(); c.translate(x, y); c.scale(sc, sc); this.sc *= sc; fn(this); this.sc /= sc; c.restore();
    return this;
  }
  /** uniform scale about the origin */
  scaled(sc, fn) {
    const c = this.c;
    c.save(); c.scale(sc, sc); this.sc *= sc; fn(this); this.sc /= sc; c.restore();
    return this;
  }
  /** mirror horizontally about x = cx */
  mirrored(cx, fn) {
    const c = this.c;
    c.save(); c.translate(cx * 2, 0); c.scale(-1, 1);
    // light flips with the mirror: emulate by flipping rot sign semantics (callers should avoid mirrored shaded objects when it matters)
    fn(this); c.restore();
    return this;
  }
  clip(shape, fn) { const c = this.c; c.save(); c.clip(shape.p); fn(this); c.restore(); return this; }
  /** soft glow */
  glow(x, y, r, color, a = 0.6, comp) {
    const c = this.c;
    c.save();
    if (comp) c.globalCompositeOperation = comp;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
    return this;
  }
  spark(x, y, r, color = '#ffffff', glowCol) {
    if (glowCol) this.glow(x, y, r * 1.5, glowCol, 0.55);
    this.flat(sparkShape(x, y, r), color);
    return this;
  }
  /** elliptical ground shadow */
  shadow(cx, cy, rx, ry, a = 0.35) {
    const c = this.c;
    c.save(); c.translate(cx, cy); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(10,5,0,${a})`); g.addColorStop(1, 'rgba(10,5,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill();
    c.restore();
    return this;
  }
}

// ------------------------------------------------------------------ icon rendering pipeline
/**
 * Create a size x size icon surface, run `paint(pen)` with a 64-unit design space and composite it with a soft drop shadow.
 * opts: { bg: (ctx,size) => void  background drawn first (in logical px), over: (ctx,size) => void  drawn after glyph, shadow: 0..1 }
 */
export function renderIcon(size, paint, opts = {}) {
  const S = getSpriteScale();
  const surf = makeCanvas(size, size);
  const ctx = surf.ctx;
  if (opts.bg) { ctx.save(); opts.bg(ctx, size); ctx.restore(); }
  const layer = makeCanvas(size, size);
  const lc = layer.ctx, u = size / 64;
  lc.save(); lc.scale(u, u);
  if (opts.gscale && opts.gscale !== 1) { const gs = opts.gscale; lc.translate(32 * (1 - gs), 32 * (1 - gs) + (opts.gdy || 0)); lc.scale(gs, gs); }
  // minimum outline: ~1 logical px
  const pen = new Pen(lc, u * S, Math.max(0, 1 / u) / (opts.gscale || 1));
  paint(pen);
  lc.restore();
  ctx.save();
  const sh = opts.shadow === undefined ? 1 : opts.shadow;
  if (sh > 0) {
    ctx.shadowColor = `rgba(12,6,0,${0.5 * sh})`;
    ctx.shadowBlur = Math.max(1, size / 48 * 2.4) * S;
    ctx.shadowOffsetX = size / 48 * 0.8 * S; ctx.shadowOffsetY = size / 48 * 1.6 * S;
  }
  ctx.drawImage(layer.canvas, 0, 0, size, size);
  ctx.restore();
  if (opts.over) { ctx.save(); opts.over(ctx, size); ctx.restore(); }
  return surf;
}

// ------------------------------------------------------------------ rounded-square frame (opaque icons)
export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * Background palettes by category: c = [top-left light, mid, bottom-right dark], glow = colour of the radial light behind the glyph.
 */
export const BG = {
  farm:    { c: ['#b7e56c', '#53a33d', '#1d5a2b'], glow: '#f1ffa8' },
  wood:    { c: ['#e0aa60', '#9c6532', '#4a2812'], glow: '#ffe3a3' },
  eco:     { c: ['#f8cf62', '#c98428', '#6a3a12'], glow: '#fff1b4' },
  mine:    { c: ['#aab2c4', '#626d82', '#2a3144'], glow: '#ffe9b8' },
  mil:     { c: ['#8db4ee', '#3d64ae', '#1a2d66'], glow: '#d0e6ff' },
  cav:     { c: ['#7aa4e4', '#315aa8', '#16295f'], glow: '#c4d8ff' },
  def:     { c: ['#a6bcc2', '#5f7c8a', '#2a4152'], glow: '#eaf6f4' },
  holy:    { c: ['#c394f0', '#6d44b4', '#321a68'], glow: '#fff3c0' },
  vision:  { c: ['#74b8d6', '#2b6f9c', '#12304f'], glow: '#d4f6ff' },
  trade:   { c: ['#f4c862', '#b9792a', '#5d3612'], glow: '#fff4c0' },
  neutral: { c: ['#c4b695', '#80735a', '#3c3322'], glow: '#fff3d4' },
  fire:    { c: ['#ffb060', '#d4502a', '#68180e'], glow: '#ffe6a0' },
  night:   { c: ['#5a63a8', '#2c3472', '#10143a'], glow: '#b8c4ff' },
  dark:    { c: ['#8a7a68', '#4d4034', '#1e1710'], glow: '#ffd89a' },
  ice:     { c: ['#a8dcee', '#4a90b8', '#1a3e66'], glow: '#e8faff' },
};

export function tintBG(pal, tint, t) {
  return { c: pal.c.map((c, i) => mix(c, i === 1 ? tint : i === 0 ? shade(tint, 0.35) : shade(tint, -0.45), t)), glow: mix(pal.glow, shade(tint, 0.5), t * 0.8) };
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** background painting for opaque icons. */
export function paintBG(ctx, size, pal, seedStr, o = {}) {
  const r = size * 0.14;
  roundRectPath(ctx, 0, 0, size, size, r); ctx.clip();
  // base diagonal gradient
  let g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, pal.c[0]); g.addColorStop(0.5, pal.c[1]); g.addColorStop(1, pal.c[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // light from behind the glyph
  g = ctx.createRadialGradient(size * 0.45, size * 0.42, 0, size * 0.5, size * 0.5, size * 0.72);
  g.addColorStop(0, rgba(pal.glow, o.glowA === undefined ? 0.62 : o.glowA)); g.addColorStop(0.55, rgba(pal.glow, 0.14)); g.addColorStop(1, rgba(pal.glow, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // radiating light rays
  if (o.rays) {
    ctx.save(); ctx.translate(size * 0.5, size * 0.46);
    const n = o.rays, a0 = o.rayRot || 0;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2, w = Math.PI / n * 0.55;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, size, a - w / 2, a + w / 2); ctx.closePath();
      ctx.fillStyle = rgba(o.rayColor || pal.glow, o.rayA === undefined ? 0.13 : o.rayA); ctx.fill();
    }
    ctx.restore();
  }
  // painterly strokes
  const R = rng(hashStr(seedStr));
  const n = Math.round(size * 1.3);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = R() * size, y = R() * size, len = size * (0.05 + R() * 0.13), a = -0.6 + R() * 0.5;
    ctx.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = Math.max(1, size * (0.02 + R() * 0.035));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  // ground haze at the bottom
  g = ctx.createLinearGradient(0, size * 0.55, 0, size);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // edge vignette
  g = ctx.createRadialGradient(size / 2, size / 2, size * 0.34, size / 2, size / 2, size * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
}

/** gloss, inner gold border and outer ink edge */
export function paintFrameOver(ctx, size, o = {}) {
  const r = size * 0.14, u = size / 48;
  // top-left gloss
  ctx.save();
  roundRectPath(ctx, 0, 0, size, size, r); ctx.clip();
  let g = ctx.createRadialGradient(size * 0.12, size * 0.04, 0, size * 0.18, size * 0.14, size * 0.78);
  g.addColorStop(0, 'rgba(255,255,255,0.40)'); g.addColorStop(0.45, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // top sheen
  g = ctx.createLinearGradient(0, 0, 0, size * 0.30);
  g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size * 0.30);
  ctx.restore();
  // inner border
  const ins = Math.max(1.4, 2.0 * u), bw = Math.max(1, 1.5 * u);
  ctx.save();
  roundRectPath(ctx, ins, ins, size - ins * 2, size - ins * 2, Math.max(1, r - ins * 0.8));
  g = ctx.createLinearGradient(0, 0, size, size);
  const b = o.border || ['#fff0a8', '#d6a63c', '#7c5018'];
  g.addColorStop(0, b[0]); g.addColorStop(0.5, b[1]); g.addColorStop(1, b[2]);
  ctx.lineWidth = bw; ctx.strokeStyle = g; ctx.globalAlpha = 0.9; ctx.stroke();
  // soft dark line just inside the gold, for depth
  ctx.globalAlpha = 0.28; ctx.strokeStyle = '#000';
  roundRectPath(ctx, ins + bw, ins + bw, size - (ins + bw) * 2, size - (ins + bw) * 2, Math.max(1, r - ins * 0.8 - bw));
  ctx.lineWidth = Math.max(0.6, bw * 0.6); ctx.stroke();
  ctx.restore();
  // outer ink edge
  ctx.save();
  const e = Math.max(0.6, 0.55 * u);
  roundRectPath(ctx, e, e, size - e * 2, size - e * 2, r - e * 0.6);
  ctx.lineWidth = e * 2; ctx.strokeStyle = 'rgba(24,13,5,0.92)'; ctx.stroke();
  ctx.restore();
}

/** Standard opaque icon: background pal + painter + frame. */
export function frameIcon(size, bgPal, seed, paint, o = {}) {
  return renderIcon(size, paint, {
    bg: (ctx, s) => paintBG(ctx, s, bgPal, seed, o),
    over: (ctx, s) => paintFrameOver(ctx, s, o),
    shadow: o.shadow,
    gscale: o.gscale === undefined ? 0.9 : o.gscale,
    gdy: o.gdy === undefined ? 0.5 : o.gdy,
  });
}
