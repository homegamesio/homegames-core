# Tumble Tower polish — October 18, 2026

The catalog description is exactly **Set up the blocks and knock them over**. Joseph Garcia chose automatic retention of the latest custom design and sound setting, factual feedback, larger labels and a landscape recommendation for phones.

## Changes

- Custom builds save after placing a block, settling, starting play and leaving the session. The **your build** choice recalls the saved layout; switching presets preserves it. PLAY records the rebuild blueprint, so demolition does not overwrite the design. Clear intentionally empties it. Reloading starts at the ready-to-play tower with the remembered design available in its tray button. Saves contain validated positions, dimensions, rotations and colors, not live projectiles, velocities or solver properties.
- Failed saves show a working retry control. Unchanged snapshots do not write every tick, completion status follows the newest write, and close submits the latest building snapshot synchronously before returning. The platform owns storage ordering and coalescing.
- Cancelled or replaced tool drags cannot trigger a later throw/drop. Keyboard, controller, reset and preset changes invalidate old drags without turning repeated held packets into new input. Cancelling a visible aim marker clears it even on a sleeping scene. Invalid player IDs cannot claim the solo seat, extra players cannot control it, and closed games remain inert.
- Controller directions now use the current Homepad names. D-pad/left stick aim, shoulders select tools, Start begins custom play and Select cycles presets. Existing face-button actions remain. Real normalized controller states are exercised through Homepad and GameDispatcher; physical-controller comfort remains a human check.
- Sleeping blocks wake when a supporting ball expires or is replaced. Otherwise a block could remain suspended over the missing ball indefinitely. Unrelated sleeping structures stay asleep.
- Simulation follows elapsed time with fixed 120 Hz physics substeps and a 100 ms catch-up cap. Rejoining does not simulate time spent absent. A long host stall pauses excess simulation time. Settled scenes avoid redundant drawing; audio retirement still updates independently.
- Factual feedback replaces decorative messages, labels are larger, and the stage recommends landscape on phones. The thumbnail is a real 960×600 portable-client capture of the opening preset.

## Verification

| Check | Result and limit |
| --- | --- |
| Game and integration regressions | **86 passed**: 31 Tumble Tower adapter/physics/audio/structure checks and 55 existing scope/catalog checks. Includes all three physical presets, eleven-domino propagation, all three projectile types, free building, repeated destruction and bounded scene/body/voice counts. |
| Launch and save regressions | **33 passed**: 22 input/timing/controller/idle-render checks and 11 persistence checks. Total **119**. |
| Source browser | Ordinary mouse drag, keyboard construction and touch inputs exercise all presets, custom building, demolition/rebuild, audio/mute and phone layouts. Exact custom blueprint and sound preference survive a reload. The standalone developer-preview storage debounce is awaited explicitly. Save failure/retry is a clearly injected storage-failure fixture. No browser errors or external HTTP requests. |
| Built website and downloaded HTML | Both pass ordinary touch drags/taps, all three presets, three-block custom construction, destruction/rebuild, exact saved blueprint and sound restoration after normal reload, further play with the restored design, and persisted Clear. Downloaded HTML passes with browser networking disabled. Saves are inspected through the public Download save action; no game, clock or storage hooks are injected. No browser errors or external requests. |
| Website and audit | **32 games / 12 featured** build. No selected-game audit issues or external dependencies. |

Final built revision: `48781369959db2bcabcecf3a24be64d47f0224ee0ea601ffcd00dc6557238854`.

Source hashes, logs, screenshots and measurements accompany this record. The source-browser run preceded only the singular “1 block” label correction; final packaged acceptance covers that revision. An initial package harness run tapped before the resized canvas finished updating; waiting for the resize before input resolved that harness race. The final run passed both website and offline paths. No package publication, deployment or shared-runtime changes occurred.

## Performance and remaining acceptance

The diagnostic uses the actual Common/Squish runtime for eight scenarios: tower, bridge, dominoes and a custom 24-brick design, each idle and active. It models **4.225–4.921 Mbps for one remote self-hosted player**, excluding transport overhead. Browser-local solo play requires no remote frame upload. The maximum sampled frame was **21,032 bytes**, with at most **28 bodies**; desktop Node 24 tick-plus-frame p95 was **1.548–3.329 ms** in active scenes. Idle scenes emitted no redundant frames. Thirty generated audio assets total **423,812 bytes**. These are local diagnostics, not mobile or EC2 capacity results.

The earlier exploratory custom performance fixture used different block dimensions; no controlled before/after speedup is claimed. The final fixture uses selectable 17×6 bricks, and the diagnostic verifies source hashes remain unchanged during measurement.

Physical-phone aiming and construction comfort, physical controllers, repeat-play appeal and real-player enjoyment remain human acceptance gates. Portrait has a small stage; landscape is the intended phone orientation. Sustained remote self-hosted bandwidth, constrained networks/TURN and final native artifacts remain unaccepted. Automated destruction and restoration establish functioning mechanics, not audience enjoyment.

## Reproduce

Use Node 24. Browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH` and require Chrome plus permission to listen on loopback.

```sh
node --test test/games/TumbleTowerLaunch.test.cjs test/games/TumbleTowerSave.test.cjs
node testRunner.js ./test/games/TumbleTower.test.js ./test/games/TumbleTowerPhysics.test.js ./test/games/TumbleTowerAudio.test.js ./test/games/TumbleTowerStructures.test.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/tumble-tower-performance.cjs
node test/tumble-tower-browser.cjs
node tools/audit-games.cjs --json
# Build from homegamesio, then return to Core:
node scripts/build-site.js
node test/tumble-tower-package-browser.cjs
```
