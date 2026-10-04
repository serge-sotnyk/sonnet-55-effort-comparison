'use strict';
// ---------------------------------------------------------------------------
// UI: input, selection, commands, HUD, command card, tooltips
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const KEYS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', 'Z', 'X', 'C', 'V', 'B'];
let RES_ICON = {};

const UI = {
  mouse: { x: 0, y: 0, in: false, wx: 0, wy: 0 },
  keys: {}, drag: null, panning: null, page: 'main', mode: null, ghost: null,
  lastClick: { t: 0, type: null }, card: [], cardSig: '', infoHtml: '', hudT: 0, hovCard: -1,
  alertSeen: 0, selSig: '', deleteArm: 0, lastGroupKey: null, lastGroupT: 0,

  init() {
    for (const k of RES) RES_ICON[k] = glyphIcon(k, '#5a4128', '#2a1c10');
    RES_ICON.pop = glyphIcon('villager', '#5a4128', '#2a1c10');
    for (const k of RES) $('res-' + k).querySelector('img').src = RES_ICON[k];
    $('res-pop').querySelector('img').src = RES_ICON.pop;
    $('btn-idlev').querySelector('img').src = unitIcon('villager', 0);
    $('btn-idlem').querySelector('img').src = unitIcon('militia', 0);
    const cv = $('view');
    cv.addEventListener('mousedown', (e) => this.onDown(e));
    window.addEventListener('mouseup', (e) => this.onUp(e));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.onWheel(e); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    $('minimap').addEventListener('contextmenu', (e) => e.preventDefault());
    $('minimap').addEventListener('mousedown', (e) => this.onMini(e));
    $('minimap').addEventListener('mousemove', (e) => { if (e.buttons & 1) this.onMini(e); });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('mouseleave', () => { this.mouse.in = false; });
    // command card events (delegated)
    const cmd = $('cmd');
    cmd.addEventListener('mousedown', (e) => {
      const b = e.target.closest('.cbtn'); if (!b) return;
      e.preventDefault();
      this.pressSlot(+b.dataset.slot, e.shiftKey || e.ctrlKey);
    });
    cmd.addEventListener('mouseover', (e) => { const b = e.target.closest('.cbtn'); if (b) { this.hovCard = +b.dataset.slot; this.showTip(this.hovCard); } });
    cmd.addEventListener('mouseout', (e) => { const b = e.target.closest('.cbtn'); if (b) { this.hovCard = -1; $('tooltip').style.display = 'none'; } });
    cmd.addEventListener('mousemove', (e) => this.moveTip(e));
    $('info').addEventListener('mousedown', (e) => this.onInfoClick(e));
    // top buttons
    $('btn-idlev').onclick = () => this.cycleIdle(true);
    $('btn-idlem').onclick = () => this.cycleIdle(false);
    $('btn-speed').onclick = () => this.cycleSpeed(1);
    $('btn-sound').onclick = () => this.toggleSound();
    $('btn-help').onclick = () => showOverlay('help', true);
    $('btn-menu').onclick = () => togglePause();
    for (const id of ['btn-idlev', 'btn-idlem', 'btn-speed', 'btn-sound', 'btn-help', 'btn-menu']) $(id).addEventListener('mousedown', () => SFX.init());
    window.addEventListener('resize', () => resizeRender());
  },

  banner(main, sub) {
    const b = $('banner');
    b.innerHTML = `<span class="b-main">${main}</span>${sub ? `<span class="b-sub">${sub}</span>` : ''}`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  },
  // contextual first-timer tips
  advisor(dt) {
    if (G.observer || G.demo) return;
    const A = this.adv || (this.adv = { done: new Set(), t: 0 });
    A.t -= dt; if (A.t > 0) return; A.t = 1.5;
    const p = G.players[G.me];
    const tip = (id, msg) => { if (A.done.has(id)) return false; A.done.add(id); notify(G.me, msg, null, null, 'tip'); return true; };
    const mine = G.buildings.filter((b) => b.owner === G.me && !b.dead);
    const has = (t) => mine.some((b) => b.type === t);
    const hasB = (t) => mine.some((b) => b.type === t && b.built);
    const vills = G.units.filter((u) => u.owner === G.me && !u.dead && u.def.tags.includes('villager'));
    const idleV = vills.filter((v) => v.state === 'idle' && !v.garrisoned).length;
    if (G.time > 4 && tip('start', 'Your villagers are already gathering. Select the Town Center and press Q to train more villagers (Shift+Q queues 5).')) return;
    if (p.pop >= p.popCap - 2 && !mine.some((b) => b.type === 'house' && !b.built) && p.popCap < POP_MAX && G.time > 20 && tip('house', 'Population cap almost reached — select villagers, press Q (Economic), then Q (House).')) return;
    if (G.time > 60 && !has('mill') && p.age === 0 && tip('mill', 'Build a Mill beside the berry bushes and Lumber Camp near forests to shorten walking trips.')) return;
    if (idleV >= 3 && G.time > 40 && tip('idle', 'You have idle villagers — press . (period) to jump to them, then right-click a resource.')) return;
    if (p.age === 0 && G.time > 120 && p.res.food >= 500 && tip('age', 'You can afford the Feudal Age! Build two different buildings (House, Mill, Lumber Camp…) then research it at the Town Center.')) return;
    if (p.age === 1 && !has('archery') && !has('stable') && !has('blacksmith') && G.time > 200 && tip('feudal', 'Feudal Age unlocked: build an Archery Range, Stable, Blacksmith or Market. Two of them let you reach the Castle Age.')) return;
    if (p.age === 0 && vills.length >= 12 && !has('barracks') && G.time > 150 && tip('barracks', 'Build a Barracks to train soldiers. The enemy will attack eventually!')) return;
    if (G.time > 90 && !A.done.has('enemy') && G.units.some((u) => u.owner !== G.me && u.owner >= 0 && !u.dead && tileVisible(u.x, u.y) && isMilitary(u))) { tip('enemy', 'Enemy soldiers spotted! Garrison villagers in the Town Center (Town Bell) if you are not ready.'); return; }
    if (p.age >= 2 && !A.done.has('siege') && has('siege') === false && G.time > 300 && tip('siege', 'Rams and Trebuchets are the way to crush buildings. Build a Siege Workshop in the Castle Age.')) return;
  },
  reset() {
    this.adv = null; $('banner').classList.remove('show');
    this.mode = null; this.ghost = null; this.page = 'main'; this.drag = null; this.cardSig = ''; this.infoHtml = ''; this.alertSeen = 0;
    $('alerts').innerHTML = ''; $('hint').style.display = 'none'; document.body.className = '';
    this.selSig = '';
  },

  // ------------------------------------------------------------------ selection
  setSel(list) {
    const prevType = G.sel.length ? G.sel[0].kind + G.sel[0].type : '';
    G.sel = list.filter((e) => !e.dead);
    const t = G.sel.length ? G.sel[0].kind + G.sel[0].type : '';
    if (!(G.sel.length && G.sel.every((e) => e.owner === G.me && e.kind === 'unit' && e.def.tags.includes('villager')))) this.page = 'main';
    if (t !== prevType) this.page = 'main';
    this.cancelMode();
    G.selVer++;
    if (G.sel.length && G.sel[0].owner === G.me && !G.observer) SFX.play('select');
  },
  cancelMode() { this.mode = null; this.ghost = null; document.body.classList.remove('cur-attack', 'cur-place'); $('hint').style.display = 'none'; },
  setHint(t) { const h = $('hint'); if (t) { h.textContent = t; h.style.display = 'block'; } else h.style.display = 'none'; },

  // ------------------------------------------------------------------ picking
  pickAt(sx, sy) {
    const z = R.cam.zoom, m = G.map, N = m.w;
    let best = null, bd = -1e9;
    const consider = (e, depth) => { if (depth > bd) { bd = depth; best = e; } };
    for (const u of G.units) {
      if (u.dead || u.garrisoned) continue;
      if (u.owner !== G.me && !G.observer && m.vis[Math.floor(u.y) * N + Math.floor(u.x)] !== 2) continue;
      const ux = w2sx(u.x, u.y), uy = w2sy(u.x, u.y);
      const mount = u.def.look.mount;
      const big = mount === 'ram' || mount === 'mangonel' || mount === 'treb';
      const hw = (big ? 24 : mount ? 15 : 10) * z, ht = (big ? 34 : mount ? 40 : 38) * z;
      if (sx >= ux - hw && sx <= ux + hw && sy >= uy - ht && sy <= uy + 6 * z) consider(u, u.x + u.y + 1000);
    }
    for (const b of G.buildings) {
      if (b.dead) continue;
      if (b.owner !== G.me && !G.observer && !b.seenBy.has(G.me)) continue;
      const hh = b.type === 'farm' ? 0 : b.def.height * 0.85;
      for (let zz = 0; zz <= hh; zz += 10) {
        const w = screenToWorld(sx, sy + zz * z);
        if (w.x >= b.x && w.x <= b.x + b.size && w.y >= b.y && w.y <= b.y + b.size) { consider(b, b.x + b.size / 2 + b.y + b.size / 2 + (b.type === 'farm' ? -500 : 0)); break; }
      }
    }
    for (const r of G.resources) {
      if (r.dead) continue;
      if (!G.observer && m.vis[Math.floor(r.y) * N + Math.floor(r.x)] === 0) continue;
      if (r.animal && !G.observer && m.vis[Math.floor(r.y) * N + Math.floor(r.x)] !== 2) continue;
      const rx = w2sx(r.x, r.y), ry = w2sy(r.x, r.y);
      const hw = (r.type === 'tree' ? 14 : r.animal ? 14 : 18) * z, ht = (r.type === 'tree' ? 56 : r.animal ? 28 : 28) * z;
      if (sx >= rx - hw && sx <= rx + hw && sy >= ry - ht && sy <= ry + 6 * z) consider(r, r.x + r.y);
    }
    return best;
  },

  // ------------------------------------------------------------------ mouse
  canvasPos(e) { const r = $('view').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; },
  onDown(e) {
    SFX.init();
    if (G.over && G.observerLocked) return;
    const p = this.canvasPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    if (e.button === 1) { this.panning = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y }; e.preventDefault(); return; }
    let btn = e.button;
    if (btn === 0 && e.ctrlKey && /Mac/i.test(navigator.platform || '')) btn = 2; // ctrl+click is a right click on macOS
    if (btn === 0) {
      if (this.mode) { this.clickMode(p, e); return; }
      this.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, active: false, shift: e.shiftKey || e.ctrlKey };
    } else if (btn === 2) {
      if (this.mode) { this.cancelMode(); SFX.play('click'); return; }
      this.rightClick(p, e.shiftKey);
    }
  },
  onMove(e) {
    const p = this.canvasPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    const r = $('view').getBoundingClientRect();
    this.mouse.in = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom + 2 && e.target === $('view');
    if (this.panning) {
      R.cam.x = this.panning.cx - (e.clientX - this.panning.x) / R.cam.zoom; R.cam.y = this.panning.cy - (e.clientY - this.panning.y) / R.cam.zoom; clampCam();
    }
    if (this.drag) {
      this.drag.x1 = p.x; this.drag.y1 = p.y;
      if (Math.hypot(this.drag.x1 - this.drag.x0, this.drag.y1 - this.drag.y0) > 5) this.drag.active = true;
    }
  },
  onUp(e) {
    if (e.button === 1) { this.panning = null; return; }
    if (e.button !== 0 || !this.drag) return;
    const d = this.drag; this.drag = null;
    if (d.active) this.boxSelect(d);
    else this.clickSelect(d.x0, d.y0, d.shift, e);
  },
  onWheel(e) {
    const p = this.canvasPos(e);
    const before = screenToWorld(p.x, p.y);
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    R.cam.zoom = clamp(R.cam.zoom * Math.exp(-clamp(dy, -400, 400) * 0.0011), 0.5, 1.8);
    // keep world point under cursor
    const after = screenToWorld(p.x, p.y);
    R.cam.x += ((before.x - before.y) - (after.x - after.y)) * TW2;
    R.cam.y += ((before.x + before.y) - (after.x + after.y)) * TH2;
    clampCam();
  },
  onMini(e) {
    SFX.init();
    const r = $('minimap').getBoundingClientRect();
    const w = minimapToWorld(e.clientX - r.left, e.clientY - r.top);
    if (e.button === 2 && e.type === 'mousedown') { this.commandAt(w.x, w.y, null, e.shiftKey); return; }
    if (e.button === 0 || (e.buttons & 1)) {
      if (this.mode && this.mode.t === 'amove') { this.commandAt(w.x, w.y, null, false, true); this.cancelMode(); return; }
      centerCamOn(w.x, w.y);
    }
  },

  clickSelect(sx, sy, additive, e) {
    const ent = this.pickAt(sx, sy);
    const now = performance.now();
    if (!ent) { if (!additive) this.setSel([]); this.lastClick = { t: now, type: null }; return; }
    if (ent.kind === 'unit' && ent.owner === G.me) {
      // double click: select all of same type on screen
      if (now - this.lastClick.t < 380 && this.lastClick.type === ent.type) {
        const same = G.units.filter((u) => !u.dead && !u.garrisoned && u.owner === G.me && u.type === ent.type && this.onScreen(u.x, u.y));
        this.setSel(same); this.lastClick = { t: 0, type: null }; return;
      }
      if (additive) {
        const i = G.sel.indexOf(ent);
        const cur = G.sel.filter((s) => s.kind === 'unit' && s.owner === G.me);
        if (i >= 0) { cur.splice(cur.indexOf(ent), 1); this.setSel(cur); } else this.setSel(cur.concat([ent]));
      } else this.setSel([ent]);
      this.lastClick = { t: now, type: ent.type };
      return;
    }
    this.lastClick = { t: now, type: ent.type };
    this.setSel([ent]);
  },
  onScreen(x, y) { const sx = w2sx(x, y), sy = w2sy(x, y); return sx >= 0 && sx <= R.vw && sy >= 0 && sy <= R.vh; },
  boxSelect(d) {
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    const z = R.cam.zoom;
    const hits = [];
    for (const u of G.units) {
      if (u.dead || u.garrisoned || (u.owner !== G.me && !G.observer)) continue;
      const sx = w2sx(u.x, u.y), sy = w2sy(u.x, u.y) - 14 * z;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) hits.push(u);
    }
    if (!hits.length) { if (!d.shift) { /* maybe building under box */ } return; }
    // prefer military over villagers? keep all
    if (d.shift) {
      const cur = G.sel.filter((s) => s.kind === 'unit' && s.owner === G.me);
      for (const h of hits) if (!cur.includes(h)) cur.push(h);
      this.setSel(cur);
    } else this.setSel(hits);
  },

  // ------------------------------------------------------------------ commands
  rightClick(p, shift) {
    if (G.observer) return;
    const w = screenToWorld(p.x, p.y);
    const target = this.pickAt(p.x, p.y);
    this.commandAt(w.x, w.y, target, shift);
  },
  commandAt(wx, wy, target, shift, attackMove) {
    const sel = G.sel.filter((e) => e.owner === G.me);
    if (!sel.length) return;
    const first = sel[0];
    wx = clamp(wx, 0.5, G.map.w - 0.5); wy = clamp(wy, 0.5, G.map.h - 0.5);
    if (first.kind === 'building') {
      if (!first.def.trains.length && !first.def.techs.length) return;
      // rally point
      let tgt = null;
      if (target && (target.kind === 'res' || (target.kind === 'building' && target.owner === G.me))) tgt = target;
      cmdRally(first, tgt && tgt.kind === 'building' ? ecx(tgt) : tgt ? tgt.x : wx, tgt && tgt.kind === 'building' ? ecy(tgt) : tgt ? tgt.y : wy, tgt);
      SFX.play('order'); fxRing(first.rally.x, first.rally.y, '#fff', 0.8);
      return;
    }
    const units = sel.filter((e) => e.kind === 'unit');
    if (!units.length) return;
    let did = false;
    const me = G.me;
    const queued = shift;
    if (attackMove) {
      this.issueGroupMove(units, wx, wy, queued, true); SFX.play('order'); fxRing(wx, wy, '#ff6a5a', 0.9); return;
    }
    if (target && target.kind === 'unit' && target.owner !== me && target.owner >= 0) {
      for (const u of units) {
        if (u.def.tags.includes('monk')) giveOrder(u, { t: 'convert', target }, queued);
        else if (isCombatant(u)) { if (u.def.buildingsOnly) giveOrder(u, { t: 'move', x: wx, y: wy }, queued); else giveOrder(u, { t: 'attack', target }, queued); }
        else giveOrder(u, { t: 'move', x: wx, y: wy }, queued);
      }
      fxRing(target.x, target.y, '#ff4030', 0.7); SFX.play('order'); return;
    }
    if (target && target.kind === 'building' && target.owner !== me && target.owner >= 0) {
      for (const u of units) {
        if (u.def.tags.includes('monk')) giveOrder(u, { t: 'move', x: wx, y: wy }, queued);
        else if (isCombatant(u)) giveOrder(u, { t: 'attack', target }, queued);
        else giveOrder(u, { t: 'move', x: wx, y: wy }, queued);
      }
      fxRing(ecx(target), ecy(target), '#ff4030', target.size * 0.6); SFX.play('order'); return;
    }
    if (target && target.kind === 'res') {
      if (target.animal && target.type === 'boar' && target.alive) {
        for (const u of units) { if (u.def.tags.includes('villager') || isCombatant(u)) giveOrder(u, { t: 'attack', target }, queued); }
        SFX.play('order'); return;
      }
      for (const u of units) {
        if (u.def.tags.includes('villager') && (target.amount > 0)) giveOrder(u, { t: 'gather', target }, queued);
        else if (target.type === 'tree' && isMilitary(u) && !u.def.tags.includes('siege') && !u.def.look.mount) giveOrder(u, { t: 'chop', target }, queued);
        else giveOrder(u, { t: 'move', x: target.x, y: target.y }, queued);
      }
      fxRing(target.x, target.y, '#ffe27a', 0.7); SFX.play('order'); return;
    }
    if (target && target.kind === 'building' && target.owner === me) {
      const b = target;
      let n = 0;
      for (const u of units) {
        const vill = u.def.tags.includes('villager');
        if (!b.built && vill) { giveOrder(u, { t: 'build', target: b }, queued); n++; }
        else if (b.type === 'farm' && vill && b.built) { giveOrder(u, { t: 'gather', target: b }, queued); n++; }
        else if (b.built && vill && b.hp < b.maxHp && !(b.def.garrison && canGarrison(u, b) && b.type === 'towncenter')) { giveOrder(u, { t: 'repair', target: b }, queued); n++; }
        else if (b.built && canGarrison(u, b)) { giveOrder(u, { t: 'garrison', target: b }, queued); n++; }
        else giveOrder(u, { t: 'move', x: wx, y: wy }, queued);
      }
      fxRing(ecx(b), ecy(b), '#8dff8d', b.size * 0.6); SFX.play('order'); return;
    }
    if (target && target.kind === 'unit' && target.owner === me) {
      for (const u of units) {
        if (u.def.tags.includes('monk') && target.hp < target.maxHp && target !== u) giveOrder(u, { t: 'heal', target }, queued);
        else giveOrder(u, { t: 'move', x: target.x, y: target.y }, queued);
      }
      SFX.play('order'); return;
    }
    this.issueGroupMove(units, wx, wy, queued, false);
    fxRing(wx, wy, '#ffffff', 0.7);
    SFX.play('order');
  },
  issueGroupMove(units, wx, wy, queued, amove) {
    const n = units.length;
    let spots = [];
    if (n === 1) spots = [[wx, wy]];
    else {
      // compact grid sorted by distance from centre
      const cand = [];
      const sp = n > 12 ? 0.8 : 0.9;
      const R2 = Math.ceil(Math.sqrt(n)) + 2;
      for (let gy = -R2; gy <= R2; gy++) for (let gx = -R2; gx <= R2; gx++) cand.push([wx + gx * sp, wy + gy * sp, Math.hypot(gx, gy)]);
      cand.sort((a, b) => a[2] - b[2]);
      for (const c of cand) {
        if (spots.length >= n) break;
        if (!G.map.passableAt(c[0], c[1], G.me)) continue;
        spots.push([c[0], c[1]]);
      }
      while (spots.length < n) spots.push([wx, wy]);
    }
    // assign greedily by distance to reduce crossing
    const order = units.slice().sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy));
    const free = spots.slice();
    let minSp = 99;
    if (n > 1) for (const u of units) minSp = Math.min(minSp, u.stats.speed);
    for (const u of order) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < free.length; i++) { const d = Math.hypot(free[i][0] - u.x, free[i][1] - u.y); if (d < bd) { bd = d; bi = i; } }
      const s = free.splice(bi, 1)[0];
      giveOrder(u, { t: amove ? 'amove' : 'move', x: s[0], y: s[1] }, queued);
      if (n > 1 && !queued) u.moveCap = minSp * 1.02; else if (!queued) u.moveCap = 0;
    }
  },

  // ------------------------------------------------------------------ placement
  enterPlace(type) {
    const p = G.players[G.me];
    const def = BUILDINGS[type];
    if (def.age > p.age) { notify(G.me, `Requires ${AGES[def.age]}.`, null, null, 'warn'); SFX.play('error'); return; }
    this.mode = { t: 'place', type, wallStart: null };
    document.body.classList.add('cur-place');
    this.setHint(WALL_FAMILY.includes(type) && type !== 'gate' ? 'Click start, click end to build a wall · Right-click / Esc to cancel' : 'Click to place · Shift: place several · Right-click / Esc to cancel');
  },
  computeGhost() {
    const m = this.mode;
    if (!m || m.t !== 'place') { this.ghost = null; return; }
    const def = BUILDINGS[m.type], p = G.players[G.me];
    const w = screenToWorld(this.mouse.x, this.mouse.y);
    const tx = Math.round(w.x - def.size / 2), ty = Math.round(w.y - def.size / 2);
    const tiles = [];
    if (m.wallStart && m.type !== 'gate') {
      for (const [x, y] of wallTiles(m.wallStart.x, m.wallStart.y, tx, ty)) tiles.push([x, y]);
    } else tiles.push([tx, ty]);
    let anyBad = false, why = '';
    const ghost = { type: m.type, tiles: [], ok: true, why: '', cost: {} };
    const costOne = bldCost(p, m.type);
    let total = { food: 0, wood: 0, gold: 0, stone: 0 };
    for (const [x, y] of tiles) {
      const chk = canPlace(p, m.type, x, y, true);
      ghost.tiles.push({ x, y, ok: chk.ok });
      if (!chk.ok) { anyBad = true; why = chk.why; }
      else for (const r of RES) total[r] += costOne[r];
    }
    ghost.cost = total; ghost.ok = !anyBad || (tiles.length > 1 && ghost.tiles.some((t) => t.ok)); ghost.why = why;
    ghost.afford = canAfford(p, total);
    this.ghost = ghost;
  },
  clickMode(p, e) {
    const m = this.mode;
    if (m.t === 'amove') {
      const w = screenToWorld(p.x, p.y);
      this.commandAt(w.x, w.y, null, e.shiftKey, true);
      if (!e.shiftKey) this.cancelMode();
      return;
    }
    if (m.t === 'rally') {
      const w = screenToWorld(p.x, p.y);
      const t = this.pickAt(p.x, p.y);
      this.commandAt(w.x, w.y, t, false);
      this.cancelMode(); return;
    }
    if (m.t === 'place') {
      this.computeGhost();
      const g = this.ghost;
      const pl = G.players[G.me];
      const def = BUILDINGS[m.type];
      const isWall = WALL_FAMILY.includes(m.type) && m.type !== 'gate';
      if (isWall && !m.wallStart) {
        if (g.tiles[0].ok) { m.wallStart = { x: g.tiles[0].x, y: g.tiles[0].y }; SFX.play('click'); }
        else { notify(G.me, g.why + '.', null, null, 'warn'); SFX.play('error'); }
        return;
      }
      if (!g.ok) { notify(G.me, (g.why || 'Cannot build here') + '.', null, null, 'warn'); SFX.play('error'); return; }
      if (!g.afford) { notify(G.me, 'Not enough resources.', null, null, 'warn'); SFX.play('error'); return; }
      const builders = G.sel.filter((s) => s.kind === 'unit' && s.owner === G.me && s.def.tags.includes('villager'));
      let idx = 0;
      for (const t of g.tiles) {
        if (!t.ok) continue;
        placeBuilding(pl, m.type, t.x, t.y, builders, e.shiftKey || idx > 0);
        idx++;
      }
      SFX.play('click');
      if (e.shiftKey) { m.wallStart = isWall ? { x: g.tiles[g.tiles.length - 1].x, y: g.tiles[g.tiles.length - 1].y } : null; }
      else this.cancelMode();
    }
  },

  // ------------------------------------------------------------------ keyboard
  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    const k = e.key;
    if (!down) { this.keys[k.toLowerCase()] = false; return; }
    this.keys[k.toLowerCase()] = true;
    SFX.init();
    if (k === 'Escape') { this.onEscape(); e.preventDefault(); return; }
    if (k === 'F1') { showOverlay('help', true); e.preventDefault(); return; }
    if (typeof gameState !== 'undefined' && gameState !== 'playing') return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(k)) e.preventDefault();
    const lk = k.toLowerCase();
    if (lk === 'p') { togglePause(); return; }
    if (G.paused) return;
    if (lk === 'm') { this.toggleSound(true); return; }
    if (k === '+' || k === '=') { this.cycleSpeed(1); return; }
    if (k === '-' || k === '_') { this.cycleSpeed(-1); return; }
    if (k === ' ') { const a = G.lastAlert.pos; if (a) centerCamOn(a.x, a.y); return; }
    if (k === '.') { this.cycleIdle(true); return; }
    if (k === ',') { this.cycleIdle(false); return; }
    if (k === '[') { R.cam.zoom = clamp(R.cam.zoom / 1.1, 0.5, 1.8); return; }
    if (k === ']') { R.cam.zoom = clamp(R.cam.zoom * 1.1, 0.5, 1.8); return; }
    if (G.observer) { if (k === 'Tab') { G.me = 1 - G.me; this.setSel([]); R.fogDirty = true; } return; }
    if (lk === 'h') { const tc = G.buildings.find((b) => b.owner === G.me && b.type === 'towncenter' && !b.dead); if (tc) { this.setSel([tc]); centerCamOn(ecx(tc), ecy(tc)); } return; }
    if (k === 'Delete' || k === 'Backspace') { this.deleteSelected(); e.preventDefault(); return; }
    if (/^[1-9]$/.test(k)) {
      const n = +k;
      if (e.ctrlKey || e.metaKey) { G.groups[n] = G.sel.filter((s) => s.owner === G.me).map((s) => s.id); notify(G.me, `Group ${n} set.`, null, null, 'info'); e.preventDefault(); }
      else {
        const ids = G.groups[n]; if (!ids) return;
        const ents = ids.map((id) => G.byId.get(id)).filter((x) => x && !x.dead && x.owner === G.me);
        if (ents.length) {
          this.setSel(ents);
          const now = performance.now();
          if (this.lastGroupKey === n && now - this.lastGroupT < 400) centerCamOn(ents[0].kind === 'building' ? ecx(ents[0]) : ents[0].x, ents[0].kind === 'building' ? ecy(ents[0]) : ents[0].y);
          this.lastGroupKey = n; this.lastGroupT = now;
        }
        e.preventDefault();
      }
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    const slot = KEYS.indexOf(k.toUpperCase());
    if (slot >= 0 && k.length === 1) { this.pressSlot(slot, e.shiftKey); e.preventDefault(); }
  },
  onEscape() {
    if (!$('help').classList.contains('hidden')) { showOverlay('help', false); return; }
    if (typeof gameState !== 'undefined' && gameState !== 'playing') return;
    if (this.mode) { this.cancelMode(); return; }
    if (this.page !== 'main') { this.page = 'main'; return; }
    if (G.sel.length && !G.paused) { this.setSel([]); return; }
    togglePause();
  },
  deleteSelected() {
    const sel = G.sel.filter((e) => e.owner === G.me);
    if (!sel.length) return;
    if (sel[0].kind === 'building') {
      const b = sel[0];
      if (b.type === 'towncenter' && G.buildings.filter((x) => x.owner === G.me && x.type === 'towncenter' && !x.dead).length === 1 && false) return;
      if (!this.deleteArm || performance.now() - this.deleteArm > 2500) { this.deleteArm = performance.now(); notify(G.me, `Press Delete again to destroy the ${b.def.name}.`, null, null, 'warn'); return; }
      this.deleteArm = 0;
      if (!b.built) { const p = G.players[G.me]; refund(p, b.paid || b.def.cost, 1 - b.progress * 0.5); }
      b.hp = 0; die(b, null);
      return;
    }
    for (const u of sel) { u.hp = 0; die(u, null); }
    SFX.play('death');
  },
  cycleIdle(vill) {
    const list = G.units.filter((u) => !u.dead && u.owner === G.me && !u.garrisoned && u.state === 'idle' && (vill ? u.def.tags.includes('villager') : (isMilitary(u) || u.def.tags.includes('monk'))));
    if (!list.length) return;
    this.idleIdx = (this.idleIdx || 0) % list.length;
    const u = list[this.idleIdx++];
    this.setSel([u]); centerCamOn(u.x, u.y);
  },
  cycleSpeed(dir) {
    const sp = [1, 1.7, 2.5, 4];
    let i = sp.indexOf(G.speed); if (i < 0) i = 1;
    i = clamp(i + dir, 0, sp.length - 1);
    if (dir > 0 && sp[i] === G.speed) i = 0;
    G.speed = sp[i];
    this.syncSpeed();
  },
  syncSpeed() {
    $('btn-speed').textContent = G.speed + 'x';
    document.querySelectorAll('#seg-speed button').forEach((b) => b.classList.toggle('on', +b.dataset.v === G.speed));
  },
  toggleSound(musicOnly) {
    if (musicOnly) { SFX.setMusic(!SFX.musicOn); $('opt-music').checked = SFX.musicOn; return; }
    const on = !(SFX.enabled || SFX.musicOn);
    SFX.setEnabled(on); SFX.setMusic(on);
    $('opt-sfx').checked = on; $('opt-music').checked = on;
    $('btn-sound').style.opacity = on ? 1 : 0.5;
  },

  // ------------------------------------------------------------------ command card
  pressSlot(slot, shift) {
    const d = this.card[slot];
    if (!d) return;
    SFX.init();
    if (d.action) { d.action(shift); }
  },
  sels() { return G.sel.filter((e) => e.owner === G.me); },
  buildCard() {
    const p = G.players[G.me];
    const slots = new Array(15).fill(null);
    if (G.observer || !G.sel.length) return slots;
    const sel = this.sels();
    if (!sel.length) return slots;
    const first = sel[0];
    const ui = this;
    if (first.kind === 'unit') {
      const units = sel.filter((s) => s.kind === 'unit');
      const allVill = units.every((u) => u.def.tags.includes('villager'));
      const anyVill = units.some((u) => u.def.tags.includes('villager'));
      if (allVill && this.page !== 'main') {
        const list = this.page === 'eco' ? BLD_ECON : BLD_MIL;
        list.forEach((id, i) => {
          const def = BUILDINGS[id], cost = bldCost(p, id);
          const locked = def.age > p.age;
          slots[i] = { icon: buildingIcon(id, p.age, G.me), enabled: !locked && canAfford(p, cost), locked,
            tip: { title: def.name, cost, desc: def.desc, warn: locked ? 'Requires ' + AGES[def.age] : '', stats: `${def.size}×${def.size} · HP ${bldStats(p, id).hp}${def.pop ? ' · +' + def.pop + ' pop' : ''}` },
            action: () => ui.enterPlace(id) };
        });
        slots[14] = { icon: glyphIcon('back', '#5a4128', '#2a1c10'), enabled: true, tip: { title: 'Back', desc: 'Return to the previous menu.' }, action: () => { ui.page = 'main'; } };
        return slots;
      }
      if (allVill) {
        slots[0] = { icon: glyphIcon('house', '#7a8a56', '#3a4a26'), enabled: true, tip: { title: 'Build Economic Buildings', desc: 'House, Mill, Camps, Farm, Town Center, Market, Blacksmith, University, Monastery.' }, action: () => { ui.page = 'eco'; } };
        slots[1] = { icon: buildingIcon('barracks', p.age, G.me), enabled: true, tip: { title: 'Build Military Buildings', desc: 'Barracks, Archery Range, Stable, Siege Workshop, Castle, Tower, Walls, Gate.' }, action: () => { ui.page = 'mil'; } };
        slots[2] = { icon: glyphIcon('repair', '#7a6a4a', '#3a2f1a'), enabled: true, tip: { title: 'Repair', desc: 'Right-click a damaged building to repair it, or an unfinished one to help build it.' }, action: () => notify(G.me, 'Right-click a damaged building to repair it.', null, null, 'info') };
      }
      if (!allVill || true) {
        const mil = units.some((u) => isCombatant(u) && !u.def.tags.includes('villager')) || units.some((u) => u.def.tags.includes('monk'));
        if (mil || units.length) {
          slots[5] = { icon: glyphIcon('attackmove', '#7a3a3a', '#3a1a1a'), enabled: true, tip: { title: 'Attack Move', desc: 'Advance toward a location, attacking anything met on the way. Shift: queue.' }, action: () => { ui.cancelMode(); ui.mode = { t: 'amove' }; document.body.classList.add('cur-attack'); ui.setHint('Click a target location for attack-move · Esc to cancel'); } };
          slots[6] = { icon: glyphIcon('stop', '#7a3a3a', '#3a1a1a'), enabled: true, tip: { title: 'Stop', desc: 'Cancel orders and hold position.' }, action: () => { for (const u of units) orderStop(u); SFX.play('click'); } };
          if (mil && !anyVill) {
            const stance = units[0].stance;
            const label = stance === 'aggressive' ? 'Aggressive' : stance === 'defensive' ? 'Defensive' : 'Stand Ground';
            slots[7] = { icon: glyphIcon(stance === 'stand' ? 'stand' : 'stance', '#5a4128', '#2a1c10'), enabled: true, tip: { title: 'Stance: ' + label, desc: 'Cycle stance: Aggressive units chase enemies, Defensive units guard nearby, Stand Ground units hold position.' }, action: () => { const nx = { aggressive: 'defensive', defensive: 'stand', stand: 'aggressive' }[stance]; for (const u of units) u.stance = nx; SFX.play('click'); } };
          }
          slots[9] = { icon: glyphIcon('delete', '#7a3a3a', '#3a1a1a'), enabled: true, tip: { title: 'Delete', desc: 'Destroy the selected units. (Del)' }, action: () => ui.deleteSelected() };
        }
      }
      return slots;
    }
    if (first.kind === 'building') {
      const b = first, def = b.def;
      if (!b.built) {
        slots[14] = { icon: glyphIcon('delete', '#7a3a3a', '#3a1a1a'), enabled: true, tip: { title: 'Cancel Construction', desc: 'Destroy this foundation and recover some of the cost.' }, action: () => { ui.deleteArm = performance.now(); ui.deleteSelected(); } };
        return slots;
      }
      let si = 0;
      if (def.id === 'market') {
        MARKET_TRADE.forEach((r, i) => {
          const price = Math.round(p.market[r] * 1.25);
          slots[i] = { icon: glyphIcon(r, '#6a8a56', '#2c4224'), enabled: p.res.gold >= price, label: 'Buy', tip: { title: `Buy 100 ${r}`, cost: { gold: price }, desc: 'Shift: buy 500.' }, action: (sh) => { for (let k = 0; k < (sh ? 5 : 1); k++) if (!marketBuy(p, r, 100)) break; } };
          const gain = Math.round(p.market[r] * 0.75);
          slots[5 + i] = { icon: glyphIcon(r, '#8a5a56', '#44241c'), enabled: p.res[r] >= 100, label: 'Sell', tip: { title: `Sell 100 ${r}`, desc: `Receive ${gain} gold. Shift: sell 500.` }, action: (sh) => { for (let k = 0; k < (sh ? 5 : 1); k++) if (!marketSell(p, r, 100)) break; } };
        });
      }
      for (const tid of def.trains) {
        if (si > 4) break;
        const baseId = tid === 'UU' ? p.civDef.uu : tid;
        const cur = resolveUnit(p, baseId);
        const ud = UNITS[cur];
        const locked = unitAvailableAt(p, b, tid) === false;
        const cost = ud.cost;
        const qn = b.queue.filter((q) => q.kind === 'unit' && q.id === baseId).length;
        const st = unitStats(p, cur);
        slots[si] = { icon: unitIcon(cur, G.me), enabled: !locked && canAfford(p, cost), locked, count: qn || '',
          tip: { title: ud.name, cost, desc: ud.desc || '', warn: locked ? 'Requires ' + AGES[ud.age] : '', stats: `HP ${st.hp} · Atk ${st.atkM || st.atkP}${st.range > 1.5 ? ' · Range ' + st.range : ''} · Armor ${st.armM}/${st.armP} · ${ud.pop > 1 ? 'Pop ' + ud.pop + ' · ' : ''}${Math.round(ud.time * trainTimeMult(p, def.id))}s` },
          action: (sh) => { const n = cmdTrain(b, tid, sh ? 5 : 1); if (n) SFX.play('click'); } };
        si++;
      }
      // techs
      const techs = def.techs.map((id) => ({ id, av: techAvailable(p, id) })).filter((t) => !t.av.hide);
      techs.sort((a, c) => (TECHS[c.id].toAge ? 1 : 0) - (TECHS[a.id].toAge ? 1 : 0));
      let ti = Math.max(5, si === 0 ? 0 : 5);
      if (def.id === 'market') ti = 10;
      if (def.trains.length === 0 && def.id !== 'market') ti = 0;
      for (const t of techs) {
        if (ti > 13) break;
        const tech = TECHS[t.id];
        const afford = canAfford(p, tech.cost);
        slots[ti] = { icon: techIcon(tech, G.me), enabled: t.av.ok && afford, locked: !t.av.ok,
          tip: { title: tech.name, cost: tech.cost, desc: tech.desc, warn: t.av.ok ? '' : t.av.why, stats: Math.round(tech.time * trainTimeMult(p, def.id)) + 's research' },
          action: () => { if (cmdResearch(b, t.id)) SFX.play('click'); } };
        ti++;
      }
      // misc
      if (def.trains.length) slots[10] = slots[10] || { icon: glyphIcon('rally', '#7a3a3a', '#3a1a1a'), enabled: true, tip: { title: 'Set Rally Point', desc: 'Right-click a location or resource to set where new units go. Villagers rallied to a resource start gathering.' }, action: () => { ui.cancelMode(); ui.mode = { t: 'rally' }; ui.setHint('Click to set the rally point · Esc to cancel'); } };
      if (def.id === 'towncenter') slots[12] = { icon: glyphIcon('bell', '#8a7a4a', '#3a2f18'), enabled: true, tip: { title: 'Town Bell', desc: 'Garrison all your villagers in Town Centers and Castles for safety. Press the Unload button when the danger has passed.' }, action: () => { const n = ringTownBell(G.me); notify(G.me, n ? `Town Bell! ${n} villagers take shelter.` : 'No villagers to shelter.', null, null, n ? 'warn' : 'info'); if (n) SFX.play('alarm'); } };
      if (def.garrison) slots[11] = slots[11] || { icon: glyphIcon('garrison', '#5a6a7a', '#2a323a'), enabled: b.garrison.length > 0, count: b.garrison.length || '', tip: { title: 'Unload Garrison', desc: `Release garrisoned units (${b.garrison.length}/${def.garrison}). Garrisoned units add arrows and heal.` }, action: () => { ungarrisonAll(b); SFX.play('click'); } };
      if (!slots[14]) slots[14] = { icon: glyphIcon('delete', '#7a3a3a', '#3a1a1a'), enabled: true, tip: { title: 'Delete', desc: 'Destroy this building (press twice). (Del)' }, action: () => ui.deleteSelected() };
      return slots;
    }
    return slots;
  },

  tipHtml(d) {
    if (!d || !d.tip) return '';
    const t = d.tip, p = G.players[G.me];
    let h = `<div class="tt-title"><span class="tt-key">${d.key || ''}</span>${t.title}</div>`;
    if (t.cost) {
      const parts = RES.filter((r) => t.cost[r]).map((r) => `<span class="${p.res[r] < t.cost[r] ? 'no' : ''}"><img src="${RES_ICON[r]}">${t.cost[r]}</span>`);
      if (parts.length) h += `<div class="tt-cost">${parts.join('')}</div>`;
    }
    if (t.stats) h += `<div class="tt-stats">${t.stats}</div>`;
    if (t.desc) h += `<div class="tt-desc">${t.desc}</div>`;
    if (t.warn) h += `<div class="tt-warn">${t.warn}</div>`;
    return h;
  },
  showTip(slot) {
    const d = this.card[slot]; const tt = $('tooltip');
    if (!d || !d.tip) { tt.style.display = 'none'; return; }
    tt.innerHTML = this.tipHtml(d); tt.style.display = 'block';
    const el = $('cmd').children[slot];
    if (el) { const r = el.getBoundingClientRect(); tt.style.left = Math.max(6, Math.min(window.innerWidth - 330, r.left - 120)) + 'px'; tt.style.top = Math.max(6, r.top - tt.offsetHeight - 8) + 'px'; }
  },
  moveTip() { if (this.hovCard >= 0) this.showTip(this.hovCard); },

  renderCard() {
    const slots = this.buildCard();
    slots.forEach((s, i) => { if (s) s.key = KEYS[i]; });
    this.card = slots;
    const sig = slots.map((s) => s ? (s.icon.length + '|' + (s.enabled ? 1 : 0) + (s.locked ? 1 : 0) + '|' + (s.count || '') + (s.tip ? s.tip.title : '')) : '-').join(',');
    if (sig === this.cardSig) { if (this.hovCard >= 0) this.showTip(this.hovCard); return; }
    this.cardSig = sig;
    const cmd = $('cmd');
    cmd.innerHTML = slots.map((s, i) => {
      if (!s) return `<div class="cempty"></div>`;
      return `<div class="cbtn ${s.enabled ? '' : 'off'}" data-slot="${i}" style="background-image:url(${s.icon})"><span class="key">${KEYS[i]}</span>${s.count ? `<span class="cnt">${s.count}</span>` : ''}</div>`;
    }).join('');
    if (this.hovCard >= 0) this.showTip(this.hovCard);
  },

  // ------------------------------------------------------------------ info panel
  onInfoClick(e) {
    const q = e.target.closest('[data-q]');
    if (q) { const b = G.sel[0]; if (b && b.kind === 'building') { cmdCancel(b, +q.dataset.q); SFX.play('click'); } e.preventDefault(); return; }
    const m = e.target.closest('[data-m]');
    if (m) {
      const ent = G.byId.get(+m.dataset.m);
      if (ent) {
        if (e.shiftKey) this.setSel(G.sel.filter((s) => s !== ent));
        else if (e.ctrlKey) this.setSel(G.sel.filter((s) => s.type === ent.type));
        else this.setSel([ent]);
      }
      e.preventDefault();
    }
  },
  statLine(e) {
    const p = G.players[e.owner];
    if (e.kind === 'unit') {
      const s = e.stats, d = e.def;
      const base = UNITS[e.type];
      const atk = s.atkM || s.atkP;
      const bonus = Object.keys(s.bonus || {}).map((k) => `+${s.bonus[k]} vs ${k}`).join(', ');
      let h = `<span>HP <b>${Math.ceil(e.hp)}/${e.maxHp}</b></span>`;
      if (atk) h += `<span>Attack <b>${atk}</b>${bonus ? ` <span class="bonus">(${bonus})</span>` : ''}</span>`;
      h += `<span>Armor <b>${s.armM}/${s.armP}</b></span>`;
      if (s.range > 1.5) h += `<span>Range <b>${s.range}</b></span>`;
      h += `<span>Speed <b>${(s.speed).toFixed(2)}</b></span><span>Sight <b>${s.los}</b></span>`;
      return h;
    }
    if (e.kind === 'building') {
      const s = e.stats;
      let h = `<span>HP <b>${Math.ceil(e.hp)}/${e.maxHp}</b></span><span>Armor <b>${s.armM}/${s.armP}</b></span>`;
      if (s.atkP) h += `<span>Attack <b>${s.atkP}</b></span><span>Range <b>${s.range}</b></span>`;
      if (e.def.pop) h += `<span>Population <b>+${e.def.pop}</b></span>`;
      if (e.def.garrison) h += `<span>Garrison <b>${e.garrison.length}/${e.def.garrison}</b></span>`;
      return h;
    }
    return '';
  },
  renderInfo() {
    const info = $('info');
    const sel = G.sel;
    let html = '';
    const p = G.players[G.me];
    if (!sel.length) {
      const age = AGES[p.age];
      html = `<div class="empty-info">Select a unit or building to see details.<br><br>
        <b>Goal:</b> destroy all enemy buildings. · <b>Right-click</b> to command · <b>?</b> for help.</div>`;
    } else if (sel.length === 1 || sel[0].kind !== 'unit') {
      const e = sel[0];
      let name = '', icon = '', sub = '', body = '', extra = '';
      if (e.kind === 'unit') {
        name = e.def.name; icon = unitIcon(e.type, e.owner); sub = e.owner === G.me ? 'Your unit' : (e.owner >= 0 ? G.players[e.owner].name : 'Wild');
        body = `<div class="stats">${this.statLine(e)}</div>`;
        if (e.def.tags.includes('villager')) body += `<div class="stats"><span>${e.carry.amount >= 1 ? `Carrying <b>${Math.floor(e.carry.amount)} ${e.carry.type}</b>` : 'Not carrying anything'}</span><span>${e.state === 'idle' ? 'Idle' : e.state === 'gather' ? 'Gathering' : e.state === 'build' ? 'Building' : e.state}</span></div>`;
        else body += `<div class="desc">${e.def.desc || ''}</div>`;
      } else if (e.kind === 'building') {
        name = e.def.name; icon = buildingIcon(e.type, p.age, e.owner); sub = e.owner === G.me ? (e.built ? 'Your building' : 'Under construction') : G.players[e.owner].name;
        body = `<div class="stats">${this.statLine(e)}</div>`;
        if (!e.built) body += `<div class="bar prog"><div style="width:${Math.round(e.progress * 100)}%"></div><span>Construction ${Math.round(e.progress * 100)}%</span></div>`;
        else if (e.owner === G.me) {
          if (e.queue.length) {
            body += `<div class="queue">` + e.queue.map((q, i) => {
              const ico = q.kind === 'unit' ? unitIcon(resolveUnit(p, q.id), G.me) : techIcon(TECHS[q.id], G.me);
              const pr = i === 0 ? Math.round((1 - q.left / q.total) * 100) : 0;
              return `<div class="qitem ${i === 0 && e.housed ? 'housed' : ''}" data-q="${i}" title="Click to cancel" style="background-image:url(${ico})"><div class="qb"><div style="width:${pr}%"></div></div></div>`;
            }).join('') + `</div>`;
            const q0 = e.queue[0];
            body += `<div class="sel-summary">${q0.kind === 'unit' ? 'Training ' + UNITS[resolveUnit(p, q0.id)].name : 'Researching ' + TECHS[q0.id].name} — ${Math.max(0, Math.ceil(q0.left))}s${e.housed ? ' · <span style="color:#ff8a7a">Need more houses!</span>' : ''}</div>`;
          } else body += `<div class="desc">${e.def.desc || ''}</div>`;
          if (e.def.id === 'market') body += `<div class="market-info">Prices: ${MARKET_TRADE.map((r) => `${r} <b>${Math.round(p.market[r])}</b>`).join(' · ')}</div>`;
        } else body += `<div class="desc">${e.def.desc || ''}</div>`;
      } else {
        const names = { tree: 'Tree', gold: 'Gold Mine', stone: 'Stone Mine', berries: 'Berry Bush', deer: e.alive ? 'Deer' : 'Deer Carcass', boar: e.alive ? 'Wild Boar' : 'Boar Carcass' };
        name = names[e.type]; sub = 'Resource'; icon = glyphIcon(e.rkey === 'berries' || e.rkey === 'hunt' ? 'food' : e.rkey, '#5a4128', '#2a1c10');
        body = `<div class="stats"><span>Remaining <b>${Math.ceil(e.amount)}</b> ${e.rkey === 'berries' || e.rkey === 'hunt' ? 'food' : e.rkey}</span></div><div class="desc">Right-click with villagers selected to gather.</div>`;
      }
      html = `<div class="info-wrap"><div class="portrait" style="background-image:url(${icon})"></div><div class="info-main"><div class="info-name">${name}</div><div class="info-sub">${sub}</div>${e.hp != null && e.maxHp ? `<div class="bar hp ${e.hp / e.maxHp < 0.3 ? 'low' : e.hp / e.maxHp < 0.6 ? 'mid' : ''}"><div style="width:${Math.round(e.hp / e.maxHp * 100)}%"></div><span>${Math.ceil(e.hp)} / ${e.maxHp}</span></div>` : ''}${body}</div></div>`;
    } else {
      const counts = {};
      for (const u of sel) counts[u.def.name] = (counts[u.def.name] || 0) + 1;
      const sum = Object.keys(counts).map((k) => `${counts[k]}× ${k}`).join(' · ');
      html = `<div class="sel-summary"><b>${sel.length}</b> selected — ${sum}</div><div class="multi">` +
        sel.slice(0, 48).map((u) => { const r = u.hp / u.maxHp; return `<div class="mitem" data-m="${u.id}" title="${u.def.name}" style="background-image:url(${unitIcon(u.type, u.owner)})"><div class="mh"><div style="width:${Math.round(r * 100)}%;background:${hpColor(r)}"></div></div>${u.carry.amount >= 1 ? `<span class="mc">${Math.floor(u.carry.amount)}</span>` : ''}</div>`; }).join('') + `</div>`;
    }
    if (html !== this.infoHtml) { info.innerHTML = html; this.infoHtml = html; }
  },

  // ------------------------------------------------------------------ HUD
  update(dt) {
    // camera scroll
    const sp = 900 / R.cam.zoom * dt;
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k['arrowleft']) dx -= 1; if (k['arrowright']) dx += 1; if (k['arrowup']) dy -= 1; if (k['arrowdown']) dy += 1;
    if (this.mouse.in && !this.drag && !this.panning) {
      const m = this.mouse, E = 10;
      if (m.x <= E) dx -= 1; if (m.x >= R.vw - E) dx += 1; if (m.y <= E) dy -= 1; if (m.y >= R.vh - 2 && false) dy += 1;
      if (m.y >= R.vh - E) dy += 1;
    }
    if (dx || dy) { R.cam.x += dx * sp * 1.15; R.cam.y += dy * sp * 0.8; clampCam(); }
    if (this.mode && this.mode.t === 'place') this.computeGhost();
    this.advisor(dt);
    this.hoverT = (this.hoverT || 0) - dt;
    if (this.hoverT <= 0) { this.hoverT = 0.06; this.updateHover(); }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.refreshHUD(); }
    // alerts
    while (this.alertSeen < G.alerts.length) {
      const a = G.alerts[this.alertSeen++];
      const box = $('alerts');
      const last = box.lastElementChild;
      if (last && last.textContent === a.msg) last.remove();
      const el = document.createElement('div'); el.className = 'alert ' + a.type; el.textContent = a.msg;
      box.appendChild(el);
      while (box.children.length > 5) box.removeChild(box.firstChild);
      setTimeout(() => el.remove(), 6200);
    }
  },
  updateHover() {
    let h = null;
    if (this.mouse.in && !this.drag && !this.panning) h = this.pickAt(this.mouse.x, this.mouse.y);
    this.hover = h;
    let cur = '';
    if (!this.mode && h && !G.observer) {
      const own = G.sel.filter((e) => e.owner === G.me && e.kind === 'unit');
      if (own.length) {
        if (h.owner !== G.me && h.owner >= 0 && (h.kind === 'unit' || h.kind === 'building') && own.some((u) => isCombatant(u) || u.def.tags.includes('monk'))) cur = 'crosshair';
        else if (h.kind === 'res' && own.some((u) => u.def.tags.includes('villager'))) cur = 'pointer';
        else if (h.kind === 'building' && h.owner === G.me && (!h.built || h.hp < h.maxHp) && own.some((u) => u.def.tags.includes('villager'))) cur = 'pointer';
      } else if (h.owner === G.me) cur = 'pointer';
    }
    const cv = $('view');
    if (cv.style.cursor !== cur) cv.style.cursor = cur;
  },
  refreshHUD() {
    const p = G.players[G.me];
    for (const r of RES) {
      const el = $('res-' + r);
      el.querySelector('.v').textContent = Math.floor(p.res[r]);
    }
    // gatherers
    const cat = { food: 0, wood: 0, gold: 0, stone: 0 };
    let idleV = 0, idleM = 0;
    for (const u of G.units) {
      if (u.dead || u.owner !== G.me || u.garrisoned) continue;
      if (u.def.tags.includes('villager')) {
        if (u.state === 'gather') { const t = u.lastResType; cat[t === 'tree' ? 'wood' : t === 'gold' ? 'gold' : t === 'stone' ? 'stone' : 'food']++; }
        if (u.state === 'idle') idleV++;
      } else if ((isMilitary(u) || u.def.tags.includes('monk')) && u.state === 'idle') idleM++;
    }
    for (const r of RES) $('res-' + r).querySelector('.g').textContent = cat[r];
    const pe = $('res-pop');
    pe.querySelector('.v').textContent = `${p.pop}/${p.popCap}`;
    pe.classList.toggle('warn', p.pop >= p.popCap && p.popCap < POP_MAX);
    $('age-name').textContent = AGES[p.age];
    $('clock').textContent = fmtTime(G.time);
    const bv = $('btn-idlev').querySelector('.badge'); bv.textContent = idleV; bv.classList.toggle('zero', !idleV);
    const bm = $('btn-idlem').querySelector('.badge'); bm.textContent = idleM; bm.classList.toggle('zero', !idleM);
    this.syncSpeedLabel();
    this.renderCard();
    this.renderInfo();
    $('objective').textContent = G.observer ? 'Observer mode' : '';
  },
  syncSpeedLabel() { const t = G.speed + 'x'; if ($('btn-speed').textContent !== t) this.syncSpeed(); },

  // ------------------------------------------------------------------ canvas overlays
  drawWorld(ctx) {
    const z = R.cam.zoom;
    // placement ghost
    if (this.mode && this.mode.t === 'place' && this.ghost) {
      const g = this.ghost, def = BUILDINGS[g.type], p = G.players[G.me];
      for (const t of g.tiles) {
        const ok = t.ok && g.afford;
        ctx.fillStyle = ok ? 'rgba(80,255,80,0.28)' : 'rgba(255,60,50,0.38)';
        isoDiamond(ctx, t.x, t.y, def.size, def.size); ctx.fill();
        ctx.strokeStyle = ok ? 'rgba(160,255,160,0.9)' : 'rgba(255,120,110,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        // sprite
        if (t.ok) {
          const extra = g.type === 'farm' ? 3 : 0;
          const spr = getBuildingSprite(g.type, p.age, G.me, WALL_FAMILY.includes(g.type) ? 0 : extra);
          ctx.globalAlpha = 0.62;
          ctx.drawImage(spr.cv, w2sx(t.x, t.y) - spr.ox * z, w2sy(t.x, t.y) - spr.oy * z, spr.W * z, spr.H * z);
          ctx.globalAlpha = 1;
        }
      }
      const t0 = g.tiles[g.tiles.length - 1];
      const tx = w2sx(t0.x + def.size / 2, t0.y + def.size / 2), ty = w2sy(t0.x + def.size / 2, t0.y + def.size / 2) - (def.height + 30) * z;
      const costs = RES.filter((r) => g.cost[r]).map((r) => `${g.cost[r]} ${r}`).join('  ');
      ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center';
      const msg = (!g.ok ? (g.why || 'Blocked') : !g.afford ? 'Not enough resources' : costs);
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(msg, tx, ty);
      ctx.fillStyle = g.ok && g.afford ? '#fff' : '#ff9a8a'; ctx.fillText(msg, tx, ty);
    }
    // hover highlight for target under cursor in command mode
  },
  drawScreen(ctx) {
    if (this.drag && this.drag.active) {
      const d = this.drag;
      const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1), w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
      ctx.fillStyle = 'rgba(140,255,140,0.12)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(180,255,180,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }
  },
};
