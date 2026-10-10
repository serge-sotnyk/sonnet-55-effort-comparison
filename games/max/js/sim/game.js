// Core game state and the fixed-step simulation loop. Pure logic: no DOM, runs in Node for tests.
import { TICK, T, GATHER_RATES, NODE_AMOUNT, POP_MAX, RES, STANCES } from '../data/constants.js';
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { CIVS } from '../data/civs.js';
import { RNG, distToRect } from './util.js';
import { generateMap } from './map.js';
import { NavGrid, B_RESOURCE, B_BUILDING, B_GATE } from './path.js';
import { Player } from './player.js';
import { updateUnit } from './unitai.js';
import { updateBuilding, onBuildingComplete, onBuildingRemoved } from './buildingai.js';
import { updateProjectiles, killUnitEffects } from './combat.js';
import { Vision } from './vision.js';
import { AIPlayer } from './ai.js';

const CELL = 4;

export const DIFFICULTY = {
  easy:     { name: 'Easy',     gather: 0.8,  desc: 'A relaxed opponent. Slow to expand and rarely attacks in force.' },
  standard: { name: 'Standard', gather: 1.0,  desc: 'A fair fight. The AI plays by the same rules as you.' },
  hard:     { name: 'Hard',     gather: 1.15, desc: 'A sharper opponent with a modest economic edge.' },
  brutal:   { name: 'Brutal',   gather: 1.35, desc: 'Fast, relentless and efficient. Prepare for early aggression.' },
};

export class Game {
  /**
   * settings: { mapType, mapSize:number, seed, players:[{civ,isAI,name,color,difficulty}], startRes:'low'|'standard'|'high',
   *             revealMap, speed, wonderVictory, humanIndex }
   */
  constructor(settings) {
    this.settings = settings;
    this.rng = new RNG((settings.seed >>> 0) * 7 + 1);
    this.time = 0; this.tick = 0;
    this.constants = { rates: GATHER_RATES };
    this.nextId = 1;
    this.byId = new Map();
    this.units = []; this.buildings = []; this.resources = []; this.projectiles = []; this.corpses = []; this.stumps = [];
    this.events = []; this.collectEvents = true;
    this.messages = [];
    this.pathQueue = [];
    this.over = false; this.result = null;
    this.humanIndex = settings.humanIndex != null ? settings.humanIndex : 1;
    this.wonderTimers = {};

    // ---- map & grid
    const numPlayers = settings.players.length;
    this.map = generateMap({ type: settings.mapType, size: settings.mapSize, numPlayers, seed: settings.seed });
    this.w = this.map.w; this.h = this.map.h;
    this.nav = new NavGrid(this.w, this.h, this.map.terrain);
    this.flat = new Uint8Array(this.w * this.h);          // tiles covered by farms (walkable but not buildable)
    this.wallMap = new Map();                              // tile index -> wall/gate building (for auto-connecting sprites)
    this.lastError = '';
    this.terrain = this.map.terrain;
    this.ucells = null; this._initCells();

    // ---- players (index 0 = gaia)
    this.players = [new Player(this, 0, { civ: 'britons', name: 'Gaia' })];
    this.players[0].alive = false;
    settings.players.forEach((cfg, i) => {
      const p = new Player(this, i + 1, cfg);
      p.difficulty = cfg.difficulty || 'standard';
      this.players.push(p);
    });
    const sr = { low: [200, 200, 0, 0], standard: [200, 200, 100, 200], high: [500, 500, 400, 400] }[settings.startRes || 'standard'];
    for (const p of this.players) if (p.index > 0) { p.res.food = sr[0]; p.res.wood = sr[1]; p.res.gold = sr[2]; p.res.stone = sr[3]; }

    // ---- visibility (human + allies only)
    this.vision = new Vision(this);
    this.vision.reveal = !!settings.revealMap;

    // ---- populate world
    this._populate();
    for (const p of this.players) if (p.index > 0) this.recalcPop(p);

    // ---- AI controllers
    this.ais = [];
    for (const p of this.players) if (p.index > 0 && p.isAI) this.ais.push(new AIPlayer(this, p));
    this.vision.update(true);
  }

  // ================================================================ setup
  _initCells() {
    this.cw = Math.ceil(this.w / CELL); this.ch = Math.ceil(this.h / CELL);
    this.ucells = Array.from({ length: this.cw * this.ch }, () => []);
    this.scells = Array.from({ length: this.cw * this.ch }, () => []);      // static: buildings + resources
    this.scratch = [];
  }

  _populate() {
    const m = this.map;
    // starting town centers & units
    this.startTCs = [];
    m.starts.forEach((s, i) => {
      const pl = this.players[i + 1];
      const tc = this.spawnBuilding('town_center', pl.index, s.x - 2, s.y - 2, { built: true });
      this.startTCs.push(tc);
      pl.startPos = { x: s.x, y: s.y };
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.6;
        this.spawnUnit('villager', pl.index, s.x + Math.cos(a) * 3.2, s.y + Math.sin(a) * 3.2);
      }
      const sc = this.spawnUnit('scout', pl.index, s.x + 3.5, s.y - 3.5);
    });
    // objects
    for (const o of m.objects) {
      if (o.k === 'tree') this.spawnResource('tree', o.x, o.y, o.v);
      else if (o.k === 'berries') this.spawnResource('berries', o.x, o.y, 0);
      else if (o.k === 'gold') this.spawnResource('gold', o.x, o.y, 0);
      else if (o.k === 'stone') this.spawnResource('stone', o.x, o.y, 0);
      else if (o.k === 'animal') {
        let owner = o.owner;
        if (owner === -1) {                                 // starting sheep: belong to the nearest start
          let best = 1, bd = 1e9;
          m.starts.forEach((s, i) => { const d = Math.hypot(s.x - o.x, s.y - o.y); if (d < bd) { bd = d; best = i + 1; } });
          owner = best;
        }
        const a = this.spawnUnit(o.type, owner, o.x, o.y);
        a.home = { x: o.x, y: o.y };
        if (owner > 0) a.domestic = true;
      }
    }
    this.nav.updateRegions();
  }

  aiGatherBonus(player) { return (DIFFICULTY[player.difficulty] || DIFFICULTY.standard).gather; }

  // ================================================================ entity creation
  _newId() { return this.nextId++; }

  spawnUnit(type, owner, x, y) {
    const pl = this.players[owner];
    const def = pl.defs[type] || UNITS[type];
    const u = {
      id: this._newId(), kind: 'unit', type, owner, def, x, y, px: x, py: y, dir: this.rng.int(8),
      hp: def.hp, maxHp: def.hp, order: null, queue: [], path: null, pi: 0, goal: null, pathWait: 0, repathT: 0,
      anim: 'idle', animT: this.rng.next() * 5, reload: 0, attackT: -1, hitDone: true, atkTarget: 0,
      carry: 0, carryType: null, stance: 'aggressive', scanT: this.rng.next() * 0.5,
      garrison: 0, dead: false, variant: this.rng.int(4), lastAttacker: 0, lastHitT: -99,
      moving: false, stuckT: 0, packed: !!def.unpack, unpackT: 0, faith: 1, convT: 0, home: null,
      radius: def.radius, rally: null, fleeT: 0, wanderT: this.rng.next() * 6, tx: 0, ty: 0,
    };
    if (type === 'villager') { u.stance = 'passive'; }
    this.units.push(u); this.byId.set(u.id, u);
    if (owner > 0 && !def.tags.includes('animal')) pl.pop++;
    return u;
  }

  spawnBuilding(type, owner, tx, ty, opts = {}) {
    const pl = this.players[owner];
    const def = pl.bdefs[type];
    const size = def.size;
    const b = {
      id: this._newId(), kind: 'building', type, owner, def, tx, ty, size, x: tx + size / 2, y: ty + size / 2,
      hp: opts.built ? def.hp : Math.max(1, def.hp * 0.08), maxHp: def.hp, built: !!opts.built, progress: opts.built ? 1 : 0,
      queue: [], rally: null, garrison: [], reload: 0, nBuilders: 0, dead: false, variant: this.rng.int(4), animT: this.rng.next() * 5,
      lastHitT: -99, lastAttacker: 0, attackedNotifyT: -99, axis: opts.axis || 'x', amount: 0, farmer: 0, scanT: 0, burn: 0,
      researchSound: 0,
    };
    if (type === 'farm') { b.amount = this.fillFarmAmount(pl); b.maxAmount = b.amount; }
    this.buildings.push(b); this.byId.set(b.id, b);
    if (!def.flat) {
      for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) this.nav.setBlock(x, y, def.gate ? B_GATE : B_BUILDING, owner);
    } else {
      for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) this.flat[y * this.w + x] = 1;
    }
    this._indexStatic(b);
    if (def.wall) this._registerWall(b);
    if (b.built) onBuildingComplete(this, b, true);
    // push units out of the footprint
    if (!def.flat) this._evictUnits(b);
    this.nav.updateRegions();
    return b;
  }

  fillFarmAmount(pl) { return NODE_AMOUNT.farm; }

  spawnResource(sub, tx, ty, variant = 0, amount) {
    const res = sub === 'tree' ? 'wood' : sub === 'gold' ? 'gold' : sub === 'stone' ? 'stone' : 'food';
    const amt = amount !== undefined ? amount : (NODE_AMOUNT[sub] || 100);
    const r = {
      id: this._newId(), kind: 'resource', sub, res, tx, ty, x: tx + 0.5, y: ty + 0.5, size: 1, amount: amt, max: amt,
      variant, gatherers: 0, dead: false, rot: 0, animT: 0, tags: ['resource', sub], owner: 0,
    };
    if (sub === 'carcass') r.block = false;
    this.resources.push(r); this.byId.set(r.id, r);
    if (sub !== 'carcass') this.nav.setBlock(tx, ty, B_RESOURCE);
    this._indexStatic(r);
    return r;
  }

  _cellOf(x, y) {
    const cx = Math.max(0, Math.min(this.cw - 1, (x / CELL) | 0)), cy = Math.max(0, Math.min(this.ch - 1, (y / CELL) | 0));
    return cy * this.cw + cx;
  }
  _indexStatic(e) {
    const x0 = e.tx, y0 = e.ty, x1 = e.tx + (e.size || 1) - 1, y1 = e.ty + (e.size || 1) - 1;
    const cs = new Set();
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) cs.add(this._cellOf(x, y));
    e.cells = [...cs];
    for (const c of e.cells) this.scells[c].push(e);
  }
  _unindexStatic(e) {
    if (!e.cells) return;
    for (const c of e.cells) { const a = this.scells[c]; const i = a.indexOf(e); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } }
    e.cells = null;
  }

  _evictUnits(b) {
    const nav = this.nav;
    for (const u of this.units) {
      if (u.dead || u.garrison) continue;
      if (u.x >= b.tx - 0.2 && u.x <= b.tx + b.size + 0.2 && u.y >= b.ty - 0.2 && u.y <= b.ty + b.size + 0.2) {
        // find nearest walkable spot outside
        let best = null, bd = 1e9;
        for (let r = 0; r < 7 && !best; r++) {
          for (let k = 0; k < 24; k++) {
            const a = (k / 24) * Math.PI * 2;
            const cx = b.x + Math.cos(a) * (b.size / 2 + 0.7 + r * 0.7), cy = b.y + Math.sin(a) * (b.size / 2 + 0.7 + r * 0.7);
            if (!nav.walkAt(cx, cy, u.owner)) continue;
            const d = Math.hypot(cx - u.x, cy - u.y);
            if (d < bd) { bd = d; best = [cx, cy]; }
          }
        }
        if (best) { u.x = best[0]; u.y = best[1]; u.px = u.x; u.py = u.y; u.path = null; if (u.order && (u.order.type === 'move')) u.goal = null; }
      }
    }
  }

  // ---- wall connectivity (for sprites): bit1 +x, bit2 +y, bit4 -x, bit8 -y neighbours
  _wallNeighbour(b, dx, dy) {
    const n = this.wallMap.get((b.ty + dy) * this.w + (b.tx + dx));
    return n && !n.dead && (n.owner === b.owner) ? n : null;
  }
  _updateWallMask(b) {
    let m = 0;
    if (this._wallNeighbour(b, 1, 0)) m |= 1;
    if (this._wallNeighbour(b, 0, 1)) m |= 2;
    if (this._wallNeighbour(b, -1, 0)) m |= 4;
    if (this._wallNeighbour(b, 0, -1)) m |= 8;
    b.mask = m;
    if (b.def.gate) b.axis = (m & 5) || !(m & 10) ? 'x' : 'y';
  }
  _registerWall(b) {
    this.wallMap.set(b.ty * this.w + b.tx, b);
    this._updateWallMask(b);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this._wallNeighbour(b, dx, dy); if (n) this._updateWallMask(n); }
  }
  _unregisterWall(b) {
    if (this.wallMap.get(b.ty * this.w + b.tx) === b) this.wallMap.delete(b.ty * this.w + b.tx);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this._wallNeighbour(b, dx, dy); if (n) this._updateWallMask(n); }
  }
  notifyEnemyAge(pl, age) {
    if (this.isEnemy(this.humanIndex, pl.index)) this.notify(this.humanIndex, `${pl.name} has advanced to the ${['Dark', 'Feudal', 'Castle', 'Imperial'][age]} Age.`, 0, 0, 'warn');
  }

  // ================================================================ queries
  get(id) { return this.byId.get(id); }
  alive(e) { return e && !e.dead; }
  isEnemy(a, b) {                       // a, b are owner indices
    if (a === b) return false;
    if (a === 0 || b === 0) return false;           // gaia is neutral (aggressive animals handle themselves)
    return this.players[a].team !== this.players[b].team;
  }
  isAllied(a, b) { return a !== 0 && b !== 0 && this.players[a].team === this.players[b].team; }

  /** Units within radius r of (x,y). Returns a shared scratch array; consume immediately. */
  queryUnits(x, y, r) {
    const out = this.scratch; out.length = 0;
    const x0 = Math.max(0, ((x - r) / CELL) | 0), x1 = Math.min(this.cw - 1, ((x + r) / CELL) | 0);
    const y0 = Math.max(0, ((y - r) / CELL) | 0), y1 = Math.min(this.ch - 1, ((y + r) / CELL) | 0);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const cell = this.ucells[cy * this.cw + cx];
      for (let i = 0; i < cell.length; i++) {
        const u = cell[i];
        const dx = u.x - x, dy = u.y - y;
        if (dx * dx + dy * dy <= r2) out.push(u);
      }
    }
    return out;
  }
  /** Static entities (buildings/resources) whose footprint is within r of (x,y). Scratch array result. */
  queryStatic(x, y, r, kind) {
    const out = []; const seen = new Set();
    const x0 = Math.max(0, ((x - r) / CELL) | 0), x1 = Math.min(this.cw - 1, ((x + r) / CELL) | 0);
    const y0 = Math.max(0, ((y - r) / CELL) | 0), y1 = Math.min(this.ch - 1, ((y + r) / CELL) | 0);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (const e of this.scells[cy * this.cw + cx]) {
        if (e.dead || seen.has(e.id) || (kind && e.kind !== kind)) continue;
        seen.add(e.id);
        const s = e.size || 1;
        if (distToRect(x, y, e.tx, e.ty, e.tx + s, e.ty + s) <= r) out.push(e);
      }
    }
    return out;
  }

  /** Nearest resource entity of `res` type ('wood','food','gold','stone'); optional sub filter; reachable from (x,y). */
  /** Region id at (x,y); if that tile is blocked (inside a building) use the nearest passable tile's region. */
  regionNear(x, y) {
    const nav = this.nav; nav.updateRegions();
    let r = nav.regionAt(x, y);
    if (r >= 0) return r;
    const tx = Math.floor(x), ty = Math.floor(y);
    for (let d = 1; d <= 5; d++) {
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        const rr = nav.region[ny * this.w + nx];
        if (rr >= 0) return rr;
      }
    }
    return -1;
  }
  findNearestResource(x, y, res, maxR = 40, opts = {}) {
    let best = null, bd = 1e9;
    const region = this.regionNear(x, y);
    const list = this.queryStatic(x, y, maxR, 'resource');
    for (const r of list) {
      if (r.res !== res || r.dead || r.amount <= 0) continue;
      if (opts.sub && r.sub !== opts.sub) continue;
      if (opts.excludeSub && r.sub === opts.excludeSub) continue;
      if (opts.avoid) { let bad = false; for (const a of opts.avoid) if (Math.hypot(r.x - a.x, r.y - a.y) < a.r) { bad = true; break; } if (bad) continue; }
      const d = Math.hypot(r.x - x, r.y - y) + r.gatherers * 0.9;
      if (d >= bd) continue;
      if (!this.resourceReachable(r, region)) continue;
      bd = d; best = r;
    }
    return best;
  }
  resourceReachable(r, region) {
    // at least one neighbouring tile belongs to the unit's region
    const nav = this.nav;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const tx = r.tx + dx, ty = r.ty + dy;
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
      if (nav.region[ty * this.w + tx] === region) return true;
    }
    return r.sub === 'carcass' && nav.region[r.ty * this.w + r.tx] === region;
  }
  /** Nearest completed friendly building that accepts resource `res`. */
  findDropoff(owner, x, y, res) {
    let best = null, bd = 1e9;
    for (const b of this.buildings) {
      if (b.owner !== owner || b.dead || !b.built || !b.def.dropoff.includes(res)) continue;
      const d = distToRect(x, y, b.tx, b.ty, b.tx + b.size, b.ty + b.size);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ================================================================ population / completion
  recalcPop(p) {
    let cap = 0;
    for (const b of this.buildings) if (b.owner === p.index && !b.dead && b.built) cap += b.def.pop || 0;
    p.popCap = Math.min(POP_MAX, cap);
  }

  // ================================================================ events & messages
  emit(t, data) { if (this.collectEvents) { data.t = t; this.events.push(data); } }
  notify(player, text, x, y, kind = 'info') {
    if (player !== this.humanIndex && !this.isAllied(player, this.humanIndex)) return;
    this.messages.push({ text, x, y, kind, time: this.time });
    if (this.messages.length > 20) this.messages.shift();
    this.emit('notify', { text, x, y, kind, player });
  }

  // ================================================================ destruction
  killUnit(u, killer) {
    if (u.dead) return;
    u.dead = true;
    const pl = this.players[u.owner];
    if (u.garrison) {
      const b = this.byId.get(u.garrison);
      if (b) { const i = b.garrison.indexOf(u); if (i >= 0) b.garrison.splice(i, 1); }
    }
    if (u.owner > 0 && !u.def.tags.includes('animal')) {
      pl.pop--; pl.stats.losses++;
      if (u.type === 'villager') pl.stats.villagersLost++;
      const kp = killer ? this.players[killer.owner] : null;
      if (kp && kp.index !== u.owner) { kp.stats.kills++; }
    }
    // release gather slot
    if (u.order && u.order.type === 'gather') this._releaseGather(u);
    if (u.order && u.order.type === 'farm') this._releaseGather(u);
    killUnitEffects(this, u, killer);
  }
  _releaseGather(u) {
    const o = u.order;
    if (!o || !o.slot) return;
    const t = this.byId.get(o.target);
    if (t) { if (t.kind === 'resource') t.gatherers = Math.max(0, t.gatherers - 1); else if (t.kind === 'building') t.farmer = 0; }
    o.slot = false;
  }

  destroyBuilding(b, killer, quiet = false) {
    if (b.dead) return;
    b.dead = true;
    const pl = this.players[b.owner];
    // eject garrison
    for (const u of b.garrison.slice()) this.ungarrisonUnit(u, b);
    // refund pending queue items
    for (const it of b.queue) { if (it.started && it.kind === 'unit') pl.popReserved--; if (it.kind === 'tech') pl.researching.delete(it.id); pl.refund(it.cost); }
    b.queue = [];
    if (!b.def.flat) for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) this.nav.clearBlock(x, y, b.def.gate ? B_GATE : B_BUILDING);
    else for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) this.flat[y * this.w + x] = 0;
    this._unindexStatic(b);
    if (b.def.wall) this._unregisterWall(b);
    if (b.built) { onBuildingRemoved(this, b); pl.stats.buildingsLost++; }
    this.recalcPop(pl);
    if (killer && killer.owner !== b.owner && killer.owner > 0) this.players[killer.owner].stats.razings++;
    this.emit('collapse', { x: b.x, y: b.y, size: b.size, owner: b.owner, type: b.type, flat: b.def.flat });
    if (!quiet && !b.def.flat && b.built) this.notify(b.owner, `Your ${b.def.name} has been destroyed!`, b.x, b.y, 'alert');
    // builders/units targeting it will notice via dead flag
  }

  ungarrisonUnit(u, b) {
    const i = b.garrison.indexOf(u); if (i >= 0) b.garrison.splice(i, 1);
    u.garrison = 0;
    // place around the building edge toward its rally point if any
    const ang = this.rng.next() * Math.PI * 2;
    let placed = false;
    for (let r = 0; r < 6 && !placed; r++) {
      for (let k = 0; k < 16 && !placed; k++) {
        const a = ang + (k / 16) * Math.PI * 2;
        const d = b.size / 2 + 0.7 + r * 0.6;
        const px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d;
        if (this.nav.walkAt(px, py, u.owner)) { u.x = px; u.y = py; placed = true; }
      }
    }
    if (!placed) { u.x = b.x; u.y = b.y + b.size / 2 + 1; }
    u.px = u.x; u.py = u.y; u.path = null; u.order = null;
  }

  removeResource(r) {
    if (r.dead) return;
    r.dead = true;
    if (r.sub !== 'carcass') this.nav.clearBlock(r.tx, r.ty, B_RESOURCE);
    this._unindexStatic(r);
    if (r.sub === 'tree') { this.stumps.push({ x: r.x, y: r.y, v: r.variant }); if (this.stumps.length > 4000) this.stumps.shift(); }
    this.emit('resdepleted', { x: r.x, y: r.y, sub: r.sub });
  }

  /** Convert an animal unit into a carcass resource at its position. */
  makeCarcass(u) {
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    const food = u.def.food;
    const sub = 'carcass';
    const r = this.spawnResource(sub, tx, ty, 0, food);
    r.x = u.x; r.y = u.y; r.animal = u.type; r.rot = 0;
    return r;
  }

  // ================================================================ main loop
  update() {
    if (this.over && !this.keepSimulating) return;
    const dt = TICK;
    this.tick++; this.time += dt;
    // rebuild unit hash & per-owner lists
    for (const c of this.ucells) c.length = 0;
    for (const u of this.units) {
      u.px = u.x; u.py = u.y;
      if (u.dead || u.garrison) continue;
      this.ucells[this._cellOf(u.x, u.y)].push(u);
    }
    for (const b of this.buildings) b.nBuilders = 0;
    // AI thinking
    for (const ai of this.ais) ai.update(dt);
    // path queue
    this.processPaths();
    // units
    const us = this.units;
    for (let i = 0, n = us.length; i < n; i++) { const u = us[i]; if (!u.dead && !u.garrison) updateUnit(this, u, dt); }
    this.separateUnits(dt);
    // buildings
    for (let i = 0, n = this.buildings.length; i < n; i++) { const b = this.buildings[i]; if (!b.dead) updateBuilding(this, b, dt); }
    updateProjectiles(this, dt);
    // resource rot (carcasses)
    for (const r of this.resources) if (!r.dead && r.sub === 'carcass') { r.rot += dt; if (r.rot > 150 && r.gatherers === 0) this.removeResource(r); }
    // cleanup
    this._compact();
    // vision
    if (this.tick % 4 === 0) this.vision.update();
    if (this.tick % 20 === 0) { this.checkVictory(); this._sampleStats(); this._marketRecover(); }
  }

  _compact() {
    let w = 0;
    for (let i = 0; i < this.units.length; i++) { const u = this.units[i]; if (u.dead) this.byId.delete(u.id); else this.units[w++] = u; }
    this.units.length = w;
    w = 0;
    for (let i = 0; i < this.buildings.length; i++) { const b = this.buildings[i]; if (b.dead) this.byId.delete(b.id); else this.buildings[w++] = b; }
    this.buildings.length = w;
    w = 0;
    for (let i = 0; i < this.resources.length; i++) { const r = this.resources[i]; if (r.dead) this.byId.delete(r.id); else this.resources[w++] = r; }
    this.resources.length = w;
    // corpses fade
    const cs = this.corpses; w = 0;
    for (let i = 0; i < cs.length; i++) if (this.time - cs[i].t0 < 14) cs[w++] = cs[i];
    cs.length = w;
    if (!this.collectEvents) this.events.length = 0;
  }

  // ================================================================ path request budget (deterministic)
  requestPath(u, goal) {
    u.goal = goal; u.path = null; u.pi = 0; u.pathWait = 1;
    this.pathQueue.push(u);
  }
  processPaths() {
    const q = this.pathQueue;
    if (!q.length) return;
    const nav = this.nav;
    const startExp = nav.stats.expanded;
    let done = 0;
    let i = 0;
    for (; i < q.length; i++) {
      const u = q[i];
      if (u.dead || !u.goal || !u.pathWait) continue;
      const gl = u.goal;
      const res = nav.findPath(u.x, u.y, gl, u.owner);
      u.pathWait = 0;
      u.path = res.pts.length ? res.pts : null;
      u.pi = 0;
      u.pathComplete = res.complete;
      if (!u.path) u.pathFailed = true;
      done++;
      if (done >= 18 || nav.stats.expanded - startExp > 50000) { i++; break; }
    }
    q.splice(0, i);
  }

  // ================================================================ soft collision
  separateUnits(dt) {
    const nav = this.nav;
    const us = this.units;
    for (let a = 0; a < us.length; a++) {
      const u = us[a];
      if (u.dead || u.garrison || u.def.speed === 0) continue;
      const r = u.radius;
      const near = this.queryUnits(u.x, u.y, r + 0.7);
      let px = 0, py = 0;
      for (let k = 0; k < near.length; k++) {
        const v = near[k];
        if (v === u || v.def.speed === 0 && v.def.tags.includes('livestock')) continue;
        let dx = u.x - v.x, dy = u.y - v.y;
        let d = Math.hypot(dx, dy);
        const min = (r + v.radius) * 0.9;
        if (d >= min) continue;
        if (d < 0.001) { dx = (u.id % 7 - 3) * 0.01 + 0.01; dy = (v.id % 5 - 2) * 0.01 + 0.005; d = Math.hypot(dx, dy); }
        const overlap = min - d;
        // moving units shove idle ones more than the reverse
        const wu = u.moving ? 1 : 2.2, wv = v.moving ? 1 : 2.2;
        const share = wv / (wu + wv);
        px += (dx / d) * overlap * share; py += (dy / d) * overlap * share;
      }
      if (px || py) {
        const m = Math.hypot(px, py), cap = 0.12;
        if (m > cap) { px = px / m * cap; py = py / m * cap; }
        const nx = u.x + px, ny = u.y + py;
        if (nav.walkAt(nx, ny, u.owner)) {
          // keep workers within reach of their work target
          const o = u.order;
          if (o && o.reachMax && !u.moving) {
            const t = this.byId.get(o.target);
            if (t && !t.dead) {
              const s = t.size || 0;
              const dnew = t.kind === 'unit' ? Math.hypot(nx - t.x, ny - t.y) : distToRect(nx, ny, t.tx, t.ty, t.tx + (t.size || 1), t.ty + (t.size || 1));
              if (dnew > o.reachMax) continue;
            }
          }
          u.x = nx; u.y = ny;
        } else if (nav.walkAt(nx, u.y, u.owner)) u.x = nx;
        else if (nav.walkAt(u.x, ny, u.owner)) u.y = ny;
      }
    }
  }

  // ================================================================ victory
  playerActive(p) {
    // a player remains in the game while they own any building (other than walls/farms) or any villager
    for (const b of this.buildings) if (b.owner === p.index && !b.dead && !b.def.wall && !b.def.flat && b.built) return true;
    for (const u of this.units) if (u.owner === p.index && !u.dead && u.type === 'villager') return true;
    return false;
  }
  checkVictory() {
    if (this.over) return;
    for (const p of this.players) {
      if (p.index === 0 || !p.alive) continue;
      if (p.resigned || !this.playerActive(p)) {
        p.alive = false; p.defeatedAt = this.time;
        this.emit('defeat', { player: p.index });
        // remaining units of a defeated player perish
        for (const u of this.units) if (u.owner === p.index && !u.dead) { u.hp = 0; this.killUnit(u, null); }
        for (const b of this.buildings) if (b.owner === p.index && !b.dead && !b.def.wall) { this.destroyBuilding(b, null); }
        for (const b of this.buildings) if (b.owner === p.index && !b.dead) { this.destroyBuilding(b, null); }
      }
    }
    const live = this.players.filter(p => p.index > 0 && p.alive);
    const human = this.players[this.humanIndex];
    const teams = new Set(live.map(p => p.team));
    if (human && !human.alive) { this._endGame(false); return; }
    if (teams.size <= 1 && live.length > 0) { this._endGame(live.includes(human)); return; }
    // wonder victory
    if (this.settings.wonderVictory) {
      for (const b of this.buildings) {
        if (b.type !== 'wonder' || !b.built || b.dead) continue;
        const t = (this.wonderTimers[b.id] = (this.wonderTimers[b.id] || 0) + 1);
        if (t === 1) { this.emit('wonder_start', { owner: b.owner, x: b.x, y: b.y }); this.notifyAll(`${this.players[b.owner].name} has completed a Wonder! Destroy it within 10 minutes or lose!`); }
        if (t >= 600) { this._endGame(b.owner === this.humanIndex || this.isAllied(b.owner, this.humanIndex), 'wonder'); return; }
      }
    }
  }
  /** An opponent says something (shown in the notification list in their color). */
  chat(fromIdx, text) {
    const p = this.players[fromIdx];
    this.messages.push({ text: `${p.name}: ${text}`, kind: 'chat', time: this.time, from: fromIdx });
    this.emit('notify', { text, kind: 'chat', player: -1 });
  }
  notifyAll(text) { this.messages.push({ text, kind: 'alert', time: this.time }); this.emit('notify', { text, kind: 'alert', player: -1 }); }
  _endGame(won, how = 'conquest') {
    this.over = true;
    this.result = { won, how, time: this.time };
    this.emit('gameover', { won, how });
  }
  resign(playerIndex) { const p = this.players[playerIndex]; p.resigned = true; this.checkVictory(); }

  _sampleStats() {
    if (this.tick % 200 !== 0) return;                              // every 10 s
    for (const p of this.players) {
      if (p.index === 0) continue;
      let mil = 0;
      for (const u of this.units) if (u.owner === p.index && !u.dead && !u.def.tags.includes('villager') && !u.def.tags.includes('animal')) mil++;
      p.stats.military = mil;
      const g = p.stats.gathered;
      p.stats.history.push({ t: this.time, eco: g.food + g.wood + g.gold + g.stone, pop: p.pop, mil, age: p.age });
    }
  }
  _marketRecover() {
    // trade prices drift back toward 100
    for (const p of this.players) {
      if (p.index === 0) continue;
      for (const r of ['food', 'wood', 'stone']) {
        const v = p.market[r];
        p.market[r] = v > 100 ? Math.max(100, v - 0.35) : Math.min(100, v + 0.35);
      }
    }
  }

  // ================================================================ helpers used by several modules
  unitsOf(owner) { const out = []; for (const u of this.units) if (u.owner === owner && !u.dead) out.push(u); return out; }
  buildingsOf(owner) { const out = []; for (const b of this.buildings) if (b.owner === owner && !b.dead) out.push(b); return out; }
  isVisibleTo(playerIndex, x, y) { return this.vision.isVisible(playerIndex, x, y); }
}
