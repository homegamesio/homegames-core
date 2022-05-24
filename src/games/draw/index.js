const { Colors, Game, GameNode, Shapes, ShapeUtils } = require('squish-0740');
const Asset = require('../../common/Asset');

const COLORS = Colors.COLORS;

class Draw extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0740',
            author: 'Joseph Garcia',
            thumbnail: 'c7b7df6b3a90ccfde66f20e759093ea6'
        };
    }

    constructor() {
        super();

        this.playerColorMap = {};
        const boardShape = ShapeUtils.rectangle(0, 0, 100, 100);

        this.board = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: boardShape,
            fill: COLORS.PURPLE,
            onClick: this.handleBoardClick.bind(this)
        });

        this.initializeBoard();
    }

    initializeBoard() {
        const randomizeButtonShape = ShapeUtils.rectangle(80, 0, 15, 15);
        const randomizeButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: randomizeButtonShape,
            fill: COLORS.RED,
            onClick: this.randomizeBoardColor.bind(this)
        });

        const resetButtonShape = ShapeUtils.rectangle(60, 0, 15, 15);
        const resetButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: resetButtonShape,
            fill: COLORS.BLUE,
            onClick: this.initializeBoard.bind(this)
        });

        this.board.clearChildren();

        this.board.addChild(randomizeButton);
        this.board.addChild(resetButton);
    }

    handleBoardClick(player, x, y) {
        const pixelColor = COLORS.BLACK;
        const pixelShape = ShapeUtils.rectangle(x - .25, y - .25, .5, .5);
        const coloredPixel = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: pixelShape,
            fill: pixelColor
        });
 
        this.board.addChild(coloredPixel);
    }

    randomizeBoardColor() {
        const color = Colors.randomColor();
        this.board.node.color = color;
        this.board.node.fill = color;
    }

    // getRoot() {
    //     return this.board;
    // }

    getLayers() {
        return [{root: this.board}];
    }
}

module.exports = Draw;
