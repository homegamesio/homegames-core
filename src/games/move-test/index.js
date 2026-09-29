const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-142');
const COLORS = Colors.COLORS;

class MoveTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '142',
            author: 'Joseph Garcia',
            thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96',
            isTest: true
        };
    }

    constructor() {
        super();
        const baseColor = Colors.randomColor();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: baseColor
        });

        this.keysDown = {};

        const mover1Color = Colors.randomColor();
        const mover2Color = Colors.randomColor();

        this.mover1 = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(43, 43.5, 10, 17),
            fill: mover1Color
        });
        
        this.mover2 = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(20, 23.5, 10, 17),
            fill: mover2Color
        });

        this.base.addChild(this.mover1);
        this.base.addChild(this.mover2);
    }

    handleKeyUp(player, key) {
        this.keysDown[key] = false;
    }

    handleGamepadInput(playerId, gamepadInput) {
        // Analog example: state arrives repeatedly while held. Multiplying by
        // deltaTime makes movement independent of polling/display refresh rate.
        const dt = gamepadInput.deltaTime ?? 1 / 60;
        for (const [stick, mover] of [[1, this.mover1], [2, this.mover2]]) {
            const x = gamepadInput.input.sticks[`STICK_${stick}_X`].value;
            const y = gamepadInput.input.sticks[`STICK_${stick}_Y`].value;
            if (x) this.movePlayer(mover, x < 0 ? 'left' : 'right', Math.abs(x) * 6 * dt);
            if (y) this.movePlayer(mover, y < 0 ? 'up' : 'down', Math.abs(y) * 6 * dt);
        }
    }

    movePlayer(player, dir, dist = .1) {
        let newX = player.node.coordinates2d[0][0];
        let newY = player.node.coordinates2d[0][1];

        if (dir === 'up') {
            if (newY - dist < 0) {
                newY = 0;
            } else {
                newY -= dist;
            }
        } 

        if (dir === 'down') {
            if (newY + 17 + dist <= 100) {
                newY += dist;
            } else {
                newY = 100 - 17;//player.size.y;
            }
        } 

        if (dir === 'left') {
            if (newX - dist < 0) {
                newX = 0;
            } else {
                newX -= dist;
            }
        } 

        if (dir === 'right') {
            if (newX + 10 + dist <= 100) {
                newX += dist;
            } else {
                newX = 100 - 10;//player.size.x;
            }
        } 

        const wouldBeCollisions = GeometryUtils.checkCollisions(this.base, {node: {coordinates2d: ShapeUtils.rectangle(newX, newY, 10, 17)}}, (node) => {
            return node.node.id !== this.base.node.id && node.node.id !== player.node.id;
        });

        if (wouldBeCollisions.length == 0) {
            const newCoords = ShapeUtils.rectangle(newX, newY, 10, 17);
            player.update({ coordinates2d: newCoords });
        }
    }

    handleKeyDown(player, key) {
        this.keysDown[key] = true;

        if (key === 'ArrowUp') {
            this.movePlayer(this.mover1, 'up', .1);
        }
        
        if (key == 'ArrowDown') {
            this.movePlayer(this.mover1, 'down', .1);
        }
        
        if (key == 'ArrowLeft') {
            this.movePlayer(this.mover1, 'left', .1);
        }

        if (key == 'ArrowRight') {
            this.movePlayer(this.mover1, 'right', .1);
        }

        if (key == 'w') {
            this.movePlayer(this.mover2, 'up', .1);
        }
        
        if (key == 's') {
            this.movePlayer(this.mover2, 'down', .1);
        }
        
        if (key == 'a') {
            this.movePlayer(this.mover2, 'left', .1);
        }

        if (key == 'd') {
            this.movePlayer(this.mover2, 'right', .1);
        }
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = MoveTest;
