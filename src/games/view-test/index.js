const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0767');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class ViewTest extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            squishVersion: '0767'
        };
    }

    constructor() {
        super(200);

        this.keyCoolDowns = new ExpiringSet();
        this.playerViews = {};

        const whiteBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 200, 200),
            fill: COLORS.WHITE
        });
        
        // red square in top left
        // blue square in bottom right
        const redSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.RED,
            onClick: () => {
                this.updatePlaneSize(500);
            }
        });

        const blueSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(100, 100, 25, 25),
            fill: COLORS.BLUE,
            onClick: () => {}
        });

        whiteBase.addChildren(redSquare, blueSquare);
        this.getPlane().addChildren(whiteBase);
    }

    handleKeyDown(playerId, key) {
        const keyCacheId = `$player${playerId}:${key}`;

        if (['w','a','s','d'].indexOf(key) >= -1 && !this.keyCoolDowns.has(keyCacheId)) {
            const newView = Object.assign({}, this.playerViews[playerId].view);

            if (key === 'w' && this.playerViews[playerId].view.y - 1 >= 0) {
                newView.y = this.playerViews[playerId].view.y - 1;    
            }
            if (key === 'a' && this.playerViews[playerId].view.x - 1 >= 0) {
                newView.x = this.playerViews[playerId].view.x - 1;
            }

            if (key === 's' && this.playerViews[playerId].view.y + 1 <= this.getPlaneSize() - newView.h) {
                newView.y = this.playerViews[playerId].view.y + 1;
            }

            if (key === 'd' && this.playerViews[playerId].view.x + 1 <= this.getPlaneSize() - newView.w) {
                newView.x = this.playerViews[playerId].view.x + 1;
            }

            const newViewRoot = ViewUtils.getView(this.getPlane(), newView, [playerId]);

            this.getViewRoot().removeChild(this.playerViews[playerId].viewRoot.node.id);
        
            this.playerViews[playerId] = {
                view: newView,
                viewRoot: newViewRoot
            };

            this.getViewRoot().addChild(newViewRoot);

            this.keyCoolDowns.put(keyCacheId, 200);
        }
    }

    handleNewPlayer({ playerId }) {
        const playerView = {x: 0, y: 0, w: 100, h: 100};

        const playerViewRoot = ViewUtils.getView(this.getPlane(), playerView, [playerId]);

        playerViewRoot.node.playerIds = [playerId];

        this.playerViews[playerId] = {
            view: playerView,
            viewRoot: playerViewRoot
        };

        this.getViewRoot().addChild(playerViewRoot);
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].viewRoot;
        if (playerViewRoot) {
            this.getViewRoot().removeChild(playerViewRoot.node.id);
        }
    }

    handleLayerClick() {
        const newColor = Colors.randomColor();
        this.color = newColor;
        this.fill = newColor;
    }

}

module.exports = ViewTest;
