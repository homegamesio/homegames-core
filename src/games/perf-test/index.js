const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0633');

class PerfTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0633',
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/perf-test.png'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.WHITE
        });

        let xCounter = 0;
        let yCounter = 0;

        const filler = this.setInterval(() => {
            const dotColor = Colors.randomColor();
            const dot = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(xCounter, yCounter, 1, 1),
                fill: dotColor
            });

            this.base.addChild(dot);
            xCounter += 1;
            if (xCounter >= 100) {
                xCounter = 0;
                yCounter++;
            }

            if (yCounter == 100 && xCounter == 100) {
                clearInterval(filler);
            }

        }, 20);
    }

    getLayers() {
        return [{root: this.base}];
    }

}

module.exports = PerfTest;
