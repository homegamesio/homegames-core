const gameNode = require("./GameNode");
const { randomColor } = require("./Colors");
const MoveTest = require('./games/move-test');

class GameSelector {
    constructor() {
        this.base = gameNode(randomColor(), null, 
            {"x": 0, "y": 0}, {"x": 100, "y": 100});

        this.moveTestOption = gameNode(randomColor(), () => this.startGame('MoveTest'), {'x': 10, 'y': 10}, {'x': 10, 'y': 10}); 
        this.base.addChild(this.moveTestOption);
    }

    startGame(gameName) {
        this.currentGame = new MoveTest();
        console.log(this.squisher);
        this.currentGame.squisher = this.squisher;
        this.base.addChild(this.currentGame.getRoot());
    }

    handleKeyDown(player, key) {
        this.currentGame && this.currentGame.handleKeyDown(player, key);    
    }

    handleKeyUp(player, key) {
        this.currentGame && this.currentGame.handleKeyUp(player, key); 
    }

    getRoot() {
        return this.base;
    }
}

module.exports = GameSelector;
