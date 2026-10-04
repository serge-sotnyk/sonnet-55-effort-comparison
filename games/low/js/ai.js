'use strict';
// ---- computer opponent ----
function aiUpdate(p, dt) {
  const a = p.ai; a.t += dt; if (a.t < 1) return; a.t = 0; a.n = (a.n || 0) + 1;
  const D = G.diff, enemy = G.players[1 - p.id];
  const vils = [], mil = [], bl = {};
  for (const u of U) if (u.owner === p.id && !u.dead) (u.cls === 'vil' ? vils : mil).push(u);
  for (const b of B) if (b.owner === p.id && !b.dead) (bl[b.kind] = bl[b.kind] || []).push(b);
  const cnt = k => (bl[k] || []).length, done = k => (bl[k] || []).filter(b => b.done);
  const tcs = done('tc'); if (!tcs.length && !(bl.tc && bl.tc.length)) { /* no town center: still try to rebuild */ }
  const home = tcs[0] || (bl.tc && bl.tc[0]) || Object.values(bl)[0] && Object.values(bl)[0][0];
  if (!home) return;
  const pi = popInfo(p);
  const builds = vils.filter(u => u.ord === 'build').length;

  // ---- economy accounting
  const catOf = u => { if (u.ord !== 'gather' || !u.tgt) return null; const k = u.tgt.kind; return k === 'tree' ? 'w' : k === 'berry' || k === 'farm' ? 'f' : k === 'gold' ? 'g' : 's'; };
  const cur = { f: 0, w: 0, g: 0, s: 0 }; const idle = [];
  for (const u of vils) { const c = catOf(u); if (c) cur[c]++; else if (u.ord === 'idle') idle.push(u); }
  const nv = vils.length;

  // ---- unfinished buildings nobody is working on
  for (const b of B) if (b.owner === p.id && !b.dead && !b.done) {
    const n = vils.filter(u => u.tgt === b && u.ord === 'build').length;
    if (n) { b.orph = 0; continue; }
    b.orph = (b.orph || 0) + 1;
    if (b.orph >= 3 && b.orph % 3 === 0) {
      const c = vils.filter(u => u.ord !== 'build' && u.carry < 6).sort((x, y) => Math.hypot(x.x - b.x, x.y - b.y) - Math.hypot(y.x - b.x, y.y - b.y)).slice(0, 2);
      for (const u of c) cmdBuild(u, b);
    }
    if (b.orph > 40) { refund(p, b.cost || b.def.cost); razeBld(b, true); }
  }

  // ---- villagers
  const vq = tcs.reduce((n, b) => n + b.q.filter(q => q.kind).length, 0);
  const wantV = Math.min(D.vil, p.age === 0 ? 24 : 60);
  if (nv + vq < wantV) for (const tc of tcs) if (tc.q.length < 2 && !(p.ageUp && tc.q.some(q => q.age))) queueUnit(tc, 'villager', 1);

  // ---- age up
  const milB = ['barracks', 'archery', 'stable'].reduce((n, k) => n + cnt(k), 0);
  const needV = [Math.min(16, wantV), Math.min(26, wantV), Math.min(32, wantV)][p.age];
  a.saving = false;
  if (p.age < 3 && !p.ageUp && nv >= needV && (p.age === 0 || milB >= 1) && (p.age < 2 || mil.length >= 10 || G.t > 900)) {
    a.saving = true;
    const tc = tcs.find(b => !b.q.some(q => q.age));
    if (tc && tc.q.length <= 1) queueAge(tc);
  }

  // ---- houses
  const houseSites = (bl.house || []).filter(b => !b.done).length;
  if (pi.cap < MAXPOP && pi.used + 5 + (D.vil > 40 ? 3 : 0) >= pi.cap && houseSites < (nv > 25 ? 2 : 1) && p.res.w >= 30) aiBuild(p, 'house', home, vils, 1, 3, 14);

  // ---- resource camps
  if (a.n % 4 === 0 && builds < 3) {
    if (cur.w >= 2 && p.res.w >= 100) { const s = aiCampSpot(p, 'tree', home, 'w'); if (s && aiBuildAt(p, 'lumber', s, vils, 2)) { /* queued */ } }
    else if (cur.g + cur.s >= 2 && p.res.w >= 100) { const s = aiCampSpot(p, 'gold', home, 'g') || aiCampSpot(p, 'stone', home, 's'); if (s) aiBuildAt(p, 'mining', s, vils, 2); }
    if (!cnt('mill') && p.res.w >= 100 && (cur.f >= 3 || nv >= 8)) { const s = aiCampSpot(p, 'berry', home, 'f'); if (s) aiBuildAt(p, 'mill', s, vils, 2); else if (nv >= 12) aiBuild(p, 'mill', home, vils, 4, 3, 10); }
  }

  // ---- military buildings
  if (a.n % 3 === 0 && builds < 3 && nv >= 9) {
    const want = [
      ['barracks', p.age >= 0 ? 1 : 0], ['smith', p.age >= 1 ? 1 : 0], ['archery', p.age >= 1 ? 1 : 0], ['stable', p.age >= 1 && nv >= 18 ? 1 : 0],
      ['siege', p.age >= 2 ? 1 : 0], ['barracks', p.age >= 2 ? D.bld : 0], ['archery', p.age >= 2 ? D.bld : 0], ['stable', p.age >= 2 ? D.bld : 0], ['tower', p.age >= 1 ? D.bld + 1 : 0],
    ];
    for (const [k, n] of want) {
      if (cnt(k) >= n) continue; const d = BLDS[k];
      if (p.age < d.age || !canAfford(p, d.cost)) continue;
      if (a.saving && k !== 'barracks' && k !== 'archery') continue;
      if (k === 'tower') { aiBuild(p, 'tower', home, vils, 6, 6, 12, true); } else aiBuild(p, k, home, vils, 2, 4, 16);
      break;
    }
  }

  // ---- farms
  const farms = bl.farm || [];
  const berries = R.some(r => !r.dead && r.kind === 'berry' && Math.hypot(r.x - home.x, r.y - home.y) < 22);
  const farmTarget = Math.min(14, Math.ceil(nv * (berries ? .22 : .38)));
  if (a.n % 2 === 0 && cur.f + idle.length >= 0 && farms.length < farmTarget && p.res.w >= 60 && nv >= 7 && builds < 4 && (!berries || nv > 12 || !cnt('mill'))) {
    const mill = (bl.mill || []).find(b => b.done), anchor = mill || home;
    const farmers = vils.filter(u => catOf(u) === 'w' || u.ord === 'idle');
    aiBuild(p, 'farm', anchor, farmers.length ? farmers : vils, 1, 2, 9, false, true);
  }

  // ---- distribute villagers
  const frac = p.age === 0 ? { f: .5, w: .42, g: .08, s: 0 } : p.age === 1 ? { f: .38, w: .34, g: .22, s: .06 } : { f: .32, w: .28, g: .3, s: .1 };
  const wt = c => frac[c] * (p.res[c] < 150 ? 1.6 : p.res[c] > 900 ? .4 : 1);
  const tot = ['f', 'w', 'g', 's'].reduce((n, c) => n + wt(c), 0), pool = Math.max(1, nv - builds);
  const need = c => wt(c) / tot * pool - cur[c];
  for (const u of idle) {
    if (u.ord !== 'idle') continue;
    const cs = ['f', 'w', 'g', 's'].sort((x, y) => need(y) - need(x));
    for (const c of cs) { if (aiAssign(p, u, c, home)) { cur[c]++; break; } }
  }
  if (a.n % 5 === 0) {
    const cs = ['f', 'w', 'g', 's'].sort((x, y) => need(y) - need(x));
    const lo = cs[0], hi = cs[3];
    if (need(lo) > 1.5 && need(hi) < -1.5) {
      const v = vils.find(u => catOf(u) === hi && u.carry < 3);
      if (v && aiAssign(p, v, lo, home)) { cur[lo]++; cur[hi]--; }
    }
  }

  // ---- military production
  const rsv = a.saving ? AGE_UP[p.age + 1].c : {};
  const affordR = c => { for (const k in c) if ((p.res[k] || 0) < c[k] + (rsv[k] || 0)) return false; return true; };
  {
    const e = { cav: 0, inf: 0, arch: 0, siege: 0 }; for (const u of U) if (u.owner !== p.id && !u.dead && e[u.cls] !== undefined) e[u.cls]++;
    const have = {}; for (const u of mil) have[u.kind] = (have[u.kind] || 0) + 1;
    for (const b of B) if (b.owner === p.id && !b.dead && b.done && b.def.trains && b.kind !== 'tc' && b.q.length < 2) {
      if (pi.used >= pi.cap) break;
      const opts = [];
      for (const k of b.def.trains) {
        const d = UNITS[k]; if (p.age < d.age || !affordR(d.cost)) continue;
        let w = { militia: p.age >= 1 ? .7 : 3, spear: 2 + (e.cav > 3 ? 4 : 0), archer: 3.5 + (e.inf > 6 ? 1.5 : 0), scout: p.age >= 2 ? 0 : 1, knight: 4 + (e.arch > 6 ? 2 : 0), ram: (have.ram || 0) < 2 + p.age ? 1.5 : 0, mangonel: (have.mangonel || 0) < 3 ? 1 : 0 }[k];
        if (w) opts.push([k, w]);
      }
      if (!opts.length) continue;
      let r = Math.random() * opts.reduce((s, o) => s + o[1], 0), pick = opts[0][0];
      for (const [k, w] of opts) { r -= w; if (r <= 0) { pick = k; break; } }
      queueUnit(b, pick, 1); pi.used += UNITS[pick].pop;
    }
  }
  // ---- research
  if (a.n % 4 === 0) {
    for (const b of B) if (b.owner === p.id && !b.dead && b.done && b.def.techs && b.q.length < 1) {
      const opts = b.def.techs.filter(id => techAvail(p, id) && p.age >= TECHS[id].age && (TECHS[id].b !== 'barracks' || true));
      for (const id of opts) {
        const c = TECHS[id].cost; let ok = true; for (const k in c) if (p.res[k] < c[k] + (rsv[k] || 0) + (nv < 20 ? 150 : 60)) ok = false;
        if (ok && (nv >= 14 || TECHS[id].b !== 'tc')) { queueTech(b, id); break; }
      }
    }
  }

  // ---- army
  const home2 = home, ehome = (() => { let best = null, bd = 1e9; for (const b of B) if (b.owner !== p.id && !b.dead) { const d = Math.hypot(b.x - home2.x, b.y - home2.y); if (d < bd) { bd = d; best = b; } } return best; })();
  if (!a.rally) { const dx = ehome ? ehome.x - home.x : 0, dy = ehome ? ehome.y - home.y : 0, l = Math.hypot(dx, dy) || 1; const f = nearestFree(home.x + dx / l * 8, home.y + dy / l * 8, 6); a.rally = f || { x: home.x, y: home.y }; }
  for (const b of B) if (b.owner === p.id && b.def.trains && b.kind !== 'tc') b.rally = { x: a.rally.x + (Math.random() - .5) * 3, y: a.rally.y + (Math.random() - .5) * 3 };
  const army = mil.filter(u => u.cls !== 'vil');
  if (!ehome) return;
  // defence
  const threats = [];
  for (const e of U) if (e.owner !== p.id && !e.dead && e.cls !== 'vil') { for (const b of B) if (b.owner === p.id && !b.dead && Math.hypot(e.x - b.x, e.y - b.y) < 13) { threats.push(e); break; } }
  const waveSet = a.waveIds || (a.waveIds = new Set());
  if (threats.length) {
    let cx = 0, cy = 0; for (const t of threats) { cx += t.x; cy += t.y; } cx /= threats.length; cy /= threats.length;
    for (const u of army) if (!waveSet.has(u.id) && (u.ord === 'idle' || (u.ord === 'move' && !a.defending))) cmdAMove(u, cx, cy);
    a.defending = true;
  } else if (a.defending) {
    a.defending = false;
    for (const u of army) if (!waveSet.has(u.id) && u.ord === 'idle') cmdMove(u, a.rally.x + (Math.random() - .5) * 4, a.rally.y + (Math.random() - .5) * 4);
  }
  // attack waves
  const first = { easy: 480, normal: 330, hard: 250 }[G.diffKey] || 330;
  const need2 = D.atk + a.wave * D.wave;
  if (!a.waveOn) {
    const ready = army.filter(u => !(u.ord === 'attack' && u.tgt && u.tgt.owner !== p.id && false));
    if ((ready.length >= need2 && G.t > first && !threats.length) || (pi.used >= MAXPOP - 6 && ready.length > 25)) {
      a.waveOn = true; a.waveN = ready.length; waveSet.clear(); a.lastWave = G.t;
      for (const u of ready) { waveSet.add(u.id); aiSendTo(u, ehome); }
      note(1 - p.id, 'The enemy army is on the march!', true);
    } else for (const u of army) if (u.ord === 'idle' && Math.hypot(u.x - a.rally.x, u.y - a.rally.y) > 7 && !a.defending) cmdMove(u, a.rally.x + (Math.random() - .5) * 4, a.rally.y + (Math.random() - .5) * 4);
  } else {
    const alive = army.filter(u => waveSet.has(u.id));
    if (alive.length < Math.max(2, a.waveN * .25) || G.t - a.lastWave > 420) {
      a.waveOn = false; a.wave++; for (const u of alive) cmdMove(u, a.rally.x + (Math.random() - .5) * 4, a.rally.y + (Math.random() - .5) * 4); waveSet.clear();
    } else for (const u of alive) if (u.ord === 'idle') {
      let best = null, bd = 1e9; for (const b of B) if (b.owner !== p.id && !b.dead) { const d = Math.hypot(b.x - u.x, b.y - u.y) + (b.kind === 'farm' ? 15 : 0); if (d < bd) { bd = d; best = b; } }
      if (best) aiSendTo(u, best); else {
        let bu = null; bd = 1e9; for (const e of U) if (e.owner !== p.id && !e.dead) { const d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; bu = e; } } if (bu) cmdAMove(u, bu.x, bu.y);
      }
    }
    // new units gather as reinforcements
    if (a.n % 20 === 0 && army.length > alive.length + 12) { for (const u of army) if (!waveSet.has(u.id) && u.ord === 'idle') { waveSet.add(u.id); aiSendTo(u, ehome); } }
  }
}
function aiSendTo(u, b) { const f = nearestFree(b.x, b.y, 8) || b; cmdAMove(u, f.x + (Math.random() - .5), f.y + (Math.random() - .5)); }

function aiAssign(p, u, c, home) {
  const dropOf = k => { let best = null, bd = 1e9; for (const b of B) if (b.owner === p.id && b.done && !b.dead && b.def.drop && b.def.drop.includes(k)) { const d = Math.hypot(b.x - home.x, b.y - home.y); if (d < bd) { bd = d; best = b; } } return best || home; };
  let r = null; u.bad = null;
  if (c === 'w') { const d = dropOf('w'); r = findRes(u, ['tree'], d.x, d.y, 45); }
  else if (c === 'g') { const d = dropOf('g'); r = findRes(u, ['gold'], d.x, d.y, 45); }
  else if (c === 's') { const d = dropOf('s'); r = findRes(u, ['stone'], d.x, d.y, 45); }
  else { r = findRes(u, ['berry'], home.x, home.y, 20); if (!r) r = findRes(u, ['farm'], home.x, home.y, 40); }
  if (r) { cmdGather(u, r); return true; }
  return false;
}
function aiBuild(p, kind, anchor, vils, rmin, rmaxPad, rmax, away, flush) {
  const d = BLDS[kind]; if (p.age < d.age || !canAfford(p, d.cost)) return null;
  const s = d.size, ax = anchor.x, ay = anchor.y, ar = anchor.s ? anchor.s / 2 : 2;
  for (let tries = 0; tries < 40; tries++) {
    const r = ar + rmin + Math.random() * (rmax - rmin), ang = Math.random() * Math.PI * 2;
    const bx = Math.round(ax + Math.cos(ang) * r - s / 2), by = Math.round(ay + Math.sin(ang) * r - s / 2);
    if (!canPlace(kind, bx, by, p.id, true)) continue;
    if (!flush && !roomAround(bx, by, s, 1)) continue;
    if (flush && !roomAround(bx, by, s, 0)) continue;
    if (kind !== 'farm' && kind !== 'tower' && (tooCloseToRes(bx, by, s))) continue;
    const r2 = aiBuildAt(p, kind, { bx, by }, vils, kind === 'house' || kind === 'farm' ? 1 : 2);
    if (r2) return r2;
  }
  return null;
}
function roomAround(bx, by, s, m) {
  if (m === 0) return true;
  for (let y = by - m; y < by + s + m; y++) for (let x = bx - m; x < bx + s + m; x++) { if (!inb(x, y)) return false; if (G.occ[ix(x, y)] && !(x >= bx && x < bx + s && y >= by && y < by + s)) return false; }
  return true;
}
function tooCloseToRes(bx, by, s) { for (let y = by - 1; y <= by + s; y++) for (let x = bx - 1; x <= bx + s; x++) if (inb(x, y) && G.blk[ix(x, y)] && !G.water[ix(x, y)]) return true; return false; }
function aiBuildAt(p, kind, pos, vils, nb) {
  const d = BLDS[kind]; if (p.age < d.age || !canAfford(p, d.cost)) return null;
  const cx = pos.bx + d.size / 2, cy = pos.by + d.size / 2;
  const cand = vils.filter(u => u.ord !== 'build' && u.ord !== 'repair' && u.carry < 6).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, nb || 1);
  if (!cand.length) return null;
  const g = { x0: pos.bx - 1, y0: pos.by - 1, x1: pos.bx + d.size, y1: pos.by + d.size };
  if (!findPath(cand[0].x, cand[0].y, g.x0, g.y0, g.x1, g.y1)) return null;
  return placeBuilding(p.id, kind, pos.bx, pos.by, cand);
}
// find a spot for a drop-off camp next to a dense resource cluster that is far from existing drop-offs
function aiCampSpot(p, rkind, home, drop) {
  const rs = R.filter(r => !r.dead && r.kind === rkind); if (!rs.length) return null;
  const drops = B.filter(b => b.owner === p.id && !b.dead && b.def.drop && b.def.drop.includes(drop));
  const near = rs.map(r => ({ r, d: Math.hypot(r.x - home.x, r.y - home.y) })).filter(o => o.d < 34).sort((a, b) => a.d - b.d).slice(0, 70);
  let best = null, bs = -1e9;
  for (const { r, d } of near) {
    let dd = 1e9; for (const b of drops) dd = Math.min(dd, Math.hypot(b.x - r.x, b.y - r.y) - b.s / 2);
    if (dd <= 6) continue;
    let c = 0; for (const o of rs) if (Math.abs(o.x - r.x) < 4 && Math.abs(o.y - r.y) < 4) c++;
    const sc = Math.min(c, 14) * 3 - d * .6; if (sc > bs && c >= (rkind === 'tree' ? 4 : 2)) { bs = sc; best = r; }
  }
  if (!best) return null;
  let spot = null, sd = 1e9;
  for (let by = best.ty - 3; by <= best.ty + 2; by++) for (let bx = best.tx - 3; bx <= best.tx + 2; bx++) {
    if (!canPlace('lumber', bx, by, p.id, true)) continue;
    let cnt = 0; for (const o of rs) if (Math.hypot(o.x - bx - 1, o.y - by - 1) < 3.2) cnt++;
    const d = Math.hypot(bx + 1 - best.x, by + 1 - best.y) - cnt * .3; if (d < sd) { sd = d; spot = { bx, by }; }
  }
  return spot;
}
