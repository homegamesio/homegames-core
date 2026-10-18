# Game building-block catalog

Source review: 2026-10-11. All **103 top-level `src/games` directories** are represented, including demos, prototypes and untracked games. See the [extraction proposal](squish-building-blocks-review.md) for priorities, existing Squish capabilities, proposed APIs, compatibility constraints and validation gates.

Entries describe implemented behavior and reuse opportunities, not release quality or proof of successful browser play. Authored support modules were reviewed with their entrypoints; generated art/map tables were inspected for schema and usage. This is a mutable working-tree review, not a commit-pinned snapshot. Some games changed during the review and were reread; source line references may move with subsequent edits.

“Candidates” below are proposals. The extraction report resolves overlapping names into a smaller public API and distinguishes Squish utilities from existing host/client capabilities. No game logic was migrated by this review.

## Index

| Directory | Implemented experience |
| --- | --- |
| [after-hours](#after-hours) | Eight-player host-simulated raycast arena tour across a media museum and four themed maps, with six weapons, pitched aim/jumping, hitscan/projectiles, bots, map/mode voting, FFA, capture-the-flag and domination; each visitor receives only their projected scene and scoped audible events. |
| [animation-test](#animation-test) | Thirty-image animation with pause/resume and selectable 1–30 fps, advanced by wall-clock deadlines inside tick. |
| [aquarium](#aquarium) | Shared aquarium economy: feeding fish and cleaning algae produce coins used for fish, decor and night mode. A 20 Hz host simulation advances hunger, food pursuit and bubbles with fixed scene pools; this is one shared tank/economy, not the per-player economy of Aquarium Forever. |
| [aquarium-forever 5](#aquarium-forever-5) | Shared tank expands horizontally across four tiers while each of up to eight players has points, food upgrades and purchases. Food records identify the feeding player for reward credit; players share fish/world/camera but receive private shop/HUD roots. Host simulation uses large fixed pools, camera projection/culling and an export-only checkpoint method. |
| [backgammon](#backgammon) | Two-seat backgammon with human/bot replacement, opening-die contest, bar re-entry and bearing off, maximum-dice/larger-die legality, doubling cube, gammon/backgammon scoring, animated moves and rematches. |
| [battleship](#battleship) | Two-seat fleet placement and firing game. Each human has private own-fleet and target tabs; ready humans face humans or bots. Target search pursues adjacent hits, spectators have a separate view, and fleets are exposed after the match. |
| [billiards](#billiards) | Host-simulated eight-ball pool with drag/release cue shots, human/human or optional bot, aim ghosts, adaptive fixed-step ball contacts, pockets, scratch respotting, group assignment, turn settlement and match end. |
| [blackjack](#blackjack) | Up to four human seats wager a reusable bankroll against an automated dealer, with readiness, ace-soft totals, hit/stand/double, one split, special split-ace handling, natural payouts and repeated hands. |
| [cabinet](#cabinet) | Two seated players operate a real CHIP-8 Pong ROM while other users spectate; game module includes a CPU, assembler and authored assembly source, with register/timer diagnostics. |
| [checkers](#checkers) | American-style checkers against a bot or another human, with mandatory captures, forced multi-jumps, king promotion, legal-move highlights, keyboard focus, animated paths, minimax turns, scores and rematches. |
| [chess](#chess) | Two-seat chess with bots, legal king-safe moves, castling, en passant, private promotion choices, checkmate/stalemate, fifty-move/repetition/insufficient-material draws, move animation and rematches. |
| [city-scanner](#city-scanner) | An interactive simulated city with traffic, pedestrians, cafe queues, wildlife, weather and lighting spread across a wide generated world. Up to eight players share camera controls and world interactions; pause stops simulation while input/camera time continue. It reuses stable keyed drawing slots and derives a clipped active scene from a retained host hierarchy. |
| [clicktionary](#clicktionary) | Two-to-eight-player drawing/guessing party game: rotate artists, choose a word, draw under a deadline and ink budget, privately validate near guesses, award time-based points, reveal hints, then show round/game podiums. |
| [clump](#clump) | Single-player polygonal Katamari-like growth game: absorb progressively larger objects from pins to celestial bodies in a 900-unit world, with many species-specific behaviors, size-dependent camera zoom, inertia, obstacles and a 210-second clock armed by first input. |
| [connect-four](#connect-four) | Two-seat gravity Connect Four with whole-column click targets, numbered keyboard input, animated falling counters, four-direction winner detection, a depth-limited alpha-beta bot and rematches. |
| [copperline](#copperline) | Single-player frontier action RPG with on-foot/horse/train travel, combat, dialogue, missions, repeatable bounties and property income. A pure host engine owns world and campaign data; the adapter rotates movement for an isometric camera and resolves screen aim. A clipped bounded painter outputs only visible nodes; schema-aware saves rebuild valid state and discard transient attacks. |
| [crazy-eights](#crazy-eights) | Two-seat shedding game with private paginated hands, rank/suit matching, wild eights with suit selection, draw/pass handling, discard recycling, bot opponents, first-empty-hand win and rematches. |
| [cursor-test](#cursor-test) | Hovering the center square applies a per-player image cursor; leaving resets it. Focused cursor integration demo. |
| [defuse](#defuse) | Two-to-eight-player asymmetric co-op bomb mission. A rotating defuser manipulates wire/keypad/button/sequencer modules while experts see separate manual pages; three timed bombs, strikes, debriefs, readiness and disconnect reassignment are implemented. |
| [device-test](#device-test) | Creates a private color screen according to each client’s desktop/mobile/tablet classification. |
| [doodle-invaders](#doodle-invaders) | Four-pilot cooperative Space Invaders with shared lives, personal firing limits, marching two-frame aliens, every-third-wave bosses and late joins; all authored media IDs remain placeholders, so the source runs shape fallbacks without its advertised drawn assets or sounds. |
| [drag-test](#drag-test) | Players grab labeled boxes with offset-preserving drags or rubber-band new rectangles on the background, with bounded history and disconnect cleanup. |
| [draw](#draw) | Shared 4000×4000 drawing board with each player owning a pan/zoom camera and toolbar. Host keeps world strokes, renders only view-projected chunks/items, accepts image/audio uploads, and supports quorum clearing with a cooldown. |
| [engine-room](#engine-room) | Cooperative asymmetric console game: each player sees four owned controls and a timed repair order usually targeting someone else’s console; missed orders damage shared hull across three sectors. |
| [enhanced-view-test](#enhanced-view-test) | Modular experimental cooperative resource/combat game: explore an 800-unit world, automatically gather sugar/lemons and fight guards, buy shared upgrades, then price and sell lemonade to recurring customer types; sugar addiction can produce later bosses. Private 100-unit cameras surround a shared simulation and multi-phase economy. |
| [facet](#facet) | Match-three puzzle campaign with an 8×8 board, cascades, special gems, frost/radiance goals and journey/zen/timed rush modes. Input supports selection or dragging to an adjacent cell; the fixed-step engine animates swap/match/fall/shuffle phases and guarantees a playable settled board. Career progress counts deltas, and only validated ready-state snapshots resume. |
| [fakeout](#fakeout) | Two-to-eight-player bluffing quiz with six prompts: privately submit lies, merge duplicate lies, award truth-near submissions, anonymously vote without voting for one’s own answer, reveal authors and scores, then continue to a podium. |
| [flick](#flick) | Slingshot arena where each player drags their ball backward then releases; circular impulses, wall bounces and target shrapnel create scored chains. |
| [gamepad-test](#gamepad-test) | Moves a shared square via mapped keys, switches color on fresh presses and displays raw right-stick/controller status. |
| [geom-storm](#geom-storm) | Shared single-ship neon survival shooter with WASD movement, directional or auto-fire, escalating enemy swarms, collectible multipliers, bombs and extensive particles; explicitly a node-count stress game. |
| [go-fish](#go-fish) | Four-seat Go Fish with human/bot replacement, five-card deals, rank requests against selected opponents, successful-request extra turns, matching fish continuation, empty-hand refills, four-card books and match wins. |
| [grand-finale](#grand-finale) | Shared 75-second fireworks competition: tapping a rocket spends a personal fuse, expanding blasts ignite delayed cascades and award increasing chain-depth points; the last twelve seconds intensify spawns. |
| [grid-test](#grid-test) | Builds a 10×10 white hover grid whenever a player joins; hovered cells become red. |
| [halloween-words](#halloween-words) | Single shared owl-catcher experience: left/right movement catches falling Halloween treats, spiders empty the bag, successful catches add points, and sound effects accompany events. The title does not describe a word-matching mechanic. |
| [hangman](#hangman) | Multiplayer hangman with rotating secret-phrase authors, CPU phrases when needed, timed phrase entry, letter guesses and player statistics. Players can draw six cumulative custom hangman frames using a private editor; default image/audio assets remain available. |
| [happy-haulers](#happy-haulers) | A gentle construction activity now lets the player choose castle, bridge or garden, load three colored cargo pieces per delivery, drive the truck and tip them onto a blueprint. Three deliveries complete the chosen project; a timed sequence animates truck/bed/cargo and a celebration returns to project choice. Composite vector parts are retained and transformed, with a bounded particle pool. |
| [hearts](#hearts) | Four-seat Hearts with bots, three-card left/right/across/hold passes, two-clubs opening, follow-suit and hearts-breaking rules, first-trick restrictions, trick animations, shooting the moon and a 100-point match threshold. |
| [hot-potato](#hot-potato) | At least two players pass a private potato by clicking; a random timer explodes it for its current holder, with transferred hiss playback offset. |
| [image-test](#image-test) | Moves, resizes, resets and changes per-edge crop percentages of an image. |
| [imposter](#imposter) | Three-to-eight-player phone-oriented social deduction. Crew see a secret word within a shared 16-word category grid, one imposter does not; everyone readies, discusses in an order, votes, and a caught imposter gets a word guess before results. |
| [input-test](#input-test) | Editable text and dynamic image/audio/video upload demo with clear and replay controls. |
| [iron-keep](#iron-keep) | Four-human medieval raycast arena with bots, connected procedural mazes, texture-strip walls, animated knight billboards, hitscan crossbow, respawns and a first-to-five/three-minute match; source media remain unfilled REPLACE_* IDs. |
| [kaboom-valley](#kaboom-valley) | Two-to-four-tank turn-based artillery game with bots, procedurally sampled hills, circular crater carving, wind/gravity trajectories, damage and post-explosion falling; disconnected pilots become bots. |
| [keep-up](#keep-up) | Cooperative 90-second balloon keep-up with gradually added balloons, gravity, bounces, team streaks and individual contribution results. |
| [layer-test](#layer-test) | Overlapping colored layer roots change color on click; tick emits state changes. |
| [little-rambler](#little-rambler) | A persistent companion home with feeding, petting, growth and furnishings funds two outings: a side-view garden platform walk and bouncing-magnet salvage. The pure engine uses 120 Hz steps, coyote time/jump buffering and once-only outing rewards, including early return. Adapter handles modal menus, input ownership, native hover/cursors, name entry, revision-based persistence and scene-specific music. |
| [little-scoop-shop](#little-scoop-shop) | Pointer-led ice cream activity: choose cone/cup, add up to three flavors, toggle sprinkles/cherry and serve a bunny. Current source also generates picture orders; matching is forgiving about scoop order and earns a special favorite response while any treat can be served. Timed scoop/topping/serving phases retain transformed vector parts and a small PCM voice bank. |
| [little-slugger](#little-slugger) | Assisted batting activity with tee and pitch modes, selectable colored targets, three-star collection and moving targets on later rounds. A correctly timed pitch swing makes a sky hit; an early/late press queues an assisted line drive; tee mode produces a bounce. Trajectories and character animation are authored rather than a full ball/bat collision simulation. |
| [little-zoo-walk](#little-zoo-walk) | Circular zoo walk through six animated animal habitats, with greeting, feeding and catch activities. Choosing a snack then the animal, or tapping the moving ball, earns per-visit progress and a stamp after three interactions. Walking swaps habitat midway; species-specific limb/pivot animation and cries share generic vector transforms and sound lifecycle. |
| [mancala](#mancala) | Two-seat Kalah-style Mancala with six pits each, extra turns for landing in the own store, opposite capture, terminal sweeping, animated sowing, minimax bot moves and alternating starts across rematches. |
| [masterpiece](#masterpiece) | Three-by-four sliding painting puzzle with 11 cropped tiles and one blank, legal adjacency moves, a solvable random-walk shuffle, move counter, temporary full-image peek and victory display followed by reshuffle. |
| [mem-test](#mem-test) | Allocation stress example replaces one visible red square every tick. |
| [micro-mayhem](#micro-mayhem) | Eight-seat tap-only party gauntlet that shuffles five distinct challenges: odd color tile, reaction draw, Stroop ink choice, sequence memory and briefly displayed triangle counting; awards arrival-ranked points and a final podium. |
| [moonbounce](#moonbounce) | Peg-bouncing campaign across authored boards and worlds, with five selectable powers, moving pegs, bumpers, portals, catches and mastery challenges. A 120 Hz engine provides launch preview using the same collision routine while suppressing score side effects; fast-forward adds ordinary steps and yields to anticipation/fever slow motion. Adapter records shot results into migrated progression and manages aiming, menus and world music. |
| [move-test](#move-test) | Two rectangles move using arrows/WASD or analog sticks, clamp to the board and reject AABB overlaps. |
| [neon-grid](#neon-grid) | Six-seat Tron-style light-cycle arena with four minimum riders filled by bots, permanent grid trails, simultaneous collision resolution, countdowns and inter-round scoring. |
| [nova-guard](#nova-guard) | Cooperative orbital shields rotate around a shared core to block inward-moving enemies; waves scale with crew size and include multi-hit bosses. |
| [orbit-breaker](#orbit-breaker) | Single-player twin-stick combat built around catching hostile shots in a directional cone and returning captured orbiting ammunition, with dash/nova, sectors, upgrades and a practice mode. The engine owns combat; adapter owns input device lease, stale-input timeouts and pause/menu transitions. Its phase-sized painter keeps unused pools attached and hidden. |
| [perf-test](#perf-test) | Appends randomly colored 1×1 rectangles at 20ms intervals to stress scene size. |
| [player-vis-test](#player-vis-test) | Show/hide buttons reveal a secret parent and child only to the clicking player; spectator gets a different root. |
| [pocket-front](#pocket-front) | Single-player compact RTS: place structures, recruit ranger/tank/medic forces, drag-select units and command attacks while defending waves and capturing a beacon. Six-wave and endless progression offer upgrades. The adapter maintains stable enemy interaction nodes; a dead enemy node remains hidden during an active drag to preserve release delivery. Feedback combines retryable asset registration, cursor state and rate-limited audio. |
| [prism-3d](#prism-3d) | Four-human first-person laser-tag maze with bot opponents, per-player 56-column views, line-of-sight hits, respawns and shared minimap/scoreboard. |
| [raft](#raft) | Cooperative 150-second river run: every player paddles a shared raft left/right, following a narrowing sine channel while collecting ducks and bouncing off banks. |
| [rainbow-pop](#rainbow-pop) | Pop six colored balloons to assemble a rainbow, with a current requested color from Bunny providing an optional matching reward. Any balloon still contributes, so the matching prompt does not block completion. A celebration resets the round; retained balloon parts, particle slots and short-tap input share infrastructure with the other playtime games. |
| [red-truck-ramble](#red-truck-ramble) | Continuous toy driving over a seamless repeating terrain course, using cruise/reverse controls and keyboard movement. Speed and ramp-lip crossing trigger assisted jumps; queued flips and soft wheelbase suspension make the truck forgiving. Camera/parallax rendering follows a deterministic fixed-step vehicle engine; periodic engine sound segments track motion. |
| [relic-rush](#relic-rush) | One active runner races a three-lane first-person corridor while others spectate, jumping low bars, ducking high beams and collecting height-specific coins. |
| [sandy-castle](#sandy-castle) | Beach activity alternates scoop, fill and flip actions to place three molded towers, then lets the player choose and spatially place flags/shells before washing the castle away. Current source adds mold/placement choice and repeat-round variation. A phase clock drives bucket/shovel/wave animation; pointer targets track the appropriate object. |
| [savegame_demo](#savegamedemo) | Click counter restores injected saveData and saves a plain snapshot through saveGame. |
| [scale-test](#scale-test) | Side-by-side geometry/image size calibration in a tall aspect-ratio viewport. |
| [seance](#seance) | One-to-eight-player collaborative Ouija toy: players hold/drag on a board to exert normalized force on a damped planchette alongside ambient spirit bias, dwell selects letters/answers, and farewell reports each participant’s influence. |
| [shape-test](#shape-test) | Static concave polygon with an empty click callback; focused polygon rendering test. |
| [sheep-drive](#sheep-drive) | Up to eight dogs steer by pointer targets to herd flocking sheep through a pen gate over three rounds, adding a pond and stubborn goat. |
| [showboat](#showboat) | Two-to-six-player acting game with a pure rule engine: roster-based performer rotation, private prompts, preparation/performance/vote/reveal stages, audience answer points, claps and optional room/remote live media. |
| [slaps](#slaps) | Legacy card comparison game: when at least two players join, deal one card per player, display it publicly, award the highest-value player and expose a new-game control after a short delay. |
| [snap-judgment](#snap-judgment) | Three-to-eight-player photo scavenger party game: rotate a judge, give other players a timed upload prompt, shuffle anonymous submissions, judge each photo with thumbs up/down, award submission/approval points, reveal authors and totals. |
| [sound-test](#sound-test) | Play/pause demo attaches or removes an audio Asset and manually tracks resumed playback time. |
| [spades](#spades) | Four-seat partnership Spades with bots, bids including nil, follow-suit and spades-breaking rules, trick collection, contract/bag/nil scoring, bag penalties and match thresholds. |
| [sponge](#sponge) | Sink-themed Pong supports solo control of both paddles or one side each, bouncing a skinned ball and updating scores/audio. |
| [sprite-test](#sprite-test) | Players occupy dancer spots and alternate idle/directional image frames when keys or touch regions are pressed. |
| [squarer](#squarer) | Multiplayer lane-crossing game: squares step upward through wrapping moving hazards to a destination; reaching it raises hazard density and resets players. |
| [star-sweeper](#star-sweeper) | Six-player 90-second orb race across a 300×300 world, with ship inertia, asteroid knockback, dropped pickups, private following cameras and shared minimap. |
| [starfall-salvage](#starfall-salvage) | Single-player space adventure with a modular ship, six sectors, boardable interiors, recruitable crew, combat/mining, contracts and mission choices. World and boarding contexts preserve host enemy/loot state while swapping camera scale and movement/collision rules. Explicit schema-aware saves validate content IDs and reachable positions, reset transient attacks and reconstruct progression. |
| [starry-sparkles](#starry-sparkles) | An open-ended night-sky painting toy: choose colors and launch flower/star/heart bursts anywhere, or light the large stars to complete rotating sky pictures. Each launch uses a bounded rotating burst slot, a travel interval then delayed sound and bloom; completed pictures briefly celebrate before advancing. It redraws only while animation/audio changes require it. |
| [sundown](#sundown) | Single-player 90-second pseudo-3D sunset racer with a looping segmented road, hills and curves, traffic avoidance, distance scoring and collision time penalties; declared simulation rate is 120 Hz. |
| [sunside](#sunside) | Procedural character studio with wardrobe, pose animation, view controls and a short timing-based volley challenge. Host-side 3D mesh construction, two-bone arm IK, spring motion, camera projection, backface/light/depth processing and clipping produce 2D Squish polygons; no client 3D engine receives the mesh/world. Save data stores look and best score. |
| [sunwake](#sunwake) | Cooperative skyship expedition for up to six crew across three beacons and a final boss. Players select helm/gunner/engineer/scout, with empty stations automated; route/refit votes advance the shared ship. Shared isometric world rendering is combined with private role HUDs and per-player sound audience. Optional flag upload and push-to-talk radio use injected host services and explicit cleanup. |
| [testions](#testions) | Two-player question game alternates whose answer is guessed; both submit private binary answers, then a shared result advances the question. |
| [text-input](#text-input) | Up to four writers share independent typewriter panels with raw-key editing, mobile text input, wrapping, scrolling and blinking caret. |
| [the-argument](#the-argument) | Three-to-eight-player social decision narrative across 11 authored rounds. Players receive differing private briefs, discuss, spend trust tokens to reveal information, commit choices, and see consequences to shared health/audit meters and final debrief. |
| [tic-tac-toe](#tic-tac-toe) | Two-seat tic-tac-toe with human/bot replacement, numbered keyboard input, perfect-style minimax O play plus fallback when the other human leaves, animated marks, score tracking and rematches. |
| [tiny-bean-cafe](#tiny-bean-cafe) | Pointer-led cafe lets the player choose a drink and perform its pictured preparation steps, then serve a varied customer. Customer/order/wardrobe shuffle bags avoid immediate repetition; fulfilling the favorite gets an enhanced celebration while freeform choices remain possible. Retained cup ingredients, equipment, customer geometry and whipped cream animate in a scaled stage with quiet synthesized Foley. |
| [tremulous](#tremulous) | Classic 1.1-inspired asymmetric aliens-versus-humans FPS on imported ATCS geometry: humans buy weapons and upgrades, aliens evolve and wall-walk, both teams build powered/creep-linked bases and win by eliminating enemy spawns and survivors. A separate authoritative engine drives private first-person Squish scenes, offline-baked original-model sprite atlases, bots and positional event sounds. |
| [tug-club](#tug-club) | One-to-six-player cooperative space salvage: latch ships onto weighted cargo, share spring-like tow forces, dodge orbiting hazards and power a home before a three-minute storm; saves compact win records. |
| [tumble-tower](#tumble-tower) | Toy stacking lets the player choose block shape and one of three lanes, build up to eight stable blocks, then roll a ball to release them into a tumble. Host 120 Hz oriented-box contact/impulse simulation handles friction, rotation, impacts and sleep; deliberate build-time snapping and launch nudges provide a forgiving toy feel. Settled blocks can be tapped before restarting. |
| [vector-siege](#vector-siege) | Single-player generated-sector RTS with optional direct twin-stick intervention, plus an arena/capture campaign mode. War keeps twelve persistent battlefield objects stepping on the host whether viewed or not; fleets transfer unit state and the hero enters/leaves the same battle. Painter and input adapter expose only the selected map/battle scene; saved preferences/best score do not persist the War simulation. |
| [vegas-trail](#vegas-trail) | Cooperative Tucson-to-Vegas survival journey with shared food/ammo/scrap/vehicle/health resources. Players switch visible map/shop, driving, hunting, illness-fighting and conversation views while all subgames continue simulating on the host; landmarks change zones and reaching Vegas triggers victory. |
| [view-test](#view-test) | Each player pans a private 100×100 view over a 200×200 world containing colored clickable rectangles. |
| [walkie-talkie](#walkie-talkie) | Six-seat push-to-talk podium: first holder becomes the shared audio/video broadcaster, with private microphone controls and explicit permission requests. |
| [wat](#wat) | Unfinished shared tower-defense prototype with a fixed waypoint lane, three purchasable tower types, nearest-target firing, pooled particles and wave counters; advertised endless progression is not implemented reliably. |
| [word-match](#word-match) | Desktop test/demo word-association game: choose two responders, show each a random word and private keyboard-entry field, wait until ready, reveal answers after a countdown, award group points for matching answers or an all-player close-enough vote. |
| [wordforge](#wordforge) | Explicit cooperative platformer demo: players type words that materialize temporary platforms, with special wall/ramp/boost/step shapes, move/jump upward above a rising flood, die in flood or win at the top; phone presets and pooled effects are included. |
| [world-eater](#world-eater) | Persistent cooperative campaign for up to six drones escorting a living ark across five sectors. Pilots fight, harvest or rescue worlds and grow upgrades; the ark follows crew centroid while tether limits keep drones nearby. Host world state/checkpoints remain separate from a clipped bounded scene with offscreen culling and private pilot HUDs. Audio adds prioritized voice stealing and phrase-based atmosphere. |
| [zap-tap](#zap-tap) | Shared 4×3 reaction grid lights random tiles; first valid tap scores, difficulty speeds up over 45 seconds, then six-second winner intermission. |

## after-hours

Eight-player host-simulated raycast arena tour across a media museum and four themed maps, with six weapons, pitched aim/jumping, hitscan/projectiles, bots, map/mode voting, FFA, capture-the-flag and domination; each visitor receives only their projected scene and scoped audible events.

**Files reviewed:** [index.js](../src/games/after-hours/index.js), [engine.js](../src/games/after-hours/engine.js), [render.js](../src/games/after-hours/render.js), [world.js](../src/games/after-hours/world.js), [maps.js](../src/games/after-hours/maps.js), [arena-ui.js](../src/games/after-hours/arena-ui.js), [arena-objects.js](../src/games/after-hours/arena-objects.js), [weapons-render.js](../src/games/after-hours/weapons-render.js).

**Building blocks:** Keyed retained Scene wrapper with geometric clipping and composed media crops; Grid DDA reused by rendering, LOS and combat; circle-grid collision and BFS path queries; Per-view input/cursor state, bounded sound/effect lifetimes and private visible scene construction; Grid run merging for map thumbnails and world panels.

**Existing facilities:** Game/GameNode retained scene, playerIds, input callbacks and Asset image/video/audio primitives; Injected setCursor and pointerLock metadata already provide host/client integration; ViewableGame/ViewUtils already provide 2D camera projection; TerrainGenerator already provides grid generation.

**Candidates:** Pure raycastGrid(origin,direction,maxDistance,cellAt) with finite/zero-axis/start-solid contracts; Scene keyed builder with stable identity, clipped rect/poly/image, stale-node removal and output budget; Pure circle-AABB/grid query, substepped movement optional and reusable grid BFS; AudioHandle and tick-owned scoped lifetime utilities with audience/cancel semantics; Grid-to-rectangle compaction for UI previews.

**Keep local:** Museum/arena content, weapon balance/viewmodel art, objective modes, bots, lobby vote rules and team policy; Finite-height hit zones, approximate column occlusion and complete FPS engine; Per-player audio eligibility rules such as hearing range and LOS.

**Source evidence:**

- [engine.js:46 — function raycast](../src/games/after-hours/engine.js#L46): Guarded normalized grid DDA returns world distance, hit cell, side and texture coordinate.
- [render.js:18 — class Scene](../src/games/after-hours/render.js#L18): Retains nodes by stable keys, clips geometry, composes image crops and removes unused nodes.
- [render.js:258 — const visibleItems=](../src/games/after-hours/render.js#L258): Culls and wall-clips world objects before adding the per-player output scene.
- [index.js:157 — sound(id,key](../src/games/after-hours/index.js#L157): Adds private audio nodes with duration and a hard ten-instance cap.
- [engine.js:745 — _pathTo(player](../src/games/after-hours/engine.js#L745): Uses breadth-first search over walkable grid cells; bot goals remain game rules.
- [arena-ui.js:10 — function preview](../src/games/after-hours/arena-ui.js#L10): Compacts static grid runs into cached map thumbnails.

**Qualifications:** This review is source-only; previous task acceptance results are not new playtesting evidence. After Hours Scene lacks Tremulous Scene kind validation/cache budget; an extraction should combine tested semantics, not copy either wrapper blindly. Video looping currently creates a new visible soundless-video node every six seconds; it demonstrates lifecycle need, not a new streaming protocol.

## animation-test

Thirty-image animation with pause/resume and selectable 1–30 fps, advanced by wall-clock deadlines inside tick.

**Files reviewed:** [index.js](../src/games/animation-test/index.js).

**Building blocks:** sprite clip clock; playback controls.

**Existing facilities:** GameNode.Asset asset replacement; Text/Shape buttons.

**Candidates:** SpriteClip.advance(time) with pause/rate/loop and no new renderer.

**Keep local:** 30-frame source content.

**Source evidence:**

- [index.js:284 — tick()](../src/games/animation-test/index.js#L284): Manual nextRenderTime and asset-key frame advancement.
- [index.js:237 — this.frameRateUp =](../src/games/animation-test/index.js#L237): Repeated button/text composition.

**Qualifications:** Uses legacy getAssets; animation timing is wall-clock rather than fixed simulation time.

## aquarium

Shared aquarium economy: feeding fish and cleaning algae produce coins used for fish, decor and night mode. A 20 Hz host simulation advances hunger, food pursuit and bubbles with fixed scene pools; this is one shared tank/economy, not the per-player economy of Aquarium Forever.

**Files reviewed:** [index.js](../src/games/aquarium/index.js).

**Building blocks:** Fixed reusable fish/food/decor/bubble slots; Host-side simulation with retained vector nodes; Button-driven shop and timed status labels.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** BoundedPool with explicit drop/oldest policy; Geometry2D ellipse/polygon helpers; Complete node-style update helper.

**Keep local:** Fish hunger/reward curve, shop prices/unlocks, fish silhouettes, algae and tank rules.

**Source evidence:**

- [index.js:324 — initFishPool()](../src/games/aquarium/index.js#L324): Fish simulation records own retained body/eye/heart nodes.
- [index.js:715 — tick()](../src/games/aquarium/index.js#L715): Time, feeding and view updates are centralized in the host tick.
- [index.js:587 — buy(](../src/games/aquarium/index.js#L587): Shared economy purchase action, not generic inventory infrastructure.

**Qualifications:** Unused slots remain attached with hidden geometry; a pool is not itself a visible-scene filter. No automatic save/restore was found. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## aquarium-forever 5

Shared tank expands horizontally across four tiers while each of up to eight players has points, food upgrades and purchases. Food records identify the feeding player for reward credit; players share fish/world/camera but receive private shop/HUD roots. Host simulation uses large fixed pools, camera projection/culling and an export-only checkpoint method.

**Files reviewed:** [data/catalog.js](../src/games/aquarium-forever%205/data/catalog.js), [index.js](../src/games/aquarium-forever%205/index.js).

**Building blocks:** World-to-screen and inverse horizontal camera with zoom bounds; Reusable private UI slots whose audience is rebound on reconnect; Bounded fish/food/bubble pools with different exhaustion policies.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Camera2D primitives and bounds calculation; Audience-scoped UI root lifecycle with explicit callback ownership; BoundedPool with configurable replacement policy.

**Keep local:** Catalog/economy, feeder reward multipliers, shared camera ownership policy, fish body variants, tank expansion rules.

**Source evidence:**

- [index.js:295 — worldToScreenX(](../src/games/aquarium-forever%205/index.js#L295): Camera math is independent of fish rules.
- [index.js:727 — assignPlayerUi(](../src/games/aquarium-forever%205/index.js#L727): Disconnected UI slots are reused and both anchor/root audiences are reset.
- [index.js:1564 — renderFish(](../src/games/aquarium-forever%205/index.js#L1564): Host culls fish by camera before updating visible geometry.
- [index.js:1700 — exportCheckpoint(](../src/games/aquarium-forever%205/index.js#L1700): Checkpoint export exists; do not infer constructor restoration or durable persistence.

**Qualifications:** Checkpoint export does not prove persistence: constructor restore/saveGame integration was not found. Camera is shared, not one camera per player; changing it would change game behavior. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## backgammon

Two-seat backgammon with human/bot replacement, opening-die contest, bar re-entry and bearing off, maximum-dice/larger-die legality, doubling cube, gammon/backgammon scoring, animated moves and rematches.

**Files reviewed:** [index.js](../src/games/backgammon/index.js).

**Building blocks:** Signed 24-point board plus bar/off state and recursive legal turn sequences.; Seat assignment and bot continuation across disconnects.; Token-guarded bot sequences and animated checker movement.; Button/text construction, circle geometry and full-board render.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; seat-roster: opt-in seat ownership/bot flags and assignment events with game-specific takeover policy.

**Keep local:** Forced-dice sequence search, cube offers and take/drop strategy, pip evaluation, win multiplier and bot policy.

**Source evidence:**

- [index.js:444 — generateTurnSequences(](../src/games/backgammon/index.js#L444): Generates complete turns, retains maximal dice use and enforces larger-die rule.
- [index.js:625 — animateCheckerMove(](../src/games/backgammon/index.js#L625): Token-sensitive movement before move commitment.
- [index.js:679 — scheduleBotIfNeeded(](../src/games/backgammon/index.js#L679): Delayed cube/roll/move choices depend on current phase and ownership.
- [index.js:210 — handlePlayerDisconnect(](../src/games/backgammon/index.js#L210): Handles pending doubles and bot ownership; policy cannot be blindly shared.

## battleship

Two-seat fleet placement and firing game. Each human has private own-fleet and target tabs; ready humans face humans or bots. Target search pursues adjacent hits, spectators have a separate view, and fleets are exposed after the match.

**Files reviewed:** [index.js](../src/games/battleship/index.js).

**Building blocks:** Private views and spectator views.; Five-ship selection, rotation and collision-free placement.; Ready barrier, repeated-press suppression, bot turns and rematches.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.; seat-roster: explicit early-join takeover and spectator policy.

**Keep local:** Fleet definitions, legal placement, ship sinking, shot parity/adjacency strategy and reveal rules.

**Source evidence:**

- [index.js:130 — createPlayerView(](../src/games/battleship/index.js#L130): Own board/target board and private controls share a player-scoped root.
- [index.js:200 — pressOnce(](../src/games/battleship/index.js#L200): Suppresses held mouse repeats until mouse-up.
- [index.js:357 — maybeStartGame(](../src/games/battleship/index.js#L357): Ready barrier depends on placed ships and bot seats.
- [index.js:399 — chooseBotShot(](../src/games/battleship/index.js#L399): Game-specific targeting logic.
- [index.js:101 — handleNewPlayer(](../src/games/battleship/index.js#L101): Second-human bot takeover is restricted to a not-yet-shot match.

## billiards

Host-simulated eight-ball pool with drag/release cue shots, human/human or optional bot, aim ghosts, adaptive fixed-step ball contacts, pockets, scratch respotting, group assignment, turn settlement and match end.

**Files reviewed:** [index.js](../src/games/billiards/index.js).

**Building blocks:** 60 Hz simulation with substeps chosen by maximum ball travel.; Gesture state, ray/circle aim tests and shot authorization.; TTL rings/sparks/sinks, motion trails and background jolt.; Persistent rendered balls and state-driven lobby/turn controls.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.; Physics.getPath exists but is a precomputed linear path helper, not this continuous ball/contact simulation.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; physics-primitives: optional pure ray-circle intersection / equal-mass disc resolution only after a second consumer validates semantics.

**Keep local:** Eight-ball rules, bot shot selection, cushion mouth/pocket geometry, friction/restitution tuning and shot settlement.

**Source evidence:**

- [index.js:306 — addFx(](../src/games/billiards/index.js#L306): Generic lifetime+step+node effect registration.
- [index.js:396 — stepFx(](../src/games/billiards/index.js#L396): Updates effects and removes expired nodes.
- [index.js:578 — startAim(](../src/games/billiards/index.js#L578): Start/drag/release ownership belongs to one turn and player.
- [index.js:696 — physicsStep(](../src/games/billiards/index.js#L696): Narrow circle collision and cushion integration are local physics.
- [index.js:819 — resolveShot(](../src/games/billiards/index.js#L819): Game-specific scoring/turn/scratch rules.
- [index.js:477 — handlePlayerDisconnect(](../src/games/billiards/index.js#L477): Disconnect returns to lobby rather than generic bot replacement.

**Qualifications:** Uses squish-145 drag/stream-era node contracts; copying into squish-142 changes is not safe.

## blackjack

Up to four human seats wager a reusable bankroll against an automated dealer, with readiness, ace-soft totals, hit/stand/double, one split, special split-ace handling, natural payouts and repeated hands.

**Files reviewed:** [index.js](../src/games/blackjack/index.js), [theme.js](../src/games/blackjack/theme.js).

**Building blocks:** Private betting/action panels with shared visible hands and hidden dealer hole card.; Deck generation/shuffle, seats, readiness and delayed dealer steps.; Reusable card rows and identical authored card theme used by five games.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.

**Candidates:** optional-card-kit: common card/button/table presentation and paginated private hands; themed defaults stay optional.; ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.

**Keep local:** Soft-ace valuation, bet/bankroll handling, split/double restrictions, natural 3:2 payout and dealer policy.

**Source evidence:**

- [index.js:85 — buildDeck(](../src/games/blackjack/index.js#L85): Deck identity/rank data is separable from blackjack value semantics.
- [index.js:110 — createView(](../src/games/blackjack/index.js#L110): Player-scoped betting/action panels.
- [index.js:168 — handValue(](../src/games/blackjack/index.js#L168): Soft ace computation belongs to blackjack.
- [index.js:246 — dealerStep(](../src/games/blackjack/index.js#L246): Delayed dealer progression uses a generation token.
- [theme.js:42 — function card(](../src/games/blackjack/theme.js#L42): Common card presentation helper across five games.

## cabinet

Two seated players operate a real CHIP-8 Pong ROM while other users spectate; game module includes a CPU, assembler and authored assembly source, with register/timer diagnostics.

**Files reviewed:** [index.js](../src/games/cabinet/index.js), [chip8.js](../src/games/cabinet/chip8.js), [rom.js](../src/games/cabinet/rom.js).

**Building blocks:** dirty row rendering; seat management; input hold bridging.

**Existing facilities:** Shape/Text nodes; playerIds controls.

**Candidates:** Bitmap-to-horizontal-run helper with dirty rows; PlayerScope and configurable InputState.

**Keep local:** CHIP-8 CPU/assembler/opcode semantics, ROM and winner-keeps-seat rules.

**Source evidence:**

- [index.js:316 — renderDisplay()](../src/games/cabinet/index.js#L316): Coalesces adjacent lit pixels into rectangles and skips unchanged rows.
- [chip8.js:54 — step()](../src/games/cabinet/chip8.js#L54): Implements instruction dispatch, memory/registers and divided timers.
- [rom.js:13 — const SOURCE](../src/games/cabinet/rom.js#L13): Authored assembly actually implements Pong.

**Qualifications:** Sound timer is visualized as BEEP text/glow; no actual audio playback is present.

## checkers

American-style checkers against a bot or another human, with mandatory captures, forced multi-jumps, king promotion, legal-move highlights, keyboard focus, animated paths, minimax turns, scores and rematches.

**Files reviewed:** [index.js](../src/games/checkers/index.js).

**Building blocks:** Board selection and separate step-move versus complete-turn representations.; Seat/bot lifecycle, pointer edge suppression and keyboard held-key guard.; Checker path animation and repeated button/text/circle helpers.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; seat-roster: events and assignment only; jump/turn reset remains game-owned.

**Keep local:** Mandatory captures, promotion ending a chain, multi-jump expansion, evaluation/minimax and selection state.

**Source evidence:**

- [index.js:254 — pressOnce(](../src/games/checkers/index.js#L254): Held click guard coupled to mouse-up.
- [index.js:358 — animateCheckerPath(](../src/games/checkers/index.js#L358): Cancellable visual path while gameplay input is locked.
- [index.js:457 — generateStepMoves(](../src/games/checkers/index.js#L457): Mandatory capture rules.
- [index.js:491 — expandCaptureTurn(](../src/games/checkers/index.js#L491): Bot complete-turn paths differ from human step input.
- [index.js:620 — scheduleBotIfNeeded(](../src/games/checkers/index.js#L620): Delayed decision invalidation repeated across board games.

## chess

Two-seat chess with bots, legal king-safe moves, castling, en passant, private promotion choices, checkmate/stalemate, fifty-move/repetition/insufficient-material draws, move animation and rematches.

**Files reviewed:** [index.js](../src/games/chess/index.js).

**Building blocks:** Mutable board piece records with moved flags plus last-move/history state.; Private modal choice for promotion, pointer edge guard and ownership checking.; Tokenized bot scheduling and simultaneous king/rook animation.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; seat-roster: seat assignment only, with explicit promotion/disconnect hook.

**Keep local:** All chess rules, repetition equivalence, move search/evaluation, promotion fallback and game-end conditions.

**Source evidence:**

- [index.js:369 — legalMoves(](../src/games/chess/index.js#L369): Filters simulated moves using king safety.
- [index.js:406 — animateChessMove(](../src/games/chess/index.js#L406): Movement may include a second castling rook.
- [index.js:444 — choosePromotion(](../src/games/chess/index.js#L444): Private owner-authorized promotion choice.
- [index.js:460 — positionKey(](../src/games/chess/index.js#L460): Repetition includes turn/castling/en-passant context.
- [index.js:649 — scheduleBotIfNeeded(](../src/games/chess/index.js#L649): Delayed bot callback must survive neither reset nor ownership change.

**Qualifications:** Do not lift a generic minimax engine from this implementation without isolating all contextual state such as lastMove.

## city-scanner

An interactive simulated city with traffic, pedestrians, cafe queues, wildlife, weather and lighting spread across a wide generated world. Up to eight players share camera controls and world interactions; pause stops simulation while input/camera time continue. It reuses stable keyed drawing slots and derives a clipped active scene from a retained host hierarchy.

**Files reviewed:** [index.js](../src/games/city-scanner/index.js), [world/layout.js](../src/games/city-scanner/world/layout.js), [world/scene.js](../src/games/city-scanner/world/scene.js).

**Building blocks:** Seeded world layout; Camera smoothing/pan/zoom and parallax; Stable entity-to-node slot allocation; VisibleScene host-side recursive filtering and polygon clipping; Static scenery cache keyed by view and lighting.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** StableKeyPool distinct from sequential drawing pool; VisibleScene projection/filtering API; Camera transform/inverse and clipping; Explicit separate UI/simulation clocks.

**Keep local:** City layout/timetables, cafe interactions, wildlife/weather, one shared-camera input aggregation.

**Source evidence:**

- [index.js:279 — assignStablePool(](../src/games/city-scanner/index.js#L279): Keeps visible entities on the same node identities; allocates only free slots.
- [world/scene.js:45 — class VisibleScene](../src/games/city-scanner/world/scene.js#L45): Captures hierarchy and derives visible children with true viewport clipping.
- [index.js:1055 — render(](../src/games/city-scanner/index.js#L1055): Static scenery cache is separate from dynamic world rendering.
- [world/layout.js:55 — function generateWorld](../src/games/city-scanner/world/layout.js#L55): Layout generator and authored scenery remain local content.

**Qualifications:** VisibleScene captures the original hierarchy; it is not automatically safe for arbitrarily added children. Clipping cache is based on coordinate array identity; in-place coordinate edits need invalidation. The facade must preserve audience and input bindings; current ViewUtils cloning is not an interchangeable implementation. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## clicktionary

Two-to-eight-player drawing/guessing party game: rotate artists, choose a word, draw under a deadline and ink budget, privately validate near guesses, award time-based points, reveal hints, then show round/game podiums.

**Files reviewed:** [index.js](../src/games/clicktionary/index.js), [words.js](../src/games/clicktionary/words.js).

**Building blocks:** Choice/draw/reveal phases with late-join and artist-disconnect handling.; Persistent private roots, text inputs, answer visibility and private toast feedback.; Continuous stroke collection, aspect-correct extrusion, 55-point chunks and dirty flush.; Shuffle bag, Levenshtein matching and expiring score bubbles.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; stroke-geometry: aspect-aware polyline extrusion and wire-size-bounded chunks; input collection and game ink budgets stay separate.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; text-utils: pure edit distance only; normalization and acceptable guesses remain game-specific.

**Keep local:** Artist queue, word bank, hints, ink allowance, guess normalization and scoring.

**Source evidence:**

- [index.js:383 — drawDot(](../src/games/clicktionary/index.js#L383): Collects held pointer samples with stroke-size/ink constraints.
- [index.js:432 — buildStrokeCoordinates(](../src/games/clicktionary/index.js#L432): Aspect-aware ribbon geometry shared in spirit with Draw/Hangman.
- [index.js:490 — submitGuess(](../src/games/clicktionary/index.js#L490): Owns guess eligibility, exact/near-answer rules and points.
- [index.js:606 — tick(](../src/games/clicktionary/index.js#L606): Deadline progression, hint schedule, dirty strokes and transient effects.
- [index.js:797 — rebuildPlayerRoot(](../src/games/clicktionary/index.js#L797): Persistent player root supports private input/word content.

**Qualifications:** words.js is content data; data reviewed as a word-bank contract rather than individually validating every word.

## clump

Single-player polygonal Katamari-like growth game: absorb progressively larger objects from pins to celestial bodies in a 900-unit world, with many species-specific behaviors, size-dependent camera zoom, inertia, obstacles and a 210-second clock armed by first input.

**Files reviewed:** [index.js](../src/games/clump/index.js), [shapes.js](../src/games/clump/shapes.js).

**Building blocks:** Bounded visible-world and attached-object scene pools, screen-size culling and smoothed camera; Normalized polygon art with reusable translation/rotation/nonuniform scale; Circle contacts, capped particles/rings/trails and size-dependent color ramps.

**Existing facilities:** ViewableGame/ViewUtils already support world-to-private-view projection; this game performs its own single-view transform; GameNode retained mutation and ShapeUtils primitives.

**Candidates:** Camera2D follow/zoom/transform/visible-bounds utilities layered on existing ViewUtils; ShapeUtils regularPolygon/star/transform and tested circle contact; Retained node pool and bounded effect emitter with clock-based lifetimes.

**Keep local:** Growth by absorbed area, attach animation, object species behaviors and world progression; Authored silhouettes, zone packs, win thresholds and threat/flee logic.

**Source evidence:**

- [index.js:1057 — updateCamera() {](../src/games/clump/index.js#L1057): Smooths size-dependent zoom and clamps the camera to world bounds.
- [index.js:1148 — renderWorld() {](../src/games/clump/index.js#L1148): Culls by viewport and projected size before updating a capped 180-node pool.
- [index.js:168 — const xform](../src/games/clump/index.js#L168): Applies shared affine transforms to normalized polygon silhouettes.
- [shapes.js:67 — const TYPES](../src/games/clump/shapes.js#L67): Authored object catalog combines silhouettes, sizes, colors and gameplay traits.

**Qualifications:** Current edge handling hides partially off-left/top objects rather than clipping them; a reusable camera must not adopt that visibility artifact. Scene pools bound output but world behavior/contact scans remain linear; no performance claim is made by this source audit.

## connect-four

Two-seat gravity Connect Four with whole-column click targets, numbered keyboard input, animated falling counters, four-direction winner detection, a depth-limited alpha-beta bot and rematches.

**Files reviewed:** [index.js](../src/games/connect-four/index.js).

**Building blocks:** Grid indexing, simulation copy and legal-column scan.; Seat takeover, held-key state and delayed bots.; Multi-frame falling-disc animation with reset cancellation.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; shape-primitives: polygon circle/ellipse generation with explicit segment count.

**Keep local:** Gravity board rules, four-in-a-row scans and heuristic window/minimax evaluation.

**Source evidence:**

- [index.js:210 — handleKeyDown(](../src/games/connect-four/index.js#L210): Edge-triggered digit and Enter input.
- [index.js:249 — animateDiscDrop(](../src/games/connect-four/index.js#L249): Eased drop animation carries a cancellation token.
- [index.js:303 — findWinner(](../src/games/connect-four/index.js#L303): Four-direction board rule.
- [index.js:431 — scheduleBotIfNeeded(](../src/games/connect-four/index.js#L431): Repeated delayed-bot pattern.
- [index.js:460 — resetRound(](../src/games/connect-four/index.js#L460): Invalidates bot/animation state and replaces board.

## copperline

Single-player frontier action RPG with on-foot/horse/train travel, combat, dialogue, missions, repeatable bounties and property income. A pure host engine owns world and campaign data; the adapter rotates movement for an isometric camera and resolves screen aim. A clipped bounded painter outputs only visible nodes; schema-aware saves rebuild valid state and discard transient attacks.

**Files reviewed:** [audio.js](../src/games/copperline/audio.js), [content.js](../src/games/copperline/content.js), [engine.js](../src/games/copperline/engine.js), [index.js](../src/games/copperline/index.js), [scene.js](../src/games/copperline/scene.js).

**Building blocks:** Isometric projection/unprojection and depth ordering; Lazy bounded active-only painter; Host-side movement and collision sampling; Generated cue/music audio voice scheduler; Campaign snapshot sanitation and transient reset.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Camera2D affine transform/inverse; VisibleSceneWriter and geometry clipping; PCM encoder + audio voices; SaveCoordinator for scheduling/retry only.

**Keep local:** Missions/dialogue, horse/train mounting, firearms/perks/outfits/property economy and semantic save validation.

**Source evidence:**

- [scene.js:26 — class Painter](../src/games/copperline/scene.js#L26): 900-shape active scene pool with finite checking and clipping.
- [engine.js:829 — serialize()](../src/games/copperline/engine.js#L829): Explicit semantic snapshot resets live combat transients.
- [engine.js:847 — load(](../src/games/copperline/engine.js#L847): Restoration validates content IDs and reconstructs derived mission/world state.
- [audio.js:43 — class](../src/games/copperline/audio.js#L43): Music/cue scheduling should be separate from PCM encoding.

**Qualifications:** Isometric projection and elevation differ from Starfall orthographic camera; use an affine basis, not one hardcoded camera. Game-specific save repair is not a generic serialize-GameNode abstraction. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## crazy-eights

Two-seat shedding game with private paginated hands, rank/suit matching, wild eights with suit selection, draw/pass handling, discard recycling, bot opponents, first-empty-hand win and rematches.

**Files reviewed:** [index.js](../src/games/crazy-eights/index.js), [theme.js](../src/games/crazy-eights/theme.js).

**Building blocks:** Card theme, deck/shuffle and 12-card pages.; Private suit-choice workflow and spectator panel.; Seat/bot replacement and token-guarded delayed turns.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.

**Candidates:** optional-card-kit: common card/button/table presentation and paginated private hands; themed defaults stay optional.; ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; paged-list: stable slot-to-item mapping and clamped page state for private hands.

**Keep local:** Playable-card rules, wild-suit selection, cannot-draw-if-playable policy and discard recycling semantics.

**Source evidence:**

- [index.js:138 — createPlayerView(](../src/games/crazy-eights/index.js#L138): Private hand slots, paging and suit choice.
- [index.js:204 — playCard(](../src/games/crazy-eights/index.js#L204): Game owns wild-eight branch and win transition.
- [index.js:270 — ensureDeck(](../src/games/crazy-eights/index.js#L270): Retains discard top while recycling other cards.
- [index.js:343 — scheduleBotIfNeeded(](../src/games/crazy-eights/index.js#L343): Multiple delayed decisions require phase and token guards.
- [theme.js:42 — function card(](../src/games/crazy-eights/theme.js#L42): Identical optional presentation helper.

## cursor-test

Hovering the center square applies a per-player image cursor; leaving resets it. Focused cursor integration demo.

**Files reviewed:** [index.js](../src/games/cursor-test/index.js).

**Building blocks:** hover lifecycle; per-player cursor.

**Existing facilities:** GameNode.Shape onHover/offHover; Asset.

**Candidates:** Document cursor helper alongside scene events; no new cursor transport.

**Keep local:** demo artwork and placement.

**Source evidence:**

- [index.js:32 — onHover:](../src/games/cursor-test/index.js#L32): Injected setCursor already supplies platform cursor control.

**Qualifications:** setCursor is an injected host helper, not a Squish export.

## defuse

Two-to-eight-player asymmetric co-op bomb mission. A rotating defuser manipulates wire/keypad/button/sequencer modules while experts see separate manual pages; three timed bombs, strikes, debriefs, readiness and disconnect reassignment are implemented.

**Files reviewed:** [index.js](../src/games/defuse/index.js).

**Building blocks:** Player-specific information views and page navigation.; Lobby readiness, fixed round roster/spectators and role reassignment.; Deadline clock, flashes/toasts and sequencer flash windows.; Generated puzzles paired with authored manual instructions.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.

**Keep local:** Puzzle generation/evaluation/manual coupling, strike mappings, expert page allocation and mission progression.

**Source evidence:**

- [index.js:418 — genBomb(](../src/games/defuse/index.js#L418): Creates game-specific puzzle states with increasing module count.
- [index.js:556 — dealPages(](../src/games/defuse/index.js#L556): Distributes manual pages privately among current experts.
- [index.js:586 — canAct(](../src/games/defuse/index.js#L586): Host authorization checks role, phase and module state.
- [index.js:668 — scheduleSeqFlashes(](../src/games/defuse/index.js#L668): Timeline of sequence flashes has explicit game-time semantics.
- [index.js:833 — rebuildPlayerRoot(](../src/games/defuse/index.js#L833): Renders distinct lobby/spectator/defuser/expert experiences.

## device-test

Creates a private color screen according to each client’s desktop/mobile/tablet classification.

**Files reviewed:** [index.js](../src/games/device-test/index.js).

**Building blocks:** player scene ownership; device adaptation.

**Existing facilities:** GameNode playerIds; clearChildren/removeChild.

**Candidates:** PlayerScope for roots, state and cleanup.

**Keep local:** device palette.

**Source evidence:**

- [index.js:34 — handleNewPlayer](../src/games/device-test/index.js#L34): Allocates a root restricted to the joining player.
- [index.js:61 — deviceRules](../src/games/device-test/index.js#L61): Unknown device falls back to desktop.

## doodle-invaders

Four-pilot cooperative Space Invaders with shared lives, personal firing limits, marching two-frame aliens, every-third-wave bosses and late joins; all authored media IDs remain placeholders, so the source runs shape fallbacks without its advertised drawn assets or sounds.

**Files reviewed:** [index.js](../src/games/doodle-invaders/index.js).

**Building blocks:** Sprite abstraction swaps image assets and shape fallbacks while retaining bounds; Private fire controls and firing audio, shared team HUD/lives; Tick-owned audio cleanup, respawn blink and timed banners.

**Existing facilities:** Asset and GameNode.Asset support image/audio nodes; GameNode visibility/callbacks already exist; ShapeUtils rectangle/triangle and mutable asset bounds.

**Candidates:** Sprite/frame helper that updates both asset placement and hit bounds atomically; One-shot AudioHandle with per-instance identity, duration and player audience; Scoped transient groups and input edge/hold abstraction.

**Keep local:** Swarm marching, column-front shooter selection, boss patterns and shared-life balance; Shape fallback artwork and studio asset authoring workflow.

**Source evidence:**

- [index.js:190 — makeSprite(key](../src/games/doodle-invaders/index.js#L190): Uses either an image asset or fallback geometry behind a common placement adapter.
- [index.js:215 — place(sprite](../src/games/doodle-invaders/index.js#L215): Updates node coordinates and asset position/size together and switches animation asset keys.
- [index.js:230 — playSound(key](../src/games/doodle-invaders/index.js#L230): Creates a new audience-scoped sound node and removes it after a fixed lifetime.

**Qualifications:** No real assets are registered until REPLACE_* IDs are replaced; portable project paths need the separate supported metadata contract. Recursive visibility reset on ship root also overwrites child YOU marker audience; a shared helper must preserve child-private visibility.

## drag-test

Players grab labeled boxes with offset-preserving drags or rubber-band new rectangles on the background, with bounded history and disconnect cleanup.

**Files reviewed:** [index.js](../src/games/drag-test/index.js).

**Building blocks:** drag ownership; anchored rectangle; bounded node history.

**Existing facilities:** onClick/onDrag/offClick; BaseNode.update.

**Candidates:** DragSession helper with offset, bounds, cancel and exclusive capture; Rectangle.fromPoints.

**Keep local:** colors/status narration.

**Source evidence:**

- [index.js:155 — grabBox(playerId](../src/games/drag-test/index.js#L155): Stores pointer-to-box offset per player.
- [index.js:196 — draftRect(draft](../src/games/drag-test/index.js#L196): Normalizes reverse-direction rectangles.
- [index.js:303 — handlePlayerDisconnect](../src/games/drag-test/index.js#L303): Cancels unfinished interactions.

**Qualifications:** Host/client already supplies drag routing; proposal is game-side state convenience only.

## draw

Shared 4000×4000 drawing board with each player owning a pan/zoom camera and toolbar. Host keeps world strokes, renders only view-projected chunks/items, accepts image/audio uploads, and supports quorum clearing with a cooldown.

**Files reviewed:** [image-dims.js](../src/games/draw/image-dims.js), [index.js](../src/games/draw/index.js).

**Building blocks:** World-space stroke chunks with bounds, LOD sampling, incremental view nodes and geometry precision floors.; Per-player camera transforms, clipping and image crop projection.; Upload registration, bounded item/stroke queues and one-shot audio restart.; Majority-clear votes and disconnect cleanup.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Asset and GameNode.Asset already provide resource references; uploaded asset publication remains the platform-injected addAsset/getAssets capability.; ViewUtils.getView already clones/culls/transforms nodes and preserves raw coordinates for image crop; extend its missing pure camera/clip helpers instead of adding a rival whole-world renderer.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** stroke-geometry: aspect-aware polyline extrusion and wire-size-bounded chunks; input collection and game ink budgets stay separate.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; camera-projection: pure world/view affine transforms plus clipping/crop helpers compatible with ViewUtils; authoritative world remains on host.; image-layout: bounded byte-header dimensions and aspect-aware contain/crop functions.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; asset-lifetime: detach node references before releasing a runtime registration; stale upload completions use an epoch.

**Keep local:** Board dimensions, camera spawning, ink retention/LOD tradeoffs, clear-vote policy and audio board behavior.

**Source evidence:**

- [index.js:341 — screenToWorld(](../src/games/draw/index.js#L341): Input coordinates are transformed back to the host world.
- [index.js:523 — buildChunkCoordinates(](../src/games/draw/index.js#L523): Visibility/LOD/aspect extrusion and wire precision meet in per-view projection.
- [index.js:683 — handleUpload(](../src/games/draw/index.js#L683): Uses injected publication capability and parses uploaded bytes.
- [index.js:747 — projectItem(](../src/games/draw/index.js#L747): Projects and clips world items to a player camera.
- [index.js:795 — buildImageNode(](../src/games/draw/index.js#L795): Clamped geometry and raw crop information must stay consistent.
- [image-dims.js:66 — module.exports](../src/games/draw/image-dims.js#L66): Authored pure PNG/GIF/JPEG/WebP dimension parser.

**Qualifications:** Upload asset bundles are published to all players by the platform; scene visibility alone is not asset-byte secrecy. Older node constructor lacks onDrag here, so a direct handler assignment preserves compatibility; new input APIs need new-version adoption.

## engine-room

Cooperative asymmetric console game: each player sees four owned controls and a timed repair order usually targeting someone else’s console; missed orders damage shared hull across three sectors.

**Files reviewed:** [index.js](../src/games/engine-room/index.js).

**Building blocks:** private UI; deadline progress; roster-aware reassignment; button/toggle/dial.

**Existing facilities:** playerIds; Shape/Text nodes.

**Candidates:** PlayerScope and retained private scene; UI button/toggle/stepper/progress bar; Seedable shuffle utility.

**Keep local:** order targeting, communication challenge, hull and sector rules.

**Source evidence:**

- [index.js:266 — issueOrder(pid)](../src/games/engine-room/index.js#L266): Chooses controls without duplicate targeting and assigns tick deadline.
- [index.js:318 — operateControl(pid](../src/games/engine-room/index.js#L318): Validates control ownership.
- [index.js:546 — rebuildPlayerRoot(pid)](../src/games/engine-room/index.js#L546): Private instructions and controls rebuild together.

## enhanced-view-test

Modular experimental cooperative resource/combat game: explore an 800-unit world, automatically gather sugar/lemons and fight guards, buy shared upgrades, then price and sell lemonade to recurring customer types; sugar addiction can produce later bosses. Private 100-unit cameras surround a shared simulation and multi-phase economy.

**Files reviewed:** [index.js](../src/games/enhanced-view-test/index.js), [config/CombatConfig.js](../src/games/enhanced-view-test/config/CombatConfig.js), [config/LemonadeConfig.js](../src/games/enhanced-view-test/config/LemonadeConfig.js), [managers/PlayerManager.js](../src/games/enhanced-view-test/managers/PlayerManager.js), [managers/ResourceManager.js](../src/games/enhanced-view-test/managers/ResourceManager.js), [managers/GameStateManager.js](../src/games/enhanced-view-test/managers/GameStateManager.js), [systems/CombatSystem.js](../src/games/enhanced-view-test/systems/CombatSystem.js), [systems/LemonadeStandSystem.js](../src/games/enhanced-view-test/systems/LemonadeStandSystem.js), [utils/UIComponents.js](../src/games/enhanced-view-test/utils/UIComponents.js).

**Building blocks:** Follow cameras and screen-to-world targeting; Automatic nearest-target selection, move-toward and circular projectile overlap; Timed phases, expiring damage/gather labels and shared upgrade UI; Separate player/resource/state/combat/customer modules.

**Existing facilities:** ViewableGame authoritative plane and per-player roots; ViewUtils.getView culling/translation; GameNode click handlers and playerIds; ShapeUtils.rectangle and existing core ExpiringSet.

**Candidates:** Extend existing ViewUtils with retained follow-camera snapshots and screenToWorld; Pure closest-point-to-rectangle, distance and moveTowards helpers; Game-owned deadlines/transient effects with cancellation instead of mixed Date.now and raw expiry timers; Small composed button/stepper helpers with explicit ownership and consistent private audience.

**Keep local:** Combat enemy behavior and stats; Shared resource rollback, upgrades, customer preferences/addiction and lemonade economy; Phase definitions and authored UI copy.

**Source evidence:**

- [index.js:397 — createGameplayView(playerId](../src/games/enhanced-view-test/index.js#L397): Existing ViewUtils selection plus manual visible labels/actors are repeatedly rebuilt for each player.
- [index.js:1021 — updatePlayerViewContent(playerId](../src/games/enhanced-view-test/index.js#L1021): Stable private wrapper contains replaced view content and an owner-checked click layer.
- [index.js:1069 — calculateDistanceToRectangle(](../src/games/enhanced-view-test/index.js#L1069): Closest-point rectangle query is also useful outside this economy.
- [managers/PlayerManager.js:77 — movePlayerTowards(](../src/games/enhanced-view-test/managers/PlayerManager.js#L77): Bounded move-toward/follow-camera behavior.
- [systems/CombatSystem.js:670 — findMultipleAttackTargets(](../src/games/enhanced-view-test/systems/CombatSystem.js#L670): Repeated nearest living enemy selection after distance filtering.
- [systems/CombatSystem.js:781 — cleanupExpiredIndicators(](../src/games/enhanced-view-test/systems/CombatSystem.js#L781): Damage and attack labels are lifetime-scoped simulation data.
- [utils/UIComponents.js:60 — createIncrementControl(](../src/games/enhanced-view-test/utils/UIComponents.js#L60): Repeated button/label/stepper composition.
- [managers/GameStateManager.js:47 — checkTransitions(](../src/games/enhanced-view-test/managers/GameStateManager.js#L47): Game-specific state transitions mix resource rollback, bosses and time limits.
- [systems/LemonadeStandSystem.js:222 — completePurchase(](../src/games/enhanced-view-test/systems/LemonadeStandSystem.js#L222): Customer preference, pricing, addiction and boss rules remain local.

**Qualifications:** Marked as a test/prototype; large entrypoint retains duplicate legacy UI paths alongside current state classes. Simulation movement is per-tick while deadlines use wall time; reusable timing must define units explicitly. Boss-cleared check sits inside an alive-boss branch; review state transition correctness before promoting patterns. Resource gathering can credit more than the remaining pool, and customer IDs include day/time so addiction persistence semantics need review. Player label indices/colors are derived from the visible subset; identity should be independent of camera selection.

## facet

Match-three puzzle campaign with an 8×8 board, cascades, special gems, frost/radiance goals and journey/zen/timed rush modes. Input supports selection or dragging to an adjacent cell; the fixed-step engine animates swap/match/fall/shuffle phases and guarantees a playable settled board. Career progress counts deltas, and only validated ready-state snapshots resume.

**Files reviewed:** [art-data.js](../src/games/facet/art-data.js), [art.js](../src/games/facet/art.js), [content.js](../src/games/facet/content.js), [engine.js](../src/games/facet/engine.js), [index.js](../src/games/facet/index.js), [painter.js](../src/games/facet/painter.js), [progression.js](../src/games/facet/progression.js), [scene.js](../src/games/facet/scene.js), [sound.js](../src/games/facet/sound.js).

**Building blocks:** True-clipping active-order painter with bounded polygon/arc/text work; Input press/drag/release and menu focus; Separate gameplay/effect RNG streams; Fixed-step accumulator; Stable-boundary snapshot + accounted-stat deltas; Layered musical phrases and prioritized cascade cue.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Geometry2D clipPolygon and arc segmentation; SceneWriter with capacity/vertex limits; FixedStepper; Action-state adapter above platform input; PCM encoding, voice lifecycle and portable image byte decoding.

**Keep local:** Match solver, special-gem combinations, frost/radiance/goals, level and achievement definitions, medal/unlock logic.

**Source evidence:**

- [painter.js:10 — function clipPolygon](../src/games/facet/painter.js#L10): True polygon clipping, unlike Moonbounce/Rambler vertex clamping.
- [engine.js:481 — exportState()](../src/games/facet/engine.js#L481): Only ready states can be persisted; animation state is deliberately omitted.
- [engine.js:488 — restoreState(](../src/games/facet/engine.js#L488): Validates board/frost/domain invariants and confirms no ready-state matches plus a legal move.
- [progression.js:40 — function record(](../src/games/facet/progression.js#L40): Accounts deltas to avoid duplicate career credit after resume.
- [sound.js:167 — class Sound](../src/games/facet/sound.js#L167): Selects highest cascade cue and layers realm music/shine at phrase boundaries.

**Qualifications:** art-data.js is an 8.9 MB generated base64 painting payload, sampled as data; art.js decoding and asset construction were inspected. Runtime is pinned to squish-142. Keep renderer text/alpha/wire semantics explicit. Audio phrase changes differ from Rambler immediate scene music replacement. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## fakeout

Two-to-eight-player bluffing quiz with six prompts: privately submit lies, merge duplicate lies, award truth-near submissions, anonymously vote without voting for one’s own answer, reveal authors and scores, then continue to a podium.

**Files reviewed:** [facts.js](../src/games/fakeout/facts.js), [index.js](../src/games/fakeout/index.js).

**Building blocks:** Write/vote/reveal deadlines and round eligibility snapshots.; Private text inputs/toasts with shared anonymous cards.; Shuffle, wrapping and edit-distance normalization helpers.; Disconnection prunes eligibility and may advance/abort phases.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; text-utils: pure edit distance and line wrapping with game-provided normalization.

**Keep local:** Fact bank, duplicate-author scoring, truth acceptance, voting exclusions and six-round progression.

**Source evidence:**

- [index.js:248 — submitLie(](../src/games/fakeout/index.js#L248): Near-truth scoring and duplicate handling are game-specific.
- [index.js:282 — startVoting(](../src/games/fakeout/index.js#L282): Builds shuffled anonymous answer cards from round participants.
- [index.js:299 — vote(](../src/games/fakeout/index.js#L299): Host verifies voter and own-answer exclusion.
- [index.js:326 — startReveal(](../src/games/fakeout/index.js#L326): Computes points and reveals answer authors.
- [index.js:531 — rebuildPlayerRoot(](../src/games/fakeout/index.js#L531): Per-player private submit/vote status.

**Qualifications:** facts.js sampled as content data; game logic fully read.

## flick

Slingshot arena where each player drags their ball backward then releases; circular impulses, wall bounces and target shrapnel create scored chains.

**Files reviewed:** [index.js](../src/games/flick/index.js).

**Building blocks:** circle impulse; bounded integration; drag release; capped transient effects.

**Existing facilities:** onDrag/offClick; BaseNode.update.

**Candidates:** Geometry2D.circleContact and impulse response; Polygon thickLine/diamond; Bounded effect pool.

**Keep local:** device-dependent ball mass, restitution tuning and chain scoring.

**Source evidence:**

- [index.js:414 — resolveCollision(a, b)](../src/games/flick/index.js#L414): Separates overlapping circles and applies inverse-mass impulse.
- [index.js:378 — launch(releasePid](../src/games/flick/index.js#L378): Normalizes and caps slingshot pull.
- [index.js:260 — spawnFlash(x](../src/games/flick/index.js#L260): Bounded transient node lifecycle.

**Qualifications:** Rendered balls are diamonds but use circular physics; collision shapes must be explicit, not inferred from rendering.

## gamepad-test

Moves a shared square via mapped keys, switches color on fresh presses and displays raw right-stick/controller status.

**Files reviewed:** [index.js](../src/games/gamepad-test/index.js).

**Building blocks:** pressed versus held state; analog input.

**Existing facilities:** Shape/Text nodes; metadata gamepadBindings supported by host/client.

**Candidates:** InputState per player with pressed/released/held and normalized axes.

**Keep local:** controller diagnostic presentation.

**Source evidence:**

- [index.js:44 — handleKeyDown](../src/games/gamepad-test/index.js#L44): Manual Set distinguishes initial Space press.
- [index.js:63 — handleGamepadInput](../src/games/gamepad-test/index.js#L63): Reads analog stick and connectivity fields.

## geom-storm

Shared single-ship neon survival shooter with WASD movement, directional or auto-fire, escalating enemy swarms, collectible multipliers, bombs and extensive particles; explicitly a node-count stress game.

**Files reviewed:** [index.js](../src/games/geom-storm/index.js).

**Building blocks:** particle lifetime; shape generation; input state; scene churn instrumentation.

**Existing facilities:** Shape effects; GameNode primitives.

**Candidates:** Bounded particle/effect pool; KeyedScene; ShapeUtils regular polygon; InputState.

**Keep local:** enemy archetypes, auto-aim, drop rates and stress workload.

**Source evidence:**

- [index.js:647 — render()](../src/games/geom-storm/index.js#L647): Recreates dynamic geometry, including stars/trails/ring particles, each tick.
- [index.js:501 — moveBullets()](../src/games/geom-storm/index.js#L501): Manual bullet/enemy AABB checks.
- [index.js:641 — countNodes(node](../src/games/geom-storm/index.js#L641): Displays actual node count and sampled tick duration.

**Qualifications:** All users share keys/ship; not independent multiplayer actors. Do not remove intended stress behavior when extracting helpers.

## go-fish

Four-seat Go Fish with human/bot replacement, five-card deals, rank requests against selected opponents, successful-request extra turns, matching fish continuation, empty-hand refills, four-card books and match wins.

**Files reviewed:** [index.js](../src/games/go-fish/index.js), [theme.js](../src/games/go-fish/theme.js).

**Building blocks:** Private 10-slot paginated hands and selected-rank/target input.; Deck/shuffle/sort, seat replacement and delayed bots.; Identical card-theme helpers despite very compact entrypoint formatting.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** optional-card-kit: common card/button/table presentation and paginated private hands; themed defaults stay optional.; ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; paged-list: stable hand slots and page bounds.

**Keep local:** Book collection, matching draw rule, request strategy, refill amount and end condition.

**Source evidence:**

- [index.js:25 — createView(](../src/games/go-fish/index.js#L25): Builds private hand and target selection controls.
- [index.js:28 — collectBooks(](../src/games/go-fish/index.js#L28): Rank grouping and removal creates books.
- [index.js:32 — resolveAsk(](../src/games/go-fish/index.js#L32): Transfer/fish/keep-turn behavior.
- [index.js:39 — scheduleBot(](../src/games/go-fish/index.js#L39): Generation token and phase guard before bot action.
- [theme.js:42 — function card(](../src/games/go-fish/theme.js#L42): Shared authored presentation implementation.

**Qualifications:** The 44-line entrypoint is densely formatted, not a stub; all authored logic was read.

## grand-finale

Shared 75-second fireworks competition: tapping a rocket spends a personal fuse, expanding blasts ignite delayed cascades and award increasing chain-depth points; the last twelve seconds intensify spawns.

**Files reviewed:** [index.js](../src/games/grand-finale/index.js).

**Building blocks:** Aspect-correct distance and ellipse/ring generation; Delayed cascade events, bounded particles and floating labels; Tick-based effects, cooldown bars and round phases.

**Existing facilities:** Polygon/text primitives, shadow effects, node visibility and click callbacks.

**Candidates:** Aspect-aware 2D metric/coordinate transforms; Transient particle/label lifetime helper and cooldown clock; ShapeUtils regular polygon/ring helpers.

**Keep local:** Chain ownership/depth scoring and expanding-blast propagation; Fireworks trajectories, finale pacing and show presentation.

**Source evidence:**

- [index.js:173 — unitDist(x1](../src/games/grand-finale/index.js#L173): Corrects y distance for the declared 16:9 view rather than treating screen percentages as isotropic.
- [index.js:498 — updateBlasts()](../src/games/grand-finale/index.js#L498): Growing timed blast radii schedule chain reactions and clean up effect nodes.
- [index.js:572 — updateFloaters()](../src/games/grand-finale/index.js#L572): Repeats floating text movement, alpha interpolation and expiry patterns seen in other games.

**Qualifications:** Current geometry clamps vertices to screen edges; generic clipping must preserve polygon intersections instead of copying this shortcut.

## grid-test

Builds a 10×10 white hover grid whenever a player joins; hovered cells become red.

**Files reviewed:** [index.js](../src/games/grid-test/index.js).

**Building blocks:** grid layout; hover handling.

**Existing facilities:** ShapeUtils.rectangle; onHover.

**Candidates:** Grid coordinate/layout helper only if shared with actual board games.

**Keep local:** diagnostic grid.

**Source evidence:**

- [index.js:25 — handleNewPlayer](../src/games/grid-test/index.js#L25): Nested loops place cells and attach hover callbacks.

**Qualifications:** Player root is not restricted with playerIds and has no disconnect cleanup; do not copy lifecycle unchanged.

## halloween-words

Single shared owl-catcher experience: left/right movement catches falling Halloween treats, spiders empty the bag, successful catches add points, and sound effects accompany events. The title does not describe a word-matching mechanic.

**Files reviewed:** [index.js](../src/games/halloween-words/index.js).

**Building blocks:** Spawn/cull collections, asset-position versus collision-geometry synchronization and score HUD.; Existing GeometryUtils collision queries.; Manual audio-node expiry and randomized asset selection.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Asset and GameNode.Asset already provide resource references; uploaded asset publication remains the platform-injected addAsset/getAssets capability.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** asset-transform: explicit visual position and hit-box update helpers with optional offsets, not a mandatory one-to-one bounding box.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; one-shot-audio: attach/play/remove asset nodes through caller-owned lifecycle, without platform transport changes.

**Keep local:** Catch/spider rules, movement/spawn tuning, score model and Halloween assets.

**Source evidence:**

- [index.js:66 — tick(](../src/games/halloween-words/index.js#L66): Moves falling items, checks collisions and removes old sound nodes.
- [index.js:213 — movePlayer(](../src/games/halloween-words/index.js#L213): Synchronizes sprite asset position and geometry.
- [index.js:241 — spawnItem(](../src/games/halloween-words/index.js#L241): Spawns weighted treat/spider choices.
- [index.js:311 — addToBag(](../src/games/halloween-words/index.js#L311): Successful catch bookkeeping.
- [index.js:360 — handleKeyDown(](../src/games/halloween-words/index.js#L360): Left/right input applies movement directly.

**Qualifications:** Legacy source contains stale comments and uneven timing bookkeeping; it is evidence for a helper need, not a canonical simulation template.

## hangman

Multiplayer hangman with rotating secret-phrase authors, CPU phrases when needed, timed phrase entry, letter guesses and player statistics. Players can draw six cumulative custom hangman frames using a private editor; default image/audio assets remain available.

**Files reviewed:** [index.js](../src/games/hangman/index.js), [questions.js](../src/games/hangman/questions.js), [testa](../src/games/hangman/testa).

**Building blocks:** Turn rotation, phase/identity-guarded absolute deadlines and text-input timeout fallback.; Private author input and custom drawing editor.; Aspect-correct chunked pen geometry and held-click release gates.; Hangman image/audio swaps and score display.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Asset and GameNode.Asset already provide resource references; uploaded asset publication remains the platform-injected addAsset/getAssets capability.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; stroke-geometry: aspect-aware polyline extrusion and wire-size-bounded chunks; input collection and game ink budgets stay separate.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; one-shot-audio: explicitly scoped transient playback nodes.

**Keep local:** Phrase list/encoding, letter rules, author exclusion, penalties/statistics and six-frame hangman workflow.

**Source evidence:**

- [index.js:194 — hangmanCreator(](../src/games/hangman/index.js#L194): Private six-frame drawing workflow with per-stroke and per-frame limits, Undo/Clear, and press/drag/release handling.
- [index.js:370 — buildStrokeCoordinates(](../src/games/hangman/index.js#L370): Polyline-to-ribbon geometry duplicates the drawing family.
- [index.js:516 — guess(](../src/games/hangman/index.js#L516): Letter eligibility and wrong/correct consequences.
- [index.js:413 — startRound(](../src/games/hangman/index.js#L413): Secret author input and fallback timer.
- [index.js:581 — tick(](../src/games/hangman/index.js#L581): Current-round deadlines and transient audio cleanup; unchanged ticks do not dirty the scene.

**Qualifications:** The launch polish uses 492 curated familiar entries from questions.js. testa is unused historical phrase data. The action queue was removed; see the Hangman polish evidence for private-input, lifecycle, drawing and browser checks. A host owns the authoritative answer; guest frames reveal only guessed letters until the result.

## happy-haulers

A gentle construction activity now lets the player choose castle, bridge or garden, load three colored cargo pieces per delivery, drive the truck and tip them onto a blueprint. Three deliveries complete the chosen project; a timed sequence animates truck/bed/cargo and a celebration returns to project choice. Composite vector parts are retained and transformed, with a bounded particle pool.

**Files reviewed:** [audio.js](../src/games/happy-haulers/audio.js), [index.js](../src/games/happy-haulers/index.js).

**Building blocks:** Local-coordinate composite parts with affine placement; Timed phase/ease animations; Pointer-edge/short-tap handling; Six-note/celebration PCM voice bank shared in structure with other playtime games.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Transform2D/composite parts; Geometry2D oval/star/polyline stroke; Small timeline/ease functions; PCM encoder + bounded AudioVoices.

**Keep local:** Project/blueprint geometry, material choices, delivery progression and truck choreography.

**Source evidence:**

- [index.js:143 — place(](../src/games/happy-haulers/index.js#L143): Repeated local-to-world part transform.
- [index.js:281 — advance(](../src/games/happy-haulers/index.js#L281): Domain phase transitions decide loading/driving/unloading.
- [index.js:293 — finishDelivery()](../src/games/happy-haulers/index.js#L293): Cargo nodes transfer from truck layer to completed project layer.
- [audio.js:38 — class HaulerAudio](../src/games/happy-haulers/audio.js#L38): Small generated sound bank and voice lifecycle.

**Qualifications:** Entrypoint changed during audit; final reading includes project choice and colored load selection. Square 100×100 coordinates differ from 150×100 playtime games; avoid baking aspect correction into primitive geometry. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## hearts

Four-seat Hearts with bots, three-card left/right/across/hold passes, two-clubs opening, follow-suit and hearts-breaking rules, first-trick restrictions, trick animations, shooting the moon and a 100-point match threshold.

**Files reviewed:** [index.js](../src/games/hearts/index.js), [theme.js](../src/games/hearts/theme.js).

**Building blocks:** Private full hands and passing selections with confirmation barrier.; Card theme/deck/sorting plus public trick area.; Seat replacement, delayed trick completion and tokenized bot turns.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** optional-card-kit: common card/button/table presentation and paginated private hands; themed defaults stay optional.; ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.

**Keep local:** Pass direction, legal play restrictions, heart/queen scoring, moon conversion and bot strategy.

**Source evidence:**

- [index.js:108 — createView(](../src/games/hearts/index.js#L108): Player hand and private confirmation controls.
- [index.js:192 — finishPassIfReady(](../src/games/hearts/index.js#L192): Collects all pass commitments before transferring cards.
- [index.js:207 — legalIndices(](../src/games/hearts/index.js#L207): Rules differ fundamentally from other trick games.
- [index.js:227 — playCard(](../src/games/hearts/index.js#L227): Trick completion waits before collecting cards.
- [index.js:256 — finishHand(](../src/games/hearts/index.js#L256): Moon and match scoring.
- [theme.js:42 — function card(](../src/games/hearts/theme.js#L42): Byte-identical card theme.

## hot-potato

At least two players pass a private potato by clicking; a random timer explodes it for its current holder, with transferred hiss playback offset.

**Files reviewed:** [index.js](../src/games/hot-potato/index.js).

**Building blocks:** ownership transfer; private audio; timed rounds.

**Existing facilities:** playerIds visibility inheritance; Asset startTime; Game.setTimeout.

**Candidates:** Player-owned audio handles with transfer/seek; Cancellable round scope.

**Keep local:** random victim/pass and explosion rules.

**Source evidence:**

- [index.js:116 — createPotato(assignedPlayerId)](../src/games/hot-potato/index.js#L116): Starts timed private object and nested sound.
- [index.js:173 — updatePotatoState(assignedPlayerId)](../src/games/hot-potato/index.js#L173): Transfers visibility and recreates audio at elapsed offset.

**Qualifications:** One explosion cleanup uses raw setTimeout; disconnect/round cancellation needs care before extraction.

## image-test

Moves, resizes, resets and changes per-edge crop percentages of an image.

**Files reviewed:** [index.js](../src/games/image-test/index.js).

**Building blocks:** image layout; cropping.

**Existing facilities:** Asset cropLeft/cropTop/cropRight/cropBottom; Asset pos/size.

**Candidates:** AssetFrame/pixel-to-percent crop helper and consistent bounds setter.

**Keep local:** manual diagnostic controls.

**Source evidence:**

- [index.js:190 — const cropEdges](../src/games/image-test/index.js#L190): Four controls repeat per-edge crop adjustments.
- [index.js:23 — const defaultImageSize](../src/games/image-test/index.js#L23): Aspect ratio compensated by hand.

**Qualifications:** Crop support already exists; only ergonomics/validation would be new.

## imposter

Three-to-eight-player phone-oriented social deduction. Crew see a secret word within a shared 16-word category grid, one imposter does not; everyone readies, discusses in an order, votes, and a caught imposter gets a word guess before results.

**Files reviewed:** [index.js](../src/games/imposter/index.js), [words.js](../src/games/imposter/words.js).

**Building blocks:** Private role/word views with permanent connection anchors.; Readiness plus replaceable ballots, discussion/guess clocks and late-join queue.; Transient flashes, pulses and confetti.; Recursive audience assignment helper.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.

**Keep local:** Category/word banks, role selection, clue order, tie/escape/caught-guess rules and scoring.

**Source evidence:**

- [index.js:146 — setNodePlayerIds(](../src/games/imposter/index.js#L146): Recursive audience updates are reused in The Argument.
- [index.js:381 — renderReveal(](../src/games/imposter/index.js#L381): Private role and secret-word visibility.
- [index.js:538 — castVote(](../src/games/imposter/index.js#L538): Replaceable vote; target cannot be oneself.
- [index.js:565 — tallyVotes(](../src/games/imposter/index.js#L565): Tie/accused selection belongs to game rules.
- [index.js:740 — spawnConfetti(](../src/games/imposter/index.js#L740): Bounded transient visual effect.
- [index.js:828 — handleNewPlayer(](../src/games/imposter/index.js#L828): Stable private anchor plus deferred participation.

**Qualifications:** words.js sampled as categorized content; all executable index logic read.

## input-test

Editable text and dynamic image/audio/video upload demo with clear and replay controls.

**Files reviewed:** [index.js](../src/games/input-test/index.js).

**Building blocks:** dynamic asset lifecycle; async cancellation; button composition.

**Existing facilities:** GameNode input descriptors; Asset nodes.

**Candidates:** AssetPlayback with fresh identity per replay and explicit stop; Lifecycle generation guard.

**Keep local:** upload UI and limits.

**Source evidence:**

- [index.js:65 — async upload](../src/games/input-test/index.js#L65): Generation and stopped flags reject stale async completion.
- [index.js:77 — showMedia(kind)](../src/games/input-test/index.js#L77): Replacement node gives replay fresh playback identity.

**Qualifications:** Upload storage/transport is injected handleFileUpload, not a Squish concern.

## iron-keep

Four-human medieval raycast arena with bots, connected procedural mazes, texture-strip walls, animated knight billboards, hitscan crossbow, respawns and a first-to-five/three-minute match; source media remain unfilled REPLACE_* IDs.

**Files reviewed:** [index.js](../src/games/iron-keep/index.js).

**Building blocks:** Host-rendered private forty-column raycast views and six-billboard pools; Spritesheet crops, panorama crop, per-player weapon/status overlays; Scene-owned one-shot audio and manually restarted music.

**Existing facilities:** GameNode.Asset crops and playerIds already provide image slicing and private views; TerrainGenerator already offers connected obstacle grids; Game timers and callbacks exist.

**Candidates:** Pure guarded grid DDA shared by wall views, line-of-sight and hit queries; Atlas frame-crop and synchronized Asset bounds helpers; AudioHandle lifetime/loop helper and reusable retained scene primitives.

**Keep local:** Castle generation/material choices, crossbow rules, bots and shared minimap policy; Raycast image compositor as a game/sample until clipping/occlusion semantics are robust.

**Source evidence:**

- [index.js:101 — const frameCrop](../src/games/iron-keep/index.js#L101): Calculates crop percentages from atlas row/column; duplicated by other sprite consumers.
- [index.js:745 — renderView(agent) {](../src/games/iron-keep/index.js#L745): Per-player retained image slices run an inline DDA; separate hitscan/LOS use stepped sampling.
- [index.js:234 — startMusic() {](../src/games/iron-keep/index.js#L234): Loops by replacing the sound node after a declared duration.

**Qualifications:** All metadata assets are placeholder IDs and have no shape fallback; media-dependent fidelity is not ready as checked in. Billboards use center-column wall tests and ascending distance drawing; do not promote approximate occlusion as a general 3D API. Movement depends on input event frequency rather than a held input state sampled each tick.

## kaboom-valley

Two-to-four-tank turn-based artillery game with bots, procedurally sampled hills, circular crater carving, wind/gravity trajectories, damage and post-explosion falling; disconnected pilots become bots.

**Files reviewed:** [index.js](../src/games/kaboom-valley/index.js).

**Building blocks:** Interpolated one-dimensional height field, terrain-to-polygon conversion and local edits; Shared ballistic simulator for aim preview and bot search; Turn ownership/deadlines, private controls and transient explosion effects.

**Existing facilities:** GameNode mutable polygons/text, playerIds and click callbacks; TerrainGenerator exists for connected 2D obstacle grids, a different problem from this 1D terrain.

**Candidates:** Polyline/height-field sampling as a small pure geometry utility; A parameterized fixed-step trajectory iterator usable for preview and simulation; Thick segments, color interpolation and scoped effect lifetimes.

**Keep local:** Destructible terrain rules, crater shape, fall damage and artillery balance; Bot angle/power search and turn/late-join policies.

**Source evidence:**

- [index.js:230 — surfaceYAt(x)](../src/games/kaboom-valley/index.js#L230): Interpolates neighboring terrain samples for placement, contact and fall resolution.
- [index.js:692 — simulatePath(tank](../src/games/kaboom-valley/index.js#L692): Reuses the same wind/gravity step for private aiming preview and bot shot search.
- [index.js:247 — carveCrater(cx](../src/games/kaboom-valley/index.js#L247): Modifies only affected columns and regenerates retained terrain outlines.

**Qualifications:** Do not replace existing TerrainGenerator with this specialized 1D model. Aim-adjust callbacks rely on node audience while keyboard/fire paths also check player ownership; reusable UI must keep explicit authorization separate from visibility.

## keep-up

Cooperative 90-second balloon keep-up with gradually added balloons, gravity, bounces, team streaks and individual contribution results.

**Files reviewed:** [index.js](../src/games/keep-up/index.js).

**Building blocks:** simple2D motion; timed effects; phase UI.

**Existing facilities:** Shape/Text nodes; playerIds.

**Candidates:** ShapeUtils regular polygon; TickClock/effect lifetime; Button/label composition.

**Keep local:** balloon physics tuning, streak and spawn schedule.

**Source evidence:**

- [index.js:34 — polyCircle](../src/games/keep-up/index.js#L34): Reimplements sampled circle outline.
- [index.js:240 — bop(pid](../src/games/keep-up/index.js#L240): Click changes velocity and schedules glow expiry.
- [index.js:269 — tick()](../src/games/keep-up/index.js#L269): Per-tick gravity, bounds, respawn and effect removal.

## layer-test

Overlapping colored layer roots change color on click; tick emits state changes.

**Files reviewed:** [index.js](../src/games/layer-test/index.js).

**Building blocks:** layer order; click callbacks.

**Existing facilities:** getLayers contract; Shape nodes.

**Candidates:** Keep as layer regression example; no missing primitive.

**Keep local:** demo geometry.

**Source evidence:**

- [index.js:53 — this.layers.push](../src/games/layer-test/index.js#L53): Each nested rectangle is a separate layer.
- [index.js:65 — handleLayerClick](../src/games/layer-test/index.js#L65): Click mutates callback-bound fill.

## little-rambler

A persistent companion home with feeding, petting, growth and furnishings funds two outings: a side-view garden platform walk and bouncing-magnet salvage. The pure engine uses 120 Hz steps, coyote time/jump buffering and once-only outing rewards, including early return. Adapter handles modal menus, input ownership, native hover/cursors, name entry, revision-based persistence and scene-specific music.

**Files reviewed:** [art/garden-data.js](../src/games/little-rambler/art/garden-data.js), [art/home-data.js](../src/games/little-rambler/art/home-data.js), [art/lagoon-data.js](../src/games/little-rambler/art/lagoon-data.js), [art.js](../src/games/little-rambler/art.js), [audio.js](../src/games/little-rambler/audio.js), [creature.js](../src/games/little-rambler/creature.js), [cursors.js](../src/games/little-rambler/cursors.js), [engine.js](../src/games/little-rambler/engine.js), [index.js](../src/games/little-rambler/index.js), [painter.js](../src/games/little-rambler/painter.js), [scene.js](../src/games/little-rambler/scene.js).

**Building blocks:** Shared bounded active-order painter with image slots; Platform physics fixed-step/coyote/jump buffer; Stable hover targets and optional cursor service; Revision-tagged save data; Scene music voice scheduling; Portable base64 image decode.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** FixedStepper; Camera/affine math; HitRegion/hover binding lifecycle above platform dispatcher; AssetRegistration + decode helper with portable boundary; AudioVoices and save scheduling.

**Keep local:** Pip artwork/reactions/growth, care economy, furnishing behavior, outing maps/rewards and specific jump/ball feel.

**Source evidence:**

- [engine.js:162 — finishOuting(](../src/games/little-rambler/engine.js#L162): Guards reward settlement and applies local milestone/growth policy.
- [engine.js:193 — tick(](../src/games/little-rambler/engine.js#L193): Queues jump edges once then consumes fixed 120 Hz steps.
- [index.js:155 — syncHoverTargets()](../src/games/little-rambler/index.js#L155): Persistent action targets are necessary because unpressed pointer motion is not streamed.
- [audio.js:249 — tick(dt, context](../src/games/little-rambler/audio.js#L249): Scene changes stop old music immediately, unlike phrase-finishing Moonbounce.
- [cursors.js:128 — function cursorDescriptor](../src/games/little-rambler/cursors.js#L128): Native cursor descriptor is an optional platform service wrapper.

**Qualifications:** Generated art/home-data.js, art/garden-data.js, art/lagoon-data.js and cursor image strings are data; decoder/descriptor logic was reviewed, bitmap contents were not visually audited. Painter clamps vertices; replacing with true clipping is a deliberate behavior change. Do not mistake companion art for a generally reusable character system. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## little-scoop-shop

Pointer-led ice cream activity: choose cone/cup, add up to three flavors, toggle sprinkles/cherry and serve a bunny. Current source also generates picture orders; matching is forgiving about scoop order and earns a special favorite response while any treat can be served. Timed scoop/topping/serving phases retain transformed vector parts and a small PCM voice bank.

**Files reviewed:** [audio.js](../src/games/little-scoop-shop/audio.js), [index.js](../src/games/little-scoop-shop/index.js).

**Building blocks:** Aspect-correct local-coordinate art transforms; Spatial hit targets shared with drawn controls; Small timed phase animations; Quiet normalized Foley synthesis and pooled voices.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Geometry2D and Transform2D; Action hit regions with press/release deduplication; PCM encoder/AudioVoices.

**Keep local:** Flavor/order generator, treat layers, bunny art, matching reward and interaction pacing.

**Source evidence:**

- [index.js:207 — matchesOrder()](../src/games/little-scoop-shop/index.js#L207): Flavor multiset comparison is intentionally forgiving, not sequence matching.
- [index.js:213 — tap(](../src/games/little-scoop-shop/index.js#L213): Explicit spatial controls; keyboard is intentionally disabled.
- [index.js:296 — tick()](../src/games/little-scoop-shop/index.js#L296): Different phase durations gate serving and order renewal.
- [audio.js:34 — class ScoopAudio](../src/games/little-scoop-shop/audio.js#L34): Voice lifecycle repeats other playtime audio.

**Qualifications:** Final review includes order-picture matching added during the mutable working-tree audit. Pointer-only interaction is intentional and should not be overridden by a universal input mapping. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## little-slugger

Assisted batting activity with tee and pitch modes, selectable colored targets, three-star collection and moving targets on later rounds. A correctly timed pitch swing makes a sky hit; an early/late press queues an assisted line drive; tee mode produces a bounce. Trajectories and character animation are authored rather than a full ball/bat collision simulation.

**Files reviewed:** [audio.js](../src/games/little-slugger/audio.js), [index.js](../src/games/little-slugger/index.js).

**Building blocks:** Retained character parts and parametric flight/trail animation; Input edge latches/queued action; Phase clock and bounded particles; Duplicate playtime PCM/voice infrastructure.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Transform2D and geometry helpers; Time/ease helpers; Press/hold/queued edge state primitives; PCM + AudioVoices.

**Keep local:** Contact window, queued assist, shot trajectories, target/sticker rules and teddy artwork.

**Source evidence:**

- [index.js:234 — contactReady()](../src/games/little-slugger/index.js#L234): Pitch timing has a .51–.84 progress contact window.
- [index.js:235 — swing()](../src/games/little-slugger/index.js#L235): Out-of-window press queues an assisted hit rather than failing.
- [index.js:317 — tick()](../src/games/little-slugger/index.js#L317): Flight/celebration/target motion and collection are host-driven.
- [audio.js:38 — class](../src/games/little-slugger/audio.js#L38): Audio template shares voice plumbing with Haulers/Rainbow/Starry.

**Qualifications:** Entrypoint changed during audit; earlier guaranteed single-press behavior was superseded. Final description is from current tee/pitch source. Do not extract this flight as general physical ball collision. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## little-zoo-walk

Circular zoo walk through six animated animal habitats, with greeting, feeding and catch activities. Choosing a snack then the animal, or tapping the moving ball, earns per-visit progress and a stamp after three interactions. Walking swaps habitat midway; species-specific limb/pivot animation and cries share generic vector transforms and sound lifecycle.

**Files reviewed:** [animals.js](../src/games/little-zoo-walk/animals.js), [audio.js](../src/games/little-zoo-walk/audio.js), [index.js](../src/games/little-zoo-walk/index.js), [shapes.js](../src/games/little-zoo-walk/shapes.js).

**Building blocks:** Independent creature parts with role/pivot animation; Ellipse hit testing and aspect transform; Retained activity/visit state; Quiet procedural animal audio.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Transform2D with optional pivot; Shape geometry and ellipse hit test; PCM encoder/voice pool.

**Keep local:** Species bodies/poses/cries, habitats, food matching art and stamp progression.

**Source evidence:**

- [index.js:62 — place(](../src/games/little-zoo-walk/index.js#L62): Transforms part geometry and species-specific role animation.
- [index.js:170 — completeActivity()](../src/games/little-zoo-walk/index.js#L170): Local visit stamp rules require three feed/play interactions.
- [index.js:280 — tap(](../src/games/little-zoo-walk/index.js#L280): Food/animal/ball hit tests have different intentional targets.
- [animals.js:17 — function](../src/games/little-zoo-walk/animals.js#L17): Authored animal geometry is content, not a universal animal factory.

**Qualifications:** Final source includes feed/play activities added during audit. Full-screen pointer dispatch remains in the game; generic hit tests should not reconstruct platform dispatch. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## mancala

Two-seat Kalah-style Mancala with six pits each, extra turns for landing in the own store, opposite capture, terminal sweeping, animated sowing, minimax bot moves and alternating starts across rematches.

**Files reviewed:** [index.js](../src/games/mancala/index.js).

**Building blocks:** 14-count board, pit/store index helpers and pure move simulation.; Timer-driven stone-by-stone animation with input lock.; Seat replacement, delayed bots and circle/ellipse rendering.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; shape-primitives: ellipse generation with explicit segments.

**Keep local:** Sowing direction, opponent-store skip, captures, extra turns, sweep logic and minimax state transitions.

**Source evidence:**

- [index.js:224 — playPit(](../src/games/mancala/index.js#L224): Sowing mutates board across delayed steps.
- [index.js:275 — simulateMove(](../src/games/mancala/index.js#L275): Local pure Kalah move model for bot search.
- [index.js:360 — scheduleBotIfNeeded(](../src/games/mancala/index.js#L360): Delayed turn scheduling with ownership token.
- [index.js:377 — resetRound(](../src/games/mancala/index.js#L377): Invalidates animation/bot state and alternates starting side.

## masterpiece

Three-by-four sliding painting puzzle with 11 cropped tiles and one blank, legal adjacency moves, a solvable random-walk shuffle, move counter, temporary full-image peek and victory display followed by reshuffle.

**Files reviewed:** [index.js](../src/games/masterpiece/index.js).

**Building blocks:** Grid slot geometry and normalized image-crop mapping.; Random-walk shuffle and image overlay lifecycle.; Scheduled peek removal and next puzzle.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Asset and GameNode.Asset already provide resource references; uploaded asset publication remains the platform-injected addAsset/getAssets capability.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; image-layout: normalized image tile/crop helpers; preserve existing Asset crop payload contract.

**Keep local:** Sliding-puzzle adjacency, solvability strategy, painting choice and win flow.

**Source evidence:**

- [index.js:34 — const tileCrop](../src/games/masterpiece/index.js#L34): Maps a home tile to a normalized painting crop.
- [index.js:199 — shuffle(](../src/games/masterpiece/index.js#L199): Random legal moves preserve solvability.
- [index.js:247 — handlePeek(](../src/games/masterpiece/index.js#L247): Temporary full-painting overlay.
- [index.js:259 — handleVictory(](../src/games/masterpiece/index.js#L259): Win display and scheduled reset.

**Qualifications:** Painting asset id is REPLACE_WITH_PAINTING_ASSET_ID; game logic exists but asset setup is unfinished.

## mem-test

Allocation stress example replaces one visible red square every tick.

**Files reviewed:** [index.js](../src/games/mem-test/index.js).

**Building blocks:** node churn; scene cleanup.

**Existing facilities:** addChild/removeChild.

**Candidates:** Stable keyed scene update API demonstrated by contrast.

**Keep local:** intentional allocation benchmark.

**Source evidence:**

- [index.js:27 — tick()](../src/games/mem-test/index.js#L27): Allocates replacement node and detaches prior node each tick.

**Qualifications:** Do not rewrite away the churn in a test meant to expose it.

## micro-mayhem

Eight-seat tap-only party gauntlet that shuffles five distinct challenges: odd color tile, reaction draw, Stroop ink choice, sequence memory and briefly displayed triangle counting; awards arrival-ranked points and a final podium.

**Files reviewed:** [index.js](../src/games/micro-mayhem/index.js).

**Building blocks:** Lobby membership/next-round join queue, timed phase transitions and per-challenge answer guards; Shared boards with private feedback and identity labels; Repeated buttons, choice grids, score strips, transient labels and confetti.

**Existing facilities:** GameNode callbacks, playerIds, mutable text/shape and shadow effects.

**Candidates:** Composable button/choice-grid/progress primitives respecting audience and callbacks; Scoped phase deadlines and replaceable transient messages; Injected-RNG Fisher-Yates shuffle helper.

**Keep local:** Each challenge answer protocol, rank points, penalties and memory sequence rules; Gauntlet ordering, pending join policy and podium styling.

**Source evidence:**

- [index.js:271 — nextStage() {](../src/games/micro-mayhem/index.js#L271): Sequences intro, challenge, score delay and podium through the host tick.
- [index.js:591 — handleMemoryTap(playerId](../src/games/micro-mayhem/index.js#L591): Maintains private progress/lockout while sharing the same visual memory board.
- [index.js:869 — updateTransients() {](../src/games/micro-mayhem/index.js#L869): Removes grouped temporary private labels on tick expiry.

**Qualifications:** The metadata description says 15-second minigames, but actual phases have challenge-specific timings; record those semantics rather than standardizing a fixed duration.

## moonbounce

Peg-bouncing campaign across authored boards and worlds, with five selectable powers, moving pegs, bumpers, portals, catches and mastery challenges. A 120 Hz engine provides launch preview using the same collision routine while suppressing score side effects; fast-forward adds ordinary steps and yields to anticipation/fever slow motion. Adapter records shot results into migrated progression and manages aiming, menus and world music.

**Files reviewed:** [adventure-scenes.js](../src/games/moonbounce/adventure-scenes.js), [art.js](../src/games/moonbounce/art.js), [decorations.js](../src/games/moonbounce/decorations.js), [engine.js](../src/games/moonbounce/engine.js), [garden-data.js](../src/games/moonbounce/garden-data.js), [index.js](../src/games/moonbounce/index.js), [levels.js](../src/games/moonbounce/levels.js), [painter.js](../src/games/moonbounce/painter.js), [progression.js](../src/games/moonbounce/progression.js), [scene.js](../src/games/moonbounce/scene.js), [sound.js](../src/games/moonbounce/sound.js), [world-art-data.js](../src/games/moonbounce/world-art-data.js).

**Building blocks:** Fixed-step simulation with controlled extra stepping; Preview using local copied moving geometry; Clamped active-order painter; Seeded layout and separate effect RNG; Versioned progress migration; Phrase-aware music scheduler.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** FixedStepper with explicit budget/clock policy; Geometry2D and common Painter primitives; Random/shuffle primitives with preserved algorithm; PCM/voice lifecycle and image decoding.

**Keep local:** Peg physics, anti-stall peg removal, powers, reachability-filtered board builder, fever/jackpot/style scoring, challenges/unlocks.

**Source evidence:**

- [engine.js:513 — step(](../src/games/moonbounce/engine.js#L513): Fast-forward changes step count, not collision resolution; slow-motion is local policy.
- [engine.js:531 — preview()](../src/games/moonbounce/engine.js#L531): Reuses collision routine with future moving-peg geometry and preview flag.
- [levels.js:67 — function board(](../src/games/moonbounce/levels.js#L67): Reachability/spacing filters are specific to Moonbounce launch physics.
- [index.js:152 — recordShot()](../src/games/moonbounce/index.js#L152): Shot-boundary career accounting differs from Facet cumulative delta accounting.
- [sound.js:202 — tick(events](../src/games/moonbounce/sound.js#L202): Finales finish a current phrase and stop scheduling new phrases.

**Qualifications:** garden-data.js and world-art-data.js are generated base64 artwork (about 15 MB total); sampled as payload, not gameplay logic. Painter uses vertex clamping, unlike Facet/World Eater true clipping. Career progression is saved; no active-flight resume contract should be inferred. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## move-test

Two rectangles move using arrows/WASD or analog sticks, clamp to the board and reject AABB overlaps.

**Files reviewed:** [index.js](../src/games/move-test/index.js).

**Building blocks:** bounded motion; collision query; analog time scaling.

**Existing facilities:** GeometryUtils.checkCollisions; ShapeUtils.rectangle; BaseNode.update.

**Candidates:** Pure AABB and motion helpers independent of scene traversal; InputState.

**Keep local:** two-player key scheme.

**Source evidence:**

- [index.js:49 — handleGamepadInput](../src/games/move-test/index.js#L49): Analog displacement uses supplied deltaTime.
- [index.js:61 — movePlayer(player](../src/games/move-test/index.js#L61): Bounds and scene-tree collision check are hand-composed.

**Qualifications:** Existing GeometryUtils assumes axis-aligned rectangles; do not advertise general polygon collision.

## neon-grid

Six-seat Tron-style light-cycle arena with four minimum riders filled by bots, permanent grid trails, simultaneous collision resolution, countdowns and inter-round scoring.

**Files reviewed:** [index.js](../src/games/neon-grid/index.js).

**Building blocks:** Discrete occupied grid and simultaneous movement intents; Retained straight trail segments, compacted on turns; Private rider labels, round phases and fading wrecks.

**Existing facilities:** GameNode shapes/text, callbacks and playerIds; Game tick and per-player input callbacks.

**Candidates:** Pure grid indexing/bounds/cardinal scan helpers shared with maze ray queries; Retained polyline or rectangular-run node builder; Tick-owned transient effects and countdown helpers.

**Keep local:** Simultaneous trail and same-target collision rules; Bot steering, no-reverse rule, score and rider-to-bot disconnect policy.

**Source evidence:**

- [index.js:613 — moveRiders()](../src/games/neon-grid/index.js#L613): Computes every next target before committing survivors, preserving simultaneous collision semantics.
- [index.js:491 — segmentRect(](../src/games/neon-grid/index.js#L491): Straight trail runs render as one expanding rectangle rather than per-cell nodes.
- [index.js:683 — updateDerez()](../src/games/neon-grid/index.js#L683): Fading trails clear only grid cells still owned by the dead rider.

## nova-guard

Cooperative orbital shields rotate around a shared core to block inward-moving enemies; waves scale with crew size and include multi-hit bosses.

**Files reviewed:** [index.js](../src/games/nova-guard/index.js).

**Building blocks:** angle wrapping; annular polygon; timed particle effects; wave phases.

**Existing facilities:** Shape/Text/effects; playerIds notices.

**Candidates:** Math.angleDelta/approachAngle; ShapeUtils.arcBand/regularPolygon; TransientScope.

**Keep local:** radial shield hit rules, wave scaling and core repair.

**Source evidence:**

- [index.js:43 — angleDiff =](../src/games/nova-guard/index.js#L43): Manual shortest angular difference.
- [index.js:165 — arcPolygon(angle](../src/games/nova-guard/index.js#L165): Builds annular shield strip.
- [index.js:425 — updateEnemies()](../src/games/nova-guard/index.js#L425): Tests radial band then angular overlap.

**Qualifications:** Arc hit model is game-specific; generic collision API should not assume it.

## orbit-breaker

Single-player twin-stick combat built around catching hostile shots in a directional cone and returning captured orbiting ammunition, with dash/nova, sectors, upgrades and a practice mode. The engine owns combat; adapter owns input device lease, stale-input timeouts and pause/menu transitions. Its phase-sized painter keeps unused pools attached and hidden.

**Files reviewed:** [engine.js](../src/games/orbit-breaker/engine.js), [index.js](../src/games/orbit-breaker/index.js), [painter.js](../src/games/orbit-breaker/painter.js), [scene.js](../src/games/orbit-breaker/scene.js), [settings.js](../src/games/orbit-breaker/settings.js), [sound.js](../src/games/orbit-breaker/sound.js).

**Building blocks:** Device ownership/heartbeat state; Edge/hold/menu navigation mapping; Pooled bullets and effects; Attached retained painter; Generated cue voices.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** ActionState over normalized platform handlers; BoundedPool and swept segment distance; Painter primitives and PCM/audio lifecycle.

**Keep local:** Capture/perfect-return combat, enemy patterns, sector upgrades and scoring.

**Source evidence:**

- [index.js:107 — handleGamepadInput(](../src/games/orbit-breaker/index.js#L107): Device ownership prevents neutral input from another pad taking control.
- [painter.js:7 — class Painter](../src/games/orbit-breaker/painter.js#L7): Preallocated attached pools differ from active-only scene writers.
- [engine.js:13 — class Engine](../src/games/orbit-breaker/engine.js#L13): Combat remains host simulation rather than client-distributed state.
- [sound.js:23 — class](../src/games/orbit-breaker/sound.js#L23): Cue voice lifecycle duplicates infrastructure.

**Qualifications:** Saved data is preferences/best score, not a complete campaign checkpoint. Global hardware normalization already exists in homegames-common; share state consumers, not a second gamepad protocol. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## perf-test

Appends randomly colored 1×1 rectangles at 20ms intervals to stress scene size.

**Files reviewed:** [index.js](../src/games/perf-test/index.js).

**Building blocks:** growth benchmark; timer ownership.

**Existing facilities:** Game.setInterval; Shape nodes.

**Candidates:** Benchmark utilities, not gameplay API.

**Keep local:** stress workload.

**Source evidence:**

- [index.js:25 — const filler](../src/games/perf-test/index.js#L25): Interval creates and attaches nodes.

**Qualifications:** The stopping condition checks xCounter===100 after resetting it to0, so it appears unreachable; source-only finding.

## player-vis-test

Show/hide buttons reveal a secret parent and child only to the clicking player; spectator gets a different root.

**Files reviewed:** [index.js](../src/games/player-vis-test/index.js).

**Building blocks:** visibility inheritance; spectator scene.

**Existing facilities:** BaseNode.showFor/hideFor; playerIds; getSpectatorLayers contract.

**Candidates:** VisibilityScope convenience without weakening existing filtering.

**Keep local:** secret message and demo buttons.

**Source evidence:**

- [index.js:61 — this.secretMessage.showFor](../src/games/player-vis-test/index.js#L61): Uses existing per-player visibility API.
- [index.js:85 — getSpectatorLayers](../src/games/player-vis-test/index.js#L85): Spectator is explicitly separated.

## pocket-front

Single-player compact RTS: place structures, recruit ranger/tank/medic forces, drag-select units and command attacks while defending waves and capturing a beacon. Six-wave and endless progression offer upgrades. The adapter maintains stable enemy interaction nodes; a dead enemy node remains hidden during an active drag to preserve release delivery. Feedback combines retryable asset registration, cursor state and rate-limited audio.

**Files reviewed:** [engine.js](../src/games/pocket-front/engine.js), [feedback.js](../src/games/pocket-front/feedback.js), [index.js](../src/games/pocket-front/index.js), [scene.js](../src/games/pocket-front/scene.js), [settings.js](../src/games/pocket-front/settings.js).

**Building blocks:** Drag selection and stable pointer target identity; Lazy active-order painter; Reliable asynchronous asset registry; Validated optional native cursor service; Rate-limited fresh-node audio voices.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** AssetRegistration with shared pending work and retry; HitRegion/capture lifecycle primitives; Geometry2D segment distance and shape helpers; AudioVoices configured for node identity.

**Keep local:** RTS placement/selection rules, faction combat, beacon capture, waves/upgrades and feedback art.

**Source evidence:**

- [feedback.js:41 — class](../src/games/pocket-front/feedback.js#L41): Tracks successful asset registration and handles cursor/audio services.
- [index.js:12 — class Painter](../src/games/pocket-front/index.js#L12): Drawing pool is distinct from stable input nodes.
- [index.js:206 — // A pressed enemy may die mid-drag.](../src/games/pocket-front/index.js#L206): Input identity is retained across disappearance during drag.
- [engine.js:8 — class](../src/games/pocket-front/engine.js#L8): Host-side RTS simulation and rules remain game-specific.

**Qualifications:** Painter text-size compensation differs from other 160×90 painters; verify intended version behavior before harmonizing. Current renderer identifies audio by node ID plus asset key; this fresh-node approach must not be forced into legacy key-duplication assumptions. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## prism-3d

Four-human first-person laser-tag maze with bot opponents, per-player 56-column views, line-of-sight hits, respawns and shared minimap/scoreboard.

**Files reviewed:** [index.js](../src/games/prism-3d/index.js).

**Building blocks:** grid DDA raycast; camera basis; visible sprite projection; grid connectivity.

**Existing facilities:** Shape nodes; playerIds private slices.

**Candidates:** Pure GridRaycast.cast returning distance/cell/normal; Camera projection/clipping; KeyedScene.

**Keep local:** tag rules, bot behavior, map generation style and match phases.

**Source evidence:**

- [index.js:533 — renderView(agent)](../src/games/prism-3d/index.js#L533): DDA wall traversal and private perspective projection.
- [index.js:780 — tryFire(agent)](../src/games/prism-3d/index.js#L780): Separate stepped ray logic tests walls and opponents.
- [index.js:175 — generateMap()](../src/games/prism-3d/index.js#L175): Flood-fill connectivity protects maze generation.

**Qualifications:** Sprite occlusion samples only its center column; avoid lifting that approximation as a general occlusion API. Rendering and shooting rays differ; a shared primitive must define world-distance units and boundary semantics.

## raft

Cooperative 150-second river run: every player paddles a shared raft left/right, following a narrowing sine channel while collecting ducks and bouncing off banks.

**Files reviewed:** [index.js](../src/games/raft/index.js).

**Building blocks:** fixed row render reuse; world-to-screen scroll; temporary effects; co-op input aggregation.

**Existing facilities:** Shape/Text primitives; playerIds.

**Candidates:** 2D polygon transform; Timed effect lifetime; UI button/roster helpers.

**Keep local:** sine river generation, collective steering and score.

**Source evidence:**

- [index.js:167 — updateRiver()](../src/games/raft/index.js#L167): Updates persistent bank nodes rather than rebuilding rows.
- [index.js:253 — raftCoords(angle)](../src/games/raft/index.js#L253): Manual2D rotation of local corners.
- [index.js:307 — tick()](../src/games/raft/index.js#L307): Converts world-distance duck positions into current view and removes offscreen ducks.

## rainbow-pop

Pop six colored balloons to assemble a rainbow, with a current requested color from Bunny providing an optional matching reward. Any balloon still contributes, so the matching prompt does not block completion. A celebration resets the round; retained balloon parts, particle slots and short-tap input share infrastructure with the other playtime games.

**Files reviewed:** [audio.js](../src/games/rainbow-pop/audio.js), [index.js](../src/games/rainbow-pop/index.js).

**Building blocks:** Retained composite part transforms; Bounded particles; Pointer edge/short tap handling; Playtime PCM voice bank.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Transform2D and geometry; BoundedPool; AudioVoices/PCM encoder.

**Keep local:** Bunny color wish, collection/celebration timing, balloon/rainbow artwork.

**Source evidence:**

- [index.js:196 — chooseWish()](../src/games/rainbow-pop/index.js#L196): Chooses the next remaining requested color; optional reward policy.
- [index.js:216 — pop(](../src/games/rainbow-pop/index.js#L216): Matched and unmatched pops both progress the round.
- [index.js:145 — place(](../src/games/rainbow-pop/index.js#L145): Same local geometry transform as other playtime composites.
- [audio.js:38 — class](../src/games/rainbow-pop/audio.js#L38): Audio plumbing is duplicated across playtime activities.

**Qualifications:** Final source includes requested-color matching added during audit. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## red-truck-ramble

Continuous toy driving over a seamless repeating terrain course, using cruise/reverse controls and keyboard movement. Speed and ramp-lip crossing trigger assisted jumps; queued flips and soft wheelbase suspension make the truck forgiving. Camera/parallax rendering follows a deterministic fixed-step vehicle engine; periodic engine sound segments track motion.

**Files reviewed:** [audio.js](../src/games/red-truck-ramble/audio.js), [engine.js](../src/games/red-truck-ramble/engine.js), [index.js](../src/games/red-truck-ramble/index.js), [truck.js](../src/games/red-truck-ramble/truck.js).

**Building blocks:** Periodic terrain interpolation with shared render/collision samples; Fixed-step accumulator; Local-part articulated vehicle transforms; Camera smoothing; Continuous engine-segment and effect voices.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** FixedStepper; Transform2D and path sampling primitives; AudioVoices plus periodic scheduler with no backlog catchup.

**Keep local:** Terrain knots, suspension/jump assistance, flip policy, truck artwork, motor/Foley samples.

**Source evidence:**

- [engine.js:30 — function terrainPoints](../src/games/red-truck-ramble/engine.js#L30): Includes terrain corners so rendered and collision ramp shape agree.
- [engine.js:122 — step(](../src/games/red-truck-ramble/engine.js#L122): Vehicle uses deterministic fixed substeps.
- [audio.js:86 — class](../src/games/red-truck-ramble/audio.js#L86): Engine segment scheduling differs from one-shot playtime notes.
- [index.js:219 — tick()](../src/games/red-truck-ramble/index.js#L219): Adapter advances simulation and camera/view/audio together.

**Qualifications:** Vehicle physics is assisted arcade behavior, not a reusable realistic vehicle engine. Pinned to squish-142; geometry normalization uses 150×100 design units. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## relic-rush

One active runner races a three-lane first-person corridor while others spectate, jumping low bars, ducking high beams and collecting height-specific coins.

**Files reviewed:** [index.js](../src/games/relic-rush/index.js).

**Building blocks:** perspective projection; analytic ray intersection; visible object filtering; fixed slice reuse.

**Existing facilities:** Shape nodes; playerIds spectator notices.

**Candidates:** Camera projection/clipping helpers; Keyed projected-scene reuse; Scalar interpolation and polygon helpers.

**Keep local:** procedural event fairness, lane/jump/duck rules and shared spectator design.

**Source evidence:**

- [index.js:338 — renderFrame()](../src/games/relic-rush/index.js#L338): Persistent wall columns use analytic corridor-side rays; objects are depth filtered and painter sorted.
- [index.js:414 — drawObject(o, depth)](../src/games/relic-rush/index.js#L414): Projects world vertical spans into view rectangles.
- [index.js:517 — resolveCrossings(prevX)](../src/games/relic-rush/index.js#L517): Discrete lane and jump-state rules drive collision.

**Qualifications:** This is a constrained corridor projection, not a general world raycaster; do not standardize its collision model.

## sandy-castle

Beach activity alternates scoop, fill and flip actions to place three molded towers, then lets the player choose and spatially place flags/shells before washing the castle away. Current source adds mold/placement choice and repeat-round variation. A phase clock drives bucket/shovel/wave animation; pointer targets track the appropriate object.

**Files reviewed:** [audio.js](../src/games/sandy-castle/audio.js), [index.js](../src/games/sandy-castle/index.js).

**Building blocks:** Aspect-correct composite parts; Spatial ellipse/rectangle targets; Timed phase transitions and easing; Procedural Foley voice pool.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Transform2D/Geometry2D; HitRegion primitives; PCM/audio voice lifecycle.

**Keep local:** Mold shapes, tower placement, decoration rules, crab animation and wash-reset choreography.

**Source evidence:**

- [index.js:237 — activate()](../src/games/sandy-castle/index.js#L237): Scoop/fill/flip transitions remain local activity rules.
- [index.js:242 — decorate(](../src/games/sandy-castle/index.js#L242): Flags attach to nearest tower; shells use bounded placement slots.
- [index.js:249 — reset()](../src/games/sandy-castle/index.js#L249): Resets round/molds/decor and rotates default choice.
- [audio.js:38 — class](../src/games/sandy-castle/audio.js#L38): Quiet synthesized cues share generic WAV/voice plumbing.

**Qualifications:** Final source includes mold and spatial placement changes present at audit completion. Keyboard no-op is deliberate; do not generalize all toy actions into one activation key. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## savegame_demo

Click counter restores injected saveData and saves a plain snapshot through saveGame.

**Files reviewed:** [index.js](../src/games/savegame_demo/index.js).

**Building blocks:** snapshot persistence; click gating.

**Existing facilities:** Shape/Text nodes; Game superclass.

**Candidates:** Document persistence adapter contract and versioned snapshot patterns.

**Keep local:** counter snapshot schema.

**Source evidence:**

- [index.js:15 — constructor({ saveData, saveGame })](../src/games/savegame_demo/index.js#L15): Persistence already supplied by host.
- [index.js:51 — saveGame({](../src/games/savegame_demo/index.js#L51): Saves gameplay data rather than scene nodes.

**Qualifications:** Legacy renderText cleanup checks children.length although children may be keyed; avoid lifting it.

## scale-test

Side-by-side geometry/image size calibration in a tall aspect-ratio viewport.

**Files reviewed:** [index.js](../src/games/scale-test/index.js).

**Building blocks:** asset bounds; aspect calibration.

**Existing facilities:** Asset pos/size; ShapeUtils.rectangle.

**Candidates:** Asset layout helper keeping geometry and asset bounds consistent.

**Keep local:** calibration composition.

**Source evidence:**

- [index.js:36 — this.testAsset](../src/games/scale-test/index.js#L36): Duplicates rectangle dimensions in asset pos/size.

## seance

One-to-eight-player collaborative Ouija toy: players hold/drag on a board to exert normalized force on a damped planchette alongside ambient spirit bias, dwell selects letters/answers, and farewell reports each participant’s influence.

**Files reviewed:** [index.js](../src/games/seance/index.js).

**Building blocks:** Continuous pointer holds with stale-input expiry.; Damped motion, board bounds and dwell threshold/cooldown.; Transcript queue, letter indicators, flickering candles and temporary highlights.; Persistent private player roots.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; text-list: bounded transcript/history storage only if useful beyond this game.

**Keep local:** Spirit wandering/bias, force mixing, dwell selection, influence statistics and séance presentation.

**Source evidence:**

- [index.js:317 — handleHold(](../src/games/seance/index.js#L317): Relies on repeated held onClick events, not press-once semantics.
- [index.js:329 — tick(](../src/games/seance/index.js#L329): Stale input cutoff, influence and damped motion.
- [index.js:408 — updateDwell(](../src/games/seance/index.js#L408): Game-specific target dwell/cooldown.
- [index.js:543 — rebuildPlayerRoot(](../src/games/seance/index.js#L543): Private identity content remains anchored.

**Qualifications:** Changing all buttons/pointers to globally edge-triggered behavior would break this game.

## shape-test

Static concave polygon with an empty click callback; focused polygon rendering test.

**Files reviewed:** [index.js](../src/games/shape-test/index.js).

**Building blocks:** polygon rendering.

**Existing facilities:** GameNode.Shape POLYGON.

**Candidates:** Retain as regression fixture; no abstraction justified.

**Keep local:** test outline.

**Source evidence:**

- [index.js:23 — coordinates2d:](../src/games/shape-test/index.js#L23): Explicit concave outline exercises existing polygon primitive.

## sheep-drive

Up to eight dogs steer by pointer targets to herd flocking sheep through a pen gate over three rounds, adding a pond and stubborn goat.

**Files reviewed:** [index.js](../src/games/sheep-drive/index.js).

**Building blocks:** circle/rectangle separation; steering; neighbor queries; phased rounds.

**Existing facilities:** Shape/Text primitives.

**Candidates:** Geometry2D circleAabb contact/resolve and circleCircle contact; Optional spatial hash query; Vector moveTowards and regular polygon.

**Keep local:** flock weighting, goat personality, pen scoring and rounds.

**Source evidence:**

- [index.js:353 — collideWalls(e, rad)](../src/games/sheep-drive/index.js#L353): Implements circle-versus-AABB minimum separation including center-inside case.
- [index.js:412 — updateSheep(s, dogs)](../src/games/sheep-drive/index.js#L412): Combines separation/cohesion/alignment/flee and game-specific randomness.
- [index.js:398 — updateDog(p)](../src/games/sheep-drive/index.js#L398): Normalizes target movement and clamps step.

**Qualifications:** Broad-phase spatial index benefits larger populations, but25sheep alone does not prove a performance problem.

## showboat

Two-to-six-player acting game with a pure rule engine: roster-based performer rotation, private prompts, preparation/performance/vote/reveal stages, audience answer points, claps and optional room/remote live media.

**Files reviewed:** [index.js](../src/games/showboat/index.js), [rules.js](../src/games/showboat/rules.js), [README.md](../src/games/showboat/README.md).

**Building blocks:** Injected RNG and time-driven pure Rules state transitions.; Stable private roots and role-specific controls.; Optional media permission/capture/transmit lifecycle with epoch guards.; Persistent mounted stream node and close-time unsubscribe/disposal.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; GameNode.Stream and platform-provided media capability already provide stream presentation/control; no new transport is needed.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; resource-scope: register unsubscribe/stop callbacks and reject stale async operations, usable for media and uploads.

**Keep local:** Prompt bank, actor queue, correct-answer scoring, role/phase controls, host migration and live-performer policy.

**Source evidence:**

- [index.js:62 — button(](../src/games/showboat/index.js#L62): Owner-aware UI actions scoped through parent audience.
- [index.js:114 — setMode(](../src/games/showboat/index.js#L114): Async media request is guarded against stale epochs.
- [index.js:166 — silenceInactive(](../src/games/showboat/index.js#L166): Transmission is stopped when performer/round/phase no longer matches.
- [index.js:377 — syncStage(](../src/games/showboat/index.js#L377): Stream node stays mounted while stream id is unchanged.
- [index.js:399 — close()](../src/games/showboat/index.js#L399): Explicit media cleanup followed by Game.close.
- [rules.js:166 — class ShowboatRules](../src/games/showboat/rules.js#L166): Rules and view projection are authored support logic, fully reviewed.

**Qualifications:** README and rules.js read, including prompt data and role-redacted viewFor. Uses squish-145 and an optional platform media capability; extraction must not introduce browser globals or media transport into core Squish.

## slaps

Legacy card comparison game: when at least two players join, deal one card per player, display it publicly, award the highest-value player and expose a new-game control after a short delay.

**Files reviewed:** [index.js](../src/games/slaps/index.js).

**Building blocks:** Small lobby presence gate and reusable new-game button.; Existing homegames-core common Deck dependency.; Public card/text composition and delayed rematch availability.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; homegames-core src/common/Deck.js already constructs Card objects and shuffles/draws; it is not currently a Squish export.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.

**Keep local:** Highest-value winner selection, legacy card naming and score display.

**Source evidence:**

- [index.js:36 — initializeCards(](../src/games/slaps/index.js#L36): Uses pre-existing common Deck rather than a local deck implementation.
- [index.js:45 — tick(](../src/games/slaps/index.js#L45): Presence/lobby button management.
- [index.js:95 — newGame(](../src/games/slaps/index.js#L95): Deals one card and computes a highest-card winner.

**Qualifications:** Despite the name, there is no real-time slap mechanic. Common Deck was read: its 100-pass random-swap shuffle is not the unbiased Fisher-Yates contract to standardize.

## snap-judgment

Three-to-eight-player photo scavenger party game: rotate a judge, give other players a timed upload prompt, shuffle anonymous submissions, judge each photo with thumbs up/down, award submission/approval points, reveal authors and totals.

**Files reviewed:** [index.js](../src/games/snap-judgment/index.js).

**Building blocks:** Wall-clock shooting deadline and role-scoped uploader/judge controls.; Byte-header image dimensions and aspect-correct contain layout.; Round-owned runtime assets; detach image nodes before releasing referenced keys.; Stable photo slots/progress dots and per-round anonymous shot order.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Asset and GameNode.Asset already provide resource references; uploaded asset publication remains the platform-injected addAsset/getAssets capability.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; image-layout: byte dimension parser + aspect-aware contain geometry shared with Draw.; asset-lifetime: scoped registrations with detach-before-release and stale-completion checks.

**Keep local:** Photo prompts, judge rotation, anonymous submission order, approval points and disconnect role transfer.

**Source evidence:**

- [index.js:194 — const readImageSize](../src/games/snap-judgment/index.js#L194): Separate PNG/GIF/JPEG byte-header parser.
- [index.js:241 — const fitBox](../src/games/snap-judgment/index.js#L241): Fits physical image aspect into game-coordinate box.
- [index.js:594 — detachPhotos(](../src/games/snap-judgment/index.js#L594): Unlinks asset references before removal from asset map.
- [index.js:763 — judgePhoto(](../src/games/snap-judgment/index.js#L763): Judges each picture rather than selecting a single favorite.
- [index.js:807 — handleUpload(](../src/games/snap-judgment/index.js#L807): Publishes assets asynchronously then updates current shots.
- [index.js:867 — showPhoto(](../src/games/snap-judgment/index.js#L867): Never attaches an Asset node with an empty asset map.

**Qualifications:** The opening description says favorite selection, but executable behavior uses thumbs per photo. Current completion guard tests phase; a reusable scope should additionally bind to round/player generation. Uploaded assets are platform bundles, not protected just because a scene node is private.

## sound-test

Play/pause demo attaches or removes an audio Asset and manually tracks resumed playback time.

**Files reviewed:** [index.js](../src/games/sound-test/index.js).

**Building blocks:** audio voice lifetime; resume timing.

**Existing facilities:** GameNode.Asset startTime; Asset.

**Candidates:** AssetPlayback play/pause/stop with per-player ownership and duration.

**Keep local:** song selection.

**Source evidence:**

- [index.js:43 — this.startTime = this.startTime + diff](../src/games/sound-test/index.js#L43): Tracks pause offset manually.
- [index.js:73 — handlePlayerUpdate](../src/games/sound-test/index.js#L73): Updates asset startTime for later player state.

**Qualifications:** Uses legacy getAssets rather than metadata assets; requires compatibility, not a new backend.

## spades

Four-seat partnership Spades with bots, bids including nil, follow-suit and spades-breaking rules, trick collection, contract/bag/nil scoring, bag penalties and match thresholds.

**Files reviewed:** [index.js](../src/games/spades/index.js), [theme.js](../src/games/spades/theme.js).

**Building blocks:** Private bid controls and two-row hands using shared card theme.; Seat takeover, card sorting and tokenized delayed bot/trick work.; Partnership score state distinct from individual turn state.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** optional-card-kit: common card/button/table presentation and paginated private hands; themed defaults stay optional.; ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; random-utils: injected-RNG Fisher-Yates shuffle and sampling; optional deck descriptors without fixed rank values.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.

**Keep local:** Bidding heuristic, trump rules, nil bookkeeping, partnership contracts, bags and victory thresholds.

**Source evidence:**

- [index.js:41 — createView(](../src/games/spades/index.js#L41): Private bidding and hand controls.
- [index.js:58 — legalIndices(](../src/games/spades/index.js#L58): Follow-suit/trump lead constraints.
- [index.js:60 — playCard(](../src/games/spades/index.js#L60): Turn/trick progression.
- [index.js:61 — finishHand(](../src/games/spades/index.js#L61): Team bid/nil/bag scoring.
- [index.js:67 — scheduleBot(](../src/games/spades/index.js#L67): Token-guarded automation.
- [theme.js:42 — function card(](../src/games/spades/theme.js#L42): Shared presentation helper.

**Qualifications:** 79-line entrypoint is densely formatted and fully implemented; brevity is not evidence of a stub.

## sponge

Sink-themed Pong supports solo control of both paddles or one side each, bouncing a skinned ball and updating scores/audio.

**Files reviewed:** [index.js](../src/games/sponge/index.js).

**Building blocks:** paddle control; bounded ball paths; asset transform sync.

**Existing facilities:** Physics.getPath; GeometryUtils.checkCollisions; Asset nodes.

**Candidates:** Simulation-owned motion instead of chained raw intervals; Asset bounds setter; Audio voice handle.

**Keep local:** Pong scoring and serving rules.

**Source evidence:**

- [index.js:365 — moveBall(path)](../src/games/sponge/index.js#L365): Raw10ms interval walks a generated path and recursively replaces it on bounce.
- [index.js:300 — updateBallPosition](../src/games/sponge/index.js#L300): Synchronizes shape and separate asset geometry.
- [index.js:338 — playSound(dir)](../src/games/sponge/index.js#L338): Temporary sound cleanup references mutable this.sound.

**Qualifications:** Existing Physics.getPath is already used; replace ergonomics only after validating semantics. Raw intervals and mutable sound cleanup can outlive the intended object; not a safe implementation to lift directly.

## sprite-test

Players occupy dancer spots and alternate idle/directional image frames when keys or touch regions are pressed.

**Files reviewed:** [index.js](../src/games/sprite-test/index.js).

**Building blocks:** sprite state animation; input cooldown; seat allocation.

**Existing facilities:** GameNode.Asset; Game.setTimeout.

**Candidates:** SpriteClip/frame selector supporting separate assets and atlas crops; PlayerScope allocator.

**Keep local:** dance artwork and mappings.

**Source evidence:**

- [index.js:101 — const newFrame](../src/games/sprite-test/index.js#L101): Manual alternating frame selection.
- [index.js:135 — handlePlayerDisconnect](../src/games/sprite-test/index.js#L135): Removes dancer and attempts spot release.

**Qualifications:** Allocation writes spot.player but disconnect tests spot.playerId; seat cleanup cannot be copied unchanged.

## squarer

Multiplayer lane-crossing game: squares step upward through wrapping moving hazards to a destination; reaching it raises hazard density and resets players.

**Files reviewed:** [index.js](../src/games/squarer/index.js).

**Building blocks:** grid-step movement; cooldowns; round reset.

**Existing facilities:** Game timers; ShapeUtils.rectangle.

**Candidates:** InputState and simulation scheduler; Grid coordinate helpers.

**Keep local:** hazard patterns, level progression and destination rules.

**Source evidence:**

- [index.js:58 — createNpc()](../src/games/squarer/index.js#L58): Per-hazard intervals enqueue discrete movement.
- [index.js:229 — checkForCollisions(node](../src/games/squarer/index.js#L229): Game-specific exact cell equality, not geometric intersection.

**Qualifications:** Disconnect searches playerId but allocation writes controllerID; close overrides superclass cleanup. Do not lift exact-cell collision as a generic rectangle collision test.

## star-sweeper

Six-player 90-second orb race across a 300×300 world, with ship inertia, asteroid knockback, dropped pickups, private following cameras and shared minimap.

**Files reviewed:** [index.js](../src/games/star-sweeper/index.js).

**Building blocks:** camera follow/clamp; world-to-view projection; particle culling; minimap.

**Existing facilities:** ViewableGame; ViewUtils.getView; playerIds.

**Candidates:** Incremental Camera2D using existing getView semantics; Polygon transform; InputState.

**Keep local:** orb race, asteroid penalty and match rules.

**Source evidence:**

- [index.js:395 — updateCameras()](../src/games/star-sweeper/index.js#L395): Clamps camera per ship then rebuilds projected view each tick.
- [index.js:594 — roughRockTranslate(asteroid)](../src/games/star-sweeper/index.js#L594): Caches local polygon shape and translates it.
- [index.js:488 — updateShips()](../src/games/star-sweeper/index.js#L488): Simulation stays in world coordinates; view rendering is separate.

**Qualifications:** Full world exists on authoritative plane, but only per-player view roots are exposed; preserve that boundary.

## starfall-salvage

Single-player space adventure with a modular ship, six sectors, boardable interiors, recruitable crew, combat/mining, contracts and mission choices. World and boarding contexts preserve host enemy/loot state while swapping camera scale and movement/collision rules. Explicit schema-aware saves validate content IDs and reachable positions, reset transient attacks and reconstruct progression.

**Files reviewed:** [audio.js](../src/games/starfall-salvage/audio.js), [content.js](../src/games/starfall-salvage/content.js), [engine.js](../src/games/starfall-salvage/engine.js), [index.js](../src/games/starfall-salvage/index.js), [scene.js](../src/games/starfall-salvage/scene.js).

**Building blocks:** Orthographic camera/inverse and host culling; Bounded active-only painter; Swept projectile and substepped actor movement; Context-specific persistent domain snapshots; Procedural effects and drift/danger music.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Camera2D/Geometry2D; SceneWriter active pools; PCM/audio lifecycle; SaveCoordinator without domain serialization.

**Keep local:** Ship modules, crew bonuses, missions/dialogue, room collision semantics, sector/interior content and checkpoint validation.

**Source evidence:**

- [scene.js:21 — class Painter](../src/games/starfall-salvage/scene.js#L21): Lazy clipped pool emits only used nodes.
- [scene.js:161 — class SalvageScene](../src/games/starfall-salvage/scene.js#L161): Orthographic scale changes between ship space and boarding interiors.
- [engine.js:93 — cacheContext()](../src/games/starfall-salvage/engine.js#L93): Contexts are host data; camera switching does not transmit world state.
- [engine.js:633 — serialize()](../src/games/starfall-salvage/engine.js#L633): Snapshots explicit state and resets transient enemy attack timing.
- [engine.js:643 — load(](../src/games/starfall-salvage/engine.js#L643): Content/schema/position validation is tightly tied to adventure rules.

**Qualifications:** Large authored ship/portrait/scenery and content tables were sampled; infrastructure and engine lifecycle/save code were examined. Danger music is selected when scheduling a new phrase, not a universal continuous crossfade system. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## starry-sparkles

An open-ended night-sky painting toy: choose colors and launch flower/star/heart bursts anywhere, or light the large stars to complete rotating sky pictures. Each launch uses a bounded rotating burst slot, a travel interval then delayed sound and bloom; completed pictures briefly celebrate before advancing. It redraws only while animation/audio changes require it.

**Files reviewed:** [audio.js](../src/games/starry-sparkles/audio.js), [index.js](../src/games/starry-sparkles/index.js).

**Building blocks:** Round-robin bounded effect slots; Delayed animation event threshold; Pointer edge handling; Composite part transforms and quiet cue voices.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** BoundedPool with explicit replacement policy; Geometry and Transform2D; Timeline event threshold primitives; PCM/AudioVoices.

**Keep local:** Sky picture points, burst shapes, character artwork and celebration progression.

**Source evidence:**

- [index.js:193 — lightStar(](../src/games/starry-sparkles/index.js#L193): Picture completion is separate from freeform burst painting.
- [index.js:212 — launch(](../src/games/starry-sparkles/index.js#L212): Burst slots are reused round-robin and may replace an active burst.
- [index.js:306 — tick()](../src/games/starry-sparkles/index.js#L306): Sound starts at bloom threshold; dirty state is conditional.
- [audio.js:38 — class](../src/games/starry-sparkles/audio.js#L38): Playtime note/celebration audio infrastructure is repeated.

**Qualifications:** Final source includes sky picture progression added during audit; earlier purely freeform description is superseded. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## sundown

Single-player 90-second pseudo-3D sunset racer with a looping segmented road, hills and curves, traffic avoidance, distance scoring and collision time penalties; declared simulation rate is 120 Hz.

**Files reviewed:** [index.js](../src/games/sundown/index.js).

**Building blocks:** Perspective road-segment projection with retained road, palm, car and dust node pools; Exponential steering response, wrapped track distance and time penalties; Aspect-aware geometry and palette interpolation.

**Existing facilities:** Game tick, mutable GameNode shapes/text and shadow effects.

**Candidates:** Retained typed node pools with explicit deactivate/reset semantics; Vector interpolation, exponential damping, positive modulo and color interpolation; Reusable polygon clipping rather than ad hoc vertex clamping.

**Keep local:** Pseudo-3D curved-road projection and handcrafted track profile; Traffic spawning, collision forgiveness and race/time-debt rules.

**Source evidence:**

- [index.js:251 — makePool(n, layer)](../src/games/sundown/index.js#L251): Preallocates road and effect nodes and reuses them throughout the run.
- [index.js:449 — updateDrive()](../src/games/sundown/index.js#L449): Uses exponential steering response and fixed DT independent of render geometry.
- [index.js:589 — projectRoad(shakeX)](../src/games/sundown/index.js#L589): Builds a bounded projected road slice and writes existing nodes far-to-near.

**Qualifications:** The fixed 120-Hz DT assumes scheduled ticks keep pace; this audit does not measure actual runtime throughput. safeTrap/clipX clamp x rather than performing exact clipping; do not lift them as generic polygon clippers.

## sunside

Procedural character studio with wardrobe, pose animation, view controls and a short timing-based volley challenge. Host-side 3D mesh construction, two-bone arm IK, spring motion, camera projection, backface/light/depth processing and clipping produce 2D Squish polygons; no client 3D engine receives the mesh/world. Save data stores look and best score.

**Files reviewed:** [animation.js](../src/games/sunside/animation.js), [character.js](../src/games/sunside/character.js), [geometry.js](../src/games/sunside/geometry.js), [index.js](../src/games/sunside/index.js), [projection.js](../src/games/sunside/projection.js), [settings.js](../src/games/sunside/settings.js), [wardrobe.js](../src/games/sunside/wardrobe.js).

**Building blocks:** Vector3 math/mesh construction; Two-bone IK and pose blending; Perspective projection, backface culling and depth ordering; Bounded retained face nodes; Viewport clipping.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Pure Geometry2D clipping shared with more games; Optional separate experimental geometry3D/math/projection module after another consumer exists.

**Keep local:** Character anatomy, wardrobe meshes, hair/cloth rig, volley timings and score rules.

**Source evidence:**

- [projection.js:6 — function](../src/games/sunside/projection.js#L6): Projects host 3D faces and clips them into the game viewport.
- [animation.js:5 — function solveArm](../src/games/sunside/animation.js#L5): Two-bone IK is reusable math but currently a single-game need.
- [geometry.js:11 — class](../src/games/sunside/geometry.js#L11): Mesh construction is lower-priority than repeated 2D primitives.
- [index.js:248 — renderScene()](../src/games/sunside/index.js#L248): Only projected visible 2D polygons form the outgoing scene.

**Qualifications:** Do not turn this one character renderer into a mandatory Squish 3D runtime. Mesh helpers reference character-specific color/material assumptions; separate pure math before considering reuse. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## sunwake

Cooperative skyship expedition for up to six crew across three beacons and a final boss. Players select helm/gunner/engineer/scout, with empty stations automated; route/refit votes advance the shared ship. Shared isometric world rendering is combined with private role HUDs and per-player sound audience. Optional flag upload and push-to-talk radio use injected host services and explicit cleanup.

**Files reviewed:** [audio.js](../src/games/sunwake/audio.js), [engine.js](../src/games/sunwake/engine.js), [index.js](../src/games/sunwake/index.js), [scene.js](../src/games/sunwake/scene.js), [settings.js](../src/games/sunwake/settings.js).

**Building blocks:** Active clipped isometric painter/camera; Per-player scoped roots and input records; Host role/vote state and sound audience; Generated cue voice lifecycle; Optional media/upload service lifecycle.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** SceneWriter/Camera2D; AudienceRoot lifecycle primitive preserving nested restrictions; AudioVoices audience routing; Optional service cleanup/disposable utility.

**Keep local:** Ship role balancing, autopilot, route votes/ties, expedition objectives and radio arbitration UI.

**Source evidence:**

- [index.js:243 — rebuildPeople()](../src/games/sunwake/index.js#L243): Creates per-player role controls under audience-scoped roots.
- [index.js:148 — updateRadio()](../src/games/sunwake/index.js#L148): Stream nodes derive from authorized injected media service state.
- [scene.js:24 — class Painter](../src/games/sunwake/scene.js#L24): Visible active scene only; distant islands/rounds remain host data.
- [engine.js:215 — tick(](../src/games/sunwake/engine.js#L215): Empty stations are automated and role inputs drive a shared ship.
- [index.js:339 — close()](../src/games/sunwake/index.js#L339): Unsubscribes media change and stops crew streams.

**Qualifications:** Save data is logbook/renown/name/kit progression, not an active-voyage resume snapshot. No generic universal pause or owner-lock input policy fits this cooperative game. Do not copy media capture logic into Squish or bypass the existing media service. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## testions

Two-player question game alternates whose answer is guessed; both submit private binary answers, then a shared result advances the question.

**Files reviewed:** [index.js](../src/games/testions/index.js).

**Building blocks:** private choices; turn phase; file-loaded question data.

**Existing facilities:** playerIds; Shape input file; Asset.getData; Game.setTimeout.

**Candidates:** Choice/button composition; RoundScope and async load guard.

**Keep local:** question schema, answer matching and alternating roles.

**Source evidence:**

- [index.js:67 — initQuestions(url, data)](../src/games/testions/index.js#L67): Loads JSON questions from uploaded bytes or Asset.
- [index.js:123 — newTurn()](../src/games/testions/index.js#L123): Builds four private answer cards with repeated logic.
- [index.js:346 — tick()](../src/games/testions/index.js#L346): Waits for two answers and schedules next turn.

**Qualifications:** Hosted question asset remains a dependency. No validation/catch around parsed question data; disconnect signature destructures object unlike most games.

## text-input

Up to four writers share independent typewriter panels with raw-key editing, mobile text input, wrapping, scrolling and blinking caret.

**Files reviewed:** [index.js](../src/games/text-input/index.js).

**Building blocks:** key repeat; text layout; panel allocation.

**Existing facilities:** GameNode.Text; input text descriptor; playerIds marker.

**Candidates:** InputState configurable repeat; Monospace text wrapping and panel layout helpers.

**Keep local:** shared wall policy and900-character limit.

**Source evidence:**

- [index.js:161 — wrapBuffer(buffer](../src/games/text-input/index.js#L161): Manual hard wrapping and visible-tail selection.
- [index.js:225 — handleKeyDown(playerId](../src/games/text-input/index.js#L225): Implements key freshness and repeat deadlines.
- [index.js:96 — rebuildPanels()](../src/games/text-input/index.js#L96): Allocates reusable line nodes for each writer.

**Qualifications:** Raw keystrokes and mobile committed text have different semantics; avoid conflating with browser-native editor/IME.

## the-argument

Three-to-eight-player social decision narrative across 11 authored rounds. Players receive differing private briefs, discuss, spend trust tokens to reveal information, commit choices, and see consequences to shared health/audit meters and final debrief.

**Files reviewed:** [index.js](../src/games/the-argument/index.js), [rounds.js](../src/games/the-argument/rounds.js).

**Building blocks:** Brief/discuss/commit/resolve/reveal phase clock with trust pauses.; Private briefing roots and recursive audience assignment.; Round-specific strategy functions assembled in rounds.js, not merely text data.; Eligibility/commit collection, timeout defaults and shared outcome history.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.; resource-scope: phase-owned overlays and callbacks should not overwrite the active phase clock.

**Keep local:** Narrative, asymmetric information, rounds.js procedural resolvers, trust-token rules and health/audit outcomes.

**Source evidence:**

- [index.js:138 — setNodePlayerIds(](../src/games/the-argument/index.js#L138): Same recursive audience operation as Imposter.
- [index.js:321 — renderPrivateBriefing(](../src/games/the-argument/index.js#L321): Role-specific secret information stays host-scoped.
- [index.js:409 — invokeTrust(](../src/games/the-argument/index.js#L409): Temporarily pauses discussion and changes information visibility.
- [index.js:501 — finishCommit(](../src/games/the-argument/index.js#L501): Game selects majority/officer/default and calls round resolution.
- [index.js:590 — advancePhase(](../src/games/the-argument/index.js#L590): Explicit phase lifecycle.

**Qualifications:** rounds.js fully reviewed: it contains executable round builders/resolution logic and must stay game-local. Transient flash timing currently shares phaseTicks; do not enshrine that coupling in a core state machine.

## tic-tac-toe

Two-seat tic-tac-toe with human/bot replacement, numbered keyboard input, perfect-style minimax O play plus fallback when the other human leaves, animated marks, score tracking and rematches.

**Files reviewed:** [index.js](../src/games/tic-tac-toe/index.js).

**Building blocks:** Nine-cell model, turn ownership and outcome calculation.; Held-key suppression, seats and delayed bots.; Text mark animation and repeated button/text scaffolding.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; seat-roster: explicit replacement events and player labels.

**Keep local:** Winning lines, minimax/fallback choices and match score policy.

**Source evidence:**

- [index.js:113 — handleKeyDown(](../src/games/tic-tac-toe/index.js#L113): Tracks key-down state to prevent repeat moves.
- [index.js:212 — animateMark(](../src/games/tic-tac-toe/index.js#L212): Timed text-size animation needs reset cancellation.
- [index.js:253 — minimax(](../src/games/tic-tac-toe/index.js#L253): Small game-specific search.
- [index.js:279 — scheduleBotIfNeeded(](../src/games/tic-tac-toe/index.js#L279): Reusable generation/ownership guard pattern.
- [index.js:166 — handlePlayerDisconnect(](../src/games/tic-tac-toe/index.js#L166): Bot replacement is a policy choice.

## tiny-bean-cafe

Pointer-led cafe lets the player choose a drink and perform its pictured preparation steps, then serve a varied customer. Customer/order/wardrobe shuffle bags avoid immediate repetition; fulfilling the favorite gets an enhanced celebration while freeform choices remain possible. Retained cup ingredients, equipment, customer geometry and whipped cream animate in a scaled stage with quiet synthesized Foley.

**Files reviewed:** [audio.js](../src/games/tiny-bean-cafe/audio.js), [cream.js](../src/games/tiny-bean-cafe/cream.js), [customers.js](../src/games/tiny-bean-cafe/customers.js), [index.js](../src/games/tiny-bean-cafe/index.js).

**Building blocks:** Reusable shuffle bag with injectable RNG and boundary repeat avoidance; Affine stage transforms shared by drawings/hits; Timed ingredient preparation and cup layers; Normalized PCM Foley + bounded voices.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** ShuffleBag; Transform2D/Geometry2D and hit regions; PCM encoder/AudioVoices.

**Keep local:** Drink recipes, correct equipment targets, ingredient layering, customer/outfit artwork and cream curves.

**Source evidence:**

- [index.js:229 — shuffled(](../src/games/tiny-bean-cafe/index.js#L229): Fisher–Yates shuffle and previous-item boundary avoidance can be separated.
- [index.js:389 — drawPrep(](../src/games/tiny-bean-cafe/index.js#L389): Ingredient-specific animation belongs with recipes/art.
- [index.js:531 — handleKeyDown()](../src/games/tiny-bean-cafe/index.js#L531): Pointing is intentional; keyboard does not auto-complete preparation.
- [audio.js:29 — function noiseSource](../src/games/tiny-bean-cafe/audio.js#L29): Sound composition is local; shared code is PCM/voice management.

**Qualifications:** The cup layer builder is domain-specific even though its scalar interpolation is generic. Entrypoint is dirty work and was only read. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## tremulous

Classic 1.1-inspired asymmetric aliens-versus-humans FPS on imported ATCS geometry: humans buy weapons and upgrades, aliens evolve and wall-walk, both teams build powered/creep-linked bases and win by eliminating enemy spawns and survivors. A separate authoritative engine drives private first-person Squish scenes, offline-baked original-model sprite atlases, bots and positional event sounds.

**Files reviewed:** [index.js](../src/games/tremulous/index.js), [engine.js](../src/games/tremulous/engine.js), [data.js](../src/games/tremulous/data.js), [world.js](../src/games/tremulous/world.js), [math.js](../src/games/tremulous/math.js), [scene.js](../src/games/tremulous/scene.js), [render.js](../src/games/tremulous/render.js), [hud.js](../src/games/tremulous/hud.js), [media.js](../src/games/tremulous/media.js), [map-data.js](../src/games/tremulous/map-data.js), [map/faces-0.js](../src/games/tremulous/map/faces-0.js), [map/faces-1.js](../src/games/tremulous/map/faces-1.js), [map/brushes-0.js](../src/games/tremulous/map/brushes-0.js), [map/nav-0.js](../src/games/tremulous/map/nav-0.js).

**Building blocks:** Oriented camera basis, near/frustum polygon clipping and perspective projection; Convex-brush swept traces, broad-phase spatial grid, grounded slide/step/wall movement; BSP leaf/PVS visibility plus projected coverage/depth ordering and partial sprite occlusion; Retained keyed scene with separate active output and bounded inactive cache; Directional/pose/roll sprite atlas sampling and crop composition; Fixed simulation substeps, bounded transient/event lists and private sound-node lifetimes.

**Existing facilities:** Game lifecycle and per-player GameNode audience roots; Shape/Text/Asset nodes, normalized polygon coordinates and existing asset cropping; Existing injected cursor and pointer-lock/input protocol; no game DOM or custom client renderer; Existing Asset project paths and core local/portable media transport.

**Candidates:** General keyed SceneBuilder facade over existing GameNodes: begin/end, kind changes, stable IDs, clipping, active node/cache limits and overflow reporting; Pure clipPolygon/clipAgainstPlane and small vector math; separate general math from class-specific body dimensions; SpriteAtlas.frame with pixel rectangles, frame dimensions, optional anchor/world-size metadata and explicit percentage-crop conversion; Private one-shot audio handles with known duration, concurrency budget and lifecycle cancellation; A separate later convex trace API may be useful if another brush-based game needs it; do not equate it with the smaller grid-DDA proposal.

**Keep local:** Class/evolution/weapon/building/armour balance and asymmetric economy; ATCS BSP/PVS/nav format, map importer and offline media provenance/conversion; Wall-walk locomotion, Quake movement feel, bots, base power/creep/spawn and win rules; Perspective depth ordering/occlusion policy and dynamic world coverage budget until another game establishes a stable common contract.

**Source evidence:**

- [scene.js:39 — class Scene {](../src/games/tremulous/scene.js#L39): GameNode reuse separates cached objects from this frame’s private transmitted children.
- [scene.js:81 — image(key, asset,](../src/games/tremulous/scene.js#L81): Composes source atlas crops with viewport clipping.
- [world.js:37 — trace(start,end,](../src/games/tremulous/world.js#L37): Swept support-function trace against convex brush planes with a spatial broad phase.
- [world.js:70 — visibleFaces(point)](../src/games/tremulous/world.js#L70): BSP leaf/PVS narrows the host-side world before projection.
- [world.js:77 — moveActor(a,dt,opts={})](../src/games/tremulous/world.js#L77): Game-local grounded/sliding/step/wall-walk movement built on traces.
- [render.js:16 — function cameraFor(](../src/games/tremulous/render.js#L16): Camera transforms include orientation and wall/ceiling roll.
- [render.js:396 — function renderPlayer(](../src/games/tremulous/render.js#L396): PVS, frustum and coverage selection produce only the player’s first-person scene; static projection is cached by camera signature.
- [render.js:308 — function spriteRegions(](../src/games/tremulous/render.js#L308): Partial wall occlusion becomes bounded cropped sprite regions.
- [media.js:1482 — function spriteFrame(](../src/games/tremulous/media.js#L1482): Baked 8-direction actor frames and cardinal roll are selected as pixel atlas rectangles.
- [index.js:204 — sound(id,key,duration=1)](../src/games/tremulous/index.js#L204): Fresh private sound nodes honor media duration and a per-player concurrency cap.
- [engine.js:556 — step(dt) {](../src/games/tremulous/engine.js#L556): Authoritative time advances with finite, bounded 1/60 substeps.

**Qualifications:** Source audit only: generated map arrays were inspected by schema and counts, not read as authored gameplay. Current draw data contains 5,101 faces; collision brushes, BSP/PVS and navigation remain separate. Eight azimuths, four actor poses and four cardinal sprite rolls approximate original models; this is not a full original 3D renderer. Renderer expands its world frame limit to preserve visible wall coverage; maxNodes is not a universal hard transmitted-node guarantee. Extraction must preserve private per-player output and never attach authoritative world/model source to broadcast layers. Game code and original adapted media carry their own GPL/CC notices; review source provenance before copying implementation into differently licensed Squish code.

## tug-club

One-to-six-player cooperative space salvage: latch ships onto weighted cargo, share spring-like tow forces, dodge orbiting hazards and power a home before a three-minute storm; saves compact win records.

**Files reviewed:** [index.js](../src/games/tug-club/index.js).

**Building blocks:** Normalized steering with acceleration, damping, bounded movement and rope tension; Preallocated forty-particle pool and retained compound ship geometry; Personal HUD/input, seeded scenery and schema-checked saves.

**Existing facilities:** GameNode polygon/text groups and private playerIds; Injected saveGame/saveData and Game tick lifecycle.

**Candidates:** Pure vector, polygon-transform and thick-segment helpers; Bounded particle pool with explicit hidden/active lifetime; InputState for held keys, freshness and source changes.

**Keep local:** Spring constants, latch ownership, assisted-delivery credit and final heart haul; Home-building progression, hazard orbits and save schema.

**Source evidence:**

- [index.js:353 — physics(dt)](../src/games/tug-club/index.js#L353): Integrates normalized steering, cargo spring forces and hazard contacts in ordered passes.
- [index.js:481 — burst(x, y](../src/games/tug-club/index.js#L481): Allocates effects from a fixed pool, providing a bounded reference implementation.
- [index.js:500 — finish(won)](../src/games/tug-club/index.js#L500): Saves schema-checked records through the injected host callback, without storing scene nodes.

**Qualifications:** Uses local key freshness expiry; a shared input helper must preserve held-state and release semantics rather than assuming browser key repeat.

## tumble-tower

Toy stacking lets the player choose block shape and one of three lanes, build up to eight stable blocks, then roll a ball to release them into a tumble. Host 120 Hz oriented-box contact/impulse simulation handles friction, rotation, impacts and sleep; deliberate build-time snapping and launch nudges provide a forgiving toy feel. Settled blocks can be tapped before restarting.

**Snapshot qualification:** This entry describes the source reviewed at 2026-10-11T16:55:03.259819+00:00. Concurrent work changed `index.js`, `physics.js` afterward. Behavior and line numbers below refer to that reviewed snapshot; changed-file links intentionally omit line anchors. Recheck these files before extraction.

**Files reviewed:** [audio.js](../src/games/tumble-tower/audio.js), [index.js](../src/games/tumble-tower/index.js), [physics.js](../src/games/tumble-tower/physics.js), [structures.js](../src/games/tumble-tower/structures.js).

**Building blocks:** SAT oriented-box and circle contact manifolds with warm-started impulse/friction solver; Fixed substep accumulator and sleep tracking; Local draw/hit transforms; Impact magnitude audio throttling.

**Existing facilities:** Game/GameNode and ShapeUtils.rectangle already exist.; GeometryUtils.checkCollisions is axis-aligned scene collision; Physics.getPath samples a straight trajectory, not OBB impulses or rigid bodies.

**Candidates:** Pure collision2D SAT/contact utilities as a second-stage extraction; FixedStepper; Transform2D and PCM/AudioVoices.

**Keep local:** Three-lane placement, block palette, stable build snapping, fan-out impulses, toy walls/gravity and impact timbre.

**Source evidence:**

- [physics.js:105 — function contact](../src/games/tumble-tower/physics.js): Actual OBB contact is beyond existing Squish AABB collision helper.
- [physics.js:179 — substep(](../src/games/tumble-tower/physics.js): Warm-started coupled face contacts, friction/angular impulse and contact-graph waking form a specialized solver.
- [structures.js:39 — function presetBlocks](../src/games/tumble-tower/structures.js#L39): New pure layout descriptors for tower/bridge/dominoes; not imported by the adapter at this snapshot.
- [index.js:79 — placement(](../src/games/tumble-tower/index.js): Lane/shape support placement is game-specific.
- [index.js:104 — beginTumble()](../src/games/tumble-tower/index.js): Artificial toy-friendly fan-out forces must stay explicit.
- [index.js:199 — tick()](../src/games/tumble-tower/index.js): Build mode snaps bodies to stable placement before release.

**Qualifications:** Final snapshot includes shape/lane selection. Newly added structures.js defines tower/bridge/domino presets and proportion-preserving thumbnails but index.js does not import it yet; do not claim those presets are already playable. physics.js changed concurrently: it now supports circles, clipped box face contact manifolds, warm starts, paired contact constraints, contact-graph wake, impulse and explosion APIs; adapter still performs build-time snapping and scripted release. Squish Physics.getPath is not a replacement for this rigid-body solver. Do not migrate the whole ToyWorld as generic physics without broader validation. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## vector-siege

Single-player generated-sector RTS with optional direct twin-stick intervention, plus an arena/capture campaign mode. War keeps twelve persistent battlefield objects stepping on the host whether viewed or not; fleets transfer unit state and the hero enters/leaves the same battle. Painter and input adapter expose only the selected map/battle scene; saved preferences/best score do not persist the War simulation.

**Files reviewed:** [combat.js](../src/games/vector-siege/combat.js), [engine.js](../src/games/vector-siege/engine.js), [index.js](../src/games/vector-siege/index.js), [scene.js](../src/games/vector-siege/scene.js), [settings.js](../src/games/vector-siege/settings.js), [sound.js](../src/games/vector-siege/sound.js), [war-battle.js](../src/games/vector-siege/war-battle.js), [war-scene.js](../src/games/vector-siege/war-scene.js), [war-settings.js](../src/games/vector-siege/war-settings.js), [war.js](../src/games/vector-siege/war.js).

**Building blocks:** Deterministic RNG split from effects; Bounded combat pools and swept collision; Live host world with selected-view rendering; Graph BFS routes; Phase-sized retained painter; Cue voice pool and stale-key handling.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** Pure segmentDistance/segmentHit and bounded pools; SceneWriter primitives; Random/Shuffle utilities with algorithm preservation; Optional graph shortestPath helper if cross-game evidence exists; PCM/AudioVoices.

**Keep local:** Faction/unit economy, campaign/war transitions, combat abilities, contracts, hero/pilot state transfer and strategy AI.

**Source evidence:**

- [war.js:49 — path(](../src/games/vector-siege/war.js#L49): Small faction-filtered BFS is separable; ownership traversal policy is local.
- [war.js:192 — step(](../src/games/vector-siege/war.js#L192): All battlefield states continue on host while only the current view is drawn.
- [war-battle.js:176 — step(](../src/games/vector-siege/war-battle.js#L176): Already-fired pilot projectiles continue offscreen; simulation cannot be tied to visible nodes.
- [index.js:227 — persist()](../src/games/vector-siege/index.js#L227): Only schema/best/sound/reduced are saved.
- [combat.js:14 — class CombatSystems](../src/games/vector-siege/combat.js#L14): Despite its reusable label this depends deeply on upgrades, weapons, mission and engine fields.

**Qualifications:** Persistent battle means in-session continuity, not checkpoint persistence. Painter keeps unused nodes attached/hidden and clamps vertices; changing to active-only output needs measured compatibility. Engine/WarBattle inheritance is game-local reuse, not evidence for a general Squish RTS engine. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## vegas-trail

Cooperative Tucson-to-Vegas survival journey with shared food/ammo/scrap/vehicle/health resources. Players switch visible map/shop, driving, hunting, illness-fighting and conversation views while all subgames continue simulating on the host; landmarks change zones and reaching Vegas triggers victory.

**Files reviewed:** [index.js](../src/games/vegas-trail/index.js), [minigames/drive.js](../src/games/vegas-trail/minigames/drive.js), [minigames/fight.js](../src/games/vegas-trail/minigames/fight.js), [minigames/hunt.js](../src/games/vegas-trail/minigames/hunt.js), [minigames/index.js](../src/games/vegas-trail/minigames/index.js), [minigames/map.js](../src/games/vegas-trail/minigames/map.js), [minigames/talk.js](../src/games/vegas-trail/minigames/talk.js), [talk-options.js](../src/games/vegas-trail/talk-options.js), [weapons.js](../src/games/vegas-trail/weapons.js).

**Building blocks:** Main-game coordination of five authored subgame objects with roots and tick methods.; Per-player visible-root switching; shared simulation remains active while hidden.; Asset sprites repeatedly synchronize visual position, collision geometry and animation frames.; Physics.getPath consumers, GeometryUtils collisions, expiring damage text, shop/landmark modals and audio nodes.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; Asset and GameNode.Asset already provide resource references; uploaded asset publication remains the platform-injected addAsset/getAssets capability.; Physics.getPath is already heavily reused by driving/hunting/shop flight; do not propose it as new.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.; asset-transform: explicit position/size/frame helpers with independently configurable hit box.; scene-coordination: optional root registry with explicit visibility and simulation policies, not automatic pause-on-hide.

**Keep local:** Survival resources, geographic path/landmarks, shop stock/prices, weapon/enemy definitions, dialogue and zone progression.

**Source evidence:**

- [index.js:1069 — setCurrentGame(](../src/games/vegas-trail/index.js#L1069): Only changes player-visible roots, not simulation ownership.
- [index.js:1383 — tick()](../src/games/vegas-trail/index.js#L1383): Continues map, drive, hunt, fight and talk ticks together.
- [minigames/hunt.js:915 — shoot(](../src/games/vegas-trail/minigames/hunt.js#L915): Existing path helper plus shot ownership/ammo.
- [minigames/hunt.js:1063 — renderHit(](../src/games/vegas-trail/minigames/hunt.js#L1063): Generic expiring combat text.
- [minigames/drive.js:110 — tick(](../src/games/vegas-trail/minigames/drive.js#L110): Repeated sprite transform/frame and collision bookkeeping.
- [minigames/map.js:628 — callShop(](../src/games/vegas-trail/minigames/map.js#L628): Animated shop arrival and per-player shop audience.
- [minigames/talk.js:84 — update()](../src/games/vegas-trail/minigames/talk.js#L84): Data-driven dialogue display; attached resource data is not applied here.

**Qualifications:** All five minigames and index/weapons/talk-options support modules were read, including long leg/enemy factories. Legacy code includes sentinel player 254 hiding, incomplete disconnect cleanup and ignored tuning/data fields; extraction should preserve museum code and derive an explicit new contract.

## view-test

Each player pans a private 100×100 view over a 200×200 world containing colored clickable rectangles.

**Files reviewed:** [index.js](../src/games/view-test/index.js).

**Building blocks:** world/view separation; private camera; viewport replacement.

**Existing facilities:** ViewableGame; ViewUtils.getView.

**Candidates:** Incremental Camera2D view synchronization extending existing ViewUtils.

**Keep local:** demo world.

**Source evidence:**

- [index.js:76 — ViewUtils.getView(this.getPlane(), newView](../src/games/view-test/index.js#L76): Existing camera projection is rebuilt after each key move.
- [index.js:111 — playerIds: [playerId]](../src/games/view-test/index.js#L111): Player root is private.

**Qualifications:** Key inclusion uses indexOf>=-1, admitting every key; movement still branches on WASD. Core common ExpiringSet already exists; do not present cooldown concept as absent everywhere.

## walkie-talkie

Six-seat push-to-talk podium: first holder becomes the shared audio/video broadcaster, with private microphone controls and explicit permission requests.

**Files reviewed:** [index.js](../src/games/walkie-talkie/index.js).

**Building blocks:** input ownership arbitration; media subscription cleanup; private controls.

**Existing facilities:** Native GameNode.Stream in Squish 1.4.6; Shape click/release; playerIds.

**Candidates:** PlayerScope/disposable subscription helper; InputState source-aware holds.

**Keep local:** podium exclusivity and request policy.

**Source evidence:**

- [index.js:47 — async enable](../src/games/walkie-talkie/index.js#L47): Requests media through injected host service.
- [index.js:71 — talk(id, input](../src/games/walkie-talkie/index.js#L71): Arbitrates first holder; tracks keyboard/pointer separately.
- [index.js:123 — this.podiumNode = new GameNode.Stream](../src/games/walkie-talkie/index.js#L123): Renders an existing stream node.

**Qualifications:** Media API belongs to host/client transport; do not duplicate in Squish. Stream is an existing platform extension even though it is not exported directly from the workspace squish index; do not propose it as missing.

## wat

Unfinished shared tower-defense prototype with a fixed waypoint lane, three purchasable tower types, nearest-target firing, pooled particles and wave counters; advertised endless progression is not implemented reliably.

**Files reviewed:** [index.js](../src/games/wat/index.js).

**Building blocks:** Waypoint path following and point-to-segment placement exclusion; Tower range queries and projectile movement; Reusable particle pool sketch.

**Existing facilities:** GameNode scene mutation, polygon/text primitives and click callbacks.

**Candidates:** Tested point-to-segment distance and polyline arc-length sampling; Pure moveTowards/nearest-within-radius queries; Lifecycle-owned effect pool; extract semantics rather than this defective implementation.

**Keep local:** Tower balance, shared gold and placement economy; Wave progression and target-selection policy.

**Source evidence:**

- [index.js:402 — _distToSeg(px](../src/games/wat/index.js#L402): Placement needs a true clamped segment projection; this implementation uses endpoint-to-query vectors incorrectly.
- [index.js:612 — const dx = p.tx - p.x, dy = p.y - p.y](../src/games/wat/index.js#L612): Projectile y velocity is always zero, a concrete reason not to promote the implementation.
- [index.js:693 — _removeEnemy(e) {](../src/games/wat/index.js#L693): Removes a node without marking the enemy dead; tick also stops permanently in between phase.

**Qualifications:** Prototype defects include incorrect path-segment accounting, missing alive=false on removal, absent between-wave transition, particle advancement only when spawning, and shared placement selection across players.

## word-match

Desktop test/demo word-association game: choose two responders, show each a random word and private keyboard-entry field, wait until ready, reveal answers after a countdown, award group points for matching answers or an all-player close-enough vote.

**Files reviewed:** [index.js](../src/games/word-match/index.js).

**Building blocks:** Per-player text focus, keyboard cooldown and readiness collection.; Random word source, timed reveal and shared vote controls.; Private input nodes alongside shared score/result state.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; homegames-core common/util/dictionary is an existing shared word source, not a Squish gameplay primitive.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; audience-views: persistent private roots/anchors, safe empty-audience semantics and caller authorization guards.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; barrier-ballot: eligibility snapshots and responses with explicit replace/lock, disconnect and timeout policies; caller resolves outcomes.; deadline-clock: explicit tick-time or wall-time deadline with remaining/expired/pause semantics, driven by caller clock.

**Keep local:** Word-association rules, responder selection, dictionary content and close-enough voting outcome.

**Source evidence:**

- [index.js:52 — tick()](../src/games/word-match/index.js#L52): Readiness barrier and delayed reveal.
- [index.js:106 — finishRound(](../src/games/word-match/index.js#L106): Advances selected responder indices.
- [index.js:127 — showResults(](../src/games/word-match/index.js#L127): Exact/close-enough scoring and voting UI.
- [index.js:282 — newGame()](../src/games/word-match/index.js#L282): Builds private fields for two selected responders.
- [index.js:394 — handleKeyDown(](../src/games/word-match/index.js#L394): Manual text input and 250ms cooldown.

**Qualifications:** metadata isTest marks this as a test experience. Readiness is initialized for every connected player although only two get input fields; responder advancement/disconnect cleanup also deserves repair before using it as an example template.

## wordforge

Explicit cooperative platformer demo: players type words that materialize temporary platforms, with special wall/ramp/boost/step shapes, move/jump upward above a rising flood, die in flood or win at the top; phone presets and pooled effects are included.

**Files reviewed:** [index.js](../src/games/wordforge/index.js).

**Building blocks:** Per-player typing/movement key state with repeat and stale-key expiry.; Local rectangle/ramp movement integration and collision.; 28 reusable expiring platform slots and 36 pooled sparks.; Tick-driven grace period/flood/round state and mobile button impulses.

**Existing facilities:** Game, GameNode.Shape/Text, ShapeUtils.rectangle, node children and explicit state-change notifications already provide scene construction.; BaseNode.showFor/hideFor and playerIds already scope visible scene nodes; build safer explicit public/private/none helpers on that contract.; ShapeUtils currently provides rectangle/triangle; GeometryUtils already has collision and geometric helpers. Add narrow missing geometry rather than duplicate a collision engine.; Game.setTimeout/setInterval and close already own game-lifetime timers; missing capability is cancellable round/player scopes, not another timer scheduler.

**Candidates:** ui-primitives: optional container/text/button helpers with setters, independent audience/visibility/enabled state and explicit press policy.; input-policy: per-player edge/hold/repeat tracking that consumes normalized platform input and clears on disconnect.; timeline-effects: cancellable tweens or bounded TTL effects driven by the existing game tick/clock.; lifecycle-scope: cancel delayed callbacks and stale async completions on round reset, player departure, scene disposal or game close.; pooled-transients: optional fixed-capacity slots with activation/expiry callbacks and explicit overflow behavior.

**Keep local:** Word-to-platform semantics, special shapes, custom ramp collision, flood tuning and win/loss rules.

**Source evidence:**

- [index.js:402 — handleKeyDown(](../src/games/wordforge/index.js#L402): Mixed typing/movement policies with per-key repeat state.
- [index.js:495 — forgeWord(](../src/games/wordforge/index.js#L495): Creates local game-specific geometry from a word.
- [index.js:637 — deactivatePlatform(](../src/games/wordforge/index.js#L637): Recycles expiring platform nodes.
- [index.js:803 — integratePlayer(](../src/games/wordforge/index.js#L803): Local platform/ramp controller; not enough evidence alone for a universal physics engine.
- [index.js:926 — tickSparks(](../src/games/wordforge/index.js#L926): Bounded reusable visual-effect slots.

**Qualifications:** Explicit demo metadata and shared first-alive input HUD. No dictionary validation is implemented; movement letters are reserved, so this is not a general text-input reference implementation.

## world-eater

Persistent cooperative campaign for up to six drones escorting a living ark across five sectors. Pilots fight, harvest or rescue worlds and grow upgrades; the ark follows crew centroid while tether limits keep drones nearby. Host world state/checkpoints remain separate from a clipped bounded scene with offscreen culling and private pilot HUDs. Audio adds prioritized voice stealing and phrase-based atmosphere.

**Files reviewed:** [audio.js](../src/games/world-eater/audio.js), [engine.js](../src/games/world-eater/engine.js), [index.js](../src/games/world-eater/index.js), [painter.js](../src/games/world-eater/painter.js), [scene.js](../src/games/world-eater/scene.js), [settings.js](../src/games/world-eater/settings.js), [ui.js](../src/games/world-eater/ui.js).

**Building blocks:** Camera/inverse transform with map alternate view; Finite/vertex/capacity-limited active scene writer; Per-player inputs and audience HUD roots; Swept shot collision and bounded substeps; Validated checkpoints excluding session drones/transient shots; Prioritized audio voices and buffer ownership.

**Existing facilities:** Game lifecycle and GameNode.Shape/Text are existing foundations; extraction should use them.; ShapeUtils.rectangle/triangle exist; ellipse, affine transforms, real polygon clipping and bounded scene writers do not.

**Candidates:** SceneWriter with explicit clipping/vertex limits and diagnostics; Camera2D; Input state consumers and scoped roots; Geometry2D segment distance; AudioVoices with priority policies and PCM encoder; SaveCoordinator.

**Keep local:** Harvest/rescue consequences, ark centroid/tether behavior, roles/upgrades, boss patterns and campaign validation.

**Source evidence:**

- [painter.js:40 — class Painter](../src/games/world-eater/painter.js#L40): Active draw order plus finite/vertex bounds and split arcs protect transport limits.
- [scene.js:487 — function renderWorld](../src/games/world-eater/scene.js#L487): Culls before acquiring nodes and reserves budget for core/crew.
- [engine.js:503 — checkpoint()](../src/games/world-eater/engine.js#L503): Only explicit domain checkpoint fields; joining drones and hostile transients are omitted.
- [engine.js:511 — validateCheckpoint(](../src/games/world-eater/engine.js#L511): Validates content consistency, derived hull stats and unique IDs.
- [audio.js:165 — register(addAsset)](../src/games/world-eater/audio.js#L165): Copies bytes for registration to tolerate transferred audio decode buffers.

**Qualifications:** Current renderer uses node ID plus asset key for audio identity; legacy duplicate-key/gap patterns are not proof of a current global-key limitation. Painter vertex budget should become protocol-aware, not permanently copy a hardcoded 49-vertex assumption. Camera is shared around the ark; private HUDs do not imply per-player cameras. Source audit of the current mutable working tree; no browser playtest or gameplay test was performed. Authored lifecycle/support logic was inspected; long illustrative drawing and content tables were sampled where they do not change infrastructure semantics.

## zap-tap

Shared 4×3 reaction grid lights random tiles; first valid tap scores, difficulty speeds up over 45 seconds, then six-second winner intermission.

**Files reviewed:** [index.js](../src/games/zap-tap/index.js).

**Building blocks:** round phases; deadline scheduler; scoreboard; grid layout.

**Existing facilities:** Shape callbacks/effects; Text nodes; playerIds on self marker.

**Candidates:** TickClock/deadlines; Keyed scoreboard rows; Grid layout.

**Keep local:** spawn curve, scoring and45-second rules.

**Source evidence:**

- [index.js:111 — handleTileTap(playerId](../src/games/zap-tap/index.js#L111): Atomic active-state check prevents double scoring.
- [index.js:200 — tick()](../src/games/zap-tap/index.js#L200): Tick deadlines control spawn, expiry, flash and intermission.
- [index.js:125 — renderScoreboard()](../src/games/zap-tap/index.js#L125): Rebuilds all scoreboard nodes after score change.
