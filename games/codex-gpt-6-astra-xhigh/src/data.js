export const MAP_SIZE = 44;
export const TILE_W = 76, TILE_H = 38;
export const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];
export const ROMAN = ['I','II','III','IV'];
export const AGE_COSTS = [{food:400,gold:100},{food:650,gold:250},{food:950,gold:500}];
export const AGE_TIMES = [40,55,65];
export const RESOURCE_NAMES = {food:'Food',wood:'Wood',gold:'Gold',stone:'Stone'};
export const UNITS = {
  villager:{name:'Villager',category:'Worker',cost:{food:50},hp:45,attack:3,armor:0,range:1.05,speed:2.0,time:12,age:0,icon:'villager',description:'The foundation of an empire. Gathers resources, constructs buildings, and repairs your settlement.'},
  militia:{name:'Militia',category:'Infantry',cost:{food:55,gold:15},hp:80,attack:10,armor:1,range:1.15,speed:1.85,time:15,age:0,icon:'sword',description:'Reliable close-combat infantry. A cost-effective way to defend your settlement and raid a rival.'},
  archer:{name:'Archer',category:'Ranged',cost:{wood:35,gold:30},hp:50,attack:8,armor:0,range:5.4,speed:1.9,time:17,age:1,icon:'bow',description:'Ranged troops that strike from a distance. Keep them behind infantry and away from cavalry.'},
  scout:{name:'Scout cavalry',category:'Cavalry',cost:{food:80},hp:90,attack:8,armor:1,range:1.25,speed:3.3,time:20,age:1,icon:'horse',description:'Fast cavalry with excellent vision. Explore the Riverlands and find the rival settlement.'},
  knight:{name:'Knight',category:'Heavy cavalry',cost:{food:65,gold:65},hp:155,attack:18,armor:3,range:1.35,speed:2.7,time:24,age:2,icon:'horse',description:'Powerful mounted warriors. High health and armor make them the backbone of a late-age army.'},
  trebuchet:{name:'Trebuchet',category:'Siege',cost:{wood:200,gold:150},hp:180,attack:85,armor:2,range:10.5,speed:.8,time:38,age:3,icon:'trebuchet',description:'Imperial siege artillery. Hurls stones at buildings from extreme range. Keep cavalry away from its vulnerable crew.'},
  ram:{name:'Battering ram',category:'Siege',cost:{wood:140,gold:80},hp:300,attack:45,armor:7,range:1.65,speed:1.05,time:30,age:2,icon:'ram',description:'A slow, armored siege engine. Devastates buildings but needs an escort against enemy soldiers.'}
};
export const BUILDINGS = {
  towncenter:{name:'Town Center',category:'Economy',cost:{wood:300,stone:150},hp:2400,size:3,time:65,age:2,pop:10,sight:10,icon:'towncenter',units:['villager'],description:'The heart of your kingdom. Trains villagers, receives resources, and advances your civilization.'},
  house:{name:'House',category:'Economy',cost:{wood:50},hp:500,size:2,time:12,age:0,pop:5,sight:5,icon:'house',description:'Provides room for 5 more people. Build houses before your population reaches its limit.'},
  farm:{name:'Farm',category:'Economy',cost:{wood:60},hp:300,size:2,time:10,age:0,sight:4,icon:'farm',description:'A renewable source of food. Its builder starts farming automatically. One villager per farm.'},
  lumbercamp:{name:'Lumber Camp',category:'Economy',cost:{wood:75},hp:550,size:2,time:15,age:0,sight:5,icon:'wood',description:'A nearby drop-off point for wood. Build beside a forest to shorten your villagers’ trips.'},
  mill:{name:'Mill',category:'Economy',cost:{wood:75},hp:600,size:2,time:15,age:0,sight:5,icon:'mill',description:'A food drop-off point. Place near berry bushes and farms for a more productive economy.'},
  miningcamp:{name:'Mining Camp',category:'Economy',cost:{wood:75},hp:550,size:2,time:15,age:0,sight:5,icon:'pickaxe',description:'A drop-off point for gold and stone. Save travel time by placing it close to a deposit.'},
  barracks:{name:'Barracks',category:'Military',cost:{wood:140},hp:1100,size:3,time:25,age:0,sight:6,icon:'barracks',units:['militia'],description:'Trains infantry to protect your people and take the battle to your rival.'},
  range:{name:'Archery Range',category:'Military',cost:{wood:150},hp:950,size:3,time:25,age:1,sight:6,icon:'bow',units:['archer'],description:'Trains archers. A mixed army of ranged and melee troops is stronger than either alone.'},
  stable:{name:'Stable',category:'Military',cost:{wood:170},hp:1100,size:3,time:28,age:1,sight:6,icon:'horse',units:['scout','knight'],description:'Trains fast scouts and powerful knights. Cavalry are excellent for raids and flanking.'},
  blacksmith:{name:'Blacksmith',category:'Military',cost:{wood:150},hp:1000,size:2,time:25,age:1,sight:5,icon:'anvil',description:'Research Forged Steel and Scale Armor to strengthen every military unit in your kingdom.'},
  workshop:{name:'Siege Workshop',category:'Military',cost:{wood:180},hp:1100,size:3,time:30,age:2,sight:6,icon:'ram',units:['ram','trebuchet'],description:'Constructs battering rams and Imperial Age trebuchets to break fortified enemy buildings.'},
  market:{name:'Market',category:'Economy',cost:{wood:160},hp:1000,size:3,time:25,age:1,sight:6,icon:'market',description:'Trade surplus resources for gold, or spend gold to buy the resources you need.'},
  tower:{name:'Watch Tower',category:'Defense',cost:{wood:50,stone:150},hp:1100,size:1,time:30,age:1,sight:10,attack:17,range:7.5,icon:'tower',description:'A defensive tower that automatically fires arrows at nearby enemies.'},
  castle:{name:'Castle',category:'Defense',cost:{wood:200,stone:400},hp:3600,size:4,time:65,age:2,sight:11,attack:30,range:8.5,pop:10,icon:'castle',units:['knight'],description:'A mighty fortress that controls the surrounding land. Fires powerful volleys and trains knights.'}
};
export const TECHS = {
  wheelbarrow:{name:'Wheelbarrow',cost:{food:120,wood:60},time:28,age:1,icon:'wheel',description:'Villagers gather 25% faster and carry 5 additional resources.'},
  attack:{name:'Forged Steel',cost:{food:120,gold:100},time:30,age:1,icon:'sword',description:'All current and future military units gain +3 attack.'},
  armor:{name:'Scale Armor',cost:{food:100,gold:100},time:30,age:1,icon:'shield',description:'All current and future military units gain +2 armor.'}
};
export const ICON_PATHS = {
  crown:'<path d="m3 7 5 4 4-7 4 7 5-4-2 12H5L3 7Z"/><path d="M6 16h12M7 21h10"/>',
  wood:'<path d="m12 2 6 8h-3l5 6h-6v6h-4v-6H4l5-6H6l6-8Z"/>',
  food:'<path d="M12 22V6m0 5C6 11 5 7 5 5c5 0 7 3 7 6Zm0 6c-6 0-7-4-7-6 5 0 7 3 7 6Zm0-8c6 0 7-4 7-6-5 0-7 3-7 6Zm0 6c6 0 7-4 7-6-5 0-7 3-7 6Z"/>',
  gold:'<path d="m7 6 6-3 7 5 2 10-7 3-12-4L7 6Z"/><path d="m7 6 8 4 5-2m-5 2v11M3 17l12-7"/>',
  stone:'<path d="m3 17 3-9 7-5 7 6 2 10-12 3-7-5Z"/><path d="m6 8 7 5 7-4m-7 4-3 9"/>',
  population:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v3"/>',
  villager:'<circle cx="12" cy="6" r="3"/><path d="M5 21v-4a7 7 0 0 1 14 0v4M7 12l5 5 5-5M12 17v5"/>',
  sword:'<path d="m7 16 13-13 1 5L10 19M4 13l7 7M3 22l5-5M2 20l2 2"/>',
  crossed:'<path d="M4 3v5l13 13 4-4L8 4 4 3Zm16 0v5l-5 5M9 15l-6 6m12-6 6 6M2 16l6 6m8-20 5 6"/>',
  house:'<path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h5v7M16 6V3h3v5"/>',
  towncenter:'<path d="M3 21V8l4-5 4 5v13M13 21V8l4-5 4 5v13M1 21h22M9 13h6M6 12h2m8 0h2M6 16h2m8 0h2M7 3V1m10 2V1"/>',
  farm:'<path d="m2 14 10-6 10 6-10 7-10-7Zm5 3 10-6M12 8V2m0 5L8 3m4 2 4-3M11 19l10-7"/>',
  mill:'<path d="M8 21 9 11h6l1 10H8Zm4-10V2m0 9L3 7m9 4 9-4m-9 4-6 6m6-6 6 6"/>',
  pickaxe:'<path d="m5 21 12-15M5 4c7-3 13 1 16 8L12 7 5 4Z"/>',
  barracks:'<path d="m2 12 10-9 10 9H2Zm3 0v9h14v-9M9 21v-7h6v7M12 3V1m6 3h4l-2 3h-2V3Z"/>',
  bow:'<path d="M4 3c20 0 20 18 0 18l9-9-9-9Zm1 9h17m-4-4 4 4-4 4"/>',
  horse:'<path d="M5 22v-5c0-6 6-7 5-10L8 5l6-2 1-2 3 3 4 6-3 4-5-2 3 6v4H5Z"/><path d="M16 7h1M8 5l-4 7"/>',
  ram:'<path d="M2 17h20M5 17V9h14v8M2 9l5-6h10l5 6M4 13h17m-3-3 4 3-4 3"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>',
  trebuchet:'<path d="M3 21h18M7 21l5-13 5 13M6 5l14 13M6 5 3 2m7 11L7 21M2 2h5v5H2zM18 17l3 1v3h-4v-3"/>',
  anvil:'<path d="M3 7h18l-4 5h-3v4l5 4H5l5-4v-4H6L3 7ZM14 3h6v4"/>',
  market:'<path d="M4 10v11h16V10M2 10l3-7h14l3 7M2 10c0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0M8 21v-7h8v7"/>',
  tower:'<path d="M5 21h14l-2-13H7L5 21ZM5 8V2h3v3h3V2h3v3h3V2h3v6H5ZM10 21v-5h4v5"/>',
  castle:'<path d="M2 21V6h5v15M17 21V6h5v15M2 6V2m5 4V2m10 4V2m5 4V2M7 10h10M7 13h10M10 21v-5h4v5M1 21h22"/>',
  shield:'<path d="m12 2 9 4v7c0 4-9 9-9 9s-9-5-9-9V6l9-4ZM12 6v11m-5-7h10"/>',
  wheel:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7m0 4v7m-9-9h7m4 0h7M6 6l5 5m2 2 5 5M6 18l5-5m2-2 5-5"/>',
  flag:'<path d="M5 22V2m0 1h15l-3 4 3 4H5"/>',
  move:'<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>',
  stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
  focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><circle cx="12" cy="12" r="4"/>',
  expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6M3 3l6 6m6 6 6 6m0-18-6 6M9 15l-6 6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  play:'<path d="m8 4 12 8-12 8V4Z"/>',
  sound:'<path d="M3 9h4l5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  muted:'<path d="M3 9h4l5-5v16l-5-5H3V9Zm13 0 6 6m0-6-6 6"/>',
  mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7M6 10h12"/>',
  arrow:'<path d="M12 21V3m-7 7 7-7 7 7"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  time:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  trade:'<path d="M3 7h18l-4-4M21 17H3l4 4M21 7l-4 4M3 17l4-4"/>',
  repair:'<path d="m4 21 10-10m0 0a6 6 0 0 1 5-9l-3 5 3 3 4-3a6 6 0 0 1-9 4Z"/>'
};
export function icon(name, className='') { return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.crown}</svg>`; }
export function rng(seed=1234567) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
