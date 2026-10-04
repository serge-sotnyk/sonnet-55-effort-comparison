'use strict';
// ---------------------------------------------------------------------------
// Map: terrain, occupancy, A* pathfinding, fog of war, procedural generation
// ---------------------------------------------------------------------------
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

class GameMap {
  constructor(n) {
    this.w = n; this.h = n;
    const N = n * n;
    this.terrain = new Uint8Array(N);      // 0 land, 1 water
    this.occ = new Int32Array(N);          // entity id occupying the tile (any object)
    this.block = new Uint8Array(N);        // blocks movement
    this.gate = new Int8Array(N);          // owner+1 for gates
    this.tree = new Uint8Array(N);         // 1 where a tree stands (for forest-cutting paths)
    this.vis = new Uint8Array(N);          // 0 unexplored 1 explored 2 visible (human player)
    this.forestF = new Float32Array(N);    // visual: forest floor density
    this.dirtF = new Float32Array(N);      // visual: dirt density
    // pathfinding scratch
    this.gScore = new Float32Array(N);
    this.parent = new Int32Array(N);
    this.stamp = new Uint32Array(N);
    this.curStamp = 0;
    this.heap = new Heap(4096);
    this.pathStats = { calls: 0, nodes: 0 };
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  idx(x, y) { return y * this.w + x; }
  passable(x, y, team) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const i = y * this.w + x;
    if (this.terrain[i] !== 0) return false;
    return this.block[i] === 0 || this.gate[i] === team + 1;
  }
  passableAt(px, py, team) { return this.passable(Math.floor(px), Math.floor(py), team); }
  isWater(x, y) { return !this.inb(x, y) || this.terrain[y * this.w + x] === 1; }
  buildable(x, y) {
    if (!this.inb(x, y)) return false;
    const i = y * this.w + x;
    return this.terrain[i] === 0 && this.occ[i] === 0;
  }

  // Is the straight segment free for a small body?
  lineClear(x0, y0, x1, y1, team) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return true;
    const steps = Math.ceil(len / 0.3);
    const sx = dx / steps, sy = dy / steps;
    const px = -dy / len * 0.22, py = dx / len * 0.22;
    for (let i = 1; i <= steps; i++) {
      const x = x0 + sx * i, y = y0 + sy * i;
      if (!this.passableAt(x, y, team)) return false;
      if (!this.passableAt(x + px, y + py, team)) return false;
      if (!this.passableAt(x - px, y - py, team)) return false;
    }
    return true;
  }

  // A* to a goal "within r of the rectangle". Returns {path:[[x,y]...], partial}
  findPath(sx, sy, rx0, ry0, rx1, ry1, r, team, maxExp = 60000, treeOk = false) {
    const W = this.w, H = this.h;
    const stx = clamp(Math.floor(sx), 0, W - 1), sty = clamp(Math.floor(sy), 0, H - 1);
    const goalTile = (tx, ty) => distToRect(tx + 0.5, ty + 0.5, rx0, ry0, rx1, ry1) <= r + 1e-6;
    const hFn = (tx, ty) => {
      const cx = tx + 0.5, cy = ty + 0.5;
      const dx = Math.max(rx0 - cx, 0, cx - rx1), dy = Math.max(ry0 - cy, 0, cy - ry1);
      const mx = Math.max(dx, dy), mn = Math.min(dx, dy);
      return Math.max(0, mx + 0.414 * mn - r * 1.2);
    };
    this.pathStats.calls++;
    const stamp = ++this.curStamp;
    const heap = this.heap; heap.clear();
    const g = this.gScore, par = this.parent, st = this.stamp;
    const si = sty * W + stx;
    g[si] = 0; par[si] = -1; st[si] = stamp;
    heap.push(hFn(stx, sty), si);
    let best = si, bestH = hFn(stx, sty), goal = -1, exp = 0;
    const closed = this._closed || (this._closed = new Uint32Array(W * H));
    while (heap.n > 0) {
      const cur = heap.pop();
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      const cx = cur % W, cy = (cur / W) | 0;
      if (goalTile(cx, cy)) { goal = cur; break; }
      if (++exp > maxExp) break;
      const gc = g[cur];
      for (let k = 0; k < 8; k++) {
        const nx = cx + NB8[k][0], ny = cy + NB8[k][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (closed[ni] === stamp) continue;
        const isTree = treeOk && this.tree[ni] === 1 && this.terrain[ni] === 0;
        if (!isTree && !this.passable(nx, ny, team)) continue;
        let cost = isTree ? 9 : 1;
        if (k >= 4) {
          const o1 = this.passable(cx + NB8[k][0], cy, team) || (treeOk && this.tree[cy * W + cx + NB8[k][0]] === 1);
          const o2 = this.passable(cx, cy + NB8[k][1], team) || (treeOk && this.tree[(cy + NB8[k][1]) * W + cx] === 1);
          if (!o1 || !o2) continue;
          cost *= 1.4142;
        }
        const ng = gc + cost;
        if (st[ni] !== stamp || ng < g[ni]) {
          st[ni] = stamp; g[ni] = ng; par[ni] = cur;
          const h = hFn(nx, ny);
          heap.push(ng + h, ni);
          if (h < bestH) { bestH = h; best = ni; }
        }
      }
    }
    this.pathStats.nodes += exp;
    const partial = goal < 0;
    let end = partial ? best : goal;
    const pts = [];
    for (let i = end; i !== -1; i = par[i]) pts.push([(i % W) + 0.5, ((i / W) | 0) + 0.5]);
    pts.reverse();
    if (treeOk) return { path: pts, partial };
    // string-pull smoothing (greedy)
    const out = [];
    let a = 0;
    pts[0] = [sx, sy];
    while (a < pts.length - 1) {
      let b = a + 1;
      while (b + 1 < pts.length && this.lineClear(pts[a][0], pts[a][1], pts[b + 1][0], pts[b + 1][1], team)) b++;
      out.push(pts[b]);
      a = b;
    }
    return { path: out, partial };
  }

  // nearest passable, unoccupied tile around (x,y)
  findFreeNear(x, y, maxR = 12, team = -1, allowOcc = false) {
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let r = 0; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = cx + dx, ty = cy + dy;
          if (!this.passable(tx, ty, team)) continue;
          if (!allowOcc && this.occ[ty * this.w + tx] !== 0) continue;
          const d = (tx + 0.5 - x) ** 2 + (ty + 0.5 - y) ** 2;
          if (d < bd) { bd = d; best = [tx + 0.5, ty + 0.5]; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // flood fill reachability over land (ignoring objects)
  reachable(x0, y0, x1, y1) {
    const W = this.w, seen = new Uint8Array(W * this.h);
    const q = [y0 * W + x0]; seen[q[0]] = 1;
    const target = y1 * W + x1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      if (c === target) return true;
      const cx = c % W, cy = (c / W) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + NB8[k][0], ny = cy + NB8[k][1];
        if (!this.inb(nx, ny)) continue;
        const ni = ny * W + nx;
        if (seen[ni] || this.terrain[ni] !== 0) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    return false;
  }

  // Fog of war: recompute visibility given a list of {x,y,r}
  updateVision(sources, explorePrev = true) {
    const vis = this.vis, W = this.w, H = this.h;
    for (let i = 0; i < vis.length; i++) if (vis[i] === 2) vis[i] = 1;
    for (const s of sources) {
      const r = s.r, r2 = r * r;
      const cx = Math.floor(s.x), cy = Math.floor(s.y);
      const x0 = Math.max(0, cx - Math.ceil(r)), x1 = Math.min(W - 1, cx + Math.ceil(r));
      const y0 = Math.max(0, cy - Math.ceil(r)), y1 = Math.min(H - 1, cy + Math.ceil(r));
      for (let y = y0; y <= y1; y++) {
        const dy = y + 0.5 - s.y;
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - s.x;
          if (dx * dx + dy * dy <= r2) vis[y * W + x] = 2;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Procedural generation (point-symmetric so both sides are fair)
// ---------------------------------------------------------------------------
const MAP_STYLES = {
  mixed: { lakes: [2, 3], rad: [0.045, 0.085], ft: 0.585 },
  forest: { lakes: [1, 2], rad: [0.04, 0.07], ft: 0.505 },
  lakes: { lakes: [4, 6], rad: [0.05, 0.095], ft: 0.62 },
  open: { lakes: [1, 2], rad: [0.04, 0.07], ft: 0.72 },
};
function generateMap(n, seed, humanSide, styleId) {
  MAPRNG = mulberry32(seed);
  const ST = MAP_STYLES[styleId] || MAP_STYLES.mixed;
  const map = new GameMap(n);
  const N = n;
  const noise = new Noise(seed * 7 + 3);
  const mir = (x, y) => [N - 1 - x, N - 1 - y];
  const spawns = []; // {kind, x, y, ...}

  // Base positions (point-symmetric)
  const b0 = [Math.round(N * 0.2), Math.round(N * 0.8)];
  const b1 = mir(b0[0], b0[1]);
  const bases = humanSide === 0 ? [b0, b1] : [b1, b0];

  // --- water -----------------------------------------------------------
  const tryLakes = (count) => {
    map.terrain.fill(0);
    for (let i = 0; i < count; i++) {
      const cx = rr(0.12, 0.88) * N, cy = rr(0.12, 0.88) * N;
      const rad = rr(ST.rad[0], ST.rad[1]) * N;
      const ox = rr(0, 100), oy = rr(0, 100);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - cx, y - cy);
        const nz = noise.fbm(x * 0.18 + ox, y * 0.18 + oy, 3);
        if (d < rad * (0.65 + nz * 0.8)) {
          map.terrain[y * N + x] = 1;
          const [mx, my] = mir(x, y); map.terrain[my * N + mx] = 1;
        }
      }
    }
    // keep bases clear
    for (const b of [b0, b1]) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (Math.hypot(x - b[0], y - b[1]) < N * 0.2) map.terrain[y * N + x] = 0;
      }
    }
  };
  let lakes = ri(ST.lakes[0], ST.lakes[1]);
  for (let tries = 0; tries < 8; tries++) {
    tryLakes(lakes);
    if (map.reachable(b0[0], b0[1], b1[0], b1[1])) break;
    lakes = Math.max(0, lakes - 1);
    if (tries === 7) map.terrain.fill(0);
  }

  const occupied = new Uint8Array(N * N); // layout reservation
  const landOk = (x, y) => x >= 2 && y >= 2 && x < N - 2 && y < N - 2 && map.terrain[y * N + x] === 0 && !occupied[y * N + x];
  const place = (kind, x, y, extra) => {
    if (!landOk(x, y)) return false;
    occupied[y * N + x] = 1;
    spawns.push(Object.assign({ kind, x, y }, extra || {}));
    const [mx, my] = mir(x, y);
    if (!(mx === x && my === y) && landOk(mx, my)) {
      occupied[my * N + mx] = 1;
      spawns.push(Object.assign({ kind, x: mx, y: my }, extra || {}));
    }
    return true;
  };
  // symmetric placement for player-relative layout: place for b0 and the mirrored for b1 (explicitly)
  const placeRel = (kind, rx, ry, extra) => {
    const x = b0[0] + rx, y = b0[1] + ry;
    if (!landOk(x, y)) return false;
    const [mx, my] = mir(x, y);
    if (!landOk(mx, my)) return false;
    occupied[y * N + x] = 1; occupied[my * N + mx] = 1;
    spawns.push(Object.assign({ kind, x, y }, extra || {}));
    spawns.push(Object.assign({ kind, x: mx, y: my }, extra || {}));
    return true;
  };
  // reserve TC area
  for (const b of [b0, b1]) {
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = b[0] + dx, y = b[1] + dy;
      if (map.inb(x, y)) occupied[y * N + x] = 1;
    }
  }
  const unreserveTC = () => {};

  const cluster = (kind, cx, cy, count, spread, extra, rel = true) => {
    let placed = 0, guard = 0;
    while (placed < count && guard++ < 300) {
      const ang = rr(0, TAU), d = rr(0, spread) * (0.6 + 0.4 * placed / count);
      const x = Math.round(cx + Math.cos(ang) * d), y = Math.round(cy + Math.sin(ang) * d);
      const ok = rel ? placeRel(kind, x - b0[0], y - b0[1], extra) : place(kind, x, y, extra);
      if (ok) placed++;
    }
    return placed;
  };
  // temporarily release the TC reservation outside radius 6 for resources: we reserved radius 6 only
  const polar = (a, d) => [b0[0] + Math.cos(a) * d, b0[1] + Math.sin(a) * d];

  // --- starting resources around the base -------------------------------
  // Directions point mostly away from the map edge toward the centre so layout is reachable
  const toCenter = Math.atan2(N / 2 - b0[1], N / 2 - b0[0]);
  const angs = [];
  const baseA = rr(0, TAU);
  for (let i = 0; i < 6; i++) angs.push(baseA + i * TAU / 6 + rr(-0.15, 0.15));
  // shuffle
  for (let i = angs.length - 1; i > 0; i--) { const j = Math.floor(MAPRNG() * (i + 1)); [angs[i], angs[j]] = [angs[j], angs[i]]; }
  let [px, py] = polar(angs[0], 9); cluster('berries', px, py, 6, 2.2, { amount: 200 });
  [px, py] = polar(angs[1], 12); cluster('gold', px, py, 6, 2.6, { amount: 600 });
  [px, py] = polar(angs[2], 12); cluster('stone', px, py, 5, 2.4, { amount: 400 });
  [px, py] = polar(angs[3], 11); cluster('deer', px, py, 4, 3.5, {});
  [px, py] = polar(angs[4], 10); cluster('tree', px, py, 36, 4.0, {});
  [px, py] = polar(angs[5], 12); cluster('tree', px, py, 42, 4.5, {});
  // second forest + another deer herd
  [px, py] = polar(angs[0] + 0.9, 17); cluster('tree', px, py, 50, 5, {});
  [px, py] = polar(angs[3] + 0.8, 18); cluster('deer', px, py, 4, 4, {});
  [px, py] = polar(angs[2] + 1.0, 20); cluster('boar', px, py, 2, 2, {});
  // more far resources
  [px, py] = polar(toCenter + rr(-0.6, 0.6), N * 0.3); cluster('gold', px, py, 5, 2.4, { amount: 600 });
  [px, py] = polar(toCenter + rr(-1.0, 1.0), N * 0.27); cluster('stone', px, py, 4, 2.2, { amount: 400 });
  [px, py] = polar(toCenter + rr(-1.2, 1.2), N * 0.32); cluster('berries', px, py, 5, 2.2, { amount: 200 });

  // neutral central resources
  for (let k = 0; k < 3; k++) {
    const x = Math.round(rr(0.3, 0.7) * N), y = Math.round(rr(0.3, 0.7) * N);
    cluster(k % 2 ? 'stone' : 'gold', x, y, 4, 2.2, { amount: k % 2 ? 400 : 600 }, false);
  }
  for (let k = 0; k < Math.round(N / 8); k++) {
    const x = Math.round(rr(0.1, 0.9) * N), y = Math.round(rr(0.1, 0.9) * N);
    cluster(MAPRNG() < 0.8 ? 'deer' : 'boar', x, y, ri(2, 4), 3, {}, false);
  }

  // --- forests (symmetric noise field) ----------------------------------
  const f2 = new Noise(seed * 13 + 5);
  const tcDist = (x, y) => Math.min(Math.hypot(x - b0[0], y - b0[1]), Math.hypot(x - b1[0], y - b1[1]));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [mx, my] = mir(x, y);
      if (y * N + x > my * N + mx) continue;
      if (!landOk(x, y) || !landOk(mx, my)) continue;
      const fv = Math.max(f2.fbm(x * 0.09 + 20, y * 0.09 + 20, 4), f2.fbm(mx * 0.09 + 20, my * 0.09 + 20, 4));
      if (tcDist(x, y) < 11) continue;
      let dense = (fv - ST.ft) * 14;
      let p = dense > 0 ? clamp(0.55 + dense * 0.4, 0, 0.97) : 0.004;
      if (MAPRNG() < p) place('tree', x, y, {});
    }
  }
  // fixed spawns so the 'reserved TC area' tiles stay free: remove anything inside radius 5 (should be none)
  // Guarantee the bases are connected on foot: if forest/resources seal the way, carve a corridor.
  {
    const blocked = new Uint8Array(N * N);
    for (const s of spawns) if (s.kind === 'tree' || s.kind === 'gold' || s.kind === 'stone' || s.kind === 'berries') blocked[s.y * N + s.x] = 1;
    const bfs = (sx, sy) => {
      const seen = new Uint8Array(N * N), q = [sy * N + sx]; seen[q[0]] = 1;
      for (let h = 0; h < q.length; h++) {
        const c = q[h], cx = c % N, cy = (c / N) | 0;
        for (let k = 0; k < 8; k++) {
          const nx = cx + NB8[k][0], ny = cy + NB8[k][1];
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          const ni = ny * N + nx;
          if (seen[ni] || map.terrain[ni] || blocked[ni]) continue;
          if (k >= 4 && (blocked[cy * N + nx] || blocked[ny * N + cx] || map.terrain[cy * N + nx] || map.terrain[ny * N + cx])) continue;
          seen[ni] = 1; q.push(ni);
        }
      }
      return seen;
    };
    const reachFrom = bfs(b0[0], b0[1]);
    if (!reachFrom[b1[1] * N + b1[0]]) {
      // remove trees along a straight line, 3 tiles wide
      const removeAt = (x, y) => { for (let i = spawns.length - 1; i >= 0; i--) if (spawns[i].x === x && spawns[i].y === y && (spawns[i].kind === 'tree')) spawns.splice(i, 1); };
      for (let t = 0; t <= 1; t += 1 / (N * 1.5)) {
        const x = Math.round(lerp(b0[0], b1[0], t)), y = Math.round(lerp(b0[1], b1[1], t));
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) removeAt(x + dx, y + dy);
      }
    }
    // every base must also be able to reach the map centre region
    for (const b of [b0, b1]) {
      const seen = bfs(b[0], b[1]);
      let cnt = 0; for (let i = 0; i < seen.length; i++) cnt += seen[i];
      if (cnt < N * N * 0.25) {
        for (const s of spawns) if (s.kind === 'tree' && Math.hypot(s.x - b[0], s.y - b[1]) < N * 0.3 && ((s.x * 7 + s.y * 13) % 4 === 0)) s.kind = 'removed';
      }
    }
    for (let i = spawns.length - 1; i >= 0; i--) if (spawns[i].kind === 'removed') spawns.splice(i, 1);
  }
  map.bases = bases;
  map.spawns = spawns;
  map.humanBaseIndex = humanSide;

  // --- visual fields -----------------------------------------------------
  for (const s of spawns) {
    const i = s.y * N + s.x;
    if (s.kind === 'tree') {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = s.x + dx, y = s.y + dy;
        if (!map.inb(x, y)) continue;
        map.forestF[y * N + x] += 0.25 / (1 + Math.hypot(dx, dy));
      }
    } else if (s.kind === 'gold' || s.kind === 'stone') {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = s.x + dx, y = s.y + dy;
        if (!map.inb(x, y)) continue;
        map.dirtF[y * N + x] += 0.35 / (1 + Math.hypot(dx, dy) * 0.7);
      }
    }
  }
  for (const b of bases) {
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = b[0] + dx, y = b[1] + dy;
      if (!map.inb(x, y)) continue;
      map.dirtF[y * N + x] += Math.max(0, 0.9 - Math.hypot(dx, dy) * 0.14);
    }
  }
  return map;
}
