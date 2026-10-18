# Hot Potato

Tap the potato to get it out of your hands before it explodes

An in-person game for two to eight players. Each person uses their own screen. The potato passes to a random other player; its fuse does not restart when passed. After an explosion, the next round starts automatically after three seconds. Everyone stays in.

The only in-game message is the maintainer's waiting text: “The potato demands at least two players.” The original artwork and sounds remain. There are no scores or saved progress.

## Verification

From Core, run `node --test test/games/HotPotato.test.cjs` and `node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js`. `test/hot-potato-launch-browser.cjs` exercises complete rounds with real media and separate RTC browsers, including a phone-sized touch guest, joining, departures and replay. Browser checks accept `PLAYWRIGHT_MODULE` and `CHROME_PATH`.

Automated checks verify mechanics and rendering. A real in-person group and physical phones remain the acceptance test for the game's feel.
