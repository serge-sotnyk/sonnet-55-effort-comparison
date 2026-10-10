// Tech / command glyph icons: 'glyph:<name>[:accent]'. Glyph artwork lives in icons_g_*.js (registered into GLYPHS).
import { mix, shade } from './common.js';
import { C, BG, tintBG, frameIcon } from './icons_kit.js';
import { GLYPHS, ACCENTS, ORN } from './icons_parts.js';
import './icons_g_eco.js';
import './icons_g_mil.js';
import './icons_g_build.js';

export { GLYPHS, ACCENTS };
export const ACCENT_NAMES = Object.keys(ACCENTS);

// order of names exposed to tests / UI (every glyph used by js/data/techs.js is here)
export const GLYPH_ORDER = ['cloth', 'wheelbarrow', 'cart', 'eye', 'collar', 'plow', 'crop', 'axe', 'saw', 'pickaxe', 'sword', 'shield', 'barding', 'bow', 'archerarmor', 'boots', 'ring', 'horse', 'castle', 'crane', 'tower', 'wall', 'gear', 'cross', 'scroll', 'book', 'coin', 'banner'];

/** Build a glyph icon surface (opaque rounded square). Unknown names fall back to the gear glyph. */
export function buildGlyphIcon(name, accent, size) {
  const d = GLYPHS[name] || GLYPHS.gear;
  const A = accent ? ACCENTS[accent] : null;
  let bg = BG[d.cat] || BG.neutral;
  if (A) bg = tintBG(bg, A.tint, A.t);
  const m = {
    acc: accent || '', metal: A ? A.metal : C.steel, trim: A ? A.trim : C.gold, field: null,
  };
  if (A && accent !== 'gold') { const f = mix(A.tint, '#143a8a', 0.5); m.field = [shade(f, 0.3), f, shade(f, -0.4)]; }
  const own = d.own === '*' || (A && Array.isArray(d.own) && d.own.includes(accent));
  const o = { rays: (A && A.rays) || d.rays || 0, rayRot: 0.1 };
  return frameIcon(size, bg, name + ':' + (accent || ''), g => {
    d.draw(g, m);
    if (A && !own && ORN[accent]) ORN[accent](g);
  }, o);
}
