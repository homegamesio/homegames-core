const Asset = require("../common/Asset");
const gameNode = require('../common/GameNode');
const colors = require('../common/Colors');
const Deck = require("../common/Deck");
const dictionary = require('../common/util/dictionary');

class Slaps {
    constructor() {
        this.playerCount = 0;
        this.players = {};
        this.base = gameNode(colors.EMERALD, this.handleBackgroundClick, {'x': 0, 'y': 0}, {'x': 100, 'y': 100});
        this.canStartNewGame = true;
        this.assets = {
            "testImg": new Asset("url", {
                "location": "https://homegamesio.s3-us-west-1.amazonaws.com/test1.png",
                "type": "image"
            })
        };
        this.infoNodes = {};
    }

    handleBackgroundClick() {

    }

    initializeCards() {
        this.deck = new Deck();
        this.deck.shuffle();
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
           const newGameNode = gameNode(colors.GREEN, this.newGame.bind(this), {x: 37.5, y: 37.5}, {x: 25, y: 25}, {text: 'New Game', x: 50, y: 47.5}, null, 2);

           this.base.addChild(newGameNode);
       }
    }

    newGame() {
        this.base.clearChildren();
        this.initializeCards();
        
        this.hands = {};
        let index = 0;
        for (let i in this.players) {
            this.hands[i] = this.deck.drawCard();
            const cardNode = gameNode(colors.WHITE, null, {x: (index * 12) + 1, y: 20}, {x: 10, y: 10}, {text: this.hands[i].toString(), x: (index * 12) + 6, y: 25}, {
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
            }.bind(this), {x: 80, y: 5}, {x: 15, y: 15}, {text: 'New Game', x: 88, y: 10.5}, null, 2);

            this.base.addChild(newGameNode);
        }

    }

    handleNewPlayer(player) {
        this.players[player.id] = player;        
        this.updatePlayerCount(this.playerCount + 1);
        const infoNode = gameNode(colors.EMERALD, null, {x: 80, y: 5}, {x: 20, y: 20}, {text: player.name, x: 80, y: 5}, null, player.id);
        this.infoNodes[player.id] = infoNode;
        this.base.addChild(infoNode);
    }

    updatePlayerCount(count) {
        let playerYIndex = 0;
        let playerNodes = Object.values(this.players).map(player => {
           let yIndex = ++playerYIndex * 10;
           return gameNode(colors.EMERALD, null, {x: 15, y: yIndex}, {x: 10, y: 9}, {text: this.players[player.id].name, x: 15, y: yIndex}, null, null);
       });

        let playerInfoPanel = gameNode(colors.EMERALD, null, {x: 15, y: 5}, {x: 10, y: 1}, {text: 'Players', x: 15, y: 5}, null, null);

        playerNodes.forEach(player => {
            playerInfoPanel.addChild(player);
        });

        if (!this.playerInfoPanel) {
            this.playerInfoPanel = playerInfoPanel;
            this.base.addChild(this.playerInfoPanel);
        } else {
            this.base.removeChild(this.playerInfoPanel.id);
            this.playerInfoPanel = playerInfoPanel;
            this.base.addChild(this.playerInfoPanel);
        }
    }

    handlePlayerDisconnect(player) {
        if (this.infoNodes[player.id]) { 
            this.base.removeChild(this.infoNodes[player.id].id);
        }
        delete this.players[player.id];
        delete this.infoNodes[player.id];
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
