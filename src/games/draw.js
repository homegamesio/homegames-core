let { Colors, Game, GameNode, Shapes, ShapeUtils } = require('squishjs');
const Asset = require('../common/Asset');

Colors = Colors.COLORS;

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
        const boardShape = ShapeUtils.rectangle(5, 5, 90, 90);

        this.board = new GameNode.Shape(
            Colors.PURPLE,
            Shapes.POLYGON,
            {
                coordinates2d: boardShape,
                fill: Colors.PURPLE
            },
            null,
            this.handleBoardClick.bind(this)
        );

        this.initializeBoard();
    }

    initializeBoard() {
        const randomizeButtonShape = ShapeUtils.rectangle(80, 0, 15, 15);
        const randomizeButton = new GameNode.Shape(
            Colors.RED, 
            Shapes.POLYGON,
            {
                coordinates2d: randomizeButtonShape,
                fill: Colors.RED
            },
            null,
            this.randomizeBoardColor.bind(this));

        const resetButtonShape = ShapeUtils.rectangle(60, 0, 15, 15);
        const resetButton = new GameNode.Shape(
            Colors.BLUE, 
            Shapes.POLYGON,
            {
                coordinates2d: resetButtonShape,
                fill: Colors.BLUE
            },
            null,
            this.initializeBoard.bind(this));

        this.board.clearChildren();

        this.board.addChild(randomizeButton);
        this.board.addChild(resetButton);
    }

    getAssets() {
        return this.assets;
    }

    handleBoardClick(player, x, y) {
        const pixelColor = Colors.BLACK;
        const pixelShape = ShapeUtils.rectangle(x - .25, y - .25, .5, .5);
        const coloredPixel = new GameNode.Shape(
            pixelColor,
            Shapes.POLYGON,
            {
                coordinates2d: pixelShape,
                fill: pixelColor
            }
        );
 
        this.board.addChild(coloredPixel);
    }

    randomizeBoardColor() {
        const color = Colors.randomColor();
        this.board.node.color = color;
        this.board.node.fill = color;
    }

    getRoot() {
        return this.board;
    }
}

module.exports = Draw;
