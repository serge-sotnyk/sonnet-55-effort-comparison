// 24x24 resource icons (transparent background): logs, berries, gold nuggets, stone blocks, meat haunches.
import { makeCanvas, addOutline } from './common.js';
import { TAU, hsl, ramp, taper, bez, featherPath, smoothClosed } from './resources_util.js';
import { drawRock, sparkle, ROCK_STONE, ROCK_STONE_WARM, GOLD } from './resources_rocks.js';

const ICON_OUT = 'rgba(24,14,6,0.95)';
const BARK = { h0: 20, h1: 34, s0: 32, s1: 44, l0: 8, l1: 58 };
const WOOD = { h0: 24, h1: 36, s0: 40, s1: 62, l0: 14, l1: 78 };
const LEAF = { h0: 140, h1: 84, s0: 46, s1: 68, l0: 14, l1: 58 };
const MEAT = { h0: 352, h1: 372, s0: 48, s1: 60, l0: 16, l1: 62 };       // hue passes through red -> orange (352..372)
const BONE = { h0: 34, h1: 46, s0: 22, s1: 30, l0: 30, l1: 96 };

function iconLogs(ctx) {
  const rows = [[3.2, 17.5, 0], [4.4, 11.8, 1], [3.2, 6.1, 0.5]];
  const L = 14.5, r = 3.1;
  rows.forEach((row, i) => {
    const x0 = row[0], y = row[1];
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, ramp(BARK, 0.78)); g.addColorStop(0.5, ramp(BARK, 0.46)); g.addColorStop(1, ramp(BARK, 0.14));
    ctx.beginPath();
    ctx.moveTo(x0, y - r); ctx.lineTo(x0 + L, y - r);
    ctx.ellipse(x0 + L, y, r * 0.55, r, 0, -Math.PI / 2, Math.PI / 2, false);
    ctx.lineTo(x0, y + r);
    ctx.ellipse(x0, y, r * 0.55, r, 0, Math.PI / 2, Math.PI * 1.5, false);
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = ramp(BARK, 0.1, 0.5); ctx.lineWidth = 0.6;
    for (let k = 0; k < 4; k++) { const xx = x0 + 2 + k * 3.3 + (i % 2); ctx.beginPath(); ctx.moveTo(xx, y - r * 0.2 + (k % 2) * 1.2); ctx.lineTo(xx + 2.2, y - r * 0.1 + (k % 2) * 1.2); ctx.stroke(); }
    ctx.fillStyle = ramp(BARK, 0.9, 0.4); ctx.fillRect(x0 + 1, y - r + 0.7, L - 1, 0.7);
    // cut end
    ctx.beginPath(); ctx.ellipse(x0 + L, y, r * 0.55, r, 0, 0, TAU);
    const eg = ctx.createRadialGradient(x0 + L - 0.5, y - 0.8, 0.2, x0 + L, y, r);
    eg.addColorStop(0, ramp(WOOD, 0.95)); eg.addColorStop(1, ramp(WOOD, 0.6)); ctx.fillStyle = eg; ctx.fill();
    ctx.strokeStyle = ramp(WOOD, 0.28, 0.7); ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.ellipse(x0 + L, y, r * 0.3, r * 0.55, 0, 0, TAU); ctx.stroke();
  });
}
function iconBerries(ctx) {
  // leaves
  featherPath(ctx, 12, 8.5, 8, 5, 4.5, 6.2, 2.6); ctx.fillStyle = ramp(LEAF, 0.4); ctx.fill();
  featherPath(ctx, 12, 8.5, 16, 4, 19.6, 5.4, 2.8); ctx.fillStyle = ramp(LEAF, 0.55); ctx.fill();
  featherPath(ctx, 12, 8.6, 12, 4.6, 11, 1.4, 2.2); ctx.fillStyle = ramp(LEAF, 0.68); ctx.fill();
  ctx.strokeStyle = ramp(LEAF, 0.3); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(12, 9); ctx.lineTo(11.5, 12); ctx.stroke();
  const berry = (x, y, r) => {
    ctx.fillStyle = 'rgba(40,8,12,0.5)'; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.7, r, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.2, x, y, r * 1.1);
    g.addColorStop(0, hsl(354, 92, 70)); g.addColorStop(0.45, hsl(352, 80, 46)); g.addColorStop(1, hsl(348, 72, 22));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,244,0.95)'; ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.42, r * 0.24, 0, TAU); ctx.fill();
  };
  berry(7, 16, 4.1); berry(16, 16.4, 4.3); berry(11.8, 12.4, 4.1);
}
function iconGold(ctx) {
  const rand = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  const nug = (x, y, s) => {
    drawRock(ctx, rand, x, y, s, s * 0.95, GOLD, { sides: 5, taper: 0.52, cracks: 0, speckle: 0, ao: 0, edge: 'rgba(60,30,4,0.55)' });
    ctx.fillStyle = 'rgba(255,255,230,0.9)'; ctx.beginPath(); ctx.ellipse(x - s * 0.25, y - s * 1.0, s * 0.22, s * 0.14, -0.5, 0, TAU); ctx.fill();
  };
  nug(7.2, 19, 5.2); nug(16.2, 19.4, 4.9); nug(11.8, 13.6, 5.4);
  sparkle(ctx, 17.2, 7.6, 3.6);
}
function iconStone(ctx) {
  const rand = (() => { let a = 11; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  const LIGHT = { h0: 214, h1: 205, s0: 14, s1: 8, l0: 20, l1: 92 };        // lighter than the in-world stone so the icon pops
  const WARM = { h0: 36, h1: 40, s0: 12, s1: 14, l0: 24, l1: 90 };
  drawRock(ctx, rand, 9.4, 17.8, 6.8, 8.8, LIGHT, { sides: 6, taper: 0.55, cracks: 1, speckle: 0, ao: 0, edge: 'rgba(14,10,8,0.5)' });
  drawRock(ctx, rand, 17.2, 18.6, 4.2, 5.2, WARM, { sides: 5, taper: 0.55, cracks: 0, speckle: 0, ao: 0, edge: 'rgba(14,10,8,0.5)' });
}
function iconMeat(ctx, kind) {
  const tone = kind === 'carcass_boar' ? { dh: 8, ds: -6, dl: -4 } : kind === 'carcass_sheep' ? { dh: 6, ds: -4, dl: 6 } : { dh: 0, ds: 0, dl: 0 };
  const m = (t, a) => ramp({ h0: MEAT.h0 + tone.dh, h1: MEAT.h1 + tone.dh, s0: MEAT.s0 + tone.ds, s1: MEAT.s1 + tone.ds, l0: MEAT.l0 + tone.dl, l1: MEAT.l1 + tone.dl }, t, a);
  // bone shaft toward lower-right
  taper(ctx, [[12.5, 13], [18.5, 18.6]], 3.0, 2.6, ramp(BONE, 0.3));
  taper(ctx, [[12.3, 12.7], [18.3, 18.3]], 2.0, 1.7, ramp(BONE, 0.8));
  ctx.fillStyle = ramp(BONE, 0.72);
  ctx.beginPath(); ctx.arc(19.2, 18.2, 1.9, 0, TAU); ctx.arc(18, 19.6, 1.9, 0, TAU); ctx.fill();
  ctx.fillStyle = ramp(BONE, 0.97, 0.9); ctx.beginPath(); ctx.arc(18.6, 17.7, 0.8, 0, TAU); ctx.fill();
  // meat mass
  const pts = [[4.2, 9.2], [7.5, 4.6], [13, 3.4], [17, 6.4], [16.4, 11.4], [12.2, 15], [7, 14.6], [3.8, 12.4]];
  smoothClosed(ctx, pts);
  const g = ctx.createRadialGradient(7.8, 6.6, 0.6, 11, 9.6, 9.4);
  g.addColorStop(0, m(0.82)); g.addColorStop(0.5, m(0.52)); g.addColorStop(1, m(0.16));
  ctx.fillStyle = g; ctx.fill();
  // fat / sheen
  ctx.fillStyle = 'rgba(255,225,210,0.5)';
  ctx.beginPath(); ctx.ellipse(8.2, 6.6, 3.2, 1.5, -0.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = m(0.22, 0.7); ctx.lineWidth = 0.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, 11.5); ctx.quadraticCurveTo(11, 9.5, 14.3, 11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6.8, 9); ctx.quadraticCurveTo(9, 8, 11, 8.6); ctx.stroke();
  if (kind === 'carcass_deer') {            // antler tines peeking out
    const c = ramp({ h0: 28, h1: 42, s0: 28, s1: 44, l0: 18, l1: 80 }, 0.62);
    taper(ctx, bez(15.5, 6.4, 17.5, 3.8, 20.2, 4, 4), 1.8, 0.8, c); taper(ctx, [[18, 4.7], [18.6, 2.6]], 1.3, 0.5, c);
  } else if (kind === 'carcass_boar') {     // curved tusk
    taper(ctx, bez(15, 6, 19.6, 6.4, 19.4, 2.4, 5), 2.2, 0.6, ramp({ h0: 36, h1: 46, s0: 20, s1: 30, l0: 40, l1: 96 }, 0.85));
  } else {                                  // wool tuft
    ctx.fillStyle = 'rgba(250,250,255,0.95)';
    for (const q of [[17.2, 4.6, 2.2], [19.4, 6.6, 1.8], [15.2, 3.6, 1.7]]) { ctx.beginPath(); ctx.arc(q[0], q[1], q[2], 0, TAU); ctx.fill(); }
  }
}

export function buildIcon(kind) {
  const S = makeCanvas(24, 24), ctx = S.ctx;
  ctx.translate(12, 12.4); ctx.scale(0.86, 0.86); ctx.translate(-12, -12);      // inset: keeps >= 2 px transparent margin for the outline
  switch (kind) {
    case 'tree': case 'wood': case 'stump': iconLogs(ctx); break;
    case 'berries': case 'food': iconBerries(ctx); break;
    case 'gold_mine': case 'gold': iconGold(ctx); break;
    case 'stone_mine': case 'stone': iconStone(ctx); break;
    case 'carcass_deer': case 'carcass_boar': case 'carcass_sheep': iconMeat(ctx, kind); break;
    default: iconStone(ctx); break;
  }
  addOutline(S, ICON_OUT, 1);
  return S.canvas;
}
