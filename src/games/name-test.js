const { gameNode, Colors } = require("../common");

class NameTest {
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
        this.playerCount = 0;
        this.players = {};
        this.infoNodes = {};
        this.base = gameNode(Colors.GREEN, null, {"x": 0, "y": 0}, {"x": 100, "y": 100}, {"text": "Player Test", x: 50, y: 5});
    }

    tick() {
    }

    handleNewPlayer(player) {
        
        this.players[player.id] = player;        
        const playerName = "ayy lmao " + player.id;
        const infoNode = gameNode(Colors.randomColor(), null, {x: 20, y: 20}, {x: 20, y: 20}, {text: playerName, x: 25, y: 25}, null, player.id);
        this.infoNodes[player.id] = infoNode;
        this.base.addChild(infoNode);
    }

    handlePlayerDisconnect(player) {
        this.infoNodes[player.id] && this.base.removeChild(this.infoNodes[player.id].id);
        delete this.players[player.id];
        delete this.infoNodes[player.id];
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = NameTest;
