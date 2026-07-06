# Homegames Core

The game session server for Homegames. Loads and runs games, manages WebSocket connections to players, and serializes game state through Squish.

## What it does

- **Game sessions** — runs game instances on individual ports, handles player connections via WebSocket
- **Squish integration** — serializes game state into a compact binary format and streams it to connected clients
- **Homenames** — an HTTP API that runs alongside the game server, managing session creation/discovery and mapping player IDs to names and settings
- **Docker validation** — includes a containerized validator (`docker/validate.js`) that checks game code at publish time (entry point, license, metadata, runtime behavior, asset collection)

## Setup

Requires: Node.js >= 18

```
npm install
node index.js
```

By default, the game server runs on port 7001 and Homenames on port 7400. Override via `config.json`:

```json
{
    "HOME_PORT": 9801,
    "HOMENAMES_PORT": 7400,
    "GAME_SERVER_PORT_RANGE_MIN": 8300,
    "GAME_SERVER_PORT_RANGE_MAX": 8400,
    "HTTPS_ENABLED": false,
    "LOG_LEVEL": "INFO"
}
```

To start a specific game directly instead of the dashboard, set `START_PATH` in your config to the path of the game's `index.js`.

## Related repos

- **squish** — game state serialization library used by the Squisher
- **homegames-client** — browser-side rendering engine that connects to game sessions
- **homegames-web** — web server that serves the client to players
- **api** — platform API that creates sessions via Homenames

## License

GPL-3.0
