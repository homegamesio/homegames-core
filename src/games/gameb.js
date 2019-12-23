const { Asset, gameNode, Colors, Deck } = require('../common');

class GameB {
    constructor() {
        this.base = gameNode(Colors.RED, (player, x, y) => {
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

module.exports = GameB;
