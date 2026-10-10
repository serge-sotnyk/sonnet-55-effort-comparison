# Age of Crowns — Procedural Audio Specification

Browser RTS (Age of Empires II-like). **No audio files**: every sound effect and the music are synthesized with the Web Audio API.
You own `js/audio/*.js` (e.g. `audio.js` entry, `synth.js` helpers, `sfx.js` sound recipes, `music.js` generative score, `ambient.js`).
Vanilla ES modules, no bundler. Project root: `~/sonnet-55-experiment/max`. Dev server: `node server.mjs <port>`.

## 1. Public API (`js/audio/audio.js`)

```js
export const audio = {
  init(),                    // create AudioContext + master graph (call from a user gesture; idempotent). Before init(), every other call is a silent no-op.
  resume(),                  // resume a suspended context
  get ready(),               // boolean
  setMasterVolume(v), setSfxVolume(v), setMusicVolume(v), setAmbientVolume(v), setMuted(bool),   // v in 0..1
  play(name, opts),          // opts: { vol=1, pan=0 (-1..1), rate=1 (pitch multiplier), delay=0 (s) }; returns nothing. Unknown names: console.warn once, no throw.
  music: { start(), stop(), setMood('peace'|'tense'|'battle'), mood },   // generative background score; crossfades between moods
  ambient: { start(), stop() },                                          // wind / birds / distant ambience bed
  duck(amount, seconds),     // briefly lower music (e.g. for fanfares / alarms)
  stopAll(),                 // silence everything (for leaving the game)
};
export const SFX_NAMES = [ ... ];   // every name below
```
`play()` is called very frequently (dozens per second during battles). Build in: a master `DynamicsCompressor`/limiter (no clipping, ever), a global voice cap (~28 concurrent, drop the quietest / oldest low-priority),
per-name minimum interval (~35-60 ms, longer for loud/long ones) and automatic slight randomization of pitch/volume/noise seeds on every play so battles do not sound machine-gun repetitive.
Pre-render noise buffers once and reuse them. Everything must clean up its nodes (no leaks: disconnect after `onended`).
Sounds should be pleasant and *medieval-flavoured*, never harsh or shrill; the default levels must be balanced (SFX peak around -8 dB, music around -20 dB relative to SFX bed).

## 2. Sound list (`name` -> what it should sound like). All must exist.

**UI**: `ui_click` (soft wooden tick), `ui_hover` (very faint), `ui_error` (low dull "nope" thud, e.g. not enough resources), `ui_notify` (short gentle two-note chime), `ui_select` (subtle leathery pip), `ui_select_building` (low wooden knock), `ui_menu_open`, `ui_menu_close`.
**Commands (unit acknowledgements, short synthesized "voice-like" blips with formant filtering — a pleasant, tiny "hup"/"yah"/"hm"; variations per call)**: `ack_villager`, `ack_infantry`, `ack_archer`, `ack_cavalry` (with a hoof/neigh flavour), `ack_monk` (soft "mm-hm" chant tone), `ack_siege` (wood creak + low grunt).
**Economy**: `place_building` (thud + timber clack), `building_complete` (short rising wooden fanfare), `hammer` (single hammer-on-wood tap; played repeatedly while building), `chop` (axe into wood, with variants), `tree_fall` (creak + soft thump), `mine` (pick on rock: bright tink + dull crunch), `farm` (soft swish/rustle), `forage` (leafy rustle), `butcher` (knife thunk), `drop_resource` (generic coin/thud clatter), `drop_wood` (wood clunk), `drop_gold` (coins), `drop_food` (soft thump of a basket), `drop_stone` (rock clatter), `unit_trained` (soft bell "ding"), `research_done` (bright rising 3-note chime), `age_up` (a grand 5-8 second brass/strings fanfare — rising, triumphant, medieval), `market_buy` / `market_sell` (coin sounds, different), `garrison` (door/latch + footsteps), `ungarrison`.
**Combat**: `sword_hit` (blade on flesh/leather), `sword_clang` (blade on armor/shield — metallic, with ring), `blunt_hit` (dull thud), `arrow_shoot` (bow twang + whoosh), `arrow_hit` (thwip/thunk), `arrow_hit_wood` (thock into wood/building), `javelin` (short airy whoosh + thunk), `axe_throw` (whoosh spin), `bolt_shoot` (scorpion: big twang + thump), `catapult_fire` (mangonel: wooden arm slam + creak + whoosh), `trebuchet_fire` (heavy: long creak, thud, whoosh), `stone_impact` (rock smashing into ground/building with crumble), `ram_hit` (deep heavy wooden boom), `building_collapse` (long rumble + crash of timber/stone), `building_fire` (a short crackle burst for fire starting), `unit_die` (short male grunt/gasp + thud; several variants), `villager_die` (higher pitched), `horse_die` (neigh + thud), `animal_die`, `boar_squeal`, `wolf_howl`, `deer_flee`, `sheep_baa`, `horse_gallop` (brief hoof clatter).
**Monks**: `monk_heal` (soft sparkling chime/harp glissando), `monk_convert` (a mystical choir-like chant "wo-lo-lo" melody, ~1.5 s, voice-like formants), `monk_convert_done` (a brighter flourish).
**Alerts & game flow**: `alarm_attack` (war horn, two-note, ~1.2 s — attention-grabbing but pleasant), `alarm_building` (lower horn), `idle_alert` (soft bell), `victory` (triumphant fanfare ~6 s), `defeat` (somber minor fanfare ~6 s), `countdown_tick`, `wonder_start` (deep gong + brass), `wonder_complete`, `relic`.
Anything extra you think the game needs is welcome (add it to `SFX_NAMES`), but all of the above are required.

## 3. Music (`music.js`)

Generative, endless, non-annoying, medieval/folk-flavoured score:
- Mode-based (Dorian / Mixolydian / Aeolian / Phrygian touches), slow tempo (60-90 bpm), plucked lute/harp (Karplus-Strong or filtered saw/triangle with fast decay), soft string/choir pad (detuned saws through lowpass + slow LFO), flute/recorder lead (sine+triangle with vibrato and breath noise), low drone, frame drum/tambour (filtered noise + sine thump) for tension/battle.
- Moods: `peace` (sparse, airy, arpeggiated lute + pad + occasional flute phrase), `tense` (minor, drone, heartbeat drum), `battle` (driving drums, brass-like stabs, faster ostinato). Crossfade between moods smoothly (2-4 s). Compose phrases algorithmically with seeded variation so it never loops audibly (weighted random walks over scale degrees, rest probabilities, call-and-response, key changes every few minutes).
- Keep CPU low: schedule notes ahead using the AudioContext clock via a short `setInterval` look-ahead scheduler (e.g. every 100 ms schedule 0.3 s ahead); reuse buffers; max ~12 voices.
- Quiet by default; the engine sets `setMusicVolume`.

## 4. Ambient (`ambient.js`)
Gentle looping bed: filtered-noise wind with slow modulation, occasional birdsong chirps (FM sine sweeps), distant crows, light rustle. Very quiet.

## 5. Testing
- You cannot listen, so verify objectively: use `OfflineAudioContext` (or a real context in headless Chrome run through `tools/shot.mjs`-style Playwright scripts: Playwright + Chrome are installed in `tools/`, see `tools/shot.mjs` for how to launch Chrome headless; pass `--autoplay-policy=no-user-gesture-required`) to render every SFX and a minute of each music mood into buffers and analyze them: duration, peak, RMS (loudness balance across sounds), NaN/Infinity, DC offset, silence, clipping, spectral centroid, spectrogram PNG of key sounds (render to canvas and screenshot, then LOOK at it). Tune until levels are balanced (no sound is dramatically louder; fanfares/horns are the loudest).
- Write a test page `tools/preview/audio.html` with buttons that play each sound/mood (for the human to try) and an automated `tools/audio-check.mjs` that prints a table of metrics for all SFX.
- Test `audio.play` spam (1000 calls in a second) for stability (no crashes, bounded node count) and that calling before `init()` is harmless.
- Finish with a short report: API deviations, metrics summary, known weaknesses.
