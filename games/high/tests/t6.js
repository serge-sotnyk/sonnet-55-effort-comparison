const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ observer: true, civ: 'franks', difficulty: 'moderate', size: 80, seed: 777 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  const out = await page.evaluate(async () => {
    const d = window.__dbg, G = d.G; G.paused = true;
    d.advance(720);
    const p = G.players[0], ai = p.ai; const S = ai.scan();
    const res = [];
    res.push(`age ${p.age} res ${JSON.stringify(p.res)} vills ${S.vills.length} t=${ai.t.toFixed(0)}`);
    res.push('avail ' + JSON.stringify(techAvailable(p, 'feudal')));
    res.push('ageReq ' + ageReqMet(p, 1) + ' blds ' + Object.keys(S.blds).join(','));
    const tc = S.tcs[0];
    res.push('tcqueue ' + JSON.stringify(tc.queue.map(q => q.kind + ':' + q.id + ':' + q.left.toFixed(0))));
    res.push('pending ' + ai.agePending + ' researching ' + [...p.researching]);
    return res;
  });
  console.log(out.join('\n'));
  await browser.close();
})();
