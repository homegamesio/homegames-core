# Shared sessions: architecture and validation

Implemented in the sibling working trees on 2026-09-19. This describes source changes and local validation, not a deployed release. Existing unrelated work in the repositories was preserved.

## Why this changed

The website, Studio, home-server page, and `homegames-web` already consumed `homegames-client`, but important behavior was still copied inside that package and between client/common. Local and hosted input had separate hit-testing/drag/upload implementations; local and remote views independently owned canvas/input/render loops; the remote client also constructed local-game UI and loaded its assets. Server idle cleanup had competing policies in the manager and child.

The refactor gives each resource an owner while retaining the current wire protocol, Squish serialization, public client entry points, and game callback behavior.

## Where behavior belongs

| Responsibility | Implementation | Boundary |
| --- | --- | --- |
| Game-facing input | [GameDispatcher](../../homegames-common/game-dispatch.js) | Shared click hit-testing, scoped/layered geometry, drag/release, keyboard/controller dispatch, text/hover/file input. No DOM or socket ownership. |
| Hosted session | [GameSession](../../homegames-common/game-session.js) | Membership, spectators, frame/bezel geometry, platform messages, saves, and broadcasting. Supplies geometry hooks to GameDispatcher. |
| Local input adapter | [LocalDispatcher](../../homegames-client/src/local-dispatch.js) | Binds one simulated player and forwards to the same dispatcher. Releases held keys and presses before disconnect. |
| Browser view | [GameView / FrameLoop](../../homegames-client/src/game-view.js) | Canvas sizing, renderer, assets, input attachment, disposal, and one scheduled animation callback. Additional Studio views borrow primary assets. |
| Session switching | [SessionController](../../homegames-client/src/session-controller.js) | Owns pending load cancellation, active local session, local chrome, and remote start/stop. A failed manifest/asset load leaves the current game running. |
| Manifest loading | [local-game-loader](../../homegames-client/src/local-game-loader.js) | Resolves files/assets/identity, checks local eligibility, passes AbortSignal through fetches, resolves asset URLs against the manifest URL. |
| Local chrome | [local-game-chrome](../../homegames-client/src/local-game-chrome.js) | Home button, title, and local game container. Page-specific UI remains outside the runtime. |
| Local execution | [LocalSession](../../homegames-client/src/local-session.js), [local-game-runtime](../../homegames-client/src/local-game-runtime.js) | Game construction, saves, tick clock, real Squisher frames, simulated players, and Studio inspector. |
| Remote transport/protocol | [HomegamesClient](../../homegames-client/src/index.js), [socket-worker](../../homegames-client/src/socket-worker.js) | Inline/worker WebSocket lifecycle and existing binary opcodes. Decoding/rendering remains on the main thread. |
| Hosted lifetime | [SessionLifetime](../../homegames-common/session-lifetime.js), [child server](../src/child_game_server.js) | Child observes occupancy and decides when to exit; manager supervises processes and releases ports. |

The local runtime deliberately retains the Squish serialization/decoding path. Replacing that renderer or redesigning the wire protocol would be a separate change.

## Ownership and transitions

`HomegamesClient.start()` replaces any previous active session and starts remote play. `startLocalGame(request)` loads the manifest and assets before disposing the current view. A newer request or `stop()` aborts pending fetches; a generation guard also rejects stale results from loaders that ignore cancellation. `exitLocalGame()` returns to the client's current remote URL. `stop()` disposes both kinds of owned session and is safe to repeat.

Old inline sockets and terminated workers cannot call back into a newer session. Port redirects stop the old animation loop before reconnecting. Socket closure stops painting. FrameLoop is shared by local and remote rendering; extra Studio players use the local session's one loop.

`LocalSession.start()` replaces any previous runtime on that instance. Its async save read has its own generation guard. `freeze()` releases input, disconnects players, closes the game and stops ticking, but keeps the canvas/inspector available. `stop()` also disposes the views, assets, resize handler, and animation callback.

The follow-up cleanup uses one ordered player collection for the primary and additional seats. Each record owns its dispatcher, view and current frame; joining, capture, resize, rendering and leaving use shared paths. Only primary audio and inspector behavior need a distinction. `_endGame()` is the single runtime teardown used by both freeze and stop, while stop additionally destroys the retained views. Views are mounted after save loading and game construction. Primary canvas/renderer/input accessors derive their values from the view; `squisher` derives from the runtime and `rendering` from the animation loop.

This second pass removed **186 more production lines** across three existing modules, with no new production modules: LocalSession went from 756 to 604 lines, HomegamesClient from 579 to 550, and GameView from 90 to 85. These counts compare saved working-tree copies immediately before this cleanup, excluding tests, documentation, generated bundles and unrelated existing edits.

Squish 142 starts a tick interval without exposing its handle. Merely clearing `_tickInterval` therefore leaked stopped local games. The local runtime now temporarily hides `tick` during the synchronous Squisher constructor, restores its original property, and owns the clock itself for all installed versions. The clock uses `metadata().tickRate || 60`; stopping it is idempotent. No installed package files were patched.

## Save identity and compatibility

Explicit identity now reaches LocalSession through each maintained launch path:

| Path | Game identity | Version identity |
| --- | --- | --- |
| Website play and downloaded HTML | `catalog:<gameId>` | Requested published ref/SHA |
| Studio account preview | `studio:<gameId>` | Selected version SHA, or `local-game-version` for unversioned work |
| Studio guest preview | `studio:guest:<templateId>` | `local-game-version` |
| Core local manifest | Library game key | Selected library version |
| Direct LocalSession embedder | Supplied `gameKey`, otherwise class name | Supplied `versionId`, otherwise `local-game-version` |

Browser saves still have **one slot per game key per origin**, `local:<gameKey>`. The envelope records `versionId`; restore accepts that version or an explicit `metadata().saveCompatibility` entry. Versions do not have independent browser slots. A new save can replace an older version's envelope. Studio identity is separate from published catalog identity, and guest drafts from the same template share that template's preview identity.

Old class-name-keyed saves are left intact but are not automatically assigned to catalog/Studio identities: a class name can describe several games, so choosing a destination would be ambiguous. Existing built-in version envelopes can also be rejected when switching to an explicit version unless compatibility is declared. This is a migration consideration for release. Downloads include game code/assets, not existing progress; no cloud/account synchronization was added.

## Hosted idle policy

Fork and Docker entry paths use the same child policy. Connected players **or spectators** reset idle time. A pinned session also resets it. An unpinned, observed-empty session gets the configured grace (`GameSessionManager.gracePeriodMs`, default 30,000 ms); checks run every three seconds and use elapsed time, not a count of successful health polls. Unpinning starts a fresh observed-empty grace. This is not an exact reconnect deadline or durable seat reservation.

Fork-parent heartbeat/orphan handling remains separate. A missed heartbeat beyond five seconds can terminate an empty fork even if pinned; IPC disconnect handling still protects against orphaned children. The manager forwards grace settings to both launch modes and no longer runs a competing Docker occupancy timeout. It retains container/process supervision, heartbeats, and port cleanup.

## Tests were established before extraction

The first 25 characterization tests passed against the pre-refactor code:

- [InputContract.test.js](../test/session/InputContract.test.js): 17 tests across real hosted/local entry points and Squish trees. Checks expected callback sequences, per-player presses, removal mid-drag, layer scale/order, scoped hit-testing, malformed input, callback exceptions, text/hover/uploads, and hosted frame/spectator behavior. Local/hosted agreement alone is not the assertion.
- [BrowserSession.test.js](../test/session/BrowserSession.test.js): eight tests using the real client, LocalSession, input, renderer and Squisher, with controlled DOM/socket/worker/RAF/storage boundaries. Covers handshake, decoded drawing, dirty rendering, resize, join/spectate redirects, local saves, second-player/inspector behavior, and transitions.

Separate regression tests describe intentional fixes instead of calling bugs “legacy contracts”:

- [SessionRegression.test.js](../test/session/SessionRegression.test.js): owned-session teardown, stale loads and socket events, redirect loop duplication, repeated starts, construction failure, worker closure, and Squish 142/143 tick cleanup. The initial five lifecycle regressions were demonstrated failing before the fixes.
- [LocalLoading.test.js](../test/session/LocalLoading.test.js): manifest-relative assets, eligibility/errors, cancelled assets, same-class game save separation, version compatibility, and executable generated-download identity/escaping.
- [SessionLifetime.test.js](../test/session/SessionLifetime.test.js): deterministic elapsed-time, spectator/player, pin/unpin, and heartbeat policy checks.
- [HostedLifecycle.test.js](../test/session/HostedLifecycle.test.js): actual forked and standalone child processes, loopback HTTP/WS handshake and frames, spectator retention, idle exit, released port, and manager cleanup. The standalone process uses Docker's child entry path; it does **not** test Docker isolation/container creation.
- [PlayerViews.test.js](../test/session/PlayerViews.test.js): five additional characterization tests passed before the follow-up cleanup. They cover three scoped views, independent resizing, removing/reusing a seat, shared asset ownership, release-before-disconnect, close-once behavior, controller slots, and frozen/recorded/pick inspection. Two regression tests then cover asset-ready invalidation of every seat and stopping from inside a click without painting a disposed view.

The full baseline also exposed stale Clicktionary assertions against a removed queue. Those tests now check visible drawing and ink permissions. An EngineRoom timing test could accidentally complete a random order; it now changes an untargeted control and verifies the same order remains. Five SessionStrip fixtures did not close their dashboard timers; fixture cleanup now runs even after assertion failures. Game production code was unchanged for these repairs.

## Running and interpreting validation

From `homegames-core` with the sibling dependencies installed:

```sh
npm run test:sessions
npm test
```

The focused command now selects 93 tests: 53 session tests added by these two passes plus existing controller, pointer, save, fork-gate and web-route checks. The initial 86-test command passed with process exit 0; the additional seven tests also pass in the full suite below. Hosted integration needs permission to bind loopback ports and spawn local children. It uses temporary game files and no production service.

After the follow-up cleanup: **348 passing, zero failures, process exit 0** (341 after the first pass). Client and homegames-web webpack builds were rebuilt successfully; homegamesio's unchanged website bundle passed in the first pass. The first browser smoke checks used actual core bootstrap, website play HTML and the homegames-web Draw game. The follow-up additionally verified three simultaneous browser views, input from an extra seat updating all views, frozen inspection affecting only the primary view, returning to the last live frame, zero canvases after stop, three after restart, and local-to-hosted worker transition/input. Test services ran only on loopback.

Limits still relevant to release:

- Installed Squish Asset modules log caught `process is not defined` errors during browser initialization; the tested games still render and accept input. This pre-existing dependency/browser packaging issue remains separate from session ownership.
- Client maps 142/143/144 while common maps 142/143/145; installed aliases can mask the mismatch. These builds validate this checkout, not a fresh install of aligned published packages.
- No physical gamepad, real multi-device LAN, production API/Forgejo, Docker daemon/container, or full Studio UI publishing flow was exercised. Controller behavior and Studio's extra-view/inspector runtime are covered through the automated boundaries above.
- Rebuild the client bundle, each consuming website bundle where applicable, and the runner image before deployment. Docker images contain their own child/common code. No deployment was performed.
