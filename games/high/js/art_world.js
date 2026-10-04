'use strict';
// ---------------------------------------------------------------------------
// Procedural art: terrain texture + natural resource sprites
// ---------------------------------------------------------------------------
const TS = 32; // terrain texture pixels per tile
const SPR_SS = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1))); // sprite supersampling for high-DPI screens
function mkSpr(w, h) {
  const cv = mkCanvas(w * SPR_SS, h * SPR_SS);
  const c = cv.getContext('2d');
  c.scale(SPR_SS, SPR_SS);
  return { cv, c };
}

function makeTileNoise(size, cells, seed, oct) {
  // periodic value noise
  const r = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const c = cells * (1 << o);
    const lat = new Float32Array(c * c);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const cs = size / c;
    for (let y = 0; y < size; y++) {
      const fy = y / cs, y0 = Math.floor(fy), ty = fy - y0, uy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % c) * c, yb = ((y0 + 1) % c) * c;
      for (let x = 0; x < size; x++) {
        const fx = x / cs, x0 = Math.floor(fx), tx = fx - x0, ux = tx * tx * (3 - 2 * tx);
        const xa = x0 % c, xb = (x0 + 1) % c;
        const v0 = lat[ya + xa] + (lat[ya + xb] - lat[ya + xa]) * ux;
        const v1 = lat[yb + xa] + (lat[yb + xb] - lat[yb + xa]) * ux;
        out[y * size + x] += (v0 + (v1 - v0) * uy) * amp;
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function blurField(src, w, h, rad, passes) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0, c = 0;
        for (let k = -rad; k <= rad; k++) { const xx = clamp(x + k, 0, w - 1); s += a[y * w + xx]; c++; }
        b[y * w + x] = s / c;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0, c = 0;
        for (let k = -rad; k <= rad; k++) { const yy = clamp(y + k, 0, h - 1); s += b[yy * w + x]; c++; }
        a[y * w + x] = s / c;
      }
    }
  }
  return a;
}

// Builds the large flat terrain canvas (tile space). Async-friendly: calls progress(frac) between chunks.
async function buildTerrainTexture(map, progress) {
  const N = map.w, SZ = N * TS;
  const cv = mkCanvas(SZ, SZ);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(SZ, SZ);
  const d = img.data;
  const water = new Float32Array(N * N);
  for (let i = 0; i < water.length; i++) water[i] = map.terrain[i] === 1 ? 1 : 0;
  // pad influence beyond map edges: treat outside as land
  const H = blurField(water, N, N, 2, 2);
  const forest = blurField(map.forestF, N, N, 1, 1);
  const dirt = blurField(map.dirtF, N, N, 1, 1);
  const A = makeTileNoise(1024, 10, 11, 4);
  const B = makeTileNoise(512, 48, 22, 3);
  const C = makeTileNoise(256, 128, 33, 1);
  const rg = mulberry32(99);
  const W256 = new Uint8Array(256 * 256);
  for (let i = 0; i < W256.length; i++) W256[i] = rg() * 255;

  const grassA = [118, 156, 66], grassB = [92, 134, 52], grassC = [140, 170, 74], dry = [160, 170, 80];
  const dirtA = [140, 108, 68], dirtB = [118, 90, 56];
  const sandA = [214, 196, 142], sandB = [196, 176, 124];
  const shallow = [96, 176, 196], deepc = [38, 98, 140];
  const forestC = [66, 96, 44];

  const sample = (f, fx, fy) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const xa = clamp(x0, 0, N - 1), xb = clamp(x0 + 1, 0, N - 1), ya = clamp(y0, 0, N - 1), yb = clamp(y0 + 1, 0, N - 1);
    const a = f[ya * N + xa], b = f[ya * N + xb], c = f[yb * N + xa], e = f[yb * N + xb];
    return (a + (b - a) * tx) * (1 - ty) + (c + (e - c) * tx) * ty;
  };

  const rowsPerChunk = 128;
  for (let y0 = 0; y0 < SZ; y0 += rowsPerChunk) {
    const y1 = Math.min(SZ, y0 + rowsPerChunk);
    for (let py = y0; py < y1; py++) {
      const fy = py / TS - 0.5;
      for (let px = 0; px < SZ; px++) {
        const fx = px / TS - 0.5;
        const na = A[(py & 1023) * 1024 + (px & 1023)];
        const nb = B[(py & 511) * 512 + (px & 511)];
        const nc = C[(py & 255) * 256 + ((px + 77) & 255)];
        const nw = W256[(py & 255) * 256 + (px & 255)] / 255;
        const hv = sample(H, fx, fy) + (nb - 0.5) * 0.28 + (na - 0.5) * 0.12;
        let r, g, b;
        if (hv > 0.5) {
          // water
          const depth = clamp((hv - 0.5) * 2.2, 0, 1);
          const ripple = Math.max(0, Math.sin((px * 0.07 + py * 0.045) + nb * 14)) * 0.5;
          const t = clamp(depth + (nc - 0.5) * 0.2, 0, 1);
          r = lerp(shallow[0], deepc[0], t); g = lerp(shallow[1], deepc[1], t); b = lerp(shallow[2], deepc[2], t);
          const hl = (ripple * ripple) * 22 * (1 - t * 0.6);
          r += hl; g += hl; b += hl;
          // shore foam
          const foam = smooth(0.5, 0.56, hv) * (1 - smooth(0.56, 0.64, hv));
          r = lerp(r, 235, foam * 0.55); g = lerp(g, 245, foam * 0.55); b = lerp(b, 250, foam * 0.55);
        } else if (hv > 0.27) {
          // sand beach (wet near the water)
          const t = (hv - 0.27) / 0.23;
          r = lerp(sandA[0], sandB[0], nb); g = lerp(sandA[1], sandB[1], nb); b = lerp(sandA[2], sandB[2], nb);
          const wet = smooth(0.4, 0.5, hv);
          r = lerp(r, r * 0.82, wet); g = lerp(g, g * 0.84, wet); b = lerp(b, b * 0.86, wet);
          const gr = smooth(0.27, 0.34, hv);
          // blend to grass at inner edge
          const m = 1 - gr;
          const gx = lerp(grassA[0], grassC[0], na), gy = lerp(grassA[1], grassC[1], na), gz = lerp(grassA[2], grassC[2], na);
          r = lerp(gx, r, m); g = lerp(gy, g, m); b = lerp(gz, b, m);
          r += (nw - 0.5) * 8; g += (nw - 0.5) * 8; b += (nw - 0.5) * 6;
        } else {
          // grass with large-scale variation
          let t1 = smooth(0.35, 0.65, na);
          r = lerp(grassB[0], grassC[0], t1); g = lerp(grassB[1], grassC[1], t1); b = lerp(grassB[2], grassC[2], t1);
          const dr = smooth(0.62, 0.78, nb * 0.6 + na * 0.5);
          r = lerp(r, dry[0], dr * 0.45); g = lerp(g, dry[1], dr * 0.45); b = lerp(b, dry[2], dr * 0.45);
          const m1 = (nb - 0.5) * 18, m2 = (nc - 0.5) * 12;
          r += m1 + m2; g += m1 + m2; b += (m1 + m2) * 0.6;
          // forest floor
          const fv = sample(forest, fx, fy) + (nb - 0.5) * 0.25;
          const ff = smooth(0.18, 0.5, fv);
          r = lerp(r, forestC[0] + m2, ff * 0.8); g = lerp(g, forestC[1] + m2, ff * 0.8); b = lerp(b, forestC[2] + m2 * 0.5, ff * 0.8);
          // dirt patches
          const dv = sample(dirt, fx, fy) + (nb - 0.5) * 0.5 + (nc - 0.5) * 0.15;
          const df = smooth(0.35, 0.52, dv);
          const dc = [lerp(dirtA[0], dirtB[0], nb), lerp(dirtA[1], dirtB[1], nb), lerp(dirtA[2], dirtB[2], nb)];
          r = lerp(r, dc[0] + m2, df); g = lerp(g, dc[1] + m2, df); b = lerp(b, dc[2] + m2 * 0.5, df);
          // pixel grain
          const gn = (nw - 0.5) * 9;
          r += gn; g += gn; b += gn * 0.7;
        }
        const o = (py * SZ + px) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    if (progress) { progress(y1 / SZ); await new Promise((res) => setTimeout(res, 0)); }
  }
  ctx.putImageData(img, 0, 0);

  // doodads: grass tufts, flowers, pebbles
  const rd = mulberry32(555);
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const i = ty * N + tx;
      if (map.terrain[i] !== 0 || H[i] > 0.22 || dirt[i] > 0.45) continue;
      const cnt = forest[i] > 0.3 ? 1 : 3;
      for (let k = 0; k < cnt; k++) {
        if (rd() > 0.7) continue;
        const x = (tx + rd()) * TS, y = (ty + rd()) * TS;
        const kind = rd();
        if (kind < 0.62) {
          ctx.strokeStyle = rd() < 0.5 ? 'rgba(60,100,35,0.7)' : 'rgba(150,185,80,0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let s = 0; s < 3; s++) { ctx.moveTo(x + s * 1.4, y); ctx.lineTo(x + s * 1.4 + (s - 1) * 1.6, y - 3 - rd() * 2.5); }
          ctx.stroke();
        } else if (kind < 0.86) {
          const cols = ['#fff6d0', '#f4d44a', '#e98ad0', '#b9a0f0', '#ffffff'];
          ctx.fillStyle = cols[Math.floor(rd() * cols.length)];
          ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(120,120,110,0.55)';
          ctx.beginPath(); ctx.ellipse(x, y, 1.8, 1.1, 0, 0, TAU); ctx.fill();
        }
      }
    }
  }
  return cv;
}

// Minimap base colours (1px per tile)
function buildMinimapBase(map) {
  const N = map.w;
  const cv = mkCanvas(N, N);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    let c;
    if (map.terrain[i] === 1) c = [58, 120, 160];
    else if (map.dirtF[i] > 0.5) c = [130, 100, 62];
    else if (map.forestF[i] > 0.3) c = [52, 86, 38];
    else c = [104, 142, 60];
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---------------------------------------------------------------------------
// Natural resource sprites
// ---------------------------------------------------------------------------
const WorldSprites = { trees: [], gold: [], stone: [], berries: [], cache: {} };

function drawShadowEllipse(ctx, x, y, rx, ry, a = 0.28) {
  ctx.fillStyle = `rgba(10,20,5,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
}

function makeTreeSprite(kind, seed) {
  const r = mulberry32(seed);
  const W = 64, H = 92;
  const { cv, c } = mkSpr(W, H);
  const bx = W / 2, by = H - 8;
  drawShadowEllipse(c, bx + 4, by, 17, 7, 0.3);
  if (kind === 'pine') {
    const layers = 4 + Math.floor(r() * 2);
    const th = 12 + r() * 4;
    c.fillStyle = '#4a3320'; c.fillRect(bx - 2.5, by - th, 5, th);
    c.fillStyle = '#5c402a'; c.fillRect(bx - 0.5, by - th, 2, th);
    const dark = ['#1f4a2a', '#265a30', '#2f6a37'], light = ['#2f6a37', '#3b7c42', '#4a9150'];
    const top = by - 74 - r() * 6;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const y0 = lerp(top + 14, by - th + 6, t);
      const hw = lerp(10, 25, t) + r() * 2;
      const hh = lerp(22, 28, t);
      const g = c.createLinearGradient(bx - hw, 0, bx + hw, 0);
      g.addColorStop(0, light[Math.min(2, Math.floor(t * 2.5))]); g.addColorStop(0.55, dark[Math.min(2, Math.floor(t * 2.5))]); g.addColorStop(1, '#173a22');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(bx, y0 - hh); c.quadraticCurveTo(bx + hw * 0.5, y0 - hh * 0.4, bx + hw, y0);
      c.quadraticCurveTo(bx, y0 + 4, bx - hw, y0); c.quadraticCurveTo(bx - hw * 0.5, y0 - hh * 0.4, bx, y0 - hh); c.fill();
      c.strokeStyle = 'rgba(120,200,110,0.25)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(bx - hw * 0.7, y0 - 1); c.quadraticCurveTo(bx - hw * 0.3, y0 - hh * 0.5, bx - 1, y0 - hh + 3); c.stroke();
    }
  } else if (kind === 'oak') {
    const th = 20 + r() * 6;
    c.fillStyle = '#4e3822'; c.beginPath(); c.moveTo(bx - 4, by); c.lineTo(bx - 2.5, by - th); c.lineTo(bx + 2.5, by - th); c.lineTo(bx + 4, by); c.fill();
    c.fillStyle = '#6a4a2d'; c.fillRect(bx + 0.5, by - th, 2, th);
    const blobs = [];
    const n = 9 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = r() * 17;
      blobs.push([bx + Math.cos(a) * d * 1.1, by - th - 18 + Math.sin(a) * d * 0.8, 9 + r() * 7]);
    }
    blobs.sort((a, b) => a[1] - b[1]);
    const hue = r();
    const pal = hue < 0.5 ? ['#2f6a2c', '#3f7f35', '#58a043'] : ['#3a6b2a', '#4c8236', '#6aa047'];
    for (const [x, y, rad] of blobs) {
      const g = c.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
      g.addColorStop(0, pal[2]); g.addColorStop(0.6, pal[1]); g.addColorStop(1, pal[0]);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
    c.fillStyle = 'rgba(0,30,0,0.18)';
    c.beginPath(); c.ellipse(bx + 3, by - th - 8, 15, 6, 0, 0, Math.PI); c.fill();
  } else { // birch / autumn
    const th = 26 + r() * 6;
    c.fillStyle = '#e4e0d4'; c.fillRect(bx - 2, by - th - 8, 4, th + 8);
    c.fillStyle = '#333'; for (let i = 0; i < 5; i++) c.fillRect(bx - 2, by - 6 - i * 7, 2 + (i % 2), 1.2);
    const pal = r() < 0.5 ? ['#7aa332', '#9cc345', '#c0dc62'] : ['#c58a2a', '#dba63a', '#efc656'];
    const blobs = [];
    for (let i = 0; i < 9; i++) { const a = r() * TAU, d = r() * 12; blobs.push([bx + Math.cos(a) * d, by - th - 12 + Math.sin(a) * d * 1.3, 7 + r() * 5]); }
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, rad] of blobs) {
      const g = c.createRadialGradient(x - 2, y - 3, 1, x, y, rad);
      g.addColorStop(0, pal[2]); g.addColorStop(0.6, pal[1]); g.addColorStop(1, pal[0]);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
  }
  return { cv, ax: bx, ay: by, w: W, h: H };
}

function makeRockSprite(kind, variant) {
  const r = mulberry32(kind === 'gold' ? 71 + variant : 17 + variant);
  const W = 64, H = 56;
  const { cv, c } = mkSpr(W, H);
  const bx = W / 2, by = H - 12;
  drawShadowEllipse(c, bx + 3, by + 2, 22, 9, 0.3);
  const base = kind === 'gold' ? ['#8c8678', '#a8a293', '#6a6558'] : ['#8d8d92', '#b5b5b8', '#5f5f66'];
  const n = 5;
  const rocks = [];
  for (let i = 0; i < n; i++) rocks.push([bx + (r() - 0.5) * 30, by - r() * 8 - (i > 2 ? 8 : 0), 9 + r() * 9]);
  rocks.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rad] of rocks) {
    const g = c.createLinearGradient(x - rad, y - rad, x + rad, y + rad);
    g.addColorStop(0, base[1]); g.addColorStop(0.5, base[0]); g.addColorStop(1, base[2]);
    c.fillStyle = g;
    c.beginPath();
    const pts = 7;
    for (let i = 0; i < pts; i++) {
      const a = i / pts * TAU, rr2 = rad * (0.8 + r() * 0.3);
      const px = x + Math.cos(a) * rr2, py = y - rad * 0.4 + Math.sin(a) * rr2 * 0.8;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.stroke();
  }
  if (kind === 'gold') {
    for (let i = 0; i < 9; i++) {
      const x = bx + (r() - 0.5) * 34, y = by - 4 - r() * 20, s = 2.5 + r() * 3.5;
      const g = c.createLinearGradient(x - s, y - s, x + s, y + s);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#f1c232'); g.addColorStop(1, '#b8860b');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x - s, y); c.lineTo(x - s * 0.3, y - s); c.lineTo(x + s, y - s * 0.4); c.lineTo(x + s * 0.6, y + s * 0.6); c.lineTo(x - s * 0.5, y + s * 0.7); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(80,50,0,0.5)'; c.lineWidth = 0.8; c.stroke();
    }
    c.fillStyle = 'rgba(255,255,220,0.9)';
    for (let i = 0; i < 3; i++) { const x = bx + (r() - 0.5) * 30, y = by - 6 - r() * 18; c.fillRect(x, y, 1.5, 1.5); }
  } else {
    c.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 4; i++) { const x = bx + (r() - 0.5) * 30, y = by - 6 - r() * 16; c.fillRect(x, y, 3, 1.4); }
  }
  return { cv, ax: bx, ay: by, w: W, h: H };
}

function makeBerrySprite(level) {
  const r = mulberry32(5 + level);
  const W = 48, H = 40;
  const { cv, c } = mkSpr(W, H);
  const bx = W / 2, by = H - 8;
  drawShadowEllipse(c, bx + 2, by + 1, 14, 6, 0.28);
  const leaves = ['#2e6a2a', '#3d8035', '#54a043'];
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, d = r() * 11;
    const x = bx + Math.cos(a) * d * 1.2, y = by - 8 + Math.sin(a) * d * 0.7 - r() * 4, rad = 6 + r() * 4;
    const g = c.createRadialGradient(x - 2, y - 2, 1, x, y, rad);
    g.addColorStop(0, leaves[2]); g.addColorStop(0.6, leaves[1]); g.addColorStop(1, leaves[0]);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
  }
  const nb = 4 + level * 4;
  for (let i = 0; i < nb; i++) {
    const a = r() * TAU, d = r() * 11;
    const x = bx + Math.cos(a) * d * 1.2, y = by - 9 + Math.sin(a) * d * 0.7 - r() * 4;
    c.fillStyle = '#c4242c'; c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x - 1, y - 1, 1, 1);
  }
  return { cv, ax: bx, ay: by, w: W, h: H };
}

function drawAnimalFigure(c, type, dead, t, flip, moving) {
  // side-view animal drawn facing right with feet at (0,0)
  c.save();
  if (flip) c.scale(-1, 1);
  const legSw = moving ? Math.sin(t * 9) * 3 : 0;
  if (type === 'deer') {
    const body = '#a06a38', belly = '#d8b78a', dark = '#6a4020';
    if (dead) {
      c.rotate(0.0);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 0, 14, 4, 0, 0, TAU); c.fill();
      c.fillStyle = body; c.beginPath(); c.ellipse(0, -4, 12, 5, 0, 0, TAU); c.fill();
      c.fillStyle = belly; c.beginPath(); c.ellipse(0, -2, 10, 2.5, 0, 0, TAU); c.fill();
      c.fillStyle = body; c.beginPath(); c.ellipse(12, -3, 4, 2.8, 0.3, 0, TAU); c.fill();
      c.strokeStyle = dark; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-6, -1); c.lineTo(-12, 3); c.moveTo(5, -1); c.lineTo(10, 4); c.stroke();
    } else {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 1, 12, 3.5, 0, 0, TAU); c.fill();
      c.strokeStyle = dark; c.lineWidth = 1.8; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-7, -10); c.lineTo(-7 + legSw, 0); c.moveTo(-5, -10); c.lineTo(-5 - legSw, 0);
      c.moveTo(7, -10); c.lineTo(7 - legSw, 0); c.moveTo(5, -10); c.lineTo(5 + legSw, 0);
      c.stroke();
      c.fillStyle = body; c.beginPath(); c.ellipse(0, -12, 11, 5.2, 0, 0, TAU); c.fill();
      c.fillStyle = belly; c.beginPath(); c.ellipse(0, -9.8, 9, 2.2, 0, 0, TAU); c.fill();
      c.strokeStyle = body; c.lineWidth = 3.4; c.beginPath(); c.moveTo(8, -14); c.lineTo(12, -22); c.stroke();
      c.fillStyle = body; c.beginPath(); c.ellipse(13.5, -23, 3.6, 2.4, -0.3, 0, TAU); c.fill();
      c.fillStyle = '#222'; c.fillRect(14.5, -24, 1, 1);
      c.strokeStyle = '#d9c9a0'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(12, -25); c.lineTo(11, -30); c.lineTo(13, -33); c.moveTo(11, -29); c.lineTo(8, -31); c.moveTo(13, -25); c.lineTo(15, -30); c.stroke();
      c.fillStyle = '#f0e0c0'; c.beginPath(); c.ellipse(-11, -14, 2, 1.6, 0, 0, TAU); c.fill();
    }
  } else { // boar
    const body = '#4e3a2a', dark = '#2a1d14';
    if (dead) {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 0, 13, 4, 0, 0, TAU); c.fill();
      c.fillStyle = body; c.beginPath(); c.ellipse(0, -5, 12, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#6a5240'; c.beginPath(); c.ellipse(10, -4, 5, 3.5, 0.2, 0, TAU); c.fill();
    } else {
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 1, 13, 3.5, 0, 0, TAU); c.fill();
      c.strokeStyle = dark; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-7, -7); c.lineTo(-7 + legSw, 0); c.moveTo(-4, -7); c.lineTo(-4 - legSw, 0); c.moveTo(6, -7); c.lineTo(6 - legSw, 0); c.moveTo(9, -7); c.lineTo(9 + legSw, 0); c.stroke();
      c.fillStyle = body; c.beginPath(); c.ellipse(0, -10, 12, 7, 0, 0, TAU); c.fill();
      c.fillStyle = '#6a5240'; c.beginPath(); c.ellipse(12, -9, 5.5, 4.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#e8e0c8'; c.beginPath(); c.moveTo(14, -7); c.lineTo(18, -9); c.lineTo(15, -5); c.fill();
      c.fillStyle = '#d00'; c.fillRect(13, -11, 1.4, 1.4);
      c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, -17); c.lineTo(4, -15); c.stroke();
      c.strokeStyle = body; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-12, -11); c.quadraticCurveTo(-16, -14, -14, -17); c.stroke();
    }
  }
  c.restore();
}

function initWorldSprites() {
  const S = WorldSprites;
  S.trees = [];
  const kinds = ['pine', 'pine', 'pine', 'oak', 'oak', 'birch'];
  for (let i = 0; i < 12; i++) S.trees.push(makeTreeSprite(kinds[i % kinds.length], 100 + i * 17));
  S.gold = [makeRockSprite('gold', 0), makeRockSprite('gold', 1), makeRockSprite('gold', 2)];
  S.stone = [makeRockSprite('stone', 0), makeRockSprite('stone', 1), makeRockSprite('stone', 2)];
  S.berries = [makeBerrySprite(0), makeBerrySprite(1), makeBerrySprite(2)];
  // stump
  const { cv: st, c } = mkSpr(24, 16);
  c.fillStyle = '#5a3f26'; c.beginPath(); c.ellipse(12, 10, 7, 3.5, 0, 0, TAU); c.fill();
  c.fillStyle = '#c9a26a'; c.beginPath(); c.ellipse(12, 8, 6, 3, 0, 0, TAU); c.fill();
  S.stump = { cv: st, ax: 12, ay: 10, w: 24, h: 16 };
}
