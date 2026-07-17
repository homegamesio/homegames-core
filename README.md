# homegames-core

The game-session server for Homegames — the process that runs on a host machine (a laptop, a Pi, a server) and lets people on the network play local-multiplayer games from their own devices' browsers.

Running it starts:

- A **Dashboard** (itself a Homegames game) on `HOME_PORT` — a browse/search/launch UI for games.
- **Homenames**, an HTTP API on `HOMENAMES_PORT` — player identity (names, settings, client info) and session lifecycle (create/list/get/delete/logs).
- One **child process per running game** (a forked Node process or a `homegames-runner` Docker container), each on its own port from `GAME_SERVER_PORT_RANGE_MIN..MAX`.
- Optionally, a WebSocket client to [homegames.link](../homegames.link) so the server is discoverable at `https://homegames.link` from the same network (and remotely via the public relay).

Rendering is server-authoritative: games build a tree of `GameNode`s (shapes/text/assets on a 0–100 coordinate plane), the server serializes that tree with [squish](../squish) and streams binary frames over WebSocket; browsers ([homegames-client](../homegames-client), served by [homegames-web](../homegames-web)) render frames and send back JSON input events.

## Running

Requires Node ≥ 18 and a sibling checkout of `../homegames-common` (a `file:` dependency; its postinstall symlinks the squish versions).

```sh
npm install
npm start        # node index.js
npm test         # node testRunner.js (test/**/*.test.js)
```

With the committed `config.json`: dashboard on **9801**, Homenames on **7400**, game sessions on **8300–8400**, HTTPS off, homegames.link registration on. Link failures are non-fatal — the server still runs LAN-only. Set `START_PATH` to a game's `index.js` to boot straight into that game instead of the dashboard.

## Process model

- `index.js` — the entry point. Resolves a username (`--username=` or `.hg_auth/username`) and a cert path (`--cert-path=` or `<baseDir>/hg-certs` when `HTTPS_ENABLED`), optionally connects to homegames.link, then calls `server(...)` from `game_server.js`.
- `game_server.js` — exports `server(certPath, squishMap, username)`: creates the shared `GameSessionManager` (from homegames-common), the Dashboard `GameSession` on `HOME_PORT`, and `Homenames` on `HOMENAMES_PORT`.
- `src/child_game_server.js` — the per-session process body. Started either via `fork()` (config over IPC; parent heartbeats every 500ms, child self-terminates after 5s without a heartbeat and no players) or inside a `homegames-runner` container (config via env vars; entry `docker/container-entry.js`). Two modes: framed (HomegamesRoot bezel + Homenames integration — what the dashboard launches) and `noFrame` (raw game — what API-created sessions use).
- HTTPS: when a cert path is set, every server (dashboard, Homenames, sessions) serves TLS using `<certPath>/homegames.key` and `<certPath>/homegames.cert`. This repo **consumes** certs; obtaining them is the [api](../api) `/request-cert` → [worker](../worker) `CERT_REQUEST` flow, coordinated with [homegames.link](../homegames.link) for the `<hash>.homegames.link` subdomain.

## Player/session lifecycle

1. A client opens a WebSocket to a session port and sends `{type: 'ready', clientInfo}`.
2. `src/util/socket.js` assigns the player ID server-side from a pool (1–127 local, 128–255 for relay/remote — never trusted from the client) and sends the binary init frame (player id, aspect ratio, bezel, squish version string).
3. Player info is fetched from Homenames, then `gameSession.addPlayer(...)`.
4. Input messages are JSON, rate-limited to 120/s per connection.
5. Moving a player between games sends a port-redirect frame; the client reconnects to the new session port. The frame's home button moves players back to the dashboard.

Save data is JSON keyed by an md5 of the game path, under the OS app-data dir (`~/Library/Application Support/homegames` on macOS, `~/.homegames` on Linux) or `SAVE_DATA_PATH` in Docker.

## Key directories

| Path | What it is |
|---|---|
| `src/dashboard/` | The Dashboard game: per-player views, local + catalog search, paginated Browse, download-with-progress, session launch |
| `src/games/` | ~50 built-in games (plus `*-test` diagnostic games, hidden unless `TESTS_ENABLED`) |
| `src/homegames_root/` | The frame wrapped around every game: bezel, home button, player name label, settings modal, spectate/join, server code display |
| `src/Homenames.js` | The HTTP API: `GET /info`, session CRUD + SSE logs + persistence toggle, per-player info/settings/client_info endpoints. Internal endpoints gated by `HOMENAMES_API_SECRET` bearer auth |
| `src/library/` | `LocalLibrary` (built-in + downloaded games), `fetchGameSource`/`Installer` (download published games from the API catalog) |
| `src/catalog/CatalogClient.js` | HTTP client for the platform API (`/games`, source trees/files, assets) |
| `src/util/` | `socket.js` (game WebSocket server + public relay broadcast), `link-helper.js` (homegames.link client: register, 10s heartbeats, httpsReady), `homenames-helper.js` |
| `src/services/` | Pluggable game services (only `contentGenerator` is implemented) |
| `docker/` | The `homegames-runner` image: `build-image.sh` builds it (bundling homegames-common + this repo's `src/`); `container-entry.js` boots a session; `validate.js` is the publish-time validator run with `--network=none` |

## Configuration

Resolution (via homegames-common's `getConfigValue`): **env var wins**, then `config.json` (searched app-data dir → cwd → main-module dir), then baked defaults. Keys prefixed with `z` in `config.json` are a disable-by-rename convention.

Main keys: `HOME_PORT`, `HOMENAMES_PORT`, `GAME_SERVER_PORT_RANGE_MIN/MAX`, `LINK_ENABLED`, `LINK_URL` (`wss://homegames.link`), `LINK_PROXY_URL` (`wss://public.homegames.link:81`), `API_URL` (`https://api.homegames.io`), `HTTPS_ENABLED`, `PUBLIC_GAMES` (enable the public relay), `PUBLIC_HOST` (return `wss://<host>/session/<port>` URLs when behind a TLS path-routing proxy), `START_PATH`, `HOMENAMES_API_SECRET`, `IS_DEMO`, `TESTS_ENABLED`, `BEZEL_SIZE_X/Y`, `LOG_LEVEL`, `ERROR_REPORTING` / `ERROR_REPORTING_ENDPOINT`, `CHILD_SESSION_MEMORY_LIMIT`, `LOCAL_GAME_DIRECTORY`.

## Writing a game

A game is a class extending `Game`/`ViewableGame` from a `squish-<version>` package, with:

- `static metadata()` → `{ squishVersion, aspectRatio, tickRate, author, thumbnail, ... }` (`squishVersion` is required — it's AST-parsed at load time)
- `getLayers()` → `[{ root: <GameNode> }, ...]`
- lifecycle hooks: `handleNewPlayer`, `handlePlayerDisconnect`, `handleKeyDown/Up`, `tick()`, `close()`, optional `getAssets()`, `canAddPlayer()`, `handleNewSpectator()`

`src/games/squarer/index.js` is a good minimal example; the full authoring contract lives in [homegames-common/docs/squishjs-game-authoring.md](../homegames-common/docs/squishjs-game-authoring.md).

## Related repos

- **[homegames-common](../homegames-common)** — `GameSession`/`GameSessionManager`, config, docker helper, canonical squish version map
- **[squish](../squish)** — the game object model + binary serialization
- **[homegames-client](../homegames-client) / [homegames-web](../homegames-web)** — the browser side
- **[api](../api)** — game catalog, publishing, assets, cert issuance
- **[homegames.link](../homegames.link)** — LAN discovery + dynamic DNS
- **[homegames](../homegames)** — wrapper combining this and homegames-web into one runnable unit

## Known cruft (as of this writing)

- The root `Dockerfile`'s `CMD ["node", "game_server.js"]` is broken (that file only exports a function; the entry is `index.js`). The functional container artifact is the `docker/` runner image.
- `npm run develop` references a nonexistent `hotload.js`.
- `probe*.tmp.js` are one-off debugging scripts; `dictionary.txt` (root), `sample_config.js`, `ayy/`, `ting/`, and `homegames_log.txt` are dead.
- The committed `config.json` has `ERROR_REPORTING_ENDPOINT` pointed at `http://localhost/bugs` (a local-dev override); the production value is `https://api.homegames.io/bugs`.
- The public relay path (`PUBLIC_GAMES`, `LINK_PROXY_URL` → `wss://public.homegames.link:81`, the `broadcast()` code in `src/util/socket.js`, and player IDs 128–255) targets the old ws-relay service, which has been retired now that hosted play runs through the platform API.
