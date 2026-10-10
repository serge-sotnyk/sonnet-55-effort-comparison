// Sim stress test: big armies fighting + large economies; reports ms per tick.
import { Game } from '../js/sim/game.js';
import * as Cmd from '../js/sim/commands.js';
const game = new Game({ mapType: 'highlands', mapSize: 120, seed: 11, players: [{ civ: 'britons', isAI: true, difficulty: 'hard', name: 'A' }, { civ: 'franks', isAI: true, difficulty: 'hard', name: 'B' }], startRes: 'high' });
game.collectEvents = false;
// give both players huge pop room and resources, spawn big armies
for (const p of game.players.slice(1)) { p.res.food = p.res.wood = p.res.gold = p.res.stone = 50000; p.age = 3; p.recompute(); }
const mid = { x: game.w / 2, y: game.h / 2 };
const types = ['champion', 'arbalester', 'paladin', 'halberdier', 'mangonel', 'monk', 'hussar', 'longbowman', 'elite_skirmisher', 'camel'];
for (const p of game.players.slice(1)) {
  const st = p.startPos;
  for (let i = 0; i < 160; i++) {
    const t = types[i % types.length];
    const dx = (game.w / 2 - st.x), dy = (game.h / 2 - st.y), l = Math.hypot(dx, dy);
    const u = game.spawnUnit(t, p.index, st.x + dx / l * 12 + (i % 16) * 0.9 - 7, st.y + dy / l * 12 + Math.floor(i / 16) * 0.9 - 4);
    if (!game.nav.walkAt(u.x, u.y, p.index)) { u.x = st.x + 8; u.y = st.y + 8; }
  }
}
for (const u of game.units) if (u.owner > 0 && u.def.military) Cmd.orderMove(game, [u], mid.x, mid.y, { attackMove: true, noCap: true });
let worst = 0, total = 0, n = 0;
const t0 = performance.now();
for (let i = 0; i < 20 * 150; i++) {
  const a = performance.now(); game.update(); const d = performance.now() - a; total += d; n++; worst = Math.max(worst, d);
  if (i % 600 === 0) console.log(`t=${game.time.toFixed(0)}s units=${game.units.length} proj=${game.projectiles.length} avg tick ${(total / n).toFixed(2)}ms worst ${worst.toFixed(1)}ms  (P1 mil ${game.units.filter(u => u.owner === 1 && u.def.military && !u.dead).length}, P2 mil ${game.units.filter(u => u.owner === 2 && u.def.military && !u.dead).length})`);
}
console.log(`done: avg ${(total / n).toFixed(2)} ms/tick, worst ${worst.toFixed(1)} ms, nodes ${game.nav.stats.expanded}`);
