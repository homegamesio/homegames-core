const { Game, GameNode, Colors, Shapes, ShapeUtils, Physics } = require('squish-150');

class BallBounceGame extends Game {
    static metadata() {
        return {
            // Catalog review: Basic bounce/score prototype; both dddd and ims archives contain this same game.
            isTest: true,
            squishVersion: '150',
            services: ['multiplayer'],
            name: 'Ball Bounce',
            author: "Joseph Garcia",
            description: 'Bounce balls around the screen',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 60
        };
    }

    constructor() {
        super();
        this.ballCount = 0;
        this.ballNodes = new Map();
        this.ballPhysics = new Map();
        this.paddle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 90, 10, 2),
            fill: Colors.COLORS.HG_BLUE,
            playerIds: [0]
        });
        
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [0, 0, 0, 255]
        });
        
        this.base.addChildren(this.paddle);
        
        this.score = 0;
        this.scoreText = new GameNode.Text({
            textInfo: {
                text: 'Score: 0',
                x: 50,
                y: 5,
                size: 3,
                align: 'center',
                color: [255, 255, 255, 255]
            }
        });
        
        this.base.addChild(this.scoreText);
        
        this.gameStarted = false;
        this.gameOver = false;
        this.gameOverText = new GameNode.Text({
            textInfo: {
                text: 'GAME OVER',
                x: 50,
                y: 50,
                size: 6,
                align: 'center',
                color: [255, 0, 0, 255]
            },
            playerIds: [0]
        });
        
        this.base.addChild(this.gameOverText);
        this.gameOverText.node.visible = false;
    }

    handleNewPlayer({ playerId }) {
        // Create paddle for player
        const paddle = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 90, 10, 2),
            fill: Colors.COLORS.HG_BLUE,
            playerIds: [playerId]
        });
        
        this.base.addChild(paddle);
    }

    handlePlayerDisconnect(playerId) {
    }

    handleKeyDown(playerId, key) {
        if (!this.gameStarted && !this.gameOver) {
            this.gameStarted = true;
            this.startGame();
        }
    }

    handleKeyUp(playerId, key) {
    }

    startGame() {
        this.ballCount = 0;
        this.score = 0;
        this.updateScore();
        this.spawnBall();
    }

    spawnBall() {
        const ballId = ++this.ballCount;
        const ball = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(50, 50, 3, 3),
            fill: Colors.COLORS.CANDY_RED,
            playerIds: [0]
        });
        
        const physics = {
            x: 50,
            y: 50,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            radius: 1.5
        };
        
        this.ballPhysics.set(ballId, physics);
        this.ballNodes.set(ballId, ball);
        this.base.addChild(ball);
    }

    updateScore() {
        this.scoreText.node.text = { text: `Score: ${this.score}`, x: 50, y: 5, size: 3, align: 'center', color: [255, 255, 255, 255] };
    }

    tick() {
        if (!this.gameStarted) return;
        
        // Update ball positions
        for (const [ballId, physics] of this.ballPhysics.entries()) {
            const ball = this.ballNodes.get(ballId);
            if (!ball) continue;
            
            // Update position
            physics.x += physics.vx;
            physics.y += physics.vy;
            
            // Bounce off walls
            if (physics.x <= 0 || physics.x >= 100) {
                physics.vx = -physics.vx;
                physics.x = Math.max(0, Math.min(100, physics.x));
            }
            
            if (physics.y <= 0 || physics.y >= 100) {
                physics.y = Math.max(0, Math.min(100, physics.y));
                physics.vy = -physics.vy;
            }
            
            // Update ball position
            ball.node.coordinates2d = ShapeUtils.rectangle(physics.x - 1.5, physics.y - 1.5, 3, 3);
            
            // Check paddle collision
            const paddleY = 90;
            const paddleX = 45;
            const paddleWidth = 10;
            const paddleHeight = 2;
            
            if (physics.y >= paddleY && physics.y <= paddleY + 2 && physics.x >= paddleX && physics.x <= paddleX + 10) {
                physics.vy = -Math.abs(physics.vy);
                physics.y = paddleY - 1;
                this.score += 1;
                this.updateScore();
                
                // Add some extra velocity
                physics.vx += (Math.random() - 0.5) * 0.5;
                physics.vy -= 0.2;
                
                // Spawn new ball every 5 points
                if (this.score % 5 === 0) {
                    this.spawnBall();
                }
            }
            
            // Check if ball is out of bounds
            if (physics.y > 100) {
                this.ballPhysics.delete(ballId);
                this.base.removeChild(ball.id);
                this.ballNodes.delete(ballId);
                
                // Game over if no balls left
                if (this.ballPhysics.size === 0) {
                    this.gameOver = true;
                    this.gameOverText.node.visible = true;
                }
            }
        }
        
        // Update paddle position based on player input
        const paddleX = 45;
        const paddleWidth = 10;
        const paddleY = 90;
        
        // Move paddle with player input
        this.paddle.node.coordinates2d = ShapeUtils.rectangle(paddleX, paddleY, paddleWidth, 2);
        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = BallBounceGame;