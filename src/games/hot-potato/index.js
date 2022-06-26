const { Game, GameNode, Colors, Shapes, ShapeUtils, GeometryUtils } = require('squish-0755');
const COLORS = Colors.COLORS;

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
    }

    createPotato(assignedPlayerId) {
        if (this.potato) {
            this.base.removeChild(this.potato.node.id);
        }

        this.potato = new GameNode.Shape({ 
            shapeType: Shapes.POLYGON,
            coordinates2d: ShapeUtils.rectangle(25, 25, 50, 50),
            fill: COLORS.RED,
            playerIds: [assignedPlayerId || this.randomPlayerId()],
            onClick: (playerId) => {
                console.log('player clicked potato');
                // exclude current player
                const newPlayerId = this.randomPlayerId(this.potato.node.playerIds);
                this.updatePotatoState(newPlayerId);
            }
        });

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
}

module.exports = HotPotato;
