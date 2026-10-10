// Player state: resources, population, research and the effective (tech/civ modified) unit & building definitions.
import { UNITS, LINES } from '../data/units.js';
import { BUILDINGS, TOWER_TIERS } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { CIVS } from '../data/civs.js';
import { POP_MAX, RES, GATHER_RATES } from '../data/constants.js';

function cloneDef(d) {
  const c = Object.assign({}, d);
  c.atk = d.atk ? Object.assign({}, d.atk) : undefined;
  c.armor = d.armor ? Object.assign({}, d.armor) : undefined;
  c.cost = Object.assign({}, d.cost);
  if (d.attack) c.attack = Object.assign({}, d.attack);
  if (d.heal) c.heal = Object.assign({}, d.heal);
  if (d.convert) c.convert = Object.assign({}, d.convert, { time: d.convert.time && d.convert.time.slice() });
  c.tags = d.tags.slice();
  c.canAttack = !!(c.atk && Object.keys(c.atk).length > 0);
  c.military = c.canAttack && !c.tags.includes('villager') && !c.tags.includes('animal') && d.kind === 'unit';
  return c;
}

function matches(def, sel) {
  for (const s of sel) {
    if (s.charCodeAt(0) === 35) { if (def.id === s.slice(1)) return true; }   // '#id'
    else if (def.tags.includes(s)) return true;
  }
  return false;
}

function setPath(def, path, op, value, create) {
  const parts = path.split('.');
  let o = def;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] == null) { if (!create) return; o[parts[i]] = {}; }
    o = o[parts[i]];
  }
  const key = parts[parts.length - 1];
  if (o[key] === undefined) { if (!create) return; o[key] = 0; }
  if (typeof o[key] !== 'number') return;
  if (op === 'add') o[key] += value; else if (op === 'mul') o[key] *= value;
}

export class Player {
  constructor(game, index, cfg = {}) {
    this.game = game;
    this.index = index;
    this.civ = cfg.civ || 'britons';
    this.name = cfg.name || ('Player ' + index);
    this.isAI = !!cfg.isAI;
    this.color = cfg.color != null ? cfg.color : index;
    this.team = cfg.team != null ? cfg.team : index;           // players with equal team are allies
    this.res = { food: 0, wood: 0, gold: 0, stone: 0 };
    this.age = 0;
    this.pop = 0; this.popCap = 0; this.popReserved = 0;
    this.techs = new Set();
    this.techOrder = [];
    this.researching = new Set();                              // tech ids currently queued/in progress
    this.lineTier = {};
    for (const line of Object.keys(LINES)) this.lineTier[line] = 0;
    this.towerTier = 0;
    this.extraProduces = {};
    this.flags = new Set();
    this.mods = null;
    this.defs = {}; this.bdefs = {};
    this.alive = true;
    this.resigned = false;
    this.ageUpAt = [0, 0, 0, 0];
    this.market = { food: 100, wood: 100, stone: 100 };         // base price index per resource (gold = 100 fixed)
    this.stats = {
      gathered: { food: 0, wood: 0, gold: 0, stone: 0 }, kills: 0, losses: 0, razings: 0, buildingsLost: 0,
      unitsTrained: 0, techsResearched: 0, buildingsBuilt: 0, tradedIn: 0, tradedOut: 0, villagersLost: 0, military: 0,
      history: [],
    };
    this.recompute();
  }

  get civData() { return CIVS[this.civ]; }

  // ------------------------------------------------------------ effective definitions
  recompute() {
    const defs = {}, bdefs = {};
    for (const [id, d] of Object.entries(UNITS)) defs[id] = cloneDef(d);
    for (const [id, d] of Object.entries(BUILDINGS)) bdefs[id] = cloneDef(d);
    const mods = {
      gather: { wood: 0, berries: 0, farm: 0, hunt: 0, sheep: 0, gold: 0, stone: 0 },
      train: {}, build: 1, fee: 0.3,
    };
    const flags = new Set();
    const extra = {};
    const apply = (e) => {
      switch (e.t) {
        case 'stat': {
          const op = e.mul !== undefined ? 'mul' : 'add', val = e.mul !== undefined ? e.mul : e.add;
          for (const d of Object.values(defs)) if (matches(d, e.sel)) setPath(d, e.stat, op, val, e.create);
          for (const d of Object.values(bdefs)) if (matches(d, e.sel)) setPath(d, e.stat, op, val, e.create);
          break;
        }
        case 'cost': {
          const tgt = [...Object.values(defs), ...Object.values(bdefs)];
          for (const d of tgt) if (matches(d, e.sel)) {
            for (const r of RES) if (d.cost[r] && (!e.res || e.res === r)) d.cost[r] = Math.max(1, Math.round(d.cost[r] * e.mul));
          }
          break;
        }
        case 'gather': mods.gather[e.sub] += e.add; break;
        case 'train': {
          for (const bid of Object.keys(bdefs)) if (matches(bdefs[bid], e.sel) || e.sel.includes(bid)) mods.train[bid] = (mods.train[bid] || 1) * e.mul;
          break;
        }
        case 'build': mods.build *= e.mul; break;
        case 'fee': mods.fee += e.add; break;
        case 'flag': flags.add(e.name); break;
        case 'addProduces': (extra[e.building] = extra[e.building] || []).push(e.line); break;
        default: break;                                        // upgrade / bupgrade are applied on completion
      }
    };
    const civ = this.civData;
    if (civ) for (const e of civ.effects) if ((e.age || 0) <= this.age) apply(e);
    for (const id of this.techOrder) for (const e of TECHS[id].effects) apply(e);
    // building upgrade tier & unit lines: keep bdefs of earlier tower tiers intact (they are separate ids)
    this.defs = defs; this.bdefs = bdefs; this.mods = mods; this.flags = flags; this.extraProduces = extra;
    this._syncMaxHp();
  }

  /** After a recompute, scale hp of living entities to their new max hp. */
  _syncMaxHp() {
    const g = this.game;
    if (!g || !g.units) return;
    for (const e of g.units) if (e.owner === this.index && !e.dead) this._fixHp(e, this.defs[e.type]);
    for (const e of g.buildings) if (e.owner === this.index && !e.dead) this._fixHp(e, this.bdefs[e.type]);
  }
  _fixHp(e, def) {
    if (!def) return;
    e.def = def;
    if (e.kind === 'building' && !e.built) { e.maxHp = def.hp; return; }
    if (e.maxHp !== def.hp) {
      const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
      e.maxHp = def.hp; e.hp = Math.max(1, Math.min(def.hp, ratio * def.hp));
    }
  }

  // ------------------------------------------------------------ lookups
  unitFor(line) { const ids = LINES[line]; return ids[Math.min(this.lineTier[line] || 0, ids.length - 1)]; }
  unitDef(id) { return this.defs[id]; }
  buildingDef(id) { return this.bdefs[id]; }
  towerType() { return TOWER_TIERS[this.towerTier]; }
  producibleLines(buildingType) {
    const bd = BUILDINGS[buildingType];
    let lines = bd.produces.map(l => (l === 'unique' ? this.civData.uu : l));
    if (this.extraProduces[buildingType]) lines = lines.concat(this.extraProduces[buildingType]);
    return lines;
  }
  gatherRate(sub) {
    return GATHER_RATES[sub] * (1 + (this.mods.gather[sub] || 0)) * (this.isAI ? this.game.aiGatherBonus(this) : 1);
  }
  hasFlag(f) { return this.flags.has(f); }
  isAlly(other) { return other && (other === this || other.team === this.team); }
  canAfford(cost) { for (const r of RES) if ((cost[r] || 0) > this.res[r] + 1e-6) return false; return true; }
  pay(cost) { for (const r of RES) if (cost[r]) this.res[r] -= cost[r]; }
  refund(cost) { for (const r of RES) if (cost[r]) this.res[r] += cost[r]; }
  get popFree() { return Math.min(this.popCap, POP_MAX) - this.pop - this.popReserved; }

  /** Count completed buildings of a given type for this player. */
  countBuildings(type, onlyBuilt = true) {
    let n = 0;
    for (const b of this.game.buildings) if (b.owner === this.index && !b.dead && b.type === type && (!onlyBuilt || b.built)) n++;
    return n;
  }
  hasBuilding(type) { return this.countBuildings(type) > 0; }
}
