// Animal carcasses (deer, boar, sheep) lying on their side, 3 fill levels: whole -> partly eaten (ribs showing) -> bones.
// Screen-space drawing: origin = body centre on the ground, head toward -x (variant 1 mirrors the geometry, light stays upper-left).
// The pose reads as "lying": flat body resting on the ground, head laid down, legs stiff and parallel.
import { makeCanvas, toSprite, rng } from './common.js';
import { TAU, clamp, lerp, ramp, taper, bez, smoothClosed, featherPath, finish } from './resources_util.js';

const OUT = 'rgba(24,14,8,0.88)';
const BONE = { h0: 34, h1: 46, s0: 22, s1: 30, l0: 30, l1: 94 };
const FLESH = { h0: 352, h1: 368, s0: 36, s1: 44, l0: 14, l1: 50 };

/** gradient whose light stop sits at the canvas upper-left regardless of mirroring (f = +1 / -1) */
function lineGrad(ctx, f, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0 * f, y0, x1 * f, y1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}
function litGrad(ctx, f, x, y, rx, ry, stops) {
  const g = ctx.createRadialGradient(x - 0.35 * rx * f, y - 0.45 * ry, 0.1, x + 0.1 * rx * f, y + 0.1 * ry, Math.max(rx, ry) * 1.25);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}
function contactShadow(ctx, cx, cy, rx, ry, a = 0.5) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.2, 0, 0, rx);
  g.addColorStop(0, 'rgba(10,8,4,' + a + ')'); g.addColorStop(1, 'rgba(10,8,4,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
}
function furStrokes(ctx, rand, spec, x0, y0, rx, ry, n, len, ang) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand());
    const x = x0 + Math.cos(a) * rx * d, y = y0 + Math.sin(a) * ry * d;
    const lit = (-(x - x0) / rx - (y - y0) / ry) > 0.05;
    ctx.strokeStyle = lit ? ramp(spec, 0.72 + rand() * 0.2, 0.55) : ramp(spec, 0.1 + rand() * 0.15, 0.5);
    ctx.lineWidth = 0.7 + rand() * 0.5;
    const l = len * (0.6 + rand() * 0.8), aa = ang + (rand() - 0.5) * 0.7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(aa) * l, y + Math.sin(aa) * l); ctx.stroke();
  }
}
function bone(ctx, x0, y0, x1, y1, w) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  taper(ctx, [[x0, y0], [x1, y1]], w, w * 0.8, ramp(BONE, 0.2));
  taper(ctx, [[x0 - nx * w * 0.12, y0 - ny * w * 0.12], [x1 - nx * w * 0.12, y1 - ny * w * 0.12]], w * 0.7, w * 0.55, ramp(BONE, 0.82));
  ctx.fillStyle = ramp(BONE, 0.7);
  ctx.beginPath(); ctx.arc(x0, y0, w * 0.75, 0, TAU); ctx.arc(x1, y1, w * 0.7, 0, TAU); ctx.fill();
  ctx.fillStyle = ramp(BONE, 0.95, 0.8);
  ctx.beginPath(); ctx.arc(x0 - w * 0.2, y0 - w * 0.2, w * 0.3, 0, TAU); ctx.arc(x1 - w * 0.2, y1 - w * 0.2, w * 0.28, 0, TAU); ctx.fill();
}
function ribcage(ctx, x0, n, step, ySpine, len, bulge) {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    ctx.strokeStyle = 'rgba(40,28,14,0.5)'; ctx.lineWidth = 2.1; ctx.beginPath(); ctx.moveTo(x + 0.5, ySpine + 0.5); ctx.quadraticCurveTo(x + bulge + 0.5, ySpine + len * 0.5, x + 0.8, ySpine + len + 0.5); ctx.stroke();
    ctx.strokeStyle = ramp(BONE, 0.8); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, ySpine); ctx.quadraticCurveTo(x + bulge, ySpine + len * 0.5, x + 0.3, ySpine + len); ctx.stroke();
    ctx.strokeStyle = ramp(BONE, 0.98, 0.9); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - 0.4, ySpine); ctx.quadraticCurveTo(x + bulge - 0.5, ySpine + len * 0.5, x - 0.3, ySpine + len); ctx.stroke();
  }
}
function spine(ctx, x0, x1, y, n) {
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, i / (n - 1));
    ctx.fillStyle = 'rgba(40,28,14,0.5)'; ctx.beginPath(); ctx.ellipse(x + 0.4, y + 0.5, 1.35, 1.0, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = ramp(BONE, 0.78); ctx.beginPath(); ctx.ellipse(x, y, 1.3, 1.0, 0, 0, TAU); ctx.fill();
  }
}
/** Torn flank showing flesh and ribs (muted tones, no gore). */
function eatenPatch(ctx, rand, f, cx, cy, rx, ry, nRibs) {
  const pts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 0.8 + rand() * 0.4;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  smoothClosed(ctx, pts);
  ctx.fillStyle = 'rgba(40,16,12,0.75)'; ctx.fill();
  ctx.save();
  ctx.translate(0.3 * f, 0.5);
  smoothClosed(ctx, pts.map((p) => [cx + (p[0] - cx) * 0.9, cy + (p[1] - cy) * 0.88]));
  ctx.fillStyle = litGrad(ctx, f, cx, cy, rx, ry, [0, ramp(FLESH, 0.55), 1, ramp(FLESH, 0.2)]); ctx.fill();
  ctx.restore();
  ctx.save();
  smoothClosed(ctx, pts); ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < nRibs; i++) {
    const t = (i + 0.5) / nRibs, x = cx + (t - 0.5) * rx * 1.7;
    const y0 = cy - ry * 1.05, y1 = cy + ry * 0.95;
    ctx.strokeStyle = 'rgba(30,12,8,0.55)'; ctx.lineWidth = 2.1;
    ctx.beginPath(); ctx.moveTo(x + 0.6, y0 + 0.5); ctx.quadraticCurveTo(x + rx * 0.35 + 0.6, cy + 0.5, x + 0.4, y1 + 0.5); ctx.stroke();
    ctx.strokeStyle = ramp(BONE, 0.8); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + rx * 0.35, cy, x - 0.2, y1); ctx.stroke();
    ctx.strokeStyle = ramp(BONE, 0.98, 0.9); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x - 0.5, y0); ctx.quadraticCurveTo(x + rx * 0.35 - 0.5, cy, x - 0.7, y1); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,235,210,0.28)'; ctx.lineWidth = 0.8;
  smoothClosed(ctx, pts); ctx.stroke();
}
/** stiff parallel legs (upper + lower segment + hoof); defs = [[x0,y0,x1,y1,x2,y2], ...]; far legs are drawn first/darker */
function legs(ctx, defs, level, coat, lower, wU, wL, hoof) {
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i], far = i < 2;
    if (level === 0) { bone(ctx, d[0], d[1], d[2], d[3], wU * 0.34); bone(ctx, d[2], d[3], d[4], d[5], wL * 0.5); continue; }
    taper(ctx, bez(d[0], d[1], (d[0] + d[2]) / 2 + 0.5, (d[1] + d[3]) / 2, d[2], d[3], 4), wU, wL * 1.1, ramp(coat, far ? 0.22 : 0.4));
    taper(ctx, bez(d[2], d[3], (d[2] + d[4]) / 2, (d[3] + d[5]) / 2 + 0.4, d[4], d[5], 4), wL * 1.1, wL * 0.75, ramp(lower, far ? 0.16 : 0.3));
    taper(ctx, [[d[0] - 0.4, d[1] - 0.5], [d[2] - 0.4, d[3] - 0.5]], wU * 0.3, wU * 0.2, ramp(coat, 0.7, 0.55));
    const ang = Math.atan2(d[5] - d[3], d[4] - d[2]);
    ctx.fillStyle = hoof;
    ctx.beginPath(); ctx.ellipse(d[4] + Math.cos(ang) * 0.9, d[5] + Math.sin(ang) * 0.9, 1.9, 1.25, ang, 0, TAU); ctx.fill();
  }
}

// ------------------------------------------------------------------ deer
function drawDeer(ctx, f, rand, level) {
  const COAT = { h0: 16, h1: 38, s0: 46, s1: 64, l0: 13, l1: 66 };
  const BELLY = { h0: 34, h1: 44, s0: 20, s1: 28, l0: 46, l1: 93 };
  const LEG = { h0: 14, h1: 28, s0: 38, s1: 50, l0: 8, l1: 46 };
  const ANT = { h0: 28, h1: 42, s0: 28, s1: 44, l0: 18, l1: 80 };
  contactShadow(ctx, 2, 3, 30, 8, 0.5);
  const antler = (ox, oy, dark) => {
    const c = ramp(ANT, dark ? 0.26 : 0.55), hl = ramp(ANT, 0.92, 0.85);
    const beam = bez(-23 + ox, -0.5 + oy, -26 + ox, -7 + oy, -33 + ox, -9.5 + oy, 6);
    taper(ctx, beam, 2.4, 1.0, c);
    const tine = (t, dx, dy, w) => {
      const p = beam[Math.round(t * 6)];
      taper(ctx, [[p[0], p[1]], [p[0] + dx * 0.5, p[1] + dy * 0.6], [p[0] + dx, p[1] + dy]], w, 0.5, c);
    };
    tine(0.35, 0.8, -5.2, 1.5); tine(0.62, -1.6, -5.0, 1.4); tine(1.0, -3.4, 0.2, 1.2); tine(1.0, -1.6, -4.6, 1.2);
    if (!dark) taper(ctx, beam.map((p) => [p[0] - 0.4, p[1] - 0.5]), 0.8, 0.3, hl);
  };
  const headPts = [[-21, -1], [-25, -1.4], [-30, 1.6], [-32, 3.6], [-30.5, 5.4], [-25, 5.6], [-21.5, 4.2]];
  const skull = (bones) => {
    smoothClosed(ctx, headPts);
    ctx.fillStyle = lineGrad(ctx, f, -32, -2, -21, 6, [0, bones ? ramp(BONE, 0.9) : ramp(COAT, 0.62), 1, bones ? ramp(BONE, 0.45) : ramp(COAT, 0.26)]);
    ctx.fill();
    if (!bones) {
      smoothClosed(ctx, [[-29, 2.6], [-31.6, 3.8], [-30.4, 5.5], [-27, 5.5], [-26.5, 3.2]]);
      ctx.fillStyle = ramp(BELLY, 0.7, 0.85); ctx.fill();
    } else { ctx.strokeStyle = 'rgba(40,28,14,0.55)'; ctx.lineWidth = 0.7; smoothClosed(ctx, headPts); ctx.stroke(); }
    ctx.fillStyle = bones ? 'rgba(30,20,10,0.8)' : '#1d140e';
    ctx.beginPath(); ctx.ellipse(-31.6, 3.8, 1.0, 0.9, 0, 0, TAU); ctx.fill();
    if (bones) { ctx.beginPath(); ctx.ellipse(-25.3, 1.8, 1.6, 1.3, 0, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(20,12,8,0.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-26.8, 1.5); ctx.quadraticCurveTo(-25.5, 2.5, -24, 1.6); ctx.stroke(); }
  };
  const bodyPts = [[-12, -8.5], [-3, -10.8], [6, -10.2], [13.5, -7.5], [15.5, -3.5], [12, 0.8], [2, 2.2], [-8, 1.8], [-14, -1.5], [-15, -5.5]];
  // stiff legs: front pair reaching forward-down, rear pair backward-down, all parallel-ish
  const legDefs = [[-6, 0.5, -9.5, 5.5, -14.5, 9.5], [10, 0, 14, 4.5, 19, 7.5], [-9.5, -0.5, -13.5, 4.5, -19.5, 7.5], [12, 1, 16.5, 5.5, 22, 8.5]];
  if (level === 0) {
    legs(ctx, legDefs, 0, COAT, LEG, 4, 3, '#21160f');
    spine(ctx, -15, 13, -6.2, 12);
    ribcage(ctx, -12, 7, 2.7, -5.8, 8.5, 3.0);
    smoothClosed(ctx, [[8.5, -7.5], [13, -8], [16, -4], [14, 0], [10, -1], [8, -4]]);
    ctx.fillStyle = lineGrad(ctx, f, 8, -8, 16, 0, [0, ramp(BONE, 0.85), 1, ramp(BONE, 0.45)]); ctx.fill();
    ctx.strokeStyle = 'rgba(40,28,14,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = ramp(COAT, 0.4, 0.95);
    smoothClosed(ctx, [[9, -1.5], [13, -2.5], [16.5, 0.5], [13, 3], [9.5, 2.2]]); ctx.fill();
    ctx.fillStyle = ramp(BELLY, 0.7, 0.95);
    smoothClosed(ctx, [[-18, 0], [-14, -1.4], [-11.5, 1], [-14.5, 3], [-18, 2.5]]); ctx.fill();
    antler(0, 0, true); antler(2.4, 1.6, false);
    skull(true);
    return;
  }
  legs(ctx, legDefs, level, COAT, LEG, 4.4, 2.8, '#21160f');
  // neck laid on the ground, head, antlers
  taper(ctx, bez(-10, -4, -16, -1, -22, 2.5, 5), 9, 6.4, ramp(COAT, 0.4));
  taper(ctx, bez(-10, -7, -16, -4.5, -22, -0.2, 5), 3.2, 2.4, ramp(COAT, 0.62, 0.9));
  antler(0, 0, true); antler(2.4, 1.6, false);
  skull(false);
  featherPath(ctx, -21.6, -0.6, -22.2, -4.5, -19.6, -6.8, 2.1);
  ctx.fillStyle = ramp(COAT, 0.36); ctx.fill();
  // body
  smoothClosed(ctx, bodyPts);
  ctx.fillStyle = lineGrad(ctx, f, -14, -11, 14, 3, [0, ramp(COAT, 0.7), 0.5, ramp(COAT, 0.5), 1, ramp(COAT, 0.2)]);
  ctx.fill();
  ctx.save();
  smoothClosed(ctx, bodyPts); ctx.clip();
  const bg = ctx.createLinearGradient(0, -2.5, 0, 2.4);
  bg.addColorStop(0, 'rgba(240,228,205,0)'); bg.addColorStop(0.45, ramp(BELLY, 0.7, 0.7)); bg.addColorStop(1, ramp(BELLY, 0.62, 0.95));
  ctx.fillStyle = bg; ctx.fillRect(-18, -3, 38, 8);
  const dg = ctx.createLinearGradient(0, -11, 0, -5);
  dg.addColorStop(0, ramp(COAT, 0.05, 0.75)); dg.addColorStop(1, ramp(COAT, 0.05, 0));
  ctx.fillStyle = dg; ctx.fillRect(-18, -12, 38, 8);
  furStrokes(ctx, rand, COAT, 0, -4.5, 14, 5.5, 30, 3.4, 0.2);
  const lg = ctx.createLinearGradient(-14 * f, -11, 8 * f, 3);
  lg.addColorStop(0, 'rgba(255,236,170,0.24)'); lg.addColorStop(0.5, 'rgba(255,236,170,0)'); lg.addColorStop(1, 'rgba(10,6,20,0.26)');
  ctx.fillStyle = lg; ctx.fillRect(-18, -12, 38, 16);
  ctx.restore();
  if (level === 1) eatenPatch(ctx, rand, f, 1.5, -4.2, 8, 4.2, 5);
  ctx.fillStyle = ramp(BELLY, 0.9); ctx.beginPath(); ctx.ellipse(16.4, -5.4, 2.6, 1.8, 0.6, 0, TAU); ctx.fill();
}

// ------------------------------------------------------------------ boar
function drawBoar(ctx, f, rand, level) {
  const COAT = { h0: 18, h1: 34, s0: 22, s1: 26, l0: 6, l1: 54 };
  const SNOUT = { h0: 8, h1: 14, s0: 24, s1: 30, l0: 24, l1: 62 };
  const TUSK = { h0: 36, h1: 46, s0: 20, s1: 30, l0: 40, l1: 96 };
  contactShadow(ctx, 1, 3, 26, 8, 0.5);
  const legDefs = [[-6, 0.5, -9.5, 5, -14, 8.5], [9, 0, 13, 4.5, 17.5, 7.5], [-9, -0.5, -13, 4, -18.5, 7], [11, 1, 15.5, 5.5, 20, 8.5]];
  const tusks = () => {
    for (const k of [0, 1]) {
      const ox = k * 2.2, oy = k * 0.8;
      const pts = bez(-25.5 + ox, 5.4 + oy, -30 + ox, 6.4 + oy, -30.5 + ox, 1.4 + oy, 5);
      taper(ctx, pts, 2.2, 0.6, ramp(TUSK, k ? 0.5 : 0.8));
      taper(ctx, pts.map((p) => [p[0] - 0.35, p[1] - 0.2]), 0.7, 0.3, ramp(TUSK, 1, 0.9));
    }
  };
  const head = [[-14, -3.5], [-19.5, -5], [-25.5, -2], [-28.5, 2.5], [-27.5, 6], [-21, 7.4], [-14, 5.5]];
  const bodyPts = [[-11, -8], [-3, -10.6], [6, -10.4], [12.5, -7.2], [14, -2], [9, 2], [0, 3.2], [-8, 2.4], [-14, -1.2], [-14.5, -5.2]];
  if (level === 0) {
    legs(ctx, legDefs, 0, COAT, COAT, 4, 3, '#1a120d');
    spine(ctx, -12, 11, -6.8, 10);
    ribcage(ctx, -10, 6, 2.7, -6.4, 8.6, 3);
    smoothClosed(ctx, [[7, -7.5], [11.5, -8], [13.5, -4], [11.5, -0.5], [8, -1.5], [6.5, -4.5]]);
    ctx.fillStyle = ramp(BONE, 0.7); ctx.fill(); ctx.strokeStyle = 'rgba(40,28,14,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = ramp(COAT, 0.34, 0.95);
    smoothClosed(ctx, [[6, -1.5], [10.5, -2.5], [14, 0.5], [10.5, 3.5], [6.5, 2.5]]); ctx.fill();
    smoothClosed(ctx, [[-17, -2.5], [-22, -3.5], [-27.5, 0.5], [-29.5, 4], [-27.5, 6.4], [-21, 6.6], [-17, 4.5]]);
    ctx.fillStyle = lineGrad(ctx, f, -29, -3, -17, 7, [0, ramp(BONE, 0.9), 1, ramp(BONE, 0.45)]); ctx.fill(); ctx.strokeStyle = 'rgba(40,28,14,0.55)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = 'rgba(30,20,10,0.85)'; ctx.beginPath(); ctx.ellipse(-22.5, 1, 1.5, 1.2, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(-28.4, 3.8, 0.9, 0.8, 0, 0, TAU); ctx.fill();
    tusks();
    return;
  }
  legs(ctx, legDefs, level, COAT, COAT, 5, 3.2, '#1a120d');
  smoothClosed(ctx, head);
  ctx.fillStyle = lineGrad(ctx, f, -28, -5, -14, 7, [0, ramp(COAT, 0.5), 1, ramp(COAT, 0.16)]); ctx.fill();
  ctx.save(); smoothClosed(ctx, head); ctx.clip();
  furStrokes(ctx, rand, COAT, -21, 1.5, 7, 5, 10, 2.6, 0.5);
  ctx.restore();
  ctx.fillStyle = lineGrad(ctx, f, -30, 0, -26, 6, [0, ramp(SNOUT, 0.75), 1, ramp(SNOUT, 0.3)]);
  ctx.beginPath(); ctx.ellipse(-28.5, 3.7, 2.3, 3.2, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1d1210'; ctx.beginPath(); ctx.ellipse(-29.6, 3.2, 0.55, 0.9, 0, 0, TAU); ctx.ellipse(-29.1, 5.2, 0.5, 0.8, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(14,8,6,0.9)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-23.2, 0.4); ctx.quadraticCurveTo(-22, 1.4, -20.6, 0.5); ctx.stroke();
  tusks();
  featherPath(ctx, -16.2, -3.5, -15.6, -7.5, -13.2, -8.8, 2.2);
  ctx.fillStyle = ramp(COAT, 0.24); ctx.fill();
  smoothClosed(ctx, bodyPts);
  ctx.fillStyle = lineGrad(ctx, f, -14, -10, 14, 3, [0, ramp(COAT, 0.55), 0.5, ramp(COAT, 0.34), 1, ramp(COAT, 0.1)]);
  ctx.fill();
  ctx.save();
  smoothClosed(ctx, bodyPts); ctx.clip();
  furStrokes(ctx, rand, COAT, 0, -4.2, 13, 6, 46, 3.6, 0.25);
  const lg = ctx.createLinearGradient(-14 * f, -11, 8 * f, 3);
  lg.addColorStop(0, 'rgba(255,236,180,0.2)'); lg.addColorStop(0.5, 'rgba(255,236,180,0)'); lg.addColorStop(1, 'rgba(10,6,20,0.3)');
  ctx.fillStyle = lg; ctx.fillRect(-18, -12, 36, 16);
  ctx.restore();
  for (let i = 0; i < 13; i++) {
    const x = -11 + i * 1.95, y = -10.4 + Math.abs(x) * 0.07 + (i === 0 ? 1.6 : 0);
    const l = 3.3 - Math.abs(x) * 0.06 + rand();
    taper(ctx, [[x, y + 1], [x - 0.6 * f, y - l * 0.6], [x - 1.0 * f, y - l]], 1.5, 0.3, ramp(COAT, i % 2 ? 0.55 : 0.28));
  }
  if (level === 1) eatenPatch(ctx, rand, f, 0.5, -3.8, 7, 4.2, 5);
  ctx.strokeStyle = ramp(COAT, 0.2); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(13.5, -5); ctx.quadraticCurveTo(17, -7, 16, -3.5); ctx.stroke();
}

// ------------------------------------------------------------------ sheep (wool built from shaded puffs)
function drawSheep(ctx, f, rand, level) {
  const WOOL = { h0: 224, h1: 44, s0: 16, s1: 26, l0: 50, l1: 99 };
  const FACE = { h0: 20, h1: 30, s0: 18, s1: 26, l0: 8, l1: 46 };
  contactShadow(ctx, 1, 3, 22, 7, 0.5);
  const legDefs = [[-5, 0.5, -8, 4.5, -12, 7.5], [8, 0, 11, 4, 15, 6.5], [-8, -0.5, -11.5, 3.5, -16, 6], [10, 1, 14, 5, 17.5, 7.5]];
  const sphere = (cx, cy, r, f_) => {
    const g = ctx.createRadialGradient(cx - r * 0.36 * f, cy - r * 0.42, r * 0.08, cx + r * 0.08 * f, cy + r * 0.12, r * 1.12);
    g.addColorStop(0, ramp(WOOL, f_ + 0.16)); g.addColorStop(0.55, ramp(WOOL, f_)); g.addColorStop(1, ramp(WOOL, f_ - 0.34));
    ctx.fillStyle = g;
    ctx.beginPath();
    const n = 9, a0 = rand() * TAU;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * TAU, k = 0.9 + rand() * 0.18;
      const px = cx + Math.cos(a) * r * k, py = cy + Math.sin(a) * r * 0.94 * k;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  };
  const headPts = [[-15, -1.5], [-19.5, -2.2], [-23.5, 1], [-24, 3.4], [-20.5, 5.2], [-15.5, 4.6]];
  if (level === 0) {
    legs(ctx, legDefs, 0, FACE, FACE, 3, 2, '#17100c');
    spine(ctx, -10, 10, -5.6, 9);
    ribcage(ctx, -9, 6, 2.6, -5.2, 7.6, 2.7);
    smoothClosed(ctx, [[7, -6], [11, -6.4], [13, -2.6], [11, 0.4], [7.5, -0.4], [6, -3]]);
    ctx.fillStyle = ramp(BONE, 0.7); ctx.fill(); ctx.strokeStyle = 'rgba(40,28,14,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
    smoothClosed(ctx, [[-15, -1.5], [-19, -2.2], [-23, 0.8], [-23.6, 3.2], [-20.5, 4.6], [-16, 4.2]]);
    ctx.fillStyle = lineGrad(ctx, f, -23, -2, -15, 5, [0, ramp(BONE, 0.9), 1, ramp(BONE, 0.45)]); ctx.fill(); ctx.strokeStyle = 'rgba(40,28,14,0.55)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = 'rgba(30,20,10,0.85)'; ctx.beginPath(); ctx.ellipse(-19.2, 0.8, 1.3, 1.1, 0, 0, TAU); ctx.fill();
    taper(ctx, bez(-16.5, -2, -15, -7, -19, -7.5, 5), 2.2, 0.8, ramp(BONE, 0.55));
    sphere(7, 0.5, 3.0, 0.62); sphere(-5, 4.5, 2.6, 0.55); sphere(12, 3.5, 2.2, 0.5);
    return;
  }
  legs(ctx, legDefs, level, FACE, FACE, 3.2, 2.0, '#17100c');
  // head resting on the ground
  smoothClosed(ctx, headPts);
  ctx.fillStyle = lineGrad(ctx, f, -24, -2, -15, 5, [0, ramp(FACE, 0.52), 1, ramp(FACE, 0.14)]); ctx.fill();
  ctx.fillStyle = ramp(FACE, 0.5, 0.9); ctx.beginPath(); ctx.ellipse(-23, 2.6, 1.5, 1.2, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(8,4,2,0.95)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-20.6, 0.4); ctx.quadraticCurveTo(-19.3, 1.4, -17.8, 0.5); ctx.stroke();
  featherPath(ctx, -17.6, -1, -16.2, -4.4, -13.6, -4.2, 2.0); ctx.fillStyle = ramp(FACE, 0.3); ctx.fill();
  sphere(-16, -3, 3.4, 0.7);
  // body: lumpy wool mass, back row first
  const puffs = [
    [-9, -8, 5.4], [-1, -10, 5.8], [7, -9, 5.6], [12, -5, 4.8],
    [-12, -3.5, 5.0], [-5, -5, 6.2], [3, -5, 6.4], [10, -2, 5.0],
    [-8, -0.5, 4.6], [0, -0.8, 5.2], [7, -0.2, 4.4],
  ];
  // soft body shade under the puffs
  ctx.fillStyle = ramp(WOOL, 0.36);
  ctx.beginPath(); ctx.ellipse(1, -3.5, 16.5, 8, 0, 0, TAU); ctx.fill();
  puffs.forEach((p) => {
    const lit = clamp(0.68 - 0.14 * (p[0] / 14) * f + 0.1 * (-(p[1] + 4) / 6) + (rand() - 0.5) * 0.05, 0.42, 0.88);
    const cut = level === 1 && p[0] > -7 && p[0] < 8 && p[1] > -7 && p[1] < 0;
    if (!cut) sphere(p[0], p[1], p[2], lit);
  });
  if (level === 1) eatenPatch(ctx, rand, f, 0.5, -3.8, 7.4, 4.6, 5);
  sphere(15.5, -5, 2.4, 0.7);
}

export function buildCarcass(kind, variant, level) {
  const S = makeCanvas(88, 50), ctx = S.ctx;
  const ax = 44, ay = 29;
  const f = variant & 1 ? -1 : 1;
  const k = kind === 'carcass_deer' ? 1 : kind === 'carcass_boar' ? 2 : 3;
  const rand = rng(6100 + variant * 17 + k * 1000);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.scale(f, 1);
  if (k === 1) drawDeer(ctx, f, rand, level);
  else if (k === 2) drawBoar(ctx, f, rand, level);
  else drawSheep(ctx, f, rand, level);
  ctx.restore();
  finish(S, OUT, [[ax + 6, ay + 3, 28, 8, 0.2]]);
  return toSprite(S, ax, ay);
}
