const { Asset, gameNode, Colors, Deck } = require('../common');

class Draw {
    constructor() {
        this.assets = {
            "test": new Asset("url", {
                "location": "https://www.nicepng.com/png/full/323-3239506_kanye-west-shrug-transparent.png",
                "type": "image"
            }),
            "home-button": new Asset("url", {
                "location": "https://d3lgoy70hwd3pc.cloudfront.net/home2.png", 
                "type": "image"
            })
        };

        this.playerColorMap = {};
        this.board = gameNode(
            Colors.PURPLE, 
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
                'text': '',
                x: 0,
                y: 0
            },
            {
                'test': {
                    'pos': {
                        x: 20,
                        y: 20
                    },
                    'size': {
                        x: 10,
                        y: 10
                    }
                }
            }
        );
        this.initializeBoard();
    }

    initializeBoard() {
        const randomizeButton = gameNode(Colors.RED, this.randomizeBoardColor.bind(this), {"x": 80, "y": 0}, {"x": 15, "y": 15});
        const resetButton = gameNode(Colors.BLUE, this.initializeBoard.bind(this), {x: 60, y: 0}, {x: 15, y: 15});

        const homeButton = gameNode(Colors.PURPLE, (player, x, y) => {
            player.receiveUpdate([5, 70, 0]);
        }, {"x": 3, "y": 3}, {"x": 8, "y": 10}, {'text': '', 'x': 0, 'y': 0}, {'home-button': {pos: {x: 3, y: 3}, size: {x: 8, y: 10}}});

        this.board.clearChildren();

        this.board.addChild(homeButton);
        this.board.addChild(randomizeButton);
        this.board.addChild(resetButton);
    }

    handleNewPlayer(player) {
//        const initialColor = Colors.randomColor();

//        this.playerColorMap[player.id] = initialColor;
        
//        const setPlayerColor = function(color) {
//            this.playerColorMap[player.id] = color;
//        }.bind(this);

//        const playerColorButton = gameNode(initialColor, function() {
//            this.color = Colors.randomColor();
//            setPlayerColor(this.color);
//        }, {"x": 0, "y": 0}, {"x": 10, "y": 10});
//        this.board.addChild(playerColorButton);
    }

    getAssets() {
        return this.assets;
    }

    handleBoardClick(player, x, y) {
        const coloredPixel = gameNode(Colors.randomColor(), () => {}, {"x": x * 100, "y": y * 100}, {"x": .5, "y": .5});
        this.board.addChild(coloredPixel);
    }

    randomizeBoardColor() {
        this.board.color = Colors.randomColor();
    }

    getRoot() {
        return this.board;
    }
}

module.exports = Draw;
