# RTC workers, performance and session files

Implemented and checked locally on October 3, 2026. Nothing in this pass was deployed remotely; the API protocol is unchanged.

## Communication ownership

Each browser host or guest now has one communication worker. A host shares it across all guests. It owns the signaling WebSocket, room heartbeat timer, transferred RTC data channels, outgoing UTF-8 encoding/chunking, incoming chunk reassembly and network queues. The peer connection itself must still be created/negotiated on Window: the [WebRTC specification](https://www.w3.org/TR/webrtc/#rtcdatachannel) exposes transferable data channels to dedicated workers, but exposes RTCPeerConnection on Window.

The canvas and input UI stay on Window. The host's game simulation and Squish frame serialization, and each player's frame/image/audio decoding and video elements, also remain there. This separates communication from rendering; it does not yet isolate the game simulation or make a background/suspended host reliable.

The worker receives fresh per-player snapshot buffers by ownership transfer, avoiding a second copy. Shared assets are copied across the boundary so transferring one player's data cannot detach the host's asset store or another player's buffer. Guest packets are transferred back to Window after assembly.

The existing wire format is unchanged: an application packet header followed by reliable, ordered binary chunks of at most 16 KiB. Old and new clients can use the same protocol. Browsers without channel-transfer support run that same protocol on Window; the signaling worker remains available. An explicit `worker: false` host/guest option selects the fully inline path for diagnosis.

Both directions across the worker boundary permit one posted packet awaiting acknowledgment, plus a queue capped at 20 MiB. Waiting visual snapshots are superseded by the newest snapshot. Assets, input and control messages are retained in order; a partially transmitted packet always completes. Identical consecutive snapshots are suppressed in the network worker. The channel's native send buffer is kept around 64 KiB (plus at most the next chunk/header) rather than the previous 256 KiB threshold.

`await client.getNetworkStats()` reports the actual worker/Window mode per peer, send/receive counts, duplicate snapshots, dropped stale snapshots and queue sizes. `RtcHost.getStats()` exposes the same data for direct Studio integrations. The counters are cumulative, including initialization. They do not measure network latency or FPS.

The worker is embedded in the client bundle, so there is no additional worker deployment asset and downloaded HTML still works from `file://`. Sites with a restrictive CSP need `worker-src blob:`. Closing the session terminates the worker, closes its transports and releases its Blob URL.

## Existing uploads: verified

The existing route is:

1. The player chooses an image, audio file or video on a game's file-input node.
2. InputHandler reads it and sends base64 JSON as normal player input.
3. RTC splits/reassembles that input; the host's shared GameDispatcher turns it back into bytes and supplies filename/MIME/kind metadata to the game's `oninput` callback.
4. Input Test calls its constructor-provided `handleFileUpload(playerId, bytes, meta)` helper, then references the returned asset's `.key` in a normal `GameNode.Asset`.
5. The browser host sends binary asset packets to all guests, including the uploader. Each client decodes the asset and uses it while rendering/playing the scene.
6. The host retains uploaded assets in session memory and sends them to new guests before their first game frame.

No upload bytes go through the signaling API. RTC may use a TURN relay if configured. The host remains responsible for distributing the asset; closing its tab ends the session and its in-memory assets.

Two fixes accompany the tests: Input Test no longer imports unused Node-only `fs`/dictionary modules, and late joins send each historical uploaded asset as its own packet. Several valid uploads must not become one oversized packet merely because a player joins later.

Current boundaries:

- The picker accepts images, audio and video, with a 5 MiB file cap. Oversized images are resized/re-encoded when possible; oversized audio/video is rejected. The upload helper independently enforces 5 MiB; the shared input decoder separately caps received data at 8 MiB.
- Guest uploads still use base64 JSON, adding about one third to the file's byte count before packet headers. This is not an efficient general file-transfer interface yet.
- RTC application packets are limited to 10 MiB; queues are bounded at 20 MiB. A large upload shares the reliable channel with gameplay and can delay frames/inputs. Worker isolation does not remove bandwidth contention.
- Asset rendering understands images, audio, fonts and uploaded video. Video frames repaint the canvas without requiring new game snapshots. Each device plays independently; this is not synchronized playback. Arbitrary PDFs/ZIPs/etc. still need a generic file store and game-facing retrieval/download interface.
- There is no transfer progress, cancellation, resumption or durable file storage. Games decide what to do with uploaded bytes.

## General files and streams: proposed next work

General files fit RTC well: [data channels accept binary buffers and blobs](https://webrtc.org/getting-started/data-channels). Add a binary transfer protocol with an ID, filename/MIME/size, start/chunk/end messages, progress/cancel/error handling, byte limits and lifetime cleanup. Expose a transport-independent session-file handle to games so Core/WebSocket and browser/RTC share behavior. A separate bulk-data channel, owned by the same worker, would prevent a whole file application packet from sitting ahead of gameplay messages; bandwidth scheduling would still matter. Avoid base64 and release completed transfer buffers when the game no longer needs them.

Live microphone/camera tracks are now implemented in the subsequent [live media and Walkie Talkie pass](live-media.md), including permissions, peer renegotiation and forwarding between guests through the host. Screen sharing and custom application streams remain future work. Uploaded audio/video files retain their separate [media upload contract](media-uploads.md).

## Validation and measurements

`test/rtc-worker.cjs` exercises real Chrome peers using an isolated loopback signaling fixture and the actual Input Test game source:

- One worker on each player; the host's multiple channels all run in that one worker; no RTCDataChannel.send calls on Window.
- A guest-selected PNG larger than one RTC chunk reaches the host and another guest with identical bytes and decodes successfully; a late joiner receives the same image.
- A host-selected PCM WAV reaches all players and a late joiner; all four clients decode its expected duration after a user gesture.
- A 2.5-second busy host Window does not interrupt the worker heartbeat. A busy guest Window coalesces waiting snapshots instead of accumulating them.
- Stopping sessions terminates their workers. Inline hosts/guests interoperate with worker peers, including uploads and late joins.

Input Test no longer depends on the external metadata font, so its browser tests do not need a font download or a page-error exception.

`test/media-uploads.cjs` runs the actual Input Test through real Chrome peers over RTC and Core/WebSocket. It generates PNG, WAV, WebM (VP8/Opus) and MP4 (H.264/AAC) fixtures locally, including video sound. It verifies file picking from either player, byte preservation, decode/playback, canvas animation with no new snapshots, late joins, sound unlock, replay, clear and Blob URL cleanup. A guest uses a phone-sized viewport; this does not replace testing a physical phone's browser and codecs. `test/session/MediaUploads.test.js` covers shared classification, registration, player/size checks, replay delivery and autoplay fallback.

Five added session regressions cover duplicate-frame semantics, preserving assets/control/input while coalescing frames, mailbox bounds, signaling failure/retry, unsupported channel transfer and already-open channels, and ownership of shared buffers. The ownership test also covers more than 10 MiB of historical uploads delivered as separate packets. The full focused session suite passes.

Real Chrome Core START_PATH and website acceptance also pass: separate guest origin, phone-sized touch input, both-direction state changes, leave/rejoin, host shutdown, website discovery/privacy/Home, standalone HTML and Studio Share. These are local desktop browser tests, not a measurement on the user's physical phone or cellular network.

A six-second steady-state sample with the same before/after desktop harness showed:

| Scenario | Before | After |
|---|---:|---:|
| Idle Layer Test: guest snapshot deliveries | 376 | 0 |
| Idle Layer Test: guest snapshot bytes | 606,112 | 0 |
| Idle Layer Test: guest redraws | 376 | 0 |
| Idle Layer Test: host main-thread channel sends | 752 | 0 |
| Animated Geom Storm: guest snapshot deliveries | 182 | 182 |
| Animated Geom Storm: host main-thread channel sends | 364 | 0 |

Initial state is delivered before measurement. Idle Layer Test remains visible and responds to input; byte-identical updates no longer trigger needless guest decoding/painting. Geom Storm still changes every tick, so it appropriately continues to send snapshots. Different game runs and desktop load are not controlled enough to claim an FPS gain; actual phone smoothness remains to be checked. CPU-heavy Squish serialization/rendering can still be a bottleneck.

## Trying the changes

The client bundle was rebuilt locally. Refresh/reopen the local host and create a new invitation. Core serves the rebuilt sibling client's `dist/homegames-client.js`; no API redeployment is required for this pass. The local launcher and Core configs now use `START_PATH: null` and `TESTS_ENABLED: true`: restart Homegames, open the dashboard and choose Input Test. It has separate image/audio/video panels, Upload media, replay and clear controls. An optional direct boot still works with `START_PATH: "./src/games/input-test/index.js"` and `START_MODE: "browser"`.

Public guests need the updated website client for the worker and video renderer. Stage the website with `node scripts/prepare-rtc-site.js /tmp/homegames-media-release` from homegamesio and deploy using the existing [EC2/S3 guide](rtc-public-deployment.md). Update the API's download client bundle when releasing new standalone HTML; its signaling code does not change. Existing downloaded files contain their older client until downloaded again. Rebuild the Core runner image if using the Docker/WebSocket fallback: it contains the updated child entry point and shared upload helper.
