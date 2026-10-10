// Natural-resource art for "Age of Crowns": trees, stumps, berry bushes, gold/stone mines, animal carcasses, ground decor, icons.
// All art is procedural (Canvas 2D), supersampled through makeCanvas(), deterministic (seeded rng, no Math.random) and cached.
// Hot path (getResourceSprite / getDecorSprite): integer-indexed preallocated arrays, no allocation, lazy generation on first use.
//
// Public API (docs/ART_SPEC.md section 3):
//   getResourceSprite(kind, variant, fill) -> {canvas,w,h,ax,ay}   kinds: tree stump berries gold_mine stone_mine carcass_deer carcass_boar carcass_sheep
//   treeVariantCount()                      -> number of tree variants (variant wraps by floor-modulo, any int incl. negative/huge)
//   getDecorSprite(kind, variant) / decorVariantCount(kind)   kinds: tuft flowers rocks mushrooms fern reeds shrub log pebbles
//   getResourceIcon(kind) -> 24x24 canvas (aliases: food->berries, wood->tree, gold->gold_mine, stone->stone_mine)
// Extras: warmResourceSprites(onProgress?, budgetMs?) -> Promise (time-sliced pre-generation for the loading screen),
//         treeFamily(variant) -> 'oak'|'conifer'|'birch'|'autumn'|'dead'|'pine'|'poplar'|'young' (for forest-type aware map generation).
// Tree variants (30): 0-9 oaks, 10-18 conifers (spruce/fir), 19-22 birches, 23-24 young trees, 25 poplar, 26 stone pine, 27 Scots pine,
//                     28 autumn, 29 dead. The common forest trees are the large majority; oddballs are ~3% each under a uniform pick.
// fill levels (berries, mines, carcasses): fill > 0.66 -> 2 (full), > 0.33 -> 1 (about half), else 0 (few / bones).
import { makeCanvas, toSprite } from './common.js';
import { TREE_COUNT, buildTree, treeFamily } from './resources_trees.js';
import { buildStump, buildBerries, buildMine } from './resources_nodes.js';
import { buildCarcass } from './resources_animals.js';
import { DECOR_KINDS, DECOR_COUNTS, buildDecor } from './resources_decor.js';
import { buildIcon } from './resources_icons.js';

// ------------------------------------------------------------------ caches (preallocated, integer indexed)
const TREES = new Array(TREE_COUNT).fill(null);
const STUMPS = new Array(TREE_COUNT).fill(null);
const BERRY_VARIANTS = 3, MINE_VARIANTS = 4;
const BERRIES = new Array(BERRY_VARIANTS * 3).fill(null);
const GOLD_MINES = new Array(MINE_VARIANTS * 3).fill(null);
const STONE_MINES = new Array(MINE_VARIANTS * 3).fill(null);
const CARC_VARIANTS = 2;
const CARC_DEER = new Array(CARC_VARIANTS * 3).fill(null);
const CARC_BOAR = new Array(CARC_VARIANTS * 3).fill(null);
const CARC_SHEEP = new Array(CARC_VARIANTS * 3).fill(null);
const DECOR = DECOR_KINDS.map((k, i) => new Array(DECOR_COUNTS[i]).fill(null));
const DECOR_INDEX = Object.create(null);
DECOR_KINDS.forEach((k, i) => { DECOR_INDEX[k] = i; });
const ICON_BASE = ['tree', 'stump', 'berries', 'gold_mine', 'stone_mine', 'carcass_deer', 'carcass_boar', 'carcass_sheep'];
const ICON_INDEX = Object.create(null);
ICON_BASE.forEach((k, i) => { ICON_INDEX[k] = i; });
ICON_INDEX.food = 2; ICON_INDEX.wood = 0; ICON_INDEX.gold = 3; ICON_INDEX.stone = 4;
const ICONS = new Array(ICON_BASE.length + 1).fill(null);          // last slot = fallback icon for unknown kinds
let FALLBACK = null;

function fallbackSprite() {
  if (FALLBACK) return FALLBACK;
  const S = makeCanvas(20, 16), c = S.ctx;
  c.fillStyle = '#8a8478'; c.beginPath(); c.ellipse(10, 9, 7, 4.5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#b6b0a2'; c.beginPath(); c.ellipse(8, 7.5, 4, 2.4, 0, 0, Math.PI * 2); c.fill();
  FALLBACK = toSprite(S, 10, 10);
  return FALLBACK;
}

/** fill 0..1 -> visual level 0 (few/none), 1 (about half), 2 (full). undefined / NaN count as full, negatives as empty. */
function fillLevel(fill) {
  if (typeof fill !== 'number') fill = slowNumber(fill, 1);
  if (fill > 0.66) return 2;
  if (fill > 0.33) return 1;
  if (fill >= 0) return 0;
  return fill < 0 ? 0 : 2;
}
/** non-number garbage (strings, objects, null, symbols, bigints): coerce without ever throwing */
function slowNumber(v, dflt) {
  if (v === undefined || v === null) return dflt;
  try { return +v; } catch (e) { return dflt; }
}
function slowIndex(v) {
  try { return +v | 0; } catch (e) { return 0; }
}

/** cold path only: a failing builder must never break the frame - it degrades to the (cached) fallback sprite */
function build(fn, a, b, c) {
  try { return fn(a, b, c); } catch (e) {
    if (typeof console !== 'undefined' && console.warn) console.warn('resources art: sprite generation failed', e);
    return fallbackSprite();
  }
}

export function treeVariantCount() { return TREE_COUNT; }
export { treeFamily };

export function getResourceSprite(kind, variant, fill) {
  if (kind === 'tree') {
    let i = (typeof variant === 'number' ? variant | 0 : slowIndex(variant)) % TREE_COUNT; if (i < 0) i += TREE_COUNT;
    return TREES[i] || (TREES[i] = build(buildTree, i));
  }
  if (kind === 'stump') {
    let i = (typeof variant === 'number' ? variant | 0 : slowIndex(variant)) % TREE_COUNT; if (i < 0) i += TREE_COUNT;
    return STUMPS[i] || (STUMPS[i] = build(buildStump, i));
  }
  const vi = typeof variant === 'number' ? variant | 0 : slowIndex(variant);
  switch (kind) {
    case 'berries': { let v = vi % BERRY_VARIANTS; if (v < 0) v += BERRY_VARIANTS; const lv = fillLevel(fill), i = v * 3 + lv; return BERRIES[i] || (BERRIES[i] = build(buildBerries, v, lv)); }
    case 'gold_mine': { let v = vi % MINE_VARIANTS; if (v < 0) v += MINE_VARIANTS; const lv = fillLevel(fill), i = v * 3 + lv; return GOLD_MINES[i] || (GOLD_MINES[i] = build(buildMine, 'gold_mine', v, lv)); }
    case 'stone_mine': { let v = vi % MINE_VARIANTS; if (v < 0) v += MINE_VARIANTS; const lv = fillLevel(fill), i = v * 3 + lv; return STONE_MINES[i] || (STONE_MINES[i] = build(buildMine, 'stone_mine', v, lv)); }
    case 'carcass_deer': { let v = vi % CARC_VARIANTS; if (v < 0) v += CARC_VARIANTS; const lv = fillLevel(fill), i = v * 3 + lv; return CARC_DEER[i] || (CARC_DEER[i] = build(buildCarcass, 'carcass_deer', v, lv)); }
    case 'carcass_boar': { let v = vi % CARC_VARIANTS; if (v < 0) v += CARC_VARIANTS; const lv = fillLevel(fill), i = v * 3 + lv; return CARC_BOAR[i] || (CARC_BOAR[i] = build(buildCarcass, 'carcass_boar', v, lv)); }
    case 'carcass_sheep': { let v = vi % CARC_VARIANTS; if (v < 0) v += CARC_VARIANTS; const lv = fillLevel(fill), i = v * 3 + lv; return CARC_SHEEP[i] || (CARC_SHEEP[i] = build(buildCarcass, 'carcass_sheep', v, lv)); }
    default: return fallbackSprite();
  }
}
export function decorVariantCount(kind) {
  const k = typeof kind === 'string' ? DECOR_INDEX[kind] : undefined;
  return k === undefined ? 1 : DECOR_COUNTS[k];
}
export function getDecorSprite(kind, variant) {
  const k = typeof kind === 'string' ? DECOR_INDEX[kind] : undefined;
  if (k === undefined) return fallbackSprite();
  const arr = DECOR[k], n = DECOR_COUNTS[k];
  let v = (typeof variant === 'number' ? variant | 0 : slowIndex(variant)) % n; if (v < 0) v += n;
  return arr[v] || (arr[v] = build(buildDecor, k, v));
}
function buildIconSafe(kind) {
  try { return buildIcon(kind); } catch (e) {
    if (typeof console !== 'undefined' && console.warn) console.warn('resources art: icon generation failed', e);
    return makeCanvas(24, 24).canvas;
  }
}
export function getResourceIcon(kind) {
  let i = typeof kind === 'string' ? ICON_INDEX[kind] : undefined;
  if (i === undefined) i = ICON_BASE.length;
  return ICONS[i] || (ICONS[i] = buildIconSafe(i < ICON_BASE.length ? ICON_BASE[i] : 'unknown'));
}
/**
 * Pre-generate every sprite in small time-sliced chunks (for the loading screen). Returns a Promise that resolves with the number of
 * sprites generated. onProgress(done, total) is optional. `budgetMs` = max work per slice before yielding to the event loop.
 */
export function warmResourceSprites(onProgress, budgetMs = 6) {
  const jobs = [];
  for (let v = 0; v < TREE_COUNT; v++) { jobs.push(() => getResourceSprite('tree', v)); jobs.push(() => getResourceSprite('stump', v)); }
  const FILLS = [1, 0.5, 0];
  for (let v = 0; v < BERRY_VARIANTS; v++) for (const f of FILLS) jobs.push(() => getResourceSprite('berries', v, f));
  for (let v = 0; v < MINE_VARIANTS; v++) for (const f of FILLS) { jobs.push(() => getResourceSprite('gold_mine', v, f)); jobs.push(() => getResourceSprite('stone_mine', v, f)); }
  for (let v = 0; v < CARC_VARIANTS; v++) for (const f of FILLS) {
    jobs.push(() => getResourceSprite('carcass_deer', v, f)); jobs.push(() => getResourceSprite('carcass_boar', v, f)); jobs.push(() => getResourceSprite('carcass_sheep', v, f));
  }
  DECOR_KINDS.forEach((k, ki) => { for (let v = 0; v < DECOR_COUNTS[ki]; v++) jobs.push(() => getDecorSprite(k, v)); });
  for (const k of ICON_BASE) jobs.push(() => getResourceIcon(k));
  const total = jobs.length;
  let i = 0;
  const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();
  return new Promise((resolve) => {
    const step = () => {
      const t0 = now();
      do { try { jobs[i](); } catch (e) { /* a failing sprite must never block the loading screen */ } i++; } while (i < total && now() - t0 < budgetMs);
      if (onProgress) { try { onProgress(i, total); } catch (e) { /* ignore */ } }
      if (i < total) setTimeout(step, 0); else resolve(total);
    };
    setTimeout(step, 0);
  });
}
