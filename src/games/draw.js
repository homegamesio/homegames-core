const gameNode = require('../GameNode');
const {colors, randomColor} = require('../Colors');
const colorKeys = Object.keys(colors);

class Draw {
    constructor() {
        this.playerColorMap = {};
        this.board = gameNode([0, 128, 128, 255], this.handleBoardClick.bind(this), {'x': 0, 'y': 0}, {'x': 1, 'y': 1});
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
        const initialColor = randomColor();

        this.playerColorMap[player.id] = initialColor;
        
        const setPlayerColor = function(color) {
            this.playerColorMap[player.id] = color;
        }.bind(this);

        const playerColorButton = gameNode(initialColor, function() {
            this.color = randomColor();
            setPlayerColor(this.color);
        }, {'x': 0, 'y': 0}, {'x': .1, 'y': .1});
        this.board.addChild(playerColorButton);
    }

    handleBoardClick(player, x, y) {
        const playerColor = this.playerColorMap[player.id];
        const coloredPixel = gameNode(playerColor, () => {}, {'x': x, 'y': y}, {'x': 1/320, 'y': 1/180});
        this.board.addChild(coloredPixel);
    }

    randomizeBoardColor() {
        const colorIndex = Math.floor(Math.random() * colorKeys.length);
        this.board.color = [0, 128, 128, 255];
    }

    getRoot() {
        return this.board;
    }
}

module.exports = Draw;
