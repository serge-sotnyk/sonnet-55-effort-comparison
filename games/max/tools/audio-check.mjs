// Objective audio verification: renders every SFX (or music) offline in headless Chrome and prints a metrics table.
//
//   node tools/audio-check.mjs                       # table for every sound (median of 3 seeds)
//   node tools/audio-check.mjs --names=chop,age_up   # selected sounds
//   node tools/audio-check.mjs --group=ack_          # sounds whose name starts with a prefix
//   node tools/audio-check.mjs --calibrate           # iteratively fit js/audio/levels.js (per-sound trim) to the `lvl` targets
//   node tools/audio-check.mjs --music               # render 60 s of each music mood and print level stats
//   node tools/audio-check.mjs --stress              # real-time stress / leak test
//   options: --port=8104 --seeds=3 --sr=44100 --json=out.json --quiet
//
// Requires playwright-core (tools/node_modules) and Chrome. Starts the dev server itself when none is listening.

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const port = Number(opt.port || 8104);
const base = `http://localhost:${port}`;

async function ensureServer() {
  try { await fetch(base + '/'); return null; } catch (e) { /* not running */ }
  const child = spawn('node', ['server.mjs', String(port)], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/'); return child; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  throw new Error('dev server did not start');
}

export async function openHarness(extraArgs = []) {
  const server = await ensureServer();
  let browser, lastErr;
  for (let attempt = 0; attempt < 4 && !browser; attempt++) {   // Chrome occasionally aborts on launch when several agents start it at once
    try {
      browser = await chromium.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc', ...extraArgs],
      });
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 700 * (attempt + 1))); }
  }
  if (!browser) throw lastErr;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const problems = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`[console.${m.type()}] ${m.text()}`); else if (opt.logs) console.log('[log]', m.text()); });
  page.on('pageerror', e => problems.push('[pageerror] ' + (e.stack || e.message)));
  await page.goto(`${base}/tools/preview/audio-test.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 }).catch(() => { });
  const close = async () => { await browser.close(); if (server) server.kill(); };
  return { page, problems, close };
}

/* ------------------------------------------------------------------ expectations & flags */
const EXPECT = [
  // [name or regex, min active seconds, max active seconds]
  ['age_up', 5, 8.5], ['victory', 5, 7.5], ['defeat', 5, 7.5], ['alarm_attack', 0.9, 1.7], ['alarm_building', 0.8, 1.7],
  ['monk_convert', 1.2, 2.1], ['wonder_start', 3, 8], ['wonder_complete', 3, 8], ['wolf_howl', 1.2, 3.5],
  ['building_collapse', 1.5, 4.5], ['trebuchet_fire', 1, 2.6], ['catapult_fire', 0.6, 1.8], ['game_start', 0.8, 3.5],
  [/^ack_/, 0.1, 0.75], [/^ui_/, 0.015, 1.2], [/^(chop|hammer|mine|farm|forage|butcher)$/, 0.03, 0.45],
  [/^(sword_hit|blunt_hit|arrow_hit|arrow_hit_wood)$/, 0.04, 0.5], [/^drop_/, 0.08, 0.9], [/./, 0.03, 4],
];
function expectFor(name) { for (const [k, a, b] of EXPECT) if ((typeof k === 'string' && k === name) || (k instanceof RegExp && k.test(name))) return [a, b]; return [0.03, 4]; }
const LOUD_CLASS = /^(age_up|victory|defeat|alarm_attack|alarm_building|wonder_start|wonder_complete)$/;

function flags(m) {
  const f = [];
  if (m.error) return ['ERROR'];
  if (m.peak < -45) f.push('SILENT');
  if (m.clip > 0 || m.peakMax > -0.3) f.push('CLIP');
  if (m.nan > 0) f.push('NaN');
  if (m.dcMax > 0.003) f.push('DC');
  if (m.lead > 0.03) f.push('LEAD');
  if (m.cutDb > -38) f.push('CUT');
  const act = m.act, [lo, hi] = expectFor(m.name);
  if (act < lo) f.push('SHORT'); if (act > hi) f.push('LONG');
  if (m.centroid > 4200 || m.hf > 0.3) f.push('SHRILL');
  if (m.peak > m.target + 1.0) f.push('PEAK+');
  if (m.targetLoud != null && Math.abs(m.loudA - m.targetLoud) > 2.0 && m.peak < m.target - 1.0) f.push('LOUD?');
  return f;
}

const fmt = (x, d = 1, w = 6) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a').padStart(w);

function printTable(rows) {
  console.log('name'.padEnd(22) + ['dur', 'act', 'peak', 'ceil', 'rmsAct', 'loudA', 'tgtL', 'cent', 'hf%', 'dc*1e3', 'lead', 'cutDb', 'trim'].map(s => s.padStart(7)).join('') + '  flags');
  console.log('-'.repeat(130));
  for (const m of rows) {
    if (m.error) { console.log(m.name.padEnd(22) + ' ERROR ' + m.error.split('\n')[0]); continue; }
    console.log(m.name.padEnd(22) + [fmt(m.dur, 2, 7), fmt(m.act, 2, 7), fmt(m.peak, 1, 7), fmt(m.target, 0, 7), fmt(m.rmsAct, 1, 7), fmt(m.loudA, 1, 7), fmt(m.targetLoud, 0, 7), fmt(m.centroid, 0, 7), fmt(m.hf * 100, 0, 7), fmt(m.dc * 1000, 2, 7), fmt(m.lead * 1000, 0, 7), fmt(m.cutDb, 0, 7), fmt(m.trim, 1, 7)].join('') + '  ' + flags(m).join(','));
  }
}

function summary(rows) {
  const ok = rows.filter(r => !r.error);
  const bad = ok.filter(r => flags(r).length);
  console.log(`\n${ok.length} sounds analysed, ${rows.length - ok.length} errors, ${bad.length} with flags`);
  const peaks = ok.map(r => r.peak), loud = ok.map(r => r.loudA);
  console.log(`peak range ${Math.min(...peaks).toFixed(1)} .. ${Math.max(...peaks).toFixed(1)} dBFS; loudA range ${Math.min(...loud).toFixed(1)} .. ${Math.max(...loud).toFixed(1)} dB(A)`);
  const byLoud = [...ok].sort((a, b) => b.loudA - a.loudA);
  console.log('loudest (A-weighted short-term):', byLoud.slice(0, 10).map(r => `${r.name} ${r.loudA.toFixed(1)}`).join(', '));
  console.log('quietest:', byLoud.slice(-10).map(r => `${r.name} ${r.loudA.toFixed(1)}`).join(', '));
}

/* ------------------------------------------------------------------ main */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
async function main() {
const { page, problems, close } = await openHarness();
let exitCode = 0;
try {
  const names = opt.names ? String(opt.names).split(',') : opt.group ? await page.evaluate(g => H.SFX_NAMES.filter(n => n.startsWith(g)), String(opt.group)) : null;
  const seeds = Array.from({ length: Number(opt.seeds || 3) }, (_, i) => i + 1);
  const sr = Number(opt.sr || 44100);

  if (opt.calibrate) {
    console.log('calibrating levels...');
    const t0 = Date.now();
    const trims = await page.evaluate(async ({ names, iters }) => H.calibrate({ names, iters }), { names, iters: Number(opt.iters || 4) });
    console.log(`calibrated ${Object.keys(trims).length} sounds in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    // merge with existing levels when only a subset was calibrated
    const file = path.join(root, 'js/audio/levels.js');
    let existing = {};
    try { const src = fs.readFileSync(file, 'utf8'); const m = src.match(/TRIM_DB\s*=\s*(\{[\s\S]*?\});/); if (m) existing = JSON.parse(m[1]); } catch (e) { /* none */ }
    const merged = { ...existing, ...trims };
    const body = Object.keys(merged).sort().map(k => `  ${JSON.stringify(k)}: ${merged[k]},`).join('\n');
    fs.writeFileSync(file, `// GENERATED by tools/audio-check.mjs --calibrate : per-sound trim in dB so each sound's output peak hits its target (sfx meta.lvl).\nexport const TRIM_DB = {\n${body}\n};\n`);
    console.log('wrote', path.relative(root, file));
  }

  if (opt['calibrate-music']) {
    // [A-weighted mean level target dB, unweighted RMS cap dBFS] of each instrument played alone
    const targets = {
      'peace.lute': [-32, -29], 'peace.pad': [-38, -32], 'peace.flute': [-36, -31], 'peace.ghost': [-47, -40], 'peace.drone': [-44, -36],
      'tense.drone': [-35, -29], 'tense.drum': [-33, -28], 'tense.str': [-34, -30], 'tense.lute': [-36, -32], 'tense.ghost': [-48, -42], 'tense.flute': [-40, -34],
      'battle.drum': [-29, -25], 'battle.lute': [-32, -28], 'battle.brass': [-35, -29], 'battle.str': [-36, -31], 'battle.timp': [-34, -28], 'battle.shawm': [-33, -29], 'battle.cymbal': [-45, -38],
    };
    let res;
    if (opt['levels-only']) { res = { mix: await page.evaluate(() => ({ ...H.MIX })), last: {} }; }
    else {
      console.log('calibrating music instrument mix (A-weighted mean levels)...');
      res = await page.evaluate(async ({ targets, seconds }) => H.calibrateMusic({ targets, seconds }), { targets, seconds: Number(opt.seconds || 50) });
      console.log(JSON.stringify(res.last, null, 1));
    }
    if (!(res.mix['tense.flute'] > 0 && res.mix['tense.flute'] < 100) && res.mix['peace.flute']) res.mix['tense.flute'] = +(res.mix['peace.flute'] * 0.7).toFixed(4);
    // second stage: per-mood output level (unweighted RMS targets of the full mix through the master chain)
    const lv = await page.evaluate(async ({ mix, targets }) => { Object.assign(H.MIX, mix); return H.calibrateMoodLevels({ targets }); }, { mix: res.mix, targets: { peace: -29, tense: -28, battle: -26 } });
    console.log(JSON.stringify(lv.last, null, 1));
    const file = path.join(root, 'js/audio/mix.js');
    const body = Object.keys(res.mix).sort().map(k => `  ${JSON.stringify(k)}: ${res.mix[k]},`).join('\n');
    fs.writeFileSync(file, `// GENERATED by tools/audio-check.mjs --calibrate-music : per mood+instrument gain multipliers of the generative score\n// (MIX) and the per-mood output scale (LEVEL).\nexport const MIX = {\n${body}\n};\nexport const LEVEL = ${JSON.stringify(lv.level)};\n`);
    console.log('wrote', path.relative(root, file));
  }

  if (!opt.music && !opt.stress && !opt.soak && !opt.ambient && !opt['calibrate-music']) {
    const t0 = Date.now();
    const rows = await page.evaluate(async ({ names, seeds, sr, bare, noTrim }) => H.analyzeAll({ names, seeds, sr, bare, noTrim }), { names, seeds, sr, bare: !!opt.bare, noTrim: !!opt.notrim });
    if (!opt.quiet) printTable(rows);
    summary(rows);
    console.log(`(rendered in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    if (opt.json) fs.writeFileSync(String(opt.json), JSON.stringify(rows, null, 1));
    const bad = rows.filter(r => r.error || flags(r).some(f => ['ERROR', 'SILENT', 'CLIP', 'NaN', 'DC', 'CUT'].includes(f)));
    if (bad.length) { exitCode = 1; console.log('HARD FAILURES:', bad.map(b => `${b.name}[${flags(b).join(',')}]`).join(' ')); }
  }

  if (opt.music) {
    const res = await page.evaluate(async ({ sr, seconds, mood }) => H.analyzeMusic({ sr, seconds, mood }), { sr, seconds: Number(opt.seconds || 60), mood: opt.mood || null });
    console.log(JSON.stringify(res, null, 1));
  }
  if (opt.stress) {
    const res = await page.evaluate(async () => H.stressTest());
    console.log(JSON.stringify(res, null, 1));
    if (res.errors && res.errors.length) exitCode = 1;
  }
  if (opt.soak) {
    const res = await page.evaluate(async (seconds) => H.soakTest({ seconds }), Number(opt.seconds || 120));
    console.log(JSON.stringify(res, null, 1));
  }
  if (opt.ambient) {
    const res = await page.evaluate(async (seconds) => H.analyzeAmbient({ seconds }), Number(opt.seconds || 60));
    console.log(JSON.stringify(res, null, 1));
  }
} finally {
  if (problems.length) console.log('\nPAGE PROBLEMS:\n' + [...new Set(problems)].slice(0, 30).join('\n'));
  await close();
}
process.exit(exitCode);
}
