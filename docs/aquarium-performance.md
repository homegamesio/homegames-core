# Aquarium as a local/RTC performance fixture

## Current built-in Aquarium — October 17, 2026

The current built-in game now saves and restores progress, uses Squish 1.5.0 and runs at **30 Hz** with the maintainer's approval. The following October 10 record describes an older external checkout; its missing-save warning and default benchmark path no longer describe the built-in game.

The repaired `test/aquarium-rtc-browser.cjs` defaults to `src/games/aquarium`, collects current modules, uses local-only ICE, and exports the actual project identity. Current [launch evidence](review-evidence/aquarium-polish-2026-10-17/README.md) includes source fingerprints, complete timing/network results and phone/offline checks.

| Current scenario | Host updates/sec | Total host application upload |
| --- | ---: | ---: |
| Starter + one RTC guest | 30.2 | 2.30 Mbps |
| 1,000 fish + 400 aliens, one water guest | 30.4 | 3.51 Mbps |
| Same population, one space guest | 30.4 | 3.16 Mbps |
| Same population, seven guests | 30.4 | 23.22 Mbps |

The earlier 60 Hz run in this polish pass used 48.98 Mbps with seven guests. The roughly 53% reduction includes normal scene/randomness variation; these are short desktop loopback samples, not a capacity guarantee. Eight-player host tick p95 was 2.6 ms, serialization p95 5.0 ms and frame preparation p95 2.9 ms. Byte-for-byte per-recipient water/space filtering and guest input/departure checks passed. Traffic excludes transport/network overhead. Phones, weak uplinks, WAN loss and TURN still need acceptance. No runtime/network protocol changes were made in this game pass.

## Historical October 10 measurement

Measured October 10, 2026 using `/Users/josephgarcia/aquarium/index.js` and its
catalog, with the actual browser runtime, renderer and RTC workers. The original
Aquarium repository was read without modification. Nothing was deployed.

Aquarium is a shared incremental aquarium with independent player cameras,
feeding and shops. Five tank tiers lead to space creatures; Horizon monuments
and era resets add longer-term progression. The game targets 60 ticks/sec and
eight players. Behavior updates run at 5 Hz; movement/rendering run each tick.
Spatial grids, per-camera visibility, clustered distant creatures and pooled
detail nodes keep the rendered scene much smaller than the simulated population.

`aquarium-base.js` is an older 30 Hz version; the exported class is in `index.js`.
All visuals are procedural Squish nodes, so this fixture needs no hosted assets.
`exportCheckpoint()` records economy, creatures, accessories and progression, but
the current game does not accept `saveData`, restore a checkpoint or call
`saveGame`. Framework save persistence alone will not resume this game. Wiring
and validating its restore path remains a separate game change.

## Measurements

The benchmark advances directly to tier 4 and fills 1,000 fish + 400 aliens using
the game's own constructors. These are populated scenarios, not an exhaustive
maximum across every world upgrade, zoom, accessory and era combination. Each
sample warms for 1.2 seconds and measures for 4.5 seconds. Times are means.

| Scenario | Total host nodes | Tick | Serialization | Frame preparation | Host render |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starter, solo | 141 | 0.28 ms | 0.82 ms | 0.24 ms | 0.73 ms |
| Populated water, host + RTC guest | 417 | 0.75 ms | 1.50 ms | 0.47 ms | 0.76 ms |
| Populated space, host + RTC guest | 365 | 0.59 ms | 1.52 ms | 0.47 ms | 0.76 ms |
| Populated water, eight players | 1,577 | 1.28 ms | 4.84 ms | 1.34 ms | 0.56 ms |
| After seven guests leave | 206 | 0.71 ms | 1.09 ms | 0.29 ms | 0.97 ms |

All measured scenarios sustained about 62 updates/sec in headless Chrome (the
existing nominal 60 Hz timer runs near 62.5 Hz here). This is measured game/render
work frequency, not a physical display refresh guarantee. Eight-player tick p95
was 2.4 ms; serialization p95 5.7 ms; frame preparation p95 1.7 ms. Guest rendering
averaged approximately 0.9 ms. RTC guest feeding reached the host and leaving players
released their scene trees. No game source/assets were fetched by guests.

Frame preparation previously flattened every Squish snapshot into an intermediate
JavaScript number array before copying it into bytes. `session-runtime.js` now
copies node records directly into the final typed buffer. In adjacent eight-player
runs this reduced mean preparation from 2.23 ms to 1.34–1.37 ms (about 40%). Random game
placement and machine load vary between runs; this is not a universal speedup.
Exact frame bytes, inherited visibility, sound settings and all supported tested
Squish versions retain regression coverage. The old expression remains commented.

Each guest receives a complete snapshot of **its own current view** every update,
not the host's combined scene graph or the entire simulated world. Aquarium builds
a camera-specific subtree with `playerIds: [player.id]`, and the shared RTC/Core
frame boundary includes only that subtree and shared root nodes. The total host
node counts above combine all players' view subtrees; they are not per-guest
payload counts. Populated two-player water used about
7.3 Mbps of application traffic per guest, and eight-player water about 49 Mbps
total host upload for seven guests. The copy optimization does not reduce that
traffic. Wire counters include application headers, not SCTP/DTLS/IP overhead.
Steady-state send queues stayed empty on loopback. WAN, packet loss, constrained
upload, TURN, phones and long-running memory behavior are not validated by this
desktop test. Bandwidth/adaptive snapshot sending is the next performance target;
the current change preserves visual rate and protocol compatibility.

The benchmark also records `frameNodes`/`frameBytes` for each received player
frame separately from `nodes` (the combined host tree). Its visibility regression
places alternating players underwater and in space, compares every received RTC
frame byte-for-byte with only that player's subtree plus the shared root, then
swaps their cameras and repeats. Space views must detach offscreen fish slots.
The eight-player visibility run passed both camera arrangements: the host held
1,581 combined nodes, while each received frame contained only 196 space-view
nodes or 201 water-view nodes (approximately 14 KB). No water fish slots remained
in space views. This validates recipient filtering on actual received RTC bytes,
not merely a canvas that hides other players' data after receiving it.

## Reproduce and play

Build `homegames-client`, then run `node test/aquarium-rtc-browser.cjs` from Core.
Point `PLAYWRIGHT_MODULE` and `CHROME_PATH` at installed Playwright/Chrome if needed.
Optional settings: `AQUARIUM_PATH`, `AQUARIUM_RESULTS`, `AQUARIUM_SAMPLE_MS`, and
`AQUARIUM_MAX_PLAYERS=2`. A local signaling fixture is created and closed by the
test; the ordinary ICE configuration may use public STUN. Production signaling,
accounts and content services are not used.

The output directory contains `results.json` with source SHA-256, Chrome version,
per-player timing distributions and network counters; host/guest screenshots;
`aquarium.zip` for Studio Import ZIP; and an isolated `aquarium.html` player.
The packaged source is uninstrumented and starts normally. The benchmark's direct
progression and timing probes exist only in the test harness. The standalone QR
uses the configured public website/signaling defaults; manual connection is
available for local testing before website deployment.
