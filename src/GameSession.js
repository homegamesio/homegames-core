const Squisher = require("./Squisher");
const WebSocket = require("ws");
const http = require('http');
const Player = require("./Player");

class GameSession {
    constructor(game, port) {
        this.game = game;
        this.port = port;
        this.squisher = new Squisher(game);
        this.game.squisher = this.squisher;
        this.squisher.addListener(this);
        this.players = new Set();
        const server = http.createServer();
        this.wss = new WebSocket.Server({
            server
        });
        this.wss.on('connection', (ws) => {
            const player = new Player(ws);
            this.addPlayer(player);
        });
        server.listen(port);
    }

    async addPlayer(player) {
        player.addInputListener(this.squisher);
        player.addStateListener(this);
        player.squisher = this.squisher;
        const gameAssets = await this.squisher.getAssets();
        if (gameAssets && gameAssets.length > 0) {
            player.receiveUpdate(gameAssets);
        }
        player.receiveUpdate(this.squisher.getPixels());
        this.players.add(player);

        this.game.handleNewPlayer && this.game.handleNewPlayer(player);
    }

    getGameState() {
        return this.squisher.getPixels();
    }

    handlePlayerDisconnect(player) {
        this.players.delete(player);
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(player);
    }

    handleUpdate(update) {
        for (let player of this.players) {
            player.receiveUpdate(update);
        }
    }
}

module.exports = GameSession;
