const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0767');
const { MapGame, Drive, Fight, Hunt, Stats } = require('./minigames/index.js');
const COLORS = Colors.COLORS;

const defaultResources = () => {
    return {
        scrap: 50,
        wheels: 3,
        ammo: 10,
        medpack: 1
    }
};

const defaultUpgrades = () => {
    return {
        strength: 2,
        resilience: 2,
        weapons: 2,
        magnetism: 2
    }
};

const mapData = {
    mapCoords: [
       [92, 94],
       [90, 87],
       [85, 87],
       [80, 82],
       [75, 80],
       [70, 80],
       [70, 78],
       [75, 74],
       [75, 70],
       [72, 68],
       [71, 67],
       [70, 66],
       [69, 66],
       [68, 66],
       [67, 64],
       [66, 59],
       [66, 57],
       [67, 56],
       [68, 54],
       [66, 50],
       [66, 49],
       [65, 47],
       [63, 46],
       [62, 45.5],
       [60, 45],
       [58, 44.5],
       [56, 44.5],
       [54, 46],
       [52, 46],
       [50, 46],
       [47, 50],
       [42, 50],
       [38, 48],
       [34, 47],
       [32, 42],
       [32, 38],
       [31, 34],
       [31, 28],
       [30, 26],
       [28, 24],
       [26, 24],
       [25, 23],
       [23, 22.5],
       [20, 22.5],
       [16, 21],
       [12, 21],
       [11, 20],
       [10, 16],
       [9, 12],
       [8, 10],
       [8, 14],
       [10, 20],
       [11, 22],
       [12, 23],
       [16, 23],
       [20, 24.5],
       [23, 24.5],
       [25, 25],
       [26, 26],
       [28, 26],
       [30, 28],
       [30, 30],
       [30, 36],
       [31, 40],
       [32, 44],
       [34, 49],
       [38, 50],
       [42, 52],
       [47, 52],
       [50, 48],
       [52, 48],
       [54, 48],
       [56, 46.5],
       [58, 46.5],
       [60, 47],
       [62, 47.5],
       [63, 48],
       [65, 49],
       [66, 51],
       [66, 52],
       [67, 55],
       [65, 56],
       [65, 59],
       [67, 66],
       [68, 68],
       [69, 68],
       [70, 68],
       [71, 69],
       [72, 70],
       [74, 72],
       [72, 75],
       [67, 80],
       [70.5, 82],
       [75, 83],
       [80, 84],
       [85, 89],
       [92, 94]
   ],
   landmarks: [
       
   ]
};

const mapOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(42, 0, 8, 10),
        fill: COLORS.RED,
        onClick
    });
};

const driveOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(54, 0, 8, 10),
        fill: COLORS.RED,
        onClick
    });
};

const huntOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(66, 0, 8, 10),
        fill: COLORS.RED,
        onClick
    });
};

const fightOptionNode = (onClick) => {
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(78, 0, 8, 10),
        fill: COLORS.RED,
        onClick
    });
};

const statsOptionNode = (onClick) => {
    console.log('ayo what');
    console.log(onClick);
    return new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(90, 0, 8, 10),
        fill: COLORS.RED,
        onClick
    });
};

class VegasTrail extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0767',
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
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.statsLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.base.addChild(this.gameLayer);
        this.base.addChild(this.optionsLayer);
        this.base.addChild(this.statsLayer);

        this.setCurrentGame(this.map);

        this.renderOptionsLayer();
        this.renderStatsLayer();
    }

    setCurrentGame(minigame) {
       this.gameLayer.clearChildren(); 
       this.activeGame = minigame;
       this.gameLayer.addChild(minigame.getRoot());
    }

    renderOptionsLayer() {        
        this.optionsLayer.clearChildren();

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
    }

    renderStatsLayer() {
        this.statsLayer.clearChildren();

        const statsBox = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 35, 10),
            fill: Colors.COLORS.BLUE
        });

        this.statsLayer.addChild(statsBox);
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
            node,
            score: 0,
            ...defaultResources()
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
