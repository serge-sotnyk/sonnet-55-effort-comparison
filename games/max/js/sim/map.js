// Random map generation: terrain, water, forests, fair starting layouts, neutral resources, wildlife.
import { RNG, fbm, hash2, MinHeap } from './util.js';
import { T } from '../data/constants.js';

export const MAP_TYPES = {
  highlands:   { name: 'Highlands',    desc: 'Rolling grassland with scattered woods and ponds. A balanced, open map.' },
  blackforest: { name: 'Black Forest', desc: 'Dense forests wall off each base; fight through narrow glades and corridors.' },
  lakeland:    { name: 'Lakeland',     desc: 'Great lakes divide the land. Cross the shallow fords to reach your rival.' },
  meadows:     { name: 'Meadows',      desc: 'Wide open plains with few trees. Cavalry and archers rule here.' },
};
export const MAP_SIZES = { small: 88, medium: 120, large: 152 };

const D2R = Math.PI / 180;

export function generateMap(opts) {
  const type = MAP_TYPES[opts.type] ? opts.type : 'highlands';
  const size = opts.size || 120;
  const numPlayers = Math.max(2, Math.min(8, opts.numPlayers || 2));
  const seed = opts.seed >>> 0 || 12345;
  const rng = new RNG(seed);
  const w = size, h = size, cx = (w - 1) / 2, cy = (h - 1) / 2;
  const N = w * h;
  const terrain = new Uint8Array(N);              // T.*
  const height = new Uint8Array(N);
  const occ = new Uint8Array(N);                  // 1 = object placed here (tree/mine/etc), 2 = reserved (TC area)
  const objects = [];                             // placed objects
  const objAt = new Int32Array(N).fill(-1);
  const idx = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  // ---------------------------------------------------------------- symmetric noise helpers
  const symN = numPlayers === 2 ? 2 : numPlayers === 4 ? 4 : 1;
  function mirrors(x, y) {
    if (symN === 2) return [[x, y], [2 * cx - x, 2 * cy - y]];
    if (symN === 4) {
      const dx = x - cx, dy = y - cy;
      return [[x, y], [cx - dy, cy + dx], [cx - dx, cy - dy], [cx + dy, cy - dx]];
    }
    return [[x, y]];
  }
  function noise(x, y, scale, s, oct = 4) {
    const m = mirrors(x, y); let v = 0;
    for (const [px, py] of m) v += fbm(px * scale, py * scale, seed + s, oct);
    return v / m.length;
  }
  function canonHash(x, y, s) {
    const m = mirrors(x, y); let best = null;
    for (const [px, py] of m) { const rx = Math.round(px), ry = Math.round(py); if (!best || rx < best[0] || (rx === best[0] && ry < best[1])) best = [rx, ry]; }
    return hash2(best[0], best[1], seed + s);
  }

  // ---------------------------------------------------------------- start positions
  const starts = [];
  const R = size * 0.30;
  const a0 = 135 * D2R;                           // player 1 at the left corner of the diamond
  for (let i = 0; i < numPlayers; i++) {
    const a = a0 + (i * 2 * Math.PI) / numPlayers;
    starts.push({ x: Math.round(cx + Math.cos(a) * R), y: Math.round(cy + Math.sin(a) * R), angle: a });
  }
  const startDist = (x, y) => { let d = 1e9; for (const s of starts) d = Math.min(d, Math.hypot(x - s.x, y - s.y)); return d; };

  // ---------------------------------------------------------------- base terrain
  const lakeScale = 0.05;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      const el = noise(x, y, 0.045, 1, 4);
      height[i] = Math.max(0, Math.min(255, Math.round(el * 255)));
      let t = T.GRASS;
      const dirt = noise(x, y, 0.09, 2, 3);
      if (dirt > 0.6) t = T.DIRT;
      // map border: ocean + beach, organic coastline
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const shore = 3.2 + 3.0 * fbm(x * 0.08, y * 0.08, seed + 9, 3);
      if (edge < shore - 2.2) t = T.DEEP;
      else if (edge < shore - 0.9) t = T.SHALLOW;
      else if (edge < shore + 1.2) t = T.SAND;
      terrain[i] = t;
    }
  }

  // ---------------------------------------------------------------- water bodies per map type
  function carveLake(lx, ly, rx, ry, s) {
    for (let y = Math.max(0, Math.floor(ly - ry - 3)); y <= Math.min(h - 1, Math.ceil(ly + ry + 3)); y++) {
      for (let x = Math.max(0, Math.floor(lx - rx - 3)); x <= Math.min(w - 1, Math.ceil(lx + rx + 3)); x++) {
        const dx = (x - lx) / rx, dy = (y - ly) / ry;
        const wob = 1 + (fbm(x * 0.2, y * 0.2, seed + s, 2) - 0.5) * 0.7;
        const d = Math.hypot(dx, dy) / wob;
        const i = idx(x, y);
        if (terrain[i] === T.DEEP) continue;
        if (d < 0.72) terrain[i] = T.DEEP;
        else if (d < 0.95) { if (terrain[i] !== T.DEEP) terrain[i] = T.SHALLOW; }
        else if (d < 1.12 && terrain[i] !== T.SHALLOW) terrain[i] = T.SAND;
      }
    }
  }
  if (type === 'lakeland') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = idx(x, y);
        if (terrain[i] === T.DEEP) continue;
        const sd = startDist(x, y);
        if (sd < 17) continue;
        const f = noise(x, y, lakeScale, 5, 4);
        // distance-from-center bias keeps big water between the players
        if (f < 0.37) terrain[i] = T.DEEP;
        else if (f < 0.415) terrain[i] = T.SHALLOW;
        else if (f < 0.44 && terrain[i] !== T.SHALLOW) terrain[i] = T.SAND;
      }
    }
  } else {
    const ponds = type === 'meadows' ? 2 : type === 'blackforest' ? 2 : 3;
    for (let k = 0; k < ponds; k++) {
      for (let tries = 0; tries < 30; tries++) {
        const px = rng.range(14, w - 14), py = rng.range(14, h - 14), r = rng.range(3.2, 6.5);
        if (startDist(px, py) < 24) continue;
        carveLake(px, py, r, r * rng.range(0.7, 1.2), 20 + k);
        if (symN === 2) carveLake(2 * cx - px, 2 * cy - py, r, r, 20 + k);
        break;
      }
    }
  }
  // water must stay clear of the start zones: restore land around each start
  for (const s of starts) {
    for (let y = s.y - 14; y <= s.y + 14; y++) for (let x = s.x - 14; x <= s.x + 14; x++) {
      if (!inb(x, y)) continue;
      const d = Math.hypot(x - s.x, y - s.y);
      const i = idx(x, y);
      if (d < 14 && (terrain[i] === T.DEEP || terrain[i] === T.SHALLOW || terrain[i] === T.SAND)) terrain[i] = T.GRASS;
    }
  }

  const isLand = (x, y) => inb(x, y) && terrain[idx(x, y)] !== T.DEEP && terrain[idx(x, y)] !== T.SHALLOW;
  const freeTile = (x, y) => isLand(x, y) && occ[idx(x, y)] === 0;
  function put(obj) {
    const i = idx(obj.x | 0, obj.y | 0);
    occ[i] = 1; objAt[i] = objects.length; objects.push(obj);
  }
  function putTile(k, x, y, extra) {
    if (!freeTile(x, y)) return false;
    put(Object.assign({ k, x, y }, extra));
    return true;
  }
  // reserve town center footprints (4x4 + 1 margin)
  for (const s of starts) for (let y = s.y - 3; y <= s.y + 2; y++) for (let x = s.x - 3; x <= s.x + 2; x++) if (inb(x, y)) occ[idx(x, y)] = 2;

  // ---------------------------------------------------------------- clump helper
  function clump(k, ccx, ccy, count, radius, extraFn, shape = 1) {
    const cand = [];
    const r = Math.ceil(radius + 1);
    for (let y = Math.round(ccy) - r; y <= Math.round(ccy) + r; y++) {
      for (let x = Math.round(ccx) - r; x <= Math.round(ccx) + r; x++) {
        if (!freeTile(x, y)) continue;
        const d = Math.hypot((x - ccx) / shape, (y - ccy) * shape);
        if (d <= radius + 0.4) cand.push([x, y, d + rng.next() * 0.9]);
      }
    }
    cand.sort((a, b) => a[2] - b[2]);
    let placed = 0;
    for (const [x, y] of cand) {
      if (placed >= count) break;
      if (putTile(k, x, y, extraFn ? extraFn() : null)) placed++;
    }
    return placed;
  }
  function animals(type2, ax, ay, count, spread, owner = 0) {
    let placed = 0;
    for (let t = 0; t < count * 12 && placed < count; t++) {
      const x = ax + rng.range(-spread, spread), y = ay + rng.range(-spread, spread);
      if (!isLand(Math.floor(x), Math.floor(y)) || occ[idx(Math.floor(x), Math.floor(y))]) continue;
      objects.push({ k: 'animal', type: type2, x, y, owner }); placed++;
    }
  }
  const treeV = () => ({ v: rng.int(64) });

  // ---------------------------------------------------------------- starting resources (identical templates, rotated)
  function layoutStart(s, rot) {
    const at = (dist, ang) => [s.x + Math.cos(rot + ang * D2R) * dist, s.y + Math.sin(rot + ang * D2R) * dist];
    let p;
    p = at(8.5, 0);   clump('berries', p[0], p[1], 6, 2.0);
    p = at(9.5, 80);  clump('tree', p[0], p[1], 26, 3.4, treeV, 1.25);
    p = at(11.5, 150); clump('gold', p[0], p[1], 7, 2.1);
    p = at(12.5, 215); clump('stone', p[0], p[1], 5, 1.9);
    p = at(15, 285);  animals('deer', p[0], p[1], 4, 2.2);
    p = at(17, 330);  animals('deer', p[0], p[1], 3, 2.2);
    p = at(13, 35);   animals('boar', p[0], p[1], 1, 0.8);
    p = at(15, 255);  animals('boar', p[0], p[1], 1, 0.8);
    for (let k = 0; k < 4; k++) {                           // starting sheep right by the town center
      const a = rot + (k * 90 + 45) * D2R;
      objects.push({ k: 'animal', type: 'sheep', x: s.x + Math.cos(a) * 4.4, y: s.y + Math.sin(a) * 4.4, owner: -1 });
    }
    // a few lone trees and a small secondary grove
    p = at(19, 120);  clump('tree', p[0], p[1], 14, 2.6, treeV);
    for (let k = 0; k < 8; k++) { p = at(rng.range(7, 14), rng.range(0, 360)); putTile('tree', Math.round(p[0]), Math.round(p[1]), treeV()); }
  }
  const baseRot = starts[0].angle;
  starts.forEach((s, i) => {
    // 2 players: point-symmetric layouts. Otherwise each start is rotated to face the center.
    const rot = numPlayers === 2 ? (i === 0 ? baseRot : baseRot + Math.PI) : s.angle;
    layoutStart(s, rot);
  });

  // ---------------------------------------------------------------- forests
  const forestCfg = {
    highlands:   { scale: 0.065, thr: 0.60, dens: 0.82, clear: 13 },
    blackforest: { scale: 0.075, thr: 0.40, dens: 0.93, clear: 15 },
    lakeland:    { scale: 0.07,  thr: 0.58, dens: 0.8,  clear: 13 },
    meadows:     { scale: 0.06,  thr: 0.70, dens: 0.7,  clear: 13 },
  }[type];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (!freeTile(x, y)) continue;
      const sd = startDist(x, y);
      if (sd < forestCfg.clear) continue;
      const f = noise(x, y, forestCfg.scale, 7, 4);
      let dens = forestCfg.dens;
      if (type === 'blackforest') {
        const corr = noise(x, y, 0.045, 11, 3);                // winding open glades
        if (Math.abs(corr - 0.5) < 0.055) continue;
        const clear2 = noise(x, y, 0.03, 13, 2);
        if (clear2 > 0.66) continue;
      }
      if (f < forestCfg.thr) continue;
      // soft edge: probability rises with how far into the forest we are
      const depth = Math.min(1, (f - forestCfg.thr) / 0.09);
      const p = dens * (0.35 + 0.65 * depth);
      if (canonHash(x, y, 31) < p) putTile('tree', x, y, { v: Math.floor(canonHash(x, y, 41) * 64) });
    }
  }
  // sparse scattered trees everywhere
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    if (!freeTile(x, y) || startDist(x, y) < 11) continue;
    if (canonHash(x, y, 51) < (type === 'meadows' ? 0.006 : 0.012)) putTile('tree', x, y, { v: Math.floor(canonHash(x, y, 53) * 64) });
  }

  // ---------------------------------------------------------------- neutral resources & wildlife (mirrored for 2 players)
  function sym(fn) {
    for (let tries = 0; tries < 60; tries++) {
      const x = rng.range(16, w - 16), y = rng.range(16, h - 16);
      if (startDist(x, y) < 20) continue;
      if (!isLand(Math.round(x), Math.round(y))) continue;
      if (fn(x, y)) {
        if (symN === 2) fn(2 * cx - x, 2 * cy - y);
        return true;
      }
    }
    return false;
  }
  const goldPatches = Math.max(2, numPlayers + 1), stonePatches = Math.max(2, numPlayers);
  for (let k = 0; k < goldPatches; k++) sym((x, y) => clump('gold', x, y, 6, 2) >= 3);
  for (let k = 0; k < stonePatches; k++) sym((x, y) => clump('stone', x, y, 5, 1.8) >= 3);
  for (let k = 0; k < numPlayers + 2; k++) sym((x, y) => { animals('deer', x, y, 4 + rng.int(3), 3); return true; });
  for (let k = 0; k < numPlayers; k++) sym((x, y) => { animals('boar', x, y, 2, 1.5); return true; });
  for (let k = 0; k < numPlayers; k++) sym((x, y) => clump('berries', x, y, 5, 1.8) >= 3);
  if (type !== 'meadows') for (let k = 0; k < 2; k++) sym((x, y) => { animals('wolf', x, y, 2, 2); return true; });

  // ---------------------------------------------------------------- connectivity: all starts must be mutually reachable
  function walkable(x, y) { return inb(x, y) && terrain[idx(x, y)] !== T.DEEP && !(occ[idx(x, y)] === 1 && objAt[idx(x, y)] >= 0 && objects[objAt[idx(x, y)]] && objects[objAt[idx(x, y)]].k !== 'animal'); }
  function reach(from) {
    const seen = new Uint8Array(N); const q = [idx(from.x, from.y)]; seen[q[0]] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (seen[j] || !walkable(nx, ny)) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return seen;
  }
  function carve(a, b) {
    const dist = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1);
    const heap = new MinHeap(8192); const s = idx(a.x, a.y), g = idx(b.x, b.y);
    dist[s] = 0; heap.push(s, 0);
    while (heap.n) {
      const i = heap.pop();
      if (i === g) break;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny) || Math.min(nx, ny, w - 1 - nx, h - 1 - ny) < 3) continue;
        const j = idx(nx, ny);
        let c = (dx && dy) ? 1.41 : 1;
        if (terrain[j] === T.DEEP) c += 9;
        else if (occ[j] === 1 && objAt[j] >= 0 && objects[objAt[j]] && objects[objAt[j]].k !== 'animal') c += 3.5;
        const nd = dist[i] + c;
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; heap.push(j, nd); }
      }
    }
    for (let i = g; i !== -1 && i !== s; i = prev[i]) {
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const x = (i % w) + ox, y = ((i / w) | 0) + oy;
        if (!inb(x, y) || (Math.abs(ox) + Math.abs(oy) > 1 && rng.chance(0.5))) continue;
        const j = idx(x, y);
        if (terrain[j] === T.DEEP) terrain[j] = T.SHALLOW;
        if (occ[j] === 1 && objAt[j] >= 0 && objects[objAt[j]] && objects[objAt[j]].k === 'tree') { objects[objAt[j]] = null; objAt[j] = -1; occ[j] = 0; }
      }
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    const seen = reach(starts[0]);
    let ok = true;
    for (let i = 1; i < starts.length; i++) if (!seen[idx(starts[i].x, starts[i].y)]) { carve(starts[0], starts[i]); ok = false; }
    if (ok) break;
  }
  // also make sure key starting resources are reachable (trees blocking e.g. gold in a grove): clear a ring around each start's TC
  for (const s of starts) {
    for (let y = s.y - 4; y <= s.y + 3; y++) for (let x = s.x - 4; x <= s.x + 3; x++) {
      if (!inb(x, y)) continue; const j = idx(x, y);
      if (occ[j] === 1 && objAt[j] >= 0 && objects[objAt[j]] && objects[objAt[j]].k === 'tree') { objects[objAt[j]] = null; objAt[j] = -1; occ[j] = 0; }
    }
  }

  return {
    w, h, type, seed, size, numPlayers, terrain, height,
    starts: starts.map(s => ({ x: s.x, y: s.y })),
    objects: objects.filter(Boolean),
  };
}
