// Batch of AI-vs-AI games to catch exceptions, stalls and balance problems. Usage: node tests/sweep.mjs [minutes]
import { Game } from '../js/sim/game.js';
const minutes = +(process.argv[2] || 25);
const maps = ['highlands', 'blackforest', 'lakeland', 'meadows'];
const civs = ['britons', 'franks', 'goths', 'mongols'];
const diffs = ['easy', 'standard', 'hard', 'brutal'];
const configs = [];
let k = 0;
for (const map of maps) for (let i = 0; i < 2; i++) {
  const a = civs[(k++) % 4], b = civs[(k + 1) % 4];
  configs.push({ map, size: 96, players: [{ civ: a, difficulty: diffs[(k + 1) % 4] }, { civ: b, difficulty: diffs[(k + 2) % 4] }], seed: 100 + k });
}
configs.push({ map: 'highlands', size: 128, players: [{ civ: 'britons', difficulty: 'hard' }, { civ: 'goths', difficulty: 'hard' }, { civ: 'mongols', difficulty: 'hard' }], seed: 777 });
configs.push({ map: 'meadows', size: 152, players: [{ civ: 'franks', difficulty: 'standard' }, { civ: 'goths', difficulty: 'standard' }, { civ: 'mongols', difficulty: 'standard' }, { civ: 'britons', difficulty: 'standard' }], seed: 4242 });
let bad = 0;
for (const c of configs) {
  const t0 = performance.now();
  let err = null, game;
  try {
    game = new Game({ mapType: c.map, mapSize: c.size, seed: c.seed, players: c.players.map((p, i) => ({ civ: p.civ, isAI: true, name: 'AI' + (i + 1), difficulty: p.difficulty })), startRes: 'standard' });
    game.collectEvents = false;
    for (let i = 0; i < minutes * 60 * 20; i++) { game.update(); if (game.over) break; }
  } catch (e) { err = e; }
  const ms = performance.now() - t0;
  if (err) { bad++; console.log(`ERROR ${c.map}/${c.size} seed ${c.seed}:`, err.stack.split('\n').slice(0, 4).join(' | ')); continue; }
  const summary = game.players.slice(1).map(p => {
    const v = game.units.filter(u => u.owner === p.index && u.type === 'villager' && !u.dead).length;
    const m = game.units.filter(u => u.owner === p.index && u.def.military && !u.dead).length;
    return `${p.civ.slice(0, 3)}/${c.players[p.index - 1].difficulty[0]} age${p.age} v${v} m${m} k${p.stats.kills}${p.alive ? '' : ' DEAD'}`;
  }).join(' | ');
  const idle = game.ais.map(ai => ai.state.idleV.length).join(',');
  console.log(`${c.map.padEnd(11)} ${String(c.size).padEnd(3)} ${(game.time / 60).toFixed(0).padStart(2)}m ${ (ms / 1000).toFixed(1).padStart(5)}s  ${summary}   idleV[${idle}] ${game.over ? 'OVER:' + (game.result && game.result.won) : ''}`);
}
console.log(bad ? `${bad} configs crashed` : 'no crashes');
