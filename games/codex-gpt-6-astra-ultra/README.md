# Crown & Conquest

An original, playable browser homage to classic medieval real-time strategy. Build the Azure Kingdom and defeat the computer-controlled Crimson Kingdom on an illustrated isometric battlefield.

## Play

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. No build step or game runtime dependencies are required.

- **Select:** left-click; drag to select a group; Shift adds units; double-click selects the same unit type.
- **Command:** right-click terrain to move, resources to gather, foundations to construct, or enemies to attack.
- **Build:** use the Build tab or press **B**, choose a building, then click clear ground. Nearby villagers construct it. Escape cancels; Shift places multiple buildings.
- **Camera:** WASD / arrows, Alt-drag / middle-drag, or click the minimap. Scroll to zoom. **H** returns home.
- **Shortcuts:** **Q** trains the selected building’s first unit; **U** advances an age; **F2** selects the army; **.** finds an idle villager; **X** stops orders; **Space** pauses.
- **Control groups:** Ctrl/Cmd + 1–9 assigns selected units; 1–9 recalls them.

Your starting villagers are already working, and newly trained villagers gather automatically. Train more workers, balance food/wood/gold, build houses and military production, and advance through four ages. Farms provide renewable food. Wheelbarrow improves gathering; forging, armor, and fletching improve your army. Combine infantry and archers with Castle Age knights and battering rams to destroy the rival Town Center. The rival develops its economy and sends increasingly strong raids.

Matches run locally in memory. Reloading starts a new game; the settings menu also offers restart. Sound is optional. Desktop mouse and keyboard are recommended.

## Verification

```sh
npm test
node tests/strategy.mjs
```

Browser tests use Playwright and an installed Google Chrome (`PLAYWRIGHT_CHANNEL` can override the channel). Run the local server before the browser suite. `tests/strategy.mjs` plays a complete deterministic match using earned resources, with no stock or health manipulation. Screenshots and reports are written to `artifacts/`.

## Implementation

- `engine.js`: deterministic simulation, economy, pathfinding, construction, combat, AI, ages, upgrades, and match outcomes.
- `renderer.js`: procedural Canvas 2D terrain, buildings, units, animation, and effects.
- `main.js`: input, HUD, minimap, tutorials, sound cues, and game lifecycle.
- `icons.js`, `style.css`, `index.html`: original visual assets and responsive interface.

All game artwork is drawn in code. Fonts use Google Fonts with local system fallbacks.
