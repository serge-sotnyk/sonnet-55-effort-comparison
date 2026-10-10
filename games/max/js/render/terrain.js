// Terrain rendering: chunked top-down textures (smooth biome blending, hillshading, forest litter, shorelines)
// drawn through the isometric affine transform. Chunks are generated lazily and time-sliced.
import { T } from '../data/constants.js';
import { hash2, valueNoise, fbm } from '../sim/util.js';

export const CH = 16;               // tiles per chunk side
const PX = 22;                      // texture pixels per tile
const SIZE = (CH + 1) * PX;         // chunk texture side (cells are offset by half a tile -> CH+1 cells)

// ---------------------------------------------------------------- color ramps
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function makeRamp(stops) {
  const n = 256, r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n);
  const cols = stops.map(hex);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * (cols.length - 1), k = Math.min(cols.length - 2, Math.floor(t)), f = t - k;
    r[i] = cols[k][0] + (cols[k + 1][0] - cols[k][0]) * f;
    g[i] = cols[k][1] + (cols[k + 1][1] - cols[k][1]) * f;
    b[i] = cols[k][2] + (cols[k + 1][2] - cols[k][2]) * f;
  }
  return { r, g, b };
}
const RAMPS = [
  makeRamp(['#2f6527', '#467f31', '#62993b', '#86b14a', '#a7b65a']),     // grass
  makeRamp(['#6f5334', '#8f6e48', '#ad8a5e', '#c3a374']),                 // dirt
  makeRamp(['#bda56d', '#d3bf88', '#e6d6a6', '#f0e4bd']),                 // sand
  makeRamp(['#2f8aa3', '#4fb0c0', '#79d0d6', '#a6e8e6']),                 // shallow water
  makeRamp(['#103f66', '#175a86', '#1f719f', '#2a86b3']),                 // deep water
];
export const OCEAN_COLOR = '#14486f';
const FOREST_R = 38, FOREST_G = 58, FOREST_B = 26;

// ---------------------------------------------------------------- noise tables (tileable)
const NS = 64;
function makeNoise(seed) {
  const t = new Float32Array(NS * NS);
  for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) t[y * NS + x] = hash2(x, y, seed);
  return t;
}
const N1 = makeNoise(11), N2 = makeNoise(23), N3 = makeNoise(37);
function samp(tex, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = xi & (NS - 1), y0 = yi & (NS - 1), x1 = (x0 + 1) & (NS - 1), y1 = (y0 + 1) & (NS - 1);
  const a = tex[y0 * NS + x0], b = tex[y0 * NS + x1], c = tex[y1 * NS + x0], d = tex[y1 * NS + x1];
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export class TerrainRenderer {
  /** map: from generateMap; objects used for forest litter. */
  constructor(map) {
    this.map = map; this.w = map.w; this.h = map.h;
    this.cw = Math.ceil(map.w / CH); this.ch = Math.ceil(map.h / CH);
    this.chunks = new Array(this.cw * this.ch).fill(null);
    this.meta = new Array(this.cw * this.ch).fill(null);       // decor + sparkles per chunk
    this.queue = [];
    this._prep();
    this.pending = this.cw * this.ch;
  }

  _prep() {
    const { w, h, map } = this, n = w * h;
    const terr = map.terrain, ht = map.height;
    this.tone = new Float32Array(n);
    this.shade = new Float32Array(n);
    this.forest = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      this.tone[i] = fbm(x * 0.07, y * 0.07, map.seed + 301, 3) - 0.5;
      // hillshade from the height field: slopes facing the NW light are brighter
      const hAt = (xx, yy) => ht[Math.max(0, Math.min(h - 1, yy)) * w + Math.max(0, Math.min(w - 1, xx))];
      const g = (hAt(x - 1, y - 1) + hAt(x - 1, y) * 0.5 + hAt(x, y - 1) * 0.5) - (hAt(x + 1, y + 1) + hAt(x + 1, y) * 0.5 + hAt(x, y + 1) * 0.5);
      this.shade[i] = Math.max(-0.25, Math.min(0.25, g * 0.0042)) + (ht[i] - 128) * 0.0006;
    }
    // forest litter: darkness around every initial tree
    for (const o of map.objects) {
      if (o.k !== 'tree') continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = o.x + dx, y = o.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const d = Math.hypot(dx, dy);
        if (d > 2.3) continue;
        const i = y * w + x;
        this.forest[i] = Math.min(1, this.forest[i] + (1 - d / 2.5) * 0.42);
      }
    }
    // tile "mini colors" for the minimap
    this.mini = new Uint8Array(n * 3);
    const mid = [128, 128, 128, 128, 128];
    for (let i = 0; i < n; i++) {
      const t = terr[i], r = RAMPS[t] || RAMPS[0];
      const k = t === T.GRASS ? 110 : 150;
      let rr = r.r[k], gg = r.g[k], bb = r.b[k];
      const f = this.forest[i] * 0.6;
      rr = rr * (1 - f) + FOREST_R * f; gg = gg * (1 - f) + FOREST_G * f; bb = bb * (1 - f) + FOREST_B * f;
      this.mini[i * 3] = rr; this.mini[i * 3 + 1] = gg; this.mini[i * 3 + 2] = bb;
    }
  }

  // ------------------------------------------------------------ chunk generation
  buildChunk(cx, cy) {
    const { w, h, map } = this;
    const terr = map.terrain;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });   // CPU-backed: never loses its contents
    const img = ctx.createImageData(SIZE, SIZE);
    const d32 = new Uint32Array(img.data.buffer);
    const tw = new Float32Array(5);
    const typeAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? T.DEEP : terr[y * w + x];
    const idxOf = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? -1 : y * w + x;
    const tone = this.tone, shade = this.shade, forest = this.forest;
    for (let cj = 0; cj <= CH; cj++) {
      for (let ci = 0; ci <= CH; ci++) {
        const i0 = cx * CH - 1 + ci, j0 = cy * CH - 1 + cj;
        const k00 = idxOf(i0, j0), k10 = idxOf(i0 + 1, j0), k01 = idxOf(i0, j0 + 1), k11 = idxOf(i0 + 1, j0 + 1);
        const t00 = typeAt(i0, j0), t10 = typeAt(i0 + 1, j0), t01 = typeAt(i0, j0 + 1), t11 = typeAt(i0 + 1, j0 + 1);
        const tn00 = k00 < 0 ? 0 : tone[k00], tn10 = k10 < 0 ? 0 : tone[k10], tn01 = k01 < 0 ? 0 : tone[k01], tn11 = k11 < 0 ? 0 : tone[k11];
        const sh00 = k00 < 0 ? 0 : shade[k00], sh10 = k10 < 0 ? 0 : shade[k10], sh01 = k01 < 0 ? 0 : shade[k01], sh11 = k11 < 0 ? 0 : shade[k11];
        const fo00 = k00 < 0 ? 0 : forest[k00], fo10 = k10 < 0 ? 0 : forest[k10], fo01 = k01 < 0 ? 0 : forest[k01], fo11 = k11 < 0 ? 0 : forest[k11];
        const px0 = ci * PX, py0 = cj * PX;
        for (let lv = 0; lv < PX; lv++) {
          const b = (lv + 0.5) / PX, nb = 1 - b;
          const wy = j0 + 0.5 + b;
          for (let lu = 0; lu < PX; lu++) {
            const a = (lu + 0.5) / PX, na = 1 - a;
            const wx = i0 + 0.5 + a;
            const w00 = na * nb, w10 = a * nb, w01 = na * b, w11 = a * b;
            tw[0] = tw[1] = tw[2] = tw[3] = tw[4] = 0;
            tw[t00] += w00; tw[t10] += w10; tw[t01] += w01; tw[t11] += w11;
            const tn = tn00 * w00 + tn10 * w10 + tn01 * w01 + tn11 * w11;
            const sh = sh00 * w00 + sh10 * w10 + sh01 * w01 + sh11 * w11;
            const fo = fo00 * w00 + fo10 * w10 + fo01 * w01 + fo11 * w11;
            const n1 = samp(N1, wx * 0.23, wy * 0.23), n2 = samp(N2, wx * 1.3, wy * 1.3), n3 = samp(N3, wx * 4.1, wy * 4.1);
            let r = 0, g = 0, bl = 0;
            // grass
            if (tw[0] > 0.002) {
              let t = n1 * 0.62 + n2 * 0.22 + n3 * 0.1 + tn * 0.7 + 0.1;
              t = t < 0 ? 0 : t > 1 ? 1 : t;
              const k = (t * 255) | 0, R = RAMPS[0];
              r += R.r[k] * tw[0]; g += R.g[k] * tw[0]; bl += R.b[k] * tw[0];
            }
            if (tw[1] > 0.002) {
              let t = n1 * 0.55 + n2 * 0.3 + n3 * 0.2;
              t = t < 0 ? 0 : t > 1 ? 1 : t;
              const k = (t * 255) | 0, R = RAMPS[1];
              r += R.r[k] * tw[1]; g += R.g[k] * tw[1]; bl += R.b[k] * tw[1];
            }
            if (tw[2] > 0.002) {
              let t = n1 * 0.4 + n2 * 0.35 + n3 * 0.25;
              t = t < 0 ? 0 : t > 1 ? 1 : t;
              const k = (t * 255) | 0, R = RAMPS[2];
              r += R.r[k] * tw[2]; g += R.g[k] * tw[2]; bl += R.b[k] * tw[2];
            }
            if (tw[3] > 0.002) {
              // shallow water: lighter toward the shore, gentle ripple banding
              let t = 0.35 + n2 * 0.4 + Math.sin((wx + wy) * 2.2 + n1 * 6) * 0.1 + tw[2] * 0.25;
              t = t < 0 ? 0 : t > 1 ? 1 : t;
              const k = (t * 255) | 0, R = RAMPS[3];
              r += R.r[k] * tw[3]; g += R.g[k] * tw[3]; bl += R.b[k] * tw[3];
            }
            if (tw[4] > 0.002) {
              let t = 0.3 + n1 * 0.45 + n2 * 0.18 - tw[3] * 0.2;
              t = t < 0 ? 0 : t > 1 ? 1 : t;
              const k = (t * 255) | 0, R = RAMPS[4];
              r += R.r[k] * tw[4]; g += R.g[k] * tw[4]; bl += R.b[k] * tw[4];
            }
            // forest litter on land
            const land = tw[0] + tw[1] + tw[2];
            if (fo > 0.01 && land > 0.5) {
              const f = Math.min(0.72, fo * (0.55 + 0.45 * n2)) * land;
              r = r * (1 - f) + FOREST_R * f; g = g * (1 - f) + FOREST_G * f; bl = bl * (1 - f) + FOREST_B * f;
            }
            // shoreline foam (where sand meets shallow water)
            const foam = (tw[3] > 0.05 && tw[2] > 0.05) ? Math.max(0, 1 - Math.abs(tw[3] - 0.52) * 7) * (0.35 + 0.35 * n3) : 0;
            // lighting
            const lum = 1 + sh * (tw[3] + tw[4] > 0.5 ? 0.25 : 0.95) + (n3 - 0.5) * 0.07;
            r = r * lum + foam * 90; g = g * lum + foam * 90; bl = bl * lum + foam * 80;
            const o = (py0 + lv) * SIZE + px0 + lu;
            d32[o] = 0xff000000 | ((bl > 255 ? 255 : bl < 0 ? 0 : bl | 0) << 16) | ((g > 255 ? 255 : g < 0 ? 0 : g | 0) << 8) | (r > 255 ? 255 : r < 0 ? 0 : r | 0);
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    this.chunks[cy * this.cw + cx] = canvas;
    this.pending--;
    // decor & water sparkles for this chunk
    const decor = [], sparkle = [];
    const x0 = cx * CH, y0 = cy * CH;
    for (let ty = y0; ty < Math.min(h, y0 + CH); ty++) {
      for (let tx = x0; tx < Math.min(w, x0 + CH); tx++) {
        const t = terr[ty * w + tx];
        const hv = hash2(tx, ty, 77), hv2 = hash2(tx, ty, 78), hv3 = hash2(tx, ty, 79);
        if (t === T.SHALLOW || t === T.DEEP) {
          if (hv < 0.42) sparkle.push({ x: tx + 0.15 + hv2 * 0.7, y: ty + 0.15 + hv3 * 0.7, p: hv * 40, deep: t === T.DEEP });
          if (t === T.SHALLOW && hv > 0.93) decor.push({ x: tx + hv2, y: ty + hv3, k: 'reeds', v: Math.floor(hv2 * 8) });
          continue;
        }
        if (this.forest[ty * w + tx] > 0.55 && hv < 0.3) { decor.push({ x: tx + hv2, y: ty + hv3, k: hv3 < 0.5 ? 'fern' : 'mushrooms', v: Math.floor(hv2 * 8) }); continue; }
        const dens = t === T.GRASS ? 0.26 : t === T.DIRT ? 0.16 : 0.1;
        if (hv > dens) continue;
        const r = hv3;
        let k;
        if (t === T.GRASS) k = r < 0.52 ? 'tuft' : r < 0.64 ? 'flowers' : r < 0.72 ? 'rocks' : r < 0.82 ? 'fern' : r < 0.86 ? 'mushrooms' : r < 0.94 ? 'shrub' : 'pebbles';
        else if (t === T.DIRT) k = r < 0.5 ? 'pebbles' : r < 0.8 ? 'rocks' : 'tuft';
        else k = r < 0.75 ? 'pebbles' : 'rocks';
        decor.push({ x: tx + hv2, y: ty + hash2(tx, ty, 80), k, v: Math.floor(hv2 * 16) });
      }
    }
    decor.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    this.meta[cy * this.cw + cx] = { decor, sparkle };
    return canvas;
  }

  chunkIndex(cx, cy) { return cy * this.cw + cx; }

  /** Generate missing chunks near the camera first; stop after budgetMs. Returns number of chunks still missing. */
  ensure(cam, budgetMs, all = false) {
    if (this.pending <= 0) return 0;
    const t0 = performance.now();
    const c = cam.center();
    const ccx = Math.max(0, Math.min(this.cw - 1, Math.floor(c.x / CH))), ccy = Math.max(0, Math.min(this.ch - 1, Math.floor(c.y / CH)));
    const order = [];
    for (let cy = 0; cy < this.ch; cy++) for (let cx = 0; cx < this.cw; cx++) if (!this.chunks[cy * this.cw + cx]) order.push([Math.hypot(cx - ccx, cy - ccy), cx, cy]);
    order.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cy] of order) {
      this.buildChunk(cx, cy);
      if (!all && performance.now() - t0 > budgetMs) break;
    }
    return this.pending;
  }

  /** Draw the ground (chunk textures). ctx must have an identity transform; dpr = backing/CSS ratio. */
  drawGround(ctx, cam, dpr, bounds) {
    const z = cam.zoom * dpr;
    const x0c = Math.max(0, Math.floor(bounds.x0 / CH)), x1c = Math.min(this.cw - 1, Math.floor(bounds.x1 / CH));
    const y0c = Math.max(0, Math.floor(bounds.y0 / CH)), y1c = Math.min(this.ch - 1, Math.floor(bounds.y1 / CH));
    const a = 32 * z / PX, b = 16 * z / PX;
    ctx.imageSmoothingEnabled = true;
    for (let cy = y0c; cy <= y1c; cy++) {
      for (let cx = x0c; cx <= x1c; cx++) {
        const cv = this.chunks[cy * this.cw + cx];
        if (!cv) continue;
        // texture px (0,0) <-> world (cx*CH - 0.5, cy*CH - 0.5)
        const wx0 = cx * CH - 0.5, wy0 = cy * CH - 0.5;
        const e = (((wx0 - wy0) * 32 - cam.x) * cam.zoom + cam.vw / 2) * dpr;
        const f = (((wx0 + wy0) * 16 - cam.y) * cam.zoom + cam.vh / 2) * dpr;
        ctx.setTransform(a, b, -a, b, e, f);
        ctx.drawImage(cv, 0, 0);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Iterate the metadata (decor / sparkles) of visible chunks. */
  visibleMeta(bounds, out) {
    out.length = 0;
    const x0c = Math.max(0, Math.floor(bounds.x0 / CH)), x1c = Math.min(this.cw - 1, Math.floor(bounds.x1 / CH));
    const y0c = Math.max(0, Math.floor(bounds.y0 / CH)), y1c = Math.min(this.ch - 1, Math.floor(bounds.y1 / CH));
    for (let cy = y0c; cy <= y1c; cy++) for (let cx = x0c; cx <= x1c; cx++) { const m = this.meta[cy * this.cw + cx]; if (m) out.push(m); }
    return out;
  }
}
