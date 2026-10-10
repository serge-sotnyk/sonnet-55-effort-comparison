// Military glyphs: sword shield barding bow archerarmor boots ring horse banner gear
import { mix, shade } from './common.js';
import { C, S, circ, ell, rr, poly, smooth, combo, gearShape, n2, DEG } from './icons_kit.js';
import { def, hatch, sparkles, wheatEar, drop, swordV, drawHorseHead, horseHeadShape, headPt, HORSE_HEAD_PTS } from './icons_parts.js';

// ---------- sword (Forging / Iron Casting / Blast Furnace)
def('sword', 'mil', (g, m) => {
  g.glow(32, 32, 26, '#ffffff', 0.18);
  g.rotated(32, 32, 45, () => { g.placed(32, 33, 0.97, 0, () => swordV(g, m.metal, m.trim)); });
  g.spark(49, 15, 3.8, '#fff', '#cfe4ff'); g.spark(55, 25, 2.2, '#fff');
});

// ---------- shield with scale-mail pattern (Scale/Chain/Plate Mail Armor)
def('shield', 'mil', (g, m) => {
  const outer = S('M8.5 8.5 Q32 15 55.5 8.5 L55.5 31 Q55.5 50 32 61.5 Q8.5 50 8.5 31 Z');
  const inner = S('M14 14 Q32 20 50 14 L50 31 Q50 45 32 55 Q14 45 14 31 Z');
  g.obj(outer, m.metal, { ang: 60, lw: 1.6 });
  g.obj(inner, m.field || C.blue, { ang: 20, lw: 1.1, hi: 0.25 });
  const fieldPal = m.field || C.blue;
  g.clip(inner, () => {
    const sc = 6.4, rowH = 4.5;
    for (let j = 9; j >= 0; j--) {
      for (let i = -1; i < 9; i++) {
        const x = 11 + i * sc + (j % 2) * sc / 2, y = 12 + j * rowH;
        const scale = S(`M${n2(x - sc / 2)} ${n2(y)}L${n2(x + sc / 2)} ${n2(y)}L${n2(x + sc / 2)} ${n2(y + 1.6)}Q${n2(x + sc / 2)} ${n2(y + 6.2)} ${n2(x)} ${n2(y + 6.6)}Q${n2(x - sc / 2)} ${n2(y + 6.2)} ${n2(x - sc / 2)} ${n2(y + 1.6)}Z`);
        g.obj(scale, [shade(fieldPal[0], 0.1), fieldPal[1], shade(fieldPal[2], -0.1)], { lw: 0.65, ink: 'rgba(6,14,50,0.85)', ang: 80, hi: 0.5, sh: 0.15, bev: 0.7 });
      }
    }
    g.flat(poly([[14, 14], [32, 18], [14, 36]]), 'rgba(255,255,255,0.14)');
    g.flat(poly([[50, 14], [50, 31], [50, 45], [32, 55], [42, 30]]), 'rgba(0,10,50,0.20)');
  });
  g.stroke(inner, 'rgba(0,0,30,0.6)', 1.4, { lw: 0 });
  for (const [x, y] of [[12, 12.5], [52, 12.5], [32, 15.5], [11.5, 30], [52.5, 30], [20, 48], [44, 48]]) g.orb(x, y, 1.3, C.steelBr, { lw: 0.45 });
  g.obj(circ(32, 30, 6.8), C.gold, { lw: 1.4 }); g.orb(32, 30, 4.6, C.goldDk, { lw: 0, spec: 1 });
  g.spark(18, 17, 2.8, '#fff');
});

// ---------- bow and arrow (Fletching / Bodkin / Bracer)
def('bow', 'mil', (g, m) => {
  g.rotated(30, 33, -42, () => {
    g.stroke(S('M25 5 Q5 32 25 59'), C.wood, 5.2, { lw: 1.5 });
    g.stroke(S('M24 8 Q7.6 32 24 56'), 'rgba(255,235,200,0.55)', 1.2, { lw: 0 });
    g.obj(circ(25, 5, 2.5), C.gold, { lw: 1 }); g.obj(circ(25, 59, 2.5), C.gold, { lw: 1 });
    g.stroke(poly([[25, 5], [40, 32], [25, 59]], false), '#f8f2e2', 1.2, { lw: 0.6 });
    g.obj(poly([[32, 30.1], [57, 30.1], [57, 33.9], [32, 33.9]]), C.woodLt, { lw: 1.1, hi: 0.4 });
    g.obj(poly([[54, 26.4], [67, 32], [54, 37.6], [57, 32]]), m.metal, { lw: 1.2, ang: 20 });
    g.obj(poly([[32, 32], [38, 25.5], [47, 25.5], [43, 32]]), C.red, { lw: 1 });
    g.obj(poly([[32, 32], [38, 38.5], [47, 38.5], [43, 32]]), C.red, { lw: 1 });
    g.flat(poly([[38, 25.5], [47, 25.5], [45.6, 28.2], [40, 28.2]]), 'rgba(255,255,255,0.9)');
  });
  g.spark(52, 12, 3, '#fff');
});

// ---------- horse (Bloodlines / Husbandry)
def('horse', 'cav', (g, m) => {
  const gold = m.acc === 'gold';
  const body = gold ? ['#fff0b4', '#efc050', '#a8741a'] : ['#e9a766', '#b46d32', '#6b3a18'];
  const mane = gold ? ['#ffffff', '#f6ecd0', '#bfae84'] : ['#6a4630', '#34210f', '#150c05'];
  g.glow(36, 30, 28, '#fff2d0', 0.25);
  drawHorseHead(g, 7, 3.5, 0.585, body, mane, gold ? C.red : C.leatherR);
  g.spark(54, 8, 3, '#fff');
}, { own: ['gold'] });

// ---------- barding (cavalry armor): armoured horse head facing left
def('barding', 'cav', (g, m) => {
  const metal = m.metal === C.steel ? C.steel : m.metal;
  g.glow(30, 30, 28, '#ffffff', 0.18);
  g.at(57, 3.5, 0.585, () => {
    g.c.save(); g.c.scale(-1, 1);          // face left (light direction is global, so shading is approximate on the mirrored parts)
    const F = pts => pts;
    // plume streaming back
    g.obj(smooth([[40, 8], [30, -4], [18, -6], [8, 2], [18, 2], [9, 12], [22, 9], [17, 20], [31, 14]]), C.red, { lw: 1.6, ang: 60 });
    // head + neck in dark steel-blue
    const head = horseHeadShape();
    g.obj(head, C.steelDk, { lw: 2.2, ang: 60 });
    g.obj(poly([[39, 13], [43, -5], [53, 15]]), C.steelDk, { lw: 1.5, hi: 0.2 });
    g.clip(head, () => {
      // overlapping neck plates (crinet), drawn lower to upper
      const bands = [[2, 98, 41, 98], [6, 84, 37, 85], [11, 68, 34, 69], [17, 52, 35, 58], [24, 36, 38, 48]];
      for (const [cx0, cy0, fx0, fy0] of bands) {
        g.obj(S(`M${cx0 - 12} ${cy0 - 1}Q${(cx0 + fx0) / 2} ${cy0 + 7} ${fx0 + 8} ${fy0 - 1}L${fx0 + 8} ${fy0 + 13}Q${(cx0 + fx0) / 2} ${cy0 + 20} ${cx0 - 12} ${cy0 + 13}Z`), metal, { lw: 1.5, ang: 80, hi: 0.5 });
      }
    });
    // chanfron (face plate)
    const T = headPt;
    const plate = poly([T(5, 7), T(20, 12.5), T(40, 11), T(62, 9.5), T(73, 5), T(79, 0), T(73, -7), T(62, -10), T(40, -9), T(22, -10), T(8, -5)]);
    g.obj(plate, metal, { lw: 1.8, ang: 55 });
    g.stroke(poly([T(8, 1), T(76, 0)], false), 'rgba(255,255,255,0.8)', 1.6, { lw: 0 });
    g.stroke(poly([T(8, -1.5), T(74, -2.5)], false), 'rgba(30,45,80,0.3)', 1.4, { lw: 0 });
    const sp = T(10, 7);
    g.obj(poly([[sp[0] - 3, sp[1]], [sp[0] - 6, sp[1] - 16], [sp[0] + 3, sp[1] - 1]]), C.gold, { lw: 1.4 });
    const eye = T(21, 3.5);
    g.obj(ell(eye[0], eye[1], 4.4, 3.6, 30), ['#3a2f2a', '#120a06', '#000'], { lw: 1.4, hi: 0, sh: 0 });
    g.flat(circ(eye[0] - 1.3, eye[1] - 1.4, 1.2), '#fff');
    for (const [t, o] of [[8, 5], [32, 8], [60, 7], [32, -7], [60, -8]]) { const r = T(t, o); g.orb(r[0], r[1], 1.8, C.gold, { lw: 0.6 }); }
    g.c.restore();
  });
  // red caparison along the bottom with a gold trim
  g.obj(S('M2 55L62 55L62 60L56 63L50 60L44 63L38 60L32 63L26 60L20 63L14 60L8 63L2 60Z'), C.red, { lw: 1.4, ang: 70 });
  g.line(3, 56.8, 61, 56.8, C.gold[1], 1.5, { lw: 0 });
  g.spark(10, 14, 3, '#fff', '#ffffff');
});

// ---------- archer armor: studded leather jerkin in front of a quiver
def('archerarmor', 'mil', (g, m) => {
  // quiver behind the right shoulder
  g.rotated(46, 30, 14, () => {
    for (const [x, c0] of [[43.5, C.white], [47.5, C.red], [51.5, C.white]]) { g.line(x, 20, x - 1, 7, '#e8d6a0', 1.7, { lw: 0.8 }); g.obj(poly([[x - 2.6, 9.5], [x - 1.2, 2.5], [x + 0.6, 9.5]]), c0, { lw: 0.8, hi: 0, sh: 0 }); }
    g.tube(47.5, 52, 47.5, 19, 10, C.leatherR, { lw: 1.6 });
    g.stroke(poly([[42.6, 24], [52.4, 24]], false), C.brass, 1.8, { lw: 0 });
    g.stroke(poly([[42.6, 44], [52.4, 44]], false), C.brass, 1.8, { lw: 0 });
  });
  const jerkin = S('M19 11.5 L26 9.5 L28.5 16 Q32 20.5 35.5 16 L38 9.5 L45 11.5 L48.5 21 L47 58 Q32 61.5 17 58 L15.5 21 Z');
  g.obj(jerkin, ['#cfa56e', '#8e6738', '#4d3016'], { lw: 1.8, ang: 60 });
  g.clip(jerkin, () => {
    hatch(g, 5, 8, 60, 62, 6.4, 45, 'rgba(40,20,6,0.28)', 0.9);
    hatch(g, 5, 8, 60, 62, 6.4, -45, 'rgba(40,20,6,0.28)', 0.9);
    hatch(g, 5, 8, 60, 62, 6.4, 45, 'rgba(255,230,180,0.14)', 0.7);
    g.flat(poly([[15.5, 21], [19, 11.5], [26, 9.5], [22, 26]]), 'rgba(255,255,255,0.16)');
    g.flat(poly([[48.5, 21], [47, 58], [41, 58], [43, 24]]), 'rgba(0,0,0,0.18)');
    g.flat(rr(10, 43.5, 46, 5.4, 0), '#4a2c14');
    g.flat(rr(10, 43.5, 46, 1.2, 0), 'rgba(255,220,160,0.4)');
  });
  // shoulder straps + neck opening with lacing
  g.obj(S('M26 9.5 L28.5 16 Q32 20.5 35.5 16 L38 9.5 L35 9.5 Q32 14 29 9.5 Z'), ['#5a381a', '#3a2210', '#1d1008'], { lw: 1.1, hi: 0, sh: 0 });
  g.obj(S('M28.5 16 Q32 20.5 35.5 16 L34 30 L30 30 Z'), ['#5a381a', '#3a2210', '#1d1008'], { lw: 1.1, hi: 0, sh: 0 });
  for (let i = 0; i < 4; i++) { g.line(30.4, 18.6 + i * 2.9, 33.6, 20 + i * 2.9, '#f1dfae', 1, { lw: 0 }); g.line(33.6, 18.6 + i * 2.9, 30.4, 20 + i * 2.9, '#f1dfae', 1, { lw: 0 }); }
  g.obj(rr(28, 42.8, 8, 7, 1.4), C.gold, { lw: 1.2 }); g.flat(rr(30.2, 44.8, 3.6, 3, 0.6), '#4a2c14');
  for (const [x, y] of [[21, 22], [43, 22], [20, 34], [44, 34]]) g.orb(x, y, 1.3, C.brass, { lw: 0.4 });
  g.spark(11, 14, 2.8, '#fff');
});

// ---------- boots (Squires)
def('boots', 'cav', (g, m) => {
  g.shadow(34, 58.5, 25, 3, 0.35);
  // speed streaks
  for (const [y, l] of [[22, 11], [31, 8], [40, 10]]) g.line(3 + (11 - l) * 0.3, y, 3 + l, y, 'rgba(255,255,255,0.85)', 2, { lw: 0.8 });
  const boot = S('M17 6 L40 6 L40 32 C40 36.5 44.5 38.5 51 40.8 C58.5 43.5 61 48.5 59.4 53.5 C58.5 56.5 55.5 58 52 58 L15 58 L15 51 C13.5 38 15 21 17 6 Z');
  g.obj(boot, C.leather, { lw: 1.8, ang: 60 });
  g.clip(boot, () => {
    g.flat(rr(10, 5, 34, 10.5, 0), ['#ecc08a', '#c08a52', '#7a4c22'], undefined, 90);
    g.flat(rr(10, 14.2, 34, 1.4, 0), 'rgba(40,18,4,0.45)');
    g.flat(poly([[15, 58], [60, 58], [60, 53.2], [15, 52.6]]), ['#5a3a1e', '#3a2210', '#1d1008']);
    g.flat(poly([[15, 52.6], [60, 53.2], [60, 54.2], [15, 53.6]]), 'rgba(255,220,160,0.35)');
    g.flat(rr(10, 28, 34, 5, 0), '#5a381a');
    g.flat(rr(10, 28, 34, 1, 0), 'rgba(255,220,160,0.4)');
    g.flat(poly([[17, 16], [22, 16], [21, 52], [16, 52]]), 'rgba(255,255,255,0.14)');
    g.flat(ell(52, 47, 7, 3.2, 30), 'rgba(255,255,255,0.14)');
  });
  g.obj(rr(25.5, 26.6, 8, 8.4, 1.6), C.gold, { lw: 1.2 }); g.flat(rr(27.8, 28.8, 3.4, 4, 0.8), '#4a2c14');
  g.obj(rr(13.5, 51.5, 13, 8, 2), C.woodDk, { lw: 1.3, hi: 0.3 });
  g.spark(48, 10, 3, '#fff');
});

// ---------- ring (Thumb Ring): jade ring with an arrow through it
def('ring', 'cav', (g, m) => {
  g.glow(32, 36, 28, '#c8ffe0', 0.25);
  g.rotated(32, 32, -38, () => {
    g.obj(poly([[0, 30.4], [60, 30.4], [60, 33.6], [0, 33.6]]), C.woodLt, { lw: 1.1, hi: 0.4 });
    g.obj(poly([[57, 26.6], [71, 32], [57, 37.4], [60, 32]]), C.steel, { lw: 1.2, ang: 20 });
    g.obj(poly([[0, 32], [6, 25.5], [15, 25.5], [11, 32]]), C.red, { lw: 1 });
    g.obj(poly([[0, 32], [6, 38.5], [15, 38.5], [11, 32]]), C.red, { lw: 1 });
  });
  const jade = ['#d2ffe6', '#43cd8c', '#127450'];
  const band = ell(31, 37, 17.5, 17.5);
  g.stroke(band, jade, 10.5, { lw: 1.7, ang: 45 });
  g.clip(circ(31, 37, 30), () => {
    g.stroke(S('M16 28 A17.5 17.5 0 0 1 36 19.8', [13, 19, 49, 55]), 'rgba(255,255,255,0.55)', 2.2, { lw: 0 });
    g.stroke(ell(31, 37, 17.5, 17.5), 'rgba(255,225,120,0.9)', 1.2, { dash: [3, 2], lw: 0 });
    g.stroke(S('M45 48 A17.5 17.5 0 0 1 24 54.4', [13, 19, 49, 55]), 'rgba(0,50,30,0.35)', 2.4, { lw: 0 });
  });
  g.obj(rr(24.5, 13.2, 13, 9, 2.6), C.gold, { lw: 1.4 });
  g.orb(31, 17.7, 3.5, C.ruby, { lw: 0.8 });
  sparkles(g, [[53, 54, 3.2], [9, 12, 2.6]]);
});

// ---------- banner (Conscription)
def('banner', 'mil', (g, m) => {
  g.glow(32, 32, 28, '#ffe9b0', 0.22);
  g.tube(7, 11.5, 57, 11.5, 4.4, C.wood, { lw: 1.4 });
  g.obj(circ(6, 11.5, 3), C.gold, { lw: 1.1 }); g.obj(circ(58, 11.5, 3), C.gold, { lw: 1.1 });
  const body = S('M12.5 13.5 H51.5 V56 L41.8 48.4 L32 56.5 L22.2 48.4 L12.5 56 Z');
  g.obj(body, ['#ff8268', '#d93a2e', '#7a1612'], { lw: 1.6, ang: 70 });
  g.clip(body, () => {
    g.flat(poly([[12.5, 13.5], [21, 13.5], [24, 56], [12.5, 56]]), 'rgba(255,255,255,0.13)');
    g.flat(poly([[30, 13.5], [38, 13.5], [40, 52], [32, 56]]), 'rgba(0,0,0,0.12)');
    g.flat(poly([[44, 13.5], [51.5, 13.5], [51.5, 56], [46, 50]]), 'rgba(0,0,0,0.16)');
    g.stroke(body, C.gold[1], 3.6, { lw: 0 });
    g.stroke(body, 'rgba(255,245,180,0.9)', 1, { lw: 0 });
  });
  // crossed swords emblem
  g.placed(32, 31, 0.40, -42, () => swordV(g, C.gold, C.goldDk));
  g.placed(32, 31, 0.40, 42, () => swordV(g, C.steelBr, C.gold));
  g.obj(poly([[32, 1], [35.6, 9.2], [28.4, 9.2]]), C.gold, { lw: 1.1 });
  g.line(8, 14, 8, 24, C.gold[1], 1.2, { lw: 0.6 }); g.orb(8, 25.5, 2, C.gold, { lw: 0.8 });
  g.line(56, 14, 56, 24, C.gold[1], 1.2, { lw: 0.6 }); g.orb(56, 25.5, 2, C.gold, { lw: 0.8 });
  g.spark(54, 40, 3, '#fff', '#fff0b0');
});

// ---------- gear (Ballistics / Siege Engineers / fallback)
def('gear', 'neutral', (g, m) => {
  const gold = m.acc === 'gold';
  g.glow(32, 32, 28, '#fff2d0', 0.25);
  const big = gearShape(27, 37, 21, 16.2, 10, 0.1);
  g.obj(big, gold ? C.gold : C.steelDk, { lw: 1.6, ang: 60 });
  g.obj(circ(27, 37, 9), gold ? C.goldDk : C.iron, { lw: 1.4, ang: 225, hi: 0.1 });
  g.obj(circ(27, 37, 4.2), '#241a12', { lw: 0, hi: 0, sh: 0 });
  const small = gearShape(47.5, 16, 11.5, 8.6, 8, 0.3);
  g.obj(small, gold ? C.gold : (m.metal === C.steel ? C.steel : m.metal), { lw: 1.5, ang: 60 });
  g.obj(circ(47.5, 16, 4.2), gold ? C.goldDk : C.iron, { lw: 1.1, ang: 225, hi: 0.1 });
  g.spark(14, 18, 3.2, '#fff', '#fff');
  if (gold) g.spark(53, 50, 3, '#fff', '#ffe27a');
}, { own: ['gold'] });
