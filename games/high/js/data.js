'use strict';
// ---------------------------------------------------------------------------
// Static game data: ages, civilizations, units, buildings, technologies
// ---------------------------------------------------------------------------
const RES = ['food', 'wood', 'gold', 'stone'];
const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];
const AGE_ROMAN = ['I', 'II', 'III', 'IV'];
const POP_MAX = 200;
const TEAM_COLORS = ['#3b82ff', '#e8403a', '#3fc46a', '#e8c43a'];
const TEAM_NAMES = ['Blue', 'Red', 'Green', 'Yellow'];

const GATHER_BASE = { wood: 0.50, berries: 0.62, farm: 0.46, hunt: 1.0, gold: 0.48, stone: 0.48 };
const CARRY_BASE = 10;
const BUILD_BASE = 1; // seconds of work per second per builder

// --- Civilizations ----------------------------------------------------------
const CIVS = {
  britons: {
    name: 'Britons', uu: 'longbowman', color: '#c0392b',
    blurb: 'Masters of the longbow. Foot archers gain range as you advance.',
    bonuses: ['Foot archers +1 range in the Castle Age, +1 more in the Imperial Age', 'Town Centers cost 25% less wood', 'Unique unit: Longbowman'],
    fx: [
      { t: 'range', tags: ['footarcher'], v: 1, minAge: 2 },
      { t: 'range', tags: ['footarcher'], v: 1, minAge: 3 },
      { t: 'cost', ids: ['towncenter'], res: 'wood', m: 0.75 },
    ],
  },
  franks: {
    name: 'Franks', uu: 'throwingaxe', color: '#2b6cb0',
    blurb: 'Heavy cavalry and cheap castles. Chivalry in its finest form.',
    bonuses: ['Knights have +20% hit points', 'Castles cost 25% less', 'Unique unit: Throwing Axeman'],
    fx: [
      { t: 'hp', tags: ['knight'], m: 1.2 },
      { t: 'cost', ids: ['castle'], m: 0.75 },
    ],
  },
  teutons: {
    name: 'Teutons', uu: 'teutonicknight', color: '#555',
    blurb: 'Stalwart defenders with armoured infantry and mighty towers.',
    bonuses: ['Infantry +1 melee armor from the Feudal Age', 'Towers and Castles +2 range', 'Barracks train 20% faster', 'Unique unit: Teutonic Knight'],
    fx: [
      { t: 'armor', tags: ['infantry'], m: 1, minAge: 1 },
      { t: 'range', tags: ['tower', 'castle'], v: 2 },
      { t: 'time', ids: ['barracks'], m: 0.8 },
    ],
  },
  mongols: {
    name: 'Mongols', uu: 'mangudai', color: '#2f855a',
    blurb: 'Swift horse archers and hardy hunters sweep the steppe.',
    bonuses: ['Cavalry archers fire 20% faster', 'Hunters work 25% faster', 'Scout Cavalry +2 line of sight', 'Unique unit: Mangudai'],
    fx: [
      { t: 'reload', tags: ['cavarcher'], m: 0.8 },
      { t: 'gather', k: 'hunt', v: 0.25 },
      { t: 'los', tags: ['scout'], v: 2 },
    ],
  },
};

// --- Units --------------------------------------------------------------------
const UNITS = {};
function defUnit(id, o) {
  UNITS[id] = Object.assign({
    id, tags: [], hp: 30, atkM: 0, atkP: 0, armM: 0, armP: 0, range: 0, reload: 2, speed: 1, los: 5,
    bonus: {}, cost: {}, time: 25, pop: 1, radius: 0.28, bld: null, age: 0, look: {}, ranged: false,
    proj: 'arrow', sizeScale: 1,
  }, o);
}
const F = (food, wood, gold, stone) => ({ food: food || 0, wood: wood || 0, gold: gold || 0, stone: stone || 0 });

defUnit('villager', { name: 'Villager', tags: ['villager', 'foot'], hp: 25, atkM: 3, speed: 0.8, los: 4, cost: F(50), time: 25, bld: 'towncenter', reload: 2, desc: 'Gathers resources and constructs buildings.', look: { tunic: 'team', pants: '#6b4a2b', hair: '#5a3b1f', helm: 'none', weapon: 'tool' } });

// Infantry
defUnit('militia', { name: 'Militia', tags: ['infantry', 'melee', 'foot'], hp: 40, atkM: 4, armP: 1, speed: 0.9, cost: F(60, 0, 20), time: 21, bld: 'barracks', age: 0, reload: 2, desc: 'Basic swordsman.', look: { tunic: 'team', pants: '#4a4a4a', helm: 'cap', weapon: 'sword', shield: 'round', armor: 'cloth' } });
defUnit('manatarms', { name: 'Man-at-Arms', base: 'militia', tags: ['infantry', 'melee', 'foot'], hp: 45, atkM: 6, armP: 1, speed: 0.9, cost: F(60, 0, 20), time: 21, bld: 'barracks', look: { tunic: 'team', pants: '#4a4a4a', helm: 'kettle', weapon: 'sword', shield: 'round', armor: 'leather' } });
defUnit('longsword', { name: 'Long Swordsman', base: 'militia', tags: ['infantry', 'melee', 'foot'], hp: 60, atkM: 9, armM: 1, armP: 1, speed: 0.9, cost: F(60, 0, 20), time: 21, bld: 'barracks', look: { tunic: 'team', pants: '#4a4a4a', helm: 'nasal', weapon: 'sword', shield: 'kite', armor: 'mail' } });
defUnit('twohand', { name: 'Two-Handed Swordsman', base: 'militia', tags: ['infantry', 'melee', 'foot'], hp: 60, atkM: 11, armM: 1, armP: 1, speed: 0.9, cost: F(60, 0, 20), time: 21, bld: 'barracks', look: { tunic: 'team', pants: '#3a3a3a', helm: 'nasal', weapon: 'twohand', armor: 'mail' } });
defUnit('champion', { name: 'Champion', base: 'militia', tags: ['infantry', 'melee', 'foot'], hp: 70, atkM: 13, armM: 1, armP: 1, speed: 0.9, cost: F(60, 0, 20), time: 21, bld: 'barracks', look: { tunic: 'team', pants: '#2a2a2a', helm: 'great', weapon: 'twohand', armor: 'plate' } });

defUnit('spearman', { name: 'Spearman', tags: ['infantry', 'melee', 'foot', 'spear'], hp: 45, atkM: 3, atkP: 0, speed: 1.0, reload: 3, bonus: { mounted: 15 }, cost: F(35, 25), time: 22, bld: 'barracks', age: 1, desc: 'Cheap infantry. Bonus damage vs cavalry.', look: { tunic: 'team', pants: '#5a4a2a', helm: 'cap', weapon: 'spear', armor: 'cloth' } });
defUnit('pikeman', { name: 'Pikeman', base: 'spearman', tags: ['infantry', 'melee', 'foot', 'spear'], hp: 55, atkM: 4, armP: 0, speed: 1.0, reload: 3, bonus: { mounted: 22 }, cost: F(35, 25), time: 22, bld: 'barracks', look: { tunic: 'team', pants: '#5a4a2a', helm: 'kettle', weapon: 'pike', armor: 'leather' } });
defUnit('halberdier', { name: 'Halberdier', base: 'spearman', tags: ['infantry', 'melee', 'foot', 'spear'], hp: 60, atkM: 6, armM: 1, armP: 0, speed: 1.0, reload: 3, bonus: { mounted: 32 }, cost: F(35, 25), time: 22, bld: 'barracks', look: { tunic: 'team', pants: '#4a3a2a', helm: 'nasal', weapon: 'halberd', armor: 'mail' } });

// Archers
defUnit('archer', { name: 'Archer', tags: ['archer', 'ranged', 'foot', 'footarcher'], hp: 30, atkP: 4, range: 4, speed: 0.96, reload: 2, los: 7, cost: F(0, 25, 45), time: 35, bld: 'archery', age: 1, ranged: true, desc: 'Ranged unit. Strong vs infantry.', look: { tunic: 'team', pants: '#4a5a3a', helm: 'hood', weapon: 'bow', hair: '#6b4a2b' } });
defUnit('xbow', { name: 'Crossbowman', base: 'archer', tags: ['archer', 'ranged', 'foot', 'footarcher'], hp: 35, atkP: 5, range: 5, speed: 0.96, reload: 2, los: 7, cost: F(0, 25, 45), time: 35, bld: 'archery', ranged: true, look: { tunic: 'team', pants: '#4a5a3a', helm: 'cap', weapon: 'crossbow', armor: 'leather' } });
defUnit('arbalester', { name: 'Arbalester', base: 'archer', tags: ['archer', 'ranged', 'foot', 'footarcher'], hp: 40, atkP: 6, range: 5, speed: 0.96, reload: 1.9, los: 7, cost: F(0, 25, 45), time: 35, bld: 'archery', ranged: true, look: { tunic: 'team', pants: '#3a4a2a', helm: 'kettle', weapon: 'crossbow', armor: 'mail' } });
defUnit('skirm', { name: 'Skirmisher', tags: ['archer', 'ranged', 'foot', 'footarcher', 'skirm'], hp: 30, atkP: 2, armP: 3, range: 4, speed: 0.96, reload: 3, los: 6, bonus: { archer: 3 }, cost: F(25, 35), time: 22, bld: 'archery', age: 1, ranged: true, proj: 'javelin', desc: 'Counters archers. Resists arrows.', look: { tunic: 'team', pants: '#5a3a2a', helm: 'cap', weapon: 'javelin', hair: '#222' } });
defUnit('eliteskirm', { name: 'Elite Skirmisher', base: 'skirm', tags: ['archer', 'ranged', 'foot', 'footarcher', 'skirm'], hp: 35, atkP: 3, armP: 4, range: 5, speed: 0.96, reload: 3, los: 6, bonus: { archer: 5 }, cost: F(25, 35), time: 22, bld: 'archery', ranged: true, proj: 'javelin', look: { tunic: 'team', pants: '#5a3a2a', helm: 'kettle', weapon: 'javelin', armor: 'leather' } });

// Cavalry
defUnit('scout', { name: 'Scout Cavalry', tags: ['cavalry', 'melee', 'mounted', 'scout'], hp: 45, atkM: 3, armP: 2, speed: 1.55, los: 8, cost: F(80), time: 30, bld: 'stable', age: 1, reload: 2, desc: 'Fast explorer and raider.', look: { tunic: 'team', mount: 'horse', horse: '#8a5a32', helm: 'cap', weapon: 'sword' } });
defUnit('lightcav', { name: 'Light Cavalry', base: 'scout', tags: ['cavalry', 'melee', 'mounted', 'scout'], hp: 60, atkM: 7, armP: 2, speed: 1.6, los: 8, cost: F(80), time: 30, bld: 'stable', reload: 2, look: { tunic: 'team', mount: 'horse', horse: '#6a4a32', helm: 'kettle', weapon: 'sword' } });
defUnit('hussar', { name: 'Hussar', base: 'scout', tags: ['cavalry', 'melee', 'mounted', 'scout'], hp: 75, atkM: 7, armP: 2, speed: 1.65, los: 8, cost: F(80), time: 30, bld: 'stable', reload: 1.9, look: { tunic: 'team', mount: 'horse', horse: '#4a3a2a', helm: 'kettle', weapon: 'sword', cape: true } });
defUnit('knight', { name: 'Knight', tags: ['cavalry', 'melee', 'mounted', 'knight'], hp: 100, atkM: 10, armM: 2, armP: 2, speed: 1.35, los: 5, reload: 1.8, cost: F(60, 0, 75), time: 30, bld: 'stable', age: 2, desc: 'Heavy cavalry. Strong, fast and tough.', look: { tunic: 'team', mount: 'armored', horse: '#cfcfcf', helm: 'great', weapon: 'lance', shield: 'kite', armor: 'plate' } });
defUnit('cavalier', { name: 'Cavalier', base: 'knight', tags: ['cavalry', 'melee', 'mounted', 'knight'], hp: 120, atkM: 12, armM: 2, armP: 3, speed: 1.4, los: 5, reload: 1.8, cost: F(60, 0, 75), time: 30, bld: 'stable', look: { tunic: 'team', mount: 'armored', horse: '#a8a8b0', helm: 'great', weapon: 'lance', shield: 'kite', armor: 'plate' } });
defUnit('paladin', { name: 'Paladin', base: 'knight', tags: ['cavalry', 'melee', 'mounted', 'knight'], hp: 160, atkM: 14, armM: 3, armP: 3, speed: 1.4, los: 5, reload: 1.9, cost: F(60, 0, 75), time: 30, bld: 'stable', look: { tunic: 'team', mount: 'armored', horse: '#e8e8f0', helm: 'great', weapon: 'lance', shield: 'kite', armor: 'plate', cape: true } });
defUnit('cavarcher', { name: 'Cavalry Archer', tags: ['archer', 'ranged', 'mounted', 'cavarcher'], hp: 50, atkP: 6, range: 4, speed: 1.4, reload: 2, los: 6, cost: F(0, 40, 70), time: 34, bld: 'archery', age: 2, ranged: true, desc: 'Fast mounted archer.', look: { tunic: 'team', mount: 'horse', horse: '#9a6a3a', helm: 'hood', weapon: 'bow' } });
defUnit('heavycavarcher', { name: 'Heavy Cav Archer', base: 'cavarcher', tags: ['archer', 'ranged', 'mounted', 'cavarcher'], hp: 60, atkP: 7, armM: 1, range: 4, speed: 1.4, reload: 2, los: 6, cost: F(0, 40, 70), time: 34, bld: 'archery', ranged: true, look: { tunic: 'team', mount: 'horse', horse: '#7a4a2a', helm: 'kettle', weapon: 'bow', armor: 'leather' } });

// Monks and siege
defUnit('monk', { name: 'Monk', tags: ['monk', 'foot'], hp: 30, atkM: 0, speed: 0.7, los: 9, range: 9, cost: F(0, 0, 100), time: 51, bld: 'monastery', age: 2, desc: 'Heals friends and converts enemies.', look: { tunic: '#e8e0d0', pants: '#e8e0d0', helm: 'tonsure', weapon: 'staff', cape: false } });
defUnit('ram', { name: 'Battering Ram', tags: ['siege', 'ram', 'melee'], hp: 175, atkM: 2, armM: 0, armP: 150, speed: 0.5, reload: 5, bonus: { building: 100 }, cost: F(0, 160, 75), time: 36, bld: 'siege', age: 2, radius: 0.5, pop: 3, desc: 'Destroys buildings. Weak to melee.', look: { mount: 'ram' } });
defUnit('cappedram', { name: 'Capped Ram', base: 'ram', tags: ['siege', 'ram', 'melee'], hp: 200, atkM: 3, armM: 0, armP: 150, speed: 0.5, reload: 5, bonus: { building: 125 }, cost: F(0, 160, 75), time: 36, bld: 'siege', radius: 0.5, pop: 3, look: { mount: 'ram', capped: true } });
defUnit('siegeram', { name: 'Siege Ram', base: 'ram', tags: ['siege', 'ram', 'melee'], hp: 270, atkM: 4, armM: 0, armP: 150, speed: 0.55, reload: 5, bonus: { building: 150 }, cost: F(0, 160, 75), time: 36, bld: 'siege', radius: 0.5, pop: 3, look: { mount: 'ram', capped: true, siege: true } });
defUnit('mangonel', { name: 'Mangonel', tags: ['siege', 'ranged'], hp: 50, atkP: 40, range: 7, speed: 0.6, reload: 6, bonus: { building: 15 }, splash: 1.3, cost: F(0, 160, 135), time: 46, bld: 'siege', age: 2, radius: 0.5, pop: 3, ranged: true, proj: 'rock', desc: 'Area damage artillery.', sizeScale: 0.85, look: { mount: 'mangonel' } });
defUnit('onager', { name: 'Onager', base: 'mangonel', tags: ['siege', 'ranged'], hp: 60, atkP: 50, range: 8, speed: 0.6, reload: 6, bonus: { building: 20 }, splash: 1.6, cost: F(0, 160, 135), time: 46, bld: 'siege', radius: 0.5, pop: 3, ranged: true, proj: 'rock', sizeScale: 0.88, look: { mount: 'mangonel', heavy: true } });
defUnit('trebuchet', { name: 'Trebuchet', tags: ['siege', 'ranged', 'treb'], hp: 150, atkP: 200, armM: 2, armP: 5, range: 16, speed: 0.7, reload: 10, bonus: {}, splash: 1.0, buildingsOnly: true, cost: F(0, 200, 200), time: 50, bld: 'castle', age: 2, radius: 0.55, pop: 3, ranged: true, proj: 'bigrock', desc: 'Longest range. Only attacks buildings.', sizeScale: 0.72, look: { mount: 'treb' } });

// Unique units
defUnit('longbowman', { name: 'Longbowman', tags: ['archer', 'ranged', 'foot', 'footarcher', 'uu'], hp: 35, atkP: 6, range: 6, speed: 0.96, reload: 2, los: 8, cost: F(0, 35, 40), time: 18, bld: 'castle', age: 2, ranged: true, desc: 'British unique unit. Outranges all archers.', look: { tunic: 'team', pants: '#2a4a2a', helm: 'hood', weapon: 'longbow', hair: '#c9a24b', cape: true } });
defUnit('elitelongbowman', { name: 'Elite Longbowman', base: 'longbowman', tags: ['archer', 'ranged', 'foot', 'footarcher', 'uu'], hp: 40, atkP: 7, range: 7, speed: 0.96, reload: 2, los: 8, cost: F(0, 35, 40), time: 18, bld: 'castle', ranged: true, look: { tunic: 'team', pants: '#2a4a2a', helm: 'hood', weapon: 'longbow', cape: true, armor: 'leather' } });
defUnit('throwingaxe', { name: 'Throwing Axeman', tags: ['infantry', 'ranged', 'foot', 'uu'], hp: 50, atkP: 7, armM: 0, armP: 0, range: 3, speed: 1.0, reload: 2, los: 5, cost: F(55, 0, 25), time: 17, bld: 'castle', age: 2, ranged: true, proj: 'axe', desc: 'Frankish unique unit. Hurls axes.', look: { tunic: 'team', pants: '#5a3a2a', helm: 'none', weapon: 'axe', hair: '#8a4a1a' } });
defUnit('elitethrowingaxe', { name: 'Elite Throwing Axeman', base: 'throwingaxe', tags: ['infantry', 'ranged', 'foot', 'uu'], hp: 60, atkP: 8, armM: 1, armP: 0, range: 3, speed: 1.0, reload: 2, los: 5, cost: F(55, 0, 25), time: 17, bld: 'castle', ranged: true, proj: 'axe', look: { tunic: 'team', pants: '#5a3a2a', helm: 'kettle', weapon: 'axe', armor: 'leather' } });
defUnit('teutonicknight', { name: 'Teutonic Knight', tags: ['infantry', 'melee', 'foot', 'uu'], hp: 80, atkM: 12, armM: 5, armP: 2, speed: 0.85, reload: 2, los: 4, cost: F(85, 0, 40), time: 12, bld: 'castle', age: 2, desc: 'Teuton unique unit. Slow, heavily armored.', look: { tunic: '#e8e8e8', pants: '#555', helm: 'great', weapon: 'twohand', armor: 'plate', cape: true, teamTabard: true } });
defUnit('eliteteutonicknight', { name: 'Elite Teutonic Knight', base: 'teutonicknight', tags: ['infantry', 'melee', 'foot', 'uu'], hp: 100, atkM: 14, armM: 5, armP: 3, speed: 0.9, reload: 2, los: 4, cost: F(85, 0, 40), time: 12, bld: 'castle', look: { tunic: '#f0f0f0', pants: '#555', helm: 'great', weapon: 'twohand', armor: 'plate', cape: true, teamTabard: true, plume: true } });
defUnit('mangudai', { name: 'Mangudai', tags: ['archer', 'ranged', 'mounted', 'cavarcher', 'uu'], hp: 60, atkP: 6, range: 4, speed: 1.45, reload: 2.1, los: 6, bonus: { siege: 4 }, cost: F(0, 55, 65), time: 26, bld: 'castle', age: 2, ranged: true, desc: 'Mongol unique unit. Deadly horse archer.', look: { tunic: 'team', mount: 'horse', horse: '#7a5a3a', helm: 'fur', weapon: 'bow' } });
defUnit('elitemangudai', { name: 'Elite Mangudai', base: 'mangudai', tags: ['archer', 'ranged', 'mounted', 'cavarcher', 'uu'], hp: 60, atkP: 6, armM: 1, range: 4, speed: 1.5, reload: 2.1, los: 6, bonus: { siege: 4 }, cost: F(0, 55, 65), time: 26, bld: 'castle', ranged: true, look: { tunic: 'team', mount: 'horse', horse: '#5a3a2a', helm: 'fur', weapon: 'bow', armor: 'leather' } });

// Animals / neutral
const ANIMALS = {
  deer: { name: 'Deer', food: 140, speed: 1.2 },
  boar: { name: 'Wild Boar', food: 300, speed: 1.4, hp: 40, atk: 7 },
};

// --- Buildings ------------------------------------------------------------------
const BUILDINGS = {};
function defBld(id, o) {
  BUILDINGS[id] = Object.assign({
    id, size: 2, hp: 1000, armM: 3, armP: 8, cost: {}, time: 40, age: 0, req: null, pop: 0, los: 6,
    drop: null, trains: [], techs: [], garrison: 0, tags: ['building'], solid: true, height: 50,
  }, o);
}
defBld('house', { name: 'House', size: 2, hp: 550, cost: F(0, 25), time: 25, pop: 5, los: 4, height: 38, desc: 'Provides 5 population.', tags: ['building', 'house'] });
defBld('towncenter', { name: 'Town Center', size: 4, hp: 2400, cost: F(0, 275, 0, 100), time: 150, pop: 10, los: 9, drop: ['food', 'wood', 'gold', 'stone'], trains: ['villager'], techs: ['loom', 'wheelbarrow', 'handcart', 'townwatch', 'feudal', 'castle', 'imperial'], garrison: 15, atk: { p: 5, range: 6, reload: 2 }, height: 80, age: 1, tags: ['building', 'tc', 'ranged'], desc: 'Trains villagers and is the heart of your town.' });
defBld('mill', { name: 'Mill', size: 2, hp: 1100, cost: F(0, 100), time: 35, drop: ['food'], techs: ['horsecollar', 'heavyplow', 'cropnrotation'], height: 60, desc: 'Food drop-off. Place farms next to it.' });
defBld('lumber', { name: 'Lumber Camp', size: 2, hp: 1100, cost: F(0, 100), time: 35, drop: ['wood'], techs: ['doublebit', 'bowsaw', 'twoman'], height: 40, desc: 'Wood drop-off. Build next to forests.' });
defBld('mining', { name: 'Mining Camp', size: 2, hp: 1100, cost: F(0, 100), time: 35, drop: ['gold', 'stone'], techs: ['goldmining', 'goldshaft', 'stonemining', 'stoneshaft'], height: 40, desc: 'Gold and stone drop-off.' });
defBld('farm', { name: 'Farm', size: 3, hp: 480, armM: 0, armP: 0, cost: F(0, 60), time: 15, solid: false, height: 8, tags: ['building', 'farm'], desc: 'Infinite-ish food. Needs a nearby Mill or Town Center.' });
defBld('barracks', { name: 'Barracks', size: 3, hp: 1500, cost: F(0, 175), time: 50, trains: ['militia', 'spearman'], techs: ['manatarms', 'longsword', 'twohand', 'champion', 'pikeman', 'halberdier', 'squires'], height: 56, desc: 'Trains infantry.' });
defBld('archery', { name: 'Archery Range', size: 3, hp: 1500, cost: F(0, 175), time: 50, age: 1, trains: ['archer', 'skirm', 'cavarcher'], techs: ['xbow', 'arbalester', 'eliteskirm', 'heavycavarcher', 'thumbring'], height: 50, desc: 'Trains archers and skirmishers.' });
defBld('stable', { name: 'Stable', size: 3, hp: 1500, cost: F(0, 175), time: 50, age: 1, trains: ['scout', 'knight'], techs: ['lightcav', 'hussar', 'cavalier', 'paladin', 'bloodlines', 'husbandry'], height: 52, desc: 'Trains cavalry.' });
defBld('siege', { name: 'Siege Workshop', size: 3, hp: 1500, cost: F(0, 200), time: 40, age: 2, trains: ['ram', 'mangonel'], techs: ['cappedram', 'siegeram', 'onager'], height: 56, desc: 'Builds rams and mangonels.' });
defBld('blacksmith', { name: 'Blacksmith', size: 3, hp: 1800, cost: F(0, 150), time: 40, age: 1, techs: ['forging', 'ironcasting', 'blastfurnace', 'scalemail', 'chainmail', 'platemail', 'scalebarding', 'chainbarding', 'platebarding', 'fletching', 'bodkin', 'bracer', 'paddedarcher', 'leatherarcher', 'ringarcher'], height: 56, desc: 'Researches attack and armor upgrades.' });
defBld('market', { name: 'Market', size: 4, hp: 1800, cost: F(0, 175), time: 60, age: 1, techs: [], height: 46, desc: 'Trade resources for gold.' });
defBld('monastery', { name: 'Monastery', size: 3, hp: 2100, cost: F(0, 175), time: 40, age: 2, trains: ['monk'], techs: ['fervor', 'sanctity', 'blockprint'], height: 90, desc: 'Trains monks. Researches faith.' });
defBld('university', { name: 'University', size: 4, hp: 2100, cost: F(0, 200), time: 60, age: 2, techs: ['masonry', 'architecture', 'treadmill', 'chemistry', 'guardtower', 'keep'], height: 72, desc: 'Researches siege and building upgrades.' });
defBld('castle', { name: 'Castle', size: 4, hp: 4800, armM: 8, armP: 10, cost: F(0, 0, 0, 650), time: 150, age: 2, pop: 20, los: 11, trains: ['trebuchet', 'UU'], techs: ['eliteuu'], garrison: 20, atk: { p: 11, range: 8, reload: 2 }, height: 96, tags: ['building', 'castle', 'ranged'], desc: 'Trains unique units and trebuchets. Fires arrows.' });
defBld('tower', { name: 'Watch Tower', size: 1, hp: 1020, cost: F(0, 50, 0, 100), time: 80, age: 1, los: 8, garrison: 5, atk: { p: 5, range: 7, reload: 2 }, height: 86, tags: ['building', 'tower', 'ranged'], desc: 'Defensive tower. Garrison infantry for more arrows.' });
defBld('palisade', { name: 'Palisade Wall', size: 1, hp: 250, armM: 2, armP: 5, cost: F(0, 3), time: 5, age: 0, los: 2, height: 22, tags: ['building', 'wall'], desc: 'Cheap wooden wall. Drag to place.' });
defBld('stonewall', { name: 'Stone Wall', size: 1, hp: 1200, armM: 8, armP: 8, cost: F(0, 0, 0, 5), time: 8, age: 1, los: 2, height: 30, tags: ['building', 'wall'], desc: 'Sturdy wall. Drag to place.' });
defBld('gate', { name: 'Gate', size: 1, hp: 1200, armM: 6, armP: 8, cost: F(0, 0, 0, 30), time: 30, age: 1, los: 2, height: 36, tags: ['building', 'wall', 'gate'], desc: 'Your units pass through freely.' });

const BLD_ECON = ['house', 'mill', 'lumber', 'mining', 'farm', 'towncenter', 'market', 'blacksmith', 'university', 'monastery'];
const BLD_MIL = ['barracks', 'archery', 'stable', 'siege', 'castle', 'tower', 'palisade', 'stonewall', 'gate'];

// Age requirements: buildings needed to advance
const AGE_REQ = [
  null,
  { count: 2, from: ['house', 'mill', 'lumber', 'mining', 'barracks'], text: 'two different Dark Age buildings' },
  { count: 2, from: ['archery', 'stable', 'blacksmith', 'market'], text: 'two different Feudal Age buildings' },
  { count: 1, from: ['castle', 'university', 'monastery', 'siege'], text: 'a Castle Age building' },
];
const AGE_COST = [null, F(500), F(800, 0, 200), F(1000, 0, 800)];
const AGE_TIME = [0, 130, 160, 190];

// --- Technologies -----------------------------------------------------------------
const TECHS = {};
function defTech(id, name, bld, age, cost, time, effects, o) {
  TECHS[id] = Object.assign({ id, name, bld, age, cost, time, effects: effects || [], req: null, desc: '', glyph: 'scroll' }, o || {});
}
// Town center
defTech('loom', 'Loom', 'towncenter', 0, F(0, 50), 25, [{ t: 'hp', tags: ['villager'], v: 15 }, { t: 'armor', tags: ['villager'], m: 1, p: 2 }], { desc: 'Villagers +15 HP, +1/+2 armor.', glyph: 'loom' });
defTech('wheelbarrow', 'Wheelbarrow', 'towncenter', 1, F(175, 50), 40, [{ t: 'speed', tags: ['villager'], m: 1.1 }, { t: 'carry', v: 3 }], { desc: 'Villagers move 10% faster and carry +3.', glyph: 'cart' });
defTech('handcart', 'Hand Cart', 'towncenter', 2, F(300, 200), 55, [{ t: 'speed', tags: ['villager'], m: 1.1 }, { t: 'carry', v: 7 }], { req: 'wheelbarrow', desc: 'Villagers move 10% faster and carry +7.', glyph: 'cart' });
defTech('townwatch', 'Town Watch', 'towncenter', 1, F(75), 25, [{ t: 'los', tags: ['building'], v: 4 }], { desc: 'Buildings see 4 tiles further.', glyph: 'eye' });
// Mill
defTech('horsecollar', 'Horse Collar', 'mill', 1, F(75, 75), 20, [{ t: 'gather', k: 'farm', v: 0.2 }], { desc: 'Farmers work 20% faster.', glyph: 'wheat' });
defTech('heavyplow', 'Heavy Plow', 'mill', 2, F(125, 125), 40, [{ t: 'gather', k: 'farm', v: 0.2 }], { req: 'horsecollar', desc: 'Farmers work 20% faster.', glyph: 'wheat' });
defTech('cropnrotation', 'Crop Rotation', 'mill', 3, F(250, 250), 60, [{ t: 'gather', k: 'farm', v: 0.2 }], { req: 'heavyplow', desc: 'Farmers work 20% faster.', glyph: 'wheat' });
// Lumber
defTech('doublebit', 'Double-Bit Axe', 'lumber', 1, F(100, 50), 25, [{ t: 'gather', k: 'wood', v: 0.2 }], { desc: 'Woodcutters work 20% faster.', glyph: 'axe' });
defTech('bowsaw', 'Bow Saw', 'lumber', 2, F(150, 100), 35, [{ t: 'gather', k: 'wood', v: 0.2 }], { req: 'doublebit', desc: 'Woodcutters work 20% faster.', glyph: 'axe' });
defTech('twoman', 'Two-Man Saw', 'lumber', 3, F(300, 200), 50, [{ t: 'gather', k: 'wood', v: 0.2 }], { req: 'bowsaw', desc: 'Woodcutters work 20% faster.', glyph: 'axe' });
// Mining
defTech('goldmining', 'Gold Mining', 'mining', 1, F(100, 75), 30, [{ t: 'gather', k: 'gold', v: 0.15 }], { desc: 'Gold miners work 15% faster.', glyph: 'pick' });
defTech('goldshaft', 'Gold Shaft Mining', 'mining', 2, F(200, 150), 50, [{ t: 'gather', k: 'gold', v: 0.15 }], { req: 'goldmining', desc: 'Gold miners work 15% faster.', glyph: 'pick' });
defTech('stonemining', 'Stone Mining', 'mining', 1, F(100, 75), 30, [{ t: 'gather', k: 'stone', v: 0.15 }], { desc: 'Stone miners work 15% faster.', glyph: 'pick' });
defTech('stoneshaft', 'Stone Shaft Mining', 'mining', 2, F(200, 150), 50, [{ t: 'gather', k: 'stone', v: 0.15 }], { req: 'stonemining', desc: 'Stone miners work 15% faster.', glyph: 'pick' });
// Blacksmith - attack
defTech('forging', 'Forging', 'blacksmith', 1, F(150), 50, [{ t: 'atkm', tags: ['infantry', 'cavalry'], v: 1 }], { desc: 'Infantry and cavalry +1 attack.', glyph: 'sword' });
defTech('ironcasting', 'Iron Casting', 'blacksmith', 2, F(220, 0, 120), 75, [{ t: 'atkm', tags: ['infantry', 'cavalry'], v: 1 }], { req: 'forging', desc: 'Infantry and cavalry +1 attack.', glyph: 'sword' });
defTech('blastfurnace', 'Blast Furnace', 'blacksmith', 3, F(275, 0, 225), 100, [{ t: 'atkm', tags: ['infantry', 'cavalry'], v: 2 }], { req: 'ironcasting', desc: 'Infantry and cavalry +2 attack.', glyph: 'sword' });
defTech('scalemail', 'Scale Mail Armor', 'blacksmith', 1, F(100), 40, [{ t: 'armor', tags: ['infantry'], m: 1, p: 1 }], { desc: 'Infantry +1/+1 armor.', glyph: 'armor' });
defTech('chainmail', 'Chain Mail Armor', 'blacksmith', 2, F(200, 0, 100), 55, [{ t: 'armor', tags: ['infantry'], m: 1, p: 1 }], { req: 'scalemail', desc: 'Infantry +1/+1 armor.', glyph: 'armor' });
defTech('platemail', 'Plate Mail Armor', 'blacksmith', 3, F(300, 0, 150), 70, [{ t: 'armor', tags: ['infantry'], m: 1, p: 2 }], { req: 'chainmail', desc: 'Infantry +1/+2 armor.', glyph: 'armor' });
defTech('scalebarding', 'Scale Barding Armor', 'blacksmith', 1, F(150), 45, [{ t: 'armor', tags: ['cavalry'], m: 1, p: 1 }], { desc: 'Cavalry +1/+1 armor.', glyph: 'horseshoe' });
defTech('chainbarding', 'Chain Barding Armor', 'blacksmith', 2, F(250, 0, 150), 60, [{ t: 'armor', tags: ['cavalry'], m: 1, p: 1 }], { req: 'scalebarding', desc: 'Cavalry +1/+1 armor.', glyph: 'horseshoe' });
defTech('platebarding', 'Plate Barding Armor', 'blacksmith', 3, F(350, 0, 200), 75, [{ t: 'armor', tags: ['cavalry'], m: 1, p: 2 }], { req: 'chainbarding', desc: 'Cavalry +1/+2 armor.', glyph: 'horseshoe' });
defTech('fletching', 'Fletching', 'blacksmith', 1, F(100, 0, 50), 40, [{ t: 'atkr', tags: ['ranged'], v: 1 }, { t: 'range', tags: ['archer', 'tower', 'castle', 'tc'], v: 1 }], { desc: 'Ranged units +1 attack, +1 range.', glyph: 'bow' });
defTech('bodkin', 'Bodkin Arrow', 'blacksmith', 2, F(200, 0, 100), 50, [{ t: 'atkr', tags: ['ranged'], v: 1 }, { t: 'range', tags: ['archer', 'tower', 'castle', 'tc'], v: 1 }], { req: 'fletching', desc: 'Ranged units +1 attack, +1 range.', glyph: 'bow' });
defTech('bracer', 'Bracer', 'blacksmith', 3, F(300, 0, 200), 60, [{ t: 'atkr', tags: ['ranged'], v: 1 }, { t: 'range', tags: ['archer', 'tower', 'castle', 'tc'], v: 1 }], { req: 'bodkin', desc: 'Ranged units +1 attack, +1 range.', glyph: 'bow' });
defTech('paddedarcher', 'Padded Archer Armor', 'blacksmith', 1, F(100), 40, [{ t: 'armor', tags: ['archer'], m: 1, p: 1 }], { desc: 'Archers +1/+1 armor.', glyph: 'shield' });
defTech('leatherarcher', 'Leather Archer Armor', 'blacksmith', 2, F(150, 0, 150), 55, [{ t: 'armor', tags: ['archer'], m: 1, p: 1 }], { req: 'paddedarcher', desc: 'Archers +1/+1 armor.', glyph: 'shield' });
defTech('ringarcher', 'Ring Archer Armor', 'blacksmith', 3, F(250, 0, 250), 70, [{ t: 'armor', tags: ['archer'], m: 1, p: 2 }], { req: 'leatherarcher', desc: 'Archers +1/+2 armor.', glyph: 'shield' });
// Barracks
defTech('squires', 'Squires', 'barracks', 1, F(100), 40, [{ t: 'speed', tags: ['infantry'], m: 1.1 }], { desc: 'Infantry move 10% faster.', glyph: 'boot' });
defTech('manatarms', 'Man-at-Arms', 'barracks', 1, F(100, 0, 40), 35, [{ t: 'upgrade', from: 'militia', to: 'manatarms' }], { desc: 'Upgrade Militia to Man-at-Arms.', glyph: 'sword', unitIcon: 'manatarms' });
defTech('longsword', 'Long Swordsman', 'barracks', 2, F(150, 0, 65), 45, [{ t: 'upgrade', from: 'manatarms', to: 'longsword' }], { req: 'manatarms', desc: 'Upgrade to Long Swordsman.', unitIcon: 'longsword' });
defTech('twohand', 'Two-Handed Swordsman', 'barracks', 3, F(300, 0, 150), 75, [{ t: 'upgrade', from: 'longsword', to: 'twohand' }], { req: 'longsword', desc: 'Upgrade to Two-Handed Swordsman.', unitIcon: 'twohand' });
defTech('champion', 'Champion', 'barracks', 3, F(750, 0, 350), 100, [{ t: 'upgrade', from: 'twohand', to: 'champion' }], { req: 'twohand', desc: 'Upgrade to Champion.', unitIcon: 'champion' });
defTech('pikeman', 'Pikeman', 'barracks', 2, F(215, 0, 90), 45, [{ t: 'upgrade', from: 'spearman', to: 'pikeman' }], { desc: 'Upgrade Spearman to Pikeman.', unitIcon: 'pikeman' });
defTech('halberdier', 'Halberdier', 'barracks', 3, F(300, 0, 600), 50, [{ t: 'upgrade', from: 'pikeman', to: 'halberdier' }], { req: 'pikeman', desc: 'Upgrade to Halberdier.', unitIcon: 'halberdier' });
// Archery
defTech('xbow', 'Crossbowman', 'archery', 2, F(125, 0, 75), 35, [{ t: 'upgrade', from: 'archer', to: 'xbow' }], { desc: 'Upgrade Archer to Crossbowman.', unitIcon: 'xbow' });
defTech('arbalester', 'Arbalester', 'archery', 3, F(300, 0, 475), 50, [{ t: 'upgrade', from: 'xbow', to: 'arbalester' }], { req: 'xbow', desc: 'Upgrade to Arbalester.', unitIcon: 'arbalester' });
defTech('eliteskirm', 'Elite Skirmisher', 'archery', 2, F(230, 0, 130), 50, [{ t: 'upgrade', from: 'skirm', to: 'eliteskirm' }], { desc: 'Upgrade to Elite Skirmisher.', unitIcon: 'eliteskirm' });
defTech('heavycavarcher', 'Heavy Cav Archer', 'archery', 3, F(900, 0, 500), 50, [{ t: 'upgrade', from: 'cavarcher', to: 'heavycavarcher' }], { desc: 'Upgrade to Heavy Cavalry Archer.', unitIcon: 'heavycavarcher' });
defTech('thumbring', 'Thumb Ring', 'archery', 2, F(0, 300, 250), 45, [{ t: 'reload', tags: ['archer'], m: 0.9 }], { desc: 'Archers fire 10% faster.', glyph: 'ring' });
// Stable
defTech('lightcav', 'Light Cavalry', 'stable', 2, F(150, 0, 50), 45, [{ t: 'upgrade', from: 'scout', to: 'lightcav' }], { desc: 'Upgrade Scout to Light Cavalry.', unitIcon: 'lightcav' });
defTech('hussar', 'Hussar', 'stable', 3, F(500, 0, 600), 50, [{ t: 'upgrade', from: 'lightcav', to: 'hussar' }], { req: 'lightcav', desc: 'Upgrade to Hussar.', unitIcon: 'hussar' });
defTech('cavalier', 'Cavalier', 'stable', 2, F(300, 0, 300), 100, [{ t: 'upgrade', from: 'knight', to: 'cavalier' }], { desc: 'Upgrade Knight to Cavalier.', unitIcon: 'cavalier' });
defTech('paladin', 'Paladin', 'stable', 3, F(1300, 0, 750), 170, [{ t: 'upgrade', from: 'cavalier', to: 'paladin' }], { req: 'cavalier', desc: 'Upgrade to Paladin.', unitIcon: 'paladin' });
defTech('bloodlines', 'Bloodlines', 'stable', 1, F(150, 0, 100), 50, [{ t: 'hp', tags: ['cavalry'], v: 20 }], { desc: 'Cavalry +20 HP.', glyph: 'heart' });
defTech('husbandry', 'Husbandry', 'stable', 1, F(130), 40, [{ t: 'speed', tags: ['cavalry'], m: 1.1 }], { desc: 'Cavalry move 10% faster.', glyph: 'horseshoe' });
// Siege
defTech('cappedram', 'Capped Ram', 'siege', 3, F(300, 0, 200), 50, [{ t: 'upgrade', from: 'ram', to: 'cappedram' }], { desc: 'Upgrade Rams.', unitIcon: 'cappedram' });
defTech('siegeram', 'Siege Ram', 'siege', 3, F(1000, 0, 800), 80, [{ t: 'upgrade', from: 'cappedram', to: 'siegeram' }], { req: 'cappedram', desc: 'Upgrade Rams.', unitIcon: 'siegeram' });
defTech('onager', 'Onager', 'siege', 3, F(800, 0, 500), 75, [{ t: 'upgrade', from: 'mangonel', to: 'onager' }], { desc: 'Upgrade Mangonel to Onager.', unitIcon: 'onager' });
// University
defTech('masonry', 'Masonry', 'university', 2, F(150, 175), 50, [{ t: 'armor', tags: ['building'], m: 1, p: 1 }, { t: 'hp', tags: ['building'], m: 1.1 }], { desc: 'Buildings +10% HP, +1/+1 armor.', glyph: 'brick' });
defTech('architecture', 'Architecture', 'university', 3, F(200, 300), 70, [{ t: 'armor', tags: ['building'], m: 1, p: 1 }, { t: 'hp', tags: ['building'], m: 1.1 }], { req: 'masonry', desc: 'Buildings +10% HP, +1/+1 armor.', glyph: 'brick' });
defTech('treadmill', 'Treadmill Crane', 'university', 2, F(200, 250), 50, [{ t: 'buildspeed', v: 0.2 }], { desc: 'Villagers build 20% faster.', glyph: 'hammer' });
defTech('chemistry', 'Chemistry', 'university', 3, F(300, 0, 200), 100, [{ t: 'atkr', tags: ['ranged'], v: 1 }, { t: 'atkm', tags: ['infantry', 'cavalry'], v: 1 }], { desc: 'Ranged and melee units +1 attack.', glyph: 'flask' });
defTech('guardtower', 'Guard Tower', 'university', 2, F(100, 0, 250), 45, [{ t: 'hp', tags: ['tower'], m: 1.5 }, { t: 'atkr', tags: ['tower'], v: 2 }], { desc: 'Towers +50% HP, +2 attack.', glyph: 'tower' });
defTech('keep', 'Keep', 'university', 3, F(300, 0, 500), 60, [{ t: 'hp', tags: ['tower'], m: 1.4 }, { t: 'atkr', tags: ['tower'], v: 2 }, { t: 'range', tags: ['tower'], v: 1 }], { req: 'guardtower', desc: 'Towers +40% HP, +2 attack, +1 range.', glyph: 'tower' });
// Monastery
defTech('fervor', 'Fervor', 'monastery', 2, F(0, 0, 140), 50, [{ t: 'speed', tags: ['monk'], m: 1.15 }], { desc: 'Monks move 15% faster.', glyph: 'cross' });
defTech('sanctity', 'Sanctity', 'monastery', 2, F(0, 0, 120), 60, [{ t: 'hp', tags: ['monk'], v: 15 }], { desc: 'Monks +15 HP.', glyph: 'cross' });
defTech('blockprint', 'Block Printing', 'monastery', 3, F(0, 0, 200), 60, [{ t: 'range', tags: ['monk'], v: 3 }], { desc: 'Monks convert from +3 range.', glyph: 'scroll' });
// Castle
defTech('eliteuu', 'Elite Unique Unit', 'castle', 3, F(700, 0, 450), 60, [{ t: 'uuupgrade' }], { desc: 'Upgrade your unique unit to its elite form.', glyph: 'crown' });
// Age advancement (handled specially)
defTech('feudal', 'Feudal Age', 'towncenter', 0, AGE_COST[1], AGE_TIME[1], [{ t: 'age', v: 1 }], { desc: 'Advance to the Feudal Age.', glyph: 'age', toAge: 1 });
defTech('castle', 'Castle Age', 'towncenter', 1, AGE_COST[2], AGE_TIME[2], [{ t: 'age', v: 2 }], { desc: 'Advance to the Castle Age.', glyph: 'age', toAge: 2 });
defTech('imperial', 'Imperial Age', 'towncenter', 2, AGE_COST[3], AGE_TIME[3], [{ t: 'age', v: 3 }], { desc: 'Advance to the Imperial Age.', glyph: 'age', toAge: 3 });

// Market
const MARKET_TRADE = ['food', 'wood', 'stone'];
