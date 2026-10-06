# Crownfall

An original browser RTS inspired by Age of Empires II. Build a medieval economy, progress through four ages, train an army, and destroy House Ashford's town center. Everything runs locally: canvas art, simulation, AI, audio, and browser saves. No backend or external artwork is required. Optional Google Fonts fall back to system fonts when offline.

## Play

Run `npm start`, then open http://localhost:5173. Python 3 is required to serve the files. You can also use any static HTTP server.

- Left click selects; drag selects groups; double click selects nearby units of the same type.
- Right click moves, gathers resources, builds, repairs, attacks, or sets a building's rally point.
- WASD or arrow keys pan; scroll zooms; middle mouse drags the map. Click the minimap to navigate.
- H returns home. Space pauses. Escape cancels. 1 selects idle villagers; 2 selects the army.
- Q places a house, F a mill, E a lumber camp, R a farm, B a barracks, T a town center.
- Shift-click a training button queues up to five units. The speed button cycles 1×, 2×, and 3×.

Train villagers from Military, grow your population with houses, and build a barracks before training infantry. Use Advance for ages and upgrades. Protect your ranged units with infantry; use siege rams against the enemy town center. The Field Guide explains the full game. Settings provides save, load, and restart. Progress also saves every 30 seconds in the same browser.

## Systems

Food, wood, gold, and stone; finite natural resources and renewable farms; villager gathering bonuses from nearby camps; construction and repairs; population limits; unit production queues; four ages; gathering, armor, and weapon research; infantry, ranged units, cavalry, scouts, and siege; defensive arrow fire; pathfinding and formations; exploration and fog of war; an AI economy with construction, progression, training, and escalating raids; victory and defeat; synthesized optional sound.

## Verify

`npm install --cache /tmp/crownfall-npm-cache` and `npm test` with the server running. The browser suite uses installed Google Chrome on macOS. Set `CHROME_PATH` to another Chromium executable if needed. It exercises real UI controls plus deterministic simulation for economy, construction, training, farms, progression, combat, research, exploration, AI raids, pause, save/load, victory/defeat, and the layout at 1024×768. Screenshots are written to `tests/`.

The application itself has no JavaScript runtime dependencies.
