const Squisher = require("./Squisher");
const { generateName } = require('./common/util/name-generator');

class GameSession {
    constructor(game, res) {
        this.game = game;
        this.squisher = new Squisher(res.width, res.height, game);
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
        this.players[player.id] = player;
        const gameAssets = await this.squisher.getAssets();
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

    handlePlayerDisconnect(player) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(player);
        delete this.players[player.id];
    }

    handleUpdate(update) {
        for (let playerId in this.players) {
            this.players[playerId].receiveUpdate(update);
        }
    }
}

module.exports = GameSession;
