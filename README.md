# Homegames Core
Homegames core contains Homegames server stuff. The Homegames server is responsible for providing game sessions clients can connect to.

## Setup
**Note: You probably don't want to run homegames-core directly if you're just trying to play games. The best way to do that is via the executables available at homegames.io**

Requirements: 
- Node.js >= 18

```
npm i
node index.js
```

By default, this will run a Homegames game server on port 7001. You can override this in your config.

## Games 
Built-in games are located in src/games.
Downloaded community games are in different places depending on your operating system.

Windows:
`C:\Users\<username>\AppData\homegames\hg-games`

MacOS:
`${HOME}/Library/Application Support/homegames/hg-games`

Linux:
`/path/to/home/.homegames/hg-games`

## Config
Homegames will look for a `config.json` file in the root project directory. If present, it will override defaults. Here's an example config.json:

```
{
    "LINK_ENABLED": true,
    "HOMENAMES_PORT": 7400,
    "HOME_PORT": 9801,
    "LOG_LEVEL": "INFO",
    "GAME_SERVER_PORT_RANGE_MIN": 8300,
    "GAME_SERVER_PORT_RANGE_MAX": 8400,
    "HTTPS_ENABLED": false,
    "BEZEL_SIZE_X": 9,
    "BEZEL_SIZE_Y": 9,
    "DOWNLOADED_GAME_DIRECTORY": "hg-games",
    "LOG_PATH": "homegames_log.txt",
    "PUBLIC_GAMES": false,
    "ERROR_REPORTING": true,
    "ERROR_REPORTING_ENDPOINT": "https://api.homegames.io/bugs",
    "START_PATH": "/Users/josephgarcia/weed-smoke-willie/index.js",
    "TESTS_ENABLED": true,
    "ERROR_REPORTING_ENDPOINT": "https://api.homegames.io/bugs"
}
```

## Dashboard
By default, the Homegames core server will serve the Homegames dashboard on `HOME_PORT`. If you're developing a game locally and want to start it directly instead of navigating through the dashboard, set `START_PATH` in your config.json.

The dashboard is rendered like any game but has special knowledge about game sessions and players.

## Game Session
A game session (`src/GameSession.js`) will run a `Game` on a given port. It handles all of the networking and input stuff as well as Homegames-specific logic like rendering the frame around a game and letting users update their names.

The game session is responsible for:
- Instantiating a `HomegamesRoot` which is responsible for stuff like the Homegames frame
- Creating a `Squisher` and notifying players when updates occur
- Managing player connections to the session

## Homenames
Homenames is an HTTP API that runs alongside a Homegames core instance. It is responsible for maintaining user metadata (eg. name, settings) across game sessions. It maintains a map of player IDs to player names and settings, allowing clients to say "hey I'm player ID x" and a session can say "I know you, you're booty slayer".
