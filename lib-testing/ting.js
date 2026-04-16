console.log('fnfifif');
const { Game, GameNode, Colors, Shapes, ShapeUtils } = require(process.env.SQUISH_VERSION);

class MyGame extends Game {
    static metadata() {
        return {
            aspectRatio: { x: 16, y: 9 },
            squishVersion: '1010',
            author: 'Unknown',
            description: 'A new Homegames game'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE,
            onClick: (playerId, x, y) => {
                const color = Colors.randomColor();
                //const dot = new GameNode.Shape({
                //    shapeType: Shapes.POLYGON,
                //    coordinates2d: ShapeUtils.rectangle(x - 2, y - 2, 4, 4),
                //    fill: color
                //});
                //this.base.addChild(dot);
            }
        });
        console.log('base');
        console.log(this.base);
    }

    handleNewPlayer({ playerId }) {
    }

    handlePlayerDisconnect(playerId) {
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = MyGame;
