const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-061');
const { checkCollisions } = require('../../common/util');
const COLORS = Colors.COLORS;

class MoveTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '061',
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/move-test.png'
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
        this.keysDown[key] = true;
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

        const wouldBeCollisions = checkCollisions(this.base, {node: {coordinates2d: ShapeUtils.rectangle(newX, newY, 10, 17)}}, (node) => {
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
            this.movePlayer(this.mover1, 'up', .2);
        }
        
        if (key == 'ArrowDown') {
            this.movePlayer(this.mover1, 'down', .2);
        }
        
        if (key == 'ArrowLeft') {
            this.movePlayer(this.mover1, 'left', .2);
        }

        if (key == 'ArrowRight') {
            this.movePlayer(this.mover1, 'right', .2);
        }

        if (key == 'w') {
            this.movePlayer(this.mover2, 'up', .2);
        }
        
        if (key == 's') {
            this.movePlayer(this.mover2, 'down', .2);
        }
        
        if (key == 'a') {
            this.movePlayer(this.mover2, 'left', .2);
        }

        if (key == 'd') {
            this.movePlayer(this.mover2, 'right', .2);
        }
    }

    handleLayerClick() {
        // todo: squisher needs to update pos after original
        this.color = Colors.randomColor();
    }

    getRoot() {
        return this.base;
    }
}

module.exports = MoveTest;
