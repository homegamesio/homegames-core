const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-136');
const COLORS = Colors.COLORS;

class Halloween extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 1, y: 1},
            squishVersion: '136',
            author: 'Joseph Garcia',
            thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96',
            isTest: false
        };
    }

    constructor() {
        super();
        const baseColor = COLORS.BLACK;
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: baseColor
        });

        this.keysDown = {};

        const moverColor = COLORS.BLUE;

        this.mover = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(45, 90, 10, 10),
            fill: moverColor
        });
        
        this.base.addChild(this.mover);
    }

    handleKeyUp(player, key) {
        this.keysDown[key] = true;
    }

    handleGamepadInput(playerId, gamepadInput) {
        const stick1X = gamepadInput.input.sticks.STICK_1_X.value;
        const stick2X = gamepadInput.input.sticks.STICK_2_X.value;

        const stick1Y = gamepadInput.input.sticks.STICK_1_Y.value;
        const stick2Y = gamepadInput.input.sticks.STICK_2_Y.value;


        if (stick1X < 0) {
            this.movePlayer(this.mover, 'left', .1);
        } else if (stick1X > 0) {
            this.movePlayer(this.mover, 'right', .1);
        }

        if (stick2X < 0) {
            this.movePlayer(this.mover, 'left', .1);
        } else if (stick2X > 0) {
            this.movePlayer(this.mover, 'right', .1);
        }
    }

    movePlayer(player, dir, dist = .1) {
        console.log('wat');
        console.log(player);
        console.log(dir);
        console.log(dist);
        let newX = player.node.coordinates2d[0][0];
        let newY = player.node.coordinates2d[0][1];

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

        const wouldBeCollisions = GeometryUtils.checkCollisions(this.base, {node: {coordinates2d: ShapeUtils.rectangle(newX, newY, 10, 10)}}, (node) => {
            return node.node.id !== this.base.node.id && node.node.id !== player.node.id;
        });

        if (wouldBeCollisions.length == 0) {
            const newCoords = ShapeUtils.rectangle(newX, newY, 10, 10);
            player.node.coordinates2d = newCoords;
        }

        this.base.node.onStateChange();
    }

    handleKeyDown(player, key) {
        this.keysDown[key] = true;

        if (key == 'ArrowLeft') {
            this.movePlayer(this.mover, 'left', .1);
        }

        if (key == 'ArrowRight') {
            this.movePlayer(this.mover, 'right', .1);
        }

        if (key == 'a') {
            this.movePlayer(this.mover, 'left', .1);
        }

        if (key == 'd') {
            this.movePlayer(this.mover, 'right', .1);
        }
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = Halloween;
