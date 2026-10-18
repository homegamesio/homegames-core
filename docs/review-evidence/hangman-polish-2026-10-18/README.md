# Hangman polish — October 18, 2026

The description is exactly **Classic hangman**. Joseph Garcia chose to retain optional custom drawing, the original R.I.P / killed-by results and Score / Kills table, and familiar random words and phrases. The original character images, fonts and sounds remain. The random bank retains 492 of its 822 entries, with the retained wording and order preserved; the longest is 37 characters. Custom answers remain available.

## Fixes

- Play and Draw your own are separate choices. The private six-stage editor has Undo, Clear and Use original controls. Continuous touch/mouse movement now draws strokes under Squish 1.5, and release/cancel ends the stroke. Custom drawings appear in solo play and survive choosing Random word.
- Round phases and identity checks replace the queued actions. Accepted answers cancel the entry countdown; stale prompts/results cannot affect another round. Suspended ticks use an absolute deadline, falling back to a random puzzle after 30 seconds.
- Only the current setter can submit through their private input. Guesses require an active guesser, one A–Z letter and a live playing phase. Duplicate guesses, setter guesses and post-result input cannot change scores.
- Answers are limited to 60 printable ASCII characters with at least one letter. Whitespace and curly apostrophes are normalized. Punctuation/digits remain visible, and long answers wrap within the phone canvas.
- Departures remove private UI, drawings and input hooks; setter/last-guesser departures cannot strand a round. Duplicate setup and stale callbacks cannot recreate departed players. Capacity includes people still in the editor.
- Eight scoreboard rows fit on a phone; long names wrap separately from scores. Scores and Next round allow immediate continuation, alongside the existing automatic progression.
- Drawings have hard bounds: 55 points per stroke, 32 strokes and 600 points per stage. Six cumulative stages stay bounded. The catalog thumbnail is a real game capture.

## Verification

| Check | Result |
| --- | --- |
| Focused regressions | **17 passed**: metadata/capacity, private/stale submissions, deadline cancellation/fallback, input validation, score guards, disconnect/replacement cleanup, 200 visitor cycles, serialized guest-answer privacy, actual drawing controls, solo/random art ownership, size bounds, continuous drag and capture release. |
| Existing scope/catalog regressions | **55 passed**. |
| Real-media browser and RTC | Desktop plus 390-pixel touch browser; actual touch strokes, Undo/Clear and all six stages, private phrase entry, keyboard/tap guesses, accepted answer after 31 seconds, win/loss, eight participants and scores, 60-character reveal and guest cleanup. No browser errors or external HTTP requests. Setter and some answer scenarios are explicitly seeded; controls use real input. |
| Built package and offline HTML | Generated website package reaches Ready offline. Solo taps reveal letters; a real RTC guest solves a phrase entered through the UI, including punctuation. Downloaded HTML plays and reloads with networking disabled. No game-state injection. |
| Website and audit | **32 games / 12 featured** build; selected games have no audit issues or external dependencies. |

Final tested website revision: `4689afccd8c1753c9a497fc2edd8aef85c8d2e43b2ebaa7f388d95ec8a86866e`. Logs, source fingerprints and screenshots accompany this record. The package fixture overrides signaling configuration only in memory; it preserves the exact HTTP bytes required by offline-shell integrity checks.

## Performance and remaining acceptance

Declared asset bundle size is **1,592,947 bytes** before transport framing, per joining guest. A four-second eight-participant idle sample sent **zero additional application wire bytes**, confirming that the nominal 60 Hz tick does not continuously broadcast an unchanged scene. This excludes transport keepalives and is not an active-play or WAN capacity estimate.

A synthetic maximum six-stage drawing contains 3,600 points in 192 stroke nodes: roughly **37 KB** serialized drawing data, or **43 KB** for a result with a 60-character answer. Seven remote guests would receive roughly **299 KB** for that complete scene update, excluding assets/transport overhead. It is event-driven, not a 60 Hz continuous stream. Physical phone drawing comfort, group pacing, phrase difficulty and public-network/TURN acceptance remain unverified.

Privacy means the secret is withheld from other players' frames. The browser hosting the game necessarily owns its authoritative answer. This short-round game has no persistent save. No deployment, package publication or shared-runtime change occurred.

## Reproduce

Use Node 24. Browser scripts accept PLAYWRIGHT_MODULE and CHROME_PATH and require Chrome plus permission to listen on loopback.

```sh
node --test test/games/Hangman.test.cjs
node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node test/hangman-launch-browser.cjs
node tools/audit-games.cjs --json
# Build from homegamesio, then return to Core:
node scripts/build-site.js
node test/hangman-package-browser.cjs
```
