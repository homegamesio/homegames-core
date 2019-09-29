const { Asset, gameNode, Colors, Deck } = require('./common');
const games = require('./games');

class Menu {
    constructor(player) {
        this.base = gameNode(Colors.randomColor(), null, {x: 0, y: 0}, {x: 100, y: 100}, {text: player.name || 'No Name Available', x: 47.5, y: 5}, null, player.id);
        let count = 0;
        for (let i in games) {
            let onGameClick = (player, input) => {
                console.log("Player " + player.id + " wanted to play " + i);
            };
            let gameOption = gameNode(Colors.randomColor(), onGameClick, {x: 12 * count + 10, y: 20}, {x: 10, y: 10}, {text: i, x: 10 * count + 10, y: 20 }, null, player.id);
            count = count + 1;
            this.base.addChild(gameOption);
        }
    }

    handleNewPlayer(player) {
    }

    handlePlayerDisconnect(player) {
    }

    getRoot() {
        return this.base;
    }
}

module.exports = Menu;
