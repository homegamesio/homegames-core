const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0766');

class MapGame {
    constructor(mainGame, mapData) {
        this.mainGame = mainGame;
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE
        });

        const map = this.constructMap(mapData);
        
        this.root.addChild(map);
    }

    constructMap(mapData) {
        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: mapData.mapCoords,
            fill: Colors.COLORS.PINK
        });
    }

    tick(playerStates) {
        const now = Date.now();
        for (let key in playerStates) {
            const playerState = playerStates[key];
            if (!playerState.lastMovementTime || playerState.lastMovementTime + playerState.movementInterval <= now) {
                if (playerState.currentIndex >= playerState.path.length) {
                    continue;
                }

                const newCoords = ShapeUtils.rectangle(playerState.path[playerState.currentIndex][0], playerState.path[playerState.currentIndex][1], 2, 2);
                // feels filthy but hey you know
                playerStates[key].node.node.coordinates2d = newCoords;
                playerStates[key].lastMovementTime = now;
                playerStates[key].currentIndex = playerStates[key].currentIndex + 1;
            }
        }
 
    }

    getRoot() {
        return this.root;
    }
}

module.exports = MapGame;
