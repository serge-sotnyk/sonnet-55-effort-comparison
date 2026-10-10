// Command API used by both the human UI and the AI. All validation lives here.
import { AGE_NAMES, T, RES } from '../data/constants.js';
import { UNITS, LINES } from '../data/units.js';
import { BUILDINGS, WALL_IDS } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { setOrder, finishOrder, canConvert } from './unitai.js';
import { distToRect } from './util.js';

export const QUEUE_MAX = 15;

// ---------------------------------------------------------------- building placement
const BUILDABLE = new Set([T.GRASS, T.DIRT, T.SAND]);

export function canPlace(game, pIdx, type, tx, ty, opts = {}) {
  const pl = game.players[pIdx];
  const def = pl.bdefs[type];
  if (!def) return { ok: false, reason: 'Unknown building' };
  if (def.ageReq > pl.age) return { ok: false, reason: `Requires ${AGE_NAMES[def.ageReq]}` };
  if (def.needs) for (const n of def.needs) if (!pl.hasBuilding(n)) return { ok: false, reason: `Requires ${BUILDINGS[n].name}` };
  if (type === 'wonder' && pl.countBuildings('wonder', false) > 0) return { ok: false, reason: 'Only one Wonder at a time' };
  const size = def.size, nav = game.nav;
  const watch = pIdx === game.humanIndex;
  let replace = null;
  for (let y = ty; y < ty + size; y++) {
    for (let x = tx; x < tx + size; x++) {
      if (x < 1 || y < 1 || x >= game.w - 1 || y >= game.h - 1) return { ok: false, reason: 'Out of bounds' };
      const i = y * game.w + x;
      if (!BUILDABLE.has(game.terrain[i])) return { ok: false, reason: 'Cannot build on water' };
      if (nav.block[i] !== 0) {
        // a gate may replace one of the player's own wall segments
        if (type === 'gate' && !replace) {
          const w = wallAt(game, x, y);
          if (w && w.owner === pIdx && w.type !== 'gate' && w.def.wall) { replace = w; continue; }
        }
        return { ok: false, reason: 'Blocked' };
      }
      if (game.flat[i]) return { ok: false, reason: 'Blocked' };
      if (watch && !game.vision.isExplored(x + 0.5, y + 0.5)) return { ok: false, reason: 'Unexplored' };
    }
  }
  // buildings other than walls/farms may not be dropped directly on top of enemy units (ignore friendlies/animals)
  if (!def.flat && !def.wall) {
    for (const u of game.units) {
      if (u.dead || u.garrison || u.owner === pIdx || u.owner === 0 || u.x < tx - 0.3 || u.x > tx + size + 0.3 || u.y < ty - 0.3 || u.y > ty + size + 0.3) continue;
      if (game.isEnemy(pIdx, u.owner)) return { ok: false, reason: 'Enemy units in the way' };
    }
  }
  return { ok: true, replace };
}
export function wallAt(game, tx, ty) {
  const list = game.queryStatic(tx + 0.5, ty + 0.5, 0.3, 'building');
  for (const b of list) if (b.def.wall && b.tx === tx && b.ty === ty) return b;
  return null;
}

export function hasResourcesFor(pl, cost) { return pl.canAfford(cost); }

/** Place a building and send builders. Returns the new building or null (with game.lastError set). */
export function placeBuilding(game, pIdx, type, tx, ty, builders = [], opts = {}) {
  const pl = game.players[pIdx];
  const chk = canPlace(game, pIdx, type, tx, ty);
  if (!chk.ok) { game.lastError = chk.reason; return null; }
  const def = pl.bdefs[type];
  if (!pl.canAfford(def.cost)) { game.lastError = 'Not enough resources'; return null; }
  if (chk.replace) game.destroyBuilding(chk.replace, null, true);
  pl.pay(def.cost);
  const b = game.spawnBuilding(type, pIdx, tx, ty, { built: false, axis: opts.axis });
  game.emit('placed', { x: b.x, y: b.y, owner: pIdx, type });
  for (const u of builders) {
    if (u.dead || !u.def.tags.includes('villager')) continue;
    const order = { type: 'build', target: b.id };
    if (opts.queue && u.order) u.queue.push(order); else setOrder(game, u, order);
  }
  return b;
}

// ---------------------------------------------------------------- production & research
export function canTrain(game, b, line) {
  const pl = game.players[b.owner];
  if (!b.built || b.dead) return { ok: false, reason: 'Building not complete' };
  if (!pl.producibleLines(b.type).includes(line)) return { ok: false, reason: 'Cannot train here' };
  const type = pl.unitFor(line);
  const def = pl.defs[type];
  if (def.ageReq > pl.age) return { ok: false, reason: `Requires ${AGE_NAMES[def.ageReq]}` };
  if (b.queue.length >= QUEUE_MAX) return { ok: false, reason: 'Queue is full' };
  if (!pl.canAfford(def.cost)) return { ok: false, reason: 'Not enough resources' };
  return { ok: true, type, def };
}
export function queueUnit(game, b, line, count = 1) {
  const pl = game.players[b.owner];
  let n = 0;
  for (let i = 0; i < count; i++) {
    const c = canTrain(game, b, line);
    if (!c.ok) { game.lastError = c.reason; break; }
    pl.pay(c.def.cost);
    b.queue.push({ kind: 'unit', type: c.type, line, cost: Object.assign({}, c.def.cost), left: c.def.time, total: c.def.time, started: false });
    n++;
  }
  return n;
}

export function ageRequirement(game, pl, techId) {
  const t = TECHS[techId];
  if (t.age === undefined) return { ok: true };
  if (pl.age !== t.age - 1) return { ok: false, reason: pl.age >= t.age ? 'Already reached' : `Requires ${AGE_NAMES[t.age - 1]}` };
  for (const other of Object.values(TECHS)) if (other.age !== undefined && pl.researching.has(other.id)) return { ok: false, reason: 'Already advancing' };
  const prevAge = t.age - 1;
  const types = new Set();
  for (const b of game.buildings) {
    if (b.owner !== pl.index || b.dead || !b.built) continue;
    const d = BUILDINGS[b.type];
    if (d.ageReq !== prevAge || d.wall || d.flat || b.type === 'town_center' || d.hidden || d.line === 'tower') continue;
    types.add(b.type);
  }
  if (types.size < 2) return { ok: false, reason: `Requires 2 different ${AGE_NAMES[prevAge]} buildings` };
  if (t.age === 3 && !(types.has('castle') || types.has('university'))) return { ok: false, reason: 'Requires a Castle or University' };
  return { ok: true };
}

export function canResearch(game, b, techId) {
  const pl = game.players[b.owner];
  const t = TECHS[techId];
  if (!t || !b.built || b.dead) return { ok: false, reason: 'Unavailable' };
  if (t.building !== b.type) return { ok: false, reason: 'Wrong building' };
  if (pl.techs.has(techId) || pl.researching.has(techId)) return { ok: false, reason: 'Already researched' };
  if (t.uniqueTo && t.uniqueTo !== pl.civ) return { ok: false, reason: 'Not available' };
  for (const r of t.requires) if (!pl.techs.has(r)) return { ok: false, reason: `Requires ${TECHS[r].name}` };
  if (t.age === undefined && t.ageReq > pl.age) return { ok: false, reason: `Requires ${AGE_NAMES[t.ageReq]}` };
  const ar = ageRequirement(game, pl, techId);
  if (!ar.ok) return ar;
  if (b.queue.length >= QUEUE_MAX) return { ok: false, reason: 'Queue is full' };
  if (!pl.canAfford(t.cost)) return { ok: false, reason: 'Not enough resources' };
  return { ok: true };
}
export function queueTech(game, b, techId) {
  const c = canResearch(game, b, techId);
  if (!c.ok) { game.lastError = c.reason; return false; }
  const pl = game.players[b.owner], t = TECHS[techId];
  pl.pay(t.cost);
  pl.researching.add(techId);
  b.queue.push({ kind: 'tech', id: techId, cost: Object.assign({}, t.cost), left: t.time, total: t.time, started: true });
  return true;
}
export function cancelQueueItem(game, b, index) {
  const it = b.queue[index];
  if (!it) return;
  const pl = game.players[b.owner];
  b.queue.splice(index, 1);
  pl.refund(it.cost);
  if (it.kind === 'unit' && it.started) pl.popReserved--;
  if (it.kind === 'tech') pl.researching.delete(it.id);
}

export function setRally(game, b, x, y, targetId = 0) { b.rally = { x, y, target: targetId }; }

// ---------------------------------------------------------------- market
export function marketPrices(game, pl, res) {
  const idx = pl.market[res] / 100;
  const fee = Math.max(0.05, pl.mods.fee);
  return { buy: Math.round(idx * 100 * (1 + fee)), sell: Math.round(idx * 100 * (1 - fee)) };
}
export function trade(game, pIdx, res, dir, amount = 100) {
  const pl = game.players[pIdx];
  if (!pl.hasBuilding('market')) { game.lastError = 'You need a Market'; return false; }
  const q = marketPrices(game, pl, res);
  if (dir === 'buy') {
    const cost = Math.round(q.buy * amount / 100);
    if (pl.res.gold < cost) { game.lastError = 'Not enough gold'; return false; }
    pl.res.gold -= cost; pl.res[res] += amount;
    pl.market[res] = Math.min(300, pl.market[res] + 3 * amount / 100);
    pl.stats.tradedOut += cost;
  } else {
    if (pl.res[res] < amount) { game.lastError = `Not enough ${res}`; return false; }
    pl.res[res] -= amount; pl.res.gold += Math.round(q.sell * amount / 100);
    pl.market[res] = Math.max(20, pl.market[res] - 3 * amount / 100);
    pl.stats.tradedIn += Math.round(q.sell * amount / 100);
  }
  game.emit('trade', { dir, res, owner: pIdx });
  return true;
}

// ---------------------------------------------------------------- orders
function alive(units) { return units.filter(u => u && !u.dead && !u.garrison); }

function giveOrder(game, u, order, queue) {
  if (queue && (u.order || u.queue.length)) u.queue.push(order);
  else setOrder(game, u, order);
}

const RING = [];
for (let r = 0; r <= 14; r++) {
  if (r === 0) { RING.push([0, 0]); continue; }
  const n = 6 * r;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + r * 0.37; RING.push([Math.cos(a) * r, Math.sin(a) * r]); }
}

export function formationSlots(game, n, cx, cy, spacing, owner) {
  const slots = [];
  const nav = game.nav;
  const centre = nav.walkAt(cx, cy, owner) ? [cx, cy] : (nav.nearestWalkable(cx, cy, owner, 10) || [cx, cy]);
  for (let i = 0; i < RING.length && slots.length < n; i++) {
    const x = centre[0] + RING[i][0] * spacing, y = centre[1] + RING[i][1] * spacing;
    if (x < 1 || y < 1 || x > game.w - 1 || y > game.h - 1) continue;
    if (!nav.walkAt(x, y, owner)) continue;
    // keep the slot reachable from the centre
    if (i > 0 && !nav.lineClear(centre[0], centre[1], x, y, owner, 0.15) && nav.regionAt(x, y) !== nav.regionAt(centre[0], centre[1])) continue;
    slots.push([x, y]);
  }
  while (slots.length < n) slots.push([centre[0], centre[1]]);
  return slots;
}

export function orderMove(game, units, x, y, opts = {}) {
  units = alive(units);
  if (!units.length) return;
  let cap = 0;
  const mil = units.filter(u => u.def.military);
  if (mil.length >= 2 && !opts.noCap) {
    let cx = 0, cy = 0; for (const u of mil) { cx += u.x; cy += u.y; }
    cx /= mil.length; cy /= mil.length;
    if (Math.hypot(cx - x, cy - y) > 7) cap = Math.min(...mil.map(u => u.def.speed));
  }
  const bigR = units.reduce((m, u) => Math.max(m, u.radius), 0.25);
  const slots = units.length === 1 ? [[x, y]] : formationSlots(game, units.length, x, y, Math.max(0.8, bigR * 2.1), units[0].owner);
  // assign nearest-first
  const free = units.slice();
  const assign = new Map();
  const order = slots.map((s, i) => i).sort((a, b) => Math.hypot(slots[a][0] - x, slots[a][1] - y) - Math.hypot(slots[b][0] - x, slots[b][1] - y));
  for (const si of order) {
    let bi = 0, bd = 1e9;
    for (let k = 0; k < free.length; k++) { const d = Math.hypot(free[k].x - slots[si][0], free[k].y - slots[si][1]); if (d < bd) { bd = d; bi = k; } }
    assign.set(free[bi].id, slots[si]); free.splice(bi, 1);
  }
  for (const u of units) {
    const s = assign.get(u.id);
    const ord = { type: opts.attackMove ? 'attackmove' : 'move', x: s[0], y: s[1], speedCap: cap || 0 };
    if (u.def.tags.includes('villager') && opts.attackMove) ord.type = 'move';
    u.home = null;
    giveOrder(game, u, ord, opts.queue);
  }
}

export function orderAttack(game, units, target, queue) {
  for (const u of alive(units)) {
    if (!u.def.canAttack) { orderMove(game, [u], target.x, target.y, { queue }); continue; }
    u.home = null;
    giveOrder(game, u, { type: 'attack', target: target.id, auto: false }, queue);
  }
}

export function orderGather(game, units, res, queue) {
  const vills = alive(units);
  const farmList = res.kind === 'building' && res.type === 'farm' ? farmsNear(game, res, vills[0] ? vills[0].owner : 0) : null;
  let fi = 0;
  const others = [];
  for (const u of vills) {
    if (!u.def.tags.includes('villager')) { others.push(u); continue; }
    let target = res;
    if (farmList) { target = farmList[Math.min(fi, farmList.length - 1)] || res; fi++; }
    const sub = target.kind === 'building' ? 'farm' : target.sub === 'carcass' ? 'carcass' : target.kind === 'unit' ? 'carcass' : target.sub;
    const resType = target.kind === 'unit' ? 'food' : target.kind === 'building' ? 'food' : target.res;
    giveOrder(game, u, { type: 'gather', target: target.id, res: resType, sub, phase: 'seek', lx: target.x, ly: target.y }, queue);
  }
  if (others.length) orderMove(game, others, res.x, res.y, { queue });
}
function farmsNear(game, farm, owner) {
  const list = game.buildings.filter(b => b.owner === owner && b.type === 'farm' && b.built && !b.dead && (!b.farmer || b === farm));
  list.sort((a, b) => Math.hypot(a.x - farm.x, a.y - farm.y) - Math.hypot(b.x - farm.x, b.y - farm.y));
  return list;
}

export function orderBuild(game, units, b, queue) {
  const vills = alive(units).filter(u => u.def.tags.includes('villager'));
  for (const u of vills) {
    if (!b.built) giveOrder(game, u, { type: 'build', target: b.id }, queue);
    else if (b.type === 'farm') orderGather(game, [u], b, queue);
    else giveOrder(game, u, { type: 'repair', target: b.id }, queue);
  }
}
export function orderRepair(game, units, b, queue) {
  for (const u of alive(units)) if (u.def.tags.includes('villager')) giveOrder(game, u, b.built ? { type: 'repair', target: b.id } : { type: 'build', target: b.id }, queue);
}
export function orderGarrison(game, units, b, queue) {
  for (const u of alive(units)) {
    if (u.def.tags.includes('siege')) continue;
    giveOrder(game, u, { type: 'garrison', target: b.id }, queue);
  }
}
export function orderUngarrison(game, b) {
  for (const u of b.garrison.slice()) game.ungarrisonUnit(u, b);
}
export function orderStop(game, units) {
  for (const u of alive(units)) { setOrder(game, u, null); u.queue.length = 0; u.home = null; }
}
export function orderDelete(game, ents) {
  for (const e of ents) {
    if (e.dead) continue;
    if (e.kind === 'unit') { e.hp = 0; game.killUnit(e, null); }
    else if (e.kind === 'building') { game.destroyBuilding(e, null, e.owner === game.humanIndex); }
  }
}
export function orderConvert(game, units, target, queue) {
  for (const u of alive(units)) {
    if (u.def.tags.includes('monk') && canConvert(game, u, target)) giveOrder(game, u, { type: 'convert', target: target.id }, queue);
    else giveOrder(game, u, { type: 'attack', target: target.id }, queue);
  }
}
export function orderHeal(game, units, target, queue) {
  for (const u of alive(units)) if (u.def.tags.includes('monk')) giveOrder(game, u, { type: 'heal', target: target.id }, queue);
}
export function setStance(game, units, stance) { for (const u of units) if (!u.dead && !u.def.tags.includes('villager')) u.stance = stance; }

/** Right-click on something: decide what the selection should do. */
export function smartOrder(game, units, target, x, y, opts = {}) {
  units = alive(units);
  if (!units.length) return 'none';
  const owner = units[0].owner;
  const q = !!opts.queue;
  if (!target) { orderMove(game, units, x, y, { queue: q }); return 'move'; }
  if (target.kind === 'unit') {
    if (game.isEnemy(owner, target.owner) || (target.owner === 0 && (target.def.hostile || target.def.tags.includes('huntable')))) {
      if (target.owner === 0 && target.def.tags.includes('huntable')) {
        const vills = units.filter(u => u.def.tags.includes('villager')), rest = units.filter(u => !u.def.tags.includes('villager'));
        if (vills.length) orderGather(game, vills, target, q);
        if (rest.length) orderAttack(game, rest, target, q);
        return 'hunt';
      }
      const monks = units.filter(u => u.def.tags.includes('monk')), rest = units.filter(u => !u.def.tags.includes('monk'));
      if (monks.length) orderConvert(game, monks, target, q);
      if (rest.length) orderAttack(game, rest, target, q);
      return 'attack';
    }
    if (target.def.tags.includes('livestock') && game.isAllied(owner, target.owner)) {
      // own sheep: villagers slaughter and gather them, everyone else just walks over
      const vills = units.filter(u => u.def.tags.includes('villager')), rest = units.filter(u => !u.def.tags.includes('villager'));
      if (vills.length) orderGather(game, vills, target, q);
      if (rest.length) orderMove(game, rest, x, y, { queue: q });
      return vills.length ? 'gather' : 'move';
    }
    if (game.isAllied(owner, target.owner)) {
      const monks = units.filter(u => u.def.tags.includes('monk'));
      if (monks.length && target.hp < target.maxHp) { orderHeal(game, monks, target, q); if (monks.length === units.length) return 'heal'; }
      orderMove(game, units.filter(u => !monks.includes(u) || target.hp >= target.maxHp), target.x, target.y, { queue: q });
      return 'move';
    }
    orderMove(game, units, x, y, { queue: q });
    return 'move';
  }
  if (target.kind === 'resource') {
    orderGather(game, units, target, q);
    return 'gather';
  }
  if (target.kind === 'building') {
    if (game.isEnemy(owner, target.owner)) { orderAttack(game, units, target, q); return 'attack'; }
    if (game.isAllied(owner, target.owner)) {
      const vills = units.filter(u => u.def.tags.includes('villager'));
      const rest = units.filter(u => !u.def.tags.includes('villager'));
      if (!target.built) { if (vills.length) orderBuild(game, vills, target, q); if (rest.length) orderMove(game, rest, x, y, { queue: q }); return 'build'; }
      if (target.type === 'farm' && vills.length) { orderGather(game, vills, target, q); if (rest.length) orderMove(game, rest, x, y, { queue: q }); return 'gather'; }
      // villagers carrying resources: drop them off
      const carriers = vills.filter(u => u.carry > 0 && target.def.dropoff.includes(u.carryType));
      if (carriers.length) {
        for (const u of carriers) giveOrder(game, u, { type: 'gather', target: 0, res: u.carryType, sub: undefined, phase: 'drop', dropoff: target.id, lx: u.x, ly: u.y }, q);
      }
      const others = units.filter(u => !carriers.includes(u));
      const needsRepair = target.hp < target.maxHp - 1;
      const repairers = others.filter(u => u.def.tags.includes('villager') && needsRepair);
      const garrisoners = others.filter(u => !repairers.includes(u) && target.def.garrison > 0 && !u.def.tags.includes('siege'));
      const movers = others.filter(u => !repairers.includes(u) && !garrisoners.includes(u));
      if (repairers.length) orderRepair(game, repairers, target, q);
      if (garrisoners.length) orderGarrison(game, garrisoners, target, q);
      if (movers.length) orderMove(game, movers, x, y, { queue: q });
      return garrisoners.length ? 'garrison' : repairers.length ? 'repair' : 'move';
    }
  }
  orderMove(game, units, x, y, { queue: q });
  return 'move';
}

// ---------------------------------------------------------------- wall lines
/** Tiles along an axis-aligned/diagonal line from (x0,y0) to (x1,y1) (Bresenham). */
export function lineTiles(x0, y0, x1, y1) {
  const out = []; let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
  let x = x0, y = y0;
  for (let i = 0; i < 400; i++) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return out;
}
export function placeWall(game, pIdx, type, tiles, builders, opts = {}) {
  const placed = [];
  for (const [tx, ty] of tiles) {
    const pl = game.players[pIdx];
    if (!pl.canAfford(pl.bdefs[type].cost)) break;
    if (!canPlace(game, pIdx, type, tx, ty).ok) continue;
    const b = placeBuilding(game, pIdx, type, tx, ty, [], opts);
    if (b) placed.push(b);
  }
  // builders work through the segments in order
  for (let bi = 0; bi < builders.length; bi++) {
    const u = builders[bi];
    if (u.dead || !u.def.tags.includes('villager')) continue;
    placed.forEach((b, i) => { if (i === 0 && !opts.queue) setOrder(game, u, { type: 'build', target: b.id }); else u.queue.push({ type: 'build', target: b.id }); });
  }
  return placed;
}
