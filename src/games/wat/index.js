const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-1010');//process.env.SQUISH_PATH);

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
            fill: Colors.COLORS.BLUE,
            onClick: (playerId, x, y) => {
                const color = Colors.COLORS.BLACK;
                const dot = new GameNode.Shape({
                    shapeType: Shapes.POLYGON,
                    coordinates2d: ShapeUtils.rectangle(x - 2, y - 2, 4, 4),
                    fill: color
                });
                this.base.addChild(dot);
            }
        });

        const ting = new GameNode.Asset({
            assetInfo: {
                'test': {
                    pos: {
                        x: 25,
                        y: 25
                    },
                    size: {
                        x: 50,
                        y: 50
                    }
                }
            }
        });
        this.base.addChild(ting);
        console.log('base');
        console.log(this.base);
    }

    handleNewPlayer({ playerId }) {
    }

    handlePlayerDisconnect(playerId) {
    }

    getAssets() {
      console.log("getting assets");
      return {
        'test': new Asset({
          'id': 'a4b5af5adb5af690c0924bb3d468bdad',
          'type': 'image'
        })
      }
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = MyGame;

