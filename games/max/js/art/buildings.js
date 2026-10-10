// Procedural isometric buildings for Age of Crowns (see docs/ART_SPEC.md section 3).
// Sprites are composed from the toolkit in buildings_kit.js / buildings_paint.js, one composer per building type,
// parameterised by age (architecture style), team colour, construction stage and special state (mask, gate, farm fill, mill frame).
import { makeCanvas, toSprite, getSpriteScale, hash01, strSeed, teamColor, shade, mix, rgba, diamondPath } from './common.js';
import { BUILDINGS } from '../data/buildings.js';
import { Scene, resetScratch } from './buildings_kit.js';
import { DEFS as ECO } from './buildings_eco.js';
import { DEFS as MIL } from './buildings_mil.js';
import { DEFS as CIVIC } from './buildings_civic.js';
import { DEFS as DEFN } from './buildings_defense.js';
import { constructionBefore, constructionAfter, makeRubble, makeSite } from './buildings_stage.js';

const MODULES = [ECO, MIL, CIVIC, DEFN];
const DEFS = {};
for (const m of MODULES) Object.assign(DEFS, m);

// ---------------------------------------------------------------- integer type ids / cache
const TYPE_IDS = Object.keys(BUILDINGS);
const TIDX = Object.create(null);
TYPE_IDS.forEach((id, i) => { TIDX[id] = i; });
const NT = Math.max(24, TYPE_IDS.length);
const VAR = 64;                                  // per-type variant slots (mask / gate state / frame / fill)
const CACHE = new Array(NT * 8 * 4 * 5 * VAR).fill(null);
const ICONINFO = new WeakMap();
const FALLBACK = new Map();
const FRAMES = { mill: 8 };
const AGE_FREE = new Uint8Array(NT);              // 1 = look does not depend on age (shares one cache entry)
TYPE_IDS.forEach((id, i) => { AGE_FREE[i] = (id === 'palisade' || id === 'wonder') ? 1 : 0; });
const KIND = new Uint8Array(NT);                 // 0 plain, 1 mill (frame), 2 wall (mask), 3 gate, 4 farm (fill)
TYPE_IDS.forEach((id, i) => { KIND[i] = id === 'mill' ? 1 : (id === 'palisade' || id === 'stone_wall') ? 2 : id === 'gate' ? 3 : id === 'farm' ? 4 : 0; });

export function buildingAnimFrames(type) { return FRAMES[type] || 1; }

function variantOf(ti, state) {
  if (!state) return KIND[ti] === 4 ? 3 : 0;
  switch (KIND[ti]) {
    case 1: return (state.frame | 0) & 7;
    case 2: return (state.mask | 0) & 15;
    case 3: return (state.axis === 'y' ? 32 : 0) + (state.open ? 16 : 0);
    case 4: { const f = state.fill; if (f === undefined || f === null) return 3; const v = Math.round(f * 3); return v >= 0 && v <= 3 ? v : v < 0 ? 0 : 3; }
    default: return 0;
  }
}
function stateFromVariant(type, v) {
  if (type === 'mill') return { frame: v };
  if (type === 'palisade' || type === 'stone_wall') return { mask: v & 15 };
  if (type === 'gate') return { axis: v & 32 ? 'y' : 'x', open: !!(v & 16), mask: 0 };
  if (type === 'farm') return { fill: v / 3 };
  return {};
}

/**
 * Building sprite.  state = { build, frame, mask, open, axis, fill }.  Cached by integer key; the hot path allocates nothing.
 */
export function getBuildingSprite(type, team, age, state) {
  const ti = TIDX[type];
  if (ti === undefined) return unknownSprite(type, team);
  let st = 4;
  if (state !== undefined && state !== null) {
    const b = state.build;
    if (b !== undefined && b < 1) { st = b > 0 ? (b * 4) | 0 : 0; if (st > 3) st = 3; }
  }
  const v = variantOf(ti, state);
  const tm = team > 7 ? 7 : team > 0 ? team | 0 : 0, ag = AGE_FREE[ti] === 1 ? 0 : age > 3 ? 3 : age > 0 ? age | 0 : 0;
  const key = ((((ti << 3) + tm) * 4 + ag) * 5 + st) * VAR + v;
  const s = CACHE[key];
  if (s !== null) return s;
  return (CACHE[key] = generate(type, tm, ag, st, v));
}

function generate(type, team, age, stage, v) {
  const def = DEFS[type], bd = BUILDINGS[type];
  if (!def) return placeholder(type, team, age, stage);
  const state = stateFromVariant(type, v);
  let res = null;
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    try {
      const g = new Scene(bd.size, { stage, team, age, seed: strSeed(type) + age * 977 + v * 131 + stage * 17, hmax: def.hmax, side: def.side });
      g.setHc(def.Hc || 40);
      if (stage < 4) constructionBefore(g, def, bd.size);
      def.draw(g, age, state, stage);
      if (stage < 4) constructionAfter(g, def, bd.size);
      res = g.finish();
    } catch (e) {
      resetScratch();
      if (attempt === 1) { console.error('building art failed', type, age, stage, e); return placeholder(type, team, age, stage); }
    }
  }
  const sp = toSprite(res.surf, res.ax, res.ay);
  ICONINFO.set(sp, res.icon);
  return sp;
}

function placeholder(type, team, age, stage) {
  const bd = BUILDINGS[type], n = bd ? bd.size : 2;
  const W = 64 * n + 16, H = 32 * n + 60, c = makeCanvas(W, H), ctx = c.ctx, tc = teamColor(team);
  ctx.fillStyle = '#8a7a60'; ctx.beginPath(); ctx.moveTo(W / 2, H - 32 * n - 4); ctx.lineTo(W - 8, H - 16 * n - 4); ctx.lineTo(W / 2, H - 4); ctx.lineTo(8, H - 16 * n - 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tc.main; ctx.fillRect(W / 2 - 8, H - 16 * n - 40, 16, 30);
  return toSprite(c, W / 2, H - 16 * n - 4);
}
function unknownSprite(type, team) {
  const k = String(type) + '|' + (team | 0);
  let s = FALLBACK.get(k);
  if (!s) { s = placeholder(type, team | 0, 0, 4); FALLBACK.set(k, s); }
  return s;
}

// ---------------------------------------------------------------- icons / portraits
export function getBuildingIcon(type, team = 1, age = 0) { return makeIcon(type, team, age, 48); }
export function getBuildingPortrait(type, team = 1, age = 0) { return makeIcon(type, team, age, 72); }
const ICONS = new Map();
function makeIcon(type, team, age, size) {
  age = age > 3 ? 3 : age > 0 ? age | 0 : 0; team = team > 7 ? 7 : team > 0 ? team | 0 : 0;
  const key = type + '|' + team + '|' + age + '|' + size;
  let cv = ICONS.get(key);
  if (cv) return cv;
  const surf = makeCanvas(size, size), c = surf.ctx, k = size / 48;
  // sky, soft clouds, distant hills and meadow
  const sky = c.createLinearGradient(0, 0, 0, size * 0.66); sky.addColorStop(0, '#6fa3d4'); sky.addColorStop(1, '#d9e8ea');
  c.fillStyle = sky; c.fillRect(0, 0, size, size);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [cx, cy, r] of [[0.2, 0.2, 0.1], [0.3, 0.23, 0.08], [0.72, 0.14, 0.09], [0.82, 0.17, 0.06]]) { c.beginPath(); c.ellipse(cx * size, cy * size, r * size * 1.4, r * size * 0.7, 0, 0, 7); c.fill(); }
  c.fillStyle = '#86a8b8'; c.beginPath(); c.moveTo(0, size * 0.62); c.quadraticCurveTo(size * 0.22, size * 0.44, size * 0.45, size * 0.6); c.quadraticCurveTo(size * 0.7, size * 0.46, size, size * 0.6); c.lineTo(size, size); c.lineTo(0, size); c.closePath(); c.fill();
  c.fillStyle = '#6f9a5a'; c.beginPath(); c.moveTo(0, size * 0.68); c.quadraticCurveTo(size * 0.3, size * 0.56, size * 0.6, size * 0.66); c.quadraticCurveTo(size * 0.85, size * 0.6, size, size * 0.66); c.lineTo(size, size); c.lineTo(0, size); c.closePath(); c.fill();
  const grass = c.createLinearGradient(0, size * 0.66, 0, size); grass.addColorStop(0, '#8db553'); grass.addColorStop(1, '#4f7c33');
  c.fillStyle = grass; c.beginPath(); c.moveTo(0, size * 0.76); c.quadraticCurveTo(size * 0.5, size * 0.66, size, size * 0.76); c.lineTo(size, size); c.lineTo(0, size); c.closePath(); c.fill();
  const sp = getBuildingSprite(type, team, age, undefined), info = ICONINFO.get(sp);
  if (sp && info) {
    const pad = size * 0.06, avail = size - pad * 2;
    const sc = Math.min(avail / info.w, (avail * 0.96) / info.h);
    const dw = info.w * sc, dh = info.h * sc, dx = (size - dw) / 2, dy = size - pad - dh;
    // soft ground shadow
    const sg = c.createRadialGradient(size / 2, size - pad - 1.5 * k, 0, size / 2, size - pad - 1.5 * k, dw * 0.5);
    sg.addColorStop(0, 'rgba(20,30,10,0.35)'); sg.addColorStop(1, 'rgba(20,30,10,0)');
    c.save(); c.translate(size / 2, size - pad - 1.5 * k); c.scale(1, 0.32); c.translate(-size / 2, -(size - pad - 1.5 * k)); c.fillStyle = sg; c.beginPath(); c.arc(size / 2, size - pad - 1.5 * k, dw * 0.5, 0, 7); c.fill(); c.restore();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const S = getSpriteScale();
    c.drawImage(sp.canvas, info.x * S, info.y * S, info.w * S, info.h * S, dx, dy, dw, dh);
  }
  // vignette, highlight and frame
  const vg = c.createRadialGradient(size / 2, size * 0.55, size * 0.3, size / 2, size * 0.55, size * 0.78); vg.addColorStop(0, 'rgba(10,18,6,0)'); vg.addColorStop(1, 'rgba(10,18,6,0.34)');
  c.fillStyle = vg; c.fillRect(0, 0, size, size);
  const hl = c.createLinearGradient(0, 0, size, size); hl.addColorStop(0, 'rgba(255,248,220,0.22)'); hl.addColorStop(0.4, 'rgba(255,248,220,0)');
  c.fillStyle = hl; c.fillRect(0, 0, size, size);
  c.strokeStyle = 'rgba(22,13,6,0.9)'; c.lineWidth = 1.4 * k; c.strokeRect(0.7 * k, 0.7 * k, size - 1.4 * k, size - 1.4 * k);
  c.strokeStyle = 'rgba(236,206,120,0.95)'; c.lineWidth = 1.1 * k; c.strokeRect(2 * k, 2 * k, size - 4 * k, size - 4 * k);
  c.strokeStyle = 'rgba(255,240,190,0.35)'; c.lineWidth = 0.6 * k; c.beginPath(); c.moveTo(3 * k, size - 3 * k); c.lineTo(3 * k, 3 * k); c.lineTo(size - 3 * k, 3 * k); c.stroke();
  ICONS.set(key, surf.canvas);
  return surf.canvas;
}

// ---------------------------------------------------------------- rubble / construction helpers
const RUBBLE = new Array(6 * 4).fill(null);
export function getRubbleSprite(size, variant) {
  const n = Math.max(1, Math.min(5, size | 0 || 1)), v = (variant | 0) & 3;
  const k = n * 4 + v;
  return RUBBLE[k] || (RUBBLE[k] = makeRubble(n, v));
}
const CONSTR = new Array(6 * 4 * 4).fill(null);
export function getConstructionSprite(size, stage, variant) {
  const n = Math.max(1, Math.min(5, size | 0 || 1)), s = Math.max(0, Math.min(3, stage | 0)), v = (variant | 0) & 3;
  const k = (n * 4 + s) * 4 + v;
  return CONSTR[k] || (CONSTR[k] = makeSite(n, s, v));
}

// ---------------------------------------------------------------- warm-up
const WARM_ORDER = ['town_center', 'house', 'mill', 'lumber_camp', 'mining_camp', 'farm', 'barracks', 'outpost', 'palisade', 'archery_range', 'stable', 'blacksmith', 'market', 'watch_tower', 'stone_wall', 'gate', 'siege_workshop', 'monastery', 'university', 'castle', 'guard_tower', 'keep', 'wonder'];
/** Pre-generate the complete sprites of every building for the given teams in time slices (age-major: the current age first). onProgress(0..1). */
export function warmBuildingSprites(teams = [1], onProgress) {
  const jobs = [];
  if (!Array.isArray(teams)) teams = [teams === undefined || teams === null ? 1 : teams];
  for (let age = 0; age < 4; age++) for (const t of teams) for (const type of WARM_ORDER) {
    const ti = TIDX[type];
    if (ti === undefined) continue;
    if (AGE_FREE[ti] && age > 0) continue;                       // identical for every age
    if (BUILDINGS[type].ageReq > age) continue;                  // cannot exist before its age
    if (type === 'mill') { for (let f = 0; f < 8; f++) jobs.push([type, t, age, { frame: f }]); }
    else if (type === 'palisade' || type === 'stone_wall') { for (let m = 0; m < 16; m++) jobs.push([type, t, age, { mask: m }]); }
    else if (type === 'gate') { for (const ax of ['x', 'y']) for (const op of [false, true]) jobs.push([type, t, age, { axis: ax, open: op }]); }
    else if (type === 'farm') { for (let f = 0; f <= 3; f++) jobs.push([type, t, age, { fill: f / 3 }]); }
    else jobs.push([type, t, age, undefined]);
  }
  let i = 0;
  return new Promise((resolve) => {
    const step = () => {
      const t0 = performance.now();
      try { do { const j = jobs[i++]; getBuildingSprite(j[0], j[1], j[2], j[3]); } while (i < jobs.length && performance.now() - t0 < 6); } catch (e) { /* never block the loading screen */ }
      if (onProgress) { try { onProgress(jobs.length ? i / jobs.length : 1); } catch (e) { /* ignore */ } }
      if (i < jobs.length) setTimeout(step, 0); else resolve();
    };
    if (jobs.length) setTimeout(step, 0); else resolve();
  });
}

export const buildingsDebugInfo = { DEFS, TYPE_IDS };
