const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-0710');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class ViewTest extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia'
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
            onClick: () => {console.log('clicked a blue guy');}
        });

        whiteBase.addChildren(redSquare, blueSquare);
        this.getPlane().addChildren(whiteBase);
    }

    handleKeyDown(player, key) {
        const keyCacheId = `$player${player.id}:${key}`;

        if (['w','a','s','d'].indexOf(key) >= -1 && !this.keyCoolDowns.has(keyCacheId)) {
            const newView = Object.assign({}, this.playerViews[player.id].view);

            if (key === 'w' && this.playerViews[player.id].view.y - 1 >= 0) {
                newView.y = this.playerViews[player.id].view.y - 1    
            }
            if (key === 'a' && this.playerViews[player.id].view.x - 1 >= 0) {
                newView.x = this.playerViews[player.id].view.x - 1;
            }

            if (key === 's' && this.playerViews[player.id].view.y + 1 <= this.getPlaneSize() - newView.h) {
                newView.y = this.playerViews[player.id].view.y + 1;
            }

            if (key === 'd' && this.playerViews[player.id].view.x + 1 <= this.getPlaneSize() - newView.w) {
                newView.x = this.playerViews[player.id].view.x + 1;
            }

            const newTing = ViewUtils.getView(this.getPlane(), newView, [player.id]);

            this.getViewRoot().removeChild(this.playerViews[player.id].viewRoot.node.id);
        
            this.playerViews[player.id] = {
                view: newView,
                viewRoot: newTing
            };

            this.getViewRoot().addChild(newTing);

            this.keyCoolDowns.put(keyCacheId, 200);
        }
    }

    handleNewPlayer(player) {
        const playerView = {x: 0, y: 0, w: 100, h: 100};

        const playerViewRoot = ViewUtils.getView(this.getPlane(), playerView, [player.id]);

        playerViewRoot.node.playerIds = [player.id];

        this.playerViews[player.id] = {
            view: playerView,
            viewRoot: playerViewRoot
        }

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
