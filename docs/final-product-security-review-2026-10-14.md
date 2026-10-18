# Homegames product and security review — 2026-10-14

**Verdict: the local ownership architecture works, but hold the broad “Homegames is done” announcement for a focused security and release pass.** The browser product has a credible end-to-end story: play immediately, edit a local copy in Studio, transfer the complete game, and keep playing without the original host or website. The remaining issues concern authorization, service availability, Internet connectivity, and which version people actually receive.

This review covers the current working trees, installed packages, generated website, and a limited public-site check. It includes substantial uncommitted work; repository HEAD alone does not identify the reviewed product. Tests ran on macOS with Node 24.19.0 and Chrome 143.0.7499.169. Public observations were made on October 14 Phoenix time / October 15 UTC. No product source was changed and no deployment was performed.

The important architectural distinction is between the **browser product** and the **optional downloaded home server**. Browser games and assets are portable, Studio uses browser storage, and multiplayer/copies use WebRTC. Public signaling and ICE services still help peers connect. The downloaded server additionally exposes Node game hosting, settings, discovery, and optional certificate provisioning. Findings against that server do not imply remote code execution on someone who only visits the static website.

**Fix or resolve before the announcement**

| Priority | Finding | Evidence and exposure | Closure check |
| --- | --- | --- | --- |
| P1 security | A home-server guest can enable unrestricted execution; session creation accepts code without authentication. | Locally reproduced authorization failures; Node execution consequence traced in source. Requires access to the dashboard and Homenames, with Docker unavailable for the fork path. | A guest cannot change server settings or submit executable code, even when the owner permits fork sessions. |
| P1 security | One malformed request target terminates the replacement API. | Reproduced against disposable servers with RTC enabled and disabled. Production was not attacked. | Malformed requests return 400 and subsequent health/signaling requests still work. |
| P1 security | Reachable Node WebSocket services use vulnerable `ws` releases. | Core resolves 7.5.10; homegames.link resolves 7.5.9. Dependency and listener reachability verified; no memory-exhaustion attack run. | Update lockfiles and shipped artifacts to a patched compatible version, then exercise their WebSocket paths. |
| P1 release | Public peer sharing has no TURN fallback, and established games are coupled to signaling uptime. | Live private-room handshake supplied only Google STUN; client source closes peers on signaling loss. | Real cross-network play/copy, forced relay, and established-session survival during a signaling restart. |
| P1 release | Visitors still download 2.0.2, with a recorded Mac Finder launch defect. | Live manifest checked twice; release records identify the failure and an unpublished 2.0.3 replacement. | Release a verified, hardened replacement and test the actual downloaded/quarantined artifact. |

P1 here means an issue to resolve before a broad announcement, not a claim that every deployment is exploitable. Scope and reproduction limits follow.

**1. Home-server authorization permits an unsafe execution chain**

[Dashboard settings](/Users/josephgarcia/homegames/homegames-core/src/dashboard/HomegamesDashboard.js:552) have no owner check. The UI is explicitly available to every connected player, including the [fork toggle](/Users/josephgarcia/homegames/homegames-core/src/dashboard/HomegamesDashboard.js:583). I invoked the real handler with an arbitrary player ID and confirmed it enabled `FORK_SESSIONS_ENABLED` in disposable app data.

Separately, [POST /sessions](/Users/josephgarcia/homegames/homegames-core/src/Homenames.js:351) does not use the authentication check applied to session deletion. It accepts source through `code` or `files`, or an existing local `gamePath`. With a synthetic internal secret configured, an unauthenticated request still returned 200 and forwarded supplied source to a mocked session manager. No hostile source was executed.

The manager reads the fork setting on every launch. When Docker is unavailable, the permitted [fork path](/Users/josephgarcia/homegames/homegames-common/game-session-manager.js:420) runs supplied source with the server user's Node privileges. The environment allowlist does not restrict filesystem access. Thus the security opt-in is ineffective against a guest who can change that opt-in. A constructor override or an enforced environment value can prevent this particular chain; Docker availability changes its execution path. Unauthenticated privileged settings remain a problem in either case.

Give server administration an owner capability enforced at the handler, not merely a hidden button. Authenticate source/session creation and distinguish launching an installed game from accepting new executable source. Keep unrestricted execution an explicit host-only decision. Add a two-client regression proving that a normal guest cannot enable fork, restart the server, or submit code. Homenames also trusts arbitrary `X-Forwarded-For` values for rate limiting; restrict that to a trusted proxy while touching this boundary.

**2. Replacement API can be terminated by request parsing**

[connection-api.js:17](/Users/josephgarcia/homegames/api/connection-api.js:17) constructs a URL before its `try` block. [index.js:8](/Users/josephgarcia/homegames/api/index.js:8) discards the returned promise without a rejection handler.

On a disposable local server, an HTTP request target of `http://[` caused `ERR_INVALID_URL`, connection reset, and process exit code 1. The result was identical with the default RTC service enabled. A proxy may reject some malformed targets, but the listener itself must not depend on that. Catch URL parsing failures and rejected handler promises at the HTTP boundary; return a controlled response without terminating signaling rooms. This is verified against the proposed local API, not proof that the currently deployed legacy API has this exact defect.

**3. Patch reachable WebSocket dependencies; triage the rest by runtime**

Core pins [ws 7.5.10](/Users/josephgarcia/homegames/homegames-core/package.json:35), and its [network listener](/Users/josephgarcia/homegames/homegames-core/src/util/socket.js:308) accepts up to 10 MiB messages. homegames.link installs 7.5.9 and creates its listener in [server.js](/Users/josephgarcia/homegames/homegames.link/server.js:381). Both versions fall within the maintainer's fragmentation/memory-exhaustion advisory; a payload limit reduces exposure but does not make these versions patched. Version 7.5.11 fixes that advisory, and the current audit offers compatible 7.5.13. Link's 7.5.9 also predates the many-headers fix. See the maintainer's [fragmentation advisory](https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p) and [header handling advisory](https://github.com/websockets/ws/security/advisories/GHSA-3h5v-q93c-6h6q).

The lockfile audits also flag old decompression, certificate, and retired hosted-content dependencies. Do not interpret every transitive package as a browser vulnerability or apply the suggested major-version downgrades blindly. In particular:

- `decompress` remains in the legacy Node archive-download path. Remove that path/dependency if retired, or replace its extraction boundary before accepting untrusted archives there. The new portable importer uses a different implementation.
- `fflate` 0.8.2 is flagged. I tested the known malformed ZIP64 size prerequisite against the portable importer's central-directory validation: it was rejected before decompression. This mitigation is useful evidence, not a reason to leave the library outdated. See the [advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98).
- Certificate dependencies are conditional on the certificate service being enabled. Inspect the actual CSR parsing/signature-verification call path when updating them; the package finding alone does not prove a working certificate forgery.
- The new signaling-only entry point avoids account, Forgejo, and ML/content services, but the API lockfile still includes much of that stack. Remove retired production dependencies and audit the built release, not just development checkouts.

**4. Internet sharing still needs operational acceptance**

The live `wss://api.homegames.io/rtc` service accepted a private host and guest using protocol 2. Its ICE response contained only `stun:stun.l.google.com:19302`, with no TURN URL or credentials. Those disposable connections were closed. This establishes signaling availability, not a cross-network data connection.

STUN-only connections can work on many networks; they cannot provide reliable fallback where direct peer connectivity is blocked. Configure TURN with short-lived credentials, then prove a relay-selected connection and complete game-copy transfer between separate networks. Include a restricted network and a mobile browser. This is especially important because sharing is now central to content distribution.

The host's [signaling termination callback](/Users/josephgarcia/homegames/homegames-client/src/rtc-session.js:145) calls `stop`, which [closes all peers](/Users/josephgarcia/homegames/homegames-client/src/rtc-session.js:223). Therefore even an established P2P game depends on the signaling connection remaining alive. Preserve healthy data channels while reconnecting or refreshing invitations, and distinguish “new guests cannot join” from “the game ended.” If intentionally retaining that dependency, disclose it and test failure recovery.

**5. The public download is behind the recorded Mac fix**

The [public download manifest](https://homegames.io/builds/manifest.json) still selects 2.0.2. The [launcher release record](/Users/josephgarcia/homegames/homegames/README.md:86) documents a Finder/AppTranslocation failure in those bytes. It records a self-contained, notarized 2.0.3 replacement with a successful quarantined Launch Services check, and the corresponding [release manifest](/Users/josephgarcia/homegames/homegames/dist/release-2.0.3-9SvO97/release.json) exists locally.

I verified the public version and inspected those records; I did not independently rerun notarization, Finder launch, or download the full native archives during this review. The replacement should include the home-server security fixes above, so do not assume merely uploading the existing 2.0.3 artifact closes all findings. Validate the exact final download on clean supported systems and keep immutable old releases intact.

**Security and ownership decisions to make explicit**

**P2 — The browser sandbox is an origin boundary, not a network or CPU boundary.** [Portable game execution](/Users/josephgarcia/homegames/homegames-common/portable-runtime.js:43) uses `new Function` inside an opaque iframe. That protects the parent origin and Studio storage, which is valuable. It still exposes browser globals to game code. The [wrapper comment/CSP](/Users/josephgarcia/homegames/homegames-common/portable-html.js:54) overstates navigation/network restrictions: with sharing disabled and `connect-src 'none'`, a synthetic game navigated its own frame to a local test endpoint, carrying a sentinel query value. This was observed in Chrome using the actual installed portable wrapper. No private data was read or sent.

Do not describe imported games as unable to contact outside services. They can transmit data available inside their runtime, and runaway code lacks a termination boundary. Either explicitly require trusting a game's author, or introduce a constrained execution context with host-brokered capabilities and termination. Treat this as a launch blocker if the intended promise is safe execution of arbitrary untrusted games. No parent-origin escape was demonstrated.

**P2 — Joining currently confers permission to obtain a complete copy.** [LocalSession.exportProject](/Users/josephgarcia/homegames/homegames-client/src/local-session.js:577) checks active player membership; it has no separate host copy grant. The transfer handler returns the project, and [exportGameProject](/Users/josephgarcia/homegames/homegames-common/game-project.js:20) includes source, authored assets, and the runtime's user-export files. Separate “Share” and “Share a game copy” UI paths are not separate authorization policies.

For an openly shareable platform this can be the desired rule. Say clearly that inviting a player lets them keep the game and its export files. If hosts need play-only invitations, enforce that capability in the transfer handler. This is a product/trust decision, not an assertion that open copying is a bug.

**P2 — Per-game backup works; whole-workspace recovery is incomplete.** Studio visibly warns that browser storage is local and offers persistence and ZIP backups. Valid projects, broken drafts, binary assets, named snapshots, restore, quota handling, and concurrent edits have useful protections. Ordinary [autosaves](/Users/josephgarcia/homegames/homegamesio/studio-project-store.js:162) replace the current draft; they are not an automatic immutable history. A game ZIP/HTML is not a backup of all projects, snapshot history, independent My Assets items, and saved play progress together. Consider a complete workspace export/import and periodic checkpoints. Meanwhile, explain precisely which data each download contains. This is a durability improvement, not evidence that the tested project backups lose their files.

**Product and transition findings**

- **Make the P2P ownership loop the first-screen message.** The current [page generator](/Users/josephgarcia/homegames/homegamesio/scripts/render-game-pages.js:30) inserts all 87 games into both the homepage's featured collection and the catalog. Curate a short homepage selection and put play → edit → keep/share a complete copy before the long list. Preserve all 87 in the catalog. Four games lack the local gameplay thumbnails required by the project's own audit: Draw Your Own Boss, Fleetfall, One Unreasonable Hole, and Tabletop Railway.
- **Exercise returning visitors, not just clean profiles.** The public browser profile initially received the older homepage and logged `ReferenceError: loadActiveSessions is not defined`; a cache-busted navigation showed the new catalog with mismatched styling. A live Connect Four launch then worked. This is an observed upgrade/cache compatibility problem in one existing profile; its precise cache/service-worker cause and prevalence are unproven. Add an old-build → new-build test with open tabs, installed shells, and no manual cache clearing. Current deploy code sets revalidation and invalidates CloudFront, but that does not by itself establish upgrade correctness.
- **Finish the hosted-content transition deliberately.** Public `/games`, `/rooms`, and `/studio/templates` still respond, and `/health` returns legacy `ok!`, whereas the new local API returns JSON. The new entry point is therefore not proven to be the production service. Inventory old accounts, projects, published revisions, and assets, and provide any needed export/migration route before retiring them. Do not delete old data merely because the new website no longer calls it. [privacy.html](/Users/josephgarcia/homegames/homegamesio/privacy.html:78) still directs users to log in to manage/delete accounts; update the factual data story for local storage, peer addresses, signaling/relay logs, and retained legacy data.
- **Make the release reproducible.** Live and generated catalogs both contain 87 games, while [site.config.json](/Users/josephgarcia/homegames/homegamesio/site.config.json:1) defaults to six. Record the actual 87-game build configuration. The deployed client matches installed `homegames-client@0.1.1` after the normal license-comment filename rewrite; its differing raw hash is not a tampering finding. A local client change and generated runtime differ from production. Freeze the intended source/package/build manifest so a clean rebuild produces the announced release.

**Verification performed**

| Suite | Result | Scope |
| --- | --- | --- |
| Core `testRunner.js` | 911 passed, 8 failed | Games, sessions, transport, security, storage, and server helpers |
| Squish runner | 38 passed | Framework tests |
| Website unit tests | 31 passed | Static build, Studio, storage and related contracts |
| API selected contracts | 13 passed | New entry point, certificate policy and worker-result contracts |
| Worker tests | 22 passed | Queue/worker behavior |
| Portable project/transfer tests | 33 passed | Archives, paths, identity, media, transfer and exports |
| Launcher/release tests | 48 passed, 2 skipped | Includes mocked signing/publication paths; not native release certification |
| Static website browser suite | Passed | No-JS catalog/details, local search, download, isolated play, private RTC host/guest, expired invite, Studio import/export, mobile layout |
| Studio storage browser suite | Passed | Broken-draft backup, binary media, restore-as-copy, cross-tab conflicts, v2→v3 migration, independent assets and quota failure |
| Large RTC copy browser suite | Passed on independent rerun | >11 MiB exact source/media transfer, consent/cancel, self-contained HTML, fresh storage, offline reopen with origin stopped, onward sharing, disconnect during persistence, storage-failure recovery |
| 87-game browser smoke | All 87 passed rendering/first interaction | Diagnostic rerun removed only an obsolete assertion that the “More” button must be absent; original test is still red |

The first large-copy run timed out while four browser suites ran concurrently. An independent rerun with failure diagnostics passed without changing product behavior; retain this as a timing flake to investigate, not a proven transfer failure. The browser suites observed no unexpected external HTTP requests or uncaught errors during their tested normal flows. That does not override the separate adversarial frame-navigation result.

The eight core failures are two frame-clamp regressions for Squish 1.4.2/1.4.3, missing thumbnail coverage, missing curated screenshot coverage, three Little Scoop Shop/Little Zoo Walk snapshot/frame assertions, and the recorded Moonbounce winning route for “The Patient Pendulum.” Some frame assertions may need to change with the current per-player scene filtering. The Moonbounce failure does not prove the level is impossible. Resolve whether each is an implementation regression or a stale expectation before calling the release green; all 15 recorded challenge routes passed.

These tests did **not** establish Safari/Firefox behavior, physical iOS/Android installation or touch behavior, cross-network connectivity, forced TURN, adversarial load capacity, real certificate issuance, or clean Windows/Linux launch. Local RTC browser tests used the repository's mDNS-disable test option. Native release claims above are identified as existing release records, not freshly repeated tests.

**Practical announcement gate**

1. Close the home-server authorization and API crash findings; patch the reachable WebSocket dependencies.
2. Prove separate-network play and copy with a relay fallback, and decide/fix signaling-disconnect behavior.
3. Build and verify the exact hardened download; publish that version and verify the downloaded bytes and Mac launch path.
4. Resolve the red regression tests and test an existing browser profile upgrading to the new site.
5. State the copy/trust/backup rules and the fate of legacy hosted content, then record a reproducible release manifest.

Once those checks pass, “feature-complete local-first Homegames, with complete portable games and peer-to-peer sharing” is a defensible announcement. Continued browser compatibility work and upkeep of the remaining connection services will still be needed.

**Evidence**

Compact durable evidence is in [verification.json](/Users/josephgarcia/homegames/homegames-core/docs/review-evidence/2026-10-14/verification.json), [API crash output](/Users/josephgarcia/homegames/homegames-core/docs/review-evidence/2026-10-14/api-malformed-target-default-rtc.log), [boundary test output](/Users/josephgarcia/homegames/homegames-core/docs/review-evidence/2026-10-14/security-boundaries.log), and [public probe results](/Users/josephgarcia/homegames/homegames-core/docs/review-evidence/2026-10-14/live-results.json). Public probe results contain no room invitations or credentials. Full local logs and disposable reproduction scripts remain in [/tmp/homegames-final-review](/tmp/homegames-final-review); temporary files are not a permanent archive.
