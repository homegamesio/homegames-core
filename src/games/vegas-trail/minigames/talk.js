const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');

const talkOptions = require('../talk-options.js');

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

            this.blackBox = new GameNode.Shape({
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

            this.text = new GameNode.Text({
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

            this.blackBox.addChildren(guy, this.text);
            this.scene.addChildren(this.blackBox);
            this.root.addChild(this.scene);
        }
    }

    update() {
        console.log('sdfdsfdsf')
        const options = talkOptions.items.filter(o => !o.zones || !o.zones.length || o.zones.indexOf(this.zone) >= 0);
        const randIndex = Math.floor(options.length * Math.random()); 
        const randOption = options[randIndex];
        console.log('option!');
        console.log(randOption);


        this.text.node.text = {
            x: 50,
            y: 80,
            align: 'center',
            size: 1.6,
            font: 'amateur',
            text: randOption.text,
            color: Colors.COLORS.WHITE
        }

    }

    handleNewZone(zone) {
        this.zone = zone;
        const newId = `background-${zone}`;

        const newAssetInfo = {
            [newId]: {
                pos: {
                    x: 0,
                    y: 10
                },
                size: {
                    x: 100,
                    y: 90
                }
            }
        };

        this.scene.node.asset = newAssetInfo;
    }

    spawnObstacle() {
    }

    getRoot() {
        return this.root;
    }
}

module.exports = Talk;
