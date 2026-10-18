# Swish polish — October 18, 2026

The description is exactly **made with squish**. Joseph Garcia chose **30 scene updates per second**, keeping physics and game timing unchanged. The three courts, geometric artwork, short aim guide, individual scores, ball collisions and nine theme/duration record tables remain.

## Fixes

- One physical menu press makes one selection. Repeated held input cannot spam saves or turn the Start gesture into an aiming gesture; selecting the current settings does not write again.
- Actual pointer release launches the shot. Cancelled capture, a replacement press, or missing/non-finite release coordinates discard the aim. Players retain ownership of their own gestures.
- Shot simulation follows elapsed time, including a slower 10 Hz host. Physics still ticks at 60 Hz and substeps at up to 240 Hz. Each tick catches up at most 250 ms; results cannot remain stuck beyond five wall-clock seconds after the buzzer once ticks resume. Long host suspension skips motion beyond the catch-up cap rather than processing an unbounded backlog.
- At most four active scores and the five highest departed scores remain in round memory. Repeated visitors cannot grow that state indefinitely. Invalid player identifiers cannot occupy seats. Departing-player records still count if the round finishes; an entirely abandoned unfinished round is not saved.
- Phone scoreboard/menu labels, host-choice feedback and failed-save feedback are larger; retry has a larger hit area. The catalog thumbnail is a real four-player court capture.
- Small ellipses use fewer points, while large ellipses retain the original maximum detail. Empty visual slots are omitted and reattached in their original order. Private halos and aim guides retain their player scopes. Static menus stop redrawing; continuous court/animation output runs at 30 Hz. Direct input/lifecycle changes remain immediate, and audio updates are batched with drawing.

## Verification

| Check | Result |
| --- | --- |
| Game regressions | **24 passed**: 13 existing physics/records/package tests plus 11 new input, clock, retention, scope, pruning and scene-rate checks. |
| Existing scope/catalog regressions | **55 passed**. |
| Real-media browser/RTC | Mouse and actual emulated touch drags, short private guide, a scored basket, theme lock during play, records after reload, real two-player ball collision/individual scoring, four participants, departure while aiming, all three themed courts, and upload counters. Some later obstacle/ending scenarios are explicitly seeded. No browser errors or external HTTP requests. |
| Built package and offline HTML | Actual touch aiming/scoring, natural 30-second rounds (30,022 ms website; 30,042 ms offline), results and records after reload, plus saved theme/duration preferences and isolated records. Networking disabled for downloaded HTML. No game-state/clock injection, browser errors or external requests. |
| Website and audit | **32 games / 12 featured** build; selected games have no audit issues or external dependencies. |
| Performance comparison | Nine scenarios across three variants preserve identical gameplay state. The comparison changes only ellipse geometry, pruning and continuous scene interval, using the same final input/physics implementation. |

Built revision: `bb9a6b70148ca101b9312c41ed44fc45aaaa8793a5152f3ad32daf946a427359`. Logs, screenshots, source fingerprints and full measurements accompany this record. No deployment, shared-runtime modification or package publication occurred.

## Performance and limits

The controlled ten-second four-player scenarios use actual Squish frames and compare bytes to model RTC duplicate suppression. The table reports aggregate host upload to the **three remote guests**, excluding the local host and transport overhead.

| Active theme | Original geometry, 60 Hz | Optimized geometry, 60 Hz | Final geometry, 30 Hz |
| --- | ---: | ---: | ---: |
| Classic | 23.57 Mbps | 15.42 Mbps | 7.76 Mbps |
| Halloween | 25.78 Mbps | 18.21 Mbps | 9.20 Mbps |
| Christmas | 33.80 Mbps | 20.26 Mbps | 10.18 Mbps |

The reduction from the first to final variant is **64–70%**. Continuous idle scenes serialize at 30 Hz; active tests average about 30.8–30.9 Hz because gestures update immediately. Static setup emits no repeated scenes. A separate four-second local Chrome RTC sample of the Classic stage-six court measured **7.46 Mbps** in worker wire-byte counters, excluding lower-level transport overhead. These are local diagnostics, not mobile/WAN capacity guarantees. The two declared audio assets total 42,864 bytes.

Physical-phone aiming comfort, natural group difficulty/replay appeal and sustained WAN/TURN upload remain acceptance gates. Keep the hosting tab active during play; a long suspension can discard unprocessed motion even though the real round clock continues. This game saves records/preferences, not partial rounds. Network latency, a constrained uplink and physical device rendering have not been accepted by these checks.

## Reproduce

Use Node 24. Browser scripts accept PLAYWRIGHT_MODULE and CHROME_PATH and need Chrome plus permission to listen on loopback.

```sh
node --test test/games/Swish.test.cjs test/games/SwishLaunch.test.cjs
node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/swish-performance.cjs
node test/swish-browser.cjs
node tools/audit-games.cjs --json
# Build from homegamesio, then return to Core:
node scripts/build-site.js
node test/swish-package-browser.cjs
```
