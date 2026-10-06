# Age of Empires II · Kingdoms

A complete single-player medieval RTS for the browser, built with native JavaScript and Canvas. Play as the Britons against the Iron Crown, a computer-controlled Frankish kingdom. All map, building, and unit artwork is drawn in code.

## Play

```sh
npm start
```

Open **http://localhost:5173**. Node 22 or later is recommended. The game itself has no npm runtime dependencies. Google Fonts is optional; system fonts work offline.

The game opens directly into a working settlement with seven Villagers and a Scout. Train more Villagers, build a Barracks, and advance your Town Center to the Feudal Age. Build a Blacksmith and military building to reach the Castle Age. Castles, Siege Workshops, and additional Town Centers then become available. Destroy the rival Town Center to win; losing all your Town Centers ends the campaign.

## Controls

| Control | Action |
| --- | --- |
| Left click / drag | Select a unit or building / select a group |
| Shift + click | Add or remove units from selection |
| Double click | Select nearby units of the same type |
| Right click | Move, gather, attack, build, repair, or garrison |
| Right click with a production building selected | Set its rally point |
| WASD / arrow keys | Pan the camera |
| Middle drag / Alt + drag | Drag the camera |
| Mouse wheel / zoom buttons | Zoom |
| Click or drag the minimap | Navigate |
| H | Select and center your Town Center |
| B | Villager build menu |
| Q | Train the first available unit |
| M / . | Select your army / idle Villagers |
| F / X | Attack Move / stop |
| G | Garrison selected units / release a building’s garrison |
| Ctrl or Cmd + 1–9 / 1–9 | Assign / select a control group |
| Double press a group number | Center the group |
| Space / Escape / ? | Pause / cancel / help |

On touch devices, select your units and use the **Command** button to give orders by tapping the map. The minimap and zoom buttons control the view.

## Systems

- Four ages; fourteen building types; eight unit types; six research technologies.
- Food, wood, gold, and stone are gathered by real Villagers and carried to appropriate drop-off buildings.
- Villager construction, cooperative building, repair, automatically reseeded farms, housing, training queues, rally points, and cancellation refunds.
- Infantry, cavalry, archers, longbowmen, spearmen with cavalry bonuses, and rams with building priorities and arrow resistance.
- Automatic age upgrades; blacksmith upgrades; defensive towers and castles; garrison healing and defensive bonuses.
- Pathfinding around water and buildings; group movement; exploration and fog of war; a live minimap.
- An AI that gathers, builds, ages up, trains mixed armies, and sends raids using real resources and production queues.
- Explorer, Standard, and Conqueror difficulty; three game speeds; pause; procedural music and sound effects.
- Manual save/load and a separate 30-second autosave stored locally in your browser. The menu’s Load button restores a manual save first, or the autosave if no manual save exists.
- Victory and defeat screens with campaign statistics.

## Verify

```sh
npm install
npm test
npm run test:browser
```

Browser tests require the server to be running and Google Chrome installed. Tests use an isolated browser profile. Simulation checks cover resource delivery, construction, capacity, research, all four ages, pathfinding, counters, siege targeting, expansion, defeat, and save restoration. A full campaign test wins against Standard AI with paid construction, actual gathering, production, research, and combat. Browser checks exercise map selection, building placement, queues, age advancement, pause, zoom, minimap, menus, save/load, responsive layouts, and victory. Screenshots are written to `test-results/`.
