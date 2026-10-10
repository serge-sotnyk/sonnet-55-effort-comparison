// Takes a batch of screenshots of the resources preview in ONE browser session (fast iteration).
// Usage: node tools/resources-shots.mjs [--port=8142] [--dpr=2] [--out=/tmp/res] [--sets=trees,forest,nodes,decor,icons,stumps]
// Writes <out>_<set>.png for each set. Prints console errors / page errors.
import { chromium } from 'playwright-core';

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const port = opt.port || 8142, dpr = Number(opt.dpr || 2), out = opt.out || '/tmp/res';
const SETS = {
  trees: ['sheet=trees&zoom=1.3', 1500, 640],
  forest: ['sheet=forest&zoom=1', 1000, 620],
  forest_dark: ['sheet=forest&zoom=1&ground=dark&seed=3', 1000, 620],
  forest_sand: ['sheet=forest&zoom=1&ground=sand&seed=7', 1000, 620],
  nodes: ['sheet=nodes&zoom=1.6', 1500, 800],
  decor: ['sheet=decor&zoom=2.4', 1000, 900],
  icons: ['sheet=icons&zoom=4', 1200, 240],
  stumps: ['sheet=stumps&zoom=3', 1300, 400],
};
const want = (opt.sets ? String(opt.sets).split(',') : Object.keys(SETS)).filter((k) => SETS[k]);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
for (const k of want) {
  const [qs, w, h] = SETS[k];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const problems = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon|404/.test(m.text())) problems.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push('[pageerror] ' + (e.stack || e.message)));
  await page.goto(`http://localhost:${port}/tools/preview/resources.html?${qs}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__done === true', null, { timeout: 60000 }).catch(() => problems.push('preview did not finish'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}_${k}.png` });
  console.log('saved', `${out}_${k}.png`, problems.length ? '\n' + problems.join('\n') : '');
  await page.close();
}
await browser.close();
