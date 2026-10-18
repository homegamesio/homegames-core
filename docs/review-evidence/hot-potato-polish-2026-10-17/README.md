# Hot Potato polish — October 17, 2026

Keep the simple in-person game. The maintainer explicitly wants to retain it as a fun demo, without expanding it into a scored or elimination-based game.

The catalog description is exactly **Tap the potato to get it out of your hands before it explodes**. The only in-game text is **The potato demands at least two players.**, wrapped over two readable lines. The extra holding/waiting-for-holder/result captions from the earlier curation pass have been removed. The original artwork/audio, random other recipient, 5–19 second fuse and automatic three-second replay remain.

## Fixes

- A pass checks the current holder and original potato node; stale callbacks cannot affect a later round. A pass received after expiry resolves the explosion before changing hands.
- Timer handles are removed after firing/cancellation. Dropping below two players clears live/result/audio state and old callbacks; rejoining starts a fresh round.
- Duplicate joins do not leave extra backdrops; capacity remains eight.
- The original explosion clip lasts about 340 ms. Its node now remains for 500 ms instead of cutting it off at 250 ms.
- The waiting sentence no longer clips at the canvas edges. The refreshed thumbnail comes from the real RTC holder view with no added captions.

## Verification

| Check | Result |
| --- | --- |
| New game regressions | **6 passed**, including authorization, original fuse/audio position, delayed expiry, stale callbacks, departures, duplicate joins, capacity, shutdown and **1,000 complete rounds** with a simulated clock. Timer and active-scene counts remain bounded; this is not a general heap-profile result. |
| Existing scope/catalog regressions | **55 passed**, including private image/audio frames, late-join layering, waiting recovery and local media/catalog integrity. |
| Real-media RTC browser | Two complete normal-length rounds and replay, mouse and phone-emulated touch passing, private artwork/audio, ordinary gestures unlocking audio, joining during the result, passing to the late guest, holder departure, solo cleanup and rejoin. No external HTTP requests or browser errors. Randomness is fixed to choose a normal 12-second fuse; no timer acceleration or substituted artwork/audio. |
| Built website package | Installs and renders the solo waiting screen through the actual opaque game iframe. The deeper multi-player test above uses the same game source/local media through the client fixture. |
| Build/audit | **32 games / 12 featured**; selected-game audit clean; screenshot manifest/hash updated. |

An eight-player diagnostic over 1,000 passes measured a **498-byte maximum player frame**, **2,465 bytes across all eight frames per pass**, and **0.15 ms p95** for the game update plus serialization/all player frames on local Node 24.19.0. Network, media decode and drawing are excluded; this is not a device or API capacity guarantee. Details are in `performance.json`.

## Reproduce

Use Node 24. Browser scripts accept `PLAYWRIGHT_MODULE` and `CHROME_PATH`.

```sh
node --test test/games/HotPotato.test.cjs
node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node test/hot-potato-launch-browser.cjs
node tools/audit-games.cjs --json
# In homegamesio:
node scripts/build-site.js
GAME_FILTER='^hot-potato$' node test/catalog-games-browser.cjs
```

Logs, final screenshots, source hashes and the built package revision are stored here. The maintainer's wording and keep-simple decision are recorded in `homegamesio/docs/content-interview.json` and are not published as interview questions.

Physical phones, real household groups and separate-network/TURN behavior remain acceptance checks. The maintainer's choice to retain this simple game is settled. No shared package was changed, published or deployed. Next featured game: **Aquarium**.
