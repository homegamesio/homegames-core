# Vegas Trail polish — October 17, 2026

The description is exactly **Travel from Tucson to Las Vegas and conquer foes along the way**. The maintainer approved retaining the existing writing, artwork and music, selling the configured shop bundles, and finishing the trip at Las Vegas with **Play again**. Music remains credited to **@nytan on Bandcamp** in the README and to **@nytan** in the opening screen. The incompatible “drive back and forth forever” sentence has been removed from the victory screen.

## Fixes

- The opening now waits for Embark; joining cannot dismiss an introduction or result. Wins and all three failures offer replay while preserving connected participants and the root used by runtime listeners.
- There is one shared 420-mile route, party marker and set of landmark unlocks. Late arrivals cannot move the party backward, repeat stock unlocks or change the group's zone. Arrival stops the run; starvation on the final tick cannot turn into victory.
- Each shopper has an independent selection and modal. Drone requests are deduplicated and cleaned on departure. Food, ammo and antibiotics now give their configured bundles, with visible quantity/cost. Unknown, unaffordable and already-equipped purchases do not spend supplies.
- Opening text, resource counts and the paged shop are larger. All six shop items remain available. The original art, fonts, landmark/stranger dialogue and music are preserved. The catalog thumbnail is a real map-view capture.
- Driving awards scrap only on collision with a pickup. Misses expire without payment; steering stays inside the screen and collision bounds are consistent before/after movement.
- Hunting honors weapon cooldowns, clamps aim away from a zero-velocity path, prevents repeat damage from penetrating shots and duplicate kill rewards, and removes departing players' shots/cooldowns. Defeating a creature at a screen edge no longer crashes scrap collection.
- Talk initializes before input, delivers promised resources once per encounter, and lets a player return during the shared three-second encounter cooldown. Departures release private UI and stop consuming food.

## Verification

| Check | Result |
| --- | --- |
| New regressions | **11 passed**: opening/results/replay, route/late join, private shop/bundles/affordability, 201 join/departure cycles and capacity, drive pickups, weapon input/cooldowns, talk gifts, all failures, screen-edge scrap, final-tick starvation, penetrating hits. |
| Existing scope/catalog checks | **55 passed**. |
| Full route simulation | **Three complete trips**, each approximately **901 simulated seconds**, with eight scripted players, ordinary starting supplies and paid purchases. Every landmark is reached; maximum observed scene size is 107–108 nodes. Players use deterministic, fast scripted reactions. This is a clock/state/economy regression, **not human difficulty or enjoyment acceptance**. |
| Real-media RTC browser | Ordinary touch hunting, steering, punches, stranger view, private shop selections and paid bundle purchases. Correct per-view music after a gesture. Explicitly seeded late arrival, victory and all losses/replay. Eight real RTC participants receive frames; departures clean up. No browser errors or external HTTP requests. |
| Generated package and offline HTML | Actual website package through its opaque iframe, then its downloaded HTML with networking disabled: opening, map, drone, bundle selection, paid purchase and fresh run on reload. Uses rendered text and UI, with no injected game state. |
| Website/audit | **32 games / 12 featured** build. Selected games have no audit issues or external dependencies. |

Final tested website revision: `f3c4b27c54cbd74834552f83523a5e87d6564a62334ee0dd4f7e713669044a13`. Source hashes, logs, phone screenshots, offline screenshot and network counters accompany this record. No deployment, package publication or shared runtime change occurred.

## Performance and remaining acceptance

An approximately four-second desktop loopback sample with eight participants spread across the five views measured **3.93 Mbps aggregate host upload** to seven guests. Per-player frames were 2,445–4,330 bytes. This uses RTC worker wire-byte counters and excludes lower-level transport overhead; it is not a WAN/TURN capacity guarantee or a worst-case benchmark. No queued bytes remained at the sample boundaries.

Declared media totals **11,956,147 bytes** before framing (about 12 MB per new guest). Test the join burst and visible loading experience on slower uplinks/TURN, not just steady-state frames. Physical phones, a natural full trip with a real group, solo difficulty and sustained host performance still need acceptance. No new balance values or trip duration were chosen here. Runs intentionally do not save; reload starts a fresh trip.

## Reproduce

Use Node 24. Browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH`; they require Chrome and permission to listen on loopback.

```sh
node --test test/games/VegasTrail.test.cjs
node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/vegas-trail-simulation.cjs
node test/vegas-trail-launch-browser.cjs
node tools/audit-games.cjs --json
# Build from homegamesio, then return to Core:
node scripts/build-site.js
node test/vegas-trail-package-browser.cjs
```
