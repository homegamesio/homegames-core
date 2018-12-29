const gameNode = require('../GameNode');
const colors = require('../Colors');
const colorKeys = Object.keys(colors);

class Draw {
    constructor() {
        const board = gameNode(colors.PURPLE, this.handleBoardClick.bind(this), {'x': 0, 'y': 0}, {'x': 1, 'y': 1});
        const randomizeButton = gameNode(colors.RED, this.randomizeBoardColor.bind(this), {'x': .8, 'y': 0}, {'x': .15, 'y': .15});
        board.addChild(randomizeButton);
        this.board = board;
    }
    
    handleBoardClick(x, y) {
        const coloredPixel = gameNode(colors.BLACK, () => {}, {'x': x, 'y': y}, {'x': .0016, 'y': .0009});
        this.board.addChild(coloredPixel);
    }

    randomizeBoardColor() {
        const colorIndex = Math.floor(Math.random() * colorKeys.length);
	    this.board.color = colors[colorKeys[colorIndex]];
    }

    getRoot() {
        return this.board;
    }
}

module.exports = Draw;
