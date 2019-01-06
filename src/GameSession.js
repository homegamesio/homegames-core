const Squisher = require('./Squisher');

class GameSession {
    constructor(game, res) {
        this.game = game;
        this.squisher = new Squisher(res.width, res.height, game);
        this.squisher.addListener(this);
        this.players = new Set();
    }

    addPlayer(player) {
        player.addInputListener(this.squisher);
        player.receiveUpdate(this.squisher.getPixels());
        this.players.add(player);
        this.game.handleNewPlayer(player);
    }

    handleUpdate(update) {
        for (let player of this.players) {
            player.receiveUpdate(update);
        }
    }
}

module.exports = GameSession;
