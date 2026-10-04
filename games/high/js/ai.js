'use strict';
// ---------------------------------------------------------------------------
// Computer opponent
// ---------------------------------------------------------------------------
const AI_RATIOS = [
  { food: 0.55, wood: 0.45, gold: 0, stone: 0 },
  { food: 0.36, wood: 0.44, gold: 0.14, stone: 0.06 },
  { food: 0.32, wood: 0.38, gold: 0.22, stone: 0.08 },
  { food: 0.30, wood: 0.34, gold: 0.28, stone: 0.08 },
];

class AIPlayer {
  constructor(p, diff) {
    this.p = p; this.d = diff; this.t = 0; this.thinkT = 1 + Math.random();
    this.wave = null; this.waves = 0; this.lastWaveEnd = 0;
    this.fled = new Set(); this.threatT = -99; this.threat = null;
    this.rebalT = 15; this.scoutT = 5; this.buildT = 0; this.stuckBuildT = 0;
    this.enemy = 1 - p.id;
    this.rallyPt = null;
    for (const k of ['wood', 'farm', 'berries', 'hunt', 'gold', 'stone']) p.fx.push({ t: 'gather', k, v: diff.gather - 1 });
    this.cache = {};
    this.queuedHouse = 0;
    this.lastCamp = {};
  }

  // ----- events -----------------------------------------------------------------
  onAttacked(e, att) { if (att && att.owner !== this.p.id && att.owner >= 0) { this.attackedT = G.time; this.attackedPos = { x: ecx(e), y: ecy(e) }; } }
  onLost(u) { }
  onLostBuilding(b) { }
  onBuilt(b) { }
  onTrained(u, b) { if (u.def.tags.includes('villager')) return; }
  onTech(id) { }

  update(dt) {
    this.t += dt;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = this.d.think * (0.8 + Math.random() * 0.4);
    this.think();
  }

  // ----- helpers ---------------------------------------------------------------
  scan() {
    const p = this.p, id = p.id;
    const S = { vills: [], army: [], monks: [], scouts: [], idleV: [], tcs: [], blds: {}, unbuilt: {}, cat: { food: 0, wood: 0, gold: 0, stone: 0, build: 0, other: 0 }, enemyMil: [], enemyAll: [], eb: [] };
    for (const u of G.units) {
      if (u.dead) continue;
      if (u.owner === id) {
        if (u.def.tags.includes('villager')) {
          S.vills.push(u);
          const c = this.catOf(u);
          S.cat[c] = (S.cat[c] || 0) + 1;
          if (u.state === 'idle' && !u.garrisoned) S.idleV.push(u);
        } else if (u.def.tags.includes('monk')) S.monks.push(u);
        else if (u.def.id === 'scout' || u.type === 'scout') { S.scouts.push(u); }
        else S.army.push(u);
      } else if (u.owner >= 0 && !G.players[u.owner].ai !== undefined) {
        S.enemyAll.push(u);
        if (!u.def.tags.includes('villager')) S.enemyMil.push(u);
      }
    }
    for (const b of G.buildings) {
      if (b.dead) continue;
      if (b.owner === id) {
        if (b.built) { (S.blds[b.type] || (S.blds[b.type] = [])).push(b); if (b.type === 'towncenter') S.tcs.push(b); }
        else (S.unbuilt[b.type] || (S.unbuilt[b.type] = [])).push(b);
      } else if (b.owner >= 0) S.eb.push(b);
    }
    S.armyPop = S.army.reduce((a, u) => a + u.def.pop, 0);
    return S;
  }
  catOf(u) {
    if (u.state === 'gather') {
      const t = u.lastResType;
      if (t === 'tree') return 'wood';
      if (t === 'gold') return 'gold';
      if (t === 'stone') return 'stone';
      return 'food';
    }
    if (u.state === 'build' || u.state === 'repair') return 'build';
    return 'other';
  }
  cnt(S, type) { return (S.blds[type] || []).length; }
  total(S, type) { return (S.blds[type] || []).length + (S.unbuilt[type] || []).length; }
  can(cost) { return canAfford(this.p, cost); }
  dropsites(S, key) {
    const ck = key || '*';
    if (!this.dc) this.dc = {};
    if (this.dc[ck]) return this.dc[ck];
    const out = [];
    for (const b of G.buildings) if (b.owner === this.p.id && b.built && !b.dead && b.def.drop && (!key || b.def.drop.includes(key))) out.push(b);
    return (this.dc[ck] = out);
  }
  tcPos() {
    const tc = G.buildings.find((b) => b.owner === this.p.id && b.type === 'towncenter' && !b.dead);
    return tc ? { x: ecx(tc), y: ecy(tc), b: tc } : { x: this.p.startPos.x, y: this.p.startPos.y, b: null };
  }
  enemyBase() { return G.players[this.enemy].startPos; }

  // ----- placement -----------------------------------------------------------------
  gapOK(type, tx, ty, size) {
    const m = G.map;
    for (let y = ty - 1; y <= ty + size; y++) for (let x = tx - 1; x <= tx + size; x++) {
      if (x >= tx && x < tx + size && y >= ty && y < ty + size) continue;
      if (!m.inb(x, y)) return false;
      const o = m.occ[y * m.w + x];
      if (o) { const e = G.byId.get(o); if (e && e.kind === 'building' && e.def.solid) return false; }
    }
    return true;
  }
  findSpot(type, cx, cy, rmin, rmax, opts = {}) {
    const def = BUILDINGS[type], size = def.size, p = this.p;
    let best = null, bs = 1e9;
    const eb = this.enemyBase();
    let tries = 0;
    for (let r = rmin; r <= rmax; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (opts.sample && Math.random() < 0.6) continue;
        const tx = Math.round(cx + dx - size / 2), ty = Math.round(cy + dy - size / 2);
        if (!canPlace(p, type, tx, ty, false).ok) continue;
        if (type !== 'farm' && !this.gapOK(type, tx, ty, size)) continue;
        // avoid tiles that touch trees heavily for farms/houses (keep forest accessible)
        let sc = r;
        if (opts.awayFromEnemy) sc -= Math.hypot(tx - eb.x, ty - eb.y) * 0.15;
        if (opts.towardEnemy) sc += Math.hypot(tx - eb.x, ty - eb.y) * 0.1;
        tries++;
        if (sc < bs) { bs = sc; best = [tx, ty]; }
      }
      if (best && !opts.sample && r >= rmin + 1) break;
      if (best && opts.sample && tries > 6) break;
    }
    return best;
  }
  pickBuilders(S, n, near) {
    const cand = [];
    for (const v of S.vills) {
      if (v.garrisoned || v.state === 'build') continue;
      if (v.carry.amount > 5 && v.state === 'gather') continue;
      const d = Math.hypot(v.x - near.x, v.y - near.y);
      cand.push([d + (v.state === 'idle' ? -8 : 0), v]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    return cand.slice(0, n).map((c) => c[1]);
  }
  tryBuild(S, type, spot, nBuilders, near) {
    if (!spot) return null;
    const cost = bldCost(this.p, type);
    if (!this.can(cost)) return null;
    const bs = this.pickBuilders(S, nBuilders, near || { x: spot[0], y: spot[1] });
    if (!bs.length) return null;
    const b = placeBuilding(this.p, type, spot[0], spot[1], bs, false);
    if (b) S.unbuilt[type] = (S.unbuilt[type] || []).concat([b]);
    return b;
  }

  // ----- resource targeting -----------------------------------------------------------
  bestResource(S, v, type) {
    const drops = this.dropsites(S, type === 'tree' ? 'wood' : type === 'berries' ? 'food' : type);
    let best = null, bs = 1e9;
    const lst = G.resources;
    for (let i = 0; i < lst.length; i++) {
      const r = lst[i];
      if (r.dead || r.type !== type || r.amount <= 0) continue;
      if (v.bad && v.bad[r.id] > G.time) continue;
      let dd = 99;
      for (const d of drops) { const k = distToRect(r.x, r.y, d.x, d.y, d.x + d.size, d.y + d.size); if (k < dd) dd = k; }
      const sc = dd * 1.0 + Math.hypot(r.x - v.x, r.y - v.y) * 0.25;
      if (sc < bs) { bs = sc; best = r; }
    }
    return best ? { r: best, dd: bs } : null;
  }
  distToDrop(S, r, key) {
    let dd = 99;
    for (const d of this.dropsites(S, key)) { const k = distToRect(r.x, r.y, d.x, d.y, d.x + d.size, d.y + d.size); if (k < dd) dd = k; }
    return dd;
  }
  clusterCenter(r, type, rad) {
    let sx = 0, sy = 0, n = 0;
    for (const o of G.resources) if (!o.dead && o.type === type && Math.abs(o.x - r.x) < rad && Math.abs(o.y - r.y) < rad) { sx += o.x; sy += o.y; n++; }
    return { x: sx / Math.max(1, n), y: sy / Math.max(1, n), n };
  }
  campFor(S, type, key, campType) {
    if ((S.unbuilt[campType] || []).length) return false;
    if (this.lastCamp[campType] && this.t - this.lastCamp[campType] < 30) return false;
    const have = this.total(S, campType);
    if (campType === 'lumber' && have >= 5) return false;
    if (campType === 'mining' && have >= 4) return false;
    // is there still plenty of usable resource close to an existing drop site?
    let nearCount = 0; const need = type === 'tree' ? 24 : 2;
    for (const r of G.resources) {
      if (r.dead || r.type !== type || r.amount <= 0) continue;
      if (this.distToDrop(S, r, key) < 6) { if (++nearCount >= need) break; }
    }
    if (nearCount >= need) return false;
    const tc = this.tcPos();
    let best = null, bs = 1e9;
    for (const r of G.resources) {
      if (r.dead || r.type !== type || r.amount <= 0) continue;
      const d = Math.hypot(r.x - tc.x, r.y - tc.y);
      if (d > 40) continue;
      const cl = this.clusterCenter(r, type, 4);
      if (cl.n < (type === 'tree' ? 7 : 2)) continue;
      const sc = d - cl.n * 0.3;
      if (sc < bs) { bs = sc; best = r; }
    }
    if (!best) return false;
    const spot = this.findSpot(campType, best.x, best.y, 2, 6);
    if (!spot) return false;
    const b = this.tryBuild(S, campType, spot, 1, { x: best.x, y: best.y });
    if (b) { this.lastCamp[campType] = this.t; return true; }
    return false;
  }

  assign(S, v, cat) {
    const tc = this.tcPos();
    if (cat === 'wood') {
      const t = this.bestResource(S, v, 'tree');
      if (!t) return false;
      orderGather(v, t.r); return true;
    }
    if (cat === 'gold' || cat === 'stone') {
      const t = this.bestResource(S, v, cat);
      if (!t) return false;
      orderGather(v, t.r); return true;
    }
    if (cat === 'food') {
      // berries near a drop site
      const bsh = this.bestResource(S, v, 'berries');
      if (bsh && bsh.dd < 15) { orderGather(v, bsh.r); return true; }
      // farms
      let farm = null, bd = 1e9;
      for (const b of G.buildings) {
        if (b.owner !== this.p.id || b.type !== 'farm' || b.dead) continue;
        if (b.farmers.length >= 5) continue;
        const d = Math.hypot(b.x - v.x, b.y - v.y) + b.farmers.length * 2;
        if (d < bd) { bd = d; farm = b; }
      }
      if (farm) { if (farm.built) orderGather(v, farm); else orderBuild(v, farm); return true; }
      // hunt
      const hunt = this.huntNear(tc);
      if (hunt) { orderGather(v, hunt); return true; }
      if (bsh) { orderGather(v, bsh.r); return true; }
      // new farm
      return this.buildFarm(S, v);
    }
    return false;
  }
  huntNear(tc) {
    let best = null, bd = 16;
    for (const r of G.resources) { if (r.dead || !r.animal || r.type === 'boar' || r.amount <= 0) continue; const d = Math.hypot(r.x - tc.x, r.y - tc.y); if (d < bd) { bd = d; best = r; } }
    return best;
  }
  buildFarm(S, v) {
    const cost = bldCost(this.p, 'farm');
    if (!this.can(cost)) return false;
    // around mill or TC with space
    const sites = this.dropsites(S, 'food');
    sites.sort((a, b) => (b.type === 'mill' ? 1 : 0) - (a.type === 'mill' ? 1 : 0));
    for (const s of sites) {
      const nearFarms = G.buildings.filter((b) => b.owner === this.p.id && b.type === 'farm' && !b.dead && Math.hypot(ecx(b) - ecx(s), ecy(b) - ecy(s)) < 9).length;
      if (nearFarms >= (s.type === 'towncenter' ? 8 : 6)) continue;
      const spot = this.findSpot('farm', ecx(s), ecy(s), Math.ceil(s.size / 2) + 1, 9);
      if (spot) { const b = placeBuilding(this.p, 'farm', spot[0], spot[1], [v], false); if (b) return true; }
    }
    return false;
  }

  // ----- main think ---------------------------------------------------------------------------
  think() {
    const p = this.p;
    if (!p.alive) return;
    this.dc = {};
    const S = this.scan();
    this.S = S;
    const tc = this.tcPos();
    this.defense(S, tc);
    this.maintain(S);
    this.economy(S, tc);
    this.construction(S, tc);
    this.research(S);
    this.ageUp(S);
    this.training(S);
    this.military(S, tc);
    this.scouting(S);
    this.trade(S);
  }

  trade(S) {
    const p = this.p;
    if (!S.blds.market || this.agePending) return;
    if (p.res.gold > 450 && p.res.wood < 150) marketBuy(p, 'wood', 100);
    else if (p.res.gold > 450 && p.res.food < 150) marketBuy(p, 'food', 100);
    else if (p.res.stone > 500 && p.res.wood < 100) marketSell(p, 'stone', 100);
  }

  // ----- defense -----------------------------------------------------------------------------------
  defense(S, tc) {
    const p = this.p;
    // enemy military near any of our buildings
    const mine = G.buildings.filter((b) => b.owner === p.id && !b.dead);
    const threats = [];
    for (const e of S.enemyMil) {
      if (e.garrisoned) continue;
      for (const b of mine) {
        if (Math.hypot(e.x - ecx(b), e.y - ecy(b)) < 13 + b.size) { threats.push(e); break; }
      }
    }
    if (threats.length) {
      this.threatT = G.time;
      let cx = 0, cy = 0;
      for (const e of threats) { cx += e.x; cy += e.y; }
      cx /= threats.length; cy /= threats.length;
      this.threat = { x: cx, y: cy, n: threats.length };
      // defenders
      const defenders = S.army.concat(S.monks.slice(0, 0));
      for (const u of defenders) {
        if (u.state === 'attack' || u.garrisoned) continue;
        if (this.wave && this.wave.ids.has(u.id) && threats.length < 6) continue;
        if (u.def.tags.includes('ram') && false) continue;
        const dd = Math.hypot(u.x - cx, u.y - cy);
        if (dd > 60) continue;
        orderAMove(u, cx, cy);
      }
      if (this.wave && threats.length >= 6) { this.wave = null; this.lastWaveEnd = this.t; }
      // villagers flee
      let fleeing = 0;
      const tcs = S.tcs;
      for (const v of S.vills) {
        if (v.garrisoned) continue;
        let danger = false;
        for (const e of threats) { if (Math.hypot(e.x - v.x, e.y - v.y) < 7 && e.stats.atkM + e.stats.atkP > 0) { danger = true; break; } }
        if (!danger) continue;
        // fight back if few threats and many villagers? no, flee
        if (this.fled.has(v.id) && v.state === 'garrison') continue;
        let bestTc = null, bd = 1e9;
        for (const t of tcs) { if (t.garrison.length >= t.def.garrison) continue; const d = Math.hypot(t.x - v.x, t.y - v.y); if (d < bd) { bd = d; bestTc = t; } }
        if (bestTc && S.army.length + threats.length >= 0) { orderGarrison(v, bestTc); this.fled.add(v.id); fleeing++; }
        else if (bd === 1e9) { /* nowhere to go */ }
      }
    } else if (this.fled.size && G.time - this.threatT > 6) {
      this.fled.clear();
      for (const t of S.tcs) ungarrisonAll(t);
      for (const b of S.blds.tower || []) ungarrisonAll(b);
    }
    // army home positions
    if (!this.rallyPt) {
      const eb = this.enemyBase();
      const a = Math.atan2(eb.y - tc.y, eb.x - tc.x);
      this.rallyPt = { x: tc.x + Math.cos(a) * 9, y: tc.y + Math.sin(a) * 9 };
      const f = G.map.findFreeNear(this.rallyPt.x, this.rallyPt.y, 8, p.id);
      if (f) this.rallyPt = { x: f[0], y: f[1] };
    }
  }

  maintain(S) {
    for (const k in S.unbuilt) for (const b of S.unbuilt[k]) {
      if (b.dead || b.built) continue;
      const last = b.lastWorked != null ? b.lastWorked : b.bornAt;
      if (G.time - last < 12) continue;
      if (S.vills.some((v) => v.target === b && (v.state === 'build'))) { b.lastWorked = G.time - 6; continue; }
      const bs = this.pickBuilders(S, 1, { x: ecx(b), y: ecy(b) });
      for (const v of bs) orderBuild(v, b);
      b.lastWorked = G.time;
    }
  }

  // ----- economy ----------------------------------------------------------------------------------------
  economy(S, tc) {
    const p = this.p, d = this.d;
    const nV = S.vills.length;
    // villager target by age and difficulty
    const target = Math.min(d.villagers, 20 + p.age * 12 + Math.floor(this.t / 60) * 1.5);
    // villager production
    let queuedV = 0;
    for (const t of S.tcs) for (const it of t.queue) if (it.kind === 'unit' && it.id === 'villager') queuedV++;
    for (const t of S.tcs) {
      if (nV + queuedV >= target || p.pop >= p.popCap) break;
      const researching = t.queue.some((q) => q.kind === 'tech' && TECHS[q.id].toAge);
      if (researching) continue;
      if (t.queue.length < 3 && this.can(UNITS.villager.cost)) { cmdTrain(t, 'villager', 1); queuedV++; }
    }
    // idle assignment
    const ratios = AI_RATIOS[p.age];
    const tot = Math.max(1, nV);
    const catNames = ['food', 'wood', 'gold', 'stone'];
    // adjust ratios by stockpiles
    const want = {};
    for (const c of catNames) {
      let r = ratios[c];
      if (c === 'gold' && !S.blds.mining && p.age >= 1) r = Math.max(r, 0.1);
      if (p.res[c] > 900) r *= 0.3; else if (p.res[c] > 600) r *= 0.55;
      if (c === 'wood' && p.res.wood < 90 && p.age >= 1) r *= 1.35;
      if (c === 'stone' && p.age < 2 && p.res.stone > 300) r = 0;
      want[c] = r;
    }
    if (nV < 12) { want.wood = 0.38; want.food = 0.62; want.gold = 0; want.stone = 0; }
    else if (p.age < 3 && AGE_COST[p.age + 1] && p.res.food < AGE_COST[p.age + 1].food && nV >= [0, 19, 32, 46][p.age + 1] * 0.8 * (d.name === 'Hard' ? 0.85 : 1)) { want.food += 0.12; want.wood = Math.max(0.15, want.wood - 0.1); }
    const deficits = () => catNames.map((c) => [want[c] * tot - S.cat[c], c]).sort((a, b) => b[0] - a[0]);
    let n = 0;
    for (const v of S.idleV) {
      if (n++ > 6) break;
      if (v.garrisoned) continue;
      if (this.fled.size && this.threat && G.time - this.threatT < 6) continue;
      let done = false;
      for (const [df, c] of deficits()) {
        if (c !== 'food' && c !== 'wood' && df <= 0 && nV > 8) continue;
        if (this.assign(S, v, c)) { S.cat[c]++; done = true; break; }
      }
      if (!done) { for (const c of ['wood', 'food']) if (this.assign(S, v, c)) { S.cat[c]++; break; } }
    }
    // rebalance occasionally
    this.rebalT -= d.think;
    if (this.rebalT <= 0) {
      this.rebalT = 8;
      const df = deficits();
      const over = df[df.length - 1], under = df[0];
      if (under[0] > 2 && over[0] < -2) {
        const cands = S.vills.filter((v) => v.state === 'gather' && this.catOf(v) === over[1] && v.carry.amount < 3 && v.gs !== 'toDrop');
        const v = cands[Math.floor(Math.random() * cands.length)];
        if (v && this.assign(S, v, under[1])) { S.cat[over[1]]--; S.cat[under[1]]++; }
      }
    }
    // mid-game: if farms are depleted of farmers because villager moved, fine.
  }

  // ----- construction -------------------------------------------------------------------------------------------
  construction(S, tc) {
    const p = this.p, d = this.d;
    if (Math.random() < d.mistakes) return;
    const nV = S.vills.length;
    let actions = 0;
    const act = () => ++actions >= 2;
    // lost the Town Center? rebuild one as soon as it can be afforded
    if (!S.tcs.length && !this.total(S, 'towncenter')) {
      const cost = bldCost(p, 'towncenter');
      if (this.can(cost)) {
        const sp = this.p.startPos;
        const spot = this.findSpot('towncenter', sp.x, sp.y, 2, 16);
        if (this.tryBuild(S, 'towncenter', spot, 4, { x: sp.x, y: sp.y }) && act()) return;
      }
    }
    // houses
    const house = (S.unbuilt.house || []).length;
    const unbuiltCap = house * 5;
    const queuedPop = S.tcs.reduce((a, t) => a + t.queue.length, 0) + (S.blds.barracks || []).reduce((a, b) => a + b.queue.length, 0);
    const headroom = p.popCap + unbuiltCap - p.pop;
    const needHouse = headroom < (nV > 25 ? 9 : 3) + Math.min(5, queuedPop) && p.popCap + unbuiltCap < POP_MAX;
    if (needHouse && house < 2 + (nV > 40 ? 1 : 0) && this.can(bldCost(p, 'house'))) {
      const spot = this.findSpot('house', tc.x, tc.y, 5, 18, { sample: true, awayFromEnemy: true });
      if (this.tryBuild(S, 'house', spot, 1, tc) && act()) return;
    }
    // second (third) Town Center: more villager production and a bigger economy
    {
      const maxTc = d.name === 'Easy' ? 1 : (p.age >= 2 ? 3 : 2);
      if (p.age >= 1 && nV >= (d.name === 'Hard' ? 16 : 20) && this.total(S, 'towncenter') < maxTc && this.can(bldCost(p, 'towncenter')) && !this.agePending) {
        const spot = this.findSpot('towncenter', tc.x, tc.y, 8, 20, { sample: true, awayFromEnemy: true });
        if (this.tryBuild(S, 'towncenter', spot, 3, tc) && act()) return;
      }
    }
    // mill near berries / food drop site
    if (!this.total(S, 'mill') && nV >= 5) {
      const berr = this.bestResource(S, { x: tc.x, y: tc.y }, 'berries');
      if (berr && berr.dd > 4 && this.can(bldCost(p, 'mill'))) {
        const spot = this.findSpot('mill', berr.r.x, berr.r.y, 2, 5);
        if (this.tryBuild(S, 'mill', spot, 1, { x: berr.r.x, y: berr.r.y }) && act()) return;
      } else if (!berr && nV >= 10 && this.can(bldCost(p, 'mill'))) {
        const spot = this.findSpot('mill', tc.x, tc.y, 4, 9);
        if (this.tryBuild(S, 'mill', spot, 1, tc) && act()) return;
      }
    }
    // lumber camp
    if (nV >= 7 && this.can(bldCost(p, 'lumber'))) { if (this.campFor(S, 'tree', 'wood', 'lumber') && act()) return; }
    // mining camps
    if (p.age >= 1 || nV >= 14) {
      if (this.can(bldCost(p, 'mining'))) {
        if (S.cat.gold > 0 || p.age >= 1) { if (this.campFor(S, 'gold', 'gold', 'mining') && act()) return; }
        if (S.cat.stone > 0) { if (this.campFor(S, 'stone', 'stone', 'mining') && act()) return; }
      }
    }
    // farms: ensure enough
    const farms = G.buildings.filter((b) => b.owner === p.id && b.type === 'farm' && !b.dead);
    const foodV = S.cat.food;
    const berriesLeft = G.resources.some((r) => !r.dead && r.type === 'berries' && r.amount > 0 && this.distToDrop(S, r, 'food') < 7);
    if (!berriesLeft || foodV > 6) {
      const freeSlots = farms.reduce((a, f) => a + Math.max(0, 5 - f.farmers.length), 0);
      if (freeSlots < 2 && farms.length < 14 && (p.res.wood >= 60) && (nV >= 8)) {
        const idle = S.vills.find((v) => v.state === 'idle' && !v.garrisoned) || pick(S.vills.filter((v) => this.catOf(v) === 'food' || v.state === 'idle'));
        if (idle && this.buildFarm(S, idle) && act()) return;
      }
    }
    // military buildings
    const wantBarracks = nV >= 12 ? 1 : 0;
    const prodTarget = (type) => {
      const base = { barracks: 1, archery: 1, stable: 1, siege: 1, monastery: 1, blacksmith: 1, market: 1, university: 1 }[type] || 1;
      let extra = 0;
      if (nV >= 40) extra += (type === 'barracks' || type === 'archery' || type === 'stable') ? 1 : 0;
      if (nV >= 55 && d.aggression > 1) extra += (type === 'barracks' || type === 'archery') ? 1 : 0;
      return base + extra;
    };
    const want = [];
    if (nV >= 16 || (p.age >= 1 && nV >= 12)) want.push('barracks');
    if (p.age >= 1 && nV >= 16) want.push('archery', 'blacksmith');
    if (p.age >= 1 && nV >= 20) want.push('stable');
    if (p.age >= 1 && nV >= 22 && (d.aggression >= 0.8 || p.res.gold > 700 || p.res.stone > 450)) want.push('market');
    if (p.age >= 2) want.unshift('siege');
    if (p.age >= 2) want.push('monastery', 'university');
    // age requirement: make sure feudal->castle buildings exist
    if (p.age === 1 && nV >= 24) { for (const t of ['stable', 'blacksmith', 'archery', 'market']) if (!want.includes(t)) want.push(t); }
    for (const type of want) {
      if (this.total(S, type) >= prodTarget(type)) continue;
      if (BUILDINGS[type].age > p.age) continue;
      if (!this.can(bldCost(p, type))) continue;
      const spot = this.findSpot(type, tc.x, tc.y, 6, 20, { sample: true, towardEnemy: true });
      if (this.tryBuild(S, type, spot, 2, tc) && act()) return;
    }
    // castle (hard) and extra production once rich
    if (p.age >= 2 && d.aggression >= 1 && this.total(S, 'castle') < 1 && p.res.stone >= 650 + (p.civ === 'franks' ? -160 : 0) && nV >= 40) {
      const cost = bldCost(p, 'castle');
      if (this.can(cost)) { const spot = this.findSpot('castle', tc.x, tc.y, 8, 22, { sample: true, towardEnemy: true }); if (this.tryBuild(S, 'castle', spot, 3, tc) && act()) return; }
    }
    // towers (small number) when rich in stone
    if (p.age >= 1 && d.aggression >= 0.8 && p.res.stone > 250 && (S.blds.tower || []).length + (S.unbuilt.tower || []).length < (this.threatT > 0 ? 3 : 2)) {
      const spot = this.findSpot('tower', tc.x, tc.y, 7, 16, { sample: true, towardEnemy: true });
      if (this.tryBuild(S, 'tower', spot, 1, tc) && act()) return;
    }
    // more houses when floating wood
    if (p.res.wood > 400 && p.popCap < POP_MAX && p.popCap - p.pop < 20 && house < 3) {
      const spot = this.findSpot('house', tc.x, tc.y, 5, 18, { sample: true, awayFromEnemy: true });
      if (this.tryBuild(S, 'house', spot, 1, tc) && act()) return;
    }
  }

  // ----- research ---------------------------------------------------------------------------------------------------
  research(S) {
    const p = this.p, d = this.d;
    const nV = S.vills.length;
    const tryTech = (bType, techId, minV = 0) => {
      if (nV < minV) return false;
      const list = S.blds[bType]; if (!list) return false;
      const b = list.find((x) => x.queue.length === 0) || null;
      if (!b) return false;
      if (!b.def.techs.includes(techId)) return false;
      const av = techAvailable(p, techId);
      if (!av.ok) return false;
      if (Math.random() > d.upgrades) return false;
      // keep reserve for age up
      if (this.agePending && TECHS[techId].cost.food > 0 && p.res.food - TECHS[techId].cost.food < (AGE_COST[p.age + 1] || {}).food * 0.6) return false;
      return cmdResearch(b, techId);
    };
    const eco = [
      ['towncenter', 'loom', 10], ['lumber', 'doublebit', 14], ['mill', 'horsecollar', 14], ['towncenter', 'wheelbarrow', 24],
      ['mining', 'goldmining', 18], ['lumber', 'bowsaw', 28], ['mill', 'heavyplow', 28], ['mining', 'goldshaft', 30], ['towncenter', 'handcart', 34],
      ['mining', 'stonemining', 24], ['lumber', 'twoman', 40], ['mill', 'cropnrotation', 40], ['university', 'treadmill', 30],
    ];
    for (const [b, t, mv] of eco) if (tryTech(b, t, mv)) break;
    if (p.age < 1) return;
    // military upgrades
    const hasInf = S.army.some((u) => u.def.tags.includes('infantry')), hasArch = S.army.some((u) => u.def.tags.includes('archer')), hasCav = S.army.some((u) => u.def.tags.includes('cavalry'));
    const mil = [];
    if (hasInf || S.army.length > 6) mil.push(['blacksmith', 'forging'], ['blacksmith', 'scalemail'], ['barracks', 'manatarms'], ['blacksmith', 'ironcasting'], ['blacksmith', 'chainmail'], ['barracks', 'longsword'], ['barracks', 'pikeman'], ['blacksmith', 'blastfurnace'], ['blacksmith', 'platemail'], ['barracks', 'twohand'], ['barracks', 'halberdier'], ['barracks', 'champion']);
    if (hasArch || S.army.length > 6) mil.push(['blacksmith', 'fletching'], ['blacksmith', 'paddedarcher'], ['archery', 'xbow'], ['blacksmith', 'bodkin'], ['blacksmith', 'leatherarcher'], ['archery', 'eliteskirm'], ['blacksmith', 'bracer'], ['archery', 'arbalester'], ['blacksmith', 'ringarcher'], ['archery', 'thumbring']);
    if (hasCav || S.army.length > 6) mil.push(['blacksmith', 'scalebarding'], ['stable', 'bloodlines'], ['stable', 'husbandry'], ['blacksmith', 'chainbarding'], ['stable', 'cavalier'], ['blacksmith', 'platebarding'], ['stable', 'paladin']);
    mil.push(['university', 'masonry'], ['monastery', 'fervor'], ['monastery', 'sanctity'], ['castle', 'eliteuu'], ['siege', 'cappedram'], ['siege', 'onager'], ['university', 'chemistry'], ['university', 'architecture'], ['stable', 'hussar'], ['stable', 'lightcav']);
    let tries = 0;
    for (const [b, t] of mil) { if (tries++ > 14) break; if (tryTech(b, t, 18)) break; }
  }

  // ----- age up ------------------------------------------------------------------------------------------------------------
  ageUp(S) {
    const p = this.p, d = this.d;
    this.agePending = false;
    if (p.age >= 3) return;
    const next = p.age + 1;
    const nV = S.vills.length;
    const needV = [0, 19, 32, 46][next] * (d.name === 'Easy' ? 1.3 : d.name === 'Hard' ? 0.85 : 1);
    if (nV < needV) return;
    if (this.t < [0, 130, 380, 720][next] * (d.name === 'Hard' ? 0.75 : 1)) return;
    if (!ageReqMet(p, next)) return;
    this.agePending = true;
    const techId = ['', 'feudal', 'castle', 'imperial'][next];
    const tc = S.tcs.find((t) => !t.queue.some((q) => q.kind === 'tech' && TECHS[q.id].toAge));
    if (!tc) return;
    if (techAvailable(p, techId).ok && canAfford(p, TECHS[techId].cost)) {
      // let existing queue drain: cancel villager queue to prioritise?
      if (tc.queue.length > 1) { while (tc.queue.length > 1) cmdCancel(tc, tc.queue.length - 1); }
      cmdResearch(tc, techId);
    }
  }

  // ----- training ---------------------------------------------------------------------------------------------------------------
  enemyComp(S) {
    let cav = 0, arch = 0, inf = 0, siege = 0, tot = 0;
    for (const e of S.enemyMil) {
      tot++;
      const t = e.def.tags;
      if (t.includes('archer')) arch++; else if (t.includes('cavalry')) cav++; else if (t.includes('siege')) siege++; else inf++;
    }
    tot = Math.max(1, tot);
    return { cav: cav / tot, arch: arch / tot, inf: inf / tot, siege: siege / tot, n: tot };
  }
  pickUnit(S, btype, ec) {
    const p = this.p, age = p.age;
    const R = Math.random();
    switch (btype) {
      case 'barracks':
        if (age === 0) return 'militia';
        if (ec.cav > 0.3 && R < 0.7) return 'spearman';
        if (age >= 2 && R < 0.35) return 'spearman';
        return R < 0.45 ? 'militia' : 'spearman';
      case 'archery':
        if (age >= 2 && R < 0.25) return 'cavarcher';
        if (ec.arch > 0.35 && R < 0.5) return 'skirm';
        return R < 0.8 ? 'archer' : 'skirm';
      case 'stable':
        if (age < 2) return S.scouts.length < 1 ? 'scout' : (R < 0.2 ? 'scout' : null);
        if (ec.arch > 0.4 || R < 0.8) return 'knight';
        return 'scout';
      case 'siege': {
        const rams = S.army.filter((u) => u.def.tags.includes('ram')).length, mang = S.army.filter((u) => u.type === 'mangonel' || u.type === 'onager').length;
        if (S.armyPop < 12) return null;
        if (rams < Math.min(10, 2 + Math.floor(S.armyPop / 14))) return 'ram';
        if (mang < 2 + Math.floor(S.armyPop / 30) && this.d.aggression >= 0.8) return 'mangonel';
        return null;
      }
      case 'monastery': {
        const monks = S.monks.length;
        return monks < (this.d.aggression >= 1 ? 5 : 2) && S.armyPop >= 10 ? 'monk' : null;
      }
      case 'castle': {
        const uu = S.army.filter((u) => u.def.tags.includes('uu')).length;
        if (p.age >= 3 && this.d.aggression >= 1 && S.army.filter((u) => u.type === 'trebuchet').length < 2 && S.armyPop > 30 && R < 0.12) return 'trebuchet';
        return uu < 40 ? 'UU' : null;
      }
    }
    return null;
  }
  training(S) {
    const p = this.p, d = this.d;
    const nV = S.vills.length;
    const ec = this.enemyComp(S);
    // soft cap on army: keep economy growing first
    const vTarget = Math.min(d.villagers, 20 + p.age * 12);
    const threatened = this.threat && G.time - this.threatT < 20;
    const earlyEco = (nV < vTarget * 0.7 || (p.age === 0 && nV < 15)) && p.age < 2 && !threatened;
    const armyCap = Math.max(10, POP_MAX - Math.min(nV, d.villagers) - 10);
    if (S.armyPop >= armyCap) return;
    // Save up for the next age only when we are close to affording it and already have a basic army
    let reserve = { food: 0, gold: 0 };
    if (this.agePending) {
      const ac = AGE_COST[p.age + 1] || {};
      const near = p.res.food >= (ac.food || 0) * 0.5 && p.res.gold >= (ac.gold || 0) * 0.5;
      if (this.pendingSince == null) this.pendingSince = this.t;
      const patient = this.t - this.pendingSince < 140;
      if (near && patient && S.armyPop >= 8 + 4 * p.age) reserve = { food: ac.food || 0, gold: ac.gold || 0 };
    } else this.pendingSince = null;
    const types = ['siege', 'castle', 'barracks', 'stable', 'archery', 'monastery'];
    for (const bt of types) {
      for (const b of S.blds[bt] || []) {
        if (b.queue.length >= 2) continue;
        if (earlyEco && bt !== 'barracks') continue;
        if (earlyEco && S.armyPop > 4) continue;
        const id = this.pickUnit(S, bt, ec);
        if (!id) continue;
        if (!unitAvailableAt(p, b, id)) continue;
        const def = UNITS[resolveUnit(p, id === 'UU' ? p.civDef.uu : id)];
        const c = def.cost;
        if (p.res.food - (c.food || 0) < reserve.food || p.res.gold - (c.gold || 0) < reserve.gold) continue;
        if (p.pop + def.pop > p.popCap) continue;
        cmdTrain(b, id, 1);
        if (!b.rally && this.rallyPt) cmdRally(b, this.rallyPt.x, this.rallyPt.y);
      }
    }
  }

  // ----- military -----------------------------------------------------------------------------------------------------------------
  armyStrength(units) {
    let s = 0;
    for (const u of units) s += (u.hp / 30) * ((u.stats.atkM + u.stats.atkP) / 5 + 0.5) * (u.def.tags.includes('siege') ? 0.3 : 1);
    return s;
  }
  military(S, tc) {
    const p = this.p, d = this.d;
    const eb = this.enemyBase();
    const rp = this.rallyPt;
    const threatActive = this.threat && G.time - this.threatT < 5;
    // idle units gather at rally
    for (const u of S.army.concat(S.monks)) {
      if (u.state !== 'idle' || u.garrisoned) continue;
      if (this.wave && this.wave.ids.has(u.id)) continue;
      if (rp && Math.hypot(u.x - rp.x, u.y - rp.y) > 7) orderMove(u, rp.x + (Math.random() - 0.5) * 4, rp.y + (Math.random() - 0.5) * 4);
    }
    // existing wave management
    if (this.wave) {
      const w = this.wave;
      const alive = S.army.filter((u) => w.ids.has(u.id));
      w.ids = new Set(alive.map((u) => u.id));
      const str = this.armyStrength(alive);
      if (alive.length < 3 || str < w.startStr * 0.3) {
        // retreat
        for (const u of alive) orderMove(u, rp.x + (Math.random() - 0.5) * 4, rp.y + (Math.random() - 0.5) * 4);
        this.wave = null; this.lastWaveEnd = this.t;
        return;
      }
      // reinforce: add idle units near rally when many
      const fresh = S.army.filter((u) => !w.ids.has(u.id) && u.state === 'idle' && rp && Math.hypot(u.x - rp.x, u.y - rp.y) < 12);
      if (fresh.length >= 6) for (const u of fresh) w.ids.add(u.id);
      // target management
      const live = S.eb.filter((b) => !b.def.tags.includes('wall') || true);
      let cx = 0, cy = 0;
      for (const u of alive) { cx += u.x; cy += u.y; } cx /= alive.length; cy /= alive.length;
      const cands = live.filter((b) => b.type !== 'farm').map((b) => ({ b, d: Math.hypot(ecx(b) - cx, ecy(b) - cy) + (b.def.tags.includes('wall') ? 30 : 0) })).sort((p1, p2) => p1.d - p2.d);
      const reach = (b) => {
        const cache = this.reachCache || (this.reachCache = {});
        const e = cache[b.id];
        if (e && this.t - e.t < 90) return e.ok;
        const r = G.map.findPath(cx, cy, b.x, b.y, b.x + b.size, b.y + b.size, 1.2, this.p.id, 20000);
        cache[b.id] = { ok: !r.partial, t: this.t };
        return !r.partial;
      };
      const target = (u, rams) => {
        let checked = 0;
        for (const c of cands) {
          if (c.b.def.tags.includes('wall') && !rams) continue;
          if (checked++ > 8) break;
          if (reach(c.b)) return c.b;
        }
        return null;
      };
      // nothing reachable? hack a corridor through the forest toward the nearest target
      if (!target(alive[0], false) && this.t > (w.nextClear || 0) && cands.length) {
        w.nextClear = this.t + 25;
        const tb = cands.find((c) => !c.b.def.tags.includes('wall'));
        if (tb) {
          const b = tb.b;
          const r = G.map.findPath(cx, cy, b.x, b.y, b.x + b.size, b.y + b.size, 1.2, this.p.id, 40000, true);
          const trees = [];
          for (const pt of r.path) {
            const tx = Math.floor(pt[0]), ty = Math.floor(pt[1]);
            if (G.map.tree[ty * G.map.w + tx]) { const e = G.byId.get(G.map.occ[ty * G.map.w + tx]); if (e && e.type === 'tree' && !e.dead) trees.push(e); }
            if (trees.length >= 8) break;
          }
          if (trees.length) {
            const choppers = alive.filter((u) => !u.def.tags.includes('ram') && !u.def.look.mount && u.stats.range <= 1.5 && !u.def.tags.includes('siege'));
            if (choppers.length) {
              trees.forEach((tr, i) => {
                const pool = choppers.slice().sort((p1, p2) => Math.hypot(p1.x - tr.x, p1.y - tr.y) - Math.hypot(p2.x - tr.x, p2.y - tr.y)).slice(0, 4);
                for (const u of pool) if (u.state !== 'chop') orderChop(u, tr, trees.slice(i + 1));
              });
              this.reachCache = {};
            }
          }
        }
      }
      for (const u of alive) {
        const isRam = u.def.tags.includes('ram');
        const stale = this.t > (w.nextRetarget || 0) && (u.state === 'amove' || u.state === 'move');
        if (u.state === 'idle' || stale || (isRam && (!u.target || u.target.dead) && u.state !== 'attack')) {
          const tb = target(u, isRam);
          if (tb) {
            // with no defenders around the target, attack the building directly (reliable adjacency pathing)
            const guarded = S.enemyMil.some((e) => Math.hypot(e.x - ecx(tb), e.y - ecy(tb)) < 12);
            if (isRam || u.type === 'trebuchet' || !guarded) orderAttack(u, tb); else orderAMove(u, ecx(tb), ecy(tb));
          }
          else {
            // chase down remaining enemy units
            let bu = null, bdd = 1e9;
            for (const e of S.enemyAll) { const dd = Math.hypot(e.x - u.x, e.y - u.y); if (dd < bdd) { bdd = dd; bu = e; } }
            if (bu) orderAMove(u, bu.x, bu.y);
          }
        }
      }
      if (this.t > (w.nextRetarget || 0)) w.nextRetarget = this.t + 35;
      // monks: convert nearby enemies
      if (d.aggression >= 0.8) for (const m of S.monks) {
        if (m.state !== 'idle' && m.state !== 'move') continue;
        let bu = null, bdd = 12;
        for (const e of S.enemyMil) { if (e.def.tags.includes('siege') && false) continue; const dd = Math.hypot(e.x - m.x, e.y - m.y); if (dd < bdd && !e.garrisoned) { bdd = dd; bu = e; } }
        if (bu) orderConvert(m, bu); else orderMove(m, cx, cy);
      }
      return;
    }
    if (threatActive) return;
    // launch new wave?
    const sinceEnd = this.t - this.lastWaveEnd;
    const need = Math.min(70, Math.round((d.waveMin + this.waves * 5) * (1.1 - 0.1 * d.aggression)));
    const readyUnits = S.army.filter((u) => u.state === 'idle' && !u.garrisoned && rp && Math.hypot(u.x - rp.x, u.y - rp.y) < 14);
    const pop = readyUnits.reduce((a, u) => a + u.def.pop, 0);
    const timeOk = this.t > d.firstAttack * (this.waves === 0 ? 1 : 0.5) - (this.waves === 0 ? 0 : 0) || pop >= need + 14;
    const mopUp = S.enemyMil.length < 4 && pop >= 8 && S.eb.some((b) => !b.def.tags.includes('wall') && b.type !== 'farm');
    if ((pop >= need && timeOk && sinceEnd > 30 && S.enemyMil.length < pop * 2.2 + 10) || (mopUp && sinceEnd > 10)) {
      const ids = new Set(readyUnits.map((u) => u.id));
      for (const m of S.monks) if (m.state === 'idle') ids.add(m.id);
      this.wave = { ids, startStr: this.armyStrength(readyUnits), t0: this.t };
      this.waves++;
      const first = S.eb.filter((b) => !b.def.tags.includes('wall')).sort((a, b) => Math.hypot(ecx(a) - rp.x, ecy(a) - rp.y) - Math.hypot(ecx(b) - rp.x, ecy(b) - rp.y))[0];
      const tx = first ? ecx(first) : eb.x, ty = first ? ecy(first) : eb.y;
      for (const u of readyUnits) {
        if (u.def.tags.includes('ram') && first) orderAttack(u, first); else orderAMove(u, tx + (Math.random() - 0.5) * 3, ty + (Math.random() - 0.5) * 3);
      }
      for (const m of S.monks) if (ids.has(m.id)) orderMove(m, rp.x, rp.y);
      if (G.me === this.enemy && !G.observer) notify(G.me, `An enemy army is approaching!`, tx, ty, 'attack');
    }
  }

  scouting(S) {
    this.scoutT -= this.d.think;
    if (this.scoutT > 0) return;
    this.scoutT = 12;
    for (const s of S.scouts) {
      if (s.state === 'idle') {
        const m = G.map;
        const x = 6 + Math.random() * (m.w - 12), y = 6 + Math.random() * (m.h - 12);
        const f = m.findFreeNear(x, y, 6, this.p.id);
        if (f) orderMove(s, f[0], f[1]);
      }
    }
  }
}
