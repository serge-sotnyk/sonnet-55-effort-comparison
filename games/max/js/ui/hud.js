// HUD: resource bar, command card, selection info, queues, idle buttons, notifications, hints.
import * as art from '../art/index.js';
import * as Cmd from '../sim/commands.js';
import { UNITS, LINES } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { CIVS } from '../data/civs.js';
import { AGE_NAMES, RES, STANCES, PLAYER_COLORS } from '../data/constants.js';
const PLAYER_COLORS_HEX = PLAYER_COLORS.map(c => c.light);
import { HOTKEYS, BUILD_PAGES, BUILDING_SLOTS, costHtml, unitStatLines } from './layout.js';

const $ = (id) => document.getElementById(id);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
const ROMAN = ['', 'I', 'II', 'III'];

function paint(canvas, src) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 54, h = canvas.clientHeight || 54;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.imageSmoothingQuality = 'high';
  if (src) c.drawImage(src, 0, 0, canvas.width, canvas.height);
}

export class HUD {
  constructor(S) {
    this.S = S;
    this.cardPage = 'main';
    this.dirty = true;
    this.cardSig = ''; this.infoSig = '';
    this.msgIdx = 0;
    this.cells = [];
    this.resIcons = {};
    this.cardSpecs = new Array(15).fill(null);
    this.hintShown = new Set();
    this.hintT = 0; this.hintCool = 0;
    this.tick = 0;
    this.build();
  }

  get game() { return this.S.game; }
  get input() { return this.S.input; }
  get me() { return this.S.game.players[this.S.game.humanIndex]; }

  // ============================================================ construction
  build() {
    // resource icons as data urls for tooltips
    for (const r of [...RES, 'pop']) {
      const c = art.getIcon('res:' + r);
      this.resIcons[r] = c.toDataURL ? c.toDataURL() : '';
    }
    // top bar
    const rb = $('resbar'); rb.innerHTML = '';
    this.resEls = {};
    for (const r of ['wood', 'food', 'gold', 'stone']) {
      const d = el('div', 'res'); d.title = r[0].toUpperCase() + r.slice(1);
      const cv = el('canvas'); d.appendChild(cv);
      const v = el('span', 'val', '0'); d.appendChild(v);
      const g = el('span', 'gather', ''); g.title = 'Villagers gathering'; d.appendChild(g);
      rb.appendChild(d);
      this.resEls[r] = { box: d, val: v, gather: g, cv };
      paint(cv, art.getIcon('res:' + r));
    }
    {
      const d = el('div', 'res'); d.style.minWidth = '98px'; d.title = 'Population / housing capacity';
      const cv = el('canvas'); d.appendChild(cv); paint(cv, art.getIcon('res:pop'));
      const v = el('span', 'val', '0/0'); d.appendChild(v);
      rb.appendChild(d); this.popEl = { box: d, val: v };
    }
    {
      const d = el('div', 'res'); d.style.minWidth = '70px'; d.title = 'Military units';
      const cv = el('canvas'); d.appendChild(cv); paint(cv, art.getIcon('ui:attack'));
      const v = el('span', 'val', '0'); d.appendChild(v);
      rb.appendChild(d); this.milEl = v;
    }
    this.ageEl = $('agebadge');
    $('btn-pause').appendChild(this.iconBtn('ui:pause'));
    $('btn-menu').appendChild(this.iconBtn('ui:menu'));
    $('btn-slower').appendChild(this.iconBtn('ui:speed', true));
    $('btn-faster').appendChild(this.iconBtn('ui:speed'));
    $('btn-flare').appendChild(this.iconBtn('ui:select_all'));
    $('btn-hpbars').appendChild(this.iconBtn('ui:heal'));
    $('btn-full').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
    $('btn-pause').onclick = () => this.S.togglePause();
    $('btn-menu').onclick = () => this.S.toggleMenu();
    $('btn-slower').onclick = () => this.S.changeSpeed(-1);
    $('btn-faster').onclick = () => this.S.changeSpeed(1);
    $('btn-flare').onclick = () => this.input.selectAllMilitary();
    $('btn-hpbars').onclick = () => { this.S.settings.showBars = !this.S.settings.showBars; $('btn-hpbars').classList.toggle('on', this.S.settings.showBars); };
    // idle buttons
    const ib = $('idlebar'); ib.innerHTML = '';
    this.idleBtns = {};
    for (const [k, icon, title] of [['v', 'ui:idle_villager', 'Idle villagers (.)'], ['m', 'ui:idle_military', 'Idle military (,)'], ['a', 'ui:select_all', 'All military (Ctrl+M)']]) {
      const b = el('button', 'idlebtn'); b.title = title;
      const cv = el('canvas'); b.appendChild(cv); paint(cv, art.getIcon(icon));
      const n = el('span', '', '0'); b.appendChild(n);
      b.onclick = () => { if (k === 'a') this.input.selectAllMilitary(); else this.input.cycleIdle(k); };
      ib.appendChild(b);
      this.idleBtns[k] = { b, n };
    }
    // command card
    const card = $('cmdcard'); card.innerHTML = '';
    for (let i = 0; i < 15; i++) {
      const c = el('button', 'cell empty');
      const cv = el('canvas'); c.appendChild(cv);
      const hk = el('span', 'hk', HOTKEYS[i].toUpperCase()); c.appendChild(hk);
      c.addEventListener('mouseenter', (e) => this.showTip(i, c));
      c.addEventListener('mouseleave', () => this.hideTip());
      c.addEventListener('click', (e) => { this.activateCell(i, e.shiftKey); });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      card.appendChild(c);
      this.cells.push({ btn: c, cv, hk, extra: null });
    }
    this.info = $('info');
    this.tip = $('tooltip');
    this.notifs = $('notifs');
    this.updateInset();
  }

  iconBtn(spec, flip) {
    const cv = el('canvas'); cv.width = 40; cv.height = 40;
    const src = art.getIcon(spec);
    paint(cv, src);
    if (flip) cv.style.transform = 'scaleX(-1)';
    return cv;
  }

  updateInset() {
    const ui = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;
    const panel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-h')) || 184;
    this.S.cam.bottomInset = panel * ui;
  }
  bottomHeight() { return 100; }               // bottom edge scroll disabled (HUD panel is there)

  // ============================================================ selection & modes
  onSelection() { this.dirty = true; this.cardPage = 'main'; }
  setPage(p) { this.cardPage = p; this.dirty = true; }
  setModeHint(t) { const m = $('modehint'); if (t) { m.textContent = t; m.classList.remove('hidden'); } else m.classList.add('hidden'); }
  toast(text, kind = 'info') {
    // identical consecutive messages refresh the existing line instead of stacking
    const last = this.notifs.lastElementChild;
    if (last && last._text === text) {
      last._count = (last._count || 1) + 1; last.textContent = `${text} (x${last._count})`;
      last.style.opacity = '1'; clearTimeout(last._t1); clearTimeout(last._t2);
      last._t1 = setTimeout(() => { last.style.opacity = '0'; last._t2 = setTimeout(() => last.remove(), 700); }, kind === 'alert' ? 9000 : 6000);
      return;
    }
    const n = el('div', 'notif ' + kind, text); n._text = text;
    this.notifs.appendChild(n);
    while (this.notifs.children.length > 7) this.notifs.removeChild(this.notifs.firstChild);
    n._t1 = setTimeout(() => { n.style.opacity = '0'; n._t2 = setTimeout(() => n.remove(), 700); }, kind === 'alert' ? 9000 : 6000);
  }
  flashError(text) {
    this.toast(text, 'warn');
    this.S.audio && this.S.audio.play('ui_error');
  }
  banner(title, sub) {
    const b = $('banner'); b.classList.remove('hidden'); b.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('hidden'), 3700);
  }

  // ============================================================ card building
  computeCard() {
    const specs = new Array(15).fill(null);
    const inp = this.input, g = this.game, me = this.me, hi = g.humanIndex;
    const ents = inp.entities().filter(e => e.owner === hi && e.kind !== 'resource');
    if (!ents.length) return specs;
    const units = ents.filter(e => e.kind === 'unit' && !e.def.tags.includes('animal'));
    const blds = ents.filter(e => e.kind === 'building');
    const has = (cond) => units.some(cond);
    if (units.length) {
      if (has(u => u.type === 'villager')) return this.villagerCard(specs, units);
      return this.militaryCard(specs, units);
    }
    if (blds.length) return this.buildingCard(specs, blds);
    return specs;
  }

  uiSpec(i, icon, name, desc, action, opts = {}) {
    return Object.assign({ icon: { glyph: icon }, name, desc, action, enabled: true }, opts);
  }

  villagerCard(specs, units) {
    const me = this.me;
    if (this.cardPage === 'main') {
      specs[0] = this.uiSpec(0, 'ui:build_eco', 'Build Economic Buildings', 'Houses, mills, camps, farms, market and more.', () => this.setPage('eco'));
      specs[1] = this.uiSpec(1, 'ui:build_mil', 'Build Military Buildings', 'Barracks, ranges, stables, defenses and walls.', () => this.setPage('mil'));
      specs[2] = this.uiSpec(2, 'ui:repair', 'Repair', 'Select a damaged building to repair it. (Right-click also repairs.)', () => this.input.beginTarget('repair', 'Click a building to repair'));
      specs[3] = this.uiSpec(3, 'ui:stop', 'Stop', 'Cancel current orders.', () => Cmd.orderStop(this.game, this.input.ownUnits()));
      specs[4] = this.uiSpec(4, 'ui:garrison', 'Garrison', 'Order selected units to garrison inside a building.', () => this.input.beginTarget('garrison', 'Click a building to garrison inside'));
      specs[14] = this.uiSpec(14, 'ui:delete', 'Delete', 'Delete the selected units. (Del)', () => Cmd.orderDelete(this.game, this.input.ownUnits()));
      return specs;
    }
    const list = BUILD_PAGES[this.cardPage] || [];
    list.forEach((id, i) => {
      if (i > 13) return;
      const def = me.bdefs[id];
      if (def.hidden) return;
      const chk = this.buildCheck(def);
      specs[i] = {
        icon: { building: id }, name: def.name, desc: def.desc, cost: def.cost, enabled: chk.ok, reason: chk.reason,
        action: () => { if (chk.ok) this.input.beginPlace(id); else this.flashError(chk.reason); },
      };
    });
    specs[14] = this.uiSpec(14, 'ui:back', 'Back', 'Return to the main villager menu. (Esc)', () => this.setPage('main'));
    return specs;
  }
  buildCheck(def) {
    const me = this.me;
    if (def.ageReq > me.age) return { ok: false, reason: `Requires ${AGE_NAMES[def.ageReq]}` };
    if (def.needs) for (const n of def.needs) if (!me.hasBuilding(n)) return { ok: false, reason: `Requires ${BUILDINGS[n].name}` };
    if (def.id === 'wonder' && me.countBuildings('wonder', false) > 0) return { ok: false, reason: 'You can build only one Wonder' };
    if (!me.canAfford(def.cost)) return { ok: false, reason: 'Not enough resources', soft: true };
    return { ok: true };
  }

  militaryCard(specs, units) {
    const inp = this.input;
    specs[0] = this.uiSpec(0, 'ui:attack_move', 'Attack Move', 'Move to a location, attacking enemies along the way.', () => inp.beginTarget('attackmove', 'Click the destination (units will fight on the way)'));
    specs[1] = this.uiSpec(1, 'ui:stop', 'Stop', 'Cancel current orders.', () => Cmd.orderStop(this.game, inp.ownUnits()));
    if (units.some(u => !u.def.tags.includes('siege'))) specs[2] = this.uiSpec(2, 'ui:garrison', 'Garrison', 'Order selected units to garrison inside a building.', () => inp.beginTarget('garrison', 'Click a building to garrison inside'));
    const monks = units.filter(u => u.def.tags.includes('monk'));
    if (monks.length) specs[3] = this.uiSpec(3, 'ui:convert', 'Convert', 'Right-click an enemy unit to convert it to your side. Right-click a wounded ally to heal.', () => this.toast('Right-click an enemy to convert, or a wounded ally to heal.'));
    const stances = [['aggressive', 'ui:stance_aggressive', 'Aggressive', 'Attack enemies in sight and chase them.'], ['defensive', 'ui:stance_defensive', 'Defensive', 'Attack nearby enemies, then return to position.'],
      ['standground', 'ui:stand_ground', 'Stand Ground', 'Do not move; only fire at enemies in range.'], ['passive', 'ui:stance_passive', 'No Attack', 'Never attack on your own.']];
    const cur = new Set(units.map(u => u.stance));
    stances.forEach(([id, icon, name, desc], k) => {
      specs[5 + k] = this.uiSpec(5 + k, icon, name + ' Stance', desc, () => Cmd.setStance(this.game, inp.ownUnits(), id), { active: cur.size === 1 && cur.has(id) });
    });
    specs[14] = this.uiSpec(14, 'ui:delete', 'Delete', 'Delete the selected units. (Del)', () => Cmd.orderDelete(this.game, inp.ownUnits()));
    return specs;
  }

  buildingCard(specs, blds) {
    const me = this.me, g = this.game, inp = this.input;
    const type = blds[0].type;
    const same = blds.filter(b => b.type === type && b.built);
    const bd = me.bdefs[type];
    if (!blds[0].built) {
      specs[14] = this.uiSpec(14, 'ui:delete', 'Cancel construction', 'Cancel construction and delete the foundation.', () => Cmd.orderDelete(g, blds));
      return specs;
    }
    const pickBuilding = () => same.reduce((a, b) => (b.queue.length < a.queue.length ? b : a), same[0]);
    const slots = BUILDING_SLOTS[type] || [];
    const civ = CIVS[me.civ];
    if (type === 'market') return this.marketCard(specs, blds);
    slots.forEach((slot, i) => {
      if (!slot) return;
      if (slot.line || slot.unique) {
        let line = slot.unique ? civ.uu : slot.line;
        if (slot.onlyIfProduces && !me.producibleLines(type).includes(line)) return;
        const unit = me.unitFor(line);
        const def = me.defs[unit];
        const chk = Cmd.canTrain(g, same[0], line);
        specs[i] = {
          icon: { unit }, name: def.name, desc: def.desc, cost: def.cost, enabled: chk.ok || (chk.reason === 'Not enough resources'), reason: chk.ok ? '' : chk.reason, stats: unitStatLines(def), time: def.time,
          afford: me.canAfford(def.cost), ageLocked: def.ageReq > me.age,
          action: (shift) => { const b = pickBuilding(); const n = Cmd.queueUnit(g, b, line, shift ? 5 : 1); if (!n) this.flashError(g.lastError || 'Cannot train'); else this.S.audio && this.S.audio.play('ui_click'); },
          count: this.queuedCount(same, line),
        };
        if (def.ageReq > me.age) specs[i].enabled = false;
        if (!me.canAfford(def.cost)) specs[i].enabled = false;
        return;
      }
      let chain = slot.tech, id;
      if (slot.elite) chain = [LINES[civ.uu][1]];
      if (slot.civTech) chain = civ.techs;
      id = chain.find(t => !me.techs.has(t));
      if (!id) return;
      const t = TECHS[id];
      if (t.uniqueTo && t.uniqueTo !== me.civ) return;
      const researching = me.researching.has(id);
      const chk = Cmd.canResearch(g, same[0], id);
      const reason = researching ? 'Researching…' : chk.ok ? '' : chk.reason;
      let tier = 0; if (chain.length > 1) tier = chain.indexOf(id) + 1;
      specs[i] = {
        icon: { tech: id }, name: t.name, desc: t.desc, cost: t.cost, enabled: chk.ok, reason, time: t.time, tier,
        action: () => { const b = same.find(x => x.queue.length < 15) || same[0]; if (!Cmd.queueTech(g, b, id)) this.flashError(g.lastError || 'Cannot research'); else this.S.audio && this.S.audio.play('ui_click'); },
        active: researching,
      };
      if (!chk.ok && chk.reason === 'Not enough resources') specs[i].enabled = false;
    });
    if (same[0].garrison.length || blds.some(b => b.garrison.length)) specs[12] = this.uiSpec(12, 'ui:ungarrison', 'Unload', 'Remove all garrisoned units from the building.', () => { for (const b of blds) Cmd.orderUngarrison(g, b); });
    if (bd.produces.length || type === 'town_center') specs[13] = this.uiSpec(13, 'ui:rally', 'Set Rally Point', 'Newly trained units will go to this point. Click a resource to send villagers to gather.', () => inp.beginTarget('rally', 'Click to set the rally point'));
    specs[14] = this.uiSpec(14, 'ui:delete', 'Delete', 'Demolish this building. (Del)', () => Cmd.orderDelete(g, blds));
    return specs;
  }
  queuedCount(bs, line) { let n = 0; for (const b of bs) for (const it of b.queue) if (it.kind === 'unit' && it.line === line) n++; return n; }

  marketCard(specs, blds) {
    const me = this.me, g = this.game;
    const mk = (i, res, dir) => {
      const q = Cmd.marketPrices(g, me, res);
      const price = dir === 'buy' ? q.buy : q.sell;
      specs[i] = {
        icon: { glyph: 'res:' + res }, name: `${dir === 'buy' ? 'Buy' : 'Sell'} ${res[0].toUpperCase() + res.slice(1)}`,
        desc: dir === 'buy' ? `Spend ${price} gold for 100 ${res}. (Shift = ×5)` : `Sell 100 ${res} for ${price} gold. (Shift = ×5)`, enabled: true,
        badge: dir === 'buy' ? '+' : '–', action: (shift) => {
          const n = shift ? 5 : 1; let ok = false;
          for (let k = 0; k < n; k++) ok = Cmd.trade(g, g.humanIndex, res, dir, 100) || ok;
          if (!ok) this.flashError(g.lastError || 'Cannot trade'); else this.S.audio && this.S.audio.play(dir === 'buy' ? 'market_buy' : 'market_sell');
        }, noCost: true, marketPrice: price,
      };
    };
    ['food', 'wood', 'stone'].forEach((r, k) => { mk(k, r, 'buy'); mk(5 + k, r, 'sell'); });
    const civ = CIVS[me.civ];
    const id = ['coinage', 'banking'].find(t => !me.techs.has(t));
    if (id) {
      const t = TECHS[id]; const same = blds.filter(b => b.built);
      const chk = Cmd.canResearch(g, same[0], id);
      specs[4] = { icon: { tech: id }, name: t.name, desc: t.desc, cost: t.cost, enabled: chk.ok, reason: chk.ok ? '' : chk.reason, action: () => { if (!Cmd.queueTech(g, same[0], id)) this.flashError(g.lastError); } };
    }
    specs[14] = this.uiSpec(14, 'ui:delete', 'Delete', 'Demolish this building. (Del)', () => Cmd.orderDelete(g, blds));
    return specs;
  }

  // ============================================================ card rendering
  renderCard() {
    const specs = this.cardSpecs = this.computeCard();
    const me = this.me;
    for (let i = 0; i < 15; i++) {
      const c = this.cells[i], s = specs[i];
      const b = c.btn;
      if (c.extra) { c.extra.forEach(x => x.remove()); c.extra = null; }
      if (!s) { b.className = 'cell empty'; paint(c.cv, null); c.hk.style.display = 'none'; continue; }
      b.className = 'cell' + (s.enabled ? '' : ' off') + (s.active ? ' active' : '');
      c.hk.style.display = ''; c.hk.textContent = HOTKEYS[i].toUpperCase();
      paint(c.cv, this.iconCanvas(s.icon));
      c.extra = [];
      if (s.count) { const n = el('span', 'cnt', String(s.count)); b.appendChild(n); c.extra.push(n); }
      if (s.tier) { const n = el('span', 'badge', ROMAN[Math.min(3, s.tier)]); b.appendChild(n); c.extra.push(n); }
      else if (s.badge) { const n = el('span', 'badge', s.badge); b.appendChild(n); c.extra.push(n); }
      if (s.marketPrice) { const n = el('span', 'cnt', String(s.marketPrice)); b.appendChild(n); c.extra.push(n); }
    }
    this.cardSig = this.signature();
  }

  iconCanvas(ic) {
    const me = this.me, team = me.color;
    if (!ic) return null;
    if (ic.unit) return art.getUnitIcon(ic.unit, team);
    if (ic.building) return art.getBuildingIcon(ic.building, team, me.age);
    if (ic.tech) return this.techIcon(ic.tech, team);
    if (ic.glyph) return art.getIcon(ic.glyph);
    return null;
  }
  techIcon(id, team) {
    const t = TECHS[id]; const spec = t.icon;
    if (spec.startsWith('unit:')) return art.getUnitIcon(spec.slice(5), team);
    return art.getIcon(spec);
  }

  signature() {
    const g = this.game, me = this.me;
    const ents = this.input.entities();
    let s = this.cardPage + '|' + this.input.selVersion + '|' + me.age + '|' + me.techs.size + '|' + me.researching.size;
    for (const e of ents) if (e.kind === 'building') s += '|' + (e.built ? 1 : 0) + (e.garrison.length ? 'g' : '') + e.type;
    // affordability bucket (re-render when affordability of anything may change): coarse
    s += '|' + Math.floor(me.res.food / 25) + ',' + Math.floor(me.res.wood / 25) + ',' + Math.floor(me.res.gold / 25) + ',' + Math.floor(me.res.stone / 25);
    s += '|' + Math.min(1, me.popFree);
    return s;
  }

  activateCell(i, shift) {
    this.refreshCardNow();
    const s = this.cardSpecs[i];
    if (!s) return;
    this.hideTip();
    if (s.action) { this.S.audio && this.S.audio.init(); s.action(shift); this.dirty = true; }
  }
  /** make sure the command card reflects the current selection/page (hotkeys can arrive within the same frame as a change) */
  refreshCardNow() {
    if (this.dirty || this.signature() !== this.cardSig) { this.renderCard(); this.dirty = false; }
  }
  pressHotkey(k, shift) {
    const i = HOTKEYS.indexOf(k);
    if (i < 0) return false;
    this.refreshCardNow();
    const s = this.cardSpecs[i];
    if (!s) return false;
    if (!s.enabled && s.reason === 'Researching…') return true;
    this.activateCell(i, shift);
    return true;
  }

  // ============================================================ tooltips
  showTip(i, cellEl) {
    const s = this.cardSpecs[i];
    if (!s) return;
    const me = this.me;
    let h = `<div class="tt-name">${s.name} <span class="tt-hk">(${HOTKEYS[i].toUpperCase()})</span></div>`;
    if (s.cost && !s.noCost) h += costHtml(s.cost, me, this.resIcons) + (s.time ? `<div class="tt-stat">${Math.round(s.time)}s</div>` : '');
    h += `<div class="tt-desc">${s.desc || ''}</div>`;
    if (s.stats) h += `<div class="tt-stat">${s.stats}</div>`;
    if (s.reason && s.reason !== 'Not enough resources') h += `<div class="tt-warn">${s.reason}</div>`;
    this.tip.innerHTML = h; this.tip.classList.remove('hidden');
    const r = cellEl.getBoundingClientRect(), t = this.tip.getBoundingClientRect();
    this.tip.style.left = Math.max(6, Math.min(window.innerWidth - t.width - 6, r.left)) + 'px';
    this.tip.style.top = (r.top - t.height - 8) + 'px';
  }
  hideTip() { this.tip.classList.add('hidden'); }

  // ============================================================ info panel
  infoSignature() {
    const ents = this.input.entities();
    let s = this.input.selVersion + '|' + ents.length;
    if (ents.length === 1) {
      const e = ents[0];
      s += '|' + e.type + '|' + e.owner;
      if (e.kind === 'building') s += '|' + e.queue.length + '|' + (e.queue[0] ? e.queue[0].id || e.queue[0].type : '') + '|' + e.garrison.length + '|' + (e.built ? 1 : 0) + '|' + this.me.age;
      if (e.kind === 'unit') s += '|' + e.type;
    } else if (ents.length > 1) {
      // composition only (hp bars update separately)
      let n = 0; for (const e of ents) n += e.id; s += '|' + n;
    }
    return s;
  }

  renderInfo() {
    const info = this.info; info.innerHTML = '';
    this.infoRefs = {};
    const ents = this.input.entities();
    const g = this.game, me = this.me, hi = g.humanIndex;
    if (!ents.length) {
      const civ = CIVS[me.civ];
      info.appendChild(el('div', 'info-empty', `<b>${civ.name}</b> — ${AGE_NAMES[me.age]}<br>Select villagers or buildings to give orders.<br><span style="font-size:13px">Right-click to move, gather, build or attack. Press <b>H</b> to find your Town Center.</span>`));
      return;
    }
    if (ents.length === 1) { this.renderSingle(ents[0]); return; }
    // multi-selection grid
    const wrap = el('div', 'multi');
    this.infoRefs.multi = [];
    for (const e of ents.slice(0, 80)) {
      const m = el('div', 'm'); const cv = el('canvas'); m.appendChild(cv);
      paint(cv, e.kind === 'unit' ? art.getUnitIcon(e.type, e.owner === 0 ? 0 : g.players[e.owner].color) : art.getBuildingIcon(e.type, g.players[e.owner].color, g.players[e.owner].age));
      const hp = el('div', 'hp'); const bar = el('i'); hp.appendChild(bar); m.appendChild(hp);
      m.title = (UNITS[e.type] || BUILDINGS[e.type]).name;
      m.onclick = (ev) => {
        if (ev.shiftKey) this.input.setSelection(this.input.sel.filter(id => id !== e.id));
        else if (ev.ctrlKey) this.input.setSelection(ents.filter(x => x.type === e.type).map(x => x.id));
        else this.input.setSelection([e.id]);
      };
      wrap.appendChild(m);
      this.infoRefs.multi.push({ e, hp, bar });
    }
    info.appendChild(wrap);
    info.appendChild(el('div', 'multi-head', `${ents.length} selected`));
  }

  renderSingle(e) {
    const info = this.info, g = this.game, me = this.me;
    const isRes = e.kind === 'resource';
    const owner = g.players[e.owner];
    const mine = e.owner === g.humanIndex;
    const def = isRes ? null : (e.kind === 'unit' ? e.def : e.def);
    const pc = el('div', 'portrait'); const cv = el('canvas');
    if (isRes) paint(cv, art.getResourceIcon ? art.getResourceIcon(e.sub === 'gold' ? 'gold_mine' : e.sub === 'stone' ? 'stone_mine' : e.sub === 'tree' ? 'tree' : 'berries') : null);
    else if (e.kind === 'unit') paint(cv, art.getUnitPortrait(e.type, e.owner === 0 ? 0 : owner.color));
    else paint(cv, art.getBuildingPortrait(e.type, owner.color, owner.age));
    pc.appendChild(cv); info.appendChild(pc);
    const main = el('div', 'info-main'); info.appendChild(main);
    let name;
    if (isRes) name = e.sub === 'tree' ? 'Tree' : e.sub === 'berries' ? 'Berry Bush' : e.sub === 'gold' ? 'Gold Mine' : e.sub === 'stone' ? 'Stone Mine' : (e.animal ? e.animal[0].toUpperCase() + e.animal.slice(1) + ' Carcass' : 'Carcass');
    else name = e.def.name;
    main.appendChild(el('div', 'info-name', name));
    if (isRes) {
      main.appendChild(el('div', 'info-sub', `${Math.ceil(e.amount)} ${e.res} remaining`));
      this.infoRefs.res = e;
      return;
    }
    const sub = e.owner === 0 ? 'Wild' : (mine ? owner.name : `${owner.name} (${CIVS[owner.civ].name})`);
    main.appendChild(el('div', 'info-sub', sub + (e.kind === 'building' && !e.built ? ' — under construction' : '')));
    if (e.owner !== 0 || e.kind === 'building') {
      const hp = el('div', 'hpbar'); const bar = el('i'); const tx = el('span'); hp.appendChild(bar); hp.appendChild(tx); main.appendChild(hp);
      this.infoRefs.hp = { e, bar, tx, hp };
    }
    if (e.kind === 'unit') {
      const d = e.def, st = el('div', 'stats');
      const kv = (k, v) => { st.appendChild(el('span', 'k', k)); st.appendChild(el('span', 'v', v)); };
      const atk = [];
      for (const k in d.atk) { if (k === 'melee' || k === 'pierce') atk.push(`${Math.round(d.atk[k] * 10) / 10}`); }
      let bonus = []; for (const k in d.atk) if (k !== 'melee' && k !== 'pierce') bonus.push(`+${d.atk[k]} vs ${k}`);
      if (atk.length || bonus.length) kv('Attack', `${atk.join('+') || '—'}${bonus.length ? ` <span class="bonus">${bonus.join(', ')}</span>` : ''}`);
      kv('Armor', `${d.armor.melee} / ${d.armor.pierce}`);
      if (d.range) kv('Range', `${d.range}${d.minRange ? ` (min ${d.minRange})` : ''}`);
      kv('Speed', (Math.round(d.speed * 100) / 100).toString());
      if (e.type === 'villager') { this.infoRefs.carry = el('span', 'v', ''); st.appendChild(el('span', 'k', 'Carrying')); st.appendChild(this.infoRefs.carry); }
      main.appendChild(st);
      if (d.heal) main.appendChild(el('div', 'info-desc', 'Heals allies and converts enemies.'));
    } else if (mine || true) {
      const d = e.def;
      const st = el('div', 'stats');
      const kv = (k, v) => { st.appendChild(el('span', 'k', k)); st.appendChild(el('span', 'v', v)); };
      kv('Armor', `${d.armor.melee} / ${d.armor.pierce}`);
      if (d.attack) kv('Attack', `${d.attack.dmg} × ${Math.min(d.attack.maxArrows, d.attack.arrows + e.garrison.filter(u => u.def.tags.includes('infantry') || u.def.tags.includes('archer')).length)} arrows`);
      if (d.pop) kv('Housing', `+${d.pop}`);
      if (d.garrison) kv('Garrison', `${e.garrison.length} / ${d.garrison}`);
      if (e.type === 'farm') kv('Food left', `${Math.ceil(e.amount)}`);
      main.appendChild(st);
      if (!e.built) main.appendChild(el('div', 'info-desc', `Construction ${Math.floor(e.progress * 100)}%`));
      else if (!st.children.length) main.appendChild(el('div', 'info-desc', d.desc));
    }
    // side: production queue
    if (e.kind === 'building' && mine && e.built && (e.queue.length || e.garrison.length)) {
      const side = el('div', 'info-side'); info.appendChild(side);
      if (e.queue.length) {
        side.appendChild(el('div', 'sidehead', e.queue[0].kind === 'tech' ? 'Researching' : 'Training'));
        const q = el('div', 'queue'); side.appendChild(q);
        this.infoRefs.queue = [];
        e.queue.forEach((it, idx) => {
          const qd = el('div', 'q' + (it.blocked ? ' blocked' : '')); const c2 = el('canvas'); qd.appendChild(c2);
          paint(c2, it.kind === 'unit' ? art.getUnitIcon(it.type, me.color) : this.techIcon(it.id, me.color));
          const pr = el('div', 'prog'); const bar = el('i'); pr.appendChild(bar); qd.appendChild(pr);
          qd.title = (it.kind === 'unit' ? UNITS[it.type].name : TECHS[it.id].name) + ' — click to cancel';
          qd.onclick = () => { Cmd.cancelQueueItem(g, e, e.queue.indexOf(it)); this.dirty = true; this.S.audio && this.S.audio.play('ui_click'); };
          q.appendChild(qd);
          this.infoRefs.queue.push({ it, bar, qd });
        });
      }
      if (e.garrison.length) {
        side.appendChild(el('div', 'sidehead', `Garrisoned (${e.garrison.length})`));
        const q = el('div', 'queue'); side.appendChild(q);
        for (const u of e.garrison.slice(0, 15)) {
          const qd = el('div', 'q'); const c2 = el('canvas'); qd.appendChild(c2); paint(c2, art.getUnitIcon(u.type, g.players[u.owner].color));
          qd.title = u.def.name + ' — click to unload';
          qd.onclick = () => { g.ungarrisonUnit(u, e); this.dirty = true; };
          q.appendChild(qd);
        }
      }
    }
    if (e.type === 'market' && mine && e.built) {
      const side = el('div', 'info-side'); info.appendChild(side);
      side.appendChild(el('div', 'sidehead', 'Trade prices (per 100)'));
      const mp = el('div', 'market-panel'); side.appendChild(mp);
      this.infoRefs.market = mp;
    }
  }

  updateInfoDynamic() {
    const r = this.infoRefs; if (!r) return;
    const g = this.game;
    if (r.hp) {
      const { e, bar, tx, hp } = r.hp; const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
      bar.style.width = (f * 100) + '%'; tx.textContent = `${Math.ceil(e.hp)} / ${e.maxHp}`;
      hp.className = 'hpbar' + (f < 0.3 ? ' low' : f < 0.6 ? ' mid' : '');
    }
    if (r.carry) { const e = this.input.entities()[0]; r.carry.textContent = e && e.carry >= 1 ? `${Math.floor(e.carry)} ${e.carryType}` : '—'; }
    if (r.queue) for (const q of r.queue) { const f = 1 - Math.max(0, q.it.left) / q.it.total; q.bar.style.width = ((q.it.started || q.it.kind === 'tech' ? f : 0) * 100) + '%'; }
    if (r.multi) for (const m of r.multi) { const f = Math.max(0, Math.min(1, m.e.hp / m.e.maxHp)); m.bar.style.width = f * 100 + '%'; m.hp.className = 'hp' + (f < 0.3 ? ' low' : f < 0.6 ? ' mid' : ''); }
    if (r.res) { const sub = this.info.querySelector('.info-sub'); if (sub) sub.textContent = `${Math.ceil(r.res.amount)} ${r.res.res} remaining`; }
    if (r.market) {
      const me = this.me; let h = '';
      for (const res of ['food', 'wood', 'stone']) { const q = Cmd.marketPrices(g, me, res); h += `<div><b>${res[0].toUpperCase() + res.slice(1)}</b><br>buy ${q.buy} · sell ${q.sell}</div>`; }
      if (r.market._h !== h) { r.market.innerHTML = h; r.market._h = h; }
    }
  }

  // ============================================================ per-frame update
  update(dt) {
    const g = this.game, me = this.me;
    this.tick += dt;
    // resource bar
    for (const r of RES) {
      const v = Math.floor(me.res[r]);
      const e = this.resEls[r];
      if (e._v !== v) { e.val.textContent = v; e._v = v; }
    }
    const popTxt = `${me.pop}/${me.popCap}`;
    if (this.popEl._t !== popTxt) { this.popEl.val.textContent = popTxt; this.popEl._t = popTxt; }
    this.popEl.box.classList.toggle('low', me.pop >= me.popCap - 1 && me.popCap < 200);
    if (this.tick > 0.5) {
      this.tick = 0;
      this.slowUpdate();
    }
    // notifications
    while (this.msgIdx < g.messages.length) {
      const m = g.messages[this.msgIdx++];
      this.toast(m.text, m.kind === 'alert' ? 'alert' : m.kind === 'good' ? 'good' : m.kind === 'warn' ? 'warn' : m.kind === 'chat' ? 'chat' : 'info');
    }
    // card/info refresh
    if (this.dirty || this.signature() !== this.cardSig) { this.renderCard(); this.dirty = false; }
    const isig = this.infoSignature();
    if (isig !== this.infoSig) { this.infoSig = isig; this.renderInfo(); }
    this.updateInfoDynamic();
    this.updateTipLive();
    this.updateHoverLabel(dt);
    // clock
    const t = Math.floor(g.time);
    const clock = $('clock'); const ts = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    if (clock.textContent !== ts) clock.textContent = ts;
  }

  updateTipLive() { /* tooltips are static while shown */ }

  updateHoverLabel(dt) {
    const lab = this.hoverEl || (this.hoverEl = $('hoverlabel'));
    const inp = this.input, g = this.game;
    const id = inp.mode.type === 'normal' && !inp.drag && inp.mouse.inside ? inp.hover : 0;
    if (id !== this._hid) { this._hid = id; this._ht = 0; lab.classList.add('hidden'); }
    if (!id) return;
    this._ht += dt;
    if (this._ht < 0.3) return;
    const e = g.byId.get(id);
    if (!e || e.dead) { lab.classList.add('hidden'); return; }
    let html;
    if (e.kind === 'resource') {
      const nm = e.sub === 'tree' ? 'Tree' : e.sub === 'berries' ? 'Berry Bush' : e.sub === 'gold' ? 'Gold Mine' : e.sub === 'stone' ? 'Stone Mine' : 'Carcass';
      html = `<b>${nm}</b> <small>${Math.ceil(e.amount)} ${e.res}</small>`;
    } else {
      const owner = g.players[e.owner];
      const nm = e.def.name;
      const who = e.owner === 0 ? 'Wild' : e.owner === g.humanIndex ? 'You' : owner.name;
      const col = e.owner === 0 ? '#c8b46a' : PLAYER_COLORS_HEX[owner.color];
      html = `<b>${nm}</b> <small style="color:${col}">${who}</small>` + (e.kind === 'building' && !e.built ? ' <small>(building)</small>' : '');
    }
    if (lab._h !== html) { lab.innerHTML = html; lab._h = html; }
    lab.classList.remove('hidden');
    const x = Math.min(window.innerWidth - lab.offsetWidth - 8, inp.mouse.x + 16), y = Math.min(window.innerHeight - 40, inp.mouse.y + 20);
    lab.style.left = x + 'px'; lab.style.top = y + 'px';
  }

  slowUpdate() {
    const g = this.game, me = this.me, hi = g.humanIndex;
    // age badge
    const ageKey = me.age + me.civ;
    if (this.ageEl._k !== ageKey) {
      this.ageEl._k = ageKey; this.ageEl.innerHTML = '';
      const cv = el('canvas'); this.ageEl.appendChild(cv); paint(cv, art.getIcon('age:' + me.age));
      this.ageEl.appendChild(el('span', '', `${CIVS[me.civ].name} — ${AGE_NAMES[me.age]}`));
    }
    // gather counts + military + idle
    const cnt = { food: 0, wood: 0, gold: 0, stone: 0 };
    let mil = 0, idleV = 0, idleM = 0, allM = 0;
    for (const u of g.units) {
      if (u.owner !== hi || u.dead) continue;
      if (u.type === 'villager') {
        if (u.order && u.order.type === 'gather') { const k = u.order.res || u.carryType; if (cnt[k] !== undefined) cnt[k]++; }
        if (!u.order && !u.garrison && !u.queue.length) idleV++;
      } else if (u.def.military) { mil++; allM++; if (!u.order && !u.garrison && !u.def.tags.includes('siege')) idleM++; }
    }
    for (const r of RES) this.resEls[r].gather.textContent = cnt[r] ? cnt[r] : '';
    this.milEl.textContent = mil;
    const setIdle = (k, n) => { const b = this.idleBtns[k]; b.n.textContent = n; b.b.classList.toggle('dim', n === 0); b.b.classList.toggle('flash', k === 'v' && n > 0 && this.S.settings.hints); };
    setIdle('v', idleV); setIdle('m', idleM); setIdle('a', allM);
    // resources flash red when low during need? (skip) -- hints
    if (this.S.settings.hints) this.advisor();
    $('speedlabel').textContent = this.S.speed.toFixed(this.S.speed % 1 ? 1 : 0) + 'x';
  }

  // ============================================================ advisor hints
  showHint(id, html, force) {
    if (!force && this.hintShown.has(id)) return false;
    if (this.hintCool > 0 && !force) return false;
    this.hintShown.add(id);
    const h = $('hint'); h.innerHTML = '';
    h.appendChild(el('div', '', html));
    const x = el('button', '', '✕'); x.onclick = () => h.classList.add('hidden'); h.appendChild(x);
    h.classList.remove('hidden');
    clearTimeout(this._ht); this._ht = setTimeout(() => h.classList.add('hidden'), 14000);
    this.hintCool = 3;
    return true;
  }
  advisor() {
    const g = this.game, me = this.me, hi = g.humanIndex;
    this.hintCool = Math.max(0, this.hintCool - 0.5);
    const t = g.time;
    const tcs = g.buildings.filter(b => b.owner === hi && b.type === 'town_center' && b.built && !b.dead);
    const vills = g.units.filter(u => u.owner === hi && u.type === 'villager' && !u.dead);
    if (t < 20) this.showHint('welcome', `Welcome, my lord! Select your villagers and <b>right-click</b> a tree or berry bush to gather. Train more villagers from your Town Center (select it, press <b>Q</b>).`);
    else if (t > 25 && me.pop >= me.popCap - 1 && me.popCap < 200 && !g.buildings.some(b => b.owner === hi && b.type === 'house' && !b.built)) this.showHint('house' + Math.floor(t / 120), 'You are nearly <b>out of housing</b>. Select a villager → <b>Q</b> (Economic) → <b>Q</b> (House) and build another house.', false);
    else if (t > 40 && !g.buildings.some(b => b.owner === hi && b.type === 'mill') && me.res.wood >= 100) this.showHint('mill', 'Build a <b>Mill</b> next to the berry bushes so villagers drop off food quickly: villager → <b>Q</b> → <b>W</b>.');
    else if (t > 90 && !g.buildings.some(b => b.owner === hi && b.type === 'lumber_camp') && me.res.wood >= 100) this.showHint('lumber', 'A <b>Lumber Camp</b> beside the forest shortens woodcutters\' walks: villager → <b>Q</b> → <b>E</b>.');
    else if (tcs.length && tcs.every(b => !b.queue.length) && me.res.food >= 50 && me.popFree > 0 && vills.length < 70 && t > 30) this.showHint('tcidle' + Math.floor(t / 90), 'Your Town Center is <b>idle</b>. Keep training villagers — hold <b>Shift</b> to queue five.', false);
    else if (me.age === 0 && me.res.food >= 500 && t > 120) this.showHint('feudal', 'You can advance to the <b>Feudal Age</b> (500 food). Build two different buildings first (e.g. Mill + Lumber Camp), then select your Town Center and press <b>T</b>.');
    else if (me.age === 1 && !g.buildings.some(b => b.owner === hi && b.type === 'barracks') && me.res.wood >= 175) this.showHint('barracks', 'Build a <b>Barracks</b> (villager → <b>W</b> → <b>Q</b>) to train soldiers — the rival will attack eventually!');
    const enemyNear = g.units.some(u => u.owner !== hi && u.owner !== 0 && !u.dead && g.isEnemy(hi, u.owner) && u.def.military && tcs.some(tc => Math.hypot(tc.x - u.x, tc.y - u.y) < 22) && g.vision.isVisible(hi, u.x, u.y));
    if (enemyNear) this.showHint('raid' + Math.floor(t / 150), '<b>Enemy soldiers approach!</b> Select your army and right-click to fight, or garrison villagers in the Town Center (select them, right-click the Town Center).', false);
  }
}
