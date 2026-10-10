// Original heraldry for the four civilizations, drawn in a 128x128 design space with the icon Pen.
// Used by menu.js (getCivEmblem, large transparent emblems) and icons_emblems.js ('civ:<id>' 48 px icons).
//   britons: golden lion rampant on red, crossed longbows, crown     franks: golden fleurs-de-lis on azure, great helm, crossed lances
//   goths: round wolf-head shield ringed with runes, crossed axes    mongols: white horse before a golden sun on a blue medallion, horsetail standards
import { C, S, circ, ell, rr, poly, smooth, combo, n2, DEG } from './icons_kit.js';
import { drawHorseHead } from './icons_parts.js';

const INKC = '#1d1209';

/** tapered capsule between two points as a shape (union of two circles and a hull), CCW winding */
export function capsule(x0, y0, x1, y1, r0, r1 = r0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
  const sn = Math.max(-0.98, Math.min(0.98, (r0 - r1) / L)), cs = Math.sqrt(1 - sn * sn);
  const ux = nx * cs + tx * sn, uy = ny * cs + ty * sn;
  const vx = -nx * cs + tx * sn, vy = -ny * cs + ty * sn;
  let pts = [[x0 + ux * r0, y0 + uy * r0], [x1 + ux * r1, y1 + uy * r1], [x1 + vx * r1, y1 + vy * r1], [x0 + vx * r0, y0 + vy * r0]];
  let a = 0; for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4]; a += p[0] * q[1] - q[0] * p[1]; }
  if (a > 0) pts = pts.reverse();
  return combo(poly(pts), circ(x0, y0, r0), circ(x1, y1, r1));
}
function mirrorPts(pts, cx) { return pts.map(([x, y]) => [2 * cx - x, y]); }
/** draw fn mirrored about x = 64 (keeps lighting roughly right for symmetric supporters) */
function mirrorDraw(g, fn) { const c = g.c; c.save(); c.translate(128, 0); c.scale(-1, 1); fn(); c.restore(); }

const GOLDG = ['#fff6c0', '#f6cf48', '#b87a1a'];
const GOLDB = ['#fff0a8', '#e2ae34', '#8a5a14'];

// ------------------------------------------------------------------ shared figures
/** Heater shield in 128 space, optionally inset */
function heater(inset = 0) {
  const i = inset;
  return S(`M${18 + i} ${24 + i * 0.6}Q64 ${36 + i * 0.2} ${110 - i} ${24 + i * 0.6}L${110 - i} 68Q${110 - i} ${102 - i * 0.6} 64 ${122 - i}Q${18 + i} ${102 - i * 0.6} ${18 + i} 68Z`);
}
function shieldBody(g, fieldPal, d, lite) {
  g.obj(heater(0), GOLDB, { lw: 2, ang: 50 });
  g.obj(heater(7), fieldPal, { lw: 1.4, ang: 60, hi: 0.3 });
  g.clip(heater(7), () => {
    g.flat(poly([[25, 30], [64, 40], [25, 80]]), 'rgba(255,255,255,0.10)');
    g.flat(poly([[103, 30], [103, 70], [64, 116], [84, 60]]), 'rgba(20,0,20,0.22)');
    if (lite) lite();
  });
}
/** Crown, bottom centre (x,y), width w */
function crown(g, x, y, w) {
  const h = w * 0.72, l = x - w / 2, r = x + w / 2;
  g.obj(poly([[l, y], [l - 1, y - h * 0.55], [l + w * 0.2, y - h * 0.3], [l + w * 0.34, y - h], [x, y - h * 0.38], [r - w * 0.34, y - h], [r - w * 0.2, y - h * 0.3], [r + 1, y - h * 0.55], [r, y]]), C.gold, { lw: 1.4, ang: 60 });
  g.obj(rr(l, y - h * 0.22, w, h * 0.22, 1), C.goldDk, { lw: 1.1, hi: 0.4 });
  for (const [px, py] of [[l + w * 0.34, y - h], [r - w * 0.34, y - h], [x, y - h * 0.4]]) g.orb(px, py, w * 0.065, C.ruby, { lw: 0.8 });
  g.orb(l - 1, y - h * 0.58, w * 0.05, C.gem, { lw: 0.7 }); g.orb(r + 1, y - h * 0.58, w * 0.05, C.gem, { lw: 0.7 });
}

/** a supporter item (drawn vertical in a 128 frame centred (64,64), top near y=-8, bottom near y=136) rotated about the shield centre */
function crossed(g, ang, cy, fn, fnMirror) {
  g.rotated(64, cy, ang, () => fn());
  g.rotated(64, cy, -ang, () => mirrorDraw(g, fnMirror || fn));
}

function longbow(g) {
  g.stroke(S('M64 -10 Q28 64 64 138'), C.wood, 6.4, { lw: 1.5, ang: 0 });
  g.stroke(S('M62.4 -2 Q33 64 62.4 130'), 'rgba(255,235,200,0.45)', 1.3, { lw: 0 });
  g.obj(circ(64, -10, 3.6), C.gold, { lw: 1.1 }); g.obj(circ(64, 138, 3.6), C.gold, { lw: 1.1 });
  g.stroke(poly([[64, -9], [64, 137]], false), '#f4eedc', 1.3, { lw: 0.6 });
  g.obj(rr(59, 54, 8, 24, 3), C.leather, { lw: 1.2, ang: 0 });
  // arrow nocked on the string
  g.obj(poly([[63, 60], [95, 60], [95, 63.2], [63, 63.2]]), C.woodLt, { lw: 0.9, hi: 0.4 });
}
function lance(g, pennant) {
  g.tube(64, 4, 64, 140, 4.4, C.woodDk, { lw: 1.3 });
  g.obj(poly([[64, -12], [69, 8], [64, 5], [59, 8]]), C.steelBr, { lw: 1.2 });
  g.obj(rr(60.6, 6, 6.8, 4, 1.4), C.gold, { lw: 0.9 });
  if (pennant) g.obj(S('M66 12 L96 17 L88 23 L96 29 L66 34 Z'), pennant, { lw: 1.3, ang: 30 });
}

// ------------------------------------------------------------------ Britons: gold lion rampant on red
/** lion rampant facing left in a local 100x120 box */
function lionRampant(g, d, pal = ['#ffee96', '#f2bc3a', '#a8641a']) {
  const lw = 1.6, c = g.c;
  const body = [
    circ(40, 50, 14.5), capsule(46, 60, 56, 72, 8.4, 10), circ(60, 78, 13), capsule(30, 33, 40, 48, 11, 14),
    capsule(33, 52, 20, 57, 7, 5.4), capsule(20, 57, 9.5, 43.5, 5.4, 4.4), circ(7.8, 40.8, 5.2),
    capsule(38, 60, 30, 72, 6.4, 5), capsule(30, 72, 16.5, 73, 5, 4.2), circ(13.8, 73, 5),
    capsule(62, 78, 53, 95, 10.5, 7), capsule(53, 95, 60, 110, 7, 4.8), capsule(60, 112.4, 45, 113.8, 4.8, 4.4),
    capsule(58, 86, 43, 95, 8, 5.6), capsule(43, 95, 31, 97.2, 5.6, 4.4), circ(28.4, 97.2, 5),
    capsule(68, 75, 84, 65, 4.2, 3.4), capsule(84, 65, 89.5, 46, 3.4, 3), capsule(89.5, 46, 80, 30, 3, 2.8),
  ];
  const head = [circ(23, 27, 12.5), capsule(19, 29, 8, 28, 6.6, 5.2), capsule(17.4, 38, 9.4, 42.6, 4.2, 3.2)];
  const mane = poly((() => {
    const pts = [], cx = 28, cy = 29, n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, front = Math.cos(a) < -0.5 ? 0.62 : 1, big = (i % 2 ? 19 : 25) * front;
      pts.push([cx + Math.cos(a) * big, cy + Math.sin(a) * big * 1.05]);
    }
    return pts;
  })());
  const tuft = smooth([[78, 31], [71, 23], [74, 12], [83, 16], [89, 24], [86, 34]]);
  const all = combo(...body, ...head, mane, tuft);
  // unified silhouette: outline + gradient + inner bevel highlights
  g.objU(all, pal, { lw, ang: 62, hi: 0.55, sh: 0.34, bev: 1.2 });
  g.clip(all, () => {
    const mg = c.createLinearGradient(8, 4, 48, 52);
    mg.addColorStop(0, '#ffcb58'); mg.addColorStop(0.5, '#e08a1e'); mg.addColorStop(1, '#8e4a0c');
    c.fillStyle = mg; c.fill(mane.p);
    c.save(); c.clip(mane.p);
    c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,236,170,0.55)'; c.lineWidth = 1.8; c.translate(1.1, 1.1); c.stroke(mane.p); c.restore();
    g.stroke(mane, 'rgba(70,30,0,0.6)', 1.1, { lw: 0 });
    for (const [x0, y0, x1, y1] of [[22, 8, 22, 15], [30, 6, 34, 14], [38, 10, 40, 19], [44, 18, 42, 26], [46, 28, 40, 34], [44, 38, 38, 42], [36, 44, 32, 48], [10, 14, 14, 20], [8, 38, 13, 36]]) g.stroke(poly([[x0, y0], [x1, y1]], false), 'rgba(110,50,0,0.55)', 1.2, { lw: 0 });
    // face
    const fg = c.createRadialGradient(18, 22, 1, 22, 28, 13); fg.addColorStop(0, '#fff6b8'); fg.addColorStop(1, '#f2b838');
    c.fillStyle = fg; c.beginPath(); c.arc(22.5, 27.5, 10.6, 0, 7); c.fill();
    // limb separation lines + belly shade
    g.stroke(S('M35 55 Q45 62 49 73'), 'rgba(110,56,6,0.6)', 1.3, { lw: 0 });
    g.stroke(S('M53 82 Q61 86 63 97'), 'rgba(110,56,6,0.6)', 1.3, { lw: 0 });
    g.stroke(S('M43 62 Q54 74 59 88'), 'rgba(110,56,6,0.3)', 3, { lw: 0 });
    g.stroke(S('M30 54 Q22 60 20 58'), 'rgba(110,56,6,0.5)', 1.1, { lw: 0 });
    g.stroke(S('M36 62 Q31 68 30 72'), 'rgba(110,56,6,0.5)', 1.1, { lw: 0 });
    g.stroke(S('M70 76 Q80 68 86 64'), 'rgba(110,56,6,0.35)', 1.6, { lw: 0 });
  });
  // face details
  g.flat(poly([[8.6, 28.4], [19, 29.4], [20.4, 33], [13, 33.6], [9.4, 31]]), '#7a1410');
  g.flat(poly([[9.6, 28.8], [11.4, 31.6], [13.2, 29.2]]), '#ffffff'); g.flat(poly([[14.4, 29.6], [16, 32.2], [17.6, 29.8]]), '#ffffff');
  g.obj(smooth([[10.6, 32], [18, 32.4], [16.6, 37], [11, 36]]), ['#ff9a86', '#e0382c', '#8a1410'], { lw: 0.9, hi: 0.3 });
  g.obj(poly([[2.8, 23.4], [8.2, 21.8], [9, 26.4], [3.8, 27.4]]), '#1d1209', { lw: 0.5, hi: 0, sh: 0 });
  g.flat(poly([[16.4, 21], [22.4, 23.4], [22, 26], [16, 24]]), '#2a1a08');
  g.flat(circ(19.4, 23.6, 1.1), '#ffe9a0');
  g.stroke(poly([[13.4, 17.4], [22, 21.4], [26.4, 19.2]], false), 'rgba(80,36,0,0.8)', 1.8, { lw: 0 });
  g.obj(smooth([[26, 14], [31.6, 10], [33.4, 17], [28.6, 20]]), pal, { lw: 1, hi: 0.4 });
  for (const [x, y, a] of [[4, 37.6, -25], [7, 35.4, 5], [10.6, 37.2, 30], [10, 72, 150], [13, 70.2, 180], [16.4, 71.6, -150], [24.6, 95.6, 150], [27.6, 94.2, 180], [31, 95.6, -150], [43, 116, 160]]) {
    g.rotated(x, y, a, () => g.obj(poly([[x - 1.2, y], [x, y - 4.6], [x + 1.2, y]]), '#fffaf0', { lw: 0.5, hi: 0, sh: 0 }));
  }
  for (const [x0, y0, x1, y1] of [[79, 28, 74, 19], [81.4, 27, 80, 16], [84, 30, 88.6, 22]]) g.stroke(poly([[x0, y0], [x1, y1]], false), 'rgba(120,60,6,0.6)', 1.1, { lw: 0 });
}
function drawBritons(g, d) {
  g.shadow(64, 124, 44, 4, 0.35);
  crossed(g, 44, 70, () => longbow(g));
  g.at(64 - 64 * 0.84, 72 - 72 * 0.84 + 2, 0.84, () => {
    shieldBody(g, ['#f0705a', '#c02a2a', '#6a1010'], d);
    g.at(29, 33, 0.70, () => lionRampant(g, d));
    if (d) for (const [x, y] of [[27, 40], [101, 40], [64, 33]]) g.orb(x, y, 1.8, C.gold, { lw: 0.6 });
  });
  crown(g, 64, 28, 30);
}

// ------------------------------------------------------------------ Franks: fleurs-de-lis
function fleur(g, x, y, s) {
  g.at(x - 50 * s, y - 60 * s, s, () => {
    const petalR = S('M60 68 C62 54 74 40 88 41 C100 42 105 55 99 65 C94 74 82 76 76 70 C83 70 88 65 85 58 C82 52 72 53 68 60 C65 65 65 69 66 72 Z');
    const petalL = S('M40 68 C38 54 26 40 12 41 C0 42 -5 55 1 65 C6 74 18 76 24 70 C17 70 12 65 15 58 C18 52 28 53 32 60 C35 65 35 69 34 72 Z');
    const center = S('M50 3 C59 15 63 30 59 46 C57 55 55 61 55 69 L45 69 C45 61 43 55 41 46 C37 30 41 15 50 3 Z');
    const tail = S('M38 84 L62 84 C60 95 55 104 50 114 C45 104 40 95 38 84 Z');
    g.obj(petalL, GOLDG, { lw: 2.2, ang: 40 }); g.obj(petalR, GOLDG, { lw: 2.2, ang: 40 });
    g.obj(tail, GOLDG, { lw: 2.2, ang: 40 });
    g.obj(center, GOLDG, { lw: 2.2, ang: 40 });
    g.obj(rr(31, 71, 38, 12, 3), ['#fff0a0', '#e8b83a', '#8a5a14'], { lw: 2, ang: 60 });
    g.stroke(poly([[50, 12], [50, 62]], false), 'rgba(120,70,10,0.35)', 1.6, { lw: 0 });
  });
}
function greatHelm(g, x, y, s) {
  g.at(x - 32 * s, y - 32 * s, s, () => {
    g.obj(smooth([[32, 6], [24, -4], [12, -2], [2, 8], [10, 8], [4, 18], [14, 14], [12, 24], [24, 18]]), ['#ffffff', '#eee8da', '#a8a090'], { lw: 1.4, ang: 60 });
    g.obj(smooth([[32, 6], [30, -8], [40, -12], [50, -4], [44, -2], [52, 6], [42, 6], [44, 14], [36, 12]]), ['#ff8a76', '#d9382c', '#7a1410'], { lw: 1.4, ang: 60 });
    const helm = S('M12 20 Q12 6 32 6 Q52 6 52 20 L52 50 Q52 60 44 62 L20 62 Q12 60 12 50 Z');
    g.obj(helm, C.steel, { lw: 1.8, ang: 10 });
    g.clip(helm, () => {
      g.flat(rr(12, 6, 11, 58, 0), 'rgba(255,255,255,0.28)'); g.flat(rr(42, 6, 10, 58, 0), 'rgba(20,30,60,0.30)');
      g.flat(rr(12, 26, 40, 5, 0), '#1d1209');
      g.flat(rr(30.4, 8, 3.2, 54, 0), 'rgba(30,45,80,0.35)');
      g.flat(rr(12, 20, 40, 1.4, 0), 'rgba(255,255,255,0.5)');
    });
    g.stroke(poly([[12, 38], [52, 38]], false), 'rgba(30,45,80,0.45)', 1.2, { lw: 0 });
    for (const [px, py] of [[24, 44], [24, 49], [24, 54], [40, 44], [40, 49], [40, 54]]) g.flat(circ(px, py, 1.1), '#1d1209');
    g.orb(32, 14, 3, C.gold, { lw: 0.8 });
  });
}
function drawFranks(g, d) {
  g.shadow(64, 124, 44, 4, 0.35);
  crossed(g, 44, 70, () => lance(g, ['#ff9a86', '#d9382c', '#7a1410']), () => lance(g, ['#ffffff', '#ece6d6', '#a8a090']));
  g.at(64 - 64 * 0.84, 72 - 72 * 0.84 + 2, 0.84, () => {
    shieldBody(g, ['#6a9cf0', '#2a50b8', '#102060'], d, d ? () => { for (const [x, y] of [[38, 47], [90, 47], [64, 38], [44, 90], [84, 90]]) fleur(g, x, y, 0.2); } : null);
    fleur(g, 64, 74, d ? 0.46 : 0.52);
  });
  greatHelm(g, 64, 21, 0.5);
}

// ------------------------------------------------------------------ Goths: wolf shield
function wolfHead(g, x, y, s) {
  g.at(x - 50 * s, y - 52 * s, s, () => {
    const silver = ['#ffffff', '#c8d0dc', '#5c6678'];
    for (const m of [false, true]) {
      const P = pts => m ? mirrorPts(pts, 50) : pts;
      g.obj(poly(P([[16, 6], [36, 26], [14, 44]])), silver, { lw: 2, ang: 60 });
      g.flat(poly(P([[19, 16], [32, 28], [18, 36]])), '#3a4254');
    }
    const faceL = [[50, 20], [34, 24], [24, 31], [12, 38], [20, 45], [7, 56], [22, 59], [15, 72], [31, 73], [39, 87], [50, 97]];
    const face = poly([...faceL, ...mirrorPts(faceL.slice(1, -1), 50).reverse()]);
    g.obj(face, silver, { lw: 2.2, ang: 60 });
    g.clip(face, () => {
      g.flat(poly([[50, 20], [34, 24], [24, 31], [30, 48], [44, 56], [50, 40]]), 'rgba(255,255,255,0.25)');
      g.flat(poly([[50, 20], [66, 24], [76, 31], [70, 48], [56, 56], [50, 40]]), 'rgba(0,0,30,0.10)');
      g.flat(poly([[40, 58], [50, 52], [60, 58], [61, 78], [50, 97], [39, 78]]), ['#ffffff', '#eef2f8', '#b0b8c8']);
      g.stroke(poly([[50, 20], [50, 52]], false), 'rgba(40,50,70,0.35)', 1.6, { lw: 0 });
      for (const [x0, y0, x1, y1] of [[26, 52, 36, 56], [22, 62, 34, 64], [74, 52, 64, 56], [78, 62, 66, 64], [30, 42, 40, 46], [70, 42, 60, 46]]) g.stroke(poly([[x0, y0], [x1, y1]], false), 'rgba(40,50,70,0.5)', 1.8, { lw: 0 });
    });
    for (const m of [false, true]) {
      const P = pts => m ? mirrorPts(pts, 50) : pts;
      g.obj(poly(P([[28, 40], [44, 46], [43, 52], [30, 49]])), ['#fff0a0', '#ffb020', '#c06a08'], { lw: 1.2, hi: 0.2 });
      g.flat(poly(P([[37, 43.4], [41, 45.4], [40.6, 49.6], [37.4, 48.4]])), '#1d1209');
      g.stroke(poly(P([[26, 36], [44, 43]]), false), '#2a3044', 2.2, { lw: 0 });
    }
    g.obj(poly([[42, 80], [58, 80], [50, 92]]), ['#6a7288', '#262c3a', '#0c0f16'], { lw: 1.4, hi: 0.2 });
    g.stroke(S('M50 92 L50 99'), '#2a3044', 1.6, { lw: 0 });
  });
}
function rune(g, cx, cy, size, kind, color) {
  const h = size / 2, P = a => a.map(([x, y]) => [cx + x * h, cy + y * h]);
  const lines = {
    f: [[[-0.3, -1], [-0.3, 1]], [[-0.3, -0.7], [0.6, -1]], [[-0.3, -0.1], [0.6, -0.4]]],
    u: [[[-0.5, -1], [-0.5, 1]], [[-0.5, -1], [0.5, -0.4], [0.5, 1]]],
    th: [[[-0.4, -1], [-0.4, 1]], [[-0.4, -0.6], [0.5, 0], [-0.4, 0.6]]],
    a: [[[-0.4, -1], [-0.4, 1]], [[-0.4, -0.8], [0.5, -0.3]], [[-0.4, -0.1], [0.5, 0.4]]],
    r: [[[-0.4, -1], [-0.4, 1]], [[-0.4, -1], [0.5, -0.5], [-0.4, 0]], [[-0.4, 0], [0.5, 1]]],
    k: [[[0.4, -0.8], [-0.4, 0], [0.4, 0.8]]],
    g: [[[-0.5, -0.9], [0.5, 0.9]], [[0.5, -0.9], [-0.5, 0.9]]],
    w: [[[-0.4, -1], [-0.4, 1]], [[-0.4, -1], [0.5, -0.5], [-0.4, 0]]],
    n: [[[0, -1], [0, 1]], [[-0.5, -0.3], [0.5, 0.3]]],
    i: [[[0, -1], [0, 1]]],
    s: [[[0.4, -1], [-0.3, -0.2], [0.3, 0.2], [-0.4, 1]]],
    t: [[[0, -1], [0, 1]], [[-0.5, -0.4], [0, -1], [0.5, -0.4]]],
    b: [[[-0.4, -1], [-0.4, 1]], [[-0.4, -1], [0.4, -0.5], [-0.4, 0], [0.5, 0.5], [-0.4, 1]]],
    m: [[[-0.5, -1], [-0.5, 1]], [[0.5, -1], [0.5, 1]], [[-0.5, -1], [0, -0.2], [0.5, -1]]],
    l: [[[0, -1], [0, 1]], [[0, -1], [0.5, -0.5]]],
    d: [[[-0.5, -1], [-0.5, 1], [0.5, -1], [0.5, 1], [-0.5, -1]]],
  };
  for (const ln of lines[kind] || lines.i) g.stroke(poly(P(ln), false), color, Math.max(1.4, size * 0.13), { lw: 0.6, cap: 'round' });
}
function axeBig(g) {
  g.tube(32, -30, 32, 98, 4.8, C.wood, { lw: 1.3 });
  g.obj(S('M30.5 -28 C21 -35 9 -35 2 -29 C6 -19 6 -7 11 6 C18 -1 25 -5 30.5 -6 Z'), C.steel, { lw: 1.5, ang: 70 });
  g.line(7, -26, 6.4, -12, 'rgba(255,255,255,0.85)', 1.3, { lw: 0 });
  g.obj(rr(29, -28, 6.4, 18, 1.4), C.iron, { lw: 1, hi: 0.3 });
  g.obj(rr(29.6, 90, 5, 6, 1), C.iron, { lw: 0.8, hi: 0.2 });
}
function drawGoths(g, d) {
  g.shadow(64, 124, 44, 4, 0.35);
  g.at(64 - 32, 66 - 34, 1, () => {
    g.rotated(32, 34, 44, () => axeBig(g));
    g.rotated(32, 34, -44, () => mirrorDraw2(g, 64, () => axeBig(g)));
  });
  g.obj(circ(64, 66, 45), ['#d8dee8', '#8a94a8', '#3a4458'], { lw: 2.2, ang: 60 });
  g.obj(circ(64, 66, 39), ['#6a8c8a', '#2f5a5c', '#0e2a30'], { lw: 1.6, ang: 60, hi: 0.3 });
  g.clip(circ(64, 66, 39), () => {
    for (let i = -4; i <= 4; i++) g.line(64 + i * 9, 24, 64 + i * 9, 108, 'rgba(0,15,20,0.30)', 1.1, { cap: 'butt' });
    g.flat(ell(48, 46, 28, 16, -35), 'rgba(255,255,255,0.10)');
    g.flat(ell(86, 94, 30, 20, -35), 'rgba(0,0,0,0.18)');
  });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.orb(64 + Math.cos(a) * 42, 66 + Math.sin(a) * 42, 2.1, C.steelBr, { lw: 0.6 }); }
  if (d) {
    const kinds = ['f', 'u', 'th', 'a', 'r', 'k', 'g', 'w', 'n', 'i', 's', 't', 'b', 'm', 'l', 'd'];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 - Math.PI / 2; rune(g, 64 + Math.cos(a) * 32.5, 66 + Math.sin(a) * 32.5, 7.6, kinds[i], '#f1c64a'); }
  }
  g.stroke(circ(64, 66, 28), 'rgba(241,198,74,0.8)', 1.5, { lw: 0.8 });
  wolfHead(g, 64, 66, 0.48);
}
function mirrorDraw2(g, cx, fn) { const c = g.c; c.save(); c.translate(cx, 0); c.scale(-1, 1); fn(); c.restore(); }

// ------------------------------------------------------------------ Mongols: horse before the sun
function horse(g, x, y, sc, pal, mane, bridle = C.leatherR) { drawHorseHead(g, x - 50 * sc, y - 52 * sc, sc, pal, mane, bridle); }
function sunRays(g, cx, cy, r0, r1, r2, n, pal) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.1, w = Math.PI / n * 0.55, r = i % 2 ? r2 : r1;
    g.obj(poly([[cx + Math.cos(a - w) * r0, cy + Math.sin(a - w) * r0], [cx + Math.cos(a) * r, cy + Math.sin(a) * r], [cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0]]), pal, { lw: 1.1, ang: 60, hi: 0.3, sh: 0.1 });
  }
}
function tug(g, ang, side) {
  // pole + head, rotated about the medallion centre
  g.rotated(64, 66, ang, () => {
    g.tube(64, 6, 64, 134, 3.8, C.woodDk, { lw: 1.2 });
    g.obj(poly([[64, -12], [68.6, 6], [64, 3], [59.4, 6]]), C.gold, { lw: 1.2 });
    g.obj(circ(64, 12, 6), C.gold, { lw: 1.3 });
    g.obj(S('M51 8 Q64 22 77 8 Q64 16 51 8 Z'), C.gold, { lw: 1.1 });
  });
  // horsetail skirt hangs straight down from the disc (world space)
  const a = ang * DEG, ex = 64 + Math.sin(a) * 54, ey = 66 - Math.cos(a) * 54;
  for (let i = -5; i <= 5; i++) {
    const x0 = ex + i * 2.2, x1 = ex + i * 5.6 + side * 2, col = i % 2 ? '#f4efe6' : '#2a2a38';
    g.stroke(S(`M${n2(x0)} ${n2(ey + 5)}Q${n2(x0 + i * 1.6)} ${n2(ey + 22)} ${n2(x1)} ${n2(ey + 40 + (5 - Math.abs(i)) * 1.4)}`), col, 3.2, { lw: 0.8 });
  }
}
function drawMongols(g, d) {
  g.shadow(64, 124, 44, 4, 0.35);
  tug(g, 40, 1); tug(g, -40, -1);
  g.obj(circ(64, 66, 45), GOLDB, { lw: 2.2, ang: 50 });
  g.obj(circ(64, 66, 39), ['#6ab0ff', '#2a62c8', '#0e2a70'], { lw: 1.6, ang: 70, hi: 0.3 });
  g.clip(circ(64, 66, 39), () => {
    g.flat(ell(50, 46, 28, 16, -35), 'rgba(255,255,255,0.12)');
    g.flat(ell(88, 94, 30, 20, -35), 'rgba(0,0,40,0.22)');
    if (d) for (let i = 0; i < 14; i++) { const a = i * 2.3, rr2 = 24 + (i % 4) * 4; g.spark(64 + Math.cos(a) * rr2 * 1.5, 66 + Math.sin(a) * rr2 * 1.5, 1.6, '#ffffff'); }
    g.glow(64, 58, 38, '#ffe27a', 0.5);
    sunRays(g, 64, 58, 17, 38, 29, 16, ['#fff4b0', '#f6c538', '#c07a14']);
    g.obj(circ(64, 58, 19), ['#fff8c8', '#ffe070', '#e0a020'], { lw: 1.6, ang: 60 });
    g.stroke(circ(64, 58, 13), 'rgba(160,90,10,0.45)', 1.4, { lw: 0 });
    horse(g, 66, 74, 0.7, ['#ffffff', '#efe9dc', '#aaa292'], ['#6a6670', '#2c2a34', '#0c0b12'], C.leatherR);
  });
  g.stroke(circ(64, 66, 39), 'rgba(20,10,0,0.7)', 1.4, { lw: 0 });
}

// ------------------------------------------------------------------ public
const DRAW = { britons: drawBritons, franks: drawFranks, goths: drawGoths, mongols: drawMongols };
/** draw civ emblem into a Pen whose space is 128x128 (small global margin applied here) */
export function drawEmblem(g, civ, d) {
  const f = DRAW[civ] || DRAW.britons, s = 0.94;
  g.at(64 - 64 * s, 64 - 64 * s + 1.5, s, () => f(g, d));
}
export const EMBLEM_IDS = Object.keys(DRAW);
/** colour palettes used to back the 48px civ icons (see icons_emblems.js) */
export const CIV_BG = {
  britons: { c: ['#ff8a6a', '#c0302c', '#5a1010'], glow: '#ffd8a0' },
  franks:  { c: ['#8ab4ff', '#3058c0', '#12246a'], glow: '#d4e4ff' },
  goths:   { c: ['#9ed0c0', '#3a7872', '#0f2e34'], glow: '#e0fff0' },
  mongols: { c: ['#ffd078', '#d8862a', '#74340c'], glow: '#fff0b8' },
};
