// Heightfield terrain renderer for the title-screen mountains ("column raymarch" with front-to-back compositing and
// analytic edge coverage, so ridge lines are anti-aliased). Produces a transparent canvas: sky shows through where there is no terrain.
// All numbers are in "world meters"; the camera looks along +Z. Screen mapping:  x = W/2 + (X - camX) / Z * focal,  y = horizon + (camH - h) / Z * focal.

// ------------------------------------------------------------------ fast value noise (table based)
const TS = 256;
const TAB = new Float32Array(TS * TS);
(function fill() { let a = 0x9e3779b9; for (let i = 0; i < TAB.length; i++) { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); TAB[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; } })();
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = xi & 255, y0 = (yi & 255) * TS, x1 = (xi + 1) & 255, y1 = ((yi + 1) & 255) * TS;
  const a = TAB[y0 + x0], b = TAB[y0 + x1], c = TAB[y1 + x0], d = TAB[y1 + x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, y, oct = 4, lac = 2.03, gain = 0.5) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 37.1, y * f + i * 11.7); n += a; a *= gain; f *= lac; }
  return s / n;
}
export function ridged(x, y, oct = 5) {
  let amp = 0.5, f = 1, sum = 0, w = 1, n2 = 0;
  for (let o = 0; o < oct; o++) {
    let n = vnoise(x * f + o * 17.3, y * f + o * 5.9);
    n = 1 - Math.abs(2 * n - 1); n *= n;
    sum += n * amp * w; n2 += amp; w = Math.min(1, n * 2.0);
    amp *= 0.5; f *= 2.07;
  }
  return sum / n2;
}
export const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mixf = (a, b, t) => a + (b - a) * t;

/**
 * o: { W, H, horizon, focal, camX, camH, z0, z1, nz, zPow, colStep,
 *      height(x, z, u) -> m,  albedo(x, z, h, steep, u) -> [r,g,b] 0..1,
 *      sun: [x,y,z] unit vector towards the sun, sunCol: [r,g,b], ambTop: [r,g,b], ambBot: [r,g,b],
 *      haze(z, u) -> [r,g,b, amount],  shadowSoft, detail (0..1 per-pixel shading noise) }
 * The height grid is sampled in (depth row, screen-column) space, so every screen column gets its own height samples at every depth.
 * returns ImageData (W x H, transparent where there is no terrain)
 */
export function renderTerrain(o) {
  const { W, H, horizon, focal, camH, z0, z1, nz } = o;
  const camX = o.camX || 0;
  const step = o.colStep || 2;
  const du = step / focal, nu = Math.ceil(W / step) + 3, u0 = ((0.5 - W / 2) / focal) - du;
  const zs = new Float32Array(nz);
  const zp = o.zPow || 1.6;
  for (let i = 0; i < nz; i++) zs[i] = z0 + (z1 - z0) * Math.pow(i / (nz - 1), zp);
  const Hg = new Float32Array(nu * nz);
  for (let iz = 0; iz < nz; iz++) {
    const z = zs[iz], row = iz * nu;
    for (let iu = 0; iu < nu; iu++) { const u = u0 + iu * du; Hg[row + iu] = o.height(camX + u * z, z, u); }
  }
  // cast shadows along the X axis, then smoothed across rows/columns (rows are independent, so unsmoothed shadows streak)
  const [lx, ly, lz] = o.sun, sc = o.sunCol, at = o.ambTop, ab = o.ambBot;
  const slopeK = ly / Math.max(0.05, Math.abs(lx)), signX = lx < 0 ? 1 : -1;
  const soft = o.shadowSoft || 40;
  let shG = new Float32Array(nu * nz);
  if (o.shadows !== false) {
    for (let iz = 0; iz < nz; iz++) {
      const row = iz * nu, dX = zs[iz] * du;
      let top = -1e9;
      if (signX > 0) { for (let iu = 0; iu < nu; iu++) { const h = Hg[row + iu]; top = Math.max(h, top - slopeK * dX); shG[row + iu] = Math.min(1, Math.max(0, (top - h) / soft)); } }
      else { for (let iu = nu - 1; iu >= 0; iu--) { const h = Hg[row + iu]; top = Math.max(h, top - slopeK * dX); shG[row + iu] = Math.min(1, Math.max(0, (top - h) / soft)); } }
    }
    const tmpS = new Float32Array(nu * nz);
    for (let pass = 0; pass < 2; pass++) {
      for (let iz = 0; iz < nz; iz++) { const a0 = Math.max(0, iz - 1) * nu, a1 = iz * nu, a2 = Math.min(nz - 1, iz + 1) * nu; for (let iu = 0; iu < nu; iu++) tmpS[a1 + iu] = (shG[a0 + iu] + 2 * shG[a1 + iu] + shG[a2 + iu]) * 0.25; }
      for (let iz = 0; iz < nz; iz++) { const r0 = iz * nu; for (let iu = 0; iu < nu; iu++) shG[r0 + iu] = (tmpS[r0 + Math.max(0, iu - 2)] + 2 * tmpS[r0 + iu] + tmpS[r0 + Math.min(nu - 1, iu + 2)]) * 0.25; }
    }
  }
  const col = new Float32Array(nu * nz * 3);
  for (let iz = 0; iz < nz; iz++) {
    const row = iz * nu, z = zs[iz], dX = z * du;
    const iA = Math.max(0, iz - 1), iB = Math.min(nz - 1, iz + 1), zA = zs[iA], zB = zs[iB];
    for (let iu = 0; iu < nu; iu++) {
      const i = row + iu, u = u0 + iu * du, x = camX + u * z, h = Hg[i];
      const hl = Hg[row + Math.max(0, iu - 1)], hr = Hg[row + Math.min(nu - 1, iu + 1)];
      const gx = (hr - hl) / (2 * dX);
      const gz = (Hg[iB * nu + iu] - Hg[iA * nu + iu]) / Math.max(1, zB - zA) - u * gx;
      let nxx = -gx, nyy = 1, nzz = -gz; const nl = Math.hypot(nxx, nyy, nzz); nxx /= nl; nyy /= nl; nzz /= nl;
      const steep = 1 - nyy;
      const diff = Math.max(0, nxx * lx + nyy * ly + nzz * lz);
      const lit = diff * (1 - shG[i] * 0.94);
      const t = nyy * 0.5 + 0.5;
      const al = o.albedo(x, z, h, steep, u);
      const hz = o.haze(z, u), ha = hz[3];
      const r = al[0] * (sc[0] * lit + mixf(ab[0], at[0], t)), g = al[1] * (sc[1] * lit + mixf(ab[1], at[1], t)), b = al[2] * (sc[2] * lit + mixf(ab[2], at[2], t));
      col[i * 3] = mixf(r, hz[0], ha); col[i * 3 + 1] = mixf(g, hz[1], ha); col[i * 3 + 2] = mixf(b, hz[2], ha);
    }
  }
  if (o.smoothU) {
    const tmpC = new Float32Array(nu * 3);
    for (let iz = 0; iz < nz; iz++) {
      const base = iz * nu * 3;
      for (let iu = 0; iu < nu; iu++) for (let c = 0; c < 3; c++) { const a = col[base + Math.max(0, iu - 1) * 3 + c], b = col[base + iu * 3 + c], d = col[base + Math.min(nu - 1, iu + 1) * 3 + c]; tmpC[iu * 3 + c] = a * 0.25 + b * 0.5 + d * 0.25; }
      for (let i = 0; i < nu * 3; i++) col[base + i] = tmpC[i];
    }
  }
  // column raymarch (with sub-steps between depth rows)
  const img = new ImageData(W, H), px = img.data;
  const cA = new Float32Array(H), cR = new Float32Array(H), cG = new Float32Array(H), cB = new Float32Array(H);
  const det = o.detail === undefined ? 0.1 : o.detail;
  const SUB = o.sub || 3;
  for (let ic = 0; ic < W; ic++) {
    const u = (ic + 0.5 - W / 2) / focal;
    let fu = (u - u0) / du; if (fu < 0) fu = 0; if (fu > nu - 1.001) fu = nu - 1.001;
    const iu = fu | 0, tu = fu - iu;
    cA.fill(0); cR.fill(0); cG.fill(0); cB.fill(0);
    let yTop = H, first = true, pr = 0, pg = 0, pb = 0;
    let h0 = 0, r0c = 0, g0c = 0, b0c = 0, haveRow = false;
    for (let iz = 0; iz < nz; iz++) {
      const i = iz * nu + iu;
      const h1 = Hg[i] + (Hg[i + 1] - Hg[i]) * tu;
      let r1 = col[i * 3] + (col[i * 3 + 3] - col[i * 3]) * tu, g1 = col[i * 3 + 1] + (col[i * 3 + 4] - col[i * 3 + 1]) * tu, b1 = col[i * 3 + 2] + (col[i * 3 + 5] - col[i * 3 + 2]) * tu;
      if (det > 0) { const dn = 1 + det * (vnoise(ic * 0.31 + iz * 0.77, iz * 0.23) - 0.5); r1 *= dn; g1 *= dn; b1 *= dn; }
      const z1 = zs[iz];
      const zPrev = haveRow ? zs[iz - 1] : z1;
      const nsub = haveRow ? SUB : 1;
      for (let sb = 1; sb <= nsub; sb++) {
        const tt = sb / nsub;
        const h = haveRow ? h0 + (h1 - h0) * tt : h1, z = haveRow ? zPrev + (z1 - zPrev) * tt : z1;
        const r = haveRow ? r0c + (r1 - r0c) * tt : r1, g = haveRow ? g0c + (g1 - g0c) * tt : g1, b = haveRow ? b0c + (b1 - b0c) * tt : b1;
        let ys = horizon + (camH - h) * focal / z;
        if (first) { first = false; if (ys > yTop) ys = yTop; pr = r; pg = g; pb = b; }
        if (ys >= yTop) { pr = r; pg = g; pb = b; continue; }
        const y0 = ys > 0 ? ys : 0, rA = Math.floor(y0), rB = Math.min(H - 1, Math.ceil(yTop) - 1);
        const span = Math.max(0.0001, yTop - ys);
        for (let rr = rA; rr <= rB; rr++) {
          const cov = Math.min(rr + 1, yTop) - Math.max(rr, y0);
          if (cov <= 0) continue;
          let q = (rr + 0.5 - ys) / span; if (q < 0) q = 0; else if (q > 1) q = 1;
          cR[rr] += (r + (pr - r) * q) * cov; cG[rr] += (g + (pg - g) * q) * cov; cB[rr] += (b + (pb - b) * q) * cov; cA[rr] += cov;
        }
        yTop = ys; pr = r; pg = g; pb = b;
      }
      h0 = h1; r0c = r1; g0c = g1; b0c = b1; haveRow = true;
      if (yTop <= 0) break;
    }
    for (let rr = 0; rr < H; rr++) {
      const a = cA[rr]; if (a <= 0.002) continue;
      const k = (rr * W + ic) * 4, inv = 255 / a;
      px[k] = Math.min(255, cR[rr] * inv); px[k + 1] = Math.min(255, cG[rr] * inv); px[k + 2] = Math.min(255, cB[rr] * inv); px[k + 3] = Math.min(255, a * 255);
    }
  }
  return img;
}
