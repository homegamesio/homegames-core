const { Game, GameNode, Colors } = require('squishjs');
const Asset = require('../common/Asset');

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

        this.board.clearChildren();

        this.board.addChild(randomizeButton);
        this.board.addChild(resetButton);
    }

    getAssets() {
        return this.assets;
    }

    handleBoardClick(player, x, y) {
        const coloredPixel = GameNode(Colors.randomColor(), () => {}, {'x': (x) - .25, 'y': (y) - .25}, {'x': .5, 'y': .5}, 
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
    }

    getRoot() {
        return this.board;
    }
}

module.exports = Draw;
