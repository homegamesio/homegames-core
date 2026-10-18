# Fleetfall polish — October 18, 2026

The catalog description is exactly **Conquer the galaxy and guide your dudes**. Joseph Garcia chose fresh matches with the selected map remembered, six simultaneous flight panels with larger labels and landscape guidance, immediate solo defeat after losing the last planet and fleet, and spectating until the next match for rejoining players.

## Changes

- Map selection saves a validated `{schema: 1, mapId}` preference. Reloading opens a fresh lobby. Failed writes show a host-only retry control; completion status follows the newest write, and closing submits the current preference synchronously. No running match is saved.
- Solo elimination stops the simulation and offers **Play again**. A surviving fleet can still capture a planet, so losing the last planet alone does not end the run. Eliminated multiplayer commanders keep spectating.
- Cancelled releases and keyboard transitions cannot turn a stale pointer gesture into an unintended launch. Invalid identities cannot claim the host seat, unknown keys cannot grow held state, and late callbacks after close are inert. Only the host can choose the map/start/replay/retry saves; private scenes and flight controls remain scoped to their commander.
- A real six-player RTC run exposed reused transport IDs taking over departed factions. Disconnect now gives the AI faction a distinct negative ID and transfers its planets, flights, event ownership and result references. A new or returning connection spectates, even when assigned the old seat or name. AI preserves the original faction color. Leaving an empty room resets it.
- Simulation follows elapsed time with fixed 30 Hz steps and a 100 ms catch-up cap. Long stalls pause excess simulation time. Idle lobbies/results avoid repeated drawing. Decorative star, ring and flight-trail geometry is reduced; all six panels remain.
- Lobby, map, fleet and score labels are larger. The lobby recommends landscape and larger screens. Save errors occupy the control-hint space without overlapping the title. The thumbnail is a real 960×600 portable-client capture of the first Orbit flight.
- **Unpublished Client fix:** after a toolbar action, a canvas touch now moves DOM focus into the game as well as activating game input. Previously, Space could reopen the still-focused More button instead of firing. This requires a new Client release and consumer rebuild; the final candidate package check uses `HOMEGAMES_CLIENT_BUNDLE`, without replacing registry installs or changing version pins.

## Verification

| Check | Result and scope |
| --- | --- |
| Fleetfall regressions | **38 passed**: 21 existing engine/adapter/frame checks and 17 launch/save/timing/disconnect checks. Includes six players/36 flights, ownership filtering, all maps, arrival/crossing/shot behavior, solo defeat/replay and retired-seat reuse. |
| Client focus regression | **1 passed** against the local source candidate. The same regression fails against published Client 0.2.0, establishing the release gap. |
| Shared scope/catalog regressions | **55 passed** in the final run. An earlier run had two failures for the new Home Run game’s missing thumbnail/inventory entry. Those files were supplied elsewhere in the workspace during this pass; no Home Run changes were made here. |
| Source Chrome | All maps, ordinary keyboard/pointer input, 1/2/6 flight panels, shooting/destruction, arrivals, phone layouts, transport-backed second-seat crossings, defeat/replay and save retry. The clock is explicitly controlled and some resource/hazard/results/storage scenarios are fixtures; this is not a natural full playthrough. |
| Real RTC Chrome | Six separate participants, normal elapsed time/resources, real touch launches and opposing-route crossings, guest steering/firing, host-only map selection, AI takeover, reused-seat spectating and scene cleanup. Local direct RTC; no STUN/TURN or WAN. |
| Candidate website and downloaded HTML | Normal touch map selection, saved-map restoration, launch/flight/capture, fresh-match reload, phone text bounds, and touch-to-keyboard focus. Downloaded HTML runs with browser networking disabled. Saves are read through Download save; no game, clock or storage hooks. |
| Build/audit | The full current website builds **33 games / 12 featured**, including the newly added Home Run, with no selected-game audit issues or external dependencies. The earlier isolated acceptance build used the reviewed 32-game selection. Final Fleetfall metadata, Client bundle and game shell are byte-identical to that tested build. Home Run itself was not polished in this pass. |

Game revision: `fe7d8150de2a514641343081a63e59e3895571698af5f03965b082bf2d7eb1c5`.

The final total is **94 targeted checks** (38 Fleetfall, 1 Client, 55 scope/catalog), plus browser acceptance. Logs, screenshots, source hashes, build identity and payload measurements accompany this record. The initial full build correctly preserved the previous site when Home Run lacked a thumbnail; after its files appeared, the final full build replaced the local generated website successfully. The source browser and initial RTC checks used published Client 0.2.0; final package and repeated six-player RTC acceptance use the locally rebuilt focus-fix candidate. An initial source-browser defeat fixture advanced only one synthetic tick at an epoch-sized timestamp; floating-point precision kept it just below one simulation step. Advancing two ticks fixed the fixture. Reviewing the first package screenshots exposed the toolbar focus defect despite its gameplay/capture assertions passing; the added assertion specifically rejects that failure.

## Performance and remaining acceptance

The deterministic diagnostic uses the installed Common/Squish runtime across four maps with one, two and six players. Each human starts six legal flights from a seeded 120-ship home, with one second of warmup and four measured seconds. It records actual private-frame bytes, excluding startup and network overhead. At six players/36 flights, host upload to five guests models **27.155–29.729 Mbps**, versus **31.307–33.939 Mbps** before decorative pruning. Maximum sampled per-player frame is **25,450 bytes**. Desktop Node 24 tick/serialization/frame p95 is **8.098–11.817 ms** for six-player scenarios. Timing varies with concurrent desktop work; no controlled CPU-speedup claim is made. Browser-local solo play has no remote frame upload; a remote self-hosted player still needs roughly 5 Mbps in these busy scenes.

The real six-player direct-RTC run with one normal flight per commander recorded about **18.88 Mbps** in the client's aggregate wire-byte counters over four seconds. These counters are not a packet capture and exclude lower-layer overhead. No sampled application queue backlog remained. This does not establish EC2, TURN, WAN or physical-phone capacity.

Accelerated engine-only pacing diagnostics use the existing AI helpers to drive the human seat with ordinary initial resources. Orbit, Rift and Belt reach solo defeat at approximately 132, 153 and 362 simulated seconds. Binary is still running at the 20-minute cap. This indicates a pacing case for human review, not human difficulty or completion-time estimates. Full natural wins, sustained real-group play, physical-phone readability/piloting and repeat-play enjoyment remain acceptance gates. Portrait is cramped; landscape is the intended phone orientation. Final native/container outputs and constrained-network/TURN acceptance remain open.

No publication or deployment occurred. Before release, publish the Client focus fix, pin consumers, regenerate artifacts and repeat release acceptance against those published versions.

## Reproduce

Use Node 24, Playwright and Chrome. Browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH` and need loopback access.

```sh
node --test test/games/Fleetfall.test.cjs test/games/FleetfallLaunch.test.cjs
node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/fleetfall-performance.cjs
node tools/fleetfall-simulations.cjs
node test/fleetfall-browser.cjs
node test/fleetfall-rtc-browser.cjs
node tools/audit-games.cjs --json
# From homegames-client:
node --test test/touch-focus.test.cjs
npm run build
# From Core, use absolute paths in the environment overrides:
HOMEGAMES_CLIENT_BUNDLE=/path/to/homegames-client/dist/homegames-client.js node docs/review-evidence/fleetfall-polish-2026-10-18/build-reviewed-site.cjs
HOMEGAMES_SITE_DIR=/tmp/homegames-fleetfall-reviewed-site node test/fleetfall-package-browser.cjs
```
