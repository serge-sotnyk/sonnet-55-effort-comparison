# Crown & Conquest

A complete browser-based medieval real-time strategy game, inspired by Age of Empires II. All battlefield artwork, heraldry, and audio are original and generated in code.

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. The game begins with a working settlement, six villagers, and a scout. Destroy the rival Town Center to win; protect your own to survive.

- Gather food, wood, gold, and stone. Workers carry their harvest to Town Centers or nearby resource camps.
- Construct houses, mills, farms, camps, barracks, ranges, stables, blacksmiths, towers, and castles.
- Advance through the Dark, Feudal, Castle, and Imperial Ages. Research weapons, armor, and Wheelbarrow.
- Train infantry, spearmen, archers, scouts, knights, and trebuchets. Unit counters, ranged attacks, siege, formations, pathfinding, and fog of war work together.
- The computer builds its economy, researches ages, trains armies, and sends progressively stronger raids. Three difficulties and four game speeds are available.
- Save and restore your kingdom locally through the game menu. Sound includes synthesized medieval ambience and action effects.

| Control | Action |
| --- | --- |
| Left-click / drag | Select a unit, building, or group |
| Right-click | Move, gather, construct, repair, attack, or set a production rally point |
| Shift + click | Add to your selection; keep placing a building |
| Double-click a unit | Select visible units of the same type |
| WASD / arrow keys | Pan the map |
| Middle drag / Alt + drag | Pan the map |
| Scroll / + / − | Zoom |
| H | Select your Town Center |
| . | Cycle idle villagers |
| B | Open selected villager's building menu |
| Q | Train a villager at the selected Town Center |
| A | Attack move with selected units |
| X | Stop selected units |
| F3 | Select your military |
| Ctrl + 1–9 | Assign a control group |
| 1–9 / Shift + 1–9 | Select group / select and center group |
| Space | Pause / resume |
| Escape | Cancel placement, back out, or open the menu |
| ? | Open the commander's handbook |

For a strong start, train more villagers, assign them to food and wood, build enough houses, and advance to the Feudal Age. A few spearmen and archers will hold the early raids. Knights can lead your assault; trebuchets make short work of fortifications.

Run `npm test` for deterministic simulation tests and `npm run build` for the production build. The browser smoke test is `node tests/browser-smoke.mjs`; it expects the development server and an installed Playwright Chromium browser.
