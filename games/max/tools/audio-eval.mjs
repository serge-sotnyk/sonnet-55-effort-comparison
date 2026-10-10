// Evaluate a JS function body in the audio test page (window.H = harness exports) and print the JSON result.
//   node tools/audio-eval.mjs "return await H.analyzeSfx('chop', {seed:1})"
// Handy for debugging recipes without writing a script.
import { openHarness } from './audio-check.mjs';

const code = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ');
if (!code) { console.error('usage: node tools/audio-eval.mjs "<js body using H>" [--port=8104]'); process.exit(1); }
const { page, problems, close } = await openHarness();
try {
  const result = await page.evaluate(`(async () => { ${code} })()`);
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 1));
} catch (e) {
  console.error('EVAL ERROR', e.message);
} finally {
  if (problems.length) console.log('\nPAGE PROBLEMS:\n' + [...new Set(problems)].slice(0, 20).join('\n'));
  await close();
}
