# Showboat

A social improv game for **2–6 players**, built around Homegames live RTC camera and microphone streams. Grab an ordinary object and sell it as an absurd invention: a cat translator, a moon-dust vacuum, an emergency giggle kit. Everyone else guesses its secret purpose.

## Play

Choose **Showboat** in the local game catalog and use **browser Play**. Use the platform's **Share** invitation to bring friends into the same game. Each player uses their own screen so the performer's cue stays private.

To launch it directly from homegames-core:

```sh
START_PATH=./src/games/showboat/index.js START_MODE=browser LINK_ENABLED=false npm start
```

Open the normal Homegames URL (usually `http://localhost:9801`). Camera/microphone capture requires HTTPS except on localhost. Remote invitations use the platform's configured signaling and guest page; those must have the current live-media client deployed. See [RTC deployment](../../../docs/rtc-public-deployment.md).

1. Pick **Same room** or **Remote** in the lobby. Same room is the default: cameras only, with everyone speaking out loud. Remote mode offers camera + microphone or microphone only. Use headphones if remote players are physically near one another.
2. Open **Camera & sound** and enable your device. Approve the platform dialog and browser permissions. Capture stays paused. You can also play in person without a camera, or use an existing call remotely.
3. The host starts. Each player gets two turns. A turn has 20 seconds to prepare, 30 seconds to pitch, 15 seconds to guess, then a 10-second reveal. The performer and host can advance their respective phases early.
4. On your turn, read your private invention and pitch any nearby object as that invention. Do not say the invention's name. Tap **Need a hint?** for an optional explanation. Props are optional; pretending to hold one works too.
5. Tap **Start + go live** to broadcast, or **Start my pitch** to play without capture. If preparation times out, tap **Go live** yourself: timers and permission completion never turn on transmission. **Pause camera** pauses video and sound; **Done** beneath your live stage ends the pitch and lets the audience guess.
6. The audience chooses one of four purposes. A correct guess earns **100 points for the guesser and 100 for the performer**. Applause is free, once per pitch, and does not affect scores. In a two-player match points are shared; larger casts also get an individual leaderboard. Ties share a rank.

There are 24 prompt sets and 96 possible inventions. A match never repeats a prompt set. Late arrivals can watch and applaud, then join the next match. If a performer leaves, the interrupted turn is discarded; if fewer than two original participants remain, the game returns to the lobby. Closing the browser host ends the platform session.

## Media and privacy

Only the current performer can broadcast, only during the pitch. Other sources have disabled tracks. Capture is paused at voting, phase transitions, and performer departure. The stream node stays mounted through applause and late joins, so playback does not restart unnecessarily. **Camera & sound** (or **Camera ready** after setup) remains available during play; choose **Disconnect** to release your device entirely.

Cue cards are scoped to the performer's frame. Every connected player, including late arrivals, retains a private UI root so frameless sessions never fall back to an unfiltered secret frame. Like other browser-hosted games, the host owns the authoritative state; this is a friends game, not an anti-cheat boundary.

Live streams are distributed to the session's RTC participants and are not recorded or uploaded by the game. UI visibility is not a private-media access restriction. Paused capture keeps devices acquired until explicitly disconnected or the session ends. WebSocket-only sessions can play the physical-room game, but live capture requires browser/RTC play.

## Checks

```sh
node testRunner.js ./test/games/ShowboatRules.test.js ./test/games/Showboat.test.js
node test/showboat-browser.cjs
```

The browser test accepts `PLAYWRIGHT_MODULE` and `CHROME_PATH`. It uses isolated local signaling and Chrome's synthetic devices, with native capture and real RTC packets. It checks private cues, audible media in both directions, camera rendering, muted idle devices, guessing/scoring, full match/encore, same-room capture without audio, and shutdown cleanup. It saves desktop and phone-sized screenshots under `/tmp/showboat-*.png`. Real mobile hardware and cellular/TURN connectivity are separate deployment checks.
