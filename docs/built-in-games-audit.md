# Built-in games audit

Audit date: 2026-09-19. Scope: the current working tree of `homegames-core`, including untracked game folders.

**Recommendation: retain 44 entries as games or intentional creative toys, improve five, move eight out of the default catalog into tests/showcases, and temporarily hide three unfinished games.** This would leave 49 default entries, with the five improvement candidates still available. No game code or classification flags were changed by this audit.

There are **80 top-level game entry points: 60 currently visible by metadata and 20 already marked `isTest: true`**. The nested `vegas-trail/minigames/index.js` is a helper export, not another game. These are disk/metadata counts, not a successfully refreshed live dashboard count.

The bar is meaningful interaction, a coherent loop or creative purpose, replay/expressive value, and a finished-enough implementation. Code length, polygon count and an elaborate title screen do not establish quality. Small games can pass; a large prototype can fail. “Keep” means worth keeping, not release certification.

## Recommended cuts from the default catalog

The first four are the clearest calls. The next four are editorial recommendations: useful material to retain in a developer/showcase library, with enough of a seed to revisit later.

| Entry | Recommendation and evidence | What would justify returning it |
| --- | --- | --- |
| **Slaps** | Demo. [`newGame()`](../src/games/slaps/index.js#L95) deals one random card per player and immediately announces the highest card. Players do not actually slap, choose, bet or time anything. | Add a real reaction or prediction mechanic and a match structure. |
| **Typewriter** (`text-input`) | Input demo. [`applyKey()`](../src/games/text-input/index.js#L209) edits a buffer; the simulation only blinks cursors. Four shared text panels are useful for exercising input, not a substantial built-in game. | A typing race, collaborative prompt game, or a deliberately useful writing tool. |
| **HalloweenWords** | Prototype. [`addToBag()`](../src/games/halloween-words/index.js#L311) awards every candy immediately and resets the bag to zero. [`dropBag()`](../src/games/halloween-words/index.js#L273) only resets the bag, so spiders currently cost nothing. Constant spawning and an increasing score are almost the entire loop. | Restore a meaningful hazard; add rounds, escalating pressure and a result. |
| **Tower Defense** (`wat`) | Broken prototype. [`_removeEnemy()`](../src/games/wat/index.js#L693) removes a node without marking the enemy dead. [`tick()`](../src/games/wat/index.js#L512) has no transition out of `between`; projectile vertical movement computes `p.y - p.y`. There is no base-health/loss state. | Fix the simulation and deliver an actual sequence of waves, consequences for leaks, loss and restart. |
| **Geom Storm** | Benchmark/showcase. The [opening source comments](../src/games/geom-storm/index.js#L3) explicitly describe a polygon stress test; the game rebuilds its dynamic scene and reports node counts/tick rate. It does have combat, lives and scoring, so this is a catalog-purpose decision, not “no gameplay.” | Commit to a player-facing arcade game with a bounded rendering budget, then judge it against Orbit Breaker/Vector Siege. |
| **Sunside** | Character showcase. [`invoke()`](../src/games/sunside/index.js#L163) is predominantly outfit, pose, camera and lighting interaction. [`hit()`](../src/games/sunside/index.js#L201) adds a short twelve-return timing challenge. The README also calls it a desktop-first prototype. | Develop the rally into a substantive game, or expose a separate creative/showcase category. |
| **Squarer** | Movement/collision prototype with a real game seed. [`createNpc()`](../src/games/squarer/index.js#L58) removes the destination above level nine; there is no corresponding victory/restart interface. Instructions, readable progress and match framing are missing. | Finish the Frogger-like game: onboarding, visible scores, a proper ending and retry. |
| **Hot Potato** | Party prototype. [`createPotato()`](../src/games/hot-potato/index.js#L116) offers immediate random passing; explosion simply starts another cycle. No accumulated results or elimination create a session arc. A departing holder can leave the object assigned to an absent player. | Keep its simplicity, but add round results, a match goal and robust handoff/disconnect behavior. |

## Temporarily hide unfinished games, rather than dismiss their concepts

| Entry | Why it should not ship as-is | Return condition |
| --- | --- | --- |
| **Masterpiece** | Its [only painting asset](../src/games/masterpiece/index.js#L58) is `REPLACE_WITH_PAINTING_ASSET_ID`. The puzzle logic has adjacent sliding, solvable shuffling, peek, victory and replay; missing content undermines the whole picture puzzle. | Supply a real painting or a recognizable procedural fallback, then verify a full solve/replay in the client. |
| **Iron Keep** | [All nine asset IDs](../src/games/iron-keep/index.js#L17) are placeholders, and metadata registers them unconditionally. The promised textures, knights, weapon and sound are not delivered by the checked-in content. Browser appearance/loading was not verified. | Supply assets or deliberate fallbacks and verify startup, combat and rematch. Its substantial FPS logic merits finishing. |
| **Testions** | [`tick()`](../src/games/testions/index.js#L346) starts with two players even while questions are empty. [`handlePlayerDisconnect()`](../src/games/testions/index.js#L419) destructures an object although the platform supplies a scalar ID. `players: 2` also does not enforce the platform's `maxPlayers` limit. | Gate startup on loaded/valid questions, handle load failure, fix departures and enforce two-player participation. |

## Five games worth improving

| Entry | Priority improvement |
| --- | --- |
| **Sponge** | Repair [seat identity](../src/games/sponge/index.js#L212): after player two joins, the left seat is a string, while keyboard events use numeric IDs and strict equality. Move raw animation intervals into lifecycle-managed timers. Add a match target/rematch. The Cabinet already offers a better-framed Pong alternative. |
| **Flick** | Keep its physical interaction and chain shots. Add a timed match or target score plus reset; currently targets respawn indefinitely and scores accumulate. Test phone/desktop ball-mass differences for fairness. Its [scoreboard](../src/games/flick/index.js#L341) exposes device types as part of the presentation. |
| **Aquarium Forever: Bigger Tank** | It has a genuine feed/earn/buy/expand economy, not merely more fish sprites. However, [`exportCheckpoint()`](../src/games/aquarium-forever%205/index.js#L1700) has no game-side save/restore integration; its README explicitly limits persistence to the session. Clarify copy or implement saving, and decide whether it should be the main Aquarium offering. |
| **Doodle Invaders** | Finish the asset identity or adjust the description. Its [placeholder detector](../src/games/doodle-invaders/index.js#L25) intentionally substitutes shapes and silence, so this is not equivalent to Masterpiece's missing essential painting. Keep the waves, bosses and shared-life loop. |
| **VegasTrail** | Preserve the personality and shared resource/minigame structure. There is no game-specific disconnect cleanup for [`playerStates`](../src/games/vegas-trail/index.js#L1299), while [`depleteFood()`](../src/games/vegas-trail/index.js#L1369) charges food by that roster. Prioritize reconnect/departure behavior and a full journey playthrough. |

## Strongest design candidates to feature

- **Party / social:** Defuse, Engine Room, Clicktionary, Fakeout and Imposter. Private information or player-created content gives these a reason to exist on a multiplayer platform.
- **Cooperative action:** Tug Club, Sheep Drive and Raft. Players affect the same world and can create interesting outcomes together.
- **Solo depth:** Orbit Breaker, Vector Siege and Clump. Their mechanics create progression and decisions beyond a single input demonstration.
- **Familiar games:** keep the board/card set. Tic-Tac-Toe and Go Fish are useful complete small games; adding complexity would not inherently improve them.
- **Creative / relaxed:** Draw, Aquarium and City Scanner deserve an intentional toys/creative shelf. Seance also earns its place as a social activity. A conventional win state is not required for these.

These are source-based feature candidates, not a ranking from fresh human multiplayer playtests.

## Complete visible-game disposition

Each of the 60 visible entries appears exactly once below. Links point to the actual source entry, not the marketing description.

| Entry / folder | Verdict | Basis |
| --- | --- | --- |
| [Aquarium](../src/games/aquarium/index.js) | Keep / toy | Feeding, coins, fish/decor purchases and tank care make a coherent cozy toy. A failure state is unnecessary. |
| [Aquarium Forever: Bigger Tank (`aquarium-forever 5`)](../src/games/aquarium-forever%205/index.js) | Improve | Personal feeding rewards, shared purchases and tank expansion add substance. Wire up save/restore before promising persistence; curate alongside the original. |
| [Backgammon](../src/games/backgammon/index.js) | Keep | Dice sequencing, hits, bearing off, doubling and a bot give it real tactical depth. |
| [Battleship](../src/games/battleship/index.js) | Keep | Manual fleet placement, private boards, shot feedback, bot and rematches form a complete recognizable game. |
| [Billiards](../src/games/billiards/index.js) | Keep | Aiming, collisions, group assignment, shot resolution and a bot make this more than a physics example. |
| [Blackjack](../src/games/blackjack/index.js) | Keep | Betting with play chips, hit/stand, doubles, splits and settlement provide a complete card-table loop. |
| [The Cabinet](../src/games/cabinet/index.js) | Keep | Pong inside an emulator still has an actual match, seven-point victory and winner-keeps-the-seat framing. The technical theme serves the game. |
| [Checkers](../src/games/checkers/index.js) | Keep | Mandatory captures, chained jumps, promotion and a search-based bot support repeated competitive play. |
| [Chess](../src/games/chess/index.js) | Keep | Substantial rules implementation, promotion, draw handling and a bot. Keep; this audit does not certify every rules edge case. |
| [City Scanner](../src/games/city-scanner/index.js) | Keep / toy | Neighborhood exploration and responsive fish/cafe/taxi interactions give it an intentional play-space identity. Present it as a toy. |
| [Clicktionary](../src/games/clicktionary/index.js) | Keep | Drawing, private word choices, hints, timed guesses, scoring and role rotation are a strong social loop. |
| [Clump](../src/games/clump/index.js) | Keep | Rolling, size-gated pickups, growth and a timed outcome provide a distinctive progression arc. |
| [Connect Four](../src/games/connect-four/index.js) | Keep | A complete small strategy game with opponent AI, drop feedback and replay; simplicity is appropriate. |
| [Crazy Eights](../src/games/crazy-eights/index.js) | Keep | Private hands, legal plays, wild-suit choices, drawing and bots create a useful family card game. |
| [Defuse](../src/games/defuse/index.js) | Keep | Asymmetric bomb/manual information, procedural modules, time pressure and multiple bombs create meaningful cooperation. |
| [Doodle Invaders](../src/games/doodle-invaders/index.js) | Improve | Waves, bosses and shared lives are real gameplay. All custom asset IDs are placeholders, but explicit shape fallbacks preserve play; finish its advertised identity. |
| [Draw](../src/games/draw/index.js) | Keep / toy | Shared drawing, independent cameras, uploads, zoom and clear voting justify it as a creative tool. |
| [Engine Room](../src/games/engine-room/index.js) | Keep | Orders and controls on different screens create coordination pressure; repairs, hull damage and sectors give it an arc. |
| [Fakeout](../src/games/fakeout/index.js) | Keep | Player-authored lies, voting, merged duplicate answers, timed phases and a six-round result support replay. |
| [Flick](../src/games/flick/index.js) | Improve | Aiming, momentum, collisions and credited chain reactions are worth keeping. Endless respawns and lifetime scores need a match goal/reset or an explicit toy label. |
| [Geom Storm](../src/games/geom-storm/index.js) | Test / showcase | A playable shooter, but explicitly built to stress the renderer, with rebuilt node trees and node/tick counters. Preserve as a benchmark showcase. |
| [Go Fish](../src/games/go-fish/index.js) | Keep | Private hands, rank requests, books, turn management and bots make a full family game despite its compact source. |
| [Grand Finale](../src/games/grand-finale/index.js) | Keep | Cooldown-limited ignition, chain ownership/scoring, a timed show and encore make the fireworks interactive competition. |
| [HalloweenWords](../src/games/halloween-words/index.js) | Test / prototype | Catching candy scores immediately and resets the bag; spiders reset that already-empty bag. No round, loss or escalation gives the action weight. |
| [Hangman](../src/games/hangman/index.js) | Keep | Guessing, rotating turns, round outcomes and custom drawn hangmen offer both a known game and personalization. |
| [Hearts](../src/games/hearts/index.js) | Keep | Passing, legal tricks, scoring and shooting the moon give the table recognizable depth. |
| [Hot Potato](../src/games/hot-potato/index.js) | Test / prototype | Pass instantly to a random person; a random timer chooses a loser, then the loop resets. No elimination/score arc, plus an absent-holder disconnect bug. |
| [Imposter](../src/games/imposter/index.js) | Keep | Secret roles, discussion, voting and the imposter’s final guess create a complete social-deduction round. |
| [Iron Keep](../src/games/iron-keep/index.js) | Hide pending repair | Substantial FPS logic, but all nine image/audio identifiers are REPLACE_* placeholders. Finish assets and verify loading before featuring it. |
| [Kaboom Valley](../src/games/kaboom-valley/index.js) | Keep | Aim/power, wind, destructible terrain, turn order and bot turns create meaningful artillery tactics. |
| [Break Room Keep-Up](../src/games/keep-up/index.js) | Keep | Shared streak, floor penalties, timed rounds and additional balloons turn simple tapping into an escalating cooperative game. |
| [Mancala](../src/games/mancala/index.js) | Keep | Captures, extra turns, endgame collection and bot planning give the familiar rules enough depth. |
| [Masterpiece](../src/games/masterpiece/index.js) | Hide pending repair | A valid sliding puzzle with solvable shuffling, peek and victory/replay, but its only painting asset is a placeholder. |
| [Micro Mayhem](../src/games/micro-mayhem/index.js) | Keep | Five different short challenges, stage scoring and a podium make a coherent party collection. |
| [Neon Grid](../src/games/neon-grid/index.js) | Keep | Light-cycle movement, persistent trails, bots, survival outcomes and successive rounds are a complete competitive loop. |
| [Nova Guard](../src/games/nova-guard/index.js) | Keep | Shared-core defense, shield positioning, escalating waves and periodic bosses give cooperation consequences. |
| [Orbit Breaker](../src/games/orbit-breaker/index.js) | Keep | Directional catches, perfect timing, returned ammunition, dash, upgrades, a boss and flight school form a distinct solo game. |
| [Prism 3D](../src/games/prism-3d/index.js) | Keep | A raycaster with actual laser-tag combat, bots and match outcomes. The rendering technique alone is not a reason to demote it. |
| [Raft](../src/games/raft/index.js) | Keep | Shared steering, bank collisions, duck collection and a round result make a clear cooperative challenge. |
| [Relic Rush](../src/games/relic-rush/index.js) | Keep | Lane changes, jump/duck choices, obstacle failures, coin risk and immediate retries support a compact runner. |
| [Seance](../src/games/seance/index.js) | Keep | Collective influence, letter selection, transcripts and the influence reveal create a social activity even without a conventional winner. |
| [Sheep Drive](../src/games/sheep-drive/index.js) | Keep | Herd behavior, dogs, field obstacles, timed rounds and pen scoring create emergent coordination. |
| [Slaps - Reslapstered](../src/games/slaps/index.js) | Test / demo | The new-game action draws everyone a random card and immediately declares the highest card the winner. There is no decision or timing skill. |
| [Snap Judgment](../src/games/snap-judgment/index.js) | Keep | Photo prompts, rotating judging, submissions, points and reveals create activity away from the screen as well as on it. |
| [Spades](../src/games/spades/index.js) | Keep | Partnership bidding, nils, bags, private hands and trick play give it substantial strategic replay. |
| [Sponge](../src/games/sponge/index.js) | Improve | Pong is worth keeping. Repair numeric/string seat identity and timer cleanup, then add a match target/rematch and useful catalog description. |
| [Squarer](../src/games/squarer/index.js) | Test / prototype | A genuine Frogger-like seed, but bare presentation and a level cap that removes hazards/goal without a victory or replay leave it unfinished. |
| [Star Sweeper](../src/games/star-sweeper/index.js) | Keep | Private cameras, route choices, asteroid avoidance, timed collection and standings make it more than a camera demo. |
| [Sundown](../src/games/sundown/index.js) | Keep | Steering, curves, traffic, off-road slowdown and a limited driving run form a legitimate score attack. |
| [Sunside](../src/games/sunside/index.js) | Test / showcase | Mostly a procedural character/wardrobe/camera studio; the fixed twelve-return timing rally is a small attached minigame. Preserve as a 3D showcase. |
| [Testions](../src/games/testions/index.js) | Hide pending repair | A viable two-person prediction game, but startup can race question loading and disconnect handling uses the wrong argument shape. |
| [Typewriter (`text-input`)](../src/games/text-input/index.js) | Test / demo | Typewriter provides per-player text panels and keyboard-repeat behavior. Useful input example; no authored challenge or substantial creation workflow. |
| [The Argument](../src/games/the-argument/index.js) | Keep | Different private briefings, trust tokens, timed discussion and shared decisions create a substantial social session. Advertise its roughly 30-minute commitment. |
| [Tic-Tac-Toe](../src/games/tic-tac-toe/index.js) | Keep | Complete rules, a bot, visible win feedback and rematches make a useful small family game. |
| [Tug Club](../src/games/tug-club/index.js) | Keep | Shared tether forces, cargo delivery, a timed final haul and persistent best completion time offer a distinct co-op objective. |
| [Vector Siege](../src/games/vector-siege/index.js) | Keep | Combat roles, loadouts, sector objectives and a separate persistent-within-run RTS simulation provide the strongest systems depth in this set. |
| [VegasTrail](../src/games/vegas-trail/index.js) | Improve | A distinctive multi-activity road trip with shared resources and a destination. Repair roster/disconnect cleanup and exercise a complete journey before featuring. |
| [Tower Defense (`wat`)](../src/games/wat/index.js) | Test / prototype | Tower Defense has broken enemy lifecycle and wave progression, faulty projectile movement, and no base-health/loss loop. Needs completion, not a visual polish pass. |
| [Wordforge](../src/games/wordforge/index.js) | Keep | Creating differently shaped platforms while escaping a rising flood connects text input to a meaningful survival mechanic. |
| [Zap Tap](../src/games/zap-tap/index.js) | Keep / lightweight | A thin but complete 45-second reaction contest: expiring targets, faster spawning, scores, winner and automatic rematch. Lowest-priority keep; could join Micro Mayhem. |

## Existing test classification

Keep these 20 entries out of the default catalog:

`animation-test`, `device-test`, `drag-test`, `enhanced-view-test`, `gamepad-test`, `grid-test`, `image-test`, `input-test`, `layer-test`, `mem-test`, `move-test`, `perf-test`, `player-vis-test`, `savegame_demo`, `scale-test`, `shape-test`, `sound-test`, `sprite-test`, `view-test`, `word-match`.

`word-match` has actual game rules but is already test-only. I would leave it there pending a separate deliberate product pass. `enhanced-view-test` is large, but its size alone is not a reason to promote it.

## Catalog follow-through

1. Use the existing `metadata().isTest` mechanism for the eight recommended demotions. The [dashboard filter](../src/dashboard/HomegamesDashboard.js#L648) already respects `TESTS_ENABLED`; no folder moves or deletion are needed. Keep prototype/showcase intent clear in descriptions.
2. Track the three repair holds separately in this audit. If `isTest` is the only available visibility switch, it can temporarily hide them too, but that is an implementation workaround, not a verdict that their concepts are just tests.
3. Surface games, creative toys and developer examples distinctly if the catalog gains categories. Keep the flagship shelf smaller than the complete library.
4. Audit participation metadata. **27 of the 60 visible entries omit `maxPlayers`.** Not every omission is wrong—some intentionally allow spectators—but declared capacity, active seats and overflow behavior should agree. A `canAddPlayer()` method or `players: 2` does not establish the platform limit.
5. Pair future curation with a two-device playtest: first-time instructions, one complete round/run, replay, late join and departure. Prioritize the five improvement candidates and the three repair holds.

## Verification and limitations

- Inventoried all 80 top-level entries using parsed source metadata; reviewed gameplay structure and selected core methods across the 60 visible games, with deeper inspection of proposed cuts and repair candidates.
- Ran `node testRunner.js ./test/games/*.test.js`: **181 passed, 0 failed; process exited successfully.** These are the current game-specific tests, not the entire repository test suite. Some cover full simulated rounds; others only check construction/lifecycle. Passing is not proof of fun or full correctness.
- Ran seven temporary, direct-method probes. **All seven confirmed the suspected behaviors:** Tower Defense can count/pay the same killed enemy twice; a cleared wave stays `between` after 1,000 ticks; HalloweenWords' spider leaves score/bag unchanged after a candy; Hot Potato retains the disconnected holder's ID; Testions retains a disconnected player; Testions throws if two players arrive before questions load; Sponge's first keyboard seat does not accept movement after a second player joins.
- For isolation, the Testions probes stubbed question loading to represent a pending load, the Sponge probe stubbed the ball timer, and the Hot Potato probe suppressed scheduled callbacks. The Tower Defense wave probe explicitly marked enemies dead to isolate the missing next-wave transition. These are controlled logic reproductions, not browser recordings.
- A browser attempt at the existing `http://localhost:9801` endpoint returned an empty response. **No fresh visual or hands-on multiplayer playthrough was completed.** Art quality, control feel, network latency and actual remote-asset availability remain unverified. Placeholder findings concern the checked-in IDs, not a claim that every real asset URL was fetched.
- The checkout already contains substantial modified and untracked work. This report assesses that working tree; it does not assert what is on the main branch or deployed publicly. Only this audit document was added.
