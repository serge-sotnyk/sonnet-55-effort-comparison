# Crown & Tide

An original, playable isometric browser RTS inspired by Age of Empires II. All graphics are drawn from editable canvas code. This is a compact interpretation of its medieval economy and combat, not a feature-identical recreation of the commercial game.

## Play

Run `npm start`, then open **http://localhost:4173**. No build step or account is needed. The preview listens on port 4173.

Choose your civilization and map on the main menu. Select villagers, then right-click sheep, trees, berries or deposits. Use **B** for economic construction, **V** for military construction, **H** for your Town Center, **Q** to train villagers, and **A** to advance an age. Drag to select groups, right-click to command, wheel to zoom, and WASD / arrows to pan. Middle-drag also pans. Press **Enter** for chat and cheats. The Field Guide documents all systems and supported codes.

The four civilizations have separate bonuses, unique units and spoken acknowledgements. Matches support one human and one to three AI players. Land, coastal and island maps have seeded terrain and resources. Difficulty changes attack timing and AI resource assistance; computer players receive a small resource stipend so they can recover from depletion. Teams, colors, ages, resources, visibility, speed and cheats all affect the simulation.

Victory: retain a Town Center and remove all hostile players' Town Centers, or negotiate peace/alliance with the remaining rivals. You may continue after victory. Friendly fire is disabled; allied and peaceful players stop hostile targeting.

## Included systems

- Four ages, 19 buildings, 23 unit types including ships, four unique units and the Cobra Car, and 15 technologies.
- Carrying and drop-offs, farms, depletion, hunting, sheep ownership and recapture, predators, fishing, land and sea trade.
- Terrain pathfinding, obstacles, visible elevation and 125% / 75% uphill / downhill damage.
- Naval combat, fire and demolition attacks, galley upgrades, transport boarding and shore unloading; AI island invasions.
- Garrisoning, defensive fire, Town Bell work resumption, villager repairs, monk healing and conversion, relic collection and income.
- Paid production queues, age and prerequisite locks, population, civilization bonuses, diplomacy proposals and tribute.
- Generated/blank map editor with terrain/elevation brushes, object palettes, owner selection, player starts, selection/movement/deletion, undo/redo, local saving, JSON import/export, validation and playable custom matches.
- Original synthesized music and effects, local spoken WAV acknowledgements, independent volume controls and mute.

## Editable source

`game.js` contains the simulation, renderer, interface, editor and audio orchestration. `style.css` is the interface theme. `index.html` is the menu and game shell. `server.js` serves the files. `scripts/generate-voices.py` regenerates the spoken assets using macOS's local `say` command; no paid generation is involved. The WAV files are included, so players do not need macOS. Google Fonts is optional: the interface falls back to system/Georgia fonts offline.

## Tests

Install development dependencies with `npm install`. Install a Playwright browser, start the preview, and run `npm test`. In this environment the browser is installed in `/tmp/crown-playwright`; use `PLAYWRIGHT_BROWSERS_PATH=/tmp/crown-playwright npm test`.

See `TESTING.md` and `test-results.json` for the actual checks and limitations. Tests invoke the real browser simulation and also exercise pointer/keyboard input, editor files and audio playback.

## Deliberate simplifications

This build has four civilizations and a compact technology tree, rather than AoE II's full civilization roster, campaign content and exact balance. Farms replenish automatically; there is no manual reseeding. Ranged fire can pass over trees and walls; those obstacles block movement rather than projectiles. Siege attacks use simplified direct damage, and units share tiles rather than having a full crowd physics model. AI is heuristic and receives a small difficulty-dependent economic stipend. No multiplayer, campaign, replay or saved-match system is included.

The spoken lines are historical-language-style local synthesis. Old English and Old Norse pronunciation is approximate; French and Greek use modern installed voices. These are speech recordings, not authentic period performances. Browser audio activation requires clicking Begin or interacting with the game.
