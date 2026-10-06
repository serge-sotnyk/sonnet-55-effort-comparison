// The simulation uses world tile coordinates and runs independently of the canvas.
export const AGE_NAMES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];

export const UNIT_TYPES = {
  villager: { name: 'Villager', cost: { food: 50 }, hp: 45, attack: 4, armor: 0, range: .8, speed: 1.65, cooldown: 1.4, trainTime: 10, age: 0, building: 'towncenter', description: 'The heart of your economy. Gathers resources and constructs buildings.' },
  militia: { name: 'Man-at-arms', cost: { food: 55, gold: 15 }, hp: 85, attack: 11, armor: 1, range: .85, speed: 1.65, cooldown: 1.1, trainTime: 14, age: 0, building: 'barracks', description: 'Reliable infantry. Strong in numbers and effective against buildings.' },
  archer: { name: 'Archer', cost: { wood: 30, gold: 35 }, hp: 45, attack: 8, armor: 0, range: 5.5, speed: 1.65, cooldown: 1.55, trainTime: 17, age: 1, building: 'archery', description: 'Ranged infantry. Keep behind your front line.' },
  knight: { name: 'Knight', cost: { food: 80, gold: 65 }, hp: 165, attack: 18, armor: 3, range: 1, speed: 2.45, cooldown: 1.25, trainTime: 23, age: 2, building: 'stable', description: 'Fast, armored cavalry. Excels against archers and raiding parties.' },
  ram: { name: 'Battering ram', cost: { wood: 140, gold: 70 }, hp: 320, attack: 12, armor: 6, range: 1.05, speed: 1.1, cooldown: 2, trainTime: 30, age: 2, building: 'barracks', description: 'Siege engine. Deals devastating damage to buildings.' },
};

export const BUILDING_TYPES = {
  towncenter: { name: 'Town center', cost: { wood: 400, stone: 200 }, hp: 2400, size: 3.2, buildTime: 70, age: 0, population: 10, trains: ['villager'], range: 7, attack: 11, description: 'Your settlement’s heart. Trains villagers, receives resources, and defends the town.' },
  house: { name: 'House', cost: { wood: 40 }, hp: 350, size: 1.6, buildTime: 16, age: 0, population: 5, trains: [], description: 'Provides room for 5 more people.' },
  barracks: { name: 'Barracks', cost: { wood: 160 }, hp: 1000, size: 2.4, buildTime: 28, age: 0, trains: ['militia', 'ram'], description: 'Trains men-at-arms and, in the Castle Age, battering rams.' },
  archery: { name: 'Archery range', cost: { wood: 170 }, hp: 900, size: 2.4, buildTime: 28, age: 1, trains: ['archer'], description: 'Trains archers to support your infantry.' },
  stable: { name: 'Stable', cost: { wood: 190 }, hp: 1100, size: 2.6, buildTime: 30, age: 2, trains: ['knight'], description: 'Trains powerful knights.' },
  farm: { name: 'Farm', cost: { wood: 55 }, hp: 180, size: 2, buildTime: 10, age: 0, trains: [], description: 'A renewable source of food. Assign villagers to work the fields.' },
  tower: { name: 'Watchtower', cost: { wood: 80, stone: 120 }, hp: 1000, size: 1.6, buildTime: 35, age: 1, trains: [], range: 8, attack: 15, description: 'Fires arrows at nearby enemies. Protects valuable ground.' },
  castle: { name: 'Castle', cost: { wood: 200, stone: 500 }, hp: 3000, size: 3.4, buildTime: 65, age: 2, population: 10, trains: ['militia', 'archer', 'knight'], range: 9, attack: 25, description: 'A mighty fortress. Defends your realm and trains an army.' },
};

export const AGE_COSTS = [{ food: 400 }, { food: 650, gold: 250 }, { food: 950, gold: 450 }];
export const RESEARCH_TYPES = {
  wheelbarrow: { name: 'Wheelbarrow', cost: { food: 100, wood: 75 }, age: 0, time: 25, description: 'Villagers gather 30% faster and carry 50% more.' },
  forging: { name: 'Forging', cost: { food: 125, gold: 75 }, age: 1, time: 30, description: 'All military units deal +3 damage.' },
  armor: { name: 'Scale armor', cost: { food: 150, gold: 100 }, age: 1, time: 30, description: 'All military units gain +2 armor and +20 health.' },
  fletching: { name: 'Fletching', cost: { wood: 100, gold: 100 }, age: 1, time: 25, description: 'Archers, towers, and town centers gain +1 range and +2 damage.' },
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isBuilding = e => e && e.kind === 'building';
const targetRadius = e => isBuilding(e) ? e.size * .47 : .2;

export class Game {
  constructor() { this.restart(); }

  restart() {
    this.mapSize = 44;
    this.units = [];
    this.buildings = [];
    this.resources = [];
    this.projectiles = [];
    this.effects = [];
    this.stock = { food: 400, wood: 420, gold: 180, stone: 220 };
    this.enemyStock = { food: 500, wood: 450, gold: 320, stone: 200 };
    this.age = 0;
    this.enemyAge = 1;
    this.ageProgress = null;
    this.researched = new Set();
    this.researchQueue = [];
    this.time = 0;
    this.speed = 1;
    this.paused = false;
    this.result = null;
    this.events = [];
    this.selectedIds = new Set();
    this._id = 0;
    this._seed = 73489;
    this._aiTimer = 0;
    this._waveTime = 130;
    this._wave = 0;
    this._hints = new Set();
    this._gridVersion = 0;
    this.kills = 0;
    this.losses = 0;
    this.totalGathered = { food: 0, wood: 0, gold: 0, stone: 0 };
    this._setup();
    this.notify('Your settlement awaits. Grow your economy and defeat the Crimson Keep.', 'info');
    this.notify('Select villagers and right-click a resource to gather. Press B to build.', 'info');
    return this;
  }

  get population() { return this.units.filter(u => u.owner === 'player').length; }
  get populationCap() { return Math.min(100, this.buildings.filter(b => b.owner === 'player' && b.built >= 1).reduce((n, b) => n + (BUILDING_TYPES[b.type].population || 0), 0)); }
  get idleVillagers() { return this.units.filter(u => u.owner === 'player' && u.type === 'villager' && u.action === 'idle'); }
  get militaryCount() { return this.units.filter(u => u.owner === 'player' && u.type !== 'villager').length; }
  get objective() { return 'Destroy the enemy Town Center in the southeast'; }
  get ageCost() { return AGE_COSTS[this.age] || null; }

  _random() { this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0; return this._seed / 4294967296; }
  _nextId(prefix) { return prefix + (++this._id); }

  _setup() {
    this._addBuilding('towncenter', 'player', 11, 11);
    this._addBuilding('house', 'player', 7.6, 9.5);
    this._addBuilding('house', 'player', 14.3, 8.7);
    this._addBuilding('barracks', 'player', 7.8, 14.2);
    const farm1 = this._addBuilding('farm', 'player', 14.4, 13.8);
    this._addBuilding('farm', 'player', 17, 12.5);
    this._addBuilding('towncenter', 'enemy', 33, 31);
    this._addBuilding('house', 'enemy', 29.8, 28.5);
    this._addBuilding('house', 'enemy', 35.8, 27.8);
    this._addBuilding('barracks', 'enemy', 29.5, 33.5);
    this._addBuilding('archery', 'enemy', 36.8, 32.5);
    this._addBuilding('farm', 'enemy', 35.8, 36);
    this._addBuilding('farm', 'enemy', 32.8, 36);

    const clusters = [
      [5, 5, 29], [4, 16.5, 24], [19, 5, 31], [23, 11, 22], [8, 23, 26],
      [3.5, 30, 28], [16, 35, 30], [23, 39, 29], [39, 39, 29], [40, 22, 25],
      [34, 5, 34], [28, 19, 20], [39, 11, 24], [7, 39, 22], [22, 28, 20],
    ];
    for (const [cx, cy, count] of clusters) {
      for (let i = 0; i < count; i++) {
        const angle = this._random() * Math.PI * 2;
        const radius = Math.sqrt(this._random()) * 3.25;
        const x = clamp(cx + Math.cos(angle) * radius, 1, 43);
        const y = clamp(cy + Math.sin(angle) * radius, 1, 43);
        if (!this.buildings.some(b => Math.abs(b.x - x) < b.size / 2 + .7 && Math.abs(b.y - y) < b.size / 2 + .7)) this._addResource('tree', x, y, 130 + this._random() * 60);
      }
    }
    for (const [type, cx, cy, count] of [
      ['berries', 12, 6, 8], ['gold', 18.5, 17, 7], ['stone', 5, 20, 6],
      ['berries', 34, 24, 8], ['gold', 39, 29, 7], ['stone', 29, 38, 6],
      ['gold', 21, 22, 8], ['stone', 27, 9, 7], ['berries', 13, 29, 7],
      ['gold', 10, 34, 5], ['stone', 36, 17, 6],
    ]) {
      for (let i = 0; i < count; i++) {
        const angle = i * 2.4;
        const r = Math.sqrt(i) * .53;
        this._addResource(type, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, type === 'berries' ? 190 : 620);
      }
    }
    for (let i = 0; i < 7; i++) {
      const v = this._addUnit('villager', 'player', 10 + (i % 4) * .7, 13 + Math.floor(i / 4) * .6);
      const resourceType = i < 3 ? 'berries' : i < 5 ? 'tree' : i === 5 ? 'gold' : 'stone';
      this._assignGather(v, this._nearestResource(v, resourceType));
    }
    this._addUnit('militia', 'player', 11.5, 16.3);
    this._addUnit('militia', 'player', 12.4, 16.6);
    this._addUnit('knight', 'player', 14, 17);
    for (let i = 0; i < 6; i++) {
      const v = this._addUnit('villager', 'enemy', 32 + (i % 3) * .6, 33 + Math.floor(i / 3) * .6);
      this._assignGather(v, this._nearestResource(v, i < 3 ? 'berries' : i < 5 ? 'tree' : 'gold'));
    }
    for (let i = 0; i < 3; i++) {
      const u = this._addUnit('militia', 'enemy', 28 + i * .8, 29.5);
      u.guard = true;
    }
    const archer = this._addUnit('archer', 'enemy', 30, 26.5);
    archer.guard = true;
    this.home = { x: 11, y: 11 };
    this.enemyHome = { x: 33, y: 31 };
    this.rallyPoint = { x: 13, y: 16 };
  }

  _addResource(type, x, y, amount) {
    const r = { id: this._nextId('r'), kind: 'resource', type, x, y, amount, maxAmount: amount, variation: this._random() };
    this.resources.push(r);
    return r;
  }

  _addBuilding(type, owner, x, y, built = 1) {
    const def = BUILDING_TYPES[type];
    const b = { id: this._nextId('b'), kind: 'building', type, owner, x, y, hp: built === 1 ? def.hp : 50, maxHp: def.hp, size: def.size, built, queue: [], rally: { x: x + 1, y: y + def.size / 2 + 1.5 }, cooldown: 0, variation: this._random() };
    this.buildings.push(b);
    this._gridVersion++;
    return b;
  }

  _addUnit(type, owner, x, y) {
    const def = UNIT_TYPES[type];
    const extraHp = owner === 'player' && this.researched.has('armor') && type !== 'villager' ? 20 : 0;
    const u = { id: this._nextId('u'), kind: 'unit', type, owner, x, y, hp: def.hp + extraHp, maxHp: def.hp + extraHp, action: 'idle', targetId: null, destination: null, facing: Math.PI / 4, cooldown: this._random() * .4, animation: this._random() * 10, variation: this._random(), carry: 0, carryType: null, phase: 'harvest', path: null, pathAge: 0, aggressive: type !== 'villager', guard: false };
    this.units.push(u);
    return u;
  }

  getEntity(id) { return this.units.find(e => e.id === id) || this.buildings.find(e => e.id === id) || this.resources.find(e => e.id === id) || null; }
  getSelection() { return [...this.selectedIds].map(id => this.getEntity(id)).filter(Boolean); }
  select(ids) { this.selectedIds = new Set(ids.filter(id => this.getEntity(id))); }
  getAvailableActions(entity) {
    if (!entity || entity.owner !== 'player') return [];
    if (isBuilding(entity)) return (BUILDING_TYPES[entity.type].trains || []).filter(type => UNIT_TYPES[type].age <= this.age);
    return entity.type === 'villager' ? Object.keys(BUILDING_TYPES).filter(type => BUILDING_TYPES[type].age <= this.age && type !== 'towncenter') : [];
  }
  canAfford(cost, owner = 'player') { const stock = owner === 'player' ? this.stock : this.enemyStock; return Object.entries(cost || {}).every(([k, v]) => stock[k] >= v); }
  _pay(cost, owner = 'player') { const stock = owner === 'player' ? this.stock : this.enemyStock; for (const [k, v] of Object.entries(cost || {})) stock[k] -= v; }

  notify(text, tone = 'info') {
    if (this.events[0]?.text === text && this.time - this.events[0].time < 3) return;
    this.events.unshift({ text, tone, time: this.time });
    if (this.events.length > 35) this.events.length = 35;
  }

  command(x, y, targetId = null) {
    if (this.result) return false;
    const target = this.getEntity(targetId);
    const selected = this.getSelection().filter(e => e.owner === 'player');
    const units = selected.filter(e => e.kind === 'unit');
    if (!units.length) {
      for (const b of selected.filter(isBuilding)) this.setRally(b.id, x, y);
      return selected.length > 0;
    }
    const columns = Math.ceil(Math.sqrt(units.length));
    units.forEach((u, i) => {
      u.path = null;
      u.guard = false;
      u.resume = null;
      if (target && target.owner === 'enemy') {
        u.action = 'attack'; u.targetId = target.id; u.destination = null; u.explicitAttack = true;
      } else if (u.type === 'villager' && target && (target.kind === 'resource' || (target.type === 'farm' && target.owner === 'player' && target.built >= 1))) {
        this._assignGather(u, target);
      } else if (u.type === 'villager' && target && isBuilding(target) && target.owner === 'player' && target.built < 1) {
        u.action = 'build'; u.targetId = target.id; u.destination = null;
      } else {
        u.action = 'move'; u.targetId = null;
        u.destination = { x: clamp(x + (units.length > 1 ? (i % columns - (columns - 1) / 2) * .72 : 0), .5, 43.5), y: clamp(y + (units.length > 1 ? (Math.floor(i / columns) - (Math.ceil(units.length / columns) - 1) / 2) * .72 : 0), .5, 43.5) };
      }
    });
    this.effects.push({ type: target?.owner === 'enemy' ? 'attack-command' : 'command', x, y, life: 1.1, maxLife: 1.1 });
    return true;
  }

  setRally(buildingId, x, y) { const b = this.getEntity(buildingId); if (isBuilding(b) && b.owner === 'player') { b.rally = { x, y }; return true; } return false; }

  placementReason(type, x, y) {
    const d = BUILDING_TYPES[type];
    if (!d) return 'Unknown building';
    if (this.age < d.age) return `Requires ${AGE_NAMES[d.age]}`;
    if (type === 'towncenter' && this.buildings.some(b => b.owner === 'player' && b.type === 'towncenter')) return 'Your town center is already standing';
    if (x - d.size / 2 < .5 || y - d.size / 2 < .5 || x + d.size / 2 > 43.5 || y + d.size / 2 > 43.5) return 'Choose a location within the map';
    if (this.buildings.some(b => Math.abs(b.x - x) < (b.size + d.size) / 2 + .3 && Math.abs(b.y - y) < (b.size + d.size) / 2 + .3)) return 'Buildings need a little more room';
    if (this.buildings.some(b => b.owner === 'enemy' && Math.hypot(b.x - x, b.y - y) < 6)) return 'Too close to the rival settlement';
    if (this.resources.some(r => r.type !== 'berries' && r.amount > 0 && Math.abs(r.x - x) < d.size / 2 - .05 && Math.abs(r.y - y) < d.size / 2 - .05)) return 'Clear the resources here first';
    return '';
  }

  validPlacement(type, x, y) { return !this.placementReason(type, x, y); }

  build(type, x, y) {
    if (this.result) return false;
    const reason = this.placementReason(type, x, y);
    if (reason) { this.notify(reason, 'warning'); return false; }
    const def = BUILDING_TYPES[type];
    if (!this.canAfford(def.cost)) { this.notify(`Not enough resources for ${def.name.toLowerCase()}.`, 'warning'); return false; }
    const villagers = this.units.filter(u => u.owner === 'player' && u.type === 'villager' && u.action !== 'build').sort((a, b) => (this.selectedIds.has(a.id) ? -100 : 0) + distance(a, { x, y }) - ((this.selectedIds.has(b.id) ? -100 : 0) + distance(b, { x, y })));
    if (!villagers.length) { this.notify('A free villager is needed to construct this building.', 'warning'); return false; }
    this._pay(def.cost);
    const b = this._addBuilding(type, 'player', x, y, 0);
    const builders = villagers.slice(0, type === 'farm' || type === 'house' ? 1 : 2);
    for (const u of builders) {
      u.resume = u.action === 'gather' ? { action: u.action, targetId: u.targetId } : null;
      u.action = 'build'; u.targetId = b.id; u.destination = null; u.path = null;
    }
    this.notify(`${def.name} foundation placed. ${builders.length > 1 ? 'Villagers are' : 'A villager is'} on the way.`, 'info');
    return b;
  }

  train(buildingId, type) {
    const b = this.getEntity(buildingId), d = UNIT_TYPES[type];
    if (this.result || !b || b.owner !== 'player' || !d || b.built < 1 || !BUILDING_TYPES[b.type].trains.includes(type)) return false;
    if (this.age < d.age) { this.notify(`${d.name} requires the ${AGE_NAMES[d.age]}.`, 'warning'); return false; }
    if (b.queue.length >= 8) { this.notify('This training queue is full.', 'warning'); return false; }
    const reserved = this.buildings.filter(b => b.owner === 'player').reduce((n, b) => n + b.queue.length, 0);
    if (this.population + reserved >= this.populationCap) { this.notify('Build another house to increase your population limit.', 'warning'); return false; }
    if (!this.canAfford(d.cost)) { this.notify(`Not enough resources to train a ${d.name.toLowerCase()}.`, 'warning'); return false; }
    this._pay(d.cost);
    b.queue.push({ type, progress: 0 });
    return true;
  }

  cancelTraining(buildingId, index = -1) {
    const b = this.getEntity(buildingId);
    if (!b || b.owner !== 'player' || !b.queue.length) return false;
    const [item] = b.queue.splice(index < 0 ? b.queue.length - 1 : index, 1);
    if (item) for (const [k, amount] of Object.entries(UNIT_TYPES[item.type].cost)) this.stock[k] += amount;
    return !!item;
  }

  advanceAge() {
    if (this.result || this.age >= 3 || this.ageProgress !== null) return false;
    const tc = this.buildings.find(b => b.owner === 'player' && b.type === 'towncenter' && b.built >= 1);
    if (!tc) return false;
    const cost = AGE_COSTS[this.age];
    if (!this.canAfford(cost)) { this.notify(`Gather more resources to reach the ${AGE_NAMES[this.age + 1]}.`, 'warning'); return false; }
    this._pay(cost);
    this.ageProgress = 0;
    this.notify(`Advancing to the ${AGE_NAMES[this.age + 1]}…`, 'good');
    return true;
  }

  research(key) {
    const d = RESEARCH_TYPES[key];
    if (!d || this.result || this.researched.has(key) || this.researchQueue.some(r => r.key === key)) return false;
    if (this.age < d.age) { this.notify(`${d.name} requires the ${AGE_NAMES[d.age]}.`, 'warning'); return false; }
    if (!this.canAfford(d.cost)) { this.notify(`Not enough resources for ${d.name.toLowerCase()}.`, 'warning'); return false; }
    this._pay(d.cost);
    this.researchQueue.push({ key, progress: 0 });
    this.notify(`Researching ${d.name.toLowerCase()}…`, 'info');
    return true;
  }

  stopSelected() { for (const u of this.getSelection().filter(e => e.kind === 'unit' && e.owner === 'player')) { u.action = 'idle'; u.targetId = null; u.destination = null; u.path = null; } }

  update(dt) {
    if (this.paused || this.result || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, 1) * this.speed;
    while (remaining > 0) { const step = Math.min(.1, remaining); this._step(step); remaining -= step; if (this.result) break; }
  }

  _step(dt) {
    this.time += dt;
    if (this.ageProgress !== null) {
      this.ageProgress += dt / (40 + this.age * 15);
      if (this.ageProgress >= 1) { this.age++; this.ageProgress = null; this.notify(`The ${AGE_NAMES[this.age]} dawns! New buildings and units are available.`, 'good'); this.effects.push({ type: 'age', x: 11, y: 11, life: 3, maxLife: 3 }); }
    }
    for (let i = this.researchQueue.length - 1; i >= 0; i--) {
      const r = this.researchQueue[i]; r.progress += dt / RESEARCH_TYPES[r.key].time;
      if (r.progress >= 1) {
        this.researched.add(r.key);
        if (r.key === 'armor') for (const u of this.units.filter(u => u.owner === 'player' && u.type !== 'villager')) { u.maxHp += 20; u.hp += 20; }
        this.notify(`${RESEARCH_TYPES[r.key].name} research complete.`, 'good');
        this.researchQueue.splice(i, 1);
      }
    }
    for (const b of [...this.buildings]) this._updateBuilding(b, dt);
    for (const u of [...this.units]) if (u.hp > 0) this._updateUnit(u, dt);
    this._separateUnits(dt);
    for (const p of this.projectiles) { p.life -= dt; p.progress = 1 - p.life / p.maxLife; p.x = p.fromX + (p.toX - p.fromX) * p.progress; p.y = p.fromY + (p.toY - p.fromY) * p.progress; }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter(e => e.life > 0);
    this._aiTimer -= dt;
    if (this._aiTimer <= 0) { this._aiTimer = 3; this._updateAI(); }
    this._checkHints();
    this.units = this.units.filter(u => u.hp > 0);
    this.buildings = this.buildings.filter(b => b.hp > 0);
    for (const id of this.selectedIds) if (!this.getEntity(id)) this.selectedIds.delete(id);
    if (!this.buildings.some(b => b.type === 'towncenter' && b.owner === 'enemy')) this._finish('victory');
    else if (!this.buildings.some(b => b.type === 'towncenter' && b.owner === 'player')) this._finish('defeat');
  }

  _updateBuilding(b, dt) {
    if (b.hp <= 0 || b.built < 1) return;
    if (b.queue.length) {
      const q = b.queue[0];
      const blocked = b.owner === 'player' && this.population >= this.populationCap;
      if (!blocked) q.progress += dt / UNIT_TYPES[q.type].trainTime;
      if (q.progress >= 1) {
        b.queue.shift();
        const spot = this._openSpawn(b);
        const u = this._addUnit(q.type, b.owner, spot.x, spot.y);
        if (q.type === 'villager') {
          const foodWorkers = this.units.filter(v => v.owner === b.owner && v.type === 'villager' && v.carryType === 'food').length;
          this._assignGather(u, this._nearestResource(u, foodWorkers < 5 ? 'berries' : 'tree'));
        } else { u.action = 'move'; u.destination = { ...b.rally }; }
        if (b.owner === 'player') this.notify(`${UNIT_TYPES[q.type].name} ready.`, 'good');
      }
    }
    b.cooldown -= dt;
    const def = BUILDING_TYPES[b.type];
    if (def.attack && b.cooldown <= 0) {
      const fletching = b.owner === 'player' && this.researched.has('fletching');
      const enemy = this._nearestEnemy(b, def.range + (fletching ? 1 : 0), true);
      if (enemy) { this._hit(b, enemy, def.attack + (fletching ? 2 : 0), true); b.cooldown = b.type === 'castle' ? 1 : 1.7; }
    }
  }

  _openSpawn(b) {
    const radius = b.size / 2 + .65;
    for (let i = 0; i < 12; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 6;
      const p = { x: b.x + Math.cos(angle) * radius, y: b.y + Math.sin(angle) * radius };
      if (!this._blocked(p.x, p.y)) return p;
    }
    return { x: b.x, y: b.y + radius };
  }

  _updateUnit(u, dt) {
    u.cooldown -= dt;
    u.animation += dt;
    u.pathAge += dt;
    if (u.type !== 'villager' && u.type !== 'ram' && u.action !== 'attack' && (u.action === 'idle' || u.action === 'move')) {
      const enemy = this._nearestEnemy(u, u.guard ? 5 : 6, true);
      if (enemy) { u.resume = u.destination ? { action: 'move', destination: { ...u.destination } } : null; u.action = 'attack'; u.targetId = enemy.id; u.explicitAttack = false; u.path = null; }
    }
    if (u.action === 'move') {
      if (!u.destination || this._moveToward(u, u.destination, dt, .15)) { u.action = 'idle'; u.destination = null; u.path = null; }
    } else if (u.action === 'gather') this._gather(u, dt);
    else if (u.action === 'build') this._construct(u, dt);
    else if (u.action === 'attack') this._combat(u, dt);
    else if (u.owner === 'enemy' && u.raid) {
      const tc = this.buildings.find(b => b.owner === 'player' && b.type === 'towncenter');
      if (tc) { u.action = 'attack'; u.targetId = tc.id; u.explicitAttack = false; }
    }
  }

  _assignGather(u, target) {
    if (!target) { u.action = 'idle'; u.targetId = null; return; }
    const newType = target.type === 'tree' ? 'wood' : ['berries', 'farm'].includes(target.type) ? 'food' : target.type;
    if (u.carry > 0 && u.carryType !== newType) {
      const stock = u.owner === 'player' ? this.stock : this.enemyStock;
      stock[u.carryType] += u.carry;
      if (u.owner === 'player') this.totalGathered[u.carryType] += u.carry;
      u.carry = 0;
    }
    u.action = 'gather'; u.targetId = target.id; u.resourceType = target.type; u.carryType = newType; u.phase = 'harvest'; u.path = null; u.destination = null;
  }

  _nearestResource(u, type) {
    let options = this.resources.filter(r => r.type === type && r.amount > 0);
    if (type === 'berries' || type === 'farm') options = [...options, ...this.buildings.filter(b => b.type === 'farm' && b.owner === u.owner && b.built >= 1 && b.hp > 0)];
    let best = null, bestScore = Infinity;
    for (const r of options) {
      const assigned = this.units.filter(v => v.targetId === r.id && v.action === 'gather').length;
      const score = distance(u, r) + assigned * (r.type === 'farm' ? 3 : .7);
      if (score < bestScore) { best = r; bestScore = score; }
    }
    return best;
  }

  _gather(u, dt) {
    const improved = u.owner === 'player' && this.researched.has('wheelbarrow');
    const capacity = improved ? 15 : 10;
    if (u.phase === 'deliver') {
      const home = this.buildings.filter(b => b.owner === u.owner && b.type === 'towncenter' && b.built >= 1 && b.hp > 0).sort((a, b) => distance(a, u) - distance(b, u))[0];
      if (!home) { u.action = 'idle'; return; }
      if (this._moveToward(u, home, dt, home.size / 2 + .55)) {
        const stock = u.owner === 'player' ? this.stock : this.enemyStock;
        if (u.carryType) stock[u.carryType] += u.carry;
        if (u.owner === 'player' && u.carryType) this.totalGathered[u.carryType] += u.carry;
        u.carry = 0; u.phase = 'harvest'; u.path = null;
      }
      return;
    }
    let target = this.getEntity(u.targetId);
    if (!target || (target.kind === 'resource' && target.amount <= 0) || (isBuilding(target) && target.hp <= 0)) {
      target = this._nearestResource(u, u.resourceType);
      if (!target) { if (u.carry > 0) u.phase = 'deliver'; else { u.action = 'idle'; u.targetId = null; } return; }
      u.targetId = target.id; u.path = null;
    }
    if (!this._moveToward(u, target, dt, target.type === 'farm' ? target.size / 2 + .2 : .75)) return;
    u.facing = Math.atan2(target.y - u.y, target.x - u.x);
    const rates = { wood: 3.2, food: 3.4, gold: 2.8, stone: 2.5 };
    const amount = Math.min((rates[u.carryType] || 2.5) * (improved ? 1.3 : 1) * dt, capacity - u.carry, target.kind === 'resource' ? target.amount : Infinity);
    u.carry += amount;
    if (target.kind === 'resource') target.amount -= amount;
    if (u.carry >= capacity - .001 || target.amount <= 0) { u.phase = 'deliver'; u.path = null; }
  }

  _construct(u, dt) {
    const b = this.getEntity(u.targetId);
    if (!b || b.hp <= 0) { u.action = 'idle'; u.targetId = null; return; }
    if (b.built >= 1) {
      if (b.type === 'farm') this._assignGather(u, b);
      else if (u.resume?.action === 'gather') this._assignGather(u, this.getEntity(u.resume.targetId) || this._nearestResource(u, 'tree'));
      else { u.action = 'idle'; u.targetId = null; }
      u.resume = null;
      return;
    }
    if (!this._moveToward(u, b, dt, b.size / 2 + .5)) return;
    u.facing = Math.atan2(b.y - u.y, b.x - u.x);
    const increment = dt / BUILDING_TYPES[b.type].buildTime;
    b.built = Math.min(1, b.built + increment);
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * increment);
    if (b.built >= 1) { this.notify(`${BUILDING_TYPES[b.type].name} completed.`, 'good'); this.effects.push({ type: 'complete', x: b.x, y: b.y, life: 1.8, maxLife: 1.8 }); }
  }

  _combat(u, dt) {
    let target = this.getEntity(u.targetId);
    if (!target || target.hp <= 0 || target.owner === u.owner) {
      target = this._nearestEnemy(u, 7, u.type !== 'ram');
      if (!target && u.raid) target = this.buildings.find(b => b.owner !== u.owner && b.type === 'towncenter');
      if (!target) {
        u.targetId = null;
        if (u.resume?.action === 'gather' && u.type === 'villager') { this._assignGather(u, this.getEntity(u.resume.targetId) || this._nearestResource(u, u.resourceType || 'tree')); u.resume = null; }
        else if (u.resume?.destination) { u.action = 'move'; u.destination = u.resume.destination; u.resume = null; }
        else u.action = 'idle';
        return;
      }
      u.targetId = target.id; u.path = null; u.explicitAttack = false;
    }
    if (!u.explicitAttack && isBuilding(target) && u.type !== 'ram') {
      const enemyUnit = this._nearestEnemy(u, 5.5, true);
      if (enemyUnit && enemyUnit.kind === 'unit') { target = enemyUnit; u.targetId = target.id; u.path = null; }
    }
    const def = UNIT_TYPES[u.type];
    const fletching = u.owner === 'player' && u.type === 'archer' && this.researched.has('fletching');
    const range = def.range + (fletching ? 1 : 0) + targetRadius(target);
    if (!this._moveToward(u, target, dt, range)) return;
    u.facing = Math.atan2(target.y - u.y, target.x - u.x);
    if (u.cooldown <= 0) {
      let attack = def.attack + (u.owner === 'player' && u.type !== 'villager' && this.researched.has('forging') ? 3 : 0) + (fletching ? 2 : 0);
      if (u.type === 'ram' && isBuilding(target)) attack *= 8;
      if (u.type === 'archer' && isBuilding(target)) attack *= .5;
      this._hit(u, target, attack, u.type === 'archer');
      u.cooldown = def.cooldown;
      u.attackFlash = this.time;
    }
  }

  _nearestEnemy(entity, radius, unitsOnly = false) {
    let best = null, score = Infinity;
    const candidates = unitsOnly ? this.units : [...this.units, ...this.buildings];
    for (const e of candidates) {
      if (e.owner === entity.owner || e.hp <= 0) continue;
      const d = distance(entity, e) - targetRadius(e);
      if (d <= radius && d < score) { best = e; score = d; }
    }
    return best;
  }

  _hit(attacker, target, rawDamage, ranged = false) {
    const armor = target.kind === 'unit' ? UNIT_TYPES[target.type].armor + (target.owner === 'player' && target.type !== 'villager' && this.researched.has('armor') ? 2 : 0) : 1;
    const damage = Math.max(1, rawDamage - armor);
    target.hp -= damage;
    target.lastHit = this.time;
    if (ranged) this.projectiles.push({ id: this._nextId('p'), owner: attacker.owner, type: 'arrow', x: attacker.x, y: attacker.y, fromX: attacker.x, fromY: attacker.y, toX: target.x, toY: target.y, life: .32, maxLife: .32, progress: 0 });
    else this.effects.push({ type: 'hit', x: target.x, y: target.y, life: .24, maxLife: .24, damage });
    if (target.owner === 'player' && this.time - (this._lastAttackNotice || -100) > 22) { this._lastAttackNotice = this.time; this.notify('Your forces are under attack!', 'danger'); }
    if (target.kind === 'unit' && target.hp > 0 && target.action !== 'attack') {
      if (target.type !== 'villager') { target.resume = target.destination ? { action: 'move', destination: target.destination } : null; target.action = 'attack'; target.targetId = attacker.id; target.path = null; target.explicitAttack = false; }
      else if (distance(target, attacker) < 1.7) { target.resume = { action: 'gather', targetId: target.targetId }; target.action = 'attack'; target.targetId = attacker.id; target.path = null; }
    }
    if (target.hp <= 0) {
      this.effects.push({ type: isBuilding(target) ? 'ruin' : 'death', x: target.x, y: target.y, owner: target.owner, entityType: target.type, life: isBuilding(target) ? 25 : 12, maxLife: isBuilding(target) ? 25 : 12, size: target.size });
      if (target.kind === 'unit') { if (target.owner === 'enemy') this.kills++; else this.losses++; }
      else { this._gridVersion++; this.notify(`${target.owner === 'player' ? 'Your' : 'Enemy'} ${BUILDING_TYPES[target.type].name.toLowerCase()} destroyed.`, target.owner === 'player' ? 'danger' : 'good'); }
    }
  }

  _blocked(x, y, ignoreId = null) {
    if (x < .3 || y < .3 || x > 43.7 || y > 43.7) return true;
    return this.buildings.some(b => b.id !== ignoreId && b.type !== 'farm' && b.hp > 0 && Math.abs(x - b.x) < b.size / 2 + .23 && Math.abs(y - b.y) < b.size / 2 + .23);
  }

  _moveToward(u, target, dt, stopDistance) {
    const d = distance(u, target);
    if (d <= stopDistance) { u.moving = false; return true; }
    u.moving = true;
    // A new foundation can enclose a villager. Let them step outside its footprint.
    const enclosing = this.buildings.find(b => b.hp > 0 && b.type !== 'farm' && Math.abs(u.x - b.x) < b.size / 2 + .23 && Math.abs(u.y - b.y) < b.size / 2 + .23);
    if (enclosing) {
      const edge = enclosing.size / 2 + .3;
      const exits = [{ x: enclosing.x - edge, y: u.y }, { x: enclosing.x + edge, y: u.y }, { x: u.x, y: enclosing.y - edge }, { x: u.x, y: enclosing.y + edge }];
      exits.sort((a, b) => distance(u, a) + distance(a, target) * .1 - distance(u, b) - distance(b, target) * .1);
      for (const exit of exits) {
        const angle = Math.atan2(exit.y - u.y, exit.x - u.x), step = Math.min(UNIT_TYPES[u.type].speed * dt, distance(u, exit));
        const x = u.x + Math.cos(angle) * step, y = u.y + Math.sin(angle) * step;
        if (!this._blocked(x, y, enclosing.id)) { u.x = x; u.y = y; u.facing = angle; u.path = null; return false; }
      }
    }
    if (!u.path || u.pathAge > 3 || u.pathVersion !== this._gridVersion || Math.hypot((u.pathTarget?.x || 0) - target.x, (u.pathTarget?.y || 0) - target.y) > 1.5) {
      u.path = this._findPath(u, target, stopDistance);
      u.pathTarget = { x: target.x, y: target.y };
      u.pathAge = 0; u.pathVersion = this._gridVersion;
    }
    let point = u.path?.[0] || target;
    while (u.path?.length > 1 && distance(u, point) < .35) { u.path.shift(); point = u.path[0]; }
    const pd = distance(u, point);
    if (pd < .05) { u.path = null; return d <= stopDistance + .5; }
    const speed = UNIT_TYPES[u.type].speed * (u.type === 'villager' && u.owner === 'player' && this.researched.has('wheelbarrow') ? 1.12 : 1);
    const step = Math.min(speed * dt, pd, Math.max(.03, d - stopDistance + .05));
    const angle = Math.atan2(point.y - u.y, point.x - u.x);
    for (const offset of [0, .65, -.65, 1.1, -1.1, 1.55, -1.55]) {
      const x = u.x + Math.cos(angle + offset) * step, y = u.y + Math.sin(angle + offset) * step;
      if (!this._blocked(x, y)) { u.x = x; u.y = y; u.facing = angle + offset; return false; }
    }
    u.path = null;
    return false;
  }

  _findPath(start, goal, stopDistance) {
    // Most movements are unobstructed. Reserve grid search for paths through town.
    const dist = distance(start, goal);
    const end = { x: goal.x + (start.x - goal.x) / dist * Math.max(.05, stopDistance - .05), y: goal.y + (start.y - goal.y) / dist * Math.max(.05, stopDistance - .05) };
    let clear = true;
    for (let t = .3; t < distance(start, end); t += .45) {
      const ratio = t / distance(start, end);
      if (this._blocked(start.x + (end.x - start.x) * ratio, start.y + (end.y - start.y) * ratio)) { clear = false; break; }
    }
    if (clear && !this._blocked(end.x, end.y)) return [end];
    const cell = .8, n = 55;
    const ix = x => clamp(Math.floor(x / cell), 0, n - 1);
    const sx = ix(start.x), sy = ix(start.y);
    const key = (x, y) => y * n + x;
    const startKey = key(sx, sy);
    const open = [{ x: sx, y: sy, g: 0, f: dist / cell, k: startKey }];
    const scores = new Map([[startKey, 0]]), parents = new Map(), closed = new Set();
    let found = null, closest = open[0], bestDistance = dist;
    for (let loops = 0; open.length && loops < 1800; loops++) {
      let best = 0;
      for (let j = 1; j < open.length; j++) if (open[j].f < open[best].f) best = j;
      const node = open.splice(best, 1)[0];
      if (closed.has(node.k)) continue;
      closed.add(node.k);
      const wx = (node.x + .5) * cell, wy = (node.y + .5) * cell;
      const remaining = Math.hypot(wx - goal.x, wy - goal.y);
      if (remaining < bestDistance && !this._blocked(wx, wy)) { closest = node; bestDistance = remaining; }
      if (remaining <= stopDistance + .35 && !this._blocked(wx, wy)) { found = node; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = node.x + dx, ny = node.y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const k = key(nx, ny);
        if (closed.has(k) || this._blocked((nx + .5) * cell, (ny + .5) * cell)) continue;
        if (dx && dy && (this._blocked((node.x + .5) * cell, (ny + .5) * cell) || this._blocked((nx + .5) * cell, (node.y + .5) * cell))) continue;
        const g = node.g + (dx && dy ? 1.414 : 1);
        if (g >= (scores.get(k) ?? Infinity)) continue;
        scores.set(k, g); parents.set(k, node.k);
        open.push({ x: nx, y: ny, k, g, f: g + Math.hypot((nx + .5) * cell - goal.x, (ny + .5) * cell - goal.y) / cell });
      }
    }
    let k = (found || closest).k;
    const path = [];
    while (k !== startKey && parents.has(k)) { path.push({ x: ((k % n) + .5) * cell, y: (Math.floor(k / n) + .5) * cell }); k = parents.get(k); }
    path.reverse();
    return path.length ? path : [end];
  }

  _separateUnits(dt) {
    for (let i = 0; i < this.units.length; i++) {
      const a = this.units[i];
      for (let j = i + 1; j < this.units.length; j++) {
        const b = this.units[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const radius = a.type === 'ram' || b.type === 'ram' ? .65 : .44;
        if (Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
        const d = Math.hypot(dx, dy);
        if (d >= radius) continue;
        const force = Math.min((radius - d) * .5, dt * .6);
        const fx = d > .001 ? dx / d * force : force, fy = d > .001 ? dy / d * force : 0;
        if (!this._blocked(a.x + fx, a.y + fy)) { a.x += fx; a.y += fy; }
        if (!this._blocked(b.x - fx, b.y - fy)) { b.x -= fx; b.y -= fy; }
      }
    }
  }

  _updateAI() {
    if (this.time > 220) this.enemyAge = 2;
    if (this.time > 480) this.enemyAge = 3;
    const enemyUnits = this.units.filter(u => u.owner === 'enemy');
    const military = enemyUnits.filter(u => u.type !== 'villager');
    // A modest background income keeps the rival active if its gatherers are raided.
    this.enemyStock.food += 5;
    this.enemyStock.wood += 4;
    this.enemyStock.gold += 3;
    const barracks = this.buildings.find(b => b.owner === 'enemy' && b.type === 'barracks');
    const archery = this.buildings.find(b => b.owner === 'enemy' && b.type === 'archery');
    if (this.time > 45 && military.length < 24) {
      for (const [b, type] of [[barracks, this.enemyAge >= 2 && this._random() < .12 ? 'ram' : 'militia'], [archery, 'archer']]) {
        if (!b || b.queue.length || !this.canAfford(UNIT_TYPES[type].cost, 'enemy')) continue;
        if (type === 'archer' && this._random() > .4) continue;
        this._pay(UNIT_TYPES[type].cost, 'enemy');
        b.queue.push({ type, progress: 0 });
      }
    }
    for (const u of enemyUnits.filter(u => u.type === 'villager' && u.action === 'idle')) this._assignGather(u, this._nearestResource(u, this._random() < .5 ? 'berries' : 'tree'));
    if (this.time >= this._waveTime) {
      this._wave++;
      this._waveTime = this.time + Math.max(70, 115 - this._wave * 8);
      const tc = this.buildings.find(b => b.owner === 'player' && b.type === 'towncenter');
      const available = military.filter(u => !u.raid && !u.guard);
      const wave = available.slice(0, Math.min(3 + this._wave * 2, 10));
      for (const u of wave) { u.raid = true; u.guard = false; u.action = 'attack'; u.targetId = tc?.id; u.explicitAttack = false; u.path = null; }
      if (wave.length) this.notify('Scouts report a Crimson raiding party approaching from the southeast.', 'danger');
    }
    if (this.time > 360 && !this.buildings.some(b => b.owner === 'enemy' && b.type === 'stable') && this.canAfford(BUILDING_TYPES.stable.cost, 'enemy')) {
      this._pay(BUILDING_TYPES.stable.cost, 'enemy');
      this._addBuilding('stable', 'enemy', 38.5, 36);
    }
    const stable = this.buildings.find(b => b.owner === 'enemy' && b.type === 'stable');
    if (stable && !stable.queue.length && military.length < 26 && this.canAfford(UNIT_TYPES.knight.cost, 'enemy')) { this._pay(UNIT_TYPES.knight.cost, 'enemy'); stable.queue.push({ type: 'knight', progress: 0 }); }
  }

  _checkHints() {
    const hint = (key, condition, text) => { if (condition && !this._hints.has(key)) { this._hints.add(key); this.notify(text, 'info'); } };
    hint('train', this.time > 15, 'Keep your town center busy: more villagers means a stronger economy.');
    hint('age', this.time > 40 && this.age === 0 && this.ageProgress === null && this.stock.food >= 400, 'You can advance to the Feudal Age. New archers and defenses await.');
    hint('house', this.population >= this.populationCap - 2, 'Your town is growing. Build houses before you reach the population limit.');
    hint('siege', this.age >= 2, 'Build a battering ram at the barracks to break the enemy town center.');
    hint('enemy', this.time > 90, 'The Crimson settlement lies southeast. Protect your economy and prepare an army.');
    hint('farms', this.time > 170, 'Farms provide lasting food. Select villagers and right-click a farm to work it.');
  }

  _finish(result) { if (this.result) return; this.result = result; this.notify(result === 'victory' ? 'Victory! The Crimson Keep has fallen. This land is yours.' : 'Your town center has fallen. Your people will remember your stand.', result === 'victory' ? 'good' : 'danger'); }
}
