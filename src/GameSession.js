let { Squisher } = require('squish-0756');
const { generateName } = require('./common/util');
const squishMap = require('./common/squish-map');

const HomegamesRoot = require('./homegames_root/HomegamesRoot');
const HomegamesDashboard = require('./dashboard/HomegamesDashboard');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require('homegames-common');
const HomenamesHelper = require('./util/homenames-helper');

const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const _BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);
const PERFORMANCE_PROFILING = getConfigValue('PERFORMANCE_PROFILING', false);
const BEZEL_SIZE_Y = PERFORMANCE_PROFILING ? _BEZEL_SIZE_Y + 20 : _BEZEL_SIZE_Y; 

class GameSession {
    constructor(game, port) {
        this.game = game;
        this.port = port;

        const gameSquishVersion = game.constructor.metadata().squishVersion;

        if (squishMap[gameSquishVersion]) {
            Squisher = require(squishMap[gameSquishVersion]).Squisher; 
        }
        this.homenamesHelper = new HomenamesHelper(this.port);

        this.playerInfoMap = {};
        this.clientInfoMap = {};
        this.playerSettingsMap = {};

        this.homegamesRoot = new HomegamesRoot(this, game instanceof HomegamesDashboard, false);
        this.customBottomLayer = {
            root: this.homegamesRoot.getRoot(),
            scale: {x: 1, y: 1},
            assets: this.homegamesRoot.constructor.metadata().assets
        };

        this.customTopLayer = {
            root: this.homegamesRoot.getTopLayerRoot(),
            scale: {x: 1, y: 1}
        };

        // TODO: make this configurable per player (eg. configurable bezel size)
        this.scale = {x: (100 - BEZEL_SIZE_X) / 100, y:  (100 - BEZEL_SIZE_Y) / 100};

        this.squisher = new Squisher({ game, scale: this.scale, customBottomLayer: this.customBottomLayer, customTopLayer: this.customTopLayer, onAssetUpdate: (newAssetBundle) => {
            for (const playerId in this.players) {
                this.players[playerId].receiveUpdate(newAssetBundle);
            }
        } });
        
        this.hgRoot = this.squisher.hgRoot;
        this.squisher.addListener((squished) => {this.handleSquisherUpdate(squished);});
        this.gameMetadata = this.game.constructor.metadata && this.game.constructor.metadata();
        this.aspectRatio = this.gameMetadata && this.gameMetadata.aspectRatio || {x: 16, y: 9}; 

        this.players = {};
        this.spectators = {};
    }

    handleNewAsset(key, asset) {
        return new Promise((resolve, reject) => {
            this.squisher.handleNewAsset(key, asset).then(newBundle => {
                for (const playerId in this.players) {
                    const player = this.players[playerId];
                    player.receiveUpdate(newBundle);
                }
                resolve();
            });
        });
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.players) {
            const playerSettings = this.playerSettingsMap[playerId] || {};
            
            let playerFrame = this.squisher.getPlayerFrame(playerId);
            
            if (playerSettings) {
                if ((!playerSettings.SOUND || !playerSettings.SOUND.enabled) && playerFrame) {
                    playerFrame = playerFrame.filter(f => {
                        const unsquished = this.squisher.unsquish(f);
                        if (unsquished.node.asset) {
                            if (this.game.getAssets && this.game.getAssets() && this.game.getAssets()[Object.keys(unsquished.node.asset)[0]]) {
                                if (this.game.getAssets()[Object.keys(unsquished.node.asset)[0]].info.type === 'audio') {
                                    return false;
                                }
                            }
                        }

                        return true;
                    });
                }
            }

            if (playerFrame) {

                this.players[playerId].receiveUpdate(playerFrame.flat());
            }
        }

        for (const spectatorId in this.spectators) {
            const playerSettings = {};//this.playerSettingsMap[playerId] || {};
            
            let playerFrame = this.squisher.getPlayerFrame(spectatorId);
            
            if (playerSettings) {
                if ((!playerSettings.SOUND || !playerSettings.SOUND.enabled) && playerFrame) {
                    playerFrame = playerFrame.filter(f => {
                        const unsquished = this.squisher.unsquish(f);
                        if (unsquished.node.asset) {
                            if (this.game.getAssets && this.game.getAssets() && this.game.getAssets()[Object.keys(unsquished.node.asset)[0]]) {
                                if (this.game.getAssets()[Object.keys(unsquished.node.asset)[0]].info.type === 'audio') {
                                    return false;
                                }
                            }
                        }

                        return true;
                    });
                }
            }

            if (playerFrame) {
                this.spectators[spectatorId].receiveUpdate(playerFrame.flat());
            }
        }
    }

    addSpectator(spectator) {
        console.log('does this happen wtf ' + spectator.id);
        this.squisher.assetBundle && spectator.receiveUpdate(this.squisher.assetBundle);
        // spectator.receiveUpdate(this.squisher.getPlayerFrame(spectator.id));
        spectator.addInputListener(this, true);
        this.spectators[Number(spectator.id)] = spectator;
        this.homegamesRoot.handleNewSpectator(spectator);
    }

    addPlayer(player) {
        // if (this.game.canAddPlayer && !this.game.canAddPlayer()) {
        //     player.receiveUpdate([5, 70, 0]);
        // }

        this.players[player.id] = player;

        const doThing = () => {
            this.homenamesHelper.getPlayerInfo(player.id).then(playerInfo => {
                this.homenamesHelper.getPlayerSettings(player.id).then(playerSettings => {
                    this.homenamesHelper.getClientInfo(player.id).then(clientInfo => {
                        
                        this.playerInfoMap[player.id] = playerInfo;
                        this.clientInfoMap[player.id] = clientInfo;

                        this.playerSettingsMap[player.id] = playerSettings;

                        this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);
                        const playerPayload = {
                            playerId: player.id, 
                            settings: this.playerSettingsMap[player.id], 
                            info: this.playerInfoMap[player.id],
                            clientInfo,
                            requestedGame: player.requestedGame
                        };

                        const rootPayload = Object.assign({
                            requestedGame: player.requestedGame
                        }, playerPayload);

                        this.homenamesHelper.addListener(player.id);

                        this.homegamesRoot.handleNewPlayer(rootPayload);
                        this.game.handleNewPlayer && this.game.handleNewPlayer(playerPayload);

                        player.requestedGame = null;

                        player.addInputListener(this);
                    });
                });
            });
        };

        if (player.info && player.info.name) {
            doThing();
        } else {
            const playerName = generateName();

            this.homenamesHelper.updatePlayerInfo(player.id, { playerName }).then(() => {
                console.log('wtf');
                console.log(player.id + ',,,, ');
                console.log(player.clientInfo);
                this.homenamesHelper.updateClientInfo(player.id, player.clientInfo).then(() => {
                    doThing();
                });
            });
        }
    }

    handlePlayerUpdate(playerId, {info, settings}) {
        this.playerInfoMap[playerId] = info;
        this.playerSettingsMap[playerId] = settings;

        this.homegamesRoot.handlePlayerUpdate(playerId, {info, settings});
        this.game.handlePlayerUpdate && this.game.handlePlayerUpdate(playerId, { info, settings });
    }

    handleSpectatorDisconnect(spectatorId) {
        this.homegamesRoot.handleSpectatorDisconnect(spectatorId);
        delete this.spectators[spectatorId];
    }

    handlePlayerDisconnect(playerId) {
        delete this.players[playerId];
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
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

    handlePlayerInput(playerId, input) {
        if (input.type === 'click') {
            this.handleClick(playerId, input.data);
        } else if (input.type === 'keydown') {
            this.game.handleKeyDown && this.game.handleKeyDown(playerId, input.key);
        } else if (input.type === 'keyup') {
            this.game.handleKeyUp && this.game.handleKeyUp(playerId, input.key);
        } else if (input.type === 'input') {
            if (input.gamepad) {
                this.game.handleGamepadInput && this.game.handleGamepadInput(playerId, input);
            } else {
                const node = this.game.findNode(input.nodeId) || this.customTopLayer.root.findChild(input.nodeId);
                if (node && node.node.input) {
                    // hilarious
                    if (node.node.input.type === 'file') {
                        node.node.input.oninput(playerId, Object.values(input.input));
                    } else {
                        node.node.input.oninput(playerId, input.input);
                    }
                }
            }
        } else if (input.type === 'clientInfo') {
            // if (this.game && this.game.deviceRules) {
            //     const deviceRules = this.game.deviceRules();
            //     if (deviceRules.aspectRatio) {
            //         deviceRules.aspectRatio(player.id, player.clientInfo.aspectRatio);
            //     }
                
            // }
        } else {
            log.info('Unknown input type: ', input.type);
        }
    }

    movePlayer({ playerId, port }) {
        const player = this.players[playerId];
        if (player) {
            player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
        }
    }

    handleClick(playerId, click) {
        if (click.x >= 100 || click.y >= 100) {
            return;
        }

        const spectating = this.spectators[playerId] ? true : false;
        // console.log('ayooooo ' + player.spectating)
        const clickedNode = this.findClick(click.x, click.y, spectating, playerId);

        if (clickedNode) {
            const clickedNodeId = clickedNode.id;
            // todo: implement get node (maybe maintain map in game?)
            const realNode = this.game.findNode(clickedNodeId) || this.customBottomLayer.root.findChild(clickedNodeId) || this.customTopLayer.root.findChild(clickedNodeId);

            if (click.x <= (BEZEL_SIZE_X / 2) || click.x >= (100 - BEZEL_SIZE_X / 2) || click.y <= BEZEL_SIZE_Y / 2 || click.y >= (100 - BEZEL_SIZE_Y / 2)) {
                realNode.node.handleClick && realNode.node.handleClick(playerId, click.x, click.y);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
            } else {
                const shiftedX = click.x - (BEZEL_SIZE_X / 2);
                const shiftedY = click.y - (BEZEL_SIZE_Y / 2);

                const scaledX = shiftedX * ( 1 / ((100 - BEZEL_SIZE_X) / 100));
                const scaledY = shiftedY * ( 1 / ((100 - BEZEL_SIZE_Y) / 100));

                realNode.node.handleClick && realNode.node.handleClick(playerId, scaledX, scaledY);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
                
            }
        }
    }

    findClick(x, y, spectating, playerId = 0) {
        let clicked = null;

        if (this.customBottomLayer) {
            const scale = {x: 1, y: 1};
            clicked = this.findClickHelper(x, y, spectating, playerId, this.customBottomLayer.root.node, null, scale) || clicked;
        }

        for (const layerIndex in this.game.getLayers()) {
            const layer = this.game.getLayers()[layerIndex];
            const scale = layer.scale || this.scale;

            clicked = this.findClickHelper(x, y, spectating, playerId, this.game.getLayers()[layerIndex].root.node, null, scale) || clicked;
        }

        if (this.customTopLayer) {
            const scale = {x: 1, y: 1};
            clicked = this.findClickHelper(x, y, spectating, playerId, this.customTopLayer.root.node, null, scale) || clicked;
        }

        return clicked;
    }

    findClickHelper(x, y, spectating, playerId, node, clicked = null, scale, inGame) {
        if (node.id === this.game.getLayers()[0].root.node.id) {
            inGame = true;
        }

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
                if (!spectating || !inGame) {
                    clicked = node;
                }
            }

        }

        for (const i in node.children) {
            clicked = this.findClickHelper(x, y, spectating, playerId, node.children[i].node, clicked, scale, inGame);
        }

        return clicked;
    }

    setServerCode(serverCode) {
        console.log("SERVER CODE " + serverCode)
        if (!this.homegamesRoot.isDashboard) {
            this.homegamesRoot.handleServerCode(serverCode);
        }
    }

    spectateSession(playerId) {
        const player = this.players[playerId];
        player.receiveUpdate([6, Math.floor(this.port / 100), Math.floor(this.port % 100)]);
    }

    joinSession(spectatorId) {
        const spectator = this.spectators[spectatorId];
        spectator.receiveUpdate([5, Math.floor(this.port / 100), Math.floor(this.port % 100)]);
    }

}

module.exports = GameSession;
