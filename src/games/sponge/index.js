const dictionary = require('../../common/util/dictionary');

const { Game, GameNode, Colors, Shapes, ShapeUtils, Physics } = require('squish-0756');

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

        // const leftPaddle = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(0, 40, 5, 25),
        //     fill: COLORS.WHITE
        // });

        // const rightPaddle = new GameNode.Shape({
        //     shapeType: Shapes.POLYGON,
        //     coordinates2d: ShapeUtils.rectangle(95, 40, 5, 25),
        //     fill: COLORS.WHITE 
        // });

        // const leftScore = new GameNode.Text({
        //     textInfo: {
        //         text: '0',
        //         x: 25,
        //         y: 1,
        //         color: COLORS.WHITE,
        //         size: 4,
        //         align: 'center'
        //     }
        // });

        // const rightScore = new GameNode.Text({
        //     textInfo: {
        //         text: '0',
        //         x: 75,
        //         y: 1,
        //         color: COLORS.WHITE,
        //         size: 4,
        //         align: 'center'
        //     }
        // });

        this.ball = ball;
        // this.leftPaddle = leftPaddle;
        // this.rightPaddle = rightPaddle;
        // this.leftScore = leftScore;
        // this.rightScore = rightScore;

        this.base.addChildren(this.ball)//, this.leftPaddle, this.rightPaddle, this.leftScore, this.rightScore); 
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
            // this.clickHandlers[playerId] = (x, y) => {
            //     if (x < 50) {
            //         // controlling left
            //         this.leftPaddle.node.coordinates2d = ShapeUtils.rectangle(0, Math.min(75, y), 5, 25); // 25 is paddle height 
            //     } else {
            //         // right
            //         this.rightPaddle.node.coordinates2d = ShapeUtils.rectangle(95, Math.min(75, y), 5, 25); // 25 is paddle height 
            //     }
            // };
            this.startBall();
        }
    }

    startBall() {
        const ballX = 50;
        const ballY = 50;
        
        this.ball.node.coordinates2d = ShapeUtils.rectangle(ballX, ballY, BALL_SIZE, BALL_SIZE);

        let randXVel = Math.random() > .5 ? (-1 * Math.random()) : Math.random();
        let randYVel = Math.random() > .5 ? (-1 * Math.random()) : Math.random();
        
        const xSign = randXVel < 0 ? -1 : 1;
        const ySign = randYVel < 0 ? -1 : 1;

        if (Math.abs(randXVel) <= .25) {
            randXVel += xSign * .25;
        }
        
        if (Math.abs(randYVel) <= .25) {
            randYVel += ySign * .25;
        }

        // const ballPath = Physics.getPath(ballX, ballY, randXVel, randYVel, 100 - BALL_SIZE, 100 - BALL_SIZE);
        // const ballPath = Physics.getPath(0, 50, 1, -1, 100 - BALL_SIZE, 100 - BALL_SIZE);
        const ballPath = Physics.getPath(50, 0, 1, 1, 100 - BALL_SIZE, 100 - BALL_SIZE);

        this.moveBall(ballPath);
   }

    moveBall(path) {
        let coordIndex = 0;
        
        const interval = setInterval(() => {
            let shouldContinue = true;
            const curBallX = this.ball.node.coordinates2d[0][0];
            const curBallY = this.ball.node.coordinates2d[0][1];

            const bounce = () => {
                clearInterval(interval);
                const secondToLast = path[coordIndex - 2];//path.length - 2];
                const mostRecent = path[coordIndex - 1];//path.length - 1];
                const xDiff = mostRecent[0] - secondToLast[0];
                const yDiff = mostRecent[1] - secondToLast[1];

                console.log('what is y diff ' + xDiff + ', ' + yDiff);

                const theta = Math.atan(xDiff / yDiff) * 180 / Math.PI;
                const alpha = 90 - Math.abs(theta);


                console.log('alpha');
                console.log(alpha);

                const missingTheta = 180 - (2 * alpha) - Math.abs(theta);

                const missingThetaRadians = missingTheta * (Math.PI / 180);
                const alphaRadians = alpha * (Math.PI / 180);

                console.log('the fuck ' + (-1 * yDiff * Math.tan(missingThetaRadians)));
                console.log('what is that angle lol ' + (missingTheta));
                // const ySign = yDiff > 0 ? -1 : 1;
                // const xSign = curBallX + BALL_SIZE >= 95 || curBallX <= 5 ? -1 : 1;

                // if (curBallX <= 5) {
                //     this.ball.node.coordinates2d = ShapeUtils.rectangle(5.1, curBallY, BALL_SIZE, BALL_SIZE);
                // } else if (curBallX + BALL_SIZE >= 95) {
                //     this.ball.node.coordinates2d = ShapeUtils.rectangle(89.9, curBallY, BALL_SIZE, BALL_SIZE);
                // }

                const newX = xDiff * Math.tan(missingThetaRadians);
                const newY = yDiff * Math.cos(alphaRadians);

                console.log('new x ' + newX + ', ' + newY);
                // const newPath = Physics.getPath(curBallX, curBallY, xSign * xDiff, ySign * Math.abs(yDiff), 100 - BALL_SIZE, 100 - BALL_SIZE);
                const newPath = Physics.getPath(curBallX, curBallY, newX, newY, 100 - BALL_SIZE, 100 - BALL_SIZE);

                // console.log('djfdsf ' + curBallX + ', ' + curBallY + ', ' + (xSign * xDiff) + ',' + (ySign * Math.abs(yDiff)));
                // console.log('path!!');
                // console.log(path);
                // this.moveBall(newPath);        
            };
 
            if (coordIndex >= path.length) {
                bounce();
            } else {
               //  if (curBallX <= 5) {
               //      const leftPaddleY = this.leftPaddle.node.coordinates2d[0][1];
               //      const diffMiddle = Math.abs((curBallY - (leftPaddleY + 12.5)));
               //      if (diffMiddle > 12.5) {
               //          this.grantPoint(false);
               //          shouldContinue = false;
               //      } else {
               //          bounce();
               //      }
               //  } else if (curBallX + BALL_SIZE >= 95) {
               //      const rightPaddleY = this.rightPaddle.node.coordinates2d[0][1];
               //      const diffMiddle = Math.abs((curBallY) - (rightPaddleY + 12.5));
               //      if (diffMiddle > 12.5) {
               //          this.grantPoint(true);
               //          shouldContinue = false;
               //      } else {
               //          bounce();
               //      }
               // } else {
                    const nextCoord = path[coordIndex];
                    this.ball.node.coordinates2d = ShapeUtils.rectangle(nextCoord[0], nextCoord[1], BALL_SIZE, BALL_SIZE)
                    coordIndex++;
               //  }
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
