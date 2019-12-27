const { gameNode, Colors } = require("../common");

class Charades {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: "Joseph Garcia"
        };
    }

    constructor() {
        this.base = gameNode(Colors.WHITE, (player) => {
            player.receiveUpdate([5, 70, 0]);
        }, {"x": 0, "y": 0}, {"x": 100, "y": 100}, {"text": "ayy lmao", x: 50, y: 5});
    }

    handleNewPlayer(player) {
        const playerInfoNode = gameNode(
            Colors.WHITE,
            (player) => {

            },
            {
                x: 10,
                y: Object.values(this.players).length * 8
            },
            {
                x: 10,
                y: 8
            },
            {
                text: player.name,
                x: 10,
                y: Object.values(this.players).length * 8
            }
        );
        this.base.addChild(playerInfoNode);
    }

    handlePlayerDisconnect() {
    }

    getRoot() {
        return this.base;
    }

}

module.exports = Charades;
