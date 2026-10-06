export const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];
export const AGE_COSTS = [{food: 400}, {food: 650, gold: 200}, {food: 1000, gold: 450}];
export const BUILDINGS = {
  towncenter: {name:'Town Center', cost:{wood:300,stone:200}, hp:2200, size:3, time:55, age:1, pop:10, description:'The heart of your settlement. Trains villagers and advances your age.', trains:['villager']},
  house: {name:'House', cost:{wood:40}, hp:450, size:1.4, time:12, age:1, pop:5, description:'A home for your people. Adds 5 population capacity.'},
  lumbercamp: {name:'Lumber Camp', cost:{wood:80}, hp:650, size:1.7, time:18, age:1, description:'A nearby drop-off point for wood. Speeds up your lumber economy.'},
  miningcamp: {name:'Mining Camp', cost:{wood:80}, hp:650, size:1.7, time:18, age:1, description:'A drop-off point for gold and stone. Keep it close to your mines.'},
  mill: {name:'Mill', cost:{wood:80}, hp:650, size:1.8, time:18, age:1, description:'A food drop-off point. Unlocks farms and improves food gathering.'},
  farm: {name:'Farm', cost:{wood:50}, hp:300, size:2, time:9, age:1, description:'A renewable source of food. Assign a villager to work the fields.'},
  barracks: {name:'Barracks', cost:{wood:150}, hp:1000, size:2.3, time:28, age:1, trains:['militia','spearman'], description:'Trains infantry to defend your settlement and lead an assault.'},
  archery: {name:'Archery Range', cost:{wood:160}, hp:1000, size:2.3, time:28, age:2, trains:['archer'], description:'Trains archers. Ranged units excel behind a line of infantry.'},
  stable: {name:'Stable', cost:{wood:180}, hp:1200, size:2.5, time:30, age:2, trains:['scout','knight'], description:'Trains fast scouts and powerful knights for flanking and raids.'},
  blacksmith: {name:'Blacksmith', cost:{wood:150}, hp:1000, size:2, time:25, age:2, description:'Research stronger weapons and armor for your army.'},
  tower: {name:'Watch Tower', cost:{wood:80,stone:100}, hp:1300, size:1.5, time:30, age:2, attack:15, range:7, description:'Automatically fires on approaching enemies. Protects your economy.'},
  castle: {name:'Castle', cost:{stone:500,wood:150}, hp:3500, size:3.5, time:65, age:3, attack:25, range:9, trains:['trebuchet'], description:'A formidable defensive stronghold. Trains trebuchets in the Imperial Age.'},
};
export const UNITS = {
  villager: {name:'Villager',cost:{food:50},hp:45,attack:3,range:0.8,speed:1.5,time:12,age:1,description:'Gathers resources, constructs buildings, and repairs your settlement.'},
  militia: {name:'Man-at-Arms',cost:{food:55,gold:15},hp:75,attack:9,range:0.9,speed:1.55,time:15,age:1,description:'Versatile infantry. Strong against buildings and archers.'},
  spearman: {name:'Spearman',cost:{food:45,wood:25},hp:65,attack:7,range:1.1,speed:1.6,time:14,age:1,description:'Defensive infantry with a large attack bonus against cavalry.'},
  archer: {name:'Archer',cost:{wood:30,gold:35},hp:40,attack:7,range:5,speed:1.65,time:17,age:2,description:'Attacks from a distance. Keep archers protected by your infantry.'},
  scout: {name:'Scout Cavalry',cost:{food:75},hp:80,attack:7,range:1,speed:2.8,time:18,age:2,description:'Fast cavalry for exploring the map and raiding enemy villagers.'},
  knight: {name:'Knight',cost:{food:90,gold:65},hp:150,attack:17,range:1.1,speed:2.3,time:25,age:3,description:'Heavy cavalry. Tough armor, devastating attacks, and excellent mobility.'},
  trebuchet: {name:'Trebuchet',cost:{wood:160,gold:130},hp:150,attack:85,range:11,speed:0.85,time:32,age:4,description:'Long-range siege engine. Devastating against buildings; vulnerable to cavalry.'},
};
export const TECHS = {
  forging:{name:'Forging',cost:{food:100,gold:50},time:25,age:2,description:'+2 attack for all military units.'},
  armor:{name:'Scale Armor',cost:{food:120,gold:50},time:25,age:2,description:'Reduces damage taken by your military units by 2.'},
  wheelbarrow:{name:'Wheelbarrow',cost:{food:150,wood:75},time:25,age:2,description:'Villagers move and gather 25% faster.'},
};
export const RESOURCE_NAMES = {wood:'Wood',food:'Food',gold:'Gold',stone:'Stone'};
export const OWNER_COLORS = {player:'#5ab7d7',enemy:'#d96652',neutral:'#aaa'};
export const MAP_SIZE = 56;
export const TILE_W = 72;
export const TILE_H = 36;
export function costText(cost){return Object.entries(cost).map(([k,v])=>`${v} ${RESOURCE_NAMES[k]||k}`).join(' · ');}
