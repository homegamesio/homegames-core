# Homegames Backstage

A playable field guide to Homegames. Build a little toy, explore eight hands-on
stations, and bring it to life in a 30-second spark-catching finale. Every player
gets an independent workshop screen; up to six people can explore together.
The game appears in the regular Core catalog as **Homegames Backstage**.

Start with the drawing desk, or open any station from the workshop. Each one has
a small challenge, an earned stamp, and a **How it works** view with API examples
and pointers to the actual implementation. There are no progression locks.
The finale works immediately, including without a camera, microphone or friend.

| Station | Play with | Implementation |
| --- | --- | --- |
| Shapes & scenes | Shape, color, size, glow and a layered robot | Regular `Game`, `getLayers`, `GameNode.Shape` / `Text`, children, `effects.shadow`; `ui.js` |
| Inputs | Rename the toy, steer it into a socket, drag a plug into its dock | Text input, click/touch, hover, drag/release, keyboard press/release, normalized analog controller input; `renderInputs` |
| Time & sound | Catch three beats, pause, change speed | A 20 Hz simulation, stable moving nodes, bundled WAV playback; `tick`, `renderRhythm`, `sound` |
| Worlds & cameras | Find three beacons, pan and zoom independently | A real `ViewableGame` composed inside the regular game; `getPlane`, `ViewUtils.getView`, an inset view and fixed HUD; `lookout.js` |
| Multiplayer | Read a private symbol and send a shared signal | Join/leave, private `playerIds` roots, actor checks, shared state, bounded seats and an explicitly labeled solo bot; `renderTogether` |
| Files & assets | Play bundled media or upload an image, audio file or video | Local `Asset` declarations, file inputs, `handleFileUpload`, bounded replacement slots, `GameNode.Asset`; `renderFiles`, `upload` |
| Streams & recording | Broadcast camera/microphone or record a three-second clip | Opt-in `media.request`, `GameNode.Stream`, `media.stop`, `media.record`, cancellation and late-completion guards; `renderLive`, `capture`, `record` |
| Saves & exports | Save/restore a checkpoint and export the toy | `saveGame` / `saveData`, `createExport` / `userExports`, JSON design, text passport and SVG postcard; `checkpoint`, `restore`, `exportToy` |

These are the platform's main authoring and player-service families. This tour
does not claim to demonstrate every renderer option or every built-in game's
mechanic. Pointer-lock aiming, custom cursors, sprite atlases, specialized 3D
projection and full physics simulations remain deeper examples elsewhere in
Core. This game needs no remote images, accounts or APIs to run solo.

## Playing together and using media

Use **Share** in the Homegames player menu and open the invitation on another
screen. Players choose stations independently. Two players can send their own
private symbols at station five; a solo player can ask the clearly labeled helper
to answer. Nobody has to wait for the room to move to the next station.

Live camera/microphone requires a host that supports browser RTC media and a
secure page (HTTPS or localhost). The platform asks for consent; permission denial
or unavailable services produces a message in the game. Leaving the broadcast
station, opening its code view, disconnecting or closing ends the owned stream
and cancels recording. Capture that resolves after departure is stopped too.
Stream presentation in the booth is shared. `playerIds` is **not** a media access
restriction: RTC participants can receive streams even when viewing other stations.

The **No-device route** marks the station explored without claiming a media stamp.
It never blocks finishing the tour. Recorded clips and uploaded files use session
assets, not live streams. They are not automatically saved or included in copies.
Playback uses each device's local clock. Keep uploaded media below 5 MiB; the
three-second recorder uses a 2 MiB limit. Actual media codecs depend on the browser.

## Keeping the toy

**Save checkpoint** stores the current player's design, earned stamps and visited
stations in the session's shared save slot. **Restore checkpoint** explicitly
restores that snapshot. The last successful save supplies the next session's
initial design and progress; saving again replaces that checkpoint.

**Export toy + passport** writes three room-visible files with fixed names:

- `backstage-design.json`: the current toy's name, shape, color, size and glow.
- `backstage-passport.txt`: earned and explored stations, plus copy instructions.
- `backstage-postcard.svg`: a downloadable illustration of the toy.

Open **View exports** in the player menu to get these files. A subsequent export
replaces those three files for the room; it does not alter the save checkpoint.
Save once, then export, to earn the last stamp. Save again afterward to checkpoint
that final stamp as well.

The platform's **Download game ZIP**, **Download game HTML** and **Share a copy**
include the source, bundled assets and user exports. A fresh copy starts with the
exported design and a new tour; a valid existing save takes precedence. ZIPs can
be opened in Studio, and standalone HTML can play offline. No gameplay, media
capture or export operation requires editing platform code.

## Source tour and validation

`index.js` contains game orchestration, station interactions and platform services.
`lessons.js` contains the concise teaching text. `ui.js` contains scene primitives
and the toy. `lookout.js` is the ViewableGame experiment. Assets are original
procedural art/audio; regenerate them with `node tools/backstage-assets.cjs` from
Core. The thumbnail is an actual Homegames canvas screenshot.

The tour draws on Studio's square/click/move/drag/sound/together examples and
scroll/glow/text/image templates, plus Core's `shape-test`, `move-test`,
`animation-test`, `draw`, `defuse`, `engine-room`, `input-test`, `walkie-talkie`,
`pitch-pot`, `savegame_demo` and the portable creation games.

Run `node --test test/games/Backstage.test.cjs` from Core for gameplay, private
wire-frame visibility, callback ownership, camera isolation, stale media cleanup,
persistence failures and portable export round trips. `test/backstage-browser.cjs`
uses Playwright with Chrome and fake media devices for real canvas controls,
two-player RTC, native capture/recording, exports and cold offline HTML with touch.
Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` when these are not on the default paths.
Use Node 20+ for current Playwright. `BACKSTAGE_SMOKE=1` captures every station and
code view in `/tmp/homegames-backstage` for layout inspection.
