const { Asset, Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0767');
const COLORS = Colors.COLORS;

class HotPotato extends Game {
    static metadata() {
        return {
            aspectRatio: {x: 1, y: 1},
            squishVersion: '0767',
            author: 'Joseph Garcia',
            description: 'Click or tap the potato when you have the potato. Make sure you have sound turned on.',
            name: 'Hot Potato',
            thumbnail: 'adfd7a7b28e1e4e5b6ae3dc0b07a5784'
        };
    }

    constructor() {
        super();
        this.base = new GameNode.Shape({
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(0, 0, 100, 100),
            fill: [87, 42, 19, 255],
            onClick: () => {
                console.log('fuck 123');
            },
        });

        this.players = {};
        this.soundTimestamp = null;
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
            
            this.base.clearChildren();
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
        if (this.potato) {
            this.base.removeChild(this.potato.id);
            this.deadPotato = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),
                assetInfo: {
                    'potato-dead': {
                        'pos': {x: 30, y: 35 },
                        'size': {x: 40, y: 30}
                    }
                },
                playerIds: this.potato.node.playerIds
            });
            
            this.deadPotatoSound = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    'potato-bleh': {
                        pos: {x: 0, y: 0},
                        size: {x: 0, y: 0},
                        startTime: 0
                    }
                },
                playerIds: this.potato.node.playerIds
            });
            
            this.base.addChildren(this.deadPotato, this.deadPotatoSound);

            setTimeout(() => {
                this.base.removeChild(this.deadPotatoSound.id);
            }, 250);
            this.setTimeout(() => {
                if (this.deadPotato) {
                    this.base.removeChild(this.deadPotato.id);
                }
                this.createPotato();
            }, 3 * 1000);
        }
    }

    createPotato(assignedPlayerId) {
        if (!assignedPlayerId) {
            assignedPlayerId = Number(this.randomPlayerId());
        }
        if (this.potato) {
            this.base.removeChild(this.potato.node.id);
        }

        const potatoOverlay = new GameNode.Shape({ 
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(15, 15, 70, 70),
            onClick: (playerId) => {
                // exclude current player
                const newPlayerId = Number(this.randomPlayerId(this.potato.node.playerIds));
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
            playerIds: [assignedPlayerId]
        });
        
        this.songPlayedAt = Date.now();
        this.soundTimestamp = 0;
        this.potatoSound = new GameNode.Asset({
            coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
            assetInfo: {
                'hiss': {
                    pos: {x: 0, y: 0},
                    size: {x: 0, y: 0},
                    startTime: this.soundTimestamp
                }
            }
        });

        this.potato.addChildren(this.potatoSound, potatoOverlay);


        // at least 5 seconds, possibly up to 20
        const randomEndSeconds = 5 + (Math.floor(Math.random() * 15));

        this.setTimeout(() => {
            this.explode();
        }, randomEndSeconds * 1000);

        this.base.addChild(this.potato);
    }

    updatePotatoState(assignedPlayerId) {
        if (this.deadPotato) {
            // this.base.clearChildren(this.deadPotato.id);
            // this.deadPotato = null;
        }

        if (Object.keys(this.players).length > 1 && !this.potato) {
            this.createPotato();
        } else if (this.potato && Object.keys(this.players).length < 2) {
            this.base.removeChild(this.potato.id);
            this.potato = null;
        } else if (assignedPlayerId && this.potato) {
            const now = Date.now();
            this.soundTimestamp = this.soundTimestamp + ((now - this.songPlayedAt) / 1000);
            this.potato.removeChild(this.potatoSound.id);
            this.potatoSound = new GameNode.Asset({
                coordinates2d: ShapeUtils.rectangle(0, 0, 0, 0),
                assetInfo: {
                    'hiss': {
                        pos: {x: 0, y: 0},
                        size: {x: 0, y: 0},
                        startTime: this.soundTimestamp//(now - this.songPlayedAt) / 1000
                    }
                }
            });
            this.songPlayedAt = now;
            this.potato.addChild(this.potatoSound);

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
            'hiss': new Asset({
                'id': '9de51f059a02e37356da0faefcabe643',
                'type': 'audio'
            }),
            'potato-bleh': new Asset({
                'id': '600513b2cbd50c1f8c465b3098c22c56',
                'type': 'audio'
            }),
            
        };
    }
}

module.exports = HotPotato;
