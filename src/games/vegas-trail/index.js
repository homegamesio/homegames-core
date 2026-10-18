const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils, Asset } = require('squish-150');
const { MapGame, Drive, Fight, Hunt, Talk } = require('./minigames/index.js');
const TUNING = require('./tuning');
const COLORS = Colors.COLORS;

const TOTAL_DISTANCE = TUNING.TRIP.totalDistanceMiles;


const defaultResources = () => {
    return Object.assign({}, TUNING.START_RESOURCES);
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
            assetKey: 'little-saguaro',
            descriptionLines: [
                'The last bastion of hope in Tucson.',
                'After the Berto-Beto civil war, the taco community was in disarray.',
                `St. Mary's beans brought us all together when we needed each other the most.`
            ]
       },
       {
            coord: [78, 74],
            textCoord: [78.5, 71],
            name: 'Phoenix',
            assetKey: 'big-saguaro',
            descriptionLines: [
                'Some say Phoenix is the worst place in the world.'
            ]
       },
       {
            coord: [54, 46],
            textCoord: [52.5, 52],
            name: 'Gas Station',
            assetKey: 'gas-canister',
            descriptionLines: [
                `The only civilization for miles.`,
                `The long road is lonely and dry.`,
                `For some reason, this one gas station is the only memorable landmark for hours.`
            ]
       },
       {
            coord: [32, 42],
            textCoord: [33, 39.5],
            name: 'Hoover Dam',
            assetKey: 'bug-1-default',
            descriptionLines: [
                'No one really knows what happens here.',
                'Some say the machine uprising started at the Hoover dam, but no one knows for sure.',
                `They built a "bypass route" for "convenience" way back when.`,
                `I always thought it was about more than convenience.`
            ]
       },
       {
            coord: [8, 10],
            textCoord: [14, 11.5],
            name: 'Las Vegas Strip',
            assetKey: 'slot-enemy',
            descriptionLines: [
                `The belly of the beast.`,
                `The titan of terror.`,
                `The colossus of clout!`
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
    const modal = new GameNode.Shape({shapeType:Shapes.POLYGON,
        coordinates2d:ShapeUtils.rectangle(1,11,98,89),fill:Colors.COLORS.HG_BLACK});
    const text = (value,y,size=2) => new GameNode.Text({textInfo:{
        text:value,x:50,y,align:'center',size,font:'amateur',color:Colors.COLORS.WHITE
    }});
    modal.addChild(text('Welcome to the Vegas Trail!',13,2.8));
    const lines = [
        'The flora and fauna have gone mad.',
        'Machines have risen up and started making demands.',
        "Legend has it that there's a cure for the madness",
        'in Vegas.',
        'You will need to drive, hunt for scraps,',
        'and fight illness to survive.',
        "It won't be easy but it might be cool.",
        'Are you ready to start your journey?'
    ];
    lines.forEach((line,i)=>modal.addChild(text(line,24+i*6.5)));
    const start=new GameNode.Shape({shapeType:Shapes.POLYGON,
        coordinates2d:ShapeUtils.rectangle(32,80,36,17),fill:Colors.COLORS.HG_BLUE,onClick:onStart});
    start.addChild(text('Embark',84,2.8));modal.addChild(start);
    modal.addChild(new GameNode.Text({textInfo:{text:'Music: @nytan',x:98,y:96,
        align:'right',size:1.4,font:'amateur',color:Colors.COLORS.WHITE}}));
    modal.addChild(new GameNode.Asset({coordinates2d:ShapeUtils.rectangle(0,0,0,0),assetInfo:{
        introSong:{pos:{x:0,y:0},size:{x:0,y:0},startTime:0}
    }}));
    return modal;
};


const buildWinModal = (onClose) => {
    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(1, 11, 98, 89),
        fill: [106, 147, 71, 255]
    });

    const textOne = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 25,
            align: 'center',
            size: 2.1,
            font: 'amateur',
            text: 'You defeated Las Vegas!',
            color: Colors.COLORS.WHITE
        }
    });

    const startButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(35, 45, 30, 15),
        onClick: onClose,
        fill: Colors.COLORS.HG_BLUE
    });

    const startText = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 49,
            align: 'center',
            size: 2.1,
            font: 'heavy-amateur',
            text: 'Play again',
            color: Colors.COLORS.HG_BLACK
        }
    });

    modal.addChildren(textOne, startButton, startText);

    return modal;
}

const buildFailModal = (reason, onRestart) => {
    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(1, 11, 98, 89),
        fill: Colors.COLORS.BLUE
    });

    const textMap = {
        'sick': 'You have fallen victim to the sickness',
        'food': 'You ran out of food and died.',
        'wheels': 'You rode until the wheels fell off. Then you died.'
    }

    const textOne = new GameNode.Text({
        textInfo: {
            x: 50,
            y: 25,
            align: 'center',
            size: 2.1,
            font: 'amateur',
            text: textMap[reason],
            color: Colors.COLORS.WHITE
        }
    });

    const restart = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(35, 55, 30, 15),
        fill: Colors.COLORS.HG_BLUE,
        onClick: onRestart
    });
    restart.addChild(new GameNode.Text({textInfo: {
        x: 50, y: 60, align: 'center', size: 2, font: 'heavy-amateur',
        text: 'Play again', color: Colors.COLORS.WHITE
    }}));
    modal.addChildren(textOne, restart);

    return modal;
}

class VegasTrail extends Game {
    static metadata() {
        return {
            name: 'Vegas Trail',
            aspectRatio: {x: 16, y: 9},
            author: "Joseph Garcia",
            thumbnail: './assets/thumbnail.png',
            tickRate: 60,
            description: 'Travel from Tucson to Las Vegas and conquer foes along the way',
            assets: {
                'introSong': new Asset({
                    path: './assets/6f31e20f5a1acd20b3d7872e6da6ff7b.mp3',
                    type: 'audio'
                }),
                'fightSong': new Asset({
                    path: './assets/8e07e7e52fccf272363de4c7c0190b8f.mp3',
                    type: 'audio'
                }),
                'huntSong': new Asset({
                    path: './assets/b4233fd87368ad7bc275dedb2c680683.mp3',
                    type: 'audio'
                }),
                'mainSong': new Asset({
                    path: './assets/6df9eba1d3489e201328ebf1e0300491.mp3',
                    type: 'audio'
                }),
                'driveSong': new Asset({
                    path: './assets/3a4125e402945c2762e965fd95dc8ccd.mp3',
                    type: 'audio'
                }),
                'placeholder': new Asset({
                    path: './assets/3b16c6d6ee6d3709bf827b61e61003b1.png',
                    'type': 'image'
                }),
                'map-background': new Asset({
                    path: './assets/4e450b680f10d27ddf6575258d031f16.png',
                    'type': 'image'
                }),
                'car-default': new Asset({
                    path: './assets/0baf045b1c122bada75aacd03318c269.png',
                    'type': 'image'
                }),
                'car-left': new Asset({
                    path: './assets/ced4e66928666c6e25d7a2464cd039c0.png',
                    'type': 'image'
                }),
                'car-right': new Asset({
                    path: './assets/f5540376383f7ae23a42347f908a6120.png',
                    'type': 'image'
                }),
                'big-saguaro': new Asset({
                    path: './assets/93fd2644a9b2540cb25cfee8c5f6ee74.png',
                    'type': 'image'
                }),
                'little-saguaro': new Asset({
                    path: './assets/24fd68e8f511f6fafe45da852ac7e95d.png',
                    'type': 'image'
                }),
                'guy-1': new Asset({
                    path: './assets/a507a7cfeb28960ba7257f5b7571e5db.png',
                    'type': 'image'
                }),
                'guy-2': new Asset({
                    path: './assets/7171191eab30d0bf5a57ef5d67fff8ad.png',
                    'type': 'image'
                }),
                'guy-3': new Asset({
                    path: './assets/daee835aa61ff73c93a363d0e3867dab.png',
                    'type': 'image'
                }),
                'guy-4': new Asset({
                    path: './assets/88867ca5b2910ce55f29ffaadec4363f.png',
                    'type': 'image'
                }),
                'dust-1': new Asset({
                    path: './assets/4dcd1561824ad8a3b974020bd24d81ed.png',
                    'type': 'image'
                }),
                'dust-2': new Asset({
                    path: './assets/c1e2d192f4b2d50f92f99c172cc17a6f.png',
                    'type': 'image'
                }),

                'background-1': new Asset({
                    path: './assets/e5042f6d6837e7bc9412b7e0e8c70aa3.png',
                    'type': 'image'
                }),
                'background-2': new Asset({
                    'type': 'image',
                    path: './assets/7fcfe0852e627765d7d25d50ac207163.png'
                }),
                'background-3': new Asset({
                    'type': 'image',
                    path: './assets/4ab0946f2e7812e410a256092267bfc4.png'
                }),
                'star': new Asset({
                    path: './assets/c1c029155f2af909e55de2486058e32d.png',
                    'type': 'image'
                }),
                'scrap': new Asset({
                    path: './assets/cb2d71ae46849cd18b257f7b968e0c18.png',
                    'type': 'image'
                }),
                'map': new Asset({
                    path: './assets/8de0a87b189d3faf9d88d0d0f5de8cfb.png',
                    'type': 'image'
                }),
                'amateur': new Asset({
                    'type': 'font',
                    path: './assets/026a26ef0dd340681f62565eb5bf08fb.bin'
                }),
                'heavy-amateur': new Asset({
                    'type': 'font',
                    path: './assets/9f11fac62df9c1559f6bd32de1382c20.bin'
                }),
                'gloves': new Asset({
                    'type': 'image',
                    path: './assets/4290252f9a55404862259e48b06f579b.png'
                }),
                'glove-left': new Asset({
                    'type': 'image',
                    path: './assets/4be556742e51360b8b487d98edae3849.png'
                }),
                'glove-right': new Asset({
                    'type': 'image',
                    path: './assets/f8e5aaa273de52b87cc3c2a133b2067c.png'
                }),
                'steering-wheel': new Asset({
                    'type': 'image',
                    path: './assets/34295b338e6fc3244b2b8d09906abf80.png'
                }),
                'crosshairs': new Asset({
                    'type': 'image',
                    path: './assets/076105ecc5a699ff1027fcdabd6c1b86.png'
                }),
                'shop': new Asset({
                    'type': 'image',
                    path: './assets/98776d66c2f07a58d51db719acb12e63.png'
                }),
                'close': new Asset({
                    'type': 'image',
                    path: './assets/270fbe2ef81b5e1c66090d5c4716f307.png'
                }),
                'legs-1-left-1': new Asset({
                    'type': 'image',
                    path: './assets/a2212e9540f5ac523514f1ec3585d428.png'
                }),
                'legs-1-left-2': new Asset({
                    'type': 'image',
                    path: './assets/9f1db961b099e44df6d8bc63efef93f0.png'
                }),
                'legs-1-right-1': new Asset({
                    'type': 'image',
                    path: './assets/f504e5d0aadf199d0fb9f6df077f6844.png'
                }),
                'legs-1-right-2': new Asset({
                    'type': 'image',
                    path: './assets/f5707943a14d3d1696073396cd487ce3.png'
                }),
                'legs-2-left-1': new Asset({
                    'type': 'image',
                    path: './assets/8dbf4b1df72edb31323b7b71c05ef98a.png'
                }),
                'legs-2-left-2': new Asset({
                    'type': 'image',
                    path: './assets/f865be0349099d904b1f0be7212afac0.png'
                }),
                'legs-2-right-1': new Asset({
                    'type': 'image',
                    path: './assets/8dbf4b1df72edb31323b7b71c05ef98a.png'
                }),
                'legs-2-right-2': new Asset({
                    'type': 'image',
                    path: './assets/f865be0349099d904b1f0be7212afac0.png'
                }),
                'legs-3-left-1': new Asset({
                    'type': 'image',
                    path: './assets/1c805ec41df459ae3c793d6e14682247.png'
                }),
                'legs-3-left-2': new Asset({
                    'type': 'image',
                    path: './assets/34778726c6bfbc040268ab01e15d3b6b.png'
                }),
                'legs-3-right-1': new Asset({
                    'type': 'image',
                    path: './assets/ab870956179cb728d3e6c27be8a58f33.png'
                }),
                'legs-3-right-2': new Asset({
                    'type': 'image',
                    path: './assets/b22930bf1f228e3ff495c69a1f9a76ab.png'
                }),
                'chat': new Asset({
                    'type': 'image',
                    path: './assets/f25324ca423d1c1c9d37b058231d1766.png'
                }),
                'wheel': new Asset({
                    'type': 'image',
                    path: './assets/bc5097c2433267ca967cb90d5ae87d60.png'
                }),
                'ammo': new Asset({
                    'type': 'image',
                    path: './assets/b3ff302f3419228fb3783f6a2158f297.png'
                }),
                'antibiotic': new Asset({
                    'type': 'image',
                    path: './assets/e1e22728cae4837907a513ce8ce8e249.png'
                }),
                'cookie': new Asset({
                    'type': 'image',
                    path: './assets/4da57d98625f9b61b6f939e3c2d1129b.png'
                }),
                'bug-1-default': new Asset({
                    'type': 'image',
                    path: './assets/b38a862769e5b691e853f0d77a87c3eb.png'
                }),
                'bug-1-left': new Asset({
                    'type': 'image',
                    path: './assets/5d89c5014c9f7a30d75aff244efdfa08.png'
                }),
                'bug-1-right': new Asset({
                    'type': 'image',
                    path: './assets/6acf1518d2bc3f3671bc7946995708c3.png'
                }),
                'bug-2-default': new Asset({
                    'type': 'image',
                    path: './assets/f02e67d1a1308b04aeee85df0eec8154.png'
                }),
                'bug-2-left': new Asset({
                    'type': 'image',
                    path: './assets/ba16fd27e310a452d782e95dc62ab3ff.png'
                }),
                'bug-2-right': new Asset({
                    'type': 'image',
                    path: './assets/f5d3b11023a3fd3ed32b39cb084b7c39.png'
                }),
                'bug-3-default': new Asset({
                    'type': 'image',
                    path: './assets/feb4d5e63ede48064e31da251c228bdd.png'
                }),
                'bug-3-left': new Asset({
                    'type': 'image',
                    path: './assets/ce852844ffff8199637d6950935c8de4.png'
                }),
                'bug-3-right': new Asset({
                    'type': 'image',
                    path: './assets/f972480121a9762ff73671544d8f7b4c.png'
                }),
                'biscuit-1': new Asset({
                    'type': 'image',
                    path: './assets/a164b9aadc788a8e659e977417ec7ec1.png'
                }),
                'biscuit-2': new Asset({
                    'type': 'image',
                    path: './assets/c958bbe0022fdb367a52c3e5fb384307.png'
                }),
                'rock-1': new Asset({
                    'type': 'image',
                    path: './assets/cb230f24577fdaad5324de5f4ee32c0b.png'
                }),
                'rock-2': new Asset({
                    'type': 'image',
                    path: './assets/bcec761b00b100b9273a63cdf7332efb.png'
                }),
                'baseball-1': new Asset({
                    'type': 'image',
                    path: './assets/ce4ff6a45c5067a6de2428bae13a885d.png'
                }),
                'baseball-2': new Asset({
                    'type': 'image',
                    path: './assets/9c40ee345797d85c5324ac4fdc3ffab2.png'
                }),
                'desmond-1': new Asset({
                    'type': 'image',
                    path: './assets/f6f6df5eb5daa2313485a543679e5b38.png'
                }),
                'desmond-2': new Asset({
                    'type': 'image',
                    path: './assets/f48fd7cd35b64e26e02c076963acb450.png'
                }),
                'desmond-smile': new Asset({
                    'type': 'image',
                    path: './assets/c4ad0eaf0074c9cbf1588f26ad655054.png'
                }),
                'drive-1-0': new Asset({
                    'type': 'image',
                    path: './assets/8d616b824ffa1f1f03a6cfd8259fed74.png'
                }),
                'drive-1-1': new Asset({
                    'type': 'image',
                    path: './assets/a31a9bf93bfff116198a74d8a3f09a46.png'
                }),
                'drive-2-0': new Asset({
                    'type': 'image',
                    path: './assets/9d0030fe577bf1db16c2e4eeb3fb35ba.png'
                }),
                'drive-2-1': new Asset({
                    'type': 'image',
                    path: './assets/b6e9d6d21f541e4cebf3e005a9c7ae35.png'
                }),
                'drive-3-0': new Asset({
                    'type': 'image',
                    path: './assets/04ec60cd67401cf1d2cc6d8fe610b794.png'
                }),
                'drive-3-1': new Asset({
                    'type': 'image',
                    path: './assets/5de41cd5fbc5ed8fbb585368f760c4dc.png'
                }),
                'hunt-1': new Asset({
                    'type': 'image',
                    path: './assets/9a2221e21fbe77a93c926d1c70d6ece0.png'
                }),
                'hunt-2': new Asset({
                    'type': 'image',
                    path: './assets/705e4b2bd1ea5a01cfdd37ecd56253e9.png'
                }),
                'hunt-3': new Asset({
                    'type': 'image',
                    path: './assets/df8c8807751828f55e78df47fc3d6f22.png'
                }),
                'fight-1': new Asset({
                    'type': 'image',
                    path: './assets/c2ced3c16e0fd21d999eefb0bb89593f.png'
                }),
                'fight-2': new Asset({
                    'type': 'image',
                    path: './assets/f95cbc8df61b7373d7bedb4ae5f8b549.png'
                }),
                'fight-3': new Asset({
                    'type': 'image',
                    path: './assets/c0180cb139e5c3599180e5a751611dd1.png'
                }),
                'tumbleweed': new Asset({
                    'type': 'image',
                    path: './assets/8063f98069472686db090fdbc544009e.png'
                }),
                'drone': new Asset({
                    'type': 'image',
                    path: './assets/3e250e3bbe22f1046f8e4c6b0f0a89fe.png'
                }),
                'gas-pump': new Asset({
                    'type': 'image',
                    path: './assets/ad1777daa4e45ab700a8ddc5ddaaa698.png'
                }),
                'gas-canister': new Asset({
                    'type': 'image',
                    path: './assets/24620620ff8fc10f7458ce33199040f2.png'
                }),
                'senor-die': new Asset({
                    'type': 'image',
                    path: './assets/315077ebc9f8e3eba69e68fe9bdf8170.png'
                }),
                'slot-enemy': new Asset({
                    'type': 'image',
                    path: './assets/99ece53d641bbe28d2ddaa22c06ba521.png'
                }),
            },
            gameId: "62bc5b10-1035-5d5e-a986-3e0f4fb98d82",
            maxPlayers: 8
        };
    }

    constructor(initialState ={}) {
        super();
        this.initializeRun(initialState);
    }

    initializeRun(initialState = {}) {
        this.phase = 'ready';
        this.won = false;
        this.failureReason = null;
        this.lastTravelUpdate = null;
        this.foodLastEaten = null;
        this.lastTalkUpdate = null;

        this.sickHealth = TUNING.SURVIVAL.maxSickHealth;
        this.carHealth = TUNING.SURVIVAL.maxCarHealth;

        this.zone = 1;

        this.playerStates = {};

        this.distanceTraveled = 0;

        // set via markDirty() when an input handler mutates node fields directly;
        // tick() flushes it with a single onStateChange
        this.dirty = false;
        
        // main modal will pause game until closed
        this.mainModal = buildInitialModal(() => {
            if (this.phase !== 'ready') return;
            this.phase = 'playing';
            this.lastTravelUpdate = Date.now();
            this.foodLastEaten = Date.now();
            this.clearMainModal();

        const songNode = new GameNode.Asset({
                    coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                    assetInfo: {
                        'mainSong': {
                            'pos': Object.assign({}, { x: 0, y: 0 }),
                            'size': Object.assign({}, { x: 0, y: 0 }),
                            'startTime': 0
                        }
                    }
                });

                this.map.root.addChild(songNode);
        });

        this.travelUpdateInterval = TUNING.TRIP.travelUpdateIntervalMs;

        // if the trip to vegas takes ~ durationMinutes and that trip is TOTAL_DISTANCE, then we have durationMinutes / travel update interval ticks to travel TOTAL_DISTANCE
        this.travelTickDistance = (TOTAL_DISTANCE / (TUNING.TRIP.durationMinutes * 60 * 1000 / this.travelUpdateInterval));

        this.map = new MapGame(this, mapData, TOTAL_DISTANCE);
        this.drive = new Drive({mainGame: this});
        this.hunt = new Hunt({
            mainGame: this,
            depleteAmmo: (count) => {
                this.resources.ammo = this.resources.ammo - count;
                const textInfo = Object.assign({}, this.ammoText.node.text);
                textInfo.text = `${this.resources.ammo}`;
                this.ammoText.node.text = textInfo;
                this.markDirty();
            }
        });
        this.fight = new Fight({mainGame: this});
        this.talk = new Talk({mainGame: this});

        this.resources = { ...defaultResources() }

        this.state = initialState;
        if (this.base) this.base.clearChildren();
        this.base = this.base || new GameNode.Shape({
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

        // Player 0 is not a participant; keep inactive views hidden.
        for (const game of [this.map, this.drive, this.hunt, this.fight, this.talk]) {
            game.getRoot().node.playerIds = [0];
        }

        this.grayThing.addChildren(this.optionsLayer, this.statsLayer);

        this.base.addChild(this.gameLayer);
        this.base.addChild(this.grayThing);

        this.gameLayer.addChildren(this.map.getRoot(), this.drive.getRoot(), this.hunt.getRoot(), this.fight.getRoot(), this.talk.getRoot(), this.mainModalLayer);

        this.renderOptionsLayer();
        this.renderStatsLayer();

        this.renderMainModal();
    }

    renderMainModal() {
        this.mainModalLayer.clearChildren();
        this.mainModalLayer.node.coordinates2d = this.mainModal ? ShapeUtils.rectangle(0, 10, 100, 90) : ShapeUtils.rectangle(0, 0, 0, 0);
        if (this.mainModal) this.mainModalLayer.addChild(this.mainModal);
    }

    clearMainModal() {
        if (this.mainModal) {
            this.mainModalLayer.removeChild(this.mainModal.id);
            this.mainModal = null;
            this.mainModalLayer.node.coordinates2d = ShapeUtils.rectangle(0, 0, 0, 0);
            this.markDirty();
        }
    }

    // input handlers that mutate node fields directly call this so the next
    // tick() flushes the change (tree ops like addChild/removeChild notify on
    // their own and don't need it)
    markDirty() {
        this.dirty = true;
    }

    handleSickHit(dmg = TUNING.SURVIVAL.sickHitDamage) {
        this.sickHealth -= dmg;
        if (this.sickHealth <= 0) {
            if (this.resources.antibiotics > 0) {
                this.sickHealth = TUNING.SURVIVAL.maxSickHealth;
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
                this.carHealth = TUNING.SURVIVAL.maxCarHealth;
                this.resources.wheels -= 1;
                this.renderStatsLayer();
            } else {
                this.handleFailure('wheels');
            }
        }
    }

    handleFailure(reason) {
        if (this.phase !== 'playing') return;
        this.phase = 'lost';
        this.failureReason = reason;
        this.mainModal = buildFailModal(reason, playerId => this.restartRun(playerId));
        this.renderMainModal();
    }

    restartRun(playerId) {
        if (!this.playerStates[playerId] || !['won', 'lost'].includes(this.phase)) return;
        const ids = Object.keys(this.playerStates).map(Number);
        this.initializeRun();
        ids.forEach(id => this.handleNewPlayer({playerId: id}));
        this.markDirty();
    }

    canPlay(playerId, minigame) {
        return this.phase === 'playing' && !this.mainModal &&
            this.playerStates[playerId]?.currentGame === minigame;
    }

    setCurrentGame(playerId, minigame) {
        if (!this.playerStates[playerId]) return;
        if (this.playerStates[playerId].currentGame) {
            const root = this.playerStates[playerId].currentGame.getRoot();
            root.hideFor(playerId);
        }
        this.playerStates[playerId].currentGame = minigame;

        minigame.getRoot().showFor(playerId);
        // showFor/hideFor mutate playerIds without notifying
        this.markDirty();
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
                if (!this.mainModal && this.playerStates[playerId]) {
                    if (!this.lastTalkUpdate || this.lastTalkUpdate + TUNING.TALK.cooldownMs <= Date.now()) {
                        this.lastTalkUpdate = Date.now();
                        this.talk.update();
                    }
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
                y: 5.5,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.scrap}`,
                align: 'center',
                font: 'amateur',
                size: 1.7
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
                y: 5.5,
                font: 'amateur',
                color: Colors.COLORS.WHITE,
                text: `${this.resources.ammo}`,
                align: 'center',
                size: 1.7
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
                y: 5.5,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.wheels}`,
                align: 'center',
                size: 1.7,
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
                y: 5.5,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.antibiotics}`,
                align: 'center',
                font: 'amateur',
                size: 1.7
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
                y: 5.5,
                color: Colors.COLORS.WHITE,
                text: `${this.resources.food}`,
                align: 'center',
                font: 'amateur',
                size: 1.7
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
        if (!Number.isSafeInteger(playerId) || playerId < 1 ||
            this.playerStates[playerId] || Object.keys(this.playerStates).length >= 8) return;
        this.playerStates[playerId] = {};
        this.setCurrentGame(playerId, this.hunt);
        // Joining never clears an introduction or result, or resets the party's route.
    }

    handlePlayerDisconnect(playerId) {
        if (!this.playerStates[playerId]) return;
        for (const game of [this.map, this.drive, this.hunt, this.fight, this.talk]) {
            game.getRoot().hideFor(playerId);
        }
        this.map.removePlayer(playerId);
        this.hunt.removePlayer(playerId);
        delete this.fight.clickCounts[playerId];
        delete this.playerStates[playerId];
        this.markDirty();
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
            if (!this.won) {
                this.won = true;
                this.phase = 'won';
                this.distanceTraveled = TOTAL_DISTANCE;
                this.mainModal = buildWinModal(playerId => this.restartRun(playerId));
                this.renderMainModal();
            }

        }

        if (this.zone !== prevZone) {
            this.drive.handleNewZone(this.zone);
            this.hunt.handleNewZone(this.zone);
            this.fight.handleNewZone(this.zone);
            this.talk.handleNewZone(this.zone);
            // handleNewZone swaps background assets by direct field mutation
            this.markDirty();
        }
        // this.mainModal = buildLandmarkModal(landmarkData, this.clearMainModal.bind(this));
        // this.renderMainModal();
    }

    depleteFood() {
        const val = Object.keys(this.playerStates).length * TUNING.SURVIVAL.foodPerPlayerPerMeal;
        this.resources.food -= val;
        if (this.resources.food < 0) {
            this.resources.food = 0;
            this.handleFailure('food');
        }

        if (this.foodText) {
            const newText = Object.assign({}, this.foodText.node.text);
            newText.text = `${this.resources.food}`;
            this.foodText.node.text = newText;
            this.markDirty();
        }
    }

    tick() {

        if (this.mainModal || !Object.keys(this.playerStates).length) {
            // this.map.handlePause();
            if (this.dirty) {
                this.dirty = false;
                this.base.node.onStateChange();
            }
            return;
        }

        if (!this.lastTravelUpdate || this.lastTravelUpdate + (this.travelUpdateInterval) <= Date.now()) {
            this.distanceTraveled = Math.min(TOTAL_DISTANCE, this.distanceTraveled + this.travelTickDistance);
            this.lastTravelUpdate = Date.now();
        }

        if (!this.foodLastEaten || this.foodLastEaten + TUNING.SURVIVAL.foodDepleteIntervalMs <= Date.now()) {
            this.depleteFood();
            this.foodLastEaten = Date.now();
        }

        if (this.phase !== 'playing') {
            this.dirty = false;
            this.base.node.onStateChange();
            return;
        }

        const tickState = {
            resources: this.resources,
            playerStates: this.playerStates,
            distanceTraveled: this.distanceTraveled
        };

        // each minigame tick returns true if it mutated node fields directly
        let changed = this.map.tick(tickState);
        if (this.phase === 'playing') changed = this.drive.tick(tickState) || changed;
        if (this.phase === 'playing') changed = this.hunt.tick(tickState) || changed;
        if (this.phase === 'playing') changed = this.fight.tick(tickState) || changed;
        changed = this.talk.tick(tickState) || changed;

        if (changed || this.dirty) {
            this.dirty = false;
            this.base.node.onStateChange();
        }
    }

    getLayers() {
        return [{root: this.base}];
    }
}

module.exports = VegasTrail;
