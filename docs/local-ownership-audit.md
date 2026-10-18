# Local ownership plan audit — October 14, 2026

## Verdict and scope

**The working trees implement much of the intended product, but do not yet meet the complete pasted plan. Do not treat this audit as authorization to shut down production or delete hosted data.** Static distribution and ordinary local creation/play/copy flows are implemented. Execution isolation, complete workspace recovery, play-versus-copy permissions, legacy migration and release-device evidence still have gaps.

This review inspected the current, extensively modified checkouts of `homegamesio`, `homegames-client`, `homegames-common`, `homegames-core`, `squish`, `api`, `worker`, `homegames.link`, `homegames-web`, `homegames`, and `homepad`. It follows source and newly executed checks, not the deployed website or older completion reports. It does not certify every built-in game's behavior. No production environment files, account records or hosted projects were needed. Nothing was deployed, committed, deleted from production or shut down.

The owner clarified during this review that **homegames.link and certificate issuance should remain available for optional self-hosting**. Their MongoDB/RabbitMQ/DNS requirements are therefore an explicit exception to the original database-free infrastructure target. Ordinary static browser play and portable downloads do not require this stack. A signaling-only API can operate without a database; enabling certificate issuance still requires its backing services.

## Current data flow and dependency disposition

| Operation | Current implementation | Network/storage and disposition |
| --- | --- | --- |
| New project | `homegamesio/studio-portable.js`, `templates/`, template builder | Static template ZIP, new game UUID and trusted local installation UUID. No account API. |
| Source save and versions | `studio-project-store.js`, `studio-portable.js` | IndexedDB records and summaries in one transaction; generation comparison prevents stale-tab overwrite. Named snapshots are local. No Forgejo. |
| Import image; draw/record/keyboard tools | `studio.js`, portable asset adapter | Browser-wide My Assets library; Add to game copies media into that game’s `assets/` folder. Microphone permission for recording. No asset upload endpoint. |
| Metadata and import | `homegames-common/portable-project.js` | Acorn parsing and byte validation; import does not execute source. Only registered runtime identifiers. |
| Preview/local single-player | `portable-html.js`, `portable-runtime.js`, client `local-session.js` | Opaque iframe, packaged files, existing Squish scene/runtime. Save/export bridges connect to the trusted parent. Isolation limitations below. |
| Source and playable download | `portable-project.js`, `portable-html.js` | ZIP includes source/media/license/inventory; HTML embeds package and runtime. Ordinary download does not prove retention. Source validation can prevent export of an unfinished invalid draft. |
| Player progress | `portable-saves.js` | Separate installation/schema-scoped IndexedDB records; explicit save JSON import/export. Claimed game ID alone is not a Studio save permission. |
| Catalog | `homegamesio/scripts/build-game-library.js`, `render-game-pages.js`, `client.js` | Build-time explicit local inputs; static HTML/catalog, immutable packages/thumbnails. Six selected games in current config. No database or private-source fetch. |
| Offline app/Studio | `studio-sw.js`, `studio-offline.js`, `game-app-sw.js`, `game-app-storage.js` | App shell/runtime and complete game copies cached locally. Built-in games load on demand. Authored Studio records are separate from these caches. |
| Invite and join | client `rtc-session.js`, `rtc-network.js`, common `rtc-signaling.js`, `play.js` | Private capability in URL fragment. WebSocket signaling, configured STUN/TURN; scenes/media use RTC. One authoritative host and per-player filtering. Host must remain available. |
| Send a copy | client `rtc-copy.js`, `rtc-copy-protocol.js`, `game-app.js` | Explicit receiver consent, bounded chunks/acknowledgements, archive SHA-256/inventory checks. Received source is not run on receipt. Independent HTML/ZIP; Studio import is a separate action. |
| Additional session export | `project-transfer.js`, `game-session.js`, client `local-session.js` | A joined gameplay client can request a source archive and game-defined exports. This is an outstanding deviation from separate play/copy authority. |
| Publishing/auth/AI | static build allowlist, `studio.js`, active `api/index.js` | Account/publishing/AI UI/routes are retired in the new deployment. Historical handlers remain on disk but are not registered by the active API entry point. |
| Optional Node host | `LocalLibrary.js`, common `game-loader.js`, `local-game-assets.js`, `portable-project-node.js` | Local package installation and scoped disk assets; Node/WebSocket hosting remains. Legacy explicit asset-ID paths still exist outside the portable loader. |
| Optional self-host HTTPS | core cert/link helpers; API `connection-service.js`; worker certificate jobs; `homegames.link/server.js` | IP/DNS/ACME and certificate state require retained infrastructure. Domain/certificate management is separate from game hosting and content storage. |
| Legacy telemetry/services | core `src/common/util/report-bug.js`, worker legacy job handling | Optional Node error reporting can still target `/bugs`; not shipped into portable Studio. Disable retired reporters and legacy AI/docs/publish consumers in the cutover configuration. |

The new active API registers `/health`, `/ip`, `/request-cert`, `/cert-status`, `/verifyDns` and `/rtc`; no hosted game/session/account/content routes. Public `/rooms` discovery now remains available only when an explicit legacy `resolveGame` adapter is configured. The production connection entry point does not configure one.

The original audit used local sibling dependencies. The dependency release follow-up below now verifies published `homegames-common@1.7.0`, `homepad@0.2.0` and `squishjs@1.4.6`, plus a prepared client tarball, in isolated installs. Existing development `node_modules` directories were left intact; their local symlinks are not the evidence for those release checks. The client still needs publication before its downstream development references can become registry dependencies.

## Milestones against the requested plan

| Milestone | Assessment | Remaining exit requirements |
| --- | --- | --- |
| 0 — audit | Current source inventory above; older handoffs contain contradictory claims | Reconcile actual production process inventory and retained datasets before cutover. |
| 1 — portable assets | Implemented and covered by package/media/round-trip checks | Current browser verification uses the newer player/copy flows; old standalone test selectors need maintenance. |
| 2 — complete local Studio | Partial: IndexedDB, generation checks, snapshots, local media, opaque preview and scoped saves | Restricted execution capabilities and hang termination; versioned workspace backup/restore; automatic prior-revision recovery. |
| 3 — static distribution | Implemented: validated local collection, runtime bundle, static templates, cache workers, local forks | Upgrade/eviction acceptance on release browsers; ship exact tested dependency artifacts. |
| 4 — private sharing | Working direct local RTC and consented copy flow | Separate source permission from play admission; inventory/hash/readiness protocol for gameplay media; physical-device and forced-relay acceptance. |
| 5 — compatibility/migration | Partial: same-package Node loading, scoped assets, curated offline asset migration | Selected hosted revision export with missing-input report, legacy identity/save map, creator export path and owner-reviewed archives. |
| 6 — cutover | New static website and narrow API entry point exist | Resolve release blockers; preserve verified exports; stage and verify deployment; explicit owner decision before stopping/deleting anything. |

## Outstanding requirements

### 1. The game execution context still owns privileged networking

`portable-html.js` puts the client runtime, game code, signaling, peer connections, and copy controls inside the same `sandbox="allow-scripts allow-pointer-lock"` iframe. Its CSP restricts ordinary connection loads to the configured signaling endpoint, but game code still has the iframe's browser globals and RTC capabilities. `portable-runtime.js` evaluates authored code with `new Function` in that context. The communication worker is not a terminable, restricted game-simulation worker.

This provides a useful origin boundary around Studio storage/DOM, but does not establish the plan's promise that arbitrary imported games cannot open their own connections or inspect/interfere with room capabilities. There is no demonstrated recovery from a game that hangs its execution thread while keeping editor work usable. Keep this as a release blocker for the original arbitrary-import trust contract. A restricted simulation context and explicit trusted networking bridge need implementation and hostile-fixture verification; source filtering alone is insufficient.

### 2. A play invitation can also authorize an editable copy

`LocalSession.exportProject(playerId)` and Node `GameSession.exportProject(playerId)` check membership, then return source through `ProjectTransferHost`. A modified invited client can request it even if the normal guest UI does not show a source button. This is independent of the separate, consented `CopyHost` invitation.

The original plan requires an intentional sender-selected copy action. Implement that authorization at the host, not by hiding guest controls. Preserve local-owner downloads and the explicit copy flow. Game-defined `user-exports/` and Node self-host download behavior are newer features and should be reconciled explicitly with this policy; this audit did not silently remove them.

### 3. Workspace backup and automatic revision recovery are incomplete

`StudioProjectStore.write()` atomically replaces the current project record and summary. It does not retain an automatic previous immutable revision on each save. Named snapshots exist only after the user creates them. Atomic transaction failure protects the previous committed draft, but startup integrity checking/last-complete-revision recovery is absent.

There is no versioned full-workspace export containing selected projects/history/progress, no conflict preview for a workspace restore, and no atomic selected-workspace restore. Project ZIP/HTML and separate save JSON are useful individual exports, not substitutes for that requirement. ZIP import always creates a separate local instance; an explicit replace/restore choice for an existing portable game ID is not implemented. The October 14 website follow-up adds origin storage estimates, per-game and shared-library sizes, atomic game/snapshot deletion, and a checked `.studio.zip` fallback that backs up syntax-invalid drafts without executing them. Ordinary playable ZIPs remain unchanged. Full-workspace and large-workspace recovery acceptance remain outstanding.

### 4. Play-media transfer is less strict than editable-copy transfer

The gameplay channel uses bounded packet chunks, per-peer queues, coalesced scenes and independent asset packets. Late joins receive media and frames without executing host source. However, `assets.js` accepts the established type-1 asset bundle; there is no manifest/inventory SHA-256 negotiation, missing-content cache exchange, or verified-resource readiness acknowledgement before play. Loading/decoding can complete after the first scene. Do not apply the copy protocol's SHA-256 claims to this separate path.

### 5. Migration and destructive cutover are not complete

`homegames/migrate-local-assets.js` is a useful structured transformation from an existing local release asset directory. The portable CLI validates/packs/unpacks ordinary projects, and the static builder can synthesize a manifest for compatible local source. None is the full selected hosted-game/revision exporter with historical scope, legacy-ID/save mapping, creator access and owner-reviewed migration receipts required by the plan.

No reviewable evidence of exports of the owner's selected hosted projects, other creators' projects or their required media was supplied to this audit. A repository checkout and a latest ZIP are not backups of the old hosted Git history/database. Do not remove the old content storage until those exports are verified and their retention is explicitly decided.

### 6. Browser and connection release evidence remains incomplete

This audit's executed browser checks use installed desktop Chrome **143.0.7499.169**, Playwright **1.62.1**, and local signaling. That is not proof of current Firefox/Safari, physical iPhone/iPad, separate-network peers or forced TURN. The copy test uses real independent profiles, service workers and a stopped origin; it does not certify the iOS installation UI. No production signaling, TURN, certificate issuance or DNS mutation was attempted.

Automatic clients currently end peers when signaling closes; a signaling restart therefore ends their sessions and invitations. Manual RTC pairing is a separate path. Document this behavior and verify it against the deployed service. Configured TURN secrets remain server-side and credentials expire, but no relay reachability was proven here.

## Compatibility decisions and smaller deviations

- The implementation exports ordinary `.zip`, accepting `.homegame` archives as equivalent input. The old plan preferred `.homegame` as the export extension. Archive integrity is independent of the extension.
- The manifest/inventory format is version 1. Hashes cover canonical parsed manifest plus sorted file records, including exact authored manifest bytes; generated inventory excludes itself. ZIP ordering/timestamps do not affect the revision. Existing package tests cover corruption, undeclared members, path/case collisions, symlinks and expansion limits.
- Supported local/browser runtime IDs are now **142, 143, 145 and 146**. The old 142/143/145 browser adapters retain their scene codecs but use current lifecycle/Asset plumbing. Verify compatibility explicitly; do not describe these adapters as unchanged published runtime implementations. Downloaded HTML pins its runtime bytes.
- Copy receipt saves an independent game app/HTML/ZIP. It does not automatically add a Studio project; editing requires explicit import. This is a product-flow deviation from the old plan's wording, with no server-owned content.
- Ongoing game-created `user-exports/` may be included in session downloads/copies. They are separate from player-save JSON, but are also newer than the original frozen-authored-revision model.

## Changes made during this audit

- `homegames-common/rtc-signaling.js`: expire private application heartbeat leases; disable discovery HTTP handling without an explicit legacy catalog adapter; reject unexpected message/nested SDP/ICE fields and bound individual connection strings. This is a protocol schema boundary, not a claim that hostile clients cannot encode data inside otherwise valid SDP strings.
- `api/connection-service.js`: disabled certificate status returns immediately without opening MongoDB, queue connections or DNS lookups. Certificate issuance itself remains supported when enabled.
- `homegames-core/src/util/link-helper.js`: capture HTTPS intent before startup rewrites the environment to the currently served protocol. Explicit environment `false` now beats saved config in link registration.
- `homegamesio/studio-portable.js`: editing a static built-in allocates a fresh portable game UUID as well as a fresh local project ID; reload keeps that fork. Ordinary archive imports retain portable identity.
- `homegamesio/game-app.js`: a failed offline save exposes the already verified package's Play/download recovery controls. Catalog launch previously left those controls inside hidden setup UI.
- Updated focused regression checks and the deterministic browser fixture; the new toolbar uses `window.document`, and the session disconnect fixture now supplies its transfer manager.
- Added this audit and marked older deployment/checkpoint documents as historical rather than presenting obsolete public-room/API deployment steps as current.

## Validation and reproducible package

Commands run from the indicated repository; logs are local audit evidence, not committed artifacts:

| Repository / command | Result |
| --- | --- |
| core: `node --test test/portable-project.test.cjs` | 17 passed. |
| core: `node --test test/portable-project.test.cjs test/session/ProjectTransfer.test.cjs test/session/UserExports.test.cjs test/session/SquishRuntime.test.cjs` | 33 passed. This includes current source-copy behavior; it is not permission-isolation certification. |
| core: `npm run test:sessions` | 209 passed after fixes. Local HTTP/WebSocket fixtures required sandbox approval. |
| API: `npm test` | 13 passed, including disabled certificate dependency isolation. |
| website: `npm test` | 28 passed after the final application and history changes. Local HTTP fixtures required sandbox approval. |
| website: `npm run build` | Six configured games, templates/examples, hashed client runtime and complete static output built locally. Webpack reports bundle-size warnings. |
| website: `test/rtc-copy-browser.cjs` | Passed: >11 MiB consented transfer, exact source/media, onward sharing, sender loss, fresh-profile cold offline launch, storage failure recovery and data-only HTML import. No external HTTP or uncaught errors reported. |
| website: `test/static-site-browser.cjs` | Passed: no-JavaScript browsing, private RTC/ended invitations, storage-failure Play recovery, built-in fork identity and reload, source fidelity, ZIP re-import and mobile layout; zero external HTTP requests. |
| history-page browser inspection | Passed in desktop Chrome: era selection/show-all/keyboard, deep links, print visibility, no-JavaScript and saved-file/offline reading, 390px/320px layout, diagram label fit and no page errors or HTTP requests. Local screenshots in `/tmp/hg-history-check/`. |

Browser environment used:

```sh
export PLAYWRIGHT_MODULE=/Users/josephgarcia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright
export CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export RTC_TEST_DISABLE_MDNS=1
/Users/josephgarcia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node test/static-site-browser.cjs
/Users/josephgarcia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node test/rtc-copy-browser.cjs
```

The no-mDNS option is test-only; no production ICE setting was changed. The copy harness also disables mDNS itself for its local fixture.

The maintained sample is `test/fixtures/portable-sound/`, containing source, image, audio, license and attribution. From core, with new output paths:

```sh
node tools/portable-game.cjs check test/fixtures/portable-sound
node tools/portable-game.cjs pack test/fixtures/portable-sound /tmp/pocket-chime-audit.homegame
node tools/portable-game.cjs unpack /tmp/pocket-chime-audit.homegame /tmp/pocket-chime-audit-restored
node tools/portable-game.cjs html /tmp/pocket-chime-audit-restored /tmp/pocket-chime-audit.html --trusted
```

The CLI never overwrites existing destinations. Source/archive inspection does not run the fixture; opening its HTML does. The browser copy test also round-trips this media fixture with added large binary data.

The four sample commands above were executed successfully during this audit. Check, archive, restored directory and generated HTML all report revision `d298f78bdb6aefe944047ab0b062efa2ce89fd190ffa6ff20031be8e8ecbf558` (seven files, two assets, `squish-150`). The generated outputs are temporary local review artifacts, not hosted-game migration exports.

## Dependency release follow-up — October 14, 2026

The owner published `homepad@0.2.0`, `squishjs@1.4.6` and `homegames-common@1.7.0`. The registry metadata and clean installs confirm these versions; common uses registry dependencies for Homepad and all four Squish aliases. Critical published common source files were also compared byte-for-byte with the checkout.

Release preparation now includes:

- Registry common dependencies in client, Core, legacy web shell, website and worker; refreshed lockfiles in those five repositories and API. Lockfiles contain common's published version and integrity, with no local common/Homepad/Squish links.
- Direct Squish dependencies in client and Core, replacing their postinstall link hook. The published common linker was reproduced deleting hoisted runtime directories and replacing them with self-links in a disposable fixture. These consumers no longer invoke it; common's published helper itself has not been changed.
- Client `npm pack` rebuilds its UMD bundle through `prepack`. An explicit file list ships source, bundle and webpack configuration; npm includes README/license. Build commands resolve webpack through npm's executable path, so an installed client can also be rebuilt by the website.
- Core regression tests import installed packages instead of sibling Homepad/common/client source paths or common's internal `node_modules`. Homepad and fflate are explicit Core test dependencies.

Prepared artifact: `homegames-client/homegames-client-0.1.0.tgz`, 43 files, approximately 222 kB compressed. SHA-256: `9294c471503dd09014d3baac8033ea4da6f1c06fee0eea90ce14ab573b5f934f`. Its source and metadata match the working client checkout. The artifact has not been published. npm had no `homegames-client` package when checked.

Release checks used `/tmp/homegames-release-preflight-dzhpmV/`, independently installed registry packages, and the client tarball. No published-package source was supplied by the live development symlinks. The test website uses the six selected local game directories as build inputs.

| Check | Result |
| --- | --- |
| Client locked install, prepack build, empty consumer install and installed-package rebuild | Passed; source exports, portable UMD bundle and all four runtime aliases resolve as real installed directories. |
| Static website built with the installed client tarball | Passed; six games. Existing webpack bundle-size warnings remain. |
| Core session regression suite | 209 passed. |
| Portable package, project transfer, user export and runtime checks | 33 passed. |
| Connection API / certificate and job worker / website unit suites | 13 / 22 / 28 passed. API/worker native ML installation scripts were skipped; these checks do not certify the retired ML deployment path. |
| Desktop Chrome static-site and RTC-copy workflows | Passed with the installed packages: private invitations, Studio imports/forks, >11 MiB peer copy, onward sharing, stopped-origin offline launch and failure recovery; no external HTTP or uncaught errors reported. |

Next release dependency: commit/push and publish the prepared browser client, then replace `file:../homegames-client` in Core, web and website and refresh their lockfiles. The optional `homegames.link` service retains its existing common pin pending its separate compatibility check. These packaging checks do not close the isolation, permission, recovery, migration or device/network cutover requirements above.

## Cutover checklist

- [x] Establish a local static build and connection-only API entry point; run focused checks.
- [x] Keep optional self-host link/certificate infrastructure as the owner-requested exception.
- [ ] Close or explicitly revise the isolation, play/copy permission, workspace backup/recovery and gameplay-media contract gaps above.
- [ ] Produce selected legacy exports with identity/save mappings, license/media completeness and explicit history scope; have the owner review them.
- [ ] Test current release browsers, physical devices, separate networks, forced TURN/no-TURN failure and optional certificate issuance.
- [ ] Freeze tested sibling dependency versions and retain the current static release plus legacy service artifacts/configuration as rollback material.
- [ ] Stage the static release at the same Studio origin, verify old-content requests remain absent, then verify connection services independently. Preserve old hashed runtime/game files for cached clients; do not delete authored browser storage.
- [ ] Inventory production process/service names. Stop hosted gameplay/publish/content consumers only after an explicit cutover instruction. Retain certificate workers, their queue/database/DNS dependencies and link service if offering that feature.
- [ ] Rollback: restore prior static entry pages/manifests/workers and the previous service artifact/configuration; preserve both generations' hashed dependencies and all legacy datasets. Restoring a legacy API is an explicit operational decision, not an automatic content fallback in the new client.
- [ ] Decide retention/deletion separately after verified exports. This checklist does not authorize deletion of accounts, projects, assets, Git history, databases or production services.
