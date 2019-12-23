const { Asset, gameNode, Colors, Deck } = require('../common');

class GameA {
    constructor() {
        this.base = gameNode(Colors.BLUE, (player, x, y) => {
            console.log(player.id);
            player.receiveUpdate([5, 70, 0]);
            console.log("sending update");
        }, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': "ayy lmao", x: 50, y: 5});
    }

    handleNewPlayer(player) {
        console.log("Game A");
        console.log(Object.values(this.players).length);
    }

    handlePlayerDisconnect(player) {
        console.log("disconnected?");
    }

    getRoot() {
        return this.base;
    }

}

module.exports = GameA;
