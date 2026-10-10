// Runs the buildings integration checks in headless Chrome and prints a summary.
//   page 1: tools/preview/buildings-check.html          every exported function x ids x ages x teams x states (+ garbage input), timings
//   page 2: tools/preview/buildings-check.html?warm=1,2 fresh-page warmBuildingSprites([1,2]) timing
// Usage: node tools/buildings-check.mjs [port=8142] [--scale=2] [--dpr=2]
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const port = args.find(a => /^\d+$/.test(a)) || '8142';
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const dpr = Number(opt.dpr || 2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const problems = [];
async function run(query) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: dpr });
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/favicon|404|warm-only/.test(m.text())) problems.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => { if (!/warm-only/.test(e.message)) problems.push('[pageerror] ' + (e.stack || e.message)); });
  const sc = opt.scale ? `scale=${opt.scale}` : '';
  await page.goto(`http://localhost:${port}/tools/preview/buildings-check.html?${[query, sc].filter(Boolean).join('&')}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__checkDone === true', null, { timeout: 600000 });
  const r = await page.evaluate(() => window.__result);
  await page.close();
  return r;
}
const main = await run('');
const warm = await run('warm=1,2');
console.log(JSON.stringify({ ...main, warmFresh: warm }, null, 1));
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));
await browser.close();
process.exit(main.errors || problems.length ? 1 : 0);
