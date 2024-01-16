const { Asset, Colors, Game, GameNode, Shapes, ShapeUtils } = require('squish-1006');

const COLORS = Colors.COLORS;

class Draw extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '1006',
            author: 'Joseph Garcia',
            thumbnail: '1e844026921f7662a62ce72da869da63'
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
