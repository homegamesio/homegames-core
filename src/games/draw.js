const { Asset, gameNode, Colors } = require("../common");

class Draw {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: "Joseph Garcia",
            thumbnail: "https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/draw_thumbnail.jpg"
        };
    }

    constructor() {
        this.assets = {
            "test": new Asset("url", {
                "location": "https://www.nicepng.com/png/full/323-3239506_kanye-west-shrug-transparent.png",
                "type": "image"
            }),
            "home-button": new Asset("url", {
                "location": "https://d3lgoy70hwd3pc.cloudfront.net/home.png", 
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
                "text": "",
                x: 0,
                y: 0
            },
            {
                "test": {
                    "pos": {
                        x: 20,
                        y: 20
                    },
                    "size": {
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

        const homeButton = gameNode(Colors.PURPLE, (player) => {
            player.receiveUpdate([5, 70, 0]);
        }, {"x": 3, "y": 3}, {"x": 8, "y": 10}, {"text": "", "x": 0, "y": 0}, {"home-button": {pos: {x: 3, y: 3}, size: {x: 8, y: 10}}});

        this.board.clearChildren();
        this.homeButton = homeButton;

        this.board.addChild(homeButton);
        this.board.addChild(randomizeButton);
        this.board.addChild(resetButton);
    }

    logPlayerCount() {
    }

    handleNewPlayer() {
        this.logPlayerCount();
    }

    handlePlayerDisconnect() {
        this.logPlayerCount();
    }

    getAssets() {
        return this.assets;
    }

    handleBoardClick(player, x, y) {
        const coloredPixel = gameNode(Colors.randomColor(), () => {}, {"x": (x * 100) - .25, "y": (y * 100) - .25}, {"x": .5, "y": .5}, 
            {
                "text": "",
                x: 0,
                y: 0
            });
 
        this.board.addChild(coloredPixel);
    }

    randomizeBoardColor() {
        let color = Colors.randomColor();
        this.board.color = color;
        this.homeButton.color = color;
    }

    getRoot() {
        return this.board;
    }
}

module.exports = Draw;
