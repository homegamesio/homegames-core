const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-061');

class PerfTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '061',
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

    getRoot() {
        return this.base;
    }

}

module.exports = PerfTest;
