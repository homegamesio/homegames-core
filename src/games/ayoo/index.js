const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-138');
const { COLORS } = Colors;

class CoinFlipp extends Game {
    static metadata() {
        return {
            squishVersion: '138',
            name: 'Coin Flipp',
            author: 'AI',
            description: 'Click the flip button to see who wins.',
            aspectRatio: { x: 16, y: 9 }
        };
    }

    constructor() {
        super();

        this.coin = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 45, 10, 10),
            fill: COLORS.GOLD,
            onClick: (playerId) => this.flipCoin(playerId)
        });

        this.resultText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 80, size: 3, align: 'center', color: COLORS.WHITE }
        });

        this.flipButton = new GameNode.Text({
            textInfo: { text: 'Flip', x: 50, y: 30, size: 2, align: 'center', color: COLORS.WHITE },
            onClick: (playerId) => this.flipCoin(playerId)
        });

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.HG_BLUE
        });

        this.base.addChildren(this.coin, this.resultText, this.flipButton);
    }

    flipCoin(playerId) {
        const result = Math.random() < 0.5 ? "Heads" : "Tails";
        this.resultText.node.text = { text: `${playerId.name} got ${result}`, x: 50, y: 80, size: 3, align: 'center', color: COLORS.WHITE };
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = CoinFlipp;

