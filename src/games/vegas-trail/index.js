const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0766');
const { MapGame, Drive, Fight, Hunt, Stats } = require('./minigames/index.js');
const COLORS = Colors.COLORS;

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

        this.map = new MapGame();
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
        this.activeGame && this.activeGame.tick();
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = VegasTrail;
