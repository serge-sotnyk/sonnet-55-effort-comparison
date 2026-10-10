// Building catalog. size = footprint in tiles (square). Armor/HP follow AoE2 DE ballpark values.
// `produces` lists unit LINE BASE ids (the actual unit is the player's current tier of that line).

export const BUILDINGS = {};

function def(id, o) {
  BUILDINGS[id] = Object.assign({
    id, kind: 'building', size: 2, hp: 1000, armor: { melee: 0, pierce: 7 }, cost: {}, time: 40, ageReq: 0, los: 6,
    tags: [], dropoff: [], pop: 0, garrison: 0, produces: [], attack: null, flat: false, wall: false,
  }, o);
  BUILDINGS[id].tags = ['building', ...(o.tags || [])];
  return BUILDINGS[id];
}

// ------------------------------------------------------------------ Dark Age
def('town_center', {
  name: 'Town Center', size: 4, hp: 2400, armor: { melee: 3, pierce: 5 }, cost: { wood: 275, stone: 100 }, time: 150, ageReq: 0, los: 9,
  tags: ['economic', 'defense', 'dropoff'], dropoff: ['food', 'wood', 'gold', 'stone'], pop: 5, garrison: 15,
  produces: ['villager'], attack: { dmg: 5, range: 6, reload: 2, arrows: 1, maxArrows: 15 },
  desc: 'The heart of your settlement. Trains villagers, drops off all resources, researches ages and shoots arrows at nearby enemies.',
});
def('house', {
  name: 'House', size: 2, hp: 550, armor: { melee: 0, pierce: 7 }, cost: { wood: 25 }, time: 25, ageReq: 0, los: 3,
  tags: ['economic'], pop: 5,
  desc: 'Provides housing for 5 population.',
});
def('mill', {
  name: 'Mill', size: 2, hp: 600, cost: { wood: 100 }, time: 35, ageReq: 0, los: 5, tags: ['economic', 'dropoff'], dropoff: ['food'],
  desc: 'Drop-off point for food. Enables farms and farming upgrades.',
});
def('lumber_camp', {
  name: 'Lumber Camp', size: 2, hp: 600, cost: { wood: 100 }, time: 35, ageReq: 0, los: 5, tags: ['economic', 'dropoff'], dropoff: ['wood'],
  desc: 'Drop-off point for wood. Place it next to forests. Researches woodcutting upgrades.',
});
def('mining_camp', {
  name: 'Mining Camp', size: 2, hp: 600, cost: { wood: 100 }, time: 35, ageReq: 0, los: 5, tags: ['economic', 'dropoff'], dropoff: ['gold', 'stone'],
  desc: 'Drop-off point for gold and stone. Place it next to mines. Researches mining upgrades.',
});
def('farm', {
  name: 'Farm', size: 3, hp: 480, armor: { melee: 0, pierce: 0 }, cost: { wood: 60 }, time: 15, ageReq: 0, los: 2, flat: true, tags: ['economic', 'farm'],
  desc: 'Produces an endless stream of food while worked by a villager. Requires a Mill.', needs: ['mill'],
});
def('barracks', {
  name: 'Barracks', size: 3, hp: 1200, cost: { wood: 175 }, time: 50, ageReq: 0, los: 6, tags: ['military', 'production'],
  produces: ['swordsman', 'spearman'],
  desc: 'Trains infantry: militia and spearmen.',
});
def('outpost', {
  name: 'Outpost', size: 1, hp: 500, armor: { melee: 0, pierce: 7 }, cost: { wood: 25, stone: 10 }, time: 20, ageReq: 0, los: 11, tags: ['defense', 'outpost'],
  desc: 'A lookout post with a very long line of sight. Cannot attack.',
});
def('palisade', {
  name: 'Palisade Wall', size: 1, hp: 250, armor: { melee: 1, pierce: 5 }, cost: { wood: 3 }, time: 6, ageReq: 0, los: 1, wall: true, tags: ['wall', 'palisade'],
  desc: 'A cheap wooden wall. Drag to build a long line. Blocks enemy movement.',
});

// ------------------------------------------------------------------ Feudal Age
def('archery_range', {
  name: 'Archery Range', size: 3, hp: 1200, cost: { wood: 175 }, time: 50, ageReq: 1, los: 6, tags: ['military', 'production'],
  produces: ['archer', 'skirmisher', 'cavarcher'],
  desc: 'Trains archers, skirmishers and cavalry archers.',
});
def('stable', {
  name: 'Stable', size: 3, hp: 1200, cost: { wood: 175 }, time: 50, ageReq: 1, los: 6, tags: ['military', 'production'],
  produces: ['scout', 'knight', 'camel'],
  desc: 'Trains cavalry: scouts, knights and camel riders.',
});
def('blacksmith', {
  name: 'Blacksmith', size: 3, hp: 1200, cost: { wood: 150 }, time: 40, ageReq: 1, los: 6, tags: ['military'],
  desc: 'Researches weapon and armor upgrades for infantry, archers and cavalry.',
});
def('market', {
  name: 'Market', size: 3, hp: 1800, cost: { wood: 175 }, time: 60, ageReq: 1, los: 6, tags: ['economic'], market: true,
  desc: 'Buy and sell resources. Prices shift as you trade.',
});
def('watch_tower', {
  name: 'Watch Tower', size: 1, hp: 700, armor: { melee: 0, pierce: 7 }, cost: { wood: 50, stone: 100 }, time: 80, ageReq: 1, los: 8,
  tags: ['defense', 'tower'], garrison: 5, attack: { dmg: 5, range: 8, reload: 2, arrows: 1, maxArrows: 5 }, line: 'tower',
  desc: 'Shoots arrows at nearby enemies. Garrison soldiers inside to fire more arrows.',
});
def('stone_wall', {
  name: 'Stone Wall', size: 1, hp: 1800, armor: { melee: 8, pierce: 10 }, cost: { stone: 5 }, time: 12, ageReq: 1, los: 1, wall: true, tags: ['wall', 'stonewall'],
  desc: 'A sturdy stone wall. Drag to build a long line. Only siege can bring it down quickly.',
});
def('gate', {
  name: 'Gate', size: 1, hp: 1800, armor: { melee: 6, pierce: 10 }, cost: { stone: 30 }, time: 40, ageReq: 1, los: 2, wall: true, gate: true, tags: ['wall', 'gate'],
  desc: 'Place on a wall line. Your units pass freely; enemies are blocked.',
});

// ------------------------------------------------------------------ Castle Age
def('siege_workshop', {
  name: 'Siege Workshop', size: 3, hp: 1200, cost: { wood: 200 }, time: 60, ageReq: 2, los: 6, tags: ['military', 'production'],
  produces: ['ram', 'mangonel', 'scorpion'],
  desc: 'Builds battering rams, mangonels and scorpions.',
});
def('monastery', {
  name: 'Monastery', size: 3, hp: 2100, cost: { stone: 175 }, time: 40, ageReq: 2, los: 8, tags: ['military', 'production'], garrison: 5,
  produces: ['monk'],
  desc: 'Trains monks and researches religious upgrades.',
});
def('university', {
  name: 'University', size: 3, hp: 2100, cost: { wood: 200 }, time: 60, ageReq: 2, los: 6, tags: ['economic', 'military'],
  desc: 'Researches fortification, siege and building upgrades.',
});
def('castle', {
  name: 'Castle', size: 4, hp: 4800, armor: { melee: 8, pierce: 10 }, cost: { stone: 650 }, time: 200, ageReq: 2, los: 11,
  tags: ['military', 'production', 'defense'], garrison: 20, pop: 20, produces: ['trebuchet', 'unique'],
  attack: { dmg: 11, range: 8, reload: 2, arrows: 1, maxArrows: 20 },
  desc: 'A mighty fortress. Trains the unique unit of your civilization and trebuchets. Fires many arrows.',
});
def('guard_tower', {
  name: 'Guard Tower', size: 1, hp: 1000, armor: { melee: 0, pierce: 8 }, cost: { wood: 50, stone: 100 }, time: 80, ageReq: 2, los: 8,
  tags: ['defense', 'tower'], garrison: 5, attack: { dmg: 6, range: 8, reload: 2, arrows: 1, maxArrows: 5 }, line: 'tower', hidden: true,
  desc: 'Upgraded tower with stronger arrows.',
});
def('keep', {
  name: 'Keep', size: 1, hp: 1500, armor: { melee: 0, pierce: 9 }, cost: { wood: 50, stone: 100 }, time: 80, ageReq: 3, los: 9,
  tags: ['defense', 'tower'], garrison: 5, attack: { dmg: 7, range: 8, reload: 2, arrows: 1, maxArrows: 5 }, line: 'tower', hidden: true,
  desc: 'The strongest tower: more health, stronger arrows.',
});

// ------------------------------------------------------------------ Imperial Age
def('wonder', {
  name: 'Wonder', size: 5, hp: 4800, armor: { melee: 3, pierce: 10 }, cost: { wood: 1000, stone: 1000, gold: 1000 }, time: 600, ageReq: 3, los: 8,
  tags: ['wonder'],
  desc: 'A monument to your civilization. Hold it long enough and you win the game.',
});

// ------------------------------------------------------------------ Tower tier chain (player upgrades convert existing towers)
export const TOWER_TIERS = ['watch_tower', 'guard_tower', 'keep'];

// Wall segment ids that are drag-built
export const WALL_IDS = ['palisade', 'stone_wall'];
