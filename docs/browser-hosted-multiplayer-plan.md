# Homegames browser hosting and shared session architecture

Implementation brief · September 28, 2026

## 1. Objective and status

Make the player's browser the default host for games launched from homegames.io. Keep homegames-core as a supported, self-hosted WebSocket host. Both hosts should use the same game session engine so features and fixes continue to apply to both.

The operational goal is to shut down the public homegames-core and Homenames instances currently used by homegames.io. The public platform continues to provide the website, game discovery, source and asset delivery, room discovery, signaling, and optional TURN relay capacity. It stops running ordinary public game sessions.

This document incorporates the user's decisions following the September 24 handoff. It is a design and implementation plan, not a record of an implemented RTC system. No runtime code, configuration, services, infrastructure, or deployed systems were changed to produce it. Suggested module names, API paths, and timing values below are proposals.

For tonight, read the [shared engine design](#5-shared-engine-the-main-refactor), [implementation sequence](#17-implementation-sequence), and [starting instructions](#18-starting-tonight) first. The [API contract](#8-proposed-api-and-signaling-contract), [validation matrix](#19-validation-matrix), and [retirement checklist](#20-public-hosting-retirement-checklist) define the larger target. A [copyable implementation prompt](#21-copyable-prompt-for-the-implementation-session) is at the end.

### Decisions already made

- Browser hosting is the normal public play path.
- Core/WebSocket remains a first-class self-hosted option, maintained through shared session code and shared verification.
- A room is the API's discoverable record of a session running in a browser. The host registers it and sends heartbeats.
- The existing API may own rooms and signaling. A separate signaling deployment is unnecessary initially.
- homegames.link may provide friendly invitation URLs while retaining its current local-instance discovery behavior.
- Preserve the familiar flow: choose a game, Play, open a game window, then invite friends through surrounding Homegames controls.
- Support multiple guests and guest refresh/reconnection while the host survives.
- Public room discovery and multiplayer Studio previews are part of parity, not optional afterthoughts.
- Remove pinned-session functionality. A browser session remains running while its host runs it.
- Retire contentGenerator and game features that depend on that service. Do not build browser service adapters for it now.
- Session migration, host election, transferring games to Core, and restoring a game after host refresh are out of scope.
- Local Squish alias/version differences are intentional development practices. Do not turn this work into an alias-cleanup project.
- Broad pre-existing bug cleanup is deferred. Record unrelated findings and keep the implementation focused on session sharing and the new hosting path.

### What “API is discovery” means here

The API supplies the information needed to find games and connect players. It can also serve existing game packages and assets. Room records and signaling messages are coordination data; they are not game simulation.

Existing authoring, accounts, publishing, and other independent API features remain separate concerns. This project does not remove Studio accounts, Forgejo, publish validation, documentation assistance, or AI authoring simply because public game execution moves into browsers.

## 2. Target architecture

~~~mermaid
flowchart TB
    WEB["homegames.io: catalog, Play, Join, Studio"]
    API["API: catalog/packages, rooms, heartbeats, signaling, ICE credentials"]
    HOST["Host browser: shared session engine + local view"]
    GUEST["Guest browsers: shared client renderer and input"]
    TURN["STUN/TURN service"]
    CORE["Self-hosted Core: same session engine"]
    WSCLIENT["Browsers connected to Core"]
    WEB --> API
    API -->|"source / assets"| HOST
    API -->|"assets / game metadata"| GUEST
    HOST <-->|"room registration / signaling"| API
    GUEST <-->|"join / signaling"| API
    HOST <-->|"RTC inputs and scoped scenes"| GUEST
    HOST <-->|"relay when needed"| TURN
    TURN <--> GUEST
    CORE <-->|"WebSocket inputs and scoped scenes"| WSCLIENT
~~~

There is one authoritative simulation per game session. A browser host runs it for RTC play; a Node process runs it for Core play. Guests render the view assigned to them and send input. Guests do not execute a second simulation.

Squish remains the scene format. This is serialized shapes, text, images, audio references, and interaction information, not video streaming.

The room API does not need game classes, a Squisher, per-frame updates, game saves, or a process/port allocation for each room. Registering 100 rooms means tracking 100 live hosts, not starting 100 game processes.

## 3. Current foundation and entry points

The existing code already separates several concerns. Extend those boundaries rather than replacing them wholesale.

| Existing component | What to reuse |
| --- | --- |
| [LocalSession](/Users/josephgarcia/homegames/homegames-client/src/local-session.js) | Browser construction, saves, player views, frame capture, inspector, lifecycle |
| [Local runtime](/Users/josephgarcia/homegames/homegames-client/src/local-game-runtime.js) | Explicit tick ownership, including support for older Squish constructors |
| [GameSession](/Users/josephgarcia/homegames/homegames-common/game-session.js) | Membership, spectators, frame delivery, framed hosting, save messages |
| [GameDispatcher](/Users/josephgarcia/homegames/homegames-common/game-dispatch.js) | Shared game-facing input semantics |
| [GameInput](/Users/josephgarcia/homegames/homegames-common/game-input.js) | Keyboard and controller state |
| [GameView and FrameLoop](/Users/josephgarcia/homegames/homegames-client/src/game-view.js) | Canvas, renderer, input, assets, rendering lifecycle |
| [SessionController](/Users/josephgarcia/homegames/homegames-client/src/session-controller.js) | Cancellation and ownership during session transitions |
| [Local loader](/Users/josephgarcia/homegames/homegames-client/src/local-game-loader.js) | Manifest and asset loading with explicit game/version identity |
| [Browser client](/Users/josephgarcia/homegames/homegames-client/src/index.js) | Existing protocol dispatch, rendering, WebSocket client behavior |
| [Local controls](/Users/josephgarcia/homegames/homegames-client/src/local-game-chrome.js) | Home button and title outside the game |
| [Prior session refactor](/Users/josephgarcia/homegames/homegames-core/docs/session-refactor.md) | Existing ownership decisions and regression coverage |

Current public hosted creation passes a published game reference from the API to Homenames. Core downloads the source and starts a child. The API does not stage the game archive on that path.

The public local-play page already downloads a manifest/assets and creates LocalSession. Studio already runs local previews using that runtime. These are the two browser-host entry points.

Current local extra players are simulated views in DOM containers. They are a useful starting point for membership, but a remote participant must not need a hidden canvas on the host.

## 4. Feature parity and intentional removals

| Capability | Browser/RTC target | Core/WebSocket target |
| --- | --- | --- |
| Game hooks, ticking, input semantics | Shared engine | Same engine |
| Per-player scenes and private views | Shared frame selection; RTC delivery | Same selection; WebSocket delivery |
| Keyboard, pointer, touch, gamepad | Existing browser input | Same browser input |
| Player names and settings | Preferences in browser; host applies changes | Node host applies equivalent changes |
| Spectate and join as player | Shared membership roles where supported | Preserve existing support |
| Static assets and audio | Existing package/bundle path | Existing loading and client delivery |
| Dynamic assets/uploads | Shared asset catalog plus RTC delivery | Same catalog plus WebSocket delivery |
| Guest refresh | Resume reserved seat within grace period | Exercise the same attach/detach policy for updated clients |
| Solo/offline play | Shared engine with a local view and no room requirement | Existing local-play redirect remains |
| Extra Studio views and inspector | Keep existing behavior | Shared game/input contracts remain comparable |
| Public active rooms | API directory | Direct/LAN hosting remains available; public Core advertising can be added later |
| Private invitations | Unlisted room and reusable invite | Existing self-hosted connection flow remains |
| Studio shared drafts | Studio browser hosts the working game | Local Core remains usable by its owner |
| Save contract | Browser storage/export adapter | Files or existing client-backed save adapter |
| Home/navigation controls | Website-aware surrounding controls | Preserve dashboard navigation and framing |
| Pinning | Removed | Remove pin-specific behavior while retaining ordinary child supervision |
| contentGenerator gameplay | Retired | Retired from supported gameplay scope |
| Host migration | Out of scope | No import of a running browser session |

“Parity” means equivalent supported game behavior and player capabilities. It does not require identical storage media, identical dashboard chrome, or a promise that a browser survives closure.

Core must continue to work without the public room API when running games already available locally. A signaling outage must not break local WebSocket hosting.

## 5. Shared engine: the main refactor

### One implementation of session behavior

Extract browser-safe session behavior into homegames-common. A suggested entry point is homegames-common/session-engine; the final filename is less important than its dependency boundary.

The shared engine should own:

- The authoritative game instance and its lifecycle.
- Tick and Squisher lifetime through an injected clock/codec adapter.
- Participant membership and numeric game-player IDs.
- Active-player and spectator roles, capacity, and admission.
- Binding authenticated participants to game-facing input dispatch.
- Held-input release when a participant detaches.
- Game hooks for first join, permanent leave, updates, and shutdown.
- Per-participant frame selection and initialization data.
- Static/dynamic asset identity and current asset inventory.
- Save contract and compatibility decisions, with storage injected.
- Reconnect grace and exactly-once final participant removal.

The environment-specific parts should own:

- Browser source loading versus Node module loading.
- Browser storage versus files or existing client-backed saves.
- DOM views, local audio, window events, and inspector UI.
- WebSocket servers, RTC peer connections, and their buffers.
- Core process/container supervision, ports, certificates, dashboard navigation, and Homenames integration.
- API room registration and signaling.

### Keep imports browser-safe

Do not import the root homegames-common index into the browser engine. It currently loads Node facilities such as filesystem, HTTP, and process-related code.

Use direct browser-safe submodule imports, as the existing GameDispatcher integration already does. Keep codec resolution, byte conversion, clock access, and storage behind explicit inputs. Avoid a new engine that silently reaches for window, document, fs, ws, Docker, or a global process.

### Preserve public entry points while moving behavior underneath

Keep LocalSession and GameSession as compatibility facades during the extraction:

- LocalSession composes the engine with browser loading/storage and one or more GameViews.
- GameSession composes the same engine with Node loading/storage and WebSocket endpoints.
- HomegamesClient continues to render remote sessions, with an injectable transport.
- Existing game authors keep their current hooks and metadata.

The facades should lose duplicated game/session logic as the extraction proceeds. Avoid leaving a new RTC-only implementation beside two unchanged old implementations.

### Separate participant, connection, and view

Use three separate concepts:

1. **Participant:** a seat or spectator in the game.
2. **Connection:** one current way to deliver that participant's input and output.
3. **View:** an optional local renderer/input surface.

A browser host has a local participant/view plus remote participants with RTC connections. A Core process has remote participants with WebSocket connections. Studio can attach multiple local views.

Both a local view and a network connection should use the same membership/input/output path. The transport must not be the owner of the player's game state.

### Suggested conceptual interface

This is an interface sketch, not existing code or a requirement to create these exact methods:

~~~text
engine.start(gameDefinition, hostAdapters)
engine.joinParticipant(identity, role, clientInfo, preferences)
engine.attachConnection(participantId, connectionEpoch, endpoint)
engine.detachConnection(participantId, connectionEpoch)
engine.handleInput(participantId, connectionEpoch, message)
engine.updateParticipant(participantId, changes)
engine.leaveParticipant(participantId, reason)
engine.getInitialState(participantId)
engine.stop(reason)
~~~

An endpoint receives logical init, assets, frame, aspect, and platform messages. The RTC or WebSocket adapter encodes/transports them. It reports closure and congestion without invoking game hooks itself.

## 6. Three independent lifetimes

Do not reuse one timeout for three different jobs:

| Lifetime | Owner | What expiry means |
| --- | --- | --- |
| Game runtime | Browser tab or Core process | The game actually ends |
| Directory lease | API, renewed by host | The room stops appearing available |
| Detached participant reservation | Shared engine | A disconnected seat is permanently removed |

Losing an API heartbeat does not prove the game is dead. Existing RTC connections may still be playing. Remove or mark the listing unavailable; do not automatically stop a healthy local simulation.

Losing a guest's RTC connection does not end the room. Release its held inputs, retain its seat briefly, and allow a replacement connection.

Closing the host window ends that browser session. Reopening the game creates a new runtime and room. The app must not imply that saved game data restores the former participants or connection credentials.

An open, empty browser-hosted game may remain running and advertise while the host keeps it running. There is no pin flag. Core retains its normal occupancy/idle cleanup and parent supervision; removing pinning must not remove orphan cleanup.

Browsers may freeze timers or discard pages, so “leave the tab open” is the intended hosting model, not a guarantee of background execution. Show actual availability and test phone backgrounding. [Browser lifecycle reference](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).

## 7. Room model and defaults

### Terminology

- **Game reference:** published game ID plus commit/version, or an unpublished Studio preview descriptor.
- **Runtime ID:** random identity for one live authoritative game instance.
- **Room ID:** random public lookup key for its directory/signaling record.
- **Participant ID:** opaque identity for one host-authorized participant.
- **Player ID:** small numeric ID passed to existing game hooks and Squish.
- **Connection epoch:** generation identifying that participant's current connection attempt.

Do not use an IP address, display name, or Squish player ID as a room credential. Numeric player IDs have existing wire-format constraints; allocate them centrally and reuse only after final removal.

### Proposed stored room record

~~~json
{
  "roomId": "random-room-id",
  "runtimeId": "random-runtime-id",
  "source": {
    "kind": "catalog",
    "gameId": "published-game-id",
    "ref": "published-commit"
  },
  "visibility": "public",
  "protocolVersion": 1,
  "squishVersion": "142",
  "status": "open",
  "playerCount": 1,
  "spectatorCount": 0,
  "maxPlayers": 4,
  "lastHeartbeatAt": "server timestamp",
  "discoverableUntil": "server timestamp",
  "retainUntil": "server timestamp"
}
~~~

Authentication fields live in the private record and never in the public response. Store hashes/verifiers for high-entropy bearer credentials. Keep host, invitation, and participant-resume credentials distinct.

Counts are host-reported and useful for browsing. The host engine still makes the final admission decision. A directory entry saying “one seat free” is not a reservation.

For catalog rooms, derive canonical title/version metadata from the published game reference. A Studio preview is unlisted and explicitly marked as a draft; it cannot impersonate a published catalog version.

### Proposed product defaults

- Published multiplayer Play: start browser hosting and register a public room, preserving a visible private/unlisted choice.
- Explicit solo/offline play: no room registration.
- Invite from an already-running local game: advertise that same runtime without restarting it.
- Studio sharing: unlisted by default.
- A game need not declare the multiplayer label to be technically shareable; use metadata for presentation and a deliberate sharing policy for unlabeled games such as Draw.
- QR/link invitations are required. A human-entered short code is optional follow-up work.
- If registration fails, the local game may continue, with a clear “not available to join” status and retry action.

### Proposed timing defaults

These are starting values to test, not previously agreed requirements:

| Setting | Initial value |
| --- | --- |
| Host heartbeat interval | 10 seconds |
| Public listing freshness | 45 seconds after last accepted heartbeat |
| Pending join/negotiation timeout | 30 seconds |
| Guest seat reservation after detach | 60 seconds |
| Hidden stale-room authentication retention | 10 minutes after last accepted host heartbeat |
| TURN credential lifetime | Start with 1 hour; refresh before new negotiations and test long sessions |

API timestamps are authoritative. Explicit End marks the room ended immediately; a delayed heartbeat must not revive it. Invitation revocation should prevent new joins without ejecting established players unless the host explicitly ends the room.

## 8. Proposed API and signaling contract

Use a new room namespace so the old “start a Node game process” endpoint cannot be confused with registration.

| Endpoint | Purpose and authority |
| --- | --- |
| POST /rooms | Register a browser runtime; return room/invitation metadata |
| GET /rooms?gameId=… | Paginated fresh public rooms |
| GET /rooms/:id | Minimal join metadata; private metadata requires invitation/participant authorization |
| POST /rooms/:id/heartbeat | Host-only lease renewal and count/status update |
| PATCH /rooms/:id | Host-only visibility/admission changes |
| POST /rooms/:id/join | Public-room join or invitation redemption; create a pending participant |
| POST /rooms/:id/resume | Authenticate an existing participant and initiate replacement transport |
| POST /rooms/:id/leave | Participant explicitly relinquishes its seat |
| DELETE /rooms/:id | Host ends registration and signals room termination |
| POST /rooms/:id/invite | Host creates or rotates invitation capability |
| POST /rooms/:id/ice | Authenticated host/participant receives current ICE configuration |
| WSS /rooms/:id/signal | Offers, answers, ICE candidates, admission, and connection status |

Room operations use room-scoped credentials, independent of existing account JWTs. Keep the current account gate for Studio shared previews if preserving that product rule; ordinary guests do not need accounts.

Create should be retry-safe: generate a high-entropy host capability and runtime ID in the browser before registration, store the capability verifier at the API, and make repeated registration of that authenticated runtime return the same room. Possession of a runtime ID alone must not authorize taking it over.

Browser WebSockets cannot rely on arbitrary Authorization headers. Authenticate the signaling socket through an initial message with a short timeout, or an equivalent deliberate ticket flow. Do not put long-lived host/resume secrets into logged socket URLs.

### Signaling message behavior

Recommended messages are authenticate, join-request, admit/reject, offer, answer, ice-candidate, resume-request, peer-left, and room-ended. Include a protocol version and connection generation.

The API stamps the sender identity from its authenticated connection. It validates the intended recipient and only routes host-to-guest or guest-to-host traffic for that room. It does not accept a guest's claimed player ID.

The browser host is the offerer for each admitted guest. That keeps negotiation simple. Buffer candidates until the corresponding remote description is installed, reject messages for stale generations, and bound pending negotiations.

Room signaling is application code; WebRTC does not prescribe a signaling transport. Offers/answers and incremental ICE candidates can use this API WebSocket. [Peer-connection reference](https://webrtc.org/getting-started/peer-connections).

### Storage and API restart

For an early local milestone, an in-memory room store is sufficient if restart loss is explicitly reported.

For the hosted replacement, a reasonable default is a small room/participant metadata store in the API's existing MongoDB. Store room leases and credential verifiers, not game state or an unlimited history of SDP/candidates. Transient signaling stays short-lived.

Filter expired leases in application queries. MongoDB TTL indexes are useful for eventual record cleanup, but their background deletion is not an exact expiration clock. [MongoDB TTL reference](https://www.mongodb.com/docs/manual/core/index-ttl/).

A short API restart should allow the still-running host and guests to reconnect signaling using retained credentials. Established RTC play should continue if its transport survives. The host renews the same room during the retention window; a returning guest still asks the host whether its seat exists.

If records have been removed or the retention period ends, fail clearly or register a new room with a new invitation. Do not invent seat recovery from a missing host.

Start with one signaling process/owner. Shared database records alone do not route live sockets across several API replicas. Add room-affinity routing or pub/sub before running multiple signaling owners.

## 9. Host, guest, and reconnect flows

### Starting a published game

1. Play opens the normal game window.
2. Load the selected immutable game reference and assets.
3. Construct the shared engine, load its compatible save, and join the host's local participant.
4. Register the room when the selected mode calls for sharing/public hosting.
5. Connect signaling and begin heartbeats.
6. Surrounding controls show visibility, Invite a friend, participant list, and connection status.

Registration must not call the old hosted POST /sessions or launch a process/container.

### Joining

1. Open a public listing or invitation.
2. Resolve room metadata and verify that it is accepting joins.
3. Obtain a distinct pending participant credential.
4. The host admits the participant according to the shared engine's capacity/role rules.
5. Host and guest negotiate their own RTC connection.
6. Confirm protocol/game/codec compatibility.
7. Load static assets, receive dynamic assets, and apply initialization plus the participant's current frame.
8. Enable input once bootstrap is complete.

Do not reserve seats forever for people who abandon the join page. Pending joins expire. Existing seat reservations and simultaneous admissions must count toward active-player capacity.

The same invitation can produce multiple participants. It must not embed one guest's SDP or be consumed by the first join.

### Guest refresh or connection loss

- Save the participant resume capability in per-room sessionStorage so a normal tab refresh can resume.
- On transport loss, release keys, pointer holds, and controller state immediately.
- Keep the participant's seat during the grace period.
- Authenticate resume and create a fresh connection epoch.
- Attach the replacement without firing another new-player hook.
- Ignore old connection events and input after replacement.
- Send assets and a fresh current view before resuming input.
- Explicit Leave or grace expiry triggers the game's final disconnect hook once.

Distinguish an ICE restart on a surviving peer connection from a browser refresh that needs a new peer connection. Both must use the same participant reservation.

Treat duplicated tabs explicitly: only one active connection may control a participant. A replacement should notify the displaced tab; stale close events must not remove the new connection.

### Host departure

End closes all peer connections, stops ticking, disposes views/assets/listeners, and attempts to end the API room. Window closure may prevent that request, so lease expiry is the cleanup backstop.

Host refresh starts a new game runtime. Guest reconnect is supported only while the old runtime survives.

### Signaling interruption while gameplay works

Show a limited state such as “Playing; invitations temporarily unavailable.” Retry signaling with backoff. Do not disconnect established players just because the directory heartbeat failed.

## 10. Gameplay protocol and transport adapters

Keep the existing logical messages wherever they still apply:

| Existing message | Target handling |
| --- | --- |
| Type 1: assets | Reuse bundle semantics with bounded transport framing |
| Type 2: init | Preserve player/aspect/bezel/codec data; pair with explicit protocol negotiation |
| Type 3: player frame | Same scoped Squish scene over RTC or WebSocket |
| Type 9: aspect update | Shared behavior |
| Types 10/11: save push/request | Preserve for the hosting modes that use them; do not broadcast the host's full save to RTC guests |
| Types 5/6: port redirects | Remain Core navigation messages |
| Type 12: local-play redirect | Preserve Core-to-browser solo transition |
| JSON player input | Reuse existing input shapes and dispatcher |

Keep room control messages separate from gameplay opcodes. A transport envelope may carry logical message type, transfer ID, connection epoch, total size, and chunk position. Exact encoding can be settled during the transport fixture work.

Both transports feed the same logical client protocol handler. WebSocket creation/worker behavior becomes an adapter; RTC becomes another. Preserve the existing HomegamesClient constructor behavior for current embedders.

### Reliability and bounded queues

Start with reliable, ordered RTC data channels. Leave maxRetransmits and maxPacketLifeTime unset. RTCDataChannel exposes bufferedAmount and a low-water event; its send limit also depends on negotiated maxMessageSize. [WebRTC data API](https://www.w3.org/TR/webrtc/#rtcdatachannel).

Proposed first implementation:

- One reliable ordered channel per peer is enough initially.
- Chunk logical payloads conservatively, for example into approximately 16 KiB pieces within the negotiated maximum.
- Reassemble with a total-byte cap, transfer cap, and timeout.
- Keep separate bounded logical queues for controls, frames, and bulk assets; schedule chunks so bulk data cannot monopolize sending.
- Gate frame application on required assets being available.
- Do not silently introduce lossy frame delivery.
- If a guest stays too slow, show a connection problem and reconnect/resynchronize it rather than allowing unbounded memory growth.

SCTP message interleaving support affects whether a large message can monopolize an association. Small chunks are a useful starting point, not a substitute for measuring queues. [Data-channel transport reference](https://www.rfc-editor.org/rfc/rfc8831.html#section-6.6).

Existing renderers paint the latest received frame; audio is also represented by scene nodes. Reliable transport does not imply that every intermediate frame is painted. Do not add frame coalescing or sound replay changes without explicit behavioral tests.

## 11. Assets, saves, and settings

### Assets

Static published assets should continue to use the existing API asset-bundle path. Guests can use the existing manifest metadata even if it includes source they do not execute; a smaller guest manifest is an optimization, not a prerequisite.

The engine needs a durable-for-the-session inventory of dynamic asset bytes and metadata. A GameView's decoded image/audio cache is not an adequate canonical store.

When a game calls addAsset:

1. Register the bytes/type/key with the shared session asset catalog.
2. Notify local views.
3. Deliver the update to remote participants reliably.
4. Ensure subsequent frames referencing it cannot outrun usable asset data.

Reconnect bootstrap includes the current inventory or a verified set of missing assets. Include revisions when replacing bytes under an existing key. Existing asset and upload size limits still apply after chunking.

### Saves

Keep saveGame/saveData as the game contract. The host owns the authoritative save:

- Browser host: existing browser-backed storage and optional download.
- Core host: existing file or client-backed backend.
- Guest: participant resume credential; no general copy of the authoritative multiplayer save.

Preserve game/version compatibility checks and explicit save keys. Keep the current game-scoped save behavior during extraction. Concurrent browser rooms for the same game can compete for that slot; document this existing limitation rather than adding a save-management UI to the first milestone. Separate room save slots can be a later change. Save storage is not host migration.

### Player names and settings

Store each browser's preferred display name and settings locally. Send bounded preferences to the host on admission/update. The shared engine applies game-facing updates.

Per-session identity and room membership do not need a public Homenames instance. Core may continue using local Homenames as an adapter for its existing dashboard and cross-session navigation.

## 12. Website and Studio changes

### Public Play and surrounding controls

The current public local-play path creates LocalSession directly and does not mount the Home-button controls used by dashboard local play. Reuse/extend the existing local controls in this path.

Keep room controls outside individual games:

- Home / leave / end-session behavior appropriate to host or guest.
- Game title.
- Public/unlisted status for the host.
- Invite a friend with QR and copyable link.
- Connected/reconnecting players and spectators.
- Clear full-room, expired-room, host-unavailable, and connection-error states.

A host pressing Home should understand that it ends the hosted game. A guest pressing Home leaves its own seat.

### Public discovery

Replace both the game-page session list and homepage Active Sessions queries with GET /rooms. Keep selected game versions accurate. Exclude stale, ended, unlisted, and Studio-preview rooms from public results.

Starting a room should preserve the existing “sessions played” metric if desired. Count registration once per runtime ID; heartbeats and guest resumes must not increment it. Discovery counts describe host reports, not centrally verified game execution.

### Invitations and homegames.link

A proposed link is:

~~~text
https://homegames.link/join/<roomId>#invite=<invitation-capability>
~~~

Keep invitation capability separate from host and resume capabilities. Read the fragment in the join flow and submit it only to the intended API operation. Ensure any redirect to homegames.io preserves it. Never put the host credential in a QR.

Handle /join before the existing LAN-discovery catch-all. Existing local-instance redirects and DNS registration remain available.

For the first implementation, a homegames.io join URL can establish the whole flow before adding the short domain. No new household DNS or certificate provisioning is required for browser hosts.

### Studio sharing

Studio already has local execution, captured logs, extra views, and an inspector. Share that running game over RTC.

- Use the current in-memory working files, including unsaved edits.
- Create an unlisted preview room.
- Guests receive rendered views/assets; they do not need access to the developer's private source API.
- Replace hosted preview logs with the existing local log capture.
- Ending/freeze-stopping the authoritative preview ends its room, while retained inspector views may remain.
- Replacing the preview runtime creates a new preview room/link initially. In-game round changes can keep the same room.
- Sharing should not require publishing the draft.

## 13. STUN/TURN and hosting infrastructure

The API owns room/signaling HTTP and WebSocket endpoints and returns RTC iceServers configuration. STUN/TURN is a separate network service that can run alongside the API infrastructure. TURN traffic does not flow through ordinary HTTP request handlers.

Coturn is a suitable implementation to evaluate: it provides STUN/TURN and supports temporary credentials generated by a web service using a shared secret. Keep that secret on the API/relay hosts; send browsers only expiring credentials. Configure authenticated relay access. [Coturn project](https://github.com/coturn/coturn), [temporary credential documentation](https://github.com/coturn/coturn/blob/master/README.turnserver).

Deployment requirements to record during implementation:

- Reachable relay address and advertised public IP configuration where necessary.
- Appropriate UDP/TCP/TLS listeners and relay port range in network rules.
- A separate listener/address arrangement if TURN/TLS and website HTTPS would otherwise compete for the same port.
- Credential expiry/refresh behavior exercised over the intended session duration.
- Per-room/user allocation and bandwidth controls.
- Metrics for relay bytes, allocations, failures, and direct-versus-relayed connections.

Do not use public unauthenticated credentials as the production plan. Provisioning TURN is a later deployment step, not an action authorized merely by this design document.

Force relay-only connectivity in a test to prove TURN works. “It connected on Wi-Fi” does not verify the relay. Confirm the selected candidate pair through RTC statistics.

## 14. Keeping Core viable

Core remains a real product, with its launcher, dashboard, game library, local web client, WebSocket sessions, certificates where used, and process/container supervision.

The browser host and Core must instantiate the same engine in their normal paths. Every change to the shared engine should exercise both host adapters.

Keep framed Core behavior through explicit hooks for bezel geometry, platform layers, spectator controls, and navigation. Keep those hooks out of the game itself.

A browser that cannot use RTC can connect to a reachable Core WebSocket session. Someone must run that session; there is no automatic browser-to-WebSocket server conversion. Starting a fresh Core session is the supported choice. Transferring an existing browser game is excluded.

First-release discovery may remain browser-room focused. Core's direct/LAN access must remain operational. If public advertising of self-hosted Core is added later, the directory can include a host kind and reachable endpoint without requiring a different game engine.

Separate removal of hosted Homenames from removal of the Homenames codebase. The former is the goal. Local Core may still need its existing identity, settings, session management, and dashboard integrations.

## 15. Repository work map

| Repository | Expected work |
| --- | --- |
| homegames-common | Extract portable engine and membership lifecycle; retain shared dispatcher/input; define host adapters and logical message contracts |
| homegames-client | Make LocalSession an engine/view facade; inject remote transports; implement RTC peers, room client, bootstrap, reconnect, and controls |
| homegames-core | Adopt engine under GameSession/children; keep framed dashboard behavior and supervision; remove pinning and retired service integration |
| homegamesio | Update both Play entry points, room lists, join page, invitation UI, and Studio sharing/logging |
| api | Room store/handlers, signaling upgrade handler, ICE credential endpoint, metrics, and removal of public Core forwarding/admin pin controls |
| homegames.link | Add explicit join route without disrupting local-instance discovery |
| homegames | Verify launcher and distribution still run Core; no return to Electron or new required service |
| squish / homepad | Reuse as foundations; no codec rewrite or intentional-development-alias cleanup |
| homegames-web | Preserve compatibility if changed dependencies affect it; do not make it the new public architecture |
| worker | No new game-execution responsibility; keep independent certificate/docs/AI-authoring jobs |

Suggested new modules, only if they clarify ownership: session-engine, participant-registry, rtc-transport, room-client, room-store, and room-signaling. Avoid creating abstractions that merely rename a single call.

### Existing public Core dependencies to remove

- [Game-page hosted creation](/Users/josephgarcia/homegames/homegamesio/client.js:607).
- [Game-page session discovery](/Users/josephgarcia/homegames/homegamesio/client.js:914).
- [Homepage multiplayer Play](/Users/josephgarcia/homegames/homegamesio/client.js:1607).
- [Homepage active sessions](/Users/josephgarcia/homegames/homegamesio/client.js:1627).
- [Studio shared preview creation](/Users/josephgarcia/homegames/homegamesio/studio.js:4058).
- [Studio server log stream](/Users/josephgarcia/homegames/homegamesio/studio.js:4185).
- [API session forwarding](/Users/josephgarcia/homegames/api/handlers.js:1351).
- [API admin session/persistence forwarding](/Users/josephgarcia/homegames/api/handlers.js:1494).
- Corresponding HOMENAMES_URL configuration, routes, links, admin UI, deployment expectations, and documentation.

Recheck line numbers before editing. Search callers before deleting endpoints; other integrations may reference them.

## 16. Remove retired features without expanding scope

### Pinned sessions

Remove the public pin/unpin UI, API forwarding, Core persistence controls, and pin branches in lifetime tests. Preserve elapsed-time idle cleanup, occupied-session behavior, fork parent supervision, and port release.

Room visibility is not pinning. A public room still needs live host heartbeats; an unlisted room may remain active with zero guests while its browser host runs.

### contentGenerator

Inventory remaining imports, service routes, catalog entries, and metadata checks. Retire supported gameplay paths requiring the service rather than replacing it with a browser shim.

Do not merely delete the local-play exclusion and then advertise service-dependent games as compatible. Keep them unavailable/marked unsupported or remove them from active presentation. Preserve source/version history unless separately asked to delete it.

The review's static scan of 80 local game entry points found no literal contentGenerator service declaration. That is not an audit of every published or downloaded game.

Keep Studio AI editing and documentation assistance distinct from contentGenerator inside running games.

### Deferred review findings

Earlier review identified frame-fallback privacy, node-target authorization, and local capacity gaps. The user explicitly deferred a broad bug-fixing pass. Do not use those findings to start an unrelated cleanup project.

When defining the new shared contract, write down expected private-view, admission, and input ownership behavior. If an existing defect directly blocks a milestone, report and address that narrow dependency. Do not silently present inherited behavior as a newly verified guarantee.

The existing downloaded-source loader is not an origin sandbox. Use trusted fixtures for the first local RTC milestone. Public-origin isolation remains a separate release consideration, not a reason to rebuild the loader during the initial transport extraction.

## 17. Implementation sequence

### Phase 0 — establish the working baseline

Read repository instructions and current status. Preserve unrelated uncommitted work. Confirm actual sibling dependency resolution and bundle serving paths. Leave intentional Squish aliases alone.

Run focused existing session tests and capture results. Pick a deterministic fixture plus Draw for shared state. Use a private-view fixture for participant-specific output; Crazy Eights is useful later but has only two active seats.

Deliverable: documented baseline and chosen fixture, with no infrastructure changes.

### Phase 1 — share the session engine

Extract the smallest common engine behind LocalSession and GameSession. Keep current public entry points. Separate participants from views/connections.

Exercise local views, an in-memory remote endpoint, and Core's WebSocket adapter with the same expectations. Verify tick ownership, saves, input release, framing, and disposal.

Deliverable: both existing hosting modes still work through shared code before RTC is added.

### Phase 2 — add RTC gameplay transport

Connect a browser host and guest using the real shared engine and renderer. Add initialization, reliable input/frames, chunking, bounded queues, and static/dynamic asset bootstrap.

A local development signaling harness is acceptable for this slice; manual SDP exchange is not the eventual product flow.

Deliverable: a guest controls its own participant and sees the correct live scene.

### Phase 3 — add API rooms and invitations

Implement room registration, leases, listing, capabilities, host admission, signaling, and ICE configuration. Add QR/link join and independent guests.

Deliverable: one host plus two guests can join the same invitation on separate devices.

### Phase 4 — reconnect and session controls

Implement participant reservation, connection epochs, refresh resume, explicit leave/end, room visibility, names/settings, and spectator transitions where supported.

Deliverable: refresh resumes the same seat without another join hook or stuck inputs; stale transports cannot remove or control it.

### Phase 5 — complete website and Studio parity

Replace both Play paths and both public session lists. Replace Studio's hosted share and log paths. Preserve version selection, private rooms, offline play, downloads, and relevant metrics.

Deliverable: ordinary public play and draft sharing require no hosted Core or Homenames calls.

### Phase 6 — relay and real-device validation

Provision test relay infrastructure when separately authorized. Verify relay-only, different networks, guest refresh, host phone behavior, queue limits, and long-lived credentials.

Deliverable: measured direct and relayed behavior, with explicit supported combinations.

### Phase 7 — retire public hosting

Remove pinning and the retired service surface. Verify the no-Core configuration, update deployment docs, release the replacement, drain old sessions if desired, and shut down the hosted Core/Homenames instances.

Deliverable: the retirement checklist below passes while self-hosted Core remains functional.

## 18. Starting tonight

Start in the shared session boundary, not in DNS or TURN deployment.

1. Read this brief plus the prior session-refactor document.
2. Run the focused baseline.
3. Write a small participant endpoint fixture that receives real Squish frames without a DOM canvas.
4. Route both LocalSession and GameSession through the first extracted piece.
5. Prove that a local view and a remote endpoint can coexist in one session.
6. Add RTC to that endpoint once ownership and teardown are stable.

The first useful stopping point is a small, reviewed shared-engine slice exercised through both existing hosts. The next is one working RTC guest. Do not make “finish the entire migration tonight” the condition for useful progress.

Avoid running package installation or rebuilding development alias links just to normalize the workspace. Inspect resolution first. Do not mass-commit unrelated current changes across the sibling repositories.

### Existing commands

These commands already exist. They are not new RTC run commands:

~~~bash
cd /Users/josephgarcia/homegames/homegames-core
npm run test:sessions

cd /Users/josephgarcia/homegames/homegames-client
npm run build

cd /Users/josephgarcia/homegames/homegamesio
npm run build
~~~

For broad regression validation after substantial shared-engine changes:

~~~bash
cd /Users/josephgarcia/homegames/homegames-core
npm test
~~~

The session suite includes loopback integration tests and child processes. Use an isolated local environment; do not source production credentials for testing.

Add an RTC-specific test command when the corresponding tests exist. Document the actual development API origin, website origin, signaling route, and relay settings after implementing them; this brief does not claim a runnable RTC environment already exists.

### Bundle and distribution checks

- homegames-client builds dist/homegames-client.js.
- homegamesio serves the installed client package's dist bundle separately from its own web/bundle.js.
- Core also serves the client package bundle.
- API single-file downloads inline a client bundle from CLIENT_BUNDLE_PATH or the sibling default.
- Core runner images contain their own child/common code and need rebuilding when those sources change.
- homegames-web has its own bundle if its compatibility is exercised.

Record which source/bundle/image each test used. A source-level pass alone does not verify a served or packaged artifact.

## 19. Validation matrix

Use expected behavior as the assertion, not merely “RTC and WebSocket produced the same result.”

| Area | Required evidence |
| --- | --- |
| Shared ownership | Both host paths instantiate the shared engine; no second RTC-specific gameplay implementation |
| Browser authority | Starting Play creates no public Core process and calls no hosted /sessions endpoint |
| Membership | Host plus two guests get distinct participants and correct player IDs |
| Capacity | Simultaneous joins and reserved seats cannot overfill a game |
| Input parity | Keyboard, pointer, touch, gamepad, text, and uploads reach the correct game hooks |
| Player views | A private fixture verifies decoded payload contents for owner, other player, and spectator |
| Guest resume | Refresh within grace preserves the seat; expiry/Leave removes it once |
| Duplicate transport | Old connection input/close events cannot affect a replacement |
| Assets | Initial assets, dynamic uploads, replacement keys, and reconnect inventory render correctly |
| Audio | Gesture unlock works and reconnect does not introduce unintended duplicate sound |
| Discovery | Fresh public rooms list correctly; private, stale, ended, and preview rooms do not |
| API outage | Existing peer play can continue; signaling/listing recovers or fails explicitly |
| Invitations | Same link admits multiple guests; revoked/invalid invitations have clear outcomes |
| Studio | Unpublished working code can be shared, logs stay local, and stopping preview ends its room |
| Controls | Names/settings, supported spectating, Home, Leave, and End have correct ownership |
| Core | Local dashboard, framed/frameless sessions, child cleanup, saves, and WebSocket play work without room API |
| Lifecycle | Repeated start/stop leaves no extra ticks, players, canvases, listeners, or connections |
| Connectivity | Real Wi-Fi, different-network, and forced-TURN tests record the selected route |
| Packaging | Actual served bundles and an updated Core distribution/runner use the expected shared engine |
| Retirement | Website and Studio work with hosted Core/Homenames absent |

Measure game/version, device/browser, participant count, tick/frame rate, outgoing bytes per guest, queue high-water marks, join/resume duration, and direct/relay selection.

Host upload is approximately the sum of bytes sent to each guest per second. API room/signaling load and TURN bandwidth are separate measurements. Do not infer internet scale or phone-host performance from multiple tabs on one computer.

### Evidence already collected in this conversation

On September 28, the following existing source-level selection passed 52 checks:

~~~bash
cd /Users/josephgarcia/homegames/homegames-core
node testRunner.js \
  ./test/session/BrowserSession.test.js \
  ./test/session/InputContract.test.js \
  ./test/session/LocalLoading.test.js \
  ./test/session/PlayerViews.test.js \
  ./test/session/SessionLifetime.test.js \
  ./test/session/SessionRegression.test.js
~~~

This was not the full test:sessions command, a bundle rebuild, a Docker test, or a real-device RTC test. Re-run an appropriate baseline when implementation starts. Older results recorded in other documents describe their own earlier checkout.

## 20. Public hosting retirement checklist

- [ ] Published multiplayer Play runs in the browser on both homepage and game pages.
- [ ] Public room listings and joins use API rooms, not Homenames.
- [ ] Private QR/link invitations and multiple guests work.
- [ ] Guest refresh resumes a surviving host's seat.
- [ ] Static/dynamic assets and audio work on the supported device set.
- [ ] Studio shares unpublished previews without hosted Core.
- [ ] Studio logs no longer depend on Homenames SSE.
- [ ] Host controls and participant updates work without public Homenames.
- [ ] Pinning routes, UI, and behavior are removed.
- [ ] contentGenerator-dependent gameplay is retired from supported paths.
- [ ] The API no longer forwards public game creation/admin persistence to Core.
- [ ] TURN is tested through an actual relay-selected connection.
- [ ] Short signaling restarts have a tested recovery or clear failure path.
- [ ] Self-hosted Core uses the shared engine and passes the same contracts.
- [ ] Local Core remains usable without public room/signaling services.
- [ ] Fresh served bundles and relevant runner/distribution artifacts have been tested.
- [ ] Search finds no remaining active website/Studio dependency on core.homegames.io or public HOMENAMES_URL.
- [ ] Old bookmarks get a clear expired/retired-session result instead of silently invoking removed hosting.
- [ ] End-to-end checks pass with the hosted Core/Homenames instances unavailable.
- [ ] Deployment and shutdown are carried out only after this replacement is reviewed and authorized.

Shutting down public Core does not mean removing Docker validation used by publishing, local Core's session manager, self-hosted certificates, or unrelated background workers.

## 21. Copyable prompt for the implementation session

> Read /Users/josephgarcia/homegames/homegames-core/docs/browser-hosted-multiplayer-plan.md and the applicable repository instructions. Implement Homegames browser-hosted multiplayer incrementally, preserving unrelated work. The goal is to retire the public Core/Homenames instances used by homegames.io while keeping self-hosted Core/WebSocket as a first-class host of the same shared session engine. Start by extracting the smallest portable session boundary behind existing LocalSession and GameSession, and verify both host paths before adding RTC. Then add API-owned rooms, heartbeats, public discovery, signaling, reusable QR/link invitations, multiple guests, and guest refresh/resume while the host survives. Preserve the existing game hooks, Squish scene format, renderer/input, assets, saves, local views/inspector, and supported self-hosted behavior. Include homepage/game-page discovery and multiplayer Studio draft sharing in the full parity scope. Remove pinned-session functionality and retire contentGenerator-dependent gameplay. Do not implement host migration or session transfer. Intentional local Squish alias differences are development setup, not a cleanup task; defer unrelated bug fixing. Use reliable ordered gameplay delivery with bounded transfers/queues, and distinguish source tests from real-device/direct/TURN evidence. Begin with a small demonstrable milestone and record exact run instructions, changed repos, tests, remaining parity work, and observed limitations. Do not deploy, change DNS/certificates, publish packages, shut down services, or alter production infrastructure without a separate explicit instruction.
