// Appearance specs (palette, armor, headgear, weapons) for every humanoid unit id. `tc` = team colors {main, light, dark}.
import { SKINS, HAIRS, METAL, IRON, STEEL, DARKMETAL, GOLD, BRONZE, LEATHER, DLEATHER, WOOD, DWOOD, LINEN, CLOTH } from './units_human.js';
import { shadeHex, mixHex } from './units_core.js';

const MAIL = '#8d98a6', MAILD = '#76808d', PLATE = '#9ba7b5', PLATEB = '#b8c4d1';
const pick = (arr, v) => arr[((v % arr.length) + arr.length) % arr.length];

function who(v, o = {}) {
  const skins = o.skins || [1, 0, 2, 1, 3, 1, 0, 2];
  const hairs = o.hairs || [1, 0, 2, 3, 5, 7, 1, 4];
  return { skin: SKINS[pick(skins, v)], hair: HAIRS[pick(hairs, v >> 1)] };
}

const trousersCols = ['#7a6850', '#66603f', '#6f5a52', '#85775a', '#5c5a4c', '#76634a', '#6a5c48', '#7f6a4a'];

export const HUMAN_LOOKS = {
  // ------------------------------------------------------------ civilians
  villager(tc, v) {
    const female = (v & 1) === 1, k = (v >> 1) & 3, w = who(v, { skins: [0, 1, 1, 2, 0, 2, 3, 1] });
    const tunic = k === 1 ? shadeHex(tc.main, 0.08) : k === 3 ? shadeHex(tc.main, -0.1) : tc.main;
    const L = {
      style: 'unarmed', sc: 1, female, skin: w.skin, hair: w.hair, hairStyle: female ? (k & 1 ? 'bun' : 'long') : 'short',
      torso: { kind: 'tunic', col: tunic, skirt: female ? 0 : 4.6, belt: female ? '#c9b890' : '#5a3a1e', hemBand: shadeHex(tunic, -0.22) },
      arms: { up: tunic, fore: w.skin, col: w.skin },
      legs: { col: pick(trousersCols, v + k), boot: '#4a3424', bootH: 0.42 },
      head: { kind: 'none' },
    };
    if (female) {
      L.dress = true; L.apron = '#e6dcc2';
      L.torso = { kind: 'dress', col: tunic, belt: '#c9b890', hemBand: shadeHex(tunic, -0.2) };
      L.arms = { up: tunic, fore: k === 2 ? tunic : w.skin, col: w.skin };
      L.head = { kind: 'scarf', col: k === 0 ? '#e8dfc8' : k === 1 ? tc.light : k === 2 ? '#d8c8a0' : '#ece4d0' };
      L.legs = { col: '#6a5a48', boot: '#4a3424', bootH: 0.6 };
    } else {
      if (k === 1) L.head = { kind: 'hood', col: shadeHex(tc.main, -0.18), cowl: false };
      else if (k === 3) L.head = { kind: 'cap', col: '#8a7552' };
      if (k === 2) L.beard = L.hair;
    }
    return L;
  },

  // ------------------------------------------------------------ swordsman line
  militia(tc, v) {
    const w = who(v);
    return {
      style: 'sword1', sc: 1.0, ...w, hairStyle: 'short',
      torso: { kind: 'gambeson', col: tc.main, skirt: 4.4, belt: '#4a3220', hemBand: shadeHex(tc.main, -0.25) },
      arms: { col: tc.main, glove: '#6a4a2a', up: tc.main, fore: shadeHex(tc.main, -0.08) },
      legs: { col: '#6b5a44', boot: '#3d2a1c', bootH: 0.55 },
      head: { kind: 'cap', col: '#9a7442' },
      weapon: { kind: 'sword', len: 11.5, blade: '#c6ced8', hilt: '#5a3a22', pommel: '#9a8a6a', guard: '#8a8a8a' },
      shield: { kind: 'buckler', R: 3.1, face: '#a47440', rim: '#4a3018', inner: '#b88a56', bossCol: tc.light },
    };
  },
  man_at_arms(tc, v) {
    const w = who(v);
    return {
      style: 'sword1', sc: 1.02, ...w, hairStyle: 'short',
      torso: { kind: 'gambeson', col: tc.main, skirt: 5, belt: '#3a2a1c', hemBand: shadeHex(tc.main, -0.25), collar: MAIL, metalCollar: true },
      arms: { up: MAIL, fore: MAIL, col: MAIL, metal: true, glove: '#5a3a22' },
      legs: { col: '#4b4d58', boot: '#3a2a1c', bootH: 0.55 },
      head: { kind: 'nasal', col: STEEL, coifCol: MAILD },
      weapon: { kind: 'sword', len: 13, blade: '#d0d8e2', hilt: '#4a3322', pommel: GOLD, guard: '#9aa4ae' },
      shield: { kind: 'round', R: 5.2, face: tc.main, rim: '#7b8691', pc: tc.light, pattern: 'cross', boss: 1.4, bossCol: '#c9d0d8' },
    };
  },
  long_swordsman(tc, v) {
    const w = who(v);
    return {
      style: 'sword1', sc: 1.04, ...w, hairStyle: 'short',
      torso: { kind: 'mail', col: MAIL, metal: true, skirt: 7.2, belt: '#3a2a1c', tabard: tc.main, tabardTrim: tc.light, skirtCol: MAIL, collar: MAIL, metalCollar: true },
      arms: { up: MAIL, fore: MAIL, col: MAIL, metal: true, glove: '#4a3222', pauldron: null },
      legs: { col: MAIL, metal: true, boot: '#34261a', bootH: 0.45 },
      head: { kind: 'nasal', col: '#a8b3c0', coifCol: MAILD, pointed: true, brow: GOLD },
      weapon: { kind: 'sword', len: 17, wid: 1.9, blade: '#d8e0ea', hilt: '#3e2c1d', pommel: GOLD, guard: GOLD },
      shield: { kind: 'kite', face: tc.main, rim: '#4a4f58', pc: tc.light, W: 4.8, H: 13, bossCol: '#cbd2da' },
    };
  },
  two_handed(tc, v) {
    const w = who(v, { hairs: [5, 3, 1, 6] });
    return {
      style: 'sword2', sc: 1.06, ...w, hairStyle: 'short', build: 1.04,
      torso: { kind: 'mail', col: MAIL, metal: true, skirt: 7.5, belt: '#2f2218', tabard: tc.main, tabardTrim: tc.dark, skirtCol: tc.main, collar: MAIL, metalCollar: true },
      arms: { up: MAIL, fore: '#aeb8c4', col: MAIL, foreMetal: true, metal: true, glove: '#3a2a1c', pauldron: '#98a4b2' },
      legs: { col: MAIL, metal: true, boot: '#2f2218', bootH: 0.5, knee: '#b3bdc9' },
      head: { kind: 'greathelm', col: '#c8d1db', band: tc.main },
      weapon: { kind: 'greatsword', len: 19, wid: 2.4, blade: '#dce4ee', hilt: '#3a2a1c', pommel: GOLD, guard: GOLD },
    };
  },
  champion(tc, v) {
    const w = who(v, { hairs: [0, 7, 2] });
    return {
      style: 'sword2', sc: 1.1, ...w, hairStyle: 'short', build: 1.08,
      torso: { kind: 'plate', col: PLATE, metal: true, plate: true, skirt: 7.5, belt: '#3a2a1c', tabard: tc.main, tabardTrim: GOLD, skirtCol: tc.main, belt2: GOLD, collar: PLATEB, metalCollar: true },
      arms: { up: PLATE, fore: PLATE, col: PLATE, metal: true, foreMetal: true, glove: '#6a6f78', pauldron: PLATEB, elbow: '#c6d0dc' },
      legs: { col: PLATE, metal: true, boot: '#aab4c0', bootH: 0.5, knee: '#cdd6e0' },
      head: { kind: 'bascinet', col: PLATEB, plume: tc.main, plumeLen: 1.2 },
      back: [{ k: 'cloak', col: tc.main, len: 20, trim: GOLD }],
      weapon: { kind: 'greatsword', len: 23, wid: 2.9, blade: '#e6edf5', hilt: '#2a2018', pommel: GOLD, guard: GOLD },
    };
  },

  // ------------------------------------------------------------ spear line
  spearman(tc, v) {
    const w = who(v);
    return {
      style: 'spear', sc: 1.0, ...w, hairStyle: 'short',
      torso: { kind: 'jerkin', col: '#7e5a36', skirt: 4.2, belt: '#3a2a1c', hemBand: '#5a3e22' },
      arms: { up: tc.main, fore: tc.main, col: tc.main, glove: '#6a4a2a' },
      legs: { col: '#7a6a50', boot: '#3d2a1c', bootH: 0.5 },
      head: { kind: 'felt', col: '#8b7a5a' },
      weapon: { kind: 'spear', len: 42, grip: 0.36, head: 4.6, shaft: '#8a6035' },
      shield: { kind: 'round', R: 5.0, face: tc.main, rim: '#5a4030', pc: tc.light, pattern: 'split', boss: 1.3, bossCol: '#b9c0c8' },
    };
  },
  pikeman(tc, v) {
    const w = who(v);
    return {
      style: 'pike', sc: 1.03, ...w, hairStyle: 'short',
      torso: { kind: 'mail', col: MAIL, metal: true, skirt: 4.6, belt: '#3a2a1c', tabard: tc.main, tabardTrim: tc.dark, skirtCol: tc.main },
      arms: { up: tc.main, fore: MAIL, col: MAIL, foreMetal: true, glove: '#4a3222' },
      legs: { col: '#575a64', boot: '#34261a', bootH: 0.5 },
      head: { kind: 'kettle', col: '#98a3af' },
      weapon: { kind: 'spear', len: 56, grip: 0.31, head: 5.5, hw: 2.0, shaft: '#7a5a38', pennon: tc.main },
    };
  },
  halberdier(tc, v) {
    const w = who(v, { hairs: [1, 5, 0] });
    return {
      style: 'halberd', sc: 1.05, ...w, hairStyle: 'short', build: 1.03,
      torso: { kind: 'plate', col: '#b2bcc8', metal: true, plate: true, skirt: 5.5, belt: '#3a2a1c', tabard: tc.main, tabardTrim: tc.light, skirtCol: tc.main, collar: '#b9c3cf', metalCollar: true },
      arms: { up: tc.main, fore: '#a9b4c0', col: MAIL, foreMetal: true, glove: '#4a3222', pauldron: '#9aa6b4' },
      legs: { col: '#555865', boot: '#2f2218', bootH: 0.5, knee: '#aeb8c4' },
      head: { kind: 'sallet', col: '#c4ced8' },
      weapon: { kind: 'halberd', len: 44, grip: 0.4, shaft: '#6e4e2e', tip: '#d0d8e2' },
    };
  },

  // ------------------------------------------------------------ skirmishers / archers
  skirmisher(tc, v) {
    const w = who(v);
    return {
      style: 'javelin', sc: 0.98, ...w, hairStyle: 'short',
      torso: { kind: 'tunic', col: tc.main, skirt: 4.6, belt: '#4a3220', hemBand: shadeHex(tc.main, -0.2) },
      arms: { up: tc.main, fore: w.skin, col: w.skin, glove: null },
      legs: { col: '#6e5f48', boot: '#4a3424', bootH: 0.5 },
      head: { kind: 'hood', col: '#6a5a3a', cowl: true },
      back: [{ k: 'javelins' }],
      weapon: { kind: 'spear', len: 27, grip: 0.4, head: 3.6, hw: 1.6, shaft: '#9a7040' },
    };
  },
  elite_skirmisher(tc, v) {
    const w = who(v);
    return {
      style: 'javelin', sc: 1.0, ...w, hairStyle: 'short',
      torso: { kind: 'brigandine', col: '#5d4630', skirt: 5, belt: tc.main, hemBand: tc.main, tabard: null },
      arms: { up: tc.main, fore: '#6a5338', col: w.skin, glove: '#4a3222' },
      legs: { col: '#4e4a3a', boot: '#3a2a1c', bootH: 0.6 },
      head: { kind: 'cap', col: '#4a3a28' },
      back: [{ k: 'javelins' }],
      weapon: { kind: 'spear', len: 30, grip: 0.4, head: 4.0, hw: 1.8, shaft: '#8a6035', tip: '#dde4ec' },
    };
  },
  archer(tc, v) {
    const w = who(v);
    return {
      style: 'bow', sc: 0.98, ...w, hairStyle: 'short',
      torso: { kind: 'tunic', col: tc.main, skirt: 4.8, belt: '#4a3220', hemBand: shadeHex(tc.main, -0.2) },
      arms: { up: tc.main, fore: '#6a5338', col: w.skin, glove: null },
      legs: { col: '#6a5c46', boot: '#3d2a1c', bootH: 0.5 },
      head: { kind: 'hood', col: '#55683a', cowl: true },
      back: [{ k: 'quiver', col: '#7a5230' }],
      weapon: { kind: 'bow', len: 22, wood: '#8a5a2c', bend: 0.22, trim: '#4a3220' },
    };
  },
  crossbowman(tc, v) {
    const w = who(v);
    return {
      style: 'crossbow', sc: 1.0, ...w, hairStyle: 'short',
      torso: { kind: 'gambeson', col: tc.main, skirt: 4.4, belt: '#3a2a1c', hemBand: shadeHex(tc.main, -0.25) },
      arms: { up: tc.main, fore: '#7a5a38', col: tc.main, glove: '#4a3222' },
      legs: { col: '#5a5a64', boot: '#34261a', bootH: 0.5 },
      head: { kind: 'sallet', col: '#a5afbb' },
      weapon: { kind: 'crossbow', stock: 10, span: 6.4, wood: '#7a5230', prod: '#5e3f22', metal: '#555d68' },
    };
  },
  arbalester(tc, v) {
    const w = who(v, { hairs: [0, 3, 5] });
    return {
      style: 'crossbow', sc: 1.03, ...w, hairStyle: 'short',
      torso: { kind: 'mail', col: MAIL, metal: true, skirt: 5.6, belt: '#2f2218', tabard: tc.main, tabardTrim: tc.dark, skirtCol: tc.main },
      arms: { up: MAIL, fore: MAIL, col: MAIL, metal: true, glove: '#3a2a1c' },
      legs: { col: '#4b4d58', boot: '#2f2218', bootH: 0.55 },
      head: { kind: 'plumedhat', col: '#4e3b28', band: tc.main, plume: tc.light, plumeLen: 1.0 },
      weapon: { kind: 'crossbow', stock: 11, span: 7.6, curve: 2.0, wood: '#6a4a2c', prod: '#7a828e', metal: '#4a525c' },
    };
  },

  // ------------------------------------------------------------ monk
  monk(tc, v) {
    const w = who(v, { skins: [0, 1, 0, 2], hairs: [1, 6, 0, 3] });
    return {
      style: 'staff', sc: 1.0, ...w, hairStyle: 'tonsure', beard: (v & 1) ? w.hair : null, dress: true,
      torso: { kind: 'robe', col: '#a9783a', belt: tc.main, hemBand: tc.main },
      arms: { up: '#a9783a', fore: '#a9783a', col: '#a9783a', glove: null },
      legs: { col: '#7a5a34', boot: null, foot: '#8a6a4a' },
      head: { kind: 'cowl', col: shadeHex('#a9783a', -0.12) },
      weapon: { kind: 'staff', len: 38, grip: 0.38, shaft: '#7a5530', cross: true },
    };
  },

  // ------------------------------------------------------------ unique units
  longbowman(tc, v) {
    const w = who(v, { hairs: [3, 1, 5, 4] });
    return {
      style: 'longbow', sc: 1.0, ...w, hairStyle: 'short',
      torso: { kind: 'tunic', col: tc.main, skirt: 4.6, belt: '#3a2a1c', hemBand: shadeHex(tc.main, -0.2) },
      arms: { up: tc.main, fore: '#5a4630', col: w.skin, glove: null },
      legs: { col: '#5a5340', boot: '#3a2a1c', bootH: 0.55 },
      head: { kind: 'hood', col: '#3f5a2a', cowl: true, feather: '#e8e4d6' },
      back: [{ k: 'quiver', col: '#6a4a2a' }],
      weapon: { kind: 'bow', len: 41, wood: '#9a6a32', bend: 0.12, thick: 1.05, trim: '#4a3220' },
    };
  },
  elite_longbowman(tc, v) {
    const w = who(v, { hairs: [3, 1, 5, 4] });
    return {
      style: 'longbow', sc: 1.02, ...w, hairStyle: 'short',
      torso: { kind: 'brigandine', col: '#5a4630', skirt: 5, belt: '#2f2218', hemBand: tc.main, tabard: tc.main, tabardTrim: tc.light },
      arms: { up: '#5a4630', fore: MAIL, col: MAIL, foreMetal: true, glove: '#3a2a1c', shoulder: tc.main },
      legs: { col: '#4a4a3a', boot: '#2f2218', bootH: 0.6 },
      head: { kind: 'hood', col: '#2f4a22', cowl: true, feather: tc.light },
      back: [{ k: 'quiver', col: '#4e3622', fletch: tc.light }],
      weapon: { kind: 'bow', len: 43, wood: '#b07a38', bend: 0.12, thick: 1.15, trim: GOLD, tips: GOLD },
    };
  },
  throwing_axeman(tc, v) {
    const w = who(v, { skins: [0, 1, 0, 2], hairs: [3, 5, 1, 4] });
    return {
      style: 'throwaxe', sc: 1.03, ...w, hairStyle: 'short', beard: pick([null, w.hair, null, w.hair], v),
      torso: { kind: 'jerkin', col: '#6e4c30', skirt: 4.8, belt: '#2f2218', hemBand: tc.main, tabard: null },
      arms: { up: '#6e4c30', fore: w.skin, col: w.skin, glove: '#4a3222' },
      legs: { col: '#5a4a38', boot: '#3a2a1c', bootH: 0.6 },
      head: { kind: 'nasal', col: '#8e99a5', coif: false },
      back: [{ k: 'fur', col: '#8a6a48' }, { k: 'cloak', col: tc.main, len: 12 }],
      weapon: { kind: 'axe', len: 11, hw: 3.8, shaft: '#7a5530', head: '#b8c2ce' },
    };
  },
  elite_throwing_axeman(tc, v) {
    const w = who(v, { skins: [0, 1, 0, 2], hairs: [3, 5, 1, 4] });
    return {
      style: 'throwaxe', sc: 1.05, ...w, hairStyle: 'short', beard: pick([w.hair, null, w.hair], v),
      torso: { kind: 'mail', col: MAIL, metal: true, skirt: 5.2, belt: '#2f2218', hemBand: tc.main },
      arms: { up: '#6e4c30', fore: MAIL, col: MAIL, foreMetal: true, glove: '#3a2a1c' },
      legs: { col: '#4d4c40', boot: '#2f2218', bootH: 0.6 },
      head: { kind: 'conical', col: '#aab4c0', coif: false },
      back: [{ k: 'fur', col: '#a07a52' }, { k: 'cloak', col: tc.main, len: 13, trim: tc.light }],
      weapon: { kind: 'axe', len: 11.5, hw: 4.2, shaft: '#6a4a2c', head: '#d0d8e2' },
    };
  },
  huskarl(tc, v) {
    const w = who(v, { skins: [0, 0, 1], hairs: [3, 5, 4, 1] });
    return {
      style: 'sword1', sc: 1.05, ...w, hairStyle: 'short', beard: w.hair, build: 1.05,
      torso: { kind: 'mail', col: MAIL, metal: true, skirt: 7, belt: '#2f2218', tabard: null, skirtCol: MAIL, collar: MAIL, metalCollar: true },
      arms: { up: MAIL, fore: MAIL, col: MAIL, metal: true, glove: '#3a2a1c', shoulder: tc.main },
      legs: { col: '#5a4a3a', boot: '#2f2218', bootH: 0.6 },
      head: { kind: 'conical', col: '#a9b3bf', coifCol: MAILD },
      weapon: { kind: 'axe', len: 13, hw: 4.4, shaft: '#6a4a2c', head: '#c7d0da' },
      shield: { kind: 'round', R: 6.0, face: tc.main, rim: '#5a626c', pc: tc.light, pattern: 'split', boss: 1.8, bossCol: '#c7ced6' },
    };
  },
  elite_huskarl(tc, v) {
    const w = who(v, { skins: [0, 0, 1], hairs: [3, 5, 4, 1] });
    return {
      style: 'sword1', sc: 1.08, ...w, hairStyle: 'short', beard: w.hair, build: 1.1,
      torso: { kind: 'mail', col: MAIL, metal: true, skirt: 7.6, belt: '#2f2218', tabard: tc.main, tabardTrim: tc.dark, skirtCol: tc.main, collar: MAIL, metalCollar: true },
      arms: { up: MAIL, fore: '#aeb8c4', col: MAIL, foreMetal: true, metal: true, glove: '#2f2218', pauldron: '#98a4b2' },
      legs: { col: MAIL, metal: true, boot: '#2a1d14', bootH: 0.55 },
      head: { kind: 'conical', col: '#c3ccd6', coifCol: MAILD, horns: true },
      weapon: { kind: 'axe', len: 14, hw: 5.0, shaft: '#5a3e24', head: '#dbe3ec' },
      shield: { kind: 'round', R: 6.4, face: tc.main, rim: '#8a939e', pc: tc.light, pattern: 'cross', boss: 2.0, bossCol: '#d6dde4' },
    };
  },
};
