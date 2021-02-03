const { Game, GameNode, Colors, Shapes } = require('squish-0633');

class LayerTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0633',
            tickRate: 100,
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/layer-test.png'
        };
    }

    constructor() {
        super();
        const baseColor = Colors.randomColor();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: baseColor,
            onClick: this.handleLayerClick
        });

        const increment = 1;
        let prev = this.base;
        for (let i = increment; i < 50; i+= 2 * increment) {
            const childColor = Colors.randomColor();
            const child = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: [
                    [i, i],
                    [i + 100 - (2 * i), i],
                    [i + 100 - (2 * i), i + 100 - (2 * i)],
                    [i, i + 100 - (2 * i)],
                    [i, i]
                ],
                fill: childColor,
                onClick: this.handleLayerClick
            });
            prev.addChild(child);
            prev = child;
        }
    }

    tick() {
        if (this.lastMessageNode) {
            const now = Date.now();
            this.lastMessageNode.node.text.text = `Last message: ${now - this.lastMessage}ms ago`;

            this.lastMessage = now;
            this.lastMessageNode.node.id = this.lastMessageNode.node.id;
        } else {
            this.lastMessage = Date.now();
            this.lastMessageNode = new GameNode.Text({
                textInfo: {
                    text: `Last message: ${Date.now()}`,
                    size: 1,
                    x: 12, 
                    y: 1.5,
                    color: [255, 255, 255, 255],
                    align: 'center'
                }
            });
            this.base.addChild(this.lastMessageNode);
        }
    }

    handleNewPlayer() {
    }

    handlePlayerDisconnect() {
    }

    handleLayerClick() {
        const newColor = Colors.randomColor();
        this.color = newColor;
        this.fill = newColor;
    }

    getRoot() {
        return this.base;
    }
}

module.exports = LayerTest;
