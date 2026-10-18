const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-150');
const { COLORS } = Colors;

class FightingGame extends Game {
    static metadata() {
        return {
            // Catalog review: Shared-keyboard combat sketch; Block Brawlers is the developed alternative.
            isTest: true,
            squishVersion: '150',
            name: 'Two-Player Fight',
            author: "Joseph Garcia",
            description: 'A two-player fighting game controlled with one keyboard.',
            aspectRatio: { x: 16, y: 9 },
            tickRate: 30
        };
    }

    constructor() {
        super();

        this.player1 = {
            x: 20,
            y: 50,
            vx: 0,
            vy: 0,
            health: 100,
            attack: false
        };

        this.player2 = {
            x: 80,
            y: 50,
            vx: 0,
            vy: 0,
            health: 100,
            attack: false
        };

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.BLACK
        });

        this.player1.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(this.player1.x, this.player1.y, 10, 10),
            fill: COLORS.RED
        });

        this.player2.node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(this.player2.x, this.player2.y, 10, 10),
            fill: COLORS.BLUE
        });

        this.healthBar1 = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(5, 5, 90, 5),
            fill: COLORS.RED
        });

        this.healthBar2 = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(5, 95, 90, 5),
            fill: COLORS.BLUE
        });

        this.base.addChildren(
            this.player1.node,
            this.player2.node,
            this.healthBar1,
            this.healthBar2
        );
    }

    handleKeyDown(playerId, key) {
        if (key === 'w') this.player1.vy = -2;
        if (key === 's') this.player1.vy = 2;
        if (key === 'a') this.player1.vx = -2;
        if (key === 'd') this.player1.vx = 2;
        if (key === 'ArrowUp') this.player2.vy = -2;
        if (key === 'ArrowDown') this.player2.vy = 2;
        if (key === 'ArrowLeft') this.player2.vx = -2;
        if (key === 'ArrowRight') this.player2.vx = 2;
        if (key === 'j') this.player1.attack = true;
        if (key === 'n') this.player2.attack = true;
    }

    handleKeyUp(playerId, key) {
        if (key === 'w' || key === 's') this.player1.vy = 0;
        if (key === 'a' || key === 'd') this.player1.vx = 0;
        if (key === 'ArrowUp' || key === 'ArrowDown') this.player2.vy = 0;
        if (key === 'ArrowLeft' || key === 'ArrowRight') this.player2.vx = 0;
        if (key === 'j') this.player1.attack = false;
        if (key === 'n') this.player2.attack = false;
    }

    tick() {
        // Update positions
        this.player1.x += this.player1.vx;
        this.player1.y += this.player1.vy;
        this.player2.x += this.player2.vx;
        this.player2.y += this.player2.vy;

        // Clamp positions
        this.player1.x = Math.max(0, Math.min(90, this.player1.x));
        this.player1.y = Math.max(0, Math.min(90, this.player1.y));
        this.player2.x = Math.max(0, Math.min(90, this.player2.x));
        this.player2.y = Math.max(0, Math.min(90, this.player2.y));

        // Update player positions
        this.player1.node.node.coordinates2d = ShapeUtils.rectangle(this.player1.x, this.player1.y, 10, 10);
        this.player2.node.node.coordinates2d = ShapeUtils.rectangle(this.player2.x, this.player2.y, 10, 10);

        // Collision detection
        const p1Rect = this.player1.node.node.coordinates2d;
        const p2Rect = this.player2.node.node.coordinates2d;

        const p1X = p1Rect[0][0];
        const p1Y = p1Rect[0][1];
        const p1W = p1Rect[1][0] - p1X;
        const p1H = p1Rect[2][1] - p1Y;

        const p2X = p2Rect[0][0];
        const p2Y = p2Rect[0][1];
        const p2W = p2Rect[1][0] - p2X;
        const p2H = p2Rect[2][1] - p2Y;

        const overlapX = p1X < p2X + p2W && p1X + p1W > p2X;
        const overlapY = p1Y < p2Y + p2H && p1Y + p1H > p2Y;

        if (overlapX && overlapY) {
            if (this.player1.attack) {
                this.player2.health -= 10;
                this.player1.attack = false;
            }
            if (this.player2.attack) {
                this.player1.health -= 10;
                this.player2.attack = false;
            }
        }

        // Update health bars
        this.healthBar1.node.coordinates2d = ShapeUtils.rectangle(5, 5, (this.player1.health / 100) * 90, 5);
        this.healthBar2.node.coordinates2d = ShapeUtils.rectangle(5, 95, (this.player2.health / 100) * 90, 5);

        this.base.node.onStateChange();
    }

    getLayers() {
        return [{ root: this.base }];
    }
}

module.exports = FightingGame;