// Micro-benchmark of the sprite builders (bypasses the cache): median ms per tree variant etc., including a pixel readback that
// forces the queued canvas drawing to be rasterised.  Usage: node tools/resources-bench.mjs [--port=8142] [--scale=2] [--runs=7]
import { chromium } from 'playwright-core';

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const port = opt.port || 8142, scale = Number(opt.scale || 2), runs = Number(opt.runs || 7);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: scale });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/tools/preview/resources-check.html?quick=1&scale=${scale}`, { waitUntil: 'load' });
await page.waitForFunction('window.__done === true', null, { timeout: 120000 });
const res = await page.evaluate(`(async () => {
  const T = await import('/js/art/resources_trees.js');
  const N = await import('/js/art/resources_nodes.js');
  const A = await import('/js/art/resources_animals.js');
  const D = await import('/js/art/resources_decor.js');
  const flush = (cv) => cv.getContext('2d').getImageData(0, 0, 1, 1);
  const med = (a) => Math.min(...a);
  const time = (fn) => { const r = []; for (let i = 0; i < ${runs}; i++) { const t0 = performance.now(); const s = fn(); flush(s.canvas); r.push(performance.now() - t0); } return +med(r).toFixed(2); };
  const out = { trees: [], stump: [], berries: [], mines: [], carcass: [], decor: {} };
  for (let v = 0; v < T.TREE_COUNT; v++) out.trees.push(time(() => T.buildTree(v)));
  for (let v = 0; v < T.TREE_COUNT; v += 4) out.stump.push(time(() => N.buildStump(v)));
  for (let lv = 0; lv < 3; lv++) out.berries.push(time(() => N.buildBerries(0, lv)));
  for (const k of ['gold_mine', 'stone_mine']) for (let lv = 0; lv < 3; lv++) out.mines.push(time(() => N.buildMine(k, 0, lv)));
  for (const k of ['carcass_deer', 'carcass_boar', 'carcass_sheep']) for (let lv = 0; lv < 3; lv++) out.carcass.push(time(() => A.buildCarcass(k, 0, lv)));
  D.DECOR_KINDS.forEach((k, ki) => { out.decor[k] = []; for (let v = 0; v < D.DECOR_COUNTS[ki]; v++) out.decor[k].push(time(() => D.buildDecor(ki, v))); });
  const avg = (a) => +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2);
  out.summary = { treeAvg: avg(out.trees), treeMax: Math.max(...out.trees), stumpAvg: avg(out.stump), berriesAvg: avg(out.berries), minesAvg: avg(out.mines), carcassAvg: avg(out.carcass) };
  return out;
})()`);
await browser.close();
console.log(JSON.stringify(res, null, 1).replace(/\n\s+/g, ' '));
