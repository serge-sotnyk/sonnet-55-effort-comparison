import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BUILDINGS } from '../catalog.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= fileURLToPath(new URL('../.browser-cache', import.meta.url));
const { chromium } = await import('@playwright/test');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const checks = [];
async function check(name, operation) {
  try { await operation(); checks.push({ name, ok: true }); console.log(`PASS ${name}`); }
  catch (error) {
    checks.push({ name, ok: false, reason: error.message }); console.error(`FAIL ${name}: ${error.message}`);
    console.error('Game at failure:', await page.evaluate(() => ({ age: window.__game?.age, time: window.__game?.time, paused: window.__app?.paused, state: window.__game?.state, queues: window.__game?.entities.filter(e => e.owner === 'player' && e.queue?.length).map(e => ({ type: e.type, queue: e.queue })), notifications: document.querySelector('#notification-stack')?.textContent })));
  }
}
async function simulate(seconds) {
  await page.evaluate(seconds => { window.__game.update(seconds); }, seconds);
  await page.waitForTimeout(450);
}
async function screenshot(path) {
  const state = await page.evaluate(() => {
    const previous = { paused: window.__app.paused, speed: window.__app.speed };
    window.__app.speed = 0; window.__app.setPaused(false); return previous;
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path });
  await page.evaluate(previous => { window.__app.speed = previous.speed; window.__app.setPaused(previous.paused); }, state);
}
const action = name => page.locator(`[data-action="${name}"]`);
async function selectType(type) {
  return page.evaluate(type => {
    const entity = window.__game.entities.find(e => e.owner === 'player' && e.type === type && e.hp > 0);
    if (!entity) throw new Error(`No ${type} exists`);
    window.__select([entity.id]); return entity.id;
  }, type);
}
async function pointForBuilding(type) {
  return page.evaluate(type => {
    const g = window.__game, r = window.__renderer, rect = document.querySelector('#world').getBoundingClientRect();
    const worker = g.getEntity([...g.selected][0]);
    const candidates = [];
    for (let y = 25; y <= 36; y += .5) for (let x = 11; x <= 24; x += .5) {
      if (!g.canBuild(type, x, y).ok) continue;
      const p = r.worldToScreen(x, y), px = p.x + rect.left, py = p.y + rect.top;
      if (px < 40 || px > innerWidth - 40 || py < rect.top + 50 || py > rect.bottom - 70) continue;
      if (document.elementFromPoint(px, py)?.id !== 'world') continue;
      candidates.push({ x, y, px, py, distance: Math.hypot(x - worker.x, y - worker.y) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) throw new Error(`No clickable ${type} location`);
    return candidates[0];
  }, type);
}
async function place(type, military = false) {
  await selectType('villager');
  await action('buildMenu').click();
  if (military) await action('buildTab:buildMilitary').click();
  const point = await pointForBuilding(type);
  await action(`build:${type}`).click();
  await page.mouse.move(point.px, point.py);
  await page.mouse.click(point.px, point.py);
  const id = await page.evaluate(({ type, x, y }) => {
    const entity = window.__game.entities.find(e => e.owner === 'player' && e.type === type && Math.hypot(e.x - x, e.y - y) < .1);
    if (!entity) throw new Error(`Click did not place ${type}`);
    if (!window.__game.entities.some(e => e.task?.type === 'build' && e.task.targetId === entity.id)) throw new Error('No worker assigned');
    return entity.id;
  }, { type, ...point });
  await simulate(BUILDINGS[type].time + 25);
  const construction = await page.evaluate(id => {
    const g = window.__game, b = g.getEntity(id);
    return { building: { id: b.id, x: b.x, y: b.y, type: b.type, progress: b.progress, size: b.size }, builders: g.entities.filter(e => e.task?.targetId === id).map(e => ({ id: e.id, x: e.x, y: e.y, task: e.task, path: e.path, pathGoal: e.pathGoal, distance: Math.hypot(e.x - b.x, e.y - b.y) })), nearbyBuildings: g.entities.filter(e => e.kind === 'building' && Math.hypot(e.x - b.x, e.y - b.y) < 10).map(e => ({ type: e.type, x: e.x, y: e.y, size: e.size })) };
  }, id);
  if (construction.building.progress !== 1) await screenshot('artifacts/screenshots/ui-construction-failure.png');
  assert.equal(construction.building.progress, 1, JSON.stringify(construction));
  return id;
}

try {
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__game && window.__renderer && window.__select);
  await page.evaluate(() => { window.__app.setPaused(true); window.__game._nextWave = 10000; });
  await mkdir('artifacts/screenshots', { recursive: true });
  await check('Initial scene and resource counters', async () => {
    assert.match(await page.title(), /Crown.*Conquest/);
    assert.equal(await page.locator('#age-name').textContent(), 'Dark Age');
    assert.match(await page.locator('#res-population').textContent(), /^7\//);
    assert.equal(await page.evaluate(() => window.__game.getEntity([...window.__game.selected][0]).type), 'towncenter');
    for (const resource of ['wood', 'food', 'gold', 'stone']) assert.ok(Number((await page.locator(`#res-${resource}`).textContent()).replaceAll(',', '')) >= 0);
    await screenshot('artifacts/screenshots/ui-desktop.png');
  });
  await check('Villager training through action button and economy delivery', async () => {
    const before = await page.evaluate(() => ({ population: window.__game.population, resources: { ...window.__game.resources } }));
    await action('train:villager').click();
    assert.equal(await page.evaluate(() => window.__game.entities.find(e => e.type === 'towncenter' && e.owner === 'player').queue[0].type), 'villager');
    await simulate(15);
    assert.equal(await page.evaluate(() => window.__game.population), before.population + 1);
    await simulate(50);
    const after = await page.evaluate(() => window.__game.resources);
    assert.ok(after.wood > before.resources.wood, 'Lumber delivered');
    assert.ok(after.food > before.resources.food - 50, 'Food delivered');
    assert.ok(after.gold > before.resources.gold, 'Gold delivered');
  });
  await check('Right-click gathering and stop button', async () => {
    const workerId = await selectType('villager');
    const target = await page.evaluate(() => {
      const g = window.__game, r = window.__renderer, rect = document.querySelector('#world').getBoundingClientRect();
      for (const e of g.entities.filter(e => e.kind === 'resource' && e.resource === 'wood' && r.isVisible(e))) {
        const p = r.worldToScreen(e.x, e.y);
        for (const dy of [0, -8, -20]) {
          const px = p.x + rect.left, py = p.y + rect.top + dy;
          const hit = r.hitTest(px, py);
          if (hit?.kind === 'resource' && hit.resource === 'wood' && document.elementFromPoint(px, py)?.id === 'world') return { px, py, id: hit.id };
        }
      }
      throw new Error('No clickable tree');
    });
    await page.mouse.click(target.px, target.py, { button: 'right' });
    const task = await page.evaluate(id => window.__game.getEntity(id).task, workerId);
    assert.equal(task.type, 'gather'); assert.equal(task.targetId, target.id);
    await action('stop').click();
    assert.equal(await page.evaluate(id => window.__game.getEntity(id).task.type, workerId), 'idle');
  });
  await check('House placement, worker construction, population capacity', async () => {
    const before = await page.evaluate(() => window.__game.populationCap);
    await place('house');
    assert.equal(await page.evaluate(() => window.__game.populationCap), before + 5);
  });
  await check('Military build menu and barracks production', async () => {
    await page.evaluate(() => { for (const r of ['wood', 'food', 'gold', 'stone']) window.__game.resources[r] = 2500; });
    const id = await place('barracks', true);
    await page.evaluate(id => window.__select([id]), id);
    const before = await page.evaluate(() => window.__game.militaryCount);
    await action('train:militia').click();
    await simulate(17);
    assert.equal(await page.evaluate(() => window.__game.militaryCount), before + 1);
  });
  await check('Feudal Age advancement and research', async () => {
    await selectType('towncenter');
    await action('advance').click();
    assert.equal(await page.evaluate(() => window.__game.entities.find(e => e.type === 'towncenter' && e.owner === 'player').queue[0].kind), 'age');
    await simulate(40);
    assert.equal(await page.locator('#age-name').textContent(), 'Feudal Age');
    await action('research:wheelbarrow').click();
    assert.equal(await page.evaluate(() => window.__game.entities.find(e => e.type === 'towncenter' && e.owner === 'player').queue[0]?.type), 'wheelbarrow');
    await simulate(27);
    assert.equal(await page.evaluate(() => window.__game.techs.has('wheelbarrow')), true);
  });
  await check('Castle and Imperial advancement, Castle building and Trebuchet training', async () => {
    await page.evaluate(() => { for (const r of ['wood', 'food', 'gold', 'stone']) window.__game.resources[r] = 5000; });
    await selectType('towncenter');
    await action('advance').click();
    await simulate(54);
    assert.equal(await page.locator('#age-name').textContent(), 'Castle Age');
    const castleId = await place('castle', true);
    await page.evaluate(id => window.__select([id]), castleId);
    assert.equal(await action('train:trebuchet').isEnabled(), false, 'Siege locked before Imperial Age');
    await selectType('towncenter');
    await action('advance').click();
    await simulate(68);
    assert.equal(await page.locator('#age-name').textContent(), 'Imperial Age');
    assert.equal(await action('advance').count(), 0, 'Final age has no further advance button');
    await page.evaluate(id => window.__select([id]), castleId);
    assert.equal(await action('train:trebuchet').isEnabled(), true);
    const before = await page.evaluate(() => window.__game.militaryCount);
    await action('train:trebuchet').click();
    await simulate(35);
    assert.equal(await page.evaluate(() => window.__game.militaryCount), before + 1);
    assert.equal(await page.evaluate(() => window.__game.entities.some(e => e.owner === 'player' && e.type === 'trebuchet')), true);
    await selectType('barracks');
    for (let i = 0; i < 4; i++) await action('train:militia').click();
    await simulate(65);
    await page.evaluate(id => {
      const g = window.__game, castle = g.getEntity(id);
      g.command(g.entities.filter(e => e.owner === 'player' && e.kind === 'unit' && e.type !== 'villager').map(e => e.id), { type: 'move', x: castle.x + 4, y: castle.y + 2 });
      g.update(18);
      window.__renderer.centerOn((16 + castle.x) / 2, (30 + castle.y) / 2);
      window.__select([id]);
    }, castleId);
    await screenshot('artifacts/screenshots/ui-imperial.png');
  });
  await check('Audio toggle, pause, help, keyboard', async () => {
    await page.evaluate(() => window.__app.setPaused(true));
    await page.locator('#sound-button').click();
    assert.ok(await page.locator('#sound-button .icon-muted').count());
    await page.locator('#sound-button').click();
    assert.ok(await page.locator('#sound-button .icon-sound').count());
    await page.locator('#pause-button').click();
    assert.equal(await page.evaluate(() => window.__app.paused), false);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.__app.paused), true);
    await page.locator('#help-button').click();
    assert.equal(await page.locator('#modal-backdrop').isVisible(), true);
    assert.match(await page.locator('#modal').textContent(), /Grow your economy/);
    await page.locator('#help-continue').click();
    assert.equal(await page.locator('#modal-backdrop').isVisible(), false);
    await page.keyboard.press('h');
    assert.equal(await page.evaluate(() => window.__game.getEntity([...window.__game.selected][0]).type), 'towncenter');
  });
  await check('Production rally and placement cancellation', async () => {
    const id = await selectType('towncenter');
    const point = await pointForBuilding('house');
    await page.mouse.click(point.px, point.py, { button: 'right' });
    const rally = await page.evaluate(id => window.__game.getEntity(id).rally, id);
    assert.ok(Math.hypot(rally.x - point.x, rally.y - point.y) < 1.5);
    await selectType('villager');
    await action('buildMenu').click();
    await action('build:house').click();
    assert.equal(await page.locator('#placement-bar').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#placement-bar').isVisible(), false);
  });
  await check('Menu speed, save, load and restored typed structures', async () => {
    await page.locator('#menu-button').click();
    await page.locator('#speed-select').selectOption('1.5');
    assert.equal(await page.evaluate(() => window.__app.speed), 1.5);
    await page.locator('#save-game').click();
    assert.match(await page.locator('#save-status').textContent(), /saved/);
    const stock = await page.evaluate(() => window.__game.resources.wood);
    await page.evaluate(() => { window.__game.resources.wood = 1; });
    await page.locator('#load-game').click();
    assert.ok(Math.abs(await page.evaluate(() => window.__game.resources.wood) - stock) < 10);
    assert.equal(await page.evaluate(() => window.__game.techs instanceof Set && window.__game.explored instanceof Uint8Array && window.__game.selected instanceof Set), true);
    await page.evaluate(() => window.__app.setPaused(true));
    await simulate(2);
  });
  await check('Minimap navigation and return home', async () => {
    const before = await page.evaluate(() => ({ ...window.__renderer.camera }));
    const rect = await page.locator('#minimap').boundingBox();
    await page.mouse.click(rect.x + rect.width * .7, rect.y + rect.height * .35);
    const after = await page.evaluate(() => ({ ...window.__renderer.camera }));
    assert.ok(Math.hypot(before.x - after.x, before.y - after.y) > 20);
    await page.locator('#home-button').click();
  });
  await check('Zoom controls and responsive small viewport', async () => {
    const before = await page.evaluate(() => window.__renderer.zoom);
    await page.locator('#zoom-in').click();
    assert.ok(await page.evaluate(() => window.__renderer.zoom) > before);
    await page.locator('#zoom-out').click();
    await page.setViewportSize({ width: 640, height: 800 });
    await page.waitForTimeout(450);
    await screenshot('artifacts/screenshots/ui-mobile.png');
    assert.ok(await page.locator('#world').isVisible());
    assert.ok(await page.locator('#menu-button').isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
    await page.locator('#menu-button').click();
    assert.ok(await page.locator('#resume-game').isVisible());
    await page.locator('#resume-game').click();
    await selectType('villager');
    await action('buildMenu').click();
    assert.ok(await action('build:house').isVisible());
  });
  await check('Victory results and new-game difficulty flow', async () => {
    await page.evaluate(() => {
      const g = window.__game;
      g._damage(g.getEntity(g.enemyTownCenterId), 100000, g.entities.find(e => e.owner === 'player' && e.kind === 'unit'));
    });
    await page.waitForFunction(() => document.querySelector('#modal h2')?.textContent === 'A crown well earned.');
    assert.equal(await page.evaluate(() => window.__game.state), 'won');
    await page.locator('#play-again').click();
    await page.locator('#difficulty-select').selectOption('relaxed');
    await page.locator('#begin-game').click();
    await page.evaluate(() => window.__app.setPaused(true));
    assert.equal(await page.evaluate(() => window.__game.difficulty), 'relaxed');
    assert.equal(await page.evaluate(() => window.__game.state), 'playing');
    assert.equal(await page.locator('#modal-backdrop').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__renderer.game === window.__game), true);
  });
  await check('Defeat results and battlefield review', async () => {
    await page.evaluate(() => {
      const g = window.__game;
      g._damage(g.getEntity(g.playerTownCenterId), 100000, g.entities.find(e => e.owner === 'enemy' && e.kind === 'unit'));
    });
    await page.waitForFunction(() => document.querySelector('#modal h2')?.textContent === 'A kingdom remembered.');
    assert.equal(await page.evaluate(() => window.__game.state), 'lost');
    await page.locator('#view-kingdom').click();
    assert.equal(await page.locator('#modal-backdrop').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__app.paused), true);
  });
  await check('No browser console errors', async () => { assert.deepEqual(errors, []); });
} finally {
  console.log(JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
if (checks.some(c => !c.ok)) process.exitCode = 1;
