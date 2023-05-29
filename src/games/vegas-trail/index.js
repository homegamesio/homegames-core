const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0766');
const { Illness, Run, GridDefense, Hunt } = require('./minigames/index.js');
const COLORS = Colors.COLORS;

class VegasTrail extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0766',
            author: 'Joseph Garcia',
            thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96',
            tickRate: 100,
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.GRAY 
        });

        this.keysDown = {};
    }

    handleNewPlayer({ playerId }) {
//        const hunt = new Hunt(playerId);
//        const run = new Run(playerId);
//        const gridDefense = new GridDefense(playerId);
        const fightIllness = new Illness(playerId);
        this.activeGame = fightIllness;
//        this.activeGame = gridDefense;
//  this.activeGame = hunt;

        // todo: add view here for each player
//        this.base.addChild(hunt.getRoot());
//        this.base.addChild(run.getRoot());

//        this.base.addChild(gridDefense.getRoot());
        this.base.addChild(fightIllness.getRoot());
    }

    handleKeyUp(player, key) {
        this.keysDown[key] = true;
    }

    tick() {
        this.activeGame && this.activeGame.tick();
    }

    handleGamepadInput(playerId, gamepadInput) {
        const stick1X = gamepadInput.input.sticks.STICK_1_X.value;
        const stick2X = gamepadInput.input.sticks.STICK_2_X.value;

        const stick1Y = gamepadInput.input.sticks.STICK_1_Y.value;
        const stick2Y = gamepadInput.input.sticks.STICK_2_Y.value;


        if (stick1X < 0) {
            this.movePlayer(this.mover1, 'left', .1);
        } else if (stick1X > 0) {
            this.movePlayer(this.mover1, 'right', .1);
        }

        if (stick1Y < 0) {
            this.movePlayer(this.mover1, 'up', .1);
        } else if (stick1Y > 0) {
            this.movePlayer(this.mover1, 'down', .1);
        }

        if (stick2X < 0) {
            this.movePlayer(this.mover2, 'left', .1);
        } else if (stick2X > 0) {
            this.movePlayer(this.mover2, 'right', .1);
        }

        if (stick2Y < 0) {
            this.movePlayer(this.mover2, 'up', .1);
        } else if (stick2Y > 0) {
            this.movePlayer(this.mover2, 'down', .1);
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
            player.node.coordinates2d = newCoords;
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

module.exports = VegasTrail;
