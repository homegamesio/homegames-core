const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, Physics, GeometryUtils, subtypes } = require('squish-0767');

const landmarkModal = (playerId, landmarkData, onClose) => {
    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
        fill: Colors.COLORS.RED,
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

    const closeButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(20, 20, 10, 10),
        fill: Colors.COLORS.CYAN,
        onClick: onClose
    });

    const titleText = new GameNode.Text({
        textInfo: {
            text: landmarkData.name,
            x: 50,
            y: 45,
            align: 'center',
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
                size: 1.2,
                color: Colors.COLORS.WHITE
            }
        });

        modal.addChild(descriptionLine);
    }

    modal.addChildren(landmarkImage, titleText, closeButton);

    return modal;
}




const shopModal = (playerIds, onClose) => {
    console.log('for which players though');
    console.log(playerIds);
    const modal = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
        fill: Colors.COLORS.RED,
        playerIds
    });

    const closeButton = new GameNode.Shape({
        shapeType: Shapes.POLYGON,
        coordinates2d: ShapeUtils.rectangle(20, 20, 10, 10),
        fill: Colors.COLORS.CYAN,
        onClick: onClose
    });

    const titleText = new GameNode.Text({
        textInfo: {
            text: 'Shop with me and get ya order',
            x: 50,
            y: 45,
            align: 'center',
            size: 2,
            color: Colors.COLORS.WHITE
        }
    });

    modal.addChildren(closeButton, titleText);

    return modal;
}

class MapGame {
    constructor(mainGame, mapData, distanceMiles) {
        this.mainGame = mainGame;
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

        this.playerModals = {};
        this.playerStates = {};

        // a game should take ~10 minutes to get to vegas. all coords are for vegas and back

        this.coordCount = mapData.mapCoords.length;

        // i want to go through coordCount / 2 points over 10 minutes

        this.moveInterval = (10 * 60 * 1000) / (this.coordCount / 2);

        // console.log('need to move every ' + moveInterval + ', ,,, ' + coordCount);

        this.map = this.constructMap(mapData);

        const shopButton = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(80, 20, 5, 5),
            fill: Colors.COLORS.BLUE,
            onClick: (playerId) => this.callShop(playerId)
        })
        
        this.root.addChildren(this.map, shopButton, this.modalRoot);
    }

    callShop(playerId) {    
        console.log('player wants to shop ' + playerId);
        if (this.movingShop) {
            this.movingShop.playerIds.push(playerId);
        } else {
            const shopNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(0, 50, 2, 2),
                fill: Colors.COLORS.YELLOW
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
        const map = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: mapData.mapCoords,
            fill: Colors.COLORS.PINK
        });

        this.mapData = mapData;

        for (let i = 0; i < mapData.landmarks.length; i++) {
            const landmarkData = mapData.landmarks[i];
            const landmarkNode = new GameNode.Shape({
                shapeType: Shapes.POLYGON,
                coordinates2d: ShapeUtils.rectangle(landmarkData.coord[0], landmarkData.coord[1], 2, 2),
                fill: Colors.COLORS.BLACK,
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

            const landmarkText = new GameNode.Text({
                textInfo: {
                    x: landmarkData.textCoord[0],
                    y: landmarkData.textCoord[1],
                    align: 'left',
                    size: 1.1,
                    color: Colors.COLORS.GREEN,
                    text: landmarkData.name
                }
            });
            landmarkNode.addChild(landmarkText);

            map.addChild(landmarkNode);
        }

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
            if (!playerState.lastMovementTime || playerState.lastMovementTime + this.moveInterval <= now) {
                if (playerState.currentIndex >= playerState.path.length) {
                    continue;
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

                    const playerShopModal = shopModal(playerIds, () => {
                        this.modalRoot.removeChild(playerShopModal.node.id);
                        playerShopModal.node.free();
                    })

                    this.modalRoot.addChild(playerShopModal);
                } else {

                    const newCoords = ShapeUtils.rectangle(this.movingShop.path[this.movingShop.currentIndex][0], this.movingShop.path[this.movingShop.currentIndex][1], 2, 2);
                    // feels filthy but hey you know
                    this.movingShop.node.node.coordinates2d = newCoords;
                    this.movingShop.lastShopMovement = now;
                    this.movingShop.currentIndex = this.movingShop.currentIndex + 1;
                }
            }
        }
 
    }

    getRoot() {
        return this.root;
    }
}

module.exports = MapGame;
