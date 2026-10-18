# Gold & Grit

A single-player western tower defense for Homegames / Squish 1.4.5. Keep bandits out of a saloon full of gold and friends. All art is native polygon geometry; sound effects are original synthesized WAV files. No network services, image generation, remote assets, difficulty switches or permanent statistical upgrades are required.

## Play

Open **Gold & Grit** in the local game library, or run the dedicated preview from `homegames-core`:

```sh
node test/gold-and-grit-browser.cjs --serve
```

The preview listens at `http://127.0.0.1:4205`. It loads the actual portable project and Homegames browser client, including saves and the Files menu. It uses the neighboring `homegames-client/dist` bundle when available.

Tap a posse card, then an open spot. Dragging a card onto the field also works. Tap a placed defender to see its range, upgrade, change target priority, or sell. The play button sends the next wave; during a wave it pauses. The speed control switches between 1× and 2× using the same simulation steps.

Large stages open in a full-map overview. Use **+ / −** to zoom, drag empty ground to pan, or tap/drag the minimap to jump to another part of the frontier. The four-corner button restores the overview. The arrow-cross button switches to pan mode even while working over a defender or editor point; selecting a defender card or editor tool exits pan mode. The minimap shows every trail, both entrances, the saloon, defenders and live bandits, including those outside the camera. On two-trail maps, matching numbered circle/diamond markers connect entrances, the minimap and the enemy preview, so each flank's incoming types and counts are visible before sending a wave. Camera movement never changes combat speed, ranges or targeting. HUD controls stay fixed on screen.

- **Gold bars** are the saloon's health. A bandit's loot value is how much it steals when it escapes.
- **Coins** pay for defenders and upgrades. Kills and cleared waves earn coins.
- One win unlocks the next trail. Three stars require keeping every gold bar; two require at least half. Stars do not buy extra power.
- Every wave is fixed and previewed. Nothing spawns until the player presses play. Building and upgrading remain available during waves and while paused.
- Before the first wave, selling refunds the whole purchase. After that, it refunds 75%, rounded down.
- Progress and custom maps save through the host. Continuing a saved run returns to its last planning checkpoint, including purchases made before sending that wave. Mid-wave rewards and purchases are rolled back together. Disconnect pauses the game.

Keyboard shortcuts: **1–6** select defenders, **Space/Enter** sends or pauses a wave, **F** changes speed, **Escape** cancels placement and pauses/resumes. **WASD / arrows** pan, **+ / −** zoom and **0** restores the overview. Hold **Shift** while dragging to pan. The editor uses **Z/Y** for undo/redo. Pointer and touch are the primary controls; gamepad navigation is not implemented.

## The posse

Each defender has one shared upgrade, then a choice of two specializations, then a final upgrade to that chosen branch. Branches cannot be switched after purchase.

| Defender | Role | Specializations |
| --- | --- | --- |
| Deputy | Inexpensive rapid shots | Fan the hammer: multiple targets / Marshal: armor piercing |
| Ranger | Long range, piercing rifle | Deadeye: heavy piercing damage / Repeater: quick shots |
| Wrangler | Slows the bandits | Roundup: group snares / Bounty hunter: marks amplify all incoming damage |
| Prospector | Ground-targeted, armor-ignoring explosions | Powder keg: blast area / Brushfire: lingering damage |
| Gatling | Sustained rapid fire | Lead storm: armor shredding / Crossfire: multiple targets |
| Bard | Speeds nearby defenders | Rally: stronger aura / Payday: bonus pay after each cleared wave |

Aura bonuses use the strongest nearby bard; they do not multiply. Slows use the strongest active snare. Grenades lead their target, visibly mark a landing location, then resolve against units actually in the blast. Target priorities are first (least remaining un-slowed travel time), strongest (current HP), and last.

Bandits include ordinary drifters, fast runners, mounted riders, armored Ironcoats, quick Outlaws, heavily armored gold wagons, durable Big Hats, and the Baron. Every type has fixed HP, speed, armor, bounty and stolen-gold values in `content.js`. Combat has no critical-hit, dodge or damage randomness.

## Campaign and workshop

`campaign.json` contains the original 30 fixed maps across Sundust Trail, Red Rock Pass, Sagebrush County, Copper Canyon and Last Chance. Winning all 30 reveals **The Badlands**: 30 additional trails in `badlands.json`, across Painted Desert, Rattler Gulch, Ghostwater Basin, Black Mesa and Devil's Door. Each secret trail has 10–12 waves, all six defenders, the same 20 gold and unchanged enemy properties. Spaced armored convoys, cavalry sweeps, converging flanks and overlapping Baron escorts demand investment throughout the run. No three-star requirement or paid power is needed to enter.

The secret page, level buttons and workshop copies stay hidden until the base campaign is complete. Existing 30-entry saves automatically keep their earned stars and unlock the Badlands if already complete; checkpoints remain playable. The campaign then progresses through trail 60, with a separate ending. Both campaigns use the exact schema accepted by the workshop, including every route, wave group and decoration. There is no alternate campaign-only map engine. The workshop's **Copy a stage** opens an independent copy of a revealed campaign map; copying and test runs never advance campaign progress.

The first six stages stay compact. Stages 7–30 use distinct wider and taller frontiers, diagonal canyon passes, ranch courtyards, opposing entrances, and a central-saloon finale. Rock formations change viable firing positions; open space separates coverage areas instead of enlarging the defenders' ranges. Saved runs retain their embedded map and tower positions when a campaign layout changes; new runs use the updated terrain. `tools/gold-and-grit/author-frontiers.cjs` records the fixed layouts and can reproduce their map data.

The opening budget starts at 140 coins: two deputies, or one with its first upgrade. Runners join the second wave, armored escorts arrive with the Ranger, and later stages combine cavalry, spread-out heavies and simultaneous flanks. The first eighteen stages require reinvestment early; an unchanged opening defense loses by wave four in the planning probe. The saloon still holds 20 gold, allowing imperfect defenses to leak and recover. Enemy properties and tower prices are fixed across the campaign and workshop. Checkpoints embed their original waves and budgets, so start a fresh run to play campaign balance updates.

The workshop supports:

- One or two waypoint trails, shared saloon endpoint, draggable corners, inserting/removing corners.
- Cactus, rock, barrel, fence, tumbleweed and trough stamps. Rocks block tower placement; other scenery is decorative. Trails are fixed and cannot be blocked by towers.
- Ten landscape palettes, map names, starting cash/gold and allowed defenders.
- New maps open on the **Map Size** tab. Choose Town, Wide, Tall, Large or Vast, use width/height **+ / −**, or click either number for exact dimensions up to 260×180 world units (6.5 times the starter area, matching the largest campaign stages). The preview visibly adds land around your existing trail. Resizing preserves paths and scenery, fits the camera to the new map, and supports undo/redo; a smaller size is refused while it would cut off existing content.
- **Draw Trails** returns to the map. The field outline shows its editable boundaries; the size button, zoom percentage and camera controls sit below the canvas while drawing trails or scenery. Zoom in and drag empty ground, use pan mode, or tap the minimap to reach distant areas with the same controls as play. Toggle **Minimap** off to work on the ground beneath it. Zoom changes the view; **Map Size** changes the land available to build on.
- Up to 24 waves, eight groups per wave, 240 enemies per wave. Groups choose type, count, spacing, start delay and entrance route. Click the numbers to enter counts, timing and budgets directly; the small plus/minus controls remain available for fine changes.
- **Copy** duplicates a wave or group independently. Move a wave earlier/later, insert a blank wave, or delete one. These changes support undo/redo.
- **Timing** switches the wave table to a shared spawn timeline, colored by entrance. Group delays, spacing and overlap are visible; the summary shows bandit count, kill bounty and final spawn time. This is a spawn preview, not a claim about combat difficulty. **Test run** plays the complete map using its actual starting budget, then returns to the draft.
- 50 undo steps and redo, autosaved unfinished drafts, a paged library of up to 60 custom maps, reversible deletion and immediate test runs.
- Validated JSON import/export. Saving a map also refreshes `frontier.json` when the host supports exports. **Export** exposes it through Homegames' **Files** menu; downloading/copying the game carries the pack. Personal progress and test runs are not included in the exported maps.

An empty file library is valid. A pack is `{ "format": "gold-and-grit", "version": 1, "levels": [...] }`; an individual level object can also be imported. Imports are limited to 4 MiB and rebuilt from a bounded schema. A compact library may use up to 768 KiB, leaving room for a draft and complete checkpoint under the host's 1 MiB save limit. An unusually dense set can therefore reach the size limit before 60 maps. Invalid or oversized imports do not partially replace the library. Drafts may contain temporarily invalid geometry, but saving to the map library, exporting or starting a test requires a valid map. An exported map is not a certificate that it can be beaten.

Levels may include `bounds: {"w":208,"h":146}`. Width must be an integer from 116–260 and height from 62–180. Bounds describe the buildable field beginning at world (4,18); omitted bounds retain the original 116×62 field and old maps keep their original schema.

The browser client's file picker now includes `application/json,.json` alongside its existing media filters. Rebuild `homegames-client` after updating its `src/input.js`; game-side validation remains responsible for interpreting input bytes.

## Implementation

- `engine.js`: browser-safe deterministic 60 Hz combat, placement, targeting, economy, upgrades and checkpoints.
- `content.js`: the six tower kits, eight enemy types, palettes and balance constants.
- `campaign.json`, `badlands.json`, `levels.js`: editable campaign assets, progression boundaries and the new-map template.
- `design.js`: map schema, bounded imports/exports, editor history.
- `camera.js`: reversible world/screen transforms, bounded pan/zoom and overview fitting.
- `art.js`, `view.js`: pooled Squish painting, characters, terrain, effects, campaign and editor UI.
- `index.js`: native input surface, single-player ownership, host save/export APIs, audio lifetime and lifecycle.

The game extends Squish's `ViewableGame`, with simulation data in world coordinates and pooled visible nodes under `getViewRoot()`. Its screen canvas remains 160×100. The painter projects and clips world geometry to the battlefield viewport before converting to Squish's 0–100 coordinates; HUD painting bypasses the camera. Raw large/negative world coordinates never enter transmitted frames. Ring outlines use one polygon with opposite winding, respecting Squish's one-byte coordinate-payload limit. A stable transparent input surface survives visual pooling, so drawing order does not steal ongoing drags. Native text/file nodes retain their identity across frames.

Combat bounds: 32 towers, 80 living enemies, 64 airborne grenades, 24 burning areas, 120 transient visual effects, eight audio voices. When the enemy cap is reached, due spawns wait in order; no authored enemy is silently discarded. Rendering has bounded pools (4,096 polygons / 180 texts), and inactive nodes are detached from the transmitted frame. The simulation does not use wall-clock timers or visual randomness.

The source survey used the repository's game-building-block catalog and a capability scan of the current game entrypoints. Detailed references were Copperline (western polygon scene and pure engine), Pocket Front (placement and stable input), Moonbounce (campaign, fixed stepping and pooled painting), Draw Your Own Boss (native edits, portable creation exports), Fleetfall (dispatcher/browser verification), and the Squish node, text/shape codec and runtime implementations. These patterns are implemented locally; this game does not import other games at runtime.

## Verification

```sh
node --test test/games/GoldAndGrit*.test.cjs
node tools/gold-and-grit/verify.cjs
node tools/gold-and-grit/verify.cjs --deputies
FROM=1 TO=6 node tools/gold-and-grit/difficulty.cjs
node tools/gold-and-grit/badlands-verify.cjs --write
node test/gold-and-grit-browser.cjs
```

The browser test needs Playwright with Node 20+ and Chrome (override `PLAYWRIGHT_MODULE` / `CHROME_PATH` when necessary). It checks the portable game with network requests outside localhost blocked: real mouse/touch placement, held input, pause, planning checkpoints after reload, editor dragging, history, wave edits/reordering, native numeric/naming/JSON file dialogs, timing view, exported files and persistence, plus zoom, minimap jumps, secret-campaign reveal, reload and final ending.

The rule suite checks combat interactions, damage/armor, upgrade branches, capped spawns, serialized frames, deterministic fast-forward, ownership, recovery from corrupt saves, portable copies and map lifecycle. Camera and world suites cover inverse coordinates, pan/zoom bounds, fixed HUD input, editor dragging, larger exports/checkpoints and clipped native frames. Difficulty regressions require a legal mixed-posse win on all 60 stages and a loss on every stage when only the opening defense is purchased. At least four of the first six stages also defeat the single-defender upgrade probe. All 30 secret stages must defeat both the solo-upgrade probe and a defense that stops spending after wave three.

`tools/gold-and-grit/balance-report.json` records the base-campaign pressure pass. `badlands-report.json` records six strategies for all secret maps, per-wave leaks/spending, legal winning purchases and two alternate placement runs per map. It includes a campaign fingerprint. `difficulty.cjs` supports `FROM`, `TO`, and `--policy=mixed,opening-only,coasting,one-tower,deputies,clustered`. The solo probe follows one greedy opening purchase; it does not exhaust every possible tower and position. These are reproducible solvability and strategy checks, not a claim that the difficulty curve has been validated by human players. Human playtesting, especially long final battles and small phone screens, remains useful for further balancing.

`tools/gold-and-grit/author-badlands.cjs` reproduces the fixed secret maps, encounter orders and calibrated starting budgets. Authoring happens offline; the running game only reads the resulting workshop JSON. Regenerate the verification report after changing campaign data.

MIT; see `LICENSE`.
