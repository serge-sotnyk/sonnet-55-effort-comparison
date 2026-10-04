'use strict';
// ---- input, HUD, command card ----
const $ = id => document.getElementById(id);
const ui = { sel: [], selSet: new Set(), hover: null, marks: [], place: null, amode: false, mx: 0, my: 0, mouseIn: false, drag: null, groups: {}, rawx: 500, rawy: 300, rawIn: false, sig: '', idleI: 0, shift: false, ctrl: false, lastClick: { t: 0, x: 0, y: 0 }, pan: null, lastAlertPos: null, hoverT: 0 };
const SLOTKEYS = 'qwerasdfzxcv';

function setSel(list) {
  const seen = new Set(), out = [];
  for (const e of list) if (e && !e.dead && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
  ui.sel = out; ui.selSet = seen; ui.sig = ''; ui.place = null; ui.amode = false;
}
function centerOn(x, y) { const [X, Y] = proj(x, y); cam.x = X - VW / 2 / cam.z; cam.y = Y - (VH / 2 - 20) / cam.z; clampCam(); }
function clampCam() {
  const vw = VW / cam.z, vh = VH / cam.z;
  cam.x = Math.max(-OX - 120, Math.min(OX + 120 - vw, cam.x)); cam.y = Math.max(-80, Math.min(N * 32 + 120 - vh, cam.y));
  if (vw > 2 * OX + 240) cam.x = -vw / 2;
}
function toast(text, bad) {
  const box = $('msgs'), d = document.createElement('div'); d.className = 'msg' + (bad ? ' bad' : ''); d.textContent = text; box.appendChild(d);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 600); }, 3800);
}
const own = () => ui.sel.filter(e => e.type === 'unit' && e.owner === 0);

// ---- picking ----
function pickAt(sx, sy) {
  const px = sx / cam.z + cam.x, py = sy / cam.z + cam.y;
  let best = null, bd = 1e9;
  for (const u of U) {
    if (u.dead || (u.owner !== 0 && !visAt(u.x, u.y))) continue;
    const [X, Y] = proj(u.x, u.y), dx = px - X, dy = py - (Y - 12), big = u.cls === 'cav' || u.cls === 'siege', rx = big ? 17 : 10, ry = big ? 20 : 15;
    if (Math.abs(dx) < rx && dy > -ry && dy < ry) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = u; } }
  }
  if (best) return best;
  let ck = -1;
  const [wx, wy] = unproj(px, py);
  for (const b of B) {
    if (b.dead || (b.owner !== 0 && !expAt(b.x, b.y))) continue;
    if (b.kind === 'farm') { if (wx >= b.bx && wx < b.bx + b.s && wy >= b.by && wy < b.by + b.s && ck < 0) { ck = 0; best = b; } continue; }
    const sp = SPR.b[b.kind][b.owner], [X, Y] = proj(b.x, b.y);
    if (sprHit(sp, px - (X - sp.ax), py - (Y - sp.ay))) { const k = b.x + b.y + 1; if (k > ck) { ck = k; best = b; } }
  }
  for (const r of R) {
    if (r.dead || !G.explored[r.ty * N + r.tx]) continue;
    const [X, Y] = proj(r.x, r.y); if (Math.abs(px - X) > 34 || py > Y + 8 || py < Y - 85) continue;
    const sp = r.kind === 'tree' ? TREES[r.v] : SPR[r.kind];
    if (sprHit(sp, px - (X - sp.ax), py - (Y - sp.ay))) { const k = r.x + r.y; if (k > ck) { ck = k; best = r; } }
  }
  return best;
}

// ---- commands from selection ----
function startPlace(kind) {
  const p = P(0), d = BLDS[kind];
  if (!own().some(u => u.cls === 'vil')) return;
  if (p.age < d.age) { toast('Requires ' + AGES[d.age], true); return; }
  if (!canAfford(p, d.cost)) { toast('Not enough resources', true); S('click'); return; }
  ui.place = { kind, bx: 0, by: 0, ok: false }; ui.amode = false; S('click');
}
function doRightClick(sx, sy) {
  if (ui.place) { ui.place = null; return; }
  if (ui.amode) { ui.amode = false; return; }
  const [wx, wy] = screenToWorld(sx, sy);
  if (wx < 0 || wy < 0 || wx > N || wy > N) return;
  const t = pickAt(sx, sy), mine = own();
  if (mine.length) {
    const vils = mine.filter(u => u.cls === 'vil'), mark = (c) => ui.marks.push({ x: wx, y: wy, t: 0, c });
    if (t && t.owner === 1 && (t.type === 'unit' || t.type === 'bld')) {
      for (const u of mine) cmdAttack(u, t); ui.marks.push({ x: t.x, y: t.y, t: 0, c: '#ff5a4a' }); S('click'); return;
    }
    if (t && t.type === 'bld' && t.owner === 0 && (!t.done || t.hp < t.maxhp) && vils.length) {
      for (const u of vils) cmdBuild(u, t); const rest = mine.filter(u => u.cls !== 'vil'); if (rest.length) groupMove(rest, wx, wy, false); ui.marks.push({ x: t.x, y: t.y, t: 0, c: '#ffe08a' }); return;
    }
    if (t && vils.length && (t.type === 'res' || (t.type === 'bld' && t.kind === 'farm' && t.owner === 0 && t.done))) {
      for (const u of vils) cmdGather(u, t); const rest = mine.filter(u => u.cls !== 'vil'); if (rest.length) groupMove(rest, wx, wy, false); ui.marks.push({ x: t.x, y: t.y, t: 0, c: '#ffe08a' }); return;
    }
    groupMove(mine, wx, wy, false); mark('#6dff7a'); return;
  }
  const b = ui.sel[0];
  if (b && b.type === 'bld' && b.owner === 0 && b.def.trains) {
    const ent = t && (t.type === 'res' || (t.type === 'bld' && t.owner === 0 && t.rt) || (t.type === 'bld' && t.owner === 0 && !t.done)) ? t : null;
    b.rally = { x: ent ? ent.x : wx, y: ent ? ent.y : wy, ent }; ui.marks.push({ x: wx, y: wy, t: 0, c: '#9fe8ff' }); toast('Rally point set');
  }
}
function doLeftClick(sx, sy, shift) {
  if (ui.place) {
    const pl = ui.place, vils = own().filter(u => u.cls === 'vil');
    if (!pl.ok) { toast(canPlace(pl.kind, pl.bx, pl.by, 0) ? 'Requires ' + AGES[BLDS[pl.kind].age] : 'Cannot build there', true); return; }
    // nearest builders first; all selected villagers help
    const b = placeBuilding(0, pl.kind, pl.bx, pl.by, vils, shift);
    if (b) { ui.marks.push({ x: b.x, y: b.y, t: 0, c: '#ffe08a' }); const aff = canAfford(P(0), BLDS[pl.kind].cost); if (!(shift && aff)) ui.place = null; else ui.place = { kind: pl.kind, bx: 0, by: 0, ok: false }; }
    return;
  }
  if (ui.amode) {
    ui.amode = false; const [wx, wy] = screenToWorld(sx, sy), m = own(); if (m.length) { groupMove(m, wx, wy, true); ui.marks.push({ x: wx, y: wy, t: 0, c: '#ff5a4a' }); S('click'); } return;
  }
  const t = pickAt(sx, sy);
  if (!t) { if (!shift) setSel([]); return; }
  if (shift && t.type === 'unit' && t.owner === 0 && ui.sel.length && ui.sel[0].type === 'unit' && ui.sel[0].owner === 0) {
    if (ui.selSet.has(t.id)) setSel(ui.sel.filter(e => e !== t)); else setSel(ui.sel.concat([t]));
  } else setSel([t]);
  S('click');
}
function boxSelect(x0, y0, x1, y1, shift) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1), ya = Math.min(y0, y1), yb = Math.max(y0, y1), list = [];
  for (const u of U) {
    if (u.dead || u.owner !== 0) continue;
    const [X, Y] = proj(u.x, u.y), sx = (X - cam.x) * cam.z, sy = (Y - 10 - cam.y) * cam.z;
    if (sx >= xa && sx <= xb && sy >= ya && sy <= yb) list.push(u);
  }
  if (!list.length) return;
  setSel(shift && ui.sel.length && ui.sel[0].type === 'unit' && ui.sel[0].owner === 0 ? ui.sel.concat(list) : list); S('click');
}
function selectSimilar(t) {
  if (!t || t.owner !== 0) return;
  const list = [];
  const on = (x, y) => { const [X, Y] = proj(x, y), sx = (X - cam.x) * cam.z, sy = (Y - cam.y) * cam.z; return sx > 0 && sx < VW && sy > 0 && sy < VH; };
  if (t.type === 'unit') { for (const u of U) if (!u.dead && u.owner === 0 && u.kind === t.kind && on(u.x, u.y)) list.push(u); }
  else if (t.type === 'bld') { for (const b of B) if (!b.dead && b.owner === 0 && b.kind === t.kind && on(b.x, b.y)) list.push(b); }
  if (list.length) setSel(list);
}
function selectIdle() {
  const l = U.filter(u => !u.dead && u.owner === 0 && u.cls === 'vil' && u.ord === 'idle');
  if (!l.length) { toast('No idle villagers'); return; }
  const u = l[ui.idleI++ % l.length]; setSel([u]); centerOn(u.x, u.y);
}
function selectTC() { const tc = B.find(b => b.owner === 0 && b.kind === 'tc' && !b.dead); if (tc) { setSel([tc]); centerOn(tc.x, tc.y); } }

// ---- command card ----
function costHTML(c, p) { let s = ''; for (const k of ['f', 'w', 'g', 's']) if (c[k]) s += `<span style="color:${p.res[k] >= c[k] ? '#fff3cf' : '#ff7a6a'}">${RES_ICON[k]}${c[k]}</span> `; return s; }
function unitTip(k) { const d = UNITS[k]; return `${d.desc}<br><span style="color:#b8a878">HP ${d.hp} · Atk ${d.atk} · Armor ${d.aM}/${d.aP}${d.rng > 1.5 ? ' · Range ' + d.rng : ''} · ${d.time}s</span>`; }
function cmdCard() {
  const slots = new Array(12).fill(null), sel = ui.sel, p = P(0);
  if (!sel.length || sel[0].owner !== 0) return slots;
  const f = sel[0];
  if (f.type === 'unit') {
    const mine = own(), vil = mine.some(u => u.cls === 'vil'), mil = mine.some(u => u.cls !== 'vil');
    if (vil && !mil) {
      BUILD_MENU.forEach((k, i) => {
        const d = BLDS[k], lock = p.age < d.age;
        slots[i] = { ic: d.ic, name: d.n, cost: d.cost, lock: lock ? AGES[d.age] : null, dis: lock || !canAfford(p, d.cost), tip: d.desc + ` <br><span style="color:#b8a878">HP ${d.hp} · ${d.size}×${d.size}</span>`, run: () => startPlace(k) };
      });
      slots[0].hot = 'Build';
    } else {
      slots[0] = { ic: '⚔️', name: 'Attack Move', tip: 'Move to a point, attacking enemies on the way. Then left-click the destination.', run: () => { ui.amode = true; ui.place = null; } };
      slots[1] = { ic: '✋', name: 'Stop', tip: 'Cancel orders.', run: () => { for (const u of mine) cmdStop(u); } };
      if (vil) slots[2] = { ic: '🛠️', name: 'Build', tip: 'Select only villagers to access the build menu.', dis: true, run: () => { } };
    }
  } else if (f.type === 'bld' && f.done) {
    let i = 0; const d = f.def;
    for (const k of d.trains || []) {
      const ud = UNITS[k], lock = p.age < ud.age;
      slots[i++] = { ic: ud.ic, name: ud.n + ' (' + ud.pop + ' pop)', cost: ud.cost, lock: lock ? AGES[ud.age] : null, dis: lock || !canAfford(p, ud.cost), tip: unitTip(k) + '<br><i style="color:#a89870">Shift-click: queue 5</i>', run: () => { const n = queueUnit(f, k, ui.shift ? 5 : 1); if (n) S('click'); } };
    }
    for (const id of d.techs || []) {
      const t = TECHS[id]; if (p.techs[id] || (t.req && !p.techs[t.req])) continue;
      const q = techQueued(0, id), lock = p.age < t.age;
      slots[i++] = { ic: t.ic, name: t.n, cost: t.cost, lock: lock ? AGES[t.age] : null, dis: q || lock || !canAfford(p, t.cost), tip: t.desc + ` <br><span style="color:#b8a878">${t.time}s</span>`, run: () => { if (queueTech(f, id)) S('click'); } };
    }
    if (f.kind === 'tc' && p.age < 3) {
      const n = p.age + 1, c = AGE_UP[n].c, q = p.ageUp;
      slots[11] = { ic: '👑', name: 'Advance to ' + AGES[n], cost: c, age: true, dis: q || !canAfford(p, c), tip: 'Unlocks new buildings, units and technologies.<br><span style="color:#b8a878">' + AGE_UP[n].t + 's</span>', run: () => { if (queueAge(f)) S('click'); } };
    }
  }
  return slots;
}
function renderCmds() {
  const box = $('cmds'), slots = cmdCard(), p = P(0); ui.slots = slots; box.innerHTML = '';
  slots.forEach((s, i) => {
    const b = document.createElement('div'); b.className = 'btn' + (s ? (s.dis ? ' dis' : '') + (s.lock ? ' lock' : '') + (s.age ? ' age' : '') : ' empty'); b.dataset.i = i;
    if (s) b.innerHTML = `<span class="k">${SLOTKEYS[i].toUpperCase()}</span><span class="ic">${s.lock ? '🔒' : s.ic}</span><span class="c">${s.lock ? s.lock : s.cost ? costHTML(s.cost, p) : s.name.length > 12 ? '' : s.name}</span>`;
    box.appendChild(b);
  });
}
function cmdSig() {
  const p = P(0), parts = [ui.sel.map(e => e.id).join(','), p.age, ui.sel[0] && ui.sel[0].type === 'bld' ? ui.sel[0].done + ':' + ui.sel[0].q.map(q => q.kind || q.tech || 'a').join('/') : '', ui.sel[0] && ui.sel[0].type === 'unit' ? own().some(u => u.cls === 'vil') + '' + own().some(u => u.cls !== 'vil') : ''];
  const s = ui.slots; if (s) for (const x of cmdCard()) parts.push(x ? (x.dis ? 0 : 1) + (x.lock ? 'L' : '') + x.name : '-'); return parts.join('|');
}
function runSlot(i) { const s = ui.slots && ui.slots[i]; if (s && !s.dis && s.run) { s.run(); ui.sig = ''; return true; } else if (s && s.dis && s.lock) toast('Requires ' + s.lock, true); else if (s && s.dis && s.cost) toast('Not enough resources', true); return false; }

// ---- info panel ----
function resName(r) { return { tree: 'Tree', berry: 'Berry Bush', gold: 'Gold Mine', stone: 'Stone Mine' }[r.kind]; }
function infoHTML() {
  const sel = ui.sel;
  if (!sel.length) return `<div class="isub" style="padding-top:8px;line-height:1.7"><div class="ititle">${P(0).name}</div>Left-click to select · Drag to box-select · Right-click to command<br>Villagers: pick a building from the card and click on the map to place it.<br>Keep building <b>Houses</b> — population is capped by your housing.<br>Press <b>H</b> for the Town Center, <b>.</b> for idle villagers.</div>`;
  const f = sel[0];
  if (sel.length > 1) {
    const cnt = {}; for (const u of sel) cnt[u.kind] = (cnt[u.kind] || 0) + 1;
    return `<div class="ititle">${sel.length} units selected</div><div class="isub">${Object.keys(cnt).map(k => UNITS[k].n + ' ×' + cnt[k]).join(' · ')}</div><div class="multi" style="margin-top:6px">${sel.slice(0, 40).map(u => `<div class="mi" data-id="${u.id}" title="${u.st.name}">${u.def.ic}<i id="mh${u.id}" style="width:${Math.max(0, u.hp / u.maxhp * 100) * .94}%"></i></div>`).join('')}</div>`;
  }
  if (f.type === 'res') return `<div class="irow"><div class="port" style="font-size:40px">${{ tree: '🌲', berry: '🫐', gold: '🪙', stone: '🪨' }[f.kind]}</div><div><div class="ititle">${resName(f)}</div><div class="isub">Contains <span id="ramt">${Math.ceil(f.amt)}</span> ${RES_NAME[f.rt]}</div></div></div>`;
  const own0 = f.owner === 0, col = COL[f.owner], tag = own0 ? '' : ' <span style="color:#ff8a7a">(Enemy)</span>';
  if (f.type === 'unit') {
    const s = f.st;
    return `<div class="irow"><div class="port" style="background:radial-gradient(${col.l},${col.d})">${f.def.ic}</div><div><div class="ititle">${s.name}${tag}</div><div class="hpbar"><i id="hpf"></i></div><div class="isub" id="hpt"></div>
    <div class="stats"><span>⚔ ${s.atk.toFixed(0)}${s.bonus && Object.keys(s.bonus).length ? ' (+' + Object.entries(s.bonus).map(([k, v]) => v + ' vs ' + k).join(', ') + ')' : ''}</span><span>🛡 ${s.aM.toFixed(0)} / ${s.aP.toFixed(0)}</span>${s.rng > 1.5 ? `<span>🎯 ${s.rng.toFixed(1)}</span>` : ''}<span>⚡ ${s.spd.toFixed(1)}</span></div><div class="isub" id="act"></div></div></div>`;
  }
  const b = f, d = b.def;
  let h = `<div class="irow"><div class="port" style="background:radial-gradient(${col.l},${col.d})">${d.ic}</div><div style="flex:1"><div class="ititle">${d.n}${tag}</div><div class="hpbar"><i id="hpf"></i></div><div class="isub" id="hpt"></div>`;
  if (!b.done) h += `<div class="isub">Under construction… <span id="bprog"></span></div>`;
  else if (own0) {
    h += `<div class="isub">${d.desc}</div>`;
    if (b.q.length) h += `<div class="queue">${b.q.map((q, i) => `<div class="qi" data-i="${i}" title="Click to cancel">${q.kind ? UNITS[q.kind].ic : q.tech ? TECHS[q.tech].ic : '👑'}${i === 0 ? '<i id="qp0" style="width:0"></i>' : ''}</div>`).join('')}</div>`;
    if (d.trains) h += `<div class="isub" style="margin-top:4px">Right-click the map to set a rally point.</div>`;
    if (b.rt) h += `<div class="isub">Food left: <span id="ramt">${Math.ceil(b.amt)}</span></div>`;
  }
  return h + '</div></div>';
}
function updateInfoDyn() {
  const f = ui.sel[0]; if (!f) return;
  if (ui.sel.length > 1) { for (const u of ui.sel) { const e = $('mh' + u.id); if (e) e.style.width = Math.max(0, u.hp / u.maxhp * 94) + '%'; } return; }
  if (f.type === 'res') { const e = $('ramt'); if (e) e.textContent = Math.ceil(f.amt); return; }
  const hf = $('hpf'), ht = $('hpt'), fr = Math.max(0, f.hp / f.maxhp);
  if (hf) { hf.style.width = fr * 100 + '%'; hf.style.background = fr > .6 ? '#4cc24c' : fr > .3 ? '#e2c130' : '#d93a2e'; }
  if (ht) ht.textContent = Math.ceil(f.hp) + ' / ' + Math.ceil(f.maxhp);
  if (f.type === 'unit') {
    const a = $('act'); if (a && f.owner === 0) { const o = f.ord; let t = { idle: 'Idle', move: 'Moving', attack: 'Attacking', amove: 'Attack-moving', build: 'Building', repair: 'Repairing', gather: f.ph === 'drop' ? 'Returning resources' : 'Gathering ' + (f.tgt ? RES_NAME[f.tgt.rt] : '') }[o] || ''; if (f.carry >= 1) t += ` · carrying ${Math.floor(f.carry)} ${RES_ICON[f.ct]}`; a.textContent = t; }
  } else {
    const bp = $('bprog'); if (bp) bp.textContent = Math.floor(f.prog * 100) + '%';
    const qp = $('qp0'); if (qp && f.q[0]) qp.style.width = (1 - f.q[0].t / f.q[0].T) * 100 + '%';
    const r = $('ramt'); if (r) r.textContent = Math.ceil(f.amt);
  }
}
let lastInfoSig = null;
function updateHUD() {
  const p = P(0), pi = popInfo(p);
  $('rf').textContent = Math.floor(p.res.f); $('rw').textContent = Math.floor(p.res.w); $('rg').textContent = Math.floor(p.res.g); $('rs').textContent = Math.floor(p.res.s);
  const rp = $('rp'); rp.textContent = pi.used + '/' + pi.cap; rp.className = pi.used >= pi.cap ? 'full' : '';
  $('age').textContent = AGES[p.age] + (p.ageUp ? '  ▸ advancing…' : '');
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60); $('clock').textContent = m + ':' + (s < 10 ? '0' : '') + s;
  let idle = 0; for (const u of U) if (!u.dead && u.owner === 0 && u.cls === 'vil' && u.ord === 'idle') idle++; $('idlen').textContent = idle;
  ui.sel = ui.sel.filter(e => !e.dead); if (ui.sel.length !== ui.selSet.size) { ui.selSet = new Set(ui.sel.map(e => e.id)); ui.sig = ''; }
  const infoSig = ui.sel.map(e => e.id).join(',') + (ui.sel.length === 1 ? (ui.sel[0].done + ':' + (ui.sel[0].q ? ui.sel[0].q.map(q => q.kind || q.tech || 'a').join('/') : '') + ui.sel[0].st?.name) : '');
  if (infoSig !== lastInfoSig) { lastInfoSig = infoSig; $('info').innerHTML = infoHTML(); }
  const cs = cmdSig(); if (cs !== ui.sig) { ui.sig = cs; renderCmds(); }
  updateInfoDyn();
  const h = $('hint'); h.textContent = ui.place ? 'Left-click to place (hold Shift for more) · Right-click / Esc to cancel' : ui.amode ? 'Attack-move: left-click a destination · Esc to cancel' : '';
  for (const a of G.alerts) if (!a.shown) { a.shown = true; toast(a.text, a.bad); if (a.x !== undefined) ui.lastAlertPos = { x: a.x, y: a.y }; }
  G.alerts = G.alerts.filter(a => a.ping && G.t - a.t < 4);
}

// ---- tooltips ----
function showTip(i, el) {
  const s = ui.slots && ui.slots[i]; if (!s) return hideTip();
  const t = $('tip'), p = P(0);
  t.innerHTML = `<h4>${s.name} <span style="color:#a89870;font-size:12px">(${SLOTKEYS[i].toUpperCase()})</span></h4>${s.cost ? '<div>' + costHTML(s.cost, p) + '</div>' : ''}<div>${s.tip || ''}</div>${s.lock ? `<div class="bad">Requires ${s.lock}</div>` : ''}`;
  t.style.display = 'block'; const r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.max(4, Math.min(innerWidth - w - 4, r.right - w)) + 'px'; t.style.top = (r.top - h - 8) + 'px';
}
function hideTip() { $('tip').style.display = 'none'; }

// ---- init ----
function initUI() {
  cv = $('c'); ctx = cv.getContext('2d');
  const resize = () => { const dpr = 1; VW = cv.width = innerWidth * dpr; VH = cv.height = innerHeight * dpr; if (G) clampCam(); };
  addEventListener('resize', resize); resize();
  const mmc = $('mm');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  $('bottom').addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousemove', e => { ui.mx = e.offsetX; ui.my = e.offsetY; ui.mouseIn = true; });
  cv.addEventListener('mouseleave', () => { ui.mouseIn = false; ui.hover = null; });
  document.addEventListener('mousemove', e => { ui.rawx = e.clientX; ui.rawy = e.clientY; ui.rawIn = true; if (ui.pan) { cam.x = ui.pan.cx - (e.clientX - ui.pan.x) / cam.z; cam.y = ui.pan.cy - (e.clientY - ui.pan.y) / cam.z; clampCam(); } });
  document.addEventListener('mouseleave', () => { ui.rawIn = false; });
  cv.addEventListener('mousedown', e => {
    initAudio(); if (mode !== 'play') return;
    if (e.button === 1) { ui.pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; e.preventDefault(); return; }
    if (e.button === 0) {
      if (ui.place || ui.amode) { doLeftClick(e.offsetX, e.offsetY, e.shiftKey); return; }
      ui.drag = { x: e.offsetX, y: e.offsetY, x1: e.offsetX, y1: e.offsetY, on: false };
    } else if (e.button === 2) doRightClick(e.offsetX, e.offsetY);
  });
  addEventListener('mousemove', e => { if (ui.drag) { const r = cv.getBoundingClientRect(); ui.drag.x1 = e.clientX - r.left; ui.drag.y1 = e.clientY - r.top; if (Math.hypot(ui.drag.x1 - ui.drag.x, ui.drag.y1 - ui.drag.y) > 6) ui.drag.on = true; } });
  addEventListener('mouseup', e => {
    if (e.button === 1) ui.pan = null;
    if (e.button === 0 && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (d.on) boxSelect(d.x, d.y, d.x1, d.y1, e.shiftKey);
      else {
        const now = performance.now(), t = pickAt(d.x, d.y);
        if (now - ui.lastClick.t < 350 && Math.hypot(d.x - ui.lastClick.x, d.y - ui.lastClick.y) < 6 && t && t.owner === 0) selectSimilar(t);
        else doLeftClick(d.x, d.y, e.shiftKey);
        ui.lastClick = { t: now, x: d.x, y: d.y };
      }
    }
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const [wx, wy] = screenToWorld(e.offsetX, e.offsetY), nz = Math.max(.55, Math.min(1.5, cam.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    cam.z = nz; const [X, Y] = proj(wx, wy); cam.x = X - e.offsetX / nz; cam.y = Y - e.offsetY / nz; clampCam();
  }, { passive: false });
  // minimap
  const mmGo = (e, cmd) => { const r = mmc.getBoundingClientRect(), [wx, wy] = minimapToWorld((e.clientX - r.left) / r.width * 240, (e.clientY - r.top) / r.height * 120); const x = Math.max(0, Math.min(N, wx)), y = Math.max(0, Math.min(N, wy)); if (cmd) { const m = own(); if (m.length) { groupMove(m, x, y, ui.amode); ui.amode = false; ui.marks.push({ x, y, t: 0, c: '#6dff7a' }); } } else centerOn(x, y); };
  let mmDrag = false;
  mmc.addEventListener('mousedown', e => { initAudio(); if (e.button === 0) { if (ui.amode) { mmGo(e, true); return; } mmDrag = true; mmGo(e, false); } else if (e.button === 2) mmGo(e, true); });
  addEventListener('mousemove', e => { if (mmDrag) mmGo(e, false); }); addEventListener('mouseup', () => { mmDrag = false; });
  mmc.addEventListener('contextmenu', e => e.preventDefault());
  // cmd card
  const cm = $('cmds');
  cm.addEventListener('click', e => { const b = e.target.closest('.btn'); if (b) runSlot(+b.dataset.i); });
  cm.addEventListener('mouseover', e => { const b = e.target.closest('.btn'); if (b) showTip(+b.dataset.i, b); });
  cm.addEventListener('mouseleave', hideTip);
  $('info').addEventListener('click', e => {
    const mi = e.target.closest('.mi'); if (mi) { const u = U.find(u => u.id === +mi.dataset.id); if (u) { if (ui.shift) setSel(ui.sel.filter(x => x !== u)); else setSel([u]); } return; }
    const qi = e.target.closest('.qi'); if (qi && ui.sel[0] && ui.sel[0].owner === 0) { cancelQueue(ui.sel[0], +qi.dataset.i); ui.sig = ''; lastInfoSig = ''; }
  });
  $('idle').onclick = () => { initAudio(); selectIdle(); };
  $('spd').onclick = () => { G.speed = G.speed >= 3 ? 1 : G.speed + 1; $('spd').textContent = G.speed + 'x'; };
  $('menubtn').onclick = () => togglePause(true);
  addEventListener('keydown', onKey); addEventListener('keyup', e => { ui.shift = e.shiftKey; ui.ctrl = e.ctrlKey || e.metaKey; keys[e.key] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
}
const keys = {};
function onKey(e) {
  ui.shift = e.shiftKey; ui.ctrl = e.ctrlKey || e.metaKey; keys[e.key] = true;
  if (mode === 'menu') return;
  if (e.key === 'Escape') { if (ui.place || ui.amode) { ui.place = null; ui.amode = false; } else if (mode === 'play') togglePause(true); else if (mode === 'paused') togglePause(false); return; }
  if (e.key === 'p' || e.key === 'P') { togglePause(mode === 'play'); return; }
  if (mode !== 'play') return;
  if (e.key.startsWith('Arrow')) { e.preventDefault(); return; }
  if (/^[1-9]$/.test(e.key)) {
    if (ui.ctrl) { e.preventDefault(); ui.groups[e.key] = ui.sel.map(x => x.id); toast('Group ' + e.key + ' assigned'); }
    else { const ids = ui.groups[e.key]; if (ids) { const l = ids.map(id => U.find(u => u.id === id) || B.find(b => b.id === id)).filter(x => x && !x.dead); if (l.length) { const now = performance.now(); setSel(l); if (ui.lastGroup === e.key && now - ui.lastGroupT < 400) centerOn(l[0].x, l[0].y); ui.lastGroup = e.key; ui.lastGroupT = now; } } }
    return;
  }
  if (ui.ctrl) return;
  const k = e.key.toLowerCase();
  if (k === '.' || k === ',') { selectIdle(); return; }
  if (k === 'h') { selectTC(); return; }
  if (e.key === ' ') { e.preventDefault(); if (ui.lastAlertPos) centerOn(ui.lastAlertPos.x, ui.lastAlertPos.y); return; }
  if (e.key === '+' || e.key === '=') { G.speed = Math.min(3, G.speed + 1); $('spd').textContent = G.speed + 'x'; return; }
  if (e.key === '-') { G.speed = Math.max(1, G.speed - 1); $('spd').textContent = G.speed + 'x'; return; }
  if (e.key === 'Delete') { for (const e2 of ui.sel) if (e2.owner === 0 && !e2.dead && (e2.type === 'unit' || e2.kind !== 'tc')) { e2.type === 'unit' ? (e2.dead = true, P(0).stats.lost++) : razeBld(e2, false); } setSel([]); return; }
  const si = SLOTKEYS.indexOf(k); if (si >= 0 && k.length === 1) { runSlot(si); return; }
}
function updateCamera(dt) {
  if (ui.pan) return;
  const sp = 900 * dt / cam.z; let dx = 0, dy = 0;
  if (keys.ArrowLeft) dx -= 1; if (keys.ArrowRight) dx += 1; if (keys.ArrowUp) dy -= 1; if (keys.ArrowDown) dy += 1;
  if (ui.rawIn && !ui.drag) { const E = 6; if (ui.rawx <= E) dx -= 1; if (ui.rawx >= innerWidth - E) dx += 1; if (ui.rawy <= E) dy -= 1; if (ui.rawy >= innerHeight - E) dy += 1; }
  if (dx || dy) { cam.x += dx * sp; cam.y += dy * sp * .7; clampCam(); }
  // hover pick (throttled)
  if (ui.mouseIn && performance.now() - ui.hoverT > 50) { ui.hoverT = performance.now(); ui.hover = ui.drag && ui.drag.on ? null : pickAt(ui.mx, ui.my); if (ui.place || ui.amode) ui.hover = null; cv.style.cursor = ui.place ? 'crosshair' : ui.amode ? 'crosshair' : ui.hover && ui.hover.owner === 1 && own().length ? 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27%3E%3Ctext y=%2720%27 font-size=%2720%27%3E%E2%9A%94%EF%B8%8F%3C/text%3E%3C/svg%3E") 12 12, crosshair' : 'default'; }
  for (const m of ui.marks) m.t += dt; ui.marks = ui.marks.filter(m => m.t < .8);
  if (G.ageFlash) G.ageFlash.t += dt;
}
function drawDragBox() {
  const d = ui.drag; if (!d || !d.on) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#9fffa8'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(120,255,140,.12)';
  const x = Math.min(d.x, d.x1), y = Math.min(d.y, d.y1), w = Math.abs(d.x1 - d.x), h = Math.abs(d.y1 - d.y); ctx.fillRect(x, y, w, h); ctx.strokeRect(x + .5, y + .5, w, h);
}
