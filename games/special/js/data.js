'use strict';
// ===== Static game data: civs, units, buildings, techs =====
const TW=64, TH=32, LVL=20;           // iso tile size, pixels per elevation level
const AGES=['Dark Age','Feudal Age','Castle Age','Imperial Age'];
const RK=['f','w','g','s'];
const RN={f:'Food',w:'Wood',g:'Gold',s:'Stone'};
const RCOL={f:'#e6a14a',w:'#9a6a3a',g:'#f2d035',s:'#9aa0a8'};
const PCOLORS=[{n:'Blue',c:'#2f6fe0'},{n:'Red',c:'#d83a3a'},{n:'Green',c:'#2fa84f'},{n:'Yellow',c:'#e8c52a'},{n:'Cyan',c:'#27c2c9'},{n:'Purple',c:'#8a46c9'},{n:'Gray',c:'#9a9fa8'},{n:'Orange',c:'#ee8a2a'}];
const T_GRASS=0,T_DIRT=1,T_SAND=2,T_SHALLOW=3,T_DEEP=4;
const TERRAIN_NAMES=['Grass','Dirt','Beach','Shallows','Deep Water'];
const isWater=t=>t>=3;

// ---------- Civilizations ----------
const CIVS={
 britons:{n:'Britons',lang:'Welsh-style',uu:'longbowman',ut:'yeomen',eut:'warwolf',style:{wall:'#c9b48a',roof:'#a8432f',trim:'#6b4a2a'},
  bon:['Shepherds work 25% faster','Foot archers +1 range in Castle Age, +1 more in Imperial Age','Town Centers cost 50% less wood from Castle Age'],
  tech:'Yeomen: foot archers +1 range, towers +1 attack'},
 franks:{n:'Franks',lang:'Old French',uu:'throwaxe',ut:'bearded',eut:'chivalry',style:{wall:'#d8cfb8',roof:'#3a5fa8',trim:'#7a6a4a'},
  bon:['Cavalry +20% hit points','Castles cost 25% less','Farms yield +15% food (Mill upgrades count)'],
  tech:'Bearded Axe: Throwing Axemen +2 range'},
 goths:{n:'Goths',lang:'Gothic',uu:'huskarl',ut:'anarchy',eut:'perfusion',style:{wall:'#b9b2a0',roof:'#6a6a72',trim:'#4a3a2a'},
  bon:['Infantry cost 25% less','Barracks train 25% faster','Hunters gather 25% faster'],
  tech:'Anarchy: Huskarls also trainable at Barracks (+train speed)'},
 byzantines:{n:'Byzantines',lang:'Medieval Greek',uu:'cataphract',ut:'logistica',eut:'greekfire',style:{wall:'#e0d2b0',roof:'#b55a3a',trim:'#d4a830'},
  bon:['Buildings +15% hit points','Fire Ships +25% attack','Monks heal 30% faster'],
  tech:'Logistica: Cataphracts do trample damage'},
 japanese:{n:'Japanese',lang:'Japanese',uu:'samurai',ut:'yasama',eut:'kataparuto',style:{wall:'#e8dcc0',roof:'#3a3a48',trim:'#a83030'},
  bon:['Fishing Ships work 20% faster and cost 15% less','Infantry attack 25% faster','Mills & camps cost 50% less'],
  tech:'Yasama: Towers fire extra arrows'},
 mongols:{n:'Mongols',lang:'Mongolian',uu:'mangudai',ut:'nomads',eut:'drill',style:{wall:'#c8a878',roof:'#7a4a2a',trim:'#2a5a8a'},
  bon:['Cavalry archers fire 20% faster','Hunters work 40% faster','Scouts +2 line of sight and +? hit points'],
  tech:'Nomads: houses no longer lose capacity when destroyed; +Mangudai speed'},
 vikings:{n:'Vikings',lang:'Old Norse',uu:'berserk',ut:'chieftains',eut:'berserkergang',style:{wall:'#a88a60',roof:'#5a4a3a',trim:'#9a2a2a'},
  bon:['Infantry +20% hit points','Warships cost 15% less','Docks & ships train 15% faster'],
  tech:'Chieftains: infantry deal bonus damage to cavalry'},
 saracens:{n:'Saracens',lang:'Arabic',uu:'mameluke',ut:'madrasah',eut:'zealotry',style:{wall:'#e6d6a8',roof:'#3a8a9a',trim:'#c8a030'},
  bon:['Market fees only 5%','Trade Carts / Cogs earn +20%','Archers gain +2 attack vs buildings'],
  tech:'Madrasah: killed monks return 33 gold'},
 teutons:{n:'Teutons',lang:'German',uu:'tknight',ut:'ironclad',eut:'crenellations',style:{wall:'#bdb4a2',roof:'#555a62',trim:'#222'},
  bon:['Garrison capacity +5 in Towers, Castles, Town Centers','Monks are 50% resistant to conversion','Units are 15% resistant... Town Center fires +2 arrows'],
  tech:'Ironclad: siege and ships take reduced damage'},
 chinese:{n:'Chinese',lang:'Mandarin',uu:'chukonu',ut:'greatwall',eut:'rocketry',style:{wall:'#d9b38a',roof:'#b02a2a',trim:'#e0b830'},
  bon:['Start with +2 villagers','Technologies cost 10% less','Farmers work 10% faster'],
  tech:'Great Wall: walls and towers +30% hit points'},
};
CIVS.mongols.bon[2]='Scouts have +2 line of sight and +20% hit points';
CIVS.teutons.bon[2]='Town Centers fire 2 extra arrows';

// ---------- Units ----------
const U={}, LINES={};
function defU(k,line,lv,o){o.k=k;o.line=line;o.lv=lv;U[k]=o;(LINES[line]=LINES[line]||[])[lv]=k;o.cls=o.cls||[];o.bon=o.bon||{};o.rng=o.rng||0;o.ma=o.ma||0;o.pa=o.pa||0;o.cost=o.cost||{};o.pop=1;o.los=o.los||6;o.size=o.size||1;return o;}
const C=(f,w,g,s)=>({f:f||0,w:w||0,g:g||0,s:s||0});
defU('villager','villager',0,{n:'Villager',hp:25,atk:3,rof:2,spd:1.15,cost:C(50),t:12,cls:['vil','mel'],los:6,ico:'vil',d:'Builds, gathers, repairs and hunts. Can garrison in Town Centers, Towers and Castles.'});
defU('militia','inf',0,{n:'Militia',hp:40,atk:4,rof:2,pa:1,spd:1.25,cost:C(60,0,20),t:12,cls:['inf','mel'],ico:'sword',d:'Basic infantry. Strong against buildings and archers.'});
defU('manatarms','inf',1,{n:'Man-at-Arms',hp:45,atk:6,rof:2,pa:1,spd:1.25,cost:C(60,0,20),t:12,cls:['inf','mel'],ico:'sword',d:'Upgraded militia.'});
defU('longsword','inf',2,{n:'Long Swordsman',hp:60,atk:9,rof:2,ma:1,pa:1,spd:1.25,cost:C(60,0,20),t:12,cls:['inf','mel'],ico:'sword',d:'Strong infantry swordsman.'});
defU('twohand','inf',3,{n:'Two-Handed Swordsman',hp:60,atk:11,rof:2,ma:1,pa:1,spd:1.25,cost:C(60,0,20),t:12,cls:['inf','mel'],ico:'sword2',d:'Heavy two-handed blade.'});
defU('champion','inf',4,{n:'Champion',hp:70,atk:13,rof:2,ma:1,pa:2,spd:1.3,cost:C(60,0,20),t:12,cls:['inf','mel'],ico:'sword2',d:'Elite swordsman.'});
defU('spearman','spear',0,{n:'Spearman',hp:45,atk:3,rof:3,spd:1.25,cost:C(35,25),t:10,cls:['inf','spear','mel'],bon:{cav:15},ico:'spear',d:'Cheap anti-cavalry infantry (+15 vs cavalry).'});
defU('pikeman','spear',1,{n:'Pikeman',hp:55,atk:4,rof:3,spd:1.25,cost:C(35,25),t:10,cls:['inf','spear','mel'],bon:{cav:22},ico:'spear',d:'Long pike, +22 vs cavalry.'});
defU('halberdier','spear',2,{n:'Halberdier',hp:60,atk:6,rof:3,ma:0,pa:0,spd:1.25,cost:C(35,25),t:10,cls:['inf','spear','mel'],bon:{cav:32},ico:'spear',d:'Halberd, +32 vs cavalry.'});
defU('archer','archer',0,{n:'Archer',hp:30,atk:4,rng:6,rof:2,spd:1.2,cost:C(0,25,45),t:12,cls:['arc','ranged'],ico:'bow',d:'Ranged attacker. Weak in melee; beaten by skirmishers and cavalry.'});
defU('crossbow','archer',1,{n:'Crossbowman',hp:35,atk:5,rng:6,rof:2,spd:1.2,cost:C(0,25,45),t:12,cls:['arc','ranged'],ico:'bow',d:'Upgraded archer.'});
defU('arbalest','archer',2,{n:'Arbalester',hp:40,atk:6,rng:7,rof:1.9,spd:1.2,cost:C(0,25,45),t:12,cls:['arc','ranged'],ico:'bow',d:'Elite crossbow.'});
defU('skirm','skirm',0,{n:'Skirmisher',hp:30,atk:2,rng:5,rof:2,pa:3,spd:1.25,cost:C(25,35),t:10,cls:['skirm','ranged'],bon:{arc:3,inf:0},ico:'jav',d:'Anti-archer ranged unit (+3 vs archers); high pierce armor.'});
defU('eliteskirm','skirm',1,{n:'Elite Skirmisher',hp:35,atk:3,rng:6,rof:2,pa:4,spd:1.3,cost:C(25,35),t:10,cls:['skirm','ranged'],bon:{arc:5},ico:'jav',d:'Elite javelineer, +5 vs archers.'});
defU('scout','scout',0,{n:'Scout Cavalry',hp:45,atk:3,rof:2,pa:2,spd:2.5,cost:C(80),t:12,cls:['cav','mel'],los:9,ico:'horse',d:'Fast explorer. Can herd sheep and hunt.'});
defU('lightcav','scout',1,{n:'Light Cavalry',hp:60,atk:7,rof:2,pa:2,spd:2.6,cost:C(80),t:12,cls:['cav','mel'],los:9,ico:'horse',d:'Fast raider, good against monks and archers.'});
defU('hussar','scout',2,{n:'Hussar',hp:75,atk:7,rof:1.9,pa:2,spd:2.7,cost:C(80),t:12,cls:['cav','mel'],los:9,ico:'horse',d:'Elite light cavalry.'});
defU('knight','knight',0,{n:'Knight',hp:100,atk:10,rof:1.8,ma:2,pa:2,spd:1.9,cost:C(60,0,75),t:16,cls:['cav','mel','knight'],ico:'knight',d:'Heavy cavalry. Strong melee; weak to spearmen.'});
defU('cavalier','knight',1,{n:'Cavalier',hp:120,atk:12,rof:1.8,ma:2,pa:3,spd:1.9,cost:C(60,0,75),t:16,cls:['cav','mel','knight'],ico:'knight',d:'Upgraded knight.'});
defU('paladin','knight',2,{n:'Paladin',hp:160,atk:14,rof:1.8,ma:3,pa:4,spd:1.9,cost:C(60,0,75),t:16,cls:['cav','mel','knight'],ico:'knight',d:'Elite heavy cavalry.'});
defU('cavarcher','cavarcher',0,{n:'Cavalry Archer',hp:50,atk:6,rng:5,rof:2,spd:2.1,cost:C(0,40,70),t:16,cls:['cav','arc','ranged','cavarc'],ico:'cavbow',d:'Mounted archer; hit and run.'});
defU('hcavarcher','cavarcher',1,{n:'Heavy Cav Archer',hp:60,atk:7,rng:6,rof:1.9,spd:2.1,cost:C(0,40,70),t:16,cls:['cav','arc','ranged','cavarc'],ico:'cavbow',d:'Elite cavalry archer.'});
defU('monk','monk',0,{n:'Monk',hp:30,atk:0,rof:2,spd:1.1,cost:C(0,0,100),t:20,cls:['mon'],los:7,ico:'monk',d:'Heals friendly units, converts enemies, carries relics.'});
defU('ram','ram',0,{n:'Battering Ram',hp:175,atk:3,rof:3,ma:0,pa:150,spd:0.95,cost:C(0,160,75),t:22,cls:['siege','ram','mel'],bon:{bld:90},ico:'ram',d:'Siege engine that crushes buildings. Immune to arrows; vulnerable to melee.'});
defU('capram','ram',1,{n:'Capped Ram',hp:200,atk:4,rof:3,ma:0,pa:150,spd:0.95,cost:C(0,160,75),t:22,cls:['siege','ram','mel'],bon:{bld:130},ico:'ram',d:'Reinforced ram.'});
defU('siegeram','ram',2,{n:'Siege Ram',hp:270,atk:5,rof:3,ma:0,pa:150,spd:0.95,cost:C(0,160,75),t:22,cls:['siege','ram','mel'],bon:{bld:180},ico:'ram',d:'Most powerful ram.'});
defU('mangonel','mang',0,{n:'Mangonel',hp:50,atk:40,rng:7,rof:6,pa:0,spd:0.9,cost:C(0,160,135),t:26,cls:['siege','ranged'],bon:{bld:35},splash:1.3,minr:2.5,proj:'rock',ico:'mangonel',d:'Area-damage siege engine; strong vs massed troops.'});
defU('onager','mang',1,{n:'Onager',hp:60,atk:50,rng:7,rof:6,pa:0,spd:0.9,cost:C(0,160,135),t:26,cls:['siege','ranged'],bon:{bld:45},splash:1.5,minr:2.5,proj:'rock',ico:'mangonel',d:'Heavier catapult.'});
defU('scorpion','scorp',0,{n:'Scorpion',hp:40,atk:12,rng:7,rof:3,spd:1,cost:C(0,75,75),t:22,cls:['siege','ranged'],bon:{inf:2},proj:'bolt',ico:'scorp',d:'Bolt thrower; hurts infantry lines.'});
defU('heavyscorp','scorp',1,{n:'Heavy Scorpion',hp:50,atk:16,rng:7,rof:3,spd:1,cost:C(0,75,75),t:22,cls:['siege','ranged'],bon:{inf:3},proj:'bolt',ico:'scorp',d:'Upgraded scorpion.'});
defU('trebuchet','treb',0,{n:'Trebuchet',hp:150,atk:150,rng:13,rof:10,spd:0.8,cost:C(0,200,200),t:32,cls:['siege','ranged'],bon:{bld:100},splash:1.0,minr:4,proj:'rock',ico:'treb',d:'Long-range building killer. Defenseless up close.'});
// uniques
defU('longbowman','uu_britons',0,{n:'Longbowman',hp:35,atk:6,rng:8,rof:2,spd:1.2,cost:C(0,35,40),t:15,cls:['arc','ranged','uu'],ico:'bow',d:'Britons unique: extremely long-ranged archer.'});
defU('throwaxe','uu_franks',0,{n:'Throwing Axeman',hp:60,atk:7,rng:4,rof:2,pa:1,spd:1.3,cost:C(55,0,25),t:15,cls:['inf','ranged','uu'],proj:'axe',ico:'axe',d:'Franks unique: infantry that throws axes.'});
defU('huskarl','uu_goths',0,{n:'Huskarl',hp:60,atk:6,rof:2,ma:0,pa:6,spd:1.3,cost:C(52,0,26),t:15,cls:['inf','mel','uu'],bon:{arc:6},ico:'sword',d:'Goths unique: nearly immune to arrows, strong vs archers.'});
defU('cataphract','uu_byzantines',0,{n:'Cataphract',hp:110,atk:9,rof:1.9,ma:2,pa:2,spd:1.9,cost:C(70,0,75),t:18,cls:['cav','mel','uu'],bon:{spear:0,inf:4},ico:'knight',d:'Byzantine unique: heavy cavalry, tramples infantry, ignores spear bonus.'});
defU('samurai','uu_japanese',0,{n:'Samurai',hp:60,atk:8,rof:1.4,ma:1,pa:1,spd:1.3,cost:C(60,0,30),t:15,cls:['inf','mel','uu'],bon:{uu:8},ico:'katana',d:'Japanese unique: fast-attacking swordsman; bonus vs unique units.'});
defU('mangudai','uu_mongols',0,{n:'Mangudai',hp:60,atk:6,rng:5,rof:1.6,spd:2.3,cost:C(0,55,65),t:16,cls:['cav','arc','ranged','cavarc','uu'],bon:{siege:6},ico:'cavbow',d:'Mongol unique: fast horse archer, bonus vs siege.'});
defU('berserk','uu_vikings',0,{n:'Berserk',hp:54,atk:8,rof:1.8,ma:1,pa:1,spd:1.3,cost:C(65,0,25),t:15,cls:['inf','mel','uu'],regen:0.6,ico:'axe',d:'Viking unique: regenerates health while fighting.'});
defU('mameluke','uu_saracens',0,{n:'Mameluke',hp:70,atk:8,rng:1,rof:1.8,ma:1,pa:1,spd:1.9,cost:C(55,0,85),t:17,cls:['cav','mel','uu'],bon:{cav:9},ico:'camel',d:'Saracen unique: camel rider, strong vs cavalry.'});
defU('tknight','uu_teutons',0,{n:'Teutonic Knight',hp:80,atk:12,rof:2,ma:5,pa:2,spd:1.0,cost:C(85,0,40),t:17,cls:['inf','mel','uu'],ico:'sword2',d:'Teuton unique: slow, heavily armored infantry.'});
defU('chukonu','uu_chinese',0,{n:'Chu Ko Nu',hp:45,atk:3,rng:6,rof:0.9,spd:1.2,cost:C(0,40,35),t:15,cls:['arc','ranged','uu'],ico:'bow',d:'Chinese unique: rapid-firing repeating crossbow.'});
// naval
defU('fishing','fishing',0,{n:'Fishing Ship',hp:45,atk:0,rof:2,pa:4,spd:1.6,cost:C(0,75),t:14,cls:['ship','boat'],los:6,cap:20,ico:'fishship',d:'Harvests fish from the sea and returns food to a Dock.'});
defU('transport','transport',0,{n:'Transport Ship',hp:100,atk:0,rof:2,pa:6,spd:1.7,cost:C(0,125),t:18,cls:['ship','boat'],los:7,tcap:10,ico:'transport',d:'Carries up to 10 land units across water. Right-click shore to unload.'});
defU('galley','galley',0,{n:'Galley',hp:120,atk:6,rng:6,rof:2,pa:6,spd:1.7,cost:C(0,90,30),t:16,cls:['ship','warship','ranged'],bon:{ship:2},los:8,proj:'arrow',ico:'galley',d:'Warship with ranged attack. Also bombards coastal targets.'});
defU('wargalley','galley',1,{n:'War Galley',hp:135,atk:8,rng:7,rof:2,pa:6,spd:1.75,cost:C(0,90,30),t:16,cls:['ship','warship','ranged'],bon:{ship:2},los:8,proj:'arrow',ico:'galley',d:'Upgraded galley.'});
defU('galleon','galley',2,{n:'Galleon',hp:165,atk:10,rng:7,rof:1.9,pa:6,spd:1.8,cost:C(0,90,30),t:16,cls:['ship','warship','ranged'],bon:{ship:2},los:8,proj:'arrow',ico:'galley',d:'Elite war galley.'});
defU('fireship','fire',0,{n:'Fire Ship',hp:70,atk:3,rng:2.2,rof:0.4,pa:6,spd:1.9,cost:C(0,75,45),t:16,cls:['ship','warship'],bon:{ship:6},ign:true,los:7,proj:'flame',ico:'fire',d:'Short-range flamethrower, ignores armor; shreds ships.'});
defU('fastfire','fire',1,{n:'Fast Fire Ship',hp:85,atk:4,rng:2.4,rof:0.4,pa:6,spd:2.1,cost:C(0,75,45),t:16,cls:['ship','warship'],bon:{ship:6},ign:true,los:7,proj:'flame',ico:'fire',d:'Upgraded fire ship.'});
defU('demoraft','demo',0,{n:'Demolition Ship',hp:45,atk:0,rof:2,spd:2.0,cost:C(0,70,50),t:16,cls:['ship','demo'],boom:{r:2.2,dmg:110,bld:260},los:6,ico:'demo',d:'Explodes on contact, devastating ships and coastal buildings.'});
defU('demoship','demo',1,{n:'Heavy Demolition Ship',hp:60,atk:0,rof:2,spd:2.1,cost:C(0,70,50),t:16,cls:['ship','demo'],boom:{r:2.6,dmg:160,bld:380},los:6,ico:'demo',d:'Larger explosive ship.'});
defU('tradecog','tradecog',0,{n:'Trade Cog',hp:80,atk:0,rof:2,pa:5,spd:1.6,cost:C(0,100,50),t:18,cls:['ship','boat','trade'],los:6,ico:'cog',d:'Sails between friendly Docks to earn gold by distance.'});
defU('tradecart','tradecart',0,{n:'Trade Cart',hp:70,atk:0,rof:2,spd:1.3,cost:C(0,100,50),t:18,cls:['trade'],los:5,ico:'cart',d:'Right-click a friendly Market far away to trade; earns gold by distance.'});
// misc (cheat / neutral)
defU('cobra','cobra',0,{n:'Cobra Car',hp:260,atk:5,rng:7,rof:0.08,pa:3,ma:3,spd:5.2,cost:C(),t:1,cls:['cav','ranged','car'],proj:'bullet',los:9,ico:'car',d:'A Shelby Cobra. Drives fast, machine guns fire rapidly.'});
// animals
defU('sheep','sheep',0,{n:'Sheep',hp:7,atk:0,rof:2,spd:0.9,cls:['animal'],food:100,los:3,ico:'sheep',d:'Neutral sheep become yours when your units come near. Slaughter for food.',animal:1});
defU('deer','deer',0,{n:'Deer',hp:5,atk:0,rof:2,spd:2.4,cls:['animal','prey'],food:140,los:5,ico:'deer',d:'Prey. Flees from danger.',animal:1});
defU('boar','boar',0,{n:'Wild Boar',hp:30,atk:7,rof:2,spd:1.9,pa:0,cls:['animal','dangerous'],food:340,los:4,ico:'boar',d:'Fights back when attacked. Rich in food.',animal:1});
defU('wolf','wolf',0,{n:'Wolf',hp:25,atk:6,rof:1.6,spd:2.2,cls:['animal','predator'],food:0,los:6,ico:'wolf',d:'Predator that attacks exposed units.',animal:1});

// ---------- Buildings ----------
const B={};
function defB(k,o){o.k=k;B[k]=o;o.cls=['bld'];o.cost=o.cost||{};o.req=o.req||[];o.drop=o.drop||'';o.trains=o.trains||[];o.techs=o.techs||[];o.gar=o.gar||0;o.los=o.los||5;o.ma=o.ma===undefined?3:o.ma;o.pa=o.pa===undefined?8:o.pa;return o;}
defB('towncenter',{n:'Town Center',sz:4,hp:2400,cost:C(0,275,0,100),age:0,t:60,menu:'mil',ico:'tc',drop:'fwgs',trains:['villager'],techs:['loom','wheelbarrow','handcart','townwatch','feudal','castle','imperial'],gar:15,pop:10,los:9,atk:{d:5,rng:7,rof:2,base:1},d:'Heart of your settlement: trains villagers, researches ages, stores resources and shelters villagers (Town Bell).'});
defB('house',{n:'House',sz:2,hp:550,cost:C(0,30),age:0,t:20,menu:'eco',ico:'house',pop:5,d:'Provides +5 population capacity.'});
defB('mill',{n:'Mill',sz:2,hp:900,cost:C(0,100),age:0,t:30,menu:'eco',ico:'mill',drop:'f',techs:['horsecollar','heavyplow','cropr'],d:'Drop-off for farms, berries and meat. Researches farming upgrades.'});
defB('lumber',{n:'Lumber Camp',sz:2,hp:900,cost:C(0,100),age:0,t:30,menu:'eco',ico:'lumber',drop:'w',techs:['doublebit','bowsaw','twoman'],d:'Drop-off for wood. Researches woodcutting upgrades.'});
defB('mining',{n:'Mining Camp',sz:2,hp:900,cost:C(0,100),age:0,t:30,menu:'eco',ico:'mining',drop:'gs',techs:['goldmine','goldshaft','stonemine','stoneshaft'],d:'Drop-off for gold and stone. Researches mining upgrades.'});
defB('farm',{n:'Farm',sz:3,hp:480,cost:C(0,60),age:0,t:14,menu:'eco',req:['mill'],ico:'farm',farm:1,d:'Endless-ish food: one farmer; auto-reseeds for 60 wood when exhausted.',ma:0,pa:0});
defB('dock',{n:'Dock',sz:3,hp:1800,cost:C(0,150),age:1,t:35,menu:'eco',ico:'dock',drop:'f',dock:1,trains:['fishing','transport','galley','fire','demo','tradecog'],techs:['gillnets','wargalley','galleon','fastfire','heavydemo','careening'],gar:0,los:7,d:'Built on a shoreline. Trains ships and receives fish.'});
defB('market',{n:'Market',sz:3,hp:1800,cost:C(0,175),age:1,t:40,menu:'eco',req:['mill'],ico:'market',trains:['tradecart'],techs:['caravan','guilds'],market:1,d:'Buy and sell resources, train Trade Carts.'});
defB('barracks',{n:'Barracks',sz:3,hp:1500,cost:C(0,175),age:0,t:35,menu:'mil',ico:'barracks',trains:['inf','spear'],techs:['manatarms','longsword','twohand','champion','pikeman','halberdier','conscription'],d:'Trains infantry and spearmen.'});
defB('archery',{n:'Archery Range',sz:3,hp:1500,cost:C(0,175),age:1,t:35,menu:'mil',req:['barracks'],ico:'archery',trains:['archer','skirm','cavarcher'],techs:['crossbow','arbalest','eliteskirm','hcavarcher','thumbring'],d:'Trains archers, skirmishers and cavalry archers.'});
defB('stable',{n:'Stable',sz:3,hp:1500,cost:C(0,175),age:1,t:35,menu:'mil',req:['barracks'],ico:'stable',trains:['scout','knight'],techs:['lightcav','hussar','cavalier','paladin','bloodlines'],d:'Trains scouts and knights.'});
defB('blacksmith',{n:'Blacksmith',sz:2,hp:1500,cost:C(0,150),age:1,t:35,menu:'mil',ico:'smith',techs:['forging','ironcast','blastfurn','fletching','bodkin','bracer','scale','chain','plate','sbarding','cbarding','pbarding','padded','leather','ringarcher'],d:'Researches attack and armor upgrades.'});
defB('monastery',{n:'Monastery',sz:3,hp:1800,cost:C(0,175),age:2,t:40,menu:'mil',req:['blacksmith'],ico:'monastery',trains:['monk'],techs:['fervor','sanctity','herbal','blockprint','illumination','redemption','atonement'],relics:1,d:'Trains monks, researches monk techs and stores relics for gold income.'});
defB('university',{n:'University',sz:3,hp:2100,cost:C(0,200),age:2,t:40,menu:'mil',req:['market'],ico:'university',techs:['ballistics','masonry','treadmill','guardtower','heatedshot','siegeeng','murder'],d:'Researches defensive and engineering technologies.'});
defB('siege',{n:'Siege Workshop',sz:3,hp:1700,cost:C(0,200),age:2,t:40,menu:'mil',req:['blacksmith'],ico:'siegews',trains:['ram','mang','scorp'],techs:['capram','siegeram','onager','heavyscorp'],d:'Builds rams, catapults and scorpions.'});
defB('castle',{n:'Castle',sz:4,hp:4800,cost:C(0,0,0,650),age:2,t:80,menu:'mil',req:['blacksmith'],ico:'castle',trains:['uu','treb'],techs:['uniq','euniq','hoardings'],gar:20,pop:0,los:10,atk:{d:11,rng:8,rof:2,base:2},d:'Powerful fortress: unique unit, trebuchets, garrison and arrow fire.'});
defB('tower',{n:'Watch Tower',sz:2,hp:1020,cost:C(0,25,0,100),age:1,t:35,menu:'mil',ico:'tower',gar:5,los:8,atk:{d:5,rng:7,rof:2,base:1},d:'Defensive tower. Garrison infantry/archers/villagers for more arrows.',ma:5,pa:8});
defB('wall',{n:'Stone Wall',sz:1,hp:900,cost:C(0,0,0,5),age:1,t:5,menu:'mil',ico:'wall',wall:1,ma:6,pa:12,d:'Blocks enemy movement. Drag to build a line. Enemies must breach it.'});
defB('gate',{n:'Gate',sz:1,hp:700,cost:C(0,0,0,30),age:1,t:12,menu:'mil',ico:'gate',wall:1,gate:1,ma:6,pa:12,d:'Passable by you and allies; blocks enemies.'});

// ---------- Technologies ----------
const T={};
function defT(k,n,cost,t,by,age,o){o.k=k;o.n=n;o.cost=cost;o.t=t;o.by=by;o.age=age;T[k]=o;o.ico=o.ico||'book';return o;}
// ages
defT('feudal','Advance to Feudal Age',C(500),25,'towncenter',0,{age_up:1,ico:'age',d:'Unlocks Feudal buildings and units. Requires 2 Dark Age buildings.',need:['house','mill','lumber','mining','barracks','farm'],needN:2});
defT('castle','Advance to Castle Age',C(800,0,200),30,'towncenter',1,{age_up:2,ico:'age',d:'Unlocks Castles, Monasteries, siege. Requires 2 Feudal Age buildings.',need:['blacksmith','market','archery','stable','tower','dock'],needN:2});
defT('imperial','Advance to Imperial Age',C(1000,0,800),35,'towncenter',2,{age_up:3,ico:'age',d:'Unlocks the strongest upgrades. Requires 2 Castle Age buildings.',need:['monastery','university','siege','castle'],needN:2});
// TC
defT('loom','Loom',C(50,0,50),15,'towncenter',0,{m:[['vil','hp',15],['vil','pa',1]],d:'Villagers +15 HP, +1 pierce armor.'});
defT('wheelbarrow','Wheelbarrow',C(175,50),20,'towncenter',1,{m:[['vil','spd',0.1]],carry:5,d:'Villagers move 10% faster and carry 5 more.'});
defT('handcart','Hand Cart',C(300,200),25,'towncenter',2,{req:'wheelbarrow',m:[['vil','spd',0.1]],carry:5,d:'Villagers move 10% faster and carry 5 more.'});
defT('townwatch','Town Watch',C(75),15,'towncenter',1,{m:[['bld','los',4]],d:'Buildings see 4 tiles further.'});
// mill/lumber/mining
defT('horsecollar','Horse Collar',C(75,75),20,'mill',1,{eco:{farm:.2},d:'Farms +20% food rate.'});
defT('heavyplow','Heavy Plow',C(125,125),25,'mill',2,{req:'horsecollar',eco:{farm:.2},d:'Farms +20% food rate.'});
defT('cropr','Crop Rotation',C(250,250),30,'mill',3,{req:'heavyplow',eco:{farm:.2},d:'Farms +20% food rate.'});
defT('doublebit','Double-Bit Axe',C(100,50),20,'lumber',1,{eco:{wood:.2},d:'Woodcutters +20% faster.'});
defT('bowsaw','Bow Saw',C(150,100),25,'lumber',2,{req:'doublebit',eco:{wood:.2},d:'Woodcutters +20% faster.'});
defT('twoman','Two-Man Saw',C(300,200),30,'lumber',3,{req:'bowsaw',eco:{wood:.2},d:'Woodcutters +20% faster.'});
defT('goldmine','Gold Mining',C(100,75),20,'mining',1,{eco:{gold:.15},d:'Gold miners +15% faster.'});
defT('goldshaft','Gold Shaft Mining',C(200,150),30,'mining',2,{req:'goldmine',eco:{gold:.15},d:'Gold miners +15% faster.'});
defT('stonemine','Stone Mining',C(100,75),20,'mining',1,{eco:{stone:.15},d:'Stone miners +15% faster.'});
defT('stoneshaft','Stone Shaft Mining',C(200,150),30,'mining',2,{req:'stonemine',eco:{stone:.15},d:'Stone miners +15% faster.'});
// barracks
defT('manatarms','Man-at-Arms',C(100,0,40),20,'barracks',1,{up:['inf',1],d:'Upgrades Militia to Man-at-Arms.'});
defT('longsword','Long Swordsman',C(150,0,65),25,'barracks',2,{up:['inf',2],req:'manatarms',d:'Upgrades to Long Swordsman.'});
defT('twohand','Two-Handed Swordsman',C(300,0,100),30,'barracks',3,{up:['inf',3],req:'longsword',d:'Upgrades to Two-Handed Swordsman.'});
defT('champion','Champion',C(750,0,350),35,'barracks',3,{up:['inf',4],req:'twohand',d:'Upgrades to Champion.'});
defT('pikeman','Pikeman',C(215,0,90),25,'barracks',2,{up:['spear',1],d:'Upgrades Spearman to Pikeman.'});
defT('halberdier','Halberdier',C(300,0,600),30,'barracks',3,{up:['spear',2],req:'pikeman',d:'Upgrades to Halberdier.'});
defT('conscription','Conscription',C(150,0,150),25,'barracks',3,{train:{barracks:.8,archery:.8,stable:.8},d:'Military buildings train 20% faster.'});
// archery
defT('crossbow','Crossbowman',C(125,0,75),25,'archery',2,{up:['archer',1],d:'Upgrades Archer.'});
defT('arbalest','Arbalester',C(450,0,400),30,'archery',3,{up:['archer',2],req:'crossbow',d:'Upgrades Crossbowman.'});
defT('eliteskirm','Elite Skirmisher',C(230,0,100),25,'archery',2,{up:['skirm',1],d:'Upgrades Skirmisher.'});
defT('hcavarcher','Heavy Cav Archer',C(900,0,500),30,'archery',3,{up:['cavarcher',1],d:'Upgrades Cavalry Archer.'});
defT('thumbring','Thumb Ring',C(300,0,250),25,'archery',2,{m:[['arc','rng',1]],d:'Archers +1 range.'});
// stable
defT('lightcav','Light Cavalry',C(150,0,50),25,'stable',2,{up:['scout',1],d:'Upgrades Scout.'});
defT('hussar','Hussar',C(500,0,600),30,'stable',3,{up:['scout',2],req:'lightcav',d:'Upgrades Light Cavalry.'});
defT('cavalier','Cavalier',C(300,0,300),30,'stable',3,{up:['knight',1],d:'Upgrades Knight.'});
defT('paladin','Paladin',C(1300,0,750),35,'stable',3,{up:['knight',2],req:'cavalier',d:'Upgrades Cavalier.'});
defT('bloodlines','Bloodlines',C(150,0,100),25,'stable',2,{m:[['cav','hp',20]],d:'Cavalry +20 HP.'});
// blacksmith
defT('forging','Forging',C(150),25,'blacksmith',1,{m:[['inf','atk',1],['cav','atk',1]],d:'Infantry & cavalry +1 attack.'});
defT('ironcast','Iron Casting',C(220,0,120),30,'blacksmith',2,{req:'forging',m:[['inf','atk',1],['cav','atk',1]],d:'Infantry & cavalry +1 attack.'});
defT('blastfurn','Blast Furnace',C(275,0,225),35,'blacksmith',3,{req:'ironcast',m:[['inf','atk',2],['cav','atk',2]],d:'Infantry & cavalry +2 attack.'});
defT('fletching','Fletching',C(100,0,50),25,'blacksmith',1,{m:[['ranged','atk',1],['ranged','rng',1],['bld','atk',1]],d:'Ranged units & buildings +1 attack, +1 range.'});
defT('bodkin','Bodkin Arrow',C(200,0,100),30,'blacksmith',2,{req:'fletching',m:[['ranged','atk',1],['ranged','rng',1],['bld','atk',1]],d:'Ranged +1 attack, +1 range.'});
defT('bracer','Bracer',C(300,0,200),35,'blacksmith',3,{req:'bodkin',m:[['ranged','atk',1],['ranged','rng',1],['bld','atk',1]],d:'Ranged +1 attack, +1 range.'});
defT('scale','Scale Mail Armor',C(100),25,'blacksmith',1,{m:[['inf','ma',1],['inf','pa',1]],d:'Infantry +1/+1 armor.'});
defT('chain','Chain Mail Armor',C(200,0,100),30,'blacksmith',2,{req:'scale',m:[['inf','ma',1],['inf','pa',1]],d:'Infantry +1/+1 armor.'});
defT('plate','Plate Mail Armor',C(300,0,150),35,'blacksmith',3,{req:'chain',m:[['inf','ma',1],['inf','pa',2]],d:'Infantry +1/+2 armor.'});
defT('sbarding','Scale Barding',C(150),25,'blacksmith',1,{m:[['cav','ma',1],['cav','pa',1]],d:'Cavalry +1/+1 armor.'});
defT('cbarding','Chain Barding',C(250,0,150),30,'blacksmith',2,{req:'sbarding',m:[['cav','ma',1],['cav','pa',1]],d:'Cavalry +1/+1 armor.'});
defT('pbarding','Plate Barding',C(350,0,200),35,'blacksmith',3,{req:'cbarding',m:[['cav','ma',1],['cav','pa',2]],d:'Cavalry +1/+2 armor.'});
defT('padded','Padded Archer Armor',C(100),25,'blacksmith',1,{m:[['arc','ma',1],['arc','pa',1]],d:'Archers +1/+1 armor.'});
defT('leather','Leather Archer Armor',C(150,0,150),30,'blacksmith',2,{req:'padded',m:[['arc','ma',1],['arc','pa',1]],d:'Archers +1/+1 armor.'});
defT('ringarcher','Ring Archer Armor',C(250,0,250),35,'blacksmith',3,{req:'leather',m:[['arc','ma',1],['arc','pa',2]],d:'Archers +1/+2 armor.'});
// market
defT('caravan','Caravan',C(200,0,200),25,'market',2,{tradeSpd:1.5,d:'Trade units move 50% faster.'});
defT('guilds','Guilds',C(250,0,300),30,'market',3,{fee:-.1,d:'Market exchange fee reduced by 10%.'});
// monastery
defT('fervor','Fervor',C(0,0,140),25,'monastery',2,{m:[['mon','spd',0.15]],d:'Monks move 15% faster.'});
defT('sanctity','Sanctity',C(0,0,120),25,'monastery',2,{m:[['mon','hp',15]],d:'Monks +15 HP.'});
defT('herbal','Herbal Medicine',C(0,0,200),25,'monastery',2,{heal:1.5,d:'Monks heal 50% faster.'});
defT('blockprint','Block Printing',C(0,0,200),30,'monastery',3,{convRng:3,d:'Monk conversion range +3.'});
defT('illumination','Illumination',C(0,0,120),25,'monastery',3,{convCd:.6,d:'Monks recover faster after converting.'});
defT('redemption','Redemption',C(0,0,475),30,'monastery',3,{redeem:1,d:'Monks can convert siege engines.'});
defT('atonement','Atonement',C(0,0,325),30,'monastery',3,{atone:1,d:'Monks can convert other monks.'});
// university
defT('ballistics','Ballistics',C(0,175,175),25,'university',2,{m:[['ranged','atk',1]],d:'Ranged units hit harder (+1 attack).'});
defT('masonry','Masonry',C(175,150),30,'university',2,{m:[['bld','hpMul',.1],['bld','ma',1],['bld','pa',1]],d:'Buildings +10% HP and +1/+1 armor.'});
defT('treadmill','Treadmill Crane',C(200,300),30,'university',2,{buildSpd:.2,d:'Builders work 20% faster.'});
defT('guardtower','Guard Tower',C(100,0,250),30,'university',2,{req:'',m:[['tower','hp',400],['tower','atk',2]],d:'Towers +400 HP, +2 attack.'});
defT('heatedshot','Heated Shot',C(250,0,200),30,'university',2,{m:[['bld','atkShip',4]],d:'Defensive buildings do +4 vs ships.'});
defT('siegeeng','Siege Engineers',C(250,0,200),35,'university',3,{m:[['siege','rng',1],['siege','atk',2]],d:'Siege +1 range, +2 attack.'});
defT('murder','Murder Holes',C(200,0,200),25,'university',3,{minr0:1,d:'Towers have no minimum range, +1 arrow.'});
// siege workshop
defT('capram','Capped Ram',C(0,300,200),30,'siege',2,{up:['ram',1],d:'Upgrades Battering Ram.'});
defT('siegeram','Siege Ram',C(0,500,400),35,'siege',3,{up:['ram',2],req:'capram',d:'Upgrades Capped Ram.'});
defT('onager','Onager',C(0,350,250),30,'siege',3,{up:['mang',1],d:'Upgrades Mangonel.'});
defT('heavyscorp','Heavy Scorpion',C(0,300,200),30,'siege',3,{up:['scorp',1],d:'Upgrades Scorpion.'});
// castle
defT('hoardings','Hoardings',C(200,100),30,'castle',2,{m:[['castle','hpMul',.2]],d:'Castles +20% HP.'});
defT('uniq','Unique Tech',C(300,0,200),35,'castle',2,{ico:'star',d:'Civilization unique technology.'});
defT('euniq','Elite Unique Unit',C(900,0,600),40,'castle',3,{req:'uniq',m:[['uu','hp',15],['uu','atk',2],['uu','ma',1],['uu','pa',1]],ico:'star',d:'Elite upgrade for your unique unit.'});
// docks
defT('gillnets','Gillnets',C(100,150),25,'dock',1,{eco:{fish:.25},d:'Fishing ships +25% faster.'});
defT('wargalley','War Galley',C(230,0,200),30,'dock',2,{up:['galley',1],d:'Upgrades Galley.'});
defT('galleon','Galleon',C(500,0,350),35,'dock',3,{up:['galley',2],req:'wargalley',d:'Upgrades War Galley.'});
defT('fastfire','Fast Fire Ship',C(280,0,250),30,'dock',3,{up:['fire',1],d:'Upgrades Fire Ship.'});
defT('heavydemo','Heavy Demolition Ship',C(200,0,300),30,'dock',3,{up:['demo',1],d:'Upgrades Demolition Ship.'});
defT('careening','Careening',C(250,0,150),30,'dock',2,{tcap:5,d:'Transport ships carry +5 units.'});
// civ unique techs (resolved at runtime by civ)
const UTECH={
 yeomen:{n:'Yeomen',m:[['arc','rng',1],['tower','atk',1]]},warwolf:{n:'Warwolf',m:[['siege','atk',20]]},
 bearded:{n:'Bearded Axe',m:[['uu','rng',2]]},chivalry:{n:'Chivalry',m:[['knight','hp',10],['knight','atk',2]]},
 anarchy:{n:'Anarchy',m:[['uu','hpMul',.1]],train:{barracks:.85}},perfusion:{n:'Perfusion',m:[['inf','hp',10]]},
 logistica:{n:'Logistica',m:[['uu','atk',3]]},greekfire:{n:'Greek Fire',m:[['fire','rng',1],['warship','pa',1]]},
 yasama:{n:'Yasama',m:[['tower','atk',2]]},kataparuto:{n:'Kataparuto',m:[['siege','rof',-.2]]},
 nomads:{n:'Nomads',m:[['uu','spd',.1]]},drill:{n:'Drill',m:[['siege','spd',.15]]},
 chieftains:{n:'Chieftains',m:[['inf','hp',10]],bonInf:1},berserkergang:{n:'Berserkergang',regen:1},
 madrasah:{n:'Madrasah',m:[['mon','hp',5]]},zealotry:{n:'Zealotry',m:[['cav','hp',15]]},
 ironclad:{n:'Ironclad',m:[['siege','ma',4],['ship','ma',3]]},crenellations:{n:'Crenellations',m:[['bld','rng',1]]},
 greatwall:{n:'Great Wall',m:[['wall','hpMul',.3],['tower','hpMul',.3]]},rocketry:{n:'Rocketry',m:[['siege','atk',4],['arc','atk',1]]},
};
const CMAP={infantry:'inf'};
// Helpers
function costStr(c){return RK.filter(k=>c[k]).map(k=>c[k]+' '+RN[k]).join(', ')}
defT('uniq2','Imperial Unique Tech',C(600,0,400),40,'castle',3,{req:'uniq',ico:'star',d:'Second civilization unique technology.'});
B.castle.techs.push('uniq2');
