// Damage resolution, projectiles, death effects and attack alerts.
import { TICK } from '../data/constants.js';

export const PROJ = {
  arrow:    { speed: 15, arc: 0.7 },
  javelin:  { speed: 12, arc: 0.45 },
  axe:      { speed: 10, arc: 0.55 },
  bolt:     { speed: 20, arc: 0.12 },
  stone:    { speed: 7,  arc: 2.4 },
  bigstone: { speed: 8,  arc: 4.5 },
};

const MIN_DAMAGE = 0.25;

/** AoE2 damage formula: sum over the attack's damage classes of max(0, attack - armor), min 0.25. */
export function calcDamage(atk, tDef) {
  const armor = tDef.armor, tags = tDef.tags;
  let total = 0, any = false;
  for (const k in atk) {
    const v = atk[k];
    if (k === 'melee' || k === 'pierce') { total += Math.max(0, v - (armor[k] || 0)); any = true; }
    else if (tags.includes(k)) { total += Math.max(0, v - (armor[k] || 0)); any = true; }
  }
  if (!any) return 0;
  return Math.max(MIN_DAMAGE, total);
}

/** Apply `dmg` points to target and handle reactions/alerts/death. */
export function applyDamage(game, attacker, target, dmg) {
  if (target.dead || dmg <= 0) return;
  target.hp -= dmg;
  target.lastHitT = game.time;
  if (attacker) target.lastAttacker = attacker.id || 0;
  if (attacker && game.isEnemy(attacker.owner, target.owner)) alertAttack(game, target, attacker);
  if (target.kind === 'unit') {
    // converted/dead
    if (target.hp <= 0) game.killUnit(target, attacker);
    else if (target.def.tags.includes('animal') && attacker && target.def.flees) { target.fleeT = 6; target.fleeFrom = attacker.id; }
  } else if (target.kind === 'building') {
    if (target.hp <= 0) game.destroyBuilding(target, attacker);
  }
}

const alertState = { t: -99, tb: -99 };
export function alertAttack(game, target, attacker) {
  const hi = game.humanIndex;
  if (!(target.owner === hi || game.isAllied(target.owner, hi))) return;
  const isB = target.kind === 'building';
  const last = isB ? (target.attackedNotifyT || -99) : (game._unitAlertT || -99);
  if (game.time - last < (isB ? 12 : 10)) return;
  if (isB) target.attackedNotifyT = game.time; else game._unitAlertT = game.time;
  game.emit('alert', { x: target.x, y: target.y, building: isB });
  game.notify(target.owner, isB ? `Your ${target.def.name} is under attack!` : 'Your units are under attack!', target.x, target.y, 'alert');
}

export function distToEntity(a, b) {
  // distance from a's center to b's body edge
  if (b.kind === 'building') {
    const dx = a.x < b.tx ? b.tx - a.x : a.x > b.tx + b.size ? a.x - b.tx - b.size : 0;
    const dy = a.y < b.ty ? b.ty - a.y : a.y > b.ty + b.size ? a.y - b.ty - b.size : 0;
    return Math.hypot(dx, dy);
  }
  if (b.kind === 'resource') return Math.max(0, Math.hypot(a.x - b.x, a.y - b.y) - 0.5);
  return Math.max(0, Math.hypot(a.x - b.x, a.y - b.y) - b.radius);
}

/** Melee hit resolution. */
export function meleeHit(game, u, t) {
  const dmg = calcDamage(u.def.atk, t.def);
  game.emit('hit', { x: t.x, y: t.y, kind: t.kind === 'building' ? (t.def.armor.melee >= 3 ? 'stone' : 'wood') : (t.def.armor.melee >= 2 ? 'clang' : 'blade'), owner: u.owner, atk: u.type });
  applyDamage(game, u, t, dmg);
}

/** Launch a projectile from a unit or building at target `t`. */
export function fireProjectile(game, shooter, t, atk, ptype, opts = {}) {
  const spec = PROJ[ptype] || PROJ.arrow;
  const sx = shooter.x, sy = shooter.y;
  let tx = t.x, ty = t.y;
  const dist = Math.hypot(tx - sx, ty - sy);
  const dur = Math.max(0.12, dist / spec.speed);
  // predict target position for moving units
  let moving = false;
  if (t.kind === 'unit') {
    const vx = (t.x - t.px) / TICK, vy = (t.y - t.py) / TICK;
    if (Math.abs(vx) + Math.abs(vy) > 0.05) { moving = true; tx += vx * dur * 0.95; ty += vy * dur * 0.95; }
  }
  const acc = opts.accuracy !== undefined ? opts.accuracy : 1;
  let hit = true;
  if (t.kind === 'unit') hit = game.rng.next() < (moving ? acc : Math.min(1, acc + 0.1));
  const splash = opts.splash || 0;
  let ex = tx, ey = ty;
  if (!hit) {
    const a = game.rng.next() * Math.PI * 2, r = 0.6 + game.rng.next() * 1.0;
    ex += Math.cos(a) * r; ey += Math.sin(a) * r;
  } else if (splash && t.kind === 'unit') {
    // stone shots land where the target is predicted to be, with a little scatter
    const a = game.rng.next() * Math.PI * 2, r = game.rng.next() * 0.5;
    ex += Math.cos(a) * r; ey += Math.sin(a) * r;
  }
  const p = {
    kind: 'proj', type: ptype, owner: shooter.owner, shooter: shooter.id, sx, sy, x: sx, y: sy, ex, ey,
    target: t.id, homing: hit && !splash, hitT: t.kind === 'building' ? 'b' : 'u', t: 0, dur, arc: spec.arc * Math.min(1, 0.4 + dist / 12),
    atk, splash, srcType: shooter.type, dead: false, px: sx, py: sy, z0: opts.z0 || 0,
  };
  game.projectiles.push(p);
  game.emit('shoot', { x: sx, y: sy, type: ptype, owner: shooter.owner, src: shooter.type });
  return p;
}

export function updateProjectiles(game, dt) {
  const ps = game.projectiles;
  let w = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p.px = p.x; p.py = p.y;
    p.t += dt / p.dur;
    if (p.homing) {
      const t = game.byId.get(p.target);
      if (t && !t.dead && !(t.kind === 'unit' && t.garrison)) { p.ex = t.x; p.ey = t.y; }
    }
    const k = Math.min(1, p.t);
    p.x = p.sx + (p.ex - p.sx) * k; p.y = p.sy + (p.ey - p.sy) * k;
    if (p.t >= 1) { landProjectile(game, p); continue; }
    ps[w++] = p;
  }
  ps.length = w;
}

function landProjectile(game, p) {
  const shooter = game.byId.get(p.shooter) || { owner: p.owner, id: 0, type: p.srcType, dead: true };
  if (p.splash) {
    game.emit('impact', { x: p.ex, y: p.ey, type: p.type, owner: p.owner });
    const r = p.splash;
    const near = game.queryUnits(p.ex, p.ey, r + 0.5).slice();
    for (const u of near) {
      if (u.dead || u.garrison || !game.isEnemy(p.owner, u.owner)) continue;
      const d = Math.hypot(u.x - p.ex, u.y - p.ey);
      if (d > r + u.radius) continue;
      const f = 1 - 0.55 * Math.min(1, d / (r + 0.01));
      applyDamage(game, shooter, u, calcDamage(p.atk, u.def) * f);
    }
    const sts = game.queryStatic(p.ex, p.ey, r * 0.6, 'building');
    for (const b of sts) if (!b.dead && game.isEnemy(p.owner, b.owner) && (b.id === p.target || r > 1.2)) applyDamage(game, shooter, b, calcDamage(p.atk, b.def));
    return;
  }
  const t = game.byId.get(p.target);
  if (p.homing && t && !t.dead && !(t.kind === 'unit' && t.garrison)) {
    game.emit('hit', { x: t.x, y: t.y, kind: t.kind === 'building' ? 'arrow_wood' : 'arrow', owner: p.owner, atk: p.type });
    applyDamage(game, shooter, t, calcDamage(p.atk, t.def));
    return;
  }
  // missed: stray projectile may hit another enemy right at the landing spot
  game.emit('miss', { x: p.ex, y: p.ey, type: p.type });
  if (p.type === 'bolt' || p.type === 'arrow' || p.type === 'javelin' || p.type === 'axe') {
    const near = game.queryUnits(p.ex, p.ey, 0.5);
    for (const u of near) if (!u.dead && !u.garrison && game.isEnemy(p.owner, u.owner) && u.id !== p.target) { applyDamage(game, shooter, u, calcDamage(p.atk, u.def)); break; }
  }
}

/** Death side effects for a unit. */
export function killUnitEffects(game, u, killer) {
  const animal = u.def.tags.includes('animal');
  if (animal && u.def.food) {
    const c = game.makeCarcass(u);
    game.emit('death', { x: u.x, y: u.y, type: u.type, owner: u.owner, animal: true });
    return c;
  }
  game.corpses.push({ type: u.type, x: u.x, y: u.y, dir: u.dir, owner: u.owner, t0: game.time, variant: u.variant, carry: 0 });
  if (game.corpses.length > 300) game.corpses.shift();
  game.emit('death', { x: u.x, y: u.y, type: u.type, owner: u.owner, animal, villager: u.type === 'villager', cavalry: u.def.tags.includes('cavalry'), siege: u.def.tags.includes('siege') });
}
