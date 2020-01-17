const Squisher = require("./Squisher");
const { generateName } = require("./common/util/name-generator");

class GameSession {
    constructor(squisher) {
        this.game = squisher.game;
        this.squisher = squisher;
        this.squisher.addListener(this);
        this.keyCoolDowns = {};
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
        });

        this.keyCoolDowns[player.id] = {};
        this.squisher.assetBundle && player.receiveUpdate(this.squisher.assetBundle);
        player.receiveUpdate(this.squisher.squished);
        this.game.addPlayer(player);
        this.game.handleNewPlayer && this.game.handleNewPlayer(player);
        player.addInputListener(this);

    }

    handlePlayerDisconnect(player) {
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
        if (input.type === "click") {
            this.handleClick(player, input.data);
        } else if (input.type === "keydown") { 
            this.game.handleKeyDown && this.game.handleKeyDown(player, input.key);
        } else if (input.type === "keyup") {
            this.game.handleKeyUp && this.game.handleKeyUp(player, input.key);
        } else {
            console.log("Unknown input type: " + input.type);
        }
    }


    handleClick(player, click) {
        let translatedX = (click.x / this.renderWidth);
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
            let beginX = node.pos.x * this.renderWidth * .01;
            let endX = (node.pos.x + node.size.x) * this.renderWidth * .01;
            let beginY = node.pos.y * this.renderHeight * .01;
            let endY = (node.pos.y + node.size.y) * this.renderHeight * .01;
            let x1 = x * this.renderWidth;
            let y1 = y * this.renderHeight;
            let isClicked = (x1 >= beginX && x1 <= endX) && (y1 >= beginY && y1 <= endY);
            if (isClicked) {
                clicked = node;
            }
        }

        for (let i in node.children) {
            clicked = this.findClickHelper(x, y, playerId, node.children[i], clicked);
        }

        return clicked;
    }

}

module.exports = GameSession;
