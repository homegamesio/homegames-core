const Squisher = require('./Squisher');
const { generateName } = require('./common/util');

class GameSession {
    constructor(game) {
        this.game = game;
        // this is a hack
        this.game.session = this;
        this.squisher = new Squisher(this.game);
        this.squisher.hgRoot.players = this.game.players;
        this.squisher.addListener(this);
        this.gameMetadata = this.game.constructor.metadata && this.game.constructor.metadata();
        this.aspectRatio = this.gameMetadata && this.gameMetadata.aspectRatio || {x: 16, y: 9}; 
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.game.players) {
            this.game.players[playerId].receiveUpdate(squished[playerId]);
        }
    }

    addPlayer(player) {
        if (this.game.canAddPlayer && !this.game.canAddPlayer()) {
            player.receiveUpdate([5, 70, 0]);
        }

        generateName().then(playerName => {
            player.name = player.name || playerName;
            this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);

            this.game._hgAddPlayer(player);

            // ensure the squisher has game data for the new player
            this.squisher.handleStateChange();
            player.receiveUpdate(this.squisher.playerFrames[player.id]);
            this.game.handleNewPlayer && this.game.handleNewPlayer(player);
            player.addInputListener(this);
        });
    }

    handlePlayerDisconnect(playerId) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
//        this.game._hgRemovePlayer(playerId);
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

        const clickedNode = this.findClick(click.x, click.y, player.id);

        if (clickedNode) {
            // todo: get scale value from squisher
            const scaleX = 100 / 85;
            const scaleY = 100 / 85;
            clickedNode.handleClick && clickedNode.handleClick(player, (click.x * scaleX) - (7.5 * scaleX), (click.y * scaleY) - (7.5 * scaleY));
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

    findClick(x, y, playerId = 0) {
        // TODO: get scale (bezel size) from squisher
        return this.findClickHelper(x, y, playerId, this.squisher.hgRoot.getRoot().node);
    }

    findClickHelper(x, y, playerId, node, clicked = null, inGame) {
        if (node == this.game.getRoot().node) {
            inGame = true;
        }

        if ((node.handleClick && node.playerIds.length === 0 || node.playerIds.find(x => x == playerId)) && node.coordinates2d !== undefined && node.coordinates2d !== null) {
            const vertices = [];
 
            // todo: get scale values from squisher
            for (let i in node.coordinates2d) {
                if (inGame) {
                    vertices.push(
                        [node.coordinates2d[i][0] * .85 + 7.5,
                        node.coordinates2d[i][1] * .85 + 7.5]
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

        for (const i in node.children) {
            clicked = this.findClickHelper(x, y, playerId, node.children[i].node, clicked, inGame);
        }

        return clicked;
    }

}

module.exports = GameSession;
