const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0633');

const COLORS = Colors.COLORS;

class DeviceTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0633',
            author: 'Joseph Garcia', 
            tickRate: 10
       };
    }

    constructor() {
        super();
        this.playerStates = {};

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON, 
            coordinates2d: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
            ],
            fill: COLORS.HG_BLACK 
        });
    }

    handleNewPlayer(player) {
        const playerRootNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ],
            playerIds: [player.id]
        });

        this.base.addChild(playerRootNode);

        this.playerStates[player.id] = {
            screen: 0,
            root: playerRootNode
        };
    }

    handlePlayerDisconnect(playerId) {
        const playerRoot = this.playerStates[playerId].root;
        this.base.removeChild(playerRoot.node.id);
    }
    
    deviceRules() {
        return {
            aspectRatio: (player, x) => {
            },
            deviceType: (player, type) => {
                console.log('player is using ' + type);
                if (type === 'desktop') {
                    const playerNode = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.RED,
                        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                        playerIds: [player.id]
                    });

                    if (this.playerStates[player.id]) {
                        this.playerStates[player.id].root.clearChildren();
                        this.playerStates[player.id].root.addChild(playerNode);
                    }
                } else if (type == 'mobile') {
                    const playerNode = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.BLUE,
                        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                        playerIds: [player.id]
                    });

                    // 1:2 ratio for mobile
                    player.receiveUpdate([9, 1, 2]);

                    if (this.playerStates[player.id]) {
                        this.playerStates[player.id].root.clearChildren();
                        this.playerStates[player.id].root.addChild(playerNode);
                    }
                } else {
                    const playerNode = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.TERRACOTTA,
                        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                        playerIds: [player.id]
                    });

                    if (this.playerStates[player.id]) {
                        this.playerStates[player.id].root.clearChildren();
                        this.playerStates[player.id].root.addChild(playerNode);
                    }
                } 
            }
        }
    }

    getRoot() {
        return this.base;
    }

}

module.exports = DeviceTest;
