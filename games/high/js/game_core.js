'use strict';
// ---------------------------------------------------------------------------
// Game state, players, stats, entity factories, spatial hash, vision, events
// ---------------------------------------------------------------------------
const G = {
  map: null, players: [], units: [], buildings: [], resources: [], byId: new Map(), nextId: 1,
  projectiles: [], fx: [], time: 0, speed: 1.7, paused: false, over: false, winner: -1,
  me: 0, sel: [], hash: null, pathQ: [], alerts: [], opts: {}, observer: false,
  visTimer: 0, selVer: 0, groups: {}, lastAlert: {}, tickCount: 0,
};

function mkPlayer(id, civId, human, name) {
  const p = {
    id, name, civ: civId, civDef: CIVS[civId], human, color: TEAM_COLORS[id],
    res: { food: 0, wood: 0, gold: 0, stone: 0 }, age: 0, techs: new Set(), researching: new Set(),
    unitMap: {}, fx: [].concat(CIVS[civId].fx), statCache: {}, bstatCache: {}, statVer: 0,
    pop: 0, popCap: 0, alive: true, ai: null, gatherBonus: {}, carryBonus: 0, buildBonus: 0,
    market: { food: 100, wood: 100, stone: 100 },
    stat: { kills: 0, losses: 0, unitsMade: 0, bldBuilt: 0, bldLost: 0, gathered: { food: 0, wood: 0, gold: 0, stone: 0 }, converted: 0, techCount: 0 },
    counts: {}, startPos: { x: 0, y: 0 }, lostTime: 0,
  };
  return p;
}

function isEnemy(a, b) { return a >= 0 && b >= 0 && a !== b; }
function ecx(e) { return e.kind === 'building' ? e.x + e.size / 2 : e.x; }
function ecy(e) { return e.kind === 'building' ? e.y + e.size / 2 : e.y; }
function entRect(e) {
  if (e.kind === 'building') return [e.x, e.y, e.x + e.size, e.y + e.size];
  if (e.kind === 'res' && !e.animal) return [e.x - 0.5, e.y - 0.5, e.x + 0.5, e.y + 0.5];
  return [e.x, e.y, e.x, e.y];
}
function distEnt(x, y, e) {
  const r = entRect(e);
  return distToRect(x, y, r[0], r[1], r[2], r[3]);
}
function entTags(e) {
  if (e.kind === 'unit') return e.def.tags;
  if (e.kind === 'building') return e.def.tags;
  return EMPTY;
}
const EMPTY = [];

// --- Stats ---------------------------------------------------------------------
function applyFx(p, def, s, isBld) {
  const tags = def.tags;
  for (const fx of p.fx) {
    if (fx.minAge && p.age < fx.minAge) continue;
    if (fx.tags) { let m = false; for (const t of fx.tags) if (tags.includes(t)) { m = true; break; } if (!m) continue; }
    if (fx.ids && !fx.ids.includes(def.id)) continue;
    switch (fx.t) {
      case 'hp': if (fx.v) s.hp += fx.v; if (fx.m) s.hp *= fx.m; break;
      case 'armor': s.armM += fx.m || 0; s.armP += fx.p || 0; break;
      case 'atkm': if (s.range <= 1.5 && s.atkM > 0) s.atkM += fx.v; break;
      case 'atkr': if (s.range > 1.5 || isBld) s.atkP += fx.v; break;
      case 'range': if (s.range > 1.5) s.range += fx.v; break;
      case 'speed': s.speed *= fx.m; break;
      case 'los': s.los += fx.v; break;
      case 'reload': s.reload *= fx.m; break;
    }
  }
}
function unitStats(p, id) {
  let s = p.statCache[id];
  if (s) return s;
  const d = UNITS[id];
  s = { hp: d.hp, atkM: d.atkM, atkP: d.atkP, armM: d.armM, armP: d.armP, range: d.range, reload: d.reload, speed: d.speed, los: d.los, bonus: d.bonus };
  applyFx(p, d, s, false);
  s.hp = Math.round(s.hp);
  p.statCache[id] = s;
  return s;
}
function bldStats(p, id) {
  let s = p.bstatCache[id];
  if (s) return s;
  const d = BUILDINGS[id];
  s = { hp: d.hp, armM: d.armM, armP: d.armP, atkP: d.atk ? d.atk.p : 0, range: d.atk ? d.atk.range : 0, reload: d.atk ? d.atk.reload : 2, los: d.los, bonus: {} };
  applyFx(p, d, s, true);
  s.hp = Math.round(s.hp);
  p.bstatCache[id] = s;
  return s;
}
function resolveUnit(p, id) {
  let guard = 0;
  while (p.unitMap[id] && guard++ < 10) id = p.unitMap[id];
  return id;
}
function techCost(p, t) { return t.cost; }
function unitCost(p, id) {
  const base = UNITS[id].cost;
  return base;
}
function bldCost(p, id) {
  const base = BUILDINGS[id].cost, c = { food: base.food, wood: base.wood, gold: base.gold, stone: base.stone };
  for (const fx of p.fx) {
    if (fx.t === 'cost' && fx.ids.includes(id)) {
      if (fx.res) c[fx.res] = Math.round(c[fx.res] * fx.m);
      else for (const r of RES) c[r] = Math.round(c[r] * fx.m);
    }
  }
  return c;
}
function trainTimeMult(p, bid) {
  let m = 1;
  for (const fx of p.fx) if (fx.t === 'time' && fx.ids.includes(bid)) m *= fx.m;
  return m;
}
function canAfford(p, cost) { for (const r of RES) if (p.res[r] < (cost[r] || 0)) return false; return true; }
function spend(p, cost) { for (const r of RES) p.res[r] -= cost[r] || 0; }
function refund(p, cost, frac = 1) { for (const r of RES) p.res[r] += Math.floor((cost[r] || 0) * frac); }
function costStr(cost) { return RES.filter((r) => cost[r]).map((r) => cost[r] + ' ' + r[0].toUpperCase()).join(' '); }

function gatherRate(p, key) { return GATHER_BASE[key] * (1 + (p.gatherBonus[key] || 0)); }

function refreshStats(p) {
  p.statCache = {}; p.bstatCache = {}; p.statVer++;
  p.gatherBonus = {}; p.carryBonus = 0; p.buildBonus = 0;
  for (const fx of p.fx) {
    if (fx.minAge && p.age < fx.minAge) continue;
    if (fx.t === 'gather') p.gatherBonus[fx.k] = (p.gatherBonus[fx.k] || 0) + fx.v;
    else if (fx.t === 'carry') p.carryBonus += fx.v;
    else if (fx.t === 'buildspeed') p.buildBonus += fx.v;
  }
  for (const u of G.units) if (u.owner === p.id) syncUnitStats(u);
  for (const b of G.buildings) if (b.owner === p.id) syncBuildingStats(b);
}
function syncUnitStats(u) {
  const s = unitStats(G.players[u.owner], u.type);
  u.stats = s;
  if (s.hp !== u.maxHp) { const diff = s.hp - u.maxHp; u.maxHp = s.hp; if (diff > 0) u.hp += diff; u.hp = Math.min(u.hp, u.maxHp); }
}
function syncBuildingStats(b) {
  const s = bldStats(G.players[b.owner], b.type);
  b.stats = s;
  if (s.hp !== b.maxHp) { const ratio = b.hp / b.maxHp; b.maxHp = s.hp; b.hp = Math.max(1, Math.round(b.maxHp * ratio)); }
}

function applyTech(p, id) {
  const t = TECHS[id];
  p.techs.add(id); p.researching.delete(id); p.stat.techCount++;
  let ageUp = false;
  for (const e of t.effects) {
    if (e.t === 'age') { p.age = e.v; ageUp = true; }
    else if (e.t === 'upgrade') {
      p.unitMap[e.from] = e.to;
      refreshStats(p);
      for (const u of G.units) if (u.owner === p.id && u.type === e.from) convertUnitType(u, e.to);
    } else if (e.t === 'uuupgrade') {
      const uu = p.civDef.uu, el = 'elite' + uu;
      p.unitMap[uu] = el;
      for (const u of G.units) if (u.owner === p.id && u.type === uu) convertUnitType(u, el);
    } else p.fx.push(e);
  }
  refreshStats(p);
  if (ageUp) {
    // upgrade building visuals
    for (const b of G.buildings) if (b.owner === p.id) b.age = p.age;
    if ((p.human || p.id === G.me) && !G.observer) {
      notify(p.id, `You have advanced to the ${AGES[p.age]}!`, null, null, 'age');
      if (typeof SFX !== 'undefined') SFX.play('age');
      if (typeof UI !== 'undefined') UI.banner(AGES[p.age], ['', 'Your buildings grow sturdier and new units await.', 'Knights, castles and siege engines are now yours to command.', 'The pinnacle of medieval might. Crush your rival!'][p.age]);
    } else if (G.observer) notify(p.id, `${p.name} advanced to the ${AGES[p.age]}.`, null, null, 'info');
    else notify(G.me, `${p.name} has advanced to the ${AGES[p.age]}.`, null, null, 'warn');
  }
}
function convertUnitType(u, to) {
  const ratio = u.hp / u.maxHp;
  u.type = to; u.def = UNITS[to];
  syncUnitStats(u);
  u.hp = Math.max(1, Math.round(u.maxHp * ratio));
}

// --- Entity factories ---------------------------------------------------------------
function addEnt(e) {
  e.id = G.nextId++;
  G.byId.set(e.id, e);
  if (e.kind === 'unit') G.units.push(e);
  else if (e.kind === 'building') G.buildings.push(e);
  else G.resources.push(e);
  return e;
}

function spawnUnit(type, owner, x, y) {
  const def = UNITS[type];
  const p = G.players[owner];
  const st = unitStats(p, type);
  const u = addEnt({
    kind: 'unit', type, def, owner, x, y, hp: st.hp, maxHp: st.hp, stats: st,
    state: 'idle', target: null, dest: null, path: null, pi: 0, cd: 0, swing: -1, swingDur: 0, hitT: -1, hitTarget: null,
    carry: { type: null, amount: 0 }, gkey: null, resTarget: null, phase: Math.random() * 6, moving: false,
    fx: 1, back: false, stance: 'aggressive', queue: [], seed: Math.random() * 100, spot: null,
    stuckT: 0, lastX: x, lastY: y, scanT: Math.random() * 0.5, garrisoned: null, dead: false,
    workT: 0, act: 'idle', actP: 0, tool: null, pathFail: 0, lastHit: -99, flash: 0, buildTarget: null,
    convT: 0, retarget: 0, resume: null, healT: 0, homeX: x, homeY: y,
  });
  if (def.tags.includes('villager')) u.tool = null;
  p.pop += def.pop;
  return u;
}

function spawnBuilding(type, owner, tx, ty, built, builders) {
  const def = BUILDINGS[type];
  const p = G.players[owner];
  const st = bldStats(p, type);
  const b = addEnt({
    kind: 'building', type, def, owner, x: tx, y: ty, size: def.size, stats: st,
    hp: built ? st.hp : Math.max(5, Math.round(st.hp * 0.05)), maxHp: st.hp, built: !!built, progress: built ? 1 : 0,
    queue: [], rally: null, garrison: [], cd: 0, age: p.age, builders: 0, builderList: [], dead: false,
    flash: 0, seenBy: new Set([owner]), farmers: [], food: 0, maxFood: 0, lastHit: -99, atkT: 0, sprAge: p.age, gateMask: 0, bornAt: G.time,
    smokeT: Math.random(), buildRate: 0,
  });
  if (type === 'farm') { b.food = b.maxFood = 400; }
  occupyBuilding(b);
  if (built) { onBuildingComplete(b, true); }
  return b;
}

function occupyBuilding(b) {
  const m = G.map;
  for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++) {
    if (!m.inb(x, y)) continue;
    const i = y * m.w + x;
    m.occ[i] = b.id;
    if (b.def.solid) m.block[i] = 1;
    if (b.type === 'gate') m.gate[i] = b.owner + 1;
  }
}
function freeBuilding(b) {
  const m = G.map;
  for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++) {
    if (!m.inb(x, y)) continue;
    const i = y * m.w + x;
    if (m.occ[i] === b.id) { m.occ[i] = 0; m.block[i] = 0; m.gate[i] = 0; }
  }
}

function spawnResource(kind, x, y, amount) {
  // kind: tree gold stone berries deer boar
  const tx = Math.floor(x), ty = Math.floor(y);
  const r = { kind: 'res', type: kind, x: tx + 0.5, y: ty + 0.5, dead: false, variant: Math.floor(Math.random() * 12), flash: 0 };
  if (kind === 'tree') { r.rkey = 'wood'; r.amount = r.max = 100; r.blocks = true; }
  else if (kind === 'gold') { r.rkey = 'gold'; r.amount = r.max = amount || 600; r.blocks = true; }
  else if (kind === 'stone') { r.rkey = 'stone'; r.amount = r.max = amount || 400; r.blocks = true; }
  else if (kind === 'berries') { r.rkey = 'berries'; r.amount = r.max = amount || 200; r.blocks = true; }
  else { // animals
    const a = ANIMALS[kind];
    r.animal = true; r.rkey = 'hunt'; r.amount = r.max = a.food; r.hp = r.maxHp = a.hp || 8; r.alive = true; r.blocks = false;
    r.speed = a.speed; r.fx = 1; r.state = 'idle'; r.wanderT = Math.random() * 5; r.dest = null; r.phase = Math.random() * 6; r.moving = false;
    r.target = null; r.cd = 0; r.homeX = r.x; r.homeY = r.y; r.back = false;
  }
  addEnt(r);
  if (r.blocks) { const i = ty * G.map.w + tx; G.map.occ[i] = r.id; G.map.block[i] = 1; if (kind === 'tree') G.map.tree[i] = 1; }
  return r;
}

function removeResource(r) {
  if (r.dead) return;
  r.dead = true;
  if (r.blocks) {
    const m = G.map, i = Math.floor(r.y) * m.w + Math.floor(r.x);
    if (m.occ[i] === r.id) { m.occ[i] = 0; m.block[i] = 0; m.tree[i] = 0; }
  }
  if (r.type === 'tree') G.fx.push({ t: 'stump', x: r.x, y: r.y, life: 60 });
}

// --- Effects -----------------------------------------------------------------------
function fxText(x, y, text, color = '#fff', life = 1.2) { G.fx.push({ t: 'text', x, y, z: 20, text, color, life, max: life }); }
function fxPart(kind, x, y, n = 3, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = (o.speed || 1.2) * (0.4 + Math.random());
    G.fx.push({ t: 'part', kind, x, y, z: o.z || 8, vx: Math.cos(a) * s * 0.3, vy: Math.sin(a) * s * 0.3, vz: (o.up || 18) * (0.5 + Math.random()), life: o.life || 0.6, max: o.life || 0.6, col: o.col || '#8a6a3a', size: o.size || 2 });
  }
}
function fxRing(x, y, col, r = 1.2) { G.fx.push({ t: 'ring', x, y, life: 0.5, max: 0.5, col, r }); }

// --- Alerts --------------------------------------------------------------------------
function notify(player, msg, x, y, type = 'info') {
  if (player !== G.me && !G.observer) return;
  G.alerts.push({ msg, x, y, type, t: G.time });
  if (x != null) G.lastAlert.pos = { x, y, t: G.time };
}
function alertAttack(owner, x, y, what) {
  if (owner !== G.me) return;
  const key = 'atk';
  const last = G.lastAlert[key];
  if (last && G.time - last.t < 8 && dist(last.x, last.y, x, y) < 25) return;
  G.lastAlert[key] = { t: G.time, x, y };
  notify(owner, `Your ${what} is under attack!`, x, y, 'attack');
  if (typeof SFX !== 'undefined') SFX.play('alarm');
  G.fx.push({ t: 'ping', x, y, life: 4, max: 4 });
}

// --- Spatial hash for units ---------------------------------------------------------------
const HC = 4;
function buildHash() {
  const w = Math.ceil(G.map.w / HC) + 1;
  if (!G.hash || G.hash.w !== w) G.hash = { w, cells: Array.from({ length: w * w }, () => []) };
  const cells = G.hash.cells;
  for (let i = 0; i < cells.length; i++) cells[i].length = 0;
  for (const u of G.units) {
    if (u.dead || u.garrisoned) continue;
    cells[((u.y / HC) | 0) * w + ((u.x / HC) | 0)].push(u);
  }
}
function nearUnits(x, y, r, out) {
  out.length = 0;
  const h = G.hash, w = h.w;
  const x0 = Math.max(0, ((x - r) / HC) | 0), x1 = Math.min(w - 1, ((x + r) / HC) | 0);
  const y0 = Math.max(0, ((y - r) / HC) | 0), y1 = Math.min(w - 1, ((y + r) / HC) | 0);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = h.cells[cy * w + cx];
    for (let i = 0; i < c.length; i++) out.push(c[i]);
  }
  return out;
}
const _near = [];

// --- Vision --------------------------------------------------------------------------------
function updateVision() {
  const me = G.me, src = [];
  for (const u of G.units) if (u.owner === me && !u.dead && !u.garrisoned) src.push({ x: u.x, y: u.y, r: u.stats.los });
  for (const b of G.buildings) if (b.owner === me && !b.dead) src.push({ x: b.x + b.size / 2, y: b.y + b.size / 2, r: (b.built ? b.stats.los : 3) + b.size / 2 });
  G.map.updateVision(src);
  // mark seen enemy buildings
  for (const b of G.buildings) if (b.owner !== me && !b.seenBy.has(me)) {
    const i = (b.y + (b.size >> 1)) * G.map.w + b.x + (b.size >> 1);
    if (G.map.vis[i] === 2) b.seenBy.add(me);
  }
}
function tileVisible(x, y) { return G.map.vis[Math.floor(y) * G.map.w + Math.floor(x)] === 2; }
function tileExplored(x, y) { return G.map.vis[Math.floor(y) * G.map.w + Math.floor(x)] >= 1; }
function entVisible(e) {
  if (G.observer) return true;
  if (e.owner === G.me) return true;
  if (e.kind === 'building') {
    // visible if any footprint tile visible; remembered if seen and explored
    const m = G.map;
    for (let y = e.y; y < e.y + e.size; y++) for (let x = e.x; x < e.x + e.size; x++) if (m.vis[y * m.w + x] === 2) return true;
    return false;
  }
  return tileVisible(e.x, e.y);
}
