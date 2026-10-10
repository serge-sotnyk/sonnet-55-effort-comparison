// Gatherable resource nodes: stumps, berry bushes, gold & stone mines (3 depletion levels each).
import { makeCanvas, toSprite, rng } from './common.js';
import { TAU, clamp, hsl, ramp, addDab, makeClump, paintClump, taper, lightPass, finish } from './resources_util.js';
import { drawRock, sparkle, ROCK_STONE, ROCK_STONE_WARM, ROCK_GOLDMINE, ROCK_DARK, GOLD } from './resources_rocks.js';
import { treeFamily } from './resources_trees.js';

const OUT_ROCK = 'rgba(20,16,12,0.9)';
const OUT_BUSH = { rgb: '14,32,10', lit: 0.4, dark: 0.9 };
const OUT_WOOD = 'rgba(28,16,8,0.85)';

// ------------------------------------------------------------------ stump
const WOOD = { h0: 24, h1: 36, s0: 38, s1: 60, l0: 14, l1: 74 };         // cut wood
const BARK_OAK = { h0: 20, h1: 34, s0: 30, s1: 40, l0: 7, l1: 56 };
const BARK_PINE = { h0: 12, h1: 24, s0: 40, s1: 54, l0: 8, l1: 52 };
const BARK_BIRCH = { h0: 46, h1: 52, s0: 8, s1: 14, l0: 20, l1: 94 };
const BARK_DEAD = { h0: 28, h1: 38, s0: 10, s1: 18, l0: 11, l1: 66 };

export function buildStump(variant) {
  const fam = treeFamily(variant);
  const S = makeCanvas(40, 34), ctx = S.ctx;
  const ax = 18, ay = 20;
  const rand = rng(7001 + variant * 131);
  const bark = fam === 'birch' ? BARK_BIRCH : fam === 'conifer' || fam === 'pine' ? BARK_PINE : fam === 'dead' ? BARK_DEAD : BARK_OAK;
  const rx = { oak: 9.5, conifer: 7.6, birch: 6.2, autumn: 9.2, dead: 7.2, pine: 8, poplar: 6.4, young: 5.2 }[fam] * (0.94 + rand() * 0.14);
  const ry = rx * 0.5, h = 6 + rand() * 3.2;
  // roots creeping over the ground
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.5 + rand() * 0.6;
    const ex = ax + Math.cos(a) * (rx + 3.5 + rand() * 3), ey = ay + 0.5 + Math.sin(a) * (ry + 1.5 + rand() * 1.6);
    if (Math.sin(a) < -0.5) continue;
    taper(ctx, [[ax + Math.cos(a) * rx * 0.7, ay - 1.5 + Math.sin(a) * ry * 0.5], [(ax + ex) / 2, (ay + ey) / 2 - 0.8], [ex, ey]], 3.6, 0.8, ramp(bark, 0.3 + (Math.cos(a) < 0 ? 0.16 : 0)));
  }
  // body
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(ax - rx, ay - h);
    ctx.lineTo(ax - rx * 1.1, ay);
    ctx.ellipse(ax, ay, rx * 1.1, ry * 1.1, 0, Math.PI, 0, true);
    ctx.lineTo(ax + rx, ay - h);
    ctx.ellipse(ax, ay - h, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(ax - rx, 0, ax + rx, 0);
  g.addColorStop(0, ramp(bark, 0.72)); g.addColorStop(0.35, ramp(bark, 0.5)); g.addColorStop(0.75, ramp(bark, 0.26)); g.addColorStop(1, ramp(bark, 0.1));
  body(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const u = (rand() - 0.5) * 1.9 * rx, y0 = ay - h + ry * 0.7 + rand() * 2, y1 = ay + ry * 0.3 + rand() * 1.5;
    ctx.strokeStyle = u > -rx * 0.3 ? ramp(bark, 0.05 + rand() * 0.15, 0.6) : ramp(bark, 0.85, 0.4);
    ctx.lineWidth = 0.7 + rand() * 0.7;
    ctx.beginPath(); ctx.moveTo(ax + u, y0); ctx.lineTo(ax + u * 1.08 + (rand() - 0.5), y1); ctx.stroke();
  }
  if (fam === 'birch') {
    ctx.fillStyle = 'rgba(30,26,22,0.8)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(ax + (rand() < 0.5 ? -1 : 1) * rx * (0.55 + rand() * 0.35), ay - h * (0.2 + rand() * 0.7) + 1, 0.9 + rand() * 0.9, 0.4, 0, 0, TAU); ctx.fill(); }
  }
  // shade from the lit top
  const sg = ctx.createLinearGradient(0, ay - h, 0, ay + ry);
  sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = sg; ctx.fillRect(ax - rx * 1.3, ay - h, rx * 2.6, h + ry * 1.2);
  ctx.restore();
  // moss
  if (fam !== 'birch' && rand() < 0.7) {
    ctx.fillStyle = hsl(92, 36, 30, 0.8);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) addDab(ctx, ax - rx * 0.7 + rand() * 4, ay - 0.5 - rand() * 3, 1.0 + rand() * 0.8, 0.7, rand());
    ctx.fill();
  }
  // cut top with growth rings
  const tg = ctx.createRadialGradient(ax - rx * 0.3, ay - h - ry * 0.3, 0.5, ax, ay - h, rx * 1.1);
  tg.addColorStop(0, ramp(WOOD, 0.92)); tg.addColorStop(0.7, ramp(WOOD, 0.74)); tg.addColorStop(1, ramp(WOOD, 0.52));
  ctx.beginPath(); ctx.ellipse(ax, ay - h, rx, ry, 0, 0, TAU); ctx.fillStyle = tg; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(ax, ay - h, rx, ry, 0, 0, TAU); ctx.clip();
  const cxr = ax + (rand() - 0.5) * 1.2, cyr = ay - h + (rand() - 0.5) * 0.6;
  const nRings = Math.round(rx * 0.55);
  for (let i = 1; i <= nRings; i++) {
    const t = i / (nRings + 0.5);
    ctx.strokeStyle = ramp(WOOD, 0.3 + rand() * 0.18, 0.55 + 0.2 * (1 - t));
    ctx.lineWidth = 0.6 + rand() * 0.4;
    ctx.beginPath(); ctx.ellipse(cxr, cyr, rx * t * 0.95, ry * t * 0.95, 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = ramp(WOOD, 0.25); ctx.beginPath(); ctx.ellipse(cxr, cyr, 0.9, 0.5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = ramp(WOOD, 0.18, 0.7); ctx.lineWidth = 0.7;
  const ca = rand() * TAU;
  ctx.beginPath(); ctx.moveTo(cxr, cyr); ctx.lineTo(cxr + Math.cos(ca) * rx * 0.9, cyr + Math.sin(ca) * ry * 0.9); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = ramp(bark, 0.2, 0.9); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.ellipse(ax, ay - h, rx, ry, 0, 0, TAU); ctx.stroke();
  // wood chips on the ground (small pale splinters)
  for (let i = 0; i < 3; i++) {
    const cx = ax + rx * 0.95 + rand() * 6 - 1, cy = ay + 1.6 + rand() * 3, a = (rand() - 0.5) * 1.2;
    ctx.fillStyle = 'rgba(30,18,8,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 0.4, cy + 0.5, 1.7 + rand() * 0.6, 0.8, a, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(34, 44, 66 + rand() * 10); ctx.beginPath(); ctx.ellipse(cx, cy, 1.5 + rand() * 0.6, 0.7, a, 0, TAU); ctx.fill();
  }
  finish(S, OUT_WOOD, [[ax + 8, ay + 3, 15, 5.5, 0.3], [ax + 1, ay + 1, rx + 2, ry + 1.5, 0.3]]);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ berry bush
const FOL_BUSH = { h0: 146, h1: 84, s0: 46, s1: 66, l0: 11, l1: 58 };
const BERRY_RED = { main: hsl(352, 78, 46), dark: hsl(348, 72, 22), light: hsl(354, 92, 66) };
const BERRY_PINK = { main: hsl(340, 74, 56), dark: hsl(338, 66, 26), light: hsl(342, 95, 76) };
const BERRY_DARK = { main: hsl(350, 70, 38), dark: hsl(348, 60, 17), light: hsl(352, 85, 58) };

export function buildBerries(variant, level) {
  const S = makeCanvas(64, 50), ctx = S.ctx;
  const ax = 32, ay = 38;
  const v = variant % 3;
  const rand = rng(8100 + v * 97);                         // identical bush for all fill levels
  const rx = [19.5, 21, 18][v], ry = [11.5, 10.5, 12][v], cy = ay - 10;
  const specs = [FOL_BUSH, { ...FOL_BUSH, h0: 150, h1: 90 }, { ...FOL_BUSH, h0: 142, h1: 80, l1: 54 }];
  const spec = specs[v];
  // clumps
  const raw = [];
  const R = [8.4, 8, 9][v];
  const nRing = 8;
  for (let i = 0; i < nRing; i++) {
    const a = ((i + rand() * 0.6) / nRing) * TAU, rr = R * (0.8 + rand() * 0.5);
    raw.push({ x: ax + Math.cos(a) * (rx - rr * 0.6), y: cy + Math.sin(a) * (ry * 0.95 - rr * 0.5), r: rr });
  }
  for (let i = 0; i < 4; i++) { const a = rand() * TAU, d = 0.2 + rand() * 0.5; raw.push({ x: ax + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d * 0.9, r: R * (0.9 + rand() * 0.4) }); }
  for (let i = 0; i < 3; i++) { const a = Math.PI * (1.05 + rand() * 0.6), d = 0.35 + rand() * 0.4; raw.push({ x: ax + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d - 1, r: R * (0.6 + rand() * 0.3) }); }
  const clumps = raw.map((c) => {
    const nx = (c.x - ax) / rx, ny = (c.y - cy) / ry;
    const f = 0.5 + 0.5 * clamp(-0.55 * nx - 0.83 * ny, -1, 1);
    return makeClump(rand, c.x, c.y, c.r, clamp(0.22 + 0.5 * f + (rand() - 0.5) * 0.08, 0.1, 0.85), 0.9);
  }).sort((a, b) => a.y - b.y);
  // deep core + shadow under the bush
  ctx.fillStyle = ramp(spec, 0.07);
  ctx.beginPath(); ctx.ellipse(ax, cy + 1, rx * 0.85, ry * 0.8, 0, 0, TAU); ctx.fill();
  for (const c of clumps) paintClump(ctx, rand, c, spec, { density: 0.9 });
  // berries: fixed full list, drawn as a prefix according to the fill level
  const total = 30;
  const br = rng(9900 + v * 53);
  const berries = [];
  for (let i = 0; i < total; i++) {
    const a = br() * TAU, d = Math.sqrt(br());
    let bx = ax + Math.cos(a) * rx * 0.86 * d, by = cy + 1.5 + Math.sin(a) * ry * 0.8 * d;
    berries.push({ x: bx, y: by, r: 1.5 + br() * 0.7, pal: v === 1 ? (br() < 0.45 ? BERRY_PINK : BERRY_RED) : v === 2 ? (br() < 0.3 ? BERRY_DARK : BERRY_RED) : BERRY_RED });
  }
  berries.sort((p, q) => p.y - q.y);
  const keep = level === 2 ? total : level === 1 ? 13 : 3;
  // choose which berries remain: a stable pseudo-random subset
  const order = berries.map((b, i) => ({ i, k: ((i * 2654435761) >>> 0) % 1000 })).sort((p, q) => p.k - q.k).slice(0, keep).map((o) => o.i).sort((p, q) => p - q);
  for (const idx of order) {
    const b = berries[idx];
    ctx.fillStyle = 'rgba(10,20,6,0.45)';
    ctx.beginPath(); ctx.ellipse(b.x + 0.5, b.y + 0.9, b.r + 0.5, b.r * 0.85 + 0.4, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 0.1, b.x, b.y, b.r * 1.15);
    g.addColorStop(0, b.pal.light); g.addColorStop(0.45, b.pal.main); g.addColorStop(1, b.pal.dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,240,0.9)';
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.38, b.y - b.r * 0.42, Math.max(0.35, b.r * 0.24), 0, TAU); ctx.fill();
  }
  lightPass(ctx, ax - rx, cy - ry, rx * 2, ry * 2.2, 0.1, 0.2);
  finish(S, OUT_BUSH, [[ax + 9, ay + 1, 24, 7.5, 0.3], [ax + 1, ay, 15, 5, 0.3]]);
  return toSprite(S, ax, ay);
}

// ------------------------------------------------------------------ mines
function pile(level, m, rand) {
  const J = (a) => (rand() - 0.5) * a;
  if (level === 2) return [
    { x: J(3) - 1 * m, y: -5, rw: 15, rh: 23 },
    { x: -18 * m + J(2), y: -1, rw: 11, rh: 15 },
    { x: 18.5 * m + J(2), y: -2, rw: 10.5, rh: 14 },
    { x: -9 * m + J(2), y: 6.5, rw: 9.5, rh: 10.5 },
    { x: 9.5 * m + J(2), y: 7.5, rw: 10, rh: 9.5 },
    { x: 1 * m, y: 11.5, rw: 6.2, rh: 6 },
    { x: -24 * m, y: 7, rw: 5, rh: 5 },
    { x: 24.5 * m, y: 5.5, rw: 4.6, rh: 4.2 },
  ];
  if (level === 1) return [
    { x: -1 * m + J(2), y: -2, rw: 11.5, rh: 16 },
    { x: -14 * m, y: 3, rw: 8, rh: 9 },
    { x: 13 * m, y: 4, rw: 8.5, rh: 8.5 },
    { x: -2 * m, y: 9.5, rw: 5.5, rh: 5 },
    { x: 21 * m, y: 8, rw: 4, rh: 3.6 },
  ];
  return [
    { x: -4 * m, y: 2.5, rw: 7.5, rh: 6.5 },
    { x: 7 * m, y: 6, rw: 5.2, rh: 4.2 },
    { x: -13.5 * m, y: 7, rw: 3.6, rh: 3 },
  ];
}

function nugget(ctx, rand, x, y, s, o = {}) {
  drawRock(ctx, rand, x, y, s, s * (0.9 + rand() * 0.4), GOLD, { sides: 5, taper: 0.5, cracks: 0, speckle: 0, ao: o.ao === undefined ? 0.35 : o.ao, edge: 'rgba(60,30,4,0.55)' });
  // bright specular on the top-left facet
  ctx.fillStyle = 'rgba(255,255,230,0.9)';
  ctx.beginPath(); ctx.ellipse(x - s * 0.25, y - s * 1.0, Math.max(0.5, s * 0.22), Math.max(0.35, s * 0.14), -0.5, 0, TAU); ctx.fill();
}

function vein(ctx, rand, rock, lenFrac) {
  ctx.save();
  rock.clip(ctx); ctx.clip();
  const T = rock.T;
  const k = (rand() * T.length) | 0;
  let x = T[k][0], y = T[k][1] + 1;
  const pts = [[x, y]];
  const n = 4;
  const len = (rock.B[0][1] - T[0][1]) * lenFrac;
  for (let i = 0; i < n; i++) { x += (rand() - 0.35) * 7; y += len / n; pts.push([x, y]); }
  const stroke = (w, col, dx, dy) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy);
    ctx.stroke();
  };
  stroke(2.8, 'rgba(24,12,2,0.65)', 0.5, 0.7);
  stroke(1.9, ramp(GOLD, 0.58), 0, 0);
  stroke(0.9, ramp(GOLD, 0.95), -0.45, -0.45);
  ctx.restore();
}

export function buildMine(kind, variant, level) {
  const isGold = kind === 'gold_mine';
  const S = makeCanvas(80, 72), ctx = S.ctx;
  const ax = 40, ay = 48;
  const v = variant % 4;
  const m = v & 1 ? -1 : 1;
  const rand = rng((isGold ? 3300 : 4400) + v * 71);
  const rocks = pile(level, m, rand).sort((a, b) => a.y - b.y);
  const nug = rng(5500 + v * 31 + (isGold ? 1 : 2));
  const spec0 = isGold ? ROCK_GOLDMINE : ROCK_STONE;
  const drawn = [];
  rocks.forEach((r, i) => {
    const spec = isGold ? (i % 3 === 1 ? ROCK_DARK : spec0) : (i % 2 ? ROCK_STONE_WARM : ROCK_STONE);
    const rk = drawRock(ctx, rand, ax + r.x, ay + r.y, r.rw, r.rh, spec, { sides: 6 + (i & 1), taper: 0.5 + rand() * 0.15, cracks: isGold ? 1 : 2, ao: 0.45, edge: 'rgba(14,10,8,0.5)' });
    drawn.push({ r, rk });
    if (isGold && level >= 1 && r.rh > 9 && i < 4) { vein(ctx, nug, rk, 0.55 + nug() * 0.3); if (level === 2 && r.rh > 14) vein(ctx, nug, rk, 0.4); }
    if (isGold) {
      // nuggets embedded / resting on this rock
      const cnt = level === 2 ? (r.rh > 14 ? 3 : r.rh > 9 ? 2 : 1) : level === 1 ? (r.rh > 12 ? 2 : 1) : 1;
      for (let n = 0; n < cnt; n++) {
        if (level === 0 && i > 1) break;
        const s = (level === 0 ? 2.1 : 2.6) + nug() * (r.rh > 12 ? 2.6 : 1.6);
        nugget(ctx, nug, ax + r.x + (nug() - 0.5) * r.rw * 1.1, ay + r.y + r.rw * 0.12 - r.rh * (0.12 + nug() * 0.5) + 1.2, s);
      }
    } else if (!isGold && rand() < 0.45) {
      // lichen / moss specks on the stone
      ctx.fillStyle = hsl(84, 30, 46, 0.65);
      ctx.beginPath();
      for (let k = 0; k < 4; k++) addDab(ctx, ax + r.x + (rand() - 0.5) * r.rw, ay + r.y - r.rh * (0.3 + rand() * 0.5), 1 + rand(), 0.6 + rand() * 0.4, rand());
      ctx.fill();
    }
  });
  if (isGold) {
    // loose nuggets lying in front of the pile + glints
    const loose = level === 2 ? [[-4.5, 14.5, 3.2], [6.5, 14, 2.6], [-17, 10, 2.4]] : level === 1 ? [[5, 13, 2.8], [-9, 12, 2.2]] : [[0.5, 10, 2.6]];
    for (const l of loose) nugget(ctx, nug, ax + l[0] * m, ay + l[1], l[2]);
    const gl = level === 2 ? 3 : level === 1 ? 2 : 1;
    const gl_pos = [[-6, -22, 4.2], [11, -8, 3.4], [-18, -10, 3]];
    for (let i = 0; i < gl; i++) sparkle(ctx, ax + gl_pos[i][0] * m, ay + gl_pos[i][1] * (level === 2 ? 1 : 0.6) + (level === 0 ? 4 : 0), gl_pos[i][2] * (level === 0 ? 0.75 : 1));
  } else {
    // little loose gravel
    for (let i = 0; i < (level === 2 ? 5 : 3); i++) {
      const gx = ax + (rand() - 0.5) * 50, gy = ay + 10 + rand() * 5;
      drawRock(ctx, rand, gx, gy, 1.7 + rand() * 0.9, 1.4 + rand() * 0.8, i % 2 ? ROCK_STONE_WARM : ROCK_STONE, { sides: 5, ao: 0.25, cracks: 0, speckle: 0 });
    }
  }
  lightPass(ctx, ax - 30, ay - 34, 60, 50, 0.1, 0.24, '255,240,210', '10,14,30');
  finish(S, OUT_ROCK, [[ax + 12, ay + 4, 36, 11, 0.32], [ax + 2, ay + 3, 24, 8, 0.26]]);
  return toSprite(S, ax, ay);
}
