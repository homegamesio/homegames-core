# City Scanner revival

Restored the installed City Scanner source to `src/games/city-scanner`, retaining its deterministic world, polygon artwork, day/night cycle and ambient interactions. The installed version and its GPL license are preserved; the game is now editable alongside the built-in source games. The catalog called it City Scanner, but its metadata called it City Commons: Living Detail; the working version uses City Scanner consistently.

## What went wrong

- The original encoded 3,211 shapes every tick, including inactive and offscreen pool objects, at 60 ticks per second. Encoding alone exceeded the 16.7 ms frame budget on this machine.
- `hide()` erased fill and opacity. Most render methods restored only fill, leaving buildings and actors invisible after they reentered the view.
- Unclipped world polygons stretched well outside the viewport; byte-encoded negative coordinates were especially fragile across Squish versions.
- There were no explanations for the clickable parts of the city. Some actions had little visible response: taxis spawned at random places and coffee customers ignored the requested cafe.
- Buses could stop repeatedly at the same stop, and pedestrians could route through the lake.
- Keyboard state was global, so a player releasing a key or disconnecting could interrupt everyone else's input.
- A separate client problem dropped mouse clicks and ordinary touch taps that began and ended between animation frames.

## What changed

The game keeps its full object pools privately, clips polygons and publishes only visible nodes in their original painter order. Node IDs stay stable. Static scenery is reused until the camera or lighting changes. The simulation runs at 30 ticks per second with unchanged motion speeds; a paused, stationary city emits no new frames.

Five labeled neighborhood buttons, contextual hints, click feedback, keyboard shortcuts and Pause/Play make the interactions discoverable. The header and footer have dedicated space so traffic remains visible. Mouse presses trigger an action once, rapid events are limited per player, and keyboard state is tracked separately for each participant. Eight people share the camera deliberately; independent cameras would be a separate design change.

Coffee customers use the selected cafe, taxis arrive near the click, buses detect crossings and leave their stops, and pedestrian routes avoid the water. Fish and boats remain visible at both ends of the lake. The shared client's release handlers now deliver an unsent quick press before its release, without duplicating a press already handled during an animation frame. The client bundle was rebuilt locally.

## Measured performance

Run `node tools/city-scanner/benchmark.js` from the core repository. It manually advances the real game and runs the real Squish encoder for two simulated seconds each at the lake, downtown, east side, and back at the lake. It neither starts a session timer nor mocks the encoder. Pass an optional source directory to measure another version; an installed source outside the repository may require `NODE_PATH` pointing at core's `node_modules`.

Local Node 18 measurements on September 17, 2026:

| Measure | Installed original | Revised |
| --- | ---: | ---: |
| Shapes per frame | 3,211 | 387–492 |
| Scene bytes per frame | 208–211 KB | 25–32 KB |
| Encoding time per frame | 21.8–22.7 ms | 2.6–3.7 ms |
| Scene bytes per simulated second | 12.5–12.7 MB | 0.75–0.96 MB |
| Tick rate | 60 | 30 |

That is approximately 92–94% less scene data in these scenes. These are uncompressed payload and local CPU measurements, not measured network throughput or guarantees for every device. Dense interaction bursts cost more than the idle scenes, but entity pools remain bounded.

## Verification

`node testRunner.js ./test/games/CityScanner.test.js ./test/QuickPointerInput.test.js`

Seventeen focused checks cover valid byte-encoded geometry at every neighborhood and zoom, returning pooled objects, hidden-node omission, actual input dispatch, held presses, pause/idle notifications, multiplayer key isolation, bounded event rates, cafe and taxi placement, bus departures, water avoidance, lake-edge visibility, and a five-minute simulated tour with repeated interactions. Quick-click checks drive real input handlers into the game for mouse/touch, including duplicate, cancellation and spectator cases.

The existing classics and gamepad checks also pass when run together with these tests (57 checks total). Browser checks used the actual local-play client: quick neighborhood clicks, cafe feedback, pause plus navigation, and a phone-sized landscape viewport. The phone view works but its captions are small; desktop/tablet is the stronger experience. Screen-reader scene descriptions and an actual remote multiplayer load test remain outside this pass.

## Preview

Run `node tools/city-scanner/preview.js`, then open `http://127.0.0.1:9877/?localGame=city-scanner`. Reload through that URL to pick up source edits. This uses core's normal local-play loader and current client bundle. The revived game has not been published or substituted for the installed catalog version.
