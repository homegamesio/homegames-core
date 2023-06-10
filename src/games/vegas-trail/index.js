const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils, Asset } = require('squish-0767');
const { MapGame, Drive, Fight, Hunt, Talk } = require('./minigames/index.js');
const COLORS = Colors.COLORS;

const TOTAL_DISTANCE = 420;

const defaultResources = () => {
    return {
        scrap: 50, // money
        wheels: 3, // 2 needed to drive
        ammo: 10, // depleted when hunting
        health: 100, // falls due to illness
        antibiotics: 0, // increase health
        springs: 0, // jump river
        treats: 1 // give to dogs
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
       [78, 74],
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
       {
            coord: [92, 94],
            textCoord: [74.5, 94],
            name: `St. Mary's Mexican Food`,
            assetKey: 'placeholder',
            descriptionLines: [
                'ayy lmao i will write this',
                'or will i',
                'time will tell'
            ]
       },
       {
            coord: [78, 74],
            textCoord: [80.5, 74],
            name: 'Phoenix',
            assetKey: 'placeholder',
            descriptionLines: [
                'ayy lmao i will write this',
                'or will i',
                'time will tell'
            ]
       },
       {
            coord: [54, 46],
            textCoord: [52, 49],
            name: 'Gas Station',
            assetKey: 'placeholder',
            descriptionLines: [
                'ayy lmao i will write this',
                'or will i',
                'time will tell'
            ]
       },
       {
            coord: [32, 42],
            textCoord: [34.5, 41.5],
            name: 'Hoover Dam',
            assetKey: 'placeholder',
            descriptionLines: [
                'ayy lmao i will write this',
                'or will i',
                'time will tell'
            ]
       },
       {
            coord: [8, 10],
            textCoord: [11, 10],
            name: 'Las Vegas Strip',
            assetKey: 'placeholder',
            descriptionLines: [
                'ayy lmao i will write this',
                'or will i',
                'time will tell'
            ]
       }
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

const talkOptionNode = (onClick) => {
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
            tickRate: 40,
            assets: {
                'placeholder': new Asset({
                    'id': '3b16c6d6ee6d3709bf827b61e61003b1',
                    'type': 'image'
                })
            }
        };
    }

    constructor(initialState ={}) {
        super();
    
        this.playerStates = {};

        this.distanceTraveled = 0;

        this.travelUpdateInterval = 1000; // update distance traveled every one second

        // if the trip to vegas takes ~ 10 minutes and that trip is TOTAL_DISTANCE, then we have 10 minutes / travel update interval ticks to travel TOTAL_DISTANCE
        this.travelTickDistance = (TOTAL_DISTANCE / (10 * 60 * 1000 / this.travelUpdateInterval));

        this.map = new MapGame(this, mapData, TOTAL_DISTANCE);
        this.drive = new Drive();
        this.hunt = new Hunt({
            depleteAmmo: (count) => {
                this.resources.ammo = this.resources.ammo - count;
                const textInfo = Object.assign({}, this.ammoText.node.text);
                textInfo.text = `Ammo: ${this.resources.ammo}`;
                this.ammoText.node.text = textInfo;
            }
        });
        this.fight = new Fight();
        this.talk = new Talk();

        this.resources = { ...defaultResources() }

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

        this.grayThing = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 10),
            fill: Colors.COLORS.GRAY
        });

        // player ids 254 is a hack to make the nodes effectively invisible to all players
        this.map.getRoot().showFor(254);
        this.drive.getRoot().showFor(254);
        this.hunt.getRoot().showFor(254);
        this.fight.getRoot().showFor(254);
        this.talk.getRoot().showFor(254);

        this.grayThing.addChildren(this.optionsLayer, this.statsLayer);

        this.base.addChild(this.gameLayer);
        this.base.addChild(this.grayThing);

        this.gameLayer.addChildren(this.map.getRoot(), this.drive.getRoot(), this.hunt.getRoot(), this.fight.getRoot(), this.talk.getRoot());

        this.renderOptionsLayer();
        this.renderStatsLayer();
    }

    setCurrentGame(playerId, minigame) {
        if (this.playerStates[playerId].currentGame) {
            this.playerStates[playerId].currentGame.getRoot().hideFor(playerId);
        }
        this.playerStates[playerId].currentGame = minigame;
        
        minigame.getRoot().showFor(playerId);
       // this.gameLayer.clearChildren(); 
       // this.activeGame = minigame;
       // this.gameLayer.addChild(minigame.getRoot());
    }

    renderOptionsLayer() {        
        this.optionsLayer.clearChildren();

        this.menuOptions = [
            mapOptionNode((playerId) => this.setCurrentGame(playerId, this.map)),
            driveOptionNode((playerId) => this.setCurrentGame(playerId, this.drive)),
            huntOptionNode((playerId) => this.setCurrentGame(playerId, this.hunt)),
            fightOptionNode((playerId) => this.setCurrentGame(playerId, this.fight)),
            talkOptionNode((playerId) => this.setCurrentGame(playerId, this.talk))
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

        const scrapText = new GameNode.Text({
            textInfo: {
                x: 2,
                y: 1,
                color: Colors.COLORS.PINK,
                text: `Scrap: ${this.resources.scrap}`,
                align: 'left',
                size: 0.8
            },
        });

        this.ammoText = new GameNode.Text({
            textInfo: {
                x: 10,
                y: 1,
                color: Colors.COLORS.PINK,
                text: `Ammo: ${this.resources.ammo}`,
                align: 'left',
                size: 0.8
            },
        });

        const healthText = new GameNode.Text({
            textInfo: {
                x: 19,
                y: 1,
                color: Colors.COLORS.PINK,
                text: `Health: ${this.resources.health}`,
                align: 'left',
                size: 0.8
            },
        });

        const wheelsText = new GameNode.Text({
            textInfo: {
                x: 28,
                y: 1,
                color: Colors.COLORS.PINK,
                text: `Wheels: ${this.resources.wheels}`,
                align: 'left',
                size: 0.8
            },
        });

        const antibioticsText = new GameNode.Text({
            textInfo: {
                x: 10,
                y: 5,
                color: Colors.COLORS.PINK,
                text: `Antibiotics: ${this.resources.antibiotics}`,
                align: 'left',
                size: 0.8
            },
        });

        const springsText = new GameNode.Text({
            textInfo: {
                x: 19,
                y: 5,
                color: Colors.COLORS.PINK,
                text: `Springs: ${this.resources.springs}`,
                align: 'left',
                size: 0.8
            },
        });

        const treatsText = new GameNode.Text({
            textInfo: {
                x: 28,
                y: 5,
                color: Colors.COLORS.PINK,
                text: `Treats: ${this.resources.treats}`,
                align: 'left',
                size: 0.8
            },
        });

        // this.progressText = new GameNode.Text({
        //     textInfo: {
        //         x: 1,
        //         y: 5,
        //         color: Colors.COLORS.PINK,
        //         text: `${this.distanceTraveled.toFixed(2)} / ${TOTAL_DISTANCE} miles`,
        //         align: 'left',
        //         size: 0.8
        //     },
        // });

        statsBox.addChildren(
            scrapText, this.ammoText, healthText, wheelsText,
            antibioticsText, springsText, treatsText);
        // , this.progressText);

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
            score: 0
        }

        console.log('new player joined ' + playerId);

        this.setCurrentGame(playerId, this.map);

        this.map.map.addChild(node);
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

    getTravelBlockers() {
        return [];
    }

    tick() {

        if (this.getTravelBlockers().length > 0) {
            console.log('paused ticks');
            return;
        }

        if (!this.lastTravelUpdate || this.lastTravelUpdate + this.travelUpdateInterval <= Date.now()) {
            this.distanceTraveled = this.distanceTraveled + this.travelTickDistance;
            this.lastTravelUpdate = Date.now();
            // const newProgress = Object.assign({}, this.progressText.node.text);
            // newProgress.text = `${this.distanceTraveled.toFixed(2)} / ${TOTAL_DISTANCE} miles`;
            // this.progressText.node.text = newProgress;
        }

        this.map.tick({ 
            resources: this.resources,
            playerStates: this.playerStates,
            distanceTraveled: this.distanceTraveled
        });
        
        this.drive.tick({ 
            resources: this.resources,
            playerStates: this.playerStates,
            distanceTraveled: this.distanceTraveled
        });

        this.hunt.tick({ 
            resources: this.resources,
            playerStates: this.playerStates,
            distanceTraveled: this.distanceTraveled
        }); 

        this.fight.tick({ 
            resources: this.resources,
            playerStates: this.playerStates,
            distanceTraveled: this.distanceTraveled
        });

        this.talk.tick({ 
            resources: this.resources,
            playerStates: this.playerStates,
            distanceTraveled: this.distanceTraveled
        }); 
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = VegasTrail;
