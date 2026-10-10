// Camera + isometric projection helpers (CSS-pixel space; the canvas applies devicePixelRatio itself).

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;            // iso-pixel coords (at zoom 1) of the viewport center
    this.zoom = 1;
    this.vw = 1280; this.vh = 720;     // viewport size in CSS px (world view area, excluding nothing: full canvas)
    this.minZoom = 0.55; this.maxZoom = 1.8;
    this.mapW = 100; this.mapH = 100;
    this.bottomInset = 0;              // px covered by the bottom HUD panel (look-at points are centered above it)
  }
  setMap(w, h) { this.mapW = w; this.mapH = h; }
  /** Center the camera on a world position. */
  lookAt(wx, wy) {
    this.x = (wx - wy) * 32;
    this.y = (wx + wy) * 16 + (this.bottomInset / 2) / this.zoom;
    this.clamp();
  }
  center() {                           // world position currently at the viewport center
    return this.screenToWorld(this.vw / 2, this.vh / 2);
  }
  worldToScreen(wx, wy, z = 0) {
    return [((wx - wy) * 32 - this.x) * this.zoom + this.vw / 2, ((wx + wy) * 16 - z - this.y) * this.zoom + this.vh / 2];
  }
  screenToWorld(sx, sy) {
    const X = (sx - this.vw / 2) / this.zoom + this.x, Y = (sy - this.vh / 2) / this.zoom + this.y;
    return { x: (X / 32 + Y / 16) / 2, y: (Y / 16 - X / 32) / 2 };
  }
  clamp() {
    // keep the viewport center inside the map diamond (with a little margin)
    const w = this.mapW, h = this.mapH, m = 4;
    // diamond: iso X in [-(h)*32, w*32], Y in [0,(w+h)*16]; constrain through world coordinates
    const wp = { x: (this.x / 32 + this.y / 16) / 2, y: (this.y / 16 - this.x / 32) / 2 };
    const cx = Math.min(Math.max(wp.x, -m), w + m), cy = Math.min(Math.max(wp.y, -m), h + m);
    if (cx !== wp.x || cy !== wp.y) { this.x = (cx - cy) * 32; this.y = (cx + cy) * 16; }
  }
  setZoom(z, anchorSx, anchorSy) {
    z = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    if (anchorSx !== undefined) {
      const before = this.screenToWorld(anchorSx, anchorSy);
      this.zoom = z;
      const after = this.screenToWorld(anchorSx, anchorSy);
      // shift so the anchor stays under the cursor
      this.x += ((before.x - before.y) - (after.x - after.y)) * 32;
      this.y += ((before.x + before.y) - (after.x + after.y)) * 16;
    } else this.zoom = z;
    this.clamp();
  }
  pan(dxScreen, dyScreen) {
    this.x += dxScreen / this.zoom; this.y += dyScreen / this.zoom;
    this.clamp();
  }
  /** World-space bounding box of the viewport (for culling). */
  worldBounds(pad = 2) {
    const c = [this.screenToWorld(0, 0), this.screenToWorld(this.vw, 0), this.screenToWorld(0, this.vh), this.screenToWorld(this.vw, this.vh)];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of c) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
}
