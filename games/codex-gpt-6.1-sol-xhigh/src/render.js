import { SIZE, BUILDINGS, UNITS, terrain, hash, center } from './game.js';
export const TW = 64, TH = 32;
export const iso = (x, y, h = 0) => ({ x: (x - y) * TW / 2, y: (x + y) * TH / 2 - h });
export const uniso = (x, y) => ({ x: x / TW + y / TH, y: y / TH - x / TW });
const TEAM = ['#467f98', '#ad5946'], TEAM_LIGHT = ['#83bbc7', '#de8b65'];
const polygon = (c, points, fill, stroke) => { c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = .8; c.stroke(); } };
const line = (c, a, b, color, width = 1) => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = color; c.lineWidth = width; c.stroke(); };
const oval = (c, x, y, rx, ry, color) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill(); };
const p = (e, x = 0, y = 0, h = 0) => iso(e.x + x, e.y + y, h);
function box(c, e, x, y, w, d, h, colors = ['#c9ba8d', '#a2946d', '#e0d3a8'], stone = false, base = 0) {
  const a = p(e, x, y, base), b = p(e, x + w, y, base), cc = p(e, x + w, y + d, base), dd = p(e, x, y + d, base);
  const at = p(e, x, y, h), bt = p(e, x + w, y, h), ct = p(e, x + w, y + d, h), dt = p(e, x, y + d, h);
  polygon(c, [dd, cc, ct, dt], colors[0], '#5a574244'); polygon(c, [b, cc, ct, bt], colors[1], '#5a574244'); polygon(c, [at, bt, ct, dt], colors[2]);
  if (stone) {
    for (let hh = base + 7; hh < h; hh += 8) {
      line(c, p(e, x, y + d, hh), p(e, x + w, y + d, hh), '#655f4838', .65);
      line(c, p(e, x + w, y, hh), p(e, x + w, y + d, hh), '#5b5a493d', .65);
      for (let v = .1 + ((Math.floor(hh / 8) % 2) * .27); v < w; v += .53) line(c, p(e, x + v, y + d, hh), p(e, x + v, y + d, Math.min(hh + 8, h)), '#655f4833', .6);
      for (let v = .1 + ((Math.floor(hh / 8) % 2) * .27); v < d; v += .53) line(c, p(e, x + w, y + v, hh), p(e, x + w, y + v, Math.min(hh + 8, h)), '#655f4833', .6);
    }
  }
}
function roof(c, e, x, y, w, d, h, rise, color = '#936449') {
  const rr = [p(e, x - .12, y + d + .12, h), p(e, x + w + .12, y + d + .12, h), p(e, x + w + .12, y + d / 2, h + rise), p(e, x - .12, y + d / 2, h + rise)];
  polygon(c, [p(e, x + w, y, h), p(e, x + w, y + d, h), p(e, x + w, y + d / 2, h + rise)], '#b9a77e', '#665941');
  polygon(c, [p(e, x - .12, y - .12, h), p(e, x + w + .12, y - .12, h), rr[2], rr[3]], '#6f5140', '#5e4b3988');
  polygon(c, rr, color, '#5c473a');
  for (let t = .2; t < 1; t += .2) {
    const q1 = { x: rr[0].x * (1 - t) + rr[3].x * t, y: rr[0].y * (1 - t) + rr[3].y * t }, q2 = { x: rr[1].x * (1 - t) + rr[2].x * t, y: rr[1].y * (1 - t) + rr[2].y * t };
    line(c, q1, q2, '#3d362738', .8);
    for (let s = .08; s < 1; s += .14) {
      const a = { x: q1.x + (q2.x - q1.x) * s, y: q1.y + (q2.y - q1.y) * s };
      line(c, a, { x: a.x - 2.7, y: a.y + 4 }, '#d3a47830', .7);
    }
  }
  line(c, rr[2], rr[3], '#c9a176', 2); line(c, rr[0], rr[1], '#503c2e', 2);
}
function pyramid(c, e, x, y, w, d, h, rise, color = '#5c7370') {
  const a = p(e, x - .12, y - .12, h), b = p(e, x + w + .12, y - .12, h), cc = p(e, x + w + .12, y + d + .12, h), dd = p(e, x - .12, y + d + .12, h), top = p(e, x + w / 2, y + d / 2, h + rise);
  polygon(c, [a, b, top], '#435552', '#354a45'); polygon(c, [b, cc, top], '#415653', '#354a45'); polygon(c, [cc, dd, top], color, '#354a45'); polygon(c, [dd, a, top], '#788c77', '#354a45');
  line(c, top, cc, '#a5ad8855', .8);
}
function door(c, e, x, y, w = .42, h = 18, side = 'left') {
  const a = p(e, x, y), b = side === 'left' ? p(e, x + w, y) : p(e, x, y + w);
  polygon(c, [a, b, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }], '#4f4836', '#ccbb8d80');
  line(c, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - h }, '#211f1766', 1);
  oval(c, b.x - 3, b.y - h / 2, 1, 1, '#c3a66e');
}
function window(c, e, x, y, hh = 24, side = 'left', w = .25, h = 7) {
  const a = p(e, x, y, hh), b = side === 'left' ? p(e, x + w, y, hh) : p(e, x, y + w, hh);
  polygon(c, [a, b, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }], '#343e36', '#d1c49b');
  line(c, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - h }, '#bcae82', .8);
}
function timber(c, e, x, y, w, d, h) {
  for (let k = 0; k <= w; k += .65) line(c, p(e, x + k, y + d), p(e, x + k, y + d, h), '#60563d', 2.4);
  for (let k = 0; k <= d; k += .65) line(c, p(e, x + w, y + k), p(e, x + w, y + k, h), '#514c36', 2.4);
  line(c, p(e, x, y + d, h / 2), p(e, x + w, y + d, h / 2), '#64563a', 1.8);
  line(c, p(e, x + w, y, h / 2), p(e, x + w, y + d, h / 2), '#64563a', 1.8);
}
function flag(c, e, x, y, h, owner, time = 0, large = false) {
  const a = p(e, x, y, h), b = p(e, x, y, h + (large ? 32 : 25)), f = Math.sin(time * 2.2 + x) * 2;
  line(c, a, b, '#5d5440', 1.7); oval(c, b.x, b.y, 1.5, 1.5, '#d0b77e');
  const w = large ? 21 : 15, hh = large ? 12 : 9;
  polygon(c, [{ x: b.x + 1, y: b.y + 2 }, { x: b.x + w, y: b.y + 2 + f }, { x: b.x + w - 3, y: b.y + hh / 2 + f }, { x: b.x + w, y: b.y + hh + f }, { x: b.x + 1, y: b.y + hh }], TEAM[owner || 0], '#183e4166');
  line(c, { x: b.x + 4, y: b.y + 4 }, { x: b.x + 4, y: b.y + hh - 2 }, TEAM_LIGHT[owner || 0], 1);
}
function battlements(c, e, x, y, w, d, h) {
  box(c, e, x, y, w, d, h, ['#aaa88f', '#858d7b', '#cbc8ac'], true);
  box(c, e, x - .08, y - .08, w + .16, d + .16, h + 4, ['#c5bea1', '#9b9e88', '#d6d0b3'], false, h - 4);
  for (let a = 0; a < w; a += .43) { box(c, e, x + a, y, .2, .2, h + 11, ['#d0c7a7', '#959d88', '#e0d4b6'], false, h + 3); box(c, e, x + a, y + d - .2, .2, .2, h + 11, ['#d0c7a7', '#959d88', '#e0d4b6'], false, h + 3); }
  for (let b = .35; b < d - .2; b += .43) { box(c, e, x, y + b, .2, .2, h + 11, ['#d0c7a7', '#959d88', '#e0d4b6'], false, h + 3); box(c, e, x + w - .2, y + b, .2, .2, h + 11, ['#d0c7a7', '#959d88', '#e0d4b6'], false, h + 3); }
}
function logs(c, e, x, y, count = 3) {
  const a = p(e, x, y);
  for (let i = 0; i < count; i++) { const xx = a.x + i % 3 * 6, yy = a.y + Math.floor(i / 3) * -5; line(c, { x: xx, y: yy }, { x: xx + 19, y: yy - 9 }, '#5f4933', 6); oval(c, xx, yy, 3, 3, '#caa878'); oval(c, xx, yy, 1.4, 1.5, '#9b744e'); }
}
export function drawBuilding(c, e, time = 0, ghost = false) {
  const def = BUILDINGS[e.type]; if (!def) return;
  c.save();
  const mid = p(e, e.w / 2, e.d / 2); oval(c, mid.x + 14, mid.y + 4, e.w * 25, e.d * 13, '#1d332e28');
  if (e.progress < 1 && !ghost) {
    const pts = [p(e), p(e, e.w, 0), p(e, e.w, e.d), p(e, 0, e.d)]; polygon(c, pts, '#8a805e', '#c8b48a');
    for (let x = .2; x < e.w; x += .65) line(c, p(e, x, .15), p(e, x, e.d - .15), '#676b4780', 3);
    if (e.progress < .24) { logs(c, e, .4, e.d - .3, 6); flag(c, e, e.w / 2, e.d / 2, 0, e.owner, time); c.restore(); return; }
    c.globalAlpha = .45 + e.progress * .55;
  }
  const team = TEAM[e.owner || 0];
  switch (e.type) {
    case 'towncenter':
      box(c, e, 0, 0, 3, 3, 6, ['#b1a683', '#938e6b', '#c1b991'], true);
      box(c, e, 1.85, .1, .9, .85, 70, ['#d0c5a0', '#a69f80', '#ded5b0'], true); window(c, e, 2.2, .95, 48); window(c, e, 2.75, .3, 43, 'right'); pyramid(c, e, 1.83, .08, .95, .9, 71, 24, '#77856c'); flag(c, e, 2.3, .52, 95, e.owner, time);
      box(c, e, .25, .8, 2.45, 1.65, 35); timber(c, e, .25, .8, 2.45, 1.65, 35); roof(c, e, .2, .7, 2.55, 1.8, 36, 23, '#a47b56');
      window(c, e, .65, 2.45, 24); window(c, e, 1.8, 2.45, 24); window(c, e, 2.7, 1.05, 21, 'right');
      door(c, e, 1.25, 2.46, .5, 23); box(c, e, .45, 2.65, 2.1, .34, 3, ['#baac85', '#998f68', '#c9bb94']);
      for (let x = .45; x < 2.7; x += .66) line(c, p(e, x, 2.9), p(e, x, 2.9, 26), '#706145', 2.3);
      roof(c, e, .3, 2.45, 2.4, .6, 27, 7, '#9f7453');
      const banner = p(e, 1.85, 2.96, 30); polygon(c, [banner, { x: banner.x + 10, y: banner.y + 5 }, { x: banner.x + 10, y: banner.y + 22 }, { x: banner.x + 5, y: banner.y + 25 }, { x: banner.x, y: banner.y + 20 }], team); line(c, { x: banner.x + 5, y: banner.y + 9 }, { x: banner.x + 5, y: banner.y + 18 }, '#c2cfa7', 1);
      break;
    case 'house':
      box(c, e, .2, .25, 1.55, 1.45, 23); timber(c, e, .2, .25, 1.55, 1.45, 23); door(c, e, .82, 1.71, .36, 16); window(c, e, .34, 1.71, 13, 'left', .25, 6); window(c, e, 1.75, .53, 14, 'right'); roof(c, e, .12, .2, 1.7, 1.55, 25, 20, '#a78157'); box(c, e, .35, .35, .25, .25, 46, ['#aba586', '#8d9176', '#bcb394'], true, 30); flag(c, e, 1.65, 1.85, 0, e.owner, time); break;
    case 'mill': {
      box(c, e, .55, .5, 1, 1, 42, ['#ccbc90', '#a08e65', '#d9c69a']); timber(c, e, .55, .5, 1, 1, 42); roof(c, e, .5, .45, 1.1, 1.1, 44, 20, '#9b7952'); door(c, e, .9, 1.51, .32, 18);
      const hub = p(e, 1.13, 1.65, 44); c.save(); c.translate(hub.x, hub.y); c.rotate(time * .17 + .3);
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); line(c, { x: 0, y: 0 }, { x: 34, y: 0 }, '#63573a', 2.8); polygon(c, [{ x: 9, y: -2 }, { x: 34, y: -2 }, { x: 34, y: -12 }, { x: 12, y: -9 }], '#ded1a5', '#8c8053'); for (let x = 13; x < 34; x += 4) line(c, { x, y: -2 }, { x, y: -10 }, '#af9e75', .7); }
      oval(c, 0, 0, 3, 3, '#e2d2a9'); c.restore(); logs(c, e, .15, 1.8, 2); break;
    }
    case 'farm': {
      polygon(c, [p(e), p(e, 2, 0), p(e, 2, 2), p(e, 0, 2)], '#776645', '#a89462');
      for (let x = .16; x < 2; x += .23) { line(c, p(e, x, .08), p(e, x, 1.92), '#4d573830', 6); for (let y = .12; y < 1.9; y += .17) { const a = p(e, x, y); line(c, a, { x: a.x + 1, y: a.y - 6 }, '#bcb978', 1.2); line(c, { x: a.x + 1, y: a.y - 3 }, { x: a.x - 2, y: a.y - 5 }, '#ccd191', 1); line(c, { x: a.x + 1, y: a.y - 4 }, { x: a.x + 3, y: a.y - 6 }, '#d3c993', 1); } }
      for (let y = .15; y < 2; y += .5) line(c, p(e, 0, y), p(e, 0, y, 7), '#8b7852', 1.5); line(c, p(e, 0, .05, 4), p(e, 0, 1.95, 4), '#a19160', 1); break;
    }
    case 'lumbercamp':
      box(c, e, .1, .15, 1.35, 1.1, 19, ['#af9a6e', '#786e4e', '#b09d76']); timber(c, e, .1, .15, 1.35, 1.1, 19); roof(c, e, .06, .1, 1.45, 1.2, 20, 16, '#85816a'); door(c, e, .57, 1.26, .4, 17); logs(c, e, .3, 1.65, 8); logs(c, e, 1.65, 1.2, 4); flag(c, e, 1.7, .3, 18, e.owner, time); break;
    case 'miningcamp':
      box(c, e, .2, .25, 1.45, 1.15, 14, ['#948b6b', '#78735a', '#aca181']); roof(c, e, .1, .2, 1.65, 1.3, 15, 20, '#6b7d75'); door(c, e, .7, 1.4, .4, 15); logs(c, e, 1.7, 1.5, 3); flag(c, e, 1.8, 1.8, 7, e.owner, time); break;
    case 'barracks': case 'archery': case 'stable': case 'siege':
      box(c, e, .2, .25, 2.6, 1.4, 30, ['#c5b58e', '#a09473', '#e0c9a0']); timber(c, e, .2, .25, 2.6, 1.4, 30); door(c, e, 1.1, 1.66, .65, 25); window(c, e, .37, 1.66, 18); window(c, e, 2.27, 1.66, 18); roof(c, e, .15, .18, 2.7, 1.55, 32, 22, e.type === 'stable' ? '#90764f' : '#966b4d'); flag(c, e, .4, 1.9, 26, e.owner, time, true); flag(c, e, 2.5, .55, 43, e.owner, time);
      if (e.type === 'archery') { const a = p(e, 2.75, 1.94, 12); oval(c, a.x, a.y, 7, 9, '#d8c79c'); oval(c, a.x, a.y, 5, 6, '#ae6853'); oval(c, a.x, a.y, 2, 3, '#decf9b'); line(c, { x: a.x, y: a.y + 6 }, { x: a.x + 5, y: a.y + 17 }, '#716342', 2); }
      else if (e.type === 'stable') { const a = p(e, 2.4, 1.8); horse(c, a.x, a.y, '#735c3e', 0, .65); }
      else if (e.type === 'siege') drawRam(c, { x: e.x + 2.65, y: e.y + 1.7, owner: e.owner }, .65);
      else { const a = p(e, 2.6, 1.9); line(c, { x: a.x - 8, y: a.y - 22 }, { x: a.x + 3, y: a.y + 2 }, '#abb9ac', 2); line(c, { x: a.x + 7, y: a.y - 22 }, { x: a.x - 4, y: a.y + 2 }, '#a2afa5', 2); oval(c, a.x - 1, a.y - 11, 6, 8, team); }
      break;
    case 'blacksmith':
      box(c, e, .15, .2, 1.7, 1.5, 26, ['#b2a986', '#8c927c', '#c3b992'], true); door(c, e, .65, 1.7, .65, 20); roof(c, e, .1, .15, 1.8, 1.6, 27, 20, '#6f7970'); box(c, e, .3, .35, .45, .45, 61, ['#9c9f87', '#787f6f', '#b1ad90'], true, 29);
      const chim = p(e, .52, .57, 65); for (let i = 0; i < 3; i++) { const yy = (time * 9 + i * 12) % 36; oval(c, chim.x + yy * .15, chim.y - yy, 4 + yy * .1, 2.5 + yy * .09, `rgba(204,204,170,${.28 - yy / 160})`); }
      box(c, e, 1.75, 1.8, .35, .3, 9, ['#6b756b', '#4b5c55', '#a5aa90']); flag(c, e, 1.8, .3, 20, e.owner, time); break;
    case 'market':
      box(c, e, .2, .2, 2.6, 1.5, 20, ['#b8a676', '#91845a', '#c7b680']); door(c, e, .55, 1.7, .4, 18); door(c, e, 1.85, 1.7, .4, 18); roof(c, e, .1, .1, 2.8, 1.7, 22, 25, '#a8b090');
      for (let xx = .1; xx < 2.8; xx += .55) polygon(c, [p(e, xx, 1, 47), p(e, xx + .26, 1, 47), p(e, xx + .26, 1.92, 22), p(e, xx, 1.92, 22)], team + 'bb');
      logs(c, e, .35, 1.93, 2); flag(c, e, 2.6, 1.7, 25, e.owner, time, true); break;
    case 'tower':
      battlements(c, e, .1, .1, .8, .8, 63); window(c, e, .35, .9, 42, 'left', .2, 13); window(c, e, .9, .36, 39, 'right', .2, 13); door(c, e, .37, .91, .25, 19); flag(c, e, .5, .5, 69, e.owner, time); break;
    case 'castle':
      battlements(c, e, .35, .4, 3.3, 3.2, 44);
      box(c, e, 1.3, 1.05, 1.45, 1.55, 86, ['#c1bea0', '#979f8a', '#d1c6a8'], true); window(c, e, 1.7, 2.61, 65, 'left', .28, 12); window(c, e, 2.3, 2.61, 65, 'left', .28, 12); pyramid(c, e, 1.22, .97, 1.6, 1.7, 88, 31); flag(c, e, 2, 1.8, 118, e.owner, time, true);
      battlements(c, e, .02, .05, .95, .95, 69); battlements(c, e, 3.04, .05, .95, .95, 69); battlements(c, e, .02, 3, .95, .95, 73); battlements(c, e, 3.04, 3, .95, .95, 73);
      window(c, e, .35, 3.95, 51, 'left', .22, 13); window(c, e, 3.99, 3.33, 48, 'right', .22, 13); door(c, e, 1.62, 3.61, .8, 31); flag(c, e, 3.5, 3.5, 79, e.owner, time); break;
  }
  if (e.progress < 1 && !ghost) {
    c.globalAlpha = 1;
    for (let x = .15; x < e.w; x += 1) { line(c, p(e, x, e.d + .1), p(e, x, e.d + .1, 50), '#92794f', 2); line(c, p(e, x, e.d + .1, 24), p(e, Math.min(e.w, x + .9), e.d + .1, 48), '#a88c5c', 1.5); }
    line(c, p(e, .15, e.d + .1, 28), p(e, e.w - .1, e.d + .1, 28), '#b0915e', 2);
  }
  c.restore();
}
function horse(c, x, y, color, anim = 0, scale = 1) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  oval(c, 2, -9, 12, 6, color); polygon(c, [{ x: 7, y: -10 }, { x: 8, y: -22 }, { x: 13, y: -26 }, { x: 19, y: -20 }, { x: 17, y: -15 }, { x: 12, y: -17 }, { x: 12, y: -8 }], color, '#423e2c66');
  line(c, { x: 8, y: -19 }, { x: 7, y: -9 }, '#443d2d', 2.5); line(c, { x: -9, y: -10 }, { x: -16, y: -5 }, '#4a4030', 2);
  for (let k = 0; k < 4; k++) { const xx = k < 2 ? -6 : 8; line(c, { x: xx, y: -7 }, { x: xx + Math.sin(anim * 9 + k * 2) * 3, y: 1 - (k % 2) * 3 }, color, 2.7); }
  oval(c, 15, -21, .8, .8, '#272f27'); line(c, { x: 13, y: -25 }, { x: 12, y: -28 }, color, 2); c.restore();
}
function drawRam(c, e, scale = 1) {
  c.save(); const a = iso(e.x, e.y); c.translate(a.x, a.y); c.scale(scale, scale);
  oval(c, 0, 2, 22, 9, '#24342b35');
  for (const [xx, yy] of [[-15, 1], [2, 7], [17, 1]]) { oval(c, xx, yy, 4, 5, '#524b34'); oval(c, xx, yy, 2, 3, '#9a8659'); }
  polygon(c, [{ x: -24, y: -8 }, { x: 0, y: -23 }, { x: 25, y: -10 }, { x: 0, y: 6 }], '#a9925e', '#5f583c');
  polygon(c, [{ x: -25, y: -8 }, { x: 0, y: -33 }, { x: 25, y: -11 }, { x: 0, y: -1 }], '#89907a', '#586451');
  for (let i = -16; i < 17; i += 6) line(c, { x: i, y: -17 + Math.abs(i) * .35 }, { x: i + 10, y: -10 + Math.abs(i) * .4 }, '#d0bc8666', 2);
  line(c, { x: -25, y: -8 }, { x: -33, y: -13 }, '#685637', 6); line(c, { x: -33, y: -13 }, { x: -39, y: -15 }, '#a0a38a', 7); c.restore();
}
export function drawUnit(c, e, time = 0) {
  const a = iso(e.x, e.y), moving = e.path?.length > 0, working = ['gather', 'build', 'repair', 'attack'].includes(e.order?.type) && !moving, bob = moving ? Math.sin(e.anim * 12) * 1 : 0;
  const col = TEAM[e.owner], light = TEAM_LIGHT[e.owner];
  oval(c, a.x + 2, a.y + 1, ['scout', 'knight', 'ram'].includes(e.type) ? 16 : 6, 3, '#1e302c45');
  if (e.type === 'ram') { drawRam(c, e); return; }
  c.save(); c.translate(a.x, a.y + bob);
  let z = 0;
  if (['scout', 'knight'].includes(e.type)) { horse(c, 0, 0, e.type === 'knight' ? '#696950' : '#8e7750', moving ? e.anim : 0); z = -11; }
  const leg = moving ? Math.sin(e.anim * 10) * 2 : 0;
  line(c, { x: -2, y: -5 + z }, { x: -3 + leg, y: 0 + z }, '#434b38', 2.5); line(c, { x: 2, y: -5 + z }, { x: 3 - leg, y: 0 + z }, '#434b38', 2.5);
  polygon(c, [{ x: -4, y: -15 + z }, { x: 3, y: -15 + z }, { x: 4, y: -5 + z }, { x: -4, y: -5 + z }], col, '#29484a');
  line(c, { x: -4, y: -7 + z }, { x: 4, y: -7 + z }, '#c5b18c', 1.7);
  oval(c, 0, -18 + z, 3.3, 3.5, '#d4b083');
  polygon(c, [{ x: -3, y: -20 + z }, { x: -2, y: -23 + z }, { x: 3, y: -22 + z }, { x: 4, y: -18 + z }, { x: 0, y: -20 + z }], e.type === 'villager' ? '#73664b' : '#b3bca8');
  const swing = working ? Math.sin(e.anim * 8) * 5 : 0;
  line(c, { x: 3, y: -13 + z }, { x: 7, y: -9 + z + swing }, '#d4b083', 2); line(c, { x: -3, y: -13 + z }, { x: -6, y: -8 + z }, '#c5a27a', 2);
  if (e.type === 'villager') {
    if (e.carry > 1) { if (e.carryType === 'wood') { line(c, { x: -8, y: -12 }, { x: -8, y: -23 }, '#9a7f50', 5); line(c, { x: -6, y: -12 }, { x: -5, y: -23 }, '#c5a374', 2); } else oval(c, -7, -14, 4, 5, e.carryType === 'gold' ? '#d2b168' : e.carryType === 'stone' ? '#9faaa0' : '#bdaa71'); }
    if (working) { line(c, { x: 7, y: -10 + swing }, { x: 9, y: -24 + swing }, '#a08b60', 1.5); polygon(c, [{ x: 8, y: -24 + swing }, { x: 14, y: -22 + swing }, { x: 13, y: -17 + swing }, { x: 9, y: -19 + swing }], '#a4b4ac'); }
  } else if (e.type === 'spearman') { line(c, { x: 7, y: 1 }, { x: 10, y: -34 }, '#c9b38a', 1.4); polygon(c, [{ x: 8, y: -31 }, { x: 10, y: -39 }, { x: 12, y: -31 }], '#d3d4bb'); }
  else if (['archer', 'longbow'].includes(e.type)) { c.beginPath(); c.ellipse(8, -13, 3.5, e.type === 'longbow' ? 13 : 10, 0, -Math.PI / 2, Math.PI / 2); c.strokeStyle = '#c0a471'; c.lineWidth = 1.5; c.stroke(); line(c, { x: 8, y: -23 }, { x: 8, y: -3 }, '#d0caa188', .6); line(c, { x: -5, y: -15 }, { x: -8, y: -28 }, '#a59670', 3); }
  else { line(c, { x: 7, y: -7 + z }, { x: 13, y: -25 + z + swing }, '#c4cbc1', 1.7); oval(c, -5, -10 + z, 4, 5.5, col); line(c, { x: -5, y: -14 + z }, { x: -5, y: -7 + z }, light, 1); }
  c.restore();
}
function drawTree(c, e) {
  const a = iso(e.x, e.y), t = e.style, h = 27 + t * 18;
  oval(c, a.x + 12, a.y + 3, 18 + t * 7, 7, '#1c392638');
  line(c, { x: a.x, y: a.y }, { x: a.x, y: a.y - h + 8 }, '#676044', 4.5); line(c, { x: a.x - 1, y: a.y }, { x: a.x - 1, y: a.y - 17 }, '#9d8860', 1.6);
  if (t > .54) {
    for (let i = 0; i < 3; i++) {
      const w = 15 - i * 3.2 + t * 6, yy = a.y - 12 - i * 12;
      polygon(c, [{ x: a.x - w, y: yy }, { x: a.x - w * .7, y: yy - 4 }, { x: a.x - w * .9, y: yy - 3 }, { x: a.x, y: yy - 24 }, { x: a.x + w, y: yy - 1 }, { x: a.x + w * .68, y: yy + 1 }, { x: a.x + w * .4, y: yy + 4 }, { x: a.x - w * .4, y: yy + 4 }], ['#34533c', '#426747', '#54754a'][i], '#2f4b3560');
      line(c, { x: a.x - w + 2, y: yy }, { x: a.x - 1, y: yy - 20 }, '#90a16b32', 1);
    }
  } else {
    const palette = t < .15 ? ['#4d6340', '#627a49', '#788c51', '#8c9a5f'] : ['#354f3d', '#466544', '#59764a', '#758953'];
    for (let i = 0; i < 7; i++) {
      const angle = i / 7 * Math.PI * 2, xx = a.x + Math.cos(angle) * 12, yy = a.y - h + Math.sin(angle) * 7;
      const pts = [];
      for (let j = 0; j < 11; j++) { const ang = j / 11 * Math.PI * 2, r = 11 + hash(e.x, i, j) * 4; pts.push({ x: xx + Math.cos(ang) * r, y: yy + Math.sin(ang) * r * .9 }); }
      polygon(c, pts, palette[(i + 1) % 4], '#2e493844');
    }
    oval(c, a.x - 5, a.y - h - 7, 6, 4, '#acb27718');
  }
}
function drawResource(c, e) {
  if (e.type === 'tree') return drawTree(c, e);
  const a = iso(e.x, e.y);
  oval(c, a.x + 4, a.y + 2, 13, 5, '#23362a30');
  if (e.type === 'berries') {
    for (let i = 0; i < 4; i++) { const x = a.x + Math.cos(i * 2) * 7, y = a.y - 6 + Math.sin(i * 2) * 3; oval(c, x, y, 7, 6, i % 2 ? '#607448' : '#3d5c3d'); for (let j = 0; j < 3; j++) oval(c, x + hash(i, j, e.x) * 7 - 3, y - hash(i, j, e.y) * 5, 1.4, 1.2, '#c38473'); }
  } else {
    for (let i = 0; i < 3; i++) {
      const xx = a.x + (i - 1) * 8, yy = a.y + (i % 2) * 2, h = 6 + hash(e.x, e.y, i) * 6;
      polygon(c, [{ x: xx - 7, y: yy }, { x: xx - 5, y: yy - h }, { x: xx + 3, y: yy - h - 3 }, { x: xx + 8, y: yy - 5 }, { x: xx + 6, y: yy + 1 }], e.type === 'gold' ? '#91836a' : '#8c978a', '#525f4c88');
      polygon(c, [{ x: xx - 5, y: yy - h }, { x: xx + 3, y: yy - h - 3 }, { x: xx + 8, y: yy - 5 }, { x: xx, y: yy - 3 }], e.type === 'gold' ? '#a69770' : '#b4bcaa');
      if (e.type === 'gold') { line(c, { x: xx - 3, y: yy - h + 1 }, { x: xx + 2, y: yy - 4 }, '#dfbf6a', 2.6); line(c, { x: xx + 2, y: yy - h }, { x: xx + 6, y: yy - 6 }, '#d1ad61', 1.8); }
    }
  }
}
function drawRuins(c, e) {
  box(c, e, 0, 0, 2, 2, 3, ['#8e9d85', '#75856d', '#a1aa91']);
  box(c, e, .1, .1, .5, .5, 35, ['#aeb397', '#808e7a', '#c2c5a8'], true); box(c, e, 1.35, .1, .5, .5, 23, ['#aeb397', '#808e7a', '#c2c5a8'], true);
  box(c, e, .12, 1.3, 1.3, .35, 9, ['#aeb397', '#808e7a', '#c2c5a8'], true); box(c, e, 1.65, 1.3, .4, .5, 16, ['#aeb397', '#808e7a', '#c2c5a8'], true);
  const a = p(e, .35, .35, 35); oval(c, a.x, a.y, 8, 4, '#879c6a');
}
export class Renderer {
  constructor(canvas, minimap, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.minimap = minimap; this.mc = minimap.getContext('2d'); this.game = game;
    this.camera = iso(17.5, 27.8); this.zoom = 1.18; this.selected = []; this.hovered = null; this.placement = null; this.drag = null; this.mouse = { x: 0, y: 0 }; this.keys = new Set();
    this.terrainCanvas = document.createElement('canvas'); this.terrainCanvas.width = SIZE * TW + 128; this.terrainCanvas.height = SIZE * TH + 180; this.terrainOffset = { x: SIZE * TW / 2 + 64, y: 65 }; this.makeTerrain();
    this.fogCanvas = document.createElement('canvas'); this.fogCanvas.width = this.terrainCanvas.width; this.fogCanvas.height = this.terrainCanvas.height; this.fogTick = -1;
    this.fogRaw = document.createElement('canvas'); this.fogRaw.width = this.fogCanvas.width; this.fogRaw.height = this.fogCanvas.height;
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
  }
  resize() { this.width = this.canvas.clientWidth; this.height = this.canvas.clientHeight; this.dpr = Math.min(window.devicePixelRatio || 1, 2); this.canvas.width = this.width * this.dpr; this.canvas.height = this.height * this.dpr; }
  screen(x, y, h = 0) { const a = iso(x, y, h); return { x: (a.x - this.camera.x) * this.zoom + this.width / 2, y: (a.y - this.camera.y) * this.zoom + this.height / 2 }; }
  world(x, y) { return uniso((x - this.width / 2) / this.zoom + this.camera.x, (y - this.height / 2) / this.zoom + this.camera.y); }
  focus(e) { if (e) this.camera = iso(center(e).x, center(e).y); }
  makeTerrain() {
    const c = this.terrainCanvas.getContext('2d'), o = this.terrainOffset;
    c.fillStyle = '#293c32'; c.fillRect(0, 0, this.terrainCanvas.width, this.terrainCanvas.height); c.translate(o.x, o.y);
    for (let sum = 0; sum < SIZE * 2; sum++) for (let x = 0; x < SIZE; x++) {
      const y = sum - x; if (y < 0 || y >= SIZE) continue;
      const a = iso(x, y), corners = [a, iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], n = hash(x, y), water = terrain(x + .5, y + .5) === 'water';
      const fertile = .5 + Math.sin(x * .26) * .18 + Math.cos(y * .22) * .12;
      if (water) {
        polygon(c, corners, `hsl(${170 + n * 8},${18 + n * 8}%,${32 + n * 4}%)`);
        for (let i = 0; i < 3; i++) { const p = iso(x + hash(x, y, i + 1), y + hash(x, y, i + 4)); line(c, p, { x: p.x + 6 + n * 5, y: p.y }, '#b3c9ad25', .7); }
      } else {
        const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => terrain(x + dx + .5, y + dy + .5) === 'water');
        const path = Math.min(Math.hypot(x - 17, y - 27), Math.hypot(x - 34, y - 13));
        const soil = path < 4.5 || (Math.abs(x - 15) < 1.2 && y > 21 && y < 34) || (Math.abs(y - 27) < .85 && x > 10 && x < 23) || (Math.abs(x - y - 17) < 1.2 && x > 25 && x < 37);
        const hue = coast ? 61 : soil ? 49 : 76 + fertile * 8, sat = coast ? 21 : soil ? 23 : 23 + fertile * 3, light = coast ? 57 + n * 4 : soil ? 53 + n * 4 : 41 + fertile * 7 + n * 3;
        polygon(c, corners, `hsl(${hue},${sat}%,${light}%)`);
        for (let i = 0; i < 7; i++) {
          const xx = x + hash(x, y, i + 1), yy = y + hash(y, x, i + 3), b = iso(xx, yy);
          if (soil) { oval(c, b.x, b.y, 1 + hash(i, x) * 1.1, .5, '#645d4323'); }
          else { const h = 2 + hash(x, y, i + 8) * 3; line(c, b, { x: b.x - 1, y: b.y - h }, '#b9bd823a', .65); line(c, b, { x: b.x + 2, y: b.y - h * .8 }, '#4d663542', .65); }
        }
        if (!soil && n > .97) { const b = iso(x + .5, y + .5); for (let i = 0; i < 3; i++) oval(c, b.x + i * 4, b.y + Math.sin(i) * 2, .9, .8, n > .987 ? '#d5c38a' : '#c8c2ae'); }
      }
    }
    // A soft, winding road links the frontier clearings.
    c.save(); c.globalAlpha = .26; c.lineCap = 'round'; c.lineJoin = 'round';
    const road = [[18, 27], [22, 27], [24, 24], [26, 21], [29, 20], [31, 17], [34, 14]].map(([x, y]) => iso(x, y));
    c.beginPath(); c.moveTo(road[0].x, road[0].y); for (let i = 1; i < road.length - 1; i++) c.quadraticCurveTo(road[i].x, road[i].y, (road[i].x + road[i + 1].x) / 2, (road[i].y + road[i + 1].y) / 2); c.lineTo(road.at(-1).x, road.at(-1).y); c.strokeStyle = '#d8c79a'; c.lineWidth = 17; c.stroke(); c.restore();
  }
  makeFog() {
    const c = this.fogRaw.getContext('2d'), o = this.terrainOffset; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.fogRaw.width, this.fogRaw.height); c.translate(o.x, o.y);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x; if (this.game.visible[i]) continue;
      const explored = this.game.explored[i];
      polygon(c, [iso(x, y), iso(x + 1.01, y), iso(x + 1.01, y + 1.01), iso(x, y + 1.01)], explored ? '#1a2a2966' : '#1c2c2bdc');
    }
    const fc = this.fogCanvas.getContext('2d'); fc.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height); fc.filter = 'blur(10px)'; fc.drawImage(this.fogRaw, 0, 0); fc.filter = 'none';
  }
  cameraUpdate(dt) {
    let x = 0, y = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('a')) x -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('d')) x += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('w')) y -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('s')) y += 1;
    this.camera.x += x * 580 / this.zoom * dt; this.camera.y += y * 420 / this.zoom * dt;
    this.camera.x = Math.max(-SIZE * 29, Math.min(SIZE * 29, this.camera.x)); this.camera.y = Math.max(140, Math.min(SIZE * 29, this.camera.y));
  }
  draw(now) {
    const c = this.ctx, game = this.game; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.fillStyle = '#2b3c33'; c.fillRect(0, 0, this.width, this.height);
    c.save(); c.translate(this.width / 2, this.height / 2); c.scale(this.zoom, this.zoom); c.translate(-this.camera.x, -this.camera.y);
    c.drawImage(this.terrainCanvas, -this.terrainOffset.x, -this.terrainOffset.y);
    const selectedIds = new Set(this.selected.map(e => e.id));
    const objects = game.entities.filter(e => {
      if (!e.alive || e.garrison) return false; if (e.owner === 1 && !game.isVisible(e)) return false;
      const a = this.screen(center(e).x, center(e).y); return a.x > -180 && a.x < this.width + 180 && a.y > -90 && a.y < this.height + 200;
    }).sort((a, b) => (a.x + a.y + (a.kind === 'building' ? (a.w + a.d) / 2 - .2 : 0)) - (b.x + b.y + (b.kind === 'building' ? (b.w + b.d) / 2 - .2 : 0)));
    // Fields sit below units and architecture, regardless of their depth.
    objects.filter(e => e.type === 'farm').forEach(e => { if (selectedIds.has(e.id) || this.hovered?.id === e.id) this.selectionRing(c, e, selectedIds.has(e.id)); drawBuilding(c, e, now); });
    for (const e of objects) {
      if (e.type === 'farm') continue;
      if (selectedIds.has(e.id) || this.hovered?.id === e.id) this.selectionRing(c, e, selectedIds.has(e.id));
      if (e.kind === 'building') drawBuilding(c, e, now);
      else if (e.kind === 'unit') drawUnit(c, e, now);
      else if (e.kind === 'resource') drawResource(c, e);
      else drawRuins(c, e);
      if (e.hp && (e.hp < e.maxHp || selectedIds.has(e.id) || this.hovered?.id === e.id)) this.healthbar(c, e);
    }
    for (const b of this.selected.filter(b => b.kind === 'building' && b.rally)) {
      const a = center(b); line(c, iso(a.x, a.y), iso(b.rally.x, b.rally.y), '#c4c79a55', 1); flag(c, { x: b.rally.x, y: b.rally.y }, 0, 0, 0, b.owner, now);
    }
    for (const effect of game.effects) this.effect(c, effect);
    if (this.fogTick !== Math.floor(game.time * 2)) { this.fogTick = Math.floor(game.time * 2); this.makeFog(); }
    c.drawImage(this.fogCanvas, -this.terrainOffset.x, -this.terrainOffset.y);
    if (this.placement) {
      const { type, x, y } = this.placement, d = BUILDINGS[type], valid = game.validPlacement(type, x, y) && game.explored[y * SIZE + x];
      c.globalAlpha = .55; drawBuilding(c, { type, x, y, w: d.w, d: d.d, owner: 0, progress: 1 }, now, true); c.globalAlpha = 1;
      polygon(c, [iso(x, y), iso(x + d.w, y), iso(x + d.w, y + d.d), iso(x, y + d.d)], valid ? '#a3c98033' : '#d8696944', valid ? '#d5e2ad' : '#f58a78');
    }
    c.restore();
    if (this.drag && this.drag.box) {
      const a = this.drag.start, b = this.mouse; c.fillStyle = '#dce7b619'; c.strokeStyle = '#d9dfb8'; c.lineWidth = 1; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    this.drawMinimap();
  }
  selectionRing(c, e, selected) {
    const col = e.owner === 1 ? '#e79a7a' : selected ? '#ead198' : '#e0dfb4';
    if (e.kind === 'building') { polygon(c, [p(e, -.15, -.15), p(e, e.w + .15, -.15), p(e, e.w + .15, e.d + .15), p(e, -.15, e.d + .15)], selected ? '#eee7b112' : null, col); }
    else { const a = iso(e.x, e.y); c.beginPath(); c.ellipse(a.x, a.y + 1, e.type === 'scout' || e.type === 'knight' ? 19 : 10, e.type === 'scout' || e.type === 'knight' ? 8 : 4.5, 0, 0, Math.PI * 2); c.strokeStyle = col; c.lineWidth = selected ? 1.4 : .8; c.stroke(); }
  }
  healthbar(c, e) {
    const a = iso(center(e).x, center(e).y, e.kind === 'building' ? e.type === 'towncenter' ? 99 : e.type === 'castle' ? 130 : e.type === 'tower' ? 88 : e.type === 'farm' ? 9 : 68 : ['scout', 'knight'].includes(e.type) ? 45 : 32), w = e.kind === 'building' ? 52 : 24;
    c.fillStyle = '#26382be0'; c.fillRect(a.x - w / 2 - 1, a.y - 1, w + 2, 5); c.fillStyle = e.owner === 0 ? '#adc38f' : '#d19173'; c.fillRect(a.x - w / 2, a.y, w * Math.max(0, e.hp / e.maxHp), 3);
    if (e.kind === 'building' && e.progress < 1) { c.fillStyle = '#d5b778'; c.fillRect(a.x - w / 2, a.y + 6, w * e.progress, 2); }
  }
  effect(c, e) {
    const a = iso(e.x, e.y), t = e.life / e.maxLife;
    if (e.type === 'marker') { c.save(); c.globalAlpha = t; c.strokeStyle = e.attack ? '#e59678' : '#e0d49c'; c.lineWidth = 2; c.beginPath(); c.ellipse(a.x, a.y, 20 * (1.3 - t * .4), 9 * (1.3 - t * .4), 0, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 4; i++) { const xx = Math.cos(i * Math.PI / 2) * 8, yy = Math.sin(i * Math.PI / 2) * 4; line(c, { x: a.x + xx, y: a.y + yy }, a, c.strokeStyle, 1); } c.restore(); }
    if (e.type === 'arrow') { const b = iso(e.from.x, e.from.y, 24), end = iso(e.x, e.y, 14), x = b.x * t + end.x * (1 - t), y = b.y * t + end.y * (1 - t) - Math.sin(t * Math.PI) * 27; line(c, { x, y }, { x: x + (end.x - b.x) * .05, y: y + (end.y - b.y) * .05 }, '#ddd2a1', 1.6); }
    if (e.type === 'hit') { c.save(); c.globalAlpha = t; line(c, { x: a.x - 4, y: a.y - 12 }, { x: a.x + 4, y: a.y - 20 }, '#e7d3a1', 1.4); c.restore(); }
    if (e.type === 'death') oval(c, a.x, a.y, 6, 2, e.owner ? '#8a5d4244' : '#596f6244');
    if (e.type === 'collapse') { c.save(); c.globalAlpha = t; for (let i = 0; i < 8; i++) oval(c, a.x + Math.cos(i) * (1 - t) * 40, a.y + Math.sin(i) * (1 - t) * 20 - 10, 13 + (1 - t) * 10, 10 + (1 - t) * 7, '#c9bd97a0'); c.restore(); }
  }
  pick(x, y) {
    const world = this.world(x, y), candidates = [];
    for (const e of this.game.entities) {
      if (!e.alive || e.garrison || e.kind === 'doodad' || (e.owner === 1 && !this.game.isVisible(e))) continue;
      if (e.kind === 'unit') { const a = this.screen(e.x, e.y, ['scout', 'knight'].includes(e.type) ? 15 : 10); if (Math.hypot(x - a.x, (y - a.y) * .8) < (e.type === 'ram' ? 25 : e.type === 'scout' || e.type === 'knight' ? 20 : 13) * this.zoom) candidates.push({ e, priority: 3, depth: e.x + e.y }); }
      else if (e.kind === 'building') {
        if (world.x >= e.x && world.x <= e.x + e.w && world.y >= e.y && world.y <= e.y + e.d) candidates.push({ e, priority: 2, depth: e.x + e.y + e.w / 2 + e.d / 2 });
        else if (e.type !== 'farm') { const a = this.screen(e.x + e.w / 2, e.y + e.d / 2, 28); if (Math.abs(x - a.x) < e.w * 19 * this.zoom && Math.abs(y - a.y) < 32 * this.zoom) candidates.push({ e, priority: 1, depth: e.x + e.y + e.w / 2 + e.d / 2 }); }
      } else if (e.kind === 'resource') {
        const idx = Math.floor(e.y) * SIZE + Math.floor(e.x); if (!this.game.explored[idx]) continue;
        const a = this.screen(e.x, e.y, e.type === 'tree' ? 23 : 5); if (Math.hypot(x - a.x, (y - a.y) * .7) < (e.type === 'tree' ? 21 : 13) * this.zoom) candidates.push({ e, priority: 1, depth: e.x + e.y });
      }
    }
    return candidates.sort((a, b) => b.priority - a.priority || b.depth - a.depth)[0]?.e || null;
  }
  drawMinimap() {
    const c = this.mc, w = this.minimap.width, h = this.minimap.height, scale = Math.min((w - 14) / (SIZE * 2), (h - 10) / SIZE), ox = w / 2, oy = 5;
    this.mini = { scale, ox, oy };
    c.fillStyle = '#14201f'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x, xx = ox + (x - y) * scale, yy = oy + (x + y) * scale * .5;
      const col = !this.game.explored[i] ? '#273833' : terrain(x, y) === 'water' ? '#597d71' : this.game.visible[i] ? '#879267' : '#4f624c';
      polygon(c, [{ x: xx, y: yy }, { x: xx + scale, y: yy + scale / 2 }, { x: xx, y: yy + scale }, { x: xx - scale, y: yy + scale / 2 }], col);
    }
    this.game.entities.filter(e => e.alive && !e.garrison).forEach(e => {
      const a = center(e), xx = ox + (a.x - a.y) * scale, yy = oy + (a.x + a.y) * scale * .5;
      if (e.owner === -1 && this.game.explored[Math.floor(a.y) * SIZE + Math.floor(a.x)]) { c.fillStyle = e.type === 'tree' ? '#354e3c' : e.type === 'gold' ? '#c4af6b' : '#8a9b83'; c.fillRect(xx, yy, 1.4, 1.4); }
      else if (e.owner === 0 || e.owner === 1 && this.game.isVisible(e)) { c.fillStyle = e.owner === 0 ? '#83c2d3' : '#d8896f'; const sz = e.kind === 'building' ? Math.max(e.w, e.d) * scale * .65 : 2; c.fillRect(xx - sz / 2, yy - sz / 2, sz, sz); if (e.type === 'towncenter') { c.strokeStyle = '#e0dbb0'; c.lineWidth = .7; c.strokeRect(xx - sz / 2 - 1, yy - sz / 2 - 1, sz + 2, sz + 2); } }
    });
    const a = this.world(0, 0), b = this.world(this.width, 0), cc = this.world(this.width, this.height), d = this.world(0, this.height);
    polygon(c, [a, b, cc, d].map(p => ({ x: ox + (p.x - p.y) * scale, y: oy + (p.x + p.y) * scale * .5 })), '#dedc9c08', '#dedc9caa');
  }
  minimapFocus(x, y) { const { scale, ox, oy } = this.mini; this.camera = iso(((x - ox) / scale + (y - oy) / scale * 2) / 2, ((y - oy) / scale * 2 - (x - ox) / scale) / 2); }
  portrait(canvas, entity) {
    const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); if (!entity) return;
    c.save();
    const mid = center(entity), base = iso(mid.x, mid.y);
    if (entity.kind === 'building') { const sc = entity.type === 'castle' ? .59 : entity.type === 'towncenter' ? .69 : .84; c.translate(canvas.width / 2, canvas.height / 2 + 40); c.scale(sc, sc); c.translate(-base.x, -base.y); drawBuilding(c, { ...entity, progress: 1 }, 1); }
    else if (entity.kind === 'unit') { const sc = entity.type === 'ram' ? 1.55 : ['scout', 'knight'].includes(entity.type) ? 2.5 : 3.6; c.translate(canvas.width / 2, canvas.height / 2 + 35); c.scale(sc, sc); c.translate(-base.x, -base.y); drawUnit(c, { ...entity, anim: 0, path: [], order: { type: 'idle' } }); }
    else { c.translate(canvas.width / 2, canvas.height / 2 + 20); c.scale(1.6, 1.6); c.translate(-base.x, -base.y); drawResource(c, entity); }
    c.restore();
  }
}
