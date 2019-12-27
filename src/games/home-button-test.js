const { gameNode, Colors } = require("../common");

class HomeButtonTest {
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
        this.base = gameNode(Colors.BLUE, (player) => {
            player.receiveUpdate([5, 70, 0]);
        }, {"x": 0, "y": 0}, {"x": 100, "y": 100}, {"text": "ayy lmao", x: 50, y: 5});
    }

    handleNewPlayer() {
    }

    handlePlayerDisconnect() {
    }

    getRoot() {
        return this.base;
    }

}

module.exports = HomeButtonTest;
