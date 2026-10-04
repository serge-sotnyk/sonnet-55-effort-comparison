const { launch } = require('./harness');
const fs = require('fs');
(async () => {
  const { browser, page, logs } = await launch();
  const data = await page.evaluate(() => {
    const ids = Object.keys(UNITS);
    const cols = 5; // idle, walk, attack, gather/tool, back-walk
    const S = 3, cw = 120, ch = 130;
    const outs = [];
    const per = 13;
    for (let chunk = 0; chunk * per < ids.length; chunk++) {
    const sub = ids.slice(chunk * per, chunk * per + per);
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = sub.length * ch; const c = cv.getContext('2d');
    c.fillStyle = '#6f9a45'; c.fillRect(0, 0, cv.width, cv.height);
    sub.forEach((id, r) => {
      const def = UNITS[id];
      for (let k = 0; k < cols; k++) {
        c.save(); c.translate(k * cw + cw / 2, r * ch + ch - 18); c.scale(S * (k === 4 ? -1 : 1), S);
        const act = ['idle', 'idle', 'attack', def.tags.includes('villager') ? 'gather' : 'attack', 'idle'][k];
        const o = { tc: '#3b82ff', phase: k === 1 || k === 4 ? 1.0 : 0.3, moving: k === 1 || k === 4, act, actP: k === 2 ? 0.45 : 0.3, time: 1, seed: 3, back: k === 4, carry: k === 3 ? { type: 'wood', amount: 8 } : null, tool: 'axe' };
        drawFigure(c, def.look, o);
        c.restore();
      }
      c.fillStyle = '#000'; c.font = '12px sans-serif'; c.fillText(id, 4, r * ch + 12);
    });
    outs.push(cv.toDataURL('image/png'));
    }
    return outs;
  });
  data.forEach((d, i) => fs.writeFileSync('/tmp/ugal' + i + '.png', Buffer.from(d.split(',')[1], 'base64')));
  console.log(logs.join('\n'));
  await browser.close();
})();
