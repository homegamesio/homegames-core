const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squishjs');
const COLORS = Colors.COLORS;

class PlayerVisibilityTest extends Game {
    static metadata() {
        return {
            title: 'Fuk you',
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.secretMessage = new GameNode.Text({
            text: 'ayy lmao',
            align: 'center',
            color: COLORS.GREEN,
            size: 3,
            x: 50,
            y: 50
        }, [0]);
        
        this.base = new GameNode.Shape(
            COLORS.WHITE, 
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
                fill: COLORS.WHITE
            }
        );

        this.showButton = new GameNode.Shape(
            COLORS.HG_BLUE,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(40, 10, 20, 20),
                fill: COLORS.HG_BLUE
            },
            null,
            (player) => {
                const playerIdIndex = this.secretMessage.node.playerIds.indexOf(player.id);
                const zeroIndex = this.secretMessage.node.playerIds.indexOf(0);
                console.lo
                console.log(zeroIndex);
                if (zeroIndex >= 0) {
                    let newPlayerIds = this.secretMessage.node.playerIds;
                    newPlayerIds.splice(zeroIndex, 1);
                    this.secretMessage.node.playerIds = newPlayerIds;
                }
                if (playerIdIndex < 0) {
                    let newPlayerIds = this.secretMessage.node.playerIds;
                    newPlayerIds.push(player.id);
                    this.secretMessage.node.playerIds = newPlayerIds;
                }

                console.log(this.secretMessage.node.playerIds);
            }

        );

        this.hideButton = new GameNode.Shape(
            COLORS.RED,
            Shapes.POLYGON,
            {
                coordinates2d: ShapeUtils.rectangle(40, 70, 20, 20),
                fill: COLORS.RED
            },
            null,
            (player) => {
                const playerIdIndex = this.secretMessage.node.playerIds.indexOf(player.id);
                if (playerIdIndex >= 0) {
                    let newPlayerIds = this.secretMessage.node.playerIds;
                    newPlayerIds.splice(playerIdIndex, 1);
                    if (newPlayerIds.length == 0) {
                        newPlayerIds = [0];
                    }
                    this.secretMessage.node.playerIds = newPlayerIds;
                }
                console.log(this.secretMessage.node.playerIds);
            }
        );
        
        this.base.addChild(this.showButton);
        this.base.addChild(this.hideButton);
        this.base.addChild(this.secretMessage);
    }

    getRoot() {
        return this.base;
    }

}

module.exports = PlayerVisibilityTest;
