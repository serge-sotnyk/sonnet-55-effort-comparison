// UI / command glyphs 'ui:<name>': transparent background, bold shapes with a dark outline (legible on dark and light panels).
import { C, S, circ, ell, rr, poly, smooth, combo, n2, DEG, renderIcon } from './icons_kit.js';
import { arrow, swordV, hammerV, wrenchV, cottage, sparkles, nugget } from './icons_parts.js';
import { GLYPHS } from './icons_glyphs.js';

const STONE = ['#f0ece2', '#b8b2a4', '#6c665c'];
const GREEN = ['#c4f5a8', '#4cc450', '#1b7a2c'];
const REDP = ['#ff9a86', '#e0382c', '#821410'];
const BLUEP = ['#a8d2ff', '#3f86ec', '#173f94'];
const ORANGE = ['#ffe0a0', '#ff9a30', '#c04a0c'];
const PURP = ['#e0b8ff', '#9a58e0', '#52248e'];
const GOLD = C.gold;

/** arc stroke with an arrowhead at its end; angles in degrees (clockwise on screen) */
function ringArrow(g, cx, cy, r, a0, a1, w, pal, headLen = 12, headW = 17) {
  const p = a => [cx + Math.cos(a * DEG) * r, cy + Math.sin(a * DEG) * r];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  // stop the shaft a little before the head
  const aEnd = a1 - (headLen * 0.85 / r) / DEG;
  const [xe, ye] = p(aEnd);
  g.stroke(S(`M${n2(x0)} ${n2(y0)}A${r} ${r} 0 ${large} 1 ${n2(xe)} ${n2(ye)}`, [cx - r, cy - r, cx + r, cy + r]), pal, w, { lw: 1.5, cap: 'butt' });
  const ca = Math.cos(a1 * DEG), sa = Math.sin(a1 * DEG), tx = -sa, ty = ca;   // outward normal (ca,sa), clockwise tangent (tx,ty)
  g.obj(poly([[x1 + tx * headLen, y1 + ty * headLen], [x1 + ca * headW / 2, y1 + sa * headW / 2], [x1 - ca * headW / 2, y1 - sa * headW / 2]]), pal, { lw: 1.5, hi: 0.4 });
}
function octagon(cx, cy, r) {
  const pts = [];
  for (let k = 0; k < 8; k++) { const a = (22.5 + 45 * k) * DEG; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return poly(pts);
}
function shieldPath() { return S('M8.5 8.5 Q32 15 55.5 8.5 L55.5 31 Q55.5 50 32 61.5 Q8.5 50 8.5 31 Z'); }
function shieldIn() { return S('M14 14 Q32 20 50 14 L50 31 Q50 45 32 55 Q14 45 14 31 Z'); }
function drawShield(g, field = BLUEP, boss = true) {
  g.obj(shieldPath(), C.steel, { ang: 60, lw: 1.6 });
  g.obj(shieldIn(), field, { ang: 25, lw: 1, hi: 0.3 });
  g.clip(shieldIn(), () => { g.flat(poly([[14, 14], [32, 18], [14, 36]]), 'rgba(255,255,255,0.18)'); g.flat(poly([[50, 14], [50, 31], [50, 45], [32, 55], [42, 30]]), 'rgba(0,10,50,0.22)'); });
  if (boss) { g.obj(circ(32, 30, 6.8), C.gold, { lw: 1.3 }); g.orb(32, 30, 4.4, C.goldDk, { lw: 0, spec: 1 }); }
}
function flame(g, x, y, s) {
  g.placed(x, y, s, 0, () => {
    g.obj(S('M32 2 C35 14 47 20 48 35 C49 49 41 58 32 59 C23 58 15 49 16 35 C17 27 22 23 25 14 C28 18 30 11 32 2 Z'), ['#fff2a0', '#ff9a30', '#d8261e'], { lw: 1.6, ang: 80, hi: 0.3, sh: 0.1 });
    g.obj(S('M32 26 C34 33 40 36 40 43 C40 50 36 54 32 55 C28 54 24 50 24 43 C24 36 30 33 32 26 Z'), ['#ffffff', '#fff0a0', '#ffc030'], { lw: 0, ang: 80, hi: 0, sh: 0 });
  });
}
function zzz(g, x, y, s) {
  const z = (px, py, k) => g.stroke(poly([[px, py], [px + k, py], [px, py + k], [px + k, py + k]], false), '#ffffff', Math.max(2.4, k * 0.3), { lw: 1.3, cap: 'butt' });
  z(x, y + 10 * s, 9 * s); z(x + 9 * s, y + 3 * s, 7 * s); z(x + 16 * s, y - 2 * s, 5.2 * s);
}
function speaker(g, gold = true) {
  g.obj(poly([[5, 24], [17, 24], [33, 9], [33, 55], [17, 40], [5, 40]]), C.steel, { lw: 1.6, ang: 40 });
  g.flat(poly([[7, 26], [17, 26], [31, 13], [31, 16], [19, 28], [7, 28]]), 'rgba(255,255,255,0.5)');
}

const U = {};

U.attack = g => {
  g.placed(32, 32, 0.9, -40, () => swordV(g));
  g.placed(32, 32, 0.9, 40, () => swordV(g));
  g.spark(32, 22, 3.6, '#fff', '#fff0b0');
};
U.move = g => {
  g.rotated(32, 32, 45, () => g.obj(arrow(32, 63, 32, 1, 18, 44, 28), GREEN, { lw: 1.8, ang: 60 }));
  g.flat(circ(10, 54, 3.4), '#b8f0a8'); g.flat(circ(5, 59, 2.2), '#b8f0a8');
};
U.stop = g => {
  g.obj(octagon(32, 32, 30), ['#ff7a6a', '#d8261e', '#780c0c'], { lw: 1.8, ang: 60 });
  g.stroke(octagon(32, 32, 25.5), 'rgba(255,255,255,0.8)', 2, { lw: 0 });
  g.placed(34, 33.5, 0.86, 0, () => {
    g.obj(rr(36, 33.5, 12, 6, 3), C.white, { lw: 1.2, hi: 0.3 });  // thumb stub (behind palm)
    for (const [x, y, h] of [[20.6, 15, 24], [26.9, 10.5, 28], [33.2, 12, 27], [39.5, 17.5, 22]]) g.obj(rr(x, y, 5.6, h, 2.8), C.white, { lw: 1.1, hi: 0.4 });
    g.obj(rr(20.2, 30, 25, 20, 7), C.white, { lw: 1.3 });
    g.rotated(19, 42, -32, () => g.obj(rr(12.5, 33.5, 6.4, 17, 3.2), C.white, { lw: 1.1, hi: 0.4 }));
  });
};
U.delete = g => {
  g.obj(poly([[14, 22], [50, 22], [46, 58], [18, 58]]), ['#e4eaf4', '#a9b4c8', '#5a667c'], { lw: 1.7, ang: 0 });
  g.obj(rr(9, 13, 46, 8, 3), C.steel, { lw: 1.5 });
  g.obj(rr(24, 6, 16, 8, 3.4), C.steelDk, { lw: 1.4 });
  g.placed(32, 41, 0.62, 45, () => g.obj(rr(26, 4, 12, 56, 5), REDP, { lw: 1.6, ang: 60 }));
  g.placed(32, 41, 0.62, -45, () => g.obj(rr(26, 4, 12, 56, 5), REDP, { lw: 1.6, ang: 60 }));
};
function tower(g, x, y, w, h) {
  g.obj(rr(x, y, w, h, 0.6), STONE, { ang: 10, lw: 1.6 });
  g.flat(rr(x + w * 0.58, y, w * 0.42, h, 0), 'rgba(40,30,70,0.22)');
  const n = 3, mw = (w + 1.6) / (n * 2 - 1);
  for (let i = 0; i < n; i++) g.obj(rr(x - 0.8 + i * mw * 2, y - 7, mw, 8.5, 0.5), STONE, { lw: 1.3, ang: 10 });
}
U.garrison = g => {
  tower(g, 30, 17, 28, 41);
  g.obj(S('M37 58 V47 Q44 38 51 47 V58 Z'), ['#6a4424', '#3b2411', '#1d1209'], { lw: 1.3, hi: 0.1 });
  g.obj(arrow(1, 41, 40, 41, 11, 25, 15), GREEN, { lw: 1.8, ang: 60 });
};
U.ungarrison = g => {
  tower(g, 6, 17, 28, 41);
  g.obj(S('M13 58 V47 Q20 38 27 47 V58 Z'), ['#6a4424', '#3b2411', '#1d1209'], { lw: 1.3, hi: 0.1 });
  g.obj(arrow(22, 44, 63, 44, 11, 25, 15), ORANGE, { lw: 1.8, ang: 60 });
};
U.rally = g => {
  g.shadow(32, 58.5, 24, 3.6, 0.4);
  g.obj(smooth([[8, 59], [14, 51], [26, 48], [38, 50], [52, 52], [58, 59]]), STONE, { lw: 1.5, hi: 0.4 });
  g.tube(22, 58, 22, 5, 4.4, C.wood, { lw: 1.5 });
  g.obj(S('M24.5 7 C32 3 39 11 47 8 C53 6 57 7 60 8 L53 19 L60 31 C55 32 49 30 45 33 C38 36 31 29 24.5 32 Z'), ['#ff9a86', '#e0382c', '#821410'], { lw: 1.6, ang: 70 });
  g.clip(S('M24.5 7 C32 3 39 11 47 8 C53 6 57 7 60 8 L53 19 L60 31 C55 32 49 30 45 33 C38 36 31 29 24.5 32 Z'), () => { g.flat(poly([[24, 5], [34, 5], [36, 34], [24, 34]]), 'rgba(255,255,255,0.12)'); g.stroke(S('M26 20 C32 15 38 23 46 20'), 'rgba(255,230,120,0.7)', 2.2, { lw: 0 }); });
  g.orb(22, 5, 3.6, C.gold, { lw: 1.2 });
};
U.repair = g => {
  g.placed(32, 32, 0.92, -42, () => hammerV(g));
  g.placed(32, 32, 0.92, 42, () => wrenchV(g));
};
U.build_eco = g => {
  cottage(g, 30, 32, 0.92);
  g.placed(49, 47, 0.5, 40, () => hammerV(g));
};
U.build_mil = g => {
  g.shadow(30, 58, 24, 3.4, 0.4);
  tower(g, 12, 22, 34, 36);
  g.flat(rr(26, 33, 2.6, 9, 1.2), '#1d1209');
  g.obj(S('M21 58 V48 Q29 40 37 48 V58 Z'), ['#6a4424', '#3b2411', '#1d1209'], { lw: 1.3, hi: 0.1 });
  g.line(29, 15, 29, 3, C.woodDk[1], 1.6, { lw: 0.9 });
  g.obj(poly([[29.8, 3], [42, 6.5], [29.8, 10.5]]), REDP, { lw: 1.3 });
  g.placed(49, 47, 0.5, 40, () => hammerV(g));
};
U.back = g => { g.obj(arrow(59, 32, 5, 32, 20, 44, 26), ['#fff4b0', '#f3c63a', '#b57a14'], { lw: 1.8, ang: 60 }); };
U.cancel = g => {
  g.placed(32, 32, 1, 45, () => g.obj(rr(26, 3, 12, 58, 5), REDP, { lw: 1.7, ang: 60 }));
  g.placed(32, 32, 1, -45, () => g.obj(rr(26, 3, 12, 58, 5), REDP, { lw: 1.7, ang: 60 }));
};
U.stance_aggressive = g => {
  flame(g, 32, 32, 1);
  g.placed(32, 33, 0.8, 0, () => swordV(g));
};
U.stance_defensive = g => {
  g.placed(32, 24, 0.62, 0, () => swordV(g));
  g.placed(32, 41, 0.80, 0, () => drawShield(g, BLUEP));
};
U.stand_ground = g => {
  g.placed(32, 33, 0.97, 0, () => {
    g.tube(32, 13, 32, 52, 5.8, C.steelDk, { lw: 1.6 });
    g.tube(20, 23, 44, 23, 4.8, C.steelDk, { lw: 1.5 });
    g.stroke(S('M11 42 Q15 58 32 58 Q49 58 53 42'), C.steel, 5.6, { lw: 1.6, ang: 70 });
    g.obj(poly([[4, 37], [18, 43], [9, 51]]), C.steel, { lw: 1.4 });
    g.obj(poly([[60, 37], [46, 43], [55, 51]]), C.steelDk, { lw: 1.4 });
    g.stroke(circ(32, 8, 5), C.steel, 3.6, { lw: 1.4 });
  });
};
U.stance_passive = g => {
  const W = ['#ffffff', '#f4f1ea', '#b8b6b0'];
  g.obj(smooth([[14, 38], [20, 33], [34, 32], [47, 35], [53, 41], [45, 48], [30, 50], [18, 46]]), W, { lw: 1.6, ang: 70 });
  g.obj(smooth([[17, 41], [4, 42], [1, 50], [9, 51], [19, 47]]), W, { lw: 1.4, ang: 70 });
  g.obj(S('M36 38 C27 31 17 20 13 7 C28 8 42 18 49 36 Z'), W, { lw: 1.6, ang: 70 });
  g.clip(S('M36 38 C27 31 17 20 13 7 C28 8 42 18 49 36 Z'), () => { for (let i = 0; i < 3; i++) g.stroke(S(`M${n2(20 + i * 6)} ${n2(14 + i * 6)}Q${n2(28 + i * 5)} ${n2(18 + i * 5)} ${n2(40 + i * 3)} ${n2(34)}`), 'rgba(120,130,150,0.5)', 1.2, { lw: 0 }); });
  g.obj(circ(52, 30, 7.6), W, { lw: 1.6, ang: 70 });
  g.obj(poly([[58, 27.5], [64, 30.5], [58, 33.5]]), ['#ffd870', '#f0a020', '#a85a08'], { lw: 1.1, hi: 0.3 });
  g.flat(circ(54, 28.4, 1.4), '#1d1209');
  g.stroke(S('M44 52 Q50 44 58 40'), '#4aa83c', 1.8, { lw: 0.9 });
  g.obj(ell(52, 43.6, 4.2, 2, -50), GREEN, { lw: 0.9, hi: 0.3 }); g.obj(ell(47, 48.2, 4, 1.9, -35), GREEN, { lw: 0.9, hi: 0.3 });
};
U.idle_villager = g => {
  g.placed(26, 36, 0.92, 0, () => {
    g.obj(smooth([[3, 66], [5, 46], [19, 40], [45, 40], [59, 46], [61, 66]]), BLUEP, { lw: 1.7, ang: 70 });
    g.obj(S('M24 42 Q32 52 40 42 Z'), ['#ffe6c8', '#eab88a', '#b07650'], { lw: 1.1, hi: 0.2 });
    g.obj(circ(32, 27, 12), ['#ffe6c8', '#eab88a', '#b07650'], { lw: 1.7, ang: 70 });
    g.obj(S('M18 24 Q32 4 46 24 Q32 18 18 24 Z'), ['#f0d070', '#c8a030', '#7a5a14'], { lw: 1.3, hi: 0.4 });
    g.obj(ell(32, 22, 18, 4.4), ['#f0d070', '#c8a030', '#7a5a14'], { lw: 1.4, hi: 0.4 });
    g.flat(circ(27.5, 29, 1.3), '#2a1a10'); g.flat(circ(36.5, 29, 1.3), '#2a1a10');
  });
  zzz(g, 41, 4, 1);
};
U.idle_military = g => {
  g.placed(26, 36, 0.92, 0, () => {
    g.obj(smooth([[3, 66], [5, 46], [19, 40], [45, 40], [59, 46], [61, 66]]), REDP, { lw: 1.7, ang: 70 });
    g.obj(circ(32, 30, 11), ['#ffe6c8', '#eab88a', '#b07650'], { lw: 1.6, ang: 70 });
    g.obj(S('M19 31 Q19 10 32 10 Q45 10 45 31 L40 31 L40 25 L24 25 L24 31 Z'), C.steel, { lw: 1.6, ang: 50 });
    g.obj(rr(30.6, 24, 2.8, 12, 1), C.steelDk, { lw: 1, hi: 0.3 });
    g.flat(circ(26.5, 30.5, 1.3), '#2a1a10'); g.flat(circ(37.5, 30.5, 1.3), '#2a1a10');
    g.obj(rr(14, 41, 36, 4.6, 2), C.steelDk, { lw: 1.2 });
  });
  zzz(g, 41, 4, 1);
};
U.menu = g => {
  for (const y of [10, 26, 42]) g.obj(rr(6, y, 52, 12, 6), ['#fff4b0', '#f3c63a', '#a56d14'], { lw: 1.7, ang: 90 });
};
function badge(g, pal, sign) {
  g.obj(circ(30, 31, 27), pal, { lw: 1.8, ang: 60 });
  g.stroke(circ(30, 31, 22), 'rgba(255,255,255,0.45)', 1.6, { lw: 0 });
  if (sign === '+') g.obj(combo(rr(24, 13, 12, 36, 3), rr(12, 25, 36, 12, 3)), C.white, { lw: 1.4 });
  else g.obj(rr(12, 25, 36, 12, 3), C.white, { lw: 1.4 });
  g.obj(circ(49, 49, 11), C.gold, { lw: 1.7 });
  g.stroke(circ(49, 49, 7.2), 'rgba(110,60,8,0.55)', 1.6, { lw: 0 });
  g.flat(rr(47.6, 43.5, 2.8, 11, 1), 'rgba(110,60,8,0.7)');
}
U.buy = g => badge(g, GREEN, '+');
U.sell = g => badge(g, REDP, '-');
U.attack_move = g => {
  g.placed(40, 25, 0.74, 45, () => swordV(g));
  // thick forward arrow underneath: "move, then attack"
  g.obj(arrow(4, 59, 30, 33, 11, 25, 15), ['#e8f4ff', '#6aa8f0', '#2058b0'], { lw: 1.8, ang: 60 });
  g.flat(circ(8, 62, 2.4), 'rgba(200,225,255,0.9)');
};
U.patrol = g => {
  const top = S('M9 34 A23 17 0 0 1 55 34', [9, 17, 55, 34]), bot = S('M55 30 A23 17 0 0 1 9 30', [9, 30, 55, 47]);
  g.stroke(top, ['#d0ecff', '#58a8f0', '#1e5aa8'], 6.4, { lw: 1.7, cap: 'butt' });
  g.stroke(bot, ['#d0ecff', '#58a8f0', '#1e5aa8'], 6.4, { lw: 1.7, cap: 'butt' });
  g.obj(poly([[46, 32], [64, 32], [55, 47]]), BLUEP, { lw: 1.7, hi: 0.4 });
  g.obj(poly([[0, 32], [18, 32], [9, 17]]), BLUEP, { lw: 1.7, hi: 0.4 });
  g.orb(32, 11, 3, C.gold, { lw: 1 });
};
U.heal = g => {
  g.glow(32, 32, 31, '#b8ffb8', 0.55);
  g.obj(combo(rr(21, 5, 22, 54, 6), rr(5, 21, 54, 22, 6)), ['#d0ffc0', '#3fcf5a', '#14782c'], { lw: 1.9, ang: 55 });
  g.flat(rr(25, 9, 5, 46, 2.5), 'rgba(255,255,255,0.35)'); g.flat(rr(9, 25, 46, 5, 2.5), 'rgba(255,255,255,0.35)');
  sparkles(g, [[52, 10, 4.4], [10, 52, 3.4], [54, 52, 2.6]]);
};
U.convert = g => {
  ringArrow(g, 32, 32, 25, -160, -30, 7.4, PURP, 13, 19);
  ringArrow(g, 32, 32, 25, 20, 150, 7.4, PURP, 13, 19);
  g.placed(32, 32, 0.42, 0, () => {
    const c = 32, w0 = 4.8, w1 = 9, L = 27.5;
    g.obj(poly([[c - w1, c - L], [c + w1, c - L], [c + w0, c - w0], [c + L, c - w1], [c + L, c + w1], [c + w0, c + w0], [c + w1, c + L], [c - w1, c + L], [c - w0, c + w0], [c - L, c + w1], [c - L, c - w1], [c - w0, c - w0]]), C.gold, { lw: 2.6, ang: 50 });
  });
};
U.unpack = g => {
  g.shadow(32, 58, 26, 3.4, 0.4);
  g.obj(rr(8, 31, 48, 27, 2), C.wood, { lw: 1.7, ang: 70 });
  g.clip(rr(8, 31, 48, 27, 2), () => {
    for (const y of [40, 49]) g.line(8, y, 56, y, 'rgba(50,25,8,0.5)', 1, { cap: 'butt' });
    g.line(9, 32, 55, 57, 'rgba(50,25,8,0.45)', 2.4, { cap: 'butt' }); g.line(55, 32, 9, 57, 'rgba(50,25,8,0.45)', 2.4, { cap: 'butt' });
    g.flat(rr(8, 31, 48, 3, 0), 'rgba(255,230,180,0.5)');
  });
  g.obj(poly([[8, 31], [1, 18], [19, 13], [24, 31]]), C.woodLt, { lw: 1.5, ang: 60 });
  g.obj(poly([[56, 31], [63, 18], [45, 13], [40, 31]]), C.woodLt, { lw: 1.5, ang: 60 });
  g.obj(arrow(32, 40, 32, 1, 12, 28, 17), GREEN, { lw: 1.7, ang: 60 });
};
U.wall = g => GLYPHS.wall.draw(g, { acc: '', metal: C.steel, trim: C.gold });
U.gate = g => {
  g.shadow(32, 58.5, 28, 3.4, 0.4);
  for (const x of [3, 47]) {
    g.obj(rr(x, 14, 14, 45, 0.6), STONE, { ang: 10, lw: 1.6 });
    for (let i = 0; i < 2; i++) g.obj(rr(x + i * 7.6 - 0.4, 8, 5.4, 7.6, 0.5), STONE, { lw: 1.2, ang: 10 });
    g.flat(rr(x + 8, 14, 6, 45, 0), 'rgba(40,30,70,0.22)');
  }
  const arch = S('M17 59 V30 Q32 11 47 30 V59 Z');
  g.obj(arch, ['#9a6a3a', '#6a4424', '#33200e'], { lw: 1.6, ang: 0, hi: 0.2 });
  g.clip(arch, () => {
    for (const x of [22, 27, 37, 42]) g.line(x, 14, x, 60, 'rgba(30,15,5,0.4)', 1, { cap: 'butt' });
    g.line(32, 14, 32, 60, 'rgba(20,10,2,0.75)', 1.6, { cap: 'butt' });
    for (const y of [32, 46]) g.line(17, y, 47, y, '#3a4252', 3.2, { cap: 'butt' });
    for (const y of [32, 46]) for (const x of [21, 26, 38, 43]) g.orb(x, y, 1, C.steelBr, { lw: 0.3 });
  });
  g.stroke(arch, STONE, 4.6, { lw: 1.4, ang: 40 });
  g.orb(28.6, 41, 1.8, C.brass, { lw: 0.6 }); g.orb(35.4, 41, 1.8, C.brass, { lw: 0.6 });
};
U.town_center = g => {
  g.shadow(32, 58.5, 29, 3.6, 0.4);
  g.obj(rr(5, 34, 54, 24, 0.8), ['#f6ecd0', '#d9c79a', '#8c7a4a'], { lw: 1.6, ang: 30 });
  g.flat(rr(40, 34, 19, 24, 0), 'rgba(60,40,10,0.18)');
  g.obj(poly([[1, 37], [13, 23], [51, 23], [63, 37]]), ['#f0906a', '#c04e2c', '#6c2410'], { lw: 1.6, ang: 80 });
  g.obj(rr(23, 15, 18, 34, 0.8), STONE, { lw: 1.6, ang: 10 });
  g.flat(rr(33, 15, 8, 34, 0), 'rgba(40,30,70,0.22)');
  g.obj(poly([[20, 17], [32, 0], [44, 17]]), ['#8fc0ff', '#3b78d8', '#173d8a'], { lw: 1.6, ang: 40 });
  g.line(32, 1, 32, -4, C.woodDk[1], 1.2, { lw: 0.6 });
  g.obj(S('M26.5 49 V41 Q32 35 37.5 41 V49 Z'), ['#7a4a26', '#4a2a12', '#24130a'], { lw: 1.1, hi: 0.1 });
  g.flat(rr(30.8, 22, 2.4, 8, 1), '#1d1209');
  for (const x of [11, 46]) g.obj(rr(x, 40, 7, 8, 0.6), ['#d6f0ff', '#8cc4ea', '#4a82b0'], { lw: 1, hi: 0.5 });
  g.obj(rr(1, 57, 62, 3.6, 1.4), C.stoneDk, { lw: 1.1, hi: 0.3 });
};
U.flare = g => {
  g.glow(36, 22, 28, '#ffd070', 0.5);
  g.rotated(26, 50, -22, () => {
    g.tube(26, 63, 26, 40, 8, ['#ff9a86', '#d9382c', '#7a1410'], { lw: 1.6, cap: 'butt' });
    g.obj(rr(21, 36, 10, 6, 1.4), C.gold, { lw: 1.3 });
  });
  flame(g, 36, 24, 0.55);
  sparkles(g, [[55, 8, 4.4], [12, 14, 3.4], [58, 34, 2.8], [8, 36, 2.4]]);
};
U.speed = g => {
  const chev = (dx) => poly([[6 + dx, 6], [22 + dx, 6], [40 + dx, 32], [22 + dx, 58], [6 + dx, 58], [24 + dx, 32]]);
  g.obj(chev(0), ['#fff4b0', '#f3c63a', '#b57a14'], { lw: 1.8, ang: 70 });
  g.obj(chev(20), ['#ffe0a0', '#ff9a30', '#c04a0c'], { lw: 1.8, ang: 70 });
};
U.pause = g => {
  g.obj(rr(10, 6, 17, 52, 5), ['#fff4b0', '#f3c63a', '#a56d14'], { lw: 1.8, ang: 70 });
  g.obj(rr(37, 6, 17, 52, 5), ['#fff4b0', '#f3c63a', '#a56d14'], { lw: 1.8, ang: 70 });
};
U.sound = g => {
  speaker(g);
  g.stroke(S('M40 22 Q48 32 40 42'), ['#fff4b0', '#f3c63a', '#b57a14'], 4.6, { lw: 1.5, cap: 'round' });
  g.stroke(S('M46 14 Q60 32 46 50'), ['#fff4b0', '#f3c63a', '#b57a14'], 4.6, { lw: 1.5, cap: 'round' });
};
U.mute = g => {
  speaker(g);
  g.placed(49, 32, 0.62, 45, () => g.obj(rr(26, 3, 12, 58, 5), REDP, { lw: 1.7, ang: 60 }));
  g.placed(49, 32, 0.62, -45, () => g.obj(rr(26, 3, 12, 58, 5), REDP, { lw: 1.7, ang: 60 }));
};
U.chat = g => {
  g.obj(S('M9 8 H55 Q60 8 60 13 V38 Q60 43 55 43 H30 L15 57 L18 43 H9 Q4 43 4 38 V13 Q4 8 9 8 Z'), ['#ffffff', '#f4efe0', '#b8ad94'], { lw: 1.8, ang: 60 });
  for (const x of [18, 32, 46]) g.obj(circ(x, 25.5, 4), ['#6a8cc8', '#2e4e96', '#14285e'], { lw: 0.8, hi: 0.3 });
};
U.objectives = g => {
  g.obj(rr(9, 5, 46, 54, 3), C.parch, { lw: 1.7, ang: 60 });
  for (let i = 0; i < 3; i++) {
    const y = 14 + i * 15;
    g.obj(rr(14, y - 4.4, 9, 9, 1.6), C.white, { lw: 1.1, hi: 0.2 });
    g.line(28, y, 49, y, 'rgba(70,40,15,0.75)', 3, { lw: 0 });
  }
  g.stroke(poly([[14.5, 14.5], [18, 19], [26, 7]], false), '#2fa84a', 4.2, { lw: 1.4 });
  g.obj(circ(45, 51, 8), REDP, { lw: 1.5 });
  g.spark(45, 51, 4.6, '#ffe27a');
};
U.trade = g => {
  g.obj(rr(20, 54, 24, 6, 2.4), C.woodDk, { lw: 1.4 });
  g.tube(32, 55, 32, 12, 4.6, C.brass, { lw: 1.5 });
  g.tube(5, 17, 59, 17, 4.2, C.brass, { lw: 1.5 });
  g.orb(32, 10, 4, C.gold, { lw: 1.2 });
  for (const x of [8, 56]) {
    g.line(x, 18, x - 5.5, 38, '#e4cc92', 1.3, { lw: 0.7 }); g.line(x, 18, x + 5.5, 38, '#e4cc92', 1.3, { lw: 0.7 });
    g.obj(S(`M${x - 11.5} 38Q${x} 53 ${x + 11.5} 38Z`), C.gold, { lw: 1.5, ang: 70 });
  }
  g.orb(8, 34.4, 3.8, C.gold, { lw: 1 }); g.orb(56, 34.4, 3.8, C.gold, { lw: 1 }); g.orb(52, 33.6, 3.4, C.goldDk, { lw: 1 });
};
U.research = g => {
  g.glow(32, 36, 30, '#b8ffd0', 0.4);
  const body = S('M25 6 H39 V22 L55 52 Q58 60 50 60 H14 Q6 60 9 52 L25 22 Z');
  g.obj(body, ['#f4fbff', '#cfe6f4', '#7a9cb8'], { lw: 1.8, ang: 20 });
  g.clip(body, () => {
    g.flat(poly([[0, 40], [64, 40], [64, 64], [0, 64]]), ['#b8ffa8', '#3fcf5a', '#14782c'], undefined, 90);
    g.stroke(S('M6 40 Q16 36 26 40 T46 40 T66 40'), 'rgba(255,255,255,0.65)', 1.6, { lw: 0 });
    g.flat(poly([[27, 8], [31, 8], [29, 22], [12, 52], [15, 52], [27, 24]]), 'rgba(255,255,255,0.5)');
    g.orb(26, 48, 2.8, ['#ffffff', '#c8ffc8', '#60d070'], { lw: 0.8 }); g.orb(38, 52, 2, ['#ffffff', '#c8ffc8', '#60d070'], { lw: 0.8 }); g.orb(34, 44, 1.6, ['#ffffff', '#c8ffc8', '#60d070'], { lw: 0.6 });
  });
  g.stroke(body, 'rgba(10,40,60,0.0)', 0);
  g.obj(rr(22, 2, 20, 7, 2), C.leather, { lw: 1.4 });
  sparkles(g, [[52, 14, 4.4], [12, 16, 3]]);
};
U.queue = g => {
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 20;
    g.obj(rr(x, 10, 17, 24, 3), i === 0 ? ['#fff4b0', '#f3c63a', '#a56d14'] : ['#d4dcea', '#8e9ab2', '#4a566e'], { lw: 1.6, ang: 70 });
    g.obj(rr(x + 3, 14, 11, 16, 2), i === 0 ? ['#a8d2ff', '#3f86ec', '#173f94'] : ['#8a96ae', '#566278', '#2a3346'], { lw: 0.9, ang: 70, hi: 0.2 });
    if (i === 0) g.obj(circ(x + 8.5, 21.5, 4), ['#ffe6c8', '#eab88a', '#b07650'], { lw: 0.8, hi: 0.2 });
  }
  g.obj(rr(3, 43, 57, 12, 4), ['#6a7488', '#3e4658', '#1e2430'], { lw: 1.6, ang: 90, hi: 0.2 });
  g.obj(rr(5.5, 45.5, 31, 7, 2.6), ['#d8ffb8', '#4cc450', '#1b7a2c'], { lw: 0.6, ang: 90 });
};
U.select_all = g => {
  g.stroke(rr(6, 8, 52, 46, 3), '#ffffff', 3.2, { lw: 1.4, dash: [7, 5], cap: 'butt' });
  for (const [x, y] of [[6, 8], [58, 8], [6, 54], [58, 54]]) g.obj(rr(x - 4, y - 4, 8, 8, 1.6), C.gold, { lw: 1.3 });
  for (const [x, y] of [[22, 22], [42, 22], [32, 38]]) {
    g.obj(smooth([[x - 7, y + 16], [x - 6, y + 5], [x, y + 2], [x + 6, y + 5], [x + 7, y + 16]]), BLUEP, { lw: 1.3, hi: 0.3 });
    g.obj(circ(x, y - 2, 5), ['#ffe6c8', '#eab88a', '#b07650'], { lw: 1.2 });
  }
};
U.minimap_signal = g => {
  g.obj(rr(4, 4, 56, 56, 6), ['#7ac060', '#3d8a3c', '#1d5a2a'], { lw: 1.8, ang: 60 });
  g.clip(rr(4, 4, 56, 56, 6), () => {
    g.stroke(S('M4 46 Q20 40 30 48 T60 38'), '#5aa8e8', 6, { lw: 0 });
    g.flat(poly([[4, 4], [60, 4], [60, 14], [4, 22]]), 'rgba(255,255,255,0.12)');
  });
  g.stroke(circ(32, 32, 24), 'rgba(255,230,90,0.45)', 3, { lw: 0 });
  g.stroke(circ(32, 32, 16), 'rgba(255,230,90,0.75)', 3.4, { lw: 0 });
  g.stroke(circ(32, 32, 8.5), '#ffe65a', 3.8, { lw: 1.3 });
  g.obj(circ(32, 32, 3.6), REDP, { lw: 1.2 });
};

export const UI_NAMES = Object.keys(U);
export function buildUi(name, size) {
  const f = U[name];
  return renderIcon(size, g => { if (f) f(g); else U.cancel(g); }, { shadow: 0.9 });
}
