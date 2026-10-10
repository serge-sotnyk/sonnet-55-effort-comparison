// AI pacing benchmark: when does each AI difficulty reach each age, and how many villagers/soldiers does it have at key times?
import { Game } from '../js/sim/game.js';
const diffs = (process.argv[2] || 'standard').split(',');
const seeds = [11, 22, 33, 44, 55, 66];
const maps = ['highlands', 'meadows', 'blackforest', 'lakeland'];
for (const diff of diffs) {
  const rows = [];
  for (const seed of seeds) {
    const game = new Game({ mapType: maps[seed % 4], mapSize: 104, seed, players: [{ civ: ['britons', 'franks', 'goths', 'mongols'][seed % 4], isAI: true, name: 'A', difficulty: diff }, { civ: 'franks', isAI: false, name: 'idle' }], startRes: 'standard' });
    game.collectEvents = false; game.humanIndex = 2;
    const ai = game.ais[0], p = game.players[1];
    const t = {}; const snap = {};
    for (let i = 0; i < 26 * 60 * 20; i++) {
      game.update();
      const m = game.time / 60;
      if (p.age >= 1 && !t.f) t.f = m; if (p.age >= 2 && !t.c) t.c = m; if (p.age >= 3 && !t.i) t.i = m;
      for (const k of [10, 15, 20, 25]) if (m >= k && !snap[k]) snap[k] = `${ai.state.vills.length}v/${ai.state.mil.length}m`;
    }
    rows.push(`seed ${seed} ${maps[seed % 4].slice(0, 5)}: Feudal ${t.f ? t.f.toFixed(1) : '--'} Castle ${t.c ? t.c.toFixed(1) : '--'} Imp ${t.i ? t.i.toFixed(1) : '--'} | 10m ${snap[10]} 15m ${snap[15]} 20m ${snap[20]} 25m ${snap[25]}`);
  }
  console.log(`== ${diff}\n` + rows.join('\n'));
}
