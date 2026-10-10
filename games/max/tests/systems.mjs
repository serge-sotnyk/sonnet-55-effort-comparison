// Headless checks of assorted systems: monks, walls/gates, market, population cap, rally points, farms, garrison.
import { Game } from '../js/sim/game.js';
import * as Cmd from '../js/sim/commands.js';
import { completeResearch } from '../js/sim/buildingai.js';

function arena(seed = 3, civA = 'britons', civB = 'franks') {
  const game = new Game({ mapType: 'meadows', mapSize: 88, seed, players: [{ civ: civA }, { civ: civB }], startRes: 'standard' });
  game.collectEvents = false;
  for (const u of game.units) if (u.owner > 0) { u.dead = true; game.players[u.owner].pop--; }
  for (const b of game.buildings) if (b.owner > 0) { b.dead = true; }
  game._compact(); game.over = true; game.keepSimulating = true; game.checkVictory = () => {};
  // remove trees/mines near the test field so spawns are never blocked
  for (const r of game.resources) if (Math.hypot(r.x - 44, r.y - 44) < 14) game.removeResource(r);
  game._compact();
  return game;
}
const spawn = (game, type, owner, cx, cy, n) => { const out = []; for (let i = 0; i < n; i++) out.push(game.spawnUnit(type, owner, cx + (i % 5) * 0.9, cy + Math.floor(i / 5) * 0.9)); return out; };
const run = (game, secs) => { for (let i = 0; i < secs * 20; i++) game.update(); };
const alive = (game, o) => game.units.filter(u => u.owner === o && !u.dead);
let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  — ' + extra : '')); if (!ok) fails++; };

// ---- monks convert
{
  const game = arena();
  const monks = spawn(game, 'monk', 1, 36, 44, 3);
  const knights = spawn(game, 'knight', 2, 44, 44, 4);
  knights.forEach(k => k.stance = 'passive');
  Cmd.orderConvert(game, monks, knights[0]);
  run(game, 30);
  const converted = knights.filter(k => k.owner === 1).length;
  check('monk converts an enemy knight', converted >= 1, `${converted}/4 knights now owned by P1; P1 pop ${game.players[1].pop} P2 pop ${game.players[2].pop}`);
}
// ---- monks heal
{
  const game = arena();
  const monk = spawn(game, 'monk', 1, 40, 44, 1)[0];
  const hurt = spawn(game, 'militia', 1, 42, 44, 3); hurt.forEach(u => { u.hp = 5; u.stance = 'passive'; });
  run(game, 100);
  const avg = hurt.reduce((s, u) => s + u.hp, 0) / hurt.length;
  check('monk heals wounded allies', avg > 25, `avg hp ${avg.toFixed(1)} / 40`);
}
// ---- walls + gates block enemies, let owner through (a closed ring with one gate)
{
  const game = arena();
  game.vision.reveal = true; game.vision.update(true);
  const p1 = game.players[1]; p1.age = 1; p1.res.stone = 3000;
  const ring = [];
  for (let i = 38; i <= 48; i++) { ring.push([i, 38]); ring.push([i, 48]); }
  for (let j = 39; j <= 47; j++) { ring.push([38, j]); ring.push([48, j]); }
  const gateTile = [43, 48];
  const wall = Cmd.placeWall(game, 1, 'stone_wall', ring.filter(t => !(t[0] === gateTile[0] && t[1] === gateTile[1])), [], {});
  const gate = Cmd.placeBuilding(game, 1, 'gate', gateTile[0], gateTile[1], [], {});
  for (const b of game.buildings) if (b.owner === 1 && !b.built) { b.built = true; b.progress = 1; b.hp = b.maxHp; }
  game.nav.regionDirty = true;
  check('wall ring + gate placed', wall.length >= ring.length - 3 && !!gate, `${wall.length} segments + gate`);
  const ownerPath = game.nav.findPath(43, 43, { x: 43, y: 52 }, 1);
  const enemyPath = game.nav.findPath(43, 43, { x: 43, y: 52 }, 2);
  check('owner can leave through the gate', ownerPath.complete && ownerPath.pts.length > 0);
  check('enemy is sealed in by walls and gate', !enemyPath.complete, `enemy path complete=${enemyPath.complete}`);
  // rams breach walls when ordered to
  const inside = spawn(game, 'militia', 2, 42, 42, 1)[0];
  const rams = spawn(game, 'ram', 2, 42, 44, 2);
  const target = wall.find(b => b.tx === 38 && b.ty === 43) || wall[0];
  Cmd.orderAttack(game, rams, target);
  run(game, 60);
  check('rams can breach a stone wall segment', target.dead, `wall hp ${target.hp.toFixed(0)}/${target.maxHp}`);
}
// ---- market
{
  const game = arena();
  const p = game.players[1]; p.age = 1; p.res.wood = 1000; p.res.gold = 0;
  const m = game.spawnBuilding('market', 1, 40, 40, { built: true });
  const g0 = p.res.gold;
  Cmd.trade(game, 1, 'wood', 'sell', 100);
  const gained = p.res.gold - g0;
  const p2 = Cmd.marketPrices(game, p, 'wood');
  Cmd.trade(game, 1, 'wood', 'buy', 100);
  check('market sell yields gold with a fee (<100)', gained > 50 && gained < 100, `sold 100 wood for ${gained} gold; next buy price ${p2.buy}`);
}
// ---- population cap stalls production, houses unlock
{
  const game = arena();
  const tc = game.spawnBuilding('town_center', 1, 40, 40, { built: true });
  const p = game.players[1]; p.res.food = 1000; p.pop = 5;
  Cmd.queueUnit(game, tc, 'villager', 3);
  run(game, 40);
  const stalled = tc.queue.length > 0 && tc.queue[0].blocked;
  check('production stalls at the population cap', stalled || alive(game, 1).length === 0, `queue ${tc.queue.length}, blocked ${tc.queue[0] && tc.queue[0].blocked}, pop ${p.pop}/${p.popCap}`);
  game.spawnBuilding('house', 1, 46, 40, { built: true });
  run(game, 80);
  check('houses lift the cap and production resumes', tc.queue.length === 0, `queue ${tc.queue.length}, pop ${p.pop}/${p.popCap}`);
}
// ---- rally to resource -> gather
{
  const game = new Game({ mapType: 'highlands', mapSize: 88, seed: 7, players: [{ civ: 'britons' }, { civ: 'franks' }], startRes: 'high' });
  game.collectEvents = false; game.over = true; game.keepSimulating = true; game.checkVictory = () => {};
  const tc = game.buildings.find(b => b.owner === 1 && b.type === 'town_center');
  game.spawnBuilding('house', 1, tc.tx + 6, tc.ty + 6, { built: true });
  const tree = game.findNearestResource(tc.x, tc.y, 'wood', 30);
  Cmd.setRally(game, tc, tree.x, tree.y, tree.id);
  Cmd.queueUnit(game, tc, 'villager', 2);
  run(game, 80);
  const newV = game.units.filter(u => u.owner === 1 && u.type === 'villager').slice(-2);
  check('new villagers rally to a tree and gather', newV.every(v => v.order && v.order.type === 'gather'), newV.map(v => v.order && v.order.type + ':' + v.order.phase).join(','));
}
// ---- farms: build, farm, reseed
{
  const game = new Game({ mapType: 'highlands', mapSize: 88, seed: 7, players: [{ civ: 'britons' }, { civ: 'franks' }], startRes: 'high' });
  game.collectEvents = false; game.over = true; game.keepSimulating = true; game.checkVictory = () => {};
  const tc = game.buildings.find(b => b.owner === 1 && b.type === 'town_center');
  const vill = game.units.find(u => u.owner === 1 && u.type === 'villager');
  const mill = game.spawnBuilding('mill', 1, tc.tx + 5, tc.ty - 4, { built: true });
  let farm = null; for (let r = 4; r < 9 && !farm; r++) for (let a = 0; a < 12 && !farm; a++) { const tx = Math.round(tc.x + Math.cos(a / 12 * 6.28) * r - 1.5), ty = Math.round(tc.y + Math.sin(a / 12 * 6.28) * r - 1.5); if (Cmd.canPlace(game, 1, 'farm', tx, ty).ok) farm = Cmd.placeBuilding(game, 1, 'farm', tx, ty, [vill]); }
  run(game, 120);
  const f0 = game.players[1].stats.gathered.food;
  check('villager builds a farm then farms it (auto)', farm && farm.built && vill.order && vill.order.type === 'gather', `farm built=${farm && farm.built} order=${vill.order && vill.order.type}`);
  run(game, 300);
  check('farm yields food over time', game.players[1].stats.gathered.food - f0 > 40, `+${(game.players[1].stats.gathered.food - f0).toFixed(0)} food in 5 min, amount left ${farm.amount.toFixed(0)}`);
}
// ---- garrisoning heals and adds arrows
{
  const game = arena();
  const tc = game.spawnBuilding('town_center', 1, 40, 40, { built: true });
  const archers = spawn(game, 'archer', 1, 38, 46, 10);
  Cmd.orderGarrison(game, archers, tc);
  run(game, 20);
  check('archers garrison inside the TC', tc.garrison.length === 10, `${tc.garrison.length}/10`);
  const foes = spawn(game, 'militia', 2, 56, 44, 15);
  foes.forEach(f => Cmd.orderMove(game, [f], 42, 44, { attackMove: true }));
  run(game, 30);
  check('garrisoned TC (11 arrows) kills attackers', alive(game, 2).length < 8, `${alive(game, 2).length}/15 militia left`);
}
console.log(fails ? `\n${fails} FAILED` : '\nall system checks passed');
process.exit(fails ? 1 : 0);
