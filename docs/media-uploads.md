# Session media uploads

Input Test now exercises images, audio and video using the same game interface in browser/RTC and Core/WebSocket sessions.

## Try it locally

The local `homegames/config.json` and `homegames-core/config.json` use `START_PATH: null`; test games are enabled. Stop and restart the existing Homegames process, open the dashboard, and select Input Test. It offers:

- **Edit text** for the existing text-input check.
- **Upload media** to select an image, audio file or video from the device.
- Separate image/audio/video panels; uploads replace the current item of that kind.
- **Replay audio**, **Replay video** and **Clear media**.

Share the browser session and upload from either the host or guest. Everyone receives the media. Tap the canvas on each device to enable sound if necessary. Prefer short MP4 or WebM clips under 5 MiB; codec support depends on the receiving browser.

## Game interface

Accept `handleFileUpload` in the game constructor. An existing `input: { type: 'file', oninput }` node opens the picker on a player gesture; this helper registers bytes and does not open a picker itself.

```js
constructor({ handleFileUpload }) {
    super();
    this.handleFileUpload = handleFileUpload;
    // Build your file-input node with:
    // input: { type: 'file', oninput: (id, bytes, meta) => this.upload(id, bytes, meta) }
}

async upload(playerId, bytes, meta) {
    const asset = await this.handleFileUpload(playerId, bytes, meta);
    // Already registered for this session. Do not addAsset/getAssets it again.
    this.base.addChild(new GameNode.Asset({
        assetInfo: {
            [asset.key]: {
                pos: { x: 10, y: 30 },
                size: { x: 80, y: 50 },
                startTime: 0
            }
        }
    }));
    this.onStateChange();
}
```

Catch rejected uploads and display an error in the game. Input Test also guards completion after Clear/close and replaces older media nodes. The helper accepts an ArrayBuffer or typed-array view (including Buffer), copies it, checks the active player and size, and identifies media from its signature. `meta` carries `fileName` and `contentType`; these help distinguish audio-only MP4/WebM/Ogg containers. The result is a Squish `Asset` with `.key` and `.info.type` (`image`, `audio` or `video`). Signature detection does not guarantee that a browser can decode its codec.

Images draw in the node rectangle. Audio plays without drawing. Video uses a per-node browser video element and draws its frames into the canvas; the canvas repaints even when no game state changes. Audio/video play once; replacing the node with a fresh node replays the asset. Removing the node stops playback. Video keeps its last frame when it ends. Frozen Studio inspection pauses video and stays silent.

Video can start muted when browser autoplay rules require it. Canvas gestures unlock media sound on that device. Playback clocks are local: a late join starts at the node's `startTime` rather than seeking to the host's current position. There is no shared playback clock or game API for pause, seek, looping or live streams in this version.

## Storage and transport

Uploads are capped at 5 MiB. The picker can shrink oversized images; audio and video are rejected above the cap. The helper applies the cap again. Input still uses base64 JSON; RTC chunks it over the existing reliable data channel. A large transfer can temporarily delay gameplay. Video is an asset bundle entry with type byte `4`, not a live WebRTC media track.

Registered uploads stay in host/session memory and are sent to current players and late joiners. Clear removes scene nodes; it does not evict historical uploaded bytes. Ending the session releases storage and the browser's media players/Blob URLs. Bytes are not stored on the API, persisted to disk, or included in game saves. There is no general file download, progress/cancel interface, transcoding or streaming yet.

## Validation and release

`test/session/MediaUploads.test.js` covers shared file classification/limits, both registration adapters, late joins and video lifecycle/autoplay. `test/media-uploads.cjs` uses real Chrome and Input Test over RTC and Core/WebSocket with PNG, PCM WAV, WebM VP8/Opus and MP4 H.264/AAC fixtures. It checks uploads from both players, video sound, idle-scene canvas animation, late joins, replay, clear and cleanup. The guest has a phone-sized viewport; physical iOS/Android testing remains separate.

The sibling client bundle is rebuilt for local Core. Public QR guests load the website's client, so deploy the staged `/tmp/homegames-media-release` website files using the [existing S3 release instructions](rtc-public-deployment.md). The RTC signaling API needs no changes for media. Update its `CLIENT_BUNDLE_PATH` when releasing updated standalone HTML downloads. If running Core sessions in Docker, rebuild the runner image to include the new child constructor option and shared helper. Current Squish source also encodes declared video assets as type `4`; helper-managed uploads work with the existing local Squish aliases through the shared packet encoder.
