// Procedural trees for "Age of Crowns": oaks, spruces/firs, birches, an autumn tree, a dead tree, a stone pine, a poplar,
// a young bushy tree and a tall Scots pine.  Every tree is anchored at the trunk base, lit from the upper-left, has a baked
// contact shadow toward the lower-right and a thin dark outline.
import { makeCanvas, toSprite, rng, valueNoise } from './common.js';
import {
  TAU, clamp, lerp, hsl, ramp, tint, addDab, blobPath, makeClump, fillClump, paintClump, drawTrunk, taper, bez, featherPath, lightPass, finish, OUTLINE_LEAF,
} from './resources_util.js';

// ------------------------------------------------------------------ palettes (t=0 deep shadow ... t=1 sunlit highlight)
const FOL_OAK = { h0: 146, h1: 86, s0: 48, s1: 60, l0: 9, l1: 55 };
const FOL_OAK_Y = { h0: 138, h1: 78, s0: 46, s1: 64, l0: 10, l1: 58 };       // warmer / spring
const FOL_OAK_B = { h0: 158, h1: 96, s0: 42, s1: 52, l0: 9, l1: 52 };        // cooler, bluish
const FOL_SPRUCE = { h0: 178, h1: 124, s0: 46, s1: 44, l0: 8, l1: 46 };      // dark blue-green
const FOL_PINE = { h0: 152, h1: 92, s0: 46, s1: 54, l0: 8, l1: 50 };         // warmer green
const FOL_BIRCH = { h0: 132, h1: 68, s0: 38, s1: 66, l0: 15, l1: 64 };
const FOL_AUTUMN = { h0: 6, h1: 46, s0: 62, s1: 90, l0: 13, l1: 60 };
const FOL_AUTUMN_O = { h0: 12, h1: 40, s0: 70, s1: 92, l0: 15, l1: 56 };
const FOL_AUTUMN_G = { h0: 104, h1: 60, s0: 48, s1: 68, l0: 12, l1: 54 };
const FOL_STONEPINE = { h0: 160, h1: 100, s0: 40, s1: 48, l0: 9, l1: 48 };
const FOL_POPLAR = { h0: 144, h1: 80, s0: 36, s1: 56, l0: 12, l1: 60 };
const FOL_YOUNG = { h0: 134, h1: 76, s0: 50, s1: 68, l0: 13, l1: 62 };

const TR_OAK = { h0: 20, h1: 34, s0: 30, s1: 40, l0: 7, l1: 56 };
const TR_PINE = { h0: 12, h1: 24, s0: 40, s1: 54, l0: 8, l1: 52 };
const TR_BIRCH = { h0: 46, h1: 52, s0: 8, s1: 14, l0: 18, l1: 94 };
const TR_DEAD = { h0: 28, h1: 38, s0: 10, s1: 18, l0: 11, l1: 66 };
const TR_POPLAR = { h0: 40, h1: 48, s0: 14, s1: 22, l0: 14, l1: 60 };

// ------------------------------------------------------------------ crown helpers
/** Build leaf clumps filling an elliptical crown: perimeter ring + interior + sunlit top clumps + small fringe clumps + side lumps. */
function crownClumps(rand, cx, cy, rx, ry, o) {
  const R = o.rBase || Math.min(rx, ry) * (o.lobe || 0.38);
  const irr = o.irr === undefined ? 0.13 : o.irr;
  const p1 = rand() * TAU, p2 = rand() * TAU, p3 = rand() * TAU;
  const radAt = (a) => 1 + irr * (0.55 * Math.sin(2 * a + p1) + 0.3 * Math.sin(3 * a + p2) + 0.15 * Math.sin(5 * a + p3));
  const flat = o.flat === undefined ? 0.9 : o.flat;
  const raw = [];
  const nRing = o.ring || 10;
  for (let i = 0; i < nRing; i++) {
    const a = ((i + rand() * 0.7) / nRing) * TAU;
    const rr = R * (0.78 + rand() * 0.62);
    const k = radAt(a), sy = Math.sin(a) > 0 ? flat : 1;
    raw.push({ x: cx + Math.cos(a) * (rx * k - rr * 0.62), y: cy + Math.sin(a) * (ry * k * sy - rr * 0.62), r: rr, kind: 1 });
  }
  raw.push({ x: cx + (rand() - 0.5) * rx * 0.2, y: cy + (rand() - 0.5) * ry * 0.2, r: R * (1.0 + rand() * 0.3), kind: 0 });
  const nIn = o.inner === undefined ? 7 : o.inner;
  for (let i = 0; i < nIn; i++) {
    const a = rand() * TAU, d = Math.sqrt(0.08 + rand() * 0.5);
    raw.push({ x: cx + Math.cos(a) * rx * d * 0.82, y: cy + Math.sin(a) * ry * d * 0.82, r: R * (0.85 + rand() * 0.5), kind: 0 });
  }
  const nTop = o.top === undefined ? 6 : o.top;
  for (let i = 0; i < nTop; i++) {
    const a = Math.PI * (1.0 + rand() * 0.62), d = 0.4 + rand() * 0.42;
    raw.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d, r: R * (0.58 + rand() * 0.36), top: true, kind: 0 });
  }
  if (o.lumps) for (const l of o.lumps) {            // explicit side lumps: { a: angle, d: distance (1 = rim), r: size factor }
    raw.push({ x: cx + Math.cos(l.a) * rx * l.d, y: cy + Math.sin(l.a) * ry * l.d, r: R * l.r, kind: 1 });
  }
  if (o.extra) for (const e of o.extra) raw.push({ x: e.x, y: e.y, r: e.r, kind: 1 });
  const nFr = o.fringe === undefined ? 5 : o.fringe;
  for (let i = 0; i < nFr; i++) {
    const a = rand() * TAU, k = radAt(a) * 0.98;
    const rr = R * (0.42 + rand() * 0.22);
    raw.push({ x: cx + Math.cos(a) * (rx * k - rr * 0.3), y: cy + Math.sin(a) * (ry * k - rr * 0.3), r: rr, kind: 2 });
  }
  const out = [];
  for (const l of raw) {
    const nx = (l.x - cx) / rx, ny = (l.y - cy) / ry;
    const f = 0.5 + 0.5 * clamp(-0.55 * nx - 0.83 * ny, -1, 1);
    const ff = clamp(0.17 + 0.56 * f + (rand() - 0.5) * 0.09 + (l.top ? 0.05 : 0), 0.08, 0.9);
    const cl = makeClump(rand, l.x, l.y, l.r, ff, o.sq === undefined ? 0.92 : o.sq);
    cl.kind = l.kind;                              // 0 inner/top/centre, 1 silhouette (ring/lump/extra), 2 fringe
    out.push(cl);
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

function paintCrown(ctx, rand, clumps, cx, cy, rx, ry, specAt, o = {}) {
  // solid deep core so no hole can show through the leaf masses
  ctx.fillStyle = ramp(specAt(clumps[clumps.length >> 1]), 0.07);
  blobPath(ctx, cx, cy, rx * 0.8, ry * 0.8, rand, 12, 0.08);
  ctx.fill();
  // dark underlay (slightly enlarged, shifted lower-right): gaps between clumps read as inner shadow
  for (const c of clumps) {
    if (c.kind === 0) continue;                    // interior clumps are covered by their neighbours anyway
    ctx.fillStyle = ramp(specAt(c), 0.05 + c.f * 0.09);
    fillClump(ctx, c, 0.6, 1.0, 1.07);
  }
  if (o.between) o.between(ctx);
  for (const c of clumps) paintClump(ctx, rand, c, specAt(c), { density: o.density, halo: c.kind !== 2 });
  // sparkles: sunlit leaf tips on the upper-left rim of the crown
  const nS = o.sparkles === undefined ? 10 : o.sparkles;
  ctx.fillStyle = ramp(specAt(clumps[0]), 0.95);
  ctx.beginPath();
  for (let i = 0; i < nS; i++) {
    const a = Math.PI * (0.95 + rand() * 0.75), d = 0.55 + rand() * 0.38;
    addDab(ctx, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 1.2 + rand() * 0.8, 0.7 + rand() * 0.4, a + Math.PI / 2);
  }
  ctx.fill();
}

function roots(ctx, rand, ax, ay, spec, w) {
  for (const s of [-1, 1]) {
    const len = w * (0.7 + rand() * 0.45);
    taper(ctx, [[ax + s * w * 0.25, ay - 4], [ax + s * len * 0.6, ay - 1.6], [ax + s * len, ay + 0.8]], 5.0, 1.0, ramp(spec, s < 0 ? 0.52 : 0.2));
  }
  taper(ctx, [[ax - 1, ay - 3], [ax + (rand() - 0.5) * 3, ay + 0.8], [ax + (rand() - 0.5) * 5, ay + 2.4]], 4.2, 1.1, ramp(spec, 0.32));
}

/** small grass blades around the trunk base: drawn AFTER the outline so they stay soft; ties the tree into the ground */
function baseTufts(S, rand, ax, ay, halfW, n) {
  const ctx = S.ctx;
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * 2 - 1;
    const x = ax + u * halfW + (rand() - 0.5) * 2.2, y = ay + 1.2 + rand() * 2.2;
    const h = 2.6 + rand() * 3.2, lean = u * 1.6 + (rand() - 0.5) * 1.6;
    const g = ctx.createLinearGradient(0, y, 0, y - h);
    g.addColorStop(0, hsl(112, 40, 20 + rand() * 6)); g.addColorStop(1, hsl(88 + rand() * 14, 50, 44 + rand() * 10));
    ctx.beginPath();
    ctx.moveTo(x - 0.9, y); ctx.quadraticCurveTo(x - 0.2 + lean * 0.3, y - h * 0.6, x + lean, y - h); ctx.quadraticCurveTo(x + 0.5 + lean * 0.3, y - h * 0.55, x + 0.9, y);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  }
}

// ------------------------------------------------------------------ broadleaf (oak / autumn / young / poplar)
function drawBroadleaf(S, ax, ay, p) {
  const ctx = S.ctx, rand = rng(p.seed);
  const cx = ax + (p.dx || 0), cy = ay - p.cy, rx = p.rx, ry = p.ry;
  const tr = drawTrunk(ctx, rand, ax, ay, p.trunkH, p.tw, p.tw * 0.66, p.lean || 0, p.trunk, { flare: p.flare === undefined ? 0.9 : p.flare, wob: p.wob === undefined ? 1.1 : p.wob });
  roots(ctx, rand, ax, ay, p.trunk, p.tw);
  // spreading side limbs (silhouette character): a tapered branch with a leaf clump at its tip
  const extra = [];
  if (p.limbs) for (const L of p.limbs) {
    const bx = tr.cxAt(L.t), by = ay - p.trunkH * L.t;
    const ex = bx + L.side * L.len, ey = by - L.rise;
    taper(ctx, bez(bx, by, bx + L.side * L.len * 0.5, by - L.rise * 0.15 - 3, ex, ey, 6), p.tw * 0.5, 2.2, ramp(p.trunk, L.side < 0 ? 0.42 : 0.22));
    taper(ctx, bez(bx, by - 1, bx + L.side * L.len * 0.5, by - L.rise * 0.15 - 4, ex, ey - 1, 6).map((q) => [q[0] - 0.3, q[1] - 0.4]), p.tw * 0.18, 0.6, ramp(p.trunk, 0.8, 0.7));
    extra.push({ x: ex + L.side * 2, y: ey - 3, r: L.r });
  }
  // limbs into the crown
  const topX = tr.cxAt(1), topY = ay - p.trunkH;
  for (let b = 0; b < 3; b++) {
    const dir = b === 0 ? -1 : b === 1 ? 1 : (rand() < 0.5 ? -1 : 1);
    const ex = topX + dir * Math.min(8 + rand() * 14, rx * 0.7), ey = topY - (10 + rand() * 12);
    taper(ctx, bez(topX, topY + 3, topX + dir * 4, topY - 2, ex, ey, 5), 4.6, 1.4, ramp(p.trunk, dir < 0 ? 0.42 : 0.2));
  }
  const clumps = crownClumps(rand, cx, cy, rx, ry, extra.length ? { ...p, extra } : p);
  const specs = p.specs;
  // per-clump colour jitter (hue/saturation/lightness drift of a few degrees) so a crown is not one flat hue
  const jitter = (sp, c) => c.spec || (c.spec = tint(sp, (rand() - 0.5) * 12, (rand() - 0.5) * 8, (rand() - 0.5) * 4));
  const specAt = specs
    ? (c) => jitter(specs[Math.min(specs.length - 1, Math.floor(valueNoise(c.x * 0.06 + p.seed, c.y * 0.06, p.seed) * specs.length))], c)
    : (c) => jitter(p.spec, c);
  paintCrown(ctx, rand, clumps, cx, cy, rx, ry, specAt, { density: p.density, sparkles: p.sparkles });
  lightPass(ctx, cx - rx, cy - ry, rx * 2, ry * 2.1, 0.12, 0.24);
  const sw = rx * 1.1;
  finish(S, OUTLINE_LEAF, [
    [ax + sw * 0.5, ay + 3, sw * 0.95, sw * 0.32, 0.30],
    [ax + 1, ay + 1.5, 11, 3.8, 0.34],
  ]);
  baseTufts(S, rand, ax, ay, p.tw * 0.9 + 3, 7);
}

// ------------------------------------------------------------------ conifers (stacked tiers of drooping boughs)
function drawConifer(S, ax, ay, p) {
  const ctx = S.ctx, rand = rng(p.seed);
  const spec = p.spec;
  const N = p.tiers;
  const yTop = ay - p.H, yBot = ay - p.trunkH, span = yBot - yTop;
  drawTrunk(ctx, rand, ax, ay, p.trunkH + 16, p.tw, p.tw * 0.7, 0, p.trunk, { flare: 0.7, wob: 0.4 });
  roots(ctx, rand, ax, ay, p.trunk, p.tw * 0.85);
  const tiers = [];
  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 1 : i / (N - 1);
    const yb = yTop + span * lerp(p.firstFrac, 1, Math.pow(t, p.pow));
    const W = p.W * lerp(p.topW, 1, Math.pow(t, 0.82)) * (0.93 + rand() * 0.14);
    const prev = tiers[i - 1];
    const ya = prev ? prev.yb - (prev.yb - prev.ya) * p.overlap : yTop + 2;
    const lean = (p.lean || 0) * (1 - t) + (rand() - 0.5) * p.jit;
    tiers.push({ yb, ya, W, cx: ax + lean, t, f: p.light - t * 0.14 + (rand() - 0.5) * 0.05 });
  }
  for (let i = N - 1; i >= 0; i--) {
    const T = tiers[i], hw = T.W / 2, h = T.yb - T.ya;
    const SQ = p.squash * (0.45 + 0.55 * T.t);
    const body = (k, ox, oy) => {
      const cx = T.cx + ox, mid = T.ya + h * 0.55 + oy;
      ctx.beginPath();
      ctx.moveTo(cx, T.ya + oy);
      ctx.quadraticCurveTo(cx + hw * 0.3 * k, mid, cx + hw * k, T.yb + oy);
      ctx.ellipse(cx, T.yb + oy, hw * k, hw * SQ * k, 0, 0, Math.PI, false);
      ctx.quadraticCurveTo(cx - hw * 0.3 * k, mid, cx, T.ya + oy);
      ctx.closePath();
    };
    // cast shadow of this tier on the tiers beneath it
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    body(1.04, 1.8, 5.0);
    ctx.fillStyle = 'rgba(2,14,14,0.5)';
    ctx.fill();
    ctx.restore();
    // umbrella body: lit left -> dark right, lighter toward the apex
    const g = ctx.createLinearGradient(T.cx - hw, 0, T.cx + hw, 0);
    g.addColorStop(0, ramp(spec, T.f + 0.06));
    g.addColorStop(0.45, ramp(spec, T.f - 0.08));
    g.addColorStop(1, ramp(spec, T.f - 0.3));
    body(0.88, 0, 0);
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    body(0.88, 0, 0); ctx.clip();
    const vg = ctx.createLinearGradient(0, T.ya, 0, T.yb + hw * SQ);
    vg.addColorStop(0, 'rgba(255,245,170,0.2)');
    vg.addColorStop(0.55, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,14,18,0.28)');
    ctx.fillStyle = vg; ctx.fillRect(T.cx - hw - 2, T.ya - 1, T.W + 4, h + hw * SQ + 6);
    // ribs: fold lines running from the apex to the hem (low contrast, they give the surface a bough structure)
    const nR = Math.round(hw * 0.7);
    ctx.lineCap = 'round';
    for (let k = 0; k < nR; k++) {
      const phi = Math.PI * ((k + 0.2 + rand() * 0.6) / nR);
      const cs = Math.cos(phi), sn = Math.sin(phi);
      const tx = T.cx + cs * hw * 0.95, ty = T.yb + sn * hw * SQ * 0.95;
      const bx = T.cx + cs * hw * 0.06, by = T.ya + h * (0.1 + rand() * 0.2);
      const lit = -cs > 0.1;
      ctx.strokeStyle = lit ? ramp(spec, T.f + 0.24, 0.5) : ramp(spec, T.f - 0.26, 0.55);
      ctx.lineWidth = 0.8 + rand() * 0.9;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(T.cx + cs * hw * 0.42, by + (ty - by) * 0.3, tx, ty); ctx.stroke();
    }
    ctx.restore();
    // hem boughs: two rows of leaf shaped fronds along the skirt (back row shorter/darker), drooping tips with needle fans
    const bw = clamp(hw * 0.15, 1.5, 3.5);
    const rows = [
      { n: Math.round(T.W / 6.2) + 2, reach: 0.94, len: 0.5, dark: 0.18, wmax: bw * 1.1 },
      { n: Math.round(T.W / 5.0) + 3, reach: 1.06, len: 0.56, dark: 0.0, wmax: bw },
    ];
    for (let rI = 0; rI < rows.length; rI++) {
      const row = rows[rI];
      const boughs = [];
      for (let k = 0; k < row.n; k++) if (rand() > 0.1) boughs.push(Math.PI * ((k + 0.15 + rand() * 0.7) / row.n));
      boughs.sort((a, b) => Math.abs(Math.cos(b)) - Math.abs(Math.cos(a)));
      for (const phi of boughs) {
        const cs = Math.cos(phi), sn = Math.sin(phi);
        const side2 = Math.abs(cs) > 0.72;
        const reach = row.reach * (0.82 + rand() * 0.36) * (side2 ? 1.06 : 1);
        const tx = T.cx + cs * hw * reach;
        const ty = T.yb + sn * hw * SQ * reach + p.droop * (0.3 + rand() * 1.0) * (0.35 + 0.65 * Math.abs(cs)) * (side2 ? 1.5 : 1);
        const frac = row.len * (0.8 + rand() * 0.4);
        const sx = T.cx + (tx - T.cx) * (1 - frac * 0.9), sy = ty - (ty - (T.ya + h * 0.2)) * frac;
        const qx = (sx + tx) / 2 + cs * 0.8, qy = (sy + ty) / 2 - 1.2;
        const fb = T.f + (-cs) * 0.15 - row.dark + (rand() - 0.5) * 0.08;
        const wm = row.wmax * (0.85 + rand() * 0.4);
        featherPath(ctx, sx + 0.5, sy + 1.1, qx + 0.5, qy + 1.1, tx + 0.5, ty + 1.3, wm + 0.5);
        ctx.fillStyle = ramp(spec, fb - 0.34, 0.85); ctx.fill();
        featherPath(ctx, sx, sy, qx, qy, tx, ty, wm);
        ctx.fillStyle = ramp(spec, fb); ctx.fill();
        featherPath(ctx, sx - 0.3, sy - 0.9, qx - 0.3, qy - 0.9, tx - 0.3, ty - 0.5, wm * 0.42);
        ctx.fillStyle = ramp(spec, fb + 0.3, 0.75); ctx.fill();
        if (rI === 1) {                                  // needle fan at the bough tip
          ctx.strokeStyle = ramp(spec, fb + 0.05, 0.9); ctx.lineWidth = 0.8;
          ctx.beginPath();
          const ang = Math.atan2(ty - qy, tx - qx);
          for (let n = -1; n <= 1; n++) {
            const aa = ang + n * 0.55 + (rand() - 0.5) * 0.3, ll = 2.2 + rand() * 1.4;
            ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(aa) * ll, ty + Math.sin(aa) * ll);
          }
          ctx.stroke();
        }
      }
    }
    // needle tufts on the lit side
    ctx.fillStyle = ramp(spec, T.f + 0.36, 0.85);
    ctx.beginPath();
    const nT = Math.round(T.W * 0.25);
    for (let k = 0; k < nT; k++) {
      const a = Math.PI * (0.5 + rand() * 0.55), d = 0.3 + rand() * 0.62;
      addDab(ctx, T.cx + Math.cos(a) * hw * d, T.ya + h * (0.4 + rand() * 0.55), 1.3 + rand() * 0.9, 0.6 + rand() * 0.3, a + 0.9);
    }
    ctx.fill();
  }
  // leader spike
  const top = tiers[0];
  taper(ctx, [[top.cx, top.ya + 5], [top.cx + 0.3, top.ya - 2]], 2.4, 0.4, ramp(spec, 0.55));
  lightPass(ctx, ax - p.W / 2, yTop, p.W, p.H, 0.12, 0.2);
  finish(S, OUTLINE_LEAF, [
    [ax + p.W * 0.3, ay + 3, p.W * 0.66, p.W * 0.24, 0.32],
    [ax + 1, ay + 1.5, 10, 3.6, 0.34],
  ]);
}

// ------------------------------------------------------------------ birch (slender white trunk, airy crown of separate leaf clusters)
function drawBirch(S, ax, ay, p) {
  const ctx = S.ctx, rand = rng(p.seed);
  const cx = ax + (p.dx || 0), cy = ay - p.cy, rx = p.rx, ry = p.ry;
  const trunks = [{ lean: p.lean, h: p.trunkH, w: p.tw, dx: 0 }];
  if (p.twin) trunks.push({ lean: -p.lean * 1.4 - 2, h: p.trunkH * 0.86, w: p.tw * 0.8, dx: 2.5 });
  const tops = [];
  for (const T of trunks) {
    const tr = drawTrunk(ctx, rand, ax + T.dx, ay, T.h, T.w, T.w * 0.6, T.lean, TR_BIRCH, { flare: 0.7, wob: 1.2, lit: 0.95, barkDensity: 0.2 });
    ctx.fillStyle = 'rgba(30,26,22,0.9)';
    for (let i = 0; i < T.h / 4.2; i++) {
      const t = 0.03 + rand() * 0.9, c = tr.cxAt(t), w = tr.wAt(t);
      const y = ay - T.h * t, wid = 1.2 + rand() * (w * 0.5);
      ctx.beginPath();
      ctx.ellipse(c + (rand() - 0.55) * w * 0.5, y, wid, 0.55 + rand() * 0.5, (rand() - 0.5) * 0.3, 0, TAU);
      ctx.fill();
    }
    tops.push([tr.cxAt(1), ay - T.h]);
  }
  roots(ctx, rand, ax, ay, TR_BIRCH, p.tw);
  // twiggy branches reaching into the crown (their tips are always buried under leaf clusters)
  const raw = [];
  for (let ti = 0; ti < tops.length; ti++) {
    const [topX, topY] = tops[ti];
    raw.push({ x: topX + 1, y: topY - 3, r: 6.8 });
    for (let b = 0; b < 6; b++) {
      const dir = b % 2 ? 1 : -1;
      const ex = clamp(topX + dir * (5 + rand() * 14), cx - rx * 0.78, cx + rx * 0.78), ey = clamp(topY - 8 - rand() * 24, cy - ry * 0.8, cy + ry * 0.35);
      taper(ctx, bez(topX, topY + 8 - b * 2.2, topX + dir * 3, topY - 8, ex, ey, 5), 2.6, 0.9, ramp(TR_BIRCH, dir < 0 ? 0.8 : 0.5));
      raw.push({ x: ex, y: ey, r: 5.2 + rand() * 2 });
    }
  }
  // leaf clusters on a jittered grid (some cells left empty so the crown stays airy)
  const stepX = 10.5, stepY = 9.5;
  for (let gy = -ry; gy <= ry; gy += stepY) {
    for (let gx = -rx; gx <= rx; gx += stepX) {
      const x = gx + (rand() - 0.5) * 5, y = gy + (rand() - 0.5) * 5;
      const nx = x / rx, ny = y / ry, d = Math.hypot(nx, ny);
      if (d > 1.0) continue;
      if (d > 0.6 && rand() < 0.16) continue;                      // gaps toward the rim
      raw.push({ x: cx + x, y: cy + y, r: 5.0 + rand() * 3.2 + (1 - d) * 1.6 });
    }
  }
  const clumps = raw.map((c) => {
    const nx = (c.x - cx) / rx, ny = (c.y - cy) / ry;
    const f = 0.5 + 0.5 * clamp(-0.55 * nx - 0.83 * ny, -1, 1);
    return makeClump(rand, c.x, c.y, c.r, clamp(0.2 + 0.56 * f + (rand() - 0.5) * 0.1, 0.1, 0.9), 0.9);
  }).sort((a, b) => a.y - b.y);
  for (const c of clumps) { ctx.fillStyle = ramp(p.spec, 0.06 + c.f * 0.1); fillClump(ctx, c, 0.5, 0.8, 1.05); }
  for (const c of clumps) paintClump(ctx, rand, c, p.spec, { density: 1.0 });
  // sunlit sparkles
  ctx.fillStyle = ramp(p.spec, 0.95);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * (0.95 + rand() * 0.75), d = 0.5 + rand() * 0.4;
    addDab(ctx, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 1.2 + rand() * 0.8, 0.7 + rand() * 0.4, a + Math.PI / 2);
  }
  ctx.fill();
  // hanging twigs with leaves
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 0.9 + 0.1, x0 = cx + Math.cos(a) * rx * 0.75, y0 = cy + Math.sin(a) * ry * 0.85;
    const x1 = x0 + (rand() - 0.5) * 5, y1 = y0 + 6 + rand() * 8;
    ctx.strokeStyle = 'rgba(70,64,48,0.8)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + 1, (y0 + y1) / 2, x1, y1); ctx.stroke();
    ctx.fillStyle = ramp(p.spec, 0.45 + rand() * 0.3);
    ctx.beginPath(); addDab(ctx, x1, y1, 2.3, 1.5, Math.PI / 2 + (rand() - 0.5)); addDab(ctx, x1 + 1.5, y1 - 3, 2, 1.3, 0.8); ctx.fill();
  }
  lightPass(ctx, cx - rx, cy - ry, rx * 2, ry * 2.1, 0.12, 0.2);
  finish(S, OUTLINE_LEAF, [
    [ax + rx * 0.5, ay + 3, rx * 0.95, rx * 0.32, 0.26],
    [ax + 1, ay + 1.5, 8, 3, 0.32],
  ]);
  baseTufts(S, rand, ax, ay, p.tw * 0.9 + 2.5, 6);
}

// ------------------------------------------------------------------ dead tree
function drawDead(S, ax, ay, p) {
  const ctx = S.ctx, rand = rng(p.seed);
  const spec = TR_DEAD;
  const tr = drawTrunk(ctx, rand, ax, ay, p.trunkH, p.tw, p.tw * 0.56, p.lean, spec, { flare: 1.1, wob: 2.4, barkDensity: 0.7 });
  roots(ctx, rand, ax, ay, spec, p.tw * 1.1);
  // hollow in the trunk
  {
    const hx = tr.cxAt(0.32) + 1.2, hy = ay - p.trunkH * 0.32;
    ctx.fillStyle = 'rgba(12,8,5,0.9)'; ctx.beginPath(); ctx.ellipse(hx, hy, 2.4, 4.6, 0.12, 0, TAU); ctx.fill();
    ctx.strokeStyle = ramp(spec, 0.62, 0.8); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(hx - 0.4, hy - 0.4, 2.7, 5, 0.12, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
  }
  const limbs = [];
  const grow = (x, y, ang, len, w0, w1, depth, tw) => {
    const pts = [[x, y]];
    let cx = x, cy = y, a = ang;
    const segs = Math.max(3, Math.round(len / 5));
    for (let sI = 0; sI < segs; sI++) {
      a += (rand() - 0.5) * (depth === 0 ? 0.9 : 0.55);
      cx += Math.cos(a) * len / segs; cy += Math.sin(a) * len / segs;
      pts.push([cx, cy]);
    }
    limbs.push({ pts, w0, w1, depth });
    if (depth > 0) {
      const nk = depth === 2 ? 3 : 2;
      for (let k = 0; k < nk; k++) {
        const j = 1 + Math.floor((0.25 + 0.65 * (k + rand() * 0.6) / nk) * (pts.length - 2)), q = pts[Math.min(j, pts.length - 1)];
        const side = (k + (rand() < 0.3 ? 1 : 0)) % 2 ? 1 : -1;
        grow(q[0], q[1], a + side * (0.55 + rand() * 0.55), len * (0.42 + rand() * 0.22), w1 * 1.2, Math.max(0.7, w1 * 0.55), depth - 1, tw);
      }
    }
  };
  const topX = tr.cxAt(1), topY = ay - p.trunkH;
  const t = p.tw;
  grow(topX - 1, topY + 3, -Math.PI / 2 - 0.62, 28, t * 0.52, t * 0.22, 2);
  grow(topX + 1, topY + 3, -Math.PI / 2 + 0.5, 30, t * 0.5, t * 0.2, 2);
  grow(topX, topY + 4, -Math.PI / 2 - 0.06, 15, t * 0.44, t * 0.3, 0);          // broken-off centre stub
  grow(tr.cxAt(0.58), ay - p.trunkH * 0.58, -Math.PI / 2 + (rand() < 0.5 ? -1.2 : 1.2), 19, t * 0.34, t * 0.16, 1);
  limbs.sort((a, b) => b.depth - a.depth);
  for (const L of limbs) {
    taper(ctx, L.pts.map((q) => [q[0] + 0.7, q[1] + 0.9]), L.w0 + 0.8, L.w1 + 0.5, ramp(spec, 0.1, 0.55));
    taper(ctx, L.pts, L.w0, L.w1, ramp(spec, 0.34));
    taper(ctx, L.pts.map((q) => [q[0] - L.w0 * 0.2, q[1] - L.w0 * 0.22]), L.w0 * 0.42, Math.max(0.4, L.w1 * 0.3), ramp(spec, 0.74, 0.85));
  }
  // jagged top of the broken stub
  ctx.fillStyle = ramp(spec, 0.62);
  ctx.beginPath(); ctx.moveTo(topX - 2.4, topY - 8); ctx.lineTo(topX - 0.6, topY - 13); ctx.lineTo(topX + 0.8, topY - 9.5); ctx.lineTo(topX + 2.4, topY - 12); ctx.lineTo(topX + 3, topY - 7.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hsl(96, 36, 30, 0.85);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) addDab(ctx, ax - p.tw * 0.45 + rand() * 5, ay - 3 - rand() * 11, 1.5 + rand() * 1.3, 1.0, rand());
  ctx.fill();
  lightPass(ctx, ax - 30, ay - p.H, 60, p.H, 0.1, 0.2);
  finish(S, OUTLINE_LEAF, [
    [ax + 18, ay + 3, 26, 8.5, 0.28],
    [ax + 1, ay + 1.5, 10, 3.6, 0.34],
  ]);
  baseTufts(S, rand, ax, ay, p.tw * 0.8 + 3, 6);
}

// ------------------------------------------------------------------ stone pine (umbrella)
function drawStonePine(S, ax, ay, p) {
  const ctx = S.ctx, rand = rng(p.seed);
  const spec = FOL_STONEPINE;
  const tr = drawTrunk(ctx, rand, ax, ay, p.trunkH, p.tw, p.tw * 0.62, p.lean, TR_PINE, { flare: 0.7, wob: 2.2 });
  roots(ctx, rand, ax, ay, TR_PINE, p.tw);
  const topX = tr.cxAt(1), topY = ay - p.trunkH;
  const pads = [
    { x: topX - 17, y: topY - 4, rx: 20, ry: 9.5 },
    { x: topX + 18, y: topY - 2, rx: 19, ry: 9 },
    { x: topX + 1, y: topY - 13, rx: 25, ry: 11 },
    { x: topX - 6, y: topY - 24, rx: 17, ry: 8 },
  ];
  for (const pd of pads) taper(ctx, bez(topX, topY + 8, (topX + pd.x) / 2, topY + 4, pd.x, pd.y + 3, 5), 4.4, 1.6, ramp(TR_PINE, pd.x < topX ? 0.45 : 0.2));
  for (const pd of pads) {
    const clumps = crownClumps(rand, pd.x, pd.y, pd.rx, pd.ry, { rBase: 6.6, ring: 8, inner: 2, top: 3, fringe: 3 });
    paintCrown(ctx, rand, clumps, pd.x, pd.y, pd.rx, pd.ry, () => spec, { density: 0.9, sparkles: 6 });
  }
  lightPass(ctx, topX - 40, topY - 36, 80, 50, 0.12, 0.22);
  finish(S, OUTLINE_LEAF, [
    [ax + 24, ay + 3, 38, 12, 0.3],
    [ax + 1, ay + 1.5, 10, 3.6, 0.34],
  ]);
  baseTufts(S, rand, ax, ay, p.tw * 0.9 + 3, 6);
}

// ------------------------------------------------------------------ tall Scots pine (bare reddish trunk + ragged crown)
function drawScotsPine(S, ax, ay, p) {
  const ctx = S.ctx, rand = rng(p.seed);
  const spec = FOL_PINE;
  const tr = drawTrunk(ctx, rand, ax, ay, p.trunkH, p.tw, p.tw * 0.5, p.lean, TR_PINE, { flare: 0.9, wob: 1.6, lit: 0.78 });
  roots(ctx, rand, ax, ay, TR_PINE, p.tw);
  const topX = tr.cxAt(1), topY = ay - p.trunkH;
  const clumps = [
    { x: topX - 12, y: topY + 6, rx: 15, ry: 8 },
    { x: topX + 13, y: topY - 4, rx: 15, ry: 8.5 },
    { x: topX - 8, y: topY - 14, rx: 15, ry: 9 },
    { x: topX + 6, y: topY - 25, rx: 14, ry: 9 },
    { x: topX - 2, y: topY - 35, rx: 10, ry: 8 },
  ];
  for (const c of clumps) taper(ctx, bez(topX, topY + 14, (topX + c.x) / 2, topY + 6, c.x, c.y + 3, 5), 3.4, 1.4, ramp(TR_PINE, c.x < topX ? 0.45 : 0.2));
  for (const c of clumps) {
    const cl = crownClumps(rand, c.x, c.y, c.rx, c.ry, { rBase: 5.8, ring: 7, inner: 2, top: 2, fringe: 3 });
    paintCrown(ctx, rand, cl, c.x, c.y, c.rx, c.ry, () => spec, { density: 0.9, sparkles: 4 });
  }
  lightPass(ctx, topX - 30, topY - 46, 60, 66, 0.12, 0.2);
  finish(S, OUTLINE_LEAF, [
    [ax + 18, ay + 3, 30, 10, 0.28],
    [ax + 1, ay + 1.5, 9, 3.4, 0.34],
  ]);
  baseTufts(S, rand, ax, ay, p.tw * 0.9 + 3, 6);
}

// ------------------------------------------------------------------ definitions
// def(family, L, T, R, B, drawFn, params): L/R = canvas room left/right of the trunk base, T = room above, B = room below (shadow).
// Families (treeFamily()): 'oak','conifer','birch','young','poplar','pine','autumn','dead'.  The map generator picks variants uniformly
// (variant % treeVariantCount()), so the common forest trees (oaks, conifers, birches) are the large majority and the oddballs are ~3% each.
const DEFS = [];
function def(fam, L, T, Rr, B, draw, p) { DEFS.push({ fam, w: L + Rr, h: T + B, ax: L, ay: T, draw, p }); }

// --- 0-9 oaks (broad crowns), large -> small, varied hue / silhouette
def('oak', 40, 101, 47, 19, drawBroadleaf, { seed: 101, spec: FOL_OAK, trunk: TR_OAK, rx: 33, ry: 27, cy: 62, trunkH: 36, tw: 11, lean: -2, ring: 11, inner: 7, top: 5, flare: 1.0, irr: 0.13, lumps: [{ a: 0.35, d: 0.98, r: 0.8 }], limbs: [{ side: -1, t: 0.7, len: 17, rise: 9, r: 7.5 }] });
def('oak', 45, 92, 48, 19, drawBroadleaf, { seed: 202, spec: FOL_OAK_Y, trunk: TR_OAK, rx: 34, ry: 24, cy: 58, trunkH: 33, tw: 11.5, lean: 2, dx: 1, ring: 11, inner: 7, top: 6, flare: 1.0, irr: 0.16, flat: 0.8 });
def('oak', 40, 103, 45, 19, drawBroadleaf, { seed: 303, spec: FOL_OAK_B, trunk: tint(TR_OAK, 8, -10, 2), rx: 29, ry: 30, cy: 64, trunkH: 38, tw: 10, lean: 1, dx: -1, ring: 10, inner: 8, top: 6, flare: 0.9, irr: 0.12 });
def('oak', 39, 96, 43, 19, drawBroadleaf, { seed: 404, spec: FOL_OAK, trunk: tint(TR_OAK, -4, 6, -2), rx: 26, ry: 24, cy: 62, trunkH: 40, tw: 9, lean: -3, dx: -2, ring: 9, inner: 6, top: 5, flare: 0.9, irr: 0.18, lumps: [{ a: 2.7, d: 1.0, r: 0.85 }, { a: 0.4, d: 0.95, r: 0.7 }], limbs: [{ side: 1, t: 0.66, len: 18, rise: 8, r: 7 }] });
def('oak', 46, 87, 49, 19, drawBroadleaf, { seed: 505, spec: FOL_OAK_Y, trunk: tint(TR_OAK, 4, -6, 4), rx: 37, ry: 22, cy: 54, trunkH: 30, tw: 12, lean: 0, ring: 12, inner: 8, top: 6, flare: 1.1, irr: 0.14, flat: 0.8 });
def('oak', 32, 78, 39, 17, drawBroadleaf, { seed: 606, spec: FOL_OAK_B, trunk: TR_OAK, rx: 23, ry: 20, cy: 50, trunkH: 28, tw: 7.5, lean: 2, ring: 9, inner: 5, top: 5, flare: 0.8, irr: 0.15, fringe: 4 });
def('oak', 36, 97, 45, 19, drawBroadleaf, { seed: 707, spec: tint(FOL_OAK_Y, 6, -4, -3), trunk: tint(TR_OAK, 2, -4, 0), rx: 30, ry: 26, cy: 60, trunkH: 36, tw: 10, lean: -2, dx: 1, ring: 10, inner: 7, top: 5, flare: 1.0, irr: 0.15, limbs: [{ side: 1, t: 0.72, len: 16, rise: 8, r: 7 }] });
def('oak', 36, 101, 40, 18, drawBroadleaf, { seed: 808, spec: tint(FOL_OAK, 6, 0, -2), trunk: tint(TR_OAK, -6, 4, -2), rx: 24, ry: 28, cy: 66, trunkH: 40, tw: 8.5, lean: 2, ring: 9, inner: 7, top: 5, flare: 0.9, irr: 0.14, lumps: [{ a: 3.4, d: 1.0, r: 0.8 }] });
def('oak', 47, 81, 54, 19, drawBroadleaf, { seed: 909, spec: FOL_OAK, trunk: TR_OAK, rx: 38, ry: 21, cy: 52, trunkH: 28, tw: 12, lean: 1, ring: 12, inner: 8, top: 5, flare: 1.1, irr: 0.17, flat: 0.78, limbs: [{ side: -1, t: 0.74, len: 20, rise: 7, r: 7.5 }, { side: 1, t: 0.6, len: 19, rise: 6, r: 7 }] });
def('oak', 35, 87, 41, 17, drawBroadleaf, { seed: 1010, spec: tint(FOL_OAK_B, -6, 4, 2), trunk: tint(TR_OAK, 6, -8, 2), rx: 25, ry: 23, cy: 56, trunkH: 33, tw: 8, lean: -2, ring: 9, inner: 6, top: 5, flare: 0.8, irr: 0.15, fringe: 4 });
// --- 10-18 conifers (stacked tiers of drooping boughs): dark blue-green spruce and warmer fir
def('conifer', 35, 106, 42, 19, drawConifer, { seed: 611, spec: FOL_SPRUCE, trunk: TR_PINE, H: 100, W: 46, tiers: 6, trunkH: 9, tw: 7, firstFrac: 0.28, pow: 0.95, topW: 0.22, squash: 0.28, droop: 3, overlap: 0.3, light: 0.58, jit: 2, lean: 0 });
def('conifer', 30, 106, 40, 19, drawConifer, { seed: 722, spec: FOL_PINE, trunk: TR_PINE, H: 100, W: 40, tiers: 7, trunkH: 10, tw: 6.5, firstFrac: 0.25, pow: 0.9, topW: 0.2, squash: 0.27, droop: 3, overlap: 0.32, light: 0.6, jit: 2.4, lean: 1 });
def('conifer', 37, 98, 45, 19, drawConifer, { seed: 833, spec: FOL_SPRUCE, trunk: TR_PINE, H: 92, W: 54, tiers: 5, trunkH: 8, tw: 7.5, firstFrac: 0.3, pow: 1.0, topW: 0.24, squash: 0.3, droop: 3.6, overlap: 0.3, light: 0.56, jit: 2, lean: -1 });
def('conifer', 36, 102, 42, 19, drawConifer, { seed: 944, spec: FOL_PINE, trunk: TR_PINE, H: 96, W: 44, tiers: 6, trunkH: 9, tw: 7, firstFrac: 0.27, pow: 0.9, topW: 0.21, squash: 0.28, droop: 3, overlap: 0.34, light: 0.6, jit: 2, lean: -1 });
def('conifer', 30, 84, 37, 17, drawConifer, { seed: 1055, spec: FOL_SPRUCE, trunk: TR_PINE, H: 78, W: 36, tiers: 5, trunkH: 8, tw: 6, firstFrac: 0.27, pow: 0.95, topW: 0.22, squash: 0.27, droop: 2.6, overlap: 0.32, light: 0.6, jit: 1.6, lean: 1 });
def('conifer', 40, 92, 43, 18, drawConifer, { seed: 1166, spec: tint(FOL_PINE, 4, 2, 1), trunk: TR_PINE, H: 86, W: 52, tiers: 5, trunkH: 9, tw: 7.5, firstFrac: 0.3, pow: 0.95, topW: 0.25, squash: 0.3, droop: 3.4, overlap: 0.3, light: 0.6, jit: 2.2, lean: 1 });
def('conifer', 27, 110, 35, 17, drawConifer, { seed: 1277, spec: tint(FOL_SPRUCE, -2, 0, -1), trunk: TR_PINE, H: 104, W: 34, tiers: 7, trunkH: 9, tw: 6, firstFrac: 0.24, pow: 0.9, topW: 0.18, squash: 0.25, droop: 2.6, overlap: 0.34, light: 0.58, jit: 1.8, lean: -1 });
def('conifer', 30, 96, 40, 18, drawConifer, { seed: 1388, spec: tint(FOL_PINE, -4, 0, -2), trunk: TR_PINE, H: 90, W: 42, tiers: 6, trunkH: 8, tw: 7, firstFrac: 0.27, pow: 0.92, topW: 0.2, squash: 0.28, droop: 3.2, overlap: 0.33, light: 0.58, jit: 2.2, lean: 0 });
def('conifer', 24, 78, 33, 16, drawConifer, { seed: 1499, spec: FOL_PINE, trunk: TR_PINE, H: 72, W: 32, tiers: 4, trunkH: 7, tw: 5.5, firstFrac: 0.3, pow: 0.95, topW: 0.24, squash: 0.27, droop: 2.4, overlap: 0.3, light: 0.62, jit: 1.6, lean: -1 });
// --- 19-22 birches (white trunk, airy crown)
def('birch', 33, 99, 36, 16, drawBirch, { seed: 1011, spec: FOL_BIRCH, rx: 23, ry: 27, cy: 66, trunkH: 58, tw: 6.2, lean: 3, dx: 1 });
def('birch', 29, 90, 33, 15, drawBirch, { seed: 1122, spec: tint(FOL_BIRCH, -6, 0, 3), rx: 21, ry: 24, cy: 62, trunkH: 52, tw: 5.8, lean: -3, dx: -1 });
def('birch', 39, 93, 41, 17, drawBirch, { seed: 1133, spec: tint(FOL_BIRCH, 4, -2, -2), rx: 27, ry: 22, cy: 66, trunkH: 54, tw: 5.8, lean: 6, dx: 1, twin: true });
def('birch', 23, 84, 30, 14, drawBirch, { seed: 1144, spec: tint(FOL_BIRCH, -2, 2, 0), rx: 19, ry: 21, cy: 56, trunkH: 46, tw: 5.2, lean: 2, dx: 0 });
// --- 23-24 young broadleaf trees
def('young', 31, 75, 35, 15, drawBroadleaf, { seed: 1603, spec: FOL_YOUNG, trunk: TR_OAK, rx: 22, ry: 21, cy: 46, trunkH: 28, tw: 6, lean: 2, ring: 8, inner: 5, top: 4, flare: 0.5, fringe: 4 });
def('young', 29, 69, 33, 15, drawBroadleaf, { seed: 1614, spec: tint(FOL_YOUNG, -8, 0, -3), trunk: tint(TR_OAK, 4, -4, 2), rx: 19, ry: 19, cy: 43, trunkH: 27, tw: 5.2, lean: -2, ring: 8, inner: 4, top: 4, flare: 0.5, fringe: 4 });
// --- 25 columnar poplar, 26 stone pine (umbrella), 27 tall Scots pine
def('poplar', 25, 106, 29, 13, drawBroadleaf, { seed: 1502, spec: FOL_POPLAR, trunk: TR_POPLAR, rx: 15, ry: 38, cy: 62, trunkH: 36, tw: 6.2, lean: 1, ring: 11, inner: 7, top: 6, rBase: 9, fringe: 6, irr: 0.12 });
def('pine', 40, 91, 56, 17, drawStonePine, { seed: 1401, trunkH: 52, tw: 8, lean: 3 });
def('pine', 32, 110, 44, 17, drawScotsPine, { seed: 1704, trunkH: 58, tw: 7, lean: 3 });
// --- 28 autumn (mixed with greens so it blends into the forest), 29 dead tree
def('autumn', 42, 95, 48, 19, drawBroadleaf, { seed: 1201, spec: FOL_AUTUMN, specs: [FOL_AUTUMN_G, FOL_AUTUMN_O, FOL_AUTUMN_G, FOL_AUTUMN, FOL_AUTUMN_G, FOL_AUTUMN_G], trunk: TR_OAK, rx: 33, ry: 27, cy: 60, trunkH: 36, tw: 11, lean: 2, ring: 11, inner: 8, top: 7, flare: 1.0, lumps: [{ a: 2.5, d: 0.98, r: 0.8 }] });
def('dead', 24, 73, 44, 15, drawDead, { seed: 1301, trunkH: 34, tw: 11, lean: 3, H: 72 });

export const TREE_COUNT = DEFS.length;
export function treeFamily(i) {
  let k = (typeof i === 'number' ? i | 0 : 0) % DEFS.length; if (k < 0) k += DEFS.length;
  return DEFS[k].fam;
}

export function buildTree(i) {
  const d = DEFS[i];
  const S = makeCanvas(d.w, d.h);
  d.draw(S, d.ax, d.ay, d.p);
  return toSprite(S, d.ax, d.ay);
}
export function treeDef(i) { return DEFS[i]; }
