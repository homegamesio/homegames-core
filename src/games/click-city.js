let { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const Asset = require('../common/Asset');

Colors = Colors.COLORS;

class ClickCity extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            tickRate: 1
        };
    }

    constructor() {
        super();

        this.atkPow = 10;
        this.score = 0;

        this.base = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            }
        );

        let ting = this;
        this.enemyMap = {
            'dude1': () => {
                const thing = {
                    points: 420,
                    node: new GameNode.Asset(
                        () => {
                            thing.health -= this.atkPow;
                            if (thing.health <= 0) {
                                ting.base.removeChild(thing.node.id);                                
                                ting.dude = null;
                                ting.score += thing.points;
                                ting.updatePlayerView(1);
                            }
                        },
                        ShapeUtils.rectangle(40, 40, 20, 20),
                        {
                            'triangle-dude': {
                                pos: {
                                    x: 40,
                                    y: 40
                                },
                                size: {
                                    x: 20,
                                    y: 20
                                }
                            }
                        }
                    ),
                    health: 400,
                    attack: 2,
                    attackRate: .2
                }
                return thing;
            },
            'dude2': () => {
                const thing = {
                    points: 200,
                    node: new GameNode.Asset(
                        () => {
                            thing.health -= this.atkPow;
                            if (thing.health <= 0) {
                                ting.base.removeChild(thing.node.id);                                
                                ting.dude = null;
                                ting.score += thing.points;
                                ting.updatePlayerView(1);
                            }
                        },
                        ShapeUtils.rectangle(40, 40, 20, 20),
                        {
                            'hexagon-dude': {
                                pos: {
                                    x: 40,
                                    y: 40
                                },
                                size: {
                                    x: 20,
                                    y: 20
                                }
                            }
                        }
                    ),
                    health: 200,
                    attack: 2,
                    attackRate: .2
                }
                return thing;
            }
        }

        this.viewRoot = new GameNode.Shape(
            Colors.WHITE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            }
        );

        this.playerStates = {};

        this.base.addChildren(this.viewRoot);
    }

    tick() {
        if (this.dude) {
            return;
        } 
        const ran = Math.random();
        const enemyType = ran > .5 ? 'dude1' : 'dude2';
        const dudeNode = this.enemyMap[enemyType]();
        console.log(dudeNode);
        this.dude = dudeNode;
        this.base.addChild(this.dude.node);
    //    console.log("hello!");
//        this.runPlayerStuff();
    }

    runPlayerStuff() {
        for (const playerId in this.players) {
        }
    }

    getRoot() {
        return this.base;
    }

    updatePlayerView(playerId) {
        // todo:
        // shared nodes w/ multiple player IDs 
        for (const nodeIndex in this.viewRoot.node.children) {
            if (this.viewRoot.node.children[nodeIndex].node.playerId == playerId) {
                this.viewRoot.removeChild(this.viewRoot.node.children[nodeIndex].node.id);
            }
        }

        const playerRoot = new GameNode.Shape(
            Colors.BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
            },
            playerId
        );

        const scoreText = new GameNode.Text({
            text: this.score + '',
            x: 25, 
            y: 1,
            align: 'center',
            color: Colors.GREEN,
            size: 5
        });

        const menu = new GameNode.Shape(
            Colors.BLACK,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 10),
                fill: Colors.BLACK
            },
            playerId
        );

        const cityButton = new GameNode.Shape(
            Colors.BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(70, 2, 10, 6),
                fill: Colors.BLUE
            },
            playerId,
            (player, x, y) => {
                console.log(x);
                console.log(y);
                // todo: player views
                this.playerStates[player.id] = {
                    view: 'city'
                };
                this.updatePlayerView(player.id);
            }
        );

        const cityText = new GameNode.Text({
            text: "City",
            x: 75, 
            y: 3.5,
            align: "center",
            color: Colors.WHITE,
            size: 2
        }, playerId);

        const clickerButton = new GameNode.Shape(
            Colors.RED,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(40, 2, 10, 6),
                fill: Colors.RED
            },
            playerId,
            (player, x, y) => {
                // todo: player views
                this.playerStates[player.id] = {
                    view: 'clicker'
                };
                this.updatePlayerView(player.id);
            }
        );

        const clickerText = new GameNode.Text({
            text: "Clicker",
            x: 45, 
            y: 3.5,
            align: "center",
            color: Colors.WHITE,
            size: 2
        }, playerId);

        if (this.playerStates[playerId].view === 'clicker') {
            const clickerView = new GameNode.Shape(
                Colors.RED,
                Shapes.POLYGON,
                {
                    coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                    fill: Colors.RED
                },
                playerId
            );

            playerRoot.addChild(clickerView);
        } else {
            const cityView = new GameNode.Shape(
                Colors.BLUE,
                Shapes.POLYGON,
                {
                    coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                    fill: Colors.BLUE
                },
                playerId
            );

            playerRoot.addChild(cityView);
        }

        cityButton.addChild(cityText);
        clickerButton.addChild(clickerText);

        menu.addChild(cityButton);
        menu.addChild(clickerButton);
        
        playerRoot.addChild(menu);
        playerRoot.addChild(scoreText);
        
        this.viewRoot.addChild(playerRoot);
    }

    handleNewPlayer(player) {
        this.playerStates[player.id] = {
            view: 'clicker'
        };
        this.updatePlayerView(player.id);
    }

    getAssets() {
        return {
            'triangle-dude': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/triangle.png',
                'type': 'image'
            }),
            'hexagon-dude': new Asset('url', {
                'location': 'https://homegamesio.s3-us-west-1.amazonaws.com/sprites/hexagon.png',
                'type': 'image'
            })
        }
    }

}

module.exports = ClickCity;
