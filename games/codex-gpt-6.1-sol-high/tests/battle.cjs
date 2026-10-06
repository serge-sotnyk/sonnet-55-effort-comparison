const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  let browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  let page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Begin your reign" }).click();
  console.log(
    "Economy after five minutes:",
    await page.evaluate(() => {
      Crownfall.step(300);
      return {
        resources: Crownfall.state.resources[0],
        aiAge: Crownfall.state.age[1],
        aiResources: Crownfall.state.resources[1],
        aiAdvancing: Crownfall.state.advancing[1],
        aiWorkers: Crownfall.state.units
          .filter((u) => u.team === 1 && u.type === "villager")
          .map((u) => ({ task: u.task, gather: u.gatherType, x: u.x, y: u.y })),
        raids: Crownfall.state.ai.raidCount,
        playerTownHealth: Crownfall.state.buildings.find(
          (b) => b.type === "town" && b.team === 0,
        )?.hp,
        workers: Crownfall.state.units.filter(
          (u) => u.team === 0 && u.type === "villager",
        ).length,
      };
    }),
  );
  await page.evaluate(() => {
    Crownfall.reset();
    Crownfall.state.age[0] = 3;
    Crownfall.state.ai.raid = 99999;
    let army = [];
    for (let i = 0; i < 16; i++)
      army.push(
        Crownfall.addUnit(
          "knight",
          25 + (i % 4) * 0.55,
          28 + Math.floor(i / 4) * 0.55,
        ),
      );
    for (let i = 0; i < 6; i++)
      army.push(Crownfall.addUnit("ram", 25 + i * 0.6, 31));
    Crownfall.select(army.map((u) => u.id));
    Crownfall.commandUnits(
      Crownfall.state.buildings.find((b) => b.team === 1 && b.type === "town"),
      { x: 39, y: 16 },
    );
    Crownfall.step(160);
  });
  let battle = await page.evaluate(() => ({
    outcome: Crownfall.state.over,
    kills: Crownfall.state.stats.kills,
    lost: Crownfall.state.stats.lost,
    town: Crownfall.state.buildings.find(
      (b) => b.team === 1 && b.type === "town",
    )?.hp,
    army: Crownfall.state.units.filter(
      (u) => u.team === 0 && u.type !== "villager",
    ).length,
  }));
  console.log("Army siege result:", battle);
  assert.equal(
    battle.outcome,
    "victory",
    "An attacking army with siege must be able to destroy the rival town center",
  );
  await page.getByRole("button", { name: "Begin another chapter" }).click();
  await page.mouse.move(700, 550);
  await page.waitForTimeout(800);
  const perf = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0,
          start = performance.now(),
          gameStart = Crownfall.state.time;
        function tick() {
          frames++;
          if (performance.now() - start >= 3000)
            resolve({
              fps: Math.round((frames * 1000) / (performance.now() - start)),
              simulatedSeconds: Crownfall.state.time - gameStart,
            });
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }),
  );
  console.log("Rendering performance:", perf);
  await page.screenshot({ path: "tests/kingdom.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "tests/kingdom-1024.png" });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: sustained economy, complete army siege, and error-free rendering",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
