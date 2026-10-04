const { launch } = require('./harness');
(async () => {
  const { browser, page, logs } = await launch();
  await page.evaluate(() => window.__dbg.start({ civ: 'franks', difficulty: 'moderate', size: 80, seed: 3 }));
  await page.waitForFunction(() => window.__dbg.G.units.length > 0 && document.getElementById('loading').classList.contains('hidden'), { timeout: 60000 });
  await page.mouse.click(300, 300); // user gesture -> audio
  const r = await page.evaluate(async () => {
    const G = window.__dbg.G, UI = window.__dbg.UI; G.paused = true; const out = [];
    const errs = [];
    const kinds = {};
    for (const r of G.resources) kinds[r.type] = kinds[r.type] || r;
    for (const k in kinds) { try { UI.setSel([kinds[k]]); UI.refreshHUD(); out.push(k + ' ok: ' + document.getElementById('info').textContent.slice(0, 40)); } catch (e) { errs.push(k + ' ' + e.message); } }
    const eb = G.buildings.find(b => b.owner === 1); const eu = G.units.find(u => u.owner === 1);
    try { UI.setSel([eb]); UI.refreshHUD(); UI.setSel([eu]); UI.refreshHUD(); out.push('enemy sel ok'); } catch (e) { errs.push('enemy ' + e.message); }
    // sounds
    SFX.init(); await new Promise(r => setTimeout(r, 200));
    out.push('audio state ' + (SFX.ctx && SFX.ctx.state));
    for (const n of ['click','select','order','error','coin','unit','tech','built','age','alarm','win','lose','chop','mine','hammer','sword','hit','bow','death','crash','collapse','ram','boom','catapult','convert']) { try { SFX.last = {}; SFX.play(n); SFX.at(40, 40, n); } catch (e) { errs.push('sfx ' + n + ' ' + e.message); } }
    // dead deer carcass select
    const deer = G.resources.find(r => r.type === 'deer'); deer.alive = false; deer.state = 'dead'; UI.setSel([deer]); UI.refreshHUD(); out.push('carcass ok');
    // keyboard hotkeys with no selection
    UI.setSel([]); UI.refreshHUD();
    return { out, errs };
  });
  console.log(r.out.join('\n')); console.log('ERRS:', r.errs.join('\n') || 'none');
  console.log(logs.slice(0, 10).join('\n'));
  await browser.close();
})();
