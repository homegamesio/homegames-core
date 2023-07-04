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
        antibiotics: 2, // increase health
        food: 100, // jump river
        weapon: 'baseball',
        vehicle: 'gas-car'
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
            textCoord: [75, 95],
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
            textCoord: [78.5, 71],
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
            textCoord: [52.5, 52],
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
            textCoord: [33, 39.5],
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
            textCoord: [14, 11.5],
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

const optionColor = [255, 245, 158, 255];

const mapOptionNode = (onClick) => {
    const mapIcon = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            42,
            0,
            8,
            10
        ),
        assetInfo: {
            'map': {
                pos: {
                    x: 42,
                    y: 0
                },
                size: {
                    x: 8,
                    y: 10
                }
            }
        }
    });

    const transparentNode = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(42, 0, 8, 10),
        // fill: optionColor,//COLORS.RED,
        onClick
    });

    mapIcon.addChildren(transparentNode);

    return mapIcon;
};

const driveOptionNode = (onClick) => {
    const driveIcon = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            54,
            0,
            8,
            10
        ),
        assetInfo: {
            'steering-wheel': {
                pos: {
                    x: 54,
                    y: 0
                },
                size: {
                    x: 8,
                    y: 10
                }
            }
        }
    });

    const transparentNode = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(54, 0, 8, 10),
        onClick
    });

    driveIcon.addChildren(transparentNode);

    return driveIcon;
};

const huntOptionNode = (onClick) => {
    const huntIcon = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            66,
            0,
            8,
            10
        ),
        assetInfo: {
            'crosshairs': {
                pos: {
                    x: 66,
                    y: 0
                },
                size: {
                    x: 8,
                    y: 10
                }
            }
        }
    });

    const transparentNode = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(66, 0, 8, 10),
        onClick
    });

    huntIcon.addChildren(transparentNode);

    return huntIcon;
};

const fightOptionNode = (onClick) => {
    const fightIcon = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            78,
            0,
            8,
            10
        ),
        assetInfo: {
            'gloves': {
                pos: {
                    x: 78,
                    y: 0
                },
                size: {
                    x: 8,
                    y: 10
                }
            }
        }
    });

    const transparentNode = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(78, 0, 8, 10),
        onClick
    });

    fightIcon.addChildren(transparentNode);

    return fightIcon;
};

const talkOptionNode = (onClick) => {
    const chatIcon = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            90,
            0,
            8,
            10
        ),
        assetInfo: {
            'chat': {
                pos: {
                    x: 90,
                    y: 0
                },
                size: {
                    x: 8,
                    y: 10
                }
            }
        }
    });

    const transparentNode = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(90, 0, 8, 10),
        onClick
    });

    chatIcon.addChildren(transparentNode);

    return chatIcon;
};

// welcome modal
const buildInitialModal = (onStart) => {
    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(12.5, 12.5, 75, 75),
        fill: Colors.COLORS.HG_BLACK
    });

    const textOne = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 25,
            align: 'center',
            size: 1.2,
            font: 'amateur',
            text: 'Hello! I will put intro text here eventually',
            color: Colors.COLORS.WHITE
        }
    });

    const startButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(45, 45, 10, 10),
        onClick: onStart,
        fill: Colors.COLORS.HG_BLUE
    });

    const startText = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 49,
            align: 'center',
            size: 1.2,
            font: 'heavy-amateur',
            text: 'Embark',
            color: Colors.COLORS.HG_BLACK
        }
    });

    modal.addChildren(textOne, startButton, startText);

    return modal;
}


const buildWinModal = (onClose) => {
    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(12.5, 12.5, 75, 75),
        fill: [106, 147, 71, 255]
    });

    const textOne = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 25,
            align: 'center',
            size: 1.2,
            font: 'amateur',
            text: 'You won!',
            color: Colors.COLORS.WHITE
        }
    });

    const startButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(45, 45, 10, 10),
        onClick: onClose,
        fill: Colors.COLORS.HG_BLUE
    });

    const startText = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 49,
            align: 'center',
            size: 1.2,
            font: 'heavy-amateur',
            text: 'Thanks',
            color: Colors.COLORS.HG_BLACK
        }
    });

    modal.addChildren(textOne, startButton, startText);

    return modal;
}

const buildFailModal = (reason) => {
    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(12.5, 12.5, 75, 75),
        fill: Colors.COLORS.BLUE
    });

    const textOne = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 25,
            align: 'center',
            size: 1.2,
            font: 'amateur',
            text: 'You died! ' + reason,
            color: Colors.COLORS.WHITE
        }
    });

    modal.addChildren(textOne);

    return modal;
}

class VegasTrail extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 16, y: 9},
            squishVersion: '0767',
            author: 'Joseph Garcia',
            thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96',
            tickRate: 24,
            assets: {
                'mainSong': new Asset({
                    'id': 'a0afee5abd5ac487a3bb8ad2f242c131',
                    type: 'audio'
                }),
                'driveSong': new Asset({
                    'id': '3a4125e402945c2762e965fd95dc8ccd',
                    type: 'audio'
                }),
                'placeholder': new Asset({
                    'id': '3b16c6d6ee6d3709bf827b61e61003b1',
                    'type': 'image'
                }),
                'map-background': new Asset({
                    'id': '3e1a48e2ad3ed304eff1d91ca46f8202',
                    'type': 'image'
                }),
                'car-default': new Asset({
                    'id': '0baf045b1c122bada75aacd03318c269',
                    'type': 'image'
                }),
                'car-left': new Asset({
                    'id': 'ced4e66928666c6e25d7a2464cd039c0',
                    'type': 'image'
                }),
                'car-right': new Asset({
                    'id': 'f5540376383f7ae23a42347f908a6120',
                    'type': 'image'
                }),
                'big-saguaro': new Asset({
                    'id': '93fd2644a9b2540cb25cfee8c5f6ee74',
                    'type': 'image'
                }),
                'little-saguaro': new Asset({
                    'id': '24fd68e8f511f6fafe45da852ac7e95d',
                    'type': 'image'
                }),
                'guy-1': new Asset({
                    'id': 'a507a7cfeb28960ba7257f5b7571e5db',
                    'type': 'image'
                }),
                'guy-2': new Asset({
                    'id': '7171191eab30d0bf5a57ef5d67fff8ad',
                    'type': 'image'
                }),
                'guy-3': new Asset({
                    'id': 'daee835aa61ff73c93a363d0e3867dab',
                    'type': 'image'
                }),
                'guy-4': new Asset({
                    'id': '88867ca5b2910ce55f29ffaadec4363f',
                    'type': 'image'
                }),
                'dust-1': new Asset({
                    'id': '4dcd1561824ad8a3b974020bd24d81ed',
                    'type': 'image'
                }),
                'dust-2': new Asset({
                    'id': 'c1e2d192f4b2d50f92f99c172cc17a6f',
                    'type': 'image'
                }),
                'tumbleweed': new Asset({
                    'id': '119aef7e7e1c3e3caf44caf2c306c299',
                    'type': 'image'
                }),
                'background-1': new Asset({
                    'id': 'e5042f6d6837e7bc9412b7e0e8c70aa3',
                    'type': 'image'
                }),
                'background-2': new Asset({
                    'type': 'image',
                    'id': '7fcfe0852e627765d7d25d50ac207163'
                }),
                'background-3': new Asset({
                    'type': 'image',
                    'id': '4ab0946f2e7812e410a256092267bfc4'
                }),
                'star': new Asset({
                    'id': 'c1c029155f2af909e55de2486058e32d',
                    'type': 'image'
                }),
                'scrap': new Asset({
                    'id': 'cb2d71ae46849cd18b257f7b968e0c18',
                    'type': 'image'
                }),
                'map': new Asset({
                    'id': '8de0a87b189d3faf9d88d0d0f5de8cfb',
                    'type': 'image'
                }),
                'amateur': new Asset({
                    'type': 'font',
                    'id': '026a26ef0dd340681f62565eb5bf08fb'
                }),
                'heavy-amateur': new Asset({
                    'type': 'font',
                    'id': '9f11fac62df9c1559f6bd32de1382c20'
                }),
                'gloves': new Asset({
                    'type': 'image',
                    'id': '4290252f9a55404862259e48b06f579b'
                }),
                'glove-left': new Asset({
                    'type': 'image',
                    'id': '4be556742e51360b8b487d98edae3849'
                }),
                'glove-right': new Asset({
                    'type': 'image',
                    'id': 'f8e5aaa273de52b87cc3c2a133b2067c'
                }),
                'steering-wheel': new Asset({
                    'type': 'image',
                    'id': '34295b338e6fc3244b2b8d09906abf80'
                }),
                'crosshairs': new Asset({
                    'type': 'image',
                    'id': '076105ecc5a699ff1027fcdabd6c1b86'
                }),
                'shop': new Asset({
                    'type': 'image',
                    'id': '98776d66c2f07a58d51db719acb12e63'
                }),
                'close': new Asset({
                    'type': 'image',
                    'id': '270fbe2ef81b5e1c66090d5c4716f307'
                }),
                'legs-1-left-1': new Asset({
                    'type': 'image',
                    'id': 'a2212e9540f5ac523514f1ec3585d428'
                }),
                'legs-1-left-2': new Asset({
                    'type': 'image',
                    'id': '9f1db961b099e44df6d8bc63efef93f0'
                }),
                'legs-1-right-1': new Asset({
                    'type': 'image',
                    'id': 'f504e5d0aadf199d0fb9f6df077f6844'
                }),
                'legs-1-right-2': new Asset({
                    'type': 'image',
                    'id': 'f5707943a14d3d1696073396cd487ce3'
                }),
                'legs-2-left-1': new Asset({
                    'type': 'image',
                    'id': '8dbf4b1df72edb31323b7b71c05ef98a'
                }),
                'legs-2-left-2': new Asset({
                    'type': 'image',
                    'id': 'f865be0349099d904b1f0be7212afac0'
                }),
                'legs-2-right-1': new Asset({
                    'type': 'image',
                    'id': '8dbf4b1df72edb31323b7b71c05ef98a'
                }),
                'legs-2-right-2': new Asset({
                    'type': 'image',
                    'id': 'f865be0349099d904b1f0be7212afac0'
                }),
                'legs-3-left-1': new Asset({
                    'type': 'image',
                    'id': '1c805ec41df459ae3c793d6e14682247'
                }),
                'legs-3-left-2': new Asset({
                    'type': 'image',
                    'id': '34778726c6bfbc040268ab01e15d3b6b'
                }),
                'legs-3-right-1': new Asset({
                    'type': 'image',
                    'id': 'ab870956179cb728d3e6c27be8a58f33'
                }),
                'legs-3-right-2': new Asset({
                    'type': 'image',
                    'id': 'b22930bf1f228e3ff495c69a1f9a76ab'
                }),
                'chat': new Asset({
                    'type': 'image',
                    'id': 'f25324ca423d1c1c9d37b058231d1766'
                }),
                'wheel': new Asset({
                    'type': 'image',
                    'id': 'bc5097c2433267ca967cb90d5ae87d60'
                }),
                'ammo': new Asset({
                    'type': 'image',
                    'id': 'b3ff302f3419228fb3783f6a2158f297'
                }),
                'antibiotic': new Asset({
                    'type': 'image',
                    'id': 'e1e22728cae4837907a513ce8ce8e249'
                }),
                'cookie': new Asset({
                    'type': 'image',
                    'id': '4da57d98625f9b61b6f939e3c2d1129b'
                }),
                'bug-1-default': new Asset({
                    'type': 'image',
                    'id': 'b38a862769e5b691e853f0d77a87c3eb'
                }),
                'bug-1-left': new Asset({
                    'type': 'image',
                    'id': '5d89c5014c9f7a30d75aff244efdfa08'
                }),
                'bug-1-right': new Asset({
                    'type': 'image',
                    'id': '6acf1518d2bc3f3671bc7946995708c3'
                }),
                'bug-2-default': new Asset({
                    'type': 'image',
                    'id': 'e2dcc4c488df274a847c2a74662f44bd'
                }),
                'bug-2-left': new Asset({
                    'type': 'image',
                    'id': 'ba16fd27e310a452d782e95dc62ab3ff'
                }),
                'bug-2-right': new Asset({
                    'type': 'image',
                    'id': 'f5d3b11023a3fd3ed32b39cb084b7c39'
                }),
                'bug-3-default': new Asset({
                    'type': 'image',
                    'id': 'feb4d5e63ede48064e31da251c228bdd'
                }),
                'bug-3-left': new Asset({
                    'type': 'image',
                    'id': 'ce852844ffff8199637d6950935c8de4'
                }),
                'bug-3-right': new Asset({
                    'type': 'image',
                    'id': 'f972480121a9762ff73671544d8f7b4c'
                }),
                'biscuit-1': new Asset({
                    'type': 'image',
                    'id': 'a164b9aadc788a8e659e977417ec7ec1'
                }),
                'biscuit-2': new Asset({
                    'type': 'image',
                    'id': 'c958bbe0022fdb367a52c3e5fb384307'
                }),
                'rock-1': new Asset({
                    'type': 'image',
                    'id': 'cb230f24577fdaad5324de5f4ee32c0b'
                }),
                'rock-2': new Asset({
                    'type': 'image',
                    'id': 'bcec761b00b100b9273a63cdf7332efb'
                }),
                'baseball-1': new Asset({
                    'type': 'image',
                    'id': 'ce4ff6a45c5067a6de2428bae13a885d'
                }),
                'baseball-2': new Asset({
                    'type': 'image',
                    'id': '9c40ee345797d85c5324ac4fdc3ffab2'
                }),
                'desmond-1': new Asset({
                    'type': 'image',
                    'id': 'f6f6df5eb5daa2313485a543679e5b38'
                }),
                'desmond-2': new Asset({
                    'type': 'image',
                    'id': 'f48fd7cd35b64e26e02c076963acb450'
                }),
                'desmond-smile': new Asset({
                    'type': 'image',
                    'id': 'c4ad0eaf0074c9cbf1588f26ad655054'
                }),
                'drive-1-0': new Asset({
                    'type': 'image',
                    'id': '8d616b824ffa1f1f03a6cfd8259fed74'
                }),
                'drive-1-1': new Asset({
                    'type': 'image',
                    'id': 'a31a9bf93bfff116198a74d8a3f09a46'
                }),
                'drive-2-0': new Asset({
                    'type': 'image',
                    'id': '9d0030fe577bf1db16c2e4eeb3fb35ba'
                }),
                'drive-2-1': new Asset({
                    'type': 'image',
                    'id': 'b6e9d6d21f541e4cebf3e005a9c7ae35'
                }),
                'drive-3-0': new Asset({
                    'type': 'image',
                    'id': '04ec60cd67401cf1d2cc6d8fe610b794'
                }),
                'drive-3-1': new Asset({
                    'type': 'image',
                    'id': '5de41cd5fbc5ed8fbb585368f760c4dc'
                }),
                'hunt-1': new Asset({
                    'type': 'image',
                    'id': '9a2221e21fbe77a93c926d1c70d6ece0'
                }),
                'hunt-2': new Asset({
                    'type': 'image',
                    'id': '705e4b2bd1ea5a01cfdd37ecd56253e9'
                }),
                'hunt-3': new Asset({
                    'type': 'image',
                    'id': 'df8c8807751828f55e78df47fc3d6f22'
                }),
                'fight-1': new Asset({
                    'type': 'image',
                    'id': 'c2ced3c16e0fd21d999eefb0bb89593f'
                }),
                'fight-2': new Asset({
                    'type': 'image',
                    'id': 'f95cbc8df61b7373d7bedb4ae5f8b549'
                }),
                'fight-3': new Asset({
                    'type': 'image',
                    'id': 'c0180cb139e5c3599180e5a751611dd1'
                }),
                'tumbleweed': new Asset({
                    'type': 'image',
                    'id': '8063f98069472686db090fdbc544009e'
                }),
                'drone': new Asset({
                    'type': 'image',
                    'id': '3e250e3bbe22f1046f8e4c6b0f0a89fe'
                }),
                'gas-pump': new Asset({
                    'type': 'image',
                    'id': 'ad1777daa4e45ab700a8ddc5ddaaa698'
                }),
                'gas-canister': new Asset({
                    'type': 'image',
                    'id': '24620620ff8fc10f7458ce33199040f2'
                }),
                'senor-die': new Asset({
                    'type': 'image',
                    'id': '315077ebc9f8e3eba69e68fe9bdf8170'
                }),
                'slot-enemy': new Asset({
                    'type': 'image',
                    'id': '99ece53d641bbe28d2ddaa22c06ba521'
                }),
            }
        };
    }

    constructor(initialState ={}) {
        super();
        
        this.sickHealth = 100;
        this.carHealth = 100;

        this.zone = 1;

        this.playerStates = {};

        this.distanceTraveled = 0;
        
        // main modal will pause game until closed
        this.mainModal = buildInitialModal(this.clearMainModal.bind(this));

        this.travelUpdateInterval = 1000; // update distance traveled every one second

        // if the trip to vegas takes ~ 10 minutes and that trip is TOTAL_DISTANCE, then we have 10 minutes / travel update interval ticks to travel TOTAL_DISTANCE
        this.travelTickDistance = (TOTAL_DISTANCE / (10 * 60 * 1000 / this.travelUpdateInterval));

        this.map = new MapGame(this, mapData, TOTAL_DISTANCE);
        this.drive = new Drive({mainGame: this});
        this.hunt = new Hunt({
            mainGame: this,
            depleteAmmo: (count) => {
                this.resources.ammo = this.resources.ammo - count;
                const textInfo = Object.assign({}, this.ammoText.node.text);
                textInfo.text = `${this.resources.ammo}`;
                this.ammoText.node.text = textInfo;
            }
        });
        this.fight = new Fight({mainGame: this});
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

        this.mainModalLayer = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0)
        });

        this.grayThing = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 10),
            fill: [194, 151, 90, 255]//[106, 147, 70, 255]

            // fill: [179, 232, 194, 255]//Colors.COLORS.HG_BLACK//[192, 180, 144, 255],//Colors.COLORS.GRAY
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

        this.gameLayer.addChildren(this.map.getRoot(), this.drive.getRoot(), this.hunt.getRoot(), this.fight.getRoot(), this.talk.getRoot(), this.mainModalLayer);

        this.renderOptionsLayer();
        this.renderStatsLayer();

        this.renderMainModal();
    }

    renderMainModal() {
        this.mainModal && this.mainModalLayer.addChild(this.mainModal);
    }

    clearMainModal() {
        if (this.mainModal) {
            this.mainModalLayer.removeChild(this.mainModal.id);
            this.mainModal.node.free();
            this.mainModal = null;
        }
    }

    handleSickHit(dmg = 1) {
        this.sickHealth -= dmg;
        if (this.sickHealth <= 0) {
            if (this.resources.antibiotics > 0) {
                this.sickHealth = 100;
                this.resources.antibiotics -= 1;
                this.renderStatsLayer();
            } else {
                this.handleFailure('sick');
            }
        }
    }

    handleCarHit(dmg = 1) {
        this.carHealth -= dmg;
        if (this.carHealth <= 0) {
            if (this.resources.wheels > 0) {
                this.carHealth = 100;
                this.resources.wheels -= 1;
                this.renderStatsLayer();
            } else {
                this.handleFailure('wheels');
            }
        }
    }

    handleFailure(reason) {
        this.mainModal = buildFailModal(reason);
        this.renderMainModal();
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
            mapOptionNode((playerId) => !this.mainModal && this.setCurrentGame(playerId, this.map)),
            driveOptionNode((playerId) => !this.mainModal && this.setCurrentGame(playerId, this.drive)),
            huntOptionNode((playerId) => !this.mainModal && this.setCurrentGame(playerId, this.hunt)),
            fightOptionNode((playerId) => !this.mainModal && this.setCurrentGame(playerId, this.fight)),
            talkOptionNode((playerId) => {
                if (!this.mainModal) {
                    this.talk.update();
                    this.setCurrentGame(playerId, this.talk);
                }
            })
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
            // fill: Colors.COLORS.BLUE
        });

        const scrapIcon = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                2,
                1,
                3,
                4
            ),
            assetInfo: {
                'scrap': {
                    pos: {
                        x: 2,
                        y: 1
                    },
                    size: {
                        x: 3,
                        y: 4
                    }
                }
            }
        });

        this.scrapText = new GameNode.Text({
            textInfo: {
                x: 3.5,
                y: 7,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.scrap}`,
                align: 'center',
                font: 'amateur',
                size: 1
            },
        });

        const ammoIcon = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                8,
                1,
                3,
                4
            ),
            assetInfo: {
                'ammo': {
                    pos: {
                        x: 8,
                        y: 1
                    },
                    size: {
                        x: 3,
                        y: 4
                    }
                }
            }
        });

        this.ammoText = new GameNode.Text({
            textInfo: {
                x: 9.5,
                y: 7,
                font: 'amateur',
                color: Colors.COLORS.WHITE,
                text: `${this.resources.ammo}`,
                align: 'center',
                size: 1
            },
        });

        const wheelIcon = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                14,
                1,
                3,
                4
            ),
            assetInfo: {
                'wheel': {
                    pos: {
                        x: 14,
                        y: 1
                    },
                    size: {
                        x: 3,
                        y: 4
                    }
                }
            }
        });

        this.wheelsText = new GameNode.Text({
            textInfo: {
                x: 15.5,
                y: 7,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.wheels}`,
                align: 'center',
                size: 1,
                font: 'amateur'
            },
        });

        const antibioticsIcon = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                20,
                1,
                3,
                4
            ),
            assetInfo: {
                'antibiotic': {
                    pos: {
                        x: 20,
                        y: 1
                    },
                    size: {
                        x: 3,
                        y: 4
                    }
                }
            }
        });

        this.antibioticsText = new GameNode.Text({
            textInfo: {
                x: 21.5,
                y: 7,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.antibiotics}`,
                align: 'center',
                font: 'amateur',
                size: 1
            },
        });

        const foodIcon = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                26,
                1,
                3,
                4
            ),
            assetInfo: {
                'cookie': {
                    pos: {
                        x: 26,
                        y: 1
                    },
                    size: {
                        x: 3,
                        y: 4
                    }
                }
            }
        });

        this.foodText = new GameNode.Text({
            textInfo: {
                x: 27.5,
                y: 7,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.food}`,
                align: 'center',
                font: 'amateur',
                size: 1
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
            scrapIcon, this.scrapText, 
            ammoIcon, this.ammoText, 
            wheelIcon, this.wheelsText,
            antibioticsIcon, this.antibioticsText,
            foodIcon, this.foodText);

        this.statsLayer.addChild(statsBox);
    }

    handleNewPlayer({ playerId }) {
        const node = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            fill: Colors.COLORS.RED,
            coordinates2d: ShapeUtils.rectangle(mapData.mapCoords[0][0], mapData.mapCoords[0][1], 2, 2)
        });

        this.playerStates[playerId] = {
            path: Object.assign(new Array(), mapData.mapCoords),
            currentIndex: 0,
            movementInterval: 100,
            node,
            score: 0
        }

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

    handleNewLandmark(landmarkData) {
        const prevZone = this.zone;
        if (landmarkData.name === 'Phoenix') {
            this.zone = 2;
        } else if (landmarkData.name === 'Hoover Dam') {
            this.zone = 3;
        } else if (landmarkData.name === 'Las Vegas Strip') {
            this.zone = 1;
            if (!this.won) {
                this.won = true;
                this.mainModal = buildWinModal(this.clearMainModal.bind(this));
                this.renderMainModal();
            }

        }

        if (this.zone !== prevZone) {
            this.drive.handleNewZone(this.zone);
            this.hunt.handleNewZone(this.zone);
            this.fight.handleNewZone(this.zone);
            this.talk.handleNewZone(this.zone);
        }
        // this.mainModal = buildLandmarkModal(landmarkData, this.clearMainModal.bind(this));
        // this.renderMainModal();
    }

    tick() {

        if (this.mainModal) {//} && !this.map.paused) {
            // this.map.handlePause();
            return;
        }

        if (!this.lastTravelUpdate || this.lastTravelUpdate + (0 * this.travelUpdateInterval) <= Date.now()) {
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
