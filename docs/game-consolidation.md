# Homegames collection consolidation

The initial consolidation retained **82 games**, with **58 test/review entries** on disk, hidden when `TESTS_ENABLED` is false. Heart Catcher is preserved separately as incompatible legacy canvas code. Nothing in the import collection was deleted. These counts describe that consolidation, not later additions.

The October 14 website selection restores Aquarium and Pulsefront with gameplay thumbnails and includes Weed Smoke Willie. The website's `site.config.json` now separates its ordered `featuredGames` list from the full catalog discovered through `gamesDirs`; featuring a game does not hide other eligible games.

October 17 Aquarium update: the current `src/games/aquarium` contains **Aquarium Forever: Beyond the Surface**. Its data directory has been restored, it keeps Aquarium's existing catalog identity, and automatic save/resume now covers creatures, purchases, upgrades and eras. The earlier Aquarium variant decisions below describe the consolidation snapshot; the deleted `aquarium-forever` folders are no longer selected release sources. The screenshot inventory still needs reconciliation with the current game folders.

Open [the visual review sheet](game-catalog.html) to search the collection, inspect gameplay screenshots, and review the reasons for hiding games. [game-curation.json](game-curation.json) contains the editorial decisions in a compact form.

## One source of truth

- Started with 104 local entry points and reviewed all 80 ZIPs copied to `imports/hg_games`.
- Imported 36 distinct runnable games under their real names, merged five stronger versions, retained 36 locally preferable counterparts, resolved one exact duplicate and one superseded intermediate version, and archived one incompatible canvas project. There are now 140 discoverable entries with unique runtime identities.
- The five merges are Sponge, Clicktionary, Snap Judgment, Hot Potato and VegasTrail. Working-tree copies before those replacements are in the ignored `imports/before-consolidation` folder.
- Both Ball Bounce ZIPs contain the same project. Aquarium Forever: Bigger Tank remains review material; Aquarium and Beyond the Surface are separate catalog choices.
- All visible games load from `src/games` without a hosted media dependency. Newly bundled media has per-game `assets/sources.json` records with source IDs, URLs, lengths and SHA-256 hashes. Original game licenses remain alongside the code.
- Seven known downloaded copies (Deadword, Polystorm, Facet, Hot Potato, Draw, City Commons and Geom Storm) are also hidden when their maintained built-in counterpart is present. `src/games/legacy-game-aliases.json` records their old public IDs. Cached files stay untouched and remain available with tests enabled; these copies are separate from the 140 source entries above.
- [The archive map](game-consolidation.json) records a destination, decision, reason and original archive hash for every ZIP. Imported ZIPs and backups are excluded from Git.

## What earns a place

Keep a complete game or an intentional creative toy with a distinct reason to choose it. Familiar board/card games and gentle children's games are valuable without elaborate progression. Large codebases, complex terminology and technical demonstrations are not automatic reasons to keep an entry visible.

The lineup keeps several clearly different roles within broader genres:

| Area | Distinct roles retained | Earlier or overlapping entries hidden |
| --- | --- | --- |
| Living worlds | Common Ground builds a city; Little Consequences explores cause and effect; Aquarium offers a small tank; Aquarium Forever grows a tank into a larger world | City Scanner, City Commons, Railway Reverie, Bigger Tank |
| Strategy | Pocket Front offers short defense runs; Vector Siege offers deeper conquest; Pulsefront has classic and expansive conquest maps; Swarmwell moves living colonies; Bannerbound puts you inside a warband | Warpoint |
| Space/action | Orbit Breaker catches and returns enemy fire; Starweld assembles a combat ship; Starfall Salvage is a narrative exploration adventure; Nova Guard shares orbital defense; Polystorm supplies campaign shmup play | Neon Shooter, Neon Dodge, Doodle Invaders, robot combat sketches |
| First person | After Hours offers map/mode arena play; Tremulous combines asymmetric teams and base building; Relic Rush is an obstacle runner | Prism 3D; Iron Keep held for missing assets |
| Creative/physics | Draw, Lumen Festival, Starry Sparkles, Dragon Drop, Tumble Tower and Buddy Box provide different expressive or physics interactions | Typewriter, Grand Finale, Flick, image/bounce demonstrations |
| Social | Drawing/guessing, bluffing, private-information cooperation, photography, recorded pitches and live-camera improvisation remain separate activities | Slaps, Testions and the current Hot Potato prototype |

## Polish delivered

- **Counterforge: Apex:** removed internal model telemetry, probability tables, frame counters and diagnostic prose from the playing interface. The rival's prediction, adaptation and combat choices remain. The premise and final-form survival goal are stated plainly.
- **Common Ground:** fixed overlapping money/population/income text and the overflowing tool label. Demand bars now name homes, shops and jobs. The selected tool gives one actionable building instruction.
- **Swarmwell:** the detailed walkthrough is opt-in with `?`; the board starts with one contextual action hint. Removed repeated dormant labels and prevented long player names from crowding the colony HUD.
- **Worldseed:** each power now includes its concrete effect, while simultaneous secret choices and their combinations remain the discovery.
- **Chronoclast:** made the first controls readable and described echoes as a replay of your previous six seconds.
- **The Argument:** separated private briefings from the shared situation, wrapped complete clues instead of cutting off their endings, and moved the audit meter out of the prompt.
- **Sponge:** numeric seat handling, seven-point matches, rematches and bot handoff.
- **Clicktionary:** stable strokes, immutable recap drawings, word aliases and gallery review.
- **Snap Judgment:** scoped judging controls to the correct phase and made sitting out a shot work.
- **VegasTrail:** retained the newer simulation/rendering work and removed departed players from food consumption and minigame rosters.
- **Hot Potato / Testions:** repaired disconnect, timer and input-validation failures while retaining their review classification.
- **Hangman:** removed the Node-only question-bank decoding that prevented browser play.
- **Local library:** retained local thumbnail paths and review flags when loading games through the optional developer directory, too.
- **Dashboard:** long card titles use two compact lines so they no longer overlap neighboring cards. The game modal retains the full title.

## Screenshots and review workflow

Every visible game has a real local `assets/thumbnail.png` referenced by its metadata. Captures come from the actual Chrome renderer with local media and representative game entry points, including populated party rounds. Square and portrait games are letterboxed into a consistent 960×600 frame. These are screenshots, not generated cover art. [The screenshot manifest](game-screenshots.json) records the game, scene and image hash.

The current local `config.json` has `TESTS_ENABLED: false`. Set it to true to play review entries in the dashboard. To restore a particular game, remove its `isTest: true`, give it a gameplay thumbnail, update the curation reason, and regenerate the visual sheet. The original ZIPs remain available for comparison.

To refresh screenshots, run `test/catalog-browser.cjs` with Playwright and Chrome available (`PLAYWRIGHT_MODULE` and `CHROME_PATH` can identify them), then `python3 tools/install-game-thumbnails.py` (Pillow required) and `node tools/build-game-catalog.cjs`. `CATALOG_GAMES` accepts comma-separated folder names for a focused recapture. Run `node tools/audit-games.cjs` after changes.

## Hidden entries

These are reversible editorial cuts and repair holds, not deletions. Already-hidden platform tests stay hidden.

| Game | Reason |
| --- | --- |
| [animation-test](../src/games/animation-test/index.js) | Existing platform test or developer demonstration. |
| [Aquarium Forever: Bigger Tank](../src/games/aquarium-forever%205/index.js) | Earlier Bigger Tank implementation, superseded by Aquarium Forever: Beyond the Surface. |
| [Ball Bounce](../src/games/ball-bounce/index.js) | Basic bounce/score prototype; both dddd and ims archives contain this same game. |
| [Blank Template](../src/games/blank-template/index.js) | Empty starter template; no game loop. |
| [Bunny Harvest](../src/games/bunny-harvest/index.js) | Simple timed carrot collection; Star Sweeper offers a more developed competitive collecting game. |
| [The Cabinet](../src/games/cabinet/index.js) | CHIP-8 emulator showcase with Pong; keep as a technical demo while Sponge is the playable Pong pick. |
| [City Commons: Living Detail](../src/games/city-commons/index.js) | Intermediate city diorama; Little Consequences is the fuller living-world exploration. |
| [City Scanner](../src/games/city-scanner/index.js) | Earlier living-city exploration; Little Consequences develops the simulation and Common Ground adds building decisions. |
| [Counterforge: Wilds](../src/games/counterforge-wilds/index.js) | Broad procedural RPG overlaps Copperline. Keep the distinctive learning-opponent idea in Counterforge: Apex. |
| [Cursor Test](../src/games/cursor-test/index.js) | Existing platform test or developer demonstration. |
| [Dance Fever](../src/games/dance-fever/index.js) | Movement/scoring prototype without a timed round or result. |
| [device-test](../src/games/device-test/index.js) | Existing platform test or developer demonstration. |
| [Doodle Invaders](../src/games/doodle-invaders/index.js) | Earlier wave shooter; Polystorm supplies the campaign shmup and Nova Guard keeps cooperative defense. |
| [Drag Test](../src/games/drag-test/index.js) | Existing platform test or developer demonstration. |
| [Dump Truck](../src/games/dump-truck/index.js) | Vehicle movement sketch; Happy Haulers and Red Truck Ramble develop this idea. |
| [enhanced-view-test](../src/games/enhanced-view-test/index.js) | Existing platform test or developer demonstration. |
| [Flick](../src/games/flick/index.js) | Physics scoring sketch without a developed match arc; Tumble Tower and Dragon Drop offer clearer goals. |
| [Gamepad Test](../src/games/gamepad-test/index.js) | Existing platform test or developer demonstration. |
| [Geom Storm](../src/games/geom-storm/index.js) | Renderer stress showcase; retain as a benchmark rather than a default arcade game. |
| [Grand Finale](../src/games/grand-finale/index.js) | Earlier fireworks chain-reaction game; Lumen Festival develops this role. Starry Sparkles serves gentle creative play. |
| [grid-test](../src/games/grid-test/index.js) | Existing platform test or developer demonstration. |
| [halloween-words](../src/games/halloween-words/index.js) | Unfinished candy prototype: scoring empties the bag before the spider penalty can matter. |
| [Hot Potato](../src/games/hot-potato/index.js) | Party prototype: passing and disconnects repaired, but no match score or elimination arc. |
| [Image Gallery](../src/games/image-gallery/index.js) | Image display demo; retain for asset testing. |
| [image-test](../src/games/image-test/index.js) | Existing platform test or developer demonstration. |
| [Input Test](../src/games/input-test/index.js) | Existing platform test or developer demonstration. |
| [Iron Keep](../src/games/iron-keep/index.js) | Repair hold: all nine required visual/audio assets are still placeholders. |
| [layer-test](../src/games/layer-test/index.js) | Existing platform test or developer demonstration. |
| [mem-test](../src/games/mem-test/index.js) | Existing platform test or developer demonstration. |
| [move-test](../src/games/move-test/index.js) | Existing platform test or developer demonstration. |
| [Neon Dodge](../src/games/neon-dodge/index.js) | Small survival prototype; retain for review alongside the more developed arcade games. |
| [Neon Shooter](../src/games/neon-shooter/index.js) | Early wave shooter; Polystorm and Doodle Invaders provide more developed alternatives. |
| [perf-test](../src/games/perf-test/index.js) | Existing platform test or developer demonstration. |
| [Visibility test](../src/games/player-vis-test/index.js) | Existing platform test or developer demonstration. |
| [Prism 3D](../src/games/prism-3d/index.js) | Earlier first-person arena; After Hours expands this role with maps and modes. |
| [Railway Reverie](../src/games/railway-reverie/index.js) | Earlier model railway world; Little Consequences carries forward its trains, traffic and independent cameras. |
| [Robots Arena](../src/games/robots-arena/index.js) | Basic robot combat sketch; retain for comparison with Block Brawlers and the arena games. |
| [savegame_demo](../src/games/savegame_demo/index.js) | Existing platform test or developer demonstration. |
| [Scale test](../src/games/scale-test/index.js) | Existing platform test or developer demonstration. |
| [Shape Test](../src/games/shape-test/index.js) | Existing platform test or developer demonstration. |
| [Slaps - Reslapstered](../src/games/slaps/index.js) | Card-dealing demo: highest random card wins immediately, without a player decision or slap mechanic. |
| [Soccer](../src/games/soccer/index.js) | Early soccer/combat sketch with shared controls; needs a complete match and restart. |
| [sound-test](../src/games/sound-test/index.js) | Existing platform test or developer demonstration. |
| [sprite-test](../src/games/sprite-test/index.js) | Existing platform test or developer demonstration. |
| [squarer](../src/games/squarer/index.js) | Collision/Frogger prototype lacks a finished progression, ending and replay. |
| [Sunside](../src/games/sunside/index.js) | Character, outfit and camera showcase with a short attached rally. |
| [Testions](../src/games/testions/index.js) | Question-upload party prototype; stronger authored rounds and clearer entry in Fakeout and Imposter. |
| [Typewriter](../src/games/text-input/index.js) | Shared typing demo. Draw remains the flexible creative canvas and Wordforge turns typing into a game. |
| [Two-Player Fight](../src/games/two-player-fight/index.js) | Shared-keyboard combat sketch; Block Brawlers is the developed alternative. |
| [view-test](../src/games/view-test/index.js) | Existing platform test or developer demonstration. |
| [Walkie Talkie](../src/games/walkie-talkie/index.js) | Existing platform test or developer demonstration. |
| [Warpoint](../src/games/warpoint/index.js) | Small conquest RTS overlaps the deeper Vector Siege and more approachable Pocket Front. |
| [Tower Defense](../src/games/wat/index.js) | Unfinished tower defense: broken wave/enemy lifecycle and no base-health loss loop. |
| [word-match](../src/games/word-match/index.js) | Existing platform test or developer demonstration. |
| [Zap Tap](../src/games/zap-tap/index.js) | Single reflex minigame; Micro Mayhem provides a broader party challenge. |

## Verification and limits

- All 82 visible games built their browser payloads with hosted asset fetching disabled, rendered in Chrome with external requests blocked, and produced screenshots. This exercises startup and representative early play, not full campaign completion or every input/device combination.
- The main regression run passed 639 checks across games, library, dashboard, project assets and browser-play routes. A subsequent focused library/dashboard run passed all 18 checks, including developer-directory metadata and legacy-download deduplication regressions.
- The live dashboard was reloaded and inspected with the curated collection and local thumbnails; its page count dropped from 15 to 14 after excluding seven duplicate downloads. The title layout change also passed all 12 page-size/catalog checks.
- Consolidation regressions exercise imported/merged games through loading, joins, ticks and departures, plus specific fixes for Sponge, Clicktionary, Snap Judgment, Testions, Hot Potato and VegasTrail. Catalog checks enforce unique runtime identities and local assets/screenshots.
- Hot Potato also passed a real two-browser RTC check: host click, phone touch, holder-only image/audio, waiting-player input rejection and disconnect cleanup.
- The browser report records the existing caught `process is not defined` startup warnings from legacy Squish Asset modules separately; runtime exceptions and other console errors fail the check. Local media loading succeeds despite those legacy warnings.
- Iron Keep's nine required assets are still missing and it stays hidden. Four source-only developer tests still use shared core helpers. Heart Catcher's legacy canvas implementation does not implement the current game contract.
- At the consolidation snapshot, Aquarium Forever and Common Ground checkpoint exports did not establish save/restore persistence. Aquarium now has automatic save/resume (October 17 update above); Common Ground still needs its own persistence review.
- Curation is an evidence-based first selection. The visual sheet and preserved alternatives are intended for your taste/play review; the smoke pass is not a claim that every campaign, balance curve or phone layout has been fully playtested.
