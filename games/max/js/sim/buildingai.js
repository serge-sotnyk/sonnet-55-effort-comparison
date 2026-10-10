// Building behaviour: construction progress, production & research queues, defensive fire, garrison healing.
import { LINES } from '../data/units.js';
import { TECHS } from '../data/techs.js';
import { TOWER_TIERS } from '../data/buildings.js';
import { fireProjectile } from './combat.js';
import { setOrder } from './unitai.js';

export function onBuildingComplete(game, b, initial) {
  const pl = game.players[b.owner];
  game.recalcPop(pl);
  if (!initial) {
    pl.stats.buildingsBuilt++;
    game.emit('built', { x: b.x, y: b.y, owner: b.owner, type: b.type });
    if (b.owner === game.humanIndex && b.type !== 'farm' && !b.def.wall) game.notify(b.owner, `${b.def.name} completed.`, b.x, b.y, 'info');
  }
  b.hp = Math.min(b.maxHp, Math.max(b.hp, initial ? b.maxHp : b.hp));
  if (initial) b.hp = b.maxHp;
}
export function onBuildingRemoved(game, b) {
  if (b.type === 'wonder') delete game.wonderTimers[b.id];
}

export function updateBuilding(game, b, dt) {
  const pl = game.players[b.owner];
  if (!b.built) {
    if (b.nBuilders > 0) {
      const rate = Math.pow(b.nBuilders, 0.7) * pl.mods.build / b.def.time;
      b.progress = Math.min(1, b.progress + rate * dt);
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.92 * rate * dt);
      b.researchSound -= dt;
      if (b.researchSound <= 0) { b.researchSound = 1.1; game.emit('hammer', { x: b.x, y: b.y, owner: b.owner }); }
      if (b.progress >= 1) { b.built = true; b.hp = Math.min(b.maxHp, b.hp); onBuildingComplete(game, b, false); }
    }
    return;
  }
  // ---- production / research queue
  const q = b.queue;
  if (q.length) {
    const it = q[0];
    if (it.kind === 'unit') {
      if (!it.started) {
        if (pl.popFree < 1) {
          if (!it.blocked) { it.blocked = true; if (b.owner === game.humanIndex) game.notify(b.owner, pl.popCap >= 200 ? 'Population limit reached.' : 'You need more houses!', b.x, b.y, 'warn'); }
          return;
        }
        it.started = true; it.blocked = false; pl.popReserved++;
      }
      it.left -= dt * (pl.mods.train[b.type] || 1);
      if (it.left <= 0) {
        q.shift(); pl.popReserved--;
        spawnTrained(game, b, pl, it);
      }
    } else if (it.kind === 'tech') {
      it.left -= dt;
      if (it.left <= 0) { q.shift(); completeResearch(game, pl, it.id, b); }
    }
  }
  // ---- defenses
  if (b.def.attack) defenseTick(game, b, dt);
  // ---- gates swing open when friendly units pass
  if (b.def.gate) { b.scanT -= dt; if (b.scanT <= 0) { b.scanT = 0.3; let o = false; for (const u of game.queryUnits(b.x, b.y, 1.7)) if (!u.dead && game.isAllied(u.owner, b.owner)) { o = true; break; } b.open = o; } }
  // ---- garrison healing
  if (b.garrison.length) for (const u of b.garrison) if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 1.5 * dt);
  // ---- farms exhausted w/o farmer vanish after a while
  if (b.type === 'farm' && b.exhausted && !b.farmer) { b.rotT = (b.rotT || 0) + dt; if (b.rotT > 25) game.destroyBuilding(b, null); }
}

// ---------------------------------------------------------------- training
function spawnTrained(game, b, pl, it) {
  const pos = findSpawn(game, b);
  const u = game.spawnUnit(it.type, b.owner, pos[0], pos[1]);
  pl.stats.unitsTrained++;
  if (b.owner === game.humanIndex) game.emit('trained', { x: b.x, y: b.y, type: it.type, owner: b.owner });
  const r = b.rally;
  if (r) applyRally(game, u, r);
  return u;
}

export function findSpawn(game, b) {
  const rally = b.rally;
  const tx = rally ? rally.x : b.x + 4, ty = rally ? rally.y : b.y + 4;
  const base = Math.atan2(ty - b.y, tx - b.x);
  const rad = b.size / 2 + 0.75;
  let best = null, bs = 1e9;
  for (let k = 0; k < 32; k++) {
    const a = base + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI * 2 / 32));
    // point on a square ring around the footprint
    const c = Math.cos(a), s = Math.sin(a);
    const m = Math.max(Math.abs(c), Math.abs(s));
    const px = b.x + (c / m) * rad, py = b.y + (s / m) * rad;
    if (!game.nav.walkAt(px, py, b.owner)) continue;
    const score = k * 0.2 + game.queryUnits(px, py, 0.45).length * 3;
    if (score < bs) { bs = score; best = [px, py]; if (!game.queryUnits(px, py, 0.45).length) break; }
  }
  if (!best) { const nw = game.nav.nearestWalkable(b.x, b.y + b.size / 2 + 1, b.owner, 8); best = nw || [b.x, b.y + b.size / 2 + 1]; }
  return best;
}

export function applyRally(game, u, r) {
  const tgt = r.target ? game.byId.get(r.target) : null;
  if (tgt && !tgt.dead) {
    if (tgt.kind === 'resource' && u.def.tags.includes('villager')) {
      const sub = tgt.sub;
      setOrder(game, u, { type: 'gather', target: tgt.id, res: tgt.res, sub, phase: 'seek', lx: tgt.x, ly: tgt.y });
      return;
    }
    if (tgt.kind === 'building' && tgt.owner === u.owner) {
      if (u.def.tags.includes('villager') && tgt.type === 'farm' && tgt.built) { setOrder(game, u, { type: 'gather', target: tgt.id, res: 'food', sub: 'farm', phase: 'seek', lx: tgt.x, ly: tgt.y }); return; }
      if (u.def.tags.includes('villager') && !tgt.built) { setOrder(game, u, { type: 'build', target: tgt.id }); return; }
      if (tgt.def.garrison > 0 && !u.def.tags.includes('siege')) { setOrder(game, u, { type: 'garrison', target: tgt.id }); return; }
    }
    if (tgt.kind === 'unit' && game.isEnemy(u.owner, tgt.owner)) { setOrder(game, u, { type: 'attack', target: tgt.id }); return; }
  }
  setOrder(game, u, { type: 'move', x: r.x, y: r.y });
}

// ---------------------------------------------------------------- research
export function completeResearch(game, pl, id, building) {
  const tech = TECHS[id];
  pl.researching.delete(id);
  pl.techs.add(id); pl.techOrder.push(id);
  pl.stats.techsResearched++;
  // unit line / building line upgrades change tiers before the defs are recomputed
  for (const e of tech.effects) {
    if (e.t === 'upgrade') upgradeLine(game, pl, e.to);
    else if (e.t === 'bupgrade') upgradeBuildings(game, pl, e.from, e.to);
  }
  if (tech.age !== undefined) {
    pl.age = tech.age; pl.ageUpAt[tech.age] = game.time;
    game.emit('ageup', { owner: pl.index, age: tech.age, x: building ? building.x : 0, y: building ? building.y : 0 });
    game.notifyAllPlayers && game.notifyAllPlayers();
    if (pl.index === game.humanIndex) game.notify(pl.index, `You have advanced to the ${['Dark', 'Feudal', 'Castle', 'Imperial'][tech.age]} Age!`, building ? building.x : 0, building ? building.y : 0, 'good');
    else game.notifyEnemyAge && game.notifyEnemyAge(pl, tech.age);
  } else {
    game.emit('researched', { owner: pl.index, id, x: building ? building.x : 0, y: building ? building.y : 0 });
    if (pl.index === game.humanIndex) game.notify(pl.index, `${tech.name} researched.`, building ? building.x : 0, building ? building.y : 0, 'info');
  }
  pl.recompute();
}

function upgradeLine(game, pl, toId) {
  for (const [line, ids] of Object.entries(LINES)) {
    const i = ids.indexOf(toId);
    if (i < 0) continue;
    pl.lineTier[line] = Math.max(pl.lineTier[line], i);
    for (const u of game.units) if (u.owner === pl.index && !u.dead) {
      const j = ids.indexOf(u.type);
      if (j >= 0 && j < i) { u.type = toId; }
    }
    // units currently queued keep their type; update queued items of this line
    for (const b of game.buildings) if (b.owner === pl.index) for (const it of b.queue) if (it.kind === 'unit' && it.line === line) it.type = toId;
  }
}
function upgradeBuildings(game, pl, from, to) {
  pl.towerTier = Math.max(pl.towerTier, TOWER_TIERS.indexOf(to));
  for (const b of game.buildings) if (b.owner === pl.index && b.type === from) { b.type = to; }
}

// ---------------------------------------------------------------- defensive fire
function defenseTick(game, b, dt) {
  const a = b.def.attack;
  if (b.reload > 0) { b.reload -= dt; return; }
  // eligible garrison adds arrows
  let arrows = a.arrows;
  for (const u of b.garrison) if (u.def.tags.includes('infantry') || u.def.tags.includes('archer')) arrows++;
  arrows = Math.min(arrows, a.maxArrows);
  const range = a.range + b.size * 0.5;
  const near = game.queryUnits(b.x, b.y, range);
  const cand = [];
  for (const u of near) {
    if (u.dead || u.garrison || !game.isEnemy(b.owner, u.owner) || u.def.tags.includes('animal')) continue;
    if (u.def.armor.pierce >= 100) continue;                      // rams: don't waste arrows
    const d = Math.hypot(u.x - b.x, u.y - b.y);
    const pri = u.def.military ? 0 : 4;
    cand.push([pri + d, u]);
  }
  if (!cand.length) { b.reload = 0.5; return; }
  cand.sort((x, y) => x[0] - y[0]);
  const nT = Math.min(cand.length, arrows > 4 ? 3 : 1);
  for (let i = 0; i < arrows; i++) {
    const t = cand[i % nT][1];
    fireProjectile(game, b, t, { pierce: a.dmg }, 'arrow', { accuracy: 0.9 + (b.def.accuracyBonus || 0), z0: b.size * 10 });
  }
  b.reload = a.reload;
}
