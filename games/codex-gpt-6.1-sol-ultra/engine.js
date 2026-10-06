import { AGES, AGE_COSTS, BUILDINGS, UNITS, TECHS, MAP_SIZE } from './catalog.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const opposite = owner => owner === 'player' ? 'enemy' : 'player';
const intervals = { villager: 1.6, militia: 1.15, spearman: 1.3, archer: 1.6, scout: 1.2, knight: 1.35, trebuchet: 4.2 };
const RESOURCE_TYPE = { wood: 'tree', food: 'berry', gold: 'gold', stone: 'stone' };
const ageTimes = [38, 52, 66];

/** A deterministic, browser-independent medieval RTS simulation. */
export class Game {
  constructor({ difficulty = 'normal', seed = 7 } = {}) {
    this.difficulty = ['normal', 'relaxed', 'hard'].includes(difficulty) ? difficulty : 'normal';
    this.seed = seed >>> 0;
    this._rng = this.seed || 7;
    this._nextId = 1;
    this.entities = [];
    this.resources = { wood: 300, food: 250, gold: 120, stone: 180 };
    this.enemyResources = { wood: 320, food: 300, gold: 140, stone: 180 };
    this.age = 1;
    this.enemyAge = 1;
    this.techs = new Set();
    this.enemyTechs = new Set();
    this.time = 0;
    this.state = 'playing';
    this.selected = new Set();
    this.events = [];
    this.stats = { kills: 0, lost: 0, resourcesGathered: 0, buildingsBuilt: 0 };
    this.projectiles = [];
    this.effects = [];
    this.explored = new Uint8Array(MAP_SIZE * MAP_SIZE);
    this.visible = new Uint8Array(MAP_SIZE * MAP_SIZE);
    this.terrain = new Uint8Array(MAP_SIZE * MAP_SIZE);
    this._fogClock = 0;
    this._aiClock = 0;
    this._firstWave = this.difficulty === 'relaxed' ? 300 : this.difficulty === 'hard' ? 150 : 190;
    this._nextWave = this._firstWave;
    this._navVersion = 1;
    this._initializeWorld();
    this._updateVisibility();
    this.event('Your settlement awaits. Grow your economy and conquer the rival Town Center.', 'info');
  }

  _random() {
    this._rng = (Math.imul(1664525, this._rng) + 1013904223) >>> 0;
    return this._rng / 4294967296;
  }

  _initializeWorld() {
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const pond = ((x - 27) / 4.5) ** 2 + ((y - 10) / 3.4) ** 2;
        const pond2 = ((x - 43) / 3.2) ** 2 + ((y - 44) / 3.9) ** 2;
        this.terrain[y * MAP_SIZE + x] = pond < 1 || pond2 < 1 ? 1 : this._random() < 0.065 ? 2 : 0;
      }
    }
    const playerTC = this._addBuilding('towncenter', 'player', 16, 30, true);
    const enemyTC = this._addBuilding('towncenter', 'enemy', 41, 16, true);
    this.playerTownCenterId = playerTC.id;
    this.enemyTownCenterId = enemyTC.id;
    this._addBuilding('house', 'player', 13, 34, true);
    this._addBuilding('lumbercamp', 'player', 10.7, 26, true);
    this._addBuilding('mill', 'player', 21, 31, true);
    this._addBuilding('barracks', 'player', 18.5, 35.5, true);
    this._addBuilding('miningcamp', 'player', 11.5, 30, true);
    this._addBuilding('house', 'enemy', 44.5, 18, true);
    this._addBuilding('lumbercamp', 'enemy', 36.5, 12, true);
    this._addBuilding('mill', 'enemy', 36.5, 20, true);
    this._addBuilding('barracks', 'enemy', 41.5, 21, true);
    this._addBuilding('miningcamp', 'enemy', 45, 13.5, true);

    const cluster = (resource, cx, cy, count, radius) => {
      let made = 0;
      for (let attempts = 0; made < count && attempts < count * 20; attempts++) {
        const angle = this._random() * Math.PI * 2;
        const r = Math.sqrt(this._random()) * radius;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (!this._walkable(x, y, 0.35)) continue;
        if (this.entities.some(e => e.kind === 'resource' && Math.hypot(e.x - x, e.y - y) < (resource === 'wood' ? 0.62 : 0.75))) continue;
        const amount = resource === 'wood' ? 240 : resource === 'food' ? 300 : 900;
        this.entities.push({ id: this._nextId++, kind: 'resource', type: RESOURCE_TYPE[resource], owner: 'neutral', resource, x, y, hp: 1, maxHp: 1, amount, initialAmount: amount, variant: Math.floor(this._random() * 4) });
        made++;
      }
    };
    cluster('wood', 8, 23, 34, 4);
    cluster('wood', 15, 39, 28, 4);
    cluster('wood', 24, 26, 22, 3.1);
    cluster('wood', 36, 8, 32, 3.6);
    cluster('wood', 47, 23, 32, 4);
    cluster('wood', 32, 37, 28, 4.5);
    cluster('wood', 6, 44, 15, 3);
    cluster('food', 22, 34.5, 10, 2.1);
    cluster('food', 33.5, 20, 11, 2);
    cluster('food', 29, 47, 8, 2);
    cluster('gold', 9, 32, 6, 1.7);
    cluster('gold', 48, 12, 6, 1.7);
    cluster('gold', 29, 28, 7, 2);
    cluster('stone', 19, 23, 6, 1.7);
    cluster('stone', 46, 8, 6, 1.5);
    cluster('stone', 34, 31, 6, 2);
    const p = [[14, 27.8], [17.6, 27.8], [13.7, 29], [13.7, 31], [16.5, 32.2], [18.4, 30]];
    p.forEach(([x, y], i) => {
      const worker = this._addUnit('villager', 'player', x, y);
      if (i < 5) this._assignGather(worker, this.nearestResource(x, y, i < 2 ? 'food' : i < 4 ? 'wood' : 'gold'));
    });
    this._addUnit('scout', 'player', 20, 27);
    const e = [[39, 14], [41, 13.6], [43, 14], [38.8, 16], [39, 18], [41, 18.5], [43, 16], [43, 19.2]];
    e.forEach(([x, y], i) => {
      const worker = this._addUnit('villager', 'enemy', x, y);
      this._assignGather(worker, this.nearestResource(x, y, i < 3 ? 'food' : i < 5 ? 'wood' : i < 7 ? 'gold' : 'stone'));
    });
    this._addUnit('scout', 'enemy', 38, 15);
  }

  _addBuilding(type, owner, x, y, complete = false) {
    const def = BUILDINGS[type];
    const b = {
      id: this._nextId++, kind: 'building', type, owner, x, y,
      hp: complete ? def.hp : Math.max(10, def.hp * 0.02), maxHp: def.hp,
      size: def.size, progress: complete ? 1 : 0, queue: [],
      rally: { x: x + def.size / 2 + 1, y: y + 1 }, attackClock: this._random(),
    };
    if (type === 'farm') { b.resource = 'food'; b.amount = 1200; b.initialAmount = 1200; }
    this.entities.push(b);
    this._navVersion++;
    return b;
  }

  _addUnit(type, owner, x, y) {
    const def = UNITS[type];
    const age = this._ageOf(owner);
    const maxHp = def.hp * (type === 'villager' ? 1 : 1 + 0.15 * (age - 1));
    const pos = this._nearestWalkable(x, y);
    const u = {
      id: this._nextId++, kind: 'unit', type, owner, x: pos.x, y: pos.y,
      hp: maxHp, maxHp, task: { type: 'idle' },
      carrying: { resource: null, amount: 0 }, carriedResource: null, carriedAmount: 0,
      attackClock: this._random(), acquireClock: this._random() * 0.4,
      facing: 1, animation: this._random() * 10, path: [],
    };
    this.entities.push(u);
    return u;
  }

  get population() { return this._population('player'); }
  get populationCap() { return this._populationCap('player'); }
  get idleVillagers() { return this.entities.filter(e => e.kind === 'unit' && e.owner === 'player' && e.type === 'villager' && e.task.type === 'idle').length; }
  get militaryCount() { return this.entities.filter(e => e.kind === 'unit' && e.owner === 'player' && e.type !== 'villager').length; }
  get queuedPopulation() { return this._queuedPopulation('player'); }
  _population(owner) { return this.entities.filter(e => e.kind === 'unit' && e.owner === owner && e.hp > 0).length; }
  _populationCap(owner) { return Math.min(125, this.entities.reduce((n, e) => n + (e.owner === owner && e.kind === 'building' && e.progress >= 1 && e.hp > 0 ? BUILDINGS[e.type].pop || 0 : 0), 0)); }
  _queuedPopulation(owner) { return this.entities.filter(e => e.owner === owner && e.kind === 'building').reduce((n, b) => n + b.queue.filter(q => q.kind === 'unit').length, 0); }
  _ageOf(owner) { return owner === 'player' ? this.age : this.enemyAge; }
  _stock(owner) { return owner === 'player' ? this.resources : this.enemyResources; }
  _techsOf(owner) { return owner === 'player' ? this.techs : this.enemyTechs; }

  getEntity(id) { return this.entities.find(e => e.id === id && e.hp > 0); }
  getCost(type) { return (BUILDINGS[type] || UNITS[type] || TECHS[type])?.cost || {}; }
  canAfford(cost, owner = 'player') { return Object.entries(cost).every(([r, amount]) => this._stock(owner)[r] >= amount); }
  _pay(cost, owner) { for (const [r, amount] of Object.entries(cost)) this._stock(owner)[r] -= amount; }
  event(text, type = 'info') { this.events.push({ time: this.time, text, type }); if (this.events.length > 70) this.events.shift(); }

  findAt(x, y, radius = 0.75) {
    const candidates = this.entities.filter(e => {
      if (e.hp <= 0) return false;
      if (e.kind === 'building') return Math.abs(e.x - x) <= e.size / 2 + radius * 0.3 && Math.abs(e.y - y) <= e.size / 2 + radius * 0.3;
      return Math.hypot(e.x - x, e.y - y) <= (e.kind === 'resource' ? Math.max(0.6, radius) : radius);
    });
    return candidates.sort((a, b) => (a.kind === 'unit' ? -1 : 0) - (b.kind === 'unit' ? -1 : 0) || distance(a, { x, y }) - distance(b, { x, y }))[0];
  }

  nearestResource(x, y, resource, owner = 'player') {
    let nearest, best = Infinity;
    for (const e of this.entities) {
      if (e.hp <= 0 || e.amount <= 0 || e.resource !== resource) continue;
      if (e.kind === 'building' && (e.owner !== owner || e.progress < 1)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < best) { best = d; nearest = e; }
    }
    return nearest;
  }

  canBuild(type, x, y) { return this._canBuild(type, x, y, 'player'); }
  _canBuild(type, x, y, owner) {
    if (this.state !== 'playing') return { ok: false, reason: 'The battle has ended.' };
    const def = BUILDINGS[type];
    if (!def) return { ok: false, reason: 'Unknown building.' };
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'Choose a location on the map.' };
    if (this._ageOf(owner) < def.age) return { ok: false, reason: `Requires the ${AGES[def.age - 1]}.` };
    if (!this.canAfford(def.cost, owner)) return { ok: false, reason: 'Not enough resources.' };
    if (owner === 'player' && (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE || !this.explored[Math.floor(y) * MAP_SIZE + Math.floor(x)])) return { ok: false, reason: 'Explore this area before building here.' };
    if (type === 'farm' && !this.entities.some(b => b.owner === owner && b.type === 'mill' && b.progress >= 1 && b.hp > 0)) return { ok: false, reason: 'Build a Mill before planting farms.' };
    const half = def.size / 2;
    if (x - half < 1 || y - half < 1 || x + half > MAP_SIZE - 1 || y + half > MAP_SIZE - 1) return { ok: false, reason: 'Too close to the edge of the map.' };
    for (let yy = Math.floor(y - half); yy <= Math.floor(y + half); yy++) {
      for (let xx = Math.floor(x - half); xx <= Math.floor(x + half); xx++) {
        if (this.terrain[yy * MAP_SIZE + xx] === 1) return { ok: false, reason: 'Buildings need dry land.' };
      }
    }
    for (const e of this.entities) {
      if (e.hp <= 0 || e.kind === 'unit') continue;
      if (e.kind === 'building') {
        if (Math.abs(x - e.x) < half + e.size / 2 + 0.3 && Math.abs(y - e.y) < half + e.size / 2 + 0.3) return { ok: false, reason: 'Too close to another building.' };
      } else if (Math.abs(x - e.x) < half + 0.35 && Math.abs(y - e.y) < half + 0.35) return { ok: false, reason: 'Clear the resources here first.' };
    }
    return { ok: true };
  }

  placeBuilding(type, x, y, workerIds = []) { return this._placeBuilding(type, x, y, workerIds, 'player'); }
  _placeBuilding(type, x, y, workerIds, owner) {
    const check = this._canBuild(type, x, y, owner);
    if (!check.ok) return check;
    let workers = [...workerIds].map(id => this.getEntity(id)).filter(u => u?.owner === owner && u.type === 'villager' && u.kind === 'unit');
    if (!workers.length) {
      const allWorkers = this.entities.filter(u => u.owner === owner && u.type === 'villager' && u.hp > 0);
      allWorkers.sort((a, b) => (a.task.type === 'idle' ? -8 : 0) + distance(a, { x, y }) - ((b.task.type === 'idle' ? -8 : 0) + distance(b, { x, y })));
      workers = allWorkers.slice(0, 1);
    }
    if (!workers.length) return { ok: false, reason: 'You need a villager to construct this building.' };
    this._pay(BUILDINGS[type].cost, owner);
    const entity = this._addBuilding(type, owner, x, y);
    // Foundations can be placed underneath units. Clear their footprint before
    // assigning work so a unit never starts a path inside an impassable cell.
    if (type !== 'farm') {
      for (const u of this.entities) {
        if (u.kind !== 'unit' || u.hp <= 0 || Math.abs(u.x - x) >= entity.size / 2 + 0.2 || Math.abs(u.y - y) >= entity.size / 2 + 0.2) continue;
        const escape = this._nearestWalkable(u.x, u.y);
        u.x = escape.x; u.y = escape.y;
        u.path = []; u.pathGoal = null;
      }
    }
    for (const u of workers) {
      u.resumeTask = u.task.type === 'gather' ? { ...u.task } : null;
      this._setTask(u, { type: 'build', targetId: entity.id });
    }
    if (owner === 'player') this.event(`Construction started: ${BUILDINGS[type].name}.`, 'build');
    return { ok: true, entity };
  }

  train(buildingId, type) { return this._train(buildingId, type, 'player'); }
  _train(buildingId, type, owner) {
    const b = this.getEntity(buildingId), def = UNITS[type];
    if (this.state !== 'playing') return { ok: false, reason: 'The battle has ended.' };
    if (!b || b.kind !== 'building' || b.owner !== owner || b.progress < 1) return { ok: false, reason: 'Select a completed production building.' };
    if (!def || !BUILDINGS[b.type].trains?.includes(type)) return { ok: false, reason: 'This building cannot train that unit.' };
    if (this._ageOf(owner) < def.age && type !== 'scout') return { ok: false, reason: `Requires the ${AGES[def.age - 1]}.` };
    if (type === 'scout' && this._ageOf(owner) < 2) return { ok: false, reason: 'Requires the Feudal Age.' };
    if (b.queue.length >= 7) return { ok: false, reason: 'This building’s queue is full.' };
    if (this._population(owner) + this._queuedPopulation(owner) >= this._populationCap(owner)) return { ok: false, reason: 'Population limit reached. Build another House.' };
    if (!this.canAfford(def.cost, owner)) return { ok: false, reason: 'Not enough resources.' };
    this._pay(def.cost, owner);
    b.queue.push({ kind: 'unit', type, duration: def.time, time: def.time, elapsed: 0, progress: 0 });
    return { ok: true };
  }

  advanceAge(buildingId) { return this._advanceAge(buildingId, 'player'); }
  _advanceAge(buildingId, owner) {
    const b = this.getEntity(buildingId), current = this._ageOf(owner);
    if (!b || b.owner !== owner || b.type !== 'towncenter' || b.progress < 1) return { ok: false, reason: 'Select your completed Town Center.' };
    if (current >= 4) return { ok: false, reason: 'Your empire has reached the Imperial Age.' };
    if (this.entities.some(e => e.owner === owner && e.queue?.some(q => q.kind === 'age'))) return { ok: false, reason: 'An age advancement is already underway.' };
    if (!this.canAfford(AGE_COSTS[current - 1], owner)) return { ok: false, reason: 'Not enough resources to advance.' };
    this._pay(AGE_COSTS[current - 1], owner);
    b.queue.push({ kind: 'age', type: 'age', targetAge: current + 1, duration: ageTimes[current - 1], time: ageTimes[current - 1], elapsed: 0, progress: 0 });
    if (owner === 'player') this.event(`Preparing to enter the ${AGES[current]}.`, 'age');
    return { ok: true };
  }

  research(buildingId, tech) { return this._research(buildingId, tech, 'player'); }
  _research(buildingId, tech, owner) {
    const b = this.getEntity(buildingId), def = TECHS[tech];
    if (!b || b.kind !== 'building' || b.owner !== owner || b.progress < 1 || !def) return { ok: false, reason: 'Select a completed research building.' };
    if (b.type !== (tech === 'wheelbarrow' ? 'towncenter' : 'blacksmith')) return { ok: false, reason: tech === 'wheelbarrow' ? 'Research Wheelbarrow at the Town Center.' : 'Research this upgrade at a Blacksmith.' };
    if (this._techsOf(owner).has(tech) || this.entities.some(e => e.owner === owner && e.queue?.some(q => q.kind === 'tech' && q.type === tech))) return { ok: false, reason: 'This upgrade is already researched or queued.' };
    if (this._ageOf(owner) < def.age) return { ok: false, reason: `Requires the ${AGES[def.age - 1]}.` };
    if (!this.canAfford(def.cost, owner)) return { ok: false, reason: 'Not enough resources.' };
    this._pay(def.cost, owner);
    b.queue.push({ kind: 'tech', type: tech, duration: def.time, time: def.time, elapsed: 0, progress: 0 });
    return { ok: true };
  }

  /** Right-click commands can target terrain, resources, foundations, or foes. */
  command(ids, command) {
    if (this.state !== 'playing') return { ok: false, reason: 'The battle has ended.' };
    const units = [...ids].map(id => this.getEntity(id)).filter(e => e?.kind === 'unit' && e.owner === 'player');
    const buildings = [...ids].map(id => this.getEntity(id)).filter(e => e?.kind === 'building' && e.owner === 'player');
    const target = this.getEntity(command.targetId);
    if (!units.length && buildings.length && Number.isFinite(command.x) && Number.isFinite(command.y)) {
      for (const b of buildings) b.rally = this._nearestWalkable(command.x, command.y);
      return { ok: true };
    }
    if (!units.length) return { ok: false, reason: 'Select one or more of your units.' };
    let assigned = 0;
    const columns = Math.ceil(Math.sqrt(units.length));
    units.forEach((u, i) => {
      let type = command.type;
      if (type === 'stop' || type === 'idle') { this._setTask(u, { type: 'idle' }); assigned++; return; }
      if (type === 'attackmove') type = 'attack';
      if (type === 'interact') {
        type = target?.owner === 'enemy' ? 'attack' : target?.resource ? 'gather' : target?.owner === 'player' && target.kind === 'building' ? target.progress < 1 ? 'build' : 'repair' : 'move';
      }
      if ((type === 'gather' || type === 'build' || type === 'repair') && u.type !== 'villager') return;
      if (type === 'gather') {
        if (!target?.resource || target.amount <= 0 || target.owner === 'enemy' || target.progress < 1) return;
        this._assignGather(u, target); assigned++; return;
      }
      if (type === 'build' || type === 'repair') {
        if (!target || target.owner !== 'player' || target.kind !== 'building') return;
        u.resumeTask = u.task.type === 'gather' ? { ...u.task } : null;
        this._setTask(u, { type: target.progress < 1 ? 'build' : 'repair', targetId: target.id }); assigned++; return;
      }
      if (type === 'attack' && target) {
        if (target.owner !== 'enemy') return;
        this._setTask(u, { type: 'attack', targetId: target.id }); assigned++; return;
      }
      if (Number.isFinite(command.x) && Number.isFinite(command.y) && (type === 'move' || type === 'attack')) {
        const spacing = units.length > 1 ? 0.62 : 0;
        const x = command.x + ((i % columns) - (columns - 1) / 2) * spacing;
        const y = command.y + (Math.floor(i / columns) - (Math.ceil(units.length / columns) - 1) / 2) * spacing;
        const point = this._nearestWalkable(x, y);
        this._setTask(u, { type, x: point.x, y: point.y, attackMove: type === 'attack' }); assigned++;
      }
    });
    return assigned ? { ok: true } : { ok: false, reason: 'These units cannot perform that task.' };
  }

  _setTask(unit, task) {
    unit.task = task;
    unit.path = [];
    unit.pathGoal = null;
    unit.combatTargetId = null;
    unit.acquireClock = 0;
  }

  _assignGather(unit, target) {
    if (!target) { this._setTask(unit, { type: 'idle' }); return; }
    if (unit.carrying.amount > 0 && unit.carrying.resource !== target.resource) {
      // Finish the trip to the drop-off before switching resources.
      this._setTask(unit, { type: 'gather', targetId: target.id, resource: target.resource, phase: 'deposit' });
    } else this._setTask(unit, { type: 'gather', targetId: target.id, resource: target.resource, phase: 'harvest' });
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state !== 'playing') return;
    let remaining = Math.min(dt, 600);
    while (remaining > 1e-7 && this.state === 'playing') {
      const step = Math.min(remaining, 0.2);
      this._step(step);
      remaining -= step;
    }
  }

  _step(dt) {
    this.time += dt;
    this._fogClock -= dt;
    this._aiClock -= dt;
    for (const e of this.entities) {
      if (e.hp <= 0) continue;
      if (e.flash) e.flash = Math.max(0, e.flash - dt);
      if (e.kind === 'unit') this._updateUnit(e, dt);
      else if (e.kind === 'building' && e.progress >= 1) this._updateBuilding(e, dt);
    }
    this._separateUnits(dt);
    for (const p of this.projectiles) { p.life -= dt; p.progress = 1 - p.life / p.duration; p.x = p.startX + (p.targetX - p.startX) * p.progress; p.y = p.startY + (p.targetY - p.startY) * p.progress; }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter(e => e.life > 0);
    const dead = this.entities.filter(e => e.hp <= 0 || (e.kind === 'resource' && e.amount <= 0));
    if (dead.length) {
      const ids = new Set(dead.map(e => e.id));
      this.entities = this.entities.filter(e => !ids.has(e.id));
      for (const id of ids) this.selected.delete(id);
      if (dead.some(e => e.kind === 'building')) this._navVersion++;
    }
    if (this._fogClock <= 0) { this._updateVisibility(); this._fogClock = 0.4; }
    if (this._aiClock <= 0 && this.state === 'playing') { this._updateAI(); this._aiClock = 3; }
  }

  _updateUnit(u, dt) {
    u.animation += dt;
    u.attackClock = Math.max(0, u.attackClock - dt);
    u.acquireClock -= dt;
    if (u.task.type === 'attack' && u.task.targetId) {
      const target = this.getEntity(u.task.targetId);
      if (target && target.owner !== u.owner && target.owner !== 'neutral') { this._fight(u, target, dt); return; }
      this._setTask(u, { type: 'idle' });
    }
    if (u.type !== 'villager' && u.task.type !== 'move') {
      let target = this.getEntity(u.combatTargetId);
      if (target && distance(u, target) > (u.task.type === 'idle' ? 12 : 10)) target = null;
      if (u.acquireClock <= 0 && !target) {
        target = this._nearestEnemy(u, u.type === 'trebuchet' ? 12 : 6.5);
        u.combatTargetId = target?.id;
        u.acquireClock = 0.45;
      }
      if (target) { this._fight(u, target, dt); return; }
    }
    switch (u.task.type) {
      case 'move': case 'attack':
        if (this._moveUnit(u, u.task.x, u.task.y, dt, 0.2)) this._setTask(u, { type: 'idle' });
        break;
      case 'gather': this._gather(u, dt); break;
      case 'build': this._build(u, dt); break;
      case 'repair': this._repair(u, dt); break;
    }
  }

  _gather(u, dt) {
    const t = u.task;
    let target = this.getEntity(t.targetId);
    const capacity = this._techsOf(u.owner).has('wheelbarrow') ? 18 : 12;
    if (u.carrying.amount >= capacity - 0.01) t.phase = 'deposit';
    if (t.phase === 'deposit') {
      if (u.carrying.amount <= 0) { t.phase = 'harvest'; return; }
      let dropoff = this.getEntity(t.dropoffId);
      if (!dropoff || dropoff.progress < 1) {
        dropoff = this._dropoff(u, u.carrying.resource);
        t.dropoffId = dropoff?.id;
      }
      if (!dropoff) { this._setTask(u, { type: 'idle' }); return; }
      if (this._moveUnit(u, dropoff.x, dropoff.y, dt, dropoff.size / 2 + 0.55)) {
        this._stock(u.owner)[u.carrying.resource] += u.carrying.amount;
        if (u.owner === 'player') this.stats.resourcesGathered += u.carrying.amount;
        u.carrying = { resource: null, amount: 0 }; u.carriedAmount = 0; u.carriedResource = null;
        t.phase = 'harvest'; t.dropoffId = null; u.path = [];
      }
      return;
    }
    if (!target || target.amount <= 0 || (target.kind === 'building' && target.progress < 1)) {
      target = this.nearestResource(u.x, u.y, t.resource, u.owner);
      if (!target) {
        if (u.carrying.amount > 0) t.phase = 'deposit';
        else this._setTask(u, { type: 'idle' });
        return;
      }
      t.targetId = target.id; u.path = [];
    }
    const reach = target.kind === 'building' ? 0.9 : 0.78;
    if (!this._moveUnit(u, target.x, target.y, dt, reach)) return;
    const rate = (t.resource === 'wood' ? 1.65 : t.resource === 'food' ? 1.85 : 1.45) * (this._techsOf(u.owner).has('wheelbarrow') ? 1.25 : 1);
    const amount = Math.min(rate * dt, capacity - u.carrying.amount, target.amount);
    target.amount -= amount;
    u.carrying.resource = t.resource; u.carrying.amount += amount;
    u.carriedResource = t.resource; u.carriedAmount = u.carrying.amount;
    u.working = true;
    if (target.type === 'farm' && target.amount <= 0.01) {
      // Farms persist; a small wood expense automatically replants harvested fields.
      if (this._stock(u.owner).wood >= 25) { this._stock(u.owner).wood -= 25; target.amount = 1200; }
      else { target.amount = 120; }
    }
    if (target.amount <= 0.01 || u.carrying.amount >= capacity - 0.01) t.phase = 'deposit';
  }

  _dropoff(u, resource) {
    const types = resource === 'wood' ? ['towncenter', 'lumbercamp'] : resource === 'food' ? ['towncenter', 'mill'] : ['towncenter', 'miningcamp'];
    return this.entities.filter(b => b.owner === u.owner && b.kind === 'building' && b.progress >= 1 && b.hp > 0 && types.includes(b.type)).sort((a, b) => distance(a, u) - distance(b, u))[0];
  }

  _build(u, dt) {
    const b = this.getEntity(u.task.targetId);
    if (!b || b.owner !== u.owner) { this._resumeWorker(u); return; }
    if (b.progress >= 1) { this._resumeWorker(u, b); return; }
    if (!this._moveUnit(u, b.x, b.y, dt, b.size / 2 + 0.65)) return;
    const count = this.entities.filter(w => w.type === 'villager' && w.task?.type === 'build' && w.task.targetId === b.id && distance(w, b) <= b.size / 2 + 0.85).length;
    const added = Math.min(1 - b.progress, dt / (BUILDINGS[b.type].time * (1 + Math.max(0, count - 1) * 0.35)));
    b.progress += added;
    b.hp = Math.min(b.maxHp, b.hp + added * b.maxHp);
    u.working = true;
    if (b.progress >= 1 - 1e-7) {
      b.progress = 1;
      if (b.owner === 'player') this.stats.buildingsBuilt++;
      if (b.owner === 'player') this.event(`${BUILDINGS[b.type].name} completed.`, 'build');
      this.effects.push({ type: 'build', x: b.x, y: b.y, life: 1.5, maxLife: 1.5 });
      this._resumeWorker(u, b);
    }
  }

  _resumeWorker(u, building) {
    if (building?.type === 'farm' && !this.entities.some(w => w.id !== u.id && w.type === 'villager' && w.task?.type === 'gather' && w.task.targetId === building.id)) { this._assignGather(u, building); return; }
    if (u.resumeTask?.type === 'gather') {
      const target = this.getEntity(u.resumeTask.targetId) || this.nearestResource(u.x, u.y, u.resumeTask.resource, u.owner);
      u.resumeTask = null;
      if (target) { this._assignGather(u, target); return; }
    }
    const resource = building?.type === 'miningcamp' ? 'gold' : building?.type === 'mill' ? 'food' : 'wood';
    this._assignGather(u, this.nearestResource(u.x, u.y, resource, u.owner));
  }

  _repair(u, dt) {
    const b = this.getEntity(u.task.targetId);
    if (!b || b.owner !== u.owner || b.hp >= b.maxHp) { this._resumeWorker(u); return; }
    if (b.progress < 1) { u.task.type = 'build'; return; }
    if (!this._moveUnit(u, b.x, b.y, dt, b.size / 2 + 0.65)) return;
    const heal = Math.min(22 * dt, b.maxHp - b.hp, this._stock(u.owner).wood / 0.025);
    this._stock(u.owner).wood -= heal * 0.025;
    b.hp += heal; u.working = heal > 0;
  }

  _updateBuilding(b, dt) {
    if (b.queue.length) {
      const q = b.queue[0];
      if (!(q.kind === 'unit' && this._population(b.owner) >= this._populationCap(b.owner))) {
        q.elapsed += dt; q.progress = Math.min(1, q.elapsed / q.duration);
      }
      if (q.progress >= 1) {
        b.queue.shift();
        if (q.kind === 'unit') {
          const exit = this._nearestWalkable(b.x + b.size / 2 + 0.7, b.y + 0.5);
          const unit = this._addUnit(q.type, b.owner, exit.x, exit.y);
          if (q.type === 'villager' && b.owner === 'enemy') this._aiAssignWorker(unit);
          else if (b.rally) this._setTask(unit, { type: 'move', x: b.rally.x, y: b.rally.y });
          if (b.owner === 'player') this.event(`${UNITS[q.type].name} ready.`, 'train');
        } else if (q.kind === 'age') {
          if (b.owner === 'player') { this.age = q.targetAge; this.event(`You have reached the ${AGES[this.age - 1]}!`, 'age'); }
          else { this.enemyAge = q.targetAge; this.event(`Your rival has reached the ${AGES[this.enemyAge - 1]}.`, 'enemy'); }
          for (const u of this.entities.filter(e => e.owner === b.owner && e.kind === 'unit' && e.type !== 'villager')) {
            const maxHp = UNITS[u.type].hp * (1 + 0.15 * (q.targetAge - 1));
            u.hp += maxHp - u.maxHp; u.maxHp = maxHp;
          }
        } else if (q.kind === 'tech') {
          this._techsOf(b.owner).add(q.type);
          if (b.owner === 'player') this.event(`${TECHS[q.type].name} researched.`, 'research');
        }
      }
    }
    const def = BUILDINGS[b.type];
    const attack = def.attack || (b.type === 'towncenter' ? 9 : 0);
    if (!attack) return;
    b.attackClock = Math.max(0, b.attackClock - dt);
    if (b.attackClock > 0) return;
    const target = this._nearestEnemy(b, def.range || 7);
    if (!target) return;
    b.attackClock = b.type === 'castle' ? 1 : 1.6;
    this._projectile(b, target, 'arrow');
    this._damage(target, attack + (this._ageOf(b.owner) - 1) * 2, b);
  }

  _nearestEnemy(source, range) {
    let target, best = Infinity;
    for (const e of this.entities) {
      if (e.owner !== opposite(source.owner) || e.hp <= 0 || distance(source, e) > range + (e.kind === 'building' ? e.size / 2 : 0)) continue;
      if (e.kind !== 'unit' && e.kind !== 'building') continue;
      const score = distance(source, e) + (e.kind === 'building' ? 2 : 0) + (source.type === 'trebuchet' && e.kind === 'unit' ? 6 : 0);
      if (score < best) { best = score; target = e; }
    }
    return target;
  }

  _fight(u, target, dt) {
    const def = UNITS[u.type];
    const reach = def.range + (target.kind === 'building' ? target.size / 2 : 0.22);
    if (!this._moveUnit(u, target.x, target.y, dt, reach)) return;
    u.facing = target.x >= u.x ? 1 : -1;
    if (u.attackClock > 0) return;
    u.attackClock = intervals[u.type];
    let attack = def.attack + (u.type === 'villager' ? 0 : (this._ageOf(u.owner) - 1) * 2 + (this._techsOf(u.owner).has('forging') ? 2 : 0));
    if (u.type === 'spearman' && (target.type === 'knight' || target.type === 'scout')) attack += target.type === 'knight' ? 22 : 15;
    if (u.type === 'archer' && target.type === 'spearman') attack += 3;
    if (u.type === 'trebuchet') attack *= target.kind === 'building' ? 2.5 : 0.35;
    if (def.range > 2) this._projectile(u, target, u.type === 'trebuchet' ? 'stone' : 'arrow');
    this._damage(target, attack, u);
  }

  _projectile(source, target, type) {
    const duration = clamp(distance(source, target) / (type === 'stone' ? 13 : 20), 0.12, 0.8);
    this.projectiles.push({ id: this._nextId++, type, owner: source.owner, x: source.x, y: source.y, startX: source.x, startY: source.y, targetX: target.x, targetY: target.y, tx: target.x, ty: target.y, life: duration, duration, progress: 0 });
  }

  _damage(target, amount, source) {
    const armor = (target.type === 'knight' ? 3 : target.kind === 'building' ? target.type === 'castle' ? 5 : 2 : 0) + (target.kind === 'unit' && target.type !== 'villager' && this._techsOf(target.owner).has('armor') ? 2 : 0);
    target.hp -= Math.max(1, amount - armor);
    target.flash = 0.15;
    this.effects.push({ type: 'hit', x: target.x, y: target.y, life: 0.2, maxLife: 0.2, owner: source.owner });
    if (target.kind === 'unit' && target.type === 'villager' && target.task.type === 'idle' && distance(target, source) < 2) this._setTask(target, { type: 'attack', targetId: source.id });
    if (target.hp > 0) return;
    target.hp = 0;
    if (target.kind === 'unit') {
      if (target.owner === 'enemy' && source.owner === 'player') this.stats.kills++;
      if (target.owner === 'player') this.stats.lost++;
    }
    this.effects.push({ type: target.kind === 'building' ? 'collapse' : 'death', x: target.x, y: target.y, life: 1.4, maxLife: 1.4, owner: target.owner });
    if (target.kind === 'building' && target.owner === 'player') this.event(`${BUILDINGS[target.type].name} destroyed!`, 'danger');
    if (target.id === this.enemyTownCenterId) {
      this.state = 'won'; this.event('Victory! The rival Town Center has fallen. Your empire stands triumphant.', 'victory');
    } else if (target.id === this.playerTownCenterId) {
      this.state = 'lost'; this.event('Your Town Center has fallen. The rival has conquered your settlement.', 'defeat');
    }
  }

  _speed(u) { return UNITS[u.type].speed * (u.type === 'villager' && this._techsOf(u.owner).has('wheelbarrow') ? 1.25 : 1); }

  _walkable(x, y, radius = 0.2) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0.5 || y < 0.5 || x >= MAP_SIZE - 0.5 || y >= MAP_SIZE - 0.5) return false;
    if (this.terrain[Math.floor(y) * MAP_SIZE + Math.floor(x)] === 1) return false;
    for (const e of this.entities) {
      if (e.kind !== 'building' || e.hp <= 0 || e.type === 'farm') continue;
      if (Math.abs(x - e.x) < e.size / 2 + radius && Math.abs(y - e.y) < e.size / 2 + radius) return false;
    }
    return true;
  }

  _nearestWalkable(x, y) {
    x = clamp(Number.isFinite(x) ? x : 1, 0.6, MAP_SIZE - 0.6);
    y = clamp(Number.isFinite(y) ? y : 1, 0.6, MAP_SIZE - 0.6);
    if (this._walkable(x, y)) return { x, y };
    for (let r = 0.5; r < 10; r += 0.5) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const tx = x + Math.cos(angle) * r, ty = y + Math.sin(angle) * r;
        if (this._walkable(tx, ty)) return { x: tx, y: ty };
      }
    }
    return { x: 1.5, y: 1.5 };
  }

  _lineWalkable(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
    for (let i = 1; i <= steps; i++) if (!this._walkable(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, 0.18)) return false;
    return true;
  }

  _moveUnit(u, x, y, dt, reach = 0.2) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { this._setTask(u, { type: 'idle' }); return true; }
    // Recover older saves and any unit displaced into a footprint by a newly
    // erected structure; A* cannot leave a blocked starting cell by itself.
    if (!this._walkable(u.x, u.y, 0.12)) {
      const escape = this._nearestWalkable(u.x, u.y);
      u.x = escape.x; u.y = escape.y;
      u.path = []; u.pathGoal = null;
    }
    const d = Math.hypot(x - u.x, y - u.y);
    u.working = false;
    if (d <= reach + 0.035) { u.path = []; return true; }
    let goal = { x, y };
    if (reach > 0.4) {
      goal = { x: x + (u.x - x) / d * Math.max(0.25, reach - 0.08), y: y + (u.y - y) / d * Math.max(0.25, reach - 0.08) };
      if (!this._walkable(goal.x, goal.y)) {
        let best, bd = Infinity;
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8;
          const c = { x: x + Math.cos(angle) * (reach - 0.05), y: y + Math.sin(angle) * (reach - 0.05) };
          if (this._walkable(c.x, c.y) && distance(c, u) < bd) { best = c; bd = distance(c, u); }
        }
        if (best) goal = best;
      }
    }
    goal = this._nearestWalkable(goal.x, goal.y);
    let waypoint = goal;
    if (!this._lineWalkable(u.x, u.y, goal.x, goal.y)) {
      const changed = !u.pathGoal || distance(u.pathGoal, goal) > 1.5 || u.pathVersion !== this._navVersion;
      if (changed || !u.path.length) {
        u.path = this._findPath(u.x, u.y, goal.x, goal.y);
        u.pathGoal = goal; u.pathVersion = this._navVersion;
      }
      while (u.path.length && distance(u, u.path[0]) < 0.3) u.path.shift();
      if (u.path.length) {
        while (u.path.length > 1 && this._lineWalkable(u.x, u.y, u.path[1].x, u.path[1].y)) u.path.shift();
        waypoint = u.path[0];
      }
    } else u.path = [];
    const wd = Math.hypot(waypoint.x - u.x, waypoint.y - u.y);
    if (wd < 0.001) return d <= reach + 0.15;
    const amount = Math.min(this._speed(u) * dt, wd);
    const dx = (waypoint.x - u.x) / wd * amount, dy = (waypoint.y - u.y) / wd * amount;
    if (this._walkable(u.x + dx, u.y + dy, 0.16)) { u.x += dx; u.y += dy; }
    else if (this._walkable(u.x + dx, u.y, 0.16)) u.x += dx;
    else if (this._walkable(u.x, u.y + dy, 0.16)) u.y += dy;
    else { u.path = []; u.pathGoal = null; }
    u.facing = dx >= 0 ? 1 : -1;
    return Math.hypot(x - u.x, y - u.y) <= reach + 0.035;
  }

  _findPath(ax, ay, bx, by) {
    if (this._gridVersion !== this._navVersion) {
      this._navGrid = new Uint8Array(MAP_SIZE * MAP_SIZE);
      for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) this._navGrid[y * MAP_SIZE + x] = this._walkable(x + 0.5, y + 0.5, 0.12) ? 1 : 0;
      this._gridVersion = this._navVersion;
    }
    const start = clamp(Math.floor(ay), 0, MAP_SIZE - 1) * MAP_SIZE + clamp(Math.floor(ax), 0, MAP_SIZE - 1);
    let end = clamp(Math.floor(by), 0, MAP_SIZE - 1) * MAP_SIZE + clamp(Math.floor(bx), 0, MAP_SIZE - 1);
    if (!this._navGrid[end]) {
      let best = Infinity;
      for (let yy = Math.max(0, Math.floor(by) - 3); yy <= Math.min(MAP_SIZE - 1, Math.floor(by) + 3); yy++) {
        for (let xx = Math.max(0, Math.floor(bx) - 3); xx <= Math.min(MAP_SIZE - 1, Math.floor(bx) + 3); xx++) {
          const id = yy * MAP_SIZE + xx, d = Math.hypot(xx + 0.5 - bx, yy + 0.5 - by);
          if (this._navGrid[id] && d < best) { best = d; end = id; }
        }
      }
    }
    const count = MAP_SIZE * MAP_SIZE, scores = new Float32Array(count).fill(Infinity), parent = new Int32Array(count).fill(-1), closed = new Uint8Array(count);
    const heap = [], ex = end % MAP_SIZE, ey = Math.floor(end / MAP_SIZE);
    const push = (id, f) => {
      const item = { id, f }; heap.push(item); let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= f) break; heap[i] = heap[p]; i = p; } heap[i] = item;
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++; if (heap[c].f >= last.f) break; heap[i] = heap[c]; i = c; } heap[i] = last; }
      return top.id;
    };
    scores[start] = 0; push(start, Math.hypot(ax - bx, ay - by));
    let found = false, iterations = 0;
    while (heap.length && iterations++ < count * 2) {
      const id = pop(); if (closed[id]) continue;
      if (id === end) { found = true; break; }
      closed[id] = 1;
      const x = id % MAP_SIZE, y = Math.floor(id / MAP_SIZE);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE) continue;
        const next = ny * MAP_SIZE + nx;
        if (!this._navGrid[next] || closed[next]) continue;
        if (dx && dy && (!this._navGrid[y * MAP_SIZE + nx] || !this._navGrid[ny * MAP_SIZE + x])) continue;
        const g = scores[id] + (dx && dy ? 1.4142 : 1);
        if (g >= scores[next]) continue;
        scores[next] = g; parent[next] = id; push(next, g + Math.hypot(nx - ex, ny - ey));
      }
    }
    if (!found) return [];
    const path = [];
    for (let id = end; id !== start && id >= 0; id = parent[id]) path.push({ x: id % MAP_SIZE + 0.5, y: Math.floor(id / MAP_SIZE) + 0.5 });
    path.reverse(); path.push({ x: bx, y: by });
    return path;
  }

  _separateUnits(dt) {
    const units = this.entities.filter(e => e.kind === 'unit' && e.hp > 0);
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j], dx = a.x - b.x, dy = a.y - b.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) continue;
        const d = Math.hypot(dx, dy), spacing = a.type === 'knight' || b.type === 'knight' ? 0.48 : 0.4;
        if (d >= spacing) continue;
        const force = Math.min(0.12, (spacing - d) * dt * 3), nx = d > 0.001 ? dx / d : (a.id % 2 ? 1 : -1), ny = d > 0.001 ? dy / d : 0;
        if (this._walkable(a.x + nx * force, a.y + ny * force, 0.14)) { a.x += nx * force; a.y += ny * force; }
        if (this._walkable(b.x - nx * force, b.y - ny * force, 0.14)) { b.x -= nx * force; b.y -= ny * force; }
      }
    }
  }

  _updateVisibility() {
    this.visible.fill(0);
    for (const e of this.entities) {
      if (e.owner !== 'player' || e.hp <= 0) continue;
      const radius = e.kind === 'unit' ? e.type === 'scout' ? 9 : e.type === 'trebuchet' ? 11 : 6 : e.type === 'towncenter' ? 9 : 6;
      for (let y = Math.max(0, Math.floor(e.y - radius)); y <= Math.min(MAP_SIZE - 1, Math.ceil(e.y + radius)); y++) {
        for (let x = Math.max(0, Math.floor(e.x - radius)); x <= Math.min(MAP_SIZE - 1, Math.ceil(e.x + radius)); x++) {
          if ((x + 0.5 - e.x) ** 2 + (y + 0.5 - e.y) ** 2 <= radius * radius) { const id = y * MAP_SIZE + x; this.visible[id] = 1; this.explored[id] = 1; }
        }
      }
    }
  }

  _aiAssignWorker(u) {
    const workers = this.entities.filter(e => e.owner === 'enemy' && e.type === 'villager');
    const counts = { food: 0, wood: 0, gold: 0, stone: 0 };
    for (const w of workers) if (w.task?.resource) counts[w.task.resource]++;
    const target = counts.food < Math.ceil(workers.length * 0.42) ? 'food' : counts.wood < Math.ceil(workers.length * 0.3) ? 'wood' : counts.gold < Math.ceil(workers.length * 0.2) ? 'gold' : 'stone';
    this._assignGather(u, this.nearestResource(u.x, u.y, target, 'enemy'));
  }

  _aiBuild(type) {
    const tc = this.getEntity(this.enemyTownCenterId);
    if (!tc || this.entities.some(e => e.owner === 'enemy' && e.type === type && e.progress < 1)) return false;
    for (const r of [5, 7, 9, 11]) {
      const start = this._random() * Math.PI * 2;
      for (let i = 0; i < 16; i++) {
        const angle = start + i * Math.PI / 8;
        const x = tc.x + Math.cos(angle) * r, y = tc.y + Math.sin(angle) * r;
        if (!this._canBuild(type, x, y, 'enemy').ok) continue;
        const workers = this.entities.filter(e => e.owner === 'enemy' && e.type === 'villager' && e.task.type !== 'build').sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }));
        return this._placeBuilding(type, x, y, workers.slice(0, 2).map(e => e.id), 'enemy').ok;
      }
    }
    return false;
  }

  _updateAI() {
    const enemy = this.entities.filter(e => e.owner === 'enemy' && e.hp > 0);
    const buildings = enemy.filter(e => e.kind === 'building' && e.progress >= 1);
    const workers = enemy.filter(e => e.type === 'villager');
    const tc = this.getEntity(this.enemyTownCenterId);
    if (!tc) return;
    const targetWorkers = this.difficulty === 'hard' ? 19 : this.difficulty === 'relaxed' ? 11 : 15;
    if (this._population('enemy') + this._queuedPopulation('enemy') >= this._populationCap('enemy') - 2 && this.enemyResources.wood > 40) this._aiBuild('house');
    if (workers.length + tc.queue.filter(q => q.kind === 'unit').length < targetWorkers && tc.queue.length < 2 && this.enemyResources.food > 80 && !tc.queue.some(q => q.kind === 'age')) this._train(tc.id, 'villager', 'enemy');
    for (const w of workers) if (w.task.type === 'idle') this._aiAssignWorker(w);

    const ageAt = this.difficulty === 'hard' ? [95, 320, 620] : this.difficulty === 'relaxed' ? [240, 660, 1100] : [145, 430, 800];
    if (this.enemyAge < 4 && this.time > ageAt[this.enemyAge - 1] && !tc.queue.some(q => q.kind === 'age')) this._advanceAge(tc.id, 'enemy');
    if (this.enemyAge >= 2) {
      if (!enemy.some(e => e.type === 'archery')) this._aiBuild('archery');
      else if (!enemy.some(e => e.type === 'stable')) this._aiBuild('stable');
      else if (!enemy.some(e => e.type === 'tower') && this.time > 260) this._aiBuild('tower');
      else if (!enemy.some(e => e.type === 'blacksmith') && this.time > 360) this._aiBuild('blacksmith');
      const smith = buildings.find(e => e.type === 'blacksmith');
      if (smith && this.time > 400 && this.enemyResources.food > 220) this._research(smith.id, this.enemyTechs.has('forging') ? 'armor' : 'forging', 'enemy');
    }
    if (this.time > 230 && enemy.filter(e => e.type === 'farm').length < Math.min(5, Math.floor(this.time / 140))) this._aiBuild('farm');
    if (this.enemyAge >= 3 && !enemy.some(e => e.type === 'castle') && this.time > 660) this._aiBuild('castle');
    const army = enemy.filter(e => e.kind === 'unit' && e.type !== 'villager');
    const cap = this.difficulty === 'hard' ? 22 : this.difficulty === 'relaxed' ? 9 : 16;
    const desired = Math.min(cap, 3 + Math.floor(Math.max(0, this.time - this._firstWave + 70) / 65));
    if (this.time > this._firstWave - 60 && army.length + this._queuedPopulation('enemy') < desired) {
      for (const b of buildings.filter(e => BUILDINGS[e.type].trains?.some(t => t !== 'villager'))) {
        if (b.queue.length > 1) continue;
        const type = b.type === 'barracks' ? this._random() < 0.25 ? 'spearman' : 'militia' : b.type === 'archery' ? 'archer' : b.type === 'stable' ? this.enemyAge >= 3 ? 'knight' : 'scout' : 'trebuchet';
        this._train(b.id, type, 'enemy');
      }
    }
    if (this.time >= this._nextWave) {
      const available = army.filter(u => u.task.type !== 'attack');
      const strength = Math.min(available.length, this.difficulty === 'hard' ? 5 + Math.floor(this.time / 180) : this.difficulty === 'relaxed' ? 2 + Math.floor(this.time / 400) : 3 + Math.floor(this.time / 220));
      if (strength >= 2) {
        const target = this.entities.filter(e => e.owner === 'player' && e.kind === 'building' && e.hp > 0).sort((a, b) => distance(a, tc) + (a.type === 'towncenter' ? 3 : 0) - distance(b, tc) - (b.type === 'towncenter' ? 3 : 0))[0];
        if (target) {
          for (const u of available.slice(0, strength)) { this._setTask(u, { type: 'attack', targetId: target.id }); u.raider = true; }
          this.event('Enemy raiders are marching toward your settlement.', 'danger');
        }
        this._nextWave = this.time + (this.difficulty === 'hard' ? 80 : this.difficulty === 'relaxed' ? 160 : 110);
      } else this._nextWave = this.time + 15;
    }
    // Raiders that finish an outer building continue toward the heart of town.
    const playerTC = this.getEntity(this.playerTownCenterId);
    if (playerTC) for (const u of army) if (u.raider && u.task.type === 'idle') this._setTask(u, { type: 'attack', targetId: playerTC.id });
  }
}
