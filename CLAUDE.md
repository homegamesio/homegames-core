# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start server**: `npm start` or `node index.js` - starts the Homegames server on port 7001
- **Development mode**: `npm run develop` or `node hotload.js` - runs in development with hot reloading
- **Run tests**: `npm test` or `node testRunner.js` - runs all tests in the test/ directory
- **Run specific test**: `node testRunner.js test/games/Slaps.test.js` - runs a single test file

## Architecture Overview

Homegames Core is a multiplayer game server platform that hosts games through WebSocket connections.

### Core Components

- **index.js**: Main entry point that handles configuration, SSL certificates, and link connections
- **game_server.js**: Core server logic that creates GameSession and Homenames instances
- **src/GameSession.js**: Manages individual game sessions, player connections, and the Squish serialization system
- **src/Homenames.js**: HTTP API for player identity management (names, settings, player IDs)
- **src/homegames_root/**: Provides the UI frame around games (bezel, player list, controls)

### Game Development

Games are located in `src/games/`, each in their own directory with an `index.js` file. Games must export:
- A constructor that takes game options
- A static `metadata()` method returning game info including `squishVersion`

The platform uses the Squish library for state serialization. Different games can use different Squish versions via the squish-map system.

### Configuration

Configuration is handled through `config.json` in the root directory. Key settings include:
- `HOME_PORT`: Main server port (default 7001)
- `HOMENAMES_PORT`: Identity service port (default 7100)
- `GAME_SERVER_PORT_RANGE_MIN/MAX`: Range for individual game sessions
- `START_PATH`: Override to start a specific game instead of the dashboard
- `BEZEL_SIZE_X/Y`: UI frame dimensions
- `LINK_ENABLED`: Enable connection to homegames.link service

### Testing

Uses a custom test runner (`testRunner.js`) that automatically discovers `.test.js` files in the `test/` directory. Test files use a global `test(name, fn)` function for defining tests.

### Directory Structure

- `src/games/`: Individual game implementations
- `src/common/`: Shared utilities (Deck, animations, word generators, etc.)
- `src/dashboard/`: Game selection interface
- `src/services/`: External service integrations
- `src/util/`: Core utilities (socket handling, link helper, etc.)
- `test/`: Test files organized by component
- `hg-games/`: Downloaded community games (runtime)

The codebase follows a modular architecture where each game is self-contained but can leverage common utilities and the core game session framework.