const { Game, GameNode, Colors, ShapeUtils, Shapes } = require('squishjs');

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
    const s = Object.keys(plane).length;
    const _view = new Array(view.w * view.h);
    let viewIndex = 0;
    for (let i = view.x - (view.w / 2); i < view.x + (view.w / 2); i++) {//s + view.w; i++) {
        for (let j = view.y - (view.h / 2); j < view.y + (view.h / 2); j++) {//(let j = s; j < s + view.h; j++) {
            _view[viewIndex++] = plane[i][j];
            //const viewIndex = (i  * view.w) + j;// - s;
            //console.log(viewIndex)
//            _view[viewIndex] = plane[i][j];
//            console.log('what is this ' + ((i - s) + ', ' + (j - s)) + ", " + (((i-s) * (view.w)) + (j-s)));
//            console.log('plsssss ' + (i + j - (2 * s)));
        }
    }

    return _view;
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

        const plane = makePlane(500);
        const view = {x: 50, y: 50, w: 50, h: 50};

        const ting = getView(plane, view);

        // hack (??)
        const fakeRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });
        console.log('thing size ' + ting.length);

//        ting.forEach(node => {
  //          console.log("GINGR need to shift over to fit 100 * 100");
    //        console.log(node.node.coordinates2d);
      //      fakeRoot.addChild(node);
      //  });

        this.layers = [
            {
                root: fakeRoot//getView(plane, view)
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
