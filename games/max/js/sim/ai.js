// Computer opponent. Plays through the same command API as the human: boom economy, age progression,
// production buildings, counter-based army composition, attack waves, base defense and villager safety.
import { UNITS, LINES } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { CIVS } from '../data/civs.js';
import { RES } from '../data/constants.js';
import { distToRect } from './util.js';
import * as Cmd from './commands.js';
import { setOrder } from './unitai.js';

const PARAMS = {
  easy:     { feudalVil: 16, ecoGate: 0.8, think: 1.7, vil: [18, 28, 40, 50], firstAttack: 1080, wave: 10, waveGrow: 3, house: 4, techRate: 0.5, prodMax: 2, milShare: 0.30, rush: false },
  standard: { feudalVil: 22, ecoGate: 0.68, think: 1.0, vil: [24, 46, 66, 80], firstAttack: 840,  wave: 16, waveGrow: 5, house: 5, techRate: 0.85, prodMax: 3, milShare: 0.42, rush: false },
  hard:     { feudalVil: 21, ecoGate: 0.55, think: 0.8, vil: [26, 54, 80, 100], firstAttack: 660,  wave: 22, waveGrow: 7, house: 6, techRate: 1.0, prodMax: 4, milShare: 0.50, rush: false },
  brutal:   { feudalVil: 19, ecoGate: 0.45, think: 0.6, vil: [28, 60, 90, 110], firstAttack: 480,  wave: 20, waveGrow: 8, house: 7, techRate: 1.0, prodMax: 5, milShare: 0.55, rush: true },
};

// Priority list of technologies (economy first). The AI researches the first affordable, available one per idle building.
const ECO_TECHS = ['loom', 'double_bit_axe', 'horse_collar', 'wheelbarrow', 'gold_mining', 'bow_saw', 'heavy_plow', 'hand_cart', 'stone_mining', 'gold_shaft_mining',
  'two_man_saw', 'crop_rotation', 'stone_shaft_mining', 'treadmill_crane'];
const MIL_TECHS = ['forging', 'scale_mail', 'fletching', 'padded_archer_armor', 'scale_barding', 'bloodlines', 'iron_casting', 'chain_mail', 'bodkin_arrow', 'leather_archer_armor',
  'chain_barding', 'husbandry', 'thumb_ring', 'squires', 'ballistics', 'masonry', 'blast_furnace', 'plate_mail', 'bracer', 'ring_archer_armor', 'plate_barding', 'siege_engineers',
  'conscription', 'architecture', 'sanctity', 'fervor', 'illumination', 'redemption', 'atonement', 'block_printing', 'guard_tower', 'keep', 'hoardings', 'coinage', 'banking'];

const TAUNTS = {
  launch: ['Prepare yourself!', 'My army marches on your town!', 'Your walls will not save you.', 'Here we come!', 'You cannot hold out forever.'],
  retreat: ['Fall back! We will return.', 'This is not over!'],
  age: ['Behold, a new age dawns for my people.'],
  panic: ['You dare strike my villagers?!'],
};
const MILITARY_BUILDINGS = ['barracks', 'archery_range', 'stable', 'siege_workshop', 'castle', 'monastery'];

export class AIPlayer {
  constructor(game, player) {
    this.game = game; this.p = player; this.idx = player.index;
    this.params = PARAMS[player.difficulty] || PARAMS.standard;
    this.civ = CIVS[player.civ];
    this.t = 0; this.thinkT = 1 + game.rng.next() * 1.5; this.attackT = 0; this.econT = 0.5;
    this.base = player.startPos;
    const enemy = game.players.find(q => q.index > 0 && q.index !== this.idx && game.isEnemy(this.idx, q.index));
    this.enemyBase = enemy ? enemy.startPos : { x: game.w / 2, y: game.h / 2 };
    this.state = { vills: [], mil: [], siege: [], prod: {}, counts: {}, idleV: [], gatherers: { food: 0, wood: 0, gold: 0, stone: 0 }, builders: 0, farmers: 0, b: {}, nb: () => 0 };
    this.wave = { state: 'idle', units: [], target: null, size: 0, launched: 0, launchT: 0, retreatT: 0, lastOrder: 0 };
    this.waves = 0;
    this.panic = { on: false, t: 0, garrisoned: [] };
    this.enemyComp = { cavalry: 0, archer: 0, infantry: 0, siege: 0, total: 0 };
    this.lastEnemySeen = 0;
    this.ageGoal = 0;
    this.failedSpots = new Set();
    this.buildCooldown = {};
    this.lastTrade = 0;
    this.scoutT = 0;
    this.foodPlan = 'sheep';
    this.stagger = game.rng.next() * 0.3;
    this.rushDone = false;
    this.mood = game.rng.next();                 // slight per-game personality
  }

  get g() { return this.game; }

  update(dt) {
    this.t += dt;
    this.thinkT -= dt; this.attackT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = this.params.think;
      if (!this.p.alive) return;
      this.refresh();
      this.defend();
      this.economy();
      this.construction();
      this.research();
      this.produceMilitary();
      this.trade();
      this.scoutHome();
    }
    if (this.attackT <= 0) {
      this.attackT = 2.5 * this.params.think;
      if (this.p.alive) this.manageAttack();
    }
  }

  // ================================================================ state refresh
  refresh() {
    this.refreshed = true;
    const g = this.g, p = this.p, st = this.state;
    st.vills = []; st.mil = []; st.siege = []; st.idleV = [];
    st.gatherers = { food: 0, wood: 0, gold: 0, stone: 0 }; st.builders = 0; st.farmers = 0;
    st.counts = {}; st.prod = {};
    for (const u of g.units) {
      if (u.owner !== this.idx || u.dead) continue;
      if (u.type === 'villager') {
        st.vills.push(u);
        const o = u.order;
        if (!o) { if (!u.garrison) st.idleV.push(u); }
        else if (o.type === 'gather') { const r = o.res || u.carryType; if (st.gatherers[r] !== undefined) st.gatherers[r]++; if (o.sub === 'farm') st.farmers++; }
        else if (o.type === 'build' || o.type === 'repair') st.builders++;
      } else if (u.def.military) {
        if (u.def.tags.includes('siege')) st.siege.push(u);
        st.mil.push(u);
      }
      st.counts[u.type] = (st.counts[u.type] || 0) + 1;
    }
    st.b = {};
    for (const b of g.buildings) {
      if (b.owner !== this.idx || b.dead) continue;
      (st.b[b.type] = st.b[b.type] || []).push(b);
    }
    st.nb = (type, built = true) => { const l = st.b[type] || []; return built ? l.filter(b => b.built).length : l.length; };
    // enemy composition (units near our assets or recently seen)
    const comp = { cavalry: 0, archer: 0, infantry: 0, siege: 0, total: 0 };
    for (const u of g.units) {
      if (u.dead || u.owner === 0 || !g.isEnemy(this.idx, u.owner) || !u.def.military) continue;
      const tags = u.def.tags;
      if (tags.includes('siege')) comp.siege++; else if (tags.includes('cavalry') && !tags.includes('archer')) comp.cavalry++; else if (tags.includes('archer') || tags.includes('skirmisher')) comp.archer++; else comp.infantry++;
      comp.total++;
    }
    this.enemyComp = comp;
    // hostile wildlife (wolves): avoid gathering near them and let the army clear them out
    this.danger = [];
    for (const u of g.units) if (!u.dead && u.owner === 0 && u.def.hostile) this.danger.push({ x: u.x, y: u.y, r: 11 });
  }

  // ================================================================ helpers
  idleBuilders(spot, count = 1) {
    const st = this.state;
    const pool = st.vills.filter(u => !u.garrison && (!u.order || (u.order.type === 'gather' && u.carry < 6)) && u.order?.type !== 'build');
    pool.sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y));
    return pool.slice(0, count);
  }
  /** Can we pay `cost` while leaving `reserve` untouched? The reserve only matters for resources the item actually costs. */
  canAfford(cost, reserve) {
    const r = reserve || {};
    for (const k of RES) {
      const c = cost[k] || 0;
      if (c > 0 && c + (r[k] || 0) > this.p.res[k] + 1e-6) return false;
    }
    return true;
  }
  dropoffNear(x, y, res, maxD) {
    for (const b of this.g.buildings) {
      if (b.owner !== this.idx || b.dead || !b.def.dropoff.includes(res)) continue;
      if (!b.built && b.type !== 'town_center') { if (distToRect(x, y, b.tx, b.ty, b.tx + b.size, b.ty + b.size) < maxD) return b; continue; }
      if (distToRect(x, y, b.tx, b.ty, b.tx + b.size, b.ty + b.size) <= maxD) return b;
    }
    return null;
  }

  /** Find a free top-left tile for a building near (nx, ny) trying spiral rings. */
  findSpot(type, nx, ny, maxR = 18, opts = {}) {
    const def = this.p.bdefs[type], size = def.size, g = this.g;
    const minR = opts.minR || 0;
    let best = null, bs = 1e9;
    for (let r = minR; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(nx + dx - size / 2), ty = Math.round(ny + dy - size / 2);
        if (this.failedSpots.has(tx + ',' + ty + type)) continue;
        if (!Cmd.canPlace(g, this.idx, type, tx, ty).ok) continue;
        if (!this.hasClearance(tx, ty, size, type)) continue;
        let score = Math.hypot(tx + size / 2 - nx, ty + size / 2 - ny);
        if (opts.score) score += opts.score(tx, ty);
        if (score < bs) { bs = score; best = { tx, ty }; }
      }
      if (best && r > (best ? Math.ceil(bs) + 1 : 0)) break;
    }
    return best;
  }
  /** Ensure we do not wall ourselves in: a ring of tiles around the footprint must be mostly walkable. */
  hasClearance(tx, ty, size, type) {
    const nav = this.g.nav; let free = 0, total = 0;
    for (let x = tx - 1; x <= tx + size; x++) for (let y = ty - 1; y <= ty + size; y++) {
      if (x >= tx && x < tx + size && y >= ty && y < ty + size) continue;
      total++;
      if (nav.walkTile(x, y, this.idx)) free++;
    }
    if (type === 'farm') return free >= total * 0.5;
    return free >= total * 0.62;
  }

  build(type, spot, builders, opts = {}) {
    if (!spot) return null;
    const b = Cmd.placeBuilding(this.g, this.idx, type, spot.tx, spot.ty, builders, opts);
    if (!b) this.failedSpots.add(spot.tx + ',' + spot.ty + type);
    return b;
  }

  count(type, includeUnfinished = true) { return this.state.nb(type, !includeUnfinished); }

  // ================================================================ DEFENSE
  defend() {
    const g = this.g, st = this.state;
    // find threatening enemy military near our buildings or villagers
    let threat = null, tpower = 0, tn = 0, cx = 0, cy = 0;
    const anchors = [];
    for (const b of g.buildings) if (b.owner === this.idx && !b.dead && !b.def.wall) anchors.push(b);
    for (const u of g.units) {
      if (u.dead || u.owner === 0 || !g.isEnemy(this.idx, u.owner) || u.garrison) continue;
      if (!u.def.military && !u.def.tags.includes('monk')) continue;
      let near = false;
      for (let i = 0; i < anchors.length; i += (anchors.length > 40 ? 3 : 1)) { const a = anchors[i]; if (Math.hypot(a.x - u.x, a.y - u.y) < 16 + a.size) { near = true; break; } }
      if (!near) continue;
      tn++; tpower += this.unitPower(u); cx += u.x; cy += u.y; if (!threat) threat = u;
    }
    this.threat = tn ? { x: cx / tn, y: cy / tn, n: tn, power: tpower } : null;
    const myPower = st.mil.reduce((s, u) => s + this.unitPower(u), 0);
    if (this.threat) {
      this.lastThreatT = this.t;
      // bring the army home to fight if it is out attacking and the base is seriously threatened
      const homeUnits = st.mil.filter(u => !u.garrison);
      for (const u of homeUnits) {
        if (u.order && u.order.type === 'attack' && !u.order.auto) continue;
        const farFromThreat = Math.hypot(u.x - this.threat.x, u.y - this.threat.y);
        if (this.wave.state === 'attacking' && this.wave.units.includes(u.id) && this.threat.power < myPower * 0.5) continue;
        if (!u.order || (u.order.type === 'move' && farFromThreat > 6) || (u.order.type === 'attackmove' && farFromThreat > 25)) {
          Cmd.orderMove(g, [u], this.threat.x, this.threat.y, { attackMove: true, noCap: true });
        }
      }
      // villagers near the threat run to the Town Center when we cannot beat it
      if (this.threat.power > myPower * 0.8 || myPower === 0) this.villagerPanic();
    } else if (this.panic.on && this.t - (this.lastThreatT || 0) > 8) this.endPanic();
    if (this.panic.on && this.threat) this.releaseShelters();
  }
  unitPower(u) {
    const d = u.def;
    let atk = 0; for (const k in d.atk) atk += d.atk[k] * (k === 'melee' || k === 'pierce' ? 1 : 0.3);
    const dps = atk / Math.max(0.8, d.reload);
    return (dps * 4 + 1) * (u.hp / 40 + 0.6) * (d.range > 0 ? 1.1 : 1) * (d.tags.includes('siege') ? 0.6 : 1);
  }
  villagerPanic() {
    const g = this.g, st = this.state;
    if (!this.threat) return;
    this.panic.on = true; this.panic.t = this.t;
    const garr = [...(st.b.town_center || []), ...(st.b.castle || []), ...(st.b.watch_tower || []), ...(st.b.guard_tower || []), ...(st.b.keep || [])].filter(b => b.built);
    for (const v of st.vills) {
      if (v.garrison) continue;
      if (Math.hypot(v.x - this.threat.x, v.y - this.threat.y) > 11) continue;       // only villagers near the danger run
      let best = null, bd = 1e9;
      for (const b of garr) {
        if (b.garrison.length >= b.def.garrison) continue;
        const d = Math.hypot(b.x - v.x, b.y - v.y);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) { Cmd.orderGarrison(g, [v], best); this.panic.garrisoned.push(v.id); }
    }
  }
  endPanic() {
    this.panic.on = false;
    const g = this.g;
    for (const b of g.buildings) if (b.owner === this.idx && b.garrison.length) for (const u of b.garrison.slice()) if (u.type === 'villager') g.ungarrisonUnit(u, b);
    this.panic.garrisoned = [];
  }
  /** release garrisoned villagers whose shelter is no longer threatened */
  releaseShelters() {
    const g = this.g;
    for (const b of g.buildings) {
      if (b.owner !== this.idx || b.dead || !b.garrison.length) continue;
      let danger = false;
      if (this.threat && Math.hypot(b.x - this.threat.x, b.y - this.threat.y) < 15) danger = true;
      if (!danger) for (const u of b.garrison.slice()) if (u.type === 'villager') g.ungarrisonUnit(u, b);
    }
  }

  // ================================================================ ECONOMY
  economy() {
    const g = this.g, p = this.p, st = this.state, pr = this.params;
    const age = p.age;
    const target = pr.vil[age];
    // ---- train villagers from every Town Center
    const tcs = (st.b.town_center || []).filter(b => b.built);
    const wantMore = st.vills.length + this.queuedVillagers() < target && !this.rushingMilitary();
    if (wantMore) {
      for (const tc of tcs) {
        if (tc.queue.some(it => it.kind === 'tech' && TECHS[it.id].age !== undefined)) continue;      // busy ageing up
        const queued = tc.queue.filter(it => it.kind === 'unit').length;
        if (queued < 2 && p.popFree > 0) {
          const n = Cmd.queueUnit(g, tc, 'villager', 1);
          if (n && queued === 0 && this.canAfford({ food: 50 }) && p.popFree > 1) Cmd.queueUnit(g, tc, 'villager', 1);
        }
      }
    }
    // ---- rally point: new villagers go straight to the wood line
    // ---- assign idle villagers
    for (const v of st.idleV) this.assignVillager(v);
    // ---- rebalance if badly skewed
    if (this.econT-- <= 0) { this.econT = 6; this.rebalance(); }
    // ---- repair damaged buildings with idle villagers
    this.repairBuildings();
  }
  queuedVillagers() {
    let n = 0;
    for (const b of this.state.b.town_center || []) for (const it of b.queue) if (it.kind === 'unit' && it.type === 'villager') n++;
    return n;
  }
  rushingMilitary() { return false; }

  /** Desired share of gatherers for each resource. */
  shares() {
    const p = this.p, st = this.state, age = p.age, n = st.vills.length;
    let s;
    if (age === 0) s = n < 8 ? { food: 0.5, wood: 0.5, gold: 0, stone: 0 } : n < 16 ? { food: 0.42, wood: 0.5, gold: 0.08, stone: 0 } : { food: 0.38, wood: 0.46, gold: 0.16, stone: 0 };
    else if (age === 1) s = { food: 0.36, wood: 0.36, gold: 0.24, stone: 0.04 };
    else if (age === 2) s = { food: 0.36, wood: 0.27, gold: 0.27, stone: 0.10 };
    else s = { food: 0.34, wood: 0.25, gold: 0.31, stone: 0.10 };
    // react to stockpiles: favour what we are short of, back off what we are swimming in
    const res = p.res;
    for (const r of RES) { const f = Math.max(0.35, Math.min(2.4, 700 / (res[r] + 350))); s[r] *= (r === 'wood' ? f * 1.1 : f); }
    // needs: if we are saving for something specific bump it
    const need = this.nextNeed();
    const saving = this.ageSaving();
    const pend = this.pendingBuilding;
    if (pend && !saving) for (const r of RES) if (pend.cost[r] && res[r] < pend.cost[r]) s[r] *= 1.6;
    const boost = saving ? 3.2 : 1.35;                    // advancing an age beats everything else
    for (const r of RES) if (need[r] && res[r] < need[r]) s[r] *= boost;
    // stone only when castle/towers wanted
    if (age < 1 || (st.b.castle && st.b.castle.length) || st.nb('castle', false)) s.stone *= age < 1 ? 0 : 0.4;
    if (age >= 2 && !st.nb('castle', false) && p.res.stone < 650) s.stone = Math.max(s.stone, 0.12);
    const tot = RES.reduce((a, r) => a + s[r], 0);
    for (const r of RES) s[r] /= tot;
    return s;
  }
  /** Everything the AI is currently saving for: the next age plus the next planned building. */
  totalReserve() {
    const r = Object.assign({}, this.ageSaving() ? this.nextNeed() : {});
    const b = this.pendingBuilding;
    if (b) for (const k in b.cost) r[k] = (r[k] || 0) + b.cost[k];
    return r;
  }
  nextNeed() {
    const p = this.p, need = { food: 0, wood: 0, gold: 0, stone: 0 };
    if (p.age < 3) {
      const agetech = ['feudal_age', 'castle_age', 'imperial_age'][p.age];
      const t = TECHS[agetech];
      for (const r of RES) need[r] = t.cost[r] || 0;
    }
    return need;
  }
  assignVillager(v) {
    const st = this.state, sh = this.shares();
    const n = Math.max(1, st.vills.length);
    // pick resource with greatest deficit
    let best = 'food', bd = -1e9;
    for (const r of RES) {
      const def = sh[r] * n - st.gatherers[r];
      if (def > bd) { bd = def; best = r; }
    }
    if (this.assignTo(v, best)) { st.gatherers[best]++; return true; }
    // fallbacks
    for (const r of ['wood', 'food', 'gold', 'stone']) if (r !== best && this.assignTo(v, r)) { st.gatherers[r]++; return true; }
    return false;
  }
  tcPos() { const tcs = this.state.b.town_center; const tc = tcs && tcs.find(b => b.built) || tcs && tcs[0]; return tc ? { x: tc.x, y: tc.y } : this.base; }

  assignTo(v, res) {
    const g = this.g, st = this.state, c = this.tcPos();
    if (res === 'wood') {
      const camp = this.nearestOwn('lumber_camp', v.x, v.y);
      const cx = camp ? camp.x : c.x, cy = camp ? camp.y : c.y;
      const t = g.findNearestResource(cx, cy, 'wood', 30, { avoid: this.danger });
      if (!t) return false;
      Cmd.orderGather(g, [v], t); return true;
    }
    if (res === 'gold' || res === 'stone') {
      const camp = this.nearestOwn('mining_camp', c.x, c.y);
      const m = g.findNearestResource(camp ? camp.x : c.x, camp ? camp.y : c.y, res, 45, { avoid: this.danger });
      if (!m) return false;
      Cmd.orderGather(g, [v], m); return true;
    }
    // food: sheep -> berries -> farms -> deer
    const free = this.freeFarm(v);
    const sheep = g.units.find(u => u.owner === this.idx && u.type === 'sheep' && !u.dead && Math.hypot(u.x - c.x, u.y - c.y) < 14);
    if (sheep && st.gatherers.food < 5 && (this.p.age === 0)) { Cmd.orderGather(g, [v], sheep); return true; }
    const berry = g.findNearestResource(c.x, c.y, 'food', 24, { sub: 'berries', avoid: this.danger });
    if (berry && (st.gatherers.food < 8 || !free)) {
      const mill = this.dropoffNear(berry.x, berry.y, 'food', 6);
      if (mill) { Cmd.orderGather(g, [v], berry); return true; }
    }
    if (free) { Cmd.orderGather(g, [v], free); return true; }
    const deer = this.nearestHuntable(c);
    if (deer && this.dropoffNear(deer.x, deer.y, 'food', 12)) { Cmd.orderGather(g, [v], deer); return true; }
    if (berry) { Cmd.orderGather(g, [v], berry); return true; }
    // nothing to eat yet: build a farm with this villager
    return this.buildFarmWith(v);
  }
  nearestHuntable(c) {
    let best = null, bd = 1e9;
    for (const u of this.g.units) {
      if (u.dead || u.owner !== 0 || u.type !== 'deer') continue;
      const d = Math.hypot(u.x - c.x, u.y - c.y);
      if (d < bd && d < 26) { bd = d; best = u; }
    }
    // carcasses are better still
    const car = this.g.findNearestResource(c.x, c.y, 'food', 20, { sub: 'carcass' });
    return car || best;
  }
  freeFarm(v) {
    let best = null, bd = 1e9;
    for (const b of this.g.buildings) {
      if (b.owner !== this.idx || b.dead || b.type !== 'farm' || !b.built || b.farmer) continue;
      if (b.amount <= 0 && !this.p.canAfford(this.p.bdefs.farm.cost)) continue;
      const d = Math.hypot(b.x - v.x, b.y - v.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  buildFarmWith(v) {
    const p = this.p;
    if (!p.hasBuilding('mill') && !p.hasBuilding('town_center')) return false;
    if (!this.p.canAfford(p.bdefs.farm.cost)) return false;
    const spot = this.farmSpot();
    if (!spot) return false;
    const b = this.build('farm', spot, [v]);
    return !!b;
  }
  farmSpot() {
    const c = this.tcPos();
    // prefer around mills and the town center
    const anchors = [];
    for (const b of (this.state.b.mill || [])) if (b.built) anchors.push(b);
    for (const b of (this.state.b.town_center || [])) if (b.built) anchors.push(b);
    let best = null, bs = 1e9;
    for (const a of anchors) {
      const s = this.findSpot('farm', a.x, a.y, 9, { minR: Math.ceil(a.size / 2) + 1 });
      if (!s) continue;
      const score = Math.hypot(s.tx + 1.5 - a.x, s.ty + 1.5 - a.y);
      if (score < bs) { bs = score; best = s; }
    }
    return best;
  }
  nearestOwn(type, x, y) {
    let best = null, bd = 1e9;
    for (const b of (this.state.b[type] || [])) { if (!b.built) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  rebalance() {
    const st = this.state, sh = this.shares(), n = st.vills.length;
    if (n < 10) return;
    // move up to 2 villagers from the most over-staffed resource to the most under-staffed one
    let over = null, under = null, ob = 0, ub = 0;
    for (const r of RES) {
      const diff = st.gatherers[r] - sh[r] * n;
      if (diff > ob) { ob = diff; over = r; }
      if (-diff > ub) { ub = -diff; under = r; }
    }
    if (!over || !under || ob < 2 || ub < 2) return;
    const movers = st.vills.filter(v => v.order && v.order.type === 'gather' && (v.order.res === over) && v.carry < 3 && (v.order.sub !== 'farm' || (over === 'food' && this.p.res.food > 700))).slice(0, Math.min(3, Math.floor(Math.min(ob, ub))));
    for (const v of movers) {
      if (this.assignTo(v, under)) { st.gatherers[over]--; st.gatherers[under]++; }
    }
  }

  repairBuildings() {
    const g = this.g, st = this.state;
    if (!this.cd('repair', 7)) return;
    for (const list of Object.values(st.b)) for (const b of list) {
      if (!b.built || b.hp > b.maxHp * 0.7 || b.def.wall) continue;
      if (this.threat && Math.hypot(b.x - this.threat.x, b.y - this.threat.y) < 10) continue;
      const rep = st.vills.find(v => !v.garrison && v.order && v.order.type === 'repair' && v.order.target === b.id);
      if (rep) continue;
      const v = this.idleBuilders(b, 1)[0];
      if (v) Cmd.orderRepair(g, [v], b);
    }
  }

  // ================================================================ CONSTRUCTION
  construction() {
    const g = this.g, p = this.p, st = this.state, pr = this.params, age = p.age;
    const c = this.tcPos();
    const vills = st.vills.length;
    if (!vills) return;
    const unfinished = (type) => (st.b[type] || []).filter(b => !b.built).length;
    this.staffConstruction();
    // ---- houses
    const prodCount = MILITARY_BUILDINGS.reduce((s, t) => s + st.nb(t, true), 0) + st.nb('town_center', true);
    const buffer = pr.house + prodCount * 1.6 + (age >= 2 ? 3 : 0);
    const housesInProgress = unfinished('house');
    if (p.popCap < 200 && p.popCap - p.pop - p.popReserved < buffer && housesInProgress < (vills > 30 ? 2 : 1) && p.res.wood >= 25 && this.cd('house', 2)) {
      const spot = this.houseSpot();
      if (spot) { const bl = this.idleBuilders(spot, vills > 25 ? 2 : 1); if (bl.length) this.build('house', spot, bl); }
    }
    // ---- drop-off buildings
    this.dropoffs();
    // ---- farms
    this.farms();
    // ---- age-prereq & military buildings
    this.buildPlan();
  }
  /** every unfinished building needs a builder: foundations whose builders died or wandered off are re-staffed */
  staffConstruction() {
    const g = this.g, st = this.state;
    const targeted = new Map();
    for (const v of st.vills) {
      if (v.order && v.order.type === 'build') targeted.set(v.order.target, (targeted.get(v.order.target) || 0) + 1);
      for (const q of v.queue) if (q.type === 'build') targeted.set(q.target, (targeted.get(q.target) || 0) + 1);
    }
    for (const list of Object.values(st.b)) for (const b of list) {
      if (b.built || b.dead || b.def.wall) continue;
      const have = targeted.get(b.id) || 0;
      const want = b.def.time > 100 ? 3 : 1;
      if (have >= want) continue;
      const pool = st.vills.filter(v => !v.garrison && !(v.order && v.order.type === 'build') && (!v.order || (v.order.type === 'gather' && v.carry < 5)));
      pool.sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y));
      const picks = pool.slice(0, want - have);
      if (picks.length) Cmd.orderBuild(g, picks, b);
    }
  }
  cd(key, secs) {
    const last = this.buildCooldown[key] || -99;
    if (this.t - last < secs) return false;
    this.buildCooldown[key] = this.t;
    return true;
  }
  houseSpot() {
    const c = this.tcPos();
    // houses go in a ring behind the town center (away from the enemy)
    const dx = c.x - this.enemyBase.x, dy = c.y - this.enemyBase.y, l = Math.hypot(dx, dy) || 1;
    const ax = c.x + dx / l * 9, ay = c.y + dy / l * 9;
    return this.findSpot('house', ax, ay, 14, { score: (tx, ty) => { const d = Math.hypot(tx - c.x, ty - c.y); return d < 5 ? 8 : 0; } });
  }
  dropoffs() {
    const g = this.g, p = this.p, st = this.state, c = this.tcPos();
    if (!this.cd('dropoffs', 4)) return;
    const wood = 100;
    // lumber camp first: wood is the bottleneck of every build order
    if (p.res.wood >= wood && st.gatherers.wood >= 2 && !(st.b.lumber_camp || []).some(b => !b.built)) {
      const ts = this.woodWorkSites();
      if (ts) {
        const spot = this.findSpot('lumber_camp', ts.x, ts.y, 7, { score: (tx, ty) => -this.resNearScore(tx, ty, 4.5, ['tree']) * 0.6 });
        if (spot) { const bl = this.idleBuilders(spot, 1); if (bl.length) { this.build('lumber_camp', spot, bl); return; } }
      }
    }
    // mill by the berries
    if (p.res.wood >= wood) {
      const berry = g.findNearestResource(c.x, c.y, 'food', 24, { sub: 'berries' });
      if (berry && !this.dropoffNear(berry.x, berry.y, 'food', 5) && st.vills.length >= 5 && !(st.b.mill || []).some(b => !b.built)) {
        const spot = this.findSpot('mill', berry.x, berry.y, 6, { score: (tx, ty) => this.resNearScore(tx, ty, 2, ['berries']) });
        if (spot) { const bl = this.idleBuilders(spot, 1); if (bl.length) { this.build('mill', spot, bl); return; } }
      }
    }
    // mining camp near gold / stone
    if (p.res.wood >= wood && (st.gatherers.gold + st.gatherers.stone) >= 2 && !(st.b.mining_camp || []).some(b => !b.built)) {
      for (const res of ['gold', 'stone']) {
        if (!st.gatherers[res]) continue;
        const m = g.findNearestResource(c.x, c.y, res, 45);
        if (m && !this.dropoffNear(m.x, m.y, res, 5)) {
          const spot = this.findSpot('mining_camp', m.x, m.y, 6, { score: (tx, ty) => -this.resNearScore(tx, ty, 3.5, [res]) * 0.7 });
          if (spot) { const bl = this.idleBuilders(spot, 1); if (bl.length) { this.build('mining_camp', spot, bl); return; } }
        }
      }
    }
  }
  /** where our woodcutters are working (position of the nearest tree to the town center that is far from a camp) */
  woodWorkSites() {
    const g = this.g, c = this.tcPos();
    const camp = this.nearestOwn('lumber_camp', c.x, c.y);
    // nearest tree from where cutters currently are
    const cutters = this.state.vills.filter(v => v.order && v.order.type === 'gather' && v.order.res === 'wood');
    let px = c.x, py = c.y;
    if (cutters.length) { px = 0; py = 0; for (const v of cutters) { px += v.x; py += v.y; } px /= cutters.length; py /= cutters.length; }
    const tree = g.findNearestResource(px, py, 'wood', 24);
    if (!tree) return null;
    if (this.dropoffNear(tree.x, tree.y, 'wood', 6)) return null;      // already close to a drop-off
    return { x: tree.x, y: tree.y };
  }
  resNearScore(tx, ty, r, subs) {
    const list = this.g.queryStatic(tx + 1, ty + 1, r, 'resource');
    let n = 0; for (const e of list) if (subs.includes(e.sub)) n++;
    return n;
  }
  /** Resources earmarked for the building we must construct to unlock the next age. */
  buildReserve() {
    const need = this.ageBuildingNeeds();
    const r = {};
    for (const t of need) { const c = this.p.bdefs[t].cost; for (const k in c) r[k] = (r[k] || 0) + c[k]; }
    return r;
  }
  farms() {
    const p = this.p, st = this.state;
    if (!p.hasBuilding('mill') && !p.hasBuilding('town_center')) return;
    if (!p.hasBuilding('mill')) return;
    const farms = (st.b.farm || []);
    const unfinished = farms.filter(b => !b.built).length;
    const berryLeft = this.g.findNearestResource(this.tcPos().x, this.tcPos().y, 'food', 24, { sub: 'berries' });
    const foodTarget = Math.round(st.vills.length * this.shares().food);
    // farms needed once natural food starts running thin
    const needed = berryLeft && st.vills.length < 14 ? 0 : Math.max(0, Math.min(foodTarget - (berryLeft ? 4 : 0), 40));
    const breserve = this.buildReserve();
    const pend = this.pendingBuilding && farms.length >= 5 ? (this.pendingBuilding.cost.wood || 0) : 0;      // keep saving for the next planned building once a few farms exist
    if (farms.length < needed && unfinished < 2 && p.res.wood >= 60 + (breserve.wood || 0) + pend && this.cd('farm', 3)) {
      const spot = this.farmSpot();
      if (spot) { const bl = this.idleBuilders(spot, 1); if (bl.length) this.build('farm', spot, bl); }
    }
  }
  buildPlan() {
    const g = this.g, p = this.p, st = this.state, pr = this.params, age = p.age;
    const c = this.tcPos();
    const vills = st.vills.length;
    if (!this.cd('buildplan', 3)) return;
    const unfinished = (t) => (st.b[t] || []).filter(b => !b.built).length;
    const total = (t) => (st.b[t] || []).length;
    // reserve resources for the pending age advance
    const reserve = this.ageSaving() ? this.nextNeed() : {};
    // wanted production buildings by age
    const civ = p.civ;
    const style = this.civ.ai.style;
    const wants = [];
    const archerCiv = style === 'ranged' || style === 'cavalry-archer';
    if (age >= 0 && vills >= 14 && (p.age >= 1 || vills >= 20)) wants.push(['barracks', 1]);
    if (age >= 1) {
      wants.push([archerCiv ? 'archery_range' : 'stable', 1], ['blacksmith', 1], ['market', 1], [archerCiv ? 'stable' : 'archery_range', 1]);
    }
    if (age >= 2) {
      wants.push(['siege_workshop', 1], ['university', 1], ['monastery', 1], ['barracks', Math.min(pr.prodMax, 2)], [archerCiv ? 'archery_range' : 'stable', Math.min(pr.prodMax, 2)], ['castle', 1]);
    }
    if (age >= 3) {
      wants.push(['barracks', Math.min(pr.prodMax, 3)], ['stable', Math.min(pr.prodMax, 2)], ['archery_range', Math.min(pr.prodMax, 2)], ['castle', Math.min(pr.prodMax - 1, 2)]);
    }
    // age-up prerequisites
    const need = this.ageBuildingNeeds();
    for (const t of need) wants.unshift([t, 1]);
    this.pendingBuilding = null;
    for (const [type, n] of wants) {
      const def = p.bdefs[type];
      if (def.ageReq > age) continue;
      if (total(type) >= n) continue;
      if (unfinished(type)) continue;
      // economy first: do not build military until a decent villager base exists (unless needed for the age advance)
      if (!need.includes(type) && vills < Math.min(pr.vil[Math.min(age, 3)] * 0.55, 30)) continue;
      const spot = this.milSpot(type);
      if (!spot) continue;
      if (!this.canAfford(def.cost, need.includes(type) ? {} : reserve)) {
        // save up for it: everything later in the list waits (units and techs also leave this amount alone)
        this.pendingBuilding = def;
        break;
      }
      const bl = this.idleBuilders(spot, def.time > 100 ? 3 : 2);
      if (!bl.length) continue;
      const b = this.build(type, spot, bl);
      if (b) return;
    }
    // a second Town Center for big economies
    if (age >= 1 && vills >= 32 && total('town_center') < (age >= 2 ? 3 : 2) && unfinished('town_center') === 0 && p.res.wood >= p.bdefs.town_center.cost.wood + 100 && p.res.stone >= 100 && this.cd('tc2', 60)) {
      const spot = this.expansionSpot();
      if (spot) { const bl = this.idleBuilders(spot, 3); if (bl.length) this.build('town_center', spot, bl); }
    }
    // defensive towers near the town center when rich in stone
    if (age >= 1 && p.res.stone >= 250 + (this.totalReserve().stone || 0) && p.res.wood >= 150 + (this.buildReserve().wood || 0) && total('watch_tower') + total('guard_tower') + total('keep') < (age >= 2 ? 4 : 2) && vills > 30 && this.cd('tower', 40)) {
      const dx = this.enemyBase.x - c.x, dy = this.enemyBase.y - c.y, l = Math.hypot(dx, dy) || 1;
      const spot = this.findSpot(p.towerType(), c.x + dx / l * 9, c.y + dy / l * 9, 6);
      if (spot) { const bl = this.idleBuilders(spot, 1); if (bl.length) this.build(p.towerType(), spot, bl); }
    }
  }
  milSpot(type) {
    const c = this.tcPos();
    // military buildings sit between the town center and the enemy, a little off to the side
    const dx = this.enemyBase.x - c.x, dy = this.enemyBase.y - c.y, l = Math.hypot(dx, dy) || 1;
    const px = -dy / l, py = dx / l;
    const side = ((this.state.b[type] || []).length % 2 ? 1 : -1) * 6;
    const n = Object.values(this.state.b).reduce((s, a) => s + a.length, 0);
    return this.findSpot(type, c.x + dx / l * 10 + px * side, c.y + dy / l * 10 + py * side, 16);
  }
  expansionSpot() {
    const g = this.g, c = this.tcPos();
    // near gold or wood far from the current town center
    let best = null, bs = -1;
    for (const r of g.resources) {
      if (r.dead || (r.sub !== 'gold' && r.sub !== 'tree')) continue;
      const d = Math.hypot(r.x - c.x, r.y - c.y);
      if (d < 18 || d > 40) continue;
      const score = this.resNearScore(Math.floor(r.x), Math.floor(r.y), 8, ['gold', 'tree', 'stone']) - d * 0.2;
      if (score > bs) { bs = score; best = r; }
    }
    if (!best) return null;
    return this.findSpot('town_center', best.x, best.y, 9, { minR: 3 });
  }
  /** Which buildings still need to exist so that we can click the next age */
  ageBuildingNeeds() {
    const p = this.p, st = this.state;
    if (p.age >= 3 || !this.wantsAge()) return [];
    const ageTech = ['feudal_age', 'castle_age', 'imperial_age'][p.age];
    const res = Cmd.ageRequirement(this.g, p, ageTech);
    if (res.ok) return [];
    const prev = p.age;
    const have = new Set();
    for (const b of this.g.buildings) if (b.owner === this.idx && !b.dead && b.built) have.add(b.type);
    const out = [];
    const cands = prev === 0 ? ['mill', 'lumber_camp', 'barracks', 'mining_camp'] : prev === 1 ? ['blacksmith', 'market', 'archery_range', 'stable'] : ['university', 'monastery', 'siege_workshop', 'castle'];
    let distinct = 0;
    for (const t of cands) if (have.has(t)) distinct++;
    const queued = new Set((st.b || {}) ? Object.keys(st.b).filter(t => st.b[t].length) : []);
    for (const t of cands) { if (distinct >= 2) break; if (!queued.has(t) && this.p.bdefs[t].ageReq <= p.age) { out.push(t); distinct++; } }
    if (p.age === 2 && !have.has('castle') && !have.has('university') && !queued.has('university')) out.unshift('university');
    return out;
  }
  wantsAge() {
    const p = this.p, st = this.state, pr = this.params;
    if (p.age >= 3) return false;
    return st.vills.length >= (p.age === 0 ? pr.feudalVil : pr.vil[p.age] * 0.8);
  }
  ageSaving() { return this.wantsAge() && this.p.age < 3; }

  // ================================================================ RESEARCH
  research() {
    const g = this.g, p = this.p, st = this.state, pr = this.params;
    // age advance
    if (p.age < 3 && this.wantsAge()) {
      const tcs = (st.b.town_center || []).filter(b => b.built && !b.queue.some(it => it.kind === 'tech'));
      const ageTech = ['feudal_age', 'castle_age', 'imperial_age'][p.age];
      if (tcs.length && Cmd.canResearch(g, tcs[0], ageTech).ok) Cmd.queueTech(g, tcs[0], ageTech);
    }
    const saving = this.ageSaving() || !!this.pendingBuilding;
    const reserve = this.totalReserve();
    const ageUpInProgress = (st.b.town_center || []).some(b => b.queue.some(it => it.kind === 'tech' && TECHS[it.id].age !== undefined));
    // research from idle buildings
    for (const [type, list] of Object.entries(st.b)) {
      for (const b of list) {
        if (!b.built || b.queue.length) continue;
        if (type === 'town_center' || BUILDINGS[type].wall) continue;
        // unit upgrades first for military buildings, then general tech priority
        const cand = this.pickTech(b, saving ? reserve : null);
        if (cand && this.g.rng.next() < pr.techRate) Cmd.queueTech(g, b, cand);
      }
    }
    // town center techs
    for (const tc of st.b.town_center || []) {
      if (!tc.built || tc.queue.length) continue;
      for (const id of ['loom', 'wheelbarrow', 'hand_cart', 'town_watch']) {
        if (Cmd.canResearch(g, tc, id).ok && this.canAfford(TECHS[id].cost, saving && !ageUpInProgress ? reserve : {})) { Cmd.queueTech(g, tc, id); break; }
      }
    }
  }
  pickTech(b, reserve) {
    const g = this.g, p = this.p;
    const type = b.type;
    const eco = ECO_TECHS.filter(id => TECHS[id].building === type);
    const mil = MIL_TECHS.filter(id => TECHS[id].building === type);
    // unit line upgrades for production buildings
    const upgrades = Object.values(TECHS).filter(t => t.building === type && t.unitUpgrade && this.useful(t));
    // civ unique techs at the castle
    const uniq = type === 'castle' ? [...this.civ.techs, 'conscription', LINES[this.civ.uu][1]] : [];
    const list = [...eco, ...uniq, ...upgrades.map(t => t.id), ...mil];
    for (const id of list) {
      const t = TECHS[id];
      if (!Cmd.canResearch(g, b, id).ok) continue;
      if (!this.canAfford(t.cost, reserve || {})) continue;
      // keep a floor of resources for units: do not spend the last 150 gold on techs unless economic
      if (!ECO_TECHS.includes(id) && p.res.gold - (t.cost.gold || 0) < 40 && p.age >= 2 && (t.cost.gold || 0) > 0 && this.g.rng.next() < 0.5) continue;
      return id;
    }
    return null;
  }
  useful(t) {
    // only upgrade lines we actually train
    const to = t.unitUpgrade; const line = Object.keys(LINES).find(l => LINES[l].includes(to));
    if (!line) return false;
    const comp = this.civ.ai.army.map(a => a[0]);
    if (comp.includes(line)) return true;
    if (line === this.civ.uu) return true;
    return ['swordsman', 'spearman', 'archer', 'knight', 'scout'].includes(line) && this.g.rng.next() < 0.4;
  }

  // ================================================================ MILITARY PRODUCTION
  produceMilitary() {
    const g = this.g, p = this.p, st = this.state, pr = this.params, age = p.age;
    if (!st.vills.length) return;
    const popTotal = p.pop;
    const milNow = st.mil.length + this.queuedMilitary();
    const milTarget = Math.max(6, Math.floor(Math.max(p.popCap * pr.milShare, 12)));
    // before the villager target is met, only a trickle of soldiers (to defend)
    const ecoPhase = st.vills.length < pr.vil[Math.min(age, 3)] * pr.ecoGate && !this.threat && !(pr.rush && age >= 1 && !this.rushDone);
    const reserve = this.totalReserve();
    if (ecoPhase && st.mil.length >= (age === 0 ? (pr.rush ? 4 : 2) : (pr.ecoGate < 0.7 ? 6 : 4))) return;
    if (milNow >= milTarget && !this.threat) return;
    const comp = this.desiredComposition();
    for (const type of MILITARY_BUILDINGS) {
      for (const b of st.b[type] || []) {
        if (!b.built) continue;
        if (b.queue.length >= 2) continue;
        if (p.popFree < 1) return;
        const lines = p.producibleLines(type);
        // choose the line with the lowest satisfied ratio
        let bestLine = null, bs = 1e9;
        for (const line of lines) {
          const unit = p.unitFor(line); const d = p.defs[unit];
          if (d.ageReq > age) continue;
          if (type === 'barracks' && line === 'huskarl' && !comp[line]) continue;
          if (line === 'monk' && (st.counts.monk || 0) >= 4 + Math.floor(st.mil.length / 12)) continue;
          if (line === 'trebuchet' && (st.counts.trebuchet || 0) >= 3) continue;
          if (['ram', 'mangonel', 'scorpion'].includes(line) && !this.wantSiege(line)) continue;
          const w = comp[line] !== undefined ? comp[line] : (line === this.civ.uu ? 2 : 0.5);
          if (w <= 0) continue;
          const have = this.countLine(line);
          const s = (have + this.queuedLine(line)) / w;
          if (s < bs && this.canAfford(d.cost, ecoPhase ? {} : reserve)) { bs = s; bestLine = line; }
        }
        if (bestLine) Cmd.queueUnit(g, b, bestLine, 1);
      }
    }
  }
  queuedMilitary() {
    let n = 0;
    for (const b of this.g.buildings) if (b.owner === this.idx) for (const it of b.queue) if (it.kind === 'unit' && it.type !== 'villager') n++;
    return n;
  }
  queuedLine(line) { let n = 0; for (const b of this.g.buildings) if (b.owner === this.idx) for (const it of b.queue) if (it.kind === 'unit' && it.line === line) n++; return n; }
  countLine(line) { let n = 0; const ids = new Set(LINES[line]); for (const u of this.state.mil) if (ids.has(u.type)) n++; return n; }
  wantSiege(line) {
    const have = (this.state.counts.ram || 0) + (this.state.counts.capped_ram || 0) + (this.state.counts.siege_ram || 0) + (this.state.counts.mangonel || 0) + (this.state.counts.onager || 0) + (this.state.counts.siege_onager || 0) + (this.state.counts.scorpion || 0);
    const cap = this.p.age >= 3 ? 6 : 4;
    if (have >= cap) return false;
    if (line === 'scorpion') return this.enemyComp.infantry + this.enemyComp.archer > 8 && have < 2;
    if (line === 'ram') return this.civ.ai.siege.includes('ram') || have < 2;
    return this.civ.ai.siege.includes(line) || have < 2;
  }
  /** desired weights per unit line, adapted to the enemy army */
  desiredComposition() {
    const comp = {};
    for (const [line, w] of this.civ.ai.army) comp[line] = w;
    comp[this.civ.uu] = (comp[this.civ.uu] || 0) + 3;
    const e = this.enemyComp, tot = Math.max(1, e.total);
    // counters
    if (e.cavalry / tot > 0.3) { comp.spearman = (comp.spearman || 0) + 5; comp.camel = (comp.camel || 0) + 2; comp.knight = (comp.knight || 0) * 0.5; }
    if (e.archer / tot > 0.35) { comp.skirmisher = (comp.skirmisher || 0) + 3; comp.scout = (comp.scout || 0) + 2; comp.knight = (comp.knight || 0) + 2; comp.huskarl = (comp.huskarl || 0) + 2; }
    if (e.infantry / tot > 0.4) { comp.archer = (comp.archer || 0) + 4; comp.mangonel = (comp.mangonel || 0) + 1; }
    if (this.p.age >= 2 && !comp.monk) comp.monk = 1;
    return comp;
  }

  // ================================================================ MARKET
  trade() {
    const g = this.g, p = this.p;
    if (!p.hasBuilding('market') || this.t - this.lastTrade < 5) return;
    this.lastTrade = this.t;
    const need = this.nextNeed();
    // sell surplus for gold
    for (const r of ['food', 'wood', 'stone']) {
      const cap = r === 'stone' ? 500 : 900;
      if (p.res[r] > cap + 150 && !(r === 'food' && p.age < 3 && p.res.food < (need.food || 0) + 300)) Cmd.trade(g, this.idx, r, 'sell', 100);
    }
    // buy gold when starved of it and we have plenty of wood/food
    if (p.res.gold < (need.gold || 200) && p.res.food > (need.food || 0) + 600) Cmd.trade(g, this.idx, 'food', 'sell', 100);
    // floating gold: convert it into whatever is scarce (wood and food gate nearly everything)
    const goldFloor = (need.gold || 0) + 250;
    for (const r of ['wood', 'food']) {
      if (p.res[r] < 150 && p.res.gold > goldFloor + 140) { Cmd.trade(g, this.idx, r, 'buy', 100); break; }
    }
  }

  // ================================================================ SCOUT
  scoutHome() {
    const st = this.state;
    const scout = st.mil.find(u => u.type === 'scout' && !u.order);
    if (!scout || this.wave.state === 'attacking' || this.p.age > 1) return;
    if (this.t - this.scoutT < 25) return;
    this.scoutT = this.t;
    const g = this.g;
    const a = this.g.rng.next() * Math.PI * 2, r = 14 + this.g.rng.next() * 30;
    const x = Math.max(4, Math.min(g.w - 4, this.base.x + Math.cos(a) * r)), y = Math.max(4, Math.min(g.h - 4, this.base.y + Math.sin(a) * r));
    Cmd.orderMove(g, [scout], x, y, { noCap: true });
  }

  // ================================================================ ATTACK MANAGEMENT
  armyUnits() {
    // military units not tied up with defense or garrisoned; scouts stay out of waves
    return this.state.mil.filter(u => !u.dead && !u.garrison && u.type !== 'scout' && u.type !== 'monk' || (u.type === 'monk' && !u.garrison));
  }
  manageAttack() {
    const g = this.g, p = this.p, st = this.state, pr = this.params, w = this.wave;
    this.refreshIfStale();
    const army = this.armyUnits();
    const power = army.reduce((s, u) => s + this.unitPower(u), 0);
    const siegeCount = army.filter(u => u.def.tags.includes('siege')).length;
    // gather point (staging) in front of the base
    const c = this.tcPos();
    const dx = this.enemyBase.x - c.x, dy = this.enemyBase.y - c.y, l = Math.hypot(dx, dy) || 1;
    const stage = { x: c.x + dx / l * 14, y: c.y + dy / l * 14 };
    const sp = g.nav.nearestWalkable(stage.x, stage.y, this.idx, 8) || [stage.x, stage.y];
    // park idle army units at the staging point
    if (w.state === 'idle') {
      for (const u of army) if (!u.order && Math.hypot(u.x - sp[0], u.y - sp[1]) > 7 && !this.threat) Cmd.orderMove(g, [u], sp[0] + (this.g.rng.next() - 0.5) * 5, sp[1] + (this.g.rng.next() - 0.5) * 5, { noCap: true });
      const wonderPanic = !!this.enemyWonder() && army.length >= 5;
      if (wonderPanic) { this.launch(army, sp); return; }
      const need = pr.wave + this.waves * pr.waveGrow;
      const timeOk = this.t >= pr.firstAttack || (pr.rush && p.age >= 1 && army.length >= 8 && this.t > 300);
      const ageOk = p.age >= (pr.firstAttack > 900 ? 2 : 1);
      if (timeOk && ageOk && army.length >= need * (this.t > pr.firstAttack + 300 ? 0.8 : 1) && !this.threat) this.launch(army, sp);
      if (pr.rush && !this.rushDone && p.age >= 1 && army.length >= 8 && this.t > 240 && !this.threat) { this.rushDone = true; this.launch(army.filter(u => !u.def.tags.includes('siege')), sp); }
    } else if (w.state === 'attacking') this.continueAttack(army);
    else if (w.state === 'retreating') {
      if (this.t - w.retreatT > 25) { w.state = 'idle'; }
    }
  }
  refreshIfStale() { if (!this.refreshed) { this.refreshed = true; this.refresh(); } }

  launch(army, stage) {
    const g = this.g, w = this.wave;
    if (!army.length) return;
    w.state = 'attacking'; w.units = army.map(u => u.id); w.size = army.length; w.launchT = this.t; w.lastOrder = -99; w.target = null; this.waves++;
    if (this.waves <= 4 && this.g.rng.next() < 0.7 && this.g.isEnemy(this.idx, this.g.humanIndex)) this.g.chat(this.idx, TAUNTS.launch[Math.floor(this.g.rng.next() * TAUNTS.launch.length)]);
    this.chooseTarget(army);
    this.sendWave(army);
  }
  centroid(units) { let x = 0, y = 0; for (const u of units) { x += u.x; y += u.y; } return { x: x / units.length, y: y / units.length }; }
  enemyWonder() {
    for (const b of this.g.buildings) if (!b.dead && b.type === 'wonder' && this.g.isEnemy(this.idx, b.owner) && b.built) return b;
    return null;
  }
  chooseTarget(army) {
    const wonder = this.enemyWonder();
    if (wonder) { this.wave.target = { x: wonder.x, y: wonder.y, id: wonder.id }; return; }
    const g = this.g, c = army.length ? this.centroid(army) : this.base;
    const hasSiege = army.filter(u => u.def.tags.includes('siege')).length >= 2;
    // enemy defensive structures: attacking inside their fire zone without siege is a slow way to die
    const defs = [];
    for (const b of g.buildings) if (!b.dead && b.built && b.def.attack && g.isEnemy(this.idx, b.owner)) defs.push(b);
    let best = null, bd = 1e9;
    for (const b of g.buildings) {
      if (b.dead || b.owner === this.idx || !g.isEnemy(this.idx, b.owner) || b.def.flat || b.def.wall) continue;
      let score = Math.hypot(b.x - c.x, b.y - c.y);
      if (!hasSiege) {
        for (const d of defs) { const dd = Math.hypot(b.x - d.x, b.y - d.y); if (dd < d.def.attack.range + d.size * 0.5 + 3) { score += d.garrison.length > 3 ? 40 : 26; break; } }
      } else if (b.def.attack || b.type === 'town_center' || b.type === 'castle') score -= 8;
      if (b.def.dropoff.length && b.type !== 'town_center') score -= 7;       // economic camps hurt the most
      if (b.def.tags.includes('military') && b.def.produces.length) score -= 3;
      if (score < bd) { bd = score; best = b; }
    }
    this.wave.target = best ? { x: best.x, y: best.y, id: best.id } : null;
    if (!best) {
      // hunt units instead
      let bu = null; bd = 1e9;
      for (const u of g.units) { if (u.dead || u.owner === 0 || !g.isEnemy(this.idx, u.owner)) continue; const d = Math.hypot(u.x - c.x, u.y - c.y); if (d < bd) { bd = d; bu = u; } }
      if (bu) this.wave.target = { x: bu.x, y: bu.y, id: bu.id };
    }
  }
  sendWave(army) {
    const g = this.g, w = this.wave;
    if (!w.target) { w.state = 'idle'; return; }
    const siege = army.filter(u => u.def.tags.includes('siege')), troops = army.filter(u => !u.def.tags.includes('siege'));
    // troops attack-move to the target; siege follows slightly behind and attacks buildings it meets
    Cmd.orderMove(g, troops, w.target.x, w.target.y, { attackMove: true });
    if (siege.length) Cmd.orderMove(g, siege, w.target.x, w.target.y, { attackMove: true });
    w.lastOrder = this.t;
  }
  continueAttack(army) {
    const g = this.g, w = this.wave, p = this.p;
    // forget dead units; wave members only
    const members = army.filter(u => w.units.includes(u.id));
    // reinforcements trickle in from the staging area
    const reinf = army.filter(u => !w.units.includes(u.id) && !u.garrison);
    if (reinf.length >= 8 && w.target) {
      for (const u of reinf) w.units.push(u.id);
      w.size += reinf.length;
      Cmd.orderMove(g, reinf, w.target.x, w.target.y, { attackMove: true });
    }
    // progress tracking: a wave that has not destroyed anything for a long time is stalling under fire
    const enemyBuildings = g.buildings.reduce((n, b) => n + (b.owner !== this.idx && !b.dead && g.isEnemy(this.idx, b.owner) ? 1 : 0), 0);
    if (w.lastEnemyBuildings === undefined || enemyBuildings < w.lastEnemyBuildings) { w.lastProgress = this.t; }
    w.lastEnemyBuildings = enemyBuildings;
    const stalled = this.t - (w.lastProgress || w.launchT) > 240 && this.t - w.launchT > 300;
    if ((members.length < w.size * 0.3 && this.t - w.launchT > 20) || (stalled && members.length < w.size * 0.7)) {
      w.state = 'retreating'; w.retreatT = this.t;
      const c = this.tcPos();
      Cmd.orderMove(g, members, c.x + (this.enemyBase.x - c.x) * 0.12, c.y + (this.enemyBase.y - c.y) * 0.12, { noCap: true });
      if (this.g.rng.next() < 0.5 && g.isEnemy(this.idx, g.humanIndex)) g.chat(this.idx, TAUNTS.retreat[Math.floor(g.rng.next() * TAUNTS.retreat.length)]);
      return;
    }
    if (!members.length) { w.state = 'idle'; return; }
    // retarget when the target died
    const tgt = w.target && g.byId.get(w.target.id);
    if (!tgt || tgt.dead) { this.chooseTarget(members); if (!w.target) { w.state = 'idle'; return; } this.sendWave(members); return; }
    w.target.x = tgt.x; w.target.y = tgt.y;
    // idle members (finished their order) get re-ordered; periodically refresh orders so stragglers catch up
    const idle = members.filter(u => !u.order);
    if (idle.length || this.t - w.lastOrder > 12) this.sendWave(members);
    if (this.t - w.launchT > 1200) { w.state = 'idle'; }
  }
}
