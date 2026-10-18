# Live website and connection API acceptance — October 18, 2026

The maintainer published Client 0.2.1, installed/pinned it in homegamesio, published the website and deployed the API. This pass checked the public deployments from this computer. No production configuration, service restart, certificate order, DNS record or package publication was performed by the agent.

## Passed

- **Release identity:** all 128 fetched files match the local `homegamesio/web` bytes: main pages/scripts/styles, both service workers, authoring guide/notices, all 33 game pages, all 33 game ZIPs and all 33 thumbnails. The catalog has 33 games and 12 featured selections. See `http-results.json` for per-file SHA-256 and cache headers.
- **Published Client:** live `homegames-client.cabb7a38b1a57a98.js` matches the build generated from the installed registry Client **0.2.1** (the build rewrites its license-comment filename). The runtime filename also matches the original npm bundle hash. The touch-focus unit regression passes against the installed package source; normal touch followed by keyboard pause also passes in the deployed browser runtime. No local bundle override was used.
- **API:** HTTPS `/health` returns `ok: true`. Retired `/rooms`, `/games`, `/auth/me`, `/studio/templates`, `/assets` and `/docs/ask` return 404. Health/status responses use `no-store`. Public HTTP redirects to HTTPS. Forged `X-Forwarded-For` / `X-Real-IP` values do not alter `/ip`, and it reports a non-loopback caller address. Raw caller address/domain are redacted from saved evidence.
- **Website:** homepage uses the interviewed introduction and shows all 12 featured games. Home/About/catalog fit a 390-pixel viewport. Studio's interactive example renders. Every featured game loads and draws through its actual deployed game pack/runtime.
- **Normal play and persistence:** House Band edits, audible PCM playback, touch-to-keyboard focus, public save download and exact save restoration after reload pass. Reload returns paused.
- **Live signaling:** a private invitation through `wss://api.homegames.io/rtc` connects two separate Chrome browser contexts. Guest audio opt-in works, scenes/audio arrive, and reloading the guest rejoins. Closing the host gives the guest the expected disconnect guidance. Both contexts run on this computer/network: this is not an independent-network or TURN test.
- **Offline copy:** HTML downloaded from the deployed player opens in a fresh browser context with networking disabled, includes the edited pattern and plays audio. This does not recreate a returning user's old service-worker/cache state.
- **Existing downloads:** manifest loads and both v2.0.2 ZIP and DMG URLs return 200 to HEAD, with sizes matching the manifest. These large binaries were not downloaded or validated in this pass.

Chrome 143.0.7499.169 reported **zero page errors, HTTP failures or failed requests** during the successful browser run. Screenshots and `browser-results.json` record the checks. Featured startup checks are not full human playthroughs or performance tests.

## Outstanding deployment work

1. **Certificate issuance is disabled.** `/health` reports `certificates.enabled: false`, and `/cert-status` confirms `certificatesEnabled: false`. The new runner has not received live acceptance through this deployment. Follow `api/deploy/certificates-al2023.md`: staging CA issuance/renewal, Route 53 cleanup, persistent account key, Mongo recovery and interrupted-order review first, then production issuance. Do not treat API health as proof of a working certificate worker or simply turn it on before those checks.
2. **TURN remains unconfigured in the advertised ICE list.** Both participants received only `stun:stun.l.google.com:19302`. The selected candidate pair was direct/STUN (`host` / `srflx`), with live bytes and open data channels. Forced relay across independent networks, expiry, quotas and load/egress acceptance remain.
3. **Missing pages use the storage provider's error screen.** A nonexistent website URL returns HTTP 404 with S3 `NoSuchKey` HTML. `/404.html` itself is correctly uploaded and includes Browse games/Open Studio/Get Homegames links. Configure the production CDN's missing-page response to serve `/404.html` while preserving status 404. No CDN setting was changed.
4. **Self-hosting artifacts still point to v2.0.2, dated October 14.** This predates the October 17–18 launch work. Rebuild/publish and fresh-install-test the intended final desktop/server/container artifacts separately; publishing the website does not update them.
5. **Private server checks remain unverified.** No saved `api/deploy/deployment.env` coordinates are present. This pass does not establish the remote Node version, exact API commit, systemd settings, nginx upstream exposure, IAM/Mongo configuration, worker migration state, discovery registration or restart/rollback behavior. It made no SSH connection.

## Reproduction

`check-http.cjs` makes bounded public GET requests (three at a time) and compares them with this workspace's generated release. `check-browser.cjs` uses real Chrome and the deployed origin; it creates only temporary private invitations and isolated local browser storage, and closes its browser when complete. Both scripts use the workspace/runtime paths recorded in their source and overwrite evidence in this directory if rerun. No TURN credentials or invitation secrets are saved.

Run with Node 24 and the locally bundled Playwright/Chrome paths used in this workspace. Network/browser permissions are required. The initial browser attempt incorrectly required more than five draw calls from the static one-shape Studio example; visual inspection confirmed it had rendered. The test was corrected to accept an actual draw and the complete flow then passed. No product code was changed for that test correction.

Additional evidence: `published-client-focus.log`, `browser.log`, `download-manifest.json`, the edited save JSONs and downloaded `house-band-live.html`.
