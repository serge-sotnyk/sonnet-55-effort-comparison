# Age of Crowns

A complete, playable real-time strategy game for the browser in the spirit of **Age of Empires II**.
Grow a medieval settlement, build an economy, advance through four ages, raise an army and destroy a
computer-controlled rival. No build step, no dependencies: plain ES modules, Canvas 2D and Web Audio.
**All art and sound is generated procedurally at runtime** (there are no image or audio files).

## Run it

```bash
node server.mjs 8080        # then open http://localhost:8080/
```

(Any static file server works; `server.mjs` is a tiny dependency-free one.)

## Features

* **Isometric world** with a procedural terrain renderer (biome blending, hill shading, forest litter, shorelines),
  animated water, decorations, fog of war (unexplored / explored / visible) and an isometric minimap.
* **Four ages** (Dark → Feudal → Castle → Imperial) with building prerequisites, age-based building styles and ~85 technologies.
* **Economy**: villagers gather food (berries, hunting, farms), wood, gold and stone; drop-off buildings, carry capacity,
  gather-rate upgrades, auto-reseeding farms, a **market** with dynamic prices, houses and a population cap of 200.
* **Four civilizations** (Britons, Franks, Goths, Mongols), each with bonuses, a unique unit (+ elite upgrade) and unique technologies.
* **~45 units**: infantry, spearmen, skirmishers, archers/crossbows, cavalry archers, scouts → hussars, knights → paladins, camels,
  rams, mangonels, scorpions, trebuchets, monks (heal + **convert**), unique units, wildlife (deer, boar, sheep, wolves).
* **AoE2-style combat**: armor classes, attack bonuses (spearmen vs cavalry, skirmishers vs archers, rams vs buildings…),
  ranged accuracy and projectiles, splash siege, stances, garrisoning (arrows from towers/castles/town centers), walls and gates.
* **Computer opponent** (Easy / Standard / Hard / Brutal) with build orders, economy balancing, age progression, production buildings,
  counter-based army composition, attack waves with siege, defense, villager safety and market trading. Play against 1–3 opponents.
* **Four map types** (Highlands, Black Forest, Lakeland, Meadows) in three sizes, fair mirrored starts, random seeds.
* **Polished UI**: AoE2-style resource bar, command card with hotkeys (QWERTY grid), tooltips with costs, production queues,
  multi-selection panel, control groups, idle-unit buttons, rally points, attack-move, formations, notifications, contextual hints,
  end-of-game score screen.
* Procedural **sound effects, music and ambience** with dynamic battle/peace moods.

## Difficulty

| Level | What the computer does |
| --- | --- |
| Easy | Small economy, slow Feudal, first small attack around 18 min (game clock) |
| Standard | Steady boom, Feudal at roughly 12–13 min, first wave around 14+ min, sieges later |
| Hard | Larger economy and army, earlier Feudal (~12 min), attack waves from ~11 min |
| Brutal | Feudal at ~10–11 min, early military rush (~8 min) and relentless follow-up waves |

The game clock is simulation time; at the default 1.7x speed one game minute takes about 35 real seconds.

## Not included

Naval combat, relics, save/load and multiplayer. Everything else in the list above is playable from the main menu.

## Controls

| Action | Input |
| --- | --- |
| Select / box select / select all of a type | Left-click / drag / double-click |
| Smart command (move, gather, build, repair, attack, garrison) | Right-click (Shift = queue) |
| Scroll the map | Screen edges, arrow keys, middle-drag, minimap |
| Zoom | Mouse wheel |
| Command card | `Q W E R T` / `A S D F G` / `Z X C V B` (Shift = train ×5) |
| Villager menus | `Q` economic buildings, `W` military buildings, `Esc` back |
| Town Center / idle villager / idle military | `H` / `.` / `,` |
| Select all military | `Ctrl+M` |
| Control groups | `Ctrl+1…9` set, `1…9` recall (twice = center) |
| Jump to last alert | `Space` |
| Delete | `Del` |
| Pause / game speed | `P` / `+` `-` |
| Show health bars | hold `Alt` |
| Menu / cancel | `Esc` |

## Project layout

```
index.html, css/style.css       UI shell
js/main.js                      app controller, game loop, menus flow
js/data/                        unit / building / tech / civ catalogs (AoE2-derived stats)
js/sim/                         pure-JS simulation (runs in Node too): map, pathfinding, units, combat, buildings, AI
js/render/                      terrain, world renderer, minimap, particles
js/ui/                          input, HUD, menus, feedback (sound + FX)
js/art/                         procedural sprites, icons, menu backdrop
js/audio/                       procedural sound effects and music
tests/                          headless simulation tests (combat, systems, AI-vs-AI sweeps)
tools/                          browser automation helpers (Playwright) used for visual testing
```

## Tests

```bash
node tests/combat.mjs      # unit matchups, siege, monks, upgrades
node tests/systems.mjs     # walls/gates, market, population cap, rally, farms, garrison
node tests/sweep.mjs 20    # AI-vs-AI games across maps/civs/difficulties (crash + stall detection)
node tests/aivai.mjs 40 standard 1   # a single AI-vs-AI game with a timeline
```
