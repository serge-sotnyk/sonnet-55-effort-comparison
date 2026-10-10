// Bust-style icons (48x48) and portraits (72x72): the unit rig is rendered large from a 3/4 view and framed on a painterly background.
import { makeCanvas, addOutline, drawScene, mixHex, shadeHex, TAU } from './units_core.js';
import { getSpriteScale } from './common.js';

const BG = {
  civilian: ['#a8bf6c', '#44602f'],
  infantry: ['#9ab0cf', '#2c3c5a'],
  ranged: ['#86b59c', '#2a4a40'],
  cavalry: ['#a29cd0', '#363463'],
  siege: ['#c9a068', '#553823'],
  monk: ['#b690d6', '#40285f'],
  animal: ['#b4cf86', '#3f5e33'],
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

/** S = built scene (buildOnly), cls = BG class, kind = human|mounted|beast|siege, d = registry def */
export function renderBust(S, size, team, tc, cls, kind, d) {
  const bg = BG[cls] || BG.infantry;
  const out = makeCanvas(size, size), ctx = out.ctx;
  // background: diagonal gradient + soft light blob behind the figure
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const gl = ctx.createRadialGradient(size * 0.42, size * 0.36, 1, size * 0.42, size * 0.36, size * 0.75);
  gl.addColorStop(0, 'rgba(255,248,220,0.38)'); gl.addColorStop(0.55, 'rgba(255,248,220,0.06)'); gl.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, size, size);
  // team colour ribbon at the bottom-left corner (portraits get a stronger one)
  // figure
  const fig = makeCanvas(size, size), fx = fig.ctx;
  let cx, cy, half;
  if (kind === 'siege') {
    const w = S.x1 - S.x0, h = S.y1 - S.y0;
    half = Math.max(w, h) * 0.5 + 3; cx = (S.x0 + S.x1) / 2; cy = (S.y0 + S.y1) / 2;
  } else if (kind === 'beast') {
    const h = S.headScr || [0, -16];
    const w = S.x1 - S.x0, hh = S.y1 - S.y0;
    half = Math.max(w, hh) * 0.5 + 2; cx = (S.x0 + S.x1) / 2; cy = (S.y0 + S.y1) / 2;
    if (d.id === 'deer') { half = 15; cx = h[0] * 0.6 + (S.x0 + S.x1) * 0.2; cy = h[1] + 2; }
  } else if (kind === 'mounted') {
    const h = S.headScr || [0, -40];
    half = 20.5; cx = h[0] * 0.8 + (S.x0 + S.x1) * 0.1 - 1; cy = h[1] + 11.5;
  } else {
    const h = S.headScr || [0, -28];
    half = 13.6 + Math.max(0, (d.height - 32)) * 0.2; cx = h[0]; cy = h[1] + 8.5;
  }
  const k = size / (half * 2);
  fx.save();
  fx.translate(size / 2, size / 2); fx.scale(k, k); fx.translate(-cx, -cy);
  drawScene(fx, S, false);
  fx.restore();
  addOutline(fig, 'rgba(20,11,5,0.9)', 1.0);
  fx.save(); fx.translate(size / 2, size / 2); fx.scale(k, k); fx.translate(-cx, -cy); drawScene(fx, S, true); fx.restore();
  // soft contact shadow under the figure (bust fades into dark at the bottom)
  ctx.drawImage(fig.canvas, 0, 0, size, size);
  const gb = ctx.createLinearGradient(0, size * 0.62, 0, size);
  gb.addColorStop(0, 'rgba(10,6,3,0)'); gb.addColorStop(1, 'rgba(10,6,3,0.45)');
  ctx.fillStyle = gb; ctx.fillRect(0, 0, size, size);
  // team color corner chip
  const cs = size * 0.2;
  ctx.fillStyle = tc.main;
  ctx.beginPath(); ctx.moveTo(0, size - cs * 1.6); ctx.lineTo(cs * 0.55, size - cs * 1.6); ctx.lineTo(cs * 0.55, size - cs * 0.3); ctx.lineTo(cs * 0.275, size - cs * 0.05); ctx.lineTo(0, size - cs * 0.3); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,8,4,0.85)'; ctx.lineWidth = 0.8; ctx.stroke();
  // frame: dark outer line + thin gold inner line + highlight
  const bw = size >= 64 ? 1.5 : 1.1;
  ctx.lineWidth = bw; ctx.strokeStyle = 'rgba(18,10,5,0.95)';
  rr(ctx, bw / 2, bw / 2, size - bw, size - bw, 2.2); ctx.stroke();
  ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(238,200,110,0.8)';
  rr(ctx, bw + 0.6, bw + 0.6, size - 2 * bw - 1.2, size - 2 * bw - 1.2, 1.6); ctx.stroke();
  ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(bw + 1.6, size - bw - 2.4); ctx.lineTo(bw + 1.6, bw + 1.6); ctx.lineTo(size - bw - 2.4, bw + 1.6); ctx.stroke();
  return out.canvas;
}
