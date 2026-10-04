'use strict';
// ---- simulation: orders, movement, combat, gathering, building, production ----
const S = (...a) => { if (typeof sfx === 'function') sfx(...a); };
const P = id => G.players[id];
function note(pid, text, bad) { if (pid === 0) G.alerts.push({ text, bad: !!bad, t: G.t }); }

function distRect(x, y, x0, y0, x1, y1) { const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1); return Math.hypot(dx, dy); }
function distTo(u, t) {
  if (t.type === 'bld') return distRect(u.x, u.y, t.bx, t.by, t.bx + t.s, t.by + t.s);
  if (t.type === 'res') return distRect(u.x, u.y, t.tx, t.ty, t.tx + 1, t.ty + 1);
  return Math.max(0, Math.hypot(t.x - u.x, t.y - u.y) - .3);
}
function goalOf(t) {
  if (t.type === 'bld') return { x0: t.bx - 1, y0: t.by - 1, x1: t.bx + t.s, y1: t.by + t.s };
  if (t.type === 'res') return { x0: t.tx - 1, y0: t.ty - 1, x1: t.tx + 1, y1: t.ty + 1 };
  const a = Math.floor(t.x), b = Math.floor(t.y); return { x0: a, y0: b, x1: a, y1: b };
}
function repath(u) {
  const g = u.goal; if (!g) { u.path = null; return false; }
  u.path = findPath(u.x, u.y, g.x0, g.y0, g.x1, g.y1, g.ex, g.ey); u.pi = 0; u.mt = 0; u.mx = u.x; u.my = u.y;
  return !!u.path;
}
function goalPoint(u, x, y) {
  x = Math.max(.5, Math.min(N - .5, x)); y = Math.max(.5, Math.min(N - .5, y));
  if (blockedAt(x, y)) { const f = nearestFree(x, y, 10); if (f) { x = f.x; y = f.y; } }
  const a = Math.floor(x), b = Math.floor(y);
  u.goal = { x0: a, y0: b, x1: a, y1: b, ex: x, ey: y }; return repath(u);
}
function goalEnt(u, t) { u.goal = goalOf(t); return repath(u); }

// ---- order API ----
function clearOrder(u) {
  if (u.tgt && u.tgt.kind === 'farm' && u.tgt.worker === u.id) u.tgt.worker = null;
  u.tgt = null; u.path = null; u.goal = null; u.am = null; u.auto = false; u.ph = ''; u.rp = 0; u.act = ''; u.dropsite = null;
}
function cmdStop(u) { clearOrder(u); u.ord = 'idle'; u.bq = null; }
function cmdMove(u, x, y) { clearOrder(u); u.bq = null; u.ord = 'move'; u.dest = { x, y }; if (!goalPoint(u, x, y)) u.ord = 'idle'; }
function cmdAMove(u, x, y) {
  clearOrder(u); u.bq = null; u.ord = 'amove'; u.am = { x, y }; u.dest = { x, y };
  if (!goalPoint(u, x, y)) { u.ord = 'idle'; u.am = null; }
}
function cmdAttack(u, t) {
  clearOrder(u); u.bq = null; u.ord = 'attack'; u.tgt = t;
}
function engage(u, t, auto) { u.tgt = t; u.ord = 'attack'; u.auto = auto; u.path = null; u.rt = 0; }
function cmdGather(u, r) {
  clearOrder(u); u.bq = null; u.ord = 'gather'; u.tgt = r; u.ph = 'go';
  if (u.ct !== r.rt) { u.carry = 0; u.ct = r.rt; }
  u.lastRes = { x: r.x, y: r.y }; u.bad = null;
}
function cmdBuild(u, b, keepQ) {
  const q = keepQ ? u.bq : null; clearOrder(u); u.bq = q; u.ord = b.done ? 'repair' : 'build'; u.tgt = b;
}
function groupMove(units, x, y, amove) {
  if (units.length === 1) { amove ? cmdAMove(units[0], x, y) : cmdMove(units[0], x, y); return; }
  const n = units.length, tiles = [], cx = Math.floor(x), cy = Math.floor(y);
  for (let r = 0; tiles.length < n * 2 + 4 && r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const a = cx + dx, b = cy + dy;
    if (inb(a, b) && !G.blk[ix(a, b)]) tiles.push({ x: a + .5, y: b + .5, d: Math.hypot(a + .5 - x, b + .5 - y) });
  }
  tiles.sort((a, b) => a.d - b.d);
  const us = units.slice().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  const used = [];
  for (const u of us) {
    let bi = -1, bd = 1e9;
    for (let i = 0; i < Math.min(tiles.length, n + 8); i++) { if (used[i]) continue; const d = Math.hypot(tiles[i].x - u.x, tiles[i].y - u.y) + i * .5; if (d < bd) { bd = d; bi = i; } }
    if (bi < 0) bi = 0; used[bi] = 1; const t = tiles[bi] || { x, y };
    amove ? cmdAMove(u, t.x, t.y) : cmdMove(u, t.x, t.y);
  }
}

// ---- movement ----
function tryMove(u, nx, ny) {
  if (!blockedAt(nx, ny) || blockedAt(u.x, u.y)) { u.x = nx; u.y = ny; return true; }
  if (!blockedAt(nx, u.y)) { u.x = nx; return false; }
  if (!blockedAt(u.x, ny)) { u.y = ny; return false; }
  return false;
}
// returns 1 moving, 0 arrived / no path, -1 failed
function followPath(u, dt) {
  if (!u.path) return 0;
  if (u.pi >= u.path.length) { u.path = null; return 0; }
  u.mt += dt;
  if (u.mt > .8) {
    const m = Math.hypot(u.x - u.mx, u.y - u.my); u.mx = u.x; u.my = u.y; u.mt = 0;
    if (m < u.st.spd * .2) { if (++u.rp > 4) { u.path = null; u.rp = 0; return -1; } if (!repath(u)) return -1; } else u.rp = 0;
  }
  let sp = u.st.spd * dt;
  while (sp > 0 && u.pi < u.path.length) {
    const w = u.path[u.pi], dx = w.x - u.x, dy = w.y - u.y, d = Math.hypot(dx, dy);
    const sdx = dx - dy; if (Math.abs(sdx) > .05) u.fx = sdx > 0 ? 1 : -1;
    if (d <= sp) { tryMove(u, w.x, w.y); sp -= d; u.pi++; }
    else { tryMove(u, u.x + dx / d * sp, u.y + dy / d * sp); sp = 0; }
  }
  u.moving = true; u.anim += dt * u.st.spd * 4;
  if (u.pi >= u.path.length) { u.path = null; return 0; }
  return 1;
}

// ---- targeting ----
function armorOf(t, type) { return t.type === 'unit' ? (type === 'p' ? t.st.aP : t.st.aM) : (type === 'p' ? t.aP : t.aM); }
function calcDamage(att, t) { return Math.max(1, att.atk - armorOf(t, att.t)) + ((att.bonus && att.bonus[t.cls]) || 0); }
function findEnemy(u, r, allowB) {
  let best = null, bd = 1e9;
  if (u.cls !== 'siege' || u.kind === 'mangonel') {
    for (const e of U) {
      if (e.dead || e.owner === u.owner) continue;
      const dx = e.x - u.x, dy = e.y - u.y; if (Math.abs(dx) > r || Math.abs(dy) > r) continue;
      const d = Math.hypot(dx, dy) * (e.cls === 'vil' ? 1.4 : 1); if (d < r && d < bd) { bd = d; best = e; }
    }
    if (best) return best;
  }
  const rb = u.cls === 'siege' ? Math.max(r, 7) : (allowB ? r : 2.5);
  for (const b of B) {
    if (b.dead || b.owner === u.owner) continue;
    const d = distRect(u.x, u.y, b.bx, b.by, b.bx + b.s, b.by + b.s) + (b.def.atk ? -2 : 0) + (b.kind === 'farm' ? 3 : 0); if (d < rb && d < bd) { bd = d; best = b; }
  }
  return best;
}
function aggroOf(u) { return Math.max(u.st.rng + 3, 7); }
function endAttack(u) {
  const am = u.am, auto = u.auto, home = u.home;
  u.tgt = null; u.path = null; u.auto = false;
  if (am) { u.ord = 'amove'; u.am = am; u.think = 0; goalPoint(u, am.x, am.y); if (!u.path) u.ord = 'idle'; return; }
  u.ord = 'idle';
  if (auto && home && Math.hypot(u.x - home.x, u.y - home.y) > 2) { u.ord = 'move'; u.dest = home; if (!goalPoint(u, home.x, home.y)) u.ord = 'idle'; }
}

// ---- damage ----
function hurt(t, dmg, from) {
  if (t.dead) return;
  t.hp -= dmg; t.flash = .12;
  if (t.owner === 0 && G.t - G.lastAlert > 10 && (from == null || from.owner !== 0)) { G.lastAlert = G.t; G.alerts.push({ text: 'You are under attack!', bad: true, t: G.t, x: t.x, y: t.y, ping: true }); S('alert'); }
  if (t.hp <= 0) { die(t, from); return; }
  if (t.type === 'unit' && from && from.type === 'unit' && !from.dead && t.cls !== 'vil' && (t.ord === 'idle' || (t.ord === 'move' && false))) engage(t, from, true);
  if (t.type === 'unit' && t.cls === 'vil' && t.ord === 'idle' && from && from.type === 'unit' && !from.dead && t.owner === 1) { /* ai villagers don't flee */ }
}
function die(t, from) {
  t.dead = true; t.hp = 0;
  const kp = from && from.owner != null ? P(from.owner) : null;
  if (t.type === 'unit') {
    P(t.owner).stats.lost++; if (kp && from.owner !== t.owner) kp.stats.kills++;
    G.decals.push({ k: 'corpse', x: t.x, y: t.y, kind: t.kind, owner: t.owner, t: 0, fx: t.fx });
    if (t.tgt && t.tgt.kind === 'farm' && t.tgt.worker === t.id) t.tgt.worker = null;
    if (visAt(t.x, t.y)) S('die', t.x, t.y);
    for (let i = 0; i < 5; i++) addPart({ x: t.x, y: t.y, z: 10, vx: (Math.random() - .5) * 1.5, vy: (Math.random() - .5) * 1.5, vz: 30 + Math.random() * 30, life: .6, c: '#a01818', size: 2, g: 120 });
  } else if (t.type === 'bld') {
    P(t.owner).stats.lost++; if (kp && from.owner !== t.owner) kp.stats.kills++;
    razeBld(t, false);
  }
}
function razeBld(b, quiet) {
  b.dead = true;
  for (let y = b.by; y < b.by + b.s; y++) for (let x = b.bx; x < b.bx + b.s; x++) { G.occ[ix(x, y)] = 0; if (!b.def.flat) G.blk[ix(x, y)] = 0; }
  for (const q of b.q) { if (q.cost) refund(P(b.owner), q.cost); }
  if (quiet) return;
  G.decals.push({ k: 'rubble', bx: b.bx, by: b.by, s: b.s, t: 0 });
  S('crash', b.x, b.y);
  for (let i = 0; i < 26; i++) addPart({ x: b.x + (Math.random() - .5) * b.s, y: b.y + (Math.random() - .5) * b.s, z: 10 + Math.random() * 20, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, vz: 20 + Math.random() * 40, life: 1.2 + Math.random(), c: i % 3 ? '#6b5a48' : '#9a8a70', size: 3 + Math.random() * 3, g: 30, kind: 'smoke' });
}
function doAttack(u, t) {
  const st = u.st, d = Math.hypot(t.x - u.x, t.y - u.y);
  if (st.rng > 1.5) {
    const rock = u.cls === 'siege';
    G.proj.push({ k: rock ? 'rock' : 'arrow', sx: u.x, sy: u.y, tx: t.x, ty: t.y, tgt: t, owner: u.owner, from: u, att: { atk: st.atk, t: st.t, bonus: st.bonus, splash: st.splash }, t: 0, dur: Math.max(.2, d / (rock ? 6 : 15)), arc: rock ? 1 : .3 });
    S(rock ? 'catapult' : 'arrow', u.x, u.y);
  } else {
    hurt(t, calcDamage({ atk: st.atk, t: st.t, bonus: st.bonus }, t), u); u.lunge = .2; S(u.cls === 'siege' ? 'ram' : 'hit', t.x, t.y);
    if (t.type === 'bld' && Math.random() < .5) addPart({ x: t.x + (Math.random() - .5) * t.s, y: t.y + (Math.random() - .5) * t.s, z: 12, vx: 0, vy: 0, vz: 20, life: .5, c: '#caa86a', size: 2, g: 60 });
  }
}
function updateProj(dt) {
  const L = G.proj;
  for (const p of L) {
    p.t += dt;
    if (p.k === 'arrow' && p.tgt && !p.tgt.dead) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    if (p.t < p.dur) continue;
    p.done = true;
    if (p.k === 'arrow') { if (p.tgt && !p.tgt.dead) hurt(p.tgt, calcDamage(p.att, p.tgt), p.from); }
    else {
      const r = p.att.splash || 1.2;
      S('boom', p.tx, p.ty);
      for (let i = 0; i < 10; i++) addPart({ x: p.tx, y: p.ty, z: 4, vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, vz: 20 + Math.random() * 40, life: .5, c: i % 2 ? '#ffb347' : '#6b5a48', size: 3, g: 100 });
      for (const e of U) if (!e.dead && e.owner !== p.owner && Math.hypot(e.x - p.tx, e.y - p.ty) < r) hurt(e, calcDamage(p.att, e), p.from);
      for (const b of B) if (!b.dead && b.owner !== p.owner && distRect(p.tx, p.ty, b.bx, b.by, b.bx + b.s, b.by + b.s) < r * .6) hurt(b, calcDamage(p.att, b), p.from);
    }
  }
  if (L.length) G.proj = L.filter(p => !p.done);
}
function addPart(p) { if (G.parts.length > 500) return; p.max = p.life; p.t = 0; G.parts.push(p); }
function updateParts(dt) {
  const L = G.parts;
  for (const p of L) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.g || 0) * dt; if (p.z < 0) { p.z = 0; p.vz = 0; } }
  if (L.length) G.parts = L.filter(p => p.t < p.life);
  for (const d of G.decals) d.t += dt;
}

// ---- gathering ----
function gatherRate(u, r) {
  const p = P(u.owner), m = p.mod; let rate;
  switch (r.rt) {
    case 'w': rate = .85 * (1 + (m.gw || 0)); break;
    case 'f': rate = (r.kind === 'farm' ? .62 : 1) * (1 + (m.gf || 0)); break;
    case 'g': rate = .8 * (1 + (m.gm || 0)); break;
    default: rate = .8 * (1 + (m.gm || 0));
  }
  return rate * (p.ai ? G.diff.gm : 1);
}
function dropsiteFor(u, rt) {
  let best = null, bd = 1e9;
  for (const b of B) if (b.owner === u.owner && b.done && !b.dead && b.def.drop && b.def.drop.includes(rt)) { const d = distRect(u.x, u.y, b.bx, b.by, b.bx + b.s, b.by + b.s); if (d < bd) { bd = d; best = b; } }
  return best;
}
function findRes(u, kinds, ox, oy, maxd) {
  let best = null, bd = maxd * maxd;
  const bad = u.bad;
  for (const k of kinds) {
    if (k === 'farm') {
      for (const b of B) if (b.kind === 'farm' && b.owner === u.owner && b.done && !b.dead && b.amt > 0 && (!b.worker || b.worker === u.id || !alive(b.worker)) && !(bad && bad.has(b.id))) {
        const d = (b.x - ox) ** 2 + (b.y - oy) ** 2; if (d < bd) { bd = d; best = b; }
      }
    } else for (const r of R) {
      if (r.dead || r.kind !== k || (bad && bad.has(r.id))) continue;
      const d = (r.x - ox) ** 2 + (r.y - oy) ** 2; if (d < bd) { bd = d; best = r; }
    }
    if (best) return best;
  }
  return best;
}
const aliveCache = {};
function alive(id) { for (const u of U) if (u.id === id) return !u.dead && u.ord === 'gather'; return false; }
function resKinds(t) { return t.kind === 'tree' ? ['tree'] : t.kind === 'berry' ? ['berry', 'farm'] : t.kind === 'farm' ? ['farm', 'berry'] : [t.kind]; }
function retarget(u) {
  const o = u.lastRes || u, old = u.tgt;
  if (old && old.kind === 'farm' && old.worker === u.id) old.worker = null;
  const kinds = old ? resKinds(old) : [];
  let r = findRes(u, kinds, o.x, o.y, 18);
  if (!r && old && old.kind === 'farm') r = findRes(u, ['berry'], o.x, o.y, 25);
  if (r) { u.tgt = r; u.ph = u.carry >= u.st.cap ? 'drop' : 'go'; u.path = null; u.lastRes = { x: r.x, y: r.y }; return true; }
  return false;
}
function markBad(u, r) { if (!u.bad) u.bad = new Set(); u.bad.add(r.id); }
function gatherTick(u, dt) {
  const p = P(u.owner); let r = u.tgt;
  if (u.ph === 'drop') return dropTick(u, dt);
  if (!r || r.dead || r.amt <= 0) {
    if (!retarget(u)) { if (u.carry > .5) { u.ph = 'drop'; return; } cmdStop(u); return; }
    r = u.tgt;
  }
  if (u.ph === 'go' || !u.ph) {
    if (distTo(u, r) <= .95) {
      if (r.kind === 'farm') {
        if (r.worker && r.worker !== u.id && alive(r.worker)) { markBad(u, r); if (!retarget(u)) cmdStop(u); return; }
        r.worker = u.id;
      }
      u.ph = 'work'; u.path = null; if (u.ct !== r.rt) { u.carry = 0; u.ct = r.rt; }
    } else {
      if (!u.path) { if (!goalEnt(u, r)) { markBad(u, r); if (!retarget(u)) { if (u.carry > .5) u.ph = 'drop'; else cmdStop(u); } return; } }
      const f = followPath(u, dt);
      if (f < 0) { markBad(u, r); if (!retarget(u)) cmdStop(u); }
      else if (f === 0 && distTo(u, r) > .95) { u.path = null; if (++u.rp > 5) { markBad(u, r); u.rp = 0; if (!retarget(u)) cmdStop(u); } }
    }
  } else if (u.ph === 'work') {
    u.act = 'work'; u.fx = (r.x - r.y) - (u.x - u.y) >= 0 ? 1 : -1;
    const a = Math.min(r.amt, gatherRate(u, r) * dt); r.amt -= a; u.carry += a; p.stats.gathered += a; u.anim += dt * 8;
    if (r.amt <= 0) {
      if (r.kind === 'farm') { if (p.res.w >= 40) { p.res.w -= 40; r.amt = farmAmt(p.id); } else { r.worker = null; razeBld(r, true); } }
      else { killRes(r); }
    }
    if (u.carry >= u.st.cap) { u.ph = 'drop'; u.path = null; u.dropsite = null; if (r.kind === 'farm' && r.worker === u.id) { /* keep claim */ } }
  }
}
function dropTick(u, dt) {
  const p = P(u.owner); let d = u.dropsite;
  if (!d || d.dead) d = u.dropsite = dropsiteFor(u, u.ct);
  if (!d) { u.act = ''; return; }
  if (distTo(u, d) <= .95) {
    const amt = Math.floor(u.carry); p.res[u.ct] += amt; u.carry -= amt;
    if (u.owner === 0 && amt > 0 && visAt(u.x, u.y)) addPart({ x: u.x, y: u.y, z: 24, vx: 0, vy: 0, vz: 22, life: 1, c: '#fff', size: 0, kind: 'text', text: '+' + amt + ' ' + RES_ICON[u.ct] });
    u.carry = 0; u.path = null; u.ph = 'go';
    if (!u.tgt || u.tgt.dead || u.tgt.amt <= 0) { if (!retarget(u)) cmdStop(u); }
    return;
  }
  if (!u.path) { if (!goalEnt(u, d)) { u.dropsite = null; cmdStop(u); return; } }
  const f = followPath(u, dt);
  if (f <= 0 && u.path === null && distTo(u, d) > .95) { if (++u.rp > 5) { u.dropsite = null; cmdStop(u); } }
}

// ---- building ----
function buildTick(u, dt) {
  const b = u.tgt;
  if (!b || b.dead) { cmdStop(u); return; }
  if (b.done) { if (u.ord === 'build') afterBuild(u, b); else cmdStop(u); return; }
  if (distTo(u, b) <= .95) { u.act = 'build'; u.path = null; b.bAcc++; u.anim += dt * 7; u.fx = (b.x - b.y) - (u.x - u.y) >= 0 ? 1 : -1; }
  else {
    if (!u.path) { if (!goalEnt(u, b)) { cmdStop(u); return; } }
    const f = followPath(u, dt); if (f < 0) cmdStop(u); else if (f === 0 && distTo(u, b) > .95) { u.path = null; if (++u.rp > 5) cmdStop(u); }
  }
}
function repairTick(u, dt) {
  const b = u.tgt;
  if (!b || b.dead || b.hp >= b.maxhp) { cmdStop(u); return; }
  if (distTo(u, b) <= .95) { u.act = 'build'; u.path = null; b.hp = Math.min(b.maxhp, b.hp + b.maxhp / (b.def.time * 3) * dt); u.anim += dt * 7; u.fx = (b.x - b.y) - (u.x - u.y) >= 0 ? 1 : -1; }
  else {
    if (!u.path) { if (!goalEnt(u, b)) { cmdStop(u); return; } }
    const f = followPath(u, dt); if (f < 0) cmdStop(u); else if (f === 0 && distTo(u, b) > .95) { u.path = null; if (++u.rp > 5) cmdStop(u); }
  }
}
function afterBuild(u, b) {
  if (u.bq && u.bq.length) { const nb = u.bq.shift(); if (nb && !nb.dead) { cmdBuild(u, nb, true); return; } }
  let kinds = null;
  switch (b.kind) { case 'farm': cmdGather(u, b); b.worker = u.id; return; case 'mill': kinds = ['berry', 'farm']; break; case 'lumber': kinds = ['tree']; break; case 'mining': kinds = ['gold', 'stone']; break; }
  if (kinds) { const r = findRes(u, kinds, b.x, b.y, 14); if (r) { cmdGather(u, r); return; } }
  cmdStop(u);
}
function placeBuilding(pid, kind, bx, by, builders, queue) {
  const p = P(pid), d = BLDS[kind];
  if (!canPlace(kind, bx, by, pid, !!p.ai)) { note(pid, 'Cannot build there.', true); return null; }
  if (p.age < d.age) { note(pid, 'Requires ' + AGES[d.age] + '.', true); return null; }
  if (!canAfford(p, d.cost)) { note(pid, 'Not enough resources.', true); return null; }
  pay(p, d.cost);
  const b = mkBld(kind, pid, bx, by, false); b.cost = d.cost; p.stats.built++;
  evict(b);
  for (const u of builders) { if (queue && u.ord === 'build') { (u.bq = u.bq || []).push(b); } else cmdBuild(u, b); }
  if (pid === 0) S('place');
  return b;
}
function completeBld(b) {
  b.done = true; b.prog = 1; b.hp = Math.min(b.hp, b.maxhp);
  if (b.kind === 'farm') { b.amt = farmAmt(b.owner); }
  if (b.owner === 0) { S('done'); if (b.kind === 'house' || b.kind === 'tc') G.fogDirty = true; }
  for (const u of U) if (!u.dead && u.tgt === b && u.ord === 'build') afterBuild(u, b);
  G.fogDirty = true;
  if (b.def.pop && b.owner === 0) note(0, b.def.n + ' complete.');
}

// ---- production ----
function queueUnit(b, kind, count, silent) {
  const p = P(b.owner), d = UNITS[kind]; let n = 0;
  if (!b.done) return 0;
  if (p.age < d.age) { note(b.owner, 'Requires ' + AGES[d.age] + '.', true); return 0; }
  for (let i = 0; i < (count || 1); i++) {
    if (b.q.length >= 7) { note(b.owner, 'Production queue is full.', true); break; }
    if (!canAfford(p, d.cost)) { const miss = Object.keys(d.cost).find(k => p.res[k] < d.cost[k]); note(b.owner, 'Not enough ' + RES_NAME[miss] + '.', true); break; }
    const pi = popInfo(p); if (pi.used + d.pop > pi.cap) { note(b.owner, pi.cap >= MAXPOP ? 'Population limit reached.' : 'Build more houses!', true); break; }
    pay(p, d.cost); b.q.push({ kind, t: d.time, T: d.time, cost: d.cost }); n++;
  }
  return n;
}
function techQueued(pid, id) { for (const b of B) if (b.owner === pid && !b.dead) for (const q of b.q) if (q.tech === id) return true; return false; }
function techAvail(p, id) { const t = TECHS[id]; return !p.techs[id] && !techQueued(p.id, id) && (!t.req || p.techs[t.req]); }
function queueTech(b, id) {
  const p = P(b.owner), t = TECHS[id];
  if (!b.done || !techAvail(p, id)) return false;
  if (p.age < t.age) { note(b.owner, 'Requires ' + AGES[t.age] + '.', true); return false; }
  if (b.q.length >= 7) return false;
  if (!canAfford(p, t.cost)) { note(b.owner, 'Not enough resources.', true); return false; }
  pay(p, t.cost); b.q.push({ tech: id, t: t.time, T: t.time, cost: t.cost }); return true;
}
function queueAge(b) {
  const p = P(b.owner), n = p.age + 1;
  if (n > 3 || p.ageUp || !b.done) return false;
  if (!canAfford(p, AGE_UP[n].c)) { note(b.owner, 'Not enough resources to advance.', true); return false; }
  pay(p, AGE_UP[n].c); p.ageUp = true; b.q.push({ age: n, t: AGE_UP[n].t, T: AGE_UP[n].t, cost: AGE_UP[n].c }); return true;
}
function cancelQueue(b, i) {
  const q = b.q[i]; if (!q) return; const p = P(b.owner);
  refund(p, q.cost); if (q.age) p.ageUp = false; b.q.splice(i, 1);
}
function spawnPoint(b) {
  const r = b.rally, tx = r ? r.x : b.x + 3, ty = r ? r.y : b.y + 3; let best = null, bd = 1e9;
  for (let y = b.by - 1; y <= b.by + b.s; y++) for (let x = b.bx - 1; x <= b.bx + b.s; x++) {
    if (x >= b.bx && x < b.bx + b.s && y >= b.by && y < b.by + b.s) continue; if (!inb(x, y) || G.blk[ix(x, y)]) continue;
    const d = Math.hypot(x + .5 - tx, y + .5 - ty); if (d < bd) { bd = d; best = { x: x + .5, y: y + .5 }; }
  }
  return best || nearestFree(b.x, b.y, 8) || { x: b.x, y: b.y };
}
function finishItem(b, q) {
  const p = P(b.owner);
  if (q.kind) {
    const sp = spawnPoint(b), u = mkUnit(q.kind, b.owner, sp.x, sp.y); p.stats.trained++;
    const r = b.rally;
    if (r) {
      const e = r.ent;
      if (e && !e.dead && e.rt && u.cls === 'vil' && (e.type === 'res' || (e.kind === 'farm' && e.owner === b.owner))) cmdGather(u, e);
      else if (e && !e.dead && e.type === 'bld' && e.owner === b.owner && !e.done && u.cls === 'vil') cmdBuild(u, e);
      else cmdMove(u, r.x, r.y);
    }
    if (b.owner === 0) S('spawn');
  } else if (q.tech) {
    p.techs[q.tech] = 1; const t = TECHS[q.tech];
    for (const k in (t.fx || {})) p.mod[k] = (p.mod[k] || 0) + t.fx[k];
    refreshStats(p.id); note(b.owner, 'Research complete: ' + t.n); if (b.owner === 0) S('tech');
  } else if (q.age) {
    p.age = q.age; p.ageUp = false; note(b.owner, 'You have advanced to the ' + AGES[p.age] + '!'); if (b.owner === 0) { S('age'); G.ageFlash = { t: 0, age: p.age }; } else note(0, 'The enemy has reached the ' + AGES[p.age] + '.', true);
  }
}
function updateBld(b, dt) {
  if (b.flash > 0) b.flash -= dt;
  if (!b.done) {
    const n = b.bAcc; b.bAcc = 0;
    if (n > 0) {
      const rate = Math.pow(n, .7) / b.def.time; b.prog = Math.min(1, b.prog + rate * dt);
      b.hp = Math.min(b.maxhp, b.hp + b.maxhp * .9 * rate * dt);
      if (b.prog >= 1) completeBld(b);
    }
    return;
  }
  const q = b.q[0];
  if (q) { q.t -= dt * (P(b.owner).ai ? 1 : 1); if (q.t <= 0) { b.q.shift(); finishItem(b, q); } }
  const a = b.def.atk;
  if (a) {
    b.cd -= dt;
    if (b.cd <= 0) {
      let best = null, bd = a.rng + 1.5;
      for (const e of U) { if (e.dead || e.owner === b.owner) continue; const d = Math.hypot(e.x - b.x, e.y - b.y) - b.s / 2; if (d < bd) { bd = d; best = e; } }
      if (best) {
        const m = P(b.owner).mod;
        G.proj.push({ k: 'arrow', sx: b.x, sy: b.y, tx: best.x, ty: best.y, tgt: best, owner: b.owner, from: b, att: { atk: a.dmg + (m.atkRanged || 0), t: 'p', bonus: {} }, t: 0, dur: Math.max(.2, bd / 15), arc: .5, sz: b.s });
        b.cd = a.rof; S('arrow', b.x, b.y);
      } else b.cd = .25;
    }
  }
  if (b.hp < b.maxhp * .5) { b.fire += dt; if (b.fire > .12 && visAt(b.x, b.y) !== undefined) { b.fire = 0; const sev = 1 - b.hp / b.maxhp; addPart({ x: b.x + (Math.random() - .5) * b.s * .6, y: b.y + (Math.random() - .5) * b.s * .6, z: 20 + Math.random() * 20, vx: 0, vy: 0, vz: 25 + Math.random() * 20, life: .7, c: sev > .7 ? '#ff7a1c' : '#ffb347', size: 3 + sev * 3, g: 0, kind: sev > .6 || Math.random() < .5 ? 'fire' : 'smoke' }); } }
}

// ---- units ----
function updateUnit(u, dt) {
  if (u.cd > 0) u.cd -= dt; if (u.flash > 0) u.flash -= dt; if (u.lunge > 0) u.lunge -= dt;
  u.moving = false; u.act = '';
  switch (u.ord) {
    case 'idle': {
      if (u.cls !== 'vil') { u.think -= dt; if (u.think <= 0) { u.think = .4; const t = findEnemy(u, aggroOf(u), false); if (t && (u.owner === 1 || visAt(t.x, t.y) || t.type === 'bld')) { u.home = { x: u.x, y: u.y }; engage(u, t, true); } } }
      break;
    }
    case 'move': { const f = followPath(u, dt); if (f <= 0) { if (u.path === null) { u.ord = 'idle'; u.dest = null; } } break; }
    case 'amove': {
      u.think -= dt;
      if (u.think <= 0) { u.think = .3; const t = findEnemy(u, aggroOf(u) + 2, true); if (t) { engage(u, t, false); break; } }
      const f = followPath(u, dt); if (f <= 0) { u.ord = 'idle'; u.am = null; }
      break;
    }
    case 'attack': attackTick(u, dt); break;
    case 'gather': gatherTick(u, dt); break;
    case 'build': buildTick(u, dt); break;
    case 'repair': repairTick(u, dt); break;
  }
}
function attackTick(u, dt) {
  const t = u.tgt;
  if (!t || t.dead || t.owner === u.owner) { endAttack(u); return; }
  if (u.owner === 0 && t.type === 'unit' && !visAt(t.x, t.y) && Math.hypot(t.x - u.x, t.y - u.y) > 3) { endAttack(u); return; }
  if (u.auto && u.home && Math.hypot(u.x - u.home.x, u.y - u.home.y) > 15) { u.tgt = null; u.ord = 'move'; u.auto = false; u.dest = u.home; goalPoint(u, u.home.x, u.home.y); return; }
  const d = distTo(u, t);
  if (d <= u.st.rng) {
    u.path = null; u.act = 'fight';
    const dx = t.x - u.x, dy = t.y - u.y; if (Math.abs(dx - dy) > .1) u.fx = dx - dy > 0 ? 1 : -1;
    if (u.cd <= 0) { doAttack(u, t); u.cd = u.st.rof; }
  } else {
    u.rt -= dt;
    if (!u.path || (t.type === 'unit' && u.rt <= 0)) {
      u.rt = .6 + Math.random() * .3;
      if (!goalEnt(u, t)) { endAttack(u); return; }
    }
    const f = followPath(u, dt);
    if (f < 0) endAttack(u);
  }
}

// ---- crowd separation ----
function separate() {
  const C = N / 2 | 0, cells = G.hash || (G.hash = new Array(C * C));
  for (let i = 0; i < cells.length; i++) { if (cells[i]) cells[i].length = 0; }
  for (const u of U) { if (u.dead) continue; const c = Math.min(C - 1, Math.max(0, u.y / 2 | 0)) * C + Math.min(C - 1, Math.max(0, u.x / 2 | 0)); (cells[c] || (cells[c] = [])).push(u); }
  for (const u of U) {
    if (u.dead) continue;
    const cx = Math.min(C - 1, u.x / 2 | 0), cy = Math.min(C - 1, u.y / 2 | 0);
    for (let j = Math.max(0, cy - 1); j <= Math.min(C - 1, cy + 1); j++) for (let i = Math.max(0, cx - 1); i <= Math.min(C - 1, cx + 1); i++) {
      const cell = cells[j * C + i]; if (!cell) continue;
      for (const v of cell) {
        if (v.id <= u.id) continue;
        const dx = v.x - u.x, dy = v.y - u.y, m = (u.cls === 'siege' || v.cls === 'siege') ? .8 : .52;
        if (Math.abs(dx) > m || Math.abs(dy) > m) continue;
        const d2 = dx * dx + dy * dy; if (d2 >= m * m) continue;
        let d = Math.sqrt(d2), nx, ny; if (d < .001) { nx = Math.random() - .5; ny = Math.random() - .5; d = Math.hypot(nx, ny) + 1e-6; nx /= d; ny /= d; d = 0; } else { nx = dx / d; ny = dy / d; }
        const wu = (u.act ? .1 : 1), wv = (v.act ? .1 : 1), push = (m - d) * .4, su = wu / (wu + wv), sv = wv / (wu + wv);
        let ax = u.x - nx * push * su, ay = u.y - ny * push * su; if (!blockedAt(ax, ay)) { u.x = ax; u.y = ay; }
        ax = v.x + nx * push * sv; ay = v.y + ny * push * sv; if (!blockedAt(ax, ay)) { v.x = ax; v.y = ay; }
      }
    }
  }
}

// ---- main step ----
const DT = 1 / 30;
function step() {
  const dt = DT; G.t += dt; G.frame++;
  for (const u of U) if (!u.dead) updateUnit(u, dt);
  separate();
  for (const b of B) if (!b.dead) updateBld(b, dt);
  updateProj(dt); updateParts(dt);
  for (const p of G.players) if (p.ai) aiUpdate(p, dt);
  if (G.frame % 20 === 0) {
    U = U.filter(u => !u.dead); B = B.filter(b => !b.dead); R = R.filter(r => !r.dead);
    G.decals = G.decals.filter(d => d.k === 'rubble' || d.t < 25);
  }
  if (G.frame % 8 === 0) updateVis();
  if (G.frame % 30 === 0 && !G.over) checkEnd();
}
function checkEnd() {
  for (const p of G.players) { let n = 0; for (const b of B) if (b.owner === p.id && !b.dead) n++; if (!n) { G.over = { win: p.id === 1, t: G.t }; return; } }
}
