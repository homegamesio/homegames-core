const dictionary = require('../../common/util/dictionary');

const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils } = require('squish-0762');

const COLORS = Colors.COLORS;

const BALL_SIZE = 5;

class Sponge extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 4, y: 3},
            description: 'Never heard of it.',
            author: 'Joseph Garcia',
            thumbnail: '4b5f169186bc542e14b5d001d25ce6bb',
            squishVersion: '0762',
            maxPlayers: 2
        };
    }

    constructor() {
        super();

        this.assets = {
            'beep': new Asset({
                'id': '9bac660eeffa7443d417cbba484e00da',
                'type': 'audio'
            }),
            'boop': new Asset({
                'id': '3f7087dfde98b0d7acd99824f3ef4626',
                'type': 'audio'
            }),
            'pluck': new Asset({
                'id': 'd56e115f08d4324667f697cd2200e042',
                'type': 'audio'
            }),
            'sink': new Asset({
                'id': '9f0c25811d212b5211512a92deb84985',
                'type': 'image'
            }),
            'ball': new Asset({
                'id': 'd250c7dae976f096f26caf97eeaf8bfa',
                'type': 'image'
            }),
            'left-paddle': new Asset({
                'id': '6bd1f090f531fbf17c34746af6696776',
                'type': 'image'
            }),
            'right-paddle': new Asset({
                'id': '4b1a650712d18a5ddfcbf08d6599d69a',
                'type': 'image'
            })
        };

        this.players = {};
        this.clickHandlers = {};

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.BLACK,
            onClick: (playerId, x, y) => this.clickHandlers[playerId] ? this.clickHandlers[playerId](x, y) : null
        });

        const sinkAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            assetInfo: {
                'sink': {
                    'pos': {x: 0, y: 0 },
                    'size': {x: 100, y: 100}
                }
            }
        });
    
        const ball = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(48, 48, BALL_SIZE, BALL_SIZE),
            fill: COLORS.WHITE
        });

        const ballAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(48, 48, BALL_SIZE, BALL_SIZE),
            assetInfo: {
                'ball': {
                    'pos': {x: 48, y: 48 },
                    'size': {x: BALL_SIZE, y: BALL_SIZE}
                }
            }
        });

        const leftPaddle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 40, 5, 25),
            fill: COLORS.WHITE
        });

        const leftPaddleAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 40, 5, 25),
            assetInfo: {
                'left-paddle': {
                    'pos': {x: 0, y: 40 },
                    'size': {x: 5, y: 25}
                }
            }
        });

        const rightPaddle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(95, 40, 5, 25),
            fill: COLORS.WHITE 
        });

        const rightPaddleAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 40, 5, 25),
            assetInfo: {
                'right-paddle': {
                    'pos': {x: 95, y: 40 },
                    'size': {x: 5, y: 25}
                }
            }
        });

        const leftScore = new GameNode.Text({
            textInfo: {
                text: '0',
                x: 25,
                y: 1,
                color: COLORS.WHITE,
                size: 4,
                align: 'center'
            }
        });

        const rightScore = new GameNode.Text({
            textInfo: {
                text: '0',
                x: 75,
                y: 1,
                color: COLORS.WHITE,
                size: 4,
                align: 'center'
            }
        });

        this.ball = ball;
        this.ballAsset = ballAsset;

        this.leftPaddle = leftPaddle;
        this.leftPaddleAsset = leftPaddleAsset;

        this.rightPaddle = rightPaddle;
        this.rightPaddleAsset = rightPaddleAsset;

        this.leftScore = leftScore;
        this.rightScore = rightScore;

        this.base.addChildren(
            sinkAsset,
            this.ball, 
            this.ballAsset,
            this.leftPaddle, 
            this.leftPaddleAsset, 
            this.rightPaddle, 
            this.rightPaddleAsset, 
            this.leftScore, 
            this.rightScore); 
    }

    handleNewPlayer({ playerId, info: playerInfo }) {
        this.players[playerId] = { playerInfo };
        this.handlePlayerChange();
    }

    handlePlayerChange() {
        const playerCount = Object.keys(this.players).length;
        if (playerCount > 1) {
            // update input handlers
        } else if (playerCount == 1) {
            // just one
            const playerId = Object.keys(this.players)[0];
            this.clickHandlers[playerId] = (x, y) => {
                if (x < 50) {
                    // controlling left
                    this.leftPaddle.node.coordinates2d = ShapeUtils.rectangle(0, Math.min(Math.max(0, y - 12.5), 75), 5, 25); // 25 is paddle height 
                } else {
                    // right
                    this.rightPaddle.node.coordinates2d = ShapeUtils.rectangle(95, Math.min(Math.max(0, y - 12.5), 75), 5, 25); // 25 is paddle height 
                }
            };
            this.startBall();
        }
    }

    startBall() {
        const ballX = 50;
        const ballY = 50;
        
        this.ball.node.coordinates2d = ShapeUtils.rectangle(ballX, ballY, BALL_SIZE, BALL_SIZE);


        const xSign = Math.random() < .5 ? -1 : 1;
        const ySign = Math.random() < .5 ? -1 : 1;

        let randXVel = xSign * Math.floor(Math.random() * 3);
        let randYVel = ySign * Math.floor(Math.random() * 3);

        if (randYVel == 0) {
            randYVel = 1;
        }

        if (randXVel == 0) {
            randXVel = 1;
        }

        const ballPath = Physics.getPath(ballX, ballY, randXVel, randYVel, 100 - BALL_SIZE, 100 - BALL_SIZE);

        this.moveBall(ballPath);
    }

    playSound(dir) {
        let assetKey = 'pluck';
        const playerIds = [];

        if (dir) {
            assetKey = dir === 'left' ? 'beep' : 'boop';
        }

        this.sound = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                [assetKey]: {
                    pos: {x: 0, y: 0},
                    size: {x: 0, y: 0},
                    startTime: 0
                }
            },
            playerIds
        });
        
        this.base.addChildren(this.sound);

        setTimeout(() => {
            this.base.removeChild(this.sound.id);
        }, 50);
    }

    moveBall(path) {
        return;
        let coordIndex = 0;
        const interval = setInterval(() => {
            let shouldContinue = true;
            const curBallX = this.ball.node.coordinates2d[0][0];
            const curBallY = this.ball.node.coordinates2d[0][1];

            const bounce = (dir) => {
                clearInterval(interval);
                const secondToLast = path[coordIndex - 2];
                const mostRecent = path[coordIndex - 1];
                const finalPoint = path[path.length - 1];
                const xDiff = mostRecent[0] - secondToLast[0];
                const yDiff = mostRecent[1] - secondToLast[1];

                // any corner
                if ((finalPoint[0] + Math.abs(xDiff) + BALL_SIZE >= 100 || finalPoint[0] - Math.abs(xDiff) <= 0) && 
                    (finalPoint[1] + Math.abs(yDiff) + BALL_SIZE >= 100 || finalPoint[1] - Math.abs(yDiff) <= 0)) {

                    const newX = -1 * xDiff;
                    const newY = -1 * yDiff;


                    const newPath = Physics.getPath(this.ball.node.coordinates2d[0][0], this.ball.node.coordinates2d[0][1], newX, newY, 100 - BALL_SIZE, 100 - BALL_SIZE);
                    this.playSound();
                    this.moveBall(newPath);
                } else {
                    let newX, newY;

                    if (xDiff > 0 && yDiff > 0) {
                        // right down

                        if (finalPoint[1] + yDiff + BALL_SIZE >= 100) {
                            // bottom wall, invert y
                            newX = xDiff;
                            newY = -1 * Math.abs(yDiff);
                        } else {
                            // right wall, invert x
                            newX = xDiff * -1;
                            newY = yDiff;
                        }
                    } else if (xDiff < 0 && yDiff < 0) { 
                        // left up

                        if (finalPoint[0] - Math.abs(xDiff) - BALL_SIZE < 0) {
                            // left wall
                            newX = -1 * xDiff;
                            newY = yDiff;
                        } else {
                            // top wall
                            newX = xDiff;
                            newY = -1 * yDiff;
                        }
                    } else if (xDiff > 0 && yDiff < 0) {
                        // right up

                        if (finalPoint[0] + Math.abs(xDiff) + BALL_SIZE >= 100) {
                            // right wall
                            newX = -1 * Math.abs(xDiff);
                            newY = -1 * Math.abs(yDiff);
                        } else {
                            // top wall
                            newX = Math.abs(xDiff);
                            newY = Math.abs(yDiff);
                        }

                    } else if (xDiff < 0 && yDiff > 0) {
                        // left down
                        if (finalPoint[0] - Math.abs(xDiff) < 0) {
                            // left wall
                            newX = Math.abs(xDiff);
                            newY = -1 * Math.abs(yDiff);
                        } else {
                            // bottom wall
                            newX = -1 * Math.abs(xDiff);
                            newY = -1 * Math.abs(yDiff);
                        }
                    }   

                    if (newX && newY) {
                        const newPath = Physics.getPath(this.ball.node.coordinates2d[0][0], this.ball.node.coordinates2d[0][1], newX, newY, 100 - BALL_SIZE, 100 - BALL_SIZE);
                        this.playSound();
                        this.moveBall(newPath);
                    }
                }
            };
 
            if (coordIndex == path.length) {
                bounce();
            } else {
                 if (curBallX <= BALL_SIZE) {
                     const wouldBeCollisions = GeometryUtils.checkCollisions(this.base, {node: {coordinates2d: this.leftPaddle.node.coordinates2d}}, (node) => {
                         return node.node.id !== this.base.node.id && node.node.id !== this.leftPaddle.node.id;
                     });

                     if (wouldBeCollisions.length == 0) {
                         this.grantPoint(false);
                         shouldContinue = false;
                     } else {
                        // bounce off of the left paddle with a random Y velocity

                        const ySign = Math.random() < .5 ? -1 : 1;
                        const randYVel = ySign * Math.floor(Math.random() * 3);
                        this.ball.node.coordinates2d = ShapeUtils.rectangle(BALL_SIZE + .1, this.ball.node.coordinates2d[0][1], BALL_SIZE, BALL_SIZE);

                        const newPath = Physics.getPath(BALL_SIZE + .1, this.ball.node.coordinates2d[0][1], 1, randYVel, 100 - BALL_SIZE, 100 - BALL_SIZE);
                        clearInterval(interval);

                        this.playSound('left');
                        this.moveBall(newPath);

                     }
                 } else if (curBallX + BALL_SIZE >= (100 - BALL_SIZE)) {
                     const wouldBeCollisions = GeometryUtils.checkCollisions(this.base, {node: {coordinates2d: this.rightPaddle.node.coordinates2d}}, (node) => {
                         return node.node.id !== this.base.node.id && node.node.id !== this.rightPaddle.node.id;
                     });

                     if (wouldBeCollisions.length == 0) {
                         this.grantPoint(true);
                         shouldContinue = false;
                     } else {
                        // bounce off of the right paddle with a random Y velocity

                        const ySign = Math.random() < .5 ? -1 : 1;
                        const randYVel = ySign * Math.floor(Math.random() * 3);
                        this.ball.node.coordinates2d = ShapeUtils.rectangle(100 - (2 * BALL_SIZE) - .1, this.ball.node.coordinates2d[0][1], BALL_SIZE, BALL_SIZE);

                        const newPath = Physics.getPath(this.ball.node.coordinates2d[0][0], this.ball.node.coordinates2d[0][1], -1, randYVel, 100 - BALL_SIZE, 100 - BALL_SIZE);
                        clearInterval(interval);

                        this.playSound('right');
                        this.moveBall(newPath);
                     }
                } else {
                    const nextCoord = path[coordIndex];
                    this.ball.node.coordinates2d = ShapeUtils.rectangle(nextCoord[0], nextCoord[1], BALL_SIZE, BALL_SIZE);
                    coordIndex++;
                }
            }

            if (!shouldContinue) {
                clearInterval(interval);
                this.setTimeout(() => {
                    this.startBall();
                }, 1000);
            }

        }, 10); 
    }

    getAssets() {
        return this.assets;
    }

    grantPoint(left) {
        if (left) {
            const newScore = Number(this.leftScore.node.text.text) + 1;
            const newText = Object.assign({}, this.leftScore.node.text);
            newText.text = '' + newScore;
            this.leftScore.node.text = newText;
        } else {
            const newScore = Number(this.rightScore.node.text.text) + 1;
            const newText = Object.assign({}, this.rightScore.node.text);
            newText.text = '' + newScore;
            this.rightScore.node.text = newText;
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
    }

    getLayers() {
        return [{root: this.base}];
    }

}

module.exports = Sponge;
