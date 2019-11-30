const { gameNode, Colors } = require('./src/common');
const { generateName } = require('./src/common/util/name-generator');
const Menu = require('./src/menu');

class Homegames {
    constructor() {
        this.rootNode = gameNode();
        this.players = {};
    }

    handleNewPlayer(player) {
        const sessionNode = new Menu(player).getRoot();

        this.players[player.id] = { 
            player,
            sessionNode
        }

        this.rootNode.addChild(sessionNode);
    }

    handlePlayerDisconnect(player) {
        this.players[player.id] && this.rootNode.removeChild(this.players[player.id].sessionNode.id);
        delete this.players[player.id];
    }

    getRoot() {
        return this.rootNode;
    }
}

module.exports = Homegames;
