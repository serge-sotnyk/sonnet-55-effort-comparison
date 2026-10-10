// Runs the units integration checker page headlessly and prints the result JSON.
// Usage: node tools/units-check.mjs [port=28101] [--mode=full|quick|warm] [--scale=1|2]
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const port = args.find(a => /^\d+$/.test(a)) || '28101';
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: Number(opt.scale || 2) });
const problems = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`[console.${m.type()}] ${m.text()}`); });
page.on('pageerror', e => problems.push('[pageerror] ' + (e.stack || e.message)));
const url = `http://localhost:${port}/tools/preview/units_check.html?mode=${opt.mode || 'full'}&scale=${opt.scale || 2}`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__done === true, null, { timeout: Number(opt.timeout || 600000) });
const res = await page.evaluate(() => window.__result);
console.log(JSON.stringify(res, null, 1));
if (problems.length) console.log('PROBLEMS:\n' + problems.slice(0, 20).join('\n'));
await browser.close();
process.exit(res.errorCount ? 1 : 0);
