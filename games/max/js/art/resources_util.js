// Shared drawing toolkit for the procedural natural-resource art (trees, mines, bushes, carcasses, decor).
// Everything here runs at sprite-generation time only (never on the per-frame hot path), so it may allocate freely.
import { rng, addOutline } from './common.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ colour ramps (HSL)
const r1 = (v) => Math.round(v * 10) / 10;
export function hsl(h, s, l, a) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100); l = clamp(l, 0, 100);
  if (a === undefined || a >= 1) return 'hsl(' + r1(h) + ',' + r1(s) + '%,' + r1(l) + '%)';
  return 'hsla(' + r1(h) + ',' + r1(s) + '%,' + r1(l) + '%,' + r1(a) + ')';
}
/**
 * A colour ramp spec: t=0 is the darkest shadow, t=1 the brightest highlight.  Shadows drift toward blue, lights toward yellow
 * (warm light / cool shadow) which is what gives the painterly look.  spec = {h0,h1,s0,s1,l0,l1}
 */
export function ramp(spec, t, a) {
  t = clamp(t, 0, 1);
  return hsl(lerp(spec.h0, spec.h1, t), lerp(spec.s0, spec.s1, t), lerp(spec.l0, spec.l1, t), a);
}
/** Copy of a ramp with hue / saturation / lightness offsets. */
export function tint(spec, dh = 0, ds = 0, dl = 0) {
  return { h0: spec.h0 + dh, h1: spec.h1 + dh, s0: spec.s0 + ds, s1: spec.s1 + ds, l0: spec.l0 + dl, l1: spec.l1 + dl };
}
export function mixSpec(a, b, t) {
  return {
    h0: lerp(a.h0, b.h0, t), h1: lerp(a.h1, b.h1, t), s0: lerp(a.s0, b.s0, t), s1: lerp(a.s1, b.s1, t), l0: lerp(a.l0, b.l0, t), l1: lerp(a.l1, b.l1, t),
  };
}

// ------------------------------------------------------------------ paths
const SX = new Float64Array(64), SY = new Float64Array(64);
/** Smooth closed lumpy blob (an ellipse with jittered radii) as the current path. */
export function blobPath(ctx, cx, cy, rx, ry, rand, n = 9, amp = 0.12, rot = 0) {
  if (n > 60) n = 60;
  const a0 = rot + rand() * TAU;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const k = 1 + (rand() * 2 - 1) * amp;
    SX[i] = cx + Math.cos(a) * rx * k;
    SY[i] = cy + Math.sin(a) * ry * k;
  }
  ctx.beginPath();
  ctx.moveTo((SX[n - 1] + SX[0]) / 2, (SY[n - 1] + SY[0]) / 2);
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    ctx.quadraticCurveTo(SX[i], SY[i], (SX[i] + SX[j]) / 2, (SY[i] + SY[j]) / 2);
  }
  ctx.closePath();
}
/** Smooth closed curve through the given [x,y] points (midpoint quadratic technique). */
export function smoothClosed(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}
/** Add a tiny rotated ellipse as its own sub-path (for batching hundreds of leaf dabs into one fill). */
export function addDab(ctx, x, y, rx, ry, rot) {
  ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}
export function polyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// ------------------------------------------------------------------ gradients
export function radial(ctx, x0, y0, r0, x1, y1, r1_, stops) {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1_);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}
export function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}

// ------------------------------------------------------------------ shading overlay (global light from upper-left)
/** Soft global light/shade pass over everything already drawn (only touches existing pixels). */
export function lightPass(ctx, x, y, w, h, lightA = 0.16, shadeA = 0.30, lightCol = '255,240,160', shadeCol = '8,24,40') {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(' + lightCol + ',' + lightA + ')');
  g.addColorStop(0.42, 'rgba(' + lightCol + ',0)');
  g.addColorStop(0.58, 'rgba(' + shadeCol + ',0)');
  g.addColorStop(1, 'rgba(' + shadeCol + ',' + shadeA + ')');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ------------------------------------------------------------------ finishing: outline + baked shadow
export const OUTLINE = 'rgba(20,18,8,0.9)';
export const OUTLINE_LEAF = { rgb: '12,28,10', lit: 0.4, dark: 0.92 };
export const OUTLINE_SOFT = 'rgba(26,38,14,0.5)';

/**
 * Soft contact/cast shadow painted BEHIND everything (call after addOutline so the outline pass does not dilate it).
 * The shadow is an ellipse with its long axis along the iso +x direction (down-right on screen, away from the NW light).
 * It is automatically shrunk to fit inside the canvas so it never shows a hard clipped edge.
 */
export function bakeShadow(S, cx, cy, rx, ry, alpha = 0.34, rot = 0.46) {
  const ctx = S.ctx;
  const c = Math.cos(rot), s = Math.sin(rot);
  // half extents of the rotated ellipse
  let ex = Math.hypot(rx * c, ry * s), ey = Math.hypot(rx * s, ry * c);
  let k = 1;
  const room = (lim, d) => (d > 0 ? lim / d : 1);
  k = Math.min(1, room(cx - 1, ex), room(S.w - 1 - cx, ex), room(cy - 1, ey), room(S.h - 1 - cy, ey));
  if (k < 1) { rx *= k; ry *= k; }
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(6,16,10,' + alpha + ')');
  g.addColorStop(0.5, 'rgba(6,16,10,' + alpha * 0.66 + ')');
  g.addColorStop(1, 'rgba(6,16,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
}
const OFFS = [[-1, -1], [0, -1], [-1, 0], [1, -1], [-1, 1], [1, 0], [0, 1], [1, 1]];
/**
 * Directional outline: like addOutline() (1 px, drawn behind the existing pixels) but the pass is weaker on the lit upper-left rim
 * (aLit) and strongest on the shaded lower-right contour (aDark), which reads painted rather than cel-shaded.
 * color = 'r,g,b' string.
 */
export function outlineDir(S, color, aLit, aDark) {
  const { canvas } = S;
  const sc = canvas.width / S.w;
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  const t = tmp.getContext('2d');
  t.drawImage(canvas, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = 'rgb(' + color + ')'; t.fillRect(0, 0, tmp.width, tmp.height);
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  for (let i = 0; i < OFFS.length; i++) {
    const dx = OFFS[i][0], dy = OFFS[i][1];
    ctx.globalAlpha = lerp(aLit, aDark, (dx + dy + 2) / 4);
    ctx.drawImage(tmp, dx * sc, dy * sc);
  }
  ctx.restore();
}
/** outline (optionally) then shadow(s). shadows = array of [cx, cy, rx, ry, alpha, rot?]. outline: rgba string (uniform) or {rgb, lit, dark} (directional) */
export function finish(S, outline, shadows) {
  if (outline && typeof outline === 'object') outlineDir(S, outline.rgb, outline.lit, outline.dark);
  else if (outline) addOutline(S, outline, 1);
  if (shadows) for (let i = 0; i < shadows.length; i++) { const s = shadows[i]; bakeShadow(S, s[0], s[1], s[2], s[3], s[4], s[5] === undefined ? 0.46 : s[5]); }
  return S;
}

// ------------------------------------------------------------------ tapered strokes (branches, roots, stems, blades)
/** Tapered polyline stroke (filled polygon), widths w0 -> w1 along the path. pts = [[x,y],...]. */
export function taper(ctx, pts, w0, w1, fill) {
  const n = pts.length;
  if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const t = n === 1 ? 0 : i / (n - 1);
    const w = lerp(w0, w1, t) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  // round tip
  const wt = Math.max(0.05, w1 / 2);
  const last = pts[n - 1];
  const dxT = pts[n - 1][0] - pts[n - 2][0], dyT = pts[n - 1][1] - pts[n - 2][1];
  const ang = Math.atan2(dyT, dxT);
  ctx.arc(last[0], last[1], wt, ang - Math.PI / 2, ang + Math.PI / 2, false);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
/** Feather / leaf shaped polygon along a quadratic bezier axis (base -> control -> tip); widest at ~40%, pointed at the tip. */
export function featherPath(ctx, bx, by, qx, qy, tx, ty, wmax, n = 8) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * bx + 2 * u * t * qx + t * t * tx, y = u * u * by + 2 * u * t * qy + t * t * ty;
    let dx = 2 * u * (qx - bx) + 2 * t * (tx - qx), dy = 2 * u * (qy - by) + 2 * t * (ty - qy);
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const w = wmax * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85);
    L.push(x - dy * w, y + dx * w); R.push(x + dy * w, y - dx * w);
  }
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  for (let i = 1; i <= n; i++) ctx.lineTo(L[i * 2], L[i * 2 + 1]);
  for (let i = n; i >= 0; i--) ctx.lineTo(R[i * 2], R[i * 2 + 1]);
  ctx.closePath();
}
/** Quadratic bezier sampler -> array of points. */
export function bez(x0, y0, cx, cy, x1, y1, n = 6) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
  }
  return out;
}

// ------------------------------------------------------------------ leaf clumps (scalloped foliage masses)
/**
 * A leaf clump is the union of a core ellipse and a ring of small discs ("scallops"), so its outline reads as leafy bunches
 * instead of a smooth balloon.  Shape data is generated once and reused for the lit layer, the shaded layer and the underlay.
 */
export function makeClump(rand, x, y, r, f, sq = 0.92) {
  const n = Math.max(8, Math.round(r * 1.2));
  const bumps = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = ((i + rand() * 0.7) / n) * TAU;
    const rr = r * (0.19 + rand() * 0.14);
    const d = r - rr * (0.72 + rand() * 0.22);
    bumps[i] = [Math.cos(a) * d, Math.sin(a) * d * sq, rr];
  }
  return { x, y, r, f, sq, bumps, core: r * (0.66 + rand() * 0.1) };
}
export function clumpPath(ctx, c, ox = 0, oy = 0, k = 1) {      // (kept for callers that need an explicit current path)
  const cx = c.x + ox, cy = c.y + oy, cr = c.core * k;
  ctx.beginPath();
  ctx.moveTo(cx + cr, cy);
  ctx.ellipse(cx, cy, cr, cr * c.sq, 0, 0, TAU);
  const b = c.bumps;
  for (let i = 0; i < b.length; i++) {
    const bx = cx + b[i][0] * k, by = cy + b[i][1] * k, br = b[i][2] * k;
    ctx.moveTo(bx + br, by);
    ctx.arc(bx, by, br, 0, TAU);
  }
}
/** The clump outline as a cached Path2D (built once per clump, then filled several times through cheap transforms). */
function clumpP2D(c) {
  if (c.p2d) return c.p2d;
  const p = new Path2D();
  const cr = c.core;
  p.moveTo(c.x + cr, c.y);
  p.ellipse(c.x, c.y, cr, cr * c.sq, 0, 0, TAU);
  const b = c.bumps;
  for (let i = 0; i < b.length; i++) {
    const bx = c.x + b[i][0], by = c.y + b[i][1], br = b[i][2];
    p.moveTo(bx + br, by);
    p.arc(bx, by, br, 0, TAU);
  }
  c.p2d = p;
  return p;
}
/** Fill the clump (current fillStyle) offset by (ox, oy) and scaled by k about its centre. */
export function fillClump(ctx, c, ox = 0, oy = 0, k = 1) {
  const p = clumpP2D(c);
  if (ox === 0 && oy === 0 && k === 1) { ctx.fill(p); return; }
  ctx.save();
  ctx.translate(c.x + ox, c.y + oy);
  ctx.scale(k, k);
  ctx.translate(-c.x, -c.y);
  ctx.fill(p);
  ctx.restore();
}
/** Paint one clump: AO halo on what is beneath, lit rim layer + shaded body with radial gradient, then fine leaf tufts. */
export function paintClump(ctx, rand, c, spec, o = {}) {
  const { x, y, r, f } = c;
  // ambient-occlusion halo cast by this clump on the foliage already painted behind/below it
  if (o.halo !== false) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(3,14,8,0.24)';
    fillClump(ctx, c, r * 0.1, r * 0.2, 1.05);
    ctx.restore();
  }
  ctx.fillStyle = ramp(spec, f + 0.26);
  fillClump(ctx, c);
  const sh = Math.max(1.0, r * 0.15);
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.26, r * 0.05, x + sh * 0.5, y + sh * 0.6, r * 1.12);
  g.addColorStop(0, ramp(spec, f + 0.14));
  g.addColorStop(0.5, ramp(spec, f - 0.03));
  g.addColorStop(1, ramp(spec, f - 0.36));
  ctx.fillStyle = g;
  fillClump(ctx, c, sh, sh * 1.2, 0.94);
  // leaf tufts (mini bumps): dark underside + light top, biased to the lit upper-left
  const nT = Math.max(4, Math.round((c.r * 1.25) * (o.density || 1)));
  const dk = [], hi = [], md = [];
  for (let i = 0; i < nT; i++) {
    const lit = rand() < 0.66;
    const a = lit ? Math.PI * (0.72 + rand() * 0.95) : rand() * TAU;
    const d = Math.sqrt(rand()) * r * 0.78;
    const tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d * c.sq;
    const tr = 1.1 + rand() * (0.6 + r * 0.07);
    const t = [tx, ty, tr, rand() * Math.PI];
    dk.push(t); (lit && d > r * 0.25 ? hi : md).push(t);
  }
  ctx.fillStyle = ramp(spec, f - 0.2, 0.5);
  ctx.beginPath();
  for (const t of dk) addDab(ctx, t[0] + 0.5, t[1] + 0.8, t[2] * 1.15, t[2] * 0.8, t[3]);
  ctx.fill();
  ctx.fillStyle = ramp(spec, f + 0.12);
  ctx.beginPath();
  for (const t of md) addDab(ctx, t[0], t[1], t[2], t[2] * 0.72, t[3]);
  ctx.fill();
  ctx.fillStyle = ramp(spec, f + 0.38);
  ctx.beginPath();
  for (const t of hi) addDab(ctx, t[0], t[1], t[2] * 0.95, t[2] * 0.65, t[3]);
  ctx.fill();
}

/** Leaf dabs on a lobe: light crescent dabs upper-left, dark dabs lower-right (kept for small decor foliage). */
export function lobeDabs(ctx, x, y, r, spec, f, rand, density = 1) {
  const nL = Math.max(2, Math.round((2 + r / 3.2) * density));
  const nD = Math.max(2, Math.round((1.5 + r / 4.5) * density));
  ctx.fillStyle = ramp(spec, f + 0.36);
  ctx.beginPath();
  for (let i = 0; i < nL; i++) {
    const a = Math.PI * (0.85 + rand() * 0.8);
    const d = r * (0.42 + rand() * 0.42);
    const s = 0.8 + r * 0.06 * (0.6 + rand());
    addDab(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, s * 1.5, s * 0.8, a + Math.PI / 2 + (rand() - 0.5) * 0.7);
  }
  ctx.fill();
  ctx.fillStyle = ramp(spec, f - 0.3);
  ctx.beginPath();
  for (let i = 0; i < nD; i++) {
    const a = Math.PI * (-0.15 + rand() * 0.8);
    const d = r * (0.45 + rand() * 0.45);
    const s = 0.8 + r * 0.05 * (0.6 + rand());
    addDab(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, s * 1.4, s * 0.75, a + Math.PI / 2 + (rand() - 0.5) * 0.7);
  }
  ctx.fill();
}
/** Simple shaded lobe (smooth gradient blob) - used by small decor. */
export function lobe(ctx, x, y, r, spec, f, rand, opt) {
  const sq = opt && opt.sq ? opt.sq : 0.94;
  const rx = r * (0.94 + rand() * 0.14), ry = r * sq * (0.92 + rand() * 0.12);
  const g = ctx.createRadialGradient(x - rx * 0.34, y - ry * 0.42, rx * 0.04, x + rx * 0.05, y + ry * 0.05, rx * 1.12);
  g.addColorStop(0, ramp(spec, f + 0.34));
  g.addColorStop(0.5, ramp(spec, f));
  g.addColorStop(1, ramp(spec, f - 0.32));
  ctx.fillStyle = g;
  blobPath(ctx, x, y, rx, ry, rand, 10, 0.15);
  ctx.fill();
  return rx;
}

// ------------------------------------------------------------------ trunks
/**
 * Trunk polygon from base (x0,y0) up `h` px, widths w0 (at the base, plus root flare) -> w1 (top), leaning by `lean` px at the top.
 * Returns samplers cxAt(t)/wAt(t). Fill is a horizontal gradient from lit-left to dark-right followed by bark texture.
 */
export function drawTrunk(ctx, rand, x0, y0, h, w0, w1, lean, spec, o = {}) {
  const flare = o.flare === undefined ? 0.8 : o.flare, wob = o.wob === undefined ? 1 : o.wob, ph = rand() * TAU;
  const N = 14;
  const cxAt = (t) => x0 + lean * t * t + Math.sin(t * 3.2 + ph) * wob * (0.3 + t * 0.7);
  const wAt = (t) => lerp(w0, w1, Math.pow(t, 0.7)) * (1 + flare * Math.pow(1 - t, 5));
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, c = cxAt(t), w = wAt(t) / 2, y = y0 - h * t;
    left.push([c - w, y]); right.push([c + w, y]);
  }
  const wMax = w0 * (1 + flare) / 2 + 2;
  const g = ctx.createLinearGradient(x0 - wMax, 0, x0 + wMax + Math.abs(lean), 0);
  g.addColorStop(0, ramp(spec, o.lit === undefined ? 0.7 : o.lit));
  g.addColorStop(0.3, ramp(spec, 0.5));
  g.addColorStop(0.68, ramp(spec, 0.27));
  g.addColorStop(1, ramp(spec, 0.1));
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i <= N; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = N; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  // bark: dark furrows and light ridges following the trunk
  ctx.save();
  ctx.clip();
  const nB = Math.round(h * (o.barkDensity || 0.42));
  ctx.lineCap = 'round';
  for (let i = 0; i < nB; i++) {
    const t0 = rand() * 0.85, t1 = Math.min(1, t0 + 0.05 + rand() * 0.15), u = (rand() - 0.5) * 0.95;
    const x1 = cxAt(t0) + u * wAt(t0), x2 = cxAt(t1) + u * wAt(t1) + (rand() - 0.5) * 1.2;
    const dark = u > -0.2;
    ctx.strokeStyle = dark ? ramp(spec, 0.04 + rand() * 0.14, 0.45 + rand() * 0.3) : ramp(spec, 0.8 + rand() * 0.18, 0.35 + rand() * 0.3);
    ctx.lineWidth = 0.7 + rand() * 0.9;
    ctx.beginPath(); ctx.moveTo(x1, y0 - h * t0); ctx.lineTo(x2, y0 - h * t1); ctx.stroke();
  }
  // shade under the crown (top of trunk)
  const sh = ctx.createLinearGradient(0, y0 - h, 0, y0 - h * 0.4);
  sh.addColorStop(0, 'rgba(6,10,4,0.6)'); sh.addColorStop(1, 'rgba(6,10,4,0)');
  ctx.fillStyle = sh; ctx.fillRect(x0 - wMax - 4, y0 - h, wMax * 2 + 8 + Math.abs(lean), h * 0.6);
  ctx.restore();
  return { cxAt, wAt, left, right };
}

export { rng };
