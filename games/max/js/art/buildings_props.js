// Small props drawn through the Scene: barrels, crates, logs, sacks, hay, targets, anvils ...
// Every prop is tagged 'prop' (only drawn on complete buildings) unless o.tag says otherwise.
import { shade, mix, rgba, hash01 } from './common.js';
import { tones, ramp, rgbMul, rgbOf, planksP, planksHP, blotches } from './buildings_paint.js';
import { SQ2 } from './buildings_kit.js';

const wp = (g, o) => (o && o.tag) ? g.want(o.tag) : g.want('prop');

export function barrel(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const r = o.r || 5.2, h = o.h || 11, c = g.c;
  const pal = tones(o.col || '#8a5e34', 5, 0.14);
  g.lathe(x, y, 0, h, z => r * (1 + 0.16 * Math.sin(Math.PI * Math.min(1, Math.max(0, z / h)))), { pal, ch: 3.6, bw: 4.4, hi: 0.18, mortar: '#2a1a0c', ao: 0 });
  // hoops (front arcs)
  c.strokeStyle = '#2c2c32'; c.lineWidth = 1.3;
  for (const z of [h * 0.22, h * 0.78]) {
    const rr = r * (1 + 0.16 * Math.sin(Math.PI * z / h)), [sx, sy] = g.lp(x, y, 0, 0, z);
    c.beginPath(); c.ellipse(sx, sy, rr * SQ2, rr * SQ2 * 0.5, 0, 0.05, Math.PI - 0.05); c.stroke();
  }
  g.latheTop(x, y, r * 0.88, h, (c2, sx, sy, rr) => { const gr = c2.createRadialGradient(sx - 2, sy - 1, 0, sx, sy, rr * SQ2); gr.addColorStop(0, shade(o.col || '#8a5e34', 0.25)); gr.addColorStop(1, shade(o.col || '#8a5e34', -0.15)); c2.fillStyle = gr; c2.fill(); }, { stroke: 'rgba(30,18,8,0.7)', lw: 0.8 });
}
export function crate(g, x, y, s = 8, o = {}) {
  if (!wp(g, o)) return;
  const h = o.h || s * 0.9, col = o.col || '#8a6a40';
  const f = planksHP({ base: col, rh: 2.6 });
  const fr = (c, w, hh, r) => { f(c, w, hh, r); c.fillStyle = shade(col, -0.35); c.fillRect(0, 0, 1.4, hh); c.fillRect(w - 1.4, 0, 1.4, hh); c.fillRect(0, 0, w, 1.4); c.fillRect(0, hh - 1.4, w, 1.4); };
  g.box(x - s / 2, y - s / 2, o.z || 0, x + s / 2, y + s / 2, (o.z || 0) + h, { left: fr, right: fr, top: (c, w, hh) => { c.fillStyle = shade(col, 0.1); c.fillRect(-1, -1, w + 2, hh + 2); c.fillStyle = shade(col, -0.3); c.fillRect(0, 0, w, 1.2); c.fillRect(0, hh - 1.2, w, 1.2); c.fillRect(0, 0, 1.2, hh); c.fillRect(w - 1.2, 0, 1.2, hh); }, tag: 'prop', ao: 4, hl: false });
}
export function sack(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const c = g.c, [sx, sy] = g.P(x, y, 0), s = o.s || 1, col = o.col || '#c8b078';
  const gr = c.createLinearGradient(sx - 6 * s, 0, sx + 6 * s, 0);
  gr.addColorStop(0, shade(col, 0.2)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, -0.35));
  c.fillStyle = gr; c.beginPath();
  c.moveTo(sx - 5.5 * s, sy); c.quadraticCurveTo(sx - 7.5 * s, sy - 6 * s, sx - 3 * s, sy - 10 * s);
  c.lineTo(sx - 1.4 * s, sy - 12 * s); c.lineTo(sx + 1.4 * s, sy - 12 * s); c.lineTo(sx + 3 * s, sy - 10 * s);
  c.quadraticCurveTo(sx + 7.5 * s, sy - 6 * s, sx + 5.5 * s, sy); c.quadraticCurveTo(sx, sy + 2.2 * s, sx - 5.5 * s, sy); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(40,24,8,0.45)'; c.lineWidth = 0.7; c.stroke();
  c.strokeStyle = shade(col, -0.45); c.lineWidth = 1.1; c.beginPath(); c.moveTo(sx - 3 * s, sy - 9.3 * s); c.lineTo(sx + 3 * s, sy - 9.3 * s); c.stroke();
  g.touchS(sx - 8 * s, sy - 13 * s); g.touchS(sx + 8 * s, sy + 3);
}
/** straw/hay bale (box with strands and twine) */
export function hay(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const w = o.w || 12, d = o.d || 9, h = o.h || 8;
  const f = (c, ww, hh, r) => {
    const gr = c.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#e6c868'); gr.addColorStop(1, '#b8943c'); c.fillStyle = gr; c.fillRect(-1, -1, ww + 2, hh + 2);
    c.strokeStyle = 'rgba(120,80,20,0.5)'; c.lineWidth = 0.6; c.beginPath();
    for (let i = 0; i < ww * hh / 6; i++) { const px = r() * ww, py = r() * hh; c.moveTo(px, py); c.lineTo(px + (r() - 0.5) * 4, py + (r() - 0.5) * 1.5); } c.stroke();
    c.strokeStyle = 'rgba(255,240,170,0.5)'; c.beginPath();
    for (let i = 0; i < ww * hh / 10; i++) { const px = r() * ww, py = r() * hh; c.moveTo(px, py); c.lineTo(px + (r() - 0.5) * 4, py + (r() - 0.5) * 1.5); } c.stroke();
    c.fillStyle = '#5a4020'; c.fillRect(ww * 0.3, 0, 1, hh); c.fillRect(ww * 0.7, 0, 1, hh);
  };
  g.box(x - w / 2, y - d / 2, o.z || 0, x + w / 2, y + d / 2, (o.z || 0) + h, { left: f, right: f, top: f, tag: 'prop', ao: 3, hl: false });
}
/** a single log lying along the world x or y axis; (x,y) = start of axis at ground, z = bottom */
export function log(g, x, y, z, len, r, axis = 'x', o = {}) {
  const c = g.c;
  const A = g.P(x, y, z + r), B = axis === 'x' ? g.P(x + len, y, z + r) : g.P(x, y + len, z + r);
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, hw = 1.265 * r;
  const col = o.col || '#7a5230';
  const grad = c.createLinearGradient(A[0] + nx * hw, A[1] + ny * hw, A[0] - nx * hw, A[1] - ny * hw);
  grad.addColorStop(0, shade(col, 0.25)); grad.addColorStop(0.45, col); grad.addColorStop(1, shade(col, -0.45));
  c.beginPath(); c.moveTo(A[0] + nx * hw, A[1] + ny * hw); c.lineTo(B[0] + nx * hw, B[1] + ny * hw); c.lineTo(B[0] - nx * hw, B[1] - ny * hw); c.lineTo(A[0] - nx * hw, A[1] - ny * hw); c.closePath();
  c.fillStyle = grad; c.fill();
  c.strokeStyle = 'rgba(30,16,6,0.3)'; c.lineWidth = 0.6; c.beginPath();
  for (let k = 0; k < len / 6; k++) { const t = (k * 6 + 2) / len, ox = A[0] + dx * t, oy = A[1] + dy * t, sgn = ((k * 7) % 3) - 1; c.moveTo(ox + nx * hw * 0.5 * sgn, oy + ny * hw * 0.5 * sgn); c.lineTo(ox + dx / L * 5 + nx * hw * 0.5 * sgn, oy + dy / L * 5 + ny * hw * 0.5 * sgn); }
  c.stroke();
  // end grain
  c.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20 * Math.PI * 2, ex = axis === 'x' ? -r * Math.cos(t) : r * Math.cos(t), ey = 0.5 * r * Math.cos(t) - r * Math.sin(t);
    i ? c.lineTo(B[0] + ex, B[1] + ey) : c.moveTo(B[0] + ex, B[1] + ey);
  }
  c.closePath(); c.fillStyle = o.end || '#c9a066'; c.fill(); c.strokeStyle = 'rgba(40,20,8,0.7)'; c.lineWidth = 0.7; c.stroke();
  c.strokeStyle = 'rgba(110,70,30,0.6)'; c.lineWidth = 0.5;
  for (const k of [0.62, 0.3]) {
    c.beginPath();
    for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI * 2, ex = axis === 'x' ? -r * k * Math.cos(t) : r * k * Math.cos(t), ey = 0.5 * r * k * Math.cos(t) - r * k * Math.sin(t); i ? c.lineTo(B[0] + ex, B[1] + ey) : c.moveTo(B[0] + ex, B[1] + ey); }
    c.stroke();
  }
  g.touchS(Math.min(A[0], B[0]) - hw, Math.min(A[1], B[1]) - hw); g.touchS(Math.max(A[0], B[0]) + hw, Math.max(A[1], B[1]) + hw);
}
/** pyramid stack of logs: rows from the bottom (counts like [4,3,2]) lying along `axis` */
export function logStack(g, x, y, len, r, rows, axis = 'x', o = {}) {
  if (!wp(g, o)) return;
  const cols = tones(o.col || '#7a5230', 4, 0.12);
  for (let row = 0; row < rows.length; row++) {
    const n = rows[row];
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * r * 2.05, z = row * r * 1.75;
      if (axis === 'x') log(g, x, y + off, z, len, r, 'x', { col: cols[(i + row * 2) % 4] });
      else log(g, x + off, y, z, len, r, 'y', { col: cols[(i + row * 2) % 4] });
    }
  }
}
/** wisps of smoke (drawn after the outline pass so they stay soft) from world point (x,y,z) */
export function smoke(g, x, y, z, o = {}) {
  if (!g.want('prop')) return;
  const [sx, sy] = g.P(x, y, z), n = o.n || 4, s = o.s || 1;
  g.post((c) => {
    for (let i = 0; i < n; i++) {
      const t = i / n, r = (2.6 + t * 4.2) * s, px = sx + 2 + t * 9 * s + Math.sin(i * 1.7) * 1.5, py = sy - 4 - t * 20 * s;
      const gr = c.createRadialGradient(px, py, 0, px, py, r);
      const a = (0.34 - t * 0.2) * (o.a || 1);
      gr.addColorStop(0, `rgba(235,232,226,${a})`); gr.addColorStop(1, 'rgba(235,232,226,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    }
  }, [sx - 6, sy - 4 - 20 * s - 8, sx + 14 * s, sy]);
}
/** glowing light halo (forge) drawn after outline */
export function glow(g, x, y, z, r, color = '255,150,50', a = 0.5) {
  if (!g.want('prop')) return;
  const [sx, sy] = g.P(x, y, z);
  g.post((c) => {
    const gr = c.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, `rgba(${color},${a})`); gr.addColorStop(1, `rgba(${color},0)`);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fill(); c.restore();
  }, [sx - r, sy - r, sx + r, sy + r]);
}

/** irregular faceted rock chunk in screen space (cx, cy = base centre), r radius; kind picks the palette */
export function chunk(g, sx, sy, r, kind = 'stone', seed = 1) {
  const c = g.c;
  const cols = kind === 'gold' ? ['#fff0a0', '#f2c230', '#b88410', '#7a5206'] : kind === 'ore' ? ['#9a8f86', '#6f665f', '#4a423d', '#2a2522'] : ['#c9c4b8', '#a59f92', '#7a746a', '#4e4a42'];
  const n = 6, pts = [];
  let s = seed * 9301 + 49297;
  const rn = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2, rr = r * (0.72 + rn() * 0.4);
    pts.push([sx + Math.cos(a) * rr * 1.05, sy - r * 0.55 + Math.sin(a) * rr * 0.78]);
  }
  const gr = c.createLinearGradient(sx - r, sy - r * 1.3, sx + r, sy + r * 0.3);
  gr.addColorStop(0, cols[0]); gr.addColorStop(0.35, cols[1]); gr.addColorStop(0.75, cols[2]); gr.addColorStop(1, cols[3]);
  c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
  c.fillStyle = gr; c.fill(); c.strokeStyle = 'rgba(20,12,6,0.55)'; c.lineWidth = 0.7; c.stroke();
  // facet lines + highlight
  c.strokeStyle = 'rgba(255,255,240,0.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(pts[5][0], pts[5][1]); c.lineTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.stroke();
  c.strokeStyle = 'rgba(15,8,4,0.35)'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(sx + r * 0.1, sy - r * 0.3); c.lineTo(pts[3][0], pts[3][1]); c.stroke();
  if (kind === 'gold') { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(pts[0][0] - 0.8, pts[0][1] + 0.8, 1.6, 1.6); }
  g.touchS(sx - r * 1.3, sy - r * 1.6); g.touchS(sx + r * 1.3, sy + 2);
}
/** pile of chunks around world (x, y) */
export function rockPile(g, x, y, kind, n = 7, spread = 7, o = {}) {
  if (!wp(g, o)) return;
  const [sx, sy0] = g.P(x, y, o.z || 0), sy = sy0, items = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.399, rr = Math.sqrt((i + 0.5) / n) * spread;
    items.push({ x: Math.cos(a) * rr * 1.2, y: Math.sin(a) * rr * 0.6 - (i > n * 0.6 ? 3 : 0), r: (o.r || 3.2) * (1 - 0.35 * i / n) });
  }
  items.sort((a, b) => a.y - b.y);
  items.forEach((it, i) => chunk(g, sx + it.x, sy + it.y, it.r, kind, (o.seed || 1) + i));
}
/** wheel on a vertical plane facing +y ('x' axis) or +x ('y' axis): centre world (x,y), height z, radius r */
export function wheel(g, x, y, z, r, axis = 'x', col = '#5a3e22') {
  const c = g.c, [sx, sy] = g.P(x, y, z);
  const pt = (rr, t) => axis === 'x' ? [sx + rr * Math.cos(t), sy + 0.5 * rr * Math.cos(t) - rr * Math.sin(t)] : [sx - rr * Math.cos(t), sy + 0.5 * rr * Math.cos(t) * -1 * -1 - rr * Math.sin(t)];
  const ring = (rr) => { c.beginPath(); for (let i = 0; i <= 24; i++) { const p = pt(rr, i / 24 * Math.PI * 2); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.closePath(); };
  ring(r); c.fillStyle = '#2a2018'; c.fill();
  ring(r * 0.82); c.fillStyle = col; c.fill();
  ring(r * 0.58); c.fillStyle = '#1e160e'; c.fill();
  c.strokeStyle = shade(col, 0.2); c.lineWidth = 0.9; c.beginPath();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, p = pt(r * 0.6, a), q = pt(r * 0.6, a + Math.PI); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); }
  c.stroke();
  ring(r * 0.18); c.fillStyle = '#c8a050'; c.fill();
  g.touchS(sx - r * 1.2, sy - r * 1.2); g.touchS(sx + r * 1.2, sy + r * 1.2);
}
/** chopping stump with an axe stuck in it */
export function stumpAxe(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const r = o.r || 5.5, h = o.h || 7, c = g.c;
  g.lathe(x, y, 0, h, z => r * (1.12 - 0.12 * Math.min(1, z / h) + (z < 2 ? 0.15 : 0)), { pal: tones('#6a4828', 5, 0.12), ch: h, bw: 3.2, stag: false, ao: 0, hi: 0.1, mortar: '#2a1a0c' });
  g.latheTop(x, y, r * 0.98, h, (c2, sx, sy, rr) => {
    const gr = c2.createRadialGradient(sx - 1.5, sy - 0.6, 0, sx, sy, rr * SQ2); gr.addColorStop(0, '#e2c088'); gr.addColorStop(1, '#b08850'); c2.fillStyle = gr; c2.fill();
    c2.strokeStyle = 'rgba(110,70,30,0.7)'; c2.lineWidth = 0.6; for (const k of [0.7, 0.4]) { c2.beginPath(); c2.ellipse(sx, sy, rr * SQ2 * k, rr * SQ2 * 0.5 * k, 0, 0, 7); c2.stroke(); }
  }, { stroke: 'rgba(40,20,8,0.8)', lw: 0.8 });
  const [sx, sy] = g.P(x, y, h);
  c.strokeStyle = '#4a3018'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(sx + 1, sy); c.lineTo(sx + 5.5, sy - 12); c.stroke();
  c.strokeStyle = '#8a6a40'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(sx + 0.6, sy); c.lineTo(sx + 5.1, sy - 12); c.stroke();
  c.fillStyle = '#b8bcc4'; c.beginPath(); c.moveTo(sx + 3, sy - 8.2); c.lineTo(sx + 9.2, sy - 8.6); c.lineTo(sx + 8.4, sy - 12.8); c.lineTo(sx + 4.6, sy - 11.6); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(20,20,30,0.7)'; c.lineWidth = 0.7; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(sx + 4.6, sy - 11.7, 3.6, 0.8);
  g.touchS(sx - 7, sy - 14); g.touchS(sx + 11, sy + 4);
}
/** ore cart on a short rail: world (x,y), axis along 'x' or 'y' */
export function cart(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const axis = o.axis || 'x', L = o.len || 18, W = o.w || 11, H = o.h || 7;
  const col = o.col || '#6a4a2c', f = planksHP({ base: col, rh: 2.6 });
  const fr = (c, w, h, r) => { f(c, w, h, r); c.fillStyle = '#2c2c32'; c.fillRect(0, 0, w, 1.2); c.fillRect(0, h - 1.2, w, 1.2); };
  const [x0, x1, y0, y1] = axis === 'x' ? [x - L / 2, x + L / 2, y - W / 2, y + W / 2] : [x - W / 2, x + W / 2, y - L / 2, y + L / 2];
  // rails
  const c = g.c;
  c.strokeStyle = '#3a342c'; c.lineWidth = 1.2;
  const A1 = axis === 'x' ? g.P(x0 - 8, y0 + 1, 0.5) : g.P(x0 + 1, y0 - 8, 0.5), B1 = axis === 'x' ? g.P(x1 + 8, y0 + 1, 0.5) : g.P(x0 + 1, y1 + 8, 0.5);
  const A2 = axis === 'x' ? g.P(x0 - 8, y1 - 1, 0.5) : g.P(x1 - 1, y0 - 8, 0.5), B2 = axis === 'x' ? g.P(x1 + 8, y1 - 1, 0.5) : g.P(x1 - 1, y1 + 8, 0.5);
  c.beginPath(); c.moveTo(A1[0], A1[1]); c.lineTo(B1[0], B1[1]); c.moveTo(A2[0], A2[1]); c.lineTo(B2[0], B2[1]); c.stroke();
  g.touchS(Math.min(A1[0], A2[0]) - 2, Math.min(A1[1], A2[1]) - 2); g.touchS(Math.max(B1[0], B2[0]) + 2, Math.max(B1[1], B2[1]) + 2);
  g.box(x0, y0, 2.5, x1, y1, 2.5 + H, { left: fr, right: fr, top: (cc, w, h) => { const gr = cc.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a2420'); gr.addColorStop(1, '#14100c'); cc.fillStyle = gr; cc.fillRect(-1, -1, w + 2, h + 2); }, tag: 'prop', ao: 2, hl: false });
  wheel(g, axis === 'x' ? x0 + 4 : x0 + 2, axis === 'x' ? y1 : y1 - 4, 3, 3.4, axis === 'x' ? 'x' : 'y');
  wheel(g, axis === 'x' ? x1 - 4 : x0 + 2, axis === 'x' ? y1 : y1 + 0, 3, 3.4, axis === 'x' ? 'x' : 'y');
}

/** stone well with a little roof */
export function well(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const c = g.c, r = 6.5;
  g.lathe(x, y, 0, 7, () => r, { pal: tones('#9a9484', 6, 0.14), ch: 3.5, bw: 5, hi: 0.2, ao: 0 });
  g.latheTop(x, y, r - 0.5, 7, (c2, sx, sy, rr) => { const gr = c2.createRadialGradient(sx, sy - 1, 0, sx, sy, rr * SQ2); gr.addColorStop(0, '#6aa0c8'); gr.addColorStop(1, '#2a4a6a'); c2.fillStyle = gr; c2.fill(); }, { stroke: 'rgba(30,20,10,0.7)', lw: 0.8 });
  // rim
  const [sx, sy] = g.lp(x, y, 0, 0, 7);
  c.strokeStyle = '#b8b2a0'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(sx, sy, r * SQ2, r * SQ2 * 0.5, 0, 0, Math.PI * 2); c.stroke();
  // posts and tiny roof
  const px = [[x - 5.5, y - 1], [x + 5.5, y - 1]];
  for (const [ax, ay] of px) { const a = g.P(ax, ay, 7), b = g.P(ax, ay, 24); c.strokeStyle = '#4a3220'; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  g.roofGable({ x0: x - 7, y0: y - 5, x1: x + 7, y1: y + 3, z: 24, rise: 5, ov: 1.5, ovg: 1.5, axis: 'x', paint: (c2, w, h) => { c2.fillStyle = '#b8552f'; c2.fillRect(-1, -1, w + 2, h + 2); c2.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 3; i < h; i += 3) c2.fillRect(0, i, w, 0.7); }, trim: '#3a2a1c' });
  g.touchS(sx - 10, sy - 26); g.touchS(sx + 10, sy + 6);
}

// ----------------------------------------------------------------------------- yards, racks, targets, forge
/** fence run: posts + two rails between (x0,y0)-(x1,y1) (a straight run along x or y) */
export function fence(g, x0, y0, x1, y1, o = {}) {
  if (!wp(g, o)) return;
  const h = o.h || 10, col = o.col || '#8a6a42', alongX = Math.abs(x1 - x0) >= Math.abs(y1 - y0), step = o.step || 10;
  const f = planksP({ base: col, bw: 2, battens: false });
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(y1 - y0), n = Math.max(1, Math.round(len / step));
  const sgn = alongX ? Math.sign(x1 - x0) || 1 : Math.sign(y1 - y0) || 1;
  const px = (i) => alongX ? [x0 + sgn * len * i / n, y0] : [x0, y0 + sgn * len * i / n];
  for (let i = 0; i <= n; i++) {
    const [x, y] = px(i);
    if (i > 0) {                                      // rails between post i-1 and i (drawn before the post so posts overlap)
      const [xa, ya] = px(i - 1);
      for (const z of [h * 0.3, h * 0.72]) {
        if (alongX) g.box(Math.min(xa, x), y - 0.8, z - 1, Math.max(xa, x), y + 0.8, z + 1, { left: f, right: f, top: f, tag: o.tag || 'prop', ao: 0, hl: false });
        else g.box(x - 0.8, Math.min(ya, y), z - 1, x + 0.8, Math.max(ya, y), z + 1, { left: f, right: f, top: f, tag: o.tag || 'prop', ao: 0, hl: false });
      }
    }
    g.box(x - 1.4, y - 1.4, 0, x + 1.4, y + 1.4, h, { left: f, right: f, top: f, tag: o.tag || 'prop', ao: 2, hl: false });
  }
}
/** rack with leaning weapons.  kind: 'spear' | 'sword' | 'bow' */
export function weaponRack(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const kind = o.kind || 'spear', axis = o.axis || 'x', L = o.len || 20, c = g.c;
  const [bx0, by0] = axis === 'x' ? [x - L / 2, y] : [x, y - L / 2], [bx1, by1] = axis === 'x' ? [x + L / 2, y] : [x, y + L / 2];
  const f = planksP({ base: '#7a5530', bw: 2, battens: false });
  g.box(bx0 - 1.2, by0 - 1.2, 0, bx0 + 1.2, by0 + 1.2, 15, { left: f, right: f, top: f, tag: 'prop', ao: 2, hl: false });
  const n = 5;
  c.lineCap = 'round';
  if (kind === 'spear') {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, wx = bx0 + (bx1 - bx0) * t, wy = by0 + (by1 - by0) * t;
      const a = g.P(wx, wy, 0), b = g.P(wx + (axis === 'x' ? 0 : -1.5), wy + (axis === 'x' ? -1.5 : 0), 25 + (i % 2) * 2);
      c.strokeStyle = '#4a3018'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.strokeStyle = '#8a6a40'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(a[0] - 0.3, a[1]); c.lineTo(b[0] - 0.3, b[1]); c.stroke();
      c.fillStyle = '#c8ccd4'; c.beginPath(); c.moveTo(b[0] - 1.4, b[1]); c.lineTo(b[0], b[1] - 5); c.lineTo(b[0] + 1.4, b[1]); c.closePath(); c.fill(); c.strokeStyle = 'rgba(20,20,30,0.6)'; c.lineWidth = 0.5; c.stroke();
      g.touchS(b[0] - 2, b[1] - 6);
    }
  } else if (kind === 'bow') {
    for (let i = 0; i < 4; i++) {
      const t = (i + 0.5) / 4, wx = bx0 + (bx1 - bx0) * t, wy = by0 + (by1 - by0) * t;
      const a = g.P(wx, wy, 1), b = g.P(wx, wy, 23);
      c.strokeStyle = '#6a4220'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(a[0] + 4.5, (a[1] + b[1]) / 2, b[0], b[1]); c.stroke();
      c.strokeStyle = 'rgba(240,230,200,0.8)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
  } else {                                           // swords hanging from the bar
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, wx = bx0 + (bx1 - bx0) * t, wy = by0 + (by1 - by0) * t;
      const a = g.P(wx, wy, 14), b = g.P(wx, wy, 3);
      c.strokeStyle = '#d0d4dc'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(a[0] - 2.2, a[1] + 1); c.lineTo(a[0] + 2.2, a[1] + 1); c.stroke();
    }
  }
  g.box(bx1 - 1.2, by1 - 1.2, 0, bx1 + 1.2, by1 + 1.2, 15, { left: f, right: f, top: f, tag: 'prop', ao: 2, hl: false });
  // crossbar
  const A = g.P(bx0, by0, 13.5), B = g.P(bx1, by1, 13.5);
  c.strokeStyle = '#3a2614'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
  c.strokeStyle = '#8a6a40'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(A[0], A[1] - 0.7); c.lineTo(B[0], B[1] - 0.7); c.stroke();
}
/** wooden training dummy with a round shield in team colours */
export function dummy(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const c = g.c, [sx, sy] = g.P(x, y, 0), tc = g.tc;
  c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(sx + 2, sy + 1, 6, 2.6, 0, 0, 7); c.fill();
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 4; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx, sy - 22); c.stroke();
  c.strokeStyle = '#7a5530'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(sx - 0.3, sy); c.lineTo(sx - 0.3, sy - 22); c.stroke();
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(sx - 9, sy - 15.5); c.lineTo(sx + 9, sy - 15.5); c.stroke();
  c.strokeStyle = '#7a5530'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(sx - 9, sy - 15.7); c.lineTo(sx + 9, sy - 15.7); c.stroke();
  c.fillStyle = '#d6bd6c'; c.beginPath(); c.arc(sx, sy - 24, 3.6, 0, 7); c.fill(); c.strokeStyle = '#2a1a0c'; c.lineWidth = 0.8; c.stroke();
  const gr = c.createRadialGradient(sx - 1.5, sy - 12.5, 0.5, sx, sy - 11, 5.6); gr.addColorStop(0, tc.light); gr.addColorStop(0.5, tc.main); gr.addColorStop(1, tc.dark);
  c.fillStyle = gr; c.beginPath(); c.arc(sx, sy - 11, 5.2, 0, 7); c.fill(); c.strokeStyle = '#2a1a0c'; c.lineWidth = 0.9; c.stroke();
  c.fillStyle = '#e8e0c8'; c.beginPath(); c.arc(sx, sy - 11, 1.5, 0, 7); c.fill();
  g.touchS(sx - 11, sy - 29); g.touchS(sx + 11, sy + 4);
}
/** straw archery target on a tripod; faces the camera */
export function target(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const c = g.c, [sx, sy] = g.P(x, y, 0), r = o.r || 10;
  c.lineCap = 'round';
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(sx - 7, sy + 1); c.lineTo(sx - 1, sy - r - 5); c.moveTo(sx + 7, sy + 1); c.lineTo(sx + 1, sy - r - 5); c.moveTo(sx, sy - 1.5); c.lineTo(sx, sy - r - 4); c.stroke();
  c.strokeStyle = '#7a5530'; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(sx - 7, sy + 1); c.lineTo(sx - 1, sy - r - 5); c.moveTo(sx + 7, sy + 1); c.lineTo(sx + 1, sy - r - 5); c.moveTo(sx, sy - 1.5); c.lineTo(sx, sy - r - 4); c.stroke();
  const cy = sy - r - 6, rings = ['#e8dcc0', '#c0392b', '#e8dcc0', '#c0392b', '#f0c840'];
  c.fillStyle = '#6a5028'; c.beginPath(); c.ellipse(sx, cy, r * 1.05, r * 0.98, 0, 0, 7); c.fill();
  rings.forEach((col, i) => { const k = 1 - i * 0.2; c.fillStyle = col; c.beginPath(); c.ellipse(sx, cy, r * k, r * k * 0.93, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(30,18,8,0.5)'; c.lineWidth = 0.5; c.stroke(); });
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 0.9; c.beginPath(); c.ellipse(sx, cy, r * 1.05, r * 0.98, 0, 0, 7); c.stroke();
  // arrows
  c.lineWidth = 0.8;
  for (const [ax, ay, ex, ey] of [[2, -1, 11, -7], [-3, 3, -9, 7], [0.5, 0.5, 6, 9]]) {
    c.strokeStyle = '#d8c8a0'; c.beginPath(); c.moveTo(sx + ax, cy + ay); c.lineTo(sx + ex, cy + ey); c.stroke();
    c.strokeStyle = '#c0392b'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx + ex - 1.5 * Math.sign(ex), cy + ey - 1 * Math.sign(ey)); c.lineTo(sx + ex, cy + ey); c.stroke(); c.lineWidth = 0.8;
  }
  g.touchS(sx - r - 2, cy - r - 2); g.touchS(sx + r + 8, sy + 3);
}
/** water / feed trough */
export function trough(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const f = planksHP({ base: '#7a5a38', rh: 2.4 }), L = o.len || 16, w = 5.5, axis = o.axis || 'x';
  const [x0, x1, y0, y1] = axis === 'x' ? [x - L / 2, x + L / 2, y - w / 2, y + w / 2] : [x - w / 2, x + w / 2, y - L / 2, y + L / 2];
  g.box(x0, y0, 0, x1, y1, 6, { left: f, right: f, top: (c, ww, hh) => { const gr = c.createLinearGradient(0, 0, ww, hh); gr.addColorStop(0, '#78b0d8'); gr.addColorStop(1, '#3a6a90'); c.fillStyle = '#5a4026'; c.fillRect(-1, -1, ww + 2, hh + 2); c.fillStyle = gr; c.fillRect(1, 1, ww - 2, hh - 2); }, tag: 'prop', ao: 2, hl: false });
}
/** anvil on a stump */
export function anvil(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  g.lathe(x, y, 0, 7, () => 5, { pal: tones('#6a4828', 5, 0.12), ch: 7, bw: 3.2, stag: false, ao: 0, mortar: '#2a1a0c' });
  g.latheTop(x, y, 4.9, 7, '#8a6a40', { stroke: 'rgba(30,18,8,0.8)', lw: 0.8 });
  const c = g.c, [sx, sy] = g.P(x, y, 7);
  c.fillStyle = '#4a4e58'; c.beginPath();
  c.moveTo(sx - 7.5, sy - 5); c.lineTo(sx - 1, sy - 6); c.lineTo(sx + 6.5, sy - 6); c.lineTo(sx + 6, sy - 3.6); c.lineTo(sx + 3, sy - 3.4); c.lineTo(sx + 2.6, sy - 1); c.lineTo(sx - 3, sy - 1); c.lineTo(sx - 3.2, sy - 3.2); c.lineTo(sx - 6, sy - 3.4); c.closePath(); c.fill();
  c.strokeStyle = '#14161c'; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(sx - 6.5, sy - 5.6, 11, 0.9);
  g.touchS(sx - 9, sy - 8); g.touchS(sx + 8, sy + 3);
}
/** a stack of hay tufts / straw pile (screen space) */
export function strawPile(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const c = g.c, [sx, sy] = g.P(x, y, 0), r = o.r || 8;
  const gr = c.createLinearGradient(0, sy - r, 0, sy);
  gr.addColorStop(0, '#f0d878'); gr.addColorStop(1, '#b8943c');
  c.fillStyle = gr; c.beginPath(); c.moveTo(sx - r * 1.2, sy); c.quadraticCurveTo(sx - r, sy - r * 0.9, sx, sy - r * 1.05); c.quadraticCurveTo(sx + r, sy - r * 0.9, sx + r * 1.2, sy); c.quadraticCurveTo(sx, sy + 2.2, sx - r * 1.2, sy); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(110,70,20,0.55)'; c.lineWidth = 0.6; c.beginPath();
  for (let i = 0; i < 14; i++) { const a = (i * 53 % 100) / 100, px = sx - r + a * 2 * r, py = sy - (0.3 + ((i * 37) % 60) / 100) * r * 0.9; c.moveTo(px, py); c.lineTo(px + 3, py - 1.6); }
  c.stroke();
  c.strokeStyle = 'rgba(40,24,6,0.6)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(sx - r * 1.2, sy); c.quadraticCurveTo(sx - r, sy - r * 0.9, sx, sy - r * 1.05); c.quadraticCurveTo(sx + r, sy - r * 0.9, sx + r * 1.2, sy); c.stroke();
  g.touchS(sx - r * 1.3, sy - r * 1.2); g.touchS(sx + r * 1.3, sy + 3);
}
/** hearth: stone block with glowing coals + hood is added by the caller */
export function hearth(g, x, y, o = {}) {
  if (!wp(g, o)) return;
  const f = (c, w, h, r) => { const g2 = c.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, '#8a8478'); g2.addColorStop(1, '#5e5a52'); c.fillStyle = g2; c.fillRect(-1, -1, w + 2, h + 2); c.strokeStyle = 'rgba(20,12,6,0.5)'; c.lineWidth = 0.7; for (let yy = 3; yy < h; yy += 3.5) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); } };
  g.box(x - 8, y - 6, 0, x + 8, y + 6, 8, { left: f, right: f, top: (c, w, h, r) => { c.fillStyle = '#2a1a10'; c.fillRect(-1, -1, w + 2, h + 2); const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.35, '#ff9a30'); gr.addColorStop(1, 'rgba(180,40,10,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,230,120,0.8)'; for (let i = 0; i < 12; i++) c.fillRect(r() * w, r() * h, 1.4, 1.4); }, tag: 'prop', ao: 2, hl: false });
  glow(g, x, y, 10, 22, '255,150,50', 0.45);
}
