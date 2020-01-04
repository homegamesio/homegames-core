const Squisher = require("./Squisher");
const { generateName } = require("./common/util/name-generator");

class GameSession {
    constructor(game, player = null) {
        this.game = game;
        this.squisher = new Squisher(game);
        this.squisher.addListener(this);
        this.players = {};
        // idk what im doing
        this.knownPlayerIds = {};
        if (player) {
            this.knownPlayerIds[player.id] = player;
        }
        this.game.players = this.players;
        this.game.session = this;
        this.game.squisher = this.squisher;
    }

    async addPlayer(player) {
        if (this.knownPlayerIds[player.id]) {
            player.name = this.knownPlayerIds[player.id].name;
            delete this.knownPlayerIds[player.id];
        }
        if (!player.name) {
            player.name = await generateName();
        }
         
        player.addInputListener(this.squisher);
        player.addStateListener(this);
        this.players[player.id] = player;
        const gameAssets = this.squisher.getAssets();
        if (gameAssets && gameAssets.length > 0) {
            player.receiveUpdate(gameAssets);
        }
        player.receiveUpdate(this.squisher.getPixels());

        this.game.handleNewPlayer && this.game.handleNewPlayer(player);
    }

    removePlayer(player) {
        delete this.players[player.id];
    }

    getGameState() {
        return this.squisher.getPixels();
    }

    handlePlayerDisconnect(playerId) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
        delete this.players[playerId];
        this.game.playerDidDisconnect && this.game.playerDidDisconnect(playerId);
    }

    handleUpdate(update) {
        for (const playerId in this.players) {
            this.players[playerId].receiveUpdate(update);
        }
    }
}

module.exports = GameSession;
