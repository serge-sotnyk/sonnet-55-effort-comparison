// Generic screenshot helper for visual testing.
// Usage: node tools/shot.mjs <url> <out.png> [--wait=500] [--w=1280] [--h=720] [--dpr=1] [--eval="js"] [--full]
// Prints console errors / page errors so you notice broken modules. Requires playwright-core (installed in tools/).
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const url = args[0], out = args[1];
const opt = Object.fromEntries(args.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true];
}));
if (!url || !out) { console.error('usage: node tools/shot.mjs <url> <out.png> [--wait=ms] [--w=] [--h=] [--dpr=] [--eval=js] [--full]'); process.exit(1); }

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({
  viewport: { width: Number(opt.w || 1280), height: Number(opt.h || 720) },
  deviceScaleFactor: Number(opt.dpr || 1),
});
const problems = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`[console.${m.type()}] ${m.text()}`); else if (opt.logs) console.log('[log]', m.text()); });
page.on('pageerror', e => problems.push('[pageerror] ' + (e.stack || e.message)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(opt.wait || 500));
if (opt.eval) { const r = await page.evaluate(opt.eval); if (r !== undefined) console.log('eval result:', JSON.stringify(r)); await page.waitForTimeout(Number(opt.wait2 || 300)); }
await page.screenshot({ path: out, fullPage: !!opt.full });
console.log('saved', out);
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));
await browser.close();
