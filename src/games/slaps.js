const { Game, GameNode, Colors } = require('squishjs');
const Deck = require('../common/Deck');
const { COLORS: { EMERALD, GREEN, WHITE } } = Colors;

class Slaps extends Game {
    static metadata() {
        return {
            res: {
                width: 1280,
                height: 720
            },
            author: 'Joseph Garcia'
        };
    }

    constructor() {
        super();
        this.players = {};
        this.base = GameNode(EMERALD, this.handleBackgroundClick.bind(this), {'x': 0, 'y': 0}, {'x': 100, 'y': 100});
        this.infoNodeRoot = GameNode(EMERALD, null, {x: 0, y: 0}, {x: 0, y: 0});
        this.base.addChild(this.infoNodeRoot);
        this.infoNodes = {};
    }

    handleBackgroundClick() {

        this.clearTable();
    }

    initializeCards() {
        this.deck = new Deck();
        this.deck.shuffle();
    }

    clearTable() {
        this.base.clearChildren([this.playerInfoPanel && this.playerInfoPanel.id, this.infoNodeRoot && this.infoNodeRoot.id, this.playerRequirementNode && this.playerRequirementNode.id, this.newGameNode && this.newGameNode.id]);
    }

    tick() {

        const playerCount = Object.keys(this.players).length;

        if (playerCount < 2 && !this.playerRequirementNode) {
            this.clearTable();
            this.playerRequirementNode = GameNode(EMERALD, null, {'x': 45, 'y': 5}, {'x': 10, 'y': 10}, {'text': 'Need at least 2 players', x: 45, y: 5});
            this.base.addChild(this.playerRequirementNode);
        } else if (playerCount >= 2 && !this.newGameNode) {

            this.clearTable();
            this.newGameNode = GameNode(GREEN, this.newGame.bind(this), {x: 37.5, y: 37.5}, {x: 25, y: 25}, {text: 'New Game', x: 50, y: 47.5}, null);
            this.base.addChild(this.newGameNode);
        } else if (this.newGameNode && playerCount < 2) {

            this.clearTable();
            this.base.removeChild(this.newGameNode.id);
        } else if (this.playerRequirementNode && playerCount > 1) {

            this.clearTable();
            this.base.removeChild(this.playerRequirementNode.id);
            this.playerRequirementNode = null;
        }
    }

    newGame() {
        this.base.removeChild(this.newGameNode.id);
        this.clearTable();
        this.initializeCards();

        this.hands = {};
        let index = 0;
        let highestVal, winner;
        for (const i in this.players) {
            this.hands[i] = this.deck.drawCard();
            const player = this.players[i];
            if (!highestVal || this.hands[i].value > highestVal) {
                highestVal = this.hands[i].value;
                winner = player;
            }
            const cardNode = GameNode(WHITE, null, {x: (index * 16) + 20, y: 35}, {x: 15, y: 15}, {text: this.hands[i].toString(), x: (index * 16) + 26, y: 35});

            this.base.addChild(cardNode);
            index += 1;
        }

        const winnerNotification = GameNode(GREEN, null, {x: 35, y: 10}, {x: 35, y: 10}, {text: winner.name + ' wins!', x: 50, y: 10});
        this.base.addChild(winnerNotification);

        if (this.canStartNewGame) {
            const newGameNode = GameNode(GREEN, function() {
                this.base.clearChildren();
                setTimeout(this.newGame.bind(this), 500);
            }.bind(this), {x: 80, y: 5}, {x: 15, y: 15}, {text: 'New Game', x: 88, y: 10.5}, null, 2);

            this.base.addChild(newGameNode);
        }

    }

    handleNewPlayer(player) {
        this.players[player.id] = player;
        this.updatePlayerCount();
        const infoNode = GameNode(EMERALD, null, {x: 80, y: 5}, {x: 20, y: 20}, {text: player.name, x: 80, y: 5}, null, player.id);
        this.infoNodes[player.id] = infoNode;
        this.infoNodeRoot.addChild(infoNode);

        this.clearTable();
    }

    updatePlayerCount() {
        let playerYIndex = 0;
        const playerNodes = Object.values(this.players).map(player => {
            const yIndex = ++playerYIndex * 10;
            return GameNode(EMERALD, null, {x: 15, y: yIndex}, {x: 10, y: 9}, {text: this.players[player.id].name, x: 15, y: yIndex}, null, null);
        });

        const playerInfoPanel = GameNode(EMERALD, null, {x: 15, y: 5}, {x: 10, y: 1}, {text: 'Players', x: 15, y: 5}, null, null);

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
            this.infoNodeRoot.removeChild(this.infoNodes[player.id].id);
        }
        delete this.players[player.id];
        delete this.infoNodes[player.id];
        this.updatePlayerCount();
    }

    getRoot() {
        return this.base;
    }

    getAssets() {
        return this.assets;
    }
}

module.exports = Slaps;
