// Headless smoke test of the core sim: villagers gather, build a house, train units.
import { Game } from '../js/sim/game.js';
import * as C from '../js/sim/commands.js';

const game = new Game({ mapType: 'highlands', mapSize: 88, seed: 4242, players: [{ civ: 'britons' }, { civ: 'franks' }], startRes: 'standard' });
game.collectEvents = false;
const me = game.players[1];
const tc = game.buildings.find(b => b.owner === 1 && b.type === 'town_center');
console.log('start: units', game.units.filter(u => u.owner === 1).length, 'tc at', tc.x, tc.y, 'res', JSON.stringify(me.res), 'pop', me.pop, '/', me.popCap);
const vills = game.units.filter(u => u.owner === 1 && u.type === 'villager');
// assign: 1 to wood, 1 to berries, 1 builds a house
const tree = game.findNearestResource(tc.x, tc.y, 'wood', 30);
const berry = game.findNearestResource(tc.x, tc.y, 'food', 30, { sub: 'berries' });
console.log('tree', tree && [tree.tx, tree.ty], 'berry', berry && [berry.tx, berry.ty]);
C.orderGather(game, [vills[0]], tree);
// mill + berries
let mill = null;
for (let dx = -8; dx < 8 && !mill; dx++) for (let dy = -8; dy < 8 && !mill; dy++) { const bx = Math.round(berry.tx + dx), by = Math.round(berry.ty + dy); if (C.canPlace(game, 1, 'mill', bx, by).ok) mill = C.placeBuilding(game, 1, 'mill', bx, by, [vills[1]]); }
console.log('mill', mill && [mill.tx, mill.ty]);
let house = null;
for (let dx = -8; dx < 8 && !house; dx++) for (let dy = 4; dy < 9 && !house; dy++) { const bx = Math.round(tc.x + dx), by = Math.round(tc.y + dy); if (C.canPlace(game, 1, 'house', bx, by).ok) house = C.placeBuilding(game, 1, 'house', bx, by, [vills[2]]); }
console.log('house', house && [house.tx, house.ty]);
C.queueUnit(game, tc, 'villager', 3);
const t0 = performance.now();
for (let i = 0; i < 20 * 120; i++) {      // 120 game seconds
  game.update();
  if (i % 400 === 0) console.log(`t=${game.time.toFixed(0)} res=${Object.values(me.res).map(v => v.toFixed(0)).join('/')} pop=${me.pop}/${me.popCap} house=${house.built ? 'done' : (house.progress*100).toFixed(0)+'%'} mill=${mill.built ? 'done' : (mill.progress*100).toFixed(0)+'%'} vills=${game.units.filter(u => u.owner===1 && u.type==='villager').map(u => (u.order ? u.order.type + ':' + (u.order.phase||'') : 'idle')).join(',')}`);
}
console.log('sim ms for 120s:', (performance.now() - t0).toFixed(0), 'path stats', JSON.stringify(game.nav.stats));
