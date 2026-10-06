# Verification report

The browser suite in `test.mjs` currently runs 35 checks against the real game engine. Results are saved in `test-results.json`.

Passed checks include:

- Four-player setup, distinct colors, civilizations and starting resources.
- Chopping, carrying, drop-off and resource depletion; worker construction, paid production, all four ages and combat kills.
- Sheep capture, owner guarding, capture lock, recapture and movement; sheep/boar hunting, deer flight and wolf damage.
- Fishing and food delivery; land/water separation; galley, fire and demolition damage; boarding, sailing and valid shore unloading.
- Garrison defensive fire, ungarrisoning and Town Bell work resumption.
- Building, siege and ship repair with resource consumption; living-unit monk healing, delayed conversions, relic deposit and income; relic drops on deaths/destruction.
- Actual land and sea trade journeys with distance-based gold; invalid diplomacy stops trade.
- Exact 125% uphill and 75% downhill damage; age, resource and population restrictions.
- Repeated/case-insensitive resource cheats, instant production, reveal/fog removal, functional Cobra Car combat, and Enter input without gameplay shortcuts.
- Multiple AI players developing economies and armies; island AI fishing, fleet production and an actual transport invasion.
- Separate audio volumes and mute; non-silent WAV decoding, spoken playback and replacement of prior acknowledgements.
- Editor placement, undo/redo, save/reload, JSON export/import, placement validation and launching a custom match.
- Diplomacy proposal UI, desktop HUD at 1280×720 and 1440×900, fresh restart, and no browser runtime exceptions.

Additional visual inspections used screenshots of actual gameplay, a developed settlement, coastal/island terrain, the editor and the setup menu. Screenshots were generated from this implementation; none were inputs or references. Units use task-specific tool animations; mounted units and boats have separate movement artwork.

## Limits of testing

Automated scenarios accelerate simulated time and use controlled starting states to isolate interactions. The island test also runs a generated match for seven simulated minutes. These checks are not an exhaustive manual campaign or a guarantee that every map seed, four-player island layout, diplomacy sequence, civilization/technology combination or extreme editor design is balanced and navigable. Listening quality was not evaluated by a human; real non-silent speech playback was verified, and pronunciation is explicitly approximate. Multi-browser testing beyond Chromium and phone layouts are untested. The interface is intended for desktop pointer and keyboard use.

The scope omissions and simulation simplifications are listed in README.md. No paid external assets or previous-build source were used.
