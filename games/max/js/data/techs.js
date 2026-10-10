// Technology catalog.
//
// Effect shapes (applied to a player's modifiers when the tech completes):
//   { t:'stat',   sel:[...], stat:'atk.melee', add:1 }       selectors: tag names ('infantry','building'...) or '#unitId'.
//                                        stat is a path into the unit/building def ('hp','speed','range','armor.pierce','attack.dmg'...)
//                                        'add' on atk.* / armor.* only applies if the def already has that key.
//   { t:'stat',   sel:[...], stat:'hp', mul:1.1 }
//   { t:'gather', sub:'wood'|'farm'|'berries'|'hunt'|'sheep'|'gold'|'stone', add:0.2 }   additive % of base rate
//   { t:'cost',   sel:[...], res:'wood'|null, mul:0.85 }     cost multiplier for units/buildings
//   { t:'train',  sel:[building ids/tags], mul:1.2 }         production speed multiplier of those buildings
//   { t:'build',  mul:1.2 }                                  villager construction speed
//   { t:'upgrade', to:'man_at_arms' }                        unit line upgrade (existing + future units)
//   { t:'bupgrade', from:'watch_tower', to:'guard_tower' }   building line upgrade
//   { t:'flag', name:'convertSiege' }
//   { t:'fee', add:-0.1 }                                    market trade fee
//   { t:'addProduces', building:'barracks', line:'huskarl' }
// Icon strings: 'glyph:<name>[:accent]' | 'unit:<id>' | 'age:<n>' | 'civ:<id>'

import { UNITS } from './units.js';

export const TECHS = {};

function tech(id, o) {
  TECHS[id] = Object.assign({ id, cost: {}, time: 30, ageReq: 0, effects: [], requires: [], icon: 'glyph:gear' }, o);
  return TECHS[id];
}
const stat = (sel, st, o) => Object.assign({ t: 'stat', sel, stat: st }, o);

// ------------------------------------------------------------------ Ages (Town Center)
tech('feudal_age', {
  name: 'Advance to Feudal Age', building: 'town_center', cost: { food: 500 }, time: 130, age: 1, ageReq: 0, icon: 'age:1',
  desc: 'Unlocks Archery Range, Stable, Blacksmith, Market and Watch Towers. Requires 2 different Dark Age buildings.',
});
tech('castle_age', {
  name: 'Advance to Castle Age', building: 'town_center', cost: { food: 800, gold: 200 }, time: 160, age: 2, ageReq: 1, icon: 'age:2',
  desc: 'Unlocks Castles, Universities, Monasteries, Siege Workshops and knights. Requires 2 different Feudal Age buildings.',
});
tech('imperial_age', {
  name: 'Advance to Imperial Age', building: 'town_center', cost: { food: 1000, gold: 800 }, time: 190, age: 3, ageReq: 2, icon: 'age:3',
  desc: 'Unlocks the finest upgrades and the Wonder. Requires a Castle or University plus one more Castle Age building.',
});

// ------------------------------------------------------------------ Town Center
tech('loom', {
  name: 'Loom', building: 'town_center', cost: { gold: 50 }, time: 25, ageReq: 0, icon: 'glyph:cloth',
  effects: [stat(['villager'], 'hp', { add: 15 }), stat(['villager'], 'armor.melee', { add: 1 }), stat(['villager'], 'armor.pierce', { add: 1 })],
  desc: 'Villagers get +15 HP and +1/+1 armor.',
});
tech('wheelbarrow', {
  name: 'Wheelbarrow', building: 'town_center', cost: { food: 175, wood: 50 }, time: 75, ageReq: 1, icon: 'glyph:wheelbarrow',
  effects: [stat(['villager'], 'speed', { mul: 1.1 }), stat(['villager'], 'carry', { add: 3 })],
  desc: 'Villagers move 10% faster and carry 3 more resources.',
});
tech('hand_cart', {
  name: 'Hand Cart', building: 'town_center', cost: { food: 300, wood: 200 }, time: 55, ageReq: 2, requires: ['wheelbarrow'], icon: 'glyph:cart',
  effects: [stat(['villager'], 'speed', { mul: 1.1 }), stat(['villager'], 'carry', { add: 4 })],
  desc: 'Villagers move 10% faster and carry 4 more resources.',
});
tech('town_watch', {
  name: 'Town Watch', building: 'town_center', cost: { food: 75 }, time: 25, ageReq: 1, icon: 'glyph:eye',
  effects: [stat(['building'], 'los', { add: 4 })],
  desc: 'Buildings see 4 tiles further.',
});
tech('town_patrol', {
  name: 'Town Patrol', building: 'town_center', cost: { food: 300, gold: 200 }, time: 40, ageReq: 2, requires: ['town_watch'], icon: 'glyph:eye:gold',
  effects: [stat(['building'], 'los', { add: 4 })],
  desc: 'Buildings see 4 tiles further still.',
});

// ------------------------------------------------------------------ Mill
tech('horse_collar', {
  name: 'Horse Collar', building: 'mill', cost: { food: 75, wood: 75 }, time: 20, ageReq: 1, icon: 'glyph:collar',
  effects: [{ t: 'gather', sub: 'farm', add: 0.2 }], desc: 'Farmers gather 20% faster.',
});
tech('heavy_plow', {
  name: 'Heavy Plow', building: 'mill', cost: { food: 125, wood: 125 }, time: 40, ageReq: 2, requires: ['horse_collar'], icon: 'glyph:plow',
  effects: [{ t: 'gather', sub: 'farm', add: 0.2 }], desc: 'Farmers gather another 20% faster.',
});
tech('crop_rotation', {
  name: 'Crop Rotation', building: 'mill', cost: { food: 250, wood: 250 }, time: 60, ageReq: 3, requires: ['heavy_plow'], icon: 'glyph:crop',
  effects: [{ t: 'gather', sub: 'farm', add: 0.2 }], desc: 'Farmers gather another 20% faster.',
});

// ------------------------------------------------------------------ Lumber Camp
tech('double_bit_axe', {
  name: 'Double-Bit Axe', building: 'lumber_camp', cost: { food: 100, wood: 50 }, time: 25, ageReq: 1, icon: 'glyph:axe',
  effects: [{ t: 'gather', sub: 'wood', add: 0.2 }], desc: 'Woodcutters gather 20% faster.',
});
tech('bow_saw', {
  name: 'Bow Saw', building: 'lumber_camp', cost: { food: 150, wood: 100 }, time: 35, ageReq: 2, requires: ['double_bit_axe'], icon: 'glyph:saw',
  effects: [{ t: 'gather', sub: 'wood', add: 0.2 }], desc: 'Woodcutters gather another 20% faster.',
});
tech('two_man_saw', {
  name: 'Two-Man Saw', building: 'lumber_camp', cost: { food: 300, wood: 200 }, time: 50, ageReq: 3, requires: ['bow_saw'], icon: 'glyph:saw:gold',
  effects: [{ t: 'gather', sub: 'wood', add: 0.2 }], desc: 'Woodcutters gather another 20% faster.',
});

// ------------------------------------------------------------------ Mining Camp
tech('gold_mining', {
  name: 'Gold Mining', building: 'mining_camp', cost: { food: 100, wood: 75 }, time: 30, ageReq: 1, icon: 'glyph:pickaxe:gold',
  effects: [{ t: 'gather', sub: 'gold', add: 0.15 }], desc: 'Gold miners work 15% faster.',
});
tech('gold_shaft_mining', {
  name: 'Gold Shaft Mining', building: 'mining_camp', cost: { food: 200, wood: 150 }, time: 75, ageReq: 2, requires: ['gold_mining'], icon: 'glyph:pickaxe:gold',
  effects: [{ t: 'gather', sub: 'gold', add: 0.15 }], desc: 'Gold miners work another 15% faster.',
});
tech('stone_mining', {
  name: 'Stone Mining', building: 'mining_camp', cost: { food: 100, wood: 75 }, time: 30, ageReq: 1, icon: 'glyph:pickaxe:stone',
  effects: [{ t: 'gather', sub: 'stone', add: 0.15 }], desc: 'Stone miners work 15% faster.',
});
tech('stone_shaft_mining', {
  name: 'Stone Shaft Mining', building: 'mining_camp', cost: { food: 200, wood: 150 }, time: 75, ageReq: 2, requires: ['stone_mining'], icon: 'glyph:pickaxe:stone',
  effects: [{ t: 'gather', sub: 'stone', add: 0.15 }], desc: 'Stone miners work another 15% faster.',
});

// ------------------------------------------------------------------ Blacksmith: attack
tech('forging', {
  name: 'Forging', building: 'blacksmith', cost: { food: 150 }, time: 50, ageReq: 1, icon: 'glyph:sword', tier: 1,
  effects: [stat(['infantry', 'cavalry'], 'atk.melee', { add: 1 })], desc: 'Infantry and cavalry deal +1 melee damage.',
});
tech('iron_casting', {
  name: 'Iron Casting', building: 'blacksmith', cost: { food: 220, gold: 120 }, time: 55, ageReq: 2, requires: ['forging'], icon: 'glyph:sword', tier: 2,
  effects: [stat(['infantry', 'cavalry'], 'atk.melee', { add: 1 })], desc: 'Infantry and cavalry deal +1 melee damage.',
});
tech('blast_furnace', {
  name: 'Blast Furnace', building: 'blacksmith', cost: { food: 275, gold: 225 }, time: 75, ageReq: 3, requires: ['iron_casting'], icon: 'glyph:sword', tier: 3,
  effects: [stat(['infantry', 'cavalry'], 'atk.melee', { add: 2 })], desc: 'Infantry and cavalry deal +2 melee damage.',
});
// armor
tech('scale_mail', {
  name: 'Scale Mail Armor', building: 'blacksmith', cost: { food: 100 }, time: 40, ageReq: 1, icon: 'glyph:shield', tier: 1,
  effects: [stat(['infantry'], 'armor.melee', { add: 1 }), stat(['infantry'], 'armor.pierce', { add: 1 })], desc: 'Infantry gain +1 melee and +1 pierce armor.',
});
tech('chain_mail', {
  name: 'Chain Mail Armor', building: 'blacksmith', cost: { food: 150, gold: 100 }, time: 55, ageReq: 2, requires: ['scale_mail'], icon: 'glyph:shield', tier: 2,
  effects: [stat(['infantry'], 'armor.melee', { add: 1 }), stat(['infantry'], 'armor.pierce', { add: 1 })], desc: 'Infantry gain +1 melee and +1 pierce armor.',
});
tech('plate_mail', {
  name: 'Plate Mail Armor', building: 'blacksmith', cost: { food: 300, gold: 150 }, time: 75, ageReq: 3, requires: ['chain_mail'], icon: 'glyph:shield', tier: 3,
  effects: [stat(['infantry'], 'armor.melee', { add: 1 }), stat(['infantry'], 'armor.pierce', { add: 2 })], desc: 'Infantry gain +1 melee and +2 pierce armor.',
});
tech('scale_barding', {
  name: 'Scale Barding Armor', building: 'blacksmith', cost: { food: 150 }, time: 45, ageReq: 1, icon: 'glyph:barding', tier: 1,
  effects: [stat(['cavalry'], 'armor.melee', { add: 1 }), stat(['cavalry'], 'armor.pierce', { add: 1 })], desc: 'Cavalry gain +1 melee and +1 pierce armor.',
});
tech('chain_barding', {
  name: 'Chain Barding Armor', building: 'blacksmith', cost: { food: 175, gold: 100 }, time: 60, ageReq: 2, requires: ['scale_barding'], icon: 'glyph:barding', tier: 2,
  effects: [stat(['cavalry'], 'armor.melee', { add: 1 }), stat(['cavalry'], 'armor.pierce', { add: 1 })], desc: 'Cavalry gain +1 melee and +1 pierce armor.',
});
tech('plate_barding', {
  name: 'Plate Barding Armor', building: 'blacksmith', cost: { food: 250, gold: 150 }, time: 75, ageReq: 3, requires: ['chain_barding'], icon: 'glyph:barding', tier: 3,
  effects: [stat(['cavalry'], 'armor.melee', { add: 1 }), stat(['cavalry'], 'armor.pierce', { add: 2 })], desc: 'Cavalry gain +1 melee and +2 pierce armor.',
});
// archery
const archeryFx = () => [
  stat(['archer', 'skirmisher'], 'atk.pierce', { add: 1 }), stat(['archer'], 'range', { add: 1 }), stat(['defense'], 'attack.dmg', { add: 1 }),
];
tech('fletching', {
  name: 'Fletching', building: 'blacksmith', cost: { food: 100, gold: 50 }, time: 30, ageReq: 1, icon: 'glyph:bow', tier: 1,
  effects: archeryFx(), desc: 'Archers, skirmishers and defensive buildings deal +1 damage; archers gain +1 range.',
});
tech('bodkin_arrow', {
  name: 'Bodkin Arrow', building: 'blacksmith', cost: { food: 200, gold: 100 }, time: 35, ageReq: 2, requires: ['fletching'], icon: 'glyph:bow', tier: 2,
  effects: archeryFx(), desc: 'Another +1 damage and +1 range for archers.',
});
tech('bracer', {
  name: 'Bracer', building: 'blacksmith', cost: { food: 300, gold: 200 }, time: 40, ageReq: 3, requires: ['bodkin_arrow'], icon: 'glyph:bow', tier: 3,
  effects: archeryFx(), desc: 'Another +1 damage and +1 range for archers.',
});
tech('padded_archer_armor', {
  name: 'Padded Archer Armor', building: 'blacksmith', cost: { food: 100 }, time: 40, ageReq: 1, icon: 'glyph:archerarmor', tier: 1,
  effects: [stat(['archer', 'skirmisher'], 'armor.melee', { add: 1 }), stat(['archer', 'skirmisher'], 'armor.pierce', { add: 1 })], desc: 'Archers and skirmishers gain +1/+1 armor.',
});
tech('leather_archer_armor', {
  name: 'Leather Archer Armor', building: 'blacksmith', cost: { food: 150, gold: 100 }, time: 55, ageReq: 2, requires: ['padded_archer_armor'], icon: 'glyph:archerarmor', tier: 2,
  effects: [stat(['archer', 'skirmisher'], 'armor.melee', { add: 1 }), stat(['archer', 'skirmisher'], 'armor.pierce', { add: 1 })], desc: 'Archers and skirmishers gain +1/+1 armor.',
});
tech('ring_archer_armor', {
  name: 'Ring Archer Armor', building: 'blacksmith', cost: { food: 250, gold: 250 }, time: 70, ageReq: 3, requires: ['leather_archer_armor'], icon: 'glyph:archerarmor', tier: 3,
  effects: [stat(['archer', 'skirmisher'], 'armor.melee', { add: 1 }), stat(['archer', 'skirmisher'], 'armor.pierce', { add: 2 })], desc: 'Archers and skirmishers gain +1/+2 armor.',
});

// ------------------------------------------------------------------ Barracks / Range / Stable techs
tech('squires', {
  name: 'Squires', building: 'barracks', cost: { food: 200, gold: 100 }, time: 40, ageReq: 2, icon: 'glyph:boots',
  effects: [stat(['infantry'], 'speed', { mul: 1.1 })], desc: 'Infantry move 10% faster.',
});
tech('thumb_ring', {
  name: 'Thumb Ring', building: 'archery_range', cost: { food: 300, gold: 250 }, time: 50, ageReq: 2, icon: 'glyph:ring',
  effects: [stat(['archer'], 'reload', { mul: 0.85 }), stat(['archer'], 'accuracy', { add: 0.1 })], desc: 'Archers fire 15% faster and more accurately.',
});
tech('bloodlines', {
  name: 'Bloodlines', building: 'stable', cost: { food: 150, gold: 100 }, time: 50, ageReq: 1, icon: 'glyph:horse',
  effects: [stat(['cavalry'], 'hp', { add: 20 })], desc: 'Cavalry gain +20 HP.',
});
tech('husbandry', {
  name: 'Husbandry', building: 'stable', cost: { food: 150 }, time: 40, ageReq: 2, icon: 'glyph:horse:gold',
  effects: [stat(['cavalry'], 'speed', { mul: 1.1 })], desc: 'Cavalry move 10% faster.',
});

// ------------------------------------------------------------------ Unit upgrades
function upgrade(id, to, building, cost, time, requires = [], extra = {}) {
  tech(id, Object.assign({
    name: 'Upgrade to ' + UNITS[to].name, building, cost, time,
    icon: 'unit:' + to, requires, effects: [{ t: 'upgrade', to }], unitUpgrade: to,
  }, extra));
}
upgrade('man_at_arms', 'man_at_arms', 'barracks', { food: 100, gold: 40 }, 40, [], { ageReq: 1 });
upgrade('long_swordsman', 'long_swordsman', 'barracks', { food: 200, gold: 65 }, 45, ['man_at_arms'], { ageReq: 2 });
upgrade('two_handed', 'two_handed', 'barracks', { food: 300, gold: 100 }, 50, ['long_swordsman'], { ageReq: 3 });
upgrade('champion', 'champion', 'barracks', { food: 750, gold: 350 }, 100, ['two_handed'], { ageReq: 3 });
upgrade('pikeman', 'pikeman', 'barracks', { food: 215, gold: 90 }, 45, [], { ageReq: 2 });
upgrade('halberdier', 'halberdier', 'barracks', { food: 300, wood: 300 }, 50, ['pikeman'], { ageReq: 3 });
upgrade('crossbowman', 'crossbowman', 'archery_range', { food: 125, gold: 75 }, 35, [], { ageReq: 2 });
upgrade('arbalester', 'arbalester', 'archery_range', { food: 300, gold: 400 }, 50, ['crossbowman'], { ageReq: 3 });
upgrade('elite_skirmisher', 'elite_skirmisher', 'archery_range', { food: 230, gold: 130 }, 50, [], { ageReq: 2 });
upgrade('heavy_cav_archer', 'heavy_cav_archer', 'archery_range', { food: 900, gold: 500 }, 50, [], { ageReq: 3 });
upgrade('light_cavalry', 'light_cavalry', 'stable', { food: 150, gold: 50 }, 45, [], { ageReq: 2 });
upgrade('hussar', 'hussar', 'stable', { food: 300, gold: 300 }, 50, ['light_cavalry'], { ageReq: 3 });
upgrade('cavalier', 'cavalier', 'stable', { food: 300, gold: 300 }, 100, [], { ageReq: 3 });
upgrade('paladin', 'paladin', 'stable', { food: 1300, gold: 750 }, 100, ['cavalier'], { ageReq: 3 });
upgrade('heavy_camel', 'heavy_camel', 'stable', { food: 300, gold: 300 }, 50, [], { ageReq: 3 });
upgrade('capped_ram', 'capped_ram', 'siege_workshop', { wood: 300, gold: 150 }, 50, [], { ageReq: 2 });
upgrade('siege_ram', 'siege_ram', 'siege_workshop', { wood: 600, gold: 350 }, 60, ['capped_ram'], { ageReq: 3 });
upgrade('onager', 'onager', 'siege_workshop', { food: 400, gold: 250 }, 50, [], { ageReq: 2 });
upgrade('siege_onager', 'siege_onager', 'siege_workshop', { food: 600, gold: 400 }, 60, ['onager'], { ageReq: 3 });
upgrade('heavy_scorpion', 'heavy_scorpion', 'siege_workshop', { food: 500, wood: 300 }, 50, [], { ageReq: 3 });
upgrade('elite_longbowman', 'elite_longbowman', 'castle', { food: 800, gold: 450 }, 60, [], { ageReq: 3, uniqueTo: 'britons' });
upgrade('elite_throwing_axeman', 'elite_throwing_axeman', 'castle', { food: 800, gold: 450 }, 60, [], { ageReq: 3, uniqueTo: 'franks' });
upgrade('elite_huskarl', 'elite_huskarl', 'castle', { food: 800, gold: 450 }, 60, [], { ageReq: 3, uniqueTo: 'goths' });
upgrade('elite_mangudai', 'elite_mangudai', 'castle', { food: 800, gold: 450 }, 60, [], { ageReq: 3, uniqueTo: 'mongols' });

// ------------------------------------------------------------------ University
tech('masonry', {
  name: 'Masonry', building: 'university', cost: { food: 175, wood: 150 }, time: 50, ageReq: 2, icon: 'glyph:castle',
  effects: [stat(['building'], 'hp', { mul: 1.1 }), stat(['building'], 'armor.melee', { add: 1 }), stat(['building'], 'armor.pierce', { add: 1 })],
  desc: 'Buildings gain +10% HP and +1/+1 armor.',
});
tech('architecture', {
  name: 'Architecture', building: 'university', cost: { food: 200, wood: 300 }, time: 70, ageReq: 3, requires: ['masonry'], icon: 'glyph:castle:gold',
  effects: [stat(['building'], 'hp', { mul: 1.1 }), stat(['building'], 'armor.melee', { add: 1 }), stat(['building'], 'armor.pierce', { add: 1 })],
  desc: 'Buildings gain another +10% HP and +1/+1 armor.',
});
tech('ballistics', {
  name: 'Ballistics', building: 'university', cost: { food: 300, gold: 175 }, time: 50, ageReq: 2, icon: 'glyph:gear',
  effects: [stat(['ranged', 'defense'], 'accuracy', { add: 0.15 })], desc: 'Ranged units and towers are more accurate against moving targets.',
});
tech('treadmill_crane', {
  name: 'Treadmill Crane', building: 'university', cost: { food: 200, wood: 200 }, time: 50, ageReq: 2, icon: 'glyph:crane',
  effects: [{ t: 'build', mul: 1.2 }], desc: 'Villagers construct buildings 20% faster.',
});
tech('siege_engineers', {
  name: 'Siege Engineers', building: 'university', cost: { food: 300, wood: 200 }, time: 80, ageReq: 3, icon: 'glyph:gear:gold',
  effects: [stat(['#mangonel', '#onager', '#siege_onager', '#scorpion', '#heavy_scorpion', '#trebuchet'], 'range', { add: 1 }), stat(['ram'], 'atk.building', { mul: 1.2 })],
  desc: 'Siege engines gain +1 range; rams deal 20% more damage to buildings.',
});
tech('guard_tower', {
  name: 'Guard Tower', building: 'university', cost: { food: 100, wood: 100 }, time: 30, ageReq: 2, icon: 'glyph:tower',
  effects: [{ t: 'bupgrade', from: 'watch_tower', to: 'guard_tower' }], desc: 'Watch Towers become Guard Towers with more HP and stronger arrows.',
});
tech('keep', {
  name: 'Keep', building: 'university', cost: { food: 500, wood: 250 }, time: 40, ageReq: 3, requires: ['guard_tower'], icon: 'glyph:tower:gold',
  effects: [{ t: 'bupgrade', from: 'guard_tower', to: 'keep' }], desc: 'Guard Towers become Keeps.',
});
tech('fortified_wall', {
  name: 'Fortified Wall', building: 'university', cost: { food: 200, stone: 100 }, time: 50, ageReq: 2, icon: 'glyph:wall',
  effects: [stat(['wall'], 'hp', { mul: 1.5 }), stat(['wall'], 'armor.melee', { add: 2 }), stat(['wall'], 'armor.pierce', { add: 2 })],
  desc: 'Walls and gates gain +50% HP and +2/+2 armor.',
});

// ------------------------------------------------------------------ Monastery
tech('fervor', {
  name: 'Fervor', building: 'monastery', cost: { food: 140, gold: 100 }, time: 50, ageReq: 2, icon: 'glyph:cross',
  effects: [stat(['monk'], 'speed', { mul: 1.15 })], desc: 'Monks move 15% faster.',
});
tech('sanctity', {
  name: 'Sanctity', building: 'monastery', cost: { food: 120, gold: 100 }, time: 60, ageReq: 2, icon: 'glyph:cross:gold',
  effects: [stat(['monk'], 'hp', { add: 15 })], desc: 'Monks gain +15 HP.',
});
tech('illumination', {
  name: 'Illumination', building: 'monastery', cost: { food: 120, gold: 120 }, time: 50, ageReq: 2, icon: 'glyph:scroll',
  effects: [stat(['monk'], 'convert.rejuvenate', { mul: 0.7 })], desc: 'Monks recover their conversion ability 30% faster.',
});
tech('redemption', {
  name: 'Redemption', building: 'monastery', cost: { gold: 475 }, time: 50, ageReq: 2, icon: 'glyph:cross:blood',
  effects: [{ t: 'flag', name: 'convertSiege' }], desc: 'Monks can convert enemy siege weapons.',
});
tech('atonement', {
  name: 'Atonement', building: 'monastery', cost: { gold: 325 }, time: 40, ageReq: 2, icon: 'glyph:cross:blood',
  effects: [{ t: 'flag', name: 'convertMonk' }], desc: 'Monks can convert enemy monks.',
});
tech('block_printing', {
  name: 'Block Printing', building: 'monastery', cost: { gold: 200 }, time: 50, ageReq: 3, icon: 'glyph:book',
  effects: [stat(['monk'], 'range', { add: 3 }), stat(['monk'], 'convert.range', { add: 3 })], desc: 'Monks can convert from 3 tiles further away.',
});

// ------------------------------------------------------------------ Market
tech('coinage', {
  name: 'Coinage', building: 'market', cost: { food: 150, gold: 50 }, time: 50, ageReq: 2, icon: 'glyph:coin',
  effects: [{ t: 'fee', add: -0.1 }], desc: 'Market trade fee reduced by 10%.',
});
tech('banking', {
  name: 'Banking', building: 'market', cost: { food: 200, gold: 100 }, time: 50, ageReq: 3, requires: ['coinage'], icon: 'glyph:coin:gold',
  effects: [{ t: 'fee', add: -0.1 }], desc: 'Market trade fee reduced by another 10%.',
});

// ------------------------------------------------------------------ Castle
tech('conscription', {
  name: 'Conscription', building: 'castle', cost: { food: 150, gold: 150 }, time: 60, ageReq: 3, icon: 'glyph:banner',
  effects: [{ t: 'train', sel: ['barracks', 'archery_range', 'stable', 'siege_workshop'], mul: 1.33 }],
  desc: 'Military buildings train units 33% faster.',
});
tech('hoardings', {
  name: 'Hoardings', building: 'castle', cost: { wood: 400 }, time: 30, ageReq: 2, icon: 'glyph:castle:blood',
  effects: [stat(['#castle'], 'hp', { mul: 1.2 })], desc: 'Castles gain +20% HP.',
});

// Unique technologies (two per civilization)
tech('yeomen', {
  name: 'Yeomen', building: 'castle', cost: { food: 300, gold: 200 }, time: 50, ageReq: 2, uniqueTo: 'britons', icon: 'civ:britons',
  effects: [stat(['footarcher'], 'range', { add: 1 }), stat(['tower'], 'attack.dmg', { add: 2 })], desc: 'Foot archers gain +1 range; towers deal +2 damage.',
});
tech('warwolf', {
  name: 'Warwolf', building: 'castle', cost: { food: 600, gold: 400 }, time: 60, ageReq: 3, uniqueTo: 'britons', requires: ['yeomen'], icon: 'civ:britons',
  effects: [stat(['trebuchet'], 'splash', { add: 1.2 }), stat(['trebuchet'], 'accuracy', { add: 0.25 })], desc: 'Trebuchets are far more accurate and burst over a wider area.',
});
tech('chivalry', {
  name: 'Chivalry', building: 'castle', cost: { food: 300, gold: 200 }, time: 50, ageReq: 2, uniqueTo: 'franks', icon: 'civ:franks',
  effects: [{ t: 'train', sel: ['stable'], mul: 1.4 }], desc: 'Stables train units 40% faster.',
});
tech('bearded_axe', {
  name: 'Bearded Axe', building: 'castle', cost: { food: 600, gold: 400 }, time: 60, ageReq: 3, uniqueTo: 'franks', requires: ['chivalry'], icon: 'civ:franks',
  effects: [stat(['#throwing_axeman', '#elite_throwing_axeman'], 'range', { add: 1 }), stat(['#throwing_axeman', '#elite_throwing_axeman'], 'atk.pierce', { add: 1 })],
  desc: 'Throwing Axemen gain +1 range and +1 attack.',
});
tech('anarchy', {
  name: 'Anarchy', building: 'castle', cost: { food: 300, gold: 200 }, time: 50, ageReq: 2, uniqueTo: 'goths', icon: 'civ:goths',
  effects: [{ t: 'addProduces', building: 'barracks', line: 'huskarl' }], desc: 'Huskarls can also be trained at Barracks.',
});
tech('perfusion', {
  name: 'Perfusion', building: 'castle', cost: { food: 600, gold: 400 }, time: 60, ageReq: 3, uniqueTo: 'goths', requires: ['anarchy'], icon: 'civ:goths',
  effects: [{ t: 'train', sel: ['barracks'], mul: 2 }], desc: 'Barracks train units twice as fast.',
});
tech('silk_armor', {
  name: 'Silk Armor', building: 'castle', cost: { food: 300, gold: 200 }, time: 50, ageReq: 2, uniqueTo: 'mongols', icon: 'civ:mongols',
  effects: [stat(['scout'], 'armor.melee', { add: 1 }), stat(['scout'], 'armor.pierce', { add: 1 })], desc: 'Scout cavalry gain +1/+1 armor.',
});
tech('drill', {
  name: 'Drill', building: 'castle', cost: { food: 600, gold: 400 }, time: 60, ageReq: 3, uniqueTo: 'mongols', requires: ['silk_armor'], icon: 'civ:mongols',
  effects: [stat(['siege'], 'speed', { mul: 1.5 })], desc: 'Siege weapons move 50% faster.',
});
