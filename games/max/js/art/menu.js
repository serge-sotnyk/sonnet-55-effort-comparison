// Title-screen art: animated backdrop + large civilization emblems. See docs/ART_SPEC.md section 4.
import { renderIcon } from './icons_kit.js';
import { drawEmblem } from './menu_emblems.js';
import { Scene } from './menu_scene.js';

const emblemCache = new Map();
/** Large transparent heraldic emblem for the civ-select screen (default 128 px logical; canvas shared/cached). */
export function getCivEmblem(civId, size = 128) {
  size = Math.round(size) || 128;
  let m = emblemCache.get(civId);
  if (!m) { m = new Map(); emblemCache.set(civId, m); }
  let c = m.get(size);
  if (!c) {
    const surf = renderIcon(size, g => g.scaled(0.5, () => drawEmblem(g, civId, size >= 96 ? 1 : 0)), { shadow: 0.9 });
    c = surf.canvas; c.style.width = size + 'px'; c.style.height = size + 'px';
    m.set(size, c);
  }
  return c;
}

let scene = null, pendingSince = 0, lastSig = '';
const MAXPIX = 4.2e6;          // cap on the device pixels of one pre-rendered layer (keeps memory sane at 4K / high DPR)
/**
 * Animated title-screen backdrop filling w x h CSS px (any size/aspect, "cover" style); t = seconds.
 * Layers are pre-rendered once into offscreen canvases (rebuilt ~0.2 s after the size / pixel ratio stops changing; while a resize is in
 * progress the previous scene is stretched), so a frame is just a handful of drawImage calls (< 1 ms of main-thread time).
 * Draws at the current context transform (pass a ctx scaled by devicePixelRatio, as usual).
 */
export function drawMenuBackdrop(ctx, w, h, t) {
  let r = 1;
  try { const m = ctx.getTransform(); r = Math.max(1, Math.hypot(m.a, m.b)); } catch (e) { /* old browsers */ }
  const rs = Math.min(r, Math.sqrt(MAXPIX / (w * h)));
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const sig = w + 'x' + h + '@' + rs.toFixed(2);
  if (sig !== lastSig) { lastSig = sig; pendingSince = now; }
  const stale = !scene || scene.w !== w || scene.h !== h || Math.abs(scene.rs - rs) > 0.01;
  if (stale && (!scene || now - pendingSince > 200)) scene = new Scene(w, h, rs, r);
  if (scene.w === w && scene.h === h) { scene.draw(ctx, t); return; }
  // resize in progress: stretch the existing scene (cover) until the size settles
  const k = Math.max(w / scene.w, h / scene.h);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.translate((w - scene.w * k) / 2, (h - scene.h * k) / 2); ctx.scale(k, k);
  scene.draw(ctx, t);
  ctx.restore();
}
/** optional: pre-build the layers for a given CSS size / device pixel ratio (e.g. from the loading screen) so the first frame has no hitch */
export function warmMenuBackdrop(w, h, dpr = 1) {
  const rs = Math.min(dpr, Math.sqrt(MAXPIX / (w * h)));
  if (!scene || scene.w !== w || scene.h !== h || Math.abs(scene.rs - rs) > 0.01) scene = new Scene(w, h, rs, dpr);
  lastSig = w + 'x' + h + '@' + rs.toFixed(2); pendingSince = 0;
}
/** free the pre-rendered layers (call when leaving the menu) */
export function releaseMenuBackdrop() { scene = null; lastSig = ''; }
