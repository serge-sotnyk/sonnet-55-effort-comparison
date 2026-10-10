// Shared helpers for the procedural art modules (browser only). Owned by the engine; art modules import from here
// and put any extra helpers in their own files.
import { PLAYER_COLORS, DIR_VEC } from '../data/constants.js';

export { PLAYER_COLORS, DIR_VEC };

// ---------------------------------------------------------------- supersampling
// All sprites are drawn in LOGICAL pixels (1 logical px = 1 CSS px at camera zoom 1) into a canvas whose backing store
// is SCALE times larger, so art stays crisp on Retina screens. The engine calls setSpriteScale() once at startup,
// BEFORE any sprite is generated.
let SCALE = 1;
export function setSpriteScale(s) { SCALE = s; }
export function getSpriteScale() { return SCALE; }

/** Create a drawing surface. w/h in logical px (use integers). ctx is pre-scaled so you draw in logical px. */
export function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE; canvas.height = h * SCALE;
  // CPU-backed on purpose: GPU-backed canvases can silently lose their contents (GPU process resets, memory pressure)
  // when thousands of sprites exist, which blanks the game. Software canvases are immune and fast for small sprites.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(SCALE, SCALE);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  return { canvas, ctx, w, h };
}

/** Wrap a surface as the sprite object the engine consumes. (ax, ay) = anchor (ground point) in logical px. */
export function toSprite(surface, ax, ay) {
  return { canvas: surface.canvas, w: surface.w, h: surface.h, ax, ay };
}

/** Add a dark 1px outline around all opaque pixels (draws behind existing pixels). Leave >=2px transparent margin. */
export function addOutline(surface, color = 'rgba(22,13,6,0.92)', thickness = 1) {
  const { canvas } = surface;
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  const t = tmp.getContext('2d');
  t.drawImage(canvas, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color; t.fillRect(0, 0, tmp.width, tmp.height);
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  const d = thickness * SCALE;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.drawImage(tmp, dx * d, dy * d);
  ctx.restore();
  return surface;
}

/** Multiply-darken / lighten the pixels already drawn using a clipping shape mask (utility for baked shading). */
export function withClipPath(ctx, pathFn, drawFn) { ctx.save(); ctx.beginPath(); pathFn(ctx); ctx.clip(); drawFn(ctx); ctx.restore(); }

// ---------------------------------------------------------------- random / noise
export function rng(seed) {                       // mulberry32
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash01(x, y = 0, z = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function strSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function valueNoise(x, y, seed = 0) {      // smooth 2D value noise in [0,1]
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash01(xi, yi, seed), b = hash01(xi + 1, yi, seed), c = hash01(xi, yi + 1, seed), d = hash01(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, seed = 0, oct = 4) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * valueNoise(x * f, y * f, seed + i * 17); norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}

// ---------------------------------------------------------------- colors
export function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
/** amt in [-1,1]: negative darkens toward black, positive lightens toward white. */
export function shade(hex, amt) { return amt < 0 ? mix(hex, '#000000', -amt) : mix(hex, '#ffffff', amt); }
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
export function teamColor(team) { return PLAYER_COLORS[team] || PLAYER_COLORS[0]; }

// ---------------------------------------------------------------- iso projection (matches the engine)
// world (tile) coords -> screen px relative to world origin; z is height in px (up).
export const isoX = (x, y) => (x - y) * 32;
export const isoY = (x, y, z = 0) => (x + y) * 16 - z;

/**
 * 3D rig projector for units: local axes are f (forward), l (left), z (up, in px).  `dir` is the engine direction 0..7
 * (0:SE 1:S 2:SW 3:W 4:NW 5:N 6:NE 7:E on screen).  `s` converts local units to tiles (e.g. 1/48 so 48 units = 1 tile).
 * Returns { p(f,l,z) -> [sx, sy], depth(f,l) -> number (bigger = closer to camera) }.
 */
export function makeProjector(dir, s = 1 / 48) {
  const [fx, fy] = DIR_VEC[dir];
  const lx = -fy, ly = fx;
  return {
    p(f, l, z = 0) {
      const wx = (f * fx + l * lx) * s, wy = (f * fy + l * ly) * s;
      return [(wx - wy) * 32, (wx + wy) * 16 - z];
    },
    depth(f, l) { const wx = f * fx + l * lx, wy = f * fy + l * ly; return wx + wy; },
  };
}

// ---------------------------------------------------------------- drawing helpers
export function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
export function ellipse(ctx, cx, cy, rx, ry, fill, stroke, lw = 1, rot = 0) {
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
/** Tapered limb (capsule) between two points. */
export function limb(ctx, x0, y0, x1, y1, w0, w1, fill) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}
/** Soft ground shadow ellipse (units; buildings usually bake their own). */
export function groundShadow(ctx, cx, cy, rx, ry, alpha = 0.3) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
/** Iso footprint diamond path for an n x n tile footprint centered at (cx, cy). */
export function diamondPath(ctx, cx, cy, n) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - 16 * n); ctx.lineTo(cx + 32 * n, cy); ctx.lineTo(cx, cy + 16 * n); ctx.lineTo(cx - 32 * n, cy); ctx.closePath();
}
/**
 * Vertical iso box on a w x d tile footprint (w along world +x, d along world +y) centered at ground point (cx, cy), h px tall.
 * Visible faces: left (SW), right (SE), top. colors = { left, right, top } fill styles.
 * Returns the projected corner helper P(tx, ty, z) (tile offsets from the footprint center) for adding details.
 */
export function isoBox(ctx, cx, cy, w, d, h, colors) {
  const hx = w / 2, hy = d / 2;
  const P = (tx, ty, z) => [cx + (tx - ty) * 32, cy + (tx + ty) * 16 - z];
  const gR = P(hx, -hy, 0), gF = P(hx, hy, 0), gL = P(-hx, hy, 0);
  const tB = P(-hx, -hy, h), tR = P(hx, -hy, h), tF = P(hx, hy, h), tL = P(-hx, hy, h);
  poly(ctx, [gL, gF, tF, tL], colors.left);
  poly(ctx, [gF, gR, tR, tF], colors.right);
  poly(ctx, [tB, tR, tF, tL], colors.top);
  return P;
}
