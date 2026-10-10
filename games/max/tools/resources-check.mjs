// Runs tools/preview/resources-check.html headless and prints the one-line JSON summary; exits 1 if any check failed.
// Usage: node tools/resources-check.mjs [--port=8142] [--scale=1|2] [--quick]
import { chromium } from 'playwright-core';

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const port = opt.port || 8142;
const scale = opt.scale || 2;
const url = `http://localhost:${port}/tools/preview/resources-check.html?scale=${scale}${opt.quick ? '&quick=1' : ''}`;

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-precise-memory-info'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: Number(scale) });
const problems = [];
page.on('pageerror', (e) => problems.push('[pageerror] ' + (e.stack || e.message)));
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('RESOURCES_CHECK')) console.log(t);
  else if (['error', 'warning'].includes(m.type()) && !/favicon|404/.test(t)) problems.push(`[console.${m.type()}] ${t}`);
});
await page.goto(url, { waitUntil: 'load' });
try { await page.waitForFunction('window.__done === true', null, { timeout: 120000 }); } catch (e) { problems.push('timeout waiting for the checker'); }
const res = await page.evaluate('window.__check || null');
await browser.close();
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));
if (!res) { console.log('no result'); process.exit(1); }
if (!res.ok) { console.log('FAILED: ' + res.errors + ' problems'); process.exit(1); }
console.log('OK');
