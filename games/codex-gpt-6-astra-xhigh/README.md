# Crown & Conquest

A complete single-player medieval RTS skirmish inspired by Age of Empires II, built with native JavaScript, Canvas 2D, and original procedural artwork. Lead the Blue Kingdom through four ages and destroy the rival town center across the Riverlands.

## Play

```sh
npm start
```

Open **http://localhost:4173**. The game has no runtime dependencies, build step, or external network requirements. Node.js 18+ is sufficient to serve it. Use `PORT=8080 npm start` to choose another port.

Your settlement begins with seven villagers, a scout, two militia, a town center, a barracks, houses, farms, a mill, and a lumber camp. Six villagers already have gathering orders; one is available to build. Train more villagers, protect your economy, advance through the ages, and send a combined army across the bridges.

## Controls

| Action | Control |
|---|---|
| Select a unit or building | Left-click |
| Select a group | Drag a box |
| Add to selection | Shift-click or Shift-drag |
| Select nearby units of the same type | Double-click |
| Move, gather, build, repair, or attack | Right-click a destination or target |
| Build | Select a villager, choose a building, click clear ground |
| Place several buildings | Hold Shift while placing |
| Pan | WASD, arrow keys, or middle/right drag |
| Zoom | Mouse wheel or minimap + / − |
| Focus town center | H |
| Train a villager at the selected town center | V |
| Open villager building commands | B |
| Find idle villager | . |
| Focus selection / stop | F / X |
| Pause | Space |
| Cancel placement or open menu | Escape |

The army button selects your military. Attack Move makes units engage enemies on their route. A military building’s rally point sends recruits to a destination; villagers rallied to a resource begin gathering automatically.

On touch devices, tap to select and then tap a destination or resource to issue an order. Drag the battlefield to pan, and use the minimap to navigate.

## Included systems

- Four resources, finite natural deposits, renewable farms, carried cargo, and local drop-off buildings.
- Four ages with real resource costs and research queues.
- Fourteen buildings, seven unit types, siege artillery, armor and attack research, and worker upgrades.
- Population limits, production queues, cancellation refunds, rally points, construction assistance, and repairs.
- Automatic military defense, attack-move orders, projectiles, siege damage, towers, and castles.
- A computer opponent that gathers, builds, trains, researches, advances, and sends escalating raids.
- Three difficulty levels, pause, four game speeds, minimap, fog of war, selection groups, contextual tooltips, and sound.
- Victory and defeat screens, persistent tutorial milestones, manual save/load, and autosave every 30 seconds. Saves stay in your browser’s local storage and reload automatically.

A full match typically takes 10–25 minutes, depending on difficulty and play style. The **?** button provides an in-game field guide.

## Verification

```sh
npm test                 # Deterministic simulation integration tests
npm run test:match       # Full standard skirmish using earned resources
npm run test:browser     # Chromium interaction, rendering, and responsive tests
```

Browser tests require the game server to be running and development dependencies installed (`npm install`). On macOS they use installed Google Chrome; on other systems run `npx playwright install chromium`. Set `CHROME_PATH` to use another Chromium executable and `GAME_URL` for a different server address. The browser suite blocks external requests and captures desktop, compact, phone, and Imperial Age screenshots in `tests/`.

## Project

- `src/game.js`: deterministic simulation, economy, pathfinding, combat, AI, and serialization.
- `src/renderer.js`: original isometric buildings, terrain, units, fog, animations, and minimap.
- `src/main.js`: interface, keyboard/mouse/touch input, game loop, saves, and dialogs.
- `src/data.js`: balance definitions and original interface icons.
- `src/audio.js`: synthesized sound effects.

Cormorant Garamond and DM Sans are bundled under the SIL Open Font License; their license files are in `assets/fonts/`. This is an independent game with original artwork, not an official Age of Empires product.
