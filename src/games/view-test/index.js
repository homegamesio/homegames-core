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
 
//    const data = {};
//    for (let i = 0; i < s; i++) {
//        data[i] = {};
//        for (let j = 0; j < s; j++) {
//            data[Number(i)][Number(j)] = new GameNode.Shape({
//                shapeType: Shapes.POLYGON,
//                coordinates2d: ShapeUtils.rectangle(0, 0, s, s),
//                fill: Colors.COLORS.GREEN,
//                onClick: (player, x, y) => {
//                    console.log('I am the plane');
//                }
//            });
//        }
//    }
//
//    return data;
};

const getView = (plane, view) => {
    console.log('view');
    console.log(view);

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
                const translatedX = Math.max(Math.min(x - view.x, 100), 0);
                const translatedY = Math.max(Math.min(y - view.y, 100), 0);;
                // console.log("translated x " + translatedX);
                // console.log("translated y " + translatedY);
                translatedCoords.push([translatedX, translatedY]);
            }

            // console.log('need to copy this');
            // console.log(node);
            // squish(node);
            const copied = node.clone({handleClick: node.node.handleClick === null || node.node.handleClick === undefined ? null : node.node.handleClick});
            // console.log(cloned);
            // console.log('hwgfdsg');
            // console.log(copied);
            // console.log(node);

            // copied.node.fill = [0, 255, 255, 255];


            // const copied = node.clone({});

            // const copied = unsquish(squish(node));
            // console.log("copied");
            // console.log(copied);
            copied.node.coordinates2d = translatedCoords;
            convertedNodes.push(copied);
            // convertedNodes.push(node);
            
            // console.log(translatedCoords);
            // console.log(node.node.coordinates2d);
            // console.log(node.node.fill);
        });
    }

    convertedNodes.forEach(c => convertedRoot.addChild(c));

    return convertedRoot;
};

// const getViewHelper = (node, view, nodes = []) => {
//     console.log('need to look at this nodes coords and see if view contains it');
//     console.log(node.node.coordinates2d);

//     const coords = node.node.coordinates2d;
//     console.log("comparing to these coors");
//     console.log(ShapeUtils.rectangle(view.x, view.y, view.w, view.h));

//     const wouldBeCollisions = checkCollisions(node, {node: {coordinates2d: ShapeUtils.rectangle(view.x, view.y, view.w, view.h)}});

//     if (wouldBeCollisions.length > 0) {
//         console.log('wouild be collisions here');
//         console.log(node.node.fill);
//     }

//     for (let i = 0; i < node.node.children.length; i++) {
//         getViewHelper(node.node.children[i], view, nodes);
//     }

//     return nodes;
// };

//const getView = (plane, view) => {
//    const s = Object.keys(plane).length;
//    const _view = new Array(view.w * view.h);
//    let viewIndex = 0;
//    for (let i = view.x - (view.w / 2); i < view.x + (view.w / 2); i++) {//s + view.w; i++) {
//        for (let j = view.y - (view.h / 2); j < view.y + (view.h / 2); j++) {//(let j = s; j < s + view.h; j++) {
//            _view[viewIndex++] = plane[i][j];
//            //const viewIndex = (i  * view.w) + j;// - s;
//            //console.log(viewIndex)
////            _view[viewIndex] = plane[i][j];
////            console.log('what is this ' + ((i - s) + ', ' + (j - s)) + ", " + (((i-s) * (view.w)) + (j-s)));
////            console.log('plsssss ' + (i + j - (2 * s)));
//        }
//    }
//
//    return _view;
//};

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

        this.view = {x: 25, y: 0, w: 100, h: 100};

        this.plane = makePlane(500);

        // red square in top left
        // blue square in bottom right
        const redSquare = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.RED,
            onClick: () => {
                console.log("yo");
                console.log(this.view);
                const newView = Object.assign({}, this.view);
                newView.x = this.view.x - 1;
                this.view = newView;
                console.log("yodsaf")
                console.log(this.view);
                const newTing = getView(this.plane, this.view);
                console.log(newTing);
                console.log("fake root");
                console.log(this.fakeRoot);
                this.fakeRoot.clearChildren();
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
        fill: Colors.COLORS.BLACK
    });

        const ting = getView(this.plane, this.view);

      console.log('ting');
      console.log(ting);
      this.fakeRoot.addChild(ting);

        this.layers = [
            {
                root: this.fakeRoot
            }
        ];
    }

    handleNewPlayer() {
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
