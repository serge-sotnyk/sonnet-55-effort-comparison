const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Begin your reign" }).click();
  await page.evaluate(() => (Crownfall.state.ai.raid = 99999));
  console.log("PASS: welcome starts the skirmish");
  let economy = await page.evaluate(() => {
    let before = { ...Crownfall.state.resources[0] };
    Crownfall.step(35);
    return {
      before,
      after: Crownfall.state.resources[0],
      workers: Crownfall.state.units
        .filter((u) => u.team === 0 && u.type === "villager")
        .map((u) => ({ x: u.x, y: u.y, task: u.task })),
    };
  });
  assert(
    economy.after.food > economy.before.food + 30,
    "Food workers must gather",
  );
  assert(
    economy.after.wood > economy.before.wood + 30,
    "Lumber workers must gather",
  );
  assert(economy.after.gold > economy.before.gold + 10, "Miners must gather");
  console.log("PASS: villagers navigate and gather food, wood, and gold");
  await page.getByRole("button", { name: "Military", exact: true }).click();
  await page
    .getByRole("button", { name: "Train Villager", exact: true })
    .click();
  let training = await page.evaluate(() => {
    let before = Crownfall.state.units.filter(
      (u) => u.team === 0 && u.type === "villager",
    ).length;
    let q = Crownfall.state.buildings.find(
      (b) => b.team === 0 && b.type === "town",
    ).queue.length;
    Crownfall.step(14);
    return {
      before,
      after: Crownfall.state.units.filter(
        (u) => u.team === 0 && u.type === "villager",
      ).length,
      q,
    };
  });
  assert(training.q === 1 && training.after === training.before + 1);
  console.log("PASS: training buttons queue and produce villagers");
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Build Barracks", exact: true })
    .click();
  let foundation = await page.evaluate(() => {
    let pos;
    for (let y = 27; y < 40 && !pos; y++)
      for (let x = 12; x < 23 && !pos; x++)
        if (Crownfall.validPlacement("barracks", x, y)) {
          let p = Crownfall.screen(x, y);
          if (p.x > 310 && p.x < 1120 && p.y > 180 && p.y < 690)
            pos = { x, y, ...p, sx: p.x, sy: p.y };
        }
    return pos;
  });
  assert(foundation, "An open construction site must be available");
  await page.mouse.click(foundation.sx, foundation.sy);
  let barracks = await page.evaluate(() => {
    Crownfall.step(45);
    let b = Crownfall.state.buildings.find(
      (b) => b.team === 0 && b.type === "barracks",
    );
    return b ? { progress: b.progress, hp: b.hp } : null;
  });
  assert(barracks && barracks.progress === 1, "Barracks must complete");
  console.log("PASS: placement and assigned worker construct a barracks");
  await page.getByRole("button", { name: "Military", exact: true }).click();
  await page
    .getByRole("button", { name: "Train Man-at-arms", exact: true })
    .click();
  let militia = await page.evaluate(() => {
    Crownfall.step(18);
    return Crownfall.state.units.find(
      (u) => u.team === 0 && u.type === "militia",
    );
  });
  assert(militia);
  console.log("PASS: barracks trains infantry");
  let expansion = await page.evaluate(() => {
    let s = Crownfall.state;
    s.resources[0] = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
    let before = s.age[0],
      ok = Crownfall.advance();
    Crownfall.step(46);
    return { before, ok, after: s.age[0] };
  });
  assert(expansion.ok && expansion.after === 2);
  console.log("PASS: advancing unlocks the Feudal Age");
  let farm = await page.evaluate(() => {
    let worker = Crownfall.state.units.find(
      (u) => u.team === 0 && u.type === "villager",
    );
    Crownfall.select([worker.id]);
    let b;
    for (let y = 28; y < 40 && !b; y++)
      for (let x = 10; x < 24 && !b; x++)
        if (Crownfall.validPlacement("farm", x, y))
          b = Crownfall.placeBuilding("farm", x, y);
    Crownfall.step(45);
    return {
      progress: b.progress,
      workers: Crownfall.state.units.filter(
        (u) => u.target === b.id && u.task === "gather",
      ).length,
    };
  });
  assert(farm.progress === 1 && farm.workers >= 1);
  console.log("PASS: completed farms become renewable food sources");
  let combat = await page.evaluate(() => {
    let s = Crownfall.state;
    s.ai.raid = 99999;
    let a = Crownfall.addUnit("knight", 22, 35, 0),
      enemy = Crownfall.addUnit("militia", 23, 35, 1);
    Crownfall.select([a.id]);
    Crownfall.commandUnits(enemy, { x: enemy.x, y: enemy.y });
    Crownfall.step(12);
    return {
      dead: !Crownfall.getEntity(enemy.id),
      hp: a.hp,
      kills: s.stats.kills,
    };
  });
  assert(combat.dead && combat.kills > 0);
  console.log(
    "PASS: commanded combat applies damage and removes defeated units",
  );
  let armor = await page.evaluate(() => {
    let u = Crownfall.state.units.find(
        (u) => u.team === 0 && u.type === "militia",
      ),
      before = u.maxHp;
    Crownfall.research("armor");
    return { before, after: u.maxHp, done: Crownfall.state.tech[0].armor };
  });
  assert(armor.done && armor.after > armor.before);
  console.log("PASS: research improves existing troops");
  let vision = await page.evaluate(() => {
    let u = Crownfall.state.units.find(
        (u) => u.team === 0 && u.type === "scout",
      ),
      before = Crownfall.state.explored.filter(Boolean).length;
    Crownfall.select([u.id]);
    Crownfall.commandUnits(null, { x: 32, y: 20 });
    Crownfall.step(25);
    return {
      before,
      after: Crownfall.state.explored.filter(Boolean).length,
      distance: Math.hypot(u.x - 32, u.y - 20),
    };
  });
  assert(vision.after > vision.before && vision.distance < 2);
  console.log("PASS: scout moves over distance and reveals the map");
  let ai = await page.evaluate(() => {
    let s = Crownfall.state;
    s.ai.raid = s.time;
    Crownfall.step(1);
    return {
      raids: s.ai.raidCount,
      army: s.units.filter((u) => u.team === 1 && u.type !== "villager").length,
      advancing: s.age[1],
    };
  });
  assert(ai.raids >= 1 && ai.army > 2);
  console.log("PASS: rival grows and launches a raid");
  await page.keyboard.press("Space");
  let frozen = await page.evaluate(() => {
    let t = Crownfall.state.time;
    Crownfall.step(5);
    return Crownfall.state.time === t;
  });
  assert(frozen);
  await page.keyboard.press("Space");
  console.log("PASS: pause freezes simulation");
  let save = await page.evaluate(() => {
    Crownfall.save();
    let expected = Crownfall.state.resources[0].gold;
    Crownfall.state.resources[0].gold = 1;
    let ok = Crownfall.load();
    return { ok, restored: Crownfall.state.resources[0].gold === expected };
  });
  assert(save.ok && save.restored);
  console.log("PASS: save/load restores the kingdom");
  let ages = await page.evaluate(() => {
    Crownfall.reset();
    Crownfall.state.resources[0] = {
      food: 5000,
      wood: 5000,
      gold: 5000,
      stone: 5000,
    };
    Crownfall.state.ai.raid = 99999;
    const reached = [];
    for (const seconds of [46, 61, 76]) {
      if (!Crownfall.advance()) return [];
      Crownfall.step(seconds);
      reached.push(Crownfall.state.age[0]);
    }
    return reached;
  });
  assert.deepEqual(ages, [2, 3, 4]);
  console.log("PASS: all four ages are reachable through timed advancement");
  let win = await page.evaluate(() => {
    let tc = Crownfall.state.buildings.find(
      (b) => b.team === 1 && b.type === "town",
    );
    Crownfall.damage(tc, 99999, { id: 0, team: 0 });
    return Crownfall.state.over;
  });
  assert.equal(win, "victory");
  await page.getByRole("button", { name: "Begin another chapter" }).click();
  let lose = await page.evaluate(() => {
    let tc = Crownfall.state.buildings.find(
      (b) => b.team === 0 && b.type === "town",
    );
    Crownfall.damage(tc, 99999, { id: 0, team: 1 });
    return Crownfall.state.over;
  });
  assert.equal(lose, "defeat");
  console.log("PASS: both victory and defeat conclude the game");
  await page.getByRole("button", { name: "Begin another chapter" }).click();
  await page.keyboard.press("Space");
  await page.screenshot({ path: path.join(__dirname, "kingdom.png") });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, "kingdom-1024.png") });
  assert(
    await page
      .getByRole("button", { name: "Build Barracks", exact: true })
      .isVisible(),
  );
  console.log("PASS: layout remains usable at 1024×768");
  assert.deepEqual(errors, [], "No runtime browser errors");
  console.log("PASS: no browser runtime errors");
  await browser.close();
  console.log("\nAll gameplay checks passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
