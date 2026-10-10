// Mouse / keyboard input: camera control, selection, command issuing, building placement.
import * as Cmd from '../sim/commands.js';
import { BUILDINGS } from '../data/buildings.js';

/** Layout-independent key name: physical key position (so hotkeys work on any keyboard layout). */
function keyName(e) {
  const c = e.code || '';
  if (c.startsWith('Key')) return c.slice(3).toLowerCase();
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad') && /^\d$/.test(c.slice(6))) return c.slice(6);
  switch (c) {
    case 'Period': return '.'; case 'Comma': return ','; case 'Equal': case 'NumpadAdd': return '+';
    case 'Minus': case 'NumpadSubtract': return '-'; case 'Space': return ' '; case 'Escape': return 'escape';
    case 'Delete': return 'delete'; case 'Backspace': return 'backspace'; case 'F10': return 'f10';
    case 'ArrowUp': return 'arrowup'; case 'ArrowDown': return 'arrowdown'; case 'ArrowLeft': return 'arrowleft'; case 'ArrowRight': return 'arrowright';
    case 'Tab': return 'tab';
  }
  return (e.key || '').toLowerCase();
}

export class Input {
  constructor(S) {
    this.S = S;
    this.sel = [];
    this.selVersion = 0;
    this.mode = { type: 'normal' };
    this.groups = new Array(10).fill(null).map(() => []);
    this.lastGroupKey = { k: -1, t: 0 };
    this.hover = 0;
    this.mouse = { x: 0, y: 0, inside: false, down: false };
    this.markers = [];
    this.drag = null;
    this.keys = new Set();
    this.shift = false; this.ctrl = false; this.alt = false;
    this.lastClick = { t: 0, id: 0 };
    this.idleCycle = { v: 0, m: 0 };
    this.lastAlert = null;
    this.hoverT = 0;
    this.panDrag = null;
    this.edgeScroll = true;
    this.scrollSpeed = 1;
    this.wallGhosts = null;
    this.ghost = null;
  }

  /** Register a DOM listener that detach() can remove again (a new game must not inherit the previous game's handlers). */
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    (this._listeners || (this._listeners = [])).push([target, type, fn, opts]);
  }
  detach() {
    for (const [t, type, fn, opts] of this._listeners || []) t.removeEventListener(type, fn, opts);
    this._listeners = [];
  }

  attach(world, selbox, minimapCanvas) {
    this.world = world; this.selbox = selbox; this.minimapCanvas = minimapCanvas;
    this.on(world, 'mousedown', e => this.onMouseDown(e));
    this.on(window, 'mousemove', e => this.onMouseMove(e));
    this.on(window, 'mouseup', e => this.onMouseUp(e));
    this.on(world, 'contextmenu', e => e.preventDefault());
    this.on(world, 'wheel', e => this.onWheel(e), { passive: false });
    this.on(world, 'mouseleave', () => { this.mouse.inside = false; });
    this.on(world, 'mouseenter', () => { this.mouse.inside = true; });
    this.on(window, 'keydown', e => this.onKeyDown(e));
    this.on(window, 'keyup', e => this.onKeyUp(e));
    this.on(window, 'blur', () => { this.keys.clear(); this.shift = this.ctrl = this.alt = false; });
    // minimap
    const mm = minimapCanvas;
    this.on(mm, 'mousedown', e => this.onMinimapDown(e));
    this.on(mm, 'contextmenu', e => e.preventDefault());
    this.on(window, 'mousemove', e => { if (this.mmDrag) this.onMinimapMove(e); });
    this.on(window, 'mouseup', () => { this.mmDrag = false; });
  }

  get game() { return this.S.game; }
  get cam() { return this.S.cam; }
  get me() { return this.S.game.players[this.S.game.humanIndex]; }

  // ============================================================ selection helpers
  entities() {
    const g = this.game, out = [];
    for (const id of this.sel) { const e = g.byId.get(id); if (e && !e.dead && !(e.kind === 'unit' && e.garrison)) out.push(e); }
    return out;
  }
  ownUnits() { return this.entities().filter(e => e.kind === 'unit' && e.owner === this.game.humanIndex); }
  ownBuildings() { return this.entities().filter(e => e.kind === 'building' && e.owner === this.game.humanIndex); }
  setSelection(ids, silent) {
    this.sel = ids.slice(0, 120);
    this.selVersion++;
    if (this.S.hud) this.S.hud.onSelection();
    if (!silent && this.S.audio && ids.length) {
      const e = this.game.byId.get(ids[0]);
      if (e && e.owner === this.game.humanIndex) this.S.audio.play(e.kind === 'building' ? 'ui_select_building' : 'ui_select', { vol: 0.8 });
    }
  }
  selectEntity(e, add) {
    if (!e) { if (!add) this.setSelection([]); return; }
    if (add && this.sel.length) {
      const cur = this.entities();
      if (cur.length && (cur[0].owner !== e.owner || cur[0].kind !== e.kind)) { this.setSelection([e.id]); return; }
      const i = this.sel.indexOf(e.id);
      if (i >= 0) this.setSelection(this.sel.filter(x => x !== e.id)); else this.setSelection([...this.sel, e.id]);
    } else this.setSelection([e.id]);
  }
  clearDead() {
    const g = this.game;
    let changed = false;
    for (const id of this.sel) { const e = g.byId.get(id); if (!e || e.dead || (e.kind === 'unit' && e.garrison)) { changed = true; break; } }
    if (changed) { this.sel = this.sel.filter(id => { const e = g.byId.get(id); return e && !e.dead && !(e.kind === 'unit' && e.garrison); }); this.selVersion++; if (this.S.hud) this.S.hud.onSelection(); }
    if (this.mode.type === 'place' && !this.ownUnits().some(u => u.def.tags.includes('villager'))) this.cancelMode();
  }

  // ============================================================ mode handling
  beginPlace(btype) {
    const def = this.me.bdefs[btype];
    if (!def) return;
    const wall = !!def.wall && !def.gate;
    this.mode = { type: 'place', btype, wall };
    this.S.hud.setModeHint(wall ? `Click and drag to build ${def.name}. Right-click or Esc to cancel.` : `Place ${def.name} — click to build, Shift to place several, Right-click to cancel.`);
    this.S.root.classList.add('mode-place');
  }
  beginTarget(action, text) {
    this.mode = { type: 'target', action };
    this.S.hud.setModeHint(text);
    this.S.root.classList.add('mode-target');
  }
  cancelMode() {
    this.mode = { type: 'normal' }; this.ghost = null; this.wallGhosts = null; this.wallStart = null;
    this.S.hud.setModeHint(null);
    this.S.root.classList.remove('mode-place', 'mode-target', 'mode-attack');
  }

  // ============================================================ mouse
  localPos(e) { const r = this.world.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  onMouseDown(e) {
    if (this.S.paused || this.S.game.over && false) return;
    const p = this.localPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = true;
    if (this.S.audio) this.S.audio.init();
    this.shift = e.shiftKey; this.ctrl = e.ctrlKey || e.metaKey;
    if (e.button === 1) { this.panDrag = { x: e.clientX, y: e.clientY }; e.preventDefault(); return; }
    if (e.button === 2) { this.onRightClick(p, e); return; }
    if (e.button !== 0) return;
    this.mouse.down = true;
    const m = this.mode;
    if (m.type === 'place') {
      if (m.wall) { this.wallStart = this.tileAt(p.x, p.y, 1); this.updateGhost(p); return; }
      this.tryPlace(p, e.shiftKey);
      return;
    }
    if (m.type === 'target') { this.targetClick(p, e.shiftKey); return; }
    this.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, active: false, shift: e.shiftKey };
  }

  onMouseMove(e) {
    const p = this.localPos(e);
    this.mouse.x = p.x; this.mouse.y = p.y;
    if (this.panDrag) { this.cam.pan(-(e.clientX - this.panDrag.x), -(e.clientY - this.panDrag.y)); this.panDrag = { x: e.clientX, y: e.clientY }; return; }
    if (this.drag) {
      this.drag.x1 = p.x; this.drag.y1 = p.y;
      if (!this.drag.active && Math.hypot(p.x - this.drag.x0, p.y - this.drag.y0) > 5) this.drag.active = true;
      if (this.drag.active) {
        const x = Math.min(this.drag.x0, p.x), y = Math.min(this.drag.y0, p.y), w = Math.abs(p.x - this.drag.x0), h = Math.abs(p.y - this.drag.y0);
        const s = this.selbox.style; s.display = 'block'; s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px';
      }
    }
    if (this.mode.type === 'place') this.updateGhost(p);
  }

  onMouseUp(e) {
    this.mouse.down = false;
    if (e.button === 1) { this.panDrag = null; return; }
    if (e.button !== 0) return;
    const p = this.localPos(e);
    if (this.mode.type === 'place' && this.mode.wall && this.wallStart) { this.finishWall(p, e.shiftKey); return; }
    if (!this.drag) return;
    const d = this.drag; this.drag = null;
    this.selbox.style.display = 'none';
    if (this.S.paused) return;
    if (d.active) this.boxSelect(d.x0, d.y0, p.x, p.y, d.shift || e.shiftKey);
    else this.clickSelect(p, d.shift || e.shiftKey, e);
  }

  onWheel(e) {
    e.preventDefault();
    const p = this.localPos(e);
    const f = Math.exp(-e.deltaY * 0.0012);
    this.cam.setZoom(this.cam.zoom * f, p.x, p.y);
  }

  // ------------------------------------------------------------ select
  clickSelect(p, add, ev) {
    const r = this.S.renderer, g = this.game;
    const e = r.pick(p.x, p.y);
    const now = performance.now();
    if (e && e.kind === 'unit' && e.owner === g.humanIndex && !add) {
      // double click (or ctrl+click) selects all of the same type on screen
      if ((this.lastClick.id === e.id && now - this.lastClick.t < 380) || this.ctrl) {
        const ids = [];
        for (const u of r.drawn) if (u.kind === 'unit' && u.owner === e.owner && u.type === e.type && !u.dead) ids.push(u.id);
        this.setSelection(ids);
        this.lastClick = { t: 0, id: 0 };
        return;
      }
    }
    this.lastClick = { t: now, id: e ? e.id : 0 };
    if (e && e.kind === 'resource') { this.setSelection([e.id], true); return; }
    this.selectEntity(e, add);
  }

  boxSelect(x0, y0, x1, y1, add) {
    const r = this.S.renderer, g = this.game;
    const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1);
    const ids = [];
    for (const u of r.drawn) {
      if (u.kind !== 'unit' || u.owner !== g.humanIndex || u.dead || u.garrison) continue;
      const h = u._hit; const cx = h[4], cy = (h[1] + h[3]) / 2 + 4;
      if (cx >= xa && cx <= xb && cy >= ya && cy <= yb) ids.push(u.id);
    }
    if (!ids.length) {
      // no units: select buildings under the box center? only if box is tiny; otherwise nothing
      if (!add) this.setSelection([]);
      return;
    }
    // prefer military if mixed with villagers? keep all (AoE2 selects all)
    if (add) {
      const cur = this.entities().filter(e => e.kind === 'unit' && e.owner === g.humanIndex).map(e => e.id);
      this.setSelection([...new Set([...cur, ...ids])]);
    } else this.setSelection(ids);
  }

  // ------------------------------------------------------------ commands via right click
  onRightClick(p, e) {
    if (this.mode.type !== 'normal') { this.cancelMode(); return; }
    const g = this.game, me = g.humanIndex;
    const ents = this.entities();
    if (!ents.length) return;
    const pick = this.S.renderer.pick(p.x, p.y);
    const w = this.cam.screenToWorld(p.x, p.y);
    const units = ents.filter(x => x.kind === 'unit' && x.owner === me);
    const blds = ents.filter(x => x.kind === 'building' && x.owner === me);
    if (!units.length && blds.length) {
      // set rally point for production buildings
      let n = 0;
      for (const b of blds) {
        if (!b.built || !(b.def.produces.length || b.type === 'town_center')) continue;
        const tgt = pick && (pick.kind === 'resource' || (pick.kind === 'building' && pick.owner === me)) ? pick.id : 0;
        Cmd.setRally(g, b, tgt ? pick.x : w.x, tgt ? pick.y : w.y, tgt); n++;
      }
      if (n) { this.addMarker(pick ? pick.x : w.x, pick ? pick.y : w.y, 'move'); this.S.audio && this.S.audio.play('ui_click'); }
      return;
    }
    if (!units.length) return;
    const target = pick && pick.id !== units[0].id ? pick : null;
    const result = Cmd.smartOrder(g, units, target, w.x, w.y, { queue: e.shiftKey });
    const tx = target ? target.x : w.x, ty = target ? target.y : w.y;
    this.addMarker(tx, ty, result === 'attack' || result === 'hunt' ? 'attack' : result === 'gather' ? 'gather' : 'move');
    this.ack(units, result);
  }

  ack(units, result) {
    const a = this.S.audio; if (!a || !units.length) return;
    const u = units[0], t = u.def.tags;
    const name = t.includes('villager') ? 'ack_villager' : t.includes('monk') ? 'ack_monk' : t.includes('siege') ? 'ack_siege' : t.includes('cavalry') ? 'ack_cavalry' : t.includes('archer') || t.includes('ranged') ? 'ack_archer' : 'ack_infantry';
    a.play(name, { vol: 0.9 });
  }

  addMarker(x, y, kind) { this.markers.push({ x, y, kind, t: 0 }); if (this.markers.length > 12) this.markers.shift(); }

  // ------------------------------------------------------------ target mode clicks
  targetClick(p, shift) {
    const m = this.mode, g = this.game, me = g.humanIndex;
    const pick = this.S.renderer.pick(p.x, p.y);
    const w = this.cam.screenToWorld(p.x, p.y);
    const units = this.ownUnits(), blds = this.ownBuildings();
    switch (m.action) {
      case 'attackmove': {
        if (pick && pick.owner !== me && pick.kind !== 'resource' && g.isEnemy(me, pick.owner)) Cmd.orderAttack(g, units, pick, shift);
        else Cmd.orderMove(g, units, w.x, w.y, { attackMove: true, queue: shift });
        this.addMarker(w.x, w.y, 'attack'); this.ack(units, 'attack');
        break;
      }
      case 'rally': {
        for (const b of blds) if (b.built) {
          const tgt = pick && (pick.kind === 'resource' || (pick.kind === 'building' && pick.owner === me)) ? pick : null;
          Cmd.setRally(g, b, tgt ? tgt.x : w.x, tgt ? tgt.y : w.y, tgt ? tgt.id : 0);
        }
        this.addMarker(w.x, w.y, 'move');
        break;
      }
      case 'garrison': {
        if (pick && pick.kind === 'building' && pick.owner === me && pick.def.garrison > 0) { Cmd.orderGarrison(g, units, pick, shift); this.addMarker(pick.x, pick.y, 'move'); }
        break;
      }
      case 'repair': {
        if (pick && pick.kind === 'building' && pick.owner === me) { Cmd.orderRepair(g, units, pick, shift); this.addMarker(pick.x, pick.y, 'gather'); }
        break;
      }
    }
    if (!shift) this.cancelMode();
  }

  // ------------------------------------------------------------ building placement
  tileAt(sx, sy, size) {
    const w = this.cam.screenToWorld(sx, sy);
    return { tx: Math.round(w.x - size / 2), ty: Math.round(w.y - size / 2) };
  }
  updateGhost(p) {
    const m = this.mode;
    if (m.type !== 'place') return;
    const def = this.me.bdefs[m.btype]; const size = def.size;
    const t = this.tileAt(p.x, p.y, size);
    const chk = Cmd.canPlace(this.game, this.game.humanIndex, m.btype, t.tx, t.ty);
    const afford = this.me.canAfford(def.cost);
    this.ghost = { type: m.btype, tx: t.tx, ty: t.ty, ok: chk.ok && afford, reason: chk.ok ? (afford ? '' : 'Not enough resources') : chk.reason };
    this.wallGhosts = null;
    if (m.wall && this.wallStart) {
      const tiles = Cmd.lineTiles(this.wallStart.tx, this.wallStart.ty, t.tx, t.ty);
      let budget = { ...this.me.res };
      this.wallGhosts = tiles.map(([tx, ty]) => {
        const c = Cmd.canPlace(this.game, this.game.humanIndex, m.btype, tx, ty).ok;
        let ok = c; for (const r in def.cost) if (budget[r] < def.cost[r]) ok = false;
        if (ok) for (const r in def.cost) budget[r] -= def.cost[r];
        return { type: m.btype, tx, ty, ok, mask: 0 };
      });
      this.ghost = null;
    }
  }
  tryPlace(p, shift) {
    const m = this.mode, g = this.game, me = g.humanIndex;
    const size = this.me.bdefs[m.btype].size;
    const t = this.tileAt(p.x, p.y, size);
    const builders = this.ownUnits().filter(u => u.def.tags.includes('villager'));
    const b = Cmd.placeBuilding(g, me, m.btype, t.tx, t.ty, builders, { queue: shift });
    if (!b) {
      this.S.hud.flashError(g.lastError || 'Cannot build there');
      return;
    }
    this.S.audio && this.S.audio.play('place_building');
    this.addMarker(b.x, b.y, 'gather');
    if (shift && this.me.canAfford(this.me.bdefs[m.btype].cost)) { this.updateGhost(p); return; }
    this.cancelMode();
  }
  finishWall(p, shift) {
    const m = this.mode, g = this.game, me = g.humanIndex;
    const t = this.tileAt(p.x, p.y, 1);
    const tiles = Cmd.lineTiles(this.wallStart.tx, this.wallStart.ty, t.tx, t.ty);
    const builders = this.ownUnits().filter(u => u.def.tags.includes('villager'));
    const placed = Cmd.placeWall(g, me, m.btype, tiles, builders, { queue: shift });
    this.wallStart = null; this.wallGhosts = null;
    if (!placed.length) { this.S.hud.flashError(g.lastError || 'Cannot build there'); return; }
    this.S.audio && this.S.audio.play('place_building');
    if (!shift) this.cancelMode();
  }

  // ============================================================ minimap
  onMinimapDown(e) {
    const mm = this.S.minimap;
    const r = this.minimapCanvas.getBoundingClientRect();
    const k = mm.cw / r.width;
    const pos = mm.fromMini((e.clientX - r.left) * k, (e.clientY - r.top) * k);
    if (e.button === 2) {
      const units = this.ownUnits();
      if (units.length) {
        const g = this.game;
        Cmd.smartOrder(g, units, null, Math.max(1, Math.min(g.w - 2, pos.x)), Math.max(1, Math.min(g.h - 2, pos.y)), { queue: e.shiftKey });
        this.addMarker(pos.x, pos.y, 'move');
      }
      return;
    }
    if (this.mode.type === 'target' && e.button === 0) { /* ignore */ }
    this.mmDrag = true;
    this.cam.lookAt(pos.x, pos.y);
  }
  onMinimapMove(e) {
    const mm = this.S.minimap;
    const r = this.minimapCanvas.getBoundingClientRect();
    const k = mm.cw / r.width;
    const pos = mm.fromMini((e.clientX - r.left) * k, (e.clientY - r.top) * k);
    this.cam.lookAt(pos.x, pos.y);
  }

  // ============================================================ keyboard
  onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = keyName(e);
    this.shift = e.shiftKey; this.ctrl = e.ctrlKey || e.metaKey; this.alt = e.altKey;
    if (this.S.audio) this.S.audio.init();
    if (!this.S.inGame) return;
    if (k === 'escape') { e.preventDefault(); this.S.onEscape(); return; }
    if (k === 'f10') { e.preventDefault(); this.S.toggleMenu(); return; }
    if (this.S.paused && k !== 'p') return;
    this.keys.add(k);
    if (e.repeat && !['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { e.preventDefault(); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      if (/^[0-9]$/.test(k)) { e.preventDefault(); this.groups[+k] = this.sel.slice(); this.S.hud.toast(`Group ${k} set`); return; }
      if (k === 'm') { e.preventDefault(); this.selectAllMilitary(); return; }
      return;
    }
    if (/^[0-9]$/.test(k)) { this.recallGroup(+k, e.shiftKey); return; }
    switch (k) {
      case ' ': this.jumpToAlert(); return;
      case 'p': this.S.togglePause(); return;
      case '+': case '=': this.S.changeSpeed(1); return;
      case '-': case '_': this.S.changeSpeed(-1); return;
      case '.': this.cycleIdle('v'); return;
      case ',': this.cycleIdle('m'); return;
      case 'h': this.selectTownCenter(); return;
      case 'delete': case 'backspace': {
        if (this.S.hud.cardPage !== 'main') { this.S.hud.setPage('main'); return; }
        const ents = this.entities().filter(x => x.owner === this.game.humanIndex);
        if (ents.length) { Cmd.orderDelete(this.game, ents); this.S.audio && this.S.audio.play('ui_click'); }
        return;
      }
    }
    if (this.S.hud.pressHotkey(k, e.shiftKey)) { e.preventDefault(); }
  }
  onKeyUp(e) {
    const k = keyName(e);
    this.keys.delete(k);
    this.shift = e.shiftKey; this.ctrl = e.ctrlKey || e.metaKey; this.alt = e.altKey;
  }

  recallGroup(n, add) {
    const ids = this.groups[n].filter(id => { const e = this.game.byId.get(id); return e && !e.dead; });
    if (!ids.length) return;
    this.groups[n] = ids;
    const now = performance.now();
    if (this.lastGroupKey.k === n && now - this.lastGroupKey.t < 450) this.centerOn(ids);
    this.lastGroupKey = { k: n, t: now };
    this.setSelection(add ? [...new Set([...this.sel, ...ids])] : ids);
  }
  centerOn(ids) {
    let sx = 0, sy = 0, n = 0;
    for (const id of ids) { const e = this.game.byId.get(id); if (e && !e.dead) { sx += e.x; sy += e.y; n++; } }
    if (n) this.cam.lookAt(sx / n, sy / n);
  }
  selectTownCenter() {
    const g = this.game, me = g.humanIndex;
    const tcs = g.buildings.filter(b => b.owner === me && b.type === 'town_center' && !b.dead && b.built);
    if (!tcs.length) return;
    const cur = this.sel.length === 1 ? tcs.findIndex(b => b.id === this.sel[0]) : -1;
    const tc = tcs[(cur + 1) % tcs.length];
    this.setSelection([tc.id]); this.cam.lookAt(tc.x, tc.y);
  }
  idleList(kind) {
    const g = this.game, me = g.humanIndex;
    return g.units.filter(u => u.owner === me && !u.dead && !u.garrison && !u.order && !u.queue.length &&
      (kind === 'v' ? u.type === 'villager' : (u.def.military && !u.def.tags.includes('siege') || false)));
  }
  cycleIdle(kind) {
    const list = this.idleList(kind);
    if (!list.length) { this.S.hud.toast(kind === 'v' ? 'No idle villagers' : 'No idle military units'); return; }
    this.idleCycle[kind] = (this.idleCycle[kind] + 1) % list.length;
    const u = list[this.idleCycle[kind]];
    this.setSelection([u.id]); this.cam.lookAt(u.x, u.y);
  }
  selectAllMilitary() {
    const g = this.game, me = g.humanIndex;
    const ids = g.units.filter(u => u.owner === me && !u.dead && !u.garrison && u.def.military).map(u => u.id);
    if (ids.length) this.setSelection(ids); else this.S.hud.toast('No military units');
  }
  jumpToAlert() {
    if (this.lastAlert) this.cam.lookAt(this.lastAlert.x, this.lastAlert.y);
  }

  // ============================================================ per-frame
  update(dt) {
    this.clearDead();
    const cam = this.cam;
    // keyboard scrolling
    let dx = 0, dy = 0;
    const sp = 820 * this.scrollSpeed * dt;
    if (this.keys.has('arrowleft')) dx -= sp; if (this.keys.has('arrowright')) dx += sp;
    if (this.keys.has('arrowup')) dy -= sp; if (this.keys.has('arrowdown')) dy += sp;
    // edge scrolling
    if (this.edgeScroll && this.mouse.inside && !this.panDrag && !this.S.paused) {
      const m = 6, w = cam.vw, h = cam.vh - 0;
      const x = this.mouse.x, y = this.mouse.y;
      const bottomEdge = h - m;
      if (x <= m) dx -= sp; else if (x >= w - m) dx += sp;
      if (y <= m + 2) dy -= sp; else if (y >= bottomEdge && y < h && this.S.hud.bottomHeight() < 2) dy += sp;
    }
    if (dx || dy) cam.pan(dx, dy);
    // hover picking
    this.hoverT -= dt;
    if (this.hoverT <= 0 && this.mouse.inside && !this.drag && !this.panDrag) {
      this.hoverT = 0.06;
      const e = this.S.renderer.pick(this.mouse.x, this.mouse.y);
      this.hover = e ? e.id : 0;
      this.updateCursor(e);
    }
    if (this.mode.type === 'place' && !this.ghost && !this.wallGhosts) this.updateGhost(this.mouse);
  }

  updateCursor(e) {
    const g = this.game, me = g.humanIndex, root = this.world;
    let c = 'default';
    if (this.mode.type === 'place') c = 'copy';
    else if (this.mode.type === 'target') c = 'crosshair';
    else if (e) {
      const own = this.ownUnits();
      if (own.length) {
        if (e.kind === 'resource') c = own.some(u => u.def.tags.includes('villager')) ? 'pointer' : 'default';
        else if (g.isEnemy(me, e.owner) || (e.owner === 0 && e.kind === 'unit' && e.def.tags.includes('huntable'))) c = own.some(u => u.def.canAttack) ? 'crosshair' : 'default';
        else c = 'pointer';
      } else c = e.owner === me ? 'pointer' : 'default';
    }
    if (root.style.cursor !== c) root.style.cursor = c;
  }

  view() {
    return {
      selected: new Set(this.sel), hover: this.hover, ghost: this.mode.type === 'place' ? this.ghost : null,
      wallGhosts: this.wallGhosts, markers: this.markers, showAllBars: this.alt || this.S.settings.showBars, showPaths: false,
    };
  }
}
