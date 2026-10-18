# Server games in Docker

Browser-hosted games do not need Docker. Node server sessions use Docker when it
is running. **Run games without Docker** defaults to Off and is a host-only
setting. Starting Docker after Homegames is already open lets the host retry
without restarting Homegames.

The first server game prepares and builds the runner automatically. The first
build needs internet access to download the official Node 24.22.0 Debian slim
base image. Later starts reuse the local image; a changed runtime builds a new
image. Docker Desktop must use Linux containers on Windows.

`prepare-context.js` copies Core runtime files and its installed production
dependencies into `<app-data>/docker-runtime/<hash>`. It works inside a downloaded
app: no sibling checkout, Common lockfile, npm install or writable app directory
is required. User configuration, certificates, saves, game libraries and dev
dependencies are excluded. Optional native accelerators with JavaScript fallbacks
are omitted; unknown native binaries fail preparation. Node dependencies and
Squish come from Core's installed dependency graph, so there is no separate
runner package manifest to maintain.

The image tag is `homegames-runner:<runtime-content-sha256>`. It cannot silently
reuse an older `homegames-runner:latest`. Upgrades leave existing containers and
older images intact. Docker's own image management can remove unused images.

To prepare it explicitly from a source checkout with Node 24:

```sh
node docker/prepare-context.js
```

Games have a read-only system filesystem and code mount, a per-game writable save
directory, optional asset cache and read-only TLS certificate mount. Containers
drop Linux capabilities, forbid gaining additional privileges and have CPU,
memory and process limits. Live games retain networking for players and the
local player service. Validation containers disable networking. Startup waits
for the game WebSocket; a failed start removes the container and releases the
session port.

For acceptance, use an isolated Core copy with the new Common package installed:

```sh
HG_DOCKER_TEST_CORE=/absolute/path/to/core \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROME_PATH=/absolute/path/to/chrome \
node test/docker-acceptance.cjs
```

This starts its own temporary server and containers, checks two browser players,
input, save/restart, verified HTTPS, WSS and offline container validation, then
removes its containers and temporary state. It does not publish images or request
public certificates. See the [acceptance evidence](../docs/review-evidence/selfhost-2026-10-18/README.md).
