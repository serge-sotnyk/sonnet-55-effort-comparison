// Core of the procedural unit renderer: a tiny retained-mode 3D "scene" per frame.
// Rig space: (f, r, z) = forward, RIGHT-hand side, up.  1 unit ~ 1 px of height.  Parts are built in rig space, projected with the
// engine projector (makeProjector(dir, 1/40)), depth sorted (painter) and drawn with soft light-from-upper-left shading, then outlined.
import { makeCanvas, addOutline, makeProjector, hexToRgb, rgbToHex, DIR_VEC } from './common.js';

export const TAU = Math.PI * 2;
const HP = Math.PI / 2;
export const KS = 1.14;                      // sphere radius (rig units) -> screen px
const PROJ_S = 1 / 40;
const LX = -0.6, LY = -0.8;                  // screen vector pointing TOWARD the light (upper-left)

// ------------------------------------------------------------------ small math
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const V = (f, r, z) => [f, r, z];
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const vmad = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlen = a => Math.hypot(a[0], a[1], a[2]);
export const vnorm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** rotate about the up axis; positive = turn to the right (f -> r) */
export function vyaw(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }
/** pitch in the (f,z) plane; positive = tilt forward/down (z -> f) */
export function vpitch(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], v[2] * c - v[0] * s]; }
/** roll in the (r,z) plane; positive = lean to the right (z -> r) */
export function vroll(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c + v[2] * s, v[2] * c - v[1] * s]; }
/** build an orthonormal basis (a1, a2) perpendicular to n, a1 as close to `up` as possible */
export function basisOf(n, up = [0, 0, 1]) {
  let a1 = vsub(up, vmul(n, vdot(up, n)));
  if (vlen(a1) < 1e-4) a1 = vsub([1, 0, 0], vmul(n, n[0]));
  a1 = vnorm(a1);
  return [a1, vnorm(vcross(n, a1))];
}
/** two-bone IK. returns the joint position (elbow/knee) for chain S -> T with bone lengths l1,l2; pole = direction hint */
export function ik2(S, T, l1, l2, pole) {
  let d = vsub(T, S), dist = vlen(d);
  const maxd = (l1 + l2) * 0.999, mind = Math.abs(l1 - l2) * 1.001 + 0.01;
  if (dist > maxd) { d = vmul(d, maxd / dist); dist = maxd; } else if (dist < mind) { dist = mind; }
  const dn = vnorm(d);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let p = vsub(pole, vmul(dn, vdot(pole, dn)));
  if (vlen(p) < 1e-4) p = vsub([0, 1, 0], vmul(dn, dn[1]));
  p = vnorm(p);
  return [S[0] + dn[0] * a + p[0] * h, S[1] + dn[1] * a + p[1] * h, S[2] + dn[2] * a + p[2] * h];
}
/** transform describing a pitch rotation (about the r axis) by `a` radians around pivot, then translation t */
export function xfPitch(a, pivot, t) {
  const c = Math.cos(a), s = Math.sin(a);
  return makeXf([c, 0, s, 0, 1, 0, -s, 0, c], pivot, t);   // forward-down for a>0
}
export function xfRoll(a, pivot, t) {
  const c = Math.cos(a), s = Math.sin(a);
  return makeXf([1, 0, 0, 0, c, s, 0, -s, c], pivot, t);   // lean right for a>0
}
export function xfYaw(a, pivot, t) {
  const c = Math.cos(a), s = Math.sin(a);
  return makeXf([c, -s, 0, s, c, 0, 0, 0, 1], pivot, t);
}
export function makeXf(m, pivot = [0, 0, 0], t = [0, 0, 0]) {
  // p' = M (p - pivot) + pivot + t
  const px = pivot[0], py = pivot[1], pz = pivot[2];
  return {
    m,
    t: [px + t[0] - (m[0] * px + m[1] * py + m[2] * pz), py + t[1] - (m[3] * px + m[4] * py + m[5] * pz), pz + t[2] - (m[6] * px + m[7] * py + m[8] * pz)],
  };
}

// ------------------------------------------------------------------ colors / ramps
const RAMPS = new Map();
/** 9-level ramp (0 darkest .. 8 lightest, 5 = base) built from a base hex color; cached. */
export function ramp(hex) {
  let r = RAMPS.get(hex);
  if (r) return r;
  const [R, G, B] = hexToRgb(hex);
  const dk = k => rgbToHex(R * k * 0.95, G * k * 0.97, B * k * 1.07);
  const lt = t => rgbToHex(R + (255 - R) * t * 0.98, G + (246 - G) * t, B + (218 - B) * t * 1.02);
  r = [dk(0.26), dk(0.38), dk(0.52), dk(0.68), dk(0.84), hex, lt(0.14), lt(0.28), lt(0.44)];
  RAMPS.set(hex, r);
  return r;
}
export function rampOf(c) { return typeof c === 'string' ? ramp(c) : c; }
const MIXC = new Map();
export function mixHex(a, b, t) {
  const key = a + b + (t * 100 | 0);
  let r = MIXC.get(key);
  if (!r) {
    const A = hexToRgb(a), B = hexToRgb(b);
    r = rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
    MIXC.set(key, r);
  }
  return r;
}
export const shadeHex = (hex, amt) => (amt < 0 ? mixHex(hex, '#000000', -amt) : mixHex(hex, '#ffffff', amt));

export const RO = { edge: false, grad: true, outline: 'halo1', gradMin: 0, edgeMin: 0 };
const EDGE = 'rgba(20,11,5,0.34)';
const HALO = 'rgba(22,13,6,0.92)';
const LV_DEF = [7, 5, 2];

// ------------------------------------------------------------------ hull
function cross2(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
export function hull2(pts) {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lo = [];
  for (let i = 0; i < n; i++) { while (lo.length >= 2 && cross2(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
  const up = [];
  for (let i = n - 1; i >= 0; i--) { while (up.length >= 2 && cross2(up[up.length - 2], up[up.length - 1], p[i]) <= 0) up.pop(); up.push(p[i]); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

// ------------------------------------------------------------------ surfaces of revolution
const COS = [], SIN = [];
for (let n = 6; n <= 24; n++) { COS[n] = []; SIN[n] = []; for (let i = 0; i < n; i++) { COS[n][i] = Math.cos(i / n * TAU); SIN[n][i] = Math.sin(i / n * TAU); } }

export class Rev {
  /** o origin, ax axis, u1/u2 perpendicular unit vectors, rings = [[h, ra, rb, off1?, off2?], ...] ascending h (ra along u1, rb along u2; off = centre offset along u1/u2) */
  constructor(o, ax, u1, u2, rings) { this.o = o; this.ax = ax; this.u1 = u1; this.u2 = u2; this.rings = rings; }
  rad(h) {
    const R = this.rings, n = R.length;
    if (h <= R[0][0]) return [R[0][1], R[0][2], R[0][3] || 0, R[0][4] || 0];
    for (let i = 1; i < n; i++) {
      if (h <= R[i][0]) {
        const A = R[i - 1], B = R[i], t = (h - A[0]) / ((B[0] - A[0]) || 1);
        return [A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, (A[3] || 0) + ((B[3] || 0) - (A[3] || 0)) * t, (A[4] || 0) + ((B[4] || 0) - (A[4] || 0)) * t];
      }
    }
    const E = R[n - 1];
    return [E[1], E[2], E[3] || 0, E[4] || 0];
  }
  /** surface point at height h, angle th (0 = +u1), scaled outward by k */
  pt(h, th, k = 1) {
    const q = this.rad(h), c = Math.cos(th) * q[0] * k + q[2], s = Math.sin(th) * q[1] * k + q[3], o = this.o, x = this.ax, p = this.u1, u = this.u2;
    return [o[0] + x[0] * h + p[0] * c + u[0] * s, o[1] + x[1] * h + p[1] * c + u[1] * s, o[2] + x[2] * h + p[2] * c + u[2] * s];
  }
  center(h) { const q = this.rad(h), o = this.o, x = this.ax, p = this.u1, u = this.u2; return [o[0] + x[0] * h + p[0] * q[2] + u[0] * q[3], o[1] + x[1] * h + p[1] * q[2] + u[1] * q[3], o[2] + x[2] * h + p[2] * q[2] + u[2] * q[3]]; }
}

// part kinds
const CAP = 0, BALL = 1, POLY = 2, LINE = 3, FN = 4, SEGS = 5;

export class Scene {
  constructor() { this.parts = []; this.begin(0); }

  begin(dir) {
    this.dir = dir;
    const pr = makeProjector(dir, PROJ_S);
    const a = pr.p(1, 0, 0), b = pr.p(0, 1, 0);
    this.cfx = a[0]; this.cfy = a[1]; this.crx = b[0]; this.cry = b[1];
    const fv = DIR_VEC[dir], fx = fv[0], fy = fv[1], lx = -fy, ly = fx;
    this.cam = [0.615 * (fx + fy), 0.615 * (lx + ly), 0.492];
    const Lx = -0.55, Ly = 0.15, Lz = 0.85, Ln = 1.0235;
    this.lit = [(Lx * fx + Ly * fy) / Ln, (Lx * lx + Ly * ly) / Ln, Lz / Ln];
    this.parts.length = 0;
    this.x0 = 1e9; this.y0 = 1e9; this.x1 = -1e9; this.y1 = -1e9;
    this.xf = null; this.seq = 0; this.bias = 0; this.headScr = null;
    return this;
  }

  // ---- transform + projection
  tv(v) { const x = this.xf; if (!x) return v; const m = x.m, t = x.t; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + t[0], m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + t[1], m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + t[2]]; }
  tn(n) { const x = this.xf; if (!x) return n; const m = x.m; return [m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[3] * n[0] + m[4] * n[1] + m[5] * n[2], m[6] * n[0] + m[7] * n[1] + m[8] * n[2]]; }
  sx(v) { return v[0] * this.cfx + v[1] * this.crx; }
  sy(v) { return v[0] * this.cfy + v[1] * this.cry - v[2]; }
  dp(v) { const c = this.cam; return v[0] * c[0] + v[1] * c[1] + v[2] * c[2]; }
  /** project a rig point (after the active transform) -> [x, y] */
  P(v) { v = this.tv(v); return [this.sx(v), this.sy(v)]; }
  /** facing-the-camera amount of a rig-space normal (after the active transform); > 0 = visible */
  vis(n) { return vdot(this.tn(n), this.cam); }
  ext(x, y, p) { if (x - p < this.x0) this.x0 = x - p; if (x + p > this.x1) this.x1 = x + p; if (y - p < this.y0) this.y0 = y - p; if (y + p > this.y1) this.y1 = y + p; }
  push(p) { p.o = this.seq++; this.parts.push(p); return p; }
  /** flat-shading level 0..8 for a rig-space normal */
  level(n) { n = this.tn(n); const b = vdot(n, this.lit); return clamp(4.7 + 3.9 * b, 0, 8); }

  // ---- primitives
  /** tapered capsule between 3D points a,b with radii r0,r1 (rig units) */
  cap(a, b, r0, r1, col, o) {
    a = this.tv(a); b = this.tv(b);
    const x0 = this.sx(a), y0 = this.sy(a), x1 = this.sx(b), y1 = this.sy(b), w0 = r0 * KS, w1 = r1 * KS;
    this.ext(x0, y0, w0); this.ext(x1, y1, w1);
    return this.push({ k: CAP, d: (this.dp(a) + this.dp(b)) * 0.5 + this.bias + (o && o.b || 0), x0, y0, x1, y1, r0: w0, r1: w1, rp: rampOf(col), lv: (o && o.lv) || LV_DEF, edge: !(o && o.noEdge), alpha: o && o.alpha });
  }
  /** shaded sphere */
  ball(c, r, col, o) {
    c = this.tv(c);
    const x = this.sx(c), y = this.sy(c), rr = r * KS;
    this.ext(x, y, rr);
    return this.push({ k: BALL, d: this.dp(c) + this.bias + (o && o.b || 0), x, y, rx: rr, ry: rr, rot: 0, rp: rampOf(col), lv: (o && o.lv) || LV_DEF, edge: !(o && o.noEdge), alpha: o && o.alpha });
  }
  /** ellipsoid with semi-axis VECTORS e1,e2,e3 (rig space) */
  ell(c, e1, e2, e3, col, o) {
    c = this.tv(c);
    const x = this.sx(c), y = this.sy(c);
    let A = 0, B = 0, C = 0;
    for (const e of [e1, e2, e3]) {
      const t = this.xf ? this.tn(e) : e;
      const ex = t[0] * this.cfx + t[1] * this.crx, ey = t[0] * this.cfy + t[1] * this.cry - t[2];
      A += ex * ex; B += ex * ey; C += ey * ey;
    }
    const m = (A + C) / 2, dd = Math.sqrt(((A - C) / 2) ** 2 + B * B);
    const rx = Math.sqrt(Math.max(0.01, m + dd)), ry = Math.sqrt(Math.max(0.01, m - dd)), rot = 0.5 * Math.atan2(2 * B, A - C);
    this.ext(x, y, Math.max(rx, ry));
    return this.push({ k: BALL, d: this.dp(c) + this.bias + (o && o.b || 0), x, y, rx, ry, rot, rp: rampOf(col), lv: (o && o.lv) || LV_DEF, edge: !(o && o.noEdge), alpha: o && o.alpha });
  }
  /** axis-aligned (rig frame) ellipsoid */
  ellA(c, a, b, cz, col, o) { return this.ell(c, [a, 0, 0], [0, b, 0], [0, 0, cz], col, o); }

  /** polygon from screen points (already projected) */
  polyS(pts, d, col, o) {
    for (let i = 0; i < pts.length; i++) this.ext(pts[i][0], pts[i][1], 0.6);
    return this.push({ k: POLY, d: d + this.bias + (o && o.b || 0), pts, rp: rampOf(col), lv: (o && o.lv) || LV_DEF, edge: !(o && o.noEdge), solid: o && o.solid || null, alpha: o && o.alpha });
  }
  /** flat 3D polygon; shaded by its normal (computed if omitted); two-sided by default */
  poly(pts3, col, n, o) {
    const q = pts3.map(v => this.tv(v));
    if (!n) n = vnorm(vcross(vsub(pts3[1], pts3[0]), vsub(pts3[2], pts3[0])));
    const nt = this.tn(n);
    const facing = vdot(nt, this.cam);
    let level;
    let nn = nt;
    if (facing < 0) { nn = [-nt[0], -nt[1], -nt[2]]; }
    level = clamp(4.7 + 3.9 * vdot(nn, this.lit), 0, 8);
    let dx = 0, dy = 0, dz = 0;
    const sp = q.map(v => { dx += v[0]; dy += v[1]; dz += v[2]; return [this.sx(v), this.sy(v)]; });
    const m = q.length;
    const lv = (o && o.lv) ? o.lv : [clamp(level + 1.4, 0, 8), clamp(level, 0, 8), clamp(level - 1.3, 0, 8)];
    for (let i = 0; i < sp.length; i++) this.ext(sp[i][0], sp[i][1], 0.6);
    return this.push({ k: POLY, d: this.dp([dx / m, dy / m, dz / m]) + this.bias + (o && o.b || 0), pts: sp, rp: rampOf(col), lv, edge: !(o && o.noEdge), solid: o && o.solid || null, alpha: o && o.alpha, facing });
  }
  /** convex hull of 3D points as one shaded part */
  hull(pts3, col, o) {
    const sp = [];
    let dd = 0;
    for (let i = 0; i < pts3.length; i++) { const v = this.tv(pts3[i]); sp.push([this.sx(v), this.sy(v)]); dd += this.dp(v); }
    dd /= pts3.length;
    const h = hull2(sp);
    for (let i = 0; i < h.length; i++) this.ext(h[i][0], h[i][1], 0.6);
    return this.push({ k: POLY, d: ((o && o.d !== undefined) ? o.d : dd) + this.bias + (o && o.b || 0), pts: h, rp: rampOf(col), lv: (o && o.lv) || LV_DEF, edge: !(o && o.noEdge) });
  }
  /** surface of revolution -> Rev handle (hull silhouette part is pushed; `rev.part`) */
  revolve(o, ax, u1, u2, rings, col, opt) {
    const rev = new Rev(o, ax, u1, u2, rings);
    const N = (opt && opt.n) || 12, cs = COS[N], sn = SIN[N], k = (opt && opt.k) || 1;
    const pts = [];
    let hs = 0;
    for (let i = 0; i < rings.length; i++) {
      const R = rings[i], h = R[0], ra = R[1] * k, rb = R[2] * k, o1 = R[3] || 0, o2 = R[4] || 0;
      hs += h;
      const cx = o[0] + ax[0] * h, cy = o[1] + ax[1] * h, cz = o[2] + ax[2] * h;
      for (let j = 0; j < N; j++) {
        const a = ra * cs[j] + o1, b = rb * sn[j] + o2;
        pts.push([cx + u1[0] * a + u2[0] * b, cy + u1[1] * a + u2[1] * b, cz + u1[2] * a + u2[2] * b]);
      }
    }
    const cen = rev.center(hs / rings.length);
    rev.part = this.hull(pts, col, { ...(opt || {}), d: (opt && opt.d !== undefined) ? opt.d : this.dp(this.tv(cen)) });
    return rev;
  }
  /** stroked polyline along a ring of a Rev (only the camera-facing arcs) - belts, trims, hat bands */
  band(rev, h, w, col, opt) {
    const N = 28, k = (opt && opt.k) || 1.02, c0 = (opt && opt.t0) || 0, c1 = (opt && opt.t1) !== undefined ? opt.t1 : TAU;
    const base = (opt && opt.like) ? opt.like.d : this.dp(this.tv(rev.center(h)));
    const [a, b] = rev.rad(h);
    let run = null;
    const flush = () => {
      if (run && run.length > 1) {
        this.push({ k: LINE, d: base + 0.002 + this.bias + (opt && opt.b || 0), pts: run, w, col, alpha: (opt && opt.alpha) || 1 });
        for (const p of run) this.ext(p[0], p[1], w);
      }
      run = null;
    };
    for (let i = 0; i <= N; i++) {
      const th = c0 + (c1 - c0) * i / N;
      const n = vadd(vmul(rev.u1, Math.cos(th) / a), vmul(rev.u2, Math.sin(th) / b));
      if (this.vis(n) > 0.0) {
        const v = this.tv(rev.pt(h, th, k));
        (run || (run = [])).push([this.sx(v), this.sy(v)]);
      } else flush();
    }
    flush();
  }
  /** polygon decal on the surface of a Rev between heights h0..h1 and angles t0..t1 (visible part only) */
  patch(rev, h0, h1, t0, t1, col, opt) {
    const N = Math.max(4, Math.round(Math.abs(t1 - t0) / TAU * 28)), k = (opt && opt.k) || 1.02;
    const base = (opt && opt.like) ? opt.like.d : this.dp(this.tv(rev.center((h0 + h1) / 2)));
    const [a0, b0] = rev.rad((h0 + h1) / 2);
    let lo = [], hi = [];
    const flush = () => {
      if (lo.length > 1) {
        const pts = lo.concat(hi.reverse());
        const p = this.polyS(pts, base + 0.002 + (opt && opt.b || 0), col, { ...(opt || {}), noEdge: !(opt && opt.edge) });
        if (opt && opt.lvAuto) p.lv = opt.lvAuto;
      }
      lo = []; hi = [];
    };
    for (let i = 0; i <= N; i++) {
      const th = t0 + (t1 - t0) * i / N;
      const n = vadd(vmul(rev.u1, Math.cos(th) / a0), vmul(rev.u2, Math.sin(th) / b0));
      if (this.vis(n) > -0.02) {
        const A = this.tv(rev.pt(h0, th, k)), B = this.tv(rev.pt(h1, th, k));
        lo.push([this.sx(A), this.sy(A)]); hi.push([this.sx(B), this.sy(B)]);
      } else flush();
    }
    flush();
  }
  /** thick-edged disc (shield, wheel, plate). c centre, n normal, up reference, R radius, th thickness. */
  disc(c, n, up, R, th, face, rim, back, o) {
    const [a1, a2] = basisOf(n, up);
    const N = (o && o.n) || 16, cs = COS[N], sn = SIN[N];
    const ra = (o && o.ra) || R, rb = (o && o.rb) || R;                  // optional elliptical stretch along a1 / a2
    const nt = this.tn(n), facing = vdot(nt, this.cam);
    const mk = off => {
      const pts = [];
      for (let i = 0; i < N; i++) {
        const u = ra * cs[i], v = rb * sn[i];
        const p = this.tv([c[0] + a1[0] * u + a2[0] * v + n[0] * off, c[1] + a1[1] * u + a2[1] * v + n[1] * off, c[2] + a1[2] * u + a2[2] * v + n[2] * off]);
        pts.push([this.sx(p), this.sy(p)]);
      }
      return pts;
    };
    const dc = this.dp(this.tv(c)) + this.bias + (o && o.b || 0);
    const pf = mk(th / 2), pb = mk(-th / 2);
    // thickness hull
    const side = hull2(pf.concat(pb));
    this.polyS(side, dc - 0.01, rim, { lv: [5, 3, 1] });
    const front = facing >= 0;
    const top = front ? pf : pb;
    const col = front ? face : (back || rim);
    const p = this.polyS(top, dc, col, { lv: (o && o.lv) || [7, 5, 3], noEdge: false });
    p.facing = facing;
    // inner rim ring
    if (front && o && o.inner) {
      const f = o.inner;
      const pts = top.map(q => { const cx = this.sx(this.tv(c)) , cy = this.sy(this.tv(c)); return [cx + (q[0] - cx) * f, cy + (q[1] - cy) * f]; });
      this.polyS(pts, dc + 0.001, o.innerCol || face, { lv: (o && o.innerLv) || [6, 5, 3], noEdge: false });
    }
    return { front, facing, pts: top, d: dc, a1, a2 };
  }
  /** polyline stroke in 3D (thin details: strings, rope, decorative lines). w in px */
  line(pts3, w, col, o) {
    const sp = [];
    let dd = 0;
    for (const p of pts3) { const v = this.tv(p); sp.push([this.sx(v), this.sy(v)]); dd += this.dp(v); this.ext(sp[sp.length - 1][0], sp[sp.length - 1][1], w); }
    return this.push({ k: LINE, d: dd / pts3.length + this.bias + (o && o.b || 0), pts: sp, w, col, alpha: (o && o.alpha) || 1 });
  }
  /** rectangular beam from a to b with cross-section w x h (h along `up`); visible faces only. o: {up, tex, lv, b, noEnds} */
  beam(a, b, w, h, col, o) {
    o = o || {};
    const u = vnorm(vsub(b, a));
    let ref = o.up || [0, 0, 1];
    if (Math.abs(vdot(u, ref)) > 0.96) ref = [1, 0, 0];
    const sd = vnorm(vcross(u, ref)), vv = vcross(sd, u);
    const hw = w / 2, hh = h / 2;
    const C = (e, i, j) => [e[0] + sd[0] * hw * i + vv[0] * hh * j, e[1] + sd[1] * hw * i + vv[1] * hh * j, e[2] + sd[2] * hw * i + vv[2] * hh * j];
    const faces = [
      [[C(a, 1, 1), C(b, 1, 1), C(b, 1, -1), C(a, 1, -1)], sd],
      [[C(a, -1, 1), C(b, -1, 1), C(b, -1, -1), C(a, -1, -1)], [-sd[0], -sd[1], -sd[2]]],
      [[C(a, 1, 1), C(b, 1, 1), C(b, -1, 1), C(a, -1, 1)], vv],
      [[C(a, 1, -1), C(b, 1, -1), C(b, -1, -1), C(a, -1, -1)], [-vv[0], -vv[1], -vv[2]]],
    ];
    if (!o.noEnds) {
      faces.push([[C(b, 1, 1), C(b, -1, 1), C(b, -1, -1), C(b, 1, -1)], u]);
      faces.push([[C(a, 1, 1), C(a, -1, 1), C(a, -1, -1), C(a, 1, -1)], [-u[0], -u[1], -u[2]]]);
    }
    const out = [];
    for (const f of faces) {
      if (this.vis(f[1]) > 0.001) out.push(this.poly(f[0], col, f[1], { lv: o.lv, b: o.b, tex: (o.tex && f[1] !== u) ? o.tex : null, noEdge: o.noEdge }));
    }
    return out;
  }
  /** axis-aligned (rig frame) box: centre c, half sizes along f, r, z */
  box(c, hf, hr, hz, col, o) { return this.beam([c[0] - hf, c[1], c[2]], [c[0] + hf, c[1], c[2]], hr * 2, hz * 2, col, o); }
  /** spoked wheel: centre c, axle direction n (unit), radius R, thickness th, rotation angle rot */
  wheel(c, n, R, th, rot, rim, spoke, o) {
    o = o || {};
    const d = this.disc(c, n, [0, 0, 1], R, th, o.face || rim, rim, o.back || rim, { n: 18, inner: 0.78, innerCol: o.inner || shadeFace(rim), innerLv: [6, 4, 2], lv: [7, 5, 2], b: o.b });
    const [a1, a2] = [d.a1, d.a2];
    const vf = this.vis(n);
    const side = vf >= 0 ? th / 2 : -th / 2;
    const cc = [c[0] + n[0] * side, c[1] + n[1] * side, c[2] + n[2] * side];
    const nsp = o.spokes || 6, sp = [];
    for (let i = 0; i < nsp; i++) {
      const ang = rot + i * TAU / nsp, ca = Math.cos(ang), sa = Math.sin(ang);
      sp.push([cc, [cc[0] + (a1[0] * ca + a2[0] * sa) * R * 0.8, cc[1] + (a1[1] * ca + a2[1] * sa) * R * 0.8, cc[2] + (a1[2] * ca + a2[2] * sa) * R * 0.8]]);
    }
    this.segs(sp, 0.9, spoke, { d: d.d + 0.2 + (o.b || 0) });
    this.ball(cc, R * 0.2, o.hub || '#4a4f58', { b: (o.b || 0) + 0.25, lv: [7, 5, 2] });
    return d;
  }
  /** many disjoint segments in ONE stroke op (spokes, stitches, plank lines, studs as zero-length dots). pairs = [[a3, b3], ...] */
  segs(pairs, w, col, o) {
    const pts = [];
    let dd = 0;
    for (const pr of pairs) {
      const a = this.tv(pr[0]), b = this.tv(pr[1]);
      const x0 = this.sx(a), y0 = this.sy(a), x1 = this.sx(b), y1 = this.sy(b);
      pts.push(x0, y0, x1, y1); dd += this.dp(a) + this.dp(b);
      this.ext(x0, y0, w); this.ext(x1, y1, w);
    }
    return this.push({ k: SEGS, d: (o && o.d !== undefined ? o.d : dd / (2 * pairs.length)) + this.bias + (o && o.b || 0), pts, w, col, alpha: (o && o.alpha) || 1 });
  }
  /** vertical stitch lines on a Rev surface (visible parts only): one stroke op. thetas in radians, h range [h0,h1], n segments per line */
  stitches(rev, thetas, h0, h1, w, col, o) {
    const n = (o && o.n) || 4, k = (o && o.k) || 1.02, pairs = [];
    const base = (o && o.like) ? o.like.d : this.dp(this.tv(rev.center((h0 + h1) / 2)));
    for (const th of thetas) {
      const [a, b] = rev.rad((h0 + h1) / 2);
      const nrm = vadd(vmul(rev.u1, Math.cos(th) / a), vmul(rev.u2, Math.sin(th) / b));
      if (this.vis(nrm) <= 0.12) continue;
      let prev = rev.pt(h0, th, k);
      for (let i = 1; i <= n; i++) { const q = rev.pt(h0 + (h1 - h0) * i / n, th, k); if (i % 2 === 1 || (o && o.solid)) pairs.push([prev, q]); prev = q; }
    }
    if (pairs.length) return this.segs(pairs, w, col, { d: base + 0.003 });
  }
  /** dots (studs/rivets) on a Rev surface at the given heights x thetas (visible only) */
  studs(rev, hs, thetas, w, col, o) {
    const k = (o && o.k) || 1.03, pairs = [];
    const base = (o && o.like) ? o.like.d : this.dp(this.tv(rev.center(hs[0])));
    for (let i = 0; i < hs.length; i++) for (const th0 of thetas) {
      const th = th0 + ((i & 1) ? 0.11 : 0);
      const [a, b] = rev.rad(hs[i]);
      const nrm = vadd(vmul(rev.u1, Math.cos(th) / a), vmul(rev.u2, Math.sin(th) / b));
      if (this.vis(nrm) <= 0.15) continue;
      const p = rev.pt(hs[i], th, k);
      pairs.push([p, p]);
    }
    if (pairs.length) return this.segs(pairs, w, col, { d: base + 0.003 });
  }
  /** zig-zag hem line around a Rev at height h (mail hauberk / scalloped hem), visible arcs only */
  zigzag(rev, h, amp, w, col, o) {
    const N = (o && o.n) || 24, k = (o && o.k) || 1.02, pairs = [];
    const base = (o && o.like) ? o.like.d : this.dp(this.tv(rev.center(h)));
    const [a, b] = rev.rad(h);
    let prev = null, prevVis = false;
    for (let i = 0; i <= N; i++) {
      const th = i / N * TAU;
      const nrm = vadd(vmul(rev.u1, Math.cos(th) / a), vmul(rev.u2, Math.sin(th) / b));
      const vis = this.vis(nrm) > 0.0;
      const p = rev.pt(h + ((i & 1) ? amp : 0), th, k);
      if (prev && vis && prevVis) pairs.push([prev, p]);
      prev = p; prevVis = vis;
    }
    if (pairs.length) return this.segs(pairs, w, col, { d: base + 0.003 });
  }
  /** custom drawing callback (ctx is translated so that the rig origin is (0,0)); `post` = drawn after the outline */
  fn(d, fn, post) { return this.push({ k: FN, d: d + this.bias, fn, post: !!post }); }
}

// ------------------------------------------------------------------ drawing
function capPath(ctx, x0, y0, x1, y1, r0, r1) {
  const dx = x1 - x0, dy = y1 - y0;
  ctx.beginPath();
  if (dx * dx + dy * dy < 0.04) { ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, Math.max(r0, r1), 0, TAU); return; }
  const th = Math.atan2(dy, dx);
  ctx.arc(x1, y1, r1, th - HP, th + HP, false);
  ctx.arc(x0, y0, r0, th + HP, th + 3 * HP, false);
  ctx.closePath();
}

function drawCap(ctx, p) {
  const { x0, y0, x1, y1, r0, r1, rp, lv } = p;
  capPath(ctx, x0, y0, x1, y1, r0, r1);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const e = Math.abs((x1 - x0) * LX + (y1 - y0) * LY) / 2 + Math.max(r0, r1);
  if (RO.grad && (r0 + r1) >= RO.gradMin) {
    const g = ctx.createLinearGradient(mx + LX * e, my + LY * e, mx - LX * e, my - LY * e);
    g.addColorStop(0, rp[lv[0]]); g.addColorStop(0.45, rp[lv[1]]); g.addColorStop(1, rp[lv[2]]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = rp[lv[1]];
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  ctx.fill();
  if (p.alpha !== undefined) ctx.globalAlpha = 1;
  if (p.edge && RO.edge && (r0 + r1) >= RO.edgeMin) { ctx.strokeStyle = EDGE; ctx.lineWidth = 0.6; ctx.stroke(); }
}

function drawBall(ctx, p) {
  const { x, y, rx, ry, rot, rp, lv } = p;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  const m = Math.max(rx, ry);
  if (RO.grad && m * 2 >= RO.gradMin) {
    const g = ctx.createRadialGradient(x - m * 0.34, y - m * 0.40, m * 0.06, x + m * 0.08, y + m * 0.10, m * 1.12);
    g.addColorStop(0, rp[lv[0]]); g.addColorStop(0.5, rp[lv[1]]); g.addColorStop(1, rp[lv[2]]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = rp[lv[1]];
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  ctx.fill();
  if (p.alpha !== undefined) ctx.globalAlpha = 1;
  if (p.edge && RO.edge && m * 2 >= RO.edgeMin) { ctx.strokeStyle = EDGE; ctx.lineWidth = 0.6; ctx.stroke(); }
}

function drawPoly(ctx, p) {
  const pts = p.pts, n = pts.length;
  if (n < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  let mn = 1e9, mx = -1e9, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const q = pts[i];
    if (i) ctx.lineTo(q[0], q[1]);
    const pr = q[0] * LX + q[1] * LY;
    if (pr < mn) mn = pr; if (pr > mx) mx = pr;
    cx += q[0]; cy += q[1];
  }
  ctx.closePath();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  if (p.solid) { ctx.fillStyle = p.solid; ctx.fill(); }
  else if (!RO.grad) { ctx.fillStyle = p.rp[Math.round(p.lv[1])]; ctx.fill(); }
  else {
    cx /= n; cy /= n;
    const cp = cx * LX + cy * LY, rp = p.rp, lv = p.lv;
    const g = ctx.createLinearGradient(cx + LX * (mx - cp), cy + LY * (mx - cp), cx + LX * (mn - cp), cy + LY * (mn - cp));
    g.addColorStop(0, rp[Math.round(lv[0])]); g.addColorStop(0.45, rp[Math.round(lv[1])]); g.addColorStop(1, rp[Math.round(lv[2])]);
    ctx.fillStyle = g; ctx.fill();
  }
  if (p.edge && RO.edge) { ctx.strokeStyle = EDGE; ctx.lineWidth = 0.6; ctx.stroke(); }
  if (p.alpha !== undefined) ctx.globalAlpha = 1;
}

function drawLine(ctx, p) {
  const pts = p.pts;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = p.col; ctx.lineWidth = p.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.alpha !== 1) ctx.globalAlpha = p.alpha;
  ctx.stroke();
  if (p.alpha !== 1) ctx.globalAlpha = 1;
}

/** offset a polygon outward by d px (miter, clamped). Returns a new point list. */
function offsetPoly(pts, d) {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area >= 0 ? 1 : -1;
  const out = new Array(n);
  let px = pts[n - 1][0], py = pts[n - 1][1];
  for (let i = 0; i < n; i++) {
    const c = pts[i], nx = pts[(i + 1) % n];
    let e1x = c[0] - px, e1y = c[1] - py, l1 = Math.hypot(e1x, e1y) || 1;
    let e2x = nx[0] - c[0], e2y = nx[1] - c[1], l2 = Math.hypot(e2x, e2y) || 1;
    const n1x = e1y / l1 * sg, n1y = -e1x / l1 * sg, n2x = e2y / l2 * sg, n2y = -e2x / l2 * sg;
    let bx = n1x + n2x, by = n1y + n2y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-3) { bx = n1x; by = n1y; } else { bx /= bl; by /= bl; }
    const k = Math.min(2.4, 1 / Math.max(0.42, bx * n1x + by * n1y));
    out[i] = [c[0] + bx * d * k, c[1] + by * d * k];
    px = c[0]; py = c[1];
  }
  return out;
}

/** dark outline: every part is filled 1px larger in dark BEFORE the real parts are drawn (only fills: much cheaper than strokes or addOutline) */
function drawHalo(ctx, S) {
  const parts = S.parts;
  ctx.fillStyle = HALO;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    switch (p.k) {
      case CAP: if (p.alpha !== undefined) break; capPath(ctx, p.x0, p.y0, p.x1, p.y1, p.r0 + 1, p.r1 + 1); ctx.fill(); break;
      case BALL: if (p.alpha !== undefined) break; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx + 1, p.ry + 1, p.rot, 0, TAU); ctx.fill(); break;
      case POLY: {
        if (p.alpha !== undefined || p.pts.length < 3) break;
        const q = offsetPoly(p.pts, 1);
        ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
        for (let j = 1; j < q.length; j++) ctx.lineTo(q[j][0], q[j][1]);
        ctx.closePath(); ctx.fill();
        break;
      }
      case LINE: {
        const pts = p.pts;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.strokeStyle = HALO; ctx.lineWidth = p.w + 2; ctx.stroke();
        break;
      }
    }
  }
}

function drawSegs(ctx, p) {
  const q = p.pts;
  ctx.beginPath();
  for (let i = 0; i < q.length; i += 4) { ctx.moveTo(q[i], q[i + 1]); ctx.lineTo(q[i + 2], q[i + 3]); }
  ctx.strokeStyle = p.col; ctx.lineWidth = p.w; ctx.lineCap = 'round';
  if (p.alpha !== 1) ctx.globalAlpha = p.alpha;
  ctx.stroke();
  if (p.alpha !== 1) ctx.globalAlpha = 1;
}

function sortParts(parts) { parts.sort((a, b) => (a.d - b.d) || (a.o - b.o)); }

/** draw all parts of the scene (sorted) with the current ctx transform. post=false -> normal parts, true -> only `post` fn parts */
export function drawScene(ctx, S, post, sorted) {
  const parts = S.parts;
  if (!post && !sorted) sortParts(parts);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (post) { if (p.k === FN && p.post) p.fn(ctx); continue; }
    switch (p.k) {
      case CAP: drawCap(ctx, p); break;
      case BALL: drawBall(ctx, p); break;
      case POLY: drawPoly(ctx, p); break;
      case LINE: drawLine(ctx, p); break;
      case SEGS: drawSegs(ctx, p); break;
      case FN: if (!p.post) p.fn(ctx); break;
    }
  }
}

/** generators end with finish(S): normally renders the sprite, or hands back the scene (icons) when S.buildOnly is set */
export function finish(S) { return S.buildOnly ? S : renderSprite(S); }

/** Render the scene to a tightly cropped sprite; the rig origin (ground point under the unit) becomes the anchor. */
export function renderSprite(S, margin = 2, noOutline = false) {
  S.ext(0, 0, 1);                       // the ground anchor is always inside the sprite
  if (S.x0 > S.x1) { S.x0 = -2; S.x1 = 2; S.y0 = -2; S.y1 = 2; }
  const x0 = Math.floor(S.x0 - margin), y0 = Math.floor(S.y0 - margin);
  const w = Math.ceil(S.x1 + margin) - x0, h = Math.ceil(S.y1 + margin) - y0;
  const surf = makeCanvas(w, h), ctx = surf.ctx;
  ctx.translate(-x0, -y0);
  sortParts(S.parts);
  if (!noOutline && RO.outline === 'halo1') { drawHalo(ctx, S); drawScene(ctx, S, false, true); }
  else { drawScene(ctx, S, false, true); if (!noOutline && RO.outline === 'copy') addOutline(surf); }
  drawScene(ctx, S, true);
  return { canvas: surf.canvas, w: surf.w, h: surf.h, ax: -x0, ay: -y0, u: 0 };
}

const shadeFace = c => mixHex(c, '#000000', 0.18);
export { addOutline, makeCanvas };
