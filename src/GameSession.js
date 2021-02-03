const Squisher = require('./Squisher');
const { generateName } = require('./common/util');

const path = require('path');
let baseDir = path.dirname(require.main.filename);

if (baseDir.endsWith('src')) {
    baseDir = baseDir.substring(0, baseDir.length - 3);
}

const { getConfigValue } = require(`${baseDir}/src/util/config`);

const BEZEL_SIZE_X = getConfigValue('BEZEL_SIZE_X', 15);
const BEZEL_SIZE_Y = getConfigValue('BEZEL_SIZE_Y', 15);
const PERFORMANCE_PROFILING = getConfigValue('PERFORMANCE_PROFILING', false);

class GameSession {
    constructor(game, port) {
        this.game = game;
        this.port = port;
        this.spectators = {};
        // this is a hack
        this.game.session = this;
        this.squisher = new Squisher(this.game);
        this.squisher.hgRoot.players = this.game.players;
        this.squisher.hgRoot.spectators = this.spectators;
        this.squisher.addListener(this);
        this.gameMetadata = this.game.constructor.metadata && this.game.constructor.metadata();
        this.aspectRatio = this.gameMetadata && this.gameMetadata.aspectRatio || {x: 16, y: 9}; 
        this.performanceData = {
            'squisherUpdates': []
        };
    }

    getPerformanceData(seconds) {
        console.log(`You want ${seconds} seconds of performance data`);
        const squisherUpdates = this.performanceData['squisherUpdates'];
        let index = squisherUpdates.length - 1;
        const now = Date.now();
        const minDiff = seconds * 1000;
        console.log('what up ' + minDiff);
        for (index; index >= 0; index--) {
            if (now - squisherUpdates[index] >= minDiff) {
                console.log('foudn a second');
                return 'cool';
            }
        }

        return `dont have a second of updates. ran through ${squisherUpdates.length}`;
    }

    handleSquisherUpdate(squished) {
        if (PERFORMANCE_PROFILING) {
            this.performanceData['squisherUpdates'].push(Date.now());
        }

        for (const playerId in this.game.players) {
            this.game.players[playerId].receiveUpdate(squished[playerId]);
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

        if (PERFORMANCE_PROFILING) {
            player.receiveUpdate([7]);
            setInterval(() => {
                console.log(this.getPerformanceData(1));
            }, 1000);
        }   

        generateName().then(playerName => {
            player.name = player.name || playerName;
            this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);

            this.game._hgAddPlayer(player);

            this.game.handleNewPlayer && this.game.handleNewPlayer(player);
            this.squisher.hgRoot.handleNewPlayer(player);
            this.squisher.handleStateChange();
            
            // ensure the squisher has game data for the new player
            player.receiveUpdate(this.squisher.playerFrames[player.id]);
            player.addInputListener(this);
        });
    }

    handleSpectatorDisconnect(spectatorId) {
        this.squisher.hgRoot.handleSpectatorDisconnect(spectatorId);
        delete this.spectators[spectatorId];
    }

    handlePlayerDisconnect(playerId) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
        this.game._hgRemovePlayer(playerId);
        this.squisher.hgRoot.handlePlayerDisconnect(playerId);
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
            const node = this.findNode(input.nodeId);
            if (node && node.node.input) {
                // hilarious
                if (node.node.input.type === 'file') {
                    node.node.input.oninput(player, Object.values(input.input));
                } else {
                    node.node.input.oninput(player, input.input);
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
            if (click.x <= (BEZEL_SIZE_X / 2) || click.x >= (100 - BEZEL_SIZE_X / 2) || click.y <= BEZEL_SIZE_Y / 2 || click.y >= (100 - BEZEL_SIZE_Y / 2)) {
                    
                clickedNode.handleClick && clickedNode.handleClick(player, click.x, click.y);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
            } else {
                const bezelX = BEZEL_SIZE_X;
                const bezelY = BEZEL_SIZE_Y;

                const shiftedX = click.x - (bezelX / 2);
                const shiftedY = click.y - (bezelY / 2);

                const scaledX = shiftedX * ( 1 / ((100 - bezelX) / 100));
                const scaledY = shiftedY * ( 1 / ((100 - bezelY) / 100));

                clickedNode.handleClick && clickedNode.handleClick(player, scaledX, scaledY);//click.x, click.y);//(click.x  - (BEZEL_SIZE_X / 2)) * scaleX, (click.y  - (BEZEL_SIZE_Y / 2) * scaleY));
            }
        }
    }

    findNode(nodeId) {
        return this.findNodeHelper(nodeId, this.squisher.hgRoot.getRoot());//this.game.getRoot());
    }

    findNodeHelper(nodeId, node, found = null) {
        if (node.node.id === nodeId) {
            found = node;
        }

        for (const i in node.node.children) {
            found = this.findNodeHelper(nodeId, node.node.children[i], found);
        }
        
        return found;
    }

    findClick(x, y, spectating, playerId = 0) {
        return this.findClickHelper(x, y, spectating, playerId, this.squisher.hgRoot.getRoot().node);
    }

    findClickHelper(x, y, spectating, playerId, node, clicked = null, inGame) {
        if (node == this.game.getRoot().node) {
            inGame = true;
        }

        if (inGame && spectating) {

        } else {

            if ((node.handleClick && node.playerIds.length === 0 || node.playerIds.find(x => x == playerId)) && node.coordinates2d !== undefined && node.coordinates2d !== null) {
                const vertices = [];
 
                for (const i in node.coordinates2d) {
                    if (inGame) {
                        const bezelX = BEZEL_SIZE_X;
                        const bezelY = BEZEL_SIZE_Y;

                        const scaledX = node.coordinates2d[i][0] * ((100 - bezelX) / 100) + (bezelX / 2);
                        const scaledY = node.coordinates2d[i][1] * ((100 - bezelY) / 100) + (bezelY / 2);

                        vertices.push(
                            [
                                scaledX,// * 100,//(node.coordinates2d[i][0]),// * clickScaleX) + Math.round(100 * (1 - clickScaleX) / 2),
                                scaledY// * 100//(node.coordinates2d[i][1])// * clickScaleY) + Math.round(100 * (1 - clickScaleY) / 2)//100 - BEZEL_SIZE_Y / 2)
                            ]
                        );
                    } else {
                        vertices.push(
                            [node.coordinates2d[i][0],
                                node.coordinates2d[i][1]]
                        );
                    }
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
        }

        for (const i in node.children) {
            clicked = this.findClickHelper(x, y, spectating, playerId, node.children[i].node, clicked, inGame);
        }

        return clicked;
    }

}

module.exports = GameSession;
