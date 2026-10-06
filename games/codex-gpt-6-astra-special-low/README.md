# Crown & Tide

A playable, original isometric medieval browser RTS inspired by Age of Empires II. Run `npm start`, then open **http://localhost:4173**. No build step or paid services are needed. The local preview is left running on port 4173.

## Play

Choose your name, civilization, color, opponents, map, seed, age, economy, diplomacy, fog and speed, then **Begin Your Reign**. The first interaction activates sound.

- Click to select; drag to select a group; Shift adds to a selection.
- Right-click for contextual move, gather, hunt, build, repair, attack, heal, convert, garrison, transport loading or trade orders.
- WASD / arrow keys pan. Scroll zooms. Middle-drag or Alt-drag pans. Space centers on your Town Center.
- Select villagers for economic / military construction palettes. H places a House; F places a Farm. Select a Town Center and press V to queue a villager.
- Enter opens cheat input. Letters typed there do not activate shortcuts. The Guide lists all eight requested cheats and exact resource amounts.
- The Menu contains separate music, effects and voice levels, mute, restart and return-to-editor controls.
- Destroy all hostile Town Centers while keeping yours alive. Surviving allied or peaceful kingdoms share victory.

## Included systems

Four ages; four civilizations with bonuses and unique units; 19 building types; infantry, spears, archers, skirmishers, cavalry, monks, siege, fishing, transports, naval combat and trade; 11 technologies; resource depletion, carrying and drop-offs; construction, repairs, queues and population limits; sheep ownership, hunting and predators; garrisons and work-resuming Town Bell; conversion, healing and relic income; diplomacy and tribute; land and sea trade; raised terrain and movement restrictions.

The editor has terrain/elevation brushes, resources, animals, units, buildings, ownership, Town Center starts, selection/move/delete, undo/redo, browser saves, JSON import/export, placement validation and play/return without changing the saved design.

Sheep capture requires a land unit within 3 tiles, no current-owner land guard within 5 tiles, and expiration of a 6-second capture cooldown. Higher ground deals 125% damage; lower ground deals 75%. Projectiles arc over obstacles; forests, buildings, cliffs, deep water and elevation jumps above two levels restrict movement. Ships use water routes. Transport invasions verify that the landing shore has a land route to the enemy.

## Editable source

- `game.js`: data tables, economy, navigation, combat, AI, diplomacy and audio.
- `render.js`: original procedural canvas terrain, architecture, units, tools, ships and animation.
- `ui.js`: setup, selection, commands, editor, guide and controls.
- `style.css`, `index.html`: interface presentation.
- `server.js`: dependency-free local HTTP server.
- `audio/`: 48 bundled locally synthesized civilization/action acknowledgements.
- `synthesize-audio.js`: reproduces the speech assets on macOS using `say` and `afconvert`.

All graphics are original code-generated art. Music, ambience and effects use local Web Audio synthesis. Speech is locally synthesized, with Old-English-style, French-style, Greek and Norse-style phrases. Pronunciation is approximate, especially Old English and Norse; these are synthetic voices, not authentic historical performances. Fonts use freely available Google Fonts with local serif/sans-serif fallbacks.

## Validation and scope

See `TEST_REPORT.md` and `test-output/` for actual results and screenshots. `npm test` runs the browser regression suites. Tests use Playwright and the installed macOS Chrome executable; adjust the executable path in the test files on other platforms.

This is a compact RTS recreation, not the complete AoE II content catalog. The technology and civilization rosters are smaller, damage/armor and siege are simplified, groups can overlap instead of using sophisticated formation collision, and architecture shares a common art set. The seeded map is deterministic; runtime AI choices are not lockstep deterministic. No claim is made that every map seed, arbitrary imported map, long-duration match or browser has been exhaustively validated.

Audio playback, sample decoding, volume and overlap suppression are browser-tested. Perceived voice naturalness and historical pronunciation were not validated by a human listening test. The music is a synthesized medieval-style motif rather than a recorded soundtrack.
