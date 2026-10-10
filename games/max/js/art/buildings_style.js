// Age-dependent material palettes and painter selection for the building art.
// age 0 Dark: wattle & daub, thatch, rough stone.  1 Feudal: plaster + timber frame, terracotta tiles, stone footings.
// 2 Castle: grey stone, slate, ornament.  3 Imperial: pale cut stone, glazed tiles, gold trim.
import * as P from './buildings_paint.js';
import { shade, mix } from './common.js';

export const PAL = [
  { plaster: '#cdb07a', timber: '#58391f', stone: '#8d8777', roof: '#c9a24a', trim: '#4a3220', ridge: '#7a5a28', wood: '#7a5530', door: '#6a4526', accent: '#8a6a3a', gold: '#c8a040' },
  { plaster: '#eadfc4', timber: '#47301f', stone: '#a29c8c', roof: '#cf6030', trim: '#47301f', ridge: '#8a3a1e', wood: '#8a6038', door: '#6a4526', accent: '#c05a30', gold: '#d8b050' },
  { plaster: '#e2d8bc', timber: '#3e2a1c', stone: '#a9a395', roof: '#7b8494', trim: '#3a2c20', ridge: '#3e4658', wood: '#7e5a38', door: '#5a3e24', accent: '#7b8494', gold: '#d8b050' },
  { plaster: '#eee6d0', timber: '#3a2818', stone: '#dcd5c2', roof: '#a8402e', trim: '#4a3a2a', ridge: '#d8aa40', wood: '#7a5636', door: '#5a3e24', accent: '#b0402e', gold: '#e6bd44' },
];

export function pal(age) { return PAL[Math.max(0, Math.min(3, age | 0))]; }

/** stone masonry for the age (rough dark age stone -> fine ashlar) */
export function stoneWall(age, o = {}) {
  const p = pal(age);
  switch (age | 0) {
    case 0: return P.stoneP({ base: o.base || p.stone, ch: 8, bw: 14, rough: 0.55, spread: 0.2, ...o });
    case 1: return P.stoneP({ base: o.base || p.stone, ch: 8, bw: 13, rough: 0.3, ...o });
    case 2: return P.stoneP({ base: o.base || p.stone, ch: 8.5, bw: 14, rough: 0.22, moss: 0.35, cracks: 1, ...o });
    default: return P.ashlarP({ base: o.base || p.stone, ch: 10, bw: 18, ...o });
  }
}
/** the "living" wall: wattle / plaster+timber / jettied timber / ashlar */
export function mainWall(age, o = {}) {
  const p = pal(age);
  switch (age | 0) {
    case 0: return withFooting(P.wattleP({ base: o.base || p.plaster, wood: p.timber }), P.stoneP({ base: p.stone, ch: 6, bw: 10, rough: 0.6 }), o.footing === undefined ? 5 : o.footing);
    case 1: return P.halfTimberP({ base: o.base || p.plaster, col: p.timber, footing: o.footing === undefined ? 7 : o.footing, footBase: p.stone, brace: 'v', pw: o.pw || 21, rails: o.rails });
    case 2: return P.halfTimberP({ base: o.base || p.plaster, col: p.timber, footing: o.footing === undefined ? 6 : o.footing, footBase: p.stone, brace: o.brace || 'x', pw: o.pw || 16, rails: o.rails });
    default: return stoneWall(3, { base: o.base, band: o.band });
  }
}
export function withFooting(base, foot, fh) {
  return (c, w, h, rnd) => {
    base(c, w, h, rnd);
    if (fh > 0) {
      c.save(); c.translate(0, h - fh); c.beginPath(); c.rect(-1, 0, w + 2, fh + 1); c.clip(); foot(c, w, fh, rnd);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-1, 0, w + 2, 1.2); c.restore();
    }
  };
}
/** wooden board wall: logs (dark) / planks */
export function woodWall(age, o = {}) {
  const p = pal(age);
  if ((age | 0) === 0) return P.logsP({ base: o.base || p.wood });
  return P.planksP({ base: o.base || p.wood, bw: o.bw, rails: o.rails });
}
/** roof surface for the age */
export function roofMat(age, kind = 'main', o = {}) {
  const p = pal(age);
  if (kind === 'thatch' || (kind === 'main' && (age | 0) === 0)) return P.thatchP({ base: o.base || p.roof, ...o });
  if (kind === 'wood') return P.shinglesP({ base: o.base || '#8a6a44', ...o });
  if (kind === 'slate') return P.slateP({ base: o.base || '#7b8494', ...o });
  if (kind === 'copper') return P.copperP({ base: o.base || '#4f9a86', ...o });
  switch (age | 0) {
    case 1: return P.panTilesP({ base: o.base || p.roof, ...o });
    case 2: return P.tilesP({ base: o.base || '#b85a34', ...o });
    default: return P.tilesP({ base: o.base || p.roof, ...o });
  }
}
/** compose painters: draw base then decals in order */
export function decorate(base, ...decals) { return (c, w, h, r) => { base(c, w, h, r); for (const d of decals) d(c, w, h, r); }; }
