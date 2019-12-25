const Squisher = require("./Squisher");
const { generateName } = require('./common/util/name-generator');

class GameSession {
    constructor(game, res) {
        this.game = game;
        this.squisher = new Squisher(game);
        this.squisher.addListener(this);
        this.players = {};
        this.game.players = this.players;
        this.game.session = this;
        this.game.squisher = this.squisher;
    }

    async addPlayer(player) {
        player.name = await generateName();
         
        player.addInputListener(this.squisher);
        player.addStateListener(this);
        player.addDataListener(this);
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
    }

    handlePlayerData(player, data) {
        console.log("PLAYER " + player.id + " SENT DATA");
        this.game.handlePlayerData && this.game.handlePlayerData(player, data);
    }

    handleUpdate(update) {
        for (let playerId in this.players) {
            this.players[playerId].receiveUpdate(update);
        }
    }
}

module.exports = GameSession;
