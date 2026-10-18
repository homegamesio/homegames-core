const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');

class SoccerPrototype extends Game {
    static metadata() {
        return {
            // Catalog review: Early soccer/combat sketch with shared controls; needs a complete match and restart.
            isTest: true,
            squishVersion: '150',
            name: 'Soccer',
            author: "Joseph Garcia",
            description: 'Violent and bloody soccer game with player control and AI opponents',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 20
        };
    }

    constructor() {
        super();

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.BLACK
        });

        this.playerNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 45, 10, 10),
            fill: Colors.COLORS.BLOOD
        });

        this.ballNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(48.5, 48.5, 3, 3),
            fill: Colors.COLORS.WHITE
        });

        this.goalLeft = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 35, 3, 30),
            fill: Colors.COLORS.BLOOD
        });

        this.goalRight = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(97, 35, 3, 30),
            fill: Colors.COLORS.BLOOD
        });

        this.scoreText = new GameNode.Text({
            textInfo: { text: '0 - 0', x: 50, y: 8, size: 3, align: 'center', color: Colors.COLORS.BLOOD }
        });

        this.infoText = new GameNode.Text({
            textInfo: { text: 'WASD/Arrows to move, SPACE to EXECUTE', x: 50, y: 95, size: 1.8, align: 'center', color: Colors.COLORS.WHITE }
        });

        this.gameOverText = new GameNode.Text({
            textInfo: { text: '', x: 50, y: 50, size: 4, align: 'center', color: Colors.COLORS.BLOOD }
        });

        this.base.addChildren(this.playerNode, this.ballNode, this.goalLeft, this.goalRight, this.scoreText, this.infoText, this.gameOverText);

        this.player = {
            x: 25,
            y: 50,
            size: 10,
            vx: 0,
            vy: 0,
            speed: 1.4,
            kickCooldown: 0
        };

        this.ball = {
            x: 50,
            y: 50,
            size: 3,
            vx: 0,
            vy: 0
        };

        this.aiPlayers = [];
        for (let i = 0; i < 4; i++) {
            const node = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, 8, 8),
                fill: Colors.COLORS.RED
            });
            const ex = 60 + Math.random() * 30;
            const ey = 20 + Math.random() * 60;
            this.base.addChild(node);
            this.aiPlayers.push({
                node,
                x: ex,
                y: ey,
                size: 8,
                speed: 0.6 + Math.random() * 0.4
            });
        }

        this.leftScore = 0;
        this.rightScore = 0;
        this.changed = false;
    }

    handleNewPlayer({ playerId }) {}

    handlePlayerDisconnect(playerId) {}

    handleKeyDown(playerId, key) {
        if (key === 'ArrowUp' || key === 'w') this.player.vy = -1;
        else if (key === 'ArrowDown' || key === 's') this.player.vy = 1;
        else if (key === 'ArrowLeft' || key === 'a') this.player.vx = -1;
        else if (key === 'ArrowRight' || key === 'd') this.player.vx = 1;
        else if (key === ' ') {
            if (this.player.kickCooldown <= 0) {
                this.tryKick();
            }
        }
    }

    handleKeyUp(playerId, key) {
        if (key === 'ArrowUp' || key === 'w' || key === 'ArrowDown' || key === 's') this.player.vy = 0;
        if (key === 'ArrowLeft' || key === 'a' || key === 'ArrowRight' || key === 'd') this.player.vx = 0;
    }

    tryKick() {
        const dx = this.ball.x - this.player.x;
        const dy = this.ball.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 14) return;
        let dirX = this.player.vx;
        let dirY = this.player.vy;
        if (dirX === 0 && dirY === 0) {
            dirX = Math.sign(this.ball.x - this.player.x) || 1;
            dirY = (Math.random() - 0.5) * 0.5;
        }
        const len = Math.hypot(dirX, dirY) || 1;
        dirX /= len;
        dirY /= len;
        const kickStrength = 5.5;
        this.ball.vx = dirX * kickStrength;
        this.ball.vy = dirY * kickStrength;
        this.player.kickCooldown = 20;
        this.ballNode.node.fill = Colors.COLORS.BLOOD;
        this.setTimeout(() => { this.ballNode.node.fill = Colors.COLORS.WHITE; this.base.node.onStateChange(); }, 150);
        this.changed = true;
        this.createBloodSplatter(this.player.x, this.player.y);
    }

    createBloodSplatter(x, y) {
        for (let i = 0; i < 14; i++) {
            const ox = (Math.random() - 0.5) * 6;
            const oy = (Math.random() - 0.5) * 6;
            const s = 0.8 + Math.random() * 1.2;
            const drop = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(x + ox - s/2, y + oy - s/2, s, s),
                fill: Colors.COLORS.BLOOD
            });
            this.base.addChild(drop);
            this.setTimeout(() => {
                try { this.base.removeChild(drop.id); } catch(e){}
            }, 600 + Math.random() * 400);
        }
        this.base.node.onStateChange();
    }

    resetBall() {
        this.ball.x = 50;
        this.ball.y = 50;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ballNode.node.fill = Colors.COLORS.WHITE;
    }

    tick() {
        this.changed = false;

        this.player.x += this.player.vx * this.player.speed;
        this.player.y += this.player.vy * this.player.speed;
        this.player.x = Math.max(5, Math.min(95, this.player.x));
        this.player.y = Math.max(5, Math.min(95, this.player.y));
        this.playerNode.node.coordinates2d = ShapeUtils.rectangle(
            this.player.x - this.player.size / 2,
            this.player.y - this.player.size / 2,
            this.player.size,
            this.player.size
        );
        this.changed = true;

        if (this.player.kickCooldown > 0) this.player.kickCooldown--;

        this.ball.vx *= 0.97;
        this.ball.vy *= 0.97;
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        if (this.ball.y < 2 || this.ball.y > 98) {
            this.ball.vy *= -0.85;
            this.ball.y = Math.max(2, Math.min(98, this.ball.y));
        }

        let scored = false;
        let goalX = 0;
        if (this.ball.x < 2) {
            if (this.ball.y >= 35 && this.ball.y <= 65) {
                this.rightScore++;
                scored = true;
                goalX = 1.5;
            } else {
                this.ball.vx *= -0.85;
                this.ball.x = 2;
            }
        } else if (this.ball.x > 98) {
            if (this.ball.y >= 35 && this.ball.y <= 65) {
                this.leftScore++;
                scored = true;
                goalX = 98.5;
            } else {
                this.ball.vx *= -0.85;
                this.ball.x = 98;
            }
        }

        if (scored) {
            this.createBloodSplatter(goalX, this.ball.y);
            this.resetBall();
            this.changed = true;
        }

        this.ballNode.node.coordinates2d = ShapeUtils.rectangle(
            this.ball.x - this.ball.size / 2,
            this.ball.y - this.ball.size / 2,
            this.ball.size,
            this.ball.size
        );

        for (const e of this.aiPlayers) {
            const dx = this.ball.x - e.x;
            const dy = this.ball.y - e.y;
            const dist = Math.hypot(dx, dy) || 1;
            e.x += (dx / dist) * e.speed;
            e.y += (dy / dist) * e.speed;
            e.x = Math.max(4, Math.min(96, e.x));
            e.y = Math.max(4, Math.min(96, e.y));
            e.node.node.coordinates2d = ShapeUtils.rectangle(
                e.x - e.size / 2,
                e.y - e.size / 2,
                e.size,
                e.size
            );
        }

        this.scoreText.node.text = {
            text: `${this.leftScore} - ${this.rightScore}`,
            x: 50, y: 8, size: 3, align: 'center', color: Colors.COLORS.BLOOD
        };

        if (this.changed) this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = SoccerPrototype;