const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0766');
const { MapGame, Drive, Fight, Hunt, Stats } = require('./minigames/index.js');
const COLORS = Colors.COLORS;

const mapData = {
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
   ],
   landmarks: [
       
   ]
};

const mapOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(42, 0, 8, 10),
        fill: COLORS.WHITE,
        onClick
    });
};

const driveOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(54, 0, 8, 10),
        fill: COLORS.WHITE,
        onClick
    });
};

const huntOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(66, 0, 8, 10),
        fill: COLORS.WHITE,
        onClick
    });
};

const fightOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(78, 0, 8, 10),
        fill: COLORS.WHITE,
        onClick
    });
};

const statsOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(90, 0, 8, 10),
        fill: COLORS.WHITE,
        onClick
    });
};

class VegasTrail extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0766',
            author: 'Joseph Garcia',
            thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96',
            tickRate: 30,
        };
    }

    constructor(initialState ={}) {
        super();
    
        this.playerStates = {};
        this.map = new MapGame(this, mapData);
        this.drive = new Drive();
        this.hunt = new Hunt();
        this.fight = new Fight();
        this.stats = new Stats();

        this.state = initialState;
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: COLORS.GRAY 
        });

        this.gameLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });

        this.optionsLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100)
        });

        this.base.addChild(this.gameLayer);
        this.base.addChild(this.optionsLayer);

        this.menuOptions = [
            mapOptionNode(() => this.setCurrentGame(this.map)),
            driveOptionNode(() => this.setCurrentGame(this.drive)),
            huntOptionNode(() => this.setCurrentGame(this.hunt)),
            fightOptionNode(() => this.setCurrentGame(this.fight)),
            statsOptionNode(() => this.setCurrentGame(this.stats))
        ];

        for (let i in this.menuOptions) {
            this.optionsLayer.addChild(this.menuOptions[i]);
        }

        this.setCurrentGame(this.map);
    }

    setCurrentGame(minigame) {
       this.gameLayer.clearChildren(); 
       this.activeGame = minigame;
       this.gameLayer.addChild(minigame.getRoot());
    }

    handleNewPlayer({ playerId }) {
        const node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: Colors.COLORS.PURPLE,
            coordinates2d: ShapeUtils.rectangle(mapData.mapCoords[0][0], mapData.mapCoords[0][1], 2, 2)
        });

        this.playerStates[playerId] = {
            path: Object.assign(new Array(), mapData.mapCoords),
            currentIndex: 0,
            movementInterval: 100,
            node
        }

        this.map.getRoot().addChild(node);
//        const hunt = new Hunt(playerId);
//        const run = new Run(playerId);
//        const gridDefense = new GridDefense(playerId);
//        const fightIllness = new Illness(playerId);
//        this.activeGame = fightIllness;
//        this.activeGame = gridDefense;
//  this.activeGame = hunt;

        // todo: add view here for each player
//        this.base.addChild(hunt.getRoot());
//        this.base.addChild(run.getRoot());

//        this.base.addChild(gridDefense.getRoot());
//        this.base.addChild(fightIllness.getRoot());
    }

    handleKeyUp(player, key) {
//        this.keysDown[key] = true;
    }

    tick() {
        this.map.tick(this.playerStates);
        this.drive.tick(this.playerStates);
        this.hunt.tick(this.playerStates); 
        this.fight.tick(this.playerStates);
        this.stats.tick(this.playerStates); 
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = VegasTrail;
