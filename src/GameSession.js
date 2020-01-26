const Squisher = require('./Squisher');
const { generateName } = require('./common/util');

class GameSession {
    constructor(game) {
        this.game = game;
        this.squisher = new Squisher(this.game);
        this.squisher.addListener(this);
        this.renderWidth = this.game.constructor.metadata ? this.game.constructor.metadata().res.width : 1280;
        this.renderHeight = this.game.constructor.metadata ? this.game.constructor.metadata().res.height : 720;
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
            this.game.addPlayer(player);
            this.game.handleNewPlayer && this.game.handleNewPlayer(player);
            player.addInputListener(this);
        });

    }

    handlePlayerDisconnect(playerId) {
        this.game.handlePlayerDisconnect && this.game.handlePlayerDisconnect(playerId);
        this.game.removePlayer(playerId);
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
        } else {
            console.log('Unknown input type: ' + input.type);
        }
    }


    handleClick(player, click) {
        const translatedX = (click.x / this.renderWidth);
        const translatedY = (click.y / this.renderHeight);
        if (translatedX >= 1 || translatedY >= 1) {
            return;
        }
        const clickedNode = this.findClick(translatedX, translatedY, player.id);

        if (clickedNode) {
            clickedNode.handleClick && clickedNode.handleClick(player, translatedX, translatedY);
        }
    }

    findClick(x, y, playerId = 0) {
        return this.findClickHelper(x, y, playerId, this.game.getRoot());
    }
   
    findClickHelper(x, y, playerId, node, clicked = null) {
        if (node.handleClick && !node.playerId || playerId == node.playerId) {
            const beginX = node.pos.x * this.renderWidth * .01;
            const endX = (node.pos.x + node.size.x) * this.renderWidth * .01;
            const beginY = node.pos.y * this.renderHeight * .01;
            const endY = (node.pos.y + node.size.y) * this.renderHeight * .01;
            const x1 = x * this.renderWidth;
            const y1 = y * this.renderHeight;
            const isClicked = (x1 >= beginX && x1 <= endX) && (y1 >= beginY && y1 <= endY);
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
