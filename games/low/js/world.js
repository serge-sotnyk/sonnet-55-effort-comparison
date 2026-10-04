'use strict';
// ---- world generation, entities, pathfinding, fog ----
let G = null, U = [], B = [], R = [];
const ix = (x, y) => y * N + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

function mkRng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mkNoise(rnd, sz = 64) {
  const w = sz + 2, g = new Float32Array(w * w);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    x = Math.max(0, Math.min(sz - .001, x)); y = Math.max(0, Math.min(sz - .001, y));
    const xi = x | 0, yi = y | 0; let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = g[yi * w + xi], b = g[yi * w + xi + 1], c = g[(yi + 1) * w + xi], d = g[(yi + 1) * w + xi + 1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
}

const BASES = [{ x: 15, y: 65 }, { x: 65, y: 15 }];

function genWorld(seed, diffKey) {
  const rnd = mkRng(seed);
  const nA = mkNoise(rnd), nB = mkNoise(rnd), nC = mkNoise(rnd), nD = mkNoise(rnd), nE = mkNoise(rnd), nF = mkNoise(rnd), nG = mkNoise(rnd);
  U = []; B = []; R = [];
  G = {
    seed, t: 0, nid: 1, diff: DIFF[diffKey] || DIFF.normal, diffKey, over: null,
    blk: new Uint8Array(N * N), occ: new Uint8Array(N * N), water: new Uint8Array(N * N),
    explored: new Uint8Array(N * N), vis: new Uint8Array(N * N),
    players: [], proj: [], parts: [], decals: [], fogDirty: true, rnd, noises: { nA, nB, nC, nD, nE, nF, nG },
    alerts: [], lastAlert: -99, frame: 0, speed: 1, hash: null,
  };
  for (let i = 0; i < 2; i++) {
    G.players.push({
      id: i, res: { f: 300, w: 250, g: 100, s: 100 }, age: 0, techs: {}, mod: {}, ai: null, name: i ? 'Enemy Kingdom' : 'Your Kingdom',
      stats: { kills: 0, lost: 0, gathered: 0, built: 0, trained: 0 }, ageUp: null,
    });
  }
  // symmetric water field
  const wf1 = (x, y) => .65 * nA(x / 16, y / 16) + .35 * nB(x / 7, y / 7);
  const waterF = (x, y) => {
    let v = (wf1(x, y) + wf1(N - x, N - y)) / 2;
    for (const b of BASES) { const d = Math.hypot(x - b.x, y - b.y); if (d < 21) v -= (21 - d) * .07; }
    return v;
  };
  const vals = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) vals.push(waterF(x + .5, y + .5));
  const sorted = vals.slice().sort((a, b) => a - b);
  G.thr = sorted[Math.floor(sorted.length * .9)];
  G.waterF = waterF;
  for (let i = 0; i < N * N; i++) if (vals[i] > G.thr) { G.water[i] = 1; G.blk[i] = 1; }

  // bases
  for (let i = 0; i < 2; i++) {
    const c = BASES[i], bx = c.x - 2, by = c.y - 2;
    mkBld('tc', i, bx, by, true);
    const o = [[-2.5, 3.5], [-.5, 3.7], [1.5, 3.5], [3.5, 3]];
    for (let k = 0; k < 4; k++) { const sg = i ? -1 : 1; mkUnit('villager', i, c.x + o[k][0] * sg + (i ? 0 : 0), c.y + (o[k][1] - 1) * -sg + (i ? 0 : 0)); }
    mkUnit('scout', i, c.x + (i ? -4 : 4), c.y + (i ? 1 : -1));
  }
  const free = (x, y) => inb(x, y) && !G.blk[ix(x, y)] && !G.occ[ix(x, y)];
  const nearTC = (x, y) => BASES.some(b => Math.abs(x - b.x) <= 3.5 && Math.abs(y - b.y) <= 3.5);
  function cluster(cx, cy, k, jit, rad) {
    const c = [];
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (free(x, y) && !nearTC(x, y)) c.push({ x, y, s: Math.hypot(dx, dy) + rnd() * jit });
    }
    c.sort((a, b) => a.s - b.s);
    return c.slice(0, k);
  }
  const layout = [['berry', -6, -6, 6, 1.2, 4], ['gold', 9, -3, 4, 1, 4], ['stone', -2, -10, 3, 1, 4], ['tree', -9, 8, 36, 4, 8], ['tree', 9, 8, 30, 4, 8], ['tree', -10, -13, 30, 4, 8], ['tree', 12, -12, 22, 4, 8]];
  for (let i = 0; i < 2; i++) {
    const c = BASES[i], sg = i ? -1 : 1;
    for (const [t, dx, dy, k, jit, rad] of layout)
      for (const p of cluster(c.x + dx * sg, c.y + dy * sg, k, jit, rad)) mkRes(t, p.x, p.y);
  }
  // global forests (symmetric)
  const ff1 = (x, y) => .6 * nC(x / 9, y / 9) + .4 * nD(x / 4, y / 4);
  const ff = (x, y) => (ff1(x, y) + ff1(N - x, N - y)) / 2;
  const fv = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fv.push(ff(x + .5, y + .5));
  const fs = fv.slice().sort((a, b) => a - b), fthr = fs[Math.floor(fs.length * .74)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (fv[ix(x, y)] > fthr && free(x, y) && !nearTC(x, y) && BASES.every(b => Math.hypot(x - b.x, y - b.y) > 10) && rnd() < .8) mkRes('tree', x, y);
  }
  // contested gold / stone
  const mids = [[40, 40, 'gold', 5], [28, 40, 'gold', 4], [40, 22, 'stone', 3], [52, 58, 'gold', 4], [22, 24, 'stone', 3]];
  for (const [mx, my, t, k] of mids) {
    for (const p of cluster(mx, my, k, 1, 5)) mkRes(t, p.x, p.y);
    if (mx !== 40 || my !== 40) for (const p of cluster(N - mx, N - my, k, 1, 5)) mkRes(t, p.x, p.y);
  }
  // loose berries (symmetric pair)
  for (const p of cluster(30, 62, 5, 1, 5)) mkRes('berry', p.x, p.y);
  for (const p of cluster(N - 30, N - 62, 5, 1, 5)) mkRes('berry', p.x, p.y);

  // connectivity between bases
  const seen = new Uint8Array(N * N), q = [ix(BASES[0].x + 3, BASES[0].y)]; seen[q[0]] = 1;
  const goal = ix(BASES[1].x - 3, BASES[1].y);
  for (let h = 0; h < q.length; h++) {
    const n = q[h], x = n % N, y = (n / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = x + dx, b = y + dy; if (!inb(a, b)) continue; const m = ix(a, b);
      if (!seen[m] && !G.blk[m]) { seen[m] = 1; q.push(m); }
    }
  }
  if (!seen[goal]) return false;
  // make sure each base's resources are reachable, drop unreachable ones
  for (const r of R) { let ok = false; for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1; dx++) { const a = r.tx + dx, b = r.ty + dy; if (inb(a, b) && seen[ix(a, b)]) { ok = true; break; } } if (!ok) killRes(r); }
  R = R.filter(r => !r.dead);
  updateVis();
  return true;
}

function newGame(seed, diffKey) {
  for (let a = 0; a < 20; a++) if (genWorld(seed + a * 7919, diffKey)) break;
  G.players[1].ai = { t: 0, army: [], wave: 0, waveOn: false, lastWave: 0, rally: null, last: {}, bad: {} };
  return G;
}

// ---- stats ----
function tierOf(p, kind) { const l = UPG[kind]; if (!l) return 0; let t = 0; for (const id of l) if (p.techs[id]) t++; return t; }
function statsFor(p, kind) {
  const d = UNITS[kind], t = tierOf(p, kind), i = d.inc || {}, m = p.mod, g = k => m[k] || 0;
  const s = {
    name: d.tiers ? d.tiers[t] : d.n, hp: d.hp + (i.hp || 0) * t, atk: d.atk + (i.atk || 0) * t, aM: d.aM + (i.aM || 0) * t, aP: d.aP + (i.aP || 0) * t,
    rng: d.rng + (i.rng || 0) * t, spd: d.spd, rof: d.rof, bonus: Object.assign({}, d.bonus || {}), splash: d.splash || 0, cap: 10, t: d.t, tier: t,
  };
  if (d.bonus && d.bonus.cav) s.bonus.cav += (i.bonus || 0) * t;
  if (d.cls === 'vil') { s.hp += g('vilHp'); s.aP += g('vilArmP'); s.spd *= 1 + g('vilSpeed'); s.cap += g('vilCarry'); }
  if (d.cls === 'inf' || d.cls === 'cav') { s.atk += g('atkMelee'); s.aM += g('armMelee'); }
  if (d.cls === 'arch') { s.atk += g('atkRanged'); s.rng += g('rngBonus'); }
  if (d.cls !== 'vil' && d.cls !== 'siege') s.aP += g('armPierce');
  return s;
}
function calcStats(u, init) {
  const s = statsFor(G.players[u.owner], u.kind), old = init ? 0 : u.maxhp;
  u.st = s; u.maxhp = s.hp; if (init) u.hp = s.hp; else u.hp += s.hp - old;
}
function refreshStats(pid) { for (const u of U) if (u.owner === pid && !u.dead) calcStats(u, false); }
function farmAmt(pid) { return 250 + (G.players[pid].mod.farmAmt || 0); }

// ---- entity factories ----
function mkUnit(kind, owner, x, y) {
  const u = { id: G.nid++, type: 'unit', kind, def: UNITS[kind], cls: UNITS[kind].cls, owner, x, y, ord: 'idle', tgt: null, path: null, pi: 0, cd: 0, carry: 0, ct: '', ph: '', anim: Math.random() * 6, fx: 1, flash: 0, dead: false, bad: null, st: null, stuck: 0, mx: x, my: y, mt: 0, rp: 0, dest: null, goal: null, bq: null, home: null, act: '', lunge: 0, think: Math.random() };
  calcStats(u, true); U.push(u); return u;
}
function mkBld(kind, owner, bx, by, done) {
  const d = BLDS[kind];
  const b = { id: G.nid++, type: 'bld', kind, def: d, cls: 'bld', owner, bx, by, s: d.size, x: bx + d.size / 2, y: by + d.size / 2, hp: done ? d.hp : d.hp * .1, maxhp: d.hp, done, prog: done ? 1 : 0, bAcc: 0, q: [], rally: null, cd: 0, flash: 0, dead: false, aM: d.aM, aP: d.aP, fire: 0 };
  if (kind === 'farm') { b.rt = 'f'; b.amt = farmAmt(owner); b.worker = null; }
  for (let y = by; y < by + d.size; y++) for (let x = bx; x < bx + d.size; x++) { G.occ[ix(x, y)] = 1; if (!d.flat) G.blk[ix(x, y)] = 1; }
  B.push(b); return b;
}
const RESDEF = { tree: ['w', 100], berry: ['f', 200], gold: ['g', 700], stone: ['s', 450] };
function mkRes(kind, tx, ty) {
  const [rt, amt] = RESDEF[kind];
  const r = { id: G.nid++, type: 'res', kind, rt, tx, ty, x: tx + .5, y: ty + .5, amt: kind === 'tree' ? amt - 20 + ((tx * 7 + ty * 13) % 5) * 10 : amt, dead: false, v: (tx * 31 + ty * 17) % 5, cls: 'res', ox: ((tx * 13 + ty * 7) % 7 - 3) * .05, oy: ((tx * 5 + ty * 11) % 7 - 3) * .05 };
  r.max = r.amt;
  G.occ[ix(tx, ty)] = 1; G.blk[ix(tx, ty)] = 1; R.push(r); return r;
}
function killRes(r) { if (r.dead) return; r.dead = true; G.occ[ix(r.tx, r.ty)] = 0; G.blk[ix(r.tx, r.ty)] = 0; }

function canPlace(kind, bx, by, pid, ignoreFog) {
  const s = BLDS[kind].size;
  if (bx < 0 || by < 0 || bx + s > N || by + s > N) return false;
  for (let y = by; y < by + s; y++) for (let x = bx; x < bx + s; x++) {
    const i = ix(x, y);
    if (G.occ[i] || G.water[i]) return false;
    if (!ignoreFog && pid === 0 && !G.explored[i]) return false;
  }
  return true;
}
function evict(b) {
  for (const u of U) if (!u.dead && u.x >= b.bx && u.x < b.bx + b.s && u.y >= b.by && u.y < b.by + b.s) {
    const t = nearestFree(u.x, u.y, 8, b); if (t) { u.x = t.x; u.y = t.y; u.path = null; if (u.ord === 'move') u.ord = 'idle'; }
  }
}
function nearestFree(x, y, maxr, avoid) {
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let r = 0; r <= maxr; r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const a = cx + dx, b = cy + dy; if (!inb(a, b) || G.blk[ix(a, b)]) continue;
      if (avoid && a >= avoid.bx - 0 && a < avoid.bx + avoid.s && b >= avoid.by && b < avoid.by + avoid.s) continue;
      const d = Math.hypot(a + .5 - x, b + .5 - y); if (d < bd) { bd = d; best = { x: a + .5, y: b + .5 }; }
    }
    if (best) return best;
  }
  return null;
}

// ---- economy helpers ----
const canAfford = (p, c) => { for (const k in c) if ((p.res[k] || 0) < c[k]) return false; return true; };
const pay = (p, c) => { for (const k in c) p.res[k] -= c[k]; };
const refund = (p, c) => { for (const k in c) p.res[k] += c[k]; };
function popInfo(p) {
  let used = 0, cap = 0;
  for (const u of U) if (u.owner === p.id && !u.dead) used += u.def.pop;
  for (const b of B) if (b.owner === p.id && !b.dead) { for (const q of b.q) if (q.kind) used += UNITS[q.kind].pop; if (b.done) cap += b.def.pop || 0; }
  return { used, cap: Math.min(cap, MAXPOP) };
}

// ---- pathfinding (A* on tile grid, goal is a rect) ----
const PF = { g: new Float32Array(N * N), par: new Int32Array(N * N), seen: new Uint32Array(N * N), closed: new Uint32Array(N * N), gen: 0, hf: [], hn: [] };
function hpush(f, n) {
  const hf = PF.hf, hn = PF.hn; let i = hf.length; hf.push(f); hn.push(n);
  while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hf[i] = hf[p]; hn[i] = hn[p]; i = p; }
  hf[i] = f; hn[i] = n;
}
function hpop() {
  const hf = PF.hf, hn = PF.hn, top = hn[0], lf = hf.pop(), ln = hn.pop(), L = hf.length;
  if (L > 0) {
    let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= L) break; if (c + 1 < L && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; hf[i] = hf[c]; hn[i] = hn[c]; i = c; }
    hf[i] = lf; hn[i] = ln;
  }
  return top;
}
function losClear(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / .3);
  const px = -dy / (d || 1) * .22, py = dx / (d || 1) * .22;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = x0 + dx * t, y = y0 + dy * t;
    if (blockedAt(x, y) || blockedAt(x + px, y + py) || blockedAt(x - px, y - py)) return false;
  }
  return true;
}
function blockedAt(x, y) { const a = Math.floor(x), b = Math.floor(y); return a < 0 || b < 0 || a >= N || b >= N || G.blk[b * N + a] === 1; }
function findPath(sx, sy, gx0, gy0, gx1, gy1, ex, ey) {
  const blk = G.blk, s0 = Math.max(0, Math.min(N - 1, Math.floor(sx))), s1 = Math.max(0, Math.min(N - 1, Math.floor(sy)));
  gx0 = Math.max(0, gx0); gy0 = Math.max(0, gy0); gx1 = Math.min(N - 1, gx1); gy1 = Math.min(N - 1, gy1);
  const start = s1 * N + s0, gen = ++PF.gen;
  const inGoal = (x, y) => x >= gx0 && x <= gx1 && y >= gy0 && y <= gy1 && !blk[y * N + x];
  if (inGoal(s0, s1)) return ex !== undefined ? [{ x: ex, y: ey }] : [];
  const H = (x, y) => { const dx = Math.max(gx0 - x, 0, x - gx1), dy = Math.max(gy0 - y, 0, y - gy1); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
  PF.hf.length = 0; PF.hn.length = 0;
  PF.g[start] = 0; PF.seen[start] = gen; PF.par[start] = -1; hpush(H(s0, s1), start);
  let found = -1, it = 0;
  while (PF.hf.length && it++ < 9000) {
    const n = hpop(); if (PF.closed[n] === gen) continue; PF.closed[n] = gen;
    const x = n % N, y = (n / N) | 0;
    if (inGoal(x, y)) { found = n; break; }
    const gn = PF.g[n];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const m = b * N + a; if (blk[m] || PF.closed[m] === gen) continue;
      if (dx && dy && (blk[y * N + a] || blk[b * N + x])) continue;
      const ng = gn + (dx && dy ? 1.414 : 1);
      if (PF.seen[m] !== gen || ng < PF.g[m]) { PF.seen[m] = gen; PF.g[m] = ng; PF.par[m] = n; hpush(ng + H(a, b), m); }
    }
  }
  if (found < 0) return null;
  const pts = [];
  for (let n = found; n !== start && n >= 0; n = PF.par[n]) pts.push({ x: (n % N) + .5, y: ((n / N) | 0) + .5 });
  pts.reverse();
  if (ex !== undefined && pts.length) { const l = pts[pts.length - 1]; if (Math.floor(ex) === Math.floor(l.x) && Math.floor(ey) === Math.floor(l.y)) { l.x = ex; l.y = ey; } }
  // string pulling
  const out = []; let cx = sx, cy = sy, i = 0;
  while (i < pts.length) {
    let j = Math.min(pts.length - 1, i + 14);
    while (j > i && !losClear(cx, cy, pts[j].x, pts[j].y)) j--;
    out.push(pts[j]); cx = pts[j].x; cy = pts[j].y; i = j + 1;
  }
  return out;
}

// ---- fog of war ----
function updateVis() {
  const vis = G.vis, ex = G.explored; vis.fill(0);
  const rev = (e, r) => {
    const cx = e.x, cy = e.y, r2 = r * r, x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(N - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(N - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + .5 - cx, dy = y + .5 - cy; if (dx * dx + dy * dy <= r2) { vis[y * N + x] = 1; ex[y * N + x] = 1; } }
  };
  for (const u of U) if (u.owner === 0 && !u.dead) rev(u, u.def.los);
  for (const b of B) if (b.owner === 0 && !b.dead) rev(b, b.def.los + b.s / 2);
  G.fogDirty = true;
}
const visAt = (x, y) => { const a = Math.floor(x), b = Math.floor(y); return a >= 0 && b >= 0 && a < N && b < N && G.vis[b * N + a] === 1; };
const expAt = (x, y) => { const a = Math.floor(x), b = Math.floor(y); return a >= 0 && b >= 0 && a < N && b < N && G.explored[b * N + a] === 1; };
