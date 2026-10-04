const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
async function launch(opts = {}) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--window-size=1600,950', '--enable-unsafe-swiftshader'], defaultViewport: { width: opts.w || 1600, height: opts.h || 950, deviceScaleFactor: opts.dsf || 1 } });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning' || opts.verbose) logs.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  return { browser, page, logs };
}
module.exports = { launch };
