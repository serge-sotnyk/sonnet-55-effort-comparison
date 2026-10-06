const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => console.log("ERROR", e.message));
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Begin your reign" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tests/kingdom.png" });
  console.log(
    await page.evaluate(() => ({
      units: Crownfall.state.units.length,
      time: Crownfall.state.time,
      resource: Crownfall.state.resources[0],
      villagers: Crownfall.state.units
        .filter((u) => u.team === 0)
        .map((u) => ({
          type: u.type,
          task: u.task,
          x: u.x,
          y: u.y,
          path: u.path.length,
        })),
    })),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
