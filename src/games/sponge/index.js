const dictionary = require('../../common/util/dictionary');

const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0762');

const COLORS = Colors.COLORS;

const BALL_SIZE = 5;

class Sponge extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 4, y: 3},
            description: 'sponge',
            author: 'Joseph Garcia',
            squishVersion: '0762',
            maxPlayers: 2
        };
    }

    constructor() {
        super();

        this.playerSides = {};
        this.gameStarted = false;

        this.assets = {
            'beep': new Asset({
                'id': '32c45968d7f335e5cce579c98d6132f3',
                'type': 'audio'
            }),
            'boop': new Asset({
                'id': '08eb24e6606a30f9563e32a450b9e30c',
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
                'id': '81f534b27e5062a701cde269b5a29cec',
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

        this.mainClickHandler = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            onClick: (playerId, x, y) => this.clickHandlers[playerId] ? this.clickHandlers[playerId](x, y) : null
        });
    
        const ball = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(48, 48, BALL_SIZE, BALL_SIZE)
        });

        const ballAsset = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(48, 48, BALL_SIZE, BALL_SIZE),
            assetInfo: {
                'ball': {
                    'pos': {x: 0, y: 0 },
                    'size': {x: BALL_SIZE, y: BALL_SIZE}
                }
            }
        });

        const leftPaddle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 40, 5, 25),
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
            coordinates2d: ShapeUtils.rectangle(95, 40, 5, 25)
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
            this.mainClickHandler,
            this.ball, 
            this.ballAsset,
            this.leftPaddle, 
            this.leftPaddleAsset, 
            this.rightPaddle, 
            this.rightPaddleAsset, 
            this.leftScore, 
            this.rightScore); 
    }

    handleKeyDown(playerId, key) {
        const acceptedInputs = new Set(['ArrowDown', 'ArrowUp', 'w', 's']);
        if (!acceptedInputs.has(key)) {
            return;
        }

        const isDown = key === 'ArrowDown' || key === 's';

        if (this.playerSides['left'] === playerId) {
            this.leftPlayerKeyInput = isDown ? 'down' : 'up';
        } 

        if (this.playerSides['right'] === playerId) {
            this.rightPlayerKeyInput = isDown ? 'down' : 'up';
        }
    }

    handleKeyUp(playerId, key) {
        const acceptedInputs = new Set(['ArrowDown', 'ArrowUp', 'w', 's']);
        if (!acceptedInputs.has(key)) {
            return;
        }
        const playerPos = this.playerSides['left'] === playerId ? 'left' : (this.playerSides['right'] === playerId ? 'right' : null);

        if (playerPos === 'left') {
            this.leftPlayerKeyInput = null;
        } else if (playerPos === 'right') {
            this.rightPlayerKeyInput = null;
        }
    }

    handleNewPlayer({ playerId, info: playerInfo }) {
        this.players[playerId] = { playerInfo };
        if (Object.keys(this.players).length == 1) {
            this.playerSides['left'] = playerId;
            this.playerSides['right'] = playerId;   

            this.clickHandlers[playerId] = (x, y) => {
                if (x < 50) {
                    // controlling left
                    this.updateLeftPaddlePosition(0, Math.min(Math.max(0, y - 12.5), 75));
                } else {
                    // right
                    this.updateRightPaddlePosition(95, Math.min(Math.max(0, y - 12.5), 75));
                }
            };         
        } else {
            const otherPlayerId = Object.keys(this.players).filter(id => id !== playerId)[0];

            this.clickHandlers[otherPlayerId] = (x, y) => {
                if (x < 50) {
                    // controlling left
                    this.updateLeftPaddlePosition(0, Math.min(Math.max(0, y - 12.5), 75));
                }
            };

            this.clickHandlers[playerId] = (x, y) => {
                if (x >= 50) {
                    // controlling right
                    this.updateRightPaddlePosition(95, Math.min(Math.max(0, y - 12.5), 75));
                }
            };

            this.playerSides['left'] = otherPlayerId;
            this.playerSides['right'] = playerId;
        }

        if (!this.gameStarted) {
            this.startBall();
        }
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];

        if (Object.keys(this.players).length == 0) {
            this.playerSides = {};            
        } else if (Object.keys(this.players).length == 1) {
            const otherPlayerId = Object.keys(this.players).filter(id => id !== playerId)[0];

            this.clickHandlers[otherPlayerId] = (x, y) => {
                if (x < 50) {
                    // controlling left
                    this.updateLeftPaddlePosition(0, Math.min(Math.max(0, y - 12.5), 75));
                } else {
                    // right
                    this.updateRightPaddlePosition(95, Math.min(Math.max(0, y - 12.5), 75));
                }
            };
            this.playerSides['left'] = otherPlayerId;
            this.playerSides['right'] = otherPlayerId;     
            if (!this.gameStarted) {       
                this.startBall();
            }
        }
    }

    updateLeftPaddlePosition(xStart, yStart) {
        this.leftPaddle.node.coordinates2d = ShapeUtils.rectangle(xStart, yStart, 5, 25); // 25 is paddle height 
        this.leftPaddleAsset.node.coordinates2d = ShapeUtils.rectangle(xStart, yStart, 5, 25);
        this.leftPaddleAsset.node.asset = {
            'left-paddle': {
                'pos': {x: xStart, y: yStart },
                'size': {x: 5, y: 25}
            }
        };
    }

    updateRightPaddlePosition(xStart, yStart) {
        this.rightPaddle.node.coordinates2d = ShapeUtils.rectangle(xStart, yStart, 5, 25); // 25 is paddle height 
        this.rightPaddleAsset.node.coordinates2d = ShapeUtils.rectangle(xStart, yStart, 5, 25);
        this.rightPaddleAsset.node.asset = {
            'right-paddle': {
                'pos': {x: xStart, y: yStart },
                'size': {x: 5, y: 25}
            }
        };
    }

    updateBallPosition(ballX, ballY) {        
        this.ball.node.coordinates2d = ShapeUtils.rectangle(ballX, ballY, BALL_SIZE, BALL_SIZE);
        this.ballAsset.node.coordinates2d = ShapeUtils.rectangle(ballX, ballY, BALL_SIZE, BALL_SIZE);
        this.ballAsset.node.asset = {
            'ball': {
                'pos': {x: ballX, y: ballY },
                'size': {x: BALL_SIZE, y: BALL_SIZE}
            }
        };
    }

    startBall() {
        // never false again
        this.gameStarted = true;
        const ballX = 50;
        const ballY = 50;
        
        this.updateBallPosition(ballX, ballY);

        const xSign = Math.random() < .5 ? -1 : 1;
        const ySign = Math.random() < .5 ? -1 : 1;

        let randXVel = xSign * Math.floor(Math.random() * 2);
        let randYVel = ySign * Math.floor(Math.random() * 2);

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
        }, assetKey == 'pluck' ? 50 : assetKey == 'left' ? 100 : 50);
    }

    moveBall(path) {
        let coordIndex = 0;
        const interval = setInterval(() => {
            if (this.leftPlayerKeyInput) {
                const currentX = this.leftPaddle.node.coordinates2d[0][0];
                const currentY = this.leftPaddle.node.coordinates2d[0][1];
                this.updateLeftPaddlePosition(currentX, this.leftPlayerKeyInput === 'down' ? Math.min(currentY + 3, 100 - 25) : Math.max(currentY - 3, 0));
                this.leftPlayerKeyInput = null;
            } 

            if (this.rightPlayerKeyInput) {
                const currentX = this.rightPaddle.node.coordinates2d[0][0];
                const currentY = this.rightPaddle.node.coordinates2d[0][1];
                this.updateRightPaddlePosition(currentX, this.rightPlayerKeyInput === 'down' ? Math.min(currentY + 3, 100 - 25) : Math.max(currentY - 3, 0));
                this.rightPlayerKeyInput = null;
            }

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
                         return (node.node.id !== this.base.node.id 
                            && node.node.id !== this.leftPaddle.node.id
                            && node.node.id !== this.mainClickHandler.node.id
                            && node.node.subType !== subtypes.ASSET);
                     });

                     if (wouldBeCollisions.length == 0) {
                         this.grantPoint(false);
                         shouldContinue = false;
                     } else {
                        // bounce off of the left paddle with a random Y velocity
                        const ySign = Math.random() < .5 ? -1 : 1;
                        let randYVel = ySign * Math.floor(Math.random() * 2);
                        // random velocity cant be positive if the ball is at the lower wall
                        if (randYVel > 0 && this.ball.node.coordinates2d[0][1] + BALL_SIZE >= 100
                            || randYVel < 0 && this.ball.node.coordinates2d[0][1] <= 0) {
                            randYVel = -1 * randYVel;
                        } 

                        // distance between top and ball
                        if (Math.abs(randYVel) > this.ball.node.coordinates2d[0][1]) {
                            randYVel = (randYVel / randYVel) * this.ball.node.coordinates2d[0][1];
                        }

                        this.updateBallPosition(BALL_SIZE + .1, this.ball.node.coordinates2d[0][1]);

                        const newPath = Physics.getPath(BALL_SIZE + .1, this.ball.node.coordinates2d[0][1], 1, randYVel, 100 - BALL_SIZE, 100 - BALL_SIZE);

                        clearInterval(interval);

                        this.playSound('left');
                        this.moveBall(newPath);

                     }
                 } else if (curBallX + BALL_SIZE >= (100 - BALL_SIZE)) {
                     const wouldBeCollisions = GeometryUtils.checkCollisions(this.base, {node: {coordinates2d: this.rightPaddle.node.coordinates2d}}, (node) => {
                         return (node.node.id !== this.base.node.id 
                            && node.node.id !== this.rightPaddle.node.id
                            && node.node.id !== this.mainClickHandler.node.id
                            && node.node.subType !== subtypes.ASSET);
                     });

                     if (wouldBeCollisions.length == 0) {
                         this.grantPoint(true);
                         shouldContinue = false;
                     } else {
                        // bounce off of the right paddle with a random Y velocity

                        const ySign = Math.random() < .5 ? -1 : 1;
                        let randYVel = ySign * Math.floor(Math.random() * 2);
                        
                        // random velocity cant be positive if the ball is at the lower wall
                        if (randYVel > 0 && this.ball.node.coordinates2d[0][1] + BALL_SIZE >= 100
                            || randYVel < 0 && this.ball.node.coordinates2d[0][1] <= 0) {
                            randYVel = -1 * randYVel;
                        } 

                        // distance between top and ball
                        if (Math.abs(randYVel) > this.ball.node.coordinates2d[0][1]) {
                            randYVel = (randYVel / randYVel) * this.ball.node.coordinates2d[0][1];
                        }

                        this.updateBallPosition(100 - (2 * BALL_SIZE) - .1, this.ball.node.coordinates2d[0][1]);

                        const newPath = Physics.getPath(this.ball.node.coordinates2d[0][0], this.ball.node.coordinates2d[0][1], -1, randYVel, 100 - BALL_SIZE, 100 - BALL_SIZE);
                        clearInterval(interval);

                        this.playSound('right');
                        this.moveBall(newPath);
                     }
                } else {
                    const nextCoord = path[coordIndex];
                    this.updateBallPosition(nextCoord[0], nextCoord[1]);

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
        this.leftPlayerKeyInput = null;
        this.rightPlayerKeyInput = null;
        
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

    getLayers() {
        return [{root: this.base}];
    }

}

module.exports = Sponge;
