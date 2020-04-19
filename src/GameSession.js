const Squisher = require('./Squisher');
const { generateName } = require('./common/util');

class GameSession {
    constructor(game) {
        this.game = game;
        // this is a hack
        this.game.session = this;
        this.squisher = new Squisher(this.game);
        this.squisher.addListener(this);
        this.gameMetadata = this.game.constructor.metadata && this.game.constructor.metadata();
        this.aspectRatio = this.gameMetadata && this.gameMetadata.aspectRatio || {x: 16, y: 9}; 
    }

    handleSquisherUpdate(squished) {
        for (const playerId in this.game.players) {
            this.game.players[playerId].receiveUpdate(squished);
        }
    }

    addPlayer(player) {
        generateName().then(playerName => {
            player.name = playerName;
            this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);

            player.receiveUpdate(this.squisher.squished);
            this.game._hgAddPlayer(player);
            this.game.handleNewPlayer && this.game.handleNewPlayer(player);
            player.addInputListener(this);
        });

    }

    handlePlayerDisconnect(playerId) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
        this.game._hgRemovePlayer(playerId);
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
            if (node && node.input) {
                // hilarious
                if (node.input.type === 'file') {
                    node.input.oninput(Object.values(input.input));
                } else {
                    node.input.oninput(input.input);
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
            clickedNode.handleClick && clickedNode.handleClick(player, click.x, click.y);
        }
    }

    findNode(nodeId) {
        return this.findNodeHelper(nodeId, this.squisher.hgRoot.getRoot());//this.game.getRoot());
    }

    findNodeHelper(nodeId, node, found = null) {
        if (node.id === nodeId) {
            found = node;
        }

        for (const i in node.children) {
            found = this.findNodeHelper(nodeId, node.children[i], found);
        }
        
        return found;
    }

    findClick(x, y, playerId = 0) {
        return this.findClickHelper(x, y, playerId, this.squisher.hgRoot.getRoot());
    }
   
    findClickHelper(x, y, playerId, node, clicked = null) {
        if (node.handleClick && !node.playerId || playerId == node.playerId) {
            const beginX = node.pos.x;
            const endX = node.pos.x + node.size.x;

            const beginY = node.pos.y;
            const endY = node.pos.y + node.size.y;

            const isClicked = (x >= beginX && x <= endX) && (y >= beginY && y <= endY);
            if (isClicked) {
                clicked = node;
            }
        }

        for (const i in node.children) {
            clicked = this.findClickHelper(x, y, playerId, node.children[i], clicked);
        }

        return clicked;
    }

}

module.exports = GameSession;
