# Age of Crowns — Procedural Art Specification

Age of Crowns is a browser RTS in the spirit of **Age of Empires II** (isometric, medieval, four ages, villagers/economy/army/siege).
There are **no image files**: every sprite is generated at runtime with the Canvas 2D API. Several people write art modules in parallel,
each owning separate files. This document is the contract. Read it fully before starting.

Project root: `~/sonnet-55-experiment/max` (vanilla JS ES modules, no bundler, no npm runtime deps).
Data catalogs you must draw art for: `js/data/units.js`, `js/data/buildings.js`, `js/data/techs.js`, `js/data/civs.js`, `js/data/constants.js`.
Shared helpers: `js/art/common.js` (**read-only for you** — if you need extra helpers, write them in your own files).

## 0. Quality bar

Target look: **Age of Empires II: Definitive Edition / Age of Mythology: Retold** — stylized, painterly, instantly readable at small size.
Not flat clip-art, not 8-bit pixel art. Think: strong silhouettes, soft gradient shading, a thin dark outline, saturated-but-natural colors
(lush greens, warm browns, terracotta roofs, grey stone, gold trim). A player must identify *what a unit is* from its silhouette and palette alone
(archer vs spearman vs knight vs monk vs ram). Buildings must look like distinct, charming medieval structures that visibly evolve across the four ages.
Spend real effort on polish: view your output at DPR 2, iterate, compare units side by side, fix anything ugly.

## 1. Conventions (all modules)

### 1.1 Projection
Isometric 2:1. Tile = 64 x 32 px diamond (at camera zoom 1). World (tile) coords -> screen: `sx = (x - y) * 32`, `sy = (x + y) * 16 - z` (z = height in px).
World +x points screen **down-right (SE)**, world +y points screen **down-left (SW)**.
Light comes from the **upper-left (NW)**: top surfaces brightest, left/SW faces medium, right/SE faces darkest. Cast shadows would fall toward the lower-right.

### 1.2 Sprite object
Every sprite function returns `{ canvas, w, h, ax, ay }` — `w`,`h` are LOGICAL px (1 logical px = 1 CSS px at zoom 1);
`(ax, ay)` is the **anchor** inside the sprite: for units the point on the ground at their feet (center of the body footprint),
for buildings/resources the center of the footprint diamond on the ground. The engine draws `drawImage(canvas, X - ax*zoom, Y - ay*zoom, w*zoom, h*zoom)`.

### 1.3 Supersampling
Use `makeCanvas(w, h)` from `common.js` (returns `{canvas, ctx, w, h}`; ctx is pre-scaled so you draw in logical px; the backing store is `SCALE`x larger,
where `SCALE = getSpriteScale()` is 1 or 2). Never create canvases manually for sprites. Use integer logical sizes. Leave >= 2 px transparent margin if you use `addOutline`.
The engine calls `setSpriteScale()` before anything is generated; in your preview pages call `setSpriteScale(window.devicePixelRatio >= 1.5 ? 2 : 1)`.

### 1.4 Laziness, caching, speed
Generate lazily and cache (the engine may request thousands of sprites per frame; the hot-path lookup must be O(1) and allocation-free:
use nested arrays or a `Map` keyed by an integer composite key, never build strings per call). Typical generation budget:
a unit frame < 2 ms, a building sprite < 30 ms. Provide a `warm...()` function so the loading screen can pre-generate in small slices.
No `getImageData` loops over large areas at runtime.

### 1.5 Team colors
`teamColor(team)` -> `{ main, light, dark }`; `team` 1..7 are player colors (blue, red, green, yellow, cyan, purple, orange), 0 = neutral grey.
Put the team color on a **large, clearly visible area** (tunic/surcoat/cloak/shield/banner/caparison for units; flags, banners, awnings, roof trim for buildings),
so players can tell sides apart instantly, but keep the rest of the palette natural.

### 1.6 Directions
8 facings, index `dir` 0..7 (by SCREEN direction the unit faces): `0:SE  1:S  2:SW  3:W  4:NW  5:N  6:NE  7:E`.
World facing vectors are in `DIR_VEC` (`common.js`). `makeProjector(dir)` gives a ready 3D->2D rig projector (forward/left/up axes).
Render each of the 8 directions properly (do not mirror) so lighting and handedness stay consistent.

### 1.7 Outline & style
`addOutline(surface)` after drawing gives the 1 px dark-brown outline that unifies everything. Use gradients (not flat fills) on large areas, subtle highlights on top-left edges,
darker value toward the bottom-right. Keep details that matter (weapons, helmets, banners) large enough to read at 1x.

## 2. Units module — `js/art/units.js`

```js
export const ANIMS = ['idle','walk','attack','chop','mine','farm','forage','butcher','build','death','corpse'];
export function animFrames(type, anim)            // -> integer frame count for that anim of that unit type
export function getUnitSprite(type, team, dir, anim, frame, opts) // opts = { carry: null|'food'|'wood'|'gold'|'stone', variant: int }
//   -> sprite {canvas,w,h,ax,ay}.  `frame` may exceed the count: wrap with modulo.  Must NOT include a ground shadow (engine draws it).
export function getUnitIcon(type, team = 1)       // -> canvas, 48x48 logical px (square, opaque, painterly bust/portrait on a gradient). For command-card buttons.
export function getUnitPortrait(type, team = 1)   // -> canvas, 72x72 logical px. For the selection panel.
export function warmUnitSprites(types, teams, onProgress)  // optional: generate everything for the given types/teams in slices; returns a Promise
export function unitSpriteInfo(type)              // -> { height } approx unit height in logical px (engine uses it for health-bar placement) 
```
Frame counts: `idle` 1 (animals: 2-4 grazing/breathing frames), `walk` 8 (seamless loop), `attack` 6 (wind-up -> **impact at frame index 3** -> recover),
`chop`/`mine`/`farm`/`forage`/`butcher`/`build` 6 (villager work loops, hit moment at index 3), `death` 6 (last frame = lying on the ground), `corpse` 1 (the lying pose, same as death's last frame).
Ranged units release the projectile at attack frame 3. Non-villagers only need idle/walk/attack/death/corpse (return the idle frame for other anims).
Siege: `attack` = the machine's firing/ramming motion; trebuchet: `walk`/`idle` = packed on its cart, `attack` = unpacked and firing (frame 0 = unpacked ready pose).
`carry` (villagers only): draws a visible load while `walk`/`idle` — wood bundle on the back/shoulder, food basket/sack, gold nuggets sack, stone sack.
`opts.variant`: villagers vary (even = male, odd = female with dress & head-scarf; also vary hair/clothes tone slightly so crowds do not look cloned); other units: variant may slightly vary palette/skin.

Reference sizes (logical px, tile = 64x32): villager ~30 tall; infantry ~32 (spear tips ~44); archers ~31; monk ~32; horse+rider ~46 tall x ~48 long;
camel+rider ~52 tall; ram ~46 x 30; mangonel ~48 x 42; scorpion ~40 x 30; trebuchet (unpacked) ~72 tall x 64 wide; deer ~24 tall at the head; boar ~16 x 28; sheep ~16.
Canvas sizes: humans 64x64, mounted 96x80, siege 128x112 (adjust as needed; keep anchors consistent across frames/dirs of a type so units don't jitter).

### 2.1 Recommended technique
Build a small 3D skeleton rig per body type (humanoid, horse, camel, deer/boar/sheep quadruped, siege machines as boxes/cylinders), pose it per animation frame via joint angles,
project with `makeProjector(dir)`, depth-sort limbs/parts, and draw them as shaded capsules/polygons, then `addOutline`. This yields all 8 directions and all animations from one definition.

### 2.2 What each unit looks like (ids from `js/data/units.js`)
- **villager** — peasant; team-colored tunic or hood, brown trousers, tan skin. Tools per anim: axe (chop), pickaxe (mine), hoe (farm), basket picking (forage), knife (butcher), hammer (build). Fights with fists/pitchfork? (idle weapon: none). Female variant: dress & scarf.
- **militia** — leather cap, padded team-color gambeson, short sword, small round wooden buckler. **man_at_arms** — nasal helm + mail coif, round shield painted team color. **long_swordsman** — iron helm, mail hauberk, long sword, kite shield. **two_handed** — great helm, surcoat, big two-handed sword held with both hands. **champion** — full plate, plumed helm, huge greatsword, team-color tabard & cloak.
- **spearman** — simple cap, leather jerkin, long spear (tip above head), round shield. **pikeman** — kettle helm, mail, longer pike. **halberdier** — sallet, plate shoulders, halberd.
- **skirmisher** — light unarmored, hooded cap, bundle of javelins on the back, throws javelins. **elite_skirmisher** — brigandine, better cap.
- **archer** — hood/cap, quiver, short bow, team-color tunic. **crossbowman** — padded jerkin, sallet, crossbow. **arbalester** — mail, plumed hat, heavy crossbow.
- **cavalry_archer** — horse + rider with fur/pointed hat and recurve bow. **heavy_cav_archer** — armored horse with team barding, rider in helm.
- **scout** — light unarmored horse (bay), rider in light tunic and cap, short spear/sword. **light_cavalry** — lighter/faster horse, light helm. **hussar** — rider in fur-trimmed pelisse (team color), saber.
- **knight** — armored horse with team-colored caparison (cloth barding), rider in mail/plate with visored helm, lance or sword, shield. **cavalier** — heavier plate, plumed helm, richer caparison. **paladin** — full plate, grand caparison, tall plume.
- **camel / heavy_camel** — one-humped camel (long neck, hump), rider in turban/light robe with spear/curved sword; heavy has armor/team banner.
- **ram** — wooden gabled roof on four wheels, thick log with iron cap suspended in front, team-color cloth/shields; `attack` = swinging log. **capped_ram** — iron-capped head, reinforced roof. **siege_ram** — big iron-clad ram with banner.
- **mangonel** — wooden frame, long throwing arm with a bucket, winch, wheels; `attack` = arm throws. **onager** — bigger; **siege_onager** — largest, iron-reinforced, flag.
- **scorpion** — big wheeled crossbow-like bolt thrower with a loaded bolt; **heavy_scorpion** — bigger limbs, iron fittings.
- **trebuchet** — huge counterweight siege engine; packed on a cart for walk/idle, unpacked frame set for attack (arm swings over, sling releases).
- **monk** — tonsured monk in a long robe (ochre/brown) with team-color sash/hood trim, wooden staff; `attack` = raising the staff/hand (used for healing & converting: add a subtle golden glow in the middle frames).
- **longbowman** — green hood with feather, leather jerkin w/ team color, a **very tall** longbow (taller than the man). **elite_longbowman** — better armor, ornate bow.
- **throwing_axeman** — fur-trimmed leather, round helm, throws a hand axe (axe in hand, overhand throw), team-color shoulder cloth. **elite_throwing_axeman** — mail & better helm.
- **huskarl** — Norse housecarl in mail and conical helm with nasal, big round shield painted team color, axe/sword; **elite_huskarl** — heavier, plumed/horned details.
- **mangudai** — Mongol pony (shaggy, small) with rider in furred hat and robe (team color), recurve bow. **elite_mangudai** — richer armor/hat.
- **deer** (stag with antlers; idle = grazing 3-4 frames, walk = bounding), **boar** (dark bristly wild boar with tusks, attack = gore), **sheep** (white woolly sheep, dark face, grazing idle), **wolf** (grey wolf; attack = bite).
  Animals use team 0 (neutral palette) except sheep which are owned by players (a small team-color ear tag/collar is enough). Also provide `death` frames for animals and a `corpse` pose.

## 3. Buildings & resources — `js/art/buildings.js`, `js/art/resources.js`

```js
// buildings.js
export function getBuildingSprite(type, team, age, state)   // age 0..3 (Dark..Imperial) -> architecture style tier
//   state = { build: undefined|0..1 (construction progress; undefined or >=1 = complete), frame: int (animation frame, see buildingAnimFrames),
//             mask: wall connection bitmask (1:+x/SE neighbour, 2:+y/SW, 4:-x/NW, 8:-y/NE), open: bool (gate open), axis: 'x'|'y' (gate axis), fill: 0..1 (farm food left) }
//   -> sprite. Cache by (type, team, age, constructionStage 0..3 | complete, frame, mask, open, axis, fillStage).
export function buildingAnimFrames(type)        // -> frame count (mill: 8 sail rotation frames; others 1)
export function getBuildingIcon(type, team = 1, age = 0)      // canvas 48x48 logical, opaque, painterly little portrait of the building
export function getBuildingPortrait(type, team = 1, age = 0)  // canvas 72x72
export function getRubbleSprite(size, variant)  // collapsed building debris (size = footprint tiles 1..5); anchor = footprint center
export function getConstructionSprite(size, stage, variant)   // optional helper; getBuildingSprite handles stages itself
export function warmBuildingSprites(teams, onProgress)        // Promise; generate common sprites in slices
// resources.js
export function getResourceSprite(kind, variant, fill)  // kinds: 'tree','stump','berries','gold_mine','stone_mine','carcass_deer','carcass_boar','carcass_sheep'
//   fill 0..1 = amount remaining (berries/mines/carcasses show 3 visual levels; trees/stumps ignore it)
export function treeVariantCount()                      // >= 8 (oaks, pines, birches, a dead/dry tree...); variant wraps by modulo
export function getDecorSprite(kind, variant)           // 'tuft','flowers','rocks','mushrooms','fern','reeds','shrub','log','pebbles' (non-blocking ground clutter 6-28px)
export function decorVariantCount(kind)
export function getResourceIcon(kind) -> canvas 24x24  // optional
```
Building footprint = `size` x `size` tiles from `js/data/buildings.js`: the footprint diamond is `64*size` wide and `32*size` tall centered on the anchor `(ax, ay)`.
Keep the building's base inside that diamond (eaves may overhang <= 8 px). Entrances/doors face the camera (south: the SE and SW faces).
Bake a soft contact shadow toward the lower-right into building sprites (units' shadows are drawn by the engine).
Typical heights above the ground: house 60-80, mill 90, camps 50-60, barracks/range/stable/smithy 90-120, market 90, monastery 130, university 120,
town center 150-180, castle 180-210, wonder 240-300, watch tower 90, guard tower 105, keep 125, outpost 60, walls 24-40.
Sprite canvases are as large as needed (town center ~ 300x260, wonder ~ 400x380).

### 3.1 Age styles (`age` 0..3)
Buildings visibly evolve: **Dark** — rough timber & thatch, wattle, small; **Feudal** — timber-frame with plaster, clay-tile roofs, stone footings; **Castle** — stone walls, slate/tile roofs, crenellations, more ornament;
**Imperial** — grand cut stone, gold/colored trim, tall spires, richer banners. Apply to every building type reasonably (a house in the Imperial Age is a fine stone townhouse; palisade is always wood; stone_wall always stone).
Team color: banners/pennants/flags/awnings/roof trim (always some, clearly visible).

### 3.2 Construction stages
`state.build` in [0,1): stage = floor(build*4): 0 foundation (dirt, stakes, a few planks/stones), 1 timber frame / first courses, 2 walls up with scaffolding, 3 nearly complete with scaffolding & unfinished roof. Complete = full sprite. Walls/gates/farms: simple versions.

### 3.3 Special buildings
- **farm** (3x3, flat, drawn on the ground): tilled furrows; `fill` 1 -> lush crops (wheat/green rows), 0.5 -> half, ~0 -> bare/stubble. No tall parts so units can stand on it (max 6 px high).
- **palisade / stone_wall / gate** (1x1): the sprite shows the segment and connecting arms toward neighbours according to `mask` (bit1: toward +x i.e. screen SE, bit2: +y SW, bit4: -x NW, bit8: -y NE). Isolated post when mask = 0. Gate: wooden/iron doors between two towers/posts along `axis` ('x' = running along world +x), `open` shows doors swung open.
- **mill**: windmill; `state.frame` rotates the sails (8 frames, seamless loop). **blacksmith**: glowing forge. **town_center**: big hall with central tower & team flags; **castle**: four corner towers + keep; **wonder**: spired cathedral-like monument with golden domes.
- **watch_tower** (wood/stone small), **guard_tower** (stone, crenellated), **keep** (large fortified tower) — three distinct 1x1 sprites; **outpost**: small wooden lookout platform.
- **tree**: anchor at the trunk base; height 70-105 px; footprint is 1 tile but crowns may overlap neighbours. Variants must mix well in forests (varied hue/size). **stump**: small, non-blocking. **berries**: bush with red/pink berries, fill levels (full, ~half, few). **gold_mine / stone_mine**: 1-tile rock pile with gold nuggets/veins or grey boulders; depletes visually over 3 levels. Carcasses: lying animals (deer, boar, sheep), 2 fill levels.

## 4. Icons & menu art — `js/art/icons.js`, `js/art/menu.js`

```js
// icons.js
export function getIcon(spec, size)  // spec strings below -> canvas (logical size default 48, opaque rounded-square painterly icon unless stated)
//   'glyph:<name>[:accent]'  tech/command icons     accent in none|gold|stone|blood|holy|steel|wood|food
//   'age:0..3'               age emblems (Dark: torch/hut, Feudal: shield, Castle: tower, Imperial: crown), also usable at 24px
//   'civ:<britons|franks|goths|mongols>'  civilization emblems (heraldic: Britons red lion rampant? -> pick original heraldry: lion/longbow, fleur-de-lis/knight helm, wolf/rune shield, horse/yurt-sun)
//   'res:food|wood|gold|stone|pop'  small resource icons: 24 px logical, TRANSPARENT background (meat/wheat, logs, gold ingots, stone block, little house/person)
//   'ui:<name>'              command-card/HUD glyphs, TRANSPARENT background unless noted
export function glyphNames()          // list of supported glyph names (for tests)
// menu.js
export function drawMenuBackdrop(ctx, w, h, t)   // animated title-screen scene filling w x h (CSS px); t = seconds. Layers are pre-rendered once, per-call cost tiny (parallax drift, clouds, birds, flag waving)
export function getCivEmblem(civId, size)        // large (e.g. 128) emblem for the civ select screen, transparent bg
```
Glyph names used by `js/data/techs.js` (every one must exist): `cloth wheelbarrow cart eye collar plow crop axe saw pickaxe sword shield barding bow archerarmor boots ring horse castle crane tower wall gear cross scroll book coin banner gear`.
Accents: `gold`, `stone`, `blood` are used as tints/ornaments (e.g. `pickaxe:gold` shows a gold nugget, `pickaxe:stone` a grey block). Tier pips are NOT needed (the engine adds roman numerals).
Extra glyphs the UI needs (all must exist): `ui:attack ui:move ui:stop ui:delete ui:garrison ui:ungarrison ui:rally ui:repair ui:build_eco ui:build_mil ui:back ui:cancel ui:stance_aggressive ui:stance_defensive ui:stand_ground ui:stance_passive ui:idle_villager ui:idle_military ui:menu ui:buy ui:sell ui:attack_move ui:patrol ui:heal ui:convert ui:unpack ui:wall ui:gate ui:flare ui:speed ui:pause ui:sound ui:mute ui:chat ui:objectives ui:trade ui:research ui:queue ui:town_center ui:select_all ui:minimap_signal`.
Glyph style: bold iconic shape (sword, shield, bow, wheat...) centered on a rich background gradient (blue-steel for military, green for food/farming, brown for wood, amber for economy, purple/gold for religion), thin gold-ish inner border, subtle top-left highlight. They will be shown at 40-52 px in the command card, so the shapes must be chunky and legible.
Backdrop: a beautiful medieval landscape at dusk/dawn — layered mountains, rolling hills, a hilltop castle with banners, a village with chimney smoke, birds, drifting clouds, a warm gradient sky with sun glow, subtle vignette. Must look good at any size from 1280x720 to 2560x1440 (fit by covering). Cost per frame < 2 ms (pre-render static layers into offscreen canvases).

## 5. Testing & deliverables

- Each module has a preview page you create under `tools/preview/` (e.g. `tools/preview/units.html`) that imports your module and draws a contact sheet (all types x relevant dirs/frames, labelled), plus a screenshot script. Serve the project with `node server.mjs <port>` (use your own port, given in your task) and screenshot with `node tools/shot.mjs http://localhost:<port>/tools/preview/<page>.html /tmp/<name>.png --w=1600 --h=1000 --dpr=2 --wait=2000`, then LOOK at the PNG with the Read tool and iterate until it is genuinely good-looking. Also check console errors printed by shot.mjs.
- Also test the integration contract: call each exported function with every id from the data catalogs and make sure nothing throws (write a small checker page that logs a summary).
- Do not modify files you do not own. `js/art/index.js` (barrel) and everything under `js/sim`, `js/render`, `js/ui` belong to the engine author.
- Finish with a short report: what is implemented, any deviations from this API, performance numbers (ms to generate warm sets), and known weaknesses.
