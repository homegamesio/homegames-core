const Squisher = require("./Squisher");
const { generateName } = require('./common/util/name-generator');

class GameSession {
    constructor(game, res) {
        this.game = game;
        this.squisher = new Squisher(res.width, res.height, game);
        this.squisher.addListener(this);
        this.players = new Set();
    }

    async addPlayer(player) {
        if (!player.name) {
            player.name = await generateName();
        }
        player.addInputListener(this.squisher);
        player.addStateListener(this);
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
