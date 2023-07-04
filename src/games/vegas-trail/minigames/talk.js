const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-1000');

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
                coordinates2d: ShapeUtils.rectangle(15, 75, 70, 25),
                fill: Colors.COLORS.HG_BLACK
            });


            this.guy = new GameNode.Asset({
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
                    text: 'Hello! You should not be able to read this yet.',
                    color: Colors.COLORS.WHITE
                }
            });

            this.blackBox.addChildren(this.guy, this.text);
            this.scene.addChildren(this.blackBox);
            this.root.addChild(this.scene);
        }
    }

    update() {
        const options = talkOptions.items.filter(o => !o.zones || !o.zones.length || o.zones.indexOf(this.zone) >= 0);
        const randIndex = Math.floor(options.length * Math.random()); 
        const randOption = options[randIndex];

        const textNodes = [];

        const lines = randOption.lines;

        const mainTextNode = new GameNode.Text({
            textInfo: {
                x: 50, 
                y: 76,
                align: 'center',
                size: 1.6,
                font: 'amateur',
                text: lines[0],
                color: Colors.COLORS.WHITE
            }
        });

        const newNodes = [];
        for (let i = 1; i < lines.length; i++) {
            const newNode = new GameNode.Text({
                textInfo: {
                    x: 50, 
                    y: 76 + (i * 7),
                    align: 'center',
                    size: 1.6,
                    font: 'amateur',
                    text: lines[i],
                    color: Colors.COLORS.WHITE
                }
            });

            mainTextNode.addChild(newNode);
        }

        const newAssetKey = 'guy-' + Math.max(1, Math.floor(Math.random() * 10 % 5));

        const newAssetInfo = {
            [newAssetKey]: {
                pos: {
                    x: 40,
                    y: 55
                },
                size: {
                    x: 20,
                    y: 20
                }
            }
        };

        this.guy.node.asset = newAssetInfo;

        this.blackBox.removeChild(this.text.id);
        this.text.node.free();

        this.text = mainTextNode;
        this.blackBox.addChild(mainTextNode);
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
