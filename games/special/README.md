# Age of Realms – browser medieval RTS
Run: `python3 -m http.server 8765` in this folder, open http://localhost:8765/ (click once to enable sound).
Source: `js/` (data, map, game sim, ai, sprites, buildings, render, icons, audio, ui, ui2, editor, main). No build step.
Tests: `tests/runsim.js` (headless sim suite, `SEED=2 node tests/runsim.js`), `tests/pw/*.js` (Playwright + system Chrome UI tests).
Help screen (F1) lists controls, rules (sheep guard radius, elevation, win condition) and cheat codes.
