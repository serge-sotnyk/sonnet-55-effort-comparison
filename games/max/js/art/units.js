// Units art (procedural). API per docs/ART_SPEC.md section 2.
// Generation: a small 3D rig per body type (units_human / units_mount / units_beast / units_siege) -> units_core scene -> sprite.
import { UNITS } from '../data/units.js';
import { teamColor, makeCanvas, getSpriteScale } from './common.js';
import { Scene, renderSprite, finish, xfPitch } from './units_core.js';
import { humanPose, iconAdjust, weaponTrail, WALK_CYCLE_UNITS } from './units_anim.js';
import { solveHuman, drawHuman } from './units_human.js';
import { HUMAN_LOOKS } from './units_looks.js';
import { MOUNT_LOOKS, genMounted } from './units_mount.js';
import { genBeast, BEAST_LOOKS, BEAST_IDLE_FRAMES } from './units_beast.js';
import { genSiege, SIEGE_INFO, SIEGE_IDS } from './units_siege.js';
import { renderBust } from './units_icons.js';

export const ANIMS = ['idle', 'walk', 'attack', 'chop', 'mine', 'farm', 'forage', 'butcher', 'build', 'death', 'corpse'];
const ANIM_INDEX = Object.create(null);
ANIMS.forEach((a, i) => { ANIM_INDEX[a] = i; });
const A_IDLE = 0, A_WALK = 1, A_ATTACK = 2, A_DEATH = 9, A_CORPSE = 10;

// ------------------------------------------------------------------ registry
const HUMAN_HEIGHT = { archer: 31, crossbowman: 32, arbalester: 33, skirmisher: 31, elite_skirmisher: 32, monk: 32, longbowman: 32, elite_longbowman: 33, champion: 35, two_handed: 34, halberdier: 34, pikeman: 33 };
const DEFS = [];
const TYPE_INDEX = Object.create(null);
const COUNTS_HUMAN = [1, 8, 6, 1, 1, 1, 1, 1, 1, 6, 1];
const COUNTS_VILLAGER = [1, 8, 6, 6, 6, 6, 6, 6, 6, 6, 1];
const IDENT = [0, 1, 2, 0, 0, 0, 0, 0, 0, 9, 10];            // non-villagers: work anims -> idle
const IDENT_V = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function reg(id, kind, o = {}) {
  const idx = DEFS.length;
  const d = Object.assign({ id, kind, idx, counts: COUNTS_HUMAN, animMap: IDENT, cache: new Map(), height: 32, variants: 4, cycle: WALK_CYCLE_UNITS / 40 }, o);
  DEFS.push(d); TYPE_INDEX[id] = idx;
  return d;
}

const HUMAN_IDS = Object.keys(HUMAN_LOOKS);
for (const id of HUMAN_IDS) {
  if (id === 'villager') reg(id, 'human', { counts: COUNTS_VILLAGER, animMap: IDENT_V, variants: 8, height: 31 });
  else reg(id, 'human', { height: HUMAN_HEIGHT[id] || 33 });
}
for (const id of Object.keys(MOUNT_LOOKS)) {
  const camel = id.indexOf('camel') >= 0;
  reg(id, 'mounted', { height: camel ? 54 : 47, cycle: camel ? 0.82 : 0.72 });
}
for (const id of SIEGE_IDS) reg(id, 'siege', { height: SIEGE_INFO[id].height, cycle: SIEGE_INFO[id].cycle });
const BEAST_H = { deer: 25, boar: 15, sheep: 15, wolf: 16 };
const BEAST_CYCLE = { deer: 0.5, boar: 0.34, sheep: 0.25, wolf: 0.5 };
for (const id of Object.keys(BEAST_LOOKS)) {
  const c = COUNTS_HUMAN.slice(); c[0] = BEAST_IDLE_FRAMES[id] || 2;
  reg(id, 'beast', { counts: c, height: BEAST_H[id], cycle: BEAST_CYCLE[id], teamless: id !== 'sheep' });
}
const FALLBACK = TYPE_INDEX.militia;

const generators = { human: genHuman, mounted: genMountedType, beast: genBeastType, siege: genSiegeType };
/** other modules register their generators here (siege) */
export function registerKind(kind, gen) { generators[kind] = gen; }

// ------------------------------------------------------------------ generation
const SC = new Scene();
const LOOKS = new Map();
function lookFor(d, team, variant, carry) {
  const key = d.idx + '|' + team + '|' + variant + '|' + carry;
  let L = LOOKS.get(key);
  if (!L) {
    L = HUMAN_LOOKS[d.id](teamColor(team), variant);
    if (carry) { L.back = (L.back || []).concat([{ k: 'load', kind: carry === 1 ? 'food' : carry === 2 ? 'wood' : carry === 3 ? 'gold' : 'stone' }]); }
    LOOKS.set(key, L);
  }
  return L;
}

function genHuman(d, team, dir, ai, frame, variant, carry) {
  const L = lookFor(d, team, variant, carry);
  const po = humanPose(L.style, ANIMS[ai], frame);
  if (SC.icon) iconAdjust(po);
  const J = solveHuman(po, L.sc, L.build || 1);
  SC.begin(dir);
  if (po.fall) SC.xf = xfPitch(-po.fall, [0, 0, 0], po.fallT);
  drawHuman(SC, J, po, L, teamColor(team));
  if (ai === A_ATTACK && !SC.buildOnly) weaponTrail(SC, L, L.style, frame, J, po, false);
  return finish(SC);
}

const MLOOKS = new Map();
function genMountedType(d, team, dir, ai, frame, variant) {
  const key = d.idx * 64 + team * 8 + variant;
  let L = MLOOKS.get(key);
  if (!L) { L = MOUNT_LOOKS[d.id](teamColor(team), variant); MLOOKS.set(key, L); }
  return genMounted(SC, d, L, teamColor(team), dir, ANIMS[ai], frame, variant);
}
function genSiegeType(d, team, dir, ai, frame, variant) {
  return genSiege(SC, d, teamColor(team), dir, ANIMS[ai], frame, variant);
}
function genBeastType(d, team, dir, ai, frame, variant) {
  return genBeast(SC, d.id, teamColor(team), dir, ANIMS[ai], frame, variant, team);
}

// ------------------------------------------------------------------ public API
export function animFrames(type, anim) {
  const d = DEFS[TYPE_INDEX[type]] || DEFS[FALLBACK];
  const ai = ANIM_INDEX[anim];
  if (ai === undefined) return 1;
  return d.counts[d.animMap[ai]];
}

// ---- cache accounting (soft LRU by bytes): the engine may ask for many (team, variant, carry) combinations over a long game
let cacheBytes = 0, cacheLimit = 640 * 1048576, TICK = 0, cacheCount = 0;
/** change the soft memory cap (bytes of canvas backing store, default 640 MB). Least recently used sprites are dropped and regenerated on demand. */
export function setUnitCacheLimit(bytes) { cacheLimit = Math.max(16 * 1048576, bytes | 0); }
export function unitCacheStats() { return { bytes: cacheBytes, sprites: cacheCount, limit: cacheLimit }; }
function evictCache() {
  const all = [];
  for (let i = 0; i < DEFS.length; i++) for (const [k, s] of DEFS[i].cache) all.push([s.u, i, k, s]);
  all.sort((a, b) => a[0] - b[0]);
  const target = cacheLimit * 0.72;
  for (let i = 0; i < all.length && cacheBytes > target; i++) {
    const e = all[i];
    DEFS[e[1]].cache.delete(e[2]);
    cacheBytes -= e[3].canvas.width * e[3].canvas.height * 4; cacheCount--;
  }
}

export function getUnitSprite(type, team, dir, anim, frame, opts) {
  let ti = TYPE_INDEX[type];
  if (ti === undefined) ti = FALLBACK;
  const d = DEFS[ti];
  let ai = ANIM_INDEX[anim];
  if (ai === undefined) ai = 0;
  ai = d.animMap[ai];
  if (ai === A_CORPSE) { ai = A_DEATH; frame = 5; }            // corpse == last death frame (shared sprite)
  const n = d.counts[ai];
  frame = n > 1 ? (((frame | 0) % n) + n) % n : 0;
  let v = 0, c = 0;
  if (opts) {
    v = (opts.variant | 0) & (d.variants - 1);
    const cy = opts.carry;
    if (cy && (ai === A_IDLE || ai === A_WALK) && d.kind === 'human' && d.id === 'villager') c = cy === 'food' ? 1 : cy === 'wood' ? 2 : cy === 'gold' ? 3 : cy === 'stone' ? 4 : 0;
  }
  team = d.teamless ? 0 : team & 7; dir = dir & 7;
  const key = ((((((v * 5 + c) * 8 + team) * 8 + dir) * 11 + ai) * 8) + frame);
  let s = d.cache.get(key);
  if (s !== undefined) { s.u = ++TICK; return s; }
  s = generators[d.kind](d, team, dir, ai, frame, v, c);
  s.u = ++TICK;
  d.cache.set(key, s);
  cacheBytes += s.canvas.width * s.canvas.height * 4; cacheCount++;
  if (cacheBytes > cacheLimit) evictCache();
  return s;
}

const INFO = new Map();
/** { height, width, cycleTiles, mounted }: height = distance from the ground anchor to the top of the body (head / machine), logical px */
export function unitSpriteInfo(type) {
  const ti = TYPE_INDEX[type] === undefined ? FALLBACK : TYPE_INDEX[type];
  let r = INFO.get(ti);
  if (r) return r;
  const d = DEFS[ti];
  let h = d.height, w = 20;
  try {
    const S = buildUnitScene(d.id, 1, 1, 'idle', 0, 0);
    if (d.kind === 'human') h = Math.round(-(S.headScr[1] - S.headR * 1.14 - 0.6)) + 1;
    else if (d.kind === 'mounted') h = Math.round(-(S.headScr[1] - S.headR * 1.14 - 0.6)) + 1;
    else h = Math.round(-S.y0) - (d.kind === 'siege' ? 1 : 0);
    w = Math.round(S.x1 - S.x0);
  } catch (e) { /* keep defaults */ }
  if (d.id === 'trebuchet') h = 58;                    // unpacked machine is much taller than the packed cart
  r = { height: h, width: w, cycleTiles: d.cycle, kind: d.kind };
  INFO.set(ti, r);
  return r;
}

export function getUnitIcon(type, team = 1) { return iconFor(type, team, 48); }
export function getUnitPortrait(type, team = 1) { return iconFor(type, team, 72); }

const ICONS = new Map();
const ICON_DIR = { human: 0, mounted: 0, beast: 2, siege: 2 };
function classOf(id) {
  const u = UNITS[id], tags = (u && u.tags) || [];
  if (tags.includes('villager')) return 'civilian';
  if (tags.includes('monk')) return 'monk';
  if (tags.includes('animal')) return 'animal';
  if (tags.includes('siege')) return 'siege';
  if (tags.includes('cavalry')) return 'cavalry';
  if (tags.includes('ranged') || tags.includes('archer')) return 'ranged';
  return 'infantry';
}
function iconFor(type, team, size) {
  team = team & 7;
  const key = ((TYPE_INDEX[type] === undefined ? FALLBACK : TYPE_INDEX[type]) * 8 + team) * 100 + size;
  let c = ICONS.get(key);
  if (c) return c;
  const d = DEFS[TYPE_INDEX[type] === undefined ? FALLBACK : TYPE_INDEX[type]];
  SC.buildOnly = true; SC.icon = true;
  let S;
  try { S = generators[d.kind](d, team, ICON_DIR[d.kind] | 0, A_IDLE, 0, 0, 0); } finally { SC.buildOnly = false; SC.icon = false; }
  c = renderBust(S, size, team, teamColor(team), classOf(d.id), d.kind, d);
  ICONS.set(key, c);
  return c;
}

const WARM_ANIMS_DEFAULT = ['idle', 'walk', 'attack', 'death', 'corpse'];
// Chrome records canvas drawing and rasterizes lazily (first drawImage). Drawing each fresh sprite 1x1 into a sink canvas and
// flushing it now moves that cost into the warm slices instead of the first game frames that show the sprite.
let sinkCtx = null;
function forceRaster(s) {
  if (!sinkCtx) { const c = document.createElement('canvas'); c.width = 8; c.height = 8; sinkCtx = c.getContext('2d', { willReadFrequently: true }); }
  sinkCtx.drawImage(s.canvas, 0, 0, 1, 1);
}
/**
 * Pre-generate sprites in time slices. types: unit ids (default all), teams (default [1,2]), onProgress(0..1).
 * opts: { anims: ['idle','walk',...], dirs: [0..7], budget: ms per slice (default 10), raster: false to skip raster forcing }
 */
export function warmUnitSprites(types, teams, onProgress, opts) {
  types = types || DEFS.map(d => d.id);
  teams = teams || [1, 2];
  const anims = (opts && opts.anims) || WARM_ANIMS_DEFAULT;
  const dirs = (opts && opts.dirs) || [0, 1, 2, 3, 4, 5, 6, 7];
  const jobs = [];
  // order: all idle frames first, then walk, attack, death, work anims ... so that a partially finished warm is still useful
  const order = [];
  for (const a of ANIMS) if (a !== 'corpse') order.push(a);
  for (const a of order) {
    const ai = ANIM_INDEX[a];
    for (const t of types) {
      const ti = TYPE_INDEX[t]; if (ti === undefined) continue;
      const d = DEFS[ti];
      const wanted = (d.id === 'villager' && !(opts && opts.anims)) ? ANIMS : anims;
      if (wanted.indexOf(a) < 0 && !(a === 'death' && wanted.indexOf('corpse') >= 0)) continue;
      if (d.animMap[ai] !== ai) continue;
      const tl = d.teamless ? [0] : teams;
      const n = d.counts[ai];
      for (const team of tl) for (const dir of dirs) for (let f = 0; f < n; f++) jobs.push([t, team, dir, a, f]);
    }
  }
  const budget = (opts && opts.budget) || 10, raster = !(opts && opts.raster === false);
  return new Promise(resolve => {
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < budget) {
        const j = jobs[i++];
        const s = getUnitSprite(j[0], j[1], j[2], j[3], j[4]);
        if (raster) forceRaster(s);
      }
      if (raster && sinkCtx) sinkCtx.getImageData(0, 0, 1, 1);
      if (onProgress) onProgress(jobs.length ? i / jobs.length : 1);
      if (i < jobs.length) setTimeout(step, 0); else resolve();
    };
    step();
  });
}

/** diagnostics / icons: build (but do not render) the scene of one frame */
export function buildUnitScene(type, team, dir, anim, frame, variant = 0) {
  let ti = TYPE_INDEX[type]; if (ti === undefined) ti = FALLBACK;
  const d = DEFS[ti]; let ai = ANIM_INDEX[anim]; if (ai === undefined) ai = 0; ai = d.animMap[ai];
  SC.buildOnly = true;
  try { return generators[d.kind](d, team & 7, dir & 7, ai, frame % d.counts[ai], variant & (d.variants - 1), 0); } finally { SC.buildOnly = false; }
}

/** all unit ids the module can draw (diagnostics) */
export function allUnitTypes() { return DEFS.map(d => d.id); }
export function unitKind(type) { const d = DEFS[TYPE_INDEX[type]]; return d ? d.kind : null; }
