// Screenshot helper with clip support for zooming into details of the icon / menu previews.
// Usage: node tools/icons-shot.mjs <url> <out.png> [--w=1600] [--h=1000] [--dpr=2] [--clip=x,y,w,h] [--wait=1500] [--eval=js]
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const url = args[0], out = args[1];
const opt = Object.fromEntries(args.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
if (!url || !out) { console.error('usage: node tools/icons-shot.mjs <url> <out.png> [--clip=x,y,w,h]'); process.exit(1); }
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: Number(opt.w || 1600), height: Number(opt.h || 1000) }, deviceScaleFactor: Number(opt.dpr || 2) });
const problems = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`[console.${m.type()}] ${m.text()}`); else if (opt.logs) console.log('[log]', m.text()); });
page.on('pageerror', e => problems.push('[pageerror] ' + (e.stack || e.message)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(opt.wait || 1500));
if (opt.eval) { const r = await page.evaluate(opt.eval); if (r !== undefined) console.log('eval result:', JSON.stringify(r)); await page.waitForTimeout(Number(opt.wait2 || 300)); }
const shot = { path: out };
if (opt.clip) { const [x, y, w, h] = String(opt.clip).split(',').map(Number); shot.clip = { x, y, width: w, height: h }; }
await page.screenshot(shot);
console.log('saved', out);
const probs = problems.filter(p => !p.includes('404'));
if (probs.length) console.log('PROBLEMS:\n' + probs.join('\n'));
await browser.close();
