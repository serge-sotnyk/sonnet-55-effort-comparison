# Crown & Covenant

An original, playable browser RTS inspired by Age of Empires II. Grow a medieval settlement, gather four resources, advance through four ages, train an army, and defeat House Raven.

## Play

Run `npm start`, then open **http://localhost:4173**. The game itself has no runtime dependencies, remote assets, or build step. Fonts are bundled with their licenses. A desktop browser with mouse and keyboard is recommended.

Choose Peaceful start, Standard, or Warlord. The game saves to your browser automatically every 25 seconds; the pause menu also has a manual save button.

## Controls

- Left-click selects a unit or building; drag selects a group.
- Right-click moves, gathers, constructs, repairs, attacks, or sets a building's rally point.
- Shift-click adds or removes a selection. Double-click selects nearby units of the same type.
- WASD / arrow keys pan; mouse wheel zooms; middle-button drag pans.
- H returns to your Town Center. Period selects idle workers.
- B opens construction for selected villagers. Q issues attack-move for soldiers.
- Shift+A selects your army. Ctrl/Cmd+1–9 assigns groups; 1–9 recalls them.
- Space pauses. Escape cancels a command. Delete offers to disband/demolish the selection.
- Click the minimap to navigate; right-click it to issue orders.

## Your first settlement

Your seven villagers start gathering. Train additional villagers at your Town Center. Select a villager and use Construct to build a Barracks, houses, and farms. Several builders can work on one foundation. Assign villagers to gold and stone by right-clicking those deposits.

Houses add five population capacity. Farms provide renewable food. Town Centers, watchtowers, and castles defend themselves. Villagers can repair damaged buildings using wood. Military buildings train units in queues, and blacksmiths research army-wide upgrades.

Feudal Age unlocks archers, watchtowers, and the blacksmith. Castle Age adds knights, castles, and battering rams. Imperial Age unlocks long-range trebuchets. Protect siege engines with soldiers and destroy the rival Town Center and military buildings to win. Losing your own Town Center ends the campaign.

## Verification

Install development dependencies with `npm install`. With the server running, use `npm test`. Tests use Playwright and a locally installed Google Chrome.

The browser tests cover gathering, UI training, mouse-based placement and construction, pathfinding, four ages, siege training and damage, AI growth and raids, save/reload, pause, compact layout, combat victory, and a complete AI victory against an undefended settlement. Deterministic fast-forward hooks are exposed at `window.__game` for verification. Victory transition tests use an isolated combat fixture; the AI campaign test runs the normal simulation.

## Files

- `game.js`: simulation, AI, pathfinding, procedural isometric rendering, input, and saves.
- `index.html` / `style.css`: interface and visual design.
- `server.mjs`: lightweight local static server.
- `tests/`: browser verification and screenshots.
- `assets/fonts/`: bundled Cinzel and DM Sans, licensed under the SIL Open Font License.

The game uses original vector-style canvas art and does not include Age of Empires assets or branding. This is a standalone single-player skirmish game, not an implementation of the commercial game's entire content catalog.
