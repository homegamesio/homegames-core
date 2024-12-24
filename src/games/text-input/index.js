const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-112');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class TextInputTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: '60ec3952ee0466086329b9be33582511',
            squishVersion: '112',
            isTest: true
        };
    }

    constructor() {
        super();

        this.currentKeys = [];
        this.whiteBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.WHITE
        });

        this.currentKey = null;

        this.allText = '';
    }

    handleKeyDown(player, key) {
        this.currentKeys.push(key);
    }

    handleKeyUp(playerId, key) {
    }

    tick() {
        const now = Date.now();
        if (this.currentKeys.length > 0) {
            const counts = {};
            let highest = null;
            for (let i = 0; i < this.currentKeys.length; i++) {
                const cur = this.currentKeys[i];
                if (!counts[cur]) {
                    counts[cur] = 0;
                }
                counts[cur] += 1;
                if (!highest || highest.count < counts[cur]) {
                    highest = { count: counts[cur], key: cur };
                }
            }
            if (highest) {
                this.currentKey = highest.key;
            }
            this.currentKeys = [];
        }
        if (this.currentKey) {
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
            this.lastKeyDown = now;
            this.currentKey = null;
        }
        
    }

    //tick() {
    //    const now = Date.now();
    //    if (this.currentKey && (!this.allText || this.currentKey !== this.allText.charAt(this.allText.length - 1))) {// && (this.lastKeyDown && this.lastKeyDown + 250 < now)) {
    //        this.allText += this.currentKey;
    //        const rowLength = 24;
    //        const textSize = 4;

    //        const textX = textSize * (this.allText.length % rowLength);
    //        const textY = 2.6 * textSize * Math.floor(this.allText.length / rowLength);
    //        const textNode = new GameNode.Text({
    //            textInfo: {
    //                x: textX,
    //                y: textY,
    //                text: this.currentKey,
    //                align: 'left',
    //                color: COLORS.BLACK,
    //                size: 5,
    //                font: 'amateur'
    //            }
    //        });
    //        this.whiteBase.addChild(textNode);
    //        this.currentKey = null;
    //    }

    //    this.whiteBase.node.onStateChange();
    //}

    getLayers() {
        return [{root: this.whiteBase}];
    }

}

module.exports = TextInputTest;
