const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-150');
const TUNING = require('../tuning');

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

// Stock/prices live in tuning.js (TUNING.SHOP.inventoryByLandmark).
// Deep-copied so accumulation into this.shopInventory can never mutate the config.
const shopInventoryMap = () => {
    return JSON.parse(JSON.stringify(TUNING.SHOP.inventoryByLandmark));
}

const shopModal = (shopInventory, playerIds, onClose, onBuy, markDirty) => {
    const root = new GameNode.Shape({shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(1, 11, 98, 89), fill: [194,151,90,255], playerIds});
    const items = [...Object.entries(shopInventory.consumables), ...Object.entries(shopInventory.upgrades)];
    let page = 0, selected;
    const text = (value,x,y,size=2.3,align='left',color=Colors.COLORS.HG_BLACK) => new GameNode.Text({textInfo:{
        text:value,x,y,size,align,color,font:'amateur'
    }});
    const button = (x,y,w,h,callback) => new GameNode.Shape({shapeType:Shapes.POLYGON,
        coordinates2d:ShapeUtils.rectangle(x,y,w,h),fill:[166,124,67,255],onClick:callback});
    const render = (feedback) => {
        root.clearChildren();
        root.addChild(text("Mr. Stick's Shop",50,15,3,'center'));
        const close = button(2,12,14,16,onClose);
        close.addChild(text('X',9,15,3,'center'));root.addChild(close);
        root.addChild(new GameNode.Asset({coordinates2d:ShapeUtils.rectangle(65,26,24,27),assetInfo:{
            'desmond-1':{pos:{x:65,y:26},size:{x:24,y:27}}
        }}));
        for (const [i,[key,item]] of items.slice(page*3,page*3+3).entries()) {
            const row = button(3,32+i*18,49,16,() => {selected=key;render();});
            if(selected===key) row.node.fill=[106,147,70,255];
            row.addChildren(text(key,5,33+i*18,2.6),text(`${item.amount ? item.amount+' for ' : ''}${item.cost} scrap`,5,41+i*18,2));
            root.addChild(row);
        }
        if (selected) {
            const words=descriptions[selected].split(' '),lines=[''];
            for(const word of words){let i=lines.length-1;if((lines[i]+' '+word).trim().length>22)lines.push(word);else lines[i]=(lines[i]+' '+word).trim();}
            lines.forEach((line,i)=>root.addChild(text(line,76,55+i*6,2,'center')));
            const buy=button(58,76,38,16,playerId=>render(onBuy(playerId,selected)?'Bought':'Unavailable'));
            buy.addChild(text(feedback || 'Buy',77,81,2.5,'center'));root.addChild(buy);
        } else root.addChild(text('Welcome!',76,59,2.4,'center'));
        const prev=button(3,89,20,10,()=>{page=(page+Math.ceil(items.length/3)-1)%Math.ceil(items.length/3);render();});
        prev.addChild(text('<',13,90,2.6,'center'));
        const next=button(32,89,20,10,()=>{page=(page+1)%Math.ceil(items.length/3);render();});
        next.addChild(text('>',42,90,2.6,'center'));
        root.addChildren(prev,next,text(`${page+1}/${Math.ceil(items.length/3)}`,27,91,1.8,'center'));
        markDirty();
    };
    render();
    return root;
};

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

        // a game should take ~TUNING.TRIP.durationMinutes to get to vegas. all coords are for vegas and back

        this.coordCount = mapData.mapCoords.length;
        const finish = mapData.landmarks.at(-1).coord;
        this.route = mapData.mapCoords.slice(0, mapData.mapCoords.findIndex(p => p[0] === finish[0] && p[1] === finish[1]) + 1);
        this.currentIndex = 0;
        this.visitedLandmarks = new Set();

        // i want to go through coordCount / 2 points over the trip duration

        this.moveInterval = (TUNING.TRIP.durationMinutes * 60 * 1000) / (this.coordCount / 2);

        this.map = this.constructMap(mapData);
        this.partyNode = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(...this.route[0], 2, 2), fill: Colors.COLORS.RED
        });
        this.map.addChild(this.partyNode);
        this.visitLandmark(mapData.landmarks[0]);

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

        this.root.addChildren(this.map, shopBase, this.currentStatusNode, this.modalRoot);
    }

    callShop(playerId) {
        if (!this.mainGame.canPlay(playerId, this) || this.playerModals[playerId]) return;
        if (this.movingShop) {
            if (!this.movingShop.playerIds.includes(playerId)) this.movingShop.playerIds.push(playerId);
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

            const currentPos = this.route[this.currentIndex];

            const steps = TUNING.SHOP.droneTripSteps;
            const shopPath = Physics.getPath(0, 50, (currentPos[0] / steps), (currentPos[1] - 50) / steps, currentPos[0], 100);

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
                    if (!this.mainGame.canPlay(playerId, this)) return;
                    const modalNode = landmarkModal(playerId, mapData.landmarks[i], (playerId) => { 
                        if (this.playerModals[playerId]) {
                            this.modalRoot.removeChild(this.playerModals[playerId].node.id);
                            delete this.playerModals[playerId];
                        }
                    });
                    
                    if (this.playerModals[playerId]) {
                        this.modalRoot.removeChild(this.playerModals[playerId].node.id);
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
        this.playerStates = playerStates;
        const now = Date.now();

        // true when this tick mutated node fields directly (tree ops notify on their own)
        let changed = false;

        const index = Math.min(this.route.length - 1, Math.floor(this.mainGame.distanceTraveled / this.distanceMiles * (this.route.length - 1)));
        for (let i = this.currentIndex; i <= index; i++) {
            const coord = this.route[i];
            const landmark = this.mapData.landmarks.find(l => l.coord[0] === coord[0] && l.coord[1] === coord[1]);
            if (landmark) this.visitLandmark(landmark);
        }
        if (index !== this.currentIndex) {
            this.currentIndex = index;
            this.partyNode.node.coordinates2d = ShapeUtils.rectangle(...this.route[index], 2, 2);
            changed = true;
        }

        if (this.movingShop) {
            if (!this.movingShop.lastShopMovement || this.movingShop.lastShopMovement + TUNING.SHOP.droneMoveIntervalMs <= now) {
                if (this.movingShop.currentIndex >= this.movingShop.path.length) {
                    const node = this.movingShop.node;
                    this.root.removeChild(node.id);
                    const playerIds = this.movingShop.playerIds;
                    this.movingShop = null;

                    for (const playerId of playerIds) this.openShop(playerId);
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
                    changed = true;
                }
            }
        }

        if (!this.lastDistanceUpdate || this.lastDistanceUpdate + 500 <= now) {
            this.lastDistanceUpdate = now;
            const newValue = `Distance traveled: ${this.mainGame.distanceTraveled.toFixed(2)} of ${this.distanceMiles} miles`;
            if (this.currentStatusNode.node.text.text !== newValue) {
                const newText = Object.assign({}, this.currentStatusNode.node.text);
                newText.text = newValue;
                this.currentStatusNode.node.text = newText;
                changed = true;
            }
        }

        return changed;
    }

    visitLandmark(landmark) {
        if (this.visitedLandmarks.has(landmark.name)) return;
        this.visitedLandmarks.add(landmark.name);
        this.mostRecentLandmark = landmark;
        const inventory = shopInventoryMap()[landmark.name] || {};
        Object.assign(this.shopInventory.consumables, inventory.consumables);
        Object.assign(this.shopInventory.upgrades, inventory.upgrades);
        // During construction the first landmark only initializes stock.
        if (this.mainGame.map === this) this.mainGame.handleNewLandmark(landmark);
    }

    openShop(playerId) {
        if (!this.mainGame.playerStates[playerId]) return;
        this.closeModal(playerId);
        const modal = shopModal(this.shopInventory, [playerId], () => this.closeModal(playerId),
            (id, key) => this.buyItem(id, key), () => this.mainGame.markDirty());
        this.playerModals[playerId] = modal;
        this.modalRoot.addChild(modal);
    }

    buyItem(playerId, key) {
        if (!this.mainGame.canPlay(playerId, this) || !this.playerModals[playerId]) return false;
        const consumable = this.shopInventory.consumables[key];
        const upgrade = this.shopInventory.upgrades[key];
        const item = consumable || upgrade;
        if (!item || this.mainGame.resources.scrap < item.cost) return false;
        if (upgrade && this.mainGame.resources.weapon === key) return false;
        this.mainGame.resources.scrap -= item.cost;
        if (consumable) this.mainGame.resources[key] += item.amount;
        else {
            this.mainGame.resources.weapon = key;
            this.mainGame.hunt.lastResources = this.mainGame.resources;
            this.mainGame.hunt.renderWeaponNode();
        }
        this.mainGame.renderStatsLayer();
        return true;
    }

    closeModal(playerId) {
        if (!this.playerModals[playerId]) return;
        this.modalRoot.removeChild(this.playerModals[playerId].id);
        delete this.playerModals[playerId];
    }

    removePlayer(playerId) {
        this.closeModal(playerId);
        if (this.movingShop) {
            this.movingShop.playerIds = this.movingShop.playerIds.filter(id => id !== playerId);
            if (!this.movingShop.playerIds.length) {
                this.root.removeChild(this.movingShop.node.id);
                this.movingShop = null;
            }
        }
    }

    getRoot() {
        return this.root;
    }
}

module.exports = MapGame;
