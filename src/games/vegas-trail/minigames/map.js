const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0766');

class MapGame {
    constructor(mapData) {
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE
        });

        const map = this.constructMap(mapData);
        
        this.root.addChild(map);
    }

    constructMap(mapData) {
        mapData = {
            mapCoords: [
                [92, 92],
                [90, 85],
                [85, 85],
                [80, 80],
                [75, 78],
                [70, 78],
                [70, 76],
                [75, 72],
                [75, 68],
                [72, 66],
                [71, 65],
                [70, 64],
                [69, 64],
                [68, 64],
                [67, 62],
                [66, 57],
                [66, 55],
                [67, 54],
                [68, 52],
                [66, 48],
                [66, 47],
                [65, 45],
                [63, 44],
                [62, 43.5],
                [60, 43],
                [58, 42.5],
                [56, 42.5],
                [54, 44],
                [52, 44],
                [50, 44],
                [47, 48],
                [42, 48],
                [38, 46],
                [34, 45],
                [32, 40],
                [32, 36],
                [31, 32],
                [31, 26],
                [30, 24],
                [28, 22],
                [26, 22],
                [25, 21],
                [23, 20.5],
                [20, 20.5],
                [16, 19],
                [12, 19],
                [11, 18],
                [10, 14],
                [9, 10],
                [8, 8],
                [8, 12],
                [10, 18],
                [11, 20],
                [12, 21],
                [16, 21],
                [20, 22.5],
                [23, 22.5],
                [25, 23],
                [26, 24],
                [28, 24],
                [30, 26],
                [30, 28],
                [30, 34],
                [31, 38],
                [32, 42],
                [34, 47],
                [38, 48],
                [42, 50],
                [47, 50],
                [50, 46],
                [52, 46],
                [54, 46],
                [56, 44.5],
                [58, 44.5],
                [60, 45],
                [62, 45.5],
                [63, 46],
                [65, 47],
                [66, 49],
                [66, 50],
                [67, 53],
                [65, 54],
                [65, 57],
                [67, 64],
                [68, 66],
                [69, 66],
                [70, 66],
                [71, 67],
                [72, 68],
                [74, 70],
                [72, 73],
                [67, 78],
                [70.5, 80],
                [75, 81],
                [80, 82],
                [85, 87],
                [92, 92]

            //    [90, 85],
            //    [85, 85],
            //    [80, 80],
            //    [75, 78],
            //    [70, 78],
            //    [70, 76],
            //    [75, 72],
            //    [75, 68],
            //    [72, 66],
            //    [71, 65],
            //    [70, 64],
            //    [69, 64],
            //    [68, 64],
            //    [67, 62],
            //    [66, 57],
            ],
            landmarks: [
                
            ]
        };

        console.log("SEHE");
        console.log(ShapeUtils.rectangle(0, 0, 10, 10));

        return new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: mapData.mapCoords,//pathRectCoords,
            fill: Colors.COLORS.PINK
        });
    }

    tick() {
    }

    getRoot() {
        return this.root;
    }
}

module.exports = MapGame;
