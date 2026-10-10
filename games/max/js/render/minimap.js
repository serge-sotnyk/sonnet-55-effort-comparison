// Isometric (diamond) minimap with terrain, resources, units, buildings, fog and the camera view outline.
import { PLAYER_COLORS } from '../data/constants.js';

export class Minimap {
  constructor(canvas, game, terrain) {
    this.canvas = canvas; this.game = game; this.terrain = terrain;
    this.ctx = canvas.getContext('2d');
    this.w = game.w; this.h = game.h;
    // static terrain image (1px per tile), drawn through the iso transform
    this.base = document.createElement('canvas'); this.base.width = this.w; this.base.height = this.h;
    const b = this.base.getContext('2d', { willReadFrequently: true }), img = b.createImageData(this.w, this.h);
    for (let i = 0; i < this.w * this.h; i++) { img.data[i * 4] = terrain.mini[i * 3]; img.data[i * 4 + 1] = terrain.mini[i * 3 + 1]; img.data[i * 4 + 2] = terrain.mini[i * 3 + 2]; img.data[i * 4 + 3] = 255; }
    b.putImageData(img, 0, 0);
    this.dyn = document.createElement('canvas'); this.dyn.width = this.w; this.dyn.height = this.h;   // trees / mines layer
    this.fog = document.createElement('canvas'); this.fog.width = this.w; this.fog.height = this.h;
    this.pings = [];
    this.lastRes = -1; this.lastFog = -1;
    this.resolve();
  }
  resolve() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.canvas.clientWidth || 260, ch = this.canvas.clientHeight || 130;
    if (this.canvas.width !== Math.round(cw * dpr)) { this.canvas.width = Math.round(cw * dpr); this.canvas.height = Math.round(ch * dpr); }
    this.dpr = dpr; this.cw = cw; this.ch = ch;
    // iso projection fit: iso X in [-h*32, w*32], Y in [0,(w+h)*16] -> canvas
    const isoW = (this.w + this.h) * 32, isoH = (this.w + this.h) * 16;
    this.k = Math.min(cw / isoW, ch / isoH);
    this.ox = (cw - isoW * this.k) / 2 + this.h * 32 * this.k;
    this.oy = (ch - isoH * this.k) / 2;
  }
  // map world tile coords -> minimap css px
  toMini(wx, wy) { return [this.ox + (wx - wy) * 32 * this.k, this.oy + (wx + wy) * 16 * this.k]; }
  fromMini(mx, my) {
    const X = (mx - this.ox) / this.k, Y = (my - this.oy) / this.k;
    return { x: (X / 32 + Y / 16) / 2, y: (Y / 16 - X / 32) / 2 };
  }
  ping(x, y, color = '#ff4040') { this.pings.push({ x, y, t: 0, color }); if (this.pings.length > 8) this.pings.shift(); }

  updateStaticLayers(fogCanvas) {
    const g = this.game;
    // resources layer: refreshed when resource count changes
    if (this.lastRes !== g.resources.length) {
      this.lastRes = g.resources.length;
      const c = this.dyn.getContext('2d', { willReadFrequently: true });
      c.clearRect(0, 0, this.w, this.h);
      for (const r of g.resources) {
        if (r.dead) continue;
        c.fillStyle = r.sub === 'tree' ? '#1f4a1c' : r.sub === 'gold' ? '#f2c230' : r.sub === 'stone' ? '#aeb0b0' : r.sub === 'berries' ? '#c43a5a' : '#b86a4a';
        c.fillRect(r.tx, r.ty, 1, 1);
      }
    }
  }

  draw(cam, fogCanvas, dt, selection) {
    this.resolve();
    const g = this.game, c = this.ctx, d = this.dpr;
    this.updateStaticLayers();
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, this.cw, this.ch);
    // diamond-shaped drawing through iso transform: unit square pixels -> parallelogram
    c.save();
    const a = 32 * this.k, b = 16 * this.k;
    c.setTransform(a * d, b * d, -a * d, b * d, this.ox * d, this.oy * d);
    c.imageSmoothingEnabled = false;
    // ocean backdrop (diamond fill)
    c.fillStyle = '#143f63'; c.fillRect(0, 0, this.w, this.h);
    c.drawImage(this.base, 0, 0);
    c.drawImage(this.dyn, 0, 0);
    // buildings and units as per-tile rects (drawn in tile space so they live inside the same transform)
    for (const bd of g.buildings) {
      if (bd.dead) continue;
      const mine = bd.owner === g.humanIndex || g.isAllied(bd.owner, g.humanIndex);
      if (!mine && !(g.vision.explored[Math.floor(bd.y) * g.w + Math.floor(bd.x)] && bd.seen)) continue;
      c.fillStyle = PLAYER_COLORS[g.players[bd.owner].color].main;
      c.fillRect(bd.tx, bd.ty, bd.size, bd.size);
    }
    c.restore();
    c.setTransform(d, 0, 0, d, 0, 0);
    // units as small dots (screen space)
    for (const u of g.units) {
      if (u.dead || u.garrison) continue;
      const mine = u.owner === g.humanIndex || g.isAllied(u.owner, g.humanIndex);
      if (!mine && !g.vision.isVisible(g.humanIndex, u.x, u.y)) continue;
      if (u.owner === 0 && !g.vision.isVisible(g.humanIndex, u.x, u.y)) continue;
      const p = this.toMini(u.x, u.y);
      c.fillStyle = u.owner === 0 ? '#c8b46a' : PLAYER_COLORS[g.players[u.owner].color].light;
      const s = u.def.tags.includes('animal') ? 1.2 : 2;
      if (u.owner === 0 && u.def.tags.includes('animal')) continue;
      c.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
    }
    // fog
    if (fogCanvas) {
      c.save();
      c.setTransform(a * d, b * d, -a * d, b * d, this.ox * d, this.oy * d);
      c.imageSmoothingEnabled = true;
      c.drawImage(fogCanvas.canvas, -fogCanvas.margin, -fogCanvas.margin);
      c.restore();
      c.setTransform(d, 0, 0, d, 0, 0);
    }
    // selection highlights
    if (selection && selection.size) {
      c.strokeStyle = '#ffffff'; c.lineWidth = 1;
      for (const id of selection) {
        const e = g.byId.get(id); if (!e || e.dead || (e.kind === 'unit' && e.garrison)) continue;
        const p = this.toMini(e.x, e.y); c.strokeRect(p[0] - 2, p[1] - 2, 4, 4);
      }
    }
    // pings
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i]; p.t += dt;
      if (p.t > 4) { this.pings.splice(i, 1); continue; }
      const m = this.toMini(p.x, p.y);
      const r = 3 + (p.t % 1) * 12;
      c.strokeStyle = p.color; c.globalAlpha = 1 - (p.t % 1); c.lineWidth = 2;
      c.beginPath(); c.arc(m[0], m[1], r, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
    // camera outline
    const vx0 = cam.x - cam.vw / 2 / cam.zoom, vx1 = cam.x + cam.vw / 2 / cam.zoom;
    const vy0 = cam.y - cam.vh / 2 / cam.zoom, vy1 = cam.y + (cam.vh - cam.bottomInset) / 2 / cam.zoom - cam.bottomInset / 2 / cam.zoom * 0;
    const mx0 = this.ox + vx0 * this.k, mx1 = this.ox + vx1 * this.k, my0 = this.oy + vy0 * this.k, my1 = this.oy + (cam.y + cam.vh / 2 / cam.zoom) * this.k;
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.2;
    c.beginPath(); c.rect(mx0, my0, mx1 - mx0, my1 - my0); c.stroke();
    // frame the diamond
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1;
    const tp = this.toMini(0, 0), rp = this.toMini(this.w, 0), bp = this.toMini(this.w, this.h), lp = this.toMini(0, this.h);
    c.beginPath(); c.moveTo(tp[0], tp[1]); c.lineTo(rp[0], rp[1]); c.lineTo(bp[0], bp[1]); c.lineTo(lp[0], lp[1]); c.closePath(); c.stroke();
  }
}
