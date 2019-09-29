const { Asset, GameNode, Colors, Deck } = require('../common');

class Test1 {
    constructor() {
        this.players = {};
        this.base = GameNode(Colors.BLUE, null, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': "0", x: 50, y: 5});
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

module.exports = Test1;
