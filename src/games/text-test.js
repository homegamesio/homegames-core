const { gameNode, Colors } = require('../common');

class TextTest {
    constructor() {
        this.baseText = 'Hello, World!';
        this.count = 0;
        this.base = gameNode(Colors.randomColor(), this.handleLayerClick.bind(this), 
            {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'x': 50, 'y': 50, 'text': this.baseText});
        this.playerCount = gameNode(Colors.BLACK, null, {'x': 0, 'y': 0}, {'x': 0, 'y': 0}, {'x': 50, 'y': 25, 'text': ''});
        this.base.addChild(this.playerCount);
    }

    handleLayerClick() {
        this.base.color = Colors.randomColor();
        this.base.text.text = this.baseText + ' ' + ++this.count;
        this.base.text = this.base.text;
    }

    handleNewPlayer() {
        this.updatePlayerCount();
    }

    updatePlayerCount() {
        const playerText = Object.values(this.players).length == 1 ? 'player' : 'players';
        this.playerCount.text.text = Object.values(this.players).length + ' ' + playerText;
        this.playerCount.text = this.playerCount.text;
    }

    handlePlayerDisconnect() {
        this.updatePlayerCount();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = TextTest;
