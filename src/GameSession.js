const { Squisher } = require('squish-0730');
const { generateName } = require('./common/util');
const HomegamesRoot = require('./homegames_root/HomegamesRoot');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);
const HomenamesHelper = require('./util/homenames-helper');

const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const _BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);
const PERFORMANCE_PROFILING = getConfigValue('PERFORMANCE_PROFILING', false);
const BEZEL_SIZE_Y = PERFORMANCE_PROFILING ? _BEZEL_SIZE_Y + 20 : _BEZEL_SIZE_Y; 

class GameSession {
    constructor(game, port) {
        this.game = game;
        this.port = port;

        this.homenamesHelper = new HomenamesHelper(this.port);

        this.playerInfoMap = {};
        this.playerSettingsMap = {};

        this.homegamesRoot = new HomegamesRoot(this, false, false);
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

        this.squisher = new Squisher({ game, scale: this.scale, customBottomLayer: this.customBottomLayer, customTopLayer: this.customTopLayer });
        // this.squisher.hgRoot.players = this.game.players;
        // this.squisher.hgRoot.spectators = this.spectators;
        this.hgRoot = this.squisher.hgRoot;
        this.squisher.addListener((squished) => {this.handleSquisherUpdate(squished);});//this.handleSquisherUpdate);
        this.gameMetadata = this.game.constructor.metadata && this.game.constructor.metadata();
        this.aspectRatio = this.gameMetadata && this.gameMetadata.aspectRatio || {x: 16, y: 9}; 

        this.players = {};
        this.spectators = {};
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.players) {
            // console.log('playuer id ' + playerId);
            // console.log(this.playerInfoMap);
            const playerSettings = this.playerSettingsMap[playerId] || {};
            
            let playerFrame = this.squisher.getPlayerFrame(playerId);
            
            // console.log('frame');
            // console.log(playerFrame);
            if (playerSettings) {
                // console.log(playerInfo.settings);
                if ((!playerSettings.SOUND || !playerSettings.SOUND.enabled) && playerFrame) {
                    playerFrame = playerFrame.filter(f => {
                        const unsquished = this.squisher.unsquish(f);
                        if (unsquished.node.asset) {
                            // console.log('assset');
                            // console.log(unsquished.node.asset);
                            if (this.game.getAssets && this.game.getAssets() && this.game.getAssets()[Object.keys(unsquished.node.asset)[0]]) {
                                // console.log('referneces an asset lol im dumb');
                                // console.log(this.game.getAssets()[Object.keys(unsquished.node.asset)[0]]);
                                if (this.game.getAssets()[Object.keys(unsquished.node.asset)[0]].info.type === 'audio') {
                                    return false;
                                    // console.log('need to filter out audio!');
                                }
                            }
                        }

                        return true;
                    });
                    // for (let i = 0; i < playerFrame.length; i++) {
                    //     // TODO: find a more performant way to do this filtering
                    //     const unsquished = this.squisher.unsquish(playerFrame[i]);
                    //     if (unsquished.node.asset) {
                    //         // console.log('assset');
                    //         // console.log(unsquished.node.asset);
                    //         if (this.game.getAssets && this.game.getAssets() && this.game.getAssets()[Object.keys(unsquished.node.asset)[0]]) {
                    //             // console.log('referneces an asset lol im dumb');
                    //             // console.log(this.game.getAssets()[Object.keys(unsquished.node.asset)[0]]);
                    //             if (this.game.getAssets()[Object.keys(unsquished.node.asset)[0]].info.type === 'audio') {
                    //                 // console.log('need to filter out audio!');
                    //             }
                    //         }
                    //     }
                    // console.log('wasss');
                    // console.log(this.squisher.unsquish(playerFrame[i]));
                    // if (playerFrame[i][2] === 48) {
                    //     console.log('plapssssss');
                    // }
                    // }
                    // playerFrame = this.squisher.getPlayerFrame(playerId).filter(f => f[2] !== 48);
                    // console.log('playuer frame');
                    // console.log(playerFrame);
                }
            }

            if (playerFrame) {

                this.players[playerId].receiveUpdate(playerFrame.flat());
            }
        }

        // for (const playerId in this.spectators) {
        //     this.spectators[playerId].receiveUpdate(this.squisher.playerFrames[playerId]);
        // }
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

        console.log('sesion just got player');
        console.log(player);
        this.players[player.id] = player;

        // this.homenamesHelper.addListener(player.id, (playerInfo) => {
        // console.log('new playuer info');
        // console.log(playerInfo);
        // }).then(() => {
        const doThing = () => {
            this.homenamesHelper.getPlayerInfo(player.id).then(playerInfo => {
                this.homenamesHelper.getPlayerSettings(player.id).then(playerSettings => {
                    this.playerInfoMap[player.id] = playerInfo;
                    this.playerSettingsMap[player.id] = playerSettings;

                    this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);
                    const playerPayload = {playerId: player.id, settings: this.playerSettingsMap[player.id], info: this.playerInfoMap[player.id], requestedGame: player.requestedGame };

                    this.homenamesHelper.addListener(player.id);

                    this.homegamesRoot.handleNewPlayer(playerPayload);
                    this.game.handleNewPlayer && this.game.handleNewPlayer(playerPayload);

                    if (this.game.deviceRules && player.clientInfo) {
                        const deviceRules = this.game.deviceRules();
                        if (deviceRules.aspectRatio) {
                            deviceRules.aspectRatio(player, player.clientInfo.aspectRatio);
                        }
                        if (deviceRules.deviceType) {
                            deviceRules.deviceType(player, player.clientInfo.deviceType);
                        }
                    }

                    player.addInputListener(this);
                });
            });
        }

        console.log('the fuck');
        console.log(player.info.name);
        if (player.info && player.info.name) {
            doThing();
        } else {
            const playerName = generateName();

            this.homenamesHelper.updatePlayerInfo(player.id, { playerName }).then(() => {
                doThing();
            });
        }
        // });
    }

    handlePlayerUpdate(playerId, {info, settings}) {
        this.playerInfoMap[playerId] = info;
        this.playerSettingsMap[playerId] = settings;

        this.homegamesRoot.handlePlayerUpdate(playerId, {info, settings});
        // this.playerInfoMap[playerId] = newData;
        this.game.handlePlayerUpdate && this.game.handlePlayerUpdate(playerId, { info, settings });
    }

    handleSpectatorDisconnect(spectatorId) {
        this.squisher.hgRoot.handleSpectatorDisconnect(spectatorId);
        delete this.spectators[spectatorId];
    }

    handlePlayerDisconnect(playerId) {
        console.log('player disconnected formt his ');
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

    handlePlayerInput(player, input) {
        if (input.type === 'click') {
            this.handleClick(player, input.data);
        } else if (input.type === 'keydown') {
            this.game.handleKeyDown && this.game.handleKeyDown(player, input.key);
        } else if (input.type === 'keyup') {
            this.game.handleKeyUp && this.game.handleKeyUp(player, input.key);
        } else if (input.type === 'input') {
            console.log('input isdf');
            console.log(input);
            const node = this.game.findNode(input.nodeId) || this.customTopLayer.root.findChild(input.nodeId);
            if (node && node.node.input) {
                console.log('input');
                console.log(node);
                // hilarious
                if (node.node.input.type === 'file') {
                    node.node.input.oninput(player.id, Object.values(input.input));
                } else {
                    node.node.input.oninput(player.id, input.input);
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

    movePlayer({ playerId, port }) {
        console.log('lookuing '  +playerId);
        const player = this.players[playerId];
        player.receiveUpdate([5, Math.floor(port / 100), Math.floor(port % 100)]);
    }

    handleClick(player, click) {
        if (click.x >= 100 || click.y >= 100) {
            return;
        }

        const clickedNode = this.findClick(click.x, click.y, player.spectating, player.id);

        if (clickedNode) {
            const clickedNodeId = clickedNode.id;
            // todo: implement get node (maybe maintain map in game?)
            const realNode = this.game.findNode(clickedNodeId) || this.customBottomLayer.root.findChild(clickedNodeId) || this.customTopLayer.root.findChild(clickedNodeId);

            if (click.x <= (BEZEL_SIZE_X / 2) || click.x >= (100 - BEZEL_SIZE_X / 2) || click.y <= BEZEL_SIZE_Y / 2 || click.y >= (100 - BEZEL_SIZE_Y / 2)) {
                realNode.node.handleClick && realNode.node.handleClick(player.id, click.x, click.y);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
            } else {
                const shiftedX = click.x - (BEZEL_SIZE_X / 2);
                const shiftedY = click.y - (BEZEL_SIZE_Y / 2);

                const scaledX = shiftedX * ( 1 / ((100 - BEZEL_SIZE_X) / 100));
                const scaledY = shiftedY * ( 1 / ((100 - BEZEL_SIZE_Y) / 100));

                realNode.node.handleClick && realNode.node.handleClick(player.id, scaledX, scaledY);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
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

        if (this.customTopLayer) {
            const scale = {x: 1, y: 1};
            clicked = this.findClickHelper(x, y, false, playerId, this.customTopLayer.root.node, null, scale) || clicked;
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
