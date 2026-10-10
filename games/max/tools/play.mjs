// Drive the real game in headless Chrome. Usage: node tools/play.mjs <scenario> [--dpr=1] [--w=1600] [--h=900]
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const scenario = args[0] || 'start';
const opt = Object.fromEntries(args.slice(1).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const URL = opt.url || 'http://localhost:8080/index.html';

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: Number(opt.w || 1600), height: Number(opt.h || 900) }, deviceScaleFactor: Number(opt.dpr || 1) });
const problems = [];
page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') problems.push(`[${t}] ${m.text()}`); else if (opt.logs) console.log('[log]', m.text()); });
page.on('pageerror', e => problems.push('[pageerror] ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | ')));
await page.goto(URL, { waitUntil: 'load' });
const shot = async (name) => { await page.screenshot({ path: `/tmp/${name}.png` }); console.log('shot', `/tmp/${name}.png`); };
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const startGame = async (cfg = {}) => {
  await page.click('#mm-play'); await sleep(300);
  await ev((c) => { /* set config through UI state if provided */ }, cfg);
  await page.click('#setup-start');
  await page.waitForFunction(() => window.AOC && window.AOC.inGame, null, { timeout: 90000 });
  await sleep(500);
};

const scenarios = {
  async menu() { await sleep(1500); await shot('menu'); await page.click('#mm-play'); await sleep(500); await shot('setup'); },

  async ui1() {
    await startGame(); await sleep(800);
    const info = await ev(async () => {
      const S = window.AOC, g = S.game, cam = S.cam;
      const Cmd = await import('/js/sim/commands.js');
      const me = 1; const tc = g.buildings.find(b => b.owner === me && b.type === 'town_center');
      const vills = g.units.filter(u => u.owner === me && u.type === 'villager');
      const tree = g.findNearestResource(tc.x, tc.y, 'wood', 30);
      const sp = (x, y) => cam.worldToScreen(x, y);
      // find a valid house spot near the TC
      let hs = null;
      for (let r = 4; r < 10 && !hs; r++) for (let a = 0; a < 16 && !hs; a++) { const tx = Math.round(tc.x + Math.cos(a / 16 * 6.283) * r - 1), ty = Math.round(tc.y + Math.sin(a / 16 * 6.283) * r - 1); if (Cmd.canPlace(g, me, 'house', tx, ty).ok) hs = [tx + 1, ty + 1]; }
      return { tc: sp(tc.x, tc.y), v0: sp(vills[0].x, vills[0].y), tree: sp(tree.x, tree.y), house: sp(hs[0], hs[1]) };
    });
    console.log(JSON.stringify(info));
    // box-select villagers only (small box around first villager cluster)
    await ev(() => { const S = window.AOC; S.input.setSelection(S.game.units.filter(u => u.owner === 1 && u.type === 'villager').map(u => u.id), true); });
    await shot('ui1_a');
    await page.mouse.click(info.tree[0], info.tree[1] - 25, { button: 'right' });
    await sleep(500);
    console.log('orders', await ev(() => window.AOC.game.units.filter(u => u.owner === 1 && u.type === 'villager').map(u => u.order && u.order.type + ':' + (u.order.res || ''))));
    await ev(() => { const S = window.AOC; const v = S.game.units.find(u => u.owner === 1 && u.type === 'villager'); S.input.setSelection([v.id], true); });
    await page.keyboard.press('q'); await sleep(150); await page.keyboard.press('q'); await sleep(200);
    console.log('mode', await ev(() => window.AOC.input.mode.type));
    await page.mouse.move(info.house[0], info.house[1]); await sleep(200); await shot('ui1_ghost');
    await page.mouse.click(info.house[0], info.house[1]); await sleep(300);
    console.log('buildings', await ev(() => window.AOC.game.buildings.filter(b => b.owner === 1).map(b => b.type + (b.built ? '' : '*'))), 'wood', await ev(() => window.AOC.game.players[1].res.wood));
    await page.mouse.click(info.tc[0], info.tc[1] + 6); await sleep(300);
    console.log('sel after tc click', await ev(() => window.AOC.input.entities().map(e => e.type)));
    await page.keyboard.press('q'); await sleep(200); await page.keyboard.press('q'); await sleep(200);
    console.log('queue', await ev(() => window.AOC.game.buildings.find(b => b.owner === 1 && b.type === 'town_center').queue.length), 'food', await ev(() => window.AOC.game.players[1].res.food));
    await shot('ui1_b');
    await ev(() => { window.AOC.speedIdx = 5; window.AOC.speed = 4.5; });
    await sleep(16000);
    await shot('ui1_c');
    console.log('state', await ev(() => { const g = window.AOC.game, p = g.players[1]; const tc = window.AOC.terrain.chunks.find(c => c); return { t: Math.round(g.time), res: Object.values(p.res).map(Math.floor), pop: p.pop + '/' + p.popCap, chunkAlpha: tc.getContext('2d').getImageData(100,100,1,1).data[3], vills: g.units.filter(u => u.owner === 1 && u.type === 'villager').map(u => u.order ? u.order.type + ':' + (u.order.phase || '') : 'idle') }; }));
  },
  async canvasloss() {
    await startGame(); await sleep(500);
    await ev(() => { window.__lost = []; const orig = HTMLCanvasElement.prototype.getContext; });
    const probe = () => ev(() => {
      const S = window.AOC; const out = { canvases: document.querySelectorAll('canvas').length, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };
      // terrain chunk alpha/color sample
      const tc = S.terrain.chunks.find(c => c); const c2 = tc.getContext('2d'); const d = c2.getImageData(100, 100, 1, 1).data; out.chunkPixel = Array.from(d);
      return out;
    });
    for (let i = 0; i < 8; i++) { console.log(i, JSON.stringify(await probe())); await sleep(2500); }
    await shot('canvasloss');
  },

  async perf() {
    await startGame(); await sleep(500);
    const r = await ev(async () => {
      const S = window.AOC, g = S.game;
      g.vision.reveal = true; g.vision.update(true);
      const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
      const types = ['militia','man_at_arms','spearman','archer','crossbowman','knight','cavalier','camel','skirmisher','monk','ram','mangonel','scout','champion','longbowman','huskarl'];
      let n = 0;
      for (let i = 0; i < 240; i++) {
        const t = types[i % types.length]; const owner = i % 2 ? 1 : 2;
        const a = (i / 240) * Math.PI * 2, r = 5 + (i % 9) * 1.2;
        const u = g.spawnUnit(t, owner, tc.x + Math.cos(a) * r, tc.y + 12 + Math.sin(a) * r * 0.7);
        u.stance = 'passive'; n++;
      }
      S.cam.lookAt(tc.x, tc.y + 10);
      return n;
    });
    console.log('spawned', r);
    await ev(() => { window.AOC.prof = null; });
    for (let k = 0; k < 6; k++) {
      await sleep(3000);
      const m = await ev(async () => {
        const S = window.AOC;
        const t0 = performance.now(); let frames = 0; let maxdt = 0; let last = t0;
        await new Promise(res => { const f = (now) => { frames++; maxdt = Math.max(maxdt, now - last); last = now; if (now - t0 > 2000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
        const tc = S.terrain.chunks.find(c => c); const d = tc.getContext('2d').getImageData(100, 100, 1, 1).data;
        const P = S.prof; const prof = P ? Object.fromEntries(Object.entries(P).filter(([k]) => k !== 'n').map(([k, v]) => [k, +(v / P.n).toFixed(2)])) : null; S.prof = null;
        return { prof, fps: Math.round(frames / ((performance.now() - t0) / 1000)), maxFrameMs: Math.round(maxdt), renderMs: +S.renderer.stats.ms.toFixed(1), entities: S.renderer.stats.entities, chunkAlpha: d[3], mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1 };
      });
      console.log(k, JSON.stringify(m));
    }
    await shot('perf');
  },

  async flow() {
    await startGame(); await sleep(800);
    await page.keyboard.press('Escape'); await sleep(400); await shot('flow_pause');
    console.log('menuOpen', await ev(() => window.AOC.menuOpen), 'paused', await ev(() => window.AOC.paused));
    await page.click('#pm-options'); await sleep(300); await shot('flow_options');
    await page.click('#options-back'); await sleep(300);
    console.log('screen after options back', await ev(() => window.AOC.menus.current));
    await page.click('#pm-how'); await sleep(300); await shot('flow_how'); await page.click('#how-back'); await sleep(300);
    await page.click('#pm-resume'); await sleep(300);
    console.log('resumed paused=', await ev(() => window.AOC.paused));
    // victory
    await ev(() => window.AOC.game.resign(2));
    await sleep(3500); await shot('flow_victory');
    console.log('over', await ev(() => JSON.stringify(window.AOC.game.result)));
    await page.click('#end-keep'); await sleep(500);
    console.log('keep playing: paused=', await ev(() => window.AOC.paused), 'visible end=', await ev(() => !document.getElementById('screen-end').classList.contains('hidden')));
    await shot('flow_keep');
    // defeat
    await page.keyboard.press('Escape'); await sleep(300);
    await page.click('#pm-quit'); await sleep(500);
    await startGame(); await sleep(500);
    await ev(() => window.AOC.game.resign(1));
    await sleep(3500); await shot('flow_defeat');
    await page.click('#end-menu'); await sleep(500); await shot('flow_menu_again');
  },

  async combat() {
    await startGame(); await sleep(500);
    await ev(async () => {
      const S = window.AOC, g = S.game, Cmd = await import('/js/sim/commands.js');
      g.vision.reveal = true; g.vision.update(true);
      const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
      const cx = tc.x + 14, cy = tc.y + 6;
      const mk = (type, owner, x, y, n) => { const out = []; for (let i = 0; i < n; i++) out.push(g.spawnUnit(type, owner, x + (i % 6) * 0.8, y + Math.floor(i / 6) * 0.8)); return out; };
      // P1 force
      const a1 = [...mk('archer', 1, cx - 9, cy - 3, 12), ...mk('militia', 1, cx - 6, cy - 3, 12), ...mk('knight', 1, cx - 7, cy + 2, 5), ...mk('monk', 1, cx - 11, cy, 2), ...mk('mangonel', 1, cx - 13, cy + 3, 2)];
      // P2 force + buildings
      const b1 = g.spawnBuilding('house', 2, Math.round(cx + 6), Math.round(cy - 4), { built: true });
      const b2 = g.spawnBuilding('barracks', 2, Math.round(cx + 9), Math.round(cy + 1), { built: true });
      const b3 = g.spawnBuilding('watch_tower', 2, Math.round(cx + 5), Math.round(cy + 4), { built: true });
      const a2 = [...mk('spearman', 2, cx + 1, cy - 3, 12), ...mk('crossbowman', 2, cx + 4, cy - 1, 8), ...mk('skirmisher', 2, cx + 3, cy + 3, 6)];
      b2.hp = b2.maxHp * 0.35;
      Cmd.orderMove(g, a1, cx + 4, cy, { attackMove: true, noCap: true });
      Cmd.orderMove(g, a2, cx - 4, cy, { attackMove: true, noCap: true });
      S.cam.lookAt(cx, cy); S.input.setSelection(a1.map(u => u.id), true);
    });
    console.log('audio ready', await ev(() => window.AOC.audio.ready), JSON.stringify(await ev(() => { const d = window.AOC.audio.debug; return { played: d.played, voices: d.voices, dropped: d.dropped, state: d.ctx && d.ctx.state }; })));
    for (let i = 0; i < 5; i++) { await sleep(3500); await shot('combat' + i); console.log(i, await ev(() => { const g = window.AOC.game, d = window.AOC.audio.debug; return { p1: g.units.filter(u => u.owner === 1 && !u.dead).length, p2: g.units.filter(u => u.owner === 2 && !u.dead).length, proj: g.projectiles.length, audio: { played: d.played, voices: d.voices, dropped: d.dropped, live: d.liveNodes, state: d.ctx && d.ctx.state } }; })); }
  },

  async corpses() {
    await startGame(); await sleep(500);
    await ev(async () => {
      const S = window.AOC, g = S.game;
      g.vision.reveal = true; g.vision.update(true);
      const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
      const cx = tc.x + 10, cy = tc.y + 8;
      const types = ['militia','archer','knight','villager','camel','spearman','monk','ram','crossbowman','scout'];
      const us = [];
      types.forEach((t, i) => { const u = g.spawnUnit(t, i % 2 ? 2 : 1, cx + (i % 5) * 1.4, cy + Math.floor(i / 5) * 1.6); us.push(u); u.stance = 'passive'; });
      S.cam.setZoom(1.7); S.cam.lookAt(cx + 3, cy + 1);
      window.__us = us.map(u => u.id);
    });
    await sleep(800); await shot('corpse_alive');
    await ev(() => { const g = window.AOC.game; for (const id of window.__us) { const u = g.byId.get(id); if (u) { u.hp = 0; g.killUnit(u, null); } } });
    for (const t of [250, 450, 800, 2500]) { await sleep(t); await shot('corpse_' + t); }
  },

  async hitches() {
    await page.evaluate(() => { window.__long = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push([Math.round(performance.now()), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {} });
    const t0 = Date.now();
    await startGame();
    console.log('time to start (ms):', Date.now() - t0, ' long tasks during load:', JSON.stringify(await ev(() => window.__long.length)));
    await ev(() => { window.__long.length = 0; });
    await sleep(6000);
    console.log('first 6s of play: long tasks', JSON.stringify(await ev(() => window.__long)));
    // introduce many unit types/colors over time to see on-demand sprite generation cost
    await ev(async () => {
      const S = window.AOC, g = S.game; g.vision.reveal = true; g.vision.update(true);
      const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); window.__long.length = 0;
      const types = Object.keys(S.game.players[1].defs).filter(t => !['wolf', 'boar'].includes(t));
      let i = 0; window.__spawnIv = setInterval(() => { const t = types[i % types.length]; i++; g.spawnUnit(t, (i % 2) + 1, tc.x + 6 + (i % 7), tc.y + 6 + Math.floor(i / 7) % 6); }, 250);
      S.cam.lookAt(tc.x + 8, tc.y + 8);
    });
    await sleep(25000);
    console.log('during unit-type introduction: long tasks', JSON.stringify(await ev(() => window.__long)));
    await shot('hitches');
  },

  async soak() {
    await startGame(); await sleep(500);
    await ev(async () => {
      const S = window.AOC, g = S.game;
      const { AIPlayer } = await import('/js/sim/ai.js');
      const me = g.players[1]; me.isAI = true; me.difficulty = 'hard';
      g.ais.push(new AIPlayer(g, me));
      S.speedIdx = 5; S.speed = 4.5;
    });
    const minutes = Number(opt.minutes || 5);
    const t0 = Date.now(); let k = 0;
    while (Date.now() - t0 < minutes * 60000) {
      await sleep(40000);
      const m = await ev(async () => {
        const S = window.AOC, g = S.game; const p1 = g.players[1], p2 = g.players[2];
        const t = performance.now(); let frames = 0; await new Promise(res => { const f = (now) => { frames++; if (now - t > 1500) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
        const tc1 = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
        if (tc1) S.cam.lookAt(tc1.x + 6, tc1.y + 6);
        return { gt: Math.round(g.time / 60), fps: Math.round(frames / 1.5), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1, units: g.units.length, bld: g.buildings.length, p1: `${p1.age} ${p1.pop}/${p1.popCap}`, p2: `${p2.age} ${p2.pop}/${p2.popCap}`, over: g.over };
      });
      console.log(k++, JSON.stringify(m));
      await shot('soak' + k);
      if (m.over) break;
    }
  },

  async buildall() {
    await startGame(); await sleep(500);
    // cheat: Imperial age, tons of resources, full map explored
    await ev(() => { const S = window.AOC, g = S.game, p = g.players[1]; p.age = 3; p.recompute(); for (const r of ['food','wood','gold','stone']) p.res[r] = 20000; g.vision.reveal = true; g.vision.update(true); p.popCap = 200; });
    await ev(() => { const S = window.AOC, g = S.game; const v = g.units.find(u => u.owner === 1 && u.type === 'villager'); S.input.setSelection([v.id], true); });
    const results = [];
    const tryBuild = async (page2, key, id) => {
      await ev(() => { const S = window.AOC; const vs = S.game.units.filter(u => u.owner === 1 && u.type === 'villager'); S.input.setSelection(vs.map(v => v.id), true); S.hud.setPage('main'); });
      await page.keyboard.press(page2 === 'eco' ? 'q' : 'w'); await sleep(80);
      await page.keyboard.press(key); await sleep(80);
      const mode = await ev(() => window.AOC.input.mode);
      if (mode.type !== 'place') { results.push([id, 'NO PLACE MODE ' + JSON.stringify(mode)]); return; }
      // find a valid spot near the TC that is visible on the canvas (not under the HUD panels)
      const spot = await ev(async (bid) => {
        const S = window.AOC, g = S.game, Cmd = await import('/js/sim/commands.js');
        const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
        const def = g.players[1].bdefs[bid];
        S.cam.lookAt(tc.x, tc.y);
        const vh = S.cam.vh - S.cam.bottomInset - 40, vw = S.cam.vw;
        for (let r = 5; r < 26; r++) for (let a = 0; a < 48; a++) {
          const tx = Math.round(tc.x + Math.cos(a / 48 * 6.283) * r - def.size / 2), ty = Math.round(tc.y + Math.sin(a / 48 * 6.283) * r - def.size / 2);
          if (!Cmd.canPlace(g, 1, bid, tx, ty).ok) continue;
          const p2 = S.cam.worldToScreen(tx + def.size / 2, ty + def.size / 2);
          if (p2[0] < 60 || p2[0] > vw - 60 || p2[1] < 110 || p2[1] > vh) continue;
          return { x: p2[0], y: p2[1] };
        }
        return null;
      }, id);
      if (!spot) { results.push([id, 'no valid spot']); await page.keyboard.press('Escape'); return; }
      await page.mouse.move(spot.x, spot.y); await sleep(60);
      const ok = await ev(() => window.AOC.input.ghost && window.AOC.input.ghost.ok);
      const before = await ev((bid) => window.AOC.game.buildings.filter(b => b.owner === 1 && b.type === bid).length, id);
      await page.mouse.click(spot.x, spot.y); await sleep(100);
      const after = await ev((bid) => window.AOC.game.buildings.filter(b => b.owner === 1 && b.type === bid).length, id);
      const err = after === before + 1 ? '' : await ev(() => window.AOC.game.lastError);
      results.push([id, ok ? 'ghost ok' : 'ghost BAD', after === before + 1 ? 'PLACED' : 'FAILED ' + err]);
      await ev(() => window.AOC.input.cancelMode());
    };
    const eco = ['house','mill','lumber_camp','mining_camp','farm','market','blacksmith','university','monastery','town_center','wonder'];
    const mil = ['barracks','archery_range','stable','siege_workshop','castle','outpost','watch_tower','palisade','stone_wall','gate'];
    const keys = ['q','w','e','r','t','a','s','d','f','g'];
    // farm needs a mill: it is placed after mill in order
    for (let i = 0; i < eco.length; i++) { if (i > 9) break; await tryBuild('eco', keys[i], eco[i]); }
    // wonder is the 11th: slot index 10 -> 'z'
    await tryBuild('eco', 'z', 'wonder');
    for (let i = 0; i < mil.length; i++) await tryBuild('mil', keys[i], mil[i]);
    for (const r of results) console.log(r.join('  '));
    await ev(() => { const g = window.AOC.game; const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); window.AOC.cam.lookAt(tc.x, tc.y + 8); });
    await sleep(500); await shot('buildall');
  },

  async mapshots() {
    for (const map of ['highlands', 'blackforest', 'lakeland', 'meadows']) {
      await page.evaluate((m) => { localStorage.setItem('aoc.config', JSON.stringify({ civ: 'franks', opponents: 1, difficulty: 'standard', map: m, size: 'medium', res: 'standard', reveal: true, wonder: false })); }, map);
      await page.reload({ waitUntil: 'load' }); await sleep(500);
      await startGame(); await sleep(500);
      await ev(() => { const S = window.AOC; S.cam.setZoom(0.55); const g = S.game; S.cam.lookAt(g.w / 2, g.h / 2); S.hud.toast('map overview'); });
      await sleep(2500);
      await shot('map_' + map);
      await page.keyboard.press('Escape'); await sleep(300); await page.click('#pm-quit'); await sleep(300);
    }
  },

  async features() {
    await startGame(); await sleep(500);
    const results = []; const check = (name, ok, extra = '') => { results.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };
    const S = (fn, arg) => page.evaluate(fn, arg);
    await S(() => { const A = window.AOC, g = A.game, p = g.players[1]; for (const r of ['food','wood','gold','stone']) p.res[r] = 5000; g.vision.reveal = true; g.vision.update(true); p.popCap = 150; });
    const screenOf = (id) => S((id) => { const A = window.AOC, e = A.game.byId.get(id); const h = e._hit; return h ? { x: (h[0] + h[2]) / 2, y: e.kind === 'building' ? h[5] : (h[1] + h[3]) / 2 + 6 } : null; }, null);
    const clickEnt = async (id) => { const pos = await S((id) => { const A = window.AOC, e = A.game.byId.get(id); const p = A.cam.worldToScreen(e.x, e.y); return { x: p[0], y: p[1] + (e.kind === 'unit' ? -12 : 4) }; }, id); await page.mouse.click(pos.x, pos.y); await sleep(150); };
    const tcId = await S(() => window.AOC.game.buildings.find(b => b.owner === 1 && b.type === 'town_center').id);
    await S((id) => { const A = window.AOC, tc = A.game.byId.get(id); A.cam.lookAt(tc.x, tc.y); }, tcId); await sleep(300);

    // --- production queue (shift = x5) and cancel
    await clickEnt(tcId);
    check('click selects the Town Center', (await S(() => window.AOC.input.entities().map(e => e.type).join())) === 'town_center');
    await page.keyboard.down('Shift'); await page.keyboard.press('q'); await page.keyboard.up('Shift'); await sleep(150);
    const q1 = await S((id) => ({ q: window.AOC.game.byId.get(id).queue.length, food: Math.floor(window.AOC.game.players[1].res.food) }), tcId);
    check('Shift+Q queues 5 villagers and pays', q1.q === 5 && q1.food === 4750, JSON.stringify(q1));
    await S(() => { window.AOC.hud.dirty = true; }); await sleep(200);
    await page.click('.queue .q:last-child'); await sleep(200);
    const q2 = await S((id) => ({ q: window.AOC.game.byId.get(id).queue.length, food: Math.floor(window.AOC.game.players[1].res.food) }), tcId);
    check('clicking a queue item cancels and refunds', q2.q === 4 && q2.food === 4800, JSON.stringify(q2));

    // --- age up requirements via UI
    await page.keyboard.press('t'); await sleep(200);
    check('Feudal Age blocked without buildings', (await S(() => window.AOC.game.players[1].researching.size)) === 0, await S(() => window.AOC.game.lastError));
    await S(async () => { const A = window.AOC, g = A.game, Cmd = await import('/js/sim/commands.js'); const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); let n = 0; for (const [type, dx] of [['mill', 7], ['lumber_camp', -7], ['house', 6]]) { for (let r = 0; r < 4; r++) { const tx = Math.round(tc.x + dx + (r % 2) * 2 - 1), ty = Math.round(tc.y + 7 + Math.floor(r / 2) * 3); if (Cmd.canPlace(g, 1, type, tx, ty).ok) { const b = g.spawnBuilding(type, 1, tx, ty, { built: true }); n++; break; } } } return n; });
    await sleep(300);
    await clickEnt(tcId); await sleep(200);
    await S((id) => { const A = window.AOC, b = A.game.byId.get(id); b.queue.length = 0; A.game.players[1].popReserved = 0; }, tcId);
    await page.keyboard.press('t'); await sleep(200);
    check('Feudal Age research starts with 2 different buildings', (await S(() => window.AOC.game.players[1].researching.has('feudal_age'))), await S(() => window.AOC.game.lastError));
    await S(() => { const g = window.AOC.game; for (let i = 0; i < 20 * 140; i++) g.update(); });
    check('Feudal Age reached', (await S(() => window.AOC.game.players[1].age)) === 1);

    // --- barracks via villager menu, rally, train, attack-move, stances, groups, garrison
    await S(async () => { const A = window.AOC, g = A.game, Cmd = await import('/js/sim/commands.js'); const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); for (let r = 8; r < 16; r++) for (let a = 0; a < 24; a++) { const tx = Math.round(tc.x + Math.cos(a / 24 * 6.283) * r - 1.5), ty = Math.round(tc.y + Math.sin(a / 24 * 6.283) * r - 1.5); if (Cmd.canPlace(g, 1, 'barracks', tx, ty).ok) { const b = g.spawnBuilding('barracks', 1, tx, ty, { built: true }); window.__bar = b.id; return; } } });
    await sleep(300);
    await clickEnt(await S(() => window.__bar));
    check('Barracks selected', (await S(() => window.AOC.input.entities().map(e => e.type).join())) === 'barracks');
    await page.keyboard.down('Shift'); await page.keyboard.press('q'); await page.keyboard.up('Shift'); await sleep(150);
    await page.keyboard.press('v'); await sleep(150);
    check('Rally mode entered with V', (await S(() => window.AOC.input.mode.type + ':' + window.AOC.input.mode.action)) === 'target:rally');
    const rpos = await S(() => { const A = window.AOC, tc = A.game.buildings.find(b => b.owner === 1 && b.type === 'town_center'); const p = A.cam.worldToScreen(tc.x - 9, tc.y + 6); return { x: p[0], y: p[1] }; });
    await page.mouse.click(rpos.x, rpos.y); await sleep(200);
    check('Rally point set', await S(() => !!window.AOC.game.byId.get(window.__bar).rally));
    await S(() => { const g = window.AOC.game; for (let i = 0; i < 20 * 120; i++) g.update(); });
    const mil = await S(() => window.AOC.game.units.filter(u => u.owner === 1 && u.type === 'militia').map(u => u.id));
    check('5 militia trained', mil.length === 5, 'count ' + mil.length);
    check('trained units walked to the rally point', await S((ids) => { const g = window.AOC.game, r = g.byId.get(window.__bar).rally; return ids.every(id => Math.hypot(g.byId.get(id).x - r.x, g.byId.get(id).y - r.y) < 4); }, mil));
    await S((ids) => window.AOC.input.setSelection(ids, true), mil); await sleep(200);
    await page.keyboard.press('s'); await sleep(100);
    check('S sets Defensive stance', await S((ids) => ids.every(id => window.AOC.game.byId.get(id).stance === 'defensive'), mil));
    await page.keyboard.press('a'); await sleep(100);
    await page.keyboard.down('Control'); await page.keyboard.press('1'); await page.keyboard.up('Control'); await sleep(100);
    await S(() => window.AOC.input.setSelection([], true)); await sleep(100);
    await page.keyboard.press('1'); await sleep(200);
    check('Ctrl+1 / 1 recalls the control group', (await S(() => window.AOC.input.sel.length)) === 5);
    await page.keyboard.press('q'); await sleep(100);
    check('Q on military = attack-move target mode', (await S(() => window.AOC.input.mode.action)) === 'attackmove');
    const apos = await S(() => { const A = window.AOC, tc = A.game.buildings.find(b => b.owner === 1 && b.type === 'town_center'); const p = A.cam.worldToScreen(tc.x + 8, tc.y - 4); return { x: p[0], y: p[1] }; });
    await page.mouse.click(apos.x, apos.y); await sleep(200);
    check('attack-move order issued', await S((ids) => ids.every(id => { const o = window.AOC.game.byId.get(id).order; return o && o.type === 'attackmove'; }), mil));
    // garrison by right-clicking the TC
    const tcpos = await S((id) => { const A = window.AOC, e = A.game.byId.get(id); const p = A.cam.worldToScreen(e.x, e.y); return { x: p[0], y: p[1] + 4 }; }, tcId);
    await page.mouse.click(tcpos.x, tcpos.y, { button: 'right' }); await sleep(200);
    await S(() => { const g = window.AOC.game; for (let i = 0; i < 20 * 40; i++) g.update(); });
    check('right-click on TC garrisons the selected soldiers', (await S((id) => window.AOC.game.byId.get(id).garrison.length, tcId)) === 5);
    await clickEnt(tcId); await sleep(200);
    await page.keyboard.press('c'); await sleep(200);
    check('Unload hotkey empties the garrison', (await S((id) => window.AOC.game.byId.get(id).garrison.length, tcId)) === 0);
    // market
    await S(async () => { const A = window.AOC, g = A.game, Cmd = await import('/js/sim/commands.js'); const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); for (let r = 8; r < 18; r++) for (let a = 0; a < 24; a++) { const tx = Math.round(tc.x + Math.cos(a / 24 * 6.283) * r - 1.5), ty = Math.round(tc.y + Math.sin(a / 24 * 6.283) * r - 1.5); if (Cmd.canPlace(g, 1, 'market', tx, ty).ok) { const b = g.spawnBuilding('market', 1, tx, ty, { built: true }); window.__mk = b.id; return; } } });
    await sleep(300); await clickEnt(await S(() => window.__mk));
    const g0 = await S(() => Math.floor(window.AOC.game.players[1].res.gold));
    await page.keyboard.press('a'); await sleep(200);     // sell food (slot A = sell food)
    const g1 = await S(() => Math.floor(window.AOC.game.players[1].res.gold));
    check('market: A sells 100 food for gold', g1 > g0, `${g0} -> ${g1}`);
    await shot('features');
    console.log(results.join('\n'));
    console.log(results.filter(r => r.startsWith('FAIL')).length ? 'SOME FAILED' : 'ALL PASSED');
  },

  async players4() {
    await page.evaluate(() => { localStorage.setItem('aoc.config', JSON.stringify({ civ: 'mongols', opponents: 3, difficulty: 'hard', map: 'lakeland', size: 'large', res: 'high', reveal: true, wonder: false })); });
    await page.reload({ waitUntil: 'load' }); await sleep(500);
    await startGame(); await sleep(500);
    await ev(() => { const S = window.AOC; S.speedIdx = 5; S.speed = 4.5; S.cam.setZoom(0.55); const g = S.game; S.cam.lookAt(g.w / 2, g.h / 2); });
    for (let i = 0; i < 4; i++) { await sleep(20000); console.log(i, JSON.stringify(await ev(() => { const g = window.AOC.game; return { t: Math.round(g.time / 60), players: g.players.slice(1).map(p => `${p.name}:${p.age}:${p.pop}`).join(' | ') }; }))); }
    await shot('players4');
  },

  async tooltips() {
    await startGame(); await sleep(500);
    await ev(() => { const A = window.AOC, g = A.game, tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); A.input.setSelection([tc.id], true); g.players[1].res.food = 800; A.cam.lookAt(tc.x, tc.y); });
    await sleep(600);
    const cells = await page.$$('.cell');
    await cells[4].hover(); await sleep(500); await shot('tip_age');
    await cells[1].hover(); await sleep(400); await shot('tip_loom');
    // hover label over a villager
    const pos = await ev(() => { const A = window.AOC; const v = A.game.units.find(u => u.owner === 1 && u.type === 'villager'); const p = A.cam.worldToScreen(v.x, v.y); return { x: p[0], y: p[1] - 14 }; });
    await page.mouse.move(pos.x, pos.y); await sleep(900); await shot('hover_label');
  },

  async twogames() {
    await startGame(); await sleep(500);
    await page.keyboard.press('Escape'); await sleep(300); await page.click('#pm-quit'); await sleep(500);
    await startGame(); await sleep(800);
    await ev(() => { const A = window.AOC; A.input.setSelection([A.game.units.find(u => u.owner === 1 && u.type === 'villager').id], true); });
    await page.keyboard.press('q'); await sleep(300);
    console.log('after one Q on 2nd game:', JSON.stringify(await ev(() => ({ page: window.AOC.hud.cardPage, mode: window.AOC.input.mode.type, listeners: window.AOC.input._listeners.length }))));
    await page.keyboard.press('Escape'); await sleep(200);
    console.log('after Esc:', JSON.stringify(await ev(() => ({ page: window.AOC.hud.cardPage, menuOpen: window.AOC.menuOpen }))));
  },

  async fillrate() {
    await startGame(); await sleep(1500);
    const measure = () => ev(async () => { const t = performance.now(); let frames = 0; await new Promise(res => { const f = (now) => { frames++; if (now - t > 2500) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); return Math.round(frames / ((performance.now() - t) / 1000)); });
    console.log('baseline fps (few entities):', await measure());
    await ev(() => { const A = window.AOC; A.renderer.render = function () {}; });
    console.log('with world rendering disabled:', await measure());
    await ev(() => { document.getElementById('bottom').style.display = 'none'; document.getElementById('topbar').style.display = 'none'; });
    console.log('and HUD hidden:', await measure());
  },

  async quality() {
    await startGame(); await sleep(1500);
    const measure = () => ev(async () => { const t = performance.now(); let frames = 0; await new Promise(res => { const f = (now) => { frames++; if (now - t > 2500) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); return Math.round(frames / ((performance.now() - t) / 1000)); });
    console.log('baseline fps:', await measure());
    // force smoothing quality low for the whole render
    await ev(() => { const A = window.AOC, r = A.renderer, orig = r.render.bind(r); r.render = function (a, v, d) { r.ctx.imageSmoothingQuality = 'low'; return orig(a, v, d); }; r.ctx.__q = true; const proto = CanvasRenderingContext2D.prototype; const d = Object.getOwnPropertyDescriptor(proto, 'imageSmoothingQuality'); Object.defineProperty(r.ctx, 'imageSmoothingQuality', { set(v) { d.set.call(this, 'low'); }, get() { return d.get.call(this); }, configurable: true }); });
    console.log('smoothing quality forced low:', await measure());
    await ev(() => { const r = window.AOC.renderer; r.ctx.imageSmoothingEnabled = false; const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'imageSmoothingEnabled'); Object.defineProperty(r.ctx, 'imageSmoothingEnabled', { set(v) { d.set.call(this, false); }, get() { return d.get.call(this); }, configurable: true }); });
    console.log('smoothing disabled entirely:', await measure());
  },

  async walls() {
    await startGame(); await sleep(500);
    const results = []; const check = (name, ok, extra = '') => { results.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };
    await ev(() => { const A = window.AOC, g = A.game, p = g.players[1]; p.age = 1; p.recompute(); for (const r of ['food','wood','gold','stone']) p.res[r] = 2000; g.vision.reveal = true; g.vision.update(true); p.popCap = 100; });
    const base = await ev(() => { const A = window.AOC, g = A.game; const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); A.cam.lookAt(tc.x, tc.y + 6); return { x: tc.x, y: tc.y }; });
    await sleep(300);
    await ev(() => { const A = window.AOC; A.input.setSelection(A.game.units.filter(u => u.owner === 1 && u.type === 'villager').map(u => u.id), true); });
    const scr = (wx, wy) => ev(([wx, wy]) => { const p = window.AOC.cam.worldToScreen(wx, wy); return { x: p[0], y: p[1] }; }, [wx, wy]);
    await page.keyboard.press('w'); await sleep(150); await page.keyboard.press('f'); await sleep(200);
    check('stone wall mode entered', (await ev(() => window.AOC.input.mode.type + ':' + window.AOC.input.mode.btype)) === 'place:stone_wall');
    const a = await scr(base.x - 8, base.y + 12), b = await scr(base.x + 8, base.y + 12);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 }); await page.mouse.move(b.x, b.y, { steps: 6 });
    const ghosts = await ev(() => window.AOC.input.wallGhosts ? window.AOC.input.wallGhosts.filter(g => g.ok).length : 0);
    await shot('walls_drag');
    await page.mouse.up(); await sleep(300);
    const placed = await ev(() => window.AOC.game.buildings.filter(b => b.owner === 1 && b.type === 'stone_wall').length);
    check('dragging builds a line of wall segments', placed >= 12 && placed === ghosts, `${placed} segments (ghosts ${ghosts})`);
    check('wall cost paid (5 stone each)', (await ev(() => Math.floor(window.AOC.game.players[1].res.stone))) === 2000 - placed * 5);
    // finish them and test the gate replacement
    await ev(() => { const g = window.AOC.game; for (const b of g.buildings) if (b.owner === 1 && !b.built) { b.built = true; b.progress = 1; b.hp = b.maxHp; } });
    await ev(() => { const A = window.AOC; A.input.cancelMode(); A.input.setSelection(A.game.units.filter(u => u.owner === 1 && u.type === 'villager').map(u => u.id), true); A.hud.setPage('main'); });
    await page.keyboard.press('w'); await sleep(150); await page.keyboard.press('g'); await sleep(200);
    check('gate mode entered', (await ev(() => window.AOC.input.mode.btype)) === 'gate');
    const seg = await ev(() => { const g = window.AOC.game; const w = g.buildings.filter(b => b.owner === 1 && b.type === 'stone_wall').sort((a, b) => a.tx - b.tx)[6]; const p = window.AOC.cam.worldToScreen(w.x, w.y); return { x: p[0], y: p[1], id: w.id }; });
    await page.mouse.move(seg.x, seg.y); await sleep(150);
    check('gate ghost valid on a wall segment', await ev(() => window.AOC.input.ghost && window.AOC.input.ghost.ok));
    await page.mouse.click(seg.x, seg.y); await sleep(300);
    check('gate replaced the wall segment', await ev((id) => { const g = window.AOC.game; const old = g.byId.get(id); return (!old || old.dead) && g.buildings.some(b => b.owner === 1 && b.type === 'gate'); }, seg.id));
    // repair
    await ev(() => { const A = window.AOC, g = A.game; const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); tc.hp = tc.maxHp * 0.4; window.__tchp = tc.hp; g.players[1].res.wood = 1000; g.players[1].res.stone = 1000; A.input.cancelMode(); A.input.setSelection([g.units.find(u => u.owner === 1 && u.type === 'villager').id], true); });
    const tcp = await scr(base.x, base.y);
    await page.mouse.click(tcp.x, tcp.y + 4, { button: 'right' }); await sleep(200);
    check('right-click on a damaged own building orders repair', await ev(() => { const v = window.AOC.input.entities()[0]; return v && v.order && v.order.type === 'repair'; }));
    await ev(() => { const g = window.AOC.game; for (let i = 0; i < 20 * 60; i++) g.update(); });
    const rep = await ev(() => { const g = window.AOC.game; const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center'); return { hp: Math.round(tc.hp), start: Math.round(window.__tchp), wood: Math.round(g.players[1].res.wood), stone: Math.round(g.players[1].res.stone) }; });
    check('repair restores HP and costs resources', rep.hp > rep.start + 100 && (rep.wood < 1000 || rep.stone < 1000), JSON.stringify(rep));
    await shot('walls_done');
    console.log(results.join('\n')); console.log(results.some(r => r.startsWith('FAIL')) ? 'SOME FAILED' : 'ALL PASSED');
  },

  async minimap() {
    await startGame(); await sleep(500);
    await ev(() => { const A = window.AOC; A.game.vision.reveal = true; A.game.vision.update(true); });
    const box = await page.$eval('#minimap', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    console.log('minimap box', JSON.stringify(box));
    const before = await ev(() => { const c = window.AOC.cam.center(); return [Math.round(c.x), Math.round(c.y)]; });
    // click near the right corner of the diamond (world +x,-y direction => around (w*0.8, h*0.2))
    const g = await ev(() => ({ w: window.AOC.game.w, h: window.AOC.game.h }));
    const mm = await ev((g) => { const m = window.AOC.minimap; const p = m.toMini(g.w * 0.8, g.h * 0.2); return p; }, g);
    const k = box.w / await ev(() => window.AOC.minimap.cw);
    await page.mouse.click(box.x + mm[0] * k, box.y + mm[1] * k); await sleep(300);
    const after = await ev(() => { const c = window.AOC.cam.center(); return [Math.round(c.x), Math.round(c.y)]; });
    console.log('camera center before', before, 'after', after, 'expected near', [Math.round(g.w * 0.8), Math.round(g.h * 0.2)]);
    // drag across the minimap
    await page.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5); await page.mouse.down(); await page.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.5, { steps: 5 }); await page.mouse.up();
    console.log('after drag', await ev(() => { const c = window.AOC.cam.center(); return [Math.round(c.x), Math.round(c.y)]; }));
    await shot('minimap');
  },

  async cardcheck() {
    await startGame(); await sleep(500);
    const out = await ev(async () => {
      const A = window.AOC, g = A.game, p = g.players[1], Cmd = await import('/js/sim/commands.js');
      const { BUILDINGS } = await import('/js/data/buildings.js');
      const { CIV_ORDER } = await import('/js/data/civs.js');
      const { TECHS } = await import('/js/data/techs.js');
      const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
      const errs = [], summary = [];
      p.age = 3; for (const r of ['food','wood','gold','stone']) p.res[r] = 99999; g.vision.reveal = true; g.vision.update(true); p.popCap = 200;
      const spawned = {};
      for (const civ of CIV_ORDER) {
        p.civ = civ; p.techs.clear(); p.techOrder.length = 0; for (const k of Object.keys(p.lineTier)) p.lineTier[k] = 0; p.recompute();
        for (const type of Object.keys(BUILDINGS)) {
          if (BUILDINGS[type].hidden) continue;
          let b = spawned[type];
          if (!b || b.dead) {
            for (let r = 6; r < 30 && !b; r++) for (let a = 0; a < 40 && !b; a++) { const sz = BUILDINGS[type].size; const tx = Math.round(tc.x + Math.cos(a / 40 * 6.283) * r - sz / 2), ty = Math.round(tc.y + Math.sin(a / 40 * 6.283) * r - sz / 2); if (Cmd.canPlace(g, 1, type, tx, ty).ok) b = g.spawnBuilding(type, 1, tx, ty, { built: true }); }
            spawned[type] = b;
          }
          if (!b) { errs.push(`${civ}/${type}: could not place`); continue; }
          try {
            A.input.setSelection([b.id], true); A.hud.setPage('main');
            const specs = A.hud.computeCard();
            const n = specs.filter(Boolean).length;
            const names = specs.filter(Boolean).map(s => s.name).join(',');
            // every spec must have an icon that resolves and a tooltip-able name
            for (const s of specs) if (s) { const c = A.hud.iconCanvas(s.icon); if (!c) errs.push(`${civ}/${type}: no icon for ${s.name}`); if (!s.name) errs.push(`${civ}/${type}: unnamed spec`); }
            if (civ === 'britons') summary.push(`${type}: ${n} [${names.slice(0, 120)}]`);
          } catch (e) { errs.push(`${civ}/${type}: EXCEPTION ${e.message}`); }
        }
      }
      return { errs, summary };
    });
    console.log(out.summary.join('\n'));
    console.log(out.errs.length ? 'ERRORS:\n' + out.errs.join('\n') : 'ALL CARDS OK');
  },

  async endchart() {
    await startGame(); await sleep(500);
    await ev(async () => {
      const S = window.AOC, g = S.game;
      const { AIPlayer } = await import('/js/sim/ai.js');
      const me = g.players[1]; me.isAI = true; me.difficulty = 'hard'; g.ais.push(new AIPlayer(g, me));
      S.speedIdx = 5; S.speed = 4.5;
    });
    await sleep(70000);
    await ev(() => { window.AOC.game.resign(2); });
    await sleep(3500); await shot('endchart');
  },

  async agehitch() {
    await startGame(); await sleep(800);
    await ev(async () => {
      const A = window.AOC, g = A.game, p = g.players[1], Cmd = await import('/js/sim/commands.js'); const { BUILDINGS } = await import('/js/data/buildings.js');
      p.age = 3; p.recompute(); g.vision.reveal = true; g.vision.update(true);
      const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
      let n = 0; for (const type of Object.keys(BUILDINGS)) { if (BUILDINGS[type].hidden || type === 'town_center') continue; const sz = BUILDINGS[type].size; let done = false; for (let r = 5; r < 30 && !done; r++) for (let a = 0; a < 40 && !done; a++) { const tx = Math.round(tc.x + Math.cos(a / 40 * 6.283) * r * 1.0 - sz / 2), ty = Math.round(tc.y + Math.sin(a / 40 * 6.283) * r - sz / 2); if (Cmd.canPlace(g, 1, type, tx, ty).ok) { g.spawnBuilding(type, 1, tx, ty, { built: true }); done = true; n++; } } }
      p.age = 0; p.recompute(); A.cam.setZoom(0.6); A.cam.lookAt(tc.x, tc.y + 4); window.__n = n;
    });
    await sleep(2500);
    const frameMax = () => ev(async () => { let max = 0, last = performance.now(); await new Promise(res => { const t0 = last; const f = (now) => { max = Math.max(max, now - last); last = now; if (now - t0 > 900) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); return Math.round(max); });
    for (const age of [1, 2, 3]) {
      await ev((a) => { const p = window.AOC.game.players[1]; p.age = a; p.recompute(); }, age);
      console.log(`age ${age}: worst frame in the next 0.9 s = ${await frameMax()} ms`);
    }
    await shot('agehitch');
  },

  async workers() {
    await startGame(); await sleep(500);
    await ev(async () => {
      const A = window.AOC, g = A.game, Cmd = await import('/js/sim/commands.js'); g.vision.reveal = true; g.vision.update(true);
      const tc = g.buildings.find(b => b.owner === 1 && b.type === 'town_center');
      const vs = g.units.filter(u => u.owner === 1 && u.type === 'villager');
      // extra villagers for variety
      for (let i = 0; i < 9; i++) vs.push(g.spawnUnit('villager', 1, tc.x + 3 + i * 0.5, tc.y + 3));
      const tree = g.findNearestResource(tc.x, tc.y, 'wood', 30), berry = g.findNearestResource(tc.x, tc.y, 'food', 30, { sub: 'berries' }), gold = g.findNearestResource(tc.x, tc.y, 'gold', 40), stone = g.findNearestResource(tc.x, tc.y, 'stone', 40);
      Cmd.orderGather(g, vs.slice(0, 4), tree); Cmd.orderGather(g, vs.slice(4, 7), berry); Cmd.orderGather(g, vs.slice(7, 9), gold); Cmd.orderGather(g, vs.slice(9, 11), stone);
      // a mill + farm + camp so work continues
      const sp = (type, a) => { const sz = g.players[1].bdefs[type].size; for (let r = 5; r < 14; r++) { const tx = Math.round(tc.x + Math.cos(a) * r - sz / 2), ty = Math.round(tc.y + Math.sin(a) * r - sz / 2); if (Cmd.canPlace(g, 1, type, tx, ty).ok) return g.spawnBuilding(type, 1, tx, ty, { built: true }); } };
      sp('mill', 2.4); const f = sp('farm', 0.4); if (f) Cmd.orderGather(g, vs.slice(11, 12), f);
      const b = sp('house', 1.4); if (b) { b.built = false; b.progress = 0.3; b.hp = 100; Cmd.orderBuild(g, vs.slice(12, 14), b); }
      A.cam.setZoom(1.6); A.cam.lookAt(tc.x - 3, tc.y + 2);
    });
    await sleep(12000); await shot('workers1');
    await ev(() => { const A = window.AOC; const tc = A.game.buildings.find(b => b.owner === 1 && b.type === 'town_center'); const tree = A.game.findNearestResource(tc.x, tc.y, 'wood', 30); A.cam.lookAt(tree.x, tree.y); });
    await sleep(1500); await shot('workers2');
  },

  async largeload() {
    await page.evaluate(() => { localStorage.setItem('aoc.config', JSON.stringify({ civ: 'goths', opponents: 3, difficulty: 'standard', map: 'blackforest', size: 'large', res: 'standard', reveal: false, wonder: false })); });
    await page.reload({ waitUntil: 'load' }); await sleep(500);
    const t0 = Date.now(); await startGame(); console.log('large 4-player Black Forest load (ms):', Date.now() - t0);
    await sleep(3000);
    // fly the camera across the map to stress lazy chunk generation
    const lag = await ev(async () => { const A = window.AOC, g = A.game; g.vision.reveal = true; g.vision.update(true); let worst = 0, last = performance.now(); for (let i = 0; i < 90; i++) { A.cam.lookAt(10 + i * 1.3, 10 + i * 1.3); await new Promise(r => requestAnimationFrame(r)); const now = performance.now(); worst = Math.max(worst, now - last); last = now; } return Math.round(worst); });
    console.log('worst frame while flying across the map (ms):', lag, ' chunks pending:', await ev(() => window.AOC.terrain.pending));
    await shot('largeload');
  },
  async start() { await startGame(); await sleep(1500); await shot('game'); },
};
try { await (scenarios[scenario] || (async () => { console.log('unknown scenario'); }))(); } catch (e) { console.log('SCENARIO ERROR', e.message); }
if (problems.length) console.log('PROBLEMS:\n' + [...new Set(problems)].slice(0, 25).join('\n'));
await browser.close();
