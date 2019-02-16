const gameNode = require("../GameNode");
const { colors, randomColor } = require("../Colors");

class TextTest {
    constructor() {
        this.baseText = "Hello, World!";
        this.count = 0;
        this.players = new Set();
        this.base = gameNode(randomColor(), this.handleLayerClick.bind(this), 
            {"x": 0, "y": 0}, {"x": 100, "y": 100}, {"x": 50, "y": 50, "text": this.baseText});
        this.playerCount = gameNode(colors.BLACK, null, {"x": 0, "y": 0}, {"x": 0, "y": 0}, {"x": 50, "y": 25, "text": this.players.size + " players"});
        this.base.addChild(this.playerCount);
    }

    handleLayerClick() {
        this.base.color = randomColor();
        this.base.text.text = this.baseText + " " + ++this.count;
        this.base.text = this.base.text;
    }

    handleNewPlayer(player) {
        this.players.add(player);
        this.updatePlayerCount();
    }

    updatePlayerCount() {
        const playerText = this.players.size == 1 ? "player" : "players";
        this.playerCount.text.text = this.players.size + " " + playerText;
        this.playerCount.text = this.playerCount.text;
    }

    handlePlayerDisconnect(player) {
        this.players.delete(player);
        this.updatePlayerCount();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = TextTest;
