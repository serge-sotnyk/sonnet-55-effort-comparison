import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:4173");
await page.locator("#setupForm [name=visibility]").selectOption("all");
await page.locator("#setupForm [name=opponents]").selectOption("3");
await page.locator("#setupForm [name=resources]").selectOption("rich");
await page.locator("#setupForm button[type=submit]").click();
await page.waitForTimeout(300);
await page.evaluate(() => RTS.pause());
const results = [];
async function test(name, fn) {
  try {
    let result = await page.evaluate(fn);
    assert.equal(result.pass, true, JSON.stringify(result));
    results.push({ name, status: "PASS", detail: result });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, status: "FAIL", error: e.message });
    console.log("FAIL", name, e.message);
  }
}
await page.evaluate(() => {
  window.resetTest = (map = "land", age = 3) => {
    let s = {
      name: "Tester",
      civ: "Britons",
      color: "#4fa9ec",
      size: 40,
      opponents: 3,
      map,
      age,
      resources: "rich",
      visibility: "all",
      speed: 1,
      seed: 42,
      cheats: true,
      tips: false,
    };
    let g = RTS.generate(s, true);
    for (let p of g.players) {
      p.ai = false;
      p.res = { food: 20000, wood: 20000, gold: 20000, stone: 20000 };
      p.start = { x: 6 + p.id * 8, y: 6 };
    }
    return g;
  };
  window.step = (seconds) => {
    for (let i = 0; i < seconds * 10; i++) RTS.tick(0.1);
  };
});
await test("Full setup applies to four players", () => {
  let g = RTS.state;
  return {
    pass:
      g.players.length === 4 &&
      g.players.every((p) => p.res.food >= 2000) &&
      g.settings.visibility === "all" &&
      new Set(g.players.map((p) => p.color)).size === 4,
    players: g.players.map((p) => ({ civ: p.civ, color: p.color })),
  };
});
await test("Economy: chop, carry, drop off, deplete", () => {
  let g = resetTest();
  let tc = RTS.entity("Town Center", 6, 6, 0),
    v = RTS.entity("Villager", 9, 7, 0),
    tree = RTS.entity("tree", 10, 7, -1, { stock: 30 });
  let start = g.players[0].res.wood;
  RTS.setTask(v, { kind: "gather", target: tree.id });
  step(35);
  return {
    pass: g.players[0].res.wood > start && tree.depleted,
    wood: g.players[0].res.wood - start,
    stock: tree.stock,
  };
});
await test("Worker construction, paid training, all four ages and combat", () => {
  let g = resetTest("land", 0);
  let tc = RTS.entity("Town Center", 6, 6, 0),
    v = RTS.entity("Villager", 8, 8, 0);
  let bar = RTS.construct("Barracks", 10, 10);
  RTS.setTask(v, { kind: "build", target: bar.id });
  step(23);
  let trained = RTS.queue(bar, "Militia");
  step(11);
  for (let i = 0; i < 3; i++) {
    RTS.queue(tc, "advance", "age");
    step(41);
  }
  let m = g.entities.find((e) => e.type === "Militia"),
    enemy = RTS.entity("Archer", m.x + 1, m.y, 1);
  RTS.setTask(m, { kind: "attack", target: enemy.id });
  step(15);
  return {
    pass:
      bar.built === 1 && trained && g.players[0].age === 3 && enemy.hp === 0,
    age: g.players[0].age,
    enemyHp: enemy.hp,
  };
});
await test("Sheep capture, guard stability, recapture and control", () => {
  resetTest();
  let s = RTS.entity("sheep", 10, 10),
    v = RTS.entity("Villager", 11, 10, 0);
  step(1);
  let own = s.owner;
  let foe = RTS.entity("Villager", 10, 11, 1);
  step(8);
  let guarded = s.owner;
  v.x = 20;
  v.y = 20;
  step(6);
  RTS.setTask(s, { kind: "move", x: 14, y: 12 });
  step(4);
  return {
    pass: own === 0 && guarded === 0 && s.owner === 1 && s.x > 11,
    own,
    guarded,
    recaptured: s.owner,
    x: s.x,
  };
});
await test("Hunting sheep and boar produces food", () => {
  let g = resetTest();
  RTS.entity("Town Center", 6, 6, 0);
  let v = RTS.entity("Villager", 9, 8, 0),
    s = RTS.entity("sheep", 10, 8, 0, { stock: 24 }),
    start = g.players[0].res.food;
  RTS.setTask(v, { kind: "gather", target: s.id });
  step(30);
  let sheepFood = g.players[0].res.food - start;
  let b = RTS.entity("boar", v.x + 0.5, v.y, -1, { hp: 20, stock: 24 });
  RTS.setTask(v, { kind: "gather", target: b.id });
  step(35);
  return {
    pass:
      sheepFood > 0 && b.carcass && g.players[0].res.food - start > sheepFood,
    sheepFood,
    total: g.players[0].res.food - start,
    boar: b.carcass,
  };
});
await test("Deer flee and wolves threaten units", () => {
  resetTest();
  let v = RTS.entity("Villager", 10, 10, 0),
    deer = RTS.entity("deer", 11, 10),
    wolf = RTS.entity("wolf", 10, 11);
  let before = v.hp;
  step(4);
  return {
    pass: deer.x > 12 && v.hp < before,
    deerX: deer.x,
    damage: before - v.hp,
  };
});
await test("Fishing economy returns food to a shoreline Dock", () => {
  let g = resetTest("coast");
  for (let y = 0; y < 40; y++)
    for (let x = 15; x < 40; x++) g.tiles[y][x].t = "water";
  let dock = RTS.construct("Dock", 15.5, 10.5, 0, true),
    ship = RTS.entity("Fishing Ship", 18, 10, 0),
    fish = RTS.entity("fish", 19, 10, -1, { stock: 36 }),
    start = g.players[0].res.food;
  RTS.setTask(ship, { kind: "gather", target: fish.id });
  step(50);
  return {
    pass: !!dock && g.players[0].res.food > start && fish.stock < 36,
    gain: g.players[0].res.food - start,
    fish: fish.stock,
  };
});
await test("Land / sea restrictions and galley combat", () => {
  let g = resetTest("coast");
  for (let y = 0; y < 40; y++)
    for (let x = 15; x < 40; x++) g.tiles[y][x].t = "water";
  let v = RTS.entity("Villager", 10, 10, 0),
    ship = RTS.entity("Galley", 18, 10, 0),
    enemy = RTS.entity("Galley", 20, 10, 1);
  RTS.setTask(v, { kind: "move", x: 20, y: 10 });
  RTS.setTask(ship, { kind: "attack", target: enemy.id });
  step(28);
  return {
    pass: v.x < 15 && ship.x >= 15 && enemy.hp < 125,
    landX: v.x,
    shipX: ship.x,
    enemyHp: enemy.hp,
  };
});
await test("Transport loads, sails and unloads land units", () => {
  let g = resetTest("islands");
  for (let y = 0; y < 40; y++)
    for (let x = 14; x < 26; x++) g.tiles[y][x].t = "water";
  let tr = RTS.entity("Transport Ship", 14.5, 10.5, 0),
    v = RTS.entity("Militia", 12, 10, 0);
  RTS.setTask(v, { kind: "load", target: tr.id });
  step(5);
  let loaded = v.garrison === tr.id;
  RTS.setTask(tr, { kind: "move", x: 25.5, y: 10.5 });
  step(8);
  let unloaded = RTS.unload(tr);
  return {
    pass:
      loaded &&
      unloaded &&
      !v.garrison &&
      v.x >= 26 &&
      !g.tiles[Math.floor(v.y)][Math.floor(v.x)].t.includes("water"),
    loaded,
    landX: v.x,
    shipX: tr.x,
  };
});
await test("Garrison, defensive fire, release, Town Bell resumes work", () => {
  resetTest();
  let tc = RTS.entity("Town Center", 6, 6, 0),
    v = RTS.entity("Villager", 8, 8, 0),
    tree = RTS.entity("tree", 9, 8);
  RTS.setTask(v, { kind: "gather", target: tree.id });
  RTS.bell();
  step(6);
  let sheltered = !!v.garrison;
  let enemy = RTS.entity("Militia", 10, 6, 1);
  step(3);
  let damage = enemy.hp < 55;
  RTS.bell();
  step(2);
  return {
    pass: sheltered && damage && !v.garrison && v.task?.kind === "gather",
    sheltered,
    damage,
    task: v.task?.kind,
  };
});
await test("Manual garrison order releases units without immediate re-entry", () => {
  resetTest();
  const tc = RTS.entity("Town Center", 6, 6, 0),
    v = RTS.entity("Villager", 9, 8, 0),
    tree = RTS.entity("tree", 10, 8);
  RTS.setTask(v, { kind: "gather", target: tree.id });
  RTS.select([v.id]);
  RTS.commandAt({ x: tc.x, y: tc.y }, tc, "garrison");
  step(6);
  const entered = v.garrison === tc.id;
  RTS.ungarrison(tc);
  step(3);
  return {
    pass: entered && !v.garrison && v.task?.kind === "gather",
    entered,
    resumed: v.task?.kind,
  };
});
await test("Repairs consume resources; monks heal living units", () => {
  let g = resetTest();
  let b = RTS.entity("House", 10, 10, 0, { hp: 100 }),
    v = RTS.entity("Villager", 11, 11, 0),
    start = g.players[0].res.wood;
  RTS.setTask(v, { kind: "repair", target: b.id });
  step(15);
  let u = RTS.entity("Knight", 13, 12, 0, { hp: 30 }),
    m = RTS.entity("Monk", 13, 13, 0);
  RTS.setTask(m, { kind: "heal", target: u.id });
  step(14);
  return {
    pass: b.hp === b.maxHp && g.players[0].res.wood < start && u.hp > 30,
    buildingHp: b.hp,
    knightHp: u.hp,
    woodUsed: start - g.players[0].res.wood,
  };
});
await test("Monk conversion delay, relic collection and gold income", () => {
  let g = resetTest();
  let mon = RTS.entity("Monastery", 10, 10, 0),
    m = RTS.entity("Monk", 12, 12, 0),
    relic = RTS.entity("relic", 13, 12);
  RTS.setTask(m, { kind: "relic", target: relic.id });
  step(12);
  let start = g.players[0].res.gold;
  step(5);
  let income = g.players[0].res.gold - start;
  let foe = RTS.entity("Villager", m.x + 2, m.y, 1);
  RTS.setTask(m, { kind: "convert", target: foe.id });
  step(3);
  let delay = foe.owner === 1;
  step(6);
  return {
    pass: mon.relics === 1 && income >= 4.9 && delay && foe.owner === 0,
    relics: mon.relics,
    income,
    delay,
    converted: foe.owner,
  };
});
await test("Relics drop on monk death and Monastery destruction", () => {
  let g = resetTest();
  let m = RTS.entity("Monk", 10, 10, 0, { relic: true }),
    b = RTS.entity("Monastery", 12, 12, 0, { relics: 2 });
  RTS.damage(m, 1000);
  RTS.damage(b, 5000);
  return {
    pass: g.entities.filter((e) => e.type === "relic" && e.hp > 0).length === 3,
    relics: g.entities.filter((e) => e.type === "relic").length,
  };
});
await test("Actual land trade route yields distance-based gold", () => {
  let g = resetTest();
  g.players[0].relations[1] = "ally";
  g.players[1].relations[0] = "ally";
  let a = RTS.entity("Market", 6, 6, 0),
    b = RTS.entity("Market", 20, 6, 1),
    cart = RTS.entity("Trade Cart", 8, 8, 0),
    start = g.players[0].res.gold;
  RTS.setTask(cart, { kind: "trade", target: b.id });
  step(28);
  let income = g.players[0].res.gold - start;
  g.players[0].relations[1] = "war";
  step(1);
  return {
    pass: income >= 35 && !cart.task,
    income,
    stopped: !cart.task,
    trips: cart.tradeTrips,
  };
});
await test("Actual sea trade route yields gold", () => {
  let g = resetTest("coast");
  for (let y = 0; y < 40; y++)
    for (let x = 15; x < 40; x++) g.tiles[y][x].t = "water";
  g.players[0].relations[1] = "ally";
  g.players[1].relations[0] = "ally";
  let a = RTS.entity("Dock", 15.5, 6, 0),
    b = RTS.entity("Dock", 15.5, 24, 1),
    u = RTS.entity("Trade Cog", 18, 6, 0),
    start = g.players[0].res.gold;
  RTS.setTask(u, { kind: "trade", target: b.id });
  step(35);
  return {
    pass: g.players[0].res.gold - start >= 45,
    income: g.players[0].res.gold - start,
  };
});
await test("Height advantage is exactly +25% / -25%", () => {
  let g = resetTest();
  g.tiles[10][10].h = 2;
  let a = RTS.entity("Archer", 10.5, 10.5, 0),
    b = RTS.entity("Archer", 12.5, 10.5, 1);
  RTS.attack(a, b, 0.1);
  let high = 35 - b.hp;
  a.hp = 35;
  b.cool = 0;
  RTS.attack(b, a, 0.1);
  let low = 35 - a.hp;
  return { pass: high === 6.25 && low === 3.75, high, low };
});
await test("Age locks, costs, population limits and upgrades enforced", () => {
  let g = resetTest("land", 0);
  let tc = RTS.entity("Town Center", 6, 6, 0),
    dock = RTS.entity("Dock", 10, 10, 0);
  let locked = !RTS.queue(dock, "Galley");
  g.players[0].res.food = 0;
  let funds = !RTS.queue(tc, "Villager");
  g.players[0].res.food = 10000;
  for (let i = 0; i < 10; i++) RTS.entity("Villager", 6 + i * 0.1, 9, 0);
  let pop = !RTS.queue(tc, "Villager");
  return { pass: locked && funds && pop, locked, funds, pop };
});
await test("Cheat additions, reveal, instant queues and controllable Cobra", () => {
  let g = resetTest("land", 0);
  let tc = RTS.entity("Town Center", 6, 6, 0),
    start = g.players[0].res.food;
  RTS.cheat("CHEESE STEAK JIMMY'S");
  let add = g.players[0].res.food - start;
  RTS.cheat("aegis");
  RTS.queue(tc, "Villager");
  step(0.1);
  RTS.cheat("marco");
  RTS.cheat("polo");
  RTS.cheat("how do you turn this on");
  let car = g.entities.find((e) => e.type === "Cobra Car"),
    enemy = RTS.entity("Knight", car.x + 3, car.y, 1);
  RTS.setTask(car, { kind: "attack", target: enemy.id });
  step(2);
  return {
    pass:
      add === 10000 &&
      g.instant &&
      g.settings.visibility === "all" &&
      enemy.hp === 0 &&
      g.entities.some((e) => e.type === "Villager"),
    add,
    enemyHp: enemy.hp,
  };
});
await test("Four-player AI progresses its economy and ages", () => {
  RTS.generate(
    {
      name: "Tester",
      civ: "Britons",
      color: "#4fa9ec",
      size: 40,
      opponents: 3,
      map: "land",
      age: 0,
      resources: "rich",
      visibility: "all",
      speed: 1,
      seed: 42,
      cheats: true,
    },
    false,
  );
  step(180);
  let g = RTS.state,
    players = g.players.slice(1).map((p) => ({
      age: p.age,
      workers: g.entities.filter(
        (e) => e.owner === p.id && e.type === "Villager" && e.hp > 0,
      ).length,
      army: g.entities.filter(
        (e) =>
          e.owner === p.id &&
          e.kind === "unit" &&
          e.type !== "Villager" &&
          e.hp > 0,
      ).length,
    }));
  return {
    pass: players.every((p) => p.age >= 1 && p.workers >= 3 && p.army > 1),
    players,
  };
});

await test("Fire and Demolition Ships deal real naval damage", () => {
  let g = resetTest("coast");
  for (let y = 0; y < 40; y++)
    for (let x = 15; x < 40; x++) g.tiles[y][x].t = "water";
  let fire = RTS.entity("Fire Ship", 20, 10, 0),
    foe = RTS.entity("Galley", 22, 10, 1);
  RTS.setTask(fire, { kind: "attack", target: foe.id });
  step(2);
  let burned = foe.hp < 125;
  let demo = RTS.entity("Demolition Ship", 25, 15, 0),
    foe2 = RTS.entity("Galley", 26, 15, 1);
  RTS.setTask(demo, { kind: "attack", target: foe2.id });
  step(1);
  return {
    pass: burned && demo.hp === 0 && foe2.hp < 30,
    burned,
    demoHp: demo.hp,
    blastHp: foe2.hp,
  };
});
await test("Villagers repair coastal ships and siege engines", () => {
  let g = resetTest("coast");
  for (let y = 0; y < 40; y++)
    for (let x = 15; x < 40; x++) g.tiles[y][x].t = "water";
  let v = RTS.entity("Villager", 14, 10, 0),
    ship = RTS.entity("Galley", 16, 10, 0, { hp: 40 });
  RTS.setTask(v, { kind: "repair", target: ship.id });
  step(6);
  let ram = RTS.entity("Ram", 12, 10, 0, { hp: 50 });
  RTS.setTask(v, { kind: "repair", target: ram.id });
  step(12);
  return {
    pass: ship.hp === ship.maxHp && ram.hp === ram.maxHp,
    ship: ship.hp,
    ram: ram.hp,
  };
});
await test("Island AI builds fishing economy, fleet and transport invasion", () => {
  let g = RTS.generate(
    {
      name: "Tester",
      civ: "Britons",
      color: "#4fa9ec",
      size: 40,
      opponents: 1,
      map: "islands",
      age: 2,
      resources: "rich",
      visibility: "all",
      speed: 1,
      seed: 42,
      cheats: true,
      difficulty: "normal",
    },
    false,
  );
  step(420);
  let boats = g.entities.filter((e) => e.owner === 1),
    fish = boats.filter((e) => e.type === "Fishing Ship").length,
    fleet = boats.filter((e) =>
      ["Galley", "Fire Ship", "Demolition Ship"].includes(e.type),
    ).length,
    landings = boats
      .filter((e) => e.type === "Transport Ship")
      .reduce((s, e) => s + (e.landedCount || 0), 0);
  return {
    pass: fish >= 1 && fleet >= 1 && landings >= 3,
    fish,
    fleet,
    landings,
    humanTc: g.entities.find((e) => e.owner === 0 && e.type === "Town Center")
      .hp,
  };
});
// UI and audio checks use browser events, including Enter-to-type shortcut isolation.
await page.evaluate(() => {
  resetTest("land", 0);
  RTS.entity("Town Center", 6, 6, 0);
  RTS.updateUI();
});
await page.keyboard.press("Enter");
await page.locator("#chat").fill("lumberjack");
await page.keyboard.press("Enter");
assert.equal(await page.evaluate(() => RTS.state.players[0].res.wood), 30000);
results.push({
  name: "Enter chat executes cheats without gameplay shortcuts",
  status: "PASS",
});
await page.locator("#audioBtn").click();
await page.locator('input[aria-label="voice volume"]').fill("35");
await page.locator("#muteAll").check();
assert.equal(
  await page.evaluate(() => RTS.audio.muted && RTS.audio.vol.voice === 0.35),
  true,
);
await page.locator("#muteAll").uncheck();
await page.locator("#closeModal").click();
await test("Local voice clips decode as real non-silent audio", async () => {
  let response = await fetch("audio/franks-select-0.wav"),
    buf = await response.arrayBuffer(),
    data = await RTS.audio.context.decodeAudioData(buf),
    values = data.getChannelData(0);
  let peak = values.reduce((a, b) => Math.max(a, Math.abs(b)), 0);
  return {
    pass: data.duration > 0.3 && peak > 0.05,
    duration: data.duration,
    peak,
  };
});
await test("Spoken acknowledgement plays and repeat clicks replace it", async () => {
  RTS.audio.lastVoice = 0;
  RTS.audio.voice("select");
  let first = RTS.audio.playing;
  await new Promise((r) => setTimeout(r, 300));
  RTS.audio.lastVoice = 0;
  RTS.audio.voice("move");
  await new Promise((r) => setTimeout(r, 150));
  return {
    pass:
      first.paused &&
      RTS.audio.playing !== first &&
      !RTS.audio.playing.paused &&
      RTS.audio.playing.duration > 0.2,
    oldPaused: first.paused,
    newPlaying: !RTS.audio.playing.paused,
  };
});
results.push({
  name: "Separate volume sliders and mute respond",
  status: "PASS",
});
await page.locator("#exitBtn").click();
await page.locator("#openEditor").click();
await page.locator("#edSave").click();
let count = await page.evaluate(() => RTS.state.entities.length);
await page.locator("#edKind").selectOption("resource");
await page.locator("#palette button").filter({ hasText: "gold" }).click();
await page.mouse.click(950, 380);
await page.locator("#edUndo").click();
assert.equal(await page.evaluate(() => RTS.state.entities.length), count);
await page.locator("#edRedo").click();
assert.equal(await page.evaluate(() => RTS.state.entities.length), count + 1);
await page.locator("#edLoad").click();
assert.equal(await page.evaluate(() => RTS.state.entities.length), count);
results.push({
  name: "Editor placement, undo, redo, save and reload",
  status: "PASS",
});

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#edExport").click(),
]);
await download.saveAs("/tmp/crown-export-test.json");
const exported = JSON.parse(
  fs.readFileSync("/tmp/crown-export-test.json", "utf8"),
);
await page.locator("#edFile").setInputFiles("/tmp/crown-export-test.json");
await page.waitForTimeout(150);
assert.equal(
  await page.evaluate(() => RTS.state.entities.length),
  exported.entities.length,
);
results.push({
  name: "Editor file export and import round trip",
  status: "PASS",
});
await test("Editor validates fish / ships on land, missing starts, overlaps", () => {
  resetTest();
  RTS.entity("Town Center", 6, 6, 0);
  RTS.entity("House", 6, 6, 0);
  RTS.entity("fish", 10, 10);
  RTS.entity("Galley", 12, 12, 0);
  let errors = RTS.validateMap();
  return {
    pass:
      errors.some((e) => e.includes("fish")) &&
      errors.some((e) => e.includes("Galley")) &&
      errors.some((e) => e.includes("needs a Town")) &&
      errors.some((e) => e.includes("Overlapping")),
    errors,
  };
});
await page.evaluate(() => {
  RTS.generate(
    {
      name: "Tester",
      civ: "Britons",
      color: "#4fa9ec",
      size: 40,
      opponents: 1,
      map: "land",
      age: 2,
      resources: "rich",
      visibility: "all",
      speed: 1,
      seed: 42,
      cheats: true,
    },
    false,
  );
  RTS.updateUI();
});
await page.locator("#edPlay").click();
assert.equal(await page.evaluate(() => RTS.editing), false);
results.push({
  name: "Editor launches a playable custom match",
  status: "PASS",
});
await page.evaluate(() => {
  RTS.pause();
  RTS.cheat("polo");
  let g = RTS.state,
    p = g.players[0].start;
  for (let [type, x, y] of [
    ["Mill", p.x - 3, p.y + 4],
    ["Barracks", p.x + 2, p.y - 3],
    ["Monastery", p.x - 4, p.y - 3],
    ["Farm", p.x + 3, p.y + 5],
    ["Archery Range", p.x + 5, p.y - 1],
  ]) {
    let b = RTS.entity(type, x, y, 0);
    b.built = 1;
  }
  RTS.center(p);
  RTS.select([
    g.entities.find((e) => e.type === "Town Center" && e.owner === 0).id,
  ]);
  RTS.render();
});
await page.screenshot({ path: "/tmp/crown-developed.png" });
for (let viewport of [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(100);
  let fit = await page.evaluate(() => {
    let b = document.querySelector("#bottom").getBoundingClientRect(),
      r = document.querySelector("#topbar").getBoundingClientRect();
    return b.width <= innerWidth && r.width <= innerWidth;
  });
  assert(fit);
  await page.screenshot({ path: `/tmp/crown-${viewport.width}.png` });
}
results.push({
  name: "Desktop layouts at 1280×720 and 1440×900",
  status: "PASS",
});
await page.locator("#diplomacyBtn").click();
await page
  .locator("#dipRows button")
  .filter({ hasText: "peace" })
  .first()
  .click();
await page.locator("#closeModal").click();
let relation = await page.evaluate(() => RTS.state.players[0].relations[1]);
assert.equal(relation, "peace");
results.push({
  name: "Diplomacy UI proposal changes relations",
  status: "PASS",
});
await page.locator("#exitBtn").click();
await page.locator("#setupForm button[type=submit]").click();
assert.equal(await page.evaluate(() => RTS.state.time < 2), true);
results.push({ name: "Restart starts a fresh match", status: "PASS" });
assert.deepEqual(errors, []);
results.push({ name: "No browser runtime errors", status: "PASS" });
fs.writeFileSync("test-results.json", JSON.stringify(results, null, 2));
await browser.close();
let failed = results.filter((r) => r.status === "FAIL");
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
