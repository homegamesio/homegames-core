# Lemonade Tycoon launch polish — October 17, 2026

The first featured game's local implementation pass is complete. It remains a keeper. Real-device usability, later bosses and group enjoyment still need acceptance.

## Changes and maintainer decisions

- Description: **Fight lemons in the night and profit during the day**.
- No explanatory tutorial paragraph, as requested. Factual controls and feedback remain; the generated lobby tagline was removed.
- Customer reactions use the exact supplied lines: `yowzers`, `wowzers`, `wow that's great!`, `pretty good`, `nice`, `cool`, `i dont think so`, `nope`, `super gross`, `i hate this`. Best reactions are reserved for best taste. Generated customer names/jokes were removed; preferences use factual labels. Reaction selection consumes no gameplay randomness.
- Existing boss names and victory story text were explicitly approved unchanged. The private interview record is `homegamesio/docs/content-interview.json`.
- Morning checkpoints preserve the business, inventory, upgrades, era and forecast. Closing during the day/night returns to that morning; losing writes an end marker. New run requires two clicks before replacing saved progress. Saving errors remain visible and retry. Invalid/future saves are preserved with autosave disabled.
- Saves contain allowlisted logical state, never players, input or scene nodes. Writes are serialized with one newest pending checkpoint, including submission before the save bridge closes.
- Only the active screen and nonempty drawing slots enter game frames. Drawing order, reused pools, private controls and player scopes remain intact. Phone combat controls and key HUD text are larger.

## Verification

| Check | Result |
| --- | --- |
| Game/save regressions | **19 passed**: mechanics, voting/departures/capacity, rewards, media, rendering, reactions, private/late-join frames, restore/reset, invalid saves, retry and shutdown. |
| Desktop/touch controls | Passed recipe/shop navigation, purchases across tabs, stock, sales transition, three weapons, charged moves and mute. Combat screenshots use deterministic scene fixtures, not a complete naturally played campaign. |
| Complete timed RTC loop | Separate host and phone-emulated guest: purchase/opening votes, recipe invalidation, normal 41.55-second sales, normal 75-second night, gathering/banking water, dawn, next morning and browser close/reopen. A separate defeat fixture verifies that loss stays ended after reload. No external HTTP dependencies or browser errors. |
| Final generated package | Passed website installation, checkpoint/reload, cancel/confirm New run, save export/import, and downloaded HTML save/resume while offline. Uses the real opaque iframe and exported saves without replacing game source. |
| Website build/audit | **32 games / 12 featured**, with the updated description and local save-state module. Catalog audit passes. |

The full RTC run preceded the final HUD sizing/New run button. The focused controls run checks the final HUD; final unit/package checks cover New run. The final package run follows the last README/package rebuild. Chrome menu checks use 100 ms clicks and accept the save-import confirmation. Initial harness failures were corrected without changing platform download code.

## Frame costs

Node 24.19.0 on the development Mac; seed 9876; normal first-day sales, purchased axe, then 300 stationary-player night ticks. Reference runs disable only screen/empty-slot filtering. Final gameplay states are identical. Sizes include all players, including the local host; they exclude network overhead and browser rendering. CPU timings are sensitive to JIT/order and are not EC2 or phone capacity estimates.

| Players | Reference mean aggregate frame | Current mean aggregate frame | Reduction | Current tick + all frames, p95 |
| --- | ---: | ---: | ---: | ---: |
| 1 | 31,041 bytes | 8,877 bytes | 71.4% | 0.54 ms |
| 2 | 62,047 bytes | 18,523 bytes | 70.1% | 0.76 ms |
| 6 | 186,372 bytes | 63,253 bytes | 66.1% | 1.89 ms |

Six-player raw guest payload is still approximately **8.4 Mbit/s** at 20 frames/s in this opening sample, assuming five equally sized remote views. Later encounters can differ. This is not a concurrency guarantee.

## Reproduce and evidence

Use Node 24, Chrome and Playwright. Browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH`. Run from Core unless marked otherwise:

```sh
node --test test/games/LemonadeTycoon*.test.cjs
node test/lemonade-browser.cjs
node test/lemonade-launch-browser.cjs
node tools/lemonade-performance.cjs
node tools/audit-games.cjs --json
# From homegamesio:
node scripts/build-site.js
# Back in Core, against that generated site:
node test/lemonade-package-browser.cjs
```

Logs and `performance.json` are stored here. `source-hashes.json` identifies the checked sources and final package revision. Screenshots show the final phone HUD, timed-loop reports and downloaded offline player. No shared-package release, deployment or publication was performed.

## Remaining acceptance

Watch new people discover recipe/price controls and survive a full session without an explanation. Use physical phones, independent networks and a real group, including night joins/departures and replay. Play later bosses normally to assess challenge and repeated-session appeal. Check sustained six-player uplink/TURN and phone performance. Review remaining flavor names and factual labels during playtesting; only the copy choices listed above are editorially approved.

Next featured game in configured order: **Hot Potato**. Other games retain their existing polish gates.
