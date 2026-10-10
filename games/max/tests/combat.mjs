// Headless combat scenarios: verifies counters, ranges, siege, arrows, monks and garrison behave sensibly.
import { Game } from '../js/sim/game.js';
import * as Cmd from '../js/sim/commands.js';

function arena(seed = 3) {
  const game = new Game({ mapType: 'meadows', mapSize: 88, seed, players: [{ civ: 'britons' }, { civ: 'franks' }], startRes: 'standard' });
  game.collectEvents = false;
  // clear starting units/buildings of both players so only the test units fight
  for (const u of game.units) if (u.owner > 0) { u.dead = true; game.players[u.owner].pop--; }
  for (const b of game.buildings) if (b.owner > 0) b.dead = true;
  game._compact();
  game.over = true; game.keepSimulating = true;       // no victory checks (nobody has buildings)
  game.checkVictory = () => {};
  return game;
}
function spawn(game, type, owner, cx, cy, n, spread = 3) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(game.spawnUnit(type, owner, cx + (i % 5) * 0.9 - 2 + Math.random() * 0.3, cy + Math.floor(i / 5) * 0.9 + Math.random() * 0.3));
  return out;
}
function run(game, secs) { for (let i = 0; i < secs * 20; i++) game.update(); }
function alive(game, owner) { return game.units.filter(u => u.owner === owner && !u.dead); }

function duel(name, specA, specB, secs = 120, upgrades = {}) {
  const game = arena();
  const cx = 44, cy = 44;
  let A = [], B = [];
  for (const [t, n] of specA) A = A.concat(spawn(game, t, 1, cx - 8, cy, n));
  for (const [t, n] of specB) B = B.concat(spawn(game, t, 2, cx + 8, cy, n));
  Cmd.orderMove(game, A, cx, cy, { attackMove: true, noCap: true });
  Cmd.orderMove(game, B, cx, cy, { attackMove: true, noCap: true });
  run(game, secs);
  const a = alive(game, 1), b = alive(game, 2);
  const hpA = a.reduce((s, u) => s + u.hp, 0).toFixed(0), hpB = b.reduce((s, u) => s + u.hp, 0).toFixed(0);
  console.log(`${name.padEnd(46)} A(${specA.map(x => x.join('x')).join('+')}) left ${a.length}  vs  B(${specB.map(x => x.join('x')).join('+')}) left ${b.length}   [hp ${hpA}/${hpB}] t=${game.time.toFixed(0)}s`);
  return { a: a.length, b: b.length };
}

console.log('--- unit matchups (A = Britons, B = Franks; both aggressive attack-move) ---');
duel('militia vs militia (even)', [['militia', 10]], [['militia', 10]]);
duel('10 spearmen vs 6 knights (spears should win)', [['spearman', 10]], [['knight', 6]]);
duel('6 knights vs 10 archers (knights should win)', [['knight', 6]], [['archer', 10]]);
duel('10 archers vs 10 militia (archers should win)', [['archer', 10]], [['militia', 10]]);
duel('10 skirmishers vs 10 archers (skirmishers win)', [['skirmisher', 10]], [['archer', 10]]);
duel('8 camels vs 6 knights (camels win)', [['camel', 8]], [['knight', 6]]);
duel('10 champions vs 20 militia', [['champion', 10]], [['militia', 20]]);
duel('3 mangonels+6 spear vs 20 militia', [['mangonel', 3], ['spearman', 6]], [['militia', 20]]);
duel('10 huskarl vs 15 archers (huskarl win)', [['huskarl', 10]], [['archer', 15]]);
duel('5 scorpions vs 15 militia', [['scorpion', 5]], [['militia', 15]]);

// ---------------- siege vs buildings
{
  const game = arena();
  const tc = game.spawnBuilding('town_center', 2, 50, 40, { built: true });
  const rams = spawn(game, 'ram', 1, 30, 42, 4);
  Cmd.orderAttack(game, rams, tc);
  let t = 0; for (; t < 400 * 20 && !tc.dead; t++) game.update();
  console.log(`4 rams vs Town Center: destroyed=${tc.dead} after ${(t / 20).toFixed(0)}s (rams left ${alive(game, 1).length})`);
}
{
  const game = arena();
  const tc = game.spawnBuilding('town_center', 2, 50, 40, { built: true });
  const inf = spawn(game, 'champion', 1, 30, 42, 10);
  Cmd.orderAttack(game, inf, tc);
  let t = 0; for (; t < 400 * 20 && !tc.dead; t++) game.update();
  console.log(`10 champions vs Town Center: destroyed=${tc.dead} after ${(t / 20).toFixed(0)}s, hp left ${tc.hp.toFixed(0)}; champions left ${alive(game, 1).length} (TC arrows shoot them)`);
}
{
  const game = arena();
  const tc = game.spawnBuilding('town_center', 2, 50, 40, { built: true });
  const treb = spawn(game, 'trebuchet', 1, 30, 42, 2);
  Cmd.orderAttack(game, treb, tc);
  let t = 0; for (; t < 400 * 20 && !tc.dead; t++) game.update();
  console.log(`2 trebuchets vs Town Center: destroyed=${tc.dead} after ${(t / 20).toFixed(0)}s`);
}
// ---------------- TC arrows & garrison
{
  const game = arena();
  const tc = game.spawnBuilding('town_center', 2, 50, 40, { built: true });
  const vills = spawn(game, 'villager', 2, 52, 38, 10);
  Cmd.orderGarrison(game, vills, tc);
  const enemy = spawn(game, 'militia', 1, 62, 44, 10);
  Cmd.orderMove(game, enemy, 51, 45, { attackMove: true });
  run(game, 40);
  console.log(`TC with 10 garrisoned villagers vs 10 militia: garrison=${tc.garrison.length} militia left ${alive(game, 1).length} (arrows should thin them out)`);
}
// ---------------- monks
{
  const game = arena();
  const monks = spawn(game, 'monk', 1, 36, 44, 3);
  const knights = spawn(game, 'knight', 2, 46, 44, 5);
  game.players[1].res.gold = 0;
  Cmd.orderConvert(game, monks, knights[0]);
  run(game, 40);
  console.log(`3 monks vs 5 knights: knights converted → P1 units ${alive(game, 1).length}, P2 ${alive(game, 2).length}`);
  const hurt = spawn(game, 'militia', 1, 36, 46, 4); hurt.forEach(u => u.hp = 5);
  run(game, 40);
  console.log(`monks heal wounded militia: avg hp ${(hurt.reduce((s, u) => s + u.hp, 0) / hurt.length).toFixed(1)} / ${hurt[0].maxHp}`);
}
// ---------------- upgrades
{
  const game = arena();
  const p = game.players[1];
  const m = spawn(game, 'militia', 1, 30, 30, 5);
  const before = m[0].def.atk.melee;
  p.age = 2;
  const { completeResearch } = await import('../js/sim/buildingai.js');
  completeResearch(game, p, 'forging'); completeResearch(game, p, 'man_at_arms'); completeResearch(game, p, 'long_swordsman'); completeResearch(game, p, 'loom');
  console.log(`militia→long swordsman via upgrades: type ${m[0].type} atk ${before}→${m[0].def.atk.melee} hp ${m[0].maxHp} ; new villager hp ${spawn(game, 'villager', 1, 31, 31, 1)[0].maxHp}`);
}
