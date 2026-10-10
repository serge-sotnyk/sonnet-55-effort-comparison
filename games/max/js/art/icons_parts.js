// Shared parts, accents and the glyph registry for the tech/command icons.
import { mix, shade } from './common.js';
import { C, S, circ, ell, rr, poly, smooth, sparkShape, n2 } from './icons_kit.js';

// ------------------------------------------------------------------ accents
// metal: palette used for the "metal" parts of a glyph; tint/t: background tint; rays: light rays behind the glyph.
export const ACCENTS = {
  gold:  { tint: '#f2b434', t: 0.42, metal: C.gold,    trim: C.gold,    rays: 0 },
  stone: { tint: '#7e8798', t: 0.50, metal: C.stone,   trim: C.stoneDk, rays: 0 },
  blood: { tint: '#b02826', t: 0.52, metal: C.steel,   trim: C.red,     rays: 0 },
  holy:  { tint: '#f4e2a0', t: 0.38, metal: C.white,   trim: C.gold,    rays: 14 },
  steel: { tint: '#6f98c8', t: 0.42, metal: C.steelBr, trim: C.steelDk, rays: 0 },
  wood:  { tint: '#a36a34', t: 0.48, metal: C.wood,    trim: C.woodDk,  rays: 0 },
  food:  { tint: '#58a63e', t: 0.46, metal: C.green,   trim: C.green,   rays: 0 },
};

// ------------------------------------------------------------------ registry
export const GLYPHS = {};
export function def(name, cat, draw, o = {}) { GLYPHS[name] = Object.assign({ name, cat, draw }, o); }

// ------------------------------------------------------------------ shared small parts
export function nugget(g, x, y, s, pal = C.gold) {
  g.obj(smooth([[x - s, y + s * 0.1], [x - s * 0.55, y - s * 0.85], [x + s * 0.35, y - s * 0.95], [x + s, y - s * 0.1], [x + s * 0.7, y + s * 0.75], [x - s * 0.3, y + s * 0.9]]), pal, { lw: 1.2 });
  g.flat(poly([[x - s * 0.55, y - s * 0.45], [x - s * 0.05, y - s * 0.7], [x - s * 0.2, y - s * 0.3]]), 'rgba(255,255,255,0.75)');
}
export function stoneBlock(g, x, y, s, pal = C.stone) {
  const t = [[x, y - s * 0.9], [x + s, y - s * 0.4], [x, y + s * 0.1], [x - s, y - s * 0.4]];
  g.obj(poly([[x - s, y - s * 0.4], [x, y + s * 0.1], [x, y + s * 1.05], [x - s, y + s * 0.55]]), [pal[1], pal[2]], { lw: 1.1, hi: 0.2 });
  g.obj(poly([[x, y + s * 0.1], [x + s, y - s * 0.4], [x + s, y + s * 0.55], [x, y + s * 1.05]]), [pal[2], mix(pal[2], '#000000', 0.3)], { lw: 1.1, hi: 0, sh: 0 });
  g.obj(poly(t), [pal[0], pal[1]], { lw: 1.1, hi: 0.5, sh: 0 });
}
export function drop(g, x, y, s, pal = C.red) {
  g.obj(S(`M${n2(x)} ${n2(y - s * 1.2)}C${n2(x + s * 0.2)} ${n2(y - s * 0.6)} ${n2(x + s * 0.95)} ${n2(y - s * 0.1)} ${n2(x + s * 0.95)} ${n2(y + s * 0.35)}C${n2(x + s * 0.95)} ${n2(y + s * 0.95)} ${n2(x + s * 0.5)} ${n2(y + s * 1.2)} ${n2(x)} ${n2(y + s * 1.2)}C${n2(x - s * 0.5)} ${n2(y + s * 1.2)} ${n2(x - s * 0.95)} ${n2(y + s * 0.95)} ${n2(x - s * 0.95)} ${n2(y + s * 0.35)}C${n2(x - s * 0.95)} ${n2(y - s * 0.1)} ${n2(x - s * 0.2)} ${n2(y - s * 0.6)} ${n2(x)} ${n2(y - s * 1.2)}Z`), pal, { lw: 1.1, hi: 0.3 });
  g.flat(ell(x - s * 0.35, y + s * 0.2, s * 0.17, s * 0.3, 20), 'rgba(255,255,255,0.7)');
}
export function logEnd(g, x, y, r) {
  g.obj(circ(x, y, r), C.wood, { lw: 1.3, hi: 0.3 });
  g.stroke(circ(x, y, r * 0.64), 'rgba(90,50,20,0.55)', Math.max(0.7, r * 0.12));
  g.stroke(circ(x, y, r * 0.3), 'rgba(90,50,20,0.55)', Math.max(0.7, r * 0.12));
  g.flat(circ(x, y, r * 0.1), 'rgba(90,50,20,0.7)');
}
export function ingot(g, x, y, w, h, pal = C.steelBr) {
  const sk = h * 0.55;
  g.obj(poly([[x + sk, y], [x + w, y], [x + w - sk * 0.6, y + h], [x, y + h]]), pal, { lw: 1.1, hi: 0.5 });
  g.flat(poly([[x + sk + 1, y + 1.2], [x + w - 2.5, y + 1.2], [x + w - 3.4, y + 2.4], [x + sk - 0.2, y + 2.4]]), 'rgba(255,255,255,0.55)');
}
/** a single wheat ear + stalk, pointing up from (x, y) (base of the ear), s = scale */
export function wheatEar(g, x, y, s, ang = 0, stalk = 1.4) {
  g.rotated(x, y, ang, () => {
    if (stalk) g.stroke(poly([[x, y + s * stalk], [x, y - s * 0.2]], false), '#8aa83a', Math.max(0.9, s * 0.2), { lw: 0.7 });
    for (let i = 0; i < 4; i++) {
      const yy = y - i * s * 0.62;
      g.obj(ell(x - s * 0.34, yy - s * 0.1, s * 0.4, s * 0.22, -40), C.gold, { lw: 0.8, hi: 0.3, sh: 0.15 });
      g.obj(ell(x + s * 0.34, yy - s * 0.1, s * 0.4, s * 0.22, 40), C.gold, { lw: 0.8, hi: 0.3, sh: 0.15 });
    }
    g.obj(ell(x, y - s * 2.75, s * 0.24, s * 0.42), C.gold, { lw: 0.8, hi: 0.3, sh: 0.15 });
    for (const d of [-0.5, 0, 0.5]) g.line(x + d * s * 0.5, y - s * 2.9, x + d * s * 1.1, y - s * 5.2, 'rgba(240,200,100,0.9)', Math.max(0.5, s * 0.1), { lw: 0 });
  });
}
export function hatch(g, x0, y0, x1, y1, step, ang, color, w = 0.8) {
  // parallel lines covering a box (call inside g.clip)
  const a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
  for (let t = -R; t <= R; t += step) {
    const px = cx - dy * t, py = cy + dx * t;
    g.line(px - dx * R, py - dy * R, px + dx * R, py + dy * R, color, w, { cap: 'butt' });
  }
}
export function sparkles(g, list) { for (const [x, y, r] of list) g.spark(x, y, r, '#ffffff', '#fff2b0'); }

// default accent ornaments drawn in the lower right corner
export const ORN = {
  gold(g) {
    g.glow(49, 49, 14, '#ffe27a', 0.5);
    nugget(g, 52, 53, 4.2); nugget(g, 44, 55, 3.3); nugget(g, 49, 47.5, 3.6);
    g.spark(57, 41, 3.2, '#fff', '#ffe27a');
  },
  stone(g) { stoneBlock(g, 50, 50, 6.5); stoneBlock(g, 41, 56, 4.2, C.stoneDk); },
  blood(g) { drop(g, 50, 49, 4.6); drop(g, 42, 57, 2.6); drop(g, 57, 55, 2.2); },
  holy(g) {
    g.glow(32, 28, 26, '#fff3b8', 0.45);
    g.spark(52, 12, 5, '#fff', '#ffe9a0'); g.spark(10, 50, 3.4, '#fff', '#ffe9a0'); g.spark(55, 50, 2.6, '#fff', '#ffe9a0');
  },
  steel(g) { ingot(g, 40, 50, 17, 7, C.steelBr); ingot(g, 36, 44, 17, 6.5, C.steel); },
  wood(g) { logEnd(g, 50, 51, 6.2); logEnd(g, 41, 56, 4.4); },
  food(g) { wheatEar(g, 51, 55, 3.2, 12); wheatEar(g, 45, 56, 2.8, -14); },
};

// ------------------------------------------------------------------ reusable weapon / tool parts (vertical, canonical 64 space)
/** thick arrow polygon from tail (x0,y0) to tip (x1,y1): shaft width w, head width hw, head length hl */
export function arrow(x0, y0, x1, y1, w, hw, hl) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const bx = x1 - ux * hl, by = y1 - uy * hl;
  return poly([[x0 + nx * w / 2, y0 + ny * w / 2], [bx + nx * w / 2, by + ny * w / 2], [bx + nx * hw / 2, by + ny * hw / 2], [x1, y1], [bx - nx * hw / 2, by - ny * hw / 2], [bx - nx * w / 2, by - ny * w / 2], [x0 - nx * w / 2, y0 - ny * w / 2]]);
}
/** vertical sword: tip at y=-3, pommel bottom at y=70 */
export function swordV(g, metal = C.steel, trim = C.gold) {
  const blade = poly([[32, -3], [38.2, 6], [38.2, 42], [25.8, 42], [25.8, 6]]);
  g.obj(blade, metal, { ang: 0 });
  g.clip(blade, () => {
    g.flat(poly([[32, -3], [38.2, 6], [38.2, 42], [32, 42]]), 'rgba(35,50,90,0.32)');
    g.line(32, 0, 32, 41, 'rgba(255,255,255,0.9)', 1.1, { cap: 'butt' });
    g.line(35.2, 8, 35.2, 39, 'rgba(255,255,255,0.18)', 1, { cap: 'butt' });
  });
  g.obj(S('M17 40.5 Q32 37.5 47 40.5 L47 46.4 Q32 43.4 17 46.4 Z'), trim, { lw: 1.4 });
  g.orb(17, 43.5, 3.3, C.gold); g.orb(47, 43.5, 3.3, C.gold);
  g.tube(32, 47, 32, 62, 5.8, C.leather, { lw: 1.4, cap: 'butt' });
  for (let i = 0; i < 4; i++) g.line(29.2, 48.5 + i * 3.6, 34.8, 50.7 + i * 3.6, 'rgba(35,18,6,0.55)', 1.1);
  g.orb(32, 66, 4.6, C.gold);
  g.orb(32, 66, 1.9, C.ruby, { lw: 0, spec: 0 });
}
/** vertical hammer: head at top (y 4..22), handle down to y=62 */
export function hammerV(g, metal = C.steel) {
  g.tube(32, 14, 32, 62, 5.8, C.wood, { lw: 1.5 });
  g.obj(rr(12, 3, 40, 19, 3.2), metal, { lw: 1.6, ang: 60 });
  g.flat(rr(14, 5, 34, 3, 1.2), 'rgba(255,255,255,0.6)');
  g.flat(rr(44, 3, 8, 19, 2), 'rgba(20,30,60,0.28)');
  g.flat(rr(12, 3, 6, 19, 2), 'rgba(255,255,255,0.12)');
}
/** vertical open-end wrench: jaw at the top */
export function wrenchV(g, metal = C.steel) {
  const head = S('M18 14 A14 14 0 0 1 28 3.5 L28 15 L36 15 L36 3.5 A14 14 0 0 1 46 14 A14 14 0 0 1 38 27 L38 56 Q38 62 32 62 Q26 62 26 56 L26 27 A14 14 0 0 1 18 14 Z', [18, 3, 46, 62]);
  g.obj(head, metal, { lw: 1.6, ang: 30 });
  g.flat(rr(27.4, 26, 2, 30, 1), 'rgba(255,255,255,0.5)');
  g.orb(32, 56, 2.2, C.iron, { lw: 0.8 });
}
export function cottage(g, x, y, s = 1) {
  g.placed(x, y, s, 0, () => {
    g.obj(rr(10, 30, 44, 28, 0.8), ['#f6ecd0', '#d9c79a', '#8c7a4a'], { lw: 1.6, ang: 30 });
    g.flat(rr(34, 30, 20, 28, 0), 'rgba(60,40,10,0.18)');
    g.line(10.8, 30.8, 10.8, 57.5, '#6a4424', 2, { lw: 0 }); g.line(53.2, 30.8, 53.2, 57.5, '#6a4424', 2, { lw: 0 });
    g.line(11, 42.5, 53, 42.5, '#6a4424', 1.8, { lw: 0 });
    g.obj(rr(40, 8, 7, 14, 0.8), C.stoneDk, { lw: 1.3, hi: 0.4 });
    g.obj(poly([[3, 33], [32, 8], [61, 33]]), ['#f0906a', '#c04e2c', '#6c2410'], { lw: 1.7, ang: 40 });
    g.flat(poly([[32, 8], [61, 33], [48, 33]]), 'rgba(40,0,0,0.20)');
    g.obj(rr(26.5, 44, 11, 14, 1.2), ['#7a4a26', '#4a2a12', '#24130a'], { lw: 1.2, hi: 0.1 });
    g.obj(rr(14, 33.8, 8, 7, 0.6), ['#d6f0ff', '#8cc4ea', '#4a82b0'], { lw: 1, hi: 0.5 });
    g.obj(rr(42, 33.8, 8, 7, 0.6), ['#d6f0ff', '#8cc4ea', '#4a82b0'], { lw: 1, hi: 0.5 });
  });
}

// ------------------------------------------------------------------ horse head (profile, facing right, 100-unit box; poll top-left, muzzle bottom-right)
export const HORSE_HEAD_PTS = [[42.9, 11.3], [49, 13], [55.5, 16], [61, 21], [67.1, 27.1], [72.5, 33.5], [77.6, 40.6], [82, 46], [86.6, 52.6], [91.5, 61], [93, 67.5], [89.5, 72.5], [84.5, 73], [78.5, 69], [73.4, 64.8], [66.5, 60.5], [60.3, 56.5], [52, 53.5], [44.3, 50.9], [38, 47], [35, 56], [34, 66], [36, 80], [42, 102], [2, 102], [4, 86], [10, 66], [18, 44], [26, 26], [34, 14]];
export function horseHeadShape(flip = false) { return smooth(flip ? HORSE_HEAD_PTS.map(([x, y]) => [100 - x, y]) : HORSE_HEAD_PTS); }
/** point at distance t along the head axis (poll -> muzzle) and offset `off` towards the forehead side (negative: jaw side) */
export function headPt(t, off, flip = false) {
  const x = 40 + 0.679 * t + 0.734 * off, y = 14 + 0.734 * t - 0.679 * off;
  return flip ? [100 - x, y] : [x, y];
}

/**
 * Horse head + neck in profile facing right, drawn in the 100-unit head box placed at (x,y) with scale sc.
 * pal = coat palette, mane = mane palette, bridle = strap palette.
 */
export function drawHorseHead(g, x, y, sc, pal, mane, bridle = C.leatherR) {
  const P2 = ([a, b]) => n2(a) + ' ' + n2(b);
  const curve = (a, b, c) => S('M' + P2(a) + 'Q' + P2(b) + ' ' + P2(c));
  g.at(x, y, sc, () => {
    g.obj(smooth([[44, 5], [34, 8], [22, 18], [10, 36], [0, 58], [-7, 84], [-9, 106], [4, 110], [15, 107], [17, 88], [23, 68], [31, 48], [41, 28]]), mane, { lw: 1.8, ang: 70, hi: 0.3 });
    g.obj(poly([[12, 42], [-5, 52], [11, 58]]), mane, { lw: 1.4, hi: 0.2 });
    g.obj(poly([[6, 66], [-11, 77], [7, 84]]), mane, { lw: 1.4, hi: 0.2 });
    g.obj(poly([[1, 90], [-14, 102], [4, 104]]), mane, { lw: 1.4, hi: 0.2 });
    g.obj(poly([[34, 14], [33, -3], [44, 12]]), pal, { lw: 1.4, hi: 0.2 });
    const head = horseHeadShape();
    g.obj(head, pal, { lw: 2, ang: 60 });
    g.clip(head, () => {
      g.flat(ell(30, 52, 12, 30, 30), 'rgba(0,0,0,0.08)');
      g.flat(ell(86, 66, 8, 7, -30), 'rgba(0,0,0,0.14)');
      g.stroke(poly([headPt(8, 6), headPt(60, 6)], false), 'rgba(255,255,255,0.35)', 3.4, { lw: 0 });
      g.stroke(curve(headPt(16, -12), headPt(30, -22), headPt(46, -12)), 'rgba(0,0,0,0.20)', 2.2, { lw: 0 });
      g.stroke(curve(headPt(80, -6), headPt(70, -9), headPt(60, -10)), 'rgba(0,0,0,0.25)', 1.6, { lw: 0 });
      g.flat(ell(34, 76, 7, 20, 8), 'rgba(0,0,0,0.12)');
    });
    g.obj(poly([[39, 13], [43, -5], [53, 15]]), pal, { lw: 1.5, hi: 0.2 });
    g.flat(poly([[43, 10], [44.6, 1], [49.4, 13]]), 'rgba(255,150,140,0.6)');
    g.obj(smooth([[36, 10], [47, 12], [57, 23], [49, 27], [40, 18]]), mane, { lw: 1.2, hi: 0.2 });
    g.stroke(curve(headPt(12, 11), headPt(11, 0), headPt(14, -10)), bridle, 3, { lw: 1 });
    g.stroke(curve(headPt(58, 9), headPt(52, 0), headPt(58, -10)), bridle, 3.4, { lw: 1 });
    g.stroke(curve(headPt(14, -9), headPt(36, -10), headPt(56, -9)), bridle, 2.4, { lw: 0.9 });
    const ring = headPt(36, -10);
    g.orb(ring[0], ring[1], 2.8, C.brass, { lw: 0.7 });
    const eye = headPt(21, 4);
    g.obj(ell(eye[0], eye[1], 3.6, 3.1, 30), ['#4a3a30', '#150d08', '#000'], { lw: 1, hi: 0, sh: 0 });
    g.flat(circ(eye[0] - 1.2, eye[1] - 1.3, 1.1), '#fff');
    const nos = headPt(70, -1);
    g.flat(ell(nos[0], nos[1], 1.2, 2.5, 25), '#1a0e08');
  });
}
