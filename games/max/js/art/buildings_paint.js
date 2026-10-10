// Texture painters and decals for the procedural building art. Every painter has the signature (c, w, h, rnd)
// and draws into a face-local coordinate system: u runs right, v runs DOWN, (0,0) = top-left of the face, size w x h
// (logical px, true 3D lengths).  The Scene (buildings_kit.js) maps that rectangle onto an iso plane with an affine
// transform, so any pattern painted here is automatically perspective-correct on walls and roofs.
import { shade, mix, rgba, hexToRgb } from './common.js';

// ----------------------------------------------------------------------------- colour helpers
/** n tone strings interpolated through the given colour stops (hex strings). */
export function ramp(stops, n = 6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1) * (stops.length - 1);
    const a = Math.min(stops.length - 2, Math.floor(t)), f = t - a;
    out.push(stops.length === 1 ? stops[0] : mix(stops[a], stops[a + 1], f));
  }
  return out;
}
/** n tones from darker to lighter around a base colour. */
export function tones(base, n = 6, spread = 0.16) { return ramp([shade(base, -spread), base, shade(base, spread)], n); }
export function rgbMul(rgb, k, a = 1) {
  const r = Math.min(255, rgb[0] * k) | 0, g = Math.min(255, rgb[1] * k) | 0, b = Math.min(255, rgb[2] * k) | 0;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
const RGBC = new Map();
export function rgbOf(hex) { let v = RGBC.get(hex); if (!v) { v = hexToRgb(hex); RGBC.set(hex, v); } return v; }

function fillBleed(c, w, h, style) { c.fillStyle = style; c.fillRect(-1, -1, w + 2, h + 2); }
function vgrad(c, h, stops) {
  const g = c.createLinearGradient(0, 0, 0, h);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}
/** soft blotches (stains / weathering) */
export function blotches(c, w, h, rnd, n, colors, rmin, rmax, alpha = 0.1) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = rmin + rnd() * (rmax - rmin);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const col = colors[(rnd() * colors.length) | 0];
    g.addColorStop(0, rgba(col, alpha)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
/** vertical grime streaks hanging from the top edge */
export function streaks(c, w, h, rnd, n, color = '#2a1c10', alpha = 0.1, maxLen = 0.6) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, len = h * (0.15 + rnd() * maxLen), wd = 1 + rnd() * 2.5;
    const g = c.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g; c.fillRect(x, 0, wd, len);
  }
}

// ----------------------------------------------------------------------------- stone & brick
/** Block masonry.  o: base, ch (course height), bw (block width), rough (0..1), spread, mortar, moss (0..1), hi */
export function stoneP(o = {}) {
  const base = o.base || '#a59e8d', ch = o.ch || 8, bw = o.bw || 13, rough = o.rough === undefined ? 0.28 : o.rough;
  const pal = ramp([shade(base, -(o.spread ?? 0.16)), base, shade(base, o.spread ?? 0.16), o.accent ? mix(base, o.accent, 0.35) : shade(base, 0.2)], 8);
  const mort = o.mortar || shade(base, -0.5);
  const hiA = o.hi ?? 0.2;
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, mort);
    const hi = [], lo = [];
    let y = h + 1, row = 0;
    while (y > -ch) {
      const hh = ch * (1 - rough * 0.35 + rnd() * rough * 0.7);
      const y0 = y - hh;
      let x = -bw * (row & 1 ? 0.45 + rnd() * 0.3 : rnd() * 0.25);
      while (x < w + 1) {
        const ww = bw * (1 - rough * 0.5 + rnd() * rough);
        c.fillStyle = pal[(rnd() * pal.length) | 0];
        c.fillRect(x + 0.45, y0 + 0.45, ww - 0.9, hh - 0.9);
        hi.push(x + 0.45, y0 + 0.45, ww - 0.9); lo.push(x + 0.45, y0 + hh - 1.45, ww - 0.9);
        x += ww;
      }
      y = y0; row++;
    }
    c.fillStyle = `rgba(255,250,235,${hiA})`; c.beginPath();
    for (let i = 0; i < hi.length; i += 3) c.rect(hi[i], hi[i + 1], hi[i + 2], 1);
    c.fill();
    c.fillStyle = 'rgba(15,8,5,0.2)'; c.beginPath();
    for (let i = 0; i < lo.length; i += 3) c.rect(lo[i], lo[i + 1], lo[i + 2], 1);
    c.fill();
    blotches(c, w, h, rnd, Math.max(3, (w * h / 700) | 0), ['#2a2218', '#e8e0c8', '#4a5a30'], 5, 16, 0.07);
    if (o.moss) {                                           // moss creeping up from the base
      const n = (w / 5 * o.moss) | 0;
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, r = 2 + rnd() * 5;
        c.fillStyle = rgba(rnd() < 0.5 ? '#4f7a2c' : '#6b8f3a', 0.28);
        c.beginPath(); c.ellipse(x, h - rnd() * h * 0.3, r, r * 0.6, 0, 0, 7); c.fill();
      }
    }
    if (o.cracks) {
      c.strokeStyle = 'rgba(25,15,8,0.35)'; c.lineWidth = 0.7;
      for (let i = 0; i < o.cracks; i++) {
        let x = rnd() * w, yy = rnd() * h * 0.7; c.beginPath(); c.moveTo(x, yy);
        for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 6; yy += 2 + rnd() * 4; c.lineTo(x, yy); }
        c.stroke();
      }
    }
  };
}

/** Fine regular cut stone (Imperial): large pale blocks, thin joints, optional string courses. */
export function ashlarP(o = {}) {
  const base = o.base || '#d9d3c0', ch = o.ch || 10, bw = o.bw || 18;
  const pal = ramp([shade(base, -0.09), base, shade(base, 0.08)], 6);
  const mort = o.mortar || shade(base, -0.32);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, mort);
    const hi = [];
    let y = h + 1, row = 0;
    while (y > -ch) {
      const y0 = y - ch;
      let x = -(row & 1 ? bw * 0.5 : 0) - rnd() * 1.5;
      while (x < w + 1) {
        c.fillStyle = pal[(rnd() * pal.length) | 0];
        c.fillRect(x + 0.35, y0 + 0.35, bw - 0.7, ch - 0.7);
        hi.push(x + 0.35, y0 + 0.35);
        x += bw;
      }
      y = y0; row++;
    }
    c.fillStyle = 'rgba(255,255,250,0.28)'; c.beginPath();
    for (let i = 0; i < hi.length; i += 2) c.rect(hi[i], hi[i + 1], bw - 0.7, 0.9);
    c.fill();
    if (o.band) {                                           // projecting string course (v positions from the bottom)
      for (const b of o.band) {
        const y1 = h - b;
        c.fillStyle = o.bandColor || shade(base, 0.1); c.fillRect(-1, y1 - 2.5, w + 2, 3);
        c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-1, y1 - 2.5, w + 2, 0.8);
        c.fillStyle = 'rgba(30,20,10,0.35)'; c.fillRect(-1, y1 + 0.5, w + 2, 1.4);
      }
    }
    blotches(c, w, h, rnd, Math.max(2, (w * h / 1100) | 0), ['#6a5a40', '#ffffff'], 6, 18, 0.05);
    if (o.moss) {
      for (let i = 0; i < w / 8 * o.moss; i++) {
        const x = rnd() * w, r = 2 + rnd() * 4;
        c.fillStyle = 'rgba(90,130,60,0.18)'; c.beginPath(); c.ellipse(x, h - rnd() * 6, r, r * 0.5, 0, 0, 7); c.fill();
      }
    }
  };
}

export function brickP(o = {}) {
  const base = o.base || '#a8553a', ch = o.ch || 4.2, bw = o.bw || 9;
  const pal = ramp([shade(base, -0.15), base, shade(base, 0.12), mix(base, '#c88a50', 0.35)], 6);
  const mort = o.mortar || '#cdbfa5';
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, mort);
    let y = h + 1, row = 0;
    while (y > -ch) {
      const y0 = y - ch;
      let x = -(row & 1 ? bw * 0.5 : 0);
      while (x < w + 1) {
        c.fillStyle = pal[(rnd() * pal.length) | 0];
        c.fillRect(x + 0.4, y0 + 0.4, bw - 0.8, ch - 0.8);
        x += bw;
      }
      y = y0; row++;
    }
    blotches(c, w, h, rnd, 4, ['#2a1a10', '#d0a070'], 4, 12, 0.08);
  };
}

// ----------------------------------------------------------------------------- plaster / timber / wattle
export function plasterP(o = {}) {
  const base = o.base || '#e6dcc0';
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, vgrad(c, h, [[0, shade(base, 0.04)], [1, shade(base, -0.06)]]));
    blotches(c, w, h, rnd, Math.max(4, (w * h / 500) | 0), [shade(base, -0.28), shade(base, 0.18), '#8a6a3a'], 4, 14, 0.09);
    c.fillStyle = 'rgba(70,50,30,0.07)';                    // speckle
    for (let i = 0; i < w * h / 70; i++) c.fillRect(rnd() * w, rnd() * h, 1, 1);
    streaks(c, w, h, rnd, Math.max(2, (w / 14) | 0), '#3a2a18', 0.07, 0.5);
    if (o.stain) {                                          // damp stain at the bottom
      c.fillStyle = vgrad(c, h, [[0.7, 'rgba(60,45,25,0)'], [1, 'rgba(60,45,25,0.18)']]); c.fillRect(0, 0, w, h);
    }
  };
}

/** Timber frame overlay (draw on top of plaster).  o: col, pw (stud spacing), t (thickness), brace ('x'|'v'|'none'), rails (v positions from top), sill */
export function timberFrame(c, w, h, rnd, o = {}) {
  const col = o.col || '#4a3120', t = o.t || 3, pw = o.pw || 18;
  const hl = shade(col, 0.28);
  const beams = [];            // [x0,y0,x1,y1] in horizontal / vertical
  const sill = o.sill === undefined ? t * 1.3 : o.sill;
  const top = o.top === undefined ? t * 1.1 : o.top;
  const nP = Math.max(1, Math.round((w - t) / pw));
  const sp = (w - t) / nP;
  const rails = o.rails || [];
  const bandsV = [0, ...rails.map(r => r), h];                // panel boundaries (v)
  // panels (between rails) get braces
  const drawBeam = (x0, y0, bw, bh) => {
    c.fillStyle = 'rgba(30,18,8,0.28)'; c.fillRect(x0 + 1.2, y0 + 1.2, bw, bh);
    c.fillStyle = col; c.fillRect(x0, y0, bw, bh);
    c.fillStyle = hl; if (bw < bh) c.fillRect(x0, y0, 0.9, bh); else c.fillRect(x0, y0, bw, 0.9);
  };
  // braces first (under studs)
  if (o.brace !== 'none') {
    for (let pi = 0; pi < bandsV.length - 1; pi++) {
      const v0 = bandsV[pi] + (pi === 0 ? top : t * 0.5), v1 = bandsV[pi + 1] - (pi === bandsV.length - 2 ? sill : t * 0.5);
      for (let i = 0; i < nP; i++) {
        const x0 = i * sp + t, x1 = (i + 1) * sp;
        const dir = o.brace === 'v' ? ((i + pi) & 1 ? 1 : -1) : (i & 1 ? 1 : -1);
        if (o.brace === 'x') {
          for (const d of [1, -1]) braceLine(c, d > 0 ? x0 : x1, v1, d > 0 ? x1 : x0, v0, t * 0.8, col, hl);
        } else if (((i + pi) & 1) === 0 || o.brace === 'all') braceLine(c, dir > 0 ? x0 : x1, v1, dir > 0 ? x1 : x0, v0, t * 0.85, col, hl);
      }
    }
  }
  for (let i = 0; i <= nP; i++) drawBeam(i * sp, 0, t, h);
  drawBeam(0, 0, w, top);
  drawBeam(0, h - sill, w, sill);
  for (const r of rails) drawBeam(0, r - t * 0.45, w, t * 0.9);
}
function braceLine(c, x0, y0, x1, y1, t, col, hl) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len * t / 2, ny = dx / len * t / 2;
  c.fillStyle = 'rgba(30,18,8,0.25)';
  c.beginPath(); c.moveTo(x0 + nx + 1, y0 + ny + 1); c.lineTo(x1 + nx + 1, y1 + ny + 1); c.lineTo(x1 - nx + 1, y1 - ny + 1); c.lineTo(x0 - nx + 1, y0 - ny + 1); c.fill();
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x0 + nx, y0 + ny); c.lineTo(x1 + nx, y1 + ny); c.lineTo(x1 - nx, y1 - ny); c.lineTo(x0 - nx, y0 - ny); c.fill();
  c.strokeStyle = hl; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x0 + nx, y0 + ny); c.lineTo(x1 + nx, y1 + ny); c.stroke();
}

/** Plaster with timber framing (feudal/castle). o: plaster colour, timber colour, pw, brace, rails, footing (stone height at the bottom) */
export function halfTimberP(o = {}) {
  const pl = plasterP({ base: o.base || '#e6dcc0', stain: true });
  const foot = o.footing ? stoneP({ base: o.footBase || '#8f8a7c', ch: 6, bw: 10, rough: 0.3 }) : null;
  return (c, w, h, rnd) => {
    pl(c, w, h, rnd);
    const fh = o.footing || 0;
    c.save(); c.beginPath(); c.rect(-1, -1, w + 2, h - fh + 1); c.clip();
    timberFrame(c, w, h - fh, rnd, o);
    c.restore();
    if (foot) {
      c.save(); c.translate(0, h - fh); c.beginPath(); c.rect(-1, 0, w + 2, fh + 1); c.clip(); foot(c, w, fh, rnd);
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(-1, 0, w + 2, 1.2);
      c.restore();
    }
  };
}

/** Dark age wattle & daub with dark rough posts and patches of exposed weave. */
export function wattleP(o = {}) {
  const base = o.base || '#c9ab74', wood = o.wood || '#5b3d22';
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, vgrad(c, h, [[0, shade(base, 0.06)], [1, shade(base, -0.12)]]));
    blotches(c, w, h, rnd, Math.max(5, (w * h / 350) | 0), [shade(base, -0.3), shade(base, 0.22), '#7a5a30'], 3, 11, 0.12);
    // exposed weave patches
    const np = 2 + ((w / 40) | 0);
    for (let p = 0; p < np; p++) {
      const px = rnd() * (w - 14), py = h * 0.2 + rnd() * h * 0.5, pw = 6 + rnd() * 8, ph = 4 + rnd() * 6;
      c.save(); c.beginPath(); c.moveTo(px, py + ph * 0.3); c.lineTo(px + pw * 0.35, py); c.lineTo(px + pw * 0.8, py + ph * 0.15); c.lineTo(px + pw, py + ph * 0.7); c.lineTo(px + pw * 0.6, py + ph); c.lineTo(px + pw * 0.15, py + ph * 0.9); c.closePath(); c.clip();
      c.fillStyle = shade(wood, -0.1); c.fillRect(px, py, pw, ph);
      c.strokeStyle = mix(wood, '#c9a060', 0.4); c.lineWidth = 1.1;
      for (let yy = py; yy < py + ph; yy += 2.6) { c.beginPath(); c.moveTo(px, yy); for (let xx = px; xx <= px + pw; xx += 3) c.lineTo(xx, yy + (((xx - px) / 3) & 1 ? 0.9 : -0.9)); c.stroke(); }
      c.restore();
    }
    // stakes / posts
    const n = Math.max(2, Math.round(w / 22));
    for (let i = 0; i <= n; i++) {
      const x = i * (w - 4) / n + (i > 0 && i < n ? (rnd() - 0.5) * 3 : 0);
      c.fillStyle = 'rgba(30,18,8,0.3)'; c.fillRect(x + 1.5, 0, 3.4, h);
      c.fillStyle = wood; c.fillRect(x, 0, 3.6, h);
      c.fillStyle = shade(wood, 0.3); c.fillRect(x, 0, 0.9, h);
    }
    // lashed rails
    for (const v of [0.32, 0.74]) {
      const y = h * v; c.fillStyle = shade(wood, -0.1); c.fillRect(-1, y, w + 2, 2.4);
      c.fillStyle = shade(wood, 0.25); c.fillRect(-1, y, w + 2, 0.7);
    }
  };
}

// ----------------------------------------------------------------------------- wood
export function planksP(o = {}) {
  const base = o.base || '#8a6038', bw = o.bw || 6.5;
  const pal = tones(base, 6, 0.14);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, shade(base, -0.5));
    for (let x = 0; x < w + bw; x += bw) {
      const ww = bw * (0.9 + rnd() * 0.2);
      c.fillStyle = pal[(rnd() * pal.length) | 0]; c.fillRect(x + 0.4, -1, ww - 0.8, h + 2);
      c.strokeStyle = 'rgba(40,22,8,0.28)'; c.lineWidth = 0.6;               // grain
      for (let k = 0; k < 2; k++) { const gx = x + 1 + rnd() * (ww - 2); c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx + (rnd() - 0.5) * 1.5, h); c.stroke(); }
      c.fillStyle = 'rgba(255,235,190,0.15)'; c.fillRect(x + 0.4, -1, 0.8, h + 2);
      if (rnd() < 0.3) { const ky = rnd() * h; c.fillStyle = 'rgba(40,22,8,0.35)'; c.beginPath(); c.ellipse(x + ww / 2, ky, 0.9, 1.5, 0, 0, 7); c.fill(); }
    }
    if (o.battens !== false) {
      c.fillStyle = shade(base, -0.28);
      for (const v of (o.rails || [0.12, 0.88])) c.fillRect(-1, h * v - 1.2, w + 2, 2.4);
      c.fillStyle = 'rgba(255,235,190,0.18)';
      for (const v of (o.rails || [0.12, 0.88])) c.fillRect(-1, h * v - 1.2, w + 2, 0.7);
    }
  };
}
export function planksHP(o = {}) {
  const base = o.base || '#8c6a42', rh = o.rh || 5.5;
  const pal = tones(base, 6, 0.13);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, shade(base, -0.5));
    let y = h + 1;
    while (y > -rh) {
      const y0 = y - rh;
      let x = -rnd() * 30;
      while (x < w) {
        const ww = 24 + rnd() * 26;
        c.fillStyle = pal[(rnd() * pal.length) | 0]; c.fillRect(x + 0.3, y0 + 0.3, ww - 0.6, rh - 0.5);
        c.fillStyle = 'rgba(255,235,190,0.17)'; c.fillRect(x + 0.3, y0 + 0.3, ww - 0.6, 0.8);
        c.fillStyle = 'rgba(30,16,6,0.28)'; c.fillRect(x + 0.3, y0 + rh - 1.1, ww - 0.6, 0.8);
        c.strokeStyle = 'rgba(40,22,8,0.2)'; c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(x + 2, y0 + rh * 0.45); c.lineTo(x + ww - 2, y0 + rh * 0.5); c.stroke();
        x += ww;
      }
      y = y0;
    }
  };
}
/** horizontal log wall */
export function logsP(o = {}) {
  const base = o.base || '#7a5230', d = o.d || 7.5;
  const pal = tones(base, 5, 0.1);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, shade(base, -0.55));
    let y = h + 1;
    while (y > -d) {
      const y0 = y - d;
      const g = c.createLinearGradient(0, y0, 0, y0 + d);
      const bc = pal[(rnd() * pal.length) | 0];
      g.addColorStop(0, shade(bc, 0.2)); g.addColorStop(0.45, bc); g.addColorStop(1, shade(bc, -0.35));
      c.fillStyle = g; c.fillRect(-1, y0 + 0.3, w + 2, d - 0.6);
      c.strokeStyle = 'rgba(30,16,6,0.3)'; c.lineWidth = 0.6;
      for (let k = 0; k < w / 14; k++) { const gx = rnd() * w; c.beginPath(); c.moveTo(gx, y0 + 1 + rnd() * d * 0.6); c.lineTo(gx + 6 + rnd() * 8, y0 + 1.5 + rnd() * d * 0.6); c.stroke(); }
      if (rnd() < 0.5) { const kx = rnd() * w; c.fillStyle = 'rgba(30,16,6,0.4)'; c.beginPath(); c.ellipse(kx, y0 + d * 0.5, 1.6, 1.1, 0, 0, 7); c.fill(); }
      y = y0;
    }
  };
}
export function flagstoneP(o = {}) {
  const base = o.base || '#9a9486';
  const pal = tones(base, 6, 0.12), mort = shade(base, -0.45), sz = o.sz || 9;
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, mort);
    for (let y = -2; y < h + sz; y += sz) {
      let x = -rnd() * sz;
      while (x < w + sz) {
        const ww = sz * (0.8 + rnd() * 0.6);
        c.fillStyle = pal[(rnd() * pal.length) | 0]; c.fillRect(x + 0.5, y + 0.5, ww - 1, sz - 1);
        x += ww;
      }
    }
    blotches(c, w, h, rnd, 6, ['#2a2218', '#e8e0c8'], 5, 14, 0.06);
  };
}
export function floorBoardsP(o = {}) {
  const base = o.base || '#7d5a38';
  const pal = tones(base, 5, 0.12);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, shade(base, -0.5));
    for (let x = 0; x < w + 5; x += 5) {
      c.fillStyle = pal[(rnd() * pal.length) | 0]; c.fillRect(x + 0.3, -1, 4.4, h + 2);
    }
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let k = 0; k < 6; k++) c.fillRect(rnd() * w, rnd() * h, 6, 0.8);
  };
}
export function dirtP(o = {}) {
  const base = o.base || '#7a5a38';
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, vgrad(c, h, [[0, shade(base, 0.08)], [1, shade(base, -0.12)]]));
    blotches(c, w, h, rnd, Math.max(8, (w * h / 300) | 0), [shade(base, -0.3), shade(base, 0.25), '#3a2a18'], 3, 12, 0.18);
    c.fillStyle = 'rgba(30,18,8,0.25)';
    for (let i = 0; i < w * h / 60; i++) c.fillRect(rnd() * w, rnd() * h, 1.2, 1.2);
    c.fillStyle = 'rgba(255,230,180,0.2)';
    for (let i = 0; i < w * h / 150; i++) c.fillRect(rnd() * w, rnd() * h, 1, 1);
  };
}

// ----------------------------------------------------------------------------- roofs (v = 0 at the ridge, v = h at the eave)
export function thatchP(o = {}) {
  const base = o.base || '#c8a24a';
  const pal = ramp([shade(base, -0.42), shade(base, -0.22), base, shade(base, 0.16), shade(base, 0.34)], 9);
  const bh = o.bh || 8.5;
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, vgrad(c, h, [[0, pal[1]], [1, pal[4]]]));
    const n = Math.ceil(h / bh) + 1;
    for (let i = 0; i < n; i++) {
      const y1 = Math.min(h + 2, (i + 1) * bh);            // lower (eave side) boundary of this bundle row
      const y0 = i * bh - 3;
      c.beginPath(); c.moveTo(-1, y0); c.lineTo(w + 1, y0);
      for (let x = w + 1; x >= -1; x -= 2.2) c.lineTo(x, y1 + (rnd() - 0.45) * 3.2);
      c.closePath();
      const g = c.createLinearGradient(0, y0, 0, y1 + 2);
      const k = 3 + ((rnd() * 3) | 0);
      g.addColorStop(0, pal[k - 1]); g.addColorStop(1, pal[Math.min(8, k + 1)]);
      c.fillStyle = g; c.fill();
      // straw strands
      const cols = [pal[7], pal[1], pal[5], pal[0]];
      for (let ci = 0; ci < 4; ci++) {
        c.strokeStyle = cols[ci]; c.lineWidth = ci === 3 ? 0.9 : 0.65; c.globalAlpha = ci === 3 ? 0.5 : 0.7; c.beginPath();
        for (let kk = 0; kk < w / 5; kk++) {
          const x = rnd() * w, len = bh * (0.55 + rnd() * 0.7);
          c.moveTo(x, y1 - len); c.lineTo(x + (rnd() - 0.5) * 1.6, y1 + (rnd() - 0.4) * 2);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
      // light fringe on the bundle edge and shadow beneath
      c.strokeStyle = 'rgba(255,238,170,0.28)'; c.lineWidth = 0.8; c.beginPath();
      c.moveTo(-1, y1 - 0.5); for (let x = 0; x <= w; x += 4) c.lineTo(x, y1 - 0.8 + ((x / 4) & 1 ? 0.8 : -0.4)); c.stroke();
      const sg = c.createLinearGradient(0, y1, 0, y1 + 4);
      sg.addColorStop(0, 'rgba(40,24,6,0.32)'); sg.addColorStop(1, 'rgba(40,24,6,0)');
      c.fillStyle = sg; c.fillRect(-1, y1 + 0.5, w + 2, 4);
    }
    if (o.moss) blotches(c, w, h, rnd, 5, ['#5a7a30', '#4a6a28'], 4, 10, 0.22);
    blotches(c, w, h, rnd, 4, ['#2a1c08', '#f0d890'], 6, 16, 0.08);
  };
}

/** scalloped flat tiles (castle / imperial / generic) */
export function tilesP(o = {}) {
  const base = o.base || '#c4572f', rh = o.rh || 6, tw = o.tw || 8;
  const pal = ramp([shade(base, -0.22), base, shade(base, 0.16), mix(base, '#e0a060', 0.25)], 8);
  const dark = o.dark || shade(base, -0.6);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, dark);
    const rows = Math.ceil(h / rh) + 1;
    for (let r = rows - 1; r >= 0; r--) {                  // r = 0 at the eave; paint from the ridge down
      const yb = h - r * rh;
      const off = (r & 1) ? tw / 2 : 0;
      const hiP = [], loP = [];
      for (let x = -tw + off - (rnd() * 0); x < w + tw; x += tw) {
        c.fillStyle = pal[(rnd() * pal.length) | 0];
        const x1 = x + tw;
        c.beginPath(); c.moveTo(x, yb - rh - 3); c.lineTo(x1, yb - rh - 3); c.lineTo(x1, yb - 1.5);
        c.quadraticCurveTo(x + tw / 2, yb + 1.6, x, yb - 1.5); c.closePath(); c.fill();
        hiP.push(x, yb - rh - 3 + 0.0, x1, yb - 1.5);
        loP.push(x, x1, yb);
      }
      c.strokeStyle = 'rgba(40,14,6,0.55)'; c.lineWidth = 0.8; c.beginPath();
      for (let i = 0; i < loP.length; i += 3) { c.moveTo(loP[i], loP[i + 2] - 1.5); c.quadraticCurveTo((loP[i] + loP[i + 1]) / 2, loP[i + 2] + 1.6, loP[i + 1], loP[i + 2] - 1.5); }
      c.stroke();
      c.strokeStyle = 'rgba(255,225,190,0.3)'; c.lineWidth = 0.7; c.beginPath();
      for (let i = 0; i < loP.length; i += 3) { c.moveTo(loP[i] + 0.4, loP[i + 2] - rh + 0.5); c.lineTo(loP[i] + 0.4, loP[i + 2] - 2.5); }
      c.stroke();
    }
    c.fillStyle = vgrad(c, h, [[0, 'rgba(255,230,190,0.1)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(20,6,2,0.14)']]); c.fillRect(0, 0, w, h);
    blotches(c, w, h, rnd, 4, ['#2a1008', '#ffe0b0'], 6, 16, 0.07);
    if (o.moss) blotches(c, w, h, rnd, 4, ['#5a7a30'], 3, 7, 0.2);
  };
}

/** Mediterranean barrel (pan) tiles: vertical ribs, segmented */
export function panTilesP(o = {}) {
  const base = o.base || '#cf6a38', tw = o.tw || 6.4, sl = o.sl || 13;
  const dark = shade(base, -0.5), mid = shade(base, -0.12), lite = shade(base, 0.2), hi = shade(base, 0.38);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, dark);
    const nc = Math.ceil(w / tw) + 1;
    for (let k = 0; k < nc; k++) {
      const x = k * tw;
      const nseg = Math.ceil(h / sl) + 1;
      for (let s = 0; s < nseg; s++) {
        const yb = h - s * sl + (rnd() - 0.5) * 0.8;
        const sh = 0.85 + rnd() * 0.3;
        const y0 = yb - sl - 2;
        c.fillStyle = rgbMulHex(mid, sh); c.fillRect(x + 0.2, y0, tw - 0.4, sl + 2);
        c.fillStyle = rgbMulHex(lite, sh); c.fillRect(x + tw * 0.28, y0, tw * 0.34, sl + 2);
        c.fillStyle = rgbMulHex(hi, sh); c.fillRect(x + tw * 0.34, y0, tw * 0.14, sl + 2);
        c.fillStyle = 'rgba(30,10,4,0.55)'; c.fillRect(x + 0.2, yb - 1.2, tw - 0.4, 1.4);
        c.fillStyle = 'rgba(255,215,170,0.25)'; c.fillRect(x + 0.2, yb - sl - 2, tw - 0.4, 0.8);
      }
    }
    blotches(c, w, h, rnd, 4, ['#2a1008', '#ffe0b0'], 6, 16, 0.07);
  };
}
function rgbMulHex(hex, k) { return rgbMul(rgbOf(hex), k); }

export function slateP(o = {}) {
  const base = o.base || '#5f6c82', rh = o.rh || 5.2, sw = o.sw || 8.5;
  const pal = ramp([shade(base, -0.16), base, shade(base, 0.14), mix(base, '#7a8a6a', 0.2)], 8);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, shade(base, -0.6));
    const rows = Math.ceil(h / rh) + 1;
    for (let r = rows - 1; r >= 0; r--) {
      const yb = h - r * rh, off = (r & 1) ? sw / 2 : 0;
      const lo = [], hi = [];
      for (let x = -sw + off; x < w + sw; x += sw) {
        c.fillStyle = pal[(rnd() * pal.length) | 0];
        c.fillRect(x + 0.35, yb - rh - 2.5, sw - 0.7, rh + 2.5 - 0.5);
        lo.push(x, yb); hi.push(x, yb - rh - 2.5);
      }
      c.fillStyle = 'rgba(10,12,22,0.45)'; c.beginPath(); for (let i = 0; i < lo.length; i += 2) c.rect(lo[i] + 0.35, lo[i + 1] - 1.0, sw - 0.7, 1.0); c.fill();
      c.fillStyle = 'rgba(220,232,255,0.11)'; c.beginPath(); for (let i = 0; i < hi.length; i += 2) c.rect(hi[i] + 0.35, hi[i + 1], 0.7, rh + 1.5); c.fill();
    }
    c.fillStyle = vgrad(c, h, [[0, 'rgba(235,245,255,0.1)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(5,8,20,0.16)']]); c.fillRect(0, 0, w, h);
    blotches(c, w, h, rnd, 4, ['#10121c', '#e0eaff'], 6, 16, 0.06);
  };
}
export function shinglesP(o = {}) {
  const base = o.base || '#8a6a44', rh = o.rh || 5.6, sw = o.sw || 5;
  const pal = ramp([shade(base, -0.22), base, shade(base, 0.12), mix(base, '#8a8a7a', 0.3)], 8);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, shade(base, -0.62));
    const rows = Math.ceil(h / rh) + 1;
    for (let r = rows - 1; r >= 0; r--) {
      const yb = h - r * rh, off = (r & 1) ? sw / 2 : 0;
      for (let x = -sw + off; x < w + sw; x += sw) {
        const hh = rh + 2.5 + rnd() * 1.2;
        c.fillStyle = pal[(rnd() * pal.length) | 0];
        c.beginPath(); c.moveTo(x + 0.25, yb - hh); c.lineTo(x + sw - 0.25, yb - hh); c.lineTo(x + sw - 0.25, yb - 1); c.lineTo(x + sw / 2, yb + 0.5); c.lineTo(x + 0.25, yb - 1); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,235,190,0.15)'; c.fillRect(x + 0.25, yb - hh + 2.5, 0.7, hh - 3.5);
      }
      c.fillStyle = 'rgba(25,12,4,0.35)'; c.fillRect(-1, yb - 1.1, w + 2, 0.9);
    }
    c.fillStyle = vgrad(c, h, [[0, 'rgba(255,240,200,0.08)'], [1, 'rgba(15,6,0,0.14)']]); c.fillRect(0, 0, w, h);
    blotches(c, w, h, rnd, 4, ['#1a0e04', '#e8d8b0', '#4a6a30'], 6, 16, 0.08);
  };
}
/** metal / copper standing-seam roof */
export function copperP(o = {}) {
  const base = o.base || '#4f9a86', sp = o.sp || 7;
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, vgrad(c, h, [[0, shade(base, 0.15)], [1, shade(base, -0.15)]]));
    for (let x = 0; x < w + sp; x += sp) {
      c.fillStyle = 'rgba(10,30,25,0.32)'; c.fillRect(x, -1, 1.1, h + 2);
      c.fillStyle = 'rgba(230,255,240,0.28)'; c.fillRect(x + 1.1, -1, 0.9, h + 2);
    }
    blotches(c, w, h, rnd, 6, ['#bfe8d0', '#2a5a48', '#8aa060'], 5, 14, 0.14);
  };
}
/** rough planks used for sheds, lean-tos and scaffolding decks */
export function plankRoofP(o = {}) {
  const base = o.base || '#7d5c3a', rh = o.rh || 6;
  const pal = tones(base, 6, 0.14);
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, shade(base, -0.55));
    const rows = Math.ceil(h / rh) + 1;
    for (let r = rows - 1; r >= 0; r--) {
      const yb = h - r * rh;
      let x = -rnd() * 30;
      while (x < w) {
        const ww = 22 + rnd() * 28;
        c.fillStyle = pal[(rnd() * pal.length) | 0]; c.fillRect(x + 0.3, yb - rh - 1.5, ww - 0.6, rh + 1.5);
        c.fillStyle = 'rgba(255,235,190,0.14)'; c.fillRect(x + 0.3, yb - rh - 1.5, ww - 0.6, 0.8);
        x += ww;
      }
      c.fillStyle = 'rgba(25,12,4,0.38)'; c.fillRect(-1, yb - 1.2, w + 2, 1.2);
    }
    streaks(c, w, h, rnd, 5, '#1a0e04', 0.12, 0.5);
  };
}
/** canvas / cloth with optional stripes (awnings, tents) */
export function clothP(o = {}) {
  const base = o.base || '#e8dcc0', stripe = o.stripe || '#c33', sw = o.sw || 8;
  return (c, w, h, rnd) => {
    fillBleed(c, w, h, base);
    if (stripe) {
      c.fillStyle = stripe;
      for (let x = 0; x < w + sw; x += sw * 2) c.fillRect(x, -1, sw, h + 2);
    }
    // folds
    c.fillStyle = 'rgba(20,10,0,0.07)';
    for (let x = 3; x < w; x += sw) c.fillRect(x, -1, 1.6, h + 2);
    c.fillStyle = 'rgba(255,255,255,0.1)';
    for (let x = 3 + sw * 0.5; x < w; x += sw) c.fillRect(x, -1, 1.2, h + 2);
    blotches(c, w, h, rnd, 3, ['#3a2a10'], 6, 14, 0.06);
  };
}

// ----------------------------------------------------------------------------- decals (drawn in face space on top of walls)
/** Wooden door.  o: style 'plain'|'arch'|'double'|'open', frame colour, wood colour, iron */
export function doorD(c, x, y, w, h, o = {}) {
  const wood = o.wood || '#6a4526', frame = o.frame || '#3a2a1c', iron = o.iron || '#2a2a30';
  const arch = o.style === 'arch' || o.style === 'archdouble' || o.arch;
  const double = o.style === 'double' || o.style === 'archdouble';
  const fr = o.fr ?? 2.2;
  // outer frame / surround
  const path = (xx, yy, ww, hh) => {
    c.beginPath();
    if (arch) {
      const r = ww / 2;
      c.moveTo(xx, yy + hh); c.lineTo(xx, yy + r); c.arc(xx + r, yy + r, r, Math.PI, 0); c.lineTo(xx + ww, yy + hh); c.closePath();
    } else c.rect(xx, yy, ww, hh);
  };
  if (o.surround) {                                      // stone surround
    path(x - fr - 1.5, y - fr - 1.5, w + (fr + 1.5) * 2, h + fr + 1.5); c.fillStyle = o.surround; c.fill();
    c.strokeStyle = 'rgba(20,10,0,0.4)'; c.lineWidth = 0.7; c.stroke();
  }
  path(x - fr, y - fr, w + fr * 2, h + fr); c.fillStyle = frame; c.fill();
  if (o.style === 'open') {                              // dark interior
    path(x, y, w, h);
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#120a06'); g.addColorStop(1, o.glow ? '#5a3a20' : '#251810');
    c.fillStyle = g; c.fill();
    if (o.glow) { const gg = c.createRadialGradient(x + w / 2, y + h, 1, x + w / 2, y + h, w); gg.addColorStop(0, 'rgba(255,160,60,0.5)'); gg.addColorStop(1, 'rgba(255,120,30,0)'); path(x, y, w, h); c.fillStyle = gg; c.fill(); }
    return;
  }
  c.save(); path(x, y, w, h); c.clip();
  const nb = double ? 2 : 1;
  for (let d = 0; d < nb; d++) {
    const dx = x + d * w / nb, dw = w / nb;
    const pw = Math.max(2.5, dw / Math.round(dw / 3.6));
    for (let px = dx; px < dx + dw - 0.1; px += pw) {
      c.fillStyle = ((px / pw) | 0) % 2 ? shade(wood, 0.06) : wood; c.fillRect(px, y, pw, h);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px + pw - 0.6, y, 0.6, h);
      c.fillStyle = 'rgba(255,230,180,0.14)'; c.fillRect(px, y, 0.7, h);
    }
    // iron straps
    if (o.iron !== false) {
      c.fillStyle = iron;
      for (const v of [0.22, 0.72]) { c.fillRect(dx, y + h * v, dw, Math.max(1.5, h * 0.07)); }
      c.fillStyle = 'rgba(255,255,255,0.2)';
      for (const v of [0.22, 0.72]) c.fillRect(dx, y + h * v, dw, 0.6);
    }
    if (d === 0 && double) { /* handled below */ }
  }
  if (double) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x + w / 2 - 0.5, y, 1, h); }
  // bottom shadow / threshold
  const sg = c.createLinearGradient(0, y, 0, y + h); sg.addColorStop(0, 'rgba(0,0,0,0.3)'); sg.addColorStop(0.2, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.1)');
  c.fillStyle = sg; c.fillRect(x, y, w, h);
  c.restore();
  // handle
  c.fillStyle = '#d8b050'; const hx = double ? x + w / 2 - 2.6 : x + w - 3.4, hy = y + h * 0.55;
  c.beginPath(); c.arc(hx, hy, 1.1, 0, 7); c.fill();
  if (double) { c.beginPath(); c.arc(x + w / 2 + 2.6, hy, 1.1, 0, 7); c.fill(); }
  // step
  if (o.step !== false) { c.fillStyle = o.stepColor || '#8d877a'; c.fillRect(x - fr - 1, y + h, w + fr * 2 + 2, 1.8); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x - fr - 1, y + h, w + fr * 2 + 2, 0.7); }
}

/** Window.  o: style 'plain'|'shutter'|'arch'|'slit'|'round'|'lattice', trim colour, shutter colour */
export function windowD(c, x, y, w, h, o = {}) {
  const trim = o.trim || '#5a4028', style = o.style || 'plain';
  const arch = style === 'arch' || o.arch;
  const path = (xx, yy, ww, hh) => {
    c.beginPath();
    if (style === 'round') { c.ellipse(xx + ww / 2, yy + hh / 2, ww / 2, hh / 2, 0, 0, 7); return; }
    if (arch) { const r = ww / 2; c.moveTo(xx, yy + hh); c.lineTo(xx, yy + r); c.arc(xx + r, yy + r, r, Math.PI, 0); c.lineTo(xx + ww, yy + hh); c.closePath(); } else c.rect(xx, yy, ww, hh);
  };
  const fr = style === 'slit' ? 1 : (o.fr ?? 1.8);
  if (style === 'shutter') {                                  // open shutters on both sides
    const sw = w * 0.5, col = o.shutter || '#6a4a2a';
    for (const sx of [x - sw - fr - 0.4, x + w + fr + 0.4]) {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx + 0.8, y - fr + 0.8, sw, h + fr * 2);
      c.fillStyle = col; c.fillRect(sx, y - fr, sw, h + fr * 2);
      c.fillStyle = 'rgba(0,0,0,0.28)'; for (let sy = y - fr + 2; sy < y + h + fr; sy += 2.4) c.fillRect(sx + 0.4, sy, sw - 0.8, 0.7);
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(sx, y - fr, 0.7, h + fr * 2);
    }
  }
  if (o.surround) { path(x - fr - 1.4, y - fr - 1.4, w + (fr + 1.4) * 2, h + fr + 1.4); c.fillStyle = o.surround; c.fill(); c.strokeStyle = 'rgba(20,10,0,0.35)'; c.lineWidth = 0.7; c.stroke(); }
  path(x - fr, y - fr, w + fr * 2, h + fr * 2); c.fillStyle = trim; c.fill();
  c.save(); path(x, y, w, h); c.clip();
  const glassA = o.glassA || '#8fb4c8', glassB = o.glassB || '#2c3f52';
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, o.lit ? '#ffe8a0' : glassA); g.addColorStop(0.55, o.lit ? '#e8a850' : '#4a647a'); g.addColorStop(1, o.lit ? '#a8602a' : glassB);
  c.fillStyle = g; c.fillRect(x, y, w, h);
  if (style === 'slit') { c.fillStyle = '#0c0805'; c.fillRect(x, y, w, h); }
  // inner shadow top / left
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y, w, h * 0.16); c.fillRect(x, y, w * 0.16, h);
  if (style !== 'slit') {
    c.strokeStyle = trim; c.lineWidth = Math.max(0.9, w * 0.09);
    c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.5); c.lineTo(x + w, y + h * 0.5); c.stroke();
    if (style === 'lattice') {
      c.lineWidth = 0.6; c.strokeStyle = 'rgba(30,24,16,0.7)'; c.beginPath();
      for (let k = 1; k < 4; k++) { c.moveTo(x + w * k / 4, y); c.lineTo(x + w * k / 4, y + h); c.moveTo(x, y + h * k / 4); c.lineTo(x + w, y + h * k / 4); }
      c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(x + w * 0.1, y + h * 0.9); c.lineTo(x + w * 0.5, y + h * 0.1); c.lineTo(x + w * 0.62, y + h * 0.1); c.lineTo(x + w * 0.22, y + h * 0.9); c.fill();
  }
  c.restore();
  if (style !== 'round' && o.sill !== false) { c.fillStyle = o.sillColor || '#8d877a'; c.fillRect(x - fr - 1, y + h + fr, w + fr * 2 + 2, 1.6); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x - fr - 1, y + h + fr, w + fr * 2 + 2, 0.6); }
  if (o.flowers) {                                            // flower box
    c.fillStyle = '#6a4526'; c.fillRect(x - 1, y + h + fr + 1, w + 2, 3);
    for (let i = 0; i < 5; i++) { c.fillStyle = ['#d03a3a', '#e8c030', '#3f8f3a', '#c050a0'][i % 4]; c.beginPath(); c.arc(x + 0.5 + i * (w - 1) / 4, y + h + fr + 0.4, 1.3, 0, 7); c.fill(); }
  }
}

/** Hanging banner (team coloured) in face space: swallowtail bottom, trim and emblem. */
export function bannerD(c, x, y, w, h, tc, o = {}) {
  const dark = tc.dark, main = tc.main, light = tc.light;
  c.save();
  // rod
  c.fillStyle = '#3a2a1c'; c.fillRect(x - 1.5, y - 1.6, w + 3, 2); c.fillStyle = '#d8b050'; c.fillRect(x - 2.4, y - 1.8, 1.6, 2.4); c.fillRect(x + w + 0.8, y - 1.8, 1.6, 2.4);
  const sway = o.sway || 0;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y);
  c.lineTo(x + w + sway * 0.4, y + h); c.lineTo(x + w / 2 + sway, y + h - w * 0.38); c.lineTo(x + sway * 0.2, y + h); c.closePath();
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, light); g.addColorStop(0.25, main); g.addColorStop(1, dark);
  c.fillStyle = g; c.fill();
  c.strokeStyle = dark; c.lineWidth = 0.8; c.stroke();
  // trim
  c.strokeStyle = o.trim || '#e8c860'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 1.5, y + 1.5); c.lineTo(x + w - 1.5, y + 1.5); c.stroke();
  // emblem
  const ex = x + w / 2 + sway * 0.4, ey = y + h * 0.38;
  c.fillStyle = o.emblem || '#f4eddc';
  if (o.shape === 'cross') { c.fillRect(ex - 1, ey - w * 0.3, 2, w * 0.6); c.fillRect(ex - w * 0.22, ey - 1, w * 0.44, 2); }
  else if (o.shape === 'chevron') { c.beginPath(); c.moveTo(ex - w * 0.3, ey - 2); c.lineTo(ex, ey + w * 0.15); c.lineTo(ex + w * 0.3, ey - 2); c.lineTo(ex + w * 0.3, ey + 1); c.lineTo(ex, ey + w * 0.3); c.lineTo(ex - w * 0.3, ey + 1); c.closePath(); c.fill(); }
  else { c.beginPath(); c.arc(ex, ey, w * 0.2, 0, 7); c.fill(); c.fillStyle = main; c.beginPath(); c.arc(ex, ey, w * 0.09, 0, 7); c.fill(); }
  c.restore();
}

/** simple heraldic shield (wall decoration) */
export function shieldD(c, x, y, w, h, tc, o = {}) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h * 0.5); c.quadraticCurveTo(x + w, y + h * 0.9, x + w / 2, y + h); c.quadraticCurveTo(x, y + h * 0.9, x, y + h * 0.5); c.closePath();
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, tc.light); g.addColorStop(0.4, tc.main); g.addColorStop(1, tc.dark);
  c.fillStyle = g; c.fill(); c.strokeStyle = o.rim || '#e0c060'; c.lineWidth = 1; c.stroke();
  c.fillStyle = o.emblem || '#f4eddc'; c.fillRect(x + w / 2 - 0.8, y + 1.5, 1.6, h * 0.65); c.fillRect(x + 2, y + h * 0.25, w - 4, 1.6);
}

/** round clock face decal */
export function clockD(c, cx, cy, r, o = {}) {
  c.beginPath(); c.arc(cx, cy, r + 1.8, 0, 7); c.fillStyle = o.rim || '#c8a040'; c.fill();
  c.beginPath(); c.arc(cx, cy, r, 0, 7); const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r); g.addColorStop(0, '#fff8e4'); g.addColorStop(1, '#d8cba8'); c.fillStyle = g; c.fill();
  c.strokeStyle = '#3a2a18'; c.lineWidth = 0.7; c.stroke();
  c.strokeStyle = '#3a2a18'; c.lineWidth = 0.9;
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); c.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95); c.stroke(); }
  c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + r * 0.1, cy - r * 0.6); c.stroke();
  c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + r * 0.55, cy + r * 0.1); c.stroke();
}
/** carved stone / painted heraldic panel */
export function crestD(c, x, y, w, h, tc, o = {}) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h * 0.55); c.quadraticCurveTo(x + w, y + h, x + w / 2, y + h); c.quadraticCurveTo(x, y + h, x, y + h * 0.55); c.closePath();
  c.fillStyle = o.rim || '#c8a040'; c.fill();
  c.beginPath(); const i = 1.3; c.moveTo(x + i, y + i); c.lineTo(x + w - i, y + i); c.lineTo(x + w - i, y + h * 0.55); c.quadraticCurveTo(x + w - i, y + h - i, x + w / 2, y + h - i); c.quadraticCurveTo(x + i, y + h - i, x + i, y + h * 0.55); c.closePath();
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, tc.light); g.addColorStop(0.45, tc.main); g.addColorStop(1, tc.dark); c.fillStyle = g; c.fill();
  c.fillStyle = o.emblem || '#f4eddc'; c.fillRect(x + w / 2 - 0.8, y + h * 0.18, 1.6, h * 0.55); c.fillRect(x + w * 0.28, y + h * 0.34, w * 0.44, 1.6);
}

/** round shield on a wall: team coloured with metal rim and boss */
export function roundShieldD(c, cx, cy, r, tc, o = {}) {
  c.beginPath(); c.arc(cx + 0.8, cy + 0.8, r + 1, 0, 7); c.fillStyle = 'rgba(20,10,4,0.4)'; c.fill();
  c.beginPath(); c.arc(cx, cy, r + 0.9, 0, 7); c.fillStyle = o.rim || '#6a5a48'; c.fill();
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0.5, cx, cy, r);
  g.addColorStop(0, tc.light); g.addColorStop(0.45, tc.main); g.addColorStop(1, tc.dark);
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = g; c.fill();
  if (o.cross !== false) { c.fillStyle = o.emblem || 'rgba(245,238,220,0.95)'; c.fillRect(cx - r * 0.12, cy - r * 0.8, r * 0.24, r * 1.6); c.fillRect(cx - r * 0.8, cy - r * 0.12, r * 1.6, r * 0.24); }
  c.beginPath(); c.arc(cx, cy, r * 0.28, 0, 7); c.fillStyle = '#c8ccd4'; c.fill(); c.strokeStyle = 'rgba(20,20,30,0.7)'; c.lineWidth = 0.5; c.stroke();
}
/** two crossed swords (wall emblem) */
export function swordsD(c, cx, cy, s, o = {}) {
  c.save(); c.translate(cx, cy); c.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    c.save(); c.rotate(sgn * 0.7);
    c.fillStyle = 'rgba(20,10,4,0.45)'; c.fillRect(-1.6 + 0.8, -s + 0.8, 3.2, s * 1.7);
    const g = c.createLinearGradient(-1.5, 0, 1.5, 0); g.addColorStop(0, '#f0f2f6'); g.addColorStop(1, '#8a8e9a');
    c.fillStyle = g; c.beginPath(); c.moveTo(-1.5, s * 0.55); c.lineTo(-1.5, -s * 0.9); c.lineTo(0, -s); c.lineTo(1.5, -s * 0.9); c.lineTo(1.5, s * 0.55); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,20,30,0.7)'; c.lineWidth = 0.6; c.stroke();
    c.fillStyle = o.guard || '#d8b050'; c.fillRect(-4.2, s * 0.5, 8.4, 1.9);
    c.fillStyle = '#4a2e1a'; c.fillRect(-1, s * 0.62, 2, s * 0.4);
    c.fillStyle = o.guard || '#d8b050'; c.beginPath(); c.arc(0, s * 1.08, 1.4, 0, 7); c.fill();
    c.restore();
  }
  c.restore();
}
/** Dutch (split) stable door: closed lower half, open dark upper half with a horse head peeking out */
export function dutchDoorD(c, x, y, w, h, o = {}) {
  const frame = o.frame || '#e8e0cc', wood = o.wood || '#8a4a2e';
  c.fillStyle = 'rgba(20,10,4,0.35)'; c.fillRect(x - 1.5, y - 1.5, w + 4.5, h + 3);
  c.fillStyle = frame; c.fillRect(x - 2.2, y - 2.2, w + 4.4, h + 2.2);
  const hh = h * 0.46;
  const g = c.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, '#0e0806'); g.addColorStop(1, '#2a1a12');
  c.fillStyle = g; c.fillRect(x, y, w, hh);
  // lower leaf
  for (let px = x; px < x + w; px += 2.8) { c.fillStyle = ((px - x) / 2.8 | 0) % 2 ? shade(wood, 0.06) : wood; c.fillRect(px, y + hh, 2.8, h - hh); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px + 2.2, y + hh, 0.6, h - hh); }
  c.fillStyle = '#3a2418'; c.fillRect(x, y + hh, w, 1.6);
  c.strokeStyle = '#2a1a10'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + hh + 2); c.lineTo(x + w, y + h - 1); c.moveTo(x + w, y + hh + 2); c.lineTo(x, y + h - 1); c.stroke();
  if (o.horse) {                                      // horse head silhouette (facing right)
    const hx = x + w * 0.5, hy = y + hh;
    c.fillStyle = o.horse; c.beginPath();
    c.moveTo(hx - 3.2, hy); c.quadraticCurveTo(hx - 4.2, hy - hh * 0.55, hx - 2, hy - hh * 0.85); c.lineTo(hx - 1.2, hy - hh * 1.05); c.lineTo(hx + 0.4, hy - hh * 0.85);
    c.quadraticCurveTo(hx + 3.4, hy - hh * 0.9, hx + 5.2, hy - hh * 0.55); c.quadraticCurveTo(hx + 5.8, hy - hh * 0.35, hx + 4.6, hy - hh * 0.3); c.quadraticCurveTo(hx + 2.8, hy - hh * 0.35, hx + 2, hy); c.closePath(); c.fill();
    c.fillStyle = '#1a0e08'; c.beginPath(); c.arc(hx + 1.2, hy - hh * 0.62, 0.7, 0, 7); c.fill();
    c.fillStyle = '#e8d8c0'; c.fillRect(hx + 3.6, hy - hh * 0.38, 1.6, 1.2);
  }
}
/** cogwheel emblem */
export function cogD(c, cx, cy, r, o = {}) {
  c.save(); c.translate(cx, cy);
  const n = 8;
  c.beginPath();
  for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; c.lineTo(Math.cos(a - 0.17) * r * 0.8, Math.sin(a - 0.17) * r * 0.8); c.lineTo(Math.cos(a - 0.12) * r * 1.08, Math.sin(a - 0.12) * r * 1.08); c.lineTo(Math.cos(a + 0.12) * r * 1.08, Math.sin(a + 0.12) * r * 1.08); c.lineTo(Math.cos(a + 0.17) * r * 0.8, Math.sin(a + 0.17) * r * 0.8); }
  c.closePath(); c.fillStyle = o.col || '#3e3a34'; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.8; c.stroke();
  c.beginPath(); c.arc(0, 0, r * 0.45, 0, 7); c.fillStyle = o.hole || '#14100c'; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(-r * 0.7, -r * 0.7, r * 0.5, 1);
  c.restore();
}

/** stained-glass rose window decal */
export function roseD(c, cx, cy, r, o = {}) {
  c.beginPath(); c.arc(cx, cy, r + 1.8, 0, 7); c.fillStyle = o.frame || '#cfc8b4'; c.fill();
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = '#10161e'; c.fill();
  const cols = ['#3a6fc8', '#c8383a', '#e8b83a', '#3a9a5a', '#8a4ac0', '#e07a2a'];
  for (let i = 0; i < 8; i++) {
    const a0 = i * Math.PI / 4 + 0.05, a1 = a0 + Math.PI / 4 - 0.1;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r * 0.9, a0, a1); c.closePath(); c.fillStyle = cols[i % cols.length]; c.globalAlpha = 0.9; c.fill(); c.globalAlpha = 1;
  }
  c.strokeStyle = '#2a2420'; c.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke(); }
  c.beginPath(); c.arc(cx, cy, r * 0.38, 0, 7); c.stroke();
  c.beginPath(); c.arc(cx, cy, r * 0.2, 0, 7); c.fillStyle = '#f4e8a8'; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(cx - r * 0.4, cy - r * 0.4, r * 0.3, 0, 7); c.fill();
}
/** tall pointed (lancet) window */
export function lancetD(c, x, y, w, h, o = {}) {
  const path = (xx, yy, ww, hh) => { c.beginPath(); c.moveTo(xx, yy + hh); c.lineTo(xx, yy + ww * 0.9); c.quadraticCurveTo(xx, yy + ww * 0.25, xx + ww / 2, yy); c.quadraticCurveTo(xx + ww, yy + ww * 0.25, xx + ww, yy + ww * 0.9); c.lineTo(xx + ww, yy + hh); c.closePath(); };
  path(x - 1.6, y - 1.6, w + 3.2, h + 1.6); c.fillStyle = o.frame || '#cfc8b4'; c.fill(); c.strokeStyle = 'rgba(30,20,10,0.4)'; c.lineWidth = 0.6; c.stroke();
  c.save(); path(x, y, w, h); c.clip();
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, o.a || '#6a9ad8'); g.addColorStop(0.6, o.b || '#2a4a88'); g.addColorStop(1, '#14203a'); c.fillStyle = g; c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(200,60,60,0.5)'; c.fillRect(x, y + h * 0.55, w, h * 0.12);
  c.strokeStyle = '#1a1814'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.45); c.lineTo(x + w, y + h * 0.45); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x + 1, y + 2, 1.2, h * 0.6);
  c.restore();
}
/** arrow slit / loophole */
export function slitD(c, x, y, w, h) {
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x - 0.8, y - 0.8, w + 1.6, h + 1.6);
  c.fillStyle = '#0c0805'; c.fillRect(x, y, w, h); c.fillStyle = '#2a2018'; c.fillRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.3);
  c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(x, y + h, w, 0.7);
}
/** portcullis / iron-bound gate in an arched opening */
export function portcullisD(c, x, y, w, h, o = {}) {
  const r = w / 2;
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + r); c.arc(x + r, y + r, r, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath();
  c.fillStyle = o.frame || '#8d877a'; c.fill();
  const i = 2; c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i, y + r); c.arc(x + r, y + r, r - i, Math.PI, 0); c.lineTo(x + w - i, y + h); c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#0e0806'); g.addColorStop(1, '#2a1c14'); c.fillStyle = g; c.fill();
  c.save(); c.clip();
  c.strokeStyle = '#46403a'; c.lineWidth = 1.2;
  for (let xx = x + 3; xx < x + w; xx += 3.4) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h * (o.open ? 0.35 : 1)); c.stroke(); }
  for (let yy = y + 4; yy < y + h * (o.open ? 0.35 : 1); yy += 4.6) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
  c.fillStyle = '#6a645c'; for (let xx = x + 3; xx < x + w; xx += 3.4) { c.beginPath(); c.moveTo(xx - 1, y + h * (o.open ? 0.35 : 1)); c.lineTo(xx, y + h * (o.open ? 0.35 : 1) + 3); c.lineTo(xx + 1, y + h * (o.open ? 0.35 : 1)); c.fill(); }
  c.restore();
}
