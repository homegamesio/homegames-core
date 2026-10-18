# Catalog selection and public-copy checkpoint — October 17, 2026

The website collection is 32 games, reduced from 78 by marking 46 projects as tests. The 12 configured featured games and their order are unchanged. Source/assets remain available. The [decision report](../../launch-catalog-review-2026-10-17.md) explains every cut and keeper; the [JSON report](../../launch-catalog-review-2026-10-17.json) records counts and remaining scope.

## Results

| Check | Evidence | Result |
| --- | --- | --- |
| Current candidate browser pass | `current-browser.log`, `focused-browser.log`, `browser-results.json` | All 78 candidates opened. 75 received representative inputs; Pitch Pot, Snap Judgment and Walkie Talkie only received opening checks. The focused run follows the Hot Potato and input-harness fixes. |
| Core regressions | `core-tests.log` | 129 targeted catalog, metadata, Moonbounce and scoped-frame checks passed. |
| Website unit checks | `website-tests.log` | 70 passed. |
| Packaged browser games | `reduced-catalog-browser.log` | All 32 retained games passed the real portable install/play path. |
| Website user flow | `static-site-browser.log` | No-JS browsing/details, search, pack download, isolated play, private RTC guest, expired-invitation recovery, Studio copy/export/import, mobile layout; no external HTTP requests. |
| Catalog audit | `catalog-audit.log` | 147 projects: 32 default, 115 tests/review. No default-game asset/module/thumbnail errors. Old internal test-fixture warnings remain. |
| Final website build | `site-build-final.log`, `final-copy.log` | 32 games, 12 unchanged featured entries, all 46 cut detail pages absent, internal interview record excluded. |
| Final copy/layout | `final-copy.log`, `home-desktop.png`, `home-mobile.png`, `about-desktop.png`, `about-mobile.png` | All interview answers appear verbatim, except the maintainer-clarified self-hosting phrase. No interview questions, horizontal overflow or broken images at 1280 and 390 CSS pixels. Screenshots visually reviewed. |

Runtime: Node 24 for build and primary checks; installed Chrome 143.0.7499.169 for browser checks. Moonbounce's 40 adventure and 15 challenge recordings also passed on Node 18 after adding legal follow-up shots to Patient Pendulum. No gameplay/physics change or extra resources were required. The 129-check log includes the Node 24 recordings.

Hot Potato's waiting/holding/result cues and late-arrival layering are covered by scoped-frame tests and real browser captures (`hot-potato-holding.png`, `hot-potato-waiting-for-pass.png`). The 32 installed thumbnails and their hashes are in [game-screenshots.json](../../game-screenshots.json); they are actual game renders, not generated artwork.

`source-fingerprints.json` records the reviewed game entries, installed thumbnails, changed fixtures, public page sources, editorial record and final generated game manifest for comparison with later edits.

## Reproduce

Run with Node 24 and installed dependencies. Set `PLAYWRIGHT_MODULE` to Playwright's absolute package path and `CHROME_PATH` to the installed Chrome executable when needed. Browser fixtures need permission to bind loopback and launch Chrome.

From Core:

```sh
node testRunner.js ./test/games/CatalogConsolidation.test.js ./test/games/MetadataMigration.test.js ./test/games/Moonbounce*.test.js ./test/session/ScopedFrames.test.js
node tools/audit-games.cjs
CATALOG_UI_PLAY=1 CATALOG_SCREENSHOTS=/tmp/homegames-catalog-review node test/catalog-browser.cjs
```

The default browser command now selects the 32 retained games. To reproduce the original 78-candidate scope, set `CATALOG_GAMES` to the comma-separated `games[].id` values from the JSON decision report, including cuts. The report's per-game results merge the original full run and the later four-game run. The input harness uses actual pointer/keyboard actions but also simulates extra players for some scenes; it does not replace independent guests or a real group.

From the sibling website repository:

```sh
node scripts/build-site.js
node --test test/*.test.js
node test/catalog-games-browser.cjs
RTC_TEST_DISABLE_MDNS=1 node test/static-site-browser.cjs
```

The final copy-only build was followed by a temporary local Chrome check of both pages, exact interview-answer inclusion, excluded questions/editorial JSON, featured order, absent cut pages, image loading and overflow. Earlier gameplay checks were not unnecessarily repeated after these prose-only edits.

## Limits and remaining work

- Selection is editorial judgment informed by source, captures and short interaction checks. It does not establish that new players enjoy a full session. Every keeper still has a polish/playthrough checklist.
- Real devices, audio perception, independent multiplayer guests, long progression, sustained performance, WAN/TURN, native release archives and live API/certificate/discovery acceptance remain separate gates.
- Website builds exclude test games. This work does not claim that native release archives have stopped carrying their source.
- The complete Core suite was not rerun. Its three previously reported curation/Moonbounce failures are covered by the now-passing targeted checks.
- Homepage/About body copy is complete for this interview. Headings, labels, game writing, Studio guidance and other pages remain in the copy inventory. The homepage Studio screenshot still shows an older runtime and should be refreshed during the Studio editorial pass.
- No production deployment, package publication or Git commit was performed.
