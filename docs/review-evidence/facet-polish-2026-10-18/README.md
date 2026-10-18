# Facet polish — October 18, 2026

The description is exactly **Match jewels and gems to make them go away**. Joseph Garcia chose to retain realm/stage/achievement names, simplify remaining decorative text, enlarge controls with a landscape recommendation, and keep one unfinished game with confirmation before replacing it.

## Changes

- Cancelled/replaced pointer captures no longer select or swap gems. Invalid releases cancel safely, and keyboard/controller selection cancels an older pointer gesture. Invalid player identifiers cannot claim the solo seat.
- Rush follows elapsed active time at slow tick rates. Pause, Help and automatic reshuffling stop its clock. Animation catch-up is capped at 250 ms after a long stall, but active Rush time still elapses. An input arriving after the deadline cannot make a new swap or accidentally turn the newly appeared results screen into a retry. Disconnect accounts for time before pausing and saves that checkpoint.
- Imported saves restore only a jewel's type and special, keeping generated identity, position, visibility and animation state intact. Unchecked save properties could previously make jewels disappear or move off the board.
- Stable boards still save after every completed move. Closing during a cascade resumes from the preceding completed move. Starting another mode or retrying an unfinished board now asks before replacing the one saved game; cancelling preserves it. Failed saves stay visible with an accessible Retry save control. Unchanged snapshots deduplicate, completion status follows the newest write, and close submits the latest stable snapshot before returning.
- Factual goals/controls replace decorative copy; existing names, artwork and music remain. Buttons/HUD labels are larger, home/pause recommend landscape, and the 12 achievements occupy two pages. The home screen displays the game title, and the page counter has a dark background for contrast.
- Paused/help/confirmation scenes and static Journey/Collection menus avoid redundant geometry work. Hover, focus, save feedback and independent audio transitions still update; audio stops immediately on pause. The simulation still uses fixed 120 Hz steps with 30 Hz scheduled updates.
- Developer preview and offline builder use the current portable loader, including JSON artwork modules and valid, separate preview save profiles. The thumbnail is a real 960×600 browser capture of the opening board.

## Verification

| Check | Result |
| --- | --- |
| Facet regressions | **67 passed**: 50 engine/adapter/scene/sound/playthrough checks and 17 new launch regressions. Legal recorded solutions complete all 30 Journey stages without editing gems or adding resources. |
| Existing scope/catalog checks | **55 passed**. Total **122**. |
| Real client | Ordinary mouse drag completes the first Journey stage; audio playback/pause silence, Help, replacement cancellation, save failure/recovery and phone layouts pass. A natural Rush lasted **120,027 ms of active wall time**, excluding an explicit pause. Later realms/full collection are explicitly seeded visual fixtures. No browser errors or external HTTP requests. |
| Built website and downloaded HTML | Both pass ordinary touch drags/tap swaps, first-stage completion, exact stable-board/refill-state recovery after reload, subsequent legal play, saved medals/statistics/preferences, Help and phone text bounds. The downloaded HTML passes with the browser network disabled. No game, clock or storage injection; no browser errors or external requests. |
| Website and audit | **32 games / 12 featured** build; selected games have no audit issues or external dependencies. |

Final built revision: `4fb80f582a29437e65cbad52764ed73ce05c93b4124f81cfc1773955c55504cb`.

Source fingerprints, logs, screenshot captures and measurements accompany this record. The source-browser timing/gameplay run preceded only the home title and page-counter background additions; final scene tests and the built-package browser check cover those visual changes. The packaged and offline runs each earned three stars and 7,000 points on the first stage, restored the next stage at 300 points, and continued to 3,600 points without double-counting moves. No package publication, deployment or shared-runtime changes occurred.

## Performance and remaining limits

Three images total **6,642,921 bytes** and 55 generated audio buffers total **6,966,426 bytes** (**13,609,347 bytes** raw media, before archive/encoding overhead). The actual Common/Squish diagnostic covers 36 scenarios across three realms and Journey/Zen/Rush, with a one-second warmup and four measured seconds per scene.

Active scenes model **9.595–11.757 Mbps for one remote self-hosted player**, excluding transport overhead. Browser-local solo play requires no remote frame upload. The largest sampled frame is **54,178 bytes** with no pool overflow. Active tick-plus-frame p95 was **2.1–2.7 ms** on this desktop Node 24 run. Paused scenes and static menus emit no redundant frames; music/effect transitions notify the codec independently. Baseline/final timings are local diagnostics, not a controlled EC2/mobile capacity result.

Physical-phone aiming comfort, Journey difficulty, Zen appeal and real-player enjoyment remain acceptance gates. Portrait still has a small board; landscape is the intended phone orientation. Remote self-hosted bandwidth, final native artifacts and constrained-network behavior remain unaccepted. Recorded solutions establish winnability, not audience enjoyment. Long host stalls skip animation work beyond the catch-up cap while Rush consumes active elapsed time.

## Reproduce

Use Node 24. Browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH` and need Chrome plus permission to listen on loopback.

```sh
node --test test/games/FacetLaunch.test.cjs
node testRunner.js ./test/games/FacetEngine.test.js ./test/games/Facet.test.js ./test/games/FacetPlaythroughs.test.js ./test/games/FacetScene.test.js ./test/games/FacetSound.test.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/facet-performance.cjs
node test/facet-browser.cjs
node tools/audit-games.cjs --json
# Build from homegamesio, then return to Core:
node scripts/build-site.js
node test/facet-package-browser.cjs
```
