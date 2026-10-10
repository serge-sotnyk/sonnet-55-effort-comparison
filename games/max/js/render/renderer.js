// World renderer: terrain, sorted entities, effects, fog of war and overlays.
import * as art from '../art/index.js';
import { PLAYER_COLORS } from '../data/constants.js';
import { OCEAN_COLOR } from './terrain.js';

const FOG_MARGIN = 40;
const CARRY_NULL = null;

export class FogLayer {
  constructor(w, h) {
    this.w = w; this.h = h; this.margin = FOG_MARGIN;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w + FOG_MARGIN * 2; this.canvas.height = h + FOG_MARGIN * 2;
    this.ctx2 = this.canvas.getContext('2d', { willReadFrequently: true });
    this.img = this.ctx2.createImageData(this.canvas.width, this.canvas.height);
    this.d32 = new Uint32Array(this.img.data.buffer);
    this.a = new Float32Array(w * h).fill(1);
    this.lastVersion = -1; this.acc = 0; this.animating = true;
  }
  update(vision, dt, force) {
    this.acc += dt;
    if (!force && this.acc < 0.07) return;
    if (!force && vision.version === this.lastVersion && !this.animating) { this.acc = 0; return; }
    const step = Math.min(1, this.acc * 7); this.acc = 0;
    const { w, h, a } = this;
    let anim = false;
    const vis = vision.visible, exp = vision.explored;
    for (let i = 0; i < w * h; i++) {
      const target = vis[i] ? 0 : exp[i] ? 0.5 : 1;
      const cur = a[i];
      if (cur !== target) {
        let n = cur + (target - cur) * (force ? 1 : step);
        if (Math.abs(n - target) < 0.02) n = target; else anim = true;
        a[i] = n;
      }
    }
    this.animating = anim; this.lastVersion = vision.version;
    const cw = this.canvas.width, ch = this.canvas.height, M = this.margin, d32 = this.d32;
    for (let y = 0; y < ch; y++) {
      const sy = Math.min(h - 1, Math.max(0, y - M));
      for (let x = 0; x < cw; x++) {
        const sx = Math.min(w - 1, Math.max(0, x - M));
        const al = (a[sy * w + sx] * 255) | 0;
        // dark navy tint for "explored" shade, pure black for unexplored
        d32[y * cw + x] = (al << 24) | (0x16 << 16 | 0x0c << 8 | 0x08);
      }
    }
    this.ctx2.putImageData(this.img, 0, 0);
  }
}

const ANIM_FPS = { chop: 7, mine: 7, farm: 5, forage: 6, butcher: 6, build: 7 };
const HIT_FRAME = 3;
const OPTS = { carry: CARRY_NULL, variant: 0 };
const BSTATE = { build: undefined, frame: 0, mask: 0, open: false, axis: 'x', fill: 1 };

export class Renderer {
  constructor(canvas, game, cam, terrain, fx, feedback) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game; this.cam = cam; this.terrain = terrain; this.fx = fx; this.feedback = feedback;
    this.fog = new FogLayer(game.w, game.h);
    this.dpr = 1;
    this.drawn = [];
    this.meta = [];
    this.ghostCache = new Map();
    this.time = 0;
    this.stats = { entities: 0, ms: 0 };
  }

  resize(cssW, cssH, dpr) {
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr); this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
    this.cam.vw = cssW; this.cam.vh = cssH;
  }

  snap(v) { return Math.round(v * this.dpr) / this.dpr; }

  // ============================================================ frame
  render(alpha, view, dtReal) {
    const t0 = performance.now();
    const ctx = this.ctx, cam = this.cam, g = this.game, dpr = this.dpr;
    this.time += dtReal;
    const z = cam.zoom;
    const bounds = cam.worldBounds(4);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = OCEAN_COLOR; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.terrain.drawGround(ctx, cam, dpr, bounds);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';     // 'high' halves the frame rate at Retina resolution
    const vw = cam.vw, vh = cam.vh;
    const vis = g.vision;
    const human = g.humanIndex;
    this.drawn.length = 0;

    // ---------------------------------------------------- ground clutter
    const metas = this.terrain.visibleMeta(bounds, this.meta);
    for (const m of metas) {
      for (const d of m.decor) {
        if (d.x < bounds.x0 || d.x > bounds.x1 || d.y < bounds.y0 || d.y > bounds.y1) continue;
        const sp = art.getDecorSprite(d.k, d.v);
        const sx = ((d.x - d.y) * 32 - cam.x) * z + vw / 2, sy = ((d.x + d.y) * 16 - cam.y) * z + vh / 2;
        if (sx < -40 || sx > vw + 40 || sy < -40 || sy > vh + 40) continue;
        ctx.drawImage(sp.canvas, this.snap(sx - sp.ax * z), this.snap(sy - sp.ay * z), sp.w * z, sp.h * z);
      }
      for (const s of m.sparkle) {
        if (s.x < bounds.x0 || s.x > bounds.x1 || s.y < bounds.y0 || s.y > bounds.y1) continue;
        const sx = ((s.x - s.y) * 32 - cam.x) * z + vw / 2, sy = ((s.x + s.y) * 16 - cam.y) * z + vh / 2;
        if (sx < -10 || sx > vw + 10 || sy < -10 || sy > vh + 10) continue;
        const ph = Math.sin(this.time * 1.4 + s.p);
        if (ph < 0.1) continue;
        ctx.globalAlpha = (s.deep ? 0.22 : 0.4) * ph;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 3 * z, sy, 6 * z, 1.2 * z);
        if (ph > 0.6) ctx.fillRect(sx - 1.5 * z, sy - 1.2 * z, 3 * z, 1.1 * z);
      }
    }
    ctx.globalAlpha = 1;
    // stumps
    for (let i = g.stumps.length - 1; i >= 0; i--) {
      const s = g.stumps[i];
      if (s.x < bounds.x0 || s.x > bounds.x1 || s.y < bounds.y0 || s.y > bounds.y1) continue;
      if (!vis.isExplored(s.x, s.y)) continue;
      const sp = art.getResourceSprite('stump', s.v, 1);
      const sx = ((s.x - s.y) * 32 - cam.x) * z + vw / 2, sy = ((s.x + s.y) * 16 - cam.y) * z + vh / 2;
      ctx.drawImage(sp.canvas, this.snap(sx - sp.ax * z), this.snap(sy - sp.ay * z), sp.w * z, sp.h * z);
    }

    // ---------------------------------------------------- collect drawables
    const items = [];
    const farms = [];
    // buildings
    for (const b of g.buildings) {
      if (b.dead) continue;
      if (b.x < bounds.x0 - b.size || b.x > bounds.x1 + b.size || b.y < bounds.y0 - b.size || b.y > bounds.y1 + b.size) continue;
      const mine = b.owner === human || g.isAllied(b.owner, human);
      if (!mine) {
        if (!vis.isExplored(b.x, b.y)) continue;
        if (!b.seen) { if (vis.isVisible(human, b.x, b.y)) b.seen = true; else continue; }
      } else b.seen = true;
      if (b.def.flat) farms.push(b);
      else items.push({ k: b.x + b.y + (b.size > 1 ? 0.01 : 0), e: b, t: 1 });
    }
    // resources
    for (const r of g.resources) {
      if (r.x < bounds.x0 || r.x > bounds.x1 || r.y < bounds.y0 || r.y > bounds.y1) continue;
      if (!vis.explored[r.ty * g.w + r.tx]) continue;
      items.push({ k: r.x + r.y, e: r, t: 2 });
    }
    // units
    const dt01 = alpha;
    for (const u of g.units) {
      if (u.dead || u.garrison) continue;
      if (u.x < bounds.x0 || u.x > bounds.x1 || u.y < bounds.y0 || u.y > bounds.y1) continue;
      const mine = u.owner === human || g.isAllied(u.owner, human);
      if (!mine && !vis.isVisible(human, u.x, u.y)) continue;
      const ix = u.px + (u.x - u.px) * dt01, iy = u.py + (u.y - u.py) * dt01;
      u._ix = ix; u._iy = iy;
      items.push({ k: ix + iy + 0.001, e: u, t: 3 });
    }
    // projectiles
    for (const p of g.projectiles) {
      if (p.x < bounds.x0 || p.x > bounds.x1 || p.y < bounds.y0 || p.y > bounds.y1) continue;
      items.push({ k: p.x + p.y + 0.3, e: p, t: 4 });
    }

    // flat things first (farms), then corpses
    farms.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const b of farms) this.drawBuilding(ctx, b, view);
    for (const c of g.corpses) {
      if (c.x < bounds.x0 || c.x > bounds.x1 || c.y < bounds.y0 || c.y > bounds.y1) continue;
      if (!vis.isVisible(human, c.x, c.y) && c.owner !== human) continue;
      this.drawCorpse(ctx, c);
    }

    // ---------------------------------------------------- ground overlays (selection / ghost / rally)
    this.drawGroundOverlays(ctx, view, alpha);

    // ---------------------------------------------------- sorted pass
    items.sort((a, b) => a.k - b.k);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      switch (it.t) {
        case 1: this.drawBuilding(ctx, it.e, view); break;
        case 2: this.drawResource(ctx, it.e, view); break;
        case 3: this.drawUnit(ctx, it.e, view); break;
        case 4: this.drawProjectile(ctx, it.e); break;
      }
    }
    this.stats.entities = items.length;

    // ---------------------------------------------------- placement ghost (above entities)
    if (view.ghost) this.drawGhost(ctx, view.ghost);
    if (view.wallGhosts) for (const gh of view.wallGhosts) this.drawGhost(ctx, gh, true);

    // ---------------------------------------------------- effects
    this.fx.draw(ctx, cam, bounds);

    // ---------------------------------------------------- fog of war
    this.fog.update(vis, dtReal, this._forceFog);
    this._forceFog = false;
    {
      const zz = cam.zoom * dpr, a = 32 * zz, b = 16 * zz;
      const e = ((0 - cam.x) * cam.zoom + cam.vw / 2) * dpr, f = ((0 - cam.y) * cam.zoom + cam.vh / 2) * dpr;
      ctx.setTransform(a, b, -a, b, e, f);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.fog.canvas, -FOG_MARGIN, -FOG_MARGIN);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---------------------------------------------------- overlays (bars, markers)
    this.drawBars(ctx, view);
    this.drawMarkers(ctx, view, dtReal);
    this.stats.ms = performance.now() - t0;
  }

  // ============================================================ entity drawing
  drawUnit(ctx, u, view) {
    const cam = this.cam, z = cam.zoom, g = this.game, def = u.def;
    const ix = u._ix, iy = u._iy;
    const sx = ((ix - iy) * 32 - cam.x) * z + cam.vw / 2, sy = ((ix + iy) * 16 - cam.y) * z + cam.vh / 2;
    if (sx < -80 || sx > cam.vw + 80 || sy < -80 || sy > cam.vh + 120) return;
    const pl = g.players[u.owner];
    const color = u.owner === 0 ? 0 : pl.color;
    let anim = u.anim, frame = 0;
    const n = art.animFrames(u.type, anim);
    switch (anim) {
      case 'walk': frame = Math.floor(u.animT * Math.min(26, Math.max(6, def.speed * (u.slow || 1) * 12))) % n; break;
      case 'attack': frame = u.attackT >= 0 ? Math.min(n - 1, Math.floor(u.attackT / def.attackDur * n)) : 0; break;
      case 'idle': frame = n > 1 ? Math.floor(u.animT * 2) % n : 0; break;
      default: frame = Math.floor(u.animT * (ANIM_FPS[anim] || 6)) % n;
    }
    // work-hit feedback (sound / chips) when the animation passes its impact frame
    if (this.feedback && (anim === 'chop' || anim === 'mine' || anim === 'build' || anim === 'farm' || anim === 'forage' || anim === 'butcher')) {
      if (frame === HIT_FRAME && u._lf !== HIT_FRAME) this.feedback.workHit(u, anim);
      u._lf = frame;
    } else u._lf = -1;
    OPTS.carry = (u.carry >= 1 && u.type === 'villager') ? u.carryType : null;
    OPTS.variant = u.variant;
    const sp = art.getUnitSprite(u.type, color, u.dir, anim, frame, OPTS);
    // shadow
    const sr = (def.radius + 0.12) * 34 * z;
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx, sy + 1 * z, sr, sr * 0.5, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    const dx = this.snap(sx - sp.ax * z), dy = this.snap(sy - sp.ay * z);
    // converted / flashing
    ctx.drawImage(sp.canvas, dx, dy, sp.w * z, sp.h * z);
    u._hit = [dx, dy, dx + sp.w * z, dy + sp.h * z, sx, sy];
    this.drawn.push(u);
  }

  drawCorpse(ctx, c) {
    const cam = this.cam, z = cam.zoom, g = this.game;
    const age = g.time - c.t0;
    const sx = ((c.x - c.y) * 32 - cam.x) * z + cam.vw / 2, sy = ((c.x + c.y) * 16 - cam.y) * z + cam.vh / 2;
    if (sx < -80 || sx > cam.vw + 80 || sy < -80 || sy > cam.vh + 80) return;
    const n = art.animFrames(c.type, 'death');
    const color = c.owner === 0 ? 0 : g.players[c.owner].color;
    let anim = 'death', frame = Math.min(n - 1, Math.floor(age / 0.9 * n));
    if (age >= 0.9) { anim = 'corpse'; frame = 0; }
    OPTS.carry = null; OPTS.variant = c.variant || 0;
    const sp = art.getUnitSprite(c.type, color, c.dir, anim, frame, OPTS);
    ctx.globalAlpha = age > 11 ? Math.max(0, 1 - (age - 11) / 3) : 1;
    ctx.drawImage(sp.canvas, this.snap(sx - sp.ax * z), this.snap(sy - sp.ay * z), sp.w * z, sp.h * z);
    ctx.globalAlpha = 1;
  }

  drawBuilding(ctx, b, view) {
    const cam = this.cam, z = cam.zoom, g = this.game;
    const pl = g.players[b.owner];
    const st = BSTATE;
    st.build = b.built ? undefined : b.progress;
    const af = art.buildingAnimFrames(b.type);
    st.frame = af > 1 ? Math.floor(this.time * 7) % af : 0;
    st.mask = b.mask || 0; st.open = !!b.open; st.axis = b.axis; st.fill = b.type === 'farm' ? (b.maxAmount ? Math.max(0, b.amount / b.maxAmount) : 1) : 1;
    const sp = art.getBuildingSprite(b.type, pl.color, pl.age, st);
    const sx = ((b.x - b.y) * 32 - cam.x) * z + cam.vw / 2, sy = ((b.x + b.y) * 16 - cam.y) * z + cam.vh / 2;
    const dx = this.snap(sx - sp.ax * z), dy = this.snap(sy - sp.ay * z);
    if (dx > cam.vw + 20 || dy > cam.vh + 20 || dx + sp.w * z < -20 || dy + sp.h * z < -20) return;
    ctx.drawImage(sp.canvas, dx, dy, sp.w * z, sp.h * z);
    b._hit = [dx, dy, dx + sp.w * z, dy + sp.h * z, sx, sy];
    b._sp = sp;
    this.drawn.push(b);
    // damage fire & construction dust handled in feedback (needs real dt)
    if (this.feedback) this.feedback.buildingVisible(b, sx, sy, sp);
  }

  drawResource(ctx, r, view) {
    const cam = this.cam, z = cam.zoom;
    const sx = ((r.x - r.y) * 32 - cam.x) * z + cam.vw / 2, sy = ((r.x + r.y) * 16 - cam.y) * z + cam.vh / 2;
    if (sx < -90 || sx > cam.vw + 90 || sy < -60 || sy > cam.vh + 140) return;
    let kind = r.sub, fill = r.max ? r.amount / r.max : 1;
    if (kind === 'gold') kind = 'gold_mine'; else if (kind === 'stone') kind = 'stone_mine'; else if (kind === 'carcass') kind = 'carcass_' + (r.animal || 'deer');
    const sp = art.getResourceSprite(kind, r.variant, fill);
    const dx = this.snap(sx - sp.ax * z), dy = this.snap(sy - sp.ay * z);
    ctx.drawImage(sp.canvas, dx, dy, sp.w * z, sp.h * z);
    r._hit = [dx, dy, dx + sp.w * z, dy + sp.h * z, sx, sy];
    r._sp = sp;
    this.drawn.push(r);
  }

  drawProjectile(ctx, p) {
    const cam = this.cam, z = cam.zoom;
    const ix = p.px + (p.x - p.px) * 0.5, iy = p.py + (p.y - p.py) * 0.5;
    const tt = Math.min(1, p.t);
    const hgt = (4 * p.arc * tt * (1 - tt)) * 32 + p.z0 * (1 - tt) + 6;
    const sx = ((ix - iy) * 32 - cam.x) * z + cam.vw / 2, sy = ((ix + iy) * 16 - hgt - cam.y) * z + cam.vh / 2;
    // ground shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sx, sy + hgt * z, 3 * z, 1.5 * z, 0, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
    // direction on screen
    const dtt = 0.04, t2 = Math.min(1, tt + dtt);
    const hgt2 = (4 * p.arc * t2 * (1 - t2)) * 32 + p.z0 * (1 - t2) + 6;
    const nx = p.sx + (p.ex - p.sx) * t2, ny = p.sy + (p.ey - p.sy) * t2;
    const sx2 = ((nx - ny) * 32 - cam.x) * z + cam.vw / 2, sy2 = ((nx + ny) * 16 - hgt2 - cam.y) * z + cam.vh / 2;
    let dx = sx2 - sx, dy = sy2 - sy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    switch (p.type) {
      case 'arrow': case 'javelin': case 'bolt': {
        const len = (p.type === 'bolt' ? 15 : p.type === 'javelin' ? 13 : 11) * z;
        ctx.lineWidth = (p.type === 'bolt' ? 2.2 : 1.4) * z; ctx.lineCap = 'round';
        ctx.strokeStyle = p.type === 'javelin' ? '#8b6a3d' : '#3a2a18';
        ctx.beginPath(); ctx.moveTo(sx - dx * len, sy - dy * len); ctx.lineTo(sx, sy); ctx.stroke();
        ctx.strokeStyle = '#e8e8e0'; ctx.lineWidth = 1.6 * z; ctx.beginPath(); ctx.moveTo(sx - dx * 2 * z, sy - dy * 2 * z); ctx.lineTo(sx + dx * 1.5 * z, sy + dy * 1.5 * z); ctx.stroke();
        break;
      }
      case 'axe': {
        const a = this.time * 22;
        ctx.strokeStyle = '#6b4a28'; ctx.lineWidth = 1.6 * z; ctx.beginPath();
        ctx.moveTo(sx - Math.cos(a) * 5 * z, sy - Math.sin(a) * 5 * z); ctx.lineTo(sx + Math.cos(a) * 5 * z, sy + Math.sin(a) * 5 * z); ctx.stroke();
        ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * 5 * z, sy + Math.sin(a) * 5 * z, 2.4 * z, 0, 6.2832); ctx.fill();
        break;
      }
      case 'stone': case 'bigstone': {
        const r = (p.type === 'bigstone' ? 6 : 4.5) * z;
        const g2 = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r);
        g2.addColorStop(0, '#b8b2a4'); g2.addColorStop(1, '#5a554b');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        break;
      }
    }
  }

  // ============================================================ ground overlays
  drawGroundOverlays(ctx, view, alpha) {
    const cam = this.cam, z = cam.zoom, g = this.game;
    const sel = view.selected;
    // hover highlight
    if (view.hover) {
      const e = g.byId.get(view.hover);
      if (e && !e.dead && !(e.kind === 'unit' && e.garrison) && !sel.has(e.id)) this.ringFor(ctx, e, 'rgba(255,255,255,0.55)', 1.2, alpha);
    }
    for (const id of sel) {
      const e = g.byId.get(id);
      if (!e || e.dead || (e.kind === 'unit' && e.garrison)) continue;
      const own = e.owner === g.humanIndex;
      const col = own ? '#9dff9d' : e.owner === 0 ? '#ffe27a' : '#ff6a5a';
      this.ringFor(ctx, e, col, 1.8, alpha);
      // rally point line for production buildings
      if (e.kind === 'building' && own && e.rally && e.built) {
        const a = this.cam.worldToScreen(e.x, e.y), b = this.cam.worldToScreen(e.rally.x, e.rally.y);
        ctx.strokeStyle = 'rgba(120,255,120,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#58e058'; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - 16 * z); ctx.lineTo(b[0] + 10 * z, b[1] - 12 * z); ctx.lineTo(b[0], b[1] - 8 * z); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0a3a0a'; ctx.lineWidth = 1; ctx.stroke();
      }
      // current destination of selected own units
      if (e.kind === 'unit' && own && e.order && (e.order.type === 'move' || e.order.type === 'attackmove') && view.showPaths) {
        const a = cam.worldToScreen(e.x, e.y), b = cam.worldToScreen(e.order.x, e.order.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
  }

  ringFor(ctx, e, col, lw, alpha) {
    const cam = this.cam, z = cam.zoom;
    ctx.strokeStyle = col; ctx.lineWidth = lw * Math.max(1, z);
    if (e.kind === 'unit') {
      const ix = e._ix !== undefined ? e._ix : e.x, iy = e._iy !== undefined ? e._iy : e.y;
      const sx = ((ix - iy) * 32 - cam.x) * z + cam.vw / 2, sy = ((ix + iy) * 16 - cam.y) * z + cam.vh / 2;
      const r = (e.def.radius + 0.28) * 36 * z;
      ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.52, 0, 0, 6.2832); ctx.stroke();
    } else {
      const s = e.size, x0 = e.tx, y0 = e.ty;
      const p = (x, y) => cam.worldToScreen(x, y);
      const a = p(x0, y0), b = p(x0 + s, y0), c = p(x0 + s, y0 + s), d = p(x0, y0 + s);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.stroke();
    }
  }

  drawGhost(ctx, gh, small) {
    const cam = this.cam, z = cam.zoom, g = this.game;
    const pl = g.players[g.humanIndex];
    const def = pl.bdefs[gh.type];
    const size = def.size;
    const cx = gh.tx + size / 2, cy = gh.ty + size / 2;
    const sx = ((cx - cy) * 32 - cam.x) * z + cam.vw / 2, sy = ((cx + cy) * 16 - cam.y) * z + cam.vh / 2;
    // footprint
    const col = gh.ok ? 'rgba(80,255,120,0.38)' : 'rgba(255,70,60,0.42)';
    const p = (x, y) => cam.worldToScreen(x, y);
    const a = p(gh.tx, gh.ty), b = p(gh.tx + size, gh.ty), c = p(gh.tx + size, gh.ty + size), d = p(gh.tx, gh.ty + size);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = gh.ok ? '#8dff9d' : '#ff6a5a'; ctx.lineWidth = 1.5; ctx.stroke();
    // translucent building sprite tinted by validity
    const st = { build: undefined, frame: 0, mask: gh.mask || 0, open: false, axis: gh.axis || 'x', fill: 1 };
    const sp = art.getBuildingSprite(gh.type, pl.color, pl.age, st);
    const key = gh.type + (gh.ok ? 'g' : 'r') + pl.age + (st.mask) + st.axis;
    let tinted = this.ghostCache.get(key);
    if (!tinted) {
      const cv = document.createElement('canvas'); cv.width = sp.canvas.width; cv.height = sp.canvas.height;
      const c2 = cv.getContext('2d', { willReadFrequently: true }); c2.drawImage(sp.canvas, 0, 0);
      c2.globalCompositeOperation = 'source-atop'; c2.fillStyle = gh.ok ? 'rgba(60,255,110,0.28)' : 'rgba(255,60,50,0.4)'; c2.fillRect(0, 0, cv.width, cv.height);
      tinted = cv; this.ghostCache.set(key, cv);
    }
    ctx.globalAlpha = small ? 0.7 : 0.78;
    ctx.drawImage(tinted, this.snap(sx - sp.ax * z), this.snap(sy - sp.ay * z), sp.w * z, sp.h * z);
    ctx.globalAlpha = 1;
  }

  // ============================================================ overlays
  drawBars(ctx, view) {
    const cam = this.cam, z = cam.zoom, g = this.game;
    const sel = view.selected;
    for (const e of this.drawn) {
      const showAll = view.showAllBars;
      const isSel = sel.has(e.id);
      if (e.kind === 'resource') continue;
      const damaged = e.hp < e.maxHp - 0.5;
      const recentlyHit = g.time - e.lastHitT < 4;
      if (!(isSel || showAll || (damaged && (recentlyHit || e.kind === 'building' && e.hp < e.maxHp * 0.7)) || view.hover === e.id)) {
        // construction progress bar
        if (!(e.kind === 'building' && !e.built)) continue;
      }
      const h = e._hit; if (!h) continue;
      if (e.kind === 'unit') {
        const w = 26 * Math.max(0.8, z), bx = h[4] - w / 2, by = h[1] + 2 * z - 3;
        this.bar(ctx, bx, by, w, 4, e.hp / e.maxHp, e.owner === 0 ? 0 : 1);
      } else {
        const w = Math.min(90, (30 + e.size * 18)) * Math.max(0.8, z), bx = h[4] - w / 2, by = Math.max(h[1] - 8, h[5] - (e.size * 16 * z) - 40 * z);
        if (!e.built) {
          this.bar(ctx, bx, by + 7, w, 5, e.progress, 2);
        }
        if (isSel || showAll || damaged) this.bar(ctx, bx, by, w, 6, e.hp / e.maxHp, 1);
      }
    }
  }
  bar(ctx, x, y, w, h, f, kind) {
    f = Math.max(0, Math.min(1, f));
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = kind === 2 ? '#e8b030' : (f > 0.6 ? '#4fd04a' : f > 0.3 ? '#e6c63a' : '#e0432e');
    ctx.fillRect(x, y, w * f, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, w * f, Math.max(1, h * 0.35));
  }

  drawMarkers(ctx, view, dt) {
    const cam = this.cam, z = cam.zoom;
    const ms = view.markers;
    for (let i = ms.length - 1; i >= 0; i--) {
      const m = ms[i]; m.t += dt;
      if (m.t > 0.9) { ms.splice(i, 1); continue; }
      const p = cam.worldToScreen(m.x, m.y);
      const t = m.t / 0.9;
      ctx.strokeStyle = m.kind === 'attack' ? `rgba(255,80,60,${1 - t})` : m.kind === 'gather' ? `rgba(255,230,120,${1 - t})` : `rgba(140,255,150,${1 - t})`;
      ctx.lineWidth = 2;
      const r = (14 - t * 8) * z;
      ctx.beginPath(); ctx.ellipse(p[0], p[1], r, r * 0.5, 0, 0, 6.2832); ctx.stroke();
      if (m.kind === 'attack') { ctx.beginPath(); ctx.moveTo(p[0] - 5 * z, p[1] - 3 * z); ctx.lineTo(p[0] + 5 * z, p[1] + 3 * z); ctx.moveTo(p[0] + 5 * z, p[1] - 3 * z); ctx.lineTo(p[0] - 5 * z, p[1] + 3 * z); ctx.stroke(); }
    }
  }

  // ============================================================ picking
  /** Topmost entity under the screen point (CSS px), or null. mode: 'any' | 'unit' */
  pick(sx, sy, opts = {}) {
    const cam = this.cam, z = cam.zoom, g = this.game;
    const wp = cam.screenToWorld(sx, sy);
    const d = this.drawn;
    // units first (they are small and drawn on top): test by sprite rect core
    let best = null, bk = -1e9;
    for (let i = d.length - 1; i >= 0; i--) {
      const e = d[i], h = e._hit;
      if (!h) continue;
      if (e.kind === 'unit') {
        if (e.dead || e.garrison) continue;
        const cx = h[4], baseY = h[5];
        const hw = Math.max(11, e.def.radius * 36) * z * 0.9, top = (h[5] - h[1]) * 0.92;
        if (sx >= cx - hw && sx <= cx + hw && sy >= baseY - top && sy <= baseY + 7 * z) { best = e; break; }
      }
    }
    if (best && !opts.preferBuilding) return best;
    // buildings/resources: pixel-accurate test, topmost first
    for (let i = d.length - 1; i >= 0; i--) {
      const e = d[i], h = e._hit;
      if (!h || e.kind === 'unit') continue;
      if (sx < h[0] || sx > h[2] || sy < h[1] || sy > h[3]) continue;
      if (e.kind === 'building' && e._sp) {
        // inside footprint -> hit
        if (wp.x >= e.tx && wp.x <= e.tx + e.size && wp.y >= e.ty && wp.y <= e.ty + e.size) return e;
      }
      const sp = e._sp;
      if (!sp) continue;
      if (this._alphaAt(sp, (sx - h[0]) / z, (sy - h[1]) / z) > 24) return e;
    }
    return best;
  }
  _alphaAt(sp, lx, ly) {
    const S = sp.canvas.width / sp.w;
    const px = Math.floor(lx * S), py = Math.floor(ly * S);
    if (px < 0 || py < 0 || px >= sp.canvas.width || py >= sp.canvas.height) return 0;
    if (!this._pc) { this._pc = document.createElement('canvas'); this._pc.width = 1; this._pc.height = 1; this._px = this._pc.getContext('2d', { willReadFrequently: true }); }
    const c = this._px; c.clearRect(0, 0, 1, 1);
    c.drawImage(sp.canvas, px, py, 1, 1, 0, 0, 1, 1);
    return c.getImageData(0, 0, 1, 1).data[3];
  }
  forceFogRefresh() { this._forceFog = true; }
}
