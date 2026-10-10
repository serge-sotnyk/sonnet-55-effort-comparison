// Building / religion glyphs: castle crane tower wall cross scroll book
import { mix, shade } from './common.js';
import { C, S, circ, ell, rr, poly, smooth, combo, n2, DEG } from './icons_kit.js';
import { def, hatch, sparkles, drop } from './icons_parts.js';

const STONE_L = ['#f0ece2', '#b8b2a4', '#6c665c'];

/** brick joints inside a clip: rows of height rh, bricks of width bw */
function bricks(g, x0, y0, x1, y1, rh, bw, color = 'rgba(40,34,50,0.32)') {
  let row = 0;
  for (let y = y0; y <= y1; y += rh, row++) {
    g.line(x0, y, x1, y, color, 0.8, { cap: 'butt' });
    for (let x = x0 + (row % 2) * bw / 2; x < x1; x += bw) g.line(x, y, x, y + rh, color, 0.8, { cap: 'butt' });
  }
}

// ---------- castle (Masonry / Architecture / Hoardings)
def('castle', 'def', (g, m) => {
  const roofPal = m.acc === 'gold' ? C.gold : m.acc === 'blood' ? C.red : ['#8fc0ff', '#3b78d8', '#173d8a'];
  const flag = m.acc === 'gold' ? C.gold : C.red;
  g.shadow(32, 58, 29, 4, 0.4);
  const tower = (x, y, w, h) => {
    g.obj(rr(x, y, w, h, 0.6), STONE_L, { ang: 8, lw: 1.5 });
    g.clip(rr(x, y, w, h, 0.6), () => {
      bricks(g, x, y + 3, x + w, y + h, 4.4, 4.6);
      g.flat(rr(x + w * 0.55, y, w * 0.45, h, 0), 'rgba(40,30,70,0.22)');
    });
    g.obj(poly([[x - 2.2, y + 1.2], [x + w / 2, y - h * 0.68], [x + w + 2.2, y + 1.2]]), roofPal, { ang: 25, lw: 1.5 });
    g.flat(poly([[x + w / 2, y - h * 0.68], [x + w + 2.2, y + 1.2], [x + w / 2 + 1.2, y + 1.2]]), 'rgba(0,0,50,0.25)');
    g.flat(rr(x + w / 2 - 1, y + h * 0.3, 2, 6.4, 0.9), '#1d1209');
  };
  // keep (back)
  const kx = 21, kw = 22, ky = 16, kh = 41;
  g.obj(rr(kx, ky, kw, kh, 0.6), STONE_L, { ang: 8, lw: 1.6 });
  g.clip(rr(kx, ky, kw, kh, 0.6), () => {
    bricks(g, kx, ky + 3, kx + kw, ky + kh, 4.6, 4.8);
    g.flat(rr(kx + kw * 0.55, ky, kw * 0.45, kh, 0), 'rgba(40,30,70,0.22)');
  });
  for (let i = 0; i < 4; i++) g.obj(rr(kx - 0.2 + i * 6, ky - 4.6, 4.4, 6, 0.5), STONE_L, { lw: 1.2, ang: 10 });
  g.flat(rr(kx + 7.4, ky + 7.5, 2.4, 8.5, 1.1), '#1d1209'); g.flat(rr(kx + 13, ky + 7.5, 2.4, 8.5, 1.1), '#1d1209');
  g.line(32, ky - 4.4, 32, ky - 14.5, C.woodDk[1], 1.6, { lw: 0.9 });
  g.obj(poly([[32.8, ky - 14.5], [44, ky - 11.5], [32.8, ky - 8]]), flag, { lw: 1.2 });
  tower(6, 29, 15, 28);
  tower(43, 29, 15, 28);
  // gate
  g.obj(S('M25.5 58 L25.5 46.5 Q32 39 38.5 46.5 L38.5 58 Z'), ['#6a4424', '#3b2411', '#1d1209'], { lw: 1.4, hi: 0.1 });
  for (let i = 0; i < 4; i++) g.line(27.7 + i * 2.9, 45.5 + Math.abs(1.5 - i) * 0.9, 27.7 + i * 2.9, 57.5, 'rgba(190,150,100,0.75)', 0.9);
  g.line(26, 51.6, 38, 51.6, 'rgba(190,150,100,0.75)', 0.9);
  g.obj(rr(2.5, 57, 59, 3.8, 1.5), C.stoneDk, { lw: 1.2, hi: 0.3 });
  if (m.acc === 'blood') { drop(g, 50, 17, 2.4); drop(g, 13, 20, 2); }
  g.spark(16, 15, 2.8, '#fff');
  if (m.acc === 'gold') { g.spark(52, 12, 3.4, '#fff', '#ffe27a'); g.flat(rr(kx, ky + 1.5, kw, 1.8, 0), 'rgba(255,214,90,0.95)'); }
}, { own: ['gold', 'blood'] });

// ---------- crane (Treadmill Crane)
def('crane', 'eco', (g, m) => {
  g.shadow(32, 58.5, 29, 3.2, 0.4);
  g.obj(rr(3, 56.5, 58, 4.8, 1.6), C.stoneDk, { lw: 1.2, hi: 0.3 });
  // mast + back leg
  g.tube(8, 59, 16, 40, 3.4, C.woodDk, { lw: 1.2 });
  g.tube(16, 58, 16, 7, 5.4, C.wood, { lw: 1.5 });
  // jib + strut
  g.tube(16, 31, 38, 11.5, 3.4, C.woodDk, { lw: 1.2 });
  g.tube(9, 12, 52, 12, 4.6, C.wood, { lw: 1.5 });
  g.obj(rr(14, 6, 4, 5, 1), C.iron, { lw: 0.9 });
  // pulley + rope + block
  g.stroke(poly([[50, 15], [50, 35.5]], false), '#e4cc92', 1.7, { lw: 0.8 });
  g.orb(50, 12, 3.7, C.iron, { lw: 1.2 });
  g.orb(50, 12, 1.2, C.steelBr, { lw: 0, spec: 0 });
  g.stroke(circ(50, 36.5, 1.8), C.iron, 1.3, { lw: 0.6 });
  g.obj(rr(42, 38, 16, 12.5, 1.2), STONE_L, { lw: 1.4, ang: 45 });
  g.clip(rr(42, 38, 16, 12.5, 1.2), () => { bricks(g, 42, 41.5, 58, 51, 4.2, 5.4); g.flat(rr(42, 38, 16, 2.4, 0), 'rgba(255,255,255,0.4)'); });
  // treadmill wheel (front)
  g.obj(circ(30, 43.5, 14.2), C.woodDk, { lw: 1.7, ang: 60, hi: 0.3 });
  g.obj(circ(30, 43.5, 10.4), ['#4a3018', '#2c1b0c', '#160c05'], { lw: 0.9, hi: 0, sh: 0 });
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    g.line(30 + Math.cos(a) * 10.6, 43.5 + Math.sin(a) * 10.6, 30 + Math.cos(a) * 13.2, 43.5 + Math.sin(a) * 13.2, C.woodLt[0], 1.2, { lw: 0 });
  }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.26; g.line(30, 43.5, 30 + Math.cos(a) * 11, 43.5 + Math.sin(a) * 11, C.wood[1], 1.7, { lw: 0.8 }); }
  g.stroke(circ(30, 43.5, 12.4), C.iron[1], 1, { alpha: 0.9 });
  g.orb(30, 43.5, 3.2, C.iron, { lw: 1 });
  g.spark(55, 26, 2.6, '#fff');
});

// ---------- tower (Guard Tower / Keep)
def('tower', 'def', (g, m) => {
  const gold = m.acc === 'gold';
  g.shadow(32, 58.5, 24, 3.4, 0.4);
  const body = poly([[21.5, 25], [42.5, 25], [45.5, 58], [18.5, 58]]);
  g.obj(body, STONE_L, { ang: 8, lw: 1.6 });
  g.clip(body, () => {
    bricks(g, 16, 27, 48, 58, 4.8, 5.2);
    g.flat(poly([[34, 25], [42.5, 25], [45.5, 58], [36, 58]]), 'rgba(40,30,70,0.24)');
    g.flat(poly([[21.5, 25], [25, 25], [22.5, 58], [18.5, 58]]), 'rgba(255,255,255,0.18)');
  });
  g.obj(poly([[15.5, 17], [48.5, 17], [46, 25], [18, 25]]), C.stoneDk, { lw: 1.5, ang: 70 });
  for (let i = 0; i < 4; i++) g.flat(rr(19 + i * 7.6, 20, 3.6, 5, 0.4), 'rgba(0,0,0,0.38)');
  for (let i = 0; i < 4; i++) g.obj(rr(15.5 + i * 8.9, 10, 5.6, 8, 0.6), STONE_L, { lw: 1.3, ang: 10 });
  if (gold) g.flat(rr(15.5, 17, 33, 2, 0), 'rgba(255,214,90,0.95)');
  g.flat(rr(30.8, 31, 2.6, 8.5, 1.1), '#1d1209'); g.flat(rr(30.8, 43, 2.6, 6.5, 1.1), '#1d1209');
  g.obj(S('M27 58 L27 51 Q32 46 37 51 L37 58 Z'), ['#6a4424', '#3b2411', '#1d1209'], { lw: 1.2, hi: 0.1 });
  g.line(32, 10, 32, 2.5, C.woodDk[1], 1.5, { lw: 0.8 });
  g.obj(poly([[32.7, 2.4], [42, 4.8], [32.7, 7.8]]), gold ? C.gold : C.red, { lw: 1.1 });
  g.obj(rr(14, 57.5, 36, 3.6, 1.4), C.stoneDk, { lw: 1.2, hi: 0.3 });
  g.spark(18, 30, 2.4, '#fff');
  if (gold) g.spark(50, 26, 3.4, '#fff', '#ffe27a');
}, { own: ['gold'] });

// ---------- wall (Fortified Wall)
def('wall', 'def', (g, m) => {
  g.shadow(32, 58.5, 29, 3.4, 0.4);
  const wall = S('M3 28 H47 V58 H3 Z');
  g.obj(wall, STONE_L, { ang: 20, lw: 1.7 });
  g.clip(wall, () => {
    bricks(g, 3, 31, 47, 58, 5.4, 6.8);
    g.flat(rr(3, 28, 44, 3, 0), 'rgba(255,255,255,0.35)');
    g.flat(rr(3, 53, 44, 5, 0), 'rgba(40,30,70,0.2)');
  });
  for (let i = 0; i < 4; i++) {
    const x = 3 + i * 11.5;
    g.obj(rr(x, 19.5, 7.6, 9.4, 0.6), STONE_L, { lw: 1.4, ang: 20 });
    g.flat(rr(x, 19.5 + 9.4 - 4, 7.6, 4, 0), 'rgba(40,30,70,0.12)');
  }
  // end tower
  const tw = S('M44 17 H61 V58 H44 Z');
  g.obj(tw, STONE_L, { ang: 8, lw: 1.7 });
  g.clip(tw, () => { bricks(g, 44, 22, 61, 58, 5.4, 5.2); g.flat(rr(53, 17, 8, 41, 0), 'rgba(40,30,70,0.26)'); });
  for (let i = 0; i < 3; i++) g.obj(rr(43.8 + i * 6, 9.6, 5, 8.8, 0.5), STONE_L, { lw: 1.3, ang: 10 });
  g.flat(rr(51, 28, 2.4, 8, 1.1), '#1d1209');
  g.obj(rr(1.5, 57.4, 60, 3.8, 1.4), C.stoneDk, { lw: 1.2, hi: 0.3 });
  // shield emblem on the wall
  g.obj(S('M13 36 H27 V44 Q27 50 20 54 Q13 50 13 44 Z'), C.red, { lw: 1.2, ang: 60 });
  g.line(20, 37, 20, 52, C.gold[1], 1.6, { lw: 0 }); g.line(14, 42, 26, 42, C.gold[1], 1.6, { lw: 0 });
  g.spark(10, 24, 2.4, '#fff');
});

// ---------- cross (Fervor / Sanctity / Redemption / Atonement)
def('cross', 'holy', (g, m) => {
  const acc = m.acc;
  g.glow(32, 32, 30, '#fff3c0', 0.4);
  const c = 32, w0 = 4.8, w1 = 9, L = 27.5;
  const cross = poly([[c - w1, c - L], [c + w1, c - L], [c + w0, c - w0], [c + L, c - w1], [c + L, c + w1], [c + w0, c + w0], [c + w1, c + L], [c - w1, c + L], [c - w0, c + w0], [c - L, c + w1], [c - L, c - w1], [c - w0, c - w0]]);
  const pal = acc === 'blood' ? ['#ff9a86', '#d8302a', '#7a1010'] : acc === 'gold' ? C.gold : ['#ffffff', '#f2ecde', '#b3a98c'];
  g.obj(cross, pal, { lw: 1.8, ang: 50 });
  // pyramid facets: the half of each arm facing the upper-left light is brighter
  g.clip(cross, () => {
    const Lt = 'rgba(255,255,255,0.30)', Dk = 'rgba(20,10,50,0.24)';
    g.flat(poly([[c - w1, c - L], [c, c - L], [c, c], [c - w0, c - w0]]), Lt); g.flat(poly([[c, c - L], [c + w1, c - L], [c + w0, c - w0], [c, c]]), Dk);
    g.flat(poly([[c - L, c - w1], [c - L, c], [c, c], [c - w0, c - w0]]), Lt); g.flat(poly([[c - L, c], [c - L, c + w1], [c - w0, c + w0], [c, c]]), Dk);
    g.flat(poly([[c + L, c - w1], [c + L, c], [c, c], [c + w0, c - w0]]), Lt); g.flat(poly([[c + L, c], [c + L, c + w1], [c + w0, c + w0], [c, c]]), Dk);
    g.flat(poly([[c - w1, c + L], [c, c + L], [c, c], [c - w0, c + w0]]), Lt); g.flat(poly([[c, c + L], [c + w1, c + L], [c + w0, c + w0], [c, c]]), Dk);
  });
  g.orb(c, c, 5.6, acc === 'blood' ? C.white : C.ruby, { lw: 1.3 });
  g.spark(54, 10, 3.8, '#fff', '#fff0b0'); g.spark(10, 54, 2.8, '#fff', '#fff0b0');
  if (acc === 'blood') { drop(g, 51, 51, 3.4); drop(g, 13, 13, 2.6); drop(g, 55, 20, 1.9); }
}, { own: '*', rays: 14 });

// ---------- scroll (Illumination)
def('scroll', 'holy', (g, m) => {
  g.glow(32, 30, 30, '#fff3c0', 0.45);
  const sheet = S('M12 14 Q32 10.5 52 14 L52 49 Q32 52.5 12 49 Z');
  g.obj(sheet, C.parch, { lw: 1.6, ang: 60 });
  g.clip(sheet, () => {
    for (const [y, l] of [[21, 28], [26.4, 31], [31.8, 24], [37.2, 29], [42.6, 17]]) {
      g.line(16, y, 16 + l, y + 0.4, 'rgba(70,40,15,0.75)', 1.5, { lw: 0 });
    }
    g.flat(rr(15.5, 17.5, 6.4, 6.4, 0.8), C.red[1]);
    g.flat(rr(16.7, 18.7, 4, 4, 0.5), 'rgba(255,214,90,0.9)');
    g.flat(rr(12, 14, 40, 3, 0), 'rgba(120,70,20,0.22)'); g.flat(rr(12, 46, 40, 3.5, 0), 'rgba(120,70,20,0.25)');
    g.flat(poly([[12, 14], [18, 14], [16, 49], [12, 49]]), 'rgba(255,255,255,0.28)');
  });
  g.tube(7, 13, 57, 13, 8, C.parch, { lw: 1.5 });
  g.tube(7, 50, 57, 50, 8, C.parch, { lw: 1.5 });
  for (const [x, y] of [[7, 13], [57, 13], [7, 50], [57, 50]]) { g.obj(circ(x, y, 4), C.parch, { lw: 1.2, hi: 0.4 }); g.stroke(circ(x, y, 2), 'rgba(120,70,20,0.7)', 0.9, { lw: 0 }); g.flat(circ(x, y, 0.7), 'rgba(120,70,20,0.9)'); }
  g.obj(S('M43 49 L39 58.5 L43.5 56 L47.5 59.5 L47 49 Z'), C.red, { lw: 1.1, hi: 0.2 });
  g.obj(circ(45, 47, 5.4), C.red, { lw: 1.3 });
  g.stroke(circ(45, 47, 3.2), 'rgba(255,170,150,0.7)', 0.9, { lw: 0 });
  sparkles(g, [[54, 24, 3.6], [8, 30, 2.6]]);
});

// ---------- book (Block Printing)
def('book', 'holy', (g, m) => {
  g.glow(32, 30, 30, '#fff3c0', 0.32);
  // cover
  g.obj(S('M3 22 Q18 18 32 24 Q46 18 61 22 L61 52 Q46 48 32 54.5 Q18 48 3 52 Z'), ['#9a64d6', '#5a3498', '#2c1660'], { lw: 1.7, ang: 70 });
  // page block edges
  g.obj(S('M6 20 Q19 16.4 32 22.4 L32 52.4 Q19 46.6 6 50 Z'), C.parch, { lw: 1.3, ang: 20 });
  g.obj(S('M58 20 Q45 16.4 32 22.4 L32 52.4 Q45 46.6 58 50 Z'), C.parch, { lw: 1.3, ang: 110 });
  g.flat(S('M6 50 Q19 46.6 32 52.4 L32 54.2 Q19 48.6 6 52 Z'), 'rgba(140,100,40,0.5)');
  g.flat(S('M58 50 Q45 46.6 32 52.4 L32 54.2 Q45 48.6 58 52 Z'), 'rgba(140,100,40,0.5)');
  // pages
  const lp = S('M8 16 Q20 12.4 32 18.4 L32 48.4 Q20 42.6 8 46 Z');
  const rp = S('M56 16 Q44 12.4 32 18.4 L32 48.4 Q44 42.6 56 46 Z');
  g.obj(lp, ['#ffffff', '#f6ebcd', '#cfb87c'], { lw: 1.4, ang: 20 });
  g.obj(rp, ['#fffdf2', '#f1e2bc', '#c4a96a'], { lw: 1.4, ang: 130 });
  g.clip(lp, () => {
    g.flat(rr(11, 19.4, 7, 7, 0.8), C.red[1]); g.flat(rr(12.4, 20.8, 4.2, 4.2, 0.5), 'rgba(255,214,90,0.95)');
    for (const [y, x1] of [[21, 28.4], [24.6, 28.8], [29.2, 28.6], [32.8, 28.2], [36.4, 28.6], [40, 28.4]]) g.line(x1 > 0 && y < 27 ? 20 : 11, y + (y - 21) * 0.0, x1, y + 0.2, 'rgba(70,40,15,0.65)', 1.2, { lw: 0 });
    g.flat(poly([[26, 15], [32, 18], [32, 49], [27, 46]]), 'rgba(120,80,20,0.22)');
  });
  g.clip(rp, () => {
    g.flat(rr(38, 21, 14, 10, 1), ['#7ec86a', '#3a8f4a', '#1c5a30']);
    g.flat(poly([[38, 31], [44, 24.5], [48, 28], [52, 22.5], [52, 31]]), 'rgba(255,255,255,0.35)');
    for (const [y, x0] of [[35.2, 38], [38.8, 38], [42.2, 38]]) g.line(x0, y, 53, y + 0.3, 'rgba(70,40,15,0.65)', 1.2, { lw: 0 });
    g.flat(poly([[32, 18], [37, 15.5], [37, 46], [32, 49]]), 'rgba(120,80,20,0.22)');
  });
  g.line(32, 18.4, 32, 48.8, 'rgba(60,30,10,0.6)', 1.2, { lw: 0 });
  // ribbon
  g.obj(S('M34 48.5 L33 60 L35.8 57.6 L38.6 60.4 L38 48.5 Z'), C.red, { lw: 1.1, hi: 0.2 });
  sparkles(g, [[54, 10, 3.6], [8, 10, 2.8]]);
});
