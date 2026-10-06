# Crown & Tide — test report

Final recorded result: **82/82 checks passed** on local desktop Chrome, 6 October 2026. The preview responded HTTP 200 at http://localhost:4173 and remains running.

## What was actually exercised

These are browser-run scenario and interface tests, not a claim of exhaustive playtesting. Core mechanics were exercised with controlled fixtures and accelerated simulation. The progression fixture gathers and banks wood, constructs a House, advances through all four ages, trains a soldier and deals combat damage. A separate victory fixture destroys weakened hostile Town Centers with actual projectiles and verifies the victory screen.

The generated island scenario starts in Castle Age with abundant resources and runs six simulated minutes. It verifies a completed AI Dock, fishing ships, a military fleet, transport loading and unloading onto land with a valid route to the enemy. The multiple-opponent economy test runs three AI rivals for 70 simulated seconds. These tests do not establish long-duration balance or guarantee every generated seed is navigable.

Actual UI automation covers pointer selection and gathering, Enter-to-type cheats, volume/mute controls, restart, editor buttons, map export/download and import/upload. Audio checks decode non-silent WAV samples and verify playback, clip variation and interruption of the previous clip. No human listening assessment was performed.

## Visual inspection

Inspected actual canvas gameplay screenshots at 1440×960 and 1280×720, including the developed settlement with a Castle, Monastery, windmill, workers, cavalry, Dock, fishing and military ships and construction commands. The title/setup screen and editor were also captured.

- [Starting battlefield](test-output/final-battlefield.png)
- [1280×720 battlefield](test-output/final-1280.png)
- [Developed settlement](test-output/developed-settlement.png)
- [Later animation frame](test-output/developed-animation.png)
- [Map editor](test-output/editor.png)

## Fixes made during testing

- Trade routes now cancel when a returning cart’s destination becomes hostile.
- Navigation rejects misleading partial paths; AI workers choose reachable resources.
- AI reserves wood for naval development and avoids duplicate queued transports.
- AI unloading checks reachability to the enemy instead of landing on an intervening island.
- Construction prevents trapping units beneath its footprint.
- Generated stone deposits were moved away from starting trees after stronger overlap validation caught a conflict.
- Resource carriers deposit their existing load before changing resource type and bank the final partial load from an exhausted resource.
- Queue controls refresh when production finishes; stale cancellation is guarded.
- Bundled local speech removes reliance on installed browser voices.

## Remaining limitations and untested behavior

- Compact content scope: four civilizations, 19 buildings and 11 technologies; not AoE II’s complete civilization or technology catalog. Architecture uses a shared original art set. Siege, armor and formation behavior are simplified; groups can overlap.
- Historical language and pronunciation are approximations generated with local speech synthesis. Actor-level naturalness has not been established. Music and effects are procedural synthesis.
- No full uninterrupted, unmodified human match was played to completion. No exhaustive long-match balance, all-seed/all-setting matrix, all arbitrary custom-map layouts, mobile, Safari or Firefox verification was performed.
- Imported maps are validated for starts, overlapping placements, shoreline Docks and fish/ship terrain compatibility; this is not an exhaustive proof that every resource, starting region or allied trade route is reachable.

## Recorded checks

| Check | Result |
|---|---|
| Wood economy: gather, carry and deposit | PASS |
| Construction completes and adds population | PASS |
| Dark to Feudal advancement | PASS |
| Castle and Imperial advancement | PASS |
| Production queue creates unit | PASS |
| Trained army deals real combat damage | PASS |
| Neutral sheep captured | PASS |
| Guard prevents contested ownership flicker | PASS |
| Unguarded sheep recaptured | PASS |
| Sheep slaughter and food gathering | PASS |
| Deer flee hunting danger | PASS |
| Boar retaliates | PASS |
| Wolf threatens exposed unit | PASS |
| Fishing returns food to Dock | PASS |
| Land cannot cross water | PASS |
| Ships cannot sail on land | PASS |
| Transport loads land unit | PASS |
| Transport sails and lands at valid shore | PASS |
| Naval ranged combat | PASS |
| Fire Ship attacks | PASS |
| Demolition explosion | PASS |
| Town Bell garrisons villagers | PASS |
| Bell release restores work order | PASS |
| Repair restores health and consumes resources | PASS |
| Monk healing living unit | PASS |
| Relic collection, deposit and gold income | PASS |
| Monk delayed conversion | PASS |
| Destroyed Monastery drops relic | PASS |
| Diplomacy accepts viable peace | PASS |
| Trade cart completes gold route | PASS |
| War restores hostility and cancels trade | PASS |
| Elevation 125% / 75% combat rule | PASS |
| Cheat cheese steak jimmy's | PASS |
| Cheat LUMBERJACK | PASS |
| Cheat robin hood | PASS |
| Cheat rock on | PASS |
| Reveal, fog, instant and Cobra cheats | PASS |
| Cobra rapid fire causes damage | PASS |
| Disabled cheats rejected | PASS |
| Editor serialization save / reload | PASS |
| Editor rejects fish on land | PASS |
| Editor rejects overlapping buildings | PASS |
| Valid custom map accepted | PASS |
| Custom map launches with four players | PASS |
| Three AI economies train and build | PASS |
| Enter-to-type UI executes cheat without shortcuts | PASS |
| Independent volume controls | PASS |
| Mute control | PASS |
| Restart resets match | PASS |
| Bundled audio clips available and decode | PASS |
| Desktop UI fits 1280×720 | PASS |
| No browser JavaScript exceptions | PASS |
| Island AI builds a completed Dock | PASS |
| Island AI trains Fishing Ships | PASS |
| Island AI builds a military fleet | PASS |
| Island AI lands troops on the enemy-reachable shore | PASS |
| Editor blank map clears objects | PASS |
| Editor undo restores generated map | PASS |
| Editor redo reapplies blank map | PASS |
| Editor reload restores saved map | PASS |
| Editor Play launches game | PASS |
| Return to editor preserves design | PASS |
| Trade Cog completes sea gold route | PASS |
| Villager repairs ship from shoreline | PASS |
| Pointer selection and context gather order | PASS |
| Combat destroys Town Center and triggers victory | PASS |
| Extended scenarios have no JavaScript exceptions | PASS |
| Editor exports valid JSON file | PASS |
| Editor imports exported file | PASS |
| Editor selection moves an object | PASS |
| Editor deletes selected object | PASS |
| Editor paints actual elevation | PASS |
| Repeated unit selections vary spoken clips | PASS |
| Voice audio plays and prevents overlap | PASS |
| Age prerequisites reject locked units | PASS |
| Training enforces resource cost | PASS |
| Training enforces population cap | PASS |
| Carrier death drops held relic | PASS |
| Garrison capacity is enforced | PASS |
| Garrison contributes defensive attack | PASS |
| Ungarrison uses valid land exit | PASS |
| Edge scenarios have no browser exceptions | PASS |

Raw results: `test-output/results.json`, `extended-results.json`, `edge-results.json`. Island events and state: `test-output/island-simulation.json`. Reproduce with `npm test`.
