'use strict';
// ---------------------------------------------------------------------------
// Buildings: placement, construction, production queues, techs, market, tick
// ---------------------------------------------------------------------------
const WALL_FAMILY = ['palisade', 'stonewall', 'gate'];

function ageReqMet(p, ageIdx) {
  const req = AGE_REQ[ageIdx];
  if (!req) return true;
  const have = new Set();
  for (const b of G.buildings) if (b.owner === p.id && b.built && !b.dead && req.from.includes(b.type)) have.add(b.type);
  return have.size >= req.count;
}
function playerHas(p, type) { for (const b of G.buildings) if (b.owner === p.id && b.built && !b.dead && b.type === type) return true; return false; }

function canPlace(p, type, tx, ty, forHuman) {
  const def = BUILDINGS[type], m = G.map;
  if (def.age > p.age) return { ok: false, why: 'Requires ' + AGES[def.age] };
  for (let y = ty; y < ty + def.size; y++) for (let x = tx; x < tx + def.size; x++) {
    if (!m.inb(x, y) || x < 1 || y < 1 || x >= m.w - 1 || y >= m.h - 1) return { ok: false, why: 'Cannot build here' };
    const i = y * m.w + x;
    if (m.terrain[i] !== 0) return { ok: false, why: 'Cannot build on water' };
    if (m.occ[i] !== 0) {
      const o = G.byId.get(m.occ[i]);
      if (type === 'gate' && o && o.kind === 'building' && o.owner === p.id && (o.type === 'palisade' || o.type === 'stonewall')) continue;
      return { ok: false, why: 'Something is in the way' };
    }
    if (forHuman && !G.observer && m.vis[i] === 0) return { ok: false, why: 'Unexplored' };
  }
  // blocking enemy units is allowed; they will be pushed
  return { ok: true };
}

function placeBuilding(p, type, tx, ty, builders, queued, free) {
  const chk = canPlace(p, type, tx, ty, p.id === G.me && !G.observer);
  if (!chk.ok) return null;
  const cost = bldCost(p, type);
  if (!free) { if (!canAfford(p, cost)) return null; spend(p, cost); }
  // gate replaces wall
  if (type === 'gate') {
    const m = G.map, o = G.byId.get(m.occ[ty * m.w + tx]);
    if (o && o.kind === 'building') { freeBuilding(o); o.dead = true; G.fx.push({ t: 'rubble', x: o.x, y: o.y, size: 1, life: 20, max: 20 }); }
  }
  const b = spawnBuilding(type, p.id, tx, ty, false);
  b.paid = cost;
  pushUnitsOutOf(b);
  updateWallMasks(b);
  if (builders) for (const u of builders) giveOrder(u, { t: 'build', target: b }, queued);
  if (p.id === G.me) fxRing(b.x + b.size / 2, b.y + b.size / 2, '#fff', b.size * 0.8);
  return b;
}

function wallTiles(x0, y0, x1, y1) {
  const out = [];
  if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) { const s = x1 >= x0 ? 1 : -1; for (let x = x0; x !== x1 + s; x += s) out.push([x, y0]); }
  else { const s = y1 >= y0 ? 1 : -1; for (let y = y0; y !== y1 + s; y += s) out.push([x0, y]); }
  return out;
}

function updateWallMasks(b) {
  const touch = (o) => {
    if (!o || o.dead || !WALL_FAMILY.includes(o.type)) return;
    let mask = 0;
    const m = G.map;
    const nb = [[1, 0, 1], [-1, 0, 2], [0, 1, 4], [0, -1, 8]];
    for (const [dx, dy, bit] of nb) {
      const x = o.x + dx, y = o.y + dy;
      if (!m.inb(x, y)) continue;
      const e = G.byId.get(m.occ[y * m.w + x]);
      if (e && e.kind === 'building' && !e.dead && e.owner === o.owner && WALL_FAMILY.includes(e.type)) mask |= bit;
    }
    o.mask = mask;
  };
  if (!WALL_FAMILY.includes(b.type)) return;
  touch(b);
  const m = G.map;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = b.x + dx, y = b.y + dy;
    if (m.inb(x, y)) touch(G.byId.get(m.occ[y * m.w + x]));
  }
}

function onBuildingComplete(b, silent) {
  b.built = true; b.progress = 1; b.hp = b.maxHp = b.stats.hp;
  const p = G.players[b.owner];
  recountPop(p);
  if (!silent) {
    p.stat.bldBuilt++;
    if (b.owner === G.me) { if (typeof SFX !== 'undefined') SFX.at(ecx(b), ecy(b), 'built'); if (!['palisade', 'stonewall', 'farm'].includes(b.type)) notify(b.owner, `${b.def.name} completed.`, ecx(b), ecy(b), 'info'); }
    for (let i = 0; i < 8; i++) fxPart('dust', b.x + Math.random() * b.size, b.y + Math.random() * b.size, 1, { col: 'rgba(200,190,160,0.7)', life: 1, up: 20, size: 4 });
    if (p.ai) p.ai.onBuilt(b);
  }
  updateWallMasks(b);
}

// ----- production ----------------------------------------------------------------------------------
function unitAvailableAt(p, b, id) {
  const base = id === 'UU' ? p.civDef.uu : id;
  const def = UNITS[base];
  if (!def) return false;
  return def.age <= p.age;
}
const QUEUE_MAX = 10;
function cmdTrain(b, id, count = 1) {
  const p = G.players[b.owner];
  let n = 0;
  for (let i = 0; i < count; i++) {
    if (!b.built || b.dead || b.queue.length >= QUEUE_MAX) break;
    if (!b.def.trains.includes(id)) break;
    if (!unitAvailableAt(p, b, id)) break;
    const baseId = id === 'UU' ? p.civDef.uu : id;
    const cur = resolveUnit(p, baseId);
    const def = UNITS[cur];
    const cost = def.cost;
    if (!canAfford(p, cost)) { if (p.id === G.me && !G.observer && i === 0) { notify(p.id, 'Not enough resources.', null, null, 'warn'); if (typeof SFX !== 'undefined') SFX.play('error'); } break; }
    spend(p, cost);
    const total = def.time * trainTimeMult(p, b.type);
    b.queue.push({ kind: 'unit', id: baseId, cost, total, left: total });
    n++;
  }
  return n;
}
function techAvailable(p, id) {
  const t = TECHS[id];
  if (!t) return { ok: false, why: '' };
  if (p.techs.has(id) || p.researching.has(id)) return { ok: false, why: 'Already researched', hide: true };
  if (t.req && !p.techs.has(t.req)) return { ok: false, why: 'Requires ' + TECHS[t.req].name, hide: true };
  if (t.toAge) {
    if (p.age !== t.toAge - 1) return { ok: false, why: '', hide: true };
    for (const o of p.researching) if (TECHS[o].toAge) return { ok: false, why: 'Already advancing' };
    if (!ageReqMet(p, t.toAge)) return { ok: false, why: 'Requires ' + AGE_REQ[t.toAge].text };
    return { ok: true };
  }
  if (t.age > p.age) return { ok: false, why: 'Requires ' + AGES[t.age] };
  if (t.id === 'eliteuu' && false) return { ok: false };
  return { ok: true };
}
function cmdResearch(b, id) {
  const p = G.players[b.owner];
  const t = TECHS[id];
  if (!b.built || b.dead || b.queue.length >= QUEUE_MAX) return false;
  if (!b.def.techs.includes(id)) return false;
  const av = techAvailable(p, id);
  if (!av.ok) { if (p.id === G.me && !G.observer && av.why) notify(p.id, av.why + '.', null, null, 'warn'); return false; }
  if (!canAfford(p, t.cost)) { if (p.id === G.me && !G.observer) { notify(p.id, 'Not enough resources.', null, null, 'warn'); if (typeof SFX !== 'undefined') SFX.play('error'); } return false; }
  spend(p, t.cost);
  const total = t.time * trainTimeMult(p, b.type);
  p.researching.add(id);
  b.queue.push({ kind: 'tech', id, cost: t.cost, total, left: total });
  return true;
}
function cmdCancel(b, idx) {
  const p = G.players[b.owner];
  const it = b.queue[idx];
  if (!it) return;
  b.queue.splice(idx, 1);
  refund(p, it.cost);
  if (it.kind === 'tech') p.researching.delete(it.id);
}
function cmdRally(b, x, y, target) { b.rally = { x, y, target: target || null }; }

function updateProduction(b, dt) {
  const p = G.players[b.owner];
  if (!b.queue.length) return;
  const it = b.queue[0];
  if (it.kind === 'unit') {
    const def = UNITS[resolveUnit(p, it.id)];
    if (p.pop + def.pop > p.popCap) {
      b.housed = true;
      if (b.owner === G.me && !G.observer && (!G.lastAlert.housed || G.time - G.lastAlert.housed > 25)) { G.lastAlert.housed = G.time; notify(b.owner, 'You need more houses!', ecx(b), ecy(b), 'warn'); if (typeof SFX !== 'undefined') SFX.play('error'); }
      return;
    }
  }
  b.housed = false;
  it.left -= dt;
  if (it.left > 0) return;
  b.queue.shift();
  if (it.kind === 'unit') {
    const type = resolveUnit(p, it.id);
    const sp = findSpawnSpot(b);
    const u = spawnUnit(type, b.owner, sp[0], sp[1]);
    p.stat.unitsMade++;
    if (b.rally) rallyUnit(u, b);
    else if (!u.def.tags.includes('villager') && false) { /* stay */ }
    if (b.owner === G.me && !G.observer && typeof SFX !== 'undefined') SFX.play('unit');
    if (p.ai) p.ai.onTrained(u, b);
  } else {
    applyTech(p, it.id);
    if (b.owner === G.me && !G.observer && !TECHS[it.id].toAge) { notify(b.owner, `${TECHS[it.id].name} researched.`, null, null, 'info'); if (typeof SFX !== 'undefined') SFX.play('tech'); }
    if (p.ai) p.ai.onTech(it.id);
  }
}

// ----- building towers / TC / castle shooting ---------------------------------------------------------------
function updateBuildingAttack(b, dt) {
  if (b.cd > 0) { b.cd -= dt; return; }
  const st = b.stats;
  if (st.atkP <= 0) return;
  const cx = ecx(b), cy = ecy(b);
  const range = st.range + b.size / 2;
  nearUnits(cx, cy, range + 1, _near);
  let best = null, bd = 1e9;
  for (let i = 0; i < _near.length; i++) {
    const o = _near[i];
    if (o.dead || !isEnemy(b.owner, o.owner)) continue;
    if (o.stats.armP >= 100) continue;
    const d = Math.hypot(o.x - cx, o.y - cy);
    if (d > range || d >= bd) continue;
    bd = d; best = o;
  }
  if (!best) { b.cd = 0.3; return; }
  let arrows = 1;
  if (b.type !== 'palisade') arrows += Math.min(b.garrison.length, 20) * (b.type === 'tower' ? 1 : 0.5);
  arrows = Math.floor(arrows);
  if (b.type === 'towncenter') arrows = 1 + Math.min(b.garrison.length, 15);
  const as = { atkM: 0, atkP: st.atkP, bonus: {}, range: st.range };
  for (let i = 0; i < arrows; i++) {
    const tgt = i === 0 ? best : best;
    G.projectiles.push({ kind: 'arrow', x: cx, y: cy, sx: cx, sy: cy, tx: tgt.x, ty: tgt.y, target: tgt, att: b, owner: b.owner, aStats: as, speed: 14, dist: bd, t: -i * 0.06, splash: 0, homing: true, arc: 0.3, fromBld: true });
  }
  b.cd = st.reload;
  if (typeof SFX !== 'undefined') SFX.at(cx, cy, 'bow');
}

function updateBuilding(b, dt) {
  if (b.dead) return;
  if (b.flash > 0) b.flash -= dt;
  const p = G.players[b.owner];
  if (!b.built) {
    const n = b.workers || 0; b.workers = 0;
    if (n > 0) {
      const rate = Math.pow(n, 0.7) * (1 + p.buildBonus) * BUILD_BASE;
      const dp = dt * rate / b.def.time;
      b.progress = Math.min(1, b.progress + dp);
      b.hp = Math.min(b.maxHp, b.hp + dp * b.maxHp * 0.95);
      b.buildRate = n;
      if (b.progress >= 1) onBuildingComplete(b, false);
    } else b.buildRate = 0;
    return;
  }
  // repair
  const rn = b.repairers || 0; b.repairers = 0;
  if (rn > 0 && b.hp < b.maxHp) {
    const rate = Math.pow(rn, 0.7) * (1 + p.buildBonus) * 0.8;
    const heal = dt * rate * b.maxHp / (b.def.time * 1.5);
    b.hp = Math.min(b.maxHp, b.hp + heal);
  }
  updateProduction(b, dt);
  if (b.stats.atkP > 0) updateBuildingAttack(b, dt);
  if (b.garrison.length) for (const u of b.garrison) u.hp = Math.min(u.maxHp, u.hp + 1.5 * dt);
  if (b.type === 'farm' && b.food <= 0) {
    const cost = bldCost(p, 'farm').wood;
    if (p.res.wood >= cost && (p.autoReseed !== false)) { p.res.wood -= cost; b.food = b.maxFood; fxPart('chip', ecx(b), ecy(b), 4, { col: '#6aa23a', life: 0.8, up: 18 }); }
  }
}

// ----- market --------------------------------------------------------------------------------------------------------
function marketBuy(p, res, n = 100) {
  const price = p.market[res];
  const cost = Math.round(price * 1.25 * n / 100);
  if (p.res.gold < cost) { if (p.id === G.me) { notify(p.id, 'Not enough gold.', null, null, 'warn'); if (typeof SFX !== 'undefined') SFX.play('error'); } return false; }
  p.res.gold -= cost; p.res[res] += n;
  p.market[res] = Math.min(250, price + 3 * n / 100);
  if (p.id === G.me && typeof SFX !== 'undefined') SFX.play('coin');
  return true;
}
function marketSell(p, res, n = 100) {
  if (p.res[res] < n) { if (p.id === G.me) { notify(p.id, 'Not enough ' + res + '.', null, null, 'warn'); if (typeof SFX !== 'undefined') SFX.play('error'); } return false; }
  const gain = Math.round(p.market[res] * 0.75 * n / 100);
  p.res[res] -= n; p.res.gold += gain;
  p.market[res] = Math.max(25, p.market[res] - 3 * n / 100);
  if (p.id === G.me && typeof SFX !== 'undefined') SFX.play('coin');
  return true;
}

// ----- victory ----------------------------------------------------------------------------------------------------------
function checkVictory() {
  if (G.over) return;
  for (const p of G.players) {
    if (!p.alive) continue;
    let has = false;
    for (const b of G.buildings) if (b.owner === p.id && !b.dead && !WALL_FAMILY.includes(b.type) && b.type !== 'farm') { has = true; break; }
    if (!has) {
      // villagers alive with enough to rebuild a Town Center keep the player alive
      let vill = 0;
      for (const u of G.units) if (u.owner === p.id && !u.dead && u.def.tags.includes('villager')) vill++;
      if (vill > 0 && (p.res.wood >= 275 && p.res.stone >= 100) && p.lostTime < 90) { p.lostTime += 1; continue; }
      p.alive = false;
      for (const u of G.units) if (u.owner === p.id && !u.dead) { u.dead = true; G.fx.push({ t: 'corpse', x: u.x, y: u.y, def: u.def, owner: u.owner, fx: u.fx, life: 6, max: 6, seed: u.seed }); }
      G.units.forEach((u) => { if (u.owner === p.id) { u.dead = true; } });
    }
  }
  const alive = G.players.filter((p) => p.alive);
  if (alive.length <= 1) {
    G.over = true; G.winner = alive.length ? alive[0].id : -1; G.overTime = G.time;
  }
}

// ----- tick ------------------------------------------------------------------------------------------------------------------
function cleanup() {
  let w = 0;
  for (let i = 0; i < G.units.length; i++) { const u = G.units[i]; if (u.dead) { G.byId.delete(u.id); } else G.units[w++] = u; }
  G.units.length = w; w = 0;
  for (let i = 0; i < G.buildings.length; i++) { const b = G.buildings[i]; if (b.dead) { G.byId.delete(b.id); } else G.buildings[w++] = b; }
  G.buildings.length = w; w = 0;
  for (let i = 0; i < G.resources.length; i++) { const r = G.resources[i]; if (r.dead) { G.byId.delete(r.id); } else G.resources[w++] = r; }
  G.resources.length = w;
  G.sel = G.sel.filter((e) => !e.dead);
}

function tick(dt) {
  G.time += dt; G.tickCount++;
  buildHash();
  for (let i = 0; i < G.units.length; i++) updateUnit(G.units[i], dt);
  separateUnits(dt);
  updateAnimals(dt);
  for (let i = 0; i < G.buildings.length; i++) updateBuilding(G.buildings[i], dt);
  // projectiles
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    pr.t += dt * pr.speed / Math.max(1, pr.dist);
    if (pr.t < 0) continue;
    if (pr.homing && pr.target && !pr.target.dead) { pr.tx = ecx(pr.target); pr.ty = ecy(pr.target); }
    const t = Math.min(1, pr.t);
    pr.x = lerp(pr.sx, pr.tx, t); pr.y = lerp(pr.sy, pr.ty, t);
    if (pr.t >= 1) { projectileImpact(pr); G.projectiles.splice(i, 1); }
  }
  // effects
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    f.life -= dt;
    if (f.t === 'part') { f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vz -= (f.kind === 'heal' || f.kind === 'conv' || f.kind === 'dust' ? -4 : 80) * dt; if (f.z < 0) { f.z = 0; f.vz = 0; } }
    else if (f.t === 'text') f.z += 14 * dt;
    if (f.life <= 0) { G.fx[i] = G.fx[G.fx.length - 1]; G.fx.pop(); }
  }
  for (const p of G.players) if (p.ai && p.alive) p.ai.update(dt);
  processPathQueue(3);
  G.visTimer -= dt;
  if (G.visTimer <= 0) { G.visTimer = 0.2; updateVision(); if (typeof R !== 'undefined') R.fogDirty = true; }
  G.cleanT = (G.cleanT || 0) - dt;
  if (G.cleanT <= 0) { G.cleanT = 0.3; cleanup(); }
  G.vicT = (G.vicT || 0) - dt;
  if (G.vicT <= 0) { G.vicT = 1; checkVictory(); for (const p of G.players) for (const r of ['food', 'wood', 'stone']) p.market[r] += (100 - p.market[r]) * 0.02; }
}

// ----- new game ------------------------------------------------------------------------------------------------------------------
const DIFFICULTY = {
  easy: { name: 'Easy', gather: 0.75, think: 1.2, villagers: 28, firstAttack: 780, waveMin: 10, mistakes: 0.25, aggression: 0.5, upgrades: 0.5 },
  moderate: { name: 'Standard', gather: 1.0, think: 0.7, villagers: 45, firstAttack: 560, waveMin: 16, mistakes: 0.1, aggression: 0.8, upgrades: 0.8 },
  hard: { name: 'Hard', gather: 1.3, think: 0.45, villagers: 60, firstAttack: 420, waveMin: 14, mistakes: 0, aggression: 1.1, upgrades: 1.0 },
};

function resetGame() {
  G.units = []; G.buildings = []; G.resources = []; G.byId = new Map(); G.nextId = 1; G.projectiles = []; G.fx = [];
  G.time = 0; G.paused = false; G.over = false; G.winner = -1; G.sel = []; G.pathQ = []; G.alerts = []; G.lastAlert = {}; G.groups = {};
  G.hash = null; G.visTimer = 0; G.cleanT = 0; G.vicT = 0; G.tickCount = 0; G.demo = false;
}

function setupGame(opts, map) {
  resetGame();
  G.opts = opts; G.map = map; G.observer = !!opts.observer; G.me = 0;
  const civs = Object.keys(CIVS);
  const myCiv = opts.civ || 'britons';
  let enemyCiv = opts.enemyCiv || 'random';
  if (enemyCiv === 'random') { const others = civs.filter((c) => c !== myCiv); enemyCiv = others[Math.floor(Math.random() * others.length)]; }
  G.players = [mkPlayer(0, myCiv, !opts.observer, 'You'), mkPlayer(1, enemyCiv, false, CIVS[enemyCiv].name + ' AI')];
  if (opts.observer) { G.players[0].name = CIVS[myCiv].name + ' AI'; }
  const start = opts.start || { food: 250, wood: 250, gold: 100, stone: 100 };
  for (const p of G.players) { Object.assign(p.res, start); p.market = { food: 100, wood: 100, stone: 100 }; }
  // resources
  for (const s of map.spawns) {
    if (s.kind === 'tree') spawnResource('tree', s.x, s.y);
    else if (s.kind === 'deer' || s.kind === 'boar') spawnResource(s.kind, s.x, s.y);
    else spawnResource(s.kind, s.x, s.y, s.amount);
  }
  // bases
  for (let i = 0; i < 2; i++) {
    const p = G.players[i], bp = map.bases[i];
    const tc = spawnBuilding('towncenter', i, bp[0] - 2, bp[1] - 2, true);
    p.startPos = { x: bp[0], y: bp[1] };
    for (let k = 0; k < 4; k++) {
      const sp = findSpawnSpot(tc);
      const v = spawnUnit('villager', i, sp[0], sp[1]);
    }
    const sp = findSpawnSpot(tc);
    spawnUnit('scout', i, sp[0], sp[1]);
    recountPop(p);
    refreshStats(p);
  }
  // AI
  const diff = DIFFICULTY[opts.difficulty || 'moderate'];
  G.players[1].ai = new AIPlayer(G.players[1], diff);
  if (opts.observer) G.players[0].ai = new AIPlayer(G.players[0], DIFFICULTY[opts.difficulty2 || opts.difficulty || 'moderate']);
  // optional starting age / revealed map
  const sa = clamp(opts.startAge | 0, 0, 3);
  if (sa > 0) for (const p of G.players) {
    for (let n = 1; n <= sa; n++) p.techs.add(['feudal', 'castle', 'imperial'][n - 1]);
    p.age = sa; refreshStats(p);
    for (const b of G.buildings) if (b.owner === p.id) b.age = sa;
  }
  if (opts.reveal) for (let i = 0; i < map.vis.length; i++) map.vis[i] = 1;
  updateVision();
  // assign starting villagers to gather: berries/ wood for AI handled by AI; human starts idle (as in AoE2) but give nice default: none
  for (let i = 0; i < G.players.length; i++) {
    if (!G.players[i].ai) continue;
  }
}
