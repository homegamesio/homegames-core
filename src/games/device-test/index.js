const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0766');

const COLORS = Colors.COLORS;

class DeviceTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0766',
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

    handleNewPlayer({ playerId, clientInfo }) {
        const playerRootNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ],
            playerIds: [playerId]
        });

        this.base.addChild(playerRootNode);

        this.playerStates[playerId] = {
            screen: 0,
            root: playerRootNode
        };
        this.deviceRules(playerId, clientInfo);
    }

    handlePlayerDisconnect(playerId) {
        const playerRoot = this.playerStates[playerId].root;
        this.base.removeChild(playerRoot.node.id);
    }
    
    deviceRules(playerId, clientInfo) {
        const funcMap = {
            aspectRatio: (player, x) => {
            },
            deviceType: (type) => {
                if (type === 'desktop') {
                    const playerNode = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.RED,
                        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                        playerIds: [playerId]
                    });

                    if (this.playerStates[playerId]) {
                        this.playerStates[playerId].root.clearChildren();
                        this.playerStates[playerId].root.addChild(playerNode);
                    }
                } else if (type == 'mobile') {
                    const playerNode = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.BLUE,
                        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                        playerIds: [playerId]
                    });

                    // 1:2 ratio for mobile
                    // player.receiveUpdate([9, 1, 2]);

                    if (this.playerStates[playerId]) {
                        this.playerStates[playerId].root.clearChildren();
                        this.playerStates[playerId].root.addChild(playerNode);
                    }
                } else {
                    const playerNode = new GameNode.Shape({
                        shapeType: Shapes.POLYGON,
                        fill: COLORS.TERRACOTTA,
                        coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                        playerIds: [playerId]
                    });

                    if (this.playerStates[playerId]) {
                        this.playerStates[playerId].root.clearChildren();
                        this.playerStates[playerId].root.addChild(playerNode);
                    }
                } 
            }
        };

        funcMap.deviceType(clientInfo.deviceType);
    }

    getLayers() {
        return [{root: this.base}];
    }

}

module.exports = DeviceTest;
