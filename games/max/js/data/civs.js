// Civilizations. `effects` use the same shapes as techs; `age` = minimum age at which the bonus applies (0 = from the start).
// `uu` is the unit LINE id of the unique unit trained at the Castle.

export const CIVS = {
  britons: {
    id: 'britons', name: 'Britons', adj: 'British', uu: 'longbow', techs: ['yeomen', 'warwolf'],
    tagline: 'Masters of the longbow',
    blurb: 'A civilization of archers. Britons out-range their enemies and build cheap Town Centers to expand fast.',
    bonuses: [
      'Town Centers cost 50% less wood',
      'Shepherds work 25% faster',
      'Foot archers gain +1 range in the Castle Age and +1 in the Imperial Age',
      'Archery Ranges work 20% faster',
    ],
    effects: [
      { age: 0, t: 'cost', sel: ['#town_center'], res: 'wood', mul: 0.5 },
      { age: 0, t: 'gather', sub: 'sheep', add: 0.25 },
      { age: 2, t: 'stat', sel: ['footarcher'], stat: 'range', add: 1 },
      { age: 3, t: 'stat', sel: ['footarcher'], stat: 'range', add: 1 },
      { age: 0, t: 'train', sel: ['archery_range'], mul: 1.2 },
    ],
    ai: { army: [['archer', 5], ['spearman', 2], ['knight', 2], ['skirmisher', 1]], siege: ['mangonel', 'trebuchet'], style: 'ranged' },
  },
  franks: {
    id: 'franks', name: 'Franks', adj: 'Frankish', uu: 'axeman', techs: ['chivalry', 'bearded_axe'],
    tagline: 'Lords of the charging knight',
    blurb: 'Heavy cavalry masters. Frankish knights are tougher than any other, and their castles are cheap.',
    bonuses: [
      'Castles cost 15% less',
      'Knights have +20% hit points',
      'Foragers work 15% faster',
      'Cavalry gain +1 pierce armor in the Castle Age',
    ],
    effects: [
      { age: 0, t: 'cost', sel: ['#castle'], res: null, mul: 0.85 },
      { age: 0, t: 'stat', sel: ['knight'], stat: 'hp', mul: 1.2 },
      { age: 0, t: 'gather', sub: 'berries', add: 0.15 },
      { age: 2, t: 'stat', sel: ['cavalry'], stat: 'armor.pierce', add: 1 },
    ],
    ai: { army: [['knight', 6], ['axeman', 3], ['spearman', 2], ['archer', 1]], siege: ['ram', 'mangonel'], style: 'cavalry' },
  },
  goths: {
    id: 'goths', name: 'Goths', adj: 'Gothic', uu: 'huskarl', techs: ['anarchy', 'perfusion'],
    tagline: 'A tide of infantry',
    blurb: 'Cheap, relentless infantry swarms. Goths field armies early and grind enemies down with sheer numbers.',
    bonuses: [
      'Infantry cost 25% less from the Feudal Age',
      'Barracks work 20% faster',
      'Infantry gain +1 attack against buildings',
      'Hunters gather 20% faster',
    ],
    effects: [
      { age: 1, t: 'cost', sel: ['infantry'], res: null, mul: 0.75 },
      { age: 0, t: 'train', sel: ['barracks'], mul: 1.2 },
      { age: 0, t: 'stat', sel: ['infantry'], stat: 'atk.building', add: 1, create: true },
      { age: 0, t: 'gather', sub: 'hunt', add: 0.2 },
    ],
    ai: { army: [['swordsman', 6], ['spearman', 3], ['huskarl', 3], ['archer', 2]], siege: ['ram', 'mangonel'], style: 'infantry' },
  },
  mongols: {
    id: 'mongols', name: 'Mongols', adj: 'Mongol', uu: 'mangudai', techs: ['silk_armor', 'drill'],
    tagline: 'Thunder of the steppe',
    blurb: 'Mobile horse archers and fearsome hunters. Mongols thrive on speed, raiding and harassment.',
    bonuses: [
      'Hunters work 40% faster',
      'Cavalry archers fire 20% faster',
      'Light Cavalry and Hussars have +30% hit points',
      'Scout Cavalry line of sight is +2',
    ],
    effects: [
      { age: 0, t: 'gather', sub: 'hunt', add: 0.4 },
      { age: 0, t: 'stat', sel: ['cavarcher'], stat: 'reload', mul: 0.8 },
      { age: 0, t: 'stat', sel: ['#light_cavalry', '#hussar'], stat: 'hp', mul: 1.3 },
      { age: 0, t: 'stat', sel: ['scout'], stat: 'los', add: 2 },
    ],
    ai: { army: [['cavarcher', 6], ['scout', 3], ['spearman', 2], ['monk', 1]], siege: ['mangonel', 'ram'], style: 'cavalry-archer' },
  },
};

export const CIV_ORDER = ['britons', 'franks', 'goths', 'mongols'];
