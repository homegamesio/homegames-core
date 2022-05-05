const { Squisher } = require('squish-0710');
const { generateName } = require('./common/util');
const HomegamesRoot = require('./HomegamesRoot');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const _BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);
const PERFORMANCE_PROFILING = getConfigValue('PERFORMANCE_PROFILING', false);
const BEZEL_SIZE_Y = PERFORMANCE_PROFILING ? _BEZEL_SIZE_Y + 20 : _BEZEL_SIZE_Y; 

class GameSession {
    constructor(game, port) {
        this.game = game;
        this.port = port;
        this.spectators = {};

        console.log('sdfkjsdfkjdsfnskjdf buttttt');
        this.homegamesRoot = new HomegamesRoot(game, false, false);
        this.customBottomLayer = {
            root: this.homegamesRoot.getRoot(),
            scale: {x: 1, y: 1},
            assets: this.homegamesRoot.constructor.metadata().assets
        };

        this.customTopLayer = {
            root: this.homegamesRoot.getTopLayerRoot(),
            scale: {x: 1, y: 1}
        }

        // TODO: make this configurable per player (eg. configurable bezel size)
        this.scale = {x: (100 - BEZEL_SIZE_X) / 100, y:  (100 - BEZEL_SIZE_Y) / 100};

        this.squisher = new Squisher({ game, scale: this.scale, customBottomLayer: this.customBottomLayer, customTopLayer: this.customTopLayer });
        // this.squisher.hgRoot.players = this.game.players;
        // this.squisher.hgRoot.spectators = this.spectators;
        this.hgRoot = this.squisher.hgRoot;
        this.squisher.addListener((squished) => {this.handleSquisherUpdate(squished)});//this.handleSquisherUpdate);
        this.gameMetadata = this.game.constructor.metadata && this.game.constructor.metadata();
        this.aspectRatio = this.gameMetadata && this.gameMetadata.aspectRatio || {x: 16, y: 9}; 
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.game.players) {
            // console.log("doing this");
            // console.log(this.squisher.playerStates[playerId]);
            this.game.players[playerId].receiveUpdate(this.squisher.playerStates[playerId].flat());
            // this.game.players[playerId].receiveUpdate(squished.flat());
        }

        for (const playerId in this.spectators) {
            this.spectators[playerId].receiveUpdate(this.squisher.playerFrames[playerId]);
        }
    }

    addSpectator(spectator) {
        this.squisher.assetBundle && spectator.receiveUpdate(this.squisher.assetBundle);
        spectator.receiveUpdate(this.squisher.playerFrames[spectator.id]);
        spectator.addInputListener(this, true);
        this.spectators[Number(spectator.id)] = spectator;
        this.squisher.hgRoot.handleNewSpectator(spectator);
    }

    addPlayer(player) {
        if (this.game.canAddPlayer && !this.game.canAddPlayer()) {
            player.receiveUpdate([5, 70, 0]);
        }
        const playerName = generateName();
        player.info.name = player.info.name || playerName;
        this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);

        this.game._hgAddPlayer(player);
        this.game.handleNewPlayer && this.game.handleNewPlayer(player);
        if (this.game.deviceRules && player.clientInfo) {
            const deviceRules = this.game.deviceRules();
            if (deviceRules.aspectRatio) {
                deviceRules.aspectRatio(player, player.clientInfo.aspectRatio);
            }
            if (deviceRules.deviceType) {
                deviceRules.deviceType(player, player.clientInfo.deviceType)
            }
        }

        this.homegamesRoot.handleNewPlayer(player);

        // ensure the squisher has game data for the new player
        this.squisher.squish();
        
        player.receiveUpdate(this.squisher.playerStates[player.id].flat());
        player.addInputListener(this);
    }

    handleSpectatorDisconnect(spectatorId) {
        this.squisher.hgRoot.handleSpectatorDisconnect(spectatorId);
        delete this.spectators[spectatorId];
    }

    handlePlayerDisconnect(playerId) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
        this.game._hgRemovePlayer(playerId);
        this.homegamesRoot.handlePlayerDisconnect(playerId);
    }

    initialize(cb) {
        if (this.initialized) {
            cb && cb();
        } else {
            this.squisher.initialize().then(() => {
                this.initialized = true;
                cb && cb();
            });
        }
    }

    handlePlayerInput(player, input) {
        if (input.type === 'click') {
            this.handleClick(player, input.data);
        } else if (input.type === 'keydown') {
            this.game.handleKeyDown && this.game.handleKeyDown(player, input.key);
        } else if (input.type === 'keyup') {
            this.game.handleKeyUp && this.game.handleKeyUp(player, input.key);
        } else if (input.type === 'input') {
            const node = this.game.findNode(input.nodeId);
            if (node && node.node.input) {
                // hilarious
                if (node.node.input.type === 'file') {
                    node.node.input.oninput(player, Object.values(input.input));
                } else {
                    node.node.input.oninput(player, input.input);
                }
            }
        } else if (input.type === 'clientInfo') {
            if (this.game && this.game.deviceRules) {
                const deviceRules = this.game.deviceRules();
                if (deviceRules.aspectRatio) {
                    deviceRules.aspectRatio(player, player.clientInfo.aspectRatio);
                }
                
            }
        } else {
            console.log('Unknown input type: ' + input.type);
        }
    }


    handleClick(player, click) {
        if (click.x >= 100 || click.y >= 100) {
            return;
        }

        const clickedNode = this.findClick(click.x, click.y, player.spectating, player.id);

        if (clickedNode) {
            const clickedNodeId = clickedNode.id;
            // todo: implement get node (maybe maintain map in game?)
            const realNode = this.game.findNode(clickedNodeId) || this.customBottomLayer.root.findChild(clickedNodeId);

            if (click.x <= (BEZEL_SIZE_X / 2) || click.x >= (100 - BEZEL_SIZE_X / 2) || click.y <= BEZEL_SIZE_Y / 2 || click.y >= (100 - BEZEL_SIZE_Y / 2)) {
                realNode.node.handleClick && realNode.node.handleClick(player, click.x, click.y);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
            } else {
                const shiftedX = click.x - (BEZEL_SIZE_X / 2);
                const shiftedY = click.y - (BEZEL_SIZE_Y / 2);

                const scaledX = shiftedX * ( 1 / ((100 - BEZEL_SIZE_X) / 100));
                const scaledY = shiftedY * ( 1 / ((100 - BEZEL_SIZE_Y) / 100));

                realNode.node.handleClick && realNode.node.handleClick(player, scaledX, scaledY);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
            }
        }
    }

    findClick(x, y, spectating, playerId = 0) {
        let clicked = null;

        if (this.customBottomLayer) {
            const scale = {x: 1, y: 1};
            clicked = this.findClickHelper(x, y, false, playerId, this.customBottomLayer.root.node, null, scale) || clicked;
        }

        for (const layerIndex in this.game.getLayers()) {
            const layer = this.game.getLayers()[layerIndex];
            const scale = layer.scale || this.scale;

            clicked = this.findClickHelper(x, y, false, playerId, this.game.getLayers()[layerIndex].root.node, null, scale) || clicked;
        }

        return clicked;
    }

    findClickHelper(x, y, spectating, playerId, node, clicked = null, scale) {
            if ((node.playerIds.length === 0 || node.playerIds.find(x => x == playerId)) && node.coordinates2d !== undefined && node.coordinates2d !== null) {
                const vertices = [];
 
                for (const i in node.coordinates2d) {
                            const xOffset = 100 - (scale.x * 100);
                            const yOffset = 100 - (scale.y * 100);
    

                        const scaledX = node.coordinates2d[i][0] * ((100 - xOffset) / 100) + (xOffset / 2);
                        const scaledY = node.coordinates2d[i][1] * ((100 - yOffset) / 100) + (yOffset / 2);

                        vertices.push([scaledX, scaledY]);
                }

                let isInside = false;
                let minX = vertices[0][0];
                let maxX = vertices[0][0];
                let minY = vertices[0][1];
                let maxY = vertices[0][1];
                for (let i = 1; i < vertices.length; i++) {
                    const vert = vertices[i];
                    minX = Math.min(vert[0], minX);
                    maxX = Math.max(vert[0], maxX);
                    minY = Math.min(vert[1], minY);
                    maxY = Math.max(vert[1], maxY);
                }

                if (!(x < minX || x > maxX || y < minY || y > maxY)) {
                    let i = 0;
                    let j = vertices.length - 1;
                    for (i, j; i < vertices.length; j=i++) {
                        if ((vertices[i][1] > y) != (vertices[j][1] > y) &&
                                x < (vertices[j][0] - vertices[i][0]) * (y - vertices[i][1]) / (vertices[j][1] - vertices[i][1]) + vertices[i][0]) {
                            isInside = !isInside;
                        }
                    }
                }
                
                if (isInside) {
                    clicked = node;
                }

            }

        for (const i in node.children) {
            clicked = this.findClickHelper(x, y, spectating, playerId, node.children[i].node, clicked, scale);
        }

        return clicked;
    }

}

module.exports = GameSession;
