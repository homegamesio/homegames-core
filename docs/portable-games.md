# Portable games — project format and local Studio

> The authored format and integrity sections below describe the metadata-first
> format-2 contract as of October 17, 2026; format-1 packages remain readable.
> Earlier implementation checkpoints and validation results are retained with their
> original scope. For the current game contract, use the [authoring guide](../../homegames-common/docs/homegames-context.md);
> for current verification and open release gates, use the [launch plan](launch-readiness-review-2026-10-17.md).
> Static catalog, Node package integration, RTC copy, isolated execution and workspace
> backup flows now exist. Historical backend and next-milestone notes below are not
> the current deployment state or launch checklist.

Homegames' portable product is an HTML file containing a game, its media, and
the browser runtime. Open it locally to play; Share displays the existing QR
invitation and starts an unlisted RTC session. The host tab runs the simulation.
Guests receive their scene and media through RTC. Download project ZIP yields
an ordinary `.zip` file containing source, media, license, and inventory. Open it
with any ZIP utility to inspect or extract the files; no special extension is needed.

Studio now uses browser projects and local snapshots, with account entry points
and hosted content transports commented out for rollback. Backend endpoints and
existing account data are retained. This does not change certificate issuance,
homegames.link or RTC signaling. No production service has been deployed or shut
down to test this milestone.

## Try it

From `homegames-client`, run `npm run build`. From `homegames-core`:

```sh
mkdir -p portable-preview
node tools/portable-game.cjs check test/fixtures/portable-sound
node tools/portable-game.cjs pack test/fixtures/portable-sound portable-preview/pocket-chime.zip
node tools/portable-game.cjs unpack portable-preview/pocket-chime.zip portable-preview/restored
node tools/portable-game.cjs html portable-preview/restored portable-preview/pocket-chime.html --trusted
```

Open `portable-preview/pocket-chime.html` in your browser, click the canvas to
hear a chime, then Share to display a QR code. The default invitation uses the
existing `wss://api.homegames.io/rtc` and `https://homegames.io/play.html`.
Connectivity still depends on that deployment's ICE/TURN configuration. Local
play needs no network. Manual pairing below bypasses signaling when it is down;
all multiplayer modes need the host to stay open and reachable.

Each output must be a new file/directory. Choose another name to repeat these
commands. Import validates into a private staging directory and verifies the
written bytes before making the restored directory visible. Existing work is
never replaced by these commands. `check` also accepts an archive filename.

`--trusted` is required to generate executable HTML. Use reviewed projects only.
Import and inspection do not evaluate game code. The trusted loader is **not a
sandbox**. The browser Studio checkpoint below wraps execution in an isolated
frame; this CLI builder remains a separate explicit-trust path. An HTML game is
executable content, just like the current standalone download.

## Browser Studio checkpoint

`homegamesio/studio.html` now uses its existing editor, file tree, tabs, preview
panel and asset tools for browser projects. Build `homegames-client`, serve
`homegamesio/app.js` on localhost or HTTPS, and choose **New game** or **Import ZIP**
in My Games. The previous `/studio-local.html` page redirects here; its library
uses the same IndexedDB database, so existing imports remain available. The old
page source is retained in a comment. No account/content API is called for local
projects. Share uses the existing public signaling/player; Manual connection can
pair through a private exchange of handshake text instead.

- Import a valid ZIP, or choose New game to pick from all ten built-in templates
  plus Pocket Chime. Every new template copy gets fresh local and game IDs. Each
  ZIP import gets a fresh installation ID while preserving its package game ID.
- Edit text, add files, and replace binary image/audio bytes. The library label
  is separate from the game's source metadata name. Source asset references stay
  relative; uploaded files are not automatically inserted into metadata.
- Drafts auto-save after a short debounce, and Save locally flushes pending changes.
  Invalid source is saved too. Play and export validate separately. IndexedDB
  writes files and library metadata atomically. A generation comparison inside
  the transaction prevents lost updates across tabs; the conflict UI offers a
  new copy or an explicitly confirmed reload. Failed writes never fall back to
  claiming a memory-only save succeeded. Unflushed edits trigger an unload prompt.
- **Versions → Save snapshot** creates a named, immutable copy of all source and
  binary assets. Snapshot names are optional. **Open snapshot** is read-only;
  Play/export use that selected version, while **Current draft** reopens ongoing
  edits. **Restore snapshot** first saves a backup of the current draft, then
  restores the selected source/assets/library name atomically. Generation checks
  and transaction rollback also apply to snapshots. Schema version 2 preserves
  existing version 1 drafts. History is browser-local and is not included in a
  project ZIP or playable HTML; export a selected version for a portable backup.
- The existing Assets modal lists project media. Upload, drawing, recording, and
  keyboard/layer/song saves write files into `assets/`; the keyboard's audio
  picker reads the project's bytes. These tools do not upload to the content API.
- Export ZIP for a project backup or playable HTML for independent local play.
  Browser storage can still be cleared; persistent-storage permission is optional.

`homegames-common/portable-html.js` builds an opaque-origin `sandbox="allow-scripts"`
frame for both preview and the new HTML export. Authored JavaScript executes only
inside that frame. It has no same-origin, popup, navigation, download or storage
permissions and no parent message handler that can read/write projects. The frame's
CSP restricts ordinary network loads to the configured signaling endpoint and
embedded media/worker data. WebRTC remains available for multiplayer. This boundary
protects the Studio origin; it is not a CPU/memory execution limit, a code-safety
certification, or a guarantee against all RTC/network communication. See the
[browser sandbox contract](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox).

The package loader's explicit `trusted:true` is used only inside the opaque
frame. The existing CLI `html --trusted` builder is retained alongside this new
browser builder. Studio never executes imported code in its own origin. The
opaque player now uses a MessagePort bound to its embedding frame and local
installation. It can load/save only that game's progress, not source or other
projects. See the save contract below.

Remaining work includes the scene inspector/second simulated preview player for
isolated games, general legacy conversion,
offline site-shell caching, and self-hosted library integration. Studio account
entry points and content/upload transports are commented out; hosted settings,
publishing and AI entry points are inactive. Old hosted links explain ZIP import
instead of requiring login. API endpoints/data remain untouched. Certificate behavior is unchanged. No
production deployment is part of this checkpoint.

`test/studio-local-browser.cjs` tests the real local site and Chrome: import without
execution; syntax-error recovery after refresh; text and binary edits; play and
RTC guest image/audio/input; offline HTML; ZIP re-import; new starter identity;
concurrent-tab conflicts; quota failure; and attempts by game code to access the
parent DOM, cookies, localStorage, IndexedDB, network and a forged write message.
Run it with the same Node 20+/Playwright/Chrome environment as the portable browser
test. The website's existing `npm test` route/catalog/download checks also apply.
`test/studio-snapshots-browser.cjs` checks version 1 database migration, named
snapshots, exact media/source bytes, read-only historical exports, restoring with
a backup, syntax-error snapshots, failed-transaction rollback, stale-tab restore
conflicts, mobile history and retired account entry points.

## Built-in templates

The ten original templates and Pocket Chime are now authored under
`homegamesio/templates/`, with `catalog.json` supplying their labels/descriptions.
Each folder has a manifest, source, license and any authored media. Run
`node homegamesio/scripts/build-studio-templates.js` from the parent directory to
validate and generate `studio-templates.json` plus content-hashed ZIPs under
`studio-templates/`. `prepare-rtc-site.js` does this automatically before staging.
The build never contacts the API or database. Browser creation fetches only these
static files, verifies the advertised revision, and creates an independent copy.

Scrolling World's existing hosted PNG is bundled byte-for-byte as
`assets/fella.png`, referenced by a project-relative path. Image Upload now uses
`handleFileUpload`, so a player-chosen image is registered locally and sent to
current/late RTC players. Images chosen during play belong to that session;
Studio's Assets tools save authored media into the project and its exports.

**Recover previous draft** appears when the old `hg-guest-draft` slot exists.
Recovery saves a new local project and keeps the original localStorage copy.
Unchanged starter source is upgraded to the portable template. Edited source,
including incomplete code, is preserved; the known scrolling-image reference is
converted to the bundled path. Modified legacy dynamic-asset code or unknown
hosted IDs may still need manual changes before play/export; validation reports
that without discarding the draft. This is not a general conversion of hosted
account projects or their asset databases.

`test/studio-templates-browser.cjs` exercises all templates through the real
Studio UI with external content/account requests blocked, fresh copy identities,
source save/reopen, exact scrolling-image ZIP bytes and offline HTML, image upload
over RTC, previous-draft recovery and the mobile picker. The existing account
API template definitions remain available for legacy API clients.

## Manual RTC pairing during outages

The **Manual connection** button is available in the isolated Studio preview,
new playable HTML exports (both browser and CLI), and the website player. Both
people must already have a player open or have a downloaded HTML file. Sending
the HTML to your friend works even when homegames.io itself cannot load.

1. Host: keep the game running, open Manual connection, choose **Create offer**,
   then send the entire text privately to the friend.
2. Friend: open their downloaded HTML, paste into **Offer from host**, choose
   **Create answer**, and send the entire answer back. Joining stops their local
   game and switches to rendering the host's game.
3. Host: paste into **Answer from friend** and choose **Connect with answer**.
   Both people choose Done and play. Make a new offer for each additional friend.

Offers/answers contain gathered ICE candidates and the DTLS fingerprint. There
is no incremental candidate exchange, room registration, or Homegames signaling
request in this path. Pending offers expire after ten minutes; Cancel offer and
Create offer let the host retry without disconnecting existing players. Treat
handshake text as a private invitation; it includes network address information.

Public Google STUN is enabled by default to discover internet addresses, so this
mode does not depend on any Homegames service. The checkbox can disable STUN for
LAN-only pairing. It does **not** guarantee connection across every NAT/firewall:
some networks need a reachable TURN relay. No TURN service is configured in this
UI. Directly connected peers do not need signaling to keep playing. A closed
host ends the session; the offer/answer exchange must be repeated to reconnect.

Manual RTC reuses the existing bounded data-channel protocol (scene frames,
assets, player input). It does not transfer editable source or persist a copy of
the host's game; use the ZIP/HTML downloads for that. Live camera/microphone
streams are not supported in manual mode. HTTPS certificates for optional
self-hosted WebSocket servers are unaffected.

`test/rtc-manual-browser.cjs` opens two downloaded HTMLs with all HTTP and
WebSocket requests blocked, exchanges offers/answers through the UI, verifies
remote image/audio/input and host shutdown, and checks invalid/wrong answers and
cancel/retry. It asserts zero HTTP/signaling attempts. Set `RTC_MANUAL_NO_STUN=1`
to exercise the LAN-only setting in an environment that permits local ICE.

## Authored files

```text
index.js
lib/message.js
assets/tile.png
assets/chime.wav
LICENSE.md
ATTRIBUTION.txt
```

New projects declare their identity and capacity once, in the exported class's
static metadata in `index.js`:

```js
const { Game, Asset } = require('squish-150');
class MyGame extends Game {
    static metadata() {
        return {
            gameId: '701f4c12-d208-4614-9e7d-9d2a8f326e95', // Generate once; preserve for updates.
            name: 'My Game',
            maxPlayers: 1,
            saveSchemaVersion: 1, // Optional; defaults to 1.
            assets: {
                tile: new Asset({ path: './assets/tile.png', type: 'image' }),
                chime: new Asset({ path: './assets/chime.wav', type: 'audio' })
            }
        };
    }
    // Build the scene and implement getLayers(); see the authoring guide.
}
module.exports = MyGame;
```

The shared AST parser reads static metadata without executing code and infers the
runtime from the supported Squish import. It synthesizes `project.manifest` with
`formatVersion: 2`, game ID, `entry: 'index.js'`, runtime and save schema. New games
do not author a manifest, a duplicate `squishVersion` or a `services` declaration.
`maxPlayers` is an explicit integer from 1 to 255; `1` is solo and greater values imply
multiplayer capability, not a minimum player requirement. Automatic RTC currently
caps a room at 17 participants including the host.

Browser runtimes currently bundled are **142, 143, 145 and 146**. Missing,
conflicting or unavailable runtime imports fail; validation never substitutes a
version. Metadata accepts literals/top-level literal constants, not computed code.

Older format-1 `homegame.json` packages remain readable, preserving their custom
entry paths, game IDs, save schemas and exact byte-derived revisions. Empty or
`['multiplayer']` legacy service declarations and omitted legacy capacity (64)
remain compatibility inputs. Server-dependent services such as `contentGenerator`
are unsupported. An intentional v1 conversion copies the existing identity/schema
into metadata, declares capacity, moves a custom entry to `index.js` while fixing
relative imports, and removes duplicates; it creates a new source revision. Import
or simple ZIP repacking never performs that migration automatically.

Asset paths are relative to the project root. Module `require('./helper')`
remains relative to its source file; root escapes and external modules fail.
Only the pinned Squish module and project JavaScript/JSON modules may be required.
Authored file assets use literal metadata declarations. Generated `Asset(info, bytes)`
values can use `getAssets()` or `addAsset`; file-based assets must declare their
paths. Raster images, safe static SVG, fonts, audio and video are supported. There
is no hosted-ID or network dependency fallback. Session-wide assets are not made
private by putting a reference under a scoped scene node.
Authored video admission now reuses the existing video asset bundle/renderer, with
no new wire format. Playback and codec support remain browser-dependent; one
visible video node owns one decoder and clips do not loop automatically. The
After Hours game uses one node per visible monitor and timed node replacement.

Session uploads through the runtime-provided `handleFileUpload` remain supported
without adding authored asset declarations or writing back into the project.
Raster image, audio and video signatures are checked; browser decoding determines
whether a media encoding is playable on that browser.

The package loader wraps the installed runtime's Asset class for that project.
`getData()` returns local bytes. No released Squish package is edited, no global
Asset prototype is patched, and no asset ID/API fallback exists on this path.
Both the browser LocalSession and a Node Squisher can consume these assets.
Core's host-only library import path accepts portable packages. Keep local asset
paths inside the project and rebuild consumer packages when changing the loader.

## Format and integrity

Project archives use `.zip`. Earlier `.homegame` exports remain readable because
import checks their contents rather than the extension. ZIP timestamps, entry order,
and compression do not affect the revision. Store and Deflate compression are
accepted; encrypted, split-volume, ZIP64, and symlink entries are rejected.
Canonical filenames use ASCII letters, digits, underscores, hyphens, dots,
spaces within path segments, and forward slashes. Leading `./` is allowed only
in authored asset references. Absolute paths, traversal, case collisions,
reserved device names, percent encoding, backslashes, and ambiguous names fail.
Directory entries are omitted from archives: files imply their directories.

Limits: 512 authored files, 16 MiB per file, 64 MiB total, 1 MiB per JavaScript
file, and 65 MiB per archive. Each asset record, including its 44-byte Squish
header, must fit 10 MiB; larger collections use multiple bounded packets. These
conservative bounds keep the implementation from accepting
unbounded in-memory extraction. It is not a streaming workspace-backup format.

Export generates `.homegame/inventory.json` with `formatVersion`, `revision`,
and `files`. The inventory is excluded from its own file list. All other archive
members must match the listed files exactly; no extra payload files are accepted.
Each file record contains `path`, `byteLength`, `mediaType`, and lowercase hex
`sha256`. The file list is sorted by canonical path using JavaScript's default
ASCII string order.

Revision algorithm:

1. SHA-256 each authored file's exact bytes. For a v1 project this includes its
   original `homegame.json` bytes; a v2 project has no authored manifest.
2. Construct `{ manifest: projectDescriptor, files: sortedFileRecords }`, using the
   parsed v1 manifest or synthesized v2 descriptor as appropriate.
3. Recursively sort every object's keys; preserve array order. Serialize with
   `JSON.stringify` (no indentation), encode as UTF-8, then SHA-256.
4. Store the lowercase hexadecimal digest as `revision`.

Thus ZIP repacking changes nothing, while changed source, media, attribution,
or (for v1) authored manifest bytes change the revision. The committed fixture and
`test/portable-project.test.cjs` provide executable byte/digest checks. Hashes
detect corruption; they do not establish author identity or code safety.

The retained format-1 fixture revision is
`d298f78bdb6aefe944047ab0b062efa2ce89fd190ffa6ff20031be8e8ecbf558`.

The package reader exposes `listFiles`, `readFile`, and `stat`. Reads return
copies of immutable snapshot bytes. Runtime asset identities include the package
revision and path, so identical filenames in different packages remain separate.
No Blob URL is written into source, archives, or RTC payloads.

The portable game ID is not a storage permission. The trusted embedding creates
a separate local installation ID for saves. Each generated HTML gets its own
installation ID; repeated exports currently create separate save slots. Saves
and history are not included in project ZIP copies. Use **Download save** and
**Load save** to move progress explicitly between installations of the same game.

### Portable progress (October 10, 2026)

Games retain the existing constructor contract: `saveData` and asynchronous
`saveGame(data)`. Only games that implement this contract persist progress; source
autosaves do not capture arbitrary runtime state. The parent keeps progress in
the separate `homegames-portable-saves` IndexedDB database, keyed by installation
and `save-schema:N`, with `N` from `metadata().saveSchemaVersion` (default `1`)
or the retained v1 manifest. Project snapshots never roll back progress automatically.

The parent chooses identity/schema; the iframe can request only get/put over its
private port. JSON is capped at 1 MiB of UTF-8. Successful `saveGame` promises mean
the IndexedDB transaction completed. Portable writes cross the iframe boundary
immediately, so Stop/restart can drain requests and the game's synchronous close
hook before removing the frame. Other local/hosted backends retain their debounce.
Abrupt browser/process termination cannot guarantee unacknowledged writes.

Existing schema slots remain available. A new schema starts fresh unless metadata
declares e.g. `saveCompatibility: ['save-schema:1']`. The game's next save writes
the current schema. Concurrent hosts use a generation check: a stale tab cannot
overwrite newer progress. Storage/quota failures reject writes and remain visible;
session data can still be downloaded as a JSON backup. Browser storage clearing or
eviction removes progress, so keep backups. Files moved or opened in a different
browser may use a different storage context; Load save provides explicit recovery.

Downloaded HTML and Studio both expose Download save/Load save. Import validates
the game ID and compatible schema before replacing progress and restarting.
ZIPs contain source/media only. A copied or re-exported project starts with its
own save slot; importing a save is an explicit choice.

`test/portable-saves-browser.cjs` checks real Chrome IndexedDB, file-URL restore,
Studio Stop/restart and close-hook flush, cross-tab conflicts, UTF-8 size limits,
schema fallback, isolated installations, quota failure recovery and backup import.
Safari/iOS, browser eviction and abrupt OS shutdown have not been tested here.

## Historical dependency inventory and migration sequence

| Current location | Existing dependency | Migration direction |
| --- | --- | --- |
| `homegamesio/studio.js` guest drafts | localStorage, API templates | Durable browser project library and static templates |
| Studio file saves and versions | API, Forgejo, accounts | Local revisions and export/restore |
| Studio preview asset extraction | API IDs and `/assets/:id` | Shared portable reader and project media tools |
| `squish/src/Asset.js` legacy loading | API downloads and ID cache | Preserve legacy source; package-scoped adapter for new projects |
| `homegames-common/local-play.js` download builder | Source plus prebuilt asset bytes supplied by API | New portable HTML builder now available alongside it |
| `homegames-client` LocalSession / renderer / RTC | Existing scene and media protocol | Reused by portable exports |
| `homegames-client/src/game-loader.js` | Same-page source evaluation | Isolated execution before arbitrary Studio imports run |
| `api/index.js`, common RTC signaling | In-memory rooms; catalog lookup for published rooms | Retain private invitations; disentangle hosted catalog later |
| core cert manager, API, worker | DNS/ACME, certificate records, queue | Retain HTTPS; separate operational services from content/account services |
| `homegames.link` | LAN discovery, DNS, public-IP-derived hostname | Retain optional self-host entry; keep authored browser library on stable homegames.io origin |

Original milestone sequence (retained for history; use the launch plan for current status):

- Extend isolated preview tooling. Installation-scoped durable game progress, the first library, draft recovery,
  conflict handling, backups and isolated execution checkpoint is implemented.
- Static built-in catalog and runtime caching; warm offline Studio support.
- Optional RTC editable-file transfer. Local Studio already supports account-free
  invitations and ZIP copy import/export; legacy backend data stays available.
- Adapt the Node library and self-hosted WebSocket game loader to the same
  package reader. Preserve homegames.link and certificate issuance/renewal.
- Explicit legacy project/asset conversion, then retire old content/account
  paths in small commented-out changes after the owner tests each deployment.

## Historical validation checkpoint

```sh
node --test test/portable-project.test.cjs
node testRunner.js ./test/session/LocalAssetInitialization.test.js ./test/session/AudioAssets.test.js ./test/session/SvgAssets.test.js ./test/CertManager.test.js
node test/portable-browser.cjs
node test/studio-local-browser.cjs
node test/studio-templates-browser.cjs
node test/studio-snapshots-browser.cjs
node test/rtc-manual-browser.cjs
```

Browser acceptance requires Node 20+ and Playwright. Set `PLAYWRIGHT_MODULE` to
an installed Playwright module path and `CHROME_PATH` to an installed Chromium
executable if needed. It starts its own local signaling service with the existing
RTC STUN default (override using `RTC_TEST_STUN`), blocks external HTTP, restores into an empty workspace, opens the
export through `file://`, checks rendered image/audio, downloads a copy, and
connects a second real browser peer. It also checks host shutdown and independent
play of the received copy. This local test does not establish cross-device, Safari/iOS,
Firefox, public signaling, or forced-TURN coverage.

To check an existing deployed guest against the new portable host, set
`PORTABLE_GUEST_HTML` and `PORTABLE_GUEST_BUNDLE` to downloaded copies of its
`play.html` and `homegames-client.js`. This still uses local test signaling.

Verified for this milestone: 11 package tests and 16 existing asset/audio/SVG/
certificate regression checks passed on Node 18.16.0. The final browser acceptance
passed with Node 24.19.0 and Google Chrome 143.0.7499.169. Its two browser peers
used the existing STUN default; an earlier no-STUN run could exchange signaling
but could not establish a peer connection on this test network. This is not a
claim of universal connectivity without TURN.

The same acceptance test also passed using copies of the currently deployed
`homegames.io/play.html` and client bundle as the guest. A separate public-service
smoke check opened the generated HTML through `file://`, created a private room
through `api.homegames.io`, and joined its real invitation at `homegames.io`.
Image, audio, shared input, and host shutdown passed with two Chrome peers on
this machine. No player or signaling deployment was needed for this export.
Cross-device and forced-TURN behavior remain unverified. The project download
was checked as `pocket-chime.zip`, and ordinary `unzip` lists its source and media.

Generated review artifacts are in `portable-preview/`: `pocket-chime.html`,
`pocket-chime.zip`, and the restored project directory. The preview files
are ignored by Git; the source fixture, generator, CLI and tests are retained.
No production deployment has been performed.
