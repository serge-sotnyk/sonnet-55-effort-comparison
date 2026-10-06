// Original miniature heraldic illustrations. All artwork is inline and self-contained.
const C = { ink: '#332820', gold: '#e5bd61', light: '#ffe4a1', blue: '#497894', darkblue: '#284d69', steel: '#b9c4c5', wood: '#a67243', brown: '#785036', green: '#7b9152', red: '#bc6650', cream: '#ece0c3' };
const stroke = `stroke="${C.ink}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"`;
const attributes = extra => `${stroke.replace(/([\w-]+)="[^"]*"/g, (attribute, key) => extra.includes(`${key}=`) ? '' : attribute)} ${extra}`;
const p = (d, fill = C.gold, extra = '') => `<path d="${d}" fill="${fill}" ${attributes(extra)}/>`;
const circle = (x, y, r, fill = C.gold, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${attributes(extra)}/>`;
const line = d => p(d, 'none');
const roof = (x = 4, y = 9, w = 24) => p(`M${x} ${y+8} L${x+w/2} ${y} L${x+w} ${y+8} Z`, C.red);
const tower = (x, y, w = 8, h = 18) => p(`M${x} ${y} h3 v3 h2 v-3 h3 v${h} h-${w} Z`, C.cream) + p(`M${x+3} ${y+8} h2 v4 h-2 Z`, C.darkblue);
const sword = () => p('M18 3 L22 5 L13 21 L9 19 Z', C.steel) + p('M7 17 L16 22 L14 25 L5 20 Z', C.gold) + p('M9 22 L6 28 L3 26 L7 21 Z', C.brown);
const shield = () => p('M5 6 L16 3 L27 6 V16 Q26 24 16 29 Q6 24 5 16 Z', C.blue) + p('M16 6 V25 M8 14 H24', 'none', `stroke="${C.gold}" stroke-width="2.4"`);
const building = (kind = 'house') => {
  if (kind === 'towncenter') return p('M5 14 H27 V28 H5 Z', C.cream) + p('M3 14 L16 5 L29 14 Z', C.red) + p('M12 20 Q16 14 20 20 V28 H12 Z', C.brown) + p('M8 17 H10 V22 H8 Z M22 17 H24 V22 H22 Z', C.blue) + p('M16 5 V1 L23 2 L16 4 Z', C.blue) + line('M3 28 H29');
  if (kind === 'castle') return tower(2, 6) + tower(22, 6) + p('M9 15 H23 V28 H9 Z', C.cream) + p('M13 22 Q16 16 19 22 V28 H13 Z', C.brown) + p('M10 15 L16 8 L22 15 Z', C.darkblue) + p('M16 8 V2 L23 3 L16 5 Z', C.blue);
  if (kind === 'tower') return tower(9, 3, 8, 26) + p('M8 29 H20 V26 H8 Z', C.brown) + p('M17 4 H24 V1 L17 2 Z', C.blue);
  return p('M6 15 H26 V28 H6 Z', C.cream) + roof() + p('M12 20 H18 V28 H12 Z', C.brown) + p('M21 18 H24 V22 H21 Z', C.blue) + line('M4 28 H28');
};
const person = (helmet = false) => circle(16, 9, 4, C.cream) + (helmet ? p('M11 9 Q11 2 16 2 Q22 3 21 10 L18 9 V6 H13 V9 Z', C.steel) : p('M11 6 Q16 1 21 6 L22 8 H10 Z', C.brown)) + p('M9 15 Q16 11 23 15 L21 25 H11 Z', C.blue) + p('M11 25 L10 30 H14 L16 25 L18 30 H22 L21 25 Z', C.brown);
const horse = () => p('M5 20 Q3 15 8 13 L19 13 L22 5 L26 6 L29 13 L26 17 L23 13 L22 22 L20 29 H17 L18 21 H11 L10 29 H7 L7 20 Z', C.brown) + p('M19 14 L24 8 L22 5 L19 8 Z', C.ink) + line('M6 15 L2 12 L2 20') + p('M11 12 H20 V19 H11 Z', C.blue) + circle(26, 10, .8, C.ink);
const art = {
  wood: p('M5 12 L20 6 L27 11 L12 18 Z', C.wood) + p('M5 12 V22 L12 27 V18 Z', C.brown) + p('M12 18 L27 11 V21 L12 27 Z', C.wood) + p('M7 13 L8 14 V23 M14 20 L25 15 M14 24 L25 19', 'none') + p('M17 7 L21 2 L25 4 L21 8 Z', C.green),
  food: p('M3 21 Q16 16 29 21 L25 29 H7 Z', C.brown) + circle(10, 17, 6, C.red) + circle(20, 17, 6, C.red) + p('M14 15 Q11 7 17 4 Q25 9 20 16 Z', C.gold) + p('M16 9 L16 3 Q21 0 23 5 Z', C.green) + line('M7 24 H25 M11 27 H22'),
  gold: p('M3 18 L7 8 L17 6 L21 17 L16 25 H6 Z', C.gold) + p('M16 24 L20 14 L27 16 L30 25 L24 29 Z', C.gold) + p('M7 8 L10 17 L3 18 M10 17 L17 6 M10 17 L16 25 M20 14 L24 22 L30 25 M24 22 L24 29', 'none') + p('M9 9 L12 8 L11 12 Z', C.light),
  stone: p('M3 22 L7 12 L18 7 L25 12 L29 25 L20 29 L8 28 Z', C.steel) + p('M7 12 L15 18 L18 7 M15 18 L25 12 M15 18 L20 29 M3 22 L15 18 L8 28 M15 18 L29 25', 'none'),
  population: person() + circle(6, 14, 3, C.cream) + p('M1 21 Q6 17 10 21 V27 H2 Z', C.brown) + circle(26, 14, 3, C.cream) + p('M22 21 Q26 17 31 21 L30 27 H22 Z', C.brown),
  villager: person() + p('M4 14 L6 14 L8 29 H5 Z', C.wood) + p('M1 12 L8 9 L11 12 L2 16 Z', C.steel) + line('M9 16 L5 19 M23 16 L25 22'),
  militia: person(true) + p('M4 8 L7 3 L8 8 L7 22 H4 Z', C.steel) + p('M2 21 H9 V24 H2 Z', C.gold) + p('M22 16 L30 16 L29 24 L25 27 L21 23 Z', C.blue),
  spearman: person(true) + p('M3 8 L5 2 L8 8 Z', C.steel) + p('M4 8 H6 V30 H4 Z', C.wood) + p('M22 16 L30 16 L29 24 L25 27 L21 23 Z', C.gold),
  archer: person() + p('M25 6 Q35 17 25 28 M25 6 V28', 'none', `stroke="${C.wood}"`) + p('M19 17 H30 L27 14 M30 17 L27 20', 'none') + line('M21 15 L25 17'),
  scout: horse() + circle(14, 6, 3, C.cream) + p('M11 4 L14 1 L18 4 Z', C.blue) + p('M12 9 H17 L18 15 H11 Z', C.blue),
  knight: horse() + circle(14, 5, 3, C.steel) + p('M11 8 H17 L18 15 H11 Z', C.steel) + p('M2 3 L4 1 L5 3 L4 20 H2 Z', C.steel) + p('M13 11 L21 10 V17 L17 21 L13 17 Z', C.blue) + line('M14 15 H20'),
  trebuchet: p('M4 25 H28 V28 H4 Z', C.wood) + p('M8 24 L16 9 L25 24 Z', 'none', `stroke="${C.wood}" stroke-width="3"`) + p('M9 4 L12 2 L26 22 L23 24 Z', C.wood) + p('M4 4 H11 V11 H4 Z', C.brown) + line('M26 23 L29 15 L27 12') + circle(8, 29, 2, C.ink) + circle(25, 29, 2, C.ink) + circle(16, 13, 2, C.gold),
  towncenter: building('towncenter'),
  house: building(),
  castle: building('castle'),
  tower: building('tower'),
  lumbercamp: p('M4 16 H28 V28 H4 Z', C.wood) + roof(2, 6, 28) + p('M8 21 H13 V27 H8 Z', C.brown) + p('M17 19 L25 16 V25 L17 28 Z', C.wood) + line('M18 22 L24 19 M18 25 L24 22'),
  miningcamp: building() + p('M1 24 L6 18 L12 23 L10 29 H2 Z', C.steel) + p('M22 16 L25 14 L31 25 L28 27 Z', C.wood) + p('M20 14 Q27 10 31 15 L28 17 L25 16 Z', C.steel),
  mill: p('M9 15 H23 L26 29 H6 Z', C.cream) + p('M7 15 L16 5 L25 15 Z', C.red) + p('M14 23 H19 V29 H14 Z', C.brown) + p('M15 13 L5 4 L1 8 L13 16 L3 26 L7 30 L17 18 L27 27 L31 23 L19 15 L28 5 L24 1 Z', C.wood) + circle(16, 15, 2.3, C.gold),
  farm: p('M2 20 L17 11 L30 19 L15 29 Z', C.brown) + line('M8 20 L18 14 M12 23 L22 17 M16 26 L26 20') + p('M9 17 V7 M6 9 L9 12 L12 8 M20 18 V4 M17 7 L20 10 L24 6 M25 22 V11 M23 13 L25 17 L29 13', 'none', `stroke="${C.gold}" stroke-width="2"`),
  barracks: building() + p('M12 3 L17 1 L24 11 L20 14 Z', C.steel) + p('M11 12 L20 6 L22 9 L13 15 Z', C.gold) + p('M6 10 L11 6 L14 10 L9 14 Z', C.brown),
  archery: building() + p('M3 3 Q16 1 17 14 M3 3 L17 14', 'none', `stroke="${C.wood}" stroke-width="2"`) + p('M4 14 L16 2 M12 2 H16 V6', 'none') + circle(23, 23, 6, C.cream) + circle(23, 23, 3.5, C.red) + circle(23, 23, 1, C.gold),
  stable: building() + p('M11 14 L14 8 L20 8 L23 13 L21 17 L18 15 L17 22 H10 Z', C.brown) + p('M14 8 L15 5 L18 8 Z', C.brown) + circle(20, 11, .6, C.ink),
  blacksmith: building() + p('M6 20 H27 L24 24 H17 V28 H11 V24 H8 Z', C.steel) + p('M15 3 L19 2 L24 14 L21 16 Z', C.wood) + p('M12 3 L20 1 L23 6 L15 9 Z', C.steel),
  age: p('M3 25 H29 V29 H3 Z M6 18 H13 V25 H6 Z M13 11 H20 V25 H13 Z M20 5 H27 V25 H20 Z', C.gold) + p('M5 13 L23 2 M17 2 H23 V8', 'none', `stroke="${C.light}" stroke-width="2"`),
  forging: p('M3 20 H28 L23 24 H19 V29 H10 V24 H6 Z', C.steel) + p('M18 5 L21 4 L28 17 L25 19 Z', C.wood) + p('M13 4 L23 1 L27 7 L16 11 Z', C.gold) + p('M4 10 L8 12 M8 5 L9 9 M2 17 H6', 'none', `stroke="${C.gold}"`),
  armor: p('M8 4 L13 2 Q16 8 19 2 L24 4 L29 12 L24 15 L22 28 H10 L8 15 L3 12 Z', C.steel) + p('M13 9 H19 V24 H13 Z', C.blue) + line('M8 15 L11 12 M24 15 L21 12 M12 18 H20 M11 25 H21'),
  wheelbarrow: p('M4 13 H24 L21 23 H9 Z', C.wood) + p('M9 22 L5 29 M21 22 L29 10', 'none', `stroke="${C.brown}" stroke-width="2"`) + circle(10, 27, 4, C.brown) + circle(10, 27, 1.3, C.gold) + p('M7 13 L10 7 L16 9 L21 6 L24 13 Z', C.gold),
  attack: sword(),
  sword: sword(),
  shield: shield(),
  move: p('M16 2 L22 8 H18 V14 H24 V10 L30 16 L24 22 V18 H18 V24 H22 L16 30 L10 24 H14 V18 H8 V22 L2 16 L8 10 V14 H14 V8 H10 Z', C.gold),
  stop: p('M7 5 H25 V27 H7 Z', C.gold) + p('M11 9 H21 V23 H11 Z', C.brown),
  build: p('M4 26 L7 29 L25 9 L21 5 Z', C.wood) + p('M16 6 L21 1 L30 10 L25 15 Z', C.steel) + line('M20 5 L26 11') + p('M3 6 L7 5 L9 12 L5 13 Z', C.gold),
  flag: p('M8 2 H11 V29 H8 Z', C.wood) + p('M11 3 Q19 0 27 4 L24 10 L27 16 Q18 12 11 16 Z', C.blue) + p('M17 5 L18 8 L22 8 L19 10 L20 13 L17 11 L14 13 L15 9 L13 7 L16 7 Z', C.gold) + line('M4 29 H16'),
  compass: circle(16, 16, 13, C.brown) + circle(16, 16, 10, C.cream) + p('M21 7 L18 18 L11 25 L14 14 Z', C.blue) + p('M21 7 L14 14 L18 18 Z', C.gold) + circle(16, 16, 1.5, C.ink),
  help: circle(16, 16, 12, C.blue) + p('M11 12 Q11 7 16 7 Q23 7 21 13 Q20 16 16 17 V20', 'none', `stroke="${C.light}" stroke-width="2.6"`) + circle(16, 24, 1.4, C.gold),
  settings: p('M12 3 H20 L21 7 L25 9 L29 8 L31 15 L27 18 L26 22 L28 26 L22 30 L18 27 H14 L10 30 L4 26 L6 22 L5 18 L1 15 L3 8 L7 9 L11 7 Z', C.gold) + circle(16, 17, 6, C.brown) + circle(16, 17, 2.5, C.steel),
  pause: p('M7 5 H13 V27 H7 Z M19 5 H25 V27 H19 Z', C.gold),
  play: p('M9 4 L28 16 L9 28 Z', C.gold),
  sound: p('M3 12 H9 L17 5 V27 L9 20 H3 Z', C.gold) + p('M21 10 Q27 16 21 22 M25 6 Q35 16 25 26', 'none', `stroke="${C.gold}" stroke-width="2"`),
  muted: p('M3 12 H9 L17 5 V27 L9 20 H3 Z', C.brown) + p('M22 11 L30 21 M30 11 L22 21', 'none', `stroke="${C.gold}" stroke-width="2"`),
  close: p('M7 7 L25 25 M25 7 L7 25', 'none', `stroke="${C.gold}" stroke-width="3"`),
  chevron: p('M10 6 L21 16 L10 26', 'none', `stroke="${C.gold}" stroke-width="2.8"`),
  eye: p('M2 16 Q16 1 30 16 Q16 31 2 16 Z', C.cream) + circle(16, 16, 5.5, C.blue) + circle(16, 16, 2, C.ink) + circle(14.4, 14.4, .8, C.cream),
  menu: p('M5 8 H27 M5 16 H27 M5 24 H27', 'none', `stroke="${C.gold}" stroke-width="2.5"`),
  fullscreen: p('M12 4 H4 V12 M20 4 H28 V12 M4 20 V28 H12 M28 20 V28 H20', 'none', `stroke="${C.gold}" stroke-width="2.5"`),
};
const aliases = { tc: 'towncenter', townCenter: 'towncenter', lumber: 'lumbercamp', mining: 'miningcamp', archeryrange: 'archery', archeryRange: 'archery', timber: 'wood', farmfood: 'food', advance: 'age', upgrade: 'age', research: 'age', economy: 'wheelbarrow', swordsman: 'militia', longbowman: 'archer', cavalry: 'knight', siege: 'trebuchet', spears: 'spearman', infantry: 'militia', soundoff: 'muted', soundon: 'sound', back: 'chevron' };
export function icon(name, size = 20) {
  const safeSize = Number.isFinite(Number(size)) ? Number(size) : 20;
  return `<svg class="game-icon icon-${String(name).replace(/[^a-zA-Z0-9_-]/g, '')}" width="${safeSize}" height="${safeSize}" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${art[aliases[name] || name] || art.flag}</svg>`;
}
export function crest(size = 48) {
  const safeSize = Number.isFinite(Number(size)) ? Number(size) : 48;
  return `<svg class="village-crest" width="${safeSize}" height="${safeSize}" viewBox="0 0 48 56" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M5 8 L24 2 L43 8 V28 Q41 43 24 53 Q7 43 5 28 Z" fill="${C.gold}" stroke="${C.ink}" stroke-width="1.5"/><path d="M9 11 L24 6 L39 11 V28 Q37 40 24 48 Q11 40 9 28 Z" fill="${C.darkblue}" stroke="${C.light}" stroke-width=".7"/><path d="M24 10 V44 M11 26 H37" stroke="${C.blue}" stroke-width=".6"/><path d="M28 13 L31 14 L25 29 L22 28 Z" fill="${C.steel}" stroke="${C.ink}" stroke-width=".7"/><path d="M19 27 L28 30 L27 32 L19 30 Z M23 31 L21 36 L19 35 L21 30 Z" fill="${C.gold}"/><path d="M15 18 L19 16 L22 18 L23 23 L20 26 L23 30 L20 34 L22 37 L18 39 L15 38 L18 35 L16 31 L12 28 L13 24 L16 25 L18 22 L15 21 Z M24 24 Q34 17 34 23 Q35 28 29 29 L26 34 L29 38 L26 40 L23 37 L23 31 L21 26 Z" fill="${C.gold}" stroke="${C.ink}" stroke-width=".8"/><path d="M30 28 Q38 31 35 36 L33 35 Q35 31 29 31" fill="${C.gold}" stroke="${C.ink}" stroke-width=".8"/><circle cx="19" cy="19" r=".65" fill="${C.ink}"/><path d="M12 6 L13 1 L18 4 L24 0 L30 4 L35 1 L36 6" stroke="${C.gold}" stroke-width="1.3"/></svg>`;
}
