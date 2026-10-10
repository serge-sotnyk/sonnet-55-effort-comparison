// Title-screen scene: builds pre-rendered layers (mountains, hills, castle, village, foreground) for a given size and draws
// them every frame with parallax drift plus a handful of cheap animated elements (clouds, birds, smoke, banners, sails, motes).
// See menu.js for the public API.
import { renderTerrain, vnoise, fbm2, ridged, smoothstep } from './menu_terrain.js';
import { rng } from './common.js';
import { clamp, mixf, hexRgb, mixc, rgbaOf, hgrad, vgrad, oak, oakSil, pineSil, pine, poplar, house, church, windmillBody, drawSails, castle, cloudSprite, blotchTexture, grassStrokes } from './menu_art.js';

function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function hex(c) { const [r, g, b] = hexRgb(c); return [r / 255, g / 255, b / 255]; }

const SKY = [[0, '#16245a'], [0.28, '#2f407f'], [0.52, '#6a5a9c'], [0.70, '#c0709e'], [0.84, '#f59a7a'], [0.94, '#ffc58a'], [1, '#ffe0a8']];

function makeRaySprite() {
  const N = 512, c = mk(N, N), x = c.getContext('2d');
  x.translate(N / 2, N / 2);
  const R = rng(321), rays = 15;
  for (let i = 0; i < rays; i++) {
    const a = ((i + (R() - 0.5) * 0.7) / rays) * Math.PI * 2, hw = 0.018 + R() * 0.05, amp = 0.05 + R() * 0.08;
    for (let k = 0; k < 7; k++) {
      const w2 = hw * ((k + 1) / 7) * 2.4;
      x.fillStyle = `rgba(255,224,170,${amp * 0.30})`;
      x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, N * 0.75, a - w2, a + w2); x.closePath(); x.fill();
    }
  }
  x.globalCompositeOperation = 'destination-in';
  const g = x.createRadialGradient(0, 0, N * 0.02, 0, 0, N / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.6, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(-N / 2, -N / 2, N, N);
  return c;
}

/** 1D ridge function: base + smooth noise + a few sines */
function makeRidge(seed, base, amp, scale) {
  return x => base + amp * ((vnoise(x / scale + seed * 13.7, seed * 3.1) * 2 - 1) * 0.75 + (vnoise(x / (scale * 0.37) + seed * 5.3, seed * 7.7) * 2 - 1) * 0.25);
}

export class Scene {
  constructor(w, h, rs, dpr) {
    this.w = w; this.h = h; this.rs = rs; this.dpr = dpr || rs;
    this.s = clamp(Math.max(w / 1920, h / 1080), 0.45, 2.6);       // unit scale (CSS px per 1080p reference px)
    this.yH = Math.round(h * 0.58);                                  // horizon
    this.sunX = w * 0.30; this.sunY = this.yH - h * 0.10;
    this.layers = [];
    this.clouds = [];
    this.dyn = [];
    this.build();
  }

  /** register a pre-rendered layer; (x,y) = top-left in CSS px, amp = parallax sway amplitude */
  addLayer(name, canvas, x, y, amp, extra) {
    const L = Object.assign({ name, canvas, x, y, w: canvas.width / this.rs, h: canvas.height / this.rs, amp, dyn: [] }, extra || {});
    this.layers.push(L); return L;
  }
  /** create a layer canvas covering screen rectangle [x0, x0+wl] x [y0, y0+hl] (plus sway margin) with a context in SCREEN coordinates */
  newLayer(name, y0, y1, amp) {
    const { w, rs } = this;
    const x0 = -amp, wl = w + amp * 2, hl = Math.max(1, y1 - y0);
    const c = mk(wl * rs, hl * rs), ctx = c.getContext('2d');
    ctx.setTransform(rs, 0, 0, rs, -x0 * rs, -y0 * rs);
    const L = this.addLayer(name, c, x0, y0, amp);
    L.ctx = ctx;
    return { L, ctx, x0, x1: x0 + wl, y0, y1 };
  }

  build() {
    const { w, h, s, yH } = this;
    this.skyGrad = null;
    this.rand = rng(20240607);
    this.tex = blotchTexture(256, this.rs, 5);
    this.texDark = blotchTexture(256, this.rs, 9, '255,230,170', '10,16,40');
    this.buildStars();
    this.buildClouds();
    this.buildMountains();
    this.buildHills();
    this.buildForeground();
    this.buildGrass();
    this.buildOverlays();
    this.buildSky();
    this.finishLayers();
  }

  /** bake the sky (gradient, sun glow, sun disc) into one opaque canvas: gradient fills are the expensive part of a frame */
  buildSky() {
    const { w, h, s, yH, rs, sunX, sunY } = this;
    const skyH = Math.min(h, Math.ceil(yH + h * 0.20));
    const c = mk(w * rs, skyH * rs), x = c.getContext('2d'); x.scale(rs, rs);
    const g = x.createLinearGradient(0, 0, 0, yH);
    for (const [p, col] of SKY) g.addColorStop(p, col);
    x.fillStyle = g; x.fillRect(0, 0, w, skyH);
    x.fillStyle = '#ffdfa8'; x.fillRect(0, yH, w, skyH - yH);
    x.globalCompositeOperation = 'lighter';
    let gg = x.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.9);
    gg.addColorStop(0, 'rgba(255,184,104,0.36)'); gg.addColorStop(0.3, 'rgba(255,146,88,0.14)'); gg.addColorStop(1, 'rgba(255,120,80,0)');
    x.fillStyle = gg; x.fillRect(0, 0, w, skyH);
    gg = x.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.18);
    gg.addColorStop(0, 'rgba(255,226,172,0.62)'); gg.addColorStop(0.35, 'rgba(255,200,130,0.30)'); gg.addColorStop(1, 'rgba(255,184,104,0)');
    x.fillStyle = gg; x.fillRect(sunX - h * 0.22, sunY - h * 0.22, h * 0.44, h * 0.44);
    x.globalCompositeOperation = 'source-over';
    this.sky = { canvas: c, h: skyH };
    // sun disc sprite (drawn after the rays every frame so rays never dull it)
    const sr = h * 0.034, sd = mk(sr * 2 * rs + 2, sr * 2 * rs + 2), sx = sd.getContext('2d'); sx.scale(rs, rs);
    gg = sx.createRadialGradient(sr, sr, 0, sr, sr, sr);
    gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.5, '#fffbe6'); gg.addColorStop(0.78, '#ffeaa8'); gg.addColorStop(1, 'rgba(255,214,140,0)');
    sx.fillStyle = gg; sx.beginPath(); sx.arc(sr, sr, sr, 0, 7); sx.fill();
    this.sunSprite = { canvas: sd, r: sr };
  }

  /** bake sun bloom + colour grade into every layer (source-atop, so only painted pixels are touched) */
  finishLayers() {
    const { w, h, sunX, sunY } = this;
    for (const L of this.layers) {
      const ctx = L.ctx; if (!ctx) continue;
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      let g = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.85);
      g.addColorStop(0, 'rgba(255,170,96,0.26)'); g.addColorStop(0.45, 'rgba(255,150,90,0.09)'); g.addColorStop(1, 'rgba(255,140,80,0)');
      ctx.fillStyle = g; ctx.fillRect(L.x, L.y, L.w, L.h);
      g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(255,170,100,0.16)'); g.addColorStop(0.45, 'rgba(255,200,160,0.05)'); g.addColorStop(1, 'rgba(110,80,170,0.22)');
      ctx.fillStyle = g; ctx.fillRect(L.x, L.y, L.w, L.h);
      ctx.restore();
    }
    // vignette as a small image stretched over the screen
    const vw = Math.max(64, Math.round(w / 5)), vh = Math.max(36, Math.round(h / 5));
    const vc = mk(vw, vh), vx = vc.getContext('2d');
    const vg = vx.createRadialGradient(vw / 2, vh * 0.52, Math.min(vw, vh) * 0.35, vw / 2, vh * 0.52, Math.hypot(vw, vh) * 0.62);
    vg.addColorStop(0, 'rgba(20,10,40,0)'); vg.addColorStop(0.7, 'rgba(20,10,40,0.26)'); vg.addColorStop(1, 'rgba(10,4,24,0.6)');
    vx.fillStyle = vg; vx.fillRect(0, 0, vw, vh);
    this.vigImg = vc;
  }

  // ---------------------------------------------------------------- clouds (sprites drawn behind the mountains)
  buildStars() {
    const R = rng(4242);
    this.stars = Array.from({ length: 70 }, () => { const y = Math.pow(R(), 1.8) * 0.36; return { x: R(), y, r: 0.5 + R() * 1.0, ph: R() * 6.28, sp: 0.5 + R() * 1.5 }; });
  }
  buildClouds() {
    const { w, h, s, rs } = this;
    const specs = [
      // [style, width, height, y(frac of h), speed, x0 frac, alpha]
      [1, 900, 80, 0.10, 3, 0.55, 0.45], [1, 760, 70, 0.17, 4, 0.1, 0.6], [0, 560, 190, 0.30, 7, 0.38, 0.95], [0, 420, 150, 0.21, 5, 0.86, 0.9],
      [1, 980, 70, 0.34, 4, 0.5, 0.8], [0, 380, 120, 0.385, 6, 0.05, 0.9], [1, 640, 60, 0.26, 6, 0.75, 0.7], [0, 300, 100, 0.12, 4, 0.2, 0.7],
    ];
    this.clouds = specs.map(([style, cw, ch, yf, sp, xf, alpha], i) => {
      const wc = cw * s, hc = ch * s;
      return { canvas: cloudSprite(wc, hc, rs, i + 3, style), w: wc, h: hc, y: h * yf - hc / 2, speed: sp * s, x0: xf * (w + wc), alpha };
    });
  }

  // ---------------------------------------------------------------- mountains (raymarched heightfield)
  buildMountains() {
    const { w, h, rs, s, yH } = this;
    const amp = 6 * s;
    const top = Math.max(0, yH - h * 0.50), bot = yH + h * 0.13;
    const Wd = Math.ceil((w + amp * 2) * rs), Hd = Math.ceil((bot - top) * rs);
    const focal = 0.86 * w * rs;
    const horizon = (yH - top) * rs;
    const uSun = (this.sunX - w / 2) / (0.86 * w);
    const sunHaze = hex('#ffd2a0'), coolHaze = hex('#8a7cb4');
    const rock = hex('#6c6a82'), forest = hex('#263a3a'), snow = hex('#fffafa'), dry = hex('#8c7066');
    const warp = (x, z) => [x + 2600 * (fbm2(x / 7000 + 5, z / 7000, 3) - 0.5), z + 2600 * (fbm2(x / 7000 + 9, z / 7000 + 3, 3) - 0.5)];
    const CA = Math.cos(0.62), SA = Math.sin(0.62);
    const rot = (x, z) => [x * CA - z * SA, x * SA + z * CA];
    const img = renderTerrain({
      W: Wd, H: Hd, horizon, focal, camX: 0, camH: 900, z0: 4200, z1: 56000, nz: 340, zPow: 2.0, colStep: 2, sub: 3, smoothU: true,
      height: (x, z, u) => {
        const gap = 1 - 0.82 * Math.exp(-Math.pow((u - uSun) / 0.10, 2));
        const [wx, wz] = warp(x, z);
        const [rx, rz] = rot(wx, wz);
        const bump = (c, wdt, zz) => Math.exp(-Math.pow((zz - c) / wdt, 2));
        const R = ridged(rx / 8200 + 3.1, rz / 4600 + 7.7, z > 28000 ? 4 : 6);
        const R2 = ridged(rx / 6000 + 11.3, rz / 3600 + 2.1, 7);
        const nearR = 1500 * Math.pow(R2, 1.1) * bump(9000, 3600, z);
        const midR = 3000 * Math.pow(R, 1.15) * bump(19000, 6500, z);
        const farR = 4300 * Math.pow(R, 1.0) * bump(38000, 12000, z) * (0.55 + 0.9 * fbm2(x / 16000 + 3, z / 16000, 2));
        const base = 380 * fbm2(x / 3000, z / 3000, 3);
        return (nearR + midR + farR) * gap + base;
      },
      albedo: (x, z, hh, steep, u) => {
        const n = vnoise(x / 900, z / 900) * 0.55 + vnoise(x / 180, z / 180) * 0.45;
        const sl = smoothstep(1750 + n * 600, 2300 + n * 600, hh) * (1 - smoothstep(0.16, 0.42, steep + (n - 0.5) * 0.10));
        const f = smoothstep(1500, 500, hh + n * 350);
        const rr = [mixf(rock[0], dry[0], n), mixf(rock[1], dry[1], n), mixf(rock[2], dry[2], n)];
        const base = [mixf(rr[0], forest[0], f), mixf(rr[1], forest[1], f), mixf(rr[2], forest[2], f)];
        return [mixf(base[0], snow[0], sl), mixf(base[1], snow[1], sl), mixf(base[2], snow[2], sl)];
      },
      sun: [-0.78, 0.26, 0.20], sunCol: [1.45, 0.92, 0.52], ambTop: [0.34, 0.38, 0.72], ambBot: [0.30, 0.24, 0.40],
      haze: (z, u) => {
        const a = (1 - Math.exp(-Math.max(0, z - 5500) / 21000)) * 0.95;
        const g = Math.exp(-Math.pow((u - uSun) / 0.34, 2));
        return [mixf(coolHaze[0], sunHaze[0], g), mixf(coolHaze[1], sunHaze[1], g), mixf(coolHaze[2], sunHaze[2], g), a];
      },
      shadowSoft: 160, detail: 0.0,
    });
    const c = mk(Wd, Hd), mctx = c.getContext('2d'); mctx.putImageData(img, 0, 0);
    mctx.setTransform(rs, 0, 0, rs, amp * rs, -top * rs);
    const L = this.addLayer('mountains', c, -amp, top, amp); L.ctx = mctx;
    // fade the lowest slopes into the valley haze so the foot of the range never shows its (jagged) nearest rows
    mctx.save(); mctx.globalCompositeOperation = 'source-atop';
    const fg = mctx.createLinearGradient(0, bot - h * 0.085, 0, bot);
    fg.addColorStop(0, 'rgba(240,200,176,0)'); fg.addColorStop(0.6, 'rgba(240,200,176,0.75)'); fg.addColorStop(1, 'rgba(240,200,176,1)');
    mctx.fillStyle = fg; mctx.fillRect(-amp, bot - h * 0.085, w + amp * 2, h * 0.085 + 2); mctx.restore();
  }

  // ---------------------------------------------------------------- hills, fields, village, castle
  hillFill(ctx, f, x0, x1, yBot, top, mid, bot) {
    let ymin = 1e9; for (let x = x0; x <= x1; x += 8) ymin = Math.min(ymin, f(x));
    ctx.beginPath(); ctx.moveTo(x0, yBot);
    for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, f(x));
    ctx.lineTo(x1, yBot); ctx.closePath();
    const g = ctx.createLinearGradient(0, ymin, 0, yBot);
    g.addColorStop(0, top); g.addColorStop(0.35, mid); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fill();
  }
  /** rim light along ridge sections that face the sun (left-facing), shade on the others */
  rimLight(ctx, f, x0, x1, depth, k, litCol, shadeCol, aLit = 0.55, aShade = 0.35) {
    const st = 6;
    for (let x = x0; x < x1; x += st) {
      const sl = (f(x + 3) - f(x - 3)) / 6;           // y grows downward: negative slope = rising to the right = faces the sun
      const lit = clamp(-sl * k, 0, 1), dk = clamp(sl * k, 0, 1);
      const a = lit > dk ? lit * aLit : dk * aShade;
      if (a < 0.02) continue;
      const y = f(x), y2 = f(x + st);
      const g = ctx.createLinearGradient(0, Math.min(y, y2), 0, Math.min(y, y2) + depth);
      const col = lit > dk ? litCol : shadeCol;
      g.addColorStop(0, rgbaOf(col, a)); g.addColorStop(1, rgbaOf(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + st + 0.5, y2); ctx.lineTo(x + st + 0.5, y2 + depth); ctx.lineTo(x, y + depth); ctx.closePath(); ctx.fill();
    }
  }
  /** vertical colour wash over what is already painted in the layer (source-atop) */
  tint(ctx, x0, y0, x1, y1, stops) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = vgrad(ctx, y0, y1, stops); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
  }
  /** painterly blotch texture over what is already painted */
  texture(ctx, x0, y0, x1, y1, alpha, dark = false) {
    const pat = ctx.createPattern(dark ? this.texDark : this.tex, 'repeat');
    if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / this.rs));
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = alpha; ctx.fillStyle = pat; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
  }
  /** patchwork fields following the hill surface */
  fields(ctx, f, x0, x1, depthMax, seed, pal, rows, sunk = 0) {
    const R = rng(seed * 313 + 9), s = this.s;
    const dAt = (k, x) => (Math.pow(k / rows, 1.35) * depthMax) * (1 + 0.10 * Math.sin(x * 0.011 + k * 1.7));
    for (let k = 0; k < rows; k++) {
      let x = x0 - 40;
      while (x < x1) {
        const wseg = (50 + R() * 150) * s, xa = x, xb = Math.min(x1 + 40, x + wseg);
        const sk = (R() - 0.5) * 36 * s;
        const c = pal[Math.floor(R() * pal.length)];
        const poly = [];
        for (let xx = xa; xx <= xb; xx += 8) poly.push([xx, f(xx) + sunk + dAt(k, xx)]);
        const last = poly.length ? poly[poly.length - 1][0] : xb;
        for (let xx = last; xx >= xa; xx -= 8) poly.push([xx + sk * 0.25, f(xx) + sunk + dAt(k + 1, xx) + 1.5]);
        ctx.beginPath(); poly.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
        ctx.fillStyle = c; ctx.fill();
        // furrow rows (alternating dark / light) following the contour
        const nf = 4 + Math.floor(R() * 4);
        for (let q = 1; q <= nf; q++) {
          ctx.strokeStyle = q % 2 ? 'rgba(50,40,10,0.16)' : 'rgba(255,248,190,0.14)'; ctx.lineWidth = Math.max(0.7, s * 0.8);
          ctx.beginPath();
          for (let xx = xa; xx <= xb; xx += 10) { const yy = f(xx) + sunk + mixf(dAt(k, xx), dAt(k + 1, xx), q / (nf + 1)); xx === xa ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); }
          ctx.stroke();
        }
        const fg = ctx.createLinearGradient(0, f((xa + xb) / 2) + sunk + dAt(k, (xa + xb) / 2), 0, f((xa + xb) / 2) + sunk + dAt(k + 1, (xa + xb) / 2));
        fg.addColorStop(0, 'rgba(255,248,200,0.18)'); fg.addColorStop(1, 'rgba(30,50,40,0.18)');
        ctx.fillStyle = fg; ctx.fill();
        if (R() < 0.55) {
          ctx.strokeStyle = 'rgba(36,70,50,0.55)'; ctx.lineWidth = Math.max(1, s * 1.4);
          ctx.beginPath(); for (let xx = xa; xx <= xb; xx += 8) { const yy = f(xx) + sunk + dAt(k + 1, xx); xx === xa ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke();
        }
        x = xb;
      }
    }
  }
  /** draw into a temporary layer-sized canvas, multiply it by a mask (maskFn paints alpha with destination-in) and composite onto ctx */
  maskedDraw(ctx, x0, y0, x1, y1, draw, maskFn) {
    const rs = this.rs, tmp = mk((x1 - x0) * rs, (y1 - y0) * rs), tc = tmp.getContext('2d');
    tc.setTransform(rs, 0, 0, rs, -x0 * rs, -y0 * rs);
    draw(tc);
    tc.globalCompositeOperation = 'destination-in'; maskFn(tc, x0, y0, x1, y1);
    ctx.drawImage(tmp, x0, y0, x1 - x0, y1 - y0);
  }
  /** drifting mist band attached to a layer */
  addMist(L, yc, hMist, speed, alpha, seed) {
    const { w, s, rs } = this, R = rng(seed);
    const mw = w + 500 * s, mh = hMist * s;
    const c = mk(mw * rs, mh * rs), x = c.getContext('2d'); x.scale(rs, rs);
    for (let i = 0; i < 70; i++) {
      const bx = R() * mw, by = mh * (0.3 + R() * 0.4), rx = (70 + R() * 170) * s, ry = mh * (0.16 + R() * 0.26);
      for (const o of [-mw, 0, mw]) {
        x.save(); x.translate(bx + o, by); x.scale(1, ry / rx);
        const g = x.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(255,226,196,0.42)'); g.addColorStop(1, 'rgba(255,226,196,0)');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, rx, 0, 7); x.fill(); x.restore();
      }
    }
    L.dyn.push((ctx, t, ox) => {
      const off = (t * speed * s) % mw;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(c, -off + ox * 0.5, yc - mh / 2, mw, mh); ctx.drawImage(c, mw - off + ox * 0.5, yc - mh / 2, mw, mh);
      ctx.restore();
    });
  }

  buildHills() {
    const { w, h, s, yH, rs } = this, R = this.rand;
    const FIELD = ['#e4c866', '#cdb258', '#a9c85a', '#7fb24c', '#5f9c48', '#d6a455', '#a08050', '#8cb84e'];
    const sunX = this.sunX;
    // ---- H1: far hazy hills and the lake
    let lakeY0 = yH + 72 * s, lakeY1 = yH + 168 * s;
    {
      const amp = 10 * s, f = makeRidge(1, yH + 58 * s, 18 * s, 300 * s);
      const { L, ctx, x0, x1, y0, y1 } = this.newLayer('hills1', yH + 6 * s, yH + 330 * s, amp);
      this.hillFill(ctx, f, x0, x1, y1, '#9d92bc', '#8a9aa4', '#78917c');
      this.rimLight(ctx, f, x0, x1, 22 * s, 7, '#ffe2b0', '#4a4a7a', 0.5, 0.25);
      for (let i = 0; i < 46; i++) { const x = x0 + R() * (x1 - x0); oak(ctx, x, f(x) + (4 + R() * 24) * s, (2.6 + R() * 1.6) * s, i + 1, 2, false); }
      this.tint(ctx, x0, y0, x1, y1, [[0, 'rgba(226,176,190,0.34)'], [0.35, 'rgba(226,176,184,0.16)'], [1, 'rgba(226,176,184,0.03)']]);
      // lake in front of the far shore
      const xl = x0 - 20, xr = w * 0.66;
      const bell = x => smoothstep(xl, xl + 0.06 * w, x) * (1 - smoothstep(xr - 0.16 * w, xr, x));
      const topY = x => f(x) + 12 * s + 62 * s * (1 - bell(x));
      ctx.beginPath(); ctx.moveTo(xl, y1);
      for (let x = xl; x <= xr; x += 5) ctx.lineTo(x, topY(x));
      ctx.lineTo(xr, y1); ctx.closePath();
      ctx.fillStyle = vgrad(ctx, yH + 60 * s, yH + 190 * s, [[0, '#fcd0a4'], [0.3, '#f4a8a0'], [0.65, '#b07ca8'], [1, '#6e5c9e']]); ctx.fill();
      ctx.save(); ctx.clip();
      // sun reflection path (stack of soft trapezoids so the edges feather out)
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 9; k++) {
        const f = (k + 1) / 9, top = 8 + 22 * f, bot = 34 + 160 * f;
        const pg = ctx.createLinearGradient(0, yH + 50 * s, 0, yH + 200 * s);
        pg.addColorStop(0, `rgba(255,236,180,${0.16 * (1 - f * 0.55)})`); pg.addColorStop(0.55, `rgba(255,204,140,${0.09 * (1 - f * 0.4)})`); pg.addColorStop(1, 'rgba(255,170,110,0.03)');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(sunX - top * s, yH + 50 * s); ctx.lineTo(sunX + top * s, yH + 50 * s); ctx.lineTo(sunX + bot * s, yH + 200 * s); ctx.lineTo(sunX - bot * s, yH + 200 * s); ctx.closePath(); ctx.fill();
      }
      const pg2 = ctx.createRadialGradient(sunX, yH + 70 * s, 0, sunX, yH + 70 * s, 220 * s);
      pg2.addColorStop(0, 'rgba(255,214,150,0.35)'); pg2.addColorStop(1, 'rgba(255,190,130,0)'); ctx.fillStyle = pg2; ctx.fillRect(sunX - 240 * s, yH + 40 * s, 480 * s, 200 * s);
      // soft horizontal ripples
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 160; i++) {
        const d = R(), y = lakeY0 - 14 * s + d * (lakeY1 - lakeY0 + 30 * s), x = xl + R() * (xr - xl), ww = (14 + d * 60) * s * (0.5 + R());
        ctx.fillStyle = R() < 0.5 ? 'rgba(255,230,190,0.16)' : 'rgba(80,50,120,0.14)'; ctx.fillRect(x, y, ww, Math.max(0.8, 0.9 * s * (0.5 + d)));
      }
      ctx.restore();
      // shoreline reflection of the far hills
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#7a6a98';
      ctx.beginPath(); ctx.moveTo(xl, topY(xl));
      for (let x = xl; x <= xr; x += 5) { const tt = topY(x); ctx.lineTo(x, tt + (tt - f(x)) * 0.9 + 3 * s); }
      for (let x = xr; x >= xl; x -= 5) ctx.lineTo(x, topY(x));
      ctx.closePath(); ctx.fill(); ctx.restore();
      // glitter (dynamic)
      const gl = Array.from({ length: 110 }, () => ({ u: R() - 0.5, d: Math.pow(R(), 0.8), w: 0.5 + R(), ph: R() * 6.28, sp: 1.5 + R() * 3 }));
      const gy0 = lakeY0 + 4 * s, gh = lakeY1 - lakeY0 + 8 * s;
      L.dyn.push((c, t, ox) => {
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const g of gl) {
          const half = (16 + g.d * 110) * s, x = sunX + g.u * 2 * half + ox, y = gy0 + g.d * gh;
          const a = Math.pow(0.5 + 0.5 * Math.sin(t * g.sp + g.ph), 3) * (0.9 - 0.5 * g.d);
          if (a < 0.03) continue;
          c.fillStyle = `rgba(255,238,196,${a})`; c.fillRect(x - (4 + 18 * g.d) * s * g.w, y, (8 + 36 * g.d) * s * g.w, Math.max(1, (0.9 + 1.2 * g.d) * s));
        }
        c.restore();
      });
      const boats = [{ x0: 0.20, v: 3.2, y: lakeY0 + 34 * s, sz: 1.0 }, { x0: 0.46, v: -2.4, y: lakeY0 + 58 * s, sz: 1.35 }];
      L.dyn.push((c, t, ox) => {
        for (const b of boats) {
          const span = w * 0.46, x = w * 0.10 + ((b.x0 * span + t * b.v * s) % span + span) % span + ox, y = b.y + Math.sin(t * 0.9 + b.x0 * 9) * 0.8 * s, k = 7 * s * b.sz;
          c.fillStyle = 'rgba(70,40,90,0.32)'; c.beginPath(); c.ellipse(x + k * 0.6, y + k * 0.55, k * 1.5, k * 0.18, 0, 0, 7); c.fill();
          c.fillStyle = '#3a2438'; c.beginPath(); c.moveTo(x - k * 1.3, y - k * 0.15); c.quadraticCurveTo(x, y + k * 0.7, x + k * 1.3, y - k * 0.15); c.closePath(); c.fill();
          c.fillStyle = '#fff2d8'; c.beginPath(); c.moveTo(x - k * 0.15, y - k * 0.2); c.lineTo(x - k * 0.15, y - k * 3.0); c.lineTo(x - k * 1.1, y - k * 0.3); c.closePath(); c.fill();
          c.fillStyle = '#e8a878'; c.beginPath(); c.moveTo(x + k * 0.1, y - k * 0.2); c.lineTo(x + k * 0.1, y - k * 2.3); c.lineTo(x + k * 0.9, y - k * 0.3); c.closePath(); c.fill();
          c.fillStyle = '#4a3040'; c.fillRect(x - k * 0.2, y - k * 3.1, k * 0.14, k * 3.0);
        }
      });
      this.addMist(L, yH + 70 * s, 70, 4, 0.55, 31);
    }
    // ---- H2: mid hills with patchwork fields + windmill
    {
      const amp = 18 * s, f = makeRidge(2, yH + 168 * s, 28 * s, 360 * s);
      const { L, ctx, x0, x1, y0, y1 } = this.newLayer('hills2', yH + 100 * s, yH + 420 * s, amp);
      this.hillFill(ctx, f, x0, x1, y1, '#c0c680', '#8cb464', '#62965a');
      this.fields(ctx, f, x0, x1, 110 * s, 3, FIELD.map(c => mixc(c, '#8a9ab8', 0.10)), 4);
      this.texture(ctx, x0, y0, x1, y1, 0.9);
      this.rimLight(ctx, f, x0, x1, 30 * s, 6, '#fff0b8', '#3a3a78', 0.55, 0.3);
      for (let i = 0; i < 110; i++) { const x = x0 + R() * (x1 - x0); oak(ctx, x, f(x) + (8 + R() * 80) * s, (4 + R() * 3.5) * s, i + 40, R() < 0.2 ? 1 : 0, true); }
      for (let i = 0; i < 22; i++) { const x = x0 + R() * (x1 - x0); pine(ctx, x, f(x) + (10 + R() * 60) * s, (14 + R() * 12) * s, 2, true); }
      const mx = w * 0.255, my = f(mx) + 20 * s;
      const hub = windmillBody(ctx, mx, my, 1.55 * s);
      L.dyn.push((c, t, ox) => drawSails(c, hub[0] + ox, hub[1], 1.55 * s, t * 0.5));
      this.tint(ctx, x0, y0, x1, y1, [[0, 'rgba(210,170,190,0.26)'], [0.4, 'rgba(210,170,190,0.06)'], [1, 'rgba(60,40,90,0.10)']]);
      this.addMist(L, yH + 205 * s, 80, 5, 0.5, 33);
    }
    // ---- H3: castle hill + village + castle
    {
      const amp = 28 * s;
      const xc = w * 0.765, plat = 215 * s, slopeL = 300 * s, slopeR = 210 * s;
      const baseF = makeRidge(3, yH + 250 * s, 16 * s, 420 * s);
      const summit = yH + 44 * s;
      const f = x => {
        const b = baseF(x), peak = b - summit;
        const d = x < xc ? Math.max(0, xc - x - plat) / slopeL : Math.max(0, x - xc - plat) / slopeR;
        return b - peak * Math.exp(-d * d * 1.5);
      };
      this.hill3 = f;
      const { L, ctx, x0, x1, y0, y1 } = this.newLayer('castle', Math.max(0, yH - 360 * s), h, amp);
      this.hillFill(ctx, f, x0, x1, y1, '#cdc878', '#92ba5c', '#5a9054');
      this.maskedDraw(ctx, x0, y0, x1, y1, tc => this.fields(tc, f, x0, xc - plat * 0.7, 170 * s, 5, FIELD, 5, 6 * s), (tc, ax0, ay0, ax1, ay1) => {
        const g = tc.createLinearGradient(xc - plat * 1.5, 0, xc - plat * 0.7, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); tc.fillStyle = g; tc.fillRect(ax0, ay0, ax1 - ax0, ay1 - ay0);
        tc.fillStyle = 'rgba(0,0,0,1)'; tc.fillRect(ax0, ay0, xc - plat * 1.5 - ax0, ay1 - ay0);
      });
      this.maskedDraw(ctx, x0, y0, x1, y1, tc => this.fields(tc, f, xc + plat * 0.5, x1, 230 * s, 8, FIELD.map(c => mixc(c, '#506a8a', 0.22)), 5, 8 * s), (tc, ax0, ay0, ax1, ay1) => {
        const g = tc.createLinearGradient(xc + plat * 0.5, 0, xc + plat * 1.35, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); tc.fillStyle = g; tc.fillRect(ax0, ay0, ax1 - ax0, ay1 - ay0);
      });
      this.texture(ctx, x0, y0, x1, y1, 0.5);
      // sun-side light / far-side shade across the whole hill
      ctx.save(); ctx.globalCompositeOperation = 'source-atop';
      const hl = ctx.createLinearGradient(xc - 620 * s, 0, xc + 420 * s, 0);
      hl.addColorStop(0, 'rgba(255,214,140,0.30)'); hl.addColorStop(0.42, 'rgba(255,214,140,0.0)'); hl.addColorStop(0.7, 'rgba(60,40,120,0.22)'); hl.addColorStop(1, 'rgba(40,30,110,0.42)');
      ctx.fillStyle = hl; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
      this.rimLight(ctx, f, x0, x1, 46 * s, 5, '#fff0b8', '#2e2a68', 0.62, 0.38);
      const houses = [];
      for (let i = 0; i < 18; i++) {
        const x = xc - 660 * s + R() * 450 * s, d = (22 + R() * 105) * s;
        houses.push([x, f(x) + d, (26 + d / s * 0.16 + R() * 12) * s, i + 1]);
      }
      houses.sort((a, b) => a[1] - b[1]);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const pathPts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, x = xc - 600 * s + t * 540 * s + Math.sin(t * 7) * 26 * s * (1 - t); pathPts.push([x, f(x) + (110 - 96 * t) * s]); }
      for (const [wd, col] of [[9, 'rgba(100,70,60,0.45)'], [6.5, '#e6c692'], [2, 'rgba(255,240,200,0.6)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = wd * s * 0.8;
        ctx.beginPath(); pathPts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
      ctx.restore();
      // switchback road from the castle gate down the front of the hill
      {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, x = xc - 46 * s * (1 - t) - t * 70 * s + Math.sin(t * 9.4) * (22 + 120 * t) * s * Math.min(1, t * 3);
          pts.push([x, f(x) + (8 + t * 150) * s, t]);
        }
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const [wd, col] of [[1.45, 'rgba(90,60,70,0.40)'], [1.0, '#ecc994'], [0.32, 'rgba(255,244,210,0.55)']]) {
          for (let i = 1; i < pts.length; i++) {
            ctx.strokeStyle = col; ctx.lineWidth = wd * (5 + pts[i][2] * 22) * s;
            ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
          }
        }
        ctx.restore();
        for (let i = 0; i < 9; i++) { const q = pts[4 + i * 4], side = i % 2 ? 1 : -1; oak(ctx, q[0] + side * (16 + q[2] * 20) * s, q[1] + 6 * s, (5 + q[2] * 5) * s, i + 700, 0, true); }
      }
      for (let i = 0; i < 40; i++) { const x = xc - 740 * s + R() * 640 * s; oak(ctx, x, f(x) + (14 + R() * 120) * s, (5 + R() * 5) * s, i + 200, R() < 0.25 ? 1 : 0, true); }
      const smoke = [];
      for (const [x, y, wd, sd] of houses) { const a = house(ctx, x, y, wd, sd); if (smoke.length < 7 && R() < 0.5) smoke.push(a); }
      church(ctx, xc - 360 * s, f(xc - 360 * s) + 50 * s, 32 * s);
      for (let i = 0; i < 26; i++) { const x = xc - 760 * s + R() * 700 * s; if (R() < 0.7) pine(ctx, x, f(x) + (30 + R() * 120) * s, (16 + R() * 16) * s, 2, true); else poplar(ctx, x, f(x) + (30 + R() * 120) * s, (24 + R() * 14) * s, 1); }
      for (let i = 0; i < 22; i++) { const x = xc + 220 * s + R() * 520 * s; pine(ctx, x, f(x) + (4 + R() * 90) * s, (18 + R() * 22) * s, 2, true); }
      for (let i = 0; i < 16; i++) { const x = xc + 160 * s + R() * 420 * s; oak(ctx, x, f(x) + (14 + R() * 100) * s, (6 + R() * 6) * s, i + 300, R() < 0.3 ? 1 : 0, true); }
      // a little flock of sheep on the sunny slope
      for (let i = 0; i < 14; i++) {
        const x = xc - 420 * s + R() * 160 * s, y = f(x) + (20 + R() * 40) * s, sz = (2.6 + R() * 1.2) * s;
        ctx.fillStyle = 'rgba(40,24,70,0.22)'; ctx.beginPath(); ctx.ellipse(x + sz * 0.8, y + sz * 0.5, sz * 1.1, sz * 0.35, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.ellipse(x, y, sz, sz * 0.65, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#4a3a3e'; ctx.beginPath(); ctx.arc(x - sz * 0.9, y - sz * 0.15, sz * 0.38, 0, 7); ctx.fill();
      }
      const info = castle(ctx, xc, f(xc) + 4 * s, 1.12 * s);
      this.castleInfo = info;
      this.tint(ctx, x0, y0, x1, y1, [[0, 'rgba(255,196,150,0.10)'], [0.5, 'rgba(255,196,150,0.0)'], [1, 'rgba(40,24,80,0.12)']]);
      L.dyn.push((c, t, ox) => {
        for (const [fx, fy, len, hue] of info.flags) {
          const n = 7, hh = len * 0.55;
          c.beginPath();
          for (let i = 0; i <= n; i++) { const k = i / n, yy = fy + Math.sin(t * 3.4 - k * 3.2 + fx * 0.05) * len * 0.08 * k + k * len * 0.04; i ? c.lineTo(fx + ox + k * len, yy) : c.moveTo(fx + ox, yy); }
          for (let i = n; i >= 0; i--) { const k = i / n, yy = fy + hh * (1 - k * 0.12) + Math.sin(t * 3.4 - k * 3.2 + fx * 0.05) * len * 0.08 * k + k * len * 0.04; c.lineTo(fx + ox + k * len, yy); }
          c.closePath();
          const g = c.createLinearGradient(fx + ox, fy, fx + ox + len, fy + hh);
          g.addColorStop(0, hue ? '#ffd26a' : '#ff7a5a'); g.addColorStop(0.5, hue ? '#e8a830' : '#d0384a'); g.addColorStop(1, hue ? '#a8741c' : '#7a1c34');
          c.fillStyle = g; c.fill();
        }
        c.save(); c.globalCompositeOperation = 'lighter';
        for (const [tx, ty] of info.torches) { const fl = 0.75 + 0.25 * Math.sin(t * 9 + tx); const gg = c.createRadialGradient(tx + ox, ty, 0, tx + ox, ty, 14 * s); gg.addColorStop(0, `rgba(255,190,90,${0.75 * fl})`); gg.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = gg; c.fillRect(tx + ox - 14 * s, ty - 14 * s, 28 * s, 28 * s); }
        c.restore();
        smoke.forEach(([sx, sy], si) => {
          for (let p = 0; p < 6; p++) {
            const age = ((t * 0.16 + p / 6 + si * 0.37) % 1);
            const x = sx + ox + (age * 46 + Math.sin(age * 6 + si) * 5) * s, y = sy - age * 78 * s, r = (2.4 + age * 11) * s;
            const a = 0.30 * (1 - age) * Math.min(1, age * 8);
            const sg = c.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
            sg.addColorStop(0, `rgba(255,232,212,${a})`); sg.addColorStop(0.6, `rgba(214,190,200,${a * 0.7})`); sg.addColorStop(1, 'rgba(190,170,190,0)');
            c.fillStyle = sg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
          }
        });
      });
    }
    // ---- H4: near meadow
    {
      const amp = 40 * s, f = makeRidge(4, yH + 322 * s, 20 * s, 420 * s);
      const { L, ctx, x0, x1, y0, y1 } = this.newLayer('meadow', yH + 250 * s, h, amp);
      this.hillFill(ctx, f, x0, x1, y1, '#a8c25c', '#6f9c4c', '#3b6f46');
      this.texture(ctx, x0, y0, x1, y1, 1.0);
      this.rimLight(ctx, f, x0, x1, 40 * s, 5, '#ffeaa8', '#1e2a58', 0.6, 0.4);
      grassStrokes(ctx, x0, y0, x1, y1, Math.round((x1 - x0) * (y1 - y0) / 500), 21, 7 * s, ['rgba(190,214,100,0.35)', 'rgba(60,110,60,0.35)', 'rgba(250,236,150,0.3)', 'rgba(40,84,60,0.4)'], f);
      for (let i = 0; i < 14; i++) { const x = x0 + R() * (x1 - x0); oak(ctx, x, f(x) + (10 + R() * 50) * s, (10 + R() * 8) * s, i + 400, 0, true); }
      this.tint(ctx, x0, y0, x1, y1, [[0, 'rgba(255,190,140,0.08)'], [1, 'rgba(20,16,60,0.28)']]);
    }
  }

  // ---------------------------------------------------------------- foreground
  buildForeground() {
    const { w, h, s, yH } = this, R = this.rand;
    const amp = 58 * s, f = makeRidge(5, h - 112 * s, 18 * s, 500 * s);
    const { L, ctx, x0, x1, y0, y1 } = this.newLayer('foreground', h - 600 * s, h, amp);
    this.hillFill(ctx, f, x0, x1, y1, '#2c4a3a', '#1a382e', '#0c1c1a');
    this.rimLight(ctx, f, x0, x1, 22 * s, 4, '#ffd890', '#0a1420', 0.5, 0.4);
    grassStrokes(ctx, x0, y0, x1, y1, Math.round((x1 - x0) * (y1 - y0) / 220), 31, 20 * s, ['rgba(70,120,70,0.55)', 'rgba(20,50,40,0.7)', 'rgba(210,190,100,0.45)', 'rgba(14,34,32,0.8)'], f);
    // tall trees (dark silhouettes with warm rim light) on a temp canvas so they can be shaded together
    const tmp = mk((x1 - x0) * this.rs, (y1 - y0) * this.rs), tc = tmp.getContext('2d');
    tc.setTransform(this.rs, 0, 0, this.rs, -x0 * this.rs, -y0 * this.rs);
    for (const [fx, r, sd] of [[0.150, 78, 4], [0.045, 150, 1], [-0.005, 120, 2], [0.105, 110, 3]]) oakSil(tc, w * fx, f(w * fx) + 40 * s, r * s, sd);
    [[0.972, 400], [0.93, 290], [0.905, 200]].forEach(([fx, hh], i) => pineSil(tc, w * fx, f(w * fx) + 20 * s, hh * s, hh * 0.2 * s, i + 3));
    tc.globalCompositeOperation = 'source-atop';
    const dg = tc.createLinearGradient(x0, y0, x1, y1);
    dg.addColorStop(0, 'rgba(20,22,56,0.46)'); dg.addColorStop(1, 'rgba(8,10,36,0.86)');
    tc.fillStyle = dg; tc.fillRect(x0, y0, x1 - x0, y1 - y0);
    tc.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, x0, y0, x1 - x0, y1 - y0);
    const cols = ['#ffe27a', '#fff6e0', '#ff8a7a', '#ffd0f0'];
    for (let i = 0; i < 380; i++) { const x = x0 + R() * (x1 - x0), y = f(x) + 8 * s + R() * (y1 - f(x) - 8 * s); ctx.fillStyle = cols[Math.floor(R() * cols.length)]; ctx.globalAlpha = 0.65; ctx.beginPath(); ctx.arc(x, y, (0.9 + R() * 1.4) * s, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  /** tall blades along the bottom edge; drawn as vertical slices with a wind-driven shear so the grass ripples */
  buildGrass() {
    const { w, h, s, rs } = this, R = rng(808);
    const amp = 66 * s, gh = 130 * s;
    const { L, ctx, x0, x1, y0, y1 } = this.newLayer('grass', h - gh, h, amp);
    const n = Math.round((x1 - x0) * gh / (95 * s * s) * 0.9);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0), depth = R(), base = y1 + 4 * s, bh = (22 + depth * 78) * s * (0.6 + R() * 0.6);
      const lean = (R() - 0.4) * bh * 0.32, tipY = base - bh - R() * 8 * s;
      const warm = R() < 0.22;
      const g = ctx.createLinearGradient(0, base, 0, tipY);
      g.addColorStop(0, '#0c1c18'); g.addColorStop(0.45, warm ? '#2a4a30' : '#173828'); g.addColorStop(1, warm ? 'rgba(235,205,120,0.95)' : 'rgba(150,190,96,0.9)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, (1.3 + R() * 1.7) * s * (0.6 + depth * 0.8));
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + lean * 0.2, base - bh * 0.6, x + lean, tipY); ctx.stroke();
    }
    // a few seed heads / flowers poking out
    for (let i = 0; i < 140; i++) {
      const x = x0 + R() * (x1 - x0), y = y1 - (30 + R() * 80) * s, r = (1.4 + R() * 2) * s;
      ctx.fillStyle = ['#fff2c0', '#ffd870', '#ff9a8a', '#f4e8ff'][Math.floor(R() * 4)]; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const slices = 30, sw = (x1 - x0) / slices;
    L.custom = (c, t, ox) => {
      for (let i = 0; i < slices; i++) {
        const k = Math.sin(t * 1.15 + i * 0.52 + Math.sin(t * 0.33 + i * 0.2) * 1.4) * 0.05;
        c.save();
        c.translate(L.x + ox + i * sw, L.y + L.h);
        c.transform(1, 0, k, 1, 0, 0);
        c.drawImage(L.canvas, i * sw * rs, 0, sw * rs, L.h * rs, 0, -L.h, sw + 0.6, L.h);
        c.restore();
      }
    };
  }

  buildOverlays() {
    const { w, h, s } = this;
    this.vig = null; this.grade = null;
    const m = mk(32, 32), mc = m.getContext('2d');
    const g = mc.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.3, 'rgba(255,214,140,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    mc.fillStyle = g; mc.fillRect(0, 0, 32, 32);
    this.mote = m;
    const R = rng(77);
    this.motes = Array.from({ length: 38 }, () => ({ x: R(), y: 0.55 + R() * 0.45, sp: 3 + R() * 9, ph: R() * 6.28, sz: 3 + R() * 6, tw: 0.4 + R() * 1.2 }));
    this.flocks = [
      { n: 7, y: 0.25, x0: 0.05, v: 22, sz: 7.5, ph: 0.3, vee: 1 },
      { n: 5, y: 0.17, x0: 0.62, v: 17, sz: 6, ph: 1.7, vee: 1 },
      { n: 3, y: 0.34, x0: 0.35, v: 26, sz: 9.5, ph: 2.9, vee: 0 },
    ];
  }

  // ---------------------------------------------------------------- per frame (only drawImage + a few tiny shapes: gradients are baked)
  draw(ctx, t) {
    const { w, h, s, yH } = this;
    ctx.drawImage(this.sky.canvas, 0, 0, w, this.sky.h);
    if (this.sky.h < h) { ctx.fillStyle = '#ffdfa8'; ctx.fillRect(0, this.sky.h, w, h - this.sky.h); }
    // stars
    ctx.fillStyle = '#ffffff';
    for (const st of this.stars) {
      const a = 0.55 * (1 - st.y / 0.36) * (0.6 + 0.4 * Math.sin(t * st.sp + st.ph));
      if (a < 0.03) continue;
      const sz = st.r * Math.max(0.8, s) * 1.6;
      ctx.globalAlpha = a; ctx.fillRect(st.x * w - sz / 2, st.y * h - sz / 2, sz, sz);
    }
    // soft god rays (pre-rendered sprite, gently swaying), clipped to the sky
    if (!this.raySprite) this.raySprite = makeRaySprite();
    const Rr = w * 0.8;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, yH + 4); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(this.sunX, this.sunY); ctx.rotate(0.06 * Math.sin(t * 0.07));
    ctx.globalAlpha = 0.62 + 0.2 * Math.sin(t * 0.31);
    ctx.drawImage(this.raySprite, -Rr, -Rr, Rr * 2, Rr * 2);
    ctx.restore();
    ctx.drawImage(this.sunSprite.canvas, this.sunX - this.sunSprite.r, this.sunY - this.sunSprite.r, this.sunSprite.r * 2, this.sunSprite.r * 2);
    // clouds
    for (const c of this.clouds) {
      const span = w + c.w, x = ((c.x0 + t * c.speed) % span) - c.w;
      if (x > w || x + c.w < 0) continue;
      ctx.globalAlpha = c.alpha; ctx.drawImage(c.canvas, x, c.y, c.w, c.h);
    }
    ctx.globalAlpha = 1;
    this.drawFlocks(ctx, t, 0);
    // parallax layers (snapped to device pixels so the layers stay sharp)
    const pan = Math.sin(t * 0.05), r = this.dpr;
    for (const L of this.layers) {
      const ox = Math.round(L.amp * pan * r) / r;
      if (L.custom) L.custom(ctx, t, ox); else ctx.drawImage(L.canvas, L.x + ox, L.y, L.w, L.h);
      for (const d of L.dyn) d(ctx, t, ox);
    }
    // motes
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const x = ((m.x * w + t * m.sp + Math.sin(t * 0.4 + m.ph) * 20 * s) % (w + 40)) - 20, y = h * m.y - ((t * m.sp * 0.4) % (h * 0.25)) + Math.sin(t * 0.7 + m.ph) * 10 * s;
      const a = 0.35 + 0.35 * Math.sin(t * m.tw + m.ph), sz = m.sz * s * 2.2;
      ctx.globalAlpha = Math.max(0, a); ctx.drawImage(this.mote, x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.restore();
    ctx.drawImage(this.vigImg, 0, 0, w, h);
  }

  drawFlocks(ctx, t, pass) {
    const { w, h, s } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(38,26,52,0.88)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const f of this.flocks) {
      const span = w + 200 * s, bx = ((f.x0 * span + t * f.v * s) % span) - 100 * s, by = h * f.y + Math.sin(t * 0.25 + f.ph) * 10 * s;
      for (let i = 0; i < f.n; i++) {
        const row = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
        const x = bx - Math.abs(row) * 14 * s * f.vee - (f.vee ? 0 : i * 22 * s), y = by + row * 7 * s * f.vee + (f.vee ? 0 : Math.sin(i * 2) * 8 * s);
        const sz = f.sz * s, fl = Math.sin(t * 7.5 + i * 1.3 + f.ph), wy = fl * sz * 0.9;
        ctx.lineWidth = Math.max(1, sz * 0.2);
        ctx.beginPath(); ctx.moveTo(x - sz, y - wy * 0.2 + sz * 0.15); ctx.quadraticCurveTo(x - sz * 0.5, y - sz * 0.45 - wy, x, y);
        ctx.quadraticCurveTo(x + sz * 0.5, y - sz * 0.45 - wy, x + sz, y - wy * 0.2 + sz * 0.15); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
