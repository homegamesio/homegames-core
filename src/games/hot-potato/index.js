const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0755');
const COLORS = Colors.COLORS;
const Asset = require('../../common/Asset');

class HotPotato extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 1, y: 1},
            squishVersion: '0755',
            author: 'Joseph Garcia',
            description: 'Click or tap the potato when you have the potato.',
            name: 'Hot Potato'
            // thumbnail: 'f70e1e9e2b5ab072764949a6390a8b96'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [87, 42, 19, 255]
        });

        this.players = {};
    }

    updateMessage() {
        if (Object.keys(this.players).length < 2 && !this.messageText) {
            this.messageText = new GameNode.Text({
                textInfo: {
                    text: 'The potato demands at least 2 players.',
                    x: 50,
                    y: 50,
                    color: COLORS.WHITE,
                    size: 2.5,
                    align: 'center'
                }
            });

            this.base.addChild(this.messageText);
        } else if (this.messageText) {
            this.base.removeChild(this.messageText.id);
            this.messageText = null;
        }
    }

    randomPlayerId(excludedIds = []) {
        const playerIdList = Object.keys(this.players).filter(k => excludedIds.indexOf(k) < 0);
        const max = playerIdList.length;
        const randIndex = Math.floor(Math.random() * max);
        return playerIdList[randIndex];
    }

    explode() {
        console.log('need to remove potato, show exploded potato, play explosion audio');
        if (this.potato) {
            this.base.removeChild(this.potato.id);
            const deadPotato = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),
                assetInfo: {
                    'potato-dead': {
                        'pos': {x: 30, y: 35 },
                        'size': {x: 40, y: 30}
                    }
                },
                playerIds: this.potato.node.playerIds
            });

            this.base.addChild(deadPotato);

            this.setTimeout(() => {
                this.base.removeChild(deadPotato.id);
                this.createPotato();
            }, 3 * 1000);
        }
    }

    createPotato(assignedPlayerId) {
        if (this.potato) {
            this.base.removeChild(this.potato.node.id);
        }

        const potatoOverlay = new GameNode.Shape({ 
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),
            // fill: COLORS.RED,
            onClick: (playerId) => {
                // exclude current player
                const newPlayerId = this.randomPlayerId(this.potato.node.playerIds);
                this.updatePotatoState(newPlayerId);
            }
        });

        this.potato = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),
            assetInfo: {
                'potato': {
                    'pos': {x: 30, y: 35 },
                    'size': {x: 40, y: 30}
                }
            },
            playerIds: [assignedPlayerId || this.randomPlayerId()]
        });

        this.potato.addChild(potatoOverlay);

        // this.potato.addChild(potatoAsset);

        // at least 5 seconds, possibly up to 30
        const randomEndSeconds = 5 + (Math.floor(Math.random() * 25));

        this.setTimeout(() => {
            this.explode();
        }, randomEndSeconds * 1000);

        this.base.addChild(this.potato);
    }

    updatePotatoState(assignedPlayerId) {
        if (Object.keys(this.players).length > 1 && !this.potato) {
            this.createPotato();
        } else if (this.potato && Object.keys(this.players).length < 2) {
            this.base.removeChild(this.potato.id);
            this.potato = null;
        } else if (assignedPlayerId && this.potato) {
            this.potato.node.playerIds = [assignedPlayerId];
        }
    }

    handleNewPlayer({ playerId, info, settings, clientInfo }) {
        this.players[playerId] = {
            info,
            settings,
            clientInfo
        };

        this.updateMessage();
        this.updatePotatoState();
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.updateMessage();
        this.updatePotatoState();
    }

    getLayers() {
        return [{
            root: this.base
        }];
    }

    getAssets() {
        return {
            'potato': new Asset({
                id: '48685183f94c7a3c14f315444c6460bd',
                type: 'image'
            }),
            'potato-dead': new Asset({
                id: '5fc598f08a887c8cd437bb3d9cdca197',
                type: 'image'
            }),
        }
    }
}

module.exports = HotPotato;
