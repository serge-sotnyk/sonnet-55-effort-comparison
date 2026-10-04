'use strict';
// ---------------------------------------------------------------------------
// Unit behaviour: orders, movement, gathering, building, combat, monks
// ---------------------------------------------------------------------------
const ECON_KEY = { tree: 'wood', gold: 'gold', stone: 'stone', berries: 'food', deer: 'food', boar: 'food', carcass: 'food', farm: 'food' };
const GATHER_KEY = { tree: 'wood', gold: 'gold', stone: 'stone', berries: 'berries', deer: 'hunt', boar: 'hunt', carcass: 'hunt', farm: 'farm' };
const TOOL_FOR = { wood: 'axe', gold: 'pick', stone: 'pick', farm: 'hoe', berries: 'basket', hunt: 'javelin' };

function resEconKey(r) { return ECON_KEY[r.type] || 'food'; }
function resGatherKey(r) { return r.kind === 'building' ? 'farm' : GATHER_KEY[r.type]; }
function isMilitary(u) { return !u.def.tags.includes('villager') && !u.def.tags.includes('monk') && u.def.id !== 'villager'; }
function isCombatant(u) { return u.stats.atkM > 0 || u.stats.atkP > 0; }

// ----- path requests ------------------------------------------------------------------
function requestPath(u, rect, r, exact) {
  u.goal = { x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3], r, exact };
  u.path = null; u.pi = 0; u.partial = false;
  if (tryDirectPath(u)) return;
  // an identical request failed (partial path) moments ago: reuse it instead of searching the whole map again
  const lp = u.lastPartial, key = Math.round(rect[0]) + ',' + Math.round(rect[1]) + ',' + r;
  if (lp && lp.key === key && lp.until > G.time && Math.hypot(lp.sx - u.x, lp.sy - u.y) < 6) {
    u.path = lp.path.map((p) => [p[0], p[1]]); u.pi = 0; u.partial = true; u.pathPending = false; return;
  }
  u.pathPending = true;
  if (!u.inPathQ) { u.inPathQ = true; G.pathQ.push(u); }
}
function tryDirectPath(u) {
  const g = u.goal;
  let gx, gy;
  if (g.exact) { gx = g.x0; gy = g.y0; }
  else {
    const cx = clamp(u.x, g.x0, g.x1), cy = clamp(u.y, g.y0, g.y1);
    const dx = u.x - cx, dy = u.y - cy, d = Math.hypot(dx, dy);
    if (d <= g.r * 0.95) { u.path = []; u.pi = 0; u.pathPending = false; return true; } // already in range
    const back = Math.min(g.r, 0.8) * 0.9;
    // stand just outside the rect (or at range)
    const stand = g.r > 1.2 ? g.r * 0.9 : Math.max(back, 0.5);
    if (d < 1e-6) { gx = cx; gy = cy; } else { gx = cx + dx / d * stand; gy = cy + dy / d * stand; }
  }
  const d = Math.hypot(gx - u.x, gy - u.y);
  if (d > 70) return false;
  if (!G.map.passableAt(gx, gy, u.owner)) return false;
  if (G.map.lineClear(u.x, u.y, gx, gy, u.owner)) { u.path = [[gx, gy]]; u.pi = 0; u.pathPending = false; return true; }
  return false;
}
function processPathQueue(budgetMs) {
  budgetMs += Math.min(10, G.pathQ.length * 0.25);
  const t0 = performance.now();
  let n = 0;
  while (n < G.pathQ.length) {
    if (performance.now() - t0 > budgetMs && n > 0) break;
    const u = G.pathQ[n++];
    u.inPathQ = false;
    if (u.dead || !u.goal || !u.pathPending) continue;
    const g = u.goal;
    const res = G.map.findPath(u.x, u.y, g.x0, g.y0, g.x1, g.y1, g.r, u.owner);
    u.path = res.path; u.pi = 0; u.partial = res.partial; u.pathPending = false;
    if (res.partial) u.lastPartial = { key: Math.round(g.x0) + ',' + Math.round(g.y0) + ',' + g.r, until: G.time + 6, path: res.path.map((p) => [p[0], p[1]]), sx: u.x, sy: u.y };
    if (g.exact && !res.partial && u.path.length) {
      const last = u.path[u.path.length - 1];
      const prev = u.path.length > 1 ? u.path[u.path.length - 2] : [u.x, u.y];
      if (G.map.passableAt(g.x0, g.y0, u.owner) && G.map.lineClear(prev[0], prev[1], g.x0, g.y0, u.owner)) { last[0] = g.x0; last[1] = g.y0; }
    }
  }
  G.pathQ.splice(0, n);
}

// ----- movement -------------------------------------------------------------------------
function stepTo(u, nx, ny) {
  const m = G.map, t = u.owner;
  if (m.passableAt(nx, ny, t)) { u.x = nx; u.y = ny; return true; }
  if (m.passableAt(nx, u.y, t)) { u.x = nx; return true; }
  if (m.passableAt(u.x, ny, t)) { u.y = ny; return true; }
  return false;
}
function setFacing(u, dx, dy) {
  const sdx = dx - dy, sdy = (dx + dy) * 0.5;
  if (Math.abs(sdx) > 0.02) u.fx = sdx > 0 ? 1 : -1;
  u.back = sdy < 0 && Math.abs(sdy) > Math.abs(sdx) * 0.4;
}
function moveSpeed(u) {
  let s = u.stats.speed;
  if (u.moveCap && u.moveCap < s) s = u.moveCap;
  if (u.carry.amount > 0 && u.def.id === 'villager') s *= 0.95;
  return s;
}
// returns 'wait' | 'moving' | 'done' | 'blocked'
function moveAlong(u, dt) {
  if (u.pathPending) return 'wait';
  if (!u.path) return 'done';
  let left = moveSpeed(u) * dt;
  let blocked = false;
  while (left > 1e-6 && u.pi < u.path.length) {
    const wp = u.path[u.pi];
    const dx = wp[0] - u.x, dy = wp[1] - u.y, d = Math.hypot(dx, dy);
    if (d <= left) {
      if (!stepTo(u, wp[0], wp[1])) { blocked = true; break; }
      u.pi++; left -= d;
      if (d > 0.01) setFacing(u, dx, dy);
    } else {
      if (!stepTo(u, u.x + dx / d * left, u.y + dy / d * left)) { blocked = true; break; }
      setFacing(u, dx, dy);
      left = 0;
    }
  }
  u.moving = true;
  if (blocked) return 'blocked';
  return u.pi >= u.path.length ? 'done' : 'moving';
}

// ----- state helpers --------------------------------------------------------------------
function releaseTarget(u) {
  const t = u.target;
  if (t && t.kind === 'building' && t.type === 'farm') { const i = t.farmers.indexOf(u); if (i >= 0) t.farmers.splice(i, 1); }
  u.spot = null;
}
function setState(u, s) {
  releaseTarget(u);
  u.state = s; u.path = null; u.pi = 0; u.pathPending = false; u.goal = null; u.target = null; u.gs = null; u.convT = 0; u.stuckT = 0; u.pathFail = 0; u.moveCap = 0;
}
function goIdle(u) {
  if (u.queue.length) { const o = u.queue.shift(); execOrder(u, o); return; }
  setState(u, 'idle'); u.resume = null; u.homeX = u.x; u.homeY = u.y;
}
function giveOrder(u, order, queued) {
  if (u.dead || u.garrisoned) return;
  if (queued && u.state !== 'idle') { if (u.queue.length < 12) u.queue.push(order); return; }
  u.queue.length = 0;
  execOrder(u, order);
}
function execOrder(u, o) {
  switch (o.t) {
    case 'move': orderMove(u, o.x, o.y); break;
    case 'amove': orderAMove(u, o.x, o.y); break;
    case 'attack': orderAttack(u, o.target); break;
    case 'gather': orderGather(u, o.target); break;
    case 'build': orderBuild(u, o.target); break;
    case 'repair': orderRepair(u, o.target); break;
    case 'garrison': orderGarrison(u, o.target); break;
    case 'heal': orderHeal(u, o.target); break;
    case 'convert': orderConvert(u, o.target); break;
    case 'chop': orderChop(u, o.target, o.list); break;
    case 'stop': setState(u, 'idle'); break;
  }
}
function orderMove(u, x, y) {
  setState(u, 'move'); u.resume = null;
  u.dest = { x, y };
  requestPath(u, [x, y, x, y], 0.75, true);
}
function orderAMove(u, x, y) {
  setState(u, 'amove'); u.dest = { x, y }; u.scanT = 0;
  requestPath(u, [x, y, x, y], 0.75, true);
}
function orderStop(u) { u.queue.length = 0; setState(u, 'idle'); u.resume = null; u.homeX = u.x; u.homeY = u.y; }
function attackReach(u, t) {
  if (u.stats.range > 1.5) return u.stats.range;
  return t.kind === 'building' ? 0.98 : (t.kind === 'unit' && t.def.radius > 0.4 ? 1.0 : 0.8);
}
function orderAttack(u, t) {
  if (!t || t.dead) return goIdle(u);
  if (!isCombatant(u) && !u.def.tags.includes('villager')) return;
  const resume = u.resume;
  setState(u, 'attack'); u.target = t; u.resume = resume;
  attackChase(u);
}
function attackChase(u) {
  const t = u.target;
  const r = attackReach(u, t);
  const rc = entRect(t);
  requestPath(u, rc, Math.max(0.9, r * (u.stats.range > 1.5 ? 0.92 : 0.85)), false);
  u.chaseT = 0.6; u.chaseX = ecx(t); u.chaseY = ecy(t);
}
function orderGather(u, res) {
  if (!res || res.dead) return goIdle(u);
  const key = resEconKey(res);
  if (u.carry.amount > 0 && u.carry.type !== key) { u.carry.amount = 0; }
  setState(u, 'gather'); u.target = res; u.gs = 'toRes'; u.gkey = resGatherKey(res);
  u.lastResX = res.kind === 'building' ? ecx(res) : res.x; u.lastResY = res.kind === 'building' ? ecy(res) : res.y; u.lastResType = res.type;
  if (res.kind === 'building') { assignFarmSpot(u, res); }
  gatherPath(u);
}
function assignFarmSpot(u, f) {
  if (f.farmers.indexOf(u) < 0) f.farmers.push(u);
  const spots = [[0.8, 0.8], [2.2, 0.8], [0.8, 2.2], [2.2, 2.2], [1.5, 1.5], [1.5, 0.5], [0.5, 1.5]];
  let pick = spots[0];
  for (const s of spots) {
    const sx = f.x + s[0], sy = f.y + s[1];
    if (!f.farmers.some((o) => o !== u && o.spot && Math.abs(o.spot.x - sx) < 0.3 && Math.abs(o.spot.y - sy) < 0.3)) { pick = s; break; }
  }
  u.spot = { x: f.x + pick[0], y: f.y + pick[1] };
}
function gatherPath(u) {
  const t = u.target;
  if (t.kind === 'building') { requestPath(u, [u.spot.x, u.spot.y, u.spot.x, u.spot.y], 0.75, true); return; }
  if (t.animal) { requestPath(u, [t.x, t.y, t.x, t.y], 0.9, false); return; }
  requestPath(u, entRect(t), 1.0, false);
}
function orderBuild(u, b) {
  if (!b || b.dead) return goIdle(u);
  setState(u, 'build'); u.target = b;
  requestPath(u, entRect(b), 1.0, false);
}
function orderRepair(u, b) {
  if (!b || b.dead) return goIdle(u);
  setState(u, 'repair'); u.target = b;
  requestPath(u, entRect(b), 1.0, false);
}
function canGarrison(u, b) {
  if (!b.built || b.dead || b.owner !== u.owner) return false;
  if (!b.def.garrison || b.garrison.length >= b.def.garrison) return false;
  if (!u.def.tags.includes('foot')) return false;
  if (b.type === 'tower' && u.def.tags.includes('villager')) return false;
  return true;
}
function orderGarrison(u, b) {
  if (!b || b.dead) return goIdle(u);
  setState(u, 'garrison'); u.target = b;
  requestPath(u, entRect(b), 1.0, false);
}
function orderChop(u, tree, list) {
  if (!tree || tree.dead || tree.type !== 'tree') return goIdle(u);
  setState(u, 'chop'); u.target = tree; u.chopList = list || [];
  requestPath(u, entRect(tree), 1.0, false);
}
function updateChop(u, dt) {
  const t = u.target;
  if (!t || t.dead || t.amount <= 0) {
    const next = (u.chopList || []).shift();
    if (next && !next.dead) { u.target = next; u.path = null; requestPath(u, entRect(next), 1.0, false); u.pathFail = 0; return; }
    goIdle(u); return;
  }
  if (distEnt(u.x, u.y, t) <= 1.12) {
    u.path = null;
    setFacing(u, t.x - u.x, t.y - u.y);
    u.workT += dt; u.act = 'attack'; u.actP = (u.workT * 1.1) % 1;
    u.chopT = (u.chopT || 0) + dt;
    if (u.chopT >= 0.9) {
      u.chopT = 0; t.amount -= 25; t.flash = 0.1;
      fxPart('chip', t.x, t.y, 2, { col: '#b08a54', life: 0.5, up: 24, size: 2 });
      if (typeof SFX !== 'undefined') SFX.at(u.x, u.y, 'chop');
      if (t.amount <= 0) removeResource(t);
    }
    return;
  }
  const r = moveAlong(u, dt);
  if (r === 'done' || r === 'blocked') {
    // the target is deeper in the forest: cut the adjacent tree that blocks the way first
    const m = G.map; let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = Math.floor(u.x) + dx, y = Math.floor(u.y) + dy;
      if (!m.inb(x, y) || !m.tree[y * m.w + x]) continue;
      const e = G.byId.get(m.occ[y * m.w + x]);
      if (!e || e.dead || e === t || distEnt(u.x, u.y, e) > 1.12) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { (u.chopList || (u.chopList = [])).unshift(t); u.target = best; u.pathFail = 0; return; }
    u.pathFail++;
    if (u.pathFail > 3) { u.chopList = []; goIdle(u); } else requestPath(u, entRect(t), 1.0, false);
  }
}
function orderHeal(u, t) { setState(u, 'heal'); u.target = t; requestPath(u, entRect(t), 2.5, false); }
function orderConvert(u, t) { setState(u, 'convert'); u.target = t; u.convT = 0; requestPath(u, entRect(t), Math.max(2, u.stats.range - 1), false); }

// ----- targets ---------------------------------------------------------------------------
function validTarget(u, t) {
  if (!t || t.dead) return false;
  if (t.kind === 'res') return t.animal && t.alive && (t.type === 'boar' || false);
  if (t.garrisoned) return false;
  return isEnemy(u.owner, t.owner);
}
function findTarget(u, scan) {
  const st = u.stats;
  const tags = u.def.tags;
  const siege = tags.includes('siege');
  const ramOnly = tags.includes('ram') || u.def.buildingsOnly;
  let best = null, bs = 1e9;
  if (!ramOnly) {
    nearUnits(u.x, u.y, scan, _near);
    for (let i = 0; i < _near.length; i++) {
      const o = _near[i];
      if (o.dead || !isEnemy(u.owner, o.owner)) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d > scan) continue;
      let sc = d;
      if (!isCombatant(o)) sc += 3.5;
      if (o.def.tags.includes('siege')) sc -= 1;
      if (o.def.tags.includes('monk')) sc += 1;
      // do not chase things we cannot hurt
      if (o.stats.armP >= 100 && st.atkM <= 0 && st.range > 1.5 && !st.bonus.siege) sc += 10;
      if (sc < bs) { bs = sc; best = o; }
    }
  }
  if (!best || ramOnly || siege) {
    for (const b of G.buildings) {
      if (b.dead || !isEnemy(u.owner, b.owner) || b.def.tags.includes('wall')) continue;
      const d = distEnt(u.x, u.y, b);
      const lim = ramOnly ? scan : scan * 0.55;
      if (d > lim) continue;
      let sc = d + (b.def.atk && b.built ? 2 : (ramOnly ? 0 : 9));
      if (b.type === 'farm') sc += 6;
      if (sc < bs) { bs = sc; best = b; }
    }
  }
  if (!best && G.players[u.owner].ai && !tags.includes('villager')) {
    // computer-controlled armies will break through walls that block them
    for (const b of G.buildings) {
      if (b.dead || !isEnemy(u.owner, b.owner) || !b.def.tags.includes('wall')) continue;
      const d = distEnt(u.x, u.y, b);
      if (d > 2.5) continue;
      if (d < bs) { bs = d; best = b; }
    }
  }
  return best;
}
function scanRange(u) {
  const st = u.stats;
  if (u.stance === 'stand') return st.range > 1.5 ? st.range : 1.3;
  if (u.stance === 'defensive') return Math.max(st.range + 1.5, 4);
  return Math.max(st.range + 2, Math.min(st.los, 7.5), 5);
}

// ----- damage ---------------------------------------------------------------------------------
function calcDamage(att, tgt, aStats) {
  let armM = 0, armP = 0, tags = EMPTY;
  if (tgt.kind === 'unit') { armM = tgt.stats.armM; armP = tgt.stats.armP; tags = tgt.def.tags; }
  else if (tgt.kind === 'building') { armM = tgt.stats.armM; armP = tgt.stats.armP; tags = tgt.def.tags; }
  let d = Math.max(0, aStats.atkM - armM) + Math.max(0, aStats.atkP - armP);
  const bn = aStats.bonus;
  for (const k in bn) if (tags.includes(k)) d += bn[k];
  return Math.max(1, d);
}
function hurt(t, dmg, att) {
  if (t.dead) return;
  t.hp -= dmg; t.flash = 0.12; t.lastHit = G.time;
  if (att && att.owner != null && G.players[att.owner]) { /* stats */ }
  if (t.hp <= 0) { die(t, att); return; }
  if (t.kind === 'unit') {
    if (t.owner === G.me) alertAttack(t.owner, t.x, t.y, t.def.tags.includes('villager') ? 'villagers' : 'military');
    const p = G.players[t.owner];
    if (p.ai) p.ai.onAttacked(t, att);
    if (att && att.kind === 'unit' || att && att.kind === 'building') {
      if (isCombatant(t) && !t.def.tags.includes('villager') && (t.state === 'idle' || (t.state === 'move' && false)) && t.stance !== 'stand' && isEnemy(t.owner, att.owner) && !att.dead) {
        t.resume = { x: t.x, y: t.y, ret: true };
        const saved = t.resume; orderAttack(t, att); t.resume = saved;
      }
    }
  } else if (t.kind === 'building') {
    if (t.owner === G.me) alertAttack(t.owner, ecx(t), ecy(t), t.def.name);
    const p = G.players[t.owner];
    if (p.ai) p.ai.onAttacked(t, att);
  } else if (t.animal) {
    if (t.type === 'boar' && att && att.kind === 'unit') t.target = att;
  }
}
function die(e, killer) {
  if (e.dead) return;
  e.dead = true;
  const kp = killer && killer.owner != null && G.players[killer.owner];
  if (e.kind === 'unit') {
    const p = G.players[e.owner];
    p.pop -= e.def.pop; p.stat.losses++;
    if (kp && kp !== p) kp.stat.kills++;
    releaseTarget(e);
    e.state = 'dead';
    const si = G.sel.indexOf(e); if (si >= 0) G.sel.splice(si, 1);
    G.fx.push({ t: 'corpse', x: e.x, y: e.y, def: e.def, owner: e.owner, fx: e.fx, life: 8, max: 8, seed: e.seed, big: e.def.tags.includes('siege') });
    fxPart('blood', e.x, e.y, e.def.tags.includes('siege') ? 8 : 4, { col: e.def.tags.includes('siege') ? '#8a6a3a' : '#a02020', life: 0.5, up: 14 });
    if (typeof SFX !== 'undefined') SFX.at(e.x, e.y, e.def.tags.includes('siege') ? 'crash' : 'death');
    if (p.ai) p.ai.onLost(e);
  } else if (e.kind === 'building') {
    const p = G.players[e.owner];
    p.stat.bldLost++; if (kp && kp !== p) kp.stat.kills += 0;
    freeBuilding(e);
    for (const u of e.garrison.slice()) ungarrisonUnit(u, e, true);
    e.garrison.length = 0;
    const si = G.sel.indexOf(e); if (si >= 0) G.sel.splice(si, 1);
    G.fx.push({ t: 'rubble', x: e.x, y: e.y, size: e.size, life: 90, max: 90 });
    for (let i = 0; i < 10 + e.size * 4; i++) fxPart('dust', e.x + Math.random() * e.size, e.y + Math.random() * e.size, 1, { col: 'rgba(160,150,130,0.8)', life: 1.4, up: 24, size: 5 });
    for (let i = 0; i < 6 + e.size * 3; i++) fxPart('chip', e.x + Math.random() * e.size, e.y + Math.random() * e.size, 1, { col: '#6a4a2a', life: 0.9, up: 40, size: 2.5 });
    if (typeof SFX !== 'undefined') SFX.at(ecx(e), ecy(e), 'collapse');
    if (e.owner === G.me) { notify(e.owner, `Your ${e.def.name} was destroyed!`, ecx(e), ecy(e), 'attack'); }
    recountPop(p);
    for (const u of G.units) if (u.target === e) { if (u.state === 'build' || u.state === 'repair' || u.state === 'attack' || u.state === 'garrison') goIdle(u); }
    if (p.ai) p.ai.onLostBuilding(e);
  } else if (e.animal) {
    e.alive = false; e.hp = 0; e.dead = false; e.state = 'dead'; e.target = null;
  }
}
function recountPop(p) {
  let cap = 0;
  for (const b of G.buildings) if (b.owner === p.id && b.built && !b.dead) cap += b.def.pop;
  p.popCap = Math.min(cap, POP_MAX);
}

// ----- garrison ----------------------------------------------------------------------------------
function garrisonUnit(u, b) {
  releaseTarget(u);
  u.garrisoned = b; b.garrison.push(u);
  setState(u, 'idle');
  const si = G.sel.indexOf(u); if (si >= 0) G.sel.splice(si, 1);
  if (u.carry.amount > 0) { G.players[u.owner].res[u.carry.type] += Math.floor(u.carry.amount); u.carry.amount = 0; }
}
function ungarrisonUnit(u, b, forced) {
  const i = b.garrison.indexOf(u); if (i >= 0) b.garrison.splice(i, 1);
  u.garrisoned = null;
  const spot = findSpawnSpot(b, u);
  u.x = spot[0]; u.y = spot[1];
  u.homeX = u.x; u.homeY = u.y;
  if (b.rally && !forced) rallyUnit(u, b);
}
function ungarrisonAll(b) { for (const u of b.garrison.slice()) ungarrisonUnit(u, b, false); }

// ----- spawn position / rally ----------------------------------------------------------------------
function findSpawnSpot(b, u) {
  const m = G.map;
  const tx = b.rally ? b.rally.x : b.x + b.size / 2, ty = b.rally ? b.rally.y : b.y + b.size + 3;
  let best = null, bd = 1e9;
  const x0 = b.x - 1, y0 = b.y - 1, x1 = b.x + b.size, y1 = b.y + b.size;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (x > x0 && x < x1 && y > y0 && y < y1) continue;
    if (!m.passable(x, y, b.owner)) continue;
    const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty) + Math.random() * 0.6;
    if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; }
  }
  if (!best) best = m.findFreeNear(b.x + b.size / 2, b.y + b.size + 1, 10, b.owner, true) || [b.x + b.size / 2, b.y + b.size + 1];
  return [best[0] + (Math.random() - 0.5) * 0.3, best[1] + (Math.random() - 0.5) * 0.3];
}
function rallyUnit(u, b) {
  const r = b.rally;
  if (!r) return;
  if (r.target && !r.target.dead) {
    const t = r.target;
    if (t.kind === 'res' && u.def.tags.includes('villager')) return orderGather(u, t);
    if (t.kind === 'building' && t.type === 'farm' && u.def.tags.includes('villager')) return orderGather(u, t);
    if (t.kind === 'building' && t.owner === u.owner && !t.built && u.def.tags.includes('villager')) return orderBuild(u, t);
    if (t.kind === 'building' && t.owner === u.owner && canGarrison(u, t)) return orderGarrison(u, t);
  }
  orderMove(u, r.x + (Math.random() - 0.5) * 1.2, r.y + (Math.random() - 0.5) * 1.2);
}

// ----- resource search --------------------------------------------------------------------------------
function findDropsite(u, key) {
  let best = null, bd = 1e9;
  for (const b of G.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built || !b.def.drop || !b.def.drop.includes(key)) continue;
    const d = distEnt(u.x, u.y, b);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function findNearestRes(u, type, x, y, maxD, exclude) {
  // type is a resource entity type (tree, gold, ...) ; for food: berries/farm/deer family
  let best = null, bd = maxD;
  const lst = G.resources;
  for (let i = 0; i < lst.length; i++) {
    const r = lst[i];
    if (r.dead || r.amount <= 0 || r === exclude) continue;
    if (u && u.bad && u.bad[r.id] > G.time) continue;
    if (type === 'hunt') { if (!r.animal || r.type === 'boar') continue; }
    else if (r.type !== type) continue;
    const d = Math.hypot(r.x - x, r.y - y);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
function findNearestFarm(u, x, y, maxD) {
  let best = null, bd = maxD;
  for (const b of G.buildings) {
    if (b.dead || b.type !== 'farm' || b.owner !== u.owner || !b.built) continue;
    if (b.farmers.length >= 5 && b.farmers.indexOf(u) < 0) continue;
    if (u.bad && u.bad[b.id] > G.time) continue;
    const d = Math.hypot(b.x + 1.5 - x, b.y + 1.5 - y) + b.farmers.length * 0.8;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function findNewResource(u) {
  const t = u.target;
  const type = u.lastResType, x = u.lastResX, y = u.lastResY;
  let nr = null;
  if (type === 'farm') nr = findNearestFarm(u, x, y, 12);
  else if (type === 'berries') { nr = findNearestRes(u, 'berries', x, y, 14, t) || findNearestFarm(u, x, y, 12); }
  else if (type === 'deer' || type === 'carcass' || type === 'boar') nr = findNearestRes(u, 'hunt', x, y, 14, t);
  else nr = findNearestRes(u, type, x, y, type === 'tree' ? 12 : 16, t);
  if (nr) { orderGather(u, nr); return true; }
  if (u.carry.amount > 0) { u.target = null; u.gs = 'toDrop'; u.dropTarget = null; prepDrop(u); return true; }
  if (u.owner === G.me && !G.observer) notify(u.owner, `No more ${type === 'tree' ? 'trees' : type} nearby for gatherers.`, x, y, 'warn');
  goIdle(u);
  return false;
}
function prepDrop(u) {
  const key = u.carry.type;
  const d = findDropsite(u, key);
  if (!d) {
    if (u.owner === G.me && !G.observer && (!u.noDropWarn || G.time - u.noDropWarn > 20)) { u.noDropWarn = G.time; notify(u.owner, `Build a drop-off point for ${key}.`, u.x, u.y, 'warn'); }
    u.gs = 'nodrop'; return;
  }
  u.dropTarget = d; u.gs = 'toDrop';
  requestPath(u, entRect(d), 1.0, false);
}

// ----- conversion ------------------------------------------------------------------------------------------
function convertUnit(t, newOwner) {
  const old = G.players[t.owner], nw = G.players[newOwner];
  old.pop -= t.def.pop; nw.pop += t.def.pop;
  old.stat.losses++; nw.stat.converted++;
  if (old.ai) old.ai.onLost(t);
  releaseTarget(t);
  t.owner = newOwner;
  if (t.carry.amount) t.carry.amount = 0;
  t.queue.length = 0;
  setState(t, 'idle');
  t.resume = null;
  syncUnitStats(t);
  const si = G.sel.indexOf(t); if (si >= 0) G.sel.splice(si, 1);
  fxRing(t.x, t.y, '#f0e080', 1.6);
  fxPart('spark', t.x, t.y, 10, { col: '#fff0a0', life: 0.8, up: 36 });
  if (typeof SFX !== 'undefined') SFX.at(t.x, t.y, 'convert');
  if (old.id === G.me) notify(old.id, 'One of your units was converted!', t.x, t.y, 'attack');
}
const CONV_RESIST = { villager: 0.95, infantry: 0.8, archer: 0.85, cavalry: 0.6, siege: 0.9, monk: 0.5, uu: 0.7 };
function convChance(t) {
  let r = 0.85;
  for (const k in CONV_RESIST) if (t.def.tags.includes(k)) r = Math.min(r === 0.85 ? 1 : r, CONV_RESIST[k]);
  if (t.def.tags.includes('cavalry') || t.def.tags.includes('knight')) r = 0.55;
  return r;
}

// ----- main per-unit update -------------------------------------------------------------------------------------
function farOK(u, t, r) { return distEnt(u.x, u.y, t) <= r; }

function updateUnit(u, dt) {
  if (u.dead || u.garrisoned) return;
  const st = u.stats, p = G.players[u.owner];
  if (u.cd > 0) u.cd -= dt;
  if (u.flash > 0) u.flash -= dt;
  if (u.swing >= 0) {
    u.swing += dt;
    if (u.hitT >= 0 && u.swing >= u.hitT) { u.hitT = -1; resolveHit(u); }
    if (u.swing >= u.swingDur) u.swing = -1;
  }
  u.moving = false; u.act = 'idle';
  const prevX = u.x, prevY = u.y;

  switch (u.state) {
    case 'idle': idleBehavior(u, dt); break;

    case 'move': {
      const r = moveAlong(u, dt);
      if (r === 'done' || (r === 'blocked' && u.stuckT > 1.2)) {
        if (u.partial && r === 'done') { /* closest we could get */ }
        goIdle(u);
      } else if (r === 'blocked') { u.stuckT += dt; if (u.stuckT > 0.5 && u.dest) { requestPath(u, [u.dest.x, u.dest.y, u.dest.x, u.dest.y], 0.75, true); } }
      break;
    }

    case 'amove': {
      u.scanT -= dt;
      if (u.scanT <= 0 && isCombatant(u)) {
        u.scanT = 0.35 + Math.random() * 0.15;
        const t = findTarget(u, scanRange(u) + 1);
        if (t) { const d = u.dest; setState(u, 'attack'); u.target = t; u.resume = { x: d.x, y: d.y, amove: true }; attackChase(u); break; }
      }
      const r = moveAlong(u, dt);
      if (r === 'done') goIdle(u);
      else if (r === 'blocked') { u.stuckT += dt; if (u.stuckT > 1.5) goIdle(u); }
      break;
    }

    case 'attack': updateAttack(u, dt); break;
    case 'gather': updateGather(u, dt); break;
    case 'build': case 'repair': updateBuild(u, dt); break;

    case 'garrison': {
      const b = u.target;
      if (!b || b.dead || !canGarrison(u, b)) { goIdle(u); break; }
      if (farOK(u, b, 1.2)) { garrisonUnit(u, b); break; }
      const r = moveAlong(u, dt);
      if (r === 'done') { if (!farOK(u, b, 1.4)) { u.pathFail++; if (u.pathFail > 2) goIdle(u); else orderGarrison(u, b); } }
      break;
    }

    case 'heal': updateHeal(u, dt); break;
    case 'chop': updateChop(u, dt); break;
    case 'convert': updateConvert(u, dt); break;
  }

  // animation state
  if (u.moving) u.phase += dt * (3 + moveSpeed(u) * 5.5);
  else if (u.state === 'idle' || u.act === 'idle') { /* idle */ }
  if (u.swing >= 0) { u.act = u.def.id === 'monk' ? 'cast' : 'attack'; u.actP = u.swing / u.swingDur; }
  // stuck detection while pathing
  if (u.moving && (u.state === 'move' || u.state === 'amove' || u.state === 'attack' || u.state === 'gather' || u.state === 'build' || u.state === 'chop')) {
    u.stuckAcc = (u.stuckAcc || 0) + dt;
    if (u.stuckAcc > 0.8) {
      const moved = Math.hypot(u.x - u.lastX, u.y - u.lastY);
      if (moved < moveSpeed(u) * 0.8 * 0.25) {
        u.stuckT += 0.8;
        if (u.stuckT > 1.6 && u.goal) {
          if (u.state === 'move' || u.state === 'amove') {
            if (u.stuckT > 3.2) goIdle(u); else requestPath(u, [u.goal.x0, u.goal.y0, u.goal.x1, u.goal.y1], u.goal.r, u.goal.exact);
          } else requestPath(u, [u.goal.x0, u.goal.y0, u.goal.x1, u.goal.y1], u.goal.r, u.goal.exact);
        }
      } else u.stuckT = Math.max(0, u.stuckT - 0.8);
      u.stuckAcc = 0; u.lastX = u.x; u.lastY = u.y;
    }
  }
}

function idleBehavior(u, dt) {
  const st = u.stats, tags = u.def.tags;
  if (tags.includes('monk')) {
    u.healT -= dt;
    if (u.healT <= 0) {
      u.healT = 0.8;
      // find injured friend
      nearUnits(u.x, u.y, 6, _near);
      let best = null, bd = 1e9;
      for (const o of _near) { if (o.owner !== u.owner || o.dead || o === u || o.hp >= o.maxHp || o.def.tags.includes('siege')) continue; const d = Math.hypot(o.x - u.x, o.y - u.y); if (d < bd) { bd = d; best = o; } }
      if (best) { const hx = u.homeX, hy = u.homeY; orderHeal(u, best); u.homeX = hx; u.homeY = hy; }
    }
    return;
  }
  if (tags.includes('villager') || !isCombatant(u)) return;
  u.scanT -= dt;
  if (u.scanT > 0) return;
  u.scanT = 0.45 + Math.random() * 0.2;
  const t = findTarget(u, scanRange(u));
  if (t) {
    const hx = u.homeX, hy = u.homeY;
    setState(u, 'attack'); u.target = t; u.resume = { x: hx, y: hy, ret: true };
    attackChase(u);
  } else if (u.stance !== 'stand') {
    // drift back home if pushed far
    if (Math.hypot(u.x - u.homeX, u.y - u.homeY) > 5 && u.homeX) { u.resume = null; orderMove(u, u.homeX, u.homeY); }
  }
}

function updateAttack(u, dt) {
  const t = u.target, st = u.stats;
  if (!t || t.dead || (t.kind === 'res' && !t.alive) || t.garrisoned || (t.kind !== 'res' && !isEnemy(u.owner, t.owner))) {
    // target gone
    const rs = u.resume; u.resume = null; u.target = null;
    if (rs && rs.amove && u.state === 'attack') { orderAMove(u, rs.x, rs.y); return; }
    // look for another nearby target when aggressive
    if (u.stance !== 'stand' && isCombatant(u) && !u.def.tags.includes('villager')) {
      const nt = findTarget(u, scanRange(u));
      if (nt) { setState(u, 'attack'); u.target = nt; u.resume = rs; attackChase(u); return; }
    }
    if (rs && rs.ret && Math.hypot(u.x - rs.x, u.y - rs.y) > 2.5) { orderMove(u, rs.x, rs.y); return; }
    goIdle(u); return;
  }
  const reach = attackReach(u, t);
  const d = distEnt(u.x, u.y, t);
  const ranged = st.range > 1.5;
  if (d <= reach + 0.05) {
    // in range: attack
    u.path = null; u.pathPending = false;
    setFacing(u, ecx(t) - u.x, ecy(t) - u.y);
    if (u.cd <= 0 && u.swing < 0) {
      if (u.def.buildingsOnly && t.kind !== 'building') { u.target = null; return; }
      u.swingDur = Math.min(0.9, st.reload * 0.85);
      u.swing = 0; u.hitT = u.swingDur * (ranged ? 0.62 : 0.5); u.hitTarget = t;
      u.cd = st.reload;
    }
  } else {
    // chase
    u.chaseT -= dt;
    const moved = Math.hypot(ecx(t) - (u.chaseX || 0), ecy(t) - (u.chaseY || 0));
    if ((u.chaseT <= 0 && moved > 1.0) || (!u.path && !u.pathPending) || u.chaseT < -1.5) {
      if (u.stance === 'stand') { goIdle(u); return; }
      attackChase(u);
    }
    const r = moveAlong(u, dt);
    if (r === 'done' || r === 'blocked') {
      if (distEnt(u.x, u.y, t) > reach + 0.4) {
        u.pathFail++;
        if (u.pathFail > 5) { u.pathFail = 0; const rs = u.resume; if (rs && rs.amove) orderAMove(u, rs.x, rs.y); else goIdle(u); }
        else u.chaseT = 0.3 + u.pathFail * 0.2;
      }
    }
  }
}

function resolveHit(u) {
  const t = u.hitTarget;
  u.hitTarget = null;
  if (!t || t.dead || (t.kind === 'res' && !t.alive)) return;
  const st = u.stats;
  if (u.def.id === 'villager' && t.animal) { hurt(t, 3, u); return; }
  if (st.range > 1.5) {
    // projectile
    const speed = u.def.proj === 'rock' || u.def.proj === 'bigrock' ? 7 : u.def.proj === 'javelin' || u.def.proj === 'axe' ? 11 : 14;
    G.projectiles.push({
      kind: u.def.proj, x: u.x, y: u.y, sx: u.x, sy: u.y, tx: ecx(t), ty: ecy(t), target: t, att: u, owner: u.owner, aStats: st,
      speed, dist: Math.hypot(ecx(t) - u.x, ecy(t) - u.y), t: 0, splash: u.def.splash || 0, homing: !(u.def.proj === 'rock' || u.def.proj === 'bigrock'),
      arc: u.def.proj === 'rock' || u.def.proj === 'bigrock' ? 1.0 : 0.25, big: u.def.proj === 'bigrock',
    });
    if (typeof SFX !== 'undefined') SFX.at(u.x, u.y, u.def.proj === 'rock' || u.def.proj === 'bigrock' ? 'catapult' : 'bow');
  } else {
    if (t.kind === 'building' && u.def.tags.includes('ram')) { fxPart('dust', ecx(t), ecy(t), 2, { col: 'rgba(150,130,100,0.8)', life: 0.8, up: 18, size: 4 }); fxPart('chip', ecx(t), ecy(t), 3, { col: '#7a5a3a', life: 0.6, up: 30 }); }
    const dmg = calcDamage(u, t, st);
    fxPart('spark', t.kind === 'building' ? ecx(t) : t.x, t.kind === 'building' ? ecy(t) : t.y, 2, { col: '#ffe9a0', life: 0.25, up: 16, size: 1.6 });
    if (typeof SFX !== 'undefined') SFX.at(u.x, u.y, t.kind === 'building' ? (u.def.tags.includes('ram') ? 'ram' : 'hit') : 'sword');
    hurt(t, dmg, u);
  }
}

function projectileImpact(pr) {
  const t = pr.target;
  const ix = pr.homing && t && !t.dead ? ecx(t) : pr.tx, iy = pr.homing && t && !t.dead ? ecy(t) : pr.ty;
  const att = pr.att && !pr.att.dead ? pr.att : { kind: 'proj', owner: pr.owner };
  if (pr.splash > 0) {
    nearUnits(ix, iy, pr.splash + 1, _near);
    const list = _near.slice();
    for (const o of list) {
      if (o.dead) continue;
      const d = Math.hypot(o.x - ix, o.y - iy);
      if (d > pr.splash) continue;
      if (!isEnemy(pr.owner, o.owner) && o.owner !== pr.owner) continue;
      const dmg = calcDamage(att, o, pr.aStats) * (o.owner === pr.owner ? 0.5 : 1) * (1 - 0.5 * d / pr.splash);
      hurt(o, Math.max(1, dmg), att);
    }
    for (const b of G.buildings) {
      if (b.dead || !isEnemy(pr.owner, b.owner)) continue;
      if (distToRect(ix, iy, b.x, b.y, b.x + b.size, b.y + b.size) <= 0.6) hurt(b, calcDamage(att, b, pr.aStats), att);
    }
    fxRing(ix, iy, '#f0c070', pr.splash);
    fxPart('dust', ix, iy, 6, { col: 'rgba(170,150,120,0.8)', life: 0.9, up: 22, size: 4 });
    fxPart('chip', ix, iy, 5, { col: '#6a5a4a', life: 0.7, up: 36 });
    if (typeof SFX !== 'undefined') SFX.at(ix, iy, 'boom');
  } else if (t && !t.dead && !(t.kind === 'res' && !t.alive)) {
    if (!isEnemy(pr.owner, t.owner) && t.kind !== 'res') return;
    // arrows may miss moving targets
    if (t.kind === 'unit' && t.moving && pr.kind === 'arrow' && Math.random() < 0.12) {
      fxPart('dust', ix, iy, 1, { col: 'rgba(200,190,150,0.7)', life: 0.4, up: 6, size: 2 });
      return;
    }
    const dmg = calcDamage(att, t, pr.aStats);
    fxPart('spark', ix, iy, 1, { col: '#ffe9a0', life: 0.2, up: 10, size: 1.4 });
    hurt(t, dmg, att);
  }
}

// ----- gathering -----------------------------------------------------------------------------------------------------
function validRes(t) {
  if (!t || t.dead) return false;
  if (t.kind === 'building') return t.type === 'farm' && t.built && !t.dead;
  if (t.animal) return t.amount > 0 && (t.alive || t.type !== 'x');
  return t.amount > 0;
}
function updateGather(u, dt) {
  const p = G.players[u.owner];
  const cap = CARRY_BASE + p.carryBonus;
  if (u.gs === 'toRes' || u.gs === 'work') {
    const t = u.target;
    if (!validRes(t)) { findNewResource(u); return; }
    if (t.kind === 'building' && t.type === 'farm') {
      // reseeding: wait if farm has no food
      if (t.food <= 0) { if (!u.spot) assignFarmSpot(u, t); }
    }
  }
  if (u.gs === 'toRes') {
    const t = u.target;
    let near;
    if (t.kind === 'building') near = Math.hypot(u.x - u.spot.x, u.y - u.spot.y) < 0.5 || distEnt(u.x, u.y, t) < 0.01 && Math.hypot(u.x - u.spot.x, u.y - u.spot.y) < 1.2;
    else if (t.animal) near = Math.hypot(u.x - t.x, u.y - t.y) < 1.2;
    else near = distEnt(u.x, u.y, t) <= 1.12;
    if (near) { u.gs = 'work'; u.path = null; u.workT = 0; u.pathFail = 0; return; }
    if (t.animal && t.alive && u.path === null && !u.pathPending) gatherPath(u);
    const r = moveAlong(u, dt);
    if (t.animal && u.chaseT === undefined) u.chaseT = 0;
    if (t.animal) { u.chaseT -= dt; if (u.chaseT <= 0) { u.chaseT = 0.8; gatherPath(u); } }
    if (r === 'done' || r === 'blocked') {
      u.pathFail++;
      if (u.partial || u.pathFail > 3) {
        // cannot reach this one; remember that and try another
        u.pathFail = 0;
        (u.bad || (u.bad = {}))[t.id] = G.time + 45;
        const alt = t.kind === 'building' ? findNearestFarm(u, u.x, u.y, 12) : findNearestRes(u, t.type === 'carcass' ? 'hunt' : t.type, u.x, u.y, 12, t);
        if (alt && alt !== t) orderGather(u, alt); else goIdle(u);
      } else gatherPath(u);
    }
    return;
  }
  if (u.gs === 'work') {
    const t = u.target;
    const key = resEconKey(t);
    if (u.carry.type !== key) { u.carry.type = key; u.carry.amount = 0; }
    u.act = 'gather'; u.tool = TOOL_FOR[u.gkey]; u.workT += dt; u.actP = (u.workT * (u.gkey === 'farm' ? 0.9 : 1.3)) % 1;
    const face = t.kind === 'building' ? [ecx(t) - u.x, ecy(t) - u.y] : [t.x - u.x, t.y - u.y];
    if (Math.abs(face[0]) + Math.abs(face[1]) > 0.1) setFacing(u, face[0], face[1]);
    if (t.animal && t.alive) {
      if (t.type === 'deer') { if (u.workT > 0.7) { t.alive = false; t.hp = 0; t.state = 'dead'; fxPart('blood', t.x, t.y, 3, { col: '#a02020', life: 0.4, up: 12 }); u.workT = 0; } return; }
      // boar: fight
      if (u.workT > 0.1) { setState(u, 'attack'); u.target = t; attackChase(u); }
      return;
    }
    let rate = gatherRate(p, u.gkey);
    if (t.kind === 'building') { if (t.food <= 0) { u.act = 'idle'; return; } }
    const amt = rate * dt;
    if (t.kind === 'building') { const take = Math.min(amt, t.food); t.food -= take; u.carry.amount += take; }
    else { const take = Math.min(amt, t.amount); t.amount -= take; u.carry.amount += take; if (t.amount <= 0.001) { t.amount = 0; } }
    // effects
    u.fxT = (u.fxT || 0) + dt;
    if (u.fxT > 0.45) {
      u.fxT = 0;
      if (u.gkey === 'wood') fxPart('chip', t.x, t.y, 1, { col: '#b08a54', life: 0.5, up: 22, size: 2 });
      else if (u.gkey === 'gold' || u.gkey === 'stone') { fxPart('spark', t.x, t.y, 2, { col: u.gkey === 'gold' ? '#ffe070' : '#d0d0d8', life: 0.35, up: 20, size: 1.6 }); }
      if (u.gkey === 'wood' || u.gkey === 'gold' || u.gkey === 'stone') if (typeof SFX !== 'undefined') SFX.at(u.x, u.y, u.gkey === 'wood' ? 'chop' : 'mine');
    }
    if (u.carry.amount >= cap || t.amount <= 0 && t.kind !== 'building') {
      if (u.carry.amount >= 1) { prepDrop(u); }
      else findNewResource(u);
      if (t.kind === 'res' && t.amount <= 0 && !t.animal) removeResource(t);
      else if (t.animal && t.amount <= 0) { t.dead = true; }
    }
    return;
  }
  if (u.gs === 'toDrop') {
    const d = u.dropTarget;
    if (!d || d.dead || !d.built) { prepDrop(u); return; }
    if (farOK(u, d, 1.25)) { depositCarry(u, p); resumeGather(u); return; }
    const r = moveAlong(u, dt);
    if (r === 'done' || r === 'blocked') {
      if (!farOK(u, d, 1.5)) { u.pathFail++; if (u.pathFail > 3) { u.pathFail = 0; prepDrop(u); } else requestPath(u, entRect(d), 1.0, false); }
    }
    return;
  }
  if (u.gs === 'nodrop') {
    // wait for a drop-off to appear
    u.retarget -= dt;
    if (u.retarget <= 0) { u.retarget = 1.5; const d = findDropsite(u, u.carry.type); if (d) { u.dropTarget = d; u.gs = 'toDrop'; requestPath(u, entRect(d), 1.0, false); } }
  }
}
function depositCarry(u, p) {
  const n = Math.floor(u.carry.amount);
  if (n > 0 && u.carry.type) {
    p.res[u.carry.type] += n; p.stat.gathered[u.carry.type] += n;
    if (u.owner === G.me && tileVisible(u.x, u.y)) {
      const col = { food: '#f08a6a', wood: '#d9b27a', gold: '#ffe070', stone: '#d0d0d8' }[u.carry.type];
      fxText(u.x, u.y, '+' + n, col, 1.0);
    }
    if (u.owner === G.me && typeof SFX !== 'undefined') SFX.at(u.x, u.y, 'coin');
  }
  u.carry.amount -= n;
  if (u.carry.amount < 1) u.carry.amount = 0;
}
function resumeGather(u) {
  const t = u.target;
  if (validRes(t) && !(t.kind === 'building' && t.farmers.length > 5)) { u.gs = 'toRes'; u.pathFail = 0; gatherPath(u); }
  else findNewResource(u);
}

// ----- building / repairing ---------------------------------------------------------------------------------------------
function updateBuild(u, dt) {
  const b = u.target;
  if (!b || b.dead) { goIdle(u); return; }
  if (u.state === 'build' && b.built) { finishBuilding(u, b); return; }
  if (u.state === 'repair' && b.hp >= b.maxHp) { goIdle(u); return; }
  if (farOK(u, b, 1.15)) {
    u.path = null;
    u.act = 'build'; u.tool = 'hammer'; u.workT += dt; u.actP = (u.workT * 1.3) % 1;
    setFacing(u, ecx(b) - u.x, ecy(b) - u.y);
    if (u.state === 'build') { b.workers = (b.workers || 0) + 1; b.lastWorked = G.time; } else b.repairers = (b.repairers || 0) + 1;
    u.fxT = (u.fxT || 0) + dt;
    if (u.fxT > 0.6) { u.fxT = 0; fxPart('chip', u.x + (ecx(b) - u.x) * 0.5, u.y + (ecy(b) - u.y) * 0.5, 1, { col: '#c9a26a', life: 0.4, up: 16, size: 1.8 }); if (typeof SFX !== 'undefined') SFX.at(u.x, u.y, 'hammer'); }
    return;
  }
  const r = moveAlong(u, dt);
  if (r === 'done' || r === 'blocked') {
    if (!farOK(u, b, 1.4)) { u.pathFail++; if (u.pathFail > 3) goIdle(u); else requestPath(u, entRect(b), 1.0, false); }
  }
}
function finishBuilding(u, b) {
  // continue queue or auto-gather near new building
  if (u.queue.length) return goIdle(u);
  const t = b.type;
  let res = null;
  const cx = ecx(b), cy = ecy(b);
  if (t === 'farm') res = b.farmers.length < 5 ? b : null;
  else if (t === 'mill' || t === 'towncenter') res = findNearestRes(u, 'berries', cx, cy, 9) || findNearestFarm(u, cx, cy, 8);
  else if (t === 'lumber') res = findNearestRes(u, 'tree', cx, cy, 8);
  else if (t === 'mining') res = findNearestRes(u, 'gold', cx, cy, 8) || findNearestRes(u, 'stone', cx, cy, 8);
  if (res) { orderGather(u, res); return; }
  // otherwise help build another unfinished building nearby
  for (const o of G.buildings) {
    if (o.owner === u.owner && !o.built && !o.dead && Math.hypot(ecx(o) - cx, ecy(o) - cy) < 8) { orderBuild(u, o); return; }
  }
  goIdle(u);
}

// ----- monks --------------------------------------------------------------------------------------------------------------------
function updateHeal(u, dt) {
  const t = u.target;
  if (!t || t.dead || t.owner !== u.owner || t.hp >= t.maxHp) { goIdle(u); return; }
  const d = Math.hypot(t.x - u.x, t.y - u.y);
  if (d <= 3.2) {
    u.path = null; u.act = 'heal'; u.workT += dt; u.actP = (u.workT * 0.8) % 1;
    setFacing(u, t.x - u.x, t.y - u.y);
    t.hp = Math.min(t.maxHp, t.hp + 3.5 * dt);
    u.fxT = (u.fxT || 0) + dt;
    if (u.fxT > 0.5) { u.fxT = 0; fxPart('heal', t.x, t.y, 2, { col: '#9cf5a8', life: 0.8, up: 20, size: 1.8 }); }
  } else {
    if (!u.path && !u.pathPending) requestPath(u, entRect(t), 2.5, false);
    const r = moveAlong(u, dt);
    if (r === 'done' || r === 'blocked') { u.pathFail++; if (u.pathFail > 4) goIdle(u); else requestPath(u, entRect(t), 2.5, false); }
  }
}
function updateConvert(u, dt) {
  const t = u.target;
  if (!t || t.dead || t.kind !== 'unit' || !isEnemy(u.owner, t.owner) || t.garrisoned) { goIdle(u); return; }
  const rng = u.stats.range;
  const d = Math.hypot(t.x - u.x, t.y - u.y);
  if (d <= rng) {
    u.path = null;
    if (u.cd > 0) { u.act = 'idle'; return; }
    setFacing(u, t.x - u.x, t.y - u.y);
    u.act = 'cast'; u.convT += dt; u.actP = (u.convT * 0.6) % 1;
    u.swing = -1;
    u.fxT = (u.fxT || 0) + dt;
    if (u.fxT > 0.4) { u.fxT = 0; fxPart('conv', t.x, t.y, 1, { col: '#ffe890', life: 0.9, up: 34, size: 2 }); fxPart('conv', u.x, u.y, 1, { col: '#fff4c0', life: 0.9, up: 28, size: 1.6 }); }
    const need = 3.5 + d * 0.35;
    if (u.convT >= need) {
      u.convT = 0;
      if (Math.random() < convChance(t)) { u.cd = 12; convertUnit(t, u.owner); goIdle(u); }
      else { u.cd = 3; fxText(t.x, t.y, 'Resisted', '#ddd', 1); }
    }
  } else {
    u.convT = 0;
    if (!u.path && !u.pathPending) requestPath(u, entRect(t), Math.max(2, rng - 1), false);
    u.chaseT = (u.chaseT || 0) - dt;
    if (u.chaseT <= 0) { u.chaseT = 0.8; requestPath(u, entRect(t), Math.max(2, rng - 1), false); }
    const r = moveAlong(u, dt);
    if (r === 'blocked') { u.pathFail++; if (u.pathFail > 8) goIdle(u); }
  }
}

// ----- separation (soft collisions) ---------------------------------------------------------------------------------------------------------
function separateUnits(dt) {
  const m = G.map;
  for (const u of G.units) {
    if (u.dead || u.garrisoned) continue;
    const r0 = u.def.radius;
    nearUnits(u.x, u.y, 1.2, _near);
    let px = 0, py = 0;
    const busy = u.state === 'gather' && u.gs === 'work' || u.state === 'build' && u.act === 'build' || u.state === 'attack' && !u.moving || u.act === 'cast' || u.act === 'heal';
    for (let i = 0; i < _near.length; i++) {
      const o = _near[i];
      if (o === u) continue;
      const dx = u.x - o.x, dy = u.y - o.y, d2 = dx * dx + dy * dy;
      const md = (r0 + o.def.radius) * 0.9;
      if (d2 >= md * md) continue;
      const d = Math.sqrt(d2) || 0.01;
      const push = (md - d) * 0.5;
      let share = 1;
      const oBusy = o.state === 'gather' && o.gs === 'work' || o.state === 'build' && o.act === 'build' || o.state === 'attack' && !o.moving;
      if (busy && !oBusy) share = 0.25; else if (!busy && oBusy) share = 1.2;
      if (d < 0.01) { px += (Math.random() - 0.5) * 0.02; py += (Math.random() - 0.5) * 0.02; }
      else { px += dx / d * push * share; py += dy / d * push * share; }
    }
    if (px || py) {
      const lim = 2.2 * dt;
      const l = Math.hypot(px, py);
      if (l > lim) { px *= lim / l; py *= lim / l; }
      const nx = u.x + px, ny = u.y + py;
      if (m.passableAt(nx, ny, u.owner)) { u.x = nx; u.y = ny; }
      else if (m.passableAt(nx, u.y, u.owner)) u.x = nx;
      else if (m.passableAt(u.x, ny, u.owner)) u.y = ny;
    }
  }
}

// ----- animals ------------------------------------------------------------------------------------------------------------------------------------
function updateAnimals(dt) {
  for (const r of G.resources) {
    if (!r.animal || r.dead) continue;
    if (r.flash > 0) r.flash -= dt;
    if (!r.alive) continue;
    r.moving = false;
    if (r.type === 'boar' && r.target) {
      const t = r.target;
      if (t.dead || t.garrisoned || Math.hypot(t.x - r.x, t.y - r.y) > 12) { r.target = null; }
      else {
        const d = Math.hypot(t.x - r.x, t.y - r.y);
        r.cd -= dt;
        if (d > 0.8) {
          const sp = r.speed * dt, nx = r.x + (t.x - r.x) / d * sp, ny = r.y + (t.y - r.y) / d * sp;
          if (G.map.passableAt(nx, ny, -1)) { r.x = nx; r.y = ny; r.moving = true; r.phase += dt * 10; setFacing(r, t.x - r.x, t.y - r.y); }
        } else if (r.cd <= 0) { r.cd = 1.8; hurt(t, Math.max(1, ANIMALS.boar.atk - t.stats.armM), r); fxPart('blood', t.x, t.y, 2, { col: '#a02020', life: 0.4, up: 12 }); }
        continue;
      }
    }
    r.wanderT -= dt;
    if (r.wanderT <= 0 && !r.dest) {
      r.wanderT = 5 + Math.random() * 9;
      const a = Math.random() * TAU, d = 1 + Math.random() * 3;
      const nx = r.homeX + Math.cos(a) * d, ny = r.homeY + Math.sin(a) * d;
      if (G.map.passableAt(nx, ny, -1)) r.dest = { x: nx, y: ny };
    }
    if (r.dest) {
      const dx = r.dest.x - r.x, dy = r.dest.y - r.y, d = Math.hypot(dx, dy);
      if (d < 0.1) r.dest = null;
      else {
        const sp = r.speed * 0.35 * dt, nx = r.x + dx / d * sp, ny = r.y + dy / d * sp;
        if (G.map.passableAt(nx, ny, -1)) { r.x = nx; r.y = ny; r.moving = true; r.phase += dt * 4; setFacing(r, dx, dy); } else r.dest = null;
      }
    }
  }
}

function pushUnitsOutOf(b) {
  for (const u of G.units) {
    if (u.dead || u.garrisoned) continue;
    if (u.x >= b.x - 0.2 && u.x <= b.x + b.size + 0.2 && u.y >= b.y - 0.2 && u.y <= b.y + b.size + 0.2) {
      if (!b.def.solid) continue;
      const s = findSpawnSpot(b, u);
      u.x = s[0]; u.y = s[1];
      if (u.path) { u.path = null; if (u.goal) requestPath(u, [u.goal.x0, u.goal.y0, u.goal.x1, u.goal.y1], u.goal.r, u.goal.exact); }
    }
  }
}

// ----- town bell: garrison every villager into the nearest safe building ------------------------------------
function ringTownBell(owner) {
  const refuges = G.buildings.filter((b) => b.owner === owner && b.built && !b.dead && (b.type === 'towncenter' || b.type === 'castle'));
  if (!refuges.length) return 0;
  const vills = G.units.filter((v) => v.owner === owner && !v.dead && !v.garrisoned && v.def.tags.includes('villager'));
  let n = 0;
  const cap = new Map(refuges.map((b) => [b, b.def.garrison - b.garrison.length]));
  for (const v of vills) {
    let best = null, bd = 1e9;
    for (const b of refuges) { if (cap.get(b) <= 0) continue; const d = Math.hypot(ecx(b) - v.x, ecy(b) - v.y); if (d < bd) { bd = d; best = b; } }
    if (!best) break;
    cap.set(best, cap.get(best) - 1);
    v.queue.length = 0; orderGarrison(v, best); n++;
  }
  return n;
}
