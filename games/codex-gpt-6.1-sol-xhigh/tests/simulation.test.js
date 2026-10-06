import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, BUILDINGS, UNITS, SIZE, terrain } from '../src/game.js';
const run = (g, seconds) => { for (let t = 0; t < seconds; t += .1) g.update(.1); };
const fund = g => { g.players[0].resources = { food: 10000, wood: 10000, gold: 10000, stone: 10000 }; };
const tc = g => g.own(0, 'building').find(b => b.type === 'towncenter');
test('All four resources are gathered and deposited by actual villagers', () => {
  const g = new Game('peaceful'), before = { ...g.players[0].resources }; g.updateAI = () => {};
  run(g, 70);
  for (const r of ['food', 'wood', 'gold', 'stone']) assert.ok(g.players[0].resources[r] > before[r], `${r} is not increasing`);
  assert.ok(g.players[0].stats.gathered > 400);
});
test('Training deducts costs, produces working villagers, and respects capacity', () => {
  const g = new Game(); g.updateAI = () => {}; const before = g.players[0].resources.food;
  assert.ok(g.enqueue(tc(g), 'villager')); assert.equal(g.players[0].resources.food, before - 50);
  run(g, 13); assert.equal(g.pop(0).units, 9); assert.equal(g.players[0].stats.trained, 1);
  const u = g.own(0, 'unit').at(-1); assert.equal(u.type, 'villager'); assert.equal(u.order.type, 'gather');
  fund(g); for (let i = 0; i < 11; i++) g.unit('militia', 20 + i * .1, 25);
  assert.equal(g.enqueue(tc(g), 'villager'), false);
});
test('Cancelling a queue refunds the correct resources', () => {
  const g = new Game(), before = { ...g.players[0].resources }; g.enqueue(tc(g), 'villager'); g.cancelQueue(tc(g));
  assert.deepEqual(g.players[0].resources, before); assert.equal(tc(g).queue.length, 0);
});
test('Construction requires a worker, clear land, and resources, then finishes', () => {
  const g = new Game(); g.updateAI = () => {}; fund(g);
  const worker = g.own(0, 'unit').find(u => u.type === 'villager');
  assert.equal(g.construct('house', 16, 25, [worker]), false);
  assert.equal(g.construct('house', 40, 38, [worker]), false);
  assert.equal(g.construct('house', 21, 25, []), false);
  let spot; for (let y = 22; y < 33 && !spot; y++) for (let x = 13; x < 25; x++) if (g.validPlacement('barracks', x, y)) { spot = { x, y }; break; }
  assert.ok(spot); const b = g.construct('barracks', spot.x, spot.y, [worker]); assert.ok(b); assert.equal(worker.order.type, 'build');
  run(g, 50); assert.equal(b.progress, 1); assert.equal(b.hp, b.maxHp); assert.equal(g.players[0].stats.built, 1);
});
test('Age progression gates units and requires appropriate buildings', () => {
  const g = new Game(); g.updateAI = () => {}; fund(g); const base = tc(g);
  const range = g.building('archery', 22, 25); assert.equal(g.enqueue(range, 'archer'), false);
  assert.ok(g.enqueue(base, 'age', 'age')); assert.equal(g.enqueue(base, 'age', 'age'), false); run(g, 46); assert.equal(g.players[0].age, 1);
  assert.ok(g.enqueue(range, 'archer')); assert.equal(g.enqueue(base, 'age', 'age'), false);
  g.building('blacksmith', 22, 28); assert.ok(g.enqueue(base, 'age', 'age')); run(g, 61); assert.equal(g.players[0].age, 2);
  assert.equal(g.enqueue(base, 'age', 'age'), false); g.building('siege', 28, 20); assert.ok(g.enqueue(base, 'age', 'age')); run(g, 76); assert.equal(g.players[0].age, 3);
});
test('Research updates existing villagers and the economy', () => {
  const g = new Game(); g.updateAI = () => {}; fund(g); assert.ok(g.enqueue(tc(g), 'loom', 'tech')); run(g, 21);
  assert.ok(g.players[0].techs.includes('loom')); assert.ok(g.own(0, 'unit').filter(u => u.type === 'villager').every(u => u.maxHp === 70));
  assert.equal(g.enqueue(tc(g), 'loom', 'tech'), false);
});
test('Paths avoid buildings and water', () => {
  const g = new Game(); const path = g.findPath({ x: 15, y: 25 }, { x: 20, y: 28 }, true), blocks = g.blockGrid(); assert.ok(path.length);
  path.forEach(p => { assert.equal(terrain(p.x, p.y), 'grass'); assert.equal(blocks[Math.floor(p.y) * SIZE + Math.floor(p.x)], 0); });
});
test('Combat applies cavalry counters and siege resistance', () => {
  const g = new Game(); g.players[0].age = 1;
  const spear = g.unit('spearman', 28, 20), knight = g.unit('knight', 29, 20, 1); const hp = knight.hp; g.damage(spear, knight, UNITS.spearman.attack); assert.ok(hp - knight.hp > 18);
  const archer = g.unit('archer', 28, 20), ram = g.unit('ram', 29, 20, 1); g.damage(archer, ram, 7, true); assert.equal(ram.hp, ram.maxHp - 1);
});
test('Destroying the rival Town Center ends the game in victory', () => {
  const g = new Game(); g.updateAI = () => {}; const rival = g.own(1, 'building').find(b => b.type === 'towncenter');
  const ram = g.unit('ram', rival.x - .7, rival.y + 1); rival.hp = 60; g.order(ram, { type: 'attack', target: rival.id }); run(g, 3);
  assert.equal(g.result, 'victory'); assert.equal(g.paused, true); assert.equal(rival.alive, false);
});
test('Saving restores queues, tasks, resources, and fog', () => {
  const g = new Game(); g.enqueue(tc(g), 'villager'); run(g, 7); const restored = Game.restore(g.serialize());
  assert.equal(restored.time, g.time); assert.deepEqual(restored.players, g.players); assert.equal(tc(restored).queue.length, 1); assert.deepEqual(restored.explored, g.explored);
  restored.updateAI = () => {}; run(restored, 7); assert.equal(restored.pop(0).units, 9);
});
test('The computer develops a real economy and sends a raid', () => {
  const g = new Game('standard'); run(g, 250);
  assert.ok(g.players[1].stats.gathered > 1000); assert.ok(g.players[1].stats.trained >= 8); assert.ok(g.raids >= 1); assert.ok(g.players[1].age >= 1);
});
test('Workers deposit their final load when a resource is exhausted', () => {
  const g = new Game(); g.updateAI = () => {}; const u = g.own(0, 'unit').find(u => u.type === 'villager');
  const resource = g.get(u.order.target); const before = g.players[0].resources.wood;
  resource.alive = false; u.carry = 12; u.carryType = 'wood'; u.order.phase = 'gather'; run(g, 20);
  assert.ok(g.players[0].resources.wood >= before + 12);
});
test('Fresh and existing troops have consistent health after age advancement', () => {
  const g = new Game(); g.updateAI = () => {}; fund(g);
  const militia = g.unit('militia', 21, 27); g.enqueue(tc(g), 'age', 'age'); run(g, 46);
  const fresh = g.unit('militia', 22, 27); assert.equal(fresh.maxHp, militia.maxHp); assert.equal(fresh.maxHp, 80);
});
test('Rams automatically prefer buildings over cavalry', () => {
  const g = new Game(); g.players[0].age = 2;
  const ram = g.unit('ram', 30, 13), knight = g.unit('knight', 30.5, 13, 1); g.updateFog();
  const enemy = g.nearestEnemy(ram, 7); assert.equal(enemy.kind, 'building'); assert.notEqual(enemy.id, knight.id);
});
test('Expansion Town Centers unlock in the Castle Age and extend defeat conditions', () => {
  const g = new Game(); fund(g); const u = g.own(0, 'unit').find(u => u.type === 'villager');
  assert.equal(g.construct('towncenter', 16, 18, [u]), false);
  g.players[0].age = 2; const expansion = g.building('towncenter', 16, 18); const original = tc(g); g.kill(original);
  assert.equal(g.result, null); g.kill(expansion); assert.equal(g.result, 'defeat');
});
