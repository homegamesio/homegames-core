const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-142');

const COLORS = Colors.COLORS;

class DeviceTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '142',
            author: 'Joseph Garcia', 
            thumbnail: '81822fc854ca15f24dbe87de58521e2b',
            tickRate: 10,
            isTest: true
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
        const colorsByType = {
            desktop: COLORS.RED,
            mobile: COLORS.BLUE,
            tablet: COLORS.GREEN
        };

        // Unknown/missing device types are treated as desktop.
        const reportedType = clientInfo && clientInfo.deviceType;
        const type = colorsByType[reportedType] ? reportedType : 'desktop';

        const playerNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: colorsByType[type],
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            playerIds: [playerId]
        });

        if (this.playerStates[playerId]) {
            this.playerStates[playerId].root.clearChildren();
            this.playerStates[playerId].root.addChild(playerNode);
        }
    }

    getLayers() {
        return [{root: this.base}];
    }

}

module.exports = DeviceTest;
