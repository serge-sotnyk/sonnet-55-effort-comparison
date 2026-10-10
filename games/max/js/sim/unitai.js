// Per-unit behaviour: order execution, movement, gathering, building, combat, garrison, monks and wildlife.
import { dirFromVec } from '../data/constants.js';
import { distToRect } from './util.js';
import { calcDamage, meleeHit, fireProjectile, distToEntity, applyDamage } from './combat.js';
import { BUILDINGS } from '../data/buildings.js';

const GATHER_REACH = 0.78;
const SCAN = 0.4;

// ------------------------------------------------------------------ order lifecycle
export function setOrder(game, u, order) {
  releaseSlot(game, u);
  u.order = order;
  u.path = null; u.goal = null; u.pathWait = 0; u.pathFailed = false; u.stuckT = 0; u.attackT = -1;
  if (order) order.pathAsked = false;
}
export function finishOrder(game, u) {
  releaseSlot(game, u);
  u.order = null; u.path = null; u.goal = null; u.pathWait = 0; u.attackT = -1;
  if (u.queue.length) {
    const next = u.queue.shift();
    setOrder(game, u, next);
  }
}
function releaseSlot(game, u) {
  const o = u.order;
  if (!o || !o.slot) return;
  const t = game.byId.get(o.target);
  if (t) { if (t.kind === 'resource') t.gatherers = Math.max(0, t.gatherers - 1); else if (t.kind === 'building') t.farmer = 0; }
  o.slot = false;
}

// ------------------------------------------------------------------ movement
/** Steer along u.path. Returns 'moving' | 'arrived' | 'none' */
function followPath(game, u, dt, o) {
  const p = u.path;
  if (!p) return 'none';
  // recover units that ended up on a blocked tile (building completed under them, spawned inside a tree, ...)
  if (!game.nav.walkAt(u.x, u.y, u.owner)) {
    const nw = game.nav.nearestWalkable(u.x, u.y, u.owner, 6);
    if (nw) { u.x = nw[0]; u.y = nw[1]; }
  }
  let speed = u.def.speed * (u.slow || 1);
  if (o && o.speedCap && o.speedCap < speed) speed = o.speedCap;
  if (u.fleeT > 0 && u.def.fleeSpeed) speed = u.def.fleeSpeed;
  let remaining = speed * dt, moved = 0;
  const nav = game.nav;
  while (remaining > 1e-6 && u.pi * 2 < p.length) {
    const tx = p[u.pi * 2], ty = p[u.pi * 2 + 1];
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d <= remaining) {
      u.x = tx; u.y = ty; remaining -= d; moved += d; u.pi++;
      if (d > 0.01) u.dir = dirFromVec(dx, dy);
    } else {
      const nx = u.x + (dx / d) * remaining, ny = u.y + (dy / d) * remaining;
      if (!nav.walkAt(nx, ny, u.owner)) {                 // a blocker appeared (new building etc.)
        u.path = null; if (o) o.pathAsked = false;
        return 'none';
      }
      u.x = nx; u.y = ny; moved += remaining; remaining = 0;
      u.dir = dirFromVec(dx, dy);
    }
  }
  if (moved > 0) { u.moving = true; if (u.def.unpack) { u.packed = true; u.unpackT = 0; } }
  // stuck detection
  if (moved < speed * dt * 0.2) {
    u.stuckT += dt;
    if (u.stuckT > 1.3) { u.stuckT = 0; u.path = null; if (o) o.pathAsked = false; u.stuckCount = (u.stuckCount || 0) + 1; return 'none'; }
  } else { u.stuckT = 0; u.stuckCount = 0; }
  if (u.pi * 2 >= p.length) { u.path = null; return 'arrived'; }
  return 'moving';
}

/** Travel toward a goal ({x,y} or {rect,reach}). Returns 'moving' | 'arrived' | 'failed' | 'wait'. */
function travel(game, u, o, goal, dt) {
  if (u.pathWait) return 'wait';
  if (!u.path) {
    if (!o.pathAsked) {
      o.pathAsked = true; o.stuckRetries = (o.stuckRetries || 0);
      game.requestPath(u, goal);
      return 'wait';
    }
    // path finished (or none found)
    const failed = u.pathFailed || (u.pathComplete === false);
    u.pathFailed = false;
    return failed ? 'failed' : 'arrived';
  }
  const r = followPath(game, u, dt, o);
  if (r === 'arrived') {
    if (u.pathComplete === false) return 'failed';
    return 'arrived';
  }
  if (r === 'none' && (u.stuckCount || 0) > 4) { u.stuckCount = 0; return 'failed'; }
  return r === 'none' ? 'wait' : 'moving';
}

function faceTo(u, x, y) {
  const dx = x - u.x, dy = y - u.y;
  if (Math.abs(dx) + Math.abs(dy) > 0.01) u.dir = dirFromVec(dx, dy);
}

// ------------------------------------------------------------------ targeting
function hostileTo(game, u, e) {
  if (u.owner === 0) return e.owner > 0 && !e.def.tags.includes('animal') && u.def.hostile;
  if (e.owner === 0) return e.def.hostile === true;                  // wolves
  return game.isEnemy(u.owner, e.owner);
}
function canTargetUnit(u, e) {
  const tags = u.def.tags;
  if (tags.includes('ram')) return false;
  if (u.def.tags.includes('villager')) return false;
  if (e.def.tags.includes('animal') && !e.def.hostile) return false;
  return true;
}
function canTargetBuilding(u, b) {
  if (!u.def.canAttack) return false;
  if (u.def.tags.includes('monk')) return false;
  if (u.def.tags.includes('villager')) return false;
  return !(b.def.flat);
}

/** Can `u` walk to within reach of `t`? (static regions; ranged units may shoot across obstacles) */
function canReach(game, u, t, ru, d) {
  if (ru < 0) return true;
  const range = u.def.range || 0;
  if (range > 0 && d <= range + 0.5) return true;
  const nav = game.nav;
  if (t.kind === 'unit') {
    const rt = nav.region[Math.floor(t.y) * game.w + Math.floor(t.x)];
    return rt < 0 || rt === ru;
  }
  // building: any passable tile around its footprint must be in our region
  for (let y = t.ty - 1; y <= t.ty + t.size; y++) for (let x = t.tx - 1; x <= t.tx + t.size; x++) {
    if (x < 0 || y < 0 || x >= game.w || y >= game.h) continue;
    if (nav.region[y * game.w + x] === ru) return true;
  }
  return false;
}

/** Choose the best hostile target within radius. */
export function acquireTarget(game, u, radius, allowBuildings = true) {
  if (!u.def.canAttack || u.def.tags.includes('monk')) return null;
  let best = null, bs = 1e9;
  game.nav.updateRegions();
  const ru = game.nav.region[Math.floor(u.y) * game.w + Math.floor(u.x)];
  const near = game.queryUnits(u.x, u.y, radius);
  for (let i = 0; i < near.length; i++) {
    const e = near[i];
    if (e.dead || e.garrison || e === u) continue;
    if (!hostileTo(game, u, e) || !canTargetUnit(u, e)) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    let pri = e.def.military ? 0 : e.def.tags.includes('villager') ? 1.4 : 2.2;
    if (e.atkTarget === u.id) pri -= 0.8;
    if (u.def.minRange && d < u.def.minRange * 0.8) continue;
    if (!canReach(game, u, e, ru, d)) continue;
    const s = pri * 5 + d;
    if (s < bs) { bs = s; best = e; }
  }
  if (best || !allowBuildings || u.owner === 0) return best;
  const bl = game.queryStatic(u.x, u.y, radius, 'building');
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.dead || !game.isEnemy(u.owner, b.owner) || !canTargetBuilding(u, b)) continue;
    if (u.def.range > 0 && !u.def.tags.includes('siege') && !b.def.attack && !b.def.production && b.def.wall) continue;
    const d = distToRect(u.x, u.y, b.tx, b.ty, b.tx + b.size, b.ty + b.size);
    if (!canReach(game, u, b, ru, d)) continue;
    const pri = b.def.attack ? 1 : b.def.wall ? 6 : 3;
    const s = pri * 5 + d;
    if (s < bs) { bs = s; best = b; }
  }
  return best;
}

function scanRadius(u) {
  const d = u.def;
  switch (u.stance) {
    case 'standground': return d.range > 0 ? d.range + 0.3 : 1.4;
    case 'defensive': return Math.min(d.los, d.range > 0 ? d.range + 2 : 4.5);
    case 'passive': return 0;
    default: return d.los;
  }
}
function leashFor(u) {
  switch (u.stance) { case 'standground': return 0.01; case 'defensive': return 7; default: return 16; }
}

// ------------------------------------------------------------------ main per-unit update
export function updateUnit(game, u, dt) {
  u.moving = false;
  u.animT += dt;
  if (u.reload > 0) u.reload -= dt;
  if (u.fleeT > 0) u.fleeT -= dt;
  if (u.faith < 1 && u.def.convert) u.faith = Math.min(1, u.faith + dt / u.def.convert.rejuvenate);
  const o = u.order;
  u.anim = 'idle';
  if (u.def.tags.includes('animal')) { animalTick(game, u, dt); return; }
  if (!o) { idleTick(game, u, dt); return; }
  switch (o.type) {
    case 'move': moveTick(game, u, o, dt); break;
    case 'attackmove': attackMoveTick(game, u, o, dt); break;
    case 'attack': attackTick(game, u, o, dt); break;
    case 'gather': gatherTick(game, u, o, dt); break;
    case 'build': buildTick(game, u, o, dt); break;
    case 'repair': repairTick(game, u, o, dt); break;
    case 'garrison': garrisonTick(game, u, o, dt); break;
    case 'convert': convertTick(game, u, o, dt); break;
    case 'heal': healTick(game, u, o, dt); break;
    default: finishOrder(game, u);
  }
}

// ------------------------------------------------------------------ idle behaviour
function idleTick(game, u, dt) {
  const def = u.def;
  // retaliate when hit
  if (def.canAttack && !def.tags.includes('villager') && u.stance !== 'passive' && game.time - u.lastHitT < 3 && u.lastAttacker) {
    const a = game.byId.get(u.lastAttacker);
    if (a && !a.dead && !a.garrison && a.kind === 'unit' && hostileTo(game, u, a) && canTargetUnit(u, a)) {
      const d = Math.hypot(a.x - u.x, a.y - u.y);
      if (u.stance !== 'standground' || d <= def.range + 0.5) {
        u.home = { x: u.x, y: u.y };
        setOrder(game, u, { type: 'attack', target: a.id, auto: true, home: u.home, leash: leashFor(u) + 6 });
        return;
      }
    }
  }
  u.scanT -= dt;
  if (u.scanT <= 0) {
    u.scanT = SCAN + game.rng.next() * 0.15;
    if (def.tags.includes('monk')) { monkIdle(game, u); return; }
    if (def.canAttack && u.stance !== 'passive') {
      const rad = scanRadius(u);
      if (rad > 0) {
        const t = acquireTarget(game, u, rad, u.stance === 'aggressive');
        if (t) {
          u.home = { x: u.x, y: u.y };
          setOrder(game, u, { type: 'attack', target: t.id, auto: true, home: u.home, leash: leashFor(u) });
          return;
        }
      }
    }
    // return to home post after chasing
    if (u.home && u.stance !== 'standground') {
      const d = Math.hypot(u.home.x - u.x, u.home.y - u.y);
      if (d > 2.5) { const h = u.home; u.home = null; setOrder(game, u, { type: 'move', x: h.x, y: h.y, auto: true }); return; }
      u.home = null;
    }
  }
  // unpack/pack idle trebuchets keep state; nothing else to do
}

function monkIdle(game, u) {
  const def = u.def;
  // convert enemy units in sight (aggressive monks)
  if (u.faith >= 1 && u.stance === 'aggressive') {
    let best = null, bd = 1e9;
    const near = game.queryUnits(u.x, u.y, def.convert.range);
    for (const e of near) {
      if (e.dead || e.garrison || !game.isEnemy(u.owner, e.owner)) continue;
      if (!canConvert(game, u, e)) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y) - (e.def.military ? 3 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { setOrder(game, u, { type: 'convert', target: best.id, auto: true }); return; }
  }
  // heal friendly wounded units nearby
  let best = null, bd = 1e9;
  const near = game.queryUnits(u.x, u.y, 8);
  for (const e of near) {
    if (e.dead || e.garrison || e === u || !(game.isAllied(u.owner, e.owner)) || e.hp >= e.maxHp - 0.5) continue;
    if (e.def.tags.includes('siege')) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d < bd) { bd = d; best = e; }
  }
  if (best) setOrder(game, u, { type: 'heal', target: best.id, auto: true });
}

// ------------------------------------------------------------------ move / attack-move
function moveTick(game, u, o, dt) {
  const r = travel(game, u, o, { x: o.x, y: o.y }, dt);
  if (r === 'arrived' || r === 'failed') {
    if (o.garrisonOnArrive) { /* handled elsewhere */ }
    finishOrder(game, u);
    return;
  }
}

function attackMoveTick(game, u, o, dt) {
  const def = u.def;
  if (o.sub) {                                         // currently engaging
    const t = game.byId.get(o.sub);
    if (!t || t.dead || t.garrison || (o.subLeash && Math.hypot(t.x - u.x, t.y - u.y) > o.subLeash)) {
      o.sub = 0; u.path = null; u.goal = null; o.pathAsked = false; u.attackT = -1;
    } else {
      engage(game, u, o, t, dt);
      return;
    }
  }
  u.scanT -= dt;
  if (u.scanT <= 0 && def.canAttack && !def.tags.includes('monk')) {
    u.scanT = SCAN + game.rng.next() * 0.2;
    const t = acquireTarget(game, u, Math.max(def.los, def.range + 1), true);
    if (t) { o.sub = t.id; o.subLeash = 18; u.path = null; o.pathAsked = false; return; }
  } else if (u.scanT <= 0 && def.tags.includes('monk')) {
    u.scanT = 0.5; monkIdle(game, u); if (u.order !== o) return;
  }
  const r = travel(game, u, o, { x: o.x, y: o.y }, dt);
  if (r === 'arrived' || r === 'failed') finishOrder(game, u);
}

// ------------------------------------------------------------------ attack
function attackTick(game, u, o, dt) {
  const t = game.byId.get(o.target);
  const valid = t && !t.dead && !(t.kind === 'unit' && t.garrison) && (t.kind !== 'resource');
  if (!valid || !u.def.canAttack) { targetLost(game, u, o); return; }
  // leash for auto-acquired targets
  if (o.auto && o.home && o.leash && Math.hypot(t.x - o.home.x, t.y - o.home.y) > o.leash + 2) {
    u.home = o.home; finishOrder(game, u); return;
  }
  if (!game.isEnemy(u.owner, t.owner) && !(t.owner === 0 && (t.def.tags.includes('animal')))) { finishOrder(game, u); return; }
  engage(game, u, o, t, dt);
}

function targetLost(game, u, o) {
  const keepHome = o.home;
  const wasAuto = o.auto || o.type === 'attack';
  const queue = u.queue;
  finishOrder(game, u);
  if (u.order) return;                                  // a queued order took over
  if (u.def.canAttack && u.stance !== 'passive' && !u.def.tags.includes('villager')) {
    const rad = scanRadius(u) || 0;
    if (rad > 0) {
      const t = acquireTarget(game, u, Math.max(rad, 6), u.stance === 'aggressive');
      if (t) { setOrder(game, u, { type: 'attack', target: t.id, auto: true, home: keepHome || u.home || { x: u.x, y: u.y }, leash: leashFor(u) + 2 }); return; }
    }
  }
  if (keepHome) u.home = keepHome;
}

/** Approach + attack logic shared by attack and attack-move orders. */
function engage(game, u, o, t, dt) {
  const def = u.def;
  const nav = game.nav;
  const isB = t.kind === 'building';
  const ranged = def.range > 0;
  const reach = ranged ? def.range : (isB ? 0.85 : u.radius + 0.4);
  const d = distToEntity(u, t);
  u.atkTarget = t.id;
  o.reachMax = reach + 0.9;
  // siege packed -> unpack first
  if (def.unpack && d <= reach + 0.2 && u.attackT < 0) {
    if (u.packed) { u.unpackT += dt; u.anim = 'attack'; u.attackT = -1; u.unpacking = true; faceTo(u, t.x, t.y); if (u.unpackT >= def.unpack) { u.packed = false; u.unpackT = 0; } return; }
  }
  // minimum range: back off
  if (def.minRange && d < def.minRange && u.attackT < 0 && !isB) {
    const dx = u.x - t.x, dy = u.y - t.y, l = Math.hypot(dx, dy) || 1;
    const bx = u.x + dx / l * (def.minRange - d + 1.5), by = u.y + dy / l * (def.minRange - d + 1.5);
    if (nav.walkAt(bx, by, u.owner)) { u.path = [bx, by]; u.pi = 0; u.goal = { x: bx, y: by }; o.pathAsked = true; }
  }
  if (d <= reach + (u.attackT >= 0 ? 0.6 : 0)) {
    // in range: stop and fight
    if (u.path && u.attackT < 0 && !(def.minRange && d < def.minRange)) { u.path = null; u.goal = null; o.pathAsked = false; }
    faceTo(u, t.x, t.y);
    if (u.attackT < 0 && u.reload <= 0 && !u.path) {
      if (def.minRange && d < def.minRange * 0.95 && !isB) { /* waiting to back off */ }
      else { u.attackT = 0; u.hitDone = false; u.reload = def.reload; }
    }
    if (u.attackT >= 0) {
      u.attackT += dt; u.anim = 'attack';
      const hitAt = def.attackDur * 0.5;
      if (!u.hitDone && u.attackT >= hitAt) {
        u.hitDone = true;
        resolveHit(game, u, t, d, reach);
      }
      if (u.attackT >= def.attackDur) u.attackT = -1;
    }
    return;
  }
  // need to close the distance
  if (u.attackT >= 0) { u.attackT = -1; }
  o.repathT = (o.repathT || 0) - dt;
  if (u.path && o.goalX !== undefined && t.kind === 'unit' && o.repathT <= 0) {
    if (Math.hypot(t.x - o.goalX, t.y - o.goalY) > 1.2) { u.path = null; o.pathAsked = false; }
    o.repathT = 0.5;
  }
  let goal;
  if (isB) goal = { rect: [t.tx, t.ty, t.tx + t.size, t.ty + t.size], reach: Math.max(0.55, reach - 0.1) };
  else goal = { rect: [t.x - 0.15, t.y - 0.15, t.x + 0.15, t.y + 0.15], reach: Math.max(0.4, reach - 0.2) };
  // direct line shortcut when close
  if (!isB && !u.path && !u.pathWait && d < 9 && nav.lineClear(u.x, u.y, t.x, t.y, u.owner, 0.25)) {
    u.path = [t.x, t.y]; u.pi = 0; u.goal = goal; o.pathAsked = true; o.goalX = t.x; o.goalY = t.y;
  }
  const r = travel(game, u, o, goal, dt);
  if (!u.path) { o.goalX = t.x; o.goalY = t.y; }
  if (r === 'failed') {
    // unreachable target (walls, water). If something hostile blocks the way attack it, else give up.
    o.failN = (o.failN || 0) + 1;
    if (o.failN >= 2) {
      if (u.owner > 0) { const wall = nearestBlockingWall(game, u, t); if (wall && wall !== t) { setOrder(game, u, { type: 'attack', target: wall.id, auto: false }); return; } }
      targetLost(game, u, o);
    } else { o.pathAsked = false; }
  } else if (r === 'arrived') {
    // arrived but out of range (target moved) - re-path next tick
    o.pathAsked = false;
  }
}

function nearestBlockingWall(game, u, t) {
  if (!u.def.canAttack || u.def.tags.includes('monk')) return null;
  const near = game.queryStatic(u.x, u.y, 6, 'building');
  let best = null, bd = 1e9;
  for (const b of near) {
    if (b.dead || !b.def.wall || !game.isEnemy(u.owner, b.owner)) continue;
    const d = Math.hypot(b.x - u.x, b.y - u.y) + Math.hypot(b.x - t.x, b.y - t.y) * 0.3;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function resolveHit(game, u, t, d, reach) {
  const def = u.def;
  if (t.dead) return;
  if (def.range > 0 && def.proj) {
    // ranged
    const slack = reach + 1.2;
    fireProjectile(game, u, t, def.atk, def.proj, { accuracy: def.accuracy, splash: def.splash });
    return;
  }
  // melee: target may have walked away
  if (distToEntity(u, t) > reach + 1.0) return;
  meleeHit(game, u, t);
}

// ------------------------------------------------------------------ gathering
const WORK_ANIM = { tree: 'chop', wood: 'chop', gold: 'mine', stone: 'mine', berries: 'forage', farm: 'farm', carcass: 'butcher' };

function carryCap(u) { return u.def.carry || 10; }

function gatherTick(game, u, o, dt) {
  const pl = game.players[u.owner];
  const def = u.def;
  // ---------------------------------------------------- drop-off trip
  if (o.phase === 'drop') {
    let d = game.byId.get(o.dropoff);
    if (!d || d.dead || !d.built) {
      d = game.findDropoff(u.owner, u.x, u.y, u.carryType || o.res);
      if (!d) { u.anim = 'idle'; o.waitDrop = (o.waitDrop || 0) + dt; if (o.waitDrop > 6) finishOrder(game, u); return; }
      o.dropoff = d.id; u.path = null; o.pathAsked = false;
    }
    const dist = distToRect(u.x, u.y, d.tx, d.ty, d.tx + d.size, d.ty + d.size);
    if (dist <= 1.0) {
      depositCarry(game, u, pl, d);
      // return to work
      o.phase = 'seek'; u.path = null; o.pathAsked = false;
      let r = game.byId.get(o.target);
      if (!r || r.dead || r.amount <= 0 || (r.kind === 'building' && r.farmer && r.farmer !== u.id)) {
        r = retarget(game, u, o);
        if (!r) { finishOrder(game, u); return; }
      }
      return;
    }
    const res = travel(game, u, o, { rect: [d.tx, d.ty, d.tx + d.size, d.ty + d.size], reach: 0.8 }, dt);
    if (res === 'failed') { o.failD = (o.failD || 0) + 1; if (o.failD > 2) finishOrder(game, u); else o.pathAsked = false; }
    else if (res === 'arrived') { o.pathAsked = false; }
    return;
  }

  // ---------------------------------------------------- resolve target
  let t = game.byId.get(o.target);
  if (!t || t.dead || (t.kind === 'resource' && t.amount <= 0) || (t.kind === 'building' && (t.amount <= 0 && t.type === 'farm'))) {
    if (t && t.type === 'farm' && !t.dead) { /* depleted farm: handled below */ }
    // farm depleted -> try to re-seed
    if (t && t.kind === 'building' && t.type === 'farm' && !t.dead && u.owner > 0 && reseed(game, u, o, t)) return;
    t = retarget(game, u, o);
    if (!t) {
      if (u.carry >= 1) { o.phase = 'drop'; o.dropoff = 0; u.path = null; o.pathAsked = false; return; }
      finishOrder(game, u); return;
    }
  }
  // hunting live animals
  if (t.kind === 'unit') { huntTick(game, u, o, t, dt); return; }

  // ---------------------------------------------------- seek
  const isFarm = t.kind === 'building';
  const rect = isFarm ? [t.tx, t.ty, t.tx + t.size, t.ty + t.size] : [t.tx, t.ty, t.tx + 1, t.ty + 1];
  const dist = distToRect(u.x, u.y, rect[0], rect[1], rect[2], rect[3]);
  const inReach = dist <= (isFarm ? 0.9 : GATHER_REACH + 0.25);
  if (o.phase !== 'work' || !inReach) {
    if (!inReach) {
      if (o.phase === 'work') { releaseSlot(game, u); o.phase = 'seek'; u.path = null; o.pathAsked = false; }
      const r = travel(game, u, o, { rect, reach: GATHER_REACH }, dt);
      if (r === 'failed') {
        o.failN = (o.failN || 0) + 1;
        const alt = o.failN >= 1 ? retarget(game, u, o, t) : null;
        if (!alt) { if (u.carry >= 1) { o.phase = 'drop'; o.dropoff = 0; o.pathAsked = false; } else finishOrder(game, u); }
        else { o.pathAsked = false; }
      } else if (r === 'arrived') { o.pathAsked = false; }
      return;
    }
    // arrived: claim a slot
    if (isFarm) {
      if (t.farmer && t.farmer !== u.id) { const alt = retarget(game, u, o, t); if (!alt) finishOrder(game, u); return; }
      t.farmer = u.id; o.slot = true;
    } else { t.gatherers++; o.slot = true; }
    o.phase = 'work'; o.acc = 0;
    const resType = isFarm ? 'food' : t.res;
    if (u.carryType && u.carryType !== resType) { u.carry = 0; }
    u.carryType = resType;
    u.path = null;
  }
  // ---------------------------------------------------- work
  u.stuckT = 0;
  faceTo(u, t.x, t.y);
  const sub = isFarm ? 'farm' : t.sub === 'carcass' ? (t.animal === 'sheep' ? 'sheep' : 'hunt') : t.sub === 'tree' ? 'wood' : t.sub;
  const rate = pl.gatherRate(sub);
  u.anim = isFarm ? 'farm' : (t.sub === 'carcass' ? 'butcher' : WORK_ANIM[t.sub] || 'chop');
  let amt = rate * dt;
  const take = Math.min(amt, t.amount, carryCap(u) - u.carry + 0.0001);
  t.amount -= take; u.carry += take;
  pl.stats.gathered[isFarm ? 'food' : t.res] += take;
  if (u.carry >= carryCap(u) - 1e-4) {
    u.carry = carryCap(u);
    releaseSlot(game, u);
    o.phase = 'drop'; o.dropoff = 0; u.path = null; o.pathAsked = false;
    if (t.amount <= 0) depleted(game, t);
    return;
  }
  if (t.amount <= 0.0001) {
    releaseSlot(game, u);
    depleted(game, t);
    if (t.kind === 'resource' || t.type === 'farm') {
      // keep going on this order: next tick picks a new target (or re-seeds)
      if (t.type !== 'farm' || true) { o.phase = 'seek'; u.path = null; o.pathAsked = false; }
    }
  }
}

function depleted(game, t) {
  if (t.kind === 'resource') game.removeResource(t);
  else if (t.kind === 'building' && t.type === 'farm') { t.amount = 0; t.exhausted = true; }
}

function reseed(game, u, o, farm) {
  const pl = game.players[u.owner];
  const cost = pl.bdefs.farm.cost;
  if (!pl.canAfford(cost)) { farm.farmer = 0; o.slot = false; return false; }
  pl.pay(cost);
  farm.amount = farm.maxAmount = game.fillFarmAmount(pl); farm.exhausted = false; farm.farmer = u.id; o.slot = true; o.phase = 'work';
  game.emit('reseed', { x: farm.x, y: farm.y });
  return true;
}

function depositCarry(game, u, pl, d) {
  if (u.carry > 0 && u.carryType) {
    const amt = u.carry;
    pl.res[u.carryType] += amt;
    game.emit('drop', { x: d.x, y: d.y, res: u.carryType, amt, owner: u.owner });
    u.carry = 0;
  }
}

/** Find the next resource for a gatherer after depletion / failure. */
function retarget(game, u, o, avoid) {
  const nearX = o.lx !== undefined ? o.lx : u.x, nearY = o.ly !== undefined ? o.ly : u.y;
  let res = o.res;
  let t = null;
  const sx = avoid ? avoid.x : nearX, sy = avoid ? avoid.y : nearY;
  if (res === 'food') {
    const prefer = o.sub;                                 // berries / farm / carcass
    if (prefer === 'farm') {
      // nearest free (or own) farm
      let best = null, bd = 1e9;
      for (const b of game.buildings) {
        if (b.owner !== u.owner || b.dead || b.type !== 'farm' || !b.built || (b.farmer && b.farmer !== u.id) || b === avoid) continue;
        if (b.amount <= 0) continue;
        const d = Math.hypot(b.x - sx, b.y - sy);
        if (d < bd && d < 18) { bd = d; best = b; }
      }
      t = best;
    } else if (prefer) {
      t = game.findNearestResource(sx, sy, 'food', 22, { sub: prefer === 'carcass' ? 'carcass' : prefer });
      if (!t && prefer === 'carcass') t = game.findNearestResource(sx, sy, 'food', 22, { sub: 'berries' });
    } else t = game.findNearestResource(sx, sy, 'food', 22);
  } else {
    t = game.findNearestResource(sx, sy, res, res === 'wood' ? 26 : 20, { sub: undefined });
    if (t === avoid) t = null;
  }
  if (t) {
    releaseSlot(game, u);
    o.target = t.id; o.sub = t.kind === 'building' ? 'farm' : t.sub;
    o.lx = t.x; o.ly = t.y;
    o.phase = 'seek'; u.path = null; o.pathAsked = false; o.failN = 0;
    return t;
  }
  return null;
}

// hunting (live animals): kill, then butcher the carcass
function huntTick(game, u, o, t, dt) {
  const def = u.def;
  if (t.owner === u.owner && t.def.domestic) {
    // own livestock: slaughter immediately once close
    const d = distToEntity(u, t);
    if (d > 0.9) {
      if (!u.path || o.huntRepath) { }
      const r = travel(game, u, o, { rect: [t.x - 0.2, t.y - 0.2, t.x + 0.2, t.y + 0.2], reach: 0.8 }, dt);
      if (r === 'arrived' || r === 'failed') o.pathAsked = false;
      return;
    }
    t.hp = 0;
    game.killUnit(t, u);
    o.phase = 'seek';
    // the carcass is created at the sheep's location: retarget to it
    const c = game.findNearestResource(u.x, u.y, 'food', 3, { sub: 'carcass' });
    if (c) { o.target = c.id; o.sub = 'carcass'; } else finishOrder(game, u);
    return;
  }
  // wild animal: fight
  const d = distToEntity(u, t);
  const reach = u.radius + 0.45;
  if (d <= reach) {
    u.path = null; o.pathAsked = false;
    faceTo(u, t.x, t.y);
    if (u.attackT < 0 && u.reload <= 0) { u.attackT = 0; u.hitDone = false; u.reload = def.reload; }
    if (u.attackT >= 0) {
      u.attackT += dt; u.anim = 'attack';
      if (!u.hitDone && u.attackT >= def.attackDur * 0.5) {
        u.hitDone = true;
        const dmg = calcDamage(def.atk, t.def);
        game.emit('hit', { x: t.x, y: t.y, kind: 'blade', owner: u.owner });
        t.lastAttacker = u.id; t.lastHitT = game.time;
        applyDamage(game, u, t, dmg);
        if (t.dead) {
          const c = game.findNearestResource(t.x, t.y, 'food', 2.5, { sub: 'carcass' });
          if (c) { o.target = c.id; o.sub = 'carcass'; o.phase = 'seek'; u.path = null; o.pathAsked = false; }
          else finishOrder(game, u);
          return;
        }
      }
      if (u.attackT >= def.attackDur) u.attackT = -1;
    }
    return;
  }
  u.attackT = -1;
  o.repathT = (o.repathT || 0) - dt;
  if (u.path && o.repathT <= 0) { o.repathT = 0.6; if (o.goalX !== undefined && Math.hypot(t.x - o.goalX, t.y - o.goalY) > 1) { u.path = null; o.pathAsked = false; } }
  if (!u.path && !u.pathWait) { o.goalX = t.x; o.goalY = t.y; }
  const r = travel(game, u, o, { rect: [t.x - 0.15, t.y - 0.15, t.x + 0.15, t.y + 0.15], reach: reach }, dt);
  if (r === 'failed') finishOrder(game, u);
  else if (r === 'arrived') o.pathAsked = false;
}

// ------------------------------------------------------------------ building & repair
function buildTick(game, u, o, dt) {
  const b = game.byId.get(o.target);
  if (!b || b.dead) { finishOrder(game, u); return; }
  if (b.built) { afterBuild(game, u, b); return; }
  const rect = [b.tx, b.ty, b.tx + b.size, b.ty + b.size];
  const dist = distToRect(u.x, u.y, rect[0], rect[1], rect[2], rect[3]);
  if (dist > 1.1) {
    const r = travel(game, u, o, { rect, reach: 0.85 }, dt);
    if (r === 'failed') { o.failN = (o.failN || 0) + 1; if (o.failN > 2) finishOrder(game, u); else o.pathAsked = false; }
    else if (r === 'arrived') o.pathAsked = false;
    return;
  }
  u.path = null;
  u.stuckT = 0;
  faceTo(u, b.x, b.y);
  u.anim = 'build';
  b.nBuilders++;
  o.reachMax = 1.8; o.slot = false;
}

function afterBuild(game, u, b) {
  const q = u.queue;
  if (q.length) { finishOrder(game, u); return; }
  const def = b.def;
  // economic buildings: go to work nearby
  let res = null, sub = null;
  if (b.type === 'farm') {
    if (!b.farmer) { setOrder(game, u, { type: 'gather', target: b.id, res: 'food', sub: 'farm', phase: 'seek', lx: b.x, ly: b.y }); return; }
  } else if (def.dropoff.length && b.type !== 'town_center') {
    const want = b.type === 'mill' ? ['food'] : b.type === 'lumber_camp' ? ['wood'] : ['gold', 'stone'];
    let best = null, bd = 1e9;
    for (const r of want) {
      const list = game.queryStatic(b.x, b.y, 10, 'resource');
      for (const rr of list) {
        if (rr.res !== r || rr.dead || rr.amount <= 0) continue;
        if (b.type === 'mill' && rr.sub !== 'berries') continue;
        const d = Math.hypot(rr.x - b.x, rr.y - b.y);
        if (d < bd && game.resourceReachable(rr, game.nav.regionAt(u.x, u.y))) { bd = d; best = rr; }
      }
    }
    if (best) { setOrder(game, u, { type: 'gather', target: best.id, res: best.res, sub: best.sub, phase: 'seek', lx: best.x, ly: best.y }); return; }
  }
  finishOrder(game, u);
}

function repairTick(game, u, o, dt) {
  const b = game.byId.get(o.target);
  if (!b || b.dead || !b.built || b.hp >= b.maxHp - 0.01) { finishOrder(game, u); return; }
  const rect = [b.tx, b.ty, b.tx + b.size, b.ty + b.size];
  const dist = distToRect(u.x, u.y, rect[0], rect[1], rect[2], rect[3]);
  if (dist > 1.1) {
    const r = travel(game, u, o, { rect, reach: 0.85 }, dt);
    if (r === 'failed') { o.failN = (o.failN || 0) + 1; if (o.failN > 2) finishOrder(game, u); else o.pathAsked = false; }
    else if (r === 'arrived') o.pathAsked = false;
    return;
  }
  u.path = null; u.stuckT = 0; faceTo(u, b.x, b.y); u.anim = 'build';
  o.reachMax = 1.8;
  const pl = game.players[u.owner];
  const hpGain = Math.min(b.maxHp - b.hp, (b.maxHp / (b.def.time * 2.4)) * dt * pl.mods.build);
  // cost: half of the building's cost, proportional to the hp restored
  const frac = hpGain / b.maxHp;
  const cost = {};
  let can = true;
  for (const r of ['food', 'wood', 'gold', 'stone']) { const c = (b.def.cost[r] || 0) * 0.5 * frac; if (c > 0) { cost[r] = c; if (pl.res[r] < c) can = false; } }
  if (!can) { game.notify(u.owner, 'Not enough resources to repair.', b.x, b.y, 'warn'); finishOrder(game, u); return; }
  for (const r in cost) pl.res[r] -= cost[r];
  b.hp += hpGain;
}

// ------------------------------------------------------------------ garrison
function garrisonTick(game, u, o, dt) {
  const b = game.byId.get(o.target);
  if (!b || b.dead || !b.built || b.def.garrison <= 0 || !game.isAllied(u.owner, b.owner)) { finishOrder(game, u); return; }
  const rect = [b.tx, b.ty, b.tx + b.size, b.ty + b.size];
  const dist = distToRect(u.x, u.y, rect[0], rect[1], rect[2], rect[3]);
  if (dist <= 1.0) {
    if (b.garrison.length >= b.def.garrison || u.def.tags.includes('siege')) { finishOrder(game, u); return; }
    u.garrison = b.id; b.garrison.push(u);
    u.path = null; u.order = null; u.queue.length = 0; u.attackT = -1;
    game.emit('garrison', { x: b.x, y: b.y, owner: u.owner });
    return;
  }
  const r = travel(game, u, o, { rect, reach: 0.8 }, dt);
  if (r === 'failed') { o.failN = (o.failN || 0) + 1; if (o.failN > 2) finishOrder(game, u); else o.pathAsked = false; }
  else if (r === 'arrived') o.pathAsked = false;
}

// ------------------------------------------------------------------ monks
export function canConvert(game, m, t) {
  const pl = game.players[m.owner];
  if (t.kind !== 'unit' || t.dead || t.garrison) return false;
  if (t.owner === 0) return false;
  const tags = t.def.tags;
  if (tags.includes('animal')) return false;
  if (tags.includes('monk') && !pl.hasFlag('convertMonk')) return false;
  if (tags.includes('siege') && !pl.hasFlag('convertSiege')) return false;
  return true;
}

function convertTick(game, u, o, dt) {
  const def = u.def;
  const t = game.byId.get(o.target);
  if (!t || t.dead || t.garrison || !canConvert(game, u, t) || !game.isEnemy(u.owner, t.owner)) { u.chan = 0; finishOrder(game, u); return; }
  const range = def.convert.range;
  const d = Math.hypot(t.x - u.x, t.y - u.y);
  if (u.faith < 1 && !(o.chan > 0)) {                    // recharging: wait if close, else go heal
    u.anim = 'idle'; if (o.auto) { finishOrder(game, u); return; }
  }
  if (d > range) {
    o.chan = 0;
    const r = travel(game, u, o, { rect: [t.x - 0.2, t.y - 0.2, t.x + 0.2, t.y + 0.2], reach: range - 1.5 }, dt);
    if (r === 'failed') finishOrder(game, u); else if (r === 'arrived') o.pathAsked = false;
    if (!o.repathT || o.repathT < 0) { o.repathT = 0.8; if (u.path) { u.path = null; o.pathAsked = false; } } else o.repathT -= dt;
    return;
  }
  u.path = null;
  faceTo(u, t.x, t.y);
  if (u.faith < 1) return;
  if (!o.chan) { o.chan = 0.001; const [a, b] = def.convert.time; o.need = a + game.rng.next() * (b - a); const tg = t.def.tags; if (tg.includes('cavalry')) o.need *= 1.3; if (tg.includes('monk')) o.need *= 1.4; if (tg.includes('villager')) o.need *= 0.8; game.emit('convert_start', { x: u.x, y: u.y, owner: u.owner }); }
  o.chan += dt; u.anim = 'attack'; u.attackT = Math.min(def.attackDur, (o.chan % 1.2) / 1.2 * def.attackDur);
  if (o.chan >= o.need) {
    convertUnit(game, t, u.owner);
    u.faith = 0; o.chan = 0;
    game.emit('convert', { x: t.x, y: t.y, from: t.owner, to: u.owner });
    finishOrder(game, u);
  }
}

export function convertUnit(game, t, newOwner) {
  const old = game.players[t.owner], nw = game.players[newOwner];
  if (t.def.tags.includes('villager') || true) { old.pop--; nw.pop++; }
  releaseSlot(game, t);
  t.owner = newOwner;
  const ratio = t.hp / t.maxHp;
  t.def = nw.defs[t.type]; t.maxHp = t.def.hp; t.hp = Math.max(1, ratio * t.maxHp);
  t.order = null; t.queue.length = 0; t.path = null; t.goal = null; t.home = null; t.carry = 0; t.carryType = null;
  t.stance = t.def.tags.includes('villager') ? 'passive' : 'aggressive';
  t.attackT = -1; t.convertedAt = game.time;
  nw.stats.converted = (nw.stats.converted || 0) + 1;
}

function healTick(game, u, o, dt) {
  const def = u.def;
  const t = game.byId.get(o.target);
  if (!t || t.dead || t.garrison || t.hp >= t.maxHp - 0.5 || !game.isAllied(u.owner, t.owner)) { finishOrder(game, u); return; }
  const range = def.heal.range || 5;
  const d = Math.hypot(t.x - u.x, t.y - u.y);
  if (d > range) {
    o.repathT = (o.repathT || 0) - dt;
    if (o.repathT <= 0) { o.repathT = 0.6; u.path = null; o.pathAsked = false; }
    const r = travel(game, u, o, { rect: [t.x - 0.2, t.y - 0.2, t.x + 0.2, t.y + 0.2], reach: range - 1.5 }, dt);
    if (r === 'failed') finishOrder(game, u); else if (r === 'arrived') o.pathAsked = false;
    return;
  }
  u.path = null; faceTo(u, t.x, t.y);
  if (u.attackT < 0 && u.reload <= 0) { u.attackT = 0; u.hitDone = false; u.reload = def.heal.reload; }
  if (u.attackT >= 0) {
    u.attackT += dt; u.anim = 'attack';
    if (!u.hitDone && u.attackT >= def.attackDur * 0.5) {
      u.hitDone = true;
      t.hp = Math.min(t.maxHp, t.hp + def.heal.amount);
      game.emit('heal', { x: t.x, y: t.y });
    }
    if (u.attackT >= def.attackDur) u.attackT = -1;
  }
}

// ------------------------------------------------------------------ wildlife
function animalTick(game, u, dt) {
  const def = u.def;
  if (def.speed === 0) return;                           // sheep
  const home = u.home;
  // being hit: boars and wolves fight back, deer may flee
  if (u.lastAttacker && game.time - u.lastHitT < 6) {
    const a = game.byId.get(u.lastAttacker);
    if (a && !a.dead && !a.garrison) {
      if (def.fights || def.hostile) {
        const d = distToEntity(u, a);
        const tooFarFromDen = home && Math.hypot(a.x - home.x, a.y - home.y) > 12;
        if (d > 14 || tooFarFromDen) { u.lastAttacker = 0; }
        else { animalAttack(game, u, a, dt); return; }
      } else if (def.flees && u.fleeT > 0) {
        // run directly away
        const dx = u.x - a.x, dy = u.y - a.y, l = Math.hypot(dx, dy) || 1;
        const fx = u.x + dx / l * 5, fy = u.y + dy / l * 5;
        if (!u.path || u.pi * 2 >= (u.path.length || 0)) { u.path = [fx, fy]; u.pi = 0; }
        const o = u._fo || (u._fo = { pathAsked: true });
        followPath(game, u, dt, o); u.anim = 'walk'; return;
      }
    }
  }
  // wolves hunt nearby people, but never stray far from their den
  if (def.hostile) {
    const dHome = home ? Math.hypot(u.x - home.x, u.y - home.y) : 0;
    if (dHome > 10) {                                    // too far: go back
      if (!u.path) { u.path = [home.x, home.y]; u.pi = 0; }
    } else {
      u.scanT -= dt;
      if (u.scanT <= 0) {
        u.scanT = 0.6;
        const t = acquireTarget(game, u, def.los, false);
        if (t && home && Math.hypot(t.x - home.x, t.y - home.y) < 11) { u.lastAttacker = t.id; u.lastHitT = game.time; }
      }
    }
  }
  // idle wander
  u.wanderT -= dt;
  if (u.path) {
    const o = u._fo || (u._fo = { pathAsked: true });
    const savedSlow = u.slow; u.slow = def.hostile && u.path.length === 2 && home && Math.hypot(u.x - home.x, u.y - home.y) > 10 ? 1 : 0.45;
    const r = followPath(game, u, dt, o);
    u.slow = savedSlow;
    if (r === 'arrived') u.path = null;
    u.anim = 'walk';
  } else if (u.wanderT <= 0) {
    u.wanderT = 3 + game.rng.next() * 8;
    if (game.rng.next() < 0.55) {
      const a = game.rng.next() * Math.PI * 2, d = 1.5 + game.rng.next() * 3;
      const bx = (home ? home.x : u.x) + Math.cos(a) * d, by = (home ? home.y : u.y) + Math.sin(a) * d;
      if (game.nav.walkAt(bx, by, 0) && game.nav.lineClear(u.x, u.y, bx, by, 0, 0.3)) { u.path = [bx, by]; u.pi = 0; }
    }
  }
}

function animalAttack(game, u, t, dt) {
  const def = u.def;
  const d = distToEntity(u, t);
  const reach = u.radius + 0.4;
  u.atkTarget = t.id;
  if (d <= reach) {
    u.path = null; faceTo(u, t.x, t.y);
    if (u.attackT < 0 && u.reload <= 0) { u.attackT = 0; u.hitDone = false; u.reload = def.reload; }
    if (u.attackT >= 0) {
      u.attackT += dt; u.anim = 'attack';
      if (!u.hitDone && u.attackT >= def.attackDur * 0.5) { u.hitDone = true; meleeHit(game, u, t); }
      if (u.attackT >= def.attackDur) u.attackT = -1;
    }
    return;
  }
  u.attackT = -1;
  const o = u._fo || (u._fo = { pathAsked: true });
  if (!u.path || (u.moveT = (u.moveT || 0) + dt) > 0.5) { u.moveT = 0; u.path = [t.x, t.y]; u.pi = 0; }
  followPath(game, u, dt, o);
  u.anim = 'walk';
}
