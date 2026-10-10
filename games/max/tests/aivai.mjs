// Headless AI vs AI simulation: prints a timeline so we can tune the opponent. Usage: node tests/aivai.mjs [minutes] [difficulty] [seed] [mapType] [civA] [civB]
import { Game } from '../js/sim/game.js';
const minutes = +(process.argv[2] || 30), diff = process.argv[3] || 'standard', seed = +(process.argv[4] || 1), mapType = process.argv[5] || 'highlands';
const civA = process.argv[6] || 'britons', civB = process.argv[7] || 'franks';
const game = new Game({ mapType, mapSize: +(process.env.SIZE || 120), seed, players: [{ civ: civA, isAI: true, name: 'A', difficulty: diff }, { civ: civB, isAI: true, name: 'B', difficulty: diff }], startRes: 'standard' });
game.collectEvents = false; game.humanIndex = 1;
const t0 = performance.now();
const line = () => {
  const out = [`t=${String(Math.floor(game.time / 60)).padStart(2)}:${String(Math.floor(game.time % 60)).padStart(2, '0')}`];
  for (const p of game.players.slice(1)) {
    const vills = game.units.filter(u => u.owner === p.index && u.type === 'villager' && !u.dead).length;
    const mil = game.units.filter(u => u.owner === p.index && u.def.military && !u.dead).length;
    const bl = game.buildings.filter(b => b.owner === p.index && !b.dead);
    const ai = game.ais.find(a => a.idx === p.index);
    out.push(`P${p.index}[${p.civ.slice(0, 3)} age${p.age} v${vills} m${mil} pop${p.pop}/${p.popCap} b${bl.length} ${Object.values(p.res).map(v => Math.floor(v)).join('/')} w:${ai.wave.state[0]}${ai.waves}]`);
  }
  console.log(out.join('  '));
};
let nextPrint = 0;
for (let i = 0; i < minutes * 60 * 20; i++) {
  game.update();
  if (game.time >= nextPrint) { line(); nextPrint += 120; }
  if (game.over) { console.log('GAME OVER', JSON.stringify(game.result)); break; }
}
line();
const ms = performance.now() - t0;
console.log(`sim wall ${ms.toFixed(0)} ms for ${(game.time / 60).toFixed(1)} game-min; path ${JSON.stringify(game.nav.stats)}`);
for (const p of game.players.slice(1)) console.log(p.name, JSON.stringify({ kills: p.stats.kills, losses: p.stats.losses, razed: p.stats.razings, trained: p.stats.unitsTrained, gathered: Object.fromEntries(Object.entries(p.stats.gathered).map(([k, v]) => [k, Math.round(v)])), techs: p.stats.techsResearched }));
