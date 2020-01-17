const Squisher = require("./Squisher");
const { generateName } = require("./common/util/name-generator");

//class GameSession {
//    constructor(game, player = null) {
//        this.game = game;
//        this.squisher = new Squisher(game);
//        this.squisher.addListener(this);
//        this.players = {};
//        this.game.players = this.players;
//        this.game.session = this;
//        this.game.squisher = this.squisher;
//    }
//
//    async addPlayer(player) {
//        if (!player.name) {
//            player.name = await generateName();
//        }
//         
//        player.addInputListener(this.squisher);
//        player.addStateListener(this);
//        this.players[player.id] = player;
//        const gameAssets = this.squisher.getAssets();
//        if (gameAssets && gameAssets.length > 0) {
//            player.receiveUpdate(gameAssets);
//        }
//        player.receiveUpdate(this.squisher.getPixels());
//
//        this.game.handleNewPlayer && this.game.handleNewPlayer(player);
//    }
//
//    removePlayer(player) {
//        delete this.players[player.id];
//    }
//
//    getGameState() {
//        return this.squisher.getPixels();
//    }
//
//    handlePlayerDisconnect(playerId) {
//        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
//        delete this.players[playerId];
//        this.game.playerDidDisconnect && this.game.playerDidDisconnect(playerId);
//    }
//
//    handleUpdate(update) {
//        for (const playerId in this.players) {
//            this.players[playerId].receiveUpdate(update);
//        }
//    }
//}
class GameSession {
    constructor(squisher) {
        this.game = squisher.game;
        this.squisher = squisher;
        this.squisher.addListener(this);
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.game.players) {
            this.game.players[playerId].receiveUpdate(squished);
        }
    }

    addPlayer(player) {
        console.log("ASSET BUNDLE");
        console.log(this.squisher.assetBundle);
        this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);
        player.receiveUpdate(this.squisher.squished);
        this.game.addPlayer(player);

//    async addPlayer(player) {
//        if (!player.name) {
//            player.name = await generateName();
//        }
//         
//        player.addInputListener(this.squisher);
//        player.addStateListener(this);
//        this.players[player.id] = player;
//        const gameAssets = this.squisher.getAssets();
//        if (gameAssets && gameAssets.length > 0) {
//            player.receiveUpdate(gameAssets);
//        }
//        player.receiveUpdate(this.squisher.getPixels());
//
//        this.game.handleNewPlayer && this.game.handleNewPlayer(player);
//    }

    }

    handlePlayerDisconnect(player) {
    }

    initialize(cb) {
        if (this.initialized) {
            cb && cb();
        } else {
            this.squisher.initialize().then(() => {
                this.initialized = true;
                cb && cb();
            });
        }
    }
    
}

module.exports = GameSession;
