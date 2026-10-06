export const SIZE = 48;
export const AGES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];
export const AGE_ROMAN = ['I', 'II', 'III', 'IV'];
export const BUILDINGS = {
  towncenter: { name: 'Town Center', sub: 'The heart of your kingdom', w: 3, d: 3, hp: 2400, cost: { wood: 275, stone: 100 }, age: 2, time: 40, pop: 10, trains: ['villager'], icon: 'towncenter', range: 7, attack: 11 },
  house: { name: 'House', sub: 'Room for five more settlers', w: 2, d: 2, hp: 650, cost: { wood: 50 }, age: 0, time: 12, pop: 5, icon: 'house' },
  lumbercamp: { name: 'Lumber Camp', sub: 'Nearby wood drop-off · forestry upgrades', w: 2, d: 2, hp: 700, cost: { wood: 100 }, age: 0, time: 17, icon: 'wood', tech: ['axe'] },
  mill: { name: 'Mill', sub: 'Nearby food drop-off · farming upgrades', w: 2, d: 2, hp: 700, cost: { wood: 100 }, age: 0, time: 17, icon: 'mill', tech: ['wheelbarrow'] },
  miningcamp: { name: 'Mining Camp', sub: 'A closer drop-off for gold and stone', w: 2, d: 2, hp: 700, cost: { wood: 100 }, age: 0, time: 17, icon: 'stone' },
  farm: { name: 'Farm', sub: 'Produces food · automatically reseeded for 30 wood', w: 2, d: 2, hp: 400, cost: { wood: 60 }, age: 0, time: 8, icon: 'food' },
  barracks: { name: 'Barracks', sub: 'Train infantry and spearmen', w: 3, d: 2, hp: 1400, cost: { wood: 175 }, age: 0, time: 25, icon: 'sword', trains: ['militia', 'spearman'] },
  archery: { name: 'Archery Range', sub: 'Train archers · keep them behind your infantry', w: 3, d: 2, hp: 1200, cost: { wood: 175 }, age: 1, time: 25, icon: 'bow', trains: ['archer'] },
  stable: { name: 'Stable', sub: 'Train scouts and armored knights', w: 3, d: 2, hp: 1400, cost: { wood: 175 }, age: 1, time: 25, icon: 'horse', trains: ['scout', 'knight'] },
  blacksmith: { name: 'Blacksmith', sub: 'Better weapons, armor, and defenses', w: 2, d: 2, hp: 1100, cost: { wood: 150 }, age: 1, time: 22, icon: 'anvil', tech: ['forging', 'fletching', 'masonry'] },
  market: { name: 'Market', sub: 'Exchange your surplus resources for gold', w: 3, d: 2, hp: 1200, cost: { wood: 175 }, age: 1, time: 25, icon: 'gold' },
  tower: { name: 'Watch Tower', sub: 'Protect your settlement with ranged fire', w: 1, d: 1, hp: 1200, cost: { wood: 50, stone: 125 }, age: 1, time: 25, icon: 'tower', range: 8, attack: 15 },
  siege: { name: 'Siege Workshop', sub: 'Train rams to bring down enemy buildings', w: 3, d: 2, hp: 1400, cost: { wood: 200 }, age: 2, time: 30, icon: 'ram', trains: ['ram'] },
  castle: { name: 'Castle', sub: 'A powerful fortress · train elite longbowmen', w: 4, d: 4, hp: 4200, cost: { stone: 550 }, age: 2, time: 55, pop: 20, icon: 'castle', range: 10, attack: 26, trains: ['longbow'] },
};
export const UNITS = {
  villager: { name: 'Villager', sub: 'Gather resources, construct, and repair', hp: 45, attack: 3, range: 1, speed: 1.65, cost: { food: 50 }, time: 12, age: 0, icon: 'villager' },
  militia: { name: 'Militia', sub: 'Reliable infantry · grows stronger each age', hp: 65, attack: 9, range: 1.1, speed: 1.65, cost: { food: 60, gold: 20 }, time: 15, age: 0, icon: 'sword' },
  spearman: { name: 'Spearman', sub: 'Infantry · deals bonus damage to cavalry', hp: 65, attack: 7, range: 1.4, speed: 1.7, cost: { food: 35, wood: 25 }, time: 14, age: 1, icon: 'spear' },
  archer: { name: 'Archer', sub: 'Ranged infantry · vulnerable at close range', hp: 45, attack: 7, range: 5.5, speed: 1.65, cost: { wood: 25, gold: 35 }, time: 16, age: 1, icon: 'bow' },
  scout: { name: 'Scout Cavalry', sub: 'Fast exploration · wide line of sight', hp: 85, attack: 7, range: 1.2, speed: 2.7, cost: { food: 80 }, time: 18, age: 0, icon: 'horse' },
  knight: { name: 'Knight', sub: 'Heavy cavalry · fast and resilient', hp: 155, attack: 15, range: 1.3, speed: 2.35, cost: { food: 60, gold: 75 }, time: 24, age: 2, icon: 'horse' },
  ram: { name: 'Battering Ram', sub: 'Devastates buildings · resists arrows', hp: 340, attack: 65, range: 1.5, speed: 0.9, cost: { wood: 150, gold: 75 }, time: 28, age: 2, icon: 'ram' },
  longbow: { name: 'Longbowman', sub: 'Elite ranged unit · exceptional reach', hp: 65, attack: 12, range: 8, speed: 1.7, cost: { wood: 35, gold: 45 }, time: 18, age: 2, icon: 'bow' },
};
export const TECHS = {
  loom: { name: 'Loom', sub: 'Villagers gain 25 health and 1 armor', cost: { gold: 50 }, time: 20, age: 0, icon: 'loom' },
  axe: { name: 'Double-bit Axe', sub: 'Villagers gather wood 35% faster', cost: { food: 100, wood: 50 }, time: 25, age: 1, icon: 'wood' },
  wheelbarrow: { name: 'Wheelbarrow', sub: 'All gathering is 25% faster; carry more', cost: { food: 175, wood: 50 }, time: 30, age: 1, icon: 'wheel' },
  forging: { name: 'Forging', sub: 'Melee units gain +3 attack', cost: { food: 120, gold: 50 }, time: 25, age: 1, icon: 'sword' },
  fletching: { name: 'Fletching', sub: 'Ranged units gain +2 attack and +1 range', cost: { food: 100, gold: 50 }, time: 25, age: 1, icon: 'bow' },
  masonry: { name: 'Masonry', sub: 'Buildings gain 30% health', cost: { food: 150, stone: 100 }, time: 30, age: 2, icon: 'stone' },
};
export const AGE_COSTS = [{ food: 400, gold: 100 }, { food: 700, gold: 300 }, { food: 1000, gold: 600 }];
export const AGE_TIMES = [45, 60, 75];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const center = e => ({ x: e.x + (e.w || 0) / 2, y: e.y + (e.d || 0) / 2 });
export const hash = (x, y, z = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
export function terrain(x, y) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return 'void';
  if ((x - 42) ** 2 / 95 + (y - 37) ** 2 / 135 < 1 + Math.sin(y * .9) * .055) return 'water';
  return 'grass';
}
export class Game {
  constructor(difficulty = 'standard') {
    this.difficulty = difficulty;
    this.entities = []; this.byId = new Map(); this.nextId = 1;
    this.players = [0, 1].map(id => ({ id, age: 0, resources: { food: 300, wood: 380, gold: 180, stone: 160 }, techs: [], stats: { gathered: 0, trained: 0, villagersTrained: 0, kills: 0, built: 0, lost: 0 }, defeated: false }));
    this.time = 0; this.paused = false; this.speed = 1; this.result = null;
    this.explored = new Uint8Array(SIZE * SIZE); this.visible = new Uint8Array(SIZE * SIZE);
    this.fogTimer = 1; this.aiTimer = 0; this.nextRaid = difficulty === 'peaceful' ? 360 : difficulty === 'hard' ? 125 : 210;
    this.raids = 0; this.effects = []; this.onEvent = () => {}; this.createWorld(); this.updateFog();
  }
  add(e) { e.id = this.nextId++; e.alive = true; this.entities.push(e); this.byId.set(e.id, e); return e; }
  get(id) { const e = this.byId.get(id); return e?.alive ? e : null; }
  own(owner, kind) { return this.entities.filter(e => e.alive && e.owner === owner && (!kind || e.kind === kind)); }
  building(type, x, y, owner = 0, complete = true) {
    const def = BUILDINGS[type], boost = this.players[owner].techs.includes('masonry') ? 1.3 : 1;
    return this.add({ kind: 'building', type, x, y, w: def.w, d: def.d, owner, hp: complete ? def.hp * boost : def.hp * .1, maxHp: def.hp * boost, progress: complete ? 1 : 0, queue: [], cooldown: 0, amount: type === 'farm' ? 900 : undefined, rally: null });
  }
  unitStats(owner, type) {
    const d = UNITS[type], p = this.players[owner], age = p.age, upgraded = Math.max(0, age - 1);
    const hpBonus = type === 'militia' ? age * 15 : type === 'archer' ? upgraded * 10 : type === 'spearman' ? upgraded * 15 : type === 'scout' ? upgraded * 20 : ['knight', 'longbow'].includes(type) ? Math.max(0, age - 2) * 25 : type === 'villager' && p.techs.includes('loom') ? 25 : 0;
    const attackBonus = type === 'militia' ? age * 3 : ['archer', 'spearman'].includes(type) ? upgraded * 2 : type === 'scout' ? upgraded * 2 : ['knight', 'longbow'].includes(type) ? Math.max(0, age - 2) * 3 : 0;
    return { ...d, hp: d.hp + hpBonus, attack: d.attack + attackBonus, range: d.range + (['archer', 'longbow'].includes(type) && p.techs.includes('fletching') ? 1 : 0) };
  }
  unit(type, x, y, owner = 0) {
    const hp = this.unitStats(owner, type).hp;
    return this.add({ kind: 'unit', type, x, y, owner, hp, maxHp: hp, order: { type: 'idle' }, path: [], cooldown: 0, carry: 0, carryType: null, anim: hash(x, y) * 9, stance: 'aggressive', garrison: null });
  }
  createWorld() {
    const groves = [[7, 22, 36], [24, 20, 39], [26, 33, 32], [6, 37, 28], [14, 9, 30], [38, 6, 35], [42, 19, 25], [27, 42, 27], [30, 25, 24], [5, 10, 24]];
    groves.forEach(([cx, cy, count], k) => {
      for (let i = 0; i < count; i++) {
        const angle = hash(i, k, 2) * Math.PI * 2, r = Math.sqrt(hash(i, k, 3)) * 3.6;
        const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
        if (terrain(x, y) === 'grass') this.add({ kind: 'resource', type: 'tree', resource: 'wood', x, y, amount: 200, style: hash(i, k, 8), owner: -1 });
      }
    });
    [[20, 19, 'gold'], [9, 29, 'stone'], [29, 9, 'gold'], [38, 15, 'stone'], [24, 29, 'gold'], [23, 8, 'stone'], [10, 40, 'gold'], [32, 31, 'stone']].forEach(([cx, cy, type], k) => {
      for (let i = 0; i < 7; i++) this.add({ kind: 'resource', type, resource: type, x: cx + hash(i, k, 1) * 2.7, y: cy + hash(i, k, 5) * 2.2, amount: 700, owner: -1, style: hash(i, k) });
    });
    [[19, 34], [32, 17]].forEach(([x, y], k) => {
      for (let i = 0; i < 9; i++) this.add({ kind: 'resource', type: 'berries', resource: 'food', x: x + hash(i, k, 4) * 2.5, y: y + hash(i, k, 6) * 1.8, amount: 200, owner: -1 });
    });
    this.add({ kind: 'doodad', type: 'ruins', x: 26, y: 13, owner: -1 });
    this.add({ kind: 'doodad', type: 'ruins', x: 10, y: 15, owner: -1 });
    this.building('towncenter', 16, 25); this.building('house', 12, 26); this.building('house', 20, 29);
    this.building('lumbercamp', 12, 21); this.building('mill', 13, 31);
    this.building('farm', 10, 32); this.building('farm', 15, 33);
    const v = [[10, 23], [11, 24], [12, 34], [16, 34], [20, 22], [21, 22], [11, 29]].map(p => this.unit('villager', ...p));
    v.forEach((u, i) => this.assignGather(u, ['wood', 'wood', 'food', 'food', 'gold', 'gold', 'stone'][i]));
    this.unit('scout', 21, 26);
    this.building('towncenter', 33, 11, 1); this.building('house', 30, 14, 1); this.building('house', 37, 11, 1);
    this.building('lumbercamp', 35, 6, 1); this.building('mill', 32, 18, 1); this.building('barracks', 36, 16, 1);
    this.building('farm', 30, 18, 1); this.building('farm', 34, 20, 1);
    [[36, 8], [37, 8], [31, 20], [35, 22], [29, 11], [30, 12], [39, 14]].map(p => this.unit('villager', ...p, 1)).forEach((u, i) => this.assignGather(u, ['wood', 'wood', 'food', 'food', 'gold', 'gold', 'stone'][i]));
    // All base footprints start clear of trees and mineral deposits.
    this.entities.forEach(e => { if (e.kind === 'resource' && this.entities.some(b => b.kind === 'building' && e.x > b.x - .3 && e.x < b.x + b.w + .3 && e.y > b.y - .3 && e.y < b.y + b.d + .3)) e.alive = false; });
  }
  pop(owner) {
    const units = this.own(owner, 'unit').length;
    const queued = this.own(owner, 'building').reduce((n, b) => n + b.queue.filter(q => q.kind === 'unit').length, 0);
    const cap = Math.min(100, this.own(owner, 'building').filter(b => b.progress >= 1).reduce((n, b) => n + (BUILDINGS[b.type].pop || 0), 0));
    return { units, queued, cap };
  }
  canAfford(owner, cost) { return Object.entries(cost).every(([k, n]) => this.players[owner].resources[k] >= n); }
  pay(owner, cost) { if (!this.canAfford(owner, cost)) return false; Object.entries(cost).forEach(([k, n]) => this.players[owner].resources[k] -= n); return true; }
  refund(owner, cost, factor = 1) { Object.entries(cost).forEach(([k, n]) => this.players[owner].resources[k] += n * factor); }
  message(text, tone = 'info', owner = 0) { if (owner === 0) this.onEvent({ text, tone }); }
  error(text, owner = 0) { this.message(text, 'warning', owner); return false; }
  ageRequirements(owner) {
    const p = this.players[owner], b = this.own(owner, 'building').filter(e => e.progress >= 1);
    if (p.age === 0) return b.filter(e => !['towncenter', 'house', 'farm'].includes(e.type)).length >= 2 ? '' : 'Build two economic or military buildings first.';
    if (p.age === 1) return b.some(e => e.type === 'blacksmith') && b.some(e => ['barracks', 'archery', 'stable'].includes(e.type)) ? '' : 'Requires a Blacksmith and a military building.';
    if (p.age === 2) return b.some(e => e.type === 'castle' || e.type === 'siege') ? '' : 'Requires a Castle or Siege Workshop.';
    return 'You have reached the Imperial Age.';
  }
  enqueue(building, type, kind = 'unit') {
    if (!building?.alive || building.progress < 1) return this.error('Finish construction first.');
    const owner = building.owner, p = this.players[owner];
    if (building.queue.length >= 8) return this.error('This production queue is full.', owner);
    let def;
    if (kind === 'age') {
      if (building.type !== 'towncenter' || p.age >= 3) return false;
      if (this.own(owner, 'building').some(b => b.queue.some(q => q.kind === 'age'))) return this.error('An age advancement is already underway.', owner);
      const req = this.ageRequirements(owner); if (req) return this.error(req, owner);
      def = { cost: AGE_COSTS[p.age], time: AGE_TIMES[p.age] };
    } else {
      def = kind === 'tech' ? TECHS[type] : UNITS[type];
      if (!def || p.age < def.age) return this.error(`Available in the ${AGES[def?.age || 0]}.`, owner);
      if (kind === 'unit' && !BUILDINGS[building.type].trains?.includes(type)) return false;
      if (kind === 'tech' && !(BUILDINGS[building.type].tech || (building.type === 'towncenter' ? ['loom'] : [])).includes(type)) return false;
      if (kind === 'unit') { const pop = this.pop(owner); if (pop.units + pop.queued >= pop.cap) return this.error('Population limit reached. Build another House.', owner); }
      if (kind === 'tech' && (p.techs.includes(type) || this.own(owner, 'building').some(b => b.queue.some(q => q.type === type)))) return this.error('This technology is already researched or queued.', owner);
    }
    if (!this.pay(owner, def.cost)) return this.error('Not enough resources.', owner);
    building.queue.push({ type, kind, elapsed: 0, duration: def.time, cost: { ...def.cost } });
    this.message(kind === 'age' ? `Your kingdom begins advancing to the ${AGES[p.age + 1]}.` : `${def.name} queued.`, 'quiet', owner);
    return true;
  }
  cancelQueue(b, index = 0) { const q = b?.queue.splice(index, 1)[0]; if (q) { this.refund(b.owner, q.cost); this.message('Queue cancelled. Resources returned.', 'quiet', b.owner); } }
  validPlacement(type, x, y) {
    const d = BUILDINGS[type];
    if (!d || x < 1 || y < 1 || x + d.w >= SIZE - 1 || y + d.d >= SIZE - 1) return false;
    for (let a = x; a < x + d.w; a++) for (let b = y; b < y + d.d; b++) if (terrain(a, b) !== 'grass') return false;
    return !this.entities.some(e => e.alive && (e.kind === 'building' ? x < e.x + e.w + .15 && x + d.w + .15 > e.x && y < e.y + e.d + .15 && y + d.d + .15 > e.y : e.kind === 'resource' && e.amount > 0 && e.x > x - .25 && e.x < x + d.w + .25 && e.y > y - .25 && e.y < y + d.d + .25));
  }
  construct(type, x, y, builders) {
    builders = builders.filter(u => u?.alive && u.type === 'villager');
    if (!builders.length) return this.error('Select a Villager to build.');
    const owner = builders[0].owner, d = BUILDINGS[type];
    if (this.players[owner].age < d.age) return this.error(`Requires the ${AGES[d.age]}.`, owner);
    if (!this.validPlacement(type, x, y)) return this.error('Find clear, dry ground for this building.', owner);
    if (owner === 0 && !this.explored[Math.floor(y) * SIZE + Math.floor(x)]) return this.error('Explore this area before building.', owner);
    if (!this.pay(owner, d.cost)) return this.error('Not enough resources.', owner);
    const b = this.building(type, x, y, owner, false);
    builders.forEach(u => this.order(u, { type: 'build', target: b.id }));
    this.message(`${d.name} foundation placed.`, 'quiet', owner); return b;
  }
  blockGrid() {
    const grid = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (terrain(x + .5, y + .5) !== 'grass') grid[y * SIZE + x] = 1;
    this.entities.forEach(b => { if (b.alive && b.kind === 'building' && b.type !== 'farm') for (let x = b.x; x < b.x + b.w; x++) for (let y = b.y; y < b.y + b.d; y++) grid[y * SIZE + x] = 1; });
    return grid;
  }
  findPath(from, target, exact = false) {
    const grid = this.blockGrid();
    let tx = Math.max(0, Math.min(SIZE - 1, Math.floor(target.x))), ty = Math.max(0, Math.min(SIZE - 1, Math.floor(target.y)));
    if (grid[ty * SIZE + tx]) {
      let best = null, dist = Infinity;
      for (let r = 1; r < 7 && !best; r++) for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < SIZE && y < SIZE && !grid[y * SIZE + x]) {
        const d = Math.hypot(x + .5 - target.x, y + .5 - target.y) + distance(from, { x, y }) * .15;
        if (d < dist) { dist = d; best = { x, y }; }
      }
      if (!best) return [];
      tx = best.x; ty = best.y; exact = false;
    }
    const sx = Math.max(0, Math.min(SIZE - 1, Math.floor(from.x))), sy = Math.max(0, Math.min(SIZE - 1, Math.floor(from.y)));
    const start = sy * SIZE + sx, end = ty * SIZE + tx;
    if (start === end) return exact ? [{ x: target.x, y: target.y }] : [{ x: tx + .5, y: ty + .5 }];
    const open = [{ id: start, g: 0, f: 0 }], came = new Int32Array(SIZE * SIZE).fill(-1), scores = new Float32Array(SIZE * SIZE).fill(Infinity), closed = new Uint8Array(SIZE * SIZE);
    scores[start] = 0; let found = false;
    for (let it = 0; open.length && it < 2304; it++) {
      let bi = 0; for (let j = 1; j < open.length; j++) if (open[j].f < open[bi].f) bi = j;
      const node = open.splice(bi, 1)[0], x = node.id % SIZE, y = Math.floor(node.id / SIZE);
      if (node.id === end) { found = true; break; } if (closed[node.id]) continue; closed[node.id] = 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy, ni = ny * SIZE + nx;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || grid[ni] || closed[ni]) continue;
        if (dx && dy && (grid[y * SIZE + nx] || grid[ny * SIZE + x])) continue;
        const g = node.g + (dx && dy ? 1.414 : 1);
        if (g < scores[ni]) { scores[ni] = g; came[ni] = node.id; open.push({ id: ni, g, f: g + Math.hypot(tx - nx, ty - ny) }); }
      }
    }
    if (!found) return [];
    let p = end; const path = [];
    while (p !== start && p !== -1) { path.unshift({ x: p % SIZE + .5, y: Math.floor(p / SIZE) + .5 }); p = came[p]; }
    if (exact && path.length) path[path.length - 1] = { x: target.x, y: target.y };
    return path;
  }
  edgePoint(unit, target, margin = .65) {
    if (target.kind !== 'building') return center(target);
    return { x: Math.max(target.x - margin, Math.min(target.x + target.w + margin, unit.x)), y: Math.max(target.y - margin, Math.min(target.y + target.d + margin, unit.y)) };
  }
  targetDistance(u, t) {
    if (t.kind !== 'building') return distance(u, t);
    return Math.hypot(Math.max(t.x - u.x, 0, u.x - t.x - t.w), Math.max(t.y - u.y, 0, u.y - t.y - t.d));
  }
  order(unit, order) {
    if (!unit?.alive || unit.kind !== 'unit' || unit.garrison) return;
    unit.order = { ...order }; unit.path = []; unit.repath = 0;
    if (order.type === 'move' || order.type === 'attackmove') unit.path = this.findPath(unit, order, true);
    else if (order.target) { const target = this.get(order.target); if (target) unit.path = this.findPath(unit, this.edgePoint(unit, target)); }
  }
  moveGroup(units, x, y, attack = false) {
    const n = Math.ceil(Math.sqrt(units.length));
    units.filter(u => u.kind === 'unit').forEach((u, i) => this.order(u, { type: attack ? 'attackmove' : 'move', x: Math.max(.5, Math.min(SIZE - .5, x + (i % n - (n - 1) / 2) * .8)), y: Math.max(.5, Math.min(SIZE - .5, y + (Math.floor(i / n) - (n - 1) / 2) * .8)) }));
    this.effects.push({ type: 'marker', x, y, life: .9, maxLife: .9, attack });
  }
  assignGather(unit, resource, preferred) {
    const candidates = this.entities.filter(e => e.alive && ((e.kind === 'resource' && e.resource === resource && e.amount > 0) || (resource === 'food' && e.type === 'farm' && e.owner === unit.owner && e.progress >= 1 && e.amount > 0)));
    candidates.sort((a, b) => {
      const workersA = this.own(unit.owner, 'unit').filter(u => u.order.target === a.id && u.type === 'villager').length;
      const workersB = this.own(unit.owner, 'unit').filter(u => u.order.target === b.id && u.type === 'villager').length;
      return distance(unit, center(a)) + workersA * 4 - distance(unit, center(b)) - workersB * 4;
    });
    const target = preferred || candidates[0];
    if (target) this.order(unit, { type: 'gather', target: target.id, resource, phase: 'gather' }); else this.order(unit, { type: 'idle' });
  }
  dropoff(u, resource) {
    const types = resource === 'wood' ? ['towncenter', 'lumbercamp'] : resource === 'food' ? ['towncenter', 'mill'] : ['towncenter', 'miningcamp'];
    return this.own(u.owner, 'building').filter(b => types.includes(b.type) && b.progress >= 1).sort((a, b) => this.targetDistance(u, a) - this.targetDistance(u, b))[0];
  }
  walk(u, dt) {
    if (!u.path.length) return true;
    let speed = UNITS[u.type].speed * (this.players[u.owner].techs.includes('wheelbarrow') && u.type === 'villager' ? 1.12 : 1), remaining = speed * dt;
    while (u.path.length && remaining > 0) {
      const p = u.path[0], d = distance(u, p);
      if (d <= remaining) { u.x = p.x; u.y = p.y; remaining -= d; u.path.shift(); }
      else { u.x += (p.x - u.x) / d * remaining; u.y += (p.y - u.y) / d * remaining; remaining = 0; }
    }
    return !u.path.length;
  }
  nearestEnemy(u, radius, militaryOnly = false) {
    let best = null, dist = radius;
    for (const e of this.entities) if (e.alive && e.owner >= 0 && e.owner !== u.owner && !e.garrison && (!militaryOnly || e.kind === 'unit') && (u.type !== 'ram' || e.kind === 'building') && (u.owner === 1 || this.isVisible(e))) {
      const d = this.targetDistance(u, e); if (d < dist) { dist = d; best = e; }
    }
    return best;
  }
  isVisible(e) { const p = center(e), x = Math.floor(p.x), y = Math.floor(p.y); return !!this.visible[y * SIZE + x]; }
  damage(attacker, target, amount, ranged = false) {
    const p = this.players[attacker.owner], age = p.age;
    let attack = amount;
    if (attacker.kind === 'unit') {
      attack += this.unitStats(attacker.owner, attacker.type).attack - UNITS[attacker.type].attack;
      if (ranged && p.techs.includes('fletching')) attack += 2;
      if (!ranged && p.techs.includes('forging') && attacker.type !== 'ram') attack += 3;
      if (attacker.type === 'spearman' && ['scout', 'knight'].includes(target.type)) attack *= 3.5;
      if (attacker.type === 'ram' && target.kind !== 'building') attack = 4;
    }
    let armor = target.kind === 'building' ? (ranged ? 5 : 2) : target.type === 'knight' ? 3 : target.type === 'ram' && ranged ? 99 : target.type === 'villager' && this.players[target.owner].techs.includes('loom') ? 1 : 0;
    target.hp -= Math.max(1, attack - armor);
    this.effects.push({ type: ranged ? 'arrow' : 'hit', x: center(target).x, y: center(target).y, from: center(attacker), life: .35, maxLife: .35, owner: attacker.owner });
    if (target.owner === 0 && this.time - (this.lastAttack || -100) > 12) { this.lastAttack = this.time; this.message('Your kingdom is under attack!', 'danger'); this.onEvent({ type: 'attack', target }); }
    if (target.hp <= 0) this.kill(target, attacker);
    else if (target.kind === 'unit' && target.type !== 'villager' && ['idle', 'gather'].includes(target.order.type)) this.order(target, { type: 'attack', target: attacker.id });
  }
  kill(e, attacker) {
    e.alive = false; this.players[e.owner].stats.lost++;
    if (attacker) this.players[attacker.owner].stats.kills++;
    this.effects.push({ type: e.kind === 'building' ? 'collapse' : 'death', x: center(e).x, y: center(e).y, life: 3, maxLife: 3, owner: e.owner });
    this.own(e.owner, 'unit').filter(u => u.garrison === e.id).forEach(u => { u.garrison = null; const pos = this.spawnPoint(e); u.x = pos.x; u.y = pos.y; });
    if (e.type === 'towncenter' && !this.own(e.owner, 'building').some(b => b.type === 'towncenter')) { this.players[e.owner].defeated = true; this.result = e.owner === 1 ? 'victory' : 'defeat'; this.paused = true; this.onEvent({ type: 'end', result: this.result }); }
  }
  updateUnit(u, dt) {
    if (u.garrison) { u.hp = Math.min(u.maxHp, u.hp + dt * 2); return; }
    u.cooldown = Math.max(0, u.cooldown - dt); u.anim += dt;
    const o = u.order;
    if (u.type !== 'villager' && (o.type === 'idle' || o.type === 'attackmove') && u.stance !== 'stand') {
      const enemy = this.nearestEnemy(u, u.type === 'scout' ? 5 : 7);
      if (enemy) { const resume = o.type === 'attackmove' ? { ...o } : null; this.order(u, { type: 'attack', target: enemy.id, resume }); return; }
    }
    if (o.type === 'move' || o.type === 'attackmove') { if (this.walk(u, dt)) u.order = { type: 'idle' }; return; }
    if (o.type === 'idle') return;
    const target = this.get(o.target);
    if (o.type === 'gather' && (!target || target.amount <= 0) && u.carry > 0) {
      const drop = this.get(o.drop) || this.dropoff(u, u.carryType);
      if (drop) {
        if (this.targetDistance(u, drop) <= 1) { this.players[u.owner].resources[u.carryType] += u.carry; this.players[u.owner].stats.gathered += u.carry; u.carry = 0; }
        else { if (o.phase !== 'deposit' || o.drop !== drop.id || !u.path.length) u.path = this.findPath(u, this.edgePoint(u, drop)); o.phase = 'deposit'; o.drop = drop.id; this.walk(u, dt); return; }
      }
    }
    if (o.type === 'gather' && target?.amount <= 0) { this.assignGather(u, o.resource); return; }
    if (!target) {
      if (o.type === 'gather') this.assignGather(u, o.resource);
      else if (o.resume) this.order(u, o.resume);
      else u.order = { type: 'idle' };
      return;
    }
    if (o.type === 'attack') {
      let range = this.unitStats(u.owner, u.type).range;
      if (this.targetDistance(u, target) <= range) {
        u.path = [];
        if (u.cooldown <= 0) { this.damage(u, target, UNITS[u.type].attack, range > 3); u.cooldown = u.type === 'ram' ? 2 : range > 3 ? 1.3 : 1; }
      } else {
        u.repath -= dt; if (u.repath <= 0 || !u.path.length) { u.path = this.findPath(u, this.edgePoint(u, target)); u.repath = 1.5; }
        this.walk(u, dt);
      }
      return;
    }
    if (o.type === 'gather') {
      if (u.carry > 0 && o.phase === 'deposit') {
        let drop = this.get(o.drop); if (!drop) { drop = this.dropoff(u, u.carryType); if (!drop) return; o.drop = drop.id; u.path = this.findPath(u, this.edgePoint(u, drop)); }
        if (this.targetDistance(u, drop) <= 1) {
          this.players[u.owner].resources[u.carryType] += u.carry; this.players[u.owner].stats.gathered += u.carry; u.carry = 0;
          o.phase = 'gather'; u.path = this.findPath(u, this.edgePoint(u, target));
        } else this.walk(u, dt);
      } else if (this.targetDistance(u, target) < 1.35 || (target.type === 'farm' && this.targetDistance(u, target) < .3)) {
        u.path = [];
        const techs = this.players[u.owner].techs;
        const rate = 3.6 * (techs.includes('axe') && o.resource === 'wood' ? 1.35 : 1) * (techs.includes('wheelbarrow') ? 1.25 : 1);
        const n = Math.min(target.amount, rate * dt); target.amount -= n; u.carry += n; u.carryType = o.resource;
        if (u.carry >= (techs.includes('wheelbarrow') ? 24 : 16) || target.amount <= 0) {
          const drop = this.dropoff(u, o.resource); if (drop) { o.phase = 'deposit'; o.drop = drop.id; u.path = this.findPath(u, this.edgePoint(u, drop)); }
        }
        if (target.amount <= 0) {
          if (target.type === 'farm') { if (this.pay(u.owner, { wood: 30 })) target.amount = 900; }
          else target.alive = false;
        }
      } else { if (!u.path.length) u.path = this.findPath(u, this.edgePoint(u, target)); this.walk(u, dt); }
      return;
    }
    if (o.type === 'build' || o.type === 'repair') {
      if (this.targetDistance(u, target) <= 1.4) {
        u.path = [];
        if (target.progress < 1) {
          const increment = dt / BUILDINGS[target.type].time; target.progress = Math.min(1, target.progress + increment); target.hp = Math.min(target.maxHp, target.hp + target.maxHp * .9 * increment);
          if (target.progress >= 1) { target.hp = target.maxHp; this.players[u.owner].stats.built++; this.message(`${BUILDINGS[target.type].name} completed.`, 'success', u.owner); }
        } else if (o.type === 'repair' && target.hp < target.maxHp && this.pay(u.owner, { wood: dt * .6 })) target.hp = Math.min(target.maxHp, target.hp + dt * 22);
        else { if (target.type === 'farm') this.assignGather(u, 'food', target); else this.assignGather(u, this.lowestResource(u.owner)); }
      } else { if (!u.path.length) u.path = this.findPath(u, this.edgePoint(u, target)); this.walk(u, dt); }
      return;
    }
    if (o.type === 'garrison') {
      if (this.targetDistance(u, target) < 1.5) { u.garrison = target.id; u.path = []; u.order = { type: 'idle' }; }
      else this.walk(u, dt);
    }
  }
  lowestResource(owner) { const r = this.players[owner].resources, targets = { food: 700, wood: 500, gold: 400, stone: 350 }; return Object.keys(targets).sort((a, b) => r[a] / targets[a] - r[b] / targets[b])[0]; }
  spawnPoint(b) {
    const seed = this.nextId;
    const p = { x: b.x + b.w + .65, y: b.y + b.d / 2 + hash(seed, 0) * .8 };
    if (terrain(p.x, p.y) !== 'grass' || this.blockGrid()[Math.floor(p.y) * SIZE + Math.floor(p.x)]) {
      const path = this.findPath(p, { x: b.x - .75, y: b.y + b.d + .75 }); return path.at(-1) || { x: b.x - .7, y: b.y - .7 };
    }
    return p;
  }
  updateBuilding(b, dt) {
    if (b.progress < 1) return;
    if (b.queue.length) {
      const q = b.queue[0]; q.elapsed += dt;
      if (q.elapsed >= q.duration) {
        if (q.kind === 'unit') {
          if (this.pop(b.owner).units >= this.pop(b.owner).cap) { q.elapsed = q.duration; return; }
          const pos = this.spawnPoint(b), u = this.unit(q.type, pos.x, pos.y, b.owner); this.players[b.owner].stats.trained++;
          if (q.type === 'villager') this.players[b.owner].stats.villagersTrained = (this.players[b.owner].stats.villagersTrained || 0) + 1;
          if (b.rally) {
            const target = this.get(b.rally.target);
            if (u.type === 'villager' && (target?.kind === 'resource' || target?.type === 'farm' && target.owner === u.owner)) this.assignGather(u, target.resource || 'food', target);
            else if (target && target.owner !== u.owner && target.owner >= 0) this.order(u, { type: 'attack', target: target.id });
            else this.moveGroup([u], b.rally.x, b.rally.y, u.type !== 'villager');
          } else if (u.type === 'villager') this.assignGather(u, this.lowestResource(b.owner));
          this.message(`${UNITS[q.type].name} ready.`, 'quiet', b.owner);
        } else if (q.kind === 'age') {
          this.players[b.owner].age++;
          this.own(b.owner, 'unit').forEach(u => { const hp = this.unitStats(b.owner, u.type).hp; u.hp += hp - u.maxHp; u.maxHp = hp; });
          this.message(`Welcome to the ${AGES[this.players[b.owner].age]}. New buildings and units unlocked.`, 'age', b.owner);
          this.onEvent({ type: 'age', owner: b.owner });
        } else {
          this.players[b.owner].techs.push(q.type);
          if (q.type === 'loom') this.own(b.owner, 'unit').filter(u => u.type === 'villager').forEach(u => { u.maxHp += 25; u.hp += 25; });
          if (q.type === 'masonry') this.own(b.owner, 'building').forEach(e => { e.maxHp *= 1.3; e.hp *= 1.3; });
          this.message(`${TECHS[q.type].name} researched.`, 'success', b.owner);
        }
        b.queue.shift();
      }
    }
    const def = BUILDINGS[b.type];
    if (def.attack) {
      b.cooldown -= dt;
      if (b.cooldown <= 0) {
        const e = this.nearestEnemy({ ...center(b), owner: b.owner }, def.range);
        if (e) { const garrisoned = this.own(b.owner, 'unit').filter(u => u.garrison === b.id).length; this.damage(b, e, def.attack + Math.min(garrisoned, 8) * 2, true); b.cooldown = b.type === 'castle' ? .8 : 1.4; }
      }
    }
  }
  trade(resource, buy) {
    if (!this.own(0, 'building').some(b => b.type === 'market' && b.progress >= 1)) return this.error('Build a Market to trade.');
    if (buy) { if (!this.pay(0, { gold: 130 })) return this.error('You need 130 gold.'); this.refund(0, { [resource]: 100 }); }
    else { if (!this.pay(0, { [resource]: 100 })) return this.error(`You need 100 ${resource}.`); this.refund(0, { gold: 70 }); }
    this.message(`${buy ? 'Bought' : 'Sold'} 100 ${resource}.`, 'success'); return true;
  }
  aiBuild(type) {
    const base = this.own(1, 'building').find(b => b.type === 'towncenter'), worker = this.own(1, 'unit').find(u => u.type === 'villager' && !['build', 'repair'].includes(u.order.type));
    if (!base || !worker) return;
    for (let r = 4; r <= 11; r++) for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, x = Math.floor(base.x + Math.cos(a) * r), y = Math.floor(base.y + Math.sin(a) * r);
      if (this.validPlacement(type, x, y)) return this.construct(type, x, y, [worker]);
    }
  }
  updateAI() {
    const p = this.players[1], buildings = this.own(1, 'building'), workers = this.own(1, 'unit').filter(u => u.type === 'villager'), tc = buildings.find(b => b.type === 'towncenter');
    if (!tc) return;
    // AI uses the same resources, queues, age requirements and construction as the player.
    const pop = this.pop(1), targetWorkers = this.difficulty === 'hard' ? 22 : this.difficulty === 'peaceful' ? 12 : 17;
    if (pop.units + pop.queued > pop.cap - 3 && !buildings.some(b => b.type === 'house' && b.progress < 1) && p.resources.wood >= 50) this.aiBuild('house');
    if (workers.length < targetWorkers && tc.queue.length < 2 && this.canAfford(1, UNITS.villager.cost) && pop.units + pop.queued < pop.cap) this.enqueue(tc, 'villager');
    if (p.age < 3 && this.time > [105, 280, 570][p.age] * (this.difficulty === 'hard' ? .75 : this.difficulty === 'peaceful' ? 1.6 : 1) && this.canAfford(1, AGE_COSTS[p.age]) && !this.ageRequirements(1)) this.enqueue(tc, 'age', 'age');
    if (p.age >= 1 && !buildings.some(b => b.type === 'blacksmith') && p.resources.wood >= 150) this.aiBuild('blacksmith');
    if (p.age >= 1 && !buildings.some(b => b.type === 'archery') && p.resources.wood >= 175) this.aiBuild('archery');
    if (p.age >= 1 && buildings.some(b => b.type === 'archery' && b.progress >= 1) && !buildings.some(b => b.type === 'stable') && p.resources.wood >= 175) this.aiBuild('stable');
    if (p.age >= 2 && !buildings.some(b => b.type === 'siege') && p.resources.wood >= 200) this.aiBuild('siege');
    if (p.age >= 2 && p.resources.stone >= 550 && !buildings.some(b => b.type === 'castle')) this.aiBuild('castle');
    const military = this.own(1, 'unit').filter(u => u.type !== 'villager');
    for (const b of buildings.filter(b => ['barracks', 'archery', 'stable', 'siege'].includes(b.type) && b.progress >= 1 && b.queue.length < 1)) {
      const type = b.type === 'archery' ? 'archer' : b.type === 'siege' ? 'ram' : b.type === 'stable' ? p.age >= 2 ? 'knight' : 'scout' : p.age >= 1 && this.raids % 2 ? 'spearman' : 'militia';
      const max = this.difficulty === 'hard' ? 28 : this.difficulty === 'peaceful' ? 9 : 18;
      if (military.length < max && this.time > 65 && this.canAfford(1, UNITS[type].cost) && this.pop(1).units + this.pop(1).queued < this.pop(1).cap) this.enqueue(b, type);
    }
    workers.filter(u => u.order.type === 'idle').forEach(u => this.assignGather(u, this.lowestResource(1)));
    if (this.time >= this.nextRaid) {
      const army = military.filter(u => u.order.type === 'idle');
      if (army.length >= 3) {
        const base = this.own(0, 'building').find(b => b.type === 'towncenter');
        if (base) { this.moveGroup(army.slice(0, this.difficulty === 'hard' ? 15 : 9), base.x + base.w + 2, base.y + base.d + 2, true); this.message('Scouts report an enemy war party on the march.', 'danger'); this.raids++; }
      }
      this.nextRaid = this.time + (this.difficulty === 'hard' ? 85 : this.difficulty === 'peaceful' ? 230 : 135);
    }
  }
  updateFog() {
    this.visible.fill(0);
    this.own(0).filter(e => !e.garrison && ['unit', 'building'].includes(e.kind)).forEach(e => {
      const p = center(e), r = e.type === 'scout' ? 10 : e.kind === 'building' ? e.type === 'towncenter' || e.type === 'castle' ? 11 : 7 : 7;
      for (let y = Math.max(0, Math.floor(p.y - r)); y <= Math.min(SIZE - 1, Math.ceil(p.y + r)); y++) for (let x = Math.max(0, Math.floor(p.x - r)); x <= Math.min(SIZE - 1, Math.ceil(p.x + r)); x++) if (Math.hypot(x + .5 - p.x, y + .5 - p.y) <= r) { this.visible[y * SIZE + x] = 1; this.explored[y * SIZE + x] = 1; }
    });
  }
  update(dt) {
    if (this.paused || this.result) return;
    dt = Math.min(dt, .25); this.time += dt;
    for (const e of this.entities) if (e.alive) { if (e.kind === 'unit') this.updateUnit(e, dt); else if (e.kind === 'building') this.updateBuilding(e, dt); if (this.result) break; }
    this.effects = this.effects.filter(e => { e.life -= dt; return e.life > 0; });
    this.fogTimer -= dt; if (this.fogTimer <= 0) { this.fogTimer = .6; this.updateFog(); }
    this.aiTimer -= dt; if (this.aiTimer <= 0) { this.aiTimer = 4; this.updateAI(); }
  }
  serialize() {
    return JSON.stringify({ version: 1, difficulty: this.difficulty, entities: this.entities.filter(e => e.alive), players: this.players, nextId: this.nextId, time: this.time, speed: this.speed, explored: [...this.explored], nextRaid: this.nextRaid, raids: this.raids, result: this.result });
  }
  static restore(json) {
    const data = JSON.parse(json); if (data.version !== 1 || !Array.isArray(data.entities) || data.players?.length !== 2) throw new Error('Invalid save');
    const game = new Game(data.difficulty);
    Object.assign(game, data); game.explored = new Uint8Array(data.explored); game.visible = new Uint8Array(SIZE * SIZE); game.byId = new Map(game.entities.map(e => [e.id, e])); game.effects = []; game.paused = !!game.result; game.updateFog(); return game;
  }
}
