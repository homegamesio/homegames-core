const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-120');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class MemTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            squishVersion: '120',
            thumbnail: '658b3d5893cc42549df45d71cd120591',
            isTest: true
        };
    }

    constructor() {
        super();

        this.whiteBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.WHITE
        });
    }

    tick() {
        const newNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(40, 40, 20, 20),
            fill: COLORS.RED
        });


        newNode.node.coordinates2d = newNode.node.coordinates2d;

        if (this.lastNode) {
            this.whiteBase.removeChild(this.lastNode.id);
        }

        this.lastNode = newNode;

        this.whiteBase.addChild(newNode);
        this.whiteBase.node.onStateChange();
    }

    handleLayerClick() {
        const newColor = Colors.randomColor();
        this.color = newColor;
        this.fill = newColor;
    }

    getLayers() {
        return [{root: this.whiteBase}];
    }

}

module.exports = MemTest;
