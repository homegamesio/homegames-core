const { Game, GameNode, Colors, ShapeUtils, Shapes, squish, unsquish } = require('squishjs');
const { checkCollisions, ExpiringSet, animations } = require('../../common/util');

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

    // console.log("ayyyy lmao");
    // console.log(view);
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

                // console.log("t: " + translatedX + ", " + translatedY);
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

        this.keyCoolDowns = new ExpiringSet();
        this.playerViews = {};
        this.planeSize = 200;
        this.plane = makePlane(this.planeSize);

        // red square in top left
        // blue square in bottom right
        const redSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 20, 20),
            fill: COLORS.RED,
            onClick: (player, x, y) => {
                // const newView = Object.assign({}, this.playerViews[player.id].view);
                // console.log('player clicked ' + player.id + ", " + x + ", " + y);
                // console.log(newView);
                // if (this.playerViews[player.id].view.x - 1 > 50) {
                //     newView.x = this.playerViews[player.id].view.x - 1;
                //     this.playerViews[player.id].view = newView;
                //     const newTing = getView(this.plane, newView, [player.id]);
                //     this.fakeRoot.removeChild(this.playerViews[player.id].viewRoot.id);
                //     this.fakeRoot.addChild(newTing);
                // }
                // this.layers[0].root = newTing;
            }
        });

        const blueSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(180, 180, 20, 20),
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

    handleKeyDown(player, key) {
        // console.log('player ' + player.id + ' typed ' + key);
        // return;
        // if (!this.playerEditStates[player.id] || !this.isText(key)) {
        //     return;
        // }

        const keyCacheId = `$player${player.id}:${key}`;
        // console.log(keyCacheId);

        if (['w','a','s','d'].indexOf(key) >= -1 && !this.keyCoolDowns.has(keyCacheId)) {
            const newView = Object.assign({}, this.playerViews[player.id].view);
            // console.log('player typed ' + player.id + ", " + key);
            // console.log(newView);
            if (key === 'w' && this.playerViews[player.id].view.y - 1 >= 0) {
                newView.y = this.playerViews[player.id].view.y - 1    
            }
            if (key === 'a' && this.playerViews[player.id].view.x - 1 >= 0) {
                newView.x = this.playerViews[player.id].view.x - 1;
            }

            // console.log(this.planeSize);
            if (key === 's' && this.playerViews[player.id].view.y + 1 < this.planeSize - 100) {
                newView.y = this.playerViews[player.id].view.y + 1;
            }

            if (key === 'd' && this.playerViews[player.id].view.x + 1 < this.planeSize - 100) {
                newView.x = this.playerViews[player.id].view.x + 1;
            }

            // console.log(newView);
            // console.log('wat');
            // console.log(this.playerViews[player.id]);

            // console.log("yo");
            const newTing = getView(this.plane, newView, [player.id]);

            this.fakeRoot.removeChild(this.playerViews[player.id].viewRoot.node.id);
        
            this.playerViews[player.id] = {
                view: newView,
                viewRoot: newTing
            };

            this.fakeRoot.addChild(newTing);
            // const newText = this.playerNodes[player.id].text;
            // if (newText.text.length > 0 && key === 'Backspace') {
            //     newText.text = newText.text.substring(0, newText.text.length - 1); 
            // } else if(key !== 'Backspace') {
            //     newText.text = newText.text + key;
            // }
            // this.playerNodes[player.id].text = newText;
            this.keyCoolDowns.put(keyCacheId, 200);
        }
    }

    handleNewPlayer(player) {
        const playerView = {x: 0, y: 0, w: 100, h: 100};

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
