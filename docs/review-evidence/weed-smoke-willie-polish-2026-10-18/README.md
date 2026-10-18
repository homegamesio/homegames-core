# Weed Smoke Willie polish — October 18, 2026

Joseph Garcia supplied the catalog description **Supply your underwater customers with what they need** and chose ten-minute maximum runs, a saved best total with fresh sessions, and a $50,000 third-tier threshold. The second tier remains $5,000. Original character artwork, music, game identity, base prices, combo rules and the existing death message remain.

## Changes

- Runs start on the first gameplay input, end at ten minutes of wall time or bankruptcy, and offer **Play again**. Tier three continues instead of advancing into missing fourth-tier artwork at $1 million. The result shows total sales and the best total; starting cash and costs are excluded from the score.
- Validated saves contain `{schema:1,bestTotal,sound}` only. New records save during play, reload starts fresh, and failed writes expose a retry action. Older completion callbacks cannot replace the latest write status. Closing submits the latest record synchronously.
- Added visible left/drop/right controls, sound toggle, timer, result/replay, readable score spacing and small status backgrounds. The original full-screen control thirds remain; portrait is supported but landscape is recommended. The thumbnail is a real portable-client capture.
- Keyboard, normalized controller and pointer inputs use current shared bindings, solo ownership checks, bounded held-key state and cancellation handling. Sliding touch works without stale releases or keyboard/controller state overwriting each other. The original controller secret sequence remains.
- Replaced per-entity precomputed paths with bounded velocity-based movement. Fixed edge departures, one drop marking multiple customers served, stale combo labels, incorrect boat/load tier artwork, and one-direction-only vertical movement. Simulation uses fixed 60 Hz steps with at most 100 ms catch-up; the ten-minute deadline still expires after a long suspension.
- Buying more supplies while already in debt is blocked. Existing supplies may still rescue the run with a sale; holding Drop can no longer defer bankruptcy indefinitely. Idle ready/result screens emit no repeated game frames.

## Verification

| Check | Result and limits |
| --- | --- |
| Game regressions | **19 passed**: ownership/capacity, shared controller/keyboard disconnect behavior, cancelled/held/sliding pointers, unknown/late input, 10/30/60 Hz timing, exact deadline after a stall, replay, all tiers, collisions, debt rescue, save/retry/reload/close and idle frame behavior. |
| Shared scope/catalog | **55 passed**; **74 targeted checks total**. This is not a full Core suite run. |
| Source Chrome | Ordinary keyboard/touch and audible-context activation; desktop/landscape/portrait text bounds including glyph ascent/descent. Explicit fixtures cover later artwork, time-up, bankruptcy, higher saved score, reload and failed-save retry. Screenshots were visually inspected. |
| Built website and offline HTML | Ordinary touch and keyboard inputs earn a sale; the public Download save action confirms best score and sound persistence. Reload opens at $100 / zero total / 10:00. Downloaded HTML repeats this with browser networking disabled. No game, clock or storage injection. No page errors or unexpected external requests. |
| Pacing diagnostic | Six seeded, accelerated 600-second runs use ordinary initial resources and predictive movement/drop controls. All reach tier three in **159–345 seconds**, continue beyond $1 million, and finish the ten-minute diagnostic without bankruptcy. This is automated aiming, not a human completion-time estimate. Before the approved threshold change, none of the same six reached tier three. |
| Build/audit | **33 games / 12 featured**; selected games have no audit issues. Packaged Willie source/assets match the reviewed directory, and its tested revision is recorded in `build-identity.json`. |

## Performance and remaining acceptance

Actual installed Common/Squish serialization at 60 Hz measured ten seconds after a one-second warmup for each of three explicit tier/$1m fixtures holding Drop. Maximum scene size was **48 records / 4,193 bytes**, with **0.263–0.291 ms** desktop Node 24 tick/serialization p95 and zero idle frames. A remote self-hosted solo player models approximately **1.91 Mbps** before transport overhead. Browser-local solo play sends no game-frame network upload. These are desktop diagnostics, not EC2 or phone capacity measurements.

The preserved media keeps the game ZIP at approximately **10.88 MiB**. Cold loading on slow links still needs acceptance; the package test waits for the opening images to draw while the run remains idle. Physical phones/controllers, natural full ten-minute sessions and repeated human play are outstanding. The existing music remains a single playback rather than a newly authored loop.

The candidate website uses the **unpublished Client touch-focus fix** from the Fleetfall pass through `HOMEGAMES_CLIENT_BUNDLE`. Published Client 0.2.0 remains unchanged. Publish the new Client, update consumer pins and rebuild final release artifacts before release acceptance. No packages were published, no production service was changed, and no commit was made in this pass.

## Reproduce

Use Node 24, Playwright and Chrome; browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH` and require loopback access.

```sh
node --test test/games/WeedSmokeWillie.test.cjs
node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/willie-simulations.cjs
node tools/willie-performance.cjs
node tools/audit-games.cjs --json
HOMEGAMES_CLIENT_BUNDLE=/absolute/path/to/homegames-client/dist/homegames-client.js node test/willie-browser.cjs
# Build from the homegamesio directory:
HOMEGAMES_CLIENT_BUNDLE=/absolute/path/to/homegames-client/dist/homegames-client.js node scripts/build-site.js
# Back in Core:
node test/willie-package-browser.cjs
```
