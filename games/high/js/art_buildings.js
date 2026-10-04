'use strict';
// ---------------------------------------------------------------------------
// Procedural isometric building sprites
// ---------------------------------------------------------------------------
class Rig {
  constructor(size, height, w, h) {
    this.s = size;
    this.W = w || Math.ceil(size * 64 + 24);
    this.H = h || Math.ceil(size * 32 + height + 24);
    this.cv = mkCanvas(this.W * SPR_SS, this.H * SPR_SS);
    this.c = this.cv.getContext('2d');
    this.c.scale(SPR_SS, SPR_SS);
    this.ox = this.W / 2;
    this.oy = this.H - size * 32 - 10;
  }
  P(x, y, z = 0) { return [this.ox + (x - y) * 32, this.oy + (x + y) * 16 - z]; }
  poly(pts, fill, stroke, lw = 1) {
    const c = this.c;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
  }
  // textured quad: q = [bl, br, tr, tl] in 3D coords [[x,y,z]...]
  quad(q, base, tex, o = {}) {
    const c = this.c;
    const s = q.map((p) => this.P(p[0], p[1], p[2]));
    c.save();
    c.beginPath(); s.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
    c.fillStyle = base; c.fill();
    c.clip();
    const bl = s[0], br = s[1], tl = s[3];
    const U = [br[0] - bl[0], br[1] - bl[1]], V = [tl[0] - bl[0], tl[1] - bl[1]];
    const Pt = (u, v) => [bl[0] + U[0] * u + V[0] * v, bl[1] + U[1] * u + V[1] * v];
    const wpx = Math.hypot(U[0], U[1]), hpx = Math.hypot(V[0], V[1]);
    const line = (a, b, col, lw = 1) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); };
    const dk = o.dark || 'rgba(0,0,0,0.28)', lt = o.light || 'rgba(255,255,255,0.14)';
    if (tex === 'stone') {
      const rows = Math.max(1, Math.round(hpx / 7));
      for (let r = 0; r <= rows; r++) {
        const v = r / rows;
        line(Pt(0, v), Pt(1, v), dk, 0.9);
        if (r < rows) {
          const n = Math.max(1, Math.round(wpx / 13)), off = (r % 2) * 0.5 / n;
          for (let k = 0; k <= n; k++) { const u = k / n + off; if (u > 0 && u < 1) line(Pt(u, v), Pt(u, v + 1 / rows), dk, 0.9); }
          line(Pt(0, v + 0.5 / rows * 0.2), Pt(1, v + 0.5 / rows * 0.2), lt, 0.7);
        }
      }
    } else if (tex === 'plank') {
      const n = Math.max(2, Math.round(wpx / 6));
      for (let k = 1; k < n; k++) { line(Pt(k / n, 0), Pt(k / n, 1), dk, 0.9); line(Pt(k / n + 0.5 / n * 0.4, 0), Pt(k / n + 0.5 / n * 0.4, 1), lt, 0.6); }
    } else if (tex === 'log') {
      const rows = Math.max(2, Math.round(hpx / 6));
      for (let r = 1; r < rows; r++) { line(Pt(0, r / rows), Pt(1, r / rows), dk, 1.2); line(Pt(0, r / rows + 0.08 / rows), Pt(1, r / rows + 0.08 / rows), lt, 0.8); }
    } else if (tex === 'timber') {
      const beam = o.beam || '#5e4024';
      const n = Math.max(2, Math.round(wpx / 22));
      c.strokeStyle = beam; c.lineWidth = 2.2;
      for (let k = 0; k <= n; k++) { const a = Pt(k / n, 0), b = Pt(k / n, 1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      for (const v of [0, 0.5, 1]) { const a = Pt(0, v), b = Pt(1, v); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      c.lineWidth = 1.6;
      for (let k = 0; k < n; k++) { const a = Pt(k / n, 0), b = Pt((k + 1) / n, 0.5); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    } else if (tex === 'tile') {
      const rows = Math.max(2, Math.round(hpx / 5));
      for (let r = 0; r < rows; r++) {
        const v = r / rows;
        line(Pt(0, v), Pt(1, v), dk, 1);
        line(Pt(0, v + 0.35 / rows), Pt(1, v + 0.35 / rows), lt, 0.8);
        const n = Math.max(2, Math.round(wpx / 8)), off = (r % 2) * 0.5 / n;
        for (let k = 0; k <= n; k++) { const u = k / n + off; if (u > 0 && u < 1) line(Pt(u, v), Pt(u, v + 1 / rows), 'rgba(0,0,0,0.16)', 0.8); }
      }
    } else if (tex === 'thatch') {
      const n = Math.max(3, Math.round(wpx / 3.2));
      for (let k = 0; k <= n; k++) line(Pt(k / n, 0), Pt(k / n + 0.01, 1), k % 2 ? dk : lt, 0.8);
      const rows = Math.max(2, Math.round(hpx / 8));
      for (let r = 1; r < rows; r++) line(Pt(0, r / rows), Pt(1, r / rows), 'rgba(60,40,10,0.35)', 1.3);
    } else if (tex === 'plaster') {
      for (let k = 0; k < 14; k++) { const p = Pt(((k * 53) % 97) / 97, ((k * 31) % 89) / 89); c.fillStyle = 'rgba(120,100,70,0.12)'; c.fillRect(p[0], p[1], 2, 1.4); }
    }
    c.restore();
    c.strokeStyle = o.edge || 'rgba(20,10,0,0.55)'; c.lineWidth = 1; c.lineJoin = 'round';
    c.beginPath(); s.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.stroke();
  }
  // box with textured faces. m = {wall, tex, top}
  prism(x0, y0, x1, y1, z0, z1, m) {
    const wall = m.wall;
    const right = m.rightColor || shade(wall, -0.24), left = m.leftColor || shade(wall, -0.02), top = m.top || shade(wall, 0.18);
    // right face (x = x1): bl=(x1,y1) br=(x1,y0)
    this.quad([[x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1]], right, m.tex, m);
    // left face (y = y1): bl=(x0,y1) br=(x1,y1)
    this.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], left, m.tex, m);
    if (m.top !== false) this.poly([this.P(x0, y0, z1), this.P(x1, y0, z1), this.P(x1, y1, z1), this.P(x0, y1, z1)], top, 'rgba(20,10,0,0.5)');
  }
  // gable roof; axis 'x' means ridge parallel to x
  gable(x0, y0, x1, y1, z0, z1, axis, r) {
    const ox = r.over || 0.12;
    const A = { x0: x0 - ox, x1: x1 + ox, y0: y0 - ox, y1: y1 + ox };
    const col = r.color, dkc = r.dark || shade(col, -0.22);
    if (axis === 'x') {
      const ym = (y0 + y1) / 2;
      // gable end triangle on x = x1
      if (r.gableWall) this.poly([this.P(x1, y0, z0), this.P(x1, y1, z0), this.P(x1, ym, z1 - 1)], r.gableWall, 'rgba(20,10,0,0.5)');
      // right-side hidden slope omitted; draw front (facing +y) slope
      this.quad([[A.x0, A.y1, z0 - 3], [A.x1, A.y1, z0 - 3], [A.x1, ym, z1], [A.x0, ym, z1]], col, r.tex, r);
      // thin right slope sliver to give volume at gable end
      this.poly([this.P(A.x1, A.y1, z0 - 3), this.P(A.x1, ym, z1), this.P(A.x1, ym, z1 - 3), this.P(A.x1, A.y1, z0 - 6)], dkc);
      this.c.strokeStyle = 'rgba(0,0,0,0.35)'; this.c.lineWidth = 1.2; this.c.beginPath();
      const a = this.P(A.x0, ym, z1), b = this.P(A.x1, ym, z1); this.c.moveTo(a[0], a[1]); this.c.lineTo(b[0], b[1]); this.c.stroke();
    } else {
      const xm = (x0 + x1) / 2;
      if (r.gableWall) this.poly([this.P(x0, y1, z0), this.P(x1, y1, z0), this.P(xm, y1, z1 - 1)], r.gableWall, 'rgba(20,10,0,0.5)');
      this.quad([[A.x1, A.y1, z0 - 3], [A.x1, A.y0, z0 - 3], [xm, A.y0, z1], [xm, A.y1, z1]], dkc, r.tex, Object.assign({}, r, { dark: 'rgba(0,0,0,0.3)' }));
      this.poly([this.P(A.x0, A.y1, z0 - 3), this.P(A.x1, A.y1, z0 - 3), this.P(A.x1, A.y1, z0 - 6), this.P(A.x0, A.y1, z0 - 6)], shade(col, -0.35));
      this.c.strokeStyle = 'rgba(0,0,0,0.35)'; this.c.lineWidth = 1.2; this.c.beginPath();
      const a = this.P(xm, A.y0, z1), b = this.P(xm, A.y1, z1); this.c.moveTo(a[0], a[1]); this.c.lineTo(b[0], b[1]); this.c.stroke();
    }
  }
  hip(x0, y0, x1, y1, z0, z1, r) {
    const ox = r.over || 0.1;
    const X0 = x0 - ox, X1 = x1 + ox, Y0 = y0 - ox, Y1 = y1 + ox, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    const col = r.color, dkc = r.dark || shade(col, -0.25);
    // right slope (facing +x)
    this.quad([[X1, Y1, z0], [X1, Y0, z0], [xm, ym, z1], [xm, ym, z1]], dkc, r.tex, Object.assign({}, r, { dark: 'rgba(0,0,0,0.3)' }));
    // left slope (facing +y)
    this.quad([[X0, Y1, z0], [X1, Y1, z0], [xm, ym, z1], [xm, ym, z1]], col, r.tex, r);
  }
  crenel(x0, y0, x1, y1, z, h, m) {
    const teeth = [];
    const step = 0.34, t = 0.17;
    for (let x = x0; x < x1 - 0.01; x += step) { teeth.push([x, y0, x + t, y0 + 0.14]); teeth.push([x, y1 - 0.14, x + t, y1]); }
    for (let y = y0 + step; y < y1 - 0.2; y += step) { teeth.push([x0, y, x0 + 0.14, y + t]); teeth.push([x1 - 0.14, y, x1, y + t]); }
    teeth.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const q of teeth) this.prism(q[0], q[1], Math.min(q[2], x1), Math.min(q[3], y1), z, z + h, { wall: m.wall, tex: m.tex === 'stone' ? null : m.tex });
  }
  door(face, u0, u1, z0, z1, other, color = '#2a1a0e', arch = true) {
    // face: 'L' = y=other plane (u along x), 'R' = x=other plane (u along y, decreasing screen-x as y increases)
    const pts = [];
    const f = (u, z) => (face === 'L' ? this.P(u, other, z) : this.P(other, u, z));
    const mid = (u0 + u1) / 2;
    pts.push(f(u0, z0), f(u1, z0), f(u1, z1 - (arch ? 4 : 0)));
    if (arch) { pts.push(f((u1 + mid) / 2, z1 - 0.8), f(mid, z1), f((u0 + mid) / 2, z1 - 0.8)); }
    pts.push(f(u0, z1 - (arch ? 4 : 0)));
    this.poly(pts, color, 'rgba(0,0,0,0.6)');
    // frame highlight
    this.c.strokeStyle = 'rgba(255,230,180,0.25)'; this.c.lineWidth = 1;
    this.c.beginPath(); const a = f(u0, z0), b = f(u0, z1 - 4); this.c.moveTo(a[0], a[1]); this.c.lineTo(b[0], b[1]); this.c.stroke();
  }
  win(face, u, z, other, w = 0.22, h = 9, color = '#1c2733') {
    const f = (uu, zz) => (face === 'L' ? this.P(uu, other, zz) : this.P(other, uu, zz));
    this.poly([f(u - w / 2, z), f(u + w / 2, z), f(u + w / 2, z + h), f(u - w / 2, z + h)], color, 'rgba(90,60,30,0.9)');
    const m = f(u, z + h * 0.55);
    this.c.strokeStyle = 'rgba(200,180,140,0.5)'; this.c.lineWidth = 0.8; this.c.beginPath();
    const a = f(u, z), b = f(u, z + h); this.c.moveTo(a[0], a[1]); this.c.lineTo(b[0], b[1]); this.c.stroke();
  }
  flag(x, y, z, h, col, w = 14) {
    const c = this.c; const a = this.P(x, y, z), b = this.P(x, y, z + h);
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(b[0], b[1]); c.quadraticCurveTo(b[0] + w * 0.5, b[1] + 1, b[0] + w, b[1] + 3);
    c.lineTo(b[0] + w * 0.8, b[1] + 8); c.quadraticCurveTo(b[0] + w * 0.4, b[1] + 7, b[0], b[1] + 11); c.closePath(); c.fill(); c.stroke();
  }
  banner(u, z0, z1, y, col, w = 0.16) {
    // hanging banner on the left (y=const) face
    const c = this.c;
    const tl = this.P(u - w, y, z1), tr = this.P(u + w, y, z1), br = this.P(u + w, y, z0 + 5), bl = this.P(u - w, y, z0 + 5), tip = this.P(u, y, z0);
    c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(tl[0], tl[1]); c.lineTo(tr[0], tr[1]); c.lineTo(br[0], br[1]); c.lineTo(tip[0], tip[1] + 0.5); c.lineTo(bl[0], bl[1]); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#d8c070'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(tl[0] - 1, tl[1]); c.lineTo(tr[0] + 1, tr[1]); c.stroke();
  }
  shadow(x0, y0, x1, y1, len = 0.5) {
    // cast shadow to the lower-left... simple offset polygon beneath building
    const c = this.c;
    this.poly([this.P(x0, y0), this.P(x1, y0), this.P(x1 + len, y1 + len), this.P(x0 + len, y1 + len), this.P(x0 - 0.2, y1 + 0.3)], 'rgba(10,20,5,0.28)');
  }
  cone(x, y, z0, z1, rad, col) {
    const c = this.c; const b = this.P(x, y, z0), t = this.P(x, y, z1);
    const rx = rad * 32 * 1.0;
    const g = c.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0);
    g.addColorStop(0, shade(col, 0.12)); g.addColorStop(0.6, col); g.addColorStop(1, shade(col, -0.35));
    c.fillStyle = g; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(b[0] - rx, b[1]); c.lineTo(t[0], t[1]); c.lineTo(b[0] + rx, b[1]);
    c.ellipse(b[0], b[1], rx, rx * 0.5, 0, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
  }
  cyl(x, y, z0, z1, rad, col, tex) {
    const c = this.c; const b = this.P(x, y, z0), t = this.P(x, y, z1);
    const rx = rad * 32;
    const g = c.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0);
    g.addColorStop(0, shade(col, 0.15)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.38));
    c.fillStyle = g; c.strokeStyle = 'rgba(20,10,0,0.55)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(b[0] - rx, b[1]); c.lineTo(t[0] - rx, t[1]); c.ellipse(t[0], t[1], rx, rx * 0.5, 0, Math.PI, 0, true);
    c.lineTo(b[0] + rx, b[1]); c.ellipse(b[0], b[1], rx, rx * 0.5, 0, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
    if (tex === 'stone') {
      c.save(); c.clip();
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 0.9;
      for (let z = z0 + 6; z < z1; z += 7) { const p = this.P(x, y, z); c.beginPath(); c.ellipse(p[0], p[1], rx, rx * 0.5, 0, 0, Math.PI); c.stroke(); }
      c.restore();
    }
    // top disk
    c.fillStyle = shade(col, 0.2); c.beginPath(); c.ellipse(t[0], t[1], rx, rx * 0.5, 0, 0, TAU); c.fill(); c.stroke();
  }
}

const STYLES = [
  { wall: '#a67c4e', tex: 'plank', roof: '#cdb064', roofTex: 'thatch', trim: '#6a4a2a', base: '#76706a', stone: false },
  { wall: '#e4d6b0', tex: 'timber', roof: '#bb5640', roofTex: 'tile', trim: '#6b4a2a', base: '#8a8478', stone: false },
  { wall: '#bcb5a6', tex: 'stone', roof: '#5f718a', roofTex: 'tile', trim: '#7a7466', base: '#8a8478', stone: true },
  { wall: '#d6d0c2', tex: 'stone', roof: '#2f4c8c', roofTex: 'tile', trim: '#d4ac4b', base: '#a8a292', stone: true },
];

function plinth(g, x0, y0, x1, y1, st, h = 4) {
  g.prism(x0, y0, x1, y1, 0, h, { wall: st.base, tex: 'stone' });
}

// --- individual buildings --------------------------------------------------------
const BuildingArt = {
  house(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 1.8, 1.8, 0.45);
    plinth(g, 0.18, 0.18, 1.82, 1.82, st, 3);
    g.prism(0.25, 0.25, 1.75, 1.75, 3, 24, { wall: st.wall, tex: st.tex });
    g.door('L', 0.7, 1.05, 3, 17, 1.75);
    g.win('L', 1.4, 10, 1.75);
    g.win('R', 1.0, 10, 1.75, 0.3);
    g.gable(0.25, 0.25, 1.75, 1.75, 24, 44, 'x', { color: st.roof, tex: st.roofTex, gableWall: shade(st.wall, -0.2), over: 0.14 });
    if (a >= 2) { g.prism(1.25, 0.4, 1.5, 0.65, 24, 52, { wall: '#807a70', tex: 'stone' }); }
    g.flag(0.35, 0.35, 40, 12, tc, 9);
  },
  towncenter(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.3, 0.3, 3.7, 3.7, 0.7);
    plinth(g, 0.25, 0.25, 3.75, 3.75, st, 4);
    // keep tower (back)
    g.prism(1.3, 0.55, 2.7, 1.95, 4, 70 + a * 4, { wall: st.stone ? st.wall : shade(st.wall, -0.06), tex: st.tex === 'plank' ? 'log' : st.tex });
    g.win('L', 2.0, 40, 1.95, 0.3, 11); g.win('R', 1.25, 40, 2.7, 0.3, 11);
    if (a >= 1) g.crenel(1.3, 0.55, 2.7, 1.95, 74 + a * 4, 6, { wall: st.wall, tex: st.tex });
    g.hip(1.3, 0.55, 2.7, 1.95, 74 + a * 4 + (a >= 1 ? 6 : 0), 102 + a * 4, { color: st.roof, tex: st.roofTex, over: 0.15 });
    g.flag(2.0, 1.25, 100 + a * 4, 22, tc, 16);
    // main hall (front)
    g.prism(0.45, 1.5, 3.55, 3.5, 4, 36, { wall: st.wall, tex: st.tex === 'plank' ? 'log' : st.tex });
    g.door('L', 1.6, 2.4, 4, 26, 3.5);
    g.win('L', 0.95, 18, 3.5, 0.34, 11); g.win('L', 3.05, 18, 3.5, 0.34, 11);
    g.win('R', 2.0, 18, 3.55, 0.34, 11); g.win('R', 3.0, 18, 3.55, 0.34, 11);
    g.gable(0.45, 1.5, 3.55, 3.5, 36, 58, 'x', { color: st.roof, tex: st.roofTex, gableWall: shade(st.wall, -0.2), over: 0.18 });
    // banner over door
    g.banner(1.3, 14, 33, 3.52, tc); g.banner(2.7, 14, 33, 3.52, tc);
    if (a >= 2) {
      for (const [cx, cy] of [[0.3, 3.1], [3.1, 3.1]]) {
        g.prism(cx, cy, cx + 0.6, cy + 0.6, 4, 52, { wall: st.wall, tex: st.tex });
        g.hip(cx, cy, cx + 0.6, cy + 0.6, 52, 70, { color: st.roof, tex: st.roofTex, over: 0.08 });
      }
    }
    g.flag(0.5, 1.6, 54, 14, tc, 10);
    g.flag(3.45, 3.4, 54, 14, tc, 10);
  },
  mill(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.3, 0.3, 1.7, 1.7, 0.5);
    plinth(g, 0.2, 0.2, 1.8, 1.8, st, 3);
    g.prism(0.35, 0.35, 1.65, 1.65, 3, 22, { wall: st.stone ? st.wall : '#b9955f', tex: st.tex === 'timber' ? 'plank' : st.tex });
    g.door('L', 0.75, 1.15, 3, 16, 1.65);
    // tower
    g.prism(0.6, 0.6, 1.4, 1.4, 22, 54, { wall: st.stone ? shade(st.wall, 0.05) : '#d6c49a', tex: st.stone ? 'stone' : 'plank' });
    g.win('L', 1.0, 34, 1.4, 0.24, 9);
    g.hip(0.6, 0.6, 1.4, 1.4, 54, 72, { color: st.roof, tex: st.roofTex, over: 0.12 });
    g.c.fillStyle = '#4a3320'; const hub = g.P(1.0, 1.4, 52); g.c.beginPath(); g.c.arc(hub[0], hub[1], 2.6, 0, TAU); g.c.fill();
  },
  lumber(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 1.8, 1.8, 0.4);
    // posts
    const post = (x, y, h) => g.prism(x, y, x + 0.12, y + 0.12, 0, h, { wall: '#6a4a2b', tex: 'log' });
    post(0.3, 0.3, 34); post(1.55, 0.3, 34);
    post(0.3, 1.55, 28); post(1.55, 1.55, 28);
    // logs piles
    for (let i = 0; i < 3; i++) g.prism(0.5, 0.45 + i * 0.12, 1.5, 0.57 + i * 0.12, 0, 6, { wall: '#8d6b3f', tex: 'log' });
    for (let i = 0; i < 3; i++) g.prism(0.7 + i * 0.25, 1.0, 0.9 + i * 0.25, 1.9, 0, 5, { wall: i % 2 ? '#7a5a34' : '#9a7444', tex: 'log' });
    g.gable(0.2, 0.2, 1.8, 1.8, 30, 46, 'y', { color: a >= 2 ? st.roof : '#b09040', tex: a >= 2 ? st.roofTex : 'thatch', over: 0.14 });
    // stump + axe
    g.prism(1.35, 1.35, 1.65, 1.65, 0, 6, { wall: '#a07a48', tex: 'log' });
    const ap = g.P(1.5, 1.5, 6); g.c.strokeStyle = '#4a2a14'; g.c.lineWidth = 1.6; g.c.beginPath(); g.c.moveTo(ap[0], ap[1]); g.c.lineTo(ap[0] + 6, ap[1] - 14); g.c.stroke();
    g.c.fillStyle = '#b8bcc0'; g.c.beginPath(); g.c.moveTo(ap[0] + 4, ap[1] - 12); g.c.lineTo(ap[0] + 11, ap[1] - 10); g.c.lineTo(ap[0] + 7, ap[1] - 17); g.c.fill();
    g.flag(0.35, 0.35, 34, 12, tc, 9);
  },
  mining(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 1.8, 1.8, 0.4);
    plinth(g, 0.2, 0.2, 1.1, 1.1, st, 2);
    g.prism(0.25, 0.25, 1.05, 1.05, 2, 26, { wall: '#8a6a44', tex: 'plank' });
    g.door('L', 0.5, 0.8, 2, 16, 1.05);
    g.gable(0.25, 0.25, 1.05, 1.05, 26, 38, 'x', { color: a >= 2 ? st.roof : '#a98a4a', tex: a >= 2 ? st.roofTex : 'thatch', over: 0.12 });
    // ore cart
    g.prism(1.0, 1.15, 1.7, 1.65, 3, 11, { wall: '#6a4a2a', tex: 'plank' });
    for (let i = 0; i < 5; i++) { const p = g.P(1.15 + i * 0.12, 1.4, 12); g.c.fillStyle = i % 2 ? '#f1c232' : '#9a9a9a'; g.c.beginPath(); g.c.arc(p[0], p[1], 3.3, 0, TAU); g.c.fill(); }
    for (const [wx, wy] of [[1.05, 1.68], [1.55, 1.68]]) { const p = g.P(wx, wy, 3); g.c.fillStyle = '#2a2a2a'; g.c.beginPath(); g.c.arc(p[0], p[1], 3, 0, TAU); g.c.fill(); }
    g.flag(0.3, 0.3, 36, 12, tc, 9);
  },
  barracks(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 2.8, 2.8, 0.55);
    plinth(g, 0.15, 0.15, 2.85, 2.85, st, 3);
    g.prism(0.25, 0.6, 2.75, 2.7, 3, 34, { wall: st.wall, tex: st.tex });
    g.door('L', 1.0, 1.55, 3, 24, 2.7);
    g.win('L', 0.55, 18, 2.7, 0.26, 10); g.win('L', 2.3, 18, 2.7, 0.26, 10);
    g.win('R', 1.3, 18, 2.75, 0.26, 10); g.win('R', 2.0, 18, 2.75, 0.26, 10);
    g.gable(0.25, 0.6, 2.75, 2.7, 34, 54, 'x', { color: st.roof, tex: st.roofTex, gableWall: shade(st.wall, -0.2), over: 0.15 });
    // crossed swords sign
    const s = g.P(1.28, 2.7, 33), c = g.c;
    c.fillStyle = tc; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.moveTo(s[0] - 8, s[1] - 4); c.lineTo(s[0] + 8, s[1] - 4); c.lineTo(s[0] + 8, s[1] + 8); c.lineTo(s[0], s[1] + 13); c.lineTo(s[0] - 8, s[1] + 8); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#e8e8ee'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(s[0] - 5, s[1] - 1); c.lineTo(s[0] + 5, s[1] + 9); c.moveTo(s[0] + 5, s[1] - 1); c.lineTo(s[0] - 5, s[1] + 9); c.stroke();
    // weapon rack
    g.prism(0.35, 2.78, 1.15, 2.88, 3, 14, { wall: '#5a3d22', tex: 'plank' });
    for (let i = 0; i < 4; i++) { const p = g.P(0.45 + i * 0.2, 2.83, 14); c.strokeStyle = '#9ca3aa'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(p[0], p[1] + 4); c.lineTo(p[0] + 2, p[1] - 12); c.stroke(); }
    g.flag(2.65, 0.7, 52, 14, tc, 11);
  },
  archery(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 2.8, 2.8, 0.55);
    plinth(g, 0.15, 0.15, 2.85, 1.5, st, 3);
    g.prism(0.25, 0.25, 2.75, 1.4, 3, 30, { wall: st.wall, tex: st.tex });
    g.door('L', 1.0, 1.7, 3, 22, 1.4, '#1a120a', false);
    g.win('L', 0.5, 17, 1.4, 0.26, 9); g.win('L', 2.4, 17, 1.4, 0.26, 9);
    g.gable(0.25, 0.25, 2.75, 1.4, 30, 48, 'x', { color: st.roof, tex: st.roofTex, gableWall: shade(st.wall, -0.2), over: 0.14 });
    // targets in the yard
    const c = g.c;
    for (const [tx, ty] of [[0.8, 2.3], [1.9, 2.5]]) {
      const b = g.P(tx, ty, 0), t = g.P(tx, ty, 22);
      c.strokeStyle = '#4a3320'; c.lineWidth = 2; c.beginPath(); c.moveTo(b[0] - 5, b[1] + 3); c.lineTo(t[0], t[1] + 4); c.moveTo(b[0] + 5, b[1] + 3); c.lineTo(t[0], t[1] + 4); c.stroke();
      const cols = ['#f0f0f0', '#d0302a', '#f0f0f0', '#d0302a', '#f0d040'];
      for (let i = 0; i < 5; i++) { c.fillStyle = cols[i]; c.beginPath(); c.ellipse(t[0], t[1] - 2, 11 - i * 2.1, 12 - i * 2.4, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.7; c.stroke(); }
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(t[0] + 2, t[1] - 5); c.lineTo(t[0] - 3, t[1] + 1); c.stroke();
    }
    g.flag(2.65, 0.35, 48, 14, tc, 11);
  },
  stable(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 2.8, 2.8, 0.55);
    plinth(g, 0.15, 0.15, 2.85, 2.85, st, 3);
    g.prism(0.25, 0.25, 1.8, 2.75, 3, 30, { wall: st.wall, tex: st.tex === 'timber' ? 'timber' : st.tex });
    g.door('R', 0.7, 1.6, 3, 24, 1.8, '#1c130c', false);
    g.win('R', 2.1, 18, 1.8, 0.3, 9);
    g.prism(1.8, 0.4, 2.7, 2.6, 3, 16, { wall: shade(st.wall, -0.08), tex: st.tex });
    g.gable(0.25, 0.25, 2.8, 2.75, 30, 52, 'y', { color: st.roof, tex: st.roofTex, gableWall: shade(st.wall, -0.2), over: 0.14 });
    // hay bales
    for (const [hx, hy] of [[1.9, 2.55], [2.35, 2.5], [2.1, 2.62]]) g.prism(hx, hy, hx + 0.42, hy + 0.34, 3, 11, { wall: '#d8b64a', tex: 'thatch' });
    // horseshoe sign
    const s = g.P(1.0, 2.75, 30);
    g.c.strokeStyle = tc; g.c.lineWidth = 3; g.c.beginPath(); g.c.arc(s[0], s[1] + 2, 6, Math.PI * 0.15, Math.PI * 0.85, true); g.c.stroke();
    g.flag(0.35, 0.35, 48, 14, tc, 11);
  },
  siege(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 2.8, 2.8, 0.55);
    plinth(g, 0.15, 0.15, 2.85, 2.85, st, 3);
    g.prism(0.25, 0.25, 2.75, 2.7, 3, 36, { wall: a >= 2 ? st.wall : '#8a6a44', tex: a >= 2 ? st.tex : 'plank' });
    // big double doors
    g.door('L', 0.8, 2.2, 3, 28, 2.7, '#3a2a18', true);
    const c = g.c;
    for (const u of [1.1, 1.5, 1.9]) { const p = g.P(u, 2.7, 28), q = g.P(u, 2.7, 3); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }
    g.gable(0.25, 0.25, 2.75, 2.7, 36, 56, 'x', { color: st.roof, tex: st.roofTex, gableWall: shade(st.wall, -0.2), over: 0.16 });
    // gear on side
    const gp = g.P(2.75, 1.4, 22);
    c.fillStyle = '#6a6a70'; c.strokeStyle = '#222'; c.lineWidth = 1;
    c.beginPath(); for (let i = 0; i < 16; i++) { const an = i / 16 * TAU, rr2 = i % 2 ? 7 : 9; c.lineTo(gp[0] + Math.cos(an) * rr2 * 0.7, gp[1] + Math.sin(an) * rr2); } c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#222'; c.beginPath(); c.arc(gp[0], gp[1], 2.2, 0, TAU); c.fill();
    g.flag(0.35, 0.35, 54, 14, tc, 11);
  },
  blacksmith(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 2.8, 2.8, 0.5);
    plinth(g, 0.15, 0.15, 2.85, 2.85, st, 3);
    g.prism(0.25, 0.5, 2.3, 2.7, 3, 30, { wall: a >= 1 ? '#a89c88' : '#8a6a44', tex: a >= 1 ? 'stone' : 'plank' });
    g.door('L', 0.6, 1.2, 3, 22, 2.7);
    g.win('R', 1.0, 15, 2.3, 0.3, 10);
    // forge chimney
    g.prism(1.7, 0.6, 2.1, 1.0, 3, 62, { wall: '#7a6a5a', tex: 'stone' });
    g.gable(0.25, 0.5, 2.3, 2.7, 30, 46, 'x', { color: st.roof, tex: st.roofTex, gableWall: shade(st.wall, -0.2), over: 0.14 });
    g.prism(1.7, 0.6, 2.1, 1.0, 40, 64, { wall: '#7a6a5a', tex: 'stone' });
    // anvil + tools outside
    const c = g.c, an = g.P(2.5, 2.45, 8);
    g.prism(2.4, 2.35, 2.75, 2.65, 0, 8, { wall: '#4a3a2a', tex: 'log' });
    c.fillStyle = '#4a4e56'; c.strokeStyle = '#111'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(an[0] - 9, an[1] - 2); c.lineTo(an[0] + 8, an[1] - 2); c.lineTo(an[0] + 5, an[1] + 2); c.lineTo(an[0] + 2, an[1] + 2); c.lineTo(an[0] + 3, an[1] + 6); c.lineTo(an[0] - 5, an[1] + 6); c.lineTo(an[0] - 3, an[1] + 2); c.lineTo(an[0] - 7, an[1] + 1); c.closePath(); c.fill(); c.stroke();
    g.flag(0.35, 0.55, 46, 12, tc, 9);
  },
  market(g, a, tc) {
    const st = STYLES[a];
    g.shadow(0.2, 0.2, 3.8, 3.8, 0.55);
    // paved ground
    g.poly([g.P(0.1, 0.1, 1), g.P(3.9, 0.1, 1), g.P(3.9, 3.9, 1), g.P(0.1, 3.9, 1)], '#a39a84', 'rgba(0,0,0,0.4)');
    g.poly([g.P(0.35, 0.35, 1.5), g.P(3.65, 0.35, 1.5), g.P(3.65, 3.65, 1.5), g.P(0.35, 3.65, 1.5)], '#b7ad94');
    const stall = (x, y, col) => {
      const w = 1.1, d = 0.8;
      for (const [px, py] of [[x, y], [x + w, y], [x, y + d], [x + w, y + d]]) g.prism(px - 0.04, py - 0.04, px + 0.04, py + 0.04, 1, 28, { wall: '#5a3d22', tex: 'log' });
      g.prism(x, y + d - 0.1, x + w, y + d, 1, 10, { wall: '#7a5a34', tex: 'plank' });
      // awning with stripes
      const n = 6;
      for (let i = 0; i < n; i++) {
        const u0 = x - 0.1 + (w + 0.2) * i / n, u1 = x - 0.1 + (w + 0.2) * (i + 1) / n;
        g.poly([g.P(u0, y + d + 0.1, 26), g.P(u1, y + d + 0.1, 26), g.P(u1, y - 0.05, 34), g.P(u0, y - 0.05, 34)], i % 2 ? '#f2ead8' : col, 'rgba(0,0,0,0.35)', 0.8);
      }
      // goods
      for (let i = 0; i < 4; i++) { const p = g.P(x + 0.15 + i * 0.25, y + d - 0.05, 11); g.c.fillStyle = ['#c4412c', '#e0b030', '#4a9a40', '#d07030'][(i + Math.floor(x * 3)) % 4]; g.c.beginPath(); g.c.arc(p[0], p[1], 3, 0, TAU); g.c.fill(); }
    };
    stall(0.6, 0.6, '#c4412c'); stall(2.0, 0.8, '#2f6fb0'); stall(0.7, 2.2, '#2f8a4a');
    // crates / barrels
    for (const [bx, by] of [[2.9, 2.8], [3.2, 2.5], [2.6, 3.2]]) g.prism(bx, by, bx + 0.32, by + 0.32, 1, 12, { wall: '#8a6a3a', tex: 'plank' });
    g.cyl(2.2, 2.4, 1, 14, 0.2, '#7a5a30');
    // central flag
    g.flag(1.9, 2.0, 1, 54, tc, 16);
  },
  monastery(g, a, tc) {
    const st = STYLES[Math.max(a, 1)];
    g.shadow(0.2, 0.2, 2.8, 2.8, 0.55);
    plinth(g, 0.15, 0.15, 2.85, 2.85, st, 3);
    // nave
    g.prism(0.3, 0.9, 2.7, 2.7, 3, 34, { wall: '#cfc8b8', tex: 'stone' });
    g.door('L', 1.2, 1.8, 3, 24, 2.7);
    for (const u of [0.55, 2.25]) g.win('L', u, 16, 2.7, 0.26, 14, '#4a6ab0');
    g.win('R', 1.5, 16, 2.7, 0.26, 14, '#4a6ab0');
    g.gable(0.3, 0.9, 2.7, 2.7, 34, 58, 'x', { color: '#7a4a3a', tex: 'tile', gableWall: '#b8b0a0', over: 0.14 });
    // bell tower
    g.prism(0.45, 0.25, 1.25, 1.05, 3, 74, { wall: '#d6cfbf', tex: 'stone' });
    g.win('L', 0.85, 54, 1.05, 0.3, 12);
    g.hip(0.45, 0.25, 1.25, 1.05, 74, 112, { color: '#44628a', tex: 'tile', over: 0.1 });
    // cross
    const t = g.P(0.85, 0.65, 112), c = g.c;
    c.strokeStyle = '#e8c860'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(t[0], t[1]); c.lineTo(t[0], t[1] - 14); c.moveTo(t[0] - 5, t[1] - 9); c.lineTo(t[0] + 5, t[1] - 9); c.stroke();
    g.flag(2.6, 0.95, 56, 12, tc, 9);
  },
  university(g, a, tc) {
    const st = STYLES[Math.max(a, 2)];
    g.shadow(0.2, 0.2, 3.8, 3.8, 0.6);
    plinth(g, 0.15, 0.15, 3.85, 3.85, st, 4);
    g.prism(0.35, 0.7, 3.65, 3.4, 4, 44, { wall: '#d4cdbd', tex: 'stone' });
    // columns & portico
    for (let i = 0; i < 6; i++) { const u = 0.7 + i * 0.5; g.prism(u, 3.45, u + 0.16, 3.61, 4, 40, { wall: '#ece6d6', tex: null }); }
    g.prism(0.55, 3.38, 3.5, 3.66, 40, 46, { wall: '#c8c0ae', tex: 'stone' });
    g.door('L', 1.7, 2.3, 4, 30, 3.4, '#241a12');
    for (const u of [0.8, 1.3, 2.7, 3.2]) g.win('L', u, 20, 3.4, 0.3, 14, '#2c3a5a');
    g.gable(0.35, 0.7, 3.65, 3.4, 44, 60, 'x', { color: '#6a6a78', tex: 'tile', gableWall: '#d8d2c2', over: 0.12 });
    // dome
    g.cyl(2.0, 1.55, 44, 66, 0.8, '#c9c2b0', 'stone');
    const dm = g.P(2.0, 1.55, 66), c = g.c;
    const gr = c.createRadialGradient(dm[0] - 8, dm[1] - 12, 2, dm[0], dm[1] - 4, 28);
    gr.addColorStop(0, '#6a86c8'); gr.addColorStop(1, '#2a3f78');
    c.fillStyle = gr; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(dm[0], dm[1], 26, 13, 0, Math.PI, 0); c.quadraticCurveTo(dm[0] + 20, dm[1] - 30, dm[0], dm[1] - 32); c.quadraticCurveTo(dm[0] - 20, dm[1] - 30, dm[0] - 26, dm[1]); c.fill(); c.stroke();
    g.flag(2.0, 1.55, 98, 14, tc, 11);
  },
  castle(g, a, tc) {
    const st = STYLES[Math.max(a, 2)];
    g.shadow(0.2, 0.2, 3.8, 3.8, 0.8);
    plinth(g, 0.1, 0.1, 3.9, 3.9, st, 4);
    const wallM = { wall: st.wall, tex: 'stone' };
    // back towers first
    const tower = (x, y, h) => {
      g.prism(x, y, x + 0.9, y + 0.9, 4, h, wallM);
      g.crenel(x, y, x + 0.9, y + 0.9, h, 6, wallM);
    };
    tower(0.25, 0.25, 74);
    g.prism(0.6, 0.45, 3.5, 3.5, 4, 48, wallM);
    // curtain walls top
    g.crenel(0.6, 0.45, 3.5, 3.5, 48, 5, wallM);
    // central keep
    g.prism(1.2, 1.1, 2.8, 2.6, 48, 82, wallM);
    g.win('L', 1.6, 62, 2.6, 0.26, 12); g.win('L', 2.4, 62, 2.6, 0.26, 12); g.win('R', 1.7, 62, 2.8, 0.26, 12);
    g.crenel(1.2, 1.1, 2.8, 2.6, 82, 6, wallM);
    g.flag(2.0, 1.85, 88, 26, tc, 18);
    tower(2.85, 0.25, 74);
    tower(0.25, 2.85, 74);
    tower(2.85, 2.85, 74);
    // cone roofs on towers
    for (const [x, y] of [[0.25, 0.25], [2.85, 0.25], [0.25, 2.85], [2.85, 2.85]]) { g.flag(x + 0.45, y + 0.45, 80, 14, tc, 10); }
    // gate
    g.door('L', 1.55, 2.25, 4, 30, 3.5, '#1a120a');
    for (const u of [1.7, 1.9, 2.1]) { const p = g.P(u, 3.5, 30), q = g.P(u, 3.5, 8); g.c.strokeStyle = '#555'; g.c.lineWidth = 1.2; g.c.beginPath(); g.c.moveTo(p[0], p[1]); g.c.lineTo(q[0], q[1]); g.c.stroke(); }
  },
  tower(g, a, tc) {
    const st = STYLES[Math.max(a, 1)];
    g.shadow(0.2, 0.2, 0.9, 0.9, 0.5);
    g.prism(0.15, 0.15, 0.85, 0.85, 0, 60, { wall: st.wall, tex: 'stone' });
    g.win('L', 0.5, 36, 0.85, 0.16, 12, '#111');
    g.prism(0.05, 0.05, 0.95, 0.95, 60, 70, { wall: shade(st.wall, -0.05), tex: 'stone' });
    g.crenel(0.05, 0.05, 0.95, 0.95, 70, 6, { wall: st.wall, tex: 'stone' });
    g.flag(0.5, 0.5, 70, 18, tc, 12);
  },
  farm(g, a, tc, stage = 3) {
    // flat field
    const c = g.c;
    g.poly([g.P(0.05, 0.05), g.P(2.95, 0.05), g.P(2.95, 2.95), g.P(0.05, 2.95)], '#6b4a2a', 'rgba(40,20,5,0.8)', 1.4);
    g.poly([g.P(0.12, 0.12), g.P(2.88, 0.12), g.P(2.88, 2.88), g.P(0.12, 2.88)], '#8a6238');
    const rows = 7;
    for (let i = 0; i < rows; i++) {
      const y = 0.3 + i * 0.4;
      g.poly([g.P(0.15, y - 0.12), g.P(2.85, y - 0.12), g.P(2.85, y + 0.05), g.P(0.15, y + 0.05)], '#5a3d20');
      if (stage > 0) {
        const n = 12;
        for (let k = 0; k < n; k++) {
          if ((i * 7 + k * 3) % 4 >= stage + (stage >= 3 ? 1 : 0)) continue;
          const p = g.P(0.25 + k * 0.22, y - 0.03, 0);
          const hh = 3 + stage * 2.5;
          c.strokeStyle = stage === 3 ? '#d6b83a' : '#6aa23a'; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - 1, p[1] - hh); c.moveTo(p[0], p[1]); c.lineTo(p[0] + 2, p[1] - hh + 1); c.stroke();
          if (stage === 3) { c.fillStyle = '#f0d050'; c.fillRect(p[0] - 1.5, p[1] - hh - 1, 3, 2); }
        }
      }
    }
    // fence posts at corners
    for (const [x, y] of [[0.05, 0.05], [2.95, 0.05], [0.05, 2.95], [2.95, 2.95]]) g.prism(x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0, 7, { wall: '#4a3320', tex: null });
  },
  // walls: mask bits: 1:+x 2:-x 4:+y 8:-y
  palisade(g, a, tc, mask = 0) {
    const c = g.c;
    const logs = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.14));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t);
        const h = 20 + ((i * 7) % 5);
        g.prism(x - 0.06, y - 0.06, x + 0.06, y + 0.06, 0, h, { wall: i % 2 ? '#8a6a3c' : '#7a5a30', tex: null, top: false });
        const tp = g.P(x, y, h); const tp2 = g.P(x, y, h + 6);
        c.fillStyle = '#9a7a46'; c.beginPath(); c.moveTo(tp[0] - 4, tp[1] + 1); c.lineTo(tp2[0], tp2[1]); c.lineTo(tp[0] + 4, tp[1] + 1); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.8; c.stroke();
      }
    };
    if (mask & 2) logs(0, 0.5, 0.5, 0.5);
    if (mask & 8) logs(0.5, 0, 0.5, 0.5);
    logs(0.4, 0.4, 0.6, 0.6);
    if (mask & 1) logs(0.5, 0.5, 1, 0.5);
    if (mask & 4) logs(0.5, 0.5, 0.5, 1);
  },
  stonewall(g, a, tc, mask = 0) {
    const m = { wall: '#aaa498', tex: 'stone' };
    const h = 30;
    if (mask & 2) g.prism(0, 0.3, 0.5, 0.7, 0, h - 4, m);
    if (mask & 8) g.prism(0.3, 0, 0.7, 0.5, 0, h - 4, m);
    g.prism(0.2, 0.2, 0.8, 0.8, 0, h, m);
    g.crenel(0.2, 0.2, 0.8, 0.8, h, 4, m);
    if (mask & 1) g.prism(0.5, 0.3, 1, 0.7, 0, h - 4, m);
    if (mask & 4) g.prism(0.3, 0.5, 0.7, 1, 0, h - 4, m);
  },
  gate(g, a, tc, mask = 0) {
    const m = { wall: '#b3ada0', tex: 'stone' };
    const alongX = (mask & 3) || !(mask & 12);
    if (alongX) {
      g.prism(0, 0.25, 0.3, 0.75, 0, 34, m);
      g.prism(0.7, 0.25, 1, 0.75, 0, 34, m);
      g.prism(0.3, 0.25, 0.7, 0.75, 26, 34, { wall: '#8a6a3c', tex: 'plank' });
      g.crenel(0, 0.25, 1, 0.75, 34, 4, m);
      g.quad([[0.3, 0.75, 4], [0.7, 0.75, 4], [0.7, 0.75, 26], [0.3, 0.75, 26]], '#33261a', null);
    } else {
      g.prism(0.25, 0, 0.75, 0.3, 0, 34, m);
      g.prism(0.25, 0.7, 0.75, 1, 0, 34, m);
      g.prism(0.25, 0.3, 0.75, 0.7, 26, 34, { wall: '#8a6a3c', tex: 'plank' });
      g.crenel(0.25, 0, 0.75, 1, 34, 4, m);
      g.quad([[0.75, 0.7, 4], [0.75, 0.3, 4], [0.75, 0.3, 26], [0.75, 0.7, 26]], '#33261a', null);
    }
    g.flag(0.5, 0.5, 34, 12, tc, 9);
  },
};

const BuildingSprites = { cache: new Map() };
function getBuildingSprite(type, age, team, extra = 0) {
  const key = type + '|' + age + '|' + team + '|' + extra;
  let s = BuildingSprites.cache.get(key);
  if (s) return s;
  const def = BUILDINGS[type];
  const size = def.size;
  const tc = TEAM_COLORS[team] || '#888';
  const height = (def.height || 50) + 60;
  const g = new Rig(size, height);
  const fn = BuildingArt[type];
  fn(g, Math.min(age, 3), tc, extra);
  s = { cv: g.cv, ox: g.ox, oy: g.oy, W: g.W, H: g.H };
  BuildingSprites.cache.set(key, s);
  return s;
}
