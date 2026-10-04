'use strict';
// ---------------------------------------------------------------------------
// Vector unit art. Everything is drawn facing right with feet at (0,0);
// the caller mirrors the canvas for left-facing units.
// ---------------------------------------------------------------------------
const SKIN = '#e2b48a';
const OUT = 'rgba(25,15,5,0.75)';

function atkCurve(p) { // 0..1 -> 0..1 swing amount: windup then strike then recover
  if (p < 0.35) return -0.6 * (p / 0.35);
  if (p < 0.55) return -0.6 + 1.6 * ((p - 0.35) / 0.2);
  return 1.0 * (1 - (p - 0.55) / 0.45);
}

function limb(c, x0, y0, x1, y1, w, col) {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}

function drawWeapon(c, kind, hx, hy, ang, o, look) {
  // ang: 0 = pointing straight up, positive = rotating forward (clockwise toward +x)
  c.save(); c.translate(hx, hy); c.rotate(ang);
  c.lineCap = 'round';
  switch (kind) {
    case 'sword': {
      c.fillStyle = '#d9dde2'; c.strokeStyle = OUT; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-1.1, -2); c.lineTo(-1.1, -13); c.lineTo(0, -15); c.lineTo(1.1, -13); c.lineTo(1.1, -2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#c8a24b'; c.fillRect(-3, -2.4, 6, 1.8); c.fillStyle = '#4a2a14'; c.fillRect(-0.9, -0.6, 1.8, 3.4);
      break;
    }
    case 'twohand': {
      c.fillStyle = '#e4e8ee'; c.strokeStyle = OUT; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-1.5, -3); c.lineTo(-1.5, -19); c.lineTo(0, -22); c.lineTo(1.5, -19); c.lineTo(1.5, -3); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#c8a24b'; c.fillRect(-4.5, -3.4, 9, 2); c.fillStyle = '#3a2a1a'; c.fillRect(-1, -1.4, 2, 6);
      break;
    }
    case 'spear': case 'pike': case 'halberd': case 'lance': {
      const L = kind === 'pike' ? 32 : kind === 'lance' ? 26 : kind === 'halberd' ? 28 : 26;
      c.strokeStyle = '#7a5530'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -L); c.stroke();
      c.fillStyle = '#d9dde2'; c.strokeStyle = OUT; c.lineWidth = 0.7;
      if (kind === 'halberd') {
        c.beginPath(); c.moveTo(0, -L - 5); c.lineTo(1.4, -L); c.lineTo(5, -L + 2); c.lineTo(5, -L + 8); c.lineTo(1.4, -L + 5); c.lineTo(0, -L + 8); c.closePath(); c.fill(); c.stroke();
      } else {
        c.beginPath(); c.moveTo(0, -L - 6); c.lineTo(2.2, -L); c.lineTo(0, -L + 1); c.lineTo(-2.2, -L); c.closePath(); c.fill(); c.stroke();
      }
      if (kind === 'lance') { c.fillStyle = o.tc; c.beginPath(); c.moveTo(0, -L + 2); c.lineTo(7, -L + 5); c.lineTo(0, -L + 9); c.closePath(); c.fill(); }
      break;
    }
    case 'javelin': {
      c.strokeStyle = '#7a5530'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -16); c.stroke();
      c.fillStyle = '#cfd3d8'; c.beginPath(); c.moveTo(0, -20); c.lineTo(1.6, -16); c.lineTo(-1.6, -16); c.closePath(); c.fill();
      break;
    }
    case 'axe': {
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -11); c.stroke();
      c.fillStyle = '#b8bdc4'; c.strokeStyle = OUT; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(0, -11); c.lineTo(5.5, -13.5); c.lineTo(5, -6.5); c.lineTo(0, -8); c.closePath(); c.fill(); c.stroke();
      break;
    }
    case 'pick': {
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -12); c.stroke();
      c.strokeStyle = '#9aa0a8'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, -10); c.quadraticCurveTo(0, -15, 6, -10); c.stroke();
      break;
    }
    case 'hoe': {
      c.strokeStyle = '#7a5530'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -15); c.stroke();
      c.fillStyle = '#9aa0a8'; c.beginPath(); c.moveTo(0, -15); c.lineTo(5, -14); c.lineTo(5, -12); c.lineTo(0, -12); c.closePath(); c.fill();
      break;
    }
    case 'hammer': {
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 3); c.lineTo(0, -9); c.stroke();
      c.fillStyle = '#7a7e86'; c.fillRect(-4, -12, 8, 4.4); c.strokeStyle = OUT; c.lineWidth = 0.6; c.strokeRect(-4, -12, 8, 4.4);
      break;
    }
    case 'staff': {
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -26); c.stroke();
      c.strokeStyle = '#e8c860'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, -22); c.moveTo(-3, -27); c.lineTo(3, -27); c.stroke();
      break;
    }
    case 'tool': break;
  }
  c.restore();
}

function drawBow(c, kind, hx, hy, pull, o) {
  // bow held at (hx,hy), vertical
  c.save(); c.translate(hx, hy);
  const R = kind === 'longbow' ? 13 : kind === 'crossbow' ? 6 : 9;
  c.strokeStyle = kind === 'crossbow' ? '#4a3320' : '#7a5530'; c.lineWidth = kind === 'longbow' ? 2 : 1.7; c.lineCap = 'round';
  if (kind === 'crossbow') {
    c.beginPath(); c.moveTo(-1, 0); c.lineTo(-10, 1); c.stroke();
    c.strokeStyle = '#5a4a2a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(4, -6); c.quadraticCurveTo(7, 0, 4, 6); c.stroke();
    c.strokeStyle = 'rgba(240,240,230,0.8)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(4, -6); c.lineTo(1 - pull * 3, 0); c.lineTo(4, 6); c.stroke();
    if (pull < 0.9) { c.strokeStyle = '#d9dde2'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4, 0); c.lineTo(6, 0); c.stroke(); }
  } else {
    c.beginPath(); c.moveTo(0, -R); c.quadraticCurveTo(R * 0.8, 0, 0, R); c.stroke();
    c.strokeStyle = 'rgba(240,240,230,0.85)'; c.lineWidth = 0.7;
    const px = -pull * 6;
    c.beginPath(); c.moveTo(0, -R); c.lineTo(px, 0); c.lineTo(0, R); c.stroke();
    if (pull < 0.95) { c.strokeStyle = '#d8d0b8'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(px, 0); c.lineTo(px + (kind === 'longbow' ? 16 : 11), 0); c.stroke(); c.fillStyle = '#c8ccd2'; c.fillRect(px + (kind === 'longbow' ? 16 : 11), -1, 2.5, 2); }
  }
  c.restore();
}

function drawHead(c, look, x, y, o) {
  const tc = o.tc, helm = look.helm || 'none';
  c.save(); c.translate(x, y);
  // neck/face
  c.fillStyle = SKIN; c.strokeStyle = OUT; c.lineWidth = 0.8;
  c.beginPath(); c.arc(0, 0, 4.2, 0, TAU); c.fill(); c.stroke();
  const hair = look.hair || '#4a3020';
  const metal = '#aeb4bc', metalD = '#7c828a';
  if (!o.back) { c.fillStyle = '#2a1a10'; c.fillRect(1.9, -0.8, 1.2, 1.2); }
  const hairCap = () => { c.fillStyle = hair; c.beginPath(); c.arc(0, -0.4, 4.4, Math.PI * 1.02, Math.PI * (o.back ? 2 : 1.85)); c.lineTo(-1, -1); c.closePath(); c.fill(); if (o.back) { c.beginPath(); c.arc(0, 0, 4.3, 0, TAU); c.fill(); } };
  switch (helm) {
    case 'none': hairCap(); break;
    case 'cap': c.fillStyle = look.tunic === 'team' ? shade(tc, -0.2) : '#7a5a3a'; c.beginPath(); c.arc(0, -0.8, 4.6, Math.PI, 0); c.closePath(); c.fill(); c.strokeStyle = OUT; c.stroke(); break;
    case 'kettle':
      c.fillStyle = metal; c.beginPath(); c.arc(0, -1, 4.6, Math.PI, 0); c.fill(); c.strokeStyle = OUT; c.stroke();
      c.fillStyle = metalD; c.beginPath(); c.ellipse(0, -0.8, 7, 1.8, 0, 0, TAU); c.fill(); c.stroke(); break;
    case 'nasal':
      c.fillStyle = metal; c.beginPath(); c.moveTo(-4.6, 0); c.quadraticCurveTo(-4.4, -6.5, 0, -7.2); c.quadraticCurveTo(4.4, -6.5, 4.6, 0); c.closePath(); c.fill(); c.strokeStyle = OUT; c.stroke();
      if (!o.back) { c.fillStyle = metalD; c.fillRect(2.2, -1, 1.3, 4.2); } break;
    case 'great':
      c.fillStyle = metal; c.beginPath(); c.rect(-4.8, -6, 9.6, 10); c.fill(); c.strokeStyle = OUT; c.stroke();
      c.fillStyle = metalD; c.beginPath(); c.moveTo(-4.8, -6); c.quadraticCurveTo(0, -9.5, 4.8, -6); c.closePath(); c.fill(); c.stroke();
      if (!o.back) { c.fillStyle = '#1a1a1e'; c.fillRect(0.4, -1.8, 4.2, 1.4); c.fillRect(2.4, -0.4, 0.8, 3.8); }
      if (look.plume) { c.fillStyle = tc; c.beginPath(); c.moveTo(-1, -8); c.quadraticCurveTo(-8, -13, -10, -5); c.quadraticCurveTo(-5, -8, -1, -6); c.fill(); }
      break;
    case 'hood':
      c.fillStyle = look.tunic === 'team' ? shade(tc, -0.3) : '#3a5a2a'; c.beginPath(); c.moveTo(-4.8, 1.5); c.quadraticCurveTo(-5, -5, 0, -8.2); c.quadraticCurveTo(5, -5, 4.8, 1.5); c.lineTo(3, -1.5); c.quadraticCurveTo(0, -3.4, -3, -1.2); c.closePath(); c.fill(); c.strokeStyle = OUT; c.stroke();
      if (o.back) { c.fill(); } break;
    case 'fur':
      c.fillStyle = '#6a4a2e'; c.beginPath(); c.ellipse(0, -2.2, 5.6, 3.8, 0, 0, TAU); c.fill(); c.strokeStyle = OUT; c.stroke();
      c.fillStyle = '#8a6a44'; c.beginPath(); c.ellipse(0, -4.2, 3.4, 1.8, 0, 0, TAU); c.fill(); break;
    case 'tonsure':
      c.fillStyle = '#6a4a2a'; c.beginPath(); c.arc(0, 0, 4.4, Math.PI * 0.95, Math.PI * 1.15); c.arc(0, 0, 4.4, Math.PI * 1.85, Math.PI * 2.05); c.fill();
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -0.2, 4, Math.PI * 0.85, Math.PI * 0.15, true); c.stroke(); break;
  }
  c.restore();
}

function drawHuman(c, look, o, rise, mounted) {
  const tc = o.tc;
  const tun = look.tunic === 'team' ? tc : (look.tunic || '#8a6a4a');
  const pants = look.pants || '#5a4a3a';
  const moving = o.moving, ph = o.phase;
  const robe = look.tunic && look.tunic !== 'team' && look.helm === 'tonsure';
  const bob = mounted ? 0 : moving ? Math.abs(Math.sin(ph)) * 1.3 : Math.sin(o.time * 2 + o.seed) * 0.35;
  const Y = (y) => y - rise;
  c.save(); c.translate(0, -bob);
  c.lineJoin = 'round';
  // legs
  if (!mounted) {
    const sw = moving ? 4.6 : 0.0;
    for (const s of [-1, 1]) {
      const fx = Math.sin(ph) * sw * s, lift = moving ? Math.max(0, Math.cos(ph) * s) * 2.4 : 0;
      limb(c, s * 0.8, -12, fx + (s > 0 ? 1.5 : -0.5), -lift, 3.4, robe ? tun : pants);
      c.fillStyle = '#3a2a1e'; c.beginPath(); c.ellipse(fx + (s > 0 ? 2.2 : 0.2), -lift, 2.4, 1.5, 0, 0, TAU); c.fill();
    }
  } else {
    limb(c, 1, Y(-12), 4, Y(-4), 3.4, pants);
    c.fillStyle = '#3a2a1e'; c.beginPath(); c.ellipse(4.8, Y(-3.5), 2.2, 1.4, 0, 0, TAU); c.fill();
  }
  // cape
  if (look.cape) {
    c.fillStyle = look.teamTabard ? '#f0efe8' : shade(tc, -0.25);
    c.beginPath(); c.moveTo(-3.5, Y(-25)); c.quadraticCurveTo(-9, Y(-18), -8 - Math.sin(ph) * (moving ? 2 : 0), Y(-8)); c.lineTo(-2, Y(-12)); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.7; c.stroke();
  }
  // back arm
  const shY = Y(-24.5);
  const armBackX = moving ? -Math.sin(ph) * 3.5 : -1;
  limb(c, -2.5, shY, -3 + armBackX, shY + 8.5, 2.9, tun);
  c.fillStyle = SKIN; c.beginPath(); c.arc(-3 + armBackX, shY + 9.2, 1.7, 0, TAU); c.fill();
  // carry bundle on back
  if (o.carry && o.carry.amount > 0) {
    const ct = o.carry.type;
    c.save(); c.translate(-6, Y(-22));
    if (ct === 'wood') { for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#8a6a3c' : '#a07a48'; c.fillRect(-4, -3 + i * 2.6 - 4, 9, 2.4); c.strokeStyle = OUT; c.lineWidth = 0.5; c.strokeRect(-4, -3 + i * 2.6 - 4, 9, 2.4); } }
    else if (ct === 'food') { c.fillStyle = '#c9a56a'; c.beginPath(); c.ellipse(0, -2, 5, 4.5, 0, 0, TAU); c.fill(); c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#c4412c'; c.beginPath(); c.arc(-1.5, -4, 1.5, 0, TAU); c.arc(1.5, -3, 1.4, 0, TAU); c.fill(); }
    else if (ct === 'gold') { c.fillStyle = '#6a5a3a'; c.beginPath(); c.ellipse(0, -2, 4.6, 4.5, 0, 0, TAU); c.fill(); c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#f1c232'; c.beginPath(); c.arc(-1, -3.5, 1.7, 0, TAU); c.arc(1.6, -2, 1.5, 0, TAU); c.fill(); }
    else { c.fillStyle = '#6a6a70'; c.beginPath(); c.ellipse(0, -2, 4.6, 4.5, 0, 0, TAU); c.fill(); c.strokeStyle = OUT; c.stroke(); c.fillStyle = '#b5b5b8'; c.beginPath(); c.arc(-1, -3.5, 1.6, 0, TAU); c.fill(); }
    c.restore();
  }
  // torso
  const tY0 = Y(-25), tY1 = robe ? Y(-3) : Y(-12.5);
  c.fillStyle = tun; c.strokeStyle = OUT; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(-4.6, tY0); c.quadraticCurveTo(0, tY0 - 2, 4.6, tY0);
  if (robe) { c.lineTo(5.6, tY1); c.quadraticCurveTo(0, tY1 + 1.5, -5.6, tY1); } else { c.lineTo(4.2, tY1); c.lineTo(-4.2, tY1); }
  c.closePath(); c.fill(); c.stroke();
  // armour overlay
  const ar = look.armor;
  if (ar === 'mail' || ar === 'plate' || ar === 'leather') {
    const col = ar === 'mail' ? '#9ca3ab' : ar === 'plate' ? '#c6ccd4' : '#7a5230';
    c.fillStyle = col; c.beginPath(); c.moveTo(-4.4, tY0 + 0.4); c.lineTo(4.4, tY0 + 0.4); c.lineTo(3.9, tY0 + 8.5); c.lineTo(-3.9, tY0 + 8.5); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = ar === 'plate' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.25)'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(-3, tY0 + 3); c.lineTo(3, tY0 + 3); c.moveTo(-3, tY0 + 6); c.lineTo(3, tY0 + 6); c.stroke();
    if (ar === 'plate') { c.fillStyle = col; c.beginPath(); c.arc(-4.6, tY0 + 0.5, 2.2, 0, TAU); c.arc(4.6, tY0 + 0.5, 2.2, 0, TAU); c.fill(); c.strokeStyle = OUT; c.stroke(); }
  }
  if (look.teamTabard) { c.fillStyle = '#f2f0ea'; c.fillRect(-3.8, tY0 + 1, 7.6, 11); c.fillStyle = tc; c.fillRect(-0.9, tY0 + 1.5, 1.8, 9); c.fillRect(-2.8, tY0 + 4, 5.6, 1.8); }
  // belt
  if (!robe) { c.fillStyle = '#3a2616'; c.fillRect(-4.3, Y(-15), 8.6, 1.6); }
  // head
  drawHead(c, look, 0.4, Y(-29.8), o);
  // shield (front)
  const sh = look.shield;
  if (sh && sh !== 'none' && !(o.act === 'gather')) {
    c.save(); c.translate(1.8, Y(-18.5));
    if (sh === 'round') {
      c.fillStyle = tc; c.beginPath(); c.arc(0, 0, 5.8, 0, TAU); c.fill(); c.strokeStyle = '#d9d2c0'; c.lineWidth = 1.4; c.stroke();
      c.fillStyle = '#d9d2c0'; c.beginPath(); c.arc(0, 0, 1.6, 0, TAU); c.fill();
    } else {
      c.fillStyle = tc; c.beginPath(); c.moveTo(-4.5, -6); c.lineTo(4.5, -6); c.lineTo(4.5, 1); c.quadraticCurveTo(4, 5.5, 0, 8); c.quadraticCurveTo(-4, 5.5, -4.5, 1); c.closePath(); c.fill();
      c.strokeStyle = '#d9d2c0'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = '#d9d2c0'; c.fillRect(-0.7, -5, 1.4, 11); c.fillRect(-3.5, -2, 7, 1.4);
    }
    c.restore();
  }
  // front arm + weapon
  const w = look.weapon || 'none';
  const sx = 2.8, sy = shY;
  let hx, hy, wa;
  const p = o.actP;
  if (o.act === 'attack' || (o.act === 'cast')) {
    const s = atkCurve(p);
    if (w === 'bow' || w === 'longbow' || w === 'crossbow') {
      const pull = p < 0.6 ? p / 0.6 : 0;
      limb(c, sx, sy, sx + 9, sy + 2.5, 2.9, tun);
      c.fillStyle = SKIN; c.beginPath(); c.arc(sx + 9.6, sy + 2.5, 1.7, 0, TAU); c.fill();
      drawBow(c, w, sx + 10, sy + 2.5, pull, o);
      limb(c, sx - 1, sy + 1, sx + 10 - pull * 6, sy + 2.5, 2.4, tun);
      c.restore(); return;
    }
    if (w === 'spear' || w === 'pike' || w === 'halberd' || w === 'lance' || w === 'javelin') {
      const th = w === 'javelin' ? (s * 4) : (Math.max(0, s) * 7 - 2);
      hx = sx + 6 + th; hy = sy + 3 + (w === 'lance' ? 0 : 0);
      wa = Math.PI / 2 - 0.15 + (w === 'javelin' ? -0.6 * (1 - Math.max(0, s)) : 0);
    } else if (w === 'twohand') {
      hx = sx + 5 + s * 2; hy = sy + 2 - s * 4; wa = -0.6 + s * 2.8;
    } else {
      hx = sx + 5 + Math.max(0, s) * 2; hy = sy + 2 - s * 4; wa = -0.7 + (s + 0.6) * 2.4;
    }
  } else if (o.act === 'gather' || o.act === 'build') {
    const s = Math.sin(p * TAU - 0.5);
    hx = sx + 5; hy = sy - 1 - Math.max(0, s) * 5; wa = 0.2 + (s > 0 ? 0.3 : 1.7 - s * 0.6);
  } else if (o.act === 'heal') {
    hx = sx + 5; hy = sy - 2 - Math.sin(p * TAU) * 2; wa = 0.1;
  } else {
    const swing = moving ? Math.sin(ph) * 2.2 : 0;
    hx = sx + 4.2 + swing * 0.5; hy = sy + 7; wa = w === 'sword' || w === 'twohand' ? 0.5 : (w === 'spear' || w === 'pike' || w === 'halberd' || w === 'lance' ? 0.12 : 0.1);
    if (w === 'twohand') { wa = 0.35; hy = sy + 3; hx = sx + 4; }
    if (w === 'bow' || w === 'longbow' || w === 'crossbow') { hx = sx + 4; hy = sy + 6; }
    if (w === 'lance') { hy = sy + 5; wa = 1.45; }
  }
  limb(c, sx, sy, hx, hy, 2.9, tun);
  c.fillStyle = SKIN; c.beginPath(); c.arc(hx, hy, 1.8, 0, TAU); c.fill();
  if (w === 'bow' || w === 'longbow' || w === 'crossbow') { drawBow(c, w, hx + 0.5, hy - 1, 0, o); }
  else if (w === 'tool') {
    if (o.act === 'gather' || o.act === 'build') drawWeapon(c, o.tool || 'axe', hx, hy, wa, o, look);
    else if (o.tool === 'basket' && o.act === 'idle') { /* nothing */ }
  } else {
    drawWeapon(c, w, hx, hy, wa, o, look);
  }
  if (w === 'twohand') { limb(c, sx - 1, sy + 1, hx - 1, hy + 2, 2.6, tun); }
  c.restore();
}

function drawHorse(c, look, o) {
  const col = look.horse || '#8a5a32', dk = shade(col, -0.35), lt = shade(col, 0.2);
  const ph = o.phase, mv = o.moving;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const bob = mv ? Math.sin(ph * 2) * 1.2 : Math.sin(o.time * 1.7 + o.seed) * 0.3;
  c.translate(0, -bob);
  // tail
  c.strokeStyle = dk; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, -19); c.quadraticCurveTo(-16, -17 + Math.sin(o.time * 3 + o.seed) * 1.5, -15, -8); c.stroke();
  const leg = (x, k, rear) => {
    const a = mv ? Math.sin(ph + k) * 5.5 : 0, lift = mv ? Math.max(0, Math.cos(ph + k)) * 3.5 : 0;
    c.strokeStyle = dk; c.lineWidth = 2.8;
    c.beginPath(); c.moveTo(x, -14); c.lineTo(x + a * 0.6 + (rear ? -1.5 : 1), -7 - lift * 0.6); c.lineTo(x + a, -lift); c.stroke();
    c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(x + a + 0.6, -lift, 2, 1.2, 0, 0, TAU); c.fill();
  };
  leg(-8, 0, true); leg(7, Math.PI * 0.9, false);
  // body
  const g = c.createLinearGradient(0, -24, 0, -11);
  g.addColorStop(0, lt); g.addColorStop(0.5, col); g.addColorStop(1, dk);
  c.fillStyle = g; c.strokeStyle = OUT; c.lineWidth = 0.9;
  c.beginPath(); c.ellipse(-0.5, -17.5, 12.5, 5.8, 0, 0, TAU); c.fill(); c.stroke();
  // neck + head
  c.fillStyle = col; c.beginPath(); c.moveTo(7, -21); c.quadraticCurveTo(12, -29, 13.5, -30.5); c.lineTo(17.5, -26.5); c.quadraticCurveTo(12, -19, 10, -13); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(17.2, -26.8, 4.6, 2.5, 0.75, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#1a1010'; if (!o.back) c.fillRect(16, -29, 1.2, 1.2);
  c.strokeStyle = dk; c.lineWidth = 2; c.beginPath(); c.moveTo(11.5, -29.5); c.quadraticCurveTo(8, -26, 8, -21); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(12.5, -30.5); c.lineTo(13.2, -34); c.lineTo(15, -30.8); c.closePath(); c.fill();
  leg(-6, Math.PI, true); leg(9, 0.0, false);
  if (look.mount === 'armored') {
    // caparison
    c.fillStyle = o.tc; c.strokeStyle = OUT; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-9, -22); c.quadraticCurveTo(0, -25, 9, -22); c.lineTo(10, -10); c.lineTo(6, -12); c.lineTo(2, -9.5); c.lineTo(-2, -12); c.lineTo(-6, -9.5); c.lineTo(-10, -11); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#e8d8a0'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-9.5, -10.8); c.lineTo(-6, -9.5); c.lineTo(-2, -12); c.lineTo(2, -9.5); c.lineTo(6, -12); c.lineTo(10, -10); c.stroke();
    c.fillStyle = '#c4cad2'; c.beginPath(); c.moveTo(14.5, -29.5); c.lineTo(20, -27); c.lineTo(19, -25.5); c.lineTo(13, -26); c.closePath(); c.fill(); c.stroke();
  }
  // saddle
  c.fillStyle = '#4a2a14'; c.fillRect(-3, -23.5, 7, 2.2);
  c.restore();
}

function drawRam(c, look, o) {
  c.save(); c.lineJoin = 'round';
  const wob = o.moving ? Math.sin(o.phase * 1.5) * 0.6 : 0;
  c.translate(0, -wob);
  const sw = o.act === 'attack' ? Math.sin(clamp(o.actP, 0, 1) * Math.PI) * 9 : 0;
  // frame & wheels
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(0, 1, 22, 6, 0, 0, TAU); c.fill();
  // log
  c.fillStyle = '#6a4a2a'; c.strokeStyle = OUT; c.lineWidth = 0.9;
  c.beginPath(); c.roundRect(-18 + sw, -11, 34, 5.5, 2); c.fill(); c.stroke();
  c.fillStyle = look.capped || look.siege ? '#8a9098' : '#5a5e66';
  c.beginPath(); c.moveTo(16 + sw, -12); c.lineTo(23 + sw, -8.2); c.lineTo(16 + sw, -4.5); c.closePath(); c.fill(); c.stroke();
  // legs / posts
  c.strokeStyle = '#4a3320'; c.lineWidth = 2.6;
  for (const x of [-14, 14]) { c.beginPath(); c.moveTo(x, -22); c.lineTo(x, -3); c.stroke(); }
  // roof
  const rc = look.siege ? '#5a4a3a' : look.capped ? '#7a4a2a' : '#8a6a3a';
  c.fillStyle = rc; c.beginPath(); c.moveTo(-20, -20); c.lineTo(-12, -30); c.lineTo(12, -30); c.lineTo(20, -20); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; for (let x = -14; x < 14; x += 5) { c.beginPath(); c.moveTo(x, -30); c.lineTo(x * 1.3, -20.5); c.stroke(); }
  c.fillStyle = o.tc; c.beginPath(); c.moveTo(-9, -28.5); c.lineTo(9, -28.5); c.lineTo(11, -22); c.lineTo(-11, -22); c.closePath(); c.fill();
  // wheels
  for (const x of [-12, 12]) {
    c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(x, -3.5, 4.5, 0, TAU); c.fill(); c.strokeStyle = '#8a6a3a'; c.lineWidth = 1; c.stroke();
    c.save(); c.translate(x, -3.5); c.rotate(o.phase * 0.8); c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke(); c.restore();
  }
  c.restore();
}

function drawMangonel(c, look, o) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(0, 1, 20, 6, 0, 0, TAU); c.fill();
  c.fillStyle = '#6a4a2a'; c.strokeStyle = OUT; c.lineWidth = 0.9;
  c.beginPath(); c.roundRect(-18, -11, 36, 5, 2); c.fill(); c.stroke();
  c.strokeStyle = '#4a3320'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, -9); c.lineTo(-4, -24); c.moveTo(8, -9); c.lineTo(2, -24); c.stroke();
  const p = o.act === 'attack' ? atkCurve(o.actP) : -0.5;
  const ang = -2.2 + (p + 0.6) * 1.9;
  c.save(); c.translate(-1, -24); c.rotate(ang);
  c.strokeStyle = '#7a5530'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(-6, 0); c.lineTo(24, 0); c.stroke();
  c.fillStyle = '#5a5a5a'; c.beginPath(); c.arc(25, 0, 4.2, 0, Math.PI, true); c.fill();
  if (!(o.act === 'attack' && o.actP > 0.45)) { c.fillStyle = look.heavy ? '#b5b5b8' : '#8a8a90'; c.beginPath(); c.arc(25, -3.4, 3, 0, TAU); c.fill(); }
  c.restore();
  c.fillStyle = o.tc; c.fillRect(-16, -14, 8, 3);
  for (const x of [-12, 12]) { c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(x, -4, 5, 0, TAU); c.fill(); c.strokeStyle = '#8a6a3a'; c.lineWidth = 1; c.stroke(); c.save(); c.translate(x, -4); c.rotate(o.phase * 0.7); c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.moveTo(0, -5); c.lineTo(0, 5); c.stroke(); c.restore(); }
  c.restore();
}

function drawTreb(c, look, o) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(0, 1, 24, 7, 0, 0, TAU); c.fill();
  c.fillStyle = '#6a4a2a'; c.strokeStyle = OUT; c.lineWidth = 0.9;
  c.beginPath(); c.roundRect(-20, -9, 40, 5, 2); c.fill(); c.stroke();
  c.strokeStyle = '#4a3320'; c.lineWidth = 3.4;
  c.beginPath(); c.moveTo(-12, -8); c.lineTo(0, -40); c.lineTo(12, -8); c.moveTo(-6, -24); c.lineTo(6, -24); c.stroke();
  const p = o.act === 'attack' ? atkCurve(o.actP) : -0.55;
  const ang = -2.4 + (p + 0.6) * 2.2;
  c.save(); c.translate(0, -40); c.rotate(ang);
  c.strokeStyle = '#7a5530'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-14, 0); c.lineTo(34, 0); c.stroke();
  c.fillStyle = '#5a5e66'; c.fillRect(-20, -1, 10, 9); c.strokeStyle = OUT; c.strokeRect(-20, -1, 10, 9);
  c.strokeStyle = '#b8a888'; c.lineWidth = 1; c.beginPath(); c.moveTo(34, 0); c.lineTo(38, 8); c.stroke();
  c.fillStyle = '#7a7a80'; c.beginPath(); c.arc(38, 9, 2.6, 0, TAU); c.fill();
  c.restore();
  c.fillStyle = o.tc; c.fillRect(-8, -42, 7, 4);
  for (const x of [-15, 15]) { c.fillStyle = '#3a2a1a'; c.beginPath(); c.arc(x, -4, 5, 0, TAU); c.fill(); c.strokeStyle = '#8a6a3a'; c.lineWidth = 1; c.stroke(); }
  c.restore();
}

// Public entry: draw figure at current origin, facing right.
function drawFigure(c, look, o) {
  const m = look.mount;
  if (m === 'ram') return drawRam(c, look, o);
  if (m === 'mangonel') return drawMangonel(c, look, o);
  if (m === 'treb') return drawTreb(c, look, o);
  if (m === 'horse' || m === 'armored') {
    drawHorse(c, look, o);
    const bob = o.moving ? Math.sin(o.phase * 2) * 1.2 : 0;
    c.save(); c.translate(1, 0 - bob * 0.2);
    drawHuman(c, look, Object.assign({}, o, { moving: false }), 8.5, true);
    c.restore();
    return;
  }
  drawHuman(c, look, o, 0, false);
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const IconCache = {};
function iconBG(c, w, h, col1, col2) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, col1); g.addColorStop(1, col2);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

function unitIcon(typeId, team = 0) {
  const key = 'u|' + typeId + '|' + team;
  if (IconCache[key]) return IconCache[key];
  const def = UNITS[typeId];
  const cv = mkCanvas(64, 64); const c = cv.getContext('2d');
  iconBG(c, 64, 64, '#566a7c', '#2b3744');
  c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.arc(32, 30, 26, 0, TAU); c.fill();
  c.save();
  const big = def.look.mount === 'treb' || def.look.mount === 'ram' || def.look.mount === 'mangonel';
  const hasHorse = def.look.mount === 'horse' || def.look.mount === 'armored';
  const sc = big ? 1.15 : hasHorse ? 1.45 : 1.9;
  c.translate(32 + (hasHorse ? -3 : 0), 57 - (big ? 4 : 0));
  c.scale(sc, sc);
  drawFigure(c, def.look, { tc: TEAM_COLORS[team], phase: 0.4, moving: false, act: 'idle', actP: 0, time: 0, seed: 1, back: false, carry: null, tool: 'axe' });
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.strokeRect(1, 1, 62, 62);
  return (IconCache[key] = cv.toDataURL());
}

function buildingIcon(typeId, age = 1, team = 0) {
  const key = 'b|' + typeId + '|' + age + '|' + team;
  if (IconCache[key]) return IconCache[key];
  const cv = mkCanvas(64, 64); const c = cv.getContext('2d');
  iconBG(c, 64, 64, '#6a8a56', '#38502c');
  const def = BUILDINGS[typeId];
  const sp = getBuildingSprite(typeId, Math.max(age, typeId === 'castle' || typeId === 'university' ? 2 : 0), team, 3);
  const sc = Math.min(58 / sp.W, 58 / sp.H) * 1.12;
  c.save();
  c.translate(32, 33);
  c.scale(sc, sc);
  c.drawImage(sp.cv, -sp.W / 2, -sp.H / 2 + (def.size > 2 ? 8 : 4), sp.W, sp.H);
  c.restore();
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.strokeRect(1, 1, 62, 62);
  return (IconCache[key] = cv.toDataURL());
}

function glyphIcon(glyph, colA = '#6b7e92', colB = '#2e3b49', extra) {
  const key = 'g|' + glyph + '|' + colA + (extra || '');
  if (IconCache[key]) return IconCache[key];
  const cv = mkCanvas(64, 64); const c = cv.getContext('2d');
  iconBG(c, 64, 64, colA, colB);
  c.translate(32, 32); c.lineCap = 'round'; c.lineJoin = 'round';
  const S = (col, lw) => { c.strokeStyle = col; c.lineWidth = lw; };
  const gold = '#f0c84a', steel = '#dfe4ea', wood = '#a97c45', dark = 'rgba(0,0,0,0.6)';
  switch (glyph) {
    case 'sword':
      c.rotate(-0.78); c.fillStyle = steel; c.strokeStyle = dark; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-3, 14); c.lineTo(-3, -18); c.lineTo(0, -24); c.lineTo(3, -18); c.lineTo(3, 14); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = gold; c.fillRect(-10, 14, 20, 4); c.fillStyle = '#5a3a1a'; c.fillRect(-2.5, 18, 5, 8); c.strokeRect(-10, 14, 20, 4); break;
    case 'armor': case 'shield':
      c.fillStyle = glyph === 'armor' ? '#a9b2bd' : '#4a6fb5'; c.strokeStyle = dark; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-17, -18); c.lineTo(17, -18); c.lineTo(17, 2); c.quadraticCurveTo(14, 18, 0, 24); c.quadraticCurveTo(-14, 18, -17, 2); c.closePath(); c.fill(); c.stroke();
      S(glyph === 'armor' ? '#f4f6f8' : gold, 3); c.beginPath(); c.moveTo(0, -16); c.lineTo(0, 20); c.moveTo(-14, -4); c.lineTo(14, -4); c.stroke(); break;
    case 'horseshoe':
      S(steel, 6); c.beginPath(); c.arc(0, 2, 15, Math.PI * 0.75, Math.PI * 2.25, false); c.stroke(); S('#555', 1.4); c.beginPath(); c.arc(0, 2, 15, Math.PI * 0.75, Math.PI * 2.25); c.stroke(); break;
    case 'bow':
      S(wood, 4); c.beginPath(); c.moveTo(-8, -22); c.quadraticCurveTo(22, 0, -8, 22); c.stroke();
      S('#eee', 1.4); c.beginPath(); c.moveTo(-8, -22); c.lineTo(-8, 22); c.stroke();
      S(steel, 2.4); c.beginPath(); c.moveTo(-18, 0); c.lineTo(18, 0); c.stroke(); c.fillStyle = steel; c.beginPath(); c.moveTo(22, 0); c.lineTo(15, -4); c.lineTo(15, 4); c.fill(); break;
    case 'axe':
      c.rotate(0.6); S('#7a5530', 4); c.beginPath(); c.moveTo(0, 22); c.lineTo(0, -16); c.stroke();
      c.fillStyle = steel; c.strokeStyle = dark; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -20); c.lineTo(16, -24); c.quadraticCurveTo(20, -12, 16, -2); c.lineTo(0, -6); c.closePath(); c.fill(); c.stroke(); break;
    case 'pick':
      c.rotate(0.6); S('#7a5530', 4); c.beginPath(); c.moveTo(0, 22); c.lineTo(0, -14); c.stroke();
      S(steel, 5); c.beginPath(); c.moveTo(-18, -8); c.quadraticCurveTo(0, -24, 18, -8); c.stroke(); break;
    case 'wheat':
      S(gold, 2.4); for (const dx of [-9, 0, 9]) { c.beginPath(); c.moveTo(dx, 22); c.lineTo(dx, -12); c.stroke(); c.fillStyle = '#f0d060'; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(dx - 3, -10 + i * 5, 3, 1.6, -0.6, 0, TAU); c.ellipse(dx + 3, -12 + i * 5, 3, 1.6, 0.6, 0, TAU); c.fill(); } } break;
    case 'cart':
      c.fillStyle = wood; c.strokeStyle = dark; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-18, -8); c.lineTo(16, -8); c.lineTo(12, 8); c.lineTo(-14, 8); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#4a3320'; c.beginPath(); c.arc(-6, 14, 7, 0, TAU); c.fill(); c.stroke(); c.fillStyle = steel; c.beginPath(); c.arc(-6, 14, 2, 0, TAU); c.fill();
      S(wood, 3); c.beginPath(); c.moveTo(16, -8); c.lineTo(26, -14); c.stroke(); break;
    case 'loom':
      S(wood, 3); c.strokeRect(-16, -16, 32, 32); S('#e8e0d0', 1.5); for (let i = -12; i <= 12; i += 4) { c.beginPath(); c.moveTo(i, -16); c.lineTo(i, 16); c.stroke(); }
      S('#c4412c', 3); c.beginPath(); c.moveTo(-16, 2); c.lineTo(16, 2); c.stroke(); break;
    case 'eye':
      c.fillStyle = '#f4f4ee'; c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(0, -20, 22, 0); c.quadraticCurveTo(0, 20, -22, 0); c.fill(); c.stroke();
      c.fillStyle = '#3a7ab8'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, 3.5, 0, TAU); c.fill(); break;
    case 'boot':
      c.fillStyle = '#7a5230'; c.strokeStyle = dark; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-10, -20); c.lineTo(6, -20); c.lineTo(6, 4); c.lineTo(20, 10); c.lineTo(20, 20); c.lineTo(-10, 20); c.closePath(); c.fill(); c.stroke(); break;
    case 'heart':
      c.fillStyle = '#d83a3a'; c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 20); c.bezierCurveTo(-30, -2, -14, -22, 0, -8); c.bezierCurveTo(14, -22, 30, -2, 0, 20); c.fill(); c.stroke(); break;
    case 'ring':
      S(gold, 6); c.beginPath(); c.arc(0, 4, 13, 0, TAU); c.stroke(); c.fillStyle = '#d8403a'; c.beginPath(); c.arc(0, -11, 6, 0, TAU); c.fill(); break;
    case 'brick':
      for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { c.fillStyle = r % 2 ? '#b0a090' : '#c0b0a0'; const x = -22 + k * 15 + (r % 2) * 7, y = -18 + r * 9; c.fillRect(x, y, 14, 8); c.strokeStyle = dark; c.lineWidth = 1; c.strokeRect(x, y, 14, 8); } break;
    case 'hammer':
      c.rotate(0.7); S('#7a5530', 4); c.beginPath(); c.moveTo(0, 22); c.lineTo(0, -8); c.stroke(); c.fillStyle = '#8a8e96'; c.fillRect(-12, -18, 24, 11); c.strokeStyle = dark; c.lineWidth = 1.5; c.strokeRect(-12, -18, 24, 11); break;
    case 'flask':
      c.fillStyle = 'rgba(200,230,255,0.9)'; c.strokeStyle = dark; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, -20); c.lineTo(5, -20); c.lineTo(5, -6); c.lineTo(17, 16); c.lineTo(-17, 16); c.lineTo(-5, -6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#6ad06a'; c.beginPath(); c.moveTo(-9, 6); c.lineTo(9, 6); c.lineTo(15, 15); c.lineTo(-15, 15); c.closePath(); c.fill(); break;
    case 'tower':
      c.fillStyle = '#a8a294'; c.strokeStyle = dark; c.lineWidth = 1.6; c.fillRect(-9, -8, 18, 28); c.strokeRect(-9, -8, 18, 28);
      for (let i = 0; i < 3; i++) { c.fillRect(-12 + i * 9, -16, 6, 9); c.strokeRect(-12 + i * 9, -16, 6, 9); } c.fillStyle = '#222'; c.fillRect(-2, 2, 4, 9); break;
    case 'cross':
      S(gold, 6); c.beginPath(); c.moveTo(0, -20); c.lineTo(0, 20); c.moveTo(-13, -7); c.lineTo(13, -7); c.stroke(); break;
    case 'scroll':
      c.fillStyle = '#efe0b8'; c.strokeStyle = dark; c.lineWidth = 1.6; c.fillRect(-14, -18, 28, 36); c.strokeRect(-14, -18, 28, 36);
      S('#6a5030', 1.5); for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-9, -10 + i * 7); c.lineTo(9, -10 + i * 7); c.stroke(); } break;
    case 'crown':
      c.fillStyle = gold; c.strokeStyle = dark; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-18, 14); c.lineTo(-20, -12); c.lineTo(-8, 0); c.lineTo(0, -18); c.lineTo(8, 0); c.lineTo(20, -12); c.lineTo(18, 14); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#d83a3a'; c.beginPath(); c.arc(0, 6, 3, 0, TAU); c.fill(); break;
    case 'age': {
      const n = extra || 1;
      c.fillStyle = '#e8d7a0'; c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#5a3a1a'; c.font = 'bold 22px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(AGE_ROMAN[n] || 'I', 0, 2);
      S(gold, 2); c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.stroke(); break;
    }
    case 'house':
      c.fillStyle = '#d6c49a'; c.fillRect(-14, -2, 28, 20); c.fillStyle = '#bb5640'; c.beginPath(); c.moveTo(-19, -2); c.lineTo(0, -20); c.lineTo(19, -2); c.closePath(); c.fill(); break;
    case 'food': c.fillStyle = '#d8403a'; c.beginPath(); c.arc(-4, 4, 12, 0, TAU); c.arc(7, 4, 12, 0, TAU); c.fill(); S('#3a7a2a', 3); c.beginPath(); c.moveTo(1, -6); c.quadraticCurveTo(2, -14, 8, -18); c.stroke(); break;
    case 'wood': for (let i = 0; i < 3; i++) { c.fillStyle = i % 2 ? '#8a6a3c' : '#a47c46'; c.fillRect(-18, -14 + i * 10, 36, 8); c.strokeStyle = dark; c.lineWidth = 1; c.strokeRect(-18, -14 + i * 10, 36, 8); c.fillStyle = '#d9b27a'; c.beginPath(); c.ellipse(18, -10 + i * 10, 2.5, 4, 0, 0, TAU); c.fill(); } break;
    case 'gold': c.fillStyle = gold; c.strokeStyle = '#8a6200'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 17, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.stroke(); break;
    case 'stone': c.fillStyle = '#9a9aa0'; c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(-18, 12); c.lineTo(-12, -8); c.lineTo(2, -16); c.lineTo(16, -6); c.lineTo(18, 12); c.closePath(); c.fill(); c.stroke(); break;
    case 'villager': c.fillStyle = '#c9a56a'; c.beginPath(); c.arc(0, -8, 8, 0, TAU); c.fill(); c.fillStyle = '#3b82ff'; c.beginPath(); c.moveTo(-12, 20); c.quadraticCurveTo(0, -10, 12, 20); c.fill(); break;
    case 'stop': c.fillStyle = '#c8362f'; c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; c.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); } c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(-10, -4, 20, 8); break;
    case 'attackmove': c.rotate(-0.78); c.fillStyle = steel; c.strokeStyle = dark; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, 10); c.lineTo(-3, -14); c.lineTo(0, -20); c.lineTo(3, -14); c.lineTo(3, 10); c.closePath(); c.fill(); c.stroke(); c.fillStyle = gold; c.fillRect(-9, 10, 18, 3.5); c.rotate(0.78); S('#fff', 3); c.beginPath(); c.moveTo(-20, 20); c.lineTo(-8, 20); c.moveTo(-14, 14); c.lineTo(-8, 20); c.lineTo(-14, 26); c.stroke(); break;
    case 'garrison': c.fillStyle = '#a8a294'; c.strokeStyle = dark; c.lineWidth = 1.6; c.fillRect(-16, -4, 32, 22); c.strokeRect(-16, -4, 32, 22); for (let i = 0; i < 4; i++) { c.fillRect(-16 + i * 9, -10, 6, 7); } c.fillStyle = '#222'; c.beginPath(); c.moveTo(-5, 18); c.lineTo(-5, 6); c.quadraticCurveTo(0, 0, 5, 6); c.lineTo(5, 18); c.fill(); break;
    case 'rally': S('#4a3320', 3); c.beginPath(); c.moveTo(-8, 22); c.lineTo(-8, -20); c.stroke(); c.fillStyle = '#e8403a'; c.beginPath(); c.moveTo(-8, -20); c.lineTo(18, -12); c.lineTo(-8, -3); c.closePath(); c.fill(); break;
    case 'back': S('#f0e0b0', 5); c.beginPath(); c.moveTo(10, -16); c.lineTo(-8, 0); c.lineTo(10, 16); c.stroke(); break;
    case 'delete': S('#e05050', 6); c.beginPath(); c.moveTo(-14, -14); c.lineTo(14, 14); c.moveTo(14, -14); c.lineTo(-14, 14); c.stroke(); break;
    case 'repair': c.rotate(0.7); S('#7a5530', 4); c.beginPath(); c.moveTo(0, 22); c.lineTo(0, -8); c.stroke(); c.fillStyle = '#8a8e96'; c.fillRect(-12, -18, 24, 11); break;
    case 'market': c.fillStyle = '#c4412c'; c.beginPath(); c.moveTo(-20, -4); c.lineTo(20, -4); c.lineTo(16, -16); c.lineTo(-16, -16); c.closePath(); c.fill(); c.fillStyle = '#f2ead8'; for (let i = 0; i < 3; i++) c.fillRect(-16 + i * 11, -16, 5, 12); c.fillStyle = '#8a6a3a'; c.fillRect(-16, -4, 32, 20); break;
    case 'stance': c.fillStyle = '#c8362f'; c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(-16, -16); c.lineTo(16, -16); c.lineTo(16, 2); c.quadraticCurveTo(12, 16, 0, 22); c.quadraticCurveTo(-12, 16, -16, 2); c.closePath(); c.fill(); c.stroke(); break;
    case 'stand': c.fillStyle = '#3a6ab8'; c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(-16, -16); c.lineTo(16, -16); c.lineTo(16, 2); c.quadraticCurveTo(12, 16, 0, 22); c.quadraticCurveTo(-12, 16, -16, 2); c.closePath(); c.fill(); c.stroke(); break;
    case 'bell': c.fillStyle = gold; c.strokeStyle = '#6a4a10'; c.lineWidth = 2; c.beginPath(); c.moveTo(-16, 14); c.quadraticCurveTo(-14, -2, -6, -10); c.quadraticCurveTo(0, -18, 6, -10); c.quadraticCurveTo(14, -2, 16, 14); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#6a4a10'; c.beginPath(); c.arc(0, 18, 4, 0, TAU); c.fill(); c.strokeStyle = '#6a4a10'; c.beginPath(); c.moveTo(0, -14); c.lineTo(0, -22); c.stroke(); break;
    case 'idle': c.fillStyle = '#e8d070'; c.font = 'bold 22px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('zZ', 0, 0); break;
    default: c.fillStyle = '#fff'; c.fillRect(-8, -8, 16, 16);
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.strokeRect(1, 1, 62, 62);
  return (IconCache[key] = cv.toDataURL());
}

function techIcon(tech, team = 0) {
  if (tech.unitIcon) return unitIcon(tech.unitIcon, team);
  if (tech.glyph === 'age') return glyphIcon('age', '#8a7a4a', '#3a2f18', tech.toAge);
  const colors = {
    sword: ['#7a8a9a', '#33404c'], armor: ['#7a8a9a', '#33404c'], shield: ['#5a7aaa', '#2a3a58'], horseshoe: ['#8a7a6a', '#443a30'],
    bow: ['#6a8a5a', '#2c4224'], axe: ['#6a8a5a', '#2c4224'], pick: ['#8a8a6a', '#444430'], wheat: ['#9a8a4a', '#443c1a'],
    cart: ['#8a7a5a', '#443a28'], loom: ['#8a6a7a', '#442a38'], eye: ['#6a8aa0', '#2a4458'], boot: ['#8a7a6a', '#443a30'],
    heart: ['#9a5a5a', '#442424'], brick: ['#8a7a6a', '#443a30'], hammer: ['#8a7a6a', '#443a30'], flask: ['#6a8a9a', '#2c4452'],
    tower: ['#7a8a9a', '#33404c'], cross: ['#a89a6a', '#4a4020'], scroll: ['#8a7a6a', '#443a30'], crown: ['#9a8a4a', '#443c1a'], ring: ['#8a7a5a', '#443a28'],
  };
  const c = colors[tech.glyph] || ['#6b7e92', '#2e3b49'];
  return glyphIcon(tech.glyph, c[0], c[1]);
}
