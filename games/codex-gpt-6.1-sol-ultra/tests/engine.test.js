import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine.js';
import { AGE_COSTS, BUILDINGS, UNITS } from '../catalog.js';

const playerBuilding = (g, type) => g.entities.find(e => e.owner === 'player' && e.kind === 'building' && e.type === type);
const villagers = g => g.entities.filter(e => e.owner === 'player' && e.type === 'villager');
const clearSite = (g, type) => {
  for (let y = 25; y <= 43; y += 0.5) for (let x = 12; x <= 26; x += 0.5) if (g.canBuild(type, x, y).ok) return { x, y };
  throw new Error(`No clear site for ${type}`);
};
const grantResources = g => { g.resources = { wood: 20000, food: 20000, gold: 20000, stone: 20000 }; };

test('seeded world starts with a usable economy, fog and exactly one idle villager', () => {
  const a = new Game({ seed: 7 }), b = new Game({ seed: 7 });
  assert.equal(a.population, 7);
  assert.equal(a.populationCap, 15);
  assert.equal(a.idleVillagers, 1);
  assert.equal(a.militaryCount, 1);
  assert.deepEqual(a.entities.map(e => [e.type, e.x, e.y]), b.entities.map(e => [e.type, e.x, e.y]));
  assert.equal(a.visible[30 * 56 + 16], 1);
  assert.equal(a.visible[16 * 56 + 41], 0);
  const initial = { ...a.resources };
  a.update(70);
  assert.ok(a.resources.wood > initial.wood + 90, 'Wood must actually reach a drop-off.');
  assert.ok(a.resources.food > initial.food + 120, 'Food must actually reach a drop-off.');
  assert.ok(a.resources.gold > initial.gold + 50, 'Gold must actually reach a drop-off.');
  assert.equal(a.resources.stone, initial.stone);
  assert.ok(villagers(a).some(u => u.carrying.amount > 0));
  assert.ok(a.stats.resourcesGathered > 250);
  assert.match(a.canBuild('house', 50, 50).reason, /Explore/);
});

test('construction pays its cost, uses builders and increases housing only on completion', () => {
  const g = new Game({ difficulty: 'relaxed' });
  const site = clearSite(g, 'house');
  const worker = villagers(g).find(u => u.task.type === 'idle');
  const before = g.resources.wood;
  const result = g.placeBuilding('house', site.x, site.y, [worker.id]);
  assert.equal(result.ok, true);
  assert.equal(g.resources.wood, before - BUILDINGS.house.cost.wood);
  assert.equal(g.populationCap, 15);
  assert.equal(worker.task.type, 'build');
  assert.equal(g.canBuild('house', site.x, site.y).ok, false);
  g.update(45);
  assert.equal(result.entity.progress, 1);
  assert.equal(g.populationCap, 20);
  assert.equal(worker.task.type, 'gather');
  assert.equal(g.stats.buildingsBuilt, 1);
  assert.ok(g.events.some(e => e.text === 'House completed.'));
});

test('farms remain workable and deposit food after construction', () => {
  const g = new Game({ difficulty: 'relaxed' });
  const site = clearSite(g, 'farm');
  const worker = villagers(g).find(u => u.task.type === 'idle');
  const result = g.placeBuilding('farm', site.x, site.y, [worker.id]);
  assert.equal(result.ok, true);
  g.update(35);
  assert.equal(result.entity.progress, 1);
  assert.equal(worker.task.type, 'gather');
  assert.equal(worker.task.targetId, result.entity.id);
  const amount = result.entity.amount;
  const food = g.resources.food;
  g.update(35);
  assert.ok(result.entity.amount < amount);
  assert.ok(g.resources.food > food);
});

test('foundations displace overlapping units and builders can complete a Castle afterward', () => {
  const g = new Game({ difficulty: 'relaxed' });
  grantResources(g);
  g.age = 3;
  const worker = villagers(g)[0];
  g.command([worker.id], { type: 'move', x: 20.5, y: 28.5 });
  g.update(10);
  assert.ok(Math.hypot(worker.x - 20.5, worker.y - 28.5) < 0.3);
  const result = g.placeBuilding('barracks', 20.5, 28.5, [worker.id]);
  assert.equal(result.ok, true);
  assert.ok(Math.abs(worker.x - result.entity.x) > result.entity.size / 2 || Math.abs(worker.y - result.entity.y) > result.entity.size / 2);
  g.update(40);
  assert.equal(result.entity.progress, 1);
  const castle = g.placeBuilding('castle', 17, 26, [worker.id]);
  assert.equal(castle.ok, true);
  g.update(100);
  assert.equal(castle.entity.progress, 1);
  assert.equal(worker.task.type, 'gather');
});

test('a unit trapped inside a completed building in an older save can leave it', () => {
  const g = new Game({ difficulty: 'relaxed' });
  grantResources(g);
  const worker = villagers(g)[0];
  const result = g.placeBuilding('barracks', 20.5, 28.5, [worker.id]);
  g.update(50);
  assert.equal(result.entity.progress, 1);
  worker.x = 20.584381382067285;
  worker.y = 29.14648224452666;
  g.command([worker.id], { type: 'move', x: 24, y: 30 });
  g.update(20);
  assert.ok(Math.hypot(worker.x - 24, worker.y - 30) < 0.5);
  assert.equal(worker.task.type, 'idle');
});

test('production reserves housing slots and consumes only successful order costs', () => {
  const g = new Game({ difficulty: 'relaxed' });
  grantResources(g);
  const tc = playerBuilding(g, 'towncenter');
  const barracks = playerBuilding(g, 'barracks');
  for (let i = 0; i < 7; i++) assert.equal(g.train(tc.id, 'villager').ok, true);
  assert.equal(g.train(barracks.id, 'militia').ok, true);
  assert.equal(g.queuedPopulation, 8);
  const resources = { ...g.resources };
  assert.match(g.train(barracks.id, 'militia').reason, /Population/);
  assert.deepEqual(g.resources, resources);
  g.update(90);
  assert.equal(g.population, 15);
  assert.equal(g.queuedPopulation, 0);
  assert.equal(g.militaryCount, 2);
  assert.equal(g.train(barracks.id, 'archer').ok, false);
});

test('age advancements spend resources, take time and unlock the complete military progression', () => {
  const g = new Game({ difficulty: 'relaxed' });
  grantResources(g);
  const tc = playerBuilding(g, 'towncenter');
  assert.match(g.canBuild('stable', 23, 38).reason, /Feudal Age/);
  for (let age = 1; age < 4; age++) {
    const food = g.resources.food, gold = g.resources.gold;
    assert.equal(g.advanceAge(tc.id).ok, true);
    assert.equal(g.resources.food, food - (AGE_COSTS[age - 1].food || 0));
    assert.equal(g.resources.gold, gold - (AGE_COSTS[age - 1].gold || 0));
    assert.equal(g.age, age);
    assert.equal(g.advanceAge(tc.id).ok, false);
    g.update(75);
    assert.equal(g.age, age + 1);
  }
  assert.equal(g.advanceAge(tc.id).ok, false);
  const stableSite = clearSite(g, 'stable');
  const stable = g.placeBuilding('stable', stableSite.x, stableSite.y, [villagers(g)[0].id]).entity;
  g.update(55);
  assert.equal(stable.progress, 1);
  assert.equal(g.train(stable.id, 'knight').ok, true);
  g.update(28);
  const knight = g.entities.find(e => e.owner === 'player' && e.type === 'knight');
  assert.ok(knight);
  assert.ok(knight.maxHp > UNITS.knight.hp);
});

test('research requires its proper building and completes once without duplicates', () => {
  const g = new Game({ difficulty: 'relaxed' });
  grantResources(g);
  g.age = 2;
  const tc = playerBuilding(g, 'towncenter');
  assert.equal(g.research(tc.id, 'forging').ok, false);
  assert.equal(g.research(tc.id, 'wheelbarrow').ok, true);
  assert.equal(g.research(tc.id, 'wheelbarrow').ok, false);
  g.update(26);
  assert.ok(g.techs.has('wheelbarrow'));
  const site = clearSite(g, 'blacksmith');
  const smith = g.placeBuilding('blacksmith', site.x, site.y).entity;
  g.update(55);
  assert.equal(g.research(smith.id, 'forging').ok, true);
  g.update(26);
  assert.ok(g.techs.has('forging'));
  assert.equal(g.research(smith.id, 'forging').ok, false);
});

test('scouts navigate around water and reveal permanent explored terrain', () => {
  const g = new Game({ difficulty: 'relaxed' });
  const scout = g.entities.find(e => e.type === 'scout' && e.owner === 'player');
  assert.equal(g.command([scout.id], { type: 'move', x: 37, y: 44 }).ok, true);
  g.update(15);
  assert.ok(Math.hypot(scout.x - 37, scout.y - 44) < 0.8);
  g.command([scout.id], { type: 'move', x: 48, y: 44 });
  for (let i = 0; i < 100; i++) {
    g.update(0.2);
    assert.notEqual(g.terrain[Math.floor(scout.y) * 56 + Math.floor(scout.x)], 1);
  }
  assert.ok(Math.hypot(scout.x - 48, scout.y - 44) < 0.8);
  assert.equal(g.explored[44 * 56 + 48], 1);
  g.command([scout.id], { type: 'move', x: 18, y: 30 });
  g.update(20);
  assert.equal(g.explored[44 * 56 + 48], 1);
  assert.equal(g.visible[44 * 56 + 48], 0);
});

test('combat has a working cavalry counter and enemy Town Center destruction wins', () => {
  const g = new Game({ difficulty: 'relaxed' });
  g._aiClock = Infinity;
  g.entities = g.entities.filter(e => e.kind === 'building' && e.type === 'towncenter');
  g._navVersion++;
  const spear = g._addUnit('spearman', 'player', 29, 35);
  const scout = g._addUnit('scout', 'enemy', 30, 35);
  g.command([spear.id], { type: 'attack', targetId: scout.id });
  g.update(9);
  assert.equal(g.getEntity(scout.id), undefined);
  assert.ok(g.getEntity(spear.id));
  assert.equal(g.stats.kills, 1);
  const enemyTC = g.getEntity(g.enemyTownCenterId);
  enemyTC.hp = 150;
  const army = [0, 1, 2, 3].map(i => g._addUnit('militia', 'player', 38, 14 + i));
  assert.equal(g.command(army.map(u => u.id), { type: 'attack', targetId: enemyTC.id }).ok, true);
  g.update(20);
  assert.equal(g.state, 'won');
  assert.equal(g.getEntity(enemyTC.id), undefined);
});

test('the rival grows a real economy, honors its grace period and sends combat waves', () => {
  const g = new Game({ difficulty: 'normal' });
  g.update(125);
  assert.equal(g.state, 'playing');
  assert.equal(g.entities.filter(e => e.owner === 'enemy' && e.raider).length, 0);
  assert.ok(g.entities.filter(e => e.owner === 'enemy' && e.type === 'villager').length > 8);
  g.update(155);
  assert.ok(g.enemyAge >= 2);
  assert.ok(g.events.some(e => e.text.includes('Enemy raiders')));
  assert.ok(g.entities.some(e => e.owner === 'enemy' && e.type === 'archery'));
  const originalTC = g.getEntity(g.playerTownCenterId);
  g.update(600);
  assert.equal(g.state, 'lost');
  assert.equal(originalTC.hp, 0);
});

test('stop, attack-move, repairs and production rally commands remain usable', () => {
  const g = new Game({ difficulty: 'relaxed' });
  const worker = villagers(g).find(u => u.task.type === 'idle');
  const house = playerBuilding(g, 'house');
  house.hp = 200;
  assert.equal(g.command([worker.id], { type: 'repair', targetId: house.id }).ok, true);
  g.update(25);
  assert.equal(house.hp, house.maxHp);
  assert.equal(g.command([worker.id], { type: 'stop' }).ok, true);
  assert.equal(worker.task.type, 'idle');
  const scout = g.entities.find(e => e.owner === 'player' && e.type === 'scout');
  assert.equal(g.command([scout.id], { type: 'attackmove', x: 23, y: 37 }).ok, true);
  assert.equal(scout.task.attackMove, true);
  const tc = playerBuilding(g, 'towncenter');
  assert.equal(g.command([tc.id], { type: 'move', x: 18, y: 32 }).ok, true);
  assert.deepEqual(tc.rally, { x: 18, y: 32 });
});

test('a complete settlement can defeat normal AI using only gathered resources and public commands', () => {
  const g = new Game({ difficulty: 'normal' });
  const tc = g.getEntity(g.playerTownCenterId);
  const own = () => g.entities.filter(e => e.owner === 'player');
  const workers = () => own().filter(e => e.type === 'villager');
  const buildings = type => own().filter(e => e.kind === 'building' && e.type === type);
  const sites = new Map();
  const build = (type, cx, cy) => {
    const key = `${cx},${cy}`;
    if (!sites.has(key)) {
      const candidates = [];
      for (let y = 20; y < 45; y += 0.5) for (let x = 10; x < 29; x += 0.5) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < 12) candidates.push({ x, y, d });
      }
      sites.set(key, candidates.sort((a, b) => a.d - b.d));
    }
    for (const p of sites.get(key)) if (g.canBuild(type, p.x, p.y).ok) return g.placeBuilding(type, p.x, p.y);
    return { ok: false };
  };
  const assign = (worker, resource) => {
    const target = g.nearestResource(worker.x, worker.y, resource);
    if (target) g.command([worker.id], { type: 'gather', targetId: target.id });
  };
  const known = new Set(workers().map(e => e.id));
  assert.equal(build('house', 18, 33).ok, true);
  for (let i = 0; i < 5; i++) assert.equal(g.train(tc.id, 'villager').ok, true);
  let launched = false;

  for (let seconds = 0; seconds < 900 && g.state === 'playing'; seconds++) {
    g.update(1);
    const ws = workers(), counts = { food: 0, wood: 0, gold: 0, stone: 0 };
    ws.forEach(w => { if (w.task.resource) counts[w.task.resource]++; });
    for (const w of ws) if (!known.has(w.id)) {
      known.add(w.id);
      const resource = g.age === 1 ? 'food' : counts.gold < 6 ? 'gold' : counts.food < 8 ? 'food' : counts.wood < 4 ? 'wood' : 'stone';
      assign(w, resource); counts[resource]++;
    }

    if (g.population + g.queuedPopulation >= g.populationCap - 2 && !buildings('house').some(b => b.progress < 1)) build('house', 15, 34);
    if (g.age === 1 && ws.length >= 11 && !tc.queue.length && g.resources.food >= 400) g.advanceAge(tc.id);
    if (g.age === 2 && ws.length >= 18 && !tc.queue.length && g.resources.food >= 650 && g.resources.gold >= 200) g.advanceAge(tc.id);
    if (g.age >= 2 && ws.length + tc.queue.filter(q => q.kind === 'unit').length < 20 && tc.queue.length < 1) g.train(tc.id, 'villager');
    if (g.age >= 2 && !buildings('tower').length) build('tower', 23, 30);
    if (g.age >= 2 && !buildings('stable').length && g.resources.wood >= 200) build('stable', 18, 38);
    if (g.age >= 2 && buildings('stable').length && !buildings('blacksmith').length && g.resources.wood >= 220) build('blacksmith', 16, 37);
    if (g.age >= 2 && ws.length >= 16 && buildings('farm').length < 4 && g.resources.wood >= 100 && !buildings('farm').some(b => b.progress < 1)) build('farm', 19, 28);

    const barracks = buildings('barracks')[0];
    if (g.age >= 2 && barracks && own().filter(e => e.type === 'militia').length + barracks.queue.length < 3 && barracks.queue.length < 2 && g.resources.food > 150) g.train(barracks.id, 'militia');
    const smith = buildings('blacksmith').find(b => b.progress === 1);
    if (smith && smith.queue.length === 0) {
      if (!g.techs.has('forging')) g.research(smith.id, 'forging');
      else if (!g.techs.has('armor')) g.research(smith.id, 'armor');
    }
    const stable = buildings('stable').find(b => b.progress === 1);
    const knights = own().filter(e => e.type === 'knight');
    if (g.age >= 3 && stable && stable.queue.length < 3 && knights.length + stable.queue.length < 14) g.train(stable.id, 'knight');

    if (seconds % 20 === 0 && ws.length >= 19) {
      const targets = { food: 8, wood: 4, gold: 6, stone: 2 };
      const available = ws.filter(w => w.task.type !== 'build' && w.task.type !== 'repair');
      for (const resource of ['food', 'wood', 'gold', 'stone']) {
        let shortage = targets[resource] - available.filter(w => w.task.resource === resource).length;
        while (shortage > 0) {
          const worker = available.find(w => w.task.type === 'idle' || !w.task.resource || available.filter(a => a.task.resource === w.task.resource).length > targets[w.task.resource]);
          if (!worker) break;
          assign(worker, resource); shortage--;
        }
      }
    }

    if (!launched && knights.length >= 12) {
      launched = true;
      const army = own().filter(e => e.kind === 'unit' && e.type !== 'villager');
      g.command(army.map(e => e.id), { type: 'attack', targetId: g.enemyTownCenterId });
    }
    if (launched && stable) {
      const enemyTC = g.getEntity(g.enemyTownCenterId);
      if (enemyTC) {
        g.command([stable.id], { type: 'move', x: enemyTC.x - 2.5, y: enemyTC.y + 2.5 });
        for (const knight of knights) if (knight.task.type === 'idle' || knight.task.type === 'move') g.command([knight.id], { type: 'attack', targetId: enemyTC.id });
      }
    }
  }

  assert.equal(g.state, 'won', `Natural-resource game ended ${g.state} at ${Math.round(g.time)} seconds.`);
  assert.ok(g.time < 750);
  assert.equal(workers().length, 20);
  assert.equal(g.age, 3);
  assert.equal(buildings('farm').length, 4);
  assert.equal(buildings('tower').length, 1);
  assert.ok(g.techs.has('forging') && g.techs.has('armor'));
  assert.ok(g.stats.kills >= 10);
  assert.ok(g.stats.buildingsBuilt >= 10);
  assert.ok(g.stats.resourcesGathered > 10000);
  assert.equal(g.getEntity(g.enemyTownCenterId), undefined);
});
