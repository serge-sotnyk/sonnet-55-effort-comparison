'use strict';
// ---------------------------------------------------------------------------
// Rendering: camera, terrain, depth sorted entities, fog, effects, minimap
// ---------------------------------------------------------------------------
const R = {
  cv: null, ctx: null, vw: 800, vh: 600, dpr: 1,
  cam: { x: 0, y: 0, zoom: 1 },
  terrain: null, miniBase: null, fogCv: null, fogCtx: null, fogImg: null, fogDirty: true,
  list: [], mini: null, miniCtx: null, miniW: 0, miniH: 0,
  tmpO: { tc: '#fff', phase: 0, moving: false, act: 'idle', actP: 0, time: 0, seed: 0, back: false, carry: null, tool: null },
  frame: 0, time: 0,
};
const TW2 = 32, TH2 = 16;

function w2sx(x, y) { return ((x - y) * TW2 - R.cam.x) * R.cam.zoom + R.vw / 2; }
function w2sy(x, y) { return ((x + y) * TH2 - R.cam.y) * R.cam.zoom + R.vh / 2; }
function screenToWorld(sx, sy) {
  const wx = (sx - R.vw / 2) / R.cam.zoom + R.cam.x, wy = (sy - R.vh / 2) / R.cam.zoom + R.cam.y;
  return { x: (wx / TW2 + wy / TH2) / 2, y: (wy / TH2 - wx / TW2) / 2 };
}
function centerCamOn(x, y) { R.cam.x = (x - y) * TW2; R.cam.y = (x + y) * TH2; clampCam(); }
function clampCam() {
  const N = G.map ? G.map.w : 80;
  const c = R.cam;
  // clamp to the map diamond (loosely)
  const maxX = N * TW2 + 40, maxY = N * TH2 * 2 + 40;
  c.x = clamp(c.x, -maxX + 100, maxX - 100);
  c.y = clamp(c.y, -40, maxY - 20);
  c.zoom = clamp(c.zoom, 0.5, 1.8);
}

function initRender(canvas, mini) {
  R.cv = canvas; R.ctx = canvas.getContext('2d');
  R.mini = mini; R.miniCtx = mini.getContext('2d');
  resizeRender();
}
function resizeRender() {
  const cv = R.cv;
  const r = cv.getBoundingClientRect();
  R.dpr = Math.min(window.devicePixelRatio || 1, 2);
  R.vw = Math.max(200, r.width); R.vh = Math.max(200, r.height);
  cv.width = Math.round(R.vw * R.dpr); cv.height = Math.round(R.vh * R.dpr);
  // minimap
  const m = R.mini, mr = m.getBoundingClientRect();
  R.miniW = Math.round(mr.width); R.miniH = Math.round(mr.height);
  m.width = R.miniW * R.dpr; m.height = R.miniH * R.dpr;
}

// --- fog -------------------------------------------------------------------------------------------------
const FOG_S = 3;
function updateFogCanvas() {
  const N = G.map.w, S = FOG_S, W = N * S;
  if (!R.fogCv || R.fogCv.width !== W) { R.fogCv = mkCanvas(W, W); R.fogCtx = R.fogCv.getContext('2d'); R.fogImg = R.fogCtx.createImageData(W, W); }
  const vis = G.map.vis, d = R.fogImg.data;
  const val = (x, y) => { x = clamp(x, 0, N - 1); y = clamp(y, 0, N - 1); const v = vis[y * N + x]; return v === 2 ? 0 : v === 1 ? 0.5 : 1; };
  const showAll = G.observer;
  for (let py = 0; py < W; py++) {
    const fy = (py + 0.5) / S - 0.5, y0 = Math.floor(fy), ty = fy - y0;
    for (let px = 0; px < W; px++) {
      const fx = (px + 0.5) / S - 0.5, x0 = Math.floor(fx), tx = fx - x0;
      let a;
      if (showAll) a = 0;
      else {
        const a0 = val(x0, y0) * (1 - tx) + val(x0 + 1, y0) * tx, a1 = val(x0, y0 + 1) * (1 - tx) + val(x0 + 1, y0 + 1) * tx;
        a = a0 * (1 - ty) + a1 * ty;
      }
      const o = (py * W + px) * 4;
      d[o] = 4; d[o + 1] = 6; d[o + 2] = 14; d[o + 3] = a * 255;
    }
  }
  R.fogCtx.putImageData(R.fogImg, 0, 0);
  R.fogDirty = false;
}

// --- helpers --------------------------------------------------------------------------------------------------
function hpColor(r) { return r > 0.6 ? '#4fd04f' : r > 0.3 ? '#e8c43a' : '#e04030'; }
function drawBar(ctx, x, y, w, h, ratio, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = col || hpColor(ratio); ctx.fillRect(x, y, Math.max(0, w * ratio), h);
}
function isoDiamond(ctx, x, y, w, h) { // tile-space rect to screen diamond path
  ctx.beginPath();
  ctx.moveTo(w2sx(x, y), w2sy(x, y)); ctx.lineTo(w2sx(x + w, y), w2sy(x + w, y));
  ctx.lineTo(w2sx(x + w, y + h), w2sy(x + w, y + h)); ctx.lineTo(w2sx(x, y + h), w2sy(x, y + h)); ctx.closePath();
}
function isoEllipse(ctx, x, y, rx, ry) {
  const z = R.cam.zoom;
  ctx.beginPath(); ctx.ellipse(w2sx(x, y), w2sy(x, y), rx * 45.25 * z, rx * 22.6 * z * (ry || 1), 0, 0, TAU);
}
function entSelected(e) { return e.selected; }

// --- main frame ------------------------------------------------------------------------------------------------------
function renderFrame(dtReal) {
  const ctx = R.ctx, vw = R.vw, vh = R.vh, dpr = R.dpr, cam = R.cam;
  R.frame++; R.time += dtReal;
  const T = R.time;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#06080a'; ctx.fillRect(0, 0, vw, vh);
  if (!G.map || !R.terrain) return;
  const N = G.map.w;
  const z = cam.zoom;
  // visible tile bounds
  const corners = [screenToWorld(0, 0), screenToWorld(vw, 0), screenToWorld(0, vh), screenToWorld(vw, vh)];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const c of corners) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y); }
  minX = clamp(Math.floor(minX) - 1, 0, N); maxX = clamp(Math.ceil(maxX) + 1, 0, N); minY = clamp(Math.floor(minY) - 1, 0, N); maxY = clamp(Math.ceil(maxY) + 1, 0, N);

  // ---- terrain
  if (maxX > minX && maxY > minY) {
    const k = z * dpr;
    ctx.setTransform(TW2 / TS * k, TH2 / TS * k, -TW2 / TS * k, TH2 / TS * k, (-cam.x * z + vw / 2) * dpr, (-cam.y * z + vh / 2) * dpr);
    ctx.drawImage(R.terrain, minX * TS, minY * TS, (maxX - minX) * TS, (maxY - minY) * TS, minX * TS, minY * TS, (maxX - minX) * TS, (maxY - minY) * TS);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  drawWaterSparkle(ctx, minX, maxX, minY, maxY, T);

  // ---- ground decals
  const m = G.map;
  for (const f of G.fx) {
    if (f.t === 'rubble') drawRubble(ctx, f);
    else if (f.t === 'stump') { const sx = w2sx(f.x, f.y), sy = w2sy(f.x, f.y); if (inView(sx, sy)) { const s = WorldSprites.stump; ctx.globalAlpha = Math.min(1, f.life / 10); ctx.drawImage(s.cv, sx - s.ax * z, sy - s.ay * z, s.w * z, s.h * z); ctx.globalAlpha = 1; } }
  }
  for (const b of G.buildings) {
    if (b.dead || !b.def) continue;
    if (!b.built) drawFoundation(ctx, b);
  }
  // selection circles / building outlines
  for (const e of G.sel) {
    if (e.dead || e.garrisoned) continue;
    const col = e.owner === G.me ? '#8dff8d' : e.owner >= 0 ? '#ff6a5a' : '#ffe27a';
    ctx.lineWidth = 1.6 * Math.max(1, z); ctx.strokeStyle = col; ctx.fillStyle = col.replace(')', ',0.12)');
    if (e.kind === 'building') { isoDiamond(ctx, e.x - 0.1, e.y - 0.1, e.size + 0.2, e.size + 0.2); ctx.stroke(); ctx.globalAlpha = 0.1; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
    else { const r = e.kind === 'unit' ? e.def.radius * 2.2 : 0.6; isoEllipse(ctx, e.x, e.y, r); ctx.stroke(); ctx.globalAlpha = 0.14; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
  }
  // hover highlight
  const hv = UI.hover;
  if (hv && !hv.dead && !hv.garrisoned && G.sel.indexOf(hv) < 0 && (!UI.mode)) {
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    if (hv.kind === 'building') { isoDiamond(ctx, hv.x - 0.05, hv.y - 0.05, hv.size + 0.1, hv.size + 0.1); ctx.stroke(); }
    else if (hv.kind === 'unit') { isoEllipse(ctx, hv.x, hv.y, hv.def.radius * 2.0); ctx.stroke(); }
    else if (hv.animal || hv.type) { isoEllipse(ctx, hv.x, hv.y, 0.5); ctx.stroke(); }
  }
  // rally points
  for (const e of G.sel) {
    if (e.kind === 'building' && e.rally && e.owner === G.me) {
      const bx = w2sx(ecx(e), ecy(e)), by = w2sy(ecx(e), ecy(e));
      const sx = w2sx(e.rally.x, e.rally.y), sy = w2sy(e.rally.x, e.rally.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(sx, sy); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#4a3320'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 26 * z); ctx.stroke();
      ctx.fillStyle = TEAM_COLORS[e.owner]; ctx.beginPath(); ctx.moveTo(sx, sy - 26 * z); ctx.lineTo(sx + 14 * z, sy - 21 * z); ctx.lineTo(sx, sy - 15 * z); ctx.fill();
    }
  }
  // corpses (flat)
  for (const f of G.fx) if (f.t === 'corpse') drawCorpse(ctx, f);

  // ---- collect sorted drawables
  const list = R.list; let n = 0;
  const pad = 90;
  const push = (d, e, sx, sy) => { const it = list[n] || (list[n] = {}); it.d = d; it.e = e; it.sx = sx; it.sy = sy; n++; };
  const sel = G.observer ? null : null;
  for (const r of G.resources) {
    if (r.dead) continue;
    const sx = w2sx(r.x, r.y), sy = w2sy(r.x, r.y);
    if (sx < -pad || sx > vw + pad || sy < -pad * 0.7 || sy > vh + pad * 1.6) continue;
    if (!G.observer && m.vis[Math.floor(r.y) * N + Math.floor(r.x)] === 0) continue;
    if (r.animal && !G.observer && m.vis[Math.floor(r.y) * N + Math.floor(r.x)] !== 2) continue;
    push(r.x + r.y, r, sx, sy);
  }
  for (const b of G.buildings) {
    if (b.dead) continue;
    const cx = b.x + b.size / 2, cy = b.y + b.size / 2;
    const sx = w2sx(b.x, b.y), sy = w2sy(b.x, b.y);
    const spr = BuildingSprites; // bounds approx
    if (sx < -b.size * 40 * z - 200 || sx > vw + b.size * 40 * z + 200 || sy < -250 * z || sy > vh + 120 * z + b.size * 20) continue;
    if (b.owner !== G.me && !G.observer) { if (!b.seenBy.has(G.me)) continue; }
    // farms are drawn flat (below units)
    push(b.type === 'farm' ? cx + cy - 100 : cx + cy + (b.def.solid ? 0.01 : 0), b, sx, sy);
  }
  for (const u of G.units) {
    if (u.dead || u.garrisoned) continue;
    const sx = w2sx(u.x, u.y), sy = w2sy(u.x, u.y);
    if (sx < -60 || sx > vw + 60 || sy < -60 || sy > vh + 90) continue;
    if (u.owner !== G.me && !G.observer && m.vis[Math.floor(u.y) * N + Math.floor(u.x)] !== 2) continue;
    push(u.x + u.y + 0.001, u, sx, sy);
  }
  const lst = list; lst.length = n;
  lst.sort((a, b) => a.d - b.d);
  for (let i = 0; i < n; i++) {
    const it = lst[i], e = it.e;
    if (e.kind === 'unit') drawUnit(ctx, e, it.sx, it.sy, T);
    else if (e.kind === 'building') drawBuilding(ctx, e, it.sx, it.sy, T);
    else drawResource(ctx, e, it.sx, it.sy, T);
  }

  // ---- overlays: bars, projectiles, particles
  drawOverlays(ctx, T);
  if (typeof UI !== 'undefined' && UI.drawWorld) UI.drawWorld(ctx);

  // ---- fog
  if (R.fogDirty) updateFogCanvas();
  if (R.fogCv) {
    const k = z * dpr, S = FOG_S;
    ctx.setTransform(TW2 / S * k, TH2 / S * k, -TW2 / S * k, TH2 / S * k, (-cam.x * z + vw / 2) * dpr, (-cam.y * z + vh / 2) * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(R.fogCv, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // vignette
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, vw, vh);
  if (typeof UI !== 'undefined' && UI.drawScreen) UI.drawScreen(ctx);
}
function inView(sx, sy) { return sx > -80 && sx < R.vw + 80 && sy > -80 && sy < R.vh + 120; }

function drawWaterSparkle(ctx, minX, maxX, minY, maxY, T) {
  const m = G.map, N = m.w, z = R.cam.zoom;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
    if (m.terrain[y * N + x] !== 1) continue;
    const h = (x * 73856093 ^ y * 19349663) >>> 0;
    const ph = (T * 0.6 + (h % 1000) / 1000 * 6.28);
    const a = Math.sin(ph);
    if (a < 0.75) continue;
    const sx = w2sx(x + ((h >> 4) % 100) / 100, y + ((h >> 8) % 100) / 100), sy = w2sy(x + ((h >> 4) % 100) / 100, y + ((h >> 8) % 100) / 100);
    ctx.globalAlpha = (a - 0.75) * 3;
    ctx.fillRect(sx, sy, 5 * z, 1.3 * z);
  }
  ctx.globalAlpha = 1;
}

function drawRubble(ctx, f) {
  const z = R.cam.zoom;
  const a = Math.min(1, f.life / 12) * 0.9;
  const sx = w2sx(f.x + f.size / 2, f.y + f.size / 2), sy = w2sy(f.x + f.size / 2, f.y + f.size / 2);
  if (!inView(sx, sy)) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#4a4036';
  isoDiamond(ctx, f.x + 0.1, f.y + 0.1, f.size - 0.2, f.size - 0.2); ctx.fill();
  const rg = mulberry32(Math.floor(f.x * 100 + f.y));
  for (let i = 0; i < f.size * 6; i++) {
    const px = f.x + 0.2 + rg() * (f.size - 0.4), py = f.y + 0.2 + rg() * (f.size - 0.4);
    ctx.fillStyle = rg() < 0.5 ? '#6a5c4c' : '#2e2820';
    const s = (2 + rg() * 4) * z;
    ctx.fillRect(w2sx(px, py) - s / 2, w2sy(px, py) - s / 2, s, s * 0.6);
  }
  ctx.globalAlpha = 1;
}
function drawFoundation(ctx, b) {
  const sx = w2sx(b.x + b.size / 2, b.y + b.size / 2), sy = w2sy(b.x + b.size / 2, b.y + b.size / 2);
  if (!inView(sx, sy)) return;
  if (b.owner !== G.me && !G.observer && !b.seenBy.has(G.me)) return;
  ctx.fillStyle = 'rgba(110,84,52,0.85)';
  isoDiamond(ctx, b.x + 0.05, b.y + 0.05, b.size - 0.1, b.size - 0.1); ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,20,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
  if (b.size > 1) {
    ctx.strokeStyle = 'rgba(70,50,28,0.6)'; ctx.lineWidth = 1;
    for (let i = 1; i < b.size; i++) { ctx.beginPath(); ctx.moveTo(w2sx(b.x + i, b.y), w2sy(b.x + i, b.y)); ctx.lineTo(w2sx(b.x + i, b.y + b.size), w2sy(b.x + i, b.y + b.size)); ctx.stroke(); }
  }
}
function drawCorpse(ctx, f) {
  const sx = w2sx(f.x, f.y), sy = w2sy(f.x, f.y);
  if (!inView(sx, sy)) return;
  if (!G.observer && G.map.vis[Math.floor(f.y) * G.map.w + Math.floor(f.x)] !== 2) return;
  const z = R.cam.zoom;
  const a = clamp(f.life / 3, 0, 1);
  const age = f.max - f.life;
  const fall = Math.min(1, age / 0.25);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(sx, sy);
  ctx.scale(z * (f.fx || 1), z);
  if (f.big) { // wreck
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-14, -8, 28, 8); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-8, -14, 14, 6);
  } else {
    ctx.rotate(-1.35 * fall); ctx.translate(0, 2 * fall);
    const o = R.tmpO; o.tc = TEAM_COLORS[f.owner]; o.phase = 0; o.moving = false; o.act = 'idle'; o.actP = 0; o.time = 0; o.seed = f.seed || 0; o.back = false; o.carry = null;
    drawFigure(ctx, f.def.look, o);
  }
  ctx.restore();
}

function drawUnit(ctx, u, sx, sy, T) {
  const z = R.cam.zoom, def = u.def;
  const sc = def.sizeScale || 1;
  // shadow
  ctx.fillStyle = 'rgba(10,20,5,0.28)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 1 * z, (def.look.mount ? 13 : 7) * z, (def.look.mount ? 4 : 3) * z, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(z * sc * (u.fx || 1), z * sc);
  const o = R.tmpO;
  o.tc = TEAM_COLORS[u.owner]; o.phase = u.phase; o.moving = u.moving; o.act = u.act; o.actP = u.actP; o.time = T; o.seed = u.seed; o.back = u.back;
  o.carry = u.carry; o.tool = u.tool;
  drawFigure(ctx, def.look, o);
  if (u.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(0.5, u.flash * 4); drawFigure(ctx, def.look, o); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  ctx.restore();
}

function drawResource(ctx, r, sx, sy, T) {
  const z = R.cam.zoom, S = WorldSprites;
  if (r.animal) {
    ctx.save(); ctx.translate(sx, sy); ctx.scale(z, z);
    drawAnimalFigure(ctx, r.type, !r.alive, T, (r.fx || 1) < 0, r.moving);
    ctx.restore();
    return;
  }
  let spr, sc = 1;
  if (r.type === 'tree') { spr = S.trees[r.variant % S.trees.length]; sc = 0.9 + (r.variant % 5) * 0.06; }
  else if (r.type === 'gold') { spr = S.gold[r.variant % 3]; sc = 0.78 + 0.22 * (r.amount / r.max); }
  else if (r.type === 'stone') { spr = S.stone[r.variant % 3]; sc = 0.78 + 0.22 * (r.amount / r.max); }
  else { spr = S.berries[r.amount / r.max > 0.66 ? 2 : r.amount / r.max > 0.33 ? 1 : 0]; }
  const w = spr.w * z * sc, h = spr.h * z * sc;
  ctx.drawImage(spr.cv, sx - spr.ax * z * sc, sy - spr.ay * z * sc, w, h);
}

function wallMask(b) { return b.mask || 0; }
function drawBuilding(ctx, b, sx, sy, T) {
  const z = R.cam.zoom, def = b.def;
  const age = b.age;
  let extra = 0;
  if (b.type === 'farm') extra = b.food <= 0 ? 0 : b.food / b.maxFood > 0.66 ? 3 : b.food / b.maxFood > 0.33 ? 2 : 1;
  else if (WALL_FAMILY.includes(b.type)) extra = wallMask(b);
  const spr = getBuildingSprite(b.type, age, b.owner, extra);
  const dx = sx - spr.ox * z, dy = sy - spr.oy * z;
  const ghost = !G.observer && b.owner !== G.me && !entVisible(b);
  if (ghost) ctx.globalAlpha = 0.9;
  if (!b.built) {
    const prog = b.progress;
    if (b.type === 'farm') { ctx.globalAlpha = 0.25 + 0.75 * prog; ctx.drawImage(spr.cv, dx, dy, spr.W * z, spr.H * z); ctx.globalAlpha = 1; }
    else {
      const frac = clamp((prog - 0.08) / 0.92, 0, 1);
      const h = Math.ceil(spr.H * (0.28 * frac + 0.72 * frac * frac) ) ;
      if (h > 2) ctx.drawImage(spr.cv, 0, (spr.H - h) * SPR_SS, spr.W * SPR_SS, h * SPR_SS, dx, dy + (spr.H - h) * z, spr.W * z, h * z);
      drawScaffold(ctx, b, frac, spr, dx, dy, h);
    }
  } else {
    ctx.drawImage(spr.cv, dx, dy, spr.W * z, spr.H * z);
    if (b.type === 'mill') drawSails(ctx, b, spr, dx, dy, T);
    if (b.type === 'blacksmith' || (b.type === 'towncenter' && b.queue.length)) drawChimneySmoke(ctx, b, spr, dx, dy, T);
    if (b.type === 'farm') {}
  }
  if (b.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b.flash * 2.5; ctx.drawImage(spr.cv, dx, dy, spr.W * z, spr.H * z); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1;
  // damage flames
  const ratio = b.hp / b.maxHp;
  if (b.built && ratio < 0.55 && def.solid) drawFlames(ctx, b, ratio, T);
  // construction progress text? bar handled in overlays
}
function drawScaffold(ctx, b, frac, spr, dx, dy, h) {
  const z = R.cam.zoom;
  const s = b.size;
  const ht = (def => (def.height || 40))(b.def) * (0.25 + 0.75 * frac) * 1.0;
  const pts = [[b.x, b.y], [b.x + s, b.y], [b.x + s, b.y + s], [b.x, b.y + s]];
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2 * z;
  ctx.beginPath();
  for (const [x, y] of pts) { const px = w2sx(x, y), py = w2sy(x, y); ctx.moveTo(px, py); ctx.lineTo(px, py - ht * z); }
  ctx.stroke();
  ctx.lineWidth = 1.5 * z;
  ctx.beginPath();
  for (let k = 1; k <= 2; k++) {
    const hh = ht * k / 2 * z;
    pts.forEach(([x, y], i) => { const px = w2sx(x, y), py = w2sy(x, y) - hh; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.closePath();
  }
  ctx.stroke();
}
function drawSails(ctx, b, spr, dx, dy, T) {
  const z = R.cam.zoom;
  const hx = dx + (spr.ox + (1.0 - 1.4) * 32) * z, hy = dy + (spr.oy + (1.0 + 1.4) * 16 - 52) * z;
  const spin = T * 0.9 + b.id;
  ctx.save(); ctx.translate(hx + 3 * z, hy + 1 * z); ctx.scale(1, 1);
  for (let i = 0; i < 4; i++) {
    const a = spin + i * Math.PI / 2;
    const ex = Math.cos(a) * 26 * z * 0.78, ey = Math.sin(a) * 26 * z;
    ctx.strokeStyle = '#4a3320'; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = 'rgba(240,232,210,0.92)'; ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 0.8;
    const nx = -Math.sin(a) * 6 * z * 0.78, ny = Math.cos(a) * 6 * z;
    ctx.beginPath(); ctx.moveTo(ex * 0.25, ey * 0.25); ctx.lineTo(ex, ey); ctx.lineTo(ex + nx, ey + ny); ctx.lineTo(ex * 0.25 + nx, ey * 0.25 + ny); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function drawChimneySmoke(ctx, b, spr, dx, dy, T) {
  const z = R.cam.zoom;
  const px = b.type === 'blacksmith' ? 1.9 : 2.0, py = b.type === 'blacksmith' ? 0.8 : 1.2, top = b.type === 'blacksmith' ? 64 : 102 + b.age * 4;
  const hx = dx + (spr.ox + (px - py) * 32) * z, hy = dy + (spr.oy + (px + py) * 16 - top) * z;
  for (let i = 0; i < 4; i++) {
    const t = ((T * 0.4 + i / 4) % 1);
    ctx.globalAlpha = (1 - t) * 0.45;
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath(); ctx.arc(hx + (t * 10 + Math.sin(T + i) * 3) * z, hy - t * 34 * z, (3 + t * 7) * z, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawFlames(ctx, b, ratio, T) {
  const z = R.cam.zoom;
  const n = Math.min(8, Math.ceil((0.55 - ratio) * 10 * b.size / 2) + 1);
  const rg = mulberry32(b.id * 31);
  for (let i = 0; i < n; i++) {
    const fx = b.x + 0.3 + rg() * (b.size - 0.6), fy = b.y + 0.3 + rg() * (b.size - 0.6);
    const hz = (rg() * 0.8 + 0.2) * (b.def.height || 40) * 0.8;
    const px = w2sx(fx, fy), py = w2sy(fx, fy) - hz * z;
    const fl = 0.7 + 0.3 * Math.sin(T * 9 + i * 2.1);
    const s = (7 + (0.55 - ratio) * 18) * z * fl * (0.75 + b.size * 0.22);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * fl;
    const gl = ctx.createRadialGradient(px, py - s * 0.6, 1, px, py - s * 0.6, s * 1.8);
    gl.addColorStop(0, 'rgba(255,170,60,0.9)'); gl.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = gl; ctx.fillRect(px - s * 2, py - s * 2.6, s * 4, s * 4);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,90,20,0.85)';
    ctx.beginPath(); ctx.moveTo(px - s * 0.5, py); ctx.quadraticCurveTo(px - s * 0.2, py - s * 0.8, px + Math.sin(T * 7 + i) * s * 0.3, py - s * 1.7); ctx.quadraticCurveTo(px + s * 0.3, py - s * 0.6, px + s * 0.5, py); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,60,0.9)';
    ctx.beginPath(); ctx.moveTo(px - s * 0.25, py); ctx.quadraticCurveTo(px, py - s * 1.0, px + s * 0.25, py); ctx.closePath(); ctx.fill();
    if (i % 2 === 0) {
      const t = (T * 0.5 + i * 0.3) % 1;
      ctx.globalAlpha = (1 - t) * 0.4; ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(px + Math.sin(T + i) * 4 * z, py - s * 1.7 - t * 30 * z, (4 + t * 8) * z, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
}

function drawOverlays(ctx, T) {
  const z = R.cam.zoom, vw = R.vw, vh = R.vh;
  // health bars
  const showBar = (e) => e.selected || (e.lastHit && G.time - e.lastHit < 5 && e.hp < e.maxHp);
  for (const e of G.units) {
    if (e.dead || e.garrisoned) continue;
    const sel = G.sel.indexOf(e) >= 0;
    if (!(sel || (e.lastHit && G.time - e.lastHit < 4 && e.hp < e.maxHp))) continue;
    const sx = w2sx(e.x, e.y), sy = w2sy(e.x, e.y);
    if (!inView(sx, sy)) continue;
    const w = 26 * z, top = sy - (e.def.look.mount ? 42 : e.def.look.mount === 'treb' ? 60 : 44) * z;
    drawBar(ctx, sx - w / 2, top, w, 3.5 * z, e.hp / e.maxHp);
    if (sel && e.owner === G.me && e.carry.amount > 0 && !e.def.look.mount) { /* carry bar */ drawBar(ctx, sx - w / 2, top + 5 * z, w, 2.5 * z, Math.min(1, e.carry.amount / (CARRY_BASE + G.players[e.owner].carryBonus)), '#d9a845'); }
  }
  for (const e of G.buildings) {
    if (e.dead) continue;
    const sel = G.sel.indexOf(e) >= 0;
    const hurtRecently = e.lastHit && G.time - e.lastHit < 5 && e.hp < e.maxHp;
    if (!sel && !hurtRecently && e.built) continue;
    if (!sel && !hurtRecently && !e.built && e.owner !== G.me) continue;
    if (!entVisible(e) && !G.observer) continue;
    const cx = e.x + e.size / 2, cy = e.y + e.size / 2;
    const sx = w2sx(cx, cy), sy = w2sy(cx, cy) - (e.def.height * 0.55 + 16) * z;
    if (!inView(sx, sy)) continue;
    const w = Math.max(40, e.size * 20) * z;
    drawBar(ctx, sx - w / 2, sy, w, 4 * z, e.hp / e.maxHp);
    if (!e.built) drawBar(ctx, sx - w / 2, sy + 7 * z, w, 3 * z, e.progress, '#5aa0ff');
    else if (e.queue.length && e.owner === G.me) drawBar(ctx, sx - w / 2, sy + 7 * z, w, 3 * z, 1 - e.queue[0].left / e.queue[0].total, '#5aa0ff');
  }
  // projectiles
  for (const p of G.projectiles) {
    if (p.t < 0) continue;
    const t = clamp(p.t, 0, 1);
    const arcH = (p.big ? 1.2 : p.arc) * Math.min(p.dist, 14) * 7 * 4 * 0.25;
    const h = Math.sin(t * Math.PI) * arcH + 12;
    const sx = w2sx(p.x, p.y), sy = w2sy(p.x, p.y) - h * z;
    if (!inView(sx, sy)) continue;
    if (!G.observer && G.map.vis[Math.floor(p.y) * G.map.w + Math.floor(p.x)] !== 2 && p.owner !== G.me) continue;
    // ground shadow
    if (p.kind === 'rock' || p.kind === 'bigrock') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(w2sx(p.x, p.y), w2sy(p.x, p.y), 5 * z, 2.5 * z, 0, 0, TAU); ctx.fill(); }
    if (p.kind === 'rock' || p.kind === 'bigrock') {
      ctx.fillStyle = '#5a5650'; ctx.strokeStyle = '#2a2824'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, (p.big ? 6 : 4) * z, 0, TAU); ctx.fill(); ctx.stroke();
    } else {
      const t2 = clamp(t - 0.04, 0, 1);
      const px2 = lerp(p.sx, p.tx, t2), py2 = lerp(p.sy, p.ty, t2);
      const h2 = Math.sin(t2 * Math.PI) * arcH + 12;
      const ex = w2sx(px2, py2), ey = w2sy(px2, py2) - h2 * z;
      if (p.kind === 'axe') { ctx.save(); ctx.translate(sx, sy); ctx.rotate(T * 20); ctx.fillStyle = '#b8bdc4'; ctx.fillRect(-4 * z, -1.5 * z, 8 * z, 3 * z); ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-1 * z, -4 * z, 2 * z, 8 * z); ctx.restore(); }
      else {
        ctx.strokeStyle = p.kind === 'javelin' ? '#8a6a3a' : '#e8dcc0'; ctx.lineWidth = (p.kind === 'javelin' ? 2 : 1.5) * Math.max(0.8, z);
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(sx, sy);
        const dx = sx - ex, dy = sy - ey, l = Math.hypot(dx, dy) || 1;
        ctx.stroke();
        ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.moveTo(sx + dx / l * 2.5 * z, sy + dy / l * 2.5 * z); ctx.lineTo(sx - dy / l * 1.3 * z, sy + dx / l * 1.3 * z); ctx.lineTo(sx + dy / l * 1.3 * z, sy - dx / l * 1.3 * z); ctx.fill();
      }
    }
  }
  // particles / rings / text / pings
  for (const f of G.fx) {
    if (f.t === 'part') {
      const sx = w2sx(f.x, f.y), sy = w2sy(f.x, f.y) - f.z * z;
      if (!inView(sx, sy)) continue;
      const a = clamp(f.life / f.max, 0, 1);
      if (f.kind === 'dust') { ctx.globalAlpha = a * 0.6; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(sx, sy, f.size * z * (2 - a), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      else if (f.kind === 'heal' || f.kind === 'conv') {
        ctx.globalAlpha = a; ctx.fillStyle = f.col; const s = f.size * z * 1.6;
        ctx.fillRect(sx - s / 2, sy - s * 1.5, s, s * 3); ctx.fillRect(sx - s * 1.5, sy - s / 2, s * 3, s); ctx.globalAlpha = 1;
      } else { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = f.col; ctx.fillRect(sx - f.size * z / 2, sy - f.size * z / 2, f.size * z, f.size * z); ctx.globalAlpha = 1; }
    } else if (f.t === 'ring') {
      const a = f.life / f.max, rr2 = f.r * (1.3 - a * 0.9);
      const sx = w2sx(f.x, f.y), sy = w2sy(f.x, f.y);
      if (!inView(sx, sy)) continue;
      ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = 2 * z;
      isoEllipse(ctx, f.x, f.y, rr2); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.t === 'ping') {
      const a = f.life / f.max, ph = (1 - a) * 4;
      ctx.strokeStyle = '#ff4030'; ctx.globalAlpha = Math.max(0, 1 - (ph % 1)); ctx.lineWidth = 2.5 * z;
      isoEllipse(ctx, f.x, f.y, 1 + (ph % 1) * 3); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  ctx.font = `bold ${Math.round(12 * Math.max(0.9, z))}px Georgia, serif`; ctx.textAlign = 'center';
  for (const f of G.fx) {
    if (f.t !== 'text') continue;
    const sx = w2sx(f.x, f.y), sy = w2sy(f.x, f.y) - (f.z + 24) * z;
    if (!inView(sx, sy)) continue;
    ctx.globalAlpha = clamp(f.life / (f.max * 0.5), 0, 1);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(f.text, sx, sy);
    ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy); ctx.globalAlpha = 1;
  }
}

// --- minimap -------------------------------------------------------------------------------------------------------------------
function renderMinimap() {
  const c = R.miniCtx, W = R.miniW, H = R.miniH, dpr = R.dpr;
  if (!G.map || !R.miniBase) return;
  const N = G.map.w;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const kx = W / (2 * N), ky = H / (2 * N);
  c.save();
  c.setTransform(kx * dpr, ky * dpr, -kx * dpr, ky * dpr, W / 2 * dpr, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(R.miniBase, 0, 0);
  c.restore();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mx = (x, y) => (x - y) * kx + W / 2, my = (x, y) => (x + y) * ky;
  const m = G.map;
  // resources of interest
  for (const r of G.resources) {
    if (r.dead || r.animal || (r.type !== 'gold' && r.type !== 'stone')) continue;
    if (!G.observer && m.vis[Math.floor(r.y) * N + Math.floor(r.x)] === 0) continue;
    c.fillStyle = r.type === 'gold' ? '#ffd23a' : '#c8c8d0';
    c.fillRect(mx(r.x, r.y) - 1, my(r.x, r.y) - 1, 2, 2);
  }
  for (const b of G.buildings) {
    if (b.dead) continue;
    if (b.owner !== G.me && !G.observer && !b.seenBy.has(G.me)) continue;
    c.fillStyle = TEAM_COLORS[b.owner];
    const s = Math.max(2, b.size * 0.8 * (W / N / 2));
    const cx = ecx(b), cy = ecy(b);
    c.fillRect(mx(cx, cy) - s / 2, my(cx, cy) - s / 2, s, s);
  }
  for (const u of G.units) {
    if (u.dead || u.garrisoned) continue;
    if (u.owner !== G.me && !G.observer && m.vis[Math.floor(u.y) * N + Math.floor(u.x)] !== 2) continue;
    c.fillStyle = TEAM_COLORS[u.owner];
    c.fillRect(mx(u.x, u.y) - 1, my(u.x, u.y) - 1, 2, 2);
  }
  // fog
  if (R.fogCv) {
    c.save();
    c.setTransform(kx * dpr / FOG_S, ky * dpr / FOG_S, -kx * dpr / FOG_S, ky * dpr / FOG_S, W / 2 * dpr, 0);
    c.drawImage(R.fogCv, 0, 0);
    c.restore();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // pings
  for (const f of G.fx) if (f.t === 'ping') {
    const ph = (1 - f.life / f.max) * 4;
    c.strokeStyle = '#ff4030'; c.globalAlpha = Math.max(0, 1 - (ph % 1)); c.lineWidth = 2;
    c.beginPath(); c.arc(mx(f.x, f.y), my(f.x, f.y), 3 + (ph % 1) * 10, 0, TAU); c.stroke(); c.globalAlpha = 1;
  }
  // camera frustum
  const cs = [screenToWorld(0, 0), screenToWorld(R.vw, 0), screenToWorld(R.vw, R.vh), screenToWorld(0, R.vh)];
  c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath();
  cs.forEach((p, i) => { const x = clamp(mx(p.x, p.y), 0, W), y = clamp(my(p.x, p.y), 0, H); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
  c.closePath(); c.stroke();
}
function minimapToWorld(px, py) {
  const N = G.map.w, W = R.miniW, H = R.miniH;
  const kx = W / (2 * N), ky = H / (2 * N);
  const a = (px - W / 2) / kx, b = py / ky; // a = x-y, b = x+y
  return { x: clamp((a + b) / 2, 0, N - 1), y: clamp((b - a) / 2, 0, N - 1) };
}
