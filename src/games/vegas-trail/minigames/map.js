const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');

const COLORS = {
    BLURPLE: [71, 51, 255, 255],
    PURPLE: [117, 66, 96, 255],
    GRUE: [92, 114, 135, 255],
    TRURPLE: [126, 48, 117, 255],
    DARK: [83, 34, 92, 255]
}

const descriptions = {
    'food': 'Fresh baked cookies',
    'wheels': 'Required for movement',
    'ammo': 'Things to throw',
    'antibiotics': 'Heals infections',
    'rock': 'Like a baseball, but more destructive.',
    'biscuit': `Drier than a desert. Harder than diamonds.`,
    'truck': '',
    'suv': ''
};

const landmarkModal = (playerId, landmarkData, onClose) => {

    const modalBase = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(14, 14, 72, 72),
        fill: Colors.COLORS.HG_BLACK,//[194, 151, 90, 255],//[106, 147, 70, 255]
        playerIds: [playerId],
    });

    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
        fill: [194, 151, 90, 255],//Colors.COLORS.RED,
        playerIds: [playerId]
    });

    const landmarkImage = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            40,
            20,
            20,
            20
        ),
        assetInfo: {
            [landmarkData.assetKey]: {
                pos: {
                    x: 40,
                    y: 20
                },
                size: {
                    x: 20,
                    y: 20
                }
            }
        }
    });

    const closeIcon = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            16,
            16,
            10,
            10
        ),
        assetInfo: {
            'close': {
                pos: {
                    x: 16,
                    y: 16
                },
                size: {
                    x: 5,
                    y: 5
                }
            }
        }
    });

    const closeButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(16, 16, 5, 5),
        onClick: onClose
    });

    closeIcon.addChild(closeButton);

    // const closeButton = new GameNode.Shape({
    //     shapeType: Shapes.POLYGON,
    //     coordinates2d: ShapeUtils.rectangle(20, 20, 10, 10),
    //     fill: Colors.COLORS.CYAN,
    //     onClick: onClose
    // });

    const titleText = new GameNode.Text({
        textInfo: {
            text: landmarkData.name,
            x: 50,
            y: 45,
            align: 'center',
            font: 'heavy-amateur',
            size: 2,
            color: Colors.COLORS.WHITE
        }
    });

    for (let i = 0; i < landmarkData.descriptionLines.length; i++) {
        const descriptionLine = new GameNode.Text({
            textInfo: {
                text: landmarkData.descriptionLines[i],
                x: 50,
                y: 55 + (i * 5),
                align: 'center',
                font: 'heavy-amateur',
                size: 1.2,
                color: Colors.COLORS.WHITE
            }
        });

        modal.addChild(descriptionLine);
    }

    modal.addChildren(landmarkImage, titleText, closeIcon);

    modalBase.addChild(modal);

    return modalBase;
}

const shopInventoryMap = () => {
    return {
        "St. Mary's Mexican Food": {
            "consumables": {
                "food": {
                    "amount": 40,
                    "cost": 1
                },
                "wheels": {
                    "amount": 1,
                    "cost": 50
                },
                "ammo": {
                    "amount": 100,
                    "cost": 2
                },
                "antibiotics": {
                    "amount": 4,
                    "cost": 50
                }
            }, 
            "upgrades": {
                // "weapons": {
                    "rock": {
                        "cost": 50
                    },
                // },
                // "vehicle": {
                    "biscuit": {
                        "cost": 100
                    },
                // },
                // "resilience": {
                // }
            }
        },
        "Phoenix": {

        },
        "Gas Station": {

        },
        "Hoover Dam": {

        },
        "Las Vegas Strip": {

        }
    };
}

const shopModal = (shopInventory, playerIds, onClose, onBuy) => {
    let selectedKey;
    const modalBase = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(14, 14, 72, 72),
        // fill: Colors.COLORS.HG_BLACK,//[194, 151, 90, 255],//[106, 147, 70, 255]
        playerIds
    });

    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
        fill: [194, 151, 90, 255],//Colors.COLORS.HG_BLACK,//[194, 151, 90, 255],//[106, 147, 70, 255]
        playerIds
    });

    const assetWindow = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(52.5, 75, 0, 0),
        fill: Colors.COLORS.BLACK
    });

    const buyButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(57.5, 75, 0, 0),
        fill: [106, 147, 70, 255],//Colors.COLORS.GREEN,
        onClick: (playerId) => selectedKey && onBuy(playerId, selectedKey)
    });

    const buyText = new GameNode.Text({
        textInfo: {
            x: 66,
            y: 77.5,
            font: 'heavy-amateur',
            size: 1.2,
            text: 'Buy',
            align: 'center',
            color: [194, 151, 90, 255]
        }
    });

    buyButton.addChild(buyText);

    const showBuyButton = () => {
        buyButton.node.coordinates2d = ShapeUtils.rectangle(57.5, 75, 15, 8);
        const visibleText = Object.assign({}, buyText.node.text);
        visibleText.color = Colors.COLORS.WHITE;
        buyText.node.text = visibleText;
    }

    const hideBuyButton = () => {
        buyButton.node.coordinates2d = ShapeUtils.rectangle(57.5, 75, 0, 0);
    }

    const desmondTvBase = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(50, 30, 30, 30),
        fill: Colors.COLORS.HG_BLACK,
        playerIds
    });

    const desmondTvScreen = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(52, 32, 26, 26),
        fill: Colors.COLORS.BLACK,
        playerIds
    });

    desmondTvBase.addChild(desmondTvScreen);

    const desmondAsset = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            55,
            38,
            20,
            20
        ),
        assetInfo: {
            'desmond-1': {
                pos: {
                    x: 55,
                    y: 38
                },
                size: {
                    x: 20,
                    y: 20
                }
            }
        }
    });

    desmondTvScreen.addChild(desmondAsset);

    const introMessages = [
        'Welcome!',
        'Hello!',
        'Hi there!'
    ];

    const randIndex = Math.floor(Math.random() * 3);

    const desmondText = new GameNode.Text({
        textInfo: {
            x: 65,
            y: 65,
            text: introMessages[randIndex],
            size: 1.4,
            font: 'amateur',
            align: 'center',
            color: Colors.COLORS.BLACK
        }
    });

    const currentItemAsset = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            60,
            60,
            0,
            0
        ),
        assetInfo: {
            'rock-1': {
                pos: {
                    x: 60,
                    y: 60
                },
                size: {
                    x: 0,
                    y: 0
                }
            }
        }
    });

    const showAsset = (assetKey) => {
        assetWindow.node.coordinates2d = ShapeUtils.rectangle(52.5, 75, 8, 8);
        currentItemAsset.node.asset = {
            [assetKey]: {
                pos: {
                    x: 52.5,
                    y: 75
                }, 
                size: {
                    x: 8,
                    y: 8
                }
            }
        } 
    }

    const hideAsset = (assetKey) => {
        assetWindow.node.coordinates2d = ShapeUtils.rectangle(52.5, 60, 0, 0);

        currentItemAsset.node.asset = {
            [assetKey]: {
                pos: {
                    x: 60,
                    y: 60
                }, 
                size: {
                    x: 0,
                    y: 0
                }
            }
        } 
    }

    assetWindow.addChild(currentItemAsset);
    modal.addChildren(desmondTvBase, desmondText, buyButton, assetWindow);

    const closeIcon = new GameNode.Asset({
        coordinates2d:  ShapeUtils.rectangle(
            16,
            16,
            10,
            10
        ),
        assetInfo: {
            'close': {
                pos: {
                    x: 16,
                    y: 16
                },
                size: {
                    x: 5,
                    y: 5
                }
            }
        }
    });

    const closeButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(16, 16, 5, 5),
        onClick: onClose
    });

    const upgradesText = new GameNode.Text({
        textInfo: {
            text: `Mr. Stick's Shop`,
            x: 50,
            y: 20,
            align: 'center',
            size: 2,
            color: Colors.COLORS.WHITE,
            font: 'heavy-amateur'
        }
    });

    closeIcon.addChild(closeButton);

    modalBase.addChild(modal);
    modal.addChildren(closeIcon, upgradesText);

    const thingsLabel = new GameNode.Text({
        textInfo: {
            x: 23,
            y: 35,
            text: 'Things',
            size: 2,
            font: 'heavy-amateur',
            align: 'center',
            color: Colors.COLORS.HG_BLACK
        }
    });

    const upgradesLabel = new GameNode.Text({
        textInfo: {
            x: 41,
            y: 35,
            text: 'Upgrades',
            size: 2,
            font: 'heavy-amateur',
            align: 'center',
            color: Colors.COLORS.HG_BLACK
        }
    });

    modal.addChildren(thingsLabel, upgradesLabel);

    const itemAssetMap = {
        'antibiotics': 'antibiotic',
        'rock': 'rock-1',
        'wheels': 'wheel',
        'food': 'cookie',
        'ammo': 'ammo',
        'biscuit': 'biscuit-1'
    };

    const setCurrentItem = (key) => {
        const updatedText = Object.assign({}, desmondText.node.text);
        updatedText.text = descriptions[key];
        desmondText.node.text = updatedText;
        selectedKey = key;
        showBuyButton();
        if (itemAssetMap[key]) {
            showAsset(itemAssetMap[key]);
        } else {
            hideAsset();
        }
    }

    let i = 0;
    for (let key in shopInventory.consumables) {
        const consumableEntry = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(16, 43 + (6 * i), 15, 4),
            onClick: (playerId) => {
                setCurrentItem(key);
            }//onBuy(playerId, key)
        });

        const consumableText = new GameNode.Text({
            textInfo: {
                x: 17,
                y: 43 + (6 * i),
                size: 1.1,
                color: Colors.COLORS.WHITE,
                text: key,
                font: 'amateur',
                align: 'left'
            }
        });

        const consumableCostText = new GameNode.Text({
            textInfo: {
                x: 28,
                y: 43 + (6 * i),
                size: 1.1,
                color: Colors.COLORS.BLACK,
                text: `${shopInventory.consumables[key].cost}`,
                font: 'amateur',
                align: 'left'
            }
        });


        consumableEntry.addChildren(consumableText, consumableCostText);

        modal.addChild(consumableEntry);
        i++;
    }

    i = 0;

    for (let key in shopInventory.upgrades) {
        const consumableEntry = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(34, 43 + (6 * i), 15, 4),
            onClick: (playerId) => {
                setCurrentItem(key)
            }
        });

        const consumableText = new GameNode.Text({
            textInfo: {
                x: 34,
                y: 43 + (6 * i),
                size: 1.1,
                color: Colors.COLORS.WHITE,
                text: key,
                font: 'amateur',
                align: 'left'
            }
        });

        const upgradeCostText = new GameNode.Text({
            textInfo: {
                x: 45,
                y: 43 + (6 * i),
                size: 1.1,
                color: Colors.COLORS.BLACK,
                text: `${shopInventory.upgrades[key].cost}`,
                font: 'amateur',
                align: 'left'
            }
        });

        consumableEntry.addChildren(consumableText, upgradeCostText);

        modal.addChild(consumableEntry);
        i++;
    }

    // const titleText = new GameNode.Text({
    //     textInfo: {
    //         text: 'Shop with me and get ya order',
    //         x: 50,
    //         y: 45,
    //         align: 'center',
    //         size: 2,
    //         color: Colors.COLORS.WHITE
    //     }
    // });


    return modalBase;
}

class MapGame {
    constructor(mainGame, mapData, distanceMiles) {
        this.mainGame = mainGame;
        this.distanceMiles = distanceMiles;
        this.root = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: Colors.COLORS.WHITE
        });

        this.modalRoot = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            fill: Colors.COLORS.WHITE,
            // playerIds: 
        });

        this.currentStatusNode = new GameNode.Text({
            textInfo: {
                x: 2,
                y: 94,
                color: Colors.COLORS.BLACK,
                text: `Distance traveled: 0 of ${distanceMiles} miles`,
                align: 'left',
                font: 'amateur',
                size: 1.1
            }
            // playerIds: 
        });

        this.playerModals = {};
        this.playerStates = {};
        this.shopInventory = {
            consumables: {},
            upgrades: {}
        };

        // a game should take ~10 minutes to get to vegas. all coords are for vegas and back

        this.coordCount = mapData.mapCoords.length;

        // i want to go through coordCount / 2 points over 10 minutes

        this.moveInterval = (10 * 60 * 1000) / (this.coordCount / 2);

        // console.log('need to move every ' + moveInterval + ', ,,, ' + coordCount);

        this.map = this.constructMap(mapData);

        const shopBase = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(75, 20, 20, 20),
            // fill: Colors.COLORS.HG_BLACK
        });

        const shopIcon = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                75,
                20,
                20,
                20
            ),
            assetInfo: {
                'shop': {
                    pos: {
                        x: 75,
                        y: 20
                    },
                    size: {
                        x: 20,
                        y: 20
                    }
                }
            }
        });

        const shopButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 20, 15, 15),
            // fill: [255, 51, 25, 255],//Colors.COLORS.BLUE,
            onClick: (playerId) => this.callShop(playerId)
        })
        
        shopIcon.addChild(shopButton);

        shopBase.addChild(shopIcon);

        this.root.addChildren(this.map, shopBase, this.modalRoot, this.currentStatusNode);
    }

    callShop(playerId) {    
        console.log('player wants to shop ' + playerId);
        if (this.movingShop) {
            this.movingShop.playerIds.push(playerId);
        } else {

            const shopNode = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    0,
                    50,
                    3,
                    3
                ),
                assetInfo: {
                    'drone': {
                        pos: {
                            x: 0,
                            y: 50
                        },
                        size: {
                            x: 3,
                            y: 3
                        }
                    }
                }
            });

            const playerState = Object.values(this.playerStates)[0];
            const currentPos = [playerState.path[playerState.currentIndex][0], playerState.path[playerState.currentIndex][1]]

            const shopPath = Physics.getPath(0, 50, (currentPos[0] / 8), (currentPos[1] - 50) / 8, currentPos[0], 100);

            this.root.addChild(shopNode);

            this.movingShop = {
                node: shopNode,
                path: shopPath,
                currentIndex: 0,
                playerIds: [playerId]
            };
        }
    }

    constructMap(mapData) {
        const map = new GameNode.Asset({
            coordinates2d:  ShapeUtils.rectangle(
                0,
                10,
                100,
                90
            ),
            assetInfo: {
                'map-background': {
                    pos: {
                        x: 0,
                        y: 10
                    },
                    size: {
                        x: 100,
                        y: 90
                    }
                }
            }
        });

        const mapPath = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: mapData.mapCoords,
            fill: [194, 151, 90, 255]//[106, 147, 70, 255]
        });

        this.mapData = mapData;

        for (let i = 0; i < mapData.landmarks.length; i++) {
            const landmarkData = mapData.landmarks[i];
            const landmarkNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(landmarkData.coord[0], landmarkData.coord[1], 6, 6),
                onClick: (playerId) => {
                    const modalNode = landmarkModal(playerId, mapData.landmarks[i], (playerId) => { 
                        if (this.playerModals[playerId]) {
                            this.modalRoot.removeChild(this.playerModals[playerId].node.id);
                            this.playerModals[playerId].node.free();
                            delete this.playerModals[playerId];
                        }
                    });
                    
                    if (this.playerModals[playerId]) {
                        this.modalRoot.removeChild(this.playerModals[playerId].node.id);
                        this.playerModals[playerId].node.free();
                    }
                
                    this.playerModals[playerId] = modalNode;
                    this.modalRoot.addChild(modalNode);
                }
            });

            const landmarkStar = new GameNode.Asset({
                coordinates2d:  ShapeUtils.rectangle(
                    landmarkData.coord[0],
                    landmarkData.coord[1],
                    6,
                    6
                ),
                assetInfo: {
                    'star': {
                        pos: {
                            x: landmarkData.coord[0],
                            y: landmarkData.coord[1]
                        },
                        size: {
                            x: 6,
                            y: 6
                        }
                    }
                }
            });


            const landmarkText = new GameNode.Text({
                textInfo: {
                    x: landmarkData.textCoord[0],
                    y: landmarkData.textCoord[1],
                    align: 'left',
                    size: 1,
                    color: Colors.COLORS.HG_BLACK,
                    text: landmarkData.name,
                    font: 'heavy-amateur'
                }
            });
            // landmarkNode.addChild(landmarkText);
            landmarkStar.addChildren(landmarkNode, landmarkText);

            mapPath.addChild(landmarkStar);
        }

        map.addChild(mapPath);

        return map;
    }

    tick({ playerStates, resources }) {

        // if (!this.hackTime) {
        //     this.hackTime = Date.now() + 5000;
        // }

        // if (this.hackTime < Date.now()) {

        //     const playerShopModal = shopModal([1], () => {
        //         this.modalRoot.removeChild(playerShopModal.node.id);
        //         playerShopModal.node.free();
        //     })
        //     this.modalRoot.addChild(playerShopModal);
        //     this.hackTime = Date.now() + 500000;
        // }
        this.playerStates = playerStates;
        const now = Date.now();
        for (let key in playerStates) {
            const playerState = playerStates[key];
            if (!playerState.lastMovementTime || playerState.lastMovementTime + (this.moveInterval) <= now) {
                if (playerState.currentIndex >= playerState.path.length) {
                    playerState.currentIndex = 0;
                    // continue;
                }

                const currentCoords = playerState.path[playerState.currentIndex];
                const currentLandmarks = this.mapData.landmarks.filter(l => l.coord[0] == currentCoords[0] && l.coord[1] == currentCoords[1]);
                if (currentLandmarks.length > 0) {
                    this.mostRecentLandmark = currentLandmarks[0];

                    this.mainGame.handleNewLandmark(this.mostRecentLandmark);
                    const landmarkInventory = shopInventoryMap()[this.mostRecentLandmark.name];
                    for (const key in landmarkInventory.consumables) {
                        if (!this.shopInventory.consumables[key]) {
                            this.shopInventory.consumables[key] = {
                                amount: 0
                            };
                        }
                        this.shopInventory.consumables[key].amount += landmarkInventory.consumables[key].amount;
                        this.shopInventory.consumables[key].cost = landmarkInventory.consumables[key].cost;
                    }

                    for (let key in landmarkInventory.upgrades) {
                        // console.log("these are consumables and i should set the inventory to this");
                        // console.log(key);
                        this.shopInventory.upgrades[key] = Object.assign({}, landmarkInventory.upgrades[key]);
                    }
                }

                const newCoords = ShapeUtils.rectangle(playerState.path[playerState.currentIndex][0], playerState.path[playerState.currentIndex][1], 2, 2);
                // feels filthy but hey you know
                playerStates[key].node.node.coordinates2d = newCoords;
                playerStates[key].lastMovementTime = now;
                playerStates[key].currentIndex = playerStates[key].currentIndex + 1;
            }
        }

        if (this.movingShop) {
            if (!this.movingShop.lastShopMovement || this.movingShop.lastShopMovement + 200 <= now) {
                if (this.movingShop.currentIndex >= this.movingShop.path.length) {
                    const node = this.movingShop.node;
                    this.root.removeChild(node.id);
                    const playerIds = this.movingShop.playerIds;
                    this.movingShop = null;
                    node.node.free();

                    const playerShopModal = shopModal(this.shopInventory, playerIds, () => {
                        this.modalRoot.removeChild(playerShopModal.node.id);
                        playerShopModal.node.free();
                    }, 
                    (playerId, key) => {
                        const cost = this.shopInventory.consumables[key] ? this.shopInventory.consumables[key].cost : this.shopInventory.upgrades[key].cost;
                        // if (this.mainGame.resources.scrap - )
                        if (this.mainGame.resources.scrap - cost >= 0) {
                            this.mainGame.resources.scrap -= cost;
                            if (this.mainGame.resources[key] !== null && this.mainGame.resources[key] !== undefined) {
                                this.mainGame.resources[key] = this.mainGame.resources[key] + 1;
                            } else {
                                if (key === 'rock' || key === 'biscuit') {
                                    this.mainGame.resources.weapon = key;
                                    // horrific hack
                                    this.mainGame.hunt.lastResources.weapon = key;
                                    this.mainGame.hunt.renderWeaponNode();
                                } 
                            }
                            this.mainGame.renderStatsLayer();
                        }
                    })

                    this.modalRoot.addChild(playerShopModal);
                } else {

                    const newCoords = ShapeUtils.rectangle(this.movingShop.path[this.movingShop.currentIndex][0], this.movingShop.path[this.movingShop.currentIndex][1], 2, 2);
                    // feels filthy but hey you know
                    this.movingShop.node.node.coordinates2d = newCoords;
                    const newAssetInfo = {
                        'drone': {
                            pos: {
                                x: this.movingShop.path[this.movingShop.currentIndex][0],
                                y: this.movingShop.path[this.movingShop.currentIndex][1]
                            },
                            size: {
                                x: 3,
                                y: 3
                            }
                        }
                    };
                    this.movingShop.node.node.asset = newAssetInfo;
                    this.movingShop.lastShopMovement = now;
                    this.movingShop.currentIndex = this.movingShop.currentIndex + 1;
                }
            }
        }

        if (!this.lastDistanceUpdate || this.lastDistanceUpdate + 500 <= now) {
            const newText = Object.assign({}, this.currentStatusNode.node.text);
            newText.text = `Distance traveled: ${this.mainGame.distanceTraveled.toFixed(2)} of ${this.distanceMiles} miles`;
            this.currentStatusNode.node.text = newText;
        }
 
    }

    // handlePause() {
    //     console.log('just paused!');
    //     this.paused = true;

    //     // const newText = Object.assign({}, this.currentStatusNode.node.text);
    //     // newText.text = `Distance traveled: ${this.mainGame.distanceTraveled.toFixed(2)} of ${this.distanceMiles} miles (paused)`;
    // }

    getRoot() {
        return this.root;
    }
}

module.exports = MapGame;
