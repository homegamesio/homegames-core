const dictionary = require('../../common/util/dictionary');

const { Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils } = require('squish-0756');

const COLORS = Colors.COLORS;

const BALL_SIZE = 5;

class Sponge extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 4, y: 3},
            description: 'Never heard of it.',
            author: 'Joseph Garcia',
            thumbnail: '4b5f169186bc542e14b5d001d25ce6bb',
            squishVersion: '0756',
            maxPlayers: 2
        };
    }

    constructor() {
        super();

        this.players = {};
        this.clickHandlers = {};

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.BLACK,
            onClick: (playerId, x, y) => this.clickHandlers[playerId] ? this.clickHandlers[playerId](x, y) : null
        });
    
        const ball = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(48, 48, BALL_SIZE, BALL_SIZE),
            fill: COLORS.WHITE
        });

        const leftPaddle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 40, 5, 25),
            fill: COLORS.WHITE
        });

        const rightPaddle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(95, 40, 5, 25),
            fill: COLORS.WHITE 
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
        this.leftPaddle = leftPaddle;
        this.rightPaddle = rightPaddle;
        this.leftScore = leftScore;
        this.rightScore = rightScore;

        this.base.addChildren(this.ball, this.leftPaddle, this.rightPaddle, this.leftScore, this.rightScore); 
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

        let randXVel = xSign * (Math.floor(100 * Math.random()) % 4) * .25;
        let randYVel = ySign * (Math.floor(100 * Math.random()) % 4) * .25;

        if (randXVel === 0) {
            randXVel = .25;
        }

        if (randYVel === 0) {
            randYVel = .25;
        }

        const ballPath = Physics.getPath(ballX, ballY, randXVel, randYVel, 100 - BALL_SIZE, 100 - BALL_SIZE);

        this.moveBall(ballPath);
   }

    moveBall(path) {
        let coordIndex = 0;
        const interval = setInterval(() => {
            let shouldContinue = true;
            const curBallX = this.ball.node.coordinates2d[0][0];
            const curBallY = this.ball.node.coordinates2d[0][1];

            const bounce = (dir) => {
                clearInterval(interval);
                const secondToLast = path[coordIndex - 2];//path.length - 2];
                const mostRecent = path[coordIndex - 1];//path.length - 1];
                const finalPoint = path[path.length - 1];
                const xDiff = mostRecent[0] - secondToLast[0];
                const yDiff = mostRecent[1] - secondToLast[1];

                if (dir && dir === 'left') {
                    this.ball.node.coordinates2d = ShapeUtils.rectangle(5.25, curBallY, BALL_SIZE, BALL_SIZE);
                } else if (dir && dir === 'right') {
                    this.ball.node.coordinates2d = ShapeUtils.rectangle(89.75, curBallY, BALL_SIZE, BALL_SIZE);
                }

                // invert x if left or right bounce
                const newX = dir && dir === 'left' || dir === 'right' ? -1 * xDiff : xDiff;

                // invert y if top or bottom bounce
                const newY = finalPoint[1] <= BALL_SIZE || mostRecent[1] >= (100 - BALL_SIZE - 1) ? -1 * yDiff : yDiff;

                const newPath = Physics.getPath(this.ball.node.coordinates2d[0][0], this.ball.node.coordinates2d[0][1], newX, newY, 100 - BALL_SIZE, 100 - BALL_SIZE);

                this.moveBall(newPath);        
            };
 
            if (coordIndex >= path.length) {
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
                        bounce('left');
                    }
                } else if (curBallX + BALL_SIZE >= (100 - BALL_SIZE)) {
                    const wouldBeCollisions = GeometryUtils.checkCollisions(this.base, {node: {coordinates2d: this.rightPaddle.node.coordinates2d}}, (node) => {
                        return node.node.id !== this.base.node.id && node.node.id !== this.rightPaddle.node.id;
                    });

                    if (wouldBeCollisions.length == 0) {
                        this.grantPoint(true);
                        shouldContinue = false;
                    } else {
                        bounce('right');
                    }
               } else {
                    const nextCoord = path[coordIndex];
                    this.ball.node.coordinates2d = ShapeUtils.rectangle(nextCoord[0], nextCoord[1], BALL_SIZE, BALL_SIZE)
                    coordIndex++;
                }
            }

            if (!shouldContinue) {
                clearInterval(interval);
                this.setTimeout(() => {
                    this.startBall();
                }, 1000);
            }

        }, 30); 
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
