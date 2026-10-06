import { BUILDINGS, UNITS, AGE_COSTS, distance, center } from '../src/game.js';
// Exercises a complete match using only orders, paid queues, and paid construction.
export function playCampaign(game, limit = 1100) {
  const base = () => game.own(0, 'building').find(b => b.type === 'towncenter');
  let launched = false; const log = [];
  const build = type => {
    if (!game.canAfford(0, BUILDINGS[type].cost)) return false;
    const workers = game.own(0, 'unit').filter(u => u.type === 'villager' && !['build', 'repair'].includes(u.order.type));
    if (!workers.length) return false;
    const spots = [];
    for (let y = 16; y <= 37; y++) for (let x = 8; x <= 25; x++) if (game.validPlacement(type, x, y) && game.explored[y * 48 + x]) spots.push({ x, y });
    const preferred = type === 'castle' ? { x: 16, y: 19 } : type === 'miningcamp' ? { x: 19, y: 23 } : type === 'tower' ? { x: 20, y: 27 } : { x: 18, y: 28 };
    spots.sort((a, b) => distance(a, preferred) - distance(b, preferred));
    const spot = spots[0]; if (!spot) return false;
    workers.sort((a, b) => distance(a, spot) - distance(b, spot));
    return game.construct(type, spot.x, spot.y, workers.slice(0, 2));
  };
  for (let tick = 0; tick < limit * 10 && !game.result; tick++) {
    game.update(.1);
    if (tick % 20) continue;
    const p = game.players[0], b = game.own(0, 'building'), units = game.own(0, 'unit'), villagers = units.filter(u => u.type === 'villager'), army = units.filter(u => u.type !== 'villager'), pop = game.pop(0), tc = base();
    const has = type => b.some(e => e.type === type), complete = type => b.find(e => e.type === type && e.progress >= 1);
    const want = type => !has(type) && build(type);
    if (!tc) break;
    if (tick % 600 === 0) log.push({ time: Math.floor(game.time), age: p.age, villagers: villagers.length, army: army.length, enemyAge: game.players[1].age, townHp: tc.hp });
    const targetRole = i => i < 7 ? 'food' : i < 12 ? 'wood' : i < 17 ? 'gold' : 'stone';
    villagers.forEach((u, i) => { if (!['build', 'repair', 'garrison', 'attack'].includes(u.order.type) && u.order.resource !== targetRole(i)) game.assignGather(u, targetRole(i)); });
    if (pop.units + pop.queued >= pop.cap - 3 && !b.some(e => e.type === 'house' && e.progress < 1)) build('house');
    if (villagers.length < 19 && tc.queue.length < 2 && game.canAfford(0, UNITS.villager.cost) && pop.units + pop.queued < pop.cap) game.enqueue(tc, 'villager');
    want('barracks');
    if (villagers.length >= 10) want('miningcamp');
    if (villagers.length >= 12 && b.filter(e => e.type === 'farm').length < 5 && !b.some(e => e.type === 'farm' && e.progress < 1)) build('farm');
    if (p.age >= 1) { want('archery'); want('blacksmith'); want('tower'); want('market'); }
    if (p.age >= 2) { want('siege'); want('castle'); }
    if (p.age < 3 && game.time > [135, 310, 600][p.age] && villagers.length >= 13 && !game.ageRequirements(0) && game.canAfford(0, AGE_COSTS[p.age]) && !b.some(e => e.queue.some(q => q.kind === 'age'))) game.enqueue(tc, 'age', 'age');
    for (const [building, type, cap] of [['barracks', 'militia', 8], ['barracks', 'spearman', 8], ['archery', 'archer', 14], ['siege', 'ram', 5]]) {
      const factory = complete(building); if (!factory || factory.queue.length > 1 || villagers.length < 10 || army.filter(u => u.type === type).length >= cap || game.pop(0).units + game.pop(0).queued >= game.pop(0).cap || !game.canAfford(0, UNITS[type].cost)) continue;
      if (p.age < UNITS[type].age) continue;
      game.enqueue(factory, type);
    }
    const forge = complete('blacksmith');
    if (forge && !p.techs.includes('forging') && !forge.queue.length && game.canAfford(0, { food: 120, gold: 50 })) game.enqueue(forge, 'forging', 'tech');
    if (forge && p.techs.includes('forging') && !p.techs.includes('fletching') && !forge.queue.length && game.canAfford(0, { food: 100, gold: 50 })) game.enqueue(forge, 'fletching', 'tech');
    if (complete('market') && p.resources.food > 2000 && p.resources.gold < 600) game.trade('food', false);
    const idleArmy = army.filter(u => u.order.type === 'idle');
    if (idleArmy.filter(u => u.type === 'ram').length >= 3 && idleArmy.length >= 18) {
      launched = true;
      const enemy = game.own(1, 'building').find(e => e.type === 'towncenter');
      if (enemy) game.moveGroup(idleArmy, enemy.x - 1, enemy.y + 1, true);
    }
  }
  return { result: game.result, time: game.time, log, player: game.players[0], enemy: game.players[1], launched };
}
