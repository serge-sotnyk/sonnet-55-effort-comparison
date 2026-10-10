// Economy glyphs: cloth wheelbarrow cart eye collar plow crop axe saw pickaxe coin
import { mix, shade } from './common.js';
import { C, S, circ, ell, rr, poly, smooth, combo, n2, DEG } from './icons_kit.js';
import { def, nugget, stoneBlock, hatch, sparkles, wheatEar, drop, horseHeadShape, headPt } from './icons_parts.js';

const BURLAP = ['#f6e3ae', '#d6ab5e', '#8f6a2c'];

// ---------- cloth (Loom): woven plaid with a folded corner and a spool of thread
def('cloth', 'eco', (g, m) => {
  g.glow(32, 34, 28, '#ffffff', 0.18);
  g.rotated(30, 38, -6, () => {
    const cloth = S('M9 16 L53 13 L55 52 L11 55 Z');
    g.obj(cloth, ['#74a8f4', '#2f66cc', '#183a92'], { ang: 60, lw: 1.7 });
    g.clip(cloth, () => {
      for (let i = 0; i < 4; i++) {
        const x = 14 + i * 11;
        g.flat(rr(x, 8, 5.2, 52, 0), 'rgba(255,255,255,0.30)');
        g.flat(rr(x + 6.2, 8, 1.2, 52, 0), 'rgba(255,226,140,0.9)');
      }
      for (let j = 0; j < 3; j++) {
        const y = 21 + j * 12.5;
        g.flat(rr(4, y, 56, 4.6, 0), 'rgba(255,86,70,0.55)');
        g.flat(rr(4, y + 5.8, 56, 1.1, 0), 'rgba(255,226,140,0.8)');
      }
      hatch(g, 4, 8, 60, 60, 2.2, 45, 'rgba(0,0,40,0.08)', 0.5);
      hatch(g, 4, 8, 60, 60, 2.2, -45, 'rgba(255,255,255,0.07)', 0.5);
    });
    // fringe along the left edge
    for (let j = 0; j < 18; j++) { const L = 3.6 + (j % 3) * 0.9, yy = 17.8 + j * 2.1; g.line(9.2 + j * 0.065, yy, 9.2 + j * 0.065 - L, yy + 0.6 + (j % 2) * 0.6, j % 2 ? '#f6ead0' : '#e6d2ae', 0.8, { lw: 0 }); }
    // folded corner showing the back of the cloth
    g.obj(poly([[55, 52], [40, 53.6], [51.4, 39]]), ['#fffdf4', '#efe4c8', '#bfae86'], { lw: 1.3, ang: 200 });
    g.line(40, 53.6, 51.4, 39, 'rgba(60,40,20,0.35)', 1, { lw: 0 });
  });
  // spool of thread
  g.obj(ell(47, 25.5, 8.6, 3), C.woodDk, { lw: 1.2, hi: 0.2 });
  g.obj(rr(40.5, 9, 13, 16.5, 0.5), C.red, { lw: 1.3, ang: 0, hi: 0.4 });
  for (let i = 0; i < 5; i++) g.line(40.8, 11.4 + i * 3.2, 53.2, 11.4 + i * 3.2, 'rgba(70,6,6,0.35)', 0.8, { cap: 'butt' });
  g.obj(ell(47, 9, 8.6, 3), C.wood, { lw: 1.2, hi: 0.5 });
  g.stroke(S('M43 26 C40 33 34 30 31 36'), '#e24a3a', 1.1, { lw: 0.5 });
  g.spark(10, 14, 3.2, '#fff', '#ffffff');
});

// ---------- wheelbarrow (Wheelbarrow)
def('wheelbarrow', 'wood', (g, m) => {
  g.shadow(32, 57.5, 27, 3.2, 0.4);
  // load: two grain sacks
  const sack = (cx, cy, s) => {
    g.obj(S(`M${n2(cx - 7 * s)} ${n2(cy + 7 * s)}C${n2(cx - 9.5 * s)} ${n2(cy + 1 * s)} ${n2(cx - 5 * s)} ${n2(cy - 5 * s)} ${n2(cx - 2.2 * s)} ${n2(cy - 7 * s)}L${n2(cx - 2.8 * s)} ${n2(cy - 10 * s)}L${n2(cx + 2.8 * s)} ${n2(cy - 10 * s)}L${n2(cx + 2.2 * s)} ${n2(cy - 7 * s)}C${n2(cx + 5 * s)} ${n2(cy - 5 * s)} ${n2(cx + 9.5 * s)} ${n2(cy + 1 * s)} ${n2(cx + 7 * s)} ${n2(cy + 7 * s)}Q${n2(cx)} ${n2(cy + 9.5 * s)} ${n2(cx - 7 * s)} ${n2(cy + 7 * s)}Z`), BURLAP, { lw: 1.3, ang: 40 });
    g.line(cx - 3 * s, cy - 6.6 * s, cx + 3 * s, cy - 6.6 * s, '#5a3a14', 1.5 * s, { lw: 0 });
    g.line(cx - 2 * s, cy - 1 * s, cx + 1 * s, cy + 4 * s, 'rgba(110,70,20,0.35)', 0.9);
  };
  sack(24, 17, 1.0); sack(36.5, 15.5, 1.05);
  // tray
  const tray = S('M9 21 L43 21 L48 29.5 L41 38 L17 38 Q12 38 10.8 32.5 Z');
  g.tube(15, 33, 1.5, 27, 3.6, C.wood, { lw: 1.4 });          // handle
  g.tube(20, 37, 17.5, 55, 3.2, C.woodDk, { lw: 1.3 });       // leg
  g.obj(tray, C.wood, { lw: 1.6, ang: 60 });
  g.clip(tray, () => {
    for (let i = 1; i < 3; i++) g.line(8, 21 + i * 5.6, 50, 21 + i * 5.6, 'rgba(60,30,10,0.45)', 0.9, { cap: 'butt' });
    g.flat(rr(8, 20, 42, 2.6, 0), 'rgba(255,230,180,0.5)');
    g.flat(rr(21, 20, 3.2, 20, 0), C.iron[1]); g.flat(rr(34, 20, 3.2, 20, 0), C.iron[1]);
  });
  // wheel
  g.tube(40.5, 33, 46, 45, 2.8, C.iron, { lw: 1.2 });
  g.obj(circ(46, 45, 10), C.woodDk, { lw: 1.6, ang: 60, hi: 0.3 });
  g.obj(circ(46, 45, 6.6), ['#3a2512', '#241608', '#120a04'], { lw: 0.9, hi: 0, sh: 0 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; g.line(46, 45, 46 + Math.cos(a) * 8, 45 + Math.sin(a) * 8, C.wood[1], 1.5, { lw: 0.8 }); }
  g.orb(46, 45, 2.6, C.iron, { lw: 1 });
  g.spark(54, 9, 2.8, '#fff');
});

// ---------- cart (Hand Cart)
def('cart', 'wood', (g, m) => {
  g.shadow(32, 57.5, 29, 3.2, 0.4);
  // load: barrel + sacks
  g.obj(rr(36, 6, 15, 19, 4), C.wood, { lw: 1.5, ang: 30 });
  g.stroke(poly([[36.5, 11], [50.5, 11]], false), C.iron[1], 1.6); g.stroke(poly([[36.5, 20], [50.5, 20]], false), C.iron[1], 1.6);
  g.flat(rr(38.5, 7, 1.6, 16, 0.8), 'rgba(255,240,200,0.4)');
  const sack = (cx, cy, s) => g.obj(S(`M${n2(cx - 7 * s)} ${n2(cy + 7 * s)}C${n2(cx - 9.5 * s)} ${n2(cy + 1 * s)} ${n2(cx - 5 * s)} ${n2(cy - 5 * s)} ${n2(cx - 2.2 * s)} ${n2(cy - 7 * s)}L${n2(cx - 2.8 * s)} ${n2(cy - 10 * s)}L${n2(cx + 2.8 * s)} ${n2(cy - 10 * s)}L${n2(cx + 2.2 * s)} ${n2(cy - 7 * s)}C${n2(cx + 5 * s)} ${n2(cy - 5 * s)} ${n2(cx + 9.5 * s)} ${n2(cy + 1 * s)} ${n2(cx + 7 * s)} ${n2(cy + 7 * s)}Q${n2(cx)} ${n2(cy + 9.5 * s)} ${n2(cx - 7 * s)} ${n2(cy + 7 * s)}Z`), BURLAP, { lw: 1.3, ang: 40 });
  sack(20, 19, 1.0); sack(30, 15.5, 0.95);
  g.line(17.5, 12.6, 22.5, 12.6, '#5a3a14', 1.5, { lw: 0 }); g.line(27.5, 9.6, 32.5, 9.6, '#5a3a14', 1.4, { lw: 0 });
  // shafts
  g.tube(14, 33, 1.5, 53, 3.4, C.wood, { lw: 1.4 });
  g.tube(2.5, 50, 7, 53.5, 2.8, C.woodDk, { lw: 1.2 });
  // bed
  const bed = S('M10 25 L56 25 L53 40 L13 40 Z');
  g.obj(bed, C.wood, { lw: 1.6, ang: 70 });
  g.clip(bed, () => {
    for (let i = 1; i < 3; i++) g.line(8, 25 + i * 5, 58, 25 + i * 5, 'rgba(60,30,10,0.45)', 0.9, { cap: 'butt' });
    g.flat(rr(8, 24, 50, 2.6, 0), 'rgba(255,230,180,0.55)');
    for (const x of [18, 32, 46]) g.flat(rr(x, 24, 2.6, 18, 0), 'rgba(60,40,24,0.55)');
  });
  // wheel (big)
  g.obj(circ(33, 46, 12.5), C.woodDk, { lw: 1.7, ang: 60, hi: 0.3 });
  g.obj(circ(33, 46, 8.4), ['#3a2512', '#241608', '#120a04'], { lw: 0.9, hi: 0, sh: 0 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; g.line(33, 46, 33 + Math.cos(a) * 10.4, 46 + Math.sin(a) * 10.4, C.wood[1], 1.6, { lw: 0.8 }); }
  g.stroke(circ(33, 46, 11.6), C.iron[1], 1.1, { alpha: 0.9 });
  g.orb(33, 46, 3, C.iron, { lw: 1 });
  g.spark(55, 8, 2.8, '#fff');
});

// ---------- eye (Town Watch)
def('eye', 'vision', (g, m) => {
  const gold = m.acc === 'gold';
  g.glow(32, 33, 30, gold ? '#fff0a8' : '#d4f6ff', 0.4);
  // vision rays / lashes
  const rays = [[-90, 25, 32], [-66, 25, 31], [-114, 25, 31], [-44, 24, 29], [-136, 24, 29]];
  for (const [a, r0, r1] of rays) {
    const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG);
    g.line(32 + ca * r0 * 1.05, 33 + sa * r0 * 0.8, 32 + ca * r1 * 1.07, 33 + sa * r1 * 0.9, gold ? '#fff2b0' : '#e8fbff', 2.2, { lw: 0.8 });
  }
  const eye = S('M2 33 Q32 6 62 33 Q32 60 2 33 Z');
  g.obj(eye, ['#ffffff', '#f2ede0', '#b5ae9c'], { ang: 90, lw: 1.8 });
  g.clip(eye, () => {
    g.stroke(S('M2 33 Q32 6 62 33'), 'rgba(70,40,20,0.35)', 8, { cap: 'butt' });
    g.stroke(S('M2 33 Q32 60 62 33'), 'rgba(70,40,20,0.12)', 6, { cap: 'butt' });
    const irisPal = gold ? ['#fff4b0', '#eab43a', '#8a5412'] : m.acc === 'blood' ? ['#ffb4a4', '#d83a2c', '#6a1010'] : ['#bdf2ff', '#3098cc', '#124a82'];
    g.orb(32, 33, 13.5, irisPal, { lw: 1.4, spec: 0 });
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      g.line(32 + Math.cos(a) * 6.5, 33 + Math.sin(a) * 6.5, 32 + Math.cos(a) * 12.4, 33 + Math.sin(a) * 12.4, i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(0,20,60,0.30)', 0.8, { cap: 'butt' });
    }
    g.stroke(circ(32, 33, 12.8), 'rgba(0,10,40,0.55)', 1.5);
    g.orb(32, 33, 5.8, ['#4a4a4a', '#141414', '#000'], { lw: 0, spec: 0 });
    g.flat(ell(27.2, 27.6, 3.2, 2.4, -30), 'rgba(255,255,255,0.92)'); g.flat(circ(37, 38, 1.4), 'rgba(255,255,255,0.7)');
  });
  g.stroke(S('M2 33 Q32 6 62 33'), '#1d1209', 3.2, { cap: 'round' });
  g.stroke(S('M5 30.5 Q32 9.5 59 30.5'), 'rgba(255,255,255,0.28)', 1);
  sparkles(g, [[54, 14, 3.2]]);
}, { own: ['gold'] });

// ---------- collar (Horse Collar): a horse's head and neck wearing a padded leather collar with brass hames
def('collar', 'farm', (g, m) => {
  g.shadow(32, 59.5, 24, 3, 0.35);
  const sc = 0.54, ox = 8, oy = 2;
  const P = (x, y) => [x * sc + ox, y * sc + oy];
  const coll = { cx: 21.5, cy: 46, rx: 13, ry: 16.5, rot: -14 };
  // back half of the collar (behind the neck)
  g.stroke(ell(coll.cx, coll.cy, coll.rx, coll.ry, coll.rot), ['#8a5a30', '#4d2d12', '#2a170a'], 7.8, { lw: 1.5 });
  // horse head + neck
  g.at(ox, oy, sc, () => {
    g.obj(smooth([[44, 6], [34, 10], [22, 22], [12, 42], [6, 66], [3, 90], [8, 108], [40, 108], [44, 96], [40, 80], [38, 60]]), ['#6a4630', '#34210f', '#150c05'], { lw: 2, ang: 70, hi: 0.2 });
    const head = horseHeadShape();
    g.obj(head, ['#e9a766', '#b46d32', '#6b3a18'], { lw: 2.2, ang: 65 });
    g.obj(poly([[39, 13], [43, -5], [53, 15]]), ['#e9a766', '#b46d32', '#6b3a18'], { lw: 1.6, hi: 0.2 });
    g.flat(poly([[43, 10], [44.6, 1], [49.4, 13]]), 'rgba(255,150,140,0.6)');
    g.obj(smooth([[36, 10], [47, 12], [57, 23], [49, 27], [40, 18]]), ['#6a4630', '#34210f', '#150c05'], { lw: 1.4, hi: 0.2 });
    const eye = headPt(21, 4), nos = headPt(70, -1);
    g.obj(ell(eye[0], eye[1], 3.6, 3.1, 30), ['#4a3a30', '#150d08', '#000'], { lw: 1, hi: 0, sh: 0 });
    g.flat(circ(eye[0] - 1.2, eye[1] - 1.3, 1.1), '#fff');
    g.flat(ell(nos[0], nos[1], 1.2, 2.5, 25), '#1a0e08');
  });
  // front half of the collar over the neck: stroke the whole ring, clipped to the lower-front half
  g.stroke(ell(coll.cx, coll.cy, coll.rx, coll.ry, coll.rot), C.leather, 7.8, { lw: 1.6, ang: 50 });
  g.stroke(ell(coll.cx, coll.cy, coll.rx, coll.ry, coll.rot), 'rgba(255,226,166,0.85)', 1.1, { dash: [2.4, 1.8], lw: 0 });
  g.stroke(S('M11 40 Q13 31 21 28.5'), 'rgba(255,255,255,0.38)', 1.8, { lw: 0 });
  // hames: two brass-tipped wooden horns at the top of the collar
  g.stroke(S('M12 36 Q8 25 13 17'), C.wood, 3.4, { lw: 1.3 });
  g.stroke(S('M30 34 Q35 25 31 16'), C.woodDk, 3.4, { lw: 1.3 });
  g.orb(13, 16, 3.1, C.brass, { lw: 1.1 }); g.orb(31, 15, 3.1, C.brass, { lw: 1.1 });
  g.orb(11, 56, 2.6, C.iron, { lw: 1 });
  sparkles(g, [[55, 52, 3], [8, 10, 2.4]]);
}, { own: ['gold'] });

// ---------- plow (Heavy Plow)
def('plow', 'farm', (g, m) => {
  const soil = S('M0 52 Q9 45 19 49 T36 48 T52 46 T64 50 V64 H0 Z', [0, 45, 64, 64]);
  // far handle + near handle with grip bar
  g.tube(43, 44, 59, 12, 3.8, C.woodDk, { lw: 1.4 });
  g.tube(38, 46, 54, 17, 4.2, C.woodLt, { lw: 1.5 });
  g.tube(51.5, 15, 58, 19, 3.4, C.woodLt, { lw: 1.2 });
  // beam
  g.tube(4, 20, 40, 42, 5.2, C.wood, { lw: 1.6 });
  g.stroke(circ(4.5, 20, 3.6), C.steelBr, 2, { lw: 1 });
  // brace
  g.tube(30, 36, 46, 30, 2.8, C.woodDk, { lw: 1.2 });
  // mouldboard (curved wooden plate) behind the share
  g.obj(S('M38 44 C47 34 58 36 59 46 C55 53 48 55 41 55 Z'), C.wood, { lw: 1.6, ang: 40 });
  g.line(44, 45, 55, 42, 'rgba(60,30,10,0.45)', 1.1);
  // coulter
  g.obj(poly([[23.5, 29], [28.5, 30.5], [32, 51], [27.5, 52.5]]), C.steel, { lw: 1.3, ang: 20 });
  // share
  g.obj(poly([[10, 54], [32, 45.5], [46, 48], [46, 55], [30, 57]]), m.metal === C.steel ? C.steelBr : m.metal, { lw: 1.5, ang: 60 });
  g.line(14, 53.6, 31, 47.6, 'rgba(255,255,255,0.85)', 1.2, { lw: 0 });
  // soil
  g.obj(soil, ['#a8774a', '#6d4726', '#2e1c0c'], { lw: 1.5, ang: 90, hi: 0.35 });
  g.clip(soil, () => {
    g.stroke(S('M3 58 Q14 54 26 58 T50 57'), 'rgba(30,15,5,0.5)', 1.3, { lw: 0 });
    g.stroke(S('M8 62 Q20 59 32 62 T58 61'), 'rgba(30,15,5,0.45)', 1.2, { lw: 0 });
    g.stroke(S('M0 52 Q9 45 19 49 T36 48'), 'rgba(255,220,160,0.35)', 1.2, { lw: 0 });
  });
  g.obj(smooth([[44, 51], [49, 45.5], [57, 45], [61, 49.5], [56, 53], [47, 53.5]]), ['#a8774a', '#6a4524', '#3a2410'], { lw: 1.3, hi: 0.4 });
  sparkles(g, [[10, 11, 3.2]]);
});

// ---------- crop (Crop Rotation): wheat sheaf inside a ring of rotating arrows
def('crop', 'farm', (g, m) => {
  g.glow(32, 32, 30, '#f4ff9a', 0.35);
  const cx = 32, cy = 33, r = 26;
  const arc = (a0, a1) => {
    const p0 = [cx + Math.cos(a0 * DEG) * r, cy + Math.sin(a0 * DEG) * r], p1 = [cx + Math.cos(a1 * DEG) * r, cy + Math.sin(a1 * DEG) * r];
    return S(`M${n2(p0[0])} ${n2(p0[1])}A${r} ${r} 0 0 1 ${n2(p1[0])} ${n2(p1[1])}`, [cx - r, cy - r, cx + r, cy + r]);
  };
  const head = a => {
    const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG), tx = -sa, ty = ca, px = cx + ca * r, py = cy + sa * r;
    return poly([[px + tx * 8.5, py + ty * 8.5], [px + ca * 7.2, py + sa * 7.2], [px - ca * 7.2, py - sa * 7.2]]);
  };
  const ringPal = ['#f4ffc8', '#b4e260', '#5a9a30'];
  g.stroke(arc(-170, -52), ringPal, 5, { lw: 1.4 }); g.obj(head(-48), ringPal, { lw: 1.4, hi: 0.4 });
  g.stroke(arc(10, 128), ringPal, 5, { lw: 1.4 }); g.obj(head(132), ringPal, { lw: 1.4, hi: 0.4 });
  // sheaf: three big ears on thick stalks
  const ears = [[-22, 33], [22, 33], [0, 39]];
  for (const [a, L] of ears) g.rotated(32, 56, a, () => g.stroke(poly([[32, 56], [32, 56 - L]], false), '#8aa83a', 2.6, { lw: 1 }));
  for (const [a, L] of ears) g.rotated(32, 56, a, () => {
    const ey = 56 - L;
    for (let i = 0; i < 5; i++) {
      const yy = ey + 2 - i * 3.6;
      g.obj(ell(32 - 2.9, yy, 3.4, 1.9, -38), C.gold, { lw: 0.9, hi: 0.3, sh: 0.15 });
      g.obj(ell(32 + 2.9, yy, 3.4, 1.9, 38), C.gold, { lw: 0.9, hi: 0.3, sh: 0.15 });
    }
    g.obj(ell(32, ey - 17, 1.9, 3.4), C.gold, { lw: 0.9, hi: 0.3, sh: 0.15 });
    for (const d of [-1, 0, 1]) g.line(32 + d * 1.2, ey - 18, 32 + d * 4.2, ey - 27, 'rgba(244,206,106,0.95)', 0.9, { lw: 0 });
  });
  g.obj(S('M24 48 Q32 52 40 48 L41 53.6 Q32 57.6 23 53.6 Z'), C.red, { lw: 1.3, hi: 0.4 });
  sparkles(g, [[54, 12, 3.4], [11, 54, 2.6]]);
});

// ---------- axe (Double-Bit Axe)
def('axe', 'wood', (g, m) => {
  for (const [x, y] of [[50, 52], [56, 44], [43, 57], [57, 55]]) g.obj(poly([[x - 3, y], [x, y - 1.6], [x + 3, y + 0.4], [x, y + 1.8]]), C.woodLt, { lw: 0.9, hi: 0.3 });
  g.rotated(32, 32, 36, () => {
    g.tube(32, 12, 32, 64, 5.4, C.wood, { lw: 1.5 });
    g.obj(S('M30 17 L18.5 11 Q13.5 9.6 12 12 Q8.6 20 12 28.6 Q13.5 31 18.5 30 L30 24 Z'), m.metal, { ang: 70 });
    g.obj(S('M34 17 L45.5 11 Q50.5 9.6 52 12 Q55.4 20 52 28.6 Q50.5 31 45.5 30 L34 24 Z'), m.metal, { ang: 70 });
    g.line(14.4, 13.4, 12.4, 19.5, 'rgba(255,255,255,0.9)', 1.1); g.line(12.8, 22, 13.6, 27, 'rgba(255,255,255,0.7)', 1);
    g.obj(rr(28.4, 13, 7.2, 14, 1.6), C.iron, { lw: 1.2 });
    g.flat(rr(29.4, 14, 1.6, 12, 0.8), 'rgba(255,255,255,0.35)');
  });
  g.spark(13, 13, 3.2, '#fff', '#ffffff');
});

// ---------- saw (Bow Saw / Two-Man Saw)
def('saw', 'wood', (g, m) => {
  const gold = m.acc === 'gold';
  g.shadow(32, 58, 27, 3, 0.35);
  // log being cut
  g.obj(rr(5, 46, 48, 13, 3), C.woodDk, { lw: 1.6, ang: 90 });
  g.clip(rr(5, 46, 48, 13, 3), () => {
    for (let i = 0; i < 6; i++) g.line(6, 48.6 + i * 2.2, 52, 48.4 + i * 2.2 + (i % 2) * 0.5, 'rgba(50,25,8,0.30)', 0.8, { cap: 'butt' });
  });
  g.obj(ell(53, 52.5, 4.6, 6.5), C.woodLt, { lw: 1.4, hi: 0.4 });
  g.stroke(ell(53, 52.5, 2.4, 3.5), 'rgba(110,60,20,0.6)', 0.8, { lw: 0 });
  for (const [x, y] of [[20, 52], [33, 54], [28, 50.5], [41, 53]]) g.flat(ell(x, y, 1.5, 0.8, 20), '#fff0c8');
  if (!gold) {
    // hand saw: big toothed blade with a wooden D-handle
    g.rotated(32, 34, -14, () => {
      const pts = [[16, 24], [60, 24], [60, 31]];
      for (let x = 59; x > 18; x -= 3.6) { pts.push([x - 0.4, 38.8]); pts.push([x - 1.8, 32.2]); }
      pts.push([16, 32]);
      g.obj(poly(pts), C.steelBr, { lw: 1.4, ang: 90 });
      g.flat(rr(18, 25, 40, 1.5, 0.6), 'rgba(255,255,255,0.8)');
      g.flat(rr(18, 28, 40, 1.0, 0.5), 'rgba(40,60,100,0.18)');
      const handle = combo(S('M2 21 Q2 15 9 15 L19 15 L19 38 L9 38 Q2 38 2 32 Z'), ell(10.5, 25, 3.6, 5.4));
      g.obj(handle, C.wood, { lw: 1.6, ang: 60, rule: 'evenodd' });
      g.orb(16, 18, 1.2, C.iron, { lw: 0.4 }); g.orb(16, 34, 1.2, C.iron, { lw: 0.4 });
    });
  } else {
    // two-man saw: a long golden blade with a handle at each end
    g.rotated(32, 38, -12, () => {
      const pts = [[2, 32], [62, 32], [62, 38]];
      for (let x = 61; x > 4; x -= 3.4) { pts.push([x - 0.4, 44.4]); pts.push([x - 1.7, 38.4]); }
      pts.push([2, 38]);
      g.obj(poly(pts), C.gold, { lw: 1.3, ang: 90 });
      g.flat(rr(5, 32.8, 54, 1.4, 0.6), 'rgba(255,255,255,0.75)');
      g.tube(4, 22, 4, 38, 5.6, C.woodDk, { lw: 1.4 }); g.tube(60, 22, 60, 38, 5.6, C.woodDk, { lw: 1.4 });
      g.orb(4, 21, 3, C.brass, { lw: 0.9 }); g.orb(60, 21, 3, C.brass, { lw: 0.9 });
    });
    sparkles(g, [[52, 10, 3.8], [12, 14, 2.8]]);
  }
}, { own: ['gold'] });

// ---------- pickaxe
def('pickaxe', 'mine', (g, m) => {
  g.rotated(32, 32, 38, () => {
    g.tube(32, 12, 32, 64, 5.4, C.wood, { lw: 1.5 });
    g.obj(S('M3 26 C8 11 20 5 32 5 C44 5 56 11 61 26 C53 18 45 15.5 37 17 L27 17 C19 15.5 11 18 3 26 Z'), m.metal, { ang: 80, lw: 1.6 });
    g.line(8, 21, 17, 12, 'rgba(255,255,255,0.8)', 1.3);
    g.obj(rr(26, 10, 12, 11, 2.4), C.iron, { lw: 1.3 });
    g.flat(rr(27.2, 11.2, 2, 8.6, 1), 'rgba(255,255,255,0.3)');
    g.obj(rr(29.4, 57, 5.2, 4.5, 1.2), C.iron, { lw: 0.8, hi: 0.2 });
  });
  if (m.acc === 'gold') { g.glow(47, 49, 14, '#ffe27a', 0.5); nugget(g, 52, 53, 4.6); nugget(g, 43.5, 55.5, 3.5); nugget(g, 49, 46.5, 3.8); g.spark(56, 40, 3.4, '#fff', '#ffe27a'); }
  else if (m.acc === 'stone') { stoneBlock(g, 50, 50, 7); stoneBlock(g, 40.5, 56, 4.4, C.stoneDk); }
}, { own: ['gold', 'stone'] });

// ---------- coin (Coinage / Banking)
def('coin', 'trade', (g, m) => {
  const gold = m.acc === 'gold';
  g.glow(32, 32, 28, '#fff2a8', 0.3);
  g.orb(45, 19, 11.5, C.goldDk, { lw: 1.4 });
  g.stroke(circ(45, 19, 8.2), 'rgba(80,42,6,0.5)', 1.1);
  const n = gold ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const y = 59 - i * 4.4, x = 46;
    g.obj(S(`M${x - 11.5} ${y}A11.5 4.4 0 0 0 ${x + 11.5} ${y}V${y - 3.6}A11.5 4.4 0 0 0 ${x - 11.5} ${y - 3.6}Z`, [x - 11.5, y - 8, x + 11.5, y + 4.4]), C.goldDk, { lw: 1.1, hi: 0.2 });
    g.obj(ell(x, y - 3.6, 11.5, 4.4), C.gold, { lw: 1.1, hi: 0.4 });
  }
  g.obj(circ(26, 36, 18.5), C.gold, { lw: 1.8 });
  g.orb(26, 36, 14.6, [C.gold[1], C.gold[1], C.goldDk[1]], { lw: 1.1, spec: 0 });
  g.stroke(circ(26, 36, 12.6), 'rgba(255,245,170,0.8)', 1.1);
  g.obj(poly([[17.5, 43], [16.5, 29.5], [21.8, 35], [26, 27], [30.2, 35], [35.5, 29.5], [34.5, 43]]), C.gold, { lw: 1.1, ang: 30 });
  g.flat(rr(17.5, 40.5, 17, 3, 1), 'rgba(110,60,8,0.5)');
  g.orb(26, 27.3, 1.7, C.ruby, { lw: 0.5, spec: 0 });
  sparkles(g, [[10, 16, 3.8], [55, 38, 2.8]]);
}, { own: ['gold'] });
