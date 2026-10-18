# Squish building blocks: review of the built-in games

Review date: 2026-10-11. Scope: the current working trees, including untracked games. This is an extraction proposal; no game or runtime implementation was changed by this review.

## Recommendation

Build a small, composable authoring layer on top of the existing Squish nodes and game lifecycle. The strongest opportunities are **scene construction, player-owned views, input state, UI controls, geometry, and resource cleanup**. Audio voices and sprite animation are also useful, with explicit runtime contracts. Keep game rules and content in the games.

The catalog is unusually useful for this: it contains board/card games with private information, social games, creative tools, co-op arcade games, persistent adventures, strategy simulations, two different kinds of first-person world, and focused platform demos. A shared helper should earn its place by working in more than one of these families.

Start with node mutation/containers, safe geometry, and a keyed scene builder. Prove them in a small board UI and a camera-heavy game before migrating the large FPS games. Input/UI/lifetime helpers are the next slice. Do not start by moving an entire game engine into Squish.

## Coverage and limits

All **103 top-level directories** in `src/games` are included in the [per-game catalog](game-building-blocks-catalog.md). The review reads entrypoints and authored support modules, follows input/state/render/cleanup paths, and records source evidence. Generated image arrays, imported BSP tables, fixtures, and long illustrative drawing/content tables are inspected for structure and consumption; not every art coordinate or data value is individually reviewed. The catalog names the files reviewed and any qualifications.

This is a source review, not a claim that all 103 games were played or benchmarked. The existing Squish test runner reported **38 passing checks and no reported failures** in the current working tree. Its runner does not await async test functions or set a failing exit code for caught assertions, so that result is supporting baseline evidence, not release certification. No new broad game test run or performance measurements were performed for this documentation change.

Entrypoint imports are versioned: 87 use `squish-150`, 14 use `squish-150`, one uses `squish-150`, and one uses `squish-150`. The last is currently a local alias to the Squish working tree, whose package version is still `1.4.5`; it is not evidence of a published 1.4.6 release. Helper availability must be documented per released version.

## What already exists

| Existing facility | What it supplies | Actual gap |
| --- | --- | --- |
| `Game`, `GameNode.Shape/Text/Asset` | Lifecycle, scene graph, input handlers, state listeners | Convenient safe mutation, composite controls, ownership and cleanup scopes |
| `Game.setTimeout/setInterval/close` | Game-owned timer cleanup | Round/player cancellation, stale async completion guards, deterministic tick-driven animation |
| `BaseNode.addChildren`, `update`, `showFor/hideFor` | Basic mutation and audience operations | `update` only handles fill and coordinates; empty arrays mean public, not hidden; controls manually update child labels and audience |
| `ViewableGame`, `ViewUtils.getView` | World plane and a clipped/transformed scene projection | Safer geometry clipping, audience preservation, reusable view nodes, explicit camera transforms |
| `GeometryUtils.checkCollisions` | Recursive scene traversal with rectangle-style bounds checks | General AABBs, circle/segment tests, continuous collision and broad-phase indexing |
| `ShapeUtils`, `Colors` | Rectangles, triangles, palette and random color | Frequently repeated polygon/stroke construction, color operations and reproducible randomness |
| `TerrainGenerator` | Connected random grid terrain | General grid queries/pathfinding and injected randomness |
| `Physics.getPath` | A discrete straight-line path to an edge | It is not a rigid-body or character physics engine; do not advertise it as one |
| `Squisher` | Serialization, player audiences, dirty coalescing, tick scheduling and asset bundles | Authoring helpers should feed it existing nodes; no new scene protocol or broadcast loop is needed |

Source: Squish [`index.js`](../../squish/index.js), [`BaseNode.update`](../../squish/src/BaseNode.js#L101), [`Game`](../../squish/src/Game.js), [`ViewUtils`](../../squish/src/util/views.js), [`GeometryUtils`](../../squish/src/util/geometry.js), [`Physics`](../../squish/src/physics.js), [`Squisher.flush`](../../squish/src/Squisher.js#L321).

Some apparent gaps are already platform features. `homegames-common/game-input.js` normalizes controller input and key ownership. Save APIs, media requests/uploads, pointer lock, custom cursors, RTC and asset distribution are injected host/client capabilities. `GameNode.Stream` is native to Squish 1.4.6 with its own wire field. Those capabilities should have better authoring examples, not a second implementation in Squish.

There are also existing helpers in `homegames-core/src/common/util`: `ExpiringSet` and `animations.fadeIn`. They are candidates for consolidation, but not a blind move: repeated `ExpiringSet.put` does not cancel the old expiry, and both helpers use timers outside a caller-owned scope.

## Prioritized extractions

Names below are proposed API names, not current exports or a commitment to a particular naming scheme.

| Priority | Building block | Evidence across games | Proposed boundary |
| --- | --- | --- | --- |
| First | `Nodes` mutation and containers | Card themes, classic board UIs, nearly every custom Painter, private social screens | Small wrappers over existing nodes; patch text/asset/geometry/color, explicit visibility, one notification per transaction |
| First | `Geometry2D` and viewport clipping | Copperline, Facet, World Eater, Moonbounce, Tremulous; drawing games | Pure polygon clipping, bounds, image crop composition, segment/circle tests and stroke construction |
| First | `Scene` / reusable display list | City Scanner, World Eater, Facet, Copperline, Moonbounce, Tremulous | Stable keyed nodes, active draw order, inactive cache detached from transmitted root, explicit budgets and statistics |
| Next | `PlayerViews` / `Camera2D` | Aquarium Forever, Star Sweeper, View Test, Clicktionary, Fakeout, Imposter, Showboat | Persistent player root and camera transform, host-side visible candidates, audience intersection, disposal |
| Next | `InputState` | Board key latches, Gamepad Test, Moonbounce, Little Slugger, action games | Held/pressed/released actions, repeat policy, pointer accumulation, clear on menu/leave; consume existing platform events |
| Next | `UI` controls | Five identical card themes, classic boards, strategy HUDs, game menus | Buttons, labels, panels, hit regions and layout math; explicit owner, enabled state, press/release policy and style |
| Next | `Scope` / `Timeline` | Bot turn delays, countdowns, social phases, particles, card movement | Cancellation and subscriptions; tick-driven expiry/tweening; clock and phase transitions stay explicit |
| Next | `AudioVoices` and `Sprites` | Happy Haulers, Little Slugger, Tumble Tower, Rainbow Pop, sprite/media demos | Voice instance lifecycle and frame/crop selection; playback/decoding stays in the client |
| Later | `Random`, `Grid`, spatial queries | Card shuffles, board/grid games, strategy pathing, particle/entity scans | Seedable RNG and shuffle; occupancy/neighbors/path queries; optional spatial hash returning candidates |
| Later | `Raycast` / 3D math | Prism 3D, After Hours, Tremulous, projection-heavy strategy/adventure games | Separate grid DDA, ray-box/triangle and convex trace APIs; transforms and clipping, not a universal FPS engine |

### Scene construction and per-player views

This has the largest likely benefit for both authoring and network cost, although savings must be measured during a pilot.

The implementations are related but not interchangeable:

- [City Scanner](../src/games/city-scanner/world/scene.js#L45) keeps a host-side node pool, clips the camera view, and emits visible children; its entrypoint assigns stable pool IDs.
- [Facet's Painter](../src/games/facet/painter.js#L58) clips polygons and retains active operation order.
- [Moonbounce](../src/games/moonbounce/painter.js#L12) uses a 160×90 logical canvas and preallocated pools; its polygon vertex clamping is not general polygon clipping.
- [Copperline](../src/games/copperline/scene.js#L26) reuses ordinal shape/text pools and only attaches active nodes; its isometric scene and western illustration remain game code.
- [World Eater](../src/games/world-eater/painter.js#L80) includes finite-coordinate checks, clipping and active ordered output.
- [Tremulous](../src/games/tremulous/scene.js#L39) uses semantic keys, configured frame/cache budgets, proper polygon clipping and image crop composition. Its renderer raises the frame budget to preserve visible world coverage; `maxNodes` is not a universal hard output cap.

A shared scene builder should preserve node identity by semantic key for interactive entities. An ordinal pool is still useful for anonymous drawing operations, but must not make a different interactive object inherit stale handlers or hover identity. Keep those modes explicit.

Required contract:

1. `begin` starts an output frame; draw operations reuse matching node kinds; `end` commits only active children in requested order. Unused cache entries are not attached to the render tree.
2. Pools are bounded and observable. Expose emitted, cached, clipped and overflow counts. Exceeding a decorative budget must not silently remove required UI/input nodes; allow separate budgets or reserved capacity.
3. Caller chooses logical coordinates and viewport. No fixed 160×90 aspect, arbitrary text truncation, font theme, 900-node cap or game-specific art policy in core. Codec limits on vertex counts, coordinates and subframe size remain real constraints; expose and validate those separately from game-selected budgets.
4. A persistent input/root layer survives frame rebuilds. Draw-only children do not capture clicks by default. A node owned by an active drag remains interaction-live until release/cancel even if its visual disappears: Pocket Front deliberately retains dead enemy nodes during a drag to preserve release delivery. Separate that ownership from an unused drawing cache.
5. Finite geometry is checked at the API boundary. Clip edges geometrically; clamping each vertex can distort a polygon. Compose source-image cropping with viewport cropping.
6. Batched edits produce one dirty notification through existing Squish machinery. Do not duplicate Squisher's broadcast coalescing.
7. Render scenes are projections of the authoritative model. They do not become the simulation data structure or an automatic copy of the whole world.

For player views, retain Homegames' key invariant: **each player receives their visible scene and permitted shared UI, not the whole authoritative world**. Visibility and privacy are separate filters. Camera inclusion cannot grant access to a private node. A proposed `PlayerViews` helper should preserve a root per connected player, intersect visibility with audience restrictions, remove it on leave, and expose explicit camera transforms for input-to-world conversion.

This scopes scene frames, not asset-file confidentiality. Existing games such as Draw and Snap Judgment republish asset bundles to the session; hiding an image node does not remove bytes already delivered to another player. A views helper must not claim to make asset data private. Any future selective asset distribution belongs to the shared runtime contract.

Do not infer simulation ownership from visibility. Vegas Trail runs several minigame simulations while players switch which one they see. A hidden scene does not necessarily mean a paused game.

### Input, UI, and lifetime

Five files are byte-identical: `blackjack/theme.js`, `crazy-eights/theme.js`, `go-fish/theme.js`, `hearts/theme.js`, and `spades/theme.js`. They duplicate text/button/card creation and updates. Extract the generic text/button behavior first; put the card face/back/rank/suit component in an optional Cards kit. The felt, wood, palette, dimensions and rank rules belong in styles/game data.

`InputState` should make common distinctions explicit: held versus fresh press, release, repeat delay/rate, relative pointer deltas versus absolute position, and consumption by a menu or gameplay context. It should consume normalized game callbacks rather than attach DOM listeners, poll controllers or send RTC messages. Clear owned actions when a player leaves or a context changes. Preserve numeric/string ID conventions deliberately.

Do not globally change `onClick` to a single-shot event. Seance intentionally uses sustained input; other games suppress repeats. A button can offer a policy without changing legacy dispatch.

`Scope` should own cancellation and disposal for a round or player: timers, subscriptions, deferred bot work and async asset/media completion guards. Closing a round invalidates its late callbacks even if a player ID or phase name is reused. `Timeline` should be driven by the game's chosen clock for tweens, cooldowns and expiry; it should not create another global ticker. Squisher already owns tick scheduling, and existing games mix fixed simulation steps with wall-clock deadlines.

Keep the state machine explicit. A small transition/cancellation helper is more credible than a universal RoundManager: Hearts' tricks, a board game's extra turn, a social vote deadline, and an FPS capture objective have materially different rules. A ballot/readiness collector can be an optional helper with an eligibility snapshot and a specified disconnect policy.

An optional `FixedStepper.advance(dt, callback)` can consolidate bounded accumulators used by Tumble Tower, Little Rambler, Moonbounce, Facet and Red Truck Ramble. It consumes elapsed time supplied by the caller rather than scheduling ticks. Make catch-up limits, dropped time, pause and interpolation explicit. Moonbounce's fast-forward/slow motion and City Scanner's separate input/camera time during pause must remain deliberate game choices.

### Audio and asset animation

Several games implement PCM16 WAV headers, synthesized samples, bounded sound pools, cooldowns and removal of expired sound nodes. Separate these concerns:

- `encodePCM16Wav` can be a pure, browser-safe byte encoder. Pitch recipes, musical cues and impact thresholds remain local.
- `AudioVoices` can allocate distinct node identities, attach scoped audio nodes, expire them, stop them on dispose, and enforce a caller-selected voice budget.
- `Sprites` can select frames and compute source crops from a supplied clock. Do not conflate short sprite animations with streamed video or whole-world rendering.

**Current-client detail matters:** [`renderer.js`](../../homegames-client/src/renderer.js#L142) keys playing sounds by `node.id + assetKey`, not asset key alone. Existing games that duplicate asset bytes/keys per voice contain legacy workarounds; those should not become a new core requirement. Replaying the same node/key still depends on the receiver observing its removal, or on a fresh instance identity. A 100 ms host-side absence is not a guarantee that every slow RTC receiver observed an absent frame. A robust replay contract needs bounded instance identity semantics; reliable delivery of transient sound events would be a coordinated runtime/protocol feature, not something Squish alone can promise.

There is also an asset-loader boundary. [`portable-runtime.js`](../../homegames-common/portable-runtime.js#L14) replaces `Asset` with `ProjectAsset`, which accepts declared relative paths and rejects hosted IDs. It does not expose the legacy arbitrary-byte constructor contract. An extracted sound factory must not close over the Node-only Asset implementation or assume `new Asset({id}, bytes)` works in every portable project. Support supplied asset keys first; use pre-generated project WAV files or a separately specified portable dynamic-asset adapter for synthesis. Preserve the existing injected `addAsset`/media capabilities instead of adding network or filesystem behavior to Squish utilities.

Registration convenience can share a pending promise, record success only after completion and allow retry, as Pocket Front demonstrates. Keep retained asset bytes separate from buffers handed to transfer/decoding operations so late-joining guests can still receive them. These are lifecycle contracts around supplied platform functions, not a new asset server.

### Math, collision, cameras, and raycasting

Favor independently useful pure functions: vectors, angle wrapping, bounds, segment distance, point-in-shape, circle/AABB tests, polygon clipping, seeded shuffle and explicit transforms. Define units, edge inclusion, zero-length behavior and finite-input handling. Specify which polygon classes are supported and whether clipping can return multiple pieces; a four-edge clipping loop is not a general tessellator. Every two-line clamp function does not need a new public module; group coherent operations and document them.

Keep collision and rendering geometry distinct. A screen polygon is not automatically a physical wall. A spatial hash returns candidates, followed by a precise test; it is neither an audience filter nor a collision response engine.

For randomness, support injected streams and a documented algorithm/state format. Existing games use different LCG, xorshift and other generators; silently replacing them changes seeded worlds and replays. A shuffle bag with a no-immediate-repeat option is independently useful, as Tiny Bean Cafe demonstrates.

Raycasting is worth extracting, with separate algorithms:

- Prism 3D and [After Hours](../src/games/after-hours/engine.js#L46) traverse a 2D occupancy grid with DDA. Generalize the cell query and return distance, hit point, normal/side and cell. Keep texture choice, damage and fish-eye projection correction in the caller.
- [Tremulous](../src/games/tremulous/world.js#L12) traces imported convex world solids; its engine also tests entity boxes. These need 3D ray/segment and swept-shape contracts, not a grid-ray wrapper with extra flags.
- Tremulous's recent floor/patch fixes are evidence to harden the geometry before promoting it. Retain collinear-leading-vertex, seam, start-inside, curved-patch and raw-triangle comparison fixtures.

Keep Quake/Tremulous movement tuning, stair behavior, wall-walking, pounce, hit-zone multipliers, weapon balance and faction progression in game code initially. Likewise, Tumble Tower's SAT/impulse solver, billiards collision response and platformer physics deserve an optional, separately tested physics package if shared demand grows. One `Physics` abstraction spanning all of these would hide important differences.

## Correctness issues to resolve before promotion

These are extraction hazards found in the source, not an assertion that every game currently exhibits each symptom:

| Hazard | Evidence | Required handling |
| --- | --- | --- |
| Private source audience lost in legacy projection | `ViewUtils.getView` assigns `copied.node.playerIds = playerIds || []` at line 150 | New projection intersects authorized audience; regression tests prove secret nodes never enter another player's serialized frame |
| Clone behavior is inconsistent | Text/Asset clone reads `this.playerIds` rather than `this.node.playerIds`, omits supplied input/click handlers; Asset payload is shallow-copied | Define cloning semantics and copy mutable nested crop/position state; avoid cross-camera mutation |
| Polygon clamping changes shape | Legacy ViewUtils and some Painters clamp vertices independently | New clipping utility with offscreen, diagonal, enclosing and degenerate cases |
| Hiding pooled nodes can still cost serialization work | Some pools leave zero-area unused nodes attached | Detach inactive cache; measure serialized nodes/bytes, not just what appears onscreen |
| Replaced expiry fires early | Core `ExpiringSet.put` retains the old timer | Cancel/replace old expiry or use tick-driven deadlines; scope disposal |
| Legacy Physics path has unsafe edge cases | `getPath` can fail on an immediate out-of-bounds first step and has no termination for zero velocity inside bounds | Do not build new general physics helpers on that contract without tests and a deliberate versioned fix |
| Runtime versions differ | Older node constructors lack newer release handlers; imports span 142–146 | Publish opt-in exports and a compatibility table; do not assume working-tree features exist in 142 |
| Procedural assets are not universally portable | `ProjectAsset` is a path-only adapter | Specify an asset factory boundary before promoting audio synthesis or byte-generating media helpers |

## Optional kits and what stays local

| Optional kit / recipe | Share | Keep local |
| --- | --- | --- |
| Cards and boards | Deck/shuffle, card presentation, grid coordinates, seats, legal-choice display | Rank/scoring rules, turn legality, minimax, bids, tricks, bot strategy |
| Social rounds | Ballot/readiness collection, deadline display, roster-owned screens | Secret prompts, truth/lie roles, scoring, disconnect rules chosen by each game |
| Drawing and media | Aspect-aware stroke extrusion, chunking, image fit, frame/crop math | Prompts, judging, upload permission/transport and art assets |
| Action game recipes | Projectiles/expiry examples, effects pools, damage interface examples | Weapon semantics, balances, encounter design, faction/class progression |
| Grid/navigation | Occupancy, neighbors, BFS/A* with supplied costs, optional spatial index | RTS economy, command AI, map objectives and terrain policy |
| Persistent progression | Validation/migration recipe and optional write/revision coalescing around injected save APIs | Save schema, inventory meaning, unlocks, rewards, resumed-run accounting |

Avoid a universal entity-component system, BoardGame superclass, FPS engine, database/save framework, or replacement renderer as the first extraction. The catalog shows meaningful divergence, and existing games already compose small engines/renderers successfully. Generated art, maps, sound recipes and level data should remain portable game assets.

## Delivery sequence and acceptance criteria

1. **Define contracts and add the smallest utilities.** Node mutation/group wrappers and pure clipping/crop/bounds helpers. Test zero/empty values, clearing fields, finite inputs, edge geometry, nested asset copies and audience behavior. Existing methods remain available.
2. **Pilot scene/UI reuse across two different games.** Use a small classic such as Connect Four for labels/buttons and City Scanner for camera clipping and active scene output. Test independent player cameras with Star Sweeper when adding `PlayerViews`; Aquarium Forever (`aquarium-forever 5`) instead demonstrates a shared camera with private HUDs. Preserve those ownership choices. Keep After Hours unchanged during the initial extraction. Compare input behavior, visual output, hover identity, node count, serialization size and host tick cost at the same world/player count.
3. **Add input and scope helpers.** Prove press/hold/release and stale callback cancellation in a turn-based game and an arcade game. Keep a deliberate sustained-input example such as Seance. Test disconnect, reconnect, restart and game close.
4. **Add audio/sprite helpers with a documented asset contract.** Verify local host, self-hosted client, portable import/export, RTC guest, mute/unmute and repeated/overlapping playback. Do not assume a successful local sound proves remote replay behavior.
5. **Extract ray/grid/navigation helpers independently.** Use After Hours/Prism as DDA fixtures and Tremulous as a separate convex geometry consumer. Require boundary/adversarial tests before replacing local math. Keep genre engines optional.
6. **Publish deliberately.** Choose the next actual release version, update the canonical version map and browser/Node bundles, document availability, then opt in pilot games. Preserve old `squish-NNN` behavior. The portable loader accepts the exact versioned package or relative project modules, so adding arbitrary package subpaths needs explicit loader support.
7. **Migrate incrementally with user playtesting.** Preserve retired implementations as commented code during the requested trial period. Do not mass-switch all games or deploy the website as part of the extraction. Promote a helper after two independent uses; keep single-game policy local.

For each pilot, tests must inspect a guest's decoded frame for offscreen/other-player content, not merely assert that a node is transparent. Verify bounded caches after camera travel, stable identity under changing draw order, same seed/input behavior where relevant, and cleanup after many joins/leaves. Use existing representative browser/RTC tests where appropriate; do not run every game's expensive suite for each tiny helper edit.

## Making this useful to people and agents

Ship the utilities with a short API index, JSDoc/types, a version-availability table, and three complete small examples: a private two-player board UI, a scrolling co-op scene, and an action game with audio and round cleanup. Explain which coordinates are world/logical/screen coordinates and which objects are authoritative versus transmitted.

Each example should include portable relative assets, player join/leave, input ownership, cleanup, and a focused visibility test. Include concrete limits and failure behavior. Update the shared Homegames context document after APIs exist; until then this proposal must not be presented as installed functionality.

The [complete catalog](game-building-blocks-catalog.md) records how each current game contributes to the proposal and which parts should remain game-specific.
