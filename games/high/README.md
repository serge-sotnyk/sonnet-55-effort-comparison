# Age of Crowns

A browser real-time-strategy game in the spirit of *Age of Empires II* — no dependencies, no assets,
everything (terrain, buildings, units, sound and music) is generated procedurally in the browser.

## Run

    ./serve.sh            # or: python3 -m http.server 8765
    open http://localhost:8765

## Goal

Destroy every building of the computer-controlled rival before it destroys yours.
Gather food, wood, gold and stone, advance Dark → Feudal → Castle → Imperial Age, raise an army and break the enemy's walls.

## Features

* 4 resources, villagers, farms (auto-reseeding), hunting, drop-off camps, market trading
* 4 ages with age-dependent building architecture, ~60 technologies and unit upgrade lines
* 35+ unit types: infantry, archers, cavalry, monks (heal & convert), rams, mangonels, trebuchets, unique units
* 4 civilizations with bonuses: Britons, Franks, Teutons, Mongols
* Walls, gates, towers, castles, garrisoning, Town Bell, repair, rally points, attack-move, stances
* Fog of war, minimap, control groups, idle-unit buttons, production queues, tooltips with costs
* Computer opponent (Easy / Standard / Hard): economy, build orders, counter-unit army composition, attack waves, defence, villager flight
* Seeded, point-symmetric random maps (small / medium / large), lakes, forests, mines, wildlife
* Synthesised sound effects and generative music (WebAudio)
* Watch AI vs AI mode (Tab switches the viewpoint)

## Controls

| Input | Action |
|---|---|
| Left click / drag | select (double-click = same type on screen, Shift = add) |
| Right click | move · attack · gather · build · repair · garrison · set rally point |
| Shift + right click | queue orders |
| Arrow keys / screen edges / middle-drag | scroll |
| Mouse wheel, `[` `]` | zoom |
| `Q W E R T / A S D F G / Z X C V B` | command-card slots (shown on the buttons) |
| `A` / `S` | attack-move / stop (military) |
| `.` `,` | next idle villager / military |
| `H` | Town Center |
| `Space` | jump to last alert |
| `Ctrl+1…9`, `1…9` | assign / recall groups |
| `+` `-` | game speed · `P` pause · `M` music · `Del` delete · `Esc` cancel / menu · `F1` help |

Shift + click on a unit button queues five.
