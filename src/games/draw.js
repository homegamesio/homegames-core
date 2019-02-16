const gameNode = require("../GameNode");
const {colors, randomColor} = require("../Colors");
const colorKeys = Object.keys(colors);
const Asset = require("../Asset");

class Draw {
    constructor() {
        this.assets = {
            "test": new Asset("url", {
                "location": "https://www.nicepng.com/png/full/323-3239506_kanye-west-shrug-transparent.png"
            })
        };

        this.playerColorMap = {};
        this.board = gameNode(
            colors.PURPLE, 
            this.handleBoardClick.bind(this), 
            {
                "x": 0, 
                "y": 0
            }, 
            {
                "x": 100, 
                "y": 100
            },
            {
                "x": 0,
                "y": 0,
                "text": "what"
            },
            {
                "test": {
                    size: {
                        x: 5,
                        y: 5
                    },
                    pos: {
                        x: 47,
                        y: 5
                    }
                }
            }
        );
        this.initializeBoard();
    }

    initializeBoard() {
        const randomizeButton = gameNode(colors.RED, this.randomizeBoardColor.bind(this), {"x": 80, "y": 0}, {"x": 15, "y": 15});
        const resetButton = gameNode(colors.BLUE, this.initializeBoard.bind(this), {x: 60, y: 0}, {x: 15, y: 15});

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
        }, {"x": 0, "y": 0}, {"x": 10, "y": 10});
        this.board.addChild(playerColorButton);
    }

    getAssets() {
        return this.assets;
    }

    handleBoardClick(player, x, y) {
        const playerColor = this.playerColorMap[player.id];
        const coloredPixel = gameNode(playerColor, () => {}, {"x": x * 100, "y": y * 100}, {"x": 200/320, "y": 200/180});
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
