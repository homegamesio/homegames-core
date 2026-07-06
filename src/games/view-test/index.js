const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squish-142');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class ViewTest extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            squishVersion: '142',
            thumbnail: '0bb938289d7473b8f2a2184031f38935',
            isTest: true,
            tickRate: 100
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
                console.log('clicked red!')
                // this.updatePlaneSize(500);
            }
        });

        const blueSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(100, 100, 25, 25),
            fill: COLORS.BLUE,
            onClick: () => {
                console.log('clicked blue!');
            }
        });

        whiteBase.addChildren(redSquare, blueSquare);
        this.getPlane().addChildren(whiteBase);
    }

    handleKeyDown(playerId, key) {
        const keyCacheId = `$player${playerId}:${key}`;

        if (['w','a','s','d'].indexOf(key) >= -1 && !this.keyCoolDowns.has(keyCacheId)) {
            const newView = Object.assign({}, this.playerViews[playerId].view);

            if (key === 'w' && this.playerViews[playerId].view.y - 1 >= 0) {
                newView.y = this.playerViews[playerId].view.y - 0.2;    
            }
            if (key === 'a' && this.playerViews[playerId].view.x - 1 >= 0) {
                newView.x = this.playerViews[playerId].view.x - 0.2;
            }

            if (key === 's' && this.playerViews[playerId].view.y + 1 <= this.getPlaneSize() - newView.h) {
                newView.y = this.playerViews[playerId].view.y + 0.2;
            }

            if (key === 'd' && this.playerViews[playerId].view.x + 1 <= this.getPlaneSize() - newView.w) {
                newView.x = this.playerViews[playerId].view.x + 0.2;
            }

            const newViewRoot = ViewUtils.getView(this.getPlane(), newView, [playerId]);

            // console.log('sjdsdjsjddjs');
            // console.log(newViewRoot.node.children.length);
        
            this.playerViews[playerId].view = newView;
                // view: newView
            // };

            if (this.playerViews[Number(playerId)].viewRoot) {
                this.playerViews[playerId].viewRoot.node.clearChildren();
                this.playerViews[playerId].viewRoot.node.addChild(newViewRoot);

                this.playerViews[playerId].viewRoot.node.onStateChange();
            } else {
                // console.log(Object.keys(this.playerViews));
                // this.playerViews[playerId].viewRoot = newViewRoot;
                // this.getViewRoot().addChild(newViewRoot);
                // console.log('sdjfsdkfjdsf');
                // console.log(this.playerViews[playerId]);
            }        


            this.keyCoolDowns.put(keyCacheId, 20);
        }
    }

    handleNewPlayer({ playerId }) {
        const playerView = {x: 0, y: 0, w: 100, h: 100};

        // white base visible to the player so they never see _nothing_
        const realRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.WHITE,
            playerIds: [playerId]
        });

        const playerViewRoot = ViewUtils.getView(this.getPlane(), playerView, [playerId]);

        playerViewRoot.node.playerIds = [playerId];

        realRoot.addChild(playerViewRoot);
        
        this.playerViews[playerId] = {
            view: playerView,
            viewRoot: realRoot
        };

        this.getViewRoot().addChild(realRoot);
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
