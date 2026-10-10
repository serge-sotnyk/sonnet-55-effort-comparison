// Fog of war for the human player (and their allies). AI players are treated as omniscient for visibility queries.

const offsetCache = new Map();
function discOffsets(r) {
  const key = Math.round(r * 2);
  let o = offsetCache.get(key);
  if (o) return o;
  const rr = key / 2, list = [];
  const ir = Math.ceil(rr);
  for (let dy = -ir; dy <= ir; dy++) for (let dx = -ir; dx <= ir; dx++) if (dx * dx + dy * dy <= rr * rr + 0.25) list.push(dx, dy);
  o = new Int8Array(list);
  offsetCache.set(key, o);
  return o;
}

export class Vision {
  constructor(game) {
    this.game = game;
    this.w = game.w; this.h = game.h;
    this.visible = new Uint8Array(this.w * this.h);
    this.explored = new Uint8Array(this.w * this.h);
    this.version = 0;
    this.reveal = false;
    this.exploredCount = 0;
  }

  _watching(owner) {
    const g = this.game;
    return owner === g.humanIndex || g.isAllied(owner, g.humanIndex);
  }

  update(force) {
    const g = this.game, w = this.w, h = this.h, vis = this.visible, exp = this.explored;
    vis.fill(0);
    const stamp = (x, y, r) => {
      const off = discOffsets(r);
      const cx = Math.floor(x), cy = Math.floor(y);
      for (let k = 0; k < off.length; k += 2) {
        const tx = cx + off[k], ty = cy + off[k + 1];
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        const i = ty * w + tx;
        vis[i] = 1; exp[i] = 1;
      }
    };
    for (const u of g.units) {
      if (u.dead || !this._watching(u.owner)) continue;
      if (u.garrison) continue;
      stamp(u.x, u.y, u.def.los);
    }
    for (const b of g.buildings) {
      if (b.dead || !this._watching(b.owner)) continue;
      stamp(b.x, b.y, b.built ? b.def.los + b.size * 0.5 : 3 + b.size * 0.5);
    }
    if (this.reveal) exp.fill(1);
    this.version++;
  }

  isVisible(player, x, y) {
    if (!this._watching(player)) return true;
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    return this.visible[ty * this.w + tx] === 1;
  }
  isExplored(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
    return this.explored[ty * this.w + tx] === 1;
  }
}
