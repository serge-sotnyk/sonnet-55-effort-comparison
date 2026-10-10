// Integration + timing checker for js/art/icons.js and js/art/menu.js (runs tools/preview/icons-check.html in headless Chrome).
// Usage: node tools/icons-check.mjs [--port=8103] [--dprs=1,2] [--dpr=2] [--angle=metal|swiftshader]    (the dev server must be running: node server.mjs 8103)
import { chromium } from 'playwright-core';
const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const port = opt.port || 8103, dpr = Number(opt.dpr || 2);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', ...(opt.angle ? ['--use-angle=' + opt.angle] : [])],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: dpr });
const problems = [];
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) problems.push(m.text()); });
page.on('pageerror', e => problems.push('[pageerror] ' + (e.stack || e.message)));
await page.goto(`http://localhost:${port}/tools/preview/icons-check.html?dprs=${opt.dprs || '1,2'}&dpr=${dpr}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__done === true, null, { timeout: 180000 });
const r = await page.evaluate(() => window.__result);
await browser.close();
const f = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : n);
console.log(`specs checked: ${r.counts.specs} (tech icon strings: ${r.counts.techSpecs}, glyph names: ${r.counts.glyphs}), sprite scale from dpr=${dpr}`);
console.log(`getIcon cold: avg ${f(r.icons.avgMs)} ms, p50 ${f(r.icons.p50)}, p95 ${f(r.icons.p95)}, max ${f(r.icons.max)} ms (${r.icons.worst.spec}) over ${r.icons.calls} calls`);
console.log(`getIcon warm (cached): ${f(r.icons.warmCallUs, 3)} us/call`);
console.log('civ emblems: ' + r.emblems.map(e => `${e.civ}@${e.size}=${e.ms}ms`).join('  '));
console.log('drawMenuBackdrop per-frame cost: js = main-thread command time, gpu-amortized = whole batch incl. raster with a single readback at the end,');
console.log('  software = worst case with a readback after EVERY frame (forces CPU rasterization):');
for (const b of r.backdrop) console.log(`  ${b.size} @DPR${b.dpr}: first-frame build ${b.buildMs} ms, resize rebuild ${b.rebuildMs} ms | js avg ${b.jsAvg} p95 ${b.jsP95} max ${b.jsMax} ms | gpu-amortized ${b.amortized} ms | software avg ${b.softwareAvg} p95 ${b.softwareP95} ms`);
if (r.warnings.length) { console.log(`WARNINGS (${r.warnings.length}):`); r.warnings.slice(0, 60).forEach(w => console.log('  - ' + w)); if (r.warnings.length > 60) console.log('  ...'); }
if (r.errors.length || problems.length) { console.log(`ERRORS (${r.errors.length + problems.length}):`); [...r.errors, ...problems].forEach(e => console.log('  - ' + e)); process.exit(1); }
console.log('OK: no exceptions, all canvases non-empty.');
