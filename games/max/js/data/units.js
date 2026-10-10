// Unit catalog. Stats follow Age of Empires II (Definitive Edition) closely so the game "feels" right.
// Attack object: keys 'melee' / 'pierce' are the base damage types (reduced by the target's armor of that type);
// every other key is a bonus vs targets carrying that tag (e.g. cavalry: 15). Damage = sum(max(0, atk - armor)), min 1.
// Speeds are tiles per game-second, times are game-seconds.

export const UNITS = {};

function def(id, o) {
  UNITS[id] = Object.assign({
    id, kind: 'unit', pop: 1, radius: 0.3, los: 5, range: 0, minRange: 0, reload: 2, attackDur: 0.9,
    accuracy: 1, atk: {}, armor: { melee: 0, pierce: 0 }, cost: {}, time: 25, ageReq: 0, tags: [],
    proj: null, splash: 0,
  }, o);
  UNITS[id].tags = ['unit', ...(o.tags || [])];
  return UNITS[id];
}

// ------------------------------------------------------------------ Civilians
def('villager', {
  name: 'Villager', hp: 25, speed: 0.8, los: 5, radius: 0.25, atk: { melee: 3 }, reload: 2,
  cost: { food: 50 }, time: 25, carry: 10, tags: ['villager', 'civilian'], line: 'villager',
  desc: 'Gathers resources, builds and repairs. Can hunt animals and defend itself weakly.',
});

// ------------------------------------------------------------------ Infantry (Barracks)
def('militia', {
  name: 'Militia', hp: 40, speed: 0.9, los: 5, atk: { melee: 4 }, armor: { melee: 0, pierce: 1 },
  cost: { food: 60, gold: 20 }, time: 21, ageReq: 0, tags: ['infantry', 'melee'], line: 'swordsman',
  desc: 'Basic infantry. Cheap and available from the Dark Age. Strong against archers and siege.',
});
def('man_at_arms', {
  name: 'Man-at-Arms', hp: 45, speed: 0.9, los: 5, atk: { melee: 6 }, armor: { melee: 0, pierce: 1 },
  cost: { food: 60, gold: 20 }, time: 21, ageReq: 1, tags: ['infantry', 'melee'], line: 'swordsman',
  desc: 'Upgraded militia with a keener blade.',
});
def('long_swordsman', {
  name: 'Long Swordsman', hp: 55, speed: 0.9, los: 5, atk: { melee: 9 }, armor: { melee: 0, pierce: 1 },
  cost: { food: 60, gold: 20 }, time: 21, ageReq: 2, tags: ['infantry', 'melee'], line: 'swordsman',
  desc: 'Veteran swordsman wielding a long blade.',
});
def('two_handed', {
  name: 'Two-Handed Swordsman', hp: 60, speed: 0.9, los: 5, atk: { melee: 11 }, armor: { melee: 0, pierce: 1 },
  cost: { food: 60, gold: 20 }, time: 21, ageReq: 3, tags: ['infantry', 'melee'], line: 'swordsman',
  desc: 'Heavily trained swordsman with a mighty greatsword.',
});
def('champion', {
  name: 'Champion', hp: 70, speed: 0.9, los: 5, atk: { melee: 13 }, armor: { melee: 1, pierce: 1 },
  cost: { food: 60, gold: 20 }, time: 21, ageReq: 3, tags: ['infantry', 'melee'], line: 'swordsman',
  desc: 'The finest infantry of the age. Hard-hitting and tough.',
});

def('spearman', {
  name: 'Spearman', hp: 45, speed: 1.0, los: 5, atk: { melee: 3, cavalry: 15 }, reload: 3, armor: { melee: 0, pierce: 0 },
  cost: { food: 35, wood: 25 }, time: 22, ageReq: 1, tags: ['infantry', 'melee', 'spearman'], line: 'spearman',
  desc: 'Cheap anti-cavalry infantry. Bonus damage against horses.',
});
def('pikeman', {
  name: 'Pikeman', hp: 55, speed: 1.0, los: 5, atk: { melee: 4, cavalry: 22 }, reload: 3, armor: { melee: 0, pierce: 0 },
  cost: { food: 35, wood: 25 }, time: 22, ageReq: 2, tags: ['infantry', 'melee', 'spearman'], line: 'spearman',
  desc: 'Longer pike with a deadly bonus against cavalry.',
});
def('halberdier', {
  name: 'Halberdier', hp: 60, speed: 1.0, los: 5, atk: { melee: 6, cavalry: 32 }, reload: 3, armor: { melee: 0, pierce: 0 },
  cost: { food: 35, wood: 25 }, time: 22, ageReq: 3, tags: ['infantry', 'melee', 'spearman'], line: 'spearman',
  desc: 'Elite anti-cavalry pole-arm infantry.',
});

// ------------------------------------------------------------------ Archery Range
def('skirmisher', {
  name: 'Skirmisher', hp: 30, speed: 0.96, los: 7, atk: { pierce: 2, archer: 3 }, reload: 3, range: 4, minRange: 0,
  armor: { melee: 0, pierce: 3 }, cost: { food: 25, wood: 35 }, time: 22, ageReq: 1, tags: ['infantry', 'ranged', 'skirmisher'],
  proj: 'javelin', attackDur: 0.8, accuracy: 0.9, line: 'skirmisher',
  desc: 'Javelin thrower. Cheap counter to massed archers; weak against everything else.',
});
def('elite_skirmisher', {
  name: 'Elite Skirmisher', hp: 35, speed: 0.96, los: 8, atk: { pierce: 3, archer: 5 }, reload: 3, range: 5,
  armor: { melee: 0, pierce: 4 }, cost: { food: 25, wood: 35 }, time: 22, ageReq: 2, tags: ['infantry', 'ranged', 'skirmisher'],
  proj: 'javelin', attackDur: 0.8, accuracy: 0.9, line: 'skirmisher',
  desc: 'Veteran javelin thrower with longer reach.',
});

def('archer', {
  name: 'Archer', hp: 30, speed: 0.96, los: 7, atk: { pierce: 4 }, reload: 2, range: 4, minRange: 0,
  armor: { melee: 0, pierce: 0 }, cost: { wood: 25, gold: 45 }, time: 35, ageReq: 1, tags: ['archer', 'ranged', 'footarcher'],
  proj: 'arrow', attackDur: 0.8, accuracy: 0.85, line: 'archer',
  desc: 'Ranged unit. Strong against infantry, vulnerable to cavalry and skirmishers.',
});
def('crossbowman', {
  name: 'Crossbowman', hp: 35, speed: 0.96, los: 7, atk: { pierce: 5 }, reload: 2, range: 5,
  armor: { melee: 0, pierce: 0 }, cost: { wood: 25, gold: 45 }, time: 27, ageReq: 2, tags: ['archer', 'ranged', 'footarcher'],
  proj: 'arrow', attackDur: 0.8, accuracy: 0.85, line: 'archer',
  desc: 'Upgraded archer with a heavier bolt and longer range.',
});
def('arbalester', {
  name: 'Arbalester', hp: 40, speed: 0.96, los: 7, atk: { pierce: 6 }, reload: 2, range: 5,
  armor: { melee: 0, pierce: 0 }, cost: { wood: 25, gold: 45 }, time: 27, ageReq: 3, tags: ['archer', 'ranged', 'footarcher'],
  proj: 'arrow', attackDur: 0.8, accuracy: 0.85, line: 'archer',
  desc: 'Elite crossbow marksman.',
});
def('cavalry_archer', {
  name: 'Cavalry Archer', hp: 50, speed: 1.4, los: 7, radius: 0.38, atk: { pierce: 6 }, reload: 2, range: 4,
  armor: { melee: 0, pierce: 0 }, cost: { wood: 40, gold: 70 }, time: 34, ageReq: 2, tags: ['archer', 'ranged', 'cavalry', 'cavarcher'],
  proj: 'arrow', attackDur: 0.8, accuracy: 0.8, line: 'cavarcher',
  desc: 'Fast mounted archer. Hit-and-run specialist.',
});
def('heavy_cav_archer', {
  name: 'Heavy Cavalry Archer', hp: 60, speed: 1.4, los: 7, radius: 0.38, atk: { pierce: 7 }, reload: 2, range: 4,
  armor: { melee: 1, pierce: 1 }, cost: { wood: 40, gold: 70 }, time: 34, ageReq: 3, tags: ['archer', 'ranged', 'cavalry', 'cavarcher'],
  proj: 'arrow', attackDur: 0.8, accuracy: 0.8, line: 'cavarcher',
  desc: 'Armored horse archer.',
});

// ------------------------------------------------------------------ Stable
def('scout', {
  name: 'Scout Cavalry', hp: 45, speed: 1.5, los: 8, radius: 0.38, atk: { melee: 3 }, reload: 2, armor: { melee: 0, pierce: 2 },
  cost: { food: 80 }, time: 30, ageReq: 1, tags: ['cavalry', 'melee', 'scout'], line: 'scout',
  desc: 'Fast explorer and raider. Great for hunting down villagers and scouting the map.',
});
def('light_cavalry', {
  name: 'Light Cavalry', hp: 60, speed: 1.5, los: 8, radius: 0.38, atk: { melee: 7 }, reload: 2, armor: { melee: 0, pierce: 2 },
  cost: { food: 80, gold: 10 }, time: 30, ageReq: 2, tags: ['cavalry', 'melee', 'scout'], line: 'scout',
  desc: 'Faster, tougher scout cavalry.',
});
def('hussar', {
  name: 'Hussar', hp: 75, speed: 1.55, los: 8, radius: 0.38, atk: { melee: 7 }, reload: 2, armor: { melee: 0, pierce: 2 },
  cost: { food: 80, gold: 10 }, time: 30, ageReq: 3, tags: ['cavalry', 'melee', 'scout'], line: 'scout',
  desc: 'Elite light cavalry raider.',
});
def('knight', {
  name: 'Knight', hp: 100, speed: 1.35, los: 6, radius: 0.4, atk: { melee: 10 }, reload: 1.8, armor: { melee: 2, pierce: 2 },
  cost: { food: 60, gold: 75 }, time: 30, ageReq: 2, tags: ['cavalry', 'melee', 'knight'], line: 'knight',
  desc: 'Heavy cavalry. Powerful and tough; vulnerable to spearmen and camels.',
});
def('cavalier', {
  name: 'Cavalier', hp: 120, speed: 1.35, los: 6, radius: 0.4, atk: { melee: 12 }, reload: 1.8, armor: { melee: 2, pierce: 3 },
  cost: { food: 60, gold: 75 }, time: 30, ageReq: 3, tags: ['cavalry', 'melee', 'knight'], line: 'knight',
  desc: 'Upgraded knight with better barding.',
});
def('paladin', {
  name: 'Paladin', hp: 160, speed: 1.35, los: 6, radius: 0.4, atk: { melee: 14 }, reload: 1.8, armor: { melee: 2, pierce: 3 },
  cost: { food: 60, gold: 75 }, time: 30, ageReq: 3, tags: ['cavalry', 'melee', 'knight'], line: 'knight',
  desc: 'The pinnacle of heavy cavalry.',
});
def('camel', {
  name: 'Camel Rider', hp: 100, speed: 1.45, los: 5, radius: 0.4, atk: { melee: 6, cavalry: 9 }, reload: 2, armor: { melee: 0, pierce: 0 },
  cost: { food: 55, gold: 60 }, time: 22, ageReq: 2, tags: ['cavalry', 'melee', 'camel'], line: 'camel',
  desc: 'Mounted anti-cavalry unit. Bonus damage against horses.',
});
def('heavy_camel', {
  name: 'Heavy Camel Rider', hp: 120, speed: 1.45, los: 5, radius: 0.4, atk: { melee: 7, cavalry: 9 }, reload: 2, armor: { melee: 0, pierce: 0 },
  cost: { food: 55, gold: 60 }, time: 22, ageReq: 3, tags: ['cavalry', 'melee', 'camel'], line: 'camel',
  desc: 'Tougher camel rider. Excellent vs cavalry.',
});

// ------------------------------------------------------------------ Siege Workshop
def('ram', {
  name: 'Battering Ram', hp: 175, speed: 0.5, los: 4, radius: 0.55, atk: { melee: 3, building: 125 }, reload: 5, attackDur: 1.2,
  armor: { melee: 0, pierce: 150 }, cost: { wood: 160, gold: 75 }, time: 36, ageReq: 2, tags: ['siege', 'ram', 'melee'], line: 'ram',
  desc: 'Smashes buildings. Immune to arrows but helpless against melee units.',
});
def('capped_ram', {
  name: 'Capped Ram', hp: 200, speed: 0.5, los: 4, radius: 0.55, atk: { melee: 3, building: 150 }, reload: 5, attackDur: 1.2,
  armor: { melee: 0, pierce: 150 }, cost: { wood: 160, gold: 75 }, time: 36, ageReq: 3, tags: ['siege', 'ram', 'melee'], line: 'ram',
  desc: 'Reinforced battering ram.',
});
def('siege_ram', {
  name: 'Siege Ram', hp: 270, speed: 0.5, los: 4, radius: 0.55, atk: { melee: 4, building: 200 }, reload: 5, attackDur: 1.2,
  armor: { melee: 0, pierce: 180 }, cost: { wood: 160, gold: 75 }, time: 36, ageReq: 3, tags: ['siege', 'ram', 'melee'], line: 'ram',
  desc: 'The ultimate building-breaker.',
});
def('mangonel', {
  name: 'Mangonel', hp: 50, speed: 0.6, los: 6, radius: 0.55, atk: { melee: 40 }, reload: 6, range: 7, minRange: 3, attackDur: 1.4,
  armor: { melee: 0, pierce: 6 }, cost: { wood: 160, gold: 135 }, time: 46, ageReq: 2, tags: ['siege', 'ranged'], line: 'mangonel',
  proj: 'stone', splash: 1.3, accuracy: 0.8,
  desc: 'Hurls rocks that damage clusters of units. Cannot hit targets that are too close.',
});
def('onager', {
  name: 'Onager', hp: 60, speed: 0.6, los: 6, radius: 0.55, atk: { melee: 50 }, reload: 6, range: 7, minRange: 3, attackDur: 1.4,
  armor: { melee: 0, pierce: 7 }, cost: { wood: 160, gold: 135 }, time: 46, ageReq: 3, tags: ['siege', 'ranged'], line: 'mangonel',
  proj: 'stone', splash: 1.5, accuracy: 0.8,
  desc: 'Upgraded mangonel with a bigger payload.',
});
def('siege_onager', {
  name: 'Siege Onager', hp: 70, speed: 0.6, los: 6, radius: 0.55, atk: { melee: 60 }, reload: 6, range: 8, minRange: 3, attackDur: 1.4,
  armor: { melee: 0, pierce: 8 }, cost: { wood: 160, gold: 135 }, time: 46, ageReq: 3, tags: ['siege', 'ranged'], line: 'mangonel',
  proj: 'stone', splash: 1.7, accuracy: 0.8,
  desc: 'Devastating area-damage siege weapon.',
});
def('scorpion', {
  name: 'Scorpion', hp: 40, speed: 0.65, los: 6, radius: 0.5, atk: { pierce: 12 }, reload: 3.6, range: 7, attackDur: 1.0,
  armor: { melee: 0, pierce: 7 }, cost: { wood: 75, gold: 75 }, time: 30, ageReq: 2, tags: ['siege', 'ranged'], line: 'scorpion',
  proj: 'bolt', accuracy: 0.8,
  desc: 'Fires heavy bolts. Excellent against infantry and archers in groups.',
});
def('heavy_scorpion', {
  name: 'Heavy Scorpion', hp: 50, speed: 0.65, los: 6, radius: 0.5, atk: { pierce: 16 }, reload: 3.6, range: 7, attackDur: 1.0,
  armor: { melee: 0, pierce: 8 }, cost: { wood: 75, gold: 75 }, time: 30, ageReq: 3, tags: ['siege', 'ranged'], line: 'scorpion',
  proj: 'bolt', accuracy: 0.8,
  desc: 'Heavier scorpion with stronger bolts.',
});
def('trebuchet', {
  name: 'Trebuchet', hp: 150, speed: 0.8, los: 8, radius: 0.65, atk: { melee: 200 }, reload: 9, range: 16, minRange: 5, attackDur: 1.6,
  armor: { melee: 2, pierce: 150 }, cost: { wood: 200, gold: 200 }, time: 50, ageReq: 2, tags: ['siege', 'ranged', 'trebuchet'], line: 'trebuchet',
  proj: 'bigstone', splash: 1.0, accuracy: 0.45, unpack: 3.5,
  desc: 'Colossal long-range siege engine. Must be set up before firing. Devastates buildings.',
});

// ------------------------------------------------------------------ Monastery
def('monk', {
  name: 'Monk', hp: 30, speed: 0.7, los: 11, radius: 0.28, atk: {}, reload: 2, range: 9, armor: { melee: 0, pierce: 0 },
  cost: { gold: 100 }, time: 51, ageReq: 2, tags: ['monk', 'support'], line: 'monk',
  heal: { amount: 3, reload: 2 }, convert: { time: [3.5, 8], rejuvenate: 55, range: 9 },
  desc: 'Heals friendly units and converts enemy units to your side.',
});

// ------------------------------------------------------------------ Unique units (Castle)
def('longbowman', {
  name: 'Longbowman', hp: 35, speed: 0.9, los: 8, atk: { pierce: 6 }, reload: 2, range: 5,
  armor: { melee: 0, pierce: 0 }, cost: { food: 35, wood: 40 }, time: 18, ageReq: 2, tags: ['archer', 'ranged', 'footarcher', 'unique'],
  proj: 'arrow', attackDur: 0.8, accuracy: 0.85, line: 'longbow', uniqueTo: 'britons',
  desc: 'British unique archer with exceptional range.',
});
def('elite_longbowman', {
  name: 'Elite Longbowman', hp: 40, speed: 0.9, los: 9, atk: { pierce: 7 }, reload: 2, range: 6,
  armor: { melee: 0, pierce: 1 }, cost: { food: 35, wood: 40 }, time: 18, ageReq: 3, tags: ['archer', 'ranged', 'footarcher', 'unique'],
  proj: 'arrow', attackDur: 0.8, accuracy: 0.85, line: 'longbow', uniqueTo: 'britons',
  desc: 'Elite British longbow master.',
});
def('throwing_axeman', {
  name: 'Throwing Axeman', hp: 50, speed: 1.0, los: 6, atk: { pierce: 7 }, reload: 2, range: 4,
  armor: { melee: 0, pierce: 0 }, cost: { food: 55, gold: 25 }, time: 17, ageReq: 2, tags: ['infantry', 'ranged', 'unique'],
  proj: 'axe', attackDur: 0.8, accuracy: 0.85, line: 'axeman', uniqueTo: 'franks',
  desc: 'Frankish unique unit. Hurls axes at close range; tough and quick.',
});
def('elite_throwing_axeman', {
  name: 'Elite Throwing Axeman', hp: 60, speed: 1.0, los: 6, atk: { pierce: 9 }, reload: 2, range: 4,
  armor: { melee: 0, pierce: 1 }, cost: { food: 55, gold: 25 }, time: 17, ageReq: 3, tags: ['infantry', 'ranged', 'unique'],
  proj: 'axe', attackDur: 0.8, accuracy: 0.85, line: 'axeman', uniqueTo: 'franks',
  desc: 'Elite axe-hurler.',
});
def('huskarl', {
  name: 'Huskarl', hp: 60, speed: 1.05, los: 5, atk: { melee: 10, building: 6 }, reload: 2, armor: { melee: 0, pierce: 6 },
  cost: { food: 60, gold: 30 }, time: 16, ageReq: 2, tags: ['infantry', 'melee', 'unique'], line: 'huskarl', uniqueTo: 'goths',
  desc: 'Gothic elite housecarl. Nearly immune to arrows; devastating against archers.',
});
def('elite_huskarl', {
  name: 'Elite Huskarl', hp: 70, speed: 1.05, los: 5, atk: { melee: 12, building: 6 }, reload: 2, armor: { melee: 0, pierce: 7 },
  cost: { food: 60, gold: 30 }, time: 16, ageReq: 3, tags: ['infantry', 'melee', 'unique'], line: 'huskarl', uniqueTo: 'goths',
  desc: 'Elite housecarl. A wall of steel against ranged troops.',
});
def('mangudai', {
  name: 'Mangudai', hp: 60, speed: 1.4, los: 7, radius: 0.38, atk: { pierce: 6, siege: 4 }, reload: 1.6, range: 4,
  armor: { melee: 0, pierce: 0 }, cost: { wood: 55, gold: 65 }, time: 26, ageReq: 2, tags: ['archer', 'ranged', 'cavalry', 'cavarcher', 'unique'],
  proj: 'arrow', attackDur: 0.7, accuracy: 0.8, line: 'mangudai', uniqueTo: 'mongols',
  desc: 'Mongol horse archer. Fires rapidly and hits siege hard.',
});
def('elite_mangudai', {
  name: 'Elite Mangudai', hp: 60, speed: 1.4, los: 7, radius: 0.38, atk: { pierce: 7, siege: 4 }, reload: 1.6, range: 4,
  armor: { melee: 1, pierce: 1 }, cost: { wood: 55, gold: 65 }, time: 26, ageReq: 3, tags: ['archer', 'ranged', 'cavalry', 'cavarcher', 'unique'],
  proj: 'arrow', attackDur: 0.7, accuracy: 0.8, line: 'mangudai', uniqueTo: 'mongols',
  desc: 'Elite Mongol horse archer.',
});

// ------------------------------------------------------------------ Animals (Gaia)
def('deer', {
  name: 'Deer', hp: 5, speed: 1.1, los: 5, radius: 0.3, atk: {}, tags: ['animal', 'huntable'], food: 140, flees: false, fleeSpeed: 1.8,
  cost: {}, desc: 'Wild deer. Hunt them for food.',
});
def('boar', {
  name: 'Wild Boar', hp: 25, speed: 1.2, los: 5, radius: 0.35, atk: { melee: 8 }, reload: 2, tags: ['animal', 'huntable', 'dangerous'], food: 340,
  fights: true, cost: {}, desc: 'Dangerous when provoked. Rich source of food.',
});
def('sheep', {
  name: 'Sheep', hp: 7, speed: 0, los: 2, radius: 0.3, atk: {}, tags: ['animal', 'huntable', 'livestock'], food: 100, domestic: true,
  cost: {}, desc: 'Livestock. Herd them near your Town Center for food.',
});
def('wolf', {
  name: 'Wolf', hp: 25, speed: 1.4, los: 6, radius: 0.32, atk: { melee: 6 }, reload: 1.5, tags: ['animal', 'dangerous'], food: 0,
  hostile: true, cost: {}, desc: 'A wild wolf that attacks anyone who strays too close.',
});

// ------------------------------------------------------------------ Lines (upgrade chains)
export const LINES = {
  villager: ['villager'],
  swordsman: ['militia', 'man_at_arms', 'long_swordsman', 'two_handed', 'champion'],
  spearman: ['spearman', 'pikeman', 'halberdier'],
  skirmisher: ['skirmisher', 'elite_skirmisher'],
  archer: ['archer', 'crossbowman', 'arbalester'],
  cavarcher: ['cavalry_archer', 'heavy_cav_archer'],
  scout: ['scout', 'light_cavalry', 'hussar'],
  knight: ['knight', 'cavalier', 'paladin'],
  camel: ['camel', 'heavy_camel'],
  ram: ['ram', 'capped_ram', 'siege_ram'],
  mangonel: ['mangonel', 'onager', 'siege_onager'],
  scorpion: ['scorpion', 'heavy_scorpion'],
  trebuchet: ['trebuchet'],
  monk: ['monk'],
  longbow: ['longbowman', 'elite_longbowman'],
  axeman: ['throwing_axeman', 'elite_throwing_axeman'],
  huskarl: ['huskarl', 'elite_huskarl'],
  mangudai: ['mangudai', 'elite_mangudai'],
};

// Map every unit id to its line's base id (what buildings list as producible)
export const LINE_BASE = {};
for (const [line, ids] of Object.entries(LINES)) for (const id of ids) LINE_BASE[id] = ids[0];
