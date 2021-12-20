const { Game, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish } = require('squishjs');
const { checkCollisions } = require('../../common/util');

const COLORS = Colors.COLORS;

const makePlane = (s) => {
            return new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 0, s, s),
                fill: Colors.COLORS.BLACK,
                onClick: (player, x, y) => {
                    console.log('I am the plane');
                }
            });
};

const getView = (plane, view, playerIds) => {

    const wouldBeCollisions = checkCollisions(plane, {node: {coordinates2d: ShapeUtils.rectangle(view.x, view.y, view.w, view.h)}}, (node) => {
        return node.node.id !== plane.node.id;
    });

    const convertedRoot = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        fill: Colors.COLORS.BLACK
    });

    const convertedNodes = [];

    if (wouldBeCollisions.length > 0) {
        wouldBeCollisions.forEach(node => {
            // need to slice piece of coordinates
            // need a clone method
            const translatedCoords = [];
            for (let coorPairIndex in node.node.coordinates2d) {
                const coordPair = node.node.coordinates2d[coorPairIndex];
                // console.log(coordPair);
                const x = coordPair[0];
                const y = coordPair[1];
                // console.log('i need to look at the point at ' + view.x);
                let translatedX = Math.max(Math.min(x - view.x, 100), 0);
                let translatedY = Math.max(Math.min(y - view.y, 100), 0);

                const xScale = 100 / (view.w || 100);
                const yScale = 100 / (view.h || 100);

                translatedX = xScale * translatedX;
                translatedY = yScale * translatedY;

                translatedCoords.push([translatedX, translatedY]);
            }

            const copied = node.clone({handleClick: node.node.handleClick === null || node.node.handleClick === undefined ? null : node.node.handleClick});
            
            copied.node.coordinates2d = translatedCoords;
            copied.node.playerIds = playerIds || [];
            convertedNodes.push(copied);
        });
    }

    convertedNodes.forEach(c => convertedRoot.addChild(c));

    return convertedRoot;
};

class ViewTest extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            author: 'Joseph Garcia',
            thumbnail: 'https://d3lgoy70hwd3pc.cloudfront.net/thumbnails/layer-test.png'
        };
    }

    constructor() {
        super();

        this.playerViews = {};

        this.plane = makePlane(500);

        // red square in top left
        // blue square in bottom right
        const redSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.RED,
            onClick: (player, x, y) => {
                const newView = Object.assign({}, this.playerViews[player.id].view);
                console.log('player clicked ' + player.id);
                console.log(newView);
                newView.x = this.playerViews[player.id].view.x - 1;
                this.playerViews[player.id].view = newView;
                const newTing = getView(this.plane, newView, [player.id]);
                this.fakeRoot.removeChild(this.playerViews[player.id].viewRoot.id);
                this.fakeRoot.addChild(newTing);
                // this.layers[0].root = newTing;
            }
        });

        const blueSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(400, 400, 100, 100),
            fill: COLORS.BLUE,
            onClick: () => {console.log('clicked a blue guy');}
        });

        this.plane.addChildren(redSquare, blueSquare);

    this.fakeRoot = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
        fill: Colors.COLORS.BLACK,
    });

        this.layers = [
            {
                root: this.fakeRoot
            }
        ];
    }

    handleNewPlayer(player) {
        const playerView = {x: 25, y: 0, w: 100, h: 100};

        console.log("player joined " + player.id);

        // console.log('they have a view');
        // console.log(playerView);

        // if (player.id == 1) {

            const viewRoot = getView(this.plane, playerView, [player.id]);

            viewRoot.node.playerIds = [player.id];

            this.playerViews[player.id] = {
                view: playerView,
                viewRoot
            }

            this.fakeRoot.addChild(viewRoot);
        // }
    }

    handlePlayerDisconnect() {
    }

    handleLayerClick() {
        const newColor = Colors.randomColor();
        this.color = newColor;
        this.fill = newColor;
    }

    getLayers() {
        return this.layers;
    }
}

module.exports = ViewTest;
