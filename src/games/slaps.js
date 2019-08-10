const Asset = require("../Asset");
const gameNode = require('../GameNode');
const { colors } = require('../Colors');


class Slaps {
    constructor() {
        this.playerCount = 0;
        this.players = {};
        this.base = gameNode(colors.BLUE, this.handleBackgroundClick, {'x': 0, 'y': 0}, {'x': 100, 'y': 100}, {'text': this.playerCount, x: 7.5, y: 0});
        this.canStartNewGame = true;
        this.assets = {
            "testImg": new Asset("url", {
                "location": "https://homegamesio.s3-us-west-1.amazonaws.com/test1.png",
                "type": "image"
            })
        };
    }

    handleBackgroundClick() {
    }

    initializeCards() {
        // TODO: make this a real card deck. for now, 52 random numbers within 1-20
        this.cards = new Array(52);
        for(let i = 0; i < this.cards.length; i++) {
            this.cards[i] = Math.floor(Math.random() * 21) + 1;
        }
    }

    tick() {
        if (this.playerCount < 2 && this.canStartNewGame) { 
            this.canStartNewGame = false;
            this.base.clearChildren();
            const messageNode = gameNode(colors.RED, null, {'x': 50, 'y': 50}, {'x': 20, 'y': 20}, {'text': 'Need at least 2 players', x: 50, y: 0});
            this.base.addChild(messageNode);
        } else if (!this.canStartNewGame && this.playerCount >= 2) {
            this.canStartNewGame = true;

            this.base.clearChildren();
            const newGameNode = gameNode(colors.GREEN, this.newGame.bind(this), {x: 37.5, y: 37.5}, {x: 25, y: 25}, {text: 'New Game', x: 50, y: 47.5});
            this.base.addChild(newGameNode);
        }
    }

    newGame() {
        this.base.clearChildren();
        this.initializeCards();
        
        this.hands = {};
        let index = 0;
        for (let i in this.players) {
            this.hands[i] = this.cards.pop();
            const cardNode = gameNode(colors.WHITE, null, {x: (index * 12) + 1, y: 20}, {x: 10, y: 10}, {text: '' + this.hands[i], x: (index * 12) + 6, y: 25}, {
                "testImg": {
                    size: {
                        x: 10,
                        y: 10
                    },
                    pos: {
                        x: (index * 12) + 6, 
                        y: 35
                    }
                }
            });
            this.base.addChild(cardNode);
            index += 1;
        }

        if (this.canStartNewGame) {
            const newGameNode = gameNode(colors.GREEN, function() {
                this.base.clearChildren();
                setTimeout(this.newGame.bind(this), 500);
            }.bind(this), {x: 80, y: 5}, {x: 15, y: 15}, {text: 'New Game', x: 88, y: 10.5});
            this.base.addChild(newGameNode);
        }

    }

    handleNewPlayer(player) {
        this.players[player.id] = player;
        this.updatePlayerCount(this.playerCount + 1);
    }

    updatePlayerCount(count) {
        this.playerCount = count;
        const newText = this.base.text;
        newText.text = 'Players: ' + count;
        this.base.text = newText;
    }

    handlePlayerDisconnect(player) {
        delete this.players[player.id];
        this.updatePlayerCount(this.playerCount - 1);
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = Slaps;
