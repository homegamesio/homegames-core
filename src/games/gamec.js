const { Asset, gameNode, Colors, Deck } = require('../common');

class GameC {
    constructor() {
        this.base = gameNode(Colors.GREEN, (player, x, y) => {
            player.receiveUpdate([5, 70, 0]);
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': "ayy lmao", x: 50, y: 5});
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect(player) {
    }

    getRoot() {
        return this.base;
    }

}

module.exports = GameC;
