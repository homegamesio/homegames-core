const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-1006');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class TextInputTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            squishVersion: '1006',
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

        this.currentKey = null;

        this.allText = '';
    }

    handleKeyDown(player, key) {
        const now = Date.now();
        
//        let debounceMillis = 20;

//        if (this.currentKey && this.currentKey === key) {
//            debounceMillis = 250;
//        }

        if (!this.lastKeyDown || this.lastKeyDown + debounceMillis < now) {
            this.lastKeyDown = now;
            this.currentKey = key;
        }
    }

    handleKeyUp(playerId, key) {
    //    this.lastKeyDown = null;
    //    this.currentKey = null;
    }

    tick() {
        const now = Date.now();
        if (this.currentKey && (!this.allText || this.currentKey !== this.allText.charAt(this.allText.length - 1))) {// && (this.lastKeyDown && this.lastKeyDown + 250 < now)) {
            this.allText += this.currentKey;
            const rowLength = 24;
            const textSize = 4;

            const textX = textSize * (this.allText.length % rowLength);
            const textY = 2.6 * textSize * Math.floor(this.allText.length / rowLength);
            const textNode = new GameNode.Text({
                textInfo: {
                    x: textX,
                    y: textY,
                    text: this.currentKey,
                    align: 'left',
                    color: COLORS.BLACK,
                    size: 5,
                    font: 'amateur'
                }
            });
            this.whiteBase.addChild(textNode);
            this.currentKey = null;
        }

        this.whiteBase.node.onStateChange();
    }

    getLayers() {
        return [{root: this.whiteBase}];
    }

}

module.exports = TextInputTest;
