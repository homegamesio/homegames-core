const { Game, GameNode, Colors, Shapes, ShapeUtils } = require('squish-0767');
const COLORS = Colors.COLORS;

class PlayerVisibilityTest extends Game {
    static metadata() {
        return {
            name: 'Visibility test',
            squishVersion: '0767',
            author: 'Joseph Garcia',
            aspectRatio: {x: 1, y: 2},
            description: 'Test that multiple players can view/hide game nodes'
        };
    }

    constructor() {
        super();
        this.secretMessage = new GameNode.Text({
            textInfo: {
                text: 'ayy lmao',
                align: 'center',
                color: COLORS.GREEN,
                size: 3,
                x: 50,
                y: 50
            },
            playerIds: [0]
        });

        this.secretChild = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(10, 20, 5, 5),
            fill: COLORS.RED
        });

        this.spectatorNode = new GameNode.Text({
            textInfo: {
                text: 'Hello, spectator',
                x: 50,
                y: 50,
                size: 2,
                align: 'center',
                color: COLORS.BLACK
            }
        });
 
        this.secretMessage.addChild(this.secretChild);

        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.WHITE
        });

        this.showButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(40, 10, 20, 20),
            fill: COLORS.HG_BLUE,
            onClick: (playerId) => {
                this.secretMessage.showFor(playerId);
            }
        });

        this.hideButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(40, 70, 20, 20),
            fill: COLORS.PURPLE,
            onClick: (playerId) => {
                this.secretMessage.hideFor(playerId);
            }
        });
        
        this.base.addChild(this.showButton);
        this.base.addChild(this.hideButton);
        this.base.addChild(this.secretMessage);
    }

    getLayers() {
        return [{
            root: this.base
        }];
    }

    getSpectatorLayers() {
        return [{
            root: this.spectatorNode
        }];
    }

}

module.exports = PlayerVisibilityTest;
