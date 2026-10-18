# Live media and the Walkie Talkie POC

Implemented locally on October 3, 2026. No remote services were deployed.

## Try it

Restart Homegames, open the dashboard and choose **Walkie Talkie** from the test games. The local configs still start the dashboard. Choose browser play, share the invitation and join from another device. Use HTTPS for non-localhost microphone/camera access.

Click **Enable microphone** or **Camera + microphone**, confirm in the platform dialog and grant browser permission. Hold **HOLD TO CLAIM PODIUM** or Space to take the single shared stage. Everyone sees the current speaker's camera, or an audio-only indicator, and hears that speaker. Release to silence the source, clear the stage and make the podium available immediately. Touch cancellation, tab blur, device disconnection and leaving also free the podium. A press while occupied does not queue a turn: release and press again after it opens. The host decides which press arrives first.

Pressing the podium button before setup opens microphone permission; after approving, make a new press to broadcast. A listener can tap the canvas to enable sound without granting microphone permission. Microphone/camera sources stay ready with tracks disabled between turns, so claiming again does not repeat permission or connection setup. Only the current speaker has a playback node in the scene. The device-owned **Disconnect microphone / camera** button fully releases capture.

The game supports six players. It is intended for small rooms with the page open; phone background/lock-screen operation is not promised. Real iOS/Android and cellular testing remains separate from the desktop browser tests.

## Developer interface

Browser games receive `media` in the constructor:

```js
constructor({ media }) {
    super();
    this.media = media;
    this.unsubscribeMedia = media.onChange(event => {
        // event.state: 'ready', 'changed', 'ended'
        // event.id, playerId, audio, video, transmitting, pushToTalk
        // Update speaker UI or remove the corresponding node on 'ended'.
    });
}

async enableCamera(playerId) {
    try {
        const stream = await this.media.request(playerId, {
            audio: true,
            video: true,
            transmitting: true,
        });
        this.base.addChild(new GameNode.Stream({
            streamId: stream.id,
            pos: { x: 10, y: 20 },
            size: { x: 40, y: 30 },
            audio: true,
        }));
    } catch (error) {
        // Permission denied/cancelled, missing device, inactive player,
        // unavailable transport or a timed-out request: report in game UI.
    }
}
```

`request(playerId, options)` asks that player's browser to display a platform consent dialog. The player must explicitly confirm; a game cannot silently acquire a device. The promise resolves to a plain handle after capture succeeds. Its stream ID is scoped to the session, not a persistent asset ID. Delivery/decoding on other devices can still be pending, so a receiver may briefly show a loading placeholder.

- `audio`, `video`: booleans; request at least one. One capture is allowed per player at a time.
- `transmitting`: defaults to true; false acquires the source with tracks disabled.
- `pushToTalk`: defaults to false. When true, the client additionally requires a held canvas pointer/touch or Space key before enabling tracks. This local guard prevents a delayed host command from transmitting after release.
- `setTransmitting(streamId, boolean)`: enable/disable transmission of the capture's tracks. It preserves the source so the next press does not reacquire permission.
- `stop(streamId)`: end the source and remove it from peers. A new request is required to restart.
- `onChange(listener)`: subscribe to ready/state/end events; returns an unsubscribe function.

For push-to-talk, request `{ audio: true, video: false, transmitting: false, pushToTalk: true }`. Call `setTransmitting(id, true)` from the game's press handler and false on release. Walkie Talkie uses both `offClick`/`handleMouseUp` and Space handlers. The platform independently silences capture on pointer/key release, touch cancellation, input detach, blur or page hiding. Permission completion after cancellation/session exit immediately stops the late tracks.

`GameNode.Stream` uses normal percentage positions/sizes. Audio-only sources need no rectangle. `audio: false` disables sound for that node. Own-source playback is always muted to avoid local feedback. Preserve the node ID when only speaker status changes so its player remains mounted. Removing a node ends that node's playback, while `media.stop()` ends the capture itself; player/session teardown ends both.

This first version distributes sources to **all current RTC participants**, excluding the source from network echo, and to late joiners. `playerIds` and node visibility only control presentation; they are not media access restrictions. Do not use hidden nodes for private voice channels. Streams are not recorded, saved or uploaded to the API, and a late join gets current live media without earlier history.

## Runtime design

### Recorded clips (Pitch Pot)

Live streams above still have no history. A separate `media.record(playerId,
{ durationSeconds: 30, prompt: 'Your object' })` request now records locally on the
player's device, without publishing live tracks. The platform shows consent,
preview, the idea, a Record button, a three-second countdown and a recording timer.
It stops automatically and sends the completed file through the reliable RTC data
channel. The promise returns `{ bytes, meta, durationSeconds }`; the game registers
it with `handleFileUpload` when ready to share it. `media.cancelRecording(playerId)`
cancels and releases the device. Permission failures, cancellation, hiding the page,
disconnects and session teardown all reject pending requests and release capture.

Recordings are 1–30 seconds and capped at 5 MiB; `maxBytes` can request a smaller
budget. Pitch Pot uses 2 MiB and a per-player upload slot, so new rounds replace
old clips and late joins stay within the transport's queue budget.
The recorder asks for 640×360 video
and a modest bitrate, prefers VP8/Opus WebM, and falls back to supported MP4/WebM.
Actual codec and capture availability depend on the browser. Recordings need the
updated Homegames client on each device. Registered clips have the same
session-memory retention and per-device playback clocks as ordinary media uploads.

`media.record` also works through the current Core/WebSocket media endpoint; live
`media.request` tracks still require browser/automatic-RTC play. Isolated HTML
games and Studio previews use the trusted parent adapter's recording UI.
Manual pairing does not provide a recording endpoint.

Pitch Pot additionally saves original clip bytes through `createExport(name,
bytes)`. The shared **View exports** control previews and downloads those files
for any joined player. They persist separately from replaceable playback slots
and travel with game ZIP/HTML downloads and RTC game copies. They are visible to
the room as soon as saved, even before screening. Export limits are 128 files,
16 MiB per file and 64 MiB total; a persistence failure is shown without stopping
the current round's playback.

`src/games/pitch-pot` uses this for private idea assignments, 30-second pitches,
credited screenings and voting. `test/session/Recording.test.js` checks ownership,
limits and cleanup; `test/games/PitchPot.test.js` checks game rules and frame privacy;
`test/pitch-pot-browser.cjs` exercises native recording and clip playback over RTC.

`homegames-common/media-session.js` owns the game-facing service, membership, permission request lifetime, stream handles and state notifications. `homegames-client/src/media-client.js` owns device consent, native capture, immediate release guards and each browser's stream registry.

`GameNode.Stream` is native to Squish 1.4.6 (declare `squishVersion: '146'`). It has an explicit stream field with an ID, position, size and audio flag. Clients resolve the ID against the session media registry; streams do not masquerade as assets or put media bytes into asset bundles. Older Squish codecs do not support Stream nodes.

RTC peer connections now accept native tracks and renegotiate when sources change. The host forwards guest tracks to the other peers; the API still relays only connection signaling/discovery. Existing STUN/TURN configuration applies. Game/control messages stay in the existing communication worker; native media transport and codecs are handled by the browser's WebRTC engine, not chunked through the game's data channel. Peer negotiation/capture and rendering remain on Window.

**Core/WebSocket-only sessions do not stream media in this version.** They receive the same service shape, but `request()` rejects with a browser/RTC requirement. Existing game play and uploaded-file assets still work over WebSocket. The publish validator also receives the service so a media-aware game can initialize without trying to capture from Node.

## Checks and release

- `test/rtc-media.cjs`: real Chrome, synthetic native microphone/camera devices, real RTC media packets and measured received audio. Checks guest-to-host/guest forwarding, silence on release, own-source mute, camera rendering, late joins, simultaneous publishers, channel contention, touch cancellation, denial/cancellation, explicit disconnect and host shutdown.
- `test/session/LiveMedia.test.js`: owner validation, late joins, pending-request cleanup, existing Squish wire formats, capture resolving after cancellation, delayed transmit commands and page hiding.
- `test/session/WalkieTalkie.test.js`: exclusive podium claims, one shared playback node, stable playback through late joins, busy holds without queuing, mixed mouse/keyboard releases, permission completion and disconnect handoff.
- `test/QuickPointerInput.test.js`: includes rapid consecutive physical presses; a prior repeat throttle must not swallow a new hold.
- Existing session and website RTC acceptance cover game input, uploads, saves, lifecycle, sharing and discovery.

The client bundle is rebuilt locally. Public QR guests need the new website client; stage with `node scripts/prepare-rtc-site.js /tmp/homegames-live-media-release` from `homegamesio`, then use the [S3 release guide](rtc-public-deployment.md). Refresh/reopen hosts and guests after deployment. The signaling API needs no protocol changes. Update the API's `CLIENT_BUNDLE_PATH` when releasing new downloaded HTML. Rebuild the runner image before publishing media-aware games through the Docker validator; it contains the shared service and validator constructor changes.
