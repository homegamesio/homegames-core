const { Game, ViewableGame, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish, ViewUtils } = require('squishjs');
const { ExpiringSet, animations } = require('../../common/util');

const COLORS = Colors.COLORS;

class ViewTest extends ViewableGame {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/layer-test.png'
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
            onClick: () => {console.log('clicked a red guy');}
        });

        const blueSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(100, 100, 25, 25),
            fill: COLORS.BLUE,
            onClick: () => {console.log('clicked a blue guy');}
        });

        whiteBase.addChildren(redSquare, blueSquare);
        // this.updatePlaneSize(500);
        this.addPlaneChildren(whiteBase);
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

            if (key === 's' && this.playerViews[player.id].view.y + 1 < this.planeSize - 100) {
                newView.y = this.playerViews[player.id].view.y + 1;
            }

            if (key === 'd' && this.playerViews[player.id].view.x + 1 < this.planeSize - 100) {
                newView.x = this.playerViews[player.id].view.x + 1;
            }

            const newTing = ViewUtils.getView(this.getPlane(), newView, [player.id]);

            this.fakeRoot.removeChild(this.playerViews[player.id].viewRoot.node.id);
        
            this.playerViews[player.id] = {
                view: newView,
                viewRoot: newTing
            };

            this.fakeRoot.addChild(newTing);

            this.keyCoolDowns.put(keyCacheId, 200);
        }
    }

    handleNewPlayer(player) {
        const playerView = {x: 0, y: 0, w: 100, h: 100};

        console.log("player joined " + player.id);


        console.log("PLABNE");
        console.log(this.getPlane());
        const viewRoot = ViewUtils.getView(this.getPlane(), playerView, [player.id]);

        viewRoot.node.playerIds = [player.id];

        this.playerViews[player.id] = {
            view: playerView,
            viewRoot
        }

        this.fakeRoot.addChild(viewRoot);
    }

    handlePlayerDisconnect(playerId) {
        const playerViewRoot = this.playerViews[playerId] && this.playerViews[playerId].viewRoot;
        if (playerViewRoot) {
            this.fakeRoot.removeChild(playerViewRoot.node.id);
        }
    }

    handleLayerClick() {
        const newColor = Colors.randomColor();
        this.color = newColor;
        this.fill = newColor;
    }

}

module.exports = ViewTest;
