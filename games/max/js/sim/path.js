// Navigation grid + A* pathfinding with string-pulling smoothing. Coordinates are tile units (tile i spans [i, i+1)).
import { MinHeap, distToRect } from './util.js';
import { T } from '../data/constants.js';

export const B_TERRAIN = 1, B_RESOURCE = 2, B_BUILDING = 4, B_GATE = 8;

const SQRT2 = Math.SQRT2;
const NB_DX = [1, -1, 0, 0, 1, 1, -1, -1];
const NB_DY = [0, 0, 1, -1, 1, -1, 1, -1];

export class NavGrid {
  constructor(w, h, terrain) {
    this.w = w; this.h = h; this.n = w * h;
    this.block = new Uint8Array(this.n);          // bit flags, see B_*
    this.gateOwner = new Uint8Array(this.n);
    this.region = new Int32Array(this.n);
    this.regionDirty = true;
    this.regionCount = 0;
    this.version = 0;                              // increments on any blocker change
    this.g = new Float32Array(this.n);
    this.parent = new Int32Array(this.n);
    this.stamp = new Int32Array(this.n);
    this.closed = new Int32Array(this.n);
    this.cur = 0;
    this.heap = new MinHeap(8192);
    for (let i = 0; i < this.n; i++) if (terrain[i] === T.DEEP) this.block[i] = B_TERRAIN;
    this.terrain = terrain;
    this.stats = { searches: 0, expanded: 0, ms: 0 };
  }

  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  /** Is tile (tx,ty) walkable for `player` (gates open only for their owner)? */
  walkTile(tx, ty, player = 0) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    const i = ty * this.w + tx, b = this.block[i];
    return b === 0 || (b === B_GATE && this.gateOwner[i] === player);
  }
  walkAt(x, y, player = 0) { return this.walkTile(Math.floor(x), Math.floor(y), player); }

  setBlock(tx, ty, flag, owner = 0) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    const i = ty * this.w + tx;
    this.block[i] |= flag;
    if (flag === B_GATE) this.gateOwner[i] = owner;
    this.regionDirty = true; this.version++;
  }
  clearBlock(tx, ty, flag) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    const i = ty * this.w + tx;
    this.block[i] &= ~flag;
    this.regionDirty = true; this.version++;
  }

  /** Connected-component labelling of passable tiles (gates count as passable). */
  updateRegions() {
    if (!this.regionDirty) return;
    const { w, h, block, region } = this;
    region.fill(-1);
    let id = 0;
    const stack = new Int32Array(this.n);
    for (let s = 0; s < this.n; s++) {
      if (region[s] !== -1) continue;
      const b = block[s];
      if (b !== 0 && b !== B_GATE) continue;
      let sp = 0; stack[sp++] = s; region[s] = id;
      while (sp) {
        const i = stack[--sp], x = i % w, y = (i / w) | 0;
        if (x > 0)     { const j = i - 1; if (region[j] === -1 && (block[j] === 0 || block[j] === B_GATE)) { region[j] = id; stack[sp++] = j; } }
        if (x < w - 1) { const j = i + 1; if (region[j] === -1 && (block[j] === 0 || block[j] === B_GATE)) { region[j] = id; stack[sp++] = j; } }
        if (y > 0)     { const j = i - w; if (region[j] === -1 && (block[j] === 0 || block[j] === B_GATE)) { region[j] = id; stack[sp++] = j; } }
        if (y < h - 1) { const j = i + w; if (region[j] === -1 && (block[j] === 0 || block[j] === B_GATE)) { region[j] = id; stack[sp++] = j; } }
      }
      id++;
    }
    this.regionCount = id;
    this.regionDirty = false;
  }
  regionAt(x, y) {
    this.updateRegions();
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return -1;
    return this.region[ty * this.w + tx];
  }

  /** Nearest walkable tile center to (x,y) within radius r (spiral search). Returns [x,y] or null. */
  nearestWalkable(x, y, player = 0, maxR = 8) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (this.walkTile(tx, ty, player)) return [x, y];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!this.walkTile(tx + dx, ty + dy, player)) continue;
        const cx = tx + dx + 0.5, cy = ty + dy + 0.5, d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (d < bd) { bd = d; best = [cx, cy]; }
      }
      if (best) return best;
    }
    return null;
  }

  /** Segment clear for a unit of small radius (samples the segment and two side offsets). */
  lineClear(x0, y0, x1, y1, player = 0, clear = 0.3) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 1e-6) return this.walkAt(x0, y0, player);
    const steps = Math.max(1, Math.ceil(len / 0.25));
    const ux = dx / len, uy = dy / len, nx = -uy * clear, ny = ux * clear;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = x0 + dx * t, y = y0 + dy * t;
      if (!this.walkAt(x, y, player)) return false;
      if (clear > 0) {
        if (!this.walkAt(x + nx, y + ny, player) || !this.walkAt(x - nx, y - ny, player)) return false;
      }
    }
    return true;
  }

  /**
   * A* search. goal: { x, y } point, or { rect: [x0,y0,x1,y1], reach } (reach = max distance from the rectangle).
   * Returns { pts: number[] (flat x,y waypoints, excluding the start), complete: boolean }.
   */
  findPath(sx, sy, goal, player = 0, maxNodes = 30000) {
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    const { w, h, block, g, parent, stamp, closed, heap } = this;
    this.updateRegions();
    let startTile = Math.floor(sy) * w + Math.floor(sx);
    if (!this.walkTile(Math.floor(sx), Math.floor(sy), player)) {
      const nw = this.nearestWalkable(sx, sy, player, 6);
      if (!nw) return { pts: [], complete: false };
      sx = nw[0]; sy = nw[1]; startTile = Math.floor(sy) * w + Math.floor(sx);
    }
    const isRect = !!goal.rect;
    let gx0, gy0, gx1, gy1, reach = 0, goalTile = -1, gcx = 0, gcy = 0;
    if (isRect) { [gx0, gy0, gx1, gy1] = goal.rect; reach = goal.reach; }
    else {
      gcx = goal.x; gcy = goal.y;
      let gtx = Math.floor(gcx), gty = Math.floor(gcy);
      if (!this.walkTile(gtx, gty, player)) {
        const nw = this.nearestWalkable(gcx, gcy, player, 10);
        if (!nw) return { pts: [], complete: false };
        gcx = nw[0]; gcy = nw[1]; gtx = Math.floor(gcx); gty = Math.floor(gcy);
      }
      goalTile = gty * w + gtx;
      gx0 = gx1 = gcx; gy0 = gy1 = gcy;
    }
    const cur = ++this.cur;
    heap.clear();
    const hOf = (x, y) => {
      const d = distToRect(x + 0.5, y + 0.5, gx0, gy0, gx1, gy1) - reach;
      return d > 0 ? d : 0;
    };
    // quick exits: a goal in a different static region can never be reached, so do not flood-fill the whole map for nothing
    const sReg = this.region[startTile];
    if (sReg !== -1) {
      if (isRect) {
        let any = false;
        const rx0 = Math.max(0, Math.floor(gx0 - reach - 1)), ry0 = Math.max(0, Math.floor(gy0 - reach - 1));
        const rx1 = Math.min(w - 1, Math.ceil(gx1 + reach + 1)), ry1 = Math.min(h - 1, Math.ceil(gy1 + reach + 1));
        for (let yy = ry0; yy <= ry1 && !any; yy++) for (let xx = rx0; xx <= rx1; xx++) {
          if (this.region[yy * w + xx] === sReg && distToRect(xx + 0.5, yy + 0.5, gx0, gy0, gx1, gy1) <= reach + 1e-6) { any = true; break; }
        }
        if (!any) { this.stats.searches++; return { pts: [], complete: false }; }
      } else if (this.region[goalTile] !== sReg && this.region[goalTile] !== -1) {
        maxNodes = Math.min(maxNodes, 2500);              // wander toward the closest point we can actually reach
      }
    }
    stamp[startTile] = cur; g[startTile] = 0; parent[startTile] = -1;
    heap.push(startTile, hOf(startTile % w, (startTile / w) | 0));
    let found = -1, expanded = 0, bestNode = startTile, bestH = hOf(startTile % w, (startTile / w) | 0);
    while (heap.n) {
      const i = heap.pop();
      if (closed[i] === cur) continue;
      closed[i] = cur;
      const x = i % w, y = (i / w) | 0;
      const hh = hOf(x, y);
      if (hh < bestH) { bestH = hh; bestNode = i; }
      if (isRect ? hh <= 1e-6 : i === goalTile) { found = i; break; }
      if (++expanded > maxNodes) break;
      const gi = g[i];
      for (let k = 0; k < 8; k++) {
        const nx = x + NB_DX[k], ny = y + NB_DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        const bj = block[j];
        if (bj !== 0 && !(bj === B_GATE && this.gateOwner[j] === player)) continue;
        let cost = 1;
        if (k >= 4) {
          // no corner cutting
          const b1 = block[y * w + nx], b2 = block[ny * w + x];
          if ((b1 !== 0 && !(b1 === B_GATE && this.gateOwner[y * w + nx] === player)) || (b2 !== 0 && !(b2 === B_GATE && this.gateOwner[ny * w + x] === player))) continue;
          cost = SQRT2;
        }
        const ng = gi + cost;
        if (stamp[j] !== cur || ng < g[j]) {
          if (closed[j] === cur && stamp[j] === cur && ng >= g[j]) continue;
          stamp[j] = cur; g[j] = ng; parent[j] = i;
          heap.push(j, ng + hOf(nx, ny));
        }
      }
    }
    const complete = found !== -1;
    const endNode = complete ? found : bestNode;
    this.stats.searches++; this.stats.expanded += expanded;
    // reconstruct tile chain
    const chain = [];
    for (let i = endNode; i !== -1; i = parent[i]) { chain.push(i); if (i === startTile) break; }
    chain.reverse();
    let pts = [];
    for (let k = 0; k < chain.length; k++) pts.push((chain[k] % w) + 0.5, ((chain[k] / w) | 0) + 0.5);
    // final point: exact goal for point goals
    if (!isRect && complete) { pts[pts.length - 2] = gcx; pts[pts.length - 1] = gcy; }
    // string pulling from the true start position
    const out = [];
    let ax = sx, ay = sy, k = 0;
    const npts = pts.length / 2;
    while (k < npts) {
      // furthest visible waypoint from (ax, ay), scanning forward
      let far = k;
      for (let m = k; m < npts; m++) {
        if (this.lineClear(ax, ay, pts[m * 2], pts[m * 2 + 1], player)) far = m; else if (m > far + 3) break;
      }
      out.push(pts[far * 2], pts[far * 2 + 1]);
      ax = pts[far * 2]; ay = pts[far * 2 + 1];
      k = far + 1;
    }
    if (typeof performance !== 'undefined') this.stats.ms += performance.now() - t0;
    return { pts: out, complete };
  }
}
