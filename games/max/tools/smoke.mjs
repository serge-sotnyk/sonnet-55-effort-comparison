import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-gpu-rasterization','--ignore-gpu-blocklist','--use-angle=metal']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(`<canvas id=c width=400 height=200></canvas><script>
const c=document.getElementById('c');const x=c.getContext('2d');
x.fillStyle='#4a8';x.fillRect(0,0,400,200);x.fillStyle='#fff';x.font='30px Georgia';x.fillText('canvas ok '+devicePixelRatio,20,100);
</script>`);
await page.screenshot({ path: '/tmp/smoke.png' });
const info = await page.evaluate(() => ({ dpr: devicePixelRatio, ua: navigator.userAgent }));
console.log(info);
await browser.close();
