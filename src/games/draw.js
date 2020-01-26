const { GameNode, Colors } = require('squishjs');
const Asset = require('../common/Asset');
const Game = require('./Game');

class Draw extends Game {
    static metadata() {
        return {
            res: {
                width: 1920,
                height: 1080
            },
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/draw_thumbnail.jpg'
        };
    }

    constructor() {
        super();
        this.assets = {
            'test': new Asset('url', {
                'location': 'https://www.nicepng.com/png/full/323-3239506_kanye-west-shrug-transparent.png',
                'type': 'image'
            }),
            'home-button': new Asset('url', {
                'location': 'https://d3lgoy70hwd3pc.cloudfront.net/home.png', 
                'type': 'image'
            })
        };

        this.playerColorMap = {};
        this.board = GameNode(
            Colors.PURPLE, 
            this.handleBoardClick.bind(this), 
            {
                'x': 0, 
                'y': 0
            }, 
            {
                'x': 100, 
                'y': 100
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
        const randomizeButton = GameNode(Colors.RED, this.randomizeBoardColor.bind(this), {'x': 80, 'y': 0}, {'x': 15, 'y': 15});
        const resetButton = GameNode(Colors.BLUE, this.initializeBoard.bind(this), {x: 60, y: 0}, {x: 15, y: 15});

        const homeButton = GameNode(Colors.PURPLE, (player) => {
            player.receiveUpdate([5, 70, 0]);
        }, {'x': 3, 'y': 3}, {'x': 8, 'y': 10}, {'text': '', 'x': 0, 'y': 0}, {'home-button': {pos: {x: 3, y: 3}, size: {x: 8, y: 10}}});

        this.board.clearChildren();
        this.homeButton = homeButton;

        this.board.addChild(homeButton);
        this.board.addChild(randomizeButton);
        this.board.addChild(resetButton);
    }

    handleNewPlayer() {
    }

    handlePlayerDisconnect() {
    }

    getAssets() {
        return this.assets;
    }

    handleBoardClick(player, x, y) {
        const coloredPixel = GameNode(Colors.randomColor(), () => {}, {'x': (x * 100) - .25, 'y': (y * 100) - .25}, {'x': .5, 'y': .5}, 
            {
                'text': '',
                x: 0,
                y: 0
            });
 
        this.board.addChild(coloredPixel);
    }

    randomizeBoardColor() {
        const color = Colors.randomColor();
        this.board.color = color;
        this.homeButton.color = color;
    }

    getRoot() {
        return this.board;
    }
}

module.exports = Draw;
