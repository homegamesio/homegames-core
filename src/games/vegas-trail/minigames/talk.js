const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');

class Talk {
    constructor() {
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE
        });
    }

    tick({ playerStates, resources}) {
        if (!this.scene) {

            this.scene = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    0,
                    10,
                    100,
                    90
                ),
                assetInfo: {
                    'background-1': {
                        pos: {
                            x: 0,
                            y: 10
                        },
                        size: {
                            x: 100,
                            y: 90
                        }
                    }
                }
            });

            const blackBox = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(25, 75, 50, 25),
                fill: Colors.COLORS.HG_BLACK
            });


            const guy = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    40,
                    55,
                    20,
                    20
                ),
                assetInfo: {
                    'guy-1': {
                        pos: {
                            x: 40,
                            y: 55
                        },
                        size: {
                            x: 20,
                            y: 20
                        }
                    }
                }
            });

            const text = new GameNode.Text({
                textInfo: {
                    x: 50,
                    y: 80,
                    align: 'center',
                    size: 1.6,
                    font: 'amateur',
                    text: 'ayy lmao! this will be more interesting.',
                    color: Colors.COLORS.WHITE
                }
            });

            blackBox.addChildren(guy, text);
            this.scene.addChildren(blackBox);
            this.root.addChild(this.scene);
        }
    }

    spawnObstacle() {
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Talk;
