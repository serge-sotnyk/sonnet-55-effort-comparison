'use strict';
// ---- constants & game data ----
const N = 80, TW = 64, TH = 32;
const COL = [
  { m: '#2f6fe0', d: '#173f8f', l: '#8cb8ff', name: 'Blue' },
  { m: '#d9382c', d: '#7a1a12', l: '#ff9a8d', name: 'Red' },
];
const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];
const AGE_UP = [null, { c: { f: 500 }, t: 30 }, { c: { f: 800, g: 200 }, t: 40 }, { c: { f: 1000, g: 800 }, t: 50 }];
const MAXPOP = 150;
const RES_ICON = { f: '🍖', w: '🪵', g: '🪙', s: '🪨' };
const RES_NAME = { f: 'food', w: 'wood', g: 'gold', s: 'stone' };

const UNITS = {
  villager: { n: 'Villager', cls: 'vil', ic: '👨‍🌾', hp: 25, atk: 3, rof: 2, rng: .9, spd: 1.5, aM: 0, aP: 0, cost: { f: 50 }, time: 8, los: 5, pop: 1, age: 0, t: 'm', desc: 'Gathers resources, builds and repairs.' },
  militia: { n: 'Militia', cls: 'inf', ic: '⚔️', hp: 45, atk: 5, rof: 2, rng: .9, spd: 1.6, aM: 0, aP: 1, cost: { f: 60, g: 20 }, time: 10, los: 5, pop: 1, age: 0, t: 'm',
    tiers: ['Militia', 'Man-at-Arms', 'Long Swordsman', 'Champion'], inc: { hp: 9, atk: 2, aM: .5, aP: .5 }, desc: 'Sturdy swordsman. Decent against buildings.' },
  spear: { n: 'Spearman', cls: 'inf', ic: '🔱', hp: 45, atk: 3, rof: 3, rng: .9, spd: 1.6, aM: 0, aP: 0, cost: { f: 35, w: 25 }, time: 9, los: 5, pop: 1, age: 1, t: 'm', bonus: { cav: 14 },
    tiers: ['Spearman', 'Pikeman', 'Halberdier'], inc: { hp: 6, atk: 1, aM: .5, aP: .5, bonus: 7 }, desc: 'Cheap. Deadly against cavalry.' },
  archer: { n: 'Archer', cls: 'arch', ic: '🏹', hp: 30, atk: 4, rof: 2, rng: 6, spd: 1.6, aM: 0, aP: 0, cost: { w: 25, g: 45 }, time: 12, los: 7, pop: 1, age: 1, t: 'p',
    tiers: ['Archer', 'Crossbowman', 'Arbalest'], inc: { hp: 5, atk: 1.5, rng: .5 }, desc: 'Ranged attacker. Strong vs infantry, weak vs cavalry.' },
  scout: { n: 'Scout Cavalry', cls: 'cav', ic: '🐎', hp: 45, atk: 4, rof: 1.8, rng: .9, spd: 3.2, aM: 0, aP: 2, cost: { f: 80 }, time: 10, los: 9, pop: 1, age: 1, t: 'm',
    tiers: ['Scout Cavalry', 'Light Cavalry', 'Hussar'], inc: { hp: 12, atk: 2, aP: .5 }, desc: 'Fast. Good for exploring and harassing.' },
  knight: { n: 'Knight', cls: 'cav', ic: '🏇', hp: 100, atk: 10, rof: 1.8, rng: .9, spd: 2.7, aM: 2, aP: 2, cost: { f: 60, g: 75 }, time: 14, los: 6, pop: 1, age: 2, t: 'm',
    tiers: ['Knight', 'Cavalier'], inc: { hp: 25, atk: 3, aM: 1, aP: .5 }, desc: 'Heavy cavalry. Crushes archers and infantry.' },
  ram: { n: 'Battering Ram', cls: 'siege', ic: '🐏', hp: 175, atk: 3, rof: 3, rng: .9, spd: 1.2, aM: 0, aP: 25, cost: { w: 160, g: 75 }, time: 18, los: 4, pop: 3, age: 2, t: 'm', bonus: { bld: 45 },
    desc: 'Razes buildings. Nearly immune to arrows.' },
  mangonel: { n: 'Mangonel', cls: 'siege', ic: '☄️', hp: 60, atk: 30, rof: 5, rng: 7.5, spd: 1.0, aM: 0, aP: 6, cost: { w: 160, g: 135 }, time: 22, los: 7, pop: 3, age: 2, t: 'm', bonus: { bld: 15 }, splash: 1.4,
    tiers: ['Mangonel', 'Onager'], inc: { hp: 10, atk: 10, rng: 1 }, desc: 'Siege artillery with area damage.' },
};
// which techs raise a unit's tier
const UPG = { militia: ['inf2', 'inf3', 'inf4'], spear: ['spear2', 'spear3'], archer: ['arch2', 'arch3'], scout: ['scout2', 'scout3'], knight: ['cav2'], mangonel: ['siege2'] };

const BLDS = {
  tc: { n: 'Town Center', ic: '🏰', size: 4, hp: 2400, cost: { w: 275, s: 100 }, time: 60, age: 1, aM: 3, aP: 8, pop: 10, drop: 'fwgs', los: 9, trains: ['villager'], techs: ['loom', 'wheel'], atk: { dmg: 7, rng: 8, rof: 1.6 }, desc: 'Trains villagers, advances ages, shoots arrows.' },
  house: { n: 'House', ic: '🏠', size: 2, hp: 550, cost: { w: 30 }, time: 12, age: 0, aM: 1, aP: 5, pop: 5, los: 3, desc: 'Provides +5 population.' },
  mill: { n: 'Mill', ic: '🌾', size: 2, hp: 700, cost: { w: 100 }, time: 20, age: 0, aM: 1, aP: 6, drop: 'f', los: 4, techs: ['farm1', 'farm2', 'farm3'], desc: 'Drop-off for food. Researches farming upgrades.' },
  lumber: { n: 'Lumber Camp', ic: '🪓', size: 2, hp: 700, cost: { w: 100 }, time: 20, age: 0, aM: 1, aP: 6, drop: 'w', los: 4, techs: ['axe1', 'axe2'], desc: 'Drop-off for wood. Researches woodcutting upgrades.' },
  mining: { n: 'Mining Camp', ic: '⛏️', size: 2, hp: 700, cost: { w: 100 }, time: 20, age: 0, aM: 1, aP: 6, drop: 'gs', los: 4, techs: ['mine1', 'mine2'], desc: 'Drop-off for gold and stone.' },
  farm: { n: 'Farm', ic: '🌱', size: 3, hp: 200, cost: { w: 60 }, time: 12, age: 0, aM: 0, aP: 0, los: 2, flat: true, desc: 'Infinite-ish food for one villager. Reseeds for 40 wood.' },
  barracks: { n: 'Barracks', ic: '🛡️', size: 3, hp: 1400, cost: { w: 175 }, time: 32, age: 0, aM: 2, aP: 8, los: 5, trains: ['militia', 'spear'], techs: ['inf2', 'inf3', 'inf4', 'spear2', 'spear3'], desc: 'Trains infantry.' },
  archery: { n: 'Archery Range', ic: '🎯', size: 3, hp: 1400, cost: { w: 175 }, time: 32, age: 1, aM: 2, aP: 8, los: 5, trains: ['archer'], techs: ['arch2', 'arch3'], desc: 'Trains archers.' },
  stable: { n: 'Stable', ic: '🐴', size: 3, hp: 1400, cost: { w: 175 }, time: 32, age: 1, aM: 2, aP: 8, los: 5, trains: ['scout', 'knight'], techs: ['scout2', 'scout3', 'cav2'], desc: 'Trains cavalry.' },
  smith: { n: 'Blacksmith', ic: '🔨', size: 3, hp: 1200, cost: { w: 150 }, time: 36, age: 1, aM: 2, aP: 8, los: 4, techs: ['atk1', 'atk2', 'rng1', 'rng2', 'marm1', 'marm2', 'parm1', 'parm2'], desc: 'Researches weapon and armor upgrades.' },
  siege: { n: 'Siege Workshop', ic: '⚙️', size: 3, hp: 1600, cost: { w: 200 }, time: 40, age: 2, aM: 2, aP: 8, los: 4, trains: ['ram', 'mangonel'], techs: ['siege2'], desc: 'Builds rams and mangonels.' },
  tower: { n: 'Watch Tower', ic: '🗼', size: 1, hp: 900, cost: { w: 50, s: 100 }, time: 30, age: 1, aM: 3, aP: 7, los: 8, atk: { dmg: 8, rng: 8, rof: 1.8 }, desc: 'Defensive tower that fires arrows.' },
};
// villager build menu order (matches Q W E R / A S D F / Z X C V)
const BUILD_MENU = ['house', 'mill', 'lumber', 'mining', 'farm', 'barracks', 'archery', 'stable', 'smith', 'siege', 'tower', 'tc'];

const TECHS = {
  loom: { n: 'Loom', ic: '🧵', b: 'tc', age: 0, cost: { g: 50 }, time: 15, fx: { vilHp: 15, vilArmP: 1 }, desc: 'Villagers +15 HP, +1 pierce armor.' },
  wheel: { n: 'Wheelbarrow', ic: '🛒', b: 'tc', age: 1, cost: { f: 175, w: 50 }, time: 30, fx: { vilSpeed: .1, vilCarry: 5 }, desc: 'Villagers move 10% faster, carry +5.' },
  axe1: { n: 'Double-Bit Axe', ic: '🪓', b: 'lumber', age: 0, cost: { f: 100, w: 50 }, time: 20, fx: { gw: .2 }, desc: 'Wood gathering +20%.' },
  axe2: { n: 'Bow Saw', ic: '🪚', b: 'lumber', age: 1, cost: { f: 150, w: 100 }, time: 25, req: 'axe1', fx: { gw: .2 }, desc: 'Wood gathering +20%.' },
  mine1: { n: 'Gold & Stone Mining', ic: '⛏️', b: 'mining', age: 0, cost: { f: 100, w: 75 }, time: 20, fx: { gm: .2 }, desc: 'Gold and stone mining +20%.' },
  mine2: { n: 'Deep Shaft Mining', ic: '💎', b: 'mining', age: 1, cost: { f: 200, w: 150 }, time: 30, req: 'mine1', fx: { gm: .2 }, desc: 'Gold and stone mining +20%.' },
  farm1: { n: 'Horse Collar', ic: '🐎', b: 'mill', age: 0, cost: { f: 75, w: 75 }, time: 20, fx: { gf: .2 }, desc: 'Farm and berry gathering +20%.' },
  farm2: { n: 'Heavy Plow', ic: '🚜', b: 'mill', age: 1, cost: { f: 125, w: 125 }, time: 30, req: 'farm1', fx: { gf: .2, farmAmt: 100 }, desc: 'Farming +20%, farms hold more food.' },
  farm3: { n: 'Crop Rotation', ic: '🌽', b: 'mill', age: 2, cost: { f: 250, w: 250 }, time: 40, req: 'farm2', fx: { gf: .2 }, desc: 'Farming +20%.' },
  atk1: { n: 'Forging', ic: '🗡️', b: 'smith', age: 1, cost: { f: 150 }, time: 25, fx: { atkMelee: 1 }, desc: 'Infantry and cavalry +1 attack.' },
  atk2: { n: 'Iron Casting', ic: '⚒️', b: 'smith', age: 2, cost: { f: 220, g: 120 }, time: 35, req: 'atk1', fx: { atkMelee: 1 }, desc: 'Infantry and cavalry +1 attack.' },
  rng1: { n: 'Fletching', ic: '🪶', b: 'smith', age: 1, cost: { f: 100, g: 50 }, time: 25, fx: { atkRanged: 1, rngBonus: .5 }, desc: 'Archers, towers +1 attack, +0.5 range.' },
  rng2: { n: 'Bodkin Arrow', ic: '➳', b: 'smith', age: 2, cost: { f: 200, g: 100 }, time: 35, req: 'rng1', fx: { atkRanged: 1, rngBonus: .5 }, desc: 'Archers, towers +1 attack, +0.5 range.' },
  marm1: { n: 'Scale Mail', ic: '🛡️', b: 'smith', age: 1, cost: { f: 100 }, time: 25, fx: { armMelee: 1 }, desc: 'Infantry and cavalry +1 melee armor.' },
  marm2: { n: 'Chain Mail', ic: '⛓️', b: 'smith', age: 2, cost: { f: 200, g: 100 }, time: 35, req: 'marm1', fx: { armMelee: 1 }, desc: 'Infantry and cavalry +1 melee armor.' },
  parm1: { n: 'Padded Armor', ic: '🧥', b: 'smith', age: 1, cost: { f: 100 }, time: 25, fx: { armPierce: 1 }, desc: 'Soldiers +1 pierce armor.' },
  parm2: { n: 'Leather Armor', ic: '🥋', b: 'smith', age: 2, cost: { f: 200, g: 100 }, time: 35, req: 'parm1', fx: { armPierce: 1 }, desc: 'Soldiers +1 pierce armor.' },
  inf2: { n: 'Man-at-Arms', ic: '⚔️', b: 'barracks', age: 1, cost: { f: 100, g: 40 }, time: 25, desc: 'Upgrades Militia to Man-at-Arms.' },
  inf3: { n: 'Long Swordsman', ic: '⚔️', b: 'barracks', age: 2, cost: { f: 150, g: 65 }, time: 30, req: 'inf2', desc: 'Upgrades to Long Swordsman.' },
  inf4: { n: 'Champion', ic: '⚔️', b: 'barracks', age: 3, cost: { f: 300, g: 200 }, time: 40, req: 'inf3', desc: 'Upgrades to Champion.' },
  spear2: { n: 'Pikeman', ic: '🔱', b: 'barracks', age: 2, cost: { f: 215, g: 90 }, time: 30, desc: 'Upgrades Spearman to Pikeman.' },
  spear3: { n: 'Halberdier', ic: '🔱', b: 'barracks', age: 3, cost: { f: 300, g: 200 }, time: 40, req: 'spear2', desc: 'Upgrades to Halberdier.' },
  arch2: { n: 'Crossbowman', ic: '🏹', b: 'archery', age: 2, cost: { f: 125, g: 75 }, time: 30, desc: 'Upgrades Archer to Crossbowman.' },
  arch3: { n: 'Arbalest', ic: '🏹', b: 'archery', age: 3, cost: { f: 300, g: 175 }, time: 40, req: 'arch2', desc: 'Upgrades to Arbalest.' },
  scout2: { n: 'Light Cavalry', ic: '🐎', b: 'stable', age: 2, cost: { f: 150, g: 50 }, time: 30, desc: 'Upgrades Scout to Light Cavalry.' },
  scout3: { n: 'Hussar', ic: '🐎', b: 'stable', age: 3, cost: { f: 250, g: 100 }, time: 35, req: 'scout2', desc: 'Upgrades to Hussar.' },
  cav2: { n: 'Cavalier', ic: '🏇', b: 'stable', age: 3, cost: { f: 300, g: 300 }, time: 40, desc: 'Upgrades Knight to Cavalier.' },
  siege2: { n: 'Onager', ic: '☄️', b: 'siege', age: 3, cost: { f: 300, g: 300 }, time: 40, desc: 'Upgrades Mangonel to Onager.' },
};

const DIFF = {
  easy: { name: 'Easy', vil: 24, gm: .8, atk: 18, wave: 7, bld: 1 },
  normal: { name: 'Standard', vil: 36, gm: 1, atk: 12, wave: 6, bld: 2 },
  hard: { name: 'Hard', vil: 50, gm: 1.2, atk: 10, wave: 5, bld: 3 },
};
