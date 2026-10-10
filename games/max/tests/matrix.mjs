// Difficulty matrix: does a stronger AI beat a weaker one? Usage: node tests/matrix.mjs [minutes]
import { Game } from '../js/sim/game.js';
const minutes = +(process.argv[2] || 40);
const pairs = [['hard', 'easy'], ['standard', 'easy'], ['hard', 'standard'], ['brutal', 'standard'], ['brutal', 'hard']];
const civsA = ['britons', 'franks', 'goths', 'mongols'];
for (const [a, b] of pairs) {
  let wins = [0, 0], draws = 0; const times = []; const dmg = [];
  for (let seed = 1; seed <= 3; seed++) {
    const ca = civsA[(seed + 0) % 4], cb = civsA[(seed + 2) % 4];
    const g = new Game({ mapType: ['highlands', 'meadows', 'lakeland'][seed % 3], mapSize: 104, seed: 500 + seed, players: [{ civ: ca, isAI: true, name: 'A', difficulty: a }, { civ: cb, isAI: true, name: 'B', difficulty: b }], startRes: 'standard' });
    g.collectEvents = false; g.humanIndex = 1;
    let end = null;
    for (let i = 0; i < minutes * 60 * 20; i++) { g.update(); if (g.over) { end = g.result; break; } }
    if (end) { if (end.won) wins[0]++; else wins[1]++; times.push((g.time / 60).toFixed(0)); } else draws++;
    const P1 = g.players[1], P2 = g.players[2];
    dmg.push(`${P1.stats.kills}k/${P1.stats.razings}r vs ${P2.stats.kills}k/${P2.stats.razings}r`);
  }
  console.log(`${a.padEnd(8)} vs ${b.padEnd(8)}  first wins ${wins[0]}  second wins ${wins[1]}  unresolved ${draws}  end minutes [${times.join(',')}]  kills/razed ${dmg.join(' | ')}`);
}
