// Icons for Age of Crowns: tech/command glyph icons, age + civ emblems, resource icons and UI glyphs.
// Everything is procedural (Canvas 2D); results are cached per (spec, size). See docs/ART_SPEC.md section 4.
//
//   getIcon('glyph:sword:gold', 48)  getIcon('age:2')  getIcon('civ:britons')  getIcon('res:food')  getIcon('ui:attack', 32)
//   -> HTMLCanvasElement (logical size x size px; backing store is SCALE times larger). The canvas is shared/cached: do not mutate it.
import { getSpriteScale } from './common.js';
import { GLYPHS, GLYPH_ORDER, ACCENTS, buildGlyphIcon } from './icons_glyphs.js';
import { buildRes } from './icons_res.js';
import { buildUi } from './icons_ui.js';
import { buildAge, buildCiv } from './icons_emblems.js';

const cache = new Map();          // spec -> Map(size -> canvas)
let lastScale = 0;

function build(spec, size) {
  const i = spec.indexOf(':');
  const kind = i < 0 ? spec : spec.slice(0, i);
  const rest = i < 0 ? '' : spec.slice(i + 1);
  let surf;
  if (kind === 'glyph') {
    const j = rest.indexOf(':');
    const name = j < 0 ? rest : rest.slice(0, j);
    const acc = j < 0 ? '' : rest.slice(j + 1);
    surf = buildGlyphIcon(name, ACCENTS[acc] ? acc : '', size);
  } else if (kind === 'age') {
    surf = buildAge(+rest, size);
  } else if (kind === 'civ') {
    surf = buildCiv(rest, size);
  } else if (kind === 'res') {
    surf = buildRes(rest, size);
  } else if (kind === 'ui') {
    surf = buildUi(rest, size);
  } else {
    surf = buildGlyphIcon('gear', '', size);
  }
  const c = surf.canvas;
  c.style.width = size + 'px'; c.style.height = size + 'px';
  return c;
}

/** spec -> canvas. Default size: 24 for res:*, otherwise 48. Cheap on repeat calls (two Map lookups). */
export function getIcon(spec, size) {
  if (typeof spec !== 'string') spec = 'glyph:gear';
  const sc = getSpriteScale();
  if (sc !== lastScale) { cache.clear(); lastScale = sc; }
  let m = cache.get(spec);
  if (!m) { m = new Map(); cache.set(spec, m); }
  const sz = size ? Math.round(size) : (spec.charCodeAt(0) === 114 && spec.charCodeAt(1) === 101 ? 24 : 48);
  let c = m.get(sz);
  if (!c) { c = build(spec, sz); m.set(sz, c); }
  return c;
}

/** names of all supported 'glyph:<name>' icons */
export function glyphNames() { return GLYPH_ORDER.slice(); }
