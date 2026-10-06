import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'artifacts/initial.png', fullPage: true });
const state = await page.evaluate(() => ({
  title: document.title,
  text: document.body.innerText,
  gameKeys: window.game ? Object.keys(window.game) : [],
  gameMethods: window.game ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.game)) : [],
  rendererKeys: window.renderer ? Object.keys(window.renderer) : [],
  rendererMethods: window.renderer ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.renderer)) : [],
  buttons: [...document.querySelectorAll('button')].map(b => ({ text: b.textContent.trim(), title: b.title, data: { ...b.dataset } })),
  canvases: [...document.querySelectorAll('canvas')].map(c => ({ id: c.id, width: c.width, height: c.height, rect: c.getBoundingClientRect().toJSON() })),
}));
await writeFile('artifacts/inspection.json', JSON.stringify({ state, errors }, null, 2));
console.log(JSON.stringify({ state, errors }, null, 2));
await browser.close();
