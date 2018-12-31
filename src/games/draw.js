const gameNode = require('../GameNode');
const {colors, randomColor} = require('../Colors');
const colorKeys = Object.keys(colors);

class Draw {
    constructor() {
        this.playerColorMap = {};
        this.board = gameNode(colors.PURPLE, this.handleBoardClick.bind(this), {'x': 0, 'y': 0}, {'x': 1, 'y': 1});
        this.initializeBoard();
    }

    initializeBoard() {
        const randomizeButton = gameNode(colors.RED, this.randomizeBoardColor.bind(this), {'x': .8, 'y': 0}, {'x': .15, 'y': .15});
        const resetButton = gameNode(colors.BLUE, this.initializeBoard.bind(this), {x: .6, y: 0}, {x: .15, y: .15});

        this.board.clearChildren();

        this.board.addChild(randomizeButton);
        this.board.addChild(resetButton);
    }

    handleNewPlayer(player) {
        this.playerColorMap[player.id] = colors.GREEN;
        const setPlayerColor = function() {
            this.playerColorMap[player.id] = colors.BLACK;
        }.bind(this);

        const playerColorButton = gameNode(colors.GREEN, function() {
            this.color = colors.BLACK;
            setPlayerColor();
        }, {'x': 0, 'y': 0}, {'x': .1, 'y': .1});
        this.board.addChild(playerColorButton);
    }

    handleBoardClick(player, x, y) {
        const playerColor = this.playerColorMap[player.id];
        const coloredPixel = gameNode(playerColor, () => {}, {'x': x, 'y': y}, {'x': .01, 'y': .01});
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
