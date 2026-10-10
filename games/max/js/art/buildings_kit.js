// Iso scene toolkit for building sprites.
// World units: x runs toward screen SE, y toward SW, z is height in screen px.  Footprint centre = origin.
//   screen = (ax + x - y,  ay + (x + y)/2 - z)       (tile = 32 x 32 units = the 64x32 diamond)
// Every textured surface is drawn through plane(): a texture painter works in the face's own (u,v) px space and an affine
// transform maps it onto the iso plane, so walls, roofs, gables ... are all geometrically exact.
import { makeCanvas, addOutline, getSpriteScale, rng, shade, mix, rgba, teamColor } from './common.js';
import { rgbMul, rgbOf, ramp, tones, blotches } from './buildings_paint.js';

export const SQ2 = Math.SQRT2;

// multiply tints per surface orientation (light from the upper-left)
export const LIGHT = {
  top: 'rgb(255,252,242)',
  left: 'rgb(231,224,238)',
  right: 'rgb(168,160,190)',
  roofL: 'rgb(244,236,238)',
  roofR: 'rgb(184,174,202)',
  inner: 'rgb(150,142,170)',
};

let scratch = null;
function getScratch(w, h) {
  const S = getSpriteScale();
  if (!scratch || scratch.S !== S || scratch.w < w || scratch.h < h) {
    const surf = makeCanvas(Math.max(w, scratch && scratch.S === S ? scratch.w : 0), Math.max(h, scratch && scratch.S === S ? scratch.h : 0));
    scratch = { surf, S, w: surf.w, h: surf.h };
  }
  const c = scratch.surf.ctx;
  c.setTransform(S, 0, 0, S, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.shadowColor = 'rgba(0,0,0,0)';
  c.clearRect(0, 0, w + 1, h + 1);
  return scratch;
}
export function resetScratch() { scratch = null; }

export class Scene {
  /**
   * n: footprint tiles.  o: { stage (0..3 construction, 4 complete), team, age, seed, hmax (tallest point px), side (extra width margin) }
   */
  constructor(n, o = {}) {
    this.n = n; this.stage = o.stage === undefined ? 4 : o.stage; this.team = o.team === undefined ? 1 : o.team; this.tc = teamColor(this.team);
    this.age = o.age | 0; this.seed = (o.seed || 1) >>> 0;
    const side = o.side === undefined ? 60 : o.side, hmax = o.hmax || 80;
    this.W = Math.ceil(64 * n + side * 2); this.top = Math.ceil(16 * n + hmax + 50); this.bot = Math.ceil(16 * n + 50);
    this.H = this.top + this.bot;
    this.sc = getScratch(this.W, this.H); this.c = this.sc.surf.ctx;
    this.ax = this.W / 2; this.ay = this.top;
    this.bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };     // structure bounds (scratch coords)
    this.bbA = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };    // incl. ground shadow
    this.pi = 0; this.posts = []; this.shadows = []; this.grounds = []; this.cuts = []; this.Hc = 40;
    const st = this.stage;
    this.zcut = st >= 3 ? 1e9 : st === 2 ? this.Hc : st === 1 ? this.Hc * 0.35 : 0;
    this.cover = st >= 4 ? 1 : st === 3 ? 0.55 : 0;
    this.full = st >= 4;
    this.rr = rng(this.seed ^ 0x9e3779b9);
    this.mass = [];
  }
  setHc(h) { this.Hc = h; const st = this.stage; this.zcut = st >= 3 ? 1e9 : st === 2 ? h : st === 1 ? h * 0.35 : 0; }
  rand() { return this.rr(); }
  P(x, y, z = 0) { return [this.ax + x - y, this.ay + (x + y) * 0.5 - z]; }
  sx(x, y) { return this.ax + x - y; }
  sy(x, y, z = 0) { return this.ay + (x + y) * 0.5 - z; }
  touchS(x, y, ground) {
    const b = this.bb, a = this.bbA;
    if (!ground) { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
    if (x < a.x0) a.x0 = x; if (x > a.x1) a.x1 = x; if (y < a.y0) a.y0 = y; if (y > a.y1) a.y1 = y;
  }
  touch(x, y, z = 0, ground) { this.touchS(this.ax + x - y, this.ay + (x + y) * 0.5 - z, ground); }
  want(tag) {
    if (tag === 'prop' || tag === 'detail') return this.stage >= 4;
    if (tag === 'roof' || tag === 'trim') return this.stage >= 3;
    return true;
  }
  post(fn, bb) { this.posts.push(fn); if (bb) { this.touchS(bb[0], bb[1]); this.touchS(bb[2], bb[3]); } }

  // ------------------------------------------------------------------ planes
  /**
   * Draw a textured planar face.  p0 = 3D origin of the face's (u,v)=(0,0) corner, u3/v3 = 3D unit vectors for u and v.
   * paint(c, w, h, rnd) draws the texture.  o: light ('top'|'left'|'right'|'roofL'|'roofR'|null), poly ([[u,v]..] clip), vmin/vmax (extra v clip),
   * eave (px of overhang shadow at the top), ao (px of ground-contact darkening at the bottom), hl (edge highlights), under (underlay colour)
   */
  plane(p0, u3, v3, w, h, paint, o = {}) {
    const c = this.c;
    const ox = this.ax + p0[0] - p0[1], oy = this.ay + (p0[0] + p0[1]) * 0.5 - p0[2];
    const ux = u3[0] - u3[1], uy = (u3[0] + u3[1]) * 0.5 - u3[2];
    const vx = v3[0] - v3[1], vy = (v3[0] + v3[1]) * 0.5 - v3[2];
    const poly = o.poly || [[0, 0], [w, 0], [w, h], [0, h]];
    const rnd = rng((this.seed + (this.pi++) * 7919 + (o.seed || 0)) >>> 0);
    let minV = 0, maxV = h;
    if (o.vmin !== undefined) minV = o.vmin;
    if (o.vmax !== undefined) maxV = o.vmax;
    for (let i = 0; i < poly.length; i++) this.touchS(ox + poly[i][0] * ux + poly[i][1] * vx, oy + poly[i][0] * uy + poly[i][1] * vy);
    c.save();
    c.transform(ux, uy, vx, vy, ox, oy);
    // underlay: closes AA seams between neighbouring faces
    c.beginPath(); c.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) c.lineTo(poly[i][0], poly[i][1]); c.closePath();
    if (o.vmin !== undefined || o.vmax !== undefined) { c.clip(); c.beginPath(); c.rect(-5, minV, w + 10, maxV - minV); c.clip(); c.beginPath(); c.moveTo(poly[0][0], poly[0][1]); for (let i = 1; i < poly.length; i++) c.lineTo(poly[i][0], poly[i][1]); c.closePath(); }
    c.fillStyle = o.under || '#6d5e4c'; c.fill();
    c.lineWidth = 0.9; c.strokeStyle = o.under || '#6d5e4c'; c.stroke();
    c.clip();
    paint(c, w, h, rnd);
    const L = o.light;
    if (L) { c.globalCompositeOperation = 'multiply'; c.fillStyle = LIGHT[L]; c.fillRect(-3, -3, w + 6, h + 6); c.globalCompositeOperation = 'source-over'; }
    if (o.eave) {
      const eh = o.eave * 1.9 + 3, g = c.createLinearGradient(0, 0, 0, eh);
      g.addColorStop(0, 'rgba(16,8,26,0.42)'); g.addColorStop(0.45, 'rgba(16,8,26,0.16)'); g.addColorStop(1, 'rgba(16,8,26,0)');
      c.fillStyle = g; c.fillRect(-1, 0, w + 2, eh);
    }
    if (o.ao !== 0) {
      const ah = o.ao || 7, g = c.createLinearGradient(0, h - ah, 0, h);
      g.addColorStop(0, 'rgba(16,8,26,0)'); g.addColorStop(1, 'rgba(16,8,26,0.34)');
      c.fillStyle = g; c.fillRect(-1, h - ah, w + 2, ah + 1);
    }
    if (o.shadeL) {                                       // darkening toward the left/right edge (corner occlusion / cylinder-ish falloff)
      const sw = o.shadeL, g = c.createLinearGradient(0, 0, sw, 0);
      g.addColorStop(0, 'rgba(16,8,26,0.3)'); g.addColorStop(1, 'rgba(16,8,26,0)'); c.fillStyle = g; c.fillRect(0, 0, sw, h);
    }
    if (o.hl !== false && L && (L === 'left' || L === 'right' || L === 'top')) {
      c.fillStyle = L === 'left' ? 'rgba(255,246,220,0.30)' : 'rgba(255,246,220,0.16)';
      c.fillRect(0, 0, w, 0.9);
      if (L !== 'top') { c.fillStyle = L === 'left' ? 'rgba(255,246,220,0.34)' : 'rgba(255,246,220,0.2)'; c.fillRect(0, 0, 0.9, h); }
    }
    c.restore();
  }
  /** flat polygon from 3D points */
  polyFlat(pts3, fill, stroke, lw = 1) {
    const c = this.c;
    c.beginPath();
    for (let i = 0; i < pts3.length; i++) {
      const [x, y] = this.P(pts3[i][0], pts3[i][1], pts3[i][2]);
      this.touchS(x, y);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  }
  /** vertical face in the plane x = xc (faces SE); pts = [[y,z]...] */
  planeX(xc, pts, paint, o = {}) {
    let ymax = -1e9, zmax = -1e9, ymin = 1e9, zmin = 1e9;
    for (const [y, z] of pts) { ymax = Math.max(ymax, y); ymin = Math.min(ymin, y); zmax = Math.max(zmax, z); zmin = Math.min(zmin, z); }
    const poly = pts.map(([y, z]) => [ymax - y, zmax - z]);
    this.plane([xc, ymax, zmax], [0, -1, 0], [0, 0, -1], ymax - ymin, zmax - zmin, paint, Object.assign({ poly, light: 'right' }, o));
  }
  /** vertical face in the plane y = yc (faces SW); pts = [[x,z]...] */
  planeY(yc, pts, paint, o = {}) {
    let xmax = -1e9, zmax = -1e9, xmin = 1e9, zmin = 1e9;
    for (const [x, z] of pts) { xmax = Math.max(xmax, x); xmin = Math.min(xmin, x); zmax = Math.max(zmax, z); zmin = Math.min(zmin, z); }
    const poly = pts.map(([x, z]) => [x - xmin, zmax - z]);
    this.plane([xmin, yc, zmax], [1, 0, 0], [0, 0, -1], xmax - xmin, zmax - zmin, paint, Object.assign({ poly, light: 'left' }, o));
  }

  // ------------------------------------------------------------------ shadows & ground
  /** soft cast shadow for a block (rect x0..x1, y0..y1, height h), falls toward the lower right (+x).  Drawn UNDER the sprite after outlining. */
  cast(x0, y0, x1, y1, h, o = {}) {
    if (this.stage < 1 && !o.force) return;
    h = Math.min(h, this.stage >= 3 ? 1e9 : this.zcut + 6);
    const L = Math.min(h * (o.k || 0.5), o.max || 38), sx = L, sy = L * 0.22;
    const pts = [[x0, y0], [x1, y0], [x1 + sx, y0 + sy], [x1 + sx, y1 + sy], [x1, y1], [x0, y1]];
    const sp = pts.map(([x, y]) => this.P(x, y, 0));
    for (const p of sp) { this.touchS(p[0] - 9, p[1] - 9, true); this.touchS(p[0] + 9, p[1] + 9, true); }
    this.shadows.push({ pts: sp, a: o.alpha || 0.36, blur: o.blur || 6 });
    if (o.contact !== false) {                              // tight contact shadow hugging the base
      const cp = [[x0 - 1, y0 - 1], [x1 + 3, y0 - 1], [x1 + 3.5, y1 + 2.5], [x0 - 1, y1 + 2.5]].map(([x, y]) => this.P(x, y, 0));
      this.shadows.push({ pts: cp, a: 0.3, blur: 2.5 });
    }
  }
  /** darker trampled ground patch (iso ellipse-ish), drawn under everything */
  ground(cx, cy, rx, ry, color = '#5a4430', alpha = 0.4, o = {}) {
    const [sx, sy] = this.P(cx, cy, 0), R = Math.max(rx, ry) * 1.42;
    this.grounds.push({ sx, sy, R, color, alpha, ky: 0.5 * (ry / Math.max(1, rx)) * (o.sq || 1) });
    this.touchS(sx - R, sy - R * 0.5, true); this.touchS(sx + R, sy + R * 0.5, true);
  }

  // ------------------------------------------------------------------ boxes
  /** Vertical box.  o: left/right/top painters, eave, tag, hollow, wt (wall thickness for the hollow look), under */
  box(x0, y0, z0, x1, y1, z1, o = {}) {
    const tag = o.tag || 'wall';
    if (!this.want(tag)) return false;
    let zt = z1;
    if (tag === 'wall' && !o.noCut) { if (z0 >= this.zcut) return false; zt = Math.min(z1, this.zcut); }
    const H = z1 - z0, cut = z1 - zt, partial = cut > 0.01;
    const under = o.under;
    const mk = (w) => {
      if (!partial) return {};
      return { poly: [[0, cut], [w, cut], [w, H], [0, H]] };
    };
    if (o.left !== false) {
      const w = x1 - x0, P = o.left || o.side;
      if (P) this.plane([x0, y1, z1], [1, 0, 0], [0, 0, -1], w, H, P, Object.assign({ light: 'left', eave: o.eave, ao: o.ao, under, shadeL: o.shadeL }, mk(w)));
    }
    if (o.right !== false) {
      const w = y1 - y0, P = o.right || o.side;
      if (P) this.plane([x1, y1, z1], [0, -1, 0], [0, 0, -1], w, H, P, Object.assign({ light: 'right', eave: o.eave, ao: o.ao, under }, mk(w)));
    }
    if (!partial) {
      if (o.top) this.plane([x0, y0, zt], [1, 0, 0], [0, 1, 0], x1 - x0, y1 - y0, o.top, { light: 'top', ao: 0, hl: false, under });
    } else if (o.hollow !== false && tag === 'wall') this.hollowTop(x0, y0, x1, y1, z0, zt, o.wt || 4.5, o);
    else if (o.top || o.left) this.plane([x0, y0, zt], [1, 0, 0], [0, 1, 0], x1 - x0, y1 - y0, o.top || o.left, { light: 'top', ao: 0, hl: false, under });
    return true;
  }
  /** top of a cut-down (under construction) wall box: stone rim around a dark hollow interior */
  hollowTop(x0, y0, x1, y1, z0, zt, t, o) {
    const w = x1 - x0, d = y1 - y0, rimP = o.rim || ((c, ww, hh) => { c.fillStyle = '#9a9384'; c.fillRect(-1, -1, ww + 2, hh + 2); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(0, 0, ww, 1); });
    t = Math.min(t, w / 3, d / 3);
    const inner = [[t, t], [w - t, t], [w - t, d - t], [t, d - t]];
    this.plane([x0, y0, zt], [1, 0, 0], [0, 1, 0], w, d, (c, ww, hh, rnd) => {
      rimP(c, ww, hh, rnd);
      // interior: dirt floor and inner faces of the back walls drawn in plane space is not possible -> flat dark; refined below
      c.fillStyle = '#5a452e'; c.beginPath(); c.moveTo(inner[0][0], inner[0][1]); for (let i = 1; i < 4; i++) c.lineTo(inner[i][0], inner[i][1]); c.closePath(); c.fill();
    }, { light: 'top', ao: 0, hl: false });
    // inner back faces (they face the camera): x = x0+t plane (faces +x) and y = y0+t plane (faces +y), limited to the opening
    const dd = Math.min(zt - z0, 26);
    const c = this.c;
    c.save();
    c.beginPath();
    for (let i = 0; i < 4; i++) { const [sx, sy] = this.P(x0 + inner[i][0], y0 + inner[i][1], zt); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); }
    c.closePath(); c.clip();
    const wallP = o.inner || o.left;
    if (wallP) {
      this.plane([x0 + t, y1 - t, zt], [0, -1, 0], [0, 0, -1], d - 2 * t, dd, wallP, { light: 'inner', ao: 0, hl: false });
      this.plane([x0 + t, y0 + t, zt], [1, 0, 0], [0, 0, -1], w - 2 * t, dd, wallP, { light: 'left', ao: 0, hl: false });
    }
    c.restore();
  }

  // ------------------------------------------------------------------ roofs
  _edgeBand(A, B, t, color, hlColor) {
    const c = this.c, a = this.P(A[0], A[1], A[2]), b = this.P(B[0], B[1], B[2]);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] + t); c.lineTo(a[0], a[1] + t); c.closePath();
    c.fillStyle = color; c.fill();
    if (hlColor) { c.strokeStyle = hlColor; c.lineWidth = 0.8; c.beginPath(); c.moveTo(a[0], a[1] + 0.4); c.lineTo(b[0], b[1] + 0.4); c.stroke(); }
    this.touchS(a[0], a[1] + t); this.touchS(b[0], b[1] + t);
  }
  /** a roof plane with construction-stage handling (partial cover + rafters) */
  roofPlane(p0, u3, v3, w, h, paint, light, poly, o = {}) {
    if (this.stage < 3) return;
    const cover = this.cover;
    if (cover >= 1) { this.plane(p0, u3, v3, w, h, paint, { light, poly, ao: 0, hl: false, under: o.under }); return; }
    const vcut = h * (1 - cover);
    this.plane(p0, u3, v3, w, h, paint, { light, poly, ao: 0, hl: false, vmin: vcut, under: o.under });
    // exposed rafters above the covered part
    this.plane(p0, u3, v3, w, h, (c, ww, hh) => {
      c.fillStyle = 'rgba(36,24,14,0.78)'; c.fillRect(-1, -1, ww + 2, vcut + 3);
      c.fillStyle = '#6a4a2a';
      const sp = 9;
      for (let x = 2; x < ww; x += sp) { c.fillStyle = 'rgba(25,14,6,0.4)'; c.fillRect(x + 1, 0, 2.2, vcut + 3); c.fillStyle = '#7d5a34'; c.fillRect(x, 0, 2.2, vcut + 3); c.fillStyle = 'rgba(255,230,170,0.3)'; c.fillRect(x, 0, 0.7, vcut + 3); }
      c.fillStyle = '#6a4a2a'; for (const v of [vcut * 0.35, vcut * 0.7]) c.fillRect(0, v, ww, 1.6);
    }, { light, poly, ao: 0, hl: false, vmax: vcut + 1.5, under: 'rgba(36,24,14,0.78)' });
  }
  /**
   * Gabled roof over a rectangle.  o: x0,y0,x1,y1, z (eave height at the wall top), rise, ov (eave overhang), ovg (gable overhang),
   * axis ('x' ridge along x), paint (roof painter), trim (fascia colour), ridge (ridge cap colour or null), ridgeW
   */
  roofGable(o) {
    if (this.stage < 3) return;
    const { x0, y0, x1, y1, z, rise } = o, ov = o.ov === undefined ? 4 : o.ov, ovg = o.ovg === undefined ? 3 : o.ovg;
    const trim = o.trim || '#4a3220', thick = o.thick === undefined ? 3 : o.thick;
    const ovb = o.ovb === undefined ? ovg : o.ovb;
    if (o.axis === 'y') {
      const W = x1 - x0, xm = (x0 + x1) / 2, half = W / 2, slope = rise / half;
      const xE = x1 + ov, zE = z - ov * slope, L = Math.hypot(xE - xm, z + rise - zE);
      // visible plane faces +x (SE): u runs along -y (screen left->right), v from ridge down to eave
      const u3 = [0, -1, 0], v3 = [(xE - xm) / L, 0, -(z + rise - zE) / L], w = (y1 - y0) + ovg + ovb;
      if (rise / half > 1.22) {                                // steep roofs show their back plane
        this.roofPlane([xm, y1 + ovg, z + rise], [0, -1, 0], [-(xm - (x0 - ov)) / L, 0, -(z + rise - zE) / L], w, L, o.paint, 'roofL', null, o);
      }
      this.roofPlane([xm, y1 + ovg, z + rise], u3, v3, w, L, o.paint, 'roofR', null, o);
      this._edgeBand([xE, y1 + ovg, zE], [xE, y0 - ovb, zE], thick, trim, shade(trim, 0.3));          // eave fascia
      this._edgeBand([xm, y1 + ovg, z + rise], [xE, y1 + ovg, zE], thick, trim, shade(trim, 0.3));    // rake at the SW gable end
      if (o.ridge) this._ridge([xm, y1 + ovg, z + rise], [xm, y0 - ovb, z + rise], o.ridge, o.ridgeW || 3);
    } else {
      const D = y1 - y0, ym = (y0 + y1) / 2, half = D / 2, slope = rise / half;
      const yE = y1 + ov, zE = z - ov * slope, L = Math.hypot(yE - ym, z + rise - zE);
      const u3 = [1, 0, 0], v3 = [0, (yE - ym) / L, -(z + rise - zE) / L], w = (x1 - x0) + ovg + ovb;
      if (rise / half > 1.22) {
        this.roofPlane([x0 - ovb, ym, z + rise], u3, [0, -(ym - (y0 - ov)) / L, -(z + rise - zE) / L], w, L, o.paint, 'roofR', null, o);
      }
      this.roofPlane([x0 - ovb, ym, z + rise], u3, v3, w, L, o.paint, 'roofL', null, o);
      this._edgeBand([x0 - ovb, yE, zE], [x1 + ovg, yE, zE], thick, trim, shade(trim, 0.3));
      this._edgeBand([x1 + ovg, ym, z + rise], [x1 + ovg, yE, zE], thick, trim, shade(trim, 0.3));
      if (o.ridge) this._ridge([x0 - ovb, ym, z + rise], [x1 + ovg, ym, z + rise], o.ridge, o.ridgeW || 3);
    }
  }
  /**
   * Walls + gable end + gabled roof in one call.  o: x0,y0,x1,y1, z0, zw (wall top), rise, axis, long (painter of the long wall), end (painter of the gable end,
   * painted on the pentagon incl. the triangle), ov, ovg, roof (painter), trim, ridge, eave
   */
  gableBlock(o) {
    const { x0, y0, x1, y1, z0, zw, rise } = o, axis = o.axis || 'x', ov = o.ov === undefined ? 4 : o.ov;
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2, eave = o.eave === undefined ? ov : o.eave;
    const full = this.zcut >= zw + rise - 0.01;
    if (axis === 'x') {
      this.box(x0, y0, z0, x1, y1, zw, { left: o.long, right: full ? false : o.end, top: false, eave, under: o.under });
      if (full) this.planeX(x1, [[y1, z0], [y0, z0], [y0, zw], [ym, zw + rise], [y1, zw]], o.end, { eave: 0, under: o.under });
    } else {
      this.box(x0, y0, z0, x1, y1, zw, { right: o.long, left: full ? false : o.end, top: false, eave, under: o.under });
      if (full) this.planeY(y1, [[x0, z0], [x1, z0], [x1, zw], [xm, zw + rise], [x0, zw]], o.end, { eave: 0, under: o.under });
    }
    this.roofGable({ x0, y0, x1, y1, z: zw, rise, ov, ovg: o.ovg, ovb: o.ovb, axis, paint: o.roof, trim: o.trim, ridge: o.ridge, ridgeW: o.ridgeW, thick: o.thick });
  }
  /**
   * Dormer window standing on the front (SW) slope of a gable roof whose ridge runs along x.
   * roof = {y0, y1, z, rise}; d = {x, w, hw (wall height), rr (dormer roof rise), t (0 ridge .. 1 eave), wall (painter), roofPaint, trim, win (decal fn)}
   */
  dormer(roof, d) {
    if (this.stage < 4) return;
    const ym = (roof.y0 + roof.y1) / 2, half = (roof.y1 - roof.y0) / 2, zR = roof.z + roof.rise, sl = roof.rise / half;
    const zr = (y) => zR - sl * (y - ym);
    const xc = d.x, xa = xc - d.w / 2, xb = xc + d.w / 2, hw = d.hw || 10, rr = d.rr || 6;
    const yf = ym + (d.t === undefined ? 0.72 : d.t) * half, zf = zr(yf), zt = zf + hw, yb = yf - hw / sl;
    const ov = 2, ovx = 2, trim = d.trim || '#3a2a1c';
    const sd = rr / (xb - xc), zE = zt - ovx * sd, zRd = zt + rr;
    // side wall (SE facing) triangle
    this.planeX(xb, [[yf, zf], [yf, zt], [yb, zt]], d.wall, { ao: 0, eave: 0 });
    // front wall + gable triangle (both on plane y = yf)
    const front = (c, w, h, r) => { d.wall(c, w, h, r); if (d.win) d.win(c, w, h); };
    this.planeY(yf, [[xa, zf], [xb, zf], [xb, zt], [xc, zRd], [xa, zt]], front, { ao: 0, eave: 1.5 });
    // roof plane facing +x
    const L = Math.hypot(xb + ovx - xc, zRd - zE);
    const yeaveHit = ym + (zR - zE) / sl, yridgeHit = ym + (zR - zRd) / sl;
    const uR = (yf + ov) - yridgeHit, uE = (yf + ov) - yeaveHit;
    this.roofPlane([xc, yf + ov, zRd], [0, -1, 0], [(xb + ovx - xc) / L, 0, -(zRd - zE) / L], (yf + ov) - (yb - 2), L, d.roofPaint, 'roofR', [[0, 0], [Math.max(1, uR), 0], [Math.max(1, uE), L], [0, L]], {});
    this._edgeBand([xc, yf + ov, zRd], [xb + ovx, yf + ov, zE], 2.4, trim, shade(trim, 0.3));
    // left (SW-facing) roof plane edge is hidden; draw a small front eave band on the visible half only
    this.touch(xa, yf + ov, zt); this.touch(xb + ovx, yb, zRd);
  }
  _ridge(A, B, col, wd) {
    const c = this.c, a = this.P(A[0], A[1], A[2]), b = this.P(B[0], B[1], B[2]);
    c.lineCap = 'round';
    c.strokeStyle = shade(col, -0.45); c.lineWidth = wd + 1.2; c.beginPath(); c.moveTo(a[0], a[1] + 0.8); c.lineTo(b[0], b[1] + 0.8); c.stroke();
    c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    c.strokeStyle = shade(col, 0.45); c.lineWidth = Math.max(0.7, wd * 0.28); c.beginPath(); c.moveTo(a[0], a[1] - wd * 0.25); c.lineTo(b[0], b[1] - wd * 0.25); c.stroke();
    this.touchS(a[0], a[1] - wd); this.touchS(b[0], b[1] + wd);
  }
  /**
   * Hip roof (ridge along the longer side) or pyramid.  o: x0,y0,x1,y1,z,rise,ov,paint,trim
   */
  roofHip(o) {
    if (this.stage < 3) return;
    const { x0, y0, x1, y1, z, rise } = o, ov = o.ov === undefined ? 4 : o.ov, trim = o.trim || '#4a3220', thick = o.thick === undefined ? 3 : o.thick;
    const W = x1 - x0, D = y1 - y0;
    const alongX = W >= D;
    const half = Math.min(W, D) / 2, slope = rise / half;
    const zE = z - ov * slope;
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    // ridge endpoints
    const rx0 = alongX ? x0 + half : xm, rx1 = alongX ? x1 - half : xm, ry0 = alongX ? ym : y0 + half, ry1 = alongX ? ym : y1 - half;
    const zr = z + rise;
    // --- front plane facing +y (SW): eave at y1+ov
    {
      const yE = y1 + ov, Lf = Math.hypot(yE - ry1, zr - zE);
      const v3 = [0, (yE - ry1) / Lf, -(zr - zE) / Lf];
      const xa = x0 - ov, w = (x1 + ov) - xa;
      const poly = [[rx0 - xa, 0], [rx1 - xa, 0], [w, Lf], [0, Lf]];
      this.roofPlane([xa, ry1, zr], [1, 0, 0], v3, w, Lf, o.paint, 'roofL', poly, o);
      this._edgeBand([xa, yE, zE], [x1 + ov, yE, zE], thick, trim, shade(trim, 0.3));
    }
    // --- right plane facing +x (SE): eave at x1+ov
    {
      const xE = x1 + ov, Lf = Math.hypot(xE - rx1, zr - zE);
      const v3 = [(xE - rx1) / Lf, 0, -(zr - zE) / Lf];
      const ya = y1 + ov, w = ya - (y0 - ov);
      const poly = [[ya - ry1, 0], [ya - ry0, 0], [w, Lf], [0, Lf]];
      this.roofPlane([rx1, ya, zr], [0, -1, 0], v3, w, Lf, o.paint, 'roofR', poly, o);
      this._edgeBand([xE, ya, zE], [xE, y0 - ov, zE], thick, trim, shade(trim, 0.3));
    }
    if (o.ridge && (rx1 - rx0 > 1 || ry1 - ry0 > 1)) this._ridge([rx0, ry0, zr], [rx1, ry1, zr], o.ridge, o.ridgeW || 3);
    // hip lines
    const c = this.c;
    c.strokeStyle = shade(trim, -0.2); c.lineWidth = 1.1; c.beginPath();
    const a = this.P(x1 + ov, y1 + ov, zE), b = this.P(rx1, ry1, zr); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    c.strokeStyle = 'rgba(255,240,210,0.25)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(a[0] - 0.6, a[1] - 0.4); c.lineTo(b[0] - 0.6, b[1] - 0.4); c.stroke();
  }
  /** lean-to / shed roof sloping toward +y (axis 'y') or +x (axis 'x').  zHigh at the back edge, zLow at the front edge (before overhang) */
  roofShed(o) {
    if (this.stage < 3) return;
    const { x0, y0, x1, y1, zHigh, zLow } = o, ov = o.ov === undefined ? 3 : o.ov, ovg = o.ovg === undefined ? 2 : o.ovg, trim = o.trim || '#4a3220', thick = o.thick || 2.6;
    if (o.slope === 'x') {
      const run = x1 - x0, k = (zHigh - zLow) / run, xE = x1 + ov, zE = zLow - ov * k, L = Math.hypot(xE - x0, zHigh - zE);
      const w = (y1 - y0) + 2 * ovg;
      this.roofPlane([x0, y1 + ovg, zHigh], [0, -1, 0], [(xE - x0) / L, 0, -(zHigh - zE) / L], w, L, o.paint, 'roofR', null, o);
      this._edgeBand([xE, y1 + ovg, zE], [xE, y0 - ovg, zE], thick, trim, shade(trim, 0.3));
      this._edgeBand([x0, y1 + ovg, zHigh], [xE, y1 + ovg, zE], thick, trim, shade(trim, 0.3));
    } else {
      const run = y1 - y0, k = (zHigh - zLow) / run, yE = y1 + ov, zE = zLow - ov * k, L = Math.hypot(yE - y0, zHigh - zE);
      const w = (x1 - x0) + 2 * ovg;
      this.roofPlane([x0 - ovg, y0, zHigh], [1, 0, 0], [0, (yE - y0) / L, -(zHigh - zE) / L], w, L, o.paint, 'roofL', null, o);
      this._edgeBand([x0 - ovg, yE, zE], [x1 + ovg, yE, zE], thick, trim, shade(trim, 0.3));
      this._edgeBand([x1 + ovg, y0, zHigh], [x1 + ovg, yE, zE], thick, trim, shade(trim, 0.3));
    }
  }

  // ------------------------------------------------------------------ lathe objects (round towers, cones, domes, barrels...)
  /** screen position of a lathe point; theta in (0,pi) is the visible front half */
  lp(cx, cy, r, th, z) { return [this.ax + cx - cy + r * SQ2 * Math.cos(th), this.ay + (cx + cy) * 0.5 + r * SQ2 * 0.5 * Math.sin(th) - z]; }
  /**
   * Surface of revolution drawn as shaded quads.  rfn(z) -> radius.  o: rows (course height), bw (block width px), pal (tone strings), mortar,
   * lum (brightness mult), stag, hi (highlight alpha), rough
   */
  lathe(cx, cy, z0, z1, rfn, o = {}) {
    const c = this.c, S = 1;
    const ch = o.ch || 8, bw = o.bw || 12;
    const palRGB = (o.pal || tones('#a59e8d', 6, 0.14)).map(rgbOf);
    const mort = o.mortar || '#4a4338';
    const lum = o.lum || 1;
    const nR = Math.max(1, Math.round((z1 - z0) / ch)), dz = (z1 - z0) / nR;
    const rnd = rng((this.seed + (this.pi++) * 104729) >>> 0);
    // silhouette underlay
    c.beginPath();
    for (let z = z0; z <= z1 + 0.01; z += 2.5) {
      const r = rfn(Math.min(z, z1)), [sx, sy] = this.lp(cx, cy, 0, 0, z);
      c.moveTo(sx + r * SQ2, sy); c.ellipse(sx, sy, r * SQ2, r * SQ2 * 0.5, 0, 0, Math.PI * 2);
    }
    { const r = rfn(z1), [sx, sy] = this.lp(cx, cy, 0, 0, z1); c.moveTo(sx + r * SQ2, sy); c.ellipse(sx, sy, r * SQ2, r * SQ2 * 0.5, 0, 0, Math.PI * 2); }
    c.fillStyle = mort; c.fill();
    { const r0 = rfn(z0), r1 = rfn(z1), [sa, ya] = this.lp(cx, cy, 0, 0, z0); const [sb, yb] = this.lp(cx, cy, 0, 0, z1); const R = Math.max(r0, r1) * SQ2; this.touchS(sa - R, yb - R * 0.5); this.touchS(sa + R, ya + r0 * SQ2 * 0.5); }
    const A = 0.66, B = 0.26, th0 = 2.6;
    for (let row = 0; row < nR; row++) {
      const za = z0 + row * dz, zb = za + dz;
      const ra = rfn(za), rb = rfn(zb), rm = (ra + rb) / 2;
      const nb = Math.max(5, Math.round(2 * Math.PI * rm / bw)), dth = 2 * Math.PI / nb;
      const off = (row & 1) && o.stag !== false ? dth * 0.5 : 0;
      const k0 = Math.floor(-off / dth) - 1, k1 = Math.ceil((Math.PI - off) / dth) + 1;
      for (let k = k0; k <= k1; k++) {
        let ta = k * dth + off, tb = ta + dth;
        if (tb <= 0 || ta >= Math.PI) continue;
        ta = Math.max(0, ta); tb = Math.min(Math.PI, tb);
        if (tb - ta < dth * 0.12) continue;
        const tm = (ta + tb) / 2;
        let b = (A + B * Math.cos(tm - th0)) * lum;
        if (o.vlight) b *= 1 + o.vlight * ((row / nR) - 0.5);
        const col = palRGB[(rnd() * palRGB.length) | 0];
        const mu = 0.30 * (dth > 0.3 ? 1 : 0.7);
        const sa = ta + (tb - ta) * 0.02, sb = tb - (tb - ta) * 0.02;
        const p0 = this.lp(cx, cy, ra, sb, za), p1 = this.lp(cx, cy, ra, sa, za), p2 = this.lp(cx, cy, rb, sa, zb), p3 = this.lp(cx, cy, rb, sb, zb);
        const pm0 = this.lp(cx, cy, ra, (sa + sb) / 2, za), pm1 = this.lp(cx, cy, rb, (sa + sb) / 2, zb);
        c.beginPath();
        c.moveTo(p0[0], p0[1] - 0.45); c.quadraticCurveTo(pm0[0], pm0[1] * 2 - (p0[1] + p1[1]) / 2 - 0.45, p1[0], p1[1] - 0.45);
        c.lineTo(p2[0], p2[1] + 0.2); c.quadraticCurveTo(pm1[0], pm1[1] * 2 - (p2[1] + p3[1]) / 2 + 0.2, p3[0], p3[1] + 0.2);
        c.closePath();
        c.fillStyle = `rgb(${Math.min(255, col[0] * b) | 0},${Math.min(255, col[1] * b) | 0},${Math.min(255, col[2] * (0.55 + 0.45 * b) * (b > 0.7 ? 1 : 1)) | 0})`;
        c.fill();
        if (o.hi) {                                          // top bevel highlight
          c.strokeStyle = `rgba(255,248,230,${o.hi * Math.min(1, b + 0.2)})`; c.lineWidth = 0.7;
          c.beginPath(); c.moveTo(p3[0], p3[1] + 0.2); c.quadraticCurveTo(pm1[0], pm1[1] * 2 - (p2[1] + p3[1]) / 2 + 0.2, p2[0], p2[1] + 0.2); c.stroke();
        }
      }
    }
    // soft vertical shading (ambient occlusion at the base)
    if (o.ao !== 0) {
      const r = rfn(z0), [sx, sy] = this.lp(cx, cy, 0, 0, z0);
      c.save();
      c.beginPath(); c.rect(sx - r * SQ2 - 1, sy - 12, r * SQ2 * 2 + 2, 12 + r * SQ2 * 0.5 + 1); c.clip();
      const g = c.createLinearGradient(0, sy - 9, 0, sy + r * SQ2 * 0.5);
      g.addColorStop(0, 'rgba(16,8,26,0)'); g.addColorStop(1, 'rgba(16,8,26,0.32)');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(sx, sy, r * SQ2, r * SQ2 * 0.5, 0, 0, Math.PI); c.rect(sx - r * SQ2, sy - 9, r * SQ2 * 2, 9); c.fill();
      c.restore();
    }
  }
  /** flat/ringed top of a cylinder (visible ellipse) with a painter-free colour */
  latheTop(cx, cy, r, z, fill, o = {}) {
    const c = this.c, [sx, sy] = this.lp(cx, cy, 0, 0, z);
    c.beginPath(); c.ellipse(sx, sy, r * SQ2, r * SQ2 * 0.5, 0, 0, Math.PI * 2);
    if (typeof fill === 'function') fill(c, sx, sy, r); else { c.fillStyle = fill; c.fill(); }
    if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.lw || 1; c.stroke(); }
    this.touchS(sx - r * SQ2, sy - r * SQ2 * 0.5); this.touchS(sx + r * SQ2, sy + r * SQ2 * 0.5);
  }
  /** decal (window, door, banner...) on a lathe surface at angle theta (visible 0..pi), top of decal at height zTop, width w px along the surface */
  latheDecal(cx, cy, r, th, zTop, w, h, paint, o = {}) {
    const c = this.c, [sx, sy] = this.lp(cx, cy, r, th, zTop), [axx] = this.lp(cx, cy, 0, 0, zTop), R = r * SQ2;
    const ux = SQ2 * Math.sin(th), uy = -SQ2 * 0.5 * Math.cos(th);
    c.save();
    c.beginPath(); c.rect(axx - R + 0.6, sy - 12, 2 * R - 1.2, h + 40); c.clip();       // stay inside the tower silhouette
    c.transform(ux, uy, 0, 1, sx - ux * w / 2, sy - uy * w / 2);
    c.beginPath(); c.rect(-3, -3, w + 6, h + 6); c.clip();
    paint(c, w, h);
    const b = Math.min(1, 0.66 + 0.26 * Math.cos(th - 2.6) + 0.1);
    c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(18,10,30,${((1 - b) * 0.95).toFixed(3)})`; c.fillRect(-3, -3, w + 6, h + 6);
    c.restore();
  }
  /** crenellated rim on a round tower: ring of merlons around radius r (outer), thickness t, height ph */
  roundBattlement(cx, cy, r, z, o = {}) {
    if (!this.want(o.tag || 'wall') && this.stage < 3) return;
    const c = this.c, t = o.t || 3.2, ph = o.ph || 7, nm = o.n || Math.max(8, Math.round(r * 0.75));
    const dth = 2 * Math.PI / nm, fillF = 0.58;
    const pal = (o.pal || tones('#a59e8d', 5, 0.12)).map(rgbOf);
    const rnd = rng((this.seed + (this.pi++) * 31337) >>> 0);
    const ri = r - t;
    // floor ring
    this.latheTop(cx, cy, r - 0.3, z, o.floor || '#6e675a');
    this.latheTop(cx, cy, ri, z + 0.3, o.inside || '#4d473d');
    // low connecting wall (crenel bottoms)
    const lowH = ph * 0.35;
    const order = [];
    for (let k = 0; k < nm; k++) order.push(k);
    // back half first (sin(theta) < 0 means behind), so draw by increasing sin(theta)
    order.sort((a, b) => Math.sin((a + 0.5) * dth) - Math.sin((b + 0.5) * dth));
    const drawArcBand = (th0, th1, rr, za, zb, shadeB) => {
      const a0 = this.lp(cx, cy, rr, th0, za), a1 = this.lp(cx, cy, rr, th1, za), b1 = this.lp(cx, cy, rr, th1, zb), b0 = this.lp(cx, cy, rr, th0, zb);
      const am = this.lp(cx, cy, rr, (th0 + th1) / 2, za), bm = this.lp(cx, cy, rr, (th0 + th1) / 2, zb);
      c.beginPath(); c.moveTo(a0[0], a0[1]); c.quadraticCurveTo(am[0], am[1] * 2 - (a0[1] + a1[1]) / 2, a1[0], a1[1]);
      c.lineTo(b1[0], b1[1]); c.quadraticCurveTo(bm[0], bm[1] * 2 - (b0[1] + b1[1]) / 2, b0[0], b0[1]); c.closePath();
      const col = pal[(rnd() * pal.length) | 0];
      c.fillStyle = rgbMul(col, shadeB); c.fill();
      c.strokeStyle = 'rgba(20,12,6,0.45)'; c.lineWidth = 0.6; c.stroke();
    };
    const lum = (th) => 0.66 + 0.26 * Math.cos(th - 2.6);
    // inner faces of the back wall (visible), then the merlons
    // low wall ring: back half inner side
    for (let k = 0; k < nm * 2; k++) {
      const th0 = k * dth / 2, th1 = (k + 1) * dth / 2, tm = (th0 + th1) / 2;
      if (Math.sin(tm) < 0) drawArcBand(th0, th1, ri, z, z + lowH, 0.55);
    }
    for (const k of order) {
      const th0 = k * dth + dth * (1 - fillF) / 2, th1 = th0 + dth * fillF, tm = (th0 + th1) / 2;
      const front = Math.sin(tm) >= 0;
      const rr = front ? r : ri;
      drawArcBand(th0, th1, rr, z, z + ph, front ? lum(tm) : 0.5 + 0.15 * lum(tm));
      // top cap
      const t0 = this.lp(cx, cy, r, th0, z + ph), t1 = this.lp(cx, cy, r, th1, z + ph), t2 = this.lp(cx, cy, ri, th1, z + ph), t3 = this.lp(cx, cy, ri, th0, z + ph);
      c.beginPath(); c.moveTo(t0[0], t0[1]); c.lineTo(t1[0], t1[1]); c.lineTo(t2[0], t2[1]); c.lineTo(t3[0], t3[1]); c.closePath();
      c.fillStyle = rgbMul(pal[2], 1.05); c.fill(); c.strokeStyle = 'rgba(20,12,6,0.35)'; c.lineWidth = 0.5; c.stroke();
    }
    // low wall front half (outer face)
    for (let k = 0; k < nm * 2; k++) {
      const th0 = k * dth / 2, th1 = (k + 1) * dth / 2, tm = (th0 + th1) / 2;
      if (Math.sin(tm) >= 0) drawArcBand(th0, th1, r, z, z + lowH, lum(tm));
    }
    const [sx, sy] = this.lp(cx, cy, 0, 0, z + ph); this.touchS(sx - r * SQ2, sy - r * SQ2 * 0.5 - 1); this.touchS(sx + r * SQ2, sy);
  }
  /** cone / pyramid-like roof as shaded quads (tiles).  base radius r at z0, apex z1 */
  cone(cx, cy, r, z0, z1, o = {}) {
    const tipR = o.tip === undefined ? 0.6 : o.tip;
    this.lathe(cx, cy, z0, z1, (z) => tipR + (r - tipR) * (1 - (z - z0) / (z1 - z0)) ** (o.curve || 1), Object.assign({ ch: 5, bw: 8, lum: 1.06, ao: 0 }, o));
  }
  /** dome / onion: radius profile function of normalised height t in 0..1 */
  dome(cx, cy, r, z0, z1, prof, o = {}) {
    this.lathe(cx, cy, z0, z1, (z) => Math.max(0.5, r * prof((z - z0) / (z1 - z0))), Object.assign({ ch: 4.5, bw: 7.5, ao: 0, lum: 1.08, hi: 0.22 }, o));
  }

  /**
   * Crenellated parapet on top of a rectangular block: walkway floor + low wall ring + merlons (drawn as batched flat polygons: cheap).
   * o: ph (merlon height), t (parapet thickness), m (merlon length), gap, base (stone colour), floor (floor painter), sides ('nwse' letters present)
   */
  battlement(x0, y0, x1, y1, z, o = {}) {
    if (this.stage < 3 && !(o.always)) { if (z > this.zcut + 0.01) return; }
    const ph = o.ph || 7, t = o.t || 3.6, m = o.m || 7, gap = o.gap || 5, lo = Math.min(3, ph * 0.4), sides = o.sides || 'nwse';
    const base = rgbOf(o.base || '#a8a292');
    const cols = [0, 1].map((k) => ({ L: rgbMul(base, 0.9 + k * 0.05), R: rgbMul(base, 0.62 + k * 0.04), T: rgbMul(base, 1.08 + k * 0.05) }));
    if (o.floor !== false) this.plane([x0, y0, z], [1, 0, 0], [0, 1, 0], x1 - x0, y1 - y0, o.floor || ((c, w, h, r) => { c.fillStyle = '#7b7468'; c.fillRect(-1, -1, w + 2, h + 2); c.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 6; i++) c.fillRect(r() * w, r() * h, 5, 0.8); }), { light: 'top', ao: 0, hl: false });
    const runs = [];
    const mk = (alongX, a0, a1, fixed) => {
      const len = a1 - a0, n = Math.max(1, Math.floor((len + gap) / (m + gap))), used = n * m + (n - 1) * gap, st = a0 + (len - used) / 2;
      const boxes = [[a0, a1, lo]];
      for (let i = 0; i < n; i++) boxes.push([st + i * (m + gap), st + i * (m + gap) + m, ph]);
      runs.push({ alongX, fixed, boxes });
    };
    if (sides.includes('n')) mk(true, x0, x1, y0);
    if (sides.includes('w')) mk(false, y0, y1, x0);
    if (sides.includes('s')) mk(true, x0, x1, y1 - t);
    if (sides.includes('e')) mk(false, y0, y1, x1 - t);
    const c = this.c;
    for (const run of runs) {
      for (let pass = 0; pass < 2; pass++) {
        const cl = cols[pass], L = new Path2D(), R = new Path2D(), T = new Path2D(), E = new Path2D();
        let any = false;
        run.boxes.forEach(([a, b, h], idx) => {
          if ((idx & 1) !== pass && idx > 0) return;
          if (idx === 0 && pass === 1) return;
          const bx0 = run.alongX ? a : run.fixed, bx1 = run.alongX ? b : run.fixed + t, by0 = run.alongX ? run.fixed : a, by1 = run.alongX ? run.fixed + t : b;
          const p = (x, y, zz) => this.P(x, y, zz);
          const a0 = p(bx0, by1, z), a1 = p(bx1, by1, z), a2 = p(bx1, by1, z + h), a3 = p(bx0, by1, z + h);          // left face (y = by1)
          const r0 = p(bx1, by0, z), r2 = p(bx1, by0, z + h);                                                       // right face (x = bx1): a1, r0, r2, a2
          const t0 = p(bx0, by0, z + h);                                                                            // top: t0, r2, a2, a3
          L.moveTo(a0[0], a0[1]); L.lineTo(a1[0], a1[1]); L.lineTo(a2[0], a2[1]); L.lineTo(a3[0], a3[1]); L.closePath();
          R.moveTo(a1[0], a1[1]); R.lineTo(r0[0], r0[1]); R.lineTo(r2[0], r2[1]); R.lineTo(a2[0], a2[1]); R.closePath();
          T.moveTo(t0[0], t0[1]); T.lineTo(r2[0], r2[1]); T.lineTo(a2[0], a2[1]); T.lineTo(a3[0], a3[1]); T.closePath();
          E.moveTo(a3[0], a3[1]); E.lineTo(a2[0], a2[1]); E.lineTo(r2[0], r2[1]); E.moveTo(a2[0], a2[1]); E.lineTo(a1[0], a1[1]);
          any = true;
          this.touchS(t0[0], t0[1]); this.touchS(a1[0], a1[1]);
        });
        if (!any) continue;
        c.fillStyle = cl.R; c.fill(R); c.fillStyle = cl.L; c.fill(L); c.fillStyle = cl.T; c.fill(T);
        c.strokeStyle = 'rgba(24,16,10,0.5)'; c.lineWidth = 0.6; c.stroke(L); c.stroke(R); c.stroke(T);
      }
    }
    this.touch(x0, y0, z + ph); this.touch(x1, y1, z);
  }
  /** vertical round column (screen-space cylinder).  r in world units */
  column(x, y, z0, z1, r, col = '#c9c2ae', o = {}) {
    if (!this.want(o.tag || 'wall')) return;
    const c = this.c, [sx, sy] = this.P(x, y, 0), rx = r * SQ2, ry = r * SQ2 * 0.5;
    let top = z1; if ((o.tag || 'wall') === 'wall' && !o.noCut) { if (z0 >= this.zcut) return; top = Math.min(z1, this.zcut); }
    const gr = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
    gr.addColorStop(0, shade(col, 0.18)); gr.addColorStop(0.3, col); gr.addColorStop(0.72, shade(col, -0.22)); gr.addColorStop(1, shade(col, -0.42));
    c.fillStyle = gr; c.beginPath(); c.moveTo(sx - rx, sy - top); c.lineTo(sx - rx, sy - z0); c.ellipse(sx, sy - z0, rx, ry, 0, Math.PI, 0, true); c.lineTo(sx + rx, sy - top); c.ellipse(sx, sy - top, rx, ry, 0, 0, Math.PI, false); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(sx, sy - top, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = shade(col, 0.12); c.fill();
    c.strokeStyle = 'rgba(25,16,8,0.45)'; c.lineWidth = 0.7; c.stroke();
    this.touchS(sx - rx, sy - top - ry); this.touchS(sx + rx, sy - z0 + ry);
  }
  // ------------------------------------------------------------------ small things
  /** pole with a waving team flag.  (x,y,z) base in world coords, poleH px.  o: w, h, shape ('swallow'|'rect'|'pennant'), emblem */
  flag(x, y, z, poleH, o = {}) {
    if (o.tag !== 'always' && !this.want(o.tag || 'prop')) return;
    const c = this.c, [bx, by] = this.P(x, y, z), top = by - poleH, tc = o.tc || this.tc;
    const fw = o.w || 22, fh = o.h || 13, amp = o.amp === undefined ? 1.8 : o.amp;
    c.save();
    c.strokeStyle = '#2a1c10'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, top); c.stroke();
    c.strokeStyle = '#8a6a40'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx - 0.3, by); c.lineTo(bx - 0.3, top); c.stroke();
    c.fillStyle = '#e8c860'; c.beginPath(); c.arc(bx, top - 1.2, 1.9, 0, 7); c.fill();
    const y0 = top + 1.5, sw = o.shape === 'pennant' ? 0 : 1;
    const N = 10;
    const top0 = [], bot0 = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, wv = Math.sin(t * 5.0 - 0.4) * amp * (0.3 + t);
      const hh = o.shape === 'pennant' ? fh * (1 - t) : fh;
      top0.push([bx + 1 + t * fw, y0 + wv * 0.9 + t * 1.4]);
      bot0.push([bx + 1 + t * fw, y0 + hh + wv + t * 1.4]);
    }
    c.beginPath(); c.moveTo(top0[0][0], top0[0][1]);
    for (let i = 1; i <= N; i++) c.lineTo(top0[i][0], top0[i][1]);
    if (o.shape === 'swallow') { const e = bot0[N]; c.lineTo(e[0], e[1]); c.lineTo(e[0] - fw * 0.16, (e[1] + top0[N][1]) / 2 + 1); c.lineTo(e[0], top0[N][1]); }
    for (let i = N; i >= 0; i--) c.lineTo(bot0[i][0], bot0[i][1]);
    c.closePath();
    const g = c.createLinearGradient(0, y0, 0, y0 + fh + 3); g.addColorStop(0, tc.light); g.addColorStop(0.35, tc.main); g.addColorStop(1, tc.dark);
    c.fillStyle = g; c.fill(); c.strokeStyle = tc.dark; c.lineWidth = 0.8; c.stroke();
    // pleats
    c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 0.8; c.beginPath();
    for (let i = 2; i < N; i += 3) { c.moveTo(top0[i][0], top0[i][1] + 1); c.lineTo(bot0[i][0], bot0[i][1] - 1); }
    c.stroke();
    if (o.emblem !== false && fh >= 9 && o.shape !== 'pennant') {
      const mx = (top0[3][0] + top0[3][0]) / 2 + fw * 0.12, my = (top0[3][1] + bot0[3][1]) / 2;
      c.fillStyle = 'rgba(250,244,226,0.92)'; c.beginPath(); c.arc(mx + fw * 0.12, my, fh * 0.2, 0, 7); c.fill();
      c.fillStyle = tc.main; c.beginPath(); c.arc(mx + fw * 0.12, my, fh * 0.08, 0, 7); c.fill();
    }
    c.restore();
    this.touchS(bx - 2, top - 4); this.touchS(bx + fw + 3, y0 + fh + amp * 3);
  }
  /** pennant on a short staff (roof tips etc.) */
  pennant(x, y, z, len, o = {}) { this.flag(x, y, z, len, Object.assign({ shape: 'pennant', w: 15, h: 7, amp: 1.2, emblem: false }, o)); }

  // ------------------------------------------------------------------ ordering helper
  /** items: [{x0,y0,x1,y1,z0?,fn}] drawn back-to-front using separating-plane tests (falls back to x+y) */
  sorted(items) {
    const n = items.length, before = (a, b) => (a.x1 <= b.x0 + 0.01 || a.y1 <= b.y0 + 0.01);
    const done = new Array(n).fill(false), out = [];
    const key = (a) => (a.x0 + a.x1 + a.y0 + a.y1) * 0.5;
    for (let iter = 0; iter < n; iter++) {
      let pick = -1;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        let ok = true;
        for (let j = 0; j < n; j++) {
          if (j === i || done[j]) continue;
          // j must be drawn before i if j is behind i
          if (before(items[j], items[i]) && !before(items[i], items[j])) { ok = false; break; }
        }
        if (ok && (pick < 0 || key(items[i]) < key(items[pick]))) pick = i;
      }
      if (pick < 0) { for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || key(items[i]) < key(items[pick]))) pick = i; }
      done[pick] = true; out.push(items[pick]);
    }
    for (const it of out) it.fn();
  }

  // ------------------------------------------------------------------ finishing
  /** mark a 3D box where no outline should be drawn (cut ends of wall arms that continue in the neighbouring tile) */
  cut(x0, y0, z0, x1, y1, z1) {
    const pts = [];
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(this.P(x, y, z));
    // convex hull (monotone chain)
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop();
    this.cuts.push(lo.concat(up));
  }
  _outlineWithCuts(out, x0, y0, S) {
    const canvas = out.canvas, w = canvas.width, h = canvas.height;
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    const t = tmp.getContext('2d'); t.drawImage(canvas, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = 'rgba(22,13,6,0.92)'; t.fillRect(0, 0, w, h);
    const ol = document.createElement('canvas'); ol.width = w; ol.height = h;
    const o = ol.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) o.drawImage(tmp, dx * S, dy * S);
    o.globalCompositeOperation = 'destination-out'; o.fillStyle = '#000';
    for (const poly of this.cuts) {
      o.beginPath(); poly.forEach((p, i) => { const px = (p[0] - x0) * S, py = (p[1] - y0) * S; i ? o.lineTo(px, py) : o.moveTo(px, py); }); o.closePath(); o.fill();
    }
    const c = canvas.getContext('2d'); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-over'; c.drawImage(ol, 0, 0); c.restore();
  }
  _under(ctx, x0, y0, S) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    const OFF = 4000;
    for (const sh of this.shadows) {
      ctx.save();
      ctx.shadowColor = `rgba(18,10,30,${sh.a})`; ctx.shadowBlur = sh.blur * S; ctx.shadowOffsetX = OFF * S; ctx.shadowOffsetY = 0;
      ctx.translate(-x0 - OFF, -y0);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(sh.pts[0][0], sh.pts[0][1]);
      for (let i = 1; i < sh.pts.length; i++) ctx.lineTo(sh.pts[i][0], sh.pts[i][1]);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    for (const g of this.grounds) {
      ctx.save(); ctx.translate(g.sx - x0, g.sy - y0); ctx.scale(1, g.ky);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, g.R);
      gr.addColorStop(0, rgba(g.color, g.alpha)); gr.addColorStop(0.65, rgba(g.color, g.alpha * 0.6)); gr.addColorStop(1, rgba(g.color, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, g.R, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  /** crop to the drawn bounds, add the outline and return { surf, ax, ay, icon: {x,y,w,h} (structure bounds in the cropped canvas) } */
  finish() {
    const S = getSpriteScale(), b = this.bbA;
    const m = 3;
    let x0 = Math.floor(b.x0) - m, y0 = Math.floor(b.y0) - m, x1 = Math.ceil(b.x1) + m, y1 = Math.ceil(b.y1) + m;
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.W, x1); y1 = Math.min(this.H, y1);
    const w = x1 - x0, h = y1 - y0;
    const out = makeCanvas(w, h);
    out.ctx.drawImage(this.sc.surf.canvas, x0 * S, y0 * S, w * S, h * S, 0, 0, w, h);
    if (this.cuts.length) this._outlineWithCuts(out, x0, y0, S); else addOutline(out);
    this._under(out.ctx, x0, y0, S);
    for (const p of this.posts) { out.ctx.save(); out.ctx.translate(-x0, -y0); p(out.ctx); out.ctx.restore(); }
    const s = this.bb;
    return { surf: out, ax: this.ax - x0, ay: this.ay - y0, icon: { x: Math.max(0, s.x0 - x0 - 2), y: Math.max(0, s.y0 - y0 - 2), w: Math.min(w, s.x1 - s.x0 + 4), h: Math.min(h, s.y1 - s.y0 + 4) } };
  }
}
