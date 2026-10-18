# House Band polish — October 18, 2026

The catalog description is Joseph Garcia's **Make music by yourself or with friends**. Joseph chose independent sound on each device instead of the previous single-speaker restriction. This completes the local implementation/review pass for the twelve featured games, not physical-device, audience or production acceptance.

## Changes

- The first device starts with sound enabled; joining devices opt in with **SOUND ON / SOUND OFF**. M toggles local sound. Everyone can hear the shared arrangement and auditions without stealing audio from another participant. Shared track mutes still change the composition. Sound preferences remain connection-local rather than traveling in the song.
- Active voices are explicitly scoped to opted-in participants. Muting or disconnecting removes only that participant. Voices with no remaining listener are retired: an empty Squish scope would otherwise broadcast them. Reused seats do not inherit a departed listener. The loop stops when the room empties, not when one musician leaves.
- A permanent private input surface holds a gesture while its controls rebuild. Held buttons trigger once; FX dragging remains continuous. Cancelled gestures, late releases, keyboard transitions, stale view callbacks and foreign-seat controls cannot cause unintended edits. Unknown keys, invalid seats, invalid pitch and invalid tempo inputs are bounded/rejected.
- Clear requires two distinct presses. An intervening arrangement edit cancels confirmation. Existing personal, revision-aware Undo continues to preserve later edits by others, including ABA edits.
- Existing arrangement saves, portable JSON and WAV export remain. Export captures an immutable arrangement at the action, so later edits cannot change a pending recording. Late work after close cannot restart playback or emit a WAV. Old save completions cannot hide a newer failure.
- Idle sessions stop emitting frames after notes/meters settle. Sound uses a bounded 48-voice pool. Meter geometry, small circles and unused drum labels are reduced; active note scheduling stays at 60 Hz and meter redraw remains capped at 30 Hz. Clock rollback no longer counts elapsed time twice.
- The room shows all eight participants in two columns. Phone text bounds were checked and captures inspected. The thumbnail is a real 960×600 portable-client screenshot. README controls now match the current Invite/More toolbar and per-device sound behavior.

## Verification

| Check | Result and scope |
| --- | --- |
| House Band tests | **19 passed**: sequencer timing, save normalization, deterministic WAV duration/mix, portable round trip, shared edits/undo, input cancellation/holding, two-press clear, ownership/capacity, old-write failure ordering, immutable WAV snapshots, close behavior, idle frames and actual serialized audio filtering for all eight seats. |
| Shared scope/catalog tests | **55 passed**. **74 targeted checks total**, not a full Core-suite result. |
| Real local RTC browsers | Eight connected participants opt into audible PCM playback; host and guest mute independently. Real touch edits, names, separate tabs, FX dragging, guest departures, public WAV preview/download and edited ZIP export pass. The edited HTML copy plays with browser networking disabled. No game-state or clock injection. |
| Website package and offline HTML | Ordinary touch edit, audio playback, keyboard pause after toolbar use, public save download, exact arrangement restoration, paused reload and a fresh downloaded HTML copy all pass. The fresh copy restores its embedded arrangement; its first edit creates a local save. No storage or game hooks. |
| Layout | Desktop and phone drum/bass/FX/room captures, eight-person roster and actual glyph bounds. Browser emulation is not physical-device acceptance. |
| Build/audit | **33 games / 12 featured**, no selected-game audit issues. `build-identity.json` verifies the packaged source/media and tested catalog revision. |

Browser test maintenance corrected obsolete toolbar labels, a seven-guest toggle parity assertion, a click immediately after a viewport resize, and an attempt to download a local save before a fresh offline copy had made its first edit. The source game passed the final full RTC/export run; the website/offline run independently covers the final package. Public toolbar clicks use 100 ms presses, as in the existing launch acceptance scripts.

## Performance and limits

The installed Common/Squish diagnostic runs a synthetic 60 Hz clock for five measured seconds after one warmup second, across one/two/eight participants on the starting drum/bass/FX stations. All opt into sound. It counts changed full private frames, excluding asset startup and transport overhead. The eight-person case has **749 total scene records**, a maximum **8,766-byte private frame**, and models about **12.5 Mbps of browser-host upload to seven guests**. Desktop tick/serialization/private-frame p95 is about **2.6 ms** in that run. Idle cases emit **zero repeated frames**. These are desktop diagnostics, not EC2 capacity or measured WAN throughput.

The game ZIP is approximately **83 KiB**. The host synthesizes 72 short sound variants locally (about **2.18 MiB** of PCM WAV assets before protocol overhead), which guests receive once. Audio follows received scene timing; this work does not provide synchronized playback across separate devices or a recording-workstation timing guarantee. Use one speaker in the same room. Physical phones, sustained jams, slower links/TURN and human enjoyment remain acceptance gates.

The candidate site still uses the **unpublished Client touch-focus fix** from the Fleetfall pass via `HOMEGAMES_CLIENT_BUNDLE`. Client 0.2.0 remains the published dependency. Publish the updated Client, pin consumers and rebuild final artifacts before release acceptance. No packages were published, no production services were changed, and no commit was made.

## Reproduce

Use Node 24, Playwright and Chrome. Browser scripts require loopback access and accept `PLAYWRIGHT_MODULE` and `CHROME_PATH`.

```sh
node --test test/games/HouseBand.test.cjs test/games/HouseBandLaunch.test.cjs
node testRunner.js ./test/session/ScopedFrames.test.js ./test/games/CatalogConsolidation.test.js
node tools/house-band-performance.cjs
node tools/audit-games.cjs --json
HOMEGAMES_TEST_CLIENT_BUNDLE=/absolute/path/to/homegames-client/dist/homegames-client.js node test/house-band-browser.cjs
# From homegamesio:
HOMEGAMES_CLIENT_BUNDLE=/absolute/path/to/homegames-client/dist/homegames-client.js node scripts/build-site.js
# From Core:
node test/house-band-package-browser.cjs
```
