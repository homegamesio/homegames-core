const { Asset, gameNode, Colors, Deck } = require('../common');

class Test2 {
    constructor() {
        this.players = {};
        this.base = gameNode(Colors.BLUE, null, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': "none", x: 50, y: 5});
    }

    handleNewPlayer(player) {
        this.players[player.id] = player;        
        let textCopy = this.base.text;
        textCopy.text = Object.keys(this.players).length;
        this.base.text = textCopy;    
    }

    handlePlayerDisconnect(player) {
        delete this.players[player.id];
        let textCopy = this.base.text;
        textCopy.text = Object.keys(this.players).length;
        this.base.text = textCopy; 
    }

    getRoot() {
        return this.base;
    }

}

module.exports = Test2;
