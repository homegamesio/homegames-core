# Moonbounce polish — October 18, 2026

The description is exactly **Perhaps you have played a similar game before**. Joseph Garcia chose completed-board checkpoints, factual text with names retained, and larger controls with a landscape recommendation. The game remains solo, with 40 adventure boards, 15 challenges, five characters and the existing artwork/music.

## Changes

- Cancelled or replaced pointer captures no longer fire. A keyboard/controller shot invalidates an earlier pointer aim, so releasing it later cannot launch a second shot. Missing/non-finite release coordinates cancel safely.
- Invalid player identifiers cannot claim the solo seat; extra joins cannot replace its owner. Closed games ignore further inputs/ticks and repeated close calls.
- Saves deduplicate unchanged snapshots and submit new snapshots immediately to the platform, including at close. Latest-write completion controls failure feedback; an old completion cannot hide a newer failure. Errors remain visible, with a pointer/keyboard/controller-accessible Retry save control. Subsequent save points retry too.
- Completed boards preserve medals, best scores and unlocks; shot completion preserves career statistics. Settings persist. **Reopening starts the selected board fresh**, as requested; current pegs, balls and score are not saved.
- Decorative dialogue, subtitles and results prose were simplified to goals, controls and bonuses. World/board/character/trophy names remain. Buttons and key HUD labels are larger. Home and pause recommend turning phones sideways; the developer preview additionally shows a narrow-portrait hint. This is still a wide layout, not a portrait redesign.
- Paused frames and static map/challenge/trophy menus stop rebuilding identical geometry. Input focus, hover, save feedback and audio transitions still update. Music/effect asset changes explicitly notify serialization, independent of visual redraws.
- Developer preview and standalone builder now use the current portable loader and include JSON artwork modules. Source preview, QA controls and the offline preview were smoke-tested. The catalog thumbnail is a real 960×600 opening-shot browser capture.

## Verification

| Check | Result |
| --- | --- |
| Existing Moonbounce checks | **70 passed**, including recorded legal solutions for all 40 adventure boards and 15 challenges with their real goals and ball limits. No peg/resource shortcuts in those solutions. |
| New launch regressions | **13 passed**: capture/release, mixed controls, player ownership, save ordering/dedup/failure/retry/close, paused scenes, and serialized audio/hover updates on static menus. |
| Existing scope/catalog checks | **55 passed**. Total **138**. |
| Real client | Mouse menus and aiming, natural completed shot/peg hits, actual decoded audio playback and pause silence, save failure/recovery, all five illustrated worlds, and landscape/portrait captures. Later-world and failure scenarios are explicitly seeded inspection fixtures. No browser errors or external HTTP requests. |
| Built website and offline HTML | Ordinary touch Play/aim/release, natural shot completion with six peg hits, career saved exactly once, sound/music/effects settings and reload persistence. Downloaded HTML runs with networking disabled. No state/clock/storage injection, browser errors or external requests. |
| Website and game audit | **32 games / 12 featured** build; selected games have no audit issues or external dependencies. |

Final built revision: `fa3c43ba0c86894e9a7f366a7b4e2497c58afe19e0d5543f35fc6ef80876ee66`.

The `browser/` and `package/` folders contain screenshots and measured results; source fingerprints, build/test logs, selected-game audit and full performance measurements accompany this record. The thumbnail was captured immediately before the final audio-notification change; visuals are unchanged by that change. No package publication, deployment or shared-runtime modification occurred.

## Performance and remaining limits

Five embedded images total **11,469,040 bytes**; 68 generated audio buffers total **6,257,430 bytes** (**17,726,470 bytes** together, before archive/encoding overhead). The game runs at 30 Hz. The diagnostic selects each world's densest authored board, warms up for one second and measures four seconds with the actual Common/Squish pipeline.

Active scenes produce roughly **42–44 KB per frame**, modeling **10.30–10.50 Mbps for one remote self-hosted player**, excluding transport overhead. Browser-local solo play requires no remote frame upload. In this desktop Node 24 run, active tick-plus-frame p95 was about **2.5–2.6 ms**; this is not an EC2 or phone capacity result. Paused geometry emits no redundant frames; the static menus likewise avoid repeated geometry work, with audio transitions independently serialized. Baseline timings were collected under different concurrent load and should not be used as a controlled speedup comparison.

Physical-phone aiming comfort, campaign difficulty and replay appeal still need player testing. Portrait remains small: landscape is the intended phone orientation. Remote self-hosted bandwidth, native artifacts and constrained-network behavior are unaccepted. Simulation advances per 30 Hz game tick, so overloaded or suspended hosts can slow play. Deterministic recorded solutions establish that content can be completed, not that ordinary players will find its difficulty enjoyable.

## Reproduce

Use Node 24. Browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH` and need Chrome plus permission to listen on loopback.

```sh
node --test test/games/MoonbounceLaunch.test.cjs
node testRunner.js ./test/games/MoonbounceEngine.test.js ./test/games/MoonbounceAdventureContent.test.js ./test/games/MoonbounceProgression.test.js ./test/games/Moonbounce.test.js ./test/games/MoonbounceNavigation.test.js ./test/games/MoonbouncePlaythroughs.test.js ./test/games/MoonbounceSound.test.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/moonbounce-performance.cjs
node test/moonbounce-browser.cjs
node tools/audit-games.cjs --json
# Build from homegamesio, then return to Core:
node scripts/build-site.js
node test/moonbounce-package-browser.cjs
```
