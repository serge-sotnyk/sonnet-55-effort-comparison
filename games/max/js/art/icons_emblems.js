// 'age:0..3' emblems and 'civ:<id>' civilization icons (opaque rounded squares).
import { C, S, circ, ell, rr, poly, smooth, n2, DEG, frameIcon, BG } from './icons_kit.js';
import { sparkles } from './icons_parts.js';
import { drawEmblem, CIV_BG } from './menu_emblems.js';

const AGE_BG = [
  { c: ['#8f7e6c', '#443a30', '#14100c'], glow: '#ff9a40' },       // Dark: night, torch light
  { c: ['#b6e56c', '#4f9f3c', '#1b5a2a'], glow: '#f4ffb0' },       // Feudal: green
  { c: ['#8ab8f0', '#3b68b4', '#16295f'], glow: '#d8ecff' },       // Castle: blue
  { c: ['#c394f0', '#6d44b4', '#2c1660'], glow: '#fff0b8' },       // Imperial: purple
];

function flameShape(x, y, s) { return S(`M${n2(x)} ${n2(y - 30 * s)}C${n2(x + 4 * s)} ${n2(y - 18 * s)} ${n2(x + 15 * s)} ${n2(y - 12 * s)} ${n2(x + 16 * s)} ${n2(y + 3 * s)}C${n2(x + 17 * s)} ${n2(y + 16 * s)} ${n2(x + 9 * s)} ${n2(y + 24 * s)} ${n2(x)} ${n2(y + 25 * s)}C${n2(x - 9 * s)} ${n2(y + 24 * s)} ${n2(x - 17 * s)} ${n2(y + 16 * s)} ${n2(x - 16 * s)} ${n2(y + 3 * s)}C${n2(x - 15 * s)} ${n2(y - 6 * s)} ${n2(x - 9 * s)} ${n2(y - 10 * s)} ${n2(x - 7 * s)} ${n2(y - 18 * s)}C${n2(x - 4 * s)} ${n2(y - 14 * s)} ${n2(x - 2 * s)} ${n2(y - 22 * s)} ${n2(x)} ${n2(y - 30 * s)}Z`); }

const AGE_DRAW = [
  // Dark Age: a burning torch
  g => {
    g.glow(32, 22, 30, '#ffb060', 0.55);
    g.tube(20, 62, 36, 31, 6.4, C.woodDk, { lw: 1.6 });
    g.obj(S('M26 38 L44 30 L43 20 L28 24 Z'), ['#d8c09a', '#a8865a', '#5a4026'], { lw: 1.5, ang: 60 });
    g.line(27, 30, 43, 25, 'rgba(60,40,20,0.5)', 1.4, { lw: 0 });
    g.obj(flameShape(36, 10, 1.0), ['#fff2a0', '#ff9a30', '#d8261e'], { lw: 1.7, ang: 80, hi: 0.3, sh: 0.1 });
    g.obj(flameShape(36, 14, 0.52), ['#ffffff', '#fff0a0', '#ffc030'], { lw: 0, ang: 80, hi: 0, sh: 0 });
    sparkles(g, [[52, 8, 3], [16, 12, 2.4], [56, 24, 2]]);
  },
  // Feudal Age: a shield
  g => {
    g.glow(32, 32, 30, '#f4ffb0', 0.4);
    g.shadow(32, 60, 20, 3, 0.35);
    const outer = S('M8.5 7 Q32 14 55.5 7 L55.5 32 Q55.5 51 32 62 Q8.5 51 8.5 32 Z');
    const inner = S('M14 12.6 Q32 19 50 12.6 L50 32 Q50 46 32 56 Q14 46 14 32 Z');
    g.obj(outer, C.steelBr, { ang: 60, lw: 1.7 });
    g.obj(inner, ['#8ab4ff', '#2f64d0', '#142a78'], { ang: 40, lw: 1.1, hi: 0.3 });
    g.clip(inner, () => {
      g.flat(poly([[14, 13], [32, 18], [14, 38]]), 'rgba(255,255,255,0.18)');
      g.flat(poly([[50, 13], [50, 32], [50, 46], [32, 56], [40, 30]]), 'rgba(0,10,60,0.25)');
      g.flat(rr(27, 12, 10, 46, 0), ['#fff6c0', '#f6cf48', '#b87a1a']);
      g.flat(rr(12, 26, 40, 10, 0), ['#fff6c0', '#f6cf48', '#b87a1a']);
      g.flat(rr(27, 12, 3, 46, 0), 'rgba(255,255,255,0.4)'); g.flat(rr(12, 26, 40, 3, 0), 'rgba(255,255,255,0.4)');
      g.flat(rr(34, 12, 3, 46, 0), 'rgba(120,70,10,0.3)');
    });
    g.stroke(inner, 'rgba(0,0,30,0.6)', 1.3, { lw: 0 });
    g.orb(32, 31, 4.4, C.ruby, { lw: 1.1 });
    sparkles(g, [[54, 10, 3], [10, 12, 2.4]]);
  },
  // Castle Age: a tower with banners
  g => {
    g.glow(32, 36, 30, '#e8f4ff', 0.4);
    g.shadow(32, 59, 26, 3.4, 0.4);
    const stone = ['#f0ece2', '#b8b2a4', '#6c665c'];
    const tw = (x, y, w, h, roof) => {
      g.obj(rr(x, y, w, h, 0.6), stone, { ang: 8, lw: 1.5 });
      g.flat(rr(x + w * 0.55, y, w * 0.45, h, 0), 'rgba(40,30,70,0.22)');
      for (let i = 0; i < Math.round(w / 5); i++) g.line(x, y + 7 + i * 6, x + w, y + 7 + i * 6, 'rgba(40,34,50,0.28)', 0.8, { cap: 'butt' });
      if (roof) g.obj(poly([[x - 2, y + 1], [x + w / 2, y - 13], [x + w + 2, y + 1]]), ['#ff9a86', '#d9382c', '#7a1410'], { lw: 1.4, ang: 30 });
    };
    tw(7, 28, 13, 31, true); tw(44, 28, 13, 31, true);
    const kx = 19, kw = 26;
    g.obj(rr(kx, 14, kw, 45, 0.6), stone, { ang: 8, lw: 1.6 });
    g.flat(rr(kx + kw * 0.55, 14, kw * 0.45, 45, 0), 'rgba(40,30,70,0.22)');
    for (let i = 0; i < 4; i++) g.obj(rr(kx - 0.2 + i * 7.1, 8.4, 5, 7, 0.5), stone, { lw: 1.2, ang: 10 });
    g.flat(rr(29.6, 24, 4.8, 11, 2.4), '#1d1209');
    g.obj(S('M26 59 L26 47 Q32 40 38 47 L38 59 Z'), ['#6a4424', '#3b2411', '#1d1209'], { lw: 1.2, hi: 0.1 });
    g.line(32, 8, 32, -1, C.woodDk[1], 1.4, { lw: 0.8 });
    g.obj(poly([[32.6, -1], [44, 2], [32.6, 5.6]]), ['#ff9a86', '#d9382c', '#7a1410'], { lw: 1.1 });
    sparkles(g, [[54, 14, 3], [10, 16, 2.4]]);
  },
  // Imperial Age: a crown
  g => {
    g.glow(32, 30, 32, '#fff0b8', 0.6);
    g.shadow(32, 54, 24, 3.6, 0.4);
    const crown = S('M7 50 L5 21 L19 33 L26 10 L32 29 L38 10 L45 33 L59 21 L57 50 Z');
    g.obj(crown, ['#fff6c0', '#f6cf48', '#a56d14'], { lw: 1.8, ang: 60 });
    g.clip(crown, () => {
      g.flat(poly([[5, 21], [19, 33], [14, 50], [7, 50]]), 'rgba(255,255,255,0.28)');
      g.flat(poly([[57, 21], [45, 33], [50, 50], [57, 50]]), 'rgba(110,60,0,0.25)');
    });
    g.obj(rr(6, 45, 52, 10, 2.4), ['#ffffff', '#f1ece0', '#b3a98c'], { lw: 1.6, ang: 70 });      // ermine band
    for (const x of [14, 26, 38, 50]) g.flat(poly([[x - 1.2, 49], [x, 53.6], [x + 1.2, 49]]), '#1d1209');
    for (const [x, y, r] of [[5, 19.5, 3.2], [26, 8, 3.2], [38, 8, 3.2], [59, 19.5, 3.2]]) g.orb(x, y, r, C.gold, { lw: 0.9 });
    g.orb(32, 33, 4.6, C.ruby, { lw: 1.1 }); g.orb(18, 40, 3, C.sapph, { lw: 0.9 }); g.orb(46, 40, 3, C.gem, { lw: 0.9 });
    sparkles(g, [[54, 8, 3.6], [10, 8, 3], [32, 3, 2.4]]);
  },
];

export function buildAge(n, size) {
  const i = Math.max(0, Math.min(3, n | 0));
  return frameIcon(size, AGE_BG[i], 'age' + i, AGE_DRAW[i], { rays: i === 3 ? 16 : 0, rayA: 0.12, border: i === 3 ? ['#fff6c0', '#f0c840', '#8a5a14'] : undefined });
}

export function buildCiv(id, size) {
  const bg = CIV_BG[id] || CIV_BG.britons;
  return frameIcon(size, bg, 'civ:' + id, g => g.scaled(0.5, () => drawEmblem(g, id, 0)), { gscale: 0.97, gdy: 0.5 });
}
