const Squisher = require("./Squisher");

class GameSession {
    constructor(game, res) {
        this.game = game;
        this.squisher = new Squisher(res.width, res.height, game);
        this.game.squisher = this.squisher;
        this.squisher.addListener(this);
        this.players = new Set();
        this.frameTimes = new Array();
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
        //this.frameTimes.push(new Date()); 
        //if (this.frameTimes.length % 100 == 0) { 
        //    console.log(this.frameTimes.length);
        //}
        //for (let player of this.players) {
        //    player.receiveUpdate(update);
        //}
    }
}

module.exports = GameSession;
